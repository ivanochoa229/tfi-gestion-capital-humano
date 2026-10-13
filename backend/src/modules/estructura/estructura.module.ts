import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { JerarquiaService } from './jerarquia.service.js';
import { PuestosController } from './puestos.controller.js';
import { PuestosTipoService } from './puestos-tipo.service.js';
import { PuestosService } from './puestos.service.js';
import { UnidadesController } from './unidades.controller.js';
import { UnidadesService } from './unidades.service.js';

/**
 * Estructura y descripción de puestos (RF01–RF05). Por ahora: unidades
 * (solo consulta) y puestos (RF01, RF02). Funciones, tareas, responsabilidades,
 * estándares, riesgos, relaciones y relevamiento vendrán en bloques posteriores.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UnidadOrganizativa, Puesto]),
    ReferenciaModule,
  ],
  controllers: [UnidadesController, PuestosController],
  providers: [
    UnidadesService,
    JerarquiaService,
    PuestosService,
    PuestosTipoService,
  ],
  exports: [UnidadesService],
})
export class EstructuraModule {}
