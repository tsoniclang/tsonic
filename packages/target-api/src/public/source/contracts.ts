import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceLiteralUnit } from "../../source-model/literals/domain.js";
export type { SourcePropertyName } from "../../source-model/property-names.js";

export interface SourceRefusal {
  readonly kind: "refused";
  readonly source: "tsonic";
  readonly code: string;
  readonly message: string;
  readonly site: Node;
  readonly related?: Node;
}

export type SourceResult<Value> =
  | { readonly kind: "resolved"; readonly value: Value }
  | SourceRefusal;

export type SourcePresence<Value> =
  | { readonly kind: "none" }
  | { readonly kind: "present"; readonly value: Value };

export interface SourceAdmissionFacts {
  form(original: Node): SourceResult<{ readonly kind: "supported" }>;
}

export type SourceCategory =
  | "number" | "bigint" | "string" | "boolean" | "symbol"
  | "object" | "function" | "absence";

export type SourceCategoryDomain =
  | { readonly kind: "known"; readonly category: SourceCategory }
  | { readonly kind: "parameter"; readonly declaration: Node }
  | { readonly kind: "choice"; readonly alternatives: readonly SourceCategoryDomain[] }
  | { readonly kind: "dynamic" };

export interface SourceSignatureIdentity {
  readonly owner: Node;
  readonly kind: "call" | "construct";
  readonly declaration?: Node;
  readonly typeParameters: readonly Node[];
}

export type SourceMemberOrigin =
  | { readonly kind: "declared"; readonly declaration: Node }
  | { readonly kind: "class-prototype"; readonly owner: Node }
  | { readonly kind: "mapped"; readonly owner: Node; readonly key: SourceMemberKey };

export type SourceMemberKey =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: Extract<SourceLiteralUnit, { readonly kind: "number" }>["value"] }
  | { readonly kind: "unique-symbol"; readonly declaration: Node };

export interface SourceTypeDescriptorMember {
  readonly name: string;
  readonly origin: SourceMemberOrigin;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly type: SourceTypeDescriptor;
}

export interface SourceTypeDescriptorSignature {
  readonly identity: SourceSignatureIdentity;
  readonly receiver?: { readonly declaration?: Node; readonly type: SourceTypeDescriptor };
  readonly parameters: readonly {
    readonly declaration?: Node;
    readonly kind: "required" | "optional" | "rest";
    readonly type: SourceTypeDescriptor;
  }[];
  readonly result: SourceTypeDescriptor;
}

export interface SourceTypeDescriptorIndex {
  readonly declaration: Node;
  readonly key: SourceTypeDescriptor;
  readonly value: SourceTypeDescriptor;
  readonly readonly: boolean;
}

export interface SourceDeclaredDescriptor {
  readonly kind: "declared";
  readonly declaration: Node;
  readonly typeArguments: readonly SourceTypeDescriptor[];
  readonly extent?: { readonly length: bigint; readonly runtimeBase: "number" | "bigint" };
}

export interface SourceParameterDescriptor {
  readonly kind: "parameter";
  readonly declaration: Node;
}

export interface SourceTypeParameter {
  readonly declaration: Node;
  readonly owner: Node;
  readonly index: number;
  readonly type: SourceParameterDescriptor;
}

export type SourceTypeParameterRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "type"; readonly value: SourceTypeEvidence };

export type SourceTypeDescriptor =
  | { readonly kind: "primitive"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "string" }
  | { readonly kind: "intrinsic"; readonly intrinsic: "any" | "unknown" | "object" | "void" | "never" | "absence" | "bigint" | "symbol" }
  | { readonly kind: "union"; readonly types: readonly SourceTypeDescriptor[] }
  | { readonly kind: "optional"; readonly value: SourceTypeDescriptor }
  | { readonly kind: "array"; readonly readonly: boolean; readonly element: SourceTypeDescriptor }
  | { readonly kind: "tuple"; readonly readonly: boolean; readonly elements: readonly { readonly kind: "required" | "optional" | "rest"; readonly declaration?: Node; readonly type: SourceTypeDescriptor }[] }
  | { readonly kind: "shape"; readonly members: readonly SourceTypeDescriptorMember[]; readonly indexes: readonly SourceTypeDescriptorIndex[]; readonly calls: readonly SourceTypeDescriptorSignature[]; readonly constructs: readonly SourceTypeDescriptorSignature[] }
  | { readonly kind: "callable"; readonly calls: readonly SourceTypeDescriptorSignature[]; readonly constructs: readonly SourceTypeDescriptorSignature[] }
  | SourceDeclaredDescriptor
  | SourceParameterDescriptor
  | { readonly kind: "projection"; readonly source: SourceTypeDescriptor; readonly projection: SourceDeferredProjection };

