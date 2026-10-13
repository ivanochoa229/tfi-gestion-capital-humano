import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';

/**
 * Estructura y descripción de puestos (RF01–RF05): unidades organizativas,
 * puestos, funciones, tareas, responsabilidades, estándares de desempeño,
 * riesgos, relaciones de trabajo y relevamiento.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UnidadOrganizativa, Puesto])],
})
export class EstructuraModule {}
