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
import { ReferenciaService } from '../referencia/referencia.service.js';
import { exigirAccesoAPersona } from './acceso.js';
import type { ActualizarOcupacionDto } from './dto/actualizar-ocupacion.dto.js';
import type { CerrarOcupacionDto } from './dto/cerrar-ocupacion.dto.js';
import type { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import type { OcupacionDto, OcupanteDto } from './dto/ocupacion.dto.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import {
  esFechaValida,
  estadoDe,
  hoyDeLaBase,
  seSolapan,
  validarRango,
  type FechaISO,
} from './fechas.js';
import { aOcupacionDto, aOcupanteDto } from './ocupacion.mapper.js';
import {
  DOMINIO_CARACTER_OCUPACION,
  DOMINIO_DEDICACION,
} from './personas.constantes.js';
import { enTransaccionDePersonas } from './transaccion.js';

/** Campos que no admiten `null` en una modificación (`fechaHasta` sí: reabre la ocupación). */
const CAMPOS_OBLIGATORIOS = ['idCaracterOcupacion', 'idDedicacion'] as const;

const describir = (o: { fechaDesde: FechaISO; fechaHasta: FechaISO | null }) =>
  o.fechaHasta === null
    ? `desde ${o.fechaDesde}, sin fecha de fin`
    : `del ${o.fechaDesde} al ${o.fechaHasta}`;

