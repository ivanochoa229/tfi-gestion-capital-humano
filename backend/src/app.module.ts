import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEnv } from './infra/config/env.validation.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { SaludController } from './infra/salud/salud.controller.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AuditoriaModule } from './infra/auditoria/auditoria.module.js';
import { ConocimientoModule } from './modules/conocimiento/conocimiento.module.js';
import { CriticidadModule } from './modules/criticidad/criticidad.module.js';
import { DeteccionModule } from './modules/deteccion/deteccion.module.js';
import { EstructuraModule } from './modules/estructura/estructura.module.js';
import { PersonasModule } from './modules/personas/personas.module.js';
import { ReferenciaModule } from './modules/referencia/referencia.module.js';
import { SucesionModule } from './modules/sucesion/sucesion.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // En Docker las variables llegan por el entorno; fuera de Docker se
      // leen del .env de la raíz del repositorio.
      envFilePath: ['.env', '../.env'],
      validate: validarEnv,
    }),
    DatabaseModule,
    StorageModule,
    AuditoriaModule,
    EstructuraModule,
    PersonasModule,
    ConocimientoModule,
    CriticidadModule,
    SucesionModule,
    DeteccionModule,
    UsuariosModule,
    ReferenciaModule,
  ],
  controllers: [SaludController],
})
export class AppModule {}
