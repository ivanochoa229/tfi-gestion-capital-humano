import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NivelDominio } from './entities/nivel-dominio.entity.js';
import { NivelCriticidad } from './entities/nivel-criticidad.entity.js';
import { EstadoPreparacion } from './entities/estado-preparacion.entity.js';
import { TipoConocimiento } from './entities/tipo-conocimiento.entity.js';
import { TipoResponsabilidad } from './entities/tipo-responsabilidad.entity.js';
import { TipoRiesgo } from './entities/tipo-riesgo.entity.js';
import { CaracterOcupacion } from './entities/caracter-ocupacion.entity.js';
import { TipoAccionTransferencia } from './entities/tipo-accion-transferencia.entity.js';
import { EstadoAccionTransferencia } from './entities/estado-accion-transferencia.entity.js';
import { EstadoPlan } from './entities/estado-plan.entity.js';
import { TipoUnidad } from './entities/tipo-unidad.entity.js';
import { NivelJerarquico } from './entities/nivel-jerarquico.entity.js';
import { TipoRelacionContractual } from './entities/tipo-relacion-contractual.entity.js';
import { ReferenciaController } from './referencia.controller.js';
import { ReferenciaService } from './referencia.service.js';

/**
 * Tablas de referencia de dominio cerrado (RF23): niveles de dominio,
 * niveles de criticidad, tipos y estados.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NivelDominio,
      NivelCriticidad,
      EstadoPreparacion,
      TipoConocimiento,
      TipoResponsabilidad,
      TipoRiesgo,
      CaracterOcupacion,
      TipoAccionTransferencia,
      EstadoAccionTransferencia,
      EstadoPlan,
      TipoUnidad,
      NivelJerarquico,
      TipoRelacionContractual,
    ]),
  ],
  controllers: [ReferenciaController],
  providers: [ReferenciaService],
  exports: [ReferenciaService],
})
export class ReferenciaModule {}
