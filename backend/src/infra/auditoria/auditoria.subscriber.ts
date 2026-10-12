import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { Auditoria, type OperacionAuditada } from './auditoria.entity.js';
import { usuarioDelContexto } from './contexto-usuario.js';

/** Tablas cuyos cambios se auditan (RNF05). Se declaran aunque aún no existan. */
export const ENTIDADES_AUDITADAS = [
  'evaluacion_criticidad',
  'plan_sucesion',
  'candidato_sucesion',
];

type Registro = Record<string, unknown>;

/**
 * Escribe en `auditoria`, dentro de la misma transacción, cada alta, modificación
 * y baja de las entidades auditadas. Sin usuario en el contexto, falla.
 */
@Injectable()
export class AuditoriaSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  afterInsert(evento: InsertEvent<Registro>): Promise<void> | void {
    return this.registrar(
      evento,
      'alta',
      evento.entity as Registro,
      null,
      evento.entity as Registro,
    );
  }

  afterUpdate(evento: UpdateEvent<Registro>): Promise<void> | void {
    const columnas = evento.updatedColumns ?? [];
    if (columnas.length === 0 || !evento.entity || !evento.databaseEntity)
      return;

    const anteriores: Registro = {};
    const nuevos: Registro = {};
    for (const columna of columnas) {
      anteriores[columna.databaseName] =
        evento.databaseEntity[columna.propertyName];
      nuevos[columna.databaseName] = (evento.entity as Registro)[
        columna.propertyName
      ];
    }
    return this.registrar(
      evento,
      'modificacion',
      evento.entity as Registro,
      anteriores,
      nuevos,
    );
  }

  afterRemove(evento: RemoveEvent<Registro>): Promise<void> | void {
    const anterior = evento.databaseEntity as Registro;
    return this.registrar(evento, 'baja', anterior, anterior, null);
  }

  private async registrar(
    evento:
      InsertEvent<Registro> | UpdateEvent<Registro> | RemoveEvent<Registro>,
    operacion: OperacionAuditada,
    registro: Registro,
    valoresAnteriores: Registro | null,
    valoresNuevos: Registro | null,
  ): Promise<void> {
    const tabla = evento.metadata.tableName;
    if (!ENTIDADES_AUDITADAS.includes(tabla)) return;

    const idUsuario = usuarioDelContexto();
    if (idUsuario === null) {
      throw new Error(
        `No se puede modificar "${tabla}" sin un usuario autenticado: la operación no quedaría auditada`,
      );
    }

    const idRegistro =
      'entityId' in evento &&
      evento.entityId !== undefined &&
      evento.entityId !== null
        ? String(evento.entityId)
        : evento.metadata.primaryColumns
            .map((c) => String(c.getEntityValue(registro)))
            .join('-');

    await evento.manager.insert(Auditoria, {
      entidad: tabla,
      idRegistro,
      operacion,
      idUsuario,
      valoresAnteriores: valoresAnteriores as never,
      valoresNuevos: valoresNuevos as never,
    });
  }
}
