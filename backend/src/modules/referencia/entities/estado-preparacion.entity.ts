import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('estado_preparacion')
export class EstadoPreparacion extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_estado_preparacion' })
  id: number;
}
