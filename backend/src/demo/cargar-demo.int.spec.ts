import { AlcanceService } from '../modules/usuarios/alcance.service.js';
import { AccesoPerfilService } from '../modules/conocimiento/acceso-perfil.service.js';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../testing/base-temporal.js';
import { cargarDatosDemo } from './cargar-demo.js';
import { CLAVE_DEMO, DATOS_DEMO, USUARIOS_DEMO } from './datos-demo.js';

const hashDePrueba = async (clave: string) => `hash:${clave}`;

describe('cargarDatosDemo', () => {
  let base: BaseTemporal;
  beforeEach(async () => {
    base = await crearBaseTemporal();
  });
  afterEach(async () => {
    await base.destruir();
  });

  const consultar = <T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) => base.dataSource.query(sql, params) as Promise<T[]>;
  const contar = async (tabla: string) =>
    Number(
      (await consultar<{ n: string }>(`SELECT count(*) AS n FROM ${tabla}`))[0]
        .n,
    );

  it('carga y devuelve "cargado" con las cantidades de los datos', async () => {
    const resultado = await cargarDatosDemo(base.dataSource, hashDePrueba);

    expect(resultado).toBe('cargado');
    expect(await contar('persona')).toBe(DATOS_DEMO.personas.length);
    expect(await contar('puesto')).toBe(DATOS_DEMO.puestos.length);
    expect(await contar('conocimiento')).toBe(DATOS_DEMO.conocimientos.length);
    expect(await contar('requisito_puesto')).toBe(DATOS_DEMO.requisitos.length);
    expect(await contar('ocupacion')).toBe(DATOS_DEMO.ocupaciones.length);
    expect(await contar('conocimiento_persona')).toBe(
      DATOS_DEMO.conocimientosPersona.length,
    );
    expect(await contar('acreditacion')).toBe(
      DATOS_DEMO.conocimientosPersona.filter((c) => c.acreditado).length,
    );
    expect(await contar('evaluacion_criticidad')).toBe(
      DATOS_DEMO.evaluaciones.length,
    );
    expect(await contar('plan_sucesion')).toBe(DATOS_DEMO.planes.length);
    expect(await contar('candidato_sucesion')).toBe(
      DATOS_DEMO.candidatos.length,
    );
    expect(await contar('accion_transferencia')).toBe(
      DATOS_DEMO.acciones.length,
    );
    expect(await contar('activo_conocimiento')).toBe(
      DATOS_DEMO.activosEnlace.length,
    );
  });

  it('una segunda carga devuelve "omitido" y no duplica filas', async () => {
    await cargarDatosDemo(base.dataSource, hashDePrueba);
    const antes = [
      await contar('persona'),
      await contar('usuario'),
      await contar('plan_sucesion'),
      await contar('unidad_organizativa'),
    ];

    expect(await cargarDatosDemo(base.dataSource, hashDePrueba)).toBe(
      'omitido',
    );

    expect([
      await contar('persona'),
      await contar('usuario'),
      await contar('plan_sucesion'),
      await contar('unidad_organizativa'),
    ]).toEqual(antes);
  });

  it('crea un usuario por rol con clave hasheada y alcance por unidad', async () => {
    await cargarDatosDemo(base.dataSource, hashDePrueba);

    const usuarios = await consultar<{
      nombre_usuario: string;
      codigo: string;
      clave_hash: string;
      id_persona: number | null;
    }>(
      `SELECT u.nombre_usuario, r.codigo, u.clave_hash, u.id_persona
       FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
       WHERE u.nombre_usuario LIKE 'demo.%' ORDER BY u.nombre_usuario`,
    );
    expect(usuarios.map((u) => [u.nombre_usuario, u.codigo])).toEqual(
      USUARIOS_DEMO.map((u) => [u.nombreUsuario, u.rol]).sort(),
    );
    expect(usuarios.every((u) => u.clave_hash === `hash:${CLAVE_DEMO}`)).toBe(
      true,
    );
    expect(
      usuarios.find((u) => u.nombre_usuario === 'demo.docente')?.id_persona,
    ).not.toBeNull();

    const alcance = await consultar<{ unidad: string }>(
      `SELECT uo.denominacion AS unidad
       FROM usuario_unidad uu
       JOIN usuario u ON u.id_usuario = uu.id_usuario
       JOIN unidad_organizativa uo ON uo.id_unidad = uu.id_unidad
       WHERE u.nombre_usuario = 'demo.jefecatedra'`,
    );
    expect(alcance.map((a) => a.unidad)).toEqual(['Bases de Datos']);
  });

  it('carga la jerarquía de puestos y la jefatura acredita a toda la cadena', async () => {
    await cargarDatosDemo(base.dataSource, hashDePrueba);

    const sinSuperior = await consultar<{ codigo: string }>(
      `SELECT codigo FROM puesto WHERE codigo LIKE 'P-%' AND id_puesto_superior IS NULL`,
    );
    expect(sinSuperior.map((p) => p.codigo)).toEqual(['P-DEP-JEF']);
    const jtp = await consultar<{ superior: string }>(
      `SELECT s.codigo AS superior FROM puesto p JOIN puesto s ON s.id_puesto = p.id_puesto_superior
       WHERE p.codigo = 'P-BD-JTP'`,
    );
    expect(jtp[0].superior).toBe('P-BD-JEF');

    const acceso = new AccesoPerfilService(
      base.dataSource,
      new AlcanceService(base.dataSource),
    );
    const persona = async (legajo: string) =>
      (
        await consultar<{ id: number }>(
          `SELECT id_persona AS id FROM persona WHERE legajo = $1`,
          [legajo],
        )
      )[0].id;
    const [andrea, laura, martin, diego] = await Promise.all(
      ['DEMO-010', 'DEMO-001', 'DEMO-002', 'DEMO-004'].map(persona),
    );
    const jefatura = await consultar<{ id_persona: number }>(
      `SELECT id_persona FROM usuario WHERE nombre_usuario = 'demo.jefatura'`,
    );
    expect(jefatura[0].id_persona).toBe(andrea);
    // Laura acredita a Martín (su JTP) y no a Diego (de Algoritmos).
    expect(await acceso.esSuperior(laura, martin)).toBe(true);
    expect(await acceso.esSuperior(laura, diego)).toBe(false);
    // La jefatura baja por toda la cadena; nadie acredita hacia arriba.
    expect(await acceso.esSuperior(andrea, diego)).toBe(true);
    expect(await acceso.esSuperior(andrea, laura)).toBe(true);
    expect(await acceso.esSuperior(martin, laura)).toBe(false);
  });

  it('si falta demo.admin pero hay datos DEMO- devuelve "parcial" y no escribe', async () => {
    await cargarDatosDemo(base.dataSource, hashDePrueba);
    await consultar(
      `UPDATE usuario SET id_persona = NULL WHERE id_persona IS NOT NULL`,
    );
    await consultar(`DELETE FROM usuario WHERE nombre_usuario = 'demo.admin'`);
    const antes = await contar('persona');

    expect(await cargarDatosDemo(base.dataSource, hashDePrueba)).toBe(
      'parcial',
    );

    expect(await contar('persona')).toBe(antes);
    expect(await contar('usuario')).toBe(6);
  });

  it('un error a mitad de la carga hace rollback completo', async () => {
    const datosRotos = {
      ...DATOS_DEMO,
      planes: [
        ...DATOS_DEMO.planes,
        {
          puesto: 'P-INEXISTENTE',
          responsable: 'DEMO-001',
          estado: 'borrador' as const,
        },
      ],
    };

    await expect(
      cargarDatosDemo(base.dataSource, hashDePrueba, datosRotos),
    ).rejects.toThrow(/P-INEXISTENTE/);

    expect(await contar('persona')).toBe(0);
    expect(await contar('usuario')).toBe(0);
    expect(await contar('puesto')).toBe(0);
    expect(await contar('unidad_organizativa')).toBe(1);
  });

  describe('resultados de detección que promete el guion', () => {
    beforeEach(async () => {
      await cargarDatosDemo(base.dataSource, hashDePrueba);
    });

    const idConocimiento = async (denominacion: string) =>
      (
        await consultar<{ id: number }>(
          `SELECT id_conocimiento AS id FROM conocimiento WHERE denominacion = $1`,
          [denominacion],
        )
      )[0].id;

    it('RF16: SQL (Laura) y Arquitectura (Ricardo) y Redes (Hernán) son puntos únicos de falla; Linux no', async () => {
      const filas = await consultar<{
        denominacion: string;
        apellido: string | null;
        cantidad_poseedores: number;
      }>(
        `SELECT k.denominacion, p.apellido, d.cantidad_poseedores
         FROM deteccion_punto_unico_falla d
         JOIN conocimiento k ON k.id_conocimiento = d.id_conocimiento
         LEFT JOIN persona p ON p.id_persona = d.id_persona_unica
         ORDER BY k.denominacion`,
      );
      const unicos = filas.filter((f) => f.cantidad_poseedores === 1);
      expect(unicos.map((f) => [f.denominacion, f.apellido])).toEqual([
        ['Arquitectura de software', 'Molina'],
        ['Redes TCP/IP', 'Quiroga'],
        ['SQL y modelado relacional', 'Benítez'],
      ]);
      const linux = filas.find(
        (f) => f.denominacion === 'Administración de Linux',
      );
      expect(linux?.cantidad_poseedores).toBe(2);
    });

    it('RF17: Redes de Datos la sostiene una sola persona y las demás cátedras, más de una', async () => {
      const filas = await consultar<{
        denominacion: string;
        cantidad_personas: number;
      }>(
        `SELECT u.denominacion, d.cantidad_personas
         FROM deteccion_catedra_una_persona d
         JOIN unidad_organizativa u ON u.id_unidad = d.id_unidad
         WHERE d.cantidad_personas = 1`,
      );
      expect(filas.map((f) => f.denominacion)).toEqual(['Redes de Datos']);
    });

    it('RF18: BD, IS y Redes no tienen sucesor preparado; Sistemas Operativos sí', async () => {
      const filas = await consultar<{ codigo: string; motivo: string }>(
        `SELECT p.codigo, d.motivo
         FROM deteccion_puesto_sin_sucesor d
         JOIN puesto p ON p.id_puesto = d.id_puesto
         ORDER BY p.codigo`,
      );
      expect(filas).toEqual([
        { codigo: 'P-BD-JEF', motivo: 'plan_en_elaboracion' },
        { codigo: 'P-IS-JEF', motivo: 'plan_en_elaboracion' },
        { codigo: 'P-RD-JEF', motivo: 'sin_plan' },
      ]);
    });

    it('RF19: hay brecha para el docente (Diego) y para el candidato (Martín)', async () => {
      const brechas = await consultar<{
        contexto: string;
        apellido: string;
        denominacion: string;
        faltante: number;
      }>(
        `SELECT d.contexto, p.apellido, k.denominacion, d.faltante
         FROM deteccion_brecha_perfil d
         JOIN persona p ON p.id_persona = d.id_persona
         JOIN conocimiento k ON k.id_conocimiento = d.id_conocimiento
         WHERE d.faltante > 0 ORDER BY p.apellido, d.contexto`,
      );
      expect(brechas).toContainEqual({
        contexto: 'ocupante',
        apellido: 'Paz',
        denominacion: 'Algoritmos y estructuras de datos',
        faltante: 1,
      });
      expect(brechas).toContainEqual({
        contexto: 'candidato',
        apellido: 'Acosta',
        denominacion: 'SQL y modelado relacional',
        faltante: 1,
      });
    });

    it('RF20: el retiro de Laura entra en un horizonte de 24 meses y no en uno de 6; el de Ricardo, fuera de 24', async () => {
      const retiros = (meses: number) =>
        consultar<{ apellido: string }>(
          `SELECT DISTINCT p.apellido
           FROM deteccion_retiro_poseedor d
           JOIN persona p ON p.id_persona = d.id_persona
           WHERE d.fecha_prevista_retiro <= CURRENT_DATE + make_interval(months => $1)
           ORDER BY p.apellido`,
          [meses],
        );
      expect((await retiros(24)).map((r) => r.apellido)).toEqual(['Benítez']);
      expect(await retiros(6)).toEqual([]);
      expect((await retiros(60)).map((r) => r.apellido)).toEqual([
        'Benítez',
        'Molina',
      ]);
    });

    it('acreditar a Martín en SQL avanzado quita el punto único de falla y, con el plan aprobado, el puesto sin sucesor', async () => {
      const sql = await idConocimiento('SQL y modelado relacional');
      await consultar(
        `UPDATE conocimiento_persona SET id_nivel_acreditado =
           (SELECT id_nivel_dominio FROM nivel_dominio WHERE codigo = 'avanzado')
         WHERE id_conocimiento = $1
           AND id_persona = (SELECT id_persona FROM persona WHERE legajo = 'DEMO-002')`,
        [sql],
      );
      await consultar(
        `UPDATE plan_sucesion SET id_estado_plan =
           (SELECT id_estado_plan FROM estado_plan WHERE codigo = 'aprobado'),
           id_usuario_resolucion = (SELECT id_usuario FROM usuario WHERE nombre_usuario = 'demo.autoridad'),
           fecha_resolucion = CURRENT_DATE
         WHERE id_puesto = (SELECT id_puesto FROM puesto WHERE codigo = 'P-BD-JEF')`,
      );

      const unica = await consultar<{ cantidad_poseedores: number }>(
        `SELECT cantidad_poseedores FROM deteccion_punto_unico_falla WHERE id_conocimiento = $1`,
        [sql],
      );
      expect(unica[0].cantidad_poseedores).toBe(2);
      const sinSucesor = await consultar<{ codigo: string }>(
        `SELECT p.codigo FROM deteccion_puesto_sin_sucesor d
         JOIN puesto p ON p.id_puesto = d.id_puesto ORDER BY p.codigo`,
      );
      expect(sinSucesor.map((s) => s.codigo)).toEqual(['P-IS-JEF', 'P-RD-JEF']);
    });
  });
});
