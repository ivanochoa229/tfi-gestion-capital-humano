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
