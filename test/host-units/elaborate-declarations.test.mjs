import { fixtureTypeWork, admitFixtureTable } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { readyModuleRoot, readyModuleStatements } from "./fixtures/chapter-syntax.mjs";

async function checked(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = captureSingleModule(fixture.front, opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const definitions = identifySingleModule(fixture.front, { module: captured.value, componentRoots: captured.value.types.components.map(component => component.root).filter(root => root.module === captured.value.module) });
  assert.equal(definitions.kind, "ok");
  const interner = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, interner, source);
  const exported = fixture.front.lowerModuleExports(deps, captured.value);
  assert.equal(exported.kind, "ok");
  const result = lowerSingleCheckedModule(fixture.front, { ...deps, exportsOf: owner => owner === module ? exported.value : null }, captured.value);
  assert.equal(result.kind, "ok");
  assert.equal(fixture.verifyChecked(result.value, interner).length, 0);
  const table = fixture.types.viewTypes(interner);
  const declarations = await import("../../packages/host/dist/elaborate/declarations.js");
  const scopes = fixture.hir.deriveDeclarationScopes(result.value, fixture.hir.indexSyntaxTree(result.value.tree));
  const projection = { types: interner, typeWork: fixtureTypeWork(fixture.types), nominalOf: scopes.nominalOf,
    bindingScopeOf: scopes.bindingScopeOf, checkerDiagnosticsOf: owner => {
    assert.equal(owner, result.value.module);
    return result.value.checkerDiagnostics;
  }, signatureOf: id => {
    const signature = table.signatures[id];
    assert.equal(signature !== undefined, true, "the endpoint names a genuine selected signature");
    return signature;
  } };
  return { fixture, declarations, projection, tree: result.value.tree, interner };
}

test("actual alias and interface members retain checked types, declarations and genuine bodyless endpoints", async () => {
  const { declarations, projection, tree } = await checked(
    "export type Fields<T> = { value: T; nested: { readonly leaf: boolean; }; method(input: boolean): boolean; get flag(): boolean; set flag(input: boolean | string); };\n"
    + "export interface Keys { [name: string]: boolean; }\n");
  const alias = tree.statements.nodes[0];
  const selectedAlias = declarations.declarationAlias(projection, alias);
  assert.equal(selectedAlias.kind, "ok");
  const typed = selectedAlias.value;
  assert.equal(typed.type.kind, "TypeLiteral");
  assert.equal(typed.tsonic.type, alias.tsonic.type.value);
  assert.deepEqual(typed.typeParameters.nodes[0].tsonic.parameter, alias.typeParameters.nodes[0].tsonic.parameter);
  for (let index = 0; index < alias.type.members.nodes.length; index += 1) {
    const source = alias.type.members.nodes[index];
    const result = typed.type.members.nodes[index];
    assert.equal(result.id, source.id);
    assert.equal(result.parent, source.parent);
    assert.equal(result.tsonic.definition, source.tsonic.definition ?? source.tsonic.declaration.definition);
    if (source.type !== null) assert.equal(result.type.tsonic.type, source.type.tsonic.type.value);
    if (source.kind === "PropertySignature") {
      assert.equal(result.tsonic.storage, source.tsonic.declaredType.value);
      assert.equal(result.tsonic.initializer, null);
    } else {
      assert.equal(result.tsonic.template, null);
      assert.deepEqual(result.tsonic.signatures, source.tsonic.signatures);
      const signature = projection.signatureOf(source.tsonic.signatures[0].signature);
      for (let formal = 0; formal < result.parameters.nodes.length; formal += 1) {
        assert.equal(result.parameters.nodes[formal].tsonic.local, null);
        assert.equal(result.parameters.nodes[formal].tsonic.passing, signature.parameters[formal].passing);
        assert.equal(result.parameters.nodes[formal].tsonic.storage, signature.parameters[formal].type);
      }
    }
  }
  const nested = typed.type.members.nodes[1];
  assert.equal(nested.type.kind, "TypeLiteral");
  assert.equal(nested.type.members.nodes[0].kind, "PropertySignature");
  const selectedKeys = declarations.declarationInterface(projection, tree.statements.nodes[1]);
  assert.equal(selectedKeys.kind, "ok");
  const keys = selectedKeys.value;
  assert.equal(keys.members.nodes[0].kind, "IndexSignature");
  assert.equal(keys.members.nodes[0].parameters.nodes[0].tsonic.local, null);
  assert.equal(keys.members.nodes[0].parameters.nodes[0].tsonic.passing, null);
});

