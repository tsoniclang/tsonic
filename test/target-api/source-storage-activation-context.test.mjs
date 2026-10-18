import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { sourceStorageCallableInputSlots } from "../../packages/target-api/dist/target-analysis/source-storage/graph/invocation-inputs.js";
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

for (const rejectedFirst of [false, true]) {
  test("bound creation queries retain their actual caller independently of a rejected source rest transport: " + rejectedFirst, async () => {
    const current = await fixture("bound-creation-local-rejection-" + rejectedFirst, `
      function factory<Value>(value: Value) {
        function make(): () => Value { return () => value; }
        return make();
      }
      function throwRest(...values: object[]): never { throw values[0]; }
      const left = {}; const right = {};
      const first = factory(left); const second = factory(right);
      try { throwRest({}); } catch (caught) { const rejected = caught; }
      export {};
    `);
    const { ast, nodes, storage, declaration } = current;
    const variable = name => nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === name);
    const subject = name => resolved(storage.subjectFor(variable(name))).subject;
    const initializer = name => ast.as.AsVariableDeclaration(variable(name)).Initializer;
    const rejected = () => assert.equal(storage.originSubjectsFor(subject("rejected")).kind, "unresolved",
      "the unsupported source body input remains rejected, not inferred from caller ABI facts");
    if (rejectedFirst) rejected();
    const creations = new Set();
    for (const [name, expected, excluded] of [["first", "left", "right"], ["second", "right", "left"]]) {
      const selected = storage.storageProducersFor(subject(name));
      assert.equal(selected.kind === "complete" && selected.producers.length === 1, true,
        name + ": one actual closure creation is independent of the rejected source region");
      const producer = selected.producers[0];
      const factory = resolved(storage.boundActivationsFor(declaration("factory"), producer.bindings));
      const make = resolved(storage.boundActivationsFor(declaration("make"), producer.bindings));
      assert.equal(factory.activations.length === 1 && factory.activations[0].kind === "invocation" &&
        factory.activations[0].invocation === initializer(name), true, name + ": exact original outer activation");
      assert.equal(make.activations.length === 1 && make.activations[0].kind === "invocation", true,
        name + ": original inner invocation, not a fabricated lexical execution");
      const formal = resolved(storage.subject(ast.parameters(declaration("factory"))[0], "input")).subject;
      const origins = resolved(storage.boundOriginsFor(formal, producer.bindings));
      assert.equal(origins.subjects.length === 1 && origins.subjects[0].node === initializer(expected), true,
        name + ": exact original captured value");
      assert.equal(origins.subjects.some(value => value.node === initializer(excluded)), false,
        name + ": another actual caller cannot supply this closure's capture");
      creations.add(make.activations[0].bindings);
    }
    assert.equal(creations.size, 2, "the identical inner AST retains both original caller activations");
    if (!rejectedFirst) rejected();
    assert.equal(storage.failureReason() === undefined, true, "local unresolved evidence never fabricates a key or global failure");
  });
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

test("callable parameter transport rejects missing, foreign and unrelated checked nodes", async () => {
  const text = `
    export function read(value: number = 1): number { return value; }
    function other(value: number = 2): number { return value; }
    export const result = read();
  `;
  const current = await fixture("source-parameter-owned", text);
  const foreign = await fixture("source-parameter-foreign", text);
  const read = current.declaration("read");
  for (const [label, parameter] of [
    ["missing", undefined],
    ["foreign", foreign.ast.parameters(foreign.declaration("read"))[0]],
    ["unrelated checked owner", current.ast.parameters(current.declaration("other"))[0]],
  ]) {
    const source = { ...current.source, ast: { ...current.ast,
      parameters: declaration => declaration === read ? [parameter] : current.ast.parameters(declaration),
    } };
    const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
    assert.equal(storage.failureReason(), "Source storage callable inputs require exact checked parameter declaration ownership.", label);
    assert.equal(storage.subject(read).kind, "unresolved", `${label}: invalid input evidence is never complete-empty`);
  }
});

for (const [name, declarationText, sourceText, projections] of [
  ["array-rest", "declare function selected(...values: number[]): void;", "selected(7, 8);",
    [{ kind: "array-element" }]],
  ["instantiated-tuple-rest", "declare function selected<Args extends unknown[]>(...values: Args): void;", "selected(7, 'second');",
    [{ kind: "tuple-element", index: 0 }, { kind: "tuple-element", index: 1 }]],
]) {
  test("selected external declaration uses its actual checked consumer and instantiated slots: " + name, async () => {
    const checked = await checkedSource("external-input-slots-" + name, {
      "globals.d.ts": `interface Object {} interface Function {} interface CallableFunction extends Function {}
        interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
        interface Number {} interface String {} interface RegExp {}
        interface Array<T> { [index: number]: T; length: number; }
        interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
        ${declarationText}`,
      "src/index.ts": `export {}; ${sourceText}`,
    });
    assert.equal(checked.diagnostics.length, 0, "the actual external call is checked");
    assert.equal(checked.extensionDiagnostics.length, 0, "the call needs no source extension workaround");
    const source = createTargetSourceProgram({ ...checked,
      sourceFiles: checked.sourceFiles.filter(file => file !== undefined && !checked.ast.isDeclarationFile(file)),
    });
    const { ast } = source;
    const file = projectSourceFile(source, "src/index.ts");
    const nodes = [];
    const visit = node => {
      nodes.push(node);
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    const invocation = nodes.find(node => ast.is.IsCallExpression(node));
    const consumer = source.semantics.forNode(invocation);
    const selected = consumer.operations.call(invocation);
    assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "one real selected call owns its signature");
    const declaration = consumer.declarations.signatureDeclaration(selected.selectedSignature);
    const externalFile = ast.getSourceFile(declaration);
    assert.equal(externalFile !== undefined, true, "the selected external declaration has its original source-file identity");
    assert.equal(source.semantics.includes(externalFile), false,
      "the selected external declaration is not an included authored source file");
    assert.throws(() => source.semantics.forNode(declaration), /exact source file from the checked program/u,
      "the strict facade membership boundary remains unchanged");
    const slots = sourceStorageCallableInputSlots(source, declaration, consumer,
      { kind: "selected-signature", signature: selected.selectedSignature }, () => true);
    assert.equal(slots?.length, projections.length, "the actual instantiated effective slot count is preserved");
    const parameter = ast.parameters(declaration)[0];
    for (const [index, projection] of projections.entries()) {
      assert.equal(slots[index].parameter === parameter, true, "each expanded slot retains its actual authored formal");
      assert.equal(slots[index].sourceParameterIndex, 0, "one source rest formal owns every effective slot");
      assert.equal(slots[index].effectiveIndex, index, "effective positions come from the selected signature");
      assert.equal(slots[index].repeated, name === "array-rest", "finite tuple slots are not repeated array elements");
      assert.equal(slots[index].projection.length, 1, "one exact authored component");
      assert.equal(slots[index].projection[0].kind, projection.kind, "the component kind is exact");
      assert.equal(slots[index].projection[0].index, projection.index, "the tuple position is exact");
    }
    assert.equal(sourceStorageCallableInputSlots(source, declaration, consumer,
      { kind: "selected-signature", signature: undefined }, () => true), undefined,
      "missing selected signature is unresolved, never reconstructed from the declaration");
    const foreign = await fixture("foreign-slot-context-" + name, "export function other(value: number): number { return value; }");
    assert.equal(sourceStorageCallableInputSlots(source, declaration,
      foreign.source.semantics.forNode(foreign.declaration("other")),
      { kind: "selected-signature", signature: selected.selectedSignature }, () => true), undefined,
    "a different checked program is not a consumer context");
    const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
    assert.equal(storage.failureReason() === undefined, true, "external selected rest transport does not cross the source-file boundary");
    const arguments_ = resolved(storage.argumentTransportsFor(invocation));
    assert.equal(arguments_.arguments.length, 2, "both actual source arguments keep exact external rest bindings");
  });
}

test("an actual checked overload signature maps only to its canonical source implementation", async () => {
  const current = await fixture("selected-overload-implementation-slots", `
    function selected(value: number): number;
    function selected(value: number): number { return value; }
    function unrelated(value: number): number { return value; }
    export const result = selected(7);
  `);
  const { ast, nodes, source } = current;
  const invocation = nodes.find(node => ast.is.IsCallExpression(node));
  const consumer = source.semantics.forNode(invocation);
  const selected = consumer.operations.call(invocation);
  const contract = consumer.declarations.signatureDeclaration(selected.selectedSignature);
  const implementation = source.navigation.callableImplementation(contract);
  assert.equal(implementation.kind, "resolved", "the selected overload has one exact checked implementation");
  const declaration = implementation.implementation.declaration;
  assert.equal(declaration !== contract, true, "the implementation is not the selected bodyless contract");
  const slots = sourceStorageCallableInputSlots(source, declaration, consumer,
    { kind: "source-implementation", signature: selected.selectedSignature }, () => true);
  assert.equal(slots?.length, 1, "one implementation input corresponds to the selected overload");
  assert.equal(slots[0].parameter === ast.parameters(declaration)[0], true, "the implementation owns its formal");
  assert.equal(slots[0].sourceParameterIndex, 0, "source index retains the actual implementation signature");
  assert.equal(slots[0].effectiveIndex, 0, "checked effective index is unchanged");
  assert.equal(sourceStorageCallableInputSlots(source, current.declaration("unrelated"), consumer,
    { kind: "selected-signature", signature: selected.selectedSignature }, () => true), undefined,
  "a different declaration cannot inherit selected signature formals");
  assert.equal(current.storage.bindingsForInvocation(current.declaration("unrelated"), invocation).kind, "unresolved",
    "the actual storage producer selection refuses an unrelated source implementation");
});

