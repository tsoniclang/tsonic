/**
 * Numeric Coercion Pass - Widening/Narrowing Validation
 *
 * This pass validates numeric conversions between different numeric kinds.
 *
 * RULE: Implicit WIDENING is allowed, implicit NARROWING is rejected.
 *
 * Widening (allowed implicitly):
 * - Int32 → Double (int → number)
 * - Int32 → Int64 (int → long)
 * - Single → Double (float → number)
 * - etc. (see isWideningConversion in numeric-kind.ts)
 *
 * Narrowing (requires explicit cast):
 * - Double → Int32 (number → int) requires `as int`
 * - Int64 → Int32 (long → int) requires `as int`
 * - etc.
 *
 * Examples that now PASS:
 * - `const x: number = 42` ✓ (Int32 → Double is widening)
 * - `foo(42)` where foo expects `number` ✓
 * - `return 42` where function returns `number` ✓
 * - `[1, 2, 3]` in `number[]` context ✓
 *
 * Examples that still FAIL (narrowing):
 * - `const x: int = 1.5` ✗ (Double → Int32 is narrowing)
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
