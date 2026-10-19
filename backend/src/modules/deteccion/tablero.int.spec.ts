import { ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import {
  cargarDatosDeDeteccion,
  type DatosDeteccion,
} from '../../testing/datos-deteccion.js';
import { ParesService } from '../criticidad/pares.service.js';
import { CoberturaService } from '../sucesion/cobertura.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { DeteccionService } from './deteccion.service.js';
import { TableroController } from './tablero.controller.js';
import { TableroService } from './tablero.service.js';

describe('RF21: Tablero de riesgo (integración)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let datos: DatosDeteccion;
  let servicio: TableroService;
  let controlador: TableroController;

  const sesionGlobal: SesionUsuario = {
    id: 1,
    nombreUsuario: 'rrhh',
    rol: 'recursos_humanos',
    idPersona: null,
    unidades: [],
  };

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    datos = await cargarDatosDeDeteccion(ds);
    const alcance = new AlcanceService(ds);
    const deteccion = new DeteccionService(ds, alcance);
    const pares = new ParesService(ds, alcance);
    const cobertura = new CoberturaService(ds, alcance);
    servicio = new TableroService(ds, alcance, deteccion, pares, cobertura);
    controlador = new TableroController(servicio);
  }, 60000);

  afterAll(async () => {
    await base?.destruir();
  });

  it('devuelve las cifras esperadas para todo el departamento con meses = 24', async () => {
    const res = await controlador.tablero({ meses: 24 }, sesionGlobal);

    expect(res.puntosUnicosFalla).toEqual({
      unicoPoseedor: 1,
      sinPoseedor: 2,
    });
    expect(res.catedras).toEqual({
      unaPersona: 2,
      sinDotacion: 1,
    });
    expect(res.puestosSinSucesor.total).toBe(5);
    expect(res.puestosSinSucesor.porMotivo).toEqual(
      expect.arrayContaining([
        { motivo: 'sin_plan', cantidad: 2 },
        { motivo: 'ningun_candidato_cubre', cantidad: 2 },
        { motivo: 'plan_en_elaboracion', cantidad: 1 },
      ]),
    );
    expect(res.candidatosConBrecha).toBe(2);
    expect(res.horizonte).toEqual({
      meses: 24,
      conocimientos: 1,
    });

    // Puntos únicos por cátedra: K2 en C1
    expect(res.graficos.puntosUnicosPorCatedra).toEqual([
      {
        idUnidad: datos.catedra.C1,
        denominacion: 'Cátedra 1',
        cantidad: 1,
      },
    ]);

    // Retiros por semestre: Beto se retira en hoy + 10 meses (K1 y K6)
    const filaSemestre = await ds.query(
      `SELECT EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '10 months'))::int || '-S' ||
              CASE WHEN EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '10 months')) <= 6 THEN '1' ELSE '2' END AS semestre`,
    );
    const semestreEsperado = filaSemestre[0].semestre as string;
    expect(res.graficos.retirosPorSemestre).toEqual([
      {
        semestre: semestreEsperado,
        cantidad: 2,
      },
    ]);

    // Calidad de datos
    expect(res.calidadDeDatos.criticidad.total).toBeGreaterThan(0);
    expect(res.calidadDeDatos.criticidad.evaluados).toBe(
      res.calidadDeDatos.criticidad.total,
    );
    expect(res.calidadDeDatos.planes.criticos).toBe(6);
    expect(res.calidadDeDatos.planes.conPlan).toBe(3);
    expect(res.calidadDeDatos.acreditacion.total).toBeGreaterThan(0);
    expect(res.calidadDeDatos.acreditacion.acreditados).toBeLessThan(
      res.calidadDeDatos.acreditacion.total,
    );
  });

  it('filtra todas las cifras al pasar idUnidad de C2', async () => {
    const res = await controlador.tablero(
      { idUnidad: datos.catedra.C2, meses: 24 },
      sesionGlobal,
    );

    expect(res.puntosUnicosFalla).toEqual({
      unicoPoseedor: 0,
      sinPoseedor: 1,
    });
    expect(res.catedras).toEqual({
      unaPersona: 0,
      sinDotacion: 0,
    });
    expect(res.puestosSinSucesor.total).toBe(1);
    expect(res.puestosSinSucesor.porMotivo).toEqual(
      expect.arrayContaining([
        { motivo: 'ningun_candidato_cubre', cantidad: 1 },
      ]),
    );
    expect(res.candidatosConBrecha).toBe(2);
    expect(res.horizonte).toEqual({
      meses: 24,
      conocimientos: 1,
    });
    expect(res.graficos.puntosUnicosPorCatedra).toEqual([]);
    expect(res.graficos.retirosPorSemestre).toHaveLength(1);
    expect(res.graficos.retirosPorSemestre[0].cantidad).toBe(1);
  });

  it('rechaza con 403 cuando un rol no global consulta el controlador del tablero', async () => {
    const sesionJefe: SesionUsuario = {
      id: 2,
      nombreUsuario: 'jefe_c2',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Beto,
      unidades: [datos.catedra.C2],
    };

    await expect(controlador.tablero({}, sesionJefe)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
