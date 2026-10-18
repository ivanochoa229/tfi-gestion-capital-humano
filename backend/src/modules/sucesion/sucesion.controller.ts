import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { ROLES, ROLES_LECTORES_DE_SUCESION } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { CoberturaService } from './cobertura.service.js';
import {
  CoberturaDto,
  FiltroCoberturaDto,
  MiPlanDto,
} from './dto/cobertura.dto.js';

/** Cobertura de OE7 y planes propios del docente (RF13, RF14). */
@ApiTags('sucesion')
@Controller('sucesion')
export class SucesionController {
  constructor(private readonly servicio: CoberturaService) {}

  @Get('cobertura')
  @Roles(...ROLES_LECTORES_DE_SUCESION)
  @ApiOkResponse({ type: CoberturaDto })
  cobertura(
    @Query() filtro: FiltroCoberturaDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<CoberturaDto> {
    return this.servicio.cobertura(filtro, sesion);
  }

  @Get('mis-planes')
  @Roles(ROLES.docente)
  @ApiOkResponse({ type: MiPlanDto, isArray: true })
  misPlanes(@UsuarioActual() sesion: SesionUsuario): Promise<MiPlanDto[]> {
    return this.servicio.misPlanes(sesion);
  }
}
