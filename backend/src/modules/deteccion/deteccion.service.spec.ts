import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { DeteccionService } from './deteccion.service.js';

describe('DeteccionService', () => {
  let servicio: DeteccionService;
  let ds: { query: ReturnType<typeof vi.fn> };
  let alcance: { unidadesVisibles: ReturnType<typeof vi.fn> };

  const sesion: SesionUsuario = {
    id: 1,
    nombreUsuario: 'admin',
    rol: 'recursos_humanos',
    idPersona: null,
    unidades: [],
  };

  beforeEach(() => {
    ds = { query: vi.fn() };
    alcance = { unidadesVisibles: vi.fn().mockResolvedValue(null) };
    servicio = new DeteccionService(
      ds as unknown as DataSource,
      alcance as unknown as AlcanceService,
    );
  });

  describe('puntosUnicosFalla (RF16)', () => {
    it('pasa unidadesVisibles y idUnidad al SQL y separa las listas en unicoPoseedor y sinPoseedor', async () => {
      alcance.unidadesVisibles.mockResolvedValue([10, 11]);

      const filasSimuladas = [
        {
          id_conocimiento: 1,
          denominacion: 'Conocimiento K2',
          nivel_requerido: 'Avanzado',
          cantidad_poseedores: 1,
          id_persona: 100,
          apellido: 'Pérez',
          nombre: 'Ana',
          en_alcance: true,
          puestos_en_alcance: [
            {
              idPuesto: 1,
              codigo: 'P-1',
              denominacion: 'C1.jefe',
              idUnidad: 10,
            },
          ],
          puestos_fuera_de_alcance: 1,
        },
        {
          id_conocimiento: 2,
          denominacion: 'Conocimiento K4',
          nivel_requerido: 'Intermedio',
          cantidad_poseedores: 0,
          id_persona: null,
          apellido: null,
          nombre: null,
          en_alcance: true,
          puestos_en_alcance: [
            {
              idPuesto: 2,
              codigo: 'P-2',
              denominacion: 'C2.jefe',
              idUnidad: 11,
            },
          ],
          puestos_fuera_de_alcance: 0,
        },
      ];

      ds.query.mockResolvedValue(filasSimuladas);

      const resultado = await servicio.puntosUnicosFalla(
        { idUnidad: 10 },
        sesion,
      );

      expect(alcance.unidadesVisibles).toHaveBeenCalledWith(sesion);
      expect(ds.query).toHaveBeenCalledWith(expect.any(String), [[10, 11], 10]);

      expect(resultado.unicoPoseedor).toHaveLength(1);
      expect(resultado.unicoPoseedor[0]).toEqual({
        idConocimiento: 1,
        denominacion: 'Conocimiento K2',
        nivelRequerido: 'Avanzado',
        cantidadPoseedores: 1,
        poseedor: {
          idPersona: 100,
          apellido: 'Pérez',
          nombre: 'Ana',
        },
        puestosCriticos: [
          { idPuesto: 1, codigo: 'P-1', denominacion: 'C1.jefe', idUnidad: 10 },
        ],
        puestosFueraDeAlcance: 1,
      });

      expect(resultado.sinPoseedor).toHaveLength(1);
      expect(resultado.sinPoseedor[0].poseedor).toBeNull();
      expect(resultado.sinPoseedor[0].cantidadPoseedores).toBe(0);
    });

    it('enmascara a la persona poseedora cuando en_alcance es falso', async () => {
      const filasSimuladas = [
        {
          id_conocimiento: 1,
          denominacion: 'Conocimiento K2',
          nivel_requerido: 'Avanzado',
          cantidad_poseedores: 1,
          id_persona: 100,
          apellido: 'Pérez',
          nombre: 'Ana',
          en_alcance: false,
          puestos_en_alcance: [
            {
              idPuesto: 1,
              codigo: 'P-1',
              denominacion: 'C1.jefe',
              idUnidad: 10,
            },
          ],
          puestos_fuera_de_alcance: 0,
        },
      ];

      ds.query.mockResolvedValue(filasSimuladas);

      const resultado = await servicio.puntosUnicosFalla({}, sesion);

      expect(resultado.unicoPoseedor).toHaveLength(1);
      expect(resultado.unicoPoseedor[0].poseedor).toBeNull();
    });
  });

  describe('catedrasUnaPersona (RF17)', () => {
    it('filtra por unidades visibles y enmascara persona si en_alcance es falso', async () => {
      alcance.unidadesVisibles.mockResolvedValue([10]);
      ds.query.mockResolvedValue([
        {
          id_unidad: 10,
          denominacion: 'Cátedra 1',
          cantidad_personas: 1,
          cantidad_ocupaciones: 2,
          id_persona: 100,
          apellido: 'Pérez',
          nombre: 'Ana',
          en_alcance: false,
        },
        {
          id_unidad: 15,
          denominacion: 'Cátedra 5',
          cantidad_personas: 0,
          cantidad_ocupaciones: 0,
          id_persona: null,
          apellido: null,
          nombre: null,
          en_alcance: true,
        },
      ]);

      const res = await servicio.catedrasUnaPersona({ idUnidad: 10 }, sesion);

      expect(ds.query).toHaveBeenCalledWith(expect.any(String), [[10], 10]);
      expect(res.unaPersona).toHaveLength(1);
      expect(res.unaPersona[0]).toEqual({
        idUnidad: 10,
        denominacion: 'Cátedra 1',
        cantidadPersonas: 1,
        cantidadCargos: 2,
        persona: null,
      });
      expect(res.sinDotacion).toHaveLength(1);
      expect(res.sinDotacion[0]).toEqual({
        idUnidad: 15,
        denominacion: 'Cátedra 5',
        cantidadPersonas: 0,
        cantidadCargos: 0,
        persona: null,
      });
    });
  });

  describe('puestosSinSucesor (RF18)', () => {
    it('pasa unidadesVisibles, idUnidad y motivo al SQL y mapea las filas', async () => {
      alcance.unidadesVisibles.mockResolvedValue([10, 12]);
      ds.query.mockResolvedValue([
        {
          id_puesto: 3,
          codigo: 'P-C2-JEF',
          denominacion: 'C2.jefe',
          id_unidad: 12,
          motivo: 'ningun_candidato_cubre',
          id_plan: 50,
          candidatos_total: 2,
          candidatos_validos: 2,
        },
      ]);

      const res = await servicio.puestosSinSucesor(
        { idUnidad: 12, motivo: 'ningun_candidato_cubre' },
        sesion,
      );

      expect(ds.query).toHaveBeenCalledWith(expect.any(String), [
        [10, 12],
        12,
        'ningun_candidato_cubre',
      ]);
      expect(res).toEqual([
        {
          idPuesto: 3,
          codigo: 'P-C2-JEF',
          denominacion: 'C2.jefe',
          idUnidad: 12,
          motivo: 'ningun_candidato_cubre',
          idPlan: 50,
          candidatosTotal: 2,
          candidatosValidos: 2,
        },
      ]);
    });
  });

  describe('horizonteRiesgo (RF20)', () => {
    it('calcula quedan, filtra quedan <= 1 por defecto y enmascara retiros fuera de alcance', async () => {
      ds.query.mockResolvedValue([
        {
          id_conocimiento: 1,
          denominacion: 'Conocimiento K1',
          nivel_requerido: 'Avanzado',
          cantidad_poseedores: 2,
          id_persona: 10,
          apellido: 'García',
          nombre: 'Beto',
          fecha_prevista_retiro: '2027-08-18',
          en_alcance: false,
          puestos_en_alcance: [
            {
              idPuesto: 7,
              codigo: 'P-C4-AUX',
              denominacion: 'C4.aux',
              idUnidad: 14,
            },
          ],
          puestos_fuera_de_alcance: 1,
        },
        {
          id_conocimiento: 6,
          denominacion: 'Conocimiento K6',
          nivel_requerido: 'Avanzado',
          cantidad_poseedores: 3,
          id_persona: 10,
          apellido: 'García',
          nombre: 'Beto',
          fecha_prevista_retiro: '2027-08-18',
          en_alcance: true,
          puestos_en_alcance: [
            {
              idPuesto: 1,
              codigo: 'P-C1-JEF',
              denominacion: 'C1.jefe',
              idUnidad: 11,
            },
          ],
          puestos_fuera_de_alcance: 0,
        },
      ]);

      const porDefecto = await servicio.horizonteRiesgo({}, sesion);
      expect(porDefecto.meses).toBe(24);
      expect(porDefecto.conocimientos).toHaveLength(1);
      expect(porDefecto.conocimientos[0]).toEqual({
        idConocimiento: 1,
        denominacion: 'Conocimiento K1',
        nivelRequerido: 'Avanzado',
        cantidadPoseedores: 2,
        quedan: 1,
        retiros: [
          {
            idPersona: null,
            apellido: null,
            nombre: null,
            fechaPrevistaRetiro: null,
          },
        ],
        puestosCriticos: [
          {
            idPuesto: 7,
            codigo: 'P-C4-AUX',
            denominacion: 'C4.aux',
            idUnidad: 14,
          },
        ],
        puestosFueraDeAlcance: 1,
      });

      const conTodos = await servicio.horizonteRiesgo(
        { meses: 36, incluirConDosOMas: true },
        sesion,
      );
      expect(conTodos.meses).toBe(36);
      expect(conTodos.conocimientos).toHaveLength(2);
      expect(conTodos.conocimientos[1].quedan).toBe(2);
    });
  });
});
