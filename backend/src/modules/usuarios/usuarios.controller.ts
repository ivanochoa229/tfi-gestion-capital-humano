import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES } from '../../common/roles.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { RestablecerClaveDto } from './dto/restablecer-clave.dto.js';
import { RolDto } from './dto/rol.dto.js';
import { UsuarioDto } from './dto/usuario.dto.js';
import { UsuariosService } from './usuarios.service.js';

/** Gestión de usuarios y roles (RF22): solo el administrador. */
@ApiTags('usuarios')
@Controller('usuarios')
@Roles(ROLES.administrador)
export class UsuariosController {
  constructor(private readonly servicio: UsuariosService) {}

  @Get()
  @ApiOkResponse({ type: UsuarioDto, isArray: true })
  listar(): Promise<UsuarioDto[]> {
    return this.servicio.listar();
  }

  @Get('roles')
  @ApiOkResponse({ type: RolDto, isArray: true })
  listarRoles(): Promise<RolDto[]> {
    return this.servicio.listarRoles();
  }

  @Post()
  @ApiCreatedResponse({ type: UsuarioDto })
  @ApiConflictResponse({ description: 'Usuario o persona repetidos' })
  crear(@Body() dto: CrearUsuarioDto): Promise<UsuarioDto> {
    return this.servicio.crear(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UsuarioDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe' })
  @ApiConflictResponse({
    description: 'Duplicado o último administrador activo',
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
  ): Promise<UsuarioDto> {
    return this.servicio.actualizar(id, dto);
  }

  @Post(':id/restablecer-clave')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Clave restablecida' })
  @ApiNotFoundResponse({ description: 'El usuario no existe' })
  restablecerClave(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestablecerClaveDto,
  ): Promise<void> {
    return this.servicio.restablecerClave(id, dto.clave);
  }
}
