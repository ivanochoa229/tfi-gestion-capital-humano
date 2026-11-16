import { Module } from '@nestjs/common';
import { UsuariosModule } from '../modules/usuarios/usuarios.module.js';
import { DemoService } from './demo.service.js';

/** Datos y usuarios de demostración, activados con CARGAR_DATOS_DEMO. */
@Module({
  imports: [UsuariosModule],
  providers: [DemoService],
})
export class DemoModule {}
