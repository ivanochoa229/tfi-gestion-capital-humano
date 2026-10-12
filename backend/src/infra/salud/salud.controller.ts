import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { StorageService } from '../storage/storage.service.js';
import { SaludDto } from './salud.dto.js';

/** Verifica que la base y el almacenamiento respondan. */
@ApiTags('salud')
@Controller('salud')
export class SaludController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOkResponse({ type: SaludDto })
  async verificar(): Promise<SaludDto> {
    const baseDeDatos = await this.dataSource
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false);
    const almacenamiento = await this.storage.disponible();

    return {
      estado: baseDeDatos && almacenamiento ? 'ok' : 'degradado',
      baseDeDatos,
      almacenamiento,
    };
  }
}
