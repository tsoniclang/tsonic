import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import type { SourceStorageBindings } from "../source-storage/model/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { createSourceOwnershipQuery } from "./query.js";
import { createSourceContinuationClosureQuery } from "./closure.js";
import type { SourceOwnershipPremises } from "./model.js";

function fixture(reverse: boolean, recursive: "self" | "mutual", additional = "") {
  const bodies = [
    `async function left(value: Lease, count: number): Promise<number> {
      if (count > 0) return await ${recursive === "self" ? "left" : "right"}(value, count - 1);
      await pending(); return read(value);
    }`,
    `async function right(value: Lease, count: number): Promise<number> {
      if (count > 0) return await left(value, count - 1);
      await pending(); return read(value);
    }`,
    `async function produced(value: Lease): Promise<number> { await pending(); return read(value); }`,
    `async function plainProducer(): Promise<number> { await pending(); return 1; }`,
    `async function returned(pending: Promise<number>): Promise<number> { const alias = pending; return alias; }`,
    `async function awaited(pending: Promise<number>): Promise<number> { const alias = pending; return await alias; }`,
    `async function recursiveAdopt(pending: Promise<number>, count: number): Promise<number> {
      if (count > 0) return await recursiveAdopt(pending, count - 1);
      return pending;
    }`,
  ];
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease { readonly value: number; }
    declare function pending(): Promise<void>;
    declare function read(value: Lease): number;
    declare function borrow(owner: { value: number }): Lease;
    ${additional}
    ${(reverse ? [...bodies].reverse() : bodies).join("\n")}
    async function ownedRoot() {
      const value: Lease = { value: 3 }; const stored = left(value, 2); return stored;
    }
    async function borrowedRoot() {
      const owner = { value: 3 }; const value = borrow(owner); const stored = left(value, 2); return stored;
    }
    function allocate() { return { value: 3 }; }
    function allocations() { const first = allocate(); const second = allocate(); return [first, second]; }
    function capture<Value>(value: Value) { return () => value; }
    function captures() { const first = capture(1); const second = capture("second"); return [first, second]; }
    async function ownedAdoption() {
      const value: Lease = { value: 3 }; const promise = produced(value);
      const stored = returned(promise); return stored;
    }
    async function borrowedAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const promise = produced(value);
      const alias = promise; const stored = returned(alias); return stored;
    }
    async function ownedAwaitedAdoption() {
      const value: Lease = { value: 3 }; const holder = { promise: produced(value) };
      const stored = awaited(holder.promise); return stored;
    }
    async function borrowedAwaitedAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const holder = { promise: produced(value) };
      const stored = awaited(holder.promise); return stored;
    }
    async function ownedRecursiveAdoption() {
      const value: Lease = { value: 3 }; const promise = produced(value);
      const stored = recursiveAdopt(promise, 2); return stored;
    }
    async function borrowedRecursiveAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const promise = produced(value);
      const stored = recursiveAdopt(promise, 2); return stored;
    }
    async function formalAdoption(pending: Promise<number>) { return await returned(pending); }
    async function plainRoot() { const promise = plainProducer(); return await returned(promise); }
    class PromiseHolder {
      constructor(private readonly promise: Promise<number>) {}
      get value(): Promise<number> { return this.promise; }
    }
    async function ownedGetterAdoption() {
      const value: Lease = { value: 3 }; const holder = new PromiseHolder(produced(value));
      const stored = returned(holder.value); return stored;
    }
    async function borrowedGetterAdoption() {
      const owner = { value: 3 }; const value = borrow(owner); const holder = new PromiseHolder(produced(value));
      const stored = returned(holder.value); return stored;
    }
    async function ownedConditionalAdoption(flag: boolean) {
      const value: Lease = { value: 3 }; const promise = flag ? produced(value) : plainProducer();
      const stored = returned(promise); return stored;
    }
    async function borrowedConditionalAdoption(flag: boolean) {
      const owner = { value: 3 }; const value = borrow(owner); const promise = flag ? produced(value) : plainProducer();
      const stored = returned(promise); return stored;
    }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const selectedDeclaration = (call: Node): Node | undefined => {
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    return selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
  };
  const storage = createSourceStorageQuery(source, source.sourceFiles, defaultSourceStorageLimits, {
    call(node) {
      const declaration = selectedDeclaration(node);
      return declaration !== undefined && source.ast.is.IsFunctionDeclaration(declaration) && source.ast.body(declaration) === undefined
        ? { resultAllocation: node, preservedInputs: [] } : undefined;
    },
  });
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const declaration = (name: string): Node => {
    const selected = storage.nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected!;
  };
  const premises: SourceOwnershipPremises = {
    completionFor(call, selected) {
      const owner = selectedDeclaration(call);
      return owner !== undefined && source.ast.hasModifierKind(owner, "async")
        ? { kind: "async", resultPolicy: "observe-rejection", contractDeclaration: owner, checkedType: selected.sourceResultType }
        : { kind: "not-async" };
    },
    suspensionFor(value) {
      if (value.kind === "input" && value.node === source.ast.parameters(declaration("formalAdoption"))[0]) {
        const type = storage.typeFor(value);
        return type.kind === "resolved" ? { kind: "may-suspend", value,
          contractDeclaration: value.node, checkedType: type.type } : undefined;
      }
      if (!source.ast.is.IsCallExpression(value.node)) return undefined;
      const selected = selectedDeclaration(value.node);
      if (selected === undefined || source.ast.body(selected) !== undefined) return undefined;
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "native pending contract");
      return type.kind === "unresolved" ? undefined : { kind: selected === declaration("pending") ? "may-suspend" : "never",
        value, contractDeclaration: selected, checkedType: type.type };
    },
    retentionFor(value: SourceStorageSubject, bindings: SourceStorageBindings) {
      const type = storage.typeFor(value);
      assert.equal(type.kind === "resolved", true, "exact retained origin type");
      if (type.kind === "unresolved") return { kind: "unresolved", at: value.node, reason: type.reason };
      if (source.ast.is.IsCallExpression(value.node) && selectedDeclaration(value.node) === declaration("borrow")) {
        const argument = source.ast.arguments(value.node)[0]!;
        const selected = storage.subjectFor(argument);
        assert.equal(selected.kind, "resolved", "concrete lease owner subject");
        const bound = selected.kind === "resolved" ? storage.boundOriginsFor(selected.subject, bindings) : selected;
        assert.equal(bound.kind === "resolved" && bound.subjects.length === 1, true, "one exact concrete owner");
        if (bound.kind === "unresolved") return { kind: "unresolved", at: value.node, reason: bound.reason };
        const region = storage.enclosingRegionFor(value.node);
        assert.equal(region !== undefined, true, "concrete source execution region");
        return { kind: "resolved", premises: [{ kind: "scoped-borrowed", value, owner: bound.subjects[0]!, region: region!,
          mode: "shared", contractDeclaration: declaration("borrow"), checkedType: type.type }] };
      }
      return { kind: "resolved", premises: [{ kind: "retained", value, reason: "owned-value",
        contractDeclaration: value.node, checkedType: type.type }] };
    },
  };
  const query = createSourceOwnershipQuery({ source, storage, budget, premises });
  const callIn = (name: string): Node => {
    const root = declaration(name);
    const selected = storage.nodes.find(node => source.ast.is.IsCallExpression(node) &&
      selectedDeclaration(node) === declaration("left") && source.ast.parent(source.ast.parent(node)) !== undefined &&
      storage.enclosingRegionFor(node) === source.ast.body(root));
    assert.equal(selected !== undefined, true, `actual recursive demand in ${name}`);
    return selected!;
  };
  return { source, storage, budget, premises, query, callIn, declaration, selectedDeclaration };
}

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
  const query = createSourceOwnershipQuery({ ...current, premises: { ...current.premises,
    suspensionFor(value, bindings) {
      const declaration = current.source.ast.is.IsCallExpression(value.node) ? current.selectedDeclaration(value.node) : undefined;
      return declaration === current.declaration("pending") || declaration === current.declaration("read")
        ? current.premises.suspensionFor(value, bindings) : undefined;
    },
  } });
  const selected = query.continuationFor(call!);
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
    const expression = source.ast.as.AsCallExpression(call)!.Expression;
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
      const closure = createSourceContinuationClosureQuery(current);
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
        const selected = closure.forInvocation(invocation!, caller.bindings);
        assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "the actual continuation closes");
        if (selected.kind !== "resolved") return;
        const reads = selected.reads.filter(read => read.candidate === candidate);
        const results = selected.results.filter(read => read.candidate === candidate);
        assert.equal(reads.length > 0 && results.length > 0 && selected.dependencies.length > 0, true,
          "the control observes real reads, returned values and pending loan evidence");
        for (const [binding, executionOwner] of [...reads.map(read => [read.bindings, read.candidate] as const),
          ...results.map(result => [result.bindings, result.candidate] as const),
          ...selected.dependencies.map(dependency => [dependency.suspension.bindings,
            source.ast.parent(storage.enclosingRegionFor(dependency.suspension.expression))] as const)]) {
          let currentBinding = binding;
          let currentOwner = executionOwner;
          const visited = new Set<SourceStorageBindings>();
          while (currentOwner !== undefined && currentOwner !== middle && !visited.has(currentBinding)) {
            visited.add(currentBinding);
            const observed = storage.boundActivationsFor(currentOwner, currentBinding);
            const activation = observed.kind === "resolved" && observed.activations.length === 1 ? observed.activations[0] : undefined;
            assert.equal(activation?.kind === "invocation", true, "each actual call keeps its dynamic caller distinct from lexical captures");
            if (activation?.kind !== "invocation") break;
            currentBinding = activation.callerBindings;
            currentOwner = source.ast.parent(storage.enclosingRegionFor(activation.invocation));
          }
          const observed = currentOwner === middle ? storage.boundActivationsFor(middle, currentBinding) : undefined;
          assert.equal(observed?.kind === "resolved" && observed.activations.length > 0 &&
            observed.activations.every(activation => activation.kind === "invocation" && activation.invocation === entry), true,
          "no read, result or pending witness retains another outer invocation's activation");
        }
        for (const read of reads) {
          const observed = storage.contextKeyFor([subject.subject], read.bindings);
          assert.equal(observed.kind === "resolved" && observed.key === key.key, true,
            "the published read names the actual local allocation in this invocation");
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
      assert.equal(selected.kind, "complete", `${name}: its exact selected factory provenance closes`);
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
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 65_536 });
    const original = new Error("native premise control");
    let fail = true;
    const query = createSourceContinuationClosureQuery({ ...current, budget, premises: { ...current.premises,
      suspensionFor(value, bindings) {
        if (fail && current.selectedDeclaration(value.node) === current.declaration("unclassified")) {
          if (thrown) throw original;
          return undefined;
        }
        return current.premises.suspensionFor(value, bindings);
      },
    } });
    const validCall = current.callIn("ownedRoot");
    const valid = query.forInvocation(validCall);
    assert.equal(valid.kind, "resolved", "an earlier durable completed component remains cached");
    let retained: number | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (thrown) assert.throws(() => query.forInvocation(call!), error => error === original,
        "a thrown native premise retains its original identity");
      else {
        const rejected = query.forInvocation(call!);
        assert.equal(rejected.kind === "unresolved" && rejected.reason.includes("native continuation contract"), true,
          "a late semantic failure is not a resource refusal");
      }
      const usage = budget.usage().rows;
      if (retained === undefined) retained = usage;
      assert.equal(usage, retained, "repeated failed waves retain no orphaned summary or CFG input reservations");
      assert.equal(budget.failure() === undefined, true, "the unchanged small budget is not poisoned by discarded work");
      assert.equal(query.forInvocation(validCall) === valid, true, "pre-existing completed results and their resources survive rollback");
    }
    fail = false;
    const corrected = query.forInvocation(call!);
    assert.equal(corrected.kind, "resolved", corrected.kind === "unresolved" ? corrected.reason : "the corrected native premise can be retried");
    assert.equal(budget.failure() === undefined, true, "rollback did not consume the later valid query's finite row budget");
  });
}

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
      assert.equal(current.budget.failure(), undefined, "canonical finite contexts converge under the unchanged budget");
    });
  }
}

