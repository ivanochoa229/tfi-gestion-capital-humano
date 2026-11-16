import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Env } from '../infra/config/env.validation.js';
import { PasswordService } from '../modules/usuarios/password.service.js';
import { cargarDatosDemo } from './cargar-demo.js';
import { CLAVE_DEMO, USUARIOS_DEMO } from './datos-demo.js';

/**
 * Carga los datos de demostración al arrancar si `CARGAR_DATOS_DEMO` es `true`.
 * Nunca impide el arranque: ante un error lo registra y sigue.
 */
@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly log = new Logger(DemoService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('CARGAR_DATOS_DEMO', { infer: true })) return;

    try {
      const resultado = await cargarDatosDemo(this.dataSource, (clave) =>
        this.passwords.hashear(clave),
      );
      if (resultado === 'cargado') {
        const nombres = USUARIOS_DEMO.map((u) => u.nombreUsuario).join(', ');
        this.log.log(
          `Datos de demostración cargados. Usuarios: ${nombres}. Clave de todos: ${CLAVE_DEMO}`,
        );
      } else if (resultado === 'omitido') {
        this.log.debug('Los datos de demostración ya estaban cargados');
      } else {
        this.log.warn(
          'Hay datos de demostración (legajos DEMO-) pero falta el usuario demo.admin: no se carga nada. Para empezar de cero: docker compose down -v',
        );
      }
    } catch (error) {
      this.log.error(
        `No se pudieron cargar los datos de demostración: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
