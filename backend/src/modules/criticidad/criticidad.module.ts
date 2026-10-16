import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { CriticidadController } from './criticidad.controller.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { MatrizService } from './matriz.service.js';

/** Evaluación de criticidad por par conocimiento-puesto (RF12). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NivelImpacto,
      NivelDificultad,
      MatrizCriticidad,
      EvaluacionCriticidad,
    ]),
    ReferenciaModule,
  ],
  controllers: [CriticidadController],
  providers: [MatrizService],
})
export class CriticidadModule {}
