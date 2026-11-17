import assert from "node:assert/strict";
import { before, test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

let fixture;
let wiring;
let inferStep;
let inferenceStep;
let registration;
let query;
let checkedInputs;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the current aggregate guard owns this case");
  fixture = await loadFrontFixture();
  ({ pipelineWiring: wiring } = await import("../../packages/host/dist/pipeline/wiring.js"));
  inferStep = await import("../../packages/host/dist/pipeline/infer-deps-step.js");
  inferenceStep = await import("../../packages/host/dist/pipeline/inference-step.js");
  registration = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  query = await import("../../packages/host/dist/query/index.js");
  checkedInputs = await import("../../packages/host/dist/pipeline/checked-inputs.js");
});

const EXPANSION = { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 };
const LIMITS = { maximumVariablesPerGroup: 128, maximumAtomicContributionsPerGroup: 256 };
const GRAPH = { maximumWork: 65536, maximumResultEntries: 65536 };

test("actual import syntax retains qualified B1 occurrences without inventing a default clause binding", async () => {
  const { modules } = fixture.checkedModulesOf({
    "main.ts": "import defaultValue, { value as renamed, 'value' as quoted } from './leaf.js'; import * as space from './leaf.js'; import './leaf.js';",
    "leaf.ts": "export function value(input: boolean): boolean { return input; } export { value as default };",
  });
  const main = modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const { elaborateImport } = await import("../../packages/host/dist/elaborate/imports.js");
  for (const statement of main.tree.statements.nodes) {
    const typed = elaborateImport(statement);
    assert.equal(typed.id, statement.id);
    assert.equal(typed.moduleSpecifier.tsonic.target, statement.tsonic.target.value);
    assert.equal(typed.tsonic.target, statement.tsonic.target.value);
    assert.throws(() => elaborateImport({ ...statement, tsonic: { ...statement.tsonic,
      target: { kind: "unavailable", reason: "not-provided", causes: [] } } }), /actual checked module target/);
    const clause = statement.importClause;
    if (clause === null) assert.equal(typed.importClause, null);
    else if (clause.name === null) assert.equal(typed.importClause.tsonic, null);
    else {
      assert.deepEqual(typed.importClause.tsonic.binding, clause.tsonic.bindings[0]);
      const cloned = structuredClone(statement);
      assert.equal(elaborateImport(cloned).importClause.name.text, clause.name.text,
        "equal qualified occurrences are not required to share an allocated reference object");
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
        tsonic: { ...clause.tsonic, bindings: [] } } }), /checked binding occurrence/);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, name: { ...clause.name,
        tsonic: { ...clause.name.tsonic, binding: { ...clause.tsonic.bindings[0],
          value: { ...clause.tsonic.bindings[0].value, node: clause.id + 1 } } } } } }), /checked binding occurrence/);
    }
    const named = clause?.namedBindings;
    if (named?.kind === "NamedImports") {
      const selected = typed.importClause.namedBindings.elements.nodes;
      assert.deepEqual(selected.map(node => node.tsonic.binding), named.elements.nodes.map(node => node.tsonic.bindings[0]));
      const first = named.elements.nodes[0];
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, namedBindings: { ...named,
        elements: { ...named.elements, nodes: [{ ...first, tsonic: { ...first.tsonic, bindings: [] } }] } } } }), /one actual checked binding occurrence/);
      for (const selected of named.elements.nodes) {
        const property = selected.propertyName;
        if (property === null) continue;
        const bad = { ...selected, propertyName: { ...property, tsonic: { ...property.tsonic,
          binding: { ...selected.tsonic.bindings[0], value: { ...selected.tsonic.bindings[0].value, node: selected.id + 1 } } } } };
        assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
          namedBindings: { ...named, elements: { ...named.elements, nodes: [bad] } } } }), /checked binding occurrence/);
      }
    } else if (named?.kind === "NamespaceImport") {
      assert.deepEqual(typed.importClause.namedBindings.tsonic.binding, named.tsonic.bindings[0]);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause,
        namedBindings: { ...named, tsonic: { ...named.tsonic, bindings: [] } } } }), /one actual checked binding occurrence/);
      assert.throws(() => elaborateImport({ ...statement, importClause: { ...clause, namedBindings: { ...named,
        name: { ...named.name, tsonic: { ...named.name.tsonic,
          binding: { kind: "body", value: { body: main.bodies[0].body, node: named.id } } } } } } }), /checked binding occurrence/);
    }
  }
});

