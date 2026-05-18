/**
 * Call argument emission — facade re-exports.
 *
 * Implementations live in:
 *   - call-arguments-helpers.ts
 *   - call-arguments-emit.ts
 */

export {
  normalizeCallArgumentExpectedType,
  emitArrayWrapperElementTypeAst,
  expandTupleLikeSpreadArguments,
  wrapArgModifier,
  wrapIntCast,
  emitFlattenedRestArguments,
} from "./call-arguments-helpers.js";

export { emitCallArguments } from "./call-arguments-emit.js";
