import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ValorReferenciaOrdinal } from '../../referencia/entities/valor-referencia.base.js';

/**
 * Escala fija de dificultad de reemplazo (fácil, moderada, difícil). Mismas
 * razones que `NivelImpacto` para no ser un dominio administrable.
 */
@Entity('nivel_dificultad')
export class NivelDificultad extends ValorReferenciaOrdinal {
  @PrimaryGeneratedColumn({ name: 'id_nivel_dificultad' })
  id: number;

  @Column({ type: 'text' })
  criterio: string;
}
