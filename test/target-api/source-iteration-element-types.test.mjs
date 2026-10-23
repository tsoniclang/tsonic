import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";

test("final source queries expose the checked iteration protocol for every iterable shape", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare const array: readonly number[];
    declare const set: Set<string>;
    declare const map: Map<string, number>;
    function* values() { yield true; }
    const generator = values();
    declare const custom: Iterable<bigint>;
    declare const opaque: any;
    declare const opaqueElement: Iterable<any>;
    declare const nonIterable: { readonly value: number };
    export {};
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const context = source.semantics.forFile(file);
  const expected = new Map([["array", "number"], ["set", "string"], ["map", "[string, number]"],
    ["generator", "boolean"], ["custom", "bigint"]]);
  let count = 0;
  const visit = node => {
    if (source.ast.is.IsVariableDeclaration(node)) {
      count += 1;
      const name = source.ast.text(source.ast.name(node));
      const sourceType = context.types.expressionType(node);
      const selected = sourceType === undefined ? undefined : context.types.iterationElementType(sourceType);
      assert.equal(context.types.expressionIterationElementType(node) === selected, true,
        `${name}: expression queries only forward their checked type to the canonical operation`);
      const expectedType = expected.get(name);
      assert.equal(selected === undefined ? undefined : checked.getSourceFileQueries(file).checker.typeToString(selected), expectedType,
        `${name}: final queries retain the checker answer, not the first type argument`);
    }
    source.ast.forEachChild(node, visit);
  };
  visit(file);
  assert.equal(count, 8, "all five checked iterable shapes and three unresolved shapes are present");
});
