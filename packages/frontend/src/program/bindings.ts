/**
 * Binding manifest loading - maps JS/TS names to CLR types/members
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
  FullBindingManifest,
  SimpleBindingDescriptor,
  SimpleBindingFile,
  TsbindgenMethod,
  TsbindgenProperty,
  TsbindgenField,
  TsbindgenTypeRef,
  TsbindgenType,
  TsbindgenExport,
  TsbindgenBindingFile,
  FirstPartyBindingsFileV2,
  BindingFile,
} from "./binding-types.js";

export {
  isFullBindingManifest,
  isTsbindgenBindingFile,
  validateBindingFile,
} from "./binding-types.js";

export {
  isFirstPartyBindingsFileV2,
  getDotnetBindingPayload,
  extractRawDotnetBindingsPayload,
  extractRawDotnetBindingTypes,
  extractRawDotnetAssemblyName,
} from "./dotnet-binding-payload.js";

// ── Registry ───────────────────────────────────────────────────────────────
export { BindingRegistry } from "./binding-registry.js";

// ── Loaders ────────────────────────────────────────────────────────────────
export {
  scanForDeclarationFiles,
  loadBindings,
  loadBindingsFromPath,
  loadAllDiscoveredBindings,
} from "./binding-loader.js";
