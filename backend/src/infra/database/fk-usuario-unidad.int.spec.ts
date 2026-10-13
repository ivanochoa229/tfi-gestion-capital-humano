import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('FK usuario_unidad → unidad_organizativa', () => {
  let base: BaseTemporal | undefined;
  afterEach(async () => {
    await base?.destruir();
    base = undefined;
  });

  const crearUsuario = async (b: BaseTemporal) =>
    (
      await b.dataSource.query(
        `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol)
         SELECT 'jefe', 'x', id_rol FROM rol WHERE codigo = 'jefe_catedra'
         RETURNING id_usuario AS id`,
      )
    )[0].id as number;

  it('la migración aborta y lista las unidades inexistentes', async () => {
    base = await crearBaseTemporal({ sin: ['AgregarFkUsuarioUnidad'] });
    const idUsuario = await crearUsuario(base);
    await base.dataSource.query(
      'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, 999), ($1, 998)',
      [idUsuario],
    );
    await expect(base.aplicarTodas()).rejects.toThrow(/998, 999/);
  });

  it('con la FK aplicada, no se puede asignar una unidad inexistente', async () => {
    base = await crearBaseTemporal();
    const idUsuario = await crearUsuario(base);
    await expect(
      base.dataSource.query(
        'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, 999)',
        [idUsuario],
      ),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });

  it('no se puede borrar una unidad asignada a un usuario', async () => {
    base = await crearBaseTemporal();
    const idUsuario = await crearUsuario(base);
    const [{ id }] = await base.dataSource.query(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    await base.dataSource.query(
      'INSERT INTO usuario_unidad (id_usuario, id_unidad) VALUES ($1, $2)',
      [idUsuario, id],
    );
    await expect(
      base.dataSource.query(
        'DELETE FROM unidad_organizativa WHERE id_unidad = $1',
        [id],
      ),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });
});
