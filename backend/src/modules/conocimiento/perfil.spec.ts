import { combinarRequisitos, type RequisitoDePuesto } from './perfil.js';

const fila = (parcial: Partial<RequisitoDePuesto>): RequisitoDePuesto => ({
  idConocimiento: 1,
  denominacion: 'SQL',
  idTipoConocimiento: 3,
  idPuesto: 10,
  codigoPuesto: 'P-0010',
  denominacionPuesto: 'Jefe de cátedra',
  idNivelRequerido: 2,
  ordenNivel: 2,
  esExcluyente: false,
  ...parcial,
});

describe('combinarRequisitos', () => {
  it('devuelve un conocimiento una sola vez aunque lo pidan varios puestos', () => {
    const resultado = combinarRequisitos([
      fila({ idPuesto: 10, codigoPuesto: 'P-0010' }),
      fila({ idPuesto: 11, codigoPuesto: 'P-0011', denominacionPuesto: 'Auxiliar' }),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].puestos.map((p) => p.codigo)).toEqual(['P-0010', 'P-0011']);
  });

  it('queda con el nivel más exigente por orden, no por id', () => {
    const [r] = combinarRequisitos([
      fila({ idPuesto: 10, idNivelRequerido: 9, ordenNivel: 1 }),
      fila({ idPuesto: 11, idNivelRequerido: 4, ordenNivel: 3 }),
      fila({ idPuesto: 12, idNivelRequerido: 7, ordenNivel: 2 }),
    ]);
    expect(r.idNivelRequerido).toBe(4);
    expect(r.ordenNivel).toBe(3);
  });

  it('es excluyente si algún puesto lo pide como excluyente', () => {
    const [r] = combinarRequisitos([
      fila({ idPuesto: 10, esExcluyente: false }),
      fila({ idPuesto: 11, esExcluyente: true }),
    ]);
    expect(r.esExcluyente).toBe(true);
  });

  it('no repite un puesto que figura dos veces (dos ocupaciones vigentes en el mismo puesto)', () => {
    const [r] = combinarRequisitos([fila({}), fila({})]);
    expect(r.puestos).toHaveLength(1);
  });

  it('ordena por denominación, sin distinguir tildes de orden', () => {
    const resultado = combinarRequisitos([
      fila({ idConocimiento: 2, denominacion: 'Redes' }),
      fila({ idConocimiento: 1, denominacion: 'Álgebra' }),
    ]);
    expect(resultado.map((r) => r.denominacion)).toEqual(['Álgebra', 'Redes']);
  });

  it('sin filas devuelve una lista vacía', () => {
    expect(combinarRequisitos([])).toEqual([]);
  });
});
