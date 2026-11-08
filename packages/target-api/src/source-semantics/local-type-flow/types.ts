import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../../host-input/descriptor-input.js";
import type { SourceInputCallSelection } from "../../host-input/call-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceLiteralKey } from "../../source-model/literals/key.js";
import type { SourceJsApiFacts } from "../../target-analysis/source-profile.js";
import type { SourceMemberCorrespondenceProduction } from "../member-correspondence.js";
import type { SourceMemberUse } from "../member-use.js";
import type { SourceApplication, SourceDeclaredSlot, SourceOperation, SourcePresence, SourcePrimitiveOperator,
  SourceRefusal, SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder, SourceDescriptorProductionHooks, SourceDescriptorReader, SourceProductionResult } from "../descriptor-contracts.js";

export interface SourceTypeFlowSource {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly navigation: SourceNodeNavigationFacts;
  readonly input: SourceDescriptorInput;
  readonly descriptorBuilder: SourceDescriptorBuilder;
  readonly profile: SourcePresence<SourceJsApiFacts>;
  createObjects(queries: Pick<SourceTypeFlowAnalysisContext, "reader" | "place" | "value" | "destination"> & {
    literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
    syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  }): SourceObjectProduction;
  createDescriptorReader(hooks: SourceDescriptorProductionHooks): SourceDescriptorReader;
  createPropertyNameQuery(queries: {
    literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
    syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  }): (node: Node) => SourceProductionResult<SourceLiteralKey>;
}

export interface SourceObjectProduction extends SourceMemberCorrespondenceProduction {
  use(occurrence: Node): SourceProductionResult<SourceMemberUse>;
}

export interface SourceTypeFlowOrder {
  readonly start: number;
  readonly preorder: number;
}

