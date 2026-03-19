/**
 * CLR Entry Converter — Facade
 *
 * Re-exports from sub-modules:
 * - clr-heritage-extractor: Heritage extraction from tsbindgen .d.ts files
 * - clr-raw-converter: Normalized signature parsing and RawBindingsType → NominalEntry
 */

export type { TsBindgenDtsTypeInfo } from "./clr-heritage-extractor.js";
export {
  extractHeritageFromTsBindgenDts,
  enrichAssemblyEntriesFromTsBindgenDts,
} from "./clr-heritage-extractor.js";

export {
  parsePropertyType,
  parseFieldType,
  parseMethodSignature,
  convertRawType,
} from "./clr-raw-converter.js";
