import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_relacion_contractual')
export class TipoRelacionContractual extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_relacion_contractual' })
  id: number;
}
