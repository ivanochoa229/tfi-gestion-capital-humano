import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';

/** Clave del bloqueo que serializa las escrituras de puestos (Usuarios usa 7001). */
export const BLOQUEO_ESTRUCTURA = 7002;

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de estructura: las altas, ediciones y bajas de puestos quedan serializadas,
 * así que dos pedidos simultáneos no pueden cerrar un ciclo ni dar de baja un
 * puesto mientras otro le asigna un subordinado.
 */
export async function enTransaccionDeEstructura<T>(
  repositorio: { manager: EntityManager },
  trabajo: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await repositorio.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_ESTRUCTURA,
      ]);
      return trabajo(manager);
    });
  } catch (error) {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      throw new ConflictException(
        'Ya existe un puesto con esos datos (código o denominación repetidos en la unidad)',
      );
    }
    throw error;
  }
}

/** Próximo código de puesto: `P-0001`. La secuencia falla al llegar a 9999. */
export async function siguienteCodigoPuesto(
  manager: EntityManager,
): Promise<string> {
  const [fila] = await manager.query<{ n: string }[]>(
    `SELECT nextval('puesto_codigo_seq') AS n`,
  );
  return `P-${fila.n.padStart(4, '0')}`;
}
