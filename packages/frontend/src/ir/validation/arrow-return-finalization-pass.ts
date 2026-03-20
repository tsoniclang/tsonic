/**
 * Arrow Return Finalization Pass
 *
 * For expression-bodied arrow functions without explicit return type,
 * this pass infers the return type from the body expression's inferredType.
 *
 * This pass runs AFTER numeric proof pass, so that the body expression's
 * inferredType has been finalized with proper numeric kinds.
 *
 * FACADE: re-exports from arrow-return-statement-walk and arrow-return-expression-walk.
 */

export type { ArrowReturnFinalizationResult } from "./arrow-return-statement-walk.js";

export { runArrowReturnFinalizationPass } from "./arrow-return-statement-walk.js";
