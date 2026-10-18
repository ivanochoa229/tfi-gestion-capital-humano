import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';

export interface DatosDeteccion {
  persona: Record<
    'Ana' | 'Beto' | 'Carla' | 'Diego' | 'Eva' | 'Fede' | 'Gus' | 'Hugo',
    number
  >;
  catedra: Record<'C1' | 'C2' | 'C3' | 'C4' | 'C5', number>;
  puesto: Record<
    | 'C1.jefe'
    | 'C1.JTP'
    | 'C2.jefe'
    | 'C2.aux'
    | 'C3.jefe'
    | 'C4.jefe'
    | 'C4.aux',
    number
  >;
  conocimiento: Record<
    'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8',
    number
  >;
  plan: Record<'C2.jefe' | 'C3.jefe' | 'C4.jefe' | 'C4.aux', number>;
}

const NOMBRES_A_LEGAJOS: Record<keyof DatosDeteccion['persona'], string> = {
  Ana: 'DET-ANA',
  Beto: 'DET-BETO',
  Carla: 'DET-CARLA',
  Diego: 'DET-DIEGO',
  Eva: 'DET-EVA',
  Fede: 'DET-FEDE',
  Gus: 'DET-GUS',
  Hugo: 'DET-HUGO',
};

const CLAVES_A_CATEDRAS: Record<keyof DatosDeteccion['catedra'], string> = {
  C1: 'Cátedra 1',
  C2: 'Cátedra 2',
  C3: 'Cátedra 3',
  C4: 'Cátedra 4',
  C5: 'Cátedra 5',
};

const CLAVES_A_CONOCIMIENTOS: Record<
  keyof DatosDeteccion['conocimiento'],
  string
> = {
  K1: 'Conocimiento K1',
  K2: 'Conocimiento K2',
  K3: 'Conocimiento K3',
  K4: 'Conocimiento K4',
  K5: 'Conocimiento K5',
  K6: 'Conocimiento K6',
  K7: 'Conocimiento K7',
  K8: 'Conocimiento K8',
};

export async function cargarDatosDeDeteccion(
  ds: DataSource,
): Promise<DatosDeteccion> {
  const rutaScript = join(
    import.meta.dirname,
    '../../scripts/datos-prueba-deteccion.sql',
  );
  const sql = readFileSync(rutaScript, 'utf-8');
  await ds.query(sql);

  const personasFilas = await ds.query(
    `SELECT legajo, id_persona FROM persona WHERE legajo LIKE 'DET-%'`,
  );
  const legajoAId = Object.fromEntries(
    personasFilas.map((f: { legajo: string; id_persona: number }) => [
      f.legajo,
      f.id_persona,
    ]),
  );
  const persona = Object.fromEntries(
    Object.entries(NOMBRES_A_LEGAJOS).map(([nombre, legajo]) => [
      nombre,
      legajoAId[legajo],
    ]),
  ) as DatosDeteccion['persona'];

  const catedrasFilas = await ds.query(
    `SELECT denominacion, id_unidad FROM unidad_organizativa WHERE denominacion LIKE 'Cátedra%'`,
  );
  const denominacionAUnidadId = Object.fromEntries(
    catedrasFilas.map((f: { denominacion: string; id_unidad: number }) => [
      f.denominacion,
      f.id_unidad,
    ]),
  );
  const catedra = Object.fromEntries(
    Object.entries(CLAVES_A_CATEDRAS).map(([clave, denom]) => [
      clave,
      denominacionAUnidadId[denom],
    ]),
  ) as DatosDeteccion['catedra'];

  const puestosFilas = await ds.query(
    `SELECT denominacion, id_puesto FROM puesto WHERE codigo LIKE 'P-C%'`,
  );
  const denominacionAPuestoId = Object.fromEntries(
    puestosFilas.map((f: { denominacion: string; id_puesto: number }) => [
      f.denominacion,
      f.id_puesto,
    ]),
  );
  const puesto = denominacionAPuestoId as DatosDeteccion['puesto'];

  const conocimientosFilas = await ds.query(
    `SELECT denominacion, id_conocimiento FROM conocimiento WHERE denominacion LIKE 'Conocimiento K%'`,
  );
  const denominacionAConocimientoId = Object.fromEntries(
    conocimientosFilas.map(
      (f: { denominacion: string; id_conocimiento: number }) => [
        f.denominacion,
        f.id_conocimiento,
      ],
    ),
  );
  const conocimiento = Object.fromEntries(
    Object.entries(CLAVES_A_CONOCIMIENTOS).map(([clave, denom]) => [
      clave,
      denominacionAConocimientoId[denom],
    ]),
  ) as DatosDeteccion['conocimiento'];

  const planesFilas = await ds.query(
    `SELECT pl.id_plan, pu.denominacion AS puesto
     FROM plan_sucesion pl
     JOIN puesto pu ON pu.id_puesto = pl.id_puesto
     WHERE pu.codigo LIKE 'P-C%'`,
  );
  const plan = Object.fromEntries(
    planesFilas.map((f: { puesto: string; id_plan: number }) => [
      f.puesto,
      f.id_plan,
    ]),
  ) as DatosDeteccion['plan'];

  return {
    persona,
    catedra,
    puesto,
    conocimiento,
    plan,
  };
}
