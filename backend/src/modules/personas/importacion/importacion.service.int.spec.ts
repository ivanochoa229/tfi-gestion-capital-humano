import type { DataSource } from 'typeorm';
import {
  crearBaseTemporal,
  type BaseTemporal,
} from '../../../testing/base-temporal.js';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { ReferenciaService } from '../../referencia/referencia.service.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Ocupacion } from '../entities/ocupacion.entity.js';
import { Persona } from '../entities/persona.entity.js';
import { OcupacionesService } from '../ocupaciones.service.js';
import { PersonasService } from '../personas.service.js';
import { ImportacionService } from './importacion.service.js';
import { COLUMNAS } from './tipos.js';

const fila = (v: Partial<Record<(typeof COLUMNAS)[number], string>>) =>
  COLUMNAS.map((c) => v[c] ?? '').join(';');
const csv = (...lineas: string[]) =>
  Buffer.from([COLUMNAS.join(';'), ...lineas].join('\n'), 'utf8');

describe('Importación de personas (PostgreSQL real)', () => {
  let base: BaseTemporal;
  let ds: DataSource;
  let servicio: ImportacionService;
  let catedra: string;

  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const contar = async (tabla: 'persona' | 'ocupacion') =>
    (await sql<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${tabla}`))[0]
      .n;

  const persona = (legajo: string, extra: Record<string, string> = {}) => ({
    legajo,
    apellido: 'Pérez',
    nombre: 'Ana',
    documento: `30${legajo.replace(/\D/g, '').padStart(6, '0')}`,
    fecha_nacimiento: '1980-05-20',
    fecha_ingreso: '2005-03-01',
    situacion_revista: 'Planta permanente',
    unidad: catedra,
    puesto: 'Titular',
    fecha_desde: '2020-03-01',
    caracter: 'Titular',
    dedicacion: 'Simple',
    ...extra,
  });

  beforeAll(async () => {
    base = await crearBaseTemporal();
    ds = base.dataSource;
    const [{ denominacion, id }] = await sql<
      { denominacion: string; id: number }[]
    >(
      `SELECT denominacion, id_unidad AS id FROM unidad_organizativa WHERE id_unidad_superior IS NULL`,
    );
    catedra = denominacion;
    for (const puesto of ['Titular', 'Jefe']) {
      await sql(
        `INSERT INTO puesto (codigo, denominacion, id_unidad, id_nivel_jerarquico)
         SELECT $1, $2, $3, id_nivel_jerarquico FROM nivel_jerarquico WHERE codigo = 'operativo_docente'`,
        [`P-${puesto}`.slice(0, 10), puesto, id],
      );
    }
    const referencia = new ReferenciaService(ds);
    const ocupaciones = new OcupacionesService(
      ds.getRepository(Ocupacion),
      ds.getRepository(Persona),
      ds.getRepository(Puesto),
      referencia,
    );
    const personas = new PersonasService(
      ds.getRepository(Persona),
      ds.getRepository(Ocupacion),
      ds.getRepository(Usuario),
      referencia,
    );
    servicio = new ImportacionService(
      ds.getRepository(Persona),
      ds.getRepository(UnidadOrganizativa),
      ds.getRepository(Puesto),
      referencia,
      personas,
      ocupaciones,
    );
  });
  afterAll(async () => {
    await base.destruir();
  });
  afterEach(async () => {
    await sql('DELETE FROM ocupacion');
    await sql('DELETE FROM persona');
  });

  it('la vista previa no deja nada y la confirmación crea exactamente lo mismo', async () => {
    const archivo = csv(
      fila(persona('L-1')),
      fila(persona('L-1', { puesto: 'Jefe' })), // simultánea en otro puesto
      fila(persona('L-2')),
    );
    const previa = await servicio.importar(archivo, false);
    expect(previa).toMatchObject({
      importado: false,
      personas: 2,
      ocupaciones: 3,
      errores: [],
    });
    expect(await contar('persona')).toBe(0);
    expect(await contar('ocupacion')).toBe(0);

    const real = await servicio.importar(archivo, true);
    expect(real).toMatchObject({
      importado: true,
      personas: 2,
      ocupaciones: 3,
    });
    expect(await contar('persona')).toBe(2);
    expect(await contar('ocupacion')).toBe(3);
  });

  it('un solape dentro del archivo se reporta, el resto se evalúa y no se escribe nada', async () => {
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-1', { fecha_desde: '2021-01-01' })), // solapa con la anterior (sin fin)
        fila(persona('L-2')),
        fila(persona('L-3', { unidad: 'No existe' })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores.map((e) => e.fila)).toEqual([3, 5]);
    expect(r.errores[0].mensaje).toMatch(/ya ocupa ese puesto/);
    expect(await contar('persona')).toBe(0);
    expect(await contar('ocupacion')).toBe(0);
  });

  it('un legajo que ya existe es error y no se toca', async () => {
    await servicio.importar(csv(fila(persona('L-1'))), true);
    const r = await servicio.importar(
      csv(fila(persona('L-1', { apellido: 'Otro' }))),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores[0].mensaje).toMatch(/legajo L-1 ya lo tiene Pérez, Ana/);
    const [{ apellido }] = await sql<{ apellido: string }[]>(
      `SELECT apellido FROM persona WHERE legajo = 'L-1'`,
    );
    expect(apellido).toBe('Pérez');
  });

  it('dos legajos con el mismo documento: el segundo falla con "ya lo tiene", no con un 500', async () => {
    const r = await servicio.importar(
      csv(
        fila(persona('L-1')),
        fila(persona('L-2', { documento: persona('L-1').documento })),
      ),
      true,
    );
    expect(r.importado).toBe(false);
    expect(r.errores).toEqual([
      expect.objectContaining({
        fila: 3,
        mensaje: expect.stringMatching(/documento .* ya lo tiene/),
      }),
    ]);
    expect(await contar('persona')).toBe(0);
  });

  it('una persona sin ocupación se importa sola', async () => {
    const r = await servicio.importar(
      csv(
        fila(
          persona('L-1', {
            unidad: '',
            puesto: '',
            fecha_desde: '',
            caracter: '',
            dedicacion: '',
          }),
        ),
      ),
      true,
    );
    expect(r).toMatchObject({ importado: true, personas: 1, ocupaciones: 0 });
  });

  it('dos importaciones simultáneas del mismo archivo: una gana y la otra recibe errores', async () => {
    const archivo = csv(fila(persona('L-1')));
    const [a, b] = await Promise.all([
      servicio.importar(archivo, true),
      servicio.importar(archivo, true),
    ]);
    expect([a.importado, b.importado].filter(Boolean)).toHaveLength(1);
    const perdedor = [a, b].find((r) => !r.importado);
    expect(perdedor?.errores.length).toBeGreaterThan(0);
    expect(await contar('persona')).toBe(1);
  });
});
