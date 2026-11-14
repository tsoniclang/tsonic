// Canonical keys of the Origins kernel. While the body is solved, a value names its producers by canonical key, never
// by arena id: ids are given only when the arena is closed, in sorted key order, so the arena does not depend on how
// the lowered graph numbers its blocks (origins chapter 8.1; R6 G-5).
//
// A producer key is its root and its projection path. Roots: the receiver, a parameter by index, an allocation by
// the node of its creating statement. A path is the list of projection segments from the root. The key of the cell
// under producer P reached by segment s is the key of the producer P/s: the entry symbol of that cell when P's root
// is an entry producer, and the cell's own name when P is an allocation.
import type { InvariantFailure } from "../../diag/contract.js";
import { throwInvariant } from "../../diag/index.js";
import type { NodeId, Origin } from "../../ids/contract.js";
import { encodeKey } from "../../ids/index.js";
import type { MemberSelection } from "../../ir-tir/contract.js";
import { memberSelectionKey, memberStorageKey } from "../../ir-tir/index.js";
import type { DataflowAccount, DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeWork } from "../../dataflow/index.js";
import type { BindingVector, MemberKey } from "../../ir-types/contract.js";

const textWork = (account: DataflowAccount, text: string): boolean => chargeWork(account, 8 * (1 + text.length)) === null;

export const bindingWork = (account: DataflowAccount, bindings: BindingVector): boolean => {
  if (chargeWork(account, 4) !== null) return false;
  for (const rows of [bindings.classBindings, bindings.methodBindings, bindings.capturedBindings]) {
    if (chargeWork(account, 8 * rows.length) !== null) return false;
    for (const row of rows) if (!textWork(account, row.parameter.owner)) return false;
  }
  if (chargeWork(account, 8 * bindings.selfBindings.length) !== null) return false;
  for (const row of bindings.selfBindings) if (!textWork(account, row.owner)) return false;
  return true;
};

const keyWork = (account: DataflowAccount, key: MemberKey): boolean => key.kind === "text" ? textWork(account, key.value)
  : key.kind === "symbol" ? textWork(account, key.declaration) : chargeWork(account, 8) === null;

export const memberWork = (account: DataflowAccount, member: MemberSelection): boolean => {
  if (chargeWork(account, 16) !== null) return false;
  const decision = member.decision;
  if (!keyWork(account, decision.key) || !bindingWork(account, decision.bindings)) return false;
  if (chargeWork(account, 8 * (decision.origins.length + decision.selectedDeclarations.length)) !== null) return false;
  for (const origin of decision.origins) {
    switch (origin.kind) {
      case "declared": if (!textWork(account, origin.declaration)) return false; break;
      case "class-prototype": if (!textWork(account, origin.owner)) return false; break;
      case "mapped":
        if (!textWork(account, origin.owner.kind === "body" ? origin.owner.value.body : origin.owner.value.owner)
          || !keyWork(account, origin.key)) return false;
        break;
    }
  }
  for (const declaration of decision.selectedDeclarations) if (!textWork(account, declaration)) return false;
  if (decision.primary !== null && !textWork(account, decision.primary)) return false;
  return true;
};

export const segmentWork = (account: DataflowAccount, segment: SegmentSpec | null): boolean =>
  segment !== null && segment.kind === "field" ? memberWork(account, segment.member) : chargeWork(account, 1) === null;

export type RootSpec =
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "allocation"; readonly node: NodeId };

export type SegmentSpec =
  | { readonly kind: "field"; readonly key: string; readonly member: MemberSelection }
  | { readonly kind: "index"; readonly index: number }
  | { readonly kind: "element" };

export type ProducerSpec = {
  readonly key: string;
  readonly root: RootSpec;
  readonly depth: number;
} & (
  | { readonly parent: null; readonly segment: null }
  | { readonly parent: number; readonly segment: SegmentSpec }
);

export const frontier =(origin: Origin | null, message: string): never => {
  const failure: InvariantFailure = { owner: "analyses/origins", query: null, origin, message: `origins: ${message}` };
  return throwInvariant(failure);
};

export const requiredStop = (account: DataflowAccount): DataflowStop => {
  const failure = accountFailure(account);
  return failure === null ? frontier(null, "caller defect: a failed operation has no invocation stop") : failure;
};

const rootKey = (root: RootSpec): string => {
  switch (root.kind) {
    case "receiver": return "r";
    case "parameter": return `p${root.index}`;
    case "allocation": return `a${root.node}`;
  }
};

export const fieldSegment = (member: MemberSelection): SegmentSpec => {
  if (member.decision.location.kind !== "data") return frontier(null, "caller defect: a field projection does not select a data location");
  return { kind: "field", key: encodeKey(memberStorageKey(member)), member };
};

export const segmentKey = (segment: SegmentSpec): string => {
  switch (segment.kind) {
    case "field": return `f${segment.key}`;
    case "index": return `i${segment.index}`;
    case "element": return "e";
  }
};

export const representativeKey = (segment: SegmentSpec | null): string =>
  segment !== null && segment.kind === "field" ? encodeKey(memberSelectionKey(segment.member)) : "";

export const rootSpec = (root: RootSpec): ProducerSpec => ({ key: rootKey(root), root, parent: null, segment: null, depth: 0 });

export const childSpec = (parent: ProducerSpec, parentId: number, segment: SegmentSpec): ProducerSpec =>
  ({ key: `${parentId}/${segmentKey(segment)}`, root: parent.root, parent: parentId, segment, depth: parent.depth + 1 });

const rootRank = (root: RootSpec): number => {
  switch (root.kind) {
    case "receiver": return 0;
    case "parameter": return 1;
    case "allocation": return 2;
  }
};

const segmentRank = (segment: SegmentSpec): number => {
  switch (segment.kind) {
    case "field": return 0;
    case "index": return 1;
    case "element": return 2;
  }
};

export const compareRoots = (left: RootSpec, right: RootSpec): number => {
  const rank = rootRank(left) - rootRank(right);
  if (rank !== 0) return rank;
  const value = (root: RootSpec): number => root.kind === "receiver" ? 0 : root.kind === "parameter" ? root.index : root.node;
  return value(left) - value(right);
};

export const compareSegments = (left: SegmentSpec, right: SegmentSpec): number => {
  const rank = segmentRank(left) - segmentRank(right);
  if (rank !== 0) return rank;
  if (left.kind === "field" && right.kind === "field") return Number(left.key > right.key) - Number(left.key < right.key);
  return left.kind === "index" && right.kind === "index" ? left.index - right.index : 0;
};
