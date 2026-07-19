import type { CheckedAssertionConversionSourceOperation, CheckedCallSourceOperation, CheckedCallArgumentConversionSourceOperation, CheckedElementAccessSourceOperation, CheckedIterationSourceOperation, CheckedOperatorSourceOperation, CheckedPropertyAccessSourceOperation, ProviderDeclarationIdentity, RuntimeCarrierProvenance, SelectedTargetSignatureFact, TargetSignatureSelection, TargetConstraint, TargetOperationProposal, TargetParameter, TargetCallArgumentConversionSlot, TargetTypeRef } from "./facts.js";
import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { AstReader } from "../services/ast-reader.js";
import type { TypeCheckerQueries } from "../services/type-checker.js";
import type { TypeShapeQueries } from "../services/type-shape.js";
import type { ExtensionDiagnostic, ExtensionDiagnosticStore, ExtensionEvidence, ExtensionFactResolver, ExtensionFactStore, ExtensionFactSubject, ExtensionHost } from "./host.js";
export type ExtensionObservation<T> = {
    readonly kind: "defer";
} | {
    readonly kind: "accept";
    readonly value: T;
    readonly evidence?: readonly ExtensionEvidence[];
} | {
    readonly kind: "reject";
    readonly diagnostic: ExtensionDiagnostic;
};
export type ExtensionObservationResult<T> = {
    readonly kind: "core";
    readonly value: T;
} | {
    readonly kind: "accept";
    readonly value: T;
    readonly extensionId: string;
    readonly evidence?: readonly ExtensionEvidence[];
} | {
    readonly kind: "reject";
    readonly diagnostic: ExtensionDiagnostic;
    readonly extensionId: string;
} | {
    readonly kind: "missing-owner";
    readonly observation: ExtensionObservationPointName;
} | {
    readonly kind: "owner-deferred";
    readonly observation: ExtensionObservationPointName;
    readonly extensionId: string;
} | {
    readonly kind: "conflict";
    readonly observation: ExtensionObservationPointName;
};
interface ExtensionObservationContextBase<TObservation extends ExtensionObservationPointName> {
    readonly observation: TObservation;
    readonly phase: ExtensionObservationPhase;
    readonly extensionId: string;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly diagnostics: ExtensionDiagnosticStore;
}
export interface ImmediateExtensionObservationContext<TObservation extends ImmediateExtensionObservationPointName = ImmediateExtensionObservationPointName> extends ExtensionObservationContextBase<TObservation> {
    readonly compiler: ExtensionCompilerQueryContext;
    readonly host: ExtensionHost;
}
export interface CheckedOperationObservationContext<TObservation extends CheckedOperationObservationPointName = CheckedOperationObservationPointName> extends ExtensionObservationContextBase<TObservation> {
    readonly compiler?: never;
    readonly host?: never;
}
export type ExtensionObservationContext<TObservation extends ExtensionObservationPointName = ExtensionObservationPointName> = TObservation extends CheckedOperationObservationPointName ? CheckedOperationObservationContext<TObservation> : TObservation extends ImmediateExtensionObservationPointName ? ImmediateExtensionObservationContext<TObservation> : never;
export interface ExtensionCompilerQueryContext {
    readonly program: object;
    readonly ast: AstReader;
    readonly checker: TypeCheckerQueries;
    readonly typeShape: TypeShapeQueries;
    readonly getSourceFiles: () => readonly GoPtr<SourceFile>[];
    readonly getSourceFile: (fileName: string) => GoPtr<SourceFile>;
}
export declare const ExtensionObservationPoint: {
    readonly validateTargetConstraint: "target.validateConstraint";
    readonly observePostCheckAssignability: "target.observePostCheckAssignability";
    readonly mapCheckedCall: "operation.mapCheckedCall";
    readonly mapCheckedPropertyAccess: "operation.mapCheckedPropertyAccess";
    readonly mapCheckedElementAccess: "operation.mapCheckedElementAccess";
    readonly mapCheckedOperator: "operation.mapCheckedOperator";
    readonly mapCheckedIteration: "operation.mapCheckedIteration";
    readonly recordContextualTargetType: "type.recordContextualTargetType";
    readonly mapCheckedConversion: "operation.mapCheckedConversion";
    readonly resolveRuntimeCarrier: "type.resolveRuntimeCarrier";
    readonly validateExtensionFlowUse: "flow.validateExtensionUse";
};
export type ExtensionObservationPointName = typeof ExtensionObservationPoint[keyof typeof ExtensionObservationPoint];
export type ExtensionObservationPhase = "checking" | "finalization";
export type CheckedOperationObservationPointName = typeof ExtensionObservationPoint.mapCheckedCall | typeof ExtensionObservationPoint.mapCheckedPropertyAccess | typeof ExtensionObservationPoint.mapCheckedElementAccess | typeof ExtensionObservationPoint.mapCheckedOperator | typeof ExtensionObservationPoint.mapCheckedIteration | typeof ExtensionObservationPoint.mapCheckedConversion;
export type ImmediateExtensionObservationPointName = Exclude<ExtensionObservationPointName, CheckedOperationObservationPointName>;
export type CheckedOperationReference<TObservation extends CheckedOperationObservationPointName = CheckedOperationObservationPointName> = TObservation extends typeof ExtensionObservationPoint.mapCheckedConversion ? {
    readonly observation: TObservation;
    readonly subject: ExtensionFactSubject;
    readonly conversionKind: "assertion";
    readonly call?: never;
    readonly slot?: never;
} | {
    readonly observation: TObservation;
    readonly subject: ExtensionFactSubject;
    readonly conversionKind: "call-argument";
    readonly call: ExtensionFactSubject;
    readonly slot: TargetCallArgumentConversionSlot;
} : {
    readonly observation: TObservation;
    readonly subject: ExtensionFactSubject;
    readonly conversionKind?: never;
    readonly call?: never;
    readonly slot?: never;
};
export interface ExtensionObservationRunOptions {
    readonly requireOwner?: boolean;
}
export interface TargetConstraintValidationRequest {
    readonly source: ExtensionFactSubject;
    readonly constraint: TargetConstraint;
    readonly target?: string;
}
export interface PostCheckAssignabilityObservationRequest {
    readonly source: ExtensionFactSubject;
    readonly target: ExtensionFactSubject;
    readonly relation?: "assignment" | "constraint" | "return" | "argument";
    readonly errorNode?: ExtensionFactSubject;
    readonly expression?: ExtensionFactSubject;
    readonly targetPlatform?: string;
}
export type CheckedCallMappingRequest = CheckedCallSourceOperation & {
    readonly target?: string;
};
export type CheckedCallMappingResult = {
    readonly kind: "source";
} | {
    readonly kind: "target";
    readonly selectedSignature: TargetSignatureSelection;
    readonly argumentConversions: readonly TargetCallArgumentConversionSlot[];
};
export type CheckedPropertyAccessMappingRequest = CheckedPropertyAccessSourceOperation & {
    readonly target?: string;
};
export type CheckedElementAccessMappingRequest = CheckedElementAccessSourceOperation & {
    readonly target?: string;
};
export type CheckedOperatorMappingRequest = CheckedOperatorSourceOperation & {
    readonly target?: string;
};
export type CheckedIterationMappingRequest = CheckedIterationSourceOperation & {
    readonly target?: string;
};
export interface CheckedOperationMappingResult {
    readonly operation: TargetOperationProposal;
    readonly resultType?: TargetTypeRef;
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export type CheckedConversionMappingRequest = CheckedCallArgumentConversionSourceOperation & {
    readonly targetPlatform?: string;
    readonly target: TargetTypeRef;
    readonly targetParameter: TargetParameter;
    readonly selectedSignature: SelectedTargetSignatureFact;
} | CheckedAssertionConversionSourceOperation & {
    readonly targetPlatform?: string;
    readonly targetParameter?: never;
    readonly selectedSignature?: never;
};
export interface CheckedConversionMappingResult {
    readonly convertedType?: TargetTypeRef;
    readonly operation?: TargetOperationProposal;
    readonly providerDeclaration?: ProviderDeclarationIdentity;
}
export interface RuntimeCarrierFactRequest {
    readonly type: ExtensionFactSubject;
    readonly sourceTypeReference?: ExtensionFactSubject;
    readonly sourceSymbol?: ExtensionFactSubject;
    readonly target?: string;
}
export interface RuntimeCarrierFactResult {
    readonly carrier: TargetTypeRef;
    readonly requiresAllocation?: boolean;
    readonly provenance?: RuntimeCarrierProvenance;
}
export interface ContextualTargetTypeRequest {
    readonly expression: ExtensionFactSubject;
    readonly context: ExtensionFactSubject;
    readonly target?: string;
}
export interface ContextualTargetTypeResult {
    readonly type: ExtensionFactSubject;
    readonly targetType?: TargetTypeRef;
}
export type CheckedFlowSourceUse = {
    readonly kind: "ordinary";
    readonly access: "read" | "write" | "read-write";
} | {
    readonly kind: "call";
    readonly access?: never;
} | {
    readonly kind: "construct";
    readonly access?: never;
} | {
    readonly kind: "tagged-template";
    readonly access?: never;
} | {
    readonly kind: "decorator";
    readonly access?: never;
} | {
    readonly kind: "jsx-element";
    readonly access?: never;
};
export interface ExtensionFlowUseValidationRequest {
    readonly useSite: ExtensionFactSubject;
    readonly symbol: ExtensionFactSubject;
    readonly sourceUse: CheckedFlowSourceUse;
    readonly target?: string;
}
export interface ExtensionFlowUseValidationResult {
    readonly valid: boolean;
    readonly targetCompilerValidationRequired?: boolean;
    readonly targetCompiler?: string;
}
export interface ExtensionObservationMap {
    readonly [ExtensionObservationPoint.validateTargetConstraint]: {
        readonly request: TargetConstraintValidationRequest;
        readonly result: boolean;
    };
    readonly [ExtensionObservationPoint.observePostCheckAssignability]: {
        readonly request: PostCheckAssignabilityObservationRequest;
        readonly result: void;
    };
    readonly [ExtensionObservationPoint.mapCheckedCall]: {
        readonly request: CheckedCallMappingRequest;
        readonly result: CheckedCallMappingResult;
    };
    readonly [ExtensionObservationPoint.mapCheckedPropertyAccess]: {
        readonly request: CheckedPropertyAccessMappingRequest;
        readonly result: CheckedOperationMappingResult;
    };
    readonly [ExtensionObservationPoint.mapCheckedElementAccess]: {
        readonly request: CheckedElementAccessMappingRequest;
        readonly result: CheckedOperationMappingResult;
    };
    readonly [ExtensionObservationPoint.mapCheckedOperator]: {
        readonly request: CheckedOperatorMappingRequest;
        readonly result: CheckedOperationMappingResult;
    };
    readonly [ExtensionObservationPoint.mapCheckedIteration]: {
        readonly request: CheckedIterationMappingRequest;
        readonly result: CheckedOperationMappingResult;
    };
    readonly [ExtensionObservationPoint.recordContextualTargetType]: {
        readonly request: ContextualTargetTypeRequest;
        readonly result: ContextualTargetTypeResult;
    };
    readonly [ExtensionObservationPoint.mapCheckedConversion]: {
        readonly request: CheckedConversionMappingRequest;
        readonly result: CheckedConversionMappingResult;
    };
    readonly [ExtensionObservationPoint.resolveRuntimeCarrier]: {
        readonly request: RuntimeCarrierFactRequest;
        readonly result: RuntimeCarrierFactResult;
    };
    readonly [ExtensionObservationPoint.validateExtensionFlowUse]: {
        readonly request: ExtensionFlowUseValidationRequest;
        readonly result: ExtensionFlowUseValidationResult;
    };
}
export type ExtensionObservationRequest<TObservation extends ExtensionObservationPointName> = ExtensionObservationMap[TObservation]["request"];
export type ExtensionObservationResponse<TObservation extends ExtensionObservationPointName> = ExtensionObservationMap[TObservation]["result"];
export type ExtensionObservationHook<TObservation extends ExtensionObservationPointName> = (request: ExtensionObservationRequest<TObservation>, context: ExtensionObservationContext<TObservation>) => ExtensionObservation<ExtensionObservationResponse<TObservation>>;
export declare const deferObservation: ExtensionObservation<never>;
export declare function acceptObservation<T>(value: T, evidence?: readonly ExtensionEvidence[]): ExtensionObservation<T>;
export declare function rejectObservation<T>(diagnostic: ExtensionDiagnostic): ExtensionObservation<T>;
export {};
//# sourceMappingURL=observations.d.ts.map