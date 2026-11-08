import { type SourceAnalysisProgram } from "../analysis-program.js";
import type { SourceFile } from "@tsonic/tsts";
import type { SourceStorageEffects, SourceStorageLimits, SourceStorageQueries } from "./model/types.js";
/** Host-internal: the program a storage query was built over; undefined for a record not built by createSourceStorageQuery. */
export declare function sourceStorageQueriesProgram(storage: SourceStorageQueries): SourceAnalysisProgram | undefined;
export declare function createSourceStorageQuery(source: SourceAnalysisProgram, sourceFiles: readonly SourceFile[], limits?: SourceStorageLimits, effects?: SourceStorageEffects): SourceStorageQueries;
//# sourceMappingURL=queries.d.ts.map