import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";
import { decideSourcePrimitiveBinaryOperator } from "../../packages/target-api/dist/source-semantics/local-type-flow/operator-decisions.js";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", label);
  return result.value;
}

function definition(current, value) {
  return resolved(current.source.facts.descriptors.definition(value), "the original evidence has its canonical definition");
}

function component(current, value, selector) {
  return resolved(current.source.facts.descriptors.component(value, selector), "the original child is registered in this view");
}

function callable(current, occurrence) {
  const value = definition(current, resolved(current.source.facts.values.type(occurrence), "the original callable value is enrolled"));
  assert.equal((value.type.kind === "callable" || value.type.kind === "shape") && value.type.calls.length === 1, true);
  return { value, signature: value.type.calls[0] };
}

test("C2404 generic array binders project the same solved aggregate used by every argument", () => {
  const current = fixture(`function accept<T>(value: T[]): T[] { return value; }
    function pair<T>(first: T[], second: T[]): T[] { void second; return first; }
    function callbacks<T>(first: () => T[], second: () => T[]): T[] { void second; return first(); }
    function plain(): void { const plainValue = ["text", 9007199254740993]; void accept(plainValue); }
    function aliased(): void { const original = ["text", 9007199254740993]; const alias = original; void pair(original, alias); }
    function captured(): void { const shared = ["text", 9007199254740993]; void callbacks(() => shared, () => shared); }`);
  const { ast, facts } = current.source;
  const arrays = current.nodes.filter(node => ast.is.IsArrayLiteralExpression(node));
  assert.equal(arrays.length, 3);
  for (const literal of arrays) {
    const value = resolved(facts.values.type(literal), "the original array allocation has its solved element");
    assert.equal(value.type.kind, "array");
    const element = component(current, value, { kind: "array-element" });
    let owner = ast.parent(literal);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    const call = current.nodes.find(node => {
      if (!ast.is.IsCallExpression(node)) return false;
      let parent = ast.parent(node);
      while (parent !== undefined && !ast.is.IsFunctionDeclaration(parent)) parent = ast.parent(parent);
      return parent === owner;
    });
    assert.equal(call !== undefined, true);
    const application = resolved(facts.applications.application(call), "the actual aggregate's generic application is published");
    assert.equal(application.identity.signatureBindings.length === 1 &&
      application.identity.signatureBindings[0].value.type === element.type && application.result.type.kind === "array" &&
      application.result.type.element === element.type, true,
    "allocation, selected binder and result share the same canonical element geometry");
    const resultElement = component(current, application.result, { kind: "array-element" });
    assert.equal(resultElement.type === element.type, true);
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2417 broad contextual callback returns do not replace their body's own result", () => {
  const current = fixture(`class Datum { value: int32 = 1; }
    declare function opaque(callback: (value: int32, index: int32) => unknown): void;
    declare function dynamic(callback: (value: int32, index: int32) => any): void;
    declare function reference(callback: () => object): void;
    declare function concrete(callback: () => float32): void;
    declare function union(callback: () => string | float32): void;
    function run(): void {
      opaque((value, index) => value > index);
      dynamic((value, index) => value > index);
      reference(() => new Datum());
      concrete(() => 7);
      union(() => 7);
    }`);
  const { ast, facts } = current.source;
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 5);
  for (const [index, arrow] of arrows.entries()) {
    const body = ast.body(arrow);
    assert.equal(body !== undefined, true);
    const head = callable(current, arrow);
    const returned = resolved(facts.values.callableReturn(head.signature.identity), "the original callback owns its completion");
    assert.equal(head.signature.result === returned.type, true,
      `callback ${index}: the callable and original completion have the same solved result`);
    const child = component(current, head.value, { kind: "result", signature: head.signature.identity });
    assert.equal(child.type === returned.type, true);
    const selected = resolved(facts.values.type(body), "the original callback body remains an independent value");
    if (index < 3) {
      const destination = resolved(facts.values.destination(body), "the body has a genuine creation-destination answer");
      assert.equal(destination.kind, "none", "a broad callback result checks rather than retargets its body");
      assert.equal(index < 2 ? returned.type.kind === "primitive" && returned.type.primitive === "bool"
        : returned.type.kind === "declared", true);
    } else {
      assert.equal(selected.type.kind === "primitive" && selected.type.primitive === "float32", true,
        `callback ${index}: the exact concrete Source creation width survives its enclosing result contract`);
      const destination = resolved(facts.values.destination(body), "the concrete result destination is retained");
      assert.equal(destination.kind, "present", "a concrete or union callback result supplies its actual creation destination");
    }
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2425 generator return slots project their authored completion component, not the whole iterator", () => {
  const current = fixture(`type Completed = Generator<int32, string, unknown>;
    type Numeric<Result> = Generator<int32, Result, unknown>;
    interface Inherited extends Generator<int32, float32, unknown> {}
    function* words(): Generator<int32, string, unknown> { yield 1; return "done"; }
    function* alias(): Completed { yield 1; return "alias"; }
    function* numeric(): Generator<int32, float32, unknown> { yield 1; return 700123; }
    function* numericAlias(): Numeric<float32> { yield 1; return 700123; }
    function* inherited(): Inherited { yield 1; return 700123; }
    async function* asyncNumeric(): AsyncGenerator<int32, float32, unknown> { yield 1; return 700123; }
    function ordinary(): int32 { return 700123; }
    void words; void alias; void numeric; void numericAlias; void inherited; void asyncNumeric; void ordinary;`);
  const { ast, facts } = current.source;
  const returns = current.nodes.filter(node => ast.is.IsReturnStatement(node));
  assert.equal(returns.length, 7);
  for (const statement of returns) {
    const expression = ast.as.AsReturnStatement(statement)?.Expression;
    assert.equal(expression !== undefined, true);
    const value = resolved(facts.values.type(expression), "the original return value is published");
    let owner = ast.parent(statement);
    while (owner !== undefined && !ast.is.IsFunctionDeclaration(owner)) owner = ast.parent(owner);
    assert.equal(owner !== undefined, true);
    const name = ast.text(ast.name(owner));
    assert.equal(name === "words" || name === "alias" ? value.type.kind === "string"
      : value.type.kind === "primitive" && value.type.primitive === (name === "ordinary" ? "int32" : "float32"), true,
    name + ": the original authored completion, not yielded or wrapper storage, owns its literal");
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2425 scalar rest arguments use the same declared element slot while spreads retain their sequence", () => {
  const current = fixture(`type Words = int32[];
    declare function direct(...values: int32[]): void;
    declare function alias(...values: Words): void;
    declare function narrow(...values: float32[]): void;
    declare function tuple(...values: [int32, float32]): void;
    function run(): void {
      direct(700123); alias(700124); narrow(700125); tuple(700126, 700127);
      const retained = 700128; direct(retained);
      const spread: int32[] = [1, 2]; direct(...spread);
    }`);
  const { ast, facts } = current.source;
  const expected = new Map([["700123", "int32"], ["700124", "int32"], ["700125", "float32"],
    ["700126", "int32"], ["700127", "float32"], ["700128", "int32"]]);
  const values = current.nodes.filter(node => ast.is.IsNumericLiteral(node) && expected.has(ast.text(node)));
  assert.equal(values.length, expected.size);
  for (const node of values) {
    const value = resolved(facts.values.type(node), "each original scalar rest argument has its own value evidence");
    assert.equal(value.type.kind === "primitive" && value.type.primitive === expected.get(ast.text(node)), true, ast.text(node));
  }
  const spread = current.slot("spread");
  assert.equal(spread.type.kind === "array" && spread.type.element.kind === "primitive" &&
    spread.type.element.primitive === "int32", true, "the original spread remains a whole sequence");
  assert.equal(facts.refusals().length, 0);
});

test("C2417 inactive concrete callbacks publish every original parameter through the selected invocation", () => {
  const current = fixture(`interface Request { readonly value: int32; }
    interface Response { send(value: int32): void; }
    declare function connect(callback: (request: Request, response: Response) => void): void;
    function run(): void { connect((request, response) => {}); }`);
  const { ast, facts } = current.source;
  const arrow = current.nodes.find(node => ast.is.IsArrowFunction(node));
  assert.equal(arrow !== undefined, true);
  const head = callable(current, arrow);
  const parameters = ast.parameters(arrow);
  assert.equal(parameters.length, 2);
  const occurrences = new Set(facts.values.occurrences());
  for (const [index, parameter] of parameters.entries()) {
    assert.equal(parameter !== undefined, true);
    const slot = resolved(facts.values.declaredSlot(parameter), "the actual callback formal owns its declaration slot");
    const child = component(current, head.value, { kind: "parameter", signature: head.signature.identity, index });
    assert.equal(slot.origin.kind === "declaration" && slot.origin.declaration === parameter && slot.type.type.kind === "declared" &&
      child.type === slot.type.type && head.signature.parameters[index]?.type === slot.type.type, true,
    `parameter ${index}: the original declaration and exact callable child retain the same contract`);
    const name = ast.name(parameter);
    assert.equal(name !== undefined && !occurrences.has(name), true, "a binding name is not a fabricated value read");
    assert.throws(() => facts.values.type(name), /original occurrence from this view/u,
      "the retired name-as-value question is rejected, not given a compatibility answer");
  }
  assert.equal(head.signature.result.kind === "intrinsic" && head.signature.result.intrinsic === "void", true);
  assert.equal(facts.refusals().length, 0);
});

test("C2417 callback parameter enrollment retains concrete authored binders without retargeting fixed annotations", () => {
  const current = fixture(`declare function receive<Value>(callback: (value: Value) => void): void;
    function run(): void {
      receive<string>(value => {});
      receive<int32>((value: float32) => {});
    }`);
  const { ast, facts } = current.source;
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const [index, arrow] of arrows.entries()) {
    const parameter = ast.parameters(arrow)[0];
    assert.equal(parameter !== undefined, true);
    const slot = resolved(facts.values.declaredSlot(parameter), "the original callback formal is published");
    const application = resolved(facts.applications.application(ast.parent(arrow)), "the actual receiving application retains its original binder");
    assert.equal(index === 0 ? slot.type.type.kind === "string"
      : slot.type.type.kind === "primitive" && slot.type.type.primitive === "float32", true,
    `callback ${index}: an authored parameter is never retargeted`);
    const binding = application.identity.signatureBindings[0];
    assert.equal(binding !== undefined && (index === 0 ? binding.value.type.kind === "string"
      : binding.value.type.kind === "primitive" && binding.value.type.primitive === "int32"), true,
    `callback ${index}: original method inference stays independent of its actual annotated callback head`);
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2418 inherited authored callback heads do not borrow a self-inferred result default", () => {
  const current = fixture(`declare class Base<Element> {
      order<Result extends number | bigint = number>(compare?: (left: Element, right: Element) => Result): this;
    }
    declare class Middle<Element> extends Base<Element> {}
    declare class Single extends Middle<float32> {}
    interface Unsigned extends Base<uint32> {}
    declare class Signed extends Base<int32> {}
    type SignedAlias = Signed;
    function single(values: Single): void { values.order((left, right) => left - right); }
    function unsigned(values: Unsigned): void { values.order((left, right) => left - right); }
    function signed(values: SignedAlias): void { values.order((left, right) => left - right); }
    function generic(values: Middle<float32>): void { values.order((left, right) => left - right); }`);
  const { ast, facts } = current.source;
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 4);
  for (const [index, arrow] of arrows.entries()) {
    const primitive = ["float32", "uint32", "int32", "float32"][index];
    const head = callable(current, arrow);
    for (const [position, parameter] of ast.parameters(arrow).entries()) {
      assert.equal(parameter !== undefined, true);
      const slot = resolved(facts.values.declaredSlot(parameter), "the original inherited callable formal has its own slot");
      const child = component(current, head.value, { kind: "parameter", signature: head.signature.identity, index: position });
      assert.equal(slot.type.type.kind === "primitive" && slot.type.type.primitive === primitive &&
        child.type === slot.type.type, true, `callback ${index}: the actual original head is ${primitive}`);
    }
    const body = ast.body(arrow);
    assert.equal(body !== undefined, true);
    const value = resolved(facts.values.type(body), "the actual callback arithmetic has its solved result");
    const operation = resolved(facts.values.operation(body), "the same Source arithmetic owner publishes its result");
    const decision = decideSourcePrimitiveBinaryOperator("subtract", { kind: "fixed", primitive }, { kind: "fixed", primitive });
    const application = resolved(facts.applications.application(ast.parent(arrow)), "the inherited selected application retains its binder");
    assert.equal(application.arguments.length, 1);
    let required = definition(current, application.arguments[0].destination.applied);
    if (required.type.kind === "optional") required = definition(current, component(current, required, { kind: "optional-value" }));
    assert.equal((required.type.kind === "callable" || required.type.kind === "shape") && required.type.calls.length === 1 &&
      required.type.calls[0].parameters.length === 2 && required.type.calls[0].parameters.every(parameter =>
        parameter.type.kind === "primitive" && parameter.type.primitive === primitive), true,
    "the same selected formal agrees with every genuine inherited callback parameter");
    assert.equal(decision.kind === "resolved" && value.type.kind === "primitive" && value.type.primitive === decision.result &&
      operation.result.type === value.type && application.identity.signatureBindings[0]?.value.type === value.type, true,
    "the canonical arithmetic table, body and original inferred method binder agree");
    const destination = resolved(facts.values.destination(body), "the result has a genuine destination discovery answer");
    assert.equal(destination.kind, "none", "a self-inferred Result default is never an authored creation destination");
  }
  assert.equal(facts.refusals().length, 0);
});

test("C2418 checked inherited arguments and defaults never authorize a callback head or retarget an annotation", () => {
  const current = fixture(`declare class Base<Element> {
      order<Result extends number | bigint = number>(compare?: (left: Element, right: Element) => Result): this;
    }
    declare class Open<Element> extends Base<Element> { constructor(value: Element); }
    function inferred(): void { const values = new Open(0.5); values.order((left, right) => 1); }
    function fixed(values: Open<int32>): void { values.order((left: float32, right: float32) => left - right); }`);
  const { ast, facts } = current.source;
  const arrows = current.nodes.filter(node => ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const [index, arrow] of arrows.entries()) {
    const head = callable(current, arrow);
    for (const [position, parameter] of ast.parameters(arrow).entries()) {
      assert.equal(parameter !== undefined, true);
      const slot = resolved(facts.values.declaredSlot(parameter), "an original callback formal remains independent of checker-inferred receiver arguments");
      const child = component(current, head.value, { kind: "parameter", signature: head.signature.identity, index: position });
      assert.equal(child.type === slot.type.type, true);
      if (index === 1) assert.equal(slot.type.type.kind === "primitive" && slot.type.type.primitive === "float32", true,
        "the original authored float32 is not retargeted to the receiver's int32");
    }
    const body = ast.body(arrow);
    assert.equal(body !== undefined, true);
    const destination = resolved(facts.values.destination(body), "the original body has a genuine destination answer");
    const value = resolved(facts.values.type(body), "the original body retains its own result");
    assert.equal(destination.kind === "none" && value.type.kind === "primitive" &&
      value.type.primitive === (index === 0 ? "int64" : "float32"), true,
    `callback ${index}: inferred receiver/default evidence cannot become an authored return destination`);
  }
  assert.equal(facts.refusals().length, 0);
});
