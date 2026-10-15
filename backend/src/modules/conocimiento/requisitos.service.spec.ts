import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Puesto } from '../estructura/entities/puesto.entity.js';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { Conocimiento } from './entities/conocimiento.entity.js';
import type { RequisitoPuesto } from './entities/requisito-puesto.entity.js';
import { RequisitosService } from './requisitos.service.js';

const conocimiento = (id: number, activo = true) =>
  ({
    id,
    denominacion: `Conocimiento ${id}`,
    idTipoConocimiento: 3,
    activo,
  }) as Conocimiento;

const requisito = (
  idPuesto: number,
  idConocimiento: number,
  parcial: Partial<RequisitoPuesto> = {},
) =>
  ({
    idPuesto,
    idConocimiento,
    idNivelRequerido: 1,
    esExcluyente: false,
    conocimiento: conocimiento(idConocimiento),
    ...parcial,
  }) as RequisitoPuesto;

function crearEntorno(opciones: {
  requisitos?: RequisitoPuesto[];
  puestos?: Partial<Puesto>[];
  conocimientos?: Conocimiento[];
}) {
  const filas = (opciones.requisitos ?? []).map((r) => ({ ...r }));
  const puestos = opciones.puestos ?? [
    { id: 10, activo: true },
    { id: 11, activo: true },
  ];
  const conocimientos = opciones.conocimientos ?? [conocimiento(1), conocimiento(2)];
  const clave = (r: Partial<RequisitoPuesto>) => `${r.idPuesto}-${r.idConocimiento}`;
  const repoRequisitos = {
    find: vi.fn(async (o: { where: Partial<RequisitoPuesto> }) =>
      filas.filter((r) => r.idPuesto === o.where.idPuesto).map((r) => ({ ...r })),
    ),
    findOne: vi.fn(async (o: { where: Partial<RequisitoPuesto> }) => {
      const r = filas.find((x) => clave(x) === clave(o.where));
      return r ? { ...r } : null;
    }),
    save: vi.fn(async (r: RequisitoPuesto) => {
      const i = filas.findIndex((x) => clave(x) === clave(r));
      if (i >= 0) filas[i] = { ...filas[i], ...r };
      else filas.push({ ...r });
      return { ...r };
    }),
    insert: vi.fn(async (r: RequisitoPuesto) => {
      filas.push({ ...r });
    }),
    delete: vi.fn(async (k: Partial<RequisitoPuesto>) => {
      const i = filas.findIndex((x) => clave(x) === clave(k));
      if (i >= 0) filas.splice(i, 1);
    }),
  };
  const repoPuestos = {
    findOne: vi.fn(async (o: { where: { id: number } }) => {
      const p = puestos.find((x) => x.id === o.where.id);
      return p ? { ...p } : null;
    }),
  };
  const repoConocimientos = {
    findOne: vi.fn(async (o: { where: { id: number } }) => {
      const c = conocimientos.find((x) => x.id === o.where.id);
      return c ? { ...c } : null;
    }),
  };
  const manager = {
    getRepository: (entidad: { name: string }) =>
      entidad.name === 'RequisitoPuesto'
        ? repoRequisitos
        : entidad.name === 'Puesto'
          ? repoPuestos
          : repoConocimientos,
    query: vi.fn(async () => []),
    transaction: async (t: (m: unknown) => Promise<unknown>) => t(manager),
  };
  (repoRequisitos as unknown as { manager: unknown }).manager = manager;
  const referencia = { validarActivo: vi.fn(async () => undefined) };
  const servicio = new RequisitosService(
    repoRequisitos as unknown as Repository<RequisitoPuesto>,
    repoPuestos as unknown as Repository<Puesto>,
    repoConocimientos as unknown as Repository<Conocimiento>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, referencia, filas };
}

