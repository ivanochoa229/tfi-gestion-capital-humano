import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { BLOQUEO_SUCESION } from './sucesion.constantes.js';

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de sucesión: las escrituras de planes y candidatos quedan serializadas, y
 * una violación de unicidad (plan duplicado, prioridad repetida) se informa
 * como conflicto.
 */
export async function enTransaccionDeSucesion<T>(
  repositorio: { manager: EntityManager },
  trabajo: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  try {
    return await repositorio.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_SUCESION,
      ]);
      return trabajo(manager);
    });
  } catch (error) {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      throw new ConflictException(
        'El cambio choca con otro plan o candidato (plan duplicado, candidato repetido o prioridad ya usada)',
      );
    }
    throw error;
  }
}
