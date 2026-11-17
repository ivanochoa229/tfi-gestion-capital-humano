import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';

/**
 * Quién acredita a quién según la jerarquía de puestos:
 *
 *   DEP (departamento)
 *   ├── JEF_A ── JTP_A ── AUX_A   (cátedra A)
 *   └── JEF_B ── AUX_B            (cátedra B)
 */
describe('Acreditar según la jerarquía de puestos (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let acceso: AccesoPerfilService;
  const p: Record<string, number> = {};

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const jefe = (idPersona: number): SesionUsuario => ({
    id: 1,
    nombreUsuario: 'jefe',
    rol: 'jefe_catedra',
    idPersona,
    // Las unidades del usuario ya no intervienen en la acreditación.
    unidades: [],
  });
  const puede = (evaluador: string, persona: string) =>
    acceso.esSuperior(p[evaluador], p[persona]);

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    acceso = new AccesoPerfilService(ds, new AlcanceService(ds));

    const departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    const catedra = async (nombre: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
           SELECT $1, id_tipo_unidad, $2 FROM tipo_unidad WHERE codigo = 'catedra' RETURNING id_unidad AS id`,
          [nombre, departamento],
        )
      )[0].id;
    const a = await catedra('Cátedra A');
    const b = await catedra('Cátedra B');
    const puesto = async (
      codigo: string,
      unidad: number,
      superior: number | null,
    ) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico, id_puesto_superior)
           SELECT $1, $1, $2, id_nivel_jerarquico, $3 FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
           RETURNING id_puesto AS id`,
          [codigo, unidad, superior],
        )
      )[0].id;
    const dep = await puesto('DEP', departamento, null);
    const jefA = await puesto('JEF_A', a, dep);
    const jtpA = await puesto('JTP_A', a, jefA);
    const auxA = await puesto('AUX_A', a, jtpA);
    const jefB = await puesto('JEF_B', b, dep);
    const auxB = await puesto('AUX_B', b, jefB);

    let n = 0;
    const persona = async (nombre: string) => {
      n += 1;
      p[nombre] = (
        await sql<{ id: number }[]>(
          `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
           SELECT $1, $2, 'Ana', $3, '1980-01-01', '2005-03-01', id_situacion_revista
           FROM situacion_revista WHERE codigo = 'planta_permanente' RETURNING id_persona AS id`,
          [`L-${n}`, nombre, `3000000${n}`],
        )
      )[0].id;
    };
    const ocupa = (nombre: string, idPuesto: number, hasta: number | null) =>
      sql(
        `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
         SELECT $1, $2, CURRENT_DATE - 100, CURRENT_DATE + $3::int,
                (SELECT min(id_caracter_ocupacion) FROM caracter_ocupacion), (SELECT min(id_dedicacion) FROM dedicacion)`,
        [p[nombre], idPuesto, hasta],
      );

    for (const nombre of [
      'directora',
      'jefeA',
      'jtpA',
      'auxA',
      'otroAuxA',
      'jefeB',
      'dosCargos',
      'exJtpA',
      'exJefeA',
    ]) {
      await persona(nombre);
    }
    await ocupa('directora', dep, null);
    await ocupa('jefeA', jefA, null);
    await ocupa('jtpA', jtpA, null);
    await ocupa('auxA', auxA, null);
    await ocupa('otroAuxA', auxA, null);
    await ocupa('jefeB', jefB, null);
    // Varios cargos: auxiliar en las dos cátedras, con un jefe en cada una.
    await ocupa('dosCargos', auxA, null);
    await ocupa('dosCargos', auxB, null);
    // Ocupaciones que vencieron ayer.
    await ocupa('exJtpA', jtpA, -1);
    await ocupa('exJefeA', jefA, -1);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('el superior inmediato acredita', async () => {
    expect(await puede('jefeA', 'jtpA')).toBe(true);
    expect(await puede('jtpA', 'auxA')).toBe(true);
  });

  it('la autoridad baja por toda la cadena', async () => {
    expect(await puede('jefeA', 'auxA')).toBe(true);
    expect(await puede('directora', 'auxA')).toBe(true);
    expect(await puede('directora', 'jefeB')).toBe(true);
  });

  it('nadie acredita hacia arriba ni a un par', async () => {
    expect(await puede('jtpA', 'jefeA')).toBe(false);
    expect(await puede('auxA', 'directora')).toBe(false);
    expect(await puede('auxA', 'otroAuxA')).toBe(false);
    expect(await puede('jefeA', 'jefeB')).toBe(false);
  });

  it('un jefe no acredita a quien depende de otra cátedra', async () => {
    expect(await puede('jefeB', 'auxA')).toBe(false);
    expect(await puede('jefeB', 'jtpA')).toBe(false);
  });

  it('con dos cargos, la persona tiene un jefe en cada cadena', async () => {
    expect(await puede('jefeA', 'dosCargos')).toBe(true);
    expect(await puede('jefeB', 'dosCargos')).toBe(true);
    expect(await puede('auxA', 'dosCargos')).toBe(false);
  });

  it('solo cuentan las ocupaciones vigentes, de los dos lados', async () => {
    expect(await puede('jefeA', 'exJtpA')).toBe(false);
    expect(await puede('exJefeA', 'jtpA')).toBe(false);
  });

  it('exigirEvaluacion aplica la regla con la persona de la sesión', async () => {
    await expect(
      acceso.exigirEvaluacion(jefe(p.jefeA), p.auxA),
    ).resolves.toBeUndefined();
    await expect(
      acceso.exigirEvaluacion(jefe(p.jtpA), p.jefeA),
    ).rejects.toThrow(/por debajo/);
    expect(await acceso.permisoDeAcreditar(jefe(p.jefeB), p.auxA)).toEqual({
      puedeAcreditar: false,
      motivo: expect.stringMatching(/por debajo/),
    });
  });
});