export type SourceDeferredProjection =
  | { readonly kind: "awaited" }
  | { readonly kind: "component"; readonly component: SourceTypeComponent };

export type SourceComponentSelector =
  | { readonly kind: "optional-value" }
  | { readonly kind: "array-element" }
  | { readonly kind: "tuple-element"; readonly index: number }
  | { readonly kind: "union-member" | "argument-place" | "parameter-place"; readonly index: number }
  | { readonly kind: "argument-tail" | "parameter-tail"; readonly start: number }
  | { readonly kind: "member"; readonly origin: SourceMemberOrigin }
  | { readonly kind: "index-key" | "index-value"; readonly declaration: Node }
  | { readonly kind: "projection-source" }
  | { readonly kind: "parameter"; readonly signature: SourceSignatureIdentity; readonly index: number }
  | { readonly kind: "receiver"; readonly signature: SourceSignatureIdentity }
  | { readonly kind: "signature-tail"; readonly signature: SourceSignatureIdentity; readonly start: number; readonly readonly: boolean }
  | { readonly kind: "tuple-slice"; readonly start: number; readonly endCount: number; readonly readonly: boolean }
  | { readonly kind: "result"; readonly signature: SourceSignatureIdentity }
  | { readonly kind: "type-argument"; readonly declaration: Node; readonly index: number }
  | { readonly kind: "sum-arm"; readonly family: SourceSumFamily; readonly index: number }
  | { readonly kind: "awaited" };

export interface SourceTypeComponent {
  readonly root: Node;
  readonly path: readonly SourceComponentSelector[];
}

export interface SourceTypeBinding {
  readonly declaration: Node;
  readonly value: SourceTypeEvidence;
}

export interface SourceNumericOrigin {
  readonly producer: Node;
  readonly category: SourceCategoryDomain;
  readonly kind: "literal" | "declared" | "operation" | "application";
}

export interface SourceTypeEvidence {
  readonly type: SourceTypeDescriptor;
  readonly component: SourceTypeComponent;
  readonly category: SourceCategoryDomain;
  readonly numeric: SourceNumericOrigin | undefined;
  readonly sum: SourceSumApplication | undefined;
}

export interface SourceSumFamily {
  readonly origin: "authored" | "inferred";
  readonly component: SourceTypeComponent;
  readonly parameters: readonly Node[];
  readonly roles: readonly SourceSumRole[];
}

export interface SourceSumRole {
  readonly index: number;
  readonly component: SourceTypeComponent;
  readonly template: SourceTypeEvidence;
}

export interface SourceSumApplication {
  readonly kind: "open" | "closed";
  readonly freeParameters: readonly SourceTypeParameter[];
  readonly family: SourceSumFamily;
  readonly bindings: readonly SourceTypeBinding[];
  readonly arms: readonly SourceTypeEvidence[];
  readonly roles: readonly {
    readonly role: SourceSumRole;
    readonly value: SourceTypeEvidence;
    readonly armIndexes: readonly number[];
  }[];
}

export interface SourceDeclaredSlot {
  readonly origin:
    | { readonly kind: "declaration"; readonly declaration: Node }
    | { readonly kind: "parameter"; readonly signature: SourceSignatureIdentity; readonly index: number; readonly declaration?: Node }
    | { readonly kind: "receiver"; readonly signature: SourceSignatureIdentity; readonly declaration?: Node };
  readonly type: SourceTypeEvidence;
}

export interface SourceUseDestination {
  readonly declaration: SourceDeclaredSlot;
  readonly applied: SourceTypeEvidence;
  readonly application: SourceUseApplication | undefined;
}

