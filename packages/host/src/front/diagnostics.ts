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
  const delivered = checked.ast.getSourceText(file);
  const displacement = input.text.length - delivered.length;
  if (displacement < 0 || input.text.slice(displacement) !== delivered)
    return throwInvariant(invariant("A checker diagnostic's source does not join its actual captured text."));
  return { kind: "source", origin: { module, start: range.start + displacement, length: range.end - range.start, derived: [] } };
}

function severityOf(diagnostic: CheckerDiagnostic): Severity {
  switch (diagnostic.category) {
    case 0: return "warning";
    case 1: return "error";
    case 2: return "suggestion";
    default: return throwInvariant(invariant("A published checker root has no severity in the diagnostic contract."));
  }
}

export function captureCheckerDiagnostic(program: CheckedProgram, diagnostic: CheckerDiagnostic, charge: () => boolean): Diagnostic | null {
  if (!charge()) return null;
  const related: RelatedDiagnostic[] = [];
  for (const entry of diagnostic.relatedInformation) {
    if (!charge()) return null;
    const note = requirePresent(entry, invariant("A checker diagnostic contains an absent related diagnostic."));
    related.push({ site: siteOf(program, note), code: { kind: "checker", number: note.code, rendered: `TS${note.code}` },
      message: flattenDiagnosticMessageText(note) });
  }
  return { code: { kind: "checker", number: diagnostic.code, rendered: `TS${diagnostic.code}` }, severity: severityOf(diagnostic),
    site: siteOf(program, diagnostic), source: null, evidence: [], message: flattenDiagnosticMessageText(diagnostic),
    arguments: diagnostic.messageArgs.map(value => ({ kind: "text", value })), related, fix: null };
}
