import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ActivoConocimiento } from './activo-conocimiento.entity.js';
import { Conocimiento } from './conocimiento.entity.js';

/** Conocimientos que documenta un activo (tabla puente). */
@Entity('activo_conocimiento_conocimiento')
@Index('IDX_activo_conocimiento_conocimiento', ['idConocimiento'])
export class VinculoActivoConocimiento {
  @PrimaryColumn({ name: 'id_activo', type: 'int' })
  idActivo: number;

  @PrimaryColumn({ name: 'id_conocimiento', type: 'int' })
  idConocimiento: number;

  @ManyToOne(() => ActivoConocimiento, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_activo' })
  activo: Relation<ActivoConocimiento>;

  @ManyToOne(() => Conocimiento, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_conocimiento' })
  conocimiento: Relation<Conocimiento>;
}
