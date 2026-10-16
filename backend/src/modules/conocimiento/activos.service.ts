import type { Readable } from 'node:stream';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import {
  ROLES_ESCRITORES_DE_ACTIVOS,
  ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import {
  aActivoDto,
  SQL_SELECT_ACTIVO,
  type FilaActivo,
} from './activos.sql.js';
import {
  claveObjeto,
  decodificarNombre,
  detectarTipo,
  hashSha256,
  limpiarNombre,
} from './archivo.js';
import { DOMINIO_TIPO_DOCUMENTO } from './conocimiento.constantes.js';
import type {
  ActualizarActivoDto,
  ActivoDto,
  CrearActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';

/** Lo que Multer deja en `req.file` (en memoria) y que el servicio necesita. */
export interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

interface ArchivoPreparado {
  nombre: string;
  tipoMime: string;
  tamanio: number;
  hash: string;
}

const INDICE_HASH = 'UQ_activo_hash_activo';
const TIPOS_PERMITIDOS_MENSAJE = 'PDF, DOCX, XLSX, PPTX, ODT, TXT, PNG y JPG';

export interface DescargaActivo {
  flujo: Readable;
  nombre: string;
  tipoMime: string;
  tamanio: number;
}

/**
 * Activos de conocimiento (RF11). Usa SQL directo: las consultas combinan la
 * tabla puente y fechas de la base. Los archivos viven en RustFS (RNF08).
 */
@Injectable()
export class ActivosService {
  private readonly logger = new Logger(ActivosService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly referencia: ReferenciaService,
    private readonly almacenamiento: StorageService,
    private readonly alcance: AlcanceService,
  ) {}

  protected esEscritor(sesion: SesionUsuario): boolean {
    return ROLES_ESCRITORES_DE_ACTIVOS.includes(sesion.rol);
  }

  async listar(
    sesion: SesionUsuario,
    filtro: FiltroActivosDto,
  ): Promise<PaginaActivosDto> {
    const parametros: unknown[] = [];
    const param = (valor: unknown) => {
      parametros.push(valor);
      return `$${parametros.length}`;
    };
    const donde: string[] = [];
    if (!(filtro.incluirBajas && this.esEscritor(sesion)))
      donde.push('a.activo');
    if (filtro.q) {
      donde.push(`a.titulo ILIKE ${param(`%${escaparLike(filtro.q)}%`)}`);
    }
    if (filtro.idConocimiento !== undefined) {
      donde.push(
        `EXISTS (SELECT 1 FROM activo_conocimiento_conocimiento v
                 WHERE v.id_activo = a.id_activo AND v.id_conocimiento = ${param(filtro.idConocimiento)})`,
      );
    }
    if (filtro.idUnidad !== undefined) {
      donde.push(`a.id_unidad = ${param(filtro.idUnidad)}`);
    }
    if (filtro.idTipoDocumento !== undefined) {
      donde.push(`a.id_tipo_documento = ${param(filtro.idTipoDocumento)}`);
    }
    if (filtro.vencido === true) donde.push('a.fecha_vigencia < CURRENT_DATE');
    if (filtro.vencido === false) {
      donde.push(
        '(a.fecha_vigencia IS NULL OR a.fecha_vigencia >= CURRENT_DATE)',
      );
    }
    const clausula = donde.length ? `WHERE ${donde.join(' AND ')}` : '';

    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM activo_conocimiento a ${clausula}`,
      parametros,
    );
    const filas: FilaActivo[] = await this.dataSource.query(
      `${SQL_SELECT_ACTIVO} ${clausula}
       ORDER BY a.titulo ASC, a.id_activo ASC
       LIMIT ${param(filtro.tamanio)} OFFSET ${param((filtro.pagina - 1) * filtro.tamanio)}`,
      parametros,
    );
    return { items: filas.map(aActivoDto), total };
  }

  async obtener(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    return aActivoDto(await this.exigirVisible(sesion, id));
  }

  async descargar(sesion: SesionUsuario, id: number): Promise<DescargaActivo> {
    const fila = await this.exigirVisible(sesion, id);
    if (fila.origen === 'enlace') {
      throw new ConflictException(
        'El activo es un enlace: no tiene archivo para descargar',
      );
    }
    try {
      const flujo = await this.almacenamiento.obtener(fila.ubicacion);
      return {
        flujo,
        nombre: fila.nombreOriginal ?? 'activo',
        tipoMime: fila.tipoMime ?? 'application/octet-stream',
        tamanio: fila.tamanio ?? 0,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        throw new NotFoundException('El archivo no está en el almacenamiento');
      }
      throw error;
    }
  }

  async crear(
    sesion: SesionUsuario,
    dto: CrearActivoDto,
    archivo?: ArchivoSubido,
  ): Promise<ActivoDto> {
    await this.exigirEscritura(sesion, dto.idUnidad);
    if (archivo && dto.enlace) {
      throw new BadRequestException(
        'Un activo es un archivo o un enlace, no ambos',
      );
    }
    if (!archivo && !dto.enlace) {
      throw new BadRequestException('Subí un archivo o indicá un enlace');
    }
    await this.validarTipoDocumento(dto.idTipoDocumento);
    await this.validarUnidad(dto.idUnidad);
    const ids = await this.validarConocimientos(dto.idsConocimiento);
    const preparado = archivo ? this.prepararArchivo(archivo) : null;
    if (preparado) await this.exigirSinDuplicado(preparado.hash);

    // Se reserva el id para armar la clave antes de insertar.
    const [{ id }]: { id: number }[] = await this.dataSource.query(
      `SELECT nextval(pg_get_serial_sequence('activo_conocimiento', 'id_activo'))::int AS id`,
    );
    const clave =
      preparado && archivo ? claveObjeto(id, preparado.nombre) : null;
    if (clave && preparado && archivo) {
      await this.almacenamiento.subir(
        clave,
        archivo.buffer,
        preparado.tipoMime,
      );
    }
    try {
      await this.enTransaccion(async (manager) => {
        await manager.query(
          `INSERT INTO activo_conocimiento
             (id_activo, titulo, id_tipo_documento, id_unidad, origen, ubicacion,
              nombre_original, tipo_mime, tamanio, hash, fecha_vigencia)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            dto.titulo,
            dto.idTipoDocumento,
            dto.idUnidad,
            preparado ? 'archivo' : 'enlace',
            clave ?? dto.enlace,
            preparado?.nombre ?? null,
            preparado?.tipoMime ?? null,
            preparado?.tamanio ?? null,
            preparado?.hash ?? null,
            dto.fechaVigencia ?? null,
          ],
        );
        await this.guardarVinculos(manager, id, ids);
      });
    } catch (error) {
      if (clave) await this.borrarObjeto(clave);
      throw error;
    }
    return this.obtener(sesion, id);
  }

  async actualizar(
    sesion: SesionUsuario,
    id: number,
    dto: ActualizarActivoDto,
  ): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (!actual.activo) throw this.estaDeBaja();
    for (const campo of [
      'titulo',
      'idTipoDocumento',
      'idUnidad',
      'idsConocimiento',
    ] as const) {
      if (dto[campo] === null) {
        throw new BadRequestException(`El campo ${campo} no admite null`);
      }
    }
    if (dto.idUnidad !== undefined && dto.idUnidad !== actual.idUnidad) {
      await this.exigirEscritura(sesion, dto.idUnidad);
      await this.validarUnidad(dto.idUnidad);
    }
    if (dto.enlace !== undefined && actual.origen !== 'enlace') {
      throw new BadRequestException(
        'Solo los activos de tipo enlace tienen una URL editable',
      );
    }
    if (
      dto.idTipoDocumento !== undefined &&
      dto.idTipoDocumento !== actual.idTipoDocumento
    ) {
      await this.validarTipoDocumento(dto.idTipoDocumento);
    }
    const ids =
      dto.idsConocimiento !== undefined
        ? await this.validarConocimientos(dto.idsConocimiento)
        : null;

    await this.enTransaccion(async (manager) => {
      const fila = await this.bloquearActivo(manager, id);
      if (!fila.activo) throw this.estaDeBaja();
      await this.exigirEscritura(sesion, fila.idUnidad);
      if (dto.enlace !== undefined && fila.origen !== 'enlace') {
        throw new BadRequestException(
          'Solo los activos de tipo enlace tienen una URL editable',
        );
      }
      await manager.query(
        `UPDATE activo_conocimiento
         SET titulo = $2, id_tipo_documento = $3, id_unidad = $4,
             fecha_vigencia = $5, ubicacion = $6, actualizado_en = now()
         WHERE id_activo = $1`,
        [
          id,
          dto.titulo ?? fila.titulo,
          dto.idTipoDocumento ?? fila.idTipoDocumento,
          dto.idUnidad ?? fila.idUnidad,
          dto.fechaVigencia === undefined
            ? fila.fechaVigencia
            : dto.fechaVigencia,
          fila.origen === 'enlace'
            ? (dto.enlace ?? fila.ubicacion)
            : fila.ubicacion,
        ],
      );
      if (ids) await this.guardarVinculos(manager, id, ids);
    });
    return this.obtener(sesion, id);
  }

  async reemplazarArchivo(
    sesion: SesionUsuario,
    id: number,
    archivo: ArchivoSubido,
  ): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (!actual.activo) throw this.estaDeBaja();
    if (actual.origen !== 'archivo') {
      throw new BadRequestException(
        'Un activo de tipo enlace no tiene archivo para reemplazar',
      );
    }
    const preparado = this.prepararArchivo(archivo);
    if (preparado.hash === actual.hash) {
      throw new ConflictException('El archivo es idéntico al actual');
    }
    await this.exigirSinDuplicado(preparado.hash, id);

    const clave = claveObjeto(id, preparado.nombre);
    await this.almacenamiento.subir(clave, archivo.buffer, preparado.tipoMime);
    let anterior: string;
    try {
      anterior = await this.enTransaccion(async (manager) => {
        const fila = await this.bloquearActivo(manager, id);
        if (!fila.activo) throw this.estaDeBaja();
        await this.exigirEscritura(sesion, fila.idUnidad);
        if (fila.origen !== 'archivo') {
          throw new BadRequestException(
            'Un activo de tipo enlace no tiene archivo para reemplazar',
          );
        }
        if (preparado.hash === fila.hash) {
          throw new ConflictException('El archivo es idéntico al actual');
        }
        await manager.query(
          `UPDATE activo_conocimiento
           SET ubicacion = $2, nombre_original = $3, tipo_mime = $4,
               tamanio = $5, hash = $6, actualizado_en = now()
           WHERE id_activo = $1`,
          [
            id,
            clave,
            preparado.nombre,
            preparado.tipoMime,
            preparado.tamanio,
            preparado.hash,
          ],
        );
        return fila.ubicacion;
      });
    } catch (error) {
      await this.borrarObjeto(clave);
      throw error;
    }
    await this.borrarObjeto(anterior);
    return this.obtener(sesion, id);
  }

  async darDeBaja(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    await this.enTransaccion(async (manager) => {
      const fila = await this.bloquearActivo(manager, id);
      if (!fila.activo) throw this.estaDeBaja();
      await this.exigirEscritura(sesion, fila.idUnidad);
      await manager.query(
        `UPDATE activo_conocimiento SET activo = false, actualizado_en = now() WHERE id_activo = $1`,
        [id],
      );
    });
    return this.obtener(sesion, id);
  }

  async reactivar(sesion: SesionUsuario, id: number): Promise<ActivoDto> {
    const actual = await this.exigirExistente(id);
    await this.exigirEscritura(sesion, actual.idUnidad);
    if (actual.activo) {
      throw new ConflictException('El activo ya está activo');
    }
    if (actual.hash) await this.exigirSinDuplicado(actual.hash, id);
    await this.enTransaccion(async (manager) => {
      const fila = await this.bloquearActivo(manager, id);
      if (fila.activo) throw new ConflictException('El activo ya está activo');
      await this.exigirEscritura(sesion, fila.idUnidad);
      await manager.query(
        `UPDATE activo_conocimiento SET activo = true, actualizado_en = now() WHERE id_activo = $1`,
        [id],
      );
    });
    return this.obtener(sesion, id);
  }

  /** Para el resto de los roles, una baja es como si no existiera. */
  protected async exigirVisible(
    sesion: SesionUsuario,
    id: number,
  ): Promise<FilaActivo> {
    const fila = await this.buscar(id);
    if (!fila || (!fila.activo && !this.esEscritor(sesion))) {
      throw new NotFoundException('El activo no existe');
    }
    return fila;
  }

  protected async buscar(id: number): Promise<FilaActivo | undefined> {
    const filas: FilaActivo[] = await this.dataSource.query(
      `${SQL_SELECT_ACTIVO} WHERE a.id_activo = $1`,
      [id],
    );
    return filas[0];
  }

  private estaDeBaja(): ConflictException {
    return new ConflictException(
      'El activo está dado de baja: reactivalo antes de modificarlo',
    );
  }

  private async exigirExistente(id: number): Promise<FilaActivo> {
    const fila = await this.buscar(id);
    if (!fila) throw new NotFoundException('El activo no existe');
    return fila;
  }

  /** Analista y administrador escriben en cualquier unidad; las jefaturas, solo en su alcance. */
  private async exigirEscritura(
    sesion: SesionUsuario,
    idUnidad: number,
  ): Promise<void> {
    if (ROLES_ESCRITORES_GLOBALES_DE_ACTIVOS.includes(sesion.rol)) return;
    if (this.esEscritor(sesion)) {
      await this.alcance.exigirUnidad(sesion, idUnidad);
      return;
    }
    throw new ForbiddenException(
      'No tenés permiso para modificar activos de conocimiento',
    );
  }

  private async validarTipoDocumento(id: number): Promise<void> {
    await this.referencia.validarActivo(DOMINIO_TIPO_DOCUMENTO, id);
  }

  private async validarUnidad(id: number): Promise<void> {
    const filas: { activo: boolean }[] = await this.dataSource.query(
      `SELECT activo FROM unidad_organizativa WHERE id_unidad = $1`,
      [id],
    );
    if (!filas[0]) throw new BadRequestException(`La unidad ${id} no existe`);
    if (!filas[0].activo) {
      throw new BadRequestException('La unidad está dada de baja');
    }
  }

  /** Devuelve los ids sin repetir; todos deben existir y estar activos. */
  private async validarConocimientos(ids: number[]): Promise<number[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) {
      throw new BadRequestException('Vinculá al menos un conocimiento');
    }
    const activos: { id: number }[] = await this.dataSource.query(
      `SELECT id_conocimiento AS id FROM conocimiento WHERE id_conocimiento = ANY($1) AND activo`,
      [unicos],
    );
    if (activos.length !== unicos.length) {
      const validos = new Set(activos.map((f) => Number(f.id)));
      const faltan = unicos.filter((i) => !validos.has(i));
      throw new BadRequestException(
        `Conocimientos inexistentes o dados de baja: ${faltan.join(', ')}`,
      );
    }
    return unicos;
  }

  private prepararArchivo(archivo: ArchivoSubido): ArchivoPreparado {
    const nombre = limpiarNombre(decodificarNombre(archivo.originalname));
    const tipo = detectarTipo(archivo.buffer, nombre);
    if (!tipo) {
      throw new UnsupportedMediaTypeException(
        `El archivo no es de un tipo permitido (${TIPOS_PERMITIDOS_MENSAJE}) o su contenido no coincide con su extensión`,
      );
    }
    return {
      nombre,
      tipoMime: tipo.mime,
      tamanio: archivo.buffer.length,
      hash: hashSha256(archivo.buffer),
    };
  }

  /** Mensaje que nombra al activo existente; la base lo respalda con el índice único parcial. */
  private async exigirSinDuplicado(hash: string, excluirId = 0): Promise<void> {
    const filas: { id: number; titulo: string }[] = await this.dataSource.query(
      `SELECT id_activo AS id, titulo FROM activo_conocimiento
       WHERE hash = $1 AND activo AND id_activo <> $2 LIMIT 1`,
      [hash, excluirId],
    );
    if (filas[0]) {
      throw new ConflictException(
        `Ya existe el activo «${filas[0].titulo}» (id ${filas[0].id}) con el mismo archivo`,
      );
    }
  }

  private async guardarVinculos(
    manager: EntityManager,
    id: number,
    ids: number[],
  ): Promise<void> {
    await manager.query(
      `DELETE FROM activo_conocimiento_conocimiento WHERE id_activo = $1`,
      [id],
    );
    await manager.query(
      `INSERT INTO activo_conocimiento_conocimiento (id_activo, id_conocimiento)
       SELECT $1, unnest($2::int[])`,
      [id, ids],
    );
  }

  /** Toma la fila para escribir; las operaciones concurrentes sobre un mismo activo quedan en fila. */
  private async bloquearActivo(
    manager: EntityManager,
    id: number,
  ): Promise<FilaActivo> {
    const filas: FilaActivo[] = await manager.query(
      `${SQL_SELECT_ACTIVO} WHERE a.id_activo = $1 FOR UPDATE OF a`,
      [id],
    );
    if (!filas[0]) throw new NotFoundException('El activo no existe');
    return filas[0];
  }

  private async enTransaccion<T>(
    trabajo: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(trabajo);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; constraint?: string }).code ===
          '23505' &&
        (error.driverError as { constraint?: string }).constraint ===
          INDICE_HASH
      ) {
        throw new ConflictException(
          'Otro activo ya tiene exactamente ese archivo',
        );
      }
      throw error;
    }
  }

  /** Borra sin propagar: un objeto que sobra no debe ocultar el resultado de la operación. */
  private async borrarObjeto(clave: string): Promise<void> {
    try {
      await this.almacenamiento.eliminar(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el objeto "${clave}": ${(error as Error).message}`,
      );
    }
  }
}
