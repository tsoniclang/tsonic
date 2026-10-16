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
      source.ast.text(producer.subject.node).includes("value: 3")), order !== "borrowed-only",
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
        for (const binding of [...reads.map(read => read.bindings), ...results.map(result => result.bindings),
          ...selected.dependencies.map(dependency => dependency.suspension.bindings)]) {
          const observed = storage.boundActivationsFor(middle, binding);
          assert.equal(observed.kind === "resolved" && observed.activations.length > 0 &&
            observed.activations.every(activation => activation.kind === "invocation" && activation.invocation === entry), true,
          "no read, result or pending witness retains the first outer invocation's activation");
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

for (const reverse of [false, true]) {
  test(`recursive class and constructor entry contexts retain every selected class capture, reverse=${reverse}`, () => {
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
        const Holder = flag ? classFactory(${reverse ? "borrowed" : "owned"}) : classFactory(${reverse ? "owned" : "borrowed"});
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
        source.ast.text(producer.subject.node).includes("value: 3")), true,
      "a class/constructor entry never drops the owned branch's capture");
    }
    assert.equal(storage.failureReason() === undefined, true, "the finite class relation stays within its unchanged budget");
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
