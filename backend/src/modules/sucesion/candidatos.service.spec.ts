import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { CandidatosService } from './candidatos.service.js';
import type { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { aCandidatoDto } from './sucesion.mapper.js';

const ESTADOS = [
  { id: 1, codigo: 'borrador' },
  { id: 2, codigo: 'pendiente_aprobacion' },
  { id: 3, codigo: 'aprobado' },
  { id: 4, codigo: 'rechazado' },
  { id: 5, codigo: 'cerrado' },
];
const idDe = (codigo: string) => ESTADOS.find((e) => e.codigo === codigo)!.id;
const jefatura: SesionUsuario = {
  id: 7,
  nombreUsuario: 'jefa',
  rol: 'jefatura_departamento',
  idPersona: null,
  unidades: [10],
};

type Cand = {
  idPlan: number;
  idPersona: number;
  idEstadoPreparacion: number;
  prioridad: number;
  fechaDisponibilidadEstimada: string | null;
  observaciones: string | null;
};
const cand = (idPersona: number, prioridad: number): Cand => ({
  idPlan: 1,
  idPersona,
  idEstadoPreparacion: 1,
  prioridad,
  fechaDisponibilidadEstimada: null,
  observaciones: null,
});

function crearEntorno(
  opciones: {
    estadoPlan?: string;
    plan?: boolean;
    persona?: { id: number; activo: boolean } | null;
    /** Resultado de la consulta de ocupaciones de la persona. */
    ocupacion?: { ocupa_puesto: boolean; tiene_ocupacion: boolean };
    preparacion?: { id: number; activo: boolean } | null;
    candidatos?: Cand[];
    fueraDeAlcance?: boolean;
  } = {},
) {
  const candidatos = opciones.candidatos ?? [];
  const plan =
    opciones.plan === false
      ? null
      : {
          id: 1,
          idPuesto: 1,
          idEstadoPlan: idDe(opciones.estadoPlan ?? 'borrador'),
        };
  const persona =
    opciones.persona === undefined ? { id: 5, activo: true } : opciones.persona;
  const preparacion =
    opciones.preparacion === undefined
      ? { id: 2, activo: true }
      : opciones.preparacion;
  const ocupacion = opciones.ocupacion ?? {
    ocupa_puesto: false,
    tiene_ocupacion: true,
  };
  const consultas: string[] = [];

  const repoCandidatos = {
    findOne: vi.fn(
      async ({ where }: { where: { idPlan: number; idPersona: number } }) =>
        candidatos.find(
          (c) => c.idPlan === where.idPlan && c.idPersona === where.idPersona,
        ) ?? null,
    ),
    find: vi.fn(async () => candidatos.map((c) => ({ ...c }))),
    create: vi.fn((d: object) => ({ ...d })),
    save: vi.fn(async (d: unknown) => d),
    remove: vi.fn(async (d: unknown) => d),
  };
  const repos: Record<string, unknown> = {
    PlanSucesion: { findOne: vi.fn(async () => plan) },
    CandidatoSucesion: repoCandidatos,
    Puesto: { findOne: vi.fn(async () => ({ id: 1, idUnidad: 10 })) },
    Persona: { findOne: vi.fn(async () => persona) },
    EstadoPlan: { find: vi.fn(async () => ESTADOS) },
    EstadoPreparacion: { findOne: vi.fn(async () => preparacion) },
  };
  const manager = {
    query: vi.fn(async (sql: string) => {
      consultas.push(sql);
      if (sql.includes('ocupa_puesto')) return [ocupacion];
      if (sql.includes('excluyentes_sin_cubrir')) {
        return candidatos.map((c) => ({
          id_plan: c.idPlan,
          id_persona: c.idPersona,
          apellido: 'Paz',
          nombre: 'Ana',
          estado_preparacion: 'en_formacion',
          prioridad: c.prioridad,
          fecha_disponibilidad_estimada: null,
          observaciones: null,
          excluyentes_sin_cubrir: 0,
          total_excluyentes: 0,
          a_revisar: false,
        }));
      }
      return [];
    }),
    getRepository: (entidad: { name: string }) => repos[entidad.name],
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoCandidatos as unknown as { manager: unknown }).manager = manager;
  const alcance = {
    exigirUnidad: vi.fn(async () => {
      if (opciones.fueraDeAlcance) throw new ForbiddenException('fuera');
    }),
  };
  const servicio = new CandidatosService(
    repoCandidatos as unknown as Repository<CandidatoSucesion>,
    alcance as unknown as AlcanceService,
  );
  return { servicio, repoCandidatos, consultas };
}

const alta = { idPersona: 5, prioridad: 1, idEstadoPreparacion: 2 };

describe('CandidatosService.agregar', () => {
  it('plan inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ plan: false });
    await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('fuera de alcance: ForbiddenException', async () => {
    const { servicio } = crearEntorno({ fueraDeAlcance: true });
    await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('plan fuera de borrador: ConflictException', async () => {
    for (const estado of [
      'pendiente_aprobacion',
      'aprobado',
      'rechazado',
      'cerrado',
    ]) {
      const { servicio } = crearEntorno({ estadoPlan: estado });
      await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
        ConflictException,
      );
    }
  });
  it('persona inexistente o inactiva: BadRequestException', async () => {
    for (const persona of [null, { id: 5, activo: false }]) {
      const { servicio } = crearEntorno({ persona });
      await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
        BadRequestException,
      );
    }
  });
  it('persona sin ocupación vigente: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      ocupacion: { ocupa_puesto: false, tiene_ocupacion: false },
    });
    await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('ocupante vigente del puesto: ConflictException', async () => {
    const { servicio } = crearEntorno({
      ocupacion: { ocupa_puesto: true, tiene_ocupacion: true },
    });
    await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('ya candidata del plan: ConflictException', async () => {
    const { servicio } = crearEntorno({ candidatos: [cand(5, 1)] });
    await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('estado de preparación inexistente o inactivo: BadRequestException', async () => {
    for (const preparacion of [null, { id: 2, activo: false }]) {
      const { servicio } = crearEntorno({ preparacion });
      await expect(servicio.agregar(1, alta, jefatura)).rejects.toThrow(
        BadRequestException,
      );
    }
  });
  it('caso feliz: guarda con save() y devuelve el candidato', async () => {
    const { servicio, repoCandidatos } = crearEntorno({
      candidatos: [cand(5, 1)],
    });
    // 5 ya figura en la lista simulada final, pero antes de agregar no era candidata
    repoCandidatos.findOne.mockResolvedValueOnce(null);
    const dto = await servicio.agregar(
      1,
      { ...alta, observaciones: 'x' },
      jefatura,
    );
    expect(repoCandidatos.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idPlan: 1,
        idPersona: 5,
        prioridad: 1,
        idEstadoPreparacion: 2,
        observaciones: 'x',
        fechaDisponibilidadEstimada: null,
      }),
    );
    expect(dto).toMatchObject({ idPlan: 1, idPersona: 5 });
  });
});

describe('CandidatosService.seguimiento', () => {
  it('funciona en borrador y aprobado, y guarda con save()', async () => {
    for (const estado of ['borrador', 'aprobado']) {
      const { servicio, repoCandidatos } = crearEntorno({
        estadoPlan: estado,
        candidatos: [cand(5, 1)],
      });
      await servicio.seguimiento(
        1,
        5,
        { observaciones: 'avanza', fechaDisponibilidadEstimada: '2027-01-01' },
        jefatura,
      );
      expect(repoCandidatos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          idPersona: 5,
          observaciones: 'avanza',
          fechaDisponibilidadEstimada: '2027-01-01',
        }),
      );
    }
  });
  it('la fecha null la borra', async () => {
    const { servicio, repoCandidatos } = crearEntorno({
      candidatos: [
        { ...cand(5, 1), fechaDisponibilidadEstimada: '2027-01-01' },
      ],
    });
    await servicio.seguimiento(
      1,
      5,
      { fechaDisponibilidadEstimada: null },
      jefatura,
    );
    expect(repoCandidatos.save).toHaveBeenCalledWith(
      expect.objectContaining({ fechaDisponibilidadEstimada: null }),
    );
  });
  it('pendiente_aprobacion, rechazado o cerrado: ConflictException', async () => {
    for (const estado of ['pendiente_aprobacion', 'rechazado', 'cerrado']) {
      const { servicio } = crearEntorno({
        estadoPlan: estado,
        candidatos: [cand(5, 1)],
      });
      await expect(
        servicio.seguimiento(1, 5, { observaciones: 'x' }, jefatura),
      ).rejects.toThrow(ConflictException);
    }
  });
  it('candidato inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno();
    await expect(
      servicio.seguimiento(1, 5, { observaciones: 'x' }, jefatura),
    ).rejects.toThrow(NotFoundException);
  });
  it('estado de preparación inactivo: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      candidatos: [cand(5, 1)],
      preparacion: { id: 2, activo: false },
    });
    await expect(
      servicio.seguimiento(1, 5, { idEstadoPreparacion: 2 }, jefatura),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('CandidatosService.quitar', () => {
  it('en borrador quita con remove()', async () => {
    const { servicio, repoCandidatos } = crearEntorno({
      candidatos: [cand(5, 1)],
    });
    await servicio.quitar(1, 5, jefatura);
    expect(repoCandidatos.remove).toHaveBeenCalledWith(
      expect.objectContaining({ idPersona: 5 }),
    );
  });
  it('fuera de borrador: ConflictException', async () => {
    for (const estado of ['pendiente_aprobacion', 'aprobado', 'cerrado']) {
      const { servicio } = crearEntorno({
        estadoPlan: estado,
        candidatos: [cand(5, 1)],
      });
      await expect(servicio.quitar(1, 5, jefatura)).rejects.toThrow(
        ConflictException,
      );
    }
  });
  it('candidato inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.quitar(1, 5, jefatura)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('CandidatosService.reordenar', () => {
  const tres = [cand(5, 1), cand(6, 2), cand(7, 3)];

  it('difiere la restricción y guarda cada candidato con save()', async () => {
    const { servicio, repoCandidatos, consultas } = crearEntorno({
      candidatos: tres,
    });
    await servicio.reordenar(1, { orden: [6, 5, 7] }, jefatura);
    expect(consultas[0]).toMatch(/pg_advisory_xact_lock|SET CONSTRAINTS/);
    expect(
      consultas.some((c) =>
        c.includes(
          'SET CONSTRAINTS "UQ_candidato_sucesion_prioridad" DEFERRED',
        ),
      ),
    ).toBe(true);
    const guardados = repoCandidatos.save.mock.calls.map(([c]) => c as Cand);
    expect(
      Object.fromEntries(guardados.map((c) => [c.idPersona, c.prioridad])),
    ).toEqual({ 5: 2, 6: 1, 7: 3 });
  });
  it('fuera de borrador: ConflictException', async () => {
    for (const estado of ['pendiente_aprobacion', 'aprobado', 'cerrado']) {
      const { servicio } = crearEntorno({
        estadoPlan: estado,
        candidatos: tres,
      });
      await expect(
        servicio.reordenar(1, { orden: [5, 6, 7] }, jefatura),
      ).rejects.toThrow(ConflictException);
    }
  });
  it('ids repetidos, faltantes o ajenos: BadRequestException', async () => {
    for (const orden of [
      [5, 5, 7],
      [5, 6],
      [5, 6, 7, 8],
      [5, 6, 99],
    ]) {
      const { servicio } = crearEntorno({ candidatos: tres });
      await expect(servicio.reordenar(1, { orden }, jefatura)).rejects.toThrow(
        BadRequestException,
      );
    }
  });
});

describe('aCandidatoDto', () => {
  const fila = (estado: string, sinCubrir: number, total = 2) => ({
    id_plan: 1,
    id_persona: 5,
    apellido: 'Paz',
    nombre: 'Ana',
    estado_preparacion: estado,
    prioridad: 1,
    fecha_disponibilidad_estimada: null,
    observaciones: null,
    excluyentes_sin_cubrir: sinCubrir,
    total_excluyentes: total,
    a_revisar: false,
  });
  it('discrepancia = (listo_ahora) distinto de (sin excluyentes sin cubrir)', () => {
    expect(aCandidatoDto(fila('listo_ahora', 0)).discrepancia).toBe(false);
    expect(aCandidatoDto(fila('listo_ahora', 1)).discrepancia).toBe(true);
    expect(aCandidatoDto(fila('en_formacion', 0)).discrepancia).toBe(true);
    expect(aCandidatoDto(fila('en_formacion', 1)).discrepancia).toBe(false);
  });
  it('sin requisitos excluyentes no hay discrepancia posible', () => {
    for (const estado of ['listo_ahora', 'en_formacion']) {
      expect(aCandidatoDto(fila(estado, 0, 0)).discrepancia).toBe(false);
    }
  });
  it('mapea los campos', () => {
    expect(aCandidatoDto(fila('en_formacion', 1))).toMatchObject({
      idPlan: 1,
      idPersona: 5,
      apellido: 'Paz',
      estadoPreparacion: 'en_formacion',
      excluyentesSinCubrir: 1,
      totalExcluyentes: 2,
      aRevisar: false,
    });
  });
});
