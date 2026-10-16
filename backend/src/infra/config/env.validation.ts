import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Variables de entorno que necesita el backend. Si falta alguna o tiene un
 * formato inválido, la aplicación no arranca y muestra cuál es.
 */
export class Env {
  @Type(() => Number)
  @IsInt()
  PORT: number = 3000;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string = 'http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  /** Ejecuta las migraciones pendientes al iniciar la aplicación. */
  @Transform(({ value }) =>
    value === undefined ? true : value === true || value === 'true',
  )
  @IsBoolean()
  DB_MIGRATIONS_RUN: boolean = true;

  @IsUrl({ require_tld: false, require_protocol: true })
  S3_ENDPOINT: string;

  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  S3_BUCKET: string;

  /** Tamaño máximo de un archivo de activo de conocimiento, en MB. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  ACTIVOS_TAMANIO_MAX_MB: number = 20;

  /** Firma la cookie de sesión. */
  @IsString()
  @MinLength(32)
  SESION_SECRETO: string;

  /** Usuario y clave del primer administrador; solo se usan si no hay usuarios. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  ADMIN_USUARIO?: string;

  @IsOptional()
  @IsString()
  ADMIN_CLAVE?: string;
}

export function validarEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errores = validateSync(env, { skipMissingProperties: false });
  if (errores.length > 0) {
    const detalle = errores
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return env;
}
