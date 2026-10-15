import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';

describe('Lecturas del perfil de conocimiento (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: PerfilConocimientoService;
  let niveles: Record<string, number>;
  let evidencia: number;
  let unidadCatedra: number;
  let otraCatedra: number;
  let puesto: number;
  let puestoAjeno: number;
  let conocimiento: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;
  const nuevaPersona = async (n: number) =>
    (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT $1, $3, 'Ana', $2, '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente' RETURNING id_persona AS id`,
        [`L-${n}`, `3000000${n}`, `Apellido${n}`],
      )
    )[0].id;
  const ocupar = async (
    persona: number,
    idPuesto: number,
    desde: number,
    hasta: number | null,
  ) =>
    sql(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, fecha_hasta, id_caracter_ocupacion, id_dedicacion)
       SELECT $1, $2, $3, $4, (SELECT min(id_caracter_ocupacion) FROM caracter_ocupacion), (SELECT min(id_dedicacion) FROM dedicacion)`,
      [
        persona,
        idPuesto,
        await dia(desde),
        hasta === null ? null : await dia(hasta),
      ],
    );
  const declarar = async (persona: number, nivel: string, fecha: number) =>
    sql(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion) VALUES ($1, $2, $3, $4)`,
      [persona, conocimiento, niveles[nivel], await dia(fecha)],
    );
  const jefe = (idPersona: number, unidades: number[]): SesionUsuario => ({
    id: 1,
    nombreUsuario: 'jefe',
    rol: 'jefe_catedra',
    idPersona,
    unidades,
  });

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
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
    const alcance = new AlcanceService(ds);
    servicio = new PerfilConocimientoService(
      ds,
      ds.getRepository(Acreditacion),
      new AccesoPerfilService(ds, alcance),
      alcance,
    );
    const departamento = (
      await sql<{ id: number }[]>(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    const nuevaCatedra = async (nombre: string) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
           SELECT $1, id_tipo_unidad, $2 FROM tipo_unidad WHERE codigo = 'catedra' RETURNING id_unidad AS id`,
          [nombre, departamento],
        )
      )[0].id;
    unidadCatedra = await nuevaCatedra('Cátedra A');
    otraCatedra = await nuevaCatedra('Cátedra B');
    const nuevoPuesto = async (codigo: string, unidad: number) =>
      (
        await sql<{ id: number }[]>(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
           SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente' RETURNING id_puesto AS id`,
          [codigo, unidad],
        )
      )[0].id;
    puesto = await nuevoPuesto('P-0001', unidadCatedra);
    puestoAjeno = await nuevoPuesto('P-0002', otraCatedra);
    conocimiento = (
      await sql<{ id: number }[]>(
        `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
         SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
         FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM acreditacion');
    await sql('DELETE FROM conocimiento_persona');
    await sql('DELETE FROM requisito_puesto');
    await sql('DELETE FROM ocupacion');
    await sql('DELETE FROM persona');
  });

  describe('pendientes', () => {
    it('lista lo declarado sin acreditar por personas del alcance y excluye al propio evaluador', async () => {
      const evaluador = await nuevaPersona(1);
      const docente = await nuevaPersona(2);
      await ocupar(evaluador, puesto, -100, null);
      await ocupar(docente, puesto, -100, null);
      await declarar(evaluador, 'basico', -5);
      await declarar(docente, 'avanzado', -5);

      const pendientes = await servicio.pendientes(
        jefe(evaluador, [unidadCatedra]),
      );

      expect(pendientes.map((p) => p.idPersona)).toEqual([docente]);
      expect(pendientes[0]).toMatchObject({
        idNivelDeclarado: niveles.avanzado,
        idNivelAcreditado: null,
      });
    });

    it('no incluye a personas de otra cátedra ni a quien ya no ocupa un puesto vigente', async () => {
      const evaluador = await nuevaPersona(1);
      const ajena = await nuevaPersona(2);
      const exOcupante = await nuevaPersona(3);
      await ocupar(ajena, puestoAjeno, -100, null);
      await ocupar(exOcupante, puesto, -100, -1);
      await declarar(ajena, 'basico', -5);
      await declarar(exOcupante, 'basico', -5);
      expect(
        await servicio.pendientes(jefe(evaluador, [unidadCatedra])),
      ).toEqual([]);
    });

    it('una ocupación que vence hoy sigue contando', async () => {
      const evaluador = await nuevaPersona(1);
      const docente = await nuevaPersona(2);
      await ocupar(docente, puesto, -100, 0);
      await declarar(docente, 'basico', -5);
      expect(
        await servicio.pendientes(jefe(evaluador, [unidadCatedra])),
      ).toHaveLength(1);
    });

    it('lo acreditado al nivel declarado, o evaluado después de declarar, ya no está pendiente', async () => {
      const evaluador = await nuevaPersona(1);
      const igual = await nuevaPersona(2);
      const posterior = await nuevaPersona(3);
      const redeclarado = await nuevaPersona(4);
      for (const p of [igual, posterior, redeclarado])
        await ocupar(p, puesto, -100, null);
      const conAcreditacion = async (
        p: number,
        declarado: string,
        fechaDecl: number,
        acreditado: string,
        fechaEv: number,
      ) =>
        sql(
          `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion, id_nivel_acreditado, fecha_evaluacion, id_tipo_evidencia, id_evaluador)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            p,
            conocimiento,
            niveles[declarado],
            await dia(fechaDecl),
            niveles[acreditado],
            await dia(fechaEv),
            evidencia,
            evaluador,
          ],
        );
      await conAcreditacion(igual, 'avanzado', -10, 'avanzado', -3);
      await conAcreditacion(posterior, 'avanzado', -10, 'basico', -3);
      // Re-declaró después de ser evaluado: vuelve a quedar pendiente.
      await conAcreditacion(redeclarado, 'experto', -2, 'basico', -9);

      const pendientes = await servicio.pendientes(
        jefe(evaluador, [unidadCatedra]),
      );
      expect(pendientes.map((p) => p.idPersona)).toEqual([redeclarado]);
    });
  });

  describe('mios', () => {
    it('une los requisitos de dos puestos vigentes con el nivel más exigente y deja afuera los de ocupaciones pasadas', async () => {
      const persona = await nuevaPersona(1);
      await ocupar(persona, puesto, -100, null);
      await ocupar(persona, puestoAjeno, -100, null);
      const otroPasado = (
        await sql<{ id: number }[]>(
          `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT 'P-0003', 'P-0003', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente' RETURNING id_puesto AS id`,
          [unidadCatedra],
        )
      )[0].id;
      await ocupar(persona, otroPasado, -100, -1);
      const pide = (idPuesto: number, nivel: string, excluyente: boolean) =>
        sql(
          `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente) VALUES ($1, $2, $3, $4)`,
          [idPuesto, conocimiento, niveles[nivel], excluyente],
        );
      await pide(puesto, 'intermedio', false);
      await pide(puestoAjeno, 'avanzado', true);
      await pide(otroPasado, 'experto', true);

      const filas = await servicio.mios(jefe(persona, []));

      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        idConocimiento: conocimiento,
        idNivelRequerido: niveles.avanzado,
        esExcluyente: true,
      });
      expect(filas[0].puestos.map((p) => p.codigo).sort()).toEqual([
        'P-0001',
        'P-0002',
      ]);
    });
  });
});
