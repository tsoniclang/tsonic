import assert from "node:assert/strict";
import { appendModuleFixture, encodeContextKey, joinModuleFixtures, moduleFixture } from "../ir-program-fixtures.mjs";
import { publicationFixture } from "./program-publication.mjs";
import { loadFrontFixture } from "./front/checked-module.mjs";

function metadataValue(fixture, id, type, changes = {}) {
  const available = value => ({ kind: "available", value });
  const root = fixture.module.tree.root;
  const literal = { numerator: 1n, denominator: 1n, negativeZero: false };
  const syntax = { id, parent: id - 1, origin: root.origin, flags: [], loc: root.loc,
    kind: "NumericLiteral", text: "1", tokenFlags: [] };
  const source = { ...syntax, tsonic: { core: { ...fixture.tirInput.source.tree.tsonic.core }, role: "value",
    literal: { kind: "number", value: literal }, value: { views: { read: available(type), declared: available(null), contextual: available(null) },
      place: available(null), memory: available(null), observation: available(null), ...changes } } };
  const typed = { ...syntax, tsonic: { type, convertedType: type, conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" }, role: "value", value: literal } };
  const statement = { id: id - 1, parent: 0, origin: root.origin, flags: [], loc: root.loc,
    kind: "ExpressionStatement", tsonic: null };
  const checkedStatement = { ...statement, expression: source };
  const typedStatement = { ...statement, expression: typed };
  root.statements = { ...root.statements, nodes: [...root.statements.nodes, { kind: "ready-statement", node: typedStatement }] };
  const checkedRoot = fixture.tirInput.source.tree;
  checkedRoot.statements = { ...checkedRoot.statements, nodes: [...checkedRoot.statements.nodes, checkedStatement] };
  root.endOfFileToken.id = id + 1;
  fixture.selected.facts[0].refinements.integers.push({ node: id, range: null, nonnegative: false });
  for (const node of [checkedStatement, source, checkedRoot.endOfFileToken]) for (const reference of [
    { kind: "body", value: { body: fixture.bodyId, node: node.id } },
    { kind: "item", value: { owner: fixture.definition, node: node.id } },
  ]) {
    fixture.answers.set(encodeContextKey(["nodeOf", reference]), node);
    fixture.answers.set(encodeContextKey(["nodeExists", reference]), true);
  }
  return source;
}

export function metadataOperationFixture(operation, fact, selectedKey, root = "/program", maximumWork) {
  assert.equal(["size", "alignment", "stride"].includes(operation), true, "authored observation operation");
  assert.equal(["present", "absent", "other-node"].includes(fact), true, "authored fact inventory");
  assert.equal(["layout", "data-layout"].includes(selectedKey), true, "authored metadata operand");
  const { first, second } = joinModuleFixtures(publicationFixture(moduleFixture("src/main.ts", root, undefined, maximumWork)),
    publicationFixture(moduleFixture("src/other.ts", "/z-dependency")));
  first.index.types.terms.push({ kind: "primitive", primitive: "bool" }, { kind: "primitive", primitive: "uint64" });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const key = { definition: first.definition, bindings: { kind: "instantiated", bindings } };
  const dataKey = { definition: second.definition, bindings: { kind: "parametric" } };
  const descriptor = { kind: "body", value: { body: first.bodyId, node: 4 } };
  const dataDescriptor = { kind: "body", value: { body: second.bodyId, node: 2 } };
  const metadata = { key, kind: "memory-layout", root: 0, layouts: [{ id: 0,
    occurrence: descriptor, source: 1,
    dataLayout: second.definition, byteSize: 1n, byteAlignment: 1n, stride: 1n, kind: "value", fields: [] }], fields: [] };
  const data = { key: dataKey, kind: "data-layout", occurrence: dataDescriptor,
    fingerprint: "native64-le", byteOrder: "little", addressWidth: 64 };
  first.index.metadata = [metadata, data];
  const published = first.selected;
  const site = { origin: first.module.tree.root.origin, tir: { body: first.bodyId, node: 2 } };
  published.mir.locals = [{ id: 0, storage: 2, role: { kind: "temporary" }, mode: "local", source: null, origin: site.origin }];
  published.mir.places = [{ id: 0, base: { kind: "local", local: 0 }, storage: 2, origin: site.origin }];
  const operandKey = selectedKey === "layout" ? key : dataKey;
  published.mir.constants = [{ id: 0, type: 2, value: { kind: "metadata", ...operandKey } }];
  published.mir.blocks[0].statements = [
    { ...site, kind: "storage-live", local: 0 },
    { ...site, kind: "assign", place: 0, value: { kind: "use", operand: { kind: "constant", constant: 0 } }, step: null },
    { ...site, kind: "storage-dead", local: 0 },
  ];
  const bodyRecord = first.index.bodies.find(body => body.kind === "selected");
  bodyRecord.mirLocalCount = 1;
  bodyRecord.mirConstantCount = 1;
  bodyRecord.mirPlaceCount = 1;
  published.facts[0].arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [] });
  published.facts[0].liveness.locals.push({ local: 0, segments: [{ block: 0, first: 0, last: 2 }] });
  published.facts[0].liveness.stores.push({ node: 0, point: { block: 0, statement: 1 }, edge: null, observed: false });
  const available = value => ({ kind: "available", value });
  const occurrence = { body: first.bodyId, node: 2 };
  const observation = { occurrence, operation, operand: occurrence, bindings: available(bindings), layout: available(descriptor),
    selector: null, field: available(null), result: available(2), value: available(1n) };
  const checked = metadataValue(first, 2, 2, { observation: available(fact === "absent" ? null : observation) });
  metadataValue(first, 4, 1, { memory: available({ kind: "value", occurrence: descriptor, bindings: available(bindings),
    geometry: { source: available(1), dataLayoutExpression: null, dataLayout: available(second.definition),
      byteSizeExpression: null, byteSize: available(1n), byteAlignmentExpression: null, byteAlignment: available(1n),
      strideExpression: null, stride: available(1n) }, fieldExpressions: [], fields: available([]) }) });
  metadataValue(second, 2, 1, { memory: available({ kind: "data-layout", occurrence: dataDescriptor, bindings: available(bindings),
    declaration: available(second.definition), fingerprint: available("native64-le"), byteOrder: available("little"), addressWidth: available(64) }) });
  for (const [key, value] of second.answers) first.answers.set(key, value);
  if (fact !== "absent") published.observations.rows.push({ node: fact === "other-node" ? 4 : 2,
    operation, operand: occurrence, layout: { metadata: key, layout: 0 }, field: null,
    result: 2, value: 1n, bindings });
  first.answers.set(encodeContextKey(["metadataOf", key]), metadata);
  first.answers.set(encodeContextKey(["metadataOf", dataKey]), data);
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "metadata", metadata: key }]), []);
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "metadata", metadata: dataKey }]), []);
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "observations", instance: first.instance }]),
    fact === "absent" ? [] : [first.scope]);
  return { first, second, metadata, data, checked };
}

