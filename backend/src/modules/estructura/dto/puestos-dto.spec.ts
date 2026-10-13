import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ActualizarPuestoDto } from './actualizar-puesto.dto.js';
import { CrearPuestoDto } from './crear-puesto.dto.js';
import { FiltroPuestosDto } from './filtro-puestos.dto.js';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('FiltroPuestosDto', () => {
  it('convierte idUnidad y activo desde el query string', async () => {
    const filtro = (await pipe.transform(
      { idUnidad: '12', activo: 'false', q: 'jefe' },
      { type: 'query', metatype: FiltroPuestosDto },
    )) as FiltroPuestosDto;
    expect(filtro).toMatchObject({ idUnidad: 12, activo: false, q: 'jefe' });
  });

  it('rechaza parámetros desconocidos', async () => {
    await expect(
      pipe.transform(
        { otro: '1' },
        { type: 'query', metatype: FiltroPuestosDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un activo que no es booleano', async () => {
    await expect(
      pipe.transform(
        { activo: 'tal vez' },
        { type: 'query', metatype: FiltroPuestosDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ActualizarPuestoDto', () => {
  it.each(['codigo', 'idUnidad'])(
    'rechaza %s: no se edita después del alta',
    async (campo) => {
      await expect(
        pipe.transform(
          { [campo]: 'P-0009' },
          { type: 'body', metatype: ActualizarPuestoDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('acepta quitar el superior con null', async () => {
    const dto = (await pipe.transform(
      { idPuestoSuperior: null },
      { type: 'body', metatype: ActualizarPuestoDto },
    )) as ActualizarPuestoDto;
    expect(dto.idPuestoSuperior).toBeNull();
  });
});

describe('CrearPuestoDto', () => {
  const base = {
    denominacion: '  Jefe de cátedra ',
    idUnidad: 2,
    idNivelJerarquico: 2,
  };

  it('recorta la denominación', async () => {
    const dto = (await pipe.transform(base, {
      type: 'body',
      metatype: CrearPuestoDto,
    })) as CrearPuestoDto;
    expect(dto.denominacion).toBe('Jefe de cátedra');
  });

  it('rechaza una denominación vacía o de solo espacios', async () => {
    await expect(
      pipe.transform(
        { ...base, denominacion: '   ' },
        { type: 'body', metatype: CrearPuestoDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una dotación menor a 1 y el campo codigo', async () => {
    await expect(
      pipe.transform(
        { ...base, dotacionPrevista: 0 },
        { type: 'body', metatype: CrearPuestoDto },
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(
        { ...base, codigo: 'P-0001' },
        { type: 'body', metatype: CrearPuestoDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('límites numéricos de los puestos', () => {
  const base = { denominacion: 'Jefe', idUnidad: 2, idNivelJerarquico: 2 };
  const valoresFuera: [string, number][] = [
    ['dotacionPrevista', 10001],
    ['dotacionPrevista', 99999999999],
    ['idUnidad', 99999999999],
    ['idNivelJerarquico', 2147483648],
    ['idTipoRelacionContractual', 2147483648],
    ['idPuestoSuperior', 2147483648],
  ];

  it.each(valoresFuera)('CrearPuestoDto rechaza %s = %d', async (campo, v) => {
    await expect(
      pipe.transform(
        { ...base, [campo]: v },
        { type: 'body', metatype: CrearPuestoDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(valoresFuera)(
    'ActualizarPuestoDto rechaza %s = %d',
    async (campo, v) => {
      if (campo === 'idUnidad') return; // no se edita: otro rechazo
      await expect(
        pipe.transform(
          { [campo]: v },
          { type: 'body', metatype: ActualizarPuestoDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('acepta los máximos permitidos', async () => {
    await expect(
      pipe.transform(
        { ...base, dotacionPrevista: 10000, idUnidad: 2147483647 },
        { type: 'body', metatype: CrearPuestoDto },
      ),
    ).resolves.toBeDefined();
  });

  it.each(['0', '2147483648'])(
    'FiltroPuestosDto rechaza idUnidad = %s',
    async (idUnidad) => {
      await expect(
        pipe.transform(
          { idUnidad },
          { type: 'query', metatype: FiltroPuestosDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