export type SourceUseApplication =
  | { readonly kind: "call"; readonly identity: SourceApplicationIdentity }
  | { readonly kind: "receiver"; readonly receiver: SourceTypeEvidence; readonly bindings: readonly SourceTypeBinding[] };

export interface SourceApplicationIdentity {
  readonly invocation: Node;
  readonly signature: SourceSignatureIdentity;
  readonly classBindings: readonly SourceTypeBinding[];
  readonly signatureBindings: readonly SourceTypeBinding[];
}

export type SourceApplicationReceiver =
  | { readonly kind: "none" }
  | { readonly kind: "type"; readonly declaration: Node }
  | { readonly kind: "value"; readonly occurrence: Node; readonly value: SourceTypeEvidence };

export interface SourceApplication {
  readonly identity: SourceApplicationIdentity;
  readonly kind: "call" | "construct" | "function-value";
  readonly callee: SourceValueOperand;
  readonly receiver: SourceApplicationReceiver;
  /** Authored evaluation order, including empty spreads. Emit each operand once from this vector only. */
  readonly sourceArguments: readonly SourceAuthoredArgument[];
  /** Parameter bindings only; sourceArgumentIndex joins each binding to its authored evaluation. */
  readonly arguments: readonly SourceArgumentPlace[];
  readonly result: SourceTypeEvidence;
}

export interface SourceAuthoredArgument {
  readonly occurrence: Node;
  readonly form: "value" | "spread";
  readonly operand: SourceValueOperand;
}

export interface SourceArgumentPlace {
  readonly sourceArgument: Node;
  readonly sourceArgumentIndex: number;
  readonly effectiveArgument: Node;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex: number | undefined;
  readonly parameter: {
    readonly signature: SourceSignatureIdentity;
    readonly index: number;
    readonly declaration?: Node;
    readonly form: "parameter" | "rest-element" | "rest-sequence";
  };
  readonly source: SourceTypeEvidence;
  readonly destination: SourceUseDestination;
}

export interface SourceValueOperand {
  readonly occurrence: Node;
  readonly value: SourceTypeEvidence;
}

/**
 * Evaluate control once. Native obeys disposition and skips only the unselected branch.
 * Conditional uses true/false; and/or/coalesce use left/right. Native never re-derives it.
 * A present-left coalesce remains refused until the maintainer's Q1 admission ruling.
 */
export type SourceValueSelection = {
  readonly occurrence: Node;
  readonly result: SourceTypeEvidence;
} & (
  | { readonly kind: "conditional"; readonly disposition: "true" | "false" | "dynamic"; readonly control: SourceValueOperand; readonly whenTrue: SourceValueOperand; readonly whenFalse: SourceValueOperand }
  | { readonly kind: "and"; readonly disposition: "left" | "right" | "dynamic"; readonly control: SourceValueOperand; readonly whenTrue: SourceValueOperand; readonly whenFalse: "control-false" }
  | { readonly kind: "or"; readonly disposition: "left" | "right" | "dynamic"; readonly control: SourceValueOperand; readonly whenTrue: "control-true"; readonly whenFalse: SourceValueOperand }
  | { readonly kind: "coalesce"; readonly disposition: "left" | "right" | "dynamic"; readonly control: SourceValueOperand; readonly whenPresent: SourceTypeEvidence; readonly whenAbsent: SourceValueOperand }
  | { readonly kind: "await"; readonly operand: SourceValueOperand; readonly completion: SourceTypeEvidence }
);

export interface SourcePrimitiveOperation {
  readonly occurrence: Node;
  readonly kind: "unary" | "binary";
  readonly operator: SourcePrimitiveOperator;
  readonly operands: readonly SourceValueOperand[];
  readonly result: SourceTypeEvidence;
}

export type SourcePrimitiveOperator =
  | "add" | "subtract" | "multiply" | "divide" | "remainder" | "power"
  | "bit-and" | "bit-or" | "bit-xor" | "shift-left" | "shift-right" | "shift-right-unsigned"
  | "negate" | "positive" | "bit-not" | "logical-not"
  | "less" | "less-equal" | "greater" | "greater-equal" | "equal" | "not-equal" | "equal-strict" | "not-equal-strict";

