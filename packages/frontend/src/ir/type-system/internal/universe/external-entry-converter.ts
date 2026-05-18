/**
 * native target Entry Converter — Facade
 *
 * Re-exports from sub-modules:
 * - external-heritage-extractor: Heritage extraction from tsbindgen .d.ts files
 * - external-raw-converter: Normalized signature parsing and RawBindingsType → NominalEntry
 */

export type { TsBindgenDtsTypeInfo } from "./external-heritage-extractor.js";
export {
  extractHeritageFromTsBindgenDts,
  enrichAssemblyEntriesFromTsBindgenDts,
} from "./external-heritage-extractor.js";

export {
  parsePropertyType,
  parseFieldType,
  parseMethodSignature,
  convertRawType,
} from "./external-raw-converter.js";
