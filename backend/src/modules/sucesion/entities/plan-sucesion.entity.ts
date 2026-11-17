import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { EstadoPlan } from '../../referencia/entities/estado-plan.entity.js';

/**
 * Plan de sucesión de un puesto (RF13). Se audita (RNF05): escribir siempre
 * con `save()` o `remove()`. Los índices únicos parciales
 * (`UQ_plan_sucesion_aprobado`, `UQ_plan_sucesion_en_elaboracion`), que dependen
 * de los ids de los estados, viven solo en la migración. Que rechazar exija
 * `motivoResolucion` lo valida el servicio, no la base.
 */
@Entity('plan_sucesion')
@Check(
  'CK_plan_sucesion_documento',
  '("documento_clave" IS NULL AND "documento_nombre" IS NULL AND "documento_tipo_mime" IS NULL AND "documento_tamanio" IS NULL AND "documento_hash" IS NULL) OR ("documento_clave" IS NOT NULL AND "documento_nombre" IS NOT NULL AND "documento_tipo_mime" IS NOT NULL AND "documento_tamanio" IS NOT NULL AND "documento_hash" IS NOT NULL)',
)
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

  // Documento del plan en RustFS (todas nulas o todas con valor).
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentoClave: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentoNombre: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentoTipoMime: string | null;

  @Column({ type: 'int', nullable: true })
  documentoTamanio: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentoHash: string | null;

  @ManyToOne(() => Puesto, { nullable: false })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_responsable' })
  responsable: Relation<Persona>;

  @ManyToOne(() => PlanSucesion, { nullable: true })
  @JoinColumn({ name: 'id_plan_anterior' })
  planAnterior: Relation<PlanSucesion> | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_usuario_resolucion' })
  usuarioResolucion: Relation<Usuario> | null;

  @ManyToOne(() => EstadoPlan, { nullable: false })
  @JoinColumn({ name: 'id_estado_plan' })
  estadoPlan: Relation<EstadoPlan>;
}
