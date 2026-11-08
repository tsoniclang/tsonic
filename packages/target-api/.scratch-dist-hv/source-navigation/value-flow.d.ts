import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationReference, SourceDeclarationUse, SourceDeclarationUseSummary, SourceExpressionValueFlowSummary } from "./types.js";
export declare function sourceExpressionValueFlow(ast: AstReader, expression: Node, sourceReferenceFor: (node: Node | undefined) => SourceDeclarationReference | undefined, declarationUses: (declaration: Node) => readonly SourceDeclarationUse[], declarationUseSummary: (declaration: Node) => SourceDeclarationUseSummary): SourceExpressionValueFlowSummary;
//# sourceMappingURL=value-flow.d.ts.map