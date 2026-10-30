import { AsCallExpression } from "../../source-navigation/checked-casts.js";
import { Node_Expression } from "../../source-navigation/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { type Node } from "@tsonic/tsts";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits } from "./contracts.js";
import { createSourceDeclarationOwnershipQuery } from "./query.js";
import { fixture } from './recursive-retention-fixtures.js';

test("a complete structural source method remains a source continuation instead of an opaque native signature", () => {
  const current = fixture(false, "self", `
    class Counter { value(): number { return 1; } }
    function makeCounter(): { value(): number } { return new Counter(); }
    async function shapeRead(): Promise<number> { return makeCounter().value(); }
    async function shapeRoot(): Promise<number> { return await shapeRead(); }
  `);
  const call = current.storage.invocations.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.selectedDeclaration(node) === current.declaration("shapeRead"));
  assert.equal(call !== undefined, true, "The original source read is invoked in its actual await.");
  const query = createSourceDeclarationOwnershipQuery({ ...current, premises: { ...current.premises,
    suspensionFor(value) {
      const declaration = current.source.ast.is.IsCallExpression(value.node) ? current.selectedDeclaration(value.node) : undefined;
      return declaration === current.declaration("pending") || declaration === current.declaration("read")
        ? current.premises.suspensionFor(value) : undefined;
    },
  } });
  const selected = query.forCall(call!);
  assert.equal(selected.kind === "resolved" && selected.dependencies.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "The complete source body needs no fabricated native completion or owned contract.");
});

test("an exact selected callee capture keeps its own environment and the actual invocation arguments", () => {
  const current = fixture(false, "self", `
    function selectFactory<Value>(capture: Value) {
      return function selectedBody(input: Value): Value { return capture; };
    }
    function selectedRoot(flag: boolean) {
      const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
      const chosen = flag ? selectFactory(owned) : selectFactory(borrowed);
      const outsider = selectFactory({ value: 9 });
      const actual: Lease = { value: 1 }; return chosen(actual);
    }
  `);
  const { source, storage } = current;
  const root = current.declaration("selectedRoot");
  const implementation = storage.nodes.find(node => source.ast.is.IsFunctionExpression(node) &&
    source.ast.text(source.ast.name(node)) === "selectedBody");
  const call = storage.nodes.find(node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node)?.Expression) === "chosen" &&
    storage.enclosingRegionFor(node) === source.ast.body(root));
  assert.equal(implementation !== undefined && call !== undefined, true, "The real selected function value and invocation are checked.");
  const caller = storage.bindingsForLexicalOwner(call!);
  const expression = source.ast.as.AsCallExpression(call!)!.Expression;
  assert.equal(expression !== undefined, true, "The checked invocation has its original selected operand.");
  const callee = storage.subjectFor(expression!);
  const capture = storage.subject(source.ast.parameters(current.declaration("selectFactory"))[0]!, "input");
  const argument = storage.subject(source.ast.parameters(implementation!)[0]!, "input");
  assert.equal(caller.kind === "resolved" && callee.kind === "resolved" && capture.kind === "resolved" && argument.kind === "resolved", true);
  if (caller.kind !== "resolved" || callee.kind !== "resolved" || capture.kind !== "resolved" || argument.kind !== "resolved") return;
  const values = storage.storageProducersFor(callee.subject, caller.bindings);
  assert.equal(values.kind === "complete" && values.producers.length === 2, true, "Two activations share one function AST without merging captures.");
  if (values.kind !== "complete") return;
  const captured = new Set<Node>();
  for (const producer of values.producers) {
    const selected = storage.bindingsForInvocation(implementation!, call!, caller.bindings, producer);
    assert.equal(selected.kind, "resolved", "The exact producer is verified against this invocation's actual captured domain.");
    if (selected.kind !== "resolved") return;
    const origin = storage.boundOriginsFor(capture.subject, selected.bindings);
    assert.equal(origin.kind === "resolved" && origin.subjects.length === 1, true, "Only the selected factory capture is bound.");
    if (origin.kind !== "resolved") return;
    captured.add(origin.subjects[0]!.node);
    const actual = storage.boundOriginsFor(argument.subject, selected.bindings);
    assert.equal(actual.kind === "resolved" && actual.subjects.length === 1 &&
      source.ast.is.IsObjectLiteralExpression(actual.subjects[0]!.node) &&
      source.ast.text(source.ast.name(source.ast.parent(actual.subjects[0]!.node))) === "actual", true,
    "Selecting a callee capture never substitutes the captured frame for the invocation's real caller.");
    const activation = storage.boundActivationsFor(implementation!, selected.bindings);
    assert.equal(activation.kind === "resolved" && activation.activations.length === 1 &&
      activation.activations[0]!.kind === "invocation" && activation.activations[0]!.invocation === call &&
      activation.activations[0]!.callerBindings === caller.bindings, true, "The actual call activation and caller are retained.");
    const copied = storage.bindingsForInvocation(implementation!, call!, caller.bindings,
      { subject: producer.subject, bindings: { ...producer.bindings } });
    assert.equal(copied.kind, "unresolved", "Copied capture bindings are never an owned producer proof.");
  }
  assert.equal(captured.size, 2, "Each exact selected capture has one different actual owner.");
  const outsider = storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "outsider");
  const outsideSubject = storage.subjectFor(outsider!);
  assert.equal(outsideSubject.kind, "resolved", "The negative has a real sibling producer in this same source program.");
  if (outsideSubject.kind !== "resolved") return;
  const outside = storage.storageProducersFor(outsideSubject.subject, caller.bindings);
  assert.equal(outside.kind === "complete" && outside.producers.length === 1, true);
  if (outside.kind !== "complete") return;
  assert.equal(storage.bindingsForInvocation(implementation!, call!, caller.bindings, outside.producers[0]).kind, "unresolved",
    "An owned but unselected sibling environment cannot be injected into this call.");
});

