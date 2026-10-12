import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_responsabilidad')
export class TipoResponsabilidad extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_responsabilidad' })
  id: number;
}
