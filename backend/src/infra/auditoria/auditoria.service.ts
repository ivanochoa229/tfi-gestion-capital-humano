import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './auditoria.entity.js';
import type { AuditoriaDto } from './dto/auditoria.dto.js';
import type { ConsultaAuditoriaDto } from './dto/consulta-auditoria.dto.js';

const TOPE = 200;

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoria: Repository<Auditoria>,
  ) {}

  async consultar(filtro: ConsultaAuditoriaDto): Promise<AuditoriaDto[]> {
    const filas = await this.auditoria.find({
      where: {
        ...(filtro.entidad && { entidad: filtro.entidad }),
        ...(filtro.idRegistro && { idRegistro: filtro.idRegistro }),
      },
      order: { fecha: 'DESC', id: 'DESC' },
      take: TOPE,
    });
    return filas.map((f) => ({
      id: f.id,
      entidad: f.entidad,
      idRegistro: f.idRegistro,
      operacion: f.operacion,
      idUsuario: f.idUsuario,
      fecha: f.fecha,
      valoresAnteriores: f.valoresAnteriores,
      valoresNuevos: f.valoresNuevos,
    }));
  }
}
