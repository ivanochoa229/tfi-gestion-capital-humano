import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { PUBLICO_KEY } from './decorators/publico.decorator.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

const raiz = join(import.meta.dirname, '..');

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return controllers(ruta);
    return nombre.endsWith('.controller.ts') ? [ruta] : [];
  });
}

describe('cobertura de @Roles', () => {
  const archivos = controllers(raiz);

  it('encuentra los controllers del backend', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [a.replace(raiz, 'src')]))(
    '%s declara @Roles o @Publico en cada ruta',
    async (ruta) => {
      const modulo = await import(pathToFileURL(join(raiz, '..', ruta)).href);
      const clases = Object.values(modulo).filter(
        (v): v is new () => object => typeof v === 'function',
      );
      for (const clase of clases) {
        const delControlador = (clave: string) =>
          Reflect.getMetadata(clave, clase) !== undefined;
        for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
          const handler = (clase.prototype as Record<string, unknown>)[nombre];
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined)
            continue;
          const declarada =
            Reflect.getMetadata(ROLES_KEY, handler) !== undefined ||
            Reflect.getMetadata(PUBLICO_KEY, handler) !== undefined ||
            delControlador(ROLES_KEY) ||
            delControlador(PUBLICO_KEY);
          expect(
            declarada,
            `${clase.name}.${nombre} no declara @Roles ni @Publico`,
          ).toBe(true);
        }
      }
    },
  );
});
