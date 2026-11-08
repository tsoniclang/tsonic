import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageOperation, SourceStorageReduction, SourceStorageReference, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { type createSourceStorageExecutionReachability } from "./execution-reachability.js";
export declare function createSourceStorageScopedRejections(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    pointerThrows(invocation: Node, scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined;
    application(invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope, projection: SourceStorageSubject["projection"], operation: SourceStorageOperation): SourceStorageTerm;
}): Readonly<{
    caught: (reference: SourceStorageReference) => SourceStorageReduction | undefined;
    callableThrows: (subject: SourceStorageSubject, candidate: Node, invocation: Node, scope: SourceStorageScope, actualTypes?: readonly (readonly SourceTypeDescriptor[] | undefined)[], phase?: "call" | "active") => readonly SourceStorageTerm[] | undefined;
}>;
//# sourceMappingURL=rejections.d.ts.map