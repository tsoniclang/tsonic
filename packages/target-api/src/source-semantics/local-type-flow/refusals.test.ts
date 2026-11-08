import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowRefusalCode } from "./types.js";

test("each Host refusal keeps one exact reason and original source association", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": "const value = 1;" },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const sourceFile = checked.getSourceFile("/src/index.ts");
  if (sourceFile === undefined) throw new Error("The original checked source file is required.");
  const site: Node = sourceFile;
  const codes: readonly SourceTypeFlowRefusalCode[] = ["TSONIC_LOCAL_TYPE_CONFLICT", "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS",
    "TSONIC_LOCAL_TYPE_SIGNATURE", "TSONIC_UNTYPED_OBJECT_LITERAL", "TSONIC_UNTYPED_ARRAY_LITERAL", "TSONIC_LOCAL_TYPE_ACCUMULATOR",
    "TSONIC_LOCAL_TYPE_UNION", "TSONIC_LOCAL_TYPE_SELF_REFERENCE", "TSONIC_LOCAL_TYPE_ADDRESS", "TSONIC_LOCAL_TYPE_LIMIT",
    "TSONIC_LOCAL_TYPE_GENERIC", "TSONIC_LOCAL_TYPE_UNSUPPORTED"];
  for (const code of codes) {
    const first = createSourceTypeFlowRefusal(code, site, site); const second = createSourceTypeFlowRefusal(code, site);
    assert.equal(first.source, "tsonic"); assert.equal(first.kind, "refused"); assert.equal(first.code, code);
    assert.equal(first.site === site && first.related === site, true);
    assert.equal(first.message, second.message);
    assert.equal(first.message.includes("nnotate") || first.message.includes("Declare one"), true);
    assert.equal(Object.isFrozen(first), true);
  }
});
