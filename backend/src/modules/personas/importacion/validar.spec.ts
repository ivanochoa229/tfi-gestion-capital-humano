import type { OcupacionCsv, PersonaCsv } from './agrupador.js';
import { armarOcupacion, armarPersona } from './validar.js';

const persona = (parcial: Partial<PersonaCsv> = {}): PersonaCsv => ({
  fila: 2,
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-05-20',
  fechaIngreso: '2005-03-01',
  situacionRevista: 'Planta permanente',
  fechaPrevistaRetiro: '',
  ocupaciones: [],
  ...parcial,
});

const ocupacion = (parcial: Partial<OcupacionCsv> = {}): OcupacionCsv => ({
  fila: 3,
  unidad: 'U',
  puesto: 'P',
  fechaDesde: '2020-03-01',
  fechaHasta: '',
  caracter: 'Titular',
  dedicacion: 'Simple',
  ...parcial,
});

describe('armarPersona', () => {
  it('arma el DTO; la fecha de retiro vacía queda sin definir', async () => {
    const { dto, errores } = await armarPersona(persona(), 4);
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({
      legajo: 'L-1',
      idSituacionRevista: 4,
      fechaPrevistaRetiro: undefined,
    });
  });

  it('nombra la columna del CSV (no la propiedad del DTO) en cada error', async () => {
    const { dto, errores } = await armarPersona(
      persona({ documento: '12.345', fechaNacimiento: '2024-02-30' }),
      4,
    );
    expect(dto).toBeUndefined();
    expect(errores.map((e) => [e.fila, e.columna]).sort()).toEqual([
      [2, 'documento'],
      [2, 'fecha_nacimiento'],
    ]);
  });

  it('rechaza un apellido más largo que la columna de la base', async () => {
    const { errores } = await armarPersona(
      persona({ apellido: 'x'.repeat(101) }),
      4,
    );
    expect(errores).toEqual([
      expect.objectContaining({ fila: 2, columna: 'apellido' }),
    ]);
  });
});

describe('armarOcupacion', () => {
  const ids = { idPuesto: 10, idCaracterOcupacion: 1, idDedicacion: 2 };

  it('arma el DTO; fecha_hasta vacía queda sin definir', async () => {
    const { dto, errores } = await armarOcupacion(ocupacion(), ids);
    expect(errores).toEqual([]);
    expect(dto).toMatchObject({
      idPuesto: 10,
      fechaDesde: '2020-03-01',
      fechaHasta: undefined,
    });
  });

  it('una fecha inválida nombra su columna y la fila de la ocupación', async () => {
    const { errores } = await armarOcupacion(
      ocupacion({ fechaDesde: 'ayer' }),
      ids,
    );
    expect(errores).toEqual([
      expect.objectContaining({ fila: 3, columna: 'fecha_desde' }),
    ]);
  });
  describe('mensajes en español', () => {
    const mensajes = async (p: Partial<PersonaCsv>) =>
      (await armarPersona(persona(p), 4)).errores.map((e) => e.mensaje);

    it('obligatorio', async () => {
      expect(await mensajes({ apellido: '' })).toEqual([
        'apellido es obligatorio',
      ]);
    });
    it('largo máximo', async () => {
      expect(await mensajes({ apellido: 'x'.repeat(101) })).toEqual([
        'apellido admite hasta 100 caracteres',
      ]);
      expect(await mensajes({ legajo: 'x'.repeat(21) })).toEqual([
        'legajo admite hasta 20 caracteres',
      ]);
    });
    it('documento', async () => {
      expect(await mensajes({ documento: '12.345.678' })).toEqual([
        'documento debe tener 7 u 8 dígitos, sin puntos',
      ]);
    });
    it('formato de fecha y fecha inexistente', async () => {
      expect(await mensajes({ fechaNacimiento: '1/3/24' })).toEqual([
        'fecha_nacimiento debe ser una fecha AAAA-MM-DD o DD/MM/AAAA',
      ]);
      expect(await mensajes({ fechaNacimiento: '2024-02-30' })).toEqual([
        'fecha_nacimiento no es una fecha válida',
      ]);
    });
    it('fecha_desde inválida', async () => {
      const { errores } = await armarOcupacion(
        ocupacion({ fechaDesde: 'ayer' }),
        { idPuesto: 10, idCaracterOcupacion: 1, idDedicacion: 2 },
      );
      expect(errores.map((e) => e.mensaje)).toEqual([
        'fecha_desde debe ser una fecha AAAA-MM-DD o DD/MM/AAAA',
      ]);
    });
  });
});
