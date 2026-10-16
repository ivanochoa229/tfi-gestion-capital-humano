import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
  ROLES_ESCRITORES_DE_ACTIVOS,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActivosService } from './activos.service.js';
import { disposicionAdjunto } from './archivo.js';
import {
  ActivoDto,
  ActualizarActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';

/** Activos de conocimiento (RF11): documentación vinculada a los conocimientos y a una unidad. */
@ApiTags('conocimiento')
@Controller('activos')
export class ActivosController {
  constructor(private readonly activos: ActivosService) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PaginaActivosDto })
  listar(
    @UsuarioActual() sesion: SesionUsuario,
    @Query() filtro: FiltroActivosDto,
  ): Promise<PaginaActivosDto> {
    return this.activos.listar(sesion, filtro);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: ActivoDto })
  @ApiNotFoundResponse({
    description: 'El activo no existe o está dado de baja',
  })
  obtener(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.obtener(sesion, id);
  }

  @Get(':id/descarga')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({
    description: 'Contenido del archivo',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'El activo o su archivo no existen' })
  @ApiConflictResponse({ description: 'El activo es un enlace' })
  async descargar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const descarga = await this.activos.descargar(sesion, id);
    respuesta.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(descarga.flujo, {
      type: descarga.tipoMime,
      disposition: disposicionAdjunto(descarga.nombre),
      length: descarga.tamanio,
    });
  }

  @Post()
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiCreatedResponse({ type: ActivoDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos, o ni archivo ni enlace',
  })
  @ApiForbiddenResponse({ description: 'La unidad está fuera de tu alcance' })
  @ApiConflictResponse({ description: 'Ya hay un activo con el mismo archivo' })
  @ApiPayloadTooLargeResponse({
    description: 'El archivo supera el tamaño máximo',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Tipo de archivo no permitido',
  })
  crear(
    @UsuarioActual() sesion: SesionUsuario,
    @Body() dto: CrearActivoDto,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<ActivoDto> {
    return this.activos.crear(sesion, dto, archivo);
  }

  @Patch(':id')
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiNotFoundResponse({ description: 'El activo no existe' })
  @ApiForbiddenResponse({ description: 'La unidad está fuera de tu alcance' })
  @ApiConflictResponse({ description: 'El activo está dado de baja' })
  actualizar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarActivoDto,
  ): Promise<ActivoDto> {
    return this.activos.actualizar(sesion, id, dto);
  }

  @Put(':id/archivo')
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOkResponse({ type: ActivoDto })
  @ApiBadRequestResponse({
    description: 'Falta el archivo, o el activo es un enlace',
  })
  @ApiConflictResponse({
    description: 'Archivo idéntico o repetido, o activo dado de baja',
  })
  @ApiPayloadTooLargeResponse({
    description: 'El archivo supera el tamaño máximo',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Tipo de archivo no permitido',
  })
  reemplazarArchivo(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo?: Express.Multer.File,
  ): Promise<ActivoDto> {
    if (!archivo) {
      throw new BadRequestException('Falta el campo "archivo"');
    }
    return this.activos.reemplazarArchivo(sesion, id, archivo);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiConflictResponse({ description: 'El activo ya está dado de baja' })
  baja(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.darDeBaja(sesion, id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(...ROLES_ESCRITORES_DE_ACTIVOS)
  @ApiOkResponse({ type: ActivoDto })
  @ApiConflictResponse({
    description: 'Ya está activo, o su archivo está repetido',
  })
  reactivar(
    @UsuarioActual() sesion: SesionUsuario,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ActivoDto> {
    return this.activos.reactivar(sesion, id);
  }
}
