import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EvaluarDto } from './dto/evaluacion.dto.js';

const validar = (datos: object) =>
  validateSync(plainToInstance(EvaluarDto, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('EvaluarDto', () => {
  it('acepta impacto y dificultad; fecha y observaciones son opcionales', () => {
    expect(validar({ idNivelImpacto: 3, idNivelDificultad: 2 })).toEqual([]);
  });

  it('rechaza que el cliente mande el nivel de criticidad', () => {
    expect(
      validar({ idNivelImpacto: 3, idNivelDificultad: 2, nivelCriticidad: 1 }),
    ).toContain('nivelCriticidad');
    expect(
      validar({
        idNivelImpacto: 3,
        idNivelDificultad: 2,
        idNivelCriticidad: 1,
      }),
    ).toContain('idNivelCriticidad');
  });

  it('rechaza ids no enteros, fecha mal formada y observaciones demasiado largas', () => {
    expect(validar({ idNivelImpacto: 'x', idNivelDificultad: 2 })).toContain(
      'idNivelImpacto',
    );
    expect(
      validar({
        idNivelImpacto: 1,
        idNivelDificultad: 2,
        fechaEvaluacion: '15/06/2026',
      }),
    ).toContain('fechaEvaluacion');
    expect(
      validar({
        idNivelImpacto: 1,
        idNivelDificultad: 2,
        observaciones: 'x'.repeat(2001),
      }),
    ).toContain('observaciones');
  });
});
