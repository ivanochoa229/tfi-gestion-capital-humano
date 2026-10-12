import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

export function aSnakeCase(texto: string): string {
  return texto
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Traduce los nombres del código (camelCase) a la base (snake_case):
 * la propiedad `fechaPrevistaRetiro` se guarda como `fecha_prevista_retiro`
 * y la entidad `RequisitoPuesto` como la tabla `requisito_puesto`.
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(
    nombreClase: string,
    nombreDado: string | undefined,
  ): string {
    return nombreDado ?? aSnakeCase(nombreClase);
  }

  override columnName(
    propiedad: string,
    nombreDado: string | undefined,
    prefijos: string[],
  ): string {
    const base = nombreDado ?? aSnakeCase(propiedad);
    return [...prefijos.map(aSnakeCase), base].join('_');
  }

  override relationName(propiedad: string): string {
    return aSnakeCase(propiedad);
  }

  override joinColumnName(
    relacion: string,
    columnaReferenciada: string,
  ): string {
    return aSnakeCase(`${relacion}_${columnaReferenciada}`);
  }

  override joinTableName(
    primeraTabla: string,
    segundaTabla: string,
    primeraPropiedad: string,
  ): string {
    return aSnakeCase(
      `${primeraTabla}_${primeraPropiedad.replace(/\./g, '_')}_${segundaTabla}`,
    );
  }

  override joinTableColumnName(
    tabla: string,
    propiedad: string,
    columna?: string,
  ): string {
    return aSnakeCase(`${tabla}_${columna ?? propiedad}`);
  }
}
