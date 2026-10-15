import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { DOMINIO_NIVEL_DOMINIO } from './conocimiento.constantes.js';
import type {
  CopiarRequisitosDto,
  GuardarRequisitoDto,
  RequisitoDto,
  ResultadoCopiaDto,
} from './dto/requisitos.dto.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { enTransaccionDeConocimiento } from './transaccion.js';

function aRequisitoDto(
  r: RequisitoPuesto,
  c: Pick<Conocimiento, 'denominacion' | 'idTipoConocimiento'>,
): RequisitoDto {
  return {
    idPuesto: r.idPuesto,
    idConocimiento: r.idConocimiento,
    denominacion: c.denominacion,
    idTipoConocimiento: c.idTipoConocimiento,
    idNivelRequerido: r.idNivelRequerido,
    esExcluyente: r.esExcluyente,
  };
}

/** Requisitos de conocimiento de cada puesto (RF09). Las escrituras corren con el bloqueo de conocimiento. */
@Injectable()
export class RequisitosService {
  constructor(
    @InjectRepository(RequisitoPuesto)
    private readonly requisitos: Repository<RequisitoPuesto>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    @InjectRepository(Conocimiento)
    private readonly conocimientos: Repository<Conocimiento>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(idPuesto: number): Promise<RequisitoDto[]> {
    await this.exigirPuesto(this.puestos, idPuesto);
    const filas = await this.requisitos.find({
      where: { idPuesto },
      relations: { conocimiento: true },
    });
    return filas
      .map((r) => aRequisitoDto(r, r.conocimiento))
      .sort((a, b) => a.denominacion.localeCompare(b.denominacion, 'es'));
  }

  async guardar(
    idPuesto: number,
    idConocimiento: number,
    dto: GuardarRequisitoDto,
  ): Promise<RequisitoDto> {
    await this.referencia.validarActivo(DOMINIO_NIVEL_DOMINIO, dto.idNivel);
    return enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const puesto = await this.exigirPuesto(
        manager.getRepository(Puesto),
        idPuesto,
      );
      this.exigirPuestoActivo(puesto, idPuesto);
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: idConocimiento } });
      if (!conocimiento || !conocimiento.activo) {
        throw new BadRequestException(
          `El conocimiento ${idConocimiento} no existe o está dado de baja`,
        );
      }
      const guardado = await manager.getRepository(RequisitoPuesto).save({
        idPuesto,
        idConocimiento,
        idNivelRequerido: dto.idNivel,
        esExcluyente: dto.esExcluyente,
      } as RequisitoPuesto);
      return aRequisitoDto(guardado, conocimiento);
    });
  }

  async quitar(idPuesto: number, idConocimiento: number): Promise<void> {
    await enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const repo = manager.getRepository(RequisitoPuesto);
      const actual = await repo.findOne({
        where: { idPuesto, idConocimiento },
      });
      if (!actual) {
        throw new NotFoundException(
          `El puesto ${idPuesto} no tiene ese requisito`,
        );
      }
      await repo.delete({ idPuesto, idConocimiento });
    });
  }

  /** Copia puntual: los requisitos que el destino ya tiene no se pisan. */
  async copiar(
    idPuestoDestino: number,
    dto: CopiarRequisitosDto,
  ): Promise<ResultadoCopiaDto> {
    if (dto.idPuestoOrigen === idPuestoDestino) {
      throw new BadRequestException(
        'El puesto de origen y el de destino son el mismo',
      );
    }
    return enTransaccionDeConocimiento(this.requisitos, async (manager) => {
      const puestos = manager.getRepository(Puesto);
      const destino = await this.exigirPuesto(puestos, idPuestoDestino);
      this.exigirPuestoActivo(destino, idPuestoDestino);
      await this.exigirPuesto(puestos, dto.idPuestoOrigen);

      const repo = manager.getRepository(RequisitoPuesto);
      const delOrigen = await repo.find({
        where: { idPuesto: dto.idPuestoOrigen },
        relations: { conocimiento: true },
      });
      const yaTiene = new Set(
        (await repo.find({ where: { idPuesto: idPuestoDestino } })).map(
          (r) => r.idConocimiento,
        ),
      );

      const resultado: ResultadoCopiaDto = { copiados: 0, omitidos: [] };
      for (const r of delOrigen.filter((x) => x.conocimiento.activo)) {
        if (yaTiene.has(r.idConocimiento)) {
          resultado.omitidos.push({
            idConocimiento: r.idConocimiento,
            denominacion: r.conocimiento.denominacion,
          });
          continue;
        }
        await repo.insert({
          idPuesto: idPuestoDestino,
          idConocimiento: r.idConocimiento,
          idNivelRequerido: r.idNivelRequerido,
          esExcluyente: r.esExcluyente,
        });
        resultado.copiados += 1;
      }
      return resultado;
    });
  }

  private async exigirPuesto(
    repo: Repository<Puesto>,
    idPuesto: number,
  ): Promise<Puesto> {
    const puesto = await repo.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    return puesto;
  }

  private exigirPuestoActivo(puesto: Puesto, idPuesto: number): void {
    if (!puesto.activo) {
      throw new BadRequestException(`El puesto ${idPuesto} está dado de baja`);
    }
  }
}
