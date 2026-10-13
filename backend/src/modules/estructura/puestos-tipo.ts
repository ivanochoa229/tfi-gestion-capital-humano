import { NIVELES_JERARQUICOS } from './estructura.constantes.js';

export type ClavePuestoTipo = 'jefe' | 'profesor' | 'jtp' | 'atp';

export interface PuestoTipo {
  clave: ClavePuestoTipo;
  denominacion: string;
  /** Código de `nivel_jerarquico`. */
  nivel: string;
  /** Clave del puesto tipo que es su superior; `null` si depende de la jefatura del departamento. */
  superior: ClavePuestoTipo | null;
}

/** Cargos de toda cátedra (primer avance, Alcance). El orden importa: cada superior va antes. */
export const PUESTOS_TIPO: readonly PuestoTipo[] = [
  {
    clave: 'jefe',
    denominacion: 'Jefe de cátedra',
    nivel: NIVELES_JERARQUICOS.conduccionCatedra,
    superior: null,
  },
  {
    clave: 'profesor',
    denominacion: 'Profesor auxiliar',
    nivel: NIVELES_JERARQUICOS.coordinacionDocente,
    superior: 'jefe',
  },
  {
    clave: 'jtp',
    denominacion: 'Jefe de trabajos prácticos',
    nivel: NIVELES_JERARQUICOS.coordinacionDocente,
    superior: 'jefe',
  },
  {
    clave: 'atp',
    denominacion: 'Auxiliar de trabajos prácticos',
    nivel: NIVELES_JERARQUICOS.operativoDocente,
    superior: 'jtp',
  },
];
