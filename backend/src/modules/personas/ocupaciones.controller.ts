import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES,
  ROLES_SIN_DOCENTE,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActualizarOcupacionDto } from './dto/actualizar-ocupacion.dto.js';
import { CerrarOcupacionDto } from './dto/cerrar-ocupacion.dto.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import { ParseFechaPipe } from './fecha.pipe.js';
import { OcupacionesService } from './ocupaciones.service.js';

/** Ocupaciones de puestos (RF07), colgadas de la persona y consultables por puesto. */
@ApiTags('personas')
@Controller()
export class OcupacionesController {
  constructor(private readonly servicio: OcupacionesService) {}

  @Get('personas/:idPersona/ocupaciones')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: OcupacionDto, isArray: true })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiForbiddenResponse({
    description: 'El docente solo accede a su propia ficha',
  })
  listarDePersona(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<OcupacionDto[]> {
    return this.servicio.listarDePersona(idPersona, sesion);
  }

  @Post('personas/:idPersona/ocupaciones')
  @Roles(ROLES.recursosHumanos)
  @ApiCreatedResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiBadRequestResponse({
    description: 'Fechas incoherentes, persona o puesto de baja',
  })
  @ApiConflictResponse({
    description: 'Se solapa con otra ocupación del mismo puesto',
  })
  crear(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Body() dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.crear(idPersona, dto);
  }

  @Patch('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde')
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiBadRequestResponse({ description: 'Fechas incoherentes' })
  @ApiConflictResponse({ description: 'Ocupación pasada o solape' })
  actualizar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
    @Body() dto: ActualizarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.actualizar(idPersona, idPuesto, fechaDesde, dto);
  }

  @Post('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde/cerrar')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: OcupacionDto })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiBadRequestResponse({ description: 'El fin es anterior al inicio' })
  @ApiConflictResponse({ description: 'Ocupación pasada o solape' })
  cerrar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
    @Body() dto: CerrarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.servicio.cerrar(idPersona, idPuesto, fechaDesde, dto);
  }

  @Delete('personas/:idPersona/ocupaciones/:idPuesto/:fechaDesde')
  @HttpCode(204)
  @Roles(ROLES.recursosHumanos)
  @ApiNoContentResponse({ description: 'Ocupación anulada' })
  @ApiNotFoundResponse({ description: 'La ocupación no existe' })
  @ApiConflictResponse({ description: 'La ocupación ya empezó' })
  anular(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('fechaDesde', ParseFechaPipe) fechaDesde: string,
  ): Promise<void> {
    return this.servicio.anular(idPersona, idPuesto, fechaDesde);
  }

  @Get('puestos/:idPuesto/ocupaciones')
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: OcupanteDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  listarDePuesto(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
  ): Promise<OcupanteDto[]> {
    return this.servicio.listarDePuesto(idPuesto);
  }
}
