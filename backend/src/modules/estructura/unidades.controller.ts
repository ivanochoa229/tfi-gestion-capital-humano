import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, TODOS_LOS_ROLES } from '../../common/roles.js';
import { PuestosTipoCreadosDto } from './dto/puesto.dto.js';
import {
  UnidadArbolDto,
  UnidadDetalleDto,
  UnidadDto,
} from './dto/unidad.dto.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import { UnidadesService } from './unidades.service.js';

/** Unidades organizativas (RF01): solo consulta; las carga el DBA. */
@ApiTags('estructura')
@Controller('unidades')
export class UnidadesController {
  constructor(
    private readonly unidades: UnidadesService,
    private readonly puestosTipo: PuestosTipoService,
  ) {}

  @Get()
  @Roles(...TODOS_LOS_ROLES)
  @ApiQuery({ name: 'incluirInactivas', required: false, type: Boolean })
  @ApiOkResponse({ type: UnidadDto, isArray: true })
  listar(
    @Query('incluirInactivas') incluirInactivas?: string,
  ): Promise<UnidadDto[]> {
    return this.unidades.listar(incluirInactivas === 'true');
  }

  // Va antes de ':id' para que "arbol" no se tome como identificador.
  @Get('arbol')
  @Roles(...TODOS_LOS_ROLES)
  @ApiQuery({ name: 'incluirInactivas', required: false, type: Boolean })
  @ApiOkResponse({ type: UnidadArbolDto, isArray: true })
  arbol(
    @Query('incluirInactivas') incluirInactivas?: string,
  ): Promise<UnidadArbolDto[]> {
    return this.unidades.arbol(incluirInactivas === 'true');
  }

  @Get(':id')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: UnidadDetalleDto })
  @ApiNotFoundResponse({ description: 'La unidad no existe' })
  obtener(@Param('id', ParseIntPipe) id: number): Promise<UnidadDetalleDto> {
    return this.unidades.obtener(id);
  }

  @Post(':id/puestos-tipo')
  @Roles(ROLES.analistaPuestos)
  @ApiCreatedResponse({ type: PuestosTipoCreadosDto })
  @ApiBadRequestResponse({ description: 'La unidad no es una cátedra activa' })
  @ApiNotFoundResponse({ description: 'La unidad no existe' })
  @ApiConflictResponse({
    description: 'La cátedra ya tiene alguno de los cargos',
  })
  crearPuestosTipo(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PuestosTipoCreadosDto> {
    return this.puestosTipo.crear(id);
  }
}
