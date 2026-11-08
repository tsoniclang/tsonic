import assert from "node:assert/strict";
import test from "node:test";
import { sourceTypeFlowFixture as fixture } from "./fixtures/source-type-flow-fixture.mjs";
import { sourceDescriptorInputFixture } from "../host/fixtures/source-descriptor-input.mjs";

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function definition(current, value) {
  return resolved(current.source.facts.descriptors.definition(value), "the original definition resolves");
}

test("C2446 narrowed callable reads retain their original authored branch without retargeting union storage", () => {
  const current = fixture(`function run(values: int32[]): void {
    const mapper: ((value: int32) => int32) | string = (value: int32): int32 => value;
    const alias = mapper; const second = alias; const mapped = values.map(alias);
    void mapper; void alias; void second; void mapped;
  }`);
  const { ast, facts } = current.source;
  const declaration = current.declaration("mapper");
  const stored = current.slot("mapper");
  assert.equal(stored.type.kind === "union" && stored.type.types.length === 2, true,
    "the original declaration keeps its complete authored storage union");
  const occurrences = facts.values.occurrences();
  const reads = occurrences.filter(node => ast.is.IsIdentifier(node) &&
    facts.navigation.sourceReferenceFor(node)?.declaration === declaration);
  assert.equal(reads.length, 2, "both actual mapper reads are retained");
  const alias = current.declaration("alias");
  const aliasReads = occurrences.filter(node => ast.is.IsIdentifier(node) &&
    facts.navigation.sourceReferenceFor(node)?.declaration === alias);
  assert.equal(aliasReads.length, 3, "each original alias read, including the actual map argument, is retained");
  const selected = [...reads, ...aliasReads].map(node => resolved(facts.values.type(node), "the enrolled callable read resolves"));
  selected.push(current.slot("alias"), current.slot("second"));
  for (const value of selected) {
    const callable = definition(current, value);
    const signature = callable.type.kind === "callable" ? callable.type.calls[0] : undefined;
    assert.equal(signature !== undefined && signature.parameters[0]?.type.kind === "primitive" &&
      signature.parameters[0].type.primitive === "int32" && signature.result.kind === "primitive" &&
      signature.result.primitive === "int32" && signature.identity.declaration !== undefined &&
      ast.is.IsFunctionTypeNode(signature.identity.declaration), true,
    "the selected original callable syntax, parameter width and result width survive each alias/read");
    const parameter = resolved(facts.descriptors.component(callable,
      { kind: "parameter", signature: signature.identity, index: 0 }), "the original parameter child resolves");
    const result = resolved(facts.descriptors.component(callable,
      { kind: "result", signature: signature.identity }), "the original result child resolves");
    assert.equal(parameter.type === signature.parameters[0].type && result.type === signature.result, true,
      "the published signature retains its actual registered child Evidence");
  }
  assert.equal(facts.refusals().length, 0);
});

test("direct callable values retain their instantiated owner bindings without a property receiver", () => {
  for (const primitive of ["float32", "int32"]) {
    const current = fixture(`interface Transform<Value> { (value: Value): Value; }
      function apply(callback: Transform<${primitive}>, value: ${primitive}): ${primitive} {
        const selected = callback(value); return selected;
      }`);
    const descriptor = current.slot("selected");
    assert.equal(descriptor.type.kind === "primitive" && descriptor.type.primitive === primitive, true,
      `${primitive}: the callable's authored argument owns its formal result`);
    const initializer = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
    assert.equal(initializer !== undefined, true, "the original checked call is required");
    const application = resolved(current.source.facts.applications.application(initializer), "the direct callable application resolves");
    assert.equal(application.receiver.kind === "none", true,
      "this is the direct callable binding path, not a property receiver");
    assert.equal(application.result.type === descriptor.type, true,
      "the selected application and declared inferred slot publish the same canonical geometry");
    assert.equal(current.source.facts.refusals().length, 0);
  }
});

test("literal defaults select checked member symbols only from their own retained element tuple", () => {
  const program = `function run() {
    const selected = { value: 1, "quoted-value": true, 7: { width: 2 } }; return selected;
  }`;
  const current = fixture(program);
  const descriptor = definition(current, current.slot("selected"));
  assert.equal(descriptor.type.kind === "shape" && descriptor.type.members.length === 3, true);
  const literal = current.source.ast.as.AsVariableDeclaration(current.declaration("selected"))?.Initializer;
  assert.equal(literal !== undefined, true, "the original object literal is required");
  const properties = current.source.ast.properties(literal);
  for (const [index, member] of descriptor.type.members.entries()) {
    const property = properties[index];
    assert.equal(property !== undefined && member.origin.kind === "declared" && member.origin.declaration === property, true,
      `member ${index}: the exact original declaration is retained`);
    const pair = resolved(current.source.facts.objects.correspondingMember(descriptor, descriptor, property, "read"),
      "the same canonical member correspondence resolves");
    assert.equal(pair.kind === "present" && pair.value.kind === "present" &&
      pair.value.source.name === member.name && pair.value.source.declarations.includes(property), true,
    "the registered shape and canonical read pair retain the same original member");
  }
  const [integer, boolean, nested] = descriptor.type.members;
  assert.equal(integer.type.kind === "primitive" && integer.type.primitive === "int64", true);
  assert.equal(boolean.type.kind === "primitive" && boolean.type.primitive === "bool", true);
  assert.equal(nested.type.kind === "shape" && nested.type.members[0]?.type.kind === "primitive" &&
    nested.type.members[0].type.primitive === "int64", true);

  const original = sourceDescriptorInputFixture({ "/src/index.ts": program });
  const file = original.checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the genuine private factual owner retains the original file");
  const pending = [file];
  let originalLiteral;
  while (pending.length !== 0) {
    const node = pending.pop();
    if (original.ast.is.IsVariableDeclaration(node) && original.ast.text(original.ast.name(node)) === "selected")
      originalLiteral = original.ast.as.AsVariableDeclaration(node)?.Initializer;
    original.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  assert.equal(originalLiteral !== undefined, true, "the original retained literal tuple is required");
  const component = original.input.syntax(originalLiteral);
  const inventory = original.input.members(component);
  assert.equal(inventory.kind, "available");
  const queries = original.checked.getSourceFileQueries(file);
  const propertiesBySymbol = queries.typeShape.getPropertyInfos(original.identities.checkedComponent(component));
  const originalProperties = original.ast.properties(originalLiteral);
  for (const [index, member] of inventory.members.entries()) {
    const property = originalProperties[index];
    const selected = propertiesBySymbol.find(candidate => queries.checker.getSymbolDeclarations(candidate.symbol).includes(property));
    assert.equal(selected !== undefined && selected.name === member.name && member.declarations.includes(property), true,
      `member ${index}: factual publication keeps the symbol from its own original checked tuple`);
    assert.equal(member.read !== undefined, true, "the original factual member has an authenticated read component");
    original.input.assertComponent(member.read);
    assert.equal(member.read.root === originalLiteral && member.read.path.some(part =>
      part.kind === "member" && part.declaration === property), true,
    "no member component is borrowed from another literal or declaration");
  }
});
