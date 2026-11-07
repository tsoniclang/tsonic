import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type {
  SourceHostArgumentBinding, SourceHostCall, SourceHostCallParameter, SourceHostComponent, SourceHostQueries, SourceHostType,
} from "../../host-input/queries.js";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourcePlatformFacts } from "../platform-model.js";
import type { SourceEnumIntegerWidthSelection } from "../enum-model.js";
import type {
  SourceTypeDescriptor, SourceTypeFlowRefusal, SourceEffectiveTypeOutcome, SourceEffectiveTypeArgument, SourceSumIdentity, SourceClosedSum, SourceMethodValueUse, SourceSlotAdmission, SourceTypeFlowPathPart,
} from "../descriptor-model.js";
// The descriptor vocabulary is defined in ../descriptor-model.ts (checker-free, I1) and re-exported for the value model.
export type {
  SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeDescriptorTupleElement, SourceLiteralMemberCorrespondence, SourceMemberKey, SourceTypeDescriptorMember, SourceTypeDescriptorLiteral, SourceTypeDescriptorIndex, SourceTypeFlowRefusalCode, SourceTypeFlowRefusal, SourceEffectiveTypeProvenance, SourceTypeFlowFixedRule, SourceEffectiveTypeOutcome, SourceEffectiveTypeArgument, SourceSumIdentity, SourceClosedSum, SourceMethodValueUse, SourceSlotAdmission, SourceTypeFlowPathPart,
} from "../descriptor-model.js";

export interface SourceTypeFlowAssociation {
  readonly occurrence: Node;
  readonly sourceFile: SourceFile;
  readonly component?: SourceHostComponent;
  readonly call?: SourceHostCall;
  readonly binding?: SourceHostArgumentBinding;
  readonly parameter?: SourceHostCallParameter;
}

export type SourceTypeFlowObligationKind =
  | "interface"
  | "read-only"
  | "constraint"
  | "literal-admission"
  | "write-fit";

interface SourceTypeFlowObligationBase {
  readonly site: Node;
  readonly type: SourceTypeDescriptor;
  readonly required: Node;
  readonly requiredType?: SourceTypeDescriptor;
  readonly value?: Node;
  readonly valueType?: SourceTypeDescriptor;
  readonly valueVariable?: SourceTypeFlowVariable;
  readonly association?: SourceTypeFlowAssociation;
}

export type SourceTypeFlowObligation = SourceTypeFlowObligationBase & (
  | { readonly kind: "literal-admission"; readonly authority: "inferred" | "declared" }
  | { readonly kind: Exclude<SourceTypeFlowObligationKind, "literal-admission"> }
);

export interface SourceEffectiveCallInstantiation {
  readonly call: SourceHostCall;
  readonly receiver: readonly SourceEffectiveTypeArgument[];
  readonly method: readonly SourceEffectiveTypeArgument[];
  readonly parameters: readonly (SourceTypeDescriptor | undefined)[];
  readonly result?: SourceTypeDescriptor;
}

export interface SourceDeclaredSlot {
  readonly slot: Node;
  readonly type: SourceTypeDescriptor;
  readonly broad: boolean;
}

export interface SourceEffectiveTypes {
  sum(identity: SourceSumIdentity): SourceClosedSum | undefined;
  get(node: Node): SourceEffectiveTypeOutcome | undefined;
  declaredSlot(slot: Node): SourceDeclaredSlot | undefined;
  methodValueUse(occurrence: Node): SourceMethodValueUse | undefined;
  slotAdmission(use: Node): SourceSlotAdmission | undefined;
  callableReturn(declaration: Node): SourceEffectiveTypeOutcome | undefined;
  callInstantiation(call: Node): SourceEffectiveCallInstantiation | undefined;
  obligations(): readonly SourceTypeFlowObligation[];
  refusals(): readonly SourceTypeFlowRefusal[];
}

export interface SourceTypeFlowSource {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  /** The active target's native integer premise (E24): read only for native-int / native-uint width decisions. */
  readonly platform: SourcePlatformFacts;
  /** The integer width of a numeric enum (enum-constants.ts, the one owner): an enum operand's integer primitive. */
  enumIntegerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
}

export interface SourceTypeFlowOrder {
  readonly start: number;
  readonly preorder: number;
}

export interface SourceTypeFlowInheritedBinding {
  readonly value: SourceTypeDescriptor;
  readonly authoredComponent?: SourceHostComponent;
}

export interface SourceTypeFlowAnalysisContext {
  readonly source: SourceTypeFlowSource;
  readonly unions: SourceTypeDescriptorUnions;
  /** The program checker adapter (I3): the only path from type flow to checker witnesses. */
  readonly input: SourceHostInput;
  describe(node: Node, component?: SourceHostComponent,
    arguments_?: readonly SourceEffectiveTypeArgument[]): SourceTypeDescriptor | undefined;
  authoredInheritedBindings(type: SourceHostType, queries: SourceHostQueries, bindings: ReadonlyMap<Node, SourceTypeDescriptor>):
    ReadonlyMap<Node, Required<SourceTypeFlowInheritedBinding>>;
  literal(node: Node): SourceLiteralValue | undefined;
  order(node: Node): SourceTypeFlowOrder;
}

export interface SourceTypeFlowVariable {
  readonly node: Node;
  readonly path: readonly SourceTypeFlowPathPart[];
}

