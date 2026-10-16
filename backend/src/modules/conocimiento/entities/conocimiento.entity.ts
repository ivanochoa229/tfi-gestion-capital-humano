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
import { AreaTematica } from '../../referencia/entities/area-tematica.entity.js';
import { TipoConocimiento } from '../../referencia/entities/tipo-conocimiento.entity.js';

/**
 * Catálogo único de conocimientos (RF08). `denominacionNormalizada` la calcula
 * la aplicación (`normalizarDenominacion`); el índice único parcial impide dos
 * conocimientos activos con la misma clave y el mismo tipo.
 */
@Entity('conocimiento')
@Check(
  'CK_conocimiento_fusion_distinta',
  '"id_fusionado_en" IS NULL OR "id_fusionado_en" <> "id_conocimiento"',
)
@Index(
  'UQ_conocimiento_tipo_denominacion_activo',
  ['idTipoConocimiento', 'denominacionNormalizada'],
  { unique: true, where: '"activo"' },
)
export class Conocimiento {
  @PrimaryGeneratedColumn({ name: 'id_conocimiento' })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  denominacion: string;

  @Column({ type: 'varchar', length: 150 })
  denominacionNormalizada: string;

  @Column({ name: 'id_tipo_conocimiento', type: 'int' })
  idTipoConocimiento: number;

  @ManyToOne(() => TipoConocimiento, { nullable: false })
  @JoinColumn({ name: 'id_tipo_conocimiento' })
  tipoConocimiento: Relation<TipoConocimiento>;

  @Column({ name: 'id_area_tematica', type: 'int' })
  idAreaTematica: number;

  @ManyToOne(() => AreaTematica, { nullable: false })
  @JoinColumn({ name: 'id_area_tematica' })
  areaTematica: Relation<AreaTematica>;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  /** Conocimiento al que se fusionó este, si se retiró por duplicado. */
  @Column({ name: 'id_fusionado_en', type: 'int', nullable: true })
  idFusionadoEn: number | null;

  @ManyToOne(() => Conocimiento, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_fusionado_en' })
  fusionadoEn: Relation<Conocimiento> | null;
}
