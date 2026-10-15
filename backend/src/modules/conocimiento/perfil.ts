export interface RequisitoDePuesto {
  idConocimiento: number;
  denominacion: string;
  idTipoConocimiento: number;
  idPuesto: number;
  codigoPuesto: string;
  denominacionPuesto: string;
  idNivelRequerido: number;
  /** Posición del nivel en la escala ordinal: mayor `orden`, más exigente. */
  ordenNivel: number;
  esExcluyente: boolean;
}

export interface PuestoQuePide {
  idPuesto: number;
  codigo: string;
  denominacion: string;
}

export interface RequisitoCombinado {
  idConocimiento: number;
  denominacion: string;
  idTipoConocimiento: number;
  idNivelRequerido: number;
  ordenNivel: number;
  esExcluyente: boolean;
  puestos: PuestoQuePide[];
}

/**
 * Junta los requisitos de todos los puestos que una persona ocupa: cada
 * conocimiento una vez, con el nivel más exigente, excluyente si algún puesto
 * lo es y la lista de puestos que lo piden.
 */
export function combinarRequisitos(
  filas: RequisitoDePuesto[],
): RequisitoCombinado[] {
  const porConocimiento = new Map<number, RequisitoCombinado>();
  for (const f of filas) {
    const puesto: PuestoQuePide = {
      idPuesto: f.idPuesto,
      codigo: f.codigoPuesto,
      denominacion: f.denominacionPuesto,
    };
    const actual = porConocimiento.get(f.idConocimiento);
    if (!actual) {
      porConocimiento.set(f.idConocimiento, {
        idConocimiento: f.idConocimiento,
        denominacion: f.denominacion,
        idTipoConocimiento: f.idTipoConocimiento,
        idNivelRequerido: f.idNivelRequerido,
        ordenNivel: f.ordenNivel,
        esExcluyente: f.esExcluyente,
        puestos: [puesto],
      });
      continue;
    }
    if (f.ordenNivel > actual.ordenNivel) {
      actual.idNivelRequerido = f.idNivelRequerido;
      actual.ordenNivel = f.ordenNivel;
    }
    actual.esExcluyente ||= f.esExcluyente;
    if (!actual.puestos.some((p) => p.idPuesto === f.idPuesto)) {
      actual.puestos.push(puesto);
    }
  }
  return [...porConocimiento.values()].sort((a, b) =>
    a.denominacion.localeCompare(b.denominacion, 'es'),
  );
}