test("one declaration projection retains actual namespace-qualified type references, queries and import types", async () => {
  const { checkQualifiedTypeHolding } = await import("./fixtures/qualified-type-holding.mjs");
  await checkQualifiedTypeHolding();
});

test("checked interface fragments retain one nominal group before any application and through final publication", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  for (const [formals, first, second, use] of [
    ["", "first: boolean;", "second: string;", ""],
    ["<Item>", "[key: number]: Item;", "tag: boolean;", ""],
    ["<Item>", "[key: number]: Item;", "tag: boolean;", "export type Use = Pair<boolean>[7];"],
  ]) for (const fragments of [[first, second], [second, first]]) {
    const input = analysisInput(fixture, "sdk-minimal", fragments.map(members =>
      `export interface Pair${formals} { ${members} }`).join("\n") + "\n" + use);
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
    const initial = captured.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const pair = initial.tree.statements.nodes.slice(0, 2);
    const ids = pair.map(node => node.tsonic.definition);
    const group = captured.value.nominalOf(ids[0]);
    assert.equal(group.kind, "merged-interface");
    assert.equal(captured.value.nominalOf(ids[1]) === group, true);
    assert.deepEqual(new Set(group.definitions), new Set(ids));
    if (use === "") assert.equal(captured.value.interfaceDescriptionOf(ids[0]), null);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const published = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const statements = readyModuleStatements(readyModuleRoot(published.tree));
    assert.equal(statements[0].tsonic.type, statements[1].tsonic.type);
    const table = result.value.index.types;
    const instance = table.terms[statements[0].tsonic.type];
    assert.equal(instance.kind, "merged-interface");
    assert.deepEqual(instance.definitions, group.definitions);
    assert.deepEqual(statements.slice(0, 2).map(node => node.tsonic.definition), ids);
    assert.deepEqual(statements.slice(0, 2).map(node => node.tsonic.members), pair.map(node => node.tsonic.members));
    assert.deepEqual(instance.arguments.map(type => table.terms[type]), group.slots.map(slot =>
      ({ kind: "merged-parameter", parameters: slot.parameters })));
    if (use !== "") assert.deepEqual(table.terms[statements[2].tsonic.type], { kind: "primitive", primitive: "bool" });
  }
});