for (const rest of [false, true]) for (const selectedIndex of [0, 1]) for (const reversed of [false, true]) {
  test(`finite tuple-spread actuals preserve checked input slots/${rest}/${selectedIndex}/${reversed}`, async () => {
    const parameters = rest ? "...values: [first: Value, second: Value]" : "first: Value, second: Value";
    const returned = rest ? `values[${selectedIndex}]` : selectedIndex === 0 ? "first" : "second";
    const current = await fixture(`tuple-spread-inputs-${rest}-${selectedIndex}-${reversed}`, `
      interface Value { readonly token: {}; }
      const first: Value = { token: {} };
      const second: Value = { token: {} };
      function deliver(this: void, ${parameters}): Value { return ${returned}; }
      function unrelated(value: Value): Value { return value; }
      const actuals: [Value, Value] = [first, second];
      const result = deliver(...actuals);
      export {};
    `);
    const { ast, nodes, source, storage } = current;
    const invocation = nodes.find(node => ast.is.IsCallExpression(node) &&
      ast.arguments(node).some(argument => ast.is.IsSpreadElement(argument)));
    const owner = current.declaration("deliver");
    if (reversed) assert.equal(storage.bindingsForInvocation(current.declaration("unrelated"), invocation).kind, "unresolved",
      "a foreign implementation cannot acquire the selected tuple actuals");
    const bindings = resolved(storage.bindingsForInvocation(owner, invocation)).bindings;
    const slots = sourceStorageCallableInputSlots(source, owner, source.semantics.forNode(invocation),
      { kind: "source-implementation", signature: source.semantics.forNode(invocation).operations.call(invocation).selectedSignature }, () => true);
    assert.equal(slots?.length, 2, "the checked this parameter is excluded and finite rest expands to two inputs");
    const parametersByIndex = reversed ? [1, 0] : [0, 1];
    for (const index of parametersByIndex) {
      const slot = slots[index];
      const formal = resolved(storage.subject(slot.parameter, "input", slot.projection)).subject;
      const origins = resolved(storage.boundOriginsFor(formal, bindings));
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === (index === 0 ? "first" : "second"));
      const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable).Initializer)).subject;
      assert.equal(origins.subjects.length === 1 && origins.subjects[0] === expected, true,
        `effective input ${index} preserves its exact source tuple element and allocation`);
    }
    const result = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "result");
    const selected = storage.closedOriginsFor(resolved(storage.subjectFor(result)).subject);
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === (selectedIndex === 0 ? "first" : "second"));
    const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable).Initializer)).subject;
    assert.equal(selected.kind === "complete" && selected.origins.length === 1 && selected.origins[0].subject === expected, true,
      "the selected body result retains exactly its original checked actual");
  });
}

for (const reversed of [false, true]) {
  test("finite tuple actuals retain an overload's real implementation input: " + reversed, async () => {
    const current = await fixture("overload-spread-implementation-" + reversed, `
      function increment(value: number): number { return value + 1; }
      function use(callback: (value: number) => number): number;
      function use(callback: (value: number) => number): number { return callback(7); }
      function unrelated(callback: (value: number) => number): number { return callback(9); }
      const actuals: [typeof increment] = [increment];
      export const direct = use(increment);
      export const spread = use(...actuals);
    `);
    const { ast, nodes, storage, source } = current;
    const implementation = nodes.find(node => ast.is.IsFunctionDeclaration(node) &&
      ast.text(ast.name(node)) === "use" && ast.body(node) !== undefined);
    const formal = resolved(storage.subject(ast.parameters(implementation)[0], "input")).subject;
    const original = current.declaration("increment");
    const unscoped = resolved(storage.originSubjectsFor(formal));
    assert.equal(unscoped.subjects.length === 1 && unscoped.subjects[0].node === original, true,
      "the selected overload and the source-body parameter share the exact original callable");
    const invocations = nodes.filter(node => ast.is.IsCallExpression(node) &&
      ast.text(ast.as.AsCallExpression(node).Expression) === "use");
    for (const invocation of reversed ? [...invocations].reverse() : invocations) {
      const selected = source.semantics.forNode(invocation).operations.call(invocation);
      assert.equal(source.semantics.forNode(invocation).declarations.signatureDeclaration(selected.selectedSignature) !== implementation, true,
        "the actual selected declaration is the separate overload contract");
      const bindings = resolved(storage.bindingsForInvocation(implementation, invocation)).bindings;
      const actual = storage.storageProducersFor(formal, bindings);
      assert.equal(actual.kind === "complete" && actual.producers.length === 1 && actual.producers[0].subject.node === original, true,
        "direct and finite-spread entries preserve the identical actual source implementation");
      assert.equal(storage.bindingsForInvocation(current.declaration("unrelated"), invocation).kind, "unresolved",
        "the tuple cannot authorize a different implementation declaration");
    }
  });
}

for (const form of ["omitted", "optional-empty", "undefined", "present"]) {
  test("finite source defaults retain their actual value contribution: " + form, async () => {
    const actuals = form === "omitted" ? "" : form === "optional-empty" ? "...empty"
      : form === "undefined" ? "undefined" : "...present";
    const current = await fixture("finite-default-input-" + form, `
      interface Value { readonly token: {}; }
      const fallback: Value = { token: {} };
      const actual: Value = { token: {} };
      function deliver(value: Value = fallback): Value { return value; }
      const empty: [Value?] = [];
      const present: [Value] = [actual];
      export const result = deliver(${actuals});
    `);
    const { ast, nodes, storage } = current;
    const declaration = current.declaration("deliver");
    const invocation = nodes.find(node => ast.is.IsCallExpression(node));
    const bindings = resolved(storage.bindingsForInvocation(declaration, invocation)).bindings;
    const formal = resolved(storage.subject(ast.parameters(declaration)[0], "input")).subject;
    const original = nodes.find(node => ast.is.IsVariableDeclaration(node) &&
      ast.text(ast.name(node)) === (form === "present" ? "actual" : "fallback"));
    const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(original).Initializer)).subject;
    const origins = resolved(storage.boundOriginsFor(formal, bindings));
    assert.equal(origins.subjects.length === 1 && origins.subjects[0] === expected, true,
      "omission contributes the original callee default; a required present tuple contributes only its actual value");
    const result = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "result");
    const selected = storage.closedOriginsFor(resolved(storage.subjectFor(result)).subject);
    assert.equal(selected.kind === "complete" && selected.origins.length === 1 && selected.origins[0].subject === expected, true,
      "default initializer execution and input VALUE correspond through the same source body");
  });
}

for (const overloaded of [false, true]) for (const form of ["undefined", "optional-present", "optional-empty", "optional-undefined"]) {
  test("initialized callback inputs never expose a raw absent body argument: " + overloaded + "/" + form, async () => {
    const call = form === "undefined" ? "use(undefined)" : "use(...actuals)";
    const value = form === "optional-empty" ? "" : form === "optional-undefined" ? "undefined" : "replacement";
    const current = await fixture("source-default-callable-" + overloaded + "/" + form, `
      function fallback(value: number): number { return value + 1; }
      function replacement(value: number): number { return value + 2; }
      ${overloaded ? "function use(callback?: (value: number) => number): number;" : ""}
      function use(callback: (value: number) => number = fallback): number { return callback(7); }
      const actuals: [((value: number) => number)?] = [${value}];
      export const result = ${call};
    `);
    const { ast, nodes, storage } = current;
    const owner = nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === "use" && ast.body(node) !== undefined);
    const formal = resolved(storage.subject(ast.parameters(owner)[0], "input")).subject;
    const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "use");
    const bindings = resolved(storage.bindingsForInvocation(owner, invocation)).bindings;
    const expected = current.declaration(form === "optional-present" ? "replacement" : "fallback");
    const selected = storage.storageProducersFor(formal, bindings);
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === expected, true,
      "the actual optional tuple value, not its declared optionality, selects exactly one initialized callback");
    const global = resolved(storage.originSubjectsFor(formal));
    assert.equal(global.subjects.every(subject => ast.is.IsFunctionDeclaration(subject.node)), true,
      "raw undefined transport is not an implementation input, including through a selected overload contract");
    const callbackCall = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
    const implementations = resolved(storage.invocationImplementationsFor(callbackCall, bindings));
    assert.equal(implementations.exact && implementations.nodes.length === 1 && implementations.nodes[0] === expected, true,
      "exact scoped execution agrees with initialized storage rather than mixing raw actual/default bodies");
    const raw = resolved(storage.argumentTransportsFor(invocation));
    assert.equal(raw.arguments.length, 1, "the exact original checked argument binding remains published independently");
  });
}

test("initialized aggregate inputs select the root before its checked component", async () => {
  const current = await fixture("source-default-aggregate-component", `
    const fallback = {};
    const present = {};
    function use(value: { token: {} } = { token: fallback }): {} { return value.token; }
    const empty: [{ token: {} }?] = [];
    const actual: [{ token: {} }?] = [{ token: present }];
    export const omitted = use(...empty);
    export const supplied = use(...actual);
  `);
  const { ast, nodes, storage } = current;
  for (const [name, expectedName] of [["supplied", "present"], ["omitted", "fallback"]]) {
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
    const original = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === expectedName);
    const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(original).Initializer)).subject;
    const selected = storage.closedOriginsFor(resolved(storage.subjectFor(variable)).subject);
    assert.equal(selected.kind === "complete" && selected.origins.length === 1 && selected.origins[0].subject === expected, true,
      name + ": absence selection precedes component projection without losing caller/callee capture identity");
  }
});

