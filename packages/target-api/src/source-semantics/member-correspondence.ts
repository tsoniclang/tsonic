import type { Node } from "@tsonic/tsts";
import type { SourceDescriptorView, SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceLiteralUnitsEqual, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import { sourceLiteralUnitKey, type SourceLiteralKey } from "../source-model/literals/key.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceIndexInventoryRow, SourceMemberInventory, SourceMemberInventoryQueries, SourceMemberInventoryRow, SourceMemberSubject } from "./member-inventory.js";

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

export type SourceCorrespondenceMemberIdentity = Omit<SourceCorrespondenceMember, "receiver" | "readType" | "writeType">;

export type SourceMemberPair<Member extends SourceCorrespondenceMemberIdentity = SourceCorrespondenceMember> =
  | { readonly kind: "present"; readonly source: Member; readonly destination: Member }
  | { readonly kind: "absent"; readonly destination: Member };

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

export type SourceIndexedMemberSelection =
  | { readonly kind: "available"; readonly members: readonly SourceMemberInventoryRow[];
      readonly indexes: readonly SourceIndexInventoryRow[] }
  | { readonly kind: "unavailable"; readonly reason: "unresolved-shape" | "unresolved-key" | "missing-member" | "unreadable-member" };

export interface SourceMemberCorrespondenceProduction {
  indexed(receiver: SourceTypeEvidence, key: SourceTypeEvidence,
    keyContains: SourceIndexKeyContains): SourceProductionResult<SourceIndexedMemberSelection>;
  correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence, purpose: "correspondence" | "read",
    keyContains: SourceIndexKeyContains): SourceProductionResult<SourceMemberCorrespondence>;
  correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
    purpose: "correspondence" | "read", keyContains: SourceIndexKeyContains): SourceProductionResult<SourcePresence<SourceMemberPair>>;
  correspondingDeclarations(source: SourceMemberSubject, destination: SourceMemberSubject, role: "source" | "destination",
    declaration: Node): SourceProductionResult<SourcePresence<SourceMemberPair<SourceMemberInventoryRow>> | { readonly kind: "unavailable" }>;
  protocolMember(receiver: SourceTypeEvidence, role: "next" | "done" | "value"):
    SourceProductionResult<SourcePresence<SourceMemberInventoryRow> | { readonly kind: "unavailable" }>;
}

