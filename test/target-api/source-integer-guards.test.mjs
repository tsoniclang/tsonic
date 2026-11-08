import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(body) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    files: {
      "/src/index.ts": `import { out, ref, inref, borrow, borrowMut, addressOf } from "@integer-test/native/lang.js";
        function consume(value: number): void {} function probe(value: number, flag: boolean): number { ${body} }`,
      "/src/node_modules/@integer-test/native/package.json": JSON.stringify({ name: "@integer-test/native", version: "1.0.0", type: "module",
        exports: { "./lang.js": "./lang.d.ts", "./types.js": "./types.d.ts" } }),
      "/src/node_modules/@integer-test/native/types.d.ts": "export type ptr<T> = T;",
      "/src/node_modules/@integer-test/native/lang.d.ts": `import type { ptr } from './types.js'; export declare function out<T>(value: T): T;
        export declare function ref<T>(value: T): T; export declare function inref<T>(value: T): T;
        export declare function borrow<T>(value: T): T; export declare function borrowMut<T>(value: T): T;
        export declare function addressOf<T>(value: T): ptr<T>;`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    targetContributions: base => ({ ...base, semanticsModules: [...base.semanticsModules ?? [], {
      moduleSpecifier: "@integer-test/native/types.js", packageName: "@integer-test/native", subpath: "types.js",
      exports: [{ kind: "type-marker", exportName: "ptr", marker: "pointer" }],
    }, {
      moduleSpecifier: "@integer-test/native/lang.js", packageName: "@integer-test/native", subpath: "lang.js", exports: [
        ["out", "write-only-reference"], ["ref", "read-write-reference"], ["inref", "read-only-reference"],
        ["borrow", "shared-borrow"], ["borrowMut", "mutable-borrow"], ["addressOf", "address-of"],
      ].map(([exportName, marker]) => ({ kind: "call-marker", exportName, marker })),
    }] }),
  });
  assert.equal(checked.kind === "resolved", true, checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "the original complete program preserves every checker and Source diagnostic");
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const nodes = source.facts.navigation.nodesForFiles([file]);
  const occurrences = nodes.filter(node => source.ast.is.IsReturnStatement(node)).map(node => source.ast.as.AsReturnStatement(node).Expression)
    .filter(node => node !== undefined && source.ast.is.IsIdentifier(node) && source.ast.text(node) === "value");
  return { source, nodes, occurrences, proved() {
    return occurrences.map(node => {
      const result = source.facts.integers.nonnegative(node);
      assert.equal(result.kind === "resolved", true, "the original guard has an exact completed Source outcome");
      return result.value;
    });
  } };
}

test("integer guards are occurrence-specific, exact and dominate the continuing branch", () => {
  const positive = [
    "if (value < 0) return -1; return value;",
    "if (0 > value) throw new Error(); return value;",
    "if (value <= -1) return -1; return value;",
    "if (value >= 0) { return value; } return -1;",
    "if (!(value < 0)) return value; return -1;",
    "if (value < 0 || flag) return -1; return value;",
    "if (flag && value >= 0) return value; return -1;",
    "if (value !== 0) return -1; return value;",
    "if (value > 9007199254740993) return value; return -1;",
    "if (value < 0) { if (flag) return -1; else throw new Error(); } return value;",
    "if (value < 0) return -1; { consume(value); return value; }",
  ];
  for (const body of positive) assert.deepEqual(fixture(body).proved(), [true], body);
  assert.deepEqual(fixture("if (value >= 0) return value; else return value;").proved(), [true, false]);
});

test("guard proofs reject unrelated bindings, writes, captures and uncertain control flow", () => {
  const negative = [
    "return value;",
    "if (value < -1) return -1; return value;",
    "if (value <= 0) return value; return -1;",
    "if (value >= 0 || flag) return value; return -1;",
    "if (value < 0 && flag) return -1; return value;",
    "if (value < 0) { if (flag) return -1; } return value;",
    "if (value < 0) consume(value); return value;",
    "if (value < 0) return -1; value = -3; return value;",
    "if (value < 0) return -1; const change = () => { value = -3; }; change(); return value;",
    "if (value < 0) return -1; { const value = -3; return value; }",
    "if (value >= 0) { const read = () => value; consume(read()); } return value;",
    "if ((value as number) < 0) return -1; return value;",
    "if ((<number>value) >= 0) return value; return -1;",
  ];
  for (const body of negative) assert.deepEqual(fixture(body).proved(), [false], body);
});

test("mutable passing and address exposure invalidate source guards", () => {
  for (const [marker, mode, expected] of [
    [undefined, "by-value", true], ["inref", "byref-readonly", true], ["borrow", "borrow-shared", true],
    ["borrowMut", "borrow-mut", false], ["ref", "byref-readwrite", false], ["out", "byref-writeonly-must-init", false],
  ]) {
    const argument = marker === undefined ? "value" : `${marker}(value)`;
    const current = fixture(`if (value < 0) return -1; consume(${argument}); return value;`);
    if (marker !== undefined) {
      const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
        current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === marker);
      assert.equal(call !== undefined, true, `${mode}: original configured marker call`);
      const passing = current.source.facts.protocols.argumentPassing(call);
      assert.equal(passing.kind === "resolved" && passing.value.kind === "present" && passing.value.value.mode === mode, true,
        `${mode}: actual canonical passing premise, not an optional fact mock`);
    }
    assert.deepEqual(current.proved(), [expected], mode);
  }
  const addressed = fixture("if (value < 0) return -1; addressOf(value); return value;");
  const call = addressed.nodes.find(node => addressed.source.ast.is.IsCallExpression(node) &&
    addressed.source.ast.text(addressed.source.ast.as.AsCallExpression(node).Expression) === "addressOf");
  const pointer = addressed.source.facts.protocols.pointerOperation(call);
  assert.equal(pointer.kind === "resolved" && pointer.value.kind === "present" && pointer.value.value.operation === "address-of", true);
  assert.deepEqual(addressed.proved(), [false]);
});

test("finite proof accounting fails closed", () => {
  assert.deepEqual(fixture(`if (value < 0) return -1; ${"consume(value);".repeat(1_000)} return value;`).proved(), [false]);
});
