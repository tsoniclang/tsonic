import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageFormalMemberWrites } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { fixture, formalFixture, optionalDemand } from './source-storage-structural-writes-fixtures.mjs';

for (const access of ["view.callback", 'view["callback"]']){
test(`checked structural write ${access} reaches the exact native member`, () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    const view: { callback: () => number } = value;
    ${access} = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "constructor contribution");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "alias write contribution");
  assert.equal(Object.isFrozen(current.origins), true);
});
}

test("cross-file generic structural writes retain original checked member identity", () => {
  const current = fixture(`
    import { Value } from "./value.js";
    const original = (input: number): number => input + 1;
    const replacement = (input: number): number => input + 2;
    const value = new Value(original);
    const view: { callback: (input: number) => number } = value;
    view.callback = replacement;
  `, { "/project/value.ts": `
    export class Value<T> {
      callback: (input: T) => T;
      constructor(initial: (input: T) => T) { this.callback = initial; }
    }
  ` }, "open");
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true, "selected constructor input");
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), true, "cross-file alias write");
  assert.equal(current.source.ast.getSourceFile(current.member) === current.sourceFiles[1], true, "original provider member identity");
});

test("readonly structural alias rebinding cannot replace the original object's member", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value { callback: () => number = original; }
    const value = new Value();
    let view: { readonly callback: () => number } = value;
    view = { callback: replacement };
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "rebinding is not a field write");
});

test("structural writes invoke accessors without manufacturing writes to their return values", () => {
  const current = fixture(`
    const original = () => 1;
    const replacement = () => 2;
    class Value {
      get callback(): () => number { return original; }
      set callback(value: () => number) { }
    }
    const value = new Value();
    const view: { callback: () => number } = value;
    view.callback = replacement;
  `);
  assert.equal(current.origins.some(origin => origin.subject.node === current.original), true);
  assert.equal(current.origins.some(origin => origin.subject.node === current.replacement), false, "the setter does not return its argument");
});

test("empty formal demand relations publish proven empty data without retaining a construction solver", () => {
  const current = formalFixture(`
    function read(owner: Reader, another: Reader) {}
    function empty() {}
  `);
  for (const name of ["read", "empty"]) {
    const declaration = current.callable(name);
    for (const limits of [{}, { maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
      const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
      let solvers = 0;
      const subject = (node, kind = "value") => {
        if (node === undefined) return undefined;
        const selected = current.storage.subject(node, kind);
        assert.equal(selected.kind, "resolved", "the query uses the original checked source subject");
        return selected.subject;
      };
      const summary = createSourceStorageFormalMemberWrites(current.source, budget, requestBudget => {
        const graph = createSourceStorageGraphQueries(requestBudget);
        return {
          ...graph,
          fixedPoint(...arguments_) {
            solvers += 1;
            return graph.fixedPoint(...arguments_);
          },
        };
      }, {
        declarations: [declaration], invocations: [], subject, subjectFor: subject,
        invocationInputs: () => assert.fail("these complete source bodies have no invocation"),
        inputsFor: () => assert.fail("these parameters have no initializer or forwarding expression"),
        implementationsFor: () => assert.fail("these complete source bodies have no invocation"),
        unresolvedFor: () => assert.fail("these complete source bodies have no invocation"),
      });
      assert.equal("publish" in summary, false, "one demand entry owns final immutable summary publication");
      summary.closeInputs();
      assert.equal(solvers, 0, "a fully admitted empty equation retains no unreachable fixed-point cells");
      const parameters = sourceCallableValueParameters(current.source.ast, declaration,
        current.source.semantics.forNode(declaration), { kind: "declaration" });
      assert.equal(parameters !== undefined, true, "the input vector is the actual checked implementation");
      for (const parameter of parameters) {
        const selected = summary.get(declaration, parameter);
        if (budget.failure() === undefined) {
          assert.equal(selected.kind, "complete", "a completed empty relation is actual proof");
          assert.equal(selected.members.length, 0, "the exact admitted write set is empty");
          assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.members), true, "publication stays immutable");
          assert.equal(summary.get(declaration, parameter) === selected, true, "reads use the identical sealed result");
        } else {
          assert.equal(selected.kind, "unresolved", "finite failure never becomes an empty proof");
          assert.equal(selected.reason, budget.failure(), "the original finite refusal dominates the empty equation");
        }
      }
    }
  }
});

