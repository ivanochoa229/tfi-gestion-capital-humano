Estado: Pendiente | Fecha: 2026-10-12 | PR: pendiente

# Usuarios y roles: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** incorporar usuarios, roles, sesión, alcance por unidad y bitácora de auditoría, y reemplazar el guard provisorio por `ADMIN_TOKEN`.

**Arquitectura:** módulo `modules/usuarios` (entidades, servicios de autenticación y gestión, `AlcanceService`, controllers) con guards globales en `common/guards`. La auditoría vive en `infra/auditoria` (subscriber de TypeORM más contexto por petición). La sesión es de `express-session` con store en PostgreSQL y Passport local. El frontend suma login, rutas protegidas por rol y la pestaña Usuarios.

**Stack:** NestJS 12, TypeORM, `@nestjs/passport` 12, `passport` 0.7, `passport-local`, `express-session`, `connect-pg-simple`, `argon2`; React 19, MUI, TanStack Query, react-hook-form, zod.

**Spec:** `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`

## Restricciones globales

- Nombres de dominio y de código en español; snake_case en la base y camelCase en el código (`snake-naming.strategy.ts`).
- `synchronize` desactivado: el esquema cambia solo por migraciones, y las generadas se revisan antes de aplicarse.
- Imports ESM con extensión `.js` en el backend (`'./app.module.js'`).
- DTOs con class-validator y `@ApiProperty`. Tras cambiar endpoints o DTOs: `npm run api:tipos` en `frontend/` (backend corriendo). `esquema.d.ts` no se edita a mano.
- Siete roles fijos: `analista_puestos`, `recursos_humanos`, `autoridad`, `jefatura_departamento`, `jefe_catedra`, `administrador`, `docente`. Un solo rol por usuario.
- `nombre_usuario` de 3 a 50 caracteres; clave de al menos 10 caracteres; claves con argon2id.
- Sesión: cookie `httpOnly`, `sameSite=lax`, vencimiento de 8 horas de inactividad, firmada con `SESION_SECRETO`.
- `id_persona` e `id_unidad` son enteros sin clave foránea mientras no existan `persona` ni `unidad_organizativa`.
- Antes de cada commit: `npm run lint`, `npm run format` y `npm test` en `backend/`; `npm run lint`, `npm run format` y `npm run build` en `frontend/` cuando se toca el frontend.
- Los commits no llevan línea `Co-Authored-By` ni otra atribución a Claude.
- Los comandos de `backend/` se corren en el contenedor (`docker compose exec -T backend ...`) salvo indicación; el repo no tiene `node_modules` en el host del backend hasta la Tarea 1.

## Foco de revisión

Entradas o fallas que la spec implica y que ninguna tarea cubriría por sí sola; cada línea tiene su test en la tarea indicada.

1. Un usuario desactivado no puede iniciar sesión (mismo 401 genérico) y una sesión ya abierta de un usuario desactivado deja de ser válida en la siguiente petición (Tarea 5).
2. El último administrador activo no puede desactivarse ni cambiar de rol (Tarea 6).
3. Los nombres de usuario se normalizan a minúsculas y sin espacios: `Admin` y `admin` no pueden coexistir (Tarea 6).
4. Cambiar la propia clave con la clave actual incorrecta, o con una nueva de menos de 10 caracteres, se rechaza sin modificar nada (Tarea 5).
5. Una modificación que no cambia ninguna columna no genera fila de auditoría (Tarea 10).

---

## Mapa de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `backend/src/common/roles.ts` | Códigos de rol, `CodigoRol` y grupos de roles |
| `backend/src/common/sesion-usuario.ts` | Tipo `SesionUsuario` (lo que viaja en `req.user`) |
| `backend/src/common/decorators/{roles,publico,usuario-actual}.decorator.ts` | `@Roles`, `@Publico`, `@UsuarioActual` |
| `backend/src/common/guards/{sesion,roles}.guard.ts` | Exigir sesión y rol; globales |
| `backend/src/modules/usuarios/entities/` | `Rol`, `Usuario`, `UsuarioUnidad` |
| `backend/src/modules/usuarios/password.service.ts` | Hash y verificación argon2id |
| `backend/src/modules/usuarios/auth.service.ts` | Validar credenciales, cargar sesión, cambiar clave |
| `backend/src/modules/usuarios/usuarios.service.ts` | RF22: alta, edición, desactivación y restablecimiento |
| `backend/src/modules/usuarios/{local.strategy,sesion.serializer,local-auth.guard}.ts` | Integración con Passport |
| `backend/src/modules/usuarios/{auth,usuarios}.controller.ts` | Endpoints HTTP |
| `backend/src/modules/usuarios/alcance.service.ts` | Unidades visibles por usuario |
| `backend/src/modules/usuarios/usuarios-bootstrap.service.ts` | Primer administrador |
| `backend/src/infra/sesion/sesion.config.ts` | Middleware de sesión y Passport |
| `backend/src/infra/auditoria/` | `Auditoria` (entidad), contexto, subscriber, servicio, controller y módulo |
| `frontend/src/auth/` | `useSesion`, `LoginPage`, `RutaProtegida`, `permisos.ts` |
| `frontend/src/features/admin/` | Pestaña Usuarios; se elimina el token provisorio |

---

### Tarea 1: Dependencias y variables de entorno

**Archivos:**
- Modificar: `backend/package.json`, `backend/package-lock.json` (por `npm install`)
- Modificar: `backend/src/infra/config/env.validation.ts`
- Modificar: `.env.example`, `.env` (local, ignorado por git)
- Prueba: `backend/src/infra/config/env.validation.spec.ts`

**Interfaces:**
- Produce: variables `SESION_SECRETO` (obligatoria, 32 caracteres o más), `ADMIN_USUARIO` y `ADMIN_CLAVE` (opcionales) en la clase `Env`.

- [ ] **Paso 1: Crear la rama de trabajo**

Ya estás en `feat/usuarios`. Verificar:

```bash
git branch --show-current
```

Esperado: `feat/usuarios`.

- [ ] **Paso 2: Instalar dependencias en el host**

```bash
cd backend
npm install @nestjs/passport@12 passport@0.7 passport-local express-session connect-pg-simple argon2
npm install -D @types/passport @types/passport-local @types/express-session @types/connect-pg-simple
```

Esperado: sin errores; `package.json` y `package-lock.json` modificados.

- [ ] **Paso 3: Verificar que los imports ESM funcionan**

```bash
node --input-type=module -e "
import { hash, verify } from 'argon2';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import passport from 'passport';
const h = await hash('clave-de-prueba');
console.log(await verify(h, 'clave-de-prueba'), typeof connectPgSimple(session), typeof passport.initialize);
"
```

Esperado: `true function function`.

- [ ] **Paso 4: Escribir el test de validación de entorno (falla)**

Crear `backend/src/infra/config/env.validation.spec.ts`:

```ts
import { validarEnv } from './env.validation.js';

const base = {
  DB_HOST: 'localhost',
  DB_NAME: 'bd',
  DB_USER: 'usuario',
  DB_PASSWORD: 'clave',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'acceso',
  S3_SECRET_KEY: 'secreto',
  S3_BUCKET: 'bucket',
  SESION_SECRETO: 'x'.repeat(32),
};

describe('validarEnv', () => {
  it('acepta SESION_SECRETO de 32 caracteres y deja opcionales las del administrador', () => {
    const env = validarEnv(base);
    expect(env.SESION_SECRETO).toHaveLength(32);
    expect(env.ADMIN_USUARIO).toBeUndefined();
    expect(env.ADMIN_CLAVE).toBeUndefined();
  });

  it('rechaza un SESION_SECRETO corto', () => {
    expect(() => validarEnv({ ...base, SESION_SECRETO: 'corto' })).toThrow(
      /SESION_SECRETO/,
    );
  });

  it('rechaza si falta SESION_SECRETO', () => {
    const { SESION_SECRETO: _omitida, ...sinSecreto } = base;
    expect(() => validarEnv(sinSecreto)).toThrow(/SESION_SECRETO/);
  });
});
```

- [ ] **Paso 5: Correr el test y verlo fallar**

```bash
cd backend && npx vitest run src/infra/config/env.validation.spec.ts
```

Esperado: FAIL (la primera prueba no encuentra `SESION_SECRETO` en `Env`, o la tercera no lanza).

- [ ] **Paso 6: Agregar las variables a `Env`**

En `backend/src/infra/config/env.validation.ts`, ampliar el import de class-validator con `MaxLength` y `MinLength`, y agregar al final de la clase `Env` (después de `ADMIN_TOKEN`, que se elimina en la Tarea 7):

```ts
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
```

- [ ] **Paso 7: Actualizar `.env.example` y `.env`**

En `.env.example`, después de la línea `ADMIN_TOKEN=cambiame` agregar:

```
# Secreto que firma la cookie de sesión (32 caracteres o más)
SESION_SECRETO=cambiame-por-un-secreto-largo-de-32-o-mas-caracteres
# Primer administrador: se crea al arrancar solo si no hay usuarios
ADMIN_USUARIO=admin
ADMIN_CLAVE=cambiame-clave-larga
```

Agregar las mismas tres líneas, con valores propios, al `.env` local (por ejemplo `SESION_SECRETO=$(openssl rand -hex 32)`).

- [ ] **Paso 8: Reconstruir el backend y correr tests**

```bash
docker compose up --build -d backend
docker compose exec -T backend npx vitest run src/infra/config/env.validation.spec.ts
```

Esperado: 3 tests PASS y el backend arranca.

- [ ] **Paso 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/infra/config .env.example
git commit -m "Agregar dependencias de sesión y variables de entorno de usuarios"
```

---

### Tarea 2: Roles, tipo de sesión, entidades y migración

**Archivos:**
- Crear: `backend/src/common/roles.ts`, `backend/src/common/sesion-usuario.ts`
- Crear: `backend/src/modules/usuarios/entities/{rol,usuario,usuario-unidad}.entity.ts`
- Crear: `backend/src/infra/auditoria/auditoria.entity.ts`
- Modificar: `backend/src/infra/database/data-source.ts`
- Crear: migración generada y completada en `backend/src/infra/database/migrations/`
- Prueba: `backend/src/common/roles.spec.ts`

**Interfaces:**
- Produce: `ROLES`, `CodigoRol`, `TODOS_LOS_ROLES`, `ROLES_GLOBALES`, `ROLES_CON_ALCANCE_POR_UNIDAD`, `SesionUsuario`, entidades `Rol`, `Usuario`, `UsuarioUnidad`, `Auditoria`.

- [ ] **Paso 1: Escribir el test de roles (falla)**

Crear `backend/src/common/roles.spec.ts`:

```ts
import {
  ROLES,
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_GLOBALES,
  TODOS_LOS_ROLES,
} from './roles.js';

