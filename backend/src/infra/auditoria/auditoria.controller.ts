import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES } from '../../common/roles.js';
import { AuditoriaService } from './auditoria.service.js';
import { AuditoriaDto } from './dto/auditoria.dto.js';
import { ConsultaAuditoriaDto } from './dto/consulta-auditoria.dto.js';

/** Bitácora de solo lectura (RNF05). */
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly servicio: AuditoriaService) {}

  @Get()
  @Roles(ROLES.recursosHumanos, ROLES.autoridad)
  @ApiOkResponse({ type: AuditoriaDto, isArray: true })
  consultar(@Query() filtro: ConsultaAuditoriaDto): Promise<AuditoriaDto[]> {
    return this.servicio.consultar(filtro);
  }
}
