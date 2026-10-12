import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES } from '../../common/roles.js';
import type { Env } from '../../infra/config/env.validation.js';
import { normalizarNombreUsuario } from './auth.service.js';
import { Rol } from './entities/rol.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { LARGO_MINIMO_CLAVE, PasswordService } from './password.service.js';

/** Crea el primer administrador desde el `.env` cuando la tabla de usuarios está vacía. */
@Injectable()
export class UsuariosBootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger(UsuariosBootstrapService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.usuarios.count()) > 0) return;

    const nombre = this.config.get('ADMIN_USUARIO', { infer: true });
    const clave = this.config.get('ADMIN_CLAVE', { infer: true });
    if (!nombre || !clave) {
      throw new Error(
        'No hay usuarios: definí ADMIN_USUARIO y ADMIN_CLAVE en el .env para crear el administrador inicial',
      );
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      throw new Error(
        `ADMIN_CLAVE debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
      );
    }

    const rol = await this.roles.findOneByOrFail({
      codigo: ROLES.administrador,
    });
    await this.usuarios.save(
      this.usuarios.create({
        nombreUsuario: normalizarNombreUsuario(nombre),
        claveHash: await this.passwords.hashear(clave),
        rol,
        idPersona: null,
        activo: true,
      }),
    );
    this.log.log(
      `Administrador inicial "${normalizarNombreUsuario(nombre)}" creado`,
    );
  }
}
