/**
 * Program creation -- facade re-exporting from sub-modules.
 */

export {
  scanForDeclarationFiles,
  collectProjectIncludedDeclarationFiles,
} from "./core-declarations.js";

export { createProgram } from "./program-factory.js";