export interface SourceTypeFlowAnalysisContext {
  readonly source: SourceTypeFlowSource;
  readonly reader: SourceDescriptorReader;
  readonly objects: SourceObjectProduction;
  readonly nodes: readonly Node[];
  readonly values: readonly Node[];
  literal(node: Node): SourceLiteralValue | undefined;
  order(node: Node): SourceTypeFlowOrder;
  declared(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceDeclaredSlot>;
  value(occurrence: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  destination(occurrence: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceUseDestination>>;
  application(occurrence: Node): SourceProductionResult<SourceApplication>;
  operation(occurrence: Node): SourceProductionResult<SourceOperation>;
  callableReturn(signature: SourceSignatureIdentity, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  propertyName(node: Node): SourceProductionResult<SourceLiteralKey>;
}

export type SourceTypeFlowRefusalCode =
  | "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE" | "TSONIC_LOCAL_TYPE_CONFLICT" | "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS"
  | "TSONIC_LOCAL_TYPE_SIGNATURE" | "TSONIC_UNTYPED_OBJECT_LITERAL" | "TSONIC_UNTYPED_ARRAY_LITERAL"
  | "TSONIC_LOCAL_TYPE_ACCUMULATOR" | "TSONIC_LOCAL_TYPE_UNION" | "TSONIC_LOCAL_TYPE_SELF_REFERENCE"
  | "TSONIC_LOCAL_TYPE_ADDRESS" | "TSONIC_LOCAL_TYPE_LIMIT" | "TSONIC_LOCAL_TYPE_GENERIC" | "TSONIC_LOCAL_TYPE_UNSUPPORTED";

export type SourceTypeFlowPathPart =
  | { readonly kind: "element" }
  | { readonly kind: "optional-value" }
  | { readonly kind: "member"; readonly name: string }
  | { readonly kind: "tuple"; readonly index: number }
  | { readonly kind: "binder"; readonly declaration: Node };

export interface SourceTypeFlowVariable {
  readonly node: Node;
  readonly path: readonly SourceTypeFlowPathPart[];
}

export type SourceTypeFlowTerm =
  | { readonly kind: "numeric"; readonly site: Node; readonly form: "integer" | "fractional"; readonly literal: SourceLiteralValue }
  | { readonly kind: "fixed"; readonly site: Node; readonly value: SourceTypeEvidence }
  | { readonly kind: "original"; readonly site: Node; readonly component: SourceInputComponent }
  | { readonly kind: "template"; readonly site: Node; readonly value: SourceTypeEvidence;
      readonly bindings: readonly { readonly declaration: Node; readonly variable: SourceTypeFlowVariable }[] }
  | { readonly kind: "array"; readonly site: Node; readonly element: SourceTypeFlowVariable; readonly readonly: boolean }
  | { readonly kind: "optional"; readonly site: Node; readonly value: SourceTypeFlowVariable; readonly source: SourceInputComponent }
  | { readonly kind: "tuple"; readonly site: Node; readonly elements: readonly {
      readonly kind: "required" | "optional" | "rest"; readonly variable: SourceTypeFlowVariable; readonly declaration?: Node;
    }[]; readonly readonly: boolean }
  | { readonly kind: "declared"; readonly site: Node; readonly declaration: Node;
      readonly typeArguments: readonly SourceTypeFlowVariable[]; readonly source?: SourceInputComponent }
  | { readonly kind: "shape"; readonly site: Node; readonly members: readonly SourceTypeFlowMember[] };

export interface SourceTypeFlowMember {
  readonly name: string;
  readonly optional: boolean;
  readonly variable: SourceTypeFlowVariable;
  readonly declaration: Node;
  readonly readonly: boolean;
}

export interface SourceTypeFlowNode {
  readonly node: Node;
  readonly root: Node;
  readonly variable: SourceTypeFlowVariable;
  readonly kind: "open-local" | "value" | "read" | "parameter" | "binder" | "derived-local" | "fixed";
  readonly publish: boolean;
  readonly declaration?: Node;
  readonly initializer?: Node;
  readonly term?: SourceTypeFlowTerm;
  readonly declaredType?: SourceTypeEvidence;
  readonly declaredSlotRefusal?: SourceRefusal;
}

export interface SourceTypeFlowLink {
  readonly source: SourceTypeFlowVariable;
  readonly target: SourceTypeFlowVariable;
  readonly site: Node;
}

export interface SourceTypeFlowProducerInput extends SourceTypeFlowLink {
  readonly purpose: "value" | "inference";
}

export type SourceTypeFlowOperator = SourcePrimitiveOperator
  | "identity" | "await" | "sequence" | "conditional" | "logical-and" | "logical-or" | "coalesce"
  | "assignment" | "increment" | "decrement" | "in" | "instanceof";

export interface SourceTypeFlowDerived {
  readonly node: Node;
  readonly result: SourceTypeFlowVariable;
  readonly operator: SourceTypeFlowOperator;
  readonly operands: readonly SourceTypeFlowVariable[];
  readonly control?: SourceTypeFlowVariable;
  readonly required: boolean;
  readonly accumulator?: SourceTypeFlowVariable;
}

export interface SourceTypeFlowCall {
  readonly node: Node;
  readonly selection: SourceInputCallSelection;
  readonly result: SourceTypeFlowVariable;
}

export interface SourceTypeFlowGraph {
  readonly roots: readonly Node[];
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly links: readonly SourceTypeFlowLink[];
  readonly producerInputs: readonly SourceTypeFlowProducerInput[];
  readonly derived: readonly SourceTypeFlowDerived[];
  readonly calls: readonly SourceTypeFlowCall[];
  readonly refusals: readonly SourceRefusal[];
}

export type SourceTypeFlowUse = {
  readonly site: Node;
  readonly variable: SourceTypeFlowVariable;
} & (
  | { readonly kind: "fill"; readonly value: SourceTypeEvidence; readonly authority: "declared" | "inferred" }
  | { readonly kind: "write"; readonly value: Node; readonly required: Node; readonly valueVariable?: SourceTypeFlowVariable }
  | { readonly kind: "refused"; readonly refusal: SourceRefusal }
  | { readonly kind: "none" }
);

export interface SourceTypeFlowSignature {
  readonly site: Node;
  readonly owner: Node;
  readonly variable: SourceTypeFlowVariable;
}
