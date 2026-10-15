/** Para `ILIKE`: `%`, `_` y `\` del texto buscado no son comodines. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}
