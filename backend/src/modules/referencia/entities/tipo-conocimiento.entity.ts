import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_conocimiento')
export class TipoConocimiento extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_conocimiento' })
  id: number;
}
