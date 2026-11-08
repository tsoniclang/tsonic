import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import type { createSourceStorageMemberFlow } from "../graph/member-flow.js";
export declare function createSourceStorageMutationDestinations<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget, memberFlow: ReturnType<typeof createSourceStorageMemberFlow>, lineagesFor: (origin: SourceStorageSubject) => readonly SourceStorageClassLineage<Bindings>[] | undefined): (origin: SourceStorageSubject, declarations: readonly Node[], receiverType: SourceTypeDescriptor) => ReadonlySet<Node> | undefined;
//# sourceMappingURL=mutation-destinations.d.ts.map