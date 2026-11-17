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
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  ROLES_LECTORES_DE_PERFIL,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { ArchivoDemasiadoGrandeFilter } from './archivo-demasiado-grande.filter.js';
import { disposicionAdjunto } from './archivo.js';
import { DeclaracionesService } from './declaraciones.service.js';
import {
  AcreditacionDto,
  AcreditarDto,
  ConocimientoPersonaDto,
  DeclararDto,
  PerfilConocimientoDto,
  PermisosPerfilDto,
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

  @Get('permisos')
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({ type: PermisosPerfilDto })
  @ApiForbiddenResponse({
    description: 'Sin acceso al conocimiento de esa persona',
  })
  permisos(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PermisosPerfilDto> {
    return this.perfil.permisos(idPersona, sesion);
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

  @Get(':idConocimiento/acreditaciones/:idAcreditacion/evidencia')
  @Roles(...ROLES_LECTORES_DE_PERFIL)
  @ApiOkResponse({
    description: 'Archivo de evidencia de la acreditación',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'La acreditación no existe o no tiene evidencia',
  })
  @ApiForbiddenResponse({
    description: 'Sin acceso al conocimiento de esa persona',
  })
  async evidencia(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Param('idAcreditacion', ParseIntPipe) idAcreditacion: number,
    @UsuarioActual() sesion: SesionUsuario,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const descarga = await this.acreditaciones.evidencia(
      idPersona,
      idConocimiento,
      idAcreditacion,
      sesion,
    );
    respuesta.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(descarga.flujo, {
      type: descarga.tipoMime,
      disposition: disposicionAdjunto(descarga.nombre),
      length: descarga.tamanio,
    });
  }

  @Post(':idConocimiento/acreditaciones')
  @Roles(...ROLES_EVALUADORES)
  @ApiConsumes('application/json', 'multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  @UseFilters(ArchivoDemasiadoGrandeFilter)
  @ApiCreatedResponse({ type: AcreditacionDto })
  @ApiForbiddenResponse({
    description:
      'La persona no ocupa un puesto por debajo del evaluador, o es autoacreditación',
  })
  @ApiBadRequestResponse({
    description: 'Sin persona vinculada, fecha futura o datos inactivos',
  })
  @ApiPayloadTooLargeResponse({
    description: 'La evidencia supera el tamaño máximo',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Tipo de archivo de evidencia no permitido',
  })
  acreditar(
    @Param('idPersona', ParseIntPipe) idPersona: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: AcreditarDto,
    @UsuarioActual() sesion: SesionUsuario,
    /** Evidencia opcional (campo `archivo` del multipart). */
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<AcreditacionDto> {
    return this.acreditaciones.acreditar(
      idPersona,
      idConocimiento,
      dto,
      sesion,
      archivo,
    );
  }
}
