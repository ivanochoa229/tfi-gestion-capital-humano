import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { TipoDocumento } from '../../referencia/entities/tipo-documento.entity.js';

/**
 * Activo de conocimiento (RF11): un archivo guardado en RustFS o un enlace
 * externo. `ubicacion` es la clave del objeto en el bucket o la URL
 * (RNF08). El CHECK mantiene coherentes origen y metadatos, y el índice único
 * parcial impide dos archivos activos con el mismo contenido.
 */
@Entity('activo_conocimiento')
@Check(
  'CK_activo_origen_coherente',
  `("origen" = 'archivo' AND "nombre_original" IS NOT NULL AND "tipo_mime" IS NOT NULL AND "tamanio" IS NOT NULL AND "hash" IS NOT NULL) OR ("origen" = 'enlace' AND "nombre_original" IS NULL AND "tipo_mime" IS NULL AND "tamanio" IS NULL AND "hash" IS NULL)`,
)
@Index('UQ_activo_hash_activo', ['hash'], {
  unique: true,
  where: '"activo" AND "hash" IS NOT NULL',
})
export class ActivoConocimiento {
  @PrimaryGeneratedColumn({ name: 'id_activo' })
  id: number;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ name: 'id_tipo_documento', type: 'int' })
  idTipoDocumento: number;

  @ManyToOne(() => TipoDocumento, { nullable: false })
  @JoinColumn({ name: 'id_tipo_documento' })
  tipoDocumento: Relation<TipoDocumento>;

  /** Unidad que mantiene el activo. */
  @Column({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => UnidadOrganizativa, { nullable: false })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;

  /** `archivo` o `enlace`; no cambia después del alta. */
  @Column({ type: 'varchar', length: 10 })
  origen: 'archivo' | 'enlace';

  /** Clave del objeto en el bucket (archivo) o URL http(s) (enlace). */
  @Column({ type: 'varchar', length: 2000 })
  ubicacion: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nombreOriginal: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipoMime: string | null;

  @Column({ type: 'int', nullable: true })
  tamanio: number | null;

  /** SHA-256 hexadecimal del contenido. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  hash: string | null;

  @Column({ type: 'date', nullable: true })
  fechaVigencia: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizadoEn: Date;
}
