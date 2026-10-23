import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceCallableValueParameters } from "./callable-parameters.js";

test("only the checker's actual this parameter is erased from the value parameter vector", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export function read(this: void, thisValue: number, value = 1, ...rest: number[]): number { return thisValue + value + rest.length; }",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the source has a checked callable contract");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts")!;
  const owner = source.ast.statements(file).find(node => node !== undefined && source.ast.is.IsFunctionDeclaration(node))!;
  const selected = sourceCallableValueParameters(source.ast, owner, source.semantics.forNode(owner));
  assert.equal(selected !== undefined, true, "the complete checked parameter vector is available");
  assert.deepEqual(selected!.map(parameter => source.ast.text(source.ast.name(parameter))), ["thisValue", "value", "rest"]);
  assert.equal(Object.isFrozen(selected), true, "the source parameter evidence is immutable");
  assert.equal(sourceCallableValueParameters(source.ast, file, source.semantics.forFile(file)), undefined,
    "a noncallable subject never fabricates a runtime parameter vector");
});
