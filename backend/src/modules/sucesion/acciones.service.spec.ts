import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { AccionesService } from './acciones.service.js';
import type { AccionTransferencia } from './entities/accion-transferencia.entity.js';

const HOY = '2026-10-18';
const ESTADOS_PLAN = [
  { id: 1, codigo: 'borrador' },
  { id: 3, codigo: 'aprobado' },
  { id: 5, codigo: 'cerrado' },
];
const ESTADOS_ACCION = [
  { id: 1, codigo: 'pendiente' },
  { id: 2, codigo: 'en_curso' },
  { id: 3, codigo: 'completada' },
  { id: 4, codigo: 'cancelada' },
];
const idEstado = (codigo: string) =>
  ESTADOS_ACCION.find((e) => e.codigo === codigo)!.id;

const rrhh: SesionUsuario = {
  id: 1,
  nombreUsuario: 'rrhh',
  rol: 'recursos_humanos',
  idPersona: null,
  unidades: [],
};
const docente = (idPersona: number | null): SesionUsuario => ({
  id: 2,
  nombreUsuario: 'doc',
  rol: 'docente',
  idPersona,
  unidades: [],
});
const jefatura: SesionUsuario = {
  id: 3,
  nombreUsuario: 'jefa',
  rol: 'jefatura_departamento',
  idPersona: null,
  unidades: [10],
};
const autoridad: SesionUsuario = { ...rrhh, id: 4, rol: 'autoridad' };

type Accion = {
  id: number;
  idTipoAccion: number;
  idConocimiento: number;
  idPlan: number | null;
  idResponsable: number;
  idDestinatario: number | null;
  descripcion: string;
  fechaPrevista: string;
  fechaCumplimiento: string | null;
  idEstadoAccion: number;
  notaAvance: string | null;
  actualizadaEn?: Date;
};
const accionBase = (extra: Partial<Accion> = {}): Accion => ({
  id: 9,
  idTipoAccion: 1,
  idConocimiento: 2,
  idPlan: null,
  idResponsable: 5,
  idDestinatario: null,
  descripcion: 'Mentoría',
  fechaPrevista: '2026-12-01',
  fechaCumplimiento: null,
  idEstadoAccion: idEstado('pendiente'),
  notaAvance: null,
  ...extra,
});

