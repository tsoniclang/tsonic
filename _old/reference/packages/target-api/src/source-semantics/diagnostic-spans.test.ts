import assert from "node:assert/strict";
import test from "node:test";
import { dirname } from "node:path";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createSourceDiagnosticSpanReader } from "./diagnostic-spans.js";

function fixture(text: string, fileName = "/project/source.ts") {
  const source = createCompilerSessionFromFiles({ currentDirectory: dirname(fileName), files: { [fileName]: text },
    compilerOptions: { noLib: true, target: "es2022", module: "esnext" } }).checkSource();
  const file = source.sourceFiles.find(candidate => candidate !== undefined && source.ast.getFileName(candidate) === fileName);
  assert.equal(file !== undefined, true, "the actual checked source file exists");
  if (file === undefined) throw new Error("Missing checked diagnostic source fixture.");
  let reads = 0;
  const reader = createSourceDiagnosticSpanReader({ getFileName: source.ast.getFileName,
    getSourceText(selected) { reads++; return source.ast.getSourceText(selected); } });
  return { source, file, reader, reads: () => reads };
}

function positionOracle(text: string, offset: number) {
  const bytes = Buffer.from(text);
  if (offset < 0 || offset > bytes.length || !Number.isInteger(offset) ||
    (bytes[offset - 1] === 13 && bytes[offset] === 10)) return undefined;
  let prefix: string;
  try { prefix = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset)); }
  catch { return undefined; }
  const lines = prefix.split(/\r\n|\r|\n/u);
  return { line: lines.length, column: [...lines[lines.length - 1]!].length + 1 };
}

test("canonical diagnostic spans retain every UTF-8, CRLF and checkpoint boundary", () => {
  const text = `${"ab界😀\t ".repeat(260)}\r\n first\rsecond\nthird\u2028fourth`;
  const current = fixture(text);
  for (let offset = 0; offset <= Buffer.byteLength(text) + 1; offset++) {
    const position = positionOracle(text, offset);
    assert.deepEqual(current.reader(current.file, offset, offset), position === undefined ? undefined : {
      fileName: "/project/source.ts", ...position, endLine: position.line, endColumn: position.column,
    }, `byte ${offset}: exact coordinate or precise absence`);
  }
  assert.equal(current.reads(), 1, "one source-text index per exact file and reader");
});

test("canonical diagnostic spans preserve the original leading-whitespace contract", () => {
  const current = fixture("😀\r\n\t value\rnext");
  for (const start of [4, 5]) assert.deepEqual(current.reader(current.file, start, 13), {
    fileName: "/project/source.ts", line: 2, column: 3, endLine: 2, endColumn: 8,
  }, `byte ${start}: normalize only the valid leading diagnostic whitespace`);
  assert.equal(current.reader(current.file, 4, 5), undefined, "a range ending inside CRLF is not fabricated");
  assert.equal(current.reader(current.file, 1, 13), undefined, "a range starting inside a code point is not fabricated");
  const nonAscii = fixture(" \t\u00a0value");
  assert.deepEqual(nonAscii.reader(nonAscii.file, 0, 9), {
    fileName: "/project/source.ts", line: 1, column: 3, endLine: 1, endColumn: 9,
  }, "non-ASCII whitespace remains visible exactly as in the original host owner");
});

test("canonical diagnostic spans reject synthetic, reversed, fractional and foreign offsets", () => {
  const current = fixture("界value");
  for (const [start, end] of [[-1, -1], [-1, 0], [0, -1], [3, 2], [0.5, 3], [0, NaN], [0, Infinity],
    [0, 9], [1, 3], [3, 4.5], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]] as const) {
    assert.equal(current.reader(current.file, start, end), undefined, `${start}..${end}: no invented source position`);
  }
  assert.deepEqual(current.reader(current.file, 3, 8), {
    fileName: "/project/source.ts", line: 1, column: 2, endLine: 1, endColumn: 7,
  }, "a valid byte interval after a multibyte character remains exact");
});

test("canonical diagnostic indexes use exact file identity and do not escape a reader snapshot", () => {
  const first = fixture("first\nsecond");
  const second = fixture("first second");
  const documents = new Map([[first.file, "first\nsecond"], [second.file, "first second"]]);
  const reader = createSourceDiagnosticSpanReader({ getFileName: () => "/project/source.ts",
    getSourceText(file) {
      assert.equal(file !== undefined, true, "the reader never requests an absent checked source file");
      if (file === undefined) throw new Error("Missing checked diagnostic source file.");
      const text = documents.get(file);
      assert.equal(text !== undefined, true, "the original checked file identity owns this source text");
      if (text === undefined) throw new Error("Foreign diagnostic source file.");
      return text;
    } });
  assert.equal(reader(first.file, 6, 6)?.line, 2, "the first checked document has its own line index");
  assert.equal(reader(second.file, 6, 6)?.line, 1, "an equal filename cannot reuse another document's index");
  documents.set(first.file, "first second");
  assert.equal(reader(first.file, 6, 6)?.line, 2, "one reader retains its original snapshot");
  const next = createSourceDiagnosticSpanReader({ getFileName: () => "/project/source.ts",
    getSourceText(file) {
      assert.equal(file !== undefined, true, "the next reader also requires an actual checked source file");
      if (file === undefined) throw new Error("Missing checked diagnostic source file.");
      const text = documents.get(file);
      assert.equal(text !== undefined, true, "the actual checked file remains in the new snapshot");
      if (text === undefined) throw new Error("Foreign diagnostic source file.");
      return text;
    } });
  assert.equal(next(first.file, 6, 6)?.line, 1, "a subsequent compilation creates its own reader");
});

test("canonical diagnostic spans do not apply host or target filename formatting", () => {
  for (const fileName of ["/project/source.ts", "/external/source.ts"]) {
    const current = fixture("value", fileName);
    assert.equal(current.reader(current.file, 0, 5)?.fileName, fileName,
      `${fileName}: the caller retains the explicit display-path policy`);
  }
});
