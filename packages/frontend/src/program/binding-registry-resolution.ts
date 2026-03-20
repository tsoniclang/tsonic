/**
 * Binding Registry resolution — Facade
 *
 * Re-exports from sub-modules:
 * - binding-registry-resolution-member: RegistryState, signature parsing,
 *     lookup alias resolution, member overload resolution
 * - binding-registry-resolution-extension: extension method resolution,
 *     subtype checking
 */

export type { RegistryState } from "./binding-registry-resolution-member.js";
export {
  splitSignatureTypeList,
  resolveLookupAlias,
  resolveMemberOverloads,
} from "./binding-registry-resolution-member.js";

export {
  resolveExtensionMethod,
  resolveExtensionMethodByKey,
  isTypeOrSubtype,
} from "./binding-registry-resolution-extension.js";
