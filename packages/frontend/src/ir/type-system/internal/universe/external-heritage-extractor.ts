/**
 * native target Heritage Extractor — Facade
 *
 * Re-exports from sub-modules:
 * - external-heritage-extraction: TsBindgenDtsTypeInfo type, extractHeritageFromTsBindgenDts
 * - external-heritage-enrichment: enrichAssemblyEntriesFromTsBindgenDts
 */

export type { TsBindgenDtsTypeInfo } from "./external-heritage-extraction.js";
export { extractHeritageFromTsBindgenDts } from "./external-heritage-extraction.js";
export { enrichAssemblyEntriesFromTsBindgenDts } from "./external-heritage-enrichment.js";
