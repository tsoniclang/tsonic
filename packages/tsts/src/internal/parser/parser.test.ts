// Mirror of internal/parser/parser_test.go (TestJSDocImportTypeParentChain).
// BenchmarkParse is a Go benchmark and FuzzParser is a Go fuzz target; neither
// has a mirror.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import { Node_End, Node_Pos } from "../ast/spine.js";
import { SourceFile_Imports } from "../ast/ast.js";
import { GetReparsedNodeForNode, GetSourceFileOfNode } from "../ast/utilities.js";
import { ScriptKindJS } from "../core/scriptkind.js";
import { ParseSourceFile } from "./parser/statements-declarations.js";

test("JSDocImportTypeParentChain", () => {
  const sourceText = `test("", async function () {
  ;(/** @type {typeof import("a")} */ ({}))
})

test("", async function () {
  ;(/** @type {typeof import("a")} */ a)
})

test("", async function () {
  (/** @type {typeof import("a")} */ ({}))
  ;(/** @type {typeof import("a")} */ ({}))
})

test("", async function () {
  (/** @type {typeof import("a")} */ a)
  ;(/** @type {typeof import("a")} */ a)
})

test("", async function () {
  (/** @type {typeof import("a")} */ ({}))
  ;(/** @type {typeof import("a")} */ ({}))
})
`;
  const file = ParseSourceFile({ FileName: "/index.js", Path: "/index.js" } satisfies SourceFileParseOptions, sourceText, ScriptKindJS);

  const reparsedClones = file!.ReparsedClones ?? [];
  for (let i = 1; i < reparsedClones.length; i++) {
    const a = reparsedClones[i - 1]!;
    const b = reparsedClones[i]!;
    assert.ok(
      !(Node_Pos(a) === Node_Pos(b) && Node_End(a) === Node_End(b) && a.Kind === b.Kind),
      `duplicate ReparsedClones at [${i - 1}] and [${i}]: kind=${a.Kind} pos=${Node_Pos(a)} end=${Node_End(a)}`,
    );
  }
  for (const imp of SourceFile_Imports(file) ?? []) {
    const reparsed = GetReparsedNodeForNode(imp);
    assert.ok(
      GetSourceFileOfNode(reparsed) !== undefined,
      `reparsed import at pos=${Node_Pos(imp)} has broken parent chain`,
    );
  }
});
