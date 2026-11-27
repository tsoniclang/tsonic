import type { BodyId, CandidateListId, DefId, GroupId, ItemNodeRef, LocalRef, NodeRef, Origin, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { Diagnostic, ErrorValue, Result, TextParseResult, UnitRef, UnitRequest, Violation } from "../diag/contract.js";
import type { CheckFailure, HandleActivation, MemberTypeAccess, NativeArrayCarrier, NativeArrayConstruction, NativeArrayExtent, NativeCarrierHolding, ReceiverAccess, SourceObjectField, TypePublicationWork } from "../ir-types/contract.js";
import type { BindingScope, BindingVector, BodyInstance, LiteralValue, MemberInventory, MemberKey, MemberOrigin, MemberStorageSelection, MemberTypeRequest, MemberTypes, NativeIntegerPrimitive, NativePrimitive, NominalDefinition, PassingMode, ReferenceArgumentView, Signature, SignatureRequest, TypeComponent, TypeEvidence, TypeProductionRequest, TypeTable } from "../ir-types/contract.js";
import type { CapturedFact, HirBinaryOperator, HirCallableEndpoint, HirCandidate, HirCoreCapture, HirUnaryOperator, HirNode, ReferenceArgumentRequest } from "../ir-hir/contract.js";
import type { Step } from "../step/contract.js";

export type InferredPart =
  | { readonly kind: "return" | "yield" | "variable" | "field" }
  | { readonly kind: "enum-member-value" }
  | { readonly kind: "parameter-initializer"; readonly index: number };

export interface InferredSignaturePart {
  readonly definition: DefId;
  readonly part: InferredPart;
}

export type InferredPartsOf = (definition: DefId, declaration: HirNode) => readonly InferredSignaturePart[];
export type InferredPartKey = (part: InferredSignaturePart) => string;

export interface InferredPartType {
  readonly part: InferredSignaturePart;
  readonly type: TyId;
  readonly error: ErrorValue | null;
  readonly origin: UnitRef;
}

export interface InferredPartRequest {
  readonly kind: "inferred-part";
  readonly part: InferredSignaturePart;
}

export type SignaturePlacement =
  | { readonly kind: "endpoint"; readonly request: SignatureRequest; readonly parts: readonly InferredPartType[] }
  | { readonly kind: "callable-body"; readonly instance: BodyInstance; readonly parts: readonly InferredPartType[] }
  | { readonly kind: "execution-body"; readonly instance: BodyInstance; readonly completion: TyId; readonly error: ErrorValue | null };

export interface PlacedSignature {
  readonly request: SignatureRequest | null;
  readonly signature: Signature;
}

export type InferenceVariable = { readonly id: number; readonly occurrence: NodeRef } & (
  | { readonly kind: "signature"; readonly signature: InferredSignaturePart }
  | { readonly kind: "local"; readonly local: LocalRef | null }
  | { readonly kind: "binder"; readonly application: NodeRef; readonly candidate: number;
      readonly family: "class" | "method" | "captured"; readonly parameter: DefId }
  | { readonly kind: "literal"; readonly value: LiteralValue }
);

export type FlowRole = "initialization" | "assignment" | "argument" | "return" | "receiver" | "yield" | "member-write";
export type MemberAccessRole = MemberTypeAccess | "call";
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

export interface OperatorConstraintInputs {
  readonly kind: "op";
  readonly occurrence: NodeRef;
  readonly operands: readonly TyId[];
  readonly result: TyId;
}

export interface WrittenOperatorConstraint extends OperatorConstraintInputs {
  readonly operator: HirUnaryOperator | HirBinaryOperator;
  readonly permissionScope: NodeRef | null;
}

export interface ArrayExtentConstraint extends OperatorConstraintInputs {
  readonly operator: "array-extent";
  readonly declaration: ItemNodeRef;
  readonly permissionScope: null;
}

export type OperatorConstraint = WrittenOperatorConstraint | ArrayExtentConstraint;

export interface MemberConstraint {
  readonly kind: "member";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: MemberKey;
  readonly access: MemberAccessRole;
  readonly result: TyId;
  readonly origins: readonly MemberOrigin[];
  readonly bindings: BindingVector;
}

export interface IndexConstraint {
  readonly kind: "index";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: TyId;
  readonly access: MemberTypeAccess;
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
  readonly inferredResult: TyId | null;
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

// Where the storage of a captured binding comes from in the body that creates the closure: a binding of that body's own,
// one of its parameters with the passing mode of the declaration, or one of its own captures with the logical capture its
// row states. A by-reference parameter and a captured location denote storage that exists outside the body.
export type CaptureSource =
  | { readonly kind: "binding" }
  | { readonly kind: "parameter"; readonly passing: PassingMode }
  | { readonly kind: "capture"; readonly capture: LogicalCapture };

export interface CaptureModeEvidence {
  readonly local: LocalRef;
  readonly reassignable: boolean;
  readonly incoming: CaptureSource;
}

export interface ClosureCapture extends CaptureModeEvidence {
  readonly type: TyId;
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

export interface CandidateEndpoints {
  readonly advertised: HirCallableEndpoint;
  readonly advertisedSignature: SigId;
  readonly api: HirCallableEndpoint;
  readonly apiSignature: SigId;
}

export interface InferenceCandidate extends HirCandidate {
  readonly endpoints: CapturedFact<CandidateEndpoints>;
}

export interface InferenceCandidateList {
  readonly id: CandidateListId;
  readonly candidates: readonly InferenceCandidate[];
}

export interface ConstraintSet {
  readonly group: GroupId;
  readonly body: BodyId;
  readonly variables: readonly InferenceVariable[];
  readonly candidates: readonly InferenceCandidateList[];
  readonly evidence: readonly InferenceValue[];
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
  | { readonly kind: "construction" };

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
  readonly access: MemberAccessRole;
  readonly origins: readonly MemberOrigin[];
}

export interface IndexInput {
  readonly context: RuleContext;
  readonly receiver: TypeEvidence;
  readonly key: TypeEvidence;
  readonly access: MemberTypeAccess;
  readonly result: TyId;
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
  readonly result: TypeEvidence;
}

export interface CandidateArgument {
  readonly occurrence: NodeRef;
  readonly kind: "value" | "spread";
  readonly value: TypeEvidence;
  readonly tuple: readonly TypeEvidence[] | null;
}

export interface CandidateEndpoint extends CandidateEndpoints {
  readonly ordinal: number;
  readonly declaration: DefId;
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

export type FailureKind = "none" | CheckFailure;

export type CheckRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "required"; readonly failure: CheckFailure };

export type OperationExecution =
  | { readonly kind: "pure" }
  | { readonly kind: "array-initialization" }
  | { readonly kind: "invocation"; readonly writesStorage: boolean; readonly failure: FailureKind };

export type AccessLocation =
  | { readonly kind: "data"; readonly check: CheckRequirement; readonly receiver: ReceiverAccess }
  | { readonly kind: "accessor" };

// The logical capture of one captured local. A captured location preserves its source location identity: the closure and
// the creating body denote the same storage. A captured value is the value the binding holds at creation; when that value
// is an object reference, the object's contents stay shared and writable through it, so a captured value says nothing
// about immutability of contents. Neither selects a physical copy: Origins' and PointerBacking's facts and the native
// compiler justify any later representation.
export type LogicalCapture = "captured-value" | "captured-location";

// One capture: the captured source local and its logical capture. The creator's decision and the created body state the
// same rows in the same order.
export interface CaptureRowOf<Capture extends LogicalCapture | null> {
  readonly local: LocalRef;
  readonly capture: Capture;
}

// A row of a closure decision: the capture is decided.
export type CaptureRow = CaptureRowOf<LogicalCapture>;

// A row of a created body. Its capture is the creator's decided row; it is null only in the parametric template of a body
// whose creator saved the closure rule for instantiation, and then on every row: each instance carries the decided rows.
export type BodyCaptureRow = CaptureRowOf<LogicalCapture | null>;

export interface ClosureDecision {
  readonly carrier: TyId;
  readonly captures: readonly CaptureRow[];
  readonly execution: OperationExecution;
}

// The ready evidence of one captured local, in the order of the closure's captured locals: its identity, its type, and
// whether its binding can be reassigned by its declaration. The fact is about the binding, not about the object it holds,
// and not about whether a reassignment occurs.
export interface ClosureCaptureEvidence extends CaptureModeEvidence {
  readonly value: TypeEvidence;
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

export interface MemberDecision extends MemberStorageSelection {
  readonly read: TyId | null;
  readonly write: TyId | null;
  readonly getter: HirCallableEndpoint | null;
  readonly setter: HirCallableEndpoint | null;
  readonly location: AccessLocation;
}

export interface IndexDecision {
  readonly carrier: NativeArrayCarrier;
  readonly holding: ReceiverAccess;
  readonly receiver: TyId;
  readonly key: TyId;
  readonly read: TyId | null;
  readonly write: TyId | null;
  readonly failure: CheckFailure;
  readonly writeCheck: "before-value" | "after-value" | null;
}

export type ParameterMapping =
  | { readonly kind: "argument"; readonly parameter: number; readonly argument: number; readonly component: number | null; readonly passing: PassingMode }
  | { readonly kind: "reference-argument"; readonly parameter: number; readonly argument: number; readonly component: null;
      readonly passing: "by-value"; readonly view: ReferenceArgumentView }
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

export interface ThrowOperandUseInput {
  readonly instance: BodyInstance;
  readonly statement: NodeRef;
  readonly operand: NodeRef;
  readonly origin: Origin;
  readonly selected:
    | { readonly kind: "value"; readonly producer: NodeRef; readonly type: TyId }
    | { readonly kind: "application"; readonly producer: NodeRef; readonly decision: ApplicationDecision };
}

export interface ConstructionPartDecision {
  readonly part: number;
  readonly source: NodeRef;
  readonly destination: TypeComponent;
  readonly member: MemberDecision | null;
  readonly embedding: EmbeddingDecision;
}

export type NativeArrayConstructionPart =
  | { readonly kind: "element"; readonly source: NodeRef; readonly embedding: EmbeddingDecision }
  | { readonly kind: "spread"; readonly source: NodeRef };

export interface NativeArrayConstructionOperation {
  readonly kind: "exact-array-construction";
  readonly extent: NativeIntegerPrimitive;
  readonly holding: ReceiverAccess;
  readonly extentFailure: CheckFailure;
  readonly allocationFailure: CheckFailure;
  readonly parts: readonly NativeArrayConstructionPart[];
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
  | { readonly kind: "array-extent"; readonly declaration: ItemNodeRef; readonly holding: ReceiverAccess }
  | { readonly kind: "object-construction" | "array-construction"; readonly parts: readonly ConstructionPartDecision[] }
  | NativeArrayConstructionOperation
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

export interface NarrowedRefinement {
  readonly kind: "narrowed";
  readonly source: TyId;
  readonly result: TyId;
  readonly proof: EmbeddingProof;
  readonly failure: CheckFailure;
}

export type RefinementDecision = { readonly kind: "identity"; readonly type: TyId } | NarrowedRefinement;

export interface InferenceValue {
  readonly value: TypeEvidence;
  readonly error: ErrorValue | null;
}

export interface FinalVariable extends InferenceValue {
  readonly variable: number;
}

export interface VariableBound extends InferenceValue {
  readonly contribution: ContributionKey;
  readonly variable: number;
  readonly kind: "producer" | "demand";
}

export interface FinalizationInput {
  readonly variable: InferenceVariable;
  readonly producers: readonly VariableBound[];
  readonly demands: readonly VariableBound[];
  readonly inferredTypeBound: CapturedFact<TyId> | null;
  readonly default: DefaultConstraint | null;
  readonly declaredConstraint: InferenceValue | null;
  readonly declaredDefault: InferenceValue | null;
}

export interface BoundCheckInput {
  readonly origin: Origin;
  readonly variable: InferenceVariable;
  readonly final: InferenceValue;
  readonly bound: VariableBound;
}

export type BoundCheckOutcome =
  | { readonly kind: "error"; readonly error: ErrorValue }
  | { readonly kind: "satisfied"; readonly embedding: EmbeddingDecision }
  | { readonly kind: "refused"; readonly reason: "signature-use-demand" | "conflicting-destinations" | "accumulator-widening" | "binder-constraint" | "literal-inexact" };

export interface RuleWork {
  readonly typeWork: TypePublicationWork;
  readonly unit: UnitRequest;
}

export type ReadReferenceArgument = (request: ReferenceArgumentRequest) => ReferenceArgumentView | null;

export interface VariableRule {
  readonly finalize: (input: FinalizationInput) => Result<InferenceValue>;
  readonly check: (input: BoundCheckInput, work: RuleWork) => Result<BoundCheckOutcome>;
}

export interface EnumerationInput<ConstraintKind extends Constraint> {
  readonly group: GroupId;
  readonly remainingContributions: number;
  readonly constraint: ConstraintKind;
  readonly reference: ConstraintRef;
  readonly variables: readonly InferenceVariable[];
  readonly candidates: readonly InferenceCandidateList[];
  readonly evidence: readonly InferenceValue[];
}

export interface ContributionEvaluation<ConstraintKind extends Constraint> {
  readonly contribution: AtomicContribution;
  readonly constraint: ConstraintKind;
  readonly candidates: readonly InferenceCandidateList[];
  readonly evidence: readonly InferenceValue[];
  readonly reads: readonly FinalVariable[];
}

export type ConstraintDecision =
  | { readonly kind: "error"; readonly error: ErrorValue }
  | { readonly kind: "eq"; readonly equivalent: boolean }
  | { readonly kind: "flow" | "literal"; readonly embedding: EmbeddingDecision }
  | { readonly kind: "member"; readonly member: MemberDecision; readonly refinement: NarrowedRefinement | null }
  | { readonly kind: "index"; readonly index: IndexDecision }
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

export type TypePatternMatchOutcome = "match" | "no-match";

export interface TypeProductionNeed {
  readonly kind: "produceType";
  readonly request: TypeProductionRequest;
}

export interface TypeProductionAnswer {
  readonly kind: "produceType";
  readonly value: TypeEvidence;
  readonly origin: UnitRef;
  readonly error: ErrorValue | null;
}

export type MemberRuleNeed =
  | { readonly kind: "membersOf"; readonly receiver: TyId }
  | { readonly kind: "memberTypeOf"; readonly request: MemberTypeRequest };

export type MemberRuleAnswer =
  | { readonly kind: "membersOf"; readonly value: MemberInventory }
  | { readonly kind: "memberTypeOf"; readonly request: MemberTypeRequest; readonly value: MemberTypes;
      readonly origin: UnitRef; readonly error: ErrorValue | null };

export type MemberRuleStep<Value, State> = Step<Result<Value>, MemberRuleNeed, State, Diagnostic>;

export type MemberRuleResult =
  | { readonly kind: "decided"; readonly decision: MemberDecision }
  | { readonly kind: "error"; readonly error: ErrorValue };

export type MemberRuleCompletion =
  | { readonly kind: "member"; readonly value: MemberRuleResult }
  | { readonly kind: "contribution"; readonly value: ContributionOutcome };

export interface MemberContributionScheme<State> {
  readonly enumerate: (input: EnumerationInput<MemberConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<MemberConstraint> & {
    readonly origin: Origin; readonly storage: SourceObjectField | null; readonly checkedRead: TyId | null;
  }) =>
    MemberRuleStep<MemberRuleCompletion, State>;
}

export interface ConstraintScheme<ConstraintKind extends Constraint> {
  readonly enumerate: (input: EnumerationInput<ConstraintKind>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<ConstraintKind>) => Result<ContributionOutcome>;
}

export interface PaidConstraintScheme<ConstraintKind extends Constraint> {
  readonly enumerate: (input: EnumerationInput<ConstraintKind>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<ConstraintKind> & { readonly origin: Origin }, work: RuleWork) => Result<ContributionOutcome>;
}

export interface FlowContributionScheme {
  readonly enumerate: (input: EnumerationInput<FlowConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<FlowConstraint> & { readonly origin: Origin;
    readonly optionalField: SourceObjectField | null }, work: RuleWork) => Result<ContributionOutcome>;
}

export interface QualifiedOperatorField {
  readonly operand: 0 | 1;
  readonly field: SourceObjectField;
}

export interface OperatorContributionScheme {
  readonly enumerate: (input: EnumerationInput<OperatorConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<OperatorConstraint> & {
    readonly reference: QualifiedOperatorField | null;
  }) => Result<ContributionOutcome>;
}

export interface IndexContributionScheme {
  readonly enumerate: (input: EnumerationInput<IndexConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<IndexConstraint> & { readonly origin: Origin }) => Result<ContributionOutcome>;
}

export interface ConstructionContributionScheme {
  readonly enumerate: (input: EnumerationInput<LiteralConstructionConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<LiteralConstructionConstraint> & RuleWork & {
    readonly origin: Origin; readonly bindings: BindingVector;
  }) => Result<ContributionOutcome>;
}

export interface CallContributionScheme {
  readonly enumerate: (input: EnumerationInput<CallConstraint>) => Result<readonly AtomicContribution[]>;
  readonly evaluate: (input: ContributionEvaluation<CallConstraint> & RuleWork & { readonly origin: Origin;
    readonly scope: BindingScope; readonly referenceArgument: ReadReferenceArgument }) => Result<ContributionOutcome>;
}

export interface ConstraintSchemes<State> {
  readonly eq: ConstraintScheme<EqualityConstraint>;
  readonly flow: FlowContributionScheme;
  readonly literal: PaidConstraintScheme<LiteralConstraint>;
  readonly op: OperatorContributionScheme;
  readonly member: MemberContributionScheme<State>;
  readonly index: IndexContributionScheme;
  readonly call: CallContributionScheme;
  readonly construct: ConstraintScheme<ConstructConstraint>;
  readonly constructLiteral: ConstructionContributionScheme;
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

export interface RuleTable<State> {
  readonly decideCaptureModes: (input: readonly CaptureModeEvidence[]) => Result<readonly CaptureRow[]>;
  readonly checkThrowOperandUse: (input: ThrowOperandUseInput) => Result<null>;
  readonly embed: (input: EmbedInput, work: RuleWork) => Result<RuleOutcome<EmbeddingDecision>>;
  readonly domainFit: (input: DomainFitInput) => Result<RuleOutcome<boolean>>;
  readonly memoryEquivalent: (input: MemoryEquivalentInput) => Result<RuleOutcome<boolean>>;
  readonly member: (input: MemberInput, storage: SourceObjectField | null) => MemberRuleStep<MemberRuleCompletion, State>;
  readonly resumeMember: (state: State, answers: readonly MemberRuleAnswer[]) => MemberRuleStep<MemberRuleCompletion, State>;
  readonly index: (input: IndexInput) => Result<RuleOutcome<IndexDecision>>;
  readonly constructLiteral: (input: LiteralConstructionInput, work: RuleWork) => Result<RuleOutcome<OperationDecision>>;
  readonly candidate: (input: CandidateInput, referenceArgument: ReadReferenceArgument, work: RuleWork) => Result<RuleOutcome<ApplicationDecision>>;
  readonly operator: (input: OperatorInput) => Result<RuleOutcome<OperationDecision>>;
  readonly literalFit: (input: LiteralFitInput, work: RuleWork) => Result<RuleOutcome<EmbeddingDecision>>;
  readonly protocol: (input: ProtocolInput) => Result<RuleOutcome<OperationDecision>>;
  readonly refinement: (input: RefinementInput) => Result<RuleOutcome<RefinementDecision>>;
  readonly library: (input: LibraryInput) => Result<RuleOutcome<OperationDecision>>;
  readonly core: (input: CoreInput) => Result<RuleOutcome<OperationDecision>>;
  readonly closure: (input: ClosureInput) => Result<RuleOutcome<ClosureDecision>>;
  readonly variables: VariableRules;
  readonly constraints: ConstraintSchemes<State>;
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
  readonly captures: readonly CaptureRow[];
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
  | "no-open-in-solution" | "check-recorded" | "flow-check-agreement" | "operation-types" | "decision-kind"
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

export interface InferenceBindingInput {
  readonly group: InferenceGroup;
  readonly constraints: readonly ConstraintSet[];
  readonly solution: Solution | null;
}

export interface InferenceNativeFacts {
  readonly carrierHolding: readonly NativeCarrierHolding[];
  readonly arrayExtents: readonly NativeArrayExtent[];
  readonly arrayConstruction: NativeArrayConstruction | null;
  readonly allocationFailure: "observable" | "abort";
  readonly arrayIndexFailure: CheckFailure;
  readonly fixedArrayIndexFailure: CheckFailure;
  readonly absentAccessFailure: CheckFailure;
  readonly destinationCheck: "before-value" | "after-value";
}

export interface InferVerificationInput extends InferenceBindingInput {
  readonly selectedNativeFacts: InferenceNativeFacts;
  readonly contributions: readonly AtomicContribution[];
  readonly types: TypeTable;
  readonly bindingScopes: readonly BindingScope[];
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly placedSignatureOf: (body: BodyId) => SigId | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeExists: (node: SourceNodeRef) => boolean;
  readonly localExists: (local: LocalRef) => boolean;
  readonly readySourceField: (occurrence: NodeRef) => SourceObjectField | null;
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
export type InferenceBindingSites = (input: InferenceBindingInput) =>
  readonly { readonly site: InferSite; readonly definition: DefId | null }[];
export type CompareContributionKeys = (left: ContributionKey, right: ContributionKey) => number;
export type CaptureRequiresLocation = (reassignable: boolean, incoming: CaptureSource) => boolean;
export type SameCaptureSource = (left: CaptureSource, right: CaptureSource) => boolean;
