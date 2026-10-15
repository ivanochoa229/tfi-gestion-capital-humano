import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('dedicacion')
export class Dedicacion extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_dedicacion' })
  id: number;
}
