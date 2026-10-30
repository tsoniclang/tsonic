import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@tsonic/tsts";
import type { SourceStorageBindings } from "../source-storage/model/types.js";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits } from "./contracts.js";
import { createSourceDeclarationOwnershipQuery } from "./query.js";
import { fixture } from './recursive-retention-fixtures.js';

for (const reverse of [false, true]) {
  for (const [kind, owner, callee] of [
    ["returned-alias", "Adoption", "returned"],
    ["awaited-member", "AwaitedAdoption", "awaited"],
    ["recursive-return", "RecursiveAdoption", "recursiveAdopt"],
    ["getter-return", "GetterAdoption", "returned"],
    ["conditional-return", "ConditionalAdoption", "returned"],
  ]) {
    test(`${kind} prepares its caller-owned Promise producer before the SCC, reverse=${reverse}`, () => {
      for (const borrowed of [false, true]) {
        for (const producerFirst of [false, true]) {
          const current = fixture(reverse, "self");
          const root = current.declaration(`${borrowed ? "borrowed" : "owned"}${owner}`);
          const call = (name: string) => current.storage.nodes.find(node =>
            current.source.ast.is.IsCallExpression(node) &&
            current.selectedDeclaration(node) === current.declaration(name) &&
            current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
          const adopted = call(callee!);
          const produced = call("produced");
          assert.equal(adopted !== undefined && produced !== undefined, true, "the actual adopter and separate caller factory");
          if (producerFirst) {
            const first = current.query.continuationFor(produced!);
            assert.equal(first.kind, "resolved", first.kind === "unresolved" ? first.reason
              : "prewarming the producer's closure is a control, not a required execution order");
          }
          const selected = current.query.forCall(adopted!);
          assert.equal(selected.kind === "resolved" && selected.decision === (borrowed ? "rejected" : "admitted"), true,
            selected.kind === "unresolved" ? selected.reason
              : `${kind}: borrowed=${borrowed}, producerFirst=${producerFirst}, decision=${selected.kind === "resolved" ? selected.decision : selected.kind}`);
          if (selected.kind === "resolved" && borrowed) {
            assert.equal(selected.decision === "rejected" && selected.diagnostic.at === adopted &&
              selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", true,
            "the caller factory's actual loan survives aliases, member projections and recursive adoption");
          }
          assert.equal(current.budget.failure() === undefined, true, "the actual finite graph closes within its unchanged budget");
        }
      }
    });
  }
  test(`a formal Promise adopter remains independent of unrelated caller factories, reverse=${reverse}`, () => {
    const current = fixture(reverse, "self");
    const root = current.declaration("formalAdoption");
    const call = current.storage.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === current.declaration("returned") &&
      current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
    assert.equal(call !== undefined, true, "the exact formal-to-formal result demand");
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
      selected.kind === "unresolved" ? selected.reason : "the native formal contract retains its real bound input");
  });
  test(`a fresh isolated adopter prepares the caller's zero-argument Promise factory, reverse=${reverse}`, () => {
    const current = fixture(reverse, "self");
    const root = current.declaration("plainRoot");
    const call = current.storage.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === current.declaration("returned") &&
      current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
    assert.equal(call !== undefined, true, "the exact independently queried adopter call");
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
      selected.kind === "unresolved" ? selected.reason : "a caller-owned nonlocal factory is prepared before evaluation");
  });
}

for (const recursive of ["self", "mutual"] as const) {
  for (const reverse of [false, true]) {
    test(`${recursive} continuation components retain owned and concrete borrowed facts, reverse=${reverse}`, () => {
      const current = fixture(reverse, recursive);
      const owned = current.query.forCall(current.callIn("ownedRoot"));
      assert.equal(owned.kind === "resolved" && owned.decision === "admitted", true,
        owned.kind === "unresolved" ? owned.reason : "owned recursion closes without empty fallback");
      const call = current.callIn("borrowedRoot");
      const borrowed = current.query.forCall(call);
      assert.equal(borrowed.kind === "resolved" && borrowed.decision === "rejected" &&
        borrowed.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && borrowed.diagnostic.at === call,
      true, borrowed.kind === "unresolved" ? borrowed.reason : "recursive lease remains tied to the actual escaping call");
      assert.equal(current.budget.failure() === undefined, true, "canonical finite contexts converge under the unchanged budget");
    });
  }
}

