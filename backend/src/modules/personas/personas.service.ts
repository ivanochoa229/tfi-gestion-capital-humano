import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository, type FindOptionsWhere } from 'typeorm';
import { escaparLike } from '../../common/like.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { ReferenciaService } from '../referencia/referencia.service.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { exigirAccesoAPersona } from './acceso.js';
import type { ActualizarPersonaDto } from './dto/actualizar-persona.dto.js';
import type { CrearPersonaDto } from './dto/crear-persona.dto.js';
import type { FiltroPersonasDto } from './dto/filtro-personas.dto.js';
import type {
  PersonaDetalleDto,
  PersonaDto,
  ResultadoBajaPersonaDto,
} from './dto/persona.dto.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import {
  estaAbierta,
  estadoDe,
  hoyDeLaBase,
  validarFechasDePersona,
} from './fechas.js';
import { aOcupacionDto } from './ocupacion.mapper.js';
import { aPersonaDto, puedeVerDatosPersonales } from './persona.mapper.js';
import { DOMINIO_SITUACION_REVISTA } from './personas.constantes.js';
import { enTransaccionDePersonas } from './transaccion.js';

/** Único campo de la persona que admite `null` en una modificación. */
const CAMPOS_NULABLES = new Set(['fechaPrevistaRetiro']);

function cambios(dto: ActualizarPersonaDto): Partial<Persona> {
  const resultado: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(dto)) {
    if (valor === undefined) continue;
    if (valor === null && !CAMPOS_NULABLES.has(campo)) {
      throw new BadRequestException(`${campo} no admite null`);
    }
    resultado[campo] = valor;
  }
  return resultado as Partial<Persona>;
}

