import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

export const LARGO_MINIMO_CLAVE = 10;

/** Hash de contraseñas con argon2id y los parámetros por defecto del paquete. */
@Injectable()
export class PasswordService {
  private hashFalso?: Promise<string>;

  hashear(clave: string): Promise<string> {
    return hash(clave);
  }

  async verificar(hashGuardado: string, clave: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, clave);
    } catch {
      return false;
    }
  }

  /**
   * Gasta el mismo tiempo que una verificación real. Se usa cuando el usuario no
   * existe o está desactivado, para que el tiempo de respuesta no delate cuáles
   * nombres de usuario existen.
   */
  async verificarFalso(clave: string): Promise<void> {
    this.hashFalso ??= this.hashear('clave-falsa-para-igualar-tiempos');
    await this.verificar(await this.hashFalso, clave);
  }
}
