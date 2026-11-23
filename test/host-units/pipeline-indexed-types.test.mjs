import { insertFixtureType } from "./fixtures/types-construction.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture, rawComponentPath } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";

function bindSourceSemantics(createSourceSemanticDatabase, base, ready, limits) {
  const { database, bind } = createSourceSemanticDatabase(base, limits);
  return { database, ...bind(ready) };
}

function rawPosition(raw, id) {
  const component = raw.types.components[id];
  return { ...component, path: rawComponentPath(raw.types.components, component) };
}

const authored = 'export type Select<Key extends "done" | "recur"> = { done: boolean; recur: string }[Key];'
  + 'export type Done = { done: boolean; recur: string }["done"];'
  + 'export type Recur = { done: boolean; recur: string }["recur"];';

test("Stage 3 retains exact authored numeric singleton types without executing their minus syntax", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Plain = 9007199254740993;
    export type Minus = -9007199254740993;
    export type SignedZero = - /* actual trivia */ 0;
    export type Fraction = -0.1;
    export type ThroughIndex = { readonly chosen: -0x10 }["chosen"];
    export function keep(value: boolean): boolean { return value; }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [plain, minus, zero, fraction, projected, keep] = module.tree.statements.nodes;
  const terms = result.value.index.types.terms;
  const exact = (type, numerator, denominator = 1n, negativeZero = false) => {
    const term = terms[type];
    assert.equal(term.kind, "literal");
    assert.deepEqual(term.value, { kind: "number", value: { numerator, denominator, negativeZero } });
  };
  assert.equal(plain.type.literal.kind, "NumericLiteral");
  assert.equal(plain.type.literal.text, "9007199254740993");
  assert.deepEqual(plain.type.literal.tsonic, { role: "type-literal", type: plain.tsonic.type });
  exact(plain.tsonic.type, 9007199254740993n);
  for (const [alias, numerator, denominator, isNegativeZero] of [
    [minus, -9007199254740993n, 1n, false], [zero, 0n, 1n, true], [fraction, -1n, 10n, false],
  ]) {
    const literal = alias.type.literal;
    assert.equal(literal.kind, "PrefixUnaryExpression");
    assert.equal(literal.operator, "MinusToken");
    assert.deepEqual(literal.tsonic, { role: "type-literal", type: alias.tsonic.type });
    assert.equal(literal.operand.kind, "NumericLiteral");
    assert.equal(literal.operand.tsonic.role, "type-literal");
    assert.notEqual(literal.operand.tsonic.type, alias.tsonic.type);
    exact(alias.tsonic.type, numerator, denominator, isNegativeZero);
    exact(literal.operand.tsonic.type, -numerator, denominator);
  }
  assert.equal(minus.type.literal.operand.tsonic.type, plain.tsonic.type);
  assert.equal(projected.type.kind, "IndexedAccessType");
  exact(projected.tsonic.type, -16n);
  assert.equal(module.bodies.some(body => body.kind === "selected" && body.tir.owner === keep.tsonic.definition), true);
  for (const alias of [plain, minus, zero, fraction, projected])
    assert.equal(module.bodies.some(body => body.tir.owner === alias.tsonic.definition), false);
});

test("Elaboration rejects a crossed signed singleton operand even when it is another ready numeric literal", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type WrongMagnitude = 2; export type Signed = -1;");
  const lower = pipelineWiring.front.lowerModule;
  let crossed = false;
  try {
    pipelineWiring.front.lowerModule = (...parameters) => {
      const source = lower(...parameters);
      if (source.kind !== "ok" || source.value.module !== input.snapshot.entryPoint) return source;
      const [other, signed] = source.value.tree.statements.nodes;
      const operand = signed.type.literal.operand;
      assert.equal(other.type.literal.tsonic.type.value !== operand.tsonic.type.value, true);
      operand.tsonic = { ...operand.tsonic, type: other.type.literal.tsonic.type };
      crossed = true;
      return source;
    };
    assert.throws(() => analyzeHostProgram(input), /numeric annotation must agree with its exact selected singleton/u);
    assert.equal(crossed, true);
  } finally {
    pipelineWiring.front.lowerModule = lower;
  }
});

test("A signed singleton uses the existing exact literal work bound at its own source", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const spelling = "-0x10";
  const source = "export type Signed = " + spelling + ";";
  const input = analysisInput(fixture, "sdk-minimal", source);
  const work = spelling.length + 5 + 5;
  for (let limit = 0; limit < work; limit += 1) {
    input.limits.evaluation.maximumArithmeticWork = limit;
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics.length, 1);
    const [diagnostic] = result.diagnostics;
    assert.equal(diagnostic.code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.equal(diagnostic.evidence[0], "front.literalCapture.maximumArithmeticWork");
    assert.deepEqual(diagnostic.site, { kind: "source",
      origin: { module: input.snapshot.entryPoint, start: source.indexOf(spelling), length: spelling.length, derived: [] } });
  }
  input.limits.evaluation.maximumArithmeticWork = work;
  const exact = analyzeHostProgram(input);
  assert.equal(exact.kind, "ok");
  assert.deepEqual(exact.diagnostics, []);
});

test("Stage 3 keeps colliding native numeric alias answers separate through re-exports and parentheses", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const sourceFiles = {
    "main.ts": "import type { Forward, Nearby } from './barrel.js'; export type First = Forward;"
      + " export type Second = Nearby; export type Local = ((First)); export type Fraction = (-0.1); export type Other = Fraction;",
    "barrel.ts": "export type { Exact as Forward, Nearby } from './seed.js';",
    "seed.ts": "export type Exact = 9007199254740993; export type Nearby = 9007199254740992;",
  };
  const snapshot = fixture.projectSnapshot({ sourceFiles, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const input = { ...analysisInput(fixture, "sdk-minimal", sourceFiles["main.ts"]), snapshot };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const seedId = fixture.moduleOf(fixture.packageOf("/project"), "src/seed.ts");
  const seed = result.value.modules.find(module => module.module === seedId);
  const [exact, nearby] = seed.tree.statements.nodes.map(node => node.tsonic.type);
  assert.notEqual(exact, nearby);
  const target = result.value.modules.find(module => module.module === snapshot.entryPoint);
  const [first, second, local, fraction, other] = target.tree.statements.nodes.slice(1).map(node => node.tsonic.type);
  assert.deepEqual([first, second, local, other], [exact, nearby, exact, fraction]);
  const terms = result.value.index.types.terms;
  for (const [identity, numerator, denominator] of [[first, 9007199254740993n, 1n], [second, 9007199254740992n, 1n], [other, -1n, 10n]])
    assert.deepEqual(terms[identity].value, { kind: "number", value: { numerator, denominator, negativeZero: false } });
});

test("Stage 3 keeps the exact checked source of a closed indexed property instead of its rounded native result", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Exact = 9007199254740993;
    export type Nearby = 9007199254740992;
    export type Fraction = -0.1;
    export type Shape = { readonly exact: Exact; readonly nearby: Nearby; readonly fraction: Fraction; };
    export type Large = Shape["exact"];
    export type Other = Shape["nearby"];
    export type Decimal = Shape["fraction"];
    export type Inline = { readonly chosen: -0.1 }["chosen"];
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [exact, nearby, fraction, , ...reads] = module.tree.statements.nodes;
  assert.notEqual(exact.tsonic.type, nearby.tsonic.type);
  assert.deepEqual(reads.map(read => read.tsonic.type), [exact, nearby, fraction, fraction].map(alias => alias.tsonic.type));
  assert.equal(reads.every(read => read.type.kind === "IndexedAccessType"), true);
});

test("Stage 3 publishes the exact authored read and ordinary write types of structural properties", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Exact = 9007199254740993;
    export type Nearby = 9007199254740992;
    export type Fraction = -0.1;
    export type Shape = { exact: Exact; nearby: Nearby; readonly inline: -0.1; signed: Fraction; };
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [exact, nearby, fraction, shape] = module.tree.statements.nodes.map(alias => alias.tsonic.type);
  assert.notEqual(exact, nearby);
  const term = result.value.index.types.terms[shape];
  assert.equal(term.kind, "shape");
  const actual = Object.fromEntries(term.members.map(row => [row.key.value, [row.read, row.write]]));
  assert.deepEqual(actual, { exact: [exact, exact], nearby: [nearby, nearby], inline: [fraction, null], signed: [fraction, fraction] });
});