test("an unresolved optional default input stays open rather than choosing a guessed initialized value", async () => {
  const current = await fixture("source-default-external-absence", `
    function fallback(value: number): number { return value + 1; }
    function use(callback: (value: number) => number = fallback) { return callback; }
    export function choose(callback?: (value: number) => number) { return use(callback); }
  `);
  const { ast, nodes, storage } = current;
  const invocation = nodes.find(node => ast.is.IsCallExpression(node));
  const bindings = resolved(storage.bindingsForInvocation(current.declaration("use"), invocation,
    resolved(storage.bindingsForDeclaration(current.declaration("choose"))).bindings)).bindings;
  const formal = resolved(storage.subject(ast.parameters(current.declaration("use"))[0], "input")).subject;
  assert.equal(storage.storageProducersFor(formal, bindings).kind !== "complete", true,
    "the real externally supplied value can be absent or present and cannot become a closed fallback-only domain");
  assert.equal(storage.failureReason() === undefined, true, "unknown initialized input is demand-local, not a global budget failure");
});

for (const reversed of [false, true]) {
  test("forwarded actual omission and present values remain correlated before defaulting: " + reversed, async () => {
    const current = await fixture("source-forwarded-actual-absence-" + reversed, `
      function fallback(value: number): number { return value + 1; }
      function replacement(value: number): number { return value + 2; }
      function use(callback: (value: number) => number = fallback) { return callback; }
      function forward(callback?: (value: number) => number) { return use(callback); }
      const absent = forward();
      const present = forward(replacement);
      export {};
    `);
    const { ast, nodes, storage } = current;
    const rows = reversed ? [["present", "replacement"], ["absent", "fallback"]] : [["absent", "fallback"], ["present", "replacement"]];
    for (const [name, expectedName] of rows) {
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
      assert.equal(selected.kind === "complete" && selected.producers.length === 1 &&
        selected.producers[0].subject.node === current.declaration(expectedName), true,
      name + ": only the real invocation's checked omission or actual value may initialize this callback");
    }
    assert.equal(storage.failureReason() === undefined, true, "forwarding uses the original finite scoped equations and activation keys");
  });
}

test("an unreachable guarded contribution is not a proved omitted input", async () => {
  const current = await fixture("source-default-guarded-no-contribution", `
    function fallback(value: number): number { return value + 1; }
    function replacement(value: number): number { return value + 2; }
    function choose(value: ((value: number) => number) | undefined) {
      if (value === undefined) return value;
      return value;
    }
    function use(callback: (value: number) => number = fallback) { return callback; }
    const selected = use(choose(replacement));
    const absent = use(choose(undefined));
    export {};
  `);
  const { ast, nodes, storage } = current;
  const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
  const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
  assert.equal(selected.kind === "complete" && selected.producers.length === 1 &&
    selected.producers[0].subject.node === current.declaration("replacement"), true,
  "the impossible absence branch has no value contribution; it cannot select the callee default");
  const omitted = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "absent");
  const fallback = storage.storageProducersFor(resolved(storage.subjectFor(omitted)).subject);
  assert.equal(fallback.kind === "complete" && fallback.producers.length === 1 &&
    fallback.producers[0].subject.node === current.declaration("fallback"), true,
  "the real checked undefined value remains absent and selects the original default");
});

for (const reversed of [false, true]) for (const shape of ["direct", "copy", "nested-copy", "last-spread"]) {
  test("copied method producers retain the original factory activation: " + shape + "/" + reversed, async () => {
    const copied = shape === "direct" ? "original" : shape === "copy" ? "{ aaa: 3, ...original }"
      : shape === "nested-copy" ? "{ ...{ aaa: 3, ...original } }" : "{ ...make({ token: {} }), ...original }";
    const current = await fixture("method-spread-creation-" + shape + "/" + reversed, `
      function make<Value>(value: Value): { read(): Value } { return { read(): Value { return value; } }; }
      function copy<Actual>(value: Actual) { const original = make(value); return ${copied}; }
      const left = { token: {} };
      const right = { token: {} };
      const first = copy(left);
      const second = copy(right);
      const firstReader = first.read;
      const secondReader = second.read;
      export {};
    `);
    const { ast, nodes, storage } = current;
    const make = current.declaration("make");
    const copy = current.declaration("copy");
    const method = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const formal = resolved(storage.subject(ast.parameters(make)[0], "input")).subject;
    const selections = reversed ? [["secondReader", "right"], ["firstReader", "left"]]
      : [["firstReader", "left"], ["secondReader", "right"]];
    const creationScopes = new Set();
    for (const [name, actual] of selections) {
      const node = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const subject = resolved(storage.subjectFor(node)).subject;
      const selected = storage.storageProducersFor(subject);
      assert.equal(selected.kind === "complete", true, name + ": copied method value is completely selected");
      assert.equal(selected.producers.length === 1 && selected.producers[0].subject.node === method, true,
        name + ": later spread and nesting preserve exactly the actual original method");
      const producer = selected.producers[0];
      const activation = resolved(storage.boundActivationsFor(make, producer.bindings));
      assert.equal(activation.activations.length === 1 && activation.activations[0].kind === "invocation", true,
        name + ": the actual MAKE frame is not replaced with COPY");
      const caller = resolved(storage.boundActivationsFor(copy, activation.activations[0].callerBindings));
      assert.equal(caller.activations.length, 1, name + ": the original caller relation is retained");
      creationScopes.add(activation.activations[0].bindings);
      const origins = resolved(storage.boundOriginsFor(formal, activation.activations[0].bindings));
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === actual);
      const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable).Initializer)).subject;
      assert.equal(origins.subjects.length === 1 && origins.subjects[0] === expected, true,
        name + ": generic actual and source capture remain correlated with this factory creation");
    }
    assert.equal(creationScopes.size, 2, "two actual factory creations sharing a method AST never merge");
  });
}

for (const shape of ["own-method", "own-field", "mutation"]) {
  test("object spread contribution preserves its later actual override: " + shape, async () => {
    const properties = shape === "own-method" ? "...original, read(): {} { return replacement; }"
      : shape === "own-field" ? "...original, read: () => replacement" : "...original";
    const mutation = shape === "mutation" ? "copied.read = () => replacement;" : "";
    const current = await fixture("method-spread-override-" + shape, `
      const value = {};
      const replacement = {};
      function make(input: {}): { read(): {} } { return { read(): {} { return input; } }; }
      const original = make(value);
      const copied = { ${properties} };
      ${mutation}
      export const selected = copied.read;
    `);
    const { ast, nodes, storage } = current;
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
    const original = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
    assert.equal(selected.kind, "complete", "the copied destination has exact source method/field contributions");
    const replacement = nodes.filter(node => ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node)).at(-1);
    assert.equal(selected.producers.some(value => value.subject.node === replacement), true, "the actual later override is retained");
    if (shape !== "mutation") assert.equal(selected.producers.length === 1 && selected.producers[0].subject.node === replacement, true,
      "a definite own declaration overrides an earlier spread rather than unioning it");
    else assert.equal(selected.producers.some(value => value.subject.node === original), true,
      "flow-insensitive destination mutation preserves the original source value and the actual write");
  });
}

test("overwritten unrelated own fields do not lose an exact spread method creation", async () => {
  const current = await fixture("method-spread-unrelated-overwritten-fields", `
    function make<Value>(value: Value) { return { read(): Value { return value; } }; }
    const value = {};
    const original = make(value);
    const copied = { ...original, ...{ noise: 1 }, ...{ noise: 2 } };
    export const selected = copied.read;
  `);
  const { ast, nodes, storage } = current;
  const method = nodes.find(node => ast.is.IsMethodDeclaration(node));
  const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
  const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
  assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === method, true,
    "an unrelated overridden field has no final object-element row and cannot erase this checked method contribution");
  const activation = resolved(storage.boundActivationsFor(current.declaration("make"), selected.producers[0].bindings));
  assert.equal(activation.activations.length, 1, "the exact original factory activation survives unrelated overwritten fields");
});

for (const reversed of [false, true]) for (const nested of [false, true]) {
  test("real getter spread evaluations retain each original receiver creation: " + nested + "/" + reversed, async () => {
    const current = await fixture("getter-spread-original-creation-" + nested + "/" + reversed, `
      function make<Value>(value: Value) { return { get read(): () => Value { return () => value; } }; }
      function copy<Actual>(value: Actual) { const original = make(value); return ${nested ? "{ ...{ ...original } }" : "{ ...original }"}; }
      const left = {};
      const right = {};
      const first = copy(left);
      const second = copy(right);
      const firstReader = first.read;
      const secondReader = second.read;
      export {};
    `);
    const { ast, nodes, storage } = current;
    const arrow = nodes.find(node => ast.is.IsArrowFunction(node));
    const getter = nodes.find(node => ast.is.IsGetAccessorDeclaration(node));
    const make = current.declaration("make");
    const formal = resolved(storage.subject(ast.parameters(make)[0], "input")).subject;
    const scopes = new Set();
    const rows = reversed ? [["secondReader", "right"], ["firstReader", "left"]] : [["firstReader", "left"], ["secondReader", "right"]];
    for (const [name, value] of rows) {
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
      assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === arrow, true,
        name + ": an actual getter result is copied, not an unexecuted getter declaration");
      const producer = selected.producers[0];
      const creation = resolved(storage.boundActivationsFor(make, producer.bindings));
      assert.equal(creation.activations.length, 1, name + ": one actual original factory activation");
      scopes.add(creation.activations[0].bindings);
      const actual = resolved(storage.boundOriginsFor(formal, creation.activations[0].bindings));
      const original = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === value);
      const expected = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(original).Initializer)).subject;
      assert.equal(actual.subjects.length === 1 && actual.subjects[0] === expected, true,
        name + ": receiver capture and factory argument cannot cross between real evaluations");
      const execution = resolved(storage.boundActivationsFor(getter, producer.bindings));
      assert.equal(execution.activations.length === 1 && execution.activations[0].kind === "invocation" &&
        ast.is.IsSpreadAssignment(execution.activations[0].invocation), true, "the real spread, not the later copied read, invokes the getter");
    }
    assert.equal(scopes.size, 2, "shared getter and arrow ASTs preserve distinct actual factory creations");
    const getterSites = storage.accessorInvocations.filter(node => ast.is.IsSpreadAssignment(node));
    assert.equal(getterSites.length, 1, "nested copying consumes the existing snapshot without invoking its original getter again");
  });
}

