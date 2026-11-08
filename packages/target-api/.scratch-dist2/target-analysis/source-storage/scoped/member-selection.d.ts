import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReference, SourceStorageInputFrontier, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import type { SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
type SourceStoragePhysicalMembers = {
    readonly kind: "known";
    readonly members: readonly SourceStorageScopedSubject[];
    readonly absent: boolean;
    readonly excluded: boolean;
    readonly reason?: string;
} | {
    readonly kind: "pending";
};
export declare function createSourceStoragePhysicalMembers(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    symbolic(value: SourceStorageReference | SourceStorageInputFrontier): boolean;
    lineages(value: SourceStorageReference): readonly SourceStorageClassLineage<SourceStorageScope>[] | undefined;
}): (receiver: SourceStorageReference | SourceStorageInputFrontier, target: Node, receiverType: SourceTypeDescriptor, mode: "read" | "write", view: SourceStorageSubject) => SourceStoragePhysicalMembers | undefined;
export declare function sourceStorageSymbolicMemberAlias(transport: SourceStorageScopedTransport, symbolic: (subject: SourceStorageSubject, scope: SourceStorageScope) => boolean, left: SourceStorageReference, right: SourceStorageReference): boolean;
export {};
//# sourceMappingURL=member-selection.d.ts.map