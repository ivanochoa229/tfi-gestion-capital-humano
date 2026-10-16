import type { ActivoDto } from './dto/activos.dto.js';

/** Fila de `SQL_SELECT_ACTIVO`: lo que el servicio necesita, incluidos `ubicacion` y `hash`, que no salen en el DTO. */
export interface FilaActivo {
  id: number;
  titulo: string;
  idTipoDocumento: number;
  idUnidad: number;
  origen: 'archivo' | 'enlace';
  ubicacion: string;
  nombreOriginal: string | null;
  tipoMime: string | null;
  tamanio: number | null;
  hash: string | null;
  fechaVigencia: string | null;
  vencido: boolean;
  diasParaVencer: number | null;
  activo: boolean;
  idsConocimiento: number[];
  creadoEn: Date;
  actualizadoEn: Date;
}

/** `vencido` y `diasParaVencer` se calculan con la fecha de la base (RNF04). */
export const SQL_SELECT_ACTIVO = `
  SELECT a.id_activo AS id, a.titulo,
         a.id_tipo_documento AS "idTipoDocumento", a.id_unidad AS "idUnidad",
         a.origen, a.ubicacion, a.nombre_original AS "nombreOriginal",
         a.tipo_mime AS "tipoMime", a.tamanio, a.hash,
         a.fecha_vigencia::text AS "fechaVigencia",
         COALESCE(a.fecha_vigencia < CURRENT_DATE, false) AS vencido,
         (a.fecha_vigencia - CURRENT_DATE) AS "diasParaVencer",
         a.activo, a.creado_en AS "creadoEn", a.actualizado_en AS "actualizadoEn",
         COALESCE((SELECT array_agg(v.id_conocimiento ORDER BY v.id_conocimiento)
                   FROM activo_conocimiento_conocimiento v
                   WHERE v.id_activo = a.id_activo), '{}') AS "idsConocimiento"
  FROM activo_conocimiento a`;

export function aActivoDto(f: FilaActivo): ActivoDto {
  return {
    id: f.id,
    titulo: f.titulo,
    idTipoDocumento: f.idTipoDocumento,
    idUnidad: f.idUnidad,
    origen: f.origen,
    enlace: f.origen === 'enlace' ? f.ubicacion : null,
    nombreOriginal: f.nombreOriginal,
    tipoMime: f.tipoMime,
    tamanio: f.tamanio,
    fechaVigencia: f.fechaVigencia,
    vencido: f.vencido,
    diasParaVencer: f.diasParaVencer,
    activo: f.activo,
    idsConocimiento: f.idsConocimiento,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
  };
}
