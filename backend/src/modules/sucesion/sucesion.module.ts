import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { AccionesController } from './acciones.controller.js';
import { AccionesService } from './acciones.service.js';
import { CandidatosController } from './candidatos.controller.js';
import { CandidatosService } from './candidatos.service.js';
import { CoberturaService } from './cobertura.service.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';
import { SucesionController } from './sucesion.controller.js';

/** Planes de sucesión, candidatos y acciones de transferencia (RF13–RF15). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanSucesion,
      CandidatoSucesion,
      AccionTransferencia,
    ]),
    ReferenciaModule,
    UsuariosModule,
  ],
  controllers: [
    PlanesController,
    CandidatosController,
    AccionesController,
    SucesionController,
  ],
  providers: [
    PlanesService,
    CandidatosService,
    AccionesService,
    CoberturaService,
  ],
  exports: [CoberturaService],
})
export class SucesionModule {}
