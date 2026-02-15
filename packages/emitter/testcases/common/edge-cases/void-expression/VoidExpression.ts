import { int } from "@tsonic/core/types.js";

export function voidStatementMarker(): void {
  const x: int = 1;
  void x;
}

export function voidReturnInVoidFunc(): void {
  return void sideEffect();
}

export function voidReturnValue(): unknown {
  return void sideEffect();
}

function sideEffect(): int {
  return 42;
}
