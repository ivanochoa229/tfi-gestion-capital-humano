import {
  claveObjeto,
  decodificarNombre,
  detectarTipo,
  disposicionAdjunto,
  hashSha256,
  limpiarNombre,
  nombreParaClave,
} from './archivo.js';

const PK = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const zip = (...nombres: string[]) =>
  Buffer.concat([PK, Buffer.alloc(26), Buffer.from(nombres.join('\0'))]);
const odt = (mime: string) =>
  Buffer.concat([
    PK,
    Buffer.alloc(26),
    Buffer.from('mimetype'),
    Buffer.from(mime),
    PK,
  ]);
const pdf = Buffer.from('%PDF-1.7\ncontenido');
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('detectarTipo', () => {
  it.each([
    ['manual.pdf', pdf, 'application/pdf'],
    ['MANUAL.PDF', pdf, 'application/pdf'],
    ['foto.png', png, 'image/png'],
    ['foto.jpg', jpg, 'image/jpeg'],
    ['foto.jpeg', jpg, 'image/jpeg'],
    [
      'a.docx',
      zip('[Content_Types].xml', 'word/document.xml'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'a.xlsx',
      zip('[Content_Types].xml', 'xl/workbook.xml'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'a.pptx',
      zip('[Content_Types].xml', 'ppt/presentation.xml'),
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    [
      'a.odt',
      odt('application/vnd.oasis.opendocument.text'),
      'application/vnd.oasis.opendocument.text',
    ],
    ['notas.txt', Buffer.from('Año nuevo\nsegunda línea'), 'text/plain'],
  ])('acepta %s', (nombre, contenido, mime) => {
    expect(detectarTipo(contenido, nombre)?.mime).toBe(mime);
  });

  it('rechaza un ejecutable renombrado a .pdf', () => {
    expect(detectarTipo(Buffer.from('MZ\x90\x00 programa'), 'manual.pdf')).toBe(
      null,
    );
  });

  it('rechaza un PDF con extensión de ejecutable', () => {
    expect(detectarTipo(pdf, 'manual.exe')).toBe(null);
  });

  it('rechaza un docx renombrado a .xlsx', () => {
    expect(detectarTipo(zip('word/document.xml'), 'a.xlsx')).toBe(null);
  });

  it('rechaza un zip genérico con extensión de Office', () => {
    expect(detectarTipo(zip('cualquiera.txt'), 'a.docx')).toBe(null);
  });

  it('rechaza una hoja de cálculo ODF con extensión .odt', () => {
    expect(
      detectarTipo(
        odt('application/vnd.oasis.opendocument.spreadsheet'),
        'a.odt',
      ),
    ).toBe(null);
  });

  it('rechaza un texto con bytes nulos, con UTF-8 inválido o vacío', () => {
    expect(detectarTipo(Buffer.from('a\0b'), 'a.txt')).toBe(null);
    expect(detectarTipo(Buffer.from([0xff, 0xfe, 0x41]), 'a.txt')).toBe(null);
    expect(detectarTipo(Buffer.alloc(0), 'a.txt')).toBe(null);
  });

  it('rechaza un nombre sin extensión', () => {
    expect(detectarTipo(pdf, 'manual')).toBe(null);
  });
});

describe('nombres', () => {
  it('limpia rutas y caracteres de control', () => {
    expect(limpiarNombre('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(limpiarNombre('C:\\docs\\manual.pdf')).toBe('manual.pdf');
    expect(limpiarNombre('a\u0000b\u001f.pdf')).toBe('ab.pdf');
    expect(limpiarNombre('   ')).toBe('archivo');
  });

  it('conserva tildes y ñ en el nombre legible y acota el largo', () => {
    expect(limpiarNombre('Año nuevo (v2).docx')).toBe('Año nuevo (v2).docx');
    const largo = limpiarNombre('a'.repeat(300) + '.pdf');
    expect(largo).toHaveLength(255);
    expect(largo.endsWith('.pdf')).toBe(true);
  });

  it('decodifica el nombre que Multer entrega como latin1', () => {
    const comoLlega = Buffer.from('Año.pdf', 'utf8').toString('latin1');
    expect(decodificarNombre(comoLlega)).toBe('Año.pdf');
    expect(decodificarNombre('Año.pdf')).toBe('Año.pdf');
    expect(decodificarNombre('plano.pdf')).toBe('plano.pdf');
  });

  it('arma un nombre ASCII seguro para la clave sin perder la extensión', () => {
    expect(nombreParaClave('Año nuevo (v2).docx')).toBe('Ano_nuevo_v2_.docx');
    expect(nombreParaClave('.htaccess')).toBe('htaccess');
    expect(nombreParaClave('???')).toBe('archivo');
    expect(nombreParaClave('x'.repeat(200) + '.pdf')).toHaveLength(100);
    expect(nombreParaClave('x'.repeat(200) + '.pdf').endsWith('.pdf')).toBe(
      true,
    );
  });

  it('arma la clave con el id del activo y un uuid', () => {
    const a = claveObjeto(12, 'Año.pdf');
    const b = claveObjeto(12, 'Año.pdf');
    expect(a).toMatch(/^activos\/12\/[0-9a-f-]{36}-Ano\.pdf$/);
    expect(a).not.toBe(b);
  });
});

describe('hash y descarga', () => {
  it('calcula el SHA-256 hexadecimal', () => {
    expect(hashSha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('arma el Content-Disposition con respaldo ASCII y nombre UTF-8', () => {
    const cabecera = disposicionAdjunto('Año "nuevo".pdf');
    expect(cabecera).toBe(
      `attachment; filename="A_o _nuevo_.pdf"; filename*=UTF-8''A%C3%B1o%20%22nuevo%22.pdf`,
    );
    expect(disposicionAdjunto("a'(b).pdf")).toContain(
      "filename*=UTF-8''a%27%28b%29.pdf",
    );
  });
});
