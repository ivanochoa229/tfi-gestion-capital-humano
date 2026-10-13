import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { TipoUnidad } from '../../referencia/entities/tipo-unidad.entity.js';

/**
 * Departamento o cátedra (RF01). Las carga el DBA por SQL; la aplicación solo
 * las consulta. Las reglas de jerarquía las hace cumplir un trigger.
 */
@Entity('unidad_organizativa')
export class UnidadOrganizativa {
  @PrimaryGeneratedColumn({ name: 'id_unidad' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ name: 'id_tipo_unidad', type: 'int' })
  idTipoUnidad: number;

  @ManyToOne(() => TipoUnidad, { nullable: false })
  @JoinColumn({ name: 'id_tipo_unidad' })
  tipo: Relation<TipoUnidad>;

  @Column({ name: 'id_unidad_superior', type: 'int', nullable: true })
  idUnidadSuperior: number | null;

  @ManyToOne(() => UnidadOrganizativa, { nullable: true })
  @JoinColumn({ name: 'id_unidad_superior' })
  superior: Relation<UnidadOrganizativa> | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