test("a recursive component never publishes its private bottom after budget exhaustion", () => {
  const current = fixture(false, "mutual");
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const selected = createSourceOwnershipQuery({ ...current, budget }).continuationFor(current.callIn("borrowedRoot"));
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
  const rejected = current.query.continuationFor(call, { ...context.bindings });
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
    const closure = createSourceContinuationClosureQuery({ source, storage, premises: current.premises, budget: current.budget });
    const selected = closure.forInvocation(call!, bindings.bindings);
    assert.equal(selected.kind === "resolved", true,
      selected.kind === "unresolved" ? selected.reason : "Every actual initializer activation participates in the same complete closure.");
    if (selected.kind === "unresolved") return;
    const reads = selected.reads.filter(read => source.ast.is.IsIdentifier(read.reference) && source.ast.text(read.reference) === "lease");
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

for (const recursiveClass of ["MBase", "MDerived", "MLeaf", "MExplicit"]) for (const producersFirst of [false, true]) {
  test(`a recursive construction's field keeps its real write relation before D12 admission: ${recursiveClass}, producersFirst=${producersFirst}`, () => {
    const current = fixture(false, "self", `
      class MLeaf { readonly value: Lease;
        constructor(value: Lease, count: number, owner: { value: number }) { this.value = value; }
      }
      class MBase { readonly value: Lease;
        constructor(value: Lease, count: number, owner: { value: number }) {
          this.value = count > 0 ? new ${recursiveClass}(borrow(owner), count - 1, owner).value : value;
        }
      }
      class MDerived extends MBase {}${recursiveClass === "MExplicit" ? `
      class MExplicit extends MBase {
        constructor(value: Lease, count: number, owner: { value: number }) { super(value, count, owner); }
      }` : ""}
      async function fieldUse(owner: { value: number }): Promise<number> {
        const ownedLease: Lease = { value: 1 };
        const built = new MDerived(ownedLease, 2, owner);
        await pending(); return read(built.value);
      }
      async function fieldRoot() { const owner = { value: 3 }; const stored = fieldUse(owner); return stored; }
    `);
    const { source, storage } = current;
    const use = current.declaration("fieldUse");
    const call = storage.invocations.find(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === use &&
      storage.enclosingRegionFor(node) === source.ast.body(current.declaration("fieldRoot")));
    const access = storage.nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
      source.ast.text(source.ast.name(node)) === "value" && storage.enclosingRegionFor(node) === source.ast.body(use));
    assert.equal(call !== undefined && access !== undefined, true, "The original escaping call and constructor-produced field are checked.");
    const subject = storage.subjectFor(access!);
    const caller = storage.bindingsForLexicalOwner(call!);
    const entry = caller.kind === "resolved" ? storage.bindingsForInvocation(use, call!, caller.bindings) : caller;
    assert.equal(subject.kind === "resolved" && entry.kind === "resolved", true, "The field query retains the actual allocation's caller activation.");
    if (subject.kind !== "resolved" || entry.kind !== "resolved") return;
    const inspect = () => {
      const selected = storage.storageProducersFor(subject.subject, entry.bindings);
      assert.equal(selected.kind, "complete", "Every live recursive write contribution is completed, not dropped under an opaque boundary.");
      if (selected.kind !== "complete") return;
      assert.equal(selected.producers.some(producer => source.ast.is.IsCallExpression(producer.subject.node) &&
        current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")), true,
      "The nested constructor's actual borrowed value reaches the field.");
      assert.equal(selected.producers.some(producer => source.ast.is.IsObjectLiteralExpression(producer.subject.node)), true,
        "The original non-recursive value branch remains represented as well.");
    };
    if (producersFirst) inspect();
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true,
      selected.kind === "unresolved" ? selected.reason : "An escaping actual constructor-field loan is rejected, never silently admitted.");
    assert.equal(selected.kind === "resolved" && selected.dependencies.some(dependency => dependency.retention.kind === "scoped-borrowed" &&
      source.ast.is.IsCallExpression(dependency.actual.node) && current.selectedDeclaration(dependency.actual.node) === current.declaration("borrow")), true,
    "Rejection is backed by the actual scoped loan, not an invented unknown or budget refusal.");
    if (!producersFirst) inspect();
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true, "Existing finite equations close the allocation/write relation.");
  });
}

