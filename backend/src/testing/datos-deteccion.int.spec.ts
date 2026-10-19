import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { crearBaseTemporal, type BaseTemporal } from './base-temporal.js';
import {
  cargarDatosDeDeteccion,
  type DatosDeteccion,
} from './datos-deteccion.js';

describe('cargarDatosDeDeteccion (integración)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let datos: DatosDeteccion;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    datos = await cargarDatosDeDeteccion(ds);
  }, 60000);

  afterAll(async () => {
    await base?.destruir();
  });

  it('devuelve los identificadores esperados de personas, cátedras, puestos, conocimientos y planes', () => {
    expect(Object.keys(datos.persona).sort()).toEqual([
      'Ana',
      'Beto',
      'Carla',
      'Diego',
      'Eva',
      'Fede',
      'Gus',
      'Hugo',
    ]);
    expect(Object.keys(datos.catedra).sort()).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
    ]);
    expect(Object.keys(datos.puesto).sort()).toEqual([
      'C1.JTP',
      'C1.jefe',
      'C2.aux',
      'C2.jefe',
      'C3.jefe',
      'C4.aux',
      'C4.jefe',
    ]);
    expect(Object.keys(datos.conocimiento).sort()).toEqual([
      'K1',
      'K2',
      'K3',
      'K4',
      'K5',
      'K6',
      'K7',
      'K8',
    ]);
    expect(Object.keys(datos.plan).sort()).toEqual([
      'C2.jefe',
      'C3.jefe',
      'C4.aux',
      'C4.jefe',
    ]);
  });

  it('crea las 8 personas con las fechas de retiro y estado de actividad correctos', async () => {
    const personas = await ds.query(
      `SELECT legajo, activo, fecha_prevista_retiro::text AS retiro FROM persona WHERE legajo LIKE 'DET-%' ORDER BY legajo`,
    );
    expect(personas).toHaveLength(8);

    const porLegajo = Object.fromEntries(
      personas.map(
        (p: { legajo: string; activo: boolean; retiro: string | null }) => [
          p.legajo,
          p,
        ],
      ),
    );

    expect(porLegajo['DET-HUGO'].activo).toBe(false);
    expect(porLegajo['DET-ANA'].activo).toBe(true);
    expect(porLegajo['DET-ANA'].retiro).toBeNull();

    // Beto a 10 meses
    const betoRetiro = new Date(porLegajo['DET-BETO'].retiro!);
    const hoy = new Date();
    const difMesesBeto =
      (betoRetiro.getFullYear() - hoy.getFullYear()) * 12 +
      (betoRetiro.getMonth() - hoy.getMonth());
    expect(difMesesBeto).toBeGreaterThanOrEqual(9);
    expect(difMesesBeto).toBeLessThanOrEqual(11);

    // Gus ayer (retiro cumplido)
    expect(new Date(porLegajo['DET-GUS'].retiro!).getTime()).toBeLessThan(
      new Date().getTime(),
    );
  });

  it('crea 5 cátedras activas más una inactiva', async () => {
    const catedras = await ds.query(
      `SELECT denominacion, activo FROM unidad_organizativa WHERE denominacion LIKE 'Cátedra%' ORDER BY denominacion`,
    );
    expect(catedras).toHaveLength(6);
    const inactivas = catedras.filter((c: { activo: boolean }) => !c.activo);
    expect(inactivas).toHaveLength(1);
  });

  it('crea las ocupaciones vigentes y la ocupación cerrada de Fede', async () => {
    const ocupaciones = await ds.query(`
      SELECT p.legajo, o.fecha_hasta::text AS fecha_hasta,
             (o.fecha_desde <= CURRENT_DATE AND (o.fecha_hasta IS NULL OR o.fecha_hasta >= CURRENT_DATE)) AS vigente
      FROM ocupacion o
      JOIN persona p ON p.id_persona = o.id_persona
      WHERE p.legajo LIKE 'DET-%'
    `);

    const vigentesPorLegajo = ocupaciones
      .filter((o: { vigente: boolean }) => o.vigente)
      .map((o: { legajo: string }) => o.legajo);

    // Ana tiene dos ocupaciones vigentes en C1
    expect(
      vigentesPorLegajo.filter((l: string) => l === 'DET-ANA'),
    ).toHaveLength(2);
    expect(vigentesPorLegajo).toContain('DET-BETO');
    expect(vigentesPorLegajo).toContain('DET-CARLA');
    expect(vigentesPorLegajo).toContain('DET-DIEGO');
    expect(vigentesPorLegajo).toContain('DET-EVA');
    expect(vigentesPorLegajo).toContain('DET-GUS');
    expect(vigentesPorLegajo).not.toContain('DET-FEDE');

    // Fede cerrada hace un mes
    const fede = ocupaciones.find(
      (o: { legajo: string }) => o.legajo === 'DET-FEDE',
    );
    expect(fede).toBeDefined();
    expect(new Date(fede.fecha_hasta).getTime()).toBeLessThan(
      new Date().getTime(),
    );
  });

  it('crea los planes de sucesión en los estados de la spec', async () => {
    const planes = await ds.query(`
      SELECT pu.denominacion AS puesto, e.codigo AS estado, count(c.id_persona)::int AS candidatos
      FROM plan_sucesion pl
      JOIN puesto pu ON pu.id_puesto = pl.id_puesto
      JOIN estado_plan e ON e.id_estado_plan = pl.id_estado_plan
      LEFT JOIN candidato_sucesion c ON c.id_plan = pl.id_plan
      GROUP BY pl.id_plan, pu.denominacion, e.codigo
      ORDER BY pu.denominacion
    `);

    const porPuesto = Object.fromEntries(
      planes.map(
        (p: { puesto: string; estado: string; candidatos: number }) => [
          p.puesto,
          p,
        ],
      ),
    );

    expect(porPuesto['C2.jefe'].estado).toBe('aprobado');
    expect(porPuesto['C2.jefe'].candidatos).toBe(2);

    expect(porPuesto['C3.jefe'].estado).toBe('aprobado');
    expect(porPuesto['C3.jefe'].candidatos).toBe(1);

    expect(porPuesto['C4.jefe'].estado).toBe('aprobado');
    expect(porPuesto['C4.jefe'].candidatos).toBe(1);

    expect(porPuesto['C4.aux'].estado).toBe('borrador');
    expect(porPuesto['C4.aux'].candidatos).toBe(1);
  });

  it('guarda los niveles acreditados y declarados esperados en conocimiento_persona', async () => {
    const filas = await ds.query(`
      SELECT p.legajo, k.denominacion AS conocimiento,
             nd.orden AS orden_acreditado,
             cp.id_nivel_declarado IS NOT NULL AS tiene_declarado
      FROM conocimiento_persona cp
      JOIN persona p ON p.id_persona = cp.id_persona
      JOIN conocimiento k ON k.id_conocimiento = cp.id_conocimiento
      LEFT JOIN nivel_dominio nd ON nd.id_nivel_dominio = cp.id_nivel_acreditado
      WHERE p.legajo LIKE 'DET-%'
    `);

    // K4: nadie acredita, Fede declaró
    const k4Filas = filas.filter(
      (f: { conocimiento: string }) => f.conocimiento === 'Conocimiento K4',
    );
    expect(
      k4Filas.filter(
        (f: { orden_acreditado: number | null }) => f.orden_acreditado !== null,
      ),
    ).toHaveLength(0);
    const fedeK4 = k4Filas.find(
      (f: { legajo: string }) => f.legajo === 'DET-FEDE',
    );
    expect(fedeK4?.tiene_declarado).toBe(true);

    // K2: solo Ana acreditada en N3
    const k2Filas = filas.filter(
      (f: { conocimiento: string }) => f.conocimiento === 'Conocimiento K2',
    );
    expect(k2Filas).toHaveLength(1);
    expect(k2Filas[0].legajo).toBe('DET-ANA');
    expect(k2Filas[0].orden_acreditado).toBe(3);
  });
});
