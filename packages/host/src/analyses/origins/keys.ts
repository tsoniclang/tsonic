// Canonical keys of the Origins kernel. While the body is solved, a value names its producers by canonical key, never
// by arena id: ids are given only when the arena is closed, in sorted key order, so the arena does not depend on how
// the lowered graph numbers its blocks (origins chapter 8.1; R6 G-5).
//
// A producer key is its root and its projection path. Roots: the receiver, a parameter by index, an allocation by
// the node of its creating statement. A path is the list of projection segments from the root. The key of the cell
// under producer P reached by segment s is the key of the producer P/s: the entry symbol of that cell when P's root
// is an entry producer, and the cell's own name when P is an allocation.
import type { InvariantFailure } from "../../diag/contract.js";
import { requirePresent, throwInvariant } from "../../diag/index.js";
import type { NodeId, Origin } from "../../ids/contract.js";
import type { MemberKey } from "../../ir-types/contract.js";
import type { MemberSelection } from "../../ir-tir/contract.js";

export type RootSpec =
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "allocation"; readonly node: NodeId };

export type SegmentSpec =
  | { readonly kind: "field"; readonly key: string; readonly member: MemberSelection }
  | { readonly kind: "index"; readonly index: number }
  | { readonly kind: "element" };

export interface ProducerSpec {
  readonly key: string;
  readonly root: RootSpec;
  readonly segments: readonly SegmentSpec[];
}

const missingSegment: InvariantFailure = { owner: "analyses/origins", query: null, origin: null,
  message: "origins: two paths of equal length differ in length" };

export const frontier =(origin: Origin | null, message: string): never => {
  const failure: InvariantFailure = { owner: "analyses/origins", query: null, origin, message: `origins: ${message}` };
  return throwInvariant(failure);
};

const rootKey = (root: RootSpec): string => {
  switch (root.kind) {
    case "receiver": return "r";
    case "parameter": return `p${root.index}`;
    case "allocation": return `a${root.node}`;
  }
};

const memberKeyText = (key: MemberKey): string => {
  switch (key.kind) {
    case "text": return `t${JSON.stringify(key.value)}`;
    case "number": return `n${key.value.numerator}/${key.value.denominator}/${String(key.value.negativeZero)}`;
    case "symbol": return `s${JSON.stringify(key.declaration)}`;
  }
};

export const fieldSegment = (member: MemberSelection): SegmentSpec =>
  ({ kind: "field", key: memberKeyText(member.decision.key), member });

const segmentKey = (segment: SegmentSpec): string => {
  switch (segment.kind) {
    case "field": return `f${segment.key}`;
    case "index": return `i${segment.index}`;
    case "element": return "e";
  }
};

export const rootSpec = (root: RootSpec): ProducerSpec => ({ key: rootKey(root), root, segments: [] });

export const childSpec = (parent: ProducerSpec, segment: SegmentSpec): ProducerSpec =>
  ({ key: `${parent.key}/${segmentKey(segment)}`, root: parent.root, segments: [...parent.segments, segment] });

// Ranks order keys without depending on how a body numbers anything: a kind rank, then a number, then a text.
type Rank = readonly [number, number, string];

const rootRank = (root: RootSpec): Rank => {
  switch (root.kind) {
    case "receiver": return [0, 0, ""];
    case "parameter": return [1, root.index, ""];
    case "allocation": return [2, root.node, ""];
  }
};

const segmentRank = (segment: SegmentSpec): Rank => {
  switch (segment.kind) {
    case "field": return [0, 0, segment.key];
    case "index": return [1, segment.index, ""];
    case "element": return [2, 0, ""];
  }
};

const compareRanks = (left: Rank, right: Rank): number =>
  (left[0] - right[0]) || (left[1] - right[1]) || (Number(left[2] > right[2]) - Number(left[2] < right[2]));

// Paths compare by length first, so a parent precedes each of its children, then segment by segment.
export const comparePaths = (left: readonly SegmentSpec[], right: readonly SegmentSpec[]): number =>
  (left.length - right.length) || left.reduce((order, segment, index) =>
    order || compareRanks(segmentRank(segment), segmentRank(requirePresent(right[index], missingSegment))), 0);

export const compareProducers = (left: ProducerSpec, right: ProducerSpec): number =>
  compareRanks(rootRank(left.root), rootRank(right.root)) || comparePaths(left.segments, right.segments);

export const pathKey = (segments: readonly SegmentSpec[]): string => segments.map(segmentKey).join("/");
