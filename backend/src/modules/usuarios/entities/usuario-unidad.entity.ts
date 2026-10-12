import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Usuario } from './usuario.entity.js';

/** Unidades a cargo de una jefatura o jefe de cátedra (RF24). */
@Entity('usuario_unidad')
export class UsuarioUnidad {
  @PrimaryColumn({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  /** Sin clave foránea hasta que exista `unidad_organizativa`. */
  @PrimaryColumn({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => Usuario, (u) => u.unidades, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;
}