test("Stage 3 retains the exact authored formals and returns of executing signatures", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Fraction = -0.1;
    export function exact(value: 9007199254740993): 9007199254740993 { return value; }
    export function nearby(value: 9007199254740992): 9007199254740992 { return value; }
    export function signed(value: Fraction): Fraction { return value; }
    export function forward(value: 9007199254740993): 9007199254740993 { return exact(value); }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const [, ...functions] = module.tree.statements.nodes;
  const types = result.value.index.types;
  const identities = [];
  for (const [declaration, numerator, denominator] of [
    [functions[0], 9007199254740993n, 1n], [functions[1], 9007199254740992n, 1n], [functions[2], -1n, 10n],
  ]) {
    const type = declaration.type.tsonic.type;
    identities.push(type);
    assert.equal(declaration.parameters.nodes[0].type.tsonic.type, type);
    const [endpoint] = declaration.tsonic.signatures;
    const signature = types.signatures[endpoint.signature];
    assert.equal(signature.parameters[0].type, type);
    assert.equal(signature.result, type);
    assert.deepEqual(types.terms[type].value, { kind: "number", value: { numerator, denominator, negativeZero: false } });
    const body = module.bodies.find(row => row.kind === "selected" && row.tir.owner === declaration.tsonic.definition);
    assert.ok(body);
    assert.equal(body.tir.root.statements.nodes[0].expression.tsonic.convertedType, type);
  }
  assert.equal(new Set(identities).size, 3);
  const forwarded = module.bodies.find(row => row.kind === "selected" && row.tir.owner === functions[3].tsonic.definition);
  assert.ok(forwarded);
  const call = forwarded.tir.root.statements.nodes[0].expression;
  assert.equal(call.kind, "CallExpression");
  assert.equal(call.tsonic.convertedType, identities[0]);
});

for (const [operator, definition] of [
  ["indexed", '{ done: boolean; next: string }[Key]'],
  ["conditional", 'Key extends "done" ? boolean : string'],
]) {
  test(`Stage 3 publishes both ready ${operator} type applications without discarding the open template`, async () => {
    const fixture = await loadFrontFixture();
    const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
    const input = analysisInput(fixture, "sdk-minimal",
      `export type Select<Key extends "done" | "next"> = ${definition};
       export function done(value: Select<"done">): boolean { return value; }
       export function next(value: Select<"next">): string { return value; }`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok");
    assert.deepEqual(result.diagnostics, []);
    const { index, modules } = result.value;
    const module = modules.find(row => row.module === input.snapshot.entryPoint);
    const [alias, ...functions] = module.tree.statements.nodes;
    const template = index.types.terms[alias.tsonic.type];
    assert.equal(template.kind, "projection");
    assert.equal(template.projection.kind, operator);
    assert.equal(functions.length, 2);
    const expected = [{ kind: "primitive", primitive: "bool" }, { kind: "string" }];
    for (const [ordinal, callable] of functions.entries()) {
      const body = module.bodies.find(row => row.kind === "selected" && row.tir.owner === callable.tsonic.definition);
      assert.equal(body !== undefined, true);
      assert.deepEqual(index.types.terms[body.tir.params[0].type.tsonic.type], expected[ordinal]);
      assert.deepEqual(index.types.terms[body.tir.completion], expected[ordinal]);
      assert.equal(body.mir.blocks.some(block => block.terminator.kind === "return"), true);
      assert.deepEqual(body.facts.map(facts => facts.execution.provided), [1]);
      const summary = index.summaries.find(row => row.key.kind === "body"
        && fixture.types.executionKey(row.key.execution) === fixture.types.executionKey(body.facts[0].execution));
      assert.equal(summary?.returns, true);
      assert.equal(summary?.unwinds, false);
    }
  });
}

test("an actual indexed type retains its object and key until the key is bound", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const input = analysisInput(fixture, "sdk-minimal", authored);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules } = captured.value;
  const [open, done, recur] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  assert.equal(open.type.kind, "IndexedAccessType");
  const typeOf = node => {
    assert.equal(node.tsonic.type.kind, "available");
    return node.tsonic.type.value;
  };
  const { readType, viewTypes, printTypes, parseTypes, substitute } = fixture.types;
  const original = typeOf(open.type);
  const object = typeOf(open.type.objectType);
  const index = typeOf(open.type.indexType);
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const scope = captured.value.descriptions.get(open.tsonic.definition).generics;
  assert.deepEqual(scope, { classParameters: [parameter], methodParameters: [], capturedParameters: [], selfOwners: [] });
  assert.deepEqual(readType(types, index), { kind: "param", parameter });
  assert.deepEqual(readType(types, original), { kind: "projection", source: object, projection: { kind: "indexed", index } });
  assert.deepEqual(readType(types, typeOf(done.type)), { kind: "primitive", primitive: "bool" });
  assert.deepEqual(readType(types, typeOf(recur.type)), { kind: "string" });
  const rebound = [done, recur].map(declaration => {
    const key = typeOf(declaration.type.indexType);
    const bound = substitute(types, [original], { methodBindings: [], capturedBindings: [], selfBindings: [],
      classBindings: [{ kind: "bound", parameter, type: key }] }, input.limits.instantiation.typeExpansion, captured.value.typeWork);
    assert.equal(bound.kind, "complete");
    assert.deepEqual(readType(types, bound.value[0]), {
      kind: "projection", source: object, projection: { kind: "indexed", index: key },
    });
    return bound.value[0];
  });
  assert.notEqual(rebound[0], rebound[1]);
  const table = viewTypes(types);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
});

test("the actual checked indexed operator rejects a crossed operand", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const capture = pipelineWiring.front.captureModule;
  const input = analysisInput(fixture, "sdk-minimal", authored);
  let crossed = false;
  try {
    pipelineWiring.front.captureModule = (...arguments_) => {
      const result = capture(...arguments_);
      if (result.kind !== "ok" || result.value.module !== input.snapshot.entryPoint) return result;
      const module = result.value;
      const types = module.types.types.map(row => {
        if (row.form.kind !== "available" || row.form.value.kind !== "indexed-access") return row;
        crossed = true;
        return { ...row, form: { ...row.form, value: { ...row.form.value, index: row.form.value.object } } };
      });
      return { ...result, value: { ...module, types: { ...module.types, types } } };
    };
    assert.throws(() => captureSourceBarrier(input), /indexed projection operand must retain its actual object or index child/u);
    assert.equal(crossed, true);
  } finally {
    pipelineWiring.front.captureModule = capture;
  }
});

