import type { LibraryRoleEntry } from "../snapshot/contract.js";
import type { LibraryExportIdentity } from "../ids/contract.js";
import type { LibrarySignature, BoundLibraries, Libraries, LibraryRoleVerificationContext } from "./contract.js";
import { catalogueIndex, checkLibraryCatalogue, compareExports, exportKey, orderedViolations, violation } from "./verify-catalogue.js";
import { validateAuthoredSummary } from "./verify-summaries.js";
import type { LibraryViolation } from "./verify-catalogue.js";

export function checkBoundLibraries(libraries: BoundLibraries,
  context: LibraryRoleVerificationContext): readonly LibraryViolation[] {
  const output: LibraryViolation[] = [...checkLibraryCatalogue({ sources: libraries.sources })];
  const catalogue = { sources: libraries.sources };
  const index = catalogueIndex(catalogue);
  const roles = new Map<string, LibraryRoleEntry[]>();
  for (const source of libraries.sources) {
    for (const module of source.modules) {
      for (const role of module.roles) {
        const key = exportKey(role.identity);
        const entries = roles.get(key);
        if (entries === undefined) roles.set(key, [role]);
        else entries.push(role);
      }
    }
  }
  const supplied = new Set<string>();
  let previous: LibraryExportIdentity | null = null;
  for (const binding of libraries.sourceRoles) {
    const key = exportKey(binding.identity);
    if (previous !== null && compareExports(previous, binding.identity) > 0) {
      output.push(violation("role-bindings-order", { kind: "export", identity: binding.identity }));
    }
    previous = binding.identity;
    if (!context.definitionExists(binding.definition)) {
      output.push(violation("role-definition-resolves", { kind: "export", identity: binding.identity }));
    }
    const entries = roles.get(key);
    const role = entries?.length === 1 ? entries[0] : undefined;
    if (supplied.has(key) || role === undefined || role.role !== binding.role) {
      output.push(violation("role-binding-exact", { kind: "export", identity: binding.identity }));
    }
    const declared = index.exports.get(key);
    if (role !== undefined && declared !== undefined && declared !== null &&
      context.definitionOfExport(binding.identity) !== binding.definition) {
      output.push(violation("role-binding-exact", { kind: "export", identity: binding.identity }));
    }
    supplied.add(key);
  }
  for (const [key, entries] of roles) {
    if (!supplied.has(key)) {
      for (const role of entries) output.push(violation("role-binding-exact", { kind: "export", identity: role.identity }));
    }
  }
  return orderedViolations(output);
}

export function checkLibraries(libraries: Libraries, context: LibraryRoleVerificationContext): readonly LibraryViolation[] {
  const output: LibraryViolation[] = [...checkBoundLibraries(libraries, context)];
  const index = catalogueIndex({ sources: libraries.sources });
  const callbacks = new Map<string, readonly LibrarySignature[]>();
  let previous: LibraryExportIdentity | null = null;
  for (const admitted of libraries.guarantees) {
    const identity = admitted.statement.identity;
    if (previous !== null && compareExports(previous, identity) >= 0) {
      output.push(violation("declared-summaries-order", { kind: "export", identity }));
    }
    previous = identity;
    const entry = index.exports.get(exportKey(identity));
    if (entry === undefined || entry === null || entry.signature === null) {
      output.push(violation("declared-summary-identity-resolves", { kind: "export", identity }));
      continue;
    }
    validateAuthoredSummary(admitted.statement, index, output, callbacks);
    if (!context.definitionExists(admitted.declaration) || admitted.declaration !== context.definitionOfExport(identity)) {
      output.push(violation("summary-binding-definition-exact", { kind: "export", identity }));
    }
  }
  return orderedViolations(output);
}
