import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES_APROBADORES_DE_PLANES,
  ROLES_ELABORADORES_DE_PLANES,
  ROLES_LECTORES_DE_SUCESION,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  CrearPlanDto,
  EditarPlanDto,
  FiltroPlanesDto,
  PlanDetalleDto,
  PlanDto,
  ResolverPlanDto,
} from './dto/plan.dto.js';
import { PlanesService } from './planes.service.js';

/** Planes de sucesión de los puestos críticos (RF13). */
@ApiTags('sucesion')
@Controller('planes')
export class PlanesController {
  constructor(private readonly servicio: PlanesService) {}

  @Get()
  @Roles(...ROLES_LECTORES_DE_SUCESION)
  @ApiOkResponse({ type: PlanDto, isArray: true })
  listar(
    @Query() filtro: FiltroPlanesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto[]> {
    return this.servicio.listar(filtro, sesion);
  }

  @Get(':id')
  @Roles(...ROLES_LECTORES_DE_SUCESION)
  @ApiOkResponse({ type: PlanDetalleDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  buscar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDetalleDto> {
    return this.servicio.detalle(id, sesion);
  }

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiCreatedResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiBadRequestResponse({
    description: 'Puesto de baja o responsable inexistente o inactivo',
  })
  @ApiConflictResponse({
    description: 'El puesto ya tiene un plan en elaboración o aprobado',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  crear(
    @Body() dto: CrearPlanDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.crear(dto, sesion);
  }

  @Patch(':id')
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiBadRequestResponse({ description: 'Responsable inexistente o inactivo' })
  @ApiConflictResponse({ description: 'El plan no está en borrador' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarPlanDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.editar(id, dto, sesion);
  }

  @Post(':id/presentar')
  @HttpCode(200)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiConflictResponse({
    description: 'El plan no está en borrador o no tiene candidatos',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  presentar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.presentar(id, sesion);
  }

  @Post(':id/resolver')
  @HttpCode(200)
  @Roles(...ROLES_APROBADORES_DE_PLANES)
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiBadRequestResponse({ description: 'Rechazar exige un motivo' })
  @ApiConflictResponse({
    description: 'El plan no está pendiente de aprobación',
  })
  resolver(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverPlanDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.resolver(id, dto, sesion);
  }

  @Post(':id/reabrir')
  @HttpCode(200)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiConflictResponse({ description: 'El plan no está rechazado' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.reabrir(id, sesion);
  }

  @Post(':id/nueva-version')
  @HttpCode(201)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiCreatedResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiConflictResponse({
    description:
      'El plan no está aprobado o el puesto ya tiene uno en elaboración',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  nuevaVersion(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.nuevaVersion(id, sesion);
  }

  @Post(':id/cerrar')
  @HttpCode(200)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiConflictResponse({
    description: 'El plan está pendiente de aprobación o ya cerrado',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  cerrar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return this.servicio.cerrar(id, sesion);
  }
}
