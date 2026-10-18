import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import {
  cargarDatosDeDeteccion,
  type DatosDeteccion,
} from '../../testing/datos-deteccion.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { DeteccionService } from './deteccion.service.js';

describe('RF17: Cátedras sostenidas por una sola persona (integración)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let datos: DatosDeteccion;
  let servicio: DeteccionService;

  const sesionGlobal: SesionUsuario = {
    id: 1,
    nombreUsuario: 'rrhh',
    rol: 'recursos_humanos',
    idPersona: null,
    unidades: [],
  };

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    datos = await cargarDatosDeDeteccion(ds);
    const alcance = new AlcanceService(ds);
    servicio = new DeteccionService(ds, alcance);
  }, 60000);

  afterAll(async () => {
    await base?.destruir();
  });

  it('devuelve C1 (Ana, 2 cargos) y C3 (Gus, 1 cargo) en unaPersona, y C5 en sinDotacion', async () => {
    const res = await servicio.catedrasUnaPersona({}, sesionGlobal);

    expect(res.unaPersona.map((c) => c.denominacion)).toEqual([
      'Cátedra 1',
      'Cátedra 3',
    ]);

    const c1 = res.unaPersona.find((c) => c.denominacion === 'Cátedra 1')!;
    expect(c1.cantidadPersonas).toBe(1);
    expect(c1.cantidadCargos).toBe(2);
    expect(c1.persona).toEqual({
      idPersona: datos.persona.Ana,
      apellido: 'Pérez',
      nombre: 'Ana',
    });

    const c3 = res.unaPersona.find((c) => c.denominacion === 'Cátedra 3')!;
    expect(c3.cantidadPersonas).toBe(1);
    expect(c3.cantidadCargos).toBe(1);
    expect(c3.persona).toEqual({
      idPersona: datos.persona.Gus,
      apellido: 'Fernández',
      nombre: 'Gustavo',
    });

    // C5 sin dotación, la cátedra inactiva no figura
    expect(res.sinDotacion.map((c) => c.denominacion)).toEqual(['Cátedra 5']);
    expect(res.sinDotacion[0].cantidadPersonas).toBe(0);
    expect(res.sinDotacion[0].cantidadCargos).toBe(0);
    expect(res.sinDotacion[0].persona).toBeNull();
  });

  it('una persona inactiva con ocupación vigente no cuenta como sostén de la cátedra', async () => {
    // Agregamos a Hugo (inactivo) una ocupación vigente en C1.jefe
    await ds.query(
      `INSERT INTO ocupacion (id_persona, id_puesto, fecha_desde, id_caracter_ocupacion, id_dedicacion)
       VALUES (
         $1, $2, CURRENT_DATE - INTERVAL '1 year',
         (SELECT id_caracter_ocupacion FROM caracter_ocupacion WHERE codigo = 'titular'),
         (SELECT id_dedicacion FROM dedicacion WHERE codigo = 'simple')
       )`,
      [datos.persona.Hugo, datos.puesto['C1.jefe']],
    );

    const res = await servicio.catedrasUnaPersona({}, sesionGlobal);
    // C1 sigue teniendo exactamente 1 persona activa (Ana) y 2 cargos
    const c1 = res.unaPersona.find((c) => c.denominacion === 'Cátedra 1')!;
    expect(c1).toBeDefined();
    expect(c1.cantidadPersonas).toBe(1);
    expect(c1.cantidadCargos).toBe(2);

    await ds.query(
      `DELETE FROM ocupacion WHERE id_persona = $1 AND id_puesto = $2`,
      [datos.persona.Hugo, datos.puesto['C1.jefe']],
    );
  });

  it('filtra por alcance de unidad cuando consulta una jefatura', async () => {
    const sesionJefeC1: SesionUsuario = {
      id: 2,
      nombreUsuario: 'jefe_c1',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Ana,
      unidades: [datos.catedra.C1],
    };

    const res = await servicio.catedrasUnaPersona({}, sesionJefeC1);
    expect(res.unaPersona.map((c) => c.denominacion)).toEqual(['Cátedra 1']);
    expect(res.sinDotacion).toEqual([]);
  });
});
