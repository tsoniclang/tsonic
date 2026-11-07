import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createHostSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { sourceStorageSubjectType } from "../../packages/target-api/dist/target-analysis/source-storage/model/components.js";
import { sourceTypeDescriptorsEqual } from "../../packages/target-api/dist/public/source.js";

const resolved = outcome => outcome.kind === "refused" ? undefined : outcome.type;
const isNumber = type => type?.kind === "primitive" && type.primitive === "float64";
const isString = type => type?.kind === "string";
const same = (left, right) => left !== undefined && right !== undefined && sourceTypeDescriptorsEqual(left, right);
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
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = projectSourceFile(source, "/src/index.ts");
  const declaration = name => namedDeclaration(source.ast, file, name);
  const returned = (node, projection = [], selected = source) => sourceStorageSubjectType(selected,
    { kind: "return", node, projection }, file);
  return { source, file, declaration, returned };
}

test("async body return projections use the exact checked completion type", () => {
  const { source, file, declaration, returned } = fixture();
  for (const name of ["asynchronous", "tuple"]) {
    const node = declaration(name);
    const completion = resolved(source.facts.values.awaited(node));
    assert.equal(same(returned(node), completion), true,
      `${name}: the body result is the canonical awaited type, not the invocation Promise`);
  }
  const element = returned(declaration("asynchronous"), [{ kind: "array-element" }]);
  assert.equal(isNumber(element), true,
    "an async body array retains its checked numeric element");
  const field = returned(declaration("tuple"), [{ kind: "tuple-element", index: 1 }]);
  assert.equal(isString(field), true,
    "async tuple projection retains its exact field rather than the Promise wrapper");
  const concise = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "concise"))?.Initializer;
  assert.equal(concise !== undefined, true, "the actual checked async arrow is present");
  const conciseElement = returned(concise, [{ kind: "array-element" }]);
  assert.equal(isNumber(conciseElement), true,
    "concise async arrows use the same body-return contract");
});

test("return completion selection preserves synchronous, invocation and generator domains", () => {
  const { source, file, declaration, returned } = fixture();
  for (const name of ["synchronous", "promised", "generator", "asyncGenerator"]) {
    const node = declaration(name);
    assert.equal(same(returned(node), resolved(source.facts.values.callableReturn(node))), true,
      `${name}: the existing exact return domain is unchanged`);
  }
  const ordinary = returned(declaration("synchronous"), [{ kind: "array-element" }]);
  assert.equal(isNumber(ordinary), true,
    "a synchronous array still has its checked numeric element");
  assert.equal(returned(declaration("promised"), [{ kind: "array-element" }]) === undefined, true,
    "a synchronous Promise return is not an array body completion");
  const invocation = source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, "pending"))?.Initializer;
  assert.equal(invocation !== undefined, true, "the actual checked async invocation is present");
  const subject = { kind: "value", node: invocation, projection: [] };
  assert.equal(same(sourceStorageSubjectType(source, subject, file), resolved(source.facts.values.type(invocation))), true,
    "an async invocation retains its original checked Promise object");
  assert.equal(sourceStorageSubjectType(source, { ...subject, projection: [{ kind: "array-element" }] }, file) === undefined,
    true, "the outer Promise cannot be projected as an array");
});

test("body return projection refuses an unavailable Host result without a fallback", () => {
  const { source, declaration, returned } = fixture();
  const refused = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: declaration("asynchronous"),
    reason: "fixture refusal" });
  const selected = values => ({ ...source, facts: { ...source.facts, values: { ...source.facts.values, ...values } } });
  assert.equal(returned(declaration("asynchronous"), [], selected({ awaited: () => refused })) === undefined, true,
    "an unavailable completion is not replaced with its Promise or a guessed element type");
  assert.equal(returned(declaration("synchronous"), [], selected({ callableReturn: () => refused })) === undefined, true,
    "a refused callable result remains unavailable");
});
