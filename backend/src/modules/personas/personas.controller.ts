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
  ROLES,
  ROLES_SIN_DOCENTE,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto.js';
import { CrearPersonaDto } from './dto/crear-persona.dto.js';
import { FiltroPersonasDto } from './dto/filtro-personas.dto.js';
import {
  PersonaDetalleDto,
  PersonaDto,
  ResultadoBajaPersonaDto,
} from './dto/persona.dto.js';
import { PersonasService } from './personas.service.js';

/** Registro de personas (RF06). */
@ApiTags('personas')
@Controller('personas')
export class PersonasController {
  constructor(private readonly servicio: PersonasService) {}

  @Get()
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: PersonaDto, isArray: true })
  listar(
    @Query() filtro: FiltroPersonasDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PersonaDto[]> {
    return this.servicio.listar(filtro, sesion);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiForbiddenResponse({
    description: 'El docente solo accede a su propia ficha',
  })
  obtener(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PersonaDetalleDto> {
    return this.servicio.obtener(id, sesion);
  }

  @Post()
  @Roles(ROLES.recursosHumanos)
  @ApiCreatedResponse({ type: PersonaDetalleDto })
  @ApiBadRequestResponse({
    description: 'Fechas incoherentes o situación inválida',
  })
  @ApiConflictResponse({ description: 'Legajo o documento repetidos' })
  crear(@Body() dto: CrearPersonaDto): Promise<PersonaDetalleDto> {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiBadRequestResponse({
    description: 'Fechas incoherentes o situación inválida',
  })
  @ApiConflictResponse({ description: 'Legajo o documento repetidos' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPersonaDto,
  ): Promise<PersonaDetalleDto> {
    return this.servicio.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: ResultadoBajaPersonaDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  @ApiConflictResponse({ description: 'Tiene ocupaciones vigentes o futuras' })
  darDeBaja(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResultadoBajaPersonaDto> {
    return this.servicio.darDeBaja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @ApiOkResponse({ type: PersonaDetalleDto })
  @ApiNotFoundResponse({ description: 'La persona no existe' })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<PersonaDetalleDto> {
    return this.servicio.reactivar(id);
  }
}
