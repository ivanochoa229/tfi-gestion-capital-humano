import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { NivelCriticidad } from '../../referencia/entities/nivel-criticidad.entity.js';
import { NivelDificultad } from './nivel-dificultad.entity.js';
import { NivelImpacto } from './nivel-impacto.entity.js';

/**
 * Nivel de criticidad para cada combinación de impacto y dificultad. Siempre
 * tiene las nueve celdas: solo se edita `idNivelCriticidad`, nunca se agregan
 * ni se borran filas.
 */
@Entity('matriz_criticidad')
export class MatrizCriticidad {
  @PrimaryColumn({ name: 'id_nivel_impacto', type: 'int' })
  idNivelImpacto: number;

  @PrimaryColumn({ name: 'id_nivel_dificultad', type: 'int' })
  idNivelDificultad: number;

  @Column({ name: 'id_nivel_criticidad', type: 'int' })
  idNivelCriticidad: number;

  @ManyToOne(() => NivelImpacto, { nullable: false })
  @JoinColumn({ name: 'id_nivel_impacto' })
  nivelImpacto: Relation<NivelImpacto>;

  @ManyToOne(() => NivelDificultad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_dificultad' })
  nivelDificultad: Relation<NivelDificultad>;

  @ManyToOne(() => NivelCriticidad, { nullable: false })
  @JoinColumn({ name: 'id_nivel_criticidad' })
  nivelCriticidad: Relation<NivelCriticidad>;
}
