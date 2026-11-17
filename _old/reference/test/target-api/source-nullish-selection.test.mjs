import assert from "node:assert/strict";
import test from "node:test";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

test("neutral present-type selection retains generic union bindings across source owners", () => {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({
    project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src",
    files: {
      "/src/contracts.ts": `export type Choice<T> = { value: T } | { read: () => T };`,
      "/src/index.ts": `import type { Choice } from "./contracts.js";
      export declare function accept(plain: Choice<bigint>, missing: Choice<bigint> | undefined,
        nullable: Choice<bigint> | null, mixed: Choice<bigint> | null | undefined): void;`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0);
  const source = checked.value;
  const { ast, facts } = source;
  const file = source.sourceFiles.find(file => ast.getFileName(file) === "/src/index.ts");
  const contracts = source.sourceFiles.find(file => ast.getFileName(file) === "/src/contracts.ts");
  assert.equal(file !== undefined && contracts !== undefined, true);
  const declaration = ast.statements(file).find(node => node !== undefined && ast.is.IsFunctionDeclaration(node));
  const alias = ast.statements(contracts).find(node => node !== undefined && ast.is.IsTypeAliasDeclaration(node));
  assert.equal(declaration !== undefined && alias !== undefined, true);
  const parameters = ast.parameters(declaration);
  assert.equal(parameters.length, 4);
  const values = parameters.map(parameter => {
    assert.equal(parameter !== undefined, true);
    const slot = facts.values.declaredSlot(parameter);
    assert.equal(slot.kind, "resolved");
    return slot.value.type;
  });
  const expected = values[0];
  assert.equal(expected.type.kind === "declared" && expected.type.declaration === alias && expected.type.typeArguments.length === 1, true);
  const argument = facts.descriptors.component(expected, { kind: "type-argument", declaration: alias, index: 0 });
  assert.equal(argument.kind === "resolved" && argument.value.type.kind === "intrinsic" && argument.value.type.intrinsic === "bigint", true);
  for (const owner of [file, contracts]) {
    const inventory = facts.navigation.nodesForFiles([owner]);
    assert.equal(inventory.length > 0 && inventory.every(node => ast.getSourceFile(node) === owner), true,
      "each original source owner remains authentic in the one program view");
    for (const [index, value] of values.entries()) {
      let present = value;
      if (index !== 0) {
        assert.equal(value.type.kind, "optional", "null and undefined use the same one-absence present projection");
        const selected = facts.descriptors.component(value, { kind: "optional-value" });
        assert.equal(selected.kind, "resolved");
        present = selected.value;
      }
      assert.equal(present.type === expected.type && present.type.kind === "declared" && present.type.declaration === alias, true,
        "present selection retains the exact original alias and complete generic application");
      const selectedArgument = facts.descriptors.component(present, { kind: "type-argument", declaration: alias, index: 0 });
      assert.equal(selectedArgument.kind === "resolved" && selectedArgument.value.type === argument.value.type, true,
        "no source owner erases or reconstructs the original bigint binder");
      assert.equal(present.sum === undefined || present.sum.arms.every(arm => arm.type.kind !== "intrinsic" ||
        arm.type.intrinsic !== "absence" && arm.type.intrinsic !== "void"), true,
      "the selected present domain contains no nullish arm");
    }
  }
});
