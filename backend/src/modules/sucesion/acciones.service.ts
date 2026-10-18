import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { enTransaccionDeConocimiento } from '../conocimiento/transaccion.js';
import { Conocimiento } from '../conocimiento/entities/conocimiento.entity.js';
import { RequisitoPuesto } from '../conocimiento/entities/requisito-puesto.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { EstadoAccionTransferencia } from '../referencia/entities/estado-accion-transferencia.entity.js';
import { EstadoPlan } from '../referencia/entities/estado-plan.entity.js';
import { TipoAccionTransferencia } from '../referencia/entities/tipo-accion-transferencia.entity.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import type {
  AccionDto,
  AvanzarAccionDto,
  CrearAccionDto,
  EditarAccionDto,
  FiltroAccionesDto,
} from './dto/accion.dto.js';
import { AccionTransferencia } from './entities/accion-transferencia.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import {
  ESTADO_ACCION,
  ESTADO_PLAN,
  TRANSICIONES_ACCION,
  puedePasar,
} from './sucesion.constantes.js';
import { aAccionDto } from './sucesion.mapper.js';

const RELACIONES = {
  tipoAccion: true,
  conocimiento: true,
  responsable: true,
  destinatario: true,
  estadoAccion: true,
} as const;

/**
 * Acciones de transferencia de conocimiento (RF15). Se escriben bajo el
 * bloqueo de conocimiento: una fusión no puede cruzarse con una escritura.
 */
@Injectable()
export class AccionesService {
  constructor(
    @InjectRepository(AccionTransferencia)
    private readonly acciones: Repository<AccionTransferencia>,
    private readonly alcance: AlcanceService,
  ) {}

  async crear(dto: CrearAccionDto, _sesion: SesionUsuario): Promise<AccionDto> {
    return enTransaccionDeConocimiento(this.acciones, async (manager) => {
      if (
        dto.idDestinatario != null &&
        dto.idDestinatario === dto.idResponsable
      ) {
        throw new BadRequestException(
          'El destinatario debe ser distinto del responsable',
        );
      }
      await this.exigirTipoActivo(manager, dto.idTipoAccion);
      const conocimiento = await manager
        .getRepository(Conocimiento)
        .findOne({ where: { id: dto.idConocimiento } });
      if (!conocimiento) {
        throw new NotFoundException(
          `No existe el conocimiento ${dto.idConocimiento}`,
        );
      }
      if (!conocimiento.activo) {
        throw new BadRequestException('El conocimiento está dado de baja');
      }
      await this.exigirPersonaActiva(manager, dto.idResponsable, 'responsable');
      if (dto.idDestinatario != null) {
        await this.exigirPersonaActiva(
          manager,
          dto.idDestinatario,
          'destinatario',
        );
      }
      if (dto.idPlan != null) {
        await this.exigirPlanAbierto(manager, dto.idPlan, dto.idConocimiento);
      }

      const estados = await this.estados(manager);
      const repo = manager.getRepository(AccionTransferencia);
      const guardada = await repo.save(
        repo.create({
          idTipoAccion: dto.idTipoAccion,
          idConocimiento: dto.idConocimiento,
          idPlan: dto.idPlan ?? null,
          idResponsable: dto.idResponsable,
          idDestinatario: dto.idDestinatario ?? null,
          descripcion: dto.descripcion,
          fechaPrevista: dto.fechaPrevista,
          fechaCumplimiento: null,
          idEstadoAccion: estados.id(ESTADO_ACCION.pendiente),
          notaAvance: null,
        }),
      );
      return this.dtoDe(manager, guardada.id);
    });
  }

  async editar(
    id: number,
    dto: EditarAccionDto,
    _sesion: SesionUsuario,
  ): Promise<AccionDto> {
    return enTransaccionDeConocimiento(this.acciones, async (manager) => {
      const repo = manager.getRepository(AccionTransferencia);
      const accion = await this.buscar(manager, id);
      const estados = await this.estados(manager);
      const actual = estados.codigo(accion.idEstadoAccion);
      if (
        actual === ESTADO_ACCION.completada ||
        actual === ESTADO_ACCION.cancelada
      ) {
        throw new ConflictException(`No se puede editar una acción ${actual}`);
      }

      if (dto.idTipoAccion !== undefined) {
        await this.exigirTipoActivo(manager, dto.idTipoAccion);
        accion.idTipoAccion = dto.idTipoAccion;
      }
      if (dto.idResponsable !== undefined) {
        await this.exigirPersonaActiva(
          manager,
          dto.idResponsable,
          'responsable',
        );
        accion.idResponsable = dto.idResponsable;
      }
      if (dto.idDestinatario !== undefined) {
        if (dto.idDestinatario !== null) {
          await this.exigirPersonaActiva(
            manager,
            dto.idDestinatario,
            'destinatario',
          );
        }
        accion.idDestinatario = dto.idDestinatario;
      }
      if (
        accion.idDestinatario !== null &&
        accion.idDestinatario === accion.idResponsable
      ) {
        throw new BadRequestException(
          'El destinatario debe ser distinto del responsable',
        );
      }
      if (dto.descripcion !== undefined) accion.descripcion = dto.descripcion;
      if (dto.fechaPrevista !== undefined)
        accion.fechaPrevista = dto.fechaPrevista;
      if (dto.cancelar === true) {
        accion.idEstadoAccion = estados.id(ESTADO_ACCION.cancelada);
      }
      accion.actualizadaEn = new Date();
      await repo.save(accion);
      return this.dtoDe(manager, id);
    });
  }

