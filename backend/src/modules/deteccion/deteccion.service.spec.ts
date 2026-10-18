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
});
