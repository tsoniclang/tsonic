import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeBinding, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { SourceEvidenceDetails, SourceIndexInventoryRow, SourceMemberInventory, SourceMemberInventoryProduction, SourceMemberInventoryRow } from "./member-inventory.js";
import { freezeSourceMemberOrigin } from "./descriptor-model.js";
import { sourceFiniteLiteralDomain } from "../source-model/literals/domain.js";

export function composeSourceTypeBindings(original: readonly SourceTypeBinding[], applied: readonly SourceTypeBinding[],
  substitute: (value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]) => SourceResult<SourceTypeEvidence>): SourceResult<readonly SourceTypeBinding[]> {
  const environment = new Map<Node, SourceTypeBinding>();
  for (const binding of original) {
    const selected = substitute(binding.value, applied);
    if (selected.kind === "refused") return selected;
    environment.set(binding.declaration, Object.freeze({ declaration: binding.declaration, value: selected.value }));
  }
  for (const binding of applied) if (!environment.has(binding.declaration))
    environment.set(binding.declaration, Object.freeze({ ...binding }));
  return { kind: "resolved", value: Object.freeze([...environment.values()]) };
}

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
    const readDomain = row.readDomain;
    if (row.key.kind === "symbol") input.assertNode(row.key.declaration);
    else if (row.name !== row.key.name) throw new Error("A Source member inventory retains its exact original property key.");
    return Object.freeze({ ...row, key: Object.freeze({ ...row.key }), declarations: nodes(row.declarations),
      getters: nodes(row.getters), setters: nodes(row.setters), origins: origins(row.origins),
      readOrigins: origins(row.readOrigins), writeOrigins: origins(row.writeOrigins),
      readDomain: bindings => {
        const seen = new Set<Node>();
        for (const binding of bindings) {
          input.assertNode(binding.declaration);
          input.assertEvidence(binding.value);
          if (seen.has(binding.declaration)) throw new Error("A Source member domain requires one value for each original binder.");
          seen.add(binding.declaration);
        }
        const selected = readDomain(bindings);
        if (selected.kind !== "resolved") return selected;
        if (selected.value.kind === "finite") for (const unit of selected.value.values)
          if (unit.kind === "symbol") input.assertNode(unit.declaration);
        return Object.freeze({ kind: "resolved", value: selected.value.kind === "finite"
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
  function inventory(value: SourceMemberInventory): SourceMemberInventory {
    const previous = inventories.get(value);
    if (previous !== undefined) return previous;
    const members: SourceMemberInventory = value.kind === "complete"
      ? Object.freeze({ kind: "complete", members: Object.freeze(value.members.map(member)),
        indexes: Object.freeze(value.indexes.map(index)) }) : Object.freeze({ kind: "unavailable" });
    inventories.set(value, members);
    inventories.set(members, members);
    return members;
  }
  function production(value: SourceMemberInventoryProduction): SourceMemberInventoryProduction {
    if (value.kind === "definition") return Object.freeze({ kind: "definition" });
    if (value.kind !== "production") return inventory(value);
    const produce = value.produce;
    let complete: SourceMemberInventory | undefined;
    return Object.freeze({ kind: "production", produce: (): SourceProductionResult<SourceMemberInventory> => {
      if (complete !== undefined) return { kind: "resolved", value: complete };
      const selected = produce();
      if (selected.kind !== "resolved") return selected;
      const published = inventory(selected.value);
      if (published.kind === "complete") complete = published;
      return { kind: "resolved", value: published };
    } });
  }
  return value => {
    return Object.freeze({ members: production(value.members),
      origins: value.origins.kind === "complete" ? Object.freeze({ kind: "complete", nodes: nodes(value.origins.nodes) })
        : Object.freeze({ kind: "unavailable" }) });
  };
}

export function substituteSourceEvidenceDetails(value: SourceEvidenceDetails,
  substitute: (value: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>,
  bindings: readonly SourceTypeBinding[],
  apply: (value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]) => SourceResult<SourceTypeEvidence>): SourceEvidenceDetails {
  if (value.members.kind === "production") {
    const production = value.members;
    return { ...value, members: { kind: "production", produce: () => {
      const selected = production.produce();
      if (selected.kind !== "resolved") return selected;
      const members = substituteSourceEvidenceDetails({ ...value, members: selected.value }, substitute, bindings, apply).members;
      if (members.kind === "definition" || members.kind === "production") throw new Error("A Source inventory producer must resolve its canonical metadata.");
      return { kind: "resolved", value: members };
    } } };
  }
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
  return { members: { kind: "complete", members: value.members.members.map(row => ({ ...row,
    readType: optional(row.readType),
    readDomain: next => {
      const applied = composeSourceTypeBindings(bindings, next, apply);
      return applied.kind === "refused" ? applied : row.readDomain(applied.value);
    }, writeType: optional(row.writeType) })),
  indexes: value.members.indexes.map(row => ({ ...row, keyType: () => {
    const selected = row.keyType();
    return selected.kind === "resolved" ? substitute(selected.value) : selected;
  }, readType: optional(row.readType), writeType: optional(row.writeType) })) }, origins: value.origins };
}
