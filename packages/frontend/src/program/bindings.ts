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
  BindingFile,
} from "./binding-types.js";

export {
  isFullBindingManifest,
  isTsbindgenBindingFile,
  validateBindingFile,
} from "./binding-types.js";

// ── Registry ───────────────────────────────────────────────────────────────
export { BindingRegistry } from "./binding-registry.js";

// ── Loaders ────────────────────────────────────────────────────────────────
export {
  scanForDeclarationFiles,
  loadBindings,
  loadBindingsFromPath,
  loadAllDiscoveredBindings,
} from "./binding-loader.js";
