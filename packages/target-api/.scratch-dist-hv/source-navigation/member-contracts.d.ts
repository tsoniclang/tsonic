import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclaredHeritageResult, SourceProjectMemberContractsResult, SourceProjectMemberImplementationResult } from "./types.js";
export interface SourceMemberContractNavigation {
    memberContracts(implementationDeclaration: Node): SourceProjectMemberContractsResult;
}
export declare function createSourceMemberContractNavigation(ast: AstReader, isProjectDeclaration: (node: Node | undefined) => boolean, declaredHeritage: (declaration: Node) => SourceDeclaredHeritageResult, memberImplementation: (typeDeclaration: Node, contractMemberDeclaration: Node) => SourceProjectMemberImplementationResult): SourceMemberContractNavigation;
//# sourceMappingURL=member-contracts.d.ts.map