import { NotFoundException, ConflictException } from '@nestjs/common';
import {
  crearEntornoActivos,
  type EntornoActivos,
} from '../../testing/entorno-activos.js';

describe('Activos: lectura (PostgreSQL real)', () => {
  let e: EntornoActivos;

  const insertar = async (o: {
    titulo: string;
    unidad?: number;
    origen?: 'archivo' | 'enlace';
    hash?: string;
    vigencia?: string | null;
    activo?: boolean;
    conocimientos?: number[];
  }) => {
    const archivo = (o.origen ?? 'archivo') === 'archivo';
    const [{ id }] = await e.sql<{ id: number }[]>(
      `INSERT INTO activo_conocimiento
         (titulo, id_tipo_documento, id_unidad, origen, ubicacion, nombre_original, tipo_mime, tamanio, hash, fecha_vigencia, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id_activo AS id`,
      [
        o.titulo,
        e.ids.tipoDocumento,
        o.unidad ?? e.ids.catedraA,
        archivo ? 'archivo' : 'enlace',
        archivo ? `activos/9/${o.titulo}.pdf` : 'https://wiki.example/x',
        archivo ? `${o.titulo}.pdf` : null,
        archivo ? 'application/pdf' : null,
        archivo ? 12 : null,
        archivo ? (o.hash ?? o.titulo.padEnd(64, '0')) : null,
        o.vigencia ?? null,
        o.activo ?? true,
      ],
    );
    for (const c of o.conocimientos ?? [e.ids.conocimientoA]) {
      await e.sql(
        `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento) VALUES ($1, $2)`,
        [id, c],
      );
    }
    return id;
  };
  const dia = async (delta: number) =>
    (
      await e.sql<{ f: string }[]>(
        `SELECT (CURRENT_DATE + $1::int)::text AS f`,
        [delta],
      )
    )[0].f;

  beforeAll(async () => {
    e = await crearEntornoActivos();
  });
  afterAll(async () => {
    await e.destruir();
  });
  afterEach(async () => {
    await e.sql('DELETE FROM activo_conocimiento_conocimiento');
    await e.sql('DELETE FROM activo_conocimiento');
    e.almacen.objetos.clear();
  });

  it('calcula vencido y días para vencer con la fecha de la base', async () => {
    await insertar({ titulo: 'ayer', vigencia: await dia(-1) });
    await insertar({ titulo: 'hoy', vigencia: await dia(0) });
    await insertar({ titulo: 'manana', vigencia: await dia(1) });
    await insertar({ titulo: 'sinfecha' });
    const { items } = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    const por = Object.fromEntries(items.map((a) => [a.titulo, a]));
    expect(por.ayer).toMatchObject({ vencido: true, diasParaVencer: -1 });
    expect(por.hoy).toMatchObject({ vencido: false, diasParaVencer: 0 });
    expect(por.manana).toMatchObject({ vencido: false, diasParaVencer: 1 });
    expect(por.sinfecha).toMatchObject({
      vencido: false,
      diasParaVencer: null,
      fechaVigencia: null,
    });
  });

  it('filtra por título, conocimiento, unidad, tipo y vigencia', async () => {
    await insertar({
      titulo: 'Manual SQL',
      conocimientos: [e.ids.conocimientoA],
    });
    await insertar({
      titulo: 'Guía de redes',
      unidad: e.ids.catedraB,
      conocimientos: [e.ids.conocimientoB],
      vigencia: await dia(-5),
    });
    const lista = (filtro: object) =>
      e.servicio
        .listar(e.sesiones.analista, {
          pagina: 1,
          tamanio: 20,
          ...filtro,
        } as never)
        .then((p) => p.items.map((a) => a.titulo));
    expect(await lista({ q: 'sql' })).toEqual(['Manual SQL']);
    expect(await lista({ q: '%' })).toEqual([]);
    expect(await lista({ idConocimiento: e.ids.conocimientoB })).toEqual([
      'Guía de redes',
    ]);
    expect(await lista({ idUnidad: e.ids.catedraA })).toEqual(['Manual SQL']);
    expect(await lista({ idTipoDocumento: e.ids.tipoDocumento })).toHaveLength(
      2,
    );
    expect(await lista({ vencido: true })).toEqual(['Guía de redes']);
    expect(await lista({ vencido: false })).toEqual(['Manual SQL']);
  });

  it('pagina y devuelve el total', async () => {
    for (const t of ['a1', 'a2', 'a3']) await insertar({ titulo: t });
    const p = await e.servicio.listar(e.sesiones.analista, {
      pagina: 2,
      tamanio: 2,
    } as never);
    expect(p.total).toBe(3);
    expect(p.items.map((a) => a.titulo)).toEqual(['a3']);
  });

  it('lista los vínculos de cada activo', async () => {
    await insertar({
      titulo: 'Doble',
      conocimientos: [e.ids.conocimientoB, e.ids.conocimientoA],
    });
    const { items } = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    expect(items[0].idsConocimiento).toEqual(
      [e.ids.conocimientoA, e.ids.conocimientoB].sort((x, y) => x - y),
    );
  });

  it('oculta las bajas a quien no escribe y las muestra al escritor que las pide', async () => {
    const baja = await insertar({ titulo: 'vieja', activo: false });
    await insertar({ titulo: 'vigente' });
    const filtro = { pagina: 1, tamanio: 20, incluirBajas: true } as never;
    const docente = await e.servicio.listar(e.sesiones.docente, filtro);
    expect(docente.items.map((a) => a.titulo)).toEqual(['vigente']);
    const analista = await e.servicio.listar(e.sesiones.analista, filtro);
    expect(analista.items.map((a) => a.titulo).sort()).toEqual([
      'vieja',
      'vigente',
    ]);
    const sinPedir = await e.servicio.listar(e.sesiones.analista, {
      pagina: 1,
      tamanio: 20,
    } as never);
    expect(sinPedir.items.map((a) => a.titulo)).toEqual(['vigente']);
    await expect(
      e.servicio.obtener(e.sesiones.docente, baja),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      e.servicio.obtener(e.sesiones.analista, baja),
    ).resolves.toMatchObject({
      activo: false,
    });
  });

  it('no expone la clave del objeto ni el hash, y sí la URL de un enlace', async () => {
    const archivo = await insertar({ titulo: 'doc' });
    const enlace = await insertar({ titulo: 'wiki', origen: 'enlace' });
    const a = await e.servicio.obtener(e.sesiones.docente, archivo);
    expect(a.enlace).toBeNull();
    expect(JSON.stringify(a)).not.toContain('activos/9');
    expect(a).not.toHaveProperty('hash');
    const b = await e.servicio.obtener(e.sesiones.docente, enlace);
    expect(b.enlace).toBe('https://wiki.example/x');
  });

  it('responde 404 si el activo no existe', async () => {
    await expect(
      e.servicio.obtener(e.sesiones.analista, 999999),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('descarga el contenido con su nombre y tipo, para cualquier rol', async () => {
    const id = await insertar({ titulo: 'doc' });
    e.almacen.objetos.set(`activos/9/doc.pdf`, {
      contenido: Buffer.from('%PDF-1.7 hola'),
      tipoMime: 'application/pdf',
    });
    const d = await e.servicio.descargar(e.sesiones.docente, id);
    const partes: Buffer[] = [];
    for await (const parte of d.flujo)
      partes.push(Buffer.from(parte as Buffer));
    expect(Buffer.concat(partes).toString()).toBe('%PDF-1.7 hola');
    expect(d).toMatchObject({
      nombre: 'doc.pdf',
      tipoMime: 'application/pdf',
      tamanio: 12,
    });
  });

  it('no descarga un enlace ni una baja ajena, y avisa si falta el objeto', async () => {
    const enlace = await insertar({ titulo: 'wiki', origen: 'enlace' });
    await expect(
      e.servicio.descargar(e.sesiones.docente, enlace),
    ).rejects.toBeInstanceOf(ConflictException);
    const baja = await insertar({ titulo: 'vieja', activo: false });
    await expect(
      e.servicio.descargar(e.sesiones.docente, baja),
    ).rejects.toBeInstanceOf(NotFoundException);
    // El escritor sí la descarga, pero el objeto no está en el bucket.
    await expect(
      e.servicio.descargar(e.sesiones.analista, baja),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
