import type { Node } from "@tsonic/tsts";
import type {
  SourceComponentSelector, SourceMemberOrigin, SourceSignatureIdentity,
  SourceSumFamily, SourceTypeComponent,
} from "../public/source/contracts.js";
import { freezeSourceMemberOrigin, sourceMemberOriginKey } from "./descriptor-model.js";

export interface SourceComponentOwner {
  identity(root: Node, path: readonly SourceComponentSelector[]): SourceTypeComponent;
  assert(value: SourceTypeComponent): void;
  selectorKey(value: SourceComponentSelector): string;
  objectKey(value: object): number;
}

export function createSourceComponentOwner(input: {
  assertNode(node: Node): void;
  assertSignature(signature: SourceSignatureIdentity): void;
  assertFamily(family: SourceSumFamily): void;
}): SourceComponentOwner {
  const components = new WeakSet<SourceTypeComponent>();
  const roots = new WeakMap<Node, Map<string, SourceTypeComponent>>();
  const objects = new WeakMap<object, number>();
  let nextKey = 0;

  function objectKey(value: object): number {
    const previous = objects.get(value);
    if (previous !== undefined) return previous;
    const selected = nextKey++;
    objects.set(value, selected);
    return selected;
  }

  function nodeKey(value: Node): number {
    input.assertNode(value);
    return objectKey(value);
  }

  function ordinal(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("A Source component ordinal must be a nonnegative safe integer.");
    return value;
  }

  function signatureKey(value: SourceSignatureIdentity): number {
    input.assertSignature(value);
    return objectKey(value);
  }

  function originKey(value: SourceMemberOrigin): readonly unknown[] {
    return sourceMemberOriginKey(value, nodeKey);
  }

  function selectorKey(value: SourceComponentSelector): string {
    switch (value.kind) {
      case "optional-value": case "array-element": case "awaited": case "projection-source": case "intersection-result": return value.kind;
      case "index-key": case "index-value": return JSON.stringify([value.kind, nodeKey(value.declaration)]);
      case "tuple-element": case "union-member": case "intersection-member": case "argument-place": case "parameter-place": return JSON.stringify([value.kind, ordinal(value.index)]);
      case "argument-tail": case "parameter-tail": return JSON.stringify([value.kind, ordinal(value.start)]);
      case "member": return JSON.stringify([value.kind, originKey(value.origin)]);
      case "parameter": return JSON.stringify([value.kind, signatureKey(value.signature), ordinal(value.index)]);
      case "receiver": case "result": return JSON.stringify([value.kind, signatureKey(value.signature)]);
      case "signature-tail": return JSON.stringify([value.kind, signatureKey(value.signature), ordinal(value.start), value.readonly]);
      case "tuple-slice": return JSON.stringify([value.kind, ordinal(value.start), ordinal(value.endCount), value.readonly]);
      case "type-argument": return JSON.stringify([value.kind, nodeKey(value.declaration), ordinal(value.index)]);
      case "sum-arm": {
        input.assertFamily(value.family);
        return JSON.stringify([value.kind, objectKey(value.family), ordinal(value.index)]);
      }
    }
  }

  function snapshot(value: SourceComponentSelector): SourceComponentSelector {
    if (value.kind !== "member") return Object.freeze({ ...value });
    const origin = freezeSourceMemberOrigin(value.origin);
    return Object.freeze({ kind: "member", origin });
  }

  return Object.freeze({
    objectKey,
    selectorKey,
    assert(value: SourceTypeComponent): void {
      if (!components.has(value)) throw new Error("A Source component must belong to this exact descriptor view.");
    },
    identity(root: Node, path: readonly SourceComponentSelector[]): SourceTypeComponent {
      input.assertNode(root);
      const key = JSON.stringify(path.map(selectorKey));
      let entries = roots.get(root);
      if (entries === undefined) { entries = new Map(); roots.set(root, entries); }
      const previous = entries.get(key);
      if (previous !== undefined) return previous;
      const selected = Object.freeze({ root, path: Object.freeze(path.map(snapshot)) });
      components.add(selected);
      entries.set(key, selected);
      return selected;
    },
  });
}
