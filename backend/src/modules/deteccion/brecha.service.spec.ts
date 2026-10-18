import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { DeteccionService } from './deteccion.service.js';

describe('DeteccionService - Brecha de perfil (RF19)', () => {
  let servicio: DeteccionService;
  let ds: { query: ReturnType<typeof vi.fn> };
  let alcance: { unidadesVisibles: ReturnType<typeof vi.fn> };

  const sesionJefatura: SesionUsuario = {
    id: 1,
    nombreUsuario: 'jefe',
    rol: 'jefatura_departamento',
    idPersona: 10,
    unidades: [1],
  };

  beforeEach(() => {
    ds = { query: vi.fn() };
    alcance = { unidadesVisibles: vi.fn().mockResolvedValue([1, 2]) };
    servicio = new DeteccionService(
      ds as unknown as DataSource,
      alcance as unknown as AlcanceService,
    );
  });

  it('arma el resumen contando excluyentes y deseables cubiertos y totales por separado, y nivelAcreditado nulo cuando no está acreditado', async () => {
    ds.query.mockResolvedValue([
      {
        contexto: 'candidato',
        id_persona: 20,
        apellido: 'Rodríguez',
        nombre: 'Carla',
        id_puesto: 3,
        denominacion_puesto: 'C2.jefe',
        id_plan: 5,
        estado_plan: 'borrador',
        a_revisar: false,
        id_conocimiento: 1,
        denominacion_conocimiento: 'Conocimiento K1',
        es_excluyente: true,
        nivel_requerido: 'Avanzado',
        nivel_acreditado: 'Avanzado',
        nivel_declarado: null,
        faltante: 0,
        cubierto: true,
      },
      {
        contexto: 'candidato',
        id_persona: 20,
        apellido: 'Rodríguez',
        nombre: 'Carla',
        id_puesto: 3,
        denominacion_puesto: 'C2.jefe',
        id_plan: 5,
        estado_plan: 'borrador',
        a_revisar: false,
        id_conocimiento: 4,
        denominacion_conocimiento: 'Conocimiento K4',
        es_excluyente: true,
        nivel_requerido: 'Intermedio',
        nivel_acreditado: null,
        nivel_declarado: null,
        faltante: 2,
        cubierto: false,
      },
      {
        contexto: 'candidato',
        id_persona: 20,
        apellido: 'Rodríguez',
        nombre: 'Carla',
        id_puesto: 3,
        denominacion_puesto: 'C2.jefe',
        id_plan: 5,
        estado_plan: 'borrador',
        a_revisar: false,
        id_conocimiento: 7,
        denominacion_conocimiento: 'Conocimiento K7',
        es_excluyente: false,
        nivel_requerido: 'Intermedio',
        nivel_acreditado: 'Experto',
        nivel_declarado: null,
        faltante: 0,
        cubierto: true,
      },
    ]);

    const res = await servicio.brecha({ idPersona: 20 }, sesionJefatura);

    expect(res).toHaveLength(1);
    expect(res[0].estadoPlan).toBe('borrador');
    expect(res[0].resumen).toEqual({
      excluyentesCubiertos: 1,
      excluyentesTotal: 2,
      deseablesCubiertos: 1,
      deseablesTotal: 1,
    });
    expect(res[0].conocimientos[1].nivelAcreditado).toBeNull();
    expect(res[0].conocimientos[1].cubierto).toBe(false);
  });

  it('rechaza con 403 al rol docente en brecha general', async () => {
    const sesionDocente: SesionUsuario = {
      id: 2,
      nombreUsuario: 'docente',
      rol: 'docente',
      idPersona: 30,
      unidades: [],
    };

    await expect(servicio.brecha({}, sesionDocente)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza BadRequestException en miBrecha si la sesión no tiene persona vinculada', async () => {
    const sesionSinPersona: SesionUsuario = {
      id: 3,
      nombreUsuario: 'docente_sin_persona',
      rol: 'docente',
      idPersona: null,
      unidades: [],
    };

    await expect(servicio.miBrecha(sesionSinPersona)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('miBrecha descarta candidaturas de planes que no están aprobados e incluye nivelDeclarado', async () => {
    ds.query.mockResolvedValue([
      {
        contexto: 'candidato',
        id_persona: 10,
        apellido: 'Martínez',
        nombre: 'Eva',
        id_puesto: 6,
        denominacion_puesto: 'C4.jefe',
        id_plan: 8,
        estado_plan: 'aprobado',
        a_revisar: false,
        id_conocimiento: 3,
        denominacion_conocimiento: 'Conocimiento K3',
        es_excluyente: true,
        nivel_requerido: 'Intermedio',
        nivel_acreditado: 'Intermedio',
        nivel_declarado: 'Avanzado',
        faltante: 0,
        cubierto: true,
      },
      {
        contexto: 'candidato',
        id_persona: 10,
        apellido: 'Martínez',
        nombre: 'Eva',
        id_puesto: 7,
        denominacion_puesto: 'C4.aux',
        id_plan: 9,
        estado_plan: 'borrador',
        a_revisar: false,
        id_conocimiento: 5,
        denominacion_conocimiento: 'Conocimiento K5',
        es_excluyente: true,
        nivel_requerido: 'Intermedio',
        nivel_acreditado: null,
        nivel_declarado: 'Intermedio',
        faltante: 2,
        cubierto: false,
      },
    ]);

    const res = await servicio.miBrecha(sesionJefatura);
    expect(res).toHaveLength(1);
    expect(res[0].idPuesto).toBe(6);
    expect(res[0].conocimientos[0].nivelDeclarado).toBe('Avanzado');
  });
});
