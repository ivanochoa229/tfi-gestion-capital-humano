import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('estado_plan')
export class EstadoPlan extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_estado_plan' })
  id: number;
}
