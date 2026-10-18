import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import {
  ROLES_GLOBALES_DE_DETECCION,
  ROLES_LECTORES_DE_DETECCION,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { aCsv } from './csv-salida.js';
import { DeteccionService } from './deteccion.service.js';
import { FiltroDeteccionDto } from './dto/filtro-deteccion.dto.js';
import { PuntosUnicosFallaDto } from './dto/punto-unico-falla.dto.js';

@ApiTags('deteccion')
@Controller('deteccion')
export class DeteccionController {
  constructor(private readonly servicio: DeteccionService) {}

  private exigirGlobalParaCsv(sesion: SesionUsuario): void {
    if (!ROLES_GLOBALES_DE_DETECCION.includes(sesion.rol)) {
      throw new ForbiddenException(
        'Solo los roles con alcance global pueden exportar a CSV',
      );
    }
  }

  private enviarCsv(
    res: Response,
    nombreArchivo: string,
    contenido: string,
  ): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreArchivo}"`,
    );
    res.send(contenido);
  }

  @Get('puntos-unicos-falla')
  @Roles(...ROLES_LECTORES_DE_DETECCION)
  @ApiOkResponse({ type: PuntosUnicosFallaDto })
  async puntosUnicosFalla(
    @Query() filtro: FiltroDeteccionDto,
    @UsuarioActual() sesion: SesionUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PuntosUnicosFallaDto | void> {
    if (filtro.formato === 'csv') {
      this.exigirGlobalParaCsv(sesion);
    }

    const datos = await this.servicio.puntosUnicosFalla(filtro, sesion);

    if (filtro.formato === 'csv') {
      const filas = [
        ...datos.unicoPoseedor.map((f) => ({
          categoria: 'unico_poseedor',
          denominacion: f.denominacion,
          nivelRequerido: f.nivelRequerido,
          cantidadPoseedores: f.cantidadPoseedores,
          poseedor: f.poseedor
            ? `${f.poseedor.apellido}, ${f.poseedor.nombre}`
            : '',
          puestosCriticos: f.puestosCriticos
            .map((p) => p.denominacion)
            .join(', '),
        })),
        ...datos.sinPoseedor.map((f) => ({
          categoria: 'sin_poseedor',
          denominacion: f.denominacion,
          nivelRequerido: f.nivelRequerido,
          cantidadPoseedores: f.cantidadPoseedores,
          poseedor: '',
          puestosCriticos: f.puestosCriticos
            .map((p) => p.denominacion)
            .join(', '),
        })),
      ];

      const csv = aCsv(
        [
          { clave: 'categoria', titulo: 'Categoría' },
          { clave: 'denominacion', titulo: 'Conocimiento' },
          { clave: 'nivelRequerido', titulo: 'Nivel requerido' },
          { clave: 'cantidadPoseedores', titulo: 'Cantidad de poseedores' },
          { clave: 'poseedor', titulo: 'Poseedor' },
          { clave: 'puestosCriticos', titulo: 'Puestos críticos' },
        ],
        filas,
      );

      this.enviarCsv(res, 'puntos-unicos-falla.csv', csv);
      return;
    }

    return datos;
  }
}
