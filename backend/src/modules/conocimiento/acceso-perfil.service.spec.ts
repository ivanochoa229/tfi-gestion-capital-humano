import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { AccesoPerfilService } from './acceso-perfil.service.js';

const sesion = (
  rol: SesionUsuario['rol'],
  idPersona: number | null = 7,
): SesionUsuario => ({ id: 1, nombreUsuario: 'u', rol, idPersona, unidades: [] });

function crear(visibles: number[] | null, ocupaciones: object[] = [{}]) {
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const dataSource = { query: vi.fn(async () => ocupaciones) };
  const servicio = new AccesoPerfilService(
    dataSource as unknown as DataSource,
    alcance as unknown as AlcanceService,
  );
  return { servicio, dataSource, alcance };
}

describe('AccesoPerfilService.exigirLectura', () => {
  it('cualquiera lee su propio perfil', async () => {
    const { servicio, dataSource } = crear([]);
    await expect(servicio.exigirLectura(sesion('docente', 5), 5)).resolves.toBeUndefined();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('recursos humanos y autoridad leen el de cualquiera', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('recursos_humanos'), 99)).resolves.toBeUndefined();
    await expect(servicio.exigirLectura(sesion('autoridad'), 99)).resolves.toBeUndefined();
  });

  it('el docente no lee el de otra persona', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('docente', 5), 6)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el analista de puestos y el administrador no leen el de otros', async () => {
    const { servicio } = crear([]);
    await expect(servicio.exigirLectura(sesion('analista_puestos'), 99)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.exigirLectura(sesion('administrador'), 99)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el jefe de cátedra lee si la persona ocupa hoy un puesto de su alcance, y no si no', async () => {
    const dentro = crear([10, 11], [{}]);
    await expect(dentro.servicio.exigirLectura(sesion('jefe_catedra'), 99)).resolves.toBeUndefined();
    expect(dentro.dataSource.query).toHaveBeenCalledWith(expect.any(String), [99, [10, 11]]);
    const fuera = crear([10, 11], []);
    await expect(fuera.servicio.exigirLectura(sesion('jefe_catedra'), 99)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AccesoPerfilService.exigirEvaluacion', () => {
  it('solo evalúan la jefatura y los jefes de cátedra', async () => {
    const { servicio } = crear([10]);
    for (const rol of ['docente', 'recursos_humanos', 'autoridad', 'analista_puestos', 'administrador'] as const) {
      await expect(servicio.exigirEvaluacion(sesion(rol), 99)).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('sin persona vinculada da 400', async () => {
    const { servicio } = crear([10]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra', null), 99)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nadie se acredita a sí mismo', async () => {
    const { servicio } = crear([10]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra', 7), 7)).rejects.toThrow(/propios/);
  });

  it('la persona debe tener una ocupación vigente en el alcance', async () => {
    const { servicio } = crear([10], []);
    await expect(servicio.exigirEvaluacion(sesion('jefatura_departamento'), 99)).rejects.toThrow(/alcance/);
  });

  it('con alcance vacío rechaza sin consultar la base', async () => {
    const { servicio, dataSource } = crear([]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra'), 99)).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('acepta a un jefe sobre alguien de su alcance', async () => {
    const { servicio } = crear([10], [{}]);
    await expect(servicio.exigirEvaluacion(sesion('jefe_catedra'), 99)).resolves.toBeUndefined();
  });
});
