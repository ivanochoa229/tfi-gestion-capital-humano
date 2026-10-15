import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import {
  DOMINIO_NIVEL_DOMINIO,
  DOMINIO_TIPO_EVIDENCIA,
} from './conocimiento.constantes.js';
import { aAcreditacionDto } from './conocimiento.mapper.js';
import type { AcreditacionDto, AcreditarDto } from './dto/perfil.dto.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

/**
 * Acreditación del conocimiento de una persona (RF10). Solo agrega al
 * historial; el reflejo en `conocimiento_persona` siempre es el de la
 * acreditación vigente, así que una anterior no lo cambia.
 */
@Injectable()
export class AcreditacionesService {
  constructor(
    @InjectRepository(Acreditacion)
    private readonly acreditaciones: Repository<Acreditacion>,
    private readonly referencia: ReferenciaService,
    private readonly acceso: AccesoPerfilService,
  ) {}

  async acreditar(
    idPersona: number,
    idConocimiento: number,
    dto: AcreditarDto,
    sesion: SesionUsuario,
  ): Promise<AcreditacionDto> {
    await this.acceso.exigirEvaluacion(sesion, idPersona);
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    await this.referencia.validarActivo(
      DOMINIO_TIPO_EVIDENCIA,
      dto.idTipoEvidencia,
    );
    // `exigirEvaluacion` garantiza que la sesión tiene persona vinculada.
    const idEvaluador = sesion.idPersona as number;

    return enTransaccionDeConocimiento(this.acreditaciones, async (manager) => {
      const persona = await manager
        .getRepository(Persona)
        .findOne({ where: { id: idPersona } });
      if (!persona) {
        throw new NotFoundException(`No existe la persona ${idPersona}`);
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona está dada de baja');
      }
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: idConocimiento } });
      if (!conocimiento) {
        throw new NotFoundException(`No existe el conocimiento ${idConocimiento}`);
      }
      if (!conocimiento.activo) {
        throw new BadRequestException('El conocimiento está dado de baja');
      }
      const hoy = await hoyDeLaBase(manager);
      if (dto.fechaEvaluacion > hoy) {
        throw new BadRequestException(
          'La fecha de evaluación no puede ser futura',
        );
      }

      await manager.query(SQL_ASEGURAR_FILA, [
        idPersona,
        idConocimiento,
        dto.idNivel,
        dto.fechaEvaluacion,
        dto.idTipoEvidencia,
        idEvaluador,
      ]);
      const repo = manager.getRepository(Acreditacion);
      const creada = await repo.save(
        repo.create({
          idPersona,
          idConocimiento,
          idNivelAcreditado: dto.idNivel,
          idTipoEvidencia: dto.idTipoEvidencia,
          fechaEvaluacion: dto.fechaEvaluacion,
          idEvaluador,
          observaciones: dto.observaciones ?? null,
        }),
      );
      await manager.query(SQL_REFLEJAR_VIGENTE, [idPersona, idConocimiento]);
      return aAcreditacionDto(creada);
    });
  }
}
