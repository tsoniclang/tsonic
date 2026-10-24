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

for (const [label, declarations, inspected, opaque] of [
  ["prefix index remap", "const original = make(7); const copied = { aaa: 3, ...original };", "original", false],
  ["immutable aliases", "const original = make(7); const first = original; const alias = first; const copied = { aaa: 3, ...alias };", "alias", false],
  ["repeated spreads", "const original = make(7); const first = { aaa: 3, ...original }; const copied = { bbb: 5, ...first };", "first", false],
  ["opaque mutation before copying", "const original = make(7); opaque(original); const copied = { aaa: 3, ...original };", "original", true],
  ["opaque mutation through an alias", "const original = make(7); const alias = original; opaque(alias); const copied = { aaa: 3, ...alias };", "alias", true],
]) {
  test(`checked method spreads consume exact original slots without inventing external exposure for ${label}`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
      compilerOptions: { strict: true, target: "es2022", module: "esnext" },
      files: { "/src/index.ts": `interface Reader { read(): number; }
        declare function opaque(value: Reader): void;
        function make(value: number): Reader { return { read(): number { return value; } }; }
        export function run(): number { ${declarations} return copied.aaa + copied.read(); }` },
    }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "the exact original copied-method source checks");
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    const storage = createSourceStorageQuery(source, [file]);
    const declaration = namedVariable(source.ast, file, inspected);
    const summary = source.navigation.declarationUseSummary(declaration);
    const observed = summary.uses.map(use => ({ role: use.role,
      parent: source.ast.kindName(source.ast.parent(use.reference)), throughMember: use.throughMember }));
    assert.equal(summary.hasUnclassifiedValueUse, false, `${label}: actual checked use roles ${JSON.stringify(observed)}`);
    const method = namedMember(source.ast, namedDeclaration(source.ast, file, "Reader"), "read");
    const selected = storage.subject(namedVariable(source.ast, file, "copied"), "value",
      [{ kind: "method-value", declaration: method }]);
    assert.equal(selected.kind === "resolved", true, selected.reason ?? "the checked copied method resolves");
    const producers = storage.storageProducersFor(selected.subject, storage.emptyBindings);
    if (opaque) {
      assert.equal(producers.kind === "open" && producers.boundaries.some(boundary => boundary.kind === "opaque-write"), true,
        `${label}: an actual opaque write boundary remains open (${producers.kind}; ${producers.reason ?? ""})`);
      return;
    }
    assert.equal(producers.kind === "complete", true,
      `${label}: ${producers.kind}; ${producers.reason ?? producers.boundaries?.map(boundary => boundary.kind).join(",") ?? ""}`);
    const implementation = requiredNode(source.ast, file, node => source.ast.is.IsMethodDeclaration(node));
    assert.equal(producers.producers.length === 1 && producers.producers[0].subject.node === implementation, true,
      "the actual factory method identity is preserved, not a same-signature alternative");
  });
}

test("checked spread inputs are receiver uses without erasing unclassified value operations", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; function take(...values: number[]): void {}
      const source = [1, 2]; const copied = [...source]; take(...source);
      const unknownUse = {}; void unknownUse;` },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the actual spread and unclassified inputs check");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const summary = source.navigation.declarationUseSummary(namedVariable(source.ast, file, "source"));
  assert.equal(summary.uses.length === 2 && summary.uses.every(use => use.role === "receiver") &&
    !summary.hasUnclassifiedValueUse, true, "only the original array is consumed by both exact spread occurrences");
  assert.equal(source.navigation.declarationUseSummary(namedVariable(source.ast, file, "unknownUse")).hasUnclassifiedValueUse,
    true, "an unrelated unclassified operation is not erased by the spread consumption rule");
});
