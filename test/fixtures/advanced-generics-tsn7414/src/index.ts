// NEGATIVE TEST: Type aliases with inline object types containing type parameters
// This triggers TSN7414: Unresolved reference type in anonymous object context.
// Type parameters T and E in the inline union members cannot be resolved
// because they're referenced inside anonymous object types, not at the top level.

// ERROR: TSN7414 - Type alias with inline object types using type parameters
// The properties 'value: T' and 'error: E' reference type parameters
// that cannot be resolved by the IR soundness gate.
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// These functions would use Result but the type alias itself fails validation
export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

// Example usage that would work if type param resolution was implemented
export function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err("Division by zero");
  }
  return ok(a / b);
}
