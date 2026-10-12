import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity.js';

export type OperacionAuditada = 'alta' | 'modificacion' | 'baja';

/** Bitácora de cambios (RNF05). Solo se inserta; nunca se modifica ni se borra. */
@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn({ name: 'id_auditoria' })
  id: number;

  @Column({ type: 'varchar', length: 60 })
  entidad: string;

  /** Texto, para admitir claves compuestas (por ejemplo `3-17`). */
  @Column({ type: 'varchar', length: 100 })
  idRegistro: string;

  @Column({ type: 'varchar', length: 20 })
  operacion: OperacionAuditada;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'jsonb', nullable: true })
  valoresAnteriores: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  valoresNuevos: Record<string, unknown> | null;
}
