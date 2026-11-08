import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceInputCorrespondenceMember, SourceInputMemberPair, SourceMemberCorrespondenceInput } from "../host-input/member-input.js";
import type { SourceDescriptorView, SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import { sourceLiteralUnitsEqual, type SourceLiteralDomain } from "../source-model/literals/domain.js";

export interface SourceCorrespondenceMember {
  readonly receiver: SourceTypeEvidence;
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

export type SourceMemberPair =
  | { readonly kind: "present"; readonly source: SourceCorrespondenceMember; readonly destination: SourceCorrespondenceMember }
  | { readonly kind: "absent"; readonly destination: SourceCorrespondenceMember };

export type SourceMemberCorrespondence =
  | { readonly kind: "available"; readonly source: SourceTypeEvidence; readonly destination: SourceTypeEvidence;
      readonly members: readonly SourceMemberPair[] }
  | { readonly kind: "unavailable"; readonly reason: "unresolved-shape" | "missing-required-member" |
      "inconsistent-member" | "unreadable-member" | "disjoint-shape" };

export interface SourceMemberCorrespondenceQueries {
  correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence,
    purpose: "correspondence" | "read"): SourceResult<SourceMemberCorrespondence>;
  correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
    purpose: "correspondence" | "read"): SourceResult<SourcePresence<SourceMemberPair>>;
}

