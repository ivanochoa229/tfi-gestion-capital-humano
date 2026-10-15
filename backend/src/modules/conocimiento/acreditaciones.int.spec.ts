import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { ConocimientosService } from './conocimientos.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';

describe('Acreditaciones (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let acreditaciones: AcreditacionesService;
  let catalogo: ConocimientosService;
  let persona: number;
  let evaluador: number;
  let a: number;
  let b: number;
  let basico: number;
  let avanzado: number;
  let evidencia: number;
  let jefe: SesionUsuario;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [delta])
    )[0].f;
  const nuevaPersona = async (legajo: string, documento: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente' RETURNING id_persona AS id`,
        [legajo, documento],
      )
    )[0].id;
  const nuevoConocimiento = async (denominacion: string, normalizada: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT $1, $2, t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
         FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
        [denominacion, normalizada],
      )
    )[0].id;
  const dto = (idNivel: number, fechaEvaluacion: string) => ({
    idNivel,
    fechaEvaluacion,
    idTipoEvidencia: evidencia,
  });
  const reflejo = async (conocimiento: number) =>
    (
      await sql<{ n: number | null; f: string | null; d: number | null }[]>(
        `SELECT id_nivel_acreditado AS n, fecha_evaluacion::text AS f, id_nivel_declarado AS d
         FROM conocimiento_persona WHERE id_persona = $1 AND id_conocimiento = $2`,
        [persona, conocimiento],
      )
    )[0];

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const referencia = {
      validarActivo: async () => undefined,
    } as unknown as ReferenciaService;
    const acceso = {
      exigirEvaluacion: async () => undefined,
    } as unknown as AccesoPerfilService;
    acreditaciones = new AcreditacionesService(
      ds.getRepository(Acreditacion),
      referencia,
      acceso,
    );
    catalogo = new ConocimientosService(ds.getRepository(Conocimiento), referencia);
    persona = await nuevaPersona('L-1', '30111111');
    evaluador = await nuevaPersona('L-2', '30222222');
    jefe = {
      id: 1,
      nombreUsuario: 'jefe',
      rol: 'jefe_catedra',
      idPersona: evaluador,
      unidades: [],
    };
    basico = (await sql<{ id: number }[]>(`SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'basico'`))[0].id;
    avanzado = (await sql<{ id: number }[]>(`SELECT id_nivel_dominio AS id FROM nivel_dominio WHERE codigo = 'avanzado'`))[0].id;
    evidencia = (await sql<{ id: number }[]>(`SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`))[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  beforeEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
    await sql('DELETE FROM conocimiento');
    a = await nuevoConocimiento('Python 3', 'python 3');
    b = await nuevoConocimiento('Python', 'python');
  });

  it('acreditar a alguien que nunca declaró crea su fila con la acreditación', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-3)), jefe);
    expect(await reflejo(a)).toEqual({ n: basico, f: await dia(-3), d: null });
  });

  it('una acreditación más reciente reemplaza el reflejo y conserva lo declarado', async () => {
    await sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion) VALUES ($1, $2, $3, $4)`,
      [persona, a, avanzado, await dia(-20)],
    );
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-10)), jefe);
    await acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-2)), jefe);
    expect(await reflejo(a)).toEqual({ n: avanzado, f: await dia(-2), d: avanzado });
  });

  it('una acreditación anterior a la vigente queda en el historial y no cambia el reflejo', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-2)), jefe);
    await acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-30)), jefe);
    expect(await reflejo(a)).toEqual({ n: basico, f: await dia(-2), d: null });
    expect(await sql('SELECT 1 FROM acreditacion')).toHaveLength(2);
  });

  it('la fecha de hoy se acepta y la de mañana se rechaza', async () => {
    await expect(
      acreditaciones.acreditar(persona, a, dto(basico, await dia(0)), jefe),
    ).resolves.toBeDefined();
    await expect(
      acreditaciones.acreditar(persona, a, dto(basico, await dia(1)), jefe),
    ).rejects.toThrow(/futura/);
  });

  it('una fusión y una acreditación simultáneas no dejan datos en el conocimiento retirado', async () => {
    await acreditaciones.acreditar(persona, a, dto(basico, await dia(-9)), jefe);

    const resultados = await Promise.allSettled([
      catalogo.fusionar(a, { idDestino: b }),
      acreditaciones.acreditar(persona, a, dto(avanzado, await dia(-1)), jefe),
    ]);

    // Si la acreditación llegó después de la fusión, el origen ya estaba inactivo: 400.
    expect(resultados[0].status).toBe('fulfilled');
    expect(
      await sql(`SELECT 1 FROM conocimiento_persona WHERE id_conocimiento = $1`, [a]),
    ).toHaveLength(0);
    expect(
      await sql(`SELECT 1 FROM acreditacion WHERE id_conocimiento = $1`, [a]),
    ).toHaveLength(0);
    const enDestino = await sql<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM acreditacion WHERE id_conocimiento = $1`,
      [b],
    );
    expect(enDestino[0].n).toBe(resultados[1].status === 'fulfilled' ? 2 : 1);
  });
});
