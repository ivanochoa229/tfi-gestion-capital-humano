import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('caracter_ocupacion')
export class CaracterOcupacion extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_caracter_ocupacion' })
  id: number;
}
