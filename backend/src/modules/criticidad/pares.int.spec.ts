import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { ParesService } from './pares.service.js';

describe('Pares y avance de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ParesService;
  let cat1: number;
  let cat2: number;
  let p1: number;
  let p2: number;
  let c1: number;
  let c2: number;
  let usuario: number;
  let rrhh: SesionUsuario;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;
  const sesion = (
    rol: SesionUsuario['rol'],
    unidades: number[] = [],
  ): SesionUsuario => ({
    id: usuario,
    nombreUsuario: 'u',
    rol,
    idPersona: null,
    unidades,
  });
  const nuevaCatedra = (nombre: string) =>
    id(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1::text, t.id_tipo_unidad, (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
       FROM tipo_unidad t WHERE t.codigo = 'catedra' RETURNING id_unidad AS id`,
      [nombre],
    );
  const nuevoPuesto = (codigo: string, unidad: number) =>
    id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT $1, $1, $2, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
      [codigo, unidad],
    );
  const nuevoConocimiento = (nombre: string) =>
    id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT $1::text, lower($1::text), t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
      [nombre],
    );
  const requisito = (p: number, c: number, excluyente = true) =>
    sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, $3 FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [p, c, excluyente],
    );
  const evaluar = (p: number, c: number, nivel: string) =>
    sql(
      `INSERT INTO evaluacion_criticidad
         (id_puesto, id_conocimiento, id_nivel_impacto, id_nivel_dificultad, id_nivel_criticidad, fecha_evaluacion, id_usuario)
       SELECT $1, $2, i.id_nivel_impacto, d.id_nivel_dificultad, n.id_nivel_criticidad, CURRENT_DATE, $4
       FROM nivel_impacto i, nivel_dificultad d, nivel_criticidad n
       WHERE i.codigo = 'alto' AND d.codigo = 'dificil' AND n.codigo = $3`,
      [p, c, nivel, usuario],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    servicio = new ParesService(ds, new AlcanceService(ds));
    cat1 = await nuevaCatedra('Cátedra 1');
    cat2 = await nuevaCatedra('Cátedra 2');
    p1 = await nuevoPuesto('P-0001', cat1);
    p2 = await nuevoPuesto('P-0002', cat2);
    c1 = await nuevoConocimiento('SQL');
    c2 = await nuevoConocimiento('Redes');
    await requisito(p1, c1);
    await requisito(p1, c2, false);
    await requisito(p2, c1);
    usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'u', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    rrhh = sesion('recursos_humanos');
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('RR. HH. ve todos los pares como pendientes y el avance en cero', async () => {
    const pares = await servicio.pares({}, rrhh);
    expect(pares).toHaveLength(3);
    expect(pares.every((p) => p.estado === 'pendiente')).toBe(true);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 0, total: 3 });
  });

  it('un puesto sin evaluaciones aparece como pendiente, no como no crítico', async () => {
    const pares = await servicio.pares({ idPuesto: p2 }, rrhh);
    expect(pares).toEqual([
      expect.objectContaining({
        idPuesto: p2,
        estado: 'pendiente',
        idNivelCriticidad: null,
      }),
    ]);
  });

  it('cuenta la evaluación vigente y filtra por estado', async () => {
    await evaluar(p1, c1, 'baja');
    await evaluar(p1, c1, 'alta'); // la más reciente (mayor id, misma fecha) es la vigente
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 1, total: 3 });
    const evaluados = await servicio.pares({ estado: 'evaluado' }, rrhh);
    expect(evaluados).toHaveLength(1);
    expect(evaluados[0]).toMatchObject({
      idPuesto: p1,
      idConocimiento: c1,
      estado: 'evaluado',
    });
    expect(await servicio.pares({ estado: 'pendiente' }, rrhh)).toHaveLength(2);
  });

  it('una evaluación de un requisito quitado no cuenta, y vuelve a contar al reagregarlo', async () => {
    await sql(
      `DELETE FROM requisito_puesto WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [p1, c1],
    );
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 0, total: 2 });
    await requisito(p1, c1);
    expect(await servicio.avance({}, rrhh)).toEqual({ evaluados: 1, total: 3 });
  });

  it('el jefe de cátedra solo ve los pares de su cátedra, y uno sin unidades no ve nada', async () => {
    const jefe1 = sesion('jefe_catedra', [cat1]);
    const pares = await servicio.pares({}, jefe1);
    expect(pares.map((p) => p.idPuesto)).toEqual([p1, p1]);
    expect(await servicio.avance({}, jefe1)).toEqual({
      evaluados: 1,
      total: 2,
    });
    expect(await servicio.pares({}, sesion('jefe_catedra'))).toEqual([]);
    expect(await servicio.avance({}, sesion('jefe_catedra'))).toEqual({
      evaluados: 0,
      total: 0,
    });
  });

  it('filtrar por una unidad incluye sus descendientes; por otra cátedra, solo esa', async () => {
    const raiz = await id(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    expect(await servicio.pares({ idUnidad: raiz }, rrhh)).toHaveLength(3);
    expect(
      (await servicio.pares({ idUnidad: cat2 }, rrhh)).map((p) => p.idPuesto),
    ).toEqual([p2]);
    // Un jefe no amplía su alcance filtrando por una unidad ajena.
    expect(
      await servicio.pares({ idUnidad: cat2 }, sesion('jefe_catedra', [cat1])),
    ).toEqual([]);
  });

  it('excluye puestos dados de baja', async () => {
    await sql(`UPDATE puesto SET activo = false WHERE id_puesto = $1`, [p2]);
    expect(await servicio.avance({}, rrhh)).toEqual({
      evaluados: 1,
      total: 3 - 1,
    });
  });
});
