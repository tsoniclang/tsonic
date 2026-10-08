import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";

function fixture(body, extraFiles = {}, domain = "complete") {
  const files = { "/project/index.ts": body, ...extraFiles };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/project",
    files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "source checking accepts the unmodified alias program");
  const source = createTargetSourceProgram(checked);
  const sourceFiles = Object.keys(files).map(name => checked.getSourceFile(name));
  const nodes = [];
  const pending = [...sourceFiles];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const storage = createSourceStorageQuery(source, sourceFiles);
  const named = (name, predicate) => nodes.find(node => predicate(node) && source.ast.text(source.ast.name(node)) === name);
  const original = named("original", source.ast.is.IsVariableDeclaration);
  const replacement = named("replacement", source.ast.is.IsVariableDeclaration);
  const owner = named("Value", source.ast.is.IsClassDeclaration);
  const member = source.ast.members(owner).find(node => source.ast.text(source.ast.name(node)) === "callback");
  const selected = source.ast.is.IsGetAccessorDeclaration(member) ? storage.subject(member, "return")
    : storage.storageSubjectFor(member);
  assert.equal(selected.kind, "resolved");
  const origins = storage.closedOriginsFor(selected.subject);
  assert.equal(origins.kind, domain, "no unseen external writer is erased");
  if (domain === "open") assert.equal(origins.boundaries.some(boundary => boundary.kind === "external-write"), true,
    "an exported writable class contract remains open");
  assert.equal(storage.failureReason() === undefined, true, "one finite graph accounts every direction");
  return { source, sourceFiles, storage, member, origins: origins.origins,
    original: source.ast.as.AsVariableDeclaration(original).Initializer,
    replacement: source.ast.as.AsVariableDeclaration(replacement).Initializer };
}

for (const access of ["view.callback", 'view["callback"]']) test(`checked structural write ${access} reaches the exact native member`, () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    const view: { callback: () => number } = value;
    ${access} = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "constructor contribution");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "alias write contribution");
  assert.equal(Object.isFrozen(current.origins), true);
});

test("cross-file generic structural writes retain original checked member identity", () => {
  const current = fixture(`
    import { Value } from "./value.js";
    const original = (input: number): number => input + 1;
    const replacement = (input: number): number => input + 2;
    const value = new Value(original);
    const view: { callback: (input: number) => number } = value;
    view.callback = replacement;
  `, { "/project/value.ts": `
    export class Value<T> {
      callback: (input: T) => T;
      constructor(initial: (input: T) => T) { this.callback = initial; }
    }
  ` }, "open");
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "selected constructor input");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "cross-file alias write");
  assert.equal(current.source.ast.getSourceFile(current.member) === current.sourceFiles[1], true, "original provider member identity");
});

test("readonly structural alias rebinding cannot replace the original object's member", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    let view: { readonly callback: () => number } = value;
    view = { callback: replacement };
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "rebinding is not a field write");
});

test("structural writes invoke accessors without manufacturing writes to their return values", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value {
      get callback(): () => number { return original; }
      set callback(value: () => number) { }
    }
    const value = new Value();
    const view: { callback: () => number } = value;
    view.callback = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "the setter does not return its argument");
});