/** Personas del departamento (RF06). Las escrituras corren con el bloqueo de estructura. */
@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona) private readonly personas: Repository<Persona>,
    @InjectRepository(Ocupacion)
    private readonly ocupaciones: Repository<Ocupacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly referencia: ReferenciaService,
  ) {}

  async listar(
    filtro: FiltroPersonasDto,
    sesion: SesionUsuario,
  ): Promise<PersonaDto[]> {
    const base: FindOptionsWhere<Persona> = {};
    if (filtro.activo !== undefined) base.activo = filtro.activo;
    const texto = filtro.q?.trim();
    const patron = texto ? `%${escaparLike(texto)}%` : undefined;
    const filas = await this.personas.find({
      where: patron
        ? [
            { ...base, legajo: ILike(patron) },
            { ...base, apellido: ILike(patron) },
            { ...base, nombre: ILike(patron) },
          ]
        : base,
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    const conUsuario = await this.idsConUsuario();
    const verSensibles = puedeVerDatosPersonales(sesion.rol);
    return filas
      .filter((p) => filtro.sinUsuario !== true || !conUsuario.has(p.id))
      .map((p) =>
        aPersonaDto(p, { verSensibles, tieneUsuario: conUsuario.has(p.id) }),
      );
  }

  async obtener(id: number, sesion: SesionUsuario): Promise<PersonaDetalleDto> {
    exigirAccesoAPersona(sesion, id);
    return this.detalle(id, puedeVerDatosPersonales(sesion.rol));
  }

  async crear(dto: CrearPersonaDto): Promise<PersonaDetalleDto> {
    validarFechasDePersona(
      dto.fechaNacimiento,
      dto.fechaIngreso,
      dto.fechaPrevistaRetiro ?? null,
    );
    await this.referencia.validarActivo(
      DOMINIO_SITUACION_REVISTA,
      dto.idSituacionRevista,
    );
    const id = await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      await this.exigirIdentidadLibre(repo, dto.legajo, dto.documento);
      const creada = await repo.save(
        repo.create({
          legajo: dto.legajo,
          apellido: dto.apellido,
          nombre: dto.nombre,
          documento: dto.documento,
          fechaNacimiento: dto.fechaNacimiento,
          fechaIngreso: dto.fechaIngreso,
          idSituacionRevista: dto.idSituacionRevista,
          fechaPrevistaRetiro: dto.fechaPrevistaRetiro ?? null,
          activo: true,
        }),
      );
      return creada.id;
    });
    // Solo RR. HH. escribe, y RR. HH. ve los datos personales.
    return this.detalle(id, true);
  }

  async actualizar(
    id: number,
    dto: ActualizarPersonaDto,
  ): Promise<PersonaDetalleDto> {
    const nuevos = cambios(dto);
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      const final = { ...persona, ...nuevos };
      validarFechasDePersona(
        final.fechaNacimiento,
        final.fechaIngreso,
        final.fechaPrevistaRetiro,
      );
      if (
        dto.idSituacionRevista !== undefined &&
        dto.idSituacionRevista !== persona.idSituacionRevista
      ) {
        await this.referencia.validarActivo(
          DOMINIO_SITUACION_REVISTA,
          dto.idSituacionRevista,
        );
      }
      if (
        final.legajo !== persona.legajo ||
        final.documento !== persona.documento
      ) {
        await this.exigirIdentidadLibre(
          repo,
          final.legajo,
          final.documento,
          id,
        );
      }
      await repo.save(Object.assign(persona, nuevos));
    });
    return this.detalle(id, true);
  }

  /** Baja lógica. Se bloquea mientras tenga ocupaciones vigentes o futuras. */
  async darDeBaja(id: number): Promise<ResultadoBajaPersonaDto> {
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      if (!persona.activo) return;

      const hoy = await hoyDeLaBase(manager);
      const abiertas = (
        await manager.getRepository(Ocupacion).find({
          where: { idPersona: id },
          relations: { puesto: true },
        })
      ).filter((o) => estaAbierta(o, hoy));
      if (abiertas.length > 0) {
        throw new ConflictException(
          `No se puede dar de baja: tiene ocupaciones vigentes o futuras (${abiertas
            .map((o) => `${o.puesto.codigo} desde ${o.fechaDesde}`)
            .join(', ')}). Cerralas o anulalas primero`,
        );
      }
      persona.activo = false;
      await repo.save(persona);
    });
    const persona = await this.detalle(id, true);
    const advertencias = persona.tieneUsuario
      ? [
          'La persona tiene un usuario vinculado que sigue activo: pedile al administrador que lo desactive',
        ]
      : [];
    return { persona, advertencias };
  }

  async reactivar(id: number): Promise<PersonaDetalleDto> {
    await enTransaccionDePersonas(this.personas, async (manager) => {
      const repo = manager.getRepository(Persona);
      const persona = await this.buscar(repo, id);
      if (persona.activo) return;
      persona.activo = true;
      await repo.save(persona);
    });
    return this.detalle(id, true);
  }

  /** Para vincular un usuario: la persona debe existir y no estar dada de baja. */
  async exigirActiva(idPersona: number): Promise<void> {
    const persona = await this.personas.findOne({ where: { id: idPersona } });
    if (!persona) {
      throw new BadRequestException(`La persona ${idPersona} no existe`);
    }
    if (!persona.activo) {
      throw new BadRequestException(
        `La persona ${persona.apellido}, ${persona.nombre} está dada de baja y no puede vincularse a un usuario`,
      );
    }
  }

  private async detalle(
    id: number,
    verSensibles: boolean,
  ): Promise<PersonaDetalleDto> {
    const persona = await this.buscar(this.personas, id);
    const hoy = await hoyDeLaBase(this.personas.manager);
    const ocupaciones = await this.ocupaciones.find({
      where: { idPersona: id },
      order: { fechaDesde: 'DESC' },
    });
    const tieneUsuario =
      (await this.usuarios.count({ where: { idPersona: id } })) > 0;
    return {
      ...aPersonaDto(persona, { verSensibles, tieneUsuario }),
      ocupacionesVigentes: ocupaciones
        .filter((o) => estadoDe(o, hoy) === 'vigente')
        .map((o) => aOcupacionDto(o, hoy)),
    };
  }

  private async idsConUsuario(): Promise<Set<number>> {
    const vinculados = await this.usuarios.find({
      select: { idPersona: true },
      where: { idPersona: Not(IsNull()) },
    });
    return new Set(vinculados.map((u) => u.idPersona as number));
  }

  /** `repo` puede ser el de una transacción en curso. */
  private async buscar(
    repo: Repository<Persona>,
    id: number,
  ): Promise<Persona> {
    const persona = await repo.findOne({ where: { id } });
    if (!persona) throw new NotFoundException(`No existe la persona ${id}`);
    return persona;
  }

  /** Legajo y documento únicos; el mensaje nombra a quien ya los tiene. */
  private async exigirIdentidadLibre(
    repo: Repository<Persona>,
    legajo: string,
    documento: string,
    idExcluido?: number,
  ): Promise<void> {
    const repetidas = (
      await repo.find({ where: [{ legajo }, { documento }] })
    ).filter((p) => p.id !== idExcluido);
    const porLegajo = repetidas.find((p) => p.legajo === legajo);
    if (porLegajo) {
      throw new ConflictException(
        `El legajo ${legajo} ya lo tiene ${porLegajo.apellido}, ${porLegajo.nombre}`,
      );
    }
    const porDocumento = repetidas.find((p) => p.documento === documento);
    if (porDocumento) {
      throw new ConflictException(
        `El documento ${documento} ya lo tiene ${porDocumento.apellido}, ${porDocumento.nombre} (legajo ${porDocumento.legajo})`,
      );
    }
  }
}
