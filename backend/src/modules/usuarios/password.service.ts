import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

export const LARGO_MINIMO_CLAVE = 10;

/** Hash de contraseñas con argon2id y los parámetros por defecto del paquete. */
@Injectable()
export class PasswordService {
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
}
