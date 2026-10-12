import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Administra las sesiones guardadas en la tabla `sesion` (connect-pg-simple). */
@Injectable()
export class SesionesService {
  constructor(private readonly dataSource: DataSource) {}

  /** Cierra las sesiones de un usuario, salvo la indicada (la que hace el pedido). */
  async cerrarDe(idUsuario: number, excepto?: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "sesion" WHERE "sess"->'passport'->>'user' = $1 AND ($2::text IS NULL OR "sid" <> $2)`,
      [String(idUsuario), excepto ?? null],
    );
  }
}
