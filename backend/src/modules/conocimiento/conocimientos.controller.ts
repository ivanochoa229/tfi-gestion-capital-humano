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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES,
  ROLES_DECLARANTES,
  ROLES_EVALUADORES,
  TODOS_LOS_ROLES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ConocimientosService } from './conocimientos.service.js';
import {
  ActualizarConocimientoDto,
  ConocimientoDto,
  CrearConocimientoDto,
  FiltroConocimientosDto,
  FusionarConocimientoDto,
  ResultadoFusionDto,
} from './dto/catalogo.dto.js';
import {
  MiConocimientoDto,
  PendienteAcreditacionDto,
} from './dto/perfil.dto.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';

/** Catálogo de conocimientos (RF08) y vistas propias del docente y del evaluador. */
@ApiTags('conocimiento')
@Controller('conocimientos')
export class ConocimientosController {
  constructor(
    private readonly catalogo: ConocimientosService,
    private readonly perfil: PerfilConocimientoService,
  ) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: ConocimientoDto, isArray: true })
  listar(@Query() filtro: FiltroConocimientosDto): Promise<ConocimientoDto[]> {
    return this.catalogo.listar(filtro);
  }

  @Get('mios')
  @Roles(...ROLES_DECLARANTES)
  @ApiOkResponse({ type: MiConocimientoDto, isArray: true })
  @ApiBadRequestResponse({ description: 'El usuario no tiene persona vinculada' })
  mios(@UsuarioActual() sesion: SesionUsuario): Promise<MiConocimientoDto[]> {
    return this.perfil.mios(sesion);
  }

  @Get('pendientes-acreditacion')
  @Roles(...ROLES_EVALUADORES)
  @ApiOkResponse({ type: PendienteAcreditacionDto, isArray: true })
  pendientes(
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<PendienteAcreditacionDto[]> {
    return this.perfil.pendientes(sesion);
  }

  @Post()
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: ConocimientoDto })
  @ApiBadRequestResponse({ description: 'Tipo o área inexistentes o inactivos' })
  @ApiConflictResponse({ description: 'Ya existe un conocimiento activo igual del mismo tipo' })
  crear(@Body() dto: CrearConocimientoDto): Promise<ConocimientoDto> {
    return this.catalogo.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Duplicado o conocimiento dado de baja' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarConocimientoDto,
  ): Promise<ConocimientoDto> {
    return this.catalogo.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Lo piden puestos activos' })
  baja(@Param('id', ParseIntPipe) id: number): Promise<ConocimientoDto> {
    return this.catalogo.baja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ConocimientoDto })
  @ApiNotFoundResponse({ description: 'El conocimiento no existe' })
  @ApiConflictResponse({ description: 'Ya hay uno activo igual' })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<ConocimientoDto> {
    return this.catalogo.reactivar(id);
  }

  @Post(':id/fusionar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ResultadoFusionDto })
  @ApiNotFoundResponse({ description: 'Origen o destino inexistentes' })
  @ApiBadRequestResponse({ description: 'Inactivos, de distinto tipo o el mismo' })
  fusionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FusionarConocimientoDto,
  ): Promise<ResultadoFusionDto> {
    return this.catalogo.fusionar(id, dto);
  }
}