test("capture-free generic invocation producers retain ordinary and Promise-valued actual arguments", () => {
  const current = fixture(false, "self", `
    function directIdentity<Value>(value: Value): Value { return value; }
    function directRoot() {
      const value: Lease = { value: 3 };
      const pending = produced(value);
      const ordinary = directIdentity(value);
      const asynchronous = directIdentity(pending);
      return [ordinary, asynchronous];
    }
  `);
  const { source, storage } = current;
  const owner = current.declaration("directIdentity");
  const calls = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === owner);
  assert.equal(calls.length, 2, "The identical generic source body is called with both retained actual forms.");
  const formal = storage.subject(source.ast.parameters(owner)[0]!, "input");
  assert.equal(formal.kind, "resolved", "The exact generic formal has one source owner.");
  if (formal.kind !== "resolved") return;
  for (const call of calls) {
    const expression = AsCallExpression(source.ast, call)!.Expression;
    const callee = storage.subjectFor(expression!);
    const caller = storage.bindingsForLexicalOwner(call);
    assert.equal(callee.kind === "resolved" && caller.kind === "resolved", true, "The actual stateless callee and caller are checked.");
    if (callee.kind !== "resolved" || caller.kind !== "resolved") return;
    const values = storage.storageProducersFor(callee.subject, caller.bindings);
    assert.equal(values.kind === "complete" && values.producers.length === 1, true,
      "A top-level generic function still owns one exact capture-free producer scope.");
    if (values.kind !== "complete" || values.producers.length !== 1) return;
    const selected = storage.bindingsForInvocation(owner, call, caller.bindings, values.producers[0]);
    assert.equal(selected.kind, "resolved", "The fourth argument admits the genuine selected empty capture without a fallback.");
    if (selected.kind !== "resolved") return;
    const input = storage.storageProducersFor(formal.subject, selected.bindings);
    const argument = source.ast.arguments(call)[0]!;
    const actual = storage.subjectFor(argument);
    assert.equal(actual.kind, "resolved", "The real generic argument has checked source storage.");
    if (actual.kind !== "resolved") return;
    const expected = storage.storageProducersFor(actual.subject, caller.bindings);
    assert.equal(input.kind === "complete" && expected.kind === "complete" && input.producers.length > 0 &&
      input.producers.every(producer => expected.producers.some(candidate =>
        candidate.subject === producer.subject && candidate.bindings === producer.bindings)) &&
      expected.producers.every(producer => input.producers.some(candidate =>
        candidate.subject === producer.subject && candidate.bindings === producer.bindings)), true,
    "The ordinary or Promise-valued argument remains its identical actual producer, not a fabricated generic owned value.");
  }
});

