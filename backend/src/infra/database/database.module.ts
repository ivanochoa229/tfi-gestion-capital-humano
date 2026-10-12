import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '../config/env.validation.js';
import { opcionesBase } from './database.config.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        ...opcionesBase({
          host: config.get('DB_HOST', { infer: true }),
          port: config.get('DB_PORT', { infer: true }),
          database: config.get('DB_NAME', { infer: true }),
          username: config.get('DB_USER', { infer: true }),
          password: config.get('DB_PASSWORD', { infer: true }),
          migrationsRun: config.get('DB_MIGRATIONS_RUN', { infer: true }),
        }),
        // Cada módulo registra sus entidades con TypeOrmModule.forFeature().
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
