import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `
      export {};
      class Box<Value> {
        get numeric(): number { return 3; }
        set numeric(next: number) { void next; }
        get generic(): Value { throw 0; }
        get callback(): () => number { return () => 3; }
      }
      function choose(value: number): number;
      function choose(value: string): string;
      function choose(value: number | string): number | string { return value; }
      const arrow = (): boolean => true;
    ` } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "real source fixture checks without compensating type annotations");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(value => source.ast.getFileName(value) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return { source, file, storage, nodes, semantics: source.semantics.forFile(file) };
}

for (const [name, kind] of [["numeric", "KindGetAccessor"], ["generic", "KindGetAccessor"], ["callback", "KindGetAccessor"]]) {
  test(`shared ${name} getter storage uses its exact checked invocation return Type`, () => {
    const input = fixture();
    const node = input.nodes.find(value => input.source.ast.kindName(value) === kind &&
      input.source.ast.text(input.source.ast.name(value)) === name);
    const signature = input.semantics.types.declarationSignatureInfo(node);
    assert.equal(signature !== undefined && input.semantics.declarations.signatureDeclaration(signature.signature) === node, true);
    const selected = input.storage.subject(node, "return");
    assert.equal(selected.kind, "resolved");
    const type = input.storage.typeFor(selected.subject);
    assert.equal(type.kind, "resolved");
    assert.equal(type.type === signature.returnType, true, "return subject keeps the exact native-neutral checked Type");
    assert.equal(input.storage.typeFor(selected.subject).type === type.type, true);
    assert.equal(input.storage.failureReason() === undefined, true);
  });
}

test("paired accessors never substitute setter or callable payload signatures for getter return evidence", () => {
  const input = fixture();
  const getter = input.nodes.find(node => input.source.ast.is.IsGetAccessorDeclaration(node) &&
    input.source.ast.text(input.source.ast.name(node)) === "numeric");
  const setter = input.nodes.find(node => input.source.ast.is.IsSetAccessorDeclaration(node));
  const getterSignature = input.semantics.types.declarationSignatureInfo(getter);
  const setterSignature = input.semantics.types.declarationSignatureInfo(setter);
  const returned = input.storage.subject(getter, "return");
  assert.equal(returned.kind, "resolved");
  assert.equal(getterSignature.returnType !== setterSignature.returnType, true);
  const type = input.storage.typeFor(returned.subject);
  assert.equal(type.kind, "resolved");
  assert.equal(type.type === getterSignature.returnType, true);
  assert.equal(input.semantics.types.callSignatures(getterSignature.returnType).length, 0, "a scalar payload is not a getter function");
  const callback = input.nodes.find(node => input.source.ast.is.IsGetAccessorDeclaration(node) &&
    input.source.ast.text(input.source.ast.name(node)) === "callback");
  const callbackSignature = input.semantics.types.declarationSignatureInfo(callback);
  const payloadSignatures = input.semantics.types.callSignatures(callbackSignature.returnType);
  assert.equal(payloadSignatures.length, 1);
  assert.equal(input.semantics.declarations.signatureDeclaration(payloadSignatures[0]) === callback, false);
});

test("ordinary and overloaded callable return subjects retain exact declaration correspondence", () => {
  const input = fixture();
  const declarations = input.nodes.filter(node => input.source.ast.is.IsFunctionDeclaration(node) || input.source.ast.is.IsArrowFunction(node));
  assert.equal(declarations.length, 5);
  for (const declaration of declarations) {
    const signature = input.semantics.types.declarationSignatureInfo(declaration);
    assert.equal(signature !== undefined && input.semantics.declarations.signatureDeclaration(signature.signature) === declaration, true);
    const selected = input.storage.subject(declaration, "return");
    assert.equal(selected.kind, "resolved");
    const type = input.storage.typeFor(selected.subject);
    assert.equal(type.kind, "resolved");
    assert.equal(type.type === signature.returnType, true, "exact overload/arrow return, no property-value scan");
  }
});
