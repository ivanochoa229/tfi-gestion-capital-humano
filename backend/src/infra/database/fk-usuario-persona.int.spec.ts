import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';

describe('FK usuario.id_persona → persona', () => {
  let base: BaseTemporal | undefined;
  afterEach(async () => {
    await base?.destruir();
    base = undefined;
  });

  const crearUsuario = (
    b: BaseTemporal,
    nombre: string,
    idPersona: number | null,
  ) =>
    b.dataSource.query(
      `INSERT INTO usuario (nombre_usuario, clave_hash, id_rol, id_persona)
       SELECT $1, 'x', id_rol, $2 FROM rol WHERE codigo = 'docente'`,
      [nombre, idPersona],
    );

  const crearPersona = async (b: BaseTemporal) =>
    (
      await b.dataSource.query(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
         SELECT 'L-1', 'Pérez', 'Ana', '30111111', '1980-01-01', '2005-03-01', id_situacion_revista
         FROM situacion_revista WHERE codigo = 'planta_permanente'
         RETURNING id_persona AS id`,
      )
    )[0].id as number;

  it('la migración aborta y lista las personas inexistentes', async () => {
    base = await crearBaseTemporal({ sin: ['AgregarFkUsuarioPersona'] });
    await crearUsuario(base, 'uno', 999);
    await crearUsuario(base, 'dos', 998);
    await expect(base.aplicarTodas()).rejects.toThrow(/998, 999/);
  });

  it('con la FK aplicada, no se puede vincular una persona inexistente', async () => {
    base = await crearBaseTemporal();
    await expect(crearUsuario(base, 'uno', 999)).rejects.toThrow(
      /foreign key|viola la llave/i,
    );
  });

  it('admite usuarios sin persona y con una persona existente', async () => {
    base = await crearBaseTemporal();
    await crearUsuario(base, 'sin', null);
    await crearUsuario(base, 'con', await crearPersona(base));
  });

  it('no se puede borrar una persona vinculada a un usuario', async () => {
    base = await crearBaseTemporal();
    const id = await crearPersona(base);
    await crearUsuario(base, 'con', id);
    await expect(
      base.dataSource.query('DELETE FROM persona WHERE id_persona = $1', [id]),
    ).rejects.toThrow(/foreign key|viola la llave/i);
  });
});
