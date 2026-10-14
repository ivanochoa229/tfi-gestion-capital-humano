import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../testing/base-temporal.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { PersonasService } from './personas.service.js';

describe('Ocupaciones y personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ocupaciones: OcupacionesService;
  let personas: PersonasService;
  let ds: DataSource;
  let idPersona: number;
  let idPuesto: number;
  let caracter: number;
  let dedicacion: number;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  /** Fecha relativa a CURRENT_DATE de la base: dia(0) es hoy. */
  const dia = async (delta: number) =>
    (
      await sql<{ f: string }[]>(`SELECT (CURRENT_DATE + $1::int)::text AS f`, [
        delta,
      ])
    )[0].f;

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const referencia = {
      validarActivo: async () => undefined,
    } as unknown as ReferenciaService;
    ocupaciones = new OcupacionesService(
      ds.getRepository(Ocupacion),
      ds.getRepository(Persona),
      ds.getRepository(Puesto),
      referencia,
    );
    personas = new PersonasService(
      ds.getRepository(Persona),
      ds.getRepository(Ocupacion),
      ds.getRepository(Usuario),
      referencia,
    );
    caracter = (
      await sql<{ id: number }[]>(
        `SELECT id_caracter_ocupacion AS id FROM caracter_ocupacion WHERE codigo = 'titular'`,
      )
    )[0].id;
    dedicacion = (
      await sql<{ id: number }[]>(
        `SELECT id_dedicacion AS id FROM dedicacion WHERE codigo = 'simple'`,
      )
    )[0].id;
    const revista = (
      await sql<{ id: number }[]>(
        `SELECT id_situacion_revista AS id FROM situacion_revista WHERE codigo = 'planta_permanente'`,
      )
    )[0].id;
    idPersona = (
      await sql<{ id: number }[]>(
        `INSERT INTO persona (legajo, apellido, nombre, documento, fecha_nacimiento, fecha_ingreso, id_situacion_revista)
       VALUES ('L-1', 'Pérez', 'Ana', '30111111', '1980-01-01', '2005-03-01', $1) RETURNING id_persona AS id`,
        [revista],
      )
    )[0].id;
    const [{ id: departamento }] = await sql<{ id: number }[]>(
      `SELECT id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    idPuesto = (
      await sql<{ id: number }[]>(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
       SELECT 'P-0001', 'Jefe', $1, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'
       RETURNING id_puesto AS id`,
        [departamento],
      )
    )[0].id;
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
    await sql(`UPDATE persona SET activo = true`);
    await sql(`UPDATE puesto SET activo = true`);
  });

  const alta = async (desde: number, hasta: number | null) => ({
    idPuesto,
    fechaDesde: await dia(desde),
    fechaHasta: hasta === null ? null : await dia(hasta),
    idCaracterOcupacion: caracter,
    idDedicacion: dedicacion,
  });

  it('crea una ocupación vigente y la devuelve con estado vigente', async () => {
    const creada = await ocupaciones.crear(idPersona, await alta(-10, null));
    expect(creada.estado).toBe('vigente');
  });

  it('rechaza un solape con ConflictException legible', async () => {
    await ocupaciones.crear(idPersona, await alta(-10, 10));
    await expect(
      ocupaciones.crear(idPersona, await alta(5, 20)),
    ).rejects.toThrow(/ya ocupa ese puesto/);
  });

  it('de dos altas idénticas simultáneas, una gana y la otra recibe 409', async () => {
    const datos = await alta(-1, null);
    const resultados = await Promise.allSettled([
      ocupaciones.crear(idPersona, datos),
      ocupaciones.crear(idPersona, datos),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazada = resultados.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rechazada.reason).toBeInstanceOf(ConflictException);
    expect(await sql('SELECT 1 FROM ocupacion')).toHaveLength(1);
  });

  it('una ocupación que vence hoy bloquea la baja de la persona', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, 0));
    await expect(personas.darDeBaja(idPersona)).rejects.toThrow(/P-0001/);
  });

  it('una ocupación que venció ayer ya no bloquea la baja', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, -1));
    await expect(personas.darDeBaja(idPersona)).resolves.toMatchObject({
      persona: { activo: false },
    });
  });

  it('no admite ocupaciones nuevas de una persona dada de baja', async () => {
    await personas.darDeBaja(idPersona);
    await expect(
      ocupaciones.crear(idPersona, await alta(1, null)),
    ).rejects.toThrow(/dada de baja/);
  });

  it('cerrar una ocupación libera el período para una nueva', async () => {
    const abierta = await alta(-30, null);
    await ocupaciones.crear(idPersona, abierta);
    await ocupaciones.cerrar(idPersona, idPuesto, abierta.fechaDesde, {
      fechaHasta: await dia(-1),
    });
    await expect(
      ocupaciones.crear(idPersona, await alta(0, null)),
    ).resolves.toBeDefined();
  });

  it('anula una ocupación futura pero no una vigente', async () => {
    const futura = await alta(10, null);
    await ocupaciones.crear(idPersona, futura);
    await ocupaciones.anular(idPersona, idPuesto, futura.fechaDesde);
    const vigente = await alta(-1, null);
    await ocupaciones.crear(idPersona, vigente);
    await expect(
      ocupaciones.anular(idPersona, idPuesto, vigente.fechaDesde),
    ).rejects.toThrow(/cerrala/);
  });

  it('lista los ocupantes vigentes de un puesto', async () => {
    await ocupaciones.crear(idPersona, await alta(-30, null));
    const ocupantes = await ocupaciones.listarDePuesto(idPuesto);
    expect(ocupantes).toHaveLength(1);
    expect(ocupantes[0]).toMatchObject({ legajo: 'L-1', apellido: 'Pérez' });
  });
});
