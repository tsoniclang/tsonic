import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { checkedSource, projectSourceFile } from "../fixtures/source-navigation.mjs";

async function fixture(name, text) {
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
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
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
        const selected = resolved(storage.contributingActivationsFor(operand, owner, producer));
        assert.equal(selected.activations.length > 0, true, "the explicitly entered callback reaches the real helper execution");
        const observed = new Set();
        for (const activation of pass === 0 ? selected.activations : selected.activations.slice().reverse()) {
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
    const active = resolved(storage.contributingActivationsFor(callee, arrow, producer));
    assert.equal(active.activations.length, 1, "one explicit entry into this actual executor creation");
    assert.equal(active.activations[0].kind, "declaration", "a native callback entry is not a fabricated source invocation");
    const actual = resolved(storage.boundOriginsFor(argument, active.activations[0].bindings));
    assert.equal(actual.subjects.length === 1 && actual.subjects[0].node === ast.arguments(creation)[0], true,
      "the executor retains its own factory call's actual argument");
    selectedBindings.push(active.activations[0].bindings);
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
  const selected = resolved(storage.contributingActivationsFor(callee, declaration("other"), entry));
  assert.equal(selected.activations.length, 0, "an explicit empty callback cannot fabricate an unrelated helper invocation");
  const forged = Object.defineProperty({}, "subject", { get: () => assert.fail("forged entry getter executed") });
  for (const invalid of [undefined, null, {}, forged, { ...entry, bindings: foreign.storage.emptyBindings },
    { ...entry, subject: foreign.subject(foreign.declaration("create")) }]) {
    assert.equal(storage.contributingActivationsFor(callee, declaration("other"), invalid).kind, "unresolved",
      "every execution entry needs the identical source graph and retained binding identity");
  }
  assert.equal(storage.contributingActivationsFor(callee, foreign.declaration("other"), entry).kind, "unresolved",
    "a demanded owner from another source is not accepted");
  assert.equal(storage.failureReason(), undefined, "rejected forged evidence does not poison valid owned selection");
});
