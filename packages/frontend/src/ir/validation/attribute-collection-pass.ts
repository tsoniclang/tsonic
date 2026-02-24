/**
 * Attribute Collection Pass
 *
 * This pass detects compiler-only marker calls and transforms them into IR attributes
 * attached to the corresponding declarations, removing the marker statements.
 *
 * Supported patterns:
 * - A.on(Class).type.add(AttrCtor, ...args)           - Type attribute
 * - A.on(Class).ctor.add(AttrCtor, ...args)           - Constructor attribute
 * - A.on(Class).method(x => x.method).add(AttrCtor)   - Method attribute
 * - A.on(Class).prop(x => x.prop).add(AttrCtor)       - Property attribute
 * - add(A.attr(AttrCtor, ...args))                    - Descriptor form
 * - add(descriptor) where `const descriptor = A.attr(...)`
 *
 * Backward compatibility:
 * - A.on(fn).type.add(AttrCtor, ...args) attaches to a function declaration
 *
 * Notes:
 * - This API is compiler-only. All recognized marker statements are removed.
 * - Invalid marker calls are errors (no silent drops).
 *
 * Thin re-export wrapper — implementation split into attribute-collection/ sub-modules.
 */

export {
  runAttributeCollectionPass,
  type AttributeCollectionResult,
} from "./attribute-collection/orchestrator.js";
