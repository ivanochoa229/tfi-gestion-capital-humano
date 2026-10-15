import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Rol } from './rol.entity.js';
import { UsuarioUnidad } from './usuario-unidad.entity.js';
import { Persona } from '../../personas/entities/persona.entity.js';

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

  /** Persona vinculada; obligatoria para el rol docente (ver `UsuariosService`). */
  @Column({ name: 'id_persona', type: 'int', nullable: true, unique: true })
  idPersona: number | null;

  @ManyToOne(() => Persona, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona' })
  persona: Relation<Persona> | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @OneToMany(() => UsuarioUnidad, (uu) => uu.usuario, { cascade: true })
  unidades: UsuarioUnidad[];
}
