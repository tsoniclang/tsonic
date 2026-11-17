import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

test("referenced native declarations retain ambient context without becoming collected project nodes", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/native.d.ts": "declare const NativeStorageGlobal: object;",
    "/src/index.ts": "export {}; const alias = NativeStorageGlobal;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const native = checked.getSourceFile("/src/native.d.ts");
  const declaration = namedVariable(source.ast, native, "NativeStorageGlobal");
  const transport = createSourceStorageTransport(source, [file], createSourceStorageBudget(defaultSourceStorageLimits));
  assert.equal(transport.declarationIsAmbient(declaration), true, "the checked external declaration inherits its actual declare statement");
  assert.equal(transport.hasNode(declaration), false, "context evidence does not admit a native declaration as collected project source");
  const storage = createSourceStorageQuery(source, [file]);
  const subject = storage.subjectFor(namedVariable(source.ast, file, "alias"));
  assert.equal(subject.kind === "resolved", true, "the source alias is owned");
  const selected = storage.closedOriginsFor(subject.subject);
  assert.equal(selected.kind === "open", true, selected.kind === "unresolved" ? selected.reason : "the external value is not a new empty binding");
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input" && boundary.subject.node === declaration), true,
    "the actual external declaration owns the input frontier");
  const collected = createSourceStorageTransport(source, [native, file], createSourceStorageBudget(defaultSourceStorageLimits));
  assert.equal(collected.hasNode(declaration), true, "context cached from a reference does not skip later authorized collection");
  assert.equal(collected.declarationIsAmbient(declaration), true, "both source orders share the one ambient-context producer");
});

