import type { DefId, LibraryExportIdentity } from "../ids/contract.js";
import type { LibraryRole } from "../snapshot/contract.js";
import type { BoundLibraries, LibraryCatalogue } from "./contract.js";
import { compareExports, exportKey } from "./verify-catalogue.js";

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
    .sort((left, right) => compareExports(left.identity, right.identity)).map(entry => entry.definition);
}