test("actual named, quoted, local and namespace exports retain checked B1 names without runtime values", async () => {
  const { modules } = fixture.checkedModulesOf({
    "main.ts": "import { value } from './leaf.js'; export { value }; export { value as renamed, 'value' as 'quoted' } from './leaf.js'; export * as space from './leaf.js'; export * from './leaf.js';",
    "leaf.ts": "export function value(input: boolean): boolean { return input; }",
  });
  const main = modules.find(module => module.module === fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts"));
  const { elaborateExport } = await import("../../packages/host/dist/elaborate/imports.js");
  const statements = main.tree.statements.nodes.filter(node => node.kind === "ExportDeclaration");
  assert.equal(statements.length, 4);
  for (const statement of statements) {
    const typed = elaborateExport(statement);
    assert.equal(typed.id, statement.id);
    assert.equal(typed.tsonic.target, statement.tsonic.target.value);
    assert.equal(typed.moduleSpecifier === null, statement.moduleSpecifier === null);
    assert.throws(() => elaborateExport({ ...statement, tsonic: { ...statement.tsonic,
      target: { kind: "unavailable", reason: "not-provided", causes: [] } } }), /actual checked module target/u);
    if (statement.moduleSpecifier !== null)
      assert.throws(() => elaborateExport({ ...statement, tsonic: { ...statement.tsonic,
        target: { kind: "available", value: null } } }), /present exactly/u);
    const clause = statement.exportClause;
    if (clause === null) assert.equal(typed.exportClause, null);
    else if (clause.kind === "NamespaceExport") {
      assert.deepEqual(typed.exportClause.tsonic, { definition: clause.tsonic.definition, binding: clause.tsonic.binding });
      assert.equal(typed.exportClause.name.tsonic.role, "declaration-name");
      assert.throws(() => elaborateExport({ ...statement, exportClause: { ...clause, name: { ...clause.name,
        tsonic: { ...clause.name.tsonic, declaration: { kind: "definition", definition: main.tree.tsonic.definition } } } } }),
      /genuine checked same-node declaration/u);
    } else {
      for (const [index, original] of clause.elements.nodes.entries()) {
        const selected = typed.exportClause.elements.nodes[index];
        assert.equal(selected.tsonic.binding, original.tsonic.binding);
        assert.equal(selected.name.tsonic.binding, original.tsonic.binding);
        for (const field of ["name", "propertyName"]) {
          const name = original[field];
          if (name === null) continue;
          assert.equal(selected[field].id, name.id);
          const foreign = { ...original.tsonic.binding,
            value: { ...original.tsonic.binding.value, node: original.id + 1 } };
          const changed = { ...original, [field]: { ...name, tsonic: { ...name.tsonic, binding: foreign } } };
          assert.throws(() => elaborateExport({ ...statement, exportClause: { ...clause,
            elements: { ...clause.elements, nodes: [changed] } } }), /checked binding occurrence/u);
        }
      }
    }
  }
});

test("real bodyless call, method, construct and index formals retain definitions without execution locals", async () => {
  const program = ready('export function value(argument: boolean): boolean { return argument; } interface Callable { (value: number): number; method(value: boolean): boolean; new(value: string): Callable; [key: number]: number; [""]: number; [tag]: string; } declare const tag: symbol;');
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    for (const set of answer.value.constraints.constraints) records.set(set.body, { constraints: set, solution: answer.value.solution });
  }
  const bodies = new Map();
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const orderedBodies = [...program.checked.bodies.filter(body => body.root.kind !== "SourceFile"),
    ...program.checked.bodies.filter(body => body.root.kind === "SourceFile")];
  for (const source of orderedBodies) {
    const record = records.get(source.body);
    const answer = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(source.owner).generics, body: source, constraints: record.constraints, solution: record.solution,
      template: null, nestedBodies: source.nestedBodies.map(body => bodies.get(body)), initializers: [] });
    assert.equal(answer.kind, "ok");
    bodies.set(source.body, answer.value);
  }
  const module = [...bodies.values()].find(body => body.root.kind === "SourceFile");
  const publication = { module: program.checked.module, tree: module.root,
    bodies: program.checked.bodies.map(body => bodies.get(body.body)) };
  const declaration = module.root.statements.nodes[1];
  assert.equal(declaration.kind, "InterfaceDeclaration");
  assert.deepEqual(declaration.members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.local), [null, null, null, null]);
  assert.deepEqual(declaration.members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.passing), ["by-value", "by-value", "by-value", null]);
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, nominalOf: definition => definition === declaration.tsonic.definition
      ? { kind: "declared", facets: ["instance"] } : null,
    memberTableOf: () => null, bodyOf: instance => instance.bindings.kind === "parametric" ? bodies.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    bindingScopesOf: target => tir.tirBindingOwners(verifier, target).map(owner =>
      program.descriptions.get(owner ?? bodies.get(target.instance.body).owner).generics) };
  assert.equal(tir.verifyTirModule(verifier, publication).length, 0);
  assert.equal(tir.verifyTir(verifier, module).length, 0);
  const decoded = tir.parseTir(tir.printTir(module));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(decoded.value.root.statements.nodes[1].members.nodes.slice(0, 4).map(member => member.parameters.nodes[0].tsonic.local), [null, null, null, null]);
  for (let index = 0; index < 4; index++) {
    const parameter = declaration.members.nodes[index].parameters.nodes[0];
    const local = parameter.tsonic.local;
    parameter.tsonic.local = { body: module.body, local: 0 };
    assert.equal(tir.verifyTir(verifier, module).some(violation => violation.rule === "parameter-order"), true);
    parameter.tsonic.local = local;
  }
  const key = declaration.members.nodes[3].parameters.nodes[0];
  key.tsonic.passing = "by-value";
  assert.equal(tir.verifyTir(verifier, module).some(violation => violation.rule === "parameter-order"), true);
  key.tsonic.passing = null;
  const empty = declaration.members.nodes[4].name;
  const unresolved = declaration.members.nodes[5].name;
  assert.equal(empty.tsonic.kind, "declaration");
  assert.deepEqual(empty.tsonic.key, { kind: "available", value: { kind: "text", value: "" } });
  assert.equal(unresolved.tsonic.key.kind, "unavailable");
  assert.equal(empty.expression.tsonic.role, "declaration-name-expression");
  assert.equal(unresolved.expression.tsonic.role, "declaration-name-expression");
  assert.equal("type" in unresolved.expression.tsonic, false);
  assert.deepEqual(decoded.value.root.statements.nodes[1].members.nodes[5].name.tsonic, unresolved.tsonic);
  const original = unresolved.tsonic;
  unresolved.tsonic = { kind: "declaration", key: { kind: "available", value: { kind: "text", value: "fabricated" } } };
  assert.equal(tir.verifyTir(verifier, module).some(violation => violation.rule === "occurrence-role"), true);
  unresolved.tsonic = original;
  const executing = [...bodies.values()].find(body => body.root.kind === "Block");
  const value = executing.root.statements.nodes[0].expression;
  const selected = value.tsonic;
  value.tsonic = { role: "declaration-name-expression" };
  assert.equal(tir.verifyTir(verifier, executing).some(violation => violation.rule === "occurrence-role"), true);
  value.tsonic = selected;
  empty.expression.tsonic = selected;
  assert.equal(tir.verifyTir(verifier, module).some(violation => violation.rule === "occurrence-role"), true);
  empty.expression.tsonic = { role: "declaration-name-expression" };
});

for (const annotation of ["boolean", null]) test(`real ${annotation ?? "inferred"} local retains its qualified declaration and separate initializer`, () => {
  const program = ready(`export function local(): boolean { const value${annotation === null ? "" : `: ${annotation}`} = true; return value; }`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { constraints: set, solution: answer.value.solution });
  }
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = (body, nestedBodies) => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, ...records.get(body.body), template: null, nestedBodies, initializers: [] });
  const initializer = program.checked.bodies.find(body => body.root.kind === "TrueKeyword");
  const initialized = wiring.elaborate.elaborate(deps, inputOf(initializer, []));
  assert.equal(initialized.kind, "ok");
  const source = program.checked.bodies.find(body => body.root.kind === "Block");
  const input = inputOf(source, [initialized.value]);
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const declaration = result.value.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const local = result.value.locals[0];
  assert.equal(declaration.initializer === initialized.value.root, true, "the actual child syntax has one semantic owner");
  assert.equal(declaration.tsonic.initializer, initializer.body);
  assert.deepEqual(declaration.tsonic.declaration, { kind: "local", local: { body: source.body, local: local.id } });
  assert.equal(local.storage, initialized.value.completion);
  assert.equal(local.declaration.kind, "item");
  assert.equal(local.declaration.value.owner, initializer.owner);
  assert.equal(local.declaration.value.node, declaration.id);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [] }), /actual direct body inventory/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [initialized.value, initialized.value] }), /unique completed body/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value,
    bindings: { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } }] }), /same actual bindings/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value, owner: source.owner }] }), /actual declaration, expression and execution result/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...input, nestedBodies: [{ ...initialized.value,
    root: { ...initialized.value.root, parent: null } }] }), /actual declaration, expression and execution result/u);
  const checkedLocal = source.locals[0];
  const original = checkedLocal.declaration;
  checkedLocal.declaration = { kind: "body", value: { body: source.body, node: declaration.id } };
  assert.throws(() => wiring.elaborate.elaborate(deps, input), /actual checked declaration of a non-parameter local/u);
  checkedLocal.declaration = original;
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
});