for (const shape of ["prototype-method", "prototype-getter", "own-field"]) {
  test("spread contribution uses own checked storage rather than a class prototype: " + shape, async () => {
    const member = shape === "prototype-method" ? "read(): {} { return replacement; }"
      : shape === "prototype-getter" ? "get read(): () => {} { return () => replacement; }" : "read = () => replacement;";
    const current = await fixture("spread-class-own-storage-" + shape, `
      const originalValue = {};
      const replacement = {};
      const original = { read(): {} { return originalValue; } };
      class Other { noise = 2; ${member} }
      const copied = { ...original, ...new Other() };
      export const selected = copied.read;
    `);
    const { ast, nodes, storage } = current;
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
    const expected = shape === "own-field" ? nodes.find(node => ast.is.IsArrowFunction(node))
      : nodes.find(node => ast.is.IsMethodDeclaration(node));
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === expected, true,
      "prototype methods/accessors are absent from spread; an actual own field remains the final override");
    assert.equal(storage.accessorInvocations.some(node => ast.is.IsSpreadAssignment(node)), false,
      "copying class own fields cannot invoke a prototype getter");
  });
}

for (const view of ["View", "{ read(): {} }"]) for (const shape of ["prototype-method", "prototype-getter", "own-field"]) {
  test("actual structural spread storage preserves own versus prototype through " + view + "/" + shape, async () => {
    const member = shape === "prototype-method" ? "read(): {} { return replacement; }"
      : shape === "prototype-getter" ? "get read(): () => {} { return () => replacement; }" : "read = () => replacement;";
    const { ast, nodes, storage } = await fixture("structural-spread-own-" + view + "/" + shape, `
      interface View { read(): {}; }
      const originalValue = {}; const replacement = {};
      const original = { read(): {} { return originalValue; } };
      class Other { ${member} }
      function copy(view: ${view}) { return { ...original, ...view }; }
      const copied = copy(new Other());
      export const selected = copied.read;
    `);
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
    const expected = shape === "own-field" ? nodes.find(node => ast.is.IsArrowFunction(node))
      : nodes.find(node => ast.is.IsMethodDeclaration(node) && ast.is.IsObjectLiteralExpression(ast.parent(node)));
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === expected, true,
      "actual receiver own storage, not required structural readability, chooses the final source producer");
    assert.equal(storage.accessorInvocations.filter(node => ast.is.IsSpreadAssignment(node)).length, 0,
    "prototype getters are not copied or invoked through a structural annotation");
    assert.equal(storage.failureReason() === undefined, true, "selection remains a completed bounded actual-storage relation");
  });
}

for (const form of ["absent", "undefined", "present"]) {
  test("object binding defaults select actual checked presence: " + form, async () => {
    const input = form === "absent" ? "{}" : form === "undefined" ? "{ read: undefined }" : "{ read: actual }";
    const { ast, nodes, storage, declaration } = await fixture("object-binding-actual-default-" + form, `
      function fallback(): number { return 7; }
      function actual(): number { return 11; }
      const { read = fallback }: { read?: () => number } = ${input};
      export const selected = read;
    `);
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
    const expected = declaration(form === "present" ? "actual" : "fallback");
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === expected, true,
      "the authored read type does not certify an own value and only actual absence selects the original default");
    assert.equal(storage.failureReason() === undefined, true, "defaulting retains the original bounded source domain");
  });
}

test("an unknown optional object input cannot select a fallback-only completed domain", async () => {
  const { ast, storage, declaration } = await fixture("object-binding-unknown-default", `
    function fallback(): number { return 7; }
    export function select(input: { read?: () => number }) {
      const { read = fallback } = input;
      return read;
    }
  `);
  const owner = declaration("select");
  const bindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const result = resolved(storage.subject(owner, "return")).subject;
  assert.equal(storage.storageProducersFor(result, bindings).kind !== "complete", true,
    "unknown presence is not the checked absence of the external caller's actual component");
  assert.equal(ast.parameters(owner).length === 1 && storage.failureReason() === undefined, true,
    "unknown input remains demand-local without rejecting an unrelated source domain");
});

for (const reversed of [false, true]) for (const copied of [false, true]) {
  test("object rest retains its distinct allocation and original member creation: " + copied + "/" + reversed, async () => {
    const { ast, nodes, storage, declaration } = await fixture("object-rest-original-creation-" + copied + "/" + reversed, `
      function make<Value>(value: Value) { return { omitted: 7, payload: value, read(): Value { return value; } }; }
      function copy<Value>(value: Value) {
        const original = make(value);
        const { omitted, ...rest } = original;
        return ${copied ? "{ ...rest }" : "rest"};
      }
      const left = {}; const right = {};
      const first = copy(left); const second = copy(right);
      const firstReader = first.read; const secondReader = second.read;
      const firstValue = first.payload; const secondValue = second.payload;
      export {};
    `);
    const make = declaration("make");
    const method = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const formal = resolved(storage.subject(ast.parameters(make)[0], "input")).subject;
    const pairs = reversed ? [["second", "right"], ["first", "left"]] : [["first", "left"], ["second", "right"]];
    const creations = new Set();
    for (const [name, expected] of pairs) {
      const reader = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name + "Reader");
      const selected = storage.storageProducersFor(resolved(storage.subjectFor(reader)).subject);
      assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === method, true,
        "rest copies the actual method rather than an opaque binding or an invented implementation");
      const activation = resolved(storage.boundActivationsFor(make, selected.producers[0].bindings));
      const values = resolved(storage.boundOriginsFor(formal, activation.activations[0].bindings));
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === expected);
      const original = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable).Initializer)).subject;
      assert.equal(values.subjects.length === 1 && values.subjects[0] === original, true,
        "the copied method retains its exact original factory actual and capture row");
      creations.add(activation.activations[0].bindings);
      const result = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const domain = storage.storageProducersFor(resolved(storage.subjectFor(result)).subject);
      assert.equal(domain.kind === "complete" && domain.producers.length === 1 &&
        (copied ? ast.is.IsObjectLiteralExpression(domain.producers[0].subject.node) : ast.is.IsBindingElement(domain.producers[0].subject.node)), true,
      "the rest/copy allocation is not collapsed into its original receiver");
      const field = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name + "Value");
      const selectedField = storage.storageProducersFor(resolved(storage.subjectFor(field)).subject);
      assert.equal(selectedField.kind === "complete" && selectedField.producers.length === 1 &&
        selectedField.producers[0].subject === original, true, "passive rest fields preserve the original actual value");
    }
    assert.equal(creations.size, 2, "shared method syntax never merges two original creations");
    assert.equal(storage.failureReason() === undefined, true, "rest uses the same bounded storage equations and canonical creation keys");
  });
}

test("parameter object rest retains its fresh allocation and the original selected component", async () => {
  const { ast, nodes, storage, declaration, source } = await fixture("parameter-object-rest-original-storage", `
    export function read({ first, ...rest }: { first: number; second: number }): number {
      const alias = rest;
      const selected = rest.second;
      return first + selected;
    }
    const original = { first: 3, second: 4 };
    const result = read(original);
  `);
  const owner = declaration("read");
  const parameter = ast.parameters(owner)[0];
  const rest = ast.elements(ast.name(parameter)).find(node => node !== undefined &&
    ast.is.IsBindingElement(node) && ast.as.AsBindingElement(node).DotDotDotToken !== undefined);
  assert.equal(rest !== undefined, true, "the original checked rest element owns a fresh aggregate");
  const root = resolved(storage.subjectFor(rest)).subject;
  const bindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
  const input = resolved(storage.subject(parameter, "input")).subject;
  const inputDomain = storage.closedOriginsFor(input, bindings);
  assert.equal(inputDomain.kind === "open" && inputDomain.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "the original caller-owned aggregate remains external rather than inheriting its fresh rest allocation");
  const variable = name => nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === name);
  for (const node of [rest, variable("alias")]) {
    const value = storage.closedOriginsFor(resolved(storage.subjectFor(node)).subject, bindings);
    assert.equal(value.kind === "complete" && value.origins.length === 1 && value.origins[0].subject === root, true,
      "an unknown external parameter does not replace the identity of its checked fresh rest allocation");
  }
  const type = resolved(storage.typeFor(root));
  const properties = source.semantics.forFile(type.sourceFile).types.propertyInfos(type.type);
  assert.equal(properties.length === 1 && properties[0].name === "second", true,
    "the fresh aggregate excludes the destructured key without losing its actual checked component");
  const selected = resolved(storage.subjectFor(variable("selected"))).subject;
  const external = storage.closedOriginsFor(selected, bindings);
  assert.equal(external.kind === "open" && external.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "fresh rest identity does not prove the contents of an external caller's original input");
  const invocation = ast.as.AsVariableDeclaration(variable("result")).Initializer;
  const actual = resolved(storage.bindingsForInvocation(owner, invocation, storage.emptyBindings)).bindings;
  const value = storage.closedOriginsFor(selected, actual);
  assert.equal(value.kind === "complete" && value.origins.length === 1 &&
    ast.is.IsNumericLiteral(value.origins[0].subject.node) && ast.text(value.origins[0].subject.node) === "4", true,
  "a real checked caller supplies the original second component, not the omitted first component or the container");
  assert.equal(storage.failureReason() === undefined, true, "the same canonical allocation and component relation remain bounded");
});

