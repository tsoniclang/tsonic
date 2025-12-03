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
  JsonAotRegistry,
  LocalTypeInfo,
} from "./emitter-types/index.js";
export {
  createContext,
  indent,
  dedent,
  withStatic,
  withAsync,
  withClassName,
  withScoped,
  getIndent,
  renderTypeFQN,
  renderMemberFQN,
  renderFQN,
  FQN,
} from "./emitter-types/index.js";
