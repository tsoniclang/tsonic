import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("neutral present-type selection retains generic union bindings across source owners", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/contracts.ts": `export type Choice<T> = { value: T } | { read: () => T };`,
    "/src/index.ts": `import type { Choice } from "./contracts.js";
      export declare function accept(plain: Choice<bigint>, missing: Choice<bigint> | undefined,
        nullable: Choice<bigint> | null, mixed: Choice<bigint> | null | undefined): void;`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declaration = source.ast.statements(file).find(node => node !== undefined && source.ast.is.IsFunctionDeclaration(node));
  assert.ok(declaration);
  const parameters = source.ast.parameters(declaration);
  const types = parameters.map(parameter => {
    const node = source.ast.typeNode(parameter);
    assert.ok(node);
    const type = source.semantics.forFile(file).types.authoredType(node);
    assert.ok(type);
    return type;
  });
  for (const name of ["/src/index.ts", "/src/contracts.ts"]) {
    const owner = checked.getSourceFile(name);
    assert.ok(owner);
    const queries = source.semantics.forFile(owner).types;
    const expected = queries.aliasApplication(types[0]!);
    assert.ok(expected);
    for (const type of types) {
      const selected = queries.nonNullableType(type);
      assert.ok(selected);
      assert.equal(queries.isIdentical(selected, types[0]!), true);
      const actual = queries.aliasApplication(selected);
      assert.equal(actual?.declaration === expected.declaration, true);
      assert.equal(actual?.bindings[0]?.argument === expected.bindings[0]?.argument, true);
      assert.equal(queries.unionOrIntersectionTypes(selected).some(member => queries.isNullish(member)), false);
    }
  }
});