for (const order of ["owned-first", "borrowed-first", "owned-declared-first", "borrowed-declared-first", "owned-only", "borrowed-only"] as const) {
  test(`recursive closure entry equations preserve every selected capture, ${order}`, () => {
    const choice = order === "owned-first" ? "flag ? make(owned) : make(borrowed)"
      : order === "borrowed-first" ? "flag ? make(borrowed) : make(owned)"
      : order === "owned-declared-first" || order === "borrowed-declared-first" ? "flag ? first : second"
      : order === "owned-only" ? "make(owned)" : "make(borrowed)";
    const declarations = order === "owned-declared-first" ? "const first = make(owned); const second = make(borrowed);"
      : order === "borrowed-declared-first" ? "const first = make(borrowed); const second = make(owned);" : "";
    const current = fixture(false, "self", `
      function make(lease: Lease) {
        async function rec(value: Lease, count: number): Promise<number> {
          if (count > 0) return await rec(lease, count - 1);
          await pending(); return read(value);
        }
        return rec;
      }
      async function mixedRoot(flag: boolean) {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
        ${declarations}
        const selected = ${choice};
        const local: Lease = { value: 1 }; const stored = selected(local, 2); return stored;
      }
    `);
    const { source, storage } = current;
    const candidate = current.declaration("rec");
    const root = current.declaration("mixedRoot");
    const call = storage.nodes.find(node => source.ast.is.IsCallExpression(node) &&
      storage.enclosingRegionFor(node) === source.ast.body(root) && current.selectedDeclaration(node) === candidate);
    const recursive = storage.nodes.find(node => source.ast.is.IsCallExpression(node) &&
      storage.enclosingRegionFor(node) === source.ast.body(candidate) && current.selectedDeclaration(node) === candidate);
    assert.equal(call !== undefined && recursive !== undefined, true, "the exact entry and depth-one recursive calls");
    const caller = storage.bindingsForLexicalOwner(call!);
    const entry = caller.kind === "resolved" ? storage.bindingsForInvocation(candidate, call!, caller.bindings) : caller;
    const nested = entry.kind === "resolved" ? storage.bindingsForInvocation(candidate, recursive!, entry.bindings) : entry;
    const input = storage.subject(source.ast.parameters(candidate)[0]!, "input");
    assert.equal(nested.kind === "resolved" && input.kind === "resolved", true, "the exact recursive input and its selected execution contexts");
    if (nested.kind !== "resolved" || input.kind !== "resolved") return;
    const producers = storage.storageProducersFor(input.subject, nested.bindings);
    assert.equal(producers.kind, "complete", "the finite recursive producer relation closes");
    if (producers.kind !== "complete") return;
    assert.equal(producers.producers.some(producer => current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")),
      order !== "owned-only", "depth one retains the actual borrowed closure input in every mixed order");
    assert.equal(producers.producers.some(producer => source.ast.is.IsObjectLiteralExpression(producer.subject.node) &&
      source.ast.is.IsVariableDeclaration(source.ast.parent(producer.subject.node)) &&
      source.ast.text(source.ast.name(source.ast.parent(producer.subject.node))) === "owned"), order !== "borrowed-only",
    "depth one retains the actual owned closure input, not just the first capture");
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === (order === "owned-only" ? "admitted" : "rejected"), true,
      selected.kind === "unresolved" ? selected.reason : `the actual ${order} demand retains every possible closure loan`);
    if (selected.kind === "resolved" && selected.decision === "rejected") {
      assert.equal(selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && selected.diagnostic.at === call, true,
        "the diagnostic belongs to the real escaping call, not a factory or declaration");
    }
    assert.equal(current.budget.failure() === undefined, true, "the unchanged canonical budget proves the complete relation");
  });
}

