import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedDeclaration, namedVariable, projectSourceFile, requiredStorageSubject } from "../fixtures/source-navigation.mjs";

const profile = `
interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
interface Number {} interface String {} interface RegExp {} interface Array<T> { [index: number]: T; }
`;

async function checked(name) {
  const result = await checkedSource(name, {
    "globals.d.ts": profile,
    "src/provider.ts": `
      export interface Stored { message: string; }
      export declare function write(first: Stored, second: Stored): void;
      export declare function unrelated(first: Stored, second: Stored): void;
      export declare function spread(...values: Stored[]): void;
    `,
    "src/index.ts": `
      import { write } from "./provider.js";
      const original = { message: "original" };
      const alias = original;
      const untouched = { message: "untouched" };
      write(untouched, alias);
    `,
  });
  assert.equal(result.diagnostics.length, 0, formatDiagnostics(result.diagnostics, "/src"));
  const source = createTargetSourceProgram(result);
  const file = projectSourceFile(source, "src/index.ts");
  const provider = projectSourceFile(source, "src/provider.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  return { source, file, provider, storage, original: requiredStorageSubject(storage, namedVariable(source.ast, file, "original")),
    untouched: requiredStorageSubject(storage, namedVariable(source.ast, file, "untouched")), signature: namedDeclaration(source.ast, provider, "write") };
}

function analyze(source, storageMutators, storage) {
  return createSourceErrorStorageDemandQuery(source, { fields: [], constructors: [], stackCaptures: [], storageMutators,
    retention: () => ({ kind: "ordinary" }) }, storage);
}

test("physical Error storage mutation follows its exact selected cross-file scalar parameter and alias", async () => {
  const { source, signature, original, untouched, provider, storage } = await checked("error-storage-selected-mutator");
  const demand = analyze(source, [{ signature, sourceParameterIndex: 1 }], storage);
  assert.equal(demand.storageFor(original).kind, "writable");
  assert.equal(demand.storageFor(untouched).kind, "immutable");
  assert.equal(demand.fieldWrites.length, 0);
  assert.equal(demand.storageFor(original).writes.length, 1);
  assert.equal(Object.isFrozen(demand.storageFor(original).writes), true);
  const unrelated = namedDeclaration(source.ast, provider, "unrelated");
  assert.equal(analyze(source, [{ signature: unrelated, sourceParameterIndex: 1 }], storage).storageFor(original).kind, "immutable");
});

test("physical Error storage protocol rejects malformed, foreign, duplicate and nonscalar selections", async () => {
  const { source, signature, original, provider, storage: query } = await checked("error-storage-invalid-mutator");
  const foreign = await checked("error-storage-foreign-mutator");
  const spread = namedDeclaration(source.ast, provider, "spread");
  const selections = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 2].map(sourceParameterIndex => [{ signature, sourceParameterIndex }]);
  selections.push([{ signature: foreign.signature, sourceParameterIndex: 1 }],
    [{ signature: spread, sourceParameterIndex: 0 }],
    [{ signature, sourceParameterIndex: 1 }, { signature, sourceParameterIndex: 1 }]);
  for (const selection of selections) {
    const demand = analyze(source, selection, query);
    const storage = demand.storageFor(original);
    assert.equal(storage.kind, "unresolved", "invalid selected mutation cannot manufacture writable evidence");
    assert.equal(Object.isFrozen(storage), true);
    assert.equal(demand.storageOriginsFor(original).kind, "unresolved");
    assert.equal(demand.receivesWritableNative(original), false);
  }
});

test("Error carrier queries require the exact owning subject and reject removed Node signatures", async () => {
  const current = await checked("error-storage-canonical-subjects");
  const foreign = await checked("error-storage-canonical-foreign-subjects");
  const demand = analyze(current.source, [{ signature: current.signature, sourceParameterIndex: 1 }], current.storage);
  for (const subject of [current.original.node, foreign.original, { ...current.original }, undefined]) {
    for (const query of [demand.storageFor, demand.storageOriginsFor, demand.closedStorageOriginsFor]) {
      const selected = query(subject);
      assert.equal(selected.kind, "unresolved", "a Node or matching shape cannot supply canonical graph ownership");
      assert.equal(Object.isFrozen(selected), true);
    }
    assert.equal(demand.receivesWritableNative(subject), false);
  }
  assert.equal(demand.storageFor(current.original).kind, "writable", "rejected foreign subjects do not poison admitted storage");
  assert.equal(demand.storageFor(current.untouched).kind, "immutable");
});