test("parameter rest own writes preserve the caller aggregate and reject a foreign rest origin", async () => {
  const text = `
    const initial = {}; const replacement = {};
    function copy({ first, ...rest }: { first: number; second: {} }) {
      const alias = rest;
      alias.second = replacement;
      return rest;
    }
    const original = { first: 3, second: initial };
    const copied = copy(original);
    const selected = copied.second;
    const untouched = original.second;
    export {};
  `;
  const { ast, nodes, storage } = await fixture("parameter-rest-own-write", text);
  const variable = name => nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === name);
  const initial = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable("initial")).Initializer)).subject;
  const replacement = resolved(storage.subjectFor(ast.as.AsVariableDeclaration(variable("replacement")).Initializer)).subject;
  const selected = storage.closedOriginsFor(resolved(storage.subjectFor(variable("selected"))).subject);
  assert.equal(selected.kind === "complete" && selected.origins.length === 2 &&
    [initial, replacement].every(subject => selected.origins.some(origin => origin.subject === subject)), true,
  "flow-insensitive rest storage retains its actual snapshot and own replacement, never an unknown caller union");
  const untouched = storage.closedOriginsFor(resolved(storage.subjectFor(variable("untouched"))).subject);
  assert.equal(untouched.kind === "complete" && untouched.origins.length === 1 && untouched.origins[0].subject === initial, true,
    "a fresh rest field mutation cannot write back through its original caller-owned aggregate");
  const foreign = await fixture("parameter-rest-own-write-foreign", text);
  const foreignRest = foreign.nodes.find(node => foreign.ast.is.IsBindingElement(node) &&
    foreign.ast.as.AsBindingElement(node).DotDotDotToken !== undefined);
  assert.equal(foreignRest !== undefined && storage.subjectFor(foreignRest).kind === "unresolved", true,
    "another checked program's same-shaped rest cannot supply an original allocation");
  assert.equal(storage.failureReason() === undefined, true, "a foreign query does not poison this exact rest provenance");
});

for (const setter of [false, true]) {
  test("an unrelated setter cannot contaminate a checked getter or passive method value: " + setter, async () => {
    const current = await fixture("spread-independent-getter-method-" + setter, `
      const value = {};
      const original = {
        get read(): () => {} { return () => value; },
        method(): {} { return value; },
        ${setter ? "set unrelated(value: number) {}" : "unrelated: 0"}
      };
      const copied = { ...original };
      export const read = copied.read;
      export const method = copied.method;
    `);
    const { ast, nodes, storage } = current;
    for (const [name, predicate] of [["read", ast.is.IsArrowFunction], ["method", ast.is.IsMethodDeclaration]]) {
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const expected = nodes.find(predicate);
      const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
      assert.equal(selected.kind === "complete" && selected.producers.length === 1 &&
        selected.producers[0].subject.node === expected, true, name + ": the actual independent declaration determines the value");
    }
    assert.equal(storage.accessorInvocations.length === 1 && ast.is.IsSpreadAssignment(storage.accessorInvocations[0]), true,
      "one real getter evaluation; neither the unrelated setter nor the passive method is invoked");
    assert.equal(storage.failureReason(), undefined, "an unrelated setter cannot poison a different checked component");
  });
}

test("a spread getter is evaluated even when its copied result is overwritten", async () => {
  const current = await fixture("spread-getter-overwritten-evaluation", `
    const initial = {};
    const replacement = {};
    const original = { get read(): () => {} { return () => initial; } };
    const copied = { ...original, read: () => replacement };
    export const first = copied.read;
    export const second = copied.read;
  `);
  const { ast, nodes, storage } = current;
  const replacement = nodes.filter(node => ast.is.IsArrowFunction(node)).at(-1);
  for (const name of ["first", "second"]) {
    const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
    assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === replacement, true,
      name + ": the definite own override is the only resulting callable");
  }
  const spreads = nodes.filter(node => ast.is.IsSpreadAssignment(node));
  assert.equal(storage.accessorInvocations.length === 1 && storage.accessorInvocations[0] === spreads[0], true,
    "the original observable getter evaluation is retained once, including when no result is read");
});

test("writes to a copied getter result are writes to its new own field, not to the original accessor", async () => {
  const current = await fixture("spread-getter-own-field-write", `
    const initial = {};
    const replacement = {};
    const original = { get read(): () => {} { return () => initial; } };
    const copied = { ...original };
    copied.read = () => replacement;
    const selected = copied.read;
    const untouched = original.read;
    const invoked = copied.read();
    export {};
  `);
  const { ast, nodes, storage } = current;
  const arrows = nodes.filter(node => ast.is.IsArrowFunction(node));
  const selectedNode = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "selected");
  const selected = storage.storageProducersFor(resolved(storage.subjectFor(selectedNode)).subject);
  assert.equal(selected.kind === "complete" && selected.producers.length === 2 &&
    arrows.every(arrow => selected.producers.some(producer => producer.subject.node === arrow)), true,
  "the existing flow-insensitive field domain retains its original snapshot and the actual later own write");
  const untouchedNode = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === "untouched");
  const untouched = storage.storageProducersFor(resolved(storage.subjectFor(untouchedNode)).subject);
  assert.equal(untouched.kind === "complete" && untouched.producers.length === 1 && untouched.producers[0].subject.node === arrows[0], true,
    "a new own-field mutation cannot become a write to the original getter return");
  const invocations = storage.accessorInvocations;
  assert.equal(invocations.length === 2 && invocations.every(node => ast.is.IsSpreadAssignment(node) ||
    ast.is.IsPropertyAccessExpression(node) && ast.text(ast.as.AsPropertyAccessExpression(node).Expression) === "original"), true,
  "later copied-field reads/calls never execute the original getter");
  const call = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "copied.read");
  const implementations = resolved(storage.invocationImplementationsFor(call));
  assert.equal(implementations.exact && implementations.nodes.length === 2 && arrows.every(arrow => implementations.nodes.includes(arrow)), true,
    "the original accessor result and actual own-field write remain discoverable before source execution SCCs seal");
});

for (const optional of [false, true]) for (const reversed of [false, true]) {
  test("an external spread keeps only the applicable original method alternatives: " + optional + "/" + reversed, async () => {
    const current = await fixture("method-spread-external-" + optional + "/" + reversed, `
      function make(value: {}): { read(): {} } { return { read(): {} { return value; } }; }
      export function choose(external: { read${optional ? "?" : ""}: () => {} }) {
        const original = make({});
        const copied = { ...original, ...external };
        return copied.read;
      }
    `);
    const { ast, nodes, storage } = current;
    const owner = current.declaration("choose");
    const expression = nodes.find(node => ast.is.IsPropertyAccessExpression(node));
    const original = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const subject = resolved(storage.subjectFor(expression)).subject;
    const bindings = resolved(storage.bindingsForDeclaration(owner)).bindings;
    if (reversed) assert.equal(storage.closedOriginsFor(subject, bindings).kind, "open",
      "an external last contributor is not completed merely because an earlier source factory is known");
    const selected = storage.storageProducersFor(subject, bindings);
    assert.equal(selected.kind, "open", "the exact external member demand remains open");
    assert.equal(selected.producers.some(value => value.subject.node === original), optional,
      "only an optional later member can leave the earlier source implementation present");
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
      "the unknown producer retains its genuine external-input boundary");
  });
}

for (const [name, text, owners] of [
  ["function-type-alias", `function deliver(actual: number): number { return actual; }
    const alias: (renamed: number) => number = deliver; export const result = alias(7);`, ["deliver"]],
  ["this-tuple-rest-alias", `function deliver(this: void, ...values: [actual: number, label: string]): number { return values[0]; }
    const alias: (renamed: number, label: string) => number = deliver; export const result = alias(7, "text");`, ["deliver"]],
  ["finite-callable-union", `function deliver(actual: number): number { return actual; }
    function alternative(actual: number): number { return actual; }
    export function run(flag: boolean): number { const alias = flag ? deliver : alternative; return alias(7); }`, ["deliver", "alternative"]],
  ["interface-method", `interface Contract { deliver(renamed: number): number; }
    class Holder implements Contract { deliver(actual: number): number { return actual; } }
    const alias: Contract = new Holder(); export const result = alias.deliver(7);`, ["Holder"]],
  ["overridden-method", `class Base { deliver(actual: number): number { return actual; } }
    class Derived extends Base { override deliver(actual: number): number { return actual; } }
    const alias: Base = new Derived(); export const result = alias.deliver(7);`, ["Derived"]],
  ["constructor-alias", `class Holder { constructor(actual: number) { void actual; } }
    const Selected: new (renamed: number) => Holder = Holder; export const result = new Selected(7);`, ["Holder"]],
]) for (const reversed of [false, true]) {
  test("storage-proven actual implementations retain checked callable inputs: " + name + "/" + reversed, async () => {
    const current = await fixture("actual-input-implementation-" + name, text +
      "\nfunction unrelated(value: number): number { return value; }");
    const { ast, nodes, source, storage } = current;
    const invocation = nodes.find(node => (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) &&
      ast.arguments(node).some(argument => argument !== undefined && ast.is.IsNumericLiteral(argument) && ast.text(argument) === "7"));
    const consumer = source.semantics.forNode(invocation);
    const selected = consumer.operations.call(invocation);
    assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "one real checked call owns effective actual bindings");
    const unrelated = current.declaration("unrelated");
    if (reversed) assert.equal(storage.bindingsForInvocation(unrelated, invocation).kind, "unresolved",
      "an unrelated source body cannot acquire this call's actual binding");
    const candidates = resolved(storage.invocationImplementationsFor(invocation));
    for (const name of reversed ? [...owners].reverse() : owners) {
      const declaration = nodes.find(node =>
        (ast.is.IsFunctionDeclaration(node) && ast.text(ast.name(node)) === name ||
          (ast.is.IsMethodDeclaration(node) || ast.is.IsConstructorDeclaration(node)) && ast.text(ast.name(ast.parent(node))) === name) &&
        ast.body(node) !== undefined);
      assert.equal(declaration !== undefined && candidates.nodes.includes(declaration), true,
        "the existing storage owner, not a selected type declaration, proves the actual body");
      const slots = sourceStorageCallableInputSlots(source, declaration, consumer,
        { kind: "source-implementation", signature: selected.selectedSignature }, () => true);
      assert.equal(slots !== undefined && slots.length > 0, true, "actual implementation has its own completed input correspondence");
      const slot = slots[0];
      assert.equal(slot.projection !== undefined, true, "the actual authored input component is proven, not an omitted projection");
      const formal = resolved(storage.subject(slot.parameter, "input", slot.projection)).subject;
      const bindings = resolved(storage.bindingsForInvocation(declaration, invocation)).bindings;
      const origins = resolved(storage.boundOriginsFor(formal, bindings));
      assert.equal(origins.subjects.length, 1, "one actual argument, never a contract parameter or merged source row");
      assert.equal(ast.is.IsNumericLiteral(origins.subjects[0].node) && ast.text(origins.subjects[0].node) === "7", true,
        "the exact checked value reaches the actual source input, including this/rest expansion");
    }
    assert.equal(storage.bindingsForInvocation(unrelated, invocation).kind, "unresolved",
      "candidate validation remains with the same canonical storage producer owner");
    assert.equal(storage.failureReason() === undefined, true, "body-contract differences do not become a budget failure");
  });
}

