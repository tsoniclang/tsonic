import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceBoundTypeRelationship } from "./bound-type-relationship.js";

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

test("bound literal correspondence preserves Boolean truth across source owners", () => {
  const declarations = `export type Yes = true; export type No = false;
    export type Broad = boolean; export type Text = "true"; export type Numeric = 1;
    export type Record = { value: boolean }; export type Mixed = true | string;
    export type Unbound<Value> = Value;`;
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/first.ts": declarations, "/src/second.ts": declarations },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const owners = ["/src/first.ts", "/src/second.ts"].map(name => {
    const file = checked.getSourceFile(name);
    assert.equal(file !== undefined, true);
    const semantics = source.semantics.forFile(file!);
    const aliases = new Map(source.ast.statements(file!).flatMap(declaration => {
      if (declaration === undefined || !source.ast.is.IsTypeAliasDeclaration(declaration)) return [];
      const node = source.ast.typeNode(declaration);
      assert.equal(node !== undefined, true);
      const type = semantics.types.authoredType(node!);
      assert.equal(type !== undefined, true);
      return [[source.ast.text(source.ast.name(declaration)), type!] as const];
    }));
    return { semantics, aliases };
  });
  for (const query of owners) {
    for (const authored of owners) {
      for (const selected of owners) {
        for (const name of ["Yes", "No"]) {
          const literal = authored.aliases.get(name)!;
          const parameter = authored.aliases.get("Unbound")!;
          const symbol = query.semantics.declarations.typeSymbol(parameter);
          assert.equal(symbol !== undefined, true);
          const declaration = query.semantics.declarations.primarySymbolDeclaration(symbol!);
          assert.equal(declaration !== undefined, true);
          const binding = (node: typeof declaration) => node === declaration ? literal : undefined;
          assert.equal(query.semantics.types.booleanLiteralValue(literal), name === "Yes");
          assert.equal(sourceBoundTypeRelationship(literal, selected.aliases.get(name)!, query.semantics, () => undefined), "identity");
          assert.equal(sourceBoundTypeRelationship(parameter, selected.aliases.get(name)!, query.semantics, binding), "bound");
          for (const other of [name === "Yes" ? "No" : "Yes", "Broad", "Text", "Numeric", "Record", "Mixed"]) {
            const candidate = selected.aliases.get(other)!;
            assert.equal(sourceBoundTypeRelationship(literal, candidate, query.semantics, () => undefined), undefined, `${name}/${other}`);
            assert.equal(sourceBoundTypeRelationship(candidate, literal, query.semantics, () => undefined), undefined, `${other}/${name}`);
            assert.equal(sourceBoundTypeRelationship(parameter, candidate, query.semantics, binding), undefined, `bound ${name}/${other}`);
          }
        }
      }
    }
  }
});