for (const accessor of [false, true]) {
  for (const reverse of [false, true]) {
    test(`capture-free continuation summaries preserve each actual local allocation, accessor=${accessor}, reverse=${reverse}`, () => {
      const current = fixture(false, "self", `
        async function activationInner(): Promise<number> {
          const localOwner = { value: 1 }; const view = borrow(localOwner);
          await pending(); return read(view);
        }
        class ActivationHolder {
          get local(): Promise<number> {
            const localOwner = { value: 1 }; return produced(borrow(localOwner));
          }
        }
        async function activationMiddle(): Promise<number> {
          ${accessor ? "const holder = new ActivationHolder(); return await holder.local;" : "return await activationInner();"}
        }
        async function activationRoot(): Promise<void> { await activationMiddle(); await activationMiddle(); }
      `);
      const { source, storage } = current;
      const middle = current.declaration("activationMiddle");
      const root = current.declaration("activationRoot");
      const candidate = accessor ? storage.nodes.find(node => source.ast.is.IsGetAccessorDeclaration(node) &&
        source.ast.text(source.ast.name(node)) === "local") : current.declaration("activationInner");
      const invocation = storage.nodes.find(node => storage.enclosingRegionFor(node) === source.ast.body(middle) &&
        (accessor ? source.ast.is.IsPropertyAccessExpression(node) && source.ast.text(source.ast.name(node)) === "local"
          : source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === candidate));
      const entries = storage.nodes.filter(node => source.ast.is.IsCallExpression(node) &&
        storage.enclosingRegionFor(node) === source.ast.body(root) && current.selectedDeclaration(node) === middle);
      const allocation = storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node) &&
        storage.enclosingRegionFor(node) === source.ast.body(candidate));
      assert.equal(candidate !== undefined && invocation !== undefined && allocation !== undefined && entries.length === 2, true,
        "one inner AST and local allocation are reached through two actual outer calls");
      const subject = storage.subjectFor(allocation!);
      assert.equal(subject.kind, "resolved", "the real local native allocation");
      if (subject.kind !== "resolved") return;
      const { closure, context } = current.continuation(current.premises, current.budget);
      const graph = context.graphFor(candidate!);
      assert.equal(graph.kind === "resolved", true, "one declaration-owned graph is independent of the two actual factory calls");
      if (graph.kind !== "resolved") return;
      const selected = closure.forDeclaration(candidate!);
      assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "the actual declaration continuation closes");
      if (selected.kind !== "resolved") return;
      const reads = graph.graph.points.filter(point => point.operation.kind === "read" && point.source !== undefined);
      const results = graph.graph.points.filter(point => point.source !== undefined && source.ast.is.IsReturnStatement(point.source));
      assert.equal(reads.length > 0 && results.length > 0 && selected.dependencies.length > 0, true,
        "the control observes real reads, returned values and pending loan evidence");
      const keys: string[] = [];
      for (const entry of reverse ? [...entries].reverse() : entries) {
        const parent = storage.bindingsForLexicalOwner(entry);
        const caller = parent.kind === "resolved" ? storage.bindingsForInvocation(middle, entry, parent.bindings) : parent;
        const expected = caller.kind === "resolved" ? storage.bindingsForInvocation(candidate!, invocation!, caller.bindings) : caller;
        assert.equal(caller.kind === "resolved" && expected.kind === "resolved", true, "the exact outer and inner execution scopes");
        if (caller.kind !== "resolved" || expected.kind !== "resolved") return;
        const key = storage.contextKeyFor([subject.subject], expected.bindings);
        assert.equal(key.kind, "resolved", "the canonical local allocation birth");
        if (key.kind !== "resolved") return;
        keys.push(key.key);
        assert.equal(closure.forDeclaration(candidate!) === selected, true,
          "the two runtime factory calls do not create competing declaration summaries");
        for (const point of [...reads, ...results]) {
          const region = graph.graph.executionRegions.get(point.id);
          assert.equal(region !== undefined && region.owner === candidate && region.root === source.ast.body(candidate!) &&
            region.role === "body", true,
          "every real read and result retains its original declaration owner and body, never a caller activation");
          const node = source.ast.is.IsReturnStatement(point.source!)
            ? Node_Expression(source.ast, point.source!) : point.source;
          assert.equal(node !== undefined, true, "the checked return keeps its actual native output expression");
          if (node === undefined) return;
          const value = context.values.forNode(node);
          assert.equal("kind" in value, false, "the original local source point has its checked native component");
          if ("kind" in value) return;
          assert.equal(value.node === node && value.region === region, true,
            "the checked local value uses this sole published region and original source node");
          assert.equal(context.values.forNode(node) === value, true,
            "unrelated runtime calls cannot retarget or republish the earlier checked value");
        }
        for (const dependency of selected.dependencies) {
          assert.equal(dependency.suspension.region.owner === candidate &&
            dependency.actual.region.owner === candidate &&
            dependency.actual.node === dependency.reference, true,
          "pending and read evidence refer to the same original local declaration, without runtime bindings");
        }
      }
      assert.equal(keys.length === 2 && keys[0] !== keys[1], true, "identical inputs do not merge distinct actual local allocations");
      assert.equal(current.budget.failure() === undefined, true, "actual execution identity stays finite under unchanged limits");
    });
  }
}

