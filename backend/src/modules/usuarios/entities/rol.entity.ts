import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Rol fijo cargado por migración; solo lectura. */
@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 100 })
  denominacion: string;
}
