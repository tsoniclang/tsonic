import type { LibraryRoleEntry } from "../snapshot/contract.js";
import type { KeyData, LibraryExportIdentity } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { BindingVector, TypeBinding } from "../ir-types/contract.js";
import type { BoundLibraries, Libraries, LibraryRoleVerificationContext, LibraryVerificationContext } from "./contract.js";
import { catalogueIndex, checkLibraryCatalogue, compareExports, exportKey, orderedViolations, violation } from "./verify-catalogue.js";
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
    if (role !== undefined && index.exports.get(key) != null &&
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

function typeBindingData(binding: TypeBinding): readonly KeyData[] {
  return binding.kind === "bound"
    ? [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type]
    : [binding.kind, binding.parameter.owner, binding.parameter.index];
}

function bindingKey(bindings: BindingVector): string {
  return encodeKey([
    bindings.classBindings.map(typeBindingData),
    bindings.methodBindings.map(typeBindingData),
    bindings.capturedBindings.map(typeBindingData),
    bindings.selfBindings.map(binding => binding.kind === "bound"
      ? [binding.kind, binding.owner, binding.type] : [binding.kind, binding.owner]),
  ]);
}

export function checkLibraries(libraries: Libraries, context: LibraryVerificationContext): readonly LibraryViolation[] {
  const output: LibraryViolation[] = [...checkBoundLibraries(libraries, context)];
  const index = catalogueIndex({ sources: libraries.sources });
  let previous: LibraryExportIdentity | null = null;
  for (const declared of libraries.declaredSummaries) {
    if (previous !== null && compareExports(previous, declared.identity) >= 0) {
      output.push(violation("declared-summaries-order", { kind: "export", identity: declared.identity }));
    }
    previous = declared.identity;
    const entry = index.exports.get(exportKey(declared.identity));
    if (entry == null || entry.signature === null) {
      output.push(violation("declared-summary-identity-resolves", { kind: "export", identity: declared.identity }));
      continue;
    }
    const binding = context.signatureOfExport(declared.identity);
    if (binding === null) {
      output.push(violation("declared-summary-identity-resolves", { kind: "export", identity: declared.identity }));
      continue;
    }
    const summary = declared.summary;
    if (!context.definitionExists(summary.key.definition) || summary.key.definition !== binding.definition ||
      summary.key.bindings.kind !== "instantiated" || bindingKey(summary.key.bindings.bindings) !== bindingKey(binding.bindings)) {
      output.push(violation("summary-binding-definition-exact", { kind: "export", identity: declared.identity }));
    }
    if (binding.signature === null || summary.signature !== binding.signature.id) {
      output.push(violation("summary-binding-signature-exact", { kind: "export", identity: declared.identity }));
    }
  }
  return orderedViolations(output);
}
