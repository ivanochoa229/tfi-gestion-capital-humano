import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';

/** Planes de sucesión, candidatos y acciones de transferencia (RF13–RF15). */
@Module({
  imports: [
    TypeOrmModule.forFeature([PlanSucesion, CandidatoSucesion]),
    ReferenciaModule,
    UsuariosModule,
  ],
  controllers: [PlanesController],
  providers: [PlanesService],
})
export class SucesionModule {}
