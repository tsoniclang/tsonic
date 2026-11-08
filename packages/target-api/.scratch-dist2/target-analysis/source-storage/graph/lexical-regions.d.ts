import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
export declare function sourceStorageRegionOwner(ast: AstReader, region: Node): Node | undefined;
export declare function createSourceStorageLexicalSelections(ast: AstReader, budget: SourceStorageBudget): Readonly<{
    enclosing: (node: Node) => Node | undefined;
    catchDestination: (node: Node) => Node | undefined;
}>;
//# sourceMappingURL=lexical-regions.d.ts.map