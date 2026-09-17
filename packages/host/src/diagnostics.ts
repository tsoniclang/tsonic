import { formatDiagnostics } from "@tsonic/tsts";
import type { CheckedSourceProgram, SourceFile } from "@tsonic/tsts";
import type {
  TargetDiagnostic,
  TargetDiagnosticSourceSpan,
} from "@tsonic/target-api/artifacts";
import { isAbsolute, relative } from "node:path";
import { isPathWithinOrEqual } from "./path-relation.js";

export function collectTstsDiagnostics(source: CheckedSourceProgram, currentDirectory: string): readonly TargetDiagnostic[] {
  const positions: DiagnosticPositions = new WeakMap();
  const diagnostics = source.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const tstsDiagnostics: TargetDiagnostic[] = diagnostics.map((diagnostic): TargetDiagnostic => ({
    code: "TSTS_DIAGNOSTIC",
    category: tstsDiagnosticCategory(diagnostic),
    message: formatDiagnostics([diagnostic], currentDirectory).trimEnd(),
    source: "tsts",
    sourceSpan: getTstsDiagnosticSourceSpan(source, diagnostic, currentDirectory, positions),
    evidence: tstsDiagnosticEvidence(diagnostic),
  }));
  return [
    ...tstsDiagnostics,
    ...source.extensionDiagnostics.map((diagnostic): TargetDiagnostic => ({
      code: `TS${diagnostic.numericCode}`,
      category: diagnostic.category,
      message: diagnostic.message,
      source: diagnostic.extensionId,
      sourceSpan: getExtensionDiagnosticSourceSpan(source, diagnostic.nodeOrSpan, currentDirectory, positions),
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
  const positions: DiagnosticPositions = new WeakMap();
  return diagnostics.map((diagnostic) => {
    const sourceSpan = diagnostic.sourceSpan ??
      getExtensionDiagnosticSourceSpan(
        source,
        diagnostic.sourceNode,
        currentDirectory,
        positions,
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
  source: CheckedSourceProgram,
  diagnostic: unknown,
  currentDirectory: string,
  positions: DiagnosticPositions,
): TargetDiagnosticSourceSpan | undefined {
  if (!isObjectRecord(diagnostic)) {
    return undefined;
  }
  const file = diagnostic.file;
  const loc = diagnostic.loc;
  if (!isSourceFileLike(file) || !isDiagnosticLocation(loc)) {
    return undefined;
  }
  return createSourceSpan(source, file, loc.pos, loc.end, currentDirectory, positions);
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
  positions: DiagnosticPositions,
): TargetDiagnosticSourceSpan | undefined {
  if (nodeOrSpan === undefined || nodeOrSpan === null || typeof nodeOrSpan !== "object") {
    return undefined;
  }
  if (isExtensionDiagnosticSourceSpan(nodeOrSpan)) {
    return createSourceSpan(
      source,
      nodeOrSpan.sourceFile as SourceFile,
      nodeOrSpan.pos,
      nodeOrSpan.end,
      currentDirectory,
      positions,
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
    source,
    sourceFile,
    source.ast.pos(nodeOrSpan as SourceFile),
    source.ast.end(nodeOrSpan as SourceFile),
    currentDirectory,
    positions,
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
  source: CheckedSourceProgram,
  sourceFile: SourceFile,
  pos: number,
  end: number,
  currentDirectory: string,
  positions: DiagnosticPositions,
): TargetDiagnosticSourceSpan | undefined {
  if (!Number.isInteger(pos) || !Number.isInteger(end) || pos < 0 || end < pos) {
    return undefined;
  }
  let index = positions.get(sourceFile);
  if (index === undefined) {
    index = createDiagnosticPositionIndex(source.ast.getSourceText(sourceFile));
    positions.set(sourceFile, index);
  }
  const normalizedStart = skipLeadingDiagnosticWhitespace(index, pos, end);
  const start = lineColumnAt(index, normalizedStart);
  const finish = lineColumnAt(index, end);
  if (start === undefined || finish === undefined) {
    return undefined;
  }
  return {
    fileName: formatSourceFileName(source.ast.getFileName(sourceFile), currentDirectory),
    line: start.line,
    column: start.column,
    endLine: finish.line,
    endColumn: finish.column,
  };
}

interface DiagnosticCursor {
  readonly byteOffset: number;
  readonly index: number;
  readonly line: number;
  readonly column: number;
}

interface DiagnosticPositionIndex {
  readonly text: string;
  readonly checkpoints: readonly DiagnosticCursor[];
}

type DiagnosticPositions = WeakMap<SourceFile, DiagnosticPositionIndex>;

function createDiagnosticPositionIndex(text: string): DiagnosticPositionIndex {
  const checkpoints: DiagnosticCursor[] = [{ byteOffset: 0, index: 0, line: 1, column: 1 }];
  let byteOffset = 0;
  let line = 1;
  let column = 1;
  let previousCheckpoint = 0;
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!;
    if (codePoint === 0x0d && text[index + 1] === "\n") {
      byteOffset += 2;
      index += 2;
      line += 1;
      column = 1;
    } else {
      byteOffset += utf8ByteLength(codePoint);
      index += codePoint > 0xffff ? 2 : 1;
      if (codePoint === 0x0a || codePoint === 0x0d) {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    if (byteOffset - previousCheckpoint >= 1024) {
      checkpoints.push({ byteOffset, index, line, column });
      previousCheckpoint = byteOffset;
    }
  }
  return { text, checkpoints };
}

function diagnosticCheckpoint(index: DiagnosticPositionIndex, position: number): DiagnosticCursor {
  let lower = 0;
  let upper = index.checkpoints.length;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (index.checkpoints[middle]!.byteOffset > position) upper = middle;
    else lower = middle;
  }
  return index.checkpoints[lower]!;
}

function skipLeadingDiagnosticWhitespace(positions: DiagnosticPositionIndex, start: number, end: number): number {
  const cursor = utf8CursorAt(positions, start);
  if (cursor === undefined) {
    return start;
  }
  const { text } = positions;
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

function utf8CursorAt(positions: DiagnosticPositionIndex, position: number): { readonly byteOffset: number; readonly index: number } | undefined {
  const { text } = positions;
  let { byteOffset, index } = diagnosticCheckpoint(positions, position);
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

function lineColumnAt(positions: DiagnosticPositionIndex, position: number): { readonly line: number; readonly column: number } | undefined {
  const { text } = positions;
  let { byteOffset, index, line, column } = diagnosticCheckpoint(positions, position);
  for (; index < text.length && byteOffset < position;) {
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
