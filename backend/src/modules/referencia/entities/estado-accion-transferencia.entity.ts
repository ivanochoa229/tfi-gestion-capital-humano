import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferencia } from './valor-referencia.base.js';

@Entity('estado_accion_transferencia')
export class EstadoAccionTransferencia extends ValorReferencia {
  @PrimaryGeneratedColumn({ name: 'id_estado_accion_transferencia' })
  id: number;
}
