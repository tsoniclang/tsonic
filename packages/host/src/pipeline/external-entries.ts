import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { ModuleStaticCellRef, SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity } from "../ir-facts/index.js";
import type { HirModuleExport } from "../ir-hir/contract.js";
import { resolveModuleExport } from "../ir-hir/index.js";
import type { ResolvedExternalEntry } from "../ir-program/contract.js";
import type { Execution } from "../ir-types/contract.js";
import type { SourceExternalEntry } from "../snapshot/contract.js";
import type { CheckedSourceViews } from "./checked-inputs.js";
import type { SourceBarrier } from "./source-barrier.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export interface ExternalEntrySelection {
  readonly bodies: ReadonlySet<BodyId>;
  readonly selections: readonly ExternalTarget[];
}

interface ExternalTarget {
  readonly module: ModuleId;
  readonly name: string;
  readonly definitions: readonly [DefId, ...DefId[]];
  readonly storage: readonly DefId[];
}

export function selectExternalEntries(source: SourceBarrier, views: CheckedSourceViews,
  requested: readonly SourceExternalEntry[], account: DataflowAccount): DataflowResult<ExternalEntrySelection> {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  const bodies = new Set<BodyId>();
  const selections: ExternalTarget[] = [];
  if (requested.length === 0) return { kind: "complete", value: { bodies, selections } };
  const index = chargeWork(account, source.modules.length) ?? chargeResultEntries(account, source.modules.length + 2);
  if (index !== null) return index;
  const modules = new Map(source.modules.map(module => [module.module.module, module]));
  const exportsOf = new Map<ModuleId, ReadonlyMap<string, HirModuleExport>>();
  const typeOnlyAlias = (reference: SourceNodeRef): boolean => {
    const node = views.nodeOf(reference);
    if (node === null) return fail("An external entry must retain its actual checked alias occurrence.");
    const nodes = modules.get(node.origin.module)?.nodes;
    const parent = node.parent === null ? undefined : nodes?.[node.parent];
    const container = parent === undefined || parent.parent === null ? undefined : nodes?.[parent.parent];
    switch (node.kind) {
      case "ExportSpecifier": return node.isTypeOnly || (container?.kind === "ExportDeclaration" && container.isTypeOnly);
      case "ImportSpecifier": return node.isTypeOnly || (container?.kind === "ImportClause" && container.phaseModifier === "TypeKeyword");
      case "ImportClause": return node.phaseModifier === "TypeKeyword";
      case "ImportEqualsDeclaration": return node.isTypeOnly;
      case "NamespaceImport": return parent?.kind === "ImportClause" && parent.phaseModifier === "TypeKeyword";
      case "NamespaceExport": return parent?.kind === "ExportDeclaration" && parent.isTypeOnly;
      default: return false;
    }
  };
  for (let position = 0; position < requested.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const request = requested[position];
    if (request === undefined) return fail("The actual selected external entry inventory is dense.");
    let exports = exportsOf.get(request.module);
    if (exports === undefined) {
      const current = modules.get(request.module);
      if (current === undefined) return fail("An external entry requires its actual checked public module.");
      const growth = chargeWork(account, current.module.exports.length)
        ?? chargeResultEntries(account, current.module.exports.length + 2);
      if (growth !== null) return growth;
      exports = new Map(current.module.exports.map(entry => [entry.name, entry]));
      exportsOf.set(request.module, exports);
    }
    const entry = exports.get(request.name);
    if (entry === undefined) return fail("An external entry must name an actual checked export.");
    const resolution = resolveModuleExport(source, entry);
    if (entry.typeOnlyStar !== null) return fail("A type-only export cannot expose a runtime entry.");
    for (let alias = 0; alias < resolution.aliases.length; alias += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const original = resolution.aliases[alias];
      if (original === undefined) return fail("The actual resolved alias chain is dense.");
      if (typeOnlyAlias(original)) return fail("A type-only export cannot expose a runtime entry.");
    }
    if (resolution.target.kind !== "available" || resolution.target.value.kind !== "declarations")
      return fail("An external callable entry requires its actual completed exported declaration group.");
    let callable = false;
    const storageSetup = chargeResultEntries(account, 1);
    if (storageSetup !== null) return storageSetup;
    const storage: DefId[] = [];
    for (let member = 0; member < resolution.target.value.definitions.length; member += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const definition = resolution.target.value.definitions[member];
      if (definition === undefined) return fail("The actual checked declaration group is dense.");
      const original = views.declarationSourceOf(definition);
      const node = original === null ? null : views.nodeOf(original);
      if (node === null) return fail("An external entry declaration must retain its actual checked source.");
      if (node.kind === "VariableDeclaration" && "declaration" in node.tsonic && node.tsonic.declaration.kind === "definition"
        && node.tsonic.declaration.definition === definition) {
        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        storage.push(definition);
        continue;
      }
      if (node.kind !== "FunctionDeclaration" || node.tsonic.body === null) continue;
      const body = node.tsonic.body;
      if (!node.tsonic.signatures.some(endpoint => endpoint.role === "api-body" && endpoint.body === body))
        return fail("An external callable entry needs its actual body endpoint.");
      if (!bodies.has(body)) {
        const growth = chargeResultEntries(account, 1);
        if (growth !== null) return growth;
        bodies.add(body);
      }
      callable = true;
    }
    if (!callable && storage.length === 0) return fail("An external entry requires its actual callable or exposed storage selection.");
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    selections.push({ module: request.module, name: request.name, definitions: resolution.target.value.definitions, storage });
  }
  return { kind: "complete", value: { bodies, selections } };
}

