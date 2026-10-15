import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import { ConocimientosController } from './conocimientos.controller.js';
import { ConocimientosService } from './conocimientos.service.js';
import { DeclaracionesService } from './declaraciones.service.js';
import { Acreditacion } from './entities/acreditacion.entity.js';
import { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { Conocimiento } from './entities/conocimiento.entity.js';
import { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { PerfilConocimientoController } from './perfil-conocimiento.controller.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import { RequisitosController } from './requisitos.controller.js';
import { RequisitosService } from './requisitos.service.js';

/**
 * Catálogo de conocimientos, requisitos de puesto y conocimiento de las
 * personas (RF08–RF10). Importa `UsuariosModule` por `AlcanceService`; no hay
 * ciclo, porque ningún módulo importa a este.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conocimiento,
      RequisitoPuesto,
      ConocimientoPersona,
      Acreditacion,
      Persona,
      Puesto,
    ]),
    ReferenciaModule,
    UsuariosModule,
  ],
  controllers: [
    ConocimientosController,
    RequisitosController,
    PerfilConocimientoController,
  ],
  providers: [
    ConocimientosService,
    RequisitosService,
    DeclaracionesService,
    AcreditacionesService,
    PerfilConocimientoService,
    AccesoPerfilService,
  ],
})
export class ConocimientoModule {}
