import type { DataSource, QueryRunner } from 'typeorm';
import { normalizarDenominacion } from '../modules/conocimiento/normalizar.js';
import {
  CLAVE_DEMO,
  DATOS_DEMO,
  USUARIOS_DEMO,
  type DatosDemo,
  type Relativa,
} from './datos-demo.js';

/**
 * Los datos de demo son fixtures: se escriben con SQL directo, por eso no pasan
 * por el subscriber de auditoría de TypeORM (que exige un usuario en el contexto
 * de la petición) y no generan filas de auditoría. La auditoría (RNF05) cubre las
 * operaciones que se hagan desde la aplicación sobre estos datos.
 */

export type ResultadoCarga = 'cargado' | 'omitido' | 'parcial';

/** Arma una consulta con parámetros tipados y fechas relativas a hoy. */
class Consulta {
  readonly params: unknown[] = [];

  private agregar(valor: unknown, tipo: string): string {
    this.params.push(valor);
    return `$${this.params.length}::${tipo}`;
  }

  t = (valor: string | null) => this.agregar(valor, 'text');
  n = (valor: number | null) => this.agregar(valor, 'int');

  /** Fecha relativa a hoy; `null` es NULL. */
  f(relativa: Relativa | null): string {
    if (relativa === null) return 'NULL::date';
    const anios = this.agregar(relativa.anios ?? 0, 'int');
    const meses = this.agregar(relativa.meses ?? 0, 'int');
    const dias = this.agregar(relativa.dias ?? 0, 'int');
    return `(CURRENT_DATE + make_interval(years => ${anios}, months => ${meses}, days => ${dias}))::date`;
  }
}

async function insertar(
  qr: QueryRunner,
  etiqueta: string,
  construir: (c: Consulta) => string,
  esperadas = 1,
): Promise<void> {
  const consulta = new Consulta();
  const sql = construir(consulta);
  const resultado = await qr.query(sql, consulta.params, true);
  const afectadas = resultado.affected ?? 0;
  // Un INSERT ... SELECT con JOIN descarta en silencio una referencia rota.
  if (afectadas !== esperadas) {
    throw new Error(
      `Datos de demo: no se pudo insertar ${etiqueta} (se esperaban ${esperadas} filas y hubo ${afectadas})`,
    );
  }
}

async function unidadesPorDenominacion(
  qr: QueryRunner,
  idDepartamento: number,
): Promise<Map<string, number>> {
  const filas: { denominacion: string; id_unidad: number }[] = await qr.query(
    `SELECT denominacion, id_unidad FROM unidad_organizativa
     WHERE id_unidad = $1 OR id_unidad_superior = $1`,
    [idDepartamento],
  );
  return new Map(filas.map((f) => [f.denominacion, f.id_unidad]));
}

