import { SetMetadata } from '@nestjs/common';

export const PUBLICO_KEY = 'publico';

/** Ruta accesible sin sesión (login y salud). */
export const Publico = () => SetMetadata(PUBLICO_KEY, true);
