import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import type { UnidadesService } from './unidades.service.js';

const NIVELES = [
  { id: 11, codigo: 'conduccion_departamento' },
  { id: 12, codigo: 'conduccion_catedra' },
  { id: 13, codigo: 'coordinacion_docente' },
  { id: 14, codigo: 'operativo_docente' },
];

const catedra = (parcial: Partial<UnidadOrganizativa> = {}) =>
  ({
    id: 20,
    denominacion: 'Bases de Datos',
    activo: true,
    idUnidadSuperior: 1,
    tipo: { codigo: 'catedra' },
    ...parcial,
  }) as UnidadOrganizativa;

function puesto(parcial: Partial<Puesto>): Puesto {
  return {
    id: 1,
    codigo: 'P-0001',
    denominacion: 'Jefatura de Departamento',
    idUnidad: 1,
    idNivelJerarquico: 11,
    activo: true,
    idPuestoSuperior: null,
    ...parcial,
  } as Puesto;
}

function crearEntorno(
  existentes: Puesto[],
  opciones: { unidad?: UnidadOrganizativa; niveles?: typeof NIVELES } = {},
) {
  const filas = existentes.map((p) => ({ ...p }));
  let proximoId = 100;
  let secuencia = 0;
  const repo = {
    find: vi.fn(async ({ where }: { where: Partial<Puesto> }) =>
      filas.filter((p) =>
        Object.entries(where).every(([k, v]) => p[k as keyof Puesto] === v),
      ),
    ),
    create: vi.fn((datos: Partial<Puesto>) => ({ ...datos })),
    save: vi.fn(async (p: Partial<Puesto>) => {
      const nuevo = { ...p, id: proximoId++ } as Puesto;
      filas.push(nuevo);
      return nuevo;
    }),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('nextval') ? [{ n: String(++secuencia) }] : [],
    ),
    getRepository: () => repo,
    transaction: async (trabajo: (m: unknown) => Promise<unknown>) =>
      trabajo(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const unidades = {
    exigirActiva: vi.fn(async () => opciones.unidad ?? catedra()),
  };
  const referencia = {
    listarValores: vi.fn(async () => opciones.niveles ?? NIVELES),
  };
  return {
    servicio: new PuestosTipoService(
      repo as unknown as Repository<Puesto>,
      unidades as unknown as UnidadesService,
      referencia as unknown as ReferenciaService,
    ),
    repo,
    filas,
  };
}

describe('PuestosTipoService.crear', () => {
  it('crea los cuatro cargos con nivel, superior y códigos consecutivos', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1 })]);
    const { puestos, advertencias } = await servicio.crear(20);

    expect(advertencias).toEqual([]);
    expect(
      puestos.map((p) => [p.codigo, p.denominacion, p.idNivelJerarquico]),
    ).toEqual([
      ['P-0001', 'Jefe de cátedra', 12],
      ['P-0002', 'Profesor auxiliar', 13],
      ['P-0003', 'Jefe de trabajos prácticos', 13],
      ['P-0004', 'Auxiliar de trabajos prácticos', 14],
    ]);
    const [jefe, profesor, jtp, atp] = puestos;
    expect(jefe.idPuestoSuperior).toBe(1); // jefatura del departamento
    expect(profesor.idPuestoSuperior).toBe(jefe.id);
    expect(jtp.idPuestoSuperior).toBe(jefe.id);
    expect(atp.idPuestoSuperior).toBe(jtp.id);
    expect(
      puestos.every(
        (p) => p.idUnidad === 20 && p.dotacionPrevista === 1 && p.activo,
      ),
    ).toBe(true);
  });

  it('crea el jefe sin superior y avisa si no hay jefatura de departamento', async () => {
    const { servicio } = crearEntorno([]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toMatch(/jefatura de departamento/i);
  });

  it('avisa y deja al jefe sin superior si hay más de una jefatura activa', async () => {
    const { servicio } = crearEntorno([
      puesto({ id: 1 }),
      puesto({ id: 2, codigo: 'P-0002', denominacion: 'Jefatura bis' }),
    ]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias[0]).toMatch(/más de un puesto/i);
  });

  it('ignora una jefatura dada de baja', async () => {
    const { servicio } = crearEntorno([puesto({ id: 1, activo: false })]);
    const { puestos, advertencias } = await servicio.crear(20);
    expect(puestos[0].idPuestoSuperior).toBeNull();
    expect(advertencias).toHaveLength(1);
  });

  it('rechaza con 409 y no crea nada si ya existe algún cargo, sin distinguir mayúsculas', async () => {
    const { servicio, repo } = crearEntorno([
      puesto({ id: 1 }),
      puesto({
        id: 7,
        codigo: 'P-0007',
        denominacion: 'jefe de CÁTEDRA',
        idUnidad: 20,
      }),
    ]);
    await expect(servicio.crear(20)).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('un cargo dado de baja no impide crear los puestos tipo', async () => {
    const { servicio } = crearEntorno([
      puesto({
        id: 7,
        codigo: 'P-0007',
        denominacion: 'Jefe de cátedra',
        idUnidad: 20,
        activo: false,
      }),
    ]);
    await expect(servicio.crear(20)).resolves.toMatchObject({
      puestos: expect.arrayContaining([
        expect.objectContaining({ denominacion: 'Jefe de cátedra' }),
      ]),
    });
  });

  it('rechaza con 400 una unidad que no es cátedra', async () => {
    const { servicio } = crearEntorno([], {
      unidad: catedra({ tipo: { codigo: 'departamento' } as never }),
    });
    await expect(servicio.crear(20)).rejects.toThrow(BadRequestException);
  });

  it('propaga el 404 de una unidad inexistente', async () => {
    const { servicio } = crearEntorno([]);
    // exigirActiva ya devuelve la unidad; simulamos su 404 reemplazando el mock.
    const falla = new NotFoundException('No existe la unidad 99');
    (
      servicio as unknown as { unidades: { exigirActiva: () => never } }
    ).unidades.exigirActiva = () => {
      throw falla;
    };
    await expect(servicio.crear(99)).rejects.toBe(falla);
  });

  it('rechaza con 400 si falta algún nivel jerárquico activo', async () => {
    const { servicio, repo } = crearEntorno([], {
      niveles: NIVELES.filter((n) => n.codigo !== 'operativo_docente'),
    });
    await expect(servicio.crear(20)).rejects.toThrow(/operativo_docente/);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
