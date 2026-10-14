import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenciaModule } from '../referencia/referencia.module.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';
import { PersonasController } from './personas.controller.js';
import { PersonasService } from './personas.service.js';

/**
 * Personas y ocupaciones (RF06–RF07). Registra `Usuario` solo para consultar
 * qué personas ya tienen usuario: no importa `UsuariosModule`, que importa a este.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Ocupacion, Usuario]),
    ReferenciaModule,
  ],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