for (const timing of ["synchronous", "unknown", "none"]) for (const reversed of [false, true]) {
  test("uncertain native execution is possible, never certified as an executed source body: " + timing + "/" + reversed, async () => {
    const current = await fixture("native-execution-certainty-" + timing, `
      declare function observe(value: number): void;
      declare function nativeInvoke(callback: () => void): void;
      export function create(value: number) { return () => { nativeInvoke(() => { observe(value); }); }; }
    `, (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        if (source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) !== native) return undefined;
        return timing === "synchronous" ? [{ parameterIndex: 0, timing }] : timing === "none" ? [] : undefined;
      } };
    });
    const { ast, nodes, storage, declaration } = current;
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.is.IsReturnStatement(ast.parent(node)));
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const owner = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
    const outer = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const produced = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, outer);
    assert.equal(produced.kind, "complete", "one actual explicit source entry creation");
    assert.equal(produced.producers.length, 1, "the checked entry is not replaced with a global root");
    const demand = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
    if (reversed) resolved(storage.originSubjectsFor(demand));
    const selected = storage.contributingExecutionsFor(demand, owner, produced.producers[0]);
    assert.equal(selected.kind, timing === "unknown" ? "open" : "complete", "only actual missing execution evidence creates an open demand");
    assert.equal(selected.producers.length, timing === "synchronous" ? 1 : 0,
      "possible execution is not a certified producer, and known no-invocation stays empty");
    if (selected.kind === "open") {
      assert.equal(selected.boundaries.length, 1, "the actual native callback owns one possible continuation");
      const boundary = selected.boundaries[0];
      assert.equal(boundary.subject === demand, true, "the demanded original use, not an unrelated call, retains uncertainty");
      const origins = resolved(storage.boundOriginsFor(resolved(storage.subjectFor(ast.arguments(use)[0])).subject, boundary.bindings));
      assert.equal(origins.subjects.length === 1 && origins.subjects[0].node === ast.parameters(declaration("create"))[0], true,
        "possible native execution keeps the original capture binding");
    }
    assert.equal(storage.failureReason() === undefined, true, "local execution uncertainty is not a global failure");
  });
}

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
      assert.equal(selected.producers.length, timing === undefined ? 0 : 2,
        "only completed execution contracts certify the actual native callback ports");
      const executions = selected.kind === "open" ? selected.boundaries : selected.producers;
      assert.equal(executions.length, 2, "one correlated execution context for each selected native callback port");
      const observed = new Set();
      const bindings = new Set();
      for (const producer of (pass === 0) !== reversed ? executions : executions.slice().reverse()) {
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
      views.push(executions.map(producer => producer.bindings));
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

for (const reversed of [false, true]) {
  test("inherited physical getters retain their own factory capture rather than the derived factory: " + reversed, async () => {
    const { ast, nodes, storage, declaration } = await fixture("inherited-getter-original-factory-" + reversed, `
      interface View { readonly read: () => number; }
      type Factory = new () => View;
      function makeBase(value: number) { return class Base { get read(): () => number { return () => value; } }; }
      function makeDerived(Parent: Factory, value: number) { return class Derived extends Parent { readonly other = value; }; }
      const First = makeDerived(makeBase(1), 9);
      const Second = makeDerived(makeBase(2), 10);
      const first = new First().read;
      const second = new Second().read;
      export {};
    `);
    const getter = nodes.find(node => ast.is.IsGetAccessorDeclaration(node));
    assert.equal(getter !== undefined, true, "the actual authored base getter is retained");
    const returned = nodes.find(node => ast.is.IsArrowFunction(node) && ast.is.IsReturnStatement(ast.parent(node)) &&
      ast.parent(ast.parent(node)) === ast.body(getter));
    assert.equal(returned !== undefined, true, "the original physical base getter returns one original authored arrow");
    const capturedValue = resolved(storage.subjectFor(ast.body(returned))).subject;
    const captures = new Set();
    for (const name of reversed ? ["second", "first"] : ["first", "second"]) {
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      assert.equal(variable !== undefined, true, "the actual inherited getter read has its original source binding");
      const selected = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
      assert.equal(selected.kind === "complete" && selected.producers.length === 1 && selected.producers[0].subject.node === returned, true,
        "the getter's actual class owner determines the returned original arrow");
      const producer = selected.producers[0];
      const values = resolved(storage.boundOriginsFor(capturedValue, producer.bindings));
      assert.equal(values.subjects.length === 1 && ast.is.IsNumericLiteral(values.subjects[0].node) &&
        ast.text(values.subjects[0].node) === (name === "first" ? "1" : "2"), true,
      "the base factory value never becomes the derived factory value or another instance's capture");
      const activation = resolved(storage.boundActivationsFor(declaration("makeBase"), producer.bindings));
      assert.equal(activation.activations.length, 1, "one real original base factory activation");
      captures.add(activation.activations[0].bindings);
    }
    assert.equal(captures.size, 2, "one base-class AST retains both distinct actual factory activations");
    assert.equal(storage.failureReason() === undefined, true, "inherited getter selection uses the existing bounded capture equations");
  });
}

for (const actual of ["present", "absent", "external"]) {
  test("native initialized inputs select actual values before optional contextual bounds: " + actual, async () => {
    const current = await fixture("native-initialized-presence-" + actual, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: (Part | undefined)[], callback: (actual: Part | undefined) => void): void;
      declare const external: (number | undefined)[];
      export function create(value: number) {
        function deliver(actual: number = 99): void { observe(actual); }
        return () => { nativeInvoke(${actual === "present" ? "[value]" : actual === "absent" ? "[undefined]" : "external"}, deliver); };
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
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const executor = nodes.find(node => ast.is.IsArrowFunction(node));
    const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const entry = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
    assert.equal(entry.kind === "complete" && entry.producers.length === 1, true, "one actual native entry creation");
    const executions = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
      declaration("deliver"), entry.producers[0]);
    assert.equal(executions.kind === "complete" && executions.producers.length === 1, true, "one exact checked callback execution");
    const selected = storage.storageProducersFor(resolved(storage.subjectFor(ast.arguments(use)[0])).subject, executions.producers[0].bindings);
    if (actual === "external") assert.equal(selected.kind === "complete", false,
      "a possibly absent external element is not checked omission and cannot authorize a default-only answer");
    else {
      const expected = actual === "present" ? ast.parameters(declaration("create"))[0]
        : ast.as.AsParameterDeclaration(ast.parameters(declaration("deliver"))[0]).Initializer;
      assert.equal(selected.kind === "open" && selected.producers.length === 1 && selected.producers[0].subject.node === expected, true,
        "only the actual present argument or the actual checked absence chooses this value");
      const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "nativeInvoke");
      assert.equal(selected.boundaries.length, actual === "present" ? 2 : 1, "the complete set of genuine exposures is retained");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write" && boundary.exposure === invocation), true,
        "synchronous callback metadata does not promise preservation of its actual input array");
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input" && boundary.exposure === declaration("create")),
        actual === "present", "only the actual exported caller input adds this exact external boundary");
    }
    assert.equal(storage.failureReason(), undefined, "unknown input presence is not a budget failure");
  });
}

