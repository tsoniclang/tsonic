import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, sourcePrimitive, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../target-source-program.js";
import { sourceTypeDescriptorStructure } from "./terms.js";

test("instantiated calls retain ambient parameter descriptors with the same solved native binders", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/node_modules/@test/words/package.json": JSON.stringify({
        name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" },
      }),
      "/src/node_modules/@test/words/index.d.ts": "export type Word = bigint;",
      "/src/profile.d.ts": [
        'import type { Word } from "@test/words";',
        "export interface Values<T> { order<R extends number | bigint = number>(compare?: (left: T, right: T) => R): Values<T>; }",
        "export declare const values: Values<Word>;",
      ].join("\n"),
      "/src/index.ts": [
        'import { values } from "./profile.js";',
        "export function run(): void { values.order((left, right) => left - right); values.order(); values.order(undefined); }",
      ].join("\n"),
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/words", packageName: "@test/words",
      exports: [sourcePrimitive("Word", "int64", "bigint", true, 64)],
    }] })] },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The original project file is required.");
  const pending: Node[] = [file];
  const calls: Node[] = [];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsCallExpression(node)) calls.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  assert.equal(calls.length, 3);
  for (const call of calls) {
    const selected = source.semantics.forNode(call).operations.call(call);
    const published = source.effectiveTypes.callInstantiation(call);
    assert.equal(selected !== undefined && published?.call === selected, true);
    if (selected === undefined || published === undefined) throw new Error("The identical selected call is required.");
    assert.equal(published.parameters.length, selected.sourceSelectedSignatureParameters.length);
    const parameter = published.parameters[0];
    assert.equal(parameter?.kind === "optional", true);
    const callable = parameter === undefined ? undefined : sourceTypeDescriptorStructure(parameter.kind === "optional" ? parameter.value : parameter);
    assert.equal(callable?.kind === "callable" && callable.calls.length === 1, true);
    if (callable?.kind !== "callable") throw new Error("The published callback descriptor is required.");
    const signature = callable.calls[0]!;
    assert.equal(signature.parameters.every(parameter => parameter.type.kind === "primitive" && parameter.type.primitive === "int64"), true);
    const supplied = selected.sourceArguments.some(argument => source.ast.is.IsArrowFunction(argument.expression));
    assert.equal(signature.result.kind === "primitive" && signature.result.primitive === (supplied ? "int64" : "float64"), true);
    assert.equal(signature.result === published.method[0]?.type, true, "the callback result is the same solved method binder");
  }
});