describe('RequisitosService.guardar', () => {
  it('da de alta el requisito y valida el nivel', async () => {
    const { servicio, referencia, filas } = crearEntorno({});
    const creado = await servicio.guardar(10, 1, { idNivel: 2, esExcluyente: true });
    expect(creado).toMatchObject({
      idPuesto: 10,
      idConocimiento: 1,
      idNivelRequerido: 2,
      esExcluyente: true,
      denominacion: 'Conocimiento 1',
    });
    expect(referencia.validarActivo).toHaveBeenCalledWith('nivel-dominio', 2);
    expect(filas).toHaveLength(1);
  });

  it('modifica el requisito existente en lugar de duplicarlo', async () => {
    const { servicio, filas } = crearEntorno({ requisitos: [requisito(10, 1)] });
    await servicio.guardar(10, 1, { idNivel: 4, esExcluyente: true });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ idNivelRequerido: 4, esExcluyente: true });
  });

  it('rechaza un puesto inexistente (404), uno dado de baja (400) y un conocimiento inactivo (400)', async () => {
    const e = crearEntorno({
      puestos: [{ id: 10, activo: true }, { id: 12, activo: false }],
      conocimientos: [conocimiento(1), conocimiento(2, false)],
    });
    const dto = { idNivel: 1, esExcluyente: false };
    await expect(e.servicio.guardar(99, 1, dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(e.servicio.guardar(12, 1, dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.guardar(10, 2, dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.guardar(10, 77, dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RequisitosService.quitar', () => {
  it('quita el requisito y da 404 si no existe', async () => {
    const { servicio, filas } = crearEntorno({ requisitos: [requisito(10, 1)] });
    await servicio.quitar(10, 1);
    expect(filas).toHaveLength(0);
    await expect(servicio.quitar(10, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RequisitosService.copiar', () => {
  it('copia los requisitos del origen y omite, sin pisar, los que el destino ya tiene', async () => {
    const { servicio, filas } = crearEntorno({
      requisitos: [
        requisito(10, 1, { idNivelRequerido: 3, esExcluyente: true }),
        requisito(10, 2),
        requisito(11, 2, { idNivelRequerido: 4 }),
      ],
    });
    const resultado = await servicio.copiar(11, { idPuestoOrigen: 10 });
    expect(resultado.copiados).toBe(1);
    expect(resultado.omitidos).toEqual([
      { idConocimiento: 2, denominacion: 'Conocimiento 2' },
    ]);
    const destino = filas.filter((r) => r.idPuesto === 11);
    expect(destino).toHaveLength(2);
    expect(destino.find((r) => r.idConocimiento === 2)?.idNivelRequerido).toBe(4);
    expect(destino.find((r) => r.idConocimiento === 1)).toMatchObject({
      idNivelRequerido: 3,
      esExcluyente: true,
    });
  });

  it('no copia requisitos de conocimientos inactivos', async () => {
    const inactivo = requisito(10, 2);
    inactivo.conocimiento = conocimiento(2, false);
    const { servicio, filas } = crearEntorno({
      requisitos: [requisito(10, 1), inactivo],
    });
    const resultado = await servicio.copiar(11, { idPuestoOrigen: 10 });
    expect(resultado.copiados).toBe(1);
    expect(filas.filter((r) => r.idPuesto === 11)).toHaveLength(1);
  });

  it('rechaza copiar un puesto a sí mismo, un origen inexistente y un destino de baja', async () => {
    const e = crearEntorno({ puestos: [{ id: 10, activo: true }, { id: 12, activo: false }] });
    await expect(e.servicio.copiar(10, { idPuestoOrigen: 10 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(e.servicio.copiar(10, { idPuestoOrigen: 99 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(e.servicio.copiar(12, { idPuestoOrigen: 10 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RequisitosService.listar', () => {
  it('ordena por denominación y da 404 si el puesto no existe', async () => {
    const { servicio } = crearEntorno({
      requisitos: [requisito(10, 2), requisito(10, 1)],
    });
    const lista = await servicio.listar(10);
    expect(lista.map((r) => r.idConocimiento)).toEqual([1, 2]);
    await expect(servicio.listar(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
