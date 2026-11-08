import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type {
  SourceCategoryDomain, SourceComponentSelector, SourceDeclaredDescriptor,
  SourceDeferredProjection, SourceDescriptorView, SourceResult, SourceSignatureIdentity,
  SourceSumApplication, SourceSumFamily, SourceTypeBinding, SourceTypeComponent,
  SourceTypeDescriptor, SourceTypeEvidence, SourceTypeParameter, SourceTypeParameterRequirement,
} from "../public/source/contracts.js";

export interface SourceDescriptorProductionHooks {
  declaredValue(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  signatureRefusal(signature: SourceSignatureIdentity): Extract<SourceResult<never>, { readonly kind: "refused" }> | undefined;
}

export interface SourceDescriptorReader {
  describeSyntax(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  describeComponent(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  inheritedBindings(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceTypeBinding[]>;
}

export type SourceProductionResult<Value> = SourceResult<Value> | {
  readonly kind: "pending";
  readonly dependencies: readonly SourceTypeComponent[];
};

export declare function createSourceDescriptorReader(
  input: SourceDescriptorInput,
  builder: SourceDescriptorBuilder,
  hooks: SourceDescriptorProductionHooks,
): SourceDescriptorReader;

export interface SourceEvidenceComponent {
  readonly selector: SourceComponentSelector;
  readonly value: SourceTypeEvidence;
}

export interface SourceDescriptorBuilder extends SourceDescriptorView {
  primitive(primitive: SourcePrimitiveKind): SourceTypeDescriptor;
  string(): SourceTypeDescriptor;
  intrinsic(intrinsic: Extract<SourceTypeDescriptor, { readonly kind: "intrinsic" }>["intrinsic"]): SourceTypeDescriptor;
  parameter(declaration: Node, owner: Node, index: number,
    constraint: () => SourceResult<SourceTypeParameterRequirement>,
    defaultType: () => SourceResult<SourceTypeParameterRequirement>): SourceTypeParameter;
  optional(value: SourceTypeDescriptor): SourceTypeDescriptor;
  union(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor;
  array(element: SourceTypeDescriptor, isReadonly: boolean): SourceTypeDescriptor;
  tuple(elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"], isReadonly: boolean): SourceTypeDescriptor;
  shape(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "shape" }>, "kind">): SourceTypeDescriptor;
  callable(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "callable" }>, "kind">): SourceTypeDescriptor;
  declared(value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor;
  projection(source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor;
  componentIdentity(root: Node, path: readonly SourceComponentSelector[]): SourceTypeComponent;
  evidence(value: SourceTypeEvidence, components: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined): SourceTypeEvidence;
  originalComponent(value: SourceTypeEvidence): SourceInputComponent;
  signature(owner: Node, kind: "call" | "construct", original: SourceInputSignature, declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity;
  define(declaration: Node, parameters: readonly Node[], definition: () => SourceProductionResult<SourceTypeEvidence>): void;
  publishFamily(component: SourceTypeComponent, origin: "authored" | "inferred", parameters: readonly Node[], roles: readonly SourceTypeEvidence[]): SourceSumFamily;
  applyFamily(family: SourceSumFamily, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication>;
  substituteCategory(category: SourceCategoryDomain, bindings: readonly SourceTypeBinding[]): SourceCategoryDomain;
  seal(): SourceDescriptorView;
}
