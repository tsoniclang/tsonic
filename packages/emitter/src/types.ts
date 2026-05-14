/**
 * C# Emitter Types
 * Main dispatcher - re-exports from emitter-types/ subdirectory
 */

export type {
  EmitterOptions,
  EmitterContext,
  EmitResult,
  CSharpAccessModifier,
  CSharpClassModifier,
  CSharpMethodModifier,
  CSharpUsing,
  ImportBinding,
  ModuleIdentity,
  ModuleMap,
  ExportSource,
  ExportMap,
  TypeMemberIndex,
  TypeMemberKind,
  JsonAotRegistry,
  LocalTypeInfo,
  NarrowedBinding,
  ValueSymbolKind,
  ValueSymbolInfo,
} from "./emitter-types/index.js";
export type {
  SemanticType,
  StorageCarrier,
} from "./core/semantic/type-domains.js";
export {
  createContext,
  indent,
  dedent,
  withStatic,
  withAsync,
  withClassName,
  withScoped,
  contextSurfaceIncludesJs,
  getIndent,
  renderTypeFQN,
  renderMemberFQN,
  renderFQN,
  FQN,
} from "./emitter-types/index.js";
export {
  semanticType,
  storageCarrier,
  semanticTypeOrUndefined,
  storageCarrierOrUndefined,
  semanticTypeMap,
  storageCarrierMap,
} from "./core/semantic/type-domains.js";
