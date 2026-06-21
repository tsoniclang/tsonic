import type {
  ArgumentPassingFact,
  ArgumentPassingMode,
  SelectedTargetSignatureFact,
  TargetConstraint,
  TargetOperationFact,
  TargetTypeRef,
} from "./facts.js";
import type { ExtensionDiagnostic, ExtensionDiagnosticStore, ExtensionEvidence, ExtensionFactResolver, ExtensionFactStore, ExtensionFactSubject, ExtensionHost } from "./host.js";
import type { AstReader } from "../services/ast-reader.js";
import type { TypeCheckerQueries } from "../services/type-checker.js";
import type { TypeShapeQueries } from "../services/type-shape.js";
import type { SourceFile } from "../internal/ast/ast.js";

export type ExtensionObservation<T> =
  | { readonly kind: "defer" }
  | { readonly kind: "accept"; readonly value: T; readonly evidence?: readonly ExtensionEvidence[] }
  | { readonly kind: "reject"; readonly diagnostic: ExtensionDiagnostic };

export type ExtensionObservationResult<T> =
  | { readonly kind: "core"; readonly value: T }
  | { readonly kind: "accept"; readonly value: T; readonly extensionId: string; readonly evidence?: readonly ExtensionEvidence[] }
  | { readonly kind: "reject"; readonly diagnostic: ExtensionDiagnostic; readonly extensionId: string }
  | { readonly kind: "missing-owner"; readonly observation: ExtensionObservationPointName }
  | { readonly kind: "owner-deferred"; readonly observation: ExtensionObservationPointName; readonly extensionId: string }
  | { readonly kind: "conflict"; readonly observation: ExtensionObservationPointName };

export interface ExtensionObservationContext<TObservation extends ExtensionObservationPointName = ExtensionObservationPointName> {
  readonly observation: TObservation;
  readonly extensionId: string;
  readonly host: ExtensionHost;
  readonly facts: ExtensionFactStore;
  readonly factResolver: ExtensionFactResolver;
  readonly diagnostics: ExtensionDiagnosticStore;
  readonly compiler?: ExtensionCompilerQueries;
}

export interface ExtensionCompilerQueries {
  readonly ast: AstReader;
  readonly checker: TypeCheckerQueries;
  readonly types: TypeShapeQueries;
  readonly getSourceFiles: () => readonly SourceFile[];
}

export const ExtensionObservationPoint = {
  validateTargetConstraint: "target.validateConstraint",
  validatePostCheckAssignability: "target.validatePostCheckAssignability",
  mapCheckedCall: "operation.mapCheckedCall",
  mapInferredSourceTypeArgumentsToTarget: "operation.mapInferredSourceTypeArgumentsToTarget",
  mapCheckedPropertyAccess: "operation.mapCheckedPropertyAccess",
  mapCheckedElementAccess: "operation.mapCheckedElementAccess",
  mapCheckedOperator: "operation.mapCheckedOperator",
  mapCheckedIteration: "operation.mapCheckedIteration",
  recordContextualTargetType: "type.recordContextualTargetType",
  mapCheckedConversion: "operation.mapCheckedConversion",
  resolveParameterPassing: "parameter.resolvePassing",
  resolveRuntimeCarrier: "type.resolveRuntimeCarrier",
  validateExtensionFlowUse: "flow.validateExtensionUse",
} as const;

export type ExtensionObservationPointName = typeof ExtensionObservationPoint[keyof typeof ExtensionObservationPoint];

export interface ExtensionObservationRunOptions {
  readonly requireOwner?: boolean;
}

export interface TargetConstraintValidationRequest {
  readonly source: ExtensionFactSubject;
  readonly constraint: TargetConstraint;
  readonly target?: string;
}

export interface PostCheckAssignabilityValidationRequest {
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
  readonly calleeSymbol?: ExtensionFactSubject;
  readonly calleeResolvedSymbol?: ExtensionFactSubject;
  readonly calleeAliasedSymbol?: ExtensionFactSubject;
  readonly calleeReceiver?: ExtensionFactSubject;
  readonly calleeReceiverType?: ExtensionFactSubject;
  readonly calleeReceiverTypeSymbol?: ExtensionFactSubject;
  readonly calleeReceiverSymbol?: ExtensionFactSubject;
  readonly calleeReceiverResolvedSymbol?: ExtensionFactSubject;
  readonly calleeReceiverAliasedSymbol?: ExtensionFactSubject;
  readonly calleePropertyName?: string;
  readonly arguments: readonly ExtensionFactSubject[];
  readonly sourceSelectedSignature?: ExtensionFactSubject;
  readonly sourceSelectedDeclaration?: ExtensionFactSubject;
  readonly sourceSelectedDeclarationContainer?: ExtensionFactSubject;
  readonly sourceSelectedContainerSymbol?: ExtensionFactSubject;
  readonly sourceReturnType?: ExtensionFactSubject;
  readonly target?: string;
}

