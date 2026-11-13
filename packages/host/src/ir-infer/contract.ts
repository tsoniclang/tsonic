import type { BodyId, CandidateListId, DefId, GroupId, LocalRef, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { Diagnostic, Result, TextParseResult, Violation } from "../diag/contract.js";
import type { BindingScope, BindingVector, LiteralValue, MemberKey, MemberOrigin, NativePrimitive, NominalDefinition, PassingMode, TypeComponent, TypeEvidence, TypeParameterIdentity, TypeTable } from "../ir-types/contract.js";
import type { HirBinaryOperator, HirCallableEndpoint, HirCandidateList, HirCoreCapture, HirUnaryOperator } from "../ir-hir/contract.js";

export type InferredPart =
  | { readonly kind: "return" | "yield" | "variable" | "field" }
  | { readonly kind: "parameter-initializer"; readonly index: number };

export interface InferredSignaturePart {
  readonly definition: DefId;
  readonly part: InferredPart;
}

export type InferenceVariable = { readonly id: number; readonly occurrence: NodeRef } & (
  | { readonly kind: "signature"; readonly signature: InferredSignaturePart }
  | { readonly kind: "local"; readonly local: LocalRef | null }
  | { readonly kind: "binder"; readonly application: NodeRef; readonly candidate: number;
      readonly family: "class" | "method" | "captured"; readonly parameter: TypeParameterIdentity }
  | { readonly kind: "literal"; readonly value: LiteralValue }
);

export type FlowRole = "initialization" | "assignment" | "argument" | "return" | "receiver" | "yield" | "member-write";
export type AccessRole = "read" | "write" | "call";
export type ProtocolKind = "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
export type RuleIdentity = "embed" | "domain-fit" | "memory-equivalent" | "member" | "index"
  | "construct-literal" | "candidate" | "operator" | "literal-fit" | "protocol" | "refinement" | "library" | "core" | "closure";

export interface EqualityConstraint {
  readonly kind: "eq";
  readonly occurrence: NodeRef;
  readonly left: TyId;
  readonly right: TyId;
}

export interface FlowConstraint {
  readonly kind: "flow";
  readonly occurrence: NodeRef;
  readonly from: TyId;
  readonly to: TyId;
  readonly role: FlowRole;
  readonly bindings: BindingVector;
}

export interface LiteralConstraint {
  readonly kind: "literal";
  readonly occurrence: NodeRef;
  readonly value: LiteralValue;
  readonly destination: TyId;
}

export interface OperatorConstraint {
  readonly kind: "op";
  readonly occurrence: NodeRef;
  readonly operator: HirUnaryOperator | HirBinaryOperator;
  readonly operands: readonly TyId[];
  readonly result: TyId;
  readonly permissionScope: NodeRef | null;
}

export interface MemberConstraint {
  readonly kind: "member";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: MemberKey;
  readonly access: AccessRole;
  readonly result: TyId;
  readonly origins: readonly MemberOrigin[];
  readonly bindings: BindingVector;
}

export interface IndexConstraint {
  readonly kind: "index";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: TyId;
  readonly access: AccessRole;
  readonly result: TyId;
  readonly bindings: BindingVector;
}

export interface ApplicationArgument {
  readonly occurrence: NodeRef;
  readonly kind: "value" | "spread";
  readonly type: TyId;
  readonly tuple: readonly TyId[] | null;
  readonly closure: BodyId | null;
}

export interface ApplicationConstraintData {
  readonly captured: HirCoreCapture;
  readonly permissionScope: NodeRef | null;
  readonly callee: TyId;
  readonly receiver: TyId | null;
  readonly typeArguments: readonly TyId[];
  readonly arguments: readonly ApplicationArgument[];
  readonly candidates: CandidateListId;
  readonly result: TyId;
}

export interface CallConstraint {
  readonly kind: "call";
  readonly occurrence: NodeRef;
  readonly application: ApplicationConstraintData;
}

export interface ConstructConstraint {
  readonly kind: "construct";
  readonly occurrence: NodeRef;
  readonly application: ApplicationConstraintData;
}

export type LiteralPart =
  | { readonly kind: "element"; readonly occurrence: NodeRef; readonly type: TyId }
  | { readonly kind: "property"; readonly occurrence: NodeRef; readonly key: MemberKey; readonly type: TyId }
  | { readonly kind: "spread"; readonly occurrence: NodeRef; readonly type: TyId };

export interface LiteralConstructionConstraint {
  readonly kind: "construct-literal";
  readonly occurrence: NodeRef;
  readonly construction: "object" | "array";
  readonly parts: readonly LiteralPart[];
  readonly destination: TyId | null;
  readonly result: TyId;
}

export interface ProtocolConstraint {
  readonly kind: "protocol";
  readonly occurrence: NodeRef;
  readonly protocol: ProtocolKind;
  readonly asynchronous: boolean;
  readonly subject: TyId | null;
  readonly operands: readonly TyId[];
  readonly result: TyId;
  readonly bindings: BindingVector;
}

export interface RefinementConstraint {
  readonly kind: "refine";
  readonly occurrence: NodeRef;
  readonly source: TyId;
  readonly checked: TyId;
  readonly result: TyId;
}

export interface ClosureCapture {
  readonly local: LocalRef;
  readonly type: TyId;
  readonly reassignable: boolean;
}

export interface ClosureConstraint {
  readonly kind: "closure";
  readonly occurrence: NodeRef;
  readonly created: BodyId;
  readonly captures: readonly ClosureCapture[];
  readonly result: TyId;
  readonly bindings: BindingVector;
}

export interface DischargeConstraint {
  readonly kind: "discharge";
  readonly occurrence: NodeRef;
  readonly checkerDiagnostic: number;
  readonly obligations: readonly ConstraintRef[];
}

export type DefaultRule = "signature-producers" | "local-producers" | "binder-declared-default" | "literal-native-default" | "refuse-unseeded";

export interface DefaultConstraint {
  readonly kind: "default";
  readonly occurrence: NodeRef;
  readonly variable: number;
  readonly rule: DefaultRule;
  readonly type: TyId | null;
}

export type Constraint = EqualityConstraint | FlowConstraint | LiteralConstraint | OperatorConstraint
  | MemberConstraint | IndexConstraint | CallConstraint | ConstructConstraint | LiteralConstructionConstraint
  | ProtocolConstraint | RefinementConstraint | DischargeConstraint | DefaultConstraint | ClosureConstraint;

export interface ConstraintSet {
  readonly group: GroupId;
  readonly body: BodyId;
  readonly variables: readonly InferenceVariable[];
  readonly candidates: readonly HirCandidateList[];
  readonly evidence: readonly TypeEvidence[];
  readonly constraints: readonly Constraint[];
}

export interface ConstraintRef {
  readonly body: BodyId;
  readonly index: number;
}

export type ContributionRole =
  | { readonly kind: "equality"; readonly direction: "left-to-right" | "right-to-left" }
  | { readonly kind: "flow" }
  | { readonly kind: "selection" }
  | { readonly kind: "argument-flow"; readonly argument: number; readonly component: number }
  | { readonly kind: "receiver-flow" }
  | { readonly kind: "context-flow"; readonly argument: number; readonly parameter: number }
  | { readonly kind: "closure-result-flow"; readonly argument: number; readonly result: number }
  | { readonly kind: "application-result" }
  | { readonly kind: "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default" }
  | { readonly kind: "construction-part"; readonly part: number };

export interface ContributionKey {
  readonly node: NodeRef;
  readonly candidate: number | null;
  readonly role: ContributionRole;
}

export interface AtomicContribution {
  readonly key: ContributionKey;
  readonly reads: readonly number[];
  readonly bounds: readonly number[];
  readonly constraint: ConstraintRef;
}

export interface InferenceGroup {
  readonly id: GroupId;
  readonly bodies: readonly BodyId[];
  readonly signatures: readonly InferredSignaturePart[];
}

export interface RuleContext {
  readonly occurrence: NodeRef;
  readonly origin: Origin;
  readonly bindings: BindingVector;
}

export interface EmbedInput {
  readonly context: RuleContext;
  readonly from: TypeEvidence;
  readonly to: TypeEvidence;
  readonly role: FlowRole;
}

export interface DomainFitInput {
  readonly context: RuleContext;
  readonly value: TypeEvidence;
  readonly domain: TypeEvidence;
}

export interface MemoryEquivalentInput {
  readonly context: RuleContext;
  readonly left: TypeEvidence;
  readonly right: TypeEvidence;
}

export interface MemberInput {
  readonly context: RuleContext;
  readonly receiver: TypeEvidence;
  readonly key: MemberKey;
  readonly access: AccessRole;
  readonly origins: readonly MemberOrigin[];
}

export interface IndexInput {
  readonly context: RuleContext;
  readonly receiver: TypeEvidence;
  readonly key: TypeEvidence;
  readonly access: AccessRole;
}

export type LiteralConstructionPart =
  | { readonly kind: "element"; readonly occurrence: NodeRef; readonly value: TypeEvidence }
  | { readonly kind: "property"; readonly occurrence: NodeRef; readonly key: MemberKey; readonly value: TypeEvidence }
  | { readonly kind: "spread"; readonly occurrence: NodeRef; readonly value: TypeEvidence };

export interface LiteralConstructionInput {
  readonly context: RuleContext;
  readonly construction: "object" | "array";
  readonly parts: readonly LiteralConstructionPart[];
  readonly destination: TypeEvidence | null;
}

export interface CandidateArgument {
  readonly occurrence: NodeRef;
  readonly kind: "value" | "spread";
  readonly value: TypeEvidence;
  readonly tuple: readonly TypeEvidence[] | null;
}

export interface CandidateEndpoint {
  readonly ordinal: number;
  readonly declaration: DefId;
  readonly advertised: HirCallableEndpoint;
  readonly api: HirCallableEndpoint;
  readonly bindings: BindingVector;
  readonly conditionalFailure: Diagnostic | null;
}

export interface CandidateInput {
  readonly context: RuleContext;
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly callee: TypeEvidence;
  readonly receiver: TypeEvidence | null;
  readonly typeArguments: readonly TypeEvidence[];
  readonly arguments: readonly CandidateArgument[];
  readonly candidates: readonly CandidateEndpoint[];
}

export interface OperatorInput {
  readonly context: RuleContext;
  readonly operator: HirUnaryOperator | HirBinaryOperator;
  readonly operands: readonly TypeEvidence[];
  readonly permissionScope: NodeRef | null;
}

export interface LiteralFitInput {
  readonly context: RuleContext;
  readonly literal: LiteralValue;
  readonly destination: TypeEvidence;
}

export interface ProtocolInput {
  readonly context: RuleContext;
  readonly kind: ProtocolKind;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly TypeEvidence[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface RefinementInput {
  readonly context: RuleContext;
  readonly source: TypeEvidence;
  readonly checked: TypeEvidence;
}

export interface LibraryInput {
  readonly context: RuleContext;
  readonly declaration: DefId;
  readonly receiver: TypeEvidence | null;
  readonly arguments: readonly TypeEvidence[];
  readonly result: TypeEvidence;
}

export interface CoreInput {
  readonly context: RuleContext;
  readonly captured: HirCoreCapture;
  readonly declaration: DefId;
  readonly operands: readonly TypeEvidence[];
  readonly result: TypeEvidence;
  readonly permissionScope: NodeRef | null;
}

export type CheckFailure = "unwind" | "abort";
export type FailureKind = "none" | CheckFailure;

export type CheckRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "required"; readonly failure: CheckFailure };

export type OperationExecution =
  | { readonly kind: "pure" }
  | { readonly kind: "invocation"; readonly writesStorage: boolean; readonly failure: FailureKind };

export type ReceiverAccess = "in-place" | "by-reference";

export type AccessLocation =
  | { readonly kind: "data"; readonly check: CheckRequirement; readonly receiver: ReceiverAccess }
  | { readonly kind: "accessor" };

export type HandleActivation = "at-creation" | "when-first-driven";

// The logical captured values and locations of a closure, one per captured local in order. A captured location preserves
// its source location identity. Neither value selects a physical copy: Origins' and PointerBacking's facts and the native
// compiler justify any later representation.
export type LogicalCapture = "captured-value" | "captured-location";

export interface ClosureDecision {
  readonly carrier: TyId;
  readonly captures: readonly LogicalCapture[];
  readonly execution: OperationExecution;
}

// The ready evidence of one captured local, in the order of the closure's captured locals: its identity, its type, and
// whether its binding can be reassigned by its declaration. The fact is about the binding, not about the object it holds,
// and not about whether a reassignment occurs.
export interface ClosureCaptureEvidence {
  readonly local: LocalRef;
  readonly value: TypeEvidence;
  readonly reassignable: boolean;
}

export interface ClosureInput {
  readonly context: RuleContext;
  readonly callable: TypeEvidence;
  readonly captures: readonly ClosureCaptureEvidence[];
}

export type ConversionKind = "numeric" | "literal-fit" | "absence" | "union-injection" | "shape" | "callable" | "readonly";

export interface CorrespondenceStep {
  readonly from: TypeComponent;
  readonly to: TypeComponent;
  readonly rule: "identity" | ConversionKind;
  readonly premises: readonly number[];
}

export interface EmbeddingProof {
  readonly steps: readonly CorrespondenceStep[];
  readonly conclusion: number;
}

export type EmbeddingDecision =
  | { readonly kind: "identity" }
  | { readonly kind: "conversion"; readonly conversion: ConversionKind; readonly proof: EmbeddingProof; readonly check: CheckRequirement }
  | { readonly kind: "refused"; readonly reason: "incompatible-domain" | "lossy-numeric" | "missing-correspondence" | "passing-mode" | "rigid-parameter" };

export interface MemberDecision {
  readonly key: MemberKey;
  readonly origins: readonly MemberOrigin[];
  readonly selectedDeclarations: readonly DefId[];
  readonly primary: DefId | null;
  readonly read: TyId | null;
  readonly write: TyId | null;
  readonly getter: HirCallableEndpoint | null;
  readonly setter: HirCallableEndpoint | null;
  readonly bindings: BindingVector;
  readonly location: AccessLocation;
}

export type ParameterMapping =
  | { readonly kind: "argument"; readonly parameter: number; readonly argument: number; readonly component: number | null; readonly passing: PassingMode }
  | { readonly kind: "default"; readonly parameter: number; readonly initializer: BodyId }
  | { readonly kind: "omitted"; readonly parameter: number; readonly type: TyId }
  | { readonly kind: "rest"; readonly parameter: number; readonly arguments: readonly number[]; readonly passing: PassingMode };

export interface CompletionEndpoint {
  readonly signature: SigId;
  readonly completion: TyId;
  readonly yielded: TyId | null;
  readonly sent: TyId | null;
}

export interface ApplicationDecision {
  readonly candidate: number;
  readonly advertised: HirCallableEndpoint;
  readonly api: HirCallableEndpoint;
  readonly bindings: BindingVector;
  readonly implementationBindings: BindingVector;
  readonly parameters: readonly ParameterMapping[];
  readonly completion: CompletionEndpoint;
  readonly result: TyId;
  readonly activation: HandleActivation | null;
}

export interface ConstructionPartDecision {
  readonly part: number;
  readonly source: NodeRef;
  readonly destination: TypeComponent;
  readonly member: MemberDecision | null;
  readonly embedding: EmbeddingDecision;
}

export interface ProtocolStepDecision {
  readonly role: "acquire" | "next" | "done" | "value" | "finish" | "fail" | "await" | "dispose" | "completion";
  readonly operation: ProtocolStepOperation;
  readonly operands: readonly TyId[];
  readonly result: TyId;
}

export type ProtocolStepOperation =
  | { readonly kind: "call"; readonly application: ApplicationDecision }
  | { readonly kind: "core"; readonly declaration: DefId; readonly bindings: BindingVector }
  | { readonly kind: "completion" };

export type OperationIdentity =
  | { readonly kind: "native-operator"; readonly operator: HirUnaryOperator | HirBinaryOperator; readonly carrier: NativePrimitive }
  | { readonly kind: "bigint-operator"; readonly operator: HirUnaryOperator | HirBinaryOperator }
  | { readonly kind: "string-operator"; readonly operator: "+" | "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" }
  | { readonly kind: "boolean-operator"; readonly operator: "!" | "&&" | "||" | "==" | "!=" | "===" | "!==" }
  | { readonly kind: "absence-test"; readonly negated: boolean }
  | { readonly kind: "object-construction" | "array-construction"; readonly parts: readonly ConstructionPartDecision[] }
  | { readonly kind: "protocol"; readonly protocol: ProtocolKind; readonly asynchronous: boolean;
      readonly steps: readonly ProtocolStepDecision[]; readonly value: TyId; readonly completion: TyId;
      readonly yielded: TyId | null; readonly sent: TyId | null; readonly thrown: TyId }
  | { readonly kind: "conversion"; readonly from: TyId; readonly to: TyId; readonly embedding: EmbeddingDecision }
  | { readonly kind: "library" | "core"; readonly declaration: DefId; readonly bindings: BindingVector }
  | { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" }
  | { readonly kind: "type-query" | "discard" };

export interface OperationDecision {
  readonly kind: "selected";
  readonly operation: OperationIdentity;
  readonly operands: readonly TyId[];
  readonly result: TyId;
  readonly execution: OperationExecution;
}

export type DeferredInvocation =
  | { readonly rule: "embed"; readonly input: EmbedInput }
  | { readonly rule: "domain-fit"; readonly input: DomainFitInput }
  | { readonly rule: "memory-equivalent"; readonly input: MemoryEquivalentInput }
  | { readonly rule: "member"; readonly input: MemberInput }
  | { readonly rule: "index"; readonly input: IndexInput }
  | { readonly rule: "construct-literal"; readonly input: LiteralConstructionInput }
  | { readonly rule: "candidate"; readonly input: CandidateInput }
  | { readonly rule: "operator"; readonly input: OperatorInput }
  | { readonly rule: "literal-fit"; readonly input: LiteralFitInput }
  | { readonly rule: "protocol"; readonly input: ProtocolInput }
  | { readonly rule: "refinement"; readonly input: RefinementInput }
  | { readonly rule: "library"; readonly input: LibraryInput }
  | { readonly rule: "core"; readonly input: CoreInput }
  | { readonly rule: "closure"; readonly input: ClosureInput };

export interface DeferredDecision {
  readonly invocation: DeferredInvocation;
  readonly result: TyId;
}

export type RuleOutcome<Decision> =
  | { readonly kind: "decided"; readonly decision: Decision }
  | { readonly kind: "deferred"; readonly deferred: DeferredDecision };

export type RefinementDecision =
  | { readonly kind: "identity"; readonly type: TyId }
  | { readonly kind: "narrowed"; readonly source: TyId; readonly result: TyId; readonly proof: EmbeddingProof; readonly failure: CheckFailure };

export interface FinalVariable {
  readonly variable: number;
  readonly value: TypeEvidence;
}

export interface VariableBound {
  readonly contribution: ContributionKey;
  readonly variable: number;
  readonly kind: "producer" | "demand";
  readonly value: TypeEvidence;
}

export interface FinalizationInput {
  readonly variable: InferenceVariable;
  readonly producers: readonly VariableBound[];
  readonly demands: readonly VariableBound[];
  readonly default: DefaultConstraint | null;
  readonly declaredConstraint: TypeEvidence | null;
  readonly declaredDefault: TypeEvidence | null;
}

export interface BoundCheckInput {
  readonly variable: InferenceVariable;
  readonly final: TypeEvidence;
  readonly bound: VariableBound;
}

export type BoundCheckOutcome =
  | { readonly kind: "satisfied"; readonly embedding: EmbeddingDecision }
  | { readonly kind: "refused"; readonly reason: "signature-use-demand" | "conflicting-destinations" | "accumulator-widening" | "binder-constraint" | "literal-inexact" };

export interface VariableRule {
  readonly finalize: (input: FinalizationInput) => Result<TypeEvidence>;
  readonly check: (input: BoundCheckInput) => Result<BoundCheckOutcome>;
}

export interface EnumerationInput<ConstraintKind extends Constraint> {
  readonly group: GroupId;
  readonly remainingContributions: number;
  readonly constraint: ConstraintKind;
  readonly reference: ConstraintRef;
  readonly variables: readonly InferenceVariable[];
  readonly candidates: readonly HirCandidateList[];
  readonly evidence: readonly TypeEvidence[];
}

export interface ContributionEvaluation<ConstraintKind extends Constraint> {
  readonly contribution: AtomicContribution;
  readonly constraint: ConstraintKind;
  readonly candidates: readonly HirCandidateList[];
  readonly evidence: readonly TypeEvidence[];
  readonly reads: readonly FinalVariable[];
}

export type ConstraintDecision =
  | { readonly kind: "eq"; readonly equivalent: boolean }
  | { readonly kind: "flow" | "literal"; readonly embedding: EmbeddingDecision }
  | { readonly kind: "member" | "index"; readonly member: MemberDecision }
  | { readonly kind: "call" | "construct"; readonly application: ApplicationDecision;
      readonly operation: RuleOutcome<OperationDecision> | null }
  | { readonly kind: "op" | "construct-literal" | "protocol"; readonly operation: OperationDecision }
  | { readonly kind: "refine"; readonly refinement: RefinementDecision }
  | { readonly kind: "discharge"; readonly proof: DischargeProof }
  | { readonly kind: "default"; readonly type: TyId }
  | { readonly kind: "closure"; readonly closure: ClosureDecision }
  | { readonly kind: "deferred"; readonly deferred: DeferredDecision };

export interface DischargeObligationProof {
  readonly ordinal: number;
  readonly rule: RuleIdentity;
  readonly evidence: EmbeddingProof;
}

export interface DischargeProof {
  readonly checkerDiagnostic: number;
  readonly obligations: readonly DischargeObligationProof[];
}

export interface ContributionOutcome {
  readonly bounds: readonly VariableBound[];
  readonly decision: ConstraintDecision | null;
  readonly selectedCandidate: number | null;
}

export interface ConstraintScheme<ConstraintKind extends Constraint> {
  readonly enumerate: (input: EnumerationInput<ConstraintKind>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<ConstraintKind>) => Result<ContributionOutcome>;
}

export interface ConstraintSchemes {
  readonly eq: ConstraintScheme<EqualityConstraint>;
  readonly flow: ConstraintScheme<FlowConstraint>;
  readonly literal: ConstraintScheme<LiteralConstraint>;
  readonly op: ConstraintScheme<OperatorConstraint>;
  readonly member: ConstraintScheme<MemberConstraint>;
  readonly index: ConstraintScheme<IndexConstraint>;
  readonly call: ConstraintScheme<CallConstraint>;
  readonly construct: ConstraintScheme<ConstructConstraint>;
  readonly constructLiteral: ConstraintScheme<LiteralConstructionConstraint>;
  readonly protocol: ConstraintScheme<ProtocolConstraint>;
  readonly refine: ConstraintScheme<RefinementConstraint>;
  readonly discharge: ConstraintScheme<DischargeConstraint>;
  readonly default: ConstraintScheme<DefaultConstraint>;
}

export interface VariableRules {
  readonly signature: VariableRule;
  readonly local: VariableRule;
  readonly binder: VariableRule;
  readonly literal: VariableRule;
}

export interface RuleTable {
  readonly embed: (input: EmbedInput) => Result<RuleOutcome<EmbeddingDecision>>;
  readonly domainFit: (input: DomainFitInput) => Result<RuleOutcome<boolean>>;
  readonly memoryEquivalent: (input: MemoryEquivalentInput) => Result<RuleOutcome<boolean>>;
  readonly member: (input: MemberInput) => Result<RuleOutcome<MemberDecision>>;
  readonly index: (input: IndexInput) => Result<RuleOutcome<MemberDecision>>;
  readonly constructLiteral: (input: LiteralConstructionInput) => Result<RuleOutcome<OperationDecision>>;
  readonly candidate: (input: CandidateInput) => Result<RuleOutcome<ApplicationDecision>>;
  readonly operator: (input: OperatorInput) => Result<RuleOutcome<OperationDecision>>;
  readonly literalFit: (input: LiteralFitInput) => Result<RuleOutcome<EmbeddingDecision>>;
  readonly protocol: (input: ProtocolInput) => Result<RuleOutcome<OperationDecision>>;
  readonly refinement: (input: RefinementInput) => Result<RuleOutcome<RefinementDecision>>;
  readonly library: (input: LibraryInput) => Result<RuleOutcome<OperationDecision>>;
  readonly core: (input: CoreInput) => Result<RuleOutcome<OperationDecision>>;
  readonly closure: (input: ClosureInput) => Result<RuleOutcome<ClosureDecision>>;
  readonly variables: VariableRules;
  readonly constraints: ConstraintSchemes;
}

export interface SolvedConstraint {
  readonly constraint: ConstraintRef;
  readonly decision: ConstraintDecision;
}

export interface RecordedCheck {
  readonly variable: number;
  readonly contribution: ContributionKey;
  readonly bound: VariableBound;
  readonly outcome: BoundCheckOutcome;
}

export interface BodyTyping {
  readonly body: BodyId;
  readonly signature: SigId;
  readonly completion: TyId;
  readonly yielded: TyId | null;
  readonly sent: TyId | null;
}

export interface Solution {
  readonly group: GroupId;
  readonly variables: readonly FinalVariable[];
  readonly constraints: readonly SolvedConstraint[];
  readonly checks: readonly RecordedCheck[];
  readonly bodies: readonly BodyTyping[];
}

export type InferRule = "group-order" | "group-ownership" | "inferred-part-identity" | "variable-id-dense" | "variable-order"
  | "constraint-reference" | "candidate-reference" | "candidate-order" | "open-term-resolves" | "open-term-owner"
  | "contribution-key-unique" | "contribution-order" | "contribution-role"
  | "contribution-reads-bounds-declared" | "contribution-footprint-complete"
  | "one-publication-per-variable" | "solution-total" | "solution-order"
  | "no-open-in-solution" | "check-recorded" | "decision-kind"
  | "binding-vector-complete" | "parameter-mapping-total" | "endpoint-agreement"
  | "proof-reference" | "proof-order" | "qualified-reference" | "body-completion-endpoints"
  | "construction-part-total" | "protocol-channels" | "api-endpoint-role" | "deferred-invocation"
  | "access-location" | "closure-capture-total" | "closure-capture-binding";

export type InferSite =
  | { readonly kind: "group"; readonly group: GroupId }
  | { readonly kind: "variable"; readonly group: GroupId; readonly variable: number }
  | { readonly kind: "constraint"; readonly constraint: ConstraintRef }
  | { readonly kind: "contribution"; readonly key: ContributionKey }
  | { readonly kind: "check"; readonly index: number }
  | { readonly kind: "body"; readonly body: BodyId }
  | { readonly kind: "proof"; readonly constraint: ConstraintRef; readonly step: number };

export interface InferenceDeclaration {
  readonly scope: BindingScope;
  readonly parameterCount: number | null;
  readonly endpoints: readonly HirCallableEndpoint[];
}

export interface InferVerificationInput {
  readonly group: InferenceGroup;
  readonly constraints: readonly ConstraintSet[];
  readonly contributions: readonly AtomicContribution[];
  readonly solution: Solution | null;
  readonly types: TypeTable;
  readonly bindingScopes: readonly BindingScope[];
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeExists: (node: SourceNodeRef) => boolean;
  readonly localExists: (local: LocalRef) => boolean;
}

export type PrintConstraints = (constraints: ConstraintSet) => string;
export type ParseConstraints = (text: string) => TextParseResult<ConstraintSet>;
export type PrintContributions = (contributions: readonly AtomicContribution[]) => string;
export type ParseContributions = (text: string) => TextParseResult<readonly AtomicContribution[]>;
export type PrintInferenceGroup = (group: InferenceGroup) => string;
export type ParseInferenceGroup = (text: string) => TextParseResult<InferenceGroup>;
export type PrintSolution = (solution: Solution) => string;
export type ParseSolution = (text: string) => TextParseResult<Solution>;
export type VerifyInference = (input: InferVerificationInput) => readonly Violation<InferRule, InferSite>[];
