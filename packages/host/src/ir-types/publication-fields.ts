import type { SourceNodeRef, NodeRef, ItemNodeRef, LocalRef, TyId, SigId } from "../ids/contract.js";
import type { TypeTerm, Signature, SignatureInput, Member, MemberKey, MemberOrigin, ConstructionDefinition, TypeComponent, ComponentSelector, SumFamily, SumArmRole, TypeParameterIdentity, TypeParameter, SignatureParameter, TupleElement, ExactRational, LiteralTypeValue, FixedExtent, TypeProjection, IndexSignature } from "./data.js";

interface SignatureComposition { readonly kind: "union" | "intersection"; readonly signatures: readonly SigId[] }

export type PublicationRecord =
  | { readonly kind: "type"; readonly value: TypeTerm }
  | { readonly kind: "signature"; readonly value: Signature }
  | { readonly kind: "signature-input"; readonly value: SignatureInput }
  | { readonly kind: "member"; readonly value: Member }
  | { readonly kind: "member-key"; readonly value: MemberKey }
  | { readonly kind: "origin"; readonly value: MemberOrigin }
  | { readonly kind: "source"; readonly value: SourceNodeRef }
  | { readonly kind: "node"; readonly value: NodeRef }
  | { readonly kind: "item-node"; readonly value: ItemNodeRef }
  | { readonly kind: "local"; readonly value: LocalRef }
  | { readonly kind: "construction"; readonly value: ConstructionDefinition }
  | { readonly kind: "component"; readonly value: TypeComponent }
  | { readonly kind: "selector"; readonly value: ComponentSelector }
  | { readonly kind: "family"; readonly value: SumFamily }
  | { readonly kind: "arm"; readonly value: SumArmRole }
  | { readonly kind: "parameter-identity"; readonly value: TypeParameterIdentity }
  | { readonly kind: "type-parameter"; readonly value: TypeParameter }
  | { readonly kind: "signature-parameter"; readonly value: SignatureParameter }
  | { readonly kind: "tuple-element"; readonly value: TupleElement }
  | { readonly kind: "rational"; readonly value: ExactRational }
  | { readonly kind: "literal"; readonly value: LiteralTypeValue }
  | { readonly kind: "extent"; readonly value: FixedExtent }
  | { readonly kind: "projection"; readonly value: TypeProjection }
  | { readonly kind: "composition"; readonly value: SignatureComposition }
  | { readonly kind: "index-signature"; readonly value: IndexSignature };

export type PublicationValue = PublicationRecord | { readonly kind: "scalar" } | { readonly kind: "reference" };

export type PublicationArray =
  | { readonly kind: "type-id-array"; readonly value: readonly TyId[] }
  | { readonly kind: "tuple-element-array"; readonly value: readonly TupleElement[] }
  | { readonly kind: "member-array"; readonly value: readonly Member[] }
  | { readonly kind: "index-signature-array"; readonly value: readonly IndexSignature[] }
  | { readonly kind: "signature-id-array"; readonly value: readonly SigId[] }
  | { readonly kind: "type-parameter-array"; readonly value: readonly TypeParameter[] }
  | { readonly kind: "signature-parameter-array"; readonly value: readonly SignatureParameter[] }
  | { readonly kind: "origin-array"; readonly value: readonly MemberOrigin[] }
  | { readonly kind: "local-array"; readonly value: readonly LocalRef[] }
  | { readonly kind: "selector-array"; readonly value: readonly ComponentSelector[] }
  | { readonly kind: "parameter-identity-array"; readonly value: readonly TypeParameterIdentity[] }
  | { readonly kind: "arm-array"; readonly value: readonly SumArmRole[] };

export type PublicationNode = PublicationValue | PublicationArray;
export interface PublicationShape { readonly work: number; readonly references: number; readonly children: readonly PublicationNode[] }
const ownedElementFailure: InvariantFailure = { owner: "ir-types", query: null, origin: null,
  message: "An owned TypeArena vector must retain every validated element." };

