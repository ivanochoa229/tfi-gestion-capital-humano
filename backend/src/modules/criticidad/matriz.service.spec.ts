import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ReferenciaService } from '../referencia/referencia.service.js';
import type { MatrizCriticidad } from './entities/matriz-criticidad.entity.js';
import type { NivelDificultad } from './entities/nivel-dificultad.entity.js';
import type { NivelImpacto } from './entities/nivel-impacto.entity.js';
import { MatrizService } from './matriz.service.js';

const escala = (id: number, orden: number, activo = true) => ({
  id,
  codigo: `c${id}`,
  denominacion: `D${id}`,
  orden,
  criterio: `criterio ${id}`,
  activo,
});

function crearServicio(
  opciones: {
    impactos?: ReturnType<typeof escala>[];
    dificultades?: ReturnType<typeof escala>[];
    celdas?: MatrizCriticidad[];
    referenciaFalla?: boolean;
  } = {},
) {
  const impactos = opciones.impactos ?? [
    escala(1, 1),
    escala(2, 2),
    escala(3, 3),
  ];
  const dificultades = opciones.dificultades ?? [
    escala(1, 1),
    escala(2, 2),
    escala(3, 3),
  ];
  const celdas: MatrizCriticidad[] = opciones.celdas ?? [
    {
      idNivelImpacto: 3,
      idNivelDificultad: 3,
      idNivelCriticidad: 30,
    } as MatrizCriticidad,
    {
      idNivelImpacto: 1,
      idNivelDificultad: 1,
      idNivelCriticidad: 10,
    } as MatrizCriticidad,
  ];
  const repoImpactos = {
    find: vi.fn(async () => impactos),
    findOneBy: vi.fn(
      async ({ id }: { id: number }) =>
        impactos.find((i) => i.id === id) ?? null,
    ),
  };
  const repoDificultades = {
    find: vi.fn(async () => dificultades),
    findOneBy: vi.fn(
      async ({ id }: { id: number }) =>
        dificultades.find((d) => d.id === id) ?? null,
    ),
  };
  const repoCeldas = {
    find: vi.fn(async () => celdas),
    findOneBy: vi.fn(
      async (w: { idNivelImpacto: number; idNivelDificultad: number }) =>
        celdas.find(
          (c) =>
            c.idNivelImpacto === w.idNivelImpacto &&
            c.idNivelDificultad === w.idNivelDificultad,
        ) ?? null,
    ),
    save: vi.fn(async (c: MatrizCriticidad) => c),
  };
  const referencia = {
    validarActivo: vi.fn(async () => {
      if (opciones.referenciaFalla) throw new BadRequestException('inactivo');
    }),
  };
  const servicio = new MatrizService(
    repoImpactos as unknown as Repository<NivelImpacto>,
    repoDificultades as unknown as Repository<NivelDificultad>,
    repoCeldas as unknown as Repository<MatrizCriticidad>,
    referencia as unknown as ReferenciaService,
  );
  return { servicio, repoCeldas, referencia };
}

describe('MatrizService.nivelDe', () => {
  it('devuelve el nivel de la celda', async () => {
    const { servicio } = crearServicio();
    expect(await servicio.nivelDe(3, 3)).toBe(30);
    expect(await servicio.nivelDe(1, 1)).toBe(10);
  });

  it('rechaza una escala inexistente o desactivada', async () => {
    const { servicio } = crearServicio({
      impactos: [escala(1, 1), escala(2, 2, false)],
    });
    await expect(servicio.nivelDe(9, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(servicio.nivelDe(2, 1)).rejects.toThrow(/desactivado/);
    await expect(servicio.nivelDe(1, 9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('da 500 si la matriz no tiene la celda (matriz incompleta)', async () => {
    const { servicio } = crearServicio();
    await expect(servicio.nivelDe(2, 2)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('MatrizService.obtener', () => {
  it('devuelve las escalas ordenadas con su criterio y las celdas', async () => {
    const { servicio } = crearServicio();
    const matriz = await servicio.obtener();
    expect(matriz.impactos.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(matriz.impactos[0].criterio).toBe('criterio 1');
    expect(matriz.celdas).toEqual([
      { idNivelImpacto: 3, idNivelDificultad: 3, idNivelCriticidad: 30 },
      { idNivelImpacto: 1, idNivelDificultad: 1, idNivelCriticidad: 10 },
    ]);
  });
});

describe('MatrizService.editarCelda', () => {
  it('cambia el nivel de la celda', async () => {
    const { servicio, repoCeldas } = crearServicio();
    const celda = await servicio.editarCelda(1, 1, { idNivelCriticidad: 20 });
    expect(celda).toEqual({
      idNivelImpacto: 1,
      idNivelDificultad: 1,
      idNivelCriticidad: 20,
    });
    expect(repoCeldas.save).toHaveBeenCalledOnce();
  });

  it('rechaza un nivel de criticidad inexistente o inactivo sin tocar la celda', async () => {
    const { servicio, repoCeldas } = crearServicio({ referenciaFalla: true });
    await expect(
      servicio.editarCelda(1, 1, { idNivelCriticidad: 99 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repoCeldas.save).not.toHaveBeenCalled();
  });

  it('da 404 si la celda no existe', async () => {
    const { servicio } = crearServicio();
    await expect(
      servicio.editarCelda(2, 2, { idNivelCriticidad: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
