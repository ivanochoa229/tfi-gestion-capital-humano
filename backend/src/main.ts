import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './infra/config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Gestión del conocimiento crítico')
      .setDescription('API del sistema de conocimiento crítico y sucesión')
      .setVersion('0.1.0')
      .build(),
  );
  // Interfaz en /api/docs y especificación en /api/docs-json, de donde el
  // frontend genera sus tipos.
  SwaggerModule.setup('api/docs', app, documento, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