for (const reverse of [false, true]) for (const inherited of [false, true]) {
  test(`recursive class and constructor entry contexts retain every selected class capture, reverse=${reverse}${inherited ? ", inherited=true" : ""}`, () => {
    const current = fixture(false, "self", `
      function classFactory(lease: Lease) {
        return class CaptureHolder {
          readonly captured = lease;
          readonly value: Lease;
          constructor(value: Lease, count: number) {
            this.value = count > 0 ? new CaptureHolder(lease, count - 1).value : value;
          }
        };
      }
      function classRoot(flag: boolean) {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
        const ${inherited ? "Base" : "Holder"} = flag ? classFactory(${reverse ? "borrowed" : "owned"}) : classFactory(${reverse ? "owned" : "borrowed"});
        ${inherited ? "class Holder extends Base {}" : ""}
        const local: Lease = { value: 1 }; return new Holder(local, 2);
      }
    `);
    const { source, storage } = current;
    const owner = storage.nodes.find(node => source.ast.is.IsClassExpression(node) &&
      source.ast.text(source.ast.name(node)) === "CaptureHolder");
    const constructor = storage.nodes.find(node => source.ast.is.IsConstructorDeclaration(node) && source.ast.parent(node) === owner);
    const root = current.declaration("classRoot");
    const call = storage.nodes.find(node => source.ast.is.IsNewExpression(node) &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    const recursive = storage.nodes.find(node => source.ast.is.IsNewExpression(node) &&
      storage.enclosingRegionFor(node) === source.ast.body(constructor));
    const captured = storage.nodes.find(node => source.ast.is.IsIdentifier(node) && source.ast.text(node) === "lease" &&
      source.ast.is.IsPropertyDeclaration(source.ast.parent(node)) &&
      source.ast.text(source.ast.name(source.ast.parent(node))) === "captured");
    assert.equal(owner !== undefined && constructor !== undefined && call !== undefined && recursive !== undefined && captured !== undefined, true,
      "the actual class leaf, constructor, recursive edge and initializer capture");
    const parent = storage.bindingsForLexicalOwner(call!);
    assert.equal(parent.kind, "resolved", "the checked class invocation context");
    if (parent.kind !== "resolved") return;
    const classBindings = storage.bindingsForInvocation(owner!, call!, parent.bindings);
    const constructorBindings = storage.bindingsForInvocation(constructor!, call!, parent.bindings);
    const depth = constructorBindings.kind === "resolved"
      ? storage.bindingsForInvocation(constructor!, recursive!, constructorBindings.bindings) : constructorBindings;
    const classSubject = storage.subjectFor(captured!);
    const input = storage.subject(source.ast.parameters(constructor!)[0]!, "input");
    assert.equal(classBindings.kind === "resolved" && depth.kind === "resolved" && classSubject.kind === "resolved" && input.kind === "resolved", true,
      "class and constructor evidence have separate canonical entry owners");
    if (classBindings.kind !== "resolved" || depth.kind !== "resolved" || classSubject.kind !== "resolved" || input.kind !== "resolved") return;
    for (const [subject, bindings] of [[classSubject.subject, classBindings.bindings], [input.subject, depth.bindings]] as const) {
      const selected = storage.storageProducersFor(subject, bindings);
      assert.equal(selected.kind, "complete", "the exact class or constructor producer relation closes");
      if (selected.kind !== "complete") return;
      assert.equal(selected.producers.some(producer => current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")), true,
        "a class/constructor entry never drops the borrowed branch's capture");
      assert.equal(selected.producers.some(producer => source.ast.is.IsObjectLiteralExpression(producer.subject.node) &&
        source.ast.is.IsVariableDeclaration(source.ast.parent(producer.subject.node)) &&
        source.ast.text(source.ast.name(source.ast.parent(producer.subject.node))) === "owned"), true,
      "a class/constructor entry never drops the owned branch's capture");
    }
    assert.equal(storage.failureReason() === undefined, true, "the finite class relation stays within its unchanged budget");
  });
}

for (const choice of ["flag ? first.ping : second.pong", "flag ? second.pong : first.ping",
  "flag ? first.pong : second.ping", "flag ? second.ping : first.pong"]) {
  test(`two selected candidates of one recursive component preserve both actual captures: ${choice}`, () => {
    const current = fixture(false, "mutual", `
      function makePair(lease: Lease) {
        async function ping(value: Lease, count: number): Promise<number> {
          if (count > 0) return await pong(lease, count - 1);
          await pending(); return read(value);
        }
        async function pong(value: Lease, count: number): Promise<number> {
          if (count > 0) return await ping(lease, count - 1);
          await pending(); return read(value);
        }
        return { ping, pong };
      }
      async function pairRoot(flag: boolean) {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
        const first = makePair(owned); const second = makePair(borrowed);
        const pick = ${choice};
        const local: Lease = { value: 1 }; const stored = pick(local, 2); return stored;
      }
    `);
    const root = current.declaration("pairRoot");
    const call = current.storage.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.source.ast.text(current.source.ast.as.AsCallExpression(node)?.Expression) === "pick" &&
      current.storage.enclosingRegionFor(node) === current.source.ast.body(root));
    assert.equal(call !== undefined, true, "One actual call selects both candidates of the same component.");
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "rejected" &&
      selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && selected.diagnostic.at === call, true,
    selected.kind === "unresolved" ? selected.reason : "Every selected component candidate contributes its real capture.");
    assert.equal(current.budget.failure() === undefined && current.storage.failureReason() === undefined, true);
  });
}

