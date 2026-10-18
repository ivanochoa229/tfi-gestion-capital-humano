import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { Puesto } from '../estructura/entities/puesto.entity.js';
import type { AlcanceService } from '../usuarios/alcance.service.js';
import type { EvaluacionCriticidad } from './entities/evaluacion-criticidad.entity.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import type { MatrizService } from './matriz.service.js';

const HOY = '2026-06-15';
const rrhh: SesionUsuario = {
  id: 4,
  nombreUsuario: 'rrhh',
  rol: 'recursos_humanos',
  idPersona: null,
  unidades: [],
};
const dto = { idNivelImpacto: 3, idNivelDificultad: 3 };

function crearEntorno(
  opciones: {
    puesto?: { idUnidad: number; activo: boolean } | null;
    conocimiento?: { activo: boolean } | null;
    requisito?: object | null;
    fueraDeAlcance?: boolean;
    matrizFalla?: boolean;
  } = {},
) {
  const puesto =
    opciones.puesto === undefined
      ? { idUnidad: 10, activo: true }
      : opciones.puesto;
  const conocimiento =
    opciones.conocimiento === undefined
      ? { activo: true }
      : opciones.conocimiento;
  const requisito = opciones.requisito === undefined ? {} : opciones.requisito;
  const repo = {
    create: vi.fn((d: Partial<EvaluacionCriticidad>) => ({ ...d })),
    save: vi.fn(async (d: Partial<EvaluacionCriticidad>) => ({
      ...d,
      id: 77,
      registradaEn: new Date('2026-06-15T12:00:00Z'),
    })),
    find: vi.fn(async () => []),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [],
    ),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Puesto'
        ? { findOne: vi.fn(async () => puesto) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : entidad.name === 'RequisitoPuesto'
            ? { findOne: vi.fn(async () => requisito) }
            : repo,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repo as unknown as { manager: unknown }).manager = manager;
  const matriz = {
    nivelDe: vi.fn(async () => {
      if (opciones.matrizFalla)
        throw new BadRequestException('escala inactiva');
      return 30;
    }),
  };
  const alcance = {
    exigirUnidad: vi.fn(async () => {
      if (opciones.fueraDeAlcance) throw new ForbiddenException('fuera');
    }),
  };
  const puestos = { findOne: vi.fn(async () => puesto) };
  const servicio = new EvaluacionesService(
    repo as unknown as Repository<EvaluacionCriticidad>,
    puestos as unknown as Repository<Puesto>,
    matriz as unknown as MatrizService,
    alcance as unknown as AlcanceService,
  );
  return { servicio, repo, matriz, alcance };
}

describe('EvaluacionesService.evaluar', () => {
  it('guarda con el nivel de la matriz, el usuario de la sesión y la fecha de hoy por defecto', async () => {
    const { servicio, repo, matriz, alcance } = crearEntorno();

    const resultado = await servicio.evaluar(5, 8, dto, rrhh);

    expect(matriz.nivelDe).toHaveBeenCalledWith(3, 3);
    expect(alcance.exigirUnidad).toHaveBeenCalledWith(rrhh, 10);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idPuesto: 5,
        idConocimiento: 8,
        idNivelImpacto: 3,
        idNivelDificultad: 3,
        idNivelCriticidad: 30,
        fechaEvaluacion: HOY,
        idUsuario: 4,
        observaciones: null,
      }),
    );
    expect(resultado).toMatchObject({
      id: 77,
      idNivelCriticidad: 30,
      nombreUsuario: 'rrhh',
      registradaEn: '2026-06-15T12:00:00.000Z',
    });
  });

  it('usa la fecha indicada y las observaciones', async () => {
    const { servicio, repo } = crearEntorno();
    await servicio.evaluar(
      5,
      8,
      { ...dto, fechaEvaluacion: '2026-06-01', observaciones: 'Revisado' },
      rrhh,
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaEvaluacion: '2026-06-01',
        observaciones: 'Revisado',
      }),
    );
  });

  it('rechaza una fecha futura sin guardar', async () => {
    const { servicio, repo } = crearEntorno();
    await expect(
      servicio.evaluar(5, 8, { ...dto, fechaEvaluacion: '2026-06-16' }, rrhh),
    ).rejects.toThrow(/futura/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza una escala inactiva antes de abrir la transacción', async () => {
    const { servicio, repo } = crearEntorno({ matrizFalla: true });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('da 404 si el puesto o el conocimiento no existen', async () => {
    await expect(
      crearEntorno({ puesto: null }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ conocimiento: null }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('da 400 si el puesto o el conocimiento están dados de baja', async () => {
    await expect(
      crearEntorno({
        puesto: { idUnidad: 10, activo: false },
      }).servicio.evaluar(5, 8, dto, rrhh),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno({ conocimiento: { activo: false } }).servicio.evaluar(
        5,
        8,
        dto,
        rrhh,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('da 409 si el puesto no exige el conocimiento', async () => {
    const { servicio, repo } = crearEntorno({ requisito: null });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('da 403 si el puesto está fuera del alcance', async () => {
    const { servicio, repo } = crearEntorno({ fueraDeAlcance: true });
    await expect(servicio.evaluar(5, 8, dto, rrhh)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('EvaluacionesService.historial', () => {
  it('da 404 si el puesto no existe y 403 si queda fuera del alcance', async () => {
    await expect(
      crearEntorno({ puesto: null }).servicio.historial(5, 8, rrhh),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ fueraDeAlcance: true }).servicio.historial(5, 8, rrhh),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lista la más reciente primero, con el nombre del evaluador', async () => {
    const { servicio, repo } = crearEntorno();
    repo.find.mockResolvedValueOnce([
      {
        id: 2,
        idPuesto: 5,
        idConocimiento: 8,
        idNivelImpacto: 3,
        idNivelDificultad: 3,
        idNivelCriticidad: 30,
        fechaEvaluacion: '2026-06-10',
        idUsuario: 4,
        observaciones: null,
        registradaEn: new Date('2026-06-10T10:00:00Z'),
        usuario: { nombreUsuario: 'rrhh' },
      },
    ] as never);
    const filas = await servicio.historial(5, 8, rrhh);
    expect(repo.find).toHaveBeenCalledWith({
      where: { idPuesto: 5, idConocimiento: 8 },
      relations: { usuario: true },
      order: { fechaEvaluacion: 'DESC', id: 'DESC' },
    });
    expect(filas).toEqual([
      expect.objectContaining({ id: 2, nombreUsuario: 'rrhh' }),
    ]);
  });
});
