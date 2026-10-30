import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationOwnershipQuery } from "./query.js";
import { fixture } from './recursive-retention-fixtures.js';

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
    const query = createSourceDeclarationOwnershipQuery({ ...current, premises: { ...current.premises,
      suspensionFor(value, use) {
        if (!constructors.has(value.node)) return current.premises.suspensionFor(value, use);
        const type = value.component.selectedType;
        assert.equal(source.semantics.forNode(value.node).types.constructSignatures(type).length === 1,
          true, "A native constructor value has its exact checked constructor signature, not a guessed unknown result.");
        return { kind: "never", value,
          contract: { kind: "expression", expression: value.node, component: value.component } };
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
      assert.equal(selected.kind, "complete", `Both real factory captures close through the same constructor model.${
        selected.kind === "unresolved" ? ` (${selected.reason})` : ""}`);
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
