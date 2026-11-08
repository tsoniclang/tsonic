import type { Node } from "@tsonic/tsts";
import type { SourceDescriptorView, SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceLiteralUnitsEqual, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceLiteralKey } from "../source-model/literals/key.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceIndexInventoryRow, SourceMemberInventory, SourceMemberInventoryQueries, SourceMemberInventoryRow } from "./member-inventory.js";

export interface SourceCorrespondenceMember {
  readonly receiver: SourceTypeEvidence;
  readonly key: SourceLiteralKey;
  readonly name: string;
  readonly declarations: readonly Node[];
  readonly origins: readonly SourceMemberOrigin[];
  readonly readOrigins: readonly SourceMemberOrigin[];
  readonly writeOrigins: readonly SourceMemberOrigin[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly read: "property" | "accessor" | "method" | "unavailable";
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
}

export interface SourceCorrespondenceIndex {
  readonly receiver: SourceTypeEvidence;
  readonly declarations: readonly Node[];
  readonly keyType: SourceTypeEvidence;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly readonly: boolean;
}

export type SourceMemberPair =
  | { readonly kind: "present"; readonly source: SourceCorrespondenceMember; readonly destination: SourceCorrespondenceMember }
  | { readonly kind: "absent"; readonly destination: SourceCorrespondenceMember };

export interface SourceIndexPair {
  readonly destination: SourceCorrespondenceIndex;
  readonly sources: readonly {
    readonly source: SourceCorrespondenceIndex;
    readonly coverage: "yes" | "deferred";
  }[];
}

export type SourceMemberCorrespondence =
  | { readonly kind: "available"; readonly source: SourceTypeEvidence; readonly destination: SourceTypeEvidence;
      readonly members: readonly SourceMemberPair[]; readonly indexes: readonly SourceIndexPair[] }
  | { readonly kind: "unavailable"; readonly reason: "unresolved-shape" | "missing-required-member" |
      "inconsistent-member" | "unreadable-member" | "disjoint-shape" };

export interface SourceMemberCorrespondenceQueries {
  correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence,
    purpose: "correspondence" | "read"): SourceResult<SourceMemberCorrespondence>;
  correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
    purpose: "correspondence" | "read"): SourceResult<SourcePresence<SourceMemberPair>>;
}

export type SourceIndexKeyContains = (destination: SourceTypeEvidence,
  source: SourceTypeEvidence) => SourceProductionResult<"yes" | "no" | "deferred">;

export interface SourceMemberCorrespondenceProduction {
  correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence, purpose: "correspondence" | "read",
    keyContains: SourceIndexKeyContains): SourceProductionResult<SourceMemberCorrespondence>;
  correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
    purpose: "correspondence" | "read", keyContains: SourceIndexKeyContains): SourceProductionResult<SourcePresence<SourceMemberPair>>;
}

