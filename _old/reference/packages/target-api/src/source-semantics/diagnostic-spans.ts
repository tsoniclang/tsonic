import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../artifacts.js";

export function createSourceDiagnosticSpanReader(
  ast: Pick<AstReader, "getSourceText" | "getFileName">,
): (sourceFile: SourceFile, pos: number, end: number) => TargetDiagnosticSourceSpan | undefined {
  const positions = new WeakMap<SourceFile, DiagnosticPositionIndex>();
  return (sourceFile, pos, end) => {
    if (!Number.isInteger(pos) || !Number.isInteger(end) || pos < 0 || end < pos) return undefined;
    let index = positions.get(sourceFile);
    if (index === undefined) {
      index = createDiagnosticPositionIndex(ast.getSourceText(sourceFile));
      positions.set(sourceFile, index);
    }
    const normalizedStart = skipLeadingDiagnosticWhitespace(index, pos, end);
    const start = lineColumnAt(index, normalizedStart);
    const finish = lineColumnAt(index, end);
    if (start === undefined || finish === undefined) return undefined;
    return {
      fileName: ast.getFileName(sourceFile),
      line: start.line,
      column: start.column,
      endLine: finish.line,
      endColumn: finish.column,
    };
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
  if (cursor === undefined) return start;
  const { text } = positions;
  let byteOffset = cursor.byteOffset;
  let index = cursor.index;
  while (byteOffset < end && index < text.length) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined || !isDiagnosticLeadingWhitespace(codePoint)) return byteOffset;
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
    if (codePoint === undefined) return undefined;
    const nextByteOffset = byteOffset + utf8ByteLength(codePoint);
    if (nextByteOffset > position) return undefined;
    byteOffset = nextByteOffset;
    index += codePoint > 0xffff ? 2 : 1;
    if (byteOffset === position) return { byteOffset, index };
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
    if (codePoint === undefined) return undefined;
    const charLength = codePoint > 0xffff ? 2 : 1;
    if (codePoint === 0x0d && text[index + 1] === "\n") {
      const nextByteOffset = byteOffset + 2;
      if (nextByteOffset > position) return undefined;
      byteOffset = nextByteOffset;
      index += 2;
      line += 1;
      column = 1;
      continue;
    }
    const nextByteOffset = byteOffset + utf8ByteLength(codePoint);
    if (nextByteOffset > position) return undefined;
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
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}
