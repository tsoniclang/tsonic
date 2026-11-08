import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProgramNavigation } from "./types.js";
export declare function createSourceSyntaxDomain(ast: Pick<AstReader, "getSourceFile">, owner: Node): (node: Node) => boolean;
export declare function createSourceNodeInventory(source: Pick<SourceNavigationInput, "ast" | "containsSourceFile">, sourceFiles: readonly SourceFile[]): Pick<SourceProgramNavigation, "nodes" | "nodesForFiles">;
//# sourceMappingURL=node-inventory.d.ts.map