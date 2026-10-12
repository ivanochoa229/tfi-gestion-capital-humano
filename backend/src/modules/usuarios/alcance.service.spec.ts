import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from './alcance.service.js';

const sesion = (rol: CodigoRol, unidades: number[] = []): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona: null,
  unidades,
});

function crear(descendientes: number[]) {
  const query = vi.fn(async () =>
    descendientes.map((id_unidad) => ({ id_unidad })),
  );
  return {
    servicio: new AlcanceService({ query } as unknown as DataSource),
    query,
  };
}

describe('AlcanceService.unidadesVisibles', () => {
  it.each(['analista_puestos', 'recursos_humanos', 'autoridad'] as CodigoRol[])(
    'no restringe al rol global %s',
    async (rol) => {
      const { servicio, query } = crear([]);
      expect(await servicio.unidadesVisibles(sesion(rol))).toBeNull();
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('devuelve las unidades asignadas más sus descendientes a la jefatura', async () => {
    const { servicio, query } = crear([1, 2, 3, 4]);
    expect(
      await servicio.unidadesVisibles(sesion('jefatura_departamento', [1])),
    ).toEqual([1, 2, 3, 4]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WITH RECURSIVE'),
      [[1]],
    );
  });

  it('limita al jefe de cátedra a su cátedra', async () => {
    const { servicio } = crear([3]);
    expect(
      await servicio.unidadesVisibles(sesion('jefe_catedra', [3])),
    ).toEqual([3]);
  });

  it('no consulta la base si el jefe no tiene unidades asignadas y ve solo lo vacío', async () => {
    const { servicio, query } = crear([]);
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra', []))).toEqual(
      [],
    );
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['administrador', 'docente'] as CodigoRol[])(
    'no da visibilidad por unidad al rol %s',
    async (rol) => {
      const { servicio } = crear([9]);
      expect(await servicio.unidadesVisibles(sesion(rol))).toEqual([]);
    },
  );
});

describe('AlcanceService.exigirUnidad', () => {
  it('deja pasar a un rol global en cualquier unidad', async () => {
    const { servicio } = crear([]);
    await expect(
      servicio.exigirUnidad(sesion('recursos_humanos'), 99),
    ).resolves.toBeUndefined();
  });

  it('deja pasar una unidad dentro del alcance', async () => {
    const { servicio } = crear([1, 2]);
    await expect(
      servicio.exigirUnidad(sesion('jefatura_departamento', [1]), 2),
    ).resolves.toBeUndefined();
  });

  it('rechaza con 403 una unidad fuera del alcance', async () => {
    const { servicio } = crear([3]);
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [3]), 7),
    ).rejects.toThrow(ForbiddenException);
  });
});
