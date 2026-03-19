/**
 * Runtime-union adaptation and projection helpers — facade re-exports.
 *
 * Implementations live in:
 *   - runtime-union-adaptation-projection.ts
 *   - runtime-union-adaptation-upcast.ts
 */

export { maybeNarrowRuntimeUnionExpressionAst } from "./runtime-union-adaptation-projection.js";

export {
  maybeUpcastDictionaryUnionValueAst,
  maybeUpcastExpressionToExpectedTypeAst,
  resolveDirectStorageExpressionType,
} from "./runtime-union-adaptation-upcast.js";
