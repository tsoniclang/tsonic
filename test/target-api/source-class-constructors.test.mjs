import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";

function resolved(result) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? result.message : "the original query resolves");
  return result.value;
}

test("class expressions retain exact effective constructors without requiring an authored name", () => {
  const { source, file } = sourceTypeFlowFixture("", { imports: "", files: { "/src/index.ts": `
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
    ` } });
  const expressions = [];
  let arrow;
  const visit = (node) => {
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
    const instance = resolved(source.facts.values.declaredSlot(expression)).type;
    const value = resolved(source.facts.values.type(expression));
    assert.equal(instance !== value, true, "the class instance template is not its constructor value");
    assert.equal(instance.type.kind === "declared" && instance.type.declaration === expression, true,
      "the template belongs to the identical original anonymous or named class");
    const instanceDefinition = resolved(source.facts.descriptors.definition(instance));
    const valueDefinition = resolved(source.facts.descriptors.definition(value));
    assert.equal(instanceDefinition.type.kind === "shape" && instanceDefinition.type.constructs.length === 0, true);
    assert.equal((valueDefinition.type.kind === "callable" || valueDefinition.type.kind === "shape") &&
      valueDefinition.type.constructs.length === 1, true);
    const result = resolved(source.facts.navigation.classConstructors(expression));
    assert.equal(result.kind, "resolved");
    if (result.kind !== "resolved") continue;
    assert.ok(result.declaration === expression);
    assert.equal(result.witness, index === 2 ? "declared" : "implicit");
    assert.equal(result.signatures.length, 1);
    const signature = result.signatures[0];
    assert.equal(signature.parameters.length, index < 2 ? 2 : index === 2 ? 1 : 0);
    if (index < 2) {
      assert.ok(signature.parameters[0].parameterDeclaration === source.ast.parameters(baseConstructor)[0]);
      assert.equal(signature.parameters[1].acceptsOmission, true);
    }
    assert.ok(resolved(source.facts.navigation.classConstructors(expression)) === result);
  }
  assert.ok(arrow);
  assert.equal(resolved(source.facts.navigation.classConstructors(arrow)).kind, "unresolved");
});

test("aliased cross-file class bases retain generic, default and rest constructor contracts", () => {
  const { source, file } = sourceTypeFlowFixture("", { imports: "", files: {
      "/src/base.ts": `
        export class Base<T> {
          readonly value: T;
          constructor(value: T, label: string = "base", ...counts: number[]) { this.value = value; }
        }
      `,
      "/src/index.ts": `
        import { Base as Parent } from "./base.js";
        export const Item = class extends Parent<string> {};
        const Alias = Item;
        new Alias("value");
        new Item("value", "selected", 1, 2);
      `,
    } });
  const baseFile = source.documents.all.find(document => document.fileName === "/src/base.ts")?.sourceFile;
  assert.ok(baseFile && file);
  let expression;
  const visit = (node) => {
    if (source.ast.is.IsClassExpression(node)) expression = node;
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(expression);
  const base = source.ast.statements(baseFile)[0];
  assert.ok(base);
  const constructor = source.ast.members(base).find(member => member !== undefined && source.ast.is.IsConstructorDeclaration(member));
  assert.ok(constructor);
  const selected = resolved(source.facts.navigation.classConstructors(expression));
  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") throw new Error("Missing public class constructor contract");
  assert.equal(selected.witness, "implicit");
  assert.equal(selected.signatures.length, 1);
  const parameters = selected.signatures[0].parameters;
  const expected = source.ast.parameters(constructor);
  assert.deepEqual(parameters.map(parameter => expected.indexOf(parameter.parameterDeclaration)), [0, 1, 2]);
  assert.deepEqual(parameters.map(parameter => parameter.acceptsOmission), [false, true, true]);
  assert.deepEqual(parameters.map(parameter => parameter.rest), [false, false, true]);
  assert.ok(Object.isFrozen(selected));
  assert.ok(Object.isFrozen(selected.signatures));
  assert.ok(parameters.every(Object.isFrozen));
});