  async avanzar(
    id: number,
    dto: AvanzarAccionDto,
    sesion: SesionUsuario,
  ): Promise<AccionDto> {
    return enTransaccionDeConocimiento(this.acciones, async (manager) => {
      const repo = manager.getRepository(AccionTransferencia);
      const accion = await this.buscar(manager, id);
      const esRrhh = sesion.rol === ROLES.recursosHumanos;
      const esResponsable =
        sesion.idPersona !== null && sesion.idPersona === accion.idResponsable;
      if (!esRrhh && !esResponsable) {
        throw new ForbiddenException(
          'Solo el responsable de la acción o Recursos Humanos pueden avanzarla',
        );
      }

      const estados = await this.estados(manager);
      const actual = estados.codigo(accion.idEstadoAccion);
      // En curso sobre en curso no es una transición: es actualizar la nota (RF15).
      const soloNota =
        actual === ESTADO_ACCION.enCurso &&
        dto.estado === ESTADO_ACCION.enCurso;
      if (!soloNota && !puedePasar(TRANSICIONES_ACCION, actual, dto.estado)) {
        throw new ConflictException(
          `No se puede pasar una acción de ${actual} a ${dto.estado}`,
        );
      }

      if (dto.estado === ESTADO_ACCION.completada) {
        const hoy = await hoyDeLaBase(manager);
        const fecha = dto.fechaCumplimiento ?? hoy;
        if (fecha > hoy) {
          throw new BadRequestException(
            'La fecha de cumplimiento no puede ser futura',
          );
        }
        accion.fechaCumplimiento = fecha;
      } else if (dto.fechaCumplimiento !== undefined) {
        throw new BadRequestException(
          'La fecha de cumplimiento solo se informa al completar',
        );
      }
      if (dto.notaAvance !== undefined) accion.notaAvance = dto.notaAvance;
      accion.idEstadoAccion = estados.id(dto.estado);
      accion.actualizadaEn = new Date();
      await repo.save(accion);
      return this.dtoDe(manager, id);
    });
  }

  /** La visibilidad se resuelve en la consulta, no filtrando en memoria. */
  async listar(
    filtro: FiltroAccionesDto,
    sesion: SesionUsuario,
  ): Promise<AccionDto[]> {
    const consulta = this.consultaBase();
    if (sesion.rol === ROLES.docente) {
      if (sesion.idPersona === null) return [];
      consulta.andWhere(
        '(a.idResponsable = :idPersona OR a.idDestinatario = :idPersona)',
        { idPersona: sesion.idPersona },
      );
    } else {
      const unidades = await this.alcance.unidadesVisibles(sesion);
      if (unidades !== null) {
        // Los jefes ven además las acciones en que son responsable o destinatario,
        // tengan plan o no; el listado no se duplica porque todo es una sola fila por acción.
        const propias =
          sesion.idPersona !== null
            ? 'a.idResponsable = :idPersona OR a.idDestinatario = :idPersona'
            : null;
        if (unidades.length === 0 && propias === null) return [];
        const criterios = [
          ...(unidades.length > 0 ? ['puesto.idUnidad IN (:...unidades)'] : []),
          ...(propias !== null ? [propias] : []),
        ];
        const parametros: Record<string, unknown> = {
          ...(unidades.length > 0 && { unidades }),
          ...(propias !== null && { idPersona: sesion.idPersona }),
        };
        consulta.andWhere(`(${criterios.join(' OR ')})`, parametros);
      }
    }

    const hoy = await hoyDeLaBase(this.acciones.manager);
    if (filtro.idPlan !== undefined) {
      consulta.andWhere('a.idPlan = :idPlan', { idPlan: filtro.idPlan });
    }
    if (filtro.idConocimiento !== undefined) {
      consulta.andWhere('a.idConocimiento = :idConocimiento', {
        idConocimiento: filtro.idConocimiento,
      });
    }
    if (filtro.estado !== undefined) {
      consulta.andWhere('estadoAccion.codigo = :estado', {
        estado: filtro.estado,
      });
    }
    if (filtro.vencidas !== undefined) {
      const vencida =
        '(estadoAccion.codigo IN (:...abiertas) AND a.fechaPrevista < :hoy)';
      consulta.andWhere(filtro.vencidas ? vencida : `NOT ${vencida}`, {
        abiertas: [ESTADO_ACCION.pendiente, ESTADO_ACCION.enCurso],
        hoy,
      });
    }
    const filas = await consulta.getMany();
    return filas.map((a) => aAccionDto(a, hoy));
  }

