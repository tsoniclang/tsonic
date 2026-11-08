import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", label);
  return result.value;
}

function primitive(current, name, expected) {
  const value = current.slot(name);
  assert.equal(value.type.kind === "primitive" && value.type.primitive === expected, true, name);
  return value;
}

function assignment(current, predicate = () => true) {
  const { ast } = current.source;
  const node = current.nodes.find(node => ast.is.IsBinaryExpression(node) &&
    ast.operatorKindName(node) === "KindEqualsToken" && predicate(node));
  assert.equal(node !== undefined, true, "the original assignment is required");
  const result = resolved(current.source.facts.values.operation(node), "the canonical assignment owns its operands and destination");
  assert.equal(result.kind, "assignment");
  return result;
}

test("one eager publication fills numeric locals from the first exact demand", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const value = 1; take(value); }");
  const value = primitive(current, "value", "float64");
  assert.equal(current.source.facts.refusals().length, 0);
  assert.equal(Object.isFrozen(current.source.facts.values) && Object.isFrozen(value) && Object.isFrozen(value.type), true);
});

test("a later conflicting exact demand retains its original checked site", () => {
  const current = fixture("declare function narrow(value: int32): void; declare function broad(value: number): void; function run(): void { const value = 1; narrow(value); broad(value); }");
  const { ast, facts } = current.source;
  const failure = facts.refusals().find(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT");
  const later = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "broad");
  const earlier = current.nodes.find(node => ast.is.IsCallExpression(node) && ast.text(ast.as.AsCallExpression(node)?.Expression) === "narrow");
  assert.equal(failure !== undefined && later !== undefined && earlier !== undefined, true);
  assert.equal(failure.site === ast.arguments(later)[0] && failure.related === ast.arguments(earlier)[0], true,
    "the later and original exact demands retain their original argument occurrences");
});

