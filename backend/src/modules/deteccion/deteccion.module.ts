import { Module } from '@nestjs/common';
import { CriticidadModule } from '../criticidad/criticidad.module.js';
import { SucesionModule } from '../sucesion/sucesion.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { DeteccionController } from './deteccion.controller.js';
import { DeteccionService } from './deteccion.service.js';
import { TableroController } from './tablero.controller.js';
import { TableroService } from './tablero.service.js';

/**
 * Consultas de detección y tablero de riesgo (RF16–RF21). Solo lectura sobre
 * vistas de PostgreSQL creadas por migración; no guarda datos (RNF04).
 */
@Module({
  imports: [UsuariosModule, CriticidadModule, SucesionModule],
  controllers: [DeteccionController, TableroController],
  providers: [DeteccionService, TableroService],
  exports: [DeteccionService, TableroService],
})
export class DeteccionModule {}