test("formal write inputs close irreversibly before demand and demands stop at the target seal", () => {
  const current = formalFixture("function replace(owner: Reader) { owner.read = () => 3; }");
  const declaration = current.callable("replace");
  const parameter = current.parameter(declaration, "owner");
  const subject = (node, kind = "value") => {
    const selected = current.storage.subject(node, kind);
    assert.equal(selected.kind, "resolved", "the builder retains the original checked subject");
    return selected.subject;
  };
  const reference = current.nodes.find(current.source.ast.is.IsPropertyAccessExpression);
  const occurrence = current.storage.writeAt(reference, current.storage.emptyBindings);
  assert.equal(occurrence.kind, "resolved", "the write is the actual collected member mutation");
  const summary = createSourceStorageFormalMemberWrites(current.source,
    createSourceStorageBudget(defaultSourceStorageLimits), createSourceStorageGraphQueries, {
      declarations: [declaration], invocations: [], subject, subjectFor: subject,
      invocationInputs: () => assert.fail("this body contains no invocation"),
      inputsFor: () => assert.fail("the receiver is the exact parameter"),
      implementationsFor: () => assert.fail("this body contains no invocation"),
      unresolvedFor: () => assert.fail("this body contains no invocation"),
    });
  assert.throws(() => summary.get(declaration, parameter), /requires closed write inputs/u);
  assert.throws(() => summary.seal(), /seal once after their inputs close/u);
  summary.recordWrite(occurrence.write);
  summary.closeInputs();
  assert.throws(() => summary.recordWrite(occurrence.write), /cannot change after their final publication/u);
  assert.throws(() => summary.closeInputs(), /close exactly once/u);
  const selected = summary.get(declaration, parameter);
  assert.equal(selected.kind, "complete", "all original writes participate in the one demanded summary");
  assert.equal(selected.members.length, 1, "the original mutation is not lost at closure");
  assert.equal(selected.members[0] === current.member(), true, "the exact checked member is retained");
  assert.equal(summary.get(declaration, parameter) === selected, true, "one publication per requested key");
  summary.seal();
  assert.throws(() => summary.get(declaration, parameter), /cannot run after target sealing/u);
  assert.throws(() => summary.seal(), /seal once after their inputs close/u);
});

test("one bounded formal closure cannot exhaust another formal's request in either order", () => {
  const methods = Array.from({ length: 40 }, (_, index) => `method${index}`);
  const current = formalFixture(`
    interface Reader { ${methods.map(name => `${name}(): number;`).join(" ")} }
    function replace(owner: Reader, other: Reader) {
      ${methods.map(name => `owner.${name} = () => 3;`).join("\n")}
    }
  `);
  const declaration = current.callable("replace");
  const writes = current.nodes.filter(current.source.ast.is.IsPropertyAccessExpression).map(reference => {
    const occurrence = current.storage.writeAt(reference, current.storage.emptyBindings);
    assert.equal(occurrence.kind, "resolved", "each seed is a real collected source member mutation");
    return occurrence.write;
  });
  assert.equal(writes.length, methods.length, "all distinct checked member writes participate");
  const select = order => {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 64 });
    const subject = (node, kind = "value") => {
      const selected = current.storage.subject(node, kind);
      assert.equal(selected.kind, "resolved", "each formal uses its identical original checked subject");
      return selected.subject;
    };
    const summary = createSourceStorageFormalMemberWrites(current.source, budget, createSourceStorageGraphQueries, {
      declarations: [declaration], invocations: [], subject, subjectFor: subject,
      invocationInputs: () => assert.fail("these write bodies have no invocation"),
      inputsFor: () => assert.fail("these receivers are original parameter bindings"),
      implementationsFor: () => assert.fail("these write bodies have no invocation"),
      unresolvedFor: () => assert.fail("these write bodies have no invocation"),
    });
    for (const write of writes) summary.recordWrite(write);
    assert.equal(budget.failure() === undefined, true, "all write inputs close within the unchanged row selection");
    summary.closeInputs();
    const results = new Map(order.map(name => [name, summary.get(declaration, current.parameter(declaration, name))]));
    assert.equal(results.get("owner").kind, "unresolved", "the larger closure reaches its own finite bound");
    assert.match(results.get("owner").reason, /transport-row budget/u);
    assert.equal(results.get("other").kind, "complete", "an unrelated empty closure retains its own budget");
    assert.equal(results.get("other").members.length, 0, "no unrelated member is fabricated");
    for (const name of order) assert.equal(summary.get(declaration, current.parameter(declaration, name)) === results.get(name),
      true, `${name}: one immutable result is stored for the requested key`);
    summary.seal();
    assert.throws(() => summary.get(declaration, current.parameter(declaration, "other")), /cannot run after target sealing/u);
    return results;
  };
  const first = select(["owner", "other"]);
  const second = select(["other", "owner"]);
  assert.equal(first.get("owner").reason, second.get("owner").reason, "the finite outcome is identical in the opposite order");
  assert.equal(first.get("other").members.length, second.get("other").members.length, "the complete outcome is identical in the opposite order");
});

