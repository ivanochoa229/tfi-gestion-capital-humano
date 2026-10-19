export interface ColumnaCsv {
  clave: string;
  titulo: string;
}

function formatearCelda(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'boolean') {
    return valor ? 'sí' : 'no';
  }

  if (typeof valor === 'number') {
    return String(valor);
  }

  let texto = String(valor);

  if (typeof valor === 'string' && /^[=+\-@]/.test(valor)) {
    texto = `'${valor}`;
  }

  if (/[;"\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

/**
 * Convierte un listado de registros a formato CSV con codificación UTF-8 y BOM,
 * separador punto y coma (;) y neutralización de inyección de fórmulas para Excel.
 */
export function aCsv(
  columnas: ColumnaCsv[],
  filas: Record<string, unknown>[],
): string {
  const lineas: string[] = [];

  const encabezado = columnas
    .map((col) => formatearCelda(col.titulo))
    .join(';');
  lineas.push(encabezado);

  for (const fila of filas) {
    const linea = columnas
      .map((col) => formatearCelda(fila[col.clave]))
      .join(';');
    lineas.push(linea);
  }

  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}
