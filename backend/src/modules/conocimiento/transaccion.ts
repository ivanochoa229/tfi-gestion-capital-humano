import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { BLOQUEO_CONOCIMIENTO } from './conocimiento.constantes.js';

/**
 * Convierte los errores de unicidad de la base en 409. Es el respaldo de las
 * validaciones previas de los servicios, que dan el mensaje que nombra al
 * conocimiento existente; el resto de los errores pasa sin cambios.
 */
export function traducirError(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) return error;
  const { code } = (error.driverError ?? {}) as { code?: string };
  if (code === '23505') {
    return new ConflictException(
      'Ya existe un registro con esos datos (conocimiento repetido para el mismo tipo)',
    );
  }
  return error;
}

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de conocimiento: altas, fusiones, requisitos, declaraciones y acreditaciones
 * quedan serializadas, así que una fusión no se cruza con una acreditación
 * sobre el conocimiento que desaparece.
 */
export async function enTransaccionDeConocimiento<T>(
  repositorio: { manager: EntityManager },
  trabajo: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await repositorio.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_CONOCIMIENTO,
      ]);
      return trabajo(manager);
    });
  } catch (error) {
    throw traducirError(error);
  }
}
