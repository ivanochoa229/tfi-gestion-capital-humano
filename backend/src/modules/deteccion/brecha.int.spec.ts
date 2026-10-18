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

describe('RF19: Brecha de perfil (integración)', () => {
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

  it('calcula brecha de Carla y Eva como candidatas a C2.jefe y de Carla como ocupante de C2.aux', async () => {
    const resC2Jefe = await servicio.brecha(
      { idPuesto: datos.puesto['C2.jefe'], contexto: 'candidato' },
      sesionGlobal,
    );

    const carlaCand = resC2Jefe.find(
      (b) => b.idPersona === datos.persona.Carla,
    )!;
    expect(carlaCand).toBeDefined();
    expect(carlaCand.resumen).toEqual({
      excluyentesCubiertos: 1,
      excluyentesTotal: 2,
      deseablesCubiertos: 0,
      deseablesTotal: 0,
    });
    const carlaK1 = carlaCand.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K1,
    )!;
    expect(carlaK1).toMatchObject({
      esExcluyente: true,
      nivelRequerido: 'Avanzado',
      nivelAcreditado: 'Avanzado',
      faltante: 0,
      cubierto: true,
    });
    const carlaK4 = carlaCand.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K4,
    )!;
    expect(carlaK4).toMatchObject({
      esExcluyente: true,
      nivelRequerido: 'Intermedio',
      nivelAcreditado: null,
      faltante: 2,
      cubierto: false,
    });

    const evaCand = resC2Jefe.find((b) => b.idPersona === datos.persona.Eva)!;
    expect(evaCand).toBeDefined();
    expect(evaCand.resumen).toEqual({
      excluyentesCubiertos: 0,
      excluyentesTotal: 2,
      deseablesCubiertos: 0,
      deseablesTotal: 0,
    });
    const evaK1 = evaCand.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K1,
    )!;
    expect(evaK1.faltante).toBe(1);
    expect(evaK1.cubierto).toBe(false);
    const evaK4 = evaCand.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K4,
    )!;
    expect(evaK4.nivelAcreditado).toBeNull();
    expect(evaK4.faltante).toBe(2);

    // Carla ocupante de C2.aux -> K7 deseable sin acreditar (0 de 1)
    const resCarlaOcup = await servicio.brecha(
      { idPersona: datos.persona.Carla, contexto: 'ocupante' },
      sesionGlobal,
    );
    expect(resCarlaOcup).toHaveLength(1);
    expect(resCarlaOcup[0].idPuesto).toBe(datos.puesto['C2.aux']);
    expect(resCarlaOcup[0].resumen).toEqual({
      excluyentesCubiertos: 0,
      excluyentesTotal: 0,
      deseablesCubiertos: 0,
      deseablesTotal: 1,
    });
  });

  it('marca aRevisar = true cuando un candidato ya ocupa el puesto y respeta alcance de jefatura', async () => {
    // Gus es candidato en el plan de C3.jefe y ocupa C3.jefe
    const resC3 = await servicio.brecha(
      { idPuesto: datos.puesto['C3.jefe'], contexto: 'candidato' },
      sesionGlobal,
    );
    expect(resC3).toHaveLength(1);
    expect(resC3[0].idPersona).toBe(datos.persona.Gus);
    expect(resC3[0].aRevisar).toBe(true);

    // Jefatura de C2 no ve puestos de C4
    const sesionJefeC2: SesionUsuario = {
      id: 2,
      nombreUsuario: 'jefe_c2',
      rol: 'jefe_catedra',
      idPersona: datos.persona.Beto,
      unidades: [datos.catedra.C2],
    };
    const resJefeC2 = await servicio.brecha({}, sesionJefeC2);
    expect(
      resJefeC2.some(
        (b) =>
          b.idPuesto === datos.puesto['C4.jefe'] ||
          b.idPuesto === datos.puesto['C4.aux'],
      ),
    ).toBe(false);
  });

  it('miBrecha de Eva devuelve su ocupación en C4.aux y sus candidaturas aprobadas, e incluye nivelDeclarado cuando declaró', async () => {
    // Eva declara K5 en N2 (intermedio)
    await ds.query(
      `INSERT INTO conocimiento_persona (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion)
       VALUES ($1, $2, (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = 'intermedio'), CURRENT_DATE)`,
      [datos.persona.Eva, datos.conocimiento.K5],
    );

    const sesionEva: SesionUsuario = {
      id: 5,
      nombreUsuario: 'eva',
      rol: 'docente',
      idPersona: datos.persona.Eva,
      unidades: [],
    };

    const miBrecha = await servicio.miBrecha(sesionEva);

    // Ocupante en C4.aux, candidata en C2.jefe (aprobado) y C4.jefe (aprobado)
    // No figura la candidatura de Carla a C4.aux (ajena y en borrador)
    expect(miBrecha.every((b) => b.idPersona === datos.persona.Eva)).toBe(true);

    const ocupC4Aux = miBrecha.find(
      (b) => b.contexto === 'ocupante' && b.idPuesto === datos.puesto['C4.aux'],
    )!;
    expect(ocupC4Aux).toBeDefined();
    const k5EnOcup = ocupC4Aux.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K5,
    )!;
    expect(k5EnOcup.nivelAcreditado).toBeNull();
    expect(k5EnOcup.nivelDeclarado).toBe('Intermedio');

    const k1EnOcup = ocupC4Aux.conocimientos.find(
      (k) => k.idConocimiento === datos.conocimiento.K1,
    )!;
    expect(k1EnOcup.nivelDeclarado).toBeNull();

    const candC4Jefe = miBrecha.find(
      (b) =>
        b.contexto === 'candidato' && b.idPuesto === datos.puesto['C4.jefe'],
    )!;
    expect(candC4Jefe).toBeDefined();
    expect(candC4Jefe.estadoPlan).toBe('aprobado');

    // Limpieza
    await ds.query(
      `DELETE FROM conocimiento_persona WHERE id_persona = $1 AND id_conocimiento = $2`,
      [datos.persona.Eva, datos.conocimiento.K5],
    );
  });
});
