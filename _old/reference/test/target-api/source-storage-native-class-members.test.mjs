import assert from "node:assert/strict";
import test from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { checkedSource, namedDeclaration, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(name, registered = true) {
  const checked = await checkedSource(name, {
    "globals.d.ts": `
      interface Object {} interface Function {} interface CallableFunction extends Function {}
      interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
      interface Number {} interface String {} interface RegExp {}
      interface Array<Value> { [index: number]: Value; length: number; }
    `,
    "src/native.d.ts": `
      export declare class Native<Value> {
        constructor(value: Value);
        constructor(value: Value, label: string);
        readonly value: Value;
        readonly label: string;
      }
    `,
    "src/index.ts": `
      import { Native } from "./native.js";
      export class Derived extends Native<{ readonly token: object }> {
        constructor(value: { readonly token: object }) { super(value); }
      }
    `,
  });
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const nativeFile = projectSourceFile(source, "src/native.d.ts");
  const native = namedDeclaration(source.ast, nativeFile, "Native");
  const derived = namedDeclaration(source.ast, file, "Derived");
  const constructors = source.ast.members(native).filter(source.ast.is.IsConstructorDeclaration);
  const field = source.ast.members(native).find(member => source.ast.text(source.ast.name(member)) === "value");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const subject = transport.subject(derived);
  const bindings = transport.substitutions.forLexicalOwner(derived);
  const destination = source.semantics.forNode(derived).declarations.declaredType(derived);
  assert.equal(subject !== undefined && bindings !== undefined && destination !== undefined && field !== undefined, true,
    "the actual checked class receiver, scope, field and instance contract exist");
  const lineages = sourceStorageClassLineages(source, budget, new Set([{ subject, bindings }]), {
    subjectFor: transport.subjectFor,
    nativeConstructorsFor: selected => registered && selected.node === native ? constructors : undefined,
    valuesFor(selected, bindings) {
      assert.equal(selected.node === native && selected.projection.length === 0, true,
        "the direct checked heritage selects the original native class value");
      return new Set([{ subject: selected, bindings }]);
    },
  }, "heritage");
  assert.equal(lineages?.length, 1, "one checked heritage alternative");
  return { source, budget, transport, constructors, native, derived, field, destination, lineage: lineages[0] };
}

test("native class constructor members use the checked instance receiver across every overload", async () => {
  const current = await fixture("native-class-member-receiver");
  const { source, transport, lineage } = current;
  assert.equal(lineage.complete, true, "the explicit native terminal closes the checked heritage");
  assert.equal(lineage.nativeBase?.subject.node === current.native, true, "the terminal is the actual provider class");
  assert.equal(lineage.nativeBase.constructors.length, 2, "both original constructor declarations are retained");
  assert.equal(source.navigation.isProjectDeclaration(current.native), false, "the native declaration is not an authored body");
  const selected = transport.memberFlow.membersInLineage(lineage, current.field, current.destination);
  assert.equal(selected !== undefined && !selected.absent && selected.members.length === 1, true,
    "the generic member correspondence selects one actual native physical field");
  assert.equal(selected.members[0].declaration === current.field, true, "the physical declaration identity is unchanged");
  assert.equal(selected.members[0].bindings === lineage.nativeBase.bindings, true, "the native creation context is retained");
  assert.equal(current.budget.failure(), undefined, "the original finite work budget remains active");
});

test("native class member selection rejects missing, source-bodied and foreign constructor evidence", async () => {
  const current = await fixture("native-class-member-current");
  const foreign = await fixture("native-class-member-foreign");
  const unknown = await fixture("native-class-member-unknown", false);
  assert.equal(unknown.lineage.complete, false, "declared shape alone cannot supply the missing native terminal");
  assert.equal(unknown.transport.memberFlow.membersInLineage(unknown.lineage, unknown.field, unknown.destination) === undefined, true,
    "unknown native construction stays unproven");
  const sourceConstructor = current.source.ast.members(current.derived).find(current.source.ast.is.IsConstructorDeclaration);
  assert.equal(sourceConstructor !== undefined, true, "the inverse has its actual source constructor body");
  for (const [name, constructors] of [
    ["empty", []],
    ["source body", [sourceConstructor]],
    ["foreign", foreign.constructors],
    ["mixed", [...current.constructors, ...foreign.constructors]],
  ]) {
    const selected = current.transport.memberFlow.membersInLineage({ ...current.lineage,
      nativeBase: { ...current.lineage.nativeBase, constructors } }, current.field, current.destination);
    assert.equal(selected === undefined, true, `${name}: every original constructor must prove the same checked native owner`);
  }
  current.budget.reject("test native class finite refusal");
  assert.equal(current.transport.memberFlow.membersInLineage(current.lineage, current.field, current.destination) === undefined, true,
    "the same finite refusal is not bypassed");
});
