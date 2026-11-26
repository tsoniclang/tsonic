import assert from "node:assert/strict";
import { test } from "node:test";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture, observeSourceType } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

async function captured(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = captureSingleModule(fixture.front, { ...opened.deps, navigationCapture: { ...opened.deps.navigationCapture,
    maximumCapturedFactsPerModule: 512, maximumCapturedEdgesPerModule: 2048 } }, opened.program, module);
  assert.equal(captured.kind, "ok", "a finite declared recursion must not consume an unbounded captured component path");
  const raw = captured.value;
  const definitions = identifySingleModule(fixture.front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(definitions.kind, "ok");
  return { fixture, source, snapshot, module, raw, opened, definitions: definitions.value };
}

test("a real declared recursive member retains a finite raw graph and its original qualified declaration", async () => {
  const { fixture, raw, definitions, module } = await captured("export type Link={next:Link};\n");
  const alias = raw.tree.statements.nodes[0];
  const property = alias.type.members.nodes[0];
  const declared = definitions.rows.find(row => row.node === property.id);
  assert.equal(declared !== undefined, true);
  assert.equal(declared.kind, "PropertySignature");
  assert.equal(raw.types.types.length < 20, true, "the recursive pointer closes without unfolding component paths");
  const annotation = raw.types.types.find(row => row.authoredTypeNode?.node === alias.type.id);
  const reference = raw.types.types.find(row => row.authoredTypeNode?.node === property.type.id);
  assert.equal(annotation !== undefined, true);
  assert.equal(reference !== undefined, true);
  assert.notEqual(annotation.component, reference.component);
  assert.deepEqual(raw.types.components[annotation.component].root, { module, node: alias.type.id });
  assert.deepEqual(raw.types.components[reference.component].root, { module, node: property.type.id });
  for (const row of [annotation, reference]) {
    assert.equal(row.form.kind, "available");
    assert.equal(row.form.value.kind, "structure");
    const inventory = raw.types.members[row.form.value.inventory];
    assert.equal(inventory.members.length, 1);
    const member = inventory.members[0];
    assert.deepEqual(member.declarations, [{ module, node: property.id }]);
    assert.equal(member.read.kind, "available");
    const child = raw.types.types[member.read.value];
    assert.equal(child.form.kind, "available");
    assert.equal(child.form.value.kind, "structure");
    assert.equal(child.form.value.inventory, row.form.value.inventory);
    assert.equal(fixture.hir.indexSyntaxTree(raw.tree).find(node => node.id === property.id)?.kind, "PropertySignature");
  }
});

test("a real recursive declared member lowers into the same populated canonical type arena", async () => {
  const { fixture, source, raw, definitions, module } = await captured("export type Link={next:Link};\n");
  const alias = raw.tree.statements.nodes[0];
  const property = alias.type.members.nodes[0];
  const declared = definitions.rows.find(row => row.node === property.id);
  assert.equal(declared !== undefined, true);
  assert.equal(declared.kind, "PropertySignature");
  assert.equal(raw.types.members.every(table => table.members.every(member => member.declarations.length !== 0)), true);
  const interner = fixture.types.createTypeInterner();
  const boolean = fixture.types.internType(interner, { kind: "primitive", primitive: "bool" });
  const string = fixture.types.internType(interner, { kind: "string" });
  const existing = fixture.types.viewTypes(interner);
  const booleanRow = existing.terms[boolean];
  const stringRow = existing.terms[string];
  const deps = fixture.lowerDepsFor(definitions, interner, source);
  const exports = fixture.front.lowerModuleExports(deps, raw);
  assert.equal(exports.kind, "ok");
  const lowered = lowerSingleCheckedModule(fixture.front, { ...deps, exportsOf: owner => owner === module ? exports.value : null }, raw);
  assert.equal(lowered.kind, "ok");
  assert.equal(fixture.types.viewTypes(interner) === existing, true);
  assert.equal(existing.terms[boolean] === booleanRow && existing.terms[string] === stringRow, true);
  assert.equal(fixture.verifyChecked(lowered.value, interner).length, 0);
  const domain = checkedDomain(lowered.value, fixture.hir);
  assert.equal(fixture.types.verifyTypes({ table: existing, bindings: [], evidence: [], nominalOf: () => null,
    nodeExists: node => domain.nodeOf(node) !== null, localExists: domain.localExists }).length, 0);
  const parsedTypes = fixture.types.parseTypes(fixture.types.printTypes(existing));
  assert.equal(parsedTypes.kind, "parsed");
  assert.deepEqual(parsedTypes.value, existing);
  const parsedHir = fixture.hir.parseHir(fixture.hir.printHir(lowered.value));
  assert.equal(parsedHir.kind, "parsed");
  assert.deepEqual(parsedHir.value, lowered.value);
  const checked = lowered.value.tree.statements.nodes[0];
  const type = fixture.types.readType(interner, checked.type.tsonic.type.value);
  assert.equal(type.kind, "shape");
  assert.equal(type.members.length, 1);
  assert.deepEqual(type.members[0].origins, [{ kind: "declared", declaration: declared.definition }]);
  assert.equal(type.members[0].read, checked.type.tsonic.type.value);
});

test("finite raw graph capture retains the genuine parameter declaration and distinct authored uses", async () => {
  const { raw, module, definitions } = await captured("export type Link<T>={value:T;next:Link<T>};\n");
  const alias = raw.tree.statements.nodes[0];
  const parameter = alias.typeParameters.nodes[0];
  const declared = definitions.rows.find(row => row.node === parameter.id);
  assert.equal(declared?.kind, "TypeParameter");
  const annotation = raw.types.types.find(row => row.authoredTypeNode?.node === alias.type.id);
  assert.equal(annotation.form.kind, "available");
  assert.equal(annotation.form.value.kind, "structure");
  const inventory = raw.types.members[annotation.form.value.inventory];
  const value = inventory.members.find(member => member.key.kind === "text" && member.key.value === "value");
  const actual = raw.types.types[value.read.value];
  assert.equal(actual.form.kind, "available");
  assert.deepEqual(actual.form.value, { kind: "parameter", parameter: { module, node: parameter.id }, constraint: null, default: null });
  const uses = alias.type.members.nodes.flatMap(member => member.type.kind === "TypeReference" && member.type.typeArguments !== null
    ? [member.type, ...member.type.typeArguments.nodes] : [member.type]);
  for (const use of uses) {
    const row = raw.types.types.find(row => row.authoredTypeNode?.node === use.id);
    assert.equal(row !== undefined, true, "each actual authored type use retains its own component association");
    assert.deepEqual(raw.types.components[row.component].root, { module, node: use.id });
  }
});

test("finite raw graph capture does not merge repeated nonancestor native-type siblings", async () => {
  const { raw, module } = await captured("type Leaf={flag:boolean};export type Pair={left:Leaf;right:Leaf};\n");
  const pair = raw.tree.statements.nodes[1];
  const row = raw.types.types.find(row => row.authoredTypeNode?.node === pair.type.id);
  assert.equal(row.form.kind, "available");
  assert.equal(row.form.value.kind, "structure");
  const inventory = raw.types.members[row.form.value.inventory];
  const [left, right] = inventory.members.map(member => raw.types.types[member.read.value]);
  assert.equal(left.form.kind, "available");
  assert.equal(right.form.kind, "available");
  assert.equal(left.form.value.kind, "structure");
  assert.equal(right.form.value.kind, "structure");
  assert.notEqual(left.form.value.inventory, right.form.value.inventory);
  assert.notEqual(left.component, right.component);
  for (const [index, child] of [left, right].entries()) {
    const component = raw.types.components[child.component];
    assert.deepEqual(component.root, { module, node: pair.type.id });
    assert.deepEqual(component.path, { prefix: null,
      step: { kind: "member", declaration: { module, node: pair.type.members.nodes[index].id }, access: "read" } });
  }
});

test("a finite raw graph preserves an independently failed alias's original published cause", async () => {
  const { fixture, raw, module, opened } = await captured("import type { Missing } from './absent.js';export type Link={next:Link};\n");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const native = OpenedProgram.checked(opened.program);
  const file = OpenedProgram.file(opened.program, module).file;
  const numbering = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const imported = raw.tree.statements.nodes[0].importClause.namedBindings.elements.nodes[0];
  const binding = raw.bindings.find(row => row.binding.node === imported.id);
  assert.equal(binding.target.kind, "unavailable");
  assert.equal(binding.target.reason, "checker-error");
  const reference = binding.target.causes[0].diagnostic;
  assert.equal(reference.kind, "checker");
  assert.equal(reference.diagnostic.module, module);
  const original = native.diagnostics.filter(diagnostic => diagnostic.file === file)[reference.diagnostic.index];
  const syntax = numbering.nodes.find(node => numbering.ids.get(node) === imported.id);
  const checker = native.getSourceFileQueries(file).checker;
  const step = checker.getAliasStep(checker.getSymbolAtLocation(native.ast.name(syntax)));
  assert.equal(step.kind, "unresolved");
  assert.equal(fixture.sdk.getDiagnosticRunMembers(original).includes(step.cause), true);
  assert.equal(raw.checkerDiagnostics[reference.diagnostic.index].message, fixture.sdk.flattenDiagnosticMessageText(original));
});

test("finite raw graph capture admits the exact fact and edge counts including native acquisition", async () => {
  const { fixture, raw, module, snapshot } = await captured("export type Link={next:Link};\n");
  const run = (dimension, maximum) => {
    const opened = fixture.openAndCapture(snapshot);
    return captureSingleModule(fixture.front, { ...opened.deps,
      navigationCapture: { ...opened.deps.navigationCapture, [dimension]: maximum } }, opened.program, module);
  };
  for (const [dimension, exact] of [
    ["maximumCapturedFactsPerModule", 56],
    ["maximumCapturedEdgesPerModule", 42],
  ]) {
    for (let maximum = 0; maximum < exact; maximum += 1) {
      const result = run(dimension, maximum);
      assert.equal(result.kind, "refused", `${dimension} under ${maximum}`);
      assert.equal(result.diagnostics.at(-1).code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
    }
    const result = run(dimension, exact);
    assert.equal(result.kind, "ok", `${dimension} exact ${exact}`);
    assert.equal(result.value.types.types.length, raw.types.types.length);
  }
});

test("finite raw graph capture returns the original limit before a later actual annotation read", async () => {
  const { fixture, raw, module, snapshot } = await captured("export type Link={next:Link};type Later={flag:boolean};\n");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const later = raw.tree.statements.nodes[1].type;
  const original = new Error("the actual later annotation reader failed");
  let reads = 0;
  const run = maximum => {
    const opened = fixture.openAndCapture(snapshot);
    const checked = OpenedProgram.checked(opened.program);
    const guarded = OpenedProgram.create({ ...checked, getSourceFileQueries(file) {
      const queries = checked.getSourceFileQueries(file);
      return { ...queries, checker: { ...queries.checker, acquireSourceType: observeSourceType(queries.checker, request => {
        const numbering = OpenedProgram.syntax(guarded).get("/project/src/main.ts").outcome.numbering;
        if (request.kind === "annotation" && numbering.ids.get(request.node) === later.id) { reads += 1; throw original; }
      }) } };
    } }, OpenedProgram.table(opened.program), OpenedProgram.modules(opened.program).modules.map(origin =>
      OpenedProgram.file(opened.program, origin.kind === "snapshot" ? origin.module : origin.document.module)),
    OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
    return captureSingleModule(fixture.front, { ...opened.deps, navigationCapture: {
      ...opened.deps.navigationCapture, maximumCapturedFactsPerModule: maximum } }, guarded, module);
  };
  const beforeLater = 48;
  for (let maximum = 0; maximum < beforeLater; maximum += 1) {
    assert.deepEqual(run(maximum), { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
      limit: "front.maximumCapturedFactsPerModule", maximum, site: { kind: "file", path: "/project/src/main.ts" },
      unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
    assert.equal(reads, 0, `the later actual annotation is unread at ${maximum}`);
  }
  assert.throws(() => run(beforeLater), error => error === original);
  assert.equal(reads, 1);
});

test("recursive lowering returns the original publication dimensions without changing the existing arena on its first stop", async () => {
  const { fixture, raw, definitions, source, module } = await captured("export type Link={next:Link};\n");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  for (const dimension of ["maximumWork", "maximumCreatedRecords"]) {
    const interner = fixture.types.createTypeInterner();
    const boolean = fixture.types.internType(interner, { kind: "primitive", primitive: "bool" });
    const string = fixture.types.internType(interner, { kind: "string" });
    const table = fixture.types.viewTypes(interner);
    const previous = [...table.terms];
    const deps = fixture.lowerDepsFor(definitions, interner, source, { [dimension]: 0 });
    const exported = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exported.kind, "ok");
    const result = lowerSingleCheckedModule(fixture.front, { ...deps,
      exportsOf: owner => owner === module ? exported.value : null }, raw);
    assert.deepEqual(result, { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
      limit: `front.typePublication.${dimension}`, maximum: 0, site: { kind: "source", origin: raw.tree.origin },
      unit: { request: { query: "lowerModule", key: module }, position: { kind: "result" } } })] });
    assert.equal(fixture.types.viewTypes(interner) === table, true);
    assert.equal(table.terms.length, previous.length);
    assert.equal(table.terms[boolean] === previous[boolean] && table.terms[string] === previous[string], true);
    assert.equal(table.signatures.length, 0);
  }
});

test("all lazy type insertions in one actual module share the same publication allowance", async () => {
  const single = await captured("export type First=boolean;\n");
  const pair = await captured("type First=boolean;export type Later=string;\n");
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const run = (actual, dimension, maximum) => {
    const interner = actual.fixture.types.createTypeInterner();
    const deps = actual.fixture.lowerDepsFor(actual.definitions, interner, actual.source, { [dimension]: maximum });
    const exported = actual.fixture.front.lowerModuleExports(deps, actual.raw);
    assert.equal(exported.kind, "ok");
    return lowerSingleCheckedModule(actual.fixture.front, { ...deps,
      exportsOf: owner => owner === actual.module ? exported.value : null }, actual.raw);
  };
  for (const dimension of ["maximumWork", "maximumCreatedRecords"]) {
    const exact = [];
    for (const actual of [single, pair]) {
      let maximum = 0;
      for (; maximum <= 100000; maximum += 1) {
        const result = run(actual, dimension, maximum);
        if (result.kind === "ok") break;
        assert.deepEqual(result, { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
          limit: `front.typePublication.${dimension}`, maximum, site: { kind: "source", origin: actual.raw.tree.origin },
          unit: { request: { query: "lowerModule", key: actual.module }, position: { kind: "result" } } })] });
      }
      assert.equal(run(actual, dimension, maximum).kind, "ok");
      exact.push(maximum);
    }
    assert.equal(exact[1] > exact[0], true, "the second actual lazy graph must not receive a fresh allowance");
    assert.equal(run(pair, dimension, exact[0]).kind, "refused");
  }
});
