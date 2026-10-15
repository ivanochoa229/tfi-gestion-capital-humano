import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/** Fecha sin hora, `AAAA-MM-DD`; así devuelve TypeORM las columnas `date`. */
export type FechaISO = string;

export type EstadoOcupacion = 'vigente' | 'futura' | 'pasada';

export interface Vigencia {
  fechaDesde: FechaISO;
  fechaHasta: FechaISO | null;
}

/** Fin de una ocupación sin `fechaHasta`, para comparar como cadenas. */
const SIN_FIN = '9999-12-31';

/** Una fecha `AAAA-MM-DD` que existe en el calendario. */
export function esFechaValida(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [
    Number(partes[1]),
    Number(partes[2]),
    Number(partes[3]),
  ];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** "Hoy" es el de la base, el mismo que usarán las vistas de detección. */
export async function hoyDeLaBase(
  manager: Pick<EntityManager, 'query'>,
): Promise<FechaISO> {
  const [fila] = await manager.query<{ hoy: string }[]>(
    'SELECT CURRENT_DATE::text AS hoy',
  );
  return fila.hoy;
}

export function estadoDe(ocupacion: Vigencia, hoy: FechaISO): EstadoOcupacion {
  if (ocupacion.fechaHasta !== null && ocupacion.fechaHasta < hoy)
    return 'pasada';
  if (ocupacion.fechaDesde > hoy) return 'futura';
  return 'vigente';
}

/** Vigente o futura: la que todavía puede cambiar y bloquea las bajas. */
export function estaAbierta(ocupacion: Vigencia, hoy: FechaISO): boolean {
  return estadoDe(ocupacion, hoy) !== 'pasada';
}

/** Comparten al menos un día (rangos cerrados; sin fin = abierto). */
export function seSolapan(a: Vigencia, b: Vigencia): boolean {
  return (
    a.fechaDesde <= (b.fechaHasta ?? SIN_FIN) &&
    b.fechaDesde <= (a.fechaHasta ?? SIN_FIN)
  );
}

export function validarRango(desde: FechaISO, hasta: FechaISO | null): void {
  if (hasta !== null && hasta < desde) {
    throw new BadRequestException(
      'La fecha de fin no puede ser anterior a la fecha de inicio',
    );
  }
}

export function validarFechasDePersona(
  nacimiento: FechaISO,
  ingreso: FechaISO,
  retiro: FechaISO | null,
): void {
  if (ingreso <= nacimiento) {
    throw new BadRequestException(
      'La fecha de ingreso debe ser posterior al nacimiento',
    );
  }
  if (retiro !== null && retiro < ingreso) {
    throw new BadRequestException(
      'La fecha prevista de retiro no puede ser anterior al ingreso',
    );
  }
}
