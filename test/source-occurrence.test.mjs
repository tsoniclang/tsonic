import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompilerSessionFromFiles,
} from "@tsonic/tsts";
import {
  createTargetSourceProgram,
} from "../packages/target-api/dist/index.js";

test("source occurrence locators round-trip exact checked UTF-16 syntax", () => {
  const sourceText = [
    "const prefix = \"😀\";",
    "function read(): number { return 1; }",
    "const value = (read()) + read(); // two calls",
    "",
  ].join("\r\n");
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/project",
    files: { "/project/index.ts": sourceText },
    compilerOptions: { noLib: true, strict: true },
  }).checkSource();
  const source = createTargetSourceProgram(checked);
  const sourceFile = source.sourceFiles.find((candidate) =>
    source.ast.getFileName(candidate) === "/project/index.ts"
  );
  assert.notEqual(sourceFile, undefined);
  const document = source.documents.forFile(sourceFile);
  assert.equal(document.text, sourceText);
  assert.equal(document.identity, "/project/index.ts");
  assert.equal(source.documents.includes(document), true);

  const calls = descendants(source, sourceFile).filter((node) =>
    source.ast.is.IsCallExpression(node)
  );
  assert.equal(calls.length, 2);
  const occurrences = calls.map((call) => source.documents.occurrenceFor(call));
  assert.equal(occurrences.every((occurrence) => occurrence.kind === "authored"), true);
  assert.deepEqual(occurrences.map((occurrence) =>
    occurrence.kind === "authored"
      ? document.text.slice(occurrence.start, occurrence.end)
      : undefined
  ), ["read()", "read()"]);
  assert.equal(occurrences[0].kind === "authored" && occurrences[1].kind === "authored"
    ? occurrences[0].start !== occurrences[1].start
    : false, true);

  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index];
    assert.equal(occurrence.kind, "authored");
    if (occurrence.kind !== "authored") {
      assert.fail("Expected authored call occurrence.");
    }
    assert.equal(occurrence.syntaxKind, "KindCallExpression");
    assert.deepEqual(source.documents.lookupAuthored(occurrence), {
      kind: "available",
      node: calls[index],
    });
  }
});

test("source occurrence lookup fails closed for stale, foreign, or wrong-kind locators", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/project",
    files: { "/project/index.ts": "const value = 1;\n" },
    compilerOptions: { noLib: true, strict: true },
  }).checkSource();
  const source = createTargetSourceProgram(checked);
  const sourceFile = source.sourceFiles[0];
  const declaration = descendants(source, sourceFile).find((node) =>
    source.ast.is.IsVariableDeclaration(node)
  );
  assert.notEqual(declaration, undefined);
  const occurrence = source.documents.occurrenceFor(declaration);
  assert.equal(occurrence.kind, "authored");
  if (occurrence.kind !== "authored") {
    assert.fail("Expected authored declaration occurrence.");
  }

  assert.deepEqual(source.documents.lookupAuthored({
    ...occurrence,
    syntaxKind: "KindCallExpression",
  }), { kind: "missing" });
  assert.deepEqual(source.documents.lookupAuthored({
    ...occurrence,
    start: occurrence.start + 1,
  }), { kind: "missing" });
  assert.deepEqual(source.documents.lookupAuthored({
    ...occurrence,
    document: Object.freeze({
      ...occurrence.document,
      text: `${occurrence.document.text}\n`,
    }),
  }), { kind: "foreign-document" });
});

function descendants(source, root) {
  const nodes = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) {
      continue;
    }
    nodes.push(node);
    pending.push(...source.ast.children(node));
  }
  return nodes;
}