test("formal summary order and finite refusals are independent across the same requested key set", () => {
  const declarations = `
    declare function opaque(owner: Reader): void;
    function read(owner: Reader) { return owner.read(); }
    function sink(owner: Reader) { owner.read = () => 3; }
    function forward(owner: Reader) { sink(owner); }
    function recursive(owner: Reader, depth: number) { if (depth > 0) recursive(owner, depth - 1); sink(owner); }
    function unknown(owner: Reader) { opaque(owner); }
  `;
  const names = ["read", "sink", "forward", "recursive", "unknown"];
  for (const maximumSteps of [1024, 4096, defaultSourceStorageLimits.maximumSteps]) {
    const current = formalFixture(declarations, {}, { maximumSteps });
    const second = createSourceStorageQuery(current.source, current.sourceFiles,
      { ...defaultSourceStorageLimits, maximumSteps });
    const firstResults = new Map(names.map(name => [name, current.query(name)]));
    const secondResults = new Map([...names].reverse().map(name => {
      const declaration = current.callable(name);
      return [name, second.formalMemberWriteDemand(declaration, current.parameter(declaration, "owner"))];
    }));
    for (const name of names) {
      const first = firstResults.get(name);
      const other = secondResults.get(name);
      assert.equal(first.kind, other.kind, `${maximumSteps}/${name}: result kind is order-independent`);
      if (first.kind === "unresolved") {
        assert.equal(first.reason, other.reason, `${maximumSteps}/${name}: identical finite or semantic refusal`);
      } else {
        assert.equal(first.members.length, other.members.length, `${maximumSteps}/${name}: exact member count`);
        assert.equal(first.members.every(member => other.members.includes(member)), true,
          `${maximumSteps}/${name}: identical original member identities`);
      }
      if (current.storage.failureReason() === undefined)
        assert.equal(current.query(name) === first, true, `${maximumSteps}/${name}: one stored result per admitted key`);
    }
    if (maximumSteps === defaultSourceStorageLimits.maximumSteps) {
      assert.equal(firstResults.get("forward").kind, "complete", "transitive dependencies complete");
      assert.equal(firstResults.get("forward").members[0] === current.member(), true, "forwarded original member");
      assert.equal(firstResults.get("unknown").kind, "unresolved", "unknown callee effects are not empty proof");
    }
    current.storage.sealFormalMemberWriteDemands();
    assert.throws(() => current.query("sink"), /cannot run after target sealing/u);
    const declaration = current.callable("sink");
    assert.equal(second.formalMemberWriteDemand(declaration, current.parameter(declaration, "owner")).kind,
      secondResults.get("sink").kind, "sealing one target query does not disable another target on the same source");
    second.sealFormalMemberWriteDemands();
  }
});

for (const opaque of [false, true]){
test(`empty formal equations validate original invocation effects before omitting unrelated closure (${opaque})`, () => {
  const current = formalFixture(`
    ${opaque ? "declare function consume(owner: Reader): void;" : "function consume(owner: Reader): void {}"}
    function forward(owner: Reader) { consume(owner); }
  `);
  const invocation = current.nodes.find(current.source.ast.is.IsCallExpression);
  assert.equal(invocation !== undefined, true, "the original checked call is present");
  const semantics = current.source.semantics.forNode(invocation);
  const selected = semantics.operations.call(invocation);
  assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "the original invocation has its exact checked signature");
  const implementation = selected?.selectedSignature === undefined ? undefined
    : semantics.declarations.signatureDeclaration(selected.selectedSignature);
  assert.equal(implementation !== undefined, true, "the selected checked declaration is retained");
  const declaration = current.callable("forward");
  const parameter = current.parameter(declaration, "owner");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const subject = (node, kind = "value") => {
    const selected = current.storage.subject(node, kind);
    assert.equal(selected.kind, "resolved", "every summary input is the original checked subject");
    return selected.subject;
  };
  let mapped = 0;
  const summary = createSourceStorageFormalMemberWrites(current.source, budget, createSourceStorageGraphQueries, {
    declarations: [declaration, ...opaque ? [] : [implementation]], invocations: [invocation], subject, subjectFor: subject,
    invocationInputs(formal, candidate, actual) {
      mapped += 1;
      assert.equal(candidate === implementation && actual === invocation, true, "the original selected body and invocation are unchanged");
      const selected = current.storage.argumentTransportsFor(actual);
      assert.equal(selected.kind, "resolved", "the canonical selected argument transports are complete");
      return { subjects: new Set(selected.arguments.filter(input => input.formal === formal).map(input => input.actual)),
        context: "caller", omitted: false };
    },
    inputsFor: () => assert.fail("a validated zero-seed member equation has no demanded transitive producer closure"),
    implementationsFor: actual => {
      assert.equal(actual === invocation, true, "only the checked original invocation is inspected");
      return { nodes: new Set([implementation]), exact: true };
    },
    unresolvedFor: () => undefined,
  });
  summary.closeInputs();
  const result = summary.get(declaration, parameter);
  assert.equal(mapped, opaque ? 0 : 1, "every known input mapping is validated once; an opaque body is not fabricated");
  assert.equal(budget.failure() === undefined, true, "the original finite work owner remains healthy");
  if (opaque) {
    assert.equal(result.kind, "unresolved", "missing body effects cannot publish an empty write proof");
    assert.match(result.reason, /unknown|bodyless/u);
  } else {
    assert.equal(result.kind, "complete", "all original closed body effects have been checked");
    assert.equal(result.members.length, 0, "the exact zero-seed equation has no member writes");
    assert.equal(Object.isFrozen(result.members), true, "empty publication is immutable data");
  }
});
}

