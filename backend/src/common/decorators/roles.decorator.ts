import { SetMetadata } from '@nestjs/common';
import type { CodigoRol } from '../roles.js';

export const ROLES_KEY = 'roles';

/** Roles autorizados en un endpoint o controller. Sin él, la ruta se rechaza. */
export const Roles = (...roles: CodigoRol[]) => SetMetadata(ROLES_KEY, roles);