export interface CheckedCallMappingResult {
  readonly selectedSignature: SelectedTargetSignatureFact;
  readonly returnType?: ExtensionFactSubject;
}

export interface TargetTypeArgumentMappingRequest {
  readonly declaration: ExtensionFactSubject;
  readonly arguments: readonly ExtensionFactSubject[];
  readonly sourceSelectedSignature?: ExtensionFactSubject;
  readonly contextualType?: ExtensionFactSubject;
}

export interface TargetTypeArgumentMappingResult {
  readonly targetTypeArguments: readonly TargetTypeRef[];
}

export interface CheckedPropertyAccessMappingRequest {
  readonly expression: ExtensionFactSubject;
  readonly receiver: ExtensionFactSubject;
  readonly receiverType?: ExtensionFactSubject;
  readonly receiverTypeSymbol?: ExtensionFactSubject;
  readonly receiverSymbol?: ExtensionFactSubject;
  readonly receiverResolvedSymbol?: ExtensionFactSubject;
  readonly receiverAliasedSymbol?: ExtensionFactSubject;
  readonly sourceSelectedDeclaration?: ExtensionFactSubject;
  readonly sourceSelectedDeclarationContainer?: ExtensionFactSubject;
  readonly sourceSelectedContainerSymbol?: ExtensionFactSubject;
  readonly propertyName: string;
  readonly target?: string;
}

export interface CheckedElementAccessMappingRequest {
  readonly expression: ExtensionFactSubject;
  readonly receiver: ExtensionFactSubject;
  readonly receiverType?: ExtensionFactSubject;
  readonly receiverTypeSymbol?: ExtensionFactSubject;
  readonly argument: ExtensionFactSubject;
  readonly target?: string;
}

export interface CheckedOperatorMappingRequest {
  readonly expression: ExtensionFactSubject;
  readonly operator: string;
  readonly left: ExtensionFactSubject;
  readonly leftType?: ExtensionFactSubject;
  readonly leftSymbol?: ExtensionFactSubject;
  readonly leftResolvedSymbol?: ExtensionFactSubject;
  readonly leftAliasedSymbol?: ExtensionFactSubject;
  readonly right?: ExtensionFactSubject;
  readonly rightType?: ExtensionFactSubject;
  readonly rightSymbol?: ExtensionFactSubject;
  readonly rightResolvedSymbol?: ExtensionFactSubject;
  readonly rightAliasedSymbol?: ExtensionFactSubject;
  readonly target?: string;
}

export type CheckedIterationKind = "for-in" | "for-of" | "for-await-of";

export interface CheckedIterationMappingRequest {
  readonly statement: ExtensionFactSubject;
  readonly expression: ExtensionFactSubject;
  readonly sourceExpressionType?: ExtensionFactSubject;
  readonly initializer?: ExtensionFactSubject;
  readonly kind: CheckedIterationKind;
  readonly sourceElementType?: ExtensionFactSubject;
  readonly target?: string;
}

export interface CheckedOperationMappingResult {
  readonly operation: TargetOperationFact;
  readonly resultType?: ExtensionFactSubject;
}

export interface CheckedConversionMappingRequest {
  readonly expression: ExtensionFactSubject;
  readonly source: ExtensionFactSubject;
  readonly target: ExtensionFactSubject;
  readonly targetPlatform?: string;
}

export interface CheckedConversionMappingResult {
  readonly convertedType?: TargetTypeRef;
  readonly operation?: TargetOperationFact;
}

export interface ParameterPassingRequest {
  readonly parameter: ExtensionFactSubject;
  readonly argument?: ExtensionFactSubject;
  readonly target?: string;
}

export interface ParameterPassingResult {
  readonly passing: ArgumentPassingFact;
}

export interface RuntimeCarrierFactRequest {
  readonly type: ExtensionFactSubject;
  readonly sourceTypeReference?: ExtensionFactSubject;
  readonly sourceTypeSymbol?: ExtensionFactSubject;
  readonly target?: string;
}

export interface RuntimeCarrierFactResult {
  readonly carrier: TargetTypeRef;
  readonly requiresAllocation?: boolean;
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
  readonly [ExtensionObservationPoint.validatePostCheckAssignability]: {
    readonly request: PostCheckAssignabilityValidationRequest;
    readonly result: boolean;
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
export type ExtensionObservationHook<TObservation extends ExtensionObservationPointName> = (
  request: ExtensionObservationRequest<TObservation>,
  context: ExtensionObservationContext<TObservation>,
) => ExtensionObservation<ExtensionObservationResponse<TObservation>>;

export const deferObservation: ExtensionObservation<never> = Object.freeze({ kind: "defer" });

export function acceptObservation<T>(value: T, evidence?: readonly ExtensionEvidence[]): ExtensionObservation<T> {
  return evidence === undefined ? { kind: "accept", value } : { kind: "accept", value, evidence };
}

export function rejectObservation<T>(diagnostic: ExtensionDiagnostic): ExtensionObservation<T> {
  return { kind: "reject", diagnostic };
}
