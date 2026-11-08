import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse, SourceDeclarationUseSummary, SourceParameterUseSummary } from "./types.js";
export declare function sourceDeclarationHasOnlyTypeUses(summary: SourceDeclarationUseSummary): boolean;
export declare function sourceDeclarationUseSummary(ast: AstReader, declaration: Node, uses: readonly SourceDeclarationUse[]): SourceDeclarationUseSummary;
export declare function sourceParameterUseSummary(ast: AstReader, parameter: Node, uses: readonly SourceDeclarationUse[]): SourceParameterUseSummary | undefined;
//# sourceMappingURL=declaration-use-summary.d.ts.map