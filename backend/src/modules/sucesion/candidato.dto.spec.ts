import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  AgregarCandidatoDto,
  OrdenCandidatosDto,
  SeguimientoCandidatoDto,
} from './dto/candidato.dto.js';

const validar = (clase: new () => object, datos: object) =>
  validateSync(plainToInstance(clase, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const base = { idPersona: 3, prioridad: 1, idEstadoPreparacion: 2 };

describe('AgregarCandidatoDto', () => {
  it('acepta los datos mínimos y los opcionales', () => {
    expect(validar(AgregarCandidatoDto, base)).toEqual([]);
    expect(
      validar(AgregarCandidatoDto, {
        ...base,
        fechaDisponibilidadEstimada: '2027-03-31',
        observaciones: 'listo en marzo',
      }),
    ).toEqual([]);
  });
  it('rechaza prioridad 0', () => {
    expect(validar(AgregarCandidatoDto, { ...base, prioridad: 0 })).toContain(
      'prioridad',
    );
  });
  it('rechaza fechas mal formadas o inexistentes', () => {
    for (const fecha of ['31/03/2027', '2027-3-1', '2027-02-30']) {
      expect(
        validar(AgregarCandidatoDto, {
          ...base,
          fechaDisponibilidadEstimada: fecha,
        }),
      ).toContain('fechaDisponibilidadEstimada');
    }
  });
});

describe('SeguimientoCandidatoDto', () => {
  it('acepta cambios parciales y borrar la fecha con null', () => {
    expect(validar(SeguimientoCandidatoDto, {})).toEqual([]);
    expect(
      validar(SeguimientoCandidatoDto, {
        idEstadoPreparacion: 2,
        fechaDisponibilidadEstimada: null,
        observaciones: 'x',
      }),
    ).toEqual([]);
  });
  it('rechaza prioridad e idPersona (whitelist)', () => {
    expect(validar(SeguimientoCandidatoDto, { prioridad: 2 })).toContain(
      'prioridad',
    );
    expect(validar(SeguimientoCandidatoDto, { idPersona: 2 })).toContain(
      'idPersona',
    );
  });
  it('rechaza fecha mal formada', () => {
    expect(
      validar(SeguimientoCandidatoDto, { fechaDisponibilidadEstimada: 'hoy' }),
    ).toContain('fechaDisponibilidadEstimada');
  });
});

describe('OrdenCandidatosDto', () => {
  it('acepta una lista de ids y rechaza vacía o no entera', () => {
    expect(validar(OrdenCandidatosDto, { orden: [3, 1, 2] })).toEqual([]);
    expect(validar(OrdenCandidatosDto, { orden: [] })).toContain('orden');
    expect(validar(OrdenCandidatosDto, { orden: [1.5] })).toContain('orden');
  });
});