function ready(source) {
  const { checked, interner, snapshot } = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const domain = checkedDomain(checked, fixture.hir);
  const items = new Map(checked.items.map(item => [item.definition, domain.nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const descriptions = new Map(wiring.decls.describeDefinitions({ module: checked, nodes: domain.nodes }, []).definitions
    .map(description => [description.definition, description]));
  const declarations = { modules: [{ module: checked, nodes: domain.nodes }], types: interner, typeExpansion: EXPANSION };
  const inference = inferStep.inferDepsOf({ rules: { libraries: { sources: [], sourceRoles: [], guarantees: [] },
    types: interner, typeExpansion: EXPANSION }, hirBody: body => domain.bodyOf.get(body) ?? assert.fail("actual checked body"),
    checkerDiagnosticsOf: module => module === checked.module ? checked.checkerDiagnostics : assert.fail("actual diagnostic module"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual checked declaration"), bindings: [checked.bindings], ...fixture.hir.createModuleBindingViews([checked.bindings]), limits: LIMITS, graph: GRAPH });
  const grouped = wiring.infer.groupsOf(inference, checked.bodies.map(body => body.body));
  assert.equal(grouped.kind, "ok");
  const types = fixture.types.viewTypes(interner);
  const declarationOf = definition => {
    const node = items.get(definition);
    const description = descriptions.get(definition);
    return node === undefined || description === undefined ? null : { scope: description.generics,
      parameterCount: "parameters" in node && "nodes" in node.parameters ? node.parameters.nodes.length : null,
      endpoints: "signatures" in node.tsonic ? node.tsonic.signatures : [] };
  };
  const verification = (group, constraints) => ({
    types, declarationOf, nominalOf: definition => descriptions.get(definition)?.kind === "InterfaceDeclaration"
      ? { kind: "declared", facets: ["instance"] } : null, nodeExists: reference => domain.nodeOf(reference) !== null,
    localExists: domain.localExists,
    bindingScopes: constraints.constraints.flatMap(set => set.constraints.filter(constraint => constraint.kind === "flow")
      .map(() => descriptions.get(domain.bodyOf.get(set.body).owner).generics)),
  });
  const inputs = { declarations, inference, groups: grouped.value, sources: domain.sources, verification };
  const queries = registration.createSourceSemanticQueries(inputs);
  const noCycleInThisCase = () => assert.fail("these ready-group/declared-signature cases must not close an active key");
  const database = query.createDatabase(inputs, { maximumRecords: 65536 }, noCycleInThisCase, "recorded");
  const node = checked.tree.statements.nodes[0];
  const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
  assert.equal(endpoint !== undefined, true);
  const signature = { definition: endpoint.declaration, endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } };
  return { checked, interner, snapshot, domain, descriptions, inputs, queries, database, signature, verification, declarationOf };
}

test("an actual failed assignment read returns its original published diagnostic without solving a poisoned type", () => {
  const program = ready("export function store():boolean{const a:boolean=true;a=false;return a;}");
  const body = program.checked.tree.statements.nodes[0].tsonic.body;
  const group = program.inputs.groups.find(group => group.bodies.includes(body));
  assert.notEqual(group, undefined);
  const result = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0], program.checked.checkerDiagnostics.find(diagnostic => diagnostic.code.number === 2588));
});

for (const annotation of ["boolean", null]) test(`real ${annotation ?? "inferred"} module initializer completes its own registered solution and selected execution`, async () => {
  const program = ready(`export function value(): boolean { return true; } export const flag${annotation === null ? "" : `: ${annotation}`} = false;`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.deepEqual(answer.diagnostics, []);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const typed = new Map();
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const elaborate = source => {
    const record = records.get(source.body);
    const result = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(source.owner).generics, body: source, constraints: record.constraints, solution: record.solution,
      template: null, nestedBodies: source.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
    assert.equal(result.kind, "ok");
    typed.set(source.body, result.value);
    return result.value;
  };
  for (const body of program.checked.bodies.filter(body => body.root.kind !== "SourceFile")) elaborate(body);
  const moduleSource = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const moduleBody = elaborate(moduleSource);
  const variable = program.checked.tree.statements.nodes[1].declarationList.declarations.nodes[0];
  const initializer = program.domain.bodyOf.get(variable.tsonic.initializer);
  const template = typed.get(initializer.body);
  const scope = program.descriptions.get(initializer.owner).generics;
  assert.deepEqual(scope, { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const selected = wiring.elaborate.elaborate(deps, { instance: { body: initializer.body, bindings }, scope, body: initializer,
    constraints: records.get(initializer.body).constraints, solution: records.get(initializer.body).solution,
    template, nestedBodies: [], initializers: [] });
  assert.equal(selected.kind, "ok");
  assert.equal(selected.value.root.id, variable.initializer.id);
  assert.equal(selected.value.root.kind, "FalseKeyword");
  assert.equal(types.readSignature(program.interner, selected.value.signature).result, selected.value.completion);
  const assembled = moduleBody.root.statements.nodes[1].declarationList.declarations.nodes[0];
  assert.equal(assembled.initializer === template.root, true);
  assert.equal(assembled.tsonic.initializer, selected.value.body);
  assert.equal(assembled.tsonic.storage, selected.value.completion);
  const selectedBodies = new Map([[initializer.body, selected.value]]);
  for (const source of program.checked.bodies) {
    if (selectedBodies.has(source.body)) continue;
    const actualScope = program.descriptions.get(source.owner).generics;
    assert.deepEqual(actualScope, { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
    const record = records.get(source.body);
    const replay = wiring.elaborate.elaborate(deps, { instance: { body: source.body, bindings }, scope: actualScope, body: source,
      constraints: record.constraints, solution: record.solution, template: typed.get(source.body),
      nestedBodies: source.nestedBodies.map(nested => selectedBodies.get(nested)), initializers: [] });
    assert.equal(replay.kind, "ok");
    selectedBodies.set(source.body, replay.value);
  }
  const selectedModule = selectedBodies.get(moduleSource.body);
  const selectedVariable = selectedModule.root.statements.nodes[1].declarationList.declarations.nodes[0];
  assert.equal(selectedVariable.initializer === selected.value.root, true);
  assert.equal(selectedVariable.tsonic.initializer, selected.value.body);
  assert.equal(types.artifactBindingsKey(selectedModule.bindings), types.artifactBindingsKey(selected.value.bindings));
  const publication = { module: program.checked.module, tree: moduleBody.root, bodies: [...typed.values(), ...selectedBodies.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null
      : types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(bindings) ? selectedBodies.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    bindingScopesOf: target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const source = program.domain.bodyOf.get(target.instance.body);
      const actual = program.descriptions.get(source?.owner)?.generics;
      if (actual === undefined) return null;
      if (source.root.kind === "SourceFile") return [actual, actual, program.descriptions.get(program.checked.tree.statements.nodes[0].tsonic.definition).generics,
        ...(target.instance.bindings.kind === "instantiated" ? [actual] : [])];
      return target.instance.bindings.kind === "parametric" ? [actual] : [actual, actual];
    } };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  assert.deepEqual(tir.verifyTirModule(verifier, publication), []);
  for (const body of publication.bodies) assert.deepEqual(tir.verifyTir(verifier, body), []);
  const lower = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const mir = await import("../../packages/host/dist/ir-mir/index.js");
  const run = { interner: program.interner, table: types.viewTypes(program.interner), selectedNativeFacts: program.snapshot.nativeFacts,
    defs: { completionSelector: types.internType(program.interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: types.internType(program.interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    lowering: { maximumRecords: 100000 }, verification: { maximumWork: 1000000 }, declarationOf: program.declarationOf,
    bodyOwner: body => program.domain.bodyOf.get(body)?.owner ?? null, bodyOf: verifier.bodyOf };
  const loweredBodies = new Map();
  for (const body of selectedBodies.values()) {
    const actualChildren = body.nestedBodies.map(nested => {
      const child = selectedBodies.get(nested);
      assert.equal(child !== undefined, true, "the selected child was genuinely elaborated and verified");
      return { instance: { body: child.body, bindings: child.bindings }, captures: child.captures, signature: child.signature };
    });
    const unit = { request: { query: "mirBody", key: [body.body, types.artifactBindingsData(body.bindings)] }, position: { kind: "result" } };
    const result = wiring.lowerMir.lowerToMir(lower.lowerMirDeps(run, unit), body, actualChildren);
    assert.equal(result.kind, "ok");
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(mir.verifyMir(result.value, lower.mirVerificationContext(run, body)), { kind: "complete", violations: [] });
    assert.deepEqual(mir.parseMir(mir.printMir(result.value)), { kind: "parsed", value: result.value });
    loweredBodies.set(body.body, result.value);
  }
  const moduleMir = loweredBodies.get(moduleSource.body);
  const initializerCalls = moduleMir.blocks.filter(block => block.terminator.kind === "call");
  assert.equal(initializerCalls.length, 1, "the initializer remains one separate executed body");
  assert.deepEqual(initializerCalls[0].terminator.callee, { kind: "body", instance: { body: selected.value.body, bindings }, captures: selected.value.captures });
  assert.equal(moduleMir.places.some(place => place.base.kind === "static" && place.base.definition === initializer.owner), true,
    "module storage belongs to the actual variable definition, not a fabricated local");
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("actual plain local assignment retains the RHS embedding and writable target without a fabricated operator decision", () => {
  const program = ready("export function store(a:boolean,b:boolean):boolean{a=true;return a;}");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const completed = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(completed.kind, "completed");
  assert.equal(completed.diagnostics.length, 0);
  const constraints = completed.value.constraints.constraints.find(candidate => candidate.body === body.body);
  const checked = body.root.statements.nodes[0].expression;
  const flow = constraints.constraints.find(candidate => candidate.kind === "flow" && candidate.role === "assignment");
  assert.equal(flow.occurrence.node, checked.right.id);
  assert.equal(constraints.constraints.some(candidate => candidate.kind === "op" && candidate.occurrence.node === checked.id), false);
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf,
    bindingOf: program.inputs.inference.bindingOf, typeOf: type => fixture.types.readType(program.interner, type),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } }, scope: program.descriptions.get(body.owner).generics,
    body, constraints, solution: completed.value.solution, template: null, nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const actual = result.value.root.statements.nodes[0].expression;
  assert.equal(actual.tsonic.role, "assignment");
  assert.equal(actual.tsonic.calculation, null);
  assert.equal(actual.tsonic.selection, null);
  assert.equal(actual.tsonic.storage, result.value.locals[0].storage);
  assert.equal(actual.left.tsonic.role, "assignment-target");
  assert.equal("type" in actual.left.tsonic, false);
  assert.deepEqual(actual.left.tsonic.access, { kind: "write", storage: actual.tsonic.storage });
  assert.equal(actual.right.tsonic.convertedType, actual.tsonic.storage);
  assert.equal(actual.right.tsonic.conversion.kind, "convert");
  assert.equal(actual.right.tsonic.conversion.role, "assignment");
  const original = checked.left.tsonic;
  const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(pending.kind, "paused");
  const answers = pending.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    return { kind: request.kind, value: answer.value };
  });
  const place = original.place.value;
  const foreign = program.checked.bodies.find(candidate => candidate.body !== body.body).body;
  for (const [changed, expected] of [
    [{ ...original, access: "read-write" }, /plain assignment without its checked local target/u],
    [{ ...original, place: { kind: "unavailable", reason: "not-provided", causes: [] } }, /plain assignment without its checked local target/u],
    [{ ...original, place: { kind: "available", value: { ...place, write: { kind: "available", value: null } } } }, /plain assignment without its checked local target/u],
    ...[{ ...original.resolution.local, body: foreign }, { ...original.resolution.local, local: original.resolution.local.local + 1 }]
      .map(local => [{ ...original, place: { kind: "available", value: { ...place,
        base: { kind: "root", resolution: { kind: "local", local } } } } }, /actual qualified writable storage type/u]),
  ]) {
    checked.left.tsonic = changed;
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /actual qualified writable local storage/u);
    assert.throws(() => wiring.elaborate.elaborate(deps, input), expected);
  }
  checked.left.tsonic = original;
  const binary = checked.tsonic;
  const other = { body: body.body, local: body.params[1].local };
  for (const changed of [
    { ...place, base: { kind: "root", resolution: { kind: "local", local: other } } },
    { ...place, base: { kind: "root", resolution: { kind: "local", local: { ...other, body: foreign } } } },
    { ...place, base: { kind: "place", node: checked.left.id } },
    { ...place, step: { kind: "deref" } },
    { ...place, write: { kind: "available", value: null } },
    { ...place, write: { kind: "available", value: flow.from } },
    { ...place, write: { kind: "unavailable", reason: "not-provided", causes: [] } },
  ]) {
    checked.tsonic = { ...binary, target: { kind: "available", value: changed } };
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /actual writable local assignment target/u);
    assert.throws(() => wiring.elaborate.elaborate(deps, input), /plain assignment without its checked local target/u);
  }
  checked.tsonic = { ...binary, target: structuredClone(binary.target) };
  assert.equal(wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers).value.kind, "ok");
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
  checked.tsonic = binary;
  const generated = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 0 } }, pending.paused, answers);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  assert.equal(generated.value.value.constraints.every(set => set.variables.length === 0), true);
  const retained = generated.value.value.constraints.find(set => set.body === body.body).constraints
    .find(candidate => candidate.kind === "flow" && candidate.role === "assignment");
  assert.deepEqual(retained, flow);
  assert.equal(wiring.elaborate.elaborate(deps, input).kind, "ok");
});

test("throwing an actual string formal retains the value channel without a return flow to never", async () => {
  const program = ready("export function escape(value:string):never{throw value;}");
  const body = program.checked.bodies.find(candidate => candidate.root.kind === "Block");
  const group = program.inputs.groups.find(candidate => candidate.bodies.includes(body.body));
  const completed = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(completed.kind, "completed");
  assert.equal(completed.diagnostics.length, 0);
  const constraints = completed.value.constraints.constraints.find(candidate => candidate.body === body.body);
  assert.deepEqual(constraints.variables, []);
  assert.deepEqual(constraints.constraints, []);
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf,
    bindingOf: program.inputs.inference.bindingOf, typeOf: type => fixture.types.readType(program.interner, type),
    signatureOf: signature => fixture.types.readSignature(program.interner, signature), checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const input = { instance: { body: body.body, bindings: { kind: "parametric" } }, scope: program.descriptions.get(body.owner).generics,
    body, constraints, solution: completed.value.solution, template: null, nestedBodies: [], initializers: [] };
  const result = wiring.elaborate.elaborate(deps, input);
  assert.equal(result.kind, "ok");
  const statement = result.value.root.statements.nodes[0];
  const checked = body.root.statements.nodes[0];
  assert.equal(statement.kind, "ThrowStatement");
  assert.equal(statement.id, checked.id);
  assert.deepEqual(statement.origin, checked.origin);
  assert.equal(statement.tsonic, null);
  assert.equal(statement.expression.id, checked.expression.id);
  assert.deepEqual(statement.expression.tsonic.resolution, { kind: "local", local: result.value.params[0].tsonic.local });
  assert.deepEqual(fixture.types.readType(program.interner, statement.expression.tsonic.type), { kind: "string" });
  assert.equal(statement.expression.tsonic.convertedType, statement.expression.tsonic.type);
  assert.deepEqual(statement.expression.tsonic.conversion, { kind: "identity" });
  assert.deepEqual(fixture.types.readType(program.interner, result.value.completion), { kind: "intrinsic", intrinsic: "never" });
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  assert.equal(isDeepStrictEqual(tir.parseTir(tir.printTir(result.value)), { kind: "parsed", value: result.value }), true);
});

for (const [authored, annotation, kind, expected] of [
  ["true", "boolean", "boolean", true], ["false", "boolean", "boolean", false],
  ['""', "string", "string", ""], ['"a\\nΩ"', "string", "string", "a\nΩ"],
]) test(`real ${authored} return retains its literal type and actual annotation component through semantic rows and TIR`, async () => {
  const program = ready(`export function value(): ${annotation} { return ${authored}; }\n`);
  const { types } = fixture;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const body = program.checked.bodies.find(body => body.root.kind === "Block");
  const owner = program.checked.tree.statements.nodes[0];
  const expression = body.root.statements.nodes[0].expression;
  const record = records.get(body.body);
  const [from, to] = record.constraints.evidence;
  const literal = types.readType(program.interner, from.value.type);
  assert.equal(literal.kind, "literal");
  assert.deepEqual(literal.value, { kind, value: expected });
  assert.equal(literal.base, to.value.type);
  assert.deepEqual(from.value.component, { kind: "body", value: { body: body.body, node: expression.id } });
  assert.deepEqual(to.value.component, { kind: "item", value: { owner: body.owner, node: owner.type.id } });
  assert.equal(program.domain.nodeOf(to.value.component) === owner.type, true);
  const embedding = record.solution.constraints[0].decision.embedding;
  assert.equal(embedding.kind, "conversion");
  assert.equal(embedding.conversion, "literal-fit");
  assert.deepEqual(embedding.proof.steps, [{ from: { root: from.value.component, path: [] },
    to: { root: to.value.component, path: [] }, rule: "literal-fit", premises: [] }]);
  const typed = new Map();
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const elaborate = body => {
    const record = records.get(body.body);
    const result = wiring.elaborate.elaborate(deps, { instance: { body: body.body, bindings: { kind: "parametric" } },
      scope: program.descriptions.get(body.owner).generics, body, constraints: record.constraints, solution: record.solution,
      template: null, nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
    assert.equal(result.kind, "ok");
    typed.set(body.body, result.value);
    return result.value;
  };
  const callable = elaborate(body);
  const moduleBody = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const module = elaborate(moduleBody);
  const selected = callable.root.statements.nodes[0].expression;
  assert.equal(selected.tsonic.type, from.value.type);
  assert.equal(selected.tsonic.convertedType, to.value.type);
  assert.equal(selected.tsonic.conversion.kind, "convert");
  assert.equal(selected.tsonic.conversion.operation.decision.operation.embedding === embedding, true);
  if (kind === "string") assert.equal(selected.tsonic.value, expected);
  const publication = { module: program.checked.module, tree: module.root, bodies: [...typed.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    bindingScopesOf: target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const body = program.domain.bodyOf.get(target.instance.body);
      const scope = program.descriptions.get(body?.owner)?.generics;
      return scope === undefined ? null : body.root.kind === "SourceFile" ? [scope, scope,
        program.descriptions.get(callable.owner).generics] : [scope];
    } };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  assert.deepEqual(tir.verifyTirModule(verifier, publication), []);
  for (const body of typed.values()) assert.deepEqual(tir.verifyTir(verifier, body), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});


for (const [authored, annotation, expected] of [["true", "boolean", true], ["false", "boolean", false],
  ['""', "string", ""], ['"a\\nΩ"', "string", "a\nΩ"], ["null", null, null]])
test(`real ${annotation === null ? "inferred" : "annotated"} ${authored} default completes independently and the selected header reuses its one initializer expression`, async () => {
  const annotationText = annotation === null ? "" : `: ${annotation}`;
  const program = ready(`export function value(input${annotationText} = ${authored})${annotationText} { return input; }\n`);
  const { types } = fixture;
  const declared = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(declared.kind, "completed");
  const parameterType = declared.value.parameters[0].type;
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    assert.equal(answer.value.positions.every(position => position.error === null), true);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const owner = program.checked.tree.statements.nodes[0];
  const parameter = owner.parameters.nodes[0];
  const callableSource = program.checked.bodies.find(body => body.root.kind === "Block");
  const initializerSource = program.domain.bodyOf.get(parameter.tsonic.initializer);
  const initializerRecord = records.get(initializerSource.body);
  if (annotation === null) {
    assert.equal(parameter.type, null);
    assert.equal(initializerRecord.group.signatures.length, 1);
    assert.deepEqual(initializerRecord.group.signatures[0], { definition: callableSource.owner, part: { kind: "parameter-initializer", index: 0 } });
    assert.equal(initializerRecord.solution.variables.length, 1);
    assert.equal(initializerRecord.solution.variables[0].value.type, parameterType);
    assert.equal(initializerRecord.solution.variables[0].error, null);
    assert.deepEqual(types.readType(program.interner, parameterType), { kind: "intrinsic", intrinsic: "absence" });
    assert.equal(initializerRecord.solution.constraints[0].decision.embedding.kind, "identity");
  } else {
    assert.equal(initializerRecord.group.signatures.length, 0, "the explicit annotation has no fabricated inferred part");
    assert.deepEqual(initializerRecord.constraints.evidence[1].value.component,
      { kind: "item", value: { owner: initializerSource.owner, node: parameter.type.id } });
    assert.equal(initializerRecord.solution.variables.length, 0);
    assert.equal(initializerRecord.solution.constraints[0].decision.embedding.conversion, "literal-fit");
  }
  const typed = new Map();
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = body => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, constraints: records.get(body.body).constraints,
    solution: records.get(body.body).solution, template: null,
    nestedBodies: body.nestedBodies.map(nested => typed.get(nested)),
    initializers: body.params.filter(parameter => parameter.initializer !== null).map(parameter => typed.get(parameter.initializer)) });
  const elaborate = body => {
    const result = wiring.elaborate.elaborate(deps, inputOf(body));
    assert.equal(result.kind, "ok");
    typed.set(body.body, result.value);
    return result.value;
  };
  if (annotation === null) {
    const input = inputOf(initializerSource);
    const variable = input.constraints.variables[0];
    for (const signature of [
      { ...variable.signature, part: { kind: "parameter-initializer", index: 1 } },
      { definition: initializerSource.owner, part: { kind: "return" } },
    ]) assert.throws(() => wiring.elaborate.elaborate(deps, { ...input,
      constraints: { ...input.constraints, variables: [{ ...variable, signature }] } }), /inferred/u);
  }
  const initializer = elaborate(initializerSource);
  assert.equal(initializer.root.id, parameter.initializer.id);
  assert.equal(initializer.root.tsonic.convertedType, parameterType);
  assert.equal(types.readSignature(program.interner, initializer.signature).declaration, null);
  assert.equal(initializer.completion, parameterType);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [] }), /exactly the actual selected/u);
  for (const wrong of [{ ...initializer, owner: callableSource.owner },
    { ...initializer, completion: types.internType(program.interner, { kind: "intrinsic", intrinsic: "never" }) },
    { ...initializer, root: { ...initializer.root, id: callableSource.root.id } }])
    assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [wrong] }), /checked owner, expression and selected result/u);
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...inputOf(callableSource), initializers: [initializer, initializer] }), /unique completed body/u);
  const callable = elaborate(callableSource);
  assert.equal(callable.params[0].initializer === initializer.root, true, "one initializer syntax node, never callable replay");
  assert.equal(callable.params[0].tsonic.initializer, initializer.body);
  assert.equal(callable.params[0].tsonic.role, "default");
  assert.equal("acceptsOmission" in callable.params[0].tsonic, false);
  const signature = types.readSignature(program.interner, callable.signature);
  assert.equal(signature.parameters[0].acceptsOmission, true);
  assert.equal(signature.parameters[0].initializer, initializer.body);
  const outer = elaborate(program.checked.bodies.find(body => body.root.kind === "SourceFile"));
  assert.equal(outer.root.statements.nodes[0].parameters.nodes[0] === callable.params[0], true);
  if (annotation === "string") assert.equal(initializer.root.tsonic.value, expected);
  const publication = { module: program.checked.module, tree: outer.root, bodies: [...typed.values()] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    bindingScopesOf: target => {
      if (target.kind === "module") return target.module === program.checked.module ? [] : null;
      const body = program.domain.bodyOf.get(target.instance.body);
      const scope = program.descriptions.get(body?.owner)?.generics;
      return scope === undefined ? null : body.root.kind === "SourceFile" ? [scope, scope,
        program.descriptions.get(callable.owner).generics] : [scope];
    } };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  assert.deepEqual(tir.verifyTirModule(verifier, publication), []);
  for (const body of typed.values()) assert.deepEqual(tir.verifyTir(verifier, body), []);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  for (const body of [initializerSource, callableSource]) {
    const scope = program.descriptions.get(body.owner).generics;
    assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length], [0, 0, 0, 0]);
  }
  const select = (body, initializers) => {
    const selected = wiring.elaborate.elaborate(deps, { ...inputOf(body),
      instance: { body: body.body, bindings }, template: typed.get(body.body), initializers });
    assert.equal(selected.kind, "ok");
    return selected.value;
  };
  const selectedInitializer = select(initializerSource, []);
  assert.equal(selectedInitializer.root === initializer.root, false, "selected default replays its own checked input, not the callable syntax");
  assert.throws(() => select(callableSource, [initializer]), /same actual bindings/u);
  const selectedCallable = select(callableSource, [selectedInitializer]);
  assert.equal(selectedCallable.params[0].initializer === selectedInitializer.root, true);
  const selectedPublication = { ...publication, bodies: [...publication.bodies, selectedInitializer, selectedCallable] };
  const selectedVerifier = { ...verifier, module: selectedPublication,
    bodyOf: instance => instance.bindings.kind === "parametric" ? verifier.bodyOf(instance)
      : types.artifactBindingsKey(instance.bindings) !== types.artifactBindingsKey(bindings) ? null
      : instance.body === selectedInitializer.body ? selectedInitializer : instance.body === selectedCallable.body ? selectedCallable : null,
    bindingScopesOf: target => target.kind === "body" && target.instance.bindings.kind === "instantiated"
      ? [program.descriptions.get(program.domain.bodyOf.get(target.instance.body).owner).generics,
        program.descriptions.get(program.domain.bodyOf.get(target.instance.body).owner).generics] : verifier.bindingScopesOf(target) };
  assert.deepEqual(tir.verifyTirModule(selectedVerifier, selectedPublication), []);
  assert.deepEqual(tir.verifyTir(selectedVerifier, selectedInitializer), []);
  assert.deepEqual(tir.verifyTir(selectedVerifier, selectedCallable), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("an actual null return completes its inferred declaration and selected body with the one native absence type", async () => {
  const program = ready("export function absent() { return (null); }\n");
  const { types } = fixture;
  const declared = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(declared.kind, "completed");
  assert.deepEqual(types.readType(program.interner, declared.value.result), { kind: "intrinsic", intrinsic: "absence" });
  assert.equal(declared.diagnostics.length, 0);
  const records = new Map();
  for (const group of program.inputs.groups) {
    const answer = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(answer.kind, "completed");
    assert.equal(answer.diagnostics.length, 0);
    assert.equal(answer.value.positions.every(position => position.error === null), true);
    for (const set of answer.value.constraints.constraints) records.set(set.body, { ...answer.value, constraints: set });
  }
  const typed = new Map();
  const deps = { types: program.interner, rules: program.inputs.inference.rules, nodeOf: program.domain.nodeOf, bindingOf: program.inputs.inference.bindingOf,
    typeOf: type => types.readType(program.interner, type), signatureOf: signature => types.readSignature(program.interner, signature),
    checkerDiagnosticsOf: () => program.checked.checkerDiagnostics };
  const inputOf = body => ({ instance: { body: body.body, bindings: { kind: "parametric" } },
    scope: program.descriptions.get(body.owner).generics, body, constraints: records.get(body.body).constraints,
    solution: records.get(body.body).solution, template: null,
    nestedBodies: body.nestedBodies.map(nested => typed.get(nested)), initializers: [] });
  const callableSource = program.checked.bodies.find(body => body.root.kind === "Block");
  const moduleSource = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  const original = inputOf(callableSource);
  const variable = original.constraints.variables.find(variable => variable.kind === "signature");
  assert.equal(variable.signature.part.kind, "return");
  for (const changed of [
    { ...original, constraints: { ...original.constraints, variables: [{ ...variable,
      signature: { ...variable.signature, definition: moduleSource.owner } }] } },
    { ...original, constraints: { ...original.constraints, variables: [{ ...variable,
      signature: { ...variable.signature, part: { kind: "yield" } } }] } },
    { ...original, constraints: { ...original.constraints, variables: [{ ...variable,
      occurrence: { ...variable.occurrence, node: callableSource.root.statements.nodes[0].id } }] } },
    { ...original, solution: { ...original.solution, variables: [] } },
  ]) assert.throws(() => wiring.elaborate.elaborate(deps, changed), /inferred|unfinalized/u);
  const foreign = types.internType(program.interner, { kind: "open", group: records.get(moduleSource.body).group.id, variable: variable.id });
  assert.throws(() => wiring.elaborate.elaborate(deps, { ...original, constraints: { ...original.constraints,
    constraints: original.constraints.constraints.map(constraint => ({ ...constraint, to: foreign })) } }), /another group/u);
  for (const body of [callableSource, moduleSource]) {
    const answer = wiring.elaborate.elaborate(deps, inputOf(body));
    assert.equal(answer.kind, "ok");
    typed.set(body.body, answer.value);
  }
  const callable = typed.get(callableSource.body);
  assert.equal(callable.completion, declared.value.result);
  const returned = callable.root.statements.nodes[0].expression;
  assert.equal(returned.expression.kind, "NullKeyword");
  assert.equal(returned.expression.tsonic.type, declared.value.result);
  assert.equal(returned.expression.tsonic.convertedType, declared.value.result);
  const scope = program.descriptions.get(callable.owner).generics;
  assert.deepEqual([scope.classParameters, scope.methodParameters, scope.capturedParameters, scope.selfOwners], [[], [], [], []]);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const selected = wiring.elaborate.elaborate(deps, { ...inputOf(callableSource),
    instance: { body: callable.body, bindings }, template: callable });
  assert.equal(selected.kind, "ok");
  const publication = { module: program.checked.module, tree: typed.get(moduleSource.body).root,
    bodies: [...typed.values(), selected.value] };
  const verifier = { source: program.checked, module: publication, types: types.viewTypes(program.interner),
    declarationOf: program.declarationOf, memberTableOf: () => null, nominalOf: () => null,
    bodyOf: instance => instance.bindings.kind === "parametric" ? typed.get(instance.body) ?? null
      : instance.body === callable.body && types.artifactBindingsKey(instance.bindings) === types.artifactBindingsKey(bindings) ? selected.value : null,
    nodeOf: program.domain.nodeOf, localExists: program.domain.localExists, diagnostics: program.checked.checkerDiagnostics,
    bindingScopesOf: target => target.kind === "module" ? target.module === program.checked.module ? [] : null
      : target.instance.body === callable.body ? target.instance.bindings.kind === "parametric" ? [scope] : [scope, scope]
      : target.instance.body === moduleSource.body && target.instance.bindings.kind === "parametric"
        ? [program.descriptions.get(moduleSource.owner).generics, program.descriptions.get(moduleSource.owner).generics, scope] : null };
  const tir = await import("../../packages/host/dist/ir-tir/index.js");
  assert.deepEqual(tir.verifyTirModule(verifier, publication), []);
  for (const body of publication.bodies) assert.deepEqual(tir.verifyTir(verifier, body), []);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("the production checked namespace retains exact body/item membership and declaration sources without global-node fallback", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const views = checkedInputs.checkedSourceViews(program.inputs.declarations.modules);
  const module = program.checked;
  const body = module.bodies.find(body => body.root.kind === "Block");
  const outer = module.bodies.find(body => body.root.kind === "SourceFile");
  const definition = views.declarationSourceOf(body.owner);
  assert.equal(definition.kind, "item");
  assert.equal(definition.value.owner, body.owner);
  assert.equal(views.nodeOf(definition) === module.tree.statements.nodes[0], true);
  assert.equal(views.bodies.get(body.body) === body, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: body.root.id } }) === body.root, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: outer.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: outer.body, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: outer.owner, node: definition.value.node } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: "missing", node: body.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: "missing", node: definition.value.node } }), null);
  assert.equal(views.declarationSourceOf("missing"), null);
  assert.equal(views.localExists({ body: body.body, local: body.params[0].local }), true);
  assert.equal(views.localExists({ body: outer.body, local: body.params[0].local }), false);
  for (const local of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.localExists({ body: body.body, local }), false);
  for (const node of [-1, -0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node } }), null);
  for (const [index, actual] of body.locals.entries())
    assert.equal(views.localExists({ body: body.body, local: index }), actual.id === index);
  const parameter = module.tree.statements.nodes[0].parameters.nodes[0];
  const parameterSource = views.declarationSourceOf(module.items.find(item => item.node === parameter.id).definition);
  assert.equal(views.nodeOf(parameterSource) === parameter, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: parameter.id } }) === parameter, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: outer.body, node: parameter.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: parameter.name.id } }) === parameter.name, true);
  assert.equal(views.nodeOf({ kind: "item", value: { owner: body.owner, node: parameter.id } }), null);
});

