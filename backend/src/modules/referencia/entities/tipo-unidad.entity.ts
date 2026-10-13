import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_unidad')
export class TipoUnidad extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_unidad' })
  id: number;
}
