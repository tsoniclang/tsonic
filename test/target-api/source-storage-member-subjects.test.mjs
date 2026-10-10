import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorStorageDemandQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedMember, namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `
      export {};
      class Box {
        items: [object, object][] = [];
        constructor(public value: object, other: object) { value = other; }
        get current(): object { return this.value; }
        set current(next: object) { this.value = next; }
        reset(next: object): void { this.value = next; }
      }
      const original = {}; const replacement = {}; const box = new Box(original, replacement);
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the authored fixture checks without annotations compensating for transport");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  assert.equal(storage.failureReason() === undefined, true);
  return { source, file, storage, box: namedDeclaration(source.ast, file, "Box") };
}

function selected(selection) {
  assert.equal(selection.kind === "resolved", true, "the exact canonical subject exists");
  return selection.subject;
}

test("shared member selection distinguishes physical properties, getter results, methods and parameter bindings", () => {
  const { source, file, storage, box } = fixture();
  const { ast } = source;
  const parameter = requiredNode(ast, box, node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value");
  assert.equal(ast.text(ast.name(parameter)), "value");
  const input = selected(storage.subject(parameter, "input"));
  const binding = selected(storage.subject(parameter, "value"));
  const member = selected(storage.memberSubjectFor(parameter));
  assert.equal(input !== binding && binding !== member && member !== input, true, "one declaration owns three distinct semantic roles");
  assert.equal(member === selected(storage.subject(parameter, "member")), true);
  assert.equal(selected(storage.subjectFor(parameter)) === binding, true, "a local parameter read remains a binding");
  for (const [predicate, kind] of [[ast.is.IsGetAccessorDeclaration, "return"], [ast.is.IsSetAccessorDeclaration, "value"]]) {
    const accessor = ast.members(box).find(predicate);
    assert.equal(selected(storage.memberSubjectFor(accessor)) === selected(storage.subject(accessor, kind)), true);
  }
  const method = namedMember(ast, box, "reset");
  const field = namedMember(ast, box, "items");
  assert.equal(selected(storage.memberSubjectFor(method)) === selected(storage.subject(method, "value")), true);
  assert.equal(selected(storage.memberSubjectFor(field)) === selected(storage.subject(field, "member")), true);
  const variable = namedVariable(ast, file, "original");
  const other = ast.parameters(ast.members(box).find(ast.is.IsConstructorDeclaration))[1];
  for (const node of [variable, other, box, fixture().box]) {
    assert.equal(storage.memberSubjectFor(node).kind, "unresolved", "only an exact checked member is admitted");
  }
});

test("canonical Error carrier queries preserve entry versus local binding roles and projected member identities", () => {
  const { source, file, storage, box } = fixture();
  const { ast } = source;
  const parameter = requiredNode(ast, box, node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value");
  const input = selected(storage.subject(parameter, "input"));
  const binding = selected(storage.subject(parameter, "value"));
  const protocol = { fields: [], constructors: [], stackCaptures: [], storageMutators: [], retention: () => ({ kind: "ordinary" }) };
  const demand = createSourceErrorStorageDemandQuery(source, protocol, storage);
  const original = Node_Initializer(ast, namedVariable(ast, file, "original"));
  const replacement = Node_Initializer(ast, namedVariable(ast, file, "replacement"));
  const entries = demand.storageOriginsFor(input);
  const locals = demand.storageOriginsFor(binding);
  assert.equal(entries.kind === "resolved" && locals.kind === "resolved", true);
  assert.equal(entries.origins.some(origin => origin.node === original), true);
  assert.equal(entries.origins.some(origin => origin.node === replacement), false, "rebinding is not an entry-input producer");
  assert.equal(locals.origins.some(origin => origin.node === original) && locals.origins.some(origin => origin.node === replacement), true,
    "the identical Node cannot erase the mutable binding's distinct producer set");
  const field = namedMember(ast, box, "items");
  const projection = [{ kind: "array-element" }, { kind: "tuple-element", index: 1 }];
  const projected = selected(storage.subject(field, "member", projection));
  assert.equal(selected(storage.storageSubjectFor(field, projection)) === projected, true);
  assert.equal(projected.kind, "member");
  assert.equal(Object.isFrozen(projected) && Object.isFrozen(projected.projection), true);
  assert.equal(demand.storageFor(projected).kind, "immutable");
  assert.equal(storage.failureReason() === undefined, true);
});
