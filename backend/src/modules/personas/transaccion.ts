import { ConflictException } from '@nestjs/common';
import { QueryFailedError, type EntityManager } from 'typeorm';
import { BLOQUEO_ESTRUCTURA } from '../estructura/transaccion.js';

/**
 * Convierte los errores de restricción de la base (exclusión de solapes y
 * unicidades) en 409 con un mensaje útil. Es el respaldo de las validaciones
 * previas de los servicios; el resto de los errores pasa sin cambios.
 */
export function traducirError(error: unknown): unknown {
  if (!(error instanceof QueryFailedError)) return error;
  const { code, detail } = (error.driverError ?? {}) as {
    code?: string;
    detail?: string;
  };
  if (code === '23P01') {
    return new ConflictException(
      'La persona ya ocupa ese puesto en un período que se superpone con el indicado',
    );
  }
  if (code === '23505') {
    const campos = /\(([^)]+)\)=/.exec(detail ?? '')?.[1] ?? '';
    if (campos.includes('fecha_desde')) {
      return new ConflictException(
        'La persona ya tiene una ocupación de ese puesto que empieza ese día',
      );
    }
    if (campos.includes('documento')) {
      return new ConflictException('Ya existe una persona con ese documento');
    }
    if (campos.includes('legajo')) {
      return new ConflictException('Ya existe una persona con ese legajo');
    }
    return new ConflictException('Ya existe un registro con esos datos');
  }
  return error;
}

/**
 * Ejecuta el trabajo en una transacción que antes toma el bloqueo consultivo
 * de estructura (el mismo que las bajas de puestos): un alta de ocupación y la
 * baja del puesto o de la persona no pueden cruzarse.
 */
export async function enTransaccionDePersonas<T>(
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
    throw traducirError(error);
  }
}
