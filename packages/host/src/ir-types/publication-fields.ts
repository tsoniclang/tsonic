import type { SourceNodeRef, NodeRef, ItemNodeRef, LocalRef, TyId, SigId, DefId } from "../ids/contract.js";
import type { TypeTerm, Signature, SignatureInput, Member, MemberInventoryEntry, MemberKey, MemberOrigin, ConstructionDefinition, TypeComponent, ComponentSelector, SumFamily, SumArmRole, TypeParameter, SignatureParameter, TupleElement, ExactRational, LiteralTypeValue, FixedExtent, TypeProjection, IndexSignature } from "./data.js";
import { isNativePrimitive } from "./native-facts.js";

interface SignatureComposition { readonly kind: "union" | "intersection"; readonly signatures: readonly SigId[] }

export type PublicationRecord = { readonly field?: string } & (
  | { readonly kind: "type"; readonly value: TypeTerm }
  | { readonly kind: "signature"; readonly value: Signature }
  | { readonly kind: "signature-input"; readonly value: SignatureInput }
  | { readonly kind: "member"; readonly value: Member }
  | { readonly kind: "member-header"; readonly value: MemberInventoryEntry }
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
  | { readonly kind: "index-signature"; readonly value: IndexSignature });

export type PublicationValue = PublicationRecord | { readonly kind: "scalar" };

export type PublicationArray = { readonly field: string } & (
  | { readonly kind: "type-id-array"; readonly value: readonly TyId[] }
  | { readonly kind: "tuple-element-array"; readonly value: readonly TupleElement[] }
  | { readonly kind: "member-array"; readonly value: readonly Member[] }
  | { readonly kind: "member-header-array"; readonly value: readonly MemberInventoryEntry[] }
  | { readonly kind: "index-signature-array"; readonly value: readonly IndexSignature[] }
  | { readonly kind: "signature-id-array"; readonly value: readonly SigId[] }
  | { readonly kind: "type-parameter-array"; readonly value: readonly TypeParameter[] }
  | { readonly kind: "signature-parameter-array"; readonly value: readonly SignatureParameter[] }
  | { readonly kind: "origin-array"; readonly value: readonly MemberOrigin[] }
  | { readonly kind: "local-array"; readonly value: readonly LocalRef[] }
  | { readonly kind: "selector-array"; readonly value: readonly ComponentSelector[] }
  | { readonly kind: "definition-id-array"; readonly value: readonly DefId[] }
  | { readonly kind: "group-definition-array"; readonly value: readonly DefId[] }
  | { readonly kind: "arm-array"; readonly value: readonly SumArmRole[] }
);

export type PublicationNode = PublicationValue | PublicationArray;
export interface PublicationShape { readonly children: readonly PublicationNode[] }

export function publicationWork(selected: PublicationRecord): number | undefined {
  switch (selected.kind) {
    case "type":
      switch (selected.value.kind) {
        case "primitive": case "intrinsic": case "union": case "intersection": case "optional":
        case "enum": case "param": case "merged-parameter": case "self": case "source-environment": return 2;
        case "string": case "error": return 1;
        case "literal": case "array": case "tuple": case "fixed-array": case "callable":
        case "construction-reference": case "merged-interface": case "projection": case "open": return 3;
        case "shape": case "declared": return 5;
      }
      return undefined;
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
      return undefined;
    case "signature": case "member": return 9;
    case "member-header": return 7;
    case "signature-input": return 8;
    case "family": return 4;
    case "arm": case "type-parameter": case "tuple-element": case "rational": return 3;
    case "signature-parameter": return 6;
    case "literal": return selected.value.kind === "absence" ? 1 : 2;
    case "projection": return selected.value.kind === "awaited" || selected.value.kind === "keyof" ? 1 : selected.value.kind === "conditional" ? 6 : 2;
    case "index-signature": return 5;
  }
}

