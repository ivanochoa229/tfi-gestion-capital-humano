import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { AccionesController } from './acciones.controller.js';
import { CandidatosController } from './candidatos.controller.js';
import { PlanesController } from './planes.controller.js';
import { SucesionController } from './sucesion.controller.js';

type Clase = { prototype: object; name: string };
const CONTROLLERS: Clase[] = [
  AccionesController,
  CandidatosController,
  PlanesController,
  SucesionController,
];

/** Roles por ruta, leídos de los metadatos de @Roles (RNF01, RF24). */
function rutas(): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const clase of CONTROLLERS) {
    for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
      const handler = (clase.prototype as Record<string, unknown>)[nombre];
      if (typeof handler !== 'function') continue;
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
      const roles: string[] =
        Reflect.getMetadata(ROLES_KEY, handler) ??
        Reflect.getMetadata(ROLES_KEY, clase) ??
        [];
      mapa.set(`${clase.name}.${nombre}`, roles);
    }
  }
  return mapa;
}

const conRol = (rol: string) =>
  [...rutas()]
    .filter(([, roles]) => roles.includes(rol))
    .map(([ruta]) => ruta)
    .sort();

describe('matriz de roles de Sucesión', () => {
  it('encuentra las rutas de los cuatro controllers', () => {
    expect(rutas().size).toBeGreaterThanOrEqual(19);
  });
  it('analista_puestos y administrador no figuran en ninguna ruta', () => {
    expect(conRol('analista_puestos')).toEqual([]);
    expect(conRol('administrador')).toEqual([]);
  });
  it('docente solo ve sus planes y acciones y avanza las suyas', () => {
    expect(conRol('docente')).toEqual([
      'AccionesController.avanzar',
      'AccionesController.listar',
      'SucesionController.misPlanes',
    ]);
  });
  it('los jefes avanzan las acciones de que son responsables, y nada más de acciones', () => {
    for (const rol of ['jefatura_departamento', 'jefe_catedra']) {
      const acciones = conRol(rol).filter((r) =>
        r.startsWith('AccionesController'),
      );
      expect(acciones).toEqual([
        'AccionesController.avanzar',
        'AccionesController.listar',
      ]);
    }
  });
  it('autoridad no avanza acciones', () => {
    expect(conRol('autoridad')).not.toContain('AccionesController.avanzar');
  });
  it('resolver solo la autoridad', () => {
    const roles = rutas().get('PlanesController.resolver');
    expect(roles).toEqual(['autoridad']);
  });
});
