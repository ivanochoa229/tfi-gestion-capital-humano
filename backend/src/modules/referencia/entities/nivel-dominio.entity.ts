import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from './valor-referencia.base.js';

@Entity('nivel_dominio')
export class NivelDominio extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_dominio' })
  id: number;
}