export function publicationShape(selected: PublicationRecord): PublicationShape {
  switch (selected.kind) {
    case "type": {
      const value = selected.value;
      switch (value.kind) {
        case "primitive": return { work: 2, references: 0, children: [] };
        case "intrinsic": return { work: 2, references: 0, children: [] };
        case "string": return { work: 1, references: 0, children: [] };
        case "literal": return { work: 3, references: 1, children: [{ kind: "literal", value: value.value }] };
        case "union": return { work: 2, references: 0, children: [{ kind: "type-id-array", value: value.members }] };
        case "intersection": return { work: 2, references: 0, children: [{ kind: "type-id-array", value: value.members }] };
        case "optional": return { work: 2, references: 1, children: [] };
        case "array": return { work: 3, references: 1, children: [] };
        case "tuple": return { work: 3, references: 0, children: [{ kind: "tuple-element-array", value: value.elements }] };
        case "fixed-array": return { work: 3, references: 1, children: [{ kind: "extent", value: value.extent }] };
        case "shape": return { work: 5, references: 0, children: [{ kind: "member-array", value: value.members }, { kind: "index-signature-array", value: value.indexes }, { kind: "signature-id-array", value: value.calls }, { kind: "signature-id-array", value: value.constructs }] };
        case "callable": return { work: 3, references: 0, children: [{ kind: "signature-id-array", value: value.calls }, { kind: "signature-id-array", value: value.constructs }] };
        case "declared": return { work: 5, references: 0, children: [{ kind: "type-id-array", value: value.arguments }, value.extent === null ? { kind: "scalar" } : { kind: "extent", value: value.extent }] };
        case "construction-reference": return { work: 3, references: 0, children: [{ kind: "construction", value: value.definition }, { kind: "type-id-array", value: value.arguments }] };
        case "enum": return { work: 2, references: 0, children: [] };
        case "param": return { work: 2, references: 0, children: [{ kind: "parameter-identity", value: value.parameter }] };
        case "self": return { work: 2, references: 0, children: [] };
        case "projection": return { work: 3, references: 1, children: [{ kind: "projection", value: value.projection }] };
        case "open": return { work: 3, references: 0, children: [] };
        case "error": return { work: 1, references: 0, children: [] };
      }
    }
    case "signature": {
      const value = selected.value;
      return { work: 9, references: 1 + Number(value.receiver !== null), children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", value: value.typeParameters }, { kind: "signature-parameter-array", value: value.parameters }] };
    }
    case "signature-input": {
      const value = selected.value;
      return { work: 8, references: 1 + Number(value.receiver !== null), children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", value: value.typeParameters }, { kind: "signature-parameter-array", value: value.parameters }] };
    }
    case "member": {
      const value = selected.value;
      return { work: 9, references: Number(value.read !== null) + Number(value.write !== null), children: [{ kind: "member-key", value: value.key }, { kind: "origin-array", value: value.origins }, { kind: "origin-array", value: value.readOrigins }, { kind: "origin-array", value: value.writeOrigins }] };
    }
    case "member-key": {
      const value = selected.value;
      switch (value.kind) {
        case "text": return { work: 2, references: 0, children: [] };
        case "number": return { work: 2, references: 0, children: [{ kind: "rational", value: value.value }] };
        case "symbol": return { work: 2, references: 0, children: [] };
      }
    }
    case "origin": {
      const value = selected.value;
      switch (value.kind) {
        case "declared": return { work: 2, references: 0, children: [] };
        case "class-prototype": return { work: 2, references: 0, children: [] };
        case "mapped": return { work: 3, references: 0, children: [{ kind: "source", value: value.owner }, { kind: "member-key", value: value.key }] };
      }
    }
    case "source": {
      const value = selected.value;
      switch (value.kind) {
        case "body": return { work: 2, references: 0, children: [{ kind: "node", value: value.value }] };
        case "item": return { work: 2, references: 0, children: [{ kind: "item-node", value: value.value }] };
      }
    }
    case "node": {
      return { work: 2, references: 0, children: [] };
    }
    case "item-node": {
      return { work: 2, references: 0, children: [] };
    }
    case "local": {
      return { work: 2, references: 0, children: [] };
    }
    case "construction": {
      const value = selected.value;
      return { work: 2, references: 0, children: [{ kind: "node", value: value.occurrence }, { kind: "local-array", value: value.captures }] };
    }
    case "component": {
      const value = selected.value;
      return { work: 2, references: 0, children: [{ kind: "source", value: value.root }, { kind: "selector-array", value: value.path }] };
    }
    case "selector": {
      const value = selected.value;
      switch (value.kind) {
        case "class-value": return { work: 1, references: 0, children: [] };
        case "optional-value": return { work: 1, references: 0, children: [] };
        case "array-element": return { work: 1, references: 0, children: [] };
        case "intersection-result": return { work: 1, references: 0, children: [] };
        case "projection-source": return { work: 1, references: 0, children: [] };
        case "awaited": return { work: 1, references: 0, children: [] };
        case "tuple-element": return { work: 2, references: 0, children: [] };
        case "union-member": return { work: 2, references: 0, children: [] };
        case "argument-place": return { work: 2, references: 0, children: [] };
        case "parameter-place": return { work: 2, references: 0, children: [] };
        case "intersection-member": return { work: 2, references: 0, children: [] };
        case "construction-argument": return { work: 3, references: 0, children: [{ kind: "construction", value: value.definition }] };
        case "argument-tail": return { work: 2, references: 0, children: [] };
        case "parameter-tail": return { work: 2, references: 0, children: [] };
        case "member": return { work: 2, references: 0, children: [{ kind: "origin", value: value.origin }] };
        case "index-key": return { work: 2, references: 0, children: [] };
        case "index-value": return { work: 2, references: 0, children: [] };
        case "parameter": return { work: 3, references: 1, children: [] };
        case "receiver": return { work: 2, references: 1, children: [] };
        case "result": return { work: 2, references: 1, children: [] };
        case "signature-tail": return { work: 4, references: 1, children: [] };
        case "tuple-slice": return { work: 4, references: 0, children: [] };
        case "type-argument": return { work: 3, references: 0, children: [] };
        case "sum-arm": return { work: 3, references: 0, children: [{ kind: "family", value: value.family }] };
      }
    }
    case "family": {
      const value = selected.value;
      return { work: 4, references: 0, children: [{ kind: "component", value: value.component }, { kind: "parameter-identity-array", value: value.parameters }, { kind: "arm-array", value: value.roles }] };
    }
    case "arm": {
      const value = selected.value;
      return { work: 3, references: 1, children: [{ kind: "source", value: value.component }] };
    }
    case "parameter-identity": {
      return { work: 2, references: 0, children: [] };
    }
    case "type-parameter": {
      const value = selected.value;
      return { work: 4, references: Number(value.constraint !== null) + Number(value.default !== null), children: [{ kind: "parameter-identity", value: value.identity }] };
    }
    case "signature-parameter": {
      return { work: 5, references: 1, children: [] };
    }
    case "tuple-element": {
      return { work: 3, references: 1, children: [] };
    }
    case "rational": {
      return { work: 3, references: 0, children: [] };
    }
    case "literal": {
      const value = selected.value;
      switch (value.kind) {
        case "number": return { work: 2, references: 0, children: [{ kind: "rational", value: value.value }] };
        case "bigint": return { work: 2, references: 0, children: [] };
        case "string": return { work: 2, references: 0, children: [] };
        case "boolean": return { work: 2, references: 0, children: [] };
        case "absence": return { work: 1, references: 0, children: [] };
        case "unique-symbol": return { work: 2, references: 0, children: [] };
      }
    }
    case "extent": {
      return { work: 2, references: 0, children: [] };
    }
    case "projection": {
      const value = selected.value;
      switch (value.kind) {
        case "awaited": return { work: 1, references: 0, children: [] };
        case "component": return { work: 2, references: 0, children: [{ kind: "component", value: value.component }] };
      }
    }
    case "composition": {
      const value = selected.value;
      switch (value.kind) {
        case "union": return { work: 2, references: 0, children: [{ kind: "signature-id-array", value: value.signatures }] };
        case "intersection": return { work: 2, references: 0, children: [{ kind: "signature-id-array", value: value.signatures }] };
      }
    }
    case "index-signature": {
      const value = selected.value;
      return { work: 5, references: 2 + Number(value.write !== null), children: [] };
    }
  }
}

export function publicationArrayElement(node: PublicationArray, position: number): PublicationValue {
  switch (node.kind) {
    case "type-id-array": {
      return { kind: "reference" };
    }
    case "tuple-element-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "tuple-element", value: value };
    }
    case "member-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "member", value: value };
    }
    case "index-signature-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "index-signature", value: value };
    }
    case "signature-id-array": {
      return { kind: "reference" };
    }
    case "type-parameter-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "type-parameter", value: value };
    }
    case "signature-parameter-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "signature-parameter", value: value };
    }
    case "origin-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "origin", value: value };
    }
    case "local-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "local", value: value };
    }
    case "selector-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "selector", value: value };
    }
    case "parameter-identity-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "parameter-identity", value: value };
    }
    case "arm-array": {
      const value = requirePresent(node.value[position], ownedElementFailure);
      return { kind: "arm", value: value };
    }
  }
}

export function isPublicationArray(node: PublicationNode): node is PublicationArray {
  switch (node.kind) {
    case "type-id-array":
    case "tuple-element-array":
    case "member-array":
    case "index-signature-array":
    case "signature-id-array":
    case "type-parameter-array":
    case "signature-parameter-array":
    case "origin-array":
    case "local-array":
    case "selector-array":
    case "parameter-identity-array":
    case "arm-array":
      return true;
    default: return false;
  }
}
import { requirePresent } from "../diag/index.js";
import type { InvariantFailure } from "../diag/contract.js";
