import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { Usuario } from './usuario.entity.js';

/** Unidades a cargo de una jefatura o jefe de cátedra (RF24). */
@Entity('usuario_unidad')
export class UsuarioUnidad {
  @PrimaryColumn({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  /** Unidad a cargo; ver la clave foránea hacia `unidad_organizativa`. */
  @PrimaryColumn({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => Usuario, (u) => u.unidades, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @ManyToOne(() => UnidadOrganizativa, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_unidad' })
  unidad: Relation<UnidadOrganizativa>;
}
