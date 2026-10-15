import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { BLOQUEO_ESTRUCTURA } from '../estructura/transaccion.js';
import { enTransaccionDePersonas, traducirError } from './transaccion.js';

const errorDeBase = (code: string, detail = '') =>
  new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error('x'), { code, detail }),
  );

describe('traducirError', () => {
  it('traduce la exclusión (23P01) a 409', () => {
    expect(traducirError(errorDeBase('23P01'))).toBeInstanceOf(
      ConflictException,
    );
  });
  it('nombra el legajo y el documento repetidos', () => {
    expect(
      (
        traducirError(
          errorDeBase('23505', 'Key (legajo)=(1) already exists.'),
        ) as Error
      ).message,
    ).toContain('legajo');
    expect(
      (
        traducirError(
          errorDeBase('23505', 'Key (documento)=(30111111) already exists.'),
        ) as Error
      ).message,
    ).toContain('documento');
  });
  it('explica la clave repetida de una ocupación', () => {
    const detalle =
      'Key (id_persona, id_puesto, fecha_desde)=(1, 2, 2024-01-01) already exists.';
    expect(
      (traducirError(errorDeBase('23505', detalle)) as Error).message,
    ).toContain('empieza ese día');
  });
  it('deja pasar otros errores sin tocarlos', () => {
    const otro = new Error('boom');
    expect(traducirError(otro)).toBe(otro);
    const base = errorDeBase('22003');
    expect(traducirError(base)).toBe(base);
  });
});

describe('enTransaccionDePersonas', () => {
  function entorno() {
    const consultas: { sql: string; parametros?: unknown[] }[] = [];
    const manager = {
      query: vi.fn(async (sql: string, parametros?: unknown[]) => {
        consultas.push({ sql, parametros });
        return [];
      }),
      transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
        trabajo(manager),
    };
    return { repositorio: { manager } as never, consultas };
  }

  it('toma el bloqueo consultivo de estructura antes del trabajo', async () => {
    const { repositorio, consultas } = entorno();
    const resultado = await enTransaccionDePersonas(
      repositorio,
      async () => 42,
    );
    expect(resultado).toBe(42);
    expect(consultas[0].sql).toContain('pg_advisory_xact_lock');
    expect(consultas[0].parametros).toEqual([BLOQUEO_ESTRUCTURA]);
  });

  it('traduce el error de la base que sale del trabajo', async () => {
    const { repositorio } = entorno();
    await expect(
      enTransaccionDePersonas(repositorio, async () => {
        throw errorDeBase('23P01');
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
