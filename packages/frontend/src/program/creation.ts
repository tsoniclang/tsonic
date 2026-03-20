/**
 * Program creation -- facade re-exporting from sub-modules.
 */

export {
  CORE_GLOBALS_DECLARATIONS,
  JS_SURFACE_GLOBAL_AUGMENTATIONS,
  scanForDeclarationFiles,
  collectProjectIncludedDeclarationFiles,
  createCompilerOptions,
} from "./core-declarations.js";

export { createProgram } from "./program-factory.js";