/** Ocupaciones de puestos con vigencia (RF07). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class OcupacionesService {
  constructor(
    @InjectRepository(Ocupacion)
    private readonly ocupaciones: Repository<Ocupacion>,
    @InjectRepository(Persona) private readonly personas: Repository<Persona>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listarDePersona(
    idPersona: number,
    sesion: SesionUsuario,
  ): Promise<OcupacionDto[]> {
    exigirAccesoAPersona(sesion, idPersona);
    await this.exigirPersona(this.personas, idPersona);
    const hoy = await hoyDeLaBase(this.ocupaciones.manager);
    const filas = await this.ocupaciones.find({
      where: { idPersona },
      order: { fechaDesde: 'DESC' },
    });
    return filas.map((o) => aOcupacionDto(o, hoy));
  }

  /** Quiénes ocupan hoy el puesto. */
  async listarDePuesto(idPuesto: number): Promise<OcupanteDto[]> {
    const puesto = await this.puestos.findOne({ where: { id: idPuesto } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${idPuesto}`);
    const hoy = await hoyDeLaBase(this.ocupaciones.manager);
    const filas = await this.ocupaciones.find({
      where: { idPuesto },
      relations: { persona: true },
    });
    return filas
      .filter((o) => estadoDe(o, hoy) === 'vigente')
      .map((o) => aOcupanteDto(o, hoy))
      .sort(
        (a, b) =>
          a.apellido.localeCompare(b.apellido, 'es') ||
          a.nombre.localeCompare(b.nombre, 'es'),
      );
  }

  async crear(
    idPersona: number,
    dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    await this.validarAlta(dto);
    return enTransaccionDePersonas(this.ocupaciones, (manager) =>
      this.crearCon(manager, idPersona, dto),
    );
  }

  /** Validaciones del alta que no necesitan la transacción. */
  async validarAlta(dto: CrearOcupacionDto): Promise<void> {
    validarRango(dto.fechaDesde, dto.fechaHasta ?? null);
    await this.referencia.validarActivo(
      DOMINIO_CARACTER_OCUPACION,
      dto.idCaracterOcupacion,
    );
    await this.referencia.validarActivo(DOMINIO_DEDICACION, dto.idDedicacion);
  }

  /**
   * Cuerpo del alta: corre sobre el `manager` recibido y no abre transacción
   * propia (lo usa la importación masiva dentro de la suya). Llamar antes a
   * `validarAlta`.
   */
  async crearCon(
    manager: EntityManager,
    idPersona: number,
    dto: CrearOcupacionDto,
  ): Promise<OcupacionDto> {
    const fechaHasta = dto.fechaHasta ?? null;
    const persona = await this.exigirPersona(
      manager.getRepository(Persona),
      idPersona,
    );
    if (!persona.activo) {
      throw new BadRequestException(
        `${persona.apellido}, ${persona.nombre} está dada de baja y no admite ocupaciones nuevas`,
      );
    }
    const puesto = await manager
      .getRepository(Puesto)
      .findOne({ where: { id: dto.idPuesto } });
    if (!puesto) {
      throw new BadRequestException(`El puesto ${dto.idPuesto} no existe`);
    }
    if (!puesto.activo) {
      throw new BadRequestException(
        `El puesto ${puesto.codigo} está dado de baja`,
      );
    }

    const repo = manager.getRepository(Ocupacion);
    await this.exigirSinSolape(repo, {
      idPersona,
      idPuesto: dto.idPuesto,
      fechaDesde: dto.fechaDesde,
      fechaHasta,
    });
    const creada = await repo.save(
      repo.create({
        idPersona,
        idPuesto: dto.idPuesto,
        fechaDesde: dto.fechaDesde,
        fechaHasta,
        idCaracterOcupacion: dto.idCaracterOcupacion,
        idDedicacion: dto.idDedicacion,
      }),
    );
    return aOcupacionDto(creada, await hoyDeLaBase(manager));
  }

  /** Solo ocupaciones vigentes o futuras; una pasada es historial inmutable. */
  async actualizar(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
    dto: ActualizarOcupacionDto,
  ): Promise<OcupacionDto> {
    for (const campo of CAMPOS_OBLIGATORIOS) {
      if (dto[campo] === null) {
        throw new BadRequestException(`${campo} no admite null`);
      }
    }
    return enTransaccionDePersonas(this.ocupaciones, async (manager) => {
      const repo = manager.getRepository(Ocupacion);
      const ocupacion = await this.buscar(
        repo,
        idPersona,
        idPuesto,
        fechaDesde,
      );
      const hoy = await hoyDeLaBase(manager);
      if (estadoDe(ocupacion, hoy) === 'pasada') {
        throw new ConflictException(
          `La ocupación terminó el ${ocupacion.fechaHasta} y forma parte del historial: no se modifica`,
        );
      }

      if (
        dto.idCaracterOcupacion !== undefined &&
        dto.idCaracterOcupacion !== ocupacion.idCaracterOcupacion
      ) {
        await this.referencia.validarActivo(
          DOMINIO_CARACTER_OCUPACION,
          dto.idCaracterOcupacion,
        );
      }
      if (
        dto.idDedicacion !== undefined &&
        dto.idDedicacion !== ocupacion.idDedicacion
      ) {
        await this.referencia.validarActivo(
          DOMINIO_DEDICACION,
          dto.idDedicacion,
        );
      }
      const fechaHasta =
        dto.fechaHasta === undefined ? ocupacion.fechaHasta : dto.fechaHasta;
      validarRango(ocupacion.fechaDesde, fechaHasta);
      await this.exigirSinSolape(
        repo,
        { ...ocupacion, fechaHasta },
        ocupacion.fechaDesde,
      );

      ocupacion.fechaHasta = fechaHasta;
      if (dto.idCaracterOcupacion !== undefined) {
        ocupacion.idCaracterOcupacion = dto.idCaracterOcupacion;
      }
      if (dto.idDedicacion !== undefined)
        ocupacion.idDedicacion = dto.idDedicacion;
      const guardada = await repo.save(ocupacion);
      return aOcupacionDto(guardada, hoy);
    });
  }

  cerrar(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
    dto: CerrarOcupacionDto,
  ): Promise<OcupacionDto> {
    return this.actualizar(idPersona, idPuesto, fechaDesde, {
      fechaHasta: dto.fechaHasta,
    });
  }

  /** Solo las que todavía no empezaron (error de carga); el resto se cierra. */
  async anular(
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
  ): Promise<void> {
    await enTransaccionDePersonas(this.ocupaciones, async (manager) => {
      const repo = manager.getRepository(Ocupacion);
      const ocupacion = await this.buscar(
        repo,
        idPersona,
        idPuesto,
        fechaDesde,
      );
      const hoy = await hoyDeLaBase(manager);
      if (estadoDe(ocupacion, hoy) !== 'futura') {
        throw new ConflictException(
          'Solo se pueden anular ocupaciones que todavía no empezaron; para terminar una vigente, cerrala con una fecha de fin',
        );
      }
      await repo.delete({ idPersona, idPuesto, fechaDesde });
    });
  }

  private async buscar(
    repo: Repository<Ocupacion>,
    idPersona: number,
    idPuesto: number,
    fechaDesde: FechaISO,
  ): Promise<Ocupacion> {
    if (!esFechaValida(fechaDesde)) {
      throw new BadRequestException(
        'fechaDesde debe ser una fecha AAAA-MM-DD válida',
      );
    }
    const ocupacion = await repo.findOne({
      where: { idPersona, idPuesto, fechaDesde },
    });
    if (!ocupacion) {
      throw new NotFoundException(
        `La persona ${idPersona} no tiene una ocupación del puesto ${idPuesto} que empiece el ${fechaDesde}`,
      );
    }
    return ocupacion;
  }

  private async exigirPersona(
    repo: Pick<Repository<Persona>, 'findOne'>,
    idPersona: number,
  ): Promise<Persona> {
    const persona = await repo.findOne({ where: { id: idPersona } });
    if (!persona)
      throw new NotFoundException(`No existe la persona ${idPersona}`);
    return persona;
  }

  /**
   * Mensaje legible antes de que la restricción de exclusión de la base
   * (el respaldo) rechace el solape. `fechaDesdeExcluida` deja afuera a la
   * propia ocupación que se está modificando.
   */
  private async exigirSinSolape(
    repo: Repository<Ocupacion>,
    nueva: Pick<
      Ocupacion,
      'idPersona' | 'idPuesto' | 'fechaDesde' | 'fechaHasta'
    >,
    fechaDesdeExcluida?: FechaISO,
  ): Promise<void> {
    const delPuesto = await repo.find({
      where: { idPersona: nueva.idPersona, idPuesto: nueva.idPuesto },
    });
    const choque = delPuesto.find(
      (o) => o.fechaDesde !== fechaDesdeExcluida && seSolapan(o, nueva),
    );
    if (choque) {
      throw new ConflictException(
        `La persona ya ocupa ese puesto ${describir(choque)}: las fechas no pueden superponerse`,
      );
    }
  }
}
