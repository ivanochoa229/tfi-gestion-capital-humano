import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('nivel_jerarquico')
export class NivelJerarquico extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_jerarquico' })
  id: number;
}