for (const [foreign, conditional] of [[false, false], [true, false], [false, true]]) {
  test(`Raw selected indexed results retain the actual ${foreign ? "foreign" : "same-module"} alias and ${conditional ? "conditional " : ""}signature key binder`, async () => {
    const fixture = await loadFrontFixture();
    const key = conditional ? 'Key extends "done" ? "done" : "next"' : "Key";
    const definition = `export type Lookup<Key extends "done" | "next"> = { done: boolean; next: string }[${key}];`;
    const declaration = 'export declare function select<Key extends "done" | "next">(key: Key): Lookup<Key>;';
    const sourceFiles = foreign
      ? { "main.ts": 'import type { Lookup } from "./lookup.js";' + declaration, "lookup.ts": definition }
      : { "main.ts": definition + declaration };
    const snapshot = fixture.projectSnapshot({ sourceFiles,
      libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
    const { deps, program } = fixture.openAndCapture(snapshot);
    const main = snapshot.entryPoint;
    const aliasModule = foreign ? snapshot.source.input.packages.modules.find(row => row.path === "/project/src/lookup.ts").id : main;
    const selected = fixture.front.captureModule(deps, program, main);
    assert.equal(selected.kind, "ok");
    const aliases = foreign ? fixture.front.captureModule(deps, program, aliasModule) : selected;
    assert.equal(aliases.kind, "ok");
    const raw = selected.value;
    const select = raw.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration");
    const lookup = aliases.value.tree.statements.nodes.find(node => node.kind === "TypeAliasDeclaration");
    const root = { module: main, node: select.id };
    const rows = raw.types.types.filter(row => {
      const place = rawPosition(raw, row.component);
      return place.root.module === main && place.root.node === select.id && place.path.at(-1)?.kind === "result"
        && row.form.kind === "available" && row.form.value.kind === "indexed-access";
    });
    assert.equal(rows.length, 1);
    const [result] = rows;
    const { form, alias } = result;
    const { path } = rawPosition(raw, result.component);
    assert.deepEqual(form.value.operator, { module: aliasModule, node: lookup.type.id });
    assert.deepEqual(alias.value.declaration, { module: aliasModule, node: lookup.id });
    assert.equal(alias.value.arguments.length, 1);
    const [argument] = alias.value.arguments;
    assert.deepEqual(argument.parameter, { module: aliasModule, node: lookup.typeParameters.nodes[0].id });
    const selectedKey = { module: main, node: select.typeParameters.nodes[0].id };
    assert.notDeepEqual(selectedKey, argument.parameter);
    for (const [type, step] of [
      [form.value.object, { kind: "projection-source" }],
      [form.value.index, { kind: "projection-index" }],
      [argument.type, { kind: "type-argument", declaration: alias.value.declaration, index: 0 }],
    ]) {
      const child = raw.types.types[type];
      assert.equal(child.authoredTypeNode, null);
      const component = rawPosition(raw, child.component);
      assert.deepEqual(component.root, root);
      assert.deepEqual(component.path, [...path, step]);
    }
    let selectedParameter = form.value.index;
    if (conditional) {
      const condition = raw.types.types[form.value.index].form.value;
      assert.equal(condition.kind, "conditional");
      assert.equal(condition.distributive, true);
      assert.equal(condition.whenTrue.kind, "ready");
      assert.equal(condition.whenFalse.kind, "ready");
      assert.deepEqual(condition.operator, { module: aliasModule, node: lookup.type.indexType.id });
      selectedParameter = condition.check;
      for (const [type, step, literal] of [
        [condition.check, "projection-source", null],
        [condition.extends, "projection-extends", { kind: "string", value: "done" }],
        [condition.whenTrue.type, "projection-when-true", { kind: "string", value: "done" }],
        [condition.whenFalse.type, "projection-when-false", { kind: "string", value: "next" }],
      ]) {
        const operand = raw.types.types[type];
        assert.equal(operand.authoredTypeNode, null);
        assert.deepEqual(operand.literal, { kind: "available", value: literal });
        const component = rawPosition(raw, operand.component);
        assert.deepEqual(component.root, root);
        assert.deepEqual(component.path, [...path, { kind: "projection-index" }, { kind: step }]);
      }
    }
    for (const id of [selectedParameter, argument.type])
      assert.deepEqual(raw.types.types[id].form.value.parameter, selectedKey);
  });
}

test("Raw recursion retains the defining indexed alias and its changed depth without expanding the dependent body", async () => {
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", `
    type Depth = readonly [0, 0, 1, 2];
    export type Walk<Item, Level extends number> = {
      done: Item;
      next: { link: Walk<Item, Depth[Level]> };
    }[Level extends 0 ? "done" : "next"];
    export declare function pick<Item, Level extends number>(item: Item, level: Level): Walk<Item, Level>;
  `);
  const { deps, program } = fixture.openAndCapture(input.snapshot);
  const captured = fixture.front.captureModule(deps, program, input.snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const [, walk, pick] = raw.tree.statements.nodes;
  const component = row => rawPosition(raw, row.component);
  const at = node => ({ module: raw.module, node: node.id });
  const row = raw.types.types.find(value => {
    const where = component(value);
    return where.root.node === pick.id && where.path[0]?.kind === "result" && where.path[1]?.kind === "projection-source"
      && value.form.kind === "available" && value.form.value.kind === "indexed-alias-dependency";
  });
  assert.ok(row);
  assert.equal(row.authoredTypeNode, null);
  assert.deepEqual(row.form.value.operator, at(walk.type));
  assert.deepEqual(row.alias.value.declaration, at(walk));
  assert.deepEqual(row.alias.value.arguments.map(binding => binding.parameter), walk.typeParameters.nodes.map(at));
  const place = component(row);
  for (const [index, binding] of row.alias.value.arguments.entries()) {
    const child = component(raw.types.types[binding.type]);
    assert.deepEqual(child.root, place.root);
    assert.deepEqual(child.path, [...place.path, { kind: "type-argument", declaration: at(walk), index }]);
  }
  const [item, depth] = row.alias.value.arguments.map(binding => raw.types.types[binding.type].form.value);
  assert.deepEqual(item.parameter, at(pick.typeParameters.nodes[0]));
  assert.equal(depth.kind, "indexed-access");
  assert.deepEqual(raw.types.types[depth.index].form.value.parameter, at(pick.typeParameters.nodes[1]));
  assert.equal(raw.types.types[depth.object].form.value.kind, "tuple");
  assert.equal(raw.types.components.some(child => child.root.module === place.root.module && child.root.node === place.root.node
    && place.path.every((step, index) => child.path[index] === step)
    && ["projection-source", "projection-index"].includes(child.path[place.path.length]?.kind)), false);
});

test("an independent argument using the same indexed alias does not re-enter its outer application's body", async () => {
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Choose<Unused, Flag> = { yes: boolean; no: string }[Flag extends true ? "yes" : "no"];
    export declare function pick<First, Second>(a: First, b: Second): Choose<Choose<never, First>, Second>;
  `);
  const { deps, program } = fixture.openAndCapture(input.snapshot);
  const captured = fixture.front.captureModule(deps, program, input.snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const [choose, pick] = raw.tree.statements.nodes;
  const component = row => rawPosition(raw, row.component);
  const result = raw.types.types.find(row => component(row).root.node === pick.id
    && component(row).path.length === 1 && component(row).path[0].kind === "result");
  const original = { module: raw.module, node: choose.id };
  assert.deepEqual(result.alias.value.declaration, original);
  const nested = raw.types.types[result.alias.value.arguments[0].type];
  assert.equal(nested.form.value.kind, "indexed-access");
  assert.deepEqual(nested.alias.value.declaration, original);
  assert.deepEqual(component(nested).path, [...component(result).path, { kind: "type-argument", declaration: original, index: 0 }]);
  assert.deepEqual(component(raw.types.types[nested.form.value.object]).path, [...component(nested).path, { kind: "projection-source" }]);
  const [outerFlag, innerFlag] = [result, nested].map(row => raw.types.types[row.alias.value.arguments[1].type].form.value.parameter);
  assert.deepEqual(outerFlag, { module: raw.module, node: pick.typeParameters.nodes[1].id });
  assert.deepEqual(innerFlag, { module: raw.module, node: pick.typeParameters.nodes[0].id });
});

for (const [objectKind, objectSyntax, keyType, projectedKey = false] of [
  ["structure", "{ left: boolean; right: string }", '"left" | "right"'],
  ["tuple", "Slots", "number"],
  ["tuple", "Slots", "number", true],
]) test(`Raw ${projectedKey ? "conditional projection" : "alias argument"} retains a native inline indexed ${objectKind} with no invented alias or operator`, async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "aliases.ts": `export type Select<${projectedKey ? "Flag" : "Unused, Flag"}> = { yes: boolean; no: string }[Flag extends true ? "yes" : "no"];`,
      "main.ts": `import type { Select } from "./aliases.js";
        ${objectKind === "tuple" ? "type Slots = readonly [false, true];" : ""}
        export declare function pick<Key extends ${keyType}, Flag>(key: Key, flag: Flag):
          Select<${objectSyntax}[Key]${projectedKey ? "" : ", Flag"}>;`,
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const moduleOf = name => snapshot.source.input.packages.modules.find(row => row.path === `/project/src/${name}.ts`).id;
  const main = moduleOf("main");
  const foreign = moduleOf("aliases");
  const { deps, program } = fixture.openAndCapture(snapshot);
  const captured = fixture.front.captureModule(deps, program, main);
  assert.equal(captured.kind, "ok");
  const aliases = fixture.front.captureModule(deps, program, foreign);
  assert.equal(aliases.kind, "ok");
  const raw = captured.value;
  const [alias] = aliases.value.tree.statements.nodes;
  const pick = raw.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration");
  const component = row => rawPosition(raw, row.component);
  const result = raw.types.types.find(row => component(row).root.node === pick.id
    && component(row).path.length === 1 && component(row).path[0].kind === "result"
    && row.form.kind === "available" && row.form.value.kind === "indexed-access");
  const [binding] = result.alias.value.arguments;
  assert.deepEqual(binding.parameter, { module: foreign, node: alias.typeParameters.nodes[0].id });
  const argument = raw.types.types[binding.type];
  const indexed = argument.form.value;
  assert.equal(argument.authoredTypeNode, null);
  assert.deepEqual(argument.alias, { kind: "available", value: null });
  assert.equal(indexed.kind, "indexed-access");
  assert.equal(indexed.operator, null);
  const place = component(argument);
  assert.deepEqual(place.root, component(result).root);
  assert.deepEqual(place.path, [...component(result).path, {
    kind: "type-argument", declaration: { module: foreign, node: alias.id }, index: 0,
  }]);
  for (const [id, kind] of [[indexed.object, "projection-source"], [indexed.index, "projection-index"]]) {
    const operand = raw.types.types[id];
    assert.equal(operand.authoredTypeNode, null);
    assert.deepEqual(component(operand).root, place.root);
    assert.deepEqual(component(operand).path, [...place.path, { kind }]);
  }
  const object = raw.types.types[indexed.object];
  assert.equal(object.form.value.kind, objectKind);
  if (objectKind === "tuple") {
    assert.equal(object.form.value.readonly, true);
    assert.equal(object.form.value.elements.length, 2);
    for (const [index, slot] of object.form.value.elements.entries()) {
      const child = raw.types.types[slot.type];
      assert.equal(slot.kind, "required");
      assert.equal(slot.declaration, null);
      assert.deepEqual(slot.passing, { kind: "unavailable", reason: "not-provided", causes: [] });
      assert.equal(child.authoredTypeNode, null);
      assert.deepEqual(child.literal, { kind: "available", value: { kind: "boolean", value: index === 1 } });
      assert.equal(child.component, slot.component);
      assert.deepEqual(component(child).root, place.root);
      assert.deepEqual(component(child).path, [...component(object).path, { kind: "tuple-element", index }]);
    }
  }
  assert.deepEqual(raw.types.types[indexed.index].form.value.parameter, { module: main, node: pick.typeParameters.nodes[0].id });
  if (projectedKey) {
    const conditional = raw.types.types[result.form.value.index];
    assert.equal(conditional.form.value.kind, "conditional");
    assert.deepEqual(conditional.form.value.application.map(row => row.parameter), [binding.parameter]);
    for (const [id, step] of [[conditional.form.value.check, { kind: "projection-source" }],
      [conditional.form.value.application[0].type, { kind: "projection-argument", index: 0 }]]) {
      const projected = raw.types.types[id];
      assert.equal(projected.form.value.kind, "indexed-access");
      assert.equal(projected.form.value.operator, null);
      assert.deepEqual(projected.alias, { kind: "available", value: null });
      assert.deepEqual(component(projected).root, component(conditional).root);
      assert.deepEqual(component(projected).path, [...component(conditional).path, step]);
      assert.equal(raw.types.types[projected.form.value.object].form.value.kind, "tuple");
      assert.deepEqual(raw.types.types[projected.form.value.index].form.value.parameter, raw.types.types[indexed.index].form.value.parameter);
    }
  }
});

test("Raw property conditionals distinguish the original authored branches from a foreign selected deferred application", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "aliases.ts": `export type Select<Item, Depth> = {
        done: Item;
        recur: Item extends readonly (infer Inner)[] ? Inner : Depth;
      }[Depth extends false ? "done" : "recur"];`,
      "main.ts": `import type { Select } from "./aliases.js";
        export declare function pick<Actual, Count>(value: Actual, count: Count): Select<Actual, Count>;`,
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const moduleOf = name => snapshot.source.input.packages.modules.find(row => row.path === `/project/src/${name}.ts`).id;
  const main = moduleOf("main");
  const foreign = moduleOf("aliases");
  const { deps, program } = fixture.openAndCapture(snapshot);
  const selected = fixture.front.captureModule(deps, program, main);
  assert.equal(selected.kind, "ok");
  const raw = selected.value;
  const captured = fixture.front.captureModule(deps, program, foreign);
  assert.equal(captured.kind, "ok");
  const [alias] = captured.value.tree.statements.nodes;
  const pick = raw.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration");
  const property = alias.type.objectType.members.nodes.find(item => item.name.text === "recur");
  const operator = property.type;
  const binder = fixture.hir.walkSyntaxTree(operator.extendsType, []).find(node => node.kind === "InferType");
  const at = (module, node) => ({ module, node: node.id });
  const component = (table, row) => rawPosition(table, row.component);
  const rows = raw.types.types.filter(row => {
    const place = component(raw, row);
    return place.root.module === main && place.root.node === pick.id && place.path[0]?.kind === "result"
      && place.path[1]?.kind === "projection-source" && place.path[2]?.kind === "member"
      && row.form.kind === "available" && row.form.value.kind === "conditional";
  });
  assert.deepEqual(rows.map(row => component(raw, row).path[2].access).sort(), ["read", "write"]);
  for (const row of rows) {
    const place = component(raw, row);
    const conditional = row.form.value;
    assert.equal(row.authoredTypeNode, null);
    assert.deepEqual(place.path[2].declaration, at(foreign, property));
    assert.deepEqual(conditional.operator, at(foreign, operator));
    assert.deepEqual(conditional.inferParameters, [at(foreign, binder.typeParameter)]);
    assert.deepEqual(conditional.whenTrue, { kind: "deferred", source: at(foreign, operator.trueType) });
    assert.deepEqual(conditional.whenFalse, { kind: "deferred", source: at(foreign, operator.falseType) });
    assert.equal(conditional.application.length, 2);
    for (const [index, binding] of conditional.application.entries()) {
      const argument = raw.types.types[binding.type];
      assert.deepEqual(binding.parameter, at(foreign, alias.typeParameters.nodes[index]));
      assert.deepEqual(argument.form.value.parameter, at(main, pick.typeParameters.nodes[index]));
      assert.deepEqual(component(raw, argument).root, place.root);
      assert.deepEqual(component(raw, argument).path, [...place.path, { kind: "projection-argument", index }]);
    }
  }
  const original = captured.value.types.types.find(row => component(captured.value, row).path.at(-1)?.kind === "member"
    && row.form.kind === "available" && row.form.value.kind === "conditional");
  assert.equal(original.form.value.application, null);
  for (const [arm, syntax] of [[original.form.value.whenTrue, operator.trueType], [original.form.value.whenFalse, operator.falseType]]) {
    assert.equal(arm.kind, "ready");
    assert.deepEqual(captured.value.types.types[arm.type].authoredTypeNode, at(foreign, syntax));
  }
});

