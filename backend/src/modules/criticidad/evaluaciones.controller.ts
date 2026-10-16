import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
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
  ROLES_EVALUADORES_DE_CRITICIDAD,
  ROLES_LECTORES_DE_CRITICIDAD,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { EvaluacionDto, EvaluarDto } from './dto/evaluacion.dto.js';
import { EvaluacionesService } from './evaluaciones.service.js';

/** Evaluación de criticidad de un conocimiento en un puesto (RF12). */
@ApiTags('criticidad')
@Controller('puestos/:idPuesto/criticidad/:idConocimiento')
export class EvaluacionesController {
  constructor(private readonly servicio: EvaluacionesService) {}

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_EVALUADORES_DE_CRITICIDAD)
  @ApiCreatedResponse({ type: EvaluacionDto })
  @ApiNotFoundResponse({
    description: 'El puesto o el conocimiento no existen',
  })
  @ApiBadRequestResponse({
    description:
      'Fecha futura, escala inactiva o puesto o conocimiento de baja',
  })
  @ApiConflictResponse({ description: 'El puesto no exige ese conocimiento' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  evaluar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: EvaluarDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<EvaluacionDto> {
    return this.servicio.evaluar(idPuesto, idConocimiento, dto, sesion);
  }

  @Get('historial')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: EvaluacionDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  historial(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<EvaluacionDto[]> {
    return this.servicio.historial(idPuesto, idConocimiento, sesion);
  }
}
