import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_DOMINIO } from './conocimiento.constantes.js';
import { aConocimientoPersonaDto } from './conocimiento.mapper.js';
import type {
  ConocimientoPersonaDto,
  DeclararDto,
} from './dto/perfil.dto.js';
import { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

const SQL_DECLARAR = `
  INSERT INTO conocimiento_persona
    (id_persona, id_conocimiento, id_nivel_declarado, fecha_declaracion)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (id_persona, id_conocimiento) DO UPDATE
  SET id_nivel_declarado = EXCLUDED.id_nivel_declarado,
      fecha_declaracion = EXCLUDED.fecha_declaracion`;

/** Lo que cada persona declara saber (RF10). Solo la propia persona declara, nunca otra. */
@Injectable()
export class DeclaracionesService {
  constructor(
    @InjectRepository(ConocimientoPersona)
    private readonly filas: Repository<ConocimientoPersona>,
    private readonly referencia: ReferenciaService,
  ) {}

  /** Declara o corrige el nivel. No toca lo acreditado. */
  async declarar(
    idPersona: number,
    idConocimiento: number,
    dto: DeclararDto,
    sesion: SesionUsuario,
  ): Promise<ConocimientoPersonaDto> {
    this.exigirPropia(sesion, idPersona);
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    return enTransaccionDeConocimiento(this.filas, async (manager) => {
      await this.exigirActivos(manager, idPersona, idConocimiento);
      const hoy = await hoyDeLaBase(manager);
      await manager.query(SQL_DECLARAR, [
        idPersona,
        idConocimiento,
        dto.idNivel,
        hoy,
      ]);
      const fila = await manager
        .getRepository(ConocimientoPersona)
        .findOneByOrFail({ idPersona, idConocimiento });
      return aConocimientoPersonaDto(fila);
    });
  }

  /**
   * Retira la declaración. Sin acreditaciones se borra la fila; con ellas
   * queda la fila con el declarado en nulo (la acreditación no se pierde).
   */
  async retirar(
    idPersona: number,
    idConocimiento: number,
    sesion: SesionUsuario,
  ): Promise<void> {
    this.exigirPropia(sesion, idPersona);
    await enTransaccionDeConocimiento(this.filas, async (manager) => {
      const repo = manager.getRepository(ConocimientoPersona);
      const fila = await repo.findOne({ where: { idPersona, idConocimiento } });
      if (!fila || fila.idNivelDeclarado === null) {
        throw new NotFoundException(
          'No tenés una declaración para ese conocimiento',
        );
      }
      if (fila.idNivelAcreditado === null) {
        await repo.delete({ idPersona, idConocimiento });
      } else {
        await repo.update(
          { idPersona, idConocimiento },
          { idNivelDeclarado: null, fechaDeclaracion: null },
        );
      }
    });
  }

  private exigirPropia(sesion: SesionUsuario, idPersona: number): void {
    if (sesion.idPersona === null || sesion.idPersona !== idPersona) {
      throw new ForbiddenException('Solo podés declarar tus propios conocimientos');
    }
  }

  private async exigirActivos(
    manager: EntityManager,
    idPersona: number,
    idConocimiento: number,
  ): Promise<void> {
    const persona = await manager
      .getRepository(Persona)
      .findOne({ where: { id: idPersona } });
    if (!persona) throw new NotFoundException(`No existe la persona ${idPersona}`);
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
  }
}
