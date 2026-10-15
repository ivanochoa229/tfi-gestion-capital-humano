import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  ROLES_LECTORES_DE_PERFIL,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { DeclaracionesService } from './declaraciones.service.js';
import {
  AcreditacionDto,
  AcreditarDto,
  ConocimientoPersonaDto,
  DeclararDto,
  PerfilConocimientoDto,
} from './dto/perfil.dto.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';

/** Conocimiento de una persona: lo que declara y lo que se le acredita (RF10). */
@ApiTags('conocimiento')
@Controller('personas/:idPersona/conocimientos')
export class PerfilConocimientoController {
  constructor(
    private readonly perfil: PerfilConocimientoService,
    private readonly declaraciones: DeclaracionesService,
    private readonly acreditaciones: AcreditacionesService,
  ) {}

  @Get()
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({ type: PerfilConocimientoDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'Sin acceso al conocimiento de esa persona',
  })
  listar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PerfilConocimientoDto[]> {
    return this.perfil.perfilDe(idPersona, sesion);
  }

  @Get(':idConocimiento/acreditaciones')
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({ type: AcreditacionDto, isArray: true })
  @ApiForbiddenResponse({
    description: 'Sin acceso al conocimiento de esa persona',
  })
  historial(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AcreditacionDto[]> {
    return this.perfil.historial(idPersona, idConocimiento, sesion);
  }

  @Put(':idConocimiento/declaracion')
  @Roles(...ROLES_DECLARANTES)
  @ApiOkResponse({ type: ConocimientoPersonaDto })
  @ApiForbiddenResponse({ description: 'Solo la propia persona declara' })
  @ApiBadRequestResponse({
    description: 'Persona, conocimiento o nivel inactivos',
  })
  declarar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: DeclararDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<ConocimientoPersonaDto> {
    return this.declaraciones.declarar(idPersona, idConocimiento, dto, sesion);
  }

  @Delete(':idConocimiento/declaracion')
  @HttpCode(204)
  @Roles(...ROLES_DECLARANTES)
  @ApiNoContentResponse({ description: 'Declaración retirada' })
  @ApiNotFoundResponse({ description: 'No hay declaración que retirar' })
  @ApiForbiddenResponse({ description: 'Solo la propia persona' })
  retirar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<void> {
    return this.declaraciones.retirar(idPersona, idConocimiento, sesion);
  }

  @Post(':idConocimiento/acreditaciones')
  @Roles(...ROLES_EVALUADORES)
  @ApiCreatedResponse({ type: AcreditacionDto })
  @ApiForbiddenResponse({ description: 'Fuera del alcance o autoacreditación' })
  @ApiBadRequestResponse({
    description: 'Sin persona vinculada, fecha futura o datos inactivos',
  })
  acreditar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: AcreditarDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AcreditacionDto> {
    return this.acreditaciones.acreditar(
      idPersona,
      idConocimiento,
      dto,
      sesion,
    );
  }
}
