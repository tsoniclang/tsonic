import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedMember, namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `
      export {};
      interface Base { read(value: number): number; }
      interface Shape extends Base { count: number; }
      function make(seed: number): Shape {
        return { count: seed, read(value: number): number { return value + this.count; } };
      }
      function property(callback: (value: number) => number): Shape {
        return { count: 1, read: callback };
      }
      function pass(input: Shape): Shape { const alias = input; return alias; }
      const first = make(3);
      const second = make(7);
      const forwarded = pass(first);
      const selected = property(value => value * 2);
      class Accessor { get read(): (value: number) => number { return value => value; } }
      const accessor = new Accessor();
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the unchanged authored program checks");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  assert.equal(storage.failureReason(), undefined);
  const method = namedMember(source.ast, namedDeclaration(source.ast, file, "Base"), "read");
  const projection = [{ kind: "method-value", declaration: method }];
  const subject = (node, kind = "value", path = projection) => {
    const selected = storage.subject(node, kind, path);
    assert.equal(selected.kind, "resolved", selected.reason ?? "the method-value subject resolves exactly");
    return selected.subject;
  };
  return { source, file, storage, method, projection, subject };
}

test("method-value subjects retain exact inherited declaration identity and a distinct checked property role", () => {
  const { source, file, storage, method, subject } = fixture();
  const declaration = namedDeclaration(source.ast, file, "make");
  const selected = subject(declaration, "return");
  assert.equal(subject(declaration, "return") === selected, true);
  const type = storage.typeFor(selected);
  assert.equal(type.kind, "resolved", type.reason);
  assert.equal(source.semantics.forFile(file).types.callSignatures(type.type).length, 1);
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.projection[0]), true);
  assert.equal(storage.subject(declaration, "return", [{ kind: "member", declaration: method }]).kind, "unresolved");
  const count = namedMember(source.ast, namedDeclaration(source.ast, file, "Shape"), "count");
  assert.equal(storage.subject(declaration, "return", [{ kind: "method-value", declaration: count }]).kind, "unresolved");
});

test("returned method values and aliases retain their own factory activation rather than the interface implementation set", () => {
  const { source, file, storage, subject } = fixture();
  const implementation = requiredNode(source.ast, file, node => source.ast.is.IsMethodDeclaration(node));
  const producers = name => {
    const selected = storage.storageProducersFor(subject(namedVariable(source.ast, file, name)), storage.emptyBindings);
    assert.equal(selected.kind, "complete", selected.reason ?? "the factory has a complete exact method producer");
    assert.equal(selected.producers.length, 1);
    assert.equal(selected.producers[0].subject.node === implementation, true);
    return selected.producers[0];
  };
  const first = producers("first");
  const second = producers("second");
  const forwarded = producers("forwarded");
  assert.equal(first.bindings === second.bindings, false, "independent construction frames remain distinct");
  const seed = source.ast.parameters(namedDeclaration(source.ast, file, "make"))[0];
  const input = storage.subject(seed, "input");
  assert.equal(input.kind, "resolved");
  const origins = producer => {
    const selected = storage.boundOriginsFor(input.subject, producer.bindings);
    assert.equal(selected.kind, "resolved", selected.reason);
    return selected.subjects.map(subject => subject.node);
  };
  const firstOrigins = origins(first);
  const secondOrigins = origins(second);
  assert.equal(firstOrigins.length === 1 && secondOrigins.length === 1, true);
  assert.equal(firstOrigins[0] === secondOrigins[0], false, "actual selected inputs are not joined across factories");
  assert.equal(origins(forwarded)[0] === firstOrigins[0], true, "alias transport preserves the original input");
});

test("a checked function-valued property supplying a method preserves its selected callback origin", () => {
  const { source, file, storage, subject } = fixture();
  const selected = storage.storageProducersFor(subject(namedVariable(source.ast, file, "selected")), storage.emptyBindings);
  assert.equal(selected.kind, "complete", selected.reason ?? "the selected callback producer is complete");
  const callback = requiredNode(source.ast, file, node => source.ast.is.IsArrowFunction(node) &&
    source.ast.is.IsCallExpression(source.ast.parent(node)));
  assert.equal(selected.producers.length === 1 && selected.producers[0].subject.node === callback, true);
});

test("formal method projections stay symbolic instead of selecting a known equal-signature implementation", () => {
  const { source, file, storage, subject } = fixture();
  const formal = source.ast.parameters(namedDeclaration(source.ast, file, "pass"))[0];
  const input = subject(formal, "input");
  const scope = storage.bindingsForDeclaration(namedDeclaration(source.ast, file, "pass"));
  assert.equal(scope.kind, "resolved", scope.reason);
  const selected = storage.boundOriginsFor(input, scope.bindings);
  assert.equal(selected.kind, "resolved", selected.reason);
  assert.equal(selected.subjects.length === 1 && selected.subjects[0] === input, true);
});

test("foreign declarations and accessor execution cannot be invented by a passive method-value projection", () => {
  const current = fixture();
  const foreign = fixture();
  const declaration = namedDeclaration(current.source.ast, current.file, "make");
  assert.equal(current.storage.subject(declaration, "return", [{ kind: "method-value", declaration: foreign.method }]).kind, "unresolved");
  const getter = namedMember(current.source.ast, namedDeclaration(current.source.ast, current.file, "Accessor"), "read");
  const accessor = namedVariable(current.source.ast, current.file, "accessor");
  assert.equal(current.storage.subject(accessor, "value", [{ kind: "method-value", declaration: getter }]).kind, "unresolved");
});