test("formal member demands consume the complete checked callable-body inventory once", () => {
  const current = formalFixture(`
    function authored(owner: Reader): void;
    function authored(owner: Reader) { owner.read = () => 1; }
    const expression = function(owner: Reader) { owner.read = () => 2; };
    const arrow = (owner: Reader) => { owner.read = () => 3; };
    class Methods {
      constructor(owner: Reader) { owner.read = () => 4; }
      method(owner: Reader) { owner.read = () => 5; }
      set value(owner: Reader) { owner.read = () => 6; }
      get value(): Reader { return { read() { return 0; } }; }
    }
  `);
  let inputs = 0;
  for (const declaration of current.nodes) {
    if (!isSourceCallableBodyBoundary(current.source.ast, declaration) || current.source.ast.body(declaration) === undefined) continue;
    const parameters = sourceCallableValueParameters(current.source.ast, declaration,
      current.source.semantics.forNode(declaration), { kind: "declaration" });
    assert.equal(parameters !== undefined, true, "the original body supplies its complete runtime parameter vector");
    for (const parameter of parameters) {
      if (current.source.ast.text(current.source.ast.name(parameter)) !== "owner") continue;
      const selected = current.storage.formalMemberWriteDemand(declaration, parameter);
      assert.equal(selected.kind, "complete", `${current.source.ast.kindName(declaration)}: ${selected.reason ?? ""}`);
      assert.equal(selected.members.length, 1, "the exact collected body retains its member write");
      assert.equal(selected.members[0] === current.member(), true, "all body kinds retain identical checked member evidence");
      inputs += 1;
    }
  }
  assert.equal(inputs, 6, "declaration/expression/arrow/constructor/method/setter bodies all participate, not overload declarations");
});

test("formal member demands separate readonly consumers from the actual writer and physical producers", () => {
  const current = formalFixture(`
    const fixed = { read() { return 1; } };
    const changed = { read() { return 2; } };
    function read(owner: Reader) { return owner.read(); }
    function replace(owner: Reader) { owner.read = () => 3; }
    read(fixed); replace(changed); read(changed);
  `);
  current.complete("read", []);
  const demand = current.complete("replace", [current.member()]);
  assert.equal(current.query("replace") === demand, true, "repeated reads return the identical prepublished result");
  for (const [name, count] of [["fixed", 0], ["changed", 1]]) {
    const declaration = current.nodes.find(node => current.source.ast.is.IsVariableDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === name);
    const initializer = current.source.ast.as.AsVariableDeclaration(declaration).Initializer;
    const member = current.source.ast.properties(initializer).find(node => current.source.ast.text(current.source.ast.name(node)) === "read");
    const subject = current.storage.memberSubjectFor(member);
    assert.equal(subject.kind, "resolved", `${name}: actual authored physical slot`);
    const writers = current.storage.memberWritesFor(subject.subject);
    assert.equal(writers.kind, "complete", `${name}: closed physical writer inventory`);
    assert.equal(writers.writes.length, count, `${name}: destination-specific writes are not joined into all formal producers`);
  }
  assert.equal(current.storage.failureReason() === undefined, true, "formal summaries preserve all original finite storage evidence");
});
