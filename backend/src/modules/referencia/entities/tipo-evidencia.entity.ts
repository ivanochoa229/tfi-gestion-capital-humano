import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_evidencia')
export class TipoEvidencia extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_evidencia' })
  id: number;
}
