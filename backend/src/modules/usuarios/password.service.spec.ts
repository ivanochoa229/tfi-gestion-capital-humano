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

  it('verificarFalso termina sin error y reutiliza el hash falso', async () => {
    await expect(servicio.verificarFalso('x')).resolves.toBeUndefined();
    await expect(servicio.verificarFalso('y')).resolves.toBeUndefined();
  });
});