for (const recursiveClass of ["LinkedNode", "LinkedLeaf"]) for (const producersFirst of [false, true]) {
  test(`linked recursive allocations preserve the nested field's actual loan: ${recursiveClass}, producersFirst=${producersFirst}`, () => {
    const current = fixture(false, "self", `
      class LinkedNode {
        readonly value: Lease;
        readonly next: LinkedNode | undefined;
        constructor(value: Lease, count: number, owner: { value: number }) {
          this.value = value;
          this.next = count > 0 ? new ${recursiveClass}(borrow(owner), count - 1, owner) : undefined;
        }
      }
      class LinkedLeaf extends LinkedNode {}
      async function linkedUse(owner: { value: number }): Promise<number> {
        const ownedLease: Lease = { value: 1 };
        const built = new LinkedNode(ownedLease, 2, owner);
        const next = built.next;
        await pending(); return next === undefined ? 0 : read(next.value);
      }
      async function linkedRoot() { const owner = { value: 3 }; const stored = linkedUse(owner); return stored; }
    `);
    const { source, storage } = current;
    const use = current.declaration("linkedUse");
    const call = storage.invocations.find(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === use &&
      storage.enclosingRegionFor(node) === source.ast.body(current.declaration("linkedRoot")));
    const access = storage.nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
      source.ast.text(source.ast.name(node)) === "value" && storage.enclosingRegionFor(node) === source.ast.body(use));
    assert.equal(call !== undefined && access !== undefined, true, "The original linked-node field access and escaping call are checked.");
    const subject = storage.subjectFor(access!);
    const caller = storage.bindingsForLexicalOwner(call!);
    const entry = caller.kind === "resolved" ? storage.bindingsForInvocation(use, call!, caller.bindings) : caller;
    assert.equal(subject.kind === "resolved" && entry.kind === "resolved", true, "Linked storage retains the original allocation activation.");
    if (subject.kind !== "resolved" || entry.kind !== "resolved") return;
    const inspect = () => {
      const selected = storage.storageProducersFor(subject.subject, entry.bindings);
      assert.equal(selected.kind === "complete" && selected.producers.some(producer => source.ast.is.IsCallExpression(producer.subject.node) &&
        current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")), true,
      selected.kind === "unresolved" ? selected.reason : "The nested allocation's own field retains the actual borrowed constructor argument.");
    };
    if (producersFirst) inspect();
    const selected = current.query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true,
      selected.kind === "unresolved" ? selected.reason : "A linked stored completion retaining an actual loan cannot escape.");
    if (!producersFirst) inspect();
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true, "Linked recursive writes stay within the same finite model.");
  });
}