export type SourceStorageOperation = {
  readonly occurrence: Node;
  readonly result: SourceTypeEvidence;
} & (
  | { readonly kind: "assignment"; readonly target: Node; readonly source: SourceValueOperand; readonly destination: SourceUseDestination }
  | { readonly kind: "compound"; readonly operator: SourcePrimitiveOperator; readonly target: Node;
      readonly operands: readonly [SourceValueOperand, SourceValueOperand]; readonly destination: SourceUseDestination;
      readonly calculation: SourceTypeEvidence }
  | { readonly kind: "update"; readonly operator: "increment" | "decrement"; readonly form: "prefix" | "postfix";
      readonly operand: SourceValueOperand; readonly destination: SourceUseDestination }
  | { readonly kind: "sequence"; readonly operands: readonly SourceValueOperand[] }
  | { readonly kind: "in" | "instanceof"; readonly left: SourceValueOperand; readonly right: SourceValueOperand }
);

export type SourceOperation = SourceValueSelection | SourcePrimitiveOperation | SourceStorageOperation;

export interface SourceConstruction {
  readonly occurrence: Node;
  readonly kind: "array" | "object";
  readonly value: SourceTypeEvidence;
  readonly evaluation: readonly {
    readonly occurrence: Node;
    readonly form: "value" | "spread" | "key";
    readonly value: SourceTypeEvidence;
  }[];
}

export interface SourceValueFacts {
  /** Complete original-order value/refusal domain. Declaration and type-name nodes are not value occurrences. */
  occurrences(): readonly Node[];
  type(occurrence: Node): SourceResult<SourceTypeEvidence>;
  contextual(occurrence: Node): SourceResult<SourcePresence<SourceTypeEvidence>>;
  declaredSlot(declaration: Node): SourceResult<SourceDeclaredSlot>;
  destination(occurrence: Node): SourceResult<SourcePresence<SourceUseDestination>>;
  operation(occurrence: Node): SourceResult<SourceOperation>;
  construction(occurrence: Node): SourceResult<SourcePresence<SourceConstruction>>;
  callableReturn(signature: SourceSignatureIdentity): SourceResult<SourceTypeEvidence>;
}

export interface SourceApplicationFacts {
  application(occurrence: Node): SourceResult<SourceApplication>;
}

export interface SourceEnumMember {
  readonly declaration: Node;
  readonly owner: Node;
  readonly value: SourceTypeEvidence;
  readonly constant: bigint | string;
}

export interface SourceEnumDeclaration {
  readonly declaration: Node;
  readonly underlying: SourceTypeEvidence;
  readonly members: readonly SourceEnumMember[];
}

export interface SourceEnumFacts {
  declaration(declaration: Node): SourceResult<SourceEnumDeclaration>;
  member(declaration: Node): SourceResult<SourceEnumMember>;
}

export interface SourceDescriptorView {
  assertEvidence(value: SourceTypeEvidence): void;
  assertDescriptor(value: SourceTypeDescriptor): void;
  scalarLiteral(value: SourceTypeEvidence): SourcePresence<SourceLiteralUnit>;
  component(value: SourceTypeEvidence, selector: SourceComponentSelector): SourceResult<SourceTypeEvidence>;
  substitute(value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceResult<SourceTypeEvidence>;
  definition(value: SourceTypeEvidence): SourceResult<SourceTypeEvidence>;
  freeParameters(value: SourceTypeEvidence): readonly SourceTypeParameter[];
  typeParameter(declaration: Node): SourceTypeParameter;
  constraint(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
  defaultType(parameter: SourceTypeParameter): SourceResult<SourceTypeParameterRequirement>;
}

export type SourceCallableRole = "signature" | "body" | "execution" | "deferred";

export interface SourceCallableRoles {
  readonly signature: boolean;
  readonly body: boolean;
  readonly execution: boolean;
  readonly deferred: boolean;
}

export interface SourceNavigationFacts {
  callableRoles(node: Node): SourceCallableRoles;
  enclosing(node: Node | undefined, role: SourceCallableRole): Node | undefined;
}