test("different checked modules borrow one completed native group without conflating their local ordinals", async tester => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal");
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Control = boolean;" }, libraries: [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent
      + "\ninterface Shared<Item> { first: Item; } interface Different { one: boolean; }" },
    { name: "lib.es2015.core.d.ts", text: "interface Different { two: string; } interface Shared<Item> { second: Item; }" },
  ] });
  const owner = fixture.packageOf("/checker");
  const first = fixture.moduleOf(owner, "lib.es5.d.ts");
  const second = fixture.moduleOf(owner, "lib.es2015.core.d.ts");
  const capture = pipelineWiring.front.captureModules;
  tester.mock.method(pipelineWiring.front, "captureModules", (...args) => {
    const caught = capture(...args);
    assert.equal(caught.kind, "ok");
    const [one, different] = caught.value.find(row => row.module === first).types.interfaceGroups;
    const [another, two] = caught.value.find(row => row.module === second).types.interfaceGroups;
    assert.equal(one.ordinal, 0);
    assert.equal(two.ordinal, 1);
    assert.equal(one === two, false);
    assert.equal(one.evidence === two.evidence, true);
    assert.equal(different.evidence === another.evidence, true);
    assert.equal(one.evidence === different.evidence, false);
    return caught;
  });
  const captured = captureSourceBarrier({ ...input, snapshot });
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const named = module => new Map(captured.value.modules.find(row => row.module.module === module).module.tree.statements.nodes
    .filter(node => node.kind === "InterfaceDeclaration")
    .map(node => [node.name.text, captured.value.nominalOf(node.tsonic.definition)]));
  const firstGroups = named(first);
  const secondGroups = named(second);
  assert.equal(firstGroups.get("Shared") === secondGroups.get("Shared"), true);
  assert.equal(firstGroups.get("Different") === secondGroups.get("Different"), true);
  assert.equal(firstGroups.get("Shared") === firstGroups.get("Different"), false);
  const { declarationInterface } = await import("../../packages/host/dist/elaborate/declarations.js");
  const library = captured.value.modules.find(row => row.module.module === first);
  const actual = library.module.tree.statements.nodes.find(node => node.kind === "InterfaceDeclaration" && node.name.text === "Shared");
  const deps = { types: captured.value.types, typeWork: fixtureTypeWork(fixture.types),
    nominalOf: () => firstGroups.get("Different"),
    bindingScopeOf: () => assert.fail("a crossed fragment must not reach its binding scope") };
  assert.throws(() => declarationInterface(deps, actual), /must contain the actual checked fragment/u);
  const typeWork = fixture.types.createTypePublicationWork({ maximumWork: 0, maximumCreatedRecords: 1000 });
  const refused = declarationInterface({ ...deps, typeWork,
    nominalOf: () => assert.fail("a stopped projection must not open the nominal reader") }, actual);
  assert.equal(refused.kind, "refused");
  assert.equal(refused === fixture.types.typePublicationRefusalOf(typeWork), true);
});

test("a zero-formal accessor still requires its genuine endpoint and original reader failure", async () => {
  const { declarations, projection, tree } = await checked("export type Fields = { get flag(): boolean; };\n");
  const alias = tree.statements.nodes[0];
  const getter = alias.type.members.nodes[0];
  const signature = projection.signatureOf(getter.tsonic.signatures[0].signature);
  for (const changed of [{ id: signature.id + 1 }, { declaration: alias.tsonic.definition }, { receiver: signature.result }]) {
    assert.throws(() => declarations.declarationAlias({ ...projection, signatureOf: () => ({ ...signature, ...changed }) }, alias),
      /bodyless callable endpoint/u);
  }
  const original = new TypeError("the actual endpoint reader failed");
  const later = new Proxy({}, { get() { assert.fail("no later declaration is read after the original endpoint failure"); } });
  const altered = { ...alias, type: { ...alias.type, members: { ...alias.type.members, nodes: [getter, later] } } };
  assert.throws(() => declarations.declarationAlias({ ...projection, signatureOf: () => { throw original; } }, altered),
    error => error === original);
  const unread = new Proxy({}, { get() { assert.fail("an executing accessor payload is never traversed as an annotation"); } });
  for (const changed of [{ body: unread }, { asteriskToken: unread }]) {
    const executing = { ...alias, type: { ...alias.type, members: { ...alias.type.members,
      nodes: [{ ...getter, ...changed }] } } };
    assert.throws(() => declarations.declarationAlias(projection, executing), /nonexecuting body boundary/u);
  }
});