test("recursive construction writes do not borrow an unrelated allocation's lease", () => {
  const current = fixture(false, "self", `
    class OwnedNode { readonly value: Lease;
      constructor(value: Lease, count: number) {
        this.value = count > 0 ? new OwnedNode(value, count - 1).value : value;
      }
    }
    async function ownedFieldUse(owner: { value: number }): Promise<number> {
      const unrelated = borrow(owner);
      const value: Lease = { value: 1 };
      const built = new OwnedNode(value, 2);
      await pending(); return read(built.value);
    }
    async function ownedFieldRoot() { const owner = { value: 3 }; const stored = ownedFieldUse(owner); return stored; }
  `);
  const { source, storage } = current;
  const call = storage.invocations.find(node => source.ast.is.IsCallExpression(node) &&
    current.selectedDeclaration(node) === current.declaration("ownedFieldUse") &&
    storage.enclosingRegionFor(node) === source.ast.body(current.declaration("ownedFieldRoot")));
  assert.equal(call !== undefined, true, "The owned actual allocation uses the same recursive write model.");
  const selected = current.query.forCall(call!);
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted" &&
    selected.dependencies.every(dependency => dependency.retention.kind !== "scoped-borrowed"), true,
  selected.kind === "unresolved" ? selected.reason : "A separate earlier borrowed value cannot contaminate owned recursive field storage.");
  assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true, "The owned inverse closes without a compatibility fallback.");
});

