import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { CreateModuleBindingViews, HirModuleBinding, ProjectExportDeclarations, ResolveModuleBinding } from "./binding-data.js";

function fail(message: string): never {
  return throwInvariant({ owner: "ir-hir", query: null, origin: null, message });
}

function validOccurrence(occurrence: SourceNodeRef): void {
  const node = occurrence.value.node;
  if (!Number.isSafeInteger(node) || node < 0 || Object.is(node, -0))
    fail("A binding occurrence requires an actual qualified syntax identity.");
}

export const createModuleBindingViews: CreateModuleBindingViews = tables => {
  const items = new Map<DefId, Map<NodeId, HirModuleBinding>>();
  const bodies = new Map<BodyId, Map<NodeId, HirModuleBinding>>();
  for (const table of tables) for (const row of table) {
    const occurrence = row.occurrence;
    validOccurrence(occurrence);
    const entries = occurrence.kind === "item" ? items.get(occurrence.value.owner) : bodies.get(occurrence.value.body);
    if (entries === undefined) {
      const nodes = new Map([[occurrence.value.node, row]]);
      if (occurrence.kind === "item") items.set(occurrence.value.owner, nodes);
      else bodies.set(occurrence.value.body, nodes);
    } else {
      if (entries.has(occurrence.value.node)) return fail("A qualified binding occurrence must own exactly one nearest-target row.");
      entries.set(occurrence.value.node, row);
    }
  }
  return { bindingOf: occurrence => {
    validOccurrence(occurrence);
    const entries = occurrence.kind === "item" ? items.get(occurrence.value.owner) : bodies.get(occurrence.value.body);
    return entries?.get(occurrence.value.node) ?? null;
  } };
};

export const resolveModuleBinding: ResolveModuleBinding = (views, occurrence) => {
  const items = new Map<DefId, Set<NodeId>>();
  const bodies = new Map<BodyId, Set<NodeId>>();
  const aliases: SourceNodeRef[] = [];
  let current = occurrence;
  for (;;) {
    const node = current.value.node;
    validOccurrence(current);
    const known = current.kind === "item" ? items.get(current.value.owner) : bodies.get(current.value.body);
    if (known?.has(node)) return { target: { kind: "unavailable", reason: "incomplete-association" }, aliases, cycle: current };
    const entry = views.bindingOf(current);
    if (entry === null) return fail("A binding hop must name an actual ready nearest-target row.");
    if (entry.occurrence.kind !== current.kind || entry.occurrence.value.node !== node ||
      (entry.occurrence.kind === "item" && current.kind === "item" && entry.occurrence.value.owner !== current.value.owner) ||
      (entry.occurrence.kind === "body" && current.kind === "body" && entry.occurrence.value.body !== current.value.body))
      return fail("A binding reader must return the exact requested qualified occurrence.");
    if (known === undefined) {
      const nodes = new Set([node]);
      if (current.kind === "item") items.set(current.value.owner, nodes);
      else bodies.set(current.value.body, nodes);
    } else known.add(node);
    aliases.push(entry.occurrence);
    if (entry.target.kind === "unavailable") return { target: entry.target, aliases, cycle: null };
    if (entry.target.value.kind !== "binding") return { target: { kind: "available", value: entry.target.value }, aliases, cycle: null };
    current = entry.target.value.occurrence;
  }
};

export const projectExportDeclarations: ProjectExportDeclarations = (views, entry) => {
  if (entry.target.kind === "declarations") return { target: { kind: "available", value: entry.target }, aliases: [], cycle: null };
  const occurrence = entry.target.occurrence;
  validOccurrence(occurrence);
  if (occurrence.kind === "item") {
    const declaration = views.declarationSourceOf(occurrence.value.owner);
    if (declaration?.kind === "item" && declaration.value.owner === occurrence.value.owner && declaration.value.node === occurrence.value.node)
      return { target: { kind: "available", value: { kind: "declarations", definitions: [occurrence.value.owner] } }, aliases: [], cycle: null };
  }
  return resolveModuleBinding(views, occurrence);
};
