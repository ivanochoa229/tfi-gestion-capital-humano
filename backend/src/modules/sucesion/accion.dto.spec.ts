import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  AvanzarAccionDto,
  CrearAccionDto,
  EditarAccionDto,
  FiltroAccionesDto,
} from './dto/accion.dto.js';

const validar = (clase: new () => object, datos: object) =>
  validateSync(plainToInstance(clase, datos), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

describe('AvanzarAccionDto', () => {
  it('acepta en_curso y completada', () => {
    expect(validar(AvanzarAccionDto, { estado: 'en_curso' })).toEqual([]);
    expect(
      validar(AvanzarAccionDto, {
        estado: 'completada',
        notaAvance: 'listo',
        fechaCumplimiento: '2026-10-01',
      }),
    ).toEqual([]);
  });
  it('rechaza cancelada', () => {
    expect(validar(AvanzarAccionDto, { estado: 'cancelada' })).toContain(
      'estado',
    );
  });
  it('rechaza campos ajenos', () => {
    expect(
      validar(AvanzarAccionDto, { estado: 'en_curso', idResponsable: 3 }),
    ).toContain('idResponsable');
  });
});

describe('EditarAccionDto', () => {
  it('acepta cancelar y campos propios', () => {
    expect(
      validar(EditarAccionDto, { cancelar: true, descripcion: 'x' }),
    ).toEqual([]);
  });
  it('rechaza idConocimiento e idPlan', () => {
    expect(validar(EditarAccionDto, { idConocimiento: 2 })).toContain(
      'idConocimiento',
    );
    expect(validar(EditarAccionDto, { idPlan: 2 })).toContain('idPlan');
  });
});

describe('CrearAccionDto', () => {
  const base = {
    idTipoAccion: 1,
    idConocimiento: 2,
    idResponsable: 3,
    descripcion: 'Mentoría',
    fechaPrevista: '2027-01-31',
  };
  it('acepta los obligatorios', () => {
    expect(validar(CrearAccionDto, base)).toEqual([]);
  });
  it('rechaza una fecha inexistente', () => {
    expect(
      validar(CrearAccionDto, { ...base, fechaPrevista: '2027-02-30' }),
    ).toContain('fechaPrevista');
  });
});

describe('FiltroAccionesDto', () => {
  it('convierte vencidas desde la cadena', () => {
    const f = plainToInstance(FiltroAccionesDto, { vencidas: 'true' });
    expect(f.vencidas).toBe(true);
  });
});
