import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceEvidenceDetails, SourceIndexInventoryRow, SourceMemberInventory, SourceMemberInventoryRow } from "./member-inventory.js";
import { freezeSourceMemberOrigin } from "./descriptor-model.js";
import { sourceFiniteLiteralDomain, type SourceLiteralDomain } from "../source-model/literals/domain.js";

export function createSourceEvidenceDetailsOwner(input: {
  assertNode(node: Node): void;
  assertEvidence(value: SourceTypeEvidence): void;
}): (value: SourceEvidenceDetails) => SourceEvidenceDetails {
  const inventories = new WeakMap<SourceMemberInventory, SourceMemberInventory>();
  function nodes(values: readonly Node[]): readonly Node[] {
    values.forEach(input.assertNode);
    return Object.freeze([...values]);
  }
  function origins(values: readonly SourceMemberOrigin[]): readonly SourceMemberOrigin[] {
    return Object.freeze(values.map(origin => {
      if (origin.kind === "declared") input.assertNode(origin.declaration);
      else {
        input.assertNode(origin.owner);
        if (origin.kind === "mapped" && origin.key.kind === "unique-symbol") input.assertNode(origin.key.declaration);
      }
      return freezeSourceMemberOrigin(origin);
    }));
  }
  function optional(produce: () => SourceProductionResult<SourcePresence<SourceTypeEvidence>>, writable: boolean):
    () => SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    let completed: SourceResult<SourcePresence<SourceTypeEvidence>> | undefined;
    return () => {
      if (completed !== undefined) return completed;
      const selected = produce();
      if (selected.kind !== "resolved") {
        if (selected.kind === "refused") completed = selected;
        return selected;
      }
      if (selected.value.kind === "present") {
        input.assertEvidence(selected.value.value);
        if (!writable) throw new Error("An unavailable Source member component cannot publish evidence.");
      }
      completed = Object.freeze({ kind: "resolved", value: Object.freeze({ ...selected.value }) });
      return completed;
    };
  }
  function member(row: SourceMemberInventoryRow): SourceMemberInventoryRow {
    if (row.key.kind === "symbol") input.assertNode(row.key.declaration);
    else if (row.name !== row.key.name) throw new Error("A Source member inventory retains its exact original property key.");
    return Object.freeze({ ...row, key: Object.freeze({ ...row.key }), declarations: nodes(row.declarations),
      getters: nodes(row.getters), setters: nodes(row.setters), origins: origins(row.origins),
      readOrigins: origins(row.readOrigins), writeOrigins: origins(row.writeOrigins),
      readDomain: () => {
        const selected = row.readDomain();
        if (selected.kind === "none") return Object.freeze({ kind: "none" });
        if (selected.value.kind === "finite") for (const unit of selected.value.values)
          if (unit.kind === "symbol") input.assertNode(unit.declaration);
        return Object.freeze({ kind: "present", value: selected.value.kind === "finite"
          ? sourceFiniteLiteralDomain(selected.value.values) : Object.freeze({ ...selected.value }) });
      },
      readType: optional(row.readType, row.read !== "unavailable"), writeType: optional(row.writeType, !row.readonly) });
  }
  function index(row: SourceIndexInventoryRow): SourceIndexInventoryRow {
    let key: SourceResult<SourceTypeEvidence> | undefined;
    return Object.freeze({ ...row, declarations: nodes(row.declarations),
      keyType: () => {
        if (key !== undefined) return key;
        const selected = row.keyType();
        if (selected.kind === "resolved") input.assertEvidence(selected.value);
        if (selected.kind !== "pending") key = selected;
        return selected;
      }, readType: optional(row.readType, true), writeType: optional(row.writeType, !row.readonly) });
  }
  return value => {
    let members = value.members.kind === "definition" ? undefined : inventories.get(value.members);
    if (members === undefined && value.members.kind !== "definition") {
      members = value.members.kind === "complete"
        ? Object.freeze({ kind: "complete", members: Object.freeze(value.members.members.map(member)),
          indexes: Object.freeze(value.members.indexes.map(index)) }) : Object.freeze({ kind: "unavailable" });
      inventories.set(value.members, members);
      inventories.set(members, members);
    }
    return Object.freeze({ members: members ?? Object.freeze({ kind: "definition" }),
      origins: value.origins.kind === "complete" ? Object.freeze({ kind: "complete", nodes: nodes(value.origins.nodes) })
        : Object.freeze({ kind: "unavailable" }) });
  };
}

export function substituteSourceEvidenceDetails(value: SourceEvidenceDetails,
  substitute: (value: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>,
  domain: (value: SourceTypeEvidence) => SourceLiteralDomain): SourceEvidenceDetails {
  if (value.members.kind !== "complete") return value;
  function optional(produce: () => SourceProductionResult<SourcePresence<SourceTypeEvidence>>):
    () => SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    return () => {
      const selected = produce();
      if (selected.kind !== "resolved" || selected.value.kind === "none") return selected;
      const applied = substitute(selected.value.value);
      return applied.kind === "refused" ? applied : { kind: "resolved", value: { kind: "present", value: applied.value } };
    };
  }
  return { members: { kind: "complete", members: value.members.members.map(row => {
    let observed: SourceTypeEvidence | undefined;
    const read = optional(row.readType);
    return { ...row,
      readType: () => {
        const selected = read();
        if (selected.kind === "resolved" && selected.value.kind === "present") observed = selected.value.value;
        return selected;
      },
      readDomain: () => {
        if (observed !== undefined) return { kind: "present", value: domain(observed) };
        const original = row.readDomain();
        return original.kind === "present" && original.value.kind !== "open" ? original : { kind: "none" };
      }, writeType: optional(row.writeType) };
  }),
  indexes: value.members.indexes.map(row => ({ ...row, keyType: () => {
    const selected = row.keyType();
    return selected.kind === "resolved" ? substitute(selected.value) : selected;
  }, readType: optional(row.readType), writeType: optional(row.writeType) })) }, origins: value.origins };
}
