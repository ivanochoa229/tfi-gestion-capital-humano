import type { Readable } from 'node:stream';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import { ROLES_ESCRITORES_DE_ACTIVOS } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import {
  aActivoDto,
  SQL_SELECT_ACTIVO,
  type FilaActivo,
} from './activos.sql.js';
import type {
  ActivoDto,
  FiltroActivosDto,
  PaginaActivosDto,
} from './dto/activos.dto.js';

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
}
