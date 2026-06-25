import { formatDiagnostics } from "@tsonic/tsts";
import type { CompilerSession } from "@tsonic/tsts";
import type { TargetDiagnostic } from "@tsonic/target-api";
import type { TsonicSemanticSession } from "./compiler-session.js";

export function collectTstsDiagnostics(session: TsonicSemanticSession, currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = session.tstsDiagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const message = formatDiagnostics(diagnostics, currentDirectory);
  const tstsDiagnostics: TargetDiagnostic[] = message.length === 0 ? [] : [{
    code: "TSTS_DIAGNOSTIC",
    category: "error",
    message,
    source: "tsts",
  }];
  return [
    ...tstsDiagnostics,
    ...session.extensionHost.diagnostics.all().map((diagnostic): TargetDiagnostic => ({
      code: `TS${diagnostic.numericCode}`,
      category: diagnostic.category,
      message: diagnostic.message,
      source: diagnostic.extensionId,
      evidence: diagnostic.evidence?.map((entry) =>
        entry.details === undefined ? entry.message : `${entry.message}: ${formatDiagnosticEvidenceDetails(entry.details)}`),
    })),
  ];
}

function formatDiagnosticEvidenceDetails(details: unknown): string {
  if (details === undefined) {
    return "";
  }
  const formatted = formatJsonDiagnosticEvidenceDetails(details, new WeakSet<object>());
  return formatted === undefined ? String(details) : formatted;
}

function formatJsonDiagnosticEvidenceDetails(value: unknown, seen: WeakSet<object>): string | undefined {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (typeof value !== "object" || value === null) {
    return JSON.stringify(value);
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatJsonDiagnosticEvidenceDetails(item, seen) ?? String(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${JSON.stringify(key)}:${formatJsonDiagnosticEvidenceDetails(item, seen) ?? String(item)}`);
  return `{${entries.join(",")}}`;
}

export function forceDiagnostics(session: CompilerSession): ReturnType<CompilerSession["getDiagnostics"]> {
  const diagnostics: ReturnType<CompilerSession["getDiagnostics"]>[number][] = [
    ...session.getDiagnostics("config"),
    ...session.getDiagnostics("program"),
    ...session.getDiagnostics("global"),
  ];
  for (const sourceFile of session.getSourceFiles()) {
    diagnostics.push(...session.getDiagnostics("syntactic", sourceFile));
    diagnostics.push(...session.getDiagnostics("bind", sourceFile));
    if (sourceFile?.IsDeclarationFile !== true) {
      diagnostics.push(...session.getDiagnostics("semantic", sourceFile));
    }
  }
  return diagnostics;
}
