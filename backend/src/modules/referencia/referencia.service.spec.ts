import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { ReferenciaService } from './referencia.service.js';

interface Fila {
  id: number;
  codigo: string;
  denominacion: string;
  activo: boolean;
  orden?: number;
}

/** Repositorio en memoria con las operaciones que usa el servicio. */
function crearEntorno(datos: Fila[], enUso: number[] = []) {
  const filas = datos.map((f) => ({ ...f }));
  const repo = {
    find: vi.fn(async ({ where }: { where: Partial<Fila> }) =>
      filas.filter(
        (f) => where.activo === undefined || f.activo === where.activo,
      ),
    ),
    findOneBy: vi.fn(
      async (donde: Partial<Fila>) =>
        filas.find((f) =>
          Object.entries(donde).every(([k, v]) => f[k as keyof Fila] === v),
        ) ?? null,
    ),
    count: vi.fn(
      async ({ where }: { where: Partial<Fila> }) =>
        filas.filter((f) => f.activo === where.activo).length,
    ),
    create: vi.fn((datos: Partial<Fila>) => ({ ...datos })),
    save: vi.fn(async (f: Partial<Fila>) => ({ id: 99, ...f })),
    delete: vi.fn(async () => undefined),
  };
  const dataSource = {
    getRepository: vi.fn(() => repo),
    query: vi.fn(async (sql: string) =>
      sql.includes('pg_constraint')
        ? [{ tabla: 'consumidor', columna: 'id_x' }]
        : enUso.map((id) => ({ id })),
    ),
  } as unknown as DataSource;
  return { servicio: new ReferenciaService(dataSource), repo };
}

const ordinales: Fila[] = [
  { id: 1, codigo: 'basico', denominacion: 'Básico', activo: true, orden: 1 },
  {
    id: 2,
    codigo: 'experto',
    denominacion: 'Experto',
    activo: false,
    orden: 2,
  },
];
const simples: Fila[] = [
  { id: 1, codigo: 'fisico', denominacion: 'Físico', activo: true },
  { id: 2, codigo: 'psicosocial', denominacion: 'Psicosocial', activo: true },
];

