import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { EstadoPlan } from '../referencia/entities/estado-plan.entity.js';
import { EstadoPreparacion } from '../referencia/entities/estado-preparacion.entity.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import {
  SQL_CANDIDATOS_DEL_PLAN,
  SQL_OCUPACION_DE_PERSONA,
} from './candidatos.sql.js';
import type {
  AgregarCandidatoDto,
  CandidatoDto,
  OrdenCandidatosDto,
  SeguimientoCandidatoDto,
} from './dto/candidato.dto.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { aCandidatoDto, type FilaCandidato } from './sucesion.mapper.js';
import { ESTADO_PLAN } from './sucesion.constantes.js';
import { enTransaccionDeSucesion } from './transaccion.js';

/**
 * Candidatos de un plan de sucesión y su preparación calculada (RF14). Se
 * escriben bajo el bloqueo de sucesión y con `save()`/`remove()` para que la
 * auditoría registre usuario y fecha (RNF05).
 */
@Injectable()
export class CandidatosService {
  constructor(
    @InjectRepository(CandidatoSucesion)
    private readonly candidatos: Repository<CandidatoSucesion>,
    private readonly alcance: AlcanceService,
  ) {}

  async agregar(
    idPlan: number,
    dto: AgregarCandidatoDto,
    sesion: SesionUsuario,
  ): Promise<CandidatoDto> {
    return enTransaccionDeSucesion(this.candidatos, async (manager) => {
      const plan = await this.cargarPlanEn(
        manager,
        idPlan,
        sesion,
        [ESTADO_PLAN.borrador],
        'agregar candidatos',
      );

      const persona = await manager
        .getRepository(Persona)
        .findOne({ where: { id: dto.idPersona } });
      if (!persona || !persona.activo) {
        throw new BadRequestException(
          'El candidato debe ser una persona existente y activa',
        );
      }
      const [ocupacion] = await manager.query<
        { ocupa_puesto: boolean; tiene_ocupacion: boolean }[]
      >(SQL_OCUPACION_DE_PERSONA, [dto.idPersona, plan.idPuesto]);
      if (!ocupacion?.tiene_ocupacion) {
        throw new BadRequestException(
          'El candidato debe tener una ocupación vigente',
        );
      }
      if (ocupacion.ocupa_puesto) {
        throw new ConflictException(
          'La persona ya ocupa el puesto del plan: no puede ser su sucesora',
        );
      }
      const repo = manager.getRepository(CandidatoSucesion);
      const existente = await repo.findOne({
        where: { idPlan, idPersona: dto.idPersona },
      });
      if (existente) {
        throw new ConflictException('La persona ya es candidata de este plan');
      }
      await this.exigirPreparacionActiva(manager, dto.idEstadoPreparacion);

      await repo.save(
        repo.create({
          idPlan,
          idPersona: dto.idPersona,
          idEstadoPreparacion: dto.idEstadoPreparacion,
          prioridad: dto.prioridad,
          fechaDisponibilidadEstimada: dto.fechaDisponibilidadEstimada ?? null,
          observaciones: dto.observaciones ?? null,
        }),
      );
      return this.dtoDe(manager, idPlan, dto.idPersona);
    });
  }

  async seguimiento(
    idPlan: number,
    idPersona: number,
    dto: SeguimientoCandidatoDto,
    sesion: SesionUsuario,
  ): Promise<CandidatoDto> {
    return enTransaccionDeSucesion(this.candidatos, async (manager) => {
      await this.cargarPlanEn(
        manager,
        idPlan,
        sesion,
        [ESTADO_PLAN.borrador, ESTADO_PLAN.aprobado],
        'editar el seguimiento',
      );
      const repo = manager.getRepository(CandidatoSucesion);
      const candidato = await this.buscarCandidato(manager, idPlan, idPersona);
      if (dto.idEstadoPreparacion !== undefined) {
        await this.exigirPreparacionActiva(manager, dto.idEstadoPreparacion);
        candidato.idEstadoPreparacion = dto.idEstadoPreparacion;
      }
      if (dto.fechaDisponibilidadEstimada !== undefined) {
        candidato.fechaDisponibilidadEstimada = dto.fechaDisponibilidadEstimada;
      }
      if (dto.observaciones !== undefined) {
        candidato.observaciones = dto.observaciones;
      }
      await repo.save(candidato);
      return this.dtoDe(manager, idPlan, idPersona);
    });
  }

