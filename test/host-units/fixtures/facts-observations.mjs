import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { parseObservations, printObservations, verifyObservations } from "../../../packages/host/dist/ir-facts/index.js";
import { encodeDefId } from "../../../packages/host/dist/ids/index.js";
import { bindingVectorKey, seedTypeInterner } from "../../../packages/host/dist/ir-types/index.js";
import { encodeContextKey, moduleFixture } from "../ir-program-fixtures.mjs";

const available = value => ({ kind: "available", value });
const empty = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const expansion = () => ({ maximumDepth: 64, maximumVisits: 256, maximumUnionMembers: 64, maximumIntersectionMembers: 64 });

function observationFixture(selected = null) {
  const fixture = moduleFixture();
  const parameter = { owner: fixture.definition, index: 0 };
  fixture.index.types.terms.push({ kind: "primitive", primitive: "int64" }, { kind: "primitive", primitive: "uint64" }, { kind: "param", parameter });
  const generic = selected !== null;
  const scope = generic ? { ...fixture.scope, classParameters: [parameter] } : fixture.scope;
  const original = generic ? { ...empty(), classBindings: [{ kind: "rigid", parameter }] } : empty();
  const bindings = generic ? { ...empty(), classBindings: [{ kind: "bound", parameter, type: selected }] } : empty();
  const instance = { body: fixture.bodyId, bindings: generic ? { kind: "instantiated", bindings } : { kind: "parametric" } };
  const descriptor = { kind: "item", value: { owner: fixture.definition, node: 3 } };
  const at = { kind: "body", value: { body: fixture.bodyId, node: 2 } };
  const capture = { occurrence: at.value, operation: "size", bindings: available(original), operand: at.value,
    layout: available(descriptor), selector: null, field: available(null), result: available(generic ? 3 : 1), value: available(100n) };
  const core = fixture.tirInput.source.tree.tsonic.core;
  const checkedValue = { views: { read: available(generic ? 3 : 1), declared: available(null), contextual: available(null) },
    place: available(null), memory: available(null), observation: available(capture) };
  const node = { id: 2, parent: null, origin: fixture.module.tree.origin, flags: [], loc: { pos: 0, end: 1 },
    kind: "NumericLiteral", text: "8", tokenFlags: [], tsonic: { core, role: "value", value: checkedValue,
      literal: { kind: "number", value: { numerator: 8n, denominator: 1n, negativeZero: false } } } };
  const geometry = { source: available(generic ? 3 : 1), dataLayoutExpression: null, dataLayout: available(fixture.definition),
    byteSizeExpression: null, byteSize: available(8n), byteAlignmentExpression: null, byteAlignment: available(8n), strideExpression: null, stride: available(8n) };
  const descriptorNode = { ...node, id: 3, tsonic: { core, role: "value", value: { ...checkedValue, observation: available(null),
    memory: available({ kind: "value", occurrence: descriptor, bindings: available(original), geometry, fieldsExpression: null, fields: available([]) }) }, literal: node.tsonic.literal } };
  const metadata = { kind: "memory-layout", key: { definition: fixture.definition, bindings: instance.bindings }, root: 0,
    layouts: [{ id: 0, occurrence: descriptor, source: selected ?? 1, dataLayout: fixture.definition,
      byteSize: 8n, byteAlignment: 8n, stride: 8n, kind: "value", fields: [] }], fields: [] };
  const source = { ...fixture.tirInput.source.bodies[0], root: node };
  const observations = { instance, rows: [{ node: 2, operation: "size", operand: at.value, layout: { metadata: metadata.key, layout: 0 },
    field: null, result: selected ?? 1, value: 8n, bindings }] };
  const same = (left, right) => isDeepStrictEqual(left, right);
  const facts = { types: fixture.index.types, nominalOf: fixture.context.facts.nominalOf, localExists: fixture.context.facts.localExists,
    bodyOwner: body => body === fixture.bodyId ? fixture.definition : null,
    bindingScopeOf: definition => definition === fixture.definition ? scope : null,
    bindingScopesOf: target => target.kind === "observations" && same(target.instance, instance) ? (generic ? [scope, scope, scope] : [scope]) : null,
    nodeExists: ref => same(ref, at) || same(ref, descriptor),
    metadataOf: key => same(key, metadata.key) ? metadata : null,
  };
  const nodes = ref => same(ref, at) ? node : same(ref, descriptor) ? descriptorNode : null;
  return { fixture, source, node, descriptorNode, descriptor, capture, metadata, observations, bindings, parameter,
    input: { source, bodyOf: () => null, nodeOf: nodes, facts, types: seedTypeInterner(fixture.index.types), typeExpansion: expansion() } };
}

