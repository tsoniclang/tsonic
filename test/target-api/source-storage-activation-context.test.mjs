import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(name, text, effectsFor) {
  const checked = await checkedSource(name, {
    "globals.d.ts": `
      interface Object {} interface Function {} interface CallableFunction extends Function {}
      interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
      interface Number {} interface String {} interface RegExp {}
      interface Array<T> { [index: number]: T; length: number; }
      interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
    `,
    "src/index.ts": text,
  });
  assert.equal(checked.diagnostics.length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const file = projectSourceFile(source, "src/index.ts");
  const { ast } = source;
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, undefined, effectsFor?.(source, nodes));
  const declaration = name => nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === name);
  const subject = (node, kind) => {
    const selected = storage.subject(node, kind);
    assert.equal(selected.kind, "resolved");
    return selected.subject;
  };
  return { ast, nodes, source, storage, declaration, subject };
}

function resolved(selection) {
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "exact selection");
  return selection;
}

test("argument closure frontier retains its caller's symbolic enclosing activation", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-argument-capture", `
    export function source<Value>(callback: () => Value): Value { return callback(); }
    export function scoped<Value>(value: Value): Value { return source(() => value); }
  `);
  const owner = declaration("scoped");
  const callee = declaration("source");
  const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "source");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const independent = resolved(storage.bindingsForInvocation(callee, invocation)).bindings;
  resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), independent, []));
  const callerBindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const calledBindings = resolved(storage.bindingsForInvocation(callee, invocation, callerBindings)).bindings;
  const frontier = resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), calledBindings, []));
  assert.equal(frontier.frontier.length, 1, "one exact argument closure activation");
  assert.equal(frontier.frontier[0].subject.node === arrow, true);
  const activation = resolved(storage.boundActivationsFor(owner, frontier.frontier[0].bindings));
  assert.equal(activation.activations.length === 1 && activation.activations[0].kind === "declaration" &&
    activation.activations[0].bindings === callerBindings, true);
  const boundary = subject(arrow, "value");
  const stopped = resolved(storage.boundValueFrontierFor(subject(ast.parameters(callee)[0], "input"), calledBindings, [boundary]));
  assert.equal(stopped.frontier.length === 1 && stopped.frontier[0].kind === "boundary" &&
    stopped.frontier[0].subject === boundary && stopped.frontier[0].bindings === callerBindings, true,
  "a closure expression boundary retains its creation environment");
  assert.equal(storage.boundActivationsFor(arrow, stopped.frontier[0].bindings).kind, "unresolved",
    "creating a closure does not fabricate an activation of its body");
});

test("symbolic nested parameter frontier retains the declaration and its enclosing activation", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-nested-parameter", `
    export function run<Value>() {
      const read = (value: Value): Value => value;
      return read;
    }
  `);
  const owner = declaration("run");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const independent = resolved(storage.bindingsForDeclaration(arrow)).bindings;
  const lexical = resolved(storage.bindingsForLexicalOwner(arrow)).bindings;
  resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), independent, []));
  const enclosingBindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const arrowBindings = resolved(storage.bindingsForDeclaration(arrow, enclosingBindings)).bindings;
  assert.equal(lexical === arrowBindings, true, "lexical selection retains exactly the checked enclosing declarations");
  const frontier = resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), arrowBindings, []));
  assert.equal(frontier.frontier.length, 1, "one exact symbolic parameter activation");
  assert.equal(frontier.frontier[0].subject.node === ast.parameters(arrow)[0], true);
  const activation = resolved(storage.boundActivationsFor(arrow, frontier.frontier[0].bindings));
  const enclosing = resolved(storage.boundActivationsFor(owner, activation.activations[0].bindings));
  assert.equal(enclosing.activations.length === 1 && enclosing.activations[0].kind === "declaration" &&
    enclosing.activations[0].bindings === enclosingBindings, true);
  const independentAgain = resolved(storage.boundValueFrontierFor(subject(ast.parameters(arrow)[0], "input"), independent, []));
  assert.equal(independentAgain.frontier.length, 1, "query order cannot merge lexical contexts");
  assert.equal(storage.boundActivationsFor(owner, independentAgain.frontier[0].bindings).kind, "unresolved",
    "an independently selected declaration does not acquire an invented outer activation");
});

test("one nested declaration keeps symbolic and distinct invocation environments isolated in either query order", async () => {
  const { ast, nodes, storage, declaration, subject } = await fixture("source-activation-distinct-callers", `
    export function outer<Value>(value: Value) {
      const read = (item: Value): Value => item;
      return read;
    }
    const first = outer(1);
    const second = outer("second");
  `);
  const outer = declaration("outer");
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const invocations = nodes.filter(node => ast.is.IsCallExpression(node));
  const parameter = subject(ast.parameters(arrow)[0], "input");
  const parents = [
    storage.emptyBindings,
    resolved(storage.bindingsForDeclaration(outer)).bindings,
    ...invocations.map(invocation => resolved(storage.bindingsForInvocation(outer, invocation)).bindings),
  ];
  const bindings = parents.map(parent => resolved(storage.bindingsForDeclaration(arrow, parent)).bindings);
  assert.equal(new Set(bindings).size, bindings.length, "each declared frame owns its exact parent");
  for (let pass = 0; pass < 3; pass += 1) {
    for (const index of pass === 1 ? [3, 2, 1, 0] : [0, 1, 2, 3]) {
      const selected = resolved(storage.boundValueFrontierFor(parameter, bindings[index], []));
      assert.equal(selected.frontier.length, 1, `context ${index}, pass ${pass}`);
      assert.equal(selected.frontier[0].subject === parameter && selected.frontier[0].bindings === bindings[index], true);
      const own = resolved(storage.boundActivationsFor(arrow, selected.frontier[0].bindings));
      assert.equal(own.activations.length === 1 && own.activations[0].kind === "declaration" &&
        own.activations[0].bindings === bindings[index], true);
      const enclosing = storage.boundActivationsFor(outer, own.activations[0].bindings);
      if (index === 0) {
        assert.equal(enclosing.kind, "unresolved", "no enclosing activation may be invented");
        continue;
      }
      resolved(enclosing);
      assert.equal(enclosing.activations.length, 1);
      const activation = enclosing.activations[0];
      assert.equal(activation.bindings === parents[index], true);
      assert.equal(activation.kind, index === 1 ? "declaration" : "invocation");
      assert.equal(Object.isFrozen(activation) && Object.isFrozen(activation.bindings), true);
      if (activation.kind === "invocation") {
        assert.equal(activation.invocation === invocations[index - 2], true);
        assert.equal(activation.callerBindings === storage.emptyBindings, true);
        const actual = resolved(storage.boundOriginsFor(subject(ast.parameters(outer)[0], "input"), activation.bindings));
        assert.equal(actual.subjects.length === 1 &&
          actual.subjects[0].node === ast.arguments(activation.invocation)[0], true,
        "number and string arguments retain their distinct exact source identities");
      }
      assert.equal(resolved(storage.bindingsForDeclaration(arrow, parents[index])).bindings === bindings[index], true,
        "repeated exact contexts reuse their canonical declaration frame");
    }
  }
  assert.equal(storage.failureReason(), undefined);
});

test("activation queries reject foreign and fabricated context identities without touching getters", async () => {
  const current = await fixture("source-activation-owned-contexts", "export function outer<Value>(value: Value) { return value; }");
  const foreign = await fixture("source-activation-foreign-contexts", "export function outer<Value>(value: Value) { return value; }");
  const owner = current.declaration("outer");
  const bindings = resolved(current.storage.bindingsForDeclaration(owner)).bindings;
  const accessor = Object.defineProperty({}, "substitutions", { get: () => assert.fail("forged bindings accessor executed") });
  for (const candidate of [foreign.storage.emptyBindings, {}, Object.create(bindings), accessor, null]) {
    assert.equal(current.storage.boundActivationsFor(owner, candidate).kind, "unresolved");
  }
  assert.equal(current.storage.boundActivationsFor(foreign.declaration("outer"), bindings).kind, "unresolved");
  const valid = resolved(current.storage.boundActivationsFor(owner, bindings));
  assert.equal(valid.activations.length === 1 && valid.activations[0].bindings === bindings, true,
    "invalid context queries cannot poison independently valid evidence");
});

test("activation selection preserves every independent source-storage resource limit", async () => {
  const current = await fixture("source-activation-budgets", "export function outer<Value>(value: Value) { return value; }");
  for (const limit of Object.keys(defaultSourceStorageLimits)) {
    const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles,
      { ...defaultSourceStorageLimits, [limit]: 1 });
    assert.equal(storage.boundActivationsFor(current.declaration("outer"), storage.emptyBindings).kind, "unresolved", limit);
    assert.equal(storage.failureReason() !== undefined, true, limit);
  }
});

for (const recursive of [false, true]) {
  test(`explicit callback entry keeps complete ${recursive ? "recursive" : "direct"} callback/value activations correlated`, async () => {
    const helper = recursive ? `function deliver<Value>(callback: (value: Value) => void, value: Value, count: number): void {
      if (count > 0) bounce(callback, value, count - 1); else callback(value);
    } function bounce<Value>(callback: (value: Value) => void, value: Value, count: number): void {
      if (count > 0) deliver(callback, value, count - 1); else callback(value);
    }` : "function deliver<Value>(callback: (value: Value) => void, value: Value, count: number): void { callback(value); }";
    const current = await fixture(`source-entry-${recursive ? "recursive" : "direct"}-pairs`, `${helper}
      export function create<Value>(value: Value) {
        return (resolve: (value: number) => void): void => {
          deliver(resolve, 7, 2); deliver((item: Value) => { void item; }, value, 2);
        };
      }`);
    const { ast, nodes, storage, declaration, subject } = current;
    const entryNode = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parameters(node).some(parameter =>
      ast.text(ast.name(parameter)) === "resolve"));
    const creation = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const original = resolved(storage.subjectFor(entryNode)).subject;
    const domain = storage.storageProducersFor(original, creation);
    assert.notEqual(domain.kind, "unresolved", domain.kind === "unresolved" ? domain.reason : "exact callback creation");
    const producer = domain.producers.find(value => value.subject === original);
    assert.equal(producer !== undefined, true, "the actual source callback has its retained creation bindings");
    const resolver = subject(ast.parameters(entryNode)[0], "input");
    for (const owner of recursive ? [declaration("deliver"), declaration("bounce")] : [declaration("deliver")]) {
      const callee = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback" &&
        storage.enclosingRegionFor(node) === ast.body(owner));
      const operand = resolved(storage.subjectFor(ast.as.AsCallExpression(callee).Expression)).subject;
      const value = resolved(storage.subjectFor(ast.arguments(callee)[0])).subject;
      const expected = new Set(["number", "generic"]);
      for (let pass = 0; pass < 2; pass += 1) {
        const selected = storage.contributingExecutionsFor(operand, owner, producer);
        assert.equal(selected.kind, "complete", "the actual source-only entry has complete execution evidence");
        const activations = selected.producers.flatMap(current => resolved(storage.boundActivationsFor(owner, current.bindings)).activations);
        assert.equal(activations.length > 0, true, "the explicitly entered callback reaches the real helper execution");
        const observed = new Set();
        for (const activation of pass === 0 ? activations : activations.slice().reverse()) {
          assert.equal(activation.kind, "invocation", "the helper is invoked, never an invented declaration boundary");
          const callbacks = storage.storageProducersFor(operand, activation.bindings);
          assert.notEqual(callbacks.kind, "unresolved", callbacks.kind === "unresolved" ? callbacks.reason : "bound callback");
          const actuals = resolved(storage.boundOriginsFor(value, activation.bindings));
          assert.equal(actuals.subjects.length, 1, "one correlated value per helper activation");
          const isResolver = callbacks.producers.some(candidate => candidate.subject === resolver);
          const typed = storage.typeFor(actuals.subjects[0]);
          assert.equal(typed.kind, "resolved", "the same activation supplies the checked value type");
          const semantics = current.source.semantics.forFile(typed.sourceFile);
          const symbol = semantics.declarations.typeSymbol(typed.type);
          const isParameter = symbol !== undefined && semantics.declarations.symbolDeclarations(symbol)
            .some(candidate => ast.is.IsTypeParameterDeclaration(candidate));
          assert.equal(isResolver ? semantics.types.isNumberLike(typed.type) : isParameter, true,
            "a resolver/number row never acquires the ordinary callback's generic argument");
          observed.add(isResolver ? "number" : "generic");
          assert.equal(Object.isFrozen(activation) && Object.isFrozen(activation.bindings), true,
            "contributing execution facts are immutable");
        }
        assert.deepEqual(observed, expected, "both actual rows survive either query order");
      }
    }
    assert.equal(storage.failureReason(), undefined, "the existing finite equation budget is unchanged");
  });
}

test("explicit callback entry preserves an annotated returned executor's real creation activation", async () => {
  const { ast, nodes, storage, declaration } = await fixture("source-entry-returned-executor", `
    type Executor<Value> = (resolve: (value: Value) => void) => void;
    function make<Value>(value: Value): Executor<Value> { return resolve => resolve(value); }
    const first = make(7); const second = make("second");
  `);
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const invoked = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "resolve");
  const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(invoked).Expression)).subject;
  const argument = resolved(storage.subjectFor(ast.arguments(invoked)[0])).subject;
  const creations = nodes.filter(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "make");
  const selectedBindings = [];
  for (const creation of creations) {
    const subject = resolved(storage.subjectFor(creation)).subject;
    const producers = storage.storageProducersFor(subject);
    assert.equal(producers.kind, "complete", "the exact returned arrow, not its signature-only alias, is created");
    assert.equal(producers.producers.length, 1, "one actual retained executor implementation");
    const producer = producers.producers[0];
    assert.equal(producer.subject.node === arrow, true, "the implementation is the checked returned arrow");
    const selected = storage.contributingExecutionsFor(callee, arrow, producer);
    assert.equal(selected.kind, "complete", "the actual source executor has complete execution evidence");
    const activations = selected.producers.flatMap(current => resolved(storage.boundActivationsFor(arrow, current.bindings)).activations);
    assert.equal(activations.length, 1, "one explicit entry into this actual executor creation");
    assert.equal(activations[0].kind, "declaration", "a native callback entry is not a fabricated source invocation");
    const actual = resolved(storage.boundOriginsFor(argument, activations[0].bindings));
    assert.equal(actual.subjects.length === 1 && actual.subjects[0].node === ast.arguments(creation)[0], true,
      "the executor retains its own factory call's actual argument");
    selectedBindings.push(activations[0].bindings);
    const factory = resolved(storage.boundActivationsFor(declaration("make"), producer.bindings));
    assert.equal(factory.activations.length === 1 && factory.activations[0].kind === "invocation" &&
      factory.activations[0].invocation === creation, true, "the real factory activation is preserved");
  }
  assert.equal(new Set(selectedBindings).size, 2, "the two executor creations are never merged by their arrow AST");
});

test("explicit callback entry rejects foreign or fabricated evidence and does not invent unreachable bodies", async () => {
  const text = "function other(callback: () => void): void { callback(); } export function create() { return () => {}; }";
  const current = await fixture("source-entry-owned", text);
  const foreign = await fixture("source-entry-foreign", text);
  const { ast, nodes, storage, declaration } = current;
  const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
  const entry = { subject: resolved(storage.subjectFor(arrow)).subject,
    bindings: resolved(storage.bindingsForDeclaration(declaration("create"))).bindings };
  const use = nodes.find(node => ast.is.IsCallExpression(node));
  const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
  const selected = storage.contributingExecutionsFor(callee, declaration("other"), entry);
  assert.equal(selected.kind, "complete", "the unused body's absence has complete source evidence");
  assert.equal(selected.producers.length, 0, "an explicit empty callback cannot fabricate an unrelated helper invocation");
  const forged = Object.defineProperty({}, "subject", { get: () => assert.fail("forged entry getter executed") });
  for (const invalid of [undefined, null, {}, forged, { ...entry, bindings: foreign.storage.emptyBindings },
    { ...entry, subject: foreign.subject(foreign.declaration("create")) }]) {
    assert.equal(storage.contributingExecutionsFor(callee, declaration("other"), invalid).kind, "unresolved",
      "every execution entry needs the identical source graph and retained binding identity");
  }
  assert.equal(storage.contributingExecutionsFor(callee, foreign.declaration("other"), entry).kind, "unresolved",
    "a demanded owner from another source is not accepted");
  assert.equal(storage.failureReason(), undefined, "rejected forged evidence does not poison valid owned selection");
});

function nativeContract(timing, positions = [0]) {
  return (source, nodes) => {
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(native !== undefined && source.ast.body(native) === undefined, true,
      "the fixture fact belongs to one actual checked native signature, not a name-only call matcher");
    return Object.freeze({ callbackEntries(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return declaration === native ? positions.map(parameterIndex => Object.freeze({ parameterIndex, timing })) : undefined;
    } });
  };
}

for (const reversed of [false, true]) for (const timing of ["synchronous", "deferred", undefined]) {
  test("native entry ports preserve actual producer creation and input correlation: " + timing + "/" + reversed, async () => {
    const current = await fixture("native-entry-ports-" + timing, `
      declare function observe<Value>(value: Value): void;
      declare function nativeInvoke(fulfilled: () => void, rejected: () => void): void;
      export function create<Value>(first: Value, second: Value) {
        function make(value: Value): () => void { return () => { observe(value); }; }
        return () => { nativeInvoke(make(first), make(second)); };
      }
    `, timing === undefined ? undefined : nativeContract(timing, [0, 1]));
    const { source, ast, nodes, storage, declaration } = current;
    const native = nodes.find(node => ast.is.IsCallExpression(node) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const callback = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(native));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the actual executor creation is closed");
    assert.equal(domain.producers.length, 1, "one original executor, not two invented source calls");
    const demanded = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
    const value = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
    const callbackArguments = storage.nativeCallbackArgumentsFor(native);
    assert.equal(callbackArguments.kind, timing === undefined ? "open" : "resolved", "native lifecycle uncertainty remains explicit");
    assert.equal(callbackArguments.arguments.length, 2, "both actual native callback ports are retained");
    assert.equal(callbackArguments.arguments[0].binding.sourceArgumentIndex, 0);
    assert.equal(callbackArguments.arguments[1].binding.sourceArgumentIndex, 1);
    const entry = domain.producers[0];
    const expected = new Set(ast.parameters(declaration("create")));
    const views = [];
    for (let pass = 0; pass < 2; pass += 1) {
      const selected = storage.contributingExecutionsFor(demanded, callback, entry);
      assert.equal(selected.kind, timing === undefined ? "open" : "complete", "demand-local native execution status");
      assert.equal(selected.producers.length, 2, "one correlated execution for each selected native callback port");
      const observed = new Set();
      const bindings = new Set();
      for (const producer of (pass === 0) !== reversed ? selected.producers : selected.producers.slice().reverse()) {
        assert.equal(producer.subject === demanded, true, "the original actual demanded value is retained");
        const activation = resolved(storage.boundActivationsFor(callback, producer.bindings));
        assert.equal(activation.activations.length, 1, "one actual native entry frame");
        assert.equal(activation.activations[0].kind, "declaration", "not a fabricated ordinary project call");
        const origins = resolved(storage.boundOriginsFor(value, producer.bindings));
        assert.equal(origins.subjects.length, 1, "same-frame value, never a callback/value cross product");
        const nativeEntry = activation.activations[0].nativeEntry;
        assert.equal(nativeEntry !== undefined && nativeEntry.invocation === native, true,
          "a native entry retains its actual native invocation, not a fabricated project invocation");
        const position = nativeEntry.argument.binding.sourceArgumentIndex;
        assert.equal(position === 0 || position === 1, true, "one exact checked native callback port");
        assert.equal(nativeEntry.argument === callbackArguments.arguments[position], true,
          "the native entry transports the identical completed argument evidence");
        assert.equal(origins.subjects[0].node === ast.parameters(declaration("create"))[position], true,
          "each selected native port retains its own actual callback creation binding");
        observed.add(origins.subjects[0].node);
        bindings.add(producer.bindings);
      }
      assert.equal(bindings.size, 2, "native formal/actual port and real creation context survive every key");
      assert.equal([...expected].every(node => observed.has(node)) && observed.size === expected.size, true,
        "first and second actual capture values survive either query order");
      if (selected.kind === "open") assert.equal(selected.boundaries.every(boundary => boundary.exposure === native), true,
        "unknown execution is located at the actual native exposure");
      views.push(selected.producers.map(producer => producer.bindings));
    }
    assert.equal(views[0].every(binding => views[1].includes(binding)), true, "fresh and reverse reads preserve canonical frame identity");
    assert.equal(storage.failureReason() === undefined, true, "opaque execution is not a global budget failure");
    assert.equal(source.ast.body(callback) !== undefined, true, "the producer is the real checked source body");
  });
}

test("source/native recursion closes in the existing finite callback equations", async () => {
  const current = await fixture("native-entry-recursive-equation", `
    declare function nativeInvoke(callback: () => void): void;
    function deliver<Value>(callback: (value: Value) => void, value: Value, depth: number): void {
      if (depth === 0) { callback(value); return; }
      nativeInvoke(() => { deliver(callback, value, depth - 1); });
    }
    export function create<Value>(value: Value) {
      return (done: (value: Value) => void) => { deliver(done, value, 3); };
    }
  `, nativeContract("synchronous"));
  const { ast, nodes, storage, declaration } = current;
  const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
  const entryNode = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parameters(node).length === 1);
  const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
  const domain = storage.storageProducersFor(resolved(storage.subjectFor(entryNode)).subject, outer);
  assert.equal(domain.kind, "complete", "actual recursive executor creation");
  const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
  const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
  for (let pass = 0; pass < 2; pass += 1) {
    const selected = storage.contributingExecutionsFor(callee, declaration("deliver"), domain.producers[0]);
    assert.equal(selected.kind, "complete", "source/native cycle has one completed finite relation");
    assert.equal(selected.producers.length > 0, true, "the recursive source use is reached");
    for (const producer of selected.producers) {
      const origins = resolved(storage.boundOriginsFor(argument, producer.bindings));
      assert.equal(origins.subjects.every(subject => subject.node === ast.parameters(declaration("create"))[0]), true,
        "every recursive row preserves the same actual source value");
    }
  }
  assert.equal(storage.failureReason() === undefined, true, "no new budget or late solver bootstrap");
});

test("deferred callbacks retain captured locations rather than registration-time value snapshots", async () => {
  const current = await fixture("native-entry-live-location", `
    declare function nativeInvoke(callback: () => void): void;
    declare function observe(value: number): void;
    export function create(first: number, second: number) {
      let selected = first;
      return () => {
        nativeInvoke(() => { observe(selected); });
        selected = second;
      };
    }
  `, nativeContract("deferred"));
  const { ast, nodes, storage, declaration } = current;
  const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
  const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
  const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(invocation));
  const callback = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
  const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
  const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
  assert.equal(domain.kind, "complete", "actual executor is retained");
  const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
    callback, domain.producers[0]);
  assert.equal(selected.kind, "complete", "native deferred source entry is known");
  const input = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
  const actuals = selected.producers.flatMap(producer => resolved(storage.boundOriginsFor(input, producer.bindings)).subjects);
  assert.equal(actuals.some(subject => subject.node === ast.parameters(declaration("create"))[1]), true,
    "the captured location includes the post-registration write; first is not snapshotted as its only value");
});

test("a deferred store is not applied inline to an immediate native-owner read", async () => {
  const current = await fixture("native-entry-not-inline", `
    declare function nativeInvoke(callback: () => void): void;
    declare function observe(value: number): void;
    function run(): void {
      let value = 1;
      nativeInvoke(() => { value = 2; });
      observe(value);
    }
    run();
  `, nativeContract("deferred"));
  const { ast, nodes, storage, declaration } = current;
  const read = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
  const subject = resolved(storage.subjectFor(ast.arguments(read)[0])).subject;
  const entry = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "run");
  const bindings = resolved(storage.bindingsForInvocation(declaration("run"), entry)).bindings;
  const origins = storage.storageProducersFor(subject, bindings);
  assert.equal(origins.kind, "complete", "the actual immediate invocation read has a closed scoped value domain");
  assert.equal(origins.producers.some(origin => ast.text(origin.subject.node) === "1"), true, "initial value remains");
  assert.equal(origins.producers.some(origin => ast.text(origin.subject.node) === "2"), false,
    "deferred mutation cannot become an inline happens-before write");
});

for (const [name, parameters, used, inputs] of [
  ["mapper", "actual: Part", "actual", [0]],
  ["reduce-element", "accumulator: number, actual: Part", "actual", [1]],
  ["sort-left", "left: Part, right: Part", "left", [0, 1]],
  ["sort-right", "left: Part, right: Part", "right", [0, 1]],
]) {
  test("native input components keep exact actual argument and callback parameter roles: " + name, async () => {
    const current = await fixture("native-component-" + name, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (${parameters}) => void): void;
      export function create(value: number) {
        return () => { nativeInvoke([value], (${parameters.replaceAll("Part", "number")}) => { observe(${used}); }); };
      }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
        source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous", inputs: inputs.map(parameterIndex =>
            ({ parameterIndex, from: "argument-element", sourceParameterIndex: 0 })) }] : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const callback = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) !== ast.body(callback));
    const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
    assert.equal(domain.kind, "complete", "one checked creation domain");
    const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
      callback, domain.producers[0]);
    assert.equal(selected.kind, "complete", "the actual native entry is complete");
    assert.equal(selected.producers.length, 1, "one native invocation with one callback slot");
    const origin = resolved(storage.boundOriginsFor(resolved(storage.subjectFor(ast.arguments(use)[0])).subject,
      selected.producers[0].bindings));
    assert.equal(origin.subjects.length, 1, "one actual element, not the callback function object");
    assert.equal(origin.subjects[0].node === ast.parameters(declaration("create"))[0], true,
      "the canonical array-element relation supplies the original actual argument");
    if (name === "reduce-element") {
      const accumulator = resolved(storage.subject(ast.parameters(callback)[0], "input")).subject;
      const origins = resolved(storage.boundOriginsFor(accumulator, selected.producers[0].bindings));
      assert.equal(origins.subjects.some(subject => subject.node === ast.parameters(callback)[0]), true,
        "native accumulator has only its own checked input bound");
      assert.equal(origins.subjects.some(subject => subject.node === ast.parameters(declaration("create"))[0]), false,
        "element1 cannot be substituted for accumulator0");
    }
  });
}

for (const [name, definition, usesElement, values = "[value]"] of [
  ["this-value", "function deliver(this: void, actual: number): void { observe(actual); }", true],
  ["this-index", "function deliver(this: void, actual: number, index: number): void { void actual; observe(index); }", false],
  ["tuple-rest-value", "function deliver(...items: [actual: number, index: number]): void { observe(items[0]); }", true],
  ["tuple-rest-index", "function deliver(...items: [actual: number, index: number]): void { observe(items[1]); }", false],
  ["array-rest-values", "function deliver(...items: number[]): void { observe(items[0]); }", true],
  ["destructured-component", "function deliver([actual]: [number]): void { observe(actual); }", true, "[[value] as [number]]"],
  ["this-default-required-present", "function deliver(this: void, actual: number = 99): void { observe(actual); }", true],
]) for (const reversed of [false, true]) {
  test("checked native effective slots preserve authored formals and components: " + name + "/" + reversed, async () => {
    const current = await fixture("native-effective-slot-" + name, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part, index: number) => void): void;
      export function create(value: number) {
        ${definition}
        return () => { nativeInvoke(${values}, deliver); };
      }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous", inputs: [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }] }]
          : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const native = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const executor = nodes.find(node => ast.is.IsArrowFunction(node));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the actual executor creation is closed");
    assert.equal(domain.producers.length, 1, "one exact original executor");
    const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
    const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
    if (reversed) resolved(storage.originSubjectsFor(argument));
    const executions = storage.contributingExecutionsFor(callee, declaration("deliver"), domain.producers[0]);
    assert.equal(executions.kind, "complete", "native effective positions have completed checked evidence");
    assert.equal(executions.producers.length, 1, "one actual native callback invocation");
    const origins = resolved(storage.boundOriginsFor(argument, executions.producers[0].bindings));
    assert.equal(origins.subjects.length > 0, true, "the exact value or contextual input is present");
    assert.equal(origins.subjects.some(subject => subject.node === ast.parameters(declaration("create"))[0]), usesElement,
      "this and tuple expansion cannot replace native input0 with input1 or vice versa");
    assert.equal(origins.subjects.some(subject => ast.text(subject.node) === "99"), false,
      "a required present native input does not execute the authored default");
    const activation = resolved(storage.boundActivationsFor(declaration("deliver"), executions.producers[0].bindings));
    assert.equal(activation.activations.length === 1 && activation.activations[0].kind === "declaration" &&
      activation.activations[0].nativeEntry?.invocation === native, true, "the actual native entry is not a fabricated source call");
    assert.equal(storage.failureReason() === undefined, true, "effective slot transport does not invent a budget failure");
  });
}

for (const forwarded of [false, true]) for (const reversed of [false, true]) {
  test("native element callable candidates are indexed before scoped execution: " + forwarded + "/" + reversed, async () => {
    const current = await fixture("native-element-candidate-" + forwarded, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      export function create(first: number, second: number) {
        const firstCallback = (): void => { observe(first); };
        const secondCallback = (): void => { observe(second); };
        const values = [firstCallback, secondCallback];
        const alias = values;
        return () => { nativeInvoke(alias, callback => { ${forwarded ? "nativeInvoke([0], callback);" : "callback();"} }); };
      }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous", inputs: [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }] }]
          : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined && ast.is.IsReturnStatement(ast.parent(node)));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the actual entry creation is complete");
    assert.equal(domain.producers.length, 1, "one checked executor creation");
    const uses = nodes.filter(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    assert.equal(uses.length, 2, "both original callback bodies are retained");
    for (const use of reversed ? [...uses].reverse() : uses) {
      const owner = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
      const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
      const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
      const executions = storage.contributingExecutionsFor(callee, owner, domain.producers[0]);
      assert.equal(executions.kind, "complete", "known native input candidates cannot be pruned to safe empty");
      assert.equal(executions.producers.length > 0, true, "the exact original source body is reachable before SCC sealing");
      for (const execution of executions.producers) {
        const origins = resolved(storage.boundOriginsFor(argument, execution.bindings));
        const parameter = ast.parameters(declaration("create"))[uses.indexOf(use)];
        assert.equal(origins.subjects.length === 1 && origins.subjects[0].node === parameter, true,
          "candidate over-approximation must not union the two actual creation/capture rows");
      }
    }
    assert.equal(storage.failureReason() === undefined, true, "candidate discovery uses only the existing finite graph");
  });
}

for (const mapped of [false, true]) for (const invoked of [false, true]) for (const reversed of [false, true]) {
  test("native callable input frontiers are exact or demand-local open: " + mapped + "/" + invoked + "/" + reversed, async () => {
    const current = await fixture("native-input-frontier-" + mapped + "-" + invoked, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function deliver(callback: () => void): void { callback(); }
      export function create(first: number, second: number) {
        const firstCallback = (): void => { observe(first); };
        const secondCallback = (): void => { observe(second); };
        return () => { nativeInvoke([firstCallback, secondCallback], callback => { ${invoked ? "deliver(callback);" : "void callback;"} }); };
      }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous", ...(mapped ? { inputs: [
            { parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 },
          ] } : {}) }] : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined && ast.is.IsReturnStatement(ast.parent(node)));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the actual executor creation is closed");
    assert.equal(domain.producers.length, 1, "one canonical creation binding");
    const uses = nodes.filter(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    for (const use of reversed ? [...uses].reverse() : uses) {
      const owner = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
      const callee = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
      if (reversed) resolved(storage.originSubjectsFor(callee));
      const selected = storage.contributingExecutionsFor(callee, owner, domain.producers[0]);
      assert.equal(selected.kind, invoked && !mapped ? "open" : "complete",
        "missing actual-input correspondence opens only an actually demanded potential body");
      assert.equal(selected.producers.length > 0, invoked && mapped,
        "an uncertain native input never manufactures an executed source activation");
      if (selected.kind === "open") {
        assert.equal(selected.boundaries.length > 0, true, "zero known producers must retain an explicit frontier");
        assert.equal(selected.boundaries.every(boundary => boundary.kind === "unclassified-exposure" &&
          ast.text(ast.as.AsCallExpression(boundary.exposure).Expression) === "nativeInvoke"), true,
        "the actual native input invocation owns the local uncertainty");
      }
    }
    assert.equal(storage.failureReason() === undefined, true, "an unknown input is not a global resource or source failure");
  });
}

for (const reversed of [false, true]) {
  test("an uncertain native input boundary publishes each actual factory creation binding: " + reversed, async () => {
    const current = await fixture("native-boundary-factory-creation", `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make(callback: (value: number) => void, value: number): () => void { return () => { callback(value); }; }
      export function create(first: number, second: number) {
        const firstCallback = make(observe, first);
        const secondCallback = make(observe, second);
        return () => { nativeInvoke([${reversed ? "secondCallback, firstCallback" : "firstCallback, secondCallback"}], next => { next(); }); };
      }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const make = declaration("make");
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
    const owner = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined && ast.is.IsReturnStatement(ast.parent(node)) && node !== owner);
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the actual executor creation is closed");
    assert.equal(domain.producers.length, 1, "one original executor activation");
    const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
      owner, domain.producers[0]);
    assert.equal(selected.kind, "open", "uncertain input remains a boundary, not an invented execution");
    assert.equal(selected.producers.length, 0, "no source invocation is fabricated");
    const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
    const actuals = new Set();
    const creationScopes = new Set();
    for (const boundary of selected.boundaries) {
      assert.equal(Object.isFrozen(boundary) && Object.isFrozen(boundary.bindings), true, "immutable owned public boundary data");
      const activations = resolved(storage.boundActivationsFor(make, boundary.bindings));
      assert.equal(activations.activations.length, 1, "each possible source payload has one original factory activation");
      creationScopes.add(activations.activations[0].bindings);
      const origins = resolved(storage.boundOriginsFor(argument, boundary.bindings));
      for (const subject of origins.subjects) actuals.add(subject.node);
    }
    assert.equal(creationScopes.size, 2, "same arrow, distinct actual creation bindings");
    assert.equal(actuals.size === 2 && ast.parameters(declaration("create")).every(parameter => actuals.has(parameter)), true,
      "both factory argument rows survive without substitution or cross-union");
    assert.equal(storage.boundOriginsFor(argument, {}).kind, "unresolved", "a fabricated scope is never replaced with empty bindings");
    assert.equal(storage.failureReason() === undefined, true, "unknown correspondence stays local");
  });
}

