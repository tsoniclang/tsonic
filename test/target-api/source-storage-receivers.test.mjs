import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createHostSourceProgram } from "../../packages/target-api/dist/public/host.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { sourceStorageSubjectType } from "../../packages/target-api/dist/target-analysis/source-storage/model/components.js";
import { sourceTypeDescriptorsEqual } from "../../packages/target-api/dist/public/source.js";

const resolved = outcome => outcome.kind === "refused" ? undefined : outcome.type;
// Whether a Host type exposes a member with this name (facts.objects).
const hasMember = (source, type, name) => {
  const members = source.facts.objects.members(type);
  return Array.isArray(members) && members.some(member => member.name === name);
};

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `
      export {};
      interface Shape<Value> { count: Value; read(): Value; }
      function make<Value>(count: Value): Shape<Value> {
        return { count, read(): Value { const captured = () => this.count; return captured(); } };
      }
      const plain = { count: 7, readPlain(): number { return this.count; },
        get observed(): number { return this.count; }, set observed(value: number) { this.count = value; } };
      function explicit(this: { count: string }): string { return this.count; }
      function absent(): void {}
      class Counter { count = 1; static total = 2;
        readClass(): number { return this.count; }
        static readStatic(): number { return this.total; }
        get current(): number { return this.count; }
      }
    ` } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "all checked receiver fixtures are valid");
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts });
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  assert.equal(storage.failureReason(), undefined);
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(file);
  const named = name => nodes.find(node => source.ast.name(node) !== undefined && source.ast.text(source.ast.name(node)) === name &&
    (source.ast.is.IsMethodDeclaration(node) || source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsGetAccessorDeclaration(node)));
  const receiver = node => storage.subject(node, "receiver");
  return { source, storage, nodes, named, receiver };
}

test("implicit and contextual generic object methods retain the exact checked receiver type", () => {
  const current = fixture();
  for (const name of ["read", "readPlain", "observed"]) {
    const node = current.named(name);
    const element = current.source.facts.selections.objectLiteralElement(node);
    assert.equal(element !== undefined, true, name + " exact checked element");
    const subject = current.receiver(node);
    assert.equal(subject.kind, "resolved");
    const type = current.storage.typeFor(subject.subject);
    assert.equal(type.kind, "resolved", type.reason);
    const literal = resolved(current.source.facts.values.type(element.objectLiteral));
    assert.equal(literal !== undefined && sourceTypeDescriptorsEqual(type.type, literal), true);
    assert.equal(type.type.kind === "intrinsic" && type.type.intrinsic === "any", false, "a method symbol is not the receiver type");
    assert.equal(hasMember(current.source, type.type, "count"), true, "the receiver exposes its exact field");
  }
});

test("explicit, lexical arrow, instance and static receivers keep their distinct checker roles", () => {
  const current = fixture();
  const explicit = current.named("explicit");
  const receiverType = node => {
    const subject = current.receiver(node);
    assert.equal(subject.kind, "resolved");
    const selected = current.storage.typeFor(subject.subject);
    assert.equal(selected.kind, "resolved", selected.reason);
    return selected.type;
  };
  const thisParameter = current.source.ast.parameters(explicit)[0];
  assert.equal(sourceTypeDescriptorsEqual(receiverType(explicit), resolved(current.source.facts.values.type(thisParameter))), true);
  const arrow = current.nodes.find(node => current.source.ast.is.IsArrowFunction(node));
  assert.equal(sourceTypeDescriptorsEqual(receiverType(arrow), receiverType(current.named("read"))), true);
  for (const [name, field] of [["readClass", "count"], ["current", "count"], ["readStatic", "total"]]) {
    assert.equal(hasMember(current.source, receiverType(current.named(name)), field), true, name);
  }
});

test("missing and foreign receiver evidence never falls back to the method symbol or another object", () => {
  const current = fixture();
  assert.equal(sourceStorageSubjectType(current.source, { node: current.named("absent"), kind: "receiver", projection: [] }) === undefined, true);
  const method = current.named("read");
  const foreign = current.source.facts.selections.objectLiteralElement(current.named("readPlain"));
  const source = { ...current.source, facts: { ...current.source.facts,
    selections: { ...current.source.facts.selections, objectLiteralElement: () => foreign } } };
  assert.equal(sourceStorageSubjectType(source, { node: method, kind: "receiver", projection: [] }) === undefined, true);
});