describe('roles', () => {
  it('define los siete roles fijos', () => {
    expect([...TODOS_LOS_ROLES].sort()).toEqual([
      'administrador',
      'analista_puestos',
      'autoridad',
      'docente',
      'jefatura_departamento',
      'jefe_catedra',
      'recursos_humanos',
    ]);
  });

  it('separa roles globales y roles con alcance por unidad sin solaparlos', () => {
    expect(ROLES_CON_ALCANCE_POR_UNIDAD).toEqual([
      ROLES.jefaturaDepartamento,
      ROLES.jefeCatedra,
    ]);
    for (const rol of ROLES_CON_ALCANCE_POR_UNIDAD) {
      expect(ROLES_GLOBALES).not.toContain(rol);
    }
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

```bash
docker compose exec -T backend npx vitest run src/common/roles.spec.ts
```

Esperado: FAIL ("Cannot find module './roles.js'").

- [ ] **Paso 3: Crear `roles.ts` y `sesion-usuario.ts`**

`backend/src/common/roles.ts`:

```ts
/** Roles fijos del sistema (primer avance §5). Las reglas viven en el código. */
export const ROLES = {
  analistaPuestos: 'analista_puestos',
  recursosHumanos: 'recursos_humanos',
  autoridad: 'autoridad',
  jefaturaDepartamento: 'jefatura_departamento',
  jefeCatedra: 'jefe_catedra',
  administrador: 'administrador',
  docente: 'docente',
} as const;

export type CodigoRol = (typeof ROLES)[keyof typeof ROLES];

export const TODOS_LOS_ROLES: CodigoRol[] = Object.values(ROLES);

/** Ven los datos de toda la facultad. */
export const ROLES_GLOBALES: CodigoRol[] = [
  ROLES.analistaPuestos,
  ROLES.recursosHumanos,
  ROLES.autoridad,
];

/** Ven solo las unidades asignadas y sus descendientes. */
export const ROLES_CON_ALCANCE_POR_UNIDAD: CodigoRol[] = [
  ROLES.jefaturaDepartamento,
  ROLES.jefeCatedra,
];
```

`backend/src/common/sesion-usuario.ts`:

```ts
import type { CodigoRol } from './roles.js';

/** Lo que Passport deja en `req.user` en cada petición autenticada. */
export interface SesionUsuario {
  id: number;
  nombreUsuario: string;
  rol: CodigoRol;
  idPersona: number | null;
  /** Unidades asignadas explícitamente (sin descendientes). */
  unidades: number[];
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
docker compose exec -T backend npx vitest run src/common/roles.spec.ts
```

Esperado: 2 tests PASS.

- [ ] **Paso 5: Crear las entidades**

`backend/src/modules/usuarios/entities/rol.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Rol fijo cargado por migración; solo lectura. */
@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 100 })
  denominacion: string;
}
```

`backend/src/modules/usuarios/entities/usuario.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Rol } from './rol.entity.js';
import { UsuarioUnidad } from './usuario-unidad.entity.js';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  nombreUsuario: string;

  @Column({ type: 'varchar', length: 255 })
  claveHash: string;

  @ManyToOne(() => Rol, { nullable: false })
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  /** Sin clave foránea hasta que exista la tabla `persona`. */
  @Column({ name: 'id_persona', type: 'int', nullable: true, unique: true })
  idPersona: number | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creadoEn: Date;

  @OneToMany(() => UsuarioUnidad, (uu) => uu.usuario, { cascade: true })
  unidades: UsuarioUnidad[];
}
```

`backend/src/modules/usuarios/entities/usuario-unidad.entity.ts`:

```ts
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity.js';

/** Unidades a cargo de una jefatura o jefe de cátedra (RF24). */
@Entity('usuario_unidad')
export class UsuarioUnidad {
  @PrimaryColumn({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  /** Sin clave foránea hasta que exista `unidad_organizativa`. */
  @PrimaryColumn({ name: 'id_unidad', type: 'int' })
  idUnidad: number;

  @ManyToOne(() => Usuario, (u) => u.unidades, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}
```

`backend/src/infra/auditoria/auditoria.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity.js';

export type OperacionAuditada = 'alta' | 'modificacion' | 'baja';

/** Bitácora de cambios (RNF05). Solo se inserta; nunca se modifica ni se borra. */
@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn({ name: 'id_auditoria' })
  id: number;

  @Column({ type: 'varchar', length: 60 })
  entidad: string;

  /** Texto, para admitir claves compuestas (por ejemplo `3-17`). */
  @Column({ type: 'varchar', length: 100 })
  idRegistro: string;

  @Column({ type: 'varchar', length: 20 })
  operacion: OperacionAuditada;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'jsonb', nullable: true })
  valoresAnteriores: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  valoresNuevos: Record<string, unknown> | null;
}
```

- [ ] **Paso 6: Incluir `infra/` en las entidades de la CLI**

En `backend/src/infra/database/data-source.ts`, reemplazar el arreglo `entities` por:

```ts
  entities: [
    join(aqui, '..', '..', 'modules', '**', 'entities', '*.entity.js'),
    join(aqui, '..', '..', 'infra', '**', '*.entity.js'),
  ],
```

- [ ] **Paso 7: Generar la migración y revisarla**

La CLI descubre las entidades por glob, así que no hace falta registrarlas antes. Generar:

```bash
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/CrearTablasUsuarios
ls backend/src/infra/database/migrations
```

Esperado: un archivo nuevo `*-CrearTablasUsuarios.ts` que crea `rol`, `usuario`, `usuario_unidad` y `auditoria` con sus claves foráneas y restricciones de unicidad (`nombre_usuario`, `id_persona`, `codigo`). Revisar que `usuario_unidad` tenga clave primaria compuesta y que su clave foránea a `usuario` sea `ON DELETE CASCADE`.

- [ ] **Paso 8: Completar la migración con los roles y la tabla `sesion`**

Editar el archivo generado. Al final del método `up` agregar (después de los `CREATE TABLE` y claves foráneas generadas):

```ts
    for (const [codigo, denominacion] of [
      ['analista_puestos', 'Analista de puestos'],
      ['recursos_humanos', 'Recursos Humanos'],
      ['autoridad', 'Autoridades de la facultad'],
      ['jefatura_departamento', 'Jefatura de Departamento'],
      ['jefe_catedra', 'Jefe de cátedra'],
      ['administrador', 'Administrador del sistema'],
      ['docente', 'Docente'],
    ]) {
      await queryRunner.query(
        `INSERT INTO "rol" ("codigo", "denominacion") VALUES ($1, $2) ON CONFLICT ("codigo") DO NOTHING`,
        [codigo, denominacion],
      );
    }
    // Tabla del store de sesiones (connect-pg-simple); no tiene entidad.
    await queryRunner.query(
      `CREATE TABLE "sesion" ("sid" character varying NOT NULL, "sess" json NOT NULL, "expire" timestamp(6) NOT NULL, CONSTRAINT "PK_sesion_sid" PRIMARY KEY ("sid"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sesion_expire" ON "sesion" ("expire")`,
    );
```

Y al comienzo del método `down` (antes de los `DROP TABLE` generados):

```ts
    await queryRunner.query(`DROP INDEX "IDX_sesion_expire"`);
    await queryRunner.query(`DROP TABLE "sesion"`);
```

- [ ] **Paso 9: Aplicar, revertir y volver a aplicar**

```bash
docker compose exec -T backend npm run migration:run 2>&1 | grep -E "executed|Error"
docker compose exec -T backend npm run migration:revert 2>&1 | grep -E "reverted|Error"
docker compose exec -T backend npm run migration:run 2>&1 | grep -E "executed|Error"
docker compose exec -T db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "select codigo from rol order by 1"'
```

Esperado: ejecutada, revertida y ejecutada de nuevo; 7 roles listados.

- [ ] **Paso 10: Verificar que las entidades y la base coinciden**

```bash
docker compose exec -T backend npm run migration:generate -- src/infra/database/migrations/Verificacion 2>&1 | tail -3
```

Esperado: "No changes in database schema were found" y ningún archivo nuevo. Si generó una migración, borrarla y corregir la entidad o la migración hasta que no haya diferencias.

- [ ] **Paso 11: Commit**

```bash
git add backend/src/common backend/src/modules/usuarios/entities backend/src/infra
git commit -m "Agregar roles, entidades de usuarios y auditoría, y su migración"
```

---

### Tarea 3: Hash de contraseñas

**Archivos:**
- Crear: `backend/src/modules/usuarios/password.service.ts`
- Prueba: `backend/src/modules/usuarios/password.service.spec.ts`

**Interfaces:**
- Produce: `PasswordService` con `hashear(clave: string): Promise<string>`, `verificar(hash: string, clave: string): Promise<boolean>` y la constante `LARGO_MINIMO_CLAVE = 10`.

- [ ] **Paso 1: Escribir el test (falla)**

`backend/src/modules/usuarios/password.service.spec.ts`:

```ts
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const servicio = new PasswordService();

  it('genera un hash argon2id distinto de la clave', async () => {
    const hash = await servicio.hashear('una-clave-larga');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('una-clave-larga');
  });

  it('dos hashes de la misma clave son distintos (sal aleatoria)', async () => {
    const a = await servicio.hashear('una-clave-larga');
    const b = await servicio.hashear('una-clave-larga');
    expect(a).not.toBe(b);
  });

  it('verifica la clave correcta y rechaza la incorrecta', async () => {
    const hash = await servicio.hashear('una-clave-larga');
    expect(await servicio.verificar(hash, 'una-clave-larga')).toBe(true);
    expect(await servicio.verificar(hash, 'otra-clave-larga')).toBe(false);
  });

  it('devuelve false ante un hash mal formado en vez de lanzar', async () => {
    expect(await servicio.verificar('no-es-un-hash', 'x')).toBe(false);
  });
});
```

- [ ] **Paso 2: Correrlo y verlo fallar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/password.service.spec.ts
```

Esperado: FAIL ("Cannot find module './password.service.js'").

- [ ] **Paso 3: Implementar**

`backend/src/modules/usuarios/password.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

export const LARGO_MINIMO_CLAVE = 10;

/** Hash de contraseñas con argon2id y los parámetros por defecto del paquete. */
@Injectable()
export class PasswordService {
  hashear(clave: string): Promise<string> {
    return hash(clave);
  }

  async verificar(hashGuardado: string, clave: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, clave);
    } catch {
      return false;
    }
  }
}
```

- [ ] **Paso 4: Correrlo y verlo pasar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/password.service.spec.ts
```

Esperado: 4 tests PASS.

- [ ] **Paso 5: Commit**

```bash
git add backend/src/modules/usuarios/password.service.ts backend/src/modules/usuarios/password.service.spec.ts
git commit -m "Agregar hash de contraseñas con argon2id"
```

---

### Tarea 4: Decoradores y guards de sesión y roles

**Archivos:**
- Crear: `backend/src/common/decorators/{roles,publico,usuario-actual}.decorator.ts`
- Crear: `backend/src/common/guards/{sesion,roles}.guard.ts`
- Prueba: `backend/src/common/guards/sesion.guard.spec.ts`, `backend/src/common/guards/roles.guard.spec.ts`

**Interfaces:**
- Consume: `CodigoRol`, `SesionUsuario`.
- Produce: `@Roles(...roles: CodigoRol[])`, `ROLES_KEY`, `@Publico()`, `PUBLICO_KEY`, `@UsuarioActual()`, `SesionGuard`, `RolesGuard`. Los endpoints sin `@Roles` ni `@Publico` se rechazan con 403 (falla cerrada).

- [ ] **Paso 1: Escribir los tests (fallan)**

`backend/src/common/guards/sesion.guard.spec.ts`:

```ts
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Publico } from '../decorators/publico.decorator.js';
import { SesionGuard } from './sesion.guard.js';

class Controlador {
  @Publico()
  abierto() {}
  cerrado() {}
}

function contexto(metodo: keyof Controlador, user?: object): ExecutionContext {
  return {
    getHandler: () => Controlador.prototype[metodo],
    getClass: () => Controlador,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('SesionGuard', () => {
  const guard = new SesionGuard(new Reflector());

  it('deja pasar las rutas públicas sin sesión', () => {
    expect(guard.canActivate(contexto('abierto'))).toBe(true);
  });

  it('rechaza con 401 una ruta privada sin sesión', () => {
    expect(() => guard.canActivate(contexto('cerrado'))).toThrow(
      UnauthorizedException,
    );
  });

  it('deja pasar una ruta privada con sesión', () => {
    expect(guard.canActivate(contexto('cerrado', { id: 1 }))).toBe(true);
  });
});
```

`backend/src/common/guards/roles.guard.spec.ts`:

```ts
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Publico } from '../decorators/publico.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ROLES } from '../roles.js';
import { RolesGuard } from './roles.guard.js';

class Controlador {
  @Publico()
  abierto() {}

  @Roles(ROLES.administrador)
  soloAdmin() {}

  @Roles(ROLES.recursosHumanos, ROLES.autoridad)
  variosRoles() {}

  sinDeclarar() {}
}

function contexto(metodo: keyof Controlador, rol?: string): ExecutionContext {
  return {
    getHandler: () => Controlador.prototype[metodo],
    getClass: () => Controlador,
    switchToHttp: () => ({
      getRequest: () => ({ user: rol ? { rol } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('deja pasar las rutas públicas', () => {
    expect(guard.canActivate(contexto('abierto'))).toBe(true);
  });

  it('permite el rol declarado', () => {
    expect(guard.canActivate(contexto('soloAdmin', 'administrador'))).toBe(true);
  });

  it('permite cualquiera de varios roles declarados', () => {
    expect(
      guard.canActivate(contexto('variosRoles', 'autoridad')),
    ).toBe(true);
  });

  it.each([
    'analista_puestos',
    'recursos_humanos',
    'autoridad',
    'jefatura_departamento',
    'jefe_catedra',
    'docente',
  ])('rechaza con 403 al rol %s en una ruta solo de administrador', (rol) => {
    expect(() => guard.canActivate(contexto('soloAdmin', rol))).toThrow(
      ForbiddenException,
    );
  });

  it('falla cerrado: rechaza una ruta sin @Roles aunque haya sesión', () => {
    expect(() =>
      guard.canActivate(contexto('sinDeclarar', 'administrador')),
    ).toThrow(ForbiddenException);
  });
});
```

- [ ] **Paso 2: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/common/guards
```

Esperado: FAIL (módulos inexistentes).

- [ ] **Paso 3: Crear los decoradores**

`backend/src/common/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { CodigoRol } from '../roles.js';

export const ROLES_KEY = 'roles';

/** Roles autorizados en un endpoint o controller. Sin él, la ruta se rechaza. */
export const Roles = (...roles: CodigoRol[]) => SetMetadata(ROLES_KEY, roles);
```

`backend/src/common/decorators/publico.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const PUBLICO_KEY = 'publico';

/** Ruta accesible sin sesión (login y salud). */
export const Publico = () => SetMetadata(PUBLICO_KEY, true);
```

`backend/src/common/decorators/usuario-actual.decorator.ts`:

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Usuario autenticado de la petición actual. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): SesionUsuario =>
    contexto.switchToHttp().getRequest<{ user: SesionUsuario }>().user,
);
```

- [ ] **Paso 4: Crear los guards**

`backend/src/common/guards/sesion.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLICO_KEY } from '../decorators/publico.decorator.js';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Exige sesión iniciada en toda ruta que no sea @Publico (RNF01). */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const { user } = contexto
      .switchToHttp()
      .getRequest<{ user?: SesionUsuario }>();
    if (!user) throw new UnauthorizedException('Iniciá sesión para continuar');
    return true;
  }
}
```

`backend/src/common/guards/roles.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLICO_KEY } from '../decorators/publico.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { CodigoRol } from '../roles.js';
import type { SesionUsuario } from '../sesion-usuario.js';

/** Autoriza por rol (RNF01). Una ruta sin @Roles se rechaza: falla cerrada. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, objetivos)) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<CodigoRol[]>(
      ROLES_KEY,
      objetivos,
    );
    const { user } = contexto
      .switchToHttp()
      .getRequest<{ user?: SesionUsuario }>();

    if (!roles?.length || !user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta operación');
    }
    return true;
  }
}
```

- [ ] **Paso 5: Correr los tests y verlos pasar**

```bash
docker compose exec -T backend npx vitest run src/common/guards
```

Esperado: todos PASS (3 de `SesionGuard`, 11 de `RolesGuard` y los 4 del guard provisorio de la feature anterior, que se elimina en la Tarea 7).

- [ ] **Paso 6: Commit**

```bash
git add backend/src/common
git commit -m "Agregar decoradores y guards de sesión y roles"
```

---

### Tarea 5: AuthService (credenciales, sesión y cambio de clave)

**Archivos:**
- Crear: `backend/src/modules/usuarios/auth.service.ts`
- Prueba: `backend/src/modules/usuarios/auth.service.spec.ts`

**Interfaces:**
- Consume: `PasswordService`, `LARGO_MINIMO_CLAVE`, `Usuario`, `SesionUsuario`, `Repository<Usuario>`.
- Produce: `AuthService` con `validarCredenciales(nombreUsuario: string, clave: string): Promise<SesionUsuario | null>`, `cargarSesionUsuario(id: number): Promise<SesionUsuario | null>` y `cambiarClave(idUsuario: number, claveActual: string, claveNueva: string): Promise<void>`. Constante `normalizarNombreUsuario(nombre: string): string` exportada desde este archivo.

- [ ] **Paso 1: Escribir los tests (fallan)**

`backend/src/modules/usuarios/auth.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { AuthService, normalizarNombreUsuario } from './auth.service.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';

const passwords = new PasswordService();

async function usuarioDe(parcial: Partial<Usuario> = {}): Promise<Usuario> {
  return {
    id: 7,
    nombreUsuario: 'ana',
    claveHash: await passwords.hashear('clave-correcta-1'),
    rol: { id: 1, codigo: 'jefe_catedra', denominacion: 'Jefe de cátedra' },
    idPersona: 42,
    activo: true,
    creadoEn: new Date(),
    unidades: [{ idUsuario: 7, idUnidad: 3 } as never],
    ...parcial,
  } as Usuario;
}

function crearServicio(usuario: Usuario | null) {
  const repo = {
    findOne: vi.fn(async () => usuario),
    update: vi.fn(async () => undefined),
  } as unknown as Repository<Usuario>;
  return { servicio: new AuthService(repo, passwords), repo };
}

describe('normalizarNombreUsuario', () => {
  it('pasa a minúsculas y quita espacios', () => {
    expect(normalizarNombreUsuario('  Ana.Perez ')).toBe('ana.perez');
  });
});

describe('AuthService.validarCredenciales', () => {
  it('devuelve la sesión con rol, persona y unidades si las credenciales son correctas', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect(await servicio.validarCredenciales('Ana', 'clave-correcta-1')).toEqual({
      id: 7,
      nombreUsuario: 'ana',
      rol: 'jefe_catedra',
      idPersona: 42,
      unidades: [3],
    });
  });

  it('devuelve null con clave incorrecta', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect(await servicio.validarCredenciales('ana', 'otra-clave-123')).toBeNull();
  });

  it('devuelve null si el usuario no existe', async () => {
    const { servicio } = crearServicio(null);
    expect(await servicio.validarCredenciales('nadie', 'clave-correcta-1')).toBeNull();
  });

  it('devuelve null para un usuario desactivado aunque la clave sea correcta', async () => {
    const { servicio } = crearServicio(await usuarioDe({ activo: false }));
    expect(await servicio.validarCredenciales('ana', 'clave-correcta-1')).toBeNull();
  });
});

describe('AuthService.cargarSesionUsuario', () => {
  it('devuelve la sesión de un usuario activo', async () => {
    const { servicio } = crearServicio(await usuarioDe());
    expect((await servicio.cargarSesionUsuario(7))?.nombreUsuario).toBe('ana');
  });

  it('invalida la sesión de un usuario desactivado', async () => {
    const { servicio } = crearServicio(await usuarioDe({ activo: false }));
    expect(await servicio.cargarSesionUsuario(7)).toBeNull();
  });

  it('invalida la sesión de un usuario inexistente', async () => {
    const { servicio } = crearServicio(null);
    expect(await servicio.cargarSesionUsuario(7)).toBeNull();
  });
});

describe('AuthService.cambiarClave', () => {
  it('guarda el hash de la clave nueva si la actual es correcta', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await servicio.cambiarClave(7, 'clave-correcta-1', 'clave-nueva-1234');
    const [, cambios] = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(await passwords.verificar(cambios.claveHash, 'clave-nueva-1234')).toBe(true);
  });

  it('rechaza una clave actual incorrecta sin modificar nada', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await expect(
      servicio.cambiarClave(7, 'incorrecta-123', 'clave-nueva-1234'),
    ).rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rechaza una clave nueva de menos de 10 caracteres sin modificar nada', async () => {
    const { servicio, repo } = crearServicio(await usuarioDe());
    await expect(
      servicio.cambiarClave(7, 'clave-correcta-1', 'corta'),
    ).rejects.toThrow(/10 caracteres/);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/auth.service.spec.ts
```

Esperado: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar**

`backend/src/modules/usuarios/auth.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { Usuario } from './entities/usuario.entity.js';
import { LARGO_MINIMO_CLAVE, PasswordService } from './password.service.js';

/** Los nombres de usuario no distinguen mayúsculas ni espacios en los extremos. */
export function normalizarNombreUsuario(nombre: string): string {
  return nombre.trim().toLowerCase();
}

export function aSesionUsuario(usuario: Usuario): SesionUsuario {
  return {
    id: usuario.id,
    nombreUsuario: usuario.nombreUsuario,
    rol: usuario.rol.codigo as CodigoRol,
    idPersona: usuario.idPersona,
    unidades: (usuario.unidades ?? []).map((u) => u.idUnidad),
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly passwords: PasswordService,
  ) {}

  /** null ante usuario inexistente, desactivado o clave incorrecta (mismo resultado). */
  async validarCredenciales(
    nombreUsuario: string,
    clave: string,
  ): Promise<SesionUsuario | null> {
    const usuario = await this.usuarios.findOne({
      where: { nombreUsuario: normalizarNombreUsuario(nombreUsuario) },
      relations: { rol: true, unidades: true },
    });
    if (!usuario || !usuario.activo) return null;
    if (!(await this.passwords.verificar(usuario.claveHash, clave))) return null;
    return aSesionUsuario(usuario);
  }

  /** Se consulta en cada petición: desactivar un usuario corta su sesión de inmediato. */
  async cargarSesionUsuario(id: number): Promise<SesionUsuario | null> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: { rol: true, unidades: true },
    });
    return usuario?.activo ? aSesionUsuario(usuario) : null;
  }

  async cambiarClave(
    idUsuario: number,
    claveActual: string,
    claveNueva: string,
  ): Promise<void> {
    const usuario = await this.usuarios.findOne({ where: { id: idUsuario } });
    if (
      !usuario ||
      !(await this.passwords.verificar(usuario.claveHash, claveActual))
    ) {
      throw new BadRequestException('La clave actual es incorrecta');
    }
    if (claveNueva.length < LARGO_MINIMO_CLAVE) {
      throw new BadRequestException(
        `La clave nueva debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
      );
    }
    await this.usuarios.update(idUsuario, {
      claveHash: await this.passwords.hashear(claveNueva),
    });
  }
}
```

- [ ] **Paso 3b: Correrlos y verlos pasar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/auth.service.spec.ts
```

Esperado: 11 tests PASS.

- [ ] **Paso 4: Commit**

```bash
git add backend/src/modules/usuarios/auth.service.ts backend/src/modules/usuarios/auth.service.spec.ts
git commit -m "Agregar AuthService: credenciales, sesión y cambio de clave"
```

---

### Tarea 6: UsuariosService (RF22)

**Archivos:**
- Crear: `backend/src/modules/usuarios/dto/{crear-usuario,actualizar-usuario,usuario,rol,restablecer-clave}.dto.ts`
- Crear: `backend/src/modules/usuarios/usuarios.service.ts`
- Prueba: `backend/src/modules/usuarios/usuarios.service.spec.ts`

**Interfaces:**
- Consume: `PasswordService`, `LARGO_MINIMO_CLAVE`, `normalizarNombreUsuario`, `Usuario`, `Rol`, `ROLES`, `ROLES_CON_ALCANCE_POR_UNIDAD`.
- Produce: `UsuariosService` con `listar(): Promise<UsuarioDto[]>`, `listarRoles(): Promise<RolDto[]>`, `crear(dto: CrearUsuarioDto): Promise<UsuarioDto>`, `actualizar(id: number, dto: ActualizarUsuarioDto): Promise<UsuarioDto>` y `restablecerClave(id: number, clave: string): Promise<void>`.

- [ ] **Paso 1: Crear los DTOs**

`backend/src/modules/usuarios/dto/crear-usuario.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { TODOS_LOS_ROLES, type CodigoRol } from '../../../common/roles.js';
import { normalizarNombreUsuario } from '../auth.service.js';
import { LARGO_MINIMO_CLAVE } from '../password.service.js';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'ana.perez', description: '3 a 50 caracteres; se guarda en minúsculas' })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarNombreUsuario(value) : value,
  )
  @Matches(/^[a-z0-9._-]{3,50}$/, {
    message:
      'nombreUsuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion y guion bajo',
  })
  nombreUsuario: string;

  @ApiProperty({ minLength: LARGO_MINIMO_CLAVE })
  @IsString()
  @MinLength(LARGO_MINIMO_CLAVE, {
    message: `clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
  })
  clave: string;

  @ApiProperty({ enum: TODOS_LOS_ROLES })
  @IsIn(TODOS_LOS_ROLES)
  rol: CodigoRol;

  @ApiPropertyOptional({ nullable: true, description: 'Obligatoria para el rol docente' })
  @IsOptional()
  @IsInt()
  idPersona?: number | null;

  @ApiPropertyOptional({ type: [Number], description: 'Solo para jefatura y jefe de cátedra' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  idUnidades?: number[];
}
```

`backend/src/modules/usuarios/dto/actualizar-usuario.dto.ts`:

```ts
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearUsuarioDto } from './crear-usuario.dto.js';

export class ActualizarUsuarioDto extends PartialType(
  OmitType(CrearUsuarioDto, ['clave'] as const),
) {
  @ApiPropertyOptional({ description: 'false desactiva el usuario' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
```

`backend/src/modules/usuarios/dto/restablecer-clave.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { LARGO_MINIMO_CLAVE } from '../password.service.js';

export class RestablecerClaveDto {
  @ApiProperty({ minLength: LARGO_MINIMO_CLAVE })
  @IsString()
  @MinLength(LARGO_MINIMO_CLAVE, {
    message: `clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
  })
  clave: string;
}
```

`backend/src/modules/usuarios/dto/usuario.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { TODOS_LOS_ROLES, type CodigoRol } from '../../../common/roles.js';

