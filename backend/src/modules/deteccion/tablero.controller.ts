import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { ROLES_GLOBALES_DE_DETECCION } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { FiltroTableroDto, TableroDto } from './dto/tablero.dto.js';
import { TableroService } from './tablero.service.js';

@ApiTags('deteccion')
@Controller('deteccion')
export class TableroController {
  constructor(private readonly servicio: TableroService) {}

  @Get('tablero')
  @Roles(...ROLES_GLOBALES_DE_DETECCION)
  @ApiOkResponse({ type: TableroDto })
  async tablero(
    @Query() filtro: FiltroTableroDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<TableroDto> {
    return this.servicio.tablero(filtro, sesion);
  }
}
