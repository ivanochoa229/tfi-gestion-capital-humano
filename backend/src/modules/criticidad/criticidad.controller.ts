import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES,
  ROLES_LECTORES_DE_CRITICIDAD,
  ROLES_LECTORES_DE_MATRIZ,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { CeldaMatrizDto, EditarCeldaDto, MatrizDto } from './dto/matriz.dto.js';
import {
  AvanceDto,
  FiltroParesDto,
  ParCriticidadDto,
} from './dto/pares.dto.js';
import { MatrizService } from './matriz.service.js';
import { ParesService } from './pares.service.js';

/** Criticidad del conocimiento por puesto (RF12): escalas, matriz, pares y avance. */
@ApiTags('criticidad')
@Controller('criticidad')
export class CriticidadController {
  constructor(
    private readonly matriz: MatrizService,
    private readonly pares: ParesService,
  ) {}

  @Get('matriz')
  @Roles(...ROLES_LECTORES_DE_MATRIZ)
  @ApiOkResponse({ type: MatrizDto })
  obtenerMatriz(): Promise<MatrizDto> {
    return this.matriz.obtener();
  }

  @Put('matriz/:idImpacto/:idDificultad')
  @Roles(ROLES.administrador)
  @ApiOkResponse({ type: CeldaMatrizDto })
  @ApiNotFoundResponse({ description: 'La celda no existe' })
  @ApiBadRequestResponse({
    description: 'Nivel de criticidad inexistente o inactivo',
  })
  editarCelda(
    @Param('idImpacto', ParseIntPipe) idImpacto: number,
    @Param('idDificultad', ParseIntPipe) idDificultad: number,
    @Body() dto: EditarCeldaDto,
  ): Promise<CeldaMatrizDto> {
    return this.matriz.editarCelda(idImpacto, idDificultad, dto);
  }

  @Get('pares')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: ParCriticidadDto, isArray: true })
  listarPares(
    @Query() filtro: FiltroParesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<ParCriticidadDto[]> {
    return this.pares.pares(filtro, sesion);
  }

  @Get('avance')
  @Roles(...ROLES_LECTORES_DE_CRITICIDAD)
  @ApiOkResponse({ type: AvanceDto })
  avance(
    @Query() filtro: FiltroParesDto,
    @UsuarioActual() sesion: SesionUsuario,
  ): Promise<AvanceDto> {
    return this.pares.avance(filtro, sesion);
  }
}
