/**
 * Binding resolution for member access expressions — Facade
 *
 * Re-exports from sub-modules:
 * - binding-resolution-hierarchical: resolveHierarchicalBinding
 * - binding-resolution-memberid: resolveHierarchicalBindingFromMemberId,
 *     resolveExtensionMethodsBinding
 */

export { resolveHierarchicalBinding } from "./binding-resolution-hierarchical.js";
export {
  resolveHierarchicalBindingFromMemberId,
  resolveExtensionMethodsBinding,
} from "./binding-resolution-memberid.js";
