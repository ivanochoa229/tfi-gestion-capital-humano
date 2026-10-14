import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('situacion_revista')
export class SituacionRevista extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_situacion_revista' })
  id: number;
}
