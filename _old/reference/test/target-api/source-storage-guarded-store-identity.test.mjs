import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture(called, sharedCreation) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    export {};
    class Box { constructor(public items: { token: object }) {} }
    declare function consume(value: { token: object }): void;
    ${sharedCreation ? "function make(items: { token: object }): Box { return new Box(items); }" : ""}
    const initial = {}; const replacement = {}; const privateToken = {};
    const backing = { token: initial }; const privateBacking = { token: privateToken };
    const original = ${sharedCreation ? "make" : "new Box"}(backing);
    const isolated = ${sharedCreation ? "make" : "new Box"}(privateBacking);
    const alias = original;
    export function publish(value: Box): void {
      if (value instanceof Box) {
        value.items = { token: replacement };
        consume(value.items);
      }
    }
    ${called ? "publish(alias);" : ""}
    const selected = original.items.token;
    const privateRead = isolated.items.token;
    const container = original;
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const origins = name => {
    const subject = storage.subjectFor(variable(name));
    assert.equal(subject.kind, "resolved", `${name}: the exact original binding is admitted`);
    return storage.closedOriginsFor(subject.subject);
  };
  const exposure = requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node) &&
    source.ast.is.IsIdentifier(source.ast.as.AsCallExpression(node).Expression) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === "consume");
  return { source, file, storage, variable, initializer, origins, exposure };
}

for (const called of [false, true]) for (const sharedCreation of [false, true]) for (const reverse of [false, true]) {
  test(`guarded member stores preserve exact concrete receiver identity (${called}; ${sharedCreation}; ${reverse})`, () => {
    const current = fixture(called, sharedCreation);
    const selected = () => {
      const result = current.origins("selected");
      assert.equal(result.kind, called ? "open" : "complete",
        `only an actual alias call publishes this concrete member: ${result.reason ?? result.kind}`);
      assert.equal(result.origins.some(origin => origin.subject.node === current.initializer(called ? "replacement" : "initial") &&
        origin.subject.projection.length === 0), true, "the exact matching store or original payload is retained");
      assert.equal(result.origins.some(origin => origin.subject.node === current.initializer("privateToken")), false,
        "another receiver's payload is never a producer");
      if (called) assert.equal(result.boundaries.some(boundary => boundary.kind === "opaque-write" &&
        boundary.exposure === current.exposure), true, "the actual opaque writer is retained");
      else assert.equal(result.origins.some(origin => origin.subject.node === current.initializer("replacement")), false,
        "an unrelated exported entry does not manufacture a physical store");
    };
    const privateRead = () => {
      const result = current.origins("privateRead");
      assert.equal(result.kind, "complete", `the other allocation remains private: ${result.reason ?? result.kind}`);
      assert.equal(result.origins.length === 1 && result.origins[0].subject.node === current.initializer("privateToken") &&
        result.origins[0].subject.projection.length === 0, true, "only the other creation's own original payload remains");
    };
    for (const inspect of reverse ? [privateRead, selected] : [selected, privateRead]) inspect();
    const container = current.origins("container");
    const allocation = sharedCreation ? requiredNode(current.source.ast, current.file, current.source.ast.is.IsNewExpression)
      : current.initializer("original");
    assert.equal(container.kind === "complete" && container.origins.length === 1 &&
      container.origins[0].subject.node === allocation && container.origins[0].subject.projection.length === 0, true,
    "a member store never becomes a receiver-binding replacement");
    assert.equal(current.storage.failureReason(), undefined, "exact store identity uses the unchanged finite proof limits");
  });
}
