// Generic discriminated union defined as inline object members (TypeScript-style).
//
// This must be representable in CLR emission:
// - T/E appear inside inline object members
// - Union members must synthesize generic CLR types
// - Consumers should be able to narrow via `"error" in r`
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    // T cannot be inferred from arguments alone (only appears in the return type),
    // so we provide explicit type arguments (airplane-grade determinism).
    return err<number, string>("Division by zero");
  }
  return ok<number, string>(a / b);
}
