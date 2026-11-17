import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitAnswerPosition, UnitDiagnostic } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import { tirOperationsOf } from "../ir-tir/index.js";
import type { FormDiagnostics, RefusedOccurrence, SafetyDiagnostics } from "./contract.js";

export const checkForms: FormDiagnostics = (deps, module, unit) => {
  const refused: RefusedOccurrence[] = [];
  const diagnostics: Diagnostic[] = [];
  const emissions: UnitDiagnostic[] = [];
  const positions: UnitAnswerPosition[] = [];
  const stack = [iterateChildrenOfSyntax(module.tree)];
  for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
    const next = frame.next();
    if (next.done) { stack.pop(); continue; }
    const node = next.value;
    if (node.kind === "ModuleDeclaration" && node.name.kind === "StringLiteral")
      return throwInvariant({ owner: "validate", query: null, origin: node.origin,
        message: "Module augmentation admission requires its actual declaration-document target and value/type inventory." });
    const unsupported = node.kind === "ModuleDeclaration" || node.kind === "Decorator" || node.kind === "AccessorKeyword"
      || deps.role === "source" && (node.kind === "DeclareKeyword" || node.kind === "ImportEqualsDeclaration"
        || node.kind === "ExportAssignment" && node.isExportEquals);
    if (unsupported) {
      const code = hostDiagnosticCode("TSONIC_SOURCE_FORM_UNSUPPORTED");
      const identity: Extract<DiagnosticIdentity, { readonly kind: "host" }> = { kind: "host", code, unit: { request: unit,
        position: { kind: "module-node", module: module.module, node: node.id } } };
      const error: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
      const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error",
        site: { kind: "source", origin: node.origin }, source: "validate", evidence: [],
        message: "The canonical source policy does not admit this source form.",
        arguments: [{ kind: "text", value: node.kind }], related: [], fix: null };
      refused.push({ module: module.module, node: node.id, error });
      diagnostics.push(diagnostic);
      emissions.push({ identity, diagnostic });
      positions.push({ position: identity.unit.position, error });
    }
    stack.push(iterateChildrenOfSyntax(node));
  }
  const first = refused[0];
  positions.push({ position: { kind: "result" }, error: first === undefined ? null : { kind: "error",
    causes: [{ kind: "unit", unit: { request: unit, position: { kind: "module-node", module: first.module, node: first.node } } }] } });
  return { kind: "ok", value: refused, diagnostics, emissions, positions };
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
