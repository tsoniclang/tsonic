import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

test("class expressions retain exact effective constructors without requiring an authored name", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      class Base {
        readonly value: number;
        constructor(value: number, optional?: string) { this.value = value; }
      }
      const named = class Named extends Base {};
      const anonymous = class extends Base {};
      const explicit = class { constructor(readonly value: string) {} };
      const empty = class {};
      const notClass = () => 1;
      new named(1); new anonymous(2); new explicit("value"); new empty();
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const expressions: Node[] = [];
  let arrow: Node | undefined;
  const visit = (node: Node): void => {
    if (source.ast.is.IsClassExpression(node)) expressions.push(node);
    if (source.ast.is.IsArrowFunction(node)) arrow = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(expressions.length, 4);
  const base = source.ast.statements(file)[0];
  assert.ok(base);
  const baseConstructor = source.ast.members(base).find(member => member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  assert.ok(baseConstructor);
  for (const [index, expression] of expressions.entries()) {
    const semantics = source.semantics.forNode(expression);
    const instance = semantics.declarations.declaredType(expression);
    const value = semantics.declarations.declaredValueType(expression);
    assert.ok(instance);
    assert.ok(value);
    assert.notEqual(instance, value);
    assert.equal(semantics.types.constructSignatures(instance).length, 0);
    assert.equal(semantics.types.constructSignatures(value).length, 1);
    const symbol = semantics.declarations.typeSymbol(instance);
    assert.ok(symbol);
    assert.deepEqual(semantics.declarations.symbolDeclarations(symbol), [expression]);
    const result = source.navigation.classConstructors(expression);
    assert.equal(result.kind, "resolved");
    if (result.kind !== "resolved") continue;
    assert.equal(result.declaration, expression);
    assert.equal(result.implicit, index !== 2);
    assert.equal(result.signatures.length, 1);
    const signature = result.signatures[0]!;
    assert.equal(signature.parameters.length, index < 2 ? 2 : index === 2 ? 1 : 0);
    if (index < 2) {
      assert.equal(signature.parameters[0]!.parameterDeclaration, source.ast.parameters(baseConstructor)[0]);
      assert.equal(signature.parameters[1]!.acceptsOmission, true);
    }
    assert.equal(source.navigation.classConstructors(expression), result);
  }
  assert.ok(arrow);
  assert.equal(source.navigation.classConstructors(arrow).kind, "unresolved");
});
