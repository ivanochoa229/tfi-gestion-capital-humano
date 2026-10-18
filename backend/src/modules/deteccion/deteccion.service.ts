import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { MESES_HORIZONTE_DEFECTO } from './deteccion.constantes.js';
import type {
  CatedraUnaPersonaDto,
  CatedrasUnaPersonaDto,
} from './dto/catedra-una-persona.dto.js';
import type { FiltroDeteccionDto } from './dto/filtro-deteccion.dto.js';
import type {
  FiltroHorizonteDto,
  HorizonteRespuestaDto,
  HorizonteRiesgoDto,
} from './dto/horizonte.dto.js';
import type {
  FiltroSinSucesorDto,
  PuestoSinSucesorDto,
} from './dto/puesto-sin-sucesor.dto.js';
import type {
  PuestoCriticoDto,
  PuntoUnicoFallaDto,
  PuntosUnicosFallaDto,
} from './dto/punto-unico-falla.dto.js';
import { SQL_CATEDRAS_UNA_PERSONA } from './catedras.sql.js';
import { SQL_HORIZONTE_RIESGO } from './horizonte.sql.js';
import { SQL_PUNTOS_UNICOS } from './puntos-unicos.sql.js';
import { SQL_PUESTOS_SIN_SUCESOR } from './sin-sucesor.sql.js';

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

interface FilaCatedraUnaPersona {
  id_unidad: number;
  denominacion: string;
  cantidad_personas: 0 | 1;
  cantidad_ocupaciones: number;
  id_persona: number | null;
  apellido: string | null;
  nombre: string | null;
  en_alcance: boolean;
}

interface FilaPuestoSinSucesor {
  id_puesto: number;
  codigo: string;
  denominacion: string;
  id_unidad: number;
  motivo: string;
  id_plan: number | null;
  candidatos_total: number;
  candidatos_validos: number;
}

interface FilaHorizonte {
  id_conocimiento: number;
  denominacion: string;
  nivel_requerido: string;
  cantidad_poseedores: number;
  id_persona: number;
  apellido: string;
  nombre: string;
  fecha_prevista_retiro: string;
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

  async catedrasUnaPersona(
    filtro: FiltroDeteccionDto,
    sesion: SesionUsuario,
  ): Promise<CatedrasUnaPersonaDto> {
    const unidades = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaCatedraUnaPersona[] = await this.dataSource.query(
      SQL_CATEDRAS_UNA_PERSONA,
      [unidades, filtro.idUnidad ?? null],
    );

    const unaPersona: CatedraUnaPersonaDto[] = [];
    const sinDotacion: CatedraUnaPersonaDto[] = [];

    for (const f of filas) {
      const item: CatedraUnaPersonaDto = {
        idUnidad: Number(f.id_unidad),
        denominacion: f.denominacion,
        cantidadPersonas: f.cantidad_personas,
        cantidadCargos: Number(f.cantidad_ocupaciones),
        persona:
          f.cantidad_personas === 1 && f.en_alcance && f.id_persona !== null
            ? {
                idPersona: Number(f.id_persona),
                apellido: f.apellido!,
                nombre: f.nombre!,
              }
            : null,
      };

      if (f.cantidad_personas === 1) {
        unaPersona.push(item);
      } else {
        sinDotacion.push(item);
      }
    }

    return { unaPersona, sinDotacion };
  }

  async puestosSinSucesor(
    filtro: FiltroSinSucesorDto,
    sesion: SesionUsuario,
  ): Promise<PuestoSinSucesorDto[]> {
    const unidades = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaPuestoSinSucesor[] = await this.dataSource.query(
      SQL_PUESTOS_SIN_SUCESOR,
      [unidades, filtro.idUnidad ?? null, filtro.motivo ?? null],
    );

    return filas.map((f) => ({
      idPuesto: Number(f.id_puesto),
      codigo: f.codigo,
      denominacion: f.denominacion,
      idUnidad: Number(f.id_unidad),
      motivo: f.motivo,
      idPlan: f.id_plan !== null ? Number(f.id_plan) : null,
      candidatosTotal: Number(f.candidatos_total),
      candidatosValidos: Number(f.candidatos_validos),
    }));
  }

  async horizonteRiesgo(
    filtro: FiltroHorizonteDto,
    sesion: SesionUsuario,
  ): Promise<HorizonteRespuestaDto> {
    const meses = filtro.meses ?? MESES_HORIZONTE_DEFECTO;
    const unidades = await this.alcance.unidadesVisibles(sesion);
    const filas: FilaHorizonte[] = await this.dataSource.query(
      SQL_HORIZONTE_RIESGO,
      [unidades, filtro.idUnidad ?? null, meses],
    );

    const mapa = new Map<
      number,
      { item: HorizonteRiesgoDto; primeraFecha: string }
    >();

    for (const f of filas) {
      const id = Number(f.id_conocimiento);
      let entrada = mapa.get(id);
      if (!entrada) {
        entrada = {
          primeraFecha: f.fecha_prevista_retiro,
          item: {
            idConocimiento: id,
            denominacion: f.denominacion,
            nivelRequerido: f.nivel_requerido,
            cantidadPoseedores: Number(f.cantidad_poseedores),
            quedan: Number(f.cantidad_poseedores),
            retiros: [],
            puestosCriticos: f.puestos_en_alcance ?? [],
            puestosFueraDeAlcance: Number(f.puestos_fuera_de_alcance),
          },
        };
        mapa.set(id, entrada);
      } else if (f.fecha_prevista_retiro < entrada.primeraFecha) {
        entrada.primeraFecha = f.fecha_prevista_retiro;
      }

      entrada.item.retiros.push(
        f.en_alcance
          ? {
              idPersona: Number(f.id_persona),
              apellido: f.apellido,
              nombre: f.nombre,
              fechaPrevistaRetiro: f.fecha_prevista_retiro,
            }
          : {
              idPersona: null,
              apellido: null,
              nombre: null,
              fechaPrevistaRetiro: null,
            },
      );
      entrada.item.quedan =
        entrada.item.cantidadPoseedores - entrada.item.retiros.length;
    }

    const todos = [...mapa.values()]
      .filter((e) => filtro.incluirConDosOMas || e.item.quedan <= 1)
      .sort((a, b) => {
        if (a.item.quedan !== b.item.quedan) {
          return a.item.quedan - b.item.quedan;
        }
        if (a.primeraFecha !== b.primeraFecha) {
          return a.primeraFecha.localeCompare(b.primeraFecha);
        }
        return a.item.denominacion.localeCompare(b.item.denominacion);
      })
      .map((e) => e.item);

    return { meses, conocimientos: todos };
  }
}
