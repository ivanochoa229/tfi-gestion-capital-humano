import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Conocimiento } from '../conocimiento/entities/conocimiento.entity.js';
import { RequisitoPuesto } from '../conocimiento/entities/requisito-puesto.entity.js';
import { enTransaccionDeConocimiento } from '../conocimiento/transaccion.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { aEvaluacionDto } from './criticidad.mapper.js';
import type { EvaluacionDto, EvaluarDto } from './dto/evaluacion.dto.js';
import { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { MatrizService } from './matriz.service.js';

/**
 * Evaluación de criticidad por par conocimiento-puesto (RF12). Solo agrega al
 * historial; la vigente sale de la vista `criticidad_vigente`. Escribe con
 * `save()` para que la auditoría registre el alta (RNF05) y bajo el bloqueo de
 * conocimiento, para no cruzarse con una fusión.
 */
@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectRepository(EvaluacionCriticidad)
    private readonly evaluaciones: Repository<EvaluacionCriticidad>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly matriz: MatrizService,
    private readonly alcance: AlcanceService,
  ) {}

  async evaluar(
    idPuesto: number,
    idConocimiento: number,
    dto: EvaluarDto,
    sesion: SesionUsuario,
  ): Promise<EvaluacionDto> {
    // Se lee antes de la transacción: valida las escalas y fija el nivel de esta evaluación.
    const idNivelCriticidad = await this.matriz.nivelDe(
      dto.idNivelImpacto,
      dto.idNivelDificultad,
    );

    return enTransaccionDeConocimiento(this.evaluaciones, async (manager) => {
      const puesto = await manager
        .getRepository(Puesto)
        .findOne({ where: { id: idPuesto } });
      if (!puesto)
        throw new NotFoundException(`No existe el puesto ${idPuesto}`);
      await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
      if (!puesto.activo) {
        throw new BadRequestException('El puesto está dado de baja');
      }
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: idConocimiento } });
      if (!conocimiento) {
        throw new NotFoundException(
          `No existe el conocimiento ${idConocimiento}`,
        );
      }
      if (!conocimiento.activo) {
        throw new BadRequestException('El conocimiento está dado de baja');
      }
      const requisito = await manager
        .getRepository(RequisitoPuesto)
        .findOne({ where: { idPuesto, idConocimiento } });
      if (!requisito) {
        throw new ConflictException(
          'El puesto no exige ese conocimiento: solo se evalúan los conocimientos del perfil',
        );
      }
      const hoy = await hoyDeLaBase(manager);
      const fecha = dto.fechaEvaluacion ?? hoy;
      if (fecha > hoy) {
        throw new BadRequestException(
          'La fecha de evaluación no puede ser futura',
        );
      }

      const repo = manager.getRepository(EvaluacionCriticidad);
      const creada = await repo.save(
        repo.create({
          idPuesto,
          idConocimiento,
          idNivelImpacto: dto.idNivelImpacto,
          idNivelDificultad: dto.idNivelDificultad,
          idNivelCriticidad,
          fechaEvaluacion: fecha,
          idUsuario: sesion.id,
          observaciones: dto.observaciones ?? null,
        }),
      );
      return aEvaluacionDto(creada, sesion.nombreUsuario);
    });
  }

  /** Todas las evaluaciones del par, la más reciente primero. Sigue disponible aunque el requisito se haya quitado. */
  async historial(
    idPuesto: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<EvaluacionDto[]> {
    const puesto = await this.puestos.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
    const filas = await this.evaluaciones.find({
      where: { idPuesto, idConocimiento },
      relations: { usuario: true },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    return filas.map((e) => aEvaluacionDto(e, e.usuario.nombreUsuario));
  }
}
