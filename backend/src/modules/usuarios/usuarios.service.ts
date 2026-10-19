import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES, ROLES_CON_ALCANCE_POR_UNIDAD } from '../../common/roles.js';
import type { CodigoRol } from '../../common/roles.js';
import { TIPOS_UNIDAD } from '../estructura/estructura.constantes.js';
import { UnidadesService } from '../estructura/unidades.service.js';
import { PersonasService } from '../personas/personas.service.js';
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import type { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import type { RolDto } from './dto/rol.dto.js';
import type { UsuarioDto } from './dto/usuario.dto.js';
import { Rol } from './entities/rol.entity.js';
import { UsuarioUnidad } from './entities/usuario-unidad.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { normalizarNombreUsuario } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SesionesService } from './sesiones.service.js';

/** Clave del bloqueo que serializa los cambios que pueden dejar sin administradores. */
const BLOQUEO_ADMINISTRADORES = 7001;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    private readonly passwords: PasswordService,
    private readonly sesiones: SesionesService,
    private readonly unidadesEstructura: UnidadesService,
    private readonly personas: PersonasService,
  ) {}

  async listar(): Promise<UsuarioDto[]> {
    const todos = await this.usuarios.find({
      relations: { rol: true, unidades: true },
      order: { nombreUsuario: 'ASC' },
    });
    return todos.map((u) => this.aDto(u));
  }

  async listarRoles(): Promise<RolDto[]> {
    const roles = await this.roles.find({ order: { id: 'ASC' } });
    return roles.map(({ codigo, denominacion }) => ({ codigo, denominacion }));
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioDto> {
    const nombreUsuario = normalizarNombreUsuario(dto.nombreUsuario);
    if (await this.usuarios.findOne({ where: { nombreUsuario } })) {
      throw new ConflictException(`Ya existe el usuario "${nombreUsuario}"`);
    }
    const rol = await this.buscarRol(dto.rol);
    const idPersona = dto.idPersona ?? null;
    this.validarReglasDeRol(dto.rol, idPersona, dto.idUnidades ?? []);
    await this.validarUnidades(dto.rol, dto.idUnidades ?? []);
    await this.validarPersona(idPersona);

    const claveHash = await this.passwords.hashear(dto.clave);
    // `usuario_unidad` necesita el id del usuario, que existe recién al insertarlo.
    return this.usuarios.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const creado = await repo.save(
        repo.create({
          nombreUsuario,
          claveHash,
          rol,
          idPersona,
          activo: true,
          unidades: [],
        }),
      );
      creado.unidades = this.unidades(dto.idUnidades ?? [], creado.id);
      return this.aDto(await repo.save(creado));
    });
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto): Promise<UsuarioDto> {
    const usuario = await this.obtener(id);

    const rolFinal = (dto.rol ?? usuario.rol.codigo) as CodigoRol;
    const idPersonaFinal =
      dto.idPersona === undefined ? usuario.idPersona : dto.idPersona;
    const unidadesFinales =
      dto.idUnidades ?? usuario.unidades.map((u) => u.idUnidad);
    this.validarReglasDeRol(rolFinal, idPersonaFinal, unidadesFinales);
    if (dto.idUnidades !== undefined || dto.rol !== undefined) {
      await this.validarUnidades(
        rolFinal,
        unidadesFinales,
        usuario.unidades.map((u) => u.idUnidad),
      );
    }

    if (dto.nombreUsuario) {
      const nombreUsuario = normalizarNombreUsuario(dto.nombreUsuario);
      if (nombreUsuario !== usuario.nombreUsuario) {
        const repetido = await this.usuarios.findOne({
          where: { nombreUsuario },
        });
        if (repetido) {
          throw new ConflictException(
            `Ya existe el usuario "${nombreUsuario}"`,
          );
        }
      }
      usuario.nombreUsuario = nombreUsuario;
    }
    if (idPersonaFinal !== usuario.idPersona) {
      await this.validarPersona(idPersonaFinal);
    }

    const dejaDeSerAdminActivo =
      usuario.rol.codigo === ROLES.administrador &&
      usuario.activo &&
      (dto.activo === false || rolFinal !== ROLES.administrador);
    if (dto.rol) usuario.rol = await this.buscarRol(dto.rol);
    if (dto.idPersona !== undefined) usuario.idPersona = dto.idPersona;
    if (dto.activo !== undefined) usuario.activo = dto.activo;
    if (dto.idUnidades)
      usuario.unidades = this.unidades(dto.idUnidades, usuario.id);

    if (!dejaDeSerAdminActivo)
      return this.aDto(await this.usuarios.save(usuario));

    // El bloqueo evita que dos pedidos simultáneos desactiven a los dos últimos
    // administradores: el segundo espera, ve el conteo actualizado y es rechazado.
    return this.usuarios.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        BLOQUEO_ADMINISTRADORES,
      ]);
      const repo = manager.getRepository(Usuario);
      await this.exigirOtroAdministradorActivo(repo);
      return this.aDto(await repo.save(usuario));
    });
  }

  async restablecerClave(id: number, clave: string): Promise<void> {
    await this.obtener(id);
    await this.usuarios.update(id, {
      claveHash: await this.passwords.hashear(clave),
    });
    await this.sesiones.cerrarDe(id);
  }

  private async obtener(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: { rol: true, unidades: true },
    });
    if (!usuario) throw new NotFoundException(`No existe el usuario ${id}`);
    return usuario;
  }

  private async buscarRol(codigo: string): Promise<Rol> {
    const rol = await this.roles.findOne({ where: { codigo } });
    if (!rol) throw new BadRequestException(`El rol "${codigo}" no existe`);
    return rol;
  }

  private validarReglasDeRol(
    rol: CodigoRol,
    idPersona: number | null,
    idUnidades: number[],
  ): void {
    if (rol === ROLES.docente && idPersona === null) {
      throw new BadRequestException(
        'El rol docente requiere una persona vinculada',
      );
    }
    if (idUnidades.length > 0 && !ROLES_CON_ALCANCE_POR_UNIDAD.includes(rol)) {
      throw new BadRequestException(
        'Solo la jefatura de departamento y el jefe de cátedra tienen unidades a cargo',
      );
    }
  }

  /**
   * Cada unidad debe existir y ser del tipo que corresponde al rol: cátedras para
   * el jefe de cátedra, departamento para la jefatura. Las nuevas asignaciones
   * además deben estar activas; las ya asignadas (`yaAsignadas`) pueden haberse
   * desactivado después y no deben impedir editar al usuario ni quitarlas.
   */
  private async validarUnidades(
    rol: CodigoRol,
    idUnidades: number[],
    yaAsignadas: number[] = [],
  ): Promise<void> {
    if (idUnidades.length === 0) return;
    const tipoEsperado =
      rol === ROLES.jefeCatedra
        ? TIPOS_UNIDAD.catedra
        : TIPOS_UNIDAD.departamento;
    const encontradas = new Map(
      (await this.unidadesEstructura.buscarPorIds(idUnidades)).map((u) => [
        u.id,
        u,
      ]),
    );
    for (const id of idUnidades) {
      const unidad = encontradas.get(id);
      if (!unidad) throw new BadRequestException(`La unidad ${id} no existe`);
      if (!unidad.activo && !yaAsignadas.includes(id)) {
        throw new BadRequestException(
          `La unidad "${unidad.denominacion}" está inactiva`,
        );
      }
      if (unidad.tipo.codigo !== tipoEsperado) {
        throw new BadRequestException(
          `La unidad "${unidad.denominacion}" no es de tipo ${tipoEsperado}: el rol ${rol} solo admite unidades de ese tipo`,
        );
      }
    }
  }

  /** La persona debe existir y estar activa (400) y no estar vinculada a otro usuario (409). */
  private async validarPersona(idPersona: number | null): Promise<void> {
    if (idPersona === null) return;
    await this.personas.exigirActiva(idPersona);
    if (await this.usuarios.findOne({ where: { idPersona } })) {
      throw new ConflictException(
        'Esa persona ya está vinculada a otro usuario',
      );
    }
  }

  private async exigirOtroAdministradorActivo(
    repo: Repository<Usuario>,
  ): Promise<void> {
    const activos = await repo.count({
      where: { activo: true, rol: { codigo: ROLES.administrador } },
    });
    if (activos <= 1) {
      throw new ConflictException(
        'No se puede desactivar ni cambiar de rol al último administrador activo',
      );
    }
  }

  private unidades(idUnidades: number[], idUsuario?: number): UsuarioUnidad[] {
    return idUnidades.map(
      (idUnidad) => ({ idUnidad, idUsuario }) as UsuarioUnidad,
    );
  }

  private aDto(usuario: Usuario): UsuarioDto {
    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol.codigo as CodigoRol,
      idPersona: usuario.idPersona,
      idUnidades: (usuario.unidades ?? []).map((u) => u.idUnidad),
      activo: usuario.activo,
    };
  }
}