test("a recursive component never publishes its private bottom after budget exhaustion", () => {
  const current = fixture(false, "mutual");
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceDeclarationOwnershipBudget(current.nodes[0]!, { ...defaultSourceDeclarationOwnershipLimits, ...limits });
    const selected = createSourceDeclarationOwnershipQuery({ ...current, budget }).continuationFor(current.callIn("borrowedRoot"));
    assert.equal(selected.kind, "unresolved", "exhaustion precedes all publication");
    assert.equal(Object.prototype.hasOwnProperty.call(selected, "dependencies"), false, "no provisional owned/empty summary escapes");
    assert.equal(budget.failure() !== undefined, true, "one canonical budget owns the failure");
  }
});

test("a continuation context refusal retains its own reason and cannot poison a later independent query", () => {
  const current = fixture(false, "self");
  const call = current.callIn("ownedRoot");
  const context = current.storage.bindingsForLexicalOwner(call);
  assert.equal(context.kind, "resolved", "the actual invocation owns its canonical bindings");
  if (context.kind !== "resolved") return;
  const rejected = current.query.continuationFor(fixture(false, "self").callIn("ownedRoot"));
  assert.equal(rejected.kind === "unresolved" && typeof rejected.reason === "string" && rejected.reason.length > 0, true,
    "a refused copied context never becomes an undefined budget reason");
  const selected = current.query.forCall(call);
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
    selected.kind === "unresolved" ? selected.reason : "an earlier context failure is not an independent invocation's result");
  assert.equal(current.budget.failure() === undefined, true, "a semantic context refusal does not manufacture budget exhaustion");
});

test("canonical context keys preserve actual activations, substitutions and foreign-query rejection", () => {
  const current = fixture(false, "self");
  const { source, storage, declaration, selectedDeclaration } = current;
  const owner = declaration("allocate");
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) && selectedDeclaration(node) === owner);
  assert.equal(calls.length, 2, "two genuine invocations of the same allocator body");
  const allocation = storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node) &&
    storage.enclosingRegionFor(node) === source.ast.body(owner));
  assert.equal(allocation !== undefined, true, "one exact source allocation site");
  const subject = storage.subjectFor(allocation!);
  assert.equal(subject.kind, "resolved", "canonical allocation subject");
  const selections = calls.map(call => {
    const caller = storage.bindingsForLexicalOwner(call);
    assert.equal(caller.kind, "resolved", "owned allocator caller context");
    const bindings = caller.kind === "resolved" ? storage.bindingsForInvocation(owner, call, caller.bindings) : caller;
    assert.equal(bindings.kind, "resolved", "owned allocator invocation context");
    return bindings.bindings;
  });
  const keys = selections.map(selection => storage.contextKeyFor([subject.subject], selection));
  assert.equal(keys[0]?.kind === "resolved" && keys[1]?.kind === "resolved" && keys[0].key !== keys[1].key, true,
    "the same allocation source site has distinct actual invocation identities");
  const empty = storage.contextKeyFor([], storage.emptyBindings);
  const copied = storage.contextKeyFor([subject.subject], { ...storage.emptyBindings });
  const foreign = fixture(false, "self");
  const foreignSubject = foreign.storage.subjectFor(foreign.storage.nodes.find(node => foreign.source.ast.is.IsObjectLiteralExpression(node))!);
  assert.equal(foreignSubject.kind, "resolved", "foreign canonical subject control");
  assert.equal(empty.kind, "resolved", "an explicitly empty native context has its canonical key");
  assert.equal(copied.kind, "unresolved", "a copied bindings view is not an owned substitution context");
  if (foreignSubject.kind === "resolved") assert.equal(storage.contextKeyFor([foreignSubject.subject], storage.emptyBindings).kind,
    "unresolved", "foreign subjects cannot alias an owned native context");
  const formal = source.ast.parameters(declaration("left"))[0]!;
  const subject_ = storage.subject(formal, "input");
  assert.equal(subject_.kind, "resolved", "the exact recursive formal input");
  const contexts = [current.callIn("ownedRoot"), current.callIn("borrowedRoot")].map(call => {
    const caller = storage.bindingsForLexicalOwner(call);
    return caller.kind === "resolved" ? storage.bindingsForInvocation(declaration("left"), call, caller.bindings) : caller;
  });
  if (subject_.kind === "resolved") {
    const selected = contexts.map(context => context.kind === "resolved"
      ? storage.contextKeyFor([subject_.subject], context.bindings) : context);
    assert.equal(selected[0]?.kind === "resolved" && selected[1]?.kind === "resolved" && selected[0].key !== selected[1].key, true,
      "different actual owned/borrowed substitutions remain different continuation contexts");
  }
});

