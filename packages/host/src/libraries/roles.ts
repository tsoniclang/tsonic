import type { DefId, LibraryExportIdentity } from "../ids/contract.js";
import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { LibraryRole, LibraryRoleEntry } from "../snapshot/contract.js";
import type { BoundLibraries, LibraryCatalogue, LibraryRoleBinding } from "./contract.js";
import { catalogueIndex, compareExports, compareText, exportKey, moduleKey } from "./verify-catalogue.js";

function roleDiagnostic(identity: LibraryExportIdentity): Diagnostic {
  const name = "TSONIC_LIBRARY_ROLE_BINDING_INVALID";
  return { code: { kind: "host", name: hostDiagnosticCode(name), rendered: name }, severity: "error",
    site: { kind: "none" }, source: "libraries", evidence: [exportKey(identity)],
    message: "Library role binding does not resolve the declared export identity.", arguments: [], related: [], fix: null };
}

export function bindCatalogueRoles(catalogue: LibraryCatalogue,
  definitionOfExport: (identity: LibraryExportIdentity) => DefId): Result<BoundLibraries> {
  const index = catalogueIndex(catalogue);
  const groups = new Map<string, { readonly entry: LibraryRoleEntry; count: number; local: boolean }>();
  for (const source of catalogue.sources) {
    for (const module of source.modules) {
      const owner = moduleKey(module.identity);
      for (const entry of module.roles) {
        const key = exportKey(entry.identity);
        const group = groups.get(key);
        const local = moduleKey(entry.identity.module) === owner;
        if (group === undefined) groups.set(key, { entry, count: 1, local });
        else {
          group.count += 1;
          group.local = group.local && local;
        }
      }
    }
  }
  const diagnostics: Diagnostic[] = [];
  const sourceRoles: LibraryRoleBinding[] = [];
  const ordered = [...groups.values()].sort((left, right) => compareExports(left.entry.identity, right.entry.identity));
  for (const group of ordered) {
    const entry = group.entry;
    if (group.count !== 1 || !group.local || index.exports.get(exportKey(entry.identity)) == null) {
      diagnostics.push(roleDiagnostic(entry.identity));
    } else {
      sourceRoles.push({ identity: entry.identity, role: entry.role, definition: definitionOfExport(entry.identity) });
    }
  }
  const first = diagnostics[0];
  return first === undefined ? { kind: "ok", value: { sources: catalogue.sources, sourceRoles }, diagnostics: [] }
    : { kind: "refused", diagnostics: [first, ...diagnostics.slice(1)] };
}

export function roleOf(catalogue: LibraryCatalogue, identity: LibraryExportIdentity): LibraryRole | null {
  const key = exportKey(identity);
  let role: LibraryRole | null = null;
  for (const source of catalogue.sources) {
    for (const module of source.modules) {
      for (const entry of module.roles) {
        if (exportKey(entry.identity) !== key) continue;
        if (role !== null) throw new TypeError(`libraries: duplicate role identity ${key}`);
        role = entry.role;
      }
    }
  }
  return role;
}

export function rolesOf(libraries: BoundLibraries, role: LibraryRole): readonly DefId[] {
  return libraries.sourceRoles.filter(entry => entry.role === role)
    .sort((left, right) => compareExports(left.identity, right.identity) || compareText(left.definition, right.definition))
    .map(entry => entry.definition);
}
