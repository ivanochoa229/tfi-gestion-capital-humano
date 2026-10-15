import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { NivelDominio } from '../../referencia/entities/nivel-dominio.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/** Conocimiento que exige un puesto, con el nivel requerido (RF09). */
@Entity('requisito_puesto')
@Index('IDX_requisito_puesto_conocimiento', ['idConocimiento'])
export class RequisitoPuesto {
  @PrimaryColumn({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @Column({ name: 'id_nivel_requerido', type: 'int' })
  idNivelRequerido: number;

  @Column({ type: 'boolean' })
  esExcluyente: boolean;

  @ManyToOne(() => Puesto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;

  @ManyToOne(() => NivelDominio, { nullable: false })
  @JoinColumn({ name: 'id_nivel_requerido' })
  nivelRequerido: Relation<NivelDominio>;
}