test("canonical contexts keep actual closure captures and generic input substitutions distinct", () => {
  const current = fixture(false, "mutual");
  const { source, storage, declaration, selectedDeclaration } = current;
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) &&
    selectedDeclaration(node) === declaration("capture"));
  assert.equal(calls.length, 2, "two checked generic calls construct different captured values");
  const keys = calls.map(call => {
    const subject = storage.subjectFor(call);
    const bindings = storage.bindingsForLexicalOwner(call);
    assert.equal(subject.kind === "resolved" && bindings.kind === "resolved", true, "the exact generic caller inputs");
    if (subject.kind === "unresolved" || bindings.kind === "unresolved") return undefined;
    const origins = storage.storageProducersFor(subject.subject, bindings.bindings);
    assert.equal(origins.kind === "complete" && origins.producers.length === 1, true,
      "one actual closure body and its original captured context");
    if (origins.kind !== "complete" || origins.producers.length !== 1) return undefined;
    const origin = origins.producers[0]!;
    const selected = storage.contextKeyFor([origin.subject], origin.bindings);
    assert.equal(selected.kind === "resolved", true, "the existing canonical footprint encodes every real capture");
    return selected.kind === "resolved" ? selected.key : undefined;
  });
  assert.equal(keys[0] !== undefined && keys[1] !== undefined && keys[0] !== keys[1], true,
    "same source closure does not merge distinct actual captured generic values");
});

