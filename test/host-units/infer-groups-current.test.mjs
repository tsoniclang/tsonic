import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { startInferCoverage } from "./infer-coverage-gate.mjs";

let fixture;
let infer;
let finishCoverage;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  finishCoverage = await startInferCoverage(["groups.js"], "groups-current");
  fixture = await loadFrontFixture();
  infer = await import("../../packages/host/dist/infer/index.js");
});

after(async () => { await finishCoverage(); });

const AMPLE = { maximumWork: 1000000, maximumResultEntries: 1000000 };
const PAIR = "export function left(x: number): number { return right(x); }\nexport function right(x: number): number { return left(x); }\n";

function input(source = PAIR) {
  const { checked, interner } = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(checked, interner), [], "the actual Front source passes HIR before the grouping cases");
  const nodes = fixture.hir.indexSyntaxTree(checked.tree);
  const items = new Map(checked.items.map(item => [item.definition, nodes[item.node]]));
  items.set(checked.tree.tsonic.definition, checked.tree);
  const bodies = new Map(checked.bodies.map(body => [body.body, body]));
  return { checked, modules: [checked], interner, nodes, items, bodies };
}

function deps(program, graph = AMPLE) {
  return { hirBody: body => program.bodies.get(body) ?? assert.fail("a genuine body must be in the ready inventory"),
    itemOf: definition => program.items.get(definition) ?? assert.fail("a genuine owner must be in the ready inventory"),
    bindings: program.modules.map(module => module.bindings), graph };
}

function run(program, graph = AMPLE, order = [...program.bodies.keys()]) {
  return infer.groupsOf(deps(program, graph), order);
}

function functions(program) {
  return program.checked.tree.statements.nodes.filter(node => node.kind === "FunctionDeclaration");
}

test("actual annotated mutual recursion has one ready group per body, with no provisional inferred parts", () => {
  const program = input();
  const result = run(program);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.value.map(group => group.bodies), [...program.bodies.keys()].sort().map(body => [body]));
  assert.equal(result.value.every(group => group.signatures.length === 0), true);
  assert.deepEqual(run(program, AMPLE, [...program.bodies.keys()].reverse()), result);
});

test("inferred-part unit inventory closes mutual dependency before any declared-signature computation", () => {
  const program = input();
  for (const fn of functions(program)) fn.type = null;
  const result = run(program);
  assert.equal(result.kind, "ok");
  const recursive = result.value.find(group => group.bodies.length === 2);
  assert.equal(recursive !== undefined, true);
  assert.deepEqual(recursive.signatures.map(part => part.definition).sort(), functions(program).map(fn => fn.tsonic.definition).sort());
  assert.equal(recursive.signatures.every(part => part.part.kind === "return"), true);
});

test("one inferred return is solved before its annotated reader, without merging the annotated pair", () => {
  const program = input();
  const [left, right] = functions(program);
  left.type = null;
  const result = run(program);
  assert.equal(result.kind, "ok");
  const leftBody = [...program.bodies.values()].find(body => body.owner === left.tsonic.definition).body;
  const rightBody = [...program.bodies.values()].find(body => body.owner === right.tsonic.definition).body;
  assert.equal(result.value.findIndex(group => group.bodies.includes(leftBody)) < result.value.findIndex(group => group.bodies.includes(rightBody)), true);
  assert.equal(result.value.every(group => group.bodies.length === 1), true);
});

test("multiple inferred dependencies precede their actual reader in a stable condensation order", () => {
  const program = input("export function total(x: number): number { return first(x) + second(x); }\nexport function first(x: number): number { return x; }\nexport function second(x: number): number { return x; }\n");
  const [reader, ...dependencies] = functions(program);
  for (const dependency of dependencies) dependency.type = null;
  const result = run(program);
  assert.equal(result.kind, "ok");
  const ownerGroup = definition => result.value.findIndex(group => group.bodies.some(body => program.bodies.get(body).owner === definition));
  for (const dependency of dependencies) assert.equal(ownerGroup(dependency.tsonic.definition) < ownerGroup(reader.tsonic.definition), true);
  assert.deepEqual(run(program, AMPLE, [...program.bodies.keys()].reverse()), result);
});