export function publicationScalarField(selected: PublicationRecord): string | null {
  switch (selected.kind) {
    case "type": {
      const value = selected.value;
      if (value.kind === "primitive" && !isNativePrimitive(value.primitive)) return "primitive";
      if (value.kind === "merged-interface" && (!Array.isArray(value.definitions) || value.definitions.length < 2)) return "definitions";
      return null;
    }
    case "signature": case "signature-input":
      return selected.value.kind !== "call" && selected.value.kind !== "construct" ? "kind" : null;
    case "literal": return selected.value.kind === "bigint" && typeof selected.value.value !== "bigint" ? "value" : null;
    case "extent": return typeof selected.value.length !== "bigint" ? "length" : null;
    case "rational": {
      if (typeof selected.value.numerator !== "bigint") return "numerator";
      if (typeof selected.value.denominator !== "bigint") return "denominator";
      return typeof selected.value.negativeZero !== "boolean" ? "negativeZero" : null;
    }
    default: return null;
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
    case "projection": return selected.value.kind === "indexed" || selected.value.kind === "substitution" ? 1 : selected.value.kind === "conditional" ? 3 : 0;
    case "selector":
      switch (selected.value.kind) {
        case "index-key": case "index-value": case "parameter": case "receiver": case "result": case "signature-tail": return 1;
        default: return 0;
      }
    default: return 0;
  }
}

export function publicationShape(selected: PublicationRecord): PublicationShape | undefined {
  switch (selected.kind) {
    case "type": {
      const value = selected.value;
      switch (value.kind) {
        case "primitive": return { children: [] };
        case "intrinsic": return { children: [] };
        case "string": return { children: [] };
        case "literal": return { children: [{ kind: "literal", field: "value", value: value.value }] };
        case "union": return { children: [{ kind: "type-id-array", field: "members", value: value.members }] };
        case "intersection": return { children: [{ kind: "type-id-array", field: "members", value: value.members }] };
        case "optional": return { children: [] };
        case "array": return { children: [] };
        case "tuple": return { children: [{ kind: "tuple-element-array", field: "elements", value: value.elements }] };
        case "fixed-array": return { children: [{ kind: "extent", value: value.extent }] };
        case "shape": return { children: [{ kind: "member-array", field: "members", value: value.members }, { kind: "index-signature-array", field: "indexes", value: value.indexes }, { kind: "signature-id-array", field: "calls", value: value.calls }, { kind: "signature-id-array", field: "constructs", value: value.constructs }] };
        case "source-environment": return { children: [{ kind: "member-header-array", field: "members", value: value.members }] };
        case "callable": return { children: [{ kind: "signature-id-array", field: "calls", value: value.calls }, { kind: "signature-id-array", field: "constructs", value: value.constructs }] };
        case "declared": return { children: [{ kind: "type-id-array", field: "arguments", value: value.arguments }, value.extent === null ? { kind: "scalar" } : { kind: "extent", value: value.extent }] };
        case "merged-interface": return { children: [{ kind: "type-id-array", field: "arguments", value: value.arguments },
          { kind: "group-definition-array", field: "definitions", value: value.definitions }] };
        case "construction-reference": return { children: [{ kind: "construction", value: value.definition }, { kind: "type-id-array", field: "arguments", value: value.arguments }] };
        case "enum": return { children: [] };
        case "param": return { children: [] };
        case "merged-parameter": return { children: [{ kind: "group-definition-array", field: "parameters", value: value.parameters }] };
        case "self": return { children: [] };
        case "projection": return { children: [{ kind: "projection", value: value.projection }] };
        case "open": return { children: [] };
        case "error": return { children: [] };
      }
      return undefined;
    }
    case "signature": {
      const value = selected.value;
      return { children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", field: "typeParameters", value: value.typeParameters }, { kind: "signature-parameter-array", field: "parameters", value: value.parameters }] };
    }
    case "signature-input": {
      const value = selected.value;
      return { children: [value.owner === null ? { kind: "scalar" } : { kind: "source", value: value.owner }, value.composition === null ? { kind: "scalar" } : { kind: "composition", value: value.composition }, { kind: "type-parameter-array", field: "typeParameters", value: value.typeParameters }, { kind: "signature-parameter-array", field: "parameters", value: value.parameters }] };
    }
    case "member": case "member-header": {
      const value = selected.value;
      return { children: [{ kind: "member-key", field: "key", value: value.key }, { kind: "origin-array", field: "origins", value: value.origins }, { kind: "origin-array", field: "readOrigins", value: value.readOrigins }, { kind: "origin-array", field: "writeOrigins", value: value.writeOrigins }] };
    }
    case "member-key": {
      const value = selected.value;
      switch (value.kind) {
        case "text": return { children: [] };
        case "number": return { children: [{ kind: "rational", field: "value", value: value.value }] };
        case "symbol": return { children: [] };
      }
      return undefined;
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
      return undefined;
    }
    case "source": {
      const value = selected.value;
      switch (value.kind) {
        case "body": return { children: [{ kind: "node", value: value.value }] };
        case "item": return { children: [{ kind: "item-node", value: value.value }] };
      }
      return undefined;
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
      return { children: [{ kind: "node", value: value.occurrence }, { kind: "local-array", field: "captures", value: value.captures }] };
    }
    case "component": {
      const value = selected.value;
      return { children: [{ kind: "source", field: "root", value: value.root }, { kind: "selector-array", field: "path", value: value.path }] };
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
      return undefined;
    }
    case "family": {
      const value = selected.value;
      return { children: [{ kind: "component", value: value.component }, { kind: "definition-id-array", field: "parameters", value: value.parameters }, { kind: "arm-array", field: "roles", value: value.roles }] };
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
        case "number": return { children: [{ kind: "rational", field: "value", value: value.value }] };
        case "bigint": return { children: [] };
        case "string": return { children: [] };
        case "boolean": return { children: [] };
        case "absence": return { children: [] };
        case "unique-symbol": return { children: [] };
      }
      return undefined;
    }
    case "extent": {
      return { children: [] };
    }
    case "projection": {
      const value = selected.value;
      switch (value.kind) {
        case "awaited": case "keyof": case "indexed": case "substitution": return { children: [] };
        case "conditional": return { children: [{ kind: "group-definition-array", field: "inferParameters", value: value.inferParameters }] };
        case "component": return { children: [{ kind: "component", value: value.component }] };
      }
      return undefined;
    }
    case "composition": {
      const value = selected.value;
      switch (value.kind) {
        case "union": return { children: [{ kind: "signature-id-array", field: "signatures", value: value.signatures }] };
        case "intersection": return { children: [{ kind: "signature-id-array", field: "signatures", value: value.signatures }] };
      }
      return undefined;
    }
    case "index-signature": {
      const value = selected.value;
      return { children: [{ kind: "source", value: value.origin }] };
    }
  }
}