export class UsuarioDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombreUsuario: string;

  @ApiProperty({ enum: TODOS_LOS_ROLES })
  rol: CodigoRol;

  @ApiProperty({ nullable: true, type: Number })
  idPersona: number | null;

  @ApiProperty({ type: [Number] })
  idUnidades: number[];

  @ApiProperty()
  activo: boolean;
}
```

`backend/src/modules/usuarios/dto/rol.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class RolDto {
  @ApiProperty({ example: 'jefe_catedra' })
  codigo: string;

  @ApiProperty({ example: 'Jefe de cátedra' })
  denominacion: string;
}
```

- [ ] **Paso 2: Escribir los tests (fallan)**

`backend/src/modules/usuarios/usuarios.service.spec.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Rol } from './entities/rol.entity.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import { UsuariosService } from './usuarios.service.js';

const roles: Rol[] = [
  'administrador',
  'docente',
  'jefe_catedra',
  'jefatura_departamento',
  'recursos_humanos',
].map((codigo, i) => ({ id: i + 1, codigo, denominacion: codigo }));

const rolDe = (codigo: string) => roles.find((r) => r.codigo === codigo)!;

function usuario(parcial: Partial<Usuario> & { rolCodigo?: string } = {}): Usuario {
  const { rolCodigo = 'recursos_humanos', ...resto } = parcial;
  return {
    id: 1,
    nombreUsuario: 'ana',
    claveHash: 'hash',
    rol: rolDe(rolCodigo),
    idPersona: null,
    activo: true,
    creadoEn: new Date(),
    unidades: [],
    ...resto,
  } as Usuario;
}

function crearServicio(existentes: Usuario[]) {
  const filas = existentes.map((u) => ({ ...u }));
  const usuarios = {
    find: vi.fn(async () => filas),
    findOne: vi.fn(async ({ where }: { where: Partial<Usuario> }) =>
      filas.find((u) =>
        Object.entries(where).every(([k, v]) => u[k as keyof Usuario] === v),
      ) ?? null,
    ),
    count: vi.fn(async () =>
      filas.filter((u) => u.activo && u.rol.codigo === 'administrador').length,
    ),
    create: vi.fn((datos: Partial<Usuario>) => ({ id: 99, ...datos })),
    save: vi.fn(async (u: Usuario) => u),
    update: vi.fn(async () => undefined),
  } as unknown as Repository<Usuario>;
  const rolesRepo = {
    find: vi.fn(async () => roles),
    findOne: vi.fn(async ({ where }: { where: { codigo: string } }) =>
      roles.find((r) => r.codigo === where.codigo) ?? null,
    ),
  } as unknown as Repository<Rol>;
  return {
    servicio: new UsuariosService(usuarios, rolesRepo, new PasswordService()),
    usuarios,
  };
}

const base = { nombreUsuario: 'nuevo', clave: 'clave-larga-123' };

