import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from '../../referencia/entities/valor-referencia.base.js';

/**
 * Escala fija de impacto de pérdida (bajo, medio, alto). No es un dominio de
 * RF23: agregar o quitar un nivel dejaría incompleta la matriz. Se carga por
 * migración, con el criterio observable de cada nivel.
 */
@Entity('nivel_impacto')
export class NivelImpacto extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_impacto' })
  id: number;

  @Column({ type: 'text' })
  criterio: string;
}
