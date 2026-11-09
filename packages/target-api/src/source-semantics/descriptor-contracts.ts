import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { SourceConstructionMemberHistory, SourceEvidenceDetails, SourceMemberInventory, SourceOriginSubjects } from "./member-inventory.js";
import type {
  SourceCallableContract, SourceParameterOmission, SourceIndexedAccess,
  SourceCategoryDomain, SourceComponentSelector, SourceDeclaredDescriptor, SourceConstructionDefinition,
  SourceDeferredProjection, SourceDescriptorView, SourcePresence, SourceReceiverOrigin, SourceResult, SourceSignatureIdentity,
  SourceSumApplication, SourceSumFamily, SourceTypeBinding, SourceTypeComponent,
  SourceTypeDescriptor, SourceTypeEvidence, SourceTypeParameter, SourceTypeParameterRequirement, SourceUseDestination,
} from "../public/source/contracts.js";

export interface SourceIndexedAccessTemplate {
  readonly component: SourceTypeComponent;
  readonly original: SourceInputComponent | undefined;
  readonly receiver: SourceTypeEvidence;
  readonly key: SourceTypeEvidence;
  readonly bindings: readonly SourceTypeBinding[];
}

export interface SourceIndexedAccessProduction {
  indexedAccess(template: SourceIndexedAccessTemplate, bindings: readonly SourceTypeBinding[]):
    SourceProductionResult<SourceIndexedAccess>;
}

export interface SourceSignatureParameterProduction {
  readonly declaration: Node | undefined;
  readonly kind: "required" | "optional" | "rest";
  readonly value: SourceTypeEvidence;
}

export interface SourceSignatureOmissionProduction {
  signatureOmissions(signature: SourceSignatureIdentity,
    parameters: readonly SourceSignatureParameterProduction[], bindings: readonly SourceTypeBinding[]):
    SourceProductionResult<readonly {
      readonly kind: "required" | "optional" | "rest";
      readonly omission: SourceParameterOmission;
    }[]>;
}

export interface SourceCallableContractProduction {
  callableContracts(value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]):
    SourceProductionResult<readonly SourceCallableContract[]>;
}

export interface SourceDescriptorProductionHooks extends SourceSignatureOmissionProduction {
  receiver(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceProducedReceiver>>;
  literalDomain(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain>;
  declaredValue(component: SourceInputComponent, declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  signatureRefusal(signature: SourceSignatureIdentity): Extract<SourceResult<never>, { readonly kind: "refused" }> | undefined;
  inheritedBindings(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]>;
}

export interface SourceProducedReceiver {
  readonly declaration: Node | undefined;
  readonly origin: SourceReceiverOrigin;
  readonly value: SourceTypeEvidence;
}

export interface SourceDescriptorReader {
  componentIdentity(component: SourceInputComponent): SourceTypeComponent;
  describeSyntax(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  describeComponent(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  describeMembers(component: SourceInputComponent, bindings: readonly SourceTypeBinding[], receiver?: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory>;
  inheritedBindings(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]>;
}

export interface SourceEvidenceComponent {
  readonly selector: SourceComponentSelector;
  readonly value: SourceTypeEvidence;
}

export interface SourceDescriptorBuilder extends SourceDescriptorView {
  originalSignature(value: SourceSignatureIdentity): SourceInputSignature;
  registerIndexedAccess(value: SourceTypeEvidence, template: SourceIndexedAccessTemplate): void;
  assertDestination(value: SourceUseDestination): void;
  primitive(primitive: SourcePrimitiveKind): SourceTypeDescriptor;
  string(): SourceTypeDescriptor;
  intrinsic(intrinsic: Extract<SourceTypeDescriptor, { readonly kind: "intrinsic" }>["intrinsic"]): SourceTypeDescriptor;
  parameter(declaration: Node, owner: Node, index: number,
    captures: readonly Node[],
    constraint: () => SourceResult<SourceTypeParameterRequirement>,
    defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter;
  optional(value: SourceTypeDescriptor): SourceTypeDescriptor;
  union(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor;
  intersection(component: SourceTypeComponent, parts: readonly SourceTypeEvidence[],
    result: SourceTypeEvidence, original: SourceInputComponent | undefined): SourceTypeEvidence;
  array(element: SourceTypeDescriptor, isReadonly: boolean): SourceTypeDescriptor;
  tuple(elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"], isReadonly: boolean): SourceTypeDescriptor;
  shape(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "shape" }>, "kind">): SourceTypeDescriptor;
  callable(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "callable" }>, "kind">): SourceTypeDescriptor;
  declared(value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor;
  constructionDefinition(occurrence: Node, captures: readonly Node[]): SourceConstructionDefinition;
  constructionReference(definition: SourceConstructionDefinition, arguments_: readonly SourceTypeDescriptor[]): Extract<SourceTypeDescriptor, { readonly kind: "construction-reference" }>;
  projection(source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor;
  componentIdentity(root: Node, path: readonly SourceComponentSelector[]): SourceTypeComponent;
  evidence(value: SourceTypeEvidence, components: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: SourceLiteralDomain, details: SourceEvidenceDetails): SourceTypeEvidence;
  members(value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory>;
  construction(occurrence: Node): SourceProductionResult<SourceMemberInventory>;
  constructionHistory(occurrence: Node): SourceProductionResult<SourceConstructionMemberHistory>;
  registerConstruction(occurrence: Node, produce: () => SourceProductionResult<SourceConstructionMemberHistory>): void;
  sourceOriginSubjects(value: SourceTypeEvidence): SourceOriginSubjects;
  produceDefinition(value: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence>;
  domain(value: SourceTypeEvidence): SourceLiteralDomain;
  /** Calls the sole publishFamily producer, then wraps its application in exact component/category/domain evidence. */
  join(component: SourceTypeComponent, origin: "authored" | "inferred", roles: readonly SourceTypeEvidence[], original: SourceInputComponent | undefined): SourceResult<SourceTypeEvidence>;
  originalComponent(value: SourceTypeEvidence): SourcePresence<SourceInputComponent>;
  signature(owner: Node | undefined, kind: "call" | "construct", original: SourceInputSignature, declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity;
  define(identity: { readonly kind: "declaration"; readonly declaration: Node; readonly facet: "instance" | "value" }
    | { readonly kind: "construction"; readonly definition: SourceConstructionDefinition }, parameters: readonly Node[],
    definition: () => SourceProductionResult<SourceTypeEvidence>, members: () => SourceProductionResult<SourceMemberInventory>): void;
  publishFamily(component: SourceTypeComponent, origin: "authored" | "inferred", parameters: readonly Node[], roles: readonly SourceTypeEvidence[]): SourceSumFamily;
  applyFamily(family: SourceSumFamily, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication>;
  substituteCategory(category: SourceCategoryDomain, bindings: readonly SourceTypeBinding[]): SourceCategoryDomain;
  seal(): SourceDescriptorView;
}