describe('UsuariosService.crear', () => {
  it('crea un usuario con la clave hasheada y devuelve el DTO sin la clave', async () => {
    const { servicio, usuarios } = crearServicio([]);
    const dto = await servicio.crear({ ...base, rol: 'recursos_humanos' });
    expect(dto).toMatchObject({ nombreUsuario: 'nuevo', rol: 'recursos_humanos', activo: true });
    expect(JSON.stringify(dto)).not.toContain('hash');
    const guardado = (usuarios.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(guardado.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('rechaza un nombre de usuario repetido con 409, sin distinguir mayúsculas', async () => {
    const { servicio } = crearServicio([usuario({ nombreUsuario: 'admin' })]);
    await expect(
      servicio.crear({ ...base, nombreUsuario: 'Admin ', rol: 'recursos_humanos' }),
    ).rejects.toThrow(ConflictException);
  });

  it('exige persona para el rol docente', async () => {
    const { servicio } = crearServicio([]);
    await expect(servicio.crear({ ...base, rol: 'docente' })).rejects.toThrow(
      /persona/,
    );
  });

  it('rechaza una persona ya vinculada a otro usuario con 409', async () => {
    const { servicio } = crearServicio([usuario({ idPersona: 5 })]);
    await expect(
      servicio.crear({ ...base, rol: 'docente', idPersona: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('solo admite unidades para jefatura y jefe de cátedra', async () => {
    const { servicio } = crearServicio([]);
    await expect(
      servicio.crear({ ...base, rol: 'recursos_humanos', idUnidades: [1] }),
    ).rejects.toThrow(BadRequestException);
    const dto = await servicio.crear({ ...base, rol: 'jefe_catedra', idUnidades: [1, 2] });
    expect(dto.idUnidades).toEqual([1, 2]);
  });
});

describe('UsuariosService.actualizar', () => {
  it('modifica el rol y las unidades', async () => {
    const { servicio } = crearServicio([usuario({ id: 2, nombreUsuario: 'bea' })]);
    const dto = await servicio.actualizar(2, { rol: 'jefe_catedra', idUnidades: [4] });
    expect(dto).toMatchObject({ rol: 'jefe_catedra', idUnidades: [4] });
  });

  it('responde 404 si el usuario no existe', async () => {
    const { servicio } = crearServicio([]);
    await expect(servicio.actualizar(9, { activo: false })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no deja desactivar al último administrador activo', async () => {
    const { servicio } = crearServicio([usuario({ id: 1, rolCodigo: 'administrador' })]);
    await expect(servicio.actualizar(1, { activo: false })).rejects.toThrow(
      /último administrador/,
    );
  });

  it('no deja cambiar de rol al último administrador activo', async () => {
    const { servicio } = crearServicio([usuario({ id: 1, rolCodigo: 'administrador' })]);
    await expect(
      servicio.actualizar(1, { rol: 'recursos_humanos' }),
    ).rejects.toThrow(/último administrador/);
  });

  it('permite desactivar a un administrador si queda otro activo', async () => {
    const { servicio } = crearServicio([
      usuario({ id: 1, nombreUsuario: 'a', rolCodigo: 'administrador' }),
      usuario({ id: 2, nombreUsuario: 'b', rolCodigo: 'administrador' }),
    ]);
    expect((await servicio.actualizar(1, { activo: false })).activo).toBe(false);
  });
});

describe('UsuariosService.restablecerClave', () => {
  it('guarda el hash de la clave nueva', async () => {
    const { servicio, usuarios } = crearServicio([usuario({ id: 3 })]);
    await servicio.restablecerClave(3, 'otra-clave-larga');
    const [id, cambios] = (usuarios.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe(3);
    expect(cambios.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('responde 404 si el usuario no existe', async () => {
    const { servicio } = crearServicio([]);
    await expect(servicio.restablecerClave(9, 'otra-clave-larga')).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

- [ ] **Paso 3: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/usuarios.service.spec.ts
```

Esperado: FAIL (módulo inexistente).

- [ ] **Paso 4: Implementar**

`backend/src/modules/usuarios/usuarios.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES, ROLES_CON_ALCANCE_POR_UNIDAD } from '../../common/roles.js';
import type { CodigoRol } from '../../common/roles.js';
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import type { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import type { RolDto } from './dto/rol.dto.js';
import type { UsuarioDto } from './dto/usuario.dto.js';
import { Rol } from './entities/rol.entity.js';
import { UsuarioUnidad } from './entities/usuario-unidad.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    private readonly passwords: PasswordService,
  ) {}

  async listar(): Promise<UsuarioDto[]> {
    const todos = await this.usuarios.find({
      relations: { rol: true, unidades: true },
      order: { nombreUsuario: 'ASC' },
    });
    return todos.map((u) => this.aDto(u));
  }

  async listarRoles(): Promise<RolDto[]> {
    const roles = await this.roles.find({ order: { id: 'ASC' } });
    return roles.map(({ codigo, denominacion }) => ({ codigo, denominacion }));
  }

  async crear(dto: CrearUsuarioDto): Promise<UsuarioDto> {
    if (await this.usuarios.findOne({ where: { nombreUsuario: dto.nombreUsuario } })) {
      throw new ConflictException(`Ya existe el usuario "${dto.nombreUsuario}"`);
    }
    const rol = await this.buscarRol(dto.rol);
    const idPersona = dto.idPersona ?? null;
    this.validarReglasDeRol(dto.rol, idPersona, dto.idUnidades ?? []);
    await this.validarPersonaLibre(idPersona);

    const creado = await this.usuarios.save(
      this.usuarios.create({
        nombreUsuario: dto.nombreUsuario,
        claveHash: await this.passwords.hashear(dto.clave),
        rol,
        idPersona,
        activo: true,
        unidades: this.unidades(dto.idUnidades ?? []),
      }),
    );
    return this.aDto(creado);
  }

  async actualizar(id: number, dto: ActualizarUsuarioDto): Promise<UsuarioDto> {
    const usuario = await this.obtener(id);

    const rolFinal = (dto.rol ?? usuario.rol.codigo) as CodigoRol;
    const idPersonaFinal =
      dto.idPersona === undefined ? usuario.idPersona : dto.idPersona;
    const unidadesFinales =
      dto.idUnidades ?? usuario.unidades.map((u) => u.idUnidad);
    this.validarReglasDeRol(rolFinal, idPersonaFinal, unidadesFinales);

    if (dto.nombreUsuario && dto.nombreUsuario !== usuario.nombreUsuario) {
      const repetido = await this.usuarios.findOne({
        where: { nombreUsuario: dto.nombreUsuario },
      });
      if (repetido) {
        throw new ConflictException(`Ya existe el usuario "${dto.nombreUsuario}"`);
      }
    }
    if (idPersonaFinal !== usuario.idPersona) {
      await this.validarPersonaLibre(idPersonaFinal);
    }

    const dejaDeSerAdminActivo =
      usuario.rol.codigo === ROLES.administrador &&
      usuario.activo &&
      (dto.activo === false || rolFinal !== ROLES.administrador);
    if (dejaDeSerAdminActivo) await this.exigirOtroAdministradorActivo();

    if (dto.nombreUsuario) usuario.nombreUsuario = dto.nombreUsuario;
    if (dto.rol) usuario.rol = await this.buscarRol(dto.rol);
    if (dto.idPersona !== undefined) usuario.idPersona = dto.idPersona;
    if (dto.activo !== undefined) usuario.activo = dto.activo;
    if (dto.idUnidades) usuario.unidades = this.unidades(dto.idUnidades, usuario.id);

    return this.aDto(await this.usuarios.save(usuario));
  }

  async restablecerClave(id: number, clave: string): Promise<void> {
    await this.obtener(id);
    await this.usuarios.update(id, { claveHash: await this.passwords.hashear(clave) });
  }

  private async obtener(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: { rol: true, unidades: true },
    });
    if (!usuario) throw new NotFoundException(`No existe el usuario ${id}`);
    return usuario;
  }

  private async buscarRol(codigo: string): Promise<Rol> {
    const rol = await this.roles.findOne({ where: { codigo } });
    if (!rol) throw new BadRequestException(`El rol "${codigo}" no existe`);
    return rol;
  }

  private validarReglasDeRol(
    rol: CodigoRol,
    idPersona: number | null,
    idUnidades: number[],
  ): void {
    if (rol === ROLES.docente && idPersona === null) {
      throw new BadRequestException('El rol docente requiere una persona vinculada');
    }
    if (idUnidades.length > 0 && !ROLES_CON_ALCANCE_POR_UNIDAD.includes(rol)) {
      throw new BadRequestException(
        'Solo la jefatura de departamento y el jefe de cátedra tienen unidades a cargo',
      );
    }
  }

  private async validarPersonaLibre(idPersona: number | null): Promise<void> {
    if (idPersona === null) return;
    if (await this.usuarios.findOne({ where: { idPersona } })) {
      throw new ConflictException('Esa persona ya está vinculada a otro usuario');
    }
  }

  private async exigirOtroAdministradorActivo(): Promise<void> {
    const activos = await this.usuarios.count({
      where: { activo: true, rol: { codigo: ROLES.administrador } },
    });
    if (activos <= 1) {
      throw new ConflictException(
        'No se puede desactivar ni cambiar de rol al último administrador activo',
      );
    }
  }

  private unidades(idUnidades: number[], idUsuario?: number): UsuarioUnidad[] {
    return idUnidades.map((idUnidad) => ({ idUnidad, idUsuario }) as UsuarioUnidad);
  }

  private aDto(usuario: Usuario): UsuarioDto {
    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol.codigo as CodigoRol,
      idPersona: usuario.idPersona,
      idUnidades: (usuario.unidades ?? []).map((u) => u.idUnidad),
      activo: usuario.activo,
    };
  }
}
```

- [ ] **Paso 5: Correrlos y verlos pasar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/usuarios.service.spec.ts
```

Esperado: 16 tests PASS.

- [ ] **Paso 6: Commit**

```bash
git add backend/src/modules/usuarios/dto backend/src/modules/usuarios/usuarios.service.ts backend/src/modules/usuarios/usuarios.service.spec.ts
git commit -m "Agregar UsuariosService con gestión de usuarios y roles (RF22)"
```

---

### Tarea 7: Integración con Passport, controllers, guards globales y retiro del token provisorio

**Archivos:**
- Crear: `backend/src/modules/usuarios/{local.strategy,sesion.serializer,local-auth.guard}.ts`
- Crear: `backend/src/modules/usuarios/dto/{login,sesion,cambiar-clave}.dto.ts`
- Crear: `backend/src/modules/usuarios/{auth,usuarios}.controller.ts`
- Modificar: `backend/src/modules/usuarios/usuarios.module.ts`
- Crear: `backend/src/infra/sesion/sesion.config.ts`
- Modificar: `backend/src/main.ts`, `backend/src/infra/salud/salud.controller.ts`, `backend/src/modules/referencia/referencia.controller.ts`, `backend/src/modules/referencia/referencia.module.ts`, `backend/src/infra/config/env.validation.ts`, `.env.example`
- Eliminar: `backend/src/common/guards/admin-provisorio.guard.ts` y su `.spec.ts`
- Prueba: `backend/src/common/cobertura-roles.spec.ts`

**Interfaces:**
- Consume: `AuthService`, `UsuariosService`, `PasswordService`, `SesionGuard`, `RolesGuard`, `@Roles`, `@Publico`, `@UsuarioActual`, `TODOS_LOS_ROLES`.
- Produce: endpoints `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/yo`, `PATCH /api/auth/clave`, `GET|POST /api/usuarios`, `GET /api/usuarios/roles`, `PATCH /api/usuarios/:id`, `POST /api/usuarios/:id/restablecer-clave`; guards globales; `configurarSesion(app, config)`; `AuthService`, `UsuariosService` y `Usuario` exportados por `UsuariosModule` para otros módulos.

- [ ] **Paso 1: Escribir el test de cobertura de roles (falla)**

`backend/src/common/cobertura-roles.spec.ts`:

```ts
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { PUBLICO_KEY } from './decorators/publico.decorator.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

const raiz = join(import.meta.dirname, '..');

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return controllers(ruta);
    return nombre.endsWith('.controller.ts') ? [ruta] : [];
  });
}

describe('cobertura de @Roles', () => {
  const archivos = controllers(raiz);

  it('encuentra los controllers del backend', () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it.each(archivos.map((a) => [a.replace(raiz, 'src')]))(
    '%s declara @Roles o @Publico en cada ruta',
    async (ruta) => {
      const modulo = await import(pathToFileURL(join(raiz, '..', ruta)).href);
      const clases = Object.values(modulo).filter(
        (v): v is new () => object => typeof v === 'function',
      );
      for (const clase of clases) {
        const delControlador = (clave: string) =>
          Reflect.getMetadata(clave, clase) !== undefined;
        for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
          const handler = (clase.prototype as Record<string, unknown>)[nombre];
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
          const declarada =
            Reflect.getMetadata(ROLES_KEY, handler) !== undefined ||
            Reflect.getMetadata(PUBLICO_KEY, handler) !== undefined ||
            delControlador(ROLES_KEY) ||
            delControlador(PUBLICO_KEY);
          expect(declarada, `${clase.name}.${nombre} no declara @Roles ni @Publico`).toBe(true);
        }
      }
    },
  );
});
```

- [ ] **Paso 2: Correrlo y verlo fallar**

```bash
docker compose exec -T backend npx vitest run src/common/cobertura-roles.spec.ts
```

Esperado: FAIL en `referencia.controller.ts` y `salud.controller.ts` ("no declara @Roles ni @Publico").

- [ ] **Paso 3: Crear los DTOs de autenticación**

`backend/src/modules/usuarios/dto/login.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  nombreUsuario: string;

  @ApiProperty()
  @IsString()
  clave: string;
}
```

`backend/src/modules/usuarios/dto/sesion.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { TODOS_LOS_ROLES, type CodigoRol } from '../../../common/roles.js';

export class SesionDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nombreUsuario: string;

  @ApiProperty({ enum: TODOS_LOS_ROLES })
  rol: CodigoRol;

  @ApiProperty({ nullable: true, type: Number })
  idPersona: number | null;

  @ApiProperty({ type: [Number] })
  unidades: number[];
}
```

`backend/src/modules/usuarios/dto/cambiar-clave.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CambiarClaveDto {
  @ApiProperty()
  @IsString()
  claveActual: string;

  @ApiProperty({ description: 'Al menos 10 caracteres' })
  @IsString()
  claveNueva: string;
}
```

- [ ] **Paso 4: Crear la integración con Passport**

`backend/src/modules/usuarios/local.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'nombreUsuario', passwordField: 'clave' });
  }

  async validate(nombreUsuario: string, clave: string): Promise<SesionUsuario> {
    const sesion = await this.auth.validarCredenciales(nombreUsuario, clave);
    if (!sesion) throw new UnauthorizedException('Usuario o clave incorrectos');
    return sesion;
  }
}
```

`backend/src/modules/usuarios/sesion.serializer.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AuthService } from './auth.service.js';

/** Guarda solo el id en la sesión y recarga el usuario en cada petición. */
@Injectable()
export class SesionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) {
    super();
  }

  serializeUser(
    usuario: SesionUsuario,
    done: (error: Error | null, id?: number) => void,
  ): void {
    done(null, usuario.id);
  }

  async deserializeUser(
    id: number,
    done: (error: Error | null, usuario?: SesionUsuario | false) => void,
  ): Promise<void> {
    try {
      done(null, (await this.auth.cargarSesionUsuario(id)) ?? false);
    } catch (error) {
      done(error as Error);
    }
  }
}
```

`backend/src/modules/usuarios/local-auth.guard.ts`:

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Valida las credenciales y abre la sesión (cookie). */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const autenticado = (await super.canActivate(contexto)) as boolean;
    await super.logIn(contexto.switchToHttp().getRequest());
    return autenticado;
  }
}
```

- [ ] **Paso 5: Crear los controllers**

`backend/src/modules/usuarios/auth.controller.ts`:

```ts
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
```

`backend/src/modules/usuarios/usuarios.controller.ts`:

```ts
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
  @ApiConflictResponse({ description: 'Duplicado o último administrador activo' })
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
```

- [ ] **Paso 6: Registrar el módulo con los guards globales**

Reemplazar `backend/src/modules/usuarios/usuarios.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SesionGuard } from '../../common/guards/sesion.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Rol } from './entities/rol.entity.js';
import { UsuarioUnidad } from './entities/usuario-unidad.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { LocalStrategy } from './local.strategy.js';
import { PasswordService } from './password.service.js';
import { SesionSerializer } from './sesion.serializer.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

/** Usuarios, roles, permisos y autenticación (RF22, RF24, RNF01). */
@Module({
  imports: [
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([Rol, Usuario, UsuarioUnidad]),
  ],
  controllers: [AuthController, UsuariosController],
  providers: [
    PasswordService,
    AuthService,
    UsuariosService,
    LocalStrategy,
    LocalAuthGuard,
    SesionSerializer,
    // El orden importa: primero la sesión y después el rol.
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, UsuariosService, TypeOrmModule],
})
export class UsuariosModule {}
```

- [ ] **Paso 7: Configurar la sesión**

`backend/src/infra/sesion/sesion.config.ts`:

```ts
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
```

En `backend/src/main.ts`, importar `configurarSesion` (`import { configurarSesion } from './infra/sesion/sesion.config.js';`) y llamarla justo después de `app.enableCors(...)`:

```ts
  configurarSesion(app, config);
```

- [ ] **Paso 8: Marcar salud como pública y los endpoints de referencia por rol**

En `backend/src/infra/salud/salud.controller.ts`: importar `Publico` (`import { Publico } from '../../common/decorators/publico.decorator.js';`) y agregar `@Publico()` sobre `@Get()` de `verificar`.

En `backend/src/modules/referencia/referencia.controller.ts`:
- Eliminar el import de `AdminProvisorioGuard`, el `UseGuards`, la constante `TOKEN` y los `@ApiHeader(TOKEN)` y `@UseGuards(AdminProvisorioGuard)`; quitar `ApiHeader` y `UseGuards` de los imports.
- Importar `Roles`, `ROLES` y `TODOS_LOS_ROLES`.
- Sobre `listarDominios` y `listarValores`: `@Roles(...TODOS_LOS_ROLES)`.
- Sobre `crear`, `actualizar` y `eliminar`: `@Roles(ROLES.administrador)`.
- En las respuestas de error, cambiar `@ApiForbiddenResponse({ description: 'Falta el token de administrador' })` por `@ApiForbiddenResponse({ description: 'El rol no puede modificar las tablas de referencia' })`.

En `backend/src/modules/referencia/referencia.module.ts`: quitar `AdminProvisorioGuard` de `providers` y su import.

- [ ] **Paso 9: Eliminar el guard provisorio y `ADMIN_TOKEN`**

```bash
git rm backend/src/common/guards/admin-provisorio.guard.ts backend/src/common/guards/admin-provisorio.guard.spec.ts
```

En `backend/src/infra/config/env.validation.ts`, borrar la propiedad `ADMIN_TOKEN` con su comentario y su decorador. En `.env.example` borrar las tres líneas de `ADMIN_TOKEN` (comentario y variable). En el `.env` local borrar `ADMIN_TOKEN`.

- [ ] **Paso 10: Importar el módulo y verificar**

`UsuariosModule` ya está en `app.module.ts`. Correr:

```bash
docker compose exec -T backend npx prettier --write "src/**/*.ts" > /dev/null
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
```

Esperado: lint sin avisos y todos los tests PASS (incluido `cobertura-roles`). Si `oxlint` marca algo, corregirlo sin desactivar reglas.

- [ ] **Paso 11: Verificación manual con la base real**

El backend aún no crea un administrador (Tarea 8). Insertar uno temporal con un hash generado:

```bash
HASH=$(docker compose exec -T backend node --input-type=module -e "import {hash} from 'argon2'; console.log(await hash('clave-de-prueba-1'))")
docker compose exec -T db sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"insert into usuario (nombre_usuario, clave_hash, id_rol) select 'prueba', '$HASH', id_rol from rol where codigo='administrador'\""
sleep 8
B=localhost:3000/api; J=/tmp/claude-1000/cookies.txt
curl -s -o /dev/null -w "sin sesion: %{http_code}\n" $B/referencia
curl -s -c $J -w " login: %{http_code}\n" -XPOST $B/auth/login -H 'content-type: application/json' -d '{"nombreUsuario":"Prueba","clave":"clave-de-prueba-1"}'
curl -s -b $J -w " yo: %{http_code}\n" $B/auth/yo
curl -s -b $J -o /dev/null -w "referencia con sesion: %{http_code}\n" $B/referencia
curl -s -b $J -o /dev/null -w "usuarios (admin): %{http_code}\n" $B/usuarios
curl -s -c $J -w " clave mala: %{http_code}\n" -XPOST $B/auth/login -H 'content-type: application/json' -d '{"nombreUsuario":"prueba","clave":"mala"}'
curl -s -b $J -o /dev/null -w "logout: %{http_code}\n" -XPOST $B/auth/logout
curl -s -b $J -o /dev/null -w "tras logout: %{http_code}\n" $B/auth/yo
curl -s -o /dev/null -w "salud sin sesion: %{http_code}\n" $B/salud
```

Esperado: `sin sesion: 401`; login `200` con el JSON de sesión (`rol: administrador`); `yo: 200`; `referencia con sesion: 200`; `usuarios (admin): 200`; `clave mala: 401` con "Usuario o clave incorrectos"; `logout: 204`; `tras logout: 401`; `salud sin sesion: 200`. Después borrar el usuario temporal:

```bash
docker compose exec -T db sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "delete from usuario where nombre_usuario = '"'"'prueba'"'"'"'
```

- [ ] **Paso 12: Commit**

```bash
git add -A backend .env.example
git commit -m "Integrar Passport y sesión, exponer usuarios y retirar el token provisorio"
```

---

### Tarea 8: Primer administrador al arrancar

**Archivos:**
- Crear: `backend/src/modules/usuarios/usuarios-bootstrap.service.ts`
- Modificar: `backend/src/modules/usuarios/usuarios.module.ts`
- Prueba: `backend/src/modules/usuarios/usuarios-bootstrap.service.spec.ts`

**Interfaces:**
- Consume: `PasswordService`, `Usuario`, `Rol`, `ROLES`, `ConfigService<Env, true>`.
- Produce: `UsuariosBootstrapService` (implementa `OnApplicationBootstrap`).

- [ ] **Paso 1: Escribir los tests (fallan)**

`backend/src/modules/usuarios/usuarios-bootstrap.service.spec.ts`:

```ts
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { Rol } from './entities/rol.entity.js';
import type { Usuario } from './entities/usuario.entity.js';
import { PasswordService } from './password.service.js';
import { UsuariosBootstrapService } from './usuarios-bootstrap.service.js';

function crear(cantidad: number, env: Record<string, string | undefined>) {
  const usuarios = {
    count: vi.fn(async () => cantidad),
    save: vi.fn(async (u: unknown) => u),
    create: vi.fn((u: unknown) => u),
  } as unknown as Repository<Usuario>;
  const roles = {
    findOneByOrFail: vi.fn(async () => ({ id: 6, codigo: 'administrador' }) as Rol),
  } as unknown as Repository<Rol>;
  const config = { get: (k: string) => env[k] } as unknown as ConfigService<never, true>;
  return {
    servicio: new UsuariosBootstrapService(usuarios, roles, new PasswordService(), config),
    usuarios,
  };
}

describe('UsuariosBootstrapService', () => {
  it('crea el administrador si no hay usuarios', async () => {
    const { servicio, usuarios } = crear(0, {
      ADMIN_USUARIO: 'Admin',
      ADMIN_CLAVE: 'clave-larga-123',
    });
    await servicio.onApplicationBootstrap();
    const creado = (usuarios.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(creado.nombreUsuario).toBe('admin');
    expect(creado.activo).toBe(true);
    expect(creado.idPersona).toBeNull();
    expect(creado.claveHash).toMatch(/^\$argon2id\$/);
  });

  it('no hace nada si ya hay usuarios, aunque falten las variables', async () => {
    const { servicio, usuarios } = crear(2, {});
    await servicio.onApplicationBootstrap();
    expect(usuarios.save).not.toHaveBeenCalled();
  });

  it('falla y lo informa si no hay usuarios y faltan las variables', async () => {
    const { servicio } = crear(0, {});
    await expect(servicio.onApplicationBootstrap()).rejects.toThrow(
      /ADMIN_USUARIO y ADMIN_CLAVE/,
    );
  });

  it('falla si la clave tiene menos de 10 caracteres', async () => {
    const { servicio } = crear(0, { ADMIN_USUARIO: 'admin', ADMIN_CLAVE: 'corta' });
    await expect(servicio.onApplicationBootstrap()).rejects.toThrow(/10 caracteres/);
  });
});
```

- [ ] **Paso 2: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/usuarios-bootstrap.service.spec.ts
```

Esperado: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar**

`backend/src/modules/usuarios/usuarios-bootstrap.service.ts`:

```ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES } from '../../common/roles.js';
import type { Env } from '../../infra/config/env.validation.js';
import { normalizarNombreUsuario } from './auth.service.js';
import { Rol } from './entities/rol.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { LARGO_MINIMO_CLAVE, PasswordService } from './password.service.js';

/** Crea el primer administrador desde el `.env` cuando la tabla de usuarios está vacía. */
@Injectable()
export class UsuariosBootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger(UsuariosBootstrapService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.usuarios.count()) > 0) return;

    const nombre = this.config.get('ADMIN_USUARIO', { infer: true });
    const clave = this.config.get('ADMIN_CLAVE', { infer: true });
    if (!nombre || !clave) {
      throw new Error(
        'No hay usuarios: definí ADMIN_USUARIO y ADMIN_CLAVE en el .env para crear el administrador inicial',
      );
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      throw new Error(
        `ADMIN_CLAVE debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres`,
      );
    }

    const rol = await this.roles.findOneByOrFail({ codigo: ROLES.administrador });
    await this.usuarios.save(
      this.usuarios.create({
        nombreUsuario: normalizarNombreUsuario(nombre),
        claveHash: await this.passwords.hashear(clave),
        rol,
        idPersona: null,
        activo: true,
      }),
    );
    this.log.log(`Administrador inicial "${normalizarNombreUsuario(nombre)}" creado`);
  }
}
```

- [ ] **Paso 4: Registrarlo**

En `usuarios.module.ts`, importar `UsuariosBootstrapService` y agregarlo a `providers` (antes de los `APP_GUARD`).

- [ ] **Paso 5: Tests y verificación con la base real**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/usuarios-bootstrap.service.spec.ts
docker compose restart backend && sleep 10
docker compose logs --tail 20 backend | grep -i "administrador inicial"
curl -s -o /dev/null -w "login admin: %{http_code}\n" -XPOST localhost:3000/api/auth/login -H 'content-type: application/json' -d "{\"nombreUsuario\":\"$(grep ^ADMIN_USUARIO= .env | cut -d= -f2)\",\"clave\":\"$(grep ^ADMIN_CLAVE= .env | cut -d= -f2)\"}"
```

Esperado: 4 tests PASS; el log muestra "Administrador inicial ... creado" (solo la primera vez, con la tabla vacía); `login admin: 200`.

- [ ] **Paso 6: Commit**

```bash
git add backend/src/modules/usuarios
git commit -m "Crear el primer administrador al arrancar desde el .env"
```

---

### Tarea 9: AlcanceService (alcance por unidad)

**Archivos:**
- Crear: `backend/src/modules/usuarios/alcance.service.ts`
- Modificar: `backend/src/modules/usuarios/usuarios.module.ts`
- Prueba: `backend/src/modules/usuarios/alcance.service.spec.ts`

**Interfaces:**
- Consume: `SesionUsuario`, `ROLES_GLOBALES`, `ROLES_CON_ALCANCE_POR_UNIDAD`, `DataSource`.
- Produce: `AlcanceService` con `unidadesVisibles(usuario: SesionUsuario): Promise<number[] | null>` (`null` = sin restricción) y `exigirUnidad(usuario: SesionUsuario, idUnidad: number): Promise<void>` (lanza `ForbiddenException`). Exportado por `UsuariosModule`.

- [ ] **Paso 1: Escribir los tests (fallan)**

`backend/src/modules/usuarios/alcance.service.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { CodigoRol } from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import { AlcanceService } from './alcance.service.js';

const sesion = (rol: CodigoRol, unidades: number[] = []): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona: null,
  unidades,
});

function crear(descendientes: number[]) {
  const query = vi.fn(async () => descendientes.map((id_unidad) => ({ id_unidad })));
  return { servicio: new AlcanceService({ query } as unknown as DataSource), query };
}

describe('AlcanceService.unidadesVisibles', () => {
  it.each(['analista_puestos', 'recursos_humanos', 'autoridad'] as CodigoRol[])(
    'no restringe al rol global %s',
    async (rol) => {
      const { servicio, query } = crear([]);
      expect(await servicio.unidadesVisibles(sesion(rol))).toBeNull();
      expect(query).not.toHaveBeenCalled();
    },
  );

  it('devuelve las unidades asignadas más sus descendientes a la jefatura', async () => {
    const { servicio, query } = crear([1, 2, 3, 4]);
    expect(await servicio.unidadesVisibles(sesion('jefatura_departamento', [1]))).toEqual([1, 2, 3, 4]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WITH RECURSIVE'), [[1]]);
  });

  it('limita al jefe de cátedra a su cátedra', async () => {
    const { servicio } = crear([3]);
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra', [3]))).toEqual([3]);
  });

  it('no consulta la base si el jefe no tiene unidades asignadas y ve solo lo vacío', async () => {
    const { servicio, query } = crear([]);
    expect(await servicio.unidadesVisibles(sesion('jefe_catedra', []))).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it.each(['administrador', 'docente'] as CodigoRol[])(
    'no da visibilidad por unidad al rol %s',
    async (rol) => {
      const { servicio } = crear([9]);
      expect(await servicio.unidadesVisibles(sesion(rol))).toEqual([]);
    },
  );
});

describe('AlcanceService.exigirUnidad', () => {
  it('deja pasar a un rol global en cualquier unidad', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirUnidad(sesion('recursos_humanos'), 99)).resolves.toBeUndefined();
  });

  it('deja pasar una unidad dentro del alcance', async () => {
    const { servicio } = crear([1, 2]);
    await expect(
      servicio.exigirUnidad(sesion('jefatura_departamento', [1]), 2),
    ).resolves.toBeUndefined();
  });

  it('rechaza con 403 una unidad fuera del alcance', async () => {
    const { servicio } = crear([3]);
    await expect(
      servicio.exigirUnidad(sesion('jefe_catedra', [3]), 7),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Paso 2: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/alcance.service.spec.ts
```

Esperado: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar**

`backend/src/modules/usuarios/alcance.service.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ROLES_CON_ALCANCE_POR_UNIDAD,
  ROLES_GLOBALES,
} from '../../common/roles.js';
import type { SesionUsuario } from '../../common/sesion-usuario.js';

/** Unidades asignadas más todas sus descendientes por la jerarquía recursiva. */
const SQL_DESCENDIENTES = `
  WITH RECURSIVE arbol AS (
    SELECT id_unidad FROM unidad_organizativa WHERE id_unidad = ANY($1)
    UNION
    SELECT u.id_unidad
    FROM unidad_organizativa u
    JOIN arbol a ON u.id_unidad_superior = a.id_unidad
  )
  SELECT id_unidad FROM arbol`;

/**
 * Alcance por unidad (RF24). Los services de criticidad y sucesión lo aplican
 * como filtro por `puesto.id_unidad`.
 */
@Injectable()
export class AlcanceService {
  constructor(private readonly dataSource: DataSource) {}

  /** `null` significa sin restricción; un arreglo vacío, ninguna unidad visible. */
  async unidadesVisibles(usuario: SesionUsuario): Promise<number[] | null> {
    if (ROLES_GLOBALES.includes(usuario.rol)) return null;
    if (!ROLES_CON_ALCANCE_POR_UNIDAD.includes(usuario.rol)) return [];
    if (usuario.unidades.length === 0) return [];

    const filas: { id_unidad: number }[] = await this.dataSource.query(
      SQL_DESCENDIENTES,
      [usuario.unidades],
    );
    return filas.map((f) => Number(f.id_unidad));
  }

  async exigirUnidad(usuario: SesionUsuario, idUnidad: number): Promise<void> {
    const visibles = await this.unidadesVisibles(usuario);
    if (visibles !== null && !visibles.includes(idUnidad)) {
      throw new ForbiddenException('La unidad está fuera de tu alcance');
    }
  }
}
```

- [ ] **Paso 4: Registrarlo y exportarlo**

En `usuarios.module.ts`: importar `AlcanceService`, agregarlo a `providers` y a `exports`.

- [ ] **Paso 5: Correr los tests**

```bash
docker compose exec -T backend npx vitest run src/modules/usuarios/alcance.service.spec.ts
```

Esperado: 11 tests PASS (3 globales, 1 jefatura, 1 jefe de cátedra, 1 sin unidades, 2 sin visibilidad y 3 de `exigirUnidad`).

- [ ] **Paso 6: Commit**

```bash
git add backend/src/modules/usuarios
git commit -m "Agregar AlcanceService para el alcance por unidad (RF24)"
```

---

### Tarea 10: Auditoría (RNF05)

**Archivos:**
- Crear: `backend/src/infra/auditoria/contexto-usuario.ts`
- Crear: `backend/src/infra/auditoria/auditoria.subscriber.ts`
- Crear: `backend/src/infra/auditoria/auditoria.service.ts`
- Crear: `backend/src/infra/auditoria/auditoria.controller.ts`
- Crear: `backend/src/infra/auditoria/dto/{auditoria,consulta-auditoria}.dto.ts`
- Crear: `backend/src/infra/auditoria/auditoria.module.ts`
- Modificar: `backend/src/infra/sesion/sesion.config.ts`, `backend/src/app.module.ts`
- Prueba: `backend/src/infra/auditoria/auditoria.subscriber.spec.ts`, `backend/src/infra/auditoria/auditoria.service.spec.ts`

**Interfaces:**
- Consume: entidad `Auditoria`, `SesionUsuario`.
- Produce: `contextoUsuario` (`AsyncLocalStorage<{ idUsuario: number | null }>`), `ENTIDADES_AUDITADAS`, `AuditoriaSubscriber`, `AuditoriaService.consultar(filtro): Promise<AuditoriaDto[]>` y `GET /api/auditoria`.

- [ ] **Paso 1: Crear el contexto por petición**

`backend/src/infra/auditoria/contexto-usuario.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

/** Usuario de la petición en curso; lo lee el subscriber de auditoría. */
export const contextoUsuario = new AsyncLocalStorage<{ idUsuario: number | null }>();

export function usuarioDelContexto(): number | null {
  return contextoUsuario.getStore()?.idUsuario ?? null;
}
```

En `backend/src/infra/sesion/sesion.config.ts` agregar los imports `import type { SesionUsuario } from '../../common/sesion-usuario.js';` y `import { contextoUsuario } from '../auditoria/contexto-usuario.js';`, y al final de `configurarSesion`, después de `app.use(passport.session())`:

```ts
  app.use((req: { user?: SesionUsuario }, _res: unknown, siguiente: () => void) =>
    contextoUsuario.run({ idUsuario: req.user?.id ?? null }, siguiente),
  );
```

- [ ] **Paso 2: Escribir los tests del subscriber (fallan)**

`backend/src/infra/auditoria/auditoria.subscriber.spec.ts`:

```ts
import type { DataSource } from 'typeorm';
import { Auditoria } from './auditoria.entity.js';
import { AuditoriaSubscriber } from './auditoria.subscriber.js';
import { contextoUsuario } from './contexto-usuario.js';

function evento(tabla: string, extra: Record<string, unknown> = {}) {
  const insert = vi.fn(async () => undefined);
  return {
    insert,
    evento: {
      metadata: {
        tableName: tabla,
        primaryColumns: [{ getEntityValue: (e: { id: number }) => e.id }],
      },
      manager: { insert },
      ...extra,
    } as never,
  };
}

const subscriber = () =>
  new AuditoriaSubscriber({ subscribers: [] } as unknown as DataSource);
const comoUsuario = <T>(id: number | null, fn: () => T) =>
  contextoUsuario.run({ idUsuario: id }, fn);

describe('AuditoriaSubscriber', () => {
  it('se registra en el DataSource', () => {
    const ds = { subscribers: [] as unknown[] };
    const s = new AuditoriaSubscriber(ds as unknown as DataSource);
    expect(ds.subscribers).toContain(s);
  });

  it('registra un alta con el registro completo y el usuario', async () => {
    const { insert, evento: e } = evento('plan_sucesion', {
      entity: { id: 5, estado: 'borrador' },
    });
    await comoUsuario(7, () => subscriber().afterInsert(e));
    expect(insert).toHaveBeenCalledWith(Auditoria, {
      entidad: 'plan_sucesion',
      idRegistro: '5',
      operacion: 'alta',
      idUsuario: 7,
      valoresAnteriores: null,
      valoresNuevos: { id: 5, estado: 'borrador' },
    });
  });

  it('registra solo las columnas modificadas con su valor anterior y el nuevo', async () => {
    const { insert, evento: e } = evento('evaluacion_criticidad', {
      entity: { id: 3, nivel: 'alta', observaciones: 'x' },
      databaseEntity: { id: 3, nivel: 'media', observaciones: 'x' },
      updatedColumns: [{ propertyName: 'nivel', databaseName: 'nivel' }],
    });
    await comoUsuario(7, () => subscriber().afterUpdate(e));
    expect(insert).toHaveBeenCalledWith(
      Auditoria,
      expect.objectContaining({
        operacion: 'modificacion',
        valoresAnteriores: { nivel: 'media' },
        valoresNuevos: { nivel: 'alta' },
      }),
    );
  });

  it('no registra una modificación sin columnas cambiadas', async () => {
    const { insert, evento: e } = evento('plan_sucesion', {
      entity: { id: 3 },
      databaseEntity: { id: 3 },
      updatedColumns: [],
    });
    await comoUsuario(7, () => subscriber().afterUpdate(e));
    expect(insert).not.toHaveBeenCalled();
  });

  it('registra una baja con el registro anterior', async () => {
    const { insert, evento: e } = evento('candidato_sucesion', {
      databaseEntity: { id: 8, prioridad: 1 },
      entityId: 8,
    });
    await comoUsuario(7, () => subscriber().afterRemove(e));
    expect(insert).toHaveBeenCalledWith(
      Auditoria,
      expect.objectContaining({ operacion: 'baja', idRegistro: '8', valoresAnteriores: { id: 8, prioridad: 1 }, valoresNuevos: null }),
    );
  });

  it('ignora las entidades que no están en la lista auditada', async () => {
    const { insert, evento: e } = evento('persona', { entity: { id: 1 } });
    await comoUsuario(7, () => subscriber().afterInsert(e));
    expect(insert).not.toHaveBeenCalled();
  });

  it('falla si se escribe una entidad auditada sin usuario en el contexto', async () => {
    const { evento: e } = evento('plan_sucesion', { entity: { id: 1 } });
    await expect(comoUsuario(null, () => subscriber().afterInsert(e))).rejects.toThrow(
      /usuario autenticado/,
    );
  });
});
```

- [ ] **Paso 3: Correrlos y verlos fallar**

```bash
docker compose exec -T backend npx vitest run src/infra/auditoria/auditoria.subscriber.spec.ts
```

Esperado: FAIL (módulo inexistente).

- [ ] **Paso 4: Implementar el subscriber**

`backend/src/infra/auditoria/auditoria.subscriber.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { Auditoria, type OperacionAuditada } from './auditoria.entity.js';
import { usuarioDelContexto } from './contexto-usuario.js';

/** Tablas cuyos cambios se auditan (RNF05). Se declaran aunque aún no existan. */
export const ENTIDADES_AUDITADAS = [
  'evaluacion_criticidad',
  'plan_sucesion',
  'candidato_sucesion',
];

type Registro = Record<string, unknown>;

/**
 * Escribe en `auditoria`, dentro de la misma transacción, cada alta, modificación
 * y baja de las entidades auditadas. Sin usuario en el contexto, falla.
 */
@Injectable()
export class AuditoriaSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  afterInsert(evento: InsertEvent<Registro>): Promise<void> | void {
    return this.registrar(evento, 'alta', evento.entity as Registro, null, evento.entity as Registro);
  }

  afterUpdate(evento: UpdateEvent<Registro>): Promise<void> | void {
    const columnas = evento.updatedColumns ?? [];
    if (columnas.length === 0 || !evento.entity || !evento.databaseEntity) return;

    const anteriores: Registro = {};
    const nuevos: Registro = {};
    for (const columna of columnas) {
      anteriores[columna.databaseName] = evento.databaseEntity[columna.propertyName];
      nuevos[columna.databaseName] = (evento.entity as Registro)[columna.propertyName];
    }
    return this.registrar(evento, 'modificacion', evento.entity as Registro, anteriores, nuevos);
  }

  afterRemove(evento: RemoveEvent<Registro>): Promise<void> | void {
    const anterior = evento.databaseEntity as Registro;
    return this.registrar(evento, 'baja', anterior, anterior, null);
  }

  private async registrar(
    evento: InsertEvent<Registro> | UpdateEvent<Registro> | RemoveEvent<Registro>,
    operacion: OperacionAuditada,
    registro: Registro,
    valoresAnteriores: Registro | null,
    valoresNuevos: Registro | null,
  ): Promise<void> {
    const tabla = evento.metadata.tableName;
    if (!ENTIDADES_AUDITADAS.includes(tabla)) return;

    const idUsuario = usuarioDelContexto();
    if (idUsuario === null) {
      throw new Error(
        `No se puede modificar "${tabla}" sin un usuario autenticado: la operación no quedaría auditada`,
      );
    }

    const idRegistro = evento.metadata.primaryColumns
      .map((c) => String(c.getEntityValue(registro)))
      .join('-');

    await evento.manager.insert(Auditoria, {
      entidad: tabla,
      idRegistro,
      operacion,
      idUsuario,
      valoresAnteriores,
      valoresNuevos,
    });
  }
}
```

- [ ] **Paso 5: Correr los tests del subscriber**

```bash
docker compose exec -T backend npx vitest run src/infra/auditoria/auditoria.subscriber.spec.ts
```

Esperado: 7 tests PASS. Si `afterRemove` falla porque `getEntityValue` recibe un registro sin `id`, usar `evento.entityId` como valor del `idRegistro` cuando exista; el test de baja aporta `entityId: 8`.

- [ ] **Paso 6: DTOs, servicio y controller de consulta**

`backend/src/infra/auditoria/dto/auditoria.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class AuditoriaDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ example: 'plan_sucesion' })
  entidad: string;

  @ApiProperty({ example: '5' })
  idRegistro: string;

  @ApiProperty({ enum: ['alta', 'modificacion', 'baja'] })
  operacion: string;

  @ApiProperty()
  idUsuario: number;

  @ApiProperty()
  fecha: Date;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  valoresAnteriores: Record<string, unknown> | null;

  @ApiProperty({ nullable: true, type: 'object', additionalProperties: true })
  valoresNuevos: Record<string, unknown> | null;
}
```

`backend/src/infra/auditoria/dto/consulta-auditoria.dto.ts`:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConsultaAuditoriaDto {
  @ApiPropertyOptional({ example: 'plan_sucesion' })
  @IsOptional()
  @IsString()
  entidad?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  idRegistro?: string;
}
```

Test del servicio, `backend/src/infra/auditoria/auditoria.service.spec.ts`:

```ts
import type { Repository } from 'typeorm';
import type { Auditoria } from './auditoria.entity.js';
import { AuditoriaService } from './auditoria.service.js';

describe('AuditoriaService.consultar', () => {
  it('filtra por entidad y registro y ordena de lo más reciente a lo más antiguo', async () => {
    const find = vi.fn(async () => []);
    const servicio = new AuditoriaService({ find } as unknown as Repository<Auditoria>);
    await servicio.consultar({ entidad: 'plan_sucesion', idRegistro: '5' });
    expect(find).toHaveBeenCalledWith({
      where: { entidad: 'plan_sucesion', idRegistro: '5' },
      order: { fecha: 'DESC', id: 'DESC' },
      take: 200,
    });
  });

  it('sin filtros consulta todo con el mismo tope', async () => {
    const find = vi.fn(async () => []);
    const servicio = new AuditoriaService({ find } as unknown as Repository<Auditoria>);
    await servicio.consultar({});
    expect(find).toHaveBeenCalledWith({
      where: {},
      order: { fecha: 'DESC', id: 'DESC' },
      take: 200,
    });
  });
});
```

`backend/src/infra/auditoria/auditoria.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './auditoria.entity.js';
import type { AuditoriaDto } from './dto/auditoria.dto.js';
import type { ConsultaAuditoriaDto } from './dto/consulta-auditoria.dto.js';

const TOPE = 200;

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria) private readonly auditoria: Repository<Auditoria>,
  ) {}

  async consultar(filtro: ConsultaAuditoriaDto): Promise<AuditoriaDto[]> {
    const filas = await this.auditoria.find({
      where: {
        ...(filtro.entidad && { entidad: filtro.entidad }),
        ...(filtro.idRegistro && { idRegistro: filtro.idRegistro }),
      },
      order: { fecha: 'DESC', id: 'DESC' },
      take: TOPE,
    });
    return filas.map((f) => ({
      id: f.id,
      entidad: f.entidad,
      idRegistro: f.idRegistro,
      operacion: f.operacion,
      idUsuario: f.idUsuario,
      fecha: f.fecha,
      valoresAnteriores: f.valoresAnteriores,
      valoresNuevos: f.valoresNuevos,
    }));
  }
}
```

`backend/src/infra/auditoria/auditoria.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ROLES } from '../../common/roles.js';
import { AuditoriaService } from './auditoria.service.js';
import { AuditoriaDto } from './dto/auditoria.dto.js';
import { ConsultaAuditoriaDto } from './dto/consulta-auditoria.dto.js';

/** Bitácora de solo lectura (RNF05). */
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly servicio: AuditoriaService) {}

  @Get()
  @Roles(ROLES.recursosHumanos, ROLES.autoridad)
  @ApiOkResponse({ type: AuditoriaDto, isArray: true })
  consultar(@Query() filtro: ConsultaAuditoriaDto): Promise<AuditoriaDto[]> {
    return this.servicio.consultar(filtro);
  }
}
```

`backend/src/infra/auditoria/auditoria.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from './auditoria.entity.js';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';
import { AuditoriaSubscriber } from './auditoria.subscriber.js';

@Module({
  imports: [TypeOrmModule.forFeature([Auditoria])],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaSubscriber],
})
export class AuditoriaModule {}
```

En `backend/src/app.module.ts` importar `AuditoriaModule` (`import { AuditoriaModule } from './infra/auditoria/auditoria.module.js';`) y agregarlo a `imports` después de `StorageModule`.

- [ ] **Paso 7: Verificar**

```bash
docker compose exec -T backend npx prettier --write "src/**/*.ts" > /dev/null
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
```

Esperado: lint sin avisos y todos los tests PASS, incluido `cobertura-roles` (el controller de auditoría declara `@Roles`).

- [ ] **Paso 8: Verificación manual de la consulta**

```bash
sleep 8; B=localhost:3000/api; J=/tmp/claude-1000/cookies.txt
curl -s -c $J -o /dev/null -XPOST $B/auth/login -H 'content-type: application/json' -d "{\"nombreUsuario\":\"$(grep ^ADMIN_USUARIO= .env | cut -d= -f2)\",\"clave\":\"$(grep ^ADMIN_CLAVE= .env | cut -d= -f2)\"}"
curl -s -b $J -o /dev/null -w "auditoria como administrador: %{http_code}\n" $B/auditoria
```

Esperado: `403` (el administrador no accede a la bitácora; solo `recursos_humanos` y `autoridad`).

- [ ] **Paso 9: Commit**

```bash
git add backend/src
git commit -m "Agregar bitácora de auditoría con subscriber y consulta (RNF05)"
```

---

### Tarea 11: Frontend, sesión, login y rutas protegidas

**Archivos:**
- Modificar: `frontend/src/api/esquema.d.ts` (regenerar)
- Crear: `frontend/src/auth/{permisos.ts,useSesion.ts,LoginPage.tsx,RutaProtegida.tsx}`
- Modificar: `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consume: `GET /api/auth/yo`, `POST /api/auth/login`, `POST /api/auth/logout`.
- Produce: `useSesion()` (devuelve `Esquemas['SesionDto'] | null`), `RutaProtegida`, `SECCIONES` y `puedeVer(rol, seccion)` en `permisos.ts`.

- [ ] **Paso 1: Regenerar los tipos**

Con el backend corriendo:

```bash
cd frontend && npm run api:tipos && grep -c "auth/login" src/api/esquema.d.ts
```

Esperado: un número mayor que 0.

- [ ] **Paso 2: Crear `permisos.ts`**

`frontend/src/auth/permisos.ts`:

```ts
/** Secciones del menú y los roles que las ven (primer avance §5; es solo navegación). */
export interface Seccion {
  ruta: string;
  nombre: string;
  /** Sin roles: la ve cualquier usuario autenticado. */
  roles?: string[];
}

export const SECCIONES: Seccion[] = [
  { ruta: '/', nombre: 'Tablero de riesgo' },
  {
    ruta: '/estructura',
    nombre: 'Estructura y puestos',
    roles: ['analista_puestos', 'jefatura_departamento', 'jefe_catedra'],
  },
  { ruta: '/personas', nombre: 'Personas', roles: ['recursos_humanos', 'docente'] },
  {
    ruta: '/conocimiento',
    nombre: 'Conocimiento',
    roles: ['analista_puestos', 'jefe_catedra', 'docente'],
  },
  {
    ruta: '/criticidad',
    nombre: 'Criticidad',
    roles: ['recursos_humanos', 'autoridad', 'jefatura_departamento', 'jefe_catedra'],
  },
  {
    ruta: '/sucesion',
    nombre: 'Sucesión',
    roles: ['recursos_humanos', 'autoridad', 'jefatura_departamento', 'docente'],
  },
  { ruta: '/admin', nombre: 'Administración', roles: ['administrador'] },
];

export function puedeVer(rol: string, seccion: Seccion): boolean {
  return !seccion.roles || seccion.roles.includes(rol);
}
```

- [ ] **Paso 3: Crear `useSesion.ts`**

`frontend/src/auth/useSesion.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api, type Esquemas } from '../api/cliente';

export type Sesion = Esquemas['SesionDto'];

/** Usuario autenticado, o null si no hay sesión (401). */
export function useSesion() {
  return useQuery({
    queryKey: ['sesion'],
    queryFn: async (): Promise<Sesion | null> => {
      const { data, response } = await api.GET('/api/auth/yo');
      if (response.status === 401) return null;
      if (!data) throw new Error('No se pudo consultar la sesión');
      return data;
    },
    retry: false,
    staleTime: 60_000,
  });
}
```

- [ ] **Paso 4: Crear `RutaProtegida.tsx`**

`frontend/src/auth/RutaProtegida.tsx`:

```tsx
import { Alert, CircularProgress } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from './useSesion';

interface Props {
  /** Sin roles: basta con haber iniciado sesión. */
  roles?: string[];
  children: ReactNode;
}

export function RutaProtegida({ roles, children }: Props) {
  const { data: sesion, isLoading } = useSesion();
  const ubicacion = useLocation();

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (!sesion) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }
  if (roles && !roles.includes(sesion.rol)) {
    return (
      <Alert severity="warning">No tenés permiso para ver esta sección.</Alert>
    );
  }
  return children;
}
```

- [ ] **Paso 5: Crear `LoginPage.tsx`**

`frontend/src/auth/LoginPage.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { api } from '../api/cliente';

const esquema = z.object({
  nombreUsuario: z.string().min(1, 'Ingresá tu usuario'),
  clave: z.string().min(1, 'Ingresá tu clave'),
});
type Datos = z.infer<typeof esquema>;

export function LoginPage() {
  const [error, setError] = useState<string>();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const cliente = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const ingresar = handleSubmit(async (datos) => {
    setError(undefined);
    const { data } = await api.POST('/api/auth/login', { body: datos });
    if (!data) {
      setError('Usuario o clave incorrectos');
      return;
    }
    cliente.setQueryData(['sesion'], data);
    const desde = (ubicacion.state as { desde?: string } | null)?.desde ?? '/';
    navegar(desde, { replace: true });
  });

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper component="form" onSubmit={ingresar} noValidate sx={{ p: 4, width: 360 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Gestión del conocimiento crítico
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Usuario"
            autoComplete="username"
            autoFocus
            {...register('nombreUsuario')}
            error={!!errors.nombreUsuario}
            helperText={errors.nombreUsuario?.message}
          />
          <TextField
            label="Clave"
            type="password"
            autoComplete="current-password"
            {...register('clave')}
            error={!!errors.clave}
            helperText={errors.clave?.message}
          />
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Ingresar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
```

- [ ] **Paso 6: Actualizar el router**

Reemplazar `frontend/src/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router';
import { LoginPage } from './auth/LoginPage';
import { RutaProtegida } from './auth/RutaProtegida';
import { Layout } from './components/Layout';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ConocimientoPage } from './features/conocimiento/pages/ConocimientoPage';
import { CriticidadPage } from './features/criticidad/pages/CriticidadPage';
import { EstructuraPage } from './features/estructura/pages/EstructuraPage';
import { PersonasPage } from './features/personas/pages/PersonasPage';
import { SucesionPage } from './features/sucesion/pages/SucesionPage';
import { TableroPage } from './features/tablero/pages/TableroPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RutaProtegida>
        <Layout />
      </RutaProtegida>
    ),
    children: [
      { index: true, element: <TableroPage /> },
      { path: 'estructura', element: <EstructuraPage /> },
      { path: 'personas', element: <PersonasPage /> },
      { path: 'conocimiento', element: <ConocimientoPage /> },
      { path: 'criticidad', element: <CriticidadPage /> },
      { path: 'sucesion', element: <SucesionPage /> },
      {
        path: 'admin',
        element: (
          <RutaProtegida roles={['administrador']}>
            <AdminPage />
          </RutaProtegida>
        ),
      },
    ],
  },
]);
```

- [ ] **Paso 7: Actualizar el Layout (menú por rol y cerrar sesión)**

En `frontend/src/components/Layout.tsx`:
- Reemplazar los imports y la constante `secciones` por:

```tsx
import {
  AppBar,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../api/cliente';
import { puedeVer, SECCIONES } from '../auth/permisos';
import { useSesion } from '../auth/useSesion';

const ANCHO_MENU = 240;
```

- Dentro de `Layout()`, antes del `return`:

```tsx
  const { data: sesion } = useSesion();
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const cerrarSesion = async () => {
    await api.POST('/api/auth/logout');
    cliente.setQueryData(['sesion'], null);
    cliente.clear();
    navegar('/login', { replace: true });
  };
  const secciones = SECCIONES.filter((s) => sesion && puedeVer(sesion.rol, s));
```

- En el `<Toolbar>` del `AppBar`, después del `Typography` del título, agregar:

```tsx
          <Box sx={{ flexGrow: 1 }} />
          <Typography sx={{ mr: 2 }}>{sesion?.nombreUsuario}</Typography>
          <Button color="inherit" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
```

- En el `map` de `secciones`, cambiar `{s.nombre}`: el JSX usa `s.nombre` y `s.ruta`, que se mantienen.

- [ ] **Paso 8: Verificar**

```bash
cd frontend && npx prettier --write "src/**/*.{ts,tsx}" > /dev/null && npm run lint && npm run build
```

Esperado: lint sin avisos y build exitoso. Luego, con el backend y el frontend corriendo, abrir http://localhost:5173: debe redirigir a `/login`; ingresar con `ADMIN_USUARIO` y `ADMIN_CLAVE` del `.env` lleva al tablero; el menú muestra Administración; "Cerrar sesión" vuelve al login; una clave errónea muestra "Usuario o clave incorrectos".

- [ ] **Paso 9: Commit**

```bash
git add frontend/src
git commit -m "Agregar login, sesión y rutas protegidas por rol en el frontend"
```

---

### Tarea 12: Frontend, pestaña Usuarios y retiro del token provisorio

**Archivos:**
- Crear: `frontend/src/features/admin/hooks/useUsuarios.ts`
- Crear: `frontend/src/features/admin/components/{TablaUsuarios,FormularioUsuario,RestablecerClaveDialog}.tsx`
- Modificar: `frontend/src/features/admin/pages/AdminPage.tsx`, `frontend/src/features/admin/hooks/useGuardarValor.ts`, `frontend/src/api/esquema.d.ts` (regenerar)

**Interfaces:**
- Consume: `GET|POST /api/usuarios`, `GET /api/usuarios/roles`, `PATCH /api/usuarios/{id}`, `POST /api/usuarios/{id}/restablecer-clave`.
- Produce: pestaña **Usuarios** en Administración; `useGuardarValor.ts` sin token (`encabezados`, `leerToken` y `guardarToken` se eliminan).

- [ ] **Paso 1: Quitar el token provisorio de `useGuardarValor.ts`**

En `frontend/src/features/admin/hooks/useGuardarValor.ts`:
- Eliminar `CLAVE_TOKEN`, `leerToken`, `guardarToken` y `encabezados`.
- Quitar `headers: encabezados(),` de las tres mutaciones.
- Mantener `mensajeError`.

- [ ] **Paso 2: Crear los hooks de usuarios**

`frontend/src/features/admin/hooks/useUsuarios.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Esquemas } from '../../../api/cliente';
import { mensajeError } from './useGuardarValor';

export type Usuario = Esquemas['UsuarioDto'];
type CrearUsuario = Esquemas['CrearUsuarioDto'];
type ActualizarUsuario = Esquemas['ActualizarUsuarioDto'];

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/usuarios');
      if (error || !data) throw new Error('No se pudieron cargar los usuarios');
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['usuarios', 'roles'],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/usuarios/roles');
      if (error || !data) throw new Error('No se pudieron cargar los roles');
      return data;
    },
  });
}

function useInvalidarUsuarios() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: ['usuarios'] });
}

export function useCrearUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async (cuerpo: CrearUsuario) => {
      const { data, error } = await api.POST('/api/usuarios', { body: cuerpo });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useActualizarUsuario() {
  const invalidar = useInvalidarUsuarios();
  return useMutation({
    mutationFn: async (args: { id: number; cuerpo: ActualizarUsuario }) => {
      const { data, error } = await api.PATCH('/api/usuarios/{id}', {
        params: { path: { id: args.id } },
        body: args.cuerpo,
      });
      if (error || !data) throw new Error(mensajeError(error));
      return data;
    },
    onSuccess: invalidar,
  });
}

export function useRestablecerClave() {
  return useMutation({
    mutationFn: async (args: { id: number; clave: string }) => {
      const { error } = await api.POST('/api/usuarios/{id}/restablecer-clave', {
        params: { path: { id: args.id } },
        body: { clave: args.clave },
      });
      if (error) throw new Error(mensajeError(error));
    },
  });
}
```

- [ ] **Paso 3: Crear `FormularioUsuario.tsx`**

`frontend/src/features/admin/components/FormularioUsuario.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useActualizarUsuario, useCrearUsuario, useRoles, type Usuario } from '../hooks/useUsuarios';

interface Props {
  /** Sin usuario, el formulario crea uno nuevo. */
  usuario?: Usuario;
  onCerrar: () => void;
}

function crearEsquema(esAlta: boolean) {
  return z.object({
    nombreUsuario: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{3,50}$/, '3 a 50 caracteres: letras, números, punto, guion y guion bajo'),
    clave: esAlta
      ? z.string().min(10, 'Al menos 10 caracteres')
      : z.string().optional(),
    rol: z.string().min(1, 'Elegí un rol'),
  });
}
type Datos = z.infer<ReturnType<typeof crearEsquema>>;

/** Se monta solo mientras está abierto, por lo que parte siempre de cero. */
export function FormularioUsuario({ usuario, onCerrar }: Props) {
  const esAlta = !usuario;
  const esquema = useMemo(() => crearEsquema(esAlta), [esAlta]);
  const { data: roles } = useRoles();
  const crear = useCrearUsuario();
  const actualizar = useActualizarUsuario();
  const [error, setError] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreUsuario: usuario?.nombreUsuario ?? '',
      clave: '',
      rol: usuario?.rol ?? '',
    },
  });

  const guardar = handleSubmit(async (datos) => {
    try {
      if (usuario) {
        await actualizar.mutateAsync({
          id: usuario.id,
          cuerpo: { nombreUsuario: datos.nombreUsuario, rol: datos.rol as never },
        });
      } else {
        await crear.mutateAsync({
          nombreUsuario: datos.nombreUsuario,
          clave: datos.clave ?? '',
          rol: datos.rol as never,
        });
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>{usuario ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Usuario"
              {...register('nombreUsuario')}
              error={!!errors.nombreUsuario}
              helperText={errors.nombreUsuario?.message}
              autoFocus
            />
            {esAlta && (
              <TextField
                label="Clave"
                type="password"
                {...register('clave')}
                error={!!errors.clave}
                helperText={errors.clave?.message ?? 'Al menos 10 caracteres'}
              />
            )}
            <TextField
              select
              label="Rol"
              defaultValue={usuario?.rol ?? ''}
              {...register('rol')}
              error={!!errors.rol}
              helperText={
                errors.rol?.message ??
                'El rol docente exige vincular una persona, que se habilita cuando exista el módulo de personas'
              }
            >
              {(roles ?? []).map((r) => (
                <MenuItem key={r.codigo} value={r.codigo}>
                  {r.denominacion}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Paso 4: Crear `RestablecerClaveDialog.tsx`**

`frontend/src/features/admin/components/RestablecerClaveDialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRestablecerClave, type Usuario } from '../hooks/useUsuarios';

const esquema = z.object({ clave: z.string().min(10, 'Al menos 10 caracteres') });
type Datos = z.infer<typeof esquema>;

interface Props {
  usuario: Usuario;
  onCerrar: () => void;
}

export function RestablecerClaveDialog({ usuario, onCerrar }: Props) {
  const restablecer = useRestablecerClave();
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const guardar = handleSubmit(async ({ clave }) => {
    try {
      await restablecer.mutateAsync({ id: usuario.id, clave });
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs">
      <form onSubmit={guardar} noValidate>
        <DialogTitle>Restablecer clave de {usuario.nombreUsuario}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Clave nueva"
            type="password"
            fullWidth
            sx={{ mt: 1 }}
            {...register('clave')}
            error={!!errors.clave}
            helperText={errors.clave?.message}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Restablecer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Paso 5: Crear `TablaUsuarios.tsx`**

`frontend/src/features/admin/components/TablaUsuarios.tsx`:

```tsx
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useState } from 'react';
import { mensajeError } from '../hooks/useGuardarValor';
import { useActualizarUsuario, useUsuarios, type Usuario } from '../hooks/useUsuarios';
import { FormularioUsuario } from './FormularioUsuario';
import { RestablecerClaveDialog } from './RestablecerClaveDialog';

export function TablaUsuarios() {
  const { data, isLoading, isError } = useUsuarios();
  const actualizar = useActualizarUsuario();
  const [formulario, setFormulario] = useState<{ usuario?: Usuario } | null>(null);
  const [paraClave, setParaClave] = useState<Usuario | null>(null);
  const [error, setError] = useState<string>();

  const alternarActivo = async (usuario: Usuario) => {
    setError(undefined);
    try {
      await actualizar.mutateAsync({
        id: usuario.id,
        cuerpo: { activo: !usuario.activo },
      });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  if (isLoading) return <CircularProgress aria-label="Cargando" />;
  if (isError || !data) {
    return <Alert severity="error">No se pudieron cargar los usuarios.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(undefined)}>
          {error}
        </Alert>
      )}
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => setFormulario({})}>
          Nuevo usuario
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Rol</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.nombreUsuario}</TableCell>
              <TableCell>{u.rol}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={u.activo ? 'Activo' : 'Inactivo'}
                  color={u.activo ? 'success' : 'default'}
                />
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => setFormulario({ usuario: u })}>
                  Editar
                </Button>
                <Button size="small" onClick={() => setParaClave(u)}>
                  Restablecer clave
                </Button>
                <Button size="small" onClick={() => alternarActivo(u)}>
                  {u.activo ? 'Desactivar' : 'Reactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {formulario && (
        <FormularioUsuario usuario={formulario.usuario} onCerrar={() => setFormulario(null)} />
      )}
      {paraClave && (
        <RestablecerClaveDialog usuario={paraClave} onCerrar={() => setParaClave(null)} />
      )}
    </Stack>
  );
}
```

- [ ] **Paso 6: Reescribir `AdminPage.tsx` con dos pestañas**

Reemplazar `frontend/src/features/admin/pages/AdminPage.tsx`:

```tsx
import { Alert, CircularProgress, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { PaginaEnConstruccion } from '../../../components/PaginaEnConstruccion';
import { TablaReferencia } from '../components/TablaReferencia';
import { TablaUsuarios } from '../components/TablaUsuarios';
import { useDominiosReferencia } from '../hooks/useValoresReferencia';

export function AdminPage() {
  const { data: dominios, isLoading, isError } = useDominiosReferencia();
  const [seccion, setSeccion] = useState<'referencia' | 'usuarios'>('referencia');
  const [indice, setIndice] = useState(0);

  return (
    <PaginaEnConstruccion
      titulo="Administración"
      descripcion="Usuarios y roles (RF22) y tablas de referencia (RF23)."
    >
      <Tabs value={seccion} onChange={(_, v) => setSeccion(v)} sx={{ mb: 2 }}>
        <Tab value="referencia" label="Tablas de referencia" />
        <Tab value="usuarios" label="Usuarios" />
      </Tabs>

      {seccion === 'usuarios' && <TablaUsuarios />}

      {seccion === 'referencia' && (
        <>
          <Typography variant="h6" component="h2" gutterBottom>
            Tablas de referencia
          </Typography>
          {isLoading && <CircularProgress aria-label="Cargando" />}
          {isError && <Alert severity="error">No se pudieron cargar los dominios.</Alert>}
          {dominios && (
            <Stack spacing={2}>
              <Tabs
                value={indice}
                onChange={(_, valor: number) => setIndice(valor)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {dominios.map((d) => (
                  <Tab key={d.dominio} label={d.denominacion} />
                ))}
              </Tabs>
              <TablaReferencia key={dominios[indice].dominio} dominio={dominios[indice]} />
            </Stack>
          )}
        </>
      )}
    </PaginaEnConstruccion>
  );
}
```

- [ ] **Paso 7: Regenerar tipos y verificar**

```bash
cd frontend && npm run api:tipos && npx prettier --write "src/**/*.{ts,tsx}" > /dev/null && npm run lint && npm run build
```

Esperado: lint sin avisos y build exitoso. Si `tsc` rechaza el `as never` de los roles, tipar `rol` con `Esquemas['CrearUsuarioDto']['rol']` en lugar del cast.

- [ ] **Paso 8: Verificación en el navegador**

Con la sesión del administrador, en `/admin`: crear un usuario `ana` con rol Jefe de cátedra → aparece en la tabla; repetirlo con `Ana` → error de usuario repetido; editar su rol; restablecer su clave; desactivarlo; intentar desactivar al único administrador → error "último administrador activo". Cerrar sesión e ingresar como `ana` con la clave nueva: el menú no muestra Administración y entrar a `/admin` por URL muestra "No tenés permiso". Con `ana` desactivada, el login falla.

- [ ] **Paso 9: Commit**

```bash
git add frontend/src
git commit -m "Agregar la pestaña Usuarios y quitar el token provisorio del frontend"
```

---

### Tarea 13: Documentación, constitución, specs previas y cierre

**Archivos:**
- Modificar: `docs/requerimientos.md`, `README.md`, `CLAUDE.md` (solo si alguna instrucción quedó desactualizada), `.specify/memory/constitution.md`
- Modificar: `specs/001-tablas-referencia/{plan.md,quickstart.md,contracts/referencia.openapi.md,research.md,spec.md}`
- Modificar: `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`, este plan

- [ ] **Paso 1: Actualizar `docs/requerimientos.md`**

- En §5 (Stack), agregar la fila `| Sesión | express-session con connect-pg-simple (tabla sesion en PostgreSQL) | RNF01 |` y cambiar la fila "Autenticación y roles" a: `Passport (estrategia local) con sesión en PostgreSQL, claves con argon2id y guards de NestJS por rol | RF22, RF24, RNF01`.
- En la fila de "Base de datos" cambiar "diecinueve tablas" por "veinticuatro tablas".
- En §7 (Puntos abiertos), eliminar la fila "Usuarios y roles".
- Agregar al final de §5 un párrafo breve: "**Usuarios y roles:** siete roles fijos (`rol`), `usuario`, `usuario_unidad`, `sesion` y `auditoria`; ver `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`."

- [ ] **Paso 2: Actualizar el README**

Reemplazar el párrafo "**Tablas de referencia:**" (que habla de `ADMIN_TOKEN`) por:

```
**Acceso:** todo el sistema requiere iniciar sesión. Al arrancar con la tabla de usuarios vacía, el backend crea el administrador con `ADMIN_USUARIO` y `ADMIN_CLAVE` del `.env` (al menos 10 caracteres de clave); `SESION_SECRETO` (32 caracteres o más) firma la cookie de sesión. Las tablas de referencia se administran en http://localhost:5173/admin (rol administrador). Los usuarios y sus roles se gestionan en la pestaña Usuarios de la misma pantalla.
```

En "Problemas frecuentes", agregar: `- **El backend no arranca y pide ADMIN_USUARIO y ADMIN_CLAVE:** la base no tiene usuarios; definilos en el \`.env\` (o restaurá la base).`

- [ ] **Paso 3: Enmendar la constitución (MINOR)**

En `.specify/memory/constitution.md`:
- En el principio I, agregar al final: `Para autenticación se usan Passport, express-session con connect-pg-simple y argon2 (usuarios y roles).`
- En "Restricciones adicionales", reemplazar la primera viñeta por: `- Autenticación obligatoria con sesión y autorización por rol en toda operación (RNF01), con siete roles fijos; datos personales conforme a la Ley 25.326 (RNF02).`
- Cambiar `**Version**: 1.0.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12` por `**Version**: 1.1.0 | **Ratified**: 2026-10-12 | **Last Amended**: 2026-10-12`.

- [ ] **Paso 4: Actualizar `specs/001-tablas-referencia`**

- `plan.md`: en la tabla de Constitution Check, la fila de RNF01 pasa a "Cumple: las escrituras exigen el rol `administrador` (ver `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`)"; eliminar la fila de `Complexity Tracking` y dejar la sección con "Sin violaciones."; quitar la mención de `ADMIN_TOKEN` y del guard provisorio de la estructura de código y de "Structure Decision".
- `research.md`: en R6 anteponer "**Reemplazada** por usuarios y roles (2026-10-12): las escrituras exigen el rol `administrador`; las lecturas, sesión iniciada." y dejar el texto original como histórico.
- `contracts/referencia.openapi.md`: en "Acceso" reemplazar el encabezado `x-admin-token` por "Lectura: cualquier usuario con sesión iniciada. Escritura: rol `administrador`. Sin sesión, 401; con otro rol, 403."; en la tabla de códigos de respuesta sumar `401 | Sin sesión` y cambiar el texto del 403 por "El rol no puede modificar las tablas de referencia".
- `quickstart.md`: en Prerrequisitos reemplazar `ADMIN_TOKEN` por "`.env` con `ADMIN_USUARIO`, `ADMIN_CLAVE` y `SESION_SECRETO`; iniciar sesión (`POST /api/auth/login`) y reutilizar la cookie con `curl -b`".
- `spec.md`: en la sección Assumptions, reemplazar la viñeta de la dependencia con RF22 por "La autenticación y el rol de administrador provienen del bloque de usuarios y roles".

- [ ] **Paso 5: Verificación final**

```bash
cd backend && docker compose exec -T backend sh -c 'npm run lint && npx prettier --check "src/**/*.ts" && npm test'
cd ../frontend && npm run lint && npx prettier --check "src/**/*.{ts,tsx}" && npm run build
```

Esperado: todo en verde.

Verificación de extremo a extremo con la base real (cookie guardada con `curl -c`):

```bash
B=localhost:3000/api; J=/tmp/claude-1000/cookies.txt
ADM=$(grep ^ADMIN_USUARIO= .env | cut -d= -f2); CL=$(grep ^ADMIN_CLAVE= .env | cut -d= -f2)
curl -s -o /dev/null -w "sin sesion: %{http_code}\n" $B/usuarios
curl -s -c $J -o /dev/null -w "login admin: %{http_code}\n" -XPOST $B/auth/login -H 'content-type: application/json' -d "{\"nombreUsuario\":\"$ADM\",\"clave\":\"$CL\"}"
curl -s -b $J -o /dev/null -w "crear rrhh: %{http_code}\n" -XPOST $B/usuarios -H 'content-type: application/json' -d '{"nombreUsuario":"rrhh1","clave":"clave-larga-123","rol":"recursos_humanos"}'
curl -s -b $J -o /dev/null -w "crear con unidades invalidas: %{http_code}\n" -XPOST $B/usuarios -H 'content-type: application/json' -d '{"nombreUsuario":"rrhh2","clave":"clave-larga-123","rol":"recursos_humanos","idUnidades":[1]}'
curl -s -b $J -o /dev/null -w "crear jefe con unidades: %{http_code}\n" -XPOST $B/usuarios -H 'content-type: application/json' -d '{"nombreUsuario":"jefe1","clave":"clave-larga-123","rol":"jefe_catedra","idUnidades":[1,2]}'
curl -s -b $J $B/usuarios
curl -s -c /tmp/claude-1000/c2.txt -o /dev/null -XPOST $B/auth/login -H 'content-type: application/json' -d '{"nombreUsuario":"rrhh1","clave":"clave-larga-123"}'
curl -s -b /tmp/claude-1000/c2.txt -o /dev/null -w "rrhh a /usuarios: %{http_code}\n" $B/usuarios
curl -s -b /tmp/claude-1000/c2.txt -o /dev/null -w "rrhh a /auditoria: %{http_code}\n" $B/auditoria
curl -s -b /tmp/claude-1000/c2.txt -o /dev/null -w "rrhh crea referencia: %{http_code}\n" -XPOST $B/referencia/tipo-riesgo -H 'content-type: application/json' -d '{"codigo":"zz","denominacion":"Z"}'
curl -s -b $J -o /dev/null -w "desactivar rrhh1: %{http_code}\n" -XPATCH $B/usuarios/$(curl -s -b $J $B/usuarios | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).find(u=>u.nombreUsuario==='rrhh1').id))") -H 'content-type: application/json' -d '{"activo":false}'
curl -s -b /tmp/claude-1000/c2.txt -o /dev/null -w "sesion de rrhh1 tras desactivarlo: %{http_code}\n" $B/auth/yo
```

Esperado: `401`; `200`; `201`; `400`; `201`; el listado con `idUnidades: [1,2]` para `jefe1` (verifica el cascade de `usuario_unidad`); `rrhh a /usuarios: 403`; `rrhh a /auditoria: 200`; `rrhh crea referencia: 403`; `desactivar rrhh1: 200`; `sesion de rrhh1 tras desactivarlo: 401`. Limpiar:

```bash
docker compose exec -T db sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"delete from usuario where nombre_usuario in ('rrhh1','jefe1')\""
```

- [ ] **Paso 6: Actualizar los estados**

- En `docs/superpowers/specs/2026-10-12-usuarios-roles-design.md`: primera línea a `Estado: Implementada | Fecha: 2026-10-12 | Autor: IvanOchoa229`.
- En este plan: primera línea a `Estado: Implementado | Fecha: 2026-10-12 | PR: <número del PR>` (completarlo al abrir el PR) y marcar todas las casillas.

- [ ] **Paso 7: Commit y publicación**

```bash
git add -A docs specs README.md .specify
git commit -m "Documentar usuarios y roles, enmendar la constitución y cerrar el plan"
```

Luego abrir un PR de `feat/usuarios` a `main` (`gh pr create`) y, al abrirlo, completar el número en la línea de estado de este plan.

---

## Autorrevisión

**Cobertura de la spec:**

| Requisito de la spec | Tarea |
| --- | --- |
| Modelo de datos (5 tablas, 7 roles, FK diferidas) | 2 |
| Login, logout, `yo`, cambio de clave; sesión en PostgreSQL; argon2id | 1, 3, 5, 7 |
| `SesionGuard`, `RolesGuard`, test de cobertura de `@Roles`, retiro de `ADMIN_TOKEN` | 4, 7 |
| Gestión de usuarios RF22 | 6, 7, 12 |
| Matriz de roles aplicada a referencia | 7 |
| `AlcanceService` (`unidadesVisibles`, `exigirUnidad`) | 9 |
| Auditoría: subscriber transaccional, falla sin usuario, endpoint de lectura | 10 |
| Primer administrador desde el `.env` | 1, 8 |
| Frontend: login, rutas por rol, menú, pestaña Usuarios | 11, 12 |
| Cambios en `requerimientos.md`, constitución y `specs/001` | 13 |

**Revisión de placeholders:** no hay "TBD" ni pasos sin código; los pasos de edición sobre archivos existentes indican el texto exacto a agregar o reemplazar.

**Consistencia de tipos:** `SesionUsuario` (`id`, `nombreUsuario`, `rol`, `idPersona`, `unidades`) es el mismo en `AuthService.aSesionUsuario`, `SesionSerializer`, `LocalStrategy`, `AlcanceService` y `SesionDto`. `normalizarNombreUsuario` se define en `auth.service.ts` y la usan los DTO y el bootstrap. `LARGO_MINIMO_CLAVE` se define en `password.service.ts`. Los nombres de endpoints coinciden con los de los hooks del frontend.

**Puntos a vigilar durante la ejecución:**
- `afterRemove` de TypeORM no siempre trae el registro completo; el paso 5 de la Tarea 10 indica la alternativa con `entityId`.
- El `cascade` de `usuario_unidad` con clave compuesta se verifica en vivo en el paso 5 de la Tarea 13.
- Si `oxlint` objeta la regla de importaciones dinámicas del test de cobertura, ajustar el test sin desactivar la regla globalmente.
