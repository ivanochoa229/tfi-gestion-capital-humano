import {
  construirCatalogos,
  resolverCaracter,
  resolverPuesto,
  resolverSituacion,
  type DatosCatalogos,
} from './catalogos.js';

const datos: DatosCatalogos = {
  situaciones: [
    { id: 1, denominacion: 'Planta permanente' },
    { id: 2, denominacion: 'Contratado' },
  ],
  caracteres: [{ id: 1, denominacion: 'Titular' }],
  dedicaciones: [{ id: 1, denominacion: 'Simple' }],
  unidades: [
    { id: 1, denominacion: 'Facultad', idSuperior: null, activo: true },
    { id: 2, denominacion: 'Departamento A', idSuperior: 1, activo: true },
    { id: 3, denominacion: 'Departamento B', idSuperior: 1, activo: true },
    { id: 4, denominacion: 'Cátedra de Física', idSuperior: 2, activo: true },
    { id: 5, denominacion: 'Cátedra de Física', idSuperior: 3, activo: true },
    { id: 6, denominacion: 'Cátedra de Química', idSuperior: 2, activo: true },
    { id: 7, denominacion: 'Cátedra vieja', idSuperior: 2, activo: false },
  ],
  puestos: [
    { id: 100, denominacion: 'Titular', idUnidad: 4 },
    { id: 101, denominacion: 'Titular', idUnidad: 5 },
    { id: 102, denominacion: 'Jefe', idUnidad: 6 },
  ],
};
const catalogos = construirCatalogos(datos);

describe('resolver dominios', () => {
  it('encuentra por denominación sin mayúsculas ni tildes', () => {
    expect(resolverSituacion(catalogos, 'PLANTA PERMANENTE')).toEqual({
      valor: 1,
    });
    expect(resolverCaracter(catalogos, 'titular')).toEqual({ valor: 1 });
  });

  it('si no existe, lista las opciones', () => {
    const r = resolverSituacion(catalogos, 'Jubilado');
    expect(r).toEqual({ error: expect.stringContaining('Planta permanente') });
    expect(r).toEqual({ error: expect.stringContaining('Contratado') });
    expect(r).toEqual({ error: expect.stringContaining('Jubilado') });
  });
});

describe('resolverPuesto', () => {
  it('resuelve unidad única y puesto dentro de ella', () => {
    expect(resolverPuesto(catalogos, 'cátedra de química', 'Jefe')).toEqual({
      valor: 102,
    });
  });

  it('una unidad con el mismo nombre en dos ramas es ambigua y nombra las candidatas con su ruta', () => {
    const r = resolverPuesto(catalogos, 'Cátedra de Física', 'Titular');
    expect(r).toEqual({
      error: expect.stringContaining(
        'Facultad > Departamento A > Cátedra de Física',
      ),
    });
    expect(r).toEqual({
      error: expect.stringContaining(
        'Facultad > Departamento B > Cátedra de Física',
      ),
    });
  });

  it('una unidad inexistente o inactiva no se encuentra', () => {
    expect(resolverPuesto(catalogos, 'Cátedra de Arte', 'Jefe')).toEqual({
      error: expect.stringContaining('Cátedra de Arte'),
    });
    expect(resolverPuesto(catalogos, 'Cátedra vieja', 'Jefe')).toEqual({
      error: expect.stringContaining('Cátedra vieja'),
    });
  });

  it('un puesto que no es de esa unidad no se encuentra', () => {
    expect(resolverPuesto(catalogos, 'Cátedra de Química', 'Titular')).toEqual({
      error: expect.stringMatching(/Cátedra de Química.*Titular/),
    });
  });
});
