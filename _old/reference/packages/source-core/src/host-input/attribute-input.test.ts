import assert from "node:assert/strict";
import { test } from "node:test";
import type { CompilerSession, ExtensionFactSubject, Node } from "@tsonic/tsts";
import { createSourceNodeInventory } from "@tsonic/target-api/host";
import { createSourceCoreAttributeInput } from "./attribute-input.js";
import { tsonicAttributeBuilderFactKey } from "./attribute-facts.js";
import { checkSource, createCleanSourceCoreSession, propertyCallExpression } from "../extension/source-extension.fixtures.js";

function factualFixture(session: CompilerSession) {
  const checked = checkSource(session);
  const inventory = createSourceNodeInventory(checked, checked.programSourceFiles);
  const reads = new Map<ExtensionFactSubject, number>();
  const facts = createSourceCoreAttributeInput({
    checked: { ...checked, sourceFacts: {
      getFact(subject, key) {
        assert.equal(key === tsonicAttributeBuilderFactKey, true, "the one original attribute producer owns the factual read");
        reads.set(subject, (reads.get(subject) ?? 0) + 1);
        return checked.sourceFacts.getFact(subject, key);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: uri => checked.sourceFacts.getVirtualDeclarationDocument(uri),
    } },
    assertNode(node: Node) {
      assert.equal(inventory.contains(node), true, "every factual attribute node belongs to the real checked program");
    },
  });
  return { checked, inventory, reads, facts };
}

test("attribute indexing preserves original finalized identities and visits each source node once", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute } from "@tsonic/core/lang.js";
    class Annotation { constructor(value: string) {} }
    class Subject { run(): void {} }
    attribute<Subject>().add(() => new Annotation("first"));
    attribute<Subject>().method(value => value.run).add(() => new Annotation("second"));
  `);
  const { checked, inventory, reads, facts } = factualFixture(session);
  const nodes = inventory.nodesForFiles([sourceFile]);
  const published = nodes.map(node => facts.attributeBuilder(node));
  for (const [index, node] of nodes.entries()) {
    assert.equal(facts.attributeBuilder(node) === published[index], true, "repeated reads preserve the same immutable publication");
    assert.equal(reads.get(node), 1, "the genuine producer is read once per original node");
  }
  assert.equal(reads.size, nodes.length, "the original complete node inventory is visited once");
  const calls = [0, 1].map(occurrence => propertyCallExpression(session, sourceFile, "add", occurrence));
  const applications = published.filter(result => result.kind === "present" && result.value.kind === "application");
  assert.equal(applications.length, calls.length, "only finalized application records enter the evaluation-ordered inventory");
  for (const [position, call] of calls.entries()) {
    const selected = facts.attributeBuilder(call);
    const original = checked.sourceFacts.getFact(call, tsonicAttributeBuilderFactKey);
    assert.equal(selected === applications[position], true, "source order and exact per-occurrence record identity are preserved");
    assert.equal(selected.kind === "present" && original?.kind === "application" &&
      selected.value.kind === "application" && selected.value.occurrence === call &&
      selected.value.invocation === original.invocation && selected.value.applicationTarget === original.applicationTarget, true,
    "the original target, quoted invocation and finalized application occurrence are not reconstructed");
    assert.equal(Object.isFrozen(selected) && selected.kind === "present" && Object.isFrozen(selected.value), true);
  }
  const selector = propertyCallExpression(session, sourceFile, "method");
  const selected = facts.attributeBuilder(selector);
  const original = checked.sourceFacts.getFact(selector, tsonicAttributeBuilderFactKey);
  assert.equal(selected.kind === "present" && selected.value.kind === "builder-state" &&
    selected.value.occurrence === selector && original?.kind === "builder-state" &&
    selected.value.applicationTarget === original.applicationTarget, true);
  assert.equal(selected.kind === "present" && selected.value.selectedMember.kind === "present" &&
    original?.selectedMemberDeclarations !== undefined &&
    selected.value.selectedMember.value.declarations.length === original.selectedMemberDeclarations.length &&
    selected.value.selectedMember.value.declarations.every((node, index) => node === original.selectedMemberDeclarations?.[index]) &&
    Object.isFrozen(selected.value.selectedMember.value.declarations), true,
  "the complete original member declaration vector remains immutable");
  assert.equal(facts.attributeBuilder(sourceFile).kind, "none");
  assert.equal(Object.isFrozen(facts), true);
  assert.equal(Object.isFrozen(nodes), true);
});

test("attribute indexing preserves source-file order, placement and empty selections", () => {
  const sourceText = `
    import { attribute } from "@tsonic/core/lang.js";
    class Subject { value = ""; }
    function mark(): void {}
    attribute<Subject>().property(value => value.value).add(() => mark());
  `;
  const { session, sourceFile } = createCleanSourceCoreSession(sourceText, { "/src/second.ts": sourceText });
  const { checked, inventory, facts } = factualFixture(session);
  const secondFile = checked.getSourceFile("/src/second.ts");
  assert.equal(secondFile !== undefined, true, "the second original source file is retained");
  if (secondFile === undefined) throw new Error("The original second source file is required.");
  for (const files of [[sourceFile, secondFile], [secondFile, sourceFile]]) {
    const selected = inventory.nodesForFiles(files).map(node => facts.attributeBuilder(node));
    const applications = selected.flatMap(result => result.kind === "present" && result.value.kind === "application" ? [result.value] : []);
    assert.equal(applications.length, files.length);
    for (const [index, file] of files.entries()) {
      const application = applications[index];
      assert.equal(application !== undefined && checked.ast.getSourceFile(application.applicationTarget) === file, true,
        "the caller's complete source-file order is retained");
      assert.equal(application?.applicationPlacement, "declaration");
      const call = propertyCallExpression(session, file, "add");
      const repeated = facts.attributeBuilder(call);
      assert.equal(repeated.kind === "present" && repeated.value === application, true,
        "per-file and per-occurrence reads share the same original immutable record");
    }
  }
  const empty = inventory.nodesForFiles([]);
  assert.equal(empty.length, 0);
  assert.equal(Object.isFrozen(empty), true);
  const none = facts.attributeBuilder(sourceFile);
  assert.equal(none.kind, "none");
  assert.equal(Object.isFrozen(none), true);
});

test("attribute indexing includes finalized applications nested inside an application input", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute } from "@tsonic/core/lang.js";
    class Subject {}
    function mark(callback?: () => void): void {}
    attribute<Subject>().add(() => mark(() => {
      attribute<Subject>().add(() => mark());
    }));
  `);
  const { checked, inventory, facts } = factualFixture(session);
  const applications = inventory.nodesForFiles([sourceFile]).flatMap(node => {
    const selected = facts.attributeBuilder(node);
    return selected.kind === "present" && selected.value.kind === "application" ? [selected] : [];
  });
  assert.equal(applications.length, 2);
  for (const occurrence of [0, 1]) {
    const call = propertyCallExpression(session, sourceFile, "add", occurrence);
    const original = checked.sourceFacts.getFact(call, tsonicAttributeBuilderFactKey);
    const selected = facts.attributeBuilder(call);
    assert.equal(original?.kind === "application" && selected.kind === "present" && selected.value.kind === "application" &&
      selected === applications[occurrence] && selected.value.invocation === original.invocation &&
      selected.value.applicationTarget === original.applicationTarget, true,
    "outer and nested original finalized applications retain source order and exact original associations");
  }
});
