import { flattenDiagnosticMessageText } from "@tsonic/tsts";
import type { Diagnostic as CheckerDiagnostic } from "@tsonic/tsts";
import type { Diagnostic, DiagnosticSite, InvariantFailure, RelatedDiagnostic, Severity } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { CheckedProgram } from "./contract.js";
import { OpenedProgram } from "./handles.js";

const invariant = (message: string): InvariantFailure => ({ owner: "front", query: null, origin: null, message });

function siteOf(program: CheckedProgram, diagnostic: CheckerDiagnostic): DiagnosticSite {
  const file = diagnostic.file;
  if (file === undefined) return { kind: "none" };
  const checked = OpenedProgram.checked(program);
  const path = checked.ast.getFileName(file);
  const module = requirePresent(OpenedProgram.moduleAt(program, path), invariant("A checker diagnostic names a file outside the actual opened source domain."));
  const input = requirePresent(OpenedProgram.file(program, module), invariant("A checker diagnostic has no ready captured source text."));
  if (input.file !== file) return throwInvariant(invariant("A checker diagnostic must belong to the actual opened source file, not a same-path file from another program."));
  const range = checked.ast.sourceRange(file, diagnostic.loc.pos, diagnostic.loc.end);
  if (range.kind !== "source") return throwInvariant(invariant("A checker diagnostic has no authored source range."));
  return { kind: "source", origin: { module, start: range.start + input.displacement, length: range.end - range.start, derived: [] } };
}

function severityOf(diagnostic: CheckerDiagnostic): Severity {
  switch (diagnostic.category) {
    case 0: return "warning";
    case 1: return "error";
    case 2: return "suggestion";
    default: return throwInvariant(invariant("A published checker root has no severity in the diagnostic contract."));
  }
}

function relatedDiagnostic(program: CheckedProgram, entry: CheckerDiagnostic | undefined): RelatedDiagnostic {
  const note = requirePresent(entry, invariant("A checker diagnostic contains an absent related diagnostic."));
  return { site: siteOf(program, note), code: { kind: "checker", number: note.code, rendered: `TS${note.code}` },
    message: flattenDiagnosticMessageText(note) };
}

function checkerDiagnostic(program: CheckedProgram, diagnostic: CheckerDiagnostic, related: readonly RelatedDiagnostic[]): Diagnostic {
  return { code: { kind: "checker", number: diagnostic.code, rendered: `TS${diagnostic.code}` }, severity: severityOf(diagnostic),
    site: siteOf(program, diagnostic), source: null, evidence: [], message: flattenDiagnosticMessageText(diagnostic),
    arguments: diagnostic.messageArgs.map(value => ({ kind: "text", value })), related, fix: null };
}

export function captureCheckerDiagnostic(program: CheckedProgram, diagnostic: CheckerDiagnostic, charge: () => boolean): Diagnostic | null {
  if (!charge()) return null;
  const related: RelatedDiagnostic[] = [];
  for (const entry of diagnostic.relatedInformation) {
    if (!charge()) return null;
    related.push(relatedDiagnostic(program, entry));
  }
  return checkerDiagnostic(program, diagnostic, related);
}

export function captureSessionDiagnostics(program: CheckedProgram): readonly [Diagnostic, ...Diagnostic[]] | null {
  const checked = OpenedProgram.checked(program);
  let diagnostics: [Diagnostic, ...Diagnostic[]] | null = null;
  const add = (diagnostic: Diagnostic): void => {
    if (diagnostics === null) diagnostics = [diagnostic];
    else diagnostics.push(diagnostic);
  };
  for (const entry of checked.diagnostics) {
    const diagnostic = requirePresent(entry, invariant("The checker returned an empty diagnostic."));
    if (diagnostic.file !== undefined) continue;
    add(checkerDiagnostic(program, diagnostic, diagnostic.relatedInformation.map(entry => relatedDiagnostic(program, entry))));
  }
  for (const diagnostic of checked.extensionDiagnostics) {
    if (diagnostic.nodeOrSpan !== undefined) continue;
    add({ code: { kind: "extension", number: diagnostic.numericCode, extensionCode: diagnostic.extensionCode,
      rendered: diagnostic.publicCode ?? `TSEXT${diagnostic.numericCode}` }, severity: diagnostic.category,
      site: { kind: "none" }, source: diagnostic.extensionId, evidence: diagnostic.evidence?.map(entry => entry.message) ?? [],
      message: diagnostic.message, arguments: [], related: [], fix: null });
  }
  return diagnostics;
}
