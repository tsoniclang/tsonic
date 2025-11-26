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
  addUsing,
  withStatic,
  withAsync,
  withClassName,
} from "./context.js";
export { getIndent, formatUsings } from "./formatting.js";
