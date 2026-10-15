import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { ROLES } from '../../../common/roles.js';
import { ImportarPersonasDto } from './dto/importar-personas.dto.js';
import { ResultadoImportacionDto } from './dto/resultado-importacion.dto.js';
import { ImportacionService } from './importacion.service.js';
import { PLANTILLA_CSV } from './plantilla.js';
import { MAX_BYTES } from './tipos.js';

/** Importación masiva de personas y ocupaciones desde un CSV (OE4). */
@ApiTags('personas')
@Controller('personas/importacion')
export class ImportacionController {
  constructor(private readonly servicio: ImportacionService) {}

  @Post()
  @HttpCode(200)
  @Roles(ROLES.recursosHumanos)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
        confirmar: { type: 'boolean', default: false },
      },
    },
  })
  @ApiOkResponse({
    type: ResultadoImportacionDto,
    description:
      'Reporte de la vista previa o de la importación; los errores de datos van en `errores`',
  })
  @ApiBadRequestResponse({
    description:
      'Falta el archivo, está vacío, la cabecera es inválida o hay más de 2000 filas',
  })
  @ApiPayloadTooLargeResponse({ description: 'El archivo supera los 2 MB' })
  importar(
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body() dto: ImportarPersonasDto,
  ): Promise<ResultadoImportacionDto> {
    if (!archivo) throw new BadRequestException('Falta el archivo CSV');
    return this.servicio.importar(archivo.buffer, dto.confirmar ?? false);
  }

  @Get('plantilla')
  @Roles(ROLES.recursosHumanos)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="plantilla-personas.csv"',
  )
  @ApiOkResponse({ description: 'CSV con la cabecera y una fila de ejemplo' })
  plantilla(): string {
    return PLANTILLA_CSV;
  }
}
