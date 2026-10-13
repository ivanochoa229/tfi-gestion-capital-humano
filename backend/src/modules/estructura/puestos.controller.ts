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
import { ROLES, TODOS_LOS_ROLES } from '../../common/roles.js';
import { ActualizarPuestoDto } from './dto/actualizar-puesto.dto.js';
import { CrearPuestoDto } from './dto/crear-puesto.dto.js';
import { FiltroPuestosDto } from './dto/filtro-puestos.dto.js';
import { PuestoDetalleDto, PuestoDto } from './dto/puesto.dto.js';
import { PuestosService } from './puestos.service.js';

/** Inventario de puestos (RF02). */
@ApiTags('estructura')
@Controller('puestos')
export class PuestosController {
  constructor(private readonly servicio: PuestosService) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PuestoDto, isArray: true })
  listar(@Query() filtro: FiltroPuestosDto): Promise<PuestoDto[]> {
    return this.servicio.listar(filtro);
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.obtener(id);
  }

  @Post()
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: PuestoDetalleDto })
  @ApiBadRequestResponse({ description: 'Unidad, nivel o superior inválidos' })
  @ApiConflictResponse({ description: 'Denominación repetida en la unidad' })
  crear(@Body() dto: CrearPuestoDto): Promise<PuestoDetalleDto> {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiBadRequestResponse({ description: 'Superior inválido o ciclo' })
  @ApiConflictResponse({ description: 'Denominación repetida en la unidad' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPuestoDto,
  ): Promise<PuestoDetalleDto> {
    return this.servicio.actualizar(id, dto);
  }

  @Post(':id/baja')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiConflictResponse({ description: 'Tiene subordinados activos' })
  darDeBaja(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.darDeBaja(id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: PuestoDetalleDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiConflictResponse({
    description: 'La unidad o el superior están inactivos',
  })
  reactivar(@Param('id', ParseIntPipe) id: number): Promise<PuestoDetalleDto> {
    return this.servicio.reactivar(id);
  }
}
