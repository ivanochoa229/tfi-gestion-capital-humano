import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { CrearOcupacionDto } from '../dto/crear-ocupacion.dto.js';
import { CrearPersonaDto } from '../dto/crear-persona.dto.js';
import type { OcupacionCsv, PersonaCsv } from './agrupador.js';
import type { ErrorImportacion } from './tipos.js';

/** Propiedad del DTO → columna del CSV, para que el error apunte donde RR. HH. edita. */
const COLUMNA_DE: Record<string, string> = {
  legajo: 'legajo',
  apellido: 'apellido',
  nombre: 'nombre',
  documento: 'documento',
  fechaNacimiento: 'fecha_nacimiento',
  fechaIngreso: 'fecha_ingreso',
  idSituacionRevista: 'situacion_revista',
  fechaPrevistaRetiro: 'fecha_prevista_retiro',
  idPuesto: 'puesto',
  fechaDesde: 'fecha_desde',
  fechaHasta: 'fecha_hasta',
  idCaracterOcupacion: 'caracter',
  idDedicacion: 'dedicacion',
};

const vacioASinDefinir = (texto: string) => (texto === '' ? undefined : texto);

function aErrores(
  fila: number,
  errores: ValidationError[],
): ErrorImportacion[] {
  // Un error por columna: un decorador puede fallar en varias reglas a la vez.
  return errores.flatMap((e) => {
    const [mensaje] = Object.values(e.constraints ?? {});
    return mensaje === undefined
      ? []
      : [{ fila, columna: COLUMNA_DE[e.property] ?? e.property, mensaje }];
  });
}

/** Aplica las mismas validaciones del alta manual (`CrearPersonaDto`). */
export async function armarPersona(
  p: PersonaCsv,
  idSituacionRevista: number,
): Promise<{ dto?: CrearPersonaDto; errores: ErrorImportacion[] }> {
  const dto = plainToInstance(CrearPersonaDto, {
    legajo: p.legajo,
    apellido: p.apellido,
    nombre: p.nombre,
    documento: p.documento,
    fechaNacimiento: p.fechaNacimiento,
    fechaIngreso: p.fechaIngreso,
    idSituacionRevista,
    fechaPrevistaRetiro: vacioASinDefinir(p.fechaPrevistaRetiro),
  });
  const errores = aErrores(p.fila, await validate(dto));
  return errores.length > 0 ? { errores } : { dto, errores };
}

/** Aplica las mismas validaciones del alta manual (`CrearOcupacionDto`). */
export async function armarOcupacion(
  o: OcupacionCsv,
  ids: {
    idPuesto: number;
    idCaracterOcupacion: number;
    idDedicacion: number;
  },
): Promise<{ dto?: CrearOcupacionDto; errores: ErrorImportacion[] }> {
  const dto = plainToInstance(CrearOcupacionDto, {
    ...ids,
    fechaDesde: o.fechaDesde,
    fechaHasta: vacioASinDefinir(o.fechaHasta),
  });
  const errores = aErrores(o.fila, await validate(dto));
  return errores.length > 0 ? { errores } : { dto, errores };
}
