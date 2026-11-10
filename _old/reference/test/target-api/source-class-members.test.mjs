import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import { sourceTypeFlowFixture } from "./fixtures/source-type-flow-fixture.mjs";
import { sourceClassFieldHasStorage, sourceClassFieldIsTypeOnly, sourceMemberOwner, sourceObjectMemberDeclarations, sourceParameterIsProperty } from "../../packages/target-api/dist/source-navigation/class-members.js";

test("type-only field classification preserves original declarations without guessing from names or types", () => {
  const { source, file } = sourceTypeFlowFixture(`
      declare const brand: unique symbol;
      class Value {
        declare private then?: never;
        declare readonly [brand]: void;
        declare static metadata: number;
        ordinary?: never;
        value: number = 3;
        constructor(readonly count: number) {}
      }
    `, { imports: "" });
  const declaration = source.ast.statements(file)[1];
  assert.ok(declaration);
  const original = source.ast.members(declaration);
  const members = sourceObjectMemberDeclarations(source.ast, declaration);
  assert.equal(members.length, original.length + 1);
  members.forEach((member, index) => {
    assert.ok(member);
    assert.equal(sourceClassFieldIsTypeOnly(source.ast, member), index < 3);
    if (index < original.length) assert.equal(member === original[index], true, "the identical authored member stays in place");
  });
});

test("authored field storage excludes abstract contracts without changing their type-only classification", () => {
  const { source, file } = sourceTypeFlowFixture(`abstract class Value {
      abstract required: object;
      declare readonly phantom: object;
      ordinary?: object;
      value: object = {};
      constructor(public item: object) {}
    }`, { imports: "" });
  const declaration = source.ast.statements(file)[0];
  const members = source.ast.members(declaration);
  assert.equal(members.every(member => member !== undefined), true);
  assert.equal(sourceClassFieldIsTypeOnly(source.ast, members[0]) === false &&
    sourceClassFieldHasStorage(source.ast, members[0]) === false, true,
  "abstract contracts are not ambient declarations, but neither provides a physical field initialization");
  for (const [index, expected] of [[1, false], [2, true], [3, true], [4, false]])
    assert.equal(sourceClassFieldHasStorage(source.ast, members[index]) === expected, true, `member ${index}: exact authored storage`);
  const parameter = source.ast.parameters(members[4])[0];
  assert.equal(sourceParameterIsProperty(source.ast, parameter) && !sourceClassFieldHasStorage(source.ast, parameter), true,
    "parameter-property initialization remains its separate exact constructor formal relationship");
});

test("parameter properties retain exact field declarations, owners and storage escape", () => {
  const { source, file } = sourceTypeFlowFixture(`
      class Base {
        plain = 1;
        constructor(public readonly value: number, ignored: number) {}
        read(): number { return this.value; }
      }
      class Derived extends Base {
        constructor(public readonly value: number) { super(value, 0); }
      }
      function ordinary(value: number): number { return value; }
      class Mutable {
        constructor(public count: number) { count += 1; this.count = count; }
        increment(): void { this.count += 1; }
      }
      const mutable = new Mutable(1);
      mutable.count = 3;
    `, { imports: "" });
  const [base, derived, ordinary, mutable] = source.ast.statements(file);
  assert.ok(base && derived && ordinary);
  const originalMembers = source.ast.members(base);
  const constructor = originalMembers.find(member =>
    member !== undefined && source.ast.kindName(member) === "KindConstructor");
  assert.ok(constructor);
  const [property, ignored] = source.ast.parameters(constructor);
  assert.ok(property && ignored);
  const members = sourceObjectMemberDeclarations(source.ast, base);
  assert.equal(isDeepStrictEqual(members, [...originalMembers, property]), true, "the exact original members and parameter property remain in order");
  assert.equal(isDeepStrictEqual(source.ast.members(base), originalMembers), true, "original class members are not mutated");
  assert.ok(Object.isFrozen(members));
  assert.equal(sourceParameterIsProperty(source.ast, property), true);
  assert.equal(sourceParameterIsProperty(source.ast, ignored), false);
  assert.equal(sourceMemberOwner(source.ast, property) === base, true, "the parameter property keeps its actual class owner");
  const ordinaryParameter = source.ast.parameters(ordinary)[0];
  assert.ok(ordinaryParameter);
  assert.equal(sourceParameterIsProperty(source.ast, ordinaryParameter), false);
  const summary = source.facts.navigation.parameterUseSummary(property);
  assert.ok(summary?.aliasedOrStored);
  assert.ok(summary.constructorInitialized);
  assert.ok(summary.escapeKinds.includes("storage"));
  assert.equal(source.facts.navigation.parameterUseSummary(ignored)?.aliasedOrStored, false);
  assert.ok(mutable);
  const mutableConstructor = source.ast.members(mutable).find(member =>
    member !== undefined && source.ast.kindName(member) === "KindConstructor");
  assert.ok(mutableConstructor);
  const mutableParameter = source.ast.parameters(mutableConstructor)[0];
  assert.ok(mutableParameter);
  const mutableSummary = source.facts.navigation.parameterUseSummary(mutableParameter);
  assert.ok(mutableSummary?.bindingWritten);
  assert.ok(mutableSummary.memberWritten);
  assert.ok(mutableSummary.mutatedAfterInitialization);
  const implementation = source.facts.navigation.memberImplementation(derived, property);
  assert.equal(implementation.kind, "resolved");
  if (implementation.kind === "resolved") {
    const derivedConstructor = source.ast.members(derived).find(member =>
      member !== undefined && source.ast.kindName(member) === "KindConstructor");
    assert.ok(derivedConstructor);
    assert.equal(implementation.implementation.declaration === source.ast.parameters(derivedConstructor)[0], true,
      "the inherited implementation is the identical original derived parameter property");
  }
});

