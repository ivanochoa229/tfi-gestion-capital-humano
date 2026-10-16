import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';
import { ConocimientosService } from './conocimientos.service.js';
import {
  PASOS_FUSION,
  SQL_CONTAR_PERSONAS,
  SQL_CONTAR_REQUISITOS,
} from './fusion.sql.js';

const existente = (parcial: Partial<Conocimiento> = {}): Conocimiento =>
  ({
    id: 1,
    denominacion: 'Programación',
    denominacionNormalizada: 'programacion',
    idTipoConocimiento: 3,
    idAreaTematica: 5,
    descripcion: null,
    activo: true,
    idFusionadoEn: null,
    ...parcial,
  }) as Conocimiento;

function crearEntorno(
  iniciales: Conocimiento[] = [],
  usos: { codigo: string }[] = [],
) {
  const filas = iniciales.map((f) => ({ ...f }));
  let siguiente = 100;
  const coincide = (f: Conocimiento, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => f[k as keyof Conocimiento] === v);
  const repo = {
    find: vi.fn(async (o?: { where?: Record<string, unknown> }) =>
      filas.filter((f) => coincide(f, o?.where ?? {})).map((f) => ({ ...f })),
    ),
    findOne: vi.fn(async (o: { where: Record<string, unknown> }) => {
      const f = filas.find((x) => coincide(x, o.where));
      return f ? { ...f } : null;
    }),
    create: vi.fn((datos: Partial<Conocimiento>) => ({
      idFusionadoEn: null,
      activo: true,
      ...datos,
    })),
    save: vi.fn(async (c: Conocimiento) => {
      if (c.id === undefined) {
        c.id = siguiente++;
        filas.push({ ...c });
      } else {
        filas[filas.findIndex((f) => f.id === c.id)] = { ...c };
      }
      return { ...c };
    }),
  };
  const manager = {
    getRepository: () => repo,
    query: vi.fn(async (sql: string) =>
      sql.includes('requisito_puesto') ? usos : [],
    ),
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new ConocimientosService(
    repo as unknown as Repository<Conocimiento>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repo, referencia, filas, manager };
}

const alta = {
  denominacion: 'Bases de datos',
  idTipoConocimiento: 3,
  idAreaTematica: 5,
};

describe('ConocimientosService.crear', () => {
  it('guarda la denominación y su clave normalizada', async () => {
    const { servicio, repo } = crearEntorno();
    const creado = await servicio.crear({
      ...alta,
      denominacion: 'Bases  de DATOS',
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        denominacion: 'Bases  de DATOS',
        denominacionNormalizada: 'bases de datos',
      }),
    );
    expect(creado).toMatchObject({ id: 100, activo: true });
  });

  it('valida el tipo y el área contra la referencia', async () => {
    const { servicio, referencia } = crearEntorno();
    await servicio.crear(alta);
    expect(referencia.validarActivo).toHaveBeenCalledWith(
      'tipo-conocimiento',
      3,
    );
    expect(referencia.validarActivo).toHaveBeenCalledWith('area-tematica', 5);
  });

  it('rechaza con 409 un duplicado por tilde, mayúsculas o espacios y nombra el existente', async () => {
    const { servicio } = crearEntorno([existente()]);
    const intento = servicio.crear({
      ...alta,
      denominacion: '  PROGRAMACION ',
    });
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow(/Programación.*id 1/);
  });

  it('acepta el mismo nombre en otro tipo y cuando el existente está inactivo', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1 }),
      existente({ id: 2, idTipoConocimiento: 9 }),
    ]);
    await expect(
      servicio.crear({
        ...alta,
        denominacion: 'Programación',
        idTipoConocimiento: 4,
      }),
    ).resolves.toBeDefined();
    const inactivo = crearEntorno([existente({ activo: false })]);
    await expect(
      inactivo.servicio.crear({ ...alta, denominacion: 'Programación' }),
    ).resolves.toBeDefined();
  });

  it('distingue año de ano', async () => {
    const { servicio } = crearEntorno([
      existente({ denominacion: 'Ano', denominacionNormalizada: 'ano' }),
    ]);
    await expect(
      servicio.crear({ ...alta, denominacion: 'Año' }),
    ).resolves.toBeDefined();
  });
});

