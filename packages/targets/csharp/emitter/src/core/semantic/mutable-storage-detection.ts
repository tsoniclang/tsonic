/**
 * Mutable storage detection — facade re-exports.
 *
 * Implementations live in:
 *   - mutable-storage-helpers.ts
 *   - mutable-storage-expression-visitor.ts
 */

export {
  type MutableStorageAnalysis,
  type ScopeStack,
  type VisitStatementFn,
  propertySlotKey,
  collectPatternNames,
  collectTopLevelConstBindings,
  buildClassMap,
  buildInterfaceMap,
  pushScope,
  popScope,
  declarePattern,
  isMutablePropertySlot,
} from "./mutable-storage-helpers.js";

export { visitExpression } from "./mutable-storage-expression-visitor.js";
