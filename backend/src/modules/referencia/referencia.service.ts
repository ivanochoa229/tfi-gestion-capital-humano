import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';
import type { ActualizarValorDto } from './dto/actualizar-valor.dto.js';
import type { CrearValorDto } from './dto/crear-valor.dto.js';
import type { DominioDto } from './dto/dominio.dto.js';
import type {
  ActualizacionValorDto,
  ValorReferenciaDto,
} from './dto/valor-referencia.dto.js';
import { buscarDominio, DOMINIOS, type DefinicionDominio } from './dominios.js';
import type {
  ValorReferencia,
  ValorReferenciaOrdinal,
} from './entities/valor-referencia.base.js';

type Valor = ValorReferencia & Partial<Pick<ValorReferenciaOrdinal, 'orden'>>;

/** Claves foráneas (de una sola columna) que apuntan a una tabla. */
const SQL_CLAVES_FORANEAS = `
  SELECT cl.relname AS tabla, att.attname AS columna
  FROM pg_constraint c
  JOIN pg_class cl ON cl.oid = c.conrelid
  JOIN pg_class ref ON ref.oid = c.confrelid
  JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
  WHERE c.contype = 'f'
    AND cardinality(c.conkey) = 1
    AND ref.relnamespace = 'public'::regnamespace
    AND ref.relname = $1`;

const comillas = (identificador: string) =>
  `"${identificador.replaceAll('"', '""')}"`;

function esViolacion(error: unknown, codigo: string): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === codigo
  );
}

@Injectable()
export class ReferenciaService {
  constructor(private readonly dataSource: DataSource) {}

  listarDominios(): DominioDto[] {
    return DOMINIOS.map((d) => ({
      dominio: d.slug,
      denominacion: d.denominacion,
      ordinal: d.ordinal,
    }));
  }

  async listarValores(
    slug: string,
    incluirInactivos = false,
  ): Promise<ValorReferenciaDto[]> {
    const dominio = this.dominio(slug);
    const valores = await this.repo(dominio).find({
      where: incluirInactivos ? {} : { activo: true },
      order: dominio.ordinal ? { orden: 'ASC' } : { denominacion: 'ASC' },
    });
    const enUso = await this.idsEnUso(dominio);
    return valores.map((v) => this.aDto(v, enUso.has(v.id)));
  }

  async crear(slug: string, dto: CrearValorDto): Promise<ValorReferenciaDto> {
    const dominio = this.dominio(slug);
    this.validarOrden(dominio, dto.orden, true);
    await this.validarUnicidad(dominio, dto);

    const repo = this.repo(dominio);
    try {
      const creado = await repo.save(
        repo.create({
          codigo: dto.codigo,
          denominacion: dto.denominacion,
          activo: true,
          ...(dominio.ordinal ? { orden: dto.orden } : {}),
        }),
      );
      return this.aDto(creado, false);
    } catch (error) {
      if (esViolacion(error, '23505')) {
        throw new ConflictException(
          'Ya existe un valor con ese código, denominación u orden',
        );
      }
      throw error;
    }
  }

  async actualizar(
    slug: string,
    id: number,
    dto: ActualizarValorDto,
  ): Promise<ActualizacionValorDto> {
    const dominio = this.dominio(slug);
    const repo = this.repo(dominio);
    const valor = await this.obtener(dominio, id);
    const enUso = (await this.idsEnUso(dominio)).has(id);

    if (dto.orden !== undefined) this.validarOrden(dominio, dto.orden, false);

    if (dto.codigo !== undefined && dto.codigo !== valor.codigo && enUso) {
      throw new ConflictException(
        'No se puede cambiar el código de un valor en uso',
      );
    }
    await this.validarUnicidad(dominio, dto, valor);

    let advertencia: string | undefined;
    if (dto.activo === false && valor.activo) {
      const otrosActivos = await repo.count({ where: { activo: true } });
      if (otrosActivos <= 1) {
        advertencia =
          'No quedan valores activos en este dominio: no se podrá elegir ninguno en nuevas cargas';
      }
    }

    Object.assign(valor, {
      ...(dto.codigo !== undefined && { codigo: dto.codigo }),
      ...(dto.denominacion !== undefined && {
        denominacion: dto.denominacion,
      }),
      ...(dto.orden !== undefined && { orden: dto.orden }),
      ...(dto.activo !== undefined && { activo: dto.activo }),
    });

    try {
      const guardado = await repo.save(valor);
      return { ...this.aDto(guardado, enUso), advertencia };
    } catch (error) {
      if (esViolacion(error, '23505')) {
        throw new ConflictException(
          'Ya existe un valor con ese código, denominación u orden',
        );
      }
      throw error;
    }
  }

