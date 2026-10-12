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
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import type { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import type { RolDto } from './dto/rol.dto.js';
import type { UsuarioDto } from './dto/usuario.dto.js';
import { Rol } from './entities/rol.entity.js';
import { UsuarioUnidad } from './entities/usuario-unidad.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { normalizarNombreUsuario } from './auth.service.js';
import { PasswordService } from './password.service.js';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    private readonly passwords: PasswordService,
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
    await this.validarPersonaLibre(idPersona);

    const creado = await this.usuarios.save(
      this.usuarios.create({
        nombreUsuario,
        claveHash: await this.passwords.hashear(dto.clave),
        rol,
        idPersona,
        activo: true,
        unidades: this.unidades(dto.idUnidades ?? []),
      }),
    );
    return this.aDto(creado);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto): Promise<UsuarioDto> {
    const usuario = await this.obtener(id);

    const rolFinal = (dto.rol ?? usuario.rol.codigo) as CodigoRol;
    const idPersonaFinal =
      dto.idPersona === undefined ? usuario.idPersona : dto.idPersona;
    const unidadesFinales =
      dto.idUnidades ?? usuario.unidades.map((u) => u.idUnidad);
    this.validarReglasDeRol(rolFinal, idPersonaFinal, unidadesFinales);

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
      await this.validarPersonaLibre(idPersonaFinal);
    }

    const dejaDeSerAdminActivo =
      usuario.rol.codigo === ROLES.administrador &&
      usuario.activo &&
      (dto.activo === false || rolFinal !== ROLES.administrador);
    if (dejaDeSerAdminActivo) await this.exigirOtroAdministradorActivo();

    if (dto.rol) usuario.rol = await this.buscarRol(dto.rol);
    if (dto.idPersona !== undefined) usuario.idPersona = dto.idPersona;
    if (dto.activo !== undefined) usuario.activo = dto.activo;
    if (dto.idUnidades)
      usuario.unidades = this.unidades(dto.idUnidades, usuario.id);

    return this.aDto(await this.usuarios.save(usuario));
  }

  async restablecerClave(id: number, clave: string): Promise<void> {
    await this.obtener(id);
    await this.usuarios.update(id, {
      claveHash: await this.passwords.hashear(clave),
    });
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

  private async validarPersonaLibre(idPersona: number | null): Promise<void> {
    if (idPersona === null) return;
    if (await this.usuarios.findOne({ where: { idPersona } })) {
      throw new ConflictException(
        'Esa persona ya está vinculada a otro usuario',
      );
    }
  }

  private async exigirOtroAdministradorActivo(): Promise<void> {
    const activos = await this.usuarios.count({
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
