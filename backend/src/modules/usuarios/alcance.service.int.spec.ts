import { ForbiddenException } from '@nestjs/common';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { AlcanceService } from './alcance.service.js';

const sesion = (rol: CodigoRol, unidades: number[] = []): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona: null,
  unidades,
});

describe('AlcanceService (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let servicio: AlcanceService;
  let departamento: number;
  let otroDepartamento: number;
  let catedraA: number;
  let catedraB: number;
  let catedraDelOtro: number;

  const unidad = async (
    denominacion: string,
    tipo: string,
    superior: number | null,
  ) =>
    (
      await base.dataSource.query(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
         RETURNING id_unidad AS id`,
        [denominacion, tipo, superior],
      )
    )[0].id as number;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    servicio = new AlcanceService(base.dataSource);
    departamento = (
      await base.dataSource.query(
        `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
      )
    )[0].id;
    otroDepartamento = await unidad('Otro departamento', 'departamento', null);
    catedraA = await unidad('Cátedra A', 'catedra', departamento);
    catedraB = await unidad('Cátedra B', 'catedra', departamento);
    catedraDelOtro = await unidad('Cátedra X', 'catedra', otroDepartamento);
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('la jefatura ve su departamento y sus cátedras, no las de otro departamento', async () => {
    const visibles = await servicio.unidadesVisibles(
      sesion('jefatura_departamento', [departamento]),
    );
    expect(visibles?.sort()).toEqual([departamento, catedraA, catedraB].sort());
    expect(visibles).not.toContain(catedraDelOtro);
  });

  it('el jefe de cátedra ve solo su cátedra', async () => {
    expect(
      await servicio.unidadesVisibles(sesion('jefe_catedra', [catedraA])),
    ).toEqual([catedraA]);
  });

  it('un jefe sin unidades asignadas no ve ninguna', async () => {
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra'))).toEqual([]);
  });

  it('los roles globales no tienen restricción', async () => {
    expect(
      await servicio.unidadesVisibles(sesion('recursos_humanos')),
    ).toBeNull();
  });

  it('exigirUnidad rechaza con 403 una unidad fuera del alcance', async () => {
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [catedraA]), catedraB),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [catedraA]), catedraA),
    ).resolves.toBeUndefined();
  });
});