for (const reverse of [false, true]) for (const recursiveClass of ["MBase", "MDerived"]) {
  test(`module-level ${recursiveClass} construction preserves the recursive-site borrow at both depths, reverse=${reverse}`, () => {
    const current = fixture(false, "self", `
      class MBase {
        readonly value: Lease;
        constructor(value: Lease, count: number, owner: { value: number }) {
          this.value = count > 0 ? new ${recursiveClass}(borrow(owner), count - 1, owner).value : value;
        }
      }
      class MDerived extends MBase {}
      function moduleRoot() {
        const ownerObject = { value: 3 }; const ownedLease: Lease = { value: 1 };
        return new MDerived(ownedLease, 2, ownerObject);
      }
    `);
    const { source, storage } = current;
    const owner = storage.nodes.find(node => source.ast.is.IsClassDeclaration(node) && source.ast.text(source.ast.name(node)) === "MBase");
    const constructor = storage.nodes.find(node => source.ast.is.IsConstructorDeclaration(node) && source.ast.parent(node) === owner);
    const root = current.declaration("moduleRoot");
    const call = storage.nodes.find(node => source.ast.is.IsNewExpression(node) && storage.enclosingRegionFor(node) === source.ast.body(root));
    const recursive = storage.nodes.find(node => source.ast.is.IsNewExpression(node) && storage.enclosingRegionFor(node) === source.ast.body(constructor));
    assert.equal(constructor !== undefined && call !== undefined && recursive !== undefined, true,
      "The exact C78 inherited constructor and its recursively selected class are checked source identities.");
    const caller = storage.bindingsForLexicalOwner(call!);
    const entry = caller.kind === "resolved" ? storage.bindingsForInvocation(constructor!, call!, caller.bindings) : caller;
    const depthOne = entry.kind === "resolved" ? storage.bindingsForInvocation(constructor!, recursive!, entry.bindings) : entry;
    const depthTwo = depthOne.kind === "resolved" ? storage.bindingsForInvocation(constructor!, recursive!, depthOne.bindings) : depthOne;
    const input = storage.subject(source.ast.parameters(constructor!)[0]!, "input");
    assert.equal(entry.kind === "resolved" && depthOne.kind === "resolved" && depthTwo.kind === "resolved" && input.kind === "resolved", true,
      "The original call and both inherited recursive activations are selected independently.");
    if (entry.kind !== "resolved" || depthOne.kind !== "resolved" || depthTwo.kind !== "resolved" || input.kind !== "resolved") return;
    for (const [depth, context] of reverse ? [[2, depthTwo], [1, depthOne]] as const : [[1, depthOne], [2, depthTwo]] as const) {
      const selected = storage.storageProducersFor(input.subject, context.bindings);
      assert.equal(selected.kind, "complete", `Depth ${depth}: the whole finite producer relation is complete.`);
      if (selected.kind !== "complete") return;
      assert.equal(selected.producers.some(producer => current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")), true,
        `Depth ${depth}: new ${recursiveClass}(borrow(owner), ...) never drops its recursive-site native borrow.`);
    }
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true);
  });
}

