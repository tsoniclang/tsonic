import type { SourceAnalysisProgram } from "../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceErrorStorageDemandQueries } from "./model.js";
export declare function createSourceErrorInvalidationQuery(source: SourceAnalysisProgram, storage: SourceStorageQueries, storageFor: SourceErrorStorageDemandQueries["storageFor"], nativeSubjects: ReadonlySet<SourceStorageSubject>, capturedStackTargets: ReadonlyMap<Node, SourceStorageSubject>, step: () => boolean, failureReason: () => string | undefined): SourceErrorStorageDemandQueries["invalidationFor"];
//# sourceMappingURL=error-invalidation.d.ts.map