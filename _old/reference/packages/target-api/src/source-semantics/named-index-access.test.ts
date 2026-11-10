import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("named index evidence crosses files without reconstructing a selected property", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/model.ts": `
        export type Dictionary<Value> = { [Key in string]: Value };
        export interface Immutable { readonly [key: string]: number; }
      `,
      "/src/index.ts": `
        import type { Dictionary, Immutable } from "./model.js";
        declare const values: Dictionary<number>;
        values.answer = 1;
        values.answer++;
        const answer = values.answer;
        declare const immutable: Immutable;
        const stored = immutable.answer;
        declare const ordinary: { answer: number };
        const field = ordinary.answer;
      `,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const accesses: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsPropertyAccessExpression(node)) accesses.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const semantics = source.semantics.forFile(file);
  const selected = accesses.map(node => semantics.operations.propertyAccess(node));
  assert.equal(selected.length, 5);
  assert.deepEqual(selected.slice(0, 3).map(value => value?.accessMode), ["write", "read-write", "read"]);
  for (const value of selected.slice(0, 4)) {
    assert.ok(value?.selectedIndex?.keyType && value.selectedIndex.valueType);
    assert.equal(semantics.types.isStringLike(value.selectedIndex.keyType), true);
    assert.equal(semantics.types.isNumberLike(value.selectedIndex.valueType), true);
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.selectedIndex) && Object.isFrozen(value.selectedIndex.components));
  }
  assert.equal(selected[0]?.writable, true);
  assert.equal(selected[3]?.writable, false);
  assert.equal(selected[3]?.selectedIndex?.readonly, true);
  assert.equal(selected[4]?.selectedIndex, undefined);
  assert.equal(semantics.operations.propertyAccess(accesses[0]!), selected[0]);
  assert.equal(source.semantics.forNode(accesses[0]!).operations.propertyAccess(accesses[0]!), selected[0]);
});