  async eliminar(slug: string, id: number): Promise<void> {
    const dominio = this.dominio(slug);
    await this.obtener(dominio, id);
    const mensajeEnUso =
      'El valor está en uso y no puede borrarse; desactivalo para que deje de ofrecerse';

    if ((await this.idsEnUso(dominio)).has(id)) {
      throw new ConflictException(mensajeEnUso);
    }
    try {
      await this.repo(dominio).delete(id);
    } catch (error) {
      if (esViolacion(error, '23503')) {
        throw new ConflictException(mensajeEnUso);
      }
      throw error;
    }
  }

  /**
   * Para los módulos que asignan un valor a un registro nuevo: rechaza valores
   * inexistentes o desactivados (una clave foránea no puede expresarlo).
   */
  async validarActivo(slug: string, id: number): Promise<void> {
    const dominio = this.dominio(slug);
    const valor = await this.repo(dominio).findOneBy({ id });
    if (!valor) {
      throw new BadRequestException(
        `El valor ${id} no existe en ${dominio.denominacion}`,
      );
    }
    if (!valor.activo) {
      throw new BadRequestException(
        `El valor "${valor.denominacion}" está desactivado y no puede asignarse`,
      );
    }
  }

  private dominio(slug: string): DefinicionDominio {
    const dominio = buscarDominio(slug);
    if (!dominio) throw new NotFoundException(`El dominio "${slug}" no existe`);
    return dominio;
  }

  private repo(dominio: DefinicionDominio): Repository<Valor> {
    return this.dataSource.getRepository(dominio.entidad) as Repository<Valor>;
  }

  private async obtener(
    dominio: DefinicionDominio,
    id: number,
  ): Promise<Valor> {
    const valor = await this.repo(dominio).findOneBy({ id });
    if (!valor) {
      throw new NotFoundException(
        `No existe el valor ${id} en ${dominio.denominacion}`,
      );
    }
    return valor;
  }

  private validarOrden(
    dominio: DefinicionDominio,
    orden: number | undefined,
    obligatorio: boolean,
  ): void {
    if (dominio.ordinal && obligatorio && orden === undefined) {
      throw new BadRequestException(
        `${dominio.denominacion} es ordinal: el orden es obligatorio`,
      );
    }
    if (!dominio.ordinal && orden !== undefined) {
      throw new BadRequestException(
        `${dominio.denominacion} no es ordinal: no admite orden`,
      );
    }
  }

  /** Verifica código, denominación y orden repetidos con mensajes claros. */
  private async validarUnicidad(
    dominio: DefinicionDominio,
    dto: Partial<CrearValorDto>,
    actual?: Valor,
  ): Promise<void> {
    const repo = this.repo(dominio);
    const campos: ['codigo' | 'denominacion' | 'orden', string][] = [
      ['codigo', 'el código'],
      ['denominacion', 'la denominación'],
      ...(dominio.ordinal ? [['orden', 'el orden'] as ['orden', string]] : []),
    ];

    for (const [campo, descripcion] of campos) {
      const valor = dto[campo];
      if (valor === undefined || valor === actual?.[campo]) continue;
      const repetido = await repo.findOneBy({ [campo]: valor });
      if (repetido) {
        throw new ConflictException(
          `Ya existe un valor con ${descripcion} "${valor}" en ${dominio.denominacion}`,
        );
      }
    }
  }

  /** Ids de la tabla que algún registro referencia mediante clave foránea. */
  private async idsEnUso(dominio: DefinicionDominio): Promise<Set<number>> {
    const claves: { tabla: string; columna: string }[] =
      await this.dataSource.query(SQL_CLAVES_FORANEAS, [dominio.tabla]);
    const ids = new Set<number>();
    for (const { tabla, columna } of claves) {
      const filas: { id: number }[] = await this.dataSource.query(
        `SELECT DISTINCT ${comillas(columna)} AS id FROM ${comillas(tabla)} WHERE ${comillas(columna)} IS NOT NULL`,
      );
      for (const fila of filas) ids.add(Number(fila.id));
    }
    return ids;
  }

  private aDto(valor: Valor, enUso: boolean): ValorReferenciaDto {
    return {
      id: valor.id,
      codigo: valor.codigo,
      denominacion: valor.denominacion,
      activo: valor.activo,
      ...(valor.orden !== undefined && { orden: valor.orden }),
      enUso,
    };
  }
}
