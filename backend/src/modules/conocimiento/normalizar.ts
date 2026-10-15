/**
 * Clave de comparación de una denominación: minúsculas, sin tildes ni
 * diéresis, con los espacios colapsados. Conserva la ñ, porque `año` y `ano`
 * son palabras distintas. La calcula la aplicación y la guarda la columna
 * `denominacion_normalizada`, bajo un índice único por tipo.
 */
export function normalizarDenominacion(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ|\p{M}/gu, (marca) => (marca === 'ñ' ? 'ñ' : ''))
    .replace(/\s+/g, ' ')
    .trim();
}
