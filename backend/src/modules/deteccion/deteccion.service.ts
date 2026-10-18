import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type { FiltroDeteccionDto } from './dto/filtro-deteccion.dto.js';
import type {
  PuestoCriticoDto,
  PuntoUnicoFallaDto,
  PuntosUnicosFallaDto,
} from './dto/punto-unico-falla.dto.js';
import { SQL_PUNTOS_UNICOS } from './puntos-unicos.sql.js';

interface FilaPuntoUnico {
  id_conocimiento: number;
  denominacion: string;
  nivel_requerido: string;
  cantidad_poseedores: 0 | 1;
  id_persona: number | null;
  apellido: string | null;
  nombre: string | null;
  en_alcance: boolean;
  puestos_en_alcance: PuestoCriticoDto[];
  puestos_fuera_de_alcance: number;
}

@Injectable()
export class DeteccionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly alcance: AlcanceService,
  ) {}

  async puntosUnicosFalla(
    filtro: FiltroDeteccionDto,
    sesion: SesionUsuario,
  ): Promise<PuntosUnicosFallaDto> {
    const unidades = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaPuntoUnico[] = await this.dataSource.query(
      SQL_PUNTOS_UNICOS,
      [unidades, filtro.idUnidad ?? null],
    );

    const unicoPoseedor: PuntoUnicoFallaDto[] = [];
    const sinPoseedor: PuntoUnicoFallaDto[] = [];

    for (const f of filas) {
      const item: PuntoUnicoFallaDto = {
        idConocimiento: Number(f.id_conocimiento),
        denominacion: f.denominacion,
        nivelRequerido: f.nivel_requerido,
        cantidadPoseedores: f.cantidad_poseedores,
        poseedor:
          f.cantidad_poseedores === 1 && f.en_alcance && f.id_persona !== null
            ? {
                idPersona: Number(f.id_persona),
                apellido: f.apellido!,
                nombre: f.nombre!,
              }
            : null,
        puestosCriticos: f.puestos_en_alcance ?? [],
        puestosFueraDeAlcance: Number(f.puestos_fuera_de_alcance),
      };

      if (f.cantidad_poseedores === 1) {
        unicoPoseedor.push(item);
      } else {
        sinPoseedor.push(item);
      }
    }

    return { unicoPoseedor, sinPoseedor };
  }
}
