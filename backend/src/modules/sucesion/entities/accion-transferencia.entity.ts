import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Conocimiento } from '../../conocimiento/entities/conocimiento.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { EstadoAccionTransferencia } from '../../referencia/entities/estado-accion-transferencia.entity.js';
import { TipoAccionTransferencia } from '../../referencia/entities/tipo-accion-transferencia.entity.js';
import { PlanSucesion } from './plan-sucesion.entity.js';

/**
 * Acción de transferencia de un conocimiento (RF15). No se audita: bastan
 * `registradaEn`, `actualizadaEn` y la nota de avance. El CHECK
 * `CK_accion_cumplimiento_estado` usa el id del estado `completada` y vive
 * solo en la migración.
 */
@Entity('accion_transferencia')
@Check(
  'CK_accion_cumplimiento_fecha_no_futura',
  '"fecha_cumplimiento" IS NULL OR "fecha_cumplimiento" <= CURRENT_DATE',
)
@Check(
  'CK_accion_destinatario_distinto',
  '"id_destinatario" IS NULL OR "id_destinatario" <> "id_responsable"',
)
@Index('IDX_accion_transferencia_responsable', ['idResponsable'])
@Index('IDX_accion_transferencia_destinatario', ['idDestinatario'])
@Index('IDX_accion_transferencia_plan', ['idPlan'])
@Index('IDX_accion_transferencia_conocimiento', ['idConocimiento'])
export class AccionTransferencia {
  @PrimaryGeneratedColumn({ name: 'id_accion' })
  id: number;

  @Column({ name: 'id_tipo_accion', type: 'int' })
  idTipoAccion: number;

  @Column({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_plan', type: 'int', nullable: true })
  idPlan: number | null;

  @Column({ name: 'id_responsable', type: 'int' })
  idResponsable: number;

  @Column({ name: 'id_destinatario', type: 'int', nullable: true })
  idDestinatario: number | null;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'date' })
  fechaPrevista: string;

  @Column({ type: 'date', nullable: true })
  fechaCumplimiento: string | null;

  @Column({ name: 'id_estado_accion', type: 'int' })
  idEstadoAccion: number;

  @Column({ type: 'text', nullable: true })
  notaAvance: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registradaEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadaEn: Date;

  @ManyToOne(() => TipoAccionTransferencia, { nullable: false })
  @JoinColumn({ name: 'id_tipo_accion' })
  tipoAccion: Relation<TipoAccionTransferencia>;

  @ManyToOne(() => Conocimiento, { nullable: false })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => PlanSucesion, { nullable: true })
  @JoinColumn({ name: 'id_plan' })
  plan: Relation<PlanSucesion> | null;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_responsable' })
  responsable: Relation<Persona>;

  @ManyToOne(() => Persona, { nullable: true })
  @JoinColumn({ name: 'id_destinatario' })
  destinatario: Relation<Persona> | null;

  @ManyToOne(() => EstadoAccionTransferencia, { nullable: false })
  @JoinColumn({ name: 'id_estado_accion' })
  estadoAccion: Relation<EstadoAccionTransferencia>;
}
