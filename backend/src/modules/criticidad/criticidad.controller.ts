import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, ROLES_LECTORES_DE_MATRIZ } from '../../common/roles.js';
import { CeldaMatrizDto, EditarCeldaDto, MatrizDto } from './dto/matriz.dto.js';
import { MatrizService } from './matriz.service.js';

/** Criticidad del conocimiento por puesto (RF12): escalas, matriz, pares y avance. */
@ApiTags('criticidad')
@Controller('criticidad')
export class CriticidadController {
  constructor(private readonly matriz: MatrizService) {}

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
}
