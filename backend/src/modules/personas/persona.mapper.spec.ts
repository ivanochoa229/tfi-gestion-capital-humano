import type { Persona } from './entities/persona.entity.js';
import { aPersonaDto, puedeVerDatosPersonales } from './persona.mapper.js';

const persona = {
  id: 1,
  legajo: 'L-1',
  apellido: 'Pérez',
  nombre: 'Ana',
  documento: '30111111',
  fechaNacimiento: '1980-01-01',
  fechaIngreso: '2005-03-01',
  idSituacionRevista: 2,
  fechaPrevistaRetiro: null,
  activo: true,
} as Persona;

describe('aPersonaDto', () => {
  it('incluye documento y fecha de nacimiento cuando se pueden ver', () => {
    expect(
      aPersonaDto(persona, { verSensibles: true, tieneUsuario: false }),
    ).toMatchObject({
      documento: '30111111',
      fechaNacimiento: '1980-01-01',
      tieneUsuario: false,
    });
  });
  it('omite las claves (no las deja en undefined) cuando no se pueden ver', () => {
    const dto = aPersonaDto(persona, {
      verSensibles: false,
      tieneUsuario: true,
    });
    expect(dto).not.toHaveProperty('documento');
    expect(dto).not.toHaveProperty('fechaNacimiento');
    expect(JSON.stringify(dto)).not.toContain('30111111');
    expect(dto).toMatchObject({ id: 1, legajo: 'L-1', tieneUsuario: true });
  });
});

describe('puedeVerDatosPersonales', () => {
  it.each([
    ['recursos_humanos', true],
    ['administrador', true],
    ['autoridad', false],
    ['jefatura_departamento', false],
    ['jefe_catedra', false],
    ['analista_puestos', false],
    ['docente', false],
  ] as const)('%s → %s', (rol, esperado) => {
    expect(puedeVerDatosPersonales(rol)).toBe(esperado);
  });
});
