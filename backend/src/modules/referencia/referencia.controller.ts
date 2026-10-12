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
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminProvisorioGuard } from '../../common/guards/admin-provisorio.guard.js';
import { ActualizarValorDto } from './dto/actualizar-valor.dto.js';
import { CrearValorDto } from './dto/crear-valor.dto.js';
import { DominioDto } from './dto/dominio.dto.js';
import {
  ActualizacionValorDto,
  ValorReferenciaDto,
} from './dto/valor-referencia.dto.js';
import { ReferenciaService } from './referencia.service.js';

const TOKEN = {
  name: 'x-admin-token',
  description: 'Token provisorio de administrador (hasta RF22)',
};

@ApiTags('referencia')
@Controller('referencia')
export class ReferenciaController {
  constructor(private readonly servicio: ReferenciaService) {}

  @Get()
  @ApiOkResponse({ type: DominioDto, isArray: true })
  listarDominios(): DominioDto[] {
    return this.servicio.listarDominios();
  }

  @Get(':dominio')
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
  @UseGuards(AdminProvisorioGuard)
  @ApiHeader(TOKEN)
  @ApiCreatedResponse({ type: ValorReferenciaDto })
  @ApiForbiddenResponse({ description: 'Falta el token de administrador' })
  @ApiConflictResponse({ description: 'Código, denominación u orden repetido' })
  crear(
    @Param('dominio') dominio: string,
    @Body() dto: CrearValorDto,
  ): Promise<ValorReferenciaDto> {
    return this.servicio.crear(dominio, dto);
  }

  @Patch(':dominio/:id')
  @UseGuards(AdminProvisorioGuard)
  @ApiHeader(TOKEN)
  @ApiOkResponse({ type: ActualizacionValorDto })
  @ApiForbiddenResponse({ description: 'Falta el token de administrador' })
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
  @HttpCode(204)
  @UseGuards(AdminProvisorioGuard)
  @ApiHeader(TOKEN)
  @ApiNoContentResponse({ description: 'Valor borrado' })
  @ApiForbiddenResponse({ description: 'Falta el token de administrador' })
  @ApiNotFoundResponse({ description: 'El dominio o el valor no existe' })
  @ApiConflictResponse({ description: 'El valor está en uso' })
  eliminar(
    @Param('dominio') dominio: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.servicio.eliminar(dominio, id);
  }
}
