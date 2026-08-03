import { formatDiagnostics } from "@tsonic/tsts";
import type { SourceFile } from "@tsonic/tsts";
import type { TargetDiagnostic, TargetDiagnosticSourceSpan } from "@tsonic/target-api";
import { isAbsolute, relative } from "node:path";
import type { TsonicSemanticSession } from "./compiler-session.js";

export function collectTstsDiagnostics(session: TsonicSemanticSession, currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = session.source.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const tstsDiagnostics: TargetDiagnostic[] = diagnostics.map((diagnostic): TargetDiagnostic => ({
    code: "TSTS_DIAGNOSTIC",
    category: tstsDiagnosticCategory(diagnostic),
    message: formatDiagnostics([diagnostic], currentDirectory).trimEnd(),
    source: "tsts",
    sourceSpan: getTstsDiagnosticSourceSpan(session, diagnostic, currentDirectory),
    evidence: tstsDiagnosticEvidence(diagnostic),
  }));
  return [
    ...tstsDiagnostics,
    ...session.source.extensionDiagnostics.map((diagnostic): TargetDiagnostic => ({
      code: `TS${diagnostic.numericCode}`,
      category: diagnostic.category,
      message: diagnostic.message,
      source: diagnostic.extensionId,
      sourceSpan: getExtensionDiagnosticSourceSpan(session, diagnostic.nodeOrSpan, currentDirectory),
      evidence: diagnostic.evidence?.map((entry) =>
        entry.details === undefined ? entry.message : `${entry.message}: ${formatDiagnosticEvidenceDetails(entry.details)}`),
    })),
  ];
}

export function finalizeTargetDiagnostics(
  session: TsonicSemanticSession,
  diagnostics: readonly TargetDiagnostic[],
  currentDirectory: string,
): readonly TargetDiagnostic[] {
  return diagnostics.map((diagnostic) => {
    const sourceSpan = diagnostic.sourceSpan ??
      getExtensionDiagnosticSourceSpan(
        session,
        diagnostic.sourceNode,
        currentDirectory,
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
  session: TsonicSemanticSession,
  diagnostic: unknown,
  currentDirectory: string,
): TargetDiagnosticSourceSpan | undefined {
  if (!isObjectRecord(diagnostic)) {
    return undefined;
  }
  const file = diagnostic.file;
  const loc = diagnostic.loc;
  if (!isSourceFileLike(file) || !isDiagnosticLocation(loc)) {
    return undefined;
  }
  return createSourceSpan(session, file, loc.pos, loc.end, currentDirectory);
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
  session: TsonicSemanticSession,
  nodeOrSpan: unknown,
  currentDirectory: string,
): TargetDiagnosticSourceSpan | undefined {
  if (nodeOrSpan === undefined || nodeOrSpan === null || typeof nodeOrSpan !== "object") {
    return undefined;
  }
  if (isExtensionDiagnosticSourceSpan(nodeOrSpan)) {
    return createSourceSpan(
      session,
      nodeOrSpan.sourceFile as SourceFile,
      nodeOrSpan.pos,
      nodeOrSpan.end,
      currentDirectory,
    );
  }
  if (session.source.ast.kind(nodeOrSpan as SourceFile) === undefined) {
    return undefined;
  }
  const sourceFile = session.source.ast.getSourceFile(nodeOrSpan as SourceFile);
  if (sourceFile === undefined) {
    return undefined;
  }
  return createSourceSpan(
    session,
    sourceFile,
    session.source.ast.pos(nodeOrSpan as SourceFile),
    session.source.ast.end(nodeOrSpan as SourceFile),
    currentDirectory,
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
  session: TsonicSemanticSession,
  sourceFile: SourceFile,
  pos: number,
  end: number,
  currentDirectory: string,
): TargetDiagnosticSourceSpan | undefined {
  const text = session.source.ast.getSourceText(sourceFile);
  if (!Number.isInteger(pos) || !Number.isInteger(end) || pos < 0 || end < pos) {
    return undefined;
  }
  const normalizedStart = skipLeadingDiagnosticWhitespace(text, pos, end);
  const start = lineColumnAt(text, normalizedStart);
  const finish = lineColumnAt(text, end);
  if (start === undefined || finish === undefined) {
    return undefined;
  }
  return {
    fileName: formatSourceFileName(session.source.ast.getFileName(sourceFile), currentDirectory),
    line: start.line,
    column: start.column,
    endLine: finish.line,
    endColumn: finish.column,
  };
}

function skipLeadingDiagnosticWhitespace(text: string, start: number, end: number): number {
  const cursor = utf8CursorAt(text, start);
  if (cursor === undefined) {
    return start;
  }
  let byteOffset = cursor.byteOffset;
  let index = cursor.index;
  while (byteOffset < end && index < text.length) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined || !isDiagnosticLeadingWhitespace(codePoint)) {
      return byteOffset;
    }
    const charLength = codePoint > 0xffff ? 2 : 1;
    byteOffset += utf8ByteLength(codePoint);
    index += charLength;
  }
  return byteOffset;
}

function utf8CursorAt(text: string, position: number): { readonly byteOffset: number; readonly index: number } | undefined {
  let byteOffset = 0;
  let index = 0;
  while (index < text.length && byteOffset < position) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      return undefined;
    }
    const nextByteOffset = byteOffset + utf8ByteLength(codePoint);
    if (nextByteOffset > position) {
      return undefined;
    }
    byteOffset = nextByteOffset;
    index += codePoint > 0xffff ? 2 : 1;
    if (byteOffset === position) {
      return { byteOffset, index };
    }
  }
  return byteOffset === position ? { byteOffset, index } : undefined;
}

function isDiagnosticLeadingWhitespace(codePoint: number): boolean {
  return codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0b ||
    codePoint === 0x0c ||
    codePoint === 0x0d ||
    codePoint === 0x20;
}

function lineColumnAt(text: string, position: number): { readonly line: number; readonly column: number } | undefined {
  let byteOffset = 0;
  let line = 1;
  let column = 1;
  for (let index = 0; index < text.length && byteOffset < position;) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      return undefined;
    }
    const charLength = codePoint > 0xffff ? 2 : 1;
    if (codePoint === 0x0d && text[index + 1] === "\n") {
      const nextByteOffset = byteOffset + 2;
      if (nextByteOffset > position) {
        return undefined;
      }
      byteOffset = nextByteOffset;
      index += 2;
      line += 1;
      column = 1;
      continue;
    }
    const nextByteOffset = byteOffset + utf8ByteLength(codePoint);
    if (nextByteOffset > position) {
      return undefined;
    }
    byteOffset = nextByteOffset;
    index += charLength;
    if (codePoint === 0x0a || codePoint === 0x0d) {
      line += 1;
      column = 1;
      continue;
    }
    column += 1;
  }
  return byteOffset === position ? { line, column } : undefined;
}

function utf8ByteLength(codePoint: number): number {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }
  return 4;
}

function formatSourceFileName(fileName: string, currentDirectory: string): string {
  if (!isAbsolute(fileName)) {
    return fileName.split("\\").join("/");
  }
  const relativePath = relative(currentDirectory, fileName);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
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