export function bindExternalStorage(targets: readonly ExternalTarget[], modules: readonly Execution[], views: CheckedSourceViews,
  summaryOf: (key: SummaryKey) => SummaryAnswer, account: DataflowAccount):
  DataflowResult<{ readonly external: readonly ResolvedExternalEntry[]; readonly storage: readonly ModuleStaticCellRef[] }> {
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (setup !== null) return setup;
  const requested = new Map<ModuleId, Set<DefId>>();
  for (const target of targets) {
    const row = chargeWork(account, 1);
    if (row !== null) return row;
    for (const definition of target.storage) {
      const entry = chargeWork(account, 1 + definition.length);
      if (entry !== null) return entry;
      const source = views.declarationSourceOf(definition);
      const node = source === null ? null : views.nodeOf(source);
      if (node?.kind !== "VariableDeclaration") return fail("An exposed static requires its actual checked storage declaration.");
      const module = node.origin.module;
      const lookup = chargeWork(account, 1 + module.length);
      if (lookup !== null) return lookup;
      let group = requested.get(module);
      if (group === undefined) {
        const retain = chargeResultEntries(account, 2);
        if (retain !== null) return retain;
        group = new Set();
        requested.set(module, group);
      }
      if (!group.has(definition)) {
        const retain = chargeResultEntries(account, 1);
        if (retain !== null) return retain;
        group.add(definition);
      }
    }
  }
  const found = new Map<DefId, ModuleStaticCellRef>();
  if (requested.size !== 0) for (const execution of modules) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const body = views.bodies.get(execution.instance.body);
    if (body?.root.kind !== "SourceFile") return fail("An exposed static requires actual scheduled module bodies.");
    const matchModule = chargeWork(account, body.root.origin.module.length);
    if (matchModule !== null) return matchModule;
    const group = requested.get(body.root.origin.module);
    if (group === undefined) continue;
    const key: SummaryKey = { kind: "body", execution };
    const identity = admitSummaryIdentity(key, account);
    if (identity !== null) return identity;
    const answer = summaryOf(key);
    const stopped = accountFailure(account);
    if (stopped !== null) return stopped;
    const summary = answer.value;
    if ("kind" in summary) return fail("An exposed static requires the actual converged module summary.");
    for (let position = 0; position < summary.initialization.cells.length; position += 1) {
      const inspect = chargeWork(account, 1);
      if (inspect !== null) return inspect;
      const index = summary.initialization.cells[position];
      const cell = index === undefined ? undefined : summary.arena.cells[index];
      if (cell?.role.kind !== "static") continue;
      const definition = cell.role.declaration.definition;
      const match = chargeWork(account, definition.length);
      if (match !== null) return match;
      if (!group.has(definition)) continue;
      if (found.has(definition)) return fail("An exposed static declaration requires its unique selected module cell.");
      const retain = chargeResultEntries(account, 3);
      if (retain !== null) return retain;
      found.set(definition, { owner: { kind: "summary", key }, cell: cell.id });
    }
  }
  const external: ResolvedExternalEntry[] = [];
  for (const target of targets) {
    const grow = chargeWork(account, 1) ?? chargeResultEntries(account, 3 + target.storage.length);
    if (grow !== null) return grow;
    const storage: ModuleStaticCellRef[] = [];
    for (const definition of target.storage) {
      const lookup = chargeWork(account, 1 + definition.length);
      if (lookup !== null) return lookup;
      const selected = found.get(definition);
      if (selected === undefined) return fail("An exposed static requires the actual declaration's stable module cell.");
      storage.push(selected);
    }
    external.push({ module: target.module, name: target.name, definitions: target.definitions, storage });
  }
  const retain = chargeResultEntries(account, found.size);
  return retain ?? { kind: "complete", value: { external, storage: [...found.values()] } };
}
