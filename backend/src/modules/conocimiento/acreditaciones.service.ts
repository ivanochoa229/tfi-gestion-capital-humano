import type { Readable } from 'node:stream';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import {
  claveEnCarpeta,
  prepararArchivo,
  type ArchivoSubido,
} from './archivo.js';
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

export interface DescargaEvidencia {
  flujo: Readable;
  nombre: string;
  tipoMime: string;
  tamanio: number;
}

/**
 * Acreditación del conocimiento de una persona (RF10). Solo agrega al
 * historial; el reflejo en `conocimiento_persona` siempre es el de la
 * acreditación vigente, así que una anterior no lo cambia. La evidencia
 * (opcional) se guarda en RustFS y queda fija: no se reemplaza.
 */
@Injectable()
export class AcreditacionesService {
  private readonly logger = new Logger(AcreditacionesService.name);

  constructor(
    @InjectRepository(Acreditacion)
    private readonly acreditaciones: Repository<Acreditacion>,
    private readonly referencia: ReferenciaService,
    private readonly acceso: AccesoPerfilService,
    private readonly almacenamiento: StorageService,
  ) {}

  async acreditar(
    idPersona: number,
    idConocimiento: number,
    dto: AcreditarDto,
    sesion: SesionUsuario,
    archivo?: ArchivoSubido,
  ): Promise<AcreditacionDto> {
    await this.acceso.exigirEvaluacion(sesion, idPersona);
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    await this.referencia.validarActivo(
      DOMINIO_TIPO_EVIDENCIA,
      dto.idTipoEvidencia,
    );
    // `exigirEvaluacion` garantiza que la sesión tiene persona vinculada.
    const idEvaluador = sesion.idPersona as number;
    const evidencia = archivo ? prepararArchivo(archivo) : null;

    // Primero el archivo y después la base; si la base falla, se borra el objeto.
    const clave =
      evidencia && archivo
        ? claveEnCarpeta('evidencias', idPersona, evidencia.nombre)
        : null;
    if (clave && evidencia && archivo) {
      await this.almacenamiento.subir(
        clave,
        archivo.buffer,
        evidencia.tipoMime,
      );
    }
    try {
      return await this.registrar(
        idPersona,
        idConocimiento,
        dto,
        idEvaluador,
        clave && evidencia ? { clave, ...evidencia } : null,
      );
    } catch (error) {
      if (clave) await this.borrarObjeto(clave);
      throw error;
    }
  }

  /** Descarga la evidencia de una acreditación; la lee quien puede leer el perfil. */
  async evidencia(
    idPersona: number,
    idConocimiento: number,
    idAcreditacion: number,
    sesion: SesionUsuario,
  ): Promise<DescargaEvidencia> {
    await this.acceso.exigirLectura(sesion, idPersona);
    const fila = await this.acreditaciones.findOne({
      where: { id: idAcreditacion, idPersona, idConocimiento },
    });
    if (!fila) {
      throw new NotFoundException(
        `No existe la acreditación ${idAcreditacion}`,
      );
    }
    if (fila.evidenciaClave === null) {
      throw new NotFoundException('La acreditación no tiene evidencia adjunta');
    }
    try {
      return {
        flujo: await this.almacenamiento.obtener(fila.evidenciaClave),
        nombre: fila.evidenciaNombre ?? 'evidencia',
        tipoMime: fila.evidenciaTipoMime ?? 'application/octet-stream',
        tamanio: fila.evidenciaTamanio ?? 0,
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        throw new NotFoundException('El archivo no está en el almacenamiento');
      }
      throw error;
    }
  }

  private registrar(
    idPersona: number,
    idConocimiento: number,
    dto: AcreditarDto,
    idEvaluador: number,
    evidencia: {
      clave: string;
      nombre: string;
      tipoMime: string;
      tamanio: number;
      hash: string;
    } | null,
  ): Promise<AcreditacionDto> {
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
        throw new NotFoundException(
          `No existe el conocimiento ${idConocimiento}`,
        );
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
          evidenciaClave: evidencia?.clave ?? null,
          evidenciaNombre: evidencia?.nombre ?? null,
          evidenciaTipoMime: evidencia?.tipoMime ?? null,
          evidenciaTamanio: evidencia?.tamanio ?? null,
          evidenciaHash: evidencia?.hash ?? null,
        }),
      );
      await manager.query(SQL_REFLEJAR_VIGENTE, [idPersona, idConocimiento]);
      return aAcreditacionDto(creada);
    });
  }

  private async borrarObjeto(clave: string): Promise<void> {
    try {
      await this.almacenamiento.eliminar(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el objeto "${clave}": ${(error as Error).message}`,
      );
    }
  }
}