for (const nativeForward of [false, true]) for (const reversed of [false, true]) {
  test("possible native payload execution publishes demand-owner helper bindings: " + nativeForward + "/" + reversed, async () => {
    const current = await fixture("native-boundary-demand-owner", `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      declare function nativeAgain(callback: () => void): void;
      function send(callback: (value: number) => void, value: number): void { callback(value); }
      function make(callback: (value: number) => void, value: number): () => void { return () => { send(callback, value); }; }
      export function create(first: number, second: number) {
        const firstCallback = make(observe, first);
        const secondCallback = make(observe, second);
        return () => {
          ${reversed ? "send(observe, 99);" : ""}
          nativeInvoke([${reversed ? "secondCallback, firstCallback" : "firstCallback, secondCallback"}], next => {
            ${nativeForward ? "nativeAgain(next);" : "next();"}
          });
          ${reversed ? "" : "send(observe, 99);"}
        };
      }
    `, (source, nodes) => {
      const invoke = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      const again = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeAgain");
      return { callbackEntries(node, selected) {
        const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
        return declaration === invoke ? [{ parameterIndex: 1, timing: "synchronous" }]
          : declaration === again ? [{ parameterIndex: 0, timing: "synchronous" }] : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const owner = declaration("send");
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
    const forwarded = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "send" &&
      ast.is.IsIdentifier(ast.arguments(node)[1]));
    const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(invocation));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(domain.kind, "complete", "the original executor creation is closed");
    assert.equal(domain.producers.length, 1, "one original executor producer");
    const demand = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
    const selected = storage.contributingExecutionsFor(demand, owner, domain.producers[0]);
    assert.equal(selected.kind, "open", "possible helper execution stays open");
    assert.equal(selected.producers.length, 1, "only the separate real source helper call is certified as executed");
    assert.equal(selected.boundaries.length, 2, "each original callback creation owns a distinct possible helper invocation");
    const actuals = new Set();
    const creations = new Set();
    const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
    for (const boundary of reversed ? [...selected.boundaries].reverse() : selected.boundaries) {
      assert.equal(boundary.subject === demand && Object.isFrozen(boundary.bindings), true, "the original demand has owned immutable bindings");
      const contexts = resolved(storage.boundActivationsFor(owner, boundary.bindings));
      assert.equal(contexts.activations.length === 1 && contexts.activations[0].kind === "invocation" &&
        contexts.activations[0].invocation === forwarded, true, "the real forwarding call, not a factory frame, owns the demand");
      const factory = resolved(storage.boundActivationsFor(declaration("make"), contexts.activations[0].bindings));
      assert.equal(factory.activations.length, 1, "the helper invocation retains one original factory creation");
      creations.add(factory.activations[0].bindings);
      for (const subject of resolved(storage.boundOriginsFor(argument, contexts.activations[0].bindings)).subjects) actuals.add(subject.node);
    }
    assert.equal(creations.size, 2, "the same helper call is instantiated in both distinct factory activations");
    assert.equal(actuals.size === 2 && ast.parameters(declaration("create")).every(parameter => actuals.has(parameter)), true,
      "the separate literal99 call cannot enter the possible observer's argument domain");
    assert.equal(storage.failureReason() === undefined, true, "conditional provenance uses the existing bounded scoped relation");
  });
}

test("a known empty native execution fact does not become unknown or invoke an unused callback", async () => {
  const current = await fixture("native-empty-entry", `
    declare function nativeInvoke(callback: () => void): void;
    declare function observe(value: number): void;
    export function create(value: number) { return () => { nativeInvoke(() => { observe(value); }); }; }
  `, (source, nodes) => {
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    return { callbackEntries(node, selected) {
      return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native ? [] : undefined;
    } };
  });
  const { ast, nodes, storage, declaration } = current;
  const native = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
  const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
  const callback = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
  const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(native));
  const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
  const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
  assert.equal(domain.kind, "complete", "actual source callback creation is closed");
  const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
    callback, domain.producers[0]);
  assert.equal(selected.kind, "complete", "absence has an explicit native fact");
  assert.equal(selected.producers.length, 0, "the uncalled body is not seeded by lexical nesting");
  const arguments_ = storage.nativeCallbackArgumentsFor(native);
  assert.equal(arguments_.kind, "resolved", "known empty differs from unknown lifecycle");
  assert.equal(arguments_.arguments.length, 0, "no invented callback port");
  assert.equal(storage.failureReason() === undefined, true, "proven absence consumes no global unresolved state");
});

