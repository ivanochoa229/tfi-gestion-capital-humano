import { Module } from '@nestjs/common';

/**
 * Consultas de detección y tablero de riesgo (RF16–RF21). Solo lectura sobre
 * vistas de PostgreSQL creadas por migración; no guarda datos (RNF04).
 */
@Module({})
export class DeteccionModule {}
