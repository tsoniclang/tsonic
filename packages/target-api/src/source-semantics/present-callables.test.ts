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
