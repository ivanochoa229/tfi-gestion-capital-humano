import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { PlanSucesion } from './entities/plan-sucesion.entity.js';
import type { AccionesService } from './acciones.service.js';
import type { CandidatosService } from './candidatos.service.js';
import { PlanesService } from './planes.service.js';

const HOY = '2026-06-15';
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
const autoridad: SesionUsuario = {
  id: 9,
  nombreUsuario: 'decana',
  rol: 'autoridad',
  idPersona: null,
  unidades: [],
};

type Plan = Partial<PlanSucesion> & { id: number };

function crearEntorno(
  opciones: {
    puesto?: { id: number; idUnidad: number; activo: boolean } | null;
    persona?: { id: number; activo: boolean } | null;
    planes?: Plan[];
    candidatos?: object[];
    fueraDeAlcance?: boolean;
  } = {},
) {
  const puesto =
    opciones.puesto === undefined
      ? { id: 1, idUnidad: 10, activo: true }
      : opciones.puesto;
  const persona =
    opciones.persona === undefined ? { id: 5, activo: true } : opciones.persona;
  const planes: Plan[] = opciones.planes ?? [];
  const candidatos = opciones.candidatos ?? [];
  let siguiente = 100;

  const coincide = (fila: object, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([clave, valor]) => {
      const actual = (fila as Record<string, unknown>)[clave];
      const posibles = (valor as { _value?: unknown[] })?._value;
      return Array.isArray(posibles)
        ? posibles.includes(actual)
        : actual === valor;
    });
  const repoPlanes = {
    findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const p = planes.find((x) => coincide(x, where));
      return p
        ? {
            ...p,
            puesto: { ...puesto, codigo: 'P-0001', denominacion: 'Jefe' },
            responsable: { apellido: 'Paz', nombre: 'Ana' },
            estadoPlan: {
              codigo: ESTADOS.find((e) => e.id === p.idEstadoPlan)?.codigo,
            },
            usuarioResolucion: null,
          }
        : null;
    }),
    findOneOrFail: vi.fn(async (args: { where: Record<string, unknown> }) =>
      repoPlanes.findOne(args),
    ),
    find: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      planes.filter((x) => coincide(x, where)),
    ),
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        planes.filter((x) => coincide(x, where)).length,
    ),
    create: vi.fn((d: object) => ({ ...d })),
    save: vi.fn(async (d: Plan) => {
      const existente = planes.find((x) => x.id === d.id);
      if (existente) {
        Object.assign(existente, d);
        return existente;
      }
      const nuevo = { ...d, id: ++siguiente };
      planes.push(nuevo);
      return nuevo;
    }),
  };
  const repoCandidatos = {
    count: vi.fn(async () => candidatos.length),
    find: vi.fn(async () => candidatos),
    create: vi.fn((d: object) => ({ ...d })),
    save: vi.fn(async (d: unknown) => d),
  };
  const repos: Record<string, unknown> = {
    PlanSucesion: repoPlanes,
    CandidatoSucesion: repoCandidatos,
    Puesto: { findOne: vi.fn(async () => puesto) },
    Persona: { findOne: vi.fn(async () => persona) },
    EstadoPlan: { find: vi.fn(async () => ESTADOS) },
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [],
    ),
    getRepository: (entidad: { name: string }) => repos[entidad.name],
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoPlanes as unknown as { manager: unknown }).manager = manager;
  const alcance = {
    exigirUnidad: vi.fn(async () => {
      if (opciones.fueraDeAlcance) throw new ForbiddenException('fuera');
    }),
    unidadesVisibles: vi.fn<() => Promise<number[] | null>>(async () => null),
  };
  const candidatosSvc = { listarDePlan: vi.fn(async () => [{ idPersona: 5 }]) };
  const accionesSvc = { listarDePlan: vi.fn(async () => [{ id: 3 }]) };
  const servicio = new PlanesService(
    repoPlanes as unknown as Repository<PlanSucesion>,
    alcance as unknown as AlcanceService,
    candidatosSvc as unknown as CandidatosService,
    accionesSvc as unknown as AccionesService,
  );
  return {
    servicio,
    candidatosSvc,
    accionesSvc,
    planes,
    repoPlanes,
    repoCandidatos,
    alcance,
  };
}

