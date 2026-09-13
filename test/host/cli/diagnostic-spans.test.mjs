import assert from "node:assert/strict";
import test from "node:test";
import { finalizeTargetDiagnostics } from "../../../packages/host/dist/diagnostics.js";

function sourceSnapshot(text) {
  const file = {};
  let reads = 0;
  return {
    file,
    source: { ast: {
      getSourceText() { reads++; return text; },
      getFileName() { return "/project/source.ts"; },
    } },
    reads() { return reads; },
    replace(value) { text = value; },
  };
}

function diagnostic(file, pos, end) {
  return { code: "TEST", category: "error", message: "unchanged", sourceNode: { sourceFile: file, pos, end } };
}

function positionOracle(text, offset) {
  const bytes = Buffer.from(text);
  if (offset < 0 || offset > bytes.length || !Number.isInteger(offset) ||
    (bytes[offset - 1] === 13 && bytes[offset] === 10)) return undefined;
  let prefix;
  try { prefix = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset)); }
  catch { return undefined; }
  const lines = prefix.split(/\r\n|\r|\n/u);
  return { line: lines.length, column: Array.from(lines.at(-1)).length + 1 };
}

test("diagnostic checkpoints preserve every UTF-8 and newline boundary", () => {
  const text = `${"ab界😀\t ".repeat(260)}\r\n first\rsecond\nthird\u2028fourth`;
  const snapshot = sourceSnapshot(text);
  const byteLength = Buffer.byteLength(text);
  const inputs = Array.from({ length: byteLength + 2 }, (_, offset) => diagnostic(snapshot.file, offset, offset));
  const outputs = finalizeTargetDiagnostics(snapshot.source, inputs, "/project");
  for (let offset = 0; offset < outputs.length; offset++) {
    const expected = positionOracle(text, offset);
    assert.deepEqual(outputs[offset].sourceSpan, expected === undefined ? undefined : {
      fileName: "source.ts", ...expected, endLine: expected.line, endColumn: expected.column,
    }, `byte ${offset}`);
    assert.equal(outputs[offset].message, "unchanged");
    assert.equal("sourceNode" in outputs[offset], false);
  }
  assert.equal(snapshot.reads(), 1);
});

test("diagnostic whitespace normalization retains CRLF and multiline ranges", () => {
  const snapshot = sourceSnapshot("😀\r\n\t value\rnext");
  const outputs = finalizeTargetDiagnostics(snapshot.source, [
    diagnostic(snapshot.file, 4, 13),
    diagnostic(snapshot.file, 5, 13),
    diagnostic(snapshot.file, 4, 5),
    diagnostic(snapshot.file, 1, 13),
  ], "/project");
  for (const output of outputs.slice(0, 2)) assert.deepEqual(output.sourceSpan, {
    fileName: "source.ts", line: 2, column: 3, endLine: 2, endColumn: 8,
  });
  assert.equal(outputs[2].sourceSpan, undefined);
  assert.equal(outputs[3].sourceSpan, undefined);
});

test("diagnostic invalid ranges and supplied spans remain unchanged", () => {
  const snapshot = sourceSnapshot("value");
  const inputs = [
    [-1, 0], [0, -1], [3, 2], [0.5, 2], [0, NaN], [0, Infinity],
    [0, 6], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ].map(([pos, end]) => diagnostic(snapshot.file, pos, end));
  assert.ok(finalizeTargetDiagnostics(snapshot.source, inputs, "/project")
    .every(output => output.sourceSpan === undefined));
  const span = { fileName: "existing.ts", line: 3, column: 4, endLine: 3, endColumn: 9 };
  assert.deepEqual(finalizeTargetDiagnostics(snapshot.source, [
    { ...diagnostic(snapshot.file, 0, 1), sourceSpan: span },
  ], "/project")[0].sourceSpan, span);
});

test("diagnostic indexes do not survive into a different checked snapshot", () => {
  const snapshot = sourceSnapshot("first\nsecond");
  const input = diagnostic(snapshot.file, 6, 6);
  assert.equal(finalizeTargetDiagnostics(snapshot.source, [input], "/project")[0].sourceSpan.line, 2);
  snapshot.replace("first second");
  const next = finalizeTargetDiagnostics(snapshot.source, [input], "/project")[0].sourceSpan;
  assert.equal(next.line, 1);
  assert.equal(next.column, 7);
  assert.equal(snapshot.reads(), 2);
});

test("large-file diagnostic lookups have bounded character visits", () => {
  const text = `${"x".repeat(2 * 1024 * 1024)}😀end`;
  const snapshot = sourceSnapshot(text);
  const inputs = Array.from({ length: 1024 }, (_, offset) =>
    diagnostic(snapshot.file, text.length - 8 - offset, text.length - 7 - offset));
  const original = String.prototype.codePointAt;
  const budget = text.length + inputs.length * 4096;
  let visits = 0;
  let outputs;
  try {
    String.prototype.codePointAt = function (index) {
      visits++;
      if (visits > budget) throw new Error("Diagnostic positions rescanned the source prefix");
      return original.call(this, index);
    };
    outputs = finalizeTargetDiagnostics(snapshot.source, inputs, "/project");
  } finally {
    String.prototype.codePointAt = original;
  }
  assert.equal(snapshot.reads(), 1);
  assert.ok(outputs.every(output => output.sourceSpan?.line === 1));
  assert.ok(visits <= budget);
});