test("signature closure defaults leaves before exact use demands", () => {
  const current = fixture("declare function broad(value: number): void; function run() { const value = 1; broad(value); return value + 1; }");
  assert.equal(current.source.facts.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_SIGNATURE"), true);
});

test("declared returns are ordinary exact demands rather than signature defaults", () => {
  const current = fixture("function run(): number { const value = 1; return value; }");
  primitive(current, "value", "float64");
});

test("array and nested data-member fills decompose before defaults", () => {
  const current = fixture("declare function arrays(value: number[]): void; declare function fields(value: { n: number }): void; function run(): void { const values = [1, 2]; const data = { n: 1 }; arrays(values); fields(data); }");
  const values = current.slot("values");
  assert.equal(values.type.kind === "array" && !values.type.readonly && values.type.element.kind === "primitive" &&
    values.type.element.primitive === "float64", true);
  const data = current.slot("data");
  assert.equal(data.type.kind === "shape" && data.type.members[0]?.name === "n" && data.type.members[0].type.kind === "primitive" &&
    data.type.members[0].type.primitive === "float64", true);
  const member = resolved(current.source.facts.descriptors.component(data, { kind: "member", origin: data.type.members[0].origin }),
    "the solved member has its registered original child");
  assert.equal(member.type === data.type.members[0].type, true);
});

test("an alias and its projected read retain the same solved array element", () => {
  const current = fixture("declare function take(value: number): void; function run(): void { const values = [1]; const alias = values; take(alias[0]!); }");
  const values = current.slot("values");
  const alias = current.slot("alias");
  assert.equal(values.type === alias.type && values.type.kind === "array" && values.type.element.kind === "primitive" &&
    values.type.element.primitive === "float64", true);
  const original = resolved(current.source.facts.descriptors.component(values, { kind: "array-element" }), "the allocation retains its element");
  const copied = resolved(current.source.facts.descriptors.component(alias, { kind: "array-element" }), "the alias retains its element");
  assert.equal(original.type === copied.type, true, "aliasing never creates another element answer");
});

test("writes and literal compound assignments leave the default unchanged", () => {
  const current = fixture("function run(): void { let value = 1; value += 0.5; const values = [1]; values[0] = 0.5; }");
  primitive(current, "value", "int64");
  const operations = current.nodes.filter(node => current.source.ast.is.IsBinaryExpression(node) &&
    ["KindPlusEqualsToken", "KindEqualsToken"].includes(current.source.ast.operatorKindName(node)))
    .map(node => resolved(current.source.facts.values.operation(node), "each original write retains its canonical storage operation"));
  assert.equal(operations.length >= 2 && operations.every(operation => operation.kind === "compound" || operation.kind === "assignment"), true);
  assert.equal(operations.every(operation => operation.destination.applied.type.kind === "primitive" &&
    operation.destination.applied.type.primitive === "int64"), true, "write fit never changes the solved destination");
});

test("a declared compound-assignment right side fills the local", () => {
  const current = fixture("function run(input: number): void { let value = 1; value += input; }");
  primitive(current, "value", "float64");
});

for (const statement of ["values[0] = value;", "target = value;"]) {
  test(`write-fit retains the already-solved right side of ${statement}`, () => {
    const current = fixture(`declare function broad(value: number): void; function run(): void { const values = [1]; let target = 1; let value = 1; broad(value); ${statement} }`);
    primitive(current, "value", "float64");
    const { ast } = current.source;
    const write = assignment(current, node => ast.text(ast.as.AsBinaryExpression(node)?.Right) === "value");
    assert.equal(write.destination.applied.type.kind === "primitive" && write.destination.applied.type.primitive === "int64", true);
    assert.equal(write.source.value.type.kind === "primitive" && write.source.value.type.primitive === "float64", true);
    const syntax = ast.as.AsBinaryExpression(write.occurrence);
    assert.equal(write.source.occurrence === syntax.Right && write.target === syntax.Left, true,
      "the original source operand and exact storage target replace the retired obligation's variable association");
  });
}

test("ordinary fixed API write values publish their declared read type and a write-fit obligation", () => {
  const current = fixture("function run(input: number[]): void { const values = [1]; values[0] = input.length; }");
  const { ast, facts } = current.source;
  const access = current.nodes.find(node => ast.is.IsPropertyAccessExpression(node));
  assert.equal(access !== undefined, true);
  const use = resolved(facts.objects.use(access), "the fixed API read has its canonical original member use");
  assert.equal(use.readDeclarations.length === 1, true, "the read retains one actual selected declaration");
  const declared = resolved(facts.values.declaredSlot(use.readDeclarations[0]), "the exact API declaration keeps its own read contract");
  const read = resolved(facts.values.type(access), "the original read is a published value question");
  const write = assignment(current);
  assert.equal(read.type === declared.type.type && write.source.value.type === read.type &&
    write.source.occurrence === access && use.readType?.type === read.type, true,
  "the unchanged fixed read is the exact write source, never another inference variable");
  const values = current.slot("values");
  assert.equal(values.type.kind === "array" && values.type.element.kind === "primitive" &&
    values.type.element.primitive === "int64", true);
});

test("derived-local demands never flow back into arithmetic operands", () => {
  const current = fixture("declare function broad(value: number): void; function run(): void { const value = 1; const derived = value * 2; broad(derived); }");
  primitive(current, "value", "int64");
  assert.equal(current.source.facts.refusals().some(issue => issue.code === "TSONIC_LOCAL_TYPE_CONFLICT"), true);
});

test("derived arithmetic is typed once in dependency order", () => {
  const current = fixture("function run(): void { const first = 1; const second = first * 2; const third = second + 0.5; }");
  primitive(current, "second", "int64");
  primitive(current, "third", "float64");
});

test("declared numeric widths cross a generic call without checker erasure", () => {
  const current = fixture("function first<T>(values: T[]): T { return values[0]!; } function run(values: int32[]): void { const value = first(values); }");
  const value = primitive(current, "value", "int32");
  const call = current.nodes.find(node => current.source.ast.is.IsCallExpression(node));
  assert.equal(call !== undefined, true);
  const application = resolved(current.source.facts.applications.application(call), "the original generic application is published");
  assert.equal(application.identity.signatureBindings.length === 1 &&
    application.identity.signatureBindings[0].value.type === value.type && application.result.type === value.type, true,
  "the actual method binder and result retain the exact authored native width");
});

test("an empty array gets no type from a receiver-binder insertion", () => {
  const current = fixture("function run(): void { const values = []; values.push(1); }");
  assert.equal(current.source.facts.refusals().some(issue => issue.code === "TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("uncontextualized empty object and array declarations are Host refusals", () => {
  const current = fixture("function run(): void { const data = {}; const values = []; }");
  const codes = current.source.facts.refusals().map(issue => issue.code);
  assert.equal(codes.includes("TSONIC_UNTYPED_OBJECT_LITERAL") && codes.includes("TSONIC_UNTYPED_ARRAY_LITERAL"), true);
});

test("C2445 later broad slots check the original aggregate without supplying its creation type", () => {
  for (const broad of ["unknown", "object", "any"]) {
    for (const use of ["const selected: Broad = value; return selected;", "receive(value); return value;", "return value;"]) {
      const current = fixture(`type Broad = ${broad}; declare function receive(value: Broad): void;
        function run(): Broad { const value = {}; ${use} }`);
      const literal = current.nodes.find(node => current.source.ast.is.IsObjectLiteralExpression(node));
      assert.equal(literal !== undefined, true);
      const outcome = current.source.facts.values.type(literal);
      assert.equal(outcome.kind === "refused" && outcome.code === "TSONIC_UNTYPED_OBJECT_LITERAL" && outcome.site === literal, true,
        `${broad}: the later slot cannot replace the original untyped object`);
      assert.equal(current.source.facts.refusals().length === 1 && current.source.facts.refusals()[0] === outcome, true,
        `${broad}: one original construction owns the identical refusal`);
    }
    const array = fixture(`function make() { return []; }
      function run(): ${broad} { const selected: ${broad} = make(); return selected; }`);
    const literal = array.nodes.find(node => array.source.ast.is.IsArrayLiteralExpression(node));
    assert.equal(literal !== undefined, true);
    const outcome = array.source.facts.values.type(literal);
    assert.equal(outcome.kind === "refused" && outcome.code === "TSONIC_UNTYPED_ARRAY_LITERAL" && outcome.site === literal, true,
      `${broad}: a later call-result slot cannot type the original empty array`);
    assert.equal(array.source.facts.refusals().length === 1 && array.source.facts.refusals()[0] === outcome, true);
  }
  const positive = fixture(`function run(): void {
    const annotated: object = {};
    const value = { count: 1 }; const alias: object = value;
    const values = [1]; const valuesAlias: object = values;
    void annotated; void alias; void valuesAlias;
  }`);
  const value = positive.slot("value");
  assert.equal(value.type.kind === "shape" && value.type.members.length === 1 && value.type.members[0]?.type.kind === "primitive" &&
    value.type.members[0].type.primitive === "int64", true);
  const values = positive.slot("values");
  assert.equal(values.type.kind === "array" && values.type.element.kind === "primitive" && values.type.element.primitive === "int64", true);
  const annotated = positive.slot("annotated");
  assert.equal(annotated.type.kind === "intrinsic" && annotated.type.intrinsic === "object", true,
    "an original authored creation retains its existing contract");
  assert.equal(positive.source.facts.refusals().length, 0);
});
