import type { DefId, LibraryExportIdentity } from "../ids/contract.js";
import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { LibraryAuthoredSummary } from "../snapshot/contract.js";
import type { AdmitGuarantees, AdmittedNativeGuarantee, BoundLibraries, Libraries, LibrarySignature } from "./contract.js";
import { catalogueIndex, compareExports, exportKey } from "./verify-catalogue.js";
import type { CatalogueIndex, LibraryViolation } from "./verify-catalogue.js";
import { validateAuthoredSummary } from "./verify-summaries.js";

function diagnostic(identity: LibraryExportIdentity): Diagnostic {
  const rendered = "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID";
  return { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: { kind: "none" }, source: "libraries", evidence: [exportKey(identity)],
    message: "Library summary binding does not match its declared signature and member.", arguments: [], related: [], fix: null };
}

export function admitIndexedGuarantees(bound: BoundLibraries, index: CatalogueIndex, declared: readonly LibraryAuthoredSummary[],
  definitionOfExport: Parameters<AdmitGuarantees>[2]): Result<Libraries> {
  const roles = new Map<string, DefId | null>();
  for (const role of bound.sourceRoles) {
    const key = exportKey(role.identity);
    roles.set(key, roles.has(key) ? null : role.definition);
  }
  type Statement = { readonly statement: LibraryAuthoredSummary; count: number };
  const statements = new Map<string, Statement>();
  for (const statement of declared) {
    const key = exportKey(statement.identity);
    const previous = statements.get(key);
    if (previous === undefined) statements.set(key, { statement, count: 1 });
    else previous.count += 1;
  }
  const diagnostics: Diagnostic[] = [];
  const guarantees: AdmittedNativeGuarantee[] = [];
  const callbacks = new Map<string, readonly LibrarySignature[]>();
  const ordered = [...statements.values()].sort((left, right) => compareExports(left.statement.identity, right.statement.identity));
  for (const group of ordered) {
    const statement = group.statement;
    const key = exportKey(statement.identity);
    const entry = index.exports.get(key);
    const role = roles.get(key);
    const findings: LibraryViolation[] = [];
    if (group.count !== 1 || entry === undefined || entry === null || entry.signature === null
      || !validateAuthoredSummary(statement, index, findings, callbacks)) {
      diagnostics.push(diagnostic(statement.identity));
      continue;
    }
    const declaration = definitionOfExport(statement.identity);
    if (declaration === null || role === null || role !== undefined && role !== declaration) {
      diagnostics.push(diagnostic(statement.identity));
      continue;
    }
    guarantees.push({ statement, declaration });
  }
  const [first, ...rest] = diagnostics;
  return first === undefined ? { kind: "ok", value: { sources: bound.sources, sourceRoles: bound.sourceRoles,
    guarantees }, diagnostics: [] } : { kind: "refused", diagnostics: [first, ...rest] };
}

export const admitGuarantees: AdmitGuarantees = (bound, declared, definitionOfExport) =>
  admitIndexedGuarantees(bound, catalogueIndex(bound), declared, definitionOfExport);
