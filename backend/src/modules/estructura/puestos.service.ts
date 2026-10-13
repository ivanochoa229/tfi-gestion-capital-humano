import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ILike,
  type EntityManager,
  type FindOptionsWhere,
  Repository,
} from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import type { ActualizarPuestoDto } from './dto/actualizar-puesto.dto.js';
import type { CrearPuestoDto } from './dto/crear-puesto.dto.js';
import type { FiltroPuestosDto } from './dto/filtro-puestos.dto.js';
import type { PuestoDetalleDto, PuestoDto } from './dto/puesto.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import {
  DOMINIO_NIVEL_JERARQUICO,
  DOMINIO_TIPO_RELACION_CONTRACTUAL,
} from './estructura.constantes.js';
import { JerarquiaService } from './jerarquia.service.js';
import { aPuestoDto, aResumen } from './puesto.mapper.js';
import {
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';
import { UnidadesService } from './unidades.service.js';

/** Campos que admiten `null` en una modificación; el resto no se puede vaciar. */
const CAMPOS_NULABLES = new Set([
  'proposito',
  'condicionesTrabajo',
  'rangoRetributivo',
  'idTipoRelacionContractual',
  'idPuestoSuperior',
]);

/** Para `ILIKE`: `%`, `_` y `\` del texto buscado no son comodines. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

const normalizar = (texto: string) => texto.trim().toLowerCase();

function cambios(dto: ActualizarPuestoDto): Partial<Puesto> {
  const resultado: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dto)) {
    if (valor === undefined) continue;
    if (valor === null && !CAMPOS_NULABLES.has(campo)) {
      throw new BadRequestException(`${campo} no admite null`);
    }
    resultado[campo] = valor;
  }
  return resultado as Partial<Puesto>;
}

/** Inventario de puestos (RF02). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class PuestosService {
  constructor(
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly unidades: UnidadesService,
    private readonly jerarquia: JerarquiaService,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(filtro: FiltroPuestosDto): Promise<PuestoDto[]> {
    const base: FindOptionsWhere<Puesto> = {};
    if (filtro.idUnidad !== undefined) base.idUnidad = filtro.idUnidad;
    if (filtro.activo !== undefined) base.activo = filtro.activo;
    const texto = filtro.q?.trim();
    const patron = texto ? `%${escaparLike(texto)}%` : undefined;
    const filas = await this.puestos.find({
      where: patron
        ? [
            { ...base, codigo: ILike(patron) },
            { ...base, denominacion: ILike(patron) },
          ]
        : base,
      order: { codigo: 'ASC' },
    });
    return filas.map(aPuestoDto);
  }

  async obtener(id: number): Promise<PuestoDetalleDto> {
    const puesto = await this.buscar(this.puestos, id);
    const superior =
      puesto.idPuestoSuperior === null
        ? null
        : await this.puestos.findOne({
            where: { id: puesto.idPuestoSuperior },
          });
    const subordinados = await this.puestos.find({
      where: { idPuestoSuperior: id },
      order: { codigo: 'ASC' },
    });
    return {
      ...aPuestoDto(puesto),
      superior: superior ? aResumen(superior) : null,
      subordinados: subordinados.map(aResumen),
    };
  }

  async crear(dto: CrearPuestoDto): Promise<PuestoDetalleDto> {
    await this.unidades.exigirActiva(dto.idUnidad);
    await this.referencia.validarActivo(
      DOMINIO_NIVEL_JERARQUICO,
      dto.idNivelJerarquico,
    );
    if (dto.idTipoRelacionContractual != null) {
      await this.referencia.validarActivo(
        DOMINIO_TIPO_RELACION_CONTRACTUAL,
        dto.idTipoRelacionContractual,
      );
    }

    const id = await enTransaccionDeEstructura(
      this.puestos,
      async (manager) => {
        const repo = manager.getRepository(Puesto);
        await this.exigirDenominacionLibre(
          repo,
          dto.idUnidad,
          dto.denominacion,
        );
        if (dto.idPuestoSuperior != null) {
          await this.validarSuperior(
            manager,
            null,
            dto.idUnidad,
            dto.idPuestoSuperior,
          );
        }
        const creado = await repo.save(
          repo.create({
            codigo: await siguienteCodigoPuesto(manager),
            denominacion: dto.denominacion,
            proposito: dto.proposito ?? null,
            condicionesTrabajo: dto.condicionesTrabajo ?? null,
            rangoRetributivo: dto.rangoRetributivo ?? null,
            dotacionPrevista: dto.dotacionPrevista ?? 1,
            idUnidad: dto.idUnidad,
            idNivelJerarquico: dto.idNivelJerarquico,
            idTipoRelacionContractual: dto.idTipoRelacionContractual ?? null,
            idPuestoSuperior: dto.idPuestoSuperior ?? null,
            activo: true,
          }),
        );
        return creado.id;
      },
    );
    return this.obtener(id);
  }

  async actualizar(
    id: number,
    dto: ActualizarPuestoDto,
  ): Promise<PuestoDetalleDto> {
    const nuevos = cambios(dto);
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);

      if (
        dto.idNivelJerarquico !== undefined &&
        dto.idNivelJerarquico !== puesto.idNivelJerarquico
      ) {
        await this.referencia.validarActivo(
          DOMINIO_NIVEL_JERARQUICO,
          dto.idNivelJerarquico,
        );
      }
      if (
        dto.idTipoRelacionContractual != null &&
        dto.idTipoRelacionContractual !== puesto.idTipoRelacionContractual
      ) {
        await this.referencia.validarActivo(
          DOMINIO_TIPO_RELACION_CONTRACTUAL,
          dto.idTipoRelacionContractual,
        );
      }
      if (dto.denominacion !== undefined && puesto.activo) {
        await this.exigirDenominacionLibre(
          repo,
          puesto.idUnidad,
          dto.denominacion,
          id,
        );
      }
      if (
        dto.idPuestoSuperior != null &&
        dto.idPuestoSuperior !== puesto.idPuestoSuperior
      ) {
        await this.validarSuperior(
          manager,
          id,
          puesto.idUnidad,
          dto.idPuestoSuperior,
        );
      }

      await repo.save(Object.assign(puesto, nuevos));
    });
    return this.obtener(id);
  }

  /** Baja lógica. Se bloquea mientras haya subordinados activos. */
  async darDeBaja(id: number): Promise<PuestoDetalleDto> {
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);
      if (!puesto.activo) return;

      const subordinados = await repo.find({
        where: { idPuestoSuperior: id, activo: true },
      });
      if (subordinados.length > 0) {
        throw new ConflictException(
          `No se puede dar de baja: tiene subordinados activos (${subordinados
            .map((s) => `${s.codigo} ${s.denominacion}`)
            .join(', ')}). Asignales otro superior primero`,
        );
      }
      puesto.activo = false;
      await repo.save(puesto);
    });
    return this.obtener(id);
  }

  /** Exige unidad y superior activos y que la denominación siga libre. */
  async reactivar(id: number): Promise<PuestoDetalleDto> {
    await enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);
      const puesto = await this.buscar(repo, id);
      if (puesto.activo) return;

      const unidad = await this.unidades.obtener(puesto.idUnidad);
      if (!unidad.activo) {
        throw new ConflictException(
          `No se puede reactivar: la unidad "${unidad.denominacion}" está inactiva`,
        );
      }
      if (puesto.idPuestoSuperior !== null) {
        const superior = await repo.findOne({
          where: { id: puesto.idPuestoSuperior },
        });
        if (!superior?.activo) {
          throw new ConflictException(
            'No se puede reactivar: su puesto superior está dado de baja',
          );
        }
      }
      await this.exigirDenominacionLibre(
        repo,
        puesto.idUnidad,
        puesto.denominacion,
        id,
      );
      puesto.activo = true;
      await repo.save(puesto);
    });
    return this.obtener(id);
  }

  /** `repo` puede ser el de una transacción en curso. */
  protected async buscar(
    repo: Repository<Puesto>,
    id: number,
  ): Promise<Puesto> {
    const puesto = await repo.findOne({ where: { id } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${id}`);
    return puesto;
  }

  /**
   * El superior debe existir, estar activo y estar en la unidad del puesto o en
   * una ancestra. Con `idPuesto` (modificación) también se descartan los ciclos.
   */
  protected async validarSuperior(
    manager: EntityManager,
    idPuesto: number | null,
    idUnidad: number,
    idSuperior: number,
  ): Promise<void> {
    if (idPuesto !== null && idSuperior === idPuesto) {
      throw new BadRequestException(
        'Un puesto no puede ser su propio superior',
      );
    }
    const superior = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: idSuperior } });
    if (!superior) {
      throw new BadRequestException(
        `El puesto superior ${idSuperior} no existe`,
      );
    }
    if (!superior.activo) {
      throw new BadRequestException(
        `El puesto superior ${superior.codigo} está dado de baja`,
      );
    }
    const unidadesValidas = await this.jerarquia.unidadesHastaRaiz(
      idUnidad,
      manager,
    );
    if (!unidadesValidas.includes(superior.idUnidad)) {
      throw new BadRequestException(
        'El superior debe estar en la misma unidad o en una unidad superior',
      );
    }
    if (idPuesto !== null) {
      const cadena = await this.jerarquia.cadenaDeSuperiores(
        idSuperior,
        manager,
      );
      if (cadena.includes(idPuesto)) {
        throw new BadRequestException(
          `El puesto ${superior.codigo} depende de este puesto: se formaría un ciclo`,
        );
      }
    }
  }

  /** Entre los puestos activos de la unidad, sin distinguir mayúsculas ni espacios. */
  protected async exigirDenominacionLibre(
    repo: Repository<Puesto>,
    idUnidad: number,
    denominacion: string,
    idExcluido?: number,
  ): Promise<void> {
    const activos = await repo.find({ where: { idUnidad, activo: true } });
    const repetido = activos.find(
      (p) =>
        p.id !== idExcluido &&
        normalizar(p.denominacion) === normalizar(denominacion),
    );
    if (repetido) {
      throw new ConflictException(
        `La unidad ya tiene el puesto ${repetido.codigo} "${repetido.denominacion}"`,
      );
    }
  }
}