test("native initialized inputs are complete with actual preserved storage and a closed original caller", async () => {
  const current = await fixture("native-initialized-preserved-closed-caller", `
    declare function observe(value: number): void;
    declare function nativeInvoke<Part>(values: (Part | undefined)[], callback: (actual: Part | undefined) => void): void;
    function create(value: number) {
      function deliver(actual: number = 99): void { observe(actual); }
      return () => { nativeInvoke([value], deliver); };
    }
    const actual = 7;
    const execute = create(actual);
    execute();
    export {};
  `, (source, nodes) => {
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    const selectedNative = (node, selected) => source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native;
    return {
      callbackEntries(node, selected) {
        return selectedNative(node, selected)
          ? [{ parameterIndex: 1, timing: "synchronous", inputs: [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }] }]
          : undefined;
      },
      call(node, selected) {
        if (!selectedNative(node, selected)) return undefined;
        const binding = selected.sourceArgumentBindings.find(value => value.sourceParameterIndex === 0 &&
          value.sourceForm === "value" && value.sourceParameterForm === "parameter");
        const input = binding === undefined ? undefined : selected.sourceArguments[binding.sourceArgumentIndex]?.expression;
        return input === undefined ? undefined : { preservedInputs: [input] };
      },
    };
  });
  const { ast, nodes, storage, declaration } = current;
  const execute = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "execute");
  const original = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "actual");
  const entry = storage.storageProducersFor(resolved(storage.subjectFor(execute)).subject);
  assert.equal(entry.kind === "complete" && entry.producers.length === 1, true, "one closed actual executor creation");
  const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
  const executions = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
    declaration("deliver"), entry.producers[0]);
  assert.equal(executions.kind === "complete" && executions.producers.length === 1, true, "one same-creation actual native callback execution");
  const selected = storage.storageProducersFor(resolved(storage.subjectFor(ast.arguments(use)[0])).subject, executions.producers[0].bindings);
  assert.equal(selected.kind === "complete" && selected.producers.length === 1 &&
    selected.producers[0].subject.node === ast.as.AsVariableDeclaration(original).Initializer, true,
    "actual input preservation and the original closed caller prove exactly the authored value, never an assumed default");
  assert.equal(storage.failureReason() === undefined, true);
});

