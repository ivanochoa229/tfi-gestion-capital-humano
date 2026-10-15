import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import type { Acreditacion } from './entities/acreditacion.entity.js';
import { PerfilConocimientoService } from './perfil-conocimiento.service.js';
import {
  SQL_FILAS_PROPIAS,
  SQL_PENDIENTES,
  SQL_PERFIL_DE_PERSONA,
  SQL_REQUISITOS_VIGENTES,
} from './perfil.sql.js';

const sesion = (
  rol: SesionUsuario['rol'],
  idPersona: number | null = 5,
): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol,
  idPersona,
  unidades: [],
});

function crear(
  respuestas: Record<string, object[]> = {},
  visibles: number[] | null = [10],
) {
  const dataSource = {
    query: vi.fn(async (sql: string) => respuestas[sql] ?? []),
  };
  const acceso = { exigirLectura: vi.fn(async () => undefined) };
  const alcance = { unidadesVisibles: vi.fn(async () => visibles) };
  const acreditaciones = {
    find: vi.fn(async () => [
      {
        id: 2,
        idPersona: 5,
        idConocimiento: 20,
        idNivelAcreditado: 3,
        idTipoEvidencia: 1,
        fechaEvaluacion: '2026-05-01',
        idEvaluador: 7,
        observaciones: null,
        registradaEn: new Date('2026-05-01T10:00:00Z'),
      },
    ]),
  };
  const servicio = new PerfilConocimientoService(
    dataSource as unknown as DataSource,
    acreditaciones as unknown as Repository<Acreditacion>,
    acceso as unknown as AccesoPerfilService,
    alcance as unknown as AlcanceService,
  );
  return { servicio, dataSource, acceso, acreditaciones };
}

