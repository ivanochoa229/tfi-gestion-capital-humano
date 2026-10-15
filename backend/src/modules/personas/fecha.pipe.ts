import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { esFechaValida } from './fechas.js';

/** Valida un segmento de la URL con formato `AAAA-MM-DD` que exista en el calendario. */
@Injectable()
export class ParseFechaPipe implements PipeTransform<string, string> {
  transform(valor: string): string {
    if (!esFechaValida(valor)) {
      throw new BadRequestException(
        'La fecha debe tener formato AAAA-MM-DD y existir',
      );
    }
    return valor;
  }
}