export function createSourceMemberCorrespondenceQueries(input: {
  readonly view: SourceDescriptorView;
  readonly inventory: SourceMemberInventoryQueries;
  readonly assertNode: (node: Node) => void;
  readonly domain: (value: SourceTypeEvidence) => SourceLiteralDomain;
}): SourceMemberCorrespondenceProduction {
  const { view, inventory, assertNode, domain } = input;
  type Unavailable = Extract<SourceMemberCorrespondence, { readonly kind: "unavailable" }>;
  interface Selection {
    readonly members: readonly SourceMemberPair[];
    readonly correspondence: SourceMemberCorrespondence;
    readonly readable: SourceMemberCorrespondence;
  }
  const selections = new WeakMap<SourceTypeEvidence, WeakMap<SourceTypeEvidence, Selection>>();
  const inventories = new WeakMap<SourceTypeEvidence, SourceMemberInventory>();
  const unavailable = (reason: Unavailable["reason"]): Unavailable => Object.freeze({ kind: "unavailable", reason });
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const sameKey = (left: SourceLiteralKey, right: SourceLiteralKey): boolean => left.kind === "name"
    ? right.kind === "name" && left.name === right.name : right.kind === "symbol" && left.declaration === right.declaration;
  const authenticateOrigins = (origins: readonly SourceMemberOrigin[]): void => {
    for (const origin of origins) {
      if (origin.kind === "declared") assertNode(origin.declaration);
      else {
        assertNode(origin.owner);
        if (origin.kind === "mapped" && origin.key.kind === "unique-symbol") assertNode(origin.key.declaration);
      }
    }
  };
  const authenticateMember = (member: SourceMemberInventoryRow): void => {
    if (member.key.kind === "symbol") assertNode(member.key.declaration);
    else if (member.key.name !== member.name) throw new Error("A Source member name must retain its canonical property key.");
    for (const declaration of [...member.declarations, ...member.getters, ...member.setters]) assertNode(declaration);
    authenticateOrigins(member.origins);
    authenticateOrigins(member.readOrigins);
    authenticateOrigins(member.writeOrigins);
    if (member.readType !== undefined) view.assertEvidence(member.readType);
    if (member.writeType !== undefined) view.assertEvidence(member.writeType);
  };
  const authenticateIndex = (index: SourceIndexInventoryRow): void => {
    for (const declaration of index.declarations) assertNode(declaration);
    view.assertEvidence(index.keyType);
    if (index.readType !== undefined) view.assertEvidence(index.readType);
    if (index.writeType !== undefined) view.assertEvidence(index.writeType);
  };
  const membersFor = (value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory> => {
    view.assertEvidence(value);
    const retained = inventories.get(value);
    if (retained !== undefined) return resolved(retained);
    const selected = inventory.members(value);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "complete") {
      for (const member of selected.value.members) authenticateMember(member);
      for (const index of selected.value.indexes) authenticateIndex(index);
    }
    inventories.set(value, selected.value);
    return selected;
  };
  const disjoint = (pair: SourceMemberPair): boolean => {
    if (pair.kind !== "present" || pair.source.optional || pair.destination.optional ||
      pair.source.readType === undefined || pair.destination.readType === undefined) return false;
    const from = domain(pair.source.readType), to = domain(pair.destination.readType);
    return from.kind === "finite" && to.kind === "finite" &&
      !from.values.some(origin => to.values.some(target => sourceLiteralUnitsEqual(origin, target)));
  };
  const select = (source: SourceTypeEvidence, destination: SourceTypeEvidence): SourceProductionResult<Selection> => {
    view.assertEvidence(source);
    view.assertEvidence(destination);
    const retained = selections.get(source)?.get(destination);
    if (retained !== undefined) return resolved(retained);
    const from = membersFor(source);
    if (from.kind !== "resolved") return from;
    const to = membersFor(destination);
    if (to.kind !== "resolved") return to;
    if (from.value.kind !== "complete" || to.value.kind !== "complete") {
      const result = unavailable("unresolved-shape");
      return resolved(Object.freeze({ members: Object.freeze([]), correspondence: result, readable: result }));
    }
    const arms: Extract<SourceMemberInventory, { readonly kind: "complete" }>[] = [];
    if (source.sum !== undefined) {
      for (const arm of source.sum.arms) {
        const selected = membersFor(arm);
        if (selected.kind !== "resolved") return selected;
        if (selected.value.kind !== "complete") {
          const result = unavailable("unresolved-shape");
          return resolved(Object.freeze({ members: Object.freeze([]), correspondence: result, readable: result }));
        }
        arms.push(selected.value);
      }
    }
    let failure: Unavailable | undefined;
    let readFailure: Unavailable | undefined;
    let ambiguous = false;
    const pairs: SourceMemberPair[] = [];
    for (const rows of [from.value.members, to.value.members]) {
      for (let index = 0; index < rows.length; index++) {
        if (!rows.slice(0, index).some(previous => sameKey(previous.key, rows[index]!.key))) continue;
        failure = unavailable("inconsistent-member");
        readFailure = failure;
        ambiguous = true;
      }
    }
    for (const member of to.value.members) {
      const required: SourceCorrespondenceMember = Object.freeze({ ...member, receiver: destination });
      const candidates = from.value.members.filter(candidate => sameKey(candidate.key, member.key));
      const presence = arms.map(arm => arm.members.filter(candidate => sameKey(candidate.key, member.key)).length);
      if (presence.some(count => count !== 0) && presence.some(count => count !== 1)) {
        failure ??= unavailable("inconsistent-member");
        readFailure ??= failure;
        continue;
      }
      if (candidates.length > 1) continue;
      if (candidates.length === 0) {
        pairs.push(Object.freeze({ kind: "absent", destination: required }));
        if (!member.optional) {
          failure ??= unavailable("missing-required-member");
          readFailure ??= failure;
        }
        continue;
      }
      if (presence.some(count => count !== 1)) {
        failure ??= unavailable("inconsistent-member");
        readFailure ??= failure;
        continue;
      }
      const actual: SourceCorrespondenceMember = Object.freeze({ ...candidates[0]!, receiver: source });
      if (actual.read === "unavailable" || actual.readType === undefined) readFailure ??= unavailable("unreadable-member");
      pairs.push(Object.freeze({ kind: "present", source: actual, destination: required }));
    }
    const literalDisjoint = pairs.some(disjoint);
    if (literalDisjoint) { failure = unavailable("disjoint-shape"); readFailure = failure; }
    const members = Object.freeze(pairs);
    const available: SourceMemberCorrespondence = Object.freeze({ kind: "available", source, destination,
      members, indexes: Object.freeze([]) });
    const result: Selection = Object.freeze({ members: ambiguous || literalDisjoint ? Object.freeze([]) : members,
      correspondence: failure ?? available, readable: readFailure ?? failure ?? available });
    let destinations = selections.get(source);
    if (destinations === undefined) { destinations = new WeakMap(); selections.set(source, destinations); }
    destinations.set(destination, result);
    return resolved(result);
  };
  const assertPurpose = (purpose: "correspondence" | "read"): void => {
    if (purpose !== "correspondence" && purpose !== "read")
      throw new TypeError("Source member correspondence requires an explicit correspondence or read purpose.");
  };
  return Object.freeze({
    correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence, purpose: "correspondence" | "read",
      keyContains: SourceIndexKeyContains): SourceProductionResult<SourceMemberCorrespondence> {
      assertPurpose(purpose);
      const selected = select(source, destination);
      if (selected.kind !== "resolved") return selected;
      const result = purpose === "read" ? selected.value.readable : selected.value.correspondence;
      if (result.kind !== "available") return resolved(result);
      const from = membersFor(source), to = membersFor(destination);
      if (from.kind !== "resolved") return from;
      if (to.kind !== "resolved") return to;
      if (from.value.kind !== "complete" || to.value.kind !== "complete") return resolved(unavailable("unresolved-shape"));
      const indexes: SourceIndexPair[] = [];
      for (const target of to.value.indexes) {
        const candidates: SourceIndexPair["sources"][number][] = [];
        for (const actual of from.value.indexes) {
          const coverage = keyContains(target.keyType, actual.keyType);
          if (coverage.kind !== "resolved") return coverage;
          if (coverage.value !== "no") candidates.push(Object.freeze({
            source: Object.freeze({ ...actual, receiver: source }), coverage: coverage.value }));
        }
        indexes.push(Object.freeze({ destination: Object.freeze({ ...target, receiver: destination }), sources: Object.freeze(candidates) }));
      }
      return resolved(Object.freeze({ ...result, indexes: Object.freeze(indexes) }));
    },
    correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
      purpose: "correspondence" | "read", _keyContains: SourceIndexKeyContains): SourceProductionResult<SourcePresence<SourceMemberPair>> {
      assertPurpose(purpose);
      assertNode(declaration);
      const selected = select(source, destination);
      if (selected.kind !== "resolved") return selected;
      const matches = selected.value.members.filter(member => member.destination.declarations.includes(declaration));
      if (matches.length !== 1) return resolved(Object.freeze({ kind: "none" }));
      const member = matches[0]!;
      if (member.kind === "present" && (member.source.declarations.length === 0 ||
        purpose === "read" && (member.source.read === "unavailable" || member.source.readType === undefined)))
        return resolved(Object.freeze({ kind: "none" }));
      return resolved(Object.freeze({ kind: "present", value: member }));
    },
  });
}
