import type { KeyData, SourceNodeRef } from "../ids/contract.js";
import type { ComponentSelector, MemberKey, MemberOrigin } from "./data.js";

interface SelectorPathWork {
  readonly path: readonly ComponentSelector[];
  readonly into: KeyData[];
}

function sourceKey(node: SourceNodeRef): readonly KeyData[] {
  return node.kind === "body" ? [node.kind, node.value.body, node.value.node] : [node.kind, node.value.owner, node.value.node];
}

function memberKeyData(key: MemberKey): readonly KeyData[] {
  switch (key.kind) {
    case "text": return [key.kind, key.value];
    case "number": return [key.kind, key.value.numerator, key.value.denominator, key.value.negativeZero];
    case "symbol": return [key.kind, key.declaration];
  }
}

function originKey(origin: MemberOrigin): readonly KeyData[] {
  switch (origin.kind) {
    case "declared": return [origin.kind, origin.declaration];
    case "class-prototype": return [origin.kind, origin.owner];
    case "mapped": return [origin.kind, sourceKey(origin.owner), memberKeyData(origin.key)];
  }
}

function selectorKey(selected: ComponentSelector, work: SelectorPathWork[]): readonly KeyData[] {
  switch (selected.kind) {
    case "class-value": case "optional-value": case "array-element": case "intersection-result":
    case "projection-source": case "awaited": return [selected.kind];
    case "construction-argument": return [selected.kind, [selected.definition.occurrence.body, selected.definition.occurrence.node],
      selected.definition.captures.map(capture => [capture.body, capture.local]), selected.index];
    case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
    case "intersection-member": return [selected.kind, selected.index];
    case "argument-tail": case "parameter-tail": return [selected.kind, selected.start];
    case "member": return [selected.kind, originKey(selected.origin)];
    case "index-key": case "index-value": return [selected.kind, selected.declaration];
    case "parameter": return [selected.kind, selected.signature, selected.index];
    case "receiver": case "result": return [selected.kind, selected.signature];
    case "signature-tail": return [selected.kind, selected.signature, selected.start, selected.readonly];
    case "tuple-slice": return [selected.kind, selected.start, selected.endCount, selected.readonly];
    case "type-argument": return [selected.kind, selected.declaration, selected.index];
    case "sum-arm": {
      const nested: KeyData[] = [];
      work.push({ path: selected.family.component.path, into: nested });
      return [selected.kind, selected.family.origin, sourceKey(selected.family.component.root), nested,
        selected.family.parameters.map(parameter => [parameter.owner, parameter.index]),
        selected.family.roles.map(role => [role.authoredIndex, sourceKey(role.component), role.member]), selected.index];
    }
  }
}

/**
 * The one encoding of a selector path as key data. Diag's unit position of kind "component" holds exactly this
 * value for the path of the type component it names; no producer encodes a path by other means, so one component
 * has one identity. Equal paths give equal key data and different paths give different key data: every selector
 * is one array that begins with its kind and has a fixed number of entries for that kind, and every nested
 * collection is its own array. A sum family's own component path is encoded by the same function, without native
 * recursion.
 */
export function selectorPathKey(path: readonly ComponentSelector[]): readonly KeyData[] {
  const root: KeyData[] = [];
  const work: SelectorPathWork[] = [{ path, into: root }];
  for (let frame = work.pop(); frame !== undefined; frame = work.pop()) {
    for (const selected of frame.path) frame.into.push(selectorKey(selected, work));
  }
  return root;
}
