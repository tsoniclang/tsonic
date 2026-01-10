/**
 * Emitter types - Public API
 */

export type {
  EmitterOptions,
  EmitterContext,
  EmitResult,
  CSharpFragment,
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
} from "./core.js";
export type {
  CSharpAccessModifier,
  CSharpClassModifier,
  CSharpMethodModifier,
  CSharpUsing,
} from "./csharp-types.js";
export {
  createContext,
  indent,
  dedent,
  withStatic,
  withAsync,
  withClassName,
  withScoped,
} from "./context.js";
export { getIndent } from "./formatting.js";
export { renderTypeFQN, renderMemberFQN, renderFQN, FQN } from "./fqn.js";
export { escapeCSharpIdentifier, isCSharpKeyword } from "./identifiers.js";