for (const borrowed of [false, true]) for (const producersFirst of [false, true]) {
  test(`same-constructor super captures keep actual loans and the owned inverse, borrowed=${borrowed}, producersFirst=${producersFirst}`, () => {
    const current = fixture(false, "self", `
      interface Holder { readonly value: Lease; }
      type HolderConstructor = new (count: number) => Holder;
      async function factoryUse(owner: { value: number }): Promise<number> {
        function makeBase(lease: Lease): HolderConstructor {
          return class Base {
            readonly value: Lease;
            constructor(count: number) {
              this.value = lease;
              if (count > 0) new Second(count - 1);
            }
          };
        }
        function makeDerived(Parent: HolderConstructor): HolderConstructor {
          return class Derived extends Parent {
            constructor(count: number) { super(count); }
          };
        }
        const ownedLease: Lease = { value: 1 };
        const actualLoan = borrow(owner);
        const BaseA = makeBase(${borrowed ? "actualLoan" : "ownedLease"});
        const BaseB = makeBase(${borrowed ? "ownedLease" : "actualLoan"});
        const First = makeDerived(BaseA);
        const Second = makeDerived(BaseB);
        const built = new First(2);
        await pending(); return read(built.value);
      }
      async function factoryRoot() { const owner = { value: 3 }; const stored = factoryUse(owner); return stored; }
    `);
    const { source, storage } = current;
    const use = current.declaration("factoryUse");
    const factoryBodies = new Set(["makeBase", "makeDerived"].map(name => source.ast.body(current.declaration(name))));
    const constructors = new Set(storage.nodes.filter(node => source.ast.is.IsClassExpression(node) &&
      factoryBodies.has(storage.enclosingRegionFor(node))));
    assert.equal(constructors.size, 2, "The fixture supplies native non-Future contracts only for its two actual constructor values.");
    const query = createSourceOwnershipQuery({ ...current, premises: { ...current.premises,
      suspensionFor(value, bindings) {
        if (!constructors.has(value.node)) return current.premises.suspensionFor(value, bindings);
        const type = storage.typeFor(value);
        assert.equal(type.kind === "resolved" && source.semantics.forNode(value.node).types.constructSignatures(type.type).length === 1,
          true, "A native constructor value has its exact checked constructor signature, not a guessed unknown result.");
        return type.kind === "unresolved" ? { kind: "unresolved", at: value.node, reason: type.reason }
          : { kind: "never", value, contractDeclaration: value.node, checkedType: type.type };
      },
    } });
    const call = storage.invocations.find(node => source.ast.is.IsCallExpression(node) && current.selectedDeclaration(node) === use &&
      storage.enclosingRegionFor(node) === source.ast.body(current.declaration("factoryRoot")));
    const access = storage.nodes.find(node => source.ast.is.IsPropertyAccessExpression(node) &&
      source.ast.text(source.ast.name(node)) === "value" && storage.enclosingRegionFor(node) === source.ast.body(use));
    assert.equal(call !== undefined && access !== undefined, true, "The actual escaping call and post-await constructed field read are checked.");
    const subject = storage.subjectFor(access!);
    const caller = storage.bindingsForLexicalOwner(call!);
    const entry = caller.kind === "resolved" ? storage.bindingsForInvocation(use, call!, caller.bindings) : caller;
    assert.equal(subject.kind === "resolved" && entry.kind === "resolved", true, "The original actual owner and constructor scopes are retained.");
    if (subject.kind !== "resolved" || entry.kind !== "resolved") return;
    const inspect = () => {
      const selected = storage.storageProducersFor(subject.subject, entry.bindings);
      assert.equal(selected.kind, "complete", "Both real factory captures close through the same constructor model.");
      if (selected.kind !== "complete") return;
      assert.equal(selected.producers.length === 1, true, "Only this actual base's field producer is retained, never both marginal captures.");
      assert.equal(selected.producers.some(producer => source.ast.is.IsCallExpression(producer.subject.node) &&
        current.selectedDeclaration(producer.subject.node) === current.declaration("borrow")), borrowed,
      "The actual supplied loan, not the sibling's payload, determines the field dependency.");
      assert.equal(selected.producers.some(producer => source.ast.is.IsObjectLiteralExpression(producer.subject.node)), !borrowed,
        "An owned result is not contaminated by constructing an unrelated borrowed sibling before suspension.");
    };
    if (producersFirst) inspect();
    const selected = query.forCall(call!);
    assert.equal(selected.kind === "resolved" && selected.decision === (borrowed ? "rejected" : "admitted"), true,
      selected.kind === "unresolved" ? selected.reason : "D12 follows the actual factory body capture and exact post-await field read.");
    assert.equal(selected.kind === "resolved" && selected.dependencies.some(dependency => dependency.retention.kind === "scoped-borrowed" &&
      source.ast.is.IsCallExpression(dependency.actual.node) && current.selectedDeclaration(dependency.actual.node) === current.declaration("borrow")), borrowed,
    "The retained concrete loan is present exactly when supplied, not hidden by an unknown or budget refusal.");
    if (!producersFirst) inspect();
    assert.equal(storage.failureReason() === undefined && current.budget.failure() === undefined, true,
      "Both ownership/query orders remain finite without collapsing actual captures or allocation identities.");
  });
}
