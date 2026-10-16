import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { aBooleano } from './catalogo.dto.js';
import { Trim } from './trim.js';

const MAX_INT4 = 2147483647;

/** En multipart un campo repetido llega como arreglo y uno solo como texto. */
const aListaDeEnteros = ({ value }: { value: unknown }) => {
  if (value === undefined) return value;
  const lista: unknown[] = Array.isArray(value) ? value : [value];
  return lista.map((v) =>
    typeof v === 'string' && v.trim() !== '' ? Number(v) : v,
  );
};

export class CrearActivoDto {
  @ApiProperty({
    maxLength: 200,
    example: 'Manual de administración de PostgreSQL',
  })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titulo: string;

  @ApiProperty({ description: 'Tipo de documento activo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idTipoDocumento: number;

  @ApiProperty({ description: 'Unidad que mantiene el activo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  idUnidad: number;

  @ApiProperty({
    type: [Number],
    description:
      'Conocimientos que documenta (al menos uno); en multipart, el campo se repite',
  })
  @Transform(aListaDeEnteros)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  idsConocimiento: number[];

  @ApiPropertyOptional({ example: '2027-03-31', nullable: true, type: String })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaVigencia debe ser AAAA-MM-DD',
  })
  @IsISO8601({ strict: true })
  fechaVigencia?: string | null;

  @ApiPropertyOptional({
    description: 'URL http(s) del activo; sin archivo es obligatoria',
  })
  @IsOptional()
  @Trim()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  @MaxLength(2000)
  enlace?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Archivo (campo multipart `archivo`); sin enlace es obligatorio',
  })
  @IsOptional()
  archivo?: unknown;
}

export class ActualizarActivoDto extends PartialType(
  OmitType(CrearActivoDto, ['archivo'] as const),
) {}

export class FiltroActivosDto {
  @ApiPropertyOptional({ description: 'Texto contenido en el título' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idConocimiento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idUnidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoDocumento?: number;

  @ApiPropertyOptional({
    description: 'true: solo vencidos; false: solo vigentes o sin fecha',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  vencido?: boolean;

  @ApiPropertyOptional({
    description: 'Solo roles de escritura; el resto no ve las bajas',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirBajas?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamanio: number = 20;
}

export class ActivoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  titulo: string;

  @ApiProperty()
  idTipoDocumento: number;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty({ enum: ['archivo', 'enlace'] })
  origen: 'archivo' | 'enlace';

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'URL, solo en los enlaces',
  })
  enlace: string | null;

  @ApiProperty({ nullable: true, type: String })
  nombreOriginal: string | null;

  @ApiProperty({ nullable: true, type: String })
  tipoMime: string | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Bytes' })
  tamanio: number | null;

  @ApiProperty({ nullable: true, type: String, example: '2027-03-31' })
  fechaVigencia: string | null;

  @ApiProperty({
    description: 'La fecha de vigencia ya pasó (calculado al consultar)',
  })
  vencido: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Días hasta la fecha de vigencia; negativo si ya venció',
  })
  diasParaVencer: number | null;

  @ApiProperty()
  activo: boolean;

  @ApiProperty({ type: [Number] })
  idsConocimiento: number[];

  @ApiProperty()
  creadoEn: string;

  @ApiProperty()
  actualizadoEn: string;
}

export class PaginaActivosDto {
  @ApiProperty({ type: [ActivoDto] })
  items: ActivoDto[];

  @ApiProperty({ description: 'Total que cumple el filtro' })
  total: number;
}