test("checked execution headers retain their genuine body/item join without absorbing the separately placed default", () => {
  const program = ready("export function value(argument: boolean = true): boolean { return argument; }\n");
  const modules = program.inputs.declarations.modules;
  const module = program.checked;
  const callable = module.tree.statements.nodes[0];
  const header = callable.parameters.nodes[0];
  const body = module.bodies.find(body => body.body === callable.tsonic.body);
  const child = module.bodies.find(body => body.body === header.tsonic.initializer);
  const views = checkedInputs.checkedSourceViews(modules);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: header.id } }) === header, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: child.body, node: child.root.id } }) === child.root, true);
  assert.equal(views.nodeOf({ kind: "body", value: { body: body.body, node: child.root.id } }), null);
  assert.equal(views.nodeOf({ kind: "body", value: { body: child.body, node: header.id } }), null);
  const local = body.locals[body.params[0].local];
  assert.equal(local.declaration.kind, "item");
  assert.equal(views.nodeOf(local.declaration) === header, true);
  for (const changes of [{ role: "binding" }, { declaration: { kind: "item", value: { owner: body.owner, node: header.id } } },
    { declaration: { kind: "item", value: { owner: local.declaration.value.owner, node: child.root.id } } }]) {
    const changed = { ...body, locals: body.locals.map(row => row === local ? { ...row, ...changes } : row) };
    assert.throws(() => checkedInputs.checkedSourceViews(modules.map(entry => ({ ...entry, module: { ...entry.module,
      bodies: entry.module.bodies.map(row => row === body ? changed : row) } }))), /checked parameter domain/u);
  }
});

