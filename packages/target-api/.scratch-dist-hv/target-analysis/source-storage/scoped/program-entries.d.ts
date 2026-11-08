import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceStorageTerm } from "../graph/scoped-model.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
export declare function createSourceStorageProgramEntries(source: SourceAnalysisProgram, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, step: () => boolean): (term: Extract<SourceStorageTerm, {
    readonly kind: "execution-root";
}>) => SourceStorageTerm[] | undefined;
//# sourceMappingURL=program-entries.d.ts.map