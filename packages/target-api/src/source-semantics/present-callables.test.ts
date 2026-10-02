import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourcePresentCallableType } from "./present-callables.js";

test("present callable selection retains exact declarations and quantified binders", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      type RequiredCallable = <Value>(value: Value) => Value;
      type Optional = RequiredCallable | null | undefined;
      type Noncallable = number | undefined;
      type Ambiguous = RequiredCallable | ((value: number) => string) | undefined;
      type Absent = null | undefined;
      interface Owner { identity?<Value>(value: Value): Value; }
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const statements = source.ast.statements(file);
  const selections = statements.slice(0, 5).map(declaration =>
    sourcePresentCallableType(semantics.declarations.declaredType(declaration!), semantics));
  assert.ok(selections[0] && selections[1]);
  assert.equal(semantics.declarations.signatureDeclaration(semantics.types.callSignatures(selections[0])[0]!),
    semantics.declarations.signatureDeclaration(semantics.types.callSignatures(selections[1])[0]!));
  for (const selection of selections.slice(2)) assert.equal(selection, undefined);
  const owner = semantics.declarations.declaredType(statements[5]!);
  assert.ok(owner);
  const property = semantics.types.propertyInfos(owner)[0];
  assert.ok(property?.optional);
  const present = sourcePresentCallableType(property.type, semantics);
  assert.ok(present);
  const declaration = semantics.declarations.signatureDeclaration(semantics.types.callSignatures(present)[0]!);
  assert.ok(declaration);
  assert.equal(source.ast.typeParameters(declaration).length, 1);
  assert.equal(sourcePresentCallableType(undefined, semantics), undefined);
});

test("present callable selection retains every exact overload without inventing a selected signature", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      interface Overloaded { (value: string): unknown; (value: number): number; }
      type Optional = Overloaded | null | undefined;
      type Ambiguous = Overloaded | ((value: boolean) => boolean) | undefined;
      type Absent = null | undefined;
      interface Owner { read?(value: string): unknown; read?(value: number): number; }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const statements = source.ast.statements(file);
  assert.equal(statements.length, 5);
  assert.ok(statements.every(declaration => declaration !== undefined));
  const declared = semantics.declarations.declaredType(statements[0]!);
  const optional = semantics.declarations.declaredType(statements[1]!);
  assert.ok(declared && optional);
  const present = sourcePresentCallableType(optional, semantics);
  assert.equal(present, declared);
  assert.equal(semantics.types.callable(present!), undefined);
  assert.deepEqual(semantics.types.callSignatures(present!), semantics.types.callSignatures(declared));
  assert.equal(semantics.types.callSignatures(present!).length, 2);
  for (const declaration of statements.slice(2, 4)) {
    assert.ok(declaration);
    assert.equal(sourcePresentCallableType(semantics.declarations.declaredType(declaration), semantics), undefined);
  }
  const owner = semantics.declarations.declaredType(statements[4]!);
  assert.ok(owner);
  const property = semantics.types.propertyInfos(owner)[0];
  assert.ok(property?.optional);
  const method = sourcePresentCallableType(property.type, semantics);
  assert.ok(method);
  assert.equal(semantics.types.callSignatures(method).length, 2);
  assert.deepEqual(semantics.types.callSignatures(method).map(signature =>
    semantics.declarations.signatureDeclaration(signature)), source.ast.members(statements[4]));
});
