import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, namedVariable, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(body) {
  const checked = await checkedSource("checked-projections", {
    "globals.d.ts": `interface Object {} interface Function {} interface CallableFunction extends Function {}
interface NewableFunction extends Function {} interface IArguments {} interface Boolean {} interface Number {}
interface String {} interface RegExp {} interface Array<Value> { [index: number]: Value; length: number; }
interface ReadonlyArray<Value> { readonly [index: number]: Value; readonly length: number; }`,
    "src/index.ts": `export {}; ${body}`,
  });
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const selection = name => {
    const subject = storage.subjectFor(namedVariable(source.ast, file, name));
    assert.equal(subject.kind, "resolved", `checked subject ${name}`);
    return storage.closedOriginsFor(subject.subject);
  };
  return { storage, selection, source, file };
}

for (const [name, fields, path] of [
  ["member", "payload: { token: object } = { token: {} };", "payload"],
  ["nested", "box = { payload: { token: {} } };", "box.payload"],
  ["indexed", "items: { token: object }[] = [];", "items[0]"],
]) {
  test(`a symbolic checked ${name} read preserves its checked type and actual store`, async () => {
    const current = await fixture(`
      class Root {}
      class Cell extends Root { ${fields} }
      const original = {};
      const backing = { token: original };
      export function inspect(value: Root): object | undefined {
        if (value instanceof Cell) {
          value.${path} = backing;
          const selected = value.${path}.token;
          return selected;
        }
        return undefined;
      }
    `);
    const selected = current.selection("selected");
    assert.equal(selected.kind, "open", selected.kind === "unresolved" ? selected.reason
      : `${name}: a checked symbolic read keeps its outside frontier`);
    const original = current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast, current.file, "original")).Initializer;
    assert.equal(selected.origins.some(origin => origin.subject.node === original), true,
      `${name}: the actual authored write remains one original producer`);
    assert.equal(current.storage.failureReason(), undefined, `${name}: no raw-formal component failure`);
  });
}

test("a concrete failed nominal guard cannot publish an unexecuted backing store", async () => {
  const current = await fixture(`
    class Root {}
    class Cell extends Root { payload: { token: object } = { token: {} }; }
    declare function consume(value: Root): void;
    const backing = { token: {} };
    function leak(value: Root): void {
      if (value instanceof Cell) value.payload = backing;
      consume(value);
    }
    leak(new Root());
    const selected = backing.token;
  `);
  assert.equal(current.selection("selected").kind, "complete", "checked views do not fabricate a Cell allocation");
  assert.equal(current.storage.failureReason(), undefined);
});

test("a checked narrowed receiver store publishes its exact physical backing", async () => {
  const current = await fixture(`
    class Root {}
    class Cell extends Root { payload: { token: object } = { token: {} }; }
    declare function consume(value: Root): void;
    const original = {};
    const backing = { token: original };
    export function leak(value: Root): void {
      if (value instanceof Cell) value.payload = backing;
      consume(value);
    }
    const selected = backing.token;
  `);
  const selected = current.selection("selected");
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-write"),
    true, "the source guard retains the actual store's checked member and outside exposure");
  assert.equal(current.storage.failureReason(), undefined, "a narrowed source demand stays finite");
});

for (const [name, fields, statement] of [
  ["indexed member", "payload: { token: object } = { token: {} };", "if (value instanceof Cell) value['payload'] = backing;"],
  ["alias", "payload: { token: object } = { token: {} };", "const alias = value; if (alias instanceof Cell) alias.payload = backing;"],
  ["nested member", "box = { payload: { token: {} } };", "if (value instanceof Cell) value.box.payload = backing;"],
  ["array element", "items: { token: object }[] = [];", "if (value instanceof Cell) value.items[0] = backing;"],
]) {
  test(`checked ${name} projections retain stores without merging private identities`, async () => {
    const current = await fixture(`
      class Root {}
      class Cell extends Root { ${fields} }
      declare function consume(value: Root): void;
      const backing = { token: {} };
      const separate = { token: {} };
      export function leak(value: Root): void { ${statement} consume(value); }
      const selected = backing.token;
      const privateValue = separate.token;
    `);
    const selected = current.selection("selected");
    assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "opaque-write"),
      true, `${name}: the actual stored backing escapes`);
    assert.equal(current.selection("privateValue").kind, "complete", `${name}: unrelated creation stays closed`);
    assert.equal(current.storage.failureReason(), undefined, `${name}: exact checked path completes`);
  });
}
