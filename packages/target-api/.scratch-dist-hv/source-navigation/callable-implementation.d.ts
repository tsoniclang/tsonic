import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceCallableImplementationResult } from "./types.js";
export interface SourceCallableImplementationNavigation {
    callableImplementation(contractDeclaration: Node): SourceCallableImplementationResult;
}
export declare function createSourceCallableImplementationNavigation(source: Pick<SourceNavigationInput, "ast" | "mergedDeclarations">, isProjectDeclaration: (node: Node | undefined) => boolean): SourceCallableImplementationNavigation;
/** The one implementation (declaration with a body, same callable category) among the merged declarations. */
export declare function selectCallableImplementationDeclaration(ast: AstReader, contractDeclaration: Node, mergedDeclarations: readonly Node[]): Node | undefined;
//# sourceMappingURL=callable-implementation.d.ts.map