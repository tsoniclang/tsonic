import type { ArgumentPassingFact, ArgumentPassingMode, RuntimeCarrierProvenance, SelectedTargetSignatureFact, SourceSelectedMethodTypeArgument, TargetConstraint, TargetOperationProvenance, TargetOperationFact, TargetParameter, TargetTypeRef } from "./facts.js";
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
export interface ExtensionObservationContext<TObservation extends ExtensionObservationPointName = ExtensionObservationPointName> {
    readonly observation: TObservation;
    readonly extensionId: string;
    readonly compiler: ExtensionCompilerQueryContext;
    readonly host: ExtensionHost;
    readonly facts: ExtensionFactStore;
    readonly factResolver: ExtensionFactResolver;
    readonly diagnostics: ExtensionDiagnosticStore;
}
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
    readonly mapInferredSourceTypeArgumentsToTarget: "operation.mapInferredSourceTypeArgumentsToTarget";
    readonly mapCheckedPropertyAccess: "operation.mapCheckedPropertyAccess";
    readonly mapCheckedElementAccess: "operation.mapCheckedElementAccess";
    readonly mapCheckedOperator: "operation.mapCheckedOperator";
    readonly mapCheckedIteration: "operation.mapCheckedIteration";
    readonly recordContextualTargetType: "type.recordContextualTargetType";
    readonly mapCheckedConversion: "operation.mapCheckedConversion";
    readonly resolveParameterPassing: "parameter.resolvePassing";
    readonly resolveRuntimeCarrier: "type.resolveRuntimeCarrier";
    readonly validateExtensionFlowUse: "flow.validateExtensionUse";
};
export type ExtensionObservationPointName = typeof ExtensionObservationPoint[keyof typeof ExtensionObservationPoint];
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
export interface CheckedCallMappingRequest {
    readonly call: ExtensionFactSubject;
    readonly callee: ExtensionFactSubject;
    readonly arguments: readonly ExtensionFactSubject[];
    readonly sourceSelectedSignature?: ExtensionFactSubject;
    readonly sourceSelectedDeclaration?: ExtensionFactSubject;
    readonly sourceSelectedMethodTypeArguments?: readonly SourceSelectedMethodTypeArgument[];
    readonly sourceCalleeSymbol?: ExtensionFactSubject;
    readonly sourceCalleeDeclaration?: ExtensionFactSubject;
    readonly sourceReturnType?: ExtensionFactSubject;
    readonly target?: string;
}
export interface CheckedCallMappingResult {
    readonly selectedSignature: SelectedTargetSignatureFact;
    readonly returnType?: ExtensionFactSubject;
}
export interface TargetTypeArgumentMappingRequest {
    readonly call?: ExtensionFactSubject;
    readonly declaration: ExtensionFactSubject;
    readonly arguments: readonly ExtensionFactSubject[];
    readonly sourceSelectedSignature?: ExtensionFactSubject;
    readonly sourceSelectedDeclaration?: ExtensionFactSubject;
    readonly sourceSelectedMethodTypeArguments?: readonly SourceSelectedMethodTypeArgument[];
    readonly sourceCalleeSymbol?: ExtensionFactSubject;
    readonly sourceCalleeDeclaration?: ExtensionFactSubject;
    readonly sourceReturnType?: ExtensionFactSubject;
    readonly contextualType?: ExtensionFactSubject;
    readonly target?: string;
}
export interface TargetTypeArgumentMappingResult {
    readonly targetTypeArguments: readonly TargetTypeRef[];
}
export interface CheckedPropertyAccessMappingRequest {
    readonly expression: ExtensionFactSubject;
    readonly receiver: ExtensionFactSubject;
    readonly propertyName: string;
    readonly sourceSelectedSymbol?: ExtensionFactSubject;
    readonly sourceSelectedDeclaration?: ExtensionFactSubject;
    readonly sourceResultType?: ExtensionFactSubject;
    readonly optionalChain?: boolean;
    readonly target?: string;
}
export interface CheckedElementAccessMappingRequest {
    readonly expression: ExtensionFactSubject;
    readonly receiver: ExtensionFactSubject;
    readonly argument: ExtensionFactSubject;
    readonly sourceSelectedSymbol?: ExtensionFactSubject;
    readonly sourceSelectedDeclaration?: ExtensionFactSubject;
    readonly sourceResultType?: ExtensionFactSubject;
    readonly optionalChain?: boolean;
    readonly target?: string;
}
export interface CheckedOperatorMappingRequest {
    readonly expression: ExtensionFactSubject;
    readonly operator: string;
    readonly left: ExtensionFactSubject;
    readonly right?: ExtensionFactSubject;
    readonly target?: string;
}
export type CheckedIterationKind = "for-in" | "for-of" | "for-await-of";
export interface CheckedIterationMappingRequest {
    readonly statement: ExtensionFactSubject;
    readonly expression: ExtensionFactSubject;
    readonly initializer?: ExtensionFactSubject;
    readonly kind: CheckedIterationKind;
    readonly sourceElementType?: ExtensionFactSubject;
    readonly target?: string;
}
export interface CheckedOperationMappingResult {
    readonly operation: TargetOperationFact;
    readonly resultType?: ExtensionFactSubject;
    readonly provenance?: TargetOperationProvenance;
}
export interface CheckedConversionMappingRequest {
    readonly expression: ExtensionFactSubject;
    readonly source: ExtensionFactSubject;
    readonly target: ExtensionFactSubject;
    readonly call?: ExtensionFactSubject;
    readonly parameterIndex?: number;
    readonly targetParameter?: TargetParameter;
    readonly sourceSelectedSignature?: ExtensionFactSubject;
    readonly selectedSignature?: SelectedTargetSignatureFact;
    readonly targetPlatform?: string;
}
export interface CheckedConversionMappingResult {
    readonly convertedType?: TargetTypeRef;
    readonly operation?: TargetOperationFact;
}
export interface ParameterPassingRequest {
    readonly parameter: ExtensionFactSubject;
    readonly argument?: ExtensionFactSubject;
    readonly parameterIndex?: number;
    readonly targetParameter?: TargetParameter;
    readonly call?: ExtensionFactSubject;
    readonly sourceSelectedSignature?: ExtensionFactSubject;
    readonly selectedSignature?: SelectedTargetSignatureFact;
    readonly target?: string;
}
export interface ParameterPassingResult {
    readonly passing: ArgumentPassingFact;
}
export interface RuntimeCarrierFactRequest {
    readonly type: ExtensionFactSubject;
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
export interface ExtensionFlowUseValidationRequest {
    readonly useSite: ExtensionFactSubject;
    readonly symbol: ExtensionFactSubject;
    readonly mode?: ArgumentPassingMode | "read" | "write" | "call";
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
    readonly [ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget]: {
        readonly request: TargetTypeArgumentMappingRequest;
        readonly result: TargetTypeArgumentMappingResult;
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
    readonly [ExtensionObservationPoint.resolveParameterPassing]: {
        readonly request: ParameterPassingRequest;
        readonly result: ParameterPassingResult;
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
//# sourceMappingURL=observations.d.ts.map