import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import { ConocimientosService } from './conocimientos.service.js';
import { Conocimiento } from './entities/conocimiento.entity.js';

describe('Fusión de conocimientos (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ConocimientosService;
  let niveles: Record<string, number>;
  let evidencia: number;
  let tipo: number;
  let area: number;
  let puestoX: number;
  let puestoY: number;
  let usuarioRrhh: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;

  const nuevaPersona = async (n: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, 'Pérez', 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
        [`L-${n}`, `3000000${n}`],
      )
    )[0].id;
  const nuevoConocimiento = async (denominacion: string, normalizada: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         VALUES ($1, $2, $3, $4) RETURNING id_conocimiento AS id`,
        [denominacion, normalizada, tipo, area],
      )
    )[0].id;
  const nuevoPuesto = async (codigo: string) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $1, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
                id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
         RETURNING id_puesto AS id`,
        [codigo],
      )
    )[0].id;
  const requisito = (
    puesto: number,
    conocimiento: number,
    nivel: string,
    excluyente: boolean,
  ) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, $4)`,
      [puesto, conocimiento, niveles[nivel], excluyente],
    );
  /** Fila de conocimiento_persona; `acreditado` = [nivel, fecha, evaluador]. */
  const fila = (
    persona: number,
    conocimiento: number,
    declarado: [string, string] | null,
    acreditado: [string, string, number] | null,
  ) =>
    sql(
      `INSERT INTO conocimiento_persona
         (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
          id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        persona,
        conocimiento,
        declarado ? niveles[declarado[0]] : null,
        declarado ? declarado[1] : null,
        acreditado ? niveles[acreditado[0]] : null,
        acreditado ? acreditado[1] : null,
        acreditado ? evidencia : null,
        acreditado ? acreditado[2] : null,
      ],
    );
  const acreditacion = (
    persona: number,
    conocimiento: number,
    nivel: string,
    fecha: string,
    evaluador: number,
  ) =>
    sql(
      `INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia, fecha_evaluacion, id_evaluador)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [persona, conocimiento, niveles[nivel], evidencia, fecha, evaluador],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    servicio = new ConocimientosService(ds.getRepository(Conocimiento), {
      validarActivo: async () => undefined,
    } as unknown as ReferenciaService);
    niveles = Object.fromEntries(
      (
        await sql<{ codigo: string; id: number }[]>(
          `SELECT codigo, id_nivel_dominio AS id FROM nivel_dominio`,
        )
      ).map((n) => [n.codigo, n.id]),
    );
    evidencia = (
      await sql<{ id: number }[]>(
        `SELECT id_tipo_evidencia AS id FROM tipo_evidencia WHERE codigo = 'titulo'`,
      )
    )[0].id;
    tipo = (
      await sql<{ id: number }[]>(
        `SELECT id_tipo_conocimiento AS id FROM tipo_conocimiento WHERE codigo = 'competencia_tecnica'`,
      )
    )[0].id;
    area = (
      await sql<{ id: number }[]>(
        `SELECT id_area_tematica AS id FROM area_tematica ORDER BY id_area_tematica LIMIT 1`,
      )
    )[0].id;
    puestoX = await nuevoPuesto('P-0001');
    puestoY = await nuevoPuesto('P-0002');
    usuarioRrhh = (
      await sql<{ id: number }[]>(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT 'rrhh-fusion', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('une requisitos, declaraciones y acreditaciones y retira el origen', async () => {
    const a = await nuevoConocimiento('Python 3', 'python 3'); // origen
    const b = await nuevoConocimiento('Python', 'python'); // destino
    const p1 = await nuevaPersona(1);
    const p2 = await nuevaPersona(2);
    const p3 = await nuevaPersona(3);
    const ev = await nuevaPersona(4);

    // El puesto X pedía ambos (origen más exigente y excluyente); el Y solo el origen.
    await requisito(puestoX, a, 'experto', true);
    await requisito(puestoX, b, 'avanzado', false);
    await requisito(puestoY, a, 'intermedio', false);

    // p1 solo tenía el origen; p2 ambos; p3 tenía ambos, acreditados.
    await fila(p1, a, ['basico', '2026-01-10'], null);
    await fila(p2, a, ['experto', '2026-01-11'], null);
    await fila(p2, b, ['basico', '2026-01-12'], null);
    await fila(p3, a, null, ['basico', '2023-05-01', ev]);
    await acreditacion(p3, a, 'basico', '2023-05-01', ev);
    await fila(p3, b, null, ['avanzado', '2022-01-01', ev]);
    await acreditacion(p3, b, 'avanzado', '2022-01-01', ev);

    const usuario = usuarioRrhh;
    const evaluarOrigen = (puesto: number, fecha: string) =>
      sql(
        `INSERT INTO evaluacion_criticidad
           (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
         SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, $3, $4
         FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
         WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = 'alta'`,
        [puesto, a, fecha, usuario],
      );
    await evaluarOrigen(puestoX, '2026-01-05');
    await evaluarOrigen(puestoY, '2026-01-06');

    const resultado = await servicio.fusionar(a, { idDestino: b });

    expect(resultado).toEqual({
      idOrigen: a,
      idDestino: b,
      requisitosMovidos: 2,
      personasMovidas: 3,
      evaluacionesMovidas: 2,
    });

    const requisitos = await sql<
      { p: number; c: number; n: number; e: boolean }[]
    >(
      `SELECT id_puesto AS p, id_conocimiento AS c, id_nivel_requerido AS n, es_excluyente AS e
       FROM requisito_puesto ORDER BY id_puesto`,
    );
    expect(requisitos).toEqual([
      { p: puestoX, c: b, n: niveles.experto, e: true },
      { p: puestoY, c: b, n: niveles.intermedio, e: false },
    ]);

    const evaluaciones = await sql<{ p: number; c: number }[]>(
      `SELECT id_puesto AS p, id_conocimiento AS c FROM evaluacion_criticidad ORDER BY id_puesto`,
    );
    expect(evaluaciones).toEqual([
      { p: puestoX, c: b },
      { p: puestoY, c: b },
    ]);

    const personas = await sql<
      {
        p: number;
        c: number;
        d: number | null;
        a: number | null;
        f: string | null;
      }[]
    >(
      `SELECT id_persona AS p, id_conocimiento AS c, id_nivel_declarado AS d,
              id_nivel_acreditado AS a, fecha_evaluacion::text AS f
       FROM conocimiento_persona ORDER BY id_persona`,
    );
    expect(personas).toEqual([
      { p: p1, c: b, d: niveles.basico, a: null, f: null },
      { p: p2, c: b, d: niveles.experto, a: null, f: null },
      // Vigente por fecha (2023, básico), no por nivel (2022, avanzado).
      { p: p3, c: b, d: null, a: niveles.basico, f: '2023-05-01' },
    ]);

    const historial = await sql<{ c: number }[]>(
      `SELECT id_conocimiento AS c FROM acreditacion`,
    );
    expect(historial).toEqual([{ c: b }, { c: b }]);

    const origen = await sql<{ activo: boolean; fusionado: number }[]>(
      `SELECT activo, id_fusionado_en AS fusionado FROM conocimiento WHERE id_conocimiento = $1`,
      [a],
    );
    expect(origen).toEqual([{ activo: false, fusionado: b }]);
  });

  it('deja la documentación vinculada solo al destino, sin duplicar', async () => {
    const a = await nuevoConocimiento('Docker 1', 'docker 1'); // origen
    const b = await nuevoConocimiento('Docker', 'docker'); // destino
    const nuevoActivo = async (titulo: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO activo_conocimiento (titulo, id_tipo_documento, id_unidad, origen, ubicacion)
           SELECT $1::text, (SELECT min(id_tipo_documento) FROM tipo_documento),
                  (SELECT min(id_unidad) FROM unidad_organizativa), 'enlace', 'https://wiki.example/' || $1::text
           RETURNING id_activo AS id`,
          [titulo],
        )
      )[0].id;
    const vincular = (activo: number, conocimiento: number) =>
      sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, $2)`,
        [activo, conocimiento],
      );
    const soloOrigen = await nuevoActivo('solo-origen');
    const ambos = await nuevoActivo('ambos');
    await vincular(soloOrigen, a);
    await vincular(ambos, a);
    await vincular(ambos, b);

    await servicio.fusionar(a, { idDestino: b });

    const vinculos = await sql<{ a: number; c: number }[]>(
      `SELECT id_activo AS a, id_conocimiento AS c FROM activo_conocimiento_conocimiento
       WHERE id_activo IN ($1, $2) ORDER BY id_activo`,
      [soloOrigen, ambos],
    );
    expect(vinculos).toEqual([
      { a: soloOrigen, c: b },
      { a: ambos, c: b },
    ]);
  });

  it('la evaluación más reciente del par, sea del origen o del destino, queda como vigente', async () => {
    const a = await nuevoConocimiento('Git 1', 'git 1'); // origen
    const b = await nuevoConocimiento('Git', 'git'); // destino
    const puesto = await nuevoPuesto('P-0003');
    const usuario = usuarioRrhh;
    const evaluar = (conocimiento: number, fecha: string, nivel: string) =>
      sql(
        `INSERT INTO evaluacion_criticidad
           (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
         SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, $3, $4
         FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
         WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = $5`,
        [puesto, conocimiento, fecha, usuario, nivel],
      );
    await evaluar(b, '2026-02-01', 'baja');
    await evaluar(a, '2026-03-01', 'alta'); // más reciente: la del origen
    await requisito(puesto, a, 'avanzado', true);
    await requisito(puesto, b, 'avanzado', true);

    await servicio.fusionar(a, { idDestino: b });

    const vigente = await sql<{ n: string }[]>(
      `SELECT n.codigo AS n FROM criticidad_vigente v
       JOIN nivel_criticidad n ON n.id_nivel_criticidad = v.id_nivel_criticidad
       WHERE v.id_puesto = $1 AND v.id_conocimiento = $2`,
      [puesto, b],
    );
    expect(vigente).toEqual([{ n: 'alta' }]);
    const [{ total }] = await sql<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM evaluacion_criticidad WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [puesto, b],
    );
    expect(total).toBe(2);
  });
});
