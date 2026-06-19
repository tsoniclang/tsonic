import type {
  ArgumentPassingFact,
  ArgumentPassingMode,
  SelectedTargetSignatureFact,
  TargetConstraint,
  TargetTypeRef,
  TargetOperationFact,
} from "./facts.js";
import type { ExtensionDiagnostic, ExtensionDiagnosticStore, ExtensionEvidence, ExtensionFactResolver, ExtensionFactStore, ExtensionFactSubject, ExtensionHost } from "./host.js";

export type ExtensionDecision<T> =
  | { readonly kind: "defer" }
  | { readonly kind: "accept"; readonly value: T; readonly evidence?: readonly ExtensionEvidence[] }
  | { readonly kind: "reject"; readonly diagnostic: ExtensionDiagnostic };

export type ExtensionDecisionResult<T> =
  | { readonly kind: "core"; readonly value: T }
  | { readonly kind: "accept"; readonly value: T; readonly extensionId: string; readonly evidence?: readonly ExtensionEvidence[] }
  | { readonly kind: "reject"; readonly diagnostic: ExtensionDiagnostic; readonly extensionId: string }
  | { readonly kind: "missing-owner"; readonly question: ExtensionDecisionQuestionName }
  | { readonly kind: "owner-deferred"; readonly question: ExtensionDecisionQuestionName; readonly extensionId: string }
  | { readonly kind: "conflict"; readonly question: ExtensionDecisionQuestionName };

export interface ExtensionDecisionContext<TQuestion extends ExtensionDecisionQuestionName = ExtensionDecisionQuestionName> {
  readonly question: TQuestion;
  readonly extensionId: string;
  readonly host: ExtensionHost;
  readonly facts: ExtensionFactStore;
  readonly factResolver: ExtensionFactResolver;
  readonly diagnostics: ExtensionDiagnosticStore;
}

export const ExtensionDecisionQuestion = {
  satisfiesConstraint: "type.satisfiesConstraint",
  isAssignableTo: "type.isAssignableTo",
  resolveCall: "signature.resolveCall",
  inferTypeArguments: "signature.inferTypeArguments",
  resolvePropertyAccess: "member.resolvePropertyAccess",
  resolveElementAccess: "member.resolveElementAccess",
  resolveOperator: "member.resolveOperator",
  getContextualType: "type.getContextualType",
  resolveConversion: "type.resolveConversion",
  getParameterMode: "signature.getParameterMode",
  getRuntimeCarrier: "type.getRuntimeCarrier",
  validateFlowUse: "flow.validateUse",
} as const;

export type ExtensionDecisionQuestionName = typeof ExtensionDecisionQuestion[keyof typeof ExtensionDecisionQuestion];

export interface ExtensionDecisionRunOptions {
  readonly requireOwner?: boolean;
}

export interface SatisfiesConstraintRequest {
  readonly source: ExtensionFactSubject;
  readonly constraint: TargetConstraint;
  readonly target?: string;
}

export interface AssignabilityRequest {
  readonly source: ExtensionFactSubject;
  readonly target: ExtensionFactSubject;
  readonly relation?: "assignment" | "constraint" | "return" | "argument";
  readonly errorNode?: ExtensionFactSubject;
  readonly expression?: ExtensionFactSubject;
  readonly targetPlatform?: string;
}

export interface ResolveCallRequest {
  readonly call: ExtensionFactSubject;
  readonly callee: ExtensionFactSubject;
  readonly arguments: readonly ExtensionFactSubject[];
  readonly target?: string;
}

export interface ResolveCallResult {
  readonly selectedSignature: SelectedTargetSignatureFact;
  readonly returnType?: ExtensionFactSubject;
}

export interface InferTypeArgumentsRequest {
  readonly declaration: ExtensionFactSubject;
  readonly arguments: readonly ExtensionFactSubject[];
  readonly contextualType?: ExtensionFactSubject;
}

export interface InferTypeArgumentsResult {
  readonly typeArguments: readonly ExtensionFactSubject[];
  readonly targetTypeArguments?: readonly TargetTypeRef[];
}

export interface ResolvePropertyAccessRequest {
  readonly expression: ExtensionFactSubject;
  readonly receiver: ExtensionFactSubject;
  readonly propertyName: string;
  readonly target?: string;
}

export interface ResolveElementAccessRequest {
  readonly expression: ExtensionFactSubject;
  readonly receiver: ExtensionFactSubject;
  readonly argument: ExtensionFactSubject;
  readonly target?: string;
}

export interface ResolveOperatorRequest {
  readonly expression: ExtensionFactSubject;
  readonly operator: string;
  readonly left: ExtensionFactSubject;
  readonly right?: ExtensionFactSubject;
  readonly target?: string;
}

export interface ResolveOperationResult {
  readonly operation: TargetOperationFact;
  readonly resultType?: ExtensionFactSubject;
}

