import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import {
  BLOQUEO_ESTRUCTURA,
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';

function repositorioCon(manager: Partial<EntityManager>) {
  const contenedor = {
    manager: {
      ...manager,
      transaction: async (trabajo: (m: EntityManager) => Promise<unknown>) =>
        trabajo(contenedor.manager as EntityManager),
    },
  };
  return contenedor as unknown as { manager: EntityManager };
}

describe('enTransaccionDeEstructura', () => {
  it('toma el bloqueo consultivo antes de ejecutar el trabajo', async () => {
    const orden: string[] = [];
    const repo = repositorioCon({
      query: vi.fn(async (sql: string, parametros?: unknown[]) => {
        orden.push(`${sql}|${JSON.stringify(parametros)}`);
        return [];
      }) as never,
    });
    const resultado = await enTransaccionDeEstructura(repo, async () => {
      orden.push('trabajo');
      return 42;
    });
    expect(resultado).toBe(42);
    expect(orden).toEqual([
      `SELECT pg_advisory_xact_lock($1)|[${BLOQUEO_ESTRUCTURA}]`,
      'trabajo',
    ]);
  });

  it('traduce una violación de unicidad a 409', async () => {
    const repo = repositorioCon({ query: vi.fn(async () => []) as never });
    const duplicado = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate key'), { code: '23505' }),
    );
    await expect(
      enTransaccionDeEstructura(repo, async () => {
        throw duplicado;
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('deja pasar los demás errores', async () => {
    const repo = repositorioCon({ query: vi.fn(async () => []) as never });
    await expect(
      enTransaccionDeEstructura(repo, async () => {
        throw new Error('otro');
      }),
    ).rejects.toThrow('otro');
  });
});

describe('siguienteCodigoPuesto', () => {
  it('formatea el valor de la secuencia con cuatro dígitos', async () => {
    const manager = {
      query: vi.fn(async () => [{ n: '7' }]),
    } as unknown as EntityManager;
    expect(await siguienteCodigoPuesto(manager)).toBe('P-0007');
  });

  it('conserva los códigos de cuatro dígitos', async () => {
    const manager = {
      query: vi.fn(async () => [{ n: '9999' }]),
    } as unknown as EntityManager;
    expect(await siguienteCodigoPuesto(manager)).toBe('P-9999');
  });
});
