import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('area_tematica')
export class AreaTematica extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_area_tematica' })
  id: number;
}