  /** Acciones del plan. No valida alcance: lo hace quien llama. */
  async listarDePlan(idPlan: number): Promise<AccionDto[]> {
    const hoy = await hoyDeLaBase(this.acciones.manager);
    const filas = await this.consultaBase()
      .andWhere('a.idPlan = :idPlan', { idPlan })
      .getMany();
    return filas.map((a) => aAccionDto(a, hoy));
  }

  // --- auxiliares ---

  private consultaBase() {
    return this.acciones
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.tipoAccion', 'tipoAccion')
      .innerJoinAndSelect('a.conocimiento', 'conocimiento')
      .innerJoinAndSelect('a.responsable', 'responsable')
      .leftJoinAndSelect('a.destinatario', 'destinatario')
      .innerJoinAndSelect('a.estadoAccion', 'estadoAccion')
      .leftJoin('a.plan', 'plan')
      .leftJoin('plan.puesto', 'puesto')
      .orderBy('a.fechaPrevista', 'ASC')
      .addOrderBy('a.id', 'ASC');
  }

  private async buscar(
    manager: EntityManager,
    id: number,
  ): Promise<AccionTransferencia> {
    const accion = await manager
      .getRepository(AccionTransferencia)
      .findOne({ where: { id } });
    if (!accion) throw new NotFoundException(`No existe la acción ${id}`);
    return accion;
  }

  private async dtoDe(manager: EntityManager, id: number): Promise<AccionDto> {
    const accion = await manager
      .getRepository(AccionTransferencia)
      .findOne({ where: { id }, relations: RELACIONES });
    if (!accion) throw new NotFoundException(`No existe la acción ${id}`);
    return aAccionDto(accion, await hoyDeLaBase(manager));
  }

  private async estados(manager: EntityManager) {
    const filas = await manager.getRepository(EstadoAccionTransferencia).find();
    return {
      id: (codigo: string): number => {
        const fila = filas.find((e) => e.codigo === codigo);
        if (!fila) throw new Error(`Falta el estado de acción ${codigo}`);
        return fila.id;
      },
      codigo: (id: number): string =>
        filas.find((e) => e.id === id)?.codigo ?? '',
    };
  }

  private async exigirTipoActivo(
    manager: EntityManager,
    id: number,
  ): Promise<void> {
    const tipo = await manager
      .getRepository(TipoAccionTransferencia)
      .findOne({ where: { id } });
    if (!tipo || !tipo.activo) {
      throw new BadRequestException(
        'El tipo de acción no existe o está dado de baja',
      );
    }
  }

  private async exigirPersonaActiva(
    manager: EntityManager,
    id: number,
    rol: string,
  ): Promise<void> {
    const persona = await manager
      .getRepository(Persona)
      .findOne({ where: { id } });
    if (!persona || !persona.activo) {
      throw new BadRequestException(
        `El ${rol} debe ser una persona existente y activa`,
      );
    }
  }

  /** El plan existe, no está cerrado y el conocimiento es requisito de su puesto. */
  private async exigirPlanAbierto(
    manager: EntityManager,
    idPlan: number,
    idConocimiento: number,
  ): Promise<void> {
    const plan = await manager
      .getRepository(PlanSucesion)
      .findOne({ where: { id: idPlan } });
    if (!plan) throw new NotFoundException(`No existe el plan ${idPlan}`);
    const estados = await manager.getRepository(EstadoPlan).find();
    const codigo = estados.find((e) => e.id === plan.idEstadoPlan)?.codigo;
    if (codigo === ESTADO_PLAN.cerrado) {
      throw new ConflictException('El plan está cerrado: no admite acciones');
    }
    const requisito = await manager
      .getRepository(RequisitoPuesto)
      .findOne({ where: { idPuesto: plan.idPuesto, idConocimiento } });
    if (!requisito) {
      throw new ConflictException(
        'El conocimiento no es requisito del puesto del plan',
      );
    }
  }
}
