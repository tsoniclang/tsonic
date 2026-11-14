import type { DefId, ModuleId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { HirBindingViews, HirModule, HirNode, HirVerificationContext } from "./contract.js";
import { createModuleBindingViews, isModuleBindingKind } from "./bindings.js";
import type { HirIdentityPaths } from "./verify-bindings.js";
import { sourceNodeExists, validHirIndex } from "./verify-bindings.js";
import type { HirDataRoot, HirInventory, HirReport } from "./verify-syntax.js";
import { walkHirData } from "./verify-syntax.js";

function bindingSyntax(node: HirNode): boolean {
  return isModuleBindingKind(node.kind, node.kind !== "ImportClause" || node.name !== null);
}

export function verifyExportBindings(roots: readonly HirDataRoot[], module: HirModule, inventory: HirInventory,
  context: HirVerificationContext, paths: HirIdentityPaths, report: HirReport): void {
  const modules = new Map<ModuleId, HirModule | null>([[module.module, module]]);
  const views = new Map<ModuleId, HirBindingViews | null>();
  const declarations = new Map<ModuleId, ReadonlyMap<DefId, NodeId>>();
  const ready = (id: ModuleId): HirModule | null => {
    const previous = modules.get(id);
    if (previous !== undefined) return previous;
    const answer = context.moduleOf(id);
    const actual = answer?.module === id ? answer : null;
    modules.set(id, actual);
    return actual;
  };
  const ownerModule = (source: SourceNodeRef): ModuleId | null => {
    if (source.kind === "item") {
      const path = paths.definitionPathOf(source.value.owner);
      return path.kind === "known" ? path.value.module : null;
    }
    const body = paths.bodyPathOf(source.value.body);
    if (body.kind !== "known") return null;
    const owner = paths.definitionPathOf(body.value.owner);
    return owner.kind === "known" ? owner.value.module : null;
  };
  const viewOf = (id: ModuleId): HirBindingViews | null => {
    const previous = views.get(id);
    if (previous !== undefined) return previous;
    const current = ready(id);
    if (current === null) { views.set(id, null); return null; }
    const seen = new Set<NodeId>();
    let valid = true;
    let previousNode = -1;
    for (const row of current.bindings) {
      const source = row.occurrence;
      const node = id === module.module ? inventory.nodesById.get(source.value.node) : context.nodeOf(source);
      if (!validHirIndex(source.value.node) || source.value.node <= previousNode || seen.has(source.value.node) ||
        ownerModule(source) !== id || node === null || node === undefined || !bindingSyntax(node) ||
        !sourceNodeExists(source, module, inventory, context, paths)) valid = false;
      seen.add(source.value.node);
      previousNode = source.value.node;
    }
    if (!valid) report("binding-capture-owner", { kind: "module", module: id }, "binding rows require distinct preorder syntax and the actual qualified owner");
    const result = valid ? createModuleBindingViews([current.bindings]) : null;
    views.set(id, result);
    return result;
  };
  const bindingExists = (source: SourceNodeRef): boolean => {
    const owner = ownerModule(source);
    const view = owner === null ? null : viewOf(owner);
    return view !== null && validHirIndex(source.value.node) && view.bindingOf(source) !== null;
  };
  const declarationNode = (definition: DefId): { readonly module: ModuleId; readonly node: NodeId } | null => {
    const path = paths.definitionPathOf(definition);
    if (path.kind !== "known") return null;
    const current = ready(path.value.module);
    if (current === null) return null;
    let entries = declarations.get(current.module);
    if (entries === undefined) {
      const actual = new Map<DefId, NodeId>([[current.tree.tsonic.definition, current.tree.id]]);
      for (const item of current.items) actual.set(item.definition, item.node);
      entries = actual;
      declarations.set(current.module, entries);
    }
    const node = entries.get(definition);
    return node === undefined ? null : { module: current.module, node };
  };
  viewOf(module.module);
  let previousName: string | null = null;
  for (const entry of module.exports) {
    if (previousName !== null && previousName >= entry.name)
      report("stable-order", { kind: "module", module: module.module }, "export names require one row per name in canonical order");
    previousName = entry.name;
  }
  for (const root of roots) walkHirData(root, data => {
    const reference = data.reference;
    if (reference.kind === "CheckerDiagnosticRef") {
      const diagnostic = reference.value;
      if (!validHirIndex(diagnostic.index) || ready(diagnostic.module)?.checkerDiagnostics[diagnostic.index] === undefined)
        report("diagnostic-reference", data.site, "an unresolved target requires its actual qualified checker diagnostic root");
    } else if (reference.kind === "HirBindingTarget") {
      const target = reference.value;
      if (target.kind === "binding") {
        if (!bindingExists(target.occurrence)) report("binding-capture-owner", data.site, "a binding hop must name an actual ready nearest-target row");
      } else if (target.kind === "module") {
        if (ready(target.module) === null) report("module-owner", data.site, "a module target must name an actual ready module");
      } else if (target.kind === "declarations") {
        let previous: { readonly module: ModuleId; readonly node: NodeId } | null = null;
        if (target.definitions.length === 0) report("definition-reference", data.site, "a declaration group must be nonempty");
        for (const definition of target.definitions) {
          const current = declarationNode(definition);
          if (current === null) {
            if (paths.definitionPathOf(definition).kind === "known")
              report("definition-reference", data.site, "a declaration group must retain actual F1 declarations");
          } else if (previous !== null && (previous.module > current.module || previous.module === current.module && previous.node >= current.node))
            report("stable-order", data.site, "a declaration group must retain each actual declaration once in source inventory order");
          previous = current;
        }
      } else if (target.kind === "unresolved" && target.diagnostics.length === 0)
        report("diagnostic-reference", data.site, "an unresolved target cannot manufacture a rootless success");
    }
  });
  for (const entry of inventory.entries) {
    if (bindingSyntax(entry.node)) {
      const occurrence: SourceNodeRef = { kind: "item", value: { owner: entry.item, node: entry.node.id } };
      if (!bindingExists(occurrence))
        report("binding-capture-owner", { kind: "node", node: entry.source }, "every checked binding must retain its actual nearest-target row");
    }
    const metadata = entry.node.tsonic;
    if (metadata === null || !("binding" in metadata)) continue;
    const binding = metadata.binding;
    const expected = bindingSyntax(entry.node) ? entry.node.id : entry.node.parent;
    if (binding.value.node !== expected || !bindingExists(binding))
      report("binding-capture-owner", { kind: "node", node: entry.source }, "binding syntax and names must retain the exact owning occurrence");
  }
}
