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
import { Conocimiento } from '../../conocimiento/entities/conocimiento.entity.js';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { NivelCriticidad } from '../../referencia/entities/nivel-criticidad.entity.js';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { NivelDificultad } from './nivel-dificultad.entity.js';
import { NivelImpacto } from './nivel-impacto.entity.js';

/**
 * Una evaluación de criticidad de un conocimiento en un puesto. Solo se
 * agregan filas: un error se corrige con una evaluación nueva. `idNivelCriticidad`
 * es la foto del resultado de la matriz al evaluar. Vigente: mayor
 * `fechaEvaluacion` y, en empate, mayor `id` (vista `criticidad_vigente`).
 * Se audita (RNF05): escribir siempre con `save()`.
 */
@Entity('evaluacion_criticidad')
@Check(
  'CK_evaluacion_criticidad_fecha_no_futura',
  '"fecha_evaluacion" <= CURRENT_DATE',
)
@Index('IDX_evaluacion_criticidad_par', [
  'idPuesto',
  'idConocimiento',
  'fechaEvaluacion',
])
export class EvaluacionCriticidad {
  @PrimaryGeneratedColumn({ name: 'id_evaluacion' })
  id: number;

  @Column({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @Column({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_impacto', type: 'int' })
  idNivelImpacto: number;

  @Column({ name: 'id_nivel_dificultad', type: 'int' })
  idNivelDificultad: number;

  @Column({ name: 'id_nivel_criticidad', type: 'int' })
  idNivelCriticidad: number;

  @Column({ type: 'date' })
  fechaEvaluacion: string;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  registradaEn: Date;

  @ManyToOne(() => Puesto, { nullable: false })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Conocimiento, { nullable: false })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelImpacto, { nullable: false })
  @JoinColumn({ name: 'id_nivel_impacto' })
  nivelImpacto: Relation<NivelImpacto>;

  @ManyToOne(() => NivelDificultad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_dificultad' })
  nivelDificultad: Relation<NivelDificultad>;

  @ManyToOne(() => NivelCriticidad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_criticidad' })
  nivelCriticidad: Relation<NivelCriticidad>;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;
}