test("named and anonymous class expressions retain the same exact parameter-property ownership", () => {
  const { source, file } = sourceTypeFlowFixture(`
      const named = class Named {
        declare private then?: never;
        constructor(readonly value: number, ignored: number) {}
      };
      const anonymous = class {
        constructor(readonly value: string, ignored: string) {}
      };
    `, { imports: "" });
  const expressions = [];
  const visit = (node) => {
    if (source.ast.kindName(node) === "KindClassExpression") expressions.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(expressions.length, 2);
  for (const expression of expressions) {
    const original = source.ast.members(expression);
    const constructor = original.find(member => member !== undefined && source.ast.kindName(member) === "KindConstructor");
    assert.ok(constructor);
    const [property, ignored] = source.ast.parameters(constructor);
    assert.ok(property && ignored);
    assert.equal(sourceParameterIsProperty(source.ast, property), true);
    assert.equal(sourceParameterIsProperty(source.ast, ignored), false);
    assert.ok(sourceMemberOwner(source.ast, property) === expression);
    const expected = [...original, property];
    assert.deepEqual(sourceObjectMemberDeclarations(source.ast, expression).map(member => expected.indexOf(member)),
      expected.map((_member, index) => index));
    assert.deepEqual(source.ast.members(expression).map(member => original.indexOf(member)),
      original.map((_member, index) => index));
    assert.equal(sourceClassFieldIsTypeOnly(source.ast, property), false);
  }
  assert.ok(source.ast.members(expressions[0])[0]);
  assert.equal(sourceClassFieldIsTypeOnly(source.ast, source.ast.members(expressions[0])[0]), true);
});

test("class expressions retain exact inherited and parameter-property implementations", () => {
  const { source, file } = sourceTypeFlowFixture(`
      abstract class Base { abstract readonly value: number; abstract read(): number; }
      function named() {
        return class Selected extends Base {
          constructor(readonly value: number) { super(); }
          read(): number { return this.value; }
        };
      }
      function anonymous() {
        return class extends Base {
          constructor(readonly value: number) { super(); }
          read(): number { return this.value; }
        };
      }
    `, { imports: "" });
  const base = source.ast.statements(file)[0];
  assert.ok(base);
  const [value, read] = source.ast.members(base);
  assert.ok(value && read);
  const expressions = [];
  const visit = (node) => {
    if (source.ast.is.IsClassExpression(node)) expressions.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(expressions.length, 2);
  for (const expression of expressions) {
    const members = source.ast.members(expression);
    const constructor = members.find(member => member !== undefined && source.ast.kindName(member) === "KindConstructor");
    const method = members.find(member => member !== undefined && source.ast.kindName(member) === "KindMethodDeclaration");
    assert.ok(constructor && method);
    const property = source.ast.parameters(constructor)[0];
    assert.ok(property);
    const pairs =
      [[value, property], [read, method], [property, property], [method, method]];
    for (const [contract, implementation] of pairs) {
      const selected = source.facts.navigation.memberImplementation(expression, contract);
      assert.equal(selected.kind, "resolved");
      if (selected.kind !== "resolved") throw new Error("Missing exact implementation");
      assert.ok(selected.implementation.declaration === implementation);
      assert.ok(source.facts.navigation.memberImplementation(expression, contract) === selected);
    }
  }
});