test("the checked namespace rejects duplicated identities and foreign/extra syntax rows rather than publishing a partial source view", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const module = program.inputs.declarations.modules[0];
  assert.throws(() => checkedInputs.checkedSourceViews([module, module]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, bodies: [...module.module.bodies, module.module.bodies[0]] } }]), /unique body identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module,
    module: { ...module.module, items: [...module.module.items, module.module.items[0]] } }]), /unique identities/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: [...module.nodes, module.nodes[0]] }]), /outside its actual tree/u);
  assert.throws(() => checkedInputs.checkedSourceViews([{ ...module, nodes: module.nodes.map((node, index) => index === 0 ? { ...node } : node) }]), /actual dense canonical/u);
});

test("the actual annotated declaration row retains its typed request and a verified whole-group solution uses unmemoised placement", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const signature = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(signature.kind, "completed");
  assert.equal(signature.diagnostics.length, 0);
  const scope = program.descriptions.get(program.signature.definition).generics;
  assert.deepEqual([scope.classParameters.length, scope.methodParameters.length, scope.capturedParameters.length, scope.selfOwners.length], [0, 0, 0, 0]);
  for (const group of program.inputs.groups) {
    const outcome = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(outcome.kind, "completed");
    assert.equal(outcome.value.group === group, true);
    assert.equal(outcome.value.constraints.constraints.length, group.bodies.length);
    assert.equal(outcome.value.positions.every(position => position.error === null), true);
    assert.equal(program.database.errorOf({ request: { query: program.queries.solutionOf.name, key: group.id },
      position: { kind: "result" } }).kind, "completed");
  }
  const cached = program.database.run(program.queries.declaredSignatureOf, { ...program.signature });
  assert.equal(cached.kind, "completed");
  assert.equal(cached.value === signature.value, true);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.deepEqual(program.database.stats().map(stat => stat.name).sort(), ["declaredSignatureOf", "solutionOf"]);
});

