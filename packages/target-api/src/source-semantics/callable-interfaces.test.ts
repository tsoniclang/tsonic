import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceCallableInterface } from "./callable-interfaces.js";

test("callable interface evidence accounts for complete inherited and merged shapes", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      interface Direct { (value: number): number; }
      interface Generic<Value> { (value: Value): Value; }
      interface Inherited extends Direct {}
      interface Repeated extends Direct, Generic<number> {}
      interface Merged { (value: number): number; }
      interface Merged {}
      interface Tagged extends Direct { tag: string; }
      interface Overloaded { (value: number): number; (value: string): string; }
      interface Indexed extends Direct { [key: string]: number; }
      interface Constructor extends Direct { new (): Direct; }
      interface Empty {}
      class Nominal {}
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const expected = [1, 1, 1, 2, 1, 1, 0, 2, 0, 0, 0, 0];
  source.ast.statements(file).forEach((declaration, index) => {
    assert.ok(declaration);
    const type = semantics.declarations.declaredType(declaration);
    const evidence = sourceCallableInterface(type, semantics, source.ast);
    assert.equal(evidence?.length ?? 0, expected[index], source.ast.text(source.ast.name(declaration)));
    if (evidence !== undefined) {
      assert.equal(Object.isFrozen(evidence), true);
      for (const signature of evidence) {
        assert.equal(Object.isFrozen(signature), true);
        assert.equal(signature.parameters.length, 1);
        assert.ok(signature.returnType);
      }
    }
  });
  assert.equal(sourceCallableInterface(undefined, semantics, source.ast), undefined);
});

test("callable evidence retains instantiated signature ownership through re-exports", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/types.ts": `export interface Callback<Value> { (value: Value): Value; }`,
    "/src/api.ts": `import type { Callback } from "./types.js"; export declare const callback: Callback<number>;`,
    "/src/bridge.ts": `export { callback as forwarded } from "./api.js";`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const source = createTargetSourceProgram(checked);
  const apiFile = checked.getSourceFile("/src/api.ts");
  const bridgeFile = checked.getSourceFile("/src/bridge.ts");
  assert.ok(apiFile && bridgeFile);
  const api = source.semantics.forFile(apiFile);
  const declarations: import("@tsonic/tsts").Node[] = [];
  const visit = (node: import("@tsonic/tsts").Node): void => {
    if (source.ast.is.IsVariableDeclaration(node)) declarations.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(apiFile);
  const declaration = declarations[0];
  assert.ok(declaration);
  const type = api.declarations.declaredValueType(declaration);
  assert.ok(type);
  const bridge = source.semantics.forFile(bridgeFile);
  const selected = bridge.types.callable(type);
  assert.ok(selected);
  assert.equal(selected.parameters.length, 1);
  assert.equal(bridge.types.isNumberLike(selected.parameters[0]!.type), true);
  assert.equal(bridge.types.isNumberLike(selected.result.selectedType), true);
});
