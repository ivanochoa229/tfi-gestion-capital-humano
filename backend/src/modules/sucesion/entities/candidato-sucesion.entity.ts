import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Persona } from '../../personas/entities/persona.entity.js';
import { EstadoPreparacion } from '../../referencia/entities/estado-preparacion.entity.js';
import { PlanSucesion } from './plan-sucesion.entity.js';

/**
 * Candidato a suceder en un plan (RF14). Se audita (RNF05): escribir siempre
 * con `save()` o `remove()`. La unicidad `UQ_candidato_sucesion_prioridad`
 * (`DEFERRABLE INITIALLY IMMEDIATE`, para intercambiar prioridades en una
 * transacción) vive solo en la migración.
 */
@Entity('candidato_sucesion')
@Check('CK_candidato_sucesion_prioridad', '"prioridad" >= 1')
export class CandidatoSucesion {
  @PrimaryColumn({ name: 'id_plan', type: 'int' })
  idPlan: number;

  @PrimaryColumn({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @Column({ name: 'id_estado_preparacion', type: 'int' })
  idEstadoPreparacion: number;

  @Column({ type: 'int' })
  prioridad: number;

  @Column({ type: 'date', nullable: true })
  fechaDisponibilidadEstimada: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @ManyToOne(() => PlanSucesion, { nullable: false })
  @JoinColumn({ name: 'id_plan' })
  plan: Relation<PlanSucesion>;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne(() => EstadoPreparacion, { nullable: false })
  @JoinColumn({ name: 'id_estado_preparacion' })
  estadoPreparacion: Relation<EstadoPreparacion>;
}