const plan = (estado: string, extra: Partial<PlanSucesion> = {}): Plan => ({
  id: 1,
  idPuesto: 1,
  idResponsable: 5,
  idEstadoPlan: idDe(estado),
  fechaElaboracion: '2026-06-01',
  idPlanAnterior: null,
  idUsuarioResolucion: null,
  fechaResolucion: null,
  motivoResolucion: null,
  observaciones: 'obs',
  ...extra,
});

describe('PlanesService.crear', () => {
  const dto = { idPuesto: 1, idResponsable: 5 };

  it('puesto inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ puesto: null });
    await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('puesto de baja: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      puesto: { id: 1, idUnidad: 10, activo: false },
    });
    await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('responsable inexistente o inactivo: BadRequestException', async () => {
    for (const persona of [null, { id: 5, activo: false }]) {
      const { servicio } = crearEntorno({ persona });
      await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
        BadRequestException,
      );
    }
  });
  it('plan en elaboración: ConflictException', async () => {
    for (const estado of ['borrador', 'pendiente_aprobacion']) {
      const { servicio } = crearEntorno({ planes: [plan(estado)] });
      await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
        ConflictException,
      );
    }
  });
  it('plan aprobado: ConflictException que menciona «nueva versión»', async () => {
    const { servicio } = crearEntorno({ planes: [plan('aprobado')] });
    await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
      /nueva versión/,
    );
  });
  it('fuera de alcance: ForbiddenException', async () => {
    const { servicio } = crearEntorno({ fueraDeAlcance: true });
    await expect(servicio.crear(dto, jefatura)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('caso feliz: crea en borrador con la fecha de hoy y guarda con save()', async () => {
    const { servicio, repoPlanes } = crearEntorno({
      planes: [plan('cerrado')],
    });
    const creado = await servicio.crear(
      { ...dto, observaciones: 'x' },
      jefatura,
    );
    expect(repoPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idPuesto: 1,
        idResponsable: 5,
        idEstadoPlan: idDe('borrador'),
        fechaElaboracion: HOY,
        observaciones: 'x',
      }),
    );
    expect(creado.estado).toBe('borrador');
  });
});

describe('PlanesService.editar', () => {
  it('fuera de borrador: 409', async () => {
    const { servicio } = crearEntorno({
      planes: [plan('pendiente_aprobacion')],
    });
    await expect(
      servicio.editar(1, { observaciones: 'n' }, jefatura),
    ).rejects.toThrow(ConflictException);
  });
  it('en borrador guarda los cambios', async () => {
    const { servicio, repoPlanes } = crearEntorno({
      planes: [plan('borrador')],
    });
    await servicio.editar(1, { observaciones: 'n' }, jefatura);
    expect(repoPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({ observaciones: 'n' }),
    );
  });
});

describe('PlanesService.presentar', () => {
  it('sin candidatos: 409', async () => {
    const { servicio } = crearEntorno({ planes: [plan('borrador')] });
    await expect(servicio.presentar(1, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('con candidatos pasa a pendiente_aprobacion', async () => {
    const { servicio, repoPlanes } = crearEntorno({
      planes: [plan('borrador')],
      candidatos: [{ idPlan: 1, idPersona: 2 }],
    });
    await servicio.presentar(1, jefatura);
    expect(repoPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({ idEstadoPlan: idDe('pendiente_aprobacion') }),
    );
  });
});

describe('PlanesService.resolver', () => {
  it('aprobar guarda el usuario y la fecha de resolución', async () => {
    const { servicio, repoPlanes } = crearEntorno({
      planes: [plan('pendiente_aprobacion')],
    });
    await servicio.resolver(1, { decision: 'aprobar' }, autoridad);
    expect(repoPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idEstadoPlan: idDe('aprobado'),
        idUsuarioResolucion: 9,
        fechaResolucion: HOY,
      }),
    );
  });
  it('rechazar sin motivo: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      planes: [plan('pendiente_aprobacion')],
    });
    await expect(
      servicio.resolver(1, { decision: 'rechazar', motivo: '  ' }, autoridad),
    ).rejects.toThrow(BadRequestException);
  });
  it('rechazar con motivo lo guarda', async () => {
    const { servicio, repoPlanes } = crearEntorno({
      planes: [plan('pendiente_aprobacion')],
    });
    await servicio.resolver(
      1,
      { decision: 'rechazar', motivo: 'falta' },
      autoridad,
    );
    expect(repoPlanes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idEstadoPlan: idDe('rechazado'),
        motivoResolucion: 'falta',
      }),
    );
  });
  it('desde otro estado: 409', async () => {
    const { servicio } = crearEntorno({ planes: [plan('borrador')] });
    await expect(
      servicio.resolver(1, { decision: 'aprobar' }, autoridad),
    ).rejects.toThrow(ConflictException);
  });
  it('aprobar una versión nueva cierra el plan anterior aprobado, antes de aprobarla', async () => {
    const { servicio, planes, repoPlanes } = crearEntorno({
      planes: [
        plan('aprobado', { id: 1 }),
        plan('pendiente_aprobacion', { id: 2, idPlanAnterior: 1 }),
      ],
    });
    await servicio.resolver(2, { decision: 'aprobar' }, autoridad);
    expect(planes.find((p) => p.id === 1)?.idEstadoPlan).toBe(idDe('cerrado'));
    expect(planes.find((p) => p.id === 2)?.idEstadoPlan).toBe(idDe('aprobado'));
    expect(repoPlanes.save.mock.calls[0][0]).toMatchObject({ id: 1 });
  });
});