  async reordenar(
    idPlan: number,
    dto: OrdenCandidatosDto,
    sesion: SesionUsuario,
  ): Promise<CandidatoDto[]> {
    return enTransaccionDeSucesion(this.candidatos, async (manager) => {
      await this.cargarPlanEn(
        manager,
        idPlan,
        sesion,
        [ESTADO_PLAN.borrador],
        'reordenar candidatos',
      );
      const repo = manager.getRepository(CandidatoSucesion);
      const actuales = await repo.find({ where: { idPlan } });
      const pedidos = new Set(dto.orden);
      const ids = new Set(actuales.map((c) => c.idPersona));
      if (
        pedidos.size !== dto.orden.length ||
        dto.orden.length !== ids.size ||
        dto.orden.some((id) => !ids.has(id))
      ) {
        throw new BadRequestException(
          'El orden debe nombrar una sola vez a cada candidato del plan',
        );
      }
      // Un intercambio pasa por prioridades repetidas: se verifica al confirmar.
      await manager.query(
        'SET CONSTRAINTS "UQ_candidato_sucesion_prioridad" DEFERRED',
      );
      for (const candidato of actuales) {
        candidato.prioridad = dto.orden.indexOf(candidato.idPersona) + 1;
        await repo.save(candidato);
      }
      return this.dtosDe(manager, idPlan);
    });
  }

  async quitar(
    idPlan: number,
    idPersona: number,
    sesion: SesionUsuario,
  ): Promise<void> {
    await enTransaccionDeSucesion(this.candidatos, async (manager) => {
      await this.cargarPlanEn(
        manager,
        idPlan,
        sesion,
        [ESTADO_PLAN.borrador],
        'quitar candidatos',
      );
      const candidato = await this.buscarCandidato(manager, idPlan, idPersona);
      await manager.getRepository(CandidatoSucesion).remove(candidato);
    });
  }

  /** Candidatos del plan por prioridad. No valida alcance: lo hace quien llama. */
  async listarDePlan(idPlan: number): Promise<CandidatoDto[]> {
    return this.dtosDe(this.candidatos.manager, idPlan);
  }

  // --- auxiliares ---

  /** Carga el plan, exige su puesto en el alcance y que esté en uno de los estados dados. */
  private async cargarPlanEn(
    manager: EntityManager,
    idPlan: number,
    sesion: SesionUsuario,
    permitidos: string[],
    accion: string,
  ): Promise<PlanSucesion> {
    const plan = await manager
      .getRepository(PlanSucesion)
      .findOne({ where: { id: idPlan } });
    if (!plan) throw new NotFoundException(`No existe el plan ${idPlan}`);
    const puesto = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: plan.idPuesto } });
    if (!puesto) throw new NotFoundException('No existe el puesto del plan');
    await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
    const estados = await manager.getRepository(EstadoPlan).find();
    const actual =
      estados.find((e) => e.id === plan.idEstadoPlan)?.codigo ?? '';
    if (!permitidos.includes(actual)) {
      throw new ConflictException(`No se puede ${accion} en un plan ${actual}`);
    }
    return plan;
  }

  private async buscarCandidato(
    manager: EntityManager,
    idPlan: number,
    idPersona: number,
  ): Promise<CandidatoSucesion> {
    const candidato = await manager
      .getRepository(CandidatoSucesion)
      .findOne({ where: { idPlan, idPersona } });
    if (!candidato) {
      throw new NotFoundException(
        `La persona ${idPersona} no es candidata del plan ${idPlan}`,
      );
    }
    return candidato;
  }

  private async exigirPreparacionActiva(
    manager: EntityManager,
    id: number,
  ): Promise<void> {
    const estado = await manager
      .getRepository(EstadoPreparacion)
      .findOne({ where: { id } });
    if (!estado || !estado.activo) {
      throw new BadRequestException(
        'El estado de preparación no existe o está dado de baja',
      );
    }
  }

  private async dtosDe(
    manager: Pick<EntityManager, 'query'>,
    idPlan: number,
  ): Promise<CandidatoDto[]> {
    const filas = await manager.query<FilaCandidato[]>(
      SQL_CANDIDATOS_DEL_PLAN,
      [idPlan],
    );
    return filas.map(aCandidatoDto);
  }

  private async dtoDe(
    manager: Pick<EntityManager, 'query'>,
    idPlan: number,
    idPersona: number,
  ): Promise<CandidatoDto> {
    const candidato = (await this.dtosDe(manager, idPlan)).find(
      (c) => c.idPersona === idPersona,
    );
    if (!candidato) throw new NotFoundException('El candidato no existe');
    return candidato;
  }
}
