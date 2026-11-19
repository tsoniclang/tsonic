import type { SourceNodeRef, NodeRef, ItemNodeRef, LocalRef, TyId, SigId, DefId } from "../ids/contract.js";
import type { TypeTerm, Signature, SignatureInput, Member, MemberKey, MemberOrigin, ConstructionDefinition, TypeComponent, ComponentSelector, SumFamily, SumArmRole, TypeParameter, SignatureParameter, TupleElement, ExactRational, LiteralTypeValue, FixedExtent, TypeProjection, IndexSignature } from "./data.js";

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
  | { readonly kind: "type-parameter"; readonly value: TypeParameter }
  | { readonly kind: "signature-parameter"; readonly value: SignatureParameter }
  | { readonly kind: "tuple-element"; readonly value: TupleElement }
  | { readonly kind: "rational"; readonly value: ExactRational }
  | { readonly kind: "literal"; readonly value: LiteralTypeValue }
  | { readonly kind: "extent"; readonly value: FixedExtent }
  | { readonly kind: "projection"; readonly value: TypeProjection }
  | { readonly kind: "composition"; readonly value: SignatureComposition }
  | { readonly kind: "index-signature"; readonly value: IndexSignature };

export type PublicationValue = PublicationRecord | { readonly kind: "scalar" };

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
  | { readonly kind: "definition-id-array"; readonly value: readonly DefId[] }
  | { readonly kind: "arm-array"; readonly value: readonly SumArmRole[] };

export type PublicationNode = PublicationValue | PublicationArray;
export interface PublicationShape { readonly children: readonly PublicationNode[] }

export function publicationWork(selected: PublicationRecord): number {
  switch (selected.kind) {
    case "type":
      switch (selected.value.kind) {
        case "primitive": case "intrinsic": case "union": case "intersection": case "optional":
        case "enum": case "param": case "self": return 2;
        case "string": case "error": return 1;
        case "literal": case "array": case "tuple": case "fixed-array": case "callable":
        case "construction-reference": case "projection": case "open": return 3;
        case "shape": case "declared": return 5;
      }
    case "member-key": return 2;
    case "origin": return selected.value.kind === "mapped" ? 3 : 2;
    case "source": case "node": case "item-node": case "local": case "construction":
    case "component": case "extent": case "composition": return 2;
    case "selector":
      switch (selected.value.kind) {
        case "class-value": case "optional-value": case "array-element": case "intersection-result":
        case "projection-source": case "awaited": return 1;
        case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
        case "intersection-member": case "argument-tail": case "parameter-tail": case "member":
        case "receiver": case "result": return 2;
        case "construction-argument": case "index-key": case "index-value": case "parameter":
        case "type-argument": case "sum-arm": return 3;
        case "signature-tail": case "tuple-slice": return 4;
      }
    case "signature": case "member": return 9;
    case "signature-input": return 8;
    case "family": return 4;
    case "arm": case "type-parameter": case "tuple-element": case "rational": return 3;
    case "signature-parameter": return 6;
    case "literal": return selected.value.kind === "absence" ? 1 : 2;
    case "projection": return selected.value.kind === "awaited" ? 1 : 2;
    case "index-signature": return 5;
  }
}

export function publicationReferences(selected: PublicationRecord): number {
  switch (selected.kind) {
    case "type":
      switch (selected.value.kind) {
        case "literal": case "optional": case "array": case "fixed-array": case "projection": return 1;
        default: return 0;
      }
    case "signature": case "signature-input": return 1 + Number(selected.value.receiver !== null);
    case "member": return Number(selected.value.read !== null) + Number(selected.value.write !== null);
    case "type-parameter": return Number(selected.value.constraint !== null) + Number(selected.value.default !== null);
    case "index-signature": return 2 + Number(selected.value.write !== null);
    case "arm": case "signature-parameter": case "tuple-element": return 1;
    case "selector":
      switch (selected.value.kind) {
        case "index-key": case "index-value": case "parameter": case "receiver": case "result": case "signature-tail": return 1;
        default: return 0;
      }
    default: return 0;
  }
}

