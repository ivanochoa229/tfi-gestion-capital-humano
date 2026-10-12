import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, TODOS_LOS_ROLES } from '../../common/roles.js';
import { ActualizarValorDto } from './dto/actualizar-valor.dto.js';
import { CrearValorDto } from './dto/crear-valor.dto.js';
import { DominioDto } from './dto/dominio.dto.js';
import {
  ActualizacionValorDto,
  ValorReferenciaDto,
} from './dto/valor-referencia.dto.js';
import { ReferenciaService } from './referencia.service.js';

@ApiTags('referencia')
@Controller('referencia')
export class ReferenciaController {
  constructor(private readonly servicio: ReferenciaService) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: DominioDto, isArray: true })
  listarDominios(): DominioDto[] {
    return this.servicio.listarDominios();
  }

  @Get(':dominio')
  @Roles(...TODOS_LOS_ROLES)
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiOkResponse({ type: ValorReferenciaDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El dominio no existe' })
  listarValores(
    @Param('dominio') dominio: string,
    @Query('incluirInactivos') incluirInactivos?: string,
  ): Promise<ValorReferenciaDto[]> {
    return this.servicio.listarValores(dominio, incluirInactivos === 'true');
  }

  @Post(':dominio')
  @Roles(ROLES.administrador)
  @ApiCreatedResponse({ type: ValorReferenciaDto })
  @ApiForbiddenResponse({
    description: 'El rol no puede modificar las tablas de referencia',
  })
  @ApiConflictResponse({ description: 'Código, denominación u orden repetido' })
  crear(
    @Param('dominio') dominio: string,
    @Body() dto: CrearValorDto,
  ): Promise<ValorReferenciaDto> {
    return this.servicio.crear(dominio, dto);
  }

  @Patch(':dominio/:id')
  @Roles(ROLES.administrador)
  @ApiOkResponse({ type: ActualizacionValorDto })
  @ApiForbiddenResponse({
    description: 'El rol no puede modificar las tablas de referencia',
  })
  @ApiNotFoundResponse({ description: 'El dominio o el valor no existe' })
  @ApiConflictResponse({
    description: 'Duplicado, o cambio de código de un valor en uso',
  })
  actualizar(
    @Param('dominio') dominio: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarValorDto,
  ): Promise<ActualizacionValorDto> {
    return this.servicio.actualizar(dominio, id, dto);
  }

  @Delete(':dominio/:id')
  @Roles(ROLES.administrador)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Valor borrado' })
  @ApiForbiddenResponse({
    description: 'El rol no puede modificar las tablas de referencia',
  })
  @ApiNotFoundResponse({ description: 'El dominio o el valor no existe' })
  @ApiConflictResponse({ description: 'El valor está en uso' })
  eliminar(
    @Param('dominio') dominio: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.servicio.eliminar(dominio, id);
  }
}
