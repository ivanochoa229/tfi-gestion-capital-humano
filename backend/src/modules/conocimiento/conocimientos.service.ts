import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, type Repository } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import {
  DOMINIO_AREA_TEMATICA,
  DOMINIO_TIPO_CONOCIMIENTO,
} from './conocimiento.constantes.js';
import { aConocimientoDto } from './conocimiento.mapper.js';
import type {
  ActualizarConocimientoDto,
  ConocimientoDto,
  CrearConocimientoDto,
  FiltroConocimientosDto,
  FusionarConocimientoDto,
  ResultadoFusionDto,
} from './dto/catalogo.dto.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import {
  PASOS_FUSION,
  SQL_CONTAR_PERSONAS,
  SQL_CONTAR_REQUISITOS,
} from './fusion.sql.js';
import { normalizarDenominacion } from './normalizar.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

/** Máximo de puestos que se nombran en el mensaje de una baja bloqueada. */
const MAX_PUESTOS_EN_MENSAJE = 10;

/** Catálogo único de conocimientos (RF08). Las escrituras corren con el bloqueo de conocimiento. */
@Injectable()
export class ConocimientosService {
  constructor(
    @InjectRepository(Conocimiento)
    private readonly conocimientos: Repository<Conocimiento>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(filtro: FiltroConocimientosDto): Promise<ConocimientoDto[]> {
    const q = filtro.q ? normalizarDenominacion(filtro.q) : '';
    const filas = await this.conocimientos.find({
      where: {
        ...(filtro.idTipo !== undefined
          ? { idTipoConocimiento: filtro.idTipo }
          : {}),
        ...(filtro.idArea !== undefined
          ? { idAreaTematica: filtro.idArea }
          : {}),
        ...(filtro.activo !== undefined ? { activo: filtro.activo } : {}),
        ...(q ? { denominacionNormalizada: ILike(`%${escaparLike(q)}%`) } : {}),
      },
      order: { denominacion: 'ASC' },
    });
    return filas.map(aConocimientoDto);
  }

  async crear(dto: CrearConocimientoDto): Promise<ConocimientoDto> {
    await this.validarDominios(dto.idTipoConocimiento, dto.idAreaTematica);
    const normalizada = normalizarDenominacion(dto.denominacion);
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      await this.exigirSinDuplicado(repo, dto.idTipoConocimiento, normalizada);
      const creado = await repo.save(
        repo.create({
          denominacion: dto.denominacion,
          denominacionNormalizada: normalizada,
          idTipoConocimiento: dto.idTipoConocimiento,
          idAreaTematica: dto.idAreaTematica,
          descripcion: dto.descripcion ?? null,
        }),
      );
      return aConocimientoDto(creado);
    });
  }

  async actualizar(
    id: number,
    dto: ActualizarConocimientoDto,
  ): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (!actual.activo) {
        throw new ConflictException(
          'El conocimiento está dado de baja: reactivalo antes de editarlo',
        );
      }
      if (
        (dto.idTipoConocimiento !== undefined &&
          dto.idTipoConocimiento !== actual.idTipoConocimiento) ||
        (dto.idAreaTematica !== undefined &&
          dto.idAreaTematica !== actual.idAreaTematica)
      ) {
        await this.validarDominios(
          dto.idTipoConocimiento ?? actual.idTipoConocimiento,
          dto.idAreaTematica ?? actual.idAreaTematica,
        );
      }
      const denominacion = dto.denominacion ?? actual.denominacion;
      const idTipo = dto.idTipoConocimiento ?? actual.idTipoConocimiento;
      const normalizada = normalizarDenominacion(denominacion);
      await this.exigirSinDuplicado(repo, idTipo, normalizada, id);
      const guardado = await repo.save({
        ...actual,
        denominacion,
        denominacionNormalizada: normalizada,
        idTipoConocimiento: idTipo,
        idAreaTematica: dto.idAreaTematica ?? actual.idAreaTematica,
        descripcion:
          dto.descripcion === undefined ? actual.descripcion : dto.descripcion,
      });
      return aConocimientoDto(guardado);
    });
  }

  async baja(id: number): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (!actual.activo) return aConocimientoDto(actual);
      const usos = await manager.query<{ codigo: string }[]>(
        `SELECT p.codigo FROM requisito_puesto r
         JOIN puesto p ON p.id_puesto = r.id_puesto
         WHERE r.id_conocimiento = $1 AND p.activo
         ORDER BY p.codigo`,
        [id],
      );
      if (usos.length > 0) {
        const nombres = usos
          .slice(0, MAX_PUESTOS_EN_MENSAJE)
          .map((u) => u.codigo);
        const resto = usos.length - nombres.length;
        throw new ConflictException(
          `No se puede dar de baja "${actual.denominacion}": lo piden los puestos ${nombres.join(', ')}${resto > 0 ? ` y ${resto} más` : ''}`,
        );
      }
      return aConocimientoDto(await repo.save({ ...actual, activo: false }));
    });
  }

  async reactivar(id: number): Promise<ConocimientoDto> {
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const actual = await this.exigir(repo, id);
      if (actual.activo) return aConocimientoDto(actual);
      await this.validarDominios(
        actual.idTipoConocimiento,
        actual.idAreaTematica,
      );
      await this.exigirSinDuplicado(
        repo,
        actual.idTipoConocimiento,
        actual.denominacionNormalizada,
        id,
      );
      return aConocimientoDto(await repo.save({ ...actual, activo: true }));
    });
  }

  /**
   * Fusiona un duplicado (`idOrigen`) en el conocimiento que se conserva.
   * Todo o nada, bajo el bloqueo de conocimiento; no se puede deshacer.
   */
  async fusionar(
    idOrigen: number,
    dto: FusionarConocimientoDto,
  ): Promise<ResultadoFusionDto> {
    const idDestino = dto.idDestino;
    if (idOrigen === idDestino) {
      throw new BadRequestException(
        'El origen y el destino de la fusión son el mismo conocimiento',
      );
    }
    return enTransaccionDeConocimiento(this.conocimientos, async (manager) => {
      const repo = manager.getRepository(Conocimiento);
      const origen = await this.exigir(repo, idOrigen);
      const destino = await this.exigir(repo, idDestino);
      if (!origen.activo || !destino.activo) {
        throw new BadRequestException(
          'Los dos conocimientos deben estar activos para fusionarlos',
        );
      }
      if (origen.idTipoConocimiento !== destino.idTipoConocimiento) {
        throw new BadRequestException(
          'Solo se fusionan conocimientos del mismo tipo: corregí antes el tipo de uno de ellos',
        );
      }

      const [{ n: requisitosMovidos }] = await manager.query<{ n: number }[]>(
        SQL_CONTAR_REQUISITOS,
        [idOrigen],
      );
      const [{ n: personasMovidas }] = await manager.query<{ n: number }[]>(
        SQL_CONTAR_PERSONAS,
        [idOrigen],
      );
      for (const paso of PASOS_FUSION) {
        await manager.query(paso, [idOrigen, idDestino]);
      }
      await repo.save({ ...origen, activo: false, idFusionadoEn: idDestino });

      return { idOrigen, idDestino, requisitosMovidos, personasMovidas };
    });
  }

  private async validarDominios(idTipo: number, idArea: number): Promise<void> {
    await this.referencia.validarActivo(DOMINIO_TIPO_CONOCIMIENTO, idTipo);
    await this.referencia.validarActivo(DOMINIO_AREA_TEMATICA, idArea);
  }

  private async exigir(
    repo: Repository<Conocimiento>,
    id: number,
  ): Promise<Conocimiento> {
    const encontrado = await repo.findOne({ where: { id } });
    if (!encontrado) {
      throw new NotFoundException(`No existe el conocimiento ${id}`);
    }
    return encontrado;
  }

  /** Entre los activos del mismo tipo; `excluirId` evita chocar consigo mismo. */
  private async exigirSinDuplicado(
    repo: Repository<Conocimiento>,
    idTipo: number,
    normalizada: string,
    excluirId?: number,
  ): Promise<void> {
    const iguales = await repo.find({
      where: {
        idTipoConocimiento: idTipo,
        denominacionNormalizada: normalizada,
        activo: true,
      },
    });
    const otro = iguales.find((c) => c.id !== excluirId);
    if (otro) {
      throw new ConflictException(
        `Ya existe el conocimiento "${otro.denominacion}" (id ${otro.id}) con ese tipo`,
      );
    }
  }
}