export interface ResolveConversionRequest {
  readonly expression: ExtensionFactSubject;
  readonly source: ExtensionFactSubject;
  readonly target: ExtensionFactSubject;
  readonly targetPlatform?: string;
}

export interface ResolveConversionResult {
  readonly convertedType?: TargetTypeRef;
  readonly operation?: TargetOperationFact;
}

export interface ParameterModeRequest {
  readonly parameter: ExtensionFactSubject;
  readonly argument?: ExtensionFactSubject;
  readonly target?: string;
}

export interface ParameterModeResult {
  readonly passing: ArgumentPassingFact;
}

export interface RuntimeCarrierRequest {
  readonly type: ExtensionFactSubject;
  readonly target?: string;
}

export interface RuntimeCarrierResult {
  readonly carrier: TargetTypeRef;
  readonly requiresAllocation?: boolean;
}

export interface ContextualTypeRequest {
  readonly expression: ExtensionFactSubject;
  readonly context: ExtensionFactSubject;
  readonly target?: string;
}

export interface ContextualTypeResult {
  readonly type: ExtensionFactSubject;
  readonly targetType?: TargetTypeRef;
}

export interface ValidateFlowUseRequest {
  readonly useSite: ExtensionFactSubject;
  readonly symbol: ExtensionFactSubject;
  readonly mode?: ArgumentPassingMode | "read" | "write" | "call";
  readonly target?: string;
}

export interface ValidateFlowUseResult {
  readonly valid: boolean;
  readonly targetCompilerValidationRequired?: boolean;
  readonly targetCompiler?: string;
}

export interface ExtensionDecisionMap {
  readonly [ExtensionDecisionQuestion.satisfiesConstraint]: {
    readonly request: SatisfiesConstraintRequest;
    readonly result: boolean;
  };
  readonly [ExtensionDecisionQuestion.isAssignableTo]: {
    readonly request: AssignabilityRequest;
    readonly result: boolean;
  };
  readonly [ExtensionDecisionQuestion.resolveCall]: {
    readonly request: ResolveCallRequest;
    readonly result: ResolveCallResult;
  };
  readonly [ExtensionDecisionQuestion.inferTypeArguments]: {
    readonly request: InferTypeArgumentsRequest;
    readonly result: InferTypeArgumentsResult;
  };
  readonly [ExtensionDecisionQuestion.resolvePropertyAccess]: {
    readonly request: ResolvePropertyAccessRequest;
    readonly result: ResolveOperationResult;
  };
  readonly [ExtensionDecisionQuestion.resolveElementAccess]: {
    readonly request: ResolveElementAccessRequest;
    readonly result: ResolveOperationResult;
  };
  readonly [ExtensionDecisionQuestion.resolveOperator]: {
    readonly request: ResolveOperatorRequest;
    readonly result: ResolveOperationResult;
  };
  readonly [ExtensionDecisionQuestion.getContextualType]: {
    readonly request: ContextualTypeRequest;
    readonly result: ContextualTypeResult;
  };
  readonly [ExtensionDecisionQuestion.resolveConversion]: {
    readonly request: ResolveConversionRequest;
    readonly result: ResolveConversionResult;
  };
  readonly [ExtensionDecisionQuestion.getParameterMode]: {
    readonly request: ParameterModeRequest;
    readonly result: ParameterModeResult;
  };
  readonly [ExtensionDecisionQuestion.getRuntimeCarrier]: {
    readonly request: RuntimeCarrierRequest;
    readonly result: RuntimeCarrierResult;
  };
  readonly [ExtensionDecisionQuestion.validateFlowUse]: {
    readonly request: ValidateFlowUseRequest;
    readonly result: ValidateFlowUseResult;
  };
}

export type ExtensionDecisionRequest<TQuestion extends ExtensionDecisionQuestionName> = ExtensionDecisionMap[TQuestion]["request"];
export type ExtensionDecisionResponse<TQuestion extends ExtensionDecisionQuestionName> = ExtensionDecisionMap[TQuestion]["result"];
export type ExtensionDecisionHook<TQuestion extends ExtensionDecisionQuestionName> = (
  request: ExtensionDecisionRequest<TQuestion>,
  context: ExtensionDecisionContext<TQuestion>,
) => ExtensionDecision<ExtensionDecisionResponse<TQuestion>>;

export const deferDecision: ExtensionDecision<never> = Object.freeze({ kind: "defer" });

export function acceptDecision<T>(value: T, evidence?: readonly ExtensionEvidence[]): ExtensionDecision<T> {
  return evidence === undefined ? { kind: "accept", value } : { kind: "accept", value, evidence };
}

export function rejectDecision<T>(diagnostic: ExtensionDiagnostic): ExtensionDecision<T> {
  return { kind: "reject", diagnostic };
}