test("Stage 3 preserves the actual mutable and readonly declared array annotations without selecting runtime storage", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const source = "export type Mutable = boolean[]; export type Immutable = readonly boolean[];"
    + "export function ready(): boolean { return true; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source }, libraries: [{
    name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent
      + "\ninterface ReadonlyArray<T> { readonly length: number; readonly [index: number]: T; }",
  }] });
  const input = { ...analysisInput(fixture, "sdk-minimal", source), snapshot };
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  assert.deepEqual(result.diagnostics, []);
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === snapshot.entryPoint);
  const [mutable, immutable, ready] = module.tree.statements.nodes;
  assert.equal(mutable.type.kind, "ArrayType");
  assert.equal(immutable.type.kind, "TypeOperator");
  assert.equal(immutable.type.operator, "ReadonlyKeyword");
  assert.equal(immutable.type.type.kind, "ArrayType");
  const carrier = node => index.types.terms[node.tsonic.type];
  const declared = [carrier(mutable.type), carrier(immutable.type)];
  const library = modules.find(row => row.module !== snapshot.entryPoint
    && row.tree.statements.nodes.some(node => node.kind === "InterfaceDeclaration" && node.name.text === "ReadonlyArray"));
  const expected = ["Array", "ReadonlyArray"].map(name => library.tree.statements.nodes
    .find(node => node.kind === "InterfaceDeclaration" && node.name.text === name).tsonic.definition);
  assert.deepEqual(declared.map(term => term.definition), expected);
  assert.notEqual(expected[0], expected[1]);
  for (const term of declared) {
    assert.equal(term.kind, "declared");
    assert.equal(term.facet, "instance");
    assert.equal(term.arguments.length, 1);
    assert.deepEqual(index.types.terms[term.arguments[0]], { kind: "primitive", primitive: "bool" });
  }
  assert.deepEqual(carrier(mutable.type.elementType), { kind: "primitive", primitive: "bool" });
  assert.deepEqual(carrier(immutable.type.type.elementType), { kind: "primitive", primitive: "bool" });
  assert.equal(module.bodies.some(body => body.kind === "selected" && body.tir.owner === ready.tsonic.definition), true);
  for (const alias of [mutable, immutable])
    assert.equal(module.bodies.some(body => body.tir.owner === alias.tsonic.definition), false);
  const lower = pipelineWiring.front.lowerModule;
  let crossed = false;
  try {
    pipelineWiring.front.lowerModule = (...arguments_) => {
      const checked = lower(...arguments_);
      if (checked.kind !== "ok" || checked.value.module !== snapshot.entryPoint) return checked;
      const [plain, readonly] = checked.value.tree.statements.nodes;
      assert.equal(readonly.type.tsonic.type.value !== plain.type.tsonic.type.value, true);
      readonly.type.tsonic.type = plain.type.tsonic.type;
      crossed = true;
      return checked;
    };
    assert.throws(() => analyzeHostProgram(input), /a readonly array annotation requires its actual checked operand type/iu);
    assert.equal(crossed, true);
  } finally {
    pipelineWiring.front.lowerModule = lower;
  }
});

test("Raw capture keeps the authored infer binder distinct from the conditional's outer type parameter", async () => {
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Elem<Outer> = Outer extends readonly (infer Inner)[] ? Inner : never;"
      + "export type Match = Elem<readonly boolean[]>; export type NoMatch = Elem<true>;");
  const { deps, program } = fixture.openAndCapture(input.snapshot);
  const captured = fixture.front.captureModule(deps, program, input.snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const [alias, yes, no] = raw.tree.statements.nodes;
  const annotation = node => raw.types.types.find(type => type.authoredTypeNode?.module === raw.module
    && type.authoredTypeNode.node === node.id);
  const inferNode = fixture.hir.walkSyntaxTree(alias.type.extendsType, []).find(node => node.kind === "InferType");
  const selected = annotation(alias.type).form.value;
  assert.equal(selected.kind, "conditional");
  assert.equal(selected.distributive, true);
  const inner = { module: raw.module, node: inferNode.typeParameter.id };
  const outer = { module: raw.module, node: alias.typeParameters.nodes[0].id };
  assert.notDeepEqual(inner, outer);
  assert.deepEqual(selected.inferParameters, [inner]);
  assert.deepEqual(raw.types.types[selected.check].form.value.parameter, outer);
  assert.equal(selected.whenTrue.kind, "ready");
  assert.equal(selected.whenFalse.kind, "ready");
  assert.deepEqual(raw.types.types[selected.whenTrue.type].form.value.parameter, inner);
  assert.deepEqual(raw.types.types[selected.whenFalse.type].form.value, { kind: "scalar", scalar: "never" });
  assert.deepEqual(annotation(yes.type).form.value, { kind: "scalar", scalar: "boolean" });
  assert.deepEqual(annotation(no.type).form.value, { kind: "scalar", scalar: "never" });
});

