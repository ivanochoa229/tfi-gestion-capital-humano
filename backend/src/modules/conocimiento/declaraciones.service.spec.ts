import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { ConocimientoPersona } from './entities/conocimiento-persona.entity.js';
import { DeclaracionesService } from './declaraciones.service.js';

const HOY = '2026-06-15';
const docente = (idPersona: number | null): SesionUsuario => ({
  id: 1,
  nombreUsuario: 'u',
  rol: 'docente',
  idPersona,
  unidades: [],
});

function crearEntorno(opciones: {
  persona?: { activo: boolean } | null;
  conocimiento?: { activo: boolean } | null;
  fila?: Partial<ConocimientoPersona> | null;
}) {
  const persona = opciones.persona === undefined ? { activo: true } : opciones.persona;
  const conocimiento =
    opciones.conocimiento === undefined ? { activo: true } : opciones.conocimiento;
  const fila = opciones.fila ?? null;
  const repoFilas = {
    findOne: vi.fn(async () => (fila ? { ...fila } : null)),
    findOneByOrFail: vi.fn(async () => ({
      idPersona: 5,
      idConocimiento: 20,
      idNivelDeclarado: 2,
      fechaDeclaracion: HOY,
      idNivelAcreditado: null,
      fechaEvaluacion: null,
      idTipoEvidencia: null,
      idEvaluador: null,
    })),
    delete: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  };
  const manager = {
    query: vi.fn(async (sql: string) =>
      sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [],
    ),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Persona'
        ? { findOne: vi.fn(async () => persona) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : repoFilas,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoFilas as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new DeclaracionesService(
    repoFilas as unknown as Repository<ConocimientoPersona>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, manager, repoFilas, referencia };
}

describe('DeclaracionesService.declarar', () => {
  it('guarda el nivel declarado con la fecha de hoy de la base', async () => {
    const { servicio, manager, referencia } = crearEntorno({});
    const resultado = await servicio.declarar(5, 20, { idNivel: 2 }, docente(5));
    const insercion = manager.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO conocimiento_persona'),
    );
    expect(insercion?.[1]).toEqual([5, 20, 2, HOY]);
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 2);
    expect(resultado).toMatchObject({ idPersona: 5, idNivelDeclarado: 2 });
  });

  it('el primer comando de la transacción es el bloqueo consultivo', async () => {
    const { servicio, manager } = crearEntorno({});
    await servicio.declarar(5, 20, { idNivel: 2 }, docente(5));
    expect(manager.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });

  it('solo la propia persona: otra persona o un usuario sin persona da 403', async () => {
    const { servicio, manager } = crearEntorno({});
    await expect(servicio.declarar(6, 20, { idNivel: 2 }, docente(5))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.declarar(5, 20, { idNivel: 2 }, docente(null))).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('rechaza persona o conocimiento inexistentes (404) o dados de baja (400)', async () => {
    await expect(
      crearEntorno({ persona: null }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ persona: { activo: false } }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno({ conocimiento: null }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ conocimiento: { activo: false } }).servicio.declarar(5, 20, { idNivel: 2 }, docente(5)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DeclaracionesService.retirar', () => {
  it('borra la fila si no tiene acreditación', async () => {
    const { servicio, repoFilas } = crearEntorno({
      fila: { idNivelDeclarado: 2, idNivelAcreditado: null },
    });
    await servicio.retirar(5, 20, docente(5));
    expect(repoFilas.delete).toHaveBeenCalledWith({ idPersona: 5, idConocimiento: 20 });
    expect(repoFilas.update).not.toHaveBeenCalled();
  });

  it('si tiene acreditación solo anula la declaración', async () => {
    const { servicio, repoFilas } = crearEntorno({
      fila: { idNivelDeclarado: 2, idNivelAcreditado: 3 },
    });
    await servicio.retirar(5, 20, docente(5));
    expect(repoFilas.update).toHaveBeenCalledWith(
      { idPersona: 5, idConocimiento: 20 },
      { idNivelDeclarado: null, fechaDeclaracion: null },
    );
    expect(repoFilas.delete).not.toHaveBeenCalled();
  });

  it('da 404 si no hay declaración que retirar y 403 si no es la propia', async () => {
    await expect(
      crearEntorno({ fila: null }).servicio.retirar(5, 20, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({ fila: { idNivelDeclarado: null, idNivelAcreditado: 3 } }).servicio.retirar(5, 20, docente(5)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crearEntorno({}).servicio.retirar(6, 20, docente(5)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
