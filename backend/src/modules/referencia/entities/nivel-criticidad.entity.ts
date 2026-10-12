import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('nivel_criticidad')
export class NivelCriticidad extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_criticidad' })
  id: number;
}