export function repeatedMetadataFixture(uses, ownerSize, fact = "present") {
  assert.equal(Number.isSafeInteger(uses) && uses > 0, true, "authored positive metadata operand count");
  assert.equal(Number.isSafeInteger(ownerSize) && ownerSize >= 0, true, "authored canonical owner length");
  const root = ownerSize === 0 ? "/program" : "/program/" + "p".repeat(ownerSize);
  const fixture = metadataOperationFixture("size", fact, "layout", root);
  const type = fixture.first.index.types.terms.length;
  fixture.first.index.types.terms.push({ kind: "array", element: 2, readonly: false });
  const mir = fixture.first.selected.mir;
  mir.locals[0].storage = type;
  mir.places[0].storage = type;
  mir.blocks[0].statements[1].value = { kind: "aggregate", type,
    aggregate: { kind: "array", elements: Array.from({ length: uses }, () => ({ kind: "constant", constant: 0 })) } };
  return fixture;
}

export function publishedArtifactFixture(change) {
  const fixture = metadataOperationFixture("size", "present", "layout");
  const { first, second } = fixture;
  for (const module of [first, second]) {
    first.index.constants.push({ reference: { initializer: module.instance, context: "compile-time" }, value: { kind: "absence", type: 0 } });
  }
  switch (change) {
    case "none": break;
    case "metadata-duplicate": first.index.metadata.splice(1, 0, first.index.metadata[0]); break;
    case "metadata-order": first.index.metadata.reverse(); break;
    case "summary-duplicate": first.index.summaries.splice(1, 0, first.index.summaries[0]); break;
    case "summary-order": first.index.summaries.reverse(); break;
    case "constant-duplicate": first.index.constants.splice(1, 0, first.index.constants[0]); break;
    case "constant-order": first.index.constants.reverse(); break;
    case "constant-type": first.index.constants[0].value.type = 3; break;
    case "metadata-stride": fixture.metadata.layouts[0].stride = 0n; break;
    case "summary-result": first.index.summaries[0].result = 1; break;
    case "summary-owner": first.index.summaries[0].signature = 1; break;
    default: throw new Error("Unlisted authored artifact inventory change");
  }
  return fixture;
}

