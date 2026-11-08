import type { Diagnostic } from "../ast/diagnostic.js";
import type { Node } from "../ast/spine.js";
import type { ResolvedCallCalleeAccessEvidence, ResolvedCallInferenceEvidence, ResolvedCallInferencePathPart, ResolvedCallSelectedSignatureParameterEvidence, ResolvedCallSourceValueEvidence, Signature, Type } from "./types.js";
export interface ResolvedCallTypeArgumentEvidence {
    readonly typeParameter: Type;
    readonly declaration: Node | undefined;
    readonly checkedArgument: Type | undefined;
    readonly explicitTypeNode: Node | undefined;
    readonly defaultTypeNode: Node | undefined;
}
export interface ResolvedOriginalSignatureEvidence {
    readonly constructorClass: Node | undefined;
    readonly composite: {
        readonly isUnion: boolean;
        readonly signatures: readonly Signature[];
    } | undefined;
    readonly declaration: Node | undefined;
    readonly target: Signature | undefined;
    readonly parameters: readonly {
        readonly index: number;
        readonly declaration: Node | undefined;
        readonly rest: boolean;
        readonly optional: boolean;
    }[];
    readonly receiver: {
        readonly declaration: Node | undefined;
    } | undefined;
}
export interface ResolvedCallApplicationEvidence {
    readonly invocation: Node;
    readonly kind: "call" | "construct";
    readonly signature: Signature;
    readonly instantiatedSignature: Signature | undefined;
    readonly signatureShape: ResolvedOriginalSignatureEvidence;
    readonly callee: ResolvedCallSourceValueEvidence;
    readonly receiver: ResolvedCallSourceValueEvidence | undefined;
    readonly class: {
        readonly owner: Type;
        readonly declaration: Node;
        readonly typeArguments: readonly ResolvedCallTypeArgumentEvidence[];
    } | undefined;
    readonly signatureTypeArguments: readonly ResolvedCallTypeArgumentEvidence[];
}
export interface ResolvedCheckedComponentEvidence {
    readonly root: {
        readonly kind: "value" | "annotation" | "declaration";
        readonly node: Node;
        readonly type: Type;
    } | {
        readonly kind: "call-argument" | "call-parameter";
        readonly node: Node;
        readonly index: number;
        readonly type: Type;
    } | {
        readonly kind: "arguments" | "parameters";
        readonly node: Node;
        readonly start: number;
        readonly type: Type;
    };
    readonly path: readonly ResolvedCallInferencePathPart[];
    readonly type: Type;
    readonly application: ResolvedCallApplicationEvidence | undefined;
}
export interface EffectiveCallArgumentOrigin {
    readonly sourceArgument: Node;
    readonly sourceArgumentIndex: number;
    readonly effectiveArgument: Node;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex?: number;
    readonly sourceArgumentType?: Type;
}
export interface ResolvedCallArgumentEvidence {
    readonly sourceArgument: Node;
    readonly sourceArgumentIndex: number;
    readonly effectiveArgument: Node;
    readonly effectiveArgumentIndex: number;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex: number | undefined;
    readonly parameterIndex: number;
    readonly parameterForm: "parameter" | "rest-element" | "rest-sequence";
    readonly selectedArgumentType: Type | undefined;
    readonly selectedParameterType: Type | undefined;
}
export interface ResolvedCheckerDiagnosticOwnership {
    readonly diagnostic: Diagnostic;
    readonly root: Diagnostic;
    readonly candidate: Signature | undefined;
    readonly rootCoverage: ResolvedCheckerDiagnosticCoverage;
}
export type ResolvedCheckerDiagnosticCoverage = {
    readonly kind: "complete";
    readonly root: Diagnostic;
    readonly obligations: readonly {
        readonly diagnostic: Diagnostic;
        readonly application: ResolvedCallApplicationEvidence | undefined;
        readonly kind: "applicability" | "backing";
    }[];
    readonly purpose: {
        readonly kind: "alternative-applicability";
        readonly invocation: Node;
        readonly notes: readonly Diagnostic[];
    } | {
        readonly kind: "other";
    };
} | {
    readonly kind: "unavailable";
    readonly root: Diagnostic;
};
export type ResolvedCheckerBackingConstraint = {
    readonly diagnostic: ResolvedCheckerDiagnosticOwnership;
    readonly site: Node;
    readonly application: ResolvedCallApplicationEvidence | undefined;
} & ({
    readonly kind: "operator";
    readonly operation: Node;
    readonly left: ResolvedCheckedComponentEvidence;
    readonly right: ResolvedCheckedComponentEvidence;
} | {
    readonly kind: "index";
    readonly access: Node;
    readonly receiver: ResolvedCheckedComponentEvidence;
    readonly index: ResolvedCheckedComponentEvidence;
} | {
    readonly kind: "write-fit";
    readonly source: ResolvedCheckedComponentEvidence;
    readonly destination: ResolvedCheckedComponentEvidence;
});
export type ResolvedCallArgumentMap = {
    readonly kind: "available";
    readonly values: readonly ResolvedCallArgumentEvidence[];
} | {
    readonly kind: "unavailable";
};
export interface ResolvedCheckedCallCandidateEvidence {
    readonly application: ResolvedCallApplicationEvidence;
    readonly sourceArguments: readonly Node[];
    readonly arguments: ResolvedCallArgumentMap;
    readonly inferenceContributions: ResolvedCallInferenceEvidence;
    readonly diagnosticCoverage: readonly ResolvedCheckerDiagnosticCoverage[];
    readonly constraints: readonly ResolvedCheckerBackingConstraint[];
    readonly diagnostics: readonly Diagnostic[];
    readonly callee: ResolvedCallSourceValueEvidence;
    readonly argumentValues: readonly ResolvedCallSourceValueEvidence[];
    readonly parameters?: readonly ResolvedCallSelectedSignatureParameterEvidence[];
    readonly calleeAccess: ResolvedCallCalleeAccessEvidence | undefined;
}
export type ResolvedCallSelectionEvidence = {
    readonly call: Node;
    readonly optionalChain: boolean;
    readonly declarationOrder: {
        readonly kind: "available";
        readonly signatures: readonly Signature[];
    } | {
        readonly kind: "unavailable";
    };
} & ({
    readonly kind: "applicable";
    readonly selection: ResolvedCheckedCallCandidateEvidence & {
        readonly application: ResolvedCallApplicationEvidence & {
            readonly instantiatedSignature: Signature;
        };
        readonly arguments: Extract<ResolvedCallArgumentMap, {
            readonly kind: "available";
        }>;
        readonly parameters: readonly ResolvedCallSelectedSignatureParameterEvidence[];
    };
} | {
    readonly kind: "conditional-candidates";
    readonly candidates: readonly ResolvedCheckedCallCandidateEvidence[];
    readonly diagnostics: readonly Diagnostic[];
} | {
    readonly kind: "untyped";
    readonly diagnostics: readonly Diagnostic[];
    readonly callee: ResolvedCallSourceValueEvidence;
    readonly argumentValues: readonly ResolvedCallSourceValueEvidence[];
    readonly calleeAccess: ResolvedCallCalleeAccessEvidence | undefined;
});
export type ResolvedCallEvidence = (Extract<ResolvedCallSelectionEvidence, {
    readonly kind: "applicable";
}> & {
    readonly resultType: Type;
}) | Exclude<ResolvedCallSelectionEvidence, {
    readonly kind: "applicable";
}>;
//# sourceMappingURL=selected-call-contracts.d.ts.map