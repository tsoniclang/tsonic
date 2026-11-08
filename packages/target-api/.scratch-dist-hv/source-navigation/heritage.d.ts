import type { Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceDeclaredHeritageResult, SourceHeritagePathResult } from "./types.js";
export interface SourceHeritageNavigation {
    declaredHeritage(declaration: Node): SourceDeclaredHeritageResult;
    declaredHeritagePath(sourceDeclaration: Node, targetDeclaration: Node): SourceHeritagePathResult;
}
/**
 * Declared heritage: each clause element, the declaration it names (host-input heritage target) and its authored type
 * argument nodes. Type arguments are syntax; their Source meaning is the Host value model's (object facts).
 */
export declare function createSourceHeritageNavigation(source: Pick<SourceNavigationInput, "ast" | "heritageTarget">, isProjectDeclaration: (node: Node | undefined) => boolean): SourceHeritageNavigation;
//# sourceMappingURL=heritage.d.ts.map