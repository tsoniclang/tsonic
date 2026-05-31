/**
 * Binding manifest loading - maps JS/TS names to external target types/members
 * See spec/bindings.md for full manifest format
 *
 * This barrel module re-exports all binding types, the registry, and loaders
 * so that existing imports from "program/bindings.js" continue to work.
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ParameterModifier,
  EmitCallStyle,
  EmitSemantics,
  TypeSemantics,
  MemberBinding,
  TypeBinding,
  NamespaceBinding,
  SimpleBindingDescriptor,
  TsbindgenMethod,
  TsbindgenProperty,
  TsbindgenField,
  TsbindgenTypeRef,
  TsbindgenType,
  TsbindgenExport,
  BindingProviderDescriptor,
  BindingSourceSurface,
  BindingTargetSurface,
  BindingFile,
} from "./binding-types.js";

export {
  TSONIC_BINDINGS_SCHEMA,
  validateBindingFile,
} from "./binding-types.js";

export {
  getExternalBindingPayload,
  extractRawExternalBindingsPayload,
  extractRawExternalBindingTypes,
  extractRawExternalOwnerIdentity,
} from "./external-binding-payload.js";

// ── Registry ───────────────────────────────────────────────────────────────
export { BindingRegistry } from "./binding-registry.js";

// ── Loaders ────────────────────────────────────────────────────────────────
export {
  scanForDeclarationFiles,
  loadBindings,
  loadBindingsFromPath,
  loadAllDiscoveredBindings,
} from "./binding-loader.js";
