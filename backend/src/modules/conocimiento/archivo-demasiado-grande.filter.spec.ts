import { PayloadTooLargeException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../infra/config/env.validation.js';
import { ArchivoDemasiadoGrandeFilter } from './archivo-demasiado-grande.filter.js';

describe('ArchivoDemasiadoGrandeFilter', () => {
  it('responde 413 con el máximo configurado en español', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
    const config = {
      get: () => 7,
    } as unknown as ConfigService<Env, true>;

    new ArchivoDemasiadoGrandeFilter(config).catch(
      new PayloadTooLargeException('File too large'),
      host,
    );

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'El archivo supera el máximo de 7 MB',
      error: 'Payload Too Large',
    });
  });
});
