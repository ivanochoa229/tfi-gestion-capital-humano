import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { ParesService } from './pares.service.js';
import { SQL_AVANCE, SQL_PARES } from './pares.sql.js';

const jefe: SesionUsuario = {
  id: 1,
  nombreUsuario: 'jefe',
  rol: 'jefe_catedra',
  idPersona: 7,
  unidades: [10],
};

function crearServicio(visibles: number[] | null, filas: object[] = []) {
  const query = vi.fn(async () => filas);
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const servicio = new ParesService(
    { query } as unknown as DataSource,
    alcance as unknown as AlcanceService,
  );
  return { servicio, query };
}

const fila = (extra: object) => ({
  id_puesto: 5,
  codigo_puesto: 'P-0001',
  denominacion_puesto: 'Jefe',
  id_unidad: 10,
  id_conocimiento: 8,
  denominacion_conocimiento: 'SQL',
  id_nivel_requerido: 3,
  es_excluyente: true,
  id_evaluacion: null,
  id_nivel_impacto: null,
  id_nivel_dificultad: null,
  id_nivel_criticidad: null,
  fecha_evaluacion: null,
  ...extra,
});

describe('ParesService.pares', () => {
  it('pasa el alcance y los filtros a la consulta', async () => {
    const { servicio, query } = crearServicio([10, 11]);
    await servicio.pares(
      { idUnidad: 10, idPuesto: 5, estado: 'pendiente' },
      jefe,
    );
    expect(query).toHaveBeenCalledWith(SQL_PARES, [
      [10, 11],
      10,
      5,
      'pendiente',
    ]);
  });

  it('sin restricción ni filtros pasa nulos', async () => {
    const { servicio, query } = crearServicio(null);
    await servicio.pares({}, jefe);
    expect(query).toHaveBeenCalledWith(SQL_PARES, [null, null, null, null]);
  });

  it('marca como pendiente el par sin evaluación y como evaluado el que la tiene', async () => {
    const { servicio } = crearServicio(null, [
      fila({}),
      fila({
        id_conocimiento: 9,
        id_evaluacion: 3,
        id_nivel_impacto: 2,
        id_nivel_dificultad: 1,
        id_nivel_criticidad: 4,
        fecha_evaluacion: '2026-06-01',
      }),
    ]);
    const pares = await servicio.pares({}, jefe);
    expect(pares[0]).toMatchObject({
      estado: 'pendiente',
      idEvaluacion: null,
      idNivelCriticidad: null,
    });
    expect(pares[1]).toMatchObject({
      estado: 'evaluado',
      idEvaluacion: 3,
      idNivelCriticidad: 4,
      fechaEvaluacion: '2026-06-01',
    });
  });

  it('con alcance vacío pasa un arreglo vacío (no ve nada)', async () => {
    const { servicio, query } = crearServicio([]);
    await servicio.pares({}, jefe);
    expect(query).toHaveBeenCalledWith(SQL_PARES, [[], null, null, null]);
  });
});

describe('ParesService.avance', () => {
  it('devuelve evaluados sobre total para el alcance', async () => {
    const { servicio, query } = crearServicio(
      [10],
      [{ evaluados: 4, total: 9 }],
    );
    expect(await servicio.avance({ idUnidad: 10 }, jefe)).toEqual({
      evaluados: 4,
      total: 9,
    });
    expect(query).toHaveBeenCalledWith(SQL_AVANCE, [[10], 10, null]);
  });
});
