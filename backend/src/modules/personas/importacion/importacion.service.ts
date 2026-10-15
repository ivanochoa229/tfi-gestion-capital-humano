import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Puesto } from '../../estructura/entities/puesto.entity.js';
import { UnidadOrganizativa } from '../../estructura/entities/unidad-organizativa.entity.js';
import { ReferenciaService } from '../../referencia/referencia.service.js';
import type { CrearOcupacionDto } from '../dto/crear-ocupacion.dto.js';
import type { CrearPersonaDto } from '../dto/crear-persona.dto.js';
import { Persona } from '../entities/persona.entity.js';
import { OcupacionesService } from '../ocupaciones.service.js';
import {
  DOMINIO_CARACTER_OCUPACION,
  DOMINIO_DEDICACION,
  DOMINIO_SITUACION_REVISTA,
} from '../personas.constantes.js';
import { PersonasService } from '../personas.service.js';
import { enTransaccionDePersonas, traducirError } from '../transaccion.js';
import { agrupar } from './agrupador.js';
import {
  construirCatalogos,
  resolverCaracter,
  resolverDedicacion,
  resolverPuesto,
  resolverSituacion,
  type Catalogos,
  type Resolucion,
} from './catalogos.js';
import { leerCsv } from './csv.js';
import type { ResultadoImportacionDto } from './dto/resultado-importacion.dto.js';
import type { ErrorImportacion } from './tipos.js';
import { armarOcupacion, armarPersona } from './validar.js';

interface PersonaLista {
  fila: number;
  dto: CrearPersonaDto;
  ocupaciones: { fila: number; dto: CrearOcupacionDto }[];
}

/** Fuerza el rollback de la transacción externa sin que cuente como fallo. */
class Revertir extends Error {}

/** Ocupación o persona rechazada por una regla de negocio: se reporta y se sigue. */
function comoError(fila: number, error: unknown): ErrorImportacion {
  const traducido = traducirError(error);
  if (traducido instanceof HttpException) {
    return { fila, mensaje: traducido.message };
  }
  throw traducido;
}

/**
 * Importación masiva de personas y ocupaciones (OE4; RF06, RF07). Aplica las
 * reglas del ABM llamando a `crearCon` de sus servicios dentro de una única
 * transacción, con un savepoint por fila para reunir todos los errores. Solo
 * con `confirmar` y sin errores hace commit; si no, rollback.
 */
@Injectable()
export class ImportacionService {
  constructor(
    @InjectRepository(Persona)
    private readonly personasRepo: Repository<Persona>,
    @InjectRepository(UnidadOrganizativa)
    private readonly unidades: Repository<UnidadOrganizativa>,
    @InjectRepository(Puesto) private readonly puestos: Repository<Puesto>,
    private readonly referencia: ReferenciaService,
    private readonly personas: PersonasService,
    private readonly ocupaciones: OcupacionesService,
  ) {}

  async importar(
    archivo: Buffer,
    confirmar: boolean,
  ): Promise<ResultadoImportacionDto> {
    const filas = leerCsv(archivo);
    const { personas, errores } = agrupar(filas);
    const catalogos = await this.cargarCatalogos();
    const listas = await this.resolver(personas, catalogos, errores);

    let creadas = { personas: 0, ocupaciones: 0 };
    if (listas.length > 0) {
      creadas = await this.ejecutar(listas, errores, confirmar);
    }

    return {
      importado: confirmar && errores.length === 0,
      filas: filas.length,
      personas: creadas.personas,
      ocupaciones: creadas.ocupaciones,
      errores: errores.sort((a, b) => a.fila - b.fila),
    };
  }

