import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import type { ResolvedSourceCallInfo } from "../call-result-selection.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceProgramSemantics, SourceTypeComponentEvidence } from "../types.js";

export type SourceTypeDescriptor =
  | { readonly kind: "primitive"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "string" }
  | { readonly kind: "intrinsic"; readonly intrinsic: "any" | "unknown" | "object" | "void" | "never" | "absence" | "bigint" | "symbol" }
  | { readonly kind: "union"; readonly types: readonly SourceTypeDescriptor[] }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: SourceTypeDescriptor }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly [SourceTypeDescriptor, SourceTypeDescriptor] }
  | { readonly kind: "shape"; readonly members: readonly SourceTypeDescriptorMember[]; readonly indexes: readonly SourceTypeDescriptorIndex[] }
  | { readonly kind: "callable"; readonly calls: readonly SourceTypeDescriptorSignature[]; readonly constructs: readonly SourceTypeDescriptorSignature[] }
  | {
      readonly kind: "declared";
      readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeDescriptor[];
      readonly source?: SourceTypeComponentEvidence;
      readonly members?: readonly SourceTypeDescriptorMember[];
      readonly indexes: readonly SourceTypeDescriptorIndex[];
      readonly definition?: SourceTypeDescriptor;
    }
  | { readonly kind: "optional"; readonly value: SourceTypeDescriptor };

export interface SourceTypeDescriptorSignature {
  readonly declaration?: Node;
  readonly typeParameters: readonly Node[];
  readonly parameters: readonly {
    readonly declaration?: Node;
    readonly kind: "required" | "optional" | "rest";
    readonly type: SourceTypeDescriptor;
  }[];
  readonly result: SourceTypeDescriptor;
}

export interface SourceTypeDescriptorMember {
  readonly name: string;
  readonly optional: boolean;
  readonly type: SourceTypeDescriptor;
  readonly declaration?: Node;
  readonly readonly?: boolean;
}

export interface SourceTypeDescriptorIndex {
  readonly declaration: Node;
  readonly key: SourceTypeDescriptor;
  readonly value: SourceTypeDescriptor;
  readonly readonly: boolean;
}

export type SourceTypeFlowRefusalCode =
  | "TSONIC_LOCAL_TYPE_CONFLICT"
  | "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS"
  | "TSONIC_LOCAL_TYPE_SIGNATURE"
  | "TSONIC_UNTYPED_OBJECT_LITERAL"
  | "TSONIC_UNTYPED_ARRAY_LITERAL"
  | "TSONIC_LOCAL_TYPE_ACCUMULATOR"
  | "TSONIC_LOCAL_TYPE_UNION"
  | "TSONIC_LOCAL_TYPE_SELF_REFERENCE"
  | "TSONIC_LOCAL_TYPE_ADDRESS"
  | "TSONIC_LOCAL_TYPE_LIMIT"
  | "TSONIC_LOCAL_TYPE_GENERIC"
  | "TSONIC_LOCAL_TYPE_UNSUPPORTED";

export interface SourceTypeFlowRefusal {
  readonly kind: "refused";
  readonly source: "tsonic";
  readonly code: SourceTypeFlowRefusalCode;
  readonly site: Node;
  readonly related?: Node;
  readonly reason: string;
}

export interface SourceEffectiveTypeProvenance {
  readonly group: Node;
  readonly occurrence: Node;
  readonly sourceFile: SourceFile;
  readonly filledBy?: Node;
  readonly component?: SourceTypeComponentEvidence;
  readonly fixedRule?: SourceTypeFlowFixedRule;
}

export type SourceTypeFlowFixedRule = {
  readonly kind: "loop-counter";
  readonly declaration: Node;
};

export type SourceEffectiveTypeOutcome =
  | {
      readonly kind: "resolved" | "default";
      readonly type: SourceTypeDescriptor;
      readonly provenance: SourceEffectiveTypeProvenance;
    }
  | SourceTypeFlowRefusal;

export interface SourceTypeFlowAssociation {
  readonly occurrence: Node;
  readonly sourceFile: SourceFile;
  readonly component?: SourceTypeComponentEvidence;
  readonly call?: ResolvedSourceCallInfo;
  readonly binding?: ResolvedSourceCallInfo["sourceArgumentBindings"][number];
  readonly parameter?: ResolvedSourceCallInfo["sourceSelectedSignatureParameters"][number];
}

