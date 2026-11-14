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
  return { checked, nodes, items, bodies };
}

function deps(program, graph = AMPLE) {
  return { hirBody: body => program.bodies.get(body) ?? assert.fail("a genuine body must be in the ready inventory"),
    itemOf: definition => program.items.get(definition) ?? assert.fail("a genuine owner must be in the ready inventory"), graph };
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