describe('ConocimientosService.actualizar', () => {
  it('renombrar a otro existente da 409, pero cambiar solo tildes del propio no', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1 }),
      existente({
        id: 2,
        denominacion: 'Redes',
        denominacionNormalizada: 'redes',
      }),
    ]);
    await expect(
      servicio.actualizar(2, { denominacion: 'programación' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      servicio.actualizar(1, { denominacion: 'PROGRAMACIÓN' }),
    ).resolves.toMatchObject({ denominacion: 'PROGRAMACIÓN' });
  });

  it('da 404 si no existe y 409 si está dado de baja', async () => {
    const { servicio } = crearEntorno([existente({ id: 1, activo: false })]);
    await expect(
      servicio.actualizar(9, { descripcion: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      servicio.actualizar(1, { descripcion: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ConocimientosService.baja y reactivar', () => {
  it('la baja se bloquea si lo piden puestos activos y los lista', async () => {
    const { servicio } = crearEntorno(
      [existente()],
      [{ codigo: 'P-0001' }, { codigo: 'P-0002' }],
    );
    const intento = servicio.baja(1);
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow(/P-0001, P-0002/);
  });

  it('da de baja un conocimiento que ningún puesto pide', async () => {
    const { servicio } = crearEntorno([existente()]);
    await expect(servicio.baja(1)).resolves.toMatchObject({ activo: false });
  });

  it('no reactiva si ya hay uno activo con la misma clave', async () => {
    const { servicio } = crearEntorno([
      existente({ id: 1, activo: false }),
      existente({ id: 2 }),
    ]);
    await expect(servicio.reactivar(1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reactiva si no hay conflicto', async () => {
    const { servicio } = crearEntorno([existente({ id: 1, activo: false })]);
    await expect(servicio.reactivar(1)).resolves.toMatchObject({
      activo: true,
    });
  });
});

describe('ConocimientosService.listar', () => {
  it('busca por la clave normalizada, así que ignora tildes y mayúsculas', async () => {
    const { servicio, repo } = crearEntorno();
    await servicio.listar({ q: ' Programación ', idTipo: 3 });
    const donde = repo.find.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(donde.idTipoConocimiento).toBe(3);
    expect(
      String((donde.denominacionNormalizada as { _value: string })._value),
    ).toBe('%programacion%');
  });

  it('sin filtros devuelve activos e inactivos', async () => {
    const { servicio, repo } = crearEntorno([existente({ activo: false })]);
    expect(await servicio.listar({})).toHaveLength(1);
    expect(repo.find.mock.calls[0][0]?.where).toEqual({});
  });
});

describe('validaciones de dominio', () => {
  it('una referencia inválida corta el alta', async () => {
    const { servicio, referencia } = crearEntorno();
    referencia.validarActivo.mockRejectedValueOnce(
      new BadRequestException('El valor 3 no existe'),
    );
    await expect(servicio.crear(alta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ConocimientosService.fusionar', () => {
  const origen = existente({ id: 1, denominacion: 'Python 3' });
  const destino = existente({
    id: 2,
    denominacion: 'Python',
    denominacionNormalizada: 'python',
  });

  it('rechaza fusionar un conocimiento consigo mismo', async () => {
    const { servicio } = crearEntorno([origen]);
    await expect(servicio.fusionar(1, { idDestino: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('da 404 si el origen o el destino no existen', async () => {
    const { servicio } = crearEntorno([origen]);
    await expect(servicio.fusionar(1, { idDestino: 9 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(servicio.fusionar(9, { idDestino: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exige que los dos estén activos y sean del mismo tipo', async () => {
    const inactivo = crearEntorno([origen, { ...destino, activo: false }]);
    await expect(
      inactivo.servicio.fusionar(1, { idDestino: 2 }),
    ).rejects.toThrow(/activos/);
    const otroTipo = crearEntorno([
      origen,
      { ...destino, idTipoConocimiento: 4 },
    ]);
    await expect(
      otroTipo.servicio.fusionar(1, { idDestino: 2 }),
    ).rejects.toThrow(/mismo tipo/);
  });

  it('corre todos los pasos en orden, deja el origen inactivo y informa lo movido', async () => {
    const { servicio, manager, filas } = crearEntorno([origen, destino]);
    manager.query.mockImplementation(async (sql: string) => {
      if (sql === SQL_CONTAR_REQUISITOS) return [{ n: 3 }];
      if (sql === SQL_CONTAR_PERSONAS) return [{ n: 5 }];
      return [];
    });

    const resultado = await servicio.fusionar(1, { idDestino: 2 });

    const pasos = manager.query.mock.calls
      .filter(([sql]) => PASOS_FUSION.includes(sql as string))
      .map(([sql, parametros]) => [sql, parametros]);
    expect(pasos).toEqual(PASOS_FUSION.map((sql) => [sql, [1, 2]]));
    expect(resultado).toEqual({
      idOrigen: 1,
      idDestino: 2,
      requisitosMovidos: 3,
      personasMovidas: 5,
    });
    expect(filas.find((f) => f.id === 1)).toMatchObject({
      activo: false,
      idFusionadoEn: 2,
    });
    expect(filas.find((f) => f.id === 2)?.activo).toBe(true);
  });
});
