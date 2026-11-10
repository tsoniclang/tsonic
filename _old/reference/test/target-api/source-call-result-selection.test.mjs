import assert from "node:assert/strict";
import { test } from "node:test";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

test("source-call results separate selected invocation storage from optional completion", () => {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({
    project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src",
    files: { "/src/index.ts": `
      interface Source {
        read(value: string): string;
        read(value: number): number;
        nullable(): number | null | undefined;
        map<Value>(value: Value): Value;
      }
      declare const source: Source | undefined;
      source?.read(1); source?.nullable(); source?.map<number>(1);
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0);
  const source = checked.value;
  const { ast, facts } = source;
  const file = source.sourceFiles.find(file => ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const pending = [file];
  const results = [];
  while (pending.length !== 0) {
    const node = pending.pop();
    if (ast.is.IsCallExpression(node)) {
      const selected = facts.applications.application(node);
      assert.equal(selected.kind, "resolved", "the original optional call has its canonical Source application");
      const application = selected.value;
      assert.equal(application.identity.invocation === node && application.optionalCall &&
        application.argumentDisposition === "dynamic", true);
      assert.equal(facts.applications.application(node).value === application && Object.isFrozen(application), true,
        "repeated queries retain the same immutable selected application");
      const returned = facts.values.callableReturn(application.identity.signature);
      assert.equal(returned.kind, "resolved", "the selected original signature retains its own completion");
      const applied = facts.descriptors.substitute(returned.value,
        [...application.identity.classBindings, ...application.identity.signatureBindings]);
      assert.equal(applied.kind, "resolved", "the selected result is applied under its exact original binder vectors");
      const definition = facts.descriptors.definition(applied.value);
      assert.equal(definition.kind, "resolved");
      const invocation = facts.values.type(node);
      assert.equal(invocation.kind === "resolved" && invocation.value === application.result, true,
        "the invocation and application publish the same optional completion evidence");
      assert.equal(application.result.type.kind === "optional" && application.result.type.value.kind === "primitive" &&
        application.result.type.value.primitive === "float64", true,
      "an optional invocation has one absence state, including an already-nullable result");
      results.push(definition.value.type.kind === "optional" ? "optional-float64" : definition.value.type.kind === "primitive"
        && definition.value.type.primitive === "float64" ? "float64" : definition.value.type.kind);
      if (ast.text(ast.name(application.identity.signature.declaration)) === "map") {
        assert.equal(application.identity.signatureBindings.length === 1 &&
          application.identity.signatureBindings[0].value.type.kind === "primitive" &&
          application.identity.signatureBindings[0].value.type.primitive === "float64", true,
        "the explicit generic argument is not replaced by optional-call completion");
      }
    }
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) pending.push(children[index]);
  }
  assert.deepEqual(results, ["float64", "optional-float64", "float64"],
    "selected overload, already-nullable result and applied generic result remain independent of invocation absence");
});
