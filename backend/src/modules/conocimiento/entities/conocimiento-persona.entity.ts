import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { TipoEvidencia } from '../../referencia/entities/tipo-evidencia.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/**
 * Lo que una persona sabe de un conocimiento (RF10): el nivel que declara y
 * el reflejo de su acreditación vigente. El servicio es el único que escribe
 * los cuatro campos de acreditación, y siempre con el valor de la más reciente
 * de `acreditacion`. Las fechas son `AAAA-MM-DD`.
 */
@Entity('conocimiento_persona')
@Check(
  'CK_conocimiento_persona_algun_nivel',
  '"id_nivel_declarado" IS NOT NULL OR "id_nivel_acreditado" IS NOT NULL',
)
@Check(
  'CK_conocimiento_persona_declaracion_completa',
  '("id_nivel_declarado" IS NULL) = ("fecha_declaracion" IS NULL)',
)
@Check(
  'CK_conocimiento_persona_acreditacion_completa',
  '("id_nivel_acreditado" IS NULL) = ("fecha_evaluacion" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_tipo_evidencia" IS NULL) AND ("id_nivel_acreditado" IS NULL) = ("id_evaluador" IS NULL)',
)
@Index('IDX_conocimiento_persona_conocimiento', ['idConocimiento'])
export class ConocimientoPersona {
  @PrimaryColumn({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_declarado', type: 'int', nullable: true })
  idNivelDeclarado: number | null;

  @Column({ type: 'date', nullable: true })
  fechaDeclaracion: string | null;

  @Column({ name: 'id_nivel_acreditado', type: 'int', nullable: true })
  idNivelAcreditado: number | null;

  @Column({ type: 'date', nullable: true })
  fechaEvaluacion: string | null;

  @Column({ name: 'id_tipo_evidencia', type: 'int', nullable: true })
  idTipoEvidencia: number | null;

  @Column({ name: 'id_evaluador', type: 'int', nullable: true })
  idEvaluador: number | null;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelDominio, { nullable: true })
  @JoinColumn({ name: 'id_nivel_declarado' })
  nivelDeclarado: Relation<NivelDominio> | null;

  @ManyToOne(() => NivelDominio, { nullable: true })
  @JoinColumn({ name: 'id_nivel_acreditado' })
  nivelAcreditado: Relation<NivelDominio> | null;

  @ManyToOne(() => TipoEvidencia, { nullable: true })
  @JoinColumn({ name: 'id_tipo_evidencia' })
  tipoEvidencia: Relation<TipoEvidencia> | null;

  @ManyToOne(() => Persona, { nullable: true })
  @JoinColumn({ name: 'id_evaluador' })
  evaluador: Relation<Persona> | null;
}
