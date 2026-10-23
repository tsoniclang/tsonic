import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { jsSourceCallStorageEffect } from "../../packages/js-source-profile/dist/identities/storage-effects.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], undefined, { call(node, selected) {
    const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
    const owner = declaration === undefined ? undefined : source.ast.parent(declaration);
    return jsSourceCallStorageEffect({ ownerName: owner === undefined ? "" : source.ast.text(source.ast.name(owner)),
      memberName: declaration === undefined ? "" : source.ast.text(source.ast.name(declaration)) }, selected);
  } });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const subject = name => {
    const selected = storage.subjectFor(initializer(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact checked subject`);
    return selected.subject;
  };
  const inputs = name => {
    const selected = subject(name);
    const bindings = storage.bindingsForLexicalOwner(selected.node);
    assert.equal(bindings.kind === "resolved", true, `${name}: original caller context`);
    return storage.generatorThrowInputsFor(selected, bindings.bindings);
  };
  return { source, storage, initializer, subject, inputs };
}

for (const indirect of [false, true]) {
  test(`throw inputs retain the original generator creation across aliases and separate factory activations (${indirect})`, () => {
    const current = fixture(`
      function* values(): Generator<number, void, unknown> { try { yield 0; } catch {} }
      function create() { return values(); }
      const original = {}; const separate = {};
      const first = ${indirect ? "create()" : "values()"};
      const second = ${indirect ? "create()" : "values()"};
      const alias = first;
      alias.throw(original); second.throw(separate);
    `);
    for (const [name, original] of [["first", "original"], ["second", "separate"], ["alias", "original"]]) {
      const selected = current.inputs(name);
      assert.equal(selected.kind === "complete", true, `${name}: ${selected.reason ?? selected.kind}`);
      assert.equal(selected.producers.length === 1 && selected.producers[0].subject.node === current.initializer(original), true,
        `${name}: only that original created object's actual throw input`);
    }
  });
}

test("unknown phase contributes the actual input to both suspended catch and caller error MAY sets", () => {
  const current = fixture(`
    const original = {};
    function* values(): Generator<number, void, unknown> { try { yield 0; } catch (caught) { const received = caught; } }
    function run(started: boolean): void {
      const created = values();
      if (started) created.next();
      try { created.throw(original); } catch (caught) { const propagated = caught; }
    }
    run(true); run(false);
  `);
  for (const name of ["received", "propagated"]) {
    const selected = current.storage.closedOriginsFor(current.subject(name));
    assert.equal(selected.kind === "complete", true, `${name}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("original")), true,
      `${name}: MAY includes original; never proof that this route executes`);
  }
});

test("an unthrown local generator has an empty throw-input set rather than a fabricated error carrier", () => {
  const current = fixture(`function* values(): Generator<number, void, unknown> { yield 0; }
    const created = values(); created.next();`);
  const selected = current.inputs("created");
  assert.equal(selected.kind === "complete", true, selected.reason ?? selected.kind);
  assert.equal(selected.producers.length, 0, "no throw-in does not invent a TsonicError or E slot");
});

test("an unchecked generator boundary cannot claim a closed inventory of throw inputs", () => {
  const current = fixture(`declare function escape(value: Generator<number, void, unknown>): void;
    function* values(): Generator<number, void, unknown> { yield 0; }
    const created = values(); escape(created);`);
  assert.equal(current.inputs("created").kind !== "complete", true, "outside calls remain unresolved or open");
});

test("an external generator parameter never acquires an invented creation or body", () => {
  const current = fixture(`export function observe(value: Generator<number, void, unknown>): void {
    const external = value; external.throw({});
  }`);
  assert.equal(current.inputs("external").kind !== "complete", true, "unchecked original frame remains open");
});
