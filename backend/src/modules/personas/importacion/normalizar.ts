/** Para comparar denominaciones: sin mayúsculas, tildes ni espacios repetidos (la ñ se conserva). */
export function clave(texto: string): string {
  return texto
    .toLowerCase() // antes de normalizar, para que la Ñ mayúscula también se proteja
    .normalize('NFD')
    .replace(/n\u0303/g, '\uE000') // protege la ñ (n + tilde combinante)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uE000/g, 'ñ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * `DD/MM/AAAA` a `AAAA-MM-DD`. Cualquier otro texto vuelve igual: la
 * validación de fechas del DTO lo rechaza con su mensaje.
 */
export function aFechaIso(texto: string): string {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!partes) return texto.trim();
  const [, dia, mes, anio] = partes;
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}
