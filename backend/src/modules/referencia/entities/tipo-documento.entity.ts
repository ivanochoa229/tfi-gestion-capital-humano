import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_documento')
export class TipoDocumento extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_documento' })
  id: number;
}
