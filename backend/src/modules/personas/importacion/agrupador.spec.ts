import { COLUMNAS, type FilaCsv, type ValoresFila } from './tipos.js';
import { agrupar } from './agrupador.js';

const base = {
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fecha_nacimiento: '20/05/1980',
  fecha_ingreso: '2005-03-01',
  situacion_revista: 'Planta permanente',
  unidad: 'Cátedra de Física',
  puesto: 'Titular',
  fecha_desde: '2020-03-01',
  caracter: 'Titular',
  dedicacion: 'Simple',
};
const f = (fila: number, parcial: Partial<ValoresFila> = {}): FilaCsv => ({
  fila,
  valores: {
    ...Object.fromEntries(COLUMNAS.map((c) => [c, ''])),
    ...base,
    ...parcial,
  } as ValoresFila,
});

describe('agrupar', () => {
  it('arma una persona con sus ocupaciones y normaliza las fechas', () => {
    const { personas, errores } = agrupar([
      f(2),
      f(3, { puesto: 'Jefe', fecha_desde: '01/03/2021' }),
    ]);
    expect(errores).toEqual([]);
    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({
      fila: 2,
      legajo: 'L-1',
      fechaNacimiento: '1980-05-20',
      situacionRevista: 'Planta permanente',
      fechaPrevistaRetiro: '',
    });
    expect(
      personas[0].ocupaciones.map((o) => [o.fila, o.puesto, o.fechaDesde]),
    ).toEqual([
      [2, 'Titular', '2020-03-01'],
      [3, 'Jefe', '2021-03-01'],
    ]);
  });

  it('agrupa por legajo aunque las filas no sean contiguas', () => {
    const { personas } = agrupar([
      f(2),
      f(3, { legajo: 'L-2', documento: '30222222' }),
      f(4, { puesto: 'Jefe' }),
    ]);
    expect(personas.map((p) => [p.legajo, p.ocupaciones.length])).toEqual([
      ['L-1', 2],
      ['L-2', 1],
    ]);
  });

  it('una fila sin ocupación registra la persona sin ocupaciones', () => {
    const { personas, errores } = agrupar([
      f(2, {
        unidad: '',
        puesto: '',
        fecha_desde: '',
        caracter: '',
        dedicacion: '',
      }),
    ]);
    expect(errores).toEqual([]);
    expect(personas[0].ocupaciones).toEqual([]);
  });

  it('una fila con la ocupación incompleta da un error por columna faltante', () => {
    const { errores } = agrupar([f(5, { dedicacion: '', caracter: '' })]);
    expect(errores.map((e) => [e.fila, e.columna])).toEqual([
      [5, 'caracter'],
      [5, 'dedicacion'],
    ]);
  });

  it('fecha_hasta sola, sin el resto de la ocupación, es error', () => {
    const { errores } = agrupar([
      f(2, {
        unidad: '',
        puesto: '',
        fecha_desde: '',
        caracter: '',
        dedicacion: '',
        fecha_hasta: '2024-01-01',
      }),
    ]);
    expect(errores.length).toBeGreaterThan(0);
    expect(errores.every((e) => e.fila === 2)).toBe(true);
  });

  it('la fila que discrepa en los datos de la persona da error y no aporta su ocupación', () => {
    const { personas, errores } = agrupar([
      f(2),
      f(3, { apellido: 'Gómez', puesto: 'Jefe' }),
    ]);
    expect(errores).toEqual([
      expect.objectContaining({ fila: 3, columna: 'apellido' }),
    ]);
    expect(errores[0].mensaje).toMatch(/fila 2/);
    expect(personas[0].ocupaciones).toHaveLength(1);
  });

  it('un legajo vacío es error y la fila se descarta', () => {
    const { personas, errores } = agrupar([f(2, { legajo: '' })]);
    expect(personas).toEqual([]);
    expect(errores).toEqual([
      expect.objectContaining({ fila: 2, columna: 'legajo' }),
    ]);
  });
});
