/**
 * CLR Heritage Extractor — Facade
 *
 * Re-exports from sub-modules:
 * - clr-heritage-extraction: TsBindgenDtsTypeInfo type, extractHeritageFromTsBindgenDts
 * - clr-heritage-enrichment: enrichAssemblyEntriesFromTsBindgenDts
 */

export type { TsBindgenDtsTypeInfo } from "./clr-heritage-extraction.js";
export { extractHeritageFromTsBindgenDts } from "./clr-heritage-extraction.js";
export { enrichAssemblyEntriesFromTsBindgenDts } from "./clr-heritage-enrichment.js";
