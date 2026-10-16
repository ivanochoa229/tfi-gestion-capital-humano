import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ActualizarActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
} from './activos.dto.js';

const validar = <T extends object>(clase: new () => T, datos: object) => {
  const instancia = plainToInstance(clase, datos);
  const errores = validateSync(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instancia, propiedades: errores.map((e) => e.property) };
};

const base = {
  titulo: 'Manual de bases de datos',
  idTipoDocumento: '1',
  idUnidad: '2',
  idsConocimiento: '3',
};

describe('CrearActivoDto (multipart)', () => {
  it('convierte los campos de texto y envuelve un solo id en un arreglo', () => {
    const { instancia, propiedades } = validar(CrearActivoDto, base);
    expect(propiedades).toEqual([]);
    expect(instancia.idTipoDocumento).toBe(1);
    expect(instancia.idUnidad).toBe(2);
    expect(instancia.idsConocimiento).toEqual([3]);
  });

  it('acepta el campo repetido como arreglo', () => {
    const { instancia, propiedades } = validar(CrearActivoDto, {
      ...base,
      idsConocimiento: ['1', '2'],
    });
    expect(propiedades).toEqual([]);
    expect(instancia.idsConocimiento).toEqual([1, 2]);
  });

  it('exige al menos un conocimiento y rechaza ids repetidos o no numéricos', () => {
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: [] }).propiedades,
    ).toContain('idsConocimiento');
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: ['1', '1'] })
        .propiedades,
    ).toContain('idsConocimiento');
    expect(
      validar(CrearActivoDto, { ...base, idsConocimiento: ['x'] }).propiedades,
    ).toContain('idsConocimiento');
  });

  it('rechaza una fecha de vigencia imposible o con formato distinto', () => {
    expect(
      validar(CrearActivoDto, { ...base, fechaVigencia: '2026-02-30' })
        .propiedades,
    ).toContain('fechaVigencia');
    expect(
      validar(CrearActivoDto, {
        ...base,
        fechaVigencia: '2026-02-28T10:00:00Z',
      }).propiedades,
    ).toContain('fechaVigencia');
    expect(
      validar(CrearActivoDto, { ...base, fechaVigencia: '2026-02-28' })
        .propiedades,
    ).toEqual([]);
  });

  it('solo admite enlaces http o https', () => {
    for (const enlace of ['javascript:alert(1)', 'ftp://host/x', 'wiki']) {
      expect(
        validar(CrearActivoDto, { ...base, enlace }).propiedades,
      ).toContain('enlace');
    }
    expect(
      validar(CrearActivoDto, { ...base, enlace: 'https://wiki.example/x' })
        .propiedades,
    ).toEqual([]);
  });

  it('recorta el título y rechaza uno demasiado corto o largo', () => {
    expect(
      validar(CrearActivoDto, { ...base, titulo: '  ab  ' }).instancia.titulo,
    ).toBe('ab');
    expect(
      validar(CrearActivoDto, { ...base, titulo: ' a ' }).propiedades,
    ).toContain('titulo');
    expect(
      validar(CrearActivoDto, { ...base, titulo: 'x'.repeat(201) }).propiedades,
    ).toContain('titulo');
  });
});

describe('ActualizarActivoDto', () => {
  it('todo es opcional y la fecha admite null para borrarla', () => {
    expect(validar(ActualizarActivoDto, {}).propiedades).toEqual([]);
    const { instancia, propiedades } = validar(ActualizarActivoDto, {
      fechaVigencia: null,
      idsConocimiento: [1, 2],
    });
    expect(propiedades).toEqual([]);
    expect(instancia.fechaVigencia).toBeNull();
  });
});

describe('FiltroActivosDto', () => {
  it('convierte la consulta y aplica pagina y tamanio por defecto', () => {
    const { instancia, propiedades } = validar(FiltroActivosDto, {
      idConocimiento: '4',
      vencido: 'true',
      incluirBajas: 'false',
    });
    expect(propiedades).toEqual([]);
    expect(instancia).toMatchObject({
      idConocimiento: 4,
      vencido: true,
      incluirBajas: false,
      pagina: 1,
      tamanio: 20,
    });
  });

  it('limita el tamaño de página a 100', () => {
    expect(validar(FiltroActivosDto, { tamanio: '101' }).propiedades).toContain(
      'tamanio',
    );
    expect(validar(FiltroActivosDto, { pagina: '0' }).propiedades).toContain(
      'pagina',
    );
  });

  it.each(['idConocimiento', 'idUnidad', 'idTipoDocumento'])(
    'rechaza %s fuera de rango',
    (campo) => {
      expect(validar(FiltroActivosDto, { [campo]: '0' }).propiedades).toContain(
        campo,
      );
      expect(
        validar(FiltroActivosDto, { [campo]: '2147483648' }).propiedades,
      ).toContain(campo);
    },
  );

  it('rechaza una página desmedida', () => {
    expect(
      validar(FiltroActivosDto, { pagina: '100001' }).propiedades,
    ).toContain('pagina');
  });
});
