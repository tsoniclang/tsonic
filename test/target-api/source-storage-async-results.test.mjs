import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

const globals = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Promise<T> {}
interface Array<T> { [index: number]: T; length: number; }
interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
`;

async function fixture(name, body) {
  const checked = await checkedSource(name, { "globals.d.ts": globals, "src/index.ts": `export {}; ${body}` });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "source facts admitted");
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits);
  const initializer = name => source.ast.as.AsVariableDeclaration(namedVariable(source.ast, file, name)).Initializer;
  const producers = name => {
    const subject = storage.subjectFor(namedVariable(source.ast, file, name));
    assert.equal(subject.kind === "resolved", true, name);
    const selected = storage.storageProducersFor(subject.subject);
    assert.equal(selected.kind === "complete", true, `${name}: exact owned result`);
    assert.equal(Object.isFrozen(selected.producers) && selected.producers.every(Object.isFrozen), true);
    return selected.producers;
  };
  return { source, storage, initializer, producers };
}

test("async invocation identity is its deferred result, not its scalar or reference fulfillment", async () => {
  const current = await fixture("storage-async-result-identity", `
    const original = {};
    async function scalar(): Promise<number> { return 1; }
    async function reference(): Promise<{}> { return original; }
    const numberResult = scalar(); const referenceResult = reference();
    const secondResult = reference(); const alias = referenceResult;
  `);
  for (const name of ["numberResult", "referenceResult", "secondResult"]) {
    const selected = current.producers(name);
    assert.equal(selected.length === 1 && selected[0].subject.node === current.initializer(name), true, name);
  }
  assert.equal(current.producers("alias")[0].subject.node === current.initializer("referenceResult"), true);
  assert.equal(current.producers("referenceResult")[0].subject === current.producers("secondResult")[0].subject, false);
});

test("normal functions transport existing futures without acquiring async allocation semantics", async () => {
  const current = await fixture("storage-async-result-forwarding", `
    async function create(): Promise<number> { return 1; }
    function retain<T>(value: T): T { return value; }
    const original = create(); const forwarded = retain(original);
    function select(): Promise<number> { return original; }
    const selected = select();
  `);
  for (const name of ["original", "forwarded", "selected"]) {
    const selected = current.producers(name);
    assert.equal(selected.length === 1 && selected[0].subject.node === current.initializer("original"), true, name);
  }
});

test("async arrows and methods preserve their call result rather than the returned object", async () => {
  const current = await fixture("storage-async-result-callables", `
    const object = {};
    const arrow = async (): Promise<{}> => object;
    class Owner { async create(): Promise<{}> { return object; } }
    const owner = new Owner();
    const arrowResult = arrow(); const methodResult = owner.create();
  `);
  for (const name of ["arrowResult", "methodResult"]) {
    const selected = current.producers(name);
    assert.equal(selected.length === 1 && selected[0].subject.node === current.initializer(name), true, name);
  }
});

test("mixed async and synchronous implementations preserve each actual result relation", async () => {
  const current = await fixture("storage-async-result-mixed", `
    declare const condition: boolean;
    async function fresh(): Promise<number> { return 1; }
    const original = fresh();
    function existing(): Promise<number> { return original; }
    const callback = condition ? fresh : existing;
    const result = callback();
  `);
  const selected = current.producers("result");
  assert.equal(selected.length === 2, true, "two exact producers, not two fulfilled scalars");
  for (const name of ["original", "result"])
    assert.equal(selected.some(producer => producer.subject.node === current.initializer(name)), true, name);
});

test("a source async call keeps argument and activation evidence without aliasing its result", async () => {
  const current = await fixture("storage-async-result-activation", `
    async function wrap<T>(value: T): Promise<T> { return value; }
    function create<T>(value: T): Promise<T> { return wrap(value); }
    const left = {}; const right = {};
    const first = create(left); const second = create(right);
  `);
  const first = current.producers("first");
  const second = current.producers("second");
  assert.equal(first.length === 1 && second.length === 1, true);
  assert.equal(first[0].subject === second[0].subject, true, "one authored inner operation");
  assert.equal(first[0].bindings === second[0].bindings, false, "independent invocation activations");
  assert.equal(current.source.ast.is.IsCallExpression(first[0].subject.node), true);
  assert.equal(Object.isFrozen(first[0].bindings), true);
  assert.equal(current.storage.storageProducersFor(first[0].subject, { ...first[0].bindings }).kind === "unresolved", true,
    "copied activation tokens cannot acquire graph ownership");
});