async function cargarTodo(
  qr: QueryRunner,
  datos: DatosDemo,
  claveHash: string,
): Promise<void> {
  const raices: { id_unidad: number }[] = await qr.query(
    `SELECT u.id_unidad FROM unidad_organizativa u
     JOIN tipo_unidad t ON t.id_tipo_unidad = u.id_tipo_unidad
     WHERE t.codigo = 'departamento' AND u.id_unidad_superior IS NULL`,
  );
  if (raices.length !== 1) {
    throw new Error(
      `Datos de demo: se esperaba un único departamento sin superior y hay ${raices.length}`,
    );
  }
  const idDepartamento = raices[0].id_unidad;

  for (const catedra of datos.catedras) {
    await qr.query(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior, activo)
       SELECT $1::text, t.id_tipo_unidad, $2::int, true FROM tipo_unidad t
       WHERE t.codigo = 'catedra'
         AND NOT EXISTS (
           SELECT 1 FROM unidad_organizativa x
           WHERE x.denominacion = $1::text AND x.id_unidad_superior = $2::int)`,
      [catedra, idDepartamento],
    );
  }
  const unidades = await unidadesPorDenominacion(qr, idDepartamento);
  const unidad = (denominacion: string): number => {
    const id = unidades.get(denominacion);
    if (id === undefined) {
      throw new Error(`Datos de demo: no existe la unidad "${denominacion}"`);
    }
    return id;
  };

  for (const p of datos.puestos) {
    await insertar(
      qr,
      `el puesto ${p.codigo}`,
      (c) =>
        `INSERT INTO puesto (codigo, denominacion, proposito, dotacion_prevista, id_unidad, id_nivel_jerarquico, activo)
       SELECT ${c.t(p.codigo)}, ${c.t(p.denominacion)}, ${c.t(p.proposito)}, ${c.n(p.dotacion)},
              ${c.n(unidad(p.unidad))}, nj.id_nivel_jerarquico, true
       FROM nivel_jerarquico nj WHERE nj.codigo = ${c.t(p.nivelJerarquico)}`,
    );
  }
  // Los superiores van después: un puesto puede depender de otro definido más abajo.
  for (const p of datos.puestos.filter((x) => x.superior !== null)) {
    await insertar(
      qr,
      `el superior del puesto ${p.codigo}`,
      (c) =>
        `UPDATE puesto SET id_puesto_superior = sup.id_puesto
       FROM puesto sup
       WHERE puesto.codigo = ${c.t(p.codigo)} AND sup.codigo = ${c.t(p.superior)}`,
    );
  }

  for (const k of datos.conocimientos) {
    await insertar(
      qr,
      `el conocimiento ${k.denominacion}`,
      (c) =>
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica, activo)
       SELECT ${c.t(k.denominacion)}, ${c.t(normalizarDenominacion(k.denominacion))},
              tc.id_tipo_conocimiento, a.id_area_tematica, true
       FROM tipo_conocimiento tc, area_tematica a
       WHERE tc.codigo = ${c.t(k.tipo)} AND a.codigo = ${c.t(k.area)}`,
    );
  }

  for (const r of datos.requisitos) {
    await insertar(
      qr,
      `el requisito ${r.puesto} / ${r.conocimiento}`,
      (c) =>
        `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT pu.id_puesto, k.id_conocimiento, nd.id_nivel_dominio, ${r.excluyente}
       FROM puesto pu, conocimiento k, nivel_dominio nd
       WHERE pu.codigo = ${c.t(r.puesto)} AND k.denominacion = ${c.t(r.conocimiento)}
         AND nd.codigo = ${c.t(r.nivel)}`,
    );
  }

  for (const p of datos.personas) {
    await insertar(
      qr,
      `la persona ${p.legajo}`,
      (c) =>
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso,
                            id_situacion_revista, fecha_prevista_retiro, activo)
       SELECT ${c.t(p.legajo)}, ${c.t(p.apellido)}, ${c.t(p.nombre)}, ${c.t(p.documento)},
              ${c.f({ anios: -p.edadAnios })}, ${c.f({ anios: -p.ingresoHaceAnios })},
              sr.id_situacion_revista, ${c.f(p.retiro)}, true
       FROM situacion_revista sr WHERE sr.codigo = ${c.t(p.situacionRevista)}`,
    );
  }

  for (const u of USUARIOS_DEMO) {
    await insertar(
      qr,
      `el usuario ${u.nombreUsuario}`,
      (c) =>
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, id_persona, activo)
       SELECT ${c.t(u.nombreUsuario)}, ${c.t(claveHash)}, r.id_rol,
              (SELECT id_persona FROM persona WHERE legajo = ${c.t(u.legajo)}), true
       FROM rol r WHERE r.codigo = ${c.t(u.rol)}`,
    );
    for (const nombreUnidad of u.unidades) {
      await insertar(
        qr,
        `la unidad ${nombreUnidad} de ${u.nombreUsuario}`,
        (c) =>
          `INSERT INTO usuario_unidad (id_usuario, id_unidad)
         SELECT id_usuario, ${c.n(unidad(nombreUnidad))} FROM usuario
         WHERE nombre_usuario = ${c.t(u.nombreUsuario)}`,
      );
    }
  }

  for (const o of datos.ocupaciones) {
    await insertar(
      qr,
      `la ocupación ${o.legajo} / ${o.puesto}`,
      (c) =>
        `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       SELECT per.id_persona, pu.id_puesto, ${c.f(o.desde)}, ${c.f(o.hasta)},
              co.id_caracter_ocupacion, d.id_dedicacion
       FROM persona per, puesto pu, caracter_ocupacion co, dedicacion d
       WHERE per.legajo = ${c.t(o.legajo)} AND pu.codigo = ${c.t(o.puesto)}
         AND co.codigo = ${c.t(o.caracter)} AND d.codigo = ${c.t(o.dedicacion)}`,
    );
  }

  for (const cp of datos.conocimientosPersona) {
    const etiqueta = `el conocimiento ${cp.conocimiento} de ${cp.legajo}`;
    await insertar(
      qr,
      etiqueta,
      (c) =>
        `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion,
                                         id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
       SELECT per.id_persona, k.id_conocimiento,
              (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = ${c.t(cp.declarado?.nivel ?? null)}),
              ${c.f(cp.declarado?.hace ?? null)},
              (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = ${c.t(cp.acreditado?.nivel ?? null)}),
              ${c.f(cp.acreditado?.hace ?? null)},
              (SELECT id_tipo_evidencia FROM tipo_evidencia WHERE codigo = ${c.t(cp.acreditado?.evidencia ?? null)}),
              (SELECT id_persona FROM persona WHERE legajo = ${c.t(cp.acreditado?.evaluador ?? null)})
       FROM persona per, conocimiento k
       WHERE per.legajo = ${c.t(cp.legajo)} AND k.denominacion = ${c.t(cp.conocimiento)}`,
    );
    if (cp.acreditado) {
      const a = cp.acreditado;
      await insertar(
        qr,
        `la acreditación de ${etiqueta}`,
        (c) =>
          `INSERT INTO acreditacion (id_persona, id_conocimiento, id_nivel_acreditado, id_tipo_evidencia,
                                   fecha_evaluacion, id_evaluador)
         SELECT per.id_persona, k.id_conocimiento, nd.id_nivel_dominio, te.id_tipo_evidencia,
                ${c.f(a.hace)}, ev.id_persona
         FROM persona per, conocimiento k, nivel_dominio nd, tipo_evidencia te, persona ev
         WHERE per.legajo = ${c.t(cp.legajo)} AND k.denominacion = ${c.t(cp.conocimiento)}
           AND nd.codigo = ${c.t(a.nivel)} AND te.codigo = ${c.t(a.evidencia)}
           AND ev.legajo = ${c.t(a.evaluador)}`,
      );
    }
  }

  for (const e of datos.evaluaciones) {
    await insertar(
      qr,
      `la evaluación ${e.puesto} / ${e.conocimiento}`,
      (c) =>
        `INSERT INTO evaluacion_criticidad (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad,
                                          id_nivel_criticidad, fecha_evaluacion, id_usuario)
       SELECT pu.id_puesto, k.id_conocimiento, ni.id_nivel_impacto, nd.id_nivel_dificultad,
              m.id_nivel_criticidad, ${c.f(e.hace)}, u.id_usuario
       FROM puesto pu, conocimiento k, nivel_impacto ni, nivel_dificultad nd, usuario u,
            matriz_criticidad m
       WHERE pu.codigo = ${c.t(e.puesto)} AND k.denominacion = ${c.t(e.conocimiento)}
         AND ni.codigo = ${c.t(e.impacto)} AND nd.codigo = ${c.t(e.dificultad)}
         AND m.id_nivel_impacto = ni.id_nivel_impacto AND m.id_nivel_dificultad = nd.id_nivel_dificultad
         AND u.nombre_usuario = 'demo.rrhh'`,
    );
  }

  for (const p of datos.planes) {
    const resuelto = p.estado === 'aprobado';
    await insertar(
      qr,
      `el plan de sucesión de ${p.puesto}`,
      (c) =>
        `INSERT INTO plan_sucesion (id_puesto, id_responsable, id_estado_plan, id_usuario_resolucion, fecha_resolucion)
       SELECT pu.id_puesto, per.id_persona, ep.id_estado_plan,
              ${resuelto ? `(SELECT id_usuario FROM usuario WHERE nombre_usuario = 'demo.autoridad')` : 'NULL'},
              ${resuelto ? 'CURRENT_DATE' : 'NULL::date'}
       FROM puesto pu, persona per, estado_plan ep
       WHERE pu.codigo = ${c.t(p.puesto)} AND per.legajo = ${c.t(p.responsable)}
         AND ep.codigo = ${c.t(p.estado)}`,
    );
  }

  for (const k of datos.candidatos) {
    await insertar(
      qr,
      `el candidato ${k.legajo} del plan de ${k.puesto}`,
      (c) =>
        `INSERT INTO candidato_sucesion (id_plan, id_persona, id_estado_preparacion, prioridad, fecha_disponibilidad_estimada)
       SELECT pl.id_plan, per.id_persona, ep.id_estado_preparacion, ${c.n(k.prioridad)}, ${c.f(k.disponibleEn)}
       FROM plan_sucesion pl
       JOIN puesto pu ON pu.id_puesto = pl.id_puesto AND pu.codigo = ${c.t(k.puesto)}
       CROSS JOIN persona per
       CROSS JOIN estado_preparacion ep
       WHERE per.legajo = ${c.t(k.legajo)} AND ep.codigo = ${c.t(k.preparacion)}`,
    );
  }

  for (const a of datos.acciones) {
    await insertar(
      qr,
      `la acción "${a.descripcion}"`,
      (c) =>
        `INSERT INTO accion_transferencia (id_tipo_accion, id_conocimiento, id_plan, id_responsable, id_destinatario,
                                         descripcion, fecha_prevista, fecha_cumplimiento, id_estado_accion, nota_avance)
       SELECT ta.id_tipo_accion_transferencia, k.id_conocimiento,
              (SELECT pl.id_plan FROM plan_sucesion pl JOIN puesto pu ON pu.id_puesto = pl.id_puesto
               WHERE pu.codigo = ${c.t(a.plan)}),
              resp.id_persona,
              (SELECT id_persona FROM persona WHERE legajo = ${c.t(a.destinatario)}),
              ${c.t(a.descripcion)}, ${c.f(a.prevista)}, ${c.f(a.cumplimiento)}, ea.id_estado_accion_transferencia, ${c.t(a.nota)}
       FROM tipo_accion_transferencia ta, conocimiento k, persona resp, estado_accion_transferencia ea
       WHERE ta.codigo = ${c.t(a.tipo)} AND k.denominacion = ${c.t(a.conocimiento)}
         AND resp.legajo = ${c.t(a.responsable)} AND ea.codigo = ${c.t(a.estado)}`,
    );
  }

  for (const activo of datos.activosEnlace) {
    await insertar(
      qr,
      `el activo "${activo.titulo}"`,
      (c) =>
        `INSERT INTO activo_conocimiento (titulo, id_tipo_documento, id_unidad, origen, ubicacion, activo)
       SELECT ${c.t(activo.titulo)}, td.id_tipo_documento, ${c.n(unidad(activo.unidad))}, 'enlace', ${c.t(activo.url)}, true
       FROM tipo_documento td WHERE td.codigo = ${c.t(activo.tipoDocumento)}`,
    );
    for (const conocimiento of activo.conocimientos) {
      await insertar(
        qr,
        `el vínculo de "${activo.titulo}" con ${conocimiento}`,
        (c) =>
          `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento)
         SELECT a.id_activo, k.id_conocimiento FROM activo_conocimiento a, conocimiento k
         WHERE a.titulo = ${c.t(activo.titulo)} AND k.denominacion = ${c.t(conocimiento)}`,
      );
    }
  }
}

/**
 * Carga los datos de demostración en una sola transacción.
 * - `omitido`: ya existe `demo.admin`, no se hace nada.
 * - `parcial`: no existe `demo.admin` pero quedan personas `DEMO-`; no se escribe nada.
 * - `cargado`: se insertó todo.
 * Ante un error se revierte todo y se relanza.
 */
export async function cargarDatosDemo(
  dataSource: DataSource,
  hashearClave: (clave: string) => Promise<string>,
  datos: DatosDemo = DATOS_DEMO,
): Promise<ResultadoCarga> {
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  try {
    const [{ existe }] = await qr.query(
      `SELECT EXISTS (SELECT 1 FROM usuario WHERE nombre_usuario = 'demo.admin') AS existe`,
    );
    if (existe) return 'omitido';
    const [{ hay }] = await qr.query(
      `SELECT EXISTS (SELECT 1 FROM persona WHERE legajo LIKE 'DEMO-%') AS hay`,
    );
    if (hay) return 'parcial';

    const claveHash = await hashearClave(CLAVE_DEMO);
    await qr.startTransaction();
    try {
      await cargarTodo(qr, datos, claveHash);
      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    }
    return 'cargado';
  } finally {
    await qr.release();
  }
}