function arrayElement<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new TypeError("ir-types: a graph input vector must be dense.");
  return value;
}

export function publicationShape(selected: PublicationRecord): PublicationShape {
  switch (selected.kind) {
    case "type": {
      const value = selected.value;
      switch (value.kind) {
        case "primitive": return { children: [] };
        case "intrinsic": return { children: [] };
        case "string": return { children: [] };
        case "literal": return { children: [{ kind: "literal", value: value.value }] };
        case "union": return { children: [{ kind: "type-id-array", value: value.members }] };
        case "intersection": return { children: [{ kind: "type-id-array", value: value.members }] };
        case "optional": return { children: [] };
        case "array": return { children: [] };
        case "tuple": return { children: [{ kind: "tuple-element-array", value: value.elements }] };
        case "fixed-array": return { children: [{ kind: "extent", value: value.extent }] };
        case "shape": return { children: [{ kind: "member-array", value: value.members }, { kind: "index-signature-array", value: value.indexes }, { kind: "signature-id-array", value: value.calls }, { kind: "signature-id-array", value: value.constructs }] };
        case "callable": return { children: [{ kind: "signature-id-array", value: value.calls }, { kind: "signature-id-array", value: value.constructs }] };
        case "declared": return { children: [{ kind: "type-id-array", value: value.arguments }, value.extent === null ? { kind: "scalar" } : { kind: "extent", value: value.extent }] };
        case "construction-reference": return { children: [{ kind: "construction", value: value.definition }, { kind: "type-id-array", value: value.arguments }] };
        case "enum": return { children: [] };
        case "param": return { children: [] };
        case "self": return { children: [] };
        case "projection": return { children: [{ kind: "projection", value: value.projection }] };
        case "open": return { children: [] };
        case "error": return { children: [] };
      }
    }
    case "signature": {
      const value = selected.value;
      return { children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", value: value.typeParameters }, { kind: "signature-parameter-array", value: value.parameters }] };
    }
    case "signature-input": {
      const value = selected.value;
      return { children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", value: value.typeParameters }, { kind: "signature-parameter-array", value: value.parameters }] };
    }
    case "member": {
      const value = selected.value;
      return { children: [{ kind: "member-key", value: value.key }, { kind: "origin-array", value: value.origins }, { kind: "origin-array", value: value.readOrigins }, { kind: "origin-array", value: value.writeOrigins }] };
    }
    case "member-key": {
      const value = selected.value;
      switch (value.kind) {
        case "text": return { children: [] };
        case "number": return { children: [{ kind: "rational", value: value.value }] };
        case "symbol": return { children: [] };
      }
    }
    case "origin": {
      const value = selected.value;
      switch (value.kind) {
        case "declared": return { children: [] };
        case "class-prototype": return { children: [] };
        case "intrinsic": return { children: [] };
        case "source-member": return { children: [{ kind: "node", value: value.occurrence }] };
        case "mapped": return { children: [{ kind: "source", value: value.owner }, { kind: "member-key", value: value.key }] };
      }
    }
    case "source": {
      const value = selected.value;
      switch (value.kind) {
        case "body": return { children: [{ kind: "node", value: value.value }] };
        case "item": return { children: [{ kind: "item-node", value: value.value }] };
      }
    }
    case "node": {
      return { children: [] };
    }
    case "item-node": {
      return { children: [] };
    }
    case "local": {
      return { children: [] };
    }
    case "construction": {
      const value = selected.value;
      return { children: [{ kind: "node", value: value.occurrence }, { kind: "local-array", value: value.captures }] };
    }
    case "component": {
      const value = selected.value;
      return { children: [{ kind: "source", value: value.root }, { kind: "selector-array", value: value.path }] };
    }
    case "selector": {
      const value = selected.value;
      switch (value.kind) {
        case "class-value": return { children: [] };
        case "optional-value": return { children: [] };
        case "array-element": return { children: [] };
        case "intersection-result": return { children: [] };
        case "projection-source": return { children: [] };
        case "awaited": return { children: [] };
        case "tuple-element": return { children: [] };
        case "union-member": return { children: [] };
        case "argument-place": return { children: [] };
        case "parameter-place": return { children: [] };
        case "intersection-member": return { children: [] };
        case "construction-argument": return { children: [{ kind: "construction", value: value.definition }] };
        case "argument-tail": return { children: [] };
        case "parameter-tail": return { children: [] };
        case "member": return { children: [{ kind: "origin", value: value.origin }] };
        case "index-key": return { children: [{ kind: "source", value: value.origin }] };
        case "index-value": return { children: [{ kind: "source", value: value.origin }] };
        case "parameter": return { children: [] };
        case "receiver": return { children: [] };
        case "result": return { children: [] };
        case "signature-tail": return { children: [] };
        case "tuple-slice": return { children: [] };
        case "type-argument": return { children: [] };
        case "sum-arm": return { children: [{ kind: "family", value: value.family }] };
      }
    }
    case "family": {
      const value = selected.value;
      return { children: [{ kind: "component", value: value.component }, { kind: "definition-id-array", value: value.parameters }, { kind: "arm-array", value: value.roles }] };
    }
    case "arm": {
      const value = selected.value;
      return { children: [{ kind: "source", value: value.component }] };
    }
    case "type-parameter": {
      return { children: [] };
    }
    case "signature-parameter": {
      return { children: [] };
    }
    case "tuple-element": {
      return { children: [] };
    }
    case "rational": {
      return { children: [] };
    }
    case "literal": {
      const value = selected.value;
      switch (value.kind) {
        case "number": return { children: [{ kind: "rational", value: value.value }] };
        case "bigint": return { children: [] };
        case "string": return { children: [] };
        case "boolean": return { children: [] };
        case "absence": return { children: [] };
        case "unique-symbol": return { children: [] };
      }
    }
    case "extent": {
      return { children: [] };
    }
    case "projection": {
      const value = selected.value;
      switch (value.kind) {
        case "awaited": return { children: [] };
        case "component": return { children: [{ kind: "component", value: value.component }] };
      }
    }
    case "composition": {
      const value = selected.value;
      switch (value.kind) {
        case "union": return { children: [{ kind: "signature-id-array", value: value.signatures }] };
        case "intersection": return { children: [{ kind: "signature-id-array", value: value.signatures }] };
      }
    }
    case "index-signature": {
      const value = selected.value;
      return { children: [{ kind: "source", value: value.origin }] };
    }
  }
}

export function publicationArrayElement(node: PublicationArray, position: number): PublicationValue {
  switch (node.kind) {
    case "type-id-array": {
      arrayElement(node.value[position]);
      return { kind: "scalar" };
    }
    case "tuple-element-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "tuple-element", value: value };
    }
    case "member-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "member", value: value };
    }
    case "index-signature-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "index-signature", value: value };
    }
    case "signature-id-array": {
      arrayElement(node.value[position]);
      return { kind: "scalar" };
    }
    case "type-parameter-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "type-parameter", value: value };
    }
    case "signature-parameter-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "signature-parameter", value: value };
    }
    case "origin-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "origin", value: value };
    }
    case "local-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "local", value: value };
    }
    case "selector-array": {
      const value = arrayElement(node.value[position]);
      return { kind: "selector", value: value };
    }
    case "definition-id-array": {
      arrayElement(node.value[position]);
      return { kind: "scalar" };
    }
    case "arm-array": {
      const value = arrayElement(node.value[position]);
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
    case "definition-id-array":
    case "arm-array":
      return true;
    default: return false;
  }
}