export type SourceTypeFlowObligationKind =
  | "interface"
  | "read-only"
  | "constraint"
  | "literal-admission"
  | "write-fit";

export interface SourceTypeFlowObligation {
  readonly kind: SourceTypeFlowObligationKind;
  readonly site: Node;
  readonly type: SourceTypeDescriptor;
  readonly required: Node;
  readonly requiredType?: SourceTypeDescriptor;
  readonly value?: Node;
  readonly valueType?: SourceTypeDescriptor;
  readonly valueVariable?: SourceTypeFlowVariable;
  readonly association?: SourceTypeFlowAssociation;
}

export interface SourceEffectiveTypeArgument {
  readonly declaration: Node;
  readonly type: SourceTypeDescriptor;
}

export interface SourceEffectiveCallInstantiation {
  readonly call: ResolvedSourceCallInfo;
  readonly receiver: readonly SourceEffectiveTypeArgument[];
  readonly method: readonly SourceEffectiveTypeArgument[];
  readonly result?: SourceTypeDescriptor;
}

export interface SourceEffectiveTypes {
  get(node: Node): SourceEffectiveTypeOutcome | undefined;
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
  readonly semantics: SourceProgramSemantics;
}

export interface SourceTypeFlowOrder {
  readonly start: number;
  readonly preorder: number;
}

export interface SourceTypeFlowAnalysisContext {
  readonly source: SourceTypeFlowSource;
  describe(node: Node, component?: SourceTypeComponentEvidence,
    arguments_?: readonly SourceEffectiveTypeArgument[]): SourceTypeDescriptor | undefined;
  literal(node: Node): SourceLiteralValue | undefined;
  order(node: Node): SourceTypeFlowOrder;
}

export type SourceTypeFlowPathPart =
  | { readonly kind: "element" }
  | { readonly kind: "optional-value" }
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "tuple"; readonly index: 0 | 1 }
  | { readonly kind: "binder"; readonly declaration: Node };

export interface SourceTypeFlowVariable {
  readonly node: Node;
  readonly path: readonly SourceTypeFlowPathPart[];
}

export type SourceTypeFlowTerm =
  | { readonly kind: "numeric"; readonly site: Node; readonly form: "integer" | "fractional"; readonly literal: SourceLiteralValue }
  | { readonly kind: "fixed"; readonly site: Node; readonly type: SourceTypeDescriptor }
  | { readonly kind: "array"; readonly site: Node; readonly element: SourceTypeFlowVariable; readonly readonly: boolean }
  | { readonly kind: "optional"; readonly site: Node; readonly value: SourceTypeFlowVariable; readonly source: SourceTypeComponentEvidence }
  | { readonly kind: "tuple"; readonly site: Node; readonly elements: readonly [SourceTypeFlowVariable, SourceTypeFlowVariable]; readonly readonly: boolean }
  | {
      readonly kind: "declared";
      readonly site: Node;
      readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeFlowVariable[];
      readonly source?: SourceTypeComponentEvidence;
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
  | "add" | "subtract" | "multiply" | "divide" | "remainder"
  | "bit-and" | "bit-or" | "bit-xor" | "shift-left" | "shift-right" | "shift-right-unsigned"
  | "negate" | "positive" | "bit-not" | "logical-not"
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
  readonly constraint?: SourceTypeComponentEvidence;
}

export interface SourceTypeFlowCall {
  readonly node: Node;
  readonly source: ResolvedSourceCallInfo;
  readonly receiver: readonly SourceTypeFlowBinder[];
  readonly method: readonly SourceTypeFlowBinder[];
  readonly argumentPlaces: readonly SourceTypeFlowArgumentPlace[];
  readonly result?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowArgumentPlace {
  readonly binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number];
  readonly parameter: ResolvedSourceCallInfo["sourceSelectedSignatureParameters"][number];
  readonly binder: Node;
  readonly value: SourceTypeFlowVariable;
}

export interface SourceTypeFlowGraph {
  readonly roots: readonly Node[];
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly links: readonly SourceTypeFlowLink[];
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
  | { readonly kind: "fill"; readonly type: SourceTypeDescriptor }
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