export function createSourceMemberCorrespondenceQueries(input: {
  readonly view: SourceDescriptorView;
  readonly inventory: SourceMemberInventoryQueries;
  readonly assertNode: (node: Node) => void;
  readonly domain: (value: SourceTypeEvidence) => SourceLiteralDomain;
}): SourceMemberCorrespondenceProduction {
  const { view, inventory, assertNode, domain } = input;
  type Unavailable = Extract<SourceMemberCorrespondence, { readonly kind: "unavailable" }>;
  type IdentityPair = SourceMemberPair<SourceMemberInventoryRow>;
  interface Selection {
    readonly members: readonly IdentityPair[];
    readonly failure: Unavailable | undefined;
  }
  const selections = new WeakMap<Node | SourceTypeEvidence, WeakMap<Node | SourceTypeEvidence, Selection>>();
  const inventories = new WeakMap<Node | SourceTypeEvidence, Extract<SourceMemberInventory, { readonly kind: "complete" }>>();
  const rowIndexes = new WeakMap<Node | SourceTypeEvidence, ReadonlyMap<string | Node, readonly SourceMemberInventoryRow[]>>();
  const members = new WeakMap<SourceTypeEvidence, WeakMap<SourceMemberInventoryRow, Map<"correspondence" | "read", SourceCorrespondenceMember>>>();
  const unavailable = (reason: Unavailable["reason"]): Unavailable => Object.freeze({ kind: "unavailable", reason });
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const key = (value: SourceLiteralKey): string | Node => value.kind === "name" ? value.name : value.declaration;
  const evidence = (value: SourceTypeEvidence): SourceMemberSubject => ({ kind: "evidence", value });
  const subjectKey = (subject: SourceMemberSubject): Node | SourceTypeEvidence => {
    if (subject.kind === "evidence") { view.assertEvidence(subject.value); return subject.value; }
    assertNode(subject.occurrence);
    return subject.occurrence;
  };
  const authenticateOrigins = (origins: readonly SourceMemberOrigin[]): void => {
    for (const origin of origins) {
      if (origin.kind === "declared") assertNode(origin.declaration);
      else {
        assertNode(origin.owner);
        if (origin.kind === "mapped" && origin.key.kind === "unique-symbol") assertNode(origin.key.declaration);
      }
    }
  };
  const membersFor = (subject: SourceMemberSubject): SourceProductionResult<SourceMemberInventory> => {
    const value = subjectKey(subject);
    const retained = inventories.get(value);
    if (retained !== undefined) return resolved(retained);
    const selected = subject.kind === "evidence" ? inventory.members(subject.value) : inventory.construction(subject.occurrence);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind !== "complete") return selected;
    for (const member of selected.value.members) {
      if (member.key.kind === "symbol") assertNode(member.key.declaration);
      else if (member.key.name !== member.name) throw new Error("A Source member name must retain its canonical property key.");
      for (const declaration of [...member.declarations, ...member.getters, ...member.setters]) assertNode(declaration);
      authenticateOrigins(member.origins);
      authenticateOrigins(member.readOrigins);
      authenticateOrigins(member.writeOrigins);
    }
    for (const index of selected.value.indexes) for (const declaration of index.declarations) assertNode(declaration);
    const indexed = new Map<string | Node, SourceMemberInventoryRow[]>();
    for (const member of selected.value.members) {
      const identity = key(member.key);
      const previous = indexed.get(identity);
      if (previous === undefined) indexed.set(identity, [member]);
      else previous.push(member);
    }
    rowIndexes.set(value, indexed);
    inventories.set(value, selected.value);
    return selected;
  };
  const component = (produce: () => SourceProductionResult<SourcePresence<SourceTypeEvidence>>):
    SourceProductionResult<SourceTypeEvidence | undefined> => {
    const selected = produce();
    if (selected.kind !== "resolved") return selected;
    if (selected.value.kind === "none") return resolved(undefined);
    view.assertEvidence(selected.value.value);
    return resolved(selected.value.value);
  };
  const member = (receiver: SourceTypeEvidence, row: SourceMemberInventoryRow,
    purpose: "correspondence" | "read"): SourceProductionResult<SourceCorrespondenceMember> => {
    view.assertEvidence(receiver);
    let byRow = members.get(receiver);
    let byPurpose = byRow?.get(row);
    const retained = byPurpose?.get(purpose);
    if (retained !== undefined) return resolved(retained);
    const readType = component(() => row.readType());
    if (readType.kind !== "resolved") return readType;
    const writeType = purpose === "read" ? resolved(undefined) : component(() => row.writeType());
    if (writeType.kind !== "resolved") return writeType;
    const selected: SourceCorrespondenceMember = Object.freeze({ receiver, key: row.key, name: row.name,
      declarations: row.declarations, origins: row.origins, readOrigins: row.readOrigins, writeOrigins: row.writeOrigins,
      getters: row.getters, setters: row.setters, read: row.read, optional: row.optional, readonly: row.readonly,
      readType: readType.value, writeType: writeType.value });
    if (byRow === undefined) { byRow = new WeakMap(); members.set(receiver, byRow); }
    if (byPurpose === undefined) { byPurpose = new Map(); byRow.set(row, byPurpose); }
    byPurpose.set(purpose, selected);
    return resolved(selected);
  };
  const pair = (source: SourceTypeEvidence, target: SourceTypeEvidence, original: IdentityPair,
    purpose: "correspondence" | "read"): SourceProductionResult<SourceMemberPair> => {
    const destination = member(target, original.destination, purpose);
    if (destination.kind !== "resolved") return destination;
    if (original.kind === "absent") return resolved(Object.freeze({ kind: "absent", destination: destination.value }));
    const actual = member(source, original.source, purpose);
    return actual.kind !== "resolved" ? actual : resolved(Object.freeze({ kind: "present", source: actual.value, destination: destination.value }));
  };
  const disjoint = (selected: SourceMemberPair): boolean => {
    if (selected.kind !== "present" || selected.source.optional || selected.destination.optional ||
      selected.source.readType === undefined || selected.destination.readType === undefined) return false;
    const from = domain(selected.source.readType), to = domain(selected.destination.readType);
    return from.kind === "finite" && to.kind === "finite" &&
      !from.values.some(origin => to.values.some(target => sourceLiteralUnitsEqual(origin, target)));
  };
  const select = (source: SourceMemberSubject, destination: SourceMemberSubject): SourceProductionResult<Selection> => {
    const sourceKey = subjectKey(source), destinationKey = subjectKey(destination);
    const retained = selections.get(sourceKey)?.get(destinationKey);
    if (retained !== undefined) return resolved(retained);
    const from = membersFor(source);
    if (from.kind !== "resolved") return from;
    const to = membersFor(destination);
    if (to.kind !== "resolved") return to;
    if (from.value.kind !== "complete" || to.value.kind !== "complete")
      return resolved(Object.freeze({ members: Object.freeze([]), failure: unavailable("unresolved-shape") }));
    const arms: Extract<SourceMemberInventory, { readonly kind: "complete" }>[] = [];
    if (source.kind === "evidence" && source.value.sum !== undefined) for (const arm of source.value.sum.arms) {
      const selected = membersFor(evidence(arm));
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind !== "complete")
        return resolved(Object.freeze({ members: Object.freeze([]), failure: unavailable("unresolved-shape") }));
      arms.push(selected.value);
    }
    let failure: Unavailable | undefined;
    let ambiguous = false;
    const pairs: IdentityPair[] = [];
    for (const subject of [source, destination]) for (const values of rowIndexes.get(subjectKey(subject))!.values()) {
      if (values.length <= 1) continue;
      failure = unavailable("inconsistent-member");
      ambiguous = true;
    }
    for (const target of to.value.members) {
      const candidates = rowIndexes.get(sourceKey)!.get(key(target.key)) ?? [];
      const presence = arms.map(arm => arm.members.filter(candidate => key(candidate.key) === key(target.key)).length);
      if (candidates.length > 1 || presence.some(count => count !== 0) && presence.some(count => count !== 1)) {
        failure ??= unavailable("inconsistent-member");
        continue;
      }
      if (candidates.length === 0) {
        pairs.push(Object.freeze({ kind: "absent", destination: target }));
        if (!target.optional) failure ??= unavailable("missing-required-member");
      } else if (presence.some(count => count !== 1)) failure ??= unavailable("inconsistent-member");
      else pairs.push(Object.freeze({ kind: "present", source: candidates[0]!, destination: target }));
    }
    const result: Selection = Object.freeze({ members: ambiguous ? Object.freeze([]) : Object.freeze(pairs), failure });
    let destinations = selections.get(sourceKey);
    if (destinations === undefined) { destinations = new WeakMap(); selections.set(sourceKey, destinations); }
    destinations.set(destinationKey, result);
    return resolved(result);
  };
  const index = (receiver: SourceTypeEvidence, row: SourceIndexInventoryRow,
    purpose: "correspondence" | "read"): SourceProductionResult<SourceCorrespondenceIndex> => {
    const keyType = row.keyType();
    if (keyType.kind !== "resolved") return keyType;
    view.assertEvidence(keyType.value);
    const readType = component(() => row.readType());
    if (readType.kind !== "resolved") return readType;
    const writeType = purpose === "read" ? resolved(undefined) : component(() => row.writeType());
    return writeType.kind !== "resolved" ? writeType : resolved(Object.freeze({ receiver, declarations: row.declarations,
      keyType: keyType.value, readType: readType.value, writeType: writeType.value, readonly: row.readonly }));
  };
  const assertPurpose = (purpose: "correspondence" | "read"): void => {
    if (purpose !== "correspondence" && purpose !== "read")
      throw new TypeError("Source member correspondence requires an explicit correspondence or read purpose.");
  };
  const queries: SourceMemberCorrespondenceProduction = Object.freeze({
    indexed(receiver: SourceTypeEvidence, selectedKey: SourceTypeEvidence,
      keyContains: SourceIndexKeyContains): SourceProductionResult<SourceIndexedMemberSelection> {
      view.assertEvidence(receiver);
      view.assertEvidence(selectedKey);
      const selectedMembers = new Set<SourceMemberInventoryRow>();
      const selectedIndexes = new Set<SourceIndexInventoryRow>();
      for (const arm of receiver.sum?.arms ?? [receiver]) {
        const original = membersFor(evidence(arm));
        if (original.kind !== "resolved") return original;
        if (original.value.kind !== "complete") return resolved(Object.freeze({ kind: "unavailable", reason: "unresolved-shape" }));
        for (const keyArm of selectedKey.sum?.arms ?? [selectedKey]) {
          view.assertEvidence(keyArm);
          const keyDomain = domain(keyArm);
          if (keyDomain.kind === "unreachable") continue;
          const named: SourceMemberInventoryRow[] = [];
          let unmatched = false;
          if (keyDomain.kind === "finite") {
            for (const unit of keyDomain.values) {
              const selected = sourceLiteralUnitKey(unit);
              if (selected === undefined) return resolved(Object.freeze({ kind: "unavailable", reason: "unresolved-key" }));
              const candidates = rowIndexes.get(arm)!.get(key(selected)) ?? [];
              if (candidates.length > 1) return resolved(Object.freeze({ kind: "unavailable", reason: "unresolved-shape" }));
              if (candidates.length === 0) unmatched = true;
              else named.push(candidates[0]!);
            }
            if (!unmatched) {
              if (named.some(row => row.read === "unavailable"))
                return resolved(Object.freeze({ kind: "unavailable", reason: "unreadable-member" }));
              for (const row of named) selectedMembers.add(row);
              continue;
            }
            if (named.length !== 0) return resolved(Object.freeze({ kind: "unavailable", reason: "unresolved-key" }));
          }
          let matched = false;
          const deferred: SourceTypeEvidence[] = [];
          for (const candidate of original.value.indexes) {
            const indexKey = candidate.keyType();
            if (indexKey.kind !== "resolved") return indexKey;
            view.assertEvidence(indexKey.value);
            const coverage = keyContains(keyArm, indexKey.value);
            if (coverage.kind !== "resolved") return coverage;
            if (coverage.value === "deferred") deferred.push(indexKey.value);
            else if (coverage.value === "yes") { selectedIndexes.add(candidate); matched = true; }
          }
          if (deferred.length !== 0) return Object.freeze({ kind: "pending",
            dependencies: Object.freeze([keyArm.component, ...deferred.map(value => value.component)]) });
          if (!matched) return resolved(Object.freeze({ kind: "unavailable", reason: "missing-member" }));
        }
      }
      return resolved(Object.freeze({ kind: "available", members: Object.freeze([...selectedMembers]),
        indexes: Object.freeze([...selectedIndexes]) }));
    },
    protocolMember(receiver: SourceTypeEvidence, role: "next" | "done" | "value"):
      SourceProductionResult<SourcePresence<SourceMemberInventoryRow> | { readonly kind: "unavailable" }> {
      if (role !== "next" && role !== "done" && role !== "value")
        throw new TypeError("Source protocol member selection requires its canonical next, done or value role.");
      const selected = membersFor(evidence(receiver));
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind !== "complete") return resolved(Object.freeze({ kind: "unavailable" }));
      const candidates = rowIndexes.get(receiver)!.get(role) ?? [];
      if (candidates.length > 1) return resolved(Object.freeze({ kind: "unavailable" }));
      return resolved(candidates.length === 1 ? Object.freeze({ kind: "present", value: candidates[0]! }) : Object.freeze({ kind: "none" }));
    },
    correspondingDeclarations(source: SourceMemberSubject, destination: SourceMemberSubject, role: "source" | "destination",
      declaration: Node): SourceProductionResult<SourcePresence<IdentityPair> | { readonly kind: "unavailable" }> {
      if (role !== "source" && role !== "destination") throw new TypeError("Source declaration correspondence requires its explicit source or destination role.");
      assertNode(declaration);
      const selected = select(source, destination);
      if (selected.kind !== "resolved") return selected;
      const matches = selected.value.members.filter(value => role === "destination" ? value.destination.declarations.includes(declaration)
        : value.kind === "present" && value.source.declarations.includes(declaration));
      if (matches.length === 1) return resolved(Object.freeze({ kind: "present", value: matches[0]! }));
      return resolved(selected.value.failure?.reason === "unresolved-shape" || selected.value.failure?.reason === "inconsistent-member"
        ? Object.freeze({ kind: "unavailable" }) : Object.freeze({ kind: "none" }));
    },
    correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence, purpose: "correspondence" | "read",
      keyContains: SourceIndexKeyContains): SourceProductionResult<SourceMemberCorrespondence> {
      assertPurpose(purpose);
      const selected = select(evidence(source), evidence(destination));
      if (selected.kind !== "resolved") return selected;
      const published: SourceMemberPair[] = [];
      let failure = selected.value.failure;
      for (const original of selected.value.members) {
        const current = pair(source, destination, original, purpose);
        if (current.kind !== "resolved") return current;
        if (purpose === "read" && current.value.kind === "present" &&
          (current.value.source.read === "unavailable" || current.value.source.readType === undefined)) failure ??= unavailable("unreadable-member");
        published.push(current.value);
      }
      if (published.some(disjoint)) return resolved(unavailable("disjoint-shape"));
      if (failure !== undefined) return resolved(failure);
      const from = membersFor(evidence(source)), to = membersFor(evidence(destination));
      if (from.kind !== "resolved") return from;
      if (to.kind !== "resolved") return to;
      if (from.value.kind !== "complete" || to.value.kind !== "complete") return resolved(unavailable("unresolved-shape"));
      const indexes: SourceIndexPair[] = [];
      for (const target of to.value.indexes) {
        const destinationIndex = index(destination, target, purpose);
        if (destinationIndex.kind !== "resolved") return destinationIndex;
        const candidates: SourceIndexPair["sources"][number][] = [];
        for (const actual of from.value.indexes) {
          const sourceIndex = index(source, actual, purpose);
          if (sourceIndex.kind !== "resolved") return sourceIndex;
          const coverage = keyContains(destinationIndex.value.keyType, sourceIndex.value.keyType);
          if (coverage.kind !== "resolved") return coverage;
          if (coverage.value !== "no") candidates.push(Object.freeze({ source: sourceIndex.value, coverage: coverage.value }));
        }
        indexes.push(Object.freeze({ destination: destinationIndex.value, sources: Object.freeze(candidates) }));
      }
      return resolved(Object.freeze({ kind: "available", source, destination, members: Object.freeze(published), indexes: Object.freeze(indexes) }));
    },
    correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
      purpose: "correspondence" | "read", _keyContains: SourceIndexKeyContains): SourceProductionResult<SourcePresence<SourceMemberPair>> {
      assertPurpose(purpose);
      const selected = queries.correspondingDeclarations(evidence(source), evidence(destination), "destination", declaration);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind !== "present") return resolved(Object.freeze({ kind: "none" }));
      const all = select(evidence(source), evidence(destination));
      if (all.kind !== "resolved") return all;
      for (const original of all.value.members) {
        if (original.kind !== "present" || original.source.optional || original.destination.optional) continue;
        const from = original.source.readDomain([]), to = original.destination.readDomain([]);
        if (from.kind !== "resolved") return from;
        if (to.kind !== "resolved") return to;
        if (from.value.kind === "finite" && to.value.kind === "finite" &&
          !from.value.values.some(origin => to.value.kind === "finite" && to.value.values.some(target => sourceLiteralUnitsEqual(origin, target))))
          return resolved(Object.freeze({ kind: "none" }));
      }
      const current = pair(source, destination, selected.value.value, purpose);
      if (current.kind !== "resolved") return current;
      if (current.value.kind === "present" && (current.value.source.declarations.length === 0 ||
        purpose === "read" && (current.value.source.read === "unavailable" || current.value.source.readType === undefined)))
        return resolved(Object.freeze({ kind: "none" }));
      return resolved(Object.freeze({ kind: "present", value: current.value }));
    },
  });
  return queries;
}
