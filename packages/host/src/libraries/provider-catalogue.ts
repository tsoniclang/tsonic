import type { Diagnostic } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { PackageId } from "../ids/contract.js";
import type { LibraryAuthoredSummary, LibraryRoleEntry } from "../snapshot/contract.js";
import type { BindProviderLibraries, LibraryModule, LibraryText, ProviderLibraryModel, ProviderLibraryOrigin, SourceLibrary } from "./contract.js";
import { bindIndexedRoles } from "./roles.js";
import { catalogueIndex, checkIndexedLibraryCatalogue, compareExports, compareModules, compareText, exportKey, moduleKey } from "./verify-catalogue.js";

function diagnostic(evidence: string, path: string | null, message: string): Diagnostic {
  const rendered = "TSONIC_PROVIDER_LIBRARY_INVALID";
  return { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: path === null ? { kind: "none" } : { kind: "file", path }, source: "libraries", evidence: [evidence],
    message, arguments: [], related: [], fix: null };
}

interface ModuleEntry extends ProviderLibraryModel {
  readonly roles: LibraryRoleEntry[];
  readonly source: SourceEntry;
}

interface SourceEntry {
  readonly modules: LibraryModule[];
  readonly declarations: LibraryText[];
}

export const bindProviderLibraries: BindProviderLibraries = (capture, data) => {
  const modules = new Map<string, ModuleEntry>();
  const sources = new Map<PackageId, SourceEntry>();
  for (const entry of capture.models) {
    const key = moduleKey(entry.model.identity);
    if (modules.has(key)) return { kind: "refused", diagnostics: [
      diagnostic(key, null, "A provider module requires one public model in its actual registered package."),
    ] };
    let source = sources.get(entry.package);
    if (source === undefined) {
      source = { modules: [], declarations: [] };
      sources.set(entry.package, source);
    }
    modules.set(key, { ...entry, roles: [], source });
  }
  for (const text of capture.texts) {
    const key = moduleKey(text.identity);
    const module = modules.get(key);
    if (module?.package !== text.package) return { kind: "refused", diagnostics: [
      diagnostic(key, text.fileName, "A provider document requires its actual registered package and public model."),
    ] };
    module.source.declarations.push({ fileName: text.fileName, sourceText: text.sourceText, module: module.model.identity });
  }
  const origins = new Map<string, ProviderLibraryOrigin>();
  for (const origin of capture.origins) {
    const key = exportKey(origin.identity);
    const owner = modules.get(moduleKey(origin.identity.module));
    if (owner?.package !== origin.package || origins.has(key)) return { kind: "refused", diagnostics: [
      diagnostic(key, null, "A provider declaration requires one independently checked origin in its registered package."),
    ] };
    origins.set(key, origin);
  }
  const declaredSummaries: LibraryAuthoredSummary[] = [];
  for (const input of data) {
    for (const role of input.roles) {
      const module = modules.get(moduleKey(role.identity.module));
      if (module?.package !== input.package) return { kind: "refused", diagnostics: [
        diagnostic(exportKey(role.identity), input.path, "A role must be assigned by the package that registered its actual provider module."),
      ] };
      module.roles.push(role);
    }
    for (const summary of input.declaredSummaries) {
      const module = modules.get(moduleKey(summary.identity.module));
      if (module?.package !== input.package) return { kind: "refused", diagnostics: [
        diagnostic(exportKey(summary.identity), input.path, "A guarantee must be authored by the package that registered its actual provider module."),
      ] };
      declaredSummaries.push(summary);
    }
  }
  for (const entry of modules.values()) {
    entry.roles.sort((left, right) => compareExports(left.identity, right.identity));
    const { identity, types, imports, exports } = entry.model;
    entry.source.modules.push({ identity, types, imports, exports, roles: entry.roles });
  }
  const catalogue: SourceLibrary[] = [];
  for (const [id, source] of sources) {
    source.modules.sort((left, right) => compareModules(left.identity, right.identity));
    source.declarations.sort((left, right) => compareText(left.fileName, right.fileName));
    catalogue.push({ id, modules: source.modules, declarations: source.declarations });
  }
  catalogue.sort((left, right) => compareText(left.id, right.id));
  const projected = { sources: catalogue };
  const index = catalogueIndex(projected);
  const violation = checkIndexedLibraryCatalogue(projected, index)[0];
  if (violation !== undefined) return { kind: "refused", diagnostics: [
    diagnostic(violation.rule, null, "The admitted provider catalogue has an invalid declaration, type or claim."),
  ] };
  for (const key of origins.keys()) {
    if (!index.exports.get(key)) return { kind: "refused", diagnostics: [
      diagnostic(key, null, "A canonical provider declaration must name an export in its actual public model."),
    ] };
  }
  const bound = bindIndexedRoles(projected, index, identity => origins.get(exportKey(identity))?.definition ?? null);
  if (bound.kind === "refused") return bound;
  declaredSummaries.sort((left, right) => compareExports(left.identity, right.identity));
  return { kind: "ok", value: { bound: bound.value, declaredSummaries }, diagnostics: [] };
};
