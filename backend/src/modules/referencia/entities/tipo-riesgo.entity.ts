import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_riesgo')
export class TipoRiesgo extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_riesgo' })
  id: number;
}
