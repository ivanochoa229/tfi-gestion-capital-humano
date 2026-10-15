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
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES, ROLES_SIN_DOCENTE } from '../../common/roles.js';
import {
  CopiarRequisitosDto,
  GuardarRequisitoDto,
  RequisitoDto,
  ResultadoCopiaDto,
} from './dto/requisitos.dto.js';
import { RequisitosService } from './requisitos.service.js';

/** Requisitos de conocimiento de cada puesto (RF09). */
@ApiTags('conocimiento')
@Controller('puestos/:idPuesto/requisitos')
export class RequisitosController {
  constructor(private readonly servicio: RequisitosService) {}

  @Get()
  @Roles(...ROLES_SIN_DOCENTE)
  @ApiOkResponse({ type: RequisitoDto, isArray: true })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  listar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
  ): Promise<RequisitoDto[]> {
    return this.servicio.listar(idPuesto);
  }

  @Put(':idConocimiento')
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: RequisitoDto })
  @ApiNotFoundResponse({ description: 'El puesto no existe' })
  @ApiBadRequestResponse({
    description: 'Puesto de baja, conocimiento inactivo o nivel inválido',
  })
  guardar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
    @Body() dto: GuardarRequisitoDto,
  ): Promise<RequisitoDto> {
    return this.servicio.guardar(idPuesto, idConocimiento, dto);
  }

  @Delete(':idConocimiento')
  @HttpCode(204)
  @Roles(ROLES.analistaPuestos)
  @ApiNoContentResponse({ description: 'Requisito quitado' })
  @ApiNotFoundResponse({ description: 'El puesto no tiene ese requisito' })
  quitar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Param('idConocimiento', ParseIntPipe) idConocimiento: number,
  ): Promise<void> {
    return this.servicio.quitar(idPuesto, idConocimiento);
  }

  @Post('copiar')
  @HttpCode(200)
  @Roles(ROLES.analistaPuestos)
  @ApiOkResponse({ type: ResultadoCopiaDto })
  @ApiNotFoundResponse({
    description: 'Puesto de origen o de destino inexistente',
  })
  @ApiBadRequestResponse({ description: 'Mismo puesto o destino de baja' })
  copiar(
    @Param('idPuesto', ParseIntPipe) idPuesto: number,
    @Body() dto: CopiarRequisitosDto,
  ): Promise<ResultadoCopiaDto> {
    return this.servicio.copiar(idPuesto, dto);
  }
}
