import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SesionGuard } from '../../common/guards/sesion.guard.js';
import { AlcanceService } from './alcance.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Rol } from './entities/rol.entity.js';
import { UsuarioUnidad } from './entities/usuario-unidad.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { LocalStrategy } from './local.strategy.js';
import { PasswordService } from './password.service.js';
import { SesionesService } from './sesiones.service.js';
import { SesionSerializer } from './sesion.serializer.js';
import { UsuariosBootstrapService } from './usuarios-bootstrap.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

/** Usuarios, roles, permisos y autenticación (RF22, RF24, RNF01). */
@Module({
  imports: [
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([Rol, Usuario, UsuarioUnidad]),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    PasswordService,
    SesionesService,
    AuthService,
    UsuariosService,
    AlcanceService,
    LocalStrategy,
    LocalAuthGuard,
    SesionSerializer,
    UsuariosBootstrapService,
    // El orden importa: primero la sesión y después el rol.
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, UsuariosService, AlcanceService, TypeOrmModule],
})
export class UsuariosModule {}
