import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type EntityManager, type Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { hoyDeLaBase } from '../personas/fechas.js';
import { EstadoPlan } from '../referencia/entities/estado-plan.entity.js';
import { AlcanceService } from '../usuarios/alcance.service.js';
import { AccionesService } from './acciones.service.js';
import { CandidatosService } from './candidatos.service.js';
import type {
  CrearPlanDto,
  EditarPlanDto,
  FiltroPlanesDto,
  PlanDetalleDto,
  PlanDto,
  ResolverPlanDto,
} from './dto/plan.dto.js';
import { CandidatoSucesion } from './entities/candidato-sucesion.entity.js';
import { PlanSucesion } from './entities/plan-sucesion.entity.js';
import { aPlanDto } from './sucesion.mapper.js';
import {
  ESTADO_PLAN,
  TRANSICIONES_PLAN,
  puedePasar,
} from './sucesion.constantes.js';
import { enTransaccionDeSucesion } from './transaccion.js';

/** Parámetro: `$1` unidad. Devuelve la unidad y todas sus descendientes. */
const SQL_UNIDAD_Y_DESCENDIENTES = `
  WITH RECURSIVE subunidades AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = $1::int
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN subunidades s ON u.id_unidad_superior = s.id_unidad
  )
  SELECT id_unidad FROM subunidades`;

const RELACIONES = {
  puesto: true,
  responsable: true,
  estadoPlan: true,
  usuarioResolucion: true,
} as const;

/** Estados en que un plan ocupa el lugar de «en elaboración». */
const EN_ELABORACION: string[] = [
  ESTADO_PLAN.borrador,
  ESTADO_PLAN.pendienteAprobacion,
];

/**
 * Circuito de aprobación y versiones de los planes de sucesión (RF13). Las
 * escrituras van bajo el bloqueo de sucesión y con `save()` para que la
 * auditoría registre usuario y fecha (RNF05). Los estados se leen por `codigo`.
 */
@Injectable()
export class PlanesService {
  constructor(
    @InjectRepository(PlanSucesion)
    private readonly planes: Repository<PlanSucesion>,
    private readonly alcance: AlcanceService,
    private readonly candidatos: CandidatosService,
    private readonly acciones: AccionesService,
  ) {}

  async crear(dto: CrearPlanDto, sesion: SesionUsuario): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const puesto = await manager
        .getRepository(Puesto)
        .findOne({ where: { id: dto.idPuesto } });
      if (!puesto)
        throw new NotFoundException(`No existe el puesto ${dto.idPuesto}`);
      await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
      if (!puesto.activo) {
        throw new BadRequestException('El puesto está dado de baja');
      }
      await this.exigirResponsableActivo(manager, dto.idResponsable);

      const estados = await this.estados(manager);
      const existentes = await manager.getRepository(PlanSucesion).find({
        where: {
          idPuesto: puesto.id,
          idEstadoPlan: In([
            estados.id(ESTADO_PLAN.borrador),
            estados.id(ESTADO_PLAN.pendienteAprobacion),
            estados.id(ESTADO_PLAN.aprobado),
          ]),
        },
      });
      const codigos = existentes.map((p) => estados.codigo(p.idEstadoPlan));
      if (codigos.some((c) => EN_ELABORACION.includes(c))) {
        throw new ConflictException(
          'El puesto ya tiene un plan en elaboración',
        );
      }
      if (codigos.includes(ESTADO_PLAN.aprobado)) {
        throw new ConflictException(
          'El puesto ya tiene un plan aprobado: para cambiarlo hay que crear una nueva versión',
        );
      }