test("Stage 3 retains an authored infer binder while closed checker answers cross every barrier", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Elem<Outer> = Outer extends readonly (infer Inner)[] ? Inner : never;"
      + "export type Yes = Elem<readonly boolean[]>; export type No = Elem<true>;");
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const moduleOf = rows => rows.find(row => row.module === input.snapshot.entryPoint);
  const [alias, checkedYes] = moduleOf(checked.value.modules.map(row => row.module)).tree.statements.nodes;
  const pattern = alias.type.extendsType.type.elementType.type;
  const binder = pattern.typeParameter.tsonic.definition;
  const outer = alias.typeParameters.nodes[0].tsonic.definition;
  const { readType } = fixture.types;
  assert.equal(pattern.kind, "InferType");
  assert.notEqual(binder, outer);
  assert.deepEqual(readType(checked.value.types, pattern.tsonic.type.value), { kind: "param", parameter: binder });
  assert.equal(alias.type.trueType.tsonic.type.value, pattern.tsonic.type.value);
  assert.deepEqual(readType(checked.value.types, alias.type.tsonic.type.value).projection, {
    kind: "conditional", extends: alias.type.extendsType.tsonic.type.value, whenTrue: pattern.tsonic.type.value,
    whenFalse: alias.type.falseType.tsonic.type.value, distributive: true, inferParameter: binder,
  });
  const { modules, types, descriptions, typeWork } = checked.value;
  const instantiation = input.limits.instantiation;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: owner => descriptions.get(owner).generics,
  }, input.limits.query);
  const argument = checkedYes.type.typeArguments.nodes[0].tsonic.type.value;
  const match = pipelineWiring.rules.matchTypePattern;
  try {
    pipelineWiring.rules.matchTypePattern = () => assert.fail("an inference binder must not enter the singleton matcher");
    const deferred = database.run(queries.produceType, {
      component: { root: { kind: "item", value: { owner: alias.tsonic.definition, node: alias.type.id } }, path: [] },
      bindings: { classBindings: [{ kind: "bound", parameter: outer, type: argument }],
        methodBindings: [], capturedBindings: [], selfBindings: [] },
    });
    assert.equal(deferred.kind, "completed");
    assert.deepEqual(deferred.value.category, { kind: "dynamic" });
    const deferredType = readType(types, deferred.value.type);
    assert.equal(deferredType.source, argument);
    assert.equal(deferredType.projection.inferParameter, binder);
  } finally {
    pipelineWiring.rules.matchTypePattern = match;
  }
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const [typedAlias, yes, no] = moduleOf(result.value.modules).tree.statements.nodes;
  const { terms } = result.value.index.types;
  assert.equal(typedAlias.type.extendsType.type.elementType.type.typeParameter.tsonic.parameter.declaration, binder);
  assert.equal(terms[typedAlias.tsonic.type].projection.inferParameter, binder);
  assert.deepEqual(terms[yes.tsonic.type], { kind: "primitive", primitive: "bool" });
  assert.deepEqual(terms[no.tsonic.type], { kind: "intrinsic", intrinsic: "never" });

  const capture = pipelineWiring.front.captureModule;
  let crossed = false;
  try {
    pipelineWiring.front.captureModule = (...args) => {
      const result = capture(...args);
      if (result.kind !== "ok" || result.value.module !== input.snapshot.entryPoint) return result;
      const module = result.value;
      const forms = module.types.types.map(row => {
        if (row.form.kind !== "available" || row.form.value.kind !== "conditional") return row;
        crossed = true;
        const definition = { module: module.module, node: module.tree.statements.nodes[0].typeParameters.nodes[0].id };
        return { ...row, form: { kind: "available", value: { ...row.form.value, inferParameters: [definition] } } };
      });
      return { ...result, value: { ...module, types: { ...module.types, types: forms } } };
    };
    assert.throws(() => captureSourceBarrier(input), /conditional projection must retain its actual extends inference parameter/u);
    assert.equal(crossed, true);
  } finally {
    pipelineWiring.front.captureModule = capture;
  }
});

test("same-spelled conditional parameters keep their own definitions across true and false arms", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal",
    "export type Element<Item> = Item extends readonly (infer Item)[] ? Item : Item;"
      + "export type Match = Element<readonly boolean[]>; export type Miss = Element<string>;");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const [element, match, miss] = result.value.modules.find(row => row.module === input.snapshot.entryPoint).tree.statements.nodes;
  const { terms } = result.value.index.types;
  const outer = element.typeParameters.nodes[0].tsonic.parameter.declaration;
  const inner = element.type.extendsType.type.elementType.type.typeParameter.tsonic.parameter.declaration;
  assert.notEqual(inner, outer);
  assert.deepEqual(terms[element.type.checkType.tsonic.type], { kind: "param", parameter: outer });
  assert.deepEqual(terms[element.type.trueType.tsonic.type], { kind: "param", parameter: inner });
  assert.deepEqual(terms[element.type.falseType.tsonic.type], { kind: "param", parameter: outer });
  assert.deepEqual(terms[match.tsonic.type], { kind: "primitive", primitive: "bool" });
  assert.deepEqual(terms[miss.tsonic.type], { kind: "string" });
});

test("an infer annotation outside a pattern refuses with its one original diagnostic", async () => {
  const fixture = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Invalid = infer Leak;");
  const { deps, program } = fixture.openAndCapture(input.snapshot);
  const captured = fixture.front.captureModule(deps, program, input.snapshot.entryPoint);
  assert.equal(captured.kind, "ok");
  const [original] = captured.value.checkerDiagnostics;
  assert.deepEqual(original.code, { kind: "checker", number: 1338, rendered: "TS1338" });
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "refused");
  assert.deepEqual(result.diagnostics, [original]);
});

test("bound indexed production asks the actual inventory and only the selected read type", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", authored + 'export type Absent = "absent";');
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [open, done, recur, absent] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const owner = open.tsonic.definition;
  const component = { root: { kind: "item", value: { owner, node: open.type.id } }, path: [] };
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const vector = binding => ({ classBindings: [binding], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const requestOf = type => ({ component, bindings: vector({ kind: "bound", parameter, type }) });
  const bindingScopeOf = definition => descriptions.get(definition).generics;
  const { instantiation } = input.limits;
  const openQueries = (limits = instantiation) => bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: limits.typeExpansion }, instantiation: limits,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf,
  }, input.limits.query);
  const { database, queries } = openQueries();
  const request = requestOf(done.type.indexType.tsonic.type.value);
  const first = database.run(queries.produceType, request);
  assert.equal(first.kind, "completed");
  assert.deepEqual(first.value, { component: component.root, type: done.type.tsonic.type.value,
    category: { kind: "known", category: "boolean" }, numeric: null, sum: null, nominal: null, pointer: null });
  assert.equal(database.run(queries.produceType, structuredClone(request)).value === first.value, true);
  const second = database.run(queries.produceType, requestOf(recur.type.indexType.tsonic.type.value));
  assert.equal(second.kind, "completed");
  assert.equal(second.value.type, recur.type.tsonic.type.value);
  assert.deepEqual(second.value.category, { kind: "known", category: "string" });
  const computed = name => database.stats().find(row => row.name === name)?.computed ?? 0;
  assert.equal(computed("membersOf"), 1);
  assert.equal(computed("memberTypeOf"), 2);
  const rigid = database.run(queries.produceType, { component, bindings: vector({ kind: "rigid", parameter }) });
  assert.equal(rigid.kind, "completed");
  assert.equal(rigid.value.type, open.type.tsonic.type.value);
  const missing = database.run(queries.produceType, requestOf(absent.type.tsonic.type.value));
  assert.equal(missing.kind, "refused");
  assert.equal(missing.diagnostics[0].code.name, "TSONIC_LOCAL_TYPE_UNSUPPORTED");
  assert.deepEqual(missing.diagnostics[0].site, { kind: "source", origin: open.type.origin });
  assert.equal(computed("memberTypeOf"), 2, "no member answer is requested when its exact key is absent or deferred");
  const crossedOwner = { ...request, component: { ...component, root: { kind: "item", value: {
    owner: done.tsonic.definition, node: open.type.id,
  } } } };
  const crossedBindings = { ...request, bindings: vector({ kind: "bound", parameter: owner, type: 0 }) };
  for (const [crossed, message] of [[crossedOwner, /actual checked defining operand component/u],
    [crossedBindings, /actual complete checked binding scope/u]]) {
    const isolated = openQueries();
    assert.throws(() => isolated.database.run(isolated.queries.produceType, crossed), message);
    assert.equal(isolated.database.stats().some(row => row.name === "membersOf"), false);
  }
  const limited = openQueries({ ...instantiation, maximumWork: 0 });
  const refused = limited.database.run(limited.queries.produceType, request);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  const refusedAgain = limited.database.run(limited.queries.produceType, requestOf(recur.type.indexType.tsonic.type.value));
  assert.equal(refusedAgain.diagnostics[0] === refused.diagnostics[0], true);
  assert.equal(limited.database.stats().some(row => row.name === "membersOf"), false);

  const exactWork = 24 + 2 * parameter.length;
  const under = openQueries({ ...instantiation, maximumWork: exactWork - 1, maximumCreatedRecords: 1 });
  assert.equal(under.database.run(under.queries.produceType, request).kind, "refused");
  assert.equal(under.database.stats().some(row => row.name === "membersOf"), false);
  const exact = openQueries({ ...instantiation, maximumWork: exactWork, maximumCreatedRecords: 1 });
  assert.equal(exact.database.run(exact.queries.produceType, request).kind, "completed");
  assert.equal(exact.database.run(exact.queries.produceType, structuredClone(request)).kind, "completed");
  const one = openQueries({ ...instantiation, maximumCreatedRecords: 1 });
  assert.equal(one.database.run(one.queries.produceType, request).kind, "completed");
  const secondKey = one.database.run(one.queries.produceType, requestOf(recur.type.indexType.tsonic.type.value));
  assert.equal(secondKey.kind, "refused");
  assert.deepEqual(secondKey.diagnostics[0].arguments,
    [{ kind: "text", value: "type production result-entries" }, { kind: "number", value: 1 }]);
});

