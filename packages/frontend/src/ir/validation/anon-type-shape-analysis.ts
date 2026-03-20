/**
 * Anonymous Type Shape Analysis — Facade
 *
 * Re-exports from sub-modules:
 * - anon-type-shape-serialization: type serialization, shape computation,
 *     hashing, reference lowering keys
 * - anon-type-shape-collectors: type parameter collection, referenced type names,
 *     reachability analysis, nullish/undefined type manipulation
 */

export type { SerializeState } from "./anon-type-shape-serialization.js";
export {
  beginSerializeNode,
  serializeType,
  computeShapeSignature,
  generateShapeHash,
  generateModuleHash,
  getReferenceLoweringStableKey,
} from "./anon-type-shape-serialization.js";

export {
  collectTypeParameterNames,
  collectReferencedTypeNames,
  collectPubliclyReachableAnonymousTypes,
  stripNullishFromType,
  stripUndefinedFromType,
  addUndefinedToType,
} from "./anon-type-shape-collectors.js";