      const repo = manager.getRepository(PlanSucesion);
      const creado = await repo.save(
        repo.create({
          idPuesto: puesto.id,
          idResponsable: dto.idResponsable,
          idEstadoPlan: estados.id(ESTADO_PLAN.borrador),
          fechaElaboracion: await hoyDeLaBase(manager),
          idPlanAnterior: null,
          idUsuarioResolucion: null,
          fechaResolucion: null,
          motivoResolucion: null,
          observaciones: dto.observaciones ?? null,
        }),
      );
      return this.dtoDe(manager, creado.id);
    });
  }

  async editar(
    id: number,
    dto: EditarPlanDto,
    sesion: SesionUsuario,
  ): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const plan = await this.cargarDeJefatura(manager, id, sesion);
      this.exigirTransicionOEstado(plan, estados, ESTADO_PLAN.borrador);
      if (dto.idResponsable !== undefined) {
        await this.exigirResponsableActivo(manager, dto.idResponsable);
        plan.idResponsable = dto.idResponsable;
      }
      if (dto.observaciones !== undefined) {
        plan.observaciones = dto.observaciones;
      }
      await manager.getRepository(PlanSucesion).save(plan);
      return this.dtoDe(manager, id);
    });
  }

  async presentar(id: number, sesion: SesionUsuario): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const plan = await this.cargarDeJefatura(manager, id, sesion);
      this.exigirTransicion(plan, estados, ESTADO_PLAN.pendienteAprobacion);
      const candidatos = await manager
        .getRepository(CandidatoSucesion)
        .count({ where: { idPlan: id } });
      if (candidatos === 0) {
        throw new ConflictException(
          'El plan necesita al menos un candidato para presentarse',
        );
      }
      plan.idEstadoPlan = estados.id(ESTADO_PLAN.pendienteAprobacion);
      await manager.getRepository(PlanSucesion).save(plan);
      return this.dtoDe(manager, id);
    });
  }

  async resolver(
    id: number,
    dto: ResolverPlanDto,
    sesion: SesionUsuario,
  ): Promise<PlanDto> {
    const motivo = dto.motivo?.trim() || null;
    if (dto.decision === 'rechazar' && !motivo) {
      throw new BadRequestException('Rechazar un plan exige un motivo');
    }
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const repo = manager.getRepository(PlanSucesion);
      const plan = await repo.findOne({ where: { id } });
      if (!plan) throw new NotFoundException(`No existe el plan ${id}`);
      const destino =
        dto.decision === 'aprobar'
          ? ESTADO_PLAN.aprobado
          : ESTADO_PLAN.rechazado;
      this.exigirTransicion(plan, estados, destino);

      if (destino === ESTADO_PLAN.aprobado && plan.idPlanAnterior !== null) {
        const anterior = await repo.findOne({
          where: { id: plan.idPlanAnterior },
        });
        if (
          anterior &&
          estados.codigo(anterior.idEstadoPlan) === ESTADO_PLAN.aprobado
        ) {
          // Antes de aprobar la nueva: solo puede haber un plan aprobado por puesto.
          anterior.idEstadoPlan = estados.id(ESTADO_PLAN.cerrado);
          await repo.save(anterior);
        }
      }
      plan.idEstadoPlan = estados.id(destino);
      plan.idUsuarioResolucion = sesion.id;
      plan.fechaResolucion = await hoyDeLaBase(manager);
      plan.motivoResolucion = motivo;
      await repo.save(plan);
      return this.dtoDe(manager, id);
    });
  }

  async reabrir(id: number, sesion: SesionUsuario): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const plan = await this.cargarDeJefatura(manager, id, sesion);
      this.exigirTransicionOEstado(plan, estados, ESTADO_PLAN.rechazado);
      plan.idEstadoPlan = estados.id(ESTADO_PLAN.borrador);
      // La resolución anterior queda en la auditoría; el borrador vuelve a no tener resolución.
      plan.idUsuarioResolucion = null;
      plan.fechaResolucion = null;
      plan.motivoResolucion = null;
      await manager.getRepository(PlanSucesion).save(plan);
      return this.dtoDe(manager, id);
    });
  }

  async nuevaVersion(id: number, sesion: SesionUsuario): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const origen = await this.cargarDeJefatura(manager, id, sesion);
      this.exigirTransicionOEstado(origen, estados, ESTADO_PLAN.aprobado);
      const repo = manager.getRepository(PlanSucesion);
      const enElaboracion = await repo.count({
        where: {
          idPuesto: origen.idPuesto,
          idEstadoPlan: In([
            estados.id(ESTADO_PLAN.borrador),
            estados.id(ESTADO_PLAN.pendienteAprobacion),
          ]),
        },
      });
      if (enElaboracion > 0) {
        throw new ConflictException(
          'El puesto ya tiene un plan en elaboración',
        );
      }

      const nueva = await repo.save(
        repo.create({
          idPuesto: origen.idPuesto,
          idResponsable: origen.idResponsable,
          idEstadoPlan: estados.id(ESTADO_PLAN.borrador),
          fechaElaboracion: await hoyDeLaBase(manager),
          idPlanAnterior: origen.id,
          idUsuarioResolucion: null,
          fechaResolucion: null,
          motivoResolucion: null,
          observaciones: origen.observaciones,
        }),
      );
      const repoCandidatos = manager.getRepository(CandidatoSucesion);
      const candidatos = await repoCandidatos.find({ where: { idPlan: id } });
      if (candidatos.length > 0) {
        await repoCandidatos.save(
          candidatos.map((c) =>
            repoCandidatos.create({
              idPlan: nueva.id,
              idPersona: c.idPersona,
              idEstadoPreparacion: c.idEstadoPreparacion,
              prioridad: c.prioridad,
              fechaDisponibilidadEstimada: c.fechaDisponibilidadEstimada,
              observaciones: c.observaciones,
            }),
          ),
        );
      }
      return this.dtoDe(manager, nueva.id);
    });
  }

  async cerrar(id: number, sesion: SesionUsuario): Promise<PlanDto> {
    return enTransaccionDeSucesion(this.planes, async (manager) => {
      const estados = await this.estados(manager);
      const plan = await this.cargarDeJefatura(manager, id, sesion);
      this.exigirTransicion(plan, estados, ESTADO_PLAN.cerrado);
      plan.idEstadoPlan = estados.id(ESTADO_PLAN.cerrado);
      await manager.getRepository(PlanSucesion).save(plan);
      return this.dtoDe(manager, id);
    });
  }

  async listar(
    filtro: FiltroPlanesDto,
    sesion: SesionUsuario,
  ): Promise<PlanDto[]> {
    const visibles = await this.alcance.unidadesVisibles(sesion);
    let unidades: number[] | null = visibles;
    if (filtro.idUnidad !== undefined) {
      // La unidad y sus descendientes, siempre dentro de lo visible.
      const filas: { id_unidad: number }[] = await this.planes.manager.query(
        SQL_UNIDAD_Y_DESCENDIENTES,
        [filtro.idUnidad],
      );
      const deLaUnidad = filas.map((f) => Number(f.id_unidad));
      unidades =
        visibles === null
          ? deLaUnidad
          : deLaUnidad.filter((u) => visibles.includes(u));
    }
    if (unidades !== null && unidades.length === 0) return [];

    const planes = await this.planes.find({
      where: {
        ...(filtro.idPuesto !== undefined && { idPuesto: filtro.idPuesto }),
        ...(filtro.estado !== undefined && {
          estadoPlan: { codigo: filtro.estado },
        }),
        ...(unidades !== null && { puesto: { idUnidad: In(unidades) } }),
      },
      relations: RELACIONES,
      order: { id: 'DESC' },
    });
    return this.aDtos(this.planes.manager, planes);
  }

  async buscar(id: number, sesion: SesionUsuario): Promise<PlanDto> {
    const plan = await this.planes.findOne({
      where: { id },
      relations: RELACIONES,
    });
    if (!plan) throw new NotFoundException(`No existe el plan ${id}`);
    await this.alcance.exigirUnidad(sesion, plan.puesto.idUnidad);
    return (await this.aDtos(this.planes.manager, [plan]))[0];
  }

  /** El plan con sus candidatos y acciones. El alcance se valida en `buscar`. */
  async detalle(id: number, sesion: SesionUsuario): Promise<PlanDetalleDto> {
    const plan = await this.buscar(id, sesion);
    const [candidatos, acciones] = await Promise.all([
      this.candidatos.listarDePlan(id),
      this.acciones.listarDePlan(id),
    ]);
    return { ...plan, candidatos, acciones };
  }

  // --- auxiliares ---

  private async estados(manager: EntityManager) {
    const filas = await manager.getRepository(EstadoPlan).find();
    return {
      id: (codigo: string): number => {
        const fila = filas.find((e) => e.codigo === codigo);
        if (!fila) throw new Error(`Falta el estado de plan ${codigo}`);
        return fila.id;
      },
      codigo: (idEstado: number): string =>
        filas.find((e) => e.id === idEstado)?.codigo ?? '',
    };
  }

  /** Carga el plan y exige que su puesto esté dentro del alcance de la sesión. */
  private async cargarDeJefatura(
    manager: EntityManager,
    id: number,
    sesion: SesionUsuario,
  ): Promise<PlanSucesion> {
    const plan = await manager
      .getRepository(PlanSucesion)
      .findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`No existe el plan ${id}`);
    const puesto = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: plan.idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto del plan`);
    await this.alcance.exigirUnidad(sesion, puesto.idUnidad);
    return plan;
  }

  private exigirTransicion(
    plan: PlanSucesion,
    estados: { codigo: (id: number) => string },
    destino: string,
  ): void {
    const actual = estados.codigo(plan.idEstadoPlan);
    if (!puedePasar(TRANSICIONES_PLAN, actual, destino)) {
      throw new ConflictException(
        `Un plan ${actual} no puede pasar a ${destino}`,
      );
    }
  }

  /** Para operaciones que solo valen desde un estado (editar, reabrir, nueva versión). */
  private exigirTransicionOEstado(
    plan: PlanSucesion,
    estados: { codigo: (id: number) => string },
    requerido: string,
  ): void {
    const actual = estados.codigo(plan.idEstadoPlan);
    if (actual !== requerido) {
      throw new ConflictException(
        `La operación solo vale para un plan ${requerido}; este está ${actual}`,
      );
    }
  }

  private async exigirResponsableActivo(
    manager: EntityManager,
    idPersona: number,
  ): Promise<void> {
    const persona = await manager
      .getRepository(Persona)
      .findOne({ where: { id: idPersona } });
    if (!persona || !persona.activo) {
      throw new BadRequestException(
        'El responsable debe ser una persona existente y activa',
      );
    }
  }

  private async dtoDe(manager: EntityManager, id: number): Promise<PlanDto> {
    const plan = await manager
      .getRepository(PlanSucesion)
      .findOneOrFail({ where: { id }, relations: RELACIONES });
    return (await this.aDtos(manager, [plan]))[0];
  }

  private async aDtos(
    manager: Pick<EntityManager, 'getRepository'>,
    planes: PlanSucesion[],
  ): Promise<PlanDto[]> {
    if (planes.length === 0) return [];
    const candidatos = await manager.getRepository(CandidatoSucesion).find({
      where: { idPlan: In(planes.map((p) => p.id)) },
      select: { idPlan: true, idPersona: true },
    });
    const cuenta = new Map<number, number>();
    for (const c of candidatos) {
      cuenta.set(c.idPlan, (cuenta.get(c.idPlan) ?? 0) + 1);
    }
    return planes.map((p) => aPlanDto(p, cuenta.get(p.id) ?? 0));
  }
}