test("twenty thousand checked member annotations project once through the same iterative typed assembly", async () => {
  const { fixture, declarations, tree } = await checked("export type Fields = { value: boolean; };\n");
  const alias = tree.statements.nodes[0];
  const leaf = alias.type.members.nodes[0].type;
  const source = alias.type.members.nodes[0];
  const depth = 20000;
  const terms = Array.from({ length: depth + 1 });
  const reads = new Set();
  const phase = (base, id, type) => ({ ...base, type: { kind: "available", value: type },
    get referencedDefinitions() {
      assert.equal(reads.has(id), false, "each actual annotation completes exactly once");
      reads.add(id);
      return [];
    } });
  terms[depth] = { kind: "primitive", primitive: "bool" };
  let node = { ...leaf, id: depth * 3, parent: depth * 3 - 2, tsonic: phase(leaf.tsonic, depth * 3, depth) };
  for (let index = depth - 1; index >= 0; index -= 1) {
    const id = index * 3;
    const definition = fixture.ids.encodeDefId({ module: tree.origin.module, segments: [{ name: `member${index}`, ordinal: 0 }] });
    const origin = { kind: "declared", declaration: definition };
    terms[index] = { kind: "shape", members: [{ key: { kind: "text", value: "value" }, kind: "property",
      origins: [origin], readOrigins: [origin], writeOrigins: [origin], read: index + 1, write: index + 1,
      optional: false, readonly: false }], indexes: [], calls: [], constructs: [] };
    node = { ...alias.type, id, parent: index === 0 ? alias.id : id - 2, tsonic: phase(alias.type.tsonic, id, index),
      members: { ...alias.type.members, nodes: [{ ...source, id: id + 1, parent: id,
        name: { ...source.name, id: id + 2, parent: id + 1,
          tsonic: { ...source.name.tsonic, declaration: { kind: "definition", definition } } },
        type: node, tsonic: { ...source.tsonic, declaration: { kind: "definition", definition },
          declaredType: { kind: "available", value: index + 1 }, inferredTypeBound: null } }] } };
  }
  const interner = admitFixtureTable(fixture.types, { terms, signatures: [] });
  const table = fixture.types.viewTypes(interner);
  assert.equal(table.terms.length, depth + 1);
  const unused = () => assert.fail("this closed shape graph has no component, nominal or local references");
  assert.equal(fixture.types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: unused,
    nodeExists: unused, localExists: unused }).length, 0, "the deep fixture is a valid complete canonical TypeTable");
  const result = declarations.declarationType({ types: interner, typeWork: fixtureTypeWork(fixture.types),
    signatureOf: () => assert.fail("no callable endpoint belongs to this constructed property-only graph") }, node);
  assert.equal(result.kind, "ok");
  let completed = result.value;
  for (let index = 0; index < depth; index += 1) {
    assert.equal(completed.kind, "TypeLiteral");
    assert.equal(completed.tsonic.type, index);
    assert.equal(completed.members.nodes[0].tsonic.storage, index + 1);
    assert.equal(completed.members.nodes[0].id, index * 3 + 1);
    completed = completed.members.nodes[0].type;
  }
  assert.equal(completed.kind, "BooleanKeyword");
  assert.equal(completed.tsonic.type, depth);
  assert.equal(reads.size, depth + 1);
});

test("a captured failed annotation returns its original diagnostic before reading a later type child", async () => {
  const { declarations, projection, tree } = await checked('export type Early = Missing extends boolean ? "first" : "later";');
  const alias = tree.statements.nodes[0];
  const check = alias.type.checkType;
  assert.equal(check.tsonic.type.reason, "checker-error");
  const diagnostic = projection.checkerDiagnosticsOf(tree.origin.module)[0];
  const unread = new Proxy({}, { get() { assert.fail("no later child may be read after refusal"); } });
  const input = { ...alias, type: { ...alias.type, extendsType: unread } };
  const selected = declarations.declarationAlias(projection, input);
  assert.equal(selected.kind, "refused");
  assert.equal(selected.diagnostics.length, 1);
  assert.equal(selected.diagnostics[0] === diagnostic, true);
  const missing = { ...check, tsonic: { ...check.tsonic, type: { kind: "unavailable", reason: "not-provided", causes: [] } } };
  assert.throws(() => declarations.declarationAlias(projection, { ...input, type: { ...input.type, checkType: missing } }),
    /actual captured type or original error/u);
});
