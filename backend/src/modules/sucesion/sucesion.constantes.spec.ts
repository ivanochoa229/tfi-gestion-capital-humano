import {
  puedePasar,
  TRANSICIONES_ACCION,
  TRANSICIONES_PLAN,
} from './sucesion.constantes.js';

describe('Transiciones de sucesión', () => {
  it.each([
    ['borrador', 'pendiente_aprobacion', true],
    ['aprobado', 'borrador', false],
    ['cerrado', 'borrador', false],
    ['pendiente_aprobacion', 'cerrado', false],
    ['aprobado', 'cerrado', true],
    ['rechazado', 'cerrado', true],
    ['rechazado', 'borrador', true],
  ])('plan %s -> %s: %s', (desde, hasta, esperado) => {
    expect(puedePasar(TRANSICIONES_PLAN, desde, hasta)).toBe(esperado);
  });

  it.each([
    ['completada', 'en_curso', false],
    ['en_curso', 'cancelada', true],
    ['pendiente', 'en_curso', true],
    ['cancelada', 'pendiente', false],
  ])('acción %s -> %s: %s', (desde, hasta, esperado) => {
    expect(puedePasar(TRANSICIONES_ACCION, desde, hasta)).toBe(esperado);
  });

  it('un estado desconocido no tiene transiciones', () => {
    expect(puedePasar(TRANSICIONES_PLAN, 'inexistente', 'borrador')).toBe(
      false,
    );
  });
});
