import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_CRITICIDAD } from './criticidad.constantes.js';
import { aCeldaDto, aEscalaDto } from './criticidad.mapper.js';
import type {
  CeldaMatrizDto,
  EditarCeldaDto,
  MatrizDto,
} from './dto/matriz.dto.js';
import { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import { NivelImpacto } from './entities/nivel-impacto.entity.js';

/**
 * Escalas de impacto y dificultad y matriz que las combina (RF12). Cambiar una
 * celda no toca las evaluaciones ya guardadas: cada una conserva el nivel que
 * dio la matriz al evaluar.
 */
@Injectable()
export class MatrizService {
  constructor(
    @InjectRepository(NivelImpacto)
    private readonly impactos: Repository<NivelImpacto>,
    @InjectRepository(NivelDificultad)
    private readonly dificultades: Repository<NivelDificultad>,
    @InjectRepository(MatrizCriticidad)
    private readonly celdas: Repository<MatrizCriticidad>,
    private readonly referencia: ReferenciaService,
  ) {}

  async obtener(): Promise<MatrizDto> {
    const [impactos, dificultades, celdas] = await Promise.all([
      this.impactos.find({ order: { orden: 'ASC' } }),
      this.dificultades.find({ order: { orden: 'ASC' } }),
      this.celdas.find(),
    ]);
    return {
      impactos: impactos.map(aEscalaDto),
      dificultades: dificultades.map(aEscalaDto),
      celdas: celdas.map(aCeldaDto),
    };
  }

  /** Id del nivel de criticidad que la matriz da para el par; 400 si una escala no existe o está desactivada. */
  async nivelDe(idImpacto: number, idDificultad: number): Promise<number> {
    const impacto = await this.impactos.findOneBy({ id: idImpacto });
    if (!impacto || !impacto.activo) {
      throw new BadRequestException(
        `El nivel de impacto ${idImpacto} no existe o está desactivado`,
      );
    }
    const dificultad = await this.dificultades.findOneBy({ id: idDificultad });
    if (!dificultad || !dificultad.activo) {
      throw new BadRequestException(
        `El nivel de dificultad ${idDificultad} no existe o está desactivado`,
      );
    }
    const celda = await this.celdas.findOneBy({
      idNivelImpacto: idImpacto,
      idNivelDificultad: idDificultad,
    });
    if (!celda) {
      throw new InternalServerErrorException(
        'La matriz de criticidad está incompleta',
      );
    }
    return celda.idNivelCriticidad;
  }

  async editarCelda(
    idImpacto: number,
    idDificultad: number,
    dto: EditarCeldaDto,
  ): Promise<CeldaMatrizDto> {
    await this.referencia.validarActivo(
      DOMINIO_NIVEL_CRITICIDAD,
      dto.idNivelCriticidad,
    );
    const celda = await this.celdas.findOneBy({
      idNivelImpacto: idImpacto,
      idNivelDificultad: idDificultad,
    });
    if (!celda) {
      throw new NotFoundException(
        `No existe la celda de impacto ${idImpacto} y dificultad ${idDificultad}`,
      );
    }
    celda.idNivelCriticidad = dto.idNivelCriticidad;
    return aCeldaDto(await this.celdas.save(celda));
  }
}
