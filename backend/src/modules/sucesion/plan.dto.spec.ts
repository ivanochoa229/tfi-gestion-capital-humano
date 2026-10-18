import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CrearPlanDto, ResolverPlanDto } from './dto/plan.dto.js';

const validar = (clase: new () => object, datos: object) =>
  validateSync(plainToInstance(clase, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('ResolverPlanDto', () => {
  it('acepta aprobar y rechazar', () => {
    expect(validar(ResolverPlanDto, { decision: 'aprobar' })).toEqual([]);
    expect(
      validar(ResolverPlanDto, { decision: 'rechazar', motivo: 'x' }),
    ).toEqual([]);
  });
  it('rechaza otra decisión', () => {
    expect(validar(ResolverPlanDto, { decision: 'cerrar' })).toContain(
      'decision',
    );
  });
});

describe('CrearPlanDto', () => {
  it('acepta puesto y responsable', () => {
    expect(validar(CrearPlanDto, { idPuesto: 1, idResponsable: 2 })).toEqual(
      [],
    );
  });
  it('rechaza que el cliente mande el estado', () => {
    expect(
      validar(CrearPlanDto, {
        idPuesto: 1,
        idResponsable: 2,
        estado: 'aprobado',
      }),
    ).toContain('estado');
  });
});
