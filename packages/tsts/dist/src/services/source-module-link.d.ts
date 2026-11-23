import type { Node } from "../internal/ast/ast.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { CheckerDiagnosticMembership } from "../internal/checker/checker/source-type-answers.js";
export interface ResolvedSourceModuleLink {
    readonly resolution: {
        readonly kind: "resolved";
        readonly module: Symbol;
    } | {
        readonly kind: "unresolved";
        readonly cause: Diagnostic | undefined;
    };
    readonly evaluation: "eager" | "erased" | "deferred";
}
export declare function sourceModuleLink(checker: Checker, specifier: Node, admitsCheckerDiagnostic: CheckerDiagnosticMembership | undefined): ResolvedSourceModuleLink | undefined;
//# sourceMappingURL=source-module-link.d.ts.map