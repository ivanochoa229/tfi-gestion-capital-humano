import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { armarArbol } from './arbol-unidades.js';
import type {
  UnidadArbolDto,
  UnidadDetalleDto,
  UnidadDto,
} from './dto/unidad.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import { aUnidadDto } from './unidad.mapper.js';

/** Consulta de unidades (RF01). Las unidades las carga el DBA: acá no se escribe. */
@Injectable()
export class UnidadesService {
  constructor(
    @InjectRepository(UnidadOrganizativa)
    private readonly unidades: Repository<UnidadOrganizativa>,
    @InjectRepository(Puesto)
    private readonly puestos: Repository<Puesto>,
  ) {}

  async listar(incluirInactivas = false): Promise<UnidadDto[]> {
    const filas = await this.unidades.find({
      where: incluirInactivas ? {} : { activo: true },
      relations: { tipo: true },
      order: { denominacion: 'ASC' },
    });
    return filas.map(aUnidadDto);
  }

  async arbol(incluirInactivas = false): Promise<UnidadArbolDto[]> {
    return armarArbol(await this.listar(incluirInactivas));
  }

  async obtener(id: number): Promise<UnidadDetalleDto> {
    const unidad = await this.buscar(id);
    const cantidadPuestosActivos = await this.puestos.count({
      where: { idUnidad: id, activo: true },
    });
    return { ...aUnidadDto(unidad), cantidadPuestosActivos };
  }

  /** 404 si no existe, 400 si está inactiva. Devuelve la unidad con su tipo. */
  async exigirActiva(id: number): Promise<UnidadOrganizativa> {
    const unidad = await this.buscar(id);
    if (!unidad.activo) {
      throw new BadRequestException(
        `La unidad "${unidad.denominacion}" está inactiva`,
      );
    }
    return unidad;
  }

  /** Con el tipo cargado; las que no existen simplemente no vuelven. */
  buscarPorIds(ids: number[]): Promise<UnidadOrganizativa[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.unidades.find({
      where: { id: In(ids) },
      relations: { tipo: true },
    });
  }

  private async buscar(id: number): Promise<UnidadOrganizativa> {
    const unidad = await this.unidades.findOne({
      where: { id },
      relations: { tipo: true },
    });
    if (!unidad) throw new NotFoundException(`No existe la unidad ${id}`);
    return unidad;
  }
}
