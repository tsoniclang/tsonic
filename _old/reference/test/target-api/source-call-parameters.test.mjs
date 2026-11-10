import assert from "node:assert/strict";
import test from "node:test";
import { sourcePrimitive } from "@tsonic/tsts";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

test("instantiated calls retain ambient parameter descriptors with the same solved native binders", () => {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
    targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" };
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src",
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
    targetContributions: base => ({ ...base, semanticsModules: [...base.semanticsModules ?? [], {
      moduleSpecifier: "@test/words", packageName: "@test/words",
      exports: [sourcePrimitive("Word", "int64", "bigint", true, 64)],
    }] }),
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n"));
  assert.equal(checked.diagnostics.length, 0, "the original complete program has no checker, extension, or composition diagnostic");
  const source = checked.value;
  const file = source.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the original project file is required");
  const pending = [file];
  const calls = [];
  while (pending.length !== 0) {
    const node = pending.pop();
    if (source.ast.is.IsCallExpression(node)) calls.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  assert.equal(calls.length, 3);
  for (const call of calls) {
    const published = source.facts.applications.application(call);
    assert.equal(published.kind, "resolved", "the identical original call has its solved Source application");
    const application = published.value;
    assert.equal(application.identity.invocation === call, true);
    assert.equal(application.identity.classBindings.length, 1, "the original class binder is separate");
    assert.equal(application.identity.signatureBindings.length, 1, "the original method binder is separate");
    const member = source.facts.objects.use(application.callee.occurrence);
    assert.equal(member.kind, "resolved");
    assert.equal(member.value.readType !== undefined, true, "the original callee retains its complete ambient formal vector");
    const applied = source.facts.descriptors.substitute(member.value.readType,
      [...application.identity.classBindings, ...application.identity.signatureBindings]);
    assert.equal(applied.kind, "resolved");
    const head = source.facts.descriptors.definition(applied.value);
    assert.equal(head.kind, "resolved");
    assert.equal(head.value.type.kind === "callable" || head.value.type.kind === "shape", true);
    assert.equal(head.value.type.calls.length, 1);
    const signature = head.value.type.calls[0];
    assert.equal(signature.identity === application.identity.signature, true, "the callable retains the actual original selected signature");
    assert.equal(signature.parameters.length, 1, "omitted arguments never erase the ambient optional formal");
    assert.equal(signature.parameters[0].kind, "optional");
    const parameter = source.facts.descriptors.component(head.value, { kind: "parameter", signature: signature.identity, index: 0 });
    assert.equal(parameter.kind, "resolved");
    assert.equal(parameter.value.type.kind, "optional");
    const payload = source.facts.descriptors.component(parameter.value, { kind: "optional-value" });
    assert.equal(payload.kind, "resolved");
    const callback = source.facts.descriptors.definition(payload.value);
    assert.equal(callback.kind, "resolved");
    assert.equal(callback.value.type.kind === "callable" || callback.value.type.kind === "shape", true);
    assert.equal(callback.value.type.calls.length, 1);
    const callbackSignature = callback.value.type.calls[0];
    assert.equal(callbackSignature.parameters.every(parameter => parameter.type.kind === "primitive" && parameter.type.primitive === "int64"), true);
    const supplied = source.ast.arguments(call).some(argument => argument !== undefined && source.ast.is.IsArrowFunction(argument));
    assert.equal(callbackSignature.result.kind === "primitive" && callbackSignature.result.primitive === (supplied ? "int64" : "float64"), true);
    const result = source.facts.descriptors.component(callback.value, { kind: "result", signature: callbackSignature.identity });
    assert.equal(result.kind, "resolved");
    assert.equal(result.value.type === application.identity.signatureBindings[0].value.type, true,
      "the callback result is the same solved method binder, including its genuine default");
    assert.equal(application.arguments.length, source.ast.arguments(call).length,
      "complete effective places describe only actual supplied arguments, not omitted formals");
  }
});
