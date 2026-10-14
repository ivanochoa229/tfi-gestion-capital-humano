import { ForbiddenException } from '@nestjs/common';
import { ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';

/** El docente solo accede a su propia persona (RF24); los demás roles no se restringen acá. */
export function exigirAccesoAPersona(
  sesion: Pick<SesionUsuario, 'rol' | 'idPersona'>,
  idPersona: number,
): void {
  if (sesion.rol === ROLES.docente && sesion.idPersona !== idPersona) {
    throw new ForbiddenException('Solo podés consultar tu propia ficha');
  }
}