for (const depth of [2, 3]) for (const reverse of [false, true]) {
  test(`repeated class initializer reads retain their distinct actual capture contexts: depth=${depth}, reverse=${reverse}`, () => {
    const layers = Array.from({ length: depth }, (_, index) =>
      `const Layer${index} = repeatedLayer(${index === 0 ? "RepeatedRoot" : `Layer${index - 1}`},
        ${(index % 2 === 0) !== reverse ? "borrowed" : "owned"});`).join("\n");
    const current = fixture(reverse, "self", `
      type RepeatedFactory = new () => { root: number };
      class RepeatedRoot { root = 0; }
      function repeatedLayer(Parent: RepeatedFactory, lease: Lease) {
        return class RepeatedLayer extends Parent { field = read(lease); };
      }
      async function repeatedClassRoot(): Promise<number> {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 4 };
        ${layers}
        const instance = new Layer${depth - 1}();
        return instance.root;
      }
    `);
    const { source, storage } = current;
    const root = current.declaration("repeatedClassRoot");
    const call = storage.invocations.find(node => source.ast.is.IsNewExpression(node) &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    assert.equal(call !== undefined, true, "One actual repeated-factory allocation is checked.");
    const bindings = storage.bindingsForLexicalOwner(call!);
    assert.equal(bindings.kind, "resolved", "The actual allocation caller is retained.");
    const construction = storage.constructionFor(call!, bindings.kind === "resolved" ? bindings.bindings : undefined);
    assert.equal(construction.kind === "resolved", true, "the real native construction keeps each instantiated factory class");
    if (construction.kind !== "resolved") return;
    const reads: { readonly reference: Node; readonly candidate: Node; readonly bindings: SourceStorageBindings }[] = [];
    const { closure, context } = current.continuation(current.premises, current.budget);
    const checkedDeclarations = new Set<Node>();
    for (const alternative of construction.alternatives) for (const selectedClass of alternative.classes) {
      for (const region of selectedClass.regions) {
        assert.equal(region.selection.kind === "resolved", true, "the original checked class region has its actual construction bindings");
        const references = current.nodes.filter(node => {
          if (!source.ast.is.IsIdentifier(node) || source.ast.text(node) !== "lease") return false;
          for (let parent: Node | undefined = node; parent !== undefined; parent = source.ast.parent(parent))
            if (parent === region.node) return true;
          return false;
        });
        for (const reference of references)
          reads.push({ reference, candidate: selectedClass.owner, bindings: region.selection.bindings });
        if (references.length === 0 || checkedDeclarations.has(selectedClass.owner)) continue;
        checkedDeclarations.add(selectedClass.owner);
        const graph = context.graphFor(selectedClass.owner);
        assert.equal(graph.kind === "resolved", true, "the same source class has one canonical declaration graph");
        if (graph.kind !== "resolved") return;
        const selected = closure.forDeclaration(selectedClass.owner);
        assert.equal(selected.kind === "resolved", true,
          selected.kind === "unresolved" ? selected.reason : "the declaration initializer retains its local native obligations");
        for (const reference of references) {
          const value = context.values.forNode(reference);
          assert.equal("kind" in value, false, "the original initializer read has its exact checked native component");
          if ("kind" in value) return;
          assert.equal(value.node === reference && value.region.owner === selectedClass.owner &&
            value.region.root === region.node && value.region.role === "instance-initializer", true,
          "a repeated runtime instance never replaces the declaration's original field region or component");
          assert.equal(context.values.forNode(reference) === value, true,
            "additional runtime constructor instances do not create competing declaration values");
        }
      }
    }
    assert.equal(reads.length, depth, "Each original initializer read occurs once per actual factory capture.");
    assert.equal(reads.every(read => read.reference === reads[0]!.reference && read.candidate === reads[0]!.candidate), true,
      "The same source read and class AST have distinct execution bindings, not fabricated syntax.");
    assert.equal(new Set(reads.map(read => read.bindings)).size, depth, "The ownership consumer preserves each real point's activation.");
    let borrowed = 0;
    let owned = 0;
    for (const read of reads) {
      const subject = storage.subjectFor(read.reference);
      assert.equal(subject.kind, "resolved", "The exact original capture subject is checked.");
      const producers = storage.storageProducersFor(subject.subject, read.bindings);
      assert.equal(producers.kind === "complete" && producers.producers.length === 1, true,
        "Each point reads its own actual factory argument without a merged capture environment.");
      if (producers.kind !== "complete") return;
      const value = producers.producers[0]!.subject.node;
      if (source.ast.is.IsCallExpression(value) && current.selectedDeclaration(value) === current.declaration("borrow")) borrowed += 1;
      else {
        assert.equal(source.ast.is.IsObjectLiteralExpression(value), true, "The other actual factory input is the checked owned value.");
        owned += 1;
      }
    }
    assert.equal(borrowed, Array.from({ length: depth }, (_, index) => (index % 2 === 0) !== reverse).filter(Boolean).length,
      "Every actual borrowed factory capture remains represented.");
    assert.equal(owned, depth - borrowed, "Every actual owned factory capture remains separate.");
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true,
      "The repeated finite source lineage closes within the unchanged budgets.");
  });
}
