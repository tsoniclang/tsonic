import { int, byte, short, long, float } from "@tsonic/core/types.js";

// =============================================================================
// Section 1: Inferred types (module level)
// =============================================================================

export const inferredDouble = 42.5;
export const inferredInt = 42; // Lexeme is integer, but TS sees as number
export const inferredString = "hello";
export const inferredBool = true;

// =============================================================================
// Section 2: Explicit type annotations (module level)
// =============================================================================

export const explicitInt: int = 42;
export const explicitByte: byte = 255;
export const explicitShort: short = 1000;
export const explicitLong: long = 1000000;
export const explicitFloat: float = 1.5;
export const explicitDouble: number = 1.5;
export const explicitString: string = "world";
export const explicitBool: boolean = false;

// =============================================================================
// Section 3: Type assertions on literals (module level)
// =============================================================================

export const assertedInt = 42;
export const assertedByte = 255 as byte;
export const assertedShort = 1000 as short;
export const assertedLong = 1000000 as long;
export const assertedFloat = 1.5 as float;
export const assertedDouble = 42 as number;

// =============================================================================
// Section 4: Local declarations (inside function scope)
// =============================================================================

export function localDeclarations(): void {
  // Inferred types (C# uses var)
  const localInferredDouble = 42.5;
  const localInferredInt = 42;
  const localInferredString = "local";
  const localInferredBool = true;

  // Explicit annotations
  const localExplicitInt: int = 100;
  const localExplicitByte: byte = 200;
  const localExplicitFloat: float = 3.14;
  const localExplicitString: string = "explicit";

  // Type assertions
  const localAssertedInt = 200;
  const localAssertedFloat = 3.14 as float;
  const localAssertedDouble = 100 as number;
}

// =============================================================================
// Section 5: Mutable variables (let vs const)
// =============================================================================

export let mutableInt: int = 0;
export let mutableString: string = "";
export const immutableInt: int = 42;