export function metadataFieldFixture(operandKey) {
  assert.equal(["layout", "field", "data-layout"].includes(operandKey), true, "authored field-offset operand key");
  const fixture = metadataOperationFixture("size", "absent", "layout", "/program", 20000);
  const { first, second, metadata, data } = fixture;
  const third = publicationFixture(moduleFixture("src/field.ts", "/zz-field"));
  appendModuleFixture(first, third);
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const fieldKey = { definition: third.definition, bindings: { kind: "instantiated", bindings } };
  const key = { kind: "text", value: "field" };
  const occurrence = { kind: "body", value: { body: third.bodyId, node: 2 } };
  const origin = { kind: "mapped", owner: { kind: "item", value: { owner: first.definition, node: 0 } }, key };
  first.index.types.terms.push({ kind: "shape", members: [{ key, origins: [origin], readOrigins: [origin],
    writeOrigins: [origin], kind: "property", read: 1, write: 1, optional: false, readonly: false }],
  indexes: [], calls: [], constructs: [] });
  const member = { key, origins: [origin], selectedDeclarations: [], primary: null, bindings };
  const field = { id: 0, occurrence, owner: 3, selector: occurrence, selection: occurrence, member,
    value: 1, layout: 0, byteOffset: 0n, byteAlignment: 1n };
  metadata.root = 1;
  const layoutOccurrence = { kind: "body", value: { body: first.bodyId, node: 6 } };
  metadata.layouts.push({ id: 1, occurrence: layoutOccurrence,
    source: 3, dataLayout: second.definition, byteSize: 1n, byteAlignment: 1n, stride: 1n,
    kind: "value", fields: [0] });
  metadata.fields.push(field);
  const selected = { key: fieldKey, kind: "memory-field", root: 0, layouts: metadata.layouts, fields: metadata.fields };
  first.index.metadata.push(selected);
  first.answers.set(encodeContextKey(["metadataOf", fieldKey]), selected);
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "metadata", metadata: metadata.key }]), [third.scope]);
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "metadata", metadata: fieldKey }]), [third.scope]);
  const available = value => ({ kind: "available", value });
  metadataValue(first, 6, 1, { memory: available({ kind: "value", occurrence: layoutOccurrence, bindings: available(bindings),
    geometry: { source: available(3), dataLayoutExpression: null, dataLayout: available(second.definition),
      byteSizeExpression: null, byteSize: available(1n), byteAlignmentExpression: null, byteAlignment: available(1n),
      strideExpression: null, stride: available(1n) }, fieldExpressions: [], fields: available([occurrence]) }) });
  metadataValue(third, 2, 1, { memory: available({ kind: "field", occurrence, bindings: available(bindings), source: available(3),
    selector: occurrence, selection: available(occurrence), key: available(key), origins: available([origin]),
    selectedDeclarations: available([]), primary: available(null), value: available(1), fieldLayoutExpression: null,
    fieldLayout: available(layoutOccurrence), byteOffsetExpression: null, byteOffset: available(0n),
    byteAlignmentExpression: null, byteAlignment: available(1n) }) });
  for (const [key, value] of third.answers) first.answers.set(key, value);
  const checked = fixture.checked;
  checked.tsonic.value.observation = available({ occurrence: { body: first.bodyId, node: 2 }, operation: "field-offset",
    operand: { body: first.bodyId, node: 2 }, bindings: available(bindings), layout: available(layoutOccurrence),
    selector: occurrence, field: available(occurrence), result: available(2), value: available(0n) });
  const published = first.selected;
  published.observations.rows.push({ node: 2, operation: "field-offset", operand: { body: first.bodyId, node: 2 },
    layout: { metadata: metadata.key, layout: 1 }, field: { metadata: fieldKey, field: 0 },
    result: 2, value: 0n, bindings });
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "observations", instance: first.instance }]), [first.scope]);
  const selectedKey = operandKey === "layout" ? metadata.key : operandKey === "field" ? fieldKey : data.key;
  published.mir.constants[0].value = { kind: "metadata", ...selectedKey };
  return { first, second, third, fieldKey, checked };
}