for (const [actual, code] of [["[undefined]", 2322], ["external", 2345]]) {
  test("native initialized input declarations do not admit absent elements in Part[]: " + code, async () => {
    const checked = await checkedSource("native-initialized-invalid-elements-" + code, {
      "globals.d.ts": `
        interface Object {} interface Function {} interface CallableFunction extends Function {}
        interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
        interface Number {} interface String {} interface RegExp {}
        interface Array<T> { [index: number]: T; length: number; }
        interface ReadonlyArray<T> { readonly [index: number]: T; readonly length: number; }
      `,
      "src/index.ts": `
        declare function observe(value: number): void;
        declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part | undefined) => void): void;
        declare const external: (number | undefined)[];
        export function create(value: number) {
          function deliver(actual: number = 99): void { observe(actual); }
          return () => { nativeInvoke(${actual}, deliver); };
        }
      `,
    });
    assert.equal(checked.diagnostics.length, 1, "the original authored input contract remains invalid");
    assert.equal(checked.diagnostics[0].code, code, "the native checker retains its exact element incompatibility");
    assert.equal(checked.extensionDiagnostics.length, 0, "storage admission does not bypass source checking");
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
    assert.equal(origins.subjects.some(subject => ast.is.IsNumericLiteral(subject.node) && ast.text(subject.node) === "99"), false,
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
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined &&
      ast.is.IsReturnStatement(ast.parent(node)) && ast.parent(ast.parent(node)) === ast.body(declaration("create")));
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
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined &&
      ast.is.IsReturnStatement(ast.parent(node)) && ast.parent(ast.parent(node)) === ast.body(declaration("create")));
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

for (const shape of ["direct", "spread", "nested-spread", "field", "getter-result", "overwritten"]) for (const mapped of [false, true]) {
  test("native payload components retain real copied callable provenance: " + shape + "/" + mapped, async () => {
    const original = shape === "field" ? "run: (): void => { observe(value); }"
      : shape === "getter-result" ? "get run(): () => void { return (): void => { observe(value); }; }"
        : "run(): void { observe(value); }";
    const result = shape === "direct" ? "original" : shape === "nested-spread" ? "{ ...{ ...original } }"
      : shape === "overwritten" ? "{ ...original, run(): void { observeOther(7); } }" : "{ ...original }";
    const { ast, nodes, storage, declaration } = await fixture("native-copied-payload-" + shape + "/" + mapped, `
      declare function observe(value: number): void;
      declare function observeOther(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make(value: number) { const original = { ${original} }; return ${result}; }
      export function create(first: number, second: number) {
        const firstPayload = make(first); const secondPayload = make(second);
        return () => { nativeInvoke([firstPayload, secondPayload], actual => { actual.run(); }); };
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
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const owner = nodes.find(node => ast.body(node) === storage.enclosingRegionFor(use));
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined &&
      ast.is.IsReturnStatement(ast.parent(node)) && ast.parent(ast.parent(node)) === ast.body(declaration("create")));
    const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
    assert.equal(domain.kind === "complete" && domain.producers.length === 1, true, "one actual retained executor creation");
    const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
      owner, domain.producers[0]);
    const relevant = shape !== "overwritten";
    assert.equal(selected.kind, relevant && !mapped ? "open" : "complete",
      "copied callable uncertainty remains demand-local; overwritten callbacks are never executed");
    assert.equal(selected.producers.length > 0, relevant && mapped, "only exact checked native input correspondence proves execution");
    if (relevant) {
      const creations = new Set();
      const values = new Set();
      for (const row of selected.kind === "open" ? selected.boundaries : selected.producers) {
        const activation = resolved(storage.boundActivationsFor(declaration("make"), row.bindings));
        assert.equal(activation.activations.length, 1, "every actual payload retains its original factory activation");
        creations.add(activation.activations[0].bindings);
        const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
        const origins = resolved(storage.boundOriginsFor(argument, row.bindings));
        for (const subject of origins.subjects) values.add(subject.node);
      }
      assert.equal(creations.size, 2, "two original factory creations do not collapse through spreads or native input");
      assert.equal(values.size === 2 && ast.parameters(declaration("create")).every(parameter => values.has(parameter)), true,
        "original first/second capture rows stay correlated, never replaced with a callback registration snapshot");
    }
    assert.equal(storage.failureReason() === undefined, true, "unknown native inputs remain local and use the same bounded query");
  });
}

for (const sameValue of [false, true]) for (const reversed of [false, true]) {
  test("an uncertain native input boundary publishes each actual factory creation binding: " + reversed +
    (sameValue ? "/equal-values" : ""), async () => {
    const current = await fixture("native-boundary-factory-creation", `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make(callback: (value: number) => void, value: number): () => void { return () => { callback(value); }; }
      export function create(first: number, second: number) {
        const firstCallback = make(observe, first);
        const secondCallback = make(observe, ${sameValue ? "first" : "second"});
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
    const parameters = ast.parameters(declaration("create"));
    assert.equal(sameValue ? actuals.size === 1 && actuals.has(parameters[0])
      : actuals.size === 2 && parameters.every(parameter => actuals.has(parameter)), true,
    "both original factory argument rows survive without substitution or cross-union");
    assert.equal(storage.boundOriginsFor(argument, {}).kind, "unresolved", "a fabricated scope is never replaced with empty bindings");
    assert.equal(storage.failureReason() === undefined, true, "unknown correspondence stays local");
  });
}

for (const nativeForward of [false, true]) for (const reversed of [false, true]) {
  test("possible native payload execution publishes demand-owner helper bindings: " + nativeForward + "/" + reversed, async () => {
    const current = await fixture("native-boundary-demand-owner", `
      declare function observeFirst(value: number): void;
      declare function observeSecond(value: number): void;
      declare function observeOutside(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      declare function nativeAgain(callback: () => void): void;
      function send(callback: (value: number) => void, value: number): void { callback(value); }
      function make(callback: (value: number) => void, value: number): () => void { return () => { send(callback, value); }; }
      export function create(first: number, second: number) {
        const firstCallback = make(observeFirst, first);
        const secondCallback = make(observeSecond, second);
        return () => {
          ${reversed ? "send(observeOutside, 99);" : ""}
          nativeInvoke([${reversed ? "secondCallback, firstCallback" : "firstCallback, secondCallback"}], next => {
            ${nativeForward ? "nativeAgain(next);" : "next();"}
          });
          ${reversed ? "" : "send(observeOutside, 99);"}
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
    const helperBindings = new Set();
    const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
    for (const boundary of reversed ? [...selected.boundaries].reverse() : selected.boundaries) {
      assert.equal(boundary.subject === demand && Object.isFrozen(boundary.bindings), true, "the original demand has owned immutable bindings");
      const contexts = resolved(storage.boundActivationsFor(owner, boundary.bindings));
      assert.equal(contexts.activations.length === 1 && contexts.activations[0].kind === "invocation" &&
        contexts.activations[0].invocation === forwarded, true, "the real forwarding call, not a factory frame, owns the demand");
      const bindings = contexts.activations[0].bindings;
      helperBindings.add(bindings);
      assert.equal(storage.boundActivationsFor(declaration("make"), bindings).kind, "unresolved",
        "a top-level helper has no invented factory lexical parent");
      const values = resolved(storage.boundOriginsFor(argument, bindings)).subjects;
      const callbacks = resolved(storage.boundOriginsFor(demand, bindings)).subjects;
      assert.equal(values.length === 1 && callbacks.length === 1, true, "one original callback and value in each actual helper row");
      const parameters = ast.parameters(declaration("create"));
      assert.equal(values[0].node === parameters[0] && callbacks[0].node === declaration("observeFirst") ||
        values[0].node === parameters[1] && callbacks[0].node === declaration("observeSecond"), true,
      "observerFirst/first and observerSecond/second cannot cross or acquire observerOutside/99");
      actuals.add(values[0].node);
      const producers = storage.storageProducersFor(argument, bindings);
      assert.equal(producers.kind !== "unresolved" && producers.producers.length === 1 &&
        producers.producers[0].subject.node === values[0].node, true, "the actual argument producer agrees with its bound value");
      const original = resolved(storage.boundActivationsFor(declaration("create"), producers.producers[0].bindings));
      assert.equal(original.activations.length, 1, "the argument retains its actual original owner rather than a guessed helper parent");
    }
    assert.equal(helperBindings.size, 2, "the same helper call retains two distinct actual argument/creation rows");
    assert.equal(actuals.size === 2 && ast.parameters(declaration("create")).every(parameter => actuals.has(parameter)), true,
      "the separate literal99 call cannot enter the possible observer's argument domain");
    assert.equal(storage.failureReason() === undefined, true, "conditional provenance uses the existing bounded scoped relation");
  });
}

test("known helper execution follows the same complete scoped successor traversal", async () => {
  const { ast, nodes, storage, declaration } = await fixture("source-helper-complete-execution", `
    declare function observe(value: number): void;
    function send(callback: (value: number) => void, value: number): void { callback(value); }
    export function create(value: number) { return () => { send(observe, value); }; }
  `);
  const owner = declaration("send");
  const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
  const invocation = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "send");
  const executor = nodes.find(node => ast.is.IsArrowFunction(node));
  const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
  const domain = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
  assert.equal(domain.kind === "complete" && domain.producers.length === 1, true, "one original closed executor");
  const selected = storage.contributingExecutionsFor(resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject,
    owner, domain.producers[0]);
  assert.equal(selected.kind, "complete", "known real invocation has no conditional boundary");
  assert.equal(selected.producers.length, 1, "direct successor regions cannot erase the real helper demand");
  const contexts = resolved(storage.boundActivationsFor(owner, selected.producers[0].bindings));
  assert.equal(contexts.activations.length === 1 && contexts.activations[0].kind === "invocation" &&
    contexts.activations[0].invocation === invocation, true, "the exact source invocation owns the demand");
  const argument = resolved(storage.subjectFor(ast.arguments(use)[0])).subject;
  const values = resolved(storage.boundOriginsFor(argument, contexts.activations[0].bindings)).subjects;
  assert.equal(values.length === 1 && values[0].node === ast.parameters(declaration("create"))[0], true,
    "the original argument row reaches the helper without global source union");
});

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

for (const view of ["View", "{ tag: number; read?: () => number }"]) for (const inherited of [false, true]) {
  test("a closed actual class absence preserves the earlier copied method: " + view + "/" + inherited, async () => {
    const { ast, nodes, storage } = await fixture("class-copy-positive-absence-" + view + "/" + inherited, `
      interface View { tag: number; read?: () => number; }
      const original = { read(): number { return 7; } };
      class Empty implements View { tag = 1; }
      ${inherited ? "class Derived extends Empty {}" : ""}
      function copy(view: ${view}) { return { ...original, ...view }; }
      export const selected = copy(new ${inherited ? "Derived" : "Empty"}()).read;
    `);
    const selected = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) &&
      ast.text(ast.name(node)) === "selected");
    const original = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const result = storage.storageProducersFor(resolved(storage.subjectFor(selected)).subject);
    assert.equal(result.kind === "complete" && result.producers.length === 1 && result.producers[0].subject.node === original, true,
      "complete actual optional absence resumes the earlier contribution, never unknown or an invented undefined");
    assert.equal(storage.failureReason() === undefined, true, "positive absence preserves a monotone completed relation");
  });
}

for (const shape of ["absent", "present", "conditional"]) for (const reversed of [false, true]) {
  test("closed present and absent class alternatives keep both source outcomes: " + shape + "/" + reversed, async () => {
    const { ast, nodes, storage, declaration } = await fixture("class-copy-alternatives-" + shape + "/" + reversed, `
      interface View { tag: number; read?: () => number; }
      const original = { read(): number { return 7; } };
      class Empty implements View { tag = 1; }
      class Present implements View { tag = 2; read = (): number => 11; }
      function copy(view: View) { return { ...original, ...view }; }
      export function choose(flag: boolean) {
        const actual = ${shape === "conditional" ? "flag ? new Empty() : new Present()" : `new ${shape === "absent" ? "Empty" : "Present"}()`};
        return copy(actual).read;
      }
    `);
    const access = nodes.find(node => ast.is.IsPropertyAccessExpression(node));
    const subject = resolved(storage.subjectFor(access)).subject;
    const bindings = resolved(storage.bindingsForDeclaration(declaration("choose"))).bindings;
    if (reversed) resolved(storage.originSubjectsFor(subject));
    const result = storage.storageProducersFor(subject, bindings);
    assert.equal(result.kind, "complete", "every actual alternative has checked class/member correspondence");
    const earlier = nodes.find(node => ast.is.IsMethodDeclaration(node));
    const later = nodes.find(node => ast.is.IsArrowFunction(node));
    assert.equal(result.producers.some(value => value.subject.node === earlier), shape !== "present",
      "only a genuinely absent alternative preserves the earlier source method");
    assert.equal(result.producers.some(value => value.subject.node === later), shape !== "absent",
      "the actual own field overrides, never the static optional view");
    assert.equal(storage.failureReason() === undefined, true, "query order cannot retract a proved absence");
  });
}

for (const form of ["ordinary", "renamed", "default", "rest"]) for (const reversed of [false, true]) {
  test("registered binding getters keep real value execution and context identity: " + form + "/" + reversed, async () => {
    const binding = form === "rest" ? "const { ignored, ...copied } = source; return copied.read();"
      : form === "renamed" ? "const { read: selected } = source; return selected();"
      : form === "default" ? "const { read = () => -1 } = source; return read();"
      : "const { read } = source; return read();";
    const current = await fixture("binding-getter-real-execution-" + form + "/" + reversed, `
      declare function observe(value: number): void;
      function make(value: number) {
        const source = { ignored: 0, get read(): () => number { observe(value); return () => value; } };
        return () => { ${binding} };
      }
      export const first = make(7); export const second = make(11);
    `);
    const { ast, nodes, storage, declaration } = current;
    const observe = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const demanded = resolved(storage.subjectFor(ast.as.AsCallExpression(observe).Expression)).subject;
    const getter = nodes.find(node => ast.is.IsGetAccessorDeclaration(node));
    const argument = resolved(storage.subjectFor(ast.arguments(observe)[0])).subject;
    const names = reversed ? ["second", "first"] : ["first", "second"];
    const keys = new Map();
    for (const name of names) {
      const variable = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) && ast.text(ast.name(node)) === name);
      const result = storage.storageProducersFor(resolved(storage.subjectFor(variable)).subject);
      assert.equal(result.kind === "complete" && result.producers.length === 1, true, "one actual independently created executor");
      const executions = storage.contributingExecutionsFor(demanded, getter, result.producers[0]);
      assert.equal(executions.kind === "complete" && executions.producers.length === 1, true,
        "the actual binding executes its getter once, never an invented property access");
      const origins = resolved(storage.boundOriginsFor(argument, executions.producers[0].bindings));
      assert.equal(origins.subjects.length === 1 && ast.text(origins.subjects[0].node) === (name === "first" ? "7" : "11"), true,
        "the getter retains its exact original factory actual");
      const site = storage.accessorInvocations.find(node => ast.is.IsBindingElement(node));
      const context = resolved(storage.invocationContextKeyFor(site, executions.producers[0].bindings));
      keys.set(name, context.key);
    }
    assert.equal(keys.get("first") !== keys.get("second"), true, "different actual creation demands never share a getter context");
    assert.equal(ast.body(declaration("make")) !== undefined && storage.failureReason() === undefined, true);
  });
}

for (const shape of ["class", "inherited", "object"]) for (const mapped of [false, true]) for (const invoked of [false, true]) {
  test("native payload getters require an actual evaluation and preserve local uncertainty: " + shape + "/" + mapped + "/" + invoked, async () => {
    const declarationText = shape === "object" ? "return { get run(): () => void { return () => { observe(value); }; } };"
      : `class Payload { get run(): () => void { return () => { observe(value); }; } }
         ${shape === "inherited" ? "class Derived extends Payload {}" : ""}
         return new ${shape === "inherited" ? "Derived" : "Payload"}();`;
    const { ast, nodes, storage, declaration } = await fixture("native-passive-getter-" + shape + "/" + mapped + "/" + invoked, `
      declare function observe(value: number): void;
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make(value: number) { ${declarationText} }
      export function create(first: number, second: number) {
        const left = make(first); const right = make(second);
        return () => { nativeInvoke([left, right], actual => { ${invoked ? "actual.run();" : "void actual;"} }); };
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
    const use = nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node).Expression) === "observe");
    const owner = nodes.find(node => ast.is.IsArrowFunction(node) && ast.body(node) === storage.enclosingRegionFor(use));
    const executor = nodes.find(node => ast.is.IsArrowFunction(node) && ast.parent(node) !== undefined &&
      ast.is.IsReturnStatement(ast.parent(node)) && ast.parent(ast.parent(node)) === ast.body(declaration("create")));
    const bindings = resolved(storage.bindingsForDeclaration(declaration("create"))).bindings;
    const result = storage.storageProducersFor(resolved(storage.subjectFor(executor)).subject, bindings);
    assert.equal(result.kind === "complete" && result.producers.length === 1, true, "one checked executor creation");
    const demanded = resolved(storage.subjectFor(ast.as.AsCallExpression(use).Expression)).subject;
    const selected = storage.contributingExecutionsFor(demanded, owner, result.producers[0]);
    assert.equal(selected.kind, invoked && !mapped ? "open" : "complete", "uncertainty belongs only to a relevant actual native input");
    assert.equal(selected.producers.length > 0, invoked && mapped, "payload discovery is never a getter invocation license");
    if (selected.kind === "open") assert.equal(selected.boundaries.length > 0 && selected.boundaries.every(boundary =>
      ast.is.IsCallExpression(boundary.exposure) && ast.text(ast.as.AsCallExpression(boundary.exposure).Expression) === "nativeInvoke"), true,
    "the real native invocation retains each actual creation frontier");
    assert.equal(storage.failureReason() === undefined, true, "a passive getter cannot poison unrelated source storage");
  });
}
