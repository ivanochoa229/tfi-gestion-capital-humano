import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarOcupacionDto } from './actualizar-ocupacion.dto.js';
import { ActualizarPersonaDto } from './actualizar-persona.dto.js';
import { CerrarOcupacionDto } from './cerrar-ocupacion.dto.js';
import { CrearOcupacionDto } from './crear-ocupacion.dto.js';
import { CrearPersonaDto } from './crear-persona.dto.js';
import { FiltroPersonasDto } from './filtro-personas.dto.js';

const errores = async <T extends object>(clase: new () => T, plano: object) =>
  (await validate(plainToInstance(clase, plano))).flatMap((e) =>
    Object.keys(e.constraints ?? {}).map(() => e.property),
  );

const persona = {
  legajo: ' L-100 ',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-01-01',
  fechaIngreso: '2005-03-01',
  idSituacionRevista: 1,
};

describe('CrearPersonaDto', () => {
  it('acepta una persona válida y recorta el legajo', async () => {
    const dto = plainToInstance(CrearPersonaDto, persona);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.legajo).toBe('L-100');
  });
  it.each(['123456', '123456789', '3011111A', '30.111.111'])(
    'rechaza el documento %s',
    async (documento) => {
      expect(
        await errores(CrearPersonaDto, { ...persona, documento }),
      ).toContain('documento');
    },
  );
  it.each(['2026-02-30', '1980-01-01T00:00:00Z', '01/01/1980', ''])(
    'rechaza la fecha de nacimiento %s',
    async (fechaNacimiento) => {
      expect(
        await errores(CrearPersonaDto, { ...persona, fechaNacimiento }),
      ).toContain('fechaNacimiento');
    },
  );
  it('acepta la fecha prevista de retiro nula u omitida', async () => {
    expect(
      await errores(CrearPersonaDto, { ...persona, fechaPrevistaRetiro: null }),
    ).toEqual([]);
    expect(await errores(CrearPersonaDto, persona)).toEqual([]);
  });
  it('exige los campos obligatorios', async () => {
    expect(await errores(CrearPersonaDto, {})).toEqual(
      expect.arrayContaining([
        'legajo',
        'apellido',
        'nombre',
        'documento',
        'fechaNacimiento',
        'fechaIngreso',
        'idSituacionRevista',
      ]),
    );
  });
});

describe('ActualizarPersonaDto', () => {
  it('todo es opcional', async () => {
    expect(await errores(ActualizarPersonaDto, {})).toEqual([]);
  });
});

describe('FiltroPersonasDto', () => {
  it('convierte "true" y "false" en booleanos', async () => {
    const dto = plainToInstance(FiltroPersonasDto, {
      activo: 'false',
      sinUsuario: 'true',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.activo).toBe(false);
    expect(dto.sinUsuario).toBe(true);
  });
});

describe('DTOs de ocupación', () => {
  const ocupacion = {
    idPuesto: 3,
    fechaDesde: '2024-01-01',
    idCaracterOcupacion: 1,
    idDedicacion: 1,
  };
  it('acepta una ocupación con y sin fin', async () => {
    expect(await errores(CrearOcupacionDto, ocupacion)).toEqual([]);
    expect(
      await errores(CrearOcupacionDto, {
        ...ocupacion,
        fechaHasta: '2024-12-31',
      }),
    ).toEqual([]);
  });
  it.each(['2024-02-30', '2024-01-01T10:00', 'x'])(
    'rechaza fechaDesde %s',
    async (fechaDesde) => {
      expect(
        await errores(CrearOcupacionDto, { ...ocupacion, fechaDesde }),
      ).toContain('fechaDesde');
    },
  );
  it('al actualizar, todo es opcional y fechaHasta admite null', async () => {
    expect(await errores(ActualizarOcupacionDto, {})).toEqual([]);
    expect(await errores(ActualizarOcupacionDto, { fechaHasta: null })).toEqual(
      [],
    );
  });
  it('cerrar exige una fecha de fin válida', async () => {
    expect(await errores(CerrarOcupacionDto, {})).toContain('fechaHasta');
    expect(
      await errores(CerrarOcupacionDto, { fechaHasta: '2024-13-01' }),
    ).toContain('fechaHasta');
    expect(
      await errores(CerrarOcupacionDto, { fechaHasta: '2024-12-31' }),
    ).toEqual([]);
  });
});