describe('PlanesService.reabrir, nuevaVersion y cerrar', () => {
  it('reabrir vale solo desde rechazado', async () => {
    const rechazado = crearEntorno({ planes: [plan('rechazado')] });
    await rechazado.servicio.reabrir(1, jefatura);
    expect(rechazado.planes[0].idEstadoPlan).toBe(idDe('borrador'));
    const otro = crearEntorno({ planes: [plan('aprobado')] });
    await expect(otro.servicio.reabrir(1, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('reabrir conserva el motivo del rechazo y limpia usuario y fecha', async () => {
    const { servicio, planes } = crearEntorno({
      planes: [
        plan('rechazado', {
          idUsuarioResolucion: 9,
          fechaResolucion: HOY,
          motivoResolucion: 'falta un candidato',
        }),
      ],
    });
    const dto = await servicio.reabrir(1, jefatura);
    expect(planes[0]).toMatchObject({
      idEstadoPlan: idDe('borrador'),
      idUsuarioResolucion: null,
      fechaResolucion: null,
      motivoResolucion: 'falta un candidato',
    });
    expect(dto.motivoResolucion).toBe('falta un candidato');
  });
  it('reabrir la versión rechazada de un aprobado vigente es válido', async () => {
    const { servicio, planes } = crearEntorno({
      planes: [
        plan('aprobado', { id: 1 }),
        plan('rechazado', { id: 2, idPlanAnterior: 1 }),
      ],
    });
    await servicio.reabrir(2, jefatura);
    expect(planes[1].idEstadoPlan).toBe(idDe('borrador'));
  });
  it('reabrir se niega si hay un aprobado más reciente que el plan anterior (escenario A)', async () => {
    const { servicio, planes } = crearEntorno({
      planes: [
        plan('cerrado', { id: 1 }),
        plan('rechazado', { id: 2, idPlanAnterior: 1 }),
        plan('aprobado', { id: 3, idPlanAnterior: 1 }),
      ],
    });
    await expect(servicio.reabrir(2, jefatura)).rejects.toThrow(
      /ya tiene un plan aprobado más reciente/,
    );
    expect(planes[1].idEstadoPlan).toBe(idDe('rechazado'));
  });
  it('reabrir se niega si hay un aprobado y el rechazado no tenía anterior (escenario B)', async () => {
    const { servicio } = crearEntorno({
      planes: [plan('rechazado', { id: 1 }), plan('aprobado', { id: 2 })],
    });
    await expect(servicio.reabrir(1, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('nuevaVersion vale solo desde aprobado', async () => {
    const { servicio } = crearEntorno({ planes: [plan('borrador')] });
    await expect(servicio.nuevaVersion(1, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('nuevaVersion: 409 si ya hay plan en elaboración', async () => {
    const { servicio } = crearEntorno({
      planes: [plan('aprobado', { id: 1 }), plan('borrador', { id: 2 })],
    });
    await expect(servicio.nuevaVersion(1, jefatura)).rejects.toThrow(
      ConflictException,
    );
  });
  it('nuevaVersion copia responsable, observaciones, plan anterior y candidatos', async () => {
    const candidato = {
      idPlan: 1,
      idPersona: 2,
      idEstadoPreparacion: 3,
      prioridad: 1,
      fechaDisponibilidadEstimada: '2027-01-01',
      observaciones: 'c',
    };
    const { servicio, planes, repoCandidatos } = crearEntorno({
      planes: [plan('aprobado')],
      candidatos: [candidato],
    });
    const nueva = await servicio.nuevaVersion(1, jefatura);
    expect(nueva.estado).toBe('borrador');
    expect(nueva.idPlanAnterior).toBe(1);
    expect(planes[1]).toMatchObject({
      idResponsable: 5,
      observaciones: 'obs',
      idPlanAnterior: 1,
    });
    expect(repoCandidatos.save).toHaveBeenCalledWith([
      { ...candidato, idPlan: nueva.id },
    ]);
  });
  it('cerrar: válido desde borrador, rechazado y aprobado; 409 desde pendiente y cerrado', async () => {
    for (const estado of ['borrador', 'rechazado', 'aprobado']) {
      const { servicio, planes } = crearEntorno({ planes: [plan(estado)] });
      await servicio.cerrar(1, jefatura);
      expect(planes[0].idEstadoPlan).toBe(idDe('cerrado'));
    }
    for (const estado of ['pendiente_aprobacion', 'cerrado']) {
      const { servicio } = crearEntorno({ planes: [plan(estado)] });
      await expect(servicio.cerrar(1, jefatura)).rejects.toThrow(
        ConflictException,
      );
    }
  });
});

describe('PlanesService.buscar', () => {
  it('inexistente: 404; fuera de alcance: 403', async () => {
    await expect(crearEntorno().servicio.buscar(1, jefatura)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      crearEntorno({
        planes: [plan('borrador')],
        fueraDeAlcance: true,
      }).servicio.buscar(1, jefatura),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('PlanesService.detalle', () => {
  it('compone el plan con sus candidatos y acciones tras validar el alcance', async () => {
    const { servicio, candidatosSvc, accionesSvc, alcance } = crearEntorno({
      planes: [plan('aprobado')],
    });
    const d = await servicio.detalle(1, jefatura);
    expect(alcance.exigirUnidad).toHaveBeenCalled();
    expect(candidatosSvc.listarDePlan).toHaveBeenCalledWith(1);
    expect(accionesSvc.listarDePlan).toHaveBeenCalledWith(1);
    expect(d.id).toBe(1);
    expect(d.candidatos).toEqual([{ idPersona: 5 }]);
    expect(d.acciones).toEqual([{ id: 3 }]);
  });
  it('fuera de alcance: ForbiddenException y no lee candidatos', async () => {
    const { servicio, candidatosSvc } = crearEntorno({
      planes: [plan('aprobado')],
      fueraDeAlcance: true,
    });
    await expect(servicio.detalle(1, jefatura)).rejects.toThrow(
      ForbiddenException,
    );
    expect(candidatosSvc.listarDePlan).not.toHaveBeenCalled();
  });
});

describe('PlanesService.listar con idUnidad', () => {
  it('filtra por la unidad y sus descendientes dentro del alcance', async () => {
    const { servicio, repoPlanes, alcance } = crearEntorno();
    alcance.unidadesVisibles.mockResolvedValue([10, 11, 12]);
    const consulta = vi.fn(async () => [{ id_unidad: 10 }, { id_unidad: 11 }]);
    (repoPlanes as unknown as { manager: { query: unknown } }).manager.query =
      consulta;
    await servicio.listar({ idUnidad: 10 }, jefatura);
    const where = repoPlanes.find.mock.calls.at(-1)![0].where as {
      puesto: { idUnidad: { _value: number[] } };
    };
    expect(where.puesto.idUnidad._value).toEqual([10, 11]);
  });
  it('unidad fuera del alcance: lista vacía', async () => {
    const { servicio, alcance } = crearEntorno();
    alcance.unidadesVisibles.mockResolvedValue([10]);
    expect(await servicio.listar({ idUnidad: 99 }, jefatura)).toEqual([]);
  });
});