test("real lexical named function declarations co-group with their actual enclosing callable even with no captures", () => {
  const program = input("export function outer(x: number): number { function inner(y: number): number { return y; } return x; }\n");
  const result = run(program);
  assert.equal(result.kind, "ok");
  const callable = result.value.find(group => group.bodies.length === 2);
  assert.equal(callable !== undefined, true);
  assert.equal(callable.bodies.every(body => program.bodies.get(body).captures.length === 0), true);
});

test("real default-argument inferred part belongs to its genuine initializer execution, not a fabricated signature body", () => {
  const program = input("export function outer(x: number, value = x): number { return value; }\n");
  const owner = functions(program)[0];
  const body = [...program.bodies.values()].find(body => body.owner === owner.tsonic.definition);
  const initializer = body.params.find(parameter => parameter.initializer !== null).initializer;
  const result = run(program);
  assert.equal(result.kind, "ok");
  const group = result.value.find(group => group.bodies.includes(initializer));
  assert.deepEqual(group.signatures, [{ definition: owner.tsonic.definition, part: { kind: "parameter-initializer", index: 1 } }]);
  assert.equal(result.value.indexOf(group) < result.value.findIndex(candidate => candidate.bodies.includes(body.body)), true);
});

test("group graph work and result refusal retain the original maximum and never return partial groups", () => {
  const program = input();
  const empty = infer.groupsOf({ ...deps(program), hirBody: () => assert.fail("empty inventory reads no body") }, []);
  assert.deepEqual(empty, { kind: "ok", value: [], diagnostics: [] });
  for (const maximum of [0, 1, 2, 4, 10, 32, 64]) {
    const result = run(program, { ...AMPLE, maximumWork: maximum });
    assert.equal(result.kind, "refused", `work ${maximum}`);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.equal(result.diagnostics[0].arguments.some(argument => argument.kind === "number" && argument.value === maximum), true);
  }
  const records = run(program, { ...AMPLE, maximumResultEntries: 0 });
  assert.equal(records.kind, "refused");
  assert.equal(records.diagnostics[0].evidence.includes("partition graph result-entries"), true);
  let low = 0;
  let high = 1024;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (run(program, { ...AMPLE, maximumWork: middle }).kind === "ok") high = middle;
    else low = middle;
  }
  assert.equal(run(program, { ...AMPLE, maximumWork: high }).kind, "ok");
  assert.equal(run(program, { ...AMPLE, maximumWork: high - 1 }).kind, "refused");
});

