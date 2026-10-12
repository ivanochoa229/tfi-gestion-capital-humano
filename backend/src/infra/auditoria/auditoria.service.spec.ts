import type { Repository } from 'typeorm';
import type { Auditoria } from './auditoria.entity.js';
import { AuditoriaService } from './auditoria.service.js';

describe('AuditoriaService.consultar', () => {
  it('filtra por entidad y registro y ordena de lo más reciente a lo más antiguo', async () => {
    const find = vi.fn(async () => []);
    const servicio = new AuditoriaService({
      find,
    } as unknown as Repository<Auditoria>);
    await servicio.consultar({ entidad: 'plan_sucesion', idRegistro: '5' });
    expect(find).toHaveBeenCalledWith({
      where: { entidad: 'plan_sucesion', idRegistro: '5' },
      order: { fecha: 'DESC', id: 'DESC' },
      take: 200,
    });
  });

  it('sin filtros consulta todo con el mismo tope', async () => {
    const find = vi.fn(async () => []);
    const servicio = new AuditoriaService({
      find,
    } as unknown as Repository<Auditoria>);
    await servicio.consultar({});
    expect(find).toHaveBeenCalledWith({
      where: {},
      order: { fecha: 'DESC', id: 'DESC' },
      take: 200,
    });
  });
});
