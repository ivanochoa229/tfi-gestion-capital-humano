import { Column } from 'typeorm';

/** Columnas comunes a todas las tablas de referencia de dominio cerrado. */
export abstract class ValorReferencia {
  abstract id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  denominacion: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}

/** Variante de las escalas ordinales: el `orden` define cuál valor es mayor. */
export abstract class ValorReferenciaOrdinal extends ValorReferencia {
  @Column({ type: 'int', unique: true })
  orden: number;
}
