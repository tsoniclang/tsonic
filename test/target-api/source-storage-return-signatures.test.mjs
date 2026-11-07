import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createHostSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/target-analysis/index.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "../../packages/target-api/dist/public/source.js";

// The Host result descriptor of a callable declaration (values.callableReturn), or undefined when refused.
function callableReturn(source, declaration) {
  const outcome = source.facts.values.callableReturn(declaration);
  return outcome.kind === "refused" ? undefined : outcome.type;
}

// The declaration own authored result (its return annotation), as the Host types that type node.
function authoredReturn(source, declaration) {
  const annotation = source.ast.typeNode(declaration);
  assert.equal(annotation !== undefined, true, "the fixture declaration states its own result type");
  const outcome = source.facts.values.type(annotation);
  return outcome.kind === "refused" ? undefined : outcome.type;
}

function callSignatures(type) {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "callable" || structure.kind === "shape" ? structure.calls : [];
}

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `
      export {};
      class Box<Value> {
        get numeric(): number { return 3; }
        set numeric(next: number) { void next; }
        get generic(): Value { throw 0; }
        get callback(): () => number { return () => 3; }
      }
      function choose(value: number): number;
      function choose(value: string): string;
      function choose(value: number | string): number | string { return value; }
      const arrow = (): boolean => true;
    ` } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "real source fixture checks without compensating type annotations");
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = source.navigation.sourceFiles.find(value => source.ast.getFileName(value) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return { source, file, storage, nodes };
}

for (const [name, kind] of [["numeric", "KindGetAccessor"], ["generic", "KindGetAccessor"], ["callback", "KindGetAccessor"]]) {
  test(`shared ${name} getter storage uses its exact checked invocation return Type`, () => {
    const input = fixture();
    const node = input.nodes.find(value => input.source.ast.kindName(value) === kind &&
      input.source.ast.text(input.source.ast.name(value)) === name);
    const returned = callableReturn(input.source, node);
    assert.equal(returned !== undefined && sourceTypeDescriptorsEqual(returned, authoredReturn(input.source, node)), true,
      "the getter result is its own declaration signature result");
    const selected = input.storage.subject(node, "return");
    assert.equal(selected.kind, "resolved");
    const type = input.storage.typeFor(selected.subject);
    assert.equal(type.kind, "resolved");
    assert.equal(sourceTypeDescriptorsEqual(type.type, returned), true, "return subject keeps the exact Host result descriptor");
    assert.equal(sourceTypeDescriptorsEqual(input.storage.typeFor(selected.subject).type, type.type), true);
    assert.equal(input.storage.failureReason() === undefined, true);
  });
}

test("paired accessors never substitute setter or callable payload signatures for getter return evidence", () => {
  const input = fixture();
  const getter = input.nodes.find(node => input.source.ast.is.IsGetAccessorDeclaration(node) &&
    input.source.ast.text(input.source.ast.name(node)) === "numeric");
  const setter = input.nodes.find(node => input.source.ast.is.IsSetAccessorDeclaration(node));
  const getterResult = callableReturn(input.source, getter);
  const setterResult = callableReturn(input.source, setter);
  const returned = input.storage.subject(getter, "return");
  assert.equal(returned.kind, "resolved");
  assert.equal(getterResult !== undefined && setterResult !== undefined && !sourceTypeDescriptorsEqual(getterResult, setterResult), true);
  const type = input.storage.typeFor(returned.subject);
  assert.equal(type.kind, "resolved");
  assert.equal(sourceTypeDescriptorsEqual(type.type, getterResult), true);
  assert.equal(callSignatures(getterResult).length, 0, "a scalar payload is not a getter function");
  const callback = input.nodes.find(node => input.source.ast.is.IsGetAccessorDeclaration(node) &&
    input.source.ast.text(input.source.ast.name(node)) === "callback");
  const payloadSignatures = callSignatures(callableReturn(input.source, callback));
  assert.equal(payloadSignatures.length, 1);
  assert.equal(payloadSignatures[0].declaration === callback, false);
});

test("ordinary and overloaded callable return subjects retain exact declaration correspondence", () => {
  const input = fixture();
  const declarations = input.nodes.filter(node => input.source.ast.is.IsFunctionDeclaration(node) || input.source.ast.is.IsArrowFunction(node));
  assert.equal(declarations.length, 5);
  for (const declaration of declarations) {
    const returned = callableReturn(input.source, declaration);
    assert.equal(returned !== undefined && sourceTypeDescriptorsEqual(returned, authoredReturn(input.source, declaration)), true,
      "each overload and arrow result is its own declaration signature result, not another overload");
    const selected = input.storage.subject(declaration, "return");
    assert.equal(selected.kind, "resolved");
    const type = input.storage.typeFor(selected.subject);
    assert.equal(type.kind, "resolved");
    assert.equal(sourceTypeDescriptorsEqual(type.type, returned), true, "exact overload/arrow return, no property-value scan");
  }
});
