import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import {
  createTargetSourceProgram,
  sourceMemberOwner,
  sourceObjectMemberDeclarations,
  sourceParameterIsProperty,
} from "../public/source.js";

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