export function metadataBindingFixture(proof, operandKey) {
  assert.equal(["field", "record", "unlinked"].includes(proof), true, "authored binding proof");
  const fixture = metadataFieldFixture(operandKey);
  const { first, third, fieldKey } = fixture;
  const published = first.selected;
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const reference = node => ({ body: first.bodyId, node });
  const fieldNode = proof === "field" ? 2 : 4;
  published.observations.rows = [];
  fixture.checked.tsonic.value.observation = { kind: "available", value: null };
  first.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "observations", instance: first.instance }]), []);
  published.facts[0].fieldBindings = [{ node: fieldNode, result: 2, owner: 3,
    fieldExpression: reference(fieldNode), field: { metadata: fieldKey, field: 0 },
    pointer: reference(fieldNode), pointee: 1, context: 0, bindings }];
  if (proof === "record") {
    published.facts[0].recordBindings = [{ node: 2, result: 3, layoutExpression: reference(2),
      layout: { metadata: first.index.metadata[0].key, layout: 1 }, context: 0, bindings,
      fields: [{ expression: reference(4), binding: 4 }] }];
  }
  const available = value => ({ kind: "available", value });
  const fieldOccurrence = { kind: "body", value: { body: third.bodyId, node: 2 } };
  const fieldCapture = { occurrence: reference(fieldNode), bindings: available(bindings), owner: available(3), pointee: available(1),
    fieldExpression: reference(fieldNode), field: available(fieldOccurrence), pointerExpression: reference(fieldNode) };
  if (proof === "field") fixture.checked.tsonic.core.fieldBinding = available(fieldCapture);
  else if (proof === "record") {
    const linked = first.answers.get(encodeContextKey(["nodeOf", { kind: "body", value: reference(4) }]));
    linked.tsonic.core.fieldBinding = available(fieldCapture);
    fixture.checked.tsonic.core.recordBinding = available({ occurrence: reference(2), bindings: available(bindings), source: available(3),
      layoutExpression: reference(2), layout: available({ kind: "body", value: reference(6) }),
      fields: [{ expression: reference(4), binding: reference(4) }] });
  }
  return fixture;
}

export async function genericMetadataSelectionFixture() {
  const front = await loadFrontFixture();
  const source = `
interface NativeAbi { readonly name: string; }
interface SelectedLayout<Value> { readonly layoutType?: Value; }
declare const abi: NativeAbi;
declare function memorylayout<Value>(geometry: {
  datalayout: NativeAbi; bytesize: number; bytealignment: number; stride: number; fields: readonly unknown[];
}): SelectedLayout<Value>;
function inspect<Value extends boolean>(): void {
  const layout = memorylayout<Value>({ datalayout: abi, bytesize: 1, bytealignment: 1, stride: 1, fields: [] });
}
`;
  const snapshot = front.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent }] });
  const { captured } = front.captureModulesOf(snapshot);
  const entry = captured.find(row => row.module === snapshot.entryPoint);
  assert.ok(entry);
  const { raw } = entry;
  assert.deepEqual(raw.checkerDiagnostics, []);
  const inspect = raw.tree.statements.nodes.at(-1);
  const parameter = inspect.typeParameters.nodes[0];
  const descriptor = inspect.body.statements.nodes[0].declarationList.declarations.nodes[0];
  const abi = raw.tree.statements.nodes[2].declarationList.declarations.nodes[0];
  const definitionOf = node => {
    const identity = entry.definitions.rows.find(row => row.node === node.id);
    assert.equal(identity?.kind, node.kind);
    return identity.definition;
  };
  const selection = raw.calls.find(row => row.invocation.node === descriptor.initializer.id);
  assert.equal(selection?.kind, "applicable");
  const [selected] = raw.types.candidates[selection.candidates].candidates;
  const [argument] = selected.application.signatureArguments;
  assert.equal(argument.argument.kind, "available");
  assert.deepEqual(raw.types.types[argument.argument.value].form.value.parameter, { module: raw.module, node: parameter.id });
  assert.deepEqual(argument.explicitTypeNode, { module: raw.module, node: descriptor.initializer.typeArguments.nodes[0].id });
  const definition = definitionOf(descriptor);
  const parameterIdentity = definitionOf(parameter);
  const { index, module } = moduleFixture("src/main.ts", "/project");
  assert.equal(module.module, raw.module);
  index.types.terms.push({ kind: "primitive", primitive: "bool" },
    ...[false, true].map(value => ({ kind: "literal", base: 1, value: { kind: "boolean", value } })));
  const bindings = type => ({ classBindings: [], methodBindings: [{ kind: "bound", parameter: parameterIdentity, type }],
    capturedBindings: [], selfBindings: [] });
  const ready = bindings(3);
  const other = bindings(2);
  const fields = new Map(descriptor.initializer.arguments.nodes[0].properties.nodes.map(property => [property.name.text, property.initializer]));
  assert.equal(fields.get("datalayout").text, abi.name.text);
  assert.deepEqual(fields.get("fields").elements.nodes, []);
  const measure = name => BigInt(fields.get(name).text);
  const metadata = { kind: "memory-layout", key: { definition, bindings: { kind: "instantiated", bindings: ready } }, root: 0,
    layouts: [{ id: 0, kind: "value", occurrence: { kind: "item", value: { owner: definition, node: descriptor.initializer.id } },
      source: 3, dataLayout: definitionOf(abi), byteSize: measure("bytesize"), byteAlignment: measure("bytealignment"),
      stride: measure("stride"), fields: [] }], fields: [] };
  index.metadata.push(metadata);
  return { index, module, metadata, ready, other, artifact: { kind: "metadata", definition } };
}
