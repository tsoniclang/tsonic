import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationUse, SourceProgramNavigation } from "./types.js";
import { type SourceLexicalCaptureSelection, type SourceNodeDomain } from "./lexical-captures.js";
export interface SourceLexicalEnvironment extends SourceLexicalCaptureSelection {
    readonly kind: "resolved";
    readonly callableRoots: readonly Node[];
}
export declare function sourceLexicalEnvironment(scope: Node, roots: readonly Node[], ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary">, domain: SourceNodeDomain, isRuntimeUse?: (use: SourceDeclarationUse, declaration: Node) => boolean, visit?: (node?: Node) => void): SourceLexicalEnvironment | {
    readonly kind: "unresolved";
    readonly reason: string;
};
//# sourceMappingURL=lexical-environments.d.ts.map