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

  it('CARGAR_DATOS_DEMO es false si no se define', () => {
    expect(validarEnv(base).CARGAR_DATOS_DEMO).toBe(false);
  });

  it('acepta "true" y lo convierte a booleano', () => {
    expect(
      validarEnv({ ...base, CARGAR_DATOS_DEMO: 'true' }).CARGAR_DATOS_DEMO,
    ).toBe(true);
  });

  it('"false" da false', () => {
    expect(
      validarEnv({ ...base, CARGAR_DATOS_DEMO: 'false' }).CARGAR_DATOS_DEMO,
    ).toBe(false);
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
