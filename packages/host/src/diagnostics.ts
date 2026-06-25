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
  const formatted = formatJsonDiagnosticEvidenceDetails(details, new WeakSet<object>(), 0);
  return formatted === undefined ? String(details) : formatted;
}

const maxDiagnosticEvidenceDepth = 6;
const maxDiagnosticEvidenceEntries = 48;
const maxDiagnosticEvidenceStringLength = 500;

function formatJsonDiagnosticEvidenceDetails(value: unknown, seen: WeakSet<object>, depth: number): string | undefined {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return JSON.stringify(truncateDiagnosticEvidenceString(value));
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
  if (depth >= maxDiagnosticEvidenceDepth) {
    return `[${getObjectTag(value)}]`;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  const compilerObjectSummary = getCompilerObjectEvidenceSummary(value);
  if (compilerObjectSummary !== undefined) {
    return compilerObjectSummary;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const items = value
      .slice(0, maxDiagnosticEvidenceEntries)
      .map((item) => formatJsonDiagnosticEvidenceDetails(item, seen, depth + 1) ?? formatUnserializableDiagnosticEvidence(item));
    return `[${items.join(",")}${value.length > maxDiagnosticEvidenceEntries ? `,...${value.length - maxDiagnosticEvidenceEntries} more` : ""}]`;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = Object.entries(descriptors)
    .filter(([, descriptor]) => descriptor.enumerable)
    .slice(0, maxDiagnosticEvidenceEntries)
    .map(([key, descriptor]) => {
      if (!("value" in descriptor)) {
        return `${JSON.stringify(key)}:[Accessor]`;
      }
      return `${JSON.stringify(key)}:${formatJsonDiagnosticEvidenceDetails(descriptor.value, seen, depth + 1) ?? formatUnserializableDiagnosticEvidence(descriptor.value)}`;
    });
  const entryCount = Object.keys(descriptors).length;
  if (entryCount > maxDiagnosticEvidenceEntries) {
    entries.push(`"...":${JSON.stringify(`${entryCount - maxDiagnosticEvidenceEntries} more`)}`);
  }
  return `{${entries.join(",")}}`;
}

function formatUnserializableDiagnosticEvidence(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(truncateDiagnosticEvidenceString(value));
  }
  return typeof value === "object" && value !== null
    ? `[${getObjectTag(value)}]`
    : String(value);
}

function getObjectTag(value: object): string {
  return value.constructor?.name ?? "Object";
}

function truncateDiagnosticEvidenceString(value: string): string {
  return value.length <= maxDiagnosticEvidenceStringLength
    ? value
    : `${value.slice(0, maxDiagnosticEvidenceStringLength)}...<${value.length - maxDiagnosticEvidenceStringLength} more chars>`;
}

function getCompilerObjectEvidenceSummary(value: object): string | undefined {
  const record = value as Readonly<Record<string, unknown>>;
  if (
    typeof record.flags === "number" &&
    typeof record.id === "number" &&
    typeof record.checker === "object" &&
    record.checker !== null
  ) {
    return `[TstsType id=${record.id} flags=${record.flags}]`;
  }
  if (
    typeof record.fileName === "string" &&
    typeof record.Kind === "number" &&
    typeof record.text === "string"
  ) {
    return `[TstsSourceFile ${truncateDiagnosticEvidenceString(record.fileName)}]`;
  }
  if (
    typeof record.Kind === "number" &&
    typeof record.Loc === "object" &&
    record.Loc !== null &&
    typeof record.data === "object" &&
    record.data !== null
  ) {
    const loc = record.Loc as Readonly<Record<string, unknown>>;
    const pos = typeof loc.pos === "number" ? loc.pos : "?";
    const end = typeof loc.end === "number" ? loc.end : "?";
    return `[TstsNode kind=${record.Kind} pos=${pos} end=${end}]`;
  }
  if (
    typeof record.escapedName === "string" &&
    typeof record.flags === "number" &&
    Array.isArray(record.declarations)
  ) {
    return `[TstsSymbol ${record.escapedName} flags=${record.flags}]`;
  }
  return undefined;
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
