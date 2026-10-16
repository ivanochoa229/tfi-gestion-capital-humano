import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { MatrizService } from './matriz.service.js';

describe('Evaluaciones de criticidad (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: EvaluacionesService;
  let matriz: MatrizService;
  let puesto: number;
  let conocimiento: number;
  let sesion: SesionUsuario;
  let ids: Record<string, number>;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const id = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    puesto = await id(
      `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe de cátedra', (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL),
              id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
    );
    conocimiento = await id(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT 'SQL', 'sql', t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica' RETURNING id_conocimiento AS id`,
    );
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, true FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [puesto, conocimiento],
    );
    const usuario = await id(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
       SELECT 'rrhh', 'x', id_rol FROM rol WHERE codigo = 'recursos_humanos' RETURNING id_usuario AS id`,
    );
    sesion = {
      id: usuario,
      nombreUsuario: 'rrhh',
      rol: 'recursos_humanos',
      idPersona: null,
      unidades: [],
    };
    const codigos = async (tabla: string, col: string) =>
      Object.fromEntries(
        (
          await sql<{ codigo: string; id: number }[]>(
            `SELECT codigo, ${col} AS id FROM ${tabla}`,
          )
        ).map((f) => [f.codigo, f.id]),
      );
    ids = {
      ...Object.fromEntries(
        Object.entries(await codigos('nivel_impacto', 'id_nivel_impacto')).map(
          ([k, v]) => [`i_${k}`, v],
        ),
      ),
      ...Object.fromEntries(
        Object.entries(
          await codigos('nivel_dificultad', 'id_nivel_dificultad'),
        ).map(([k, v]) => [`d_${k}`, v]),
      ),
      ...Object.fromEntries(
        Object.entries(
          await codigos('nivel_criticidad', 'id_nivel_criticidad'),
        ).map(([k, v]) => [`n_${k}`, v]),
      ),
    };
    matriz = new MatrizService(
      ds.getRepository(NivelImpacto),
      ds.getRepository(NivelDificultad),
      ds.getRepository(MatrizCriticidad),
      { validarActivo: async () => undefined } as never,
    );
    servicio = new EvaluacionesService(
      ds.getRepository(EvaluacionCriticidad),
      ds.getRepository(Puesto),
      matriz,
      { exigirUnidad: async () => undefined } as unknown as AlcanceService,
    );
    // El subscriber de auditoría exige usuario en el contexto de cada escritura.
    const { AuditoriaSubscriber } =
      await import('../../infra/auditoria/auditoria.subscriber.js');
    new AuditoriaSubscriber(ds);
  });
  afterAll(async () => {
    await base.destruir();
  });

  const evaluar = async (impacto: string, dificultad: string, extra = {}) => {
    const { contextoUsuario } =
      await import('../../infra/auditoria/contexto-usuario.js');
    return contextoUsuario.run({ idUsuario: sesion.id }, () =>
      servicio.evaluar(
        puesto,
        conocimiento,
        {
          idNivelImpacto: ids[`i_${impacto}`],
          idNivelDificultad: ids[`d_${dificultad}`],
          ...extra,
        },
        sesion,
      ),
    );
  };

  it('guarda el nivel que da la matriz para cada combinación (alto/difícil = alta, bajo/fácil = baja)', async () => {
    expect((await evaluar('alto', 'dificil')).idNivelCriticidad).toBe(
      ids.n_alta,
    );
    expect((await evaluar('bajo', 'facil')).idNivelCriticidad).toBe(ids.n_baja);
    expect((await evaluar('medio', 'moderada')).idNivelCriticidad).toBe(
      ids.n_media,
    );
  });

  it('cambiar la matriz no altera lo guardado y la evaluación nueva usa la matriz nueva', async () => {
    const antes = await evaluar('bajo', 'dificil'); // matriz inicial: media
    expect(antes.idNivelCriticidad).toBe(ids.n_media);

    await matriz.editarCelda(ids.i_bajo, ids.d_dificil, {
      idNivelCriticidad: ids.n_alta,
    });

    const [guardada] = await sql<{ n: number }[]>(
      `SELECT id_nivel_criticidad AS n FROM evaluacion_criticidad WHERE id_evaluacion = $1`,
      [antes.id],
    );
    expect(guardada.n).toBe(ids.n_media);
    expect((await evaluar('bajo', 'dificil')).idNivelCriticidad).toBe(
      ids.n_alta,
    );
  });

  it('da 409 si el requisito se quitó, pero el historial sigue disponible', async () => {
    await sql(
      `DELETE FROM requisito_puesto WHERE id_puesto = $1 AND id_conocimiento = $2`,
      [puesto, conocimiento],
    );
    await expect(evaluar('alto', 'dificil')).rejects.toThrow(
      /no exige ese conocimiento/,
    );
    const historial = await servicio.historial(puesto, conocimiento, sesion);
    expect(historial.length).toBeGreaterThanOrEqual(5);
    expect(historial[0].nombreUsuario).toBe('rrhh');
    // Orden: más reciente primero (misma fecha: mayor id primero).
    const claves = historial.map(
      (h) => `${h.fechaEvaluacion}-${String(h.id).padStart(8, '0')}`,
    );
    expect([...claves].sort().reverse()).toEqual(claves);
  });

  it('tras desactivar el conocimiento (como hace una fusión) no se puede evaluar', async () => {
    await sql(
      `INSERT INTO requisito_puesto (id_puesto, id_conocimiento, id_nivel_requerido, es_excluyente)
       SELECT $1, $2, id_nivel_dominio, true FROM nivel_dominio WHERE codigo = 'avanzado'`,
      [puesto, conocimiento],
    );
    await sql(
      `UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`,
      [conocimiento],
    );
    await expect(evaluar('alto', 'dificil')).rejects.toThrow(/dado de baja/);
  });
});
