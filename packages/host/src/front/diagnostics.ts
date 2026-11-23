import { flattenDiagnosticMessageText, getDiagnosticRunMembers } from "@tsonic/tsts";
import type { Diagnostic as CheckerDiagnostic, ExtensionDiagnostic, Node, PreparedImportDiagnostic } from "@tsonic/tsts";
import type { CheckerDiagnosticRef, Diagnostic, DiagnosticSite, InvariantFailure, RelatedDiagnostic, Severity } from "../diag/contract.js";
import { orderDiagnostics, requirePresent, throwInvariant } from "../diag/index.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import type { CheckedProgram } from "./contract.js";
import { OpenedProgram } from "./handles.js";
import type { OpenedFile } from "./handles.js";

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

function severityOf(category: CheckerDiagnostic["category"]): Severity {
  switch (category) {
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
  return { code: { kind: "checker", number: diagnostic.code, rendered: `TS${diagnostic.code}` }, severity: severityOf(diagnostic.category),
    site: siteOf(program, diagnostic), source: null, evidence: [], message: flattenDiagnosticMessageText(diagnostic),
    arguments: diagnostic.messageArgs.map(value => ({ kind: "text", value })), related, fix: null };
}

export function importDiagnostic(input: PreparedImportDiagnostic,
  resolve: (path: string) => { readonly module: ModuleId; readonly displacement: number } | undefined): Diagnostic {
  const note = (entry: Pick<PreparedImportDiagnostic, "code" | "message" | "site">): RelatedDiagnostic => {
    const site = entry.site;
    const file = site === null ? undefined : resolve(site.fileName);
    return { code: { kind: "checker", number: entry.code, rendered: `TS${entry.code}` }, message: entry.message,
      site: site === null ? { kind: "none" } : file === undefined ? { kind: "file", path: site.fileName }
        : { kind: "source", origin: { module: file.module, start: site.start + file.displacement, length: site.length, derived: [] } } };
  };
  return { ...note(input), severity: severityOf(input.category), source: null, evidence: [],
    arguments: input.arguments.map(value => ({ kind: "text", value })), related: input.related.map(note), fix: null };
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

function extensionDiagnostic(diagnostic: ExtensionDiagnostic, site: DiagnosticSite, evidence: readonly string[]): Diagnostic {
  return { code: { kind: "extension", number: diagnostic.numericCode, extensionCode: diagnostic.extensionCode,
    rendered: diagnostic.publicCode ?? `TSEXT${diagnostic.numericCode}` }, severity: diagnostic.category, site,
    source: diagnostic.extensionId, evidence, message: diagnostic.message, arguments: [], related: [], fix: null };
}

function numberedNode(nodes: ReadonlyMap<object, NodeId>, value: object): value is Node {
  return nodes.has(value);
}

export function captureFileDiagnostics(program: CheckedProgram, module: ModuleId, input: OpenedFile, nodes: ReadonlyMap<Node, NodeId>,
  roots: Map<CheckerDiagnostic, CheckerDiagnosticRef>, charge: () => boolean): readonly Diagnostic[] {
  const checked = OpenedProgram.checked(program);
  const diagnostics: Diagnostic[] = [];
  const membersOf = new Map<Diagnostic, readonly (CheckerDiagnostic | undefined)[]>();
  for (const entry of checked.diagnostics) {
    const original = requirePresent(entry, invariant("The checker returned an absent published diagnostic."));
    if (original.file !== input.file) continue;
    const captured = captureCheckerDiagnostic(program, original, charge);
    if (captured === null) return diagnostics;
    diagnostics.push(captured);
    const members = getDiagnosticRunMembers(original);
    for (let index = 0; index < members.length; index += 1) if (!charge()) return diagnostics;
    if (!charge()) return diagnostics;
    membersOf.set(captured, members);
  }
  for (const original of checked.extensionDiagnostics) {
    const location = original.nodeOrSpan;
    if (typeof location !== "object" || location === null) continue;
    let bounds: { readonly start: number; readonly end: number };
    if (numberedNode(nodes, location)) {
      if (!charge()) return diagnostics;
      const range = checked.ast.authoredRange(location);
      if (range.kind !== "authored") return throwInvariant(invariant("An extension diagnostic needs its actual authored node range."));
      bounds = range;
    } else if ("sourceFile" in location && location.sourceFile === input.file && "pos" in location && "end" in location) {
      if (!charge()) return diagnostics;
      if (typeof location.pos !== "number" || typeof location.end !== "number")
        return throwInvariant(invariant("An extension diagnostic span must retain its actual checked byte range."));
      const range = checked.ast.sourceRange(input.file, location.pos, location.end);
      if (range.kind !== "source") return throwInvariant(invariant("An extension diagnostic span needs its actual checked file."));
      bounds = range;
    } else continue;
    const evidence: string[] = [];
    const items = original.evidence ?? [];
    for (let index = 0; index < items.length; index += 1) {
      if (!charge()) return diagnostics;
      evidence.push(requirePresent(items[index], invariant("Extension diagnostic evidence must be dense.")).message);
    }
    diagnostics.push(extensionDiagnostic(original, { kind: "source",
      origin: { module, start: bounds.start + input.displacement, length: bounds.end - bounds.start, derived: [] } }, evidence));
    if (!charge()) return diagnostics;
  }
  const ordered = orderDiagnostics(diagnostics);
  for (const [index, diagnostic] of ordered.entries()) {
    const members = membersOf.get(diagnostic);
    if (members === undefined) continue;
    const reference = { module, index };
    for (const entry of members) {
      const original = requirePresent(entry, invariant("A published checker diagnostic run cannot contain an absent original member."));
      if (roots.has(original)) return throwInvariant(invariant("An original checker diagnostic cannot belong to two published roots."));
      roots.set(original, reference);
    }
  }
  return ordered;
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
    add(extensionDiagnostic(diagnostic, { kind: "none" }, diagnostic.evidence?.map(entry => entry.message) ?? []));
  }
  return diagnostics;
}
