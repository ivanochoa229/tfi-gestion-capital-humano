import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { CriticidadController } from './criticidad.controller.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { MatrizService } from './matriz.service.js';
import { ParesService } from './pares.service.js';

/** Evaluación de criticidad por par conocimiento-puesto (RF12). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NivelImpacto,
      NivelDificultad,
      MatrizCriticidad,
      EvaluacionCriticidad,
      Puesto,
    ]),
    ReferenciaModule,
    UsuariosModule,
  ],
  controllers: [CriticidadController, EvaluacionesController],
  providers: [MatrizService, EvaluacionesService, ParesService],
  exports: [ParesService],
})
export class CriticidadModule {}
