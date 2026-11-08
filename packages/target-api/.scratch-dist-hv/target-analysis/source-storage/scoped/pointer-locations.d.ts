import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import { type SourceStoragePointerOperation } from "../model/host-reads.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReference, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
interface SourceStoragePointerLocationQueries {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    creatorScope(node: Node, scope: SourceStorageScope): SourceStorageScope;
}
type SourceStoragePointerLocation = SourceStorageReference | Extract<SourceStorageTerm, {
    readonly kind: "input-frontier" | "empty" | "unresolved";
}>;
export declare function createSourceStoragePointerLocations(source: SourceAnalysisProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport, queries: SourceStoragePointerLocationQueries): Readonly<{
    address: (operation: Extract<SourceStoragePointerOperation, {
        readonly operation: "address-of";
    }>, scope: SourceStorageScope) => readonly SourceStoragePointerLocation[] | undefined;
    identities: (pointer: SourceStorageReference) => readonly SourceStoragePointerLocation[] | undefined;
}>;
export {};
//# sourceMappingURL=pointer-locations.d.ts.map