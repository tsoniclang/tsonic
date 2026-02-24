/**
 * Module emission - Public API
 */

export { emitModule } from "./orchestrator.js";
export { generateHeader } from "./header.js";
export { separateStatements, type SeparatedStatements } from "./separation.js";
export {
  emitNamespaceDeclarations,
  type NamespaceEmissionResult,
} from "./namespace.js";
export {
  emitStaticContainer,
  hasMatchingClassName,
  type StaticContainerResult,
} from "./static-container.js";
export { assembleOutput, type AssemblyParts } from "./assembly.js";
