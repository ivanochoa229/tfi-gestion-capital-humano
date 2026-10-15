import { BadRequestException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportarPersonasDto } from './dto/importar-personas.dto.js';
import { ImportacionController } from './importacion.controller.js';
import { PLANTILLA_CSV } from './plantilla.js';
import { COLUMNAS } from './tipos.js';

describe('ImportacionController', () => {
  const importar = vi.fn();
  const controller = new ImportacionController({ importar } as never);

  it('registra POST personas/importacion y GET plantilla', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ImportacionController)).toBe(
      'personas/importacion',
    );
    const post = ImportacionController.prototype.importar;
    expect(Reflect.getMetadata(METHOD_METADATA, post)).toBe(RequestMethod.POST);
    const interceptores = Reflect.getMetadata(
      '__interceptors__',
      post,
    ) as unknown[];
    expect(interceptores).toHaveLength(1);
    expect(Reflect.getMetadata('swagger/apiConsumes', post)).toEqual([
      'multipart/form-data',
    ]);
    const get = ImportacionController.prototype.plantilla;
    expect(Reflect.getMetadata(METHOD_METADATA, get)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, get)).toBe('plantilla');
  });

  it('sin archivo responde 400 y no llama al servicio', () => {
    expect(() => controller.importar(undefined, {})).toThrow(
      BadRequestException,
    );
    expect(importar).not.toHaveBeenCalled();
  });

  it('pasa el buffer y confirmar al servicio (false por defecto)', async () => {
    importar.mockResolvedValue({});
    const buffer = Buffer.from('x');
    await controller.importar({ buffer } as Express.Multer.File, {});
    expect(importar).toHaveBeenCalledWith(buffer, false);
  });

  it('la plantilla trae BOM, cabecera y una fila de ejemplo', () => {
    const lineas = controller.plantilla().split('\n');
    expect(PLANTILLA_CSV.charCodeAt(0)).toBe(0xfeff);
    expect(lineas[0]).toBe(`﻿${COLUMNAS.join(';')}`);
    expect(lineas[1].split(';')).toHaveLength(COLUMNAS.length);
  });
});

describe('ImportarPersonasDto', () => {
  const probar = (confirmar: unknown) => {
    const dto = plainToInstance(ImportarPersonasDto, { confirmar });
    return validate(dto).then((errores) => ({ dto, errores }));
  };

  it.each([
    ['true', true],
    ['false', false],
  ])('transforma %s a booleano', async (entrada, esperado) => {
    const { dto, errores } = await probar(entrada);
    expect(errores).toHaveLength(0);
    expect(dto.confirmar).toBe(esperado);
  });

  it('acepta que falte', async () => {
    const { errores } = await probar(undefined);
    expect(errores).toHaveLength(0);
  });

  it.each(['si', '1', 'TRUE', ''])('rechaza %j', async (entrada) => {
    const { errores } = await probar(entrada);
    expect(errores).toHaveLength(1);
  });
});
