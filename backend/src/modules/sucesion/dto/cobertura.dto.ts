import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PuestoSinPlanDto {
  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  codigo: string;

  @ApiProperty()
  denominacion: string;

  @ApiProperty()
  idUnidad: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Plan en borrador o pendiente de aprobación, si lo hay',
  })
  idPlanEnElaboracion: number | null;

  @ApiProperty({ nullable: true, type: String })
  estadoPlanEnElaboracion: string | null;
}

export class CoberturaDto {
  @ApiProperty({ description: 'Puestos críticos activos del alcance' })
  criticos: number;

  @ApiProperty({ description: 'Críticos con un plan aprobado' })
  conPlan: number;

  @ApiProperty({ type: PuestoSinPlanDto, isArray: true })
  sinPlan: PuestoSinPlanDto[];
}

export class FiltroCoberturaDto {
  @ApiPropertyOptional({ description: 'Unidad con sus descendientes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  idUnidad?: number;
}

export class MiPlanDto {
  @ApiProperty()
  idPlan: number;

  @ApiProperty()
  idPuesto: number;

  @ApiProperty()
  denominacionPuesto: string;

  @ApiProperty({ description: 'Código del estado del plan (siempre aprobado)' })
  estadoPlan: string;

  @ApiProperty({ description: 'Tu estado de preparación' })
  estadoPreparacion: string;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  fechaDisponibilidadEstimada: string | null;
}
