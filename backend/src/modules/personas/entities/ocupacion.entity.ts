import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { CaracterOcupacion } from '../../referencia/entities/caracter-ocupacion.entity.js';
import { Dedicacion } from '../../referencia/entities/dedicacion.entity.js';
import { Persona } from './persona.entity.js';

/**
 * Vínculo persona-puesto con vigencia (RF07). La restricción de exclusión
 * `EX_ocupacion_sin_solape` (misma persona, mismo puesto, rangos que se
 * solapan) se crea en la migración. Las fechas son `AAAA-MM-DD`; `fechaHasta`
 * nula significa sin fin.
 */
@Entity('ocupacion')
@Check(
  'CK_ocupacion_fechas',
  '"fecha_hasta" IS NULL OR "fecha_hasta" >= "fecha_desde"',
)
@Exclusion(
  'EX_ocupacion_sin_solape',
  `USING gist ("id_persona" WITH =, "id_puesto" WITH =, daterange("fecha_desde", "fecha_hasta", '[]') WITH &&)`,
)
@Index('IDX_ocupacion_puesto', ['idPuesto'])
export class Ocupacion {
  @PrimaryColumn({ name: 'id_persona', type: 'int' })
  idPersona: number;

  @PrimaryColumn({ name: 'id_puesto', type: 'int' })
  idPuesto: number;

  @PrimaryColumn({ type: 'date' })
  fechaDesde: string;

  @Column({ type: 'date', nullable: true })
  fechaHasta: string | null;

  @Column({ name: 'id_caracter_ocupacion', type: 'int' })
  idCaracterOcupacion: number;

  @Column({ name: 'id_dedicacion', type: 'int' })
  idDedicacion: number;

  @ManyToOne(() => Persona, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona>;

  @ManyToOne(() => Puesto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_puesto' })
  puesto: Relation<Puesto>;

  @ManyToOne(() => CaracterOcupacion, { nullable: false })
  @JoinColumn({ name: 'id_caracter_ocupacion' })
  caracterOcupacion: Relation<CaracterOcupacion>;

  @ManyToOne(() => Dedicacion, { nullable: false })
  @JoinColumn({ name: 'id_dedicacion' })
  dedicacion: Relation<Dedicacion>;
}
