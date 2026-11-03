import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageQuery } from "@tsonic/target-api/analysis";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { cleanMemorySession, memoryCalls } from "../memory-layout/testing/fixtures.js";
import { createTsonicPointerStorageRelation } from "./storage-relation.js";
import { tsonicRawMemoryOperationFactKey } from "./raw-memory/facts.js";

for (const [form, ending] of [["implicit fallthrough", ""], ["explicit bare return", "return;"]] as const) {
  test(`pointer storage preserves ${form} absence for both declaration and actual call`, () => {
    const checked = cleanMemorySession(`
      import { allocateptr } from "@tsonic/core/lang.js";
      export function maybe(flag: boolean) { if (flag) return allocateptr<uint32>(7); ${ending} }
      torawptr(maybe(true), uint32Layout);
    `);
    const source = createTargetSourceProgram(checked);
    const storage = createSourceStorageQuery(source, source.sourceFiles);
    const relation = createTsonicPointerStorageRelation(source, storage);
    const declaration = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "maybe");
    assert.equal(declaration !== undefined, true);
    if (declaration === undefined) return;
    const returned = relation.returned(declaration);
    const call = memoryCalls(checked, "torawptr")[0]!;
    const operation = source.sourceFacts.getFact(call, tsonicRawMemoryOperationFactKey);
    assert.equal(operation?.operation, "to-raw");
    if (operation?.operation !== "to-raw") return;
    const value = relation.value(operation.pointerExpression);
    for (const selected of [returned, value]) {
      assert.equal(selected.kind, "complete");
      if (selected.kind !== "complete") return;
      assert.equal(selected.includesAbsence, true);
      assert.equal(selected.producers.length, 1);
      assert.equal(selected.producers[0]!.operation.operation, "allocate");
    }
  });
}

test("pointer storage does not invent fallthrough absence for a complete return", () => {
  const checked = cleanMemorySession(`
    import { allocateptr } from "@tsonic/core/lang.js";
    export function make() { return allocateptr<uint32>(7); }
  `);
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const declaration = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "make");
  assert.equal(declaration !== undefined, true);
  if (declaration === undefined) return;
  const selected = createTsonicPointerStorageRelation(source, storage).returned(declaration);
  assert.equal(selected.kind, "complete");
  if (selected.kind !== "complete") return;
  assert.equal(selected.includesAbsence, false);
  const activation = storage.boundActivationsFor(declaration, selected.producers[0]!.storage.bindings);
  assert.equal(activation.kind === "resolved" && activation.activations.length === 1 &&
    activation.activations[0]!.kind === "declaration", true,
  "The pointer producer retains the canonical declaration activation, not an empty or invented call frame.");
});
