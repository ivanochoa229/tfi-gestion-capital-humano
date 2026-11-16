import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { PasswordService } from '../modules/usuarios/password.service.js';
import { cargarDatosDemo } from './cargar-demo.js';
import { DemoService } from './demo.service.js';

vi.mock('./cargar-demo.js', () => ({ cargarDatosDemo: vi.fn() }));

const cargar = vi.mocked(cargarDatosDemo);

function crearServicio(activado: boolean) {
  const dataSource = {} as DataSource;
  const passwords = { hashear: vi.fn() } as unknown as PasswordService;
  const config = {
    get: vi.fn().mockReturnValue(activado),
  } as unknown as ConfigService<never, true>;
  return {
    dataSource,
    servicio: new DemoService(dataSource, passwords, config),
  };
}

describe('DemoService', () => {
  const advertencia = vi
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});
  const error = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

  beforeEach(() => {
    cargar.mockReset();
    advertencia.mockClear();
    error.mockClear();
  });

  it('no carga nada si CARGAR_DATOS_DEMO es false', async () => {
    const { servicio } = crearServicio(false);

    await servicio.onApplicationBootstrap();

    expect(cargar).not.toHaveBeenCalled();
  });

  it('carga una vez si CARGAR_DATOS_DEMO es true', async () => {
    cargar.mockResolvedValue('cargado');
    const { servicio, dataSource } = crearServicio(true);

    await servicio.onApplicationBootstrap();

    expect(cargar).toHaveBeenCalledTimes(1);
    expect(cargar.mock.calls[0][0]).toBe(dataSource);
  });

  it('registra una advertencia y no lanza si el resultado es "parcial"', async () => {
    cargar.mockResolvedValue('parcial');
    const { servicio } = crearServicio(true);

    await expect(servicio.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(advertencia).toHaveBeenCalledOnce();
  });

  it('no relanza si la carga falla, por ejemplo por tablas inexistentes', async () => {
    cargar.mockRejectedValue(new Error('relation "usuario" does not exist'));
    const { servicio } = crearServicio(true);

    await expect(servicio.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0][0])).toContain(
      'relation "usuario" does not exist',
    );
  });
});