test("bound indexed access selects exact numeric and unique-symbol keys without coercion", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export declare const key: unique symbol;
    export declare const other: unique symbol;
    export type Pick<K> = { 32: boolean; "1.5": boolean; [key]: string }[K];
    export type Numeric = 0x20;
    export type SymbolKey = typeof key;
    export type WrongNumber = 1.5;
    export type WrongSymbol = typeof other;
    export type WrongText = "32";
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [, , open, numeric, symbol, ...wrong] = modules
    .find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const component = { root: { kind: "item", value: { owner: open.tsonic.definition, node: open.type.id } }, path: [] };
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const select = alias => database.run(queries.produceType, { component, bindings: {
    classBindings: [{ kind: "bound", parameter, type: alias.type.tsonic.type.value }],
    methodBindings: [], capturedBindings: [], selfBindings: [],
  } });
  for (const [alias, expected] of [[numeric, { kind: "primitive", primitive: "bool" }], [symbol, { kind: "string" }]]) {
    const result = select(alias);
    assert.equal(result.kind, "completed");
    assert.deepEqual(fixture.types.readType(types, result.value.type), expected);
  }
  for (const alias of wrong) {
    const result = select(alias);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics[0].code.rendered, "TSONIC_LOCAL_TYPE_UNSUPPORTED");
    assert.deepEqual(result.diagnostics[0].site.origin, open.type.origin);
  }
  assert.equal(database.stats().find(row => row.name === "membersOf").computed, 1);
  assert.equal(database.stats().find(row => row.name === "memberTypeOf").computed, 2);
});

test("bound finite numeric indexed reads publish one exact choice after all selected members", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    type Table = { left: 9007199254740992; right: 9007199254740993; same: 9007199254740992 };
    export type Select<Key> = Table[Key];
    export type Both = Table["right" | "left"];
    export type Equal = Table["same" | "left"];
    export type Missing = "left" | "notThere";
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [, open, both, equal, missing] = modules
    .find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const component = { root: { kind: "item", value: { owner: open.tsonic.definition, node: open.type.id } }, path: [] };
  const { instantiation } = input.limits;
  const databaseOf = (maximumUnionMembers = instantiation.typeExpansion.maximumUnionMembers, query = input.limits.query) => {
    const limits = { ...instantiation, typeExpansion: { ...instantiation.typeExpansion, maximumUnionMembers } };
    return bindSourceSemantics(createSourceSemanticDatabase, {
      declarations: { modules, types, typeWork, typeExpansion: limits.typeExpansion }, instantiation: limits,
    }, {
      groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
    }, query);
  };
  const run = ({ database, queries }, type) => database.run(queries.produceType, { component, bindings: {
    classBindings: [{ kind: "bound", parameter, type }], methodBindings: [], capturedBindings: [], selfBindings: [],
  } });
  const reads = state => state.database.stats().find(row => row.name === "memberTypeOf")?.computed ?? 0;
  const state = databaseOf(3);
  for (const alias of [both, equal]) {
    const result = run(state, alias.type.indexType.tsonic.type.value);
    assert.equal(result.kind, "completed");
    assert.equal(result.value.type, alias.type.tsonic.type.value);
    assert.deepEqual(result.value.category, { kind: "known", category: "number" });
  }
  assert.equal(reads(state), 3);
  assert.equal(state.database.stats().find(row => row.name === "membersOf").computed, 1);
  const isolated = databaseOf(3);
  const missingResult = run(isolated, missing.type.tsonic.type.value);
  assert.equal(missingResult.kind, "refused");
  assert.equal(missingResult.diagnostics[0].code.rendered, "TSONIC_LOCAL_TYPE_UNSUPPORTED");
  assert.equal(reads(isolated), 0);
  const narrow = databaseOf(2);
  const refused = run(narrow, both.type.indexType.tsonic.type.value);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics[0].code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(narrow.database.stats().some(row => row.name === "membersOf"), false);
  for (const maximumRecords of [5, 6, 7]) {
    const cut = databaseOf(3, { maximumRecords });
    const result = run(cut, both.type.indexType.tsonic.type.value);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics[0].arguments[0].value, "query.maximumRecords");
    assert.equal(reads(cut) < 2, true);
  }
});

test("bound mixed scalar indexed results match the actual closed cases without rounding numbers", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    type Table = { flag: boolean; label: string; literal: "open"; nil: undefined; quantity: number; exact: 9007199254740993 };
    export type Select<Key> = Table[Key];
    export type Mixed = Table["flag" | "label"];
    export type Maybe = Table["flag" | "nil"];
    export type Absorbed = Table["label" | "literal"];
    export type MissingInclusion = "quantity" | "exact";
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [, open, mixed, maybe, absorbed, needsInclusion] = modules
    .find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const component = { root: { kind: "item", value: { owner: open.tsonic.definition, node: open.type.id } }, path: [] };
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const run = type => database.run(queries.produceType, { component, bindings: {
    classBindings: [{ kind: "bound", parameter, type }], methodBindings: [], capturedBindings: [], selfBindings: [],
  } });
  const known = category => ({ kind: "known", category });
  for (const [alias, category] of [
    [mixed, { kind: "choice", alternatives: [known("boolean"), known("string")] }],
    [maybe, { kind: "choice", alternatives: [known("boolean"), known("absence")] }],
    [absorbed, known("string")],
  ]) {
    const result = run(alias.type.indexType.tsonic.type.value);
    assert.equal(result.kind, "completed");
    assert.equal(result.value.type, alias.type.tsonic.type.value);
    assert.deepEqual(result.value.category, category);
  }
  const refused = run(needsInclusion.type.tsonic.type.value);
  assert.equal(refused.kind, "refused");
  assert.match(refused.diagnostics[0].message, /lacks exact inclusion evidence/u);
  assert.equal(database.stats().find(row => row.name === "membersOf").computed, 1);
  assert.equal(database.stats().find(row => row.name === "memberTypeOf").computed, 6);
});

test("bound indexed access returns the actual numeric or symbol read type with its source category", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export declare const token: unique symbol;
    type Fields = { integer: 42; token: typeof token; amount: number; plainSymbol: symbol };
    export type Pick<K> = { integer: 42; token: typeof token; amount: number; plainSymbol: symbol }[K];
    export type Integer = Fields["integer"];
    export type Token = Fields["token"];
    export type Amount = Fields["amount"];
    export type PlainSymbol = Fields["plainSymbol"];
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [, , open, ...closed] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const component = { root: { kind: "item", value: { owner: open.tsonic.definition, node: open.type.id } }, path: [] };
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  for (const [index, alias] of closed.entries()) {
    const result = database.run(queries.produceType, { component, bindings: {
      classBindings: [{ kind: "bound", parameter, type: alias.type.indexType.tsonic.type.value }],
      methodBindings: [], capturedBindings: [], selfBindings: [],
    } });
    assert.equal(result.kind, "completed");
    assert.deepEqual(result.value, { component: component.root, type: alias.type.tsonic.type.value,
      category: { kind: "known", category: index % 2 === 0 ? "number" : "symbol" },
      numeric: null, nominal: null, pointer: null, sum: null });
  }
  assert.equal(database.stats().find(row => row.name === "membersOf").computed, 1);
  assert.equal(database.stats().find(row => row.name === "memberTypeOf").computed, closed.length);
});

