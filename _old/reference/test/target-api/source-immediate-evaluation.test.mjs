import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, forEachSourceImmediateEvaluationChild } from "../../packages/target-api/dist/public/source.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const profile = `
  interface Object {}
  interface Function {}
  interface CallableFunction extends Function {}
  interface NewableFunction extends Function {}
  interface IArguments {}
  interface Boolean {}
  interface Number {}
  interface String {}
  interface RegExp {}
  interface Array<T> { length: number; [index: number]: T; }
`;

test("source effects distinguish eager class work from deferred instance and callable work", async (context) => {
  const checked = await checkedSource("immediate-class-effects", {
    "profile.d.ts": profile,
    "src/index.ts": `
      let count = 0;
      function key(): "value" { count += 1; return "value"; }
      class DeferredField { value = (count += 1); }
      class DeferredConstructor { constructor(value = key()) { count += 1; } }
      class DeferredMethods {
        method(value = key()): number { count += 1; return count; }
        get value(): number { count += 1; return count; }
        set value(input: number) { count += input; }
      }
      class ComputedMethod { [key()](): number { return count; } }
      class ComputedGetter { get [key()](): number { return count; } }
      class ComputedSetter { set [key()](input: number) { count += input; } }
      class StaticField { static value = (count += 1); }
      class StaticBlock { static { count += 1; } }
      class Base {}
      function base(): typeof Base { return Base; }
      class Derived extends base() {}
      function deferred(value = key()): number { count += 1; return count; }
    `,
  });
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)), "");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const none = { invokes: false, mutates: false, suspends: false, mayThrow: false };
  const invokes = { invokes: true, mutates: false, suspends: false, mayThrow: true };
  const mutates = { invokes: false, mutates: true, suspends: false, mayThrow: true };
  const cases = [
    ["DeferredField", none],
    ["DeferredConstructor", none],
    ["DeferredMethods", none],
    ["ComputedMethod", invokes],
    ["ComputedGetter", invokes],
    ["ComputedSetter", invokes],
    ["StaticField", mutates],
    ["StaticBlock", mutates],
    ["Derived", invokes],
    ["deferred", none],
  ];
  for (const [name, expected] of cases) {
    await context.test(name, () => {
      const declaration = namedDeclaration(source.ast, file, name);
      const effects = source.navigation.expressionEffects(declaration);
      assert.deepEqual(effects, expected, name);
      assert.equal(Object.isFrozen(effects), true, name);
      assert.equal(source.navigation.expressionEffects(declaration) === effects, true, name);
    });
  }
});

test("immediate class children retain exact heritage, key and static initialization identities", async () => {
  const checked = await checkedSource("immediate-evaluation-identities", {
    "profile.d.ts": profile,
    "src/index.ts": `
      function key(): "value" { return "value"; }
      function effect(input: number): number { return input; }
      class Base {}
      function base(): typeof Base { return Base; }
      class Ordered extends base() {
        static first = effect(1);
        [key()](): number { return effect(2); }
        ["instance"] = effect(5);
        static ["tail"] = effect(3);
        static { effect(4); }
      }
      const expression = class { [key()](): number { return effect(5); } };
      const object = { [key()](): number { return effect(6); } };
      interface TypeOnly { ["value"](): number; }
      type Erased = typeof key;
    `,
  });
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)), "");
  const source = createTargetSourceProgram(checked);
  const { ast } = source;
  const file = projectSourceFile(source, "src/index.ts");
  const ordered = namedDeclaration(ast, file, "Ordered");
  const members = ast.members(ordered);
  const children = [];
  forEachSourceImmediateEvaluationChild(ast, ordered, child => children.push(child));
  const heritage = ast.as.AsExpressionWithTypeArguments(ast.extendsHeritageElements(ordered)[0])?.Expression;
  const expected = [
    heritage,
    ast.name(members[1]),
    ast.name(members[2]),
    ast.name(members[3]),
    ast.as.AsPropertyDeclaration(members[0])?.Initializer,
    ast.as.AsPropertyDeclaration(members[3])?.Initializer,
    ast.as.AsClassStaticBlockDeclaration(members[4])?.Body,
  ];
  assert.equal(children.length, expected.length);
  for (const [index, node] of expected.entries()) {
    assert.equal(node !== undefined && children[index] === node, true, `class child ${index}`);
  }
  assert.equal(children.includes(ast.as.AsPropertyDeclaration(members[2])?.Initializer), false);
  const classExpression = ast.as.AsVariableDeclaration(namedVariable(ast, file, "expression"))?.Initializer;
  const expressionChildren = [];
  forEachSourceImmediateEvaluationChild(ast, classExpression, child => expressionChildren.push(child));
  assert.equal(expressionChildren.length, 1);
  assert.equal(expressionChildren[0] === ast.name(ast.members(classExpression)[0]), true);
  const object = ast.as.AsVariableDeclaration(namedVariable(ast, file, "object"))?.Initializer;
  assert.deepEqual(source.navigation.expressionEffects(object), {
    invokes: true, mutates: false, suspends: false, mayThrow: true,
  });
  const typeOnly = namedDeclaration(ast, file, "TypeOnly");
  const erased = requiredNode(ast, file, node => ast.is.IsTypeAliasDeclaration(node));
  for (const declaration of [typeOnly, erased]) {
    const children = [];
    forEachSourceImmediateEvaluationChild(ast, declaration, child => children.push(child));
    assert.equal(children.length, 0, ast.text(ast.name(declaration)));
    assert.deepEqual(source.navigation.expressionEffects(declaration), {
      invokes: false, mutates: false, suspends: false, mayThrow: false,
    });
  }
});
