import type { DataSource } from 'typeorm';
import { ROLES } from '../common/roles.js';
import type { SesionUsuario } from '../common/sesion-usuario.js';
import type { StorageService } from '../infra/storage/storage.service.js';
import { ActivosService } from '../modules/conocimiento/activos.service.js';
import type { ReferenciaService } from '../modules/referencia/referencia.service.js';
import { AlcanceService } from '../modules/usuarios/alcance.service.js';
import { AlmacenFalso } from './almacen-falso.js';
import { crearBaseTemporal, type BaseTemporal } from './base-temporal.js';

export interface EntornoActivos {
  base: BaseTemporal;
  ds: DataSource;
  servicio: ActivosService;
  almacen: AlmacenFalso;
  /** Gancho opcional que corre dentro de `referencia.validarActivo`. */
  ganchos: { alValidarReferencia?: () => Promise<void> };
  sql<T>(consulta: string, parametros?: unknown[]): Promise<T>;
  ids: {
    tipoDocumento: number;
    departamento: number;
    catedraA: number;
    catedraB: number;
    conocimientoA: number;
    conocimientoB: number;
  };
  sesiones: {
    analista: SesionUsuario;
    jefeA: SesionUsuario;
    docente: SesionUsuario;
  };
  destruir(): Promise<void>;
}

/** PDF mínimo: lo que importa para el servicio es la firma `%PDF-` y que el texto cambie el hash. */
export const pdf = (texto: string, nombre = 'manual.pdf') => ({
  originalname: nombre,
  buffer: Buffer.from(`%PDF-1.7\n${texto}`),
});

export async function crearEntornoActivos(): Promise<EntornoActivos> {
  const base = await crearBaseTemporal();
  const ds = base.dataSource;
  const sql = <T>(consulta: string, parametros?: unknown[]) =>
    ds.query(consulta, parametros) as Promise<T>;
  const primero = async (consulta: string, parametros?: unknown[]) =>
    (await sql<{ id: number }[]>(consulta, parametros))[0].id;

  const unidad = (
    denominacion: string,
    tipo: string,
    superior: number | null,
  ) =>
    primero(
      `INSERT INTO unidad_organizativa (denominacion, id_tipo_unidad, id_unidad_superior)
       SELECT $1, id_tipo_unidad, $3 FROM tipo_unidad WHERE codigo = $2
       RETURNING id_unidad AS id`,
      [denominacion, tipo, superior],
    );
  const conocimiento = (denominacion: string, normalizada: string) =>
    primero(
      `INSERT INTO conocimiento (denominacion, denominacion_normalizada, id_tipo_conocimiento, id_area_tematica)
       SELECT $1, $2, t.id_tipo_conocimiento, (SELECT min(id_area_tematica) FROM area_tematica)
       FROM tipo_conocimiento t WHERE t.codigo = 'competencia_tecnica'
       RETURNING id_conocimiento AS id`,
      [denominacion, normalizada],
    );

  // El departamento raíz ya lo siembra la migración CrearUnidadesYPuestos.
  const departamento = await primero(
    `SELECT u.id_unidad AS id FROM unidad_organizativa u
     JOIN tipo_unidad t ON t.id_tipo_unidad = u.id_tipo_unidad
     WHERE u.id_unidad_superior IS NULL AND t.codigo = 'departamento'
     ORDER BY u.id_unidad LIMIT 1`,
  );
  const catedraA = await unidad('Cátedra A', 'catedra', departamento);
  const catedraB = await unidad('Cátedra B', 'catedra', departamento);
  const ids = {
    tipoDocumento: await primero(
      `SELECT id_tipo_documento AS id FROM tipo_documento WHERE codigo = 'manual'`,
    ),
    departamento,
    catedraA,
    catedraB,
    conocimientoA: await conocimiento('SQL', 'sql'),
    conocimientoB: await conocimiento('Redes', 'redes'),
  };

  const almacen = new AlmacenFalso();
  const ganchos: EntornoActivos['ganchos'] = {};
  const referencia = {
    validarActivo: async () => {
      await ganchos.alValidarReferencia?.();
    },
  } as unknown as ReferenciaService;
  const servicio = new ActivosService(
    ds,
    referencia,
    almacen as unknown as StorageService,
    new AlcanceService(ds),
  );

  const sesion = (
    id: number,
    rol: SesionUsuario['rol'],
    unidades: number[],
  ): SesionUsuario => ({
    id,
    nombreUsuario: `usuario${id}`,
    rol,
    idPersona: null,
    unidades,
  });

  return {
    base,
    ds,
    servicio,
    almacen,
    ganchos,
    sql,
    ids,
    sesiones: {
      analista: sesion(1, ROLES.analistaPuestos, []),
      jefeA: sesion(2, ROLES.jefeCatedra, [catedraA]),
      docente: sesion(3, ROLES.docente, []),
    },
    destruir: () => base.destruir(),
  };
}
