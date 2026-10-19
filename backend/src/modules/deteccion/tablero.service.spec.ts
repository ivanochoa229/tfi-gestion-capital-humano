import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ParesService } from '../criticidad/pares.service.js';
import type { CoberturaService } from '../sucesion/cobertura.service.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { DeteccionService } from './deteccion.service.js';
import { TableroService } from './tablero.service.js';

describe('TableroService (RF21)', () => {
  let servicio: TableroService;
  let ds: { query: ReturnType<typeof vi.fn> };
  let alcance: { unidadesVisibles: ReturnType<typeof vi.fn> };
  let deteccion: {
    puntosUnicosFalla: ReturnType<typeof vi.fn>;
    catedrasUnaPersona: ReturnType<typeof vi.fn>;
    puestosSinSucesor: ReturnType<typeof vi.fn>;
    horizonteRiesgo: ReturnType<typeof vi.fn>;
    brecha: ReturnType<typeof vi.fn>;
  };
  let pares: { avance: ReturnType<typeof vi.fn> };
  let cobertura: { cobertura: ReturnType<typeof vi.fn> };

  const sesionGlobal: SesionUsuario = {
    id: 1,
    nombreUsuario: 'rrhh',
    rol: 'recursos_humanos',
    idPersona: null,
    unidades: [],
  };

  beforeEach(() => {
    ds = { query: vi.fn().mockResolvedValue([]) };
    alcance = { unidadesVisibles: vi.fn().mockResolvedValue(null) };
    deteccion = {
      puntosUnicosFalla: vi.fn().mockResolvedValue({
        unicoPoseedor: [{ idConocimiento: 2 }],
        sinPoseedor: [{ idConocimiento: 4 }, { idConocimiento: 5 }],
      }),
      catedrasUnaPersona: vi.fn().mockResolvedValue({
        unaPersona: [{ idUnidad: 1 }, { idUnidad: 3 }],
        sinDotacion: [{ idUnidad: 5 }],
      }),
      puestosSinSucesor: vi.fn().mockResolvedValue([
        { idPuesto: 1, motivo: 'sin_plan' },
        { idPuesto: 2, motivo: 'sin_plan' },
        { idPuesto: 3, motivo: 'ningun_candidato_cubre' },
        { idPuesto: 7, motivo: 'plan_en_elaboracion' },
      ]),
      horizonteRiesgo: vi.fn().mockResolvedValue({
        meses: 36,
        conocimientos: [{ idConocimiento: 1 }, { idConocimiento: 3 }],
      }),
      brecha: vi.fn().mockResolvedValue([
        {
          contexto: 'candidato',
          idPersona: 10,
          estadoPlan: 'aprobado',
          resumen: {
            excluyentesCubiertos: 1,
            excluyentesTotal: 2,
            deseablesCubiertos: 0,
            deseablesTotal: 0,
          },
          conocimientos: [],
        },
        {
          contexto: 'candidato',
          idPersona: 10,
          estadoPlan: 'aprobado',
          resumen: {
            excluyentesCubiertos: 0,
            excluyentesTotal: 1,
            deseablesCubiertos: 0,
            deseablesTotal: 0,
          },
          conocimientos: [],
        },
        {
          contexto: 'ocupante',
          idPersona: 20,
          estadoPlan: null,
          resumen: {
            excluyentesCubiertos: 1,
            excluyentesTotal: 1,
            deseablesCubiertos: 0,
            deseablesTotal: 1,
          },
          conocimientos: [
            { nivelAcreditado: 'Avanzado' },
            { nivelAcreditado: null },
          ],
        },
      ]),
    };
    pares = {
      avance: vi.fn().mockResolvedValue({ evaluados: 9, total: 11 }),
    };
    cobertura = {
      cobertura: vi
        .fn()
        .mockResolvedValue({ criticos: 6, conPlan: 3, sinPlan: [] }),
    };

    servicio = new TableroService(
      ds as unknown as DataSource,
      alcance as unknown as AlcanceService,
      deteccion as unknown as DeteccionService,
      pares as unknown as ParesService,
      cobertura as unknown as CoberturaService,
    );
  });

  it('consolida las cifras de DeteccionService y toma avance y cobertura para calidadDeDatos', async () => {
    const res = await servicio.tablero(
      { idUnidad: 10, meses: 36 },
      sesionGlobal,
    );

    expect(deteccion.puntosUnicosFalla).toHaveBeenCalledWith(
      { idUnidad: 10 },
      sesionGlobal,
    );
    expect(deteccion.horizonteRiesgo).toHaveBeenCalledWith(
      { idUnidad: 10, meses: 36 },
      sesionGlobal,
    );
    expect(pares.avance).toHaveBeenCalledWith({ idUnidad: 10 }, sesionGlobal);
    expect(cobertura.cobertura).toHaveBeenCalledWith(
      { idUnidad: 10 },
      sesionGlobal,
    );

    expect(res.puntosUnicosFalla).toEqual({ unicoPoseedor: 1, sinPoseedor: 2 });
    expect(res.catedras).toEqual({ unaPersona: 2, sinDotacion: 1 });
    expect(res.puestosSinSucesor).toEqual({
      total: 4,
      porMotivo: [
        { motivo: 'sin_plan', cantidad: 2 },
        { motivo: 'plan_en_elaboracion', cantidad: 1 },
        { motivo: 'ningun_candidato_cubre', cantidad: 1 },
      ],
    });
    //Persona 10 aparece en dos planes pero cuenta como 1 candidato distinto
    expect(res.candidatosConBrecha).toBe(1);
    expect(res.horizonte).toEqual({ meses: 36, conocimientos: 2 });
    expect(res.calidadDeDatos).toEqual({
      criticidad: { evaluados: 9, total: 11 },
      planes: { criticos: 6, conPlan: 3 },
      acreditacion: { acreditados: 1, total: 2 },
    });
  });

  it('rechaza con 403 a un rol que no es global', async () => {
    const sesionJefatura: SesionUsuario = {
      id: 2,
      nombreUsuario: 'jefe',
      rol: 'jefatura_departamento',
      idPersona: 10,
      unidades: [1],
    };

    await expect(servicio.tablero({}, sesionJefatura)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
