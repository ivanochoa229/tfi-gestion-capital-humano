import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { ROLES_ELABORADORES_DE_PLANES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { CandidatosService } from './candidatos.service.js';
import {
  AgregarCandidatoDto,
  CandidatoDto,
  OrdenCandidatosDto,
  SeguimientoCandidatoDto,
} from './dto/candidato.dto.js';

/** Candidatos de un plan de sucesión (RF14). */
@ApiTags('sucesion')
@Controller('planes/:idPlan/candidatos')
export class CandidatosController {
  constructor(private readonly servicio: CandidatosService) {}

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiCreatedResponse({ type: CandidatoDto })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiBadRequestResponse({
    description:
      'Persona inexistente, inactiva o sin ocupación vigente; estado de preparación inválido',
  })
  @ApiConflictResponse({
    description:
      'El plan no está en borrador, la persona ocupa el puesto, ya es candidata o la prioridad está usada',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  agregar(
    @Param('idPlan', ParseIntPipe) idPlan: number,
    @Body() dto: AgregarCandidatoDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<CandidatoDto> {
    return this.servicio.agregar(idPlan, dto, sesion);
  }

  @Put('orden')
  @HttpCode(200)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: CandidatoDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El plan no existe' })
  @ApiBadRequestResponse({
    description: 'El orden repite, omite o nombra personas ajenas al plan',
  })
  @ApiConflictResponse({ description: 'El plan no está en borrador' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  reordenar(
    @Param('idPlan', ParseIntPipe) idPlan: number,
    @Body() dto: OrdenCandidatosDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<CandidatoDto[]> {
    return this.servicio.reordenar(idPlan, dto, sesion);
  }

  @Patch(':idPersona')
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiOkResponse({ type: CandidatoDto })
  @ApiNotFoundResponse({ description: 'El plan o el candidato no existe' })
  @ApiBadRequestResponse({ description: 'Estado de preparación inválido' })
  @ApiConflictResponse({
    description: 'El plan no está en borrador ni aprobado',
  })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  seguimiento(
    @Param('idPlan', ParseIntPipe) idPlan: number,
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Body() dto: SeguimientoCandidatoDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<CandidatoDto> {
    return this.servicio.seguimiento(idPlan, idPersona, dto, sesion);
  }

  @Delete(':idPersona')
  @HttpCode(204)
  @Roles(...ROLES_ELABORADORES_DE_PLANES)
  @ApiNoContentResponse({ description: 'Candidato quitado' })
  @ApiNotFoundResponse({ description: 'El plan o el candidato no existe' })
  @ApiConflictResponse({ description: 'El plan no está en borrador' })
  @ApiForbiddenResponse({ description: 'El puesto está fuera de tu alcance' })
  quitar(
    @Param('idPlan', ParseIntPipe) idPlan: number,
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<void> {
    return this.servicio.quitar(idPlan, idPersona, sesion);
  }
}
