import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ocupacion } from './entities/ocupacion.entity.js';
import { Persona } from './entities/persona.entity.js';

/** Personas y ocupaciones (RF06–RF07). */
@Module({
  imports: [TypeOrmModule.forFeature([Persona, Ocupacion])],
})
export class PersonasModule {}