export function publicationArrayElement(node: PublicationArray, position: number): PublicationValue | undefined {
  switch (node.kind) {
    case "type-id-array": {
      return node.value[position] === undefined ? undefined : { kind: "scalar" };
    }
    case "tuple-element-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "tuple-element", value };
    }
    case "member-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "member", value };
    }
    case "member-header-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "member-header", value };
    }
    case "index-signature-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "index-signature", value };
    }
    case "signature-id-array": {
      return node.value[position] === undefined ? undefined : { kind: "scalar" };
    }
    case "type-parameter-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "type-parameter", value };
    }
    case "signature-parameter-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "signature-parameter", value };
    }
    case "origin-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "origin", value };
    }
    case "local-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "local", value };
    }
    case "selector-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "selector", value };
    }
    case "definition-id-array": {
      return node.value[position] === undefined ? undefined : { kind: "scalar" };
    }
    case "group-definition-array": {
      return typeof node.value[position] !== "string" ? undefined : { kind: "scalar" };
    }
    case "arm-array": {
      const value = node.value[position];
      return value === undefined ? undefined : { kind: "arm", value };
    }
  }
}

export function isPublicationArray(node: PublicationNode): node is PublicationArray {
  switch (node.kind) {
    case "type-id-array":
    case "tuple-element-array":
    case "member-array":
    case "member-header-array":
    case "index-signature-array":
    case "signature-id-array":
    case "type-parameter-array":
    case "signature-parameter-array":
    case "origin-array":
    case "local-array":
    case "selector-array":
    case "definition-id-array":
    case "group-definition-array":
    case "arm-array":
      return true;
    default: return false;
  }
}
