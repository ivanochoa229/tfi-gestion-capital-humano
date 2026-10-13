import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { UnidadesService } from './unidades.service.js';

const unidad = (
  parcial: Partial<UnidadOrganizativa> = {},
): UnidadOrganizativa =>
  ({
    id: 1,
    denominacion: 'Departamento de Sistemas',
    idTipoUnidad: 1,
    tipo: {
      id: 1,
      codigo: 'departamento',
      denominacion: 'Departamento',
      activo: true,
    },
    idUnidadSuperior: null,
    activo: true,
    ...parcial,
  }) as UnidadOrganizativa;

function crear(unidades: UnidadOrganizativa[], puestosActivos = 0) {
  const repoUnidades = {
    find: vi.fn(async ({ where }: { where: { activo?: boolean } }) =>
      unidades.filter(
        (u) => where.activo === undefined || u.activo === where.activo,
      ),
    ),
    findOne: vi.fn(
      async ({ where }: { where: { id: number } }) =>
        unidades.find((u) => u.id === where.id) ?? null,
    ),
  } as unknown as Repository<UnidadOrganizativa>;
  const repoPuestos = {
    count: vi.fn(async () => puestosActivos),
  } as unknown as Repository<Puesto>;
  return {
    servicio: new UnidadesService(repoUnidades, repoPuestos),
    repoUnidades,
    repoPuestos,
  };
}

describe('UnidadesService', () => {
  const catedra = unidad({
    id: 2,
    denominacion: 'Bases de Datos',
    tipo: { id: 2, codigo: 'catedra', denominacion: 'Cátedra', activo: true },
    idUnidadSuperior: 1,
  });
  const inactiva = unidad({
    id: 3,
    denominacion: 'Vieja',
    activo: false,
    idUnidadSuperior: 1,
  });

  it('lista solo las activas por defecto, con el código del tipo', async () => {
    const { servicio } = crear([unidad(), catedra, inactiva]);
    const lista = await servicio.listar();
    expect(lista.map((u) => [u.id, u.tipo])).toEqual([
      [1, 'departamento'],
      [2, 'catedra'],
    ]);
  });

  it('suma las inactivas si se piden', async () => {
    const { servicio } = crear([unidad(), catedra, inactiva]);
    expect(await servicio.listar(true)).toHaveLength(3);
  });

  it('arma el árbol con las cátedras bajo el departamento', async () => {
    const { servicio } = crear([unidad(), catedra]);
    const arbol = await servicio.arbol();
    expect(arbol).toHaveLength(1);
    expect(arbol[0].hijas.map((h) => h.id)).toEqual([2]);
  });

  it('obtiene una unidad con la cantidad de puestos activos', async () => {
    const { servicio } = crear([catedra], 4);
    expect(await servicio.obtener(2)).toMatchObject({
      id: 2,
      tipo: 'catedra',
      cantidadPuestosActivos: 4,
    });
  });

  it('responde 404 si la unidad no existe', async () => {
    const { servicio } = crear([]);
    await expect(servicio.obtener(9)).rejects.toThrow(NotFoundException);
    await expect(servicio.exigirActiva(9)).rejects.toThrow(NotFoundException);
  });

  it('exigirActiva rechaza una unidad inactiva con 400', async () => {
    const { servicio } = crear([inactiva]);
    await expect(servicio.exigirActiva(3)).rejects.toThrow(BadRequestException);
  });

  it('exigirActiva devuelve la unidad con su tipo', async () => {
    const { servicio } = crear([catedra]);
    expect((await servicio.exigirActiva(2)).tipo.codigo).toBe('catedra');
  });

  it('buscarPorIds no consulta la base si no hay ids', async () => {
    const { servicio, repoUnidades } = crear([catedra]);
    expect(await servicio.buscarPorIds([])).toEqual([]);
    expect(repoUnidades.find).not.toHaveBeenCalled();
  });
});
