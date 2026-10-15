import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { BLOQUEO_CONOCIMIENTO } from './conocimiento.constantes.js';
import { enTransaccionDeConocimiento, traducirError } from './transaccion.js';

const errorDeBase = (code: string) =>
  new QueryFailedError('INSERT', [], Object.assign(new Error('x'), { code }));

describe('enTransaccionDeConocimiento', () => {
  it('toma el bloqueo consultivo antes de correr el trabajo', async () => {
    const orden: string[] = [];
    const manager = {
      query: vi.fn(async (sql: string, parametros: unknown[]) => {
        orden.push(`${sql} ${String(parametros)}`);
      }),
    };
    const repositorio = {
      manager: { transaction: async (t: (m: unknown) => unknown) => t(manager) },
    };

    const resultado = await enTransaccionDeConocimiento(
      repositorio as never,
      async () => {
        orden.push('trabajo');
        return 42;
      },
    );

    expect(resultado).toBe(42);
    expect(orden).toEqual([
      `SELECT pg_advisory_xact_lock($1) ${BLOQUEO_CONOCIMIENTO}`,
      'trabajo',
    ]);
  });

  it('traduce el error de la base que sale del trabajo', async () => {
    const repositorio = {
      manager: {
        transaction: async () => {
          throw errorDeBase('23505');
        },
      },
    };
    await expect(
      enTransaccionDeConocimiento(repositorio as never, async () => 1),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('traducirError', () => {
  it('convierte una unicidad (23505) en 409', () => {
    expect(traducirError(errorDeBase('23505'))).toBeInstanceOf(
      ConflictException,
    );
  });

  it('deja pasar los demás errores sin cambios', () => {
    const otro = errorDeBase('23503');
    expect(traducirError(otro)).toBe(otro);
    const comun = new Error('x');
    expect(traducirError(comun)).toBe(comun);
  });
});
