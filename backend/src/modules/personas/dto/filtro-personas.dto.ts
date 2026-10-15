import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

const aBooleano = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}) => {
  const valor = obj[key];
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return valor;
};

export class FiltroPersonasDto {
  @ApiPropertyOptional({
    description: 'Texto contenido en el legajo, el apellido o el nombre',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: solo personas que todavía no tienen usuario vinculado',
  })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  sinUsuario?: boolean;
}