export function createSourceMemberCorrespondenceQueries(input: {
  readonly view: SourceDescriptorView;
  readonly members: SourceMemberCorrespondenceInput;
  readonly assertNode: (node: Node) => void;
  readonly originalComponent: (value: SourceTypeEvidence) => SourceInputComponent;
  readonly publish: (receiver: SourceTypeEvidence, component: SourceInputComponent) => SourceResult<SourceTypeEvidence>;
  readonly origins: (receiver: SourceTypeEvidence, member: SourceInputCorrespondenceMember,
    role: "selected" | "read" | "write") => SourceResult<readonly SourceMemberOrigin[]>;
  readonly domain: (value: SourceTypeEvidence) => SourceLiteralDomain;
}): SourceMemberCorrespondenceQueries {
  const { view, members, assertNode, originalComponent, publish, origins, domain } = input;
  const disjoint = (pair: SourceMemberPair): boolean => {
    if (pair.kind !== "present" || pair.source.optional || pair.destination.optional ||
      pair.source.readType === undefined || pair.destination.readType === undefined) return false;
    const from = domain(pair.source.readType);
    const to = domain(pair.destination.readType);
    return from.kind === "finite" && to.kind === "finite" &&
      !from.values.some(origin => to.values.some(target => sourceLiteralUnitsEqual(origin, target)));
  };
  type Purpose = "correspondence" | "read";
  interface Selection {
    readonly whole: Map<Purpose, SourceResult<SourceMemberCorrespondence>>;
    readonly selected: WeakMap<Node, Map<Purpose, SourceResult<SourcePresence<SourceMemberPair>>>>;
  }
  const selections = new WeakMap<SourceTypeEvidence, WeakMap<SourceTypeEvidence, Selection>>();
  const memberEvidence = new WeakMap<SourceTypeEvidence, WeakMap<SourceInputCorrespondenceMember, SourceCorrespondenceMember>>();

  const select = (source: SourceTypeEvidence, destination: SourceTypeEvidence, purpose: Purpose): Selection => {
    view.assertEvidence(source);
    view.assertEvidence(destination);
    if (purpose !== "correspondence" && purpose !== "read")
      throw new TypeError("Source member correspondence requires an explicit correspondence or read purpose.");
    let destinations = selections.get(source);
    if (destinations === undefined) { destinations = new WeakMap(); selections.set(source, destinations); }
    let selected = destinations.get(destination);
    if (selected === undefined) {
      selected = { whole: new Map(), selected: new WeakMap() };
      destinations.set(destination, selected);
    }
    return selected;
  };
  const component = (receiver: SourceTypeEvidence, value: SourceInputComponent | undefined): SourceResult<SourceTypeEvidence | undefined> => {
    if (value === undefined) return Object.freeze({ kind: "resolved", value: undefined });
    const selected = publish(receiver, value);
    if (selected.kind === "refused") return selected;
    view.assertEvidence(selected.value);
    if (originalComponent(selected.value) !== value)
      throw new Error("Source member publication must retain its exact original component handle.");
    return selected;
  };
  const member = (receiver: SourceTypeEvidence, value: SourceInputCorrespondenceMember): SourceResult<SourceCorrespondenceMember> => {
    view.assertEvidence(receiver);
    if (originalComponent(receiver) !== value.receiver)
      throw new Error("Source member correspondence must retain its exact original receiver handle.");
    let retained = memberEvidence.get(receiver);
    const existing = retained?.get(value);
    if (existing !== undefined) return Object.freeze({ kind: "resolved", value: existing });
    const selectedOrigins = origins(receiver, value, "selected");
    if (selectedOrigins.kind === "refused") return selectedOrigins;
    const readOrigins = value.read === undefined ? Object.freeze({ kind: "resolved", value: Object.freeze([]) } as const)
      : origins(receiver, value, "read");
    if (readOrigins.kind === "refused") return readOrigins;
    const writeOrigins = value.write === undefined ? Object.freeze({ kind: "resolved", value: Object.freeze([]) } as const)
      : origins(receiver, value, "write");
    if (writeOrigins.kind === "refused") return writeOrigins;
    const read = component(receiver, value.read);
    if (read.kind === "refused") return read;
    const write = component(receiver, value.write);
    if (write.kind === "refused") return write;
    const result: SourceCorrespondenceMember = Object.freeze({ receiver, name: value.name,
      declarations: value.declarations, origins: selectedOrigins.value, readOrigins: readOrigins.value,
      writeOrigins: writeOrigins.value, getters: value.getters, setters: value.setters,
      read: value.readKind, optional: value.optional, readonly: value.readonly,
      readType: read.value, writeType: write.value });
    if (retained === undefined) { retained = new WeakMap(); memberEvidence.set(receiver, retained); }
    retained.set(value, result);
    return Object.freeze({ kind: "resolved", value: result });
  };
  const pair = (source: SourceTypeEvidence, destination: SourceTypeEvidence,
    value: SourceInputMemberPair): SourceResult<SourceMemberPair> => {
    const target = member(destination, value.destination);
    if (target.kind === "refused") return target;
    if (value.kind === "absent") return Object.freeze({ kind: "resolved",
      value: Object.freeze({ kind: "absent", destination: target.value }) });
    const origin = member(source, value.source);
    if (origin.kind === "refused") return origin;
    return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present", source: origin.value, destination: target.value }) });
  };
  const queries: SourceMemberCorrespondenceQueries = Object.freeze({
    correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence,
      purpose: Purpose): SourceResult<SourceMemberCorrespondence> {
      const selected = select(source, destination, purpose);
      const existing = selected.whole.get(purpose);
      if (existing !== undefined) return existing;
      const from = originalComponent(source);
      const to = originalComponent(destination);
      const original = members.correspondence(from, to, purpose);
      let result: SourceResult<SourceMemberCorrespondence>;
      if (original.kind === "unavailable") result = Object.freeze({ kind: "resolved", value: original });
      else {
        const published: SourceMemberPair[] = [];
        for (const value of original.members) {
          const current = pair(source, destination, value);
          if (current.kind === "refused") { selected.whole.set(purpose, current); return current; }
          published.push(current.value);
        }
        result = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "available", source, destination,
          members: Object.freeze(published) }) });
        if (published.some(disjoint)) result = Object.freeze({ kind: "resolved",
          value: Object.freeze({ kind: "unavailable", reason: "disjoint-shape" }) });
      }
      selected.whole.set(purpose, result);
      return result;
    },
    correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
      purpose: Purpose): SourceResult<SourcePresence<SourceMemberPair>> {
      const selected = select(source, destination, purpose);
      assertNode(declaration);
      let declarations = selected.selected.get(declaration);
      const existing = declarations?.get(purpose);
      if (existing !== undefined) return existing;
      const whole = queries.correspondence(source, destination, purpose);
      if (whole.kind === "refused") return whole;
      if (whole.value.kind === "unavailable" && whole.value.reason === "disjoint-shape")
        return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) });
      const original = members.correspondingMember(originalComponent(source), originalComponent(destination), declaration, purpose);
      let result: SourceResult<SourcePresence<SourceMemberPair>>;
      if (original === undefined) result = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) });
      else {
        const paired = pair(source, destination, original);
        result = paired.kind === "refused" ? paired : Object.freeze({ kind: "resolved",
          value: disjoint(paired.value) ? Object.freeze({ kind: "none" })
            : Object.freeze({ kind: "present", value: paired.value }) });
      }
      if (declarations === undefined) { declarations = new Map(); selected.selected.set(declaration, declarations); }
      declarations.set(purpose, result);
      return result;
    },
  });
  return queries;
}
