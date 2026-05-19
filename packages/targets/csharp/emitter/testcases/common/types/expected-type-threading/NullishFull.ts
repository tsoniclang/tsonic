import { int } from "@tsonic/core/types.js";

// ?? with nullable parameter - basic case
export function basicNullish(value: int | null): int {
  return value ?? 100;
}

// Nested ?? chain
export function nestedNullish(a: int | null, b: int | null): int {
  return a ?? b ?? 999;
}

// ?? with expression RHS
export function nullishWithExpr(value: int | null, fallback: int): int {
  return value ?? fallback;
}

// ?? in variable declaration
export function nullishInVar(value: int | null): int {
  const result: int = value ?? 42;
  return result;
}

// ?? in return inside if
export function nullishInIf(value: int | null, condition: boolean): int {
  if (condition) {
    return value ?? 50;
  }
  return value ?? 60;
}
