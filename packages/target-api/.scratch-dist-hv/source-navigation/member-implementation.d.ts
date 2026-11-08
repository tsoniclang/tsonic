import type { Node } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceHeritagePathResult, SourceProjectMemberImplementationResult, SourceProjectReference } from "./types.js";
export interface SourceMemberImplementationNavigation {
    memberImplementation(typeDeclaration: Node, contractMemberDeclaration: Node): SourceProjectMemberImplementationResult;
}
export declare function createSourceMemberImplementationNavigation(source: Pick<SourceNavigationInput, "ast" | "declaredMember">, referenceFor: (node: Node | undefined) => SourceProjectReference | undefined, isProjectDeclaration: (node: Node | undefined) => boolean, declaredHeritagePath: (sourceDeclaration: Node, targetDeclaration: Node) => SourceHeritagePathResult): SourceMemberImplementationNavigation;
//# sourceMappingURL=member-implementation.d.ts.map