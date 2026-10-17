import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { sourceStorageSubjectType } from "../../packages/target-api/dist/target-analysis/source-storage/model/components.js";
import { namedDeclaration, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
async function asynchronous(): Promise<number[]> { return [1, 2]; }
async function tuple(): Promise<[number, string]> { return [1, "value"]; }
function synchronous(): number[] { return [1, 2]; }
function promised(): Promise<number[]> { return Promise.resolve([1, 2]); }
function* generator(): Generator<number, number[], unknown> { yield 1; return [1, 2]; }
async function* asyncGenerator(): AsyncGenerator<number, number[], unknown> { yield 1; return [1, 2]; }
const concise = async (): Promise<number[]> => [1, 2];
const pending = asynchronous();
` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.extensionDiagnostics.length === 0 && checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "/src/index.ts");
  const semantics = source.semantics.forFile(file);
  const declaration = name => namedDeclaration(source.ast, file, name);
  const returned = (node, projection = [], selected = source) => sourceStorageSubjectType(selected,
    { kind: "return", node, projection }, file);
  return { source, file, semantics, declaration, returned };
}

test("async body return projections use the exact checked completion type", () => {
  const { source, file, semantics, declaration, returned } = fixture();
  for (const name of ["asynchronous", "tuple"]) {
    const node = declaration(name);
    const signature = semantics.types.declarationSignatureInfo(node);
    assert.equal(signature !== undefined, true, `${name}: exact declaration signature`);
    const completion = semantics.types.awaitedType(signature.returnType);
    assert.equal(completion !== undefined && returned(node) === completion, true,
      `${name}: the body result is the canonical awaited type, not the invocation Promise`);
  }
  const element = returned(declaration("asynchronous"), [{ kind: "array-element" }]);
  assert.equal(element !== undefined && semantics.types.isNumberLike(element), true,
    "an async body array retains its checked numeric element");
  const field = returned(declaration("tuple"), [{ kind: "tuple-element", index: 1 }]);
  assert.equal(field !== undefined && semantics.types.isStringLike(field), true,
    "async tuple projection retains its exact field rather than the Promise wrapper");
  const concise = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "concise"))?.Initializer;
  assert.equal(concise !== undefined, true, "the actual checked async arrow is present");
  const conciseElement = returned(concise, [{ kind: "array-element" }]);
  assert.equal(conciseElement !== undefined && semantics.types.isNumberLike(conciseElement), true,
    "concise async arrows use the same body-return contract");
});

test("return completion selection preserves synchronous, invocation and generator domains", () => {
  const { source, file, semantics, declaration, returned } = fixture();
  for (const name of ["synchronous", "promised", "generator", "asyncGenerator"]) {
    const node = declaration(name);
    const signature = semantics.types.declarationSignatureInfo(node);
    assert.equal(signature !== undefined && returned(node) === signature.returnType, true,
      `${name}: the existing exact return domain is unchanged`);
  }
  const ordinary = returned(declaration("synchronous"), [{ kind: "array-element" }]);
  assert.equal(ordinary !== undefined && semantics.types.isNumberLike(ordinary), true,
    "a synchronous array still has its checked numeric element");
  assert.equal(returned(declaration("promised"), [{ kind: "array-element" }]) === undefined, true,
    "a synchronous Promise return is not an array body completion");
  const invocation = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "pending"))?.Initializer;
  assert.equal(invocation !== undefined, true, "the actual checked async invocation is present");
  const subject = { kind: "value", node: invocation, projection: [] };
  assert.equal(sourceStorageSubjectType(source, subject, file) === semantics.types.expressionType(invocation), true,
    "an async invocation retains its original checked Promise object");
  assert.equal(sourceStorageSubjectType(source, { ...subject, projection: [{ kind: "array-element" }] }, file) === undefined,
    true, "the outer Promise cannot be projected as an array");
});

test("body return projection refuses unavailable or foreign signature evidence without a fallback", () => {
  const { source, semantics, declaration, returned } = fixture();
  const node = declaration("asynchronous");
  const selected = types => ({ ...source, semantics: { ...source.semantics,
    forFile: file => ({ ...source.semantics.forFile(file), types: { ...semantics.types, ...types } }) } });
  assert.equal(returned(node, [], selected({ awaitedType: () => undefined })) === undefined, true,
    "an unavailable checked completion is not replaced with its Promise or a guessed element type");
  assert.equal(returned(node, [], selected({ declarationSignatureInfo: () => undefined })) === undefined, true,
    "an absent original signature remains unavailable");
  const original = semantics.types.declarationSignatureInfo(node);
  assert.equal(original !== undefined, true, "the body has its genuine original checked signature");
  assert.equal(returned(node, [], selected({ declarationSignatureInfo: () => ({ ...original, returnType: undefined }) })) === undefined,
    true, "an unavailable checked return type is not passed to awaited-type selection");
  const foreign = semantics.types.declarationSignatureInfo(declaration("synchronous"));
  assert.equal(foreign !== undefined, true, "the foreign declaration has a genuine checked signature");
  assert.equal(returned(node, [], selected({ declarationSignatureInfo: () => foreign })) === undefined, true,
    "a different declaration's checked signature never becomes this body's evidence");
});
