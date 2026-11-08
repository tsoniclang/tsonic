import type { SourcePresence, SourceResult, SourceTypeBinding, SourceTypeComponent, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceLiteralKey } from "../source-model/literals/key.js";
import { sourceLiteralDomainUnion, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceEvidenceOwner } from "./descriptor-evidence.js";
import type { SourceIndexInventoryRow, SourceMemberInventory, SourceMemberInventoryRow } from "./member-inventory.js";

export function createSourceInventoryOwner(input: {
  readonly evidence: SourceEvidenceOwner;
  definition(value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory>;
  join(component: SourceTypeComponent, values: readonly SourceTypeEvidence[]): SourceResult<SourceTypeEvidence>;
}): (value: SourceTypeEvidence) => SourceProductionResult<SourceMemberInventory> {
  const completed = new WeakMap<SourceTypeEvidence, SourceMemberInventory>();
  const active = new Set<SourceTypeEvidence>();
  const sameKey = (left: SourceLiteralKey, right: SourceLiteralKey): boolean => left.kind === "name"
    ? right.kind === "name" && left.name === right.name : right.kind === "symbol" && left.declaration === right.declaration;
  const distinct = <Value>(values: readonly Value[]): readonly Value[] => Object.freeze([...new Set(values)]);

  function joined(component: SourceTypeComponent, rows: readonly SourceMemberInventoryRow[], role: "readType" | "writeType"):
    SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
    const values: SourceTypeEvidence[] = [];
    const dependencies = new Set<SourceTypeComponent>();
    for (const row of rows) {
      const selected = row[role]();
      if (selected.kind === "refused") return selected;
      if (selected.kind === "pending") { selected.dependencies.forEach(value => dependencies.add(value)); continue; }
      if (selected.value.kind === "none") return selected;
      values.push(selected.value.value);
    }
    if (dependencies.size > 0) return { kind: "pending", dependencies: Object.freeze([...dependencies]) };
    const result = input.join(component, values);
    return result.kind === "refused" ? result : { kind: "resolved", value: { kind: "present", value: result.value } };
  }

  function family(value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory> {
    if (value.sum === undefined) throw new Error("A Source family inventory requires its original application.");
    const inventories: Extract<SourceMemberInventory, { readonly kind: "complete" }>[] = [];
    const dependencies = new Set<SourceTypeComponent>();
    for (const role of value.sum.roles) {
      const selected = members(role.value);
      if (selected.kind === "refused") return selected;
      if (selected.kind === "pending") { selected.dependencies.forEach(dependency => dependencies.add(dependency)); continue; }
      if (selected.value.kind === "unavailable") return selected;
      inventories.push(selected.value);
    }
    if (dependencies.size > 0) return { kind: "pending", dependencies: Object.freeze([...dependencies]) };
    const groups: { readonly key: SourceLiteralKey; readonly rows: SourceMemberInventoryRow[]; readonly owners: Set<number> }[] = [];
    for (const [index, inventory] of inventories.entries()) {
      for (const row of inventory.members) {
        let group = groups.find(group => sameKey(group.key, row.key));
        if (group === undefined) { group = { key: row.key, rows: [], owners: new Set() }; groups.push(group); }
        group.rows.push(row);
        group.owners.add(index);
      }
    }
    const result: SourceMemberInventoryRow[] = [];
    for (const group of groups) {
      const rows = group.rows;
      result.push(Object.freeze({ key: group.key, name: rows[0]!.name,
        declarations: distinct(rows.flatMap(row => row.declarations)),
        origins: Object.freeze(rows.flatMap(row => row.origins)),
        readOrigins: Object.freeze(rows.flatMap(row => row.readOrigins)),
        writeOrigins: Object.freeze(rows.flatMap(row => row.writeOrigins)),
        getters: distinct(rows.flatMap(row => row.getters)), setters: distinct(rows.flatMap(row => row.setters)),
        read: rows.some(row => row.read === "unavailable") ? "unavailable" : rows.some(row => row.read === "accessor") ? "accessor"
          : rows.every(row => row.read === "method") ? "method" : "property",
        optional: group.owners.size !== inventories.length || rows.some(row => row.optional),
        readonly: rows.some(row => row.readonly),
        readDomain: (bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain> => {
          const domains: SourceLiteralDomain[] = [];
          for (const row of rows) {
            const selected = row.readDomain(bindings);
            if (selected.kind !== "resolved") return selected;
            domains.push(selected.value);
          }
          return { kind: "resolved", value: sourceLiteralDomainUnion(domains) };
        },
        readType: () => joined(value.component, rows, "readType"), writeType: () => joined(value.component, rows, "writeType") }));
    }
    const indexes: SourceIndexInventoryRow[] = inventories.flatMap(inventory => inventory.indexes);
    return { kind: "resolved", value: Object.freeze({ kind: "complete", members: Object.freeze(result), indexes: Object.freeze(indexes) }) };
  }

  function members(value: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory> {
    const record = input.evidence.record(value);
    const previous = completed.get(value);
    if (previous !== undefined) return { kind: "resolved", value: previous };
    if (record.details.members.kind === "complete" || record.details.members.kind === "unavailable")
      return { kind: "resolved", value: record.details.members };
    if (active.has(value)) return { kind: "pending", dependencies: Object.freeze([value.component]) };
    active.add(value);
    try {
      let result: SourceProductionResult<SourceMemberInventory>;
      if (record.details.members.kind === "production") result = record.details.members.produce();
      else if (value.sum !== undefined) result = family(value);
      else result = input.definition(value);
      if (result.kind === "resolved" && result.value.kind === "complete") completed.set(value, result.value);
      return result;
    } finally { active.delete(value); }
  }
  return members;
}
