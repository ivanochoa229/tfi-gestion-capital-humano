import type { Type } from '@nestjs/common';
import { NivelDominio } from './entities/nivel-dominio.entity.js';
import { NivelCriticidad } from './entities/nivel-criticidad.entity.js';
import { EstadoPreparacion } from './entities/estado-preparacion.entity.js';
import { TipoConocimiento } from './entities/tipo-conocimiento.entity.js';
import { TipoResponsabilidad } from './entities/tipo-responsabilidad.entity.js';
import { TipoRiesgo } from './entities/tipo-riesgo.entity.js';
import { CaracterOcupacion } from './entities/caracter-ocupacion.entity.js';
import { TipoAccionTransferencia } from './entities/tipo-accion-transferencia.entity.js';
import { EstadoAccionTransferencia } from './entities/estado-accion-transferencia.entity.js';
import { EstadoPlan } from './entities/estado-plan.entity.js';
import { TipoUnidad } from './entities/tipo-unidad.entity.js';
import { NivelJerarquico } from './entities/nivel-jerarquico.entity.js';
import { TipoRelacionContractual } from './entities/tipo-relacion-contractual.entity.js';
import { SituacionRevista } from './entities/situacion-revista.entity.js';
import { Dedicacion } from './entities/dedicacion.entity.js';
import { AreaTematica } from './entities/area-tematica.entity.js';
import { TipoEvidencia } from './entities/tipo-evidencia.entity.js';
import { TipoDocumento } from './entities/tipo-documento.entity.js';
import type { ValorReferencia } from './entities/valor-referencia.base.js';

export interface DefinicionDominio {
  /** Identificador en la URL de la API. */
  slug: string;
  denominacion: string;
  tabla: string;
  /** Los ordinales tienen `orden`; el resto se lista por denominación. */
  ordinal: boolean;
  entidad: Type<ValorReferencia>;
}

/** Los dieciocho dominios cerrados del modelo (RF23). */
export const DOMINIOS: readonly DefinicionDominio[] = [
  {
    slug: 'nivel-dominio',
    denominacion: 'Nivel de dominio',
    tabla: 'nivel_dominio',
    ordinal: true,
    entidad: NivelDominio,
  },
  {
    slug: 'nivel-criticidad',
    denominacion: 'Nivel de criticidad',
    tabla: 'nivel_criticidad',
    ordinal: true,
    entidad: NivelCriticidad,
  },
  {
    slug: 'estado-preparacion',
    denominacion: 'Estado de preparación',
    tabla: 'estado_preparacion',
    ordinal: true,
    entidad: EstadoPreparacion,
  },
  {
    slug: 'tipo-conocimiento',
    denominacion: 'Tipo de conocimiento',
    tabla: 'tipo_conocimiento',
    ordinal: false,
    entidad: TipoConocimiento,
  },
  {
    slug: 'tipo-responsabilidad',
    denominacion: 'Tipo de responsabilidad',
    tabla: 'tipo_responsabilidad',
    ordinal: false,
    entidad: TipoResponsabilidad,
  },
  {
    slug: 'tipo-riesgo',
    denominacion: 'Tipo de riesgo',
    tabla: 'tipo_riesgo',
    ordinal: false,
    entidad: TipoRiesgo,
  },
  {
    slug: 'caracter-ocupacion',
    denominacion: 'Carácter de ocupación',
    tabla: 'caracter_ocupacion',
    ordinal: false,
    entidad: CaracterOcupacion,
  },
  {
    slug: 'tipo-accion-transferencia',
    denominacion: 'Tipo de acción de transferencia',
    tabla: 'tipo_accion_transferencia',
    ordinal: false,
    entidad: TipoAccionTransferencia,
  },
  {
    slug: 'estado-accion-transferencia',
    denominacion: 'Estado de acción de transferencia',
    tabla: 'estado_accion_transferencia',
    ordinal: false,
    entidad: EstadoAccionTransferencia,
  },
  {
    slug: 'estado-plan',
    denominacion: 'Estado de plan',
    tabla: 'estado_plan',
    ordinal: false,
    entidad: EstadoPlan,
  },
  {
    slug: 'tipo-unidad',
    denominacion: 'Tipo de unidad',
    tabla: 'tipo_unidad',
    ordinal: false,
    entidad: TipoUnidad,
  },
  {
    slug: 'nivel-jerarquico',
    denominacion: 'Nivel jerárquico',
    tabla: 'nivel_jerarquico',
    ordinal: true,
    entidad: NivelJerarquico,
  },
  {
    slug: 'tipo-relacion-contractual',
    denominacion: 'Tipo de relación contractual',
    tabla: 'tipo_relacion_contractual',
    ordinal: false,
    entidad: TipoRelacionContractual,
  },
  {
    slug: 'situacion-revista',
    denominacion: 'Situación de revista',
    tabla: 'situacion_revista',
    ordinal: false,
    entidad: SituacionRevista,
  },
  {
    slug: 'dedicacion',
    denominacion: 'Dedicación',
    tabla: 'dedicacion',
    ordinal: true,
    entidad: Dedicacion,
  },
  {
    slug: 'area-tematica',
    denominacion: 'Área temática',
    tabla: 'area_tematica',
    ordinal: false,
    entidad: AreaTematica,
  },
  {
    slug: 'tipo-evidencia',
    denominacion: 'Tipo de evidencia',
    tabla: 'tipo_evidencia',
    ordinal: false,
    entidad: TipoEvidencia,
  },
  {
    slug: 'tipo-documento',
    denominacion: 'Tipo de documento',
    tabla: 'tipo_documento',
    ordinal: false,
    entidad: TipoDocumento,
  },
];

export function buscarDominio(slug: string): DefinicionDominio | undefined {
  return DOMINIOS.find((d) => d.slug === slug);
}