export type SourceTypeFlowTerm =
  | { readonly kind: "numeric"; readonly site: Node; readonly form: "integer" | "fractional"; readonly literal: SourceLiteralValue }
  | { readonly kind: "fixed"; readonly site: Node; readonly type: SourceTypeDescriptor }
  | { readonly kind: "template"; readonly site: Node; readonly type: SourceTypeDescriptor;
      readonly bindings: readonly { readonly declaration: Node; readonly variable: SourceTypeFlowVariable }[] }
  | { readonly kind: "array"; readonly site: Node; readonly element: SourceTypeFlowVariable; readonly readonly: boolean }
  | { readonly kind: "optional"; readonly site: Node; readonly value: SourceTypeFlowVariable; readonly source: SourceHostComponent }
  | { readonly kind: "tuple"; readonly site: Node; readonly elements: readonly {
      readonly kind: "required" | "optional" | "rest";
      readonly variable: SourceTypeFlowVariable;
      readonly declaration?: Node;
    }[]; readonly readonly: boolean }
  | {
      readonly kind: "declared";
      readonly site: Node;
      readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeFlowVariable[];
      readonly source?: SourceHostComponent;
    }
  | { readonly kind: "shape"; readonly site: Node; readonly members: readonly SourceTypeFlowMember[] };

export interface SourceTypeFlowMember {
  readonly name: string;
  readonly optional: boolean;
  readonly variable: SourceTypeFlowVariable;
  readonly declaration?: Node;
  readonly readonly?: boolean;
}

export type SourceTypeFlowNodeKind =
  | "open-local"
  | "value"
  | "read"
  | "parameter"
  | "binder"
  | "derived-local"
  | "fixed";

export interface SourceTypeFlowNode {
  readonly node: Node;
  readonly root: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly kind: SourceTypeFlowNodeKind;
  readonly publish: boolean;
  readonly declaration?: Node;
  readonly initializer?: Node;
  readonly term?: SourceTypeFlowTerm;
  readonly association?: SourceTypeFlowAssociation;
  readonly declaredType?: SourceTypeDescriptor;
  readonly declaredSlotRefusal?: SourceTypeFlowRefusal;
}

export interface SourceTypeFlowLink {
  readonly source: SourceTypeFlowVariable;
  readonly target: SourceTypeFlowVariable;
  readonly site: Node;
}

export type SourceTypeFlowOperator =
  | "add" | "subtract" | "multiply" | "divide" | "remainder" | "power"
  | "bit-and" | "bit-or" | "bit-xor" | "shift-left" | "shift-right" | "shift-right-unsigned"
  | "negate" | "positive" | "bit-not" | "logical-not"
  | "identity" | "await" | "sequence" | "conditional" | "logical-and" | "logical-or" | "coalesce"
  | "less" | "less-equal" | "greater" | "greater-equal" | "equal" | "not-equal";

export interface SourceTypeFlowDerived {
  readonly node: Node;
  readonly result: SourceTypeFlowVariable;
  readonly operator: SourceTypeFlowOperator;
  readonly operands: readonly SourceTypeFlowVariable[];
  readonly required: boolean;
  readonly accumulator?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowBinder {
  readonly declaration: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly constraint?: SourceHostComponent;
}

export interface SourceTypeFlowCall {
  readonly node: Node;
  readonly source: SourceHostCall;
  readonly receiver: readonly SourceTypeFlowBinder[];
  readonly method: readonly SourceTypeFlowBinder[];
  readonly argumentPlaces: readonly SourceTypeFlowArgumentPlace[];
  readonly result?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowArgumentPlace {
  readonly binding: SourceHostArgumentBinding;
  readonly parameter: SourceHostCallParameter;
  readonly binder: Node;
  readonly value: SourceTypeFlowVariable;
}

export interface SourceTypeFlowGraph {
  readonly roots: readonly Node[];
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly links: readonly SourceTypeFlowLink[];
  readonly inferenceInputs: readonly SourceTypeFlowLink[];
  readonly derived: readonly SourceTypeFlowDerived[];
  readonly calls: readonly SourceTypeFlowCall[];
  readonly refusals: readonly SourceTypeFlowRefusal[];
}

interface SourceTypeFlowUseBase {
  readonly site: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly association?: SourceTypeFlowAssociation;
}

export type SourceTypeFlowUse = SourceTypeFlowUseBase & (
  // authority: stated only when the fill comes from the value's own declared slot (C30); otherwise the solver derives it
  // from the fill's authored component.
  | { readonly kind: "fill"; readonly type: SourceTypeDescriptor; readonly authority?: "declared" }
  | {
      readonly kind: "check";
      readonly check: Exclude<SourceTypeFlowObligationKind, "write-fit" | "literal-admission">;
      readonly type: SourceTypeDescriptor;
      readonly required: Node;
    }
  | { readonly kind: "write"; readonly value: Node; readonly required: Node; readonly valueVariable?: SourceTypeFlowVariable }
  | { readonly kind: "refused"; readonly refusal: SourceTypeFlowRefusal }
  | { readonly kind: "none" }
);

export interface SourceTypeFlowSignature {
  readonly site: Node;
  readonly owner: Node;
  readonly variable: SourceTypeFlowVariable;
}

export type SourceTypeFlowUseCollector = (
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
) => readonly SourceTypeFlowUse[];

export type SourceTypeFlowEdgeCollector = (
  context: SourceTypeFlowAnalysisContext,
) => SourceTypeFlowGraph;

export type SourceTypeFlowSignatureCollector = (
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
  isInference: (variable: SourceTypeFlowVariable) => boolean,
) => readonly SourceTypeFlowSignature[];
