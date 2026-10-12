import type { DataSource } from 'typeorm';
import { Auditoria } from './auditoria.entity.js';
import { AuditoriaSubscriber } from './auditoria.subscriber.js';
import { contextoUsuario } from './contexto-usuario.js';

function evento(tabla: string, extra: Record<string, unknown> = {}) {
  const insert = vi.fn(async () => undefined);
  return {
    insert,
    evento: {
      metadata: {
        tableName: tabla,
        primaryColumns: [{ getEntityValue: (e: { id: number }) => e.id }],
      },
      manager: { insert },
      ...extra,
    } as never,
  };
}

const subscriber = () =>
  new AuditoriaSubscriber({ subscribers: [] } as unknown as DataSource);
const comoUsuario = <T>(id: number | null, fn: () => T) =>
  contextoUsuario.run({ idUsuario: id }, fn);

describe('AuditoriaSubscriber', () => {
  it('se registra en el DataSource', () => {
    const ds = { subscribers: [] as unknown[] };
    const s = new AuditoriaSubscriber(ds as unknown as DataSource);
    expect(ds.subscribers).toContain(s);
  });

  it('registra un alta con el registro completo y el usuario', async () => {
    const { insert, evento: e } = evento('plan_sucesion', {
      entity: { id: 5, estado: 'borrador' },
    });
    await comoUsuario(7, () => subscriber().afterInsert(e));
    expect(insert).toHaveBeenCalledWith(Auditoria, {
      entidad: 'plan_sucesion',
      idRegistro: '5',
      operacion: 'alta',
      idUsuario: 7,
      valoresAnteriores: null,
      valoresNuevos: { id: 5, estado: 'borrador' },
    });
  });

  it('registra solo las columnas modificadas con su valor anterior y el nuevo', async () => {
    const { insert, evento: e } = evento('evaluacion_criticidad', {
      entity: { id: 3, nivel: 'alta', observaciones: 'x' },
      databaseEntity: { id: 3, nivel: 'media', observaciones: 'x' },
      updatedColumns: [{ propertyName: 'nivel', databaseName: 'nivel' }],
    });
    await comoUsuario(7, () => subscriber().afterUpdate(e));
    expect(insert).toHaveBeenCalledWith(
      Auditoria,
      expect.objectContaining({
        operacion: 'modificacion',
        valoresAnteriores: { nivel: 'media' },
        valoresNuevos: { nivel: 'alta' },
      }),
    );
  });

  it('no registra una modificación sin columnas cambiadas', async () => {
    const { insert, evento: e } = evento('plan_sucesion', {
      entity: { id: 3 },
      databaseEntity: { id: 3 },
      updatedColumns: [],
    });
    await comoUsuario(7, () => subscriber().afterUpdate(e));
    expect(insert).not.toHaveBeenCalled();
  });

  it('registra una baja con el registro anterior', async () => {
    const { insert, evento: e } = evento('candidato_sucesion', {
      databaseEntity: { id: 8, prioridad: 1 },
      entityId: 8,
    });
    await comoUsuario(7, () => subscriber().afterRemove(e));
    expect(insert).toHaveBeenCalledWith(
      Auditoria,
      expect.objectContaining({
        operacion: 'baja',
        idRegistro: '8',
        valoresAnteriores: { id: 8, prioridad: 1 },
        valoresNuevos: null,
      }),
    );
  });

  it('ignora las entidades que no están en la lista auditada', async () => {
    const { insert, evento: e } = evento('persona', { entity: { id: 1 } });
    await comoUsuario(7, () => subscriber().afterInsert(e));
    expect(insert).not.toHaveBeenCalled();
  });

  it('falla si se escribe una entidad auditada sin usuario en el contexto', async () => {
    const { evento: e } = evento('plan_sucesion', { entity: { id: 1 } });
    await expect(
      comoUsuario(null, () => subscriber().afterInsert(e)),
    ).rejects.toThrow(/usuario autenticado/);
  });
});
