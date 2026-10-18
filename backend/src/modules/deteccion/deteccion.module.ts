import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { DeteccionController } from './deteccion.controller.js';
import { DeteccionService } from './deteccion.service.js';

/**
 * Consultas de detección y tablero de riesgo (RF16–RF21). Solo lectura sobre
 * vistas de PostgreSQL creadas por migración; no guarda datos (RNF04).
 */
@Module({
  imports: [UsuariosModule],
  controllers: [DeteccionController],
  providers: [DeteccionService],
  exports: [DeteccionService],
})
export class DeteccionModule {}
