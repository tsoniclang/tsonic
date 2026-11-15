import type { ModuleId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { HirBindingTarget, HirModuleBinding } from "../ir-hir/contract.js";
import { createModuleBindingViews, isModuleBindingKind } from "../ir-hir/index.js";
import type { TirVerifierInput } from "../ir-tir/contract.js";
import type { ProgramIndex, ProgramRule, ProgramSite, ProgramVerificationContext } from "./contract.js";
import type { ProgramLookup, ProgramViolation } from "./program-values.js";
import { textDetail } from "./program-values.js";

function ordinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function verifyModuleBindings(lookup: ProgramLookup, index: ProgramIndex,
  context: ProgramVerificationContext, modules: ReadonlyMap<ModuleId, TirVerifierInput | null>): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const tables: (readonly HirModuleBinding[])[] = [];
  const seenModules = new Set<ModuleId>();
  const ownerModule = (source: SourceNodeRef): ModuleId | null => {
    const definition = source.kind === "item" ? source.value.owner : context.facts.bodyOwner(source.value.body);
    if (definition === null) return null;
    return lookup.definitions.get(definition)?.module ?? null;
  };
  const report = (rule: ProgramRule, site: ProgramSite, detail: string): void => {
    violations.push({ rule, site, detail: [textDetail(detail)] });
  };
  for (const record of index.modules) {
    const site: ProgramSite = { kind: "module", module: record.module };
    if (seenModules.has(record.module)) {
      report("binding-capture-owner", site, "a binding table must have exactly one module owner");
      continue;
    }
    seenModules.add(record.module);
    let previous = -1;
    let valid = true;
    for (const row of record.bindings) {
      const source = row.occurrence;
      const node = modules.get(record.module)?.nodeOf(source);
      if (!ordinal(source.value.node) || source.value.node <= previous || ownerModule(source) !== record.module ||
        node === undefined || node === null || node.id !== source.value.node ||
        !isModuleBindingKind(node.kind, node.kind !== "ImportClause" || node.name !== null)) valid = false;
      previous = source.value.node;
    }
    if (valid) tables.push(record.bindings);
    else report("binding-capture-owner", site, "binding rows require distinct preorder syntax and their exact qualified owner");
  }
  const views = createModuleBindingViews(tables);
  const target = (value: HirBindingTarget, site: ProgramSite): void => {
    switch (value.kind) {
      case "binding":
        if (!ordinal(value.occurrence.value.node) || views.bindingOf(value.occurrence) === null)
          report("binding-target-resolves", site, "a binding edge must retain its actual nearest-target row");
        break;
      case "declarations": {
        let previous: { readonly module: ModuleId; readonly node: NodeId } | null = null;
        if (value.definitions.length === 0) report("export-target-resolves", site, "a declaration group must be nonempty");
        for (const definition of value.definitions) {
          const current = lookup.definitions.get(definition);
          if (current === undefined || current === null) {
            report("export-target-resolves", site, "a declaration group must retain actual F1 identities");
            continue;
          }
          if (previous !== null && (previous.module > current.module ||
            previous.module === current.module && previous.node >= current.entry.node))
            report("export-target-resolves", site, "a declaration group must retain distinct source inventory order");
          previous = { module: current.module, node: current.entry.node };
        }
        break;
      }
      case "module":
        if (lookup.modules.get(value.module) === undefined || lookup.modules.get(value.module) === null)
          report("binding-target-resolves", site, "a module target must retain an actual module");
        break;
      case "member":
        target(value.through, site);
        break;
      case "unresolved":
        if (value.diagnostics.length === 0)
          report("binding-diagnostic-resolves", site, "an unresolved target requires its original checker diagnostic roots");
        for (const diagnostic of value.diagnostics) {
          if (!ordinal(diagnostic.index) || lookup.modules.get(diagnostic.module)?.checkerDiagnostics[diagnostic.index] === undefined)
            report("binding-diagnostic-resolves", site, "a checker root must resolve in its actual module diagnostic inventory");
        }
        break;
    }
  };
  for (const record of index.modules) {
    const site: ProgramSite = { kind: "module", module: record.module };
    for (const entry of record.exports) target(entry.target, site);
    for (const row of record.bindings) if (row.target.kind === "available") target(row.target.value, site);
  }
  return violations;
}
