import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("public source semantics distinguish native broad object from empty structural types", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/first.ts": "export type Token = object; export type Empty = {}; export type Numeric = bigint;",
      "/src/second.ts": `import type { Token } from "./first.js";
        export type Alias = Token; export type Mixed = Token | null;
        export type Empty = {}; export type Record = { value: bigint };
        export type Parameter<Value extends object> = Value;`,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const owners = ["/src/first.ts", "/src/second.ts"].map(name => {
    const file = checked.getSourceFile(name);
    assert.equal(file !== undefined, true, name);
    return { file: file!, types: source.semantics.forFile(file!).types };
  });
  for (const query of owners) {
    for (const owner of owners) {
      for (const declaration of source.ast.statements(owner.file)) {
        if (declaration === undefined || !source.ast.is.IsTypeAliasDeclaration(declaration)) continue;
        const node = source.ast.typeNode(declaration);
        assert.equal(node !== undefined, true);
        const type = owner.types.authoredType(node!);
        assert.equal(type !== undefined, true);
        const name = source.ast.text(source.ast.name(declaration));
        assert.equal(query.types.isNonPrimitive(type!), name === "Token" || name === "Alias", name);
      }
    }
  }
});
