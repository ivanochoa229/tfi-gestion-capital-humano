import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Rol } from './rol.entity.js';
import { UsuarioUnidad } from './usuario-unidad.entity.js';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  nombreUsuario: string;

  @Column({ type: 'varchar', length: 255 })
  claveHash: string;

  @ManyToOne(() => Rol, { nullable: false })
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  /** Sin clave foránea hasta que exista la tabla `persona`. */
  @Column({ name: 'id_persona', type: 'int', nullable: true, unique: true })
  idPersona: number | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @OneToMany(() => UsuarioUnidad, (uu) => uu.usuario, { cascade: true })
  unidades: UsuarioUnidad[];
}
