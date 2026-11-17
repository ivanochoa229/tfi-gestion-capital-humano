import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Persona } from '../../personas/entities/persona.entity.js';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { TipoEvidencia } from '../../referencia/entities/tipo-evidencia.entity.js';
import { ConocimientoPersona } from './conocimiento-persona.entity.js';

/**
 * Una evaluación de un conocimiento de una persona. Solo se agregan filas:
 * un error se corrige con una acreditación nueva y más reciente. Es el
 * historial, por eso no se audita. Vigente: mayor `fechaEvaluacion` y, en
 * empate, mayor `id`.
 */
@Entity('acreditacion')
@Check(
  'CK_acreditacion_evidencia',
  '("evidencia_clave" IS NULL AND "evidencia_nombre" IS NULL AND "evidencia_tipo_mime" IS NULL AND "evidencia_tamanio" IS NULL AND "evidencia_hash" IS NULL) OR ("evidencia_clave" IS NOT NULL AND "evidencia_nombre" IS NOT NULL AND "evidencia_tipo_mime" IS NOT NULL AND "evidencia_tamanio" IS NOT NULL AND "evidencia_hash" IS NOT NULL)',
)
@Check('CK_acreditacion_fecha_no_futura', '"fecha_evaluacion" <= CURRENT_DATE')
@Index('IDX_acreditacion_persona_conocimiento', ['idPersona', 'idConocimiento'])
export class Acreditacion {
  @PrimaryGeneratedColumn({ name: 'id_acreditacion' })
  id: number;

  @Column({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @Column({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_acreditado', type: 'int' })
  idNivelAcreditado: number;

  @Column({ name: 'id_tipo_evidencia', type: 'int' })
  idTipoEvidencia: number;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ name: 'id_evaluador', type: 'int' })
  idEvaluador: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  // Evidencia en RustFS (todas nulas o todas con valor).
  @Column({ type: 'varchar', length: 500, nullable: true })
  evidenciaClave: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidenciaNombre: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  evidenciaTipoMime: string | null;

  @Column({ type: 'int', nullable: true })
  evidenciaTamanio: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  evidenciaHash: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registradaEn: Date;

  @ManyToOne(() => ConocimientoPersona, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    { name: 'id_persona', referencedColumnName: 'idPersona' },
    { name: 'id_conocimiento', referencedColumnName: 'idConocimiento' },
  ])
  conocimientoPersona: Relation<ConocimientoPersona>;

  @ManyToOne(() => NivelDominio, { nullable: false })
  @JoinColumn({ name: 'id_nivel_acreditado' })
  nivelAcreditado: Relation<NivelDominio>;

  @ManyToOne(() => TipoEvidencia, { nullable: false })
  @JoinColumn({ name: 'id_tipo_evidencia' })
  tipoEvidencia: Relation<TipoEvidencia>;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'id_evaluador' })
  evaluador: Relation<Persona>;
}
