import type { DefId, LibraryExportIdentity } from "../ids/contract.js";
import type { Diagnostic, Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { LibraryAuthoredSummary } from "../snapshot/contract.js";
import { signatureRequestKey } from "../ir-types/index.js";
import type { AdmittedNativeGuarantee, BoundLibraries, Libraries, LibrarySignature, NativeExportAssociation } from "./contract.js";
import { catalogueIndex, compareExports, exportKey } from "./verify-catalogue.js";
import type { LibraryViolation } from "./verify-catalogue.js";
import { validateAuthoredSummary } from "./verify-summaries.js";

export function associationIndex(associations: readonly NativeExportAssociation[]): {
  readonly exports: ReadonlyMap<string, NativeExportAssociation | null>;
  readonly requests: ReadonlyMap<string, (NativeExportAssociation & { readonly kind: "callable" }) | null>;
} {
  const exports = new Map<string, NativeExportAssociation | null>();
  const requests = new Map<string, (NativeExportAssociation & { readonly kind: "callable" }) | null>();
  for (const association of associations) {
    const key = exportKey(association.identity);
    exports.set(key, exports.has(key) ? null : association);
    if (association.kind !== "callable") continue;
    if (association.guarantee === undefined) throw new TypeError("A native callable association requires ready canonical guarantee-origin evidence");
    const request = signatureRequestKey(association.request);
    const previous = requests.get(request);
    const origin = association.guarantee === null ? null : exportKey(association.guarantee);
    if (previous === undefined) requests.set(request, association);
    else if (previous !== null && (previous.signature.id !== association.signature.id
      || (previous.guarantee === null ? null : exportKey(previous.guarantee)) !== origin)) requests.set(request, null);
  }
  return { exports, requests };
}

function diagnostic(identity: LibraryExportIdentity): Diagnostic {
  const rendered = "TSONIC_LIBRARY_SUMMARY_BINDING_INVALID";
  return { code: { kind: "host", name: hostDiagnosticCode(rendered), rendered }, severity: "error",
    site: { kind: "none" }, source: "libraries", evidence: [exportKey(identity)],
    message: "Library summary binding does not match its declared signature and member.", arguments: [], related: [], fix: null };
}

export function admitGuarantees(bound: BoundLibraries, declared: readonly LibraryAuthoredSummary[],
  associations: readonly NativeExportAssociation[]): Result<Libraries> {
  const index = catalogueIndex({ sources: bound.sources });
  const associated = associationIndex(associations);
  const roles = new Map<string, DefId | null>();
  for (const role of bound.sourceRoles) {
    const key = exportKey(role.identity);
    roles.set(key, roles.has(key) ? null : role.definition);
  }
  type Statement = { readonly kind: "statement"; readonly statement: LibraryAuthoredSummary; count: number };
  type Origin = Statement
    | { readonly kind: "missing"; readonly identity: LibraryExportIdentity };
  const statements = new Map<string, Statement>();
  for (const statement of declared) {
    const key = exportKey(statement.identity);
    const previous = statements.get(key);
    if (previous === undefined) statements.set(key, { kind: "statement", statement, count: 1 });
    else previous.count += 1;
  }
  const groups: Map<string, Origin> = statements;
  for (const association of associations) {
    if (association.kind !== "callable" || association.guarantee === null) continue;
    const key = exportKey(association.guarantee);
    if (!groups.has(key)) groups.set(key, { kind: "missing", identity: association.guarantee });
  }
  const diagnostics: Diagnostic[] = [];
  const guarantees: AdmittedNativeGuarantee[] = [];
  const callbacks = new Map<string, readonly LibrarySignature[]>();
  const identityOf = (origin: Origin): LibraryExportIdentity => origin.kind === "statement" ? origin.statement.identity : origin.identity;
  const ordered = [...groups.values()].sort((left, right) => compareExports(identityOf(left), identityOf(right)));
  for (const group of ordered) {
    if (group.kind === "missing") {
      diagnostics.push(diagnostic(group.identity));
      continue;
    }
    const statement = group.statement;
    const key = exportKey(statement.identity);
    const association = associated.exports.get(key);
    const role = roles.get(key);
    const findings: LibraryViolation[] = [];
    if (group.count !== 1 || association === undefined || association === null || association.kind !== "callable"
      || association.guarantee === null || exportKey(association.guarantee) !== key
      || associated.requests.get(signatureRequestKey(association.request)) === null
      || (statement.identity.memberId !== null) !== (association.member !== null)
      || association.signature.declaration !== null && association.signature.declaration !== association.request.definition
      || role === null || role !== undefined && role !== association.request.definition
      || !validateAuthoredSummary(statement, index, findings, callbacks)) {
      diagnostics.push(diagnostic(statement.identity));
      continue;
    }
    guarantees.push({ statement, declaration: association.request.definition });
  }
  const [first, ...rest] = diagnostics;
  return first === undefined ? { kind: "ok", value: { sources: bound.sources, sourceRoles: bound.sourceRoles,
    guarantees }, diagnostics: [] } : { kind: "refused", diagnostics: [first, ...rest] };
}
