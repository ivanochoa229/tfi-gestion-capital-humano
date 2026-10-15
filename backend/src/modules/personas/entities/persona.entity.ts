import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { SituacionRevista } from '../../referencia/entities/situacion-revista.entity.js';

/**
 * Persona del departamento (RF06). Las fechas son `AAAA-MM-DD`. El índice por
 * `lower(apellido), lower(nombre)` se crea en la migración y no está declarado acá.
 */
@Entity('persona')
@Check('CK_persona_documento', `"documento" ~ '^[0-9]{7,8}$'`)
@Check(
  'CK_persona_ingreso_posterior_a_nacimiento',
  '"fecha_ingreso" > "fecha_nacimiento"',
)
@Check(
  'CK_persona_retiro_desde_ingreso',
  '"fecha_prevista_retiro" IS NULL OR "fecha_prevista_retiro" >= "fecha_ingreso"',
)
export class Persona {
  @PrimaryGeneratedColumn({ name: 'id_persona' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  legajo: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  /** DNI de 7 u 8 dígitos. Dato personal: solo lo ven RR. HH. y el administrador. */
  @Column({ type: 'varchar', length: 8, unique: true })
  documento: string;

  @Column({ type: 'date' })
  fechaNacimiento: string;

  @Column({ type: 'date' })
  fechaIngreso: string;

  @Column({ name: 'id_situacion_revista', type: 'int' })
  idSituacionRevista: number;

  @ManyToOne(() => SituacionRevista, { nullable: false })
  @JoinColumn({ name: 'id_situacion_revista' })
  situacionRevista: Relation<SituacionRevista>;

  @Column({ type: 'date', nullable: true })
  fechaPrevistaRetiro: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
