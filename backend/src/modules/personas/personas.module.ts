import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Puesto } from '../estructura/entities/puesto.entity.js';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { OcupacionesController } from './ocupaciones.controller.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { PersonasController } from './personas.controller.js';
import { PersonasService } from './personas.service.js';

/**
 * Personas y ocupaciones (RF06–RF07). Registra `Usuario` solo para consultar
 * qué personas ya tienen usuario: no importa `UsuariosModule`, que importa a este.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Ocupacion, Usuario, Puesto]),
    ReferenciaModule,
  ],
  controllers: [PersonasController, OcupacionesController],
  providers: [PersonasService, OcupacionesService],
  exports: [PersonasService],
})
export class PersonasModule {}
