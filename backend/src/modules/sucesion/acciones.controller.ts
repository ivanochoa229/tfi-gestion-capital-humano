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
  ROLES_AVANZADORES_DE_ACCIONES,
  ROLES_GESTORES_DE_ACCIONES,
  ROLES_LECTORES_DE_ACCIONES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AccionesService } from './acciones.service.js';
import {
  AccionDto,
  AvanzarAccionDto,
  CrearAccionDto,
  EditarAccionDto,
  FiltroAccionesDto,
} from './dto/accion.dto.js';

/** Acciones de transferencia de conocimiento (RF15). */
@ApiTags('sucesion')
@Controller('acciones')
export class AccionesController {
  constructor(private readonly servicio: AccionesService) {}

  @Get()
  @Roles(...ROLES_LECTORES_DE_ACCIONES)
  @ApiOkResponse({
    type: AccionDto,
    isArray: true,
    description:
      'RR. HH. y autoridad ven todas; los jefes, las de planes de su alcance; el docente, las suyas',
  })
  listar(
    @Query() filtro: FiltroAccionesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AccionDto[]> {
    return this.servicio.listar(filtro, sesion);
  }

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_GESTORES_DE_ACCIONES)
  @ApiCreatedResponse({ type: AccionDto })
  @ApiNotFoundResponse({ description: 'El conocimiento o el plan no existe' })
  @ApiBadRequestResponse({
    description:
      'Conocimiento de baja, tipo o personas inválidos, o destinatario igual al responsable',
  })
  @ApiConflictResponse({
    description:
      'El plan está cerrado o el conocimiento no es requisito de su puesto',
  })
  crear(
    @Body() dto: CrearAccionDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AccionDto> {
    return this.servicio.crear(dto, sesion);
  }

  @Patch(':id')
  @Roles(...ROLES_GESTORES_DE_ACCIONES)
  @ApiOkResponse({ type: AccionDto })
  @ApiNotFoundResponse({ description: 'La acción no existe' })
  @ApiBadRequestResponse({ description: 'Tipo o personas inválidos' })
  @ApiConflictResponse({
    description: 'La acción ya está completada o cancelada',
  })
  editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarAccionDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AccionDto> {
    return this.servicio.editar(id, dto, sesion);
  }

  @Post(':id/avanzar')
  @HttpCode(200)
  @Roles(...ROLES_AVANZADORES_DE_ACCIONES)
  @ApiOkResponse({ type: AccionDto })
  @ApiNotFoundResponse({ description: 'La acción no existe' })
  @ApiBadRequestResponse({ description: 'Fecha de cumplimiento inválida' })
  @ApiConflictResponse({ description: 'Transición de estado no permitida' })
  @ApiForbiddenResponse({
    description: 'No sos el responsable de la acción ni Recursos Humanos',
  })
  avanzar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AvanzarAccionDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AccionDto> {
    return this.servicio.avanzar(id, dto, sesion);
  }
}