test("an actual direct conditional keeps all four operands without choosing a branch", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { readType, viewTypes, printTypes, parseTypes, substitute } = fixture.types;
  const input = analysisInput(fixture, "sdk-minimal",
    'export type Choose<T> = T extends false ? "done" : "next";'
    + 'export type Closed = false extends false ? "done" : "next";');
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules } = captured.value;
  const [alias, closed] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const node = alias.type;
  assert.equal(node.kind, "ConditionalType");
  const type = node.tsonic.type.value;
  const check = node.checkType.tsonic.type.value;
  const extended = node.extendsType.tsonic.type.value;
  const whenTrue = node.trueType.tsonic.type.value;
  const whenFalse = node.falseType.tsonic.type.value;
  const parameter = alias.typeParameters.nodes[0].tsonic.parameter.declaration;
  assert.deepEqual(readType(types, check), { kind: "param", parameter });
  const projection = { kind: "conditional", extends: extended, whenTrue, whenFalse, distributive: true, inferParameter: null };
  assert.deepEqual(readType(types, type), { kind: "projection", source: check, projection });
  assert.deepEqual(readType(types, closed.type.tsonic.type.value).value, { kind: "string", value: "done" });
  const bound = substitute(types, [type], {
    classBindings: [{ kind: "bound", parameter, type: extended }], methodBindings: [], capturedBindings: [], selfBindings: [],
  }, input.limits.instantiation.typeExpansion, captured.value.typeWork);
  assert.equal(bound.kind, "complete");
  assert.deepEqual(readType(types, bound.value[0]), { kind: "projection", source: extended, projection });
  const table = viewTypes(types);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });

  const capture = pipelineWiring.front.captureModule;
  let crossed = false;
  try {
    pipelineWiring.front.captureModule = (...arguments_) => {
      const result = capture(...arguments_);
      if (result.kind !== "ok" || result.value.module !== input.snapshot.entryPoint) return result;
      const module = result.value;
      const types = module.types.types.map(row => {
        if (row.form.kind !== "available" || row.form.value.kind !== "conditional") return row;
        crossed = true;
        return { ...row, form: { kind: "available", value: { ...row.form.value, whenFalse: row.form.value.whenTrue } } };
      });
      return { ...result, value: { ...module, types: { ...module.types, types } } };
    };
    assert.throws(() => captureSourceBarrier(input), /conditional projection operand must retain its actual checked child/u);
    assert.equal(crossed, true);
  } finally {
    pipelineWiring.front.captureModule = capture;
  }
});

test("bound keyof uses only the exact member inventory and never guesses an index domain", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export type Keys<T> = keyof T;
    export type Shape = { z: boolean; alpha?: string };
    export type ShapeKeys = keyof Shape;
    export declare const symbolKey: unique symbol;
    export type Mixed = { plain: boolean; [symbolKey]: string };
    export type MixedKeys = keyof Mixed;
    export type Empty = {};
    export type EmptyKeys = keyof Empty;
    export type Budget = { freshFirst: boolean; freshSecond: string };
    export type Indexed = { left:boolean; right:boolean; [key:string]: boolean };
    export type IndexedKeys = keyof Indexed;
    export type NumberIndex = { separate:boolean; [key:number]: string };
    export type NumberIndexKeys = keyof NumberIndex;
    export type SymbolIndex = { [symbolKey]:boolean; [key:symbol]: boolean };
    export type SymbolIndexKeys = keyof SymbolIndex;
    export type CombinedIndex = { [symbolKey]:boolean; [text:string]:boolean; [symbol:symbol]:boolean };
    export type CombinedIndexKeys = keyof CombinedIndex;
    export type NumericShape = { 1: boolean; "1.5": boolean; 0x20: string; 9007199254740993: boolean };
    export type NumericKeys = keyof NumericShape;
    export type Uncertain = unknown;
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { modules, types, descriptions, typeWork } = captured.value;
  const main = modules.find(row => row.module.module === input.snapshot.entryPoint).module;
  const aliases = new Map(main.tree.statements.nodes.filter(node => node.kind === "TypeAliasDeclaration").map(node => [node.name.text, node]));
  const open = aliases.get("Keys");
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const component = { root: { kind: "item", value: { owner: open.tsonic.definition, node: open.type.id } }, path: [] };
  const request = binding => ({ component, bindings: {
    classBindings: [binding], methodBindings: [], capturedBindings: [], selfBindings: [],
  } });
  const typeOf = name => aliases.get(name).type.tsonic.type.value;
  const { instantiation } = input.limits;
  const openDatabase = maximumUnionMembers => bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: { ...instantiation.typeExpansion, maximumUnionMembers } }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const run = (state, binding) => state.database.run(state.queries.produceType, request(binding));
  const bound = type => ({ kind: "bound", parameter, type });
  const membersOf = pipelineWiring.decls.membersOf;
  const memberTypeOf = pipelineWiring.decls.memberTypeOf;
  const receivers = [];
  try {
    pipelineWiring.decls.membersOf = (deps, receiver) => { receivers.push(receiver); return membersOf(deps, receiver); };
    pipelineWiring.decls.memberTypeOf = () => assert.fail("keyof cannot ask for a member value type");
    const state = openDatabase(2);
    const rigid = run(state, { kind: "rigid", parameter });
    assert.equal(rigid.kind, "completed");
    assert.equal(rigid.value.type, typeOf("Keys"));
    assert.deepEqual(receivers, []);
    for (const [name, category] of [
      ["Shape", { kind: "known", category: "string" }],
      ["Mixed", { kind: "choice", alternatives: [{ kind: "known", category: "string" }, { kind: "known", category: "symbol" }] }],
      ["Empty", { kind: "dynamic" }],
    ]) {
      const result = run(state, bound(typeOf(name)));
      assert.equal(result.kind, "completed");
      assert.equal(result.value.type, typeOf(name + "Keys"));
      assert.deepEqual(result.value.category, category);
      assert.equal(run(state, bound(typeOf(name))).value === result.value, true);
    }
    assert.deepEqual(receivers, ["Shape", "Mixed", "Empty"].map(typeOf));

    const before = fixture.types.viewTypes(types).terms.length;
    const refused = run(openDatabase(1), bound(typeOf("Budget")));
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics[0].code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(refused.diagnostics[0].site.origin, open.type.origin);
    assert.equal(fixture.types.viewTypes(types).terms.slice(before).some(term => term.kind === "literal"), false);
    assert.equal(run(openDatabase(2), bound(typeOf("Budget"))).kind, "completed");
    assert.equal(run(openDatabase(0), bound(typeOf("Empty"))).kind, "completed");

    const uncertain = run(state, bound(typeOf("Uncertain")));
    assert.equal(uncertain.kind, "refused");
    assert.equal(uncertain.diagnostics[0].code.rendered, "TSONIC_LOCAL_TYPE_UNSUPPORTED");
    for (const [name, maximum, categories] of [
      ["Indexed", 2, ["number", "string"]],
      ["NumberIndex", 2, ["number", "string"]],
      ["SymbolIndex", 1, ["symbol"]],
      ["CombinedIndex", 3, ["number", "string", "symbol"]],
    ]) {
      const result = run(openDatabase(maximum), bound(typeOf(name)));
      assert.equal(result.kind, "completed");
      assert.equal(result.value.type, typeOf(name + "Keys"));
      const alternatives = categories.map(category => ({ kind: "known", category }));
      assert.deepEqual(result.value.category, alternatives.length === 1 ? alternatives[0] : { kind: "choice", alternatives });
      const shortage = run(openDatabase(maximum - 1), bound(typeOf(name)));
      assert.equal(shortage.kind, "refused");
      assert.equal(shortage.diagnostics[0].code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    }
    const indexed = fixture.types.readType(types, typeOf("Indexed"));
    const badIndex = insertFixtureType(fixture.types, types, { ...indexed, indexes: [{ ...indexed.indexes[0], key: typeOf("Shape") }] });
    assert.throws(() => run(openDatabase(2), bound(badIndex)), /actual effective key domain of its non-scalar index signature/u);

    const shape = fixture.types.readType(types, typeOf("Shape"));
    const numericShape = fixture.types.readType(types, typeOf("NumericShape"));
    assert.deepEqual(numericShape.members.map(member => member.key.kind === "text"
      ? member.key.value : member.key.value.numerator), [1n, 32n, 9007199254740992n, "1.5"]);
    const numericResult = run(openDatabase(4), bound(typeOf("NumericShape")));
    assert.equal(numericResult.kind, "completed");
    assert.equal(numericResult.value.type, typeOf("NumericKeys"));
    assert.equal(run(openDatabase(3), bound(typeOf("NumericShape"))).kind, "refused");

    const exact = { numerator: 9007199254740993n, denominator: 1n, negativeZero: false };
    const numeric = insertFixtureType(fixture.types, types, { ...shape, members: [{ ...shape.members[0], key: { kind: "number", value: exact } }] });
    const selected = run(state, bound(numeric));
    assert.equal(selected.kind, "completed");
    const literal = fixture.types.readType(types, selected.value.type);
    assert.deepEqual(literal.value, { kind: "number", value: exact });
    assert.deepEqual(fixture.types.readType(types, literal.base), { kind: "primitive", primitive: "float64" });
    assert.deepEqual(selected.value.category, { kind: "known", category: "number" });
  } finally {
    pipelineWiring.decls.membersOf = membersOf;
    pipelineWiring.decls.memberTypeOf = memberTypeOf;
  }
});

