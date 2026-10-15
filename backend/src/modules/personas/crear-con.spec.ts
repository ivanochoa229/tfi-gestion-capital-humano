import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { PersonasService } from './personas.service.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';

describe('crearCon (cuerpo del alta, sin transacción propia)', () => {
  it('PersonasService.crearCon guarda con el manager recibido y devuelve el id', async () => {
    const repo = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((datos: object) => datos),
      save: vi.fn(async (datos: object) => ({ ...datos, id: 7 })),
    };
    const manager = { getRepository: vi.fn(() => repo), transaction: vi.fn() };
    const abreTransaccion = vi.fn();
    const servicio = new PersonasService(
      { manager: { transaction: abreTransaccion } } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const id = await servicio.crearCon(manager as never, {
      legajo: 'L-1',
      apellido: 'Pérez',
      nombre: 'Ana',
      documento: '30111111',
      fechaNacimiento: '1980-05-20',
      fechaIngreso: '2005-03-01',
      idSituacionRevista: 1,
    });

    expect(id).toBe(7);
    expect(manager.getRepository).toHaveBeenCalledWith(Persona);
    expect(repo.save).toHaveBeenCalledOnce();
    expect(abreTransaccion).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });

  it('OcupacionesService.crearCon guarda con el manager recibido y no abre transacción', async () => {
    const persona = { id: 1, activo: true, apellido: 'Pérez', nombre: 'Ana' };
    const puesto = { id: 10, codigo: 'P-0010', activo: true };
    const repoOcupaciones = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((datos: object) => datos),
      save: vi.fn(async (datos: object) => datos),
    };
    const repos = new Map<unknown, unknown>([
      [Persona, { findOne: vi.fn().mockResolvedValue(persona) }],
      [Puesto, { findOne: vi.fn().mockResolvedValue(puesto) }],
      [Ocupacion, repoOcupaciones],
    ]);
    const manager = {
      getRepository: vi.fn((clase: unknown) => repos.get(clase)),
      query: vi.fn().mockResolvedValue([{ hoy: '2026-06-15' }]),
      transaction: vi.fn(),
    };
    const abreTransaccion = vi.fn();
    const servicio = new OcupacionesService(
      { manager: { transaction: abreTransaccion } } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const creada = await servicio.crearCon(manager as never, 1, {
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      idCaracterOcupacion: 1,
      idDedicacion: 1,
    });

    expect(creada).toMatchObject({
      idPersona: 1,
      idPuesto: 10,
      fechaDesde: '2024-01-01',
      fechaHasta: null,
      estado: 'vigente',
    });
    expect(abreTransaccion).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });
});
