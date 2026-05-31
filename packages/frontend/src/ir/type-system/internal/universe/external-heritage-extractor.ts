/**
 * native target Heritage Extractor — Facade
 *
 * Re-exports from sub-modules:
 * - external-heritage-extraction: TsBindgenDtsTypeInfo type, extractHeritageFromTsBindgenDts
 * - external-heritage-enrichment: enrichExternalEntriesFromTsBindgenDts
 */

export type { TsBindgenDtsTypeInfo } from "./external-heritage-extraction.js";
export { extractHeritageFromTsBindgenDts } from "./external-heritage-extraction.js";
export { enrichExternalEntriesFromTsBindgenDts } from "./external-heritage-enrichment.js";