describe('ReferenciaService - consulta', () => {
  it('lista los dieciocho dominios', () => {
    const { servicio } = crearEntorno([]);
    expect(servicio.listarDominios()).toHaveLength(18);
  });

  it('lista solo los valores activos por defecto', async () => {
    const { servicio } = crearEntorno(ordinales);
    const valores = await servicio.listarValores('nivel-dominio');
    expect(valores.map((v) => v.codigo)).toEqual(['basico']);
  });

  it('incluye los inactivos si se pide y marca los que están en uso', async () => {
    const { servicio } = crearEntorno(ordinales, [2]);
    const valores = await servicio.listarValores('nivel-dominio', true);
    expect(valores.map((v) => [v.codigo, v.enUso])).toEqual([
      ['basico', false],
      ['experto', true],
    ]);
  });

  it('ordena por orden en ordinales y por denominación en el resto', async () => {
    const a = crearEntorno(ordinales);
    await a.servicio.listarValores('nivel-dominio');
    expect(a.repo.find.mock.calls[0][0]).toMatchObject({
      order: { orden: 'ASC' },
    });
    const b = crearEntorno(simples);
    await b.servicio.listarValores('tipo-riesgo');
    expect(b.repo.find.mock.calls[0][0]).toMatchObject({
      order: { denominacion: 'ASC' },
    });
  });

  it('responde 404 ante un dominio inexistente', async () => {
    const { servicio } = crearEntorno([]);
    await expect(servicio.listarValores('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ReferenciaService - alta y modificación', () => {
  it('crea un valor y lo devuelve activo y sin uso', async () => {
    const { servicio } = crearEntorno(simples);
    const creado = await servicio.crear('tipo-riesgo', {
      codigo: 'quimico',
      denominacion: 'Químico',
    });
    expect(creado).toMatchObject({
      codigo: 'quimico',
      activo: true,
      enUso: false,
    });
  });

  it('rechaza un código repetido con 409', async () => {
    const { servicio } = crearEntorno(simples);
    await expect(
      servicio.crear('tipo-riesgo', { codigo: 'fisico', denominacion: 'Otro' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza una denominación repetida con 409', async () => {
    const { servicio } = crearEntorno(simples);
    await expect(
      servicio.crear('tipo-riesgo', { codigo: 'otro', denominacion: 'Físico' }),
    ).rejects.toThrow(ConflictException);
  });

  it('exige el orden en un dominio ordinal', async () => {
    const { servicio } = crearEntorno(ordinales);
    await expect(
      servicio.crear('nivel-dominio', {
        codigo: 'nuevo',
        denominacion: 'Nuevo',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prohíbe el orden en un dominio no ordinal', async () => {
    const { servicio } = crearEntorno(simples);
    await expect(
      servicio.crear('tipo-riesgo', {
        codigo: 'nuevo',
        denominacion: 'Nuevo',
        orden: 3,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un orden repetido con 409', async () => {
    const { servicio } = crearEntorno(ordinales);
    await expect(
      servicio.crear('nivel-dominio', {
        codigo: 'nuevo',
        denominacion: 'Nuevo',
        orden: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('modifica la denominación', async () => {
    const { servicio } = crearEntorno(simples);
    const r = await servicio.actualizar('tipo-riesgo', 1, {
      denominacion: 'Físico/mecánico',
    });
    expect(r.denominacion).toBe('Físico/mecánico');
  });

  it('responde 404 si el valor no existe', async () => {
    const { servicio } = crearEntorno(simples);
    await expect(
      servicio.actualizar('tipo-riesgo', 50, { denominacion: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('permite reordenar a un orden libre', async () => {
    const { servicio } = crearEntorno(ordinales);
    const r = await servicio.actualizar('nivel-dominio', 1, { orden: 10 });
    expect(r.orden).toBe(10);
  });

  it('rechaza reordenar a un orden ya usado', async () => {
    const { servicio } = crearEntorno(ordinales);
    await expect(
      servicio.actualizar('nivel-dominio', 1, { orden: 2 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza orden en un dominio no ordinal al modificar', async () => {
    const { servicio } = crearEntorno(simples);
    await expect(
      servicio.actualizar('tipo-riesgo', 1, { orden: 5 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ReferenciaService - uso y desactivación', () => {
  it('no borra un valor en uso y sugiere desactivarlo', async () => {
    const { servicio, repo } = crearEntorno(simples, [1]);
    await expect(servicio.eliminar('tipo-riesgo', 1)).rejects.toThrow(
      /desactivalo/,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('borra un valor sin uso', async () => {
    const { servicio, repo } = crearEntorno(simples, [1]);
    await servicio.eliminar('tipo-riesgo', 2);
    expect(repo.delete).toHaveBeenCalledWith(2);
  });

  it('no permite cambiar el código de un valor en uso', async () => {
    const { servicio } = crearEntorno(simples, [1]);
    await expect(
      servicio.actualizar('tipo-riesgo', 1, { codigo: 'nuevo_codigo' }),
    ).rejects.toThrow(ConflictException);
  });

  it('desactiva y reactiva un valor', async () => {
    const { servicio } = crearEntorno(simples);
    expect(
      (await servicio.actualizar('tipo-riesgo', 1, { activo: false })).activo,
    ).toBe(false);
  });

  it('advierte al desactivar el último valor activo', async () => {
    const unico: Fila[] = [simples[0]];
    const { servicio } = crearEntorno(unico);
    const r = await servicio.actualizar('tipo-riesgo', 1, { activo: false });
    expect(r.advertencia).toMatch(/No quedan valores activos/);
  });

  it('no advierte si quedan otros activos', async () => {
    const { servicio } = crearEntorno(simples);
    const r = await servicio.actualizar('tipo-riesgo', 1, { activo: false });
    expect(r.advertencia).toBeUndefined();
  });

  it('validarActivo acepta un valor activo y rechaza uno inactivo o inexistente', async () => {
    const { servicio } = crearEntorno(ordinales);
    await expect(
      servicio.validarActivo('nivel-dominio', 1),
    ).resolves.toBeUndefined();
    await expect(servicio.validarActivo('nivel-dominio', 2)).rejects.toThrow(
      /desactivado/,
    );
    await expect(servicio.validarActivo('nivel-dominio', 77)).rejects.toThrow(
      BadRequestException,
    );
  });
});
