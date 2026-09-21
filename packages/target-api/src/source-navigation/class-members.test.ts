import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import {
  createTargetSourceProgram,
  sourceClassFieldIsTypeOnly,
  sourceMemberOwner,
  sourceObjectMemberDeclarations,
  sourceParameterIsProperty,
} from "../public/source.js";

test("type-only field classification preserves original declarations without guessing from names or types", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      declare const brand: unique symbol;
      class Value {
        declare private then?: never;
        declare readonly [brand]: void;
        declare static metadata: number;
        ordinary?: never;
        value: number = 3;
        constructor(readonly count: number) {}
      }
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declaration = source.ast.statements(file)[1];
  assert.ok(declaration);
  const original = source.ast.members(declaration);
  const members = sourceObjectMemberDeclarations(source.ast, declaration);
  assert.equal(members.length, original.length + 1);
  members.forEach((member, index) => {
    assert.ok(member);
    assert.equal(sourceClassFieldIsTypeOnly(source.ast, member), index < 3);
    if (index < original.length) assert.equal(member, original[index]);
  });
});

test("parameter properties retain exact field declarations, owners and storage escape", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
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
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const [base, derived, ordinary, mutable] = source.ast.statements(file);
  assert.ok(base && derived && ordinary);
  const originalMembers = source.ast.members(base);
  const constructor = originalMembers.find(member =>
    member !== undefined && source.ast.kindName(member) === "KindConstructor");
  assert.ok(constructor);
  const [property, ignored] = source.ast.parameters(constructor);
  assert.ok(property && ignored);
  const members = sourceObjectMemberDeclarations(source.ast, base);
  assert.deepEqual(members, [...originalMembers, property]);
  assert.deepEqual(source.ast.members(base), originalMembers);
  assert.ok(Object.isFrozen(members));
  assert.equal(sourceParameterIsProperty(source.ast, property), true);
  assert.equal(sourceParameterIsProperty(source.ast, ignored), false);
  assert.equal(sourceMemberOwner(source.ast, property), base);
  const ordinaryParameter = source.ast.parameters(ordinary)[0];
  assert.ok(ordinaryParameter);
  assert.equal(sourceParameterIsProperty(source.ast, ordinaryParameter), false);
  const summary = source.navigation.parameterUseSummary(property);
  assert.ok(summary?.aliasedOrStored);
  assert.ok(summary.constructorInitialized);
  assert.ok(summary.escapeKinds.includes("storage"));
  assert.equal(source.navigation.parameterUseSummary(ignored)?.aliasedOrStored, false);
  assert.ok(mutable);
  const mutableConstructor = source.ast.members(mutable).find(member =>
    member !== undefined && source.ast.kindName(member) === "KindConstructor");
  assert.ok(mutableConstructor);
  const mutableParameter = source.ast.parameters(mutableConstructor)[0];
  assert.ok(mutableParameter);
  const mutableSummary = source.navigation.parameterUseSummary(mutableParameter);
  assert.ok(mutableSummary?.bindingWritten);
  assert.ok(mutableSummary.memberWritten);
  assert.ok(mutableSummary.mutatedAfterInitialization);
  const implementation = source.navigation.memberImplementation(derived, property);
  assert.equal(implementation.kind, "resolved");
  if (implementation.kind === "resolved") {
    const derivedConstructor = source.ast.members(derived).find(member =>
      member !== undefined && source.ast.kindName(member) === "KindConstructor");
    assert.ok(derivedConstructor);
    assert.equal(implementation.implementation.declaration, source.ast.parameters(derivedConstructor)[0]);
  }
});

test("named and anonymous class expressions retain the same exact parameter-property ownership", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      const named = class Named {
        declare private then?: never;
        constructor(readonly value: number, ignored: number) {}
      };
      const anonymous = class {
        constructor(readonly value: string, ignored: string) {}
      };
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const expressions: import("@tsonic/tsts").Node[] = [];
  const visit = (node: import("@tsonic/tsts").Node): void => {
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
    assert.equal(sourceMemberOwner(source.ast, property), expression);
    assert.deepEqual(sourceObjectMemberDeclarations(source.ast, expression), [...original, property]);
    assert.deepEqual(source.ast.members(expression), original);
    assert.equal(sourceClassFieldIsTypeOnly(source.ast, property), false);
  }
  assert.ok(source.ast.members(expressions[0]!)[0]);
  assert.equal(sourceClassFieldIsTypeOnly(source.ast, source.ast.members(expressions[0]!)[0]!), true);
});
