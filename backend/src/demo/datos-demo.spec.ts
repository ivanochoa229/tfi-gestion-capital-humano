import { TODOS_LOS_ROLES } from '../common/roles.js';
import {
  CLAVE_DEMO,
  DATOS_DEMO,
  DEPARTAMENTO,
  USUARIOS_DEMO,
} from './datos-demo.js';

const legajos = new Set(DATOS_DEMO.personas.map((p) => p.legajo));
const puestos = new Set(DATOS_DEMO.puestos.map((p) => p.codigo));
const conocimientos = new Set(
  DATOS_DEMO.conocimientos.map((k) => k.denominacion),
);
const catedras = new Set(DATOS_DEMO.catedras);

const repetidos = (valores: string[]) =>
  valores.filter((v, i) => valores.indexOf(v) !== i);

describe('datos de demo', () => {
  it('la clave de demo cumple el largo mínimo del sistema', () => {
    expect(CLAVE_DEMO.length).toBeGreaterThanOrEqual(10);
  });

  it('hay un usuario por cada uno de los siete roles', () => {
    const roles = USUARIOS_DEMO.map((u) => u.rol).sort();
    expect(roles).toEqual([...TODOS_LOS_ROLES].sort());
  });

  it('los nombres de usuario empiezan con demo. y no se repiten', () => {
    const nombres = USUARIOS_DEMO.map((u) => u.nombreUsuario);
    expect(nombres.every((n) => n.startsWith('demo.'))).toBe(true);
    expect(repetidos(nombres)).toEqual([]);
  });

  it('el docente y los evaluadores están vinculados a una persona, y ninguna persona a dos usuarios', () => {
    for (const u of USUARIOS_DEMO) {
      if (
        u.rol === 'docente' ||
        u.rol === 'jefe_catedra' ||
        u.rol === 'jefatura_departamento'
      ) {
        expect(u.legajo, u.nombreUsuario).not.toBeNull();
      }
      if (u.legajo !== null) expect(legajos.has(u.legajo)).toBe(true);
    }
    const conPersona = USUARIOS_DEMO.flatMap((u) =>
      u.legajo === null ? [] : [u.legajo],
    );
    expect(repetidos(conPersona)).toEqual([]);
  });

  it('las unidades asignadas a los usuarios existen', () => {
    for (const u of USUARIOS_DEMO) {
      for (const unidad of u.unidades) {
        expect(
          catedras.has(unidad) || unidad === DEPARTAMENTO,
          `${u.nombreUsuario}: ${unidad}`,
        ).toBe(true);
      }
    }
  });

  it('toda referencia apunta a algo definido', () => {
    const d = DATOS_DEMO;
    expect(
      d.puestos.every(
        (p) => catedras.has(p.unidad) || p.unidad === DEPARTAMENTO,
      ),
    ).toBe(true);
    expect(
      d.puestos.every((p) => p.superior === null || puestos.has(p.superior)),
    ).toBe(true);
    expect(d.requisitos.every((r) => puestos.has(r.puesto))).toBe(true);
    expect(d.requisitos.every((r) => conocimientos.has(r.conocimiento))).toBe(
      true,
    );
    expect(d.ocupaciones.every((o) => legajos.has(o.legajo))).toBe(true);
    expect(d.ocupaciones.every((o) => puestos.has(o.puesto))).toBe(true);
    expect(d.conocimientosPersona.every((c) => legajos.has(c.legajo))).toBe(
      true,
    );
    expect(
      d.conocimientosPersona.every((c) => conocimientos.has(c.conocimiento)),
    ).toBe(true);
    expect(
      d.conocimientosPersona.every(
        (c) => c.acreditado === null || legajos.has(c.acreditado.evaluador),
      ),
    ).toBe(true);
    expect(d.evaluaciones.every((e) => puestos.has(e.puesto))).toBe(true);
    expect(d.evaluaciones.every((e) => conocimientos.has(e.conocimiento))).toBe(
      true,
    );
    expect(
      d.planes.every(
        (p) => puestos.has(p.puesto) && legajos.has(p.responsable),
      ),
    ).toBe(true);
    expect(
      d.candidatos.every((c) => puestos.has(c.puesto) && legajos.has(c.legajo)),
    ).toBe(true);
    expect(
      d.acciones.every(
        (a) =>
          conocimientos.has(a.conocimiento) &&
          legajos.has(a.responsable) &&
          (a.destinatario === null || legajos.has(a.destinatario)) &&
          (a.plan === null || puestos.has(a.plan)),
      ),
    ).toBe(true);
    expect(
      d.activosEnlace.every(
        (a) =>
          catedras.has(a.unidad) &&
          a.conocimientos.every((k) => conocimientos.has(k)),
      ),
    ).toBe(true);
  });

  it('los legajos empiezan con DEMO- y los legajos, documentos y códigos son únicos', () => {
    const d = DATOS_DEMO;
    expect(d.personas.every((p) => p.legajo.startsWith('DEMO-'))).toBe(true);
    expect(repetidos(d.personas.map((p) => p.legajo))).toEqual([]);
    expect(repetidos(d.personas.map((p) => p.documento))).toEqual([]);
    expect(repetidos(d.puestos.map((p) => p.codigo))).toEqual([]);
    expect(repetidos(d.conocimientos.map((k) => k.denominacion))).toEqual([]);
  });

  it('cada plan tiene candidatos con prioridades 1..n y ningún puesto repite plan activo', () => {
    const d = DATOS_DEMO;
    const porEstado = d.planes.map((p) => `${p.puesto}|${p.estado}`);
    expect(repetidos(porEstado)).toEqual([]);
    const elaboracion = d.planes
      .filter((p) => p.estado !== 'aprobado')
      .map((p) => p.puesto);
    expect(repetidos(elaboracion)).toEqual([]);
    for (const plan of d.planes) {
      const prioridades = d.candidatos
        .filter((c) => c.puesto === plan.puesto)
        .map((c) => c.prioridad)
        .sort();
      expect(prioridades, plan.puesto).toEqual(
        prioridades.map((_, i) => i + 1),
      );
    }
  });

  it('nadie figura como evaluador de sus propias acreditaciones', () => {
    for (const c of DATOS_DEMO.conocimientosPersona) {
      if (c.acreditado) {
        expect(
          c.acreditado.evaluador,
          `${c.legajo} / ${c.conocimiento}`,
        ).not.toBe(c.legajo);
      }
    }
  });

  it('solo la jefatura del departamento no tiene superior', () => {
    expect(
      DATOS_DEMO.puestos
        .filter((p) => p.superior === null)
        .map((p) => p.codigo),
    ).toEqual(['P-DEP-JEF']);
  });

  it('cada acreditación la firma quien ocupa un puesto superior al de la persona', () => {
    const d = DATOS_DEMO;
    const superiorDe = new Map(d.puestos.map((p) => [p.codigo, p.superior]));
    const ancestros = (codigo: string): string[] => {
      const sup = superiorDe.get(codigo) ?? null;
      return sup === null ? [] : [sup, ...ancestros(sup)];
    };
    const vigentes = (legajo: string) =>
      d.ocupaciones
        .filter((o) => o.legajo === legajo && o.hasta === null)
        .map((o) => o.puesto);
    for (const c of d.conocimientosPersona) {
      if (!c.acreditado) continue;
      const delEvaluador = new Set(vigentes(c.acreditado.evaluador));
      const porEncima = vigentes(c.legajo).some((puesto) =>
        ancestros(puesto).some((a) => delEvaluador.has(a)),
      );
      expect(porEncima, `${c.legajo} / ${c.conocimiento}`).toBe(true);
    }
  });

  it('una acción no tiene al responsable como destinatario', () => {
    for (const a of DATOS_DEMO.acciones) {
      expect(a.destinatario).not.toBe(a.responsable);
    }
  });

  it('no hay fechas absolutas: todo es relativo a la fecha actual', () => {
    expect(JSON.stringify(DATOS_DEMO)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('el catálogo incluye al menos diez conocimientos y hay pares sin evaluar', () => {
    const d = DATOS_DEMO;
    expect(d.conocimientos.length).toBeGreaterThanOrEqual(10);
    const evaluados = new Set(
      d.evaluaciones.map((e) => `${e.puesto}|${e.conocimiento}`),
    );
    const sinEvaluar = d.requisitos.filter(
      (r) => !evaluados.has(`${r.puesto}|${r.conocimiento}`),
    );
    expect(sinEvaluar.length).toBeGreaterThan(0);
  });
});