for (const reverse of [false, true]) for (const branches of ["owned", "borrowed", "mixed"] as const) {
  test(`recursive new Derived preserves its inherited constructor's actual captures: ${branches}, reverse=${reverse}`, () => {
    const current = fixture(reverse, "self", `
      function classFactory(lease: Lease) {
        class Base {
          readonly value: Lease;
          constructor(value: Lease, count: number) {
            this.value = count > 0 ? new Derived(lease, count - 1).value : value;
          }
        }
        class Derived extends Base {}
        return Derived;
      }
      async function classRoot(flag: boolean): Promise<number> {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
        const Holder = ${branches === "mixed" ? reverse ? "flag ? classFactory(borrowed) : classFactory(owned)"
          : "flag ? classFactory(owned) : classFactory(borrowed)" : `classFactory(${branches})`};
        const local: Lease = { value: 1 }; const value = new Holder(local, 1).value;
        const stored = produced(value); return stored;
      }
    `);
    const { source, storage } = current;
    const owner = storage.nodes.find(node => source.ast.is.IsClassDeclaration(node) && source.ast.text(source.ast.name(node)) === "Base");
    const constructor = storage.nodes.find(node => source.ast.is.IsConstructorDeclaration(node) && source.ast.parent(node) === owner);
    const root = current.declaration("classRoot");
    const call = storage.nodes.find(node => source.ast.is.IsNewExpression(node) && storage.enclosingRegionFor(node) === source.ast.body(root));
    const recursive = storage.nodes.find(node => source.ast.is.IsNewExpression(node) && storage.enclosingRegionFor(node) === source.ast.body(constructor));
    const borrowed = storage.nodes.find(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === current.declaration("borrow") &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    const namedObject = (name: string) => storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node) &&
      source.ast.is.IsVariableDeclaration(source.ast.parent(node)) && source.ast.text(source.ast.name(source.ast.parent(node))) === name &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    const owned = namedObject("owned");
    const local = namedObject("local");
    assert.equal(owner !== undefined && constructor !== undefined && call !== undefined && recursive !== undefined &&
      borrowed !== undefined && owned !== undefined && local !== undefined, true, "the exact inherited constructor, Derived edge and three actual source producers");
    const parent = storage.bindingsForLexicalOwner(call!);
    assert.equal(parent.kind, "resolved", "the actual outer construction caller");
    if (parent.kind !== "resolved") return;
    const entry = storage.bindingsForInvocation(constructor!, call!, parent.bindings);
    assert.equal(entry.kind, "resolved", "the checked inherited Base constructor entry");
    if (entry.kind !== "resolved") return;
    const depth = storage.bindingsForInvocation(constructor!, recursive!, entry.bindings);
    const depthTwo = depth.kind === "resolved" ? storage.bindingsForInvocation(constructor!, recursive!, depth.bindings) : depth;
    const input = storage.subject(source.ast.parameters(constructor!)[0]!, "input");
    assert.equal(depth.kind === "resolved" && depthTwo.kind === "resolved" && input.kind === "resolved", true, "both recursive new Derived activations select the same actual Base body");
    if (depth.kind !== "resolved" || depthTwo.kind !== "resolved" || input.kind !== "resolved") return;
    const contexts = reverse ? [depthTwo.bindings, depth.bindings, entry.bindings] : [entry.bindings, depth.bindings, depthTwo.bindings];
    for (const bindings of contexts) {
      const selected = storage.storageProducersFor(input.subject, bindings);
      assert.equal(selected.kind, "complete", "each complete constructor context has its exact producer relation");
      if (selected.kind !== "complete") return;
      const nodes = selected.producers.map(producer => producer.subject.node);
      assert.equal(nodes.every(node => node === borrowed || node === owned || node === local), true, "no unrelated activation supplies a constructor input");
      if (bindings === depth.bindings || bindings === depthTwo.bindings) {
        assert.equal(nodes.includes(borrowed!), branches !== "owned", "the borrowed selected factory branch is retained exactly when present");
        assert.equal(nodes.includes(owned!), branches !== "borrowed", "the owned selected factory branch is retained exactly when present");
      }
    }
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true, "the finite inherited relation respects unchanged budgets");
  });
}

