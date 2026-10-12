import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('tipo_accion_transferencia')
export class TipoAccionTransferencia extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_tipo_accion_transferencia' })
  id: number;
}
