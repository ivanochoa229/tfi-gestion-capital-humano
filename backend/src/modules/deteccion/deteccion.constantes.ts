export const MESES_HORIZONTE_DEFECTO = 24;
export const MESES_HORIZONTE_MAX = 120;

export const MOTIVO_SIN_SUCESOR = {
  sinPlan: 'sin_plan',
  planEnElaboracion: 'plan_en_elaboracion',
  ningunCandidatoCubre: 'ningun_candidato_cubre',
} as const;

export type MotivoSinSucesor =
  (typeof MOTIVO_SIN_SUCESOR)[keyof typeof MOTIVO_SIN_SUCESOR];

export const CONTEXTO_BRECHA = {
  ocupante: 'ocupante',
  candidato: 'candidato',
} as const;

export type ContextoBrecha =
  (typeof CONTEXTO_BRECHA)[keyof typeof CONTEXTO_BRECHA];
