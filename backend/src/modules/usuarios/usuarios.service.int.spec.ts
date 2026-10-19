import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { UnidadesService } from '../estructura/unidades.service.js';
import { PersonasService } from '../personas/personas.service.js';
import { Rol } from './entities/rol.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import { SesionesService } from './sesiones.service.js';
import { UsuariosService } from './usuarios.service.js';

describe('UsuariosService (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let servicio: UsuariosService;
  let idCatedra: number;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    idCatedra = (
      await base.dataSource.query(
        `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
         SELECT 'Cátedra A', t.id_tipo_unidad,
                (SELECT id_unidad FROM unidad_organizativa WHERE id_unidad_superior IS NULL)
         FROM tipo_unidad t WHERE t.codigo = 'catedra'
         RETURNING id_unidad AS id`,
      )
    )[0].id;
    const unidades = {
      buscarPorIds: async (ids: number[]) =>
        ids.map((id) => ({
          id,
          denominacion: 'Cátedra A',
          activo: true,
          tipo: { codigo: 'catedra' },
        })),
    };
    servicio = new UsuariosService(
      base.dataSource.getRepository(Usuario),
      base.dataSource.getRepository(Rol),
      new PasswordService(),
      { cerrarDe: vi.fn() } as unknown as SesionesService,
      unidades as unknown as UnidadesService,
      { exigirActiva: vi.fn() } as unknown as PersonasService,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });

  it('crea un jefe de cátedra con sus unidades asignadas', async () => {
    const dto = await servicio.crear({
      nombreUsuario: 'jefe.nuevo',
      clave: 'clave-larga-123',
      rol: 'jefe_catedra',
      idUnidades: [idCatedra],
    });
    expect(dto.idUnidades).toEqual([idCatedra]);
    const filas = await base.dataSource.query(
      'SELECT id_unidad FROM usuario_unidad WHERE id_usuario = $1',
      [dto.id],
    );
    expect(filas.map((f: { id_unidad: number }) => f.id_unidad)).toEqual([
      idCatedra,
    ]);
  });
});