test("a real omitted return demands its one canonical group and projects its actual verified completed variable", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.result), { kind: "primitive", primitive: "float64" });
  const group = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const solved = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(solved.kind, "completed");
  const part = group.signatures.find(part => part.part.kind === "return");
  const unit = { query: program.queries.solutionOf.name, key: group.id };
  const projected = inferenceStep.projectInferredPart(unit, solved.value, { kind: "inferred-part", part }, program.database.errorOf);
  assert.equal(projected.type, outcome.value.result);
  assert.equal(projected.error, null);
  assert.deepEqual(projected.origin, { request: unit, position: { kind: "inference-variable", group: group.id, variable: 0 } });
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.from?.query === "solutionOf"
    && event.to.query === "declaredSignatureOf" && event.to.encodedKey === fixture.ids.encodeKey(fixture.types.signatureRequestData(program.signature))), false,
    "the current group never requests its own completed declaration");
});

test("real select default G1 completes before G2 and both declaration slots use the same projected origins", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const outcome = program.database.run(program.queries.declaredSignatureOf, program.signature);
  assert.equal(outcome.kind, "completed");
  assert.deepEqual(fixture.types.readType(program.interner, outcome.value.parameters[1].type), { kind: "primitive", primitive: "float64" });
  assert.equal(outcome.value.parameters[1].type, outcome.value.result);
  const initializer = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "parameter-initializer"));
  const returned = program.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const completions = program.database.trace().filter(event => event.kind === "completion" && event.fact.query === "solutionOf");
  assert.equal(completions.findIndex(event => event.fact.key === initializer.id) < completions.findIndex(event => event.fact.key === returned.id), true);
  for (const group of [initializer, returned]) {
    const solved = program.database.run(program.queries.solutionOf, group.id);
    assert.equal(solved.kind, "completed");
    for (const part of group.signatures) {
      const answer = inferenceStep.projectInferredPart({ query: "solutionOf", key: group.id }, solved.value,
        { kind: "inferred-part", part }, program.database.errorOf);
      assert.equal(answer.error, null);
      assert.equal(program.database.errorOf(answer.origin).kind, "completed");
    }
  }
  assert.equal(program.database.stats().find(stat => stat.name === "solutionOf").computed, 2);
  assert.equal(program.database.trace().some(event => event.kind === "dependency" && event.state === "active"), false);
});

