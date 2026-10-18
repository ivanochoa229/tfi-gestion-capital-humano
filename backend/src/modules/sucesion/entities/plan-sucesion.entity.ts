import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { EstadoPlan } from '../../referencia/entities/estado-plan.entity.js';

/**
 * Plan de sucesión de un puesto (RF13). Se audita (RNF05): escribir siempre
 * con `save()` o `remove()`. Los índices únicos parciales
 * (`UQ_plan_sucesion_aprobado`, `UQ_plan_sucesion_en_elaboracion`), que dependen
 * de los ids de los estados, viven solo en la migración.
 */
@Entity('plan_sucesion')
@Check(
  'CK_plan_sucesion_resolucion',
  '("id_usuario_resolucion" IS NULL) = ("fecha_resolucion" IS NULL)',
)
export class PlanSucesion {
  @PrimaryGeneratedColumn({ name: 'id_plan' })
  id: number;

  @Column({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @Column({ name: 'id_responsable', type: 'int' })
  idResponsable: number;

  @Column({ name: 'id_estado_plan', type: 'int' })
  idEstadoPlan: number;

  @Column({ type: 'date', default: () => "('now'::text)::date" })
  fechaElaboracion: string;

  @Column({ name: 'id_plan_anterior', type: 'int', nullable: true })
  idPlanAnterior: number | null;

  @Column({ name: 'id_usuario_resolucion', type: 'int', nullable: true })
  idUsuarioResolucion: number | null;

  @Column({ type: 'date', nullable: true })
  fechaResolucion: string | null;

  @Column({ type: 'text', nullable: true })
  motivoResolucion: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @ManyToOne(() => Puesto, { nullable: false })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_responsable' })
  responsable: Relation<Persona>;

  @ManyToOne(() => EstadoPlan, { nullable: false })
  @JoinColumn({ name: 'id_estado_plan' })
  estadoPlan: Relation<EstadoPlan>;
}