describe('PerfilConocimientoService.perfilDe y historial', () => {
  it('chequea el acceso de lectura antes de consultar', async () => {
    const { servicio, acceso, dataSource } = crear();
    acceso.exigirLectura.mockRejectedValueOnce(new ForbiddenException('no'));
    await expect(
      servicio.perfilDe(9, sesion('jefe_catedra')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('mapea las filas del perfil a camelCase con la bandera pendiente', async () => {
    const { servicio } = crear({
      [SQL_PERFIL_DE_PERSONA]: [
        {
          id_persona: 5,
          id_conocimiento: 20,
          denominacion: 'SQL',
          id_tipo_conocimiento: 3,
          id_nivel_declarado: 2,
          fecha_declaracion: '2026-06-01',
          id_nivel_acreditado: null,
          fecha_evaluacion: null,
          id_tipo_evidencia: null,
          id_evaluador: null,
          pendiente: true,
        },
      ],
    });
    expect(await servicio.perfilDe(5, sesion('docente'))).toEqual([
      {
        idPersona: 5,
        idConocimiento: 20,
        denominacion: 'SQL',
        idTipoConocimiento: 3,
        idNivelDeclarado: 2,
        fechaDeclaracion: '2026-06-01',
        idNivelAcreditado: null,
        fechaEvaluacion: null,
        idTipoEvidencia: null,
        idEvaluador: null,
        pendiente: true,
      },
    ]);
  });

  it('el historial pide lo más reciente primero y chequea el acceso', async () => {
    const { servicio, acceso, acreditaciones } = crear();
    const historial = await servicio.historial(5, 20, sesion('docente'));
    expect(acceso.exigirLectura).toHaveBeenCalledWith(expect.anything(), 5);
    expect(acreditaciones.find).toHaveBeenCalledWith({
      where: { idPersona: 5, idConocimiento: 20 },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    expect(historial[0]).toMatchObject({
      id: 2,
      registradaEn: '2026-05-01T10:00:00.000Z',
    });
  });
});

describe('PerfilConocimientoService.mios', () => {
  it('sin persona vinculada da 400', async () => {
    const { servicio } = crear();
    await expect(servicio.mios(sesion('docente', null))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('une los requisitos de los puestos con lo ya registrado, sin repetir conocimientos', async () => {
    const requisito = (
      idConocimiento: number,
      denominacion: string,
      idPuesto: number,
      orden: number,
    ) => ({
      id_conocimiento: idConocimiento,
      denominacion,
      id_tipo_conocimiento: 3,
      id_puesto: idPuesto,
      codigo_puesto: `P-000${idPuesto}`,
      denominacion_puesto: 'Puesto',
      id_nivel_requerido: orden,
      orden_nivel: orden,
      es_excluyente: idPuesto === 2,
    });
    const propia = (
      idConocimiento: number,
      denominacion: string,
      extra: object,
    ) => ({
      id_conocimiento: idConocimiento,
      denominacion,
      id_tipo_conocimiento: 3,
      id_nivel_declarado: null,
      fecha_declaracion: null,
      id_nivel_acreditado: null,
      fecha_evaluacion: null,
      id_tipo_evidencia: null,
      ...extra,
    });
    const { servicio } = crear({
      [SQL_REQUISITOS_VIGENTES]: [
        requisito(1, 'SQL', 1, 2),
        requisito(1, 'SQL', 2, 3),
        requisito(2, 'Redes', 1, 1),
      ],
      [SQL_FILAS_PROPIAS]: [
        propia(1, 'SQL', {
          id_nivel_declarado: 2,
          fecha_declaracion: '2026-06-01',
        }),
        propia(9, 'Docker', {
          id_nivel_declarado: 1,
          fecha_declaracion: '2026-06-02',
        }),
      ],
    });

    const filas = await servicio.mios(sesion('docente'));

    expect(filas.map((f) => f.denominacion)).toEqual([
      'Docker',
      'Redes',
      'SQL',
    ]);
    const sql = filas.find((f) => f.idConocimiento === 1)!;
    expect(sql).toMatchObject({
      idNivelRequerido: 3,
      esExcluyente: true,
      idNivelDeclarado: 2,
      fechaDeclaracion: '2026-06-01',
    });
    expect(sql.puestos.map((p) => p.idPuesto)).toEqual([1, 2]);
    expect(filas.find((f) => f.idConocimiento === 2)).toMatchObject({
      idNivelRequerido: 1,
      idNivelDeclarado: null,
    });
    // Un conocimiento fuera de los requisitos aparece sin nivel requerido ni puestos.
    expect(filas.find((f) => f.idConocimiento === 9)).toMatchObject({
      idNivelRequerido: null,
      esExcluyente: false,
      puestos: [],
      idNivelDeclarado: 1,
    });
  });
});

describe('PerfilConocimientoService.pendientes', () => {
  it('consulta con las unidades del alcance y la persona del evaluador', async () => {
    const { servicio, dataSource } = crear({ [SQL_PENDIENTES]: [] }, [10, 11]);
    await servicio.pendientes(sesion('jefe_catedra', 7));
    expect(dataSource.query).toHaveBeenCalledWith(SQL_PENDIENTES, [
      [10, 11],
      7,
    ]);
  });

  it('sin unidades en el alcance devuelve vacío sin consultar', async () => {
    const { servicio, dataSource } = crear({}, []);
    expect(await servicio.pendientes(sesion('jefe_catedra'))).toEqual([]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('mapea las filas', async () => {
    const { servicio } = crear({
      [SQL_PENDIENTES]: [
        {
          id_persona: 5,
          apellido: 'Pérez',
          nombre: 'Ana',
          id_conocimiento: 20,
          denominacion: 'SQL',
          id_nivel_declarado: 2,
          id_nivel_acreditado: null,
          fecha_declaracion: '2026-06-01',
        },
      ],
    });
    expect(await servicio.pendientes(sesion('jefe_catedra'))).toEqual([
      {
        idPersona: 5,
        apellido: 'Pérez',
        nombre: 'Ana',
        idConocimiento: 20,
        denominacion: 'SQL',
        idNivelDeclarado: 2,
        idNivelAcreditado: null,
        fechaDeclaracion: '2026-06-01',
      },
    ]);
  });
});