test("ready annotated recursive endpoints do not turn declared recursion into an active complete-key cycle", () => {
  const program = ready("export function first(value: number): number { return second(value); }\nfunction second(value: number): number { return first(value); }\n");
  for (const node of program.checked.tree.statements.nodes) {
    const endpoint = node.tsonic.signatures.find(endpoint => endpoint.role === "api-body");
    const result = program.database.run(program.queries.declaredSignatureOf, { definition: endpoint.declaration,
      endpoint: endpoint.role, ordinal: 0, bindings: { kind: "parametric" } });
    assert.equal(result.kind, "completed");
    assert.equal(result.diagnostics.length, 0);
  }
  assert.equal(program.database.trace().filter(event => event.kind === "dependency" && event.from !== null).length, 0);
});

test("unknown partition ownership and malformed projection inputs never become a known-null part", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const group = program.inputs.groups.find(group => group.signatures.length !== 0);
  const outcome = program.database.run(program.queries.solutionOf, group.id);
  assert.equal(outcome.kind, "completed");
  const request = { kind: "inferred-part", part: group.signatures[0] };
  const unit = { query: "solutionOf", key: group.id };
  assert.throws(() => inferenceStep.projectInferredPart({ ...unit, key: "another-group" }, outcome.value, request, program.database.errorOf), /actual completed solution group/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value,
    { ...request, part: { ...request.part, part: { kind: "yield" } } }, program.database.errorOf), /actual owned signature variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "uncomputed" })), /verified completed variable/u);
  assert.throws(() => inferenceStep.projectInferredPart(unit, outcome.value, request, () => ({ kind: "completed", error: { kind: "error", causes: [] } })), /original finalized error/u);
  assert.throws(() => program.database.run(program.queries.solutionOf, "unknown-group"), /absent from the ready checked partition/u);
  assert.throws(() => registration.createSourceSemanticQueries({ ...program.inputs, groups: [...program.inputs.groups, group] }), /each nonempty group once/u);
  assert.throws(() => registration.createSourceSemanticQueries({ ...program.inputs,
    groups: program.inputs.groups.map(candidate => candidate === group ? { ...candidate, bodies: [] } : candidate) }), /each nonempty group once/u);
});

test("the actual solution resource refusal retains its original diagnostic without a completed partial answer", () => {
  const program = ready("export function add(a: number, b: number) { return a + b; }\n");
  const inputs = { ...program.inputs, inference: { ...program.inputs.inference,
    limits: { ...LIMITS, maximumVariablesPerGroup: 0 } } };
  const queries = registration.createSourceSemanticQueries(inputs);
  const database = query.createDatabase(inputs, { maximumRecords: 65536 }, () => assert.fail("no cycle in this refusal case"), "recorded");
  const group = inputs.groups.find(group => group.signatures.length !== 0);
  const result = database.run(queries.solutionOf, group.id);
  assert.equal(result.kind, "refused");
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(database.errorOf({ request: { query: queries.solutionOf.name, key: group.id }, position: { kind: "result" } }).kind, "refused");
  assert.equal(database.trace().some(event => event.kind === "completion" && event.outcome === "ok"), false);
  assert.equal(database.diagnostics()[0] === result.diagnostics[0], true);
});

