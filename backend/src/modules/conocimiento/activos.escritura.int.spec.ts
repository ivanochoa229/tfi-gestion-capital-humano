import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  crearEntornoActivos,
  pdf,
  type EntornoActivos,
} from '../../testing/entorno-activos.js';
import { hashSha256 } from './archivo.js';
import type { ActualizarActivoDto, CrearActivoDto } from './dto/activos.dto.js';

describe('Activos: escritura (PostgreSQL real)', () => {
  let e: EntornoActivos;

  const dto = (parcial: Partial<CrearActivoDto> = {}): CrearActivoDto => ({
    titulo: 'Manual de SQL',
    idTipoDocumento: e.ids.tipoDocumento,
    idUnidad: e.ids.catedraA,
    idsConocimiento: [e.ids.conocimientoA],
    ...parcial,
  });
  const filas = () =>
    e.sql<{ id: number }[]>(`SELECT id_activo AS id FROM activo_conocimiento`);

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
    e.almacen.falloSubida = false;
    e.almacen.alSubir = undefined;
    e.ganchos.alValidarReferencia = undefined;
  });

  describe('alta', () => {
    it('sube el archivo y guarda metadatos, hash y vínculos', async () => {
      const archivo = pdf('contenido uno', 'Año nuevo.pdf');
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        archivo,
      );

      expect(creado).toMatchObject({
        titulo: 'Manual de SQL',
        origen: 'archivo',
        nombreOriginal: 'Año nuevo.pdf',
        tipoMime: 'application/pdf',
        tamanio: archivo.buffer.length,
        enlace: null,
        activo: true,
        idsConocimiento: [e.ids.conocimientoA],
      });
      const [fila] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(fila.hash).toBe(hashSha256(archivo.buffer));
      expect(fila.ubicacion).toMatch(
        new RegExp(`^activos/${creado.id}/[0-9a-f-]{36}-Ano_nuevo\\.pdf$`),
      );
      expect(e.almacen.objetos.get(fila.ubicacion)?.tipoMime).toBe(
        'application/pdf',
      );
    });

    it('registra un enlace sin tocar el almacén ni el hash', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto({
          enlace: 'https://wiki.example/sql',
          fechaVigencia: '2030-01-01',
        }),
      );
      expect(creado).toMatchObject({
        origen: 'enlace',
        enlace: 'https://wiki.example/sql',
        tipoMime: null,
        fechaVigencia: '2030-01-01',
      });
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('exige un archivo o un enlace, pero no ambos', async () => {
      await expect(
        e.servicio.crear(e.sesiones.analista, dto()),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ enlace: 'https://x.example' }),
          pdf('x'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza con 415 una extensión engañosa y no deja objeto ni fila', async () => {
      const ejecutable = {
        originalname: 'manual.pdf',
        buffer: Buffer.from('MZ\x90 programa'),
      };
      await expect(
        e.servicio.crear(e.sesiones.analista, dto(), ejecutable),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(await filas()).toHaveLength(0);
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('rechaza con 400 conocimientos inexistentes o dados de baja y una unidad inexistente', async () => {
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ idsConocimiento: [999999] }),
          pdf('a'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.sql(
        `UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`,
        [e.ids.conocimientoB],
      );
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ idsConocimiento: [e.ids.conocimientoB] }),
          pdf('a'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.sql(
        `UPDATE conocimiento SET activo = true WHERE id_conocimiento = $1`,
        [e.ids.conocimientoB],
      );
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ idUnidad: 999999 }),
          pdf('a'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(e.almacen.objetos.size).toBe(0);
    });

    it('rechaza con 409 el mismo archivo y nombra al existente', async () => {
      await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'Original' }),
        pdf('igual'),
      );
      const intento = e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'Copia' }),
        pdf('igual', 'otro-nombre.pdf'),
      );
      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toThrow(/Original/);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('con la misma subida simultánea queda un solo activo y ningún objeto huérfano', async () => {
      const resultados = await Promise.allSettled([
        e.servicio.crear(
          e.sesiones.analista,
          dto({ titulo: 'Uno' }),
          pdf('carrera'),
        ),
        e.servicio.crear(
          e.sesiones.analista,
          dto({ titulo: 'Dos' }),
          pdf('carrera'),
        ),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      const rechazo = resultados.find((r) => r.status === 'rejected');
      expect((rechazo as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
      expect(await filas()).toHaveLength(1);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('si falla la subida no escribe nada en la base', async () => {
      e.almacen.falloSubida = true;
      await expect(
        e.servicio.crear(e.sesiones.analista, dto(), pdf('a')),
      ).rejects.toThrow(/RustFS/);
      expect(await filas()).toHaveLength(0);
    });
  });

  describe('permisos', () => {
    it('el jefe de cátedra escribe en su unidad y no en otra', async () => {
      await expect(
        e.servicio.crear(
          e.sesiones.jefeA,
          dto({ idUnidad: e.ids.catedraA }),
          pdf('a'),
        ),
      ).resolves.toBeDefined();
      await expect(
        e.servicio.crear(
          e.sesiones.jefeA,
          dto({ idUnidad: e.ids.catedraB }),
          pdf('b'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el jefe no puede mover un activo a una unidad fuera de su alcance ni tocar uno ajeno', async () => {
      const propio = await e.servicio.crear(e.sesiones.jefeA, dto(), pdf('a'));
      await expect(
        e.servicio.actualizar(e.sesiones.jefeA, propio.id, {
          idUnidad: e.ids.catedraB,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const ajeno = await e.servicio.crear(
        e.sesiones.analista,
        dto({ idUnidad: e.ids.catedraB }),
        pdf('b'),
      );
      await expect(
        e.servicio.actualizar(e.sesiones.jefeA, ajeno.id, { titulo: 'Robado' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        e.servicio.darDeBaja(e.sesiones.jefeA, ajeno.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.jefeA, ajeno.id, pdf('c')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el docente no escribe', async () => {
      await expect(
        e.servicio.crear(e.sesiones.docente, dto(), pdf('a')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('edición', () => {
    it('cambia metadatos y vínculos sin tocar el archivo', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('a'),
      );
      const antes = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      const editado = await e.servicio.actualizar(
        e.sesiones.analista,
        creado.id,
        {
          titulo: 'Título nuevo',
          idUnidad: e.ids.catedraB,
          fechaVigencia: '2031-05-05',
          idsConocimiento: [e.ids.conocimientoB, e.ids.conocimientoA],
        },
      );
      expect(editado).toMatchObject({
        titulo: 'Título nuevo',
        idUnidad: e.ids.catedraB,
        fechaVigencia: '2031-05-05',
      });
      expect(editado.idsConocimiento).toHaveLength(2);
      const despues = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(despues[0].ubicacion).toBe(antes[0].ubicacion);
      const sinFecha = await e.servicio.actualizar(
        e.sesiones.analista,
        creado.id,
        {
          fechaVigencia: null,
        },
      );
      expect(sinFecha.fechaVigencia).toBeNull();
    });

    it('edita la URL de un enlace pero no la de un archivo, y exige algún vínculo', async () => {
      const enlace = await e.servicio.crear(
        e.sesiones.analista,
        dto({ enlace: 'https://a.example' }),
      );
      const nuevo = await e.servicio.actualizar(
        e.sesiones.analista,
        enlace.id,
        {
          enlace: 'https://b.example',
        },
      );
      expect(nuevo.enlace).toBe('https://b.example');
      const archivo = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('a'),
      );
      await expect(
        e.servicio.actualizar(e.sesiones.analista, archivo.id, {
          enlace: 'https://c.example',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        e.servicio.actualizar(e.sesiones.analista, archivo.id, {
          idsConocimiento: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza con 400 un null en los campos obligatorios', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('a'),
      );
      for (const parcial of [
        { titulo: null },
        { idTipoDocumento: null },
        { idUnidad: null },
        { idsConocimiento: null },
      ]) {
        await expect(
          e.servicio.actualizar(
            e.sesiones.analista,
            creado.id,
            parcial as unknown as ActualizarActivoDto,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    describe('con un conocimiento vinculado dado de baja', () => {
      const conBaja = async () => {
        const creado = await e.servicio.crear(
          e.sesiones.analista,
          dto({ idsConocimiento: [e.ids.conocimientoA, e.ids.conocimientoB] }),
          pdf('a'),
        );
        await e.sql(
          `UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`,
          [e.ids.conocimientoB],
        );
        return creado;
      };
      afterEach(async () => {
        await e.sql(
          `UPDATE conocimiento SET activo = true WHERE id_conocimiento = $1`,
          [e.ids.conocimientoB],
        );
      });

      it('conserva el vínculo al editar otro campo reenviando los mismos ids', async () => {
        const creado = await conBaja();
        const editado = await e.servicio.actualizar(
          e.sesiones.analista,
          creado.id,
          {
            titulo: 'Solo el título',
            idsConocimiento: [e.ids.conocimientoA, e.ids.conocimientoB],
          },
        );
        expect(editado.titulo).toBe('Solo el título');
        expect([...editado.idsConocimiento].sort()).toEqual(
          [e.ids.conocimientoA, e.ids.conocimientoB].sort(),
        );
      });

      it('rechaza con 400 sumar otro conocimiento dado de baja', async () => {
        const creado = await e.servicio.crear(
          e.sesiones.analista,
          dto(),
          pdf('a'),
        );
        await e.sql(
          `UPDATE conocimiento SET activo = false WHERE id_conocimiento = $1`,
          [e.ids.conocimientoB],
        );
        await expect(
          e.servicio.actualizar(e.sesiones.analista, creado.id, {
            idsConocimiento: [e.ids.conocimientoA, e.ids.conocimientoB],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('permite quitar el vínculo dado de baja', async () => {
        const creado = await conBaja();
        const editado = await e.servicio.actualizar(
          e.sesiones.analista,
          creado.id,
          {
            idsConocimiento: [e.ids.conocimientoA],
          },
        );
        expect(editado.idsConocimiento).toEqual([e.ids.conocimientoA]);
      });
    });

    it('responde 404 si no existe y 409 si está dado de baja', async () => {
      await expect(
        e.servicio.actualizar(e.sesiones.analista, 999999, { titulo: 'xx' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('a'),
      );
      await e.servicio.darDeBaja(e.sesiones.analista, creado.id);
      await expect(
        e.servicio.actualizar(e.sesiones.analista, creado.id, { titulo: 'xx' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reemplazo del archivo', () => {
    it('guarda el nuevo, actualiza hash y metadatos y borra el objeto anterior', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('viejo'),
      );
      const [{ ubicacion: anterior }] = await e.sql<{ ubicacion: string }[]>(
        `SELECT ubicacion FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      const nuevo = pdf('nuevo y más largo', 'v2.pdf');
      const actualizado = await e.servicio.reemplazarArchivo(
        e.sesiones.analista,
        creado.id,
        nuevo,
      );
      expect(actualizado).toMatchObject({
        nombreOriginal: 'v2.pdf',
        tamanio: nuevo.buffer.length,
      });
      const [fila] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(fila.hash).toBe(hashSha256(nuevo.buffer));
      expect(e.almacen.objetos.has(anterior)).toBe(false);
      expect(e.almacen.objetos.has(fila.ubicacion)).toBe(true);
      expect(e.almacen.objetos.size).toBe(1);
    });

    it('rechaza con 409 un archivo idéntico al actual o igual al de otro activo', async () => {
      const a = await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'A' }),
        pdf('uno'),
      );
      await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'B' }),
        pdf('dos'),
      );
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('uno')),
      ).rejects.toThrow(/idéntico/);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('dos')),
      ).rejects.toThrow(/«B»/);
      expect(e.almacen.objetos.size).toBe(2);
    });

    it('rechaza una extensión engañosa, un enlace y una baja', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto(), pdf('uno'));
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, {
          originalname: 'x.pdf',
          buffer: Buffer.from('MZ'),
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      const enlace = await e.servicio.crear(
        e.sesiones.analista,
        dto({ enlace: 'https://a.example' }),
      );
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, enlace.id, pdf('x')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await expect(
        e.servicio.reemplazarArchivo(e.sesiones.analista, a.id, pdf('y')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('si el almacén falla a mitad del reemplazo, el activo conserva su archivo', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('viejo'),
      );
      const [antes] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      e.almacen.falloSubida = true;
      await expect(
        e.servicio.reemplazarArchivo(
          e.sesiones.analista,
          creado.id,
          pdf('nuevo'),
        ),
      ).rejects.toThrow(/RustFS/);
      const [despues] = await e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [creado.id],
      );
      expect(despues).toEqual(antes);
      expect(e.almacen.objetos.has(antes.ubicacion)).toBe(true);
    });
  });

  describe('baja y reactivación', () => {
    it('la baja conserva el objeto y libera el hash', async () => {
      const a = await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'A' }),
        pdf('uno'),
      );
      const baja = await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      expect(baja.activo).toBe(false);
      expect(e.almacen.objetos.size).toBe(1);
      await expect(
        e.servicio.crear(
          e.sesiones.analista,
          dto({ titulo: 'A bis' }),
          pdf('uno'),
        ),
      ).resolves.toBeDefined();
    });

    it('reactivar vuelve a comprobar el hash', async () => {
      const a = await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'A' }),
        pdf('uno'),
      );
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await e.servicio.crear(
        e.sesiones.analista,
        dto({ titulo: 'B' }),
        pdf('uno'),
      );
      await expect(
        e.servicio.reactivar(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reactivar exige alcance sobre la unidad del activo', async () => {
      const ajeno = await e.servicio.crear(
        e.sesiones.analista,
        dto({ idUnidad: e.ids.catedraB }),
        pdf('b'),
      );
      await e.servicio.darDeBaja(e.sesiones.analista, ajeno.id);
      await expect(
        e.servicio.reactivar(e.sesiones.jefeA, ajeno.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reactiva si el hash está libre y rechaza dar de baja una baja o reactivar un activo', async () => {
      const a = await e.servicio.crear(e.sesiones.analista, dto(), pdf('uno'));
      await expect(
        e.servicio.reactivar(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
      await e.servicio.darDeBaja(e.sesiones.analista, a.id);
      await expect(
        e.servicio.darDeBaja(e.sesiones.analista, a.id),
      ).rejects.toBeInstanceOf(ConflictException);
      const vuelto = await e.servicio.reactivar(e.sesiones.analista, a.id);
      expect(vuelto.activo).toBe(true);
    });
  });

  describe('concurrencia', () => {
    const ubicacionYHash = (id: number) =>
      e.sql<{ ubicacion: string; hash: string }[]>(
        `SELECT ubicacion, hash FROM activo_conocimiento WHERE id_activo = $1`,
        [id],
      );

    it('reemplazar un activo dado de baja durante la subida responde 409 y borra el objeto nuevo', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('viejo'),
      );
      const [antes] = await ubicacionYHash(creado.id);
      e.almacen.alSubir = async () => {
        e.almacen.alSubir = undefined;
        await e.servicio.darDeBaja(e.sesiones.analista, creado.id);
      };
      await expect(
        e.servicio.reemplazarArchivo(
          e.sesiones.analista,
          creado.id,
          pdf('nuevo'),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await ubicacionYHash(creado.id))[0]).toEqual(antes);
      expect([...e.almacen.objetos.keys()]).toEqual([antes.ubicacion]);
    });

    it('editar metadatos no pisa el archivo reemplazado entre la lectura y el bloqueo', async () => {
      const creado = await e.servicio.crear(
        e.sesiones.analista,
        dto(),
        pdf('viejo'),
      );
      const nuevo = pdf('reemplazo', 'v2.pdf');
      e.ganchos.alValidarReferencia = async () => {
        e.ganchos.alValidarReferencia = undefined;
        await e.servicio.reemplazarArchivo(
          e.sesiones.analista,
          creado.id,
          nuevo,
        );
      };
      const tipoOtro = await e.sql<{ id: number }[]>(
        `SELECT id_tipo_documento AS id FROM tipo_documento WHERE id_tipo_documento <> $1 LIMIT 1`,
        [e.ids.tipoDocumento],
      );
      await e.servicio.actualizar(e.sesiones.analista, creado.id, {
        titulo: 'Editado',
        idTipoDocumento: tipoOtro[0].id,
      });
      const [fila] = await ubicacionYHash(creado.id);
      expect(fila.hash).toBe(hashSha256(nuevo.buffer));
      expect(e.almacen.objetos.has(fila.ubicacion)).toBe(true);
      expect(e.almacen.objetos.size).toBe(1);
      const descarga = await e.servicio.descargar(
        e.sesiones.analista,
        creado.id,
      );
      expect(descarga.nombre).toBe('v2.pdf');
    });
  });
});
