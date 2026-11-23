import type { Diagnostic } from "../internal/ast/diagnostic.js";
export declare function createCheckerDiagnosticPublication(): {
    admits: (diagnostic: Diagnostic) => boolean;
    publish(roots: readonly (Diagnostic | undefined)[]): readonly (Diagnostic | undefined)[];
};
export declare function getDiagnosticRunMembers(diagnostic: Diagnostic): readonly Diagnostic[];
//# sourceMappingURL=diagnostic-run-members.d.ts.map