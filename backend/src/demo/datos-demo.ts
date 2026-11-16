import type { CodigoRol } from '../common/roles.js';

/**
 * Datos de demostración del Departamento de Sistemas.
 *
 * Todo se referencia por denominación, legajo o código de referencia (nunca por
 * id) y las fechas son relativas a la fecha actual: negativo es pasado y
 * positivo es futuro. Así la demo da los mismos resultados el día que se haga.
 *
 * La historia que cuentan los datos:
 * - Laura Benítez (jefa de Bases de Datos) es la única que domina SQL a nivel
 *   avanzado y se retira dentro de 10 meses: punto único de falla (RF16) con
 *   retiro dentro del horizonte (RF20). Su plan de sucesión espera aprobación
 *   y su candidato, Martín Acosta, tiene una brecha de un nivel en SQL (RF19).
 *   Acreditar a Martín en SQL avanzado y aprobar el plan quita el riesgo.
 * - Ricardo Molina (jefe de Ingeniería de Software) es el único que domina
 *   Arquitectura de software, pero se retira dentro de 40 meses: queda fuera
 *   del horizonte de 24 meses.
 * - Redes de Datos la sostiene una sola persona (RF17) y su jefe no tiene plan.
 * - Sistemas Operativos es el contraste: dos personas con Linux avanzado y un
 *   plan aprobado cuyo candidato cubre los requisitos excluyentes.
 */

export const DEPARTAMENTO = 'Departamento de Sistemas';
export const CLAVE_DEMO = 'DemoUTN2026';

/** Desplazamiento respecto de hoy; negativo es pasado. */
export interface Relativa {
  anios?: number;
  meses?: number;
  dias?: number;
}

export interface UsuarioDemo {
  nombreUsuario: string;
  rol: CodigoRol;
  /** Legajo de la persona vinculada (obligatoria para docente y jefe de cátedra). */
  legajo: string | null;
  /** Unidades a cargo (denominaciones); vacío para los roles sin alcance por unidad. */
  unidades: string[];
}

export interface PuestoDemo {
  codigo: string;
  denominacion: string;
  catedra: string;
  nivelJerarquico: string;
  dotacion: number;
  proposito: string;
}

export interface ConocimientoDemo {
  denominacion: string;
  tipo: string;
  area: string;
}

export interface RequisitoDemo {
  puesto: string;
  conocimiento: string;
  nivel: string;
  excluyente: boolean;
}

export interface PersonaDemo {
  legajo: string;
  apellido: string;
  nombre: string;
  documento: string;
  edadAnios: number;
  ingresoHaceAnios: number;
  situacionRevista: string;
  retiro: Relativa | null;
}

export interface OcupacionDemo {
  legajo: string;
  puesto: string;
  desde: Relativa;
  hasta: Relativa | null;
  caracter: string;
  dedicacion: string;
}

export interface ConocimientoPersonaDemo {
  legajo: string;
  conocimiento: string;
  declarado: { nivel: string; hace: Relativa } | null;
  acreditado: {
    nivel: string;
    evidencia: string;
    hace: Relativa;
    evaluador: string;
  } | null;
}

export interface EvaluacionDemo {
  puesto: string;
  conocimiento: string;
  impacto: string;
  dificultad: string;
  hace: Relativa;
}

export interface PlanDemo {
  /** Código del puesto: identifica al plan (hay uno por puesto en la demo). */
  puesto: string;
  responsable: string;
  estado: 'aprobado' | 'pendiente_aprobacion' | 'borrador';
}

export interface CandidatoDemo {
  /** Código del puesto del plan al que pertenece. */
  puesto: string;
  legajo: string;
  preparacion: string;
  prioridad: number;
  disponibleEn: Relativa | null;
}

export interface AccionDemo {
  tipo: string;
  conocimiento: string;
  /** Código del puesto del plan, o null si la acción no pertenece a un plan. */
  plan: string | null;
  responsable: string;
  destinatario: string | null;
  descripcion: string;
  prevista: Relativa;
  cumplimiento: Relativa | null;
  estado: string;
  nota: string | null;
}

export interface ActivoEnlaceDemo {
  titulo: string;
  tipoDocumento: string;
  unidad: string;
  url: string;
  conocimientos: string[];
}

export interface DatosDemo {
  catedras: string[];
  puestos: PuestoDemo[];
  conocimientos: ConocimientoDemo[];
  requisitos: RequisitoDemo[];
  personas: PersonaDemo[];
  ocupaciones: OcupacionDemo[];
  conocimientosPersona: ConocimientoPersonaDemo[];
  evaluaciones: EvaluacionDemo[];
  planes: PlanDemo[];
  candidatos: CandidatoDemo[];
  acciones: AccionDemo[];
  activosEnlace: ActivoEnlaceDemo[];
}

const BD = 'Bases de Datos';
const AED = 'Algoritmos y Estructuras de Datos';
const IS = 'Ingeniería de Software';
const RD = 'Redes de Datos';
const SO = 'Sistemas Operativos';

const SQL = 'SQL y modelado relacional';
const OPT = 'Optimización de consultas';
const JAVA = 'Java';
const ALG = 'Algoritmos y estructuras de datos';
const ARQ = 'Arquitectura de software';
const TEST = 'Testing automatizado';
const LINUX = 'Administración de Linux';
const REDES = 'Redes TCP/IP';
const DOCKER = 'Docker y contenedores';
const DIDACTICA = 'Didáctica universitaria';

const EVALUADOR = 'DEMO-003';

const declarado = (nivel: string, dias = -400) => ({
  nivel,
  hace: { dias },
});
const acreditado = (nivel: string, evidencia = 'certificado', dias = -200) => ({
  nivel,
  evidencia,
  hace: { dias },
  evaluador: EVALUADOR,
});

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    nombreUsuario: 'demo.admin',
    rol: 'administrador',
    legajo: null,
    unidades: [],
  },
  {
    nombreUsuario: 'demo.rrhh',
    rol: 'recursos_humanos',
    legajo: null,
    unidades: [],
  },
  {
    nombreUsuario: 'demo.analista',
    rol: 'analista_puestos',
    legajo: null,
    unidades: [],
  },
  {
    nombreUsuario: 'demo.autoridad',
    rol: 'autoridad',
    legajo: null,
    unidades: [],
  },
  {
    nombreUsuario: 'demo.jefatura',
    rol: 'jefatura_departamento',
    legajo: null,
    unidades: [DEPARTAMENTO],
  },
  {
    nombreUsuario: 'demo.jefecatedra',
    rol: 'jefe_catedra',
    legajo: 'DEMO-001',
    unidades: [BD],
  },
  {
    nombreUsuario: 'demo.docente',
    rol: 'docente',
    legajo: 'DEMO-004',
    unidades: [],
  },
];

export const DATOS_DEMO: DatosDemo = {
  catedras: [BD, AED, IS, RD, SO],

  puestos: [
    {
      codigo: 'P-BD-JEF',
      denominacion: 'Jefe de cátedra de Bases de Datos',
      catedra: BD,
      nivelJerarquico: 'conduccion_catedra',
      dotacion: 1,
      proposito:
        'Conducir la cátedra y sostener el modelado y la operación de bases de datos relacionales.',
    },
    {
      codigo: 'P-BD-JTP',
      denominacion: 'Jefe de trabajos prácticos de Bases de Datos',
      catedra: BD,
      nivelJerarquico: 'coordinacion_docente',
      dotacion: 1,
      proposito: 'Coordinar los trabajos prácticos de la cátedra.',
    },
    {
      codigo: 'P-AED-JEF',
      denominacion: 'Jefe de cátedra de Algoritmos y Estructuras de Datos',
      catedra: AED,
      nivelJerarquico: 'conduccion_catedra',
      dotacion: 1,
      proposito: 'Conducir la cátedra de programación inicial.',
    },
    {
      codigo: 'P-AED-AUX',
      denominacion: 'Auxiliar docente de Algoritmos y Estructuras de Datos',
      catedra: AED,
      nivelJerarquico: 'operativo_docente',
      dotacion: 2,
      proposito: 'Dictar prácticas y apoyar a los estudiantes.',
    },
    {
      codigo: 'P-IS-JEF',
      denominacion: 'Jefe de cátedra de Ingeniería de Software',
      catedra: IS,
      nivelJerarquico: 'conduccion_catedra',
      dotacion: 1,
      proposito:
        'Conducir la cátedra y la arquitectura de los proyectos integradores.',
    },
    {
      codigo: 'P-IS-AUX',
      denominacion: 'Auxiliar docente de Ingeniería de Software',
      catedra: IS,
      nivelJerarquico: 'operativo_docente',
      dotacion: 1,
      proposito:
        'Acompañar los proyectos integradores y las prácticas de testing.',
    },
    {
      codigo: 'P-RD-JEF',
      denominacion: 'Jefe de cátedra de Redes de Datos',
      catedra: RD,
      nivelJerarquico: 'conduccion_catedra',
      dotacion: 1,
      proposito: 'Conducir la cátedra y el laboratorio de redes.',
    },
    {
      codigo: 'P-SO-JEF',
      denominacion: 'Jefe de cátedra de Sistemas Operativos',
      catedra: SO,
      nivelJerarquico: 'conduccion_catedra',
      dotacion: 1,
      proposito: 'Conducir la cátedra y el laboratorio de sistemas operativos.',
    },
    {
      codigo: 'P-SO-AUX',
      denominacion: 'Auxiliar docente de Sistemas Operativos',
      catedra: SO,
      nivelJerarquico: 'operativo_docente',
      dotacion: 1,
      proposito: 'Dictar las prácticas del laboratorio.',
    },
  ],

  conocimientos: [
    { denominacion: SQL, tipo: 'competencia_tecnica', area: 'bases_de_datos' },
    { denominacion: OPT, tipo: 'competencia_tecnica', area: 'bases_de_datos' },
    { denominacion: JAVA, tipo: 'competencia_tecnica', area: 'programacion' },
    { denominacion: ALG, tipo: 'competencia_tecnica', area: 'programacion' },
    {
      denominacion: ARQ,
      tipo: 'competencia_tecnica',
      area: 'ingenieria_de_software',
    },
    {
      denominacion: TEST,
      tipo: 'competencia_tecnica',
      area: 'ingenieria_de_software',
    },
    {
      denominacion: LINUX,
      tipo: 'competencia_tecnica',
      area: 'sistemas_operativos',
    },
    {
      denominacion: REDES,
      tipo: 'competencia_tecnica',
      area: 'redes_y_comunicaciones',
    },
    {
      denominacion: DOCKER,
      tipo: 'competencia_tecnica',
      area: 'sistemas_operativos',
    },
    {
      denominacion: DIDACTICA,
      tipo: 'competencia_generica',
      area: 'docencia_universitaria',
    },
  ],

  requisitos: [
    {
      puesto: 'P-BD-JEF',
      conocimiento: SQL,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-BD-JEF',
      conocimiento: OPT,
      nivel: 'intermedio',
      excluyente: true,
    },
    {
      puesto: 'P-BD-JEF',
      conocimiento: DIDACTICA,
      nivel: 'intermedio',
      excluyente: false,
    },
    {
      puesto: 'P-BD-JTP',
      conocimiento: SQL,
      nivel: 'intermedio',
      excluyente: true,
    },
    {
      puesto: 'P-BD-JTP',
      conocimiento: OPT,
      nivel: 'basico',
      excluyente: false,
    },
    {
      puesto: 'P-AED-JEF',
      conocimiento: ALG,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-AED-JEF',
      conocimiento: JAVA,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-AED-AUX',
      conocimiento: JAVA,
      nivel: 'intermedio',
      excluyente: true,
    },
    {
      puesto: 'P-AED-AUX',
      conocimiento: ALG,
      nivel: 'intermedio',
      excluyente: true,
    },
    {
      puesto: 'P-IS-JEF',
      conocimiento: ARQ,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-IS-JEF',
      conocimiento: TEST,
      nivel: 'intermedio',
      excluyente: false,
    },
    {
      puesto: 'P-IS-AUX',
      conocimiento: TEST,
      nivel: 'intermedio',
      excluyente: true,
    },
    {
      puesto: 'P-RD-JEF',
      conocimiento: REDES,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-SO-JEF',
      conocimiento: LINUX,
      nivel: 'avanzado',
      excluyente: true,
    },
    {
      puesto: 'P-SO-JEF',
      conocimiento: DOCKER,
      nivel: 'intermedio',
      excluyente: false,
    },
    {
      puesto: 'P-SO-AUX',
      conocimiento: LINUX,
      nivel: 'intermedio',
      excluyente: true,
    },
  ],

  personas: [
    {
      legajo: 'DEMO-001',
      apellido: 'Benítez',
      nombre: 'Laura',
      documento: '20111001',
      edadAnios: 63,
      ingresoHaceAnios: 25,
      situacionRevista: 'planta_permanente',
      retiro: { meses: 10 },
    },
    {
      legajo: 'DEMO-002',
      apellido: 'Acosta',
      nombre: 'Martín',
      documento: '28111002',
      edadAnios: 38,
      ingresoHaceAnios: 8,
      situacionRevista: 'planta_permanente',
      retiro: null,
    },
    {
      legajo: 'DEMO-003',
      apellido: 'Herrera',
      nombre: 'Sofía',
      documento: '24111003',
      edadAnios: 48,
      ingresoHaceAnios: 18,
      situacionRevista: 'planta_permanente',
      retiro: null,
    },
    {
      legajo: 'DEMO-004',
      apellido: 'Paz',
      nombre: 'Diego',
      documento: '33111004',
      edadAnios: 32,
      ingresoHaceAnios: 4,
      situacionRevista: 'contratado',
      retiro: null,
    },
    {
      legajo: 'DEMO-005',
      apellido: 'Molina',
      nombre: 'Ricardo',
      documento: '18111005',
      edadAnios: 62,
      ingresoHaceAnios: 30,
      situacionRevista: 'planta_permanente',
      retiro: { meses: 40 },
    },
    {
      legajo: 'DEMO-006',
      apellido: 'Ríos',
      nombre: 'Valeria',
      documento: '35111006',
      edadAnios: 30,
      ingresoHaceAnios: 3,
      situacionRevista: 'contratado',
      retiro: null,
    },
    {
      legajo: 'DEMO-007',
      apellido: 'Quiroga',
      nombre: 'Hernán',
      documento: '22111007',
      edadAnios: 52,
      ingresoHaceAnios: 20,
      situacionRevista: 'planta_permanente',
      retiro: null,
    },
    {
      legajo: 'DEMO-008',
      apellido: 'Soria',
      nombre: 'Natalia',
      documento: '26111008',
      edadAnios: 45,
      ingresoHaceAnios: 15,
      situacionRevista: 'planta_permanente',
      retiro: null,
    },
    {
      legajo: 'DEMO-009',
      apellido: 'Luna',
      nombre: 'Pablo',
      documento: '34111009',
      edadAnios: 31,
      ingresoHaceAnios: 5,
      situacionRevista: 'contratado',
      retiro: null,
    },
  ],

  ocupaciones: [
    {
      legajo: 'DEMO-001',
      puesto: 'P-BD-JEF',
      desde: { anios: -12 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'exclusiva',
    },
    {
      legajo: 'DEMO-002',
      puesto: 'P-BD-JTP',
      desde: { anios: -6 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'semiexclusiva',
    },
    // Varias ocupaciones simultáneas (RF07): Martín también colabora en Algoritmos.
    {
      legajo: 'DEMO-002',
      puesto: 'P-AED-AUX',
      desde: { anios: -2 },
      hasta: null,
      caracter: 'interino',
      dedicacion: 'simple',
    },
    {
      legajo: 'DEMO-003',
      puesto: 'P-AED-JEF',
      desde: { anios: -10 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'exclusiva',
    },
    {
      legajo: 'DEMO-004',
      puesto: 'P-AED-AUX',
      desde: { anios: -3 },
      hasta: null,
      caracter: 'interino',
      dedicacion: 'simple',
    },
    {
      legajo: 'DEMO-005',
      puesto: 'P-IS-JEF',
      desde: { anios: -15 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'exclusiva',
    },
    {
      legajo: 'DEMO-006',
      puesto: 'P-IS-AUX',
      desde: { anios: -2 },
      hasta: null,
      caracter: 'interino',
      dedicacion: 'simple',
    },
    {
      legajo: 'DEMO-007',
      puesto: 'P-RD-JEF',
      desde: { anios: -8 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'semiexclusiva',
    },
    {
      legajo: 'DEMO-008',
      puesto: 'P-SO-JEF',
      desde: { anios: -9 },
      hasta: null,
      caracter: 'titular',
      dedicacion: 'exclusiva',
    },
    {
      legajo: 'DEMO-009',
      puesto: 'P-SO-AUX',
      desde: { anios: -1 },
      hasta: null,
      caracter: 'suplente',
      dedicacion: 'simple',
    },
    // Historial (RF07): ocupación cerrada.
    {
      legajo: 'DEMO-009',
      puesto: 'P-BD-JTP',
      desde: { anios: -5 },
      hasta: { anios: -2 },
      caracter: 'interino',
      dedicacion: 'simple',
    },
  ],

  conocimientosPersona: [
    // Laura
    {
      legajo: 'DEMO-001',
      conocimiento: SQL,
      declarado: declarado('experto'),
      acreditado: acreditado('experto'),
    },
    {
      legajo: 'DEMO-001',
      conocimiento: OPT,
      declarado: declarado('experto'),
      acreditado: acreditado('experto'),
    },
    {
      legajo: 'DEMO-001',
      conocimiento: DIDACTICA,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado', 'observacion_directa'),
    },
    // Martín: declara SQL avanzado, pero solo está acreditado como intermedio.
    {
      legajo: 'DEMO-002',
      conocimiento: SQL,
      declarado: declarado('avanzado', -30),
      acreditado: acreditado('intermedio', 'certificado', -300),
    },
    {
      legajo: 'DEMO-002',
      conocimiento: OPT,
      declarado: declarado('intermedio'),
      acreditado: acreditado('intermedio', 'entrevista'),
    },
    {
      legajo: 'DEMO-002',
      conocimiento: DOCKER,
      declarado: declarado('basico', -60),
      acreditado: null,
    },
    // Sofía
    {
      legajo: 'DEMO-003',
      conocimiento: ALG,
      declarado: declarado('experto'),
      acreditado: acreditado('experto', 'titulo'),
    },
    {
      legajo: 'DEMO-003',
      conocimiento: JAVA,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado'),
    },
    {
      legajo: 'DEMO-003',
      conocimiento: DIDACTICA,
      declarado: declarado('experto'),
      acreditado: acreditado('avanzado', 'observacion_directa'),
    },
    // Diego (demo.docente): Algoritmos acreditado en básico frente a un requisito intermedio
    // (brecha, RF19); Docker y Testing declarados sin acreditar (RF10).
    {
      legajo: 'DEMO-004',
      conocimiento: JAVA,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado'),
    },
    {
      legajo: 'DEMO-004',
      conocimiento: ALG,
      declarado: declarado('intermedio'),
      acreditado: acreditado('basico', 'entrevista', -150),
    },
    {
      legajo: 'DEMO-004',
      conocimiento: DOCKER,
      declarado: declarado('intermedio', -45),
      acreditado: null,
    },
    {
      legajo: 'DEMO-004',
      conocimiento: TEST,
      declarado: declarado('basico', -45),
      acreditado: null,
    },
    // Ricardo
    {
      legajo: 'DEMO-005',
      conocimiento: ARQ,
      declarado: declarado('experto'),
      acreditado: acreditado('experto', 'produccion'),
    },
    {
      legajo: 'DEMO-005',
      conocimiento: TEST,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado'),
    },
    // Valeria
    {
      legajo: 'DEMO-006',
      conocimiento: TEST,
      declarado: declarado('avanzado'),
      acreditado: acreditado('intermedio', 'entrevista'),
    },
    {
      legajo: 'DEMO-006',
      conocimiento: ARQ,
      declarado: declarado('basico'),
      acreditado: acreditado('basico', 'entrevista'),
    },
    {
      legajo: 'DEMO-006',
      conocimiento: JAVA,
      declarado: declarado('intermedio'),
      acreditado: null,
    },
    // Hernán
    {
      legajo: 'DEMO-007',
      conocimiento: REDES,
      declarado: declarado('experto'),
      acreditado: acreditado('experto', 'titulo'),
    },
    {
      legajo: 'DEMO-007',
      conocimiento: LINUX,
      declarado: declarado('intermedio'),
      acreditado: acreditado('intermedio'),
    },
    // Natalia
    {
      legajo: 'DEMO-008',
      conocimiento: LINUX,
      declarado: declarado('experto'),
      acreditado: acreditado('experto', 'titulo'),
    },
    {
      legajo: 'DEMO-008',
      conocimiento: DOCKER,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado'),
    },
    // Pablo
    {
      legajo: 'DEMO-009',
      conocimiento: LINUX,
      declarado: declarado('avanzado'),
      acreditado: acreditado('avanzado'),
    },
    {
      legajo: 'DEMO-009',
      conocimiento: DOCKER,
      declarado: declarado('intermedio'),
      acreditado: acreditado('intermedio', 'entrevista'),
    },
  ],

  // Quedan sin evaluar, a propósito, los pares de los puestos de auxiliar, el de
  // JTP de Bases de Datos y los deseables, para evaluar uno en vivo (RF12).
  evaluaciones: [
    {
      puesto: 'P-BD-JEF',
      conocimiento: SQL,
      impacto: 'alto',
      dificultad: 'dificil',
      hace: { dias: -90 },
    },
    {
      puesto: 'P-BD-JEF',
      conocimiento: OPT,
      impacto: 'alto',
      dificultad: 'moderada',
      hace: { dias: -90 },
    },
    {
      puesto: 'P-IS-JEF',
      conocimiento: ARQ,
      impacto: 'alto',
      dificultad: 'dificil',
      hace: { dias: -80 },
    },
    {
      puesto: 'P-RD-JEF',
      conocimiento: REDES,
      impacto: 'alto',
      dificultad: 'moderada',
      hace: { dias: -70 },
    },
    {
      puesto: 'P-SO-JEF',
      conocimiento: LINUX,
      impacto: 'alto',
      dificultad: 'moderada',
      hace: { dias: -60 },
    },
    {
      puesto: 'P-AED-JEF',
      conocimiento: ALG,
      impacto: 'medio',
      dificultad: 'facil',
      hace: { dias: -50 },
    },
    {
      puesto: 'P-AED-JEF',
      conocimiento: JAVA,
      impacto: 'medio',
      dificultad: 'moderada',
      hace: { dias: -50 },
    },
  ],

  planes: [
    { puesto: 'P-SO-JEF', responsable: 'DEMO-008', estado: 'aprobado' },
    {
      puesto: 'P-BD-JEF',
      responsable: 'DEMO-001',
      estado: 'pendiente_aprobacion',
    },
    { puesto: 'P-IS-JEF', responsable: 'DEMO-005', estado: 'borrador' },
  ],

  candidatos: [
    {
      puesto: 'P-SO-JEF',
      legajo: 'DEMO-009',
      preparacion: 'listo_ahora',
      prioridad: 1,
      disponibleEn: { meses: 1 },
    },
    {
      puesto: 'P-BD-JEF',
      legajo: 'DEMO-002',
      preparacion: 'mediano_plazo',
      prioridad: 1,
      disponibleEn: { meses: 8 },
    },
    {
      puesto: 'P-IS-JEF',
      legajo: 'DEMO-006',
      preparacion: 'en_desarrollo',
      prioridad: 1,
      disponibleEn: { meses: 30 },
    },
  ],

  acciones: [
    {
      tipo: 'mentoria',
      conocimiento: SQL,
      plan: 'P-BD-JEF',
      responsable: 'DEMO-001',
      destinatario: 'DEMO-002',
      descripcion: 'Mentoría semanal de modelado relacional y SQL avanzado.',
      prevista: { meses: 4 },
      cumplimiento: null,
      estado: 'en_curso',
      nota: 'Van tres encuentros; faltan índices y planes de ejecución.',
    },
    {
      tipo: 'documentacion',
      conocimiento: OPT,
      plan: 'P-BD-JEF',
      responsable: 'DEMO-001',
      destinatario: null,
      descripcion:
        'Documentar el procedimiento de optimización de consultas de la cátedra.',
      prevista: { meses: 2 },
      cumplimiento: null,
      estado: 'pendiente',
      nota: null,
    },
    {
      tipo: 'capacitacion',
      conocimiento: LINUX,
      plan: 'P-SO-JEF',
      responsable: 'DEMO-008',
      destinatario: 'DEMO-009',
      descripcion:
        'Capacitación en administración de Linux para el laboratorio.',
      prevista: { dias: -30 },
      cumplimiento: { dias: -20 },
      estado: 'completada',
      nota: 'Completada y evaluada con observación directa.',
    },
    // Acción sin plan asignada al docente de la demo (RF15).
    {
      tipo: 'documentacion',
      conocimiento: JAVA,
      plan: null,
      responsable: 'DEMO-004',
      destinatario: null,
      descripcion: 'Escribir la guía de Java para las prácticas de Algoritmos.',
      prevista: { meses: 1 },
      cumplimiento: null,
      estado: 'pendiente',
      nota: null,
    },
  ],

  activosEnlace: [
    {
      titulo: 'Documentación oficial de PostgreSQL 16',
      tipoDocumento: 'manual',
      unidad: BD,
      url: 'https://www.postgresql.org/docs/16/index.html',
      conocimientos: [SQL, OPT],
    },
    {
      titulo: 'Guía de administración de Linux del laboratorio',
      tipoDocumento: 'instructivo',
      unidad: SO,
      url: 'https://www.kernel.org/doc/html/latest/',
      conocimientos: [LINUX],
    },
  ],
};
