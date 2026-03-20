/**
 * Expression converter - TypeScript AST to IR expressions (facade)
 *
 * Sub-modules:
 * - expression-converter-helpers.ts  : numeric kind extraction, this-type, utilities
 * - expression-converter-dispatch.ts : main dispatcher
 */

export { convertExpression } from "./expression-converter-dispatch.js";
