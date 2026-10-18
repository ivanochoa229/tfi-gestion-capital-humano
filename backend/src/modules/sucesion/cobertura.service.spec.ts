import type { DataSource } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import { CoberturaService } from './cobertura.service.js';
import { SQL_COBERTURA, SQL_MIS_PLANES } from './cobertura.sql.js';

const sesion = (extra: Partial<SesionUsuario> = {}): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol: 'jefatura_departamento',
  idPersona: null,
  unidades: [10],
  ...extra,
});

function crearServicio(visibles: number[] | null, filas: object[] = []) {
  const query = vi.fn(async () => filas);
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const servicio = new CoberturaService(
    { query } as unknown as DataSource,
    alcance as unknown as AlcanceService,
  );
  return { servicio, query, alcance };
}

const fila = (extra: object) => ({
  id_puesto: 1,
  codigo: 'P-0001',
  denominacion: 'Jefe',
  id_unidad: 10,
  tiene_aprobado: false,
  id_plan_en_elaboracion: null,
  estado_plan_en_elaboracion: null,
  ...extra,
});

describe('CoberturaService.cobertura', () => {
  it('pasa las unidades visibles a la consulta', async () => {
    const { servicio, query } = crearServicio([10, 11]);
    await servicio.cobertura({}, sesion());
    expect(query).toHaveBeenCalledWith(SQL_COBERTURA, [[10, 11], null]);
  });

  it('RR. HH. y autoridad (sin límite) pasan nulo; con idUnidad lo pasan como filtro', async () => {
    const { servicio, query } = crearServicio(null);
    await servicio.cobertura({ idUnidad: 10 }, sesion({ rol: 'autoridad' }));
    expect(query).toHaveBeenCalledWith(SQL_COBERTURA, [null, 10]);
  });

  it('cuenta críticos y planes aprobados y lista los demás con su plan en elaboración', async () => {
    const { servicio } = crearServicio(null, [
      fila({ id_puesto: 1, tiene_aprobado: true }),
      fila({
        id_puesto: 2,
        codigo: 'P-0002',
        id_plan_en_elaboracion: 9,
        estado_plan_en_elaboracion: 'borrador',
      }),
      fila({ id_puesto: 3, codigo: 'P-0003' }),
    ]);
    const r = await servicio.cobertura({}, sesion());
    expect(r.criticos).toBe(3);
    expect(r.conPlan).toBe(1);
    expect(r.sinPlan).toEqual([
      {
        idPuesto: 2,
        codigo: 'P-0002',
        denominacion: 'Jefe',
        idUnidad: 10,
        idPlanEnElaboracion: 9,
        estadoPlanEnElaboracion: 'borrador',
      },
      {
        idPuesto: 3,
        codigo: 'P-0003',
        denominacion: 'Jefe',
        idUnidad: 10,
        idPlanEnElaboracion: null,
        estadoPlanEnElaboracion: null,
      },
    ]);
  });
});

describe('CoberturaService.misPlanes', () => {
  it('sin idPersona devuelve [] y no consulta', async () => {
    const { servicio, query } = crearServicio(null);
    expect(await servicio.misPlanes(sesion({ rol: 'docente' }))).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('con idPersona consulta por esa persona y mapea las filas', async () => {
    const { servicio, query } = crearServicio(null, [
      {
        id_plan: 4,
        id_puesto: 1,
        denominacion_puesto: 'Jefe',
        estado_plan: 'aprobado',
        estado_preparacion: 'en_formacion',
        fecha_disponibilidad_estimada: '2027-01-01',
      },
    ]);
    const r = await servicio.misPlanes(
      sesion({ rol: 'docente', idPersona: 7 }),
    );
    expect(query).toHaveBeenCalledWith(SQL_MIS_PLANES, [7]);
    expect(r).toEqual([
      {
        idPlan: 4,
        idPuesto: 1,
        denominacionPuesto: 'Jefe',
        estadoPlan: 'aprobado',
        estadoPreparacion: 'en_formacion',
        fechaDisponibilidadEstimada: '2027-01-01',
      },
    ]);
  });
});