function crearEntorno(
  opciones: {
    accion?: Accion | null;
    conocimiento?: { id: number; activo: boolean } | null;
    personas?: Record<number, { id: number; activo: boolean }>;
    plan?: { id: number; idPuesto: number; idEstadoPlan: number } | null;
    requisito?: boolean;
    tipo?: { id: number; activo: boolean } | null;
    visibles?: number[] | null;
    filas?: Accion[];
  } = {},
) {
  const almacen: { accion: Accion | null } = {
    accion: opciones.accion === undefined ? null : opciones.accion,
  };
  const personas = opciones.personas ?? {
    5: { id: 5, activo: true },
    6: { id: 6, activo: true },
  };
  const conocimiento =
    opciones.conocimiento === undefined
      ? { id: 2, activo: true }
      : opciones.conocimiento;
  const tipo =
    opciones.tipo === undefined ? { id: 1, activo: true } : opciones.tipo;

  const conRelaciones = (a: Accion) => ({
    ...a,
    tipoAccion: { codigo: 'mentoria' },
    conocimiento: { denominacion: 'SQL' },
    responsable: { apellido: 'Paz', nombre: 'Ana' },
    destinatario:
      a.idDestinatario === null ? null : { apellido: 'Gil', nombre: 'Luis' },
    estadoAccion: ESTADOS_ACCION.find((e) => e.id === a.idEstadoAccion),
  });
  const repoAcciones = {
    findOne: vi.fn(async (opts: { relations?: unknown }) =>
      almacen.accion
        ? opts.relations
          ? conRelaciones(almacen.accion)
          : { ...almacen.accion }
        : null,
    ),
    create: vi.fn((d: object) => ({ id: 9, ...d })),
    save: vi.fn(async (a: Accion) => {
      almacen.accion = { ...a };
      return a;
    }),
    createQueryBuilder: vi.fn(),
    manager: undefined as unknown,
  };
  const consultas: { sql: string; params: unknown }[] = [];
  const qb = {
    leftJoin: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn(
      (sql: string, params?: unknown) => (consultas.push({ sql, params }), qb),
    ),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn(async () => (opciones.filas ?? []).map(conRelaciones)),
  };
  repoAcciones.createQueryBuilder.mockReturnValue(qb);
  const repos: Record<string, unknown> = {
    AccionTransferencia: repoAcciones,
    Conocimiento: { findOne: vi.fn(async () => conocimiento) },
    Persona: {
      findOne: vi.fn(
        async ({ where }: { where: { id: number } }) =>
          personas[where.id] ?? null,
      ),
    },
    PlanSucesion: {
      findOne: vi.fn(async () =>
        opciones.plan === undefined
          ? { id: 1, idPuesto: 4, idEstadoPlan: 1 }
          : opciones.plan,
      ),
    },
    EstadoPlan: { find: vi.fn(async () => ESTADOS_PLAN) },
    EstadoAccionTransferencia: { find: vi.fn(async () => ESTADOS_ACCION) },
    TipoAccionTransferencia: { findOne: vi.fn(async () => tipo) },
    RequisitoPuesto: {
      findOne: vi.fn(async () =>
        opciones.requisito === false
          ? null
          : { idPuesto: 4, idConocimiento: 2 },
      ),
    },
  };
  const manager = {
    query: vi.fn(async () => [{ hoy: HOY }]),
    getRepository: (entidad: { name: string }) => repos[entidad.name],
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  repoAcciones.manager = manager;
  const alcance = {
    unidadesVisibles: vi.fn(async (s: SesionUsuario) =>
      opciones.visibles !== undefined
        ? opciones.visibles
        : s.rol === 'docente'
          ? []
          : null,
    ),
  };
  const servicio = new AccionesService(
    repoAcciones as unknown as Repository<AccionTransferencia>,
    alcance as unknown as AlcanceService,
  );
  return { servicio, repoAcciones, qb, consultas, almacen };
}

const alta = {
  idTipoAccion: 1,
  idConocimiento: 2,
  idResponsable: 5,
  descripcion: 'Mentoría',
  fechaPrevista: '2026-12-01',
};

describe('AccionesService.crear', () => {
  it('conocimiento inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ conocimiento: null });
    await expect(servicio.crear(alta, rrhh)).rejects.toThrow(NotFoundException);
  });
  it('conocimiento de baja: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      conocimiento: { id: 2, activo: false },
    });
    await expect(servicio.crear(alta, rrhh)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('tipo de acción inexistente: BadRequestException', async () => {
    const { servicio } = crearEntorno({ tipo: null });
    await expect(servicio.crear(alta, rrhh)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('responsable inactivo: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      personas: { 5: { id: 5, activo: false } },
    });
    await expect(servicio.crear(alta, rrhh)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('destinatario inactivo: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      personas: { 5: { id: 5, activo: true }, 6: { id: 6, activo: false } },
    });
    await expect(
      servicio.crear({ ...alta, idDestinatario: 6 }, rrhh),
    ).rejects.toThrow(BadRequestException);
  });
  it('destinatario igual al responsable: BadRequestException', async () => {
    const { servicio } = crearEntorno();
    await expect(
      servicio.crear({ ...alta, idDestinatario: 5 }, rrhh),
    ).rejects.toThrow(BadRequestException);
  });
  it('plan inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ plan: null });
    await expect(servicio.crear({ ...alta, idPlan: 1 }, rrhh)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('plan cerrado: ConflictException', async () => {
    const { servicio } = crearEntorno({
      plan: { id: 1, idPuesto: 4, idEstadoPlan: 5 },
    });
    await expect(servicio.crear({ ...alta, idPlan: 1 }, rrhh)).rejects.toThrow(
      ConflictException,
    );
  });
  it('plan aprobado acepta acciones', async () => {
    const { servicio } = crearEntorno({
      plan: { id: 1, idPuesto: 4, idEstadoPlan: 3 },
    });
    await expect(
      servicio.crear({ ...alta, idPlan: 1 }, rrhh),
    ).resolves.toBeDefined();
  });
  it('conocimiento que no es requisito del puesto del plan: ConflictException', async () => {
    const { servicio } = crearEntorno({ requisito: false });
    await expect(servicio.crear({ ...alta, idPlan: 1 }, rrhh)).rejects.toThrow(
      ConflictException,
    );
  });
  it('sin plan no exige requisito', async () => {
    const { servicio } = crearEntorno({ requisito: false });
    await expect(servicio.crear(alta, rrhh)).resolves.toMatchObject({
      idPlan: null,
    });
  });
  it('caso feliz: nace pendiente, con save', async () => {
    const { servicio, repoAcciones } = crearEntorno();
    const dto = await servicio.crear(
      { ...alta, idPlan: 1, idDestinatario: 6 },
      rrhh,
    );
    expect(repoAcciones.save).toHaveBeenCalledTimes(1);
    expect(repoAcciones.save.mock.calls[0][0]).toMatchObject({
      idEstadoAccion: idEstado('pendiente'),
      fechaCumplimiento: null,
    });
    expect(dto).toMatchObject({
      estado: 'pendiente',
      tipo: 'mentoria',
      denominacionConocimiento: 'SQL',
      nombreResponsable: 'Paz, Ana',
      nombreDestinatario: 'Gil, Luis',
      vencida: false,
    });
  });
});

describe('AccionesService.editar', () => {
  it.each(['completada', 'cancelada'])(
    'una acción %s no se edita: ConflictException',
    async (estado) => {
      const { servicio } = crearEntorno({
        accion: accionBase({ idEstadoAccion: idEstado(estado) }),
      });
      await expect(
        servicio.editar(9, { descripcion: 'otra' }, rrhh),
      ).rejects.toThrow(ConflictException);
    },
  );
  it('acción inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ accion: null });
    await expect(servicio.editar(9, {}, rrhh)).rejects.toThrow(
      NotFoundException,
    );
  });
  it.each(['pendiente', 'en_curso'])(
    'cancelar desde %s pasa a cancelada',
    async (estado) => {
      const { servicio, almacen } = crearEntorno({
        accion: accionBase({ idEstadoAccion: idEstado(estado) }),
      });
      const dto = await servicio.editar(9, { cancelar: true }, rrhh);
      expect(almacen.accion!.idEstadoAccion).toBe(idEstado('cancelada'));
      expect(dto.estado).toBe('cancelada');
    },
  );
  it('edita campos y actualiza actualizadaEn', async () => {
    const { servicio, almacen } = crearEntorno({ accion: accionBase() });
    await servicio.editar(9, { descripcion: 'Nueva', idDestinatario: 6 }, rrhh);
    expect(almacen.accion).toMatchObject({
      descripcion: 'Nueva',
      idDestinatario: 6,
    });
    expect(almacen.accion!.actualizadaEn).toBeInstanceOf(Date);
  });
  it('destinatario igual al responsable: BadRequestException', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.editar(9, { idDestinatario: 5 }, rrhh),
    ).rejects.toThrow(BadRequestException);
  });
  it('nuevo responsable inactivo: BadRequestException', async () => {
    const { servicio } = crearEntorno({
      accion: accionBase(),
      personas: { 5: { id: 5, activo: true }, 7: { id: 7, activo: false } },
    });
    await expect(
      servicio.editar(9, { idResponsable: 7 }, rrhh),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('AccionesService.avanzar', () => {
  it('un docente que no es el responsable: ForbiddenException', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso' }, docente(99)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('el destinatario no avanza', async () => {
    const { servicio } = crearEntorno({
      accion: accionBase({ idDestinatario: 6 }),
    });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso', notaAvance: 'x' }, docente(6)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('docente sin persona: ForbiddenException', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso' }, docente(null)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('acción inexistente: NotFoundException', async () => {
    const { servicio } = crearEntorno({ accion: null });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso' }, rrhh),
    ).rejects.toThrow(NotFoundException);
  });
  it('el responsable pasa pendiente a en_curso y a completada', async () => {
    const { servicio, almacen } = crearEntorno({ accion: accionBase() });
    const enCurso = await servicio.avanzar(
      9,
      { estado: 'en_curso', notaAvance: 'arrancó' },
      docente(5),
    );
    expect(enCurso).toMatchObject({
      estado: 'en_curso',
      notaAvance: 'arrancó',
    });
    const completada = await servicio.avanzar(
      9,
      { estado: 'completada' },
      docente(5),
    );
    expect(completada.estado).toBe('completada');
    expect(almacen.accion!.actualizadaEn).toBeInstanceOf(Date);
  });
  it('completada fija la fecha de hoy si no viene', async () => {
    const { servicio, almacen } = crearEntorno({
      accion: accionBase({ idEstadoAccion: idEstado('en_curso') }),
    });
    const dto = await servicio.avanzar(9, { estado: 'completada' }, docente(5));
    expect(almacen.accion!.fechaCumplimiento).toBe(HOY);
    expect(dto.fechaCumplimiento).toBe(HOY);
  });
  it('completada respeta una fecha pasada', async () => {
    const { servicio, almacen } = crearEntorno({
      accion: accionBase({ idEstadoAccion: idEstado('en_curso') }),
    });
    await servicio.avanzar(
      9,
      { estado: 'completada', fechaCumplimiento: '2026-10-01' },
      rrhh,
    );
    expect(almacen.accion!.fechaCumplimiento).toBe('2026-10-01');
  });
  it('completada con fecha futura: BadRequestException', async () => {
    const { servicio, repoAcciones } = crearEntorno({
      accion: accionBase({ idEstadoAccion: idEstado('en_curso') }),
    });
    await expect(
      servicio.avanzar(
        9,
        { estado: 'completada', fechaCumplimiento: '2026-10-19' },
        rrhh,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(repoAcciones.save).not.toHaveBeenCalled();
  });
  it('fecha de cumplimiento al pasar a en_curso: BadRequestException', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.avanzar(
        9,
        { estado: 'en_curso', fechaCumplimiento: '2026-10-01' },
        rrhh,
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('de completada a en_curso: ConflictException', async () => {
    const { servicio } = crearEntorno({
      accion: accionBase({
        idEstadoAccion: idEstado('completada'),
        fechaCumplimiento: '2026-10-01',
      }),
    });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso' }, rrhh),
    ).rejects.toThrow(ConflictException);
  });
  it('de pendiente directo a completada: ConflictException', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.avanzar(9, { estado: 'completada' }, rrhh),
    ).rejects.toThrow(ConflictException);
  });
  it('RR. HH. avanza cualquiera', async () => {
    const { servicio } = crearEntorno({ accion: accionBase() });
    await expect(
      servicio.avanzar(9, { estado: 'en_curso' }, rrhh),
    ).resolves.toMatchObject({ estado: 'en_curso' });
  });
});

describe('AccionesService.listar', () => {
  it('RR. HH. y autoridad ven todas: sin cláusula de visibilidad', async () => {
    for (const sesion of [rrhh, autoridad]) {
      const { servicio, consultas, qb } = crearEntorno({ visibles: null });
      await servicio.listar({}, sesion);
      expect(qb.getMany).toHaveBeenCalled();
      expect(consultas).toHaveLength(0);
    }
  });
  it('el docente ve solo las suyas como responsable o destinatario', async () => {
    const { servicio, consultas } = crearEntorno();
    await servicio.listar({}, docente(5));
    expect(consultas).toHaveLength(1);
    expect(consultas[0].sql).toContain('idResponsable');
    expect(consultas[0].sql).toContain('idDestinatario');
    expect(consultas[0].params).toEqual({ idPersona: 5 });
  });
  it('el docente sin idPersona recibe lista vacía sin consultar', async () => {
    const { servicio, qb } = crearEntorno();
    expect(await servicio.listar({}, docente(null))).toEqual([]);
    expect(qb.getMany).not.toHaveBeenCalled();
  });
  it('la jefatura ve solo las de planes de su alcance', async () => {
    const { servicio, consultas } = crearEntorno({ visibles: [10, 11] });
    await servicio.listar({}, jefatura);
    expect(consultas).toHaveLength(1);
    expect(consultas[0].sql).toContain('idUnidad');
    expect(consultas[0].params).toEqual({ unidades: [10, 11] });
  });
  it('la jefatura sin unidades visibles recibe lista vacía', async () => {
    const { servicio, qb } = crearEntorno({ visibles: [] });
    expect(await servicio.listar({}, jefatura)).toEqual([]);
    expect(qb.getMany).not.toHaveBeenCalled();
  });
  it('aplica los filtros', async () => {
    const { servicio, consultas } = crearEntorno({ visibles: null });
    await servicio.listar(
      { idPlan: 1, idConocimiento: 2, estado: 'pendiente', vencidas: true },
      rrhh,
    );
    const sql = consultas.map((c) => c.sql).join(' | ');
    expect(sql).toContain('idPlan');
    expect(sql).toContain('idConocimiento');
    expect(sql).toContain('codigo');
    expect(sql).toContain('fechaPrevista');
  });
});

describe('vencida', () => {
  const dtoDe = async (estado: string, fechaPrevista: string) => {
    const { servicio } = crearEntorno({
      visibles: null,
      filas: [accionBase({ idEstadoAccion: idEstado(estado), fechaPrevista })],
    });
    return (await servicio.listar({}, rrhh))[0];
  };
  it.each(['pendiente', 'en_curso'])(
    '%s con fecha prevista de ayer es vencida',
    async (estado) => {
      expect((await dtoDe(estado, '2026-10-17')).vencida).toBe(true);
    },
  );
  it('pendiente con fecha prevista de hoy no es vencida', async () => {
    expect((await dtoDe('pendiente', HOY)).vencida).toBe(false);
  });
  it.each(['completada', 'cancelada'])(
    '%s con fecha prevista pasada no es vencida',
    async (estado) => {
      expect((await dtoDe(estado, '2026-01-01')).vencida).toBe(false);
    },
  );
});

describe('AccionesService.listarDePlan', () => {
  it('lista las del plan sin validar alcance', async () => {
    const { servicio, qb } = crearEntorno({ filas: [accionBase()] });
    const r = await servicio.listarDePlan(1);
    expect(r).toHaveLength(1);
    expect(qb.getMany).toHaveBeenCalled();
  });
});
