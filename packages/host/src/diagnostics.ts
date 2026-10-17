import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, SourceFile } from "@tsonic/tsts";
import { createSourceDiagnosticSpanReader } from "@tsonic/target-api/source";
import type {
  TargetDiagnostic,
  TargetDiagnosticSourceSpan,
} from "@tsonic/target-api/artifacts";
import { isAbsolute, relative } from "node:path";
import { isPathWithinOrEqual } from "./path-relation.js";

export function collectTstsDiagnostics(source: CheckedSourceProgram, currentDirectory: string): readonly TargetDiagnostic[] {
  const spans = createSourceDiagnosticSpanReader(source.ast);
  const diagnostics = source.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const tstsDiagnostics: TargetDiagnostic[] = diagnostics.map((diagnostic): TargetDiagnostic => ({
    code: "TSTS_DIAGNOSTIC",
    category: tstsDiagnosticCategory(diagnostic),
    message: formatDiagnostics([diagnostic], currentDirectory).trimEnd(),
    source: "tsts",
    sourceSpan: getTstsDiagnosticSourceSpan(diagnostic, currentDirectory, spans),
    evidence: tstsDiagnosticEvidence(diagnostic),
  }));
  return [
    ...tstsDiagnostics,
    ...source.extensionDiagnostics.map((diagnostic): TargetDiagnostic => ({
      code: `TS${diagnostic.numericCode}`,
      category: diagnostic.category,
      message: diagnostic.message,
      source: diagnostic.extensionId,
      sourceSpan: getExtensionDiagnosticSourceSpan(source, diagnostic.nodeOrSpan, currentDirectory, spans),
      evidence: diagnostic.evidence?.map((entry) =>
        entry.details === undefined ? entry.message : `${entry.message}: ${formatDiagnosticEvidenceDetails(entry.details)}`),
    })),
  ];
}

export function finalizeTargetDiagnostics(
  source: CheckedSourceProgram,
  diagnostics: readonly TargetDiagnostic[],
  currentDirectory: string,
): readonly TargetDiagnostic[] {
  const spans = createSourceDiagnosticSpanReader(source.ast);
  return diagnostics.map((diagnostic) => {
    const sourceSpan = diagnostic.sourceSpan ??
      getExtensionDiagnosticSourceSpan(
        source,
        diagnostic.sourceNode,
        currentDirectory,
        spans,
      );
    const { sourceNode: _sourceNode, ...result } = diagnostic;
    return {
      ...result,
      ...(sourceSpan === undefined ? {} : { sourceSpan }),
    };
  });
}

function tstsDiagnosticCategory(diagnostic: unknown): TargetDiagnostic["category"] {
  const category = isObjectRecord(diagnostic) ? diagnostic.category : undefined;
  if (category === 0 || category === "warning") {
    return "warning";
  }
  if (category === 2 || category === 3 || category === "suggestion" || category === "message") {
    return "suggestion";
  }
  return "error";
}

function tstsDiagnosticEvidence(diagnostic: unknown): readonly string[] {
  const code = isObjectRecord(diagnostic) ? diagnostic.code : undefined;
  return typeof code === "number" || typeof code === "string"
    ? [`tsts.code=TS${code}`]
    : [];
}

function getTstsDiagnosticSourceSpan(
  diagnostic: unknown,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  if (!isObjectRecord(diagnostic)) {
    return undefined;
  }
  const file = diagnostic.file;
  const loc = diagnostic.loc;
  if (!isSourceFileLike(file) || !isDiagnosticLocation(loc)) {
    return undefined;
  }
  return createSourceSpan(file, loc.pos, loc.end, currentDirectory, spans);
}

function isSourceFileLike(value: unknown): value is SourceFile {
  return typeof value === "object" && value !== null;
}

function isDiagnosticLocation(value: unknown): value is { readonly pos: number; readonly end: number } {
  return isObjectRecord(value) &&
    typeof value.pos === "number" &&
    typeof value.end === "number";
}

function getExtensionDiagnosticSourceSpan(
  source: CheckedSourceProgram,
  nodeOrSpan: unknown,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  if (nodeOrSpan === undefined || nodeOrSpan === null || typeof nodeOrSpan !== "object") {
    return undefined;
  }
  if (isExtensionDiagnosticSourceSpan(nodeOrSpan)) {
    return createSourceSpan(
      nodeOrSpan.sourceFile as SourceFile,
      nodeOrSpan.pos,
      nodeOrSpan.end,
      currentDirectory,
      spans,
    );
  }
  if (source.ast.kind(nodeOrSpan as SourceFile) === undefined) {
    return undefined;
  }
  const sourceFile = source.ast.getSourceFile(nodeOrSpan as SourceFile);
  if (sourceFile === undefined) {
    return undefined;
  }
  return createSourceSpan(
    sourceFile,
    source.ast.pos(nodeOrSpan as SourceFile),
    source.ast.end(nodeOrSpan as SourceFile),
    currentDirectory,
    spans,
  );
}

function isExtensionDiagnosticSourceSpan(
  value: object,
): value is { readonly sourceFile: object; readonly pos: number; readonly end: number } {
  const record = value as Readonly<Record<string, unknown>>;
  return typeof record.sourceFile === "object" &&
    record.sourceFile !== null &&
    typeof record.pos === "number" &&
    typeof record.end === "number";
}

function createSourceSpan(
  sourceFile: SourceFile,
  pos: number,
  end: number,
  currentDirectory: string,
  spans: ReturnType<typeof createSourceDiagnosticSpanReader>,
): TargetDiagnosticSourceSpan | undefined {
  const span = spans(sourceFile, pos, end);
  return span === undefined ? undefined : { ...span, fileName: formatSourceFileName(span.fileName, currentDirectory) };
}

function formatSourceFileName(fileName: string, currentDirectory: string): string {
  if (!isAbsolute(fileName)) {
    return fileName.split("\\").join("/");
  }
  const relativePath = relative(currentDirectory, fileName);
  if (isPathWithinOrEqual(currentDirectory, fileName)) {
    return relativePath.split("\\").join("/");
  }
  return fileName.split("\\").join("/");
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
  if (value instanceof Error) {
    return formatErrorDiagnosticEvidence(value);
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

function formatErrorDiagnosticEvidence(error: Error): string {
  const parts = [
    error.name === "" ? "Error" : error.name,
    error.message === "" ? undefined : error.message,
  ].filter((part): part is string => part !== undefined);
  const stack = error.stack === undefined || error.stack === "" ? undefined : truncateDiagnosticEvidenceString(error.stack);
  return `{${[
    `"name":${JSON.stringify(parts[0] ?? "Error")}`,
    ...(parts[1] === undefined ? [] : [`"message":${JSON.stringify(parts[1])}`]),
    ...(stack === undefined ? [] : [`"stack":${JSON.stringify(stack)}`]),
  ].join(",")}}`;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
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
