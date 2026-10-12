import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { TODOS_LOS_ROLES } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AuthService } from './auth.service.js';
import { CambiarClaveDto } from './dto/cambiar-clave.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SesionDto } from './dto/sesion.dto.js';
import { LocalAuthGuard } from './local-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: SesionDto })
  @ApiUnauthorizedResponse({ description: 'Usuario o clave incorrectos' })
  login(@UsuarioActual() usuario: SesionUsuario): SesionDto {
    return usuario;
  }

  @Post('logout')
  @Roles(...TODOS_LOS_ROLES)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  logout(@Req() req: Request): Promise<void> {
    return new Promise((resolver, rechazar) =>
      req.logout((error) => (error ? rechazar(error) : resolver())),
    );
  }

  @Get('yo')
  @Roles(...TODOS_LOS_ROLES)
  @ApiOkResponse({ type: SesionDto })
  yo(@UsuarioActual() usuario: SesionUsuario): SesionDto {
    return usuario;
  }

  @Patch('clave')
  @Roles(...TODOS_LOS_ROLES)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Clave cambiada' })
  cambiarClave(
    @UsuarioActual() usuario: SesionUsuario,
    @Body() dto: CambiarClaveDto,
  ): Promise<void> {
    return this.auth.cambiarClave(usuario.id, dto.claveActual, dto.claveNueva);
  }
}
