import { Readable } from 'node:stream';

/** Reemplazo en memoria de `StorageService` para las pruebas de integración. */
export class AlmacenFalso {
  readonly objetos = new Map<string, { contenido: Buffer; tipoMime: string }>();
  /** Con `true`, la próxima subida falla (simula RustFS caído). */
  falloSubida = false;

  /** Gancho opcional que corre dentro de `subir`, antes de guardar (para forzar intercalados). */
  alSubir?: () => Promise<void>;

  async subir(clave: string, contenido: Buffer, tipoMime: string) {
    await this.alSubir?.();
    if (this.falloSubida) throw new Error('RustFS no disponible');
    this.objetos.set(clave, { contenido, tipoMime });
  }

  async obtener(clave: string): Promise<Readable> {
    const objeto = this.objetos.get(clave);
    if (!objeto)
      throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return Readable.from([objeto.contenido]);
  }

  async eliminar(clave: string) {
    this.objetos.delete(clave);
  }
}
