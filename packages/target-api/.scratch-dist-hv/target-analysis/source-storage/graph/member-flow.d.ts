import type { SourceMemberPair } from "../../../public/source/objects.js";
import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
type Descriptor = SourceTypeDescriptor;
/** A member a spread or rest copies: its Host member name, optionality, read type and declarations. */
export interface SourceStorageSpreadMember {
    readonly name: string;
    readonly optional: boolean;
    readonly type: Descriptor;
    readonly declarations: readonly Node[];
}
export declare function createSourceStorageMemberFlow(source: SourceAnalysisProgram, budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined, retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean): Readonly<{
    memberFor: (owner: SourceStorageSubject, declaration: Node, receiverType: Descriptor) => SourceMemberPair | undefined;
    membersInLineage: <Bindings>(lineage: SourceStorageClassLineage<Bindings>, declaration: Node, destinationType: Descriptor) => {
        readonly members: readonly {
            readonly declaration: Node;
            readonly bindings: Bindings;
        }[];
        readonly absent: boolean;
    } | undefined;
    declarationsFor: (owner: SourceStorageSubject, declaration: Node, receiverType: Descriptor) => readonly Node[] | undefined;
    excludes: (owner: SourceStorageSubject, destinationType: Descriptor) => boolean;
    copyContributionFor: (owner: SourceStorageSubject, declaration: Node, destinationType: Descriptor, before: Node) => {
        readonly kind: "own";
        readonly declaration: Node;
    } | {
        readonly kind: "spread";
        readonly expression: Node;
        readonly components: readonly SourceStorageProjection[];
        readonly evaluation: Node;
        readonly definite: boolean;
    } | {
        readonly kind: "absent";
    } | undefined;
    memberStorageKindFor: (owner: SourceStorageSubject, declaration: Node, destinationType: Descriptor) => "direct" | "copied" | "absent" | undefined;
    spreadMembersFor: (expression: Node, evaluation: Node) => readonly SourceStorageSpreadMember[] | undefined;
    componentsFor: (owner: SourceStorageSubject) => readonly SourceStorageProjection[] | undefined;
    membersFor: (owner: SourceStorageSubject, destinationType: Descriptor) => readonly SourceMemberPair[] | undefined;
}>;
interface SourceStorageMemberImplementationInputs {
    readonly subject: import("../model/subjects.js").SourceStorageSubjectQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
    storesFor(subject: SourceStorageSubject): Iterable<import("../model/stores.js").SourceStorageStore> | undefined;
    readonly declarationsFor: ReturnType<typeof createSourceStorageMemberFlow>["declarationsFor"];
    readonly excludes: ReturnType<typeof createSourceStorageMemberFlow>["excludes"];
    readonly membersInLineage: ReturnType<typeof createSourceStorageMemberFlow>["membersInLineage"];
    readonly memberStorageKindFor: ReturnType<typeof createSourceStorageMemberFlow>["memberStorageKindFor"];
    constructionLineagesFor(invocation: Node, originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined, mode?: "heritage"): readonly SourceStorageClassLineage<undefined>[] | undefined;
    readonly contracts: ReadonlyMap<Node, ReadonlySet<Node>>;
    readonly accessorTargets: ReadonlyMap<Node, readonly import("./scoped-model.js").SourceStorageAccessorInvocation[]>;
}
export declare function createSourceStorageMemberImplementations(source: SourceAnalysisProgram, budget: SourceStorageBudget, inputs: SourceStorageMemberImplementationInputs): (declaration: Node, invocation: Node, originsFor?: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined, checkedReceiver?: Node) => {
    readonly nodes: ReadonlySet<Node>;
    readonly exact: boolean;
    readonly slots?: ReadonlySet<SourceStorageSubject>;
};
export {};
//# sourceMappingURL=member-flow.d.ts.map