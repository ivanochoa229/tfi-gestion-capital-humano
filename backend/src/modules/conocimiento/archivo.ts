import { UnsupportedMediaTypeException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';

export interface TipoArchivo {
  mime: string;
  extensiones: string[];
}

const tipo = (mime: string, ...extensiones: string[]): TipoArchivo => ({
  mime,
  extensiones,
});

const PDF = tipo('application/pdf', 'pdf');
const PNG = tipo('image/png', 'png');
const JPG = tipo('image/jpeg', 'jpg', 'jpeg');
const TXT = tipo('text/plain', 'txt');
const DOCX = tipo(
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'docx',
);
const XLSX = tipo(
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xlsx',
);
const PPTX = tipo(
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'pptx',
);
const ODT = tipo('application/vnd.oasis.opendocument.text', 'odt');

const empieza = (c: Buffer, firma: number[]) =>
  c.length >= firma.length && firma.every((b, i) => c[i] === b);

/** Los zip de Office guardan sin comprimir los nombres de sus partes: alcanza con buscarlos. */
function tipoZip(c: Buffer): TipoArchivo | null {
  if (c.includes('word/document.xml')) return DOCX;
  if (c.includes('xl/workbook.xml')) return XLSX;
  if (c.includes('ppt/presentation.xml')) return PPTX;
  // ODF: la primera entrada es `mimetype`, sin comprimir, y la sigue otra cabecera.
  if (c.toString('latin1', 30, 38) === 'mimetype') {
    const mime = ODT.mime;
    if (
      c.toString('latin1', 38, 38 + mime.length) === mime &&
      empieza(c.subarray(38 + mime.length), [0x50, 0x4b])
    ) {
      return ODT;
    }
  }
  return null;
}

function esTexto(c: Buffer): boolean {
  if (c.length === 0 || c.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(c);
    return true;
  } catch {
    return false;
  }
}

function tipoPorContenido(c: Buffer): TipoArchivo | null {
  if (empieza(c, [0x25, 0x50, 0x44, 0x46, 0x2d])) return PDF;
  if (empieza(c, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (empieza(c, [0xff, 0xd8, 0xff])) return JPG;
  if (empieza(c, [0x50, 0x4b, 0x03, 0x04])) return tipoZip(c);
  return esTexto(c) ? TXT : null;
}

/**
 * Tipo del archivo según sus bytes, siempre que la extensión del nombre sea la
 * que le corresponde. `null`: tipo no permitido o contenido que no coincide con
 * la extensión (un ejecutable renombrado a `.pdf`, un `.docx` llamado `.xlsx`).
 */
export function detectarTipo(
  contenido: Buffer,
  nombre: string,
): TipoArchivo | null {
  const detectado = tipoPorContenido(contenido);
  const extension = extname(nombre).toLowerCase().slice(1);
  return detectado && detectado.extensiones.includes(extension)
    ? detectado
    : null;
}

/**
 * Multer entrega `originalname` leyendo los bytes como latin1: si en realidad
 * eran UTF-8 (tildes, ñ), se recompone. Si el nombre ya viene bien, no cambia.
 */
export function decodificarNombre(original: string): string {
  if ([...original].some((c) => c.charCodeAt(0) > 0xff)) return original;
  const decodificado = Buffer.from(original, 'latin1').toString('utf8');
  return decodificado.includes('\uFFFD') ? original : decodificado;
}

/** Nombre legible para mostrar: sin ruta, sin caracteres de control, de hasta 255 caracteres y conservando la extensión. */
export function limpiarNombre(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? '';
  const limpio = base
    .normalize('NFC')
    .replace(/\p{Cc}/gu, '')
    .trim();
  if (limpio.length <= 255) return limpio || 'archivo';
  const extension = extname(limpio);
  return limpio.slice(0, 255 - extension.length) + extension;
}

/** Parte del nombre que va en la clave del objeto: solo ASCII seguro, hasta 100 caracteres y con la extensión al final. */
export function nombreParaClave(nombre: string): string {
  const seguro = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '');
  return seguro.slice(-100) || 'archivo';
}

/** `{carpeta}/{id}/{uuid}-{nombre}`: sin colisiones y legible en la consola de RustFS. */
export function claveEnCarpeta(
  carpeta: 'activos' | 'planes' | 'evidencias',
  id: number,
  nombre: string,
): string {
  return `${carpeta}/${id}/${randomUUID()}-${nombreParaClave(nombre)}`;
}

/** `activos/{idActivo}/{uuid}-{nombre}`. */
export function claveObjeto(idActivo: number, nombre: string): string {
  return claveEnCarpeta('activos', idActivo, nombre);
}

/** Lo que entrega Multer y usa el servicio: el nombre y los bytes. */
export interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

/** Metadatos de un archivo ya validado, listos para guardar en la base. */
export interface ArchivoPreparado {
  nombre: string;
  tipoMime: string;
  tamanio: number;
  hash: string;
}

export const TIPOS_PERMITIDOS_MENSAJE =
  'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG';

/** Valida el tipo por contenido y calcula los metadatos. 415 si el tipo no está permitido. */
export function prepararArchivo(archivo: ArchivoSubido): ArchivoPreparado {
  const nombre = limpiarNombre(decodificarNombre(archivo.originalname));
  const tipo = detectarTipo(archivo.buffer, nombre);
  if (!tipo) {
    throw new UnsupportedMediaTypeException(
      `El archivo no es de un tipo permitido (${TIPOS_PERMITIDOS_MENSAJE}) o su contenido no coincide con su extensión`,
    );
  }
  return {
    nombre,
    tipoMime: tipo.mime,
    tamanio: archivo.buffer.length,
    hash: hashSha256(archivo.buffer),
  };
}

export function hashSha256(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

/** `Content-Disposition: attachment` con respaldo ASCII y el nombre real en `filename*` (RFC 5987). */
export function disposicionAdjunto(nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nombre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
