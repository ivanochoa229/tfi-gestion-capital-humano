import { Transform } from 'class-transformer';

/** Quita los espacios de los extremos antes de validar. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
