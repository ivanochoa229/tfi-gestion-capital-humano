import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Env } from '../../infra/config/env.validation.js';

/** Traduce el rechazo de Multer por tamaño e indica el máximo permitido. */
@Catch(PayloadTooLargeException)
export class ArchivoDemasiadoGrandeFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService<Env, true>) {}

  catch(excepcion: PayloadTooLargeException, host: ArgumentsHost): void {
    const maximo = this.config.get('ACTIVOS_TAMANIO_MAX_MB', { infer: true });
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(excepcion.getStatus())
      .json({
        statusCode: 413,
        message: `El archivo supera el máximo de ${maximo} MB`,
        error: 'Payload Too Large',
      });
  }
}