  /** Texto → ids → DTO validado. Lo que falla se reporta y se excluye de la ejecución. */
  private async resolver(
    personas: ReturnType<typeof agrupar>['personas'],
    catalogos: Catalogos,
    errores: ErrorImportacion[],
  ): Promise<PersonaLista[]> {
    const listas: PersonaLista[] = [];
    const tomar = <T>(
      r: Resolucion<T>,
      fila: number,
      columna: string,
    ): T | undefined => {
      if ('error' in r) {
        errores.push({ fila, columna, mensaje: r.error });
        return undefined;
      }
      return r.valor;
    };

    for (const p of personas) {
      const idSituacion = tomar(
        resolverSituacion(catalogos, p.situacionRevista),
        p.fila,
        'situacion_revista',
      );
      if (idSituacion === undefined) continue;
      const armada = await armarPersona(p, idSituacion);
      errores.push(...armada.errores);
      if (!armada.dto) continue;

      const lista: PersonaLista = {
        fila: p.fila,
        dto: armada.dto,
        ocupaciones: [],
      };
      for (const o of p.ocupaciones) {
        const idPuesto = tomar(
          resolverPuesto(catalogos, o.unidad, o.puesto),
          o.fila,
          'puesto',
        );
        const idCaracterOcupacion = tomar(
          resolverCaracter(catalogos, o.caracter),
          o.fila,
          'caracter',
        );
        const idDedicacion = tomar(
          resolverDedicacion(catalogos, o.dedicacion),
          o.fila,
          'dedicacion',
        );
        if (
          idPuesto === undefined ||
          idCaracterOcupacion === undefined ||
          idDedicacion === undefined
        ) {
          continue;
        }
        const armadaO = await armarOcupacion(o, {
          idPuesto,
          idCaracterOcupacion,
          idDedicacion,
        });
        errores.push(...armadaO.errores);
        if (armadaO.dto)
          lista.ocupaciones.push({ fila: o.fila, dto: armadaO.dto });
      }
      listas.push(lista);
    }
    return listas;
  }

  private async ejecutar(
    listas: PersonaLista[],
    errores: ErrorImportacion[],
    confirmar: boolean,
  ): Promise<{ personas: number; ocupaciones: number }> {
    const creadas = { personas: 0, ocupaciones: 0 };
    try {
      await enTransaccionDePersonas(this.personasRepo, async (manager) => {
        for (const lista of listas) {
          let idPersona: number;
          try {
            await this.personas.validarAlta(lista.dto);
            idPersona = await manager.transaction((m) =>
              this.personas.crearCon(m, lista.dto),
            );
          } catch (error) {
            errores.push(comoError(lista.fila, error));
            continue;
          }
          creadas.personas++;

          for (const ocupacion of lista.ocupaciones) {
            try {
              await this.ocupaciones.validarAlta(ocupacion.dto);
              await manager.transaction((m) =>
                this.ocupaciones.crearCon(m, idPersona, ocupacion.dto),
              );
              creadas.ocupaciones++;
            } catch (error) {
              errores.push(comoError(ocupacion.fila, error));
            }
          }
        }
        if (!confirmar || errores.length > 0) throw new Revertir();
      });
    } catch (error) {
      if (!(error instanceof Revertir)) throw error;
    }
    return creadas;
  }

  private async cargarCatalogos(): Promise<Catalogos> {
    const [situaciones, caracteres, dedicaciones, unidades, puestos] =
      await Promise.all([
        this.referencia.listarValores(DOMINIO_SITUACION_REVISTA),
        this.referencia.listarValores(DOMINIO_CARACTER_OCUPACION),
        this.referencia.listarValores(DOMINIO_DEDICACION),
        this.unidades.find(),
        this.puestos.find({ where: { activo: true } }),
      ]);
    return construirCatalogos({
      situaciones,
      caracteres,
      dedicaciones,
      unidades: unidades.map((u) => ({
        id: u.id,
        denominacion: u.denominacion,
        idSuperior: u.idUnidadSuperior,
        activo: u.activo,
      })),
      puestos: puestos.map((p) => ({
        id: p.id,
        denominacion: p.denominacion,
        idUnidad: p.idUnidad,
      })),
    });
  }
}