function rules(value) {
  const result = verifyObservations(value.observations, value.input);
  assert.equal(result.kind, "complete", "constructed static observation verification completed");
  return result.violations.map(row => row.rule);
}

function fieldObservationFixture(selected = null) {
  const value = observationFixture(selected);
  const fieldDefinition = encodeDefId({ module: value.fixture.module.module, segments: [{ name: "field", ordinal: 0 }] });
  const field = { kind: "item", value: { owner: fieldDefinition, node: 0 } };
  const bindings = value.capture.bindings.value;
  const owner = value.fixture.index.types.terms.length;
  value.fixture.index.types.terms.push({ kind: "declared", definition: value.fixture.definition,
    arguments: selected === null ? [] : [selected], facet: "instance", extent: null });
  const member = { decision: { key: { kind: "text", value: "field" }, origins: [{ kind: "declared", declaration: fieldDefinition }],
    selectedDeclarations: [fieldDefinition], primary: fieldDefinition, read: 1, write: 1, getter: null, setter: null,
    bindings: empty(), location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
  value.metadata.layouts[0].occurrence = { kind: "item", value: { owner: fieldDefinition, node: 1 } };
  value.metadata.layouts[0].source = 1;
  value.metadata.layouts.push({ id: 1, occurrence: value.descriptor, source: owner, dataLayout: value.fixture.definition,
    byteSize: 16n, byteAlignment: 8n, stride: 16n, kind: "value", fields: [0] });
  value.metadata.root = 1;
  value.metadata.fields = [{ id: 0, occurrence: field, owner, selector: field, selection: field, member: { key: member.decision.key, origins: member.decision.origins,
    selectedDeclarations: member.decision.selectedDeclarations, primary: member.decision.primary, bindings: member.decision.bindings }, value: 1, layout: 0, byteOffset: 8n, byteAlignment: 8n }];
  value.descriptorNode.tsonic.value.memory.value.geometry.source = available(owner);
  value.descriptorNode.tsonic.value.memory.value.fields = available([field]);
  const fieldNode = { ...value.descriptorNode, id: 0, tsonic: { ...value.descriptorNode.tsonic, value: {
    ...value.descriptorNode.tsonic.value, memory: available({ kind: "field", occurrence: field, bindings: available(bindings), source: available(1),
      selector: field, selection: available(field), key: available(member.decision.key), origins: available(member.decision.origins),
      selectedDeclarations: available([fieldDefinition]), primary: available(fieldDefinition), value: available(1),
      fieldLayoutExpression: null, fieldLayout: available(value.metadata.layouts[0].occurrence), byteOffsetExpression: null,
      byteOffset: available(8n), byteAlignmentExpression: null, byteAlignment: available(8n) }),
  } } };
  value.capture.operation = "field-offset";
  value.capture.selector = field;
  value.capture.field = available(field);
  value.capture.result = available(1);
  const row = value.observations.rows[0];
  row.operation = "field-offset";
  row.layout.layout = 1;
  row.field = { metadata: value.metadata.key, field: 0 };
  row.result = 1;
  const previousNodeOf = value.input.nodeOf;
  const previousNodeExists = value.input.facts.nodeExists;
  const previousScope = value.input.facts.bindingScopesOf;
  value.input.nodeOf = source => isDeepStrictEqual(source, field) ? fieldNode : previousNodeOf(source);
  value.input.facts.nodeExists = source => isDeepStrictEqual(source, field) || previousNodeExists(source);
  value.input.facts.nominalOf = definition => definition === value.fixture.definition ? { kind: "declared", facets: ["instance", "value"] } : null;
  value.input.facts.bindingScopesOf = target => {
    const scopes = previousScope(target);
    return selected === null || scopes === null ? scopes : [...scopes, scopes[0]];
  };
  value.input.types = seedTypeInterner(value.fixture.index.types);
  return { ...value, fieldNode };
}

export async function observationCases(suite) {
await suite.test("constructed static observation consumes the exact checked descriptor and Layout value, not checker value", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const value = observationFixture();
  assert.deepEqual(rules(value), []);
  assert.equal(isDeepStrictEqual(parseObservations(printObservations(value.observations)), { kind: "parsed", value: value.observations }), true, "complete standalone observation codec");
  for (const [operation, expected] of [["size", 8n], ["alignment", 8n], ["stride", 8n]]) {
    value.capture.operation = operation;
    value.observations.rows[0].operation = operation;
    value.observations.rows[0].value = expected;
    assert.deepEqual(rules(value), []);
  }
  value.observations.rows[0].value = 100n;
  assert.equal(rules(value).includes("observation-exact-value"), true);
});

await suite.test("the same generic checked occurrence is verified under each complete binding, without cross-instance reuse", () => {
  for (const type of [1, 2]) {
    const value = observationFixture(type);
    assert.deepEqual(rules(value), []);
    assert.equal(value.capture.result.value, 3);
    assert.equal(value.observations.rows[0].result, type);
    assert.equal(bindingVectorKey(value.capture.bindings.value) === bindingVectorKey(value.bindings), false);
    value.observations.rows[0].result = type === 1 ? 2 : 1;
    assert.equal(rules(value).includes("observation-field-exact"), true);
  }
});

await suite.test("metadata membership cannot replace the selected checked descriptor or its complete binding environment", () => {
  for (const amend of [
    value => { value.capture.layout = available({ kind: "item", value: { owner: value.fixture.definition, node: 4 } }); },
    value => { value.descriptorNode.tsonic.value.memory.value.bindings.value.classBindings[0].parameter = { owner: value.fixture.definition, index: 1 }; },
    value => { value.observations.rows[0].bindings = empty(); },
    value => { value.descriptorNode.tsonic.value.memory.value.kind = "array"; },
    value => { value.descriptorNode.tsonic.value.memory.value.occurrence = { ...value.descriptor, value: { ...value.descriptor.value, node: 4 } }; },
    value => { value.node.tsonic.value.observation = available(null); },
    value => { value.node.tsonic.value.observation = { kind: "unavailable", reason: "not-provided" }; },
  ]) {
    const value = observationFixture(1);
    amend(value);
    assert.equal(rules(value).includes("observation-field-exact"), true);
  }
});

await suite.test("observation ordering, totality, result domain and qualified operand remain independently checked", () => {
  for (const [amend, expected] of [
    [value => { value.observations.rows = []; }, "observation-field-exact"],
    [value => { value.observations.rows.push(structuredClone(value.observations.rows[0])); }, "observations-order"],
    [value => { value.observations.rows[0].result = 99; }, "type-resolves"],
    [value => { value.observations.rows[0].operand = { ...value.capture.operand, node: 99 }; }, "node-resolves"],
    [value => { value.capture.occurrence = { ...value.capture.occurrence, node: 99 }; }, "cross-owner-qualified"],
  ]) {
    const value = observationFixture(); amend(value);
    assert.equal(rules(value).includes(expected), true, expected);
  }
});

await suite.test("generic observation substitution refuses before processing later captures and publishes no partial result", () => {
  const value = observationFixture(1);
  value.input.typeExpansion.maximumVisits = 0;
  let rowsRead = 0;
  const first = value.observations.rows[0];
  value.observations.rows = [first, { ...first, node: 4, get result() { rowsRead += 1; return 1; } }];
  assert.deepEqual(verifyObservations(value.observations, value.input), { kind: "resource-limit", dimension: "visits", maximum: 0 });
  assert.equal(rowsRead, 0, "no output comparison after refused canonical substitution");
});

await suite.test("newly interned expected generic types do not extend the published observation type domain", () => {
  for (const result of [4, 5]) {
    const value = observationFixture(1);
    value.fixture.index.types.terms.push({ kind: "array", element: 3, readonly: false });
    value.capture.result = available(4);
    value.observations.rows[0].result = result;
    value.input.types = seedTypeInterner(value.fixture.index.types);
    const actual = rules(value);
    assert.equal(actual.includes("observation-field-exact"), true, "an absent-table expected result is not a published type");
    assert.equal(actual.includes("type-resolves"), result === 5);
    assert.equal(value.fixture.index.types.terms.length, 5, "verification never appends its expected type to the published table");
  }
});

await suite.test("parametric descriptors preserve exact rigid owner and slot identity rather than merely lacking bound rows", () => {
  const value = observationFixture(1);
  value.observations.instance.bindings = { kind: "parametric" };
  value.metadata.key.bindings = { kind: "parametric" };
  value.observations.rows[0].result = 3;
  value.observations.rows[0].bindings = value.capture.bindings.value;
  value.input.facts.bindingScopesOf = () => [{ ...value.fixture.scope, classParameters: [value.parameter] }];
  assert.deepEqual(rules(value), []);
  value.descriptorNode.tsonic.value.memory.value.bindings = available({ ...empty(), classBindings: [
    { kind: "rigid", parameter: { owner: value.parameter.owner, index: 1 } },
  ] });
  assert.equal(rules(value).includes("observation-field-exact"), true, "the actual descriptor binder slot must match its parametric metadata scope");
});

await suite.test("selected physical fields retain exact occurrence, kind, owner, ordinal and bound metadata environment", () => {
  for (const selected of [null, 1, 2]) {
    for (const amend of [
      value => { value.observations.rows[0].field.field = 99; },
      value => { value.observations.rows[0].field = null; },
      value => { value.observations.rows[0].layout.layout = 0; },
      value => { value.metadata.fields[0].owner = 0; },
      value => { value.capture.field = available(null); },
      value => { value.fieldNode.tsonic.value.memory.value.kind = "value"; },
    ]) {
      const value = fieldObservationFixture(selected);
      assert.deepEqual(rules(value), []);
      amend(value);
      assert.equal(rules(value).includes("observation-field-exact"), true);
    }
  }
});

await suite.test("standalone observation wire preserves exact wide values and rejects the retired flow-context field", () => {
  const value = observationFixture();
  const row = value.observations.rows[0];
  row.value = 9007199254740993n;
  value.metadata.layouts[0].byteSize = row.value;
  value.descriptorNode.tsonic.value.memory.value.geometry.byteSize = available(row.value);
  assert.deepEqual(rules(value), []);
  const emptyVector = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
  const definition = value.fixture.definition;
  const body = value.fixture.bodyId;
  const expected = `BodyObservations(instance=BodyInstance(body=body:"${body}", bindings=parametric()), rows=[\n  ObservationFact(node=n:2, operation="size", operand=NodeRef(body=body:"${body}", node=n:2), layout=MetadataLayoutRef(metadata=MetadataKey(definition=def:"${definition}", bindings=parametric()), layout=layout:0), field=null, result=t:1, value=9007199254740993n, bindings=${emptyVector})\n])\n`;
  assert.equal(printObservations(value.observations), expected);
  assert.equal(isDeepStrictEqual(parseObservations(expected), { kind: "parsed", value: value.observations }), true);
  assert.equal(parseObservations(expected.replace("value=9007199254740993n, bindings=", "value=9007199254740993n, context=context:0, bindings=")).kind, "invalid-text");
});


await suite.test("checked-root and nested-body ownership are independent from static result availability", () => {
  for (const amend of [
    value => { value.input.source = { ...value.source, body: value.fixture.bodyId + "-foreign" }; },
    value => { value.input.source = { ...value.source, owner: encodeDefId({ module: value.fixture.module.module, segments: [{ name: "other", ordinal: 0 }] }) }; },
    value => { value.source.nestedBodies = [value.fixture.bodyId + "-nested"]; },
  ]) {
    const value = observationFixture(); amend(value);
    assert.equal(rules(value).includes("cross-owner-qualified"), true);
  }
  const value = observationFixture();
  const statement = { ...value.node, id: 1, kind: "ExpressionStatement", expression: value.node, tsonic: null };
  const emptyStatement = { ...value.node, id: 4, kind: "EmptyStatement", tsonic: null };
  const nested = { ...value.source, body: value.fixture.bodyId + "-nested", root: emptyStatement };
  value.source.root = { ...value.node, id: 0, kind: "Block", statements: { loc: value.node.loc, nodes: [statement, emptyStatement] }, tsonic: null };
  value.source.nestedBodies = [nested.body];
  value.input.bodyOf = body => body === nested.body ? nested : null;
  assert.deepEqual(rules(value), []);
  value.source.root.statements.nodes.push(statement);
  assert.deepEqual(rules(value), [], "repeated malformed syntax topology is not a second static occurrence or an HIR validity certificate");
  value.source.nestedBodies = [];
  value.source.root.statements.nodes = [];
  value.observations.rows = [];
  value.input.facts.bindingScopesOf = () => [];
  assert.deepEqual(rules(value), [], "the supplied checked body genuinely has no observation");
});

await suite.test("unavailable or mismatched captured results and descriptors never acquire a static proof", () => {
  for (const amend of [
    value => { value.capture.result = { kind: "unavailable", reason: "not-provided" }; },
    value => { value.capture.result = available(99); },
    value => { value.capture.bindings = { kind: "unavailable", reason: "not-provided" }; },
    value => { value.input.nodeOf = () => null; },
    value => { value.descriptorNode.tsonic = null; },
    value => { value.descriptorNode.tsonic = { role: "property-name", key: { kind: "text", value: "x" } }; },
    value => { value.descriptorNode.tsonic = { core: value.node.tsonic.core, type: available(1) }; },
    value => { value.descriptorNode.tsonic.value.memory = { kind: "unavailable", reason: "not-provided" }; },
    value => { value.descriptorNode.tsonic.value.memory = available(null); },
    value => { value.descriptorNode.tsonic.value.memory.value.bindings = available(undefined); },
  ]) {
    const value = observationFixture(); amend(value);
    assert.equal(rules(value).includes("observation-field-exact"), true);
  }
  const value = observationFixture();
  value.descriptorNode.tsonic = { core: value.node.tsonic.core, parent: null, attributes: [],
    declaration: { kind: "definition", definition: value.fixture.definition }, declaredType: available(1),
    initializer: null, memory: value.descriptorNode.tsonic.value.memory };
  value.descriptorNode.kind = "VariableDeclaration";
  value.descriptorNode.name = { ...value.node, id: 5, kind: "Identifier", text: "descriptor", tsonic: null };
  value.descriptorNode.type = null;
  value.descriptorNode.initializer = null;
  value.descriptorNode.exclamationToken = null;
  assert.deepEqual(rules(value), []);
  value.source.root = value.descriptorNode;
  value.observations.rows = [];
  value.input.facts.bindingScopesOf = () => [];
  assert.deepEqual(rules(value), [], "checked declarations carry memory but do not manufacture observation captures");
});

await suite.test("metadata references require the exact selected record, dense row and complete binding identity", () => {
  for (const amend of [
    value => { value.input.facts.metadataOf = () => null; },
    value => { value.metadata.kind = "data-layout"; },
    value => { value.observations.rows[0].layout.layout = 99; },
    value => { value.metadata.layouts[0].id = 99; },
    value => { value.metadata.key = { ...value.metadata.key, definition: encodeDefId({ module: value.fixture.module.module, segments: [{ name: "different", ordinal: 0 }] }) }; value.input.facts.metadataOf = () => value.metadata; },
    value => { value.metadata.key = { ...value.metadata.key, bindings: { kind: "instantiated", bindings: empty() } }; value.input.facts.metadataOf = () => value.metadata; },
  ]) {
    const value = observationFixture(); amend(value);
    assert.equal(rules(value).includes("metadata-reference-resolves"), true);
  }
  const value = fieldObservationFixture();
  value.capture.operation = "size";
  value.observations.rows[0].operation = "size";
  value.observations.rows[0].value = 16n;
  assert.equal(rules(value).includes("observation-field-exact"), true, "a non-field operation cannot retain a field selector");
});

await suite.test("descriptor occurrences retain their actual body namespace rather than an item-node alias", () => {
  const value = observationFixture();
  const selected = { kind: "body", value: { body: value.fixture.bodyId, node: 3 } };
  const previous = value.input.nodeOf;
  value.metadata.layouts[0].occurrence = selected;
  value.capture.layout = available(selected);
  value.descriptorNode.tsonic.value.memory.value.occurrence = selected;
  value.input.nodeOf = source => isDeepStrictEqual(source, selected) ? value.descriptorNode : previous(source);
  assert.deepEqual(rules(value), []);
  value.capture.layout = available(value.descriptor);
  assert.equal(rules(value).includes("observation-field-exact"), true);
});

await suite.test("all four standalone observation wire arms retain exact bigint transport without a flow arena", () => {
  for (const operation of ["size", "alignment", "stride", "field-offset"]) {
    const value = observationFixture();
    const row = value.observations.rows[0];
    row.operation = operation;
    row.value = 9007199254740993n;
    if (operation === "field-offset") row.field = { metadata: row.layout.metadata, field: 0 };
    const key = `MetadataKey(definition=def:"${value.fixture.definition}", bindings=parametric())`;
    const field = operation === "field-offset" ? `MetadataFieldRef(metadata=${key}, field=field:0)` : "null";
    const expected = `BodyObservations(instance=BodyInstance(body=body:"${value.fixture.bodyId}", bindings=parametric()), rows=[\n  ObservationFact(node=n:2, operation="${operation}", operand=NodeRef(body=body:"${value.fixture.bodyId}", node=n:2), layout=MetadataLayoutRef(metadata=${key}, layout=layout:0), field=${field}, result=t:1, value=9007199254740993n, bindings=BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[]))\n])\n`;
    assert.equal(printObservations(value.observations), expected);
    assert.equal(isDeepStrictEqual(parseObservations(expected), { kind: "parsed", value: value.observations }), true);
  }
});


await suite.test("unresolved selected field references retain both reference and field-selection violations", () => {
  for (const selected of [null, 1, 2]) {
    const value = fieldObservationFixture(selected);
    value.observations.rows[0].field.field = 99;
    const actual = rules(value);
    assert.equal(actual.includes("metadata-reference-resolves"), true);
    assert.equal(actual.includes("observation-field-exact"), true);
    const wrongFamily = fieldObservationFixture(selected);
    wrongFamily.observations.rows[0].field.metadata = { definition: encodeDefId({ module: wrongFamily.fixture.module.module,
      segments: [{ name: "dataLayout", ordinal: 0 }] }), bindings: wrongFamily.metadata.key.bindings };
    const previous = wrongFamily.input.facts.metadataOf;
    wrongFamily.input.facts.metadataOf = key => key.definition === wrongFamily.observations.rows[0].field.metadata.definition
      ? { kind: "data-layout", key, occurrence: wrongFamily.descriptor, fingerprint: "fixture", byteOrder: "little", addressWidth: 64 }
      : previous(key);
    const rejected = rules(wrongFamily);
    assert.equal(rejected.includes("metadata-reference-resolves"), true);
    assert.equal(rejected.includes("observation-field-exact"), true);
  }
});

}
