import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferenciaService } from '../referencia/referencia.service.js';
import type { PuestosTipoCreadosDto } from './dto/puesto.dto.js';
import { Puesto } from './entities/puesto.entity.js';
import type { UnidadOrganizativa } from './entities/unidad-organizativa.entity.js';
import {
  DOMINIO_NIVEL_JERARQUICO,
  NIVELES_JERARQUICOS,
  TIPOS_UNIDAD,
} from './estructura.constantes.js';
import { aPuestoDto } from './puesto.mapper.js';
import { PUESTOS_TIPO, type ClavePuestoTipo } from './puestos-tipo.js';
import {
  enTransaccionDeEstructura,
  siguienteCodigoPuesto,
} from './transaccion.js';
import { UnidadesService } from './unidades.service.js';

const normalizar = (texto: string) => texto.trim().toLowerCase();

/** Crea de una vez los cuatro cargos de una cátedra. */
@Injectable()
export class PuestosTipoService {
  constructor(
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly unidades: UnidadesService,
    private readonly referencia: ReferenciaService,
  ) {}

  async crear(idUnidad: number): Promise<PuestosTipoCreadosDto> {
    const unidad = await this.unidades.exigirActiva(idUnidad);
    if (unidad.tipo.codigo !== TIPOS_UNIDAD.catedra) {
      throw new BadRequestException(
        'Los puestos tipo se crean solo en cátedras',
      );
    }
    const niveles = await this.idsDeNiveles();

    return enTransaccionDeEstructura(this.puestos, async (manager) => {
      const repo = manager.getRepository(Puesto);

      const activos = await repo.find({ where: { idUnidad, activo: true } });
      const repetidos = PUESTOS_TIPO.filter((tipo) =>
        activos.some(
          (p) => normalizar(p.denominacion) === normalizar(tipo.denominacion),
        ),
      );
      if (repetidos.length > 0) {
        throw new ConflictException(
          `La cátedra ya tiene: ${repetidos.map((r) => r.denominacion).join(', ')}`,
        );
      }

      const advertencias: string[] = [];
      const idJefatura = await this.jefaturaDelDepartamento(
        repo,
        unidad,
        niveles[NIVELES_JERARQUICOS.conduccionDepartamento],
        advertencias,
      );

      const creados = new Map<ClavePuestoTipo, Puesto>();
      for (const tipo of PUESTOS_TIPO) {
        const idSuperior =
          tipo.superior === null
            ? idJefatura
            : (creados.get(tipo.superior) as Puesto).id;
        creados.set(
          tipo.clave,
          await repo.save(
            repo.create({
              codigo: await siguienteCodigoPuesto(manager),
              denominacion: tipo.denominacion,
              proposito: null,
              condicionesTrabajo: null,
              rangoRetributivo: null,
              dotacionPrevista: 1,
              idUnidad,
              idNivelJerarquico: niveles[tipo.nivel],
              idTipoRelacionContractual: null,
              idPuestoSuperior: idSuperior,
              activo: true,
            }),
          ),
        );
      }
      return {
        puestos: PUESTOS_TIPO.map((t) =>
          aPuestoDto(creados.get(t.clave) as Puesto),
        ),
        advertencias,
      };
    });
  }

  /** Ids de los niveles activos que usan los puestos tipo y la jefatura. */
  private async idsDeNiveles(): Promise<Record<string, number>> {
    const valores = await this.referencia.listarValores(
      DOMINIO_NIVEL_JERARQUICO,
    );
    const porCodigo = Object.fromEntries(valores.map((v) => [v.codigo, v.id]));
    const requeridos = new Set<string>([
      NIVELES_JERARQUICOS.conduccionDepartamento,
      ...PUESTOS_TIPO.map((t) => t.nivel),
    ]);
    const faltan = [...requeridos].filter((codigo) => !(codigo in porCodigo));
    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan niveles jerárquicos activos: ${faltan.join(', ')}`,
      );
    }
    return porCodigo;
  }

  /** Único puesto activo de nivel `conduccion_departamento` en el departamento. */
  private async jefaturaDelDepartamento(
    repo: Repository<Puesto>,
    catedra: UnidadOrganizativa,
    idNivelJefatura: number,
    advertencias: string[],
  ): Promise<number | null> {
    const jefaturas =
      catedra.idUnidadSuperior === null
        ? []
        : await repo.find({
            where: {
              idUnidad: catedra.idUnidadSuperior,
              idNivelJerarquico: idNivelJefatura,
              activo: true,
            },
          });
    if (jefaturas.length === 1) return jefaturas[0].id;
    advertencias.push(
      jefaturas.length === 0
        ? 'No hay un puesto activo de jefatura de departamento: el jefe de cátedra se creó sin superior'
        : 'Hay más de un puesto activo de jefatura de departamento: el jefe de cátedra se creó sin superior',
    );
    return null;
  }
}
