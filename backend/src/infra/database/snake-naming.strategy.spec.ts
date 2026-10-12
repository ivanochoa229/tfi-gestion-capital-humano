import { aSnakeCase, SnakeNamingStrategy } from './snake-naming.strategy.js';

describe('SnakeNamingStrategy', () => {
  const estrategia = new SnakeNamingStrategy();

  it('convierte propiedades camelCase en columnas snake_case', () => {
    expect(estrategia.columnName('fechaPrevistaRetiro', undefined, [])).toBe(
      'fecha_prevista_retiro',
    );
  });

  it('respeta el nombre de columna indicado en la entidad', () => {
    expect(estrategia.columnName('nivel', 'nivel_requerido', [])).toBe(
      'nivel_requerido',
    );
  });

  it('convierte nombres de clase en nombres de tabla', () => {
    expect(estrategia.tableName('RequisitoPuesto', undefined)).toBe(
      'requisito_puesto',
    );
    expect(estrategia.tableName('EvaluacionCriticidad', undefined)).toBe(
      'evaluacion_criticidad',
    );
  });

  it('nombra las claves foráneas como relacion_columna', () => {
    expect(estrategia.joinColumnName('puestoSuperior', 'idPuesto')).toBe(
      'puesto_superior_id_puesto',
    );
  });

  it('maneja siglas consecutivas', () => {
    expect(aSnakeCase('tipoMIME')).toBe('tipo_mime');
  });
});