for (const reverse of [false, true]) for (const override of [false, true]) {
  test(`Base constructor and each initializer retain their own factory captures, reverse=${reverse}, override=${override}`, () => {
    const current = fixture(reverse, "self", `
      interface Holder { readonly value: Lease; readonly fromBase: Lease; }
      type HolderConstructor = new (value: Lease, count: number) => Holder;
      function makeBase(lease: Lease) {
        return class Base {
          readonly fromBase = lease;
          readonly value: Lease;
          constructor(value: Lease, count: number) { this.value = lease; }
        };
      }
      function makeDerived(Parent: HolderConstructor, lease: Lease) {
        return class Derived extends Parent {
          readonly fromDerived = lease;
          ${override ? "constructor(value: Lease, count: number) { super(value, count); }" : ""}
        };
      }
      async function classRoot(): Promise<number> {
        const owner = { value: 3 }; const borrowed = borrow(owner); const owned: Lease = { value: 3 };
        const Base = makeBase(${reverse ? "owned" : "borrowed"});
        const Derived = makeDerived(Base, ${reverse ? "borrowed" : "owned"});
        const local: Lease = { value: 1 }; const instance = new Derived(local, 0);
        const basePending = produced(instance.value);
        const fieldPending = produced(instance.fromBase);
        const derivedPending = produced(instance.fromDerived);
        return (await basePending) + (await fieldPending) + (await derivedPending);
      }
    `);
    const { source, storage } = current;
    const root = current.declaration("classRoot");
    const borrowed = storage.nodes.find(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === current.declaration("borrow") &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    const owned = storage.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node) && source.ast.is.IsVariableDeclaration(source.ast.parent(node)) &&
      source.ast.text(source.ast.name(source.ast.parent(node))) === "owned" && storage.enclosingRegionFor(node) === source.ast.body(root));
    assert.equal(borrowed !== undefined && owned !== undefined, true, "the two distinct actual factory arguments");
    const names = reverse ? ["fromDerived", "fromBase", "value"] : ["value", "fromBase", "fromDerived"];
    for (const name of names) {
      const expression = storage.nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
        source.ast.text(source.ast.name(node)) === name && storage.enclosingRegionFor(node) === source.ast.body(root));
      assert.equal(expression !== undefined, true, `${name}: the actual instance field read`);
      const subject = storage.subjectFor(expression!);
      const bindings = storage.bindingsForLexicalOwner(expression!);
      assert.equal(subject.kind === "resolved" && bindings.kind === "resolved", true, `${name}: checked source storage and caller context`);
      if (subject.kind !== "resolved" || bindings.kind !== "resolved") return;
      const selected = storage.storageProducersFor(subject.subject, bindings.bindings);
      assert.equal(selected.kind, "complete", `${name}: its exact selected factory provenance closes${
        selected.kind === "unresolved" ? ` (${selected.reason})` : ""}`);
      if (selected.kind !== "complete") return;
      const expected = (name === "fromDerived") !== reverse ? owned : borrowed;
      assert.equal(selected.producers.length > 0 && selected.producers.every(producer => producer.subject.node === expected), true,
        `${name}: no Base capture is transplanted onto a Derived initializer or vice versa`);
    }
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true, "distinct actual factory scopes stay finite");
  });
}

for (const thrown of [false, true]) {
  test(`failed continuation graph waves release staged summaries and prepared inputs, thrown=${thrown}`, () => {
    const current = fixture(false, "self", `
      declare function unclassified(): number;
      async function failedRoot(): Promise<number> {
        await left({ value: 3 }, 0); unclassified(); return 1;
      }
      async function caller(): Promise<void> { await failedRoot(); }
    `);
    const candidate = current.declaration("failedRoot");
    const call = current.storage.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === candidate);
    assert.equal(call !== undefined, true, "the wave contains a valid child before a late unknown native leaf");
    const budget = createSourceDeclarationOwnershipBudget(current.nodes[0]!, { ...defaultSourceDeclarationOwnershipLimits, maximumTransportRows: 65_536 });
    const original = new Error("native premise control");
    let fail = true;
    const { closure: query } = current.continuation({ ...current.premises,
      suspensionFor(value) {
        if (fail && current.selectedDeclaration(value.node) === current.declaration("unclassified")) {
          if (thrown) throw original;
          return undefined;
        }
        return current.premises.suspensionFor(value);
      },
    }, budget);
    const validCall = current.callIn("ownedRoot");
    const valid = query.forCall(validCall);
    assert.equal(valid.kind, "resolved", "an earlier durable completed component remains cached");
    let retained: number | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (thrown) assert.throws(() => query.forCall(call!), error => error === original,
        "a thrown native premise retains its original identity");
      else {
        const rejected = query.forCall(call!);
        assert.equal(rejected.kind === "unresolved" && rejected.reason.includes("native continuation contract"), true,
          "a late semantic failure is not a resource refusal");
      }
      const usage = budget.usage().rows;
      if (retained === undefined) retained = usage;
      assert.equal(usage, retained, "repeated failed waves retain no orphaned summary or CFG input reservations");
      assert.equal(budget.failure() === undefined, true, "the unchanged small budget is not poisoned by discarded work");
      assert.equal(query.forCall(validCall) === valid, true, "pre-existing completed results and their resources survive rollback");
    }
    fail = false;
    const corrected = query.forCall(call!);
    assert.equal(corrected.kind, "resolved", corrected.kind === "unresolved" ? corrected.reason : "the corrected native premise can be retried");
    assert.equal(budget.failure() === undefined, true, "rollback did not consume the later valid query's finite row budget");
  });
}
