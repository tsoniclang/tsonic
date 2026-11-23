import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitAnswerPosition, UnitDiagnostic } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import type { CheckedPhase, HirNode, SyntaxChild } from "../ir-hir/contract.js";
import { iterateSyntaxChildEdges } from "../ir-hir/index.js";
import { tirOperationsOf } from "../ir-tir/index.js";
import type { FormDiagnostics, FormDiagnosticSite, IndexFormDiagnostics, SafetyDiagnostics } from "./contract.js";

export const indexForms: IndexFormDiagnostics = (deps, module) => {
  const sites: FormDiagnosticSite[] = [];
  const stack: { readonly owner: HirNode; readonly children: Iterator<SyntaxChild<CheckedPhase>> }[] =
    [{ owner: module.tree, children: iterateSyntaxChildEdges(module.tree) }];
  for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
    const next = frame.children.next();
    if (next.done) { stack.pop(); continue; }
    const { node, fields } = next.value;
    const unsupported = node.kind === "ModuleDeclaration" || node.kind === "Decorator" || node.kind === "AccessorKeyword"
      || deps.role === "source" && (node.kind === "DeclareKeyword" || node.kind === "ImportEqualsDeclaration"
        || node.kind === "ExportAssignment" && node.isExportEquals);
    if (unsupported) {
      const modifier = node.kind === "DeclareKeyword" || node.kind === "AccessorKeyword" || node.kind === "Decorator";
      if (modifier && fields[0] !== "modifiers") return throwInvariant({ owner: "validate", query: null, origin: node.origin,
        message: "A refused modifier must retain its actual owning declaration edge." });
      const cut = modifier ? frame.owner : node;
      sites.push({ kind: node.kind === "ModuleDeclaration" && node.name.kind === "StringLiteral" ? "augmentation-frontier" : "unsupported-form",
        module: module.module, report: node, cut, scope: deps.scopeOf(cut) });
    }
    stack.push({ owner: node, children: iterateSyntaxChildEdges(node) });
  }
  return sites;
};

export const checkForms: FormDiagnostics = (deps, site, unit) => {
  if (!deps.owns(site)) return throwInvariant({ owner: "validate", query: null, origin: null,
    message: "Forms needs its actual qualified detector in this captured Query base." });
  const { report, module } = site;
  if (site.kind === "augmentation-frontier")
    return throwInvariant({ owner: "validate", query: null, origin: report.origin,
      message: "Module augmentation admission requires its actual declaration-document target and value/type inventory." });
  const code = hostDiagnosticCode("TSONIC_SOURCE_FORM_UNSUPPORTED");
  const identity: Extract<DiagnosticIdentity, { readonly kind: "host" }> = { kind: "host", code, unit: { request: unit,
    position: { kind: "module-node", module, node: report.id } } };
  const error: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error",
    site: { kind: "source", origin: report.origin }, source: "validate", evidence: [],
    message: "The canonical source policy does not admit this source form.",
    arguments: [{ kind: "text", value: report.kind }], related: [], fix: null };
  const diagnostics: readonly [Diagnostic] = [diagnostic];
  return { kind: "ok", value: { module, node: site.cut, report: identity.unit, error, diagnostics }, diagnostics,
    emissions: [{ identity, diagnostic }], positions: [{ position: identity.unit.position, error },
      { position: { kind: "result" }, error: { kind: "error", causes: [{ kind: "unit", unit: identity.unit }] } }] };
};

export const checkSafety: SafetyDiagnostics = (deps, body, unit) => {
  const diagnostics: Diagnostic[] = [];
  const emissions: UnitDiagnostic[] = [];
  const positions: UnitAnswerPosition[] = [];
  let error: ErrorValue | null = null;
  for (const occurrence of tirOperationsOf(deps.verification, { body: body.body, bindings: body.bindings })) {
    const selected = occurrence.operation.decision.operation;
    if (selected.kind === "library" || selected.kind === "core")
      return throwInvariant({ owner: "validate", query: null, origin: occurrence.origin,
        message: "Safety requires the actual selected provider operation's permission contract." });
    if (selected.kind !== "pointer-address" && selected.kind !== "pointer-read"
      && selected.kind !== "pointer-write" && selected.kind !== "pointer-offset") continue;
    const scope = occurrence.operation.permissionScope;
    if (scope !== null) {
      const source = deps.verification.nodeOf({ kind: "body", value: { body: body.body, node: scope } });
      const phase = source?.tsonic;
      if (phase !== null && phase !== undefined && "core" in phase && phase.core.safety.kind === "available"
        && phase.core.safety.value?.family === "unsafe-context") continue;
      return throwInvariant({ owner: "validate", query: null, origin: occurrence.origin,
        message: "A selected permission scope requires its actual authored unsafe-context association." });
    }
    const code = hostDiagnosticCode("TSONIC_UNSAFE_CONTEXT_REQUIRED");
    const identity: Extract<DiagnosticIdentity, { readonly kind: "host" }> = { kind: "host", code,
      unit: { request: unit, position: { kind: "source-node", node: { kind: "body", value: occurrence.node } } } };
    const failure: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
    const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error",
      site: { kind: "source", origin: occurrence.origin }, source: "validate", evidence: [],
      message: "The selected operation requires an authored unsafe context.", arguments: [], related: [], fix: null };
    diagnostics.push(diagnostic);
    emissions.push({ identity, diagnostic });
    positions.push({ position: identity.unit.position, error: failure });
    error = { kind: "error", causes: [{ kind: "unit", unit: identity.unit }] };
  }
  positions.push({ position: { kind: "result" }, error });
  return { kind: "ok", value: error, diagnostics, emissions, positions };
};