test("malformed grouping inputs are caller defects, not semantic source errors or invented groups", () => {
  const program = input();
  const keys = [...program.bodies.keys()];
  for (const maximumWork of [-1, Infinity, 0.5]) assert.throws(() => run(program, { ...AMPLE, maximumWork }), /maximumWork must be a nonnegative safe integer/);
  assert.throws(() => infer.groupsOf(deps(program), [keys[0], keys[0]]), /twice/);
  assert.throws(() => infer.groupsOf({ ...deps(program), hirBody: () => ({ ...program.bodies.get(keys[0]), body: keys[1] }) }, [keys[0]]), /another body's/);
  const wrongOwner = { ...program.bodies.get(keys[0]), owner: functions(program)[1].tsonic.definition };
  assert.throws(() => infer.groupsOf({ ...deps(program), hirBody: () => wrongOwner }, [keys[0]]), /checked owner/);
  const module = program.bodies.get(keys.find(body => program.bodies.get(body).root.kind === "SourceFile"));
  assert.throws(() => infer.groupsOf(deps(program), [module.body]), /outside/);
  const repeated = structuredClone(program);
  const repeatedModule = repeated.bodies.get(module.body);
  repeatedModule.nestedBodies.push(repeatedModule.nestedBodies[0]);
  assert.throws(() => run(repeated), /unique enclosing/);
});

test("default parts preserve actual ready metadata and reject missing or foreign initializer producers", () => {
  const program = input("export function outer(x: number, value = x): number { return value; }\n");
  const owner = functions(program)[0];
  const callable = [...program.bodies.values()].find(body => body.owner === owner.tsonic.definition);
  for (const params of [[], callable.params.map(parameter => ({ ...parameter, initializer: null }))]) {
    const changed = structuredClone(program);
    changed.bodies.get(callable.body).params = params;
    assert.throws(() => run(changed), /actual initializer execution/);
  }
  const changed = structuredClone(program);
  const missing = callable.params.find(parameter => parameter.initializer !== null).initializer;
  changed.bodies.delete(missing);
  for (const body of changed.bodies.values()) body.nestedBodies = body.nestedBodies.filter(nested => nested !== missing);
  assert.throws(() => run(changed), /initializer is outside/);
});

test("scripted checked owner kinds retain closure boundaries rather than treating every initializer as a closure", () => {
  for (const kind of ["FunctionExpression", "ArrowFunction", "MethodDeclaration", "Constructor", "GetAccessor", "SetAccessor"]) {
    const program = input();
    const owner = functions(program)[0];
    program.items.set(owner.tsonic.definition, { ...owner, kind });
    const result = run(program);
    assert.equal(result.kind, "ok");
    assert.equal(result.value.some(group => group.bodies.length > 1), kind === "ArrowFunction" || kind === "FunctionExpression", kind);
  }
  const program = input();
  const owner = functions(program)[0];
  const oldBody = [...program.bodies.values()].find(body => body.owner === owner.tsonic.definition);
  const replacement = fixture.ids.encodeBodyId({ owner: owner.tsonic.definition, role: "initializer", ordinal: 0 });
  program.bodies.delete(oldBody.body);
  program.bodies.set(replacement, { ...oldBody, body: replacement });
  for (const body of program.bodies.values()) body.nestedBodies = body.nestedBodies.map(nested => nested === oldBody.body ? replacement : nested);
  assert.throws(() => run(program), /function body role/);
  assert.throws(() => infer.groupsOf({ ...deps(program), hirBody: () => ({ ...oldBody, body: "invalid" }) }, ["invalid"]), /checked owner/);
});

function memberInput(kind, origins) {
  const program = input();
  const [left, right] = functions(program);
  right.type = null;
  const body = [...program.bodies.values()].find(body => body.owner === left.tsonic.definition);
  const statement = body.root.statements.nodes[0];
  const call = statement.expression;
  statement.expression = { ...call, kind, questionDotToken: null, expression: call.arguments.nodes[0],
    ...(kind === "PropertyAccessExpression" ? { name: call.expression } : { argumentExpression: call.arguments.nodes[0] }),
    tsonic: { core: call.tsonic.core, role: "value", value: { views: call.tsonic.views, place: call.tsonic.place,
      memory: call.tsonic.memory, observation: call.tsonic.observation },
      origins: origins === null ? { kind: "unavailable", reason: "parameter-dependent" }
        : { kind: "available", value: origins.map(origin => origin === "declared"
          ? { kind: "declared", declaration: right.tsonic.definition }
          : { kind: "class-prototype", owner: right.tsonic.definition }) }, accessor: { kind: "available", value: null } } };
  if (kind === "PropertyAccessExpression") statement.expression.name = { ...call.expression,
    tsonic: { core: call.expression.tsonic.core, role: "property-name", key: { kind: "available", value: { kind: "text", value: "member" } },
      origins: statement.expression.tsonic.origins } };
  return program;
}

test("scripted checked member origins and declaration read roles feed the one inferred-part owner relation", () => {
  for (const kind of ["PropertyAccessExpression", "ElementAccessExpression"]) {
    for (const origins of [[], ["declared"], ["class-prototype"], ["declared", "class-prototype"]]) assert.equal(run(memberInput(kind, origins)).kind, "ok");
    assert.throws(() => run(memberInput(kind, null)), /actual declaration origins are unavailable/);
  }
  for (const role of ["value", "shorthand-value", "type-name", "assignment-target"]) {
    const program = input();
    functions(program)[1].type = null;
    const reader = program.nodes.find(node => node.kind === "Identifier" && node.text === "right" && node.tsonic.role === "value");
    reader.tsonic = { ...reader.tsonic, role, ...(role === "assignment-target" ? { access: "write" } : {}) };
    assert.equal(run(program).kind, "ok");
  }
});

test("every graph preparation boundary refuses before publishing any partial partition", () => {
  const recursive = input();
  for (const fn of functions(recursive)) fn.type = null;
  const closure = input("export function outer(x: number): number { function inner(y: number): number { return y; } return x; }\n");
  const defaulted = input("export function outer(x: number, value = x): number { return value; }\n");
  const member = memberInput("PropertyAccessExpression", ["declared"]);
  for (const program of [recursive, closure, defaulted, member]) {
    let complete = false;
    for (let maximumWork = 0; maximumWork < 2048; maximumWork += 1) {
      const result = run(program, { ...AMPLE, maximumWork });
      if (result.kind === "ok") { complete = true; break; }
      assert.equal(result.kind, "refused");
      assert.equal(result.diagnostics.length, 1);
      assert.equal(result.diagnostics[0].arguments.some(argument => argument.kind === "number" && argument.value === maximumWork), true);
    }
    assert.equal(complete, true);
  }
});

function aliasInput(count = 1, uses = 1, recursive = false) {
  const aliases = Array.from({ length: count }, (unused, index) => "right as alias" + index).join(", ");
  const program = input("export function left(x:number):number {" + "right(x);".repeat(uses - 1)
    + "return right(x);}\nexport function right(x:number):number {return " + (recursive ? "left(x)" : "x") + ";}\nexport {" + aliases + "};\n");
  const [reader, producer] = functions(program);
  const occurrence = program.checked.exports.find(entry => entry.name === "alias0").target.occurrence;
  for (const node of program.nodes) if (node.kind === "Identifier" && node.text === "right" && node.tsonic.role === "value")
    node.tsonic = { ...node.tsonic, resolution: { kind: "binding", occurrence } };
  assert.deepEqual(fixture.verifyChecked(program.checked, program.interner), []);
  producer.type = null;
  return { program, reader, producer, occurrence };
}

test("actual checked export-binding inventory orders its inferred producer before a qualified reader", () => {
  const { program, reader, producer } = aliasInput();
  const result = run(program);
  assert.equal(result.kind, "ok");
  const ownerGroup = definition => result.value.findIndex(group => group.bodies.some(body => program.bodies.get(body).owner === definition));
  assert.equal(ownerGroup(producer.tsonic.definition) < ownerGroup(reader.tsonic.definition), true);
  assert.deepEqual(run(program, AMPLE, [...program.bodies.keys()].reverse()), result);
});

test("scripted retained binding graph expands each shared nearest row once, not once per use", () => {
  for (const count of [1, 16, 64, 256]) {
    const { program } = aliasInput(count, count);
    const rows = program.checked.bindings;
    let reads = 0;
    for (const [index, row] of rows.entries()) {
      const target = index + 1 === rows.length ? row.target : { kind: "available",
        value: { kind: "binding", occurrence: rows[index + 1].occurrence } };
      Object.defineProperty(row, "target", { get() { reads += 1; return target; } });
    }
    assert.equal(run(program).kind, "ok");
    assert.equal(reads, count, "one actual target read per retained nearest row at size " + count);
  }
});

test("binding cycles and complete groups retain canonical partition identity without invented declarations", () => {
  const { program, occurrence } = aliasInput(2, 1, true);
  const rows = program.checked.bindings;
  rows[0].target = { kind: "available", value: { kind: "binding", occurrence: rows[1].occurrence } };
  rows[1].target = { kind: "available", value: { kind: "binding", occurrence } };
  const cycle = run(program);
  assert.equal(cycle.kind, "ok");
  assert.equal(cycle.value.reduce((count, group) => count + group.bodies.length, 0), program.bodies.size);
  assert.equal(cycle.value.every(group => group.bodies.length === 1), true);
  for (const fn of functions(program)) fn.type = null;
  rows[1].target = { kind: "available", value: { kind: "declarations", definitions: functions(program).map(fn => fn.tsonic.definition) } };
  const complete = run(program);
  assert.equal(complete.kind, "ok");
  const joined = complete.value.find(group => group.bodies.length === 2);
  assert.equal(joined !== undefined, true);
  assert.equal(joined.signatures.length, 2);
});

test("the grouping graph keeps equal syntax ordinals qualified by actual item or execution owner", () => {
  const { program, occurrence } = aliasInput(2);
  const rows = program.checked.bindings;
  const body = [...program.bodies.values()].find(body => body.root.kind === "SourceFile").body;
  const intermediate = { kind: "body", value: { body, node: occurrence.value.node } };
  const another = { kind: "item", value: { owner: functions(program)[0].tsonic.definition, node: occurrence.value.node } };
  const target = rows[0].target;
  program.checked.bindings = [
    { occurrence, target: { kind: "available", value: { kind: "binding", occurrence: intermediate } } },
    { occurrence: intermediate, target: { kind: "available", value: { kind: "binding", occurrence: another } } },
    { occurrence: another, target },
  ];
  assert.equal(run(program).kind, "ok");
  program.checked.bindings.push({ occurrence: { ...intermediate, value: { body, node: occurrence.value.node + 1 } }, target });
  assert.equal(run(program).kind, "ok");
  program.checked.bindings.push(structuredClone(program.checked.bindings[0]));
  assert.throws(() => run(program), /duplicate nearest rows/);
});

test("binding semantic targets retain actual origins and absence without inventing dependency roots", () => {
  for (const kind of ["member", "module", "unresolved"]) {
    const { program, producer } = aliasInput();
    const original = program.checked.bindings[0].target;
    const diagnostics = [{ module: program.checked.module, index: 0 }];
    const target = kind === "member" ? { kind, through: original.value, key: { kind: "available", value: { kind: "text", value: "field" } },
      origins: { kind: "available", value: [{ kind: "declared", declaration: producer.tsonic.definition },
        { kind: "class-prototype", owner: producer.tsonic.definition }] } }
      : kind === "module" ? { kind, module: program.checked.module } : { kind, diagnostics };
    program.checked.bindings[0].target = { kind: "available", value: target };
    assert.equal(run(program).kind, "ok");
    if (kind === "unresolved") assert.equal(target.diagnostics === diagnostics, true);
    if (kind === "member") {
      const name = program.nodes.find(node => node.kind === "Identifier" && node.tsonic.role === "value" && node.text === "right");
      name.tsonic = { ...name.tsonic, resolution: target };
      assert.equal(run(program).kind, "ok");
      target.origins = { kind: "unavailable", reason: "parameter-dependent" };
      assert.throws(() => run(program), /binding member whose actual declaration origins are unavailable/);
    }
  }
});

test("missing binding evidence stays an explicit producer frontier, and malformed graph inputs are defects", () => {
  const { program } = aliasInput();
  const row = program.checked.bindings[0];
  const original = row.target;
  row.target = { kind: "unavailable", reason: "missing-original-component" };
  assert.throws(() => run(program), /nearest target is unavailable \(missing-original-component\)/);
  const name = program.nodes.find(node => node.kind === "Identifier" && node.text === "right" && node.tsonic.role === "value");
  const binding = name.tsonic.resolution;
  name.tsonic = { ...name.tsonic, resolution: { kind: "unavailable", reason: "checker-error" } };
  assert.throws(() => run(program), /dependency evidence is unavailable \(checker-error\)/);
  name.tsonic = { ...name.tsonic, resolution: binding };
  row.target = original;
  program.checked.bindings = [];
  assert.throws(() => run(program), /actual ready nearest row/);
  for (const node of [-0, -1, NaN, Infinity, 0.5]) {
    program.checked.bindings = [{ ...row, occurrence: { ...row.occurrence, value: { ...row.occurrence.value, node } } }];
    assert.throws(() => run(program), /actual qualified syntax identity/);
  }
});

test("an unused nearest row is indexed but no unavailable semantic target is forced", () => {
  const { program } = aliasInput(2);
  let reads = 0;
  Object.defineProperty(program.checked.bindings[1], "target", {
    get() { reads += 1; return { kind: "unavailable", reason: "not-provided" }; },
  });
  assert.equal(run(program).kind, "ok");
  assert.equal(reads, 0);
});

test("genuine multi-module source imports retain all nearest alias edges before grouping inferred producers", () => {
  const actual = fixture.checkedModulesOf({
    "producer.ts": "export function right(x:number) {return x;}\n",
    "barrel.ts": 'export {right as renamed} from "./producer.js";\n',
    "reader.ts": 'import {renamed as local} from "./barrel.js"; export function left(x:number):number {return local(x);}\n',
  });
  const items = new Map();
  const bodies = new Map();
  for (const module of actual.modules) {
    assert.deepEqual(fixture.verifyChecked(module, actual.interner, actual.modules), []);
    const nodes = fixture.hir.indexSyntaxTree(module.tree);
    items.set(module.tree.tsonic.definition, module.tree);
    for (const item of module.items) items.set(item.definition, nodes[item.node]);
    for (const body of module.bodies) bodies.set(body.body, body);
  }
  const result = infer.groupsOf({ bindings: actual.modules.map(module => module.bindings),
    hirBody: body => bodies.get(body) ?? assert.fail("actual cross-module body required"),
    itemOf: definition => items.get(definition) ?? assert.fail("actual cross-module item required"), graph: AMPLE }, [...bodies.keys()]);
  assert.equal(result.kind, "ok");
  const producer = actual.modules[0].tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").tsonic.definition;
  const readerModule = actual.modules[2];
  const reader = readerModule.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").tsonic.definition;
  const ownerGroup = definition => result.value.findIndex(group => group.bodies.some(body => bodies.get(body).owner === definition));
  assert.equal(ownerGroup(producer) < ownerGroup(reader), true);
  const name = fixture.hir.indexSyntaxTree(readerModule.tree).find(node => node.kind === "Identifier" && node.text === "local" && node.tsonic.role === "value");
  assert.equal(name.tsonic.resolution.kind, "binding");
  const projection = fixture.hir.resolveModuleBinding(fixture.hir.createModuleBindingViews(actual.modules.map(module => module.bindings)),
    name.tsonic.resolution.occurrence);
  assert.deepEqual(projection.target, { kind: "available", value: { kind: "declarations", definitions: [producer] } });
  assert.equal(projection.aliases.length, 2);
});

test("all binding preparation and expansion growth is charged before work with no partial partition", () => {
  const { program } = aliasInput(3, 3);
  const rows = program.checked.bindings;
  rows[0].target = { kind: "available", value: { kind: "binding", occurrence: rows[1].occurrence } };
  rows[1].target = { kind: "available", value: { kind: "member", through: rows[2].target.value,
    key: { kind: "available", value: { kind: "text", value: "field" } },
    origins: { kind: "available", value: [{ kind: "declared", declaration: functions(program)[1].tsonic.definition }] } } };
  let completed = false;
  for (let maximumWork = 0; maximumWork < 4096; maximumWork += 1) {
    const result = run(program, { ...AMPLE, maximumWork });
    if (result.kind === "ok") { completed = true; break; }
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics.length, 1);
  }
  assert.equal(completed, true);
});
