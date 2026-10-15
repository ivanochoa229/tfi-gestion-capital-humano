const DESCRIPCION: Record<string, string> = {
  basico: 'Conozco los conceptos y resuelvo tareas simples con ayuda.',
  intermedio: 'Resuelvo por mi cuenta las tareas habituales.',
  avanzado: 'Resuelvo casos complejos y puedo orientar a otras personas.',
  experto: 'Soy referente: diseño soluciones y formo a otras personas.',
};

/** Frase que explica un nivel de dominio; vacía si el administrador agregó uno propio. */
export function descripcionNivel(codigo: string | undefined): string {
  return (codigo && DESCRIPCION[codigo]) || '';
}
