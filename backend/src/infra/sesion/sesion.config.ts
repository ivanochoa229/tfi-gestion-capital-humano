import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import passport from 'passport';
import type { Env } from '../config/env.validation.js';

const OCHO_HORAS = 8 * 60 * 60 * 1000;

/** Sesión en PostgreSQL (tabla `sesion`) y Passport; debe ir antes de las rutas. */
export function configurarSesion(
  app: INestApplication,
  config: ConfigService<Env, true>,
): void {
  const AlmacenPg = connectPgSimple(session);

  app.use(
    session({
      store: new AlmacenPg({
        conObject: {
          host: config.get('DB_HOST', { infer: true }),
          port: config.get('DB_PORT', { infer: true }),
          database: config.get('DB_NAME', { infer: true }),
          user: config.get('DB_USER', { infer: true }),
          password: config.get('DB_PASSWORD', { infer: true }),
        },
        tableName: 'sesion',
      }),
      secret: config.get('SESION_SECRETO', { infer: true }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: OCHO_HORAS },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
}
