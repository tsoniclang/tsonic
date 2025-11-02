/**
 * Collect specialization requests from IR
 * Main dispatcher - re-exports from collection/ subdirectory
 */

export {
  collectSpecializations,
  collectFromStatement,
  collectFromExpression,
} from "./collection/index.js";