test("actual demand witnesses retain checked source and borrow the real pause prefix only while unresolved", () => {
  const program = ready("export function select(a: number, b = a) { return b; }\n");
  const observe = (program, registered, key, samples) => {
    const data = registered.keyData(key);
    const context = { inputs: program.inputs, fact: { query: registered.name, key: data, encodedKey: fixture.ids.encodeKey(data) },
      errorOf: program.database.errorOf,
      get: (dependency, request, pending, resume) => ({ kind: "dependency",
        schedule: scheduler => scheduler.request(dependency, request, pending, resume) }) };
    let step = registered.compute(context, key);
    while (step.kind === "dependency") {
      let next;
      step.schedule({ request: (dependency, key, pending, resume) => {
        const witness = pending.witness;
        samples.push({ kind: witness.kind, source: witness.source, count: witness.ready.length,
          original: witness.kind === "declared-signature" ? witness.state.request : null,
          target: witness.target.kind });
        const actual = program.database.run(dependency, key);
        assert.equal(actual.kind, "completed");
        next = resume(actual.value);
      } });
      assert.equal(next !== undefined, true);
      step = next;
    }
    return step;
  };
  const signatures = [];
  const result = observe(program, program.queries.declaredSignatureOf, program.signature, signatures);
  assert.equal(result.kind, "ok");
  assert.deepEqual(signatures.map(sample => sample.count), [0, 1]);
  const source = program.domain.declarationSourceOf(program.signature.definition);
  assert.equal(signatures.every(sample => sample.original === program.signature), true);
  for (const sample of signatures) {
    assert.deepEqual(sample.source, source);
    assert.equal(sample.target, "inference-solution");
    assert.equal(program.domain.nodeOf(sample.source) !== null, true);
  }
  const other = ready("export function select(a: number, b = a) { return b; }\n");
  const group = other.inputs.groups.find(group => group.signatures.some(part => part.part.kind === "return"));
  const inference = [];
  assert.equal(observe(other, other.queries.solutionOf, group.id, inference).kind, "ok");
  assert.equal(inference.length, 1);
  assert.equal(inference[0].kind, "inference");
  assert.equal(inference[0].source.kind, "body");
  assert.equal(inference[0].source.value.body, group.bodies[0]);
  assert.equal(inference[0].source.value.node, other.domain.bodyOf.get(group.bodies[0]).root.id);
  assert.equal(inference[0].count, 0);
});

test("actual selected member constraints retain their checked origins and distinct receiver and open result evidence", async () => {
  const program = ready("export function read(box:Box):boolean{return box.flag;}export type Box={flag:boolean};\n");
  const source = program.checked.bodies.find(body => body.root.kind === "Block");
  const access = source.root.statements.nodes[0].expression;
  const group = program.inputs.groups.find(group => group.bodies.includes(source.body));
  const pending = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(pending.kind, "paused");
  const answers = pending.requests.map(request => {
    assert.equal(request.kind, "declaredSignatureOf");
    const answer = program.database.run(program.queries.declaredSignatureOf, request.request);
    assert.equal(answer.kind, "completed");
    assert.deepEqual(answer.diagnostics, []);
    return { kind: request.kind, value: answer.value };
  });
  const generated = wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers);
  assert.equal(generated.kind, "done");
  assert.equal(generated.value.kind, "ok");
  const set = generated.value.value.constraints.find(set => set.body === source.body);
  const member = set.constraints.find(constraint => constraint.kind === "member");
  assert.equal(member !== undefined, true);
  assert.deepEqual(member.occurrence, { body: source.body, node: access.id });
  assert.equal(member.key, access.name.tsonic.key.value);
  assert.equal(member.origins, access.tsonic.origins.value);
  assert.equal(member.access, "read");
  assert.equal(fixture.types.readType(program.interner, member.receiver).kind, "shape");
  const result = fixture.types.readType(program.interner, member.result);
  assert.equal(result.kind, "open");
  assert.equal(result.group, group.id);
  assert.deepEqual(set.variables.find(variable => variable.id === result.variable), {
    kind: "local", local: null, id: result.variable, occurrence: member.occurrence,
  });
  assert.deepEqual(set.evidence.slice(0, 2).map(evidence => ({ type: evidence.value.type, component: evidence.value.component,
    category: evidence.value.category, error: evidence.error })), [
    { type: member.receiver, component: { kind: "body", value: { body: source.body, node: access.expression.id } },
      category: { kind: "dynamic" }, error: null },
    { type: member.result, component: { kind: "body", value: member.occurrence }, category: { kind: "dynamic" }, error: null },
  ]);
  assert.equal(set.constraints.find(constraint => constraint.kind === "flow").from, member.result);
  const inferIr = await import("../../packages/host/dist/ir-infer/index.js");
  assert.deepEqual(inferIr.parseConstraints(inferIr.printConstraints(set)), { kind: "parsed", value: set });
  const verification = program.verification(group, generated.value.value);
  assert.deepEqual(inferIr.verifyInference({ ...verification, group, constraints: generated.value.value.constraints,
    contributions: [], solution: null, bindingScopes: set.constraints.filter(constraint => constraint.kind === "flow" || constraint.kind === "member")
      .map(() => program.descriptions.get(source.owner).generics) }), []);
  const checkedOrigins = access.tsonic.origins;
  const checkedKey = access.name.tsonic.key;
  for (const change of ["origins", "key"]) {
    if (change === "origins") access.tsonic.origins = { kind: "unavailable", reason: "not-provided", causes: [] };
    else access.name.tsonic.key = { kind: "unavailable", reason: "incomplete-association", causes: [] };
    assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference, pending.paused, answers),
      /the actual checked member key and declaration origins/u);
    access.tsonic.origins = checkedOrigins;
    access.name.tsonic.key = checkedKey;
  }
  const expression = Object.getOwnPropertyDescriptor(access, "expression");
  Object.defineProperty(access, "expression", { configurable: true, get: () => assert.fail("a refused member allocation cannot enter its receiver") });
  const refused = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 0 } }, pending.paused, answers);
  assert.equal(refused.kind, "done");
  assert.equal(refused.value.kind, "refused");
  assert.equal(refused.value.diagnostics.length, 1);
  assert.equal(refused.value.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  Object.defineProperty(access, "expression", expression);
  const exact = wiring.infer.resumeConstraintsOf({ ...program.inputs.inference,
    limits: { ...program.inputs.inference.limits, maximumVariablesPerGroup: 1 } }, pending.paused, answers);
  assert.equal(exact.kind, "done");
  assert.equal(exact.value.kind, "ok");
  assert.deepEqual(exact.value.value.constraints, generated.value.value.constraints);
});

test("constraint pauses retain every actual request body and reject removed or foreign ownership metadata", () => {
  const program = ready("export function add(a: number, b: number): number { return a + b; }\n");
  const group = program.inputs.groups.find(group => program.domain.bodyOf.get(group.bodies[0]).root.kind === "Block");
  const generation = wiring.infer.constraintsOf(program.inputs.inference, group);
  assert.equal(generation.kind, "paused");
  assert.equal("signatureBodies" in generation.paused, false);
  assert.deepEqual(generation.paused.requestBodies, group.bodies);
  const signature = program.database.run(program.queries.declaredSignatureOf, generation.requests[0].request);
  assert.equal(signature.kind, "completed");
  const answers = [{ kind: "declaredSignatureOf", value: signature.value }];
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [] }, answers), /every pending semantic request/u);
  const module = program.checked.bodies.find(body => body.root.kind === "SourceFile");
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requestBodies: [module.body] }, answers), /outside its actual group/u);
  assert.throws(() => wiring.infer.resumeConstraintsOf(program.inputs.inference,
    { ...generation.paused, requests: [...generation.requests, ...generation.requests], requestBodies: [...group.bodies, ...group.bodies] },
    [...answers, ...answers]), /a complete signature request was repeated in one pause/u);
  assert.equal(wiring.infer.resumeConstraintsOf(program.inputs.inference, generation.paused, answers).value.kind, "ok");
});