for (const form of ["foreign-slot", "duplicate-slot", "accessor", "unknown-timing"]) {
  test("invalid native callback evidence stays explicitly open without getter execution: " + form, async () => {
    let getterCalls = 0;
    const current = await fixture("native-invalid-" + form, `
      declare function nativeInvoke(callback: () => void): void;
      export function create(): void { nativeInvoke(() => {}); }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      const row = form === "accessor" ? Object.defineProperty({ timing: "synchronous" }, "parameterIndex", {
        get() { getterCalls += 1; return 0; }, enumerable: true,
      }) : { parameterIndex: form === "foreign-slot" ? 99 : 0, timing: form === "unknown-timing" ? "unknown" : "synchronous" };
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? form === "duplicate-slot" ? [row, row] : [row] : undefined;
      } };
    });
    const native = current.nodes.find(node => current.ast.is.IsCallExpression(node));
    const selected = current.storage.nativeCallbackArgumentsFor(native);
    assert.equal(selected.kind, "open", "missing valid native evidence is not safe empty or a global failure");
    assert.equal(selected.arguments.length, 1, "the actual checked callable remains present");
    assert.equal(selected.boundaries.length, 1, "one explicit unclassified exposure");
    assert.equal(selected.boundaries[0].exposure === native, true, "the original checked native invocation owns the boundary");
    assert.equal(Object.isFrozen(selected.boundaries[0].bindings), true, "the public native-entry boundary owns canonical readonly bindings");
    assert.equal(current.storage.boundActivationsFor(current.declaration("create"), selected.boundaries[0].bindings).kind, "resolved",
      "the actual lexical owner is preserved instead of a fabricated empty scope");
    assert.equal(getterCalls, 0, "validation does not execute metadata accessors");
    assert.equal(current.storage.failureReason() === undefined, true, "a local malformed native fact does not reject the shared budget");
  });
}
