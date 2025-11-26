/**
 * C# Emitter Types
 * Main dispatcher - re-exports from emitter-types/ subdirectory
 */

export type {
  EmitterOptions,
  EmitterContext,
  EmitResult,
  CSharpFragment,
  CSharpAccessModifier,
  CSharpClassModifier,
  CSharpMethodModifier,
  CSharpUsing,
  ImportBinding,
  ModuleIdentity,
  ModuleMap,
  ExportSource,
  ExportMap,
} from "./emitter-types/index.js";
export {
  createContext,
  indent,
  dedent,
  addUsing,
  withStatic,
  withAsync,
  withClassName,
  getIndent,
  formatUsings,
} from "./emitter-types/index.js";
