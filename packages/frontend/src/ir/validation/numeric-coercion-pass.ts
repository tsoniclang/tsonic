/**
 * Numeric Coercion Pass - Widening/Narrowing Validation
 *
 * This pass validates numeric conversions between different numeric kinds.
 *
 * RULE: Implicit WIDENING is allowed, implicit NARROWING is rejected.
 *
 * Widening (allowed implicitly):
 * - source int → source number
 * - source int → source long
 * - source float → source number
 * - etc. (see isWideningConversion in numeric-kind.ts)
 *
 * Narrowing (requires explicit cast):
 * - source number → source int requires `as int`
 * - source long → source int requires `as int`
 * - etc.
 *
 * Examples that now PASS:
 * - `const x: number = 42` ✓ (source int literal → source number is widening)
 * - `foo(42)` where foo expects `number` ✓
 * - `return 42` where function returns `number` ✓
 * - `[1, 2, 3]` in `number[]` context ✓
 *
 * Examples that still FAIL (narrowing):
 * - `const x: int = 1.5` ✗ (source number → source int is narrowing)
 * - `const x: int = 3.14 as int` ✗ (`as int` is proof-checked; float→int truncation is not allowed)
 *
 * This pass runs AFTER the IR is built, BEFORE emission.
 * It is a HARD GATE - any errors prevent emission.
 *
 * FACADE: Implementation split into numeric-classification.ts and numeric-validation.ts.
 */

export {
  classifyNumericExpr,
  hasExplicitDoubleIntent,
  type NumericExprKind,
} from "./numeric-classification.js";

export {
  runNumericCoercionPass,
  type NumericCoercionResult,
} from "./numeric-validation.js";
