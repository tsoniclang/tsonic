import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("public literal base queries retain exact evidence across source owners", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/first.ts": 'export type Text = "first"; export type Wide = 9007199254740993n; export type Choice = "first" | 7;',
      "/src/second.ts": 'export type Text = "second"; export type Wide = 18446744073709551615n; export type Choice = "second" | 11;',
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const files = ["/src/first.ts", "/src/second.ts"].map(name => {
    const file = checked.getSourceFile(name);
    assert.ok(file);
    return file;
  });
  for (const queryFile of files) {
    const types = source.semantics.forFile(queryFile).types;
    for (const file of files) {
      for (const declaration of source.ast.statements(file)) {
        if (declaration === undefined || !source.ast.is.IsTypeAliasDeclaration(declaration)) continue;
        const node = source.ast.typeNode(declaration);
        assert.ok(node);
        const type = source.semantics.forFile(file).types.authoredType(node);
        assert.ok(type);
        const base = types.literalBaseType(type);
        assert.ok(base);
        const name = source.ast.text(source.ast.name(declaration));
        if (name === "Text") {
          assert.equal(types.isStringLike(base), true);
          assert.equal(types.stringLiteralValue(base), undefined);
          assert.equal(types.stringLiteralValue(type), file === files[0] ? "first" : "second");
        } else if (name === "Wide") {
          assert.equal(types.isBigIntLike(base), true);
          assert.equal(types.numericLiteralValue(base), undefined);
          assert.equal(types.numericLiteralValue(type), file === files[0] ? 9007199254740993n : 18446744073709551615n);
        } else {
          assert.equal(types.isUnion(base), true);
          assert.equal(types.unionOrIntersectionTypes(base).every(member =>
            types.stringLiteralValue(member) === undefined && types.numericLiteralValue(member) === undefined), true);
        }
      }
    }
  }
});