function fixture(text, limits = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${text}` },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const declaration = name => nodes.find(node =>
    (source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsFunctionDeclaration(node) ||
      source.ast.is.IsClassDeclaration(node) || source.ast.is.IsPropertyDeclaration(node) ||
      source.ast.is.IsPropertySignatureDeclaration(node)) && source.ast.text(source.ast.name(node)) === name);
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, ...limits });
  const exact = selection => {
    assert.equal(selection.kind === "resolved", true, selection.kind === "unresolved" ? selection.reason : "exact selection");
    return selection;
  };
  const subject = (node, kind, projection) => exact(kind === undefined ? storage.subjectFor(node) : storage.subject(node, kind, projection)).subject;
  const input = (owner, index, projection = []) => subject(source.ast.parameters(declaration(owner))[index], "input", projection);
  const bindings = (owner, parent) => exact(storage.bindingsForDeclaration(declaration(owner), parent)).bindings;
  const initializer = name => Node_Initializer(source.ast, declaration(name));
  const origins = (value, context) => exact(storage.boundOriginsFor(value, context)).subjects;
  return { source, file, nodes, storage, declaration, initializer, subject, input, bindings, origins, exact };
}

function sameSubjects(actual, expected, label) {
  assert.equal(actual.length === expected.length && expected.every(subject => actual.includes(subject)), true, label);
}

test("declaration bindings preserve two equal-signature formal identities without closing over callers", () => {
  const current = fixture(`
    interface Callback { (value: number): number; }
    function pair(left: Callback, right: Callback) { const alias = left; return right; }
    const first = (value: number) => value + 1;
    const second = (value: number) => value + 2;
    const selected = pair(first, second);
  `);
  const left = current.input("pair", 0);
  const right = current.input("pair", 1);
  const before = current.origins(left, current.storage.emptyBindings);
  const context = current.bindings("pair");
  assert.equal(left !== right, true, "same signature is not same formal storage");
  sameSubjects(current.origins(left, context), [left], "left remains the first symbolic input");
  sameSubjects(current.origins(right, context), [right], "right remains the second symbolic input");
  sameSubjects(current.origins(current.subject(current.declaration("alias")), context), [left], "alias retains input identity");
  sameSubjects(current.origins(current.subject(current.declaration("pair"), "return"), context), [right], "return retains input identity");
  sameSubjects(current.origins(left, current.storage.emptyBindings), before, "symbolic queries do not poison ordinary queries");
  assert.equal(before.length === 1 && before[0].node === current.initializer("first"), true, "ordinary queries remain concrete");
  assert.equal(current.bindings("pair") === context, true, "declaration binding is canonical");
  const snapshots = [current.origins(left, context), current.origins(right, context)];
  assert.equal(Object.isFrozen(context) && context.kind === "source-storage-bindings" &&
    snapshots.every(values => Object.isFrozen(values) && values.every(Object.isFrozen)), true, "owned data is immutable");
});

test("identity and forwarding calls substitute onto local inputs rather than sibling callers", () => {
  const current = fixture(`
    interface Callback<Value> { (value: Value): Value; }
    function identity<Value>(value: Value): Value { return value; }
    function forward<Value>(value: Callback<Value>): Callback<Value> { return identity(value); }
    function pair<Value>(left: Callback<Value>, right: Callback<Value>) {
      const leftResult = forward(left); const rightResult = forward(right);
      return identity(leftResult);
    }
    const first = (value: number) => value + 1; const second = (value: number) => value + 2;
    const selected = pair(first, second);
  `);
  const context = current.bindings("pair");
  for (const [name, index] of [["leftResult", 0], ["rightResult", 1]]) {
    const formal = current.input("pair", index);
    sameSubjects(current.origins(current.subject(current.initializer(name)), context), [formal], name);
    const call = current.exact(current.storage.bindingsForInvocation(current.declaration("forward"), current.initializer(name), context));
    sameSubjects(current.origins(current.input("forward", 0), call.bindings), [formal], "invocation substitution retains caller symbol");
  }
  sameSubjects(current.origins(current.subject(current.declaration("pair"), "return"), context), [current.input("pair", 0)], "transitive identity result");
});

test("returned closures and nested declaration scopes preserve captured local inputs", () => {
  const current = fixture(`
    function retain<Value>(value: Value) { return () => value; }
    function pair(left: object, right: object) {
      const leftReader = retain(left); const rightReader = retain(right);
      const leftRead = leftReader(); const rightRead = rightReader();
      function nested(own: object) { const nestedRead = right; return own; }
      return nested(leftRead);
    }
    const selected = pair({}, {});
  `);
  const context = current.bindings("pair");
  for (const [name, index] of [["leftRead", 0], ["rightRead", 1]])
    sameSubjects(current.origins(current.subject(current.initializer(name)), context), [current.input("pair", index)], "closure captures are correlated");
  const nested = current.bindings("nested", context);
  sameSubjects(current.origins(current.subject(current.initializer("nestedRead")), nested), [current.input("pair", 1)], "lexical capture keeps parent symbol");
  sameSubjects(current.origins(current.subject(current.declaration("nested"), "return"), nested), [current.input("nested", 0)], "nested parameter owns its symbol");
});

test("symbolic callback results retain their exact invocation and activation without selecting concrete callers", () => {
  const current = fixture(`
    function invoke(callback: () => object) { return callback(); }
    function forward(callback: () => object) { return invoke(callback); }
    export function pair(left: () => object, right: () => object) {
      const first = forward(left); const second = forward(right); return second;
    }
    const leftValue = {}; const rightValue = {};
    const selected = pair(() => leftValue, () => rightValue);
  `);
  const { ast } = current.source;
  const invocation = current.nodes.find(node => ast.is.IsCallExpression(node) &&
    ast.text(ast.as.AsCallExpression(node).Expression) === "callback");
  assert.equal(invocation !== undefined, true, "original symbolic invocation exists");
  const contexts = [];
  for (const [index, name] of ["first", "second"].entries()) {
    const selected = current.storage.storageProducersFor(current.subject(current.declaration(name)), current.bindings("pair"));
    assert.equal(selected.kind !== "unresolved", true, selected.reason);
    assert.equal(selected.producers.length === 1 && selected.producers[0].subject.node === invocation, true,
      "result is the original operation, not an argument or another caller's value");
    const producer = selected.producers[0];
    sameSubjects(current.origins(current.input("invoke", 0), producer.bindings), [current.input("pair", index)],
      "transitive producer retains the exact caller input");
    contexts.push(producer.bindings);
    const values = current.storage.closedOriginsFor(current.subject(current.declaration(name)), current.bindings("pair"));
    assert.equal(values.kind === "open" && values.boundaries.some(boundary => boundary.kind === "external-input"), true,
      "an exact symbolic producer is not proof of a closed external value domain");
  }
  assert.equal(contexts[0] !== contexts[1], true, "equal invocation syntax has distinct activations");
  const concrete = current.storage.storageProducersFor(current.subject(current.declaration("selected")));
  assert.equal(concrete.kind !== "unresolved", true, concrete.reason);
  assert.equal(concrete.producers.length === 1 && concrete.producers[0].subject.node === current.initializer("rightValue"), true,
    "ordinary concrete invocation still follows its selected implementation");
  assert.equal(current.storage.failureReason(), undefined, "a valid symbolic application does not poison shared queries");
});

test("generic member and array projections preserve exact input-relative owner and selected type", () => {
  const current = fixture(`
    interface Callback<Value> { (value: Value): Value; }
    interface Holder<Value> { readonly callback: Callback<Value>; }
    function identity<Value>(value: Value): Value { return value; }
    function pair<Value>(left: Holder<Value>, right: Holder<Value>, many: Holder<Value>[], callbacks: Callback<Value>[]) {
      const leftRead = left.callback; const rightRead = identity(right).callback;
      const arrayRead = many[0].callback; const directRead = callbacks[0];
      const local = { callback: left.callback }; const fieldRead = local.callback;
      return rightRead;
    }
  `);
  const context = current.bindings("pair");
  const declaration = current.declaration("callback");
  const projection = { kind: "member", declaration };
  const left = current.input("pair", 0, [projection]);
  const right = current.input("pair", 1, [projection]);
  sameSubjects(current.origins(current.subject(current.initializer("leftRead")), context), [left], "left holder field");
  sameSubjects(current.origins(current.subject(current.initializer("rightRead")), context), [right], "right holder field");
  sameSubjects(current.origins(current.subject(current.initializer("fieldRead")), context), [left], "local physical field retains symbolic producer");
  sameSubjects(current.origins(current.subject(current.initializer("arrayRead")), context),
    [current.input("pair", 2, [{ kind: "array-element" }, projection])], "array of generic holders retains element and field path");
  sameSubjects(current.origins(current.subject(current.initializer("directRead")), context),
    [current.input("pair", 3, [{ kind: "array-element" }])], "callback array retains element path");
  const selected = current.exact(current.storage.typeFor(left));
  const type = current.source.semantics.forNode(current.initializer("leftRead")).types.expressionType(current.initializer("leftRead"));
  assert.equal(current.source.semantics.forFile(selected.sourceFile).types.isIdentical(selected.type, type), true, "generic selected member type remains exact");
  const standalone = current.exact(current.storage.memberSubjectFor(declaration)).subject;
  assert.equal(standalone.node === declaration && standalone.kind === "member" && standalone.projection.length === 0 && standalone !== left,
    true, "existing member identity is not repurposed");
});

test("input-relative member projections substitute onto each concrete caller through structural correspondence", () => {
  const current = fixture(`
    interface Holder<Value> { readonly callback: (value: Value) => Value; }
    function choose<Value>(left: Holder<Value>, right: Holder<Value>) { return left.callback; }
    const first = (value: number) => value + 1; const second = (value: number) => value + 2;
    const left = { callback: first }; const right = { callback: second };
    const selected = choose(left, right);
  `);
  const symbolic = current.bindings("choose");
  const returned = current.subject(current.declaration("choose"), "return");
  const original = current.origins(returned, symbolic);
  assert.equal(original.length === 1 && original[0].kind === "input" && original[0].projection[0]?.kind === "member", true,
    "declaration result has an exact input-relative field origin");
  const context = current.exact(current.storage.bindingsForInvocation(current.declaration("choose"), current.initializer("selected"))).bindings;
  sameSubjects(current.origins(original[0], context), [current.subject(current.initializer("first"))], "projected formal resolves actual structural field");
  sameSubjects(current.origins(returned, context), [current.subject(current.initializer("first"))], "ordinary return query remains exact");
});

test("declaration bindings retain entry input identity independently of parameter rebinding", () => {
  const current = fixture(`
    function choose(left: object, right: object) { left = right; return left; }
    const selected = choose({}, {});
  `);
  const context = current.bindings("choose");
  sameSubjects(current.origins(current.input("choose", 0), context), [current.input("choose", 0)], "entry snapshot remains symbolic");
  sameSubjects(current.origins(current.subject(current.declaration("choose"), "return"), context),
    [current.input("choose", 0), current.input("choose", 1)], "mutable value retains all producers rather than pretending to be its entry input");
});

test("declaration bindings reject forged and foreign tokens, owners and projected member declarations", () => {
  const text = `interface Holder { readonly value: object; } function read(owner: Holder) { return owner.value; }`;
  const current = fixture(text); const foreign = fixture(text);
  const context = current.bindings("read");
  for (const bindings of [{ kind: context.kind }, foreign.bindings("read"), Object.create(context)]) {
    assert.equal(current.storage.bindingsForDeclaration(current.declaration("read"), bindings).kind === "unresolved", true, "only this query can mint bindings");
    assert.equal(current.storage.boundOriginsFor(current.input("read", 0), bindings).kind === "unresolved", true, "foreign bindings cannot be consumed");
  }
  for (const node of [foreign.declaration("read"), current.file, {}, current.source.ast.parameters(current.declaration("read"))[0]])
    assert.equal(current.storage.bindingsForDeclaration(node).kind === "unresolved", true, "declaration must be an exact checked local owner");
  const parameter = current.source.ast.parameters(current.declaration("read"))[0];
  for (const declaration of [foreign.declaration("value"), current.declaration("read"), {}])
    assert.equal(current.storage.subject(parameter, "input", [{ kind: "member", declaration }]).kind === "unresolved", true,
      "member declaration must belong to this exact checked receiver type");
  assert.throws(() => { context.kind = "forged"; }, TypeError);
  const immutableInputs = current.origins(current.input("read", 0), context);
  assert.throws(() => { immutableInputs.push(current.input("read", 0)); }, TypeError);
  assert.equal("substitutions" in context, false, "the redundant public snapshot is absent");
  const path = [{ kind: "member", declaration: current.declaration("value") }];
  const input = current.input("read", 0, path);
  path[0].declaration = foreign.declaration("value"); path.push({ kind: "array-element" });
  assert.equal(input.projection.length === 1 && input.projection[0].declaration === current.declaration("value") &&
    Object.isFrozen(input.projection) && Object.isFrozen(input.projection[0]), true, "projection is an immutable snapshot");
});

test("generic class construction preserves the symbolic producer of its parameter property", () => {
  const current = fixture(`
    interface Callback<Value> { (value: Value): Value; }
    class Holder<Value> { constructor(readonly callback: Callback<Value>) {} }
    function keep<Value>(left: Callback<Value>, right: Callback<Value>) {
      const first = new Holder(left); const second = new Holder(right);
      const firstRead = first.callback; const secondRead = second.callback;
      return firstRead;
    }
  `);
  const context = current.bindings("keep");
  for (const [name, index] of [["firstRead", 0], ["secondRead", 1]])
    sameSubjects(current.origins(current.subject(current.initializer(name)), context), [current.input("keep", index)], "constructor field retains its own caller symbol");
});

test("declaration bindings and member projection boundaries reject custom getters without executing them", () => {
  const current = fixture("interface Holder { readonly value: object; } function read(owner: Holder) { return owner.value; }");
  const parameter = current.source.ast.parameters(current.declaration("read"))[0];
  let reads = 0;
  const getter = () => { reads += 1; throw new Error("untrusted selection getter executed"); };
  const fakeNode = Object.defineProperties({}, { Kind: { get: getter }, Parent: { get: getter } });
  const member = current.declaration("value");
  const paths = [
    [{ kind: "member", declaration: fakeNode }],
    [Object.defineProperty({ declaration: member }, "kind", { get: getter })],
    [Object.defineProperty({ kind: "member" }, "declaration", { get: getter })],
    Object.defineProperty([undefined], "0", { get: getter }),
  ];
  for (const path of paths) {
    const storage = createSourceStorageQuery(current.source, [current.file]);
    assert.equal(storage.subject(parameter, "input", path).kind === "unresolved", true, "projected member must be exact checked data");
  }
  assert.equal(current.storage.bindingsForDeclaration(fakeNode).kind === "unresolved", true, "owner cannot be fabricated with getters");
  assert.equal(current.storage.bindingsForDeclaration(current.declaration("read"),
    Object.defineProperty({}, "substitutions", { get: getter })).kind === "unresolved", true, "only owner-minted tokens are consumed");
  assert.equal(reads, 0, "untrusted getters remain unevaluated");
});

test("symbolic field reads do not erase writes through an aliased formal", () => {
  const current = fixture(`
    interface Holder { callback: () => object; }
    function replace(owner: Holder, replacement: () => object) {
      const alias = owner; alias.callback = replacement;
      return owner.callback;
    }
  `);
  const context = current.bindings("replace");
  const selected = current.origins(current.subject(current.declaration("replace"), "return"), context);
  sameSubjects(selected, [current.input("replace", 0, [{ kind: "member", declaration: current.declaration("callback") }]), current.input("replace", 1)],
    "a symbolic member retains both its entry storage and the aliased write's producer");
});

test("symbolic array elements do not erase writes through an aliased formal", () => {
  const current = fixture(`
    function replace(values: object[], replacement: object) {
      const alias = values; alias[0] = replacement;
      return values[0];
    }
  `);
  const context = current.bindings("replace");
  const selected = current.origins(current.subject(current.declaration("replace"), "return"), context);
  sameSubjects(selected, [current.input("replace", 0, [{ kind: "array-element" }]), current.input("replace", 1)],
    "a symbolic element retains both its entry storage and the aliased write's producer");
});

for (const [label, implementation, invoke] of [
  ["helper call", "function write(owner: Holder, replacement: () => object) { owner.callback = replacement; }", "write(owner, replacement);"],
  ["getter", "", "const action = { get apply() { owner.callback = replacement; return 0; } }; const applied = action.apply;"],
  ["constructor", "class Writer { constructor(owner: Holder, replacement: () => object) { owner.callback = replacement; } }", "new Writer(owner, replacement);"],
]) {
  test(`symbolic projections retain mutations reached through a ${label}`, () => {
    const current = fixture(`
      interface Holder { callback: () => object; }
      ${implementation}
      function replace(owner: Holder, replacement: () => object) { ${invoke} return owner.callback; }
    `);
    const selected = current.origins(current.subject(current.declaration("replace"), "return"), current.bindings("replace"));
    sameSubjects(selected, [current.input("replace", 0, [{ kind: "member", declaration: current.declaration("callback") }]), current.input("replace", 1)],
      `${label} preserves the entry and exact replacement input`);
  });
}

test("a local symbolic projection does not scan unrelated mutation regions", () => {
  const work = [];
  for (const count of [0, 256]) {
    const current = fixture(`
      interface Holder { callback: () => object; }
      function replace(owner: Holder, replacement: () => object) {
        const alias = owner; alias.callback = replacement; return owner.callback;
      }
      ${Array.from({ length: count }, (_, index) => `function unrelated${index}(owner: Holder, replacement: () => object) {
        owner.callback = replacement;
      }`).join("\n")}
    `);
    const base = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 1_000_000 });
    let localSteps;
    const budget = { ...base, step() {
      if (localSteps !== undefined && ++localSteps > 4096) base.reject("Local symbolic projection exceeded its fixed work allowance.");
      return base.step();
    } };
    const transport = createSourceStorageTransport(current.source, [current.file], budget);
    const owner = current.declaration("replace");
    const scope = transport.substitutions.forDeclaration(owner, transport.substitutions.empty);
    const parameters = current.source.ast.parameters(owner);
    const entry = transport.subject(parameters[0], "input", [{ kind: "member", declaration: current.declaration("callback") }]);
    const replacement = transport.subject(parameters[1], "input");
    const returned = transport.subject(owner, "return");
    assert.equal(scope !== undefined && entry !== undefined && replacement !== undefined && returned !== undefined, true, "exact owner evidence");
    localSteps = 0;
    const selected = transport.substitutions.origins(returned, scope);
    assert.equal(selected !== undefined && selected.size === 2 && selected.has(entry) && selected.has(replacement), true,
      `${count} unrelated writes cannot change local mutation alternatives: ${budget.failure() ?? "no budget failure"}`);
    assert.equal(budget.failure() === undefined, true, "local query fits an independent finite 4096-step allowance");
    work.push(localSteps);
  }
  assert.equal(work[1], work[0], "256 unrelated mutations add no work to the local projection query");
});

test("symbolic declaration inputs do not certify a closed external value domain", () => {
  const current = fixture("export function identity(value: object) { return value; }");
  const context = current.bindings("identity");
  const selected = current.storage.closedOriginsFor(current.subject(current.declaration("identity"), "return"), context);
  assert.equal(selected.kind === "open" && selected.boundaries.some(boundary => boundary.kind === "external-input"), true,
    "symbolic identity is not evidence that callers supply a closed set of values");
});

test("declaration-local scope creation preserves finite resource rejection", () => {
  const current = fixture("function identity(value: object) { return value; }", { maximumTransportRows: 1 });
  const selected = current.storage.bindingsForDeclaration(current.declaration("identity"));
  assert.equal(selected.kind === "unresolved", true, "finite scope accounting remains mandatory");
  assert.match(current.storage.failureReason(), /finite|rows/u);
});

for (const access of ["value.item", 'value["item"]']) for (const exported of [false, true]) {
  test(`checked generic predicate members retain symbolic declaration roles (${access})${exported ? " at an external entry" : ""}`, () => {
    const current = fixture(`
      interface Base { kind(): number; }
      interface Box<Value> extends Base { readonly item: Value; }
      interface Factory<Value> { accepts(value: Base | undefined): value is Box<Value>; }
      ${exported ? "export " : ""}function extract<Value>(factory: Factory<Value>, value: Base | undefined, otherwise: Value): Value {
        return factory.accepts(value) ? ${access} : otherwise;
      }
    `);
    const owner = current.declaration("extract");
    const bindings = current.bindings("extract");
    const result = current.subject(owner, "return");
    const origins = current.origins(result, bindings);
    assert.equal(current.storage.failureReason() === undefined, true, "a symbolic formal is not a physical receiver allocation");
    assert.equal(origins.some(subject => subject.node === current.input("extract", 1).node &&
      subject.kind === "input" && subject.projection.length === 1 && subject.projection[0].kind === "member" &&
      subject.projection[0].declaration === current.declaration("item")), true,
      "the selected checked field retains its exact declaration");
    assert.equal(origins.includes(current.input("extract", 2)), true, "the independent fallback input is preserved");
    const selected = current.storage.closedOriginsFor(result, bindings);
    const intent = "a narrowed symbolic member resolves to its exact symbolic inputs and does not manufacture physical caller storage or its projected type";
    assert.equal(selected.kind, exported ? "open" : "complete", intent);
    const projected = origins.find(subject => subject.node === current.input("extract", 1).node &&
      subject.kind === "input" && subject.projection.length === 1 && subject.projection[0].kind === "member" &&
      subject.projection[0].declaration === current.declaration("item"));
    const fallback = current.input("extract", 2);
    assert.equal(selected.origins.length === 2 && selected.origins.every(origin => origin.subject.kind === "input") &&
      selected.origins.some(origin => origin.subject === projected) && selected.origins.some(origin => origin.subject === fallback), true, intent);
    const checkedValue = current.exact(current.storage.typeFor(fallback));
    const component = selected.origins.find(origin => origin.subject === projected);
    assert.equal(current.source.semantics.forFile(checkedValue.sourceFile).types.isIdentical(component.type, checkedValue.type), true,
      "the projected component retains the original checked generic Value, not its receiver or a widened type");
    if (exported) {
      assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-input" &&
        boundary.subject === current.input("extract", 1)) && selected.boundaries.some(boundary =>
        boundary.kind === "external-input" && boundary.subject === fallback), true,
      "both original formals retain their actual outside input boundaries");
    }
  });
}
