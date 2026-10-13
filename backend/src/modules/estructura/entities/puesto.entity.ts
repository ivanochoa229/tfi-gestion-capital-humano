import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { NivelJerarquico } from '../../referencia/entities/nivel-jerarquico.entity.js';
import { TipoRelacionContractual } from '../../referencia/entities/tipo-relacion-contractual.entity.js';
import { UnidadOrganizativa } from './unidad-organizativa.entity.js';

/**
 * Puesto de una unidad (RF02). Es específico de su cátedra y no cambia de
 * unidad. El índice único de denominación por unidad (con lower()) se crea en
 * la migración y no está declarado acá.
 */
@Entity('puesto')
@Check('CK_puesto_dotacion_prevista', '"dotacion_prevista" >= 1')
@Check('CK_puesto_superior_distinto', '"id_puesto_superior" <> "id_puesto"')
@Index('IDX_puesto_unidad', ['idUnidad'])
@Index('IDX_puesto_superior', ['idPuestoSuperior'])
export class Puesto {
  @PrimaryGeneratedColumn({ name: 'id_puesto' })
  id: number;

  /** `P-0001`; lo genera la aplicación con `puesto_codigo_seq`. */
  @Column({ type: 'varchar', length: 10, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ type: 'text', nullable: true })
  proposito: string | null;

  @Column({ type: 'text', nullable: true })
  condicionesTrabajo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rangoRetributivo: string | null;

  @Column({ type: 'int', default: 1 })
  dotacionPrevista: number;

  @Column({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => UnidadOrganizativa, { nullable: false })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;

  @Column({ name: 'id_nivel_jerarquico', type: 'int' })
  idNivelJerarquico: number;

  @ManyToOne(() => NivelJerarquico, { nullable: false })
  @JoinColumn({ name: 'id_nivel_jerarquico' })
  nivelJerarquico: Relation<NivelJerarquico>;

  @Column({ name: 'id_tipo_relacion_contractual', type: 'int', nullable: true })
  idTipoRelacionContractual: number | null;

  @ManyToOne(() => TipoRelacionContractual, { nullable: true })
  @JoinColumn({ name: 'id_tipo_relacion_contractual' })
  tipoRelacionContractual: Relation<TipoRelacionContractual> | null;

  @Column({ name: 'id_puesto_superior', type: 'int', nullable: true })
  idPuestoSuperior: number | null;

  @ManyToOne(() => Puesto, { nullable: true })
  @JoinColumn({ name: 'id_puesto_superior' })
  superior: Relation<Puesto> | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
