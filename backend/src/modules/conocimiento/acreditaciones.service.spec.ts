import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { SesionUsuario } from '../../common/sesion-usuario.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { AccesoPerfilService } from './acceso-perfil.service.js';
import { AcreditacionesService } from './acreditaciones.service.js';
import type { Acreditacion } from './entities/acreditacion.entity.js';
import { SQL_ASEGURAR_FILA, SQL_REFLEJAR_VIGENTE } from './sql.js';

const HOY = '2026-06-15';
const jefe: SesionUsuario = {
  id: 1,
  nombreUsuario: 'jefe',
  rol: 'jefe_catedra',
  idPersona: 7,
  unidades: [10],
};
const dto = {
  idNivel: 3,
  fechaEvaluacion: '2026-06-01',
  idTipoEvidencia: 2,
  observaciones: 'Rindió el examen',
};

function crearEntorno(
  opciones: {
    persona?: { activo: boolean } | null;
    conocimiento?: { activo: boolean } | null;
    acceso?: () => Promise<void>;
  } = {},
) {
  const persona = opciones.persona === undefined ? { activo: true } : opciones.persona;
  const conocimiento =
    opciones.conocimiento === undefined ? { activo: true } : opciones.conocimiento;
  const guardadas: Partial<Acreditacion>[] = [];
  const repoAcreditaciones = {
    create: vi.fn((datos: Partial<Acreditacion>) => ({ ...datos })),
    save: vi.fn(async (datos: Partial<Acreditacion>) => {
      guardadas.push(datos);
      return { ...datos, id: 55, registradaEn: new Date('2026-06-15T12:00:00Z') };
    }),
  };
  const consultas: [string, unknown[] | undefined][] = [];
  const manager = {
    query: vi.fn(async (sql: string, parametros?: unknown[]) => {
      consultas.push([sql, parametros]);
      return sql.includes('CURRENT_DATE') ? [{ hoy: HOY }] : [];
    }),
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'Persona'
        ? { findOne: vi.fn(async () => persona) }
        : entidad.name === 'Conocimiento'
          ? { findOne: vi.fn(async () => conocimiento) }
          : repoAcreditaciones,
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoAcreditaciones as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const acceso = {
    exigirEvaluacion: vi.fn(opciones.acceso ?? (async () => undefined)),
  };
  const servicio = new AcreditacionesService(
    repoAcreditaciones as unknown as Repository<Acreditacion>,
    referencia as unknown as ReferenciaService,
    acceso as unknown as AccesoPerfilService,
  );
  return { servicio, referencia, acceso, consultas, guardadas };
}

describe('AcreditacionesService.acreditar', () => {
  it('registra la acreditación con el evaluador de la sesión y refleja la vigente', async () => {
    const { servicio, consultas, guardadas, referencia, acceso } = crearEntorno();

    const resultado = await servicio.acreditar(5, 20, dto, jefe);

    expect(acceso.exigirEvaluacion).toHaveBeenCalledWith(jefe, 5);
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 3);
    expect(referencia.validarActivo).toHaveBeenCalledWith('tipo-evidencia', 2);
    expect(guardadas[0]).toMatchObject({
      idPersona: 5,
      idConocimiento: 20,
      idNivelAcreditado: 3,
      idTipoEvidencia: 2,
      fechaEvaluacion: '2026-06-01',
      idEvaluador: 7,
      observaciones: 'Rindió el examen',
    });
    const sqls = consultas.map(([sql]) => sql);
    expect(sqls[0]).toContain('pg_advisory_xact_lock');
    expect(sqls.indexOf(SQL_ASEGURAR_FILA)).toBeLessThan(
      sqls.indexOf(SQL_REFLEJAR_VIGENTE),
    );
    expect(consultas.find(([sql]) => sql === SQL_ASEGURAR_FILA)?.[1]).toEqual([
      5, 20, 3, '2026-06-01', 2, 7,
    ]);
    expect(consultas.find(([sql]) => sql === SQL_REFLEJAR_VIGENTE)?.[1]).toEqual([5, 20]);
    expect(resultado).toMatchObject({
      id: 55,
      idEvaluador: 7,
      registradaEn: '2026-06-15T12:00:00.000Z',
    });
  });

  it('no deja pasar nada si el acceso lo rechaza', async () => {
    const { servicio, consultas, guardadas } = crearEntorno({
      acceso: async () => {
        throw new ForbiddenException('No podés acreditar tus propios conocimientos');
      },
    });
    await expect(servicio.acreditar(7, 20, dto, jefe)).rejects.toBeInstanceOf(ForbiddenException);
    expect(consultas).toHaveLength(0);
    expect(guardadas).toHaveLength(0);
  });

  it('rechaza una fecha de evaluación futura (la de hoy sí se acepta)', async () => {
    await expect(
      crearEntorno().servicio.acreditar(5, 20, { ...dto, fechaEvaluacion: '2026-06-16' }, jefe),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      crearEntorno().servicio.acreditar(5, 20, { ...dto, fechaEvaluacion: HOY }, jefe),
    ).resolves.toBeDefined();
  });

  it('rechaza persona o conocimiento inexistentes (404) o dados de baja (400)', async () => {
    await expect(crearEntorno({ persona: null }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(NotFoundException);
    await expect(crearEntorno({ persona: { activo: false } }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(BadRequestException);
    await expect(crearEntorno({ conocimiento: null }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(NotFoundException);
    await expect(crearEntorno({ conocimiento: { activo: false } }).servicio.acreditar(5, 20, dto, jefe)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('las observaciones son opcionales', async () => {
    const { servicio, guardadas } = crearEntorno();
    await servicio.acreditar(5, 20, { ...dto, observaciones: undefined }, jefe);
    expect(guardadas[0].observaciones).toBeNull();
  });
});