test("a bound singleton indexed access demands its actual nested keyof and shares the receiver inventory", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal", "export type Value<T> = T[keyof T]; export type Source = { only: boolean };");
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { modules, types, descriptions, typeWork } = captured.value;
  const [open, shape] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const owner = open.tsonic.definition;
  const receiver = shape.type.tsonic.type.value;
  const request = { component: { root: { kind: "item", value: { owner, node: open.type.id } }, path: [] }, bindings: {
    classBindings: [{ kind: "bound", parameter: open.typeParameters.nodes[0].tsonic.parameter.declaration, type: receiver }],
    methodBindings: [], capturedBindings: [], selfBindings: [],
  } };
  const { produceType, membersOf, memberTypeOf } = pipelineWiring.decls;
  const reads = [];
  try {
    pipelineWiring.decls.produceType = (...args) => { reads.push(["type", args[2].id]); return produceType(...args); };
    pipelineWiring.decls.membersOf = (...args) => { reads.push(["inventory", args[1]]); return membersOf(...args); };
    pipelineWiring.decls.memberTypeOf = (...args) => { reads.push(["member", args[1]]); return memberTypeOf(...args); };
    const result = database.run(queries.produceType, request);
    assert.equal(result.kind, "completed");
    assert.equal(result.value.type, shape.type.members.nodes[0].type.tsonic.type.value);
    assert.deepEqual(result.value.category, { kind: "known", category: "boolean" });
    assert.deepEqual(reads, [
      ["type", open.type.id], ["type", open.type.indexType.id], ["inventory", receiver], ["member", { receiver, member: 0 }],
    ]);
  } finally {
    Object.assign(pipelineWiring.decls, { produceType, membersOf, memberTypeOf });
  }
});

test("the bound conditional consumes the wired noncoercive match and retains only its actual selected branch", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal",
    'export type Choose<T> = T extends false ? "done" : "next";'
    + 'export type Yes = false extends false ? "done" : "next";'
    + 'export type No = true extends false ? "done" : "next";');
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [open, yes, no] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const owner = open.tsonic.definition;
  const component = { root: { kind: "item", value: { owner, node: open.type.id } }, path: [] };
  const parameter = open.typeParameters.nodes[0].tsonic.parameter.declaration;
  const request = binding => ({ component, bindings: {
    classBindings: [binding], methodBindings: [], capturedBindings: [], selfBindings: [],
  } });
  const expected = open.type.extendsType.tsonic.type.value;
  const match = pipelineWiring.rules.matchTypePattern;
  const invocations = [];
  try {
    pipelineWiring.rules.matchTypePattern = (check, pattern) => {
      invocations.push([check, pattern]);
      return match(check, pattern);
    };
    const rigid = database.run(queries.produceType, request({ kind: "rigid", parameter }));
    assert.equal(rigid.kind, "completed");
    assert.equal(rigid.value.type, open.type.tsonic.type.value);
    assert.deepEqual(invocations, []);
    const matching = database.run(queries.produceType, request({ kind: "bound", parameter, type: expected }));
    assert.equal(matching.kind, "completed");
    assert.equal(matching.value.type, yes.type.tsonic.type.value);
    const other = no.type.checkType.tsonic.type.value;
    const rejected = database.run(queries.produceType, request({ kind: "bound", parameter, type: other }));
    assert.equal(rejected.kind, "completed");
    assert.equal(rejected.value.type, no.type.tsonic.type.value);
    const falseText = open.type.falseType.tsonic.type.value;
    const distinctCategory = database.run(queries.produceType, request({ kind: "bound", parameter, type: falseText }));
    assert.equal(distinctCategory.kind, "completed");
    assert.equal(distinctCategory.value.type, rejected.value.type);
    const inputs = [[expected, expected], [other, expected], [falseText, expected]];
    assert.equal(invocations.length, inputs.length);
    for (const [ordinal, [check, pattern]] of inputs.entries()) {
      assert.equal(invocations[ordinal][0] === fixture.types.readType(types, check), true);
      assert.equal(invocations[ordinal][1] === fixture.types.readType(types, pattern), true);
    }
    assert.equal(database.stats().some(row => row.name === "membersOf" || row.name === "memberTypeOf"), false);
  } finally {
    pipelineWiring.rules.matchTypePattern = match;
  }
});

test("conditional symbol patterns use actual unique declarations without coercing text or broad symbol", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const input = analysisInput(fixture, "sdk-minimal", `
    export declare const first: unique symbol;
    export declare const second: unique symbol;
    export type Broad<T> = T extends symbol ? "yes" : "no";
    export type Exact<T> = T extends typeof first ? "yes" : "no";
    export type First = typeof first;
    export type Second = typeof second;
    export type Plain = symbol;
    export type Text = "symbol";
  `);
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const { instantiation } = input.limits;
  const { database, queries } = bindSourceSemantics(createSourceSemanticDatabase, {
    declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
  }, {
    groups: [], sources: checkedSourceViews(modules), bindingScopeOf: definition => descriptions.get(definition).generics,
  }, input.limits.query);
  const nodes = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const [broad, exact, first, second, plain, text] = nodes.filter(node => node.kind === "TypeAliasDeclaration");
  const firstTerm = fixture.types.readType(types, first.type.tsonic.type.value);
  const secondTerm = fixture.types.readType(types, second.type.tsonic.type.value);
  assert.equal(firstTerm.kind === "literal" && firstTerm.value.kind === "unique-symbol", true);
  assert.equal(secondTerm.kind === "literal" && secondTerm.value.kind === "unique-symbol", true);
  assert.notEqual(firstTerm.value.declaration, secondTerm.value.declaration);
  for (const [pattern, check, matches] of [[broad, first, true], [broad, second, true], [broad, plain, true],
    [broad, text, false], [exact, first, true], [exact, second, false], [exact, plain, false], [exact, text, false]]) {
    const component = { root: { kind: "item", value: { owner: pattern.tsonic.definition, node: pattern.type.id } }, path: [] };
    const parameter = pattern.typeParameters.nodes[0].tsonic.parameter.declaration;
    const result = database.run(queries.produceType, { component, bindings: {
      classBindings: [{ kind: "bound", parameter, type: check.type.tsonic.type.value }],
      methodBindings: [], capturedBindings: [], selfBindings: [],
    } });
    assert.equal(result.kind, "completed");
    assert.equal(result.value.type, pattern.type[matches ? "trueType" : "falseType"].tsonic.type.value);
  }
  assert.equal(database.stats().some(row => row.name === "membersOf" || row.name === "memberTypeOf"), false);
});

test("a nested conditional key completes its own request before any inventory or member read", async () => {
  const fixture = await loadFrontFixture();
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { createSourceSemanticDatabase } = await import("../../packages/host/dist/pipeline/semantic-queries.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const input = analysisInput(fixture, "sdk-minimal",
    'export type Select<T> = { done: boolean; next: string }[T extends false ? "done" : "next"];'
    + 'export type Control = { done: boolean; next: string }["done"];');
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok");
  const { types, modules, descriptions, typeWork } = captured.value;
  const [select, control] = modules.find(row => row.module.module === input.snapshot.entryPoint).module.tree.statements.nodes;
  const root = { kind: "item", value: { owner: select.tsonic.definition, node: select.type.id } };
  const index = select.type.indexType;
  const parameter = select.typeParameters.nodes[0].tsonic.parameter.declaration;
  const request = { component: { root, path: [] }, bindings: {
    classBindings: [{ kind: "bound", parameter, type: index.extendsType.tsonic.type.value }],
    methodBindings: [], capturedBindings: [], selfBindings: [],
  } };
  const open = maximumCreatedRecords => {
    const instantiation = { ...input.limits.instantiation, maximumCreatedRecords };
    return bindSourceSemantics(createSourceSemanticDatabase, {
      declarations: { modules, types, typeWork, typeExpansion: instantiation.typeExpansion }, instantiation,
    }, {
      groups: [], sources: checkedSourceViews(modules), bindingScopeOf: owner => descriptions.get(owner).generics,
    }, input.limits.query);
  };
  const produce = pipelineWiring.decls.produceType;
  const members = pipelineWiring.decls.membersOf;
  const member = pipelineWiring.decls.memberTypeOf;
  const reads = [];
  try {
    pipelineWiring.decls.produceType = (...args) => { reads.push(args[2].id); return produce(...args); };
    pipelineWiring.decls.membersOf = (...args) => { reads.push("inventory"); return members(...args); };
    pipelineWiring.decls.memberTypeOf = (...args) => { reads.push("member"); return member(...args); };
    const complete = open(2);
    const result = complete.database.run(complete.queries.produceType, request);
    assert.equal(result.kind, "completed");
    assert.equal(result.value.type, control.type.tsonic.type.value);
    assert.deepEqual(reads, [select.type.id, index.id, "inventory", "member"]);
    reads.length = 0;
    const limited = open(1);
    const stopped = limited.database.run(limited.queries.produceType, request);
    assert.equal(stopped.kind, "refused");
    assert.deepEqual(stopped.diagnostics[0].site, { kind: "source", origin: index.origin });
    assert.deepEqual(reads, [select.type.id]);
  } finally {
    pipelineWiring.decls.produceType = produce;
    pipelineWiring.decls.membersOf = members;
    pipelineWiring.decls.memberTypeOf = member;
  }
});
