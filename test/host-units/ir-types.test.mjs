import { admitFixtureTable, fixtureTypeAdmission, fixtureTypeWork, insertFixtureType, insertFixtureSignature, insertFixtureGraph } from "./fixtures/types-construction.mjs";
import { accountFailure, chargeResultEntries, chargeWork, createAccount, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { encodePackageId, encodeModuleId, encodeDefId, decodeDefId, encodeBodyId, encodeGroupId, encodeKey } from "../../packages/host/dist/ids/index.js";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { nativeFactsCases } from "./ir-types-native-facts.cases.mjs";
import { bindingVerificationCases } from "./fixtures/types-binding-verification.mjs";
import { graphInsertionCases } from "./fixtures/types-graph-insertion.mjs";
import { literalCompatibilityCases } from "./fixtures/types-literal-compatibility.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const productNames = ["index", "work", "value", "selector-path", "arena", "interner", "intern-graph", "graph-stage", "canonical", "source-choice", "copy", "publication-fields", "publication-read", "substitute", "print", "parse", "text-readers", "text-values", "text-components", "text-records", "verify", "verify-bindings", "native-facts", "native-carrier", "literal-compatibility"];
const runtimeFiles = productNames.map(name => resolve(repository, `packages/host/dist/ir-types/${name}.js`));
const sourceFiles = [...productNames, "contract", "data", "native-facts-data"].map(name => resolve(repository, `packages/host/src/ir-types/${name}.ts`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product, createTypeInterner, readType, readSignature, viewTypes, exportTypes,
  substitute, substituteSignature, projectBindingValues, printTypes, parseTypes, runTypeVerifier, encodeSelectorPath,
  instanceKey, sameInstance, executionKey, declaredExecutionKey, bindingVectorKey, artifactBindingsKey, bindingVectorData,
  artifactBindingsData, signatureRequestData, signatureRequestKey, typeProductionRequestData, rigidBindings;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the whole suite requires aggregate admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/ir-types/index.js");
  ({ createTypeInterner, readType, readSignature, viewTypes, exportTypes,
    substitute, substituteSignature, projectBindingValues, printTypes, parseTypes, verifyTypes: runTypeVerifier, encodeSelectorPath, instanceKey, sameInstance, executionKey,
    declaredExecutionKey, bindingVectorKey, artifactBindingsKey, bindingVectorData, artifactBindingsData,
    signatureRequestData, signatureRequestKey, typeProductionRequestData, rigidBindings } = product);
});
const moduleId = encodeModuleId({ package: encodePackageId("ir-types-tests"), path: "main.ts" });
const definition = name => encodeDefId({ module: moduleId, segments: [{ name, ordinal: 0 }] });
const parameterDeclaration = (owner, ordinal) => {
  const decoded = decodeDefId(owner);
  assert.equal(decoded.kind, "decoded");
  return encodeDefId({ module: decoded.value.module, segments: [...decoded.value.segments, { name: `T${ordinal}`, ordinal: 0 }] });
};
const owner = definition("Owner");
const other = definition("Other");
test("paid table admission rejects foreign aliases, retains the actual nested field, and owns its input", () => {
  const start = (maximumWork = 10000, maximumResultEntries = 10000) => {
    const account = createAccount({ maximumWork, maximumResultEntries });
    return { account, work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) };
  };
  const label = { kind: "string" };
  const tuple = elements => ({ kind: "tuple", elements, readonly: false });
  assert.deepEqual(product.admitTypeTable({ terms: [label, label], signatures: [] }, start()), {
    kind: "invalid", violations: [{ rule: "canonical-representative", site: { kind: "type", type: 1 },
      detail: [{ kind: "text", value: "terms" }] }],
  });
  assert.deepEqual(product.admitTypeTable({ terms: [label, tuple(new Array(1))], signatures: [] }, start()), {
    kind: "invalid", violations: [{ rule: "type-reference", site: { kind: "type", type: 1 },
      detail: [{ kind: "text", value: "elements[0]" }] }],
  });
  const element = { kind: "required", type: 0, declaration: null };
  const foreign = { terms: [label, tuple([element])], signatures: [] };
  const result = product.admitTypeTable(foreign, start());
  assert.equal(result.kind, "complete");
  const actual = readType(result.types, 1);
  assert.equal(actual === foreign.terms[1] || actual.elements[0] === element, false);
  element.type = 500;
  foreign.terms.push({ kind: "error" });
  assert.equal(viewTypes(result.types).terms.length, 2);
  assert.equal(readType(result.types, 1) === actual, true);
  assert.deepEqual(actual, tuple([{ ...element, type: 0 }]));
  assert.equal(product.admitTypeTable(foreign, start()).kind, "invalid");
  const rec = { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [
    { id: 0, declaration: null, owner: null, composition: null, kind: "call", typeParameters: [],
      receiver: null, parameters: [], result: 0 },
  ] };
  for (const dimension of ["work", "result-entries"]) {
    const run = maximum => {
      const budget = dimension === "work" ? start(maximum) : start(10000, maximum);
      const selected = product.admitTypeTable(rec, budget);
      if (selected.kind === "complete") return true;
      assert.deepEqual(selected, { kind: "resource-limit", dimension, maximum });
      assert.equal(selected === accountFailure(budget.account), true);
      assert.equal(product.admitTypeTable(rec, budget) === selected, true);
      return false;
    };
    let exact = 0;
    while (exact < 500 && !run(exact)) exact++;
    assert.equal(exact < 500 && run(exact + 1), true, dimension);
  }
});

test("foreign Types admission requires both actual vector envelopes before reading any row", () => {
  const term = { kind: "intrinsic", intrinsic: "void" };
  const expected = (rule, field) => ({ kind: "invalid", violations: [violation(rule, { kind: "table" }, field)] });
  const mustNotRead = () => assert.fail("unadmitted Types envelope must precede any row read");
  const arrayLike = { length: 1, get 0() { return mustNotRead(); } };
  for (const terms of [{ length: 0 }, arrayLike])
    assert.deepEqual(product.admitTypeTable({ terms, signatures: [] }, fixtureTypeAdmission()), expected("type-reference", "terms"));
  const valid = [term];
  const unread = [term];
  Object.defineProperty(unread, 0, { get: mustNotRead });
  for (const signatures of [{ length: 0 }, arrayLike])
    assert.deepEqual(product.admitTypeTable({ terms: unread, signatures }, fixtureTypeAdmission()), expected("signature-reference", "signatures"));
  assert.deepEqual(viewTypes(admitFixtureTable(product, { terms: valid, signatures: [] })), { terms: valid, signatures: [] });
  assert.deepEqual(product.admitTypeTable({ terms: [], signatures: Array(1) }, fixtureTypeAdmission()),
    { kind: "invalid", violations: [violation("signature-order", signatureSite(0), "id")] });
  for (const [maximumWork, maximumResultEntries, dimension] of [[4, 100, "work"], [100, 4, "result-entries"]]) {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const admission = { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) };
    const source = { get terms() { return mustNotRead(); }, get signatures() { return mustNotRead(); } };
    const refused = product.admitTypeTable(source, admission);
    assert.deepEqual(refused, { kind: "resource-limit", dimension, maximum: 4 });
    assert.equal(refused === accountFailure(account), true);
    assert.equal(product.admitTypeTable(source, admission) === refused, true);
  }
});

test("foreign Types admission reports each malformed vector or signature at its owning position", () => {
  const one = { kind: "string" };
  const badSignature = { id: 0, declaration: null, owner: null, composition: null, kind: "call", typeParameters: [],
    receiver: null, parameters: [], result: 0 };
  const shape = { kind: "shape", members: [], indexes: [], calls: [], constructs: [] };
  const component = { root: { kind: "item", value: { owner, node: 0 } }, path: [] };
  const family = { origin: "authored", component, parameters: [], roles: [] };
  const projection = path => ({ kind: "projection", source: 0, projection: { kind: "component", component: { ...component, path } } });
  const member = { key: { kind: "text", value: "field" }, origins: [{ kind: "declared", declaration: owner }],
    readOrigins: [{ kind: "declared", declaration: owner }], writeOrigins: [], kind: "property", read: 0, write: null,
    readonly: true, optional: false };
  const unregistered = { kind: "unregistered" };
  const rows = [
    [{ kind: "union", members: new Array(1) }, "members[0]"],
    [{ kind: "union", members: null }, "members"],
    [{ ...shape, members: new Array(1) }, "members[0]"],
    [{ ...shape, indexes: new Array(1) }, "indexes[0]"],
    [{ ...shape, members: [{ key: { kind: "text", value: "x" }, origins: new Array(1), readOrigins: [], writeOrigins: [],
      kind: "property", read: 0, write: null, readonly: true, optional: false }] }, "origins[0]"],
    [{ ...shape, calls: new Array(1) }, "calls[0]"],
    [{ kind: "construction-reference", definition: { occurrence: { body: encodeBodyId({ owner, role: "function", ordinal: 0 }), node: 0 },
      captures: new Array(1) }, arguments: [] }, "captures[0]"],
    [projection(new Array(1)), "path[0]"],
    [projection([{ kind: "sum-arm", index: 0, family: { ...family, parameters: new Array(1) } }]), "parameters[0]"],
    [projection([{ kind: "sum-arm", index: 0, family: { ...family, roles: new Array(1) } }]), "roles[0]"],
    [{ ...shape, members: [{ ...member, key: unregistered }] }, "$.members[0].key.kind"],
    [{ ...shape, members: [{ ...member, origins: [unregistered] }] }, "$.members[0].origins[0].kind"],
    [{ kind: "projection", source: 0, projection: { kind: "component", component: { ...component, root: unregistered } } },
      "$.projection.component.root.kind"],
    [projection([unregistered]), "$.projection.component.path[0].kind"],
    [{ kind: "projection", source: 0, projection: unregistered }, "$.projection.kind"],
    [{ kind: "literal", base: 0, value: unregistered }, "$.value.kind"],
    [null, "type"],
  ];
  for (const [row, field] of rows)
    assert.deepEqual(product.admitTypeTable({ terms: [one, row], signatures: [] }, fixtureTypeAdmission()),
      { kind: "invalid", violations: [violation("type-reference", typeSite(1), field)] }, field);
  const sparse = [one];
  sparse.length = 2;
  assert.deepEqual(product.admitTypeTable({ terms: sparse, signatures: [] }, fixtureTypeAdmission()),
    { kind: "invalid", violations: [violation("type-reference", typeSite(1), "terms")] });
  for (const [signature, field] of [[{ ...badSignature, parameters: new Array(1) }, "parameters[0]"],
    [{ ...badSignature, typeParameters: new Array(1) }, "typeParameters[0]"], [{ ...badSignature, kind: "not-a-signature" }, "kind"],
    [{ ...badSignature, composition: unregistered }, "$.composition.kind"]]) {
    assert.deepEqual(product.admitTypeTable({ terms: [one], signatures: [signature] }, fixtureTypeAdmission()),
      { kind: "invalid", violations: [violation("signature-reference", signatureSite(0), field)] });
  }
});

test("foreign Types admission rejects malformed scalar fields before interpreting or reading past their row", () => {
  const run = (table, maximumWork = 10000) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 10000 });
    return { account, checked: product.admitTypeTable(table,
      { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) }) };
  };
  for (const [field, value, maximum] of [["kind", "unregistered-type-kind", 7], ["primitive", "not-a-carrier", 8]]) {
    let read = 0;
    const row = field === "primitive" ? { kind: "primitive" } : {};
    Object.defineProperty(row, field, { enumerable: true, get: () => { read++; return value; } });
    const terms = [row];
    Object.defineProperty(terms, 1, { get: () => assert.fail("no next row after malformed scalar or owning stop") });
    const table = { terms, signatures: [] };
    const under = run(table, maximum);
    assert.equal(under.checked === accountFailure(under.account), true);
    assert.deepEqual(under.checked, { kind: "resource-limit", dimension: "work", maximum });
    assert.equal(read, 0);
    assert.deepEqual(run(table, maximum + 1).checked,
      { kind: "invalid", violations: [violation("type-reference", typeSite(0), field)] });
    assert.equal(read, 1);
  }
  const literal = value => ({ kind: "literal", value, base: 0 });
  const rational = { numerator: 9n, denominator: 2n, negativeZero: false };
  const native = { kind: "primitive", primitive: "float64" };
  for (const [row, field] of [
    [literal({ kind: "number", value: { ...rational, numerator: 9 } }), "$.value.value.numerator"],
    [literal({ kind: "number", value: { ...rational, denominator: 2 } }), "$.value.value.denominator"],
    [literal({ kind: "number", value: { ...rational, negativeZero: 0 } }), "$.value.value.negativeZero"],
    [literal({ kind: "bigint", value: 1 }), "$.value.value"],
    [{ kind: "fixed-array", element: 0, extent: { length: 1, runtimeBase: "bigint" } }, "$.extent.length"],
  ]) assert.deepEqual(run({ terms: [native, row], signatures: [] }).checked,
    { kind: "invalid", violations: [violation("type-reference", typeSite(1), field)] });
  assert.deepEqual(verifyTypes(verification([native, literal({ kind: "number", value: { ...rational, numerator: 9 } })])),
    [violation("rational-normalized", typeSite(1), "value")]);
  const valid = { terms: [native, literal({ kind: "number", value: rational })], signatures: [] };
  const admitted = run(valid).checked;
  assert.equal(admitted.kind, "complete");
  assert.deepEqual(viewTypes(admitted.types), valid);
});

test("computed scalar choices share exact Boolean, text, number, symbol and absence identities", async () => {
  const { joinSourceChoice } = await import("../../packages/host/dist/ir-types/index.js");
  const terms = createTypeInterner();
  const add = term => insertFixtureType(product, terms, term);
  const boolean = add({ kind: "primitive", primitive: "bool" });
  const text = add({ kind: "string" });
  const numeric = add({ kind: "primitive", primitive: "float64" });
  const symbol = add({ kind: "intrinsic", intrinsic: "symbol" });
  const never = add({ kind: "intrinsic", intrinsic: "never" });
  const absent = add({ kind: "intrinsic", intrinsic: "absence" });
  const voidType = add({ kind: "intrinsic", intrinsic: "void" });
  const otherCarrier = add({ kind: "primitive", primitive: "int64" });
  const literal = (base, value) => add({ kind: "literal", base, value });
  const limits = { maximumDepth: 8, maximumVisits: 2000, maximumUnionMembers: 3, maximumIntersectionMembers: 3 };
  const work = fixtureTypeWork(product);
  const join = (input, overrides) => joinSourceChoice({ types: terms, work }, input, { ...limits, ...overrides });
  const boolLiteral = value => literal(boolean, { kind: "boolean", value });
  const textLiteral = literal(text, { kind: "string", value: "a" });
  const symbolLiteral = literal(symbol, { kind: "unique-symbol", declaration: owner });
  const numericLiteral = literal(numeric, { kind: "number", value: { numerator: 9007199254740993n, denominator: 1n, negativeZero: false } });
  const known = category => ({ kind: "known", category });
  const choice = (...categories) => ({ kind: "choice", alternatives: categories.map(known) });
  const expected = (type, category) => ({ kind: "complete", value: { type, category } });
  assert.deepEqual(join([never]), expected(never, { kind: "dynamic" }));
  assert.deepEqual(join([voidType, absent]), expected(absent, known("absence")));
  for (const [broad, exact, category] of [[text, textLiteral, "string"], [symbol, symbolLiteral, "symbol"]])
    assert.deepEqual(join([exact, broad, exact]), expected(broad, known(category)));
  const prior = viewTypes(terms).terms.length;
  assert.deepEqual(join([numericLiteral, numeric]), { kind: "unavailable", reason: "numeric-inclusion" });
  assert.deepEqual(join([otherCarrier, text]), { kind: "unavailable", reason: "non-scalar" });
  assert.deepEqual(join([boolean, text], { maximumUnionMembers: 2 }), { kind: "resource-limit", dimension: "union-members", maximum: 2 });
  assert.equal(viewTypes(terms).terms.length, prior);
  const mixed = join([boolean, text]);
  const yes = boolLiteral(true);
  const no = boolLiteral(false);
  const union = members => add({ kind: "union", members });
  assert.deepEqual(mixed, expected(union([yes, no, text]), choice("boolean", "string")));
  assert.deepEqual(join([yes, text, boolean]), mixed);
  assert.deepEqual(join([no, text, boolean]), mixed);
  assert.deepEqual(join([text, no, yes]), mixed);
  assert.deepEqual(join([no]), expected(no, known("boolean")));
  assert.deepEqual(join([yes, no, never]), expected(boolean, known("boolean")));
  assert.deepEqual(join([boolean, no, never]), expected(boolean, known("boolean")));
  const optional = add({ kind: "optional", value: union([yes, no]) });
  assert.deepEqual(join([boolean, absent]), expected(optional, choice("boolean", "absence")));
  assert.deepEqual(join([optional, voidType]), expected(optional, choice("boolean", "absence")));
  assert.deepEqual(join([optional], { maximumDepth: 0 }), { kind: "resource-limit", dimension: "depth", maximum: 0 });
  assert.deepEqual(join([numericLiteral, text]), expected(union([numericLiteral, text]), choice("number", "string")));
  assert.deepEqual(join([numeric, text]), expected(union([numeric, text]), choice("number", "string")));
  assert.deepEqual(join([yes], { maximumVisits: 2 }), { kind: "resource-limit", dimension: "visits", maximum: 2 });
  const bigint = add({ kind: "intrinsic", intrinsic: "bigint" });
  assert.deepEqual(join([literal(bigint, { kind: "bigint", value: 1n })]), { kind: "unavailable", reason: "non-scalar" });
  assert.deepEqual(join([symbolLiteral]), expected(symbolLiteral, known("symbol")));
  assert.throws(() => join([]), /actual selected inputs/u);
  assert.throws(() => join(new Array(1)), /vector must be dense/u);
  assert.throws(() => join([text], { maximumVisits: -1 }), /nonnegative safe integers/u);
  const crossed = literal(text, { kind: "boolean", value: true });
  assert.throws(() => join([crossed]), /actual Boolean base/u);
});

test("every source-choice work cut precedes new type publication", async () => {
  const { joinSourceChoice } = await import("../../packages/host/dist/ir-types/index.js");
  const limits = { maximumDepth: 4, maximumVisits: 2000, maximumUnionMembers: 3, maximumIntersectionMembers: 3 };
  const arena = createTypeInterner();
  const boolean = insertFixtureType(product, arena, { kind: "primitive", primitive: "bool" });
  const text = insertFixtureType(product, arena, { kind: "string" });
  let exact = null;
  for (let maximumVisits = 0; maximumVisits < limits.maximumVisits; maximumVisits += 1) {
    const result = joinSourceChoice({ types: arena, work: fixtureTypeWork(product) }, [boolean, text], { ...limits, maximumVisits });
    if (result.kind === "complete") { exact = result; break; }
    assert.deepEqual(result, { kind: "resource-limit", dimension: "visits", maximum: maximumVisits });
    assert.equal(viewTypes(arena).terms.length, 2);
  }
  assert.ok(exact);
  assert.equal(readType(arena, exact.value.type).kind, "union");
});

test("atomic finite graph insertion shares the canonical Types owner", async suite =>
  graphInsertionCases(suite, await import("../../packages/host/dist/ir-types/index.js")));

test("a staged recursive equivalence with the committed family respects every owning cost cut", () => {
  const types = createTypeInterner();
  const array = element => ({ kind: "array", element, readonly: false });
  assert.deepEqual(insertFixtureGraph(product, types, [array(0)]), { types: [0], signatures: [] });
  const original = readType(types, 0);
  const graph = { typeBase: 1, signatureBase: 0, terms: [array(2), array(1)], signatures: [] };
  for (const dimension of ["work", "created-records"]) {
    let complete = false;
    for (let maximum = 0; maximum < 512; maximum++) {
      const work = product.createTypePublicationWork({ maximumWork: dimension === "work" ? maximum : 512,
        maximumCreatedRecords: dimension === "created-records" ? maximum : 512 });
      const invoke = () => product.internTypeGraph({ types, work }, graph);
      const result = invoke();
      assert.equal(viewTypes(types).terms.length === 1 && readType(types, 0) === original, true);
      assert.equal(viewTypes(types).signatures.length, 0);
      if (result.kind === "complete") {
        assert.deepEqual(result, { kind: "complete", value: { types: [0, 0], signatures: [] } });
        complete = true;
        break;
      }
      assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
      assert.equal(invoke() === result, true);
    }
    assert.equal(complete, true, dimension);
  }
});

test("one publication step consumes the existing work budget and returns its original stop", async () => {
  const { admitTypePublicationStep, createTypePublicationWork, internTypeGraph } = await import("../../packages/host/dist/ir-types/index.js");
  const types = createTypeInterner();
  const graph = { typeBase: 0, signatureBase: 0, terms: [], signatures: [] };
  const work = createTypePublicationWork({ maximumWork: 1, maximumCreatedRecords: 0 });
  assert.equal(admitTypePublicationStep(work), null);
  const limited = admitTypePublicationStep(work);
  assert.deepEqual(limited, { kind: "resource-limit", dimension: "work", maximum: 1 });
  assert.equal(internTypeGraph({ types, work }, graph), limited);
  const created = createTypePublicationWork({ maximumWork: 100, maximumCreatedRecords: 0 });
  const refused = internTypeGraph({ types, work: created }, graph);
  assert.deepEqual(refused, { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  assert.equal(admitTypePublicationStep(created), refused);
});

test("a scalar constructor emits one actual operation refusal from its original Types allowance", () => {
  const types = createTypeInterner();
  const boolean = product.internType(types, { kind: "primitive", primitive: "bool" });
  const string = product.internType(types, { kind: "string" });
  assert.equal(product.internType(types, { kind: "string" }), string);
  assert.throws(() => product.internType(types, { kind: "array", element: string, readonly: false }), /one paid closed graph admission/u);
  const request = { query: "produceType", key: ["actual"] };
  const origin = { module: moduleId, start: 0, length: 1, derived: [] };
  const work = product.createTypePublicationWork({ maximumWork: 10000, maximumCreatedRecords: 0 });
  assert.equal(product.typePublicationRefusalOf(work), null);
  assert.throws(() => product.admitTypePublicationStep(work, -1), /nonnegative safe count/u);
  const result = product.joinSourceChoice({ types, work }, [boolean, string], limits());
  assert.deepEqual(result, { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  assert.equal(product.admitTypePublicationStep(work) === result, true);
  assert.strictEqual(product.typePublicationRefusalOf(work), result);
  assert.throws(() => product.refuseTypeConstruction(work, { ...result }, origin, request), /original owning stop/u);
  const refused = product.refuseTypeConstruction(work, result, origin, request);
  assert.strictEqual(product.typePublicationRefusalOf(work), refused);
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics[0].site, { kind: "source", origin });
  assert.deepEqual(refused.diagnostics[0].evidence, ["created-records", request.query, encodeKey(request.key), encodeKey(["result"])]);
  assert.equal(product.refuseTypeConstruction(work, result, origin, request) === refused, true);
  assert.equal(viewTypes(types).terms.length, 2);
});
test("member-key comparison agrees with canonical shape order, including encoded text and numeric identity", async () => {
  const { compareMemberKeys } = await import("../../packages/host/dist/ir-types/index.js");
  const text = value => ({ kind: "text", value });
  const number = numerator => ({ kind: "number", value: { numerator, denominator: 1n, negativeZero: false } });
  const expected = [number(10n), number(2n), { kind: "symbol", declaration: owner }, text("Z"), text('"')];
  for (const [index, left] of expected.entries()) for (const [next, right] of expected.entries()) {
    assert.equal(Math.sign(compareMemberKeys(left, right)), Math.sign(index - next));
  }
  const arena = createTypeInterner();
  const value = insertFixtureType(product, arena, { kind: "primitive", primitive: "bool" });
  const origin = { kind: "declared", declaration: other };
  const shape = insertFixtureType(product, arena, { kind: "shape", indexes: [], calls: [], constructs: [],
    members: [...expected].reverse().map(key => ({ key, origins: [origin], readOrigins: [origin], writeOrigins: [],
      kind: "property", optional: false, readonly: true, read: value, write: null })),
  });
  assert.deepEqual(readType(arena, shape).members.map(member => member.key), expected);
});
test("optional domain evidence keeps the selected float64 or string base and complementary Boolean members", async () => {
  const { optionalValueDomainOf } = await import("../../packages/host/dist/ir-types/index.js");
  const arena = createTypeInterner();
  const bool = { kind: "primitive", primitive: "bool" };
  const present = insertFixtureType(product, arena, bool);
  const reference = insertFixtureType(product, arena, { kind: "string" });
  const other = insertFixtureType(product, arena, { kind: "primitive", primitive: "int32" });
  const positive = { kind: "literal", base: present, value: { kind: "boolean", value: true } };
  const negative = { kind: "literal", base: present, value: { kind: "boolean", value: false } };
  const yes = insertFixtureType(product, arena, positive);
  const no = insertFixtureType(product, arena, negative);
  const pair = { kind: "union", members: [yes, no] };
  const payload = insertFixtureType(product, arena, pair);
  const type = { kind: "optional", value: payload };
  const expected = { kind: "optional-value", payload: "boolean", present, category: { kind: "choice", alternatives: [
    { kind: "known", category: "boolean" }, { kind: "known", category: "absence" },
  ] } };
  const rejected = { kind: "not-optional-value" };
  const referenceOptional = { kind: "optional", value: reference };
  assert.deepEqual(optionalValueDomainOf(referenceOptional, value => readType(arena, value)),
    { kind: "optional-value", payload: "string", present: reference, category: { kind: "choice", alternatives: [
      { kind: "known", category: "string" }, { kind: "known", category: "absence" },
    ] } });
  assert.deepEqual(optionalValueDomainOf(referenceOptional, value => { assert.equal(value, reference); return null; }),
    { kind: "resource-stop" });
  const float = { kind: "primitive", primitive: "float64" };
  const numeric = insertFixtureType(product, arena, float);
  for (const admit of [false, true]) {
    const reads = [];
    const result = optionalValueDomainOf({ kind: "optional", value: numeric }, value => {
      reads.push(value);
      return admit ? readType(arena, value) : null;
    });
    assert.deepEqual(reads, [numeric]);
    assert.deepEqual(result, admit ? { kind: "optional-value", payload: "float64", present: numeric,
      category: { kind: "choice", alternatives: [{ kind: "known", category: "number" }, { kind: "known", category: "absence" }] } }
      : { kind: "resource-stop" });
  }
  assert.deepEqual(optionalValueDomainOf({ kind: "optional", value: present }, value => readType(arena, value)), expected);
  assert.deepEqual(optionalValueDomainOf({ kind: "optional", value: other }, value => readType(arena, value)), rejected);
  assert.deepEqual(optionalValueDomainOf(bool, () => assert.fail("non-optional reads no payload")), rejected);
  const order = [payload, ...readType(arena, payload).members, present];
  for (let allowance = 0; allowance <= order.length; allowance += 1) {
    const reads = [];
    const decision = optionalValueDomainOf(type, selected => {
      assert.equal(selected, order[reads.length]);
      reads.push(selected);
      return reads.length > allowance ? null : readType(arena, selected);
    });
    assert.deepEqual(reads, order.slice(0, allowance + 1));
    assert.deepEqual(decision, allowance === order.length ? expected : { kind: "resource-stop" });
  }
  assert.deepEqual(optionalValueDomainOf(type, () => ({ ...pair, members: new Array(2) })), rejected);
  assert.deepEqual(optionalValueDomainOf(type, selected => selected === payload ? { ...pair, members: [yes] } : assert.fail()), rejected);
  for (const [left, right, base] of [
    [bool, negative, bool],
    [positive, bool, bool],
    [positive, positive, bool],
    [positive, { ...negative, base: other }, bool],
    [positive, negative, readType(arena, other)],
  ]) {
    const terms = new Map([[payload, pair], [yes, left], [no, right], [present, base]]);
    assert.deepEqual(optionalValueDomainOf(type, selected => terms.get(selected)), rejected);
  }
});
test("the one selector-path encoding: each selector is one array beginning with its kind; equal paths are equal and every differing field differs", () => {
  const body = encodeBodyId({ owner: definition("Selected"), role: "function", ordinal: 0 });
  const otherBody = encodeBodyId({ owner: definition("Selected"), role: "function", ordinal: 1 });
  const node = (in_, number) => ({ kind: "body", value: { body: in_, node: number } });
  const item = (name, number) => ({ kind: "item", value: { owner: definition(name), node: number } });
  const construction = (number, captures) => ({ occurrence: { body, node: number }, captures });
  const family = (origin, path, extra = {}) => ({ origin, component: { root: node(body, 1), path },
    parameters: [parameterDeclaration(definition("Sum"), 0)], roles: [{ authoredIndex: 0, component: item("Sum", 2), member: 5 }], ...extra });
  assert.deepEqual(encodeSelectorPath([]), []);
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => encodeSelectorPath(sparse), TypeError, "a missing selector is not an empty path");
  assert.deepEqual(encodeSelectorPath([{ kind: "tuple-element", index: 2 }, { kind: "awaited" }]), [["tuple-element", 2], ["awaited"]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "k" } } }]),
    [["member", ["mapped", ["body", body, 7], ["text", "k"]]]]);
  for (const symbol of ["global-this", "undefined"])
    assert.deepEqual(encodeSelectorPath([{ kind: "member", origin: { kind: "intrinsic", symbol } }]),
      [["member", ["intrinsic", symbol]]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "construction-argument", definition: construction(3, [{ body, local: 4 }]), index: 1 }]),
    [["construction-argument", [body, 3], [[body, 4]], 1]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "sum-arm", family: family("authored", [{ kind: "optional-value" }]), index: 1 }]),
    [["sum-arm", "authored", ["body", body, 1], [["optional-value"]], [parameterDeclaration(definition("Sum"), 0)], [[0, ["item", definition("Sum"), 2], 5]], 1]]);
  const selectors = [
    ...["class-value", "optional-value", "array-element", "intersection-result", "projection-source", "awaited"].map(kind => ({ kind })),
    ...["tuple-element", "union-member", "argument-place", "parameter-place", "intersection-member"].flatMap(kind => [{ kind, index: 0 }, { kind, index: 1 }]),
    ...["argument-tail", "parameter-tail"].flatMap(kind => [{ kind, start: 0 }, { kind, start: 1 }]),
    { kind: "construction-argument", definition: construction(3, []), index: 0 },
    { kind: "construction-argument", definition: construction(3, []), index: 1 },
    { kind: "construction-argument", definition: construction(4, []), index: 0 },
    { kind: "construction-argument", definition: { occurrence: { body: otherBody, node: 3 }, captures: [] }, index: 0 },
    { kind: "construction-argument", definition: construction(3, [{ body, local: 0 }]), index: 0 },
    { kind: "construction-argument", definition: construction(3, [{ body, local: 1 }]), index: 0 },
    { kind: "construction-argument", definition: construction(3, [{ body, local: 0 }, { body, local: 1 }]), index: 0 },
    { kind: "member", origin: { kind: "declared", declaration: definition("A") } },
    { kind: "member", origin: { kind: "declared", declaration: definition("B") } },
    { kind: "member", origin: { kind: "class-prototype", owner: definition("A") } },
    { kind: "member", origin: { kind: "source-member", occurrence: { body, node: 7 } } },
    { kind: "member", origin: { kind: "source-member", occurrence: { body, node: 8 } } },
    { kind: "member", origin: { kind: "source-member", occurrence: { body: otherBody, node: 7 } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 8), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: item("A", 7), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "1" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 1n, denominator: 2n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "symbol", declaration: definition("A") } } },
    ...["index-key", "index-value"].flatMap(kind => [{ kind, origin: item("A", 0), key: 0 },
      { kind, origin: item("B", 0), key: 0 }, { kind, origin: item("A", 1), key: 0 },
      { kind, origin: node(body, 0), key: 0 }, { kind, origin: item("A", 0), key: 1 }]),
    { kind: "parameter", signature: 0, index: 0 }, { kind: "parameter", signature: 1, index: 0 }, { kind: "parameter", signature: 0, index: 1 },
    ...["receiver", "result"].flatMap(kind => [{ kind, signature: 0 }, { kind, signature: 1 }]),
    { kind: "signature-tail", signature: 0, start: 0, readonly: false }, { kind: "signature-tail", signature: 1, start: 0, readonly: false },
    { kind: "signature-tail", signature: 0, start: 1, readonly: false }, { kind: "signature-tail", signature: 0, start: 0, readonly: true },
    { kind: "tuple-slice", start: 0, endCount: 0, readonly: false }, { kind: "tuple-slice", start: 1, endCount: 0, readonly: false },
    { kind: "tuple-slice", start: 0, endCount: 1, readonly: false }, { kind: "tuple-slice", start: 0, endCount: 0, readonly: true },
    { kind: "type-argument", declaration: definition("A"), index: 0 }, { kind: "type-argument", declaration: definition("B"), index: 0 },
    { kind: "type-argument", declaration: definition("A"), index: 1 },
    { kind: "sum-arm", family: family("authored", []), index: 0 }, { kind: "sum-arm", family: family("authored", []), index: 1 },
    { kind: "sum-arm", family: family("inferred", []), index: 0 },
    { kind: "sum-arm", family: family("authored", [{ kind: "optional-value" }]), index: 0 },
    { kind: "sum-arm", family: family("authored", [{ kind: "sum-arm", family: family("authored", [{ kind: "array-element" }]), index: 0 }]), index: 0 },
    { kind: "sum-arm", family: family("authored", [{ kind: "sum-arm", family: family("authored", [{ kind: "class-value" }]), index: 0 }]), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { parameters: [] }), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { parameters: [parameterDeclaration(definition("Sum"), 1)] }), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { roles: [] }), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { roles: [{ authoredIndex: 1, component: item("Sum", 2), member: 5 }] }), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { roles: [{ authoredIndex: 0, component: item("Sum", 3), member: 5 }] }), index: 0 },
    { kind: "sum-arm", family: family("authored", [], { roles: [{ authoredIndex: 0, component: item("Sum", 2), member: 6 }] }), index: 0 },
    { kind: "sum-arm", family: { ...family("authored", []), component: { root: node(body, 2), path: [] } }, index: 0 },
  ];
  const keys = selectors.map(selected => encodeKey(encodeSelectorPath([selected])));
  assert.equal(new Set(keys).size, selectors.length, "every differing field gives a different key");
  assert.deepEqual(selectors.map(selected => encodeKey(encodeSelectorPath([structuredClone(selected)]))), keys, "an equal selector built again gives the same key");
  const first = selectors[0];
  const second = selectors[7];
  assert.notEqual(encodeKey(encodeSelectorPath([first, second])), encodeKey(encodeSelectorPath([second, first])), "order is part of the path");
  assert.notEqual(encodeKey(encodeSelectorPath([first])), encodeKey(encodeSelectorPath([first, first])), "length is part of the path");
  assert.notEqual(encodeKey(encodeSelectorPath([{ kind: "sum-arm", family: family("authored", [first, second]), index: 0 }])),
    encodeKey(encodeSelectorPath([{ kind: "sum-arm", family: family("authored", [first]), index: 0 }, second])),
    "a selector of a family's own path is not a selector of the outer path");
  const shared = [{ kind: "array-element" }];
  assert.deepEqual(encodeSelectorPath([
    { kind: "sum-arm", family: family("authored", shared), index: 0 },
    { kind: "sum-arm", family: family("inferred", shared), index: 1 },
  ]).map(selected => selected[3]), [[["array-element"]], [["array-element"]]],
  "sharing a completed path is not a cycle");
  const cyclic = [];
  cyclic.push({ kind: "sum-arm", family: family("authored", cyclic), index: 0 });
  assert.throws(() => encodeSelectorPath(cyclic), /acyclic/u, "a self cycle is a caller defect, not unbounded expansion");
  const firstPath = [];
  const secondPath = [{ kind: "sum-arm", family: family("authored", firstPath), index: 0 }];
  firstPath.push({ kind: "sum-arm", family: family("authored", secondPath), index: 0 });
  assert.throws(() => encodeSelectorPath(firstPath), /acyclic/u, "a cycle spanning paths is rejected at its actual repeated ancestor");
  let deep = [];
  for (let level = 0; level < 20000; level += 1) deep = [{ kind: "sum-arm", family: family("authored", deep), index: 0 }];
  let depth = 0;
  for (let current = encodeSelectorPath(deep); current.length === 1; current = current[0][3]) depth += 1;
  assert.equal(depth, 20000, "a deeply nested family path is encoded without native recursion");
});

test("selected native fact contract data has one exact canonical owner", async suite => {
  await nativeFactsCases(suite, await import("../../packages/host/dist/ir-types/index.js"));
});
test("canonical binding-only verification has one admitted traversal", async suite => {
  await bindingVerificationCases(suite, await import("../../packages/host/dist/ir-types/index.js"));
});
const method = definition("method");
test("selected literal compatibility is one charged structural relation", async suite => {
  await literalCompatibilityCases(suite, await import("../../packages/host/dist/ir-types/index.js"));
});
const captured = definition("captured");
const body = encodeBodyId({ owner, role: "function", ordinal: 0 });
const otherBody = encodeBodyId({ owner: other, role: "function", ordinal: 0 });
const caseDefinition = "D[M[P[case];main.ts];field]";
const caseOther = "D[M[P[case];main.ts];other]";
const caseEnum = "D[M[P[case];main.ts];enum]";
const caseBody = `B[${caseDefinition};function;0]`;
const declaredFacts = [
  { definition: owner, nominal: { kind: "declared", facets: ["instance", "value"] } },
  { definition: other, nominal: { kind: "declared", facets: ["instance"] } },
  { definition: definition("Enum"), nominal: { kind: "enum", facets: [] } },
  { definition: method, nominal: null },
  { definition: caseDefinition, nominal: { kind: "declared", facets: ["instance", "value"] } },
  { definition: caseOther, nominal: null },
  { definition: caseEnum, nominal: { kind: "enum", facets: [] } },
];
const bodyFacts = new Map([[body, { nodes: 2, locals: 2 }], [otherBody, { nodes: 1, locals: 1 }], [caseBody, { nodes: 2, locals: 2 }]]);
const itemFacts = new Map([[method, { nodes: 1 }], [owner, { nodes: 2 }], [other, { nodes: 1 }], [caseDefinition, { nodes: 2 }],
  ["D[M[P[case];main.ts];a]", { nodes: 1 }], ["D[M[P[case];main.ts];z]", { nodes: 1 }]]);
const within = (index, count) => Number.isSafeInteger(index) && index >= 0 && !Object.is(index, -0) && index < count;
const verificationInputs = {
  nominalOf: id => {
    const declaration = declaredFacts.find(declaration => declaration.definition === id);
    if (declaration === undefined) throw new Error(`Unlisted nominal-definition lookup: ${id}`);
    return declaration.nominal;
  },
  nodeExists: source => {
    const owner = source.kind === "body" ? bodyFacts.get(source.value.body) : itemFacts.get(source.value.owner);
    return owner !== undefined && within(source.value.node, owner.nodes);
  },
  localExists: local => {
    const owner = bodyFacts.get(local.body);
    return owner !== undefined && within(local.local, owner.locals);
  },
};
const verifyTypes = input => runTypeVerifier({ ...input, ...verificationInputs });
const source = { kind: "body", value: { body, node: 0 } };
const itemSource = { kind: "item", value: { owner, node: 0 } };
test("mapped index origins retain three actual key domains and reject duplicate origin-key identities", () => {
  const origin = { kind: "item", value: { owner, node: 1 } };
  const terms = [{ kind: "string" }, { kind: "primitive", primitive: "float64" },
    { kind: "intrinsic", intrinsic: "symbol" }, { kind: "intrinsic", intrinsic: "unknown" }];
  const indexes = [0, 1, 2].map(key => ({ origin, key, read: 3, write: 3, readonly: false }));
  const shape = { kind: "shape", members: [], indexes, calls: [], constructs: [] };
  const table = { terms: [...terms, shape], signatures: [] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const array = rows => `[${rows.join(", ")}]`;
  const originText = `item(value=ItemNodeRef(owner=def:"${owner}", node=n:1))`;
  const expected = `TypeTable(terms=${array(['string()', 'primitive(primitive="float64")', 'intrinsic(intrinsic="symbol")',
    'intrinsic(intrinsic="unknown")', `shape(members=[], indexes=${array([0, 1, 2].map(key =>
      `IndexSignature(origin=${originText}, key=t:${key}, read=t:3, write=t:3, readonly=false)`))}, calls=[], constructs=[])`])}, signatures=[])\n`;
  assert.equal(printTypes(table), expected);
  assert.deepEqual(parseTypes(expected), { kind: "parsed", value: table });
  for (const invalid of [[indexes[1], indexes[0], indexes[2]], [indexes[0], { ...indexes[0], read: 0 }, indexes[2]]]) {
    const result = verifyTypes({ table: { terms: [...terms, { ...shape, indexes: invalid }], signatures: [] }, bindings: [], evidence: [] });
    assert.equal(result.some(row => row.rule === "index-order"), true);
  }
  const selectors = ["index-key", "index-value"].flatMap(kind => indexes.map(index => ({ kind, origin: index.origin, key: index.key })));
  assert.equal(new Set(selectors.map(selector => encodeKey(encodeSelectorPath([selector])))).size, 6);
  const old = expected.replace(`origin=${originText}`, `declaration=def:"${owner}"`);
  assert.equal(parseTypes(old).kind, "invalid-text", "the declaration-only index record is removed");
  const declared = { ...shape, indexes: [{ ...indexes[0], origin: itemSource }] };
  assert.deepEqual(parseTypes(printTypes({ terms: [...terms, declared], signatures: [] })).value.terms[4].indexes[0].origin, itemSource);
});

test("index keys and selectors remap together under publication permutations and every resource cut", () => {
  const origin = { kind: "item", value: { owner, node: 1 } };
  const terms = [{ kind: "string" }, { kind: "primitive", primitive: "float64" },
    { kind: "intrinsic", intrinsic: "symbol" }, { kind: "intrinsic", intrinsic: "unknown" }];
  const build = order => {
    const interner = createTypeInterner();
    const issued = [];
    for (const index of order) issued[index] = insertFixtureType(product, interner, terms[index]);
    const shape = insertFixtureType(product, interner, { kind: "shape", members: [], calls: [], constructs: [], indexes: [2, 0, 1].map(index =>
      ({ origin, key: issued[index], read: issued[3], write: null, readonly: true })) });
    const roots = ["index-key", "index-value"].flatMap(kind => [0, 1, 2].map(index => insertFixtureType(product, interner,
      { kind: "projection", source: shape, projection: { kind: "component", component: { root: origin,
        path: [{ kind, origin, key: issued[index] }] } } })));
    return { interner, issued, shape, roots };
  };
  const first = build([0, 1, 2, 3]);
  const reference = exportTypes(first.interner, publicationLimits);
  const published = completePublication(reference);
  for (const index of [0, 1, 2]) {
    const row = published.table.terms[published.types[first.shape]].indexes.find(row => row.key === published.types[first.issued[index]]);
    assert.equal(row !== undefined, true);
    assert.deepEqual(row.origin, origin);
    for (const position of [index, index + 3]) {
      const projection = published.table.terms[published.types[first.roots[position]]];
      assert.equal(projection.source, published.types[first.shape]);
      assert.equal(projection.projection.component.path[0].key, row.key);
      assert.deepEqual(projection.projection.component.path[0].origin, row.origin);
    }
  }
  assert.deepEqual(verifyTypes({ table: published.table, bindings: [], evidence: [] }), []);
  const second = build([2, 0, 3, 1]);
  assert.deepEqual(completePublication(exportTypes(second.interner, publicationLimits)).table, published.table);
  for (const [field, dimension, needed] of [["maximumWork", "work", reference.work],
    ["maximumCreatedRecords", "created-records", reference.createdRecords]]) {
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const result = exportTypes(first.interner, { maximumWork: reference.work, maximumCreatedRecords: reference.createdRecords, [field]: maximum });
      if (maximum === needed) assert.deepEqual(result, reference);
      else assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
    }
  }
});

test("an indexed projection remaps and verifies both operands under the same publication account", () => {
  const build = order => {
    const interner = createTypeInterner();
    const terms = [{ kind: "shape", members: [], indexes: [], calls: [], constructs: [] }, { kind: "string" }];
    const ids = [];
    for (const position of order) ids[position] = insertFixtureType(product, interner, terms[position]);
    const indexed = insertFixtureType(product, interner, { kind: "projection", source: ids[0], projection: { kind: "indexed", index: ids[1] } });
    return { interner, ids, indexed };
  };
  const { interner, ids, indexed } = build([0, 1]);
  const issued = exportTypes(interner, publicationLimits);
  const { table, types } = completePublication(issued);
  assert.deepEqual(table.terms[types[indexed]], { kind: "projection", source: types[ids[0]], projection: { kind: "indexed", index: types[ids[1]] } });
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const invalid = { ...table, terms: table.terms.map((term, index) => index !== types[indexed] ? term
    : { ...term, projection: { kind: "indexed", index: table.terms.length } }) };
  assert.equal(verifyTypes({ table: invalid, bindings: [], evidence: [] }).length > 0, true);
  assert.deepEqual(completePublication(exportTypes(build([1, 0]).interner, publicationLimits)).table, table);
  for (const [field, dimension, needed] of [["maximumWork", "work", issued.work], ["maximumCreatedRecords", "created-records", issued.createdRecords]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.deepEqual(exportTypes(interner, { ...publicationLimits, [field]: maximum }),
        maximum === needed ? issued : { kind: "resource-limit", dimension, maximum });
});

test("a conditional projection keeps the check, extends and two alternatives under one publication account", () => {
  const build = order => {
    const interner = createTypeInterner();
    const terms = [{ kind: "param", parameter: definition("check") }, { kind: "primitive", primitive: "bool" },
      { kind: "string" }, { kind: "intrinsic", intrinsic: "never" }];
    const ids = [];
    for (const index of order) ids[index] = insertFixtureType(product, interner, terms[index]);
    const conditional = insertFixtureType(product, interner, { kind: "projection", source: ids[0], projection: {
      kind: "conditional", extends: ids[1], whenTrue: ids[2], whenFalse: ids[3], distributive: true, inferParameters: [],
    } });
    return { interner, ids, conditional };
  };
  const { interner, ids, conditional } = build([0, 1, 2, 3]);
  const result = exportTypes(interner, publicationLimits);
  const { table, types } = completePublication(result);
  const expected = { kind: "projection", source: types[ids[0]], projection: {
    kind: "conditional", extends: types[ids[1]], whenTrue: types[ids[2]], whenFalse: types[ids[3]], distributive: true, inferParameters: [],
  } };
  assert.deepEqual(table.terms[types[conditional]], expected);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(completePublication(exportTypes(build([3, 1, 2, 0]).interner, publicationLimits)).table, table);
  for (const field of ["extends", "whenTrue", "whenFalse"]) {
    const terms = [...table.terms];
    terms[types[conditional]] = { ...expected, projection: { ...expected.projection, [field]: terms.length } };
    assert.equal(verifyTypes({ table: { ...table, terms }, bindings: [], evidence: [] }).some(finding => finding.rule === "type-reference"), true);
  }
  for (const [field, dimension, needed] of [["maximumWork", "work", result.work], ["maximumCreatedRecords", "created-records", result.createdRecords]])
    for (let maximum = 0; maximum <= needed; maximum += 1)
      assert.deepEqual(exportTypes(interner, { ...publicationLimits, [field]: maximum }),
        maximum === needed ? result : { kind: "resource-limit", dimension, maximum });
});

test("conditional substitution protects only its extends and true edges even when all four edges share one Type ID", () => {
  const interner = createTypeInterner();
  const binder = definition("Inner");
  const parameter = insertFixtureType(product, interner, { kind: "param", parameter: binder });
  const value = insertFixtureType(product, interner, { kind: "primitive", primitive: "bool" });
  const projection = { kind: "conditional", extends: parameter, whenTrue: parameter, whenFalse: parameter,
    distributive: false, inferParameters: [binder] };
  const conditional = insertFixtureType(product, interner, { kind: "projection", source: parameter, projection });
  const grounded = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: binder, type: value }] };
  const result = substitute(interner, [conditional], grounded, limits(), fixtureTypeWork(product));
  assert.equal(result.kind, "complete");
  assert.deepEqual(readType(interner, result.value[0]),
    { kind: "projection", source: value, projection: { ...projection, whenFalse: value } });
  assert.deepEqual(readType(interner, conditional), { kind: "projection", source: parameter, projection });
  const other = insertFixtureType(product, interner, { kind: "projection", source: parameter,
    projection: { ...projection, inferParameters: [definition("Other")] } });
  assert.notEqual(other, conditional);
  const table = completePublication(exportTypes(interner, publicationLimits)).table;
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const printed = printTypes(table);
  assert.deepEqual(parseTypes(printed), { kind: "parsed", value: table });
  const missingField = printed.replaceAll(/, inferParameters=\[[^\]]*\]/gu, "");
  assert.notEqual(missingField, printed);
  assert.notEqual(parseTypes(missingField).kind, "parsed");
  for (const inferParameters of [["not-a-definition"], undefined, [binder, binder]]) {
    const invalid = { ...table, terms: table.terms.map(term => term.kind === "projection" && term.projection.kind === "conditional"
      ? { ...term, projection: { ...term.projection, inferParameters } } : term) };
    assert.equal(verifyTypes({ table: invalid, bindings: [], evidence: [] }).some(finding => finding.rule === "projection-owner"), true);
  }
});

test("each conditional binder protects only the extends pattern and true branch", () => {
  const interner = createTypeInterner();
  const first = definition("FirstBinder");
  const second = definition("SecondBinder");
  const firstType = product.internType(interner, { kind: "param", parameter: first });
  const secondType = product.internType(interner, { kind: "param", parameter: second });
  const checked = product.internType(interner, { kind: "primitive", primitive: "bool" });
  const rejected = product.internType(interner, { kind: "string" });
  const inferParameters = [first, second];
  const term = { kind: "projection", source: firstType,
    projection: { kind: "conditional", extends: firstType, whenTrue: secondType, whenFalse: secondType,
      distributive: false, inferParameters } };
  const conditional = insertFixtureType(product, interner, term);
  const expected = { ...term, projection: { ...term.projection, inferParameters: [first, second] } };
  inferParameters.reverse();
  assert.deepEqual(readType(interner, conditional), expected);
  assert.notEqual(insertFixtureType(product, interner, term), conditional);
  const result = substitute(interner, [conditional], { ...emptyBindings(), classBindings: [
    { kind: "bound", parameter: first, type: checked }, { kind: "bound", parameter: second, type: rejected },
  ] }, limits(), fixtureTypeWork(product));
  assert.equal(result.kind, "complete");
  assert.deepEqual(readType(interner, result.value[0]), { ...expected, source: checked,
    projection: { ...expected.projection, whenFalse: rejected } });
});

test("open key domains and substitution retain both independently bound and published operands", () => {
  const interner = createTypeInterner();
  const target = definition("Target");
  const key = definition("Key");
  const targetType = insertFixtureType(product, interner, { kind: "param", parameter: target });
  const keyType = insertFixtureType(product, interner, { kind: "param", parameter: key });
  const keys = insertFixtureType(product, interner, { kind: "projection", source: targetType, projection: { kind: "keyof" } });
  const narrowed = insertFixtureType(product, interner, { kind: "projection", source: keyType, projection: { kind: "substitution", constraint: keys } });
  const shape = insertFixtureType(product, interner, { kind: "shape", members: [], indexes: [], calls: [], constructs: [] });
  const string = insertFixtureType(product, interner, { kind: "string" });
  const selectedKeys = insertFixtureType(product, interner, { kind: "projection", source: shape, projection: { kind: "keyof" } });
  const result = substitute(interner, [narrowed, keys], { ...emptyBindings(), methodBindings: [
    { kind: "bound", parameter: target, type: shape }, { kind: "bound", parameter: key, type: string },
  ] }, limits(), fixtureTypeWork(product));
  assert.equal(result.kind, "complete");
  assert.equal(result.value[1], selectedKeys);
  assert.deepEqual(readType(interner, result.value[0]), {
    kind: "projection", source: string, projection: { kind: "substitution", constraint: selectedKeys },
  });
  const { table, types } = completePublication(exportTypes(interner, publicationLimits));
  assert.deepEqual(table.terms[types[narrowed]], { kind: "projection", source: types[keyType],
    projection: { kind: "substitution", constraint: types[keys] } });
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const invalid = [...table.terms];
  invalid[types[narrowed]] = { ...invalid[types[narrowed]], projection: { kind: "substitution", constraint: invalid.length } };
  assert.equal(verifyTypes({ table: { ...table, terms: invalid }, bindings: [], evidence: [] })
    .some(finding => finding.rule === "type-reference"), true);
});

test("index origin and selected key references retain their actual qualified source and type domains", () => {
  for (const origin of [source, itemSource]) {
    const projection = key => ({ kind: "projection", source: 0,
      projection: { kind: "component", component: { root: itemSource, path: [{ kind: "index-value", origin, key }] } } });
    assert.deepEqual(verifyTypes({ table: { terms: [{ kind: "string" }, projection(0)], signatures: [] }, bindings: [], evidence: [] }), []);
    assert.equal(verifyTypes({ table: { terms: [{ kind: "string" }, projection(99)], signatures: [] }, bindings: [], evidence: [] })
      .some(row => row.rule === "type-reference"), true);
    const invalid = projection(0);
    invalid.projection.component.path[0].origin = { ...origin, value: { ...origin.value, node: 99 } };
    assert.equal(verifyTypes({ table: { terms: [{ kind: "string" }, invalid], signatures: [] }, bindings: [], evidence: [] })
      .some(row => row.rule === "projection-owner"), true);
  }
});

test("interned and seeded index rows and selectors own both levels of every caller source reference", () => {
  for (const original of [source, itemSource]) for (const seeded of [false, true]) {
    const origin = structuredClone(original);
    const row = { origin, key: 0, read: 0, write: null, readonly: true };
    const shape = { kind: "shape", members: [], indexes: [row, { ...row, key: 1 }], calls: [], constructs: [] };
    const projections = ["index-key", "index-value"].map(kind => ({ kind: "projection", source: 2,
      projection: { kind: "component", component: { root: origin, path: [{ kind, origin, key: 0 }] } } }));
    const table = { terms: [{ kind: "string" }, { kind: "intrinsic", intrinsic: "symbol" }, shape, ...projections], signatures: [] };
    const expected = structuredClone(table);
    assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
    const interner = seeded ? admitFixtureTable(product, table) : createTypeInterner();
    if (!seeded) table.terms.forEach((term, index) => assert.equal(insertFixtureType(product, interner, term), index));
    origin.value.node = 99;
    if (origin.kind === "body") origin.value.body = otherBody;
    else origin.value.owner = other;
    row.origin = structuredClone(itemSource);
    row.key = 1;
    for (const projection of projections) {
      projection.projection.component.path[0].origin = structuredClone(itemSource);
      projection.projection.component.path[0].key = 1;
    }
    assert.deepEqual(expected.terms.map((_, index) => readType(interner, index)), expected.terms);
    expected.terms.forEach((term, index) => assert.equal(insertFixtureType(product, interner, term), index));
    assert.equal(origin.value.node, 99, "the caller remains mutable rather than frozen");
  }
});

test("physical member storage projects only the canonical qualified selection and complete binding families", async () => {
  const { memberStorageData } = await import("../../packages/host/dist/ir-types/index.js");
  const bindings = emptyBindings();
  const selection = { key: { kind: "text", value: "field" }, origins: [{ kind: "declared", declaration: owner }],
    selectedDeclarations: [owner], primary: owner, bindings };
  assert.deepEqual(memberStorageData(selection), [["text", "field"], [["declared", owner]], [owner], owner, bindingVectorData(bindings)]);
  const original = encodeKey(memberStorageData(selection));
  for (const key of [{ kind: "number", value: { numerator: 1n, denominator: 3n, negativeZero: false } },
    { kind: "symbol", declaration: other }]) assert.notEqual(encodeKey(memberStorageData({ ...selection, key })), original);
  for (const origin of [{ kind: "class-prototype", owner }, { kind: "mapped", owner: source, key: selection.key },
    { kind: "mapped", owner: itemSource, key: { kind: "symbol", declaration: other } }]) {
    assert.notEqual(encodeKey(memberStorageData({ ...selection, origins: [origin] })), original);
  }
  for (const symbol of ["global-this", "undefined"]) {
    assert.deepEqual(memberStorageData({ ...selection, origins: [{ kind: "intrinsic", symbol }], selectedDeclarations: [], primary: null }),
      [["text", "field"], [["intrinsic", symbol]], [], null, bindingVectorData(bindings)]);
  }
  const literalProperty = occurrence => memberStorageData({ ...selection, origins: [{ kind: "source-member", occurrence }],
    selectedDeclarations: [], primary: null });
  assert.deepEqual(literalProperty(source.value), [
    ["text", "field"], [["source-member", source.value.body, source.value.node]], [], null, bindingVectorData(bindings),
  ]);
  assert.notEqual(encodeKey(literalProperty(source.value)), encodeKey(literalProperty({ ...source.value, body: otherBody })));
  for (const change of [{ primary: null }, { selectedDeclarations: [other] },
    { bindings: { ...bindings, classBindings: [{ kind: "bound", parameter: parameterDeclaration(owner, 0), type: 1 }] } }]) {
    assert.notEqual(encodeKey(memberStorageData({ ...selection, ...change })), original);
  }
  const late = { ...selection, read: 1, write: 2, getter: null, setter: null, location: { kind: "accessor" } };
  assert.equal(encodeKey(memberStorageData(late)), original, "runtime access decisions never select a physical field identity");
  assert.notEqual(encodeKey(memberStorageData({ ...selection, origins: new Array(1) })), original);
  assert.notEqual(encodeKey(memberStorageData({ ...selection, selectedDeclarations: new Array(1) })), original);
});
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const limits = (changes = {}) => ({ maximumDepth: 128, maximumVisits: 131072,
  maximumUnionMembers: 131072, maximumIntersectionMembers: 131072, ...changes });
const publicationLimits = { maximumWork: 100000000, maximumCreatedRecords: 1000000 };

test("rigid bindings preserve the complete admitted qualified scope without changing its family or slot", () => {
  const scope = { classParameters: [parameterDeclaration(owner, 1), parameterDeclaration(owner, 0)],
    methodParameters: [parameterDeclaration(method, 0)], capturedParameters: [parameterDeclaration(other, 0)],
    selfOwners: [other, owner] };
  const vector = rigidBindings(scope);
  assert.deepEqual(vector, { classBindings: scope.classParameters.map(parameter => ({ kind: "rigid", parameter })),
    methodBindings: [{ kind: "rigid", parameter: parameterDeclaration(method, 0) }],
    capturedBindings: [{ kind: "rigid", parameter: parameterDeclaration(other, 0) }],
    selfBindings: [{ kind: "rigid", owner: other }, { kind: "rigid", owner }] });
  assert.notEqual(bindingVectorKey(vector), bindingVectorKey(rigidBindings({ ...scope,
    capturedParameters: [parameterDeclaration(owner, 0)] })));
  assert.deepEqual(rigidBindings(emptyScope()), emptyBindings());
  assert.deepEqual(scope.classParameters, [parameterDeclaration(owner, 1), parameterDeclaration(owner, 0)]);
});
function completePublication(result) {
  assert.equal(result.kind, "complete", "the complete publication outcome is required");
  return result.value;
}

function publishedBatch(interner, issued, maximum = publicationLimits) {
  const publication = completePublication(exportTypes(interner, maximum));
  assert.equal(new Set(publication.types).size, viewTypes(interner).terms.length);
  assert.equal(new Set(publication.signatures).size, viewTypes(interner).signatures.length);
  return { table: publication.table, types: issued.types.map(type => publication.types[type]),
    signatures: issued.signatures.map(signature => publication.signatures[signature]) };
}

function expectConstructionStop(types, terms, maximumWork) {
  const before = [...viewTypes(types).terms];
  const work = product.createTypePublicationWork({ maximumWork, maximumCreatedRecords: publicationLimits.maximumCreatedRecords });
  const graph = { typeBase: before.length, signatureBase: viewTypes(types).signatures.length, terms, signatures: [] };
  const original = product.internTypeGraph({ types, work }, graph);
  assert.deepEqual(original, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  assert.equal(product.internTypeGraph({ types, work }, graph) === original, true);
  assert.equal(viewTypes(types).terms.length, before.length);
  assert.equal(before.every((row, type) => readType(types, type) === row), true);
}
const primitive = { kind: "primitive", primitive: "int32" };
const rational = (numerator, denominator = 1n, negativeZero = false) => ({ numerator, denominator, negativeZero });
const signature = (changes = {}) => ({ declaration: null, owner: null, composition: null, kind: "call",
  typeParameters: [], receiver: null, parameters: [], result: 0, ...changes });
const violation = (rule, site, field, value) => ({ rule, site,
  detail: [{ kind: "text", value: field }, ...(value === undefined ? [] : [{ kind: "number", value }])] });
const typeSite = type => ({ kind: "type", type });
const signatureSite = signature => ({ kind: "signature", signature });

test("selected omission capability is independent of required syntax and survives every canonical signature boundary", () => {
  const interner = createTypeInterner();
  const voidType = insertFixtureType(product, interner, { kind: "intrinsic", intrinsic: "void" });
  const absence = insertFixtureType(product, interner, { kind: "intrinsic", intrinsic: "absence" });
  const formal = insertFixtureType(product, interner, { kind: "param", parameter: parameterDeclaration(owner, 0) });
  const roots = [];
  for (const type of [voidType, absence, formal]) for (const acceptsOmission of [false, true]) {
    const parameter = { declaration: method, kind: "required", type, passing: "by-value", initializer: null, acceptsOmission };
    const selected = signature({ parameters: [parameter], result: type });
    const id = insertFixtureSignature(product, interner, selected);
    roots.push(id);
    assert.equal(insertFixtureSignature(product, interner, structuredClone(selected)), id);
    assert.deepEqual(readSignature(interner, id).parameters, [parameter]);
    if (acceptsOmission) assert.notEqual(id, roots[roots.length - 2], "actual capability remains part of canonical identity");
  }
  const table = viewTypes(interner);
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  const copied = admitFixtureTable(product, table);
  const generic = roots.slice(-2);
  const substituted = substituteSignature(copied, generic,
    { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: parameterDeclaration(owner, 0), type: voidType }] }, limits(), "lexical", fixtureTypeWork(product));
  assert.equal(substituted.kind, "complete");
  assert.deepEqual(substituted.value.map(id => readSignature(copied, id).parameters[0].acceptsOmission), [false, true]);
  const published = completePublication(exportTypes(copied, publicationLimits));
  assert.deepEqual(roots.map(id => published.table.signatures[published.signatures[id]].parameters[0].acceptsOmission),
    [false, true, false, true, false, true]);
  const selected = { terms: [{ kind: "intrinsic", intrinsic: "void" }],
    signatures: [{ id: 0, ...signature({ parameters: [readSignature(interner, roots[1]).parameters[0]] }) }] };
  const text = printTypes(selected);
  const old = text.replace(", acceptsOmission=true", "");
  assert.equal(parseTypes(old).kind, "invalid-text", "the old incomplete parameter record is rejected, not defaulted");
  for (const value of [undefined, null, 0, "true"]) {
    const invalid = structuredClone(selected); invalid.signatures[0].parameters[0].acceptsOmission = value;
    assert.deepEqual(verifyTypes({ table: invalid, bindings: [], evidence: [] }),
      [violation("parameter-order", signatureSite(0), "parameters", 0)]);
  }
  const invalidText = text.replace("acceptsOmission=true", 'acceptsOmission="true"');
  assert.equal(parseTypes(invalidText).kind, "invalid-text", "capability transport is an actual Boolean");
});

test("constant reference keys retain producer context, initializer instance and named enum membership", async () => {
  const { constantReferenceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const initializer = { body, bindings: { kind: "parametric" } };
  const keys = ["fixed-array-extent", "compile-time"].map(context => constantReferenceKey({ initializer, context }));
  assert.notEqual(keys[0], keys[1], "the same initializer under distinct selected contexts is not the same receipt");
  assert.equal(constantReferenceKey({ initializer: { ...initializer }, context: "compile-time" }), keys[1]);
  assert.notEqual(constantReferenceKey({ initializer: { ...initializer, body: otherBody }, context: "compile-time" }), keys[1]);
  const named = { context: "enum-member", member: owner, bindings: initializer.bindings };
  const namedKey = constantReferenceKey(named);
  assert.notEqual(namedKey, constantReferenceKey({ ...named, member: parameterDeclaration(owner, 0) }));
  assert.equal(keys.includes(namedKey), false);
  const families = ["classBindings", "methodBindings", "capturedBindings", "selfBindings"];
  for (const family of families) {
    const binding = family === "selfBindings" ? { kind: "rigid", owner } : { kind: "rigid", parameter: parameterDeclaration(owner, 0) };
    const reference = vector => ({ ...named, bindings: { kind: "instantiated", bindings: { ...emptyBindings(), [family]: vector } } });
    assert.notEqual(constantReferenceKey(reference([binding, undefined])), constantReferenceKey(reference([undefined, binding])));
    assert.notEqual(constantReferenceKey(reference([binding])), constantReferenceKey(reference([binding, undefined])));
    assert.notEqual(constantReferenceKey(reference([])), namedKey);
  }
});

test("one readonly run view retains actual row identities, domain and append-only growth without publication", () => {
  const interner = createTypeInterner();
  const view = viewTypes(interner);
  const terms = view.terms;
  const signatures = view.signatures;
  assert.deepEqual(view, { terms: [], signatures: [] });
  const text = insertFixtureType(product, interner, { kind: "string" });
  const numeric = insertFixtureType(product, interner, primitive);
  const callable = insertFixtureSignature(product, interner, signature({ result: numeric }));
  assert.deepEqual([text, numeric, callable], [0, 1, 0], "run IDs are not canonical-publication remaps");
  assert.equal(view.terms[text] === readType(interner, text), true);
  assert.equal(view.terms[numeric] === readType(interner, numeric), true);
  assert.equal(view.signatures[callable] === readSignature(interner, callable), true);
  const original = view.terms[numeric];
  for (let position = 0; position < 4096; position += 1) {
    insertFixtureType(product, interner, { kind: "literal", value: { kind: "string", value: `value-${position}` }, base: text });
    assert.equal(viewTypes(interner) === view, true);
    assert.equal(viewTypes(interner).terms === terms && viewTypes(interner).signatures === signatures, true);
  }
  assert.equal(view.terms.length, 4098);
  assert.equal(view.signatures.length, 1);
  assert.equal(view.terms[numeric] === original, true);
  assert.equal(viewTypes(createTypeInterner()) === view, false);
});

test("adopted and substituted rows enter the same readonly run view with their genuine IDs", () => {
  const input = { terms: [primitive, { kind: "string" }], signatures: [{ id: 0, ...signature() }] };
  const seeded = admitFixtureTable(product, input);
  const seedView = viewTypes(seeded);
  assert.equal(seedView.terms.length, 2, "the view preserves the admitted positional prefix");
  assert.equal(seedView.terms[1] === readType(seeded, 1), true);
  assert.equal(seedView.signatures[0] === readSignature(seeded, 0), true);
  assert.equal(seedView.terms === input.terms || seedView.signatures === input.signatures, false);
  const parameter = parameterDeclaration(owner, 0);
  const formal = insertFixtureType(product, seeded, { kind: "param", parameter });
  const array = insertFixtureType(product, seeded, { kind: "array", element: formal, readonly: false });
  const generic = insertFixtureSignature(product, seeded, signature({ result: array }));
  const transformed = substituteSignature(seeded, [generic],
    { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 0 }] }, limits(), "lexical", fixtureTypeWork(product));
  assert.equal(transformed.kind, "complete");
  const selected = transformed.value[0];
  assert.equal(seedView.signatures[selected] === readSignature(seeded, selected), true);
  assert.deepEqual(seedView.terms[readSignature(seeded, selected).result], { kind: "array", element: 0, readonly: false });
  assert.equal(viewTypes(seeded) === seedView, true);
});

test("batched substitution preserves empty results and validates the one supplied environment", () => {
  const interner = admitFixtureTable(product, { terms: [primitive], signatures: [{ id: 0, ...signature() }] });
  const capacity = limits({ maximumDepth: 0, maximumVisits: 0 });
  assert.deepEqual(substitute(interner, [], emptyBindings(), capacity, fixtureTypeWork(product)), { kind: "complete", value: [] });
  assert.deepEqual(substituteSignature(interner, [], emptyBindings(), capacity, "lexical", fixtureTypeWork(product)), { kind: "complete", value: [] });
  for (const apply of [roots => substitute(interner, roots, emptyBindings(), limits({ maximumVisits: -1 }), fixtureTypeWork(product)),
    roots => substituteSignature(interner, roots, emptyBindings(), limits({ maximumVisits: -1 }), "lexical", fixtureTypeWork(product))])
    assert.throws(() => apply([]), { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
  const binding = { kind: "rigid", parameter: parameterDeclaration(owner, 0) };
  assert.throws(() => substitute(interner, [], { ...emptyBindings(), classBindings: [binding, binding] }, limits(), fixtureTypeWork(product)),
    /contains each owner-qualified parameter once/u);
  const self = { kind: "rigid", owner };
  assert.throws(() => substituteSignature(interner, [], { ...emptyBindings(), selfBindings: [self, self] }, limits(), "lexical", fixtureTypeWork(product)),
    /contains each lexical self owner once/u);
});

test("one signature batch preserves root order, duplicate roots, exact rows and one cumulative visit allowance", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [primitive, { kind: "param", parameter }, { kind: "string" }], signatures: [0, 1, 2].map(id => ({
    id, ...signature({ declaration: definition(`batch-${id}`), result: 1 }),
  })) };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 2 }] };
  const roots = [2, 0, 2, 1];
  assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 3 }), "lexical", fixtureTypeWork(product)), { kind: "resource-limit", dimension: "visits", maximum: 3 });
  assert.throws(() => readSignature(interner, 3), /outside this arena/u);
  assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 17 }), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [3, 4, 3, 5] });
  assert.deepEqual(roots, [2, 0, 2, 1]);
  assert.deepEqual([3, 4, 5].map(id => readSignature(interner, id)), [2, 0, 1].map((original, index) => ({
    ...table.signatures[original], id: index + 3, result: 2,
  })));
  assert.deepEqual(table.signatures.map((_value, id) => readSignature(interner, id)), table.signatures);
  assert.deepEqual(substitute(interner, [1, 0, 1, 2], bindings, limits({ maximumVisits: 9 }), fixtureTypeWork(product)), { kind: "complete", value: [2, 0, 2, 2] });
});

test("a later refused batch root returns no partial vector and never publishes that root's incomplete graph", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, { kind: "string" },
    { kind: "optional", value: 0 }, { kind: "array", element: 2, readonly: false }], signatures: [] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  const capacity = limits({ maximumVisits: 6 });
  assert.deepEqual(substitute(interner, [2, 3], bindings, capacity, fixtureTypeWork(product)), { kind: "resource-limit", dimension: "visits", maximum: 6 });
  assert.deepEqual(readType(interner, 4), { kind: "optional", value: 1 });
  assert.throws(() => readType(interner, 5), /outside this arena/u);
  assert.deepEqual(substitute(interner, [2, 2], bindings, capacity, fixtureTypeWork(product)), { kind: "complete", value: [4, 4] });
  assert.deepEqual(table.terms.map((_value, id) => readType(interner, id)), table.terms);
});

for (const [count, ownerBytes] of [[1, 0], [64, 4096], [4096, 4096]])
  test(`one batch prepares the same ${ownerBytes}-byte unused environment for all ${count} genuine short signatures`, () => {
    const longOwner = definition("unused-" + "p".repeat(ownerBytes));
    const table = { terms: [primitive], signatures: Array.from({ length: count }, (_value, id) => ({
      id, ...signature({ declaration: definition(`short-${id}`) }),
    })) };
    const interner = admitFixtureTable(product, table);
    const bindings = { ...emptyBindings(), capturedBindings: [{ kind: "rigid", parameter: parameterDeclaration(longOwner, 0) }] };
    const roots = table.signatures.map(row => row.id).reverse();
    assert.deepEqual(substituteSignature(admitFixtureTable(product, table), roots, bindings, limits({ maximumVisits: 3 * count }), "lexical", fixtureTypeWork(product)),
      { kind: "resource-limit", dimension: "visits", maximum: 3 * count });
    const capacity = limits({ maximumVisits: 3 * count + 1 });
    assert.deepEqual(substituteSignature(interner, roots, bindings, capacity, "lexical", fixtureTypeWork(product)), { kind: "complete", value: roots });
    assert.deepEqual(substituteSignature(interner, roots, bindings, capacity, "lexical", fixtureTypeWork(product)), { kind: "complete", value: roots });
    assert.deepEqual(table.signatures.map((_value, id) => readSignature(interner, id)), table.signatures);
    assert.deepEqual(readType(interner, 0), primitive);
    assert.throws(() => readSignature(interner, count), /outside this arena/u);
  });
const evidence = (changes = {}) => ({ type: 0, component: source, category: { kind: "known", category: "number" },
  numeric: null, sum: null, nominal: null, pointer: null, ...changes });

test("plain and binding-value root batches share exact cold, warm, duplicate and first-refusal visit units", () => {
  const table = { terms: [primitive, { kind: "string" }, { kind: "intrinsic", intrinsic: "void" }], signatures: [] };
  for (const bindingValues of [false, true]) {
    const apply = (interner, roots, maximumVisits) => bindingValues
      ? projectBindingValues(interner, { types: roots, bindings: [] }, emptyBindings(), limits({ maximumVisits }), fixtureTypeAdmission())
      : substitute(interner, roots, emptyBindings(), limits({ maximumVisits }), fixtureTypeWork(product));
    for (const maximumVisits of [0, 5]) {
      assert.deepEqual(apply(admitFixtureTable(product, table), [0, 1, 2], maximumVisits),
        { kind: "resource-limit", dimension: "visits", maximum: maximumVisits });
    }
    const interner = admitFixtureTable(product, table);
    const expected = bindingValues ? { types: [0, 1, 2], bindings: [] } : [0, 1, 2];
    assert.deepEqual(apply(interner, [0, 1, 2], 6), { kind: "complete", value: expected });
    if (bindingValues) assert.deepEqual(apply(interner, [2, 1, 0, 2, 1, 0], 8),
      { kind: "resource-limit", dimension: "visits", maximum: 8 }, "a new verification call cannot borrow the former private memo");
    assert.deepEqual(apply(interner, [2, 1, 0, 2, 1, 0], bindingValues ? 9 : 6), { kind: "complete",
      value: bindingValues ? { types: [2, 1, 0, 2, 1, 0], bindings: [] } : [2, 1, 0, 2, 1, 0] });
    assert.deepEqual(apply(interner, [0, 0, 0, 0, 0, 0, 99], 6),
      { kind: "resource-limit", dimension: "visits", maximum: 6 });
    assert.deepEqual(table.terms.map((_value, id) => readType(interner, id)), table.terms);
    assert.throws(() => readType(interner, 3), /outside this arena/u);
  }
});

test("binding-value projection preserves four qualified families and returns only already admitted outward rows", () => {
  const parameter = parameterDeclaration(owner, 0);
  const methodParameter = parameterDeclaration(method, 0);
  const capturedParameter = parameterDeclaration(captured, 0);
  const table = { terms: [{ kind: "param", parameter }, { kind: "self", owner }, { kind: "string" },
    { kind: "primitive", primitive: "bool" }, { kind: "array", element: 0, readonly: false }], signatures: [] };
  const outer = { classBindings: [{ kind: "bound", parameter, type: 2 }],
    methodBindings: [{ kind: "bound", parameter: methodParameter, type: 3 }], capturedBindings: [],
    selfBindings: [{ kind: "bound", owner, type: 2 }] };
  const vector = { classBindings: [{ kind: "rigid", parameter }],
    methodBindings: [{ kind: "bound", parameter: methodParameter, type: 4 }],
    capturedBindings: [{ kind: "rigid", parameter: capturedParameter }],
    selfBindings: [{ kind: "rigid", owner }, { kind: "rigid", owner: other }] };
  const input = { types: [0, 1, 4], bindings: [vector, emptyBindings()] };
  const original = structuredClone(input);
  const missing = admitFixtureTable(product, table);
  assert.deepEqual(projectBindingValues(missing, input, outer, limits(), fixtureTypeAdmission()), { kind: "complete", value: {
    types: [2, 2, null], bindings: [null, emptyBindings()],
  } });
  assert.equal(viewTypes(missing).terms.length, 5);
  const admitted = { ...table, terms: [...table.terms, { kind: "array", element: 2, readonly: false }] };
  const interner = admitFixtureTable(product, admitted);
  const selected = readType(interner, 5);
  assert.deepEqual(projectBindingValues(interner, input, outer, limits(), fixtureTypeAdmission()), { kind: "complete", value: {
    types: [2, 2, 5], bindings: [{ classBindings: [{ kind: "bound", parameter, type: 2 }],
      methodBindings: [{ kind: "bound", parameter: methodParameter, type: 5 }],
      capturedBindings: [{ kind: "rigid", parameter: capturedParameter }],
      selfBindings: [{ kind: "bound", owner, type: 2 }, { kind: "rigid", owner: other }] }, emptyBindings()],
  } });
  assert.equal(readType(interner, 5) === selected && viewTypes(interner).terms.length === 6, true);
  assert.deepEqual(input, original);
  for (const [maximumVisits, values] of [[0, input], [1, { types: [], bindings: [vector, { ...vector,
    methodBindings: [{ kind: "bound", parameter: methodParameter, type: 99 }] }] }]]) {
    assert.deepEqual(projectBindingValues(admitFixtureTable(product, table), values, outer, limits({ maximumVisits }), fixtureTypeAdmission()),
      { kind: "resource-limit", dimension: "visits", maximum: maximumVisits });
  }
});
test("binding-value projection charges each binding traversal before reading later rows and rejects sparse caller inputs", () => {
  const table = { terms: [primitive], signatures: [] };
  const parameter = parameterDeclaration(owner, 0);
  const empty = emptyBindings();
  const invoke = (values, bindings, maximumVisits) => projectBindingValues(
    admitFixtureTable(product, table), values, bindings, limits({ maximumVisits }), fixtureTypeAdmission());
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const sparse = { ...empty, [family]: new Array(1) };
    assert.throws(() => invoke({ types: [], bindings: [] }, sparse, 1), /no .*holes/u);
    assert.deepEqual(invoke({ types: [], bindings: [] }, sparse, 0), { kind: "resource-limit", dimension: "visits", maximum: 0 });
    assert.throws(() => invoke({ types: [], bindings: [sparse] }, empty, 2), /no .*holes/u);
    assert.deepEqual(invoke({ types: [], bindings: [sparse] }, empty, 1), { kind: "resource-limit", dimension: "visits", maximum: 1 });
    const value = family === "selfBindings" ? { kind: "bound", owner, type: 0 } : { kind: "bound", parameter, type: 0 };
    const vector = { ...empty, [family]: [value] };
    assert.deepEqual(invoke({ types: [], bindings: [vector] }, empty, 2), { kind: "resource-limit", dimension: "visits", maximum: 2 });
    assert.deepEqual(invoke({ types: [], bindings: [vector] }, empty, 3), { kind: "complete", value: { types: [], bindings: [vector] } });
    const rigid = { ...empty, [family]: [family === "selfBindings" ? { kind: "rigid", owner } : { kind: "rigid", parameter }] };
    assert.deepEqual(invoke({ types: [], bindings: [rigid] }, empty, 2), { kind: "complete", value: { types: [], bindings: [rigid] } });
  }
  for (const values of [{ types: new Array(1), bindings: [] }, { types: [], bindings: new Array(1) }]) {
    assert.throws(() => invoke(values, empty, 1), /no holes/u);
  }
  assert.throws(() => substitute(admitFixtureTable(product, table), new Array(1), empty, limits(), fixtureTypeWork(product)), /no holes/u);
  assert.throws(() => substituteSignature(admitFixtureTable(product, table), new Array(1), empty, limits(), "lexical", fixtureTypeWork(product)), /no holes/u);
  assert.deepEqual(invoke({ types: [0], bindings: [] }, empty, 1), { kind: "resource-limit", dimension: "visits", maximum: 1 });
  assert.deepEqual(invoke({ types: [], bindings: [empty, { ...empty, classBindings: [99] }] }, empty, 1),
    { kind: "resource-limit", dimension: "visits", maximum: 1 });
});

test("a preexisting Types stop precedes type and signature root or binding reads", () => {
  const arena = createTypeInterner();
  const roots = Array(1);
  const binding = Array(1);
  Object.defineProperty(roots, 0, { get: () => assert.fail("no root read after its Types account already stopped") });
  Object.defineProperty(binding, 0, { get: () => assert.fail("no binding read after its Types account already stopped") });
  const bindings = { ...emptyBindings(), classBindings: binding };
  const work = product.createTypePublicationWork({ maximumWork: 0, maximumCreatedRecords: 100 });
  const stopped = product.admitTypePublicationStep(work);
  assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.equal(substitute(arena, roots, bindings, limits(), work) === stopped, true);
  assert.equal(substituteSignature(arena, roots, bindings, limits(), "lexical", work) === stopped, true);
});

test("projection retains independent outward slots and original work, record and expansion stops", () => {
  const parameter = parameterDeclaration(owner, 0);
  const bound = (parameter, type) => ({ ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type }] });
  const array = element => ({ kind: "array", element, readonly: false });
  const interner = admitFixtureTable(product, { terms: [primitive, { kind: "string" }, { kind: "param", parameter }, array(2), array(0)],
    signatures: [{ id: 0, ...signature({ result: 3 }) }] });
  const table = viewTypes(interner);
  const rows = [...table.terms];
  const signatures = [...table.signatures];
  const bindings = bound(parameter, 1);
  const unavailable = bound(parameter, 3);
  const available = bound(parameter, 4);
  const source = { types: [3, 4], bindings: [unavailable, available] };
  const expected = { kind: "complete", value: { types: [null, 4], bindings: [null, available] } };
  const unchanged = () => {
    assert.equal(table.terms.length === rows.length && table.signatures.length === signatures.length, true);
    assert.equal(rows.every((row, position) => table.terms[position] === row), true);
    assert.equal(signatures.every((row, position) => table.signatures[position] === row), true);
  };
  for (const repeat of [0, 1]) {
    assert.deepEqual(projectBindingValues(interner, source, bindings, limits(), fixtureTypeAdmission()), expected, repeat);
    unchanged();
  }
  let reads = 0;
  const types = [3, 4];
  Object.defineProperty(types, 1, { get: () => { reads += 1; return 4; } });
  const watched = { ...source, types };
  for (const [maximumWork, maximumResultEntries, dimension] of [[0, 1000, "work"], [10000, 2, "result-entries"]]) {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const work = { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) };
    const result = projectBindingValues(interner, watched, bindings, limits(), work);
    assert.deepEqual(result, { kind: "resource-limit", dimension, maximum: dimension === "work" ? maximumWork : maximumResultEntries });
    assert.equal(result === accountFailure(account), true);
    assert.equal(projectBindingValues(interner, watched, bindings, limits(), work) === result, true);
    assert.equal(reads, 0);
    unchanged();
  }
  assert.deepEqual(projectBindingValues(interner, watched, bindings, limits({ maximumDepth: 0 }), fixtureTypeAdmission()),
    { kind: "resource-limit", dimension: "depth", maximum: 0 });
  assert.equal(reads, 0);
  unchanged();
});

test("verification projection may use an admitted callable signature without publishing its unadmitted opposite", () => {
  const parameter = parameterDeclaration(owner, 0);
  const callable = signature => ({ kind: "callable", calls: [signature], constructs: [] });
  for (const ready of [false, true]) {
    const table = { terms: [primitive, { kind: "param", parameter }, callable(0)],
      signatures: [{ id: 0, ...signature({ result: 1 }) }] };
    if (ready) {
      table.terms.push(callable(1));
      table.signatures.push({ id: 1, ...signature({ result: 0 }) });
    }
    const types = admitFixtureTable(product, table);
    const held = viewTypes(types);
    const rows = [...held.terms];
    const signatures = [...held.signatures];
    const vector = { ...emptyBindings(), selfBindings: [{ kind: "bound", owner, type: 2 }] };
    const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 0 }] };
    const expected = { kind: "complete", value: { types: [ready ? 3 : null], bindings: [ready
      ? { ...emptyBindings(), selfBindings: [{ kind: "bound", owner, type: 3 }] } : null] } };
    const run = (maximumWork, maximumResultEntries, expectedStop) => {
      const account = createAccount({ maximumWork, maximumResultEntries });
      const spent = { work: 0, entries: 0 };
      const charge = (field, operation) => count => {
        const stop = operation(account, count);
        if (stop === null) spent[field] += count;
        return stop;
      };
      const borrowed = { work: charge("work", chargeWork), retain: charge("entries", chargeResultEntries) };
      const input = { types: [2], bindings: [vector] };
      const invoke = () => projectBindingValues(types, input, bindings, limits(), borrowed);
      const actual = invoke();
      assert.deepEqual(actual, expectedStop ?? expected);
      if (expectedStop !== null) {
        assert.equal(actual === accountFailure(account), true);
        assert.equal(invoke() === actual, true);
      }
      assert.equal(held.terms.length, rows.length);
      assert.equal(held.signatures.length, signatures.length);
      assert.equal(rows.every((row, position) => held.terms[position] === row), true);
      assert.equal(signatures.every((row, position) => held.signatures[position] === row), true);
      return spent;
    };
    const exact = run(10000, 10000, null);
    for (let maximum = 0; maximum < exact.work; maximum++)
      run(maximum, 10000, { kind: "resource-limit", dimension: "work", maximum });
    for (let maximum = 0; maximum < exact.entries; maximum++)
      run(10000, maximum, { kind: "resource-limit", dimension: "result-entries", maximum });
    assert.deepEqual(run(exact.work, exact.entries, null), exact);
  }
});

const verification = (terms = [primitive], changes = {}) => ({ table: { terms, signatures: [] }, bindings: [], evidence: [], ...changes });

test("seed retains empty independent arenas and admits normal subsequent insertion", () => {
  const table = { terms: [], signatures: [] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  const separate = admitFixtureTable(product, table);
  assert.notEqual(interner, separate);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)),
    { table: { terms: [], signatures: [] }, types: [], signatures: [] });
  assert.equal(insertFixtureType(product, interner, primitive), 0);
  assert.equal(insertFixtureType(product, separate, { kind: "string" }), 0);
  assert.deepEqual(readType(interner, 0), primitive);
  assert.deepEqual(readType(separate, 0), { kind: "string" });
  assert.equal(insertFixtureSignature(product, interner, signature()), 0);
  assert.deepEqual(readSignature(interner, 0), { id: 0, ...signature() });
  assert.deepEqual(table, { terms: [], signatures: [] });
});

test("seed takes all forward self and mutual type-signature references together without expansion", () => {
  const terms = [{ kind: "array", element: 1, readonly: false },
    { kind: "array", element: 0, readonly: true },
    { kind: "callable", calls: [0, 1], constructs: [] }];
  const signatures = [{ id: 0, ...signature({ result: 2, composition: { kind: "union", signatures: [0, 1] } }) },
    { id: 1, ...signature({ result: 0, composition: { kind: "intersection", signatures: [0, 1] } }) }];
  const table = { terms, signatures };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  assert.deepEqual(terms.map((_, position) => readType(interner, position)), terms);
  assert.deepEqual(signatures.map((_, position) => readSignature(interner, position)), signatures);
  assert.equal(insertFixtureType(product, interner, { kind: "array", element: 1, readonly: false }), 0);
  assert.equal(insertFixtureSignature(product, interner, signature({ result: 2, composition: { kind: "union", signatures: [0, 1] } })), 0);
  assert.equal(insertFixtureSignature(product, interner, signature({ result: 0, composition: { kind: "intersection", signatures: [0, 1] } })), 1);
  assert.equal(insertFixtureType(product, interner, primitive), 3);
  assert.equal(insertFixtureSignature(product, interner, signature({ result: 3 })), 2);
  assert.deepEqual(readType(interner, 3), primitive);
  assert.deepEqual(readSignature(interner, 2), { id: 2, ...signature({ result: 3 }) });
  assert.deepEqual(terms.map((_, position) => readType(interner, position)), terms);
  assert.deepEqual(signatures.map((_, position) => readSignature(interner, position)), signatures);
});

test("adoption rejects structurally valid duplicate and unnormalized rows at their actual positions", () => {
  const table = { terms: [{ kind: "array", element: 1, readonly: false },
    { kind: "array", element: 0, readonly: false }, primitive, { ...primitive },
    { kind: "optional", value: 2 }, { kind: "optional", value: 4 }],
  signatures: [{ id: 0, ...signature({ result: 2 }) }, { id: 1, ...signature({ result: 2 }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const optional = { kind: "optional", value: 0 };
  const composed = { terms: [primitive, optional, { ...optional, value: 1 }], signatures: [] };
  const sameSignature = { terms: [primitive], signatures: [{ id: 0, ...signature() }, { id: 1, ...signature() }] };
  for (const [foreign, kind, field, position] of [[table, "type", "terms", 0],
    [composed, "type", "terms", 2], [sameSignature, "signature", "signatures", 1]]) {
    const before = structuredClone(foreign);
    const result = product.admitTypeTable(foreign, fixtureTypeAdmission());
    assert.deepEqual(result, { kind: "invalid", violations: [{
      rule: "canonical-representative", site: { kind, [kind]: position }, detail: [{ kind: "text", value: field }],
    }] });
    assert.deepEqual(foreign, before);
  }
});

test("adoption copies shared inline values by value without freezing or retaining mutable caller rows", () => {
  const parameter = { declaration: method, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: false };
  const row = signature({ parameters: [parameter] });
  const table = { terms: [{ ...primitive }], signatures: [{ id: 0, ...row }, { id: 1, ...row, declaration: other }] };
  const expected = [{ id: 0, ...signature({ parameters: [{ ...parameter }] }) },
    { id: 1, ...signature({ declaration: other, parameters: [{ ...parameter }] }) }];
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  table.terms[0].primitive = "uint64";
  parameter.passing = "move";
  row.parameters.push({ ...parameter, declaration: captured });
  table.signatures.reverse();
  assert.deepEqual(readType(interner, 0), primitive);
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1)], expected);
  assert.equal(insertFixtureSignature(product, interner, signature({ parameters: expected[0].parameters })), 0);
});

test("seed continues substitution in the same arena and retains every original issued row", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "array", element: 0, readonly: false }],
    signatures: [{ id: 0, ...signature({ result: 2 }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.deepEqual(readType(interner, 3), { kind: "array", element: 1, readonly: false });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.equal(insertFixtureType(product, interner, { kind: "array", element: 1, readonly: false }), 3);
  assert.equal(insertFixtureType(product, interner, { kind: "string" }), 4);
});

test("signature-root identity and own-binder shadowing share no memo namespace with numeric type roots", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive], signatures: [
    { id: 0, ...signature({ result: 1 }) },
    { id: 1, ...signature({ typeParameters: [{ declaration: parameter, constraint: null, default: null }] }) },
  ] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  for (const signatureFirst of [false, true]) {
    const interner = admitFixtureTable(product, table);
    const operations = signatureFirst ? ["signature", "type"] : ["type", "signature"];
    for (const operation of operations) assert.deepEqual(operation === "type"
      ? substitute(interner, [0], bindings, limits(), fixtureTypeWork(product)) : substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)),
    { kind: "complete", value: [operation === "type" ? 1 : 0] });
    assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [0] });
    assert.deepEqual(substitute(interner, [0], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual(substituteSignature(interner, [1], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
    assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
    assert.throws(() => readSignature(interner, 2), /outside this arena/u);
  }
});

test("many signatures share a long unused binding environment without changing any issued row", () => {
  const longOwner = definition("environment-" + "x".repeat(4096));
  for (const count of [1, 64, 256]) {
    const signatures = Array.from({ length: count }, (_, index) => ({
      id: index, ...signature({ declaration: definition("signature-" + index), result: 0 }),
    }));
    const table = { terms: [primitive, { kind: "callable", calls: signatures.map(row => row.id), constructs: [] }], signatures };
    const interner = admitFixtureTable(product, table);
    for (const parameterOwner of [longOwner, other]) {
      const bindings = { ...emptyBindings(), capturedBindings: [
        { kind: "bound", parameter: parameterDeclaration(parameterOwner, 0), type: 0 },
      ] };
      for (const capacity of [limits(), limits({ maximumVisits: 0 })]) {
        assert.deepEqual(substitute(interner, [1], bindings, capacity, fixtureTypeWork(product)), capacity.maximumVisits === 0
          ? { kind: "resource-limit", dimension: "visits", maximum: 0 }
          : { kind: "complete", value: [1] });
      }
      for (const row of signatures)
        assert.deepEqual(substituteSignature(interner, [row.id], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [row.id] });
    }
    assert.deepEqual(table.terms.map((_, index) => readType(interner, index)), table.terms);
    assert.deepEqual(signatures.map(row => readSignature(interner, row.id)), signatures);
    assert.throws(() => readType(interner, 2), /outside this arena/u);
    assert.throws(() => readSignature(interner, count), /outside this arena/u);
  }
});

test("borrowed construction pays before following a retained signature inside a callable", () => {
  const table = { terms: [primitive, { kind: "callable", calls: [0], constructs: [] }], signatures: [{ id: 0, ...signature() }] };
  const capacity = limits();
  const bindings = emptyBindings();
  const exact = 1 + (1 + 5) + (1 + 10 + 1) + (1 + 3) + (8 + 2);
  for (let maximumWork = 0; maximumWork <= exact; maximumWork += 1) {
    const interner = admitFixtureTable(product, table);
    const issued = readSignature(interner, 0);
    const callable = readType(interner, 1);
    const warmed = substituteSignature(interner, [issued.id], bindings, capacity, "lexical", fixtureTypeWork(product));
    assert.deepEqual(warmed, { kind: "complete", value: [issued.id] });
    const account = createAccount({ maximumWork, maximumResultEntries: 0 });
    const borrowed = { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) };
    const result = substitute(interner, [1], bindings, capacity, borrowed);
    if (maximumWork < exact) {
      assert.equal(result === accountFailure(account), true, `work allowance ${maximumWork}`);
      assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
    } else {
      assert.deepEqual(result, { kind: "complete", value: [1] });
      assert.equal(remainingWork(account), 0);
    }
    const stable = viewTypes(interner);
    assert.equal(stable.signatures.length === 1 && stable.signatures[0] === issued, true);
    assert.equal(stable.terms.length === 2 && stable.terms[1] === callable, true);
  }
});

test("selected signature substitution consumes only the applied root binder and preserves the nested generic signature", () => {
  const parameter = parameterDeclaration(owner, 0);
  const formals = [{ declaration: method, kind: "required", type: 2, passing: "by-value", initializer: null, acceptsOmission: false }];
  const typeParameters = [{ declaration: parameter, constraint: null, default: null }];
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "callable", calls: [0], constructs: [] }], signatures: [
    { id: 0, ...signature({ parameters: formals, result: 0, typeParameters }) },
    { id: 1, ...signature({ parameters: formals, result: 1 }) },
    { id: 2, ...signature({ result: 1, typeParameters }) },
    { id: 3, ...signature({ result: 1 }) },
  ] };
  const bindings = { ...emptyBindings(), methodBindings: [{ kind: "bound", parameter, type: 1 }] };
  const rigid = { ...emptyBindings(), methodBindings: [{ kind: "rigid", parameter }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  for (const order of [["lexical", "selected"], ["selected", "lexical"]]) {
    const interner = admitFixtureTable(product, table);
    for (const mode of [...order, ...order]) {
      assert.deepEqual(substituteSignature(interner, [0, 2], bindings, limits(), mode, fixtureTypeWork(product)),
        { kind: "complete", value: mode === "selected" ? [1, 3] : [0, 2] });
      assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [2] });
    }
    assert.deepEqual(substituteSignature(interner, [0], rigid, limits(), "selected", fixtureTypeWork(product)), { kind: "complete", value: [0] });
    assert.deepEqual(substituteSignature(interner, [1], bindings, limits(), "selected", fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual(substituteSignature(interner, [0], bindings, limits({ maximumVisits: 2 }), "selected", fixtureTypeWork(product)),
      { kind: "resource-limit", dimension: "visits", maximum: 2 });
    assert.deepEqual(viewTypes(interner), table);
    assert.throws(() => substituteSignature(interner, [0], bindings, limits(), fixtureTypeWork(product)), /actual root mode/u);
  }
});

test("deep signature-root substitution emits its complete iterative staged chain without a callable wrapper", () => {
  const count = 10000;
  const parameter = parameterDeclaration(owner, 0);
  const terms = [{ kind: "param", parameter }];
  for (let position = 1; position <= count; position += 1)
    terms.push({ kind: "array", element: position - 1, readonly: false });
  terms.push(primitive);
  const table = { terms, signatures: [{ id: 0, ...signature({ result: count }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: count + 1 }] };
  const capacity = limits({ maximumDepth: count + 2, maximumVisits: 4 * count + 20 });
  assert.deepEqual(substituteSignature(interner, [0], bindings, capacity, "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  const expected = Array.from({ length: count }, (_, position) => ({ kind: "array",
    element: position === count - 1 ? count + 1 : count + 3 + position, readonly: false }));
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: count + 2 }) });
  assert.equal(compareCaseValues(expected.map((_, position) => readType(interner, count + 2 + position)), expected), true,
    "complete deep signature-root staged rows");
  assert.equal(compareCaseValues(terms.map((_, position) => readType(interner, position)), terms), true,
    "complete unchanged deep signature-root prefix");
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.throws(() => readType(interner, 2 * count + 2), /outside this arena/u);
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
  assert.deepEqual(substituteSignature(interner, [0], bindings, capacity, "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  assert.equal(insertFixtureSignature(product, interner, signature({ result: count + 2 })), 1);
});

test("signature-root substitution retains a genuine self-recursive signature and complete old rows", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, composition: { kind: "union", signatures: [1] } }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
});

test("signature-root substitution emits both complete mutually recursive signatures in staged order", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive], signatures: [
    { id: 0, ...signature({ composition: { kind: "union", signatures: [1] } }) },
    { id: 1, ...signature({ composition: { kind: "intersection", signatures: [0] } }) },
  ] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [2] });
  assert.deepEqual([readSignature(interner, 2), readSignature(interner, 3)], [
    { id: 2, ...signature({ result: 1, composition: { kind: "union", signatures: [3] } }) },
    { id: 3, ...signature({ result: 1, composition: { kind: "intersection", signatures: [2] } }) },
  ]);
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  assert.throws(() => readSignature(interner, 4), /outside this arena/u);
});

test("signature-root substitution preserves a mixed callable and signature recursion without fabricating a root type", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "callable", calls: [0], constructs: [] }],
    signatures: [{ id: 0, ...signature({ parameters: [
      { declaration: method, kind: "required", type: 2, passing: "by-value", initializer: null, acceptsOmission: false }] }) }] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  assert.deepEqual(readType(interner, 3), { kind: "callable", calls: [1], constructs: [] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, parameters: [
    { declaration: method, kind: "required", type: 3, passing: "by-value", initializer: null, acceptsOmission: false }] }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.throws(() => readType(interner, 4), /outside this arena/u);
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
});

test("two genuine type roots and a direct signature root share one substituted cyclic signature in both request orders", () => {
  const parameter = parameterDeclaration(owner, 0);
  const shape = signature => ({ kind: "shape", members: [], indexes: [], calls: [signature], constructs: [] });
  const table = { terms: [{ kind: "param", parameter }, primitive,
    { kind: "callable", calls: [0], constructs: [] }, shape(0)],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  for (const signatureFirst of [false, true]) {
    const interner = admitFixtureTable(product, table);
    assert.deepEqual(substituteSignature(interner, [0], emptyBindings(), limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [0] });
    assert.deepEqual(substitute(interner, [2], emptyBindings(), limits(), fixtureTypeWork(product)), { kind: "complete", value: [2] });
    assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
    assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
    if (signatureFirst) assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [4] });
    assert.deepEqual(substitute(interner, [3], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [5] });
    assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual([readType(interner, 4), readType(interner, 5)], [{ kind: "callable", calls: [1], constructs: [] }, shape(1)]);
    assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, composition: { kind: "union", signatures: [1] } }) });
    assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
    assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
    assert.throws(() => readSignature(interner, 2), /outside this arena/u);
    assert.throws(() => readType(interner, 6), /outside this arena/u);
  }
});

test("a completed signature-root memo is not reused under an additional outer binder scope", () => {
  const parameter = parameterDeclaration(owner, 0);
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "callable", calls: [1], constructs: [] }],
    signatures: [{ id: 0, ...signature({ result: 2, typeParameters: [
      { declaration: parameter, constraint: null, default: null }] }) }, { id: 1, ...signature() }] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [1], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [2] });
  assert.deepEqual(readSignature(interner, 2), { id: 2, ...signature({ result: 1 }) });
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [0] });
  assert.deepEqual(substituteSignature(interner, [1], bindings, limits(), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [2] });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  assert.throws(() => readType(interner, 3), /outside this arena/u);
  assert.throws(() => readSignature(interner, 3), /outside this arena/u);
});

test("two child type roots in one transformation retain one shared self-recursive signature result", () => {
  const parameter = parameterDeclaration(owner, 0);
  const shape = selected => ({ kind: "shape", members: [], indexes: [], calls: [selected], constructs: [] });
  const tuple = (left, right) => ({ kind: "tuple", elements: [
    { kind: "required", type: left, declaration: null }, { kind: "required", type: right, declaration: null }], readonly: false });
  const table = { terms: [{ kind: "param", parameter }, primitive,
    { kind: "callable", calls: [0], constructs: [] }, shape(0), tuple(2, 3)],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const interner = admitFixtureTable(product, table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substitute(interner, [4], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [5] });
  assert.deepEqual([readType(interner, 5), readType(interner, 6), readType(interner, 7)], [
    tuple(6, 7), { kind: "callable", calls: [1], constructs: [] }, shape(1)]);
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, composition: { kind: "union", signatures: [1] } }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
  assert.throws(() => readType(interner, 8), /outside this arena/u);
});

test("signature roots enforce every expansion limit exactly at and past the admitted input boundary", () => {
  const rows = [primitive, { kind: "string" }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, { kind: "intersection", members: [0, 1] }];
  const table = { terms: rows, signatures: [
    { id: 0, ...signature({ result: 2 }) }, { id: 1, ...signature({ result: 3 }) }, { id: 2, ...signature({ result: 4 }) },
    { id: 3, ...signature() },
  ] };
  const boundaries = [[0, "maximumDepth", "depth", 2, 1], [0, "maximumVisits", "visits", 4, 3],
    [1, "maximumUnionMembers", "union-members", 2, 1], [2, "maximumIntersectionMembers", "intersection-members", 2, 1]];
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = admitFixtureTable(product, table);
  for (const [root, field, dimension, at, below] of boundaries) {
    assert.deepEqual(substituteSignature(interner, [root], emptyBindings(), limits({ [field]: below }), "lexical", fixtureTypeWork(product)),
      { kind: "resource-limit", dimension, maximum: below });
    assert.deepEqual(substituteSignature(interner, [root], emptyBindings(), limits({ [field]: at }), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [root] });
  }
  assert.deepEqual(substituteSignature(interner, [3], emptyBindings(), limits({ maximumUnionMembers: 0, maximumIntersectionMembers: 0 }), "lexical", fixtureTypeWork(product)),
    { kind: "complete", value: [3] });
  for (const [field, dimension] of [["maximumDepth", "depth"], ["maximumVisits", "visits"]])
    assert.deepEqual(substituteSignature(interner, [3], emptyBindings(), limits({ [field]: 0 }), "lexical", fixtureTypeWork(product)),
      { kind: "resource-limit", dimension, maximum: 0 });
  assert.deepEqual(rows.map((_, position) => readType(interner, position)), rows);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"])
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
      assert.throws(() => substituteSignature(interner, [0], emptyBindings(), limits({ [field]: value }), "lexical", fixtureTypeWork(product)),
        { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
});

test("signature-root environment, root, three plans and one stage charge before publishing rows", () => {
  const parameter = parameterDeclaration(owner, 0);
  const simple = { terms: [{ kind: "param", parameter }, primitive], signatures: [{ id: 0, ...signature() }] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  const interner = admitFixtureTable(product, simple);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits({ maximumVisits: 5 }), "lexical", fixtureTypeWork(product)),
    { kind: "resource-limit", dimension: "visits", maximum: 5 });
  assert.throws(() => readSignature(interner, 1), /outside this arena/u);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits({ maximumVisits: 6 }), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1 }) });
  assert.deepEqual(simple.terms.map((_, position) => readType(interner, position)), simple.terms);
  assert.deepEqual(readSignature(interner, 0), simple.signatures[0]);
  for (const kind of ["union", "intersection"]) {
    const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "string" }, { kind: "primitive", primitive: "bool" },
      { kind, members: [1, 3] }, { kind, members: [0, 2] }], signatures: [{ id: 0, ...signature({ result: 5 }) }] };
    const bound = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 4 }] };
    const selected = admitFixtureTable(product, table);
    const field = kind === "union" ? "maximumUnionMembers" : "maximumIntersectionMembers";
    const dimension = kind === "union" ? "union-members" : "intersection-members";
    assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
    assert.deepEqual(substituteSignature(selected, [0], bound, limits({ [field]: 2 }), "lexical", fixtureTypeWork(product)),
      { kind: "resource-limit", dimension, maximum: 2 });
    assert.throws(() => readType(selected, 6), /outside this arena/u);
    assert.throws(() => readSignature(selected, 1), /outside this arena/u);
    assert.deepEqual(substituteSignature(selected, [0], bound, limits({ [field]: 3 }), "lexical", fixtureTypeWork(product)), { kind: "complete", value: [1] });
    assert.deepEqual(readType(selected, 6), { kind, members: [1, 2, 3] });
    assert.deepEqual(readSignature(selected, 1), { id: 1, ...signature({ result: 6 }) });
    assert.deepEqual(table.terms.map((_, position) => readType(selected, position)), table.terms);
    assert.deepEqual(readSignature(selected, 0), table.signatures[0]);
  }
});

test("all public interner ports retain complete immutable rows and per-instance identities", () => {
  const interner = createTypeInterner();
  const separate = createTypeInterner();
  assert.notEqual(interner, separate);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [], signatures: [] }, types: [], signatures: [] });
  const row = { kind: "primitive", primitive: "int32" };
  const id = insertFixtureType(product, interner, row);
  assert.equal(id, 0);
  assert.equal(insertFixtureType(product, interner, { ...row }), id);
  assert.equal(insertFixtureType(product, separate, { kind: "string" }), 0);
  assert.deepEqual(readType(interner, id), primitive);
  row.primitive = "uint64";
  assert.deepEqual(readType(interner, id), primitive);
  assert.deepEqual(readType(separate, 0), { kind: "string" });
  const input = signature();
  const selected = insertFixtureSignature(product, interner, input);
  assert.equal(selected, 0);
  assert.equal(insertFixtureSignature(product, interner, signature()), selected);
  assert.deepEqual(readSignature(interner, selected), { id: 0, ...input });
  assert.equal(insertFixtureSignature(product, interner, readSignature(interner, selected)), selected);
  input.parameters.push({ declaration: method, kind: "rest", type: id, passing: "move", initializer: null, acceptsOmission: true });
  assert.deepEqual(readSignature(interner, selected), { id: 0, ...signature() });
  assert.throws(() => readType(interner, 100), /outside this arena/u);
  assert.throws(() => readSignature(interner, 100), /outside this arena/u);
});

test("nominal definitions, facets, signed zero and exact native extents remain different whole terms", () => {
  const interner = createTypeInterner();
  const base = insertFixtureType(product, interner, primitive);
  const rows = [
    { kind: "declared", definition: owner, arguments: [], facet: "instance", extent: null },
    { kind: "declared", definition: owner, arguments: [], facet: "value", extent: null },
    { kind: "declared", definition: other, arguments: [], facet: "instance", extent: null },
    { kind: "enum", definition: owner },
    { kind: "self", owner }, { kind: "self", owner: other },
    { kind: "literal", value: { kind: "number", value: rational(0n) }, base },
    { kind: "literal", value: { kind: "number", value: rational(0n, 1n, true) }, base },
    { kind: "literal", value: { kind: "number", value: rational(1n, 2n) }, base },
    { kind: "fixed-array", element: base, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
    { kind: "fixed-array", element: base, extent: { length: 9007199254740993n, runtimeBase: "number" } },
  ];
  const ids = rows.map(row => insertFixtureType(product, interner, row));
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(ids.map(id => readType(interner, id)), rows);
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), ids);
});

test("deferred alias applications require a qualified alias and keep ordered arguments through publication", () => {
  const interner = createTypeInterner();
  const definitionId = definition("ActualAlias");
  const external = definition("External");
  const parameter = product.internType(interner, { kind: "param", parameter: external });
  const text = product.internType(interner, { kind: "string" });
  const term = { kind: "alias-application", declaration: definitionId, arguments: [parameter, text] };
  const open = insertFixtureType(product, interner, term);
  assert.notEqual(insertFixtureType(product, interner, { ...term, arguments: [text, parameter] }), open);
  const { table, types } = completePublication(exportTypes(interner, publicationLimits));
  assert.deepEqual(table.terms[types[open]], { ...term, arguments: [types[parameter], types[text]] });
  const verify = nominal => runTypeVerifier({ ...verificationInputs, table, evidence: [], bindings: [],
    nominalOf: declaration => declaration === definitionId ? nominal : null });
  assert.deepEqual(verify({ kind: "alias", parameterCount: 2 }), []);
  for (const [nominal, field] of [[{ kind: "declared", facets: ["instance"] }, "declaration"],
    [{ kind: "alias", parameterCount: 1 }, "arguments"]]) {
    assert.equal(verify(nominal).some(finding => finding.rule === "nominal-definition"
      && finding.site.type === types[open] && finding.detail[0].value === field), true);
  }
});

test("merged interface applications preserve exact independent group identity and native argument order", () => {
  const definitions = [definition("FirstFragment"), definition("SecondFragment")];
  const otherDefinitions = [definition("ThirdFragment"), definition("FourthFragment")];
  const groupOf = fragments => ({
    kind: "merged-interface", definitions: fragments,
    slots: [0, 1].map(index => ({ scope: "local", parameters: fragments.map(fragment => parameterDeclaration(fragment, index)) })),
  });
  const firstGroup = groupOf(definitions);
  const secondGroup = groupOf(otherDefinitions);
  const retained = new Map([firstGroup, secondGroup].flatMap(group => group.definitions.map(fragment => [fragment, group])));
  const nominalOf = fragment => retained.get(fragment) ?? null;
  const verify = (table, lookup = nominalOf) => runTypeVerifier({
    ...verificationInputs, table, bindings: [], evidence: [], nominalOf: lookup,
  });
  const interner = createTypeInterner();
  const string = product.internType(interner, { kind: "string" });
  const boolean = product.internType(interner, { kind: "primitive", primitive: "bool" });
  const root = { kind: "merged-interface", definitions: [...definitions], arguments: [string, boolean] };
  const first = insertFixtureType(product, interner, root);
  assert.equal(insertFixtureType(product, interner, root), first);
  const reversed = insertFixtureType(product, interner, { ...root, arguments: [boolean, string] });
  const foreign = insertFixtureType(product, interner, { ...root, definitions: otherDefinitions });
  assert.equal(new Set([first, reversed, foreign]).size, 3);
  root.definitions[0] = otherDefinitions[0];
  assert.deepEqual(readType(interner, first).definitions, definitions);
  const { table, types } = completePublication(exportTypes(interner, publicationLimits));
  assert.deepEqual(verify(table), []);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  assert.deepEqual(table.terms[types[first]].arguments, [types[string], types[boolean]]);
  assert.deepEqual(table.terms[types[reversed]].arguments, [types[boolean], types[string]]);
  const equalButIndependent = fragment => fragment === definitions[1] ? { ...firstGroup } : nominalOf(fragment);
  assert.equal(verify(table, equalButIndependent).some(row => row.rule === "nominal-definition" && row.site.type === types[first]), true);
  for (const row of [
    { ...table.terms[types[first]], definitions: [definitions[0], otherDefinitions[1]] },
    { ...table.terms[types[first]], definitions: [...definitions].reverse() },
    { ...table.terms[types[first]], arguments: [types[string]] },
  ]) {
    const forged = { ...table, terms: table.terms.map((value, index) => index === types[first] ? row : value) };
    assert.equal(verify(forged).some(finding => finding.rule === "nominal-definition" && finding.site.type === types[first]), true);
  }
});

test("symbolic merged parameters require the complete independently verified and agreeing slot", () => {
  const definitions = [definition("SymbolicFirst"), definition("SymbolicSecond")];
  const parameters = definitions.map(fragment => parameterDeclaration(fragment, 0));
  const slot = { scope: "local", parameters };
  const group = { kind: "merged-interface", definitions, slots: [slot] };
  const verify = (table, lookup) => runTypeVerifier({ ...verificationInputs, table, bindings: [], evidence: [], nominalOf: lookup });
  const nominalOf = fragment => definitions.includes(fragment) ? group : null;
  const make = () => {
    const interner = createTypeInterner();
    const selected = product.internType(interner, { kind: "string" });
    const otherType = product.internType(interner, primitive);
    const symbolic = insertFixtureType(product, interner, { kind: "merged-parameter", parameters });
    return { interner, selected, otherType, symbolic };
  };
  const { interner, selected, otherType, symbolic } = make();
  const vector = values => ({ ...emptyBindings(), classBindings: values.map(([parameter, type]) =>
    ({ kind: "bound", parameter, type })) });
  const first = [parameters[0], selected];
  const second = [parameters[1], selected];
  const complete = vector([first, second]);
  for (const bindings of [vector([first]), vector([second]), vector([first, [parameters[1], otherType]])])
    assert.deepEqual(substitute(interner, [symbolic], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [symbolic] });
  assert.deepEqual(substitute(interner, [symbolic], complete, limits(), fixtureTypeWork(product)), { kind: "complete", value: [selected] });
  const scoped = declarations => ({ classParameters: declarations, methodParameters: [], capturedParameters: [], selfOwners: [] });
  for (const [declarations, expected] of [[parameters, "dependent"], [parameters.slice(1), "foreign"]])
    assert.deepEqual(product.readLexicalTypeSupport(viewTypes(interner), [symbolic], scoped(declarations), fixtureTypeAdmission()),
      { kind: "complete", value: expected });
  const { table, types } = completePublication(exportTypes(interner, publicationLimits));
  assert.deepEqual(verify(table, nominalOf), []);
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  const supplied = table.terms[types[symbolic]];
  for (const forged of [[...parameters].reverse(), [parameters[0], parameterDeclaration(definitions[1], 1)], [parameters[0]]]) {
    const crossed = { ...table, terms: table.terms.map(value => value === supplied ? { ...value, parameters: forged } : value) };
    assert.equal(verify(crossed, nominalOf).some(finding => finding.rule === "parameter-identity" && finding.site.type === types[symbolic]), true);
  }
  const separate = fragment => fragment === definitions[1] ? { ...group } : nominalOf(fragment);
  assert.equal(verify(table, separate).some(finding => finding.rule === "parameter-identity" && finding.site.type === types[symbolic]), true);
  for (const dimension of ["work", "result-entries"]) {
    let completed = false;
    for (let maximum = 0; maximum < 200; ++maximum) {
      const cold = make();
      const account = createAccount({ maximumWork: dimension === "work" ? maximum : 200,
        maximumResultEntries: dimension === "result-entries" ? maximum : 200 });
      const paid = { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) };
      const result = substitute(cold.interner, [cold.symbolic], complete, limits(), paid);
      if (result.kind === "complete") {
        assert.deepEqual(result.value, [cold.selected]);
        completed = true;
        break;
      }
      assert.equal(result === accountFailure(account), true);
      assert.equal(substitute(cold.interner, [cold.symbolic], complete, limits(), paid) === result, true);
    }
    assert.equal(completed, true, dimension);
  }
});

test("union, intersection, optional and member normalization is complete and does not mutate issued rows", () => {
  const interner = createTypeInterner();
  const integer = insertFixtureType(product, interner, primitive);
  const string = insertFixtureType(product, interner, { kind: "string" });
  const never = insertFixtureType(product, interner, { kind: "intrinsic", intrinsic: "never" });
  const absence = insertFixtureType(product, interner, { kind: "intrinsic", intrinsic: "absence" });
  const voidType = insertFixtureType(product, interner, { kind: "intrinsic", intrinsic: "void" });
  assert.equal(insertFixtureType(product, interner, { kind: "union", members: [] }), never);
  assert.equal(insertFixtureType(product, interner, { kind: "union", members: [integer, never, integer] }), integer);
  assert.equal(insertFixtureType(product, interner, { kind: "union", members: [voidType, absence] }), absence);
  const union = insertFixtureType(product, interner, { kind: "union", members: [string, integer] });
  assert.deepEqual(readType(interner, union), { kind: "union", members: [integer, string] });
  assert.equal(insertFixtureType(product, interner, { kind: "union", members: [integer, union, string] }), union);
  const optional = insertFixtureType(product, interner, { kind: "optional", value: union });
  assert.equal(insertFixtureType(product, interner, { kind: "union", members: [union, absence, optional] }), optional);
  assert.equal(insertFixtureType(product, interner, { kind: "optional", value: optional }), optional);
  for (const value of [absence, never, voidType]) assert.equal(insertFixtureType(product, interner, { kind: "optional", value }), absence);
  const intersection = insertFixtureType(product, interner, { kind: "intersection", members: [integer, string, integer] });
  assert.deepEqual(readType(interner, intersection), { kind: "intersection", members: [integer, string] });
  assert.equal(insertFixtureType(product, interner, { kind: "intersection", members: [intersection, string] }), intersection);
  assert.equal(insertFixtureType(product, interner, { kind: "intersection", members: [integer] }), integer);
  assert.throws(() => insertFixtureType(product, interner, { kind: "intersection", members: [] }), /at least one constituent/u);
  const origin = { kind: "declared", declaration: owner };
  const member = value => ({ key: { kind: "text", value }, origins: [origin], readOrigins: [origin], writeOrigins: [],
    kind: "property", read: integer, write: null, optional: false, readonly: true });
  const call = insertFixtureSignature(product, interner, signature({ result: integer }));
  const construct = insertFixtureSignature(product, interner, signature({ kind: "construct", result: integer }));
  const shape = { kind: "shape", members: [member("z"), member("a")], indexes: [
    { origin: { kind: "item", value: { owner: owner, node: 0 } }, key: string, read: integer, write: null, readonly: true },
    { origin: { kind: "item", value: { owner: other, node: 0 } }, key: string, read: integer, write: integer, readonly: false },
  ], calls: [call, call], constructs: [construct, construct] };
  const expected = { ...shape, members: [member("a"), member("z")], indexes: [...shape.indexes].reverse(), calls: [call], constructs: [construct] };
  assert.deepEqual(readType(interner, insertFixtureType(product, interner, shape)), expected);
  assert.deepEqual(readType(interner, insertFixtureType(product, interner, { kind: "callable", calls: [call, call], constructs: [construct, construct] })),
    { kind: "callable", calls: [call], constructs: [construct] });
  assert.deepEqual(readType(interner, union), { kind: "union", members: [integer, string] });
});

test("member keys, optional presence, independent setter type and nominal argument order are exact payloads", () => {
  const interner = createTypeInterner();
  const integer = insertFixtureType(product, interner, primitive);
  const string = insertFixtureType(product, interner, { kind: "string" });
  const origin = { kind: "declared", declaration: owner };
  const setter = { kind: "declared", declaration: method };
  const keys = [{ kind: "text", value: "0" }, { kind: "number", value: rational(0n) },
    { kind: "number", value: rational(0n, 1n, true) }, { kind: "number", value: rational(9007199254740993n) }];
  const shapes = keys.map(key => ({ kind: "shape", members: [{ key, origins: [origin, setter], readOrigins: [origin], writeOrigins: [setter],
    kind: "accessor", read: string, write: integer, optional: false, readonly: false }], indexes: [], calls: [], constructs: [] }));
  const expected = [...shapes, { ...shapes[0], members: [{ ...shapes[0].members[0], optional: true }] },
    { ...shapes[0], members: [{ ...shapes[0].members[0], write: string }] },
    { kind: "declared", definition: owner, arguments: [integer, string], facet: "instance", extent: null },
    { kind: "declared", definition: owner, arguments: [string, integer], facet: "instance", extent: null }];
  const issued = expected.map(value => insertFixtureType(product, interner, value));
  assert.deepEqual(issued, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(issued.map(type => readType(interner, type)), expected);
  assert.deepEqual(expected.map(value => insertFixtureType(product, interner, value)), issued);
});

test("canonical publication has independent complete expected order and is invariant under two insertion orders", () => {
  const build = order => {
    const interner = createTypeInterner();
    const ids = new Map(order.map(row => [row.kind, insertFixtureType(product, interner, row)]));
    insertFixtureType(product, interner, { kind: "array", element: ids.get("primitive"), readonly: false });
    return completePublication(exportTypes(interner, publicationLimits));
  };
  const expected = { terms: [{ kind: "array", element: 1, readonly: false }, primitive, { kind: "string" }], signatures: [] };
  assert.deepEqual(build([primitive, { kind: "string" }]), { table: expected, types: [1, 2, 0], signatures: [] });
  assert.deepEqual(build([{ kind: "string" }, primitive]), { table: expected, types: [2, 1, 0], signatures: [] });
  assert.equal(printTypes(expected), 'TypeTable(terms=[array(element=t:1, readonly=false), primitive(primitive="int32"), string()], signatures=[])\n');
  assert.deepEqual(parseTypes('TypeTable(terms=[array(element=t:1, readonly=false), primitive(primitive="int32"), string()], signatures=[])\n'),
    { kind: "parsed", value: expected });
});

test("publication has exact work and created-record boundaries with no partial publication or hidden limits", () => {
  const empty = createTypeInterner();
  assert.deepEqual(exportTypes(empty, { maximumWork: 0, maximumCreatedRecords: 0 }),
    { kind: "complete", value: { table: { terms: [], signatures: [] }, types: [], signatures: [] }, work: 0, createdRecords: 0 });
  assert.deepEqual(exportTypes(empty, { maximumWork: -0, maximumCreatedRecords: -0 }),
    { kind: "complete", value: { table: { terms: [], signatures: [] }, types: [], signatures: [] }, work: 0, createdRecords: 0 });
  const interner = createTypeInterner();
  const type = insertFixtureType(product, interner, primitive);
  const issued = readType(interner, type);
  assert.deepEqual(exportTypes(interner, { maximumWork: 0, maximumCreatedRecords: 1 }),
    { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.deepEqual(exportTypes(interner, { maximumWork: publicationLimits.maximumWork, maximumCreatedRecords: 0 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  assert.deepEqual(exportTypes(interner, { maximumWork: publicationLimits.maximumWork, maximumCreatedRecords: 1 }),
    { kind: "complete", value: { table: { terms: [primitive], signatures: [] }, types: [0], signatures: [] }, work: 12, createdRecords: 1 });
  for (const field of ["maximumWork", "maximumCreatedRecords"]) for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
    assert.throws(() => exportTypes(interner, { ...publicationLimits, [field]: value }),
      { name: "TypeError", message: "ir-types: publication maxima must be nonnegative safe integers." });
  assert.equal(readType(interner, type) === issued, true, "refusal leaves the issued row identical");
  assert.deepEqual(readType(interner, type), primitive);
});

test("primitive publication has a hand-derived twelve-event ordering boundary and never mutates its issued row", () => {
  const interner = createTypeInterner();
  assert.equal(insertFixtureType(product, interner, primitive), 0);
  const issued = readType(interner, 0);
  const expected = { table: { terms: [primitive], signatures: [] }, types: [0], signatures: [] };
  // Read 3 + graph (1 row + 3 fields) + initial rank (1 sort + 1 label) + key 1 + order 1 + issued map 1 = 12.
  for (let maximumWork = 0; maximumWork < 12; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 1 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [12, 13])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 1 }), { kind: "complete", value: expected, work: 12, createdRecords: 1 });
  assert.equal(readType(interner, 0), issued);
  assert.deepEqual(readType(interner, 0), primitive);
});

test("an admitted self-array has a twenty-event dense publication boundary", () => {
  const interner = createTypeInterner();
  const row = { kind: "array", element: 0, readonly: false };
  assert.equal(insertFixtureType(product, interner, row), 0);
  const expected = { table: { terms: [row], signatures: [] }, types: [0], signatures: [] };
  // Read 4 + graph (1 row + 4 fields + 1 edge) + rank (1 sort + 1 label + 3 edge events) + key 2 + order 1 + remap 1 + issued map 1 = 20.
  for (let maximumWork = 0; maximumWork < 20; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 2 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [20, 21])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 2 }), { kind: "complete", value: expected, work: 20, createdRecords: 2 });
  assert.deepEqual(readType(interner, 0), row);
});

test("an admitted two-member union orders its rows and edges without a second repair", () => {
  const interner = createTypeInterner();
  const rows = [primitive, { kind: "string" }, { kind: "union", members: [0, 1] }];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2]);
  const expected = { table: { terms: rows, signatures: [] }, types: [0, 1, 2], signatures: [] };
  // Read 8 + graph (3 rows + 8 fields + 2 edges) + rank (6 row + 6 edge events) + 5 keys/roles + order 3 + remap 2 + issued map 3 = 46.
  for (let maximumWork = 0; maximumWork < 46; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 5 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [46, 47])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 5 }), { kind: "complete", value: expected, work: 46, createdRecords: 5 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});

test("signature publication counts its own emitted ID field but not that ID as a reference edge", () => {
  const interner = createTypeInterner();
  assert.deepEqual([insertFixtureType(product, interner, primitive), insertFixtureType(product, interner, { kind: "string" })], [0, 1]);
  assert.equal(insertFixtureSignature(product, interner, signature()), 0);
  const expected = { table: { terms: [primitive, { kind: "string" }], signatures: [{ id: 0, ...signature() }] },
    types: [0, 1], signatures: [0] };
  // Read 15 + graph (3 rows + 14 fields without its emitted ID + 1 edge) + rank (6 row + 3 edge events)
  // + keys 4 + order 3 + remap 1 + issued map 3 = 53.
  // Three surviving rows plus the signature result slot create four records; its own ID is a field, not an edge.
  for (let maximumWork = 0; maximumWork < 53; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 4 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [53, 54])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 4 }), { kind: "complete", value: expected, work: 53, createdRecords: 4 });
  assert.deepEqual([readType(interner, 0), readType(interner, 1)], [primitive, { kind: "string" }]);
  assert.deepEqual(readSignature(interner, 0), { id: 0, ...signature() });
});


test("least closure is admitted once and final ordering does not repeat its repair", () => {
  const interner = createTypeInterner();
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "intersection", members: [2, 3] },
    { kind: "string" }, { kind: "union", members: [4, 5] }];
  const admitted = insertFixtureGraph(product, interner, rows);
  assert.equal(admitted.types[0] === admitted.types[1], true);
  assert.equal(admitted.types[2] === admitted.types[3] && admitted.types[2] === admitted.types[4], true);
  const expected = { table: { terms: [{ kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 4 }, { kind: "string" },
    { kind: "union", members: [0, 3] }], signatures: [] },
    types: [0, 0, 1, 1, 1, 3, 2], signatures: [] };
  // Read 15 + graph (5 rows + 15 fields + 5 edges) + rank (10 row + 15 edge + 1 optional split)
  // + keys 10 + order 5 + remap 5 + issued map 5 = 91.
  for (let maximumWork = 0; maximumWork < 91; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 10 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [91, 92]) {
    const limits = { maximumWork, maximumCreatedRecords: 10 };
    assert.deepEqual(publishedBatch(interner, admitted, limits), expected);
    const result = exportTypes(interner, limits);
    assert.equal(result.kind === "complete" && result.work === 91 && result.createdRecords === 10, true);
  }
});

test("partition moves and predecessor refinement have a hand-derived three-array-chain work boundary", () => {
  const interner = createTypeInterner();
  const rows = [primitive, { kind: "array", element: 0, readonly: false },
    { kind: "array", element: 1, readonly: false }, { kind: "array", element: 2, readonly: false }];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3]);
  const expected = { table: { terms: [{ kind: "array", element: 3, readonly: false },
    { kind: "array", element: 0, readonly: false }, { kind: "array", element: 1, readonly: false }, primitive], signatures: [] },
    types: [3, 0, 1, 2], signatures: [] };
  // Read 15 + graph (4 rows + 15 fields + 3 edges) + rank (8 row + 9 initial edge + 12 split events)
  // + keys 7 + order 4 + remap 3 + issued map 4 = 84.
  // The two splits prepay complement/moved rows 3+1, move two predecessor edges, and add two splitter edges and four predicates.
  for (let maximumWork = 0; maximumWork < 84; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 7 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [84, 85])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 7 }), { kind: "complete", value: expected, work: 84, createdRecords: 7 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});
test("admission repairs either staged child ordering without changing the kept prefix", () => {
  for (const earlyOptional of [true, false]) {
    const interner = createTypeInterner();
    const arrays = [{ kind: "string" }, { kind: "array", element: 2, readonly: false },
      { kind: "array", element: 1, readonly: false }];
    const rows = earlyOptional
      ? [...arrays, { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "optional", value: 2 },
          { kind: "intersection", members: [4, 5] }, { kind: "union", members: [0, 6] }]
      : [...arrays, { kind: "optional", value: 1 }, { kind: "optional", value: 2 },
          { kind: "intersection", members: [3, 4] }, { kind: "optional", value: 0 }, { kind: "union", members: [0, 5] }];
    assert.equal(insertFixtureType(product, interner, rows[0]), 0);
    const prefix = readType(interner, 0);
    const staged = rows.slice(1);
    // First row pull needs one event after 7 header and 4 + 7 mapping events.
    expectConstructionStop(interner, staged, 18);
    const selected = insertFixtureGraph(product, interner, staged);
    const admitted = { ...selected, types: [0, ...selected.types] };
    const expected = { table: { terms: [{ kind: "array", element: 0, readonly: false },
      { kind: "optional", value: 0 }, { kind: "optional", value: 4 }, { kind: "optional", value: 5 },
      { kind: "string" }, { kind: "union", members: [0, 4] }], signatures: [] },
      types: earlyOptional ? [4, 0, 0, 2, 1, 1, 1, 3] : [4, 0, 0, 1, 1, 1, 2, 3], signatures: [] };
    assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 11 }),
      { kind: "resource-limit", dimension: "created-records", maximum: 11 });
    assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 12 }), expected);
    assert.equal(readType(interner, 0) === prefix, true);
  }
});

test("a recursive pair merges only after the hand-derived admission setup", () => {
  const interner = createTypeInterner();
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, tuple(0), tuple(2)];
  // Header 7 + input mapping 9 + 2 array pulls/reads (2 × 6) + union (6) + 2 tuples (2 × 9) = 52.
  // Graph stage setup needs 8 + 5 × 5 = 33 more before any staged row can participate.
  expectConstructionStop(interner, rows, 84);
  const admitted = insertFixtureGraph(product, interner, rows);
  assert.deepEqual(admitted.types, [0, 0, 0, 1, 1]);
  assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 4 }),
    { table: { terms: [{ kind: "array", element: 0, readonly: false }, tuple(0)], signatures: [] },
      types: [0, 0, 0, 1, 1], signatures: [] });
});

test("nested bisimulation witness evaluation propagates a closed work stop before touching issued rows", () => {
  const interner = createTypeInterner();
  const tuple = types => ({ kind: "tuple", elements: types.map((type, index) => ({
    kind: index === 0 ? "required" : "optional", type, declaration: null })), readonly: false });
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, primitive, tuple([0]), tuple([3]), tuple([4, 2]), tuple([5, 0])];
  // Header and input mappings 19; next charge is the first pull.
  expectConstructionStop(interner, rows, 19);
  const admitted = insertFixtureGraph(product, interner, rows);
  assert.deepEqual(admitted.types.slice(0, 3), [0, 0, 0]);
  assert.notEqual(admitted.types[4], admitted.types[5]);
  assert.notEqual(admitted.types[6], admitted.types[7]);
  const issued = [...viewTypes(interner).terms];
  assert.equal(exportTypes(interner, publicationLimits).kind, "complete");
  assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
});

test("dead nested witnesses preserve either staged direction and the first original work refusal", () => {
  const array = element => ({ kind: "array", element, readonly: false });
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const table = { terms: [array(2), array(1), primitive, tuple(0), tuple(1)], signatures: [] };
  for (const changedFirst of [true, false]) {
    const interner = createTypeInterner();
    const parents = changedFirst ? [tuple(4), tuple(5)] : [tuple(5), tuple(4)];
    const rows = [array(1), array(0), { kind: "union", members: [0, 1] }, primitive, array(2), array(3), ...parents];
    // Input: header/map 19 + four arrays 24 + union 6 + primitive 4 + two tuples 18 = 71;
    // all attempt the same 48-event private graph setup before any staged row can be issued.
    expectConstructionStop(interner, rows, 118);
    const admitted = insertFixtureGraph(product, interner, rows);
    const issued = [...viewTypes(interner).terms];
    assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 9 }),
      { table, types: changedFirst ? [1, 1, 1, 2, 1, 0, 4, 3] : [1, 1, 1, 2, 1, 0, 3, 4], signatures: [] });
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
  }
});

test("both ordered recursive repairs keep separate carriers and stop before any premature issuance", () => {
  const array = (element, readonly) => ({ kind: "array", element, readonly });
  const tuple = (type, readonly) => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly });
  const table = { terms: [array(0, false), array(1, true), tuple(0, false), tuple(1, true)], signatures: [] };
  for (const earlyReadonly of [false, true]) {
    const interner = createTypeInterner();
    const rows = [array(1, earlyReadonly), array(0, earlyReadonly), { kind: "union", members: [0, 1] },
      tuple(0, earlyReadonly), tuple(2, earlyReadonly), array(6, !earlyReadonly), array(5, !earlyReadonly),
      { kind: "union", members: [5, 6] }, tuple(5, !earlyReadonly), tuple(7, !earlyReadonly)];
    // Header/map 21 + four arrays 24 + two unions 12 + four tuples 36 = 93;
    // setup 58, then the first array's row/fields 4, retained edge 1, and schedule 1.
    for (const maximumWork of [150, 151, 155, 156]) expectConstructionStop(interner, rows, maximumWork);
    const admitted = insertFixtureGraph(product, interner, rows);
    const issued = [...viewTypes(interner).terms];
    assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 7 }),
      { kind: "resource-limit", dimension: "created-records", maximum: 7 });
    // Final ordering has four distinct labels and four edges. Read 22 + graph 30 + rank 20
    // + keys 8 + order 4 + remap 4 + issued map 4 = 92.
    for (let maximumWork = 0; maximumWork < 92; maximumWork += 1) {
      assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 8 }),
        { kind: "resource-limit", dimension: "work", maximum: maximumWork });
      assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
    }
    assert.deepEqual(publishedBatch(interner, admitted, { maximumWork: 92, maximumCreatedRecords: 8 }),
      { table, types: earlyReadonly ? [1, 1, 1, 3, 3, 0, 0, 0, 2, 2] : [0, 0, 0, 2, 2, 1, 1, 1, 3, 3], signatures: [] });
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
  }
});

test("canonical bisimulation quotients both staged three-array cycle orders before issuing any row", () => {
  for (const edges of [[1, 2, 0], [2, 0, 1]]) {
    const interner = createTypeInterner();
    const issued = insertFixtureGraph(product, interner, edges.map(element => ({ kind: "array", element, readonly: false }))).types;
    const expected = { kind: "array", element: 0, readonly: false };
    assert.deepEqual(issued, [0, 0, 0]);
    const original = readType(interner, issued[0]);
    assert.deepEqual(original, expected);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [] },
      types: [0], signatures: [] });
    assert.equal(issued.every(type => readType(interner, type) === original), true);
  }
});

test("newly equal union and intersection children normalize before choosing the old representative", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    const [first] = insertFixtureGraph(product, interner, [{ kind: "array", element: 0, readonly: false }]).types;
    const issued = readType(interner, first);
    const later = insertFixtureGraph(product, interner, [
      { kind: "array", element: 2, readonly: false }, { kind: "array", element: 1, readonly: false },
      { kind, members: [1, 2] },
    ]);
    assert.deepEqual(later.types, [first, first, first]);
    assert.equal(insertFixtureType(product, interner, issued), first);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [] },
      types: [0], signatures: [] });
    assert.equal(readType(interner, first) === issued, true);
  }
});

test("admission propagates exposed aliases through recursive constructors before reducing an outer union", () => {
  const interner = createTypeInterner();
  const array = element => ({ kind: "array", element, readonly: false });
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const issued = [array(1), tuple(0), array(8), array(9), array(10), tuple(2), tuple(3), tuple(4),
    { kind: "union", members: [5, 6] }, { kind: "union", members: [6, 7] }, { kind: "union", members: [5, 7] },
    { kind: "union", members: [0, 2] }];
  assert.deepEqual(insertFixtureGraph(product, interner, issued).types, [0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0]);
  const expected = { terms: [array(1), tuple(0)], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1], signatures: [] });
  assert.deepEqual(viewTypes(interner).terms, expected.terms);
});

test("the mixed recursive union and array corner retains three labelled classes in either issue order", () => {
  const expected = { terms: [{ kind: "array", element: 1, readonly: false },
    { kind: "array", element: 2, readonly: false }, { kind: "union", members: [0, 1] }], signatures: [] };
  const text = 'TypeTable(terms=[array(element=t:1, readonly=false), array(element=t:2, readonly=false), union(members=[t:0, t:1])], signatures=[])\n';
  const orders = [
    { rows: [{ kind: "array", element: 2, readonly: false }, { kind: "array", element: 0, readonly: false },
      { kind: "union", members: [0, 1] }], maps: [1, 0, 2] },
    { rows: [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 2, readonly: false },
      { kind: "union", members: [1, 0] }], maps: [0, 1, 2] },
  ];
  for (const order of orders) {
    const interner = createTypeInterner();
    assert.deepEqual(insertFixtureGraph(product, interner, order.rows).types, [0, 1, 2]);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: order.maps, signatures: [] });
    assert.equal(printTypes(completePublication(exportTypes(interner, publicationLimits)).table), text);
  }
});

test("signature cycle quotienting and callable set reduction retain complete issued signature maps", () => {
  for (const edges of [[1, 2, 0], [2, 0, 1]]) {
    const interner = createTypeInterner();
    assert.equal(insertFixtureType(product, interner, primitive), 0);
    const rows = edges.map(child => signature({ composition: { kind: "union", signatures: [child] } }));
    const admitted = insertFixtureGraph(product, interner, [{ kind: "callable", calls: [0, 1, 2], constructs: [] }], rows);
    assert.deepEqual(admitted, { types: [1], signatures: [0, 0, 0] });
    const expected = { terms: [{ kind: "callable", calls: [0], constructs: [] }, primitive], signatures: [
      { id: 0, ...signature({ composition: { kind: "union", signatures: [0] }, result: 1 }) },
    ] };
    assert.deepEqual(publishedBatch(interner, { ...admitted, types: [0, ...admitted.types] }),
      { table: expected, types: [1, 0], signatures: [0, 0, 0] });
    assert.deepEqual(viewTypes(interner).signatures, [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }]);
  }
});

test("alias repair compares full signature results and preserves both directions of callable edge absence", () => {
  for (const order of [["full", "empty"], ["empty", "full"]]) {
    const interner = createTypeInterner();
    const terms = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
      { kind: "union", members: [0, 1] }, primitive,
      ...order.map(kind => ({ kind: "callable", calls: kind === "full" ? [0, 1, 2] : [], constructs: [] }))];
    const rows = [signature({ result: 0 }), signature({ result: 2 }), signature({ result: 3 })];
    const admitted = insertFixtureGraph(product, interner, terms, rows);
    assert.deepEqual(admitted.types.slice(0, 3), [0, 0, 0]);
    assert.deepEqual(admitted.signatures, [0, 0, 1]);
    assert.deepEqual(publishedBatch(interner, admitted), { table: { terms: [
      { kind: "array", element: 0, readonly: false }, { kind: "callable", calls: [0, 1], constructs: [] },
      { kind: "callable", calls: [], constructs: [] }, primitive,
    ], signatures: [{ id: 0, ...signature({ result: 0 }) }, { id: 1, ...signature({ result: 3 }) }] },
      types: [0, 0, 0, 3, ...order.map(kind => kind === "full" ? 1 : 2)], signatures: [0, 0, 1] });
    assert.deepEqual(viewTypes(interner).signatures.map(row => row.result), [admitted.types[0], admitted.types[3]]);
    assert.deepEqual(viewTypes(interner).terms.filter(row => row.kind === "union"), []);
  }
});

test("a failed nested bisimulation witness propagates without merging distinct signature result subtrees", () => {
  const interner = createTypeInterner();
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const terms = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, primitive, tuple(0), tuple(2), tuple(3),
    { kind: "callable", calls: [0, 1, 2], constructs: [] }];
  const rows = [signature({ result: 4 }), signature({ result: 5 }), signature({ result: 6 })];
  const admitted = insertFixtureGraph(product, interner, terms, rows);
  assert.deepEqual(admitted.signatures, [0, 0, 1]);
  assert.deepEqual(publishedBatch(interner, admitted), { table: { terms: [
    { kind: "array", element: 0, readonly: false }, { kind: "callable", calls: [0, 1], constructs: [] }, primitive, tuple(0), tuple(2),
  ], signatures: [{ id: 0, ...signature({ result: 4 }) }, { id: 1, ...signature({ result: 3 }) }] },
    types: [0, 0, 0, 2, 3, 3, 4, 1], signatures: [1, 1, 0] });
  assert.deepEqual(viewTypes(interner).signatures.map(row => row.result), [admitted.types[4], admitted.types[6]]);
});

test("flattened members reuse an existing complete row after an intersection alias is exposed", () => {
  const interner = createTypeInterner();
  const fixed = (element, length) => ({ kind: "fixed-array", element, extent: { length, runtimeBase: "number" } });
  const terms = [fixed(1, 1n), fixed(0, 1n), fixed(3, 2n), fixed(2, 2n),
    { kind: "union", members: [0, 2] }, { kind: "union", members: [1, 3] }, { kind: "intersection", members: [4, 5] },
    { kind: "param", parameter: parameterDeclaration(owner, 0) }, { kind: "union", members: [6, 7] }, { kind: "union", members: [0, 2, 7] }];
  const admitted = insertFixtureGraph(product, interner, terms);
  assert.equal(admitted.types[8] === admitted.types[9], true);
  const issued = [...viewTypes(interner).terms];
  assert.deepEqual(publishedBatch(interner, admitted), { table: { terms: [fixed(0, 1n), fixed(1, 2n), terms[7],
    { kind: "union", members: [0, 1, 2] }, { kind: "union", members: [0, 1] }], signatures: [] },
    types: [0, 0, 1, 1, 4, 4, 4, 2, 3, 3], signatures: [] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "all issued rows retain their original identity");
});

test("typed forward references expose shared intersection aliases whose required flattened output grows", () => {
  const document = `TypeTable(terms=[
    fixed-array(element=t:1, extent=FixedExtent(length=1n, runtimeBase="number")),
    fixed-array(element=t:0, extent=FixedExtent(length=1n, runtimeBase="number")),
    fixed-array(element=t:3, extent=FixedExtent(length=2n, runtimeBase="number")),
    fixed-array(element=t:2, extent=FixedExtent(length=2n, runtimeBase="number")),
    fixed-array(element=t:5, extent=FixedExtent(length=3n, runtimeBase="number")),
    fixed-array(element=t:4, extent=FixedExtent(length=3n, runtimeBase="number")),
    fixed-array(element=t:7, extent=FixedExtent(length=4n, runtimeBase="number")),
    fixed-array(element=t:6, extent=FixedExtent(length=4n, runtimeBase="number")),
    union(members=[t:0, t:2, t:4, t:6]), union(members=[t:1, t:3, t:5, t:7]),
    intersection(members=[t:8, t:9]),
    param(parameter=def:${JSON.stringify(parameterDeclaration(owner, 0))}),
    param(parameter=def:${JSON.stringify(parameterDeclaration(owner, 1))}),
    param(parameter=def:${JSON.stringify(parameterDeclaration(owner, 2))}),
    param(parameter=def:${JSON.stringify(parameterDeclaration(owner, 3))}),
    union(members=[t:10, t:11]), union(members=[t:10, t:12]),
    union(members=[t:10, t:13]), union(members=[t:10, t:14])
  ], signatures=[])`;
  const parsed = parseTypes(document);
  assert.equal(parsed.kind, "parsed");
  if (parsed.kind !== "parsed") return;
  const interner = createTypeInterner();
  const admitted = insertFixtureGraph(product, interner, parsed.value.terms);
  assert.deepEqual(admitted.types.slice(8, 11), [admitted.types[8], admitted.types[8], admitted.types[8]]);
  const before = [...viewTypes(interner).terms];
  const expected = { terms: [
    ...[0, 1, 2, 3].map(index => ({ kind: "fixed-array", element: index, extent: { length: BigInt(index + 1), runtimeBase: "number" } })),
    ...[0, 1, 2, 3].map(index => ({ kind: "param", parameter: parameterDeclaration(owner, index) })),
    ...[4, 5, 6, 7].map(type => ({ kind: "union", members: [0, 1, 2, 3, type] })),
    { kind: "union", members: [0, 1, 2, 3] },
  ], signatures: [] };
  assert.deepEqual(publishedBatch(interner, admitted), { table: expected,
    types: [0, 0, 1, 1, 2, 2, 3, 3, 12, 12, 12, 4, 5, 6, 7, 8, 9, 10, 11], signatures: [] });
  assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 41 }), {
    table: expected, types: [0, 0, 1, 1, 2, 2, 3, 3, 12, 12, 12, 4, 5, 6, 7, 8, 9, 10, 11], signatures: [] });
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 40 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 40 });
  for (const maximumWork of [0, 1, 100]) assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumWork }),
    { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  assert.equal(before.every((row, type) => readType(interner, type) === row), true, "every original issued row retains identity");
});

test("canonical partition refinement handles a 100000-link nonrecursive reference chain", () => {
  const interner = createTypeInterner();
  let child = insertFixtureType(product, interner, primitive);
  for (let position = 0; position < 100000; position += 1)
    child = insertFixtureType(product, interner, { kind: "array", element: child, readonly: false });
  const publication = completePublication(exportTypes(interner, { ...publicationLimits, maximumWork: 1000000000 }));
  const table = publication.table;
  assert.deepEqual([...publication.types].sort((left, right) => left - right), Array.from({ length: 100001 }, (_, index) => index));
  assert.deepEqual(publication.signatures, []);
  const terms = new Array(100001);
  terms[publication.types[0]] = primitive;
  for (let position = 1; position <= 100000; position += 1)
    terms[publication.types[position]] = { kind: "array", element: publication.types[position - 1], readonly: false };
  assert.equal(compareCaseValues(table, { terms, signatures: [] }), true, "complete chain value under the total published identity map");
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.equal(compareCaseValues(parseTypes(printTypes(table)), { kind: "parsed", value: table }), true, "whole canonical long chain");
  assert.deepEqual(readType(interner, child), { kind: "array", element: 99999, readonly: false });
  assert.deepEqual(readType(interner, 0), primitive);
});

test("canonical structural ordering retains several hundred distinct ordered child slots", () => {
  const interner = createTypeInterner();
  const base = insertFixtureType(product, interner, primitive);
  const elements = Array.from({ length: 300 }, (_, position) => ({ kind: "required", type: base,
    declaration: position % 2 === 0 ? owner : null }));
  const tuple = { kind: "tuple", elements, readonly: false };
  assert.equal(insertFixtureType(product, interner, tuple), 1);
  const expected = { terms: [primitive, tuple], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1], signatures: [] });
  assert.deepEqual(readType(interner, 1), tuple);
});

test("canonical type equality depends on complete component values rather than inline object sharing", () => {
  const nested = () => ({ root: itemSource, path: [{ kind: "result", signature: 0 }] });
  const arm = component => ({ kind: "sum-arm", index: 0, family: { origin: "authored", component,
    parameters: [], roles: [{ authoredIndex: 0, component: source, member: 0 }] } });
  const projection = path => ({ kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path } } });
  const expected = { terms: [primitive, projection([arm(nested()), arm(nested())])], signatures: [{ id: 0, ...signature() }] };
  for (const shared of [true, false]) {
    const interner = createTypeInterner();
    insertFixtureType(product, interner, primitive);
    insertFixtureSignature(product, interner, signature());
    const component = nested();
    insertFixtureType(product, interner, projection([arm(component), arm(shared ? component : nested())]));
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1], signatures: [0] });
  }
});

test("interned inline values remain complete and immutable for shared and separately authored caller values", () => {
  const member = (value, origins) => ({ key: { kind: "text", value }, origins, readOrigins: origins, writeOrigins: origins,
    kind: "property", read: 0, write: 0, optional: false, readonly: false });
  const expected = { kind: "shape", members: [member("a", [{ kind: "declared", declaration: owner }]),
    member("z", [{ kind: "declared", declaration: owner }])], indexes: [], calls: [], constructs: [] };
  for (const shared of [true, false]) {
    const interner = createTypeInterner();
    const origin = { kind: "declared", declaration: owner };
    const origins = [origin];
    const shape = { kind: "shape", members: [member("z", origins), member("a", shared ? origins : [{ ...origin }])],
      indexes: [], calls: [], constructs: [] };
    assert.equal(insertFixtureType(product, interner, primitive), 0);
    assert.equal(insertFixtureType(product, interner, shape), 1);
    const saved = readType(interner, 1);
    assert.deepEqual(saved, expected);
    origin.declaration = other;
    origins.push({ kind: "declared", declaration: method });
    assert.deepEqual(readType(interner, 1), expected);
    assert.equal(insertFixtureType(product, interner, expected), 1);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)),
      { table: { terms: [primitive, expected], signatures: [] }, types: [0, 1], signatures: [] });
  }
});

test("canonical publication does not identify different nominal payloads or readonly recursive carriers", () => {
  const interner = createTypeInterner();
  const rows = [
    { kind: "array", element: 0, readonly: false },
    { kind: "array", element: 1, readonly: true },
    { kind: "declared", definition: owner, arguments: [0], facet: "instance", extent: null },
    { kind: "declared", definition: owner, arguments: [0], facet: "value", extent: null },
    { kind: "declared", definition: other, arguments: [0], facet: "instance", extent: null },
  ];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3, 4]);
  const expected = { terms: [rows[0], rows[1], rows[4], rows[2], rows[3]], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1, 3, 4, 2], signatures: [] });
  assert.deepEqual(rows.map((_, position) => readType(interner, position)), rows);
});

test("every native primitive and intrinsic arm is interned, read, printed and parsed through the public index", () => {
  const natives = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
  const intrinsics = ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol", "alias-marker"];
  const rows = [...natives.map(primitive => ({ kind: "primitive", primitive })), ...intrinsics.map(intrinsic => ({ kind: "intrinsic", intrinsic }))];
  const interner = createTypeInterner();
  assert.deepEqual(rows.map(row => readType(interner, product.internType(interner, row))), rows);
  const table = { terms: rows, signatures: [] };
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
});

test("source-environment inventory rows round-trip with their original intrinsic member headers only", () => {
  const member = (name, symbol) => {
    const origin = { kind: "intrinsic", symbol };
    return { key: { kind: "text", value: name }, origins: [origin], readOrigins: [origin], writeOrigins: [],
      kind: "property", optional: false, readonly: true };
  };
  const variable = { kind: "declared", declaration: owner };
  const members = [member("globalThis", "global-this"), member("undefined", "undefined"), {
    key: { kind: "text", value: "workspaceValue" }, origins: [variable], readOrigins: [variable], writeOrigins: [variable],
    kind: "property", optional: false, readonly: false,
  }];
  const row = { kind: "source-environment", members };
  const interner = createTypeInterner();
  const selected = insertFixtureType(product, interner, { ...row, members: [...members].reverse() });
  assert.deepEqual(readType(interner, selected), row);
  const table = { terms: [row], signatures: [] };
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
  assert.deepEqual(verifyTypes(verification(table.terms)), []);
  assert.deepEqual(readType(admitFixtureTable(product, table), selected), row);
  const opposite = { ...row, members: [{ ...members[0], key: { kind: "text", value: "foreign" } }] };
  assert.deepEqual(verifyTypes(verification([opposite])), [violation("member-origins", typeSite(0), "members.origins", 0)]);
  assert.deepEqual(product.admitTypeTable({ ...table, terms: [{ ...row, members: new Array(1) }] }, fixtureTypeAdmission()),
    { kind: "invalid", violations: [violation("type-reference", typeSite(0), "members[0]")] });
});

test("all TypeTerm, literal, selector, origin, signature and passing arms round-trip complete declared records", () => {
  const origins = [{ kind: "declared", declaration: owner }, { kind: "class-prototype", owner: other },
    { kind: "mapped", owner: itemSource, key: { kind: "symbol", declaration: other } },
    { kind: "intrinsic", symbol: "global-this" }, { kind: "intrinsic", symbol: "undefined" },
    { kind: "source-member", occurrence: source.value }];
  const construction = { occurrence: source.value, captures: [{ body, local: 0 }, { body, local: 1 }] };
  const family = { origin: "authored", component: { root: source, path: [] }, parameters: [parameterDeclaration(owner, 0)],
    roles: [{ authoredIndex: 0, component: source, member: 0 }, { authoredIndex: 1, component: itemSource, member: 1 }] };
  const selectors = [
    { kind: "class-value" }, { kind: "construction-argument", definition: construction, index: 0 }, { kind: "optional-value" },
    { kind: "array-element" }, { kind: "tuple-element", index: 0 }, { kind: "union-member", index: 1 },
    { kind: "argument-place", index: 0 }, { kind: "parameter-place", index: 1 }, { kind: "intersection-member", index: 0 },
    { kind: "intersection-result" }, { kind: "argument-tail", start: 1 }, { kind: "parameter-tail", start: 0 },
    { kind: "member", origin: origins[2] }, { kind: "index-key", origin: itemSource, key: 0 }, { kind: "index-value", origin: { kind: "item", value: { owner: other, node: 0 } }, key: 1 },
    { kind: "projection-source" }, { kind: "parameter", signature: 0, index: 0 }, { kind: "receiver", signature: 0 },
    { kind: "signature-tail", signature: 0, start: 1, readonly: true }, { kind: "tuple-slice", start: 0, endCount: 2, readonly: false },
    { kind: "result", signature: 0 }, { kind: "type-argument", declaration: owner, index: 0 },
    { kind: "sum-arm", family, index: 1 }, { kind: "sum-arm", family: { ...family, origin: "inferred" }, index: 0 }, { kind: "awaited" },
  ];
  const literals = [{ kind: "number", value: rational(1n, 2n) }, { kind: "number", value: rational(0n, 1n, true) },
    { kind: "bigint", value: 9007199254740993n }, { kind: "string", value: 'quote" slash\\ newline\n lone\ud800' },
    { kind: "boolean", value: false }, { kind: "absence" }, { kind: "unique-symbol", declaration: owner }];
  const passing = ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"];
  const records = [primitive, { kind: "string" }, { kind: "intrinsic", intrinsic: "absence" },
    ...literals.map(value => ({ kind: "literal", value, base: 0 })),
    { kind: "union", members: [0, 1] }, { kind: "intersection", members: [0, 1] }, { kind: "optional", value: 0 },
    { kind: "array", element: 0, readonly: true },
    { kind: "tuple", elements: [{ kind: "required", type: 0, declaration: owner }, { kind: "optional", type: 1, declaration: null },
      { kind: "rest", type: 0, declaration: other }], readonly: false },
    { kind: "fixed-array", element: 0, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
    { kind: "shape", members: [
      { key: { kind: "text", value: "field" }, origins, readOrigins: [origins[0]], writeOrigins: [origins[1]],
        kind: "property", read: 0, write: 1, optional: true, readonly: false },
      { key: { kind: "number", value: rational(-1n, 2n) }, origins: [origins[0]], readOrigins: [], writeOrigins: [],
        kind: "method", read: null, write: null, optional: false, readonly: true },
      { key: { kind: "symbol", declaration: other }, origins: [origins[2]], readOrigins: [origins[2]], writeOrigins: [],
        kind: "accessor", read: 0, write: null, optional: false, readonly: true },
    ], indexes: [{ origin: { kind: "item", value: { owner: owner, node: 0 } }, key: 1, read: 0, write: 0, readonly: false },
      { origin: { kind: "item", value: { owner: other, node: 0 } }, key: 0, read: 1, write: null, readonly: true }], calls: [0], constructs: [1] },
    { kind: "callable", calls: [0], constructs: [1] },
    { kind: "declared", definition: owner, arguments: [0, 1], facet: "instance", extent: null },
    { kind: "declared", definition: owner, arguments: [], facet: "value", extent: { length: 0n, runtimeBase: "number" } },
    { kind: "construction-reference", definition: construction, arguments: [0, 1] },
    { kind: "enum", definition: definition("Enum") }, { kind: "param", parameter: parameterDeclaration(owner, 0) },
    { kind: "self", owner }, { kind: "projection", source: 0, projection: { kind: "awaited" } },
    { kind: "projection", source: 1, projection: { kind: "component", component: { root: itemSource, path: selectors } } },
    { kind: "open", group: encodeGroupId([body, otherBody]), variable: -0 }, { kind: "error" },
  ];
  const table = { terms: records, signatures: [
    { id: 0, ...signature({ declaration: owner, owner: source, composition: { kind: "union", signatures: [0, 1] },
      typeParameters: [{ declaration: parameterDeclaration(owner, 0), constraint: 0, default: 1 }], receiver: 1,
      parameters: passing.map((mode, index) => ({ declaration: definition(`p${index}`), kind: index === 6 ? "rest" : "required",
        type: 0, passing: mode, initializer: null, acceptsOmission: index === 6 })) }) },
    { id: 1, ...signature({ kind: "construct", owner: itemSource, composition: { kind: "intersection", signatures: [0, 1] },
      typeParameters: [{ declaration: parameterDeclaration(other, 0), constraint: null, default: null }],
      parameters: [{ declaration: method, kind: "optional", type: 1, passing: "by-value", initializer: null, acceptsOmission: true },
        { declaration: captured, kind: "default", type: 0, passing: "move", initializer: body, acceptsOmission: true }] }) },
  ] };
  assert.equal(compareCaseValues(parseTypes(printTypes(table)), { kind: "parsed", value: table }), true, "complete all-arm text value");
  const interner = createTypeInterner();
  const { types: ids, signatures: signatureIds } = insertFixtureGraph(product, interner, records,
    table.signatures.map(({ id, ...input }) => input));
  const normalized = records.map(term => term.kind === "shape" ? { ...term,
    members: [term.members[1], term.members[2], term.members[0]], indexes: [term.indexes[1], term.indexes[0]] } : term);
  assert.deepEqual(ids.map(type => readType(interner, type)), normalized);
  const verified = normalized;
  assert.deepEqual(verifyTypes({ table: { terms: verified, signatures: table.signatures }, bindings: [], evidence: [] }), []);
  const seeded = admitFixtureTable(product, { terms: verified, signatures: table.signatures });
  assert.deepEqual(verified.map((_, position) => readType(seeded, position)), verified);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(seeded, position)), table.signatures);
  assert.deepEqual(signatureIds.map(id => readSignature(interner, id)), table.signatures);
  const published = completePublication(exportTypes(interner, publicationLimits));
  assert.equal(compareCaseValues(parseTypes(printTypes(published.table)), { kind: "parsed", value: published.table }), true, "complete published all-arm table");
});

test("every reachable plain-number role retains exact special host numbers without a hidden finite precondition", () => {
  const group = encodeGroupId([body]);
  for (const [value, spelling] of [[NaN, "NaN"], [Infinity, "+Infinity"], [-Infinity, "-Infinity"], [-0, "-0"], [-1, "-1"], [0.5, "0.5"]]) {
    const table = { terms: [{ kind: "open", group, variable: value }], signatures: [] };
    const expected = `TypeTable(terms=[open(group=group:${JSON.stringify(group)}, variable=${spelling})], signatures=[])\n`;
    assert.equal(printTypes(table), expected);
    assert.deepEqual(parseTypes(expected), { kind: "parsed", value: table });
    const nested = { terms: [primitive, { kind: "param", parameter: parameterDeclaration(owner, 0) },
      { kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path: [
        { kind: "tuple-element", index: value }, { kind: "argument-tail", start: value },
        { kind: "tuple-slice", start: value, endCount: value, readonly: false },
        { kind: "sum-arm", index: value, family: { origin: "authored", component: { root: itemSource, path: [] },
          parameters: [parameterDeclaration(owner, 0)], roles: [{ authoredIndex: value, component: source, member: 0 }] } },
      ] } } }], signatures: [{ id: 0, ...signature({ typeParameters: [
        { declaration: parameterDeclaration(owner, 0), constraint: null, default: null }] }) }] };
    assert.deepEqual(parseTypes(printTypes(nested)), { kind: "parsed", value: nested });
  }
});

test("known numeric identity prefixes retain the whole declared number while verification owns reference bounds", () => {
  for (const [value, spelling] of [[NaN, "NaN"], [Infinity, "+Infinity"], [-Infinity, "-Infinity"], [-0, "-0"], [-1, "-1"], [0.5, "0.5"]]) {
    const typeTable = { terms: [{ kind: "array", element: value, readonly: false }], signatures: [] };
    const text = `TypeTable(terms=[array(element=t:${spelling}, readonly=false)], signatures=[])\n`;
    assert.equal(printTypes(typeTable), text);
    assert.deepEqual(parseTypes(text), { kind: "parsed", value: typeTable });
    assert.deepEqual(verifyTypes({ table: typeTable, bindings: [], evidence: [] }),
      [violation("type-reference", typeSite(0), "reference", value)]);
    const qualified = { terms: [{ kind: "construction-reference", definition: { occurrence: { body, node: value },
      captures: [{ body, local: value }] }, arguments: [] }, { kind: "callable", calls: [value], constructs: [] }],
      signatures: [{ id: value, ...signature() }] };
    assert.deepEqual(parseTypes(printTypes(qualified)), { kind: "parsed", value: qualified });
  }
});

function invalidText(text, offset, expected) {
  const before = text.slice(0, offset).split("\n");
  return { kind: "invalid-text", offset, line: before.length, column: before[before.length - 1].length + 1,
    expected, found: offset === text.length ? null : text.slice(offset, offset + 1) };
}

{
  const cases = [
    { name: "boolean", prefix: "TypeTable(terms=[array(element=t:0, readonly=", suffix: ")], signatures=[])", expected: ["boolean"] },
    { name: "number", prefix: `TypeTable(terms=[open(group=group:${JSON.stringify(encodeGroupId([body]))}, variable=`,
      suffix: ")], signatures=[])", expected: ["number"] },
    { name: "native", prefix: "TypeTable(terms=[primitive(primitive=", suffix: ")], signatures=[])",
      expected: ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
        "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"] },
  ];
  for (const { name, prefix, suffix, expected } of cases) test("bare unknown scalar word retains its complete " + name + " refusal", () => {
    const text = prefix + "unavailable" + suffix;
    assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected));
  });
}

{
  const malformed = [
    ["", 0, ["identifier"]], ["Unknown()", 0, ["TypeTable"]],
    ["TypeTable()", 10, ["terms"]],
    ["TypeTable(terms=[])", 18, ["signatures"]],
    ["TypeTable(signatures=[], terms=[])", 10, ["terms"]],
    ["TypeTable(terms=[], signatures=[], extra=0)", 35, ["end of record"]],
    ["TypeTable(terms=[], terms=[], signatures=[])", 20, ["unique record field"]],
    ["TypeTable(terms=[] signatures=[])", 19, [",", ")"]],
    ["TypeTable(terms=[], signatures=[]", 33, [",", ")"]],
    ["TypeTable(terms=[], signatures=[]) extra", 35, ["end of document"]],
    ["TypeTable(terms=[wrong()], signatures=[])", 17, ["type term"]],
    ["TypeTable(terms=[array(element=sig:0, readonly=false)], signatures=[])", 31, ["t:identity"]],
    ["TypeTable(terms=[array(element=0, readonly=false)], signatures=[])", 31, ["t:identity"]],
    ["TypeTable(terms=[array(element=t, readonly=false)], signatures=[])", 31, ["t:identity"]],
    ["TypeTable(terms=[array(element=t:true, readonly=false)], signatures=[])", 33, ["identity scalar"]],
    ["TypeTable(terms=[array(element=t:1e999, readonly=false)], signatures=[])", 33, ["finite number", "bigint"]],
    ["TypeTable(terms=[array(element=t:00, readonly=false)], signatures=[])", 33, ["finite number", "bigint"]],
    ["TypeTable(terms=[array(element=t:0, readonly=0)], signatures=[])", 45, ["boolean"]],
  ];
  for (const [position, [text, offset, expected]] of malformed.entries())
    test(`typed parser lexical/frame refusal ${position}: ${text}`, () => {
      assert.deepEqual(parseTypes(text), invalidText(text, offset, expected));
    });
  const badString = 'TypeTable(terms=[intrinsic(intrinsic="bad\\q")], signatures=[])';
  const newline = 'TypeTable(\n terms=[],\n signatures=[]\n)\n!';
  const quote = 'TypeTable(terms=[intrinsic(intrinsic="never';
  const prototypeField = 'TypeTable(terms=[], signatures=[], "__proto__"=string())';
  const repeatedPrototype = 'TypeTable("__proto__"=string(), "__proto__"=string(), terms=[], signatures=[])';
  const extra = [
    ["impossible intrinsic prefix before its escape", badString, badString.indexOf('"bad'),
      ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol", "alias-marker"]],
    ["multiline tail", newline, newline.length - 1, ["end of document"]],
    ["unterminated string", quote, quote.length, ['"']],
    ["extra prototype field", prototypeField, prototypeField.indexOf('"__proto__"') + 1, ["end of record"]],
    ["first prototype field", repeatedPrototype, repeatedPrototype.indexOf('"__proto__"') + 1, ["terms"]],
  ];
  for (const [name, text, offset, expected] of extra)
    test(`typed parser independently refuses ${name}`, () => assert.deepEqual(parseTypes(text), invalidText(text, offset, expected)));
}
test("typed parser accepts quoted field names and ordinary whitespace", () => {
  assert.deepEqual(parseTypes(' TypeTable( "terms" = [ ], "signatures" = [] ) \n'),
    { kind: "parsed", value: { terms: [], signatures: [] } });
});

test("string decoding checks each JSON escape directly and retains exact UTF16 units", () => {
  const text = 'TypeTable(terms=[literal(value=string(value="\\\"\\\\\\/\\b\\f\\n\\r\\t\\u0041\\uD83D\\uDE00\\ud800"), base=t:0)], signatures=[])';
  const expected = { terms: [{ kind: "literal", value: { kind: "string", value: '"\\/\b\f\n\r\tA\ud83d\ude00\ud800' }, base: 0 }], signatures: [] };
  assert.deepEqual(parseTypes(text), { kind: "parsed", value: expected });
});
{
  for (const token of ['"\\u12G4"', '"\\u12"', '"\\x20"']) {
    const invalid = `TypeTable(terms=[literal(value=string(value=${token}), base=t:0)], signatures=[])`;
    test(`typed parser independently refuses malformed string escape ${token}`, () =>
      assert.deepEqual(parseTypes(invalid), invalidText(invalid, invalid.indexOf(token), ["JSON string"])));
  }
  const control = 'TypeTable(terms=[literal(value=string(value="a\nb"), base=t:0)], signatures=[])';
  test("typed parser independently refuses an unescaped string control", () =>
    assert.deepEqual(parseTypes(control), invalidText(control, control.indexOf("\n"), ["escaped string character"])));
  const escapedEnd = 'TypeTable(terms=[literal(value=string(value="end\\';
  test("typed parser independently refuses a final escape without its character", () =>
    assert.deepEqual(parseTypes(escapedEnd), invalidText(escapedEnd, escapedEnd.length, ['"'])));
}

{
  const native = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
  const intrinsic = ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol", "alias-marker"];
  const literal = value => `TypeTable(terms=[literal(value=${value}, base=t:0)], signatures=[])`;
  const malformed = [
    ["TypeTable(terms=123, signatures=[])", "123", ["array"]],
    ["TypeTable(terms=[], signatures=123)", "123", ["array"]],
    ['TypeTable(terms=[primitive(primitive="int256")], signatures=[])', '"int256"', native],
    ['TypeTable(terms=[primitive(primitive=false)], signatures=[])', 'false', native],
    ['TypeTable(terms=[intrinsic(intrinsic="nullish")], signatures=[])', '"nullish"', intrinsic],
    ['TypeTable(terms=[array(element=t:0, readonly="maybe")], signatures=[])', '"maybe"', ["boolean"]],
    [literal('number(value=ExactRational(numerator=17, denominator=1n, negativeZero=false))'), "17", ["bigint"]],
    [literal('number(value=ExactRational(numerator=0n, denominator="one", negativeZero=false))'), '"one"', ["bigint"]],
    [literal('bigint(value="large")'), '"large"', ["bigint"]],
    [literal('string(value=17)'), "17", ["string"]],
    ['TypeTable(terms=[fixed-array(element=t:0, extent=FixedExtent(length=0n, runtimeBase="float"))], signatures=[])',
      '"float"', ["number", "bigint"]],
    [`TypeTable(terms=[declared(definition=def:${JSON.stringify(owner)}, arguments=[], facet="other", extent=null)], signatures=[])`,
      '"other"', ["instance", "value"]],
    ['TypeTable(terms=[enum(definition=def:"not-a-definition")], signatures=[])', 'def:"not-a-definition"', ["canonical definition identity"]],
    ['TypeTable(terms=[enum(definition=def:0)], signatures=[])', 'def:0', ["canonical definition identity"]],
    ['TypeTable(terms=[array(element=t:"not-a-number", readonly=false)], signatures=[])', 't:"not-a-number"', ["number"]],
    ['TypeTable(terms=[open(group=group:"not-a-group", variable=0)], signatures=[])', 'group:"not-a-group"', ["canonical inference-group identity"]],
    ['TypeTable(terms=[open(group=group:0, variable=0)], signatures=[])', 'group:0', ["canonical inference-group identity"]],
  ];
  for (const [position, [text, authored, expected]] of malformed.entries())
    test(`typed parser scalar-domain refusal ${position}: ${authored}`, () => {
      const offset = text.indexOf(authored);
      assert.notEqual(offset, -1);
      assert.deepEqual(parseTypes(text), invalidText(text, offset, expected));
    });
}

test("text preserves sharing, genuine recursive arena references and a 100000-edge chain without recursion", () => {
  const cycle = { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [] };
  assert.deepEqual(parseTypes(printTypes(cycle)), { kind: "parsed", value: cycle });
  assert.deepEqual(verifyTypes(verification(cycle.terms)), []);
  const table = { terms: [primitive], signatures: [] };
  for (let position = 0; position < 100000; position += 1)
    table.terms.push({ kind: "array", element: position, readonly: position % 2 === 0 });
  assert.equal(compareCaseValues(parseTypes(printTypes(table)), { kind: "parsed", value: table }), true, "complete 100000-edge value");
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const seeded = admitFixtureTable(product, table);
  assert.equal(compareCaseValues(table.terms.map((_, position) => readType(seeded, position)), table.terms), true,
    "all seeded 100000-edge rows retain their exact issued references");
  assert.equal(insertFixtureType(product, seeded, { kind: "array", element: 99999, readonly: false }), 100000);
  assert.equal(insertFixtureType(product, seeded, { kind: "string" }), 100001);
});

test("inline cycles name their actual path and shared value subtrees remain independent occurrences", () => {
  const alternatives = [];
  const category = { kind: "choice", alternatives };
  alternatives.push(category);
  assert.throws(() => verifyTypes(verification([primitive], { evidence: [evidence({ category })] })),
    { name: "TypeError", message: "Inline cycle at $.evidence[0].category.alternatives[0]" });
  assert.throws(() => verifyTypes(verification([primitive], { evidence: [evidence({ numeric: {
    producer: { body, node: 0 }, kind: "operation", category, authored: null } })] })),
    { name: "TypeError", message: "Inline cycle at $.evidence[0].numeric.category.alternatives[0]" });
  const component = { root: source, path: [] };
  const family = { origin: "authored", component, parameters: [], roles: [] };
  component.path.push({ kind: "sum-arm", family, index: 0 });
  const cyclic = { terms: [{ kind: "projection", source: 0, projection: { kind: "component", component } }], signatures: [] };
  assert.throws(() => printTypes(cyclic), { name: "TypeError",
    message: "Inline cycle at $.terms[0].projection.component.path[0].family.component" });
  assert.deepEqual(product.admitTypeTable(cyclic, fixtureTypeAdmission()), { kind: "invalid", violations: [{
    rule: "type-reference", site: { kind: "type", type: 0 },
    detail: [{ kind: "text", value: "$.projection.component.path[0].family.component" }],
  }] });
  assert.throws(() => verifyTypes({ table: cyclic, bindings: [], evidence: [] }), { name: "TypeError",
    message: "Inline cycle at $.table.terms[0].projection.component.path[0].family.component" });
  const sharedCategory = { kind: "known", category: "number" };
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ category: {
    kind: "choice", alternatives: [sharedCategory, sharedCategory] } })] })), []);
  const shared = { kind: "sum-arm", family: { origin: "authored", component: { root: source, path: [] }, parameters: [], roles: [] }, index: 0 };
  const table = { terms: [{ kind: "projection", source: 0, projection: { kind: "component",
    component: { root: source, path: [shared, shared] } } }], signatures: [] };
  const rootText = `body(value=NodeRef(body=body:${JSON.stringify(body)}, node=n:0))`;
  const selectorText = `sum-arm(family=SumFamily(origin="authored", component=TypeComponent(root=${rootText}, path=[]), parameters=[], roles=[]), index=0)`;
  const text = `TypeTable(terms=[projection(source=t:0, projection=component(component=TypeComponent(root=${rootText}, path=[${selectorText}, ${selectorText}])))], signatures=[])\n`;
  assert.equal(printTypes(table), text);
  assert.deepEqual(parseTypes(text), { kind: "parsed", value: table });
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const sparseCategory = { kind: "choice", alternatives: [sharedCategory, , sharedCategory, ,] };
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ category: sparseCategory })] })), [
    violation("evidence-type", { kind: "evidence", position: 0, source }, "category.alternatives", 1),
    violation("evidence-type", { kind: "evidence", position: 0, source }, "category.alternatives", 3),
  ]);
});

test("inline component and category chains remain iterative at 100000 finite records", () => {
  let category = { kind: "dynamic" };
  let component = { root: source, path: [] };
  for (let position = 0; position < 100000; position += 1) {
    category = { kind: "choice", alternatives: [category] };
    component = { root: source, path: [{ kind: "sum-arm", family: {
      origin: "inferred", component, parameters: [], roles: [] }, index: 0 }] };
  }
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ category })] })), []);
  const table = { terms: [{ kind: "projection", source: 0, projection: { kind: "component", component } }], signatures: [] };
  const parsed = parseTypes(printTypes(table));
  assert.equal(compareCaseValues(parsed, { kind: "parsed", value: table }), true, "complete finite inline chain");
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const seeded = admitFixtureTable(product, table);
  assert.equal(compareCaseValues(readType(seeded, 0), table.terms[0]), true, "the complete seeded finite inline chain");
  assert.equal(insertFixtureType(product, seeded, table.terms[0]), 0);
});

test("substitution uses the complete four-family environment and reuses independently interned complete results", () => {
  const interner = createTypeInterner();
  const classParameter = parameterDeclaration(owner, 0);
  const methodParameter = parameterDeclaration(method, 0);
  const capturedParameter = parameterDeclaration(captured, 0);
  const parameters = [classParameter, methodParameter, capturedParameter].map(parameter => insertFixtureType(product, interner, { kind: "param", parameter }));
  const self = insertFixtureType(product, interner, { kind: "self", owner });
  const integer = insertFixtureType(product, interner, primitive);
  const string = insertFixtureType(product, interner, { kind: "string" });
  const extent = { length: 9007199254740993n, runtimeBase: "bigint" };
  const fixed = insertFixtureType(product, interner, { kind: "fixed-array", element: parameters[0], extent });
  const tuple = types => ({ kind: "tuple", elements: types.map(type => ({ kind: "required", type, declaration: null })), readonly: true });
  const input = insertFixtureType(product, interner, tuple([fixed, parameters[1], parameters[2], self, fixed]));
  const outputFixed = insertFixtureType(product, interner, { kind: "fixed-array", element: integer, extent });
  const expectedTerm = tuple([outputFixed, string, integer, string, outputFixed]);
  const expected = insertFixtureType(product, interner, expectedTerm);
  const bindings = { classBindings: [{ kind: "bound", parameter: classParameter, type: integer }],
    methodBindings: [{ kind: "bound", parameter: methodParameter, type: string }],
    capturedBindings: [{ kind: "bound", parameter: capturedParameter, type: integer }],
    selfBindings: [{ kind: "bound", owner, type: string }] };
  assert.deepEqual(substitute(interner, [input], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [expected] });
  assert.deepEqual(substitute(interner, [input], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [expected] });
  assert.deepEqual(readType(interner, expected), expectedTerm);
  assert.deepEqual(readType(interner, input), tuple([fixed, parameters[1], parameters[2], self, fixed]));
  const rigid = { classBindings: [{ kind: "rigid", parameter: classParameter }],
    methodBindings: [{ kind: "rigid", parameter: methodParameter }], capturedBindings: [{ kind: "rigid", parameter: capturedParameter }],
    selfBindings: [{ kind: "rigid", owner }] };
  assert.deepEqual(substitute(interner, [input], rigid, limits(), fixtureTypeWork(product)), { kind: "complete", value: [input] });
  assert.deepEqual(substitute(interner, [input], emptyBindings(), limits(), fixtureTypeWork(product)), { kind: "complete", value: [input] });
  const unrelated = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: parameterDeclaration(other, 0), type: string }],
    selfBindings: [{ kind: "bound", owner: other, type: integer }] };
  assert.deepEqual(substitute(interner, [input], unrelated, limits(), fixtureTypeWork(product)), { kind: "complete", value: [input] });
});

test("signature binders shadow the exact method identity while outer binders and all signature fields substitute", () => {
  const interner = createTypeInterner();
  const outer = parameterDeclaration(owner, 0);
  const inner = parameterDeclaration(method, 0);
  const outerType = insertFixtureType(product, interner, { kind: "param", parameter: outer });
  const innerType = insertFixtureType(product, interner, { kind: "param", parameter: inner });
  const string = insertFixtureType(product, interner, { kind: "string" });
  const input = signature({ declaration: method, owner: source, typeParameters: [
    { declaration: inner, constraint: outerType, default: outerType }], receiver: outerType,
    parameters: [{ declaration: owner, kind: "default", type: outerType, passing: "borrow-mut", initializer: body, acceptsOmission: true }], result: innerType });
  const selected = insertFixtureSignature(product, interner, input);
  const callable = insertFixtureType(product, interner, { kind: "callable", calls: [selected], constructs: [] });
  const expectedInput = { ...input, typeParameters: [{ ...input.typeParameters[0], constraint: string, default: string }], receiver: string,
    parameters: [{ ...input.parameters[0], type: string }] };
  const expectedSignature = insertFixtureSignature(product, interner, expectedInput);
  const expected = insertFixtureType(product, interner, { kind: "callable", calls: [expectedSignature], constructs: [] });
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: outer, type: string }],
    methodBindings: [{ kind: "bound", parameter: inner, type: string }] };
  assert.deepEqual(substitute(interner, [callable], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [expected] });
  assert.deepEqual(readSignature(interner, expectedSignature), { id: expectedSignature, ...expectedInput });
  assert.deepEqual(readType(interner, innerType), { kind: "param", parameter: inner });
});

test("substitution composes exact class, captured and lexical self environments without changing issued inputs", () => {
  const interner = createTypeInterner();
  const first = parameterDeclaration(owner, 0);
  const second = parameterDeclaration(owner, 1);
  const closure = parameterDeclaration(captured, 0);
  const tuple = types => ({ kind: "tuple", elements: types.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  const rows = [{ kind: "param", parameter: first }, { kind: "param", parameter: second },
    { kind: "param", parameter: closure }, { kind: "self", owner }, primitive, { kind: "string" },
    { kind: "optional", value: 2 }, { kind: "optional", value: 4 }, tuple([0, 1, 3]), tuple([2, 1, 6]), tuple([4, 5, 7])];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const outer = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: first, type: 2 },
    { kind: "rigid", parameter: second }], selfBindings: [{ kind: "bound", owner, type: 6 }] };
  const inner = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: second, type: 5 }],
    capturedBindings: [{ kind: "bound", parameter: closure, type: 4 }] };
  const composed = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: first, type: 4 },
    { kind: "bound", parameter: second, type: 5 }], capturedBindings: [{ kind: "bound", parameter: closure, type: 4 }],
    selfBindings: [{ kind: "bound", owner, type: 7 }] };
  assert.deepEqual(substitute(interner, [8], outer, limits(), fixtureTypeWork(product)), { kind: "complete", value: [9] });
  assert.deepEqual(substitute(interner, [9], inner, limits(), fixtureTypeWork(product)), { kind: "complete", value: [10] });
  assert.deepEqual(substitute(interner, [8], composed, limits(), fixtureTypeWork(product)), { kind: "complete", value: [10] });
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
});

test("substitution distinguishes every complete term constructor and nested typed reference role", () => {
  const interner = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  assert.equal(insertFixtureType(product, interner, { kind: "param", parameter }), 0);
  assert.equal(insertFixtureType(product, interner, { kind: "string" }), 1);
  assert.equal(insertFixtureType(product, interner, primitive), 2);
  const originalSignature = insertFixtureSignature(product, interner, signature({ result: 0 }));
  const expectedSignature = insertFixtureSignature(product, interner, signature({ result: 1 }));
  const origin = { kind: "declared", declaration: owner };
  const construction = { occurrence: source.value, captures: [{ body, local: 0 }] };
  const shape = type => ({ kind: "shape", members: [{ key: { kind: "text", value: "value" }, origins: [origin],
    readOrigins: [origin], writeOrigins: [origin], kind: "property", read: type, write: type, optional: true, readonly: false }],
    indexes: [{ origin: { kind: "item", value: { owner: owner, node: 0 } }, key: type, read: type, write: type, readonly: false }],
    calls: [type === 0 ? originalSignature : expectedSignature], constructs: [] });
  const rows = [
    [primitive, primitive], [{ kind: "string" }, { kind: "string" }],
    [{ kind: "intrinsic", intrinsic: "unknown" }, { kind: "intrinsic", intrinsic: "unknown" }],
    [{ kind: "literal", base: 0, value: { kind: "string", value: "exact" } },
      { kind: "literal", base: 1, value: { kind: "string", value: "exact" } }],
    [{ kind: "union", members: [0, 2] }, { kind: "union", members: [1, 2] }],
    [{ kind: "intersection", members: [0, 2] }, { kind: "intersection", members: [1, 2] }],
    [{ kind: "optional", value: 0 }, { kind: "optional", value: 1 }],
    [{ kind: "array", element: 0, readonly: true }, { kind: "array", element: 1, readonly: true }],
    [{ kind: "tuple", elements: [{ kind: "required", type: 0, declaration: owner }], readonly: false },
      { kind: "tuple", elements: [{ kind: "required", type: 1, declaration: owner }], readonly: false }],
    [{ kind: "fixed-array", element: 0, extent: { length: 3n, runtimeBase: "number" } },
      { kind: "fixed-array", element: 1, extent: { length: 3n, runtimeBase: "number" } }],
    [shape(0), shape(1)],
    [{ kind: "callable", calls: [originalSignature], constructs: [] }, { kind: "callable", calls: [expectedSignature], constructs: [] }],
    [{ kind: "declared", definition: owner, arguments: [0, 2], facet: "instance", extent: null },
      { kind: "declared", definition: owner, arguments: [1, 2], facet: "instance", extent: null }],
    [{ kind: "construction-reference", definition: construction, arguments: [0] },
      { kind: "construction-reference", definition: construction, arguments: [1] }],
    [{ kind: "enum", definition: definition("Enum") }, { kind: "enum", definition: definition("Enum") }],
    [{ kind: "param", parameter }, { kind: "string" }], [{ kind: "self", owner }, { kind: "string" }],
    [{ kind: "projection", source: 0, projection: { kind: "awaited" } }, { kind: "projection", source: 1, projection: { kind: "awaited" } }],
    [{ kind: "open", group: encodeGroupId([body]), variable: 3 }, { kind: "open", group: encodeGroupId([body]), variable: 3 }],
    [{ kind: "error" }, { kind: "error" }],
  ];
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }], selfBindings: [{ kind: "bound", owner, type: 1 }] };
  for (const [input, expected] of rows) {
    const original = insertFixtureType(product, interner, input);
    const result = insertFixtureType(product, interner, expected);
    assert.deepEqual(substitute(interner, [original], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [result] });
    assert.deepEqual(readType(interner, result), expected);
  }
  const projection = (type, signature) => ({ kind: "projection", source: type, projection: { kind: "component", component: {
    root: source, path: [{ kind: "sum-arm", index: 0, family: { origin: "authored", component: { root: itemSource,
      path: [{ kind: "result", signature }] }, parameters: [parameter], roles: [{ authoredIndex: 0, component: source, member: type }] } }],
  } } });
  const inputProjection = insertFixtureType(product, interner, projection(0, originalSignature));
  const expectedProjection = insertFixtureType(product, interner, projection(1, expectedSignature));
  assert.deepEqual(substitute(interner, [inputProjection], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [expectedProjection] });
  assert.deepEqual(readType(interner, expectedProjection), projection(1, expectedSignature));
});

test("signature composition has one canonical set while preserving the complete owner and binder records", () => {
  const interner = createTypeInterner();
  insertFixtureType(product, interner, primitive);
  const first = insertFixtureSignature(product, interner, signature({ declaration: owner }));
  const second = insertFixtureSignature(product, interner, signature({ declaration: method }));
  const input = signature({ composition: { kind: "union", signatures: [second, first, second] } });
  const selected = insertFixtureSignature(product, interner, input);
  assert.deepEqual(readSignature(interner, selected), { id: selected, ...signature({ composition: { kind: "union", signatures: [first, second] } }) });
  assert.equal(insertFixtureSignature(product, interner, signature({ composition: { kind: "union", signatures: [first, second] } })), selected);
  assert.deepEqual(input.composition.signatures, [second, first, second]);
});

test("substitution publishes new recursive rows once and leaves unchanged cycles and issued records intact", () => {
  const interner = createTypeInterner();
  const origin = { kind: "declared", declaration: owner };
  const member = (value, type) => ({ key: { kind: "text", value }, origins: [origin], readOrigins: [origin], writeOrigins: [],
    kind: "property", read: type, write: null, optional: false, readonly: true });
  const shape = (next, value) => ({ kind: "shape", members: [member("next", next), member("value", value)], indexes: [], calls: [], constructs: [] });
  const parameter = parameterDeclaration(owner, 0);
  const [input] = insertFixtureGraph(product, interner, [shape(0, 1), { kind: "param", parameter }]).types;
  const integer = insertFixtureType(product, interner, primitive);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: integer }] };
  assert.deepEqual(substitute(interner, [input], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.deepEqual(readType(interner, 3), shape(3, integer));
  assert.deepEqual(readType(interner, input), shape(0, 1));
  assert.deepEqual(substitute(interner, [input], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  const cycle = createTypeInterner();
  const root = insertFixtureType(product, cycle, { kind: "array", element: 0, readonly: false });
  assert.deepEqual(substitute(cycle, [root], emptyBindings(), limits({ maximumDepth: 0, maximumVisits: 2 }), fixtureTypeWork(product)),
    { kind: "complete", value: [root] });
});

test("each substitution limit accepts its boundary and refuses one-past with the full outcome before publication", () => {
  const interner = createTypeInterner();
  const integer = insertFixtureType(product, interner, primitive);
  const string = insertFixtureType(product, interner, { kind: "string" });
  const array = insertFixtureType(product, interner, { kind: "array", element: integer, readonly: true });
  const union = insertFixtureType(product, interner, { kind: "union", members: [integer, string] });
  const intersection = insertFixtureType(product, interner, { kind: "intersection", members: [integer, string] });
  const boundaries = [
    [integer, { maximumDepth: 0 }, { kind: "complete", value: integer }],
    [integer, { maximumDepth: -0 }, { kind: "complete", value: integer }],
    [integer, { maximumVisits: 2 }, { kind: "complete", value: integer }],
    [integer, { maximumVisits: 1 }, { kind: "resource-limit", dimension: "visits", maximum: 1 }],
    [integer, { maximumVisits: 0 }, { kind: "resource-limit", dimension: "visits", maximum: 0 }],
    [integer, { maximumVisits: -0 }, { kind: "resource-limit", dimension: "visits", maximum: -0 }],
    [array, { maximumDepth: 1 }, { kind: "complete", value: array }],
    [array, { maximumDepth: 0 }, { kind: "resource-limit", dimension: "depth", maximum: 0 }],
    [array, { maximumVisits: 3 }, { kind: "complete", value: array }],
    [array, { maximumVisits: 2 }, { kind: "resource-limit", dimension: "visits", maximum: 2 }],
    [array, { maximumVisits: 1 }, { kind: "resource-limit", dimension: "visits", maximum: 1 }],
    [union, { maximumUnionMembers: 2 }, { kind: "complete", value: union }],
    [union, { maximumUnionMembers: 1 }, { kind: "resource-limit", dimension: "union-members", maximum: 1 }],
    [intersection, { maximumIntersectionMembers: 2 }, { kind: "complete", value: intersection }],
    [intersection, { maximumIntersectionMembers: 1 }, { kind: "resource-limit", dimension: "intersection-members", maximum: 1 }],
  ];
  for (const [input, maximum, expected] of boundaries) {
    const before = completePublication(exportTypes(interner, publicationLimits));
    assert.deepEqual(substitute(interner, [input], emptyBindings(), limits(maximum), fixtureTypeWork(product)), (expected.kind === "complete" ? { kind: "complete", value: [expected.value] } : expected));
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), before);
  }
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"])
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
      assert.throws(() => substitute(interner, [array], emptyBindings(), limits({ [field]: value }), fixtureTypeWork(product)),
        { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
  const parameter = parameterDeclaration(owner, 0);
  assert.throws(() => substitute(interner, [array], { ...emptyBindings(), classBindings: [
    { kind: "rigid", parameter }, { kind: "bound", parameter, type: integer }], }, limits(), fixtureTypeWork(product)), /each owner-qualified parameter once/u);
  assert.throws(() => substitute(interner, [array], { ...emptyBindings(), selfBindings: [
    { kind: "rigid", owner }, { kind: "bound", owner, type: integer }], }, limits(), fixtureTypeWork(product)), /each lexical self owner once/u);
});

test("union and intersection expansion limits are checked on new flattened members before any row publishes", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    const parameter = parameterDeclaration(owner, 0);
    const free = insertFixtureType(product, interner, { kind: "param", parameter });
    const string = insertFixtureType(product, interner, { kind: "string" });
    const integer = insertFixtureType(product, interner, primitive);
    const boolean = insertFixtureType(product, interner, { kind: "primitive", primitive: "bool" });
    const replacement = insertFixtureType(product, interner, { kind, members: [integer, boolean] });
    const input = insertFixtureType(product, interner, { kind, members: [free, string] });
    const expected = insertFixtureType(product, interner, { kind, members: [boolean, integer, string] });
    const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: replacement }] };
    const dimension = kind === "union" ? "union-members" : "intersection-members";
    const maximum = kind === "union" ? "maximumUnionMembers" : "maximumIntersectionMembers";
    const before = completePublication(exportTypes(interner, publicationLimits));
    assert.deepEqual(substitute(interner, [input], bindings, limits({ [maximum]: 2 }), fixtureTypeWork(product)),
      { kind: "resource-limit", dimension, maximum: 2 });
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), before);
    assert.deepEqual(substitute(interner, [input], bindings, limits({ [maximum]: 3 }), fixtureTypeWork(product)), { kind: "complete", value: [expected] });
    assert.deepEqual(readType(interner, expected), { kind, members: [string, integer, boolean] });
    assert.deepEqual(readType(interner, input), { kind, members: [free, string] });
  }
});

test("changed staged chains repair parents by events with exact total-visit boundaries and no intermediate publication", () => {
  const count = 10000;
  const interner = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  let original = insertFixtureType(product, interner, { kind: "param", parameter });
  for (let index = 1; index <= count; index += 1) {
    original = insertFixtureType(product, interner, { kind: "array", element: original, readonly: false });
    assert.equal(original, index);
  }
  const integer = insertFixtureType(product, interner, primitive);
  assert.equal(integer, count + 1);
  let expected = integer;
  for (let index = 1; index <= count; index += 1) {
    expected = insertFixtureType(product, interner, { kind: "array", element: expected, readonly: false });
    assert.equal(expected, count + 1 + index);
  }
  const issued = Array.from({ length: 2 * count + 2 }, (_, type) => readType(interner, type));
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: integer }] };
  assert.deepEqual(substitute(interner, [original], bindings, limits({ maximumDepth: count + 1, maximumVisits: 3 * count + 2 }), fixtureTypeWork(product)),
    { kind: "resource-limit", dimension: "visits", maximum: 3 * count + 2 });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "refusal preserves every original complete row");
  assert.deepEqual(substitute(interner, [original], bindings, limits({ maximumDepth: count + 1, maximumVisits: 3 * count + 3 }), fixtureTypeWork(product)),
    { kind: "complete", value: [expected] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "repair reuses every independently interned expected row");
  assert.throws(() => readType(interner, 2 * count + 2), /outside this arena/u);
});

test("numeric session compound order survives later staged definitions and compaction under both source orders", () => {
  for (const kind of ["union", "intersection"]) {
    const publications = [];
    const meanings = [];
    for (const order of [["array", "fixed"], ["fixed", "array"]]) {
      const interner = createTypeInterner();
      const parameter = { kind: "param", parameter: parameterDeclaration(owner, 0) };
      const free = insertFixtureType(product, interner, parameter);
      const integer = insertFixtureType(product, interner, primitive);
      const fixed = element => ({ kind: "fixed-array", element, extent: { length: 3n, runtimeBase: "number" } });
      const array = element => ({ kind: "array", element, readonly: false });
      const arrayFirst = order[0] === "array";
      const initial = [parameter, primitive, ...order.map(name => name === "array" ? array(free) : fixed(free)),
        { kind, members: [2, 3] }, array(integer)];
      assert.deepEqual(order.map(name => insertFixtureType(product, interner, name === "array" ? array(free) : fixed(free))), [2, 3]);
      const original = insertFixtureType(product, interner, { kind, members: [3, 2] });
      assert.equal(original, 4);
      assert.equal(insertFixtureType(product, interner, array(integer)), 5);
      const issued = Array.from({ length: 6 }, (_, type) => readType(interner, type));
      assert.deepEqual(issued, initial);
      const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: parameter.parameter, type: integer }] };
      const resultId = arrayFirst ? 6 : 7;
      const fixedId = arrayFirst ? 7 : 6;
      const final = [...initial, ...(arrayFirst ? [{ kind, members: [5, 7] }, fixed(integer)]
        : [fixed(integer), { kind, members: [5, 6] }])];
      assert.deepEqual(substitute(interner, [original], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [resultId] });
      assert.deepEqual(Array.from({ length: 8 }, (_, type) => readType(interner, type)), final);
      assert.deepEqual(final.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3, 4, 5, 6, 7]);
      assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "issued rows never change");
      const table = kind === "union" ? { terms: [array(4), array(5), fixed(4), fixed(5), parameter, primitive,
        { kind, members: [1, 3] }, { kind, members: [0, 2] }], signatures: [] }
        : { terms: [array(6), array(7), fixed(6), fixed(7), { kind, members: [1, 3] },
          { kind, members: [0, 2] }, parameter, primitive], signatures: [] };
      const types = kind === "union"
        ? (arrayFirst ? [4, 5, 0, 2, 7, 1, 6, 3] : [4, 5, 2, 0, 7, 1, 3, 6])
        : (arrayFirst ? [6, 7, 0, 2, 5, 1, 4, 3] : [6, 7, 2, 0, 5, 1, 3, 4]);
      const published = completePublication(exportTypes(interner, publicationLimits));
      assert.deepEqual(published, { table, types, signatures: [] });
      publications.push(published.table);
      meanings.push([0, 1, arrayFirst ? 2 : 3, arrayFirst ? 3 : 2, 4, 5, resultId, fixedId]
        .map(type => published.types[type]));
    }
    assert.deepEqual(publications[0], publications[1]);
    assert.deepEqual(meanings[0], meanings[1]);
  }
});

test("long qualified binder chains use persistent blocked scopes rather than copying every growing prefix", () => {
  const count = 10000;
  const interner = createTypeInterner();
  const parameters = Array.from({ length: count }, (_, index) => (parameterDeclaration(owner, index)));
  assert.deepEqual(parameters.map(parameter => insertFixtureType(product, interner, { kind: "param", parameter })),
    Array.from({ length: count }, (_, index) => index));
  const expected = insertFixtureType(product, interner, primitive);
  assert.equal(expected, count);
  const bindings = { ...emptyBindings(), classBindings: parameters.map((parameter, index) => ({
    kind: "bound", parameter, type: index + 1 })) };
  const issued = Array.from({ length: count + 1 }, (_, type) => readType(interner, type));
  assert.deepEqual(substitute(interner, [0], bindings, limits({ maximumDepth: count, maximumVisits: 2 * count + 1 }), fixtureTypeWork(product)),
    { kind: "resource-limit", dimension: "visits", maximum: 2 * count + 1 });
  assert.deepEqual(substitute(interner, [0], bindings, limits({ maximumDepth: count, maximumVisits: 2 * count + 2 }), fixtureTypeWork(product)),
    { kind: "complete", value: [expected] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "all qualified input identities and rows remain unchanged");
  assert.throws(() => readType(interner, count + 1), /outside this arena/u);
});

test("a recursive bound replacement becomes rigid at its own exact owner without an invented parameter", () => {
  const interner = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  const free = insertFixtureType(product, interner, { kind: "param", parameter });
  const replacement = insertFixtureType(product, interner, { kind: "array", element: free, readonly: false });
  assert.deepEqual(substitute(interner, [free], { ...emptyBindings(), classBindings: [
    { kind: "bound", parameter, type: replacement }], }, limits(), fixtureTypeWork(product)), { kind: "complete", value: [replacement] });
  assert.deepEqual(readType(interner, replacement), { kind: "array", element: free, readonly: false });
  assert.deepEqual(readType(interner, free), { kind: "param", parameter });
});

test("verifier distinguishes genuine nominal kind, facet and absence data rather than lexical identities", () => {
  const declared = (definition, facet) => ({ kind: "declared", definition, arguments: [], facet, extent: null });
  for (const term of [declared(owner, "instance"), declared(owner, "value"), declared(other, "instance"),
    { kind: "enum", definition: definition("Enum") }]) assert.deepEqual(verifyTypes(verification([term])), []);
  for (const term of [declared(other, "value"), declared(method, "instance"), { kind: "enum", definition: owner },
    declared(definition("Enum"), "instance")]) assert.deepEqual(verifyTypes(verification([term])),
    [violation("nominal-definition", typeSite(0), "definition")]);
});

test("qualified occurrence, capture, projection, origin and signature sites use the actual bound inventories", () => {
  const term = captures => ({ kind: "construction-reference", definition: { occurrence: { body, node: 0 }, captures }, arguments: [] });
  assert.deepEqual(verifyTypes(verification([term([])])), []);
  assert.deepEqual(verifyTypes(verification([term([{ body, local: 0 }, { body, local: 1 }])])), []);
  assert.deepEqual(verifyTypes(verification([term([{ body: otherBody, local: 0 }])])),
    [violation("construction-captures-qualified", typeSite(0), "definition.captures", 0)]);
  assert.deepEqual(verifyTypes(verification([{ ...term([]), definition: { occurrence: { body, node: 2 }, captures: [] } }])),
    [violation("construction-captures-qualified", typeSite(0), "definition.occurrence")]);
  const item = { kind: "item", value: { owner: other, node: 1 } };
  const table = { terms: [primitive], signatures: [{ id: 0, ...signature({ owner: item }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }),
    [violation("cross-owner-qualified", signatureSite(0), "owner")]);
  const family = { origin: "authored", component: { root: source, path: [] }, parameters: [parameterDeclaration(owner, 0)],
    roles: [{ authoredIndex: 1, component: source, member: 0 }] };
  const projection = { kind: "projection", source: 0, projection: { kind: "component", component: { root: source,
    path: [{ kind: "sum-arm", family, index: 0 }] } } };
  assert.deepEqual(verifyTypes(verification([projection])),
    [violation("sum-arm-order", typeSite(0), "family.roles.authoredIndex", 1)]);
});

test("Types verification rejects an unregistered term without serializing its table", () => {
  assert.deepEqual(verifyTypes(verification([primitive])), []);
  assert.throws(() => verifyTypes(verification([primitive, { kind: "unregistered-type-kind" }])),
    /Types verification requires an actual canonical type term/u);
});

test("typed sparse nested vectors report their genuine enclosing owner and actual missing position", () => {
  const hole = () => new Array(1);
  assert.deepEqual(verifyTypes(verification([primitive], { bindings: hole() })),
    [violation("binding-vector-complete", { kind: "binding", vector: 0, family: null, position: null }, "bindings", 0)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: hole() })),
    [violation("evidence-type", { kind: "evidence", position: 0, source: null }, "evidence", 0)]);
  for (const [family, scopeField] of [["classBindings", "classParameters"], ["methodBindings", "methodParameters"],
    ["capturedBindings", "capturedParameters"]]) {
    const scope = { ...emptyScope(), [scopeField]: [parameterDeclaration(owner, 0)] };
    const input = verification([primitive], { bindings: [{ vector: { ...emptyBindings(), [family]: hole() }, scope }] });
    assert.deepEqual(verifyTypes(input), [violation("binding-vector-complete",
      { kind: "binding", vector: 0, family, position: 0 }, "entry")]);
    assert.deepEqual(verifyTypes(verification([primitive], { bindings: [{ vector: emptyBindings(), scope }] })),
      [violation("binding-vector-complete", { kind: "binding", vector: 0, family, position: null }, "length", 0)]);
  }
  assert.deepEqual(verifyTypes(verification([primitive], { bindings: [{
    vector: { ...emptyBindings(), selfBindings: hole() }, scope: { ...emptyScope(), selfOwners: [owner] },
  }] })), [violation("binding-vector-complete", { kind: "binding", vector: 0, family: "selfBindings", position: 0 }, "entry")]);
  const cases = [
    [hole(), [], "type-reference", typeSite(0), "terms", 0],
    [[{ kind: "tuple", elements: hole(), readonly: false }], [], "tuple-rest-order", typeSite(0), "elements", 0],
    [[{ kind: "construction-reference", definition: { occurrence: source.value, captures: hole() }, arguments: [] }], [],
      "construction-captures-qualified", typeSite(0), "definition.captures", 0],
    [[primitive], [{ id: 0, ...signature({ parameters: hole() }) }], "parameter-order", signatureSite(0), "parameters", 0],
    [[primitive], [{ id: 0, ...signature({ typeParameters: hole() }) }], "parameter-identity", signatureSite(0), "typeParameters", 0],
  ];
  for (const [terms, signatures, rule, site, field, position] of cases)
    assert.deepEqual(verifyTypes({ table: { terms, signatures }, bindings: [], evidence: [] }), [violation(rule, site, field, position)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ pointer: {
    kind: "function-pointer", declaration: owner, parameters: hole(), result: 0, abi: [],
  } })] })), [violation("type-reference", { kind: "evidence", position: 0, source }, "pointer.parameters", 0)]);
});

test("evidence nominal correlation and signed-zero signature ordering reject complete minimal opposites", () => {
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ nominal: owner })] })),
    [violation("evidence-type", { kind: "evidence", position: 0, source }, "nominal")]);
  assert.deepEqual(verifyTypes(verification([primitive], { table: { terms: [primitive, { kind: "callable", calls: [-0], constructs: [] }],
    signatures: [{ id: 0, ...signature() }] } })),
    [violation("signature-reference", typeSite(1), "reference", -0), violation("signature-order", typeSite(1), "calls")]);
});

test("rational normalization distinguishes every exact sign, zero, denominator and gcd condition", () => {
  for (const value of [rational(0n), rational(0n, 1n, true), rational(-1n, 2n), rational(1n, 2n), rational(9007199254740993n)])
    assert.deepEqual(verifyTypes(verification([primitive, { kind: "literal", base: 0, value: { kind: "number", value } }])), []);
  for (const value of [rational(0n, 2n), rational(1n, 0n), rational(1n, -1n), rational(2n, 4n), rational(1n, 1n, true)])
    assert.deepEqual(verifyTypes(verification([primitive, { kind: "literal", base: 0, value: { kind: "number", value } }])),
      [violation("rational-normalized", typeSite(1), "value")]);
});

test("complete origin inventories preserve independent read and write subsets and reject every missing association", () => {
  const read = { kind: "declared", declaration: owner };
  const write = { kind: "declared", declaration: method };
  const member = { key: { kind: "text", value: "item" }, origins: [read, write], readOrigins: [read], writeOrigins: [write],
    kind: "accessor", read: 0, write: 0, optional: false, readonly: false };
  const table = selected => [primitive, { kind: "shape", members: [selected], indexes: [], calls: [], constructs: [] }];
  assert.deepEqual(verifyTypes(verification(table(member))), []);
  for (const selected of [{ ...member, origins: [] }, { ...member, origins: [read, read] },
    { ...member, readOrigins: [read, read] }, { ...member, writeOrigins: [write, write] },
    { ...member, origins: [read] }, { ...member, origins: [write] }])
    assert.deepEqual(verifyTypes(verification(table(selected))), [violation("member-origins", typeSite(1), "members.origins", 0)]);
});

test("evidence retains all closed categories, producer and pointer arms with complete independent outcomes", () => {
  const categories = ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"];
  for (const category of categories) assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({
    category: { kind: "known", category }, numeric: { producer: source.value, kind: "declared", category: { kind: "known", category }, authored: null },
  })] })), []);
  for (const category of [{ kind: "parameter", declaration: method }, { kind: "dynamic" }, { kind: "choice", alternatives: [] },
    { kind: "choice", alternatives: [{ kind: "dynamic" }, { kind: "known", category: "number" }] }])
    assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ category })] })), []);
  for (const kind of ["literal", "declared", "operation", "application"]) assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({
    numeric: { producer: source.value, kind, category: { kind: "known", category: "number" },
      authored: { kind: "number", token: "1.0", value: rational(1n) } },
  })] })), []);
  for (const pointer of [{ kind: "raw-address" }, { kind: "typed-location", pointee: 0, mutability: "readonly" },
    { kind: "typed-location", pointee: 0, mutability: "readwrite" }, { kind: "typed-location", pointee: 0, mutability: "unspecified" },
    { kind: "native-pointer", declaration: owner }, { kind: "function-pointer", declaration: method, parameters: [], result: 0, abi: [] },
    { kind: "function-pointer", declaration: method, parameters: [0, 0], result: 0, abi: ["native", "cdecl"] }])
    assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ pointer })] })), []);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ pointer: { kind: "typed-location", pointee: 2, mutability: "readonly" } })] })),
    [violation("type-reference", { kind: "evidence", position: 0, source }, "pointer.pointee", 2)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ numeric: {
    producer: source.value, kind: "literal", category: { kind: "known", category: "bigint" },
    authored: { kind: "bigint", token: "1n", value: 1n },
  } })] })), [violation("evidence-type", { kind: "evidence", position: 0, source }, "numeric.category")]);
});

test("ordered binding inventories cover several entries in every family and preserve both vector positions", () => {
  const scope = { classParameters: [parameterDeclaration(owner, 0), parameterDeclaration(owner, 1)],
    methodParameters: [parameterDeclaration(method, 0), parameterDeclaration(method, 1)],
    capturedParameters: [parameterDeclaration(captured, 0), parameterDeclaration(captured, 1)], selfOwners: [owner, other] };
  const vector = { classBindings: [{ kind: "bound", parameter: scope.classParameters[0], type: 0 },
    { kind: "rigid", parameter: scope.classParameters[1] }],
    methodBindings: [{ kind: "rigid", parameter: scope.methodParameters[0] },
      { kind: "bound", parameter: scope.methodParameters[1], type: 1 }],
    capturedBindings: [{ kind: "bound", parameter: scope.capturedParameters[0], type: 1 },
      { kind: "rigid", parameter: scope.capturedParameters[1] }],
    selfBindings: [{ kind: "rigid", owner }, { kind: "bound", owner: other, type: 0 }] };
  const terms = [primitive, { kind: "string" }];
  const entry = { vector, scope };
  assert.deepEqual(verifyTypes(verification(terms, { bindings: [entry, entry] })), []);
  for (const family of ["classBindings", "methodBindings", "capturedBindings"]) {
    const bad = { vector: { ...vector, [family]: [...vector[family]].reverse() }, scope };
    assert.deepEqual(verifyTypes(verification(terms, { bindings: [entry, bad] })), [
      violation("binding-vector-complete", { kind: "binding", vector: 1, family, position: 0 }, "parameter"),
      violation("binding-vector-complete", { kind: "binding", vector: 1, family, position: 1 }, "parameter"),
    ]);
  }
  const swapped = { vector: { ...vector, selfBindings: [...vector.selfBindings].reverse() }, scope };
  assert.deepEqual(verifyTypes(verification(terms, { bindings: [swapped, entry] })), [
    violation("self-binding-order", { kind: "binding", vector: 0, family: "selfBindings", position: 0 }, "owner"),
    violation("self-binding-order", { kind: "binding", vector: 0, family: "selfBindings", position: 1 }, "owner"),
  ]);
});

test("evidence distinguishes both sum arms and every numeric authored refusal with full vectors", () => {
  for (const kind of ["authored", "inferred"]) {
    for (const arms of [[], [{ authoredIndex: 0, component: source, member: 0 }],
      [{ authoredIndex: 0, component: source, member: 0 }, { authoredIndex: 1, component: itemSource, member: 1 }]]) {
      const value = evidence({ sum: { kind, component: source, bindings: emptyBindings(), arms } });
      assert.deepEqual(verifyTypes(verification([primitive, { kind: "string" }], { evidence: [value, value] })), []);
    }
  }
  const site = { kind: "evidence", position: 1, source };
  const numeric = authored => evidence({ numeric: { producer: source.value, kind: "literal",
    category: { kind: "known", category: "number" }, authored } });
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence(), numeric(null)] })),
    [violation("evidence-type", site, "numeric.authored")]);
  for (const authored of [{ kind: "string", value: "one" }, { kind: "boolean", value: true },
    { kind: "absence" }, { kind: "unique-symbol", declaration: method }])
    assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence(), numeric(authored)] })),
      [violation("evidence-type", site, "numeric.authored.kind")]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence(), numeric({
    kind: "number", token: "1/0", value: rational(1n, 0n),
  })] })), [violation("rational-normalized", site, "numeric.authored.value")]);
  const pointer = { kind: "function-pointer", declaration: method, parameters: [0, 2], result: 0, abi: ["native"] };
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence(), evidence({ pointer })] })),
    [violation("type-reference", site, "pointer.parameters", 2)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence(), evidence({ pointer: {
    ...pointer, parameters: [0], result: 2,
  } })] })), [violation("type-reference", site, "pointer.result", 2)]);
});

test("canonical union reduction does not erase authored sum roles or invent a structural-child requirement", () => {
  const table = { terms: [primitive, { kind: "string" }, { kind: "optional", value: 0 },
    { kind: "union", members: [0, 1] }, { kind: "optional", value: 3 }], signatures: [] };
  const bindings = emptyBindings();
  const value = evidence({ type: 4, sum: { kind: "authored", component: source, bindings,
    arms: [{ authoredIndex: 0, component: source, member: 2 }, { authoredIndex: 1, component: itemSource, member: 1 }] } });
  assert.deepEqual(verifyTypes({ table, bindings: [{ vector: bindings, scope: emptyScope() }], evidence: [value] }), []);
});

test("publication reserves every emitted row and every ordered or set reference edge", () => {
  const interner = createTypeInterner();
  assert.deepEqual([insertFixtureType(product, interner, primitive), insertFixtureType(product, interner, { kind: "string" }),
    insertFixtureType(product, interner, { kind: "union", members: [0, 1] })], [0, 1, 2]);
  const expected = { table: { terms: [primitive, { kind: "string" }, { kind: "union", members: [0, 1] }],
    signatures: [] }, types: [0, 1, 2], signatures: [] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 4 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 4 });
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 5 }),
    { kind: "complete", value: expected, work: 46, createdRecords: 5 });
  const selected = createTypeInterner();
  assert.equal(insertFixtureType(product, selected, primitive), 0);
  assert.equal(insertFixtureSignature(product, selected, signature({ receiver: 0, result: 0,
    typeParameters: [{ declaration: parameterDeclaration(owner, 0), constraint: 0, default: 0 }],
    parameters: [{ declaration: method, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: false }] })), 0);
  assert.equal(insertFixtureType(product, selected, { kind: "callable", calls: [0], constructs: [] }), 1);
  const table = { terms: [{ kind: "callable", calls: [0], constructs: [] }, primitive], signatures: [{ id: 0,
    ...signature({ receiver: 1, result: 1, typeParameters: [{ declaration: parameterDeclaration(owner, 0),
      constraint: 1, default: 1 }], parameters: [{ declaration: method, kind: "required", type: 1, passing: "by-value", initializer: null, acceptsOmission: false }] }) }] };
  assert.deepEqual(exportTypes(selected, { ...publicationLimits, maximumCreatedRecords: 8 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 8 });
  assert.deepEqual(completePublication(exportTypes(selected, { ...publicationLimits, maximumCreatedRecords: 9 })),
    { table, types: [1, 0], signatures: [0] });
});

test("the publication event meter bounds inline selectors and does not charge label encoding or copies", () => {
  const selectorArena = createTypeInterner();
  const selectorRow = { kind: "projection", source: 0,
    projection: { kind: "component", component: { root: source, path: [{ kind: "array-element" }] } } };
  assert.deepEqual([insertFixtureType(product, selectorArena, primitive), insertFixtureType(product, selectorArena, selectorRow)], [0, 1]);
  // Before the first selector: primitive row/fields 3 + projection row 1 + its eleven inline fields = 15.
  assert.deepEqual(exportTypes(selectorArena, { maximumCreatedRecords: 3, maximumWork: 15 }),
    { kind: "resource-limit", dimension: "work", maximum: 15 });
  assert.deepEqual([readType(selectorArena, 0), readType(selectorArena, 1)], [primitive, selectorRow]);
  for (const count of [0, 8, 100001]) {
    const interner = createTypeInterner();
    const path = Array.from({ length: count }, () => ({ kind: "array-element" }));
    const projection = { kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path } } };
    assert.equal(insertFixtureType(product, interner, primitive), 0);
    assert.equal(insertFixtureType(product, interner, projection), 1);
    assert.equal(compareCaseValues(readType(interner, 1), projection), true, "entire inline projection row");
    const table = { terms: [primitive, projection], signatures: [] };
    assert.equal(compareCaseValues(parseTypes(printTypes(table)), { kind: "parsed", value: table }), true);
    const result = exportTypes(interner, { maximumCreatedRecords: 3, maximumWork: 100000 });
    if (count === 100001) assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: 100000 });
    else assert.deepEqual(completePublication(result), { table, types: [0, 1], signatures: [] });
    assert.equal(compareCaseValues(readType(interner, 1), projection), true, "refusal preserves the entire inline projection row");
  }
  for (const length of [1, 100001]) {
    const interner = createTypeInterner();
    const row = { kind: "declared", definition: definition("x".repeat(length)), arguments: [], facet: "instance", extent: null };
    assert.equal(insertFixtureType(product, interner, row), 0);
    // Read 6 + graph (1 row + 6 fields) + rank 2 + key 1 + order 1 + issued map 1 = 18, independent of label length.
    assert.deepEqual(exportTypes(interner, { maximumCreatedRecords: 1, maximumWork: 17 }),
      { kind: "resource-limit", dimension: "work", maximum: 17 });
    assert.equal(compareCaseValues(exportTypes(interner, { maximumCreatedRecords: 1, maximumWork: 18 }),
      { kind: "complete", value: { table: { terms: [row], signatures: [] }, types: [0], signatures: [] }, work: 18, createdRecords: 1 }),
      true, "entire long-label publication outcome");
    assert.equal(compareCaseValues(parseTypes(printTypes({ terms: [row], signatures: [] })),
      { kind: "parsed", value: { terms: [row], signatures: [] } }), true, "entire unmetered public nominal text roundtrip");
  }
});

test("native owned arena reads reject invalid public references without accepting forged storage", () => {
  const interner = createTypeInterner();
  assert.equal(insertFixtureType(product, interner, primitive), 0);
  assert.equal(insertFixtureSignature(product, interner, signature()), 0);
  for (const value of [-1, -0, NaN, Infinity, 0.5, 9007199254740992]) {
    assert.throws(() => readType(interner, value), /outside this arena/u);
    assert.throws(() => readSignature(interner, value), /outside this arena/u);
  }
  for (const [reference, token] of [[NaN, "NaN"], [-0, "-0"], [-1, "-1"], [0.5, "0.5"], [Infinity, "+Infinity"], [100, "100"]]) {
    const parsed = parseTypes(`TypeTable(terms=[array(element=t:${token}, readonly=false)], signatures=[])`);
    assert.deepEqual(parsed, { kind: "parsed", value: { terms: [{ kind: "array", element: reference, readonly: false }], signatures: [] } });
    assert.equal(parsed.kind, "parsed");
    if (parsed.kind !== "parsed") return;
    const interner = createTypeInterner();
    assert.throws(() => insertFixtureGraph(product, interner, parsed.value.terms), /outside its snapshot and input domain/u);
    assert.deepEqual(viewTypes(interner).terms, []);
    assert.deepEqual(product.admitTypeTable(parsed.value, fixtureTypeAdmission()), { kind: "invalid", violations: [
      violation("type-reference", typeSite(0), "reference", reference),
    ] });
  }
  assert.throws(() => printTypes({ terms: new Array(1), signatures: [] }), /arrays must be dense/u);
});

test("new substituted signature rows retain every nested role before any expected row is interned", () => {
  const interner = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  assert.deepEqual([insertFixtureType(product, interner, { kind: "param", parameter }), insertFixtureType(product, interner, primitive)], [0, 1]);
  const child = signature({ result: 0 });
  const parent = signature({ declaration: method, owner: source, composition: { kind: "union", signatures: [0] },
    typeParameters: [{ declaration: parameterDeclaration(method, 0), constraint: 0, default: 0 }],
    receiver: 0, parameters: [{ declaration: method, kind: "required", type: 0, passing: "borrow-shared", initializer: null, acceptsOmission: false }], result: 0 });
  assert.deepEqual([insertFixtureSignature(product, interner, child), insertFixtureSignature(product, interner, parent)], [0, 1]);
  assert.equal(insertFixtureType(product, interner, { kind: "callable", calls: [1], constructs: [] }), 2);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  const expectedChild = { id: 3, ...signature({ result: 1 }) };
  const expectedParent = { id: 2, ...signature({ ...parent, composition: { kind: "union", signatures: [3] },
    typeParameters: [{ declaration: parameterDeclaration(method, 0), constraint: 1, default: 1 }],
    receiver: 1, parameters: [{ declaration: method, kind: "required", type: 1, passing: "borrow-shared", initializer: null, acceptsOmission: false }], result: 1 }) };
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1), readSignature(interner, 2), readSignature(interner, 3)],
    [{ id: 0, ...child }, { id: 1, ...parent }, expectedParent, expectedChild]);
  assert.deepEqual(readType(interner, 3), { kind: "callable", calls: [2], constructs: [] });
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.equal(insertFixtureSignature(product, interner, expectedParent), 2);
  assert.equal(insertFixtureSignature(product, interner, expectedChild), 3);
  const published = completePublication(exportTypes(interner, publicationLimits));
  assert.deepEqual([...published.types].sort((left, right) => left - right), [0, 1, 2, 3]);
  assert.deepEqual([...published.signatures].sort((left, right) => left - right), [0, 1, 2, 3]);
  const terms = new Array(4);
  terms[published.types[0]] = { kind: "param", parameter };
  terms[published.types[1]] = primitive;
  terms[published.types[2]] = { kind: "callable", calls: [published.signatures[1]], constructs: [] };
  terms[published.types[3]] = { kind: "callable", calls: [published.signatures[2]], constructs: [] };
  const signatures = new Array(4);
  signatures[published.signatures[0]] = { id: published.signatures[0], ...signature({ result: published.types[0] }) };
  signatures[published.signatures[3]] = { id: published.signatures[3], ...signature({ result: published.types[1] }) };
  for (const [issued, type, composition] of [[1, published.types[0], published.signatures[0]], [2, published.types[1], published.signatures[3]]])
    signatures[published.signatures[issued]] = { id: published.signatures[issued], ...signature({ declaration: method, owner: source,
      composition: { kind: "union", signatures: [composition] },
      typeParameters: [{ declaration: parameterDeclaration(method, 0), constraint: type, default: type }],
      receiver: type, parameters: [{ declaration: method, kind: "required", type, passing: "borrow-shared", initializer: null, acceptsOmission: false }], result: type }) };
  assert.deepEqual(published.table, { terms, signatures });
});

test("shared substitution paths enforce depth at both memoized and first depth-first visits", () => {
  for (const members of [[1, 2], [2, 1]]) {
    const interner = createTypeInterner();
    const rows = [primitive, { kind: "array", element: 0, readonly: false }, { kind: "array", element: 1, readonly: false },
      { kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false }];
    assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3]);
    assert.deepEqual(substitute(interner, [3], emptyBindings(), limits({ maximumDepth: 2 }), fixtureTypeWork(product)),
      { kind: "resource-limit", dimension: "depth", maximum: 2 });
    assert.deepEqual(substitute(interner, [3], emptyBindings(), limits({ maximumDepth: 3 }), fixtureTypeWork(product)), { kind: "complete", value: [3] });
    assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
  }
});

test("nested signature binders share both trie branches and block a repeated qualified binder", () => {
  const interner = createTypeInterner();
  const parameters = [parameterDeclaration(owner, 0), parameterDeclaration(owner, 1)];
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2]);
  const typeParameters = parameters.map(declaration => ({ declaration,
    constraint: null, default: null }));
  const child = signature({ typeParameters: [typeParameters[0]], result: 0 });
  const parent = signature({ typeParameters, composition: { kind: "intersection", signatures: [0] }, receiver: 1, result: 1 });
  assert.deepEqual([insertFixtureSignature(product, interner, child), insertFixtureSignature(product, interner, parent)], [0, 1]);
  const callable = { kind: "callable", calls: [1], constructs: [] };
  assert.equal(insertFixtureType(product, interner, callable), 3);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
  assert.deepEqual(substitute(interner, [3], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.deepEqual(Array.from({ length: 4 }, (_, type) => readType(interner, type)), [...rows, callable]);
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1)], [{ id: 0, ...child }, { id: 1, ...parent }]);
});

test("balanced recursive equalities compress multi-level aliases without changing labelled tuple roles", () => {
  const interner = createTypeInterner();
  const declared = argument => ({ kind: "declared", definition: owner, arguments: [argument], facet: "instance", extent: null });
  const tuple = members => ({ kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  const rows = [declared(0), declared(1), tuple([4, 3, 6]), tuple([5, 5, 7]), tuple([2, 3, 8]), tuple([3, 5, 9]),
    { kind: "union", members: [0, 1] }, { kind: "intersection", members: [0, 1] },
    { kind: "union", members: [0, 7] }, { kind: "intersection", members: [0, 6] }];
  const admitted = insertFixtureGraph(product, interner, rows);
  assert.deepEqual(admitted.types, [0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
  const issued = [...viewTypes(interner).terms];
  assert.deepEqual(publishedBatch(interner, admitted), {
    table: { terms: [declared(0), tuple([1, 1, 0])], signatures: [] },
    types: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0], signatures: [] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true);
});

{
  const signaturePrefix = 'TypeTable(terms=[], signatures=[Signature(id=sig:0, declaration=null, owner=';
  const signatureSuffix = ', composition=null, kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])';
  const componentPrefix = 'TypeTable(terms=[projection(source=t:0, projection=component(component=TypeComponent(root=';
  const componentSuffix = ', path=[])))], signatures=[])';
  const sourceText = `body(value=NodeRef(body=body:${JSON.stringify(body)}, node=n:0))`;
  const selectorPrefix = `${componentPrefix}${sourceText}, path=[`;
  const selectorSuffix = '])))], signatures=[])';
  const memberPrefix = 'TypeTable(terms=[shape(members=[Member(key=';
  const memberSuffix = ', origins=[], readOrigins=[], writeOrigins=[], kind="property", read=t:0, write=null, optional=false, readonly=true)], indexes=[], calls=[], constructs=[])], signatures=[])';
  const cases = [
    ['TypeTable(terms=[', '0', '], signatures=[])', ["identifier"]],
    ['TypeTable(terms=[', `NodeRef(body=body:${JSON.stringify(body)}, node=n:0)`, '], signatures=[])', ["type term"]],
    ['TypeTable(terms=[array(element=t:0, readonly=', 'flag:false', ')], signatures=[])', ["unqualified value"]],
    ['TypeTable(terms=[open(group=group:' + JSON.stringify(encodeGroupId([body])) + ', variable=', 'false', ')], signatures=[])', ["number"]],
    [componentPrefix, 'foreign()', componentSuffix, ["body", "item"]],
    [componentPrefix + 'body(value=', `ItemNodeRef(body=body:${JSON.stringify(body)}, node=n:0)`, ')' + componentSuffix, ["NodeRef"]],
    ['TypeTable(terms=[], signatures=[', 'SignatureInput', '(id=sig:0, declaration=null, owner=null, composition=null, kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])', ["Signature"]],
    ['TypeTable(terms=[open(group=group:' + JSON.stringify(encodeGroupId([body])) + ', variable=', '@', ')], signatures=[])', ["number"]],
    ['TypeTable(terms=[open(group=group:' + JSON.stringify(encodeGroupId([body])) + ', variable=', '1e999', ')], signatures=[])', ["finite number", "bigint"]],
    [componentPrefix + 'body(value=NodeRef(body=', 'body:"invalid"', ', node=n:0))' + componentSuffix, ["canonical body identity"]],
    [componentPrefix + 'body(value=NodeRef(body=', 'body:0', ', node=n:0))' + componentSuffix, ["canonical body identity"]],
    [memberPrefix, 'foreign()', memberSuffix, ["text", "number", "symbol"]],
    [memberPrefix + 'text(value="x"), origins=[', 'foreign()', '], readOrigins=[], writeOrigins=[], kind="property", read=t:0, write=null, optional=false, readonly=true)], indexes=[], calls=[], constructs=[])], signatures=[])', ["declared", "class-prototype", "intrinsic", "source-member", "mapped"]],
    [signaturePrefix + 'null, composition=', 'foreign()', ', kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])', ["union", "intersection"]],
    ['TypeTable(terms=[projection(source=t:0, projection=', 'foreign()', ')], signatures=[])', ["awaited", "keyof", "indexed", "substitution", "conditional", "mapped", "component"]],
    [selectorPrefix, 'foreign()', selectorSuffix, ["component selector"]],
    ['TypeTable(terms=[literal(value=', 'foreign()', ', base=t:0)], signatures=[])', ["literal value"]],
    ['TypeTable(', '"\\q"', '=[], signatures=[])', ["JSON string"]],
    ['TypeTable(terms', '[]', ', signatures=[])', ["="]],
    ['TypeTable(terms=[', 'foreign', '], signatures=[])', ["type term"]],
  ];
  for (const [index, [prefix, token, suffix, expected]] of cases.entries())
    test(`typed parser independently refuses inner domain ${index}: ${token}`, () => {
      const text = prefix + token + suffix;
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected));
    });
}

test("verifier covers all selector signature roles, mapped numeric origins and qualified construction captures", () => {
  const projection = path => ({ kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path } } });
  for (const selector of [{ kind: "parameter", signature: 0, index: 0 }, { kind: "receiver", signature: 0 },
    { kind: "result", signature: 0 }, { kind: "signature-tail", signature: 0, start: 0, readonly: true }]) {
    const input = verification([primitive, projection([selector])], { table: { terms: [primitive, projection([selector])],
      signatures: [{ id: 0, ...signature() }] } });
    assert.deepEqual(verifyTypes(input), []);
    assert.deepEqual(verifyTypes({ ...input, table: { ...input.table, signatures: [] } }),
      [violation("signature-reference", typeSite(1), "reference", 0)]);
  }
  for (const key of [{ kind: "text", value: "x" }, { kind: "number", value: rational(1n) },
    { kind: "number", value: rational(2n, 4n) }]) {
    const row = projection([{ kind: "member", origin: { kind: "mapped", owner: itemSource, key } }]);
    assert.deepEqual(verifyTypes(verification([row])), key.kind === "number" && key.value.denominator === 4n
      ? [violation("rational-normalized", typeSite(0), "origin.key")] : []);
  }
  const captures = { occurrence: source.value, captures: [{ body, local: 0 }, { body, local: 1 }] };
  assert.deepEqual(verifyTypes(verification([projection([{ kind: "construction-argument", definition: captures, index: 0 }])])), []);
  const missing = { ...captures, captures: [{ body, local: 2 }] };
  assert.deepEqual(verifyTypes(verification([projection([{ kind: "construction-argument", definition: missing, index: 0 }])])),
    [violation("construction-captures-qualified", typeSite(0), "definition.captures", 0)]);
  const family = { origin: "authored", component: { root: itemSource, path: [] }, parameters: [parameterDeclaration(owner, 0)],
    roles: [{ authoredIndex: 0, component: source, member: 0 }] };
  const sum = selected => projection([{ kind: "sum-arm", family: selected, index: 0 }]);
  assert.deepEqual(verifyTypes(verification([sum(family)])), []);
  const badSource = { kind: "item", value: { owner, node: 2 } };
  assert.deepEqual(verifyTypes(verification([projection([{ kind: "member", origin: {
    kind: "mapped", owner: badSource, key: { kind: "text", value: "x" },
  } }])])), [violation("cross-owner-qualified", typeSite(0), "origin.owner")]);
  assert.deepEqual(verifyTypes(verification([sum({ ...family, roles: [{ authoredIndex: 0, component: badSource, member: 1 }] })])),
    [violation("cross-owner-qualified", typeSite(0), "family.roles.component"), violation("type-reference", typeSite(0), "reference", 1)]);
  for (const parameters of [[{ owner, index: -1 }], [{ owner, index: NaN }], [{ owner, index: -0 }],
    [parameterDeclaration(owner, 0), parameterDeclaration(owner, 0)]])
    assert.deepEqual(verifyTypes(verification([sum({ ...family, parameters })])),
      [violation("parameter-identity", typeSite(0), "family.parameters", parameters.length - 1)]);
});

test("sparse typed nested collections retain their enclosing site across every remaining family", () => {
  const hole = () => new Array(1);
  const shape = changes => ({ kind: "shape", members: [], indexes: [], calls: [], constructs: [], ...changes });
  const projection = path => ({ kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path } } });
  const family = { origin: "inferred", component: { root: source, path: [] }, parameters: [], roles: [] };
  const member = { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: owner }],
    readOrigins: [], writeOrigins: [], kind: "property", read: null, write: null, optional: true, readonly: true };
  const cases = [
    [[shape({ members: hole() })], [], "member-order", typeSite(0), "members", 0],
    [[shape({ indexes: hole() })], [], "index-order", typeSite(0), "indexes", 0],
    [[shape({ calls: hole() })], [], "signature-reference", typeSite(0), "calls", 0],
    [[shape({ constructs: hole() })], [], "signature-reference", typeSite(0), "constructs", 0],
    [[shape({ members: [{ ...member, origins: hole() }] })], [], "member-origins", typeSite(0), "members.origins", 0],
    [[projection(hole())], [], "projection-owner", typeSite(0), "component.path", 0],
    [[projection([{ kind: "sum-arm", family: { ...family, parameters: hole() }, index: 0 }])], [],
      "parameter-identity", typeSite(0), "family.parameters", 0],
    [[projection([{ kind: "sum-arm", family: { ...family, roles: hole() }, index: 0 }])], [],
      "sum-arm-order", typeSite(0), "family.roles", 0],
    [[primitive], hole(), "signature-reference", signatureSite(0), "signatures", 0],
    [[primitive], [{ id: 0, ...signature({ composition: { kind: "union", signatures: hole() } }) }],
      "signature-reference", signatureSite(0), "composition.signatures", 0],
  ];
  for (const [terms, signatures, rule, site, field, position] of cases) {
    const missing = violation(rule, site, field, position);
    const expected = field === "composition.signatures" ? [violation("signature-order", site, field), missing]
      : field === "calls" || field === "constructs" ? [missing, violation("signature-order", site, field)] : [missing];
    assert.deepEqual(verifyTypes({ table: { terms, signatures }, bindings: [], evidence: [] }), expected);
  }
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ sum: {
    kind: "authored", component: source, bindings: emptyBindings(), arms: hole(),
  } })] })), [violation("sum-arm-order", { kind: "evidence", position: 0, source }, "sum.arms", 0)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ category: { kind: "choice", alternatives: hole() } })] })),
    [violation("evidence-type", { kind: "evidence", position: 0, source }, "category.alternatives", 0)]);
});

test("admission repairs a shape's complete ordered payload after a compound child aliases", () => {
  const interner = createTypeInterner();
  const nominal = argument => ({ kind: "declared", definition: owner, arguments: [argument], facet: "instance", extent: null });
  const origin = { kind: "declared", declaration: owner };
  const member = (name, type) => ({ key: { kind: "text", value: name }, origins: [origin], readOrigins: [origin], writeOrigins: [origin],
    kind: "property", read: type, write: type, optional: false, readonly: false });
  const index = (declaration, type) => ({ origin: { kind: "item", value: { owner: declaration, node: 0 } }, key: type, read: type, write: type, readonly: false });
  const shape = type => ({ kind: "shape", members: [member("a", type), member("b", type)],
    indexes: [index(owner, type), index(method, type)], calls: [0], constructs: [1] });
  const admitted = insertFixtureGraph(product, interner,
    [nominal(0), nominal(1), { kind: "union", members: [0, 1] }, shape(2)],
    [signature({ result: 2 }), signature({ kind: "construct", result: 2 })]);
  assert.deepEqual(admitted, { types: [0, 0, 0, 1], signatures: [0, 1] });
  const table = { terms: [nominal(0), shape(0)], signatures: [{ id: 0, ...signature({ result: 0 }) },
    { id: 1, ...signature({ kind: "construct", result: 0 }) }] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 18 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 18 });
  assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 19 }),
    { table, types: [0, 0, 0, 1], signatures: [0, 1] });
  assert.deepEqual(readType(interner, 1), shape(0));
});

test("verifier reads complete signatures, writable indexes and optional/rest ordering without inferred fields", () => {
  const typeParameters = [{ declaration: parameterDeclaration(owner, 0), constraint: 0, default: 0 }];
  const full = { id: 0, ...signature({ typeParameters, receiver: 0, composition: { kind: "intersection", signatures: [0] },
    parameters: [{ declaration: method, kind: "optional", type: 0, passing: "by-value", initializer: null, acceptsOmission: true },
      { declaration: captured, kind: "rest", type: 0, passing: "move", initializer: null, acceptsOmission: true }] }) };
  const table = signatures => ({ terms: [primitive], signatures });
  assert.deepEqual(verifyTypes({ table: table([full]), bindings: [], evidence: [] }), []);
  for (const selected of [{ ...full, receiver: 2 }, { ...full, result: 2 },
    { ...full, typeParameters: [{ ...typeParameters[0], constraint: 2 }] },
    { ...full, typeParameters: [{ ...typeParameters[0], default: 2 }] },
    { ...full, parameters: [{ declaration: method, kind: "required", type: 2, passing: "by-value", initializer: null, acceptsOmission: false }] }])
    assert.deepEqual(verifyTypes({ table: table([selected]), bindings: [], evidence: [] }),
      [violation("type-reference", signatureSite(0), "reference", 2)]);
  assert.deepEqual(verifyTypes({ table: table([{ ...full, composition: { kind: "union", signatures: [1, 0] } }]), bindings: [], evidence: [] }),
    [violation("signature-order", signatureSite(0), "composition.signatures"), violation("signature-reference", signatureSite(0), "reference", 1)]);
  for (const kind of ["call", "construct"]) {
    const callable = { kind: "callable", calls: kind === "construct" ? [0] : [], constructs: kind === "call" ? [0] : [] };
    assert.deepEqual(verifyTypes({ table: { terms: [primitive, callable], signatures: [{ id: 0, ...signature({ kind }) }] }, bindings: [], evidence: [] }),
      [violation("signature-order", typeSite(1), kind === "call" ? "constructs" : "calls")]);
  }
  const writable = { kind: "shape", members: [], indexes: [{ origin: { kind: "item", value: { owner: owner, node: 0 } }, key: 0, read: 0, write: 0, readonly: false }], calls: [], constructs: [] };
  assert.deepEqual(verifyTypes(verification([writable])), []);
  assert.deepEqual(verifyTypes(verification([{ ...writable, indexes: [{ ...writable.indexes[0], write: 2 }] }])),
    [violation("type-reference", typeSite(0), "reference", 2)]);
  const tuple = kinds => ({ kind: "tuple", elements: kinds.map(kind => ({ kind, type: 0, declaration: null })), readonly: false });
  for (const kinds of [[], ["optional"], ["required", "optional", "rest"]]) assert.deepEqual(verifyTypes(verification([tuple(kinds)])), []);
  assert.deepEqual(verifyTypes(verification([tuple(["optional", "required"])])), [violation("tuple-rest-order", typeSite(0), "elements", 1)]);
  assert.deepEqual(verifyTypes(verification([tuple(["rest", "optional"])])), [violation("tuple-rest-order", typeSite(0), "elements", 1)]);
});

test("binding and evidence minimal opposites preserve complete owner sites and invalid numeric identities", () => {
  for (const index of [-1, -0, NaN, Infinity, 0.5]) assert.deepEqual(verifyTypes(verification([{ kind: "param", parameter: { owner, index } }])),
    [violation("parameter-identity", typeSite(0), "parameter")]);
  const parameter = parameterDeclaration(owner, 0);
  for (const [family, scopeName] of [["classBindings", "classParameters"], ["methodBindings", "methodParameters"], ["capturedBindings", "capturedParameters"]]) {
    const input = { vector: { ...emptyBindings(), [family]: [{ kind: "bound", parameter, type: 1 }] },
      scope: { ...emptyScope(), [scopeName]: [parameter] } };
    assert.deepEqual(verifyTypes(verification([primitive], { bindings: [input] })),
      [violation("type-reference", { kind: "binding", vector: 0, family, position: 0 }, "type", 1)]);
  }
  assert.deepEqual(verifyTypes(verification([primitive], { bindings: [{ vector: emptyBindings(), scope: { ...emptyScope(), selfOwners: [owner] } }] })),
    [violation("binding-vector-complete", { kind: "binding", vector: 0, family: "selfBindings", position: null }, "length", 0)]);
  assert.deepEqual(verifyTypes(verification([primitive], { bindings: [{ vector: { ...emptyBindings(), selfBindings: [{ kind: "bound", owner, type: 1 }] },
    scope: { ...emptyScope(), selfOwners: [owner] } }] })),
    [violation("type-reference", { kind: "binding", vector: 0, family: "selfBindings", position: 0 }, "type", 1)]);
  const site = { kind: "evidence", position: 0, source };
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: [evidence({ type: 1, nominal: owner })] })),
    [violation("type-reference", site, "type", 1)]);
  assert.deepEqual(verifyTypes(verification([{ kind: "declared", definition: owner, arguments: [], facet: "instance", extent: null }],
    { evidence: [evidence({ nominal: other })] })), [violation("evidence-type", site, "nominal")]);
  assert.deepEqual(verifyTypes(verification([{ kind: "declared", definition: owner, arguments: [], facet: "instance", extent: null }],
    { evidence: [evidence({ nominal: owner })] })), []);
  assert.deepEqual(verifyTypes(verification([{ kind: "enum", definition: definition("Enum") }],
    { evidence: [evidence({ nominal: definition("Enum") })] })), []);
  const origin = { kind: "declared", declaration: owner };
  const member = { key: { kind: "number", value: rational(2n, 4n) }, origins: [origin], readOrigins: [], writeOrigins: [],
    kind: "property", read: 0, write: null, optional: false, readonly: true };
  assert.deepEqual(verifyTypes(verification([{ kind: "shape", members: [member], indexes: [], calls: [], constructs: [] }])),
    [violation("rational-normalized", typeSite(0), "members.key", 0)]);
});

test("publication does not count signed bigint encoding as an algorithm event", () => {
  for (const width of [1n, 1000n, 100001n]) for (const sign of [1n, -1n]) {
    const interner = createTypeInterner();
    const value = sign * (1n << width);
    const row = { kind: "literal", base: 0, value: { kind: "bigint", value } };
    assert.equal(insertFixtureType(product, interner, primitive), 0);
    assert.equal(insertFixtureType(product, interner, row), 1);
    // Read 9 + graph (2 rows + 9 fields + 1 edge) + rank (4 row + 3 edge events) + keys 3 + order 2 + remap 1 + issued map 2 = 36.
    assert.deepEqual(exportTypes(interner, { maximumCreatedRecords: 3, maximumWork: 35 }),
      { kind: "resource-limit", dimension: "work", maximum: 35 });
    const result = exportTypes(interner, { maximumCreatedRecords: 3, maximumWork: 36 });
    const expected = { kind: "complete", value: { table: { terms: [{ ...row, base: 1 }, primitive], signatures: [] },
      types: [1, 0], signatures: [] }, work: 36, createdRecords: 3 };
    assert.equal(compareCaseValues(result, expected), true, "entire signed bigint publication outcome");
    assert.equal(compareCaseValues(readType(interner, 1), row), true, "complete issued bigint row remains unchanged");
  }
});

test("signature parent notifications follow a newly normalized compound rather than a prebuilt result", () => {
  const interner = createTypeInterner();
  const parameters = [parameterDeclaration(owner, 0), parameterDeclaration(owner, 1)];
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive, { kind: "union", members: [0, 1] }];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3]);
  assert.equal(insertFixtureSignature(product, interner, signature({ result: 3 })), 0);
  const original = { kind: "callable", calls: [0], constructs: [] };
  assert.equal(insertFixtureType(product, interner, original), 4);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
  assert.deepEqual(substitute(interner, [4], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [5] });
  assert.deepEqual(Array.from({ length: 6 }, (_, type) => readType(interner, type)), [...rows, original,
    { kind: "callable", calls: [1], constructs: [] }]);
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1)],
    [{ id: 0, ...signature({ result: 3 }) }, { id: 1, ...signature({ result: 2 }) }]);
});

test("alternating compound parents collapse complete staged aliases without publishing intermediates", () => {
  const interner = createTypeInterner();
  const parameters = Array.from({ length: 4 }, (_, index) => (parameterDeclaration(owner, index)));
  const tuple = members => ({ kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive,
    { kind: "intersection", members: [0, 1] }, { kind: "union", members: [2, 3] },
    { kind: "union", members: [2, 5] }, { kind: "intersection", members: [0, 6] }, tuple([7, 8, 5, 6])];
  assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 4 })) };
  assert.deepEqual(substitute(interner, [9], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [10] });
  assert.deepEqual(readType(interner, 10), tuple([4, 4, 4, 4]));
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
  assert.throws(() => readType(interner, 11), /outside this arena/u);
});

test("least publication closure absorbs optional children exposed by a bisimilar intersection", () => {
  const interner = createTypeInterner();
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "intersection", members: [2, 3] },
    { kind: "string" }, { kind: "union", members: [4, 5] }];
  const admitted = insertFixtureGraph(product, interner, rows);
  const issued = [...viewTypes(interner).terms];
  const table = { terms: [{ kind: "array", element: 0, readonly: false }, { kind: "optional", value: 0 },
    { kind: "optional", value: 4 }, { kind: "string" }, { kind: "union", members: [0, 3] }], signatures: [] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 9 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 9 });
  assert.deepEqual(publishedBatch(interner, admitted, { ...publicationLimits, maximumCreatedRecords: 10 }),
    { table, types: [0, 0, 1, 1, 1, 3, 2], signatures: [] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true);
});

test("independent native arenas own their typed indexes and substitution caches", () => {
  const first = createTypeInterner();
  const second = createTypeInterner();
  assert.equal(insertFixtureType(product, first, primitive), 0);
  assert.equal(insertFixtureType(product, second, { kind: "string" }), 0);
  assert.deepEqual(readType(first, 0), primitive);
  assert.deepEqual(readType(second, 0), { kind: "string" });
  assert.equal(insertFixtureType(product, first, { kind: "string" }), 1);
  assert.equal(insertFixtureType(product, second, primitive), 1);
  assert.deepEqual([readType(first, 1), readType(second, 1)], [{ kind: "string" }, primitive]);
});

test("a foreign signature must retain its own arena position before any arena is issued", () => {
  const table = { terms: [primitive], signatures: [{ id: 1, ...signature() }] };
  assert.deepEqual(product.admitTypeTable(table, fixtureTypeAdmission()), { kind: "invalid", violations: [
    violation("signature-order", { kind: "signature", signature: 0 }, "id"),
  ] });
  assert.equal(table.signatures[0].id, 1);
});

test("mixed staged compounds redirect through a live target and compress the resulting two-hop alias", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    const parameter = parameterDeclaration(owner, 0);
    const fixed = element => ({ kind: "fixed-array", element, extent: { length: 3n, runtimeBase: "number" } });
    const array = element => ({ kind: "array", element, readonly: false });
    const tuple = members => ({ kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
    const rows = [{ kind: "param", parameter }, primitive, fixed(0), array(0), { kind, members: [2, 3] }, array(1), fixed(1),
      { kind, members: [5, 6] }, { kind, members: [2, 5] }, tuple([4, 8])];
    assert.deepEqual(rows.map(row => insertFixtureType(product, interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
    assert.deepEqual(substitute(interner, [9], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [10] });
    assert.deepEqual(Array.from({ length: 11 }, (_, type) => readType(interner, type)), [...rows, tuple([7, 7])]);
    assert.equal(insertFixtureType(product, interner, tuple([7, 7])), 10);
    assert.throws(() => readType(interner, 11), /outside this arena/u);
  }
});

function decodeCase(text) {
  return JSON.parse(text, function (key, value) {
    return typeof value === "string" && (["numerator", "denominator", "length"].includes(key)
      || key === "value" && this.kind === "bigint") ? BigInt(value) : value;
  });
}

for (const level of ["function", "verifier"]) {
  const directory = `test/host-cases/ir-types/${level}`;
  const descriptors = readdirSync(resolve(repository, directory)).filter(path => path.endsWith(".case.json")).sort();
  for (const name of descriptors) test(`authored ${level} case ${name}`, async () => {
    const adapter = request => {
      const input = decodeCase(request.text);
      let value;
      if (level === "verifier") value = verifyTypes(input);
      else if (input.operation === "text") value = parseTypes(printTypes(input.table));
      else if (input.operation === "parse") value = parseTypes(input.text);
      else if (input.operation === "intern") {
        const interner = createTypeInterner();
        const types = input.terms.map(term => insertFixtureType(product, interner, term));
        const signatures = input.signatures.map(signature => insertFixtureSignature(product, interner, signature));
        value = { types, signatures, terms: types.map(type => readType(interner, type)),
          signatureRows: signatures.map(signature => readSignature(interner, signature)), publication: exportTypes(interner, input.limits) };
      } else throw new Error(`Unlisted ir-types case operation: ${input.operation}`);
      return { kind: "accepted", value, diagnostics: [] };
    };
    const descriptorPath = `${directory}/${name}`;
    const descriptor = JSON.parse(readFileSync(resolve(repository, descriptorPath), "utf8"));
    const expected = decodeCase(readFileSync(resolve(repository, descriptor.expected), "utf8"));
    const deps = { modules: ["ir-types"], adapters: { [level]: adapter }, evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))),
      list: path => readdirSync(resolve(repository, path)), decode: decodeCase };
    assert.deepEqual(await runCase(deps, descriptorPath), { status: "passed", path: descriptorPath, outcome: expected });
  });
}


test("two genuinely new staged signatures collapse after substitution with complete per-order rows and publication maps", () => {
  const parameters = [parameterDeclaration(owner, 0), parameterDeclaration(owner, 1)];
  for (const order of [[0, 1], [1, 0]]) {
    const interner = createTypeInterner();
    const originals = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive,
      { kind: "callable", calls: [0, 1], constructs: [] }];
    assert.deepEqual(originals.slice(0, 3).map(row => insertFixtureType(product, interner, row)), [0, 1, 2]);
    assert.deepEqual(order.map(result => insertFixtureSignature(product, interner, signature({ result }))), [0, 1]);
    assert.equal(insertFixtureType(product, interner, originals[3]), 3);
    const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
    assert.deepEqual(substitute(interner, [3], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [4] });
    const final = { kind: "callable", calls: [2], constructs: [] };
    assert.deepEqual(Array.from({ length: 5 }, (_, identity) => readType(interner, identity)), [...originals, final]);
    assert.deepEqual(Array.from({ length: 3 }, (_, identity) => readSignature(interner, identity)),
      [...order.map((result, id) => ({ id, ...signature({ result }) })), { id: 2, ...signature({ result: 2 }) }]);
    assert.throws(() => readSignature(interner, 3), /outside this arena/u);
    const published = { table: { terms: [final, originals[3], originals[0], originals[1], primitive],
      signatures: [{ id: 0, ...signature({ result: 2 }) }, { id: 1, ...signature({ result: 3 }) },
        { id: 2, ...signature({ result: 4 }) }] },
      types: [2, 3, 4, 1, 0], signatures: [...order, 2] };
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), published);
    assert.deepEqual(substitute(interner, [3], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [4] });
    assert.equal(insertFixtureSignature(product, interner, signature({ result: 2 })), 2);
    assert.equal(insertFixtureType(product, interner, final), 4);
  }
});

test("a changed callable compacts an unchanged existing signature alongside a genuinely new one", () => {
  const interner = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  const parameterTerm = { kind: "param", parameter };
  const original = { kind: "callable", calls: [0, 1], constructs: [] };
  const retained = signature({ declaration: method, result: 1 });
  const changed = signature({ result: 0 });
  assert.deepEqual([insertFixtureType(product, interner, parameterTerm), insertFixtureType(product, interner, primitive)], [0, 1]);
  assert.deepEqual([insertFixtureSignature(product, interner, retained), insertFixtureSignature(product, interner, changed)], [0, 1]);
  assert.equal(insertFixtureType(product, interner, original), 2);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  const final = { kind: "callable", calls: [0, 2], constructs: [] };
  assert.deepEqual(Array.from({ length: 4 }, (_, identity) => readType(interner, identity)), [parameterTerm, primitive, original, final]);
  assert.deepEqual(Array.from({ length: 3 }, (_, identity) => readSignature(interner, identity)),
    [{ id: 0, ...retained }, { id: 1, ...changed }, { id: 2, ...signature({ result: 1 }) }]);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), {
    table: { terms: [final, original, parameterTerm, primitive],
      signatures: [{ id: 0, ...signature({ declaration: method, result: 3 }) },
        { id: 1, ...signature({ result: 2 }) }, { id: 2, ...signature({ result: 3 }) }] },
    types: [2, 3, 1, 0], signatures: [0, 1, 2] });
  assert.deepEqual(substitute(interner, [2], bindings, limits(), fixtureTypeWork(product)), { kind: "complete", value: [3] });
  assert.equal(insertFixtureSignature(product, interner, signature({ result: 1 })), 2);
  assert.equal(insertFixtureType(product, interner, final), 3);
});

{
  const mixed = [
    ["earlier field before later malformed value", "TypeTable(", "signatures", '=0, terms=[array(element=t:0, readonly="bad\\q")])', ["terms"]],
    ["earlier array value before later field", "TypeTable(terms=", "0", ", extra=[])", ["array"]],
    ["earlier field before later array value", "TypeTable(", "extra", "=[], terms=0, signatures=[])", ["terms"]],
    ["earlier boolean before later malformed string", "TypeTable(terms=[array(element=t:0, readonly=", "0",
      '), intrinsic(intrinsic="bad\\q")], signatures=[])', ["boolean"]],
    ["earlier boolean prefix before later malformed string", "TypeTable(terms=[array(element=t:0, readonly=", "flag:false",
      '), intrinsic(intrinsic="bad\\q")], signatures=[])', ["unqualified value"]],
    ["earlier wrong scalar type before its own escape failure", "TypeTable(terms=[array(element=t:0, readonly=", '"bad\\q"',
      ")], signatures=[])", ["boolean"]],
    ["earlier impossible intrinsic prefix before later boolean", 'TypeTable(terms=[intrinsic(intrinsic=', '"bad\\q"',
      "), array(element=t:0, readonly=0)], signatures=[])", ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol", "alias-marker"]],
    ["earlier assignment punctuation before later value", "TypeTable(terms", "[]", ", signatures=0)", ["="]],
    ["earlier array comma before later wrong type", "TypeTable(terms=[string() ", "array", "(element=t:0, readonly=0)], signatures=[])", [",", "]"]],
    ["earlier missing record close before later root field", "TypeTable(terms=[array(element=t:0, readonly=false", "]",
      ", signatures=0)", [",", ")"]],
    ["earlier root before later lexical error", "", "Unknown", '(terms=[intrinsic(intrinsic="bad\\q")], signatures=[])', ["TypeTable"]],
    ["earlier valid root name missing frame punctuation", "TypeTable ", "terms", "=[wrong()]", ["("]],
    ["earlier arm before later malformed number", "TypeTable(terms=[", "foreign", "(value=t:1e999)], signatures=[])", ["type term"]],
    ["earlier array value before later lexical root field", "TypeTable(terms=", "false", ', signatures="bad\\q")', ["array"]],
    ["earlier root field before later malformed frame", "TypeTable(", "other", "=[string()], signatures=[]", ["terms"]],
    ["earlier quoted field before later malformed value", 'TypeTable("', 'signatures', '"=[wrong()], terms=0)', ["terms"]],
    ["earlier nullable arm before later signature field", "TypeTable(terms=[], signatures=[Signature(id=sig:0, declaration=null, owner=",
      "foreign", '(), composition=null, kind="bad", typeParameters=[], receiver=null, parameters=[], result=t:0)])', ["body", "item"]],
    ["earlier field before later identity lexical error", "TypeTable(terms=[array(", "readonly", "=false, element=t:1e999)], signatures=[])", ["element"]],
  ];
  for (const [name, prefix, token, suffix, expected] of mixed)
    test(`typed parser earliest mixed error: ${name}`, () => {
      const text = prefix + token + suffix;
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected));
    });
}

{
  const numeric = [
    ["type", "t", "TypeTable(terms=[array(element=", ", readonly=false)], signatures=[])"],
    ["signature reference", "sig", "TypeTable(terms=[callable(calls=[", "], constructs=[])], signatures=[])"],
    ["signature declaration", "sig", "TypeTable(terms=[], signatures=[Signature(id=",
      ', declaration=null, owner=null, composition=null, kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])'],
    ["node", "n", "TypeTable(terms=[projection(source=t:0, projection=component(component=TypeComponent(root=body(value=NodeRef(body=body:"
      + JSON.stringify(body) + ", node=", ")), path=[])))], signatures=[])"],
    ["local", "l", "TypeTable(terms=[construction-reference(definition=ConstructionDefinition(occurrence=NodeRef(body=body:"
      + JSON.stringify(body) + ", node=n:0), captures=[LocalRef(body=body:" + JSON.stringify(body) + ", local=",
      ")]), arguments=[])], signatures=[])"],
  ];
  for (const [name, qualifier, prefix, suffix] of numeric) {
    for (const payload of ['"', '"bad\\q"', "0n", "0n1e999"]) {
      const text = prefix + qualifier + ":" + payload + (payload === '"' ? "" : suffix);
      test("qualified " + name + " rejects its known wrong payload kind before later text: " + payload, () =>
        assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, ["number"])));
    }
    for (const payload of ["1e999", "00n1e999"]) {
      const text = prefix + qualifier + ":" + payload + suffix;
      test("qualified " + name + " keeps a genuine numeric lexical failure: " + payload, () =>
        assert.deepEqual(parseTypes(text), invalidText(text, prefix.length + qualifier.length + 1, ["finite number", "bigint"])));
    }
  }
  const durable = [
    ["definition", "def", "TypeTable(terms=[enum(definition=", ")], signatures=[])", ["canonical definition identity"], owner,
      { terms: [{ kind: "enum", definition: owner }], signatures: [] }],
    ["body", "body", "TypeTable(terms=[projection(source=t:0, projection=component(component=TypeComponent(root=body(value=NodeRef(body=",
      ", node=n:0)), path=[])))], signatures=[])", ["canonical body identity"], body,
      { terms: [{ kind: "projection", source: 0, projection: { kind: "component",
        component: { root: source, path: [] } } }], signatures: [] }],
    ["group", "group", "TypeTable(terms=[open(group=", ", variable=0)], signatures=[])", ["canonical inference-group identity"],
      encodeGroupId([body]), { terms: [{ kind: "open", group: encodeGroupId([body]), variable: 0 }], signatures: [] }],
  ];
  for (const [name, qualifier, prefix, suffix, expected, identity, table] of durable) {
    for (const payload of ["1e999", "-", "0n1e999", "NaN", "+Infinity", "-Infinity"]) {
      const text = prefix + qualifier + ":" + payload + suffix;
      test("qualified " + name + " rejects a numeric prefix before its later lexical failure: " + payload, () =>
        assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected)));
    }
    const text = prefix + qualifier + ':"bad\\q"' + suffix;
    test("qualified " + name + " retains a genuine string lexical failure", () =>
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length + qualifier.length + 1, ["JSON string"])));
    const escaped = '"\\u' + identity.charCodeAt(0).toString(16).padStart(4, "0") + JSON.stringify(identity).slice(2);
    test("qualified " + name + " accepts its independently expected escaped durable identity", () =>
      assert.deepEqual(parseTypes(prefix + qualifier + ":" + escaped + suffix), { kind: "parsed", value: table }));
  }
}

{
  const next = "TypeTable(terms=[], ";
  const last = "TypeTable(terms=[], signatures=[], ";
  const fields = [
    ["complete prior quoted name", next + '"', "terms", '"=[], signatures=[])', ["unique record field"]],
    ["unterminated prior quoted prefix", next + '"', "te", "", ["signatures"]],
    ["malformed prior quoted prefix", next + '"', "te", '\\q"=[])', ["signatures"]],
    ["complete prior spelling before malformed escape", next + '"', "terms", '\\q"=[]', ["signatures"]],
    ["complete prior spelling before final escape", next + '"', "terms", "\\", ["signatures"]],
    ["prior prefix before malformed unicode", next + '"', "te", '\\u12G4"=[])', ["signatures"]],
    ["prior prefix before an unescaped control", next + '"', "te", '\n"=[])', ["signatures"]],
    ["complete prior escaped name", next + '"', "\\u0074erms", '"=[], signatures=[])', ["unique record field"]],
    ["unterminated prior escaped prefix", next + '"', "\\u0074e", "", ["signatures"]],
    ["malformed prior escaped prefix", next + '"', "\\u0074e", '\\q"=[])', ["signatures"]],
    ["complete prior unquoted name", next, "terms", "=[], signatures=[])", ["unique record field"]],
    ["unterminated prior unquoted prefix", next, "te", "", ["signatures"]],
    ["prior unquoted prefix before invalid punctuation", next, "te", "\\q=[])", ["signatures"]],
    ["wrong quoted first field", 'TypeTable("', "oops", "", ["terms"]],
    ["later decoded field deviation", 'TypeTable("te', "X", 'rms\\q"=[])', ["terms"]],
    ["later escaped field deviation", 'TypeTable("te', "\\u0058", 'rms\\q"=[])', ["terms"]],
    ["escaped matching prefix before field deviation", 'TypeTable("\\u0074e', "X", 'rms\\q"=[])', ["terms"]],
    ["later unquoted field deviation", "TypeTable(term", "X", "=[])", ["terms"]],
    ["quoted proper prefix", 'TypeTable("te', '"', "=[], signatures=[])", ["terms"]],
    ["quoted escaped proper prefix", 'TypeTable("te\\u0072', '"', "=[], signatures=[])", ["terms"]],
    ["unquoted proper prefix", "TypeTable(te", "=", "[], signatures=[])", ["terms"]],
    ["unquoted proper prefix at end", "TypeTable(te", "", "", ["terms"]],
    ["complete quoted extra after final field", last + '"', "extra", '"=0)', ["end of record"]],
    ["unterminated quoted extra after final field", last + '"', "extra", "", ["end of record"]],
    ["malformed quoted extra after final field", last + '"', "extra", '\\q"=0)', ["end of record"]],
    ["complete escaped extra after final field", last + '"', "\\u0065xtra", '"=0)', ["end of record"]],
    ["unterminated escaped extra after final field", last + '"', "\\u0065xtra", "", ["end of record"]],
    ["malformed escaped extra after final field", last + '"', "\\u0065xtra", '\\q"=0)', ["end of record"]],
    ["complete unquoted extra after final field", last, "extra", "=0)", ["end of record"]],
    ["unterminated unquoted extra after final field", last, "ex", "", ["end of record"]],
    ["unquoted extra before invalid punctuation", last, "ex", "\\q=0)", ["end of record"]],
    ["complete quoted prior after final field", last + '"', "terms", '"=[])', ["unique record field"]],
    ["unterminated prior after final field", last + '"', "terms", "", ["end of record"]],
    ["malformed prior after final field", last + '"', "terms", '\\q"=[]', ["end of record"]],
    ["unterminated escaped prior after final field", last + '"', "\\u0074erms", "", ["end of record"]],
    ["complete escaped prior after final field", last + '"', "\\u0074erms", '"=[])', ["unique record field"]],
    ["complete unquoted prior after final field", last, "terms", "=[])", ["unique record field"]],
    ["empty quoted name after final field", last + '"', '"', "=0)", ["end of record"]],
    ["matching prefix then actual unknown suffix", 'TypeTable("terms', "X", '"=[], signatures=[])', ["terms"]],
    ["multiline escaped prior field", 'TypeTable(\n terms=[],\n "', "\\u0074erms", '"=[]', ["unique record field"]],
  ];
  const member = 'TypeTable(terms=[shape(members=[Member(key=text(value="x"), origins=[], readOrigins=[], writeOrigins=[], kind="property", read=null, ';
  const index = "TypeTable(terms=[shape(members=[], indexes=[IndexSignature(origin=item(value=ItemNodeRef(owner=def:" + JSON.stringify(owner)
    + ", node=n:0)), key=t:0, read=t:0, write=null, ";
  fields.push(
    ["nested quoted duplicate with a shared required prefix", member + '"write', "Origins", '"=[]', ["unique record field"]],
    ["nested escaped duplicate with a shared required prefix", member + '"write', "\\u004Frigins", '"=[]', ["unique record field"]],
    ["nested unquoted duplicate with a shared required prefix", member + "write", "Origins", "=[]", ["unique record field"]],
    ["nested quoted prefix before malformed escape", member + '"write', "O", 'rigins\\q"=[]', ["write"]],
    ["nested no-next duplicate", 'TypeTable(terms=[primitive(primitive="bool", "', "primitive", '"="bad\\q")], signatures=[])', ["unique record field"]],
    ["nested no-next empty name", 'TypeTable(terms=[primitive(primitive="bool", "', '"', "=0)], signatures=[])", ["end of record"]],
    ["quoted duplicate is a proper prefix of required field", index + '"read', '"', "=false", ["unique record field"]],
    ["escaped duplicate is a proper prefix of required field", index + '"\\u0072ead', '"', "=false", ["unique record field"]],
    ["unquoted duplicate is a proper prefix of required field", index + "read", "=", "false", ["unique record field"]],
  );
  for (const [name, prefix, token, suffix, expected] of fields) {
    const text = prefix + token + suffix;
    test("field-name first decoded deviation: " + name, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected)));
  }
  const lexical = [
    ['TypeTable("te\\q"=0)', 10, ["JSON string"]],
    ['TypeTable("te\\u12G4"=0)', 10, ["JSON string"]],
    ['TypeTable("te\nrms"=0)', 'TypeTable("te'.length, ["escaped string character"]],
    [next + '"si\\q"=[]', next.length, ["JSON string"]],
    [last + '"\\q"=0)', last.length, ["JSON string"]],
    ['TypeTable("te', 'TypeTable("te'.length, ['"']],
    [next + '"si', (next + '"si').length, ['"']],
    [index + '"read\\q"=false', index.length, ["JSON string"]],
  ];
  for (const [position, [text, offset, expected]] of lexical.entries())
    test("field-name lexical failure before any decoded deviation " + position, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, offset, expected)));
  test("decoded escaped required names retain their complete valid value", () => {
    const text = 'TypeTable("\\u0074er\\u006Ds"=[], "signat\\u0075res"=[])';
    assert.deepEqual(parseTypes(text), { kind: "parsed", value: { terms: [], signatures: [] } });
  });
}

{
  const row = (kind, parameters = []) => ({ terms: [], signatures: [{ id: 0, ...signature({ kind, parameters }) }] });
  const parameter = { declaration: owner, kind: "required", type: 0, passing: "by-value", initializer: null, acceptsOmission: false };
  const beforeParameter = 'TypeTable(terms=[], signatures=[Signature(id=sig:0, declaration=null, owner=null, composition=null, kind="call", typeParameters=[], receiver=null, parameters=[SignatureParameter(declaration=def:'
    + JSON.stringify(owner) + ", ";
  const afterParameter = ")], result=t:0)])";
  const root = "body(value=NodeRef(body=body:" + JSON.stringify(body) + ", node=n:0))";
  const domains = [
    ["native", "TypeTable(terms=[primitive(primitive=", ")], signatures=[])",
      ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
        "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"],
      { terms: [{ kind: "primitive", primitive: "bool" }], signatures: [] }],
    ["intrinsic", "TypeTable(terms=[intrinsic(intrinsic=", ")], signatures=[])",
      ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol", "alias-marker"],
      { terms: [{ kind: "intrinsic", intrinsic: "any" }], signatures: [] }],
    ["member kind", 'TypeTable(terms=[shape(members=[Member(key=text(value="x"), origins=[], readOrigins=[], writeOrigins=[], kind=',
      ", read=null, write=null, optional=false, readonly=false)], indexes=[], calls=[], constructs=[])], signatures=[])",
      ["property", "method", "accessor"], { terms: [{ kind: "shape", members: [{
        key: { kind: "text", value: "x" }, origins: [], readOrigins: [], writeOrigins: [],
        kind: "property", read: null, write: null, optional: false, readonly: false,
      }], indexes: [], calls: [], constructs: [] }], signatures: [] }],
    ["signature kind", "TypeTable(terms=[], signatures=[Signature(id=sig:0, declaration=null, owner=null, composition=null, kind=",
      ", typeParameters=[], receiver=null, parameters=[], result=t:0)])", ["call", "construct"], row("call")],
    ["parameter kind", beforeParameter + "kind=",
      ', type=t:0, passing="by-value", initializer=null, acceptsOmission=false' + afterParameter,
      ["required", "optional", "default", "rest"], row("call", [parameter])],
    ["tuple kind", "TypeTable(terms=[tuple(elements=[TupleElement(kind=",
      ", type=t:0, declaration=null)], readonly=false)], signatures=[])",
      ["required", "optional", "rest", "variadic"], { terms: [{ kind: "tuple", elements: [
        { kind: "required", type: 0, declaration: null }], readonly: false }], signatures: [] }],
    ["passing", beforeParameter + 'kind="required", type=t:0, passing=', ", initializer=null, acceptsOmission=false" + afterParameter,
      ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"],
      row("call", [parameter])],
    ["extent base", "TypeTable(terms=[fixed-array(element=t:0, extent=FixedExtent(length=1n, runtimeBase=",
      "))], signatures=[])", ["number", "bigint"], { terms: [{ kind: "fixed-array", element: 0,
        extent: { length: 1n, runtimeBase: "number" } }], signatures: [] }],
    ["facet", "TypeTable(terms=[declared(definition=def:" + JSON.stringify(owner) + ", arguments=[], facet=",
      ", extent=null)], signatures=[])", ["instance", "value"], { terms: [{ kind: "declared", definition: owner,
        arguments: [], facet: "instance", extent: null }], signatures: [] }],
    ["sum origin", "TypeTable(terms=[projection(source=t:0, projection=component(component=TypeComponent(root=" + root
      + ", path=[sum-arm(family=SumFamily(origin=", ", component=TypeComponent(root=" + root
      + ", path=[]), parameters=[], roles=[]), index=0)])))], signatures=[])",
      ["authored", "inferred"], { terms: [{ kind: "projection", source: 0, projection: { kind: "component",
        component: { root: source, path: [{ kind: "sum-arm", family: { origin: "authored",
          component: { root: source, path: [] }, parameters: [], roles: [] }, index: 0 }] } } }], signatures: [] }],
  ];
  for (const [name, prefix, suffix, choices, expected] of domains) {
    for (const token of ['"z', '"z\\q"', '"\\u007A\\q"']) {
      const text = prefix + token + (token === '"z' ? "" : suffix);
      test("closed quoted " + name + " rejects its first impossible decoded prefix: " + token, () =>
        assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, choices)));
    }
    const first = choices[0].slice(0, 1);
    const malformed = prefix + '"' + first + '\\q"' + suffix;
    test("still-possible quoted " + name + " keeps its lexical escape refusal", () =>
      assert.deepEqual(parseTypes(malformed), invalidText(malformed, prefix.length, ["JSON string"])));
    const unfinished = prefix + '"' + first;
    test("still-possible quoted " + name + " keeps its unfinished quote refusal", () =>
      assert.deepEqual(parseTypes(unfinished), invalidText(unfinished, unfinished.length, ['"'])));
    const escaped = '"\\u' + first.charCodeAt(0).toString(16).padStart(4, "0") + choices[0].slice(1) + '"';
    test("closed quoted " + name + " accepts its complete escaped spelling", () =>
      assert.deepEqual(parseTypes(prefix + escaped + suffix), { kind: "parsed", value: expected }));
  }
  const numeric = 'TypeTable(terms=[literal(value=number(value=ExactRational(numerator=';
  const suffix = ", denominator=1n, negativeZero=false)), base=t:0)], signatures=[])";
  const scalarKinds = [
    ["number", "TypeTable(terms=[open(group=group:" + JSON.stringify(encodeGroupId([body])) + ", variable=",
      ")], signatures=[])", ["number"]],
    ["bigint", numeric, suffix, ["bigint"]],
    ["boolean", "TypeTable(terms=[array(element=t:0, readonly=", ")], signatures=[])", ["boolean"]],
  ];
  for (const [name, prefix, ending, expected] of scalarKinds) for (const token of ['"', '"bad\\q"']) {
    const text = prefix + token + (token === '"' ? "" : ending);
    test("unqualified " + name + " rejects the opening string kind before later text: " + token, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected)));
  }
  for (const token of ["1e999", "1.2e999", "-1e+", "NaN", "+Infinity", "-Infinity"]) {
    const text = numeric + token + suffix;
    test("bigint payload kind precedes its later numeric-token failure " + token, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, numeric.length, ["bigint"])));
  }
  for (const token of ["00.1", "-e+"]) {
    const text = numeric + token + suffix;
    test("bigint payload preserves its earlier malformed integer prefix " + token, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, numeric.length, ["finite number", "bigint"])));
  }
  test("bigint payload retains its independently expected complete literal", () =>
    assert.deepEqual(parseTypes(numeric + "1n" + suffix), { kind: "parsed", value: {
      terms: [{ kind: "literal", value: { kind: "number", value: rational(1n) }, base: 0 }], signatures: [],
    } }));
  const mixed = [
    ["first numeric-kind opening quote before later field", "TypeTable(terms=[array(element=", 't:"bad\\q"',
      ", other=false)], signatures=[])", ["number"]],
    ["first field deviation before numeric-kind opening quote", "TypeTable(terms=[array(el", "X",
      'ment=t:"bad\\q", readonly=false)], signatures=[])', ["element"]],
    ["first numeric durable payload before later field", "TypeTable(terms=[enum(definition=", "def:1e999",
      ", extra=0)], signatures=[])", ["canonical definition identity"]],
    ["first quoted field deviation before durable payload", 'TypeTable(terms=[enum("defi', "X",
      'ition"=def:1e999)], signatures=[])', ["definition"]],
    ["first impossible closed choice before later field", "TypeTable(terms=[primitive(primitive=", '"z\\q"',
      ", extra=0)], signatures=[])", domains[0][3]],
    ["first quoted field deviation before closed choice", 'TypeTable(terms=[primitive("primi', "X",
      'ive"="z\\q")], signatures=[])', ["primitive"]],
    ["first still-possible choice escape before field", "TypeTable(terms=[intrinsic(intrinsic=", '"ne\\q"',
      ", extra=0)], signatures=[])", ["JSON string"]],
    ["first arbitrary string escape before typed value", "TypeTable(terms=[literal(value=string(value=", '"bad\\q"',
      "), base=t:0), array(element=t:0, readonly=0)], signatures=[])", ["JSON string"]],
    ["first typed value before arbitrary string escape", "TypeTable(terms=[array(element=t:0, readonly=", "0",
      '), literal(value=string(value="bad\\q"), base=t:0)], signatures=[])', ["boolean"]],
  ];
  for (const [name, prefix, token, suffix, expected] of mixed) {
    const text = prefix + token + suffix;
    test("same-token typed and later error order: " + name, () =>
      assert.deepEqual(parseTypes(text), invalidText(text, prefix.length, expected)));
  }
}

test("a genuine typed component cycle is rejected before the owned arena changes", () => {
  const interner = createTypeInterner();
  assert.equal(insertFixtureType(product, interner, primitive), 0);
  const component = { root: source, path: [] };
  component.path.push({ kind: "sum-arm", family: { origin: "authored", component, parameters: [], roles: [] }, index: 0 });
  const row = { kind: "projection", source: 0, projection: { kind: "component", component } };
  assert.throws(() => insertFixtureType(product, interner, row), { name: "TypeError", message: "Inline cycle at $.projection.component.path[0].family.component" });
  assert.deepEqual(readType(interner, 0), primitive);
});

// ---- Execution and DeclaredExecution keys (COMMON-DATA section 1; K-3367 D) -------------------------------------------
const keyBody = encodeBodyId({ owner, role: "function", ordinal: 0 });
const keySecondBody = encodeBodyId({ owner, role: "function", ordinal: 1 });
const boundAt = (index, type) => ({ kind: "bound", parameter: parameterDeclaration(owner, index), type });
const rigidAt = index => ({ kind: "rigid", parameter: parameterDeclaration(owner, index) });
const vectorOf = (families = {}) => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [], ...families });
const instantiated = families => ({ kind: "instantiated", bindings: vectorOf(families) });
const instanceOf = (bindings, body = keyBody) => ({ body, bindings });

test("sameInstance and instanceKey: equal body and complete bindings are one instance; any difference of body, kind or position is another", () => {
  const vector = { classBindings: [boundAt(0, 1)], methodBindings: [rigidAt(1)], capturedBindings: [boundAt(2, 3)], selfBindings: [{ kind: "bound", owner, type: 4 }] };
  assert.equal(sameInstance(instanceOf({ kind: "parametric" }), instanceOf({ kind: "parametric" })), true);
  assert.equal(sameInstance(instanceOf(instantiated(vector)), instanceOf(instantiated(structuredClone(vector)))), true, "structurally equal bindings");
  assert.equal(instanceKey(instanceOf(instantiated(vector))), instanceKey(instanceOf(instantiated(structuredClone(vector)))));
  assert.equal(sameInstance(instanceOf({ kind: "parametric" }), instanceOf({ kind: "parametric" }, keySecondBody)), false, "another body");
  assert.equal(sameInstance(instanceOf({ kind: "parametric" }), instanceOf(instantiated({}))), false, "parametric is not the empty binding");
  const unequal = [
    { classBindings: [boundAt(0, 2)] }, { classBindings: [rigidAt(0)] }, { methodBindings: [boundAt(1, 1)] },
    { capturedBindings: [boundAt(2, 9)] }, { selfBindings: [{ kind: "rigid", owner }] }, { classBindings: [boundAt(0, 1), boundAt(1, 1)] },
  ];
  for (const change of unequal) {
    assert.equal(sameInstance(instanceOf(instantiated(vector)), instanceOf(instantiated({ ...vector, ...change }))), false, JSON.stringify(change));
  }
});

test("instanceKey: a hole in each family is null at its own position, distinct from a binding there and from a shorter family", () => {
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const entry = family === "selfBindings" ? { kind: "rigid", owner } : rigidAt(0);
    const holed = [];
    holed[1] = entry;
    const withHole = instanceOf(instantiated({ [family]: holed }));
    const filled = instanceOf(instantiated({ [family]: [entry, entry] }));
    const shorter = instanceOf(instantiated({ [family]: [entry] }));
    const shifted = [entry];
    shifted[2] = entry;
    assert.equal(sameInstance(withHole, instanceOf(instantiated({ [family]: holed.slice() }))), true, `${family}: equal holes`);
    assert.equal(sameInstance(withHole, filled), false, `${family}: a hole is not a binding`);
    assert.equal(sameInstance(withHole, shorter), false, `${family}: a hole keeps its position`);
    assert.equal(sameInstance(withHole, instanceOf(instantiated({ [family]: shifted }))), false, `${family}: holes at other positions`);
  }
});

test("bindingVectorKey and artifactBindingsKey: keys of bare bindings on the same projection as the instance key (W2 E-1)", () => {
  const vector = { classBindings: [boundAt(0, 1)], methodBindings: [rigidAt(1)], capturedBindings: [], selfBindings: [{ kind: "rigid", owner }] };
  assert.equal(bindingVectorKey(vector), bindingVectorKey(structuredClone(vector)), "equal vectors, equal keys");
  for (const change of [{ classBindings: [boundAt(0, 2)] }, { methodBindings: [] }, { capturedBindings: [rigidAt(0)] }, { selfBindings: [{ kind: "bound", owner, type: 1 }] }]) {
    assert.notEqual(bindingVectorKey({ ...vector, ...change }), bindingVectorKey(vector), JSON.stringify(change));
  }
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const entry = family === "selfBindings" ? { kind: "rigid", owner } : rigidAt(0);
    const holed = [];
    holed[1] = entry;
    assert.equal(bindingVectorKey(vectorOf({ [family]: holed })), bindingVectorKey(vectorOf({ [family]: holed.slice() })), `${family}: equal holes`);
    assert.notEqual(bindingVectorKey(vectorOf({ [family]: holed })), bindingVectorKey(vectorOf({ [family]: [entry, entry] })), `${family}: a hole is not a binding`);
    assert.notEqual(bindingVectorKey(vectorOf({ [family]: holed })), bindingVectorKey(vectorOf({ [family]: [entry] })), `${family}: a hole keeps its position`);
  }
  assert.equal(artifactBindingsKey({ kind: "parametric" }), artifactBindingsKey({ kind: "parametric" }));
  assert.notEqual(artifactBindingsKey({ kind: "parametric" }), artifactBindingsKey(instantiated({})), "parametric is not the empty binding");
  assert.equal(artifactBindingsKey(instantiated(vector)), artifactBindingsKey(instantiated(structuredClone(vector))));
  assert.deepEqual(bindingVectorData(vector), [[["bound", parameterDeclaration(owner, 0), 1]], [["rigid", parameterDeclaration(owner, 1)]], [], [["rigid", owner]]]);
  assert.deepEqual(artifactBindingsData({ kind: "parametric" }), ["parametric"]);
  assert.deepEqual(artifactBindingsData(instantiated(vector)), ["instantiated", bindingVectorData(vector)]);
  assert.equal(encodeKey(bindingVectorData(vector)), bindingVectorKey(vector));
  assert.equal(encodeKey(artifactBindingsData(instantiated(vector))), artifactBindingsKey(instantiated(vector)));
  assert.notEqual(artifactBindingsKey(instantiated(vector)), artifactBindingsKey(instantiated({ ...vector, classBindings: [boundAt(0, 2)] })));
  const pairs = [[{ kind: "parametric" }, { kind: "parametric" }], [{ kind: "parametric" }, instantiated({})], [instantiated(vector), instantiated(structuredClone(vector))],
    [instantiated(vector), instantiated({ ...vector, methodBindings: [] })]];
  for (const [left, right] of pairs) {
    assert.equal(sameInstance(instanceOf(left), instanceOf(right)), artifactBindingsKey(left) === artifactBindingsKey(right), JSON.stringify([left, right]));
  }
});

test("a paid binding key uses the same canonical row projection without acquiring an unpaid row", () => {
  const original = { classBindings: [boundAt(0, 1)], methodBindings: [rigidAt(1)],
    capturedBindings: [boundAt(2, 3)], selfBindings: [{ kind: "bound", owner, type: 4 }] };
  const names = Object.keys(original);
  const key = bindingVectorKey(original);
  for (let maximumWork = 0; maximumWork <= names.length; maximumWork += 1) {
    const account = createAccount({ maximumWork, maximumResultEntries: 0 });
    const reads = [];
    const vector = Object.fromEntries(names.map(name => {
      const rows = [...original[name]];
      Object.defineProperty(rows, 0, { get() { reads.push(name); return original[name][0]; } });
      return [name, rows];
    }));
    const result = product.readBindingVectorKey(vector, () => chargeWork(account, 1));
    assert.deepEqual(reads, names.slice(0, maximumWork));
    if (maximumWork === names.length) assert.deepEqual(result, { kind: "complete", key });
    else assert.equal(result === accountFailure(account), true);
  }
});

test("a substitution memo cannot assign a computed image to a second read of its bindings", () => {
  const storage = createTypeInterner();
  const parameter = parameterDeclaration(owner, 0);
  const term = product.internType(storage, { kind: "param", parameter });
  const first = product.internType(storage, { kind: "primitive", primitive: "bool" });
  const second = product.internType(storage, { kind: "primitive", primitive: "float64" });
  const root = insertFixtureType(product, storage, { kind: "array", element: term, readonly: false });
  const rows = new Array(1);
  const reads = [];
  const binding = {
    get kind() { reads.push("kind"); return "bound"; },
    get parameter() { reads.push("parameter"); return parameter; },
    get type() { reads.push("type"); return reads.filter(read => read === "type").length === 1 ? first : second; },
  };
  Object.defineProperty(rows, 0, { get() { reads.push("row"); return binding; } });
  const vector = { ...emptyBindings(), classBindings: rows };
  const work = product.createTypePublicationWork({ maximumWork: 0, maximumCreatedRecords: 100 });
  const stopped = substitute(storage, [root], vector, limits(), work);
  assert.deepEqual(stopped, { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.equal(substitute(storage, [root], vector, limits(), work) === stopped, true);
  assert.deepEqual(substitute(storage, [root], vector, limits({ maximumVisits: 0 }), fixtureTypeWork(product)),
    { kind: "resource-limit", dimension: "visits", maximum: 0 });
  assert.deepEqual(reads, []);
  const projected = substitute(storage, [root], vector, limits(), fixtureTypeWork(product));
  assert.equal(projected.kind, "complete");
  assert.deepEqual(readType(storage, projected.value[0]), { kind: "array", element: first, readonly: false });
  const otherImage = substitute(storage, [root], { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: second }] },
    limits(), fixtureTypeWork(product));
  assert.equal(otherImage.kind, "complete");
  assert.deepEqual(readType(storage, otherImage.value[0]), { kind: "array", element: second, readonly: false });
  assert.deepEqual(reads, ["row", "kind", "parameter", "type"]);
});

test("lexical support distinguishes nested signature binders, free outer references and foreign ones", () => {
  const inner = parameterDeclaration(other, 0);
  const outer = parameterDeclaration(owner, 0);
  const storage = createTypeInterner();
  const innerType = product.internType(storage, { kind: "param", parameter: inner });
  const outerType = product.internType(storage, { kind: "param", parameter: outer });
  const local = insertFixtureSignature(product, storage, signature({ typeParameters: [{ declaration: inner, constraint: null, default: null }], result: innerType }));
  const captured = insertFixtureSignature(product, storage, signature({ typeParameters: [{ declaration: inner, constraint: null, default: null }], result: outerType }));
  const callable = id => insertFixtureType(product, storage, { kind: "callable", calls: [id], constructs: [] });
  const sealed = callable(local);
  const open = callable(captured);
  const scope = { ...emptyScope(), methodParameters: [outer] };
  const table = viewTypes(storage);
  assert.deepEqual(product.readLexicalTypeSupport(table, [sealed], scope, fixtureTypeAdmission()), { kind: "complete", value: "independent" });
  assert.deepEqual(product.readLexicalTypeSupport(table, [open], scope, fixtureTypeAdmission()), { kind: "complete", value: "dependent" });
  assert.deepEqual(product.readLexicalTypeSupport(table, [innerType], scope, fixtureTypeAdmission()), { kind: "complete", value: "foreign" });
  assert.deepEqual(product.readLexicalTypeSupport(table, [999], scope, fixtureTypeAdmission()), { kind: "complete", value: "invalid" });
  const account = createAccount({ maximumWork: 0, maximumResultEntries: 100 });
  const unread = { get terms() { assert.fail("the original stop precedes a type table read"); } };
  const stop = product.readLexicalTypeSupport(unread, [open], scope,
    { work: count => chargeWork(account, count), retain: count => chargeResultEntries(account, count) });
  assert.equal(stop === accountFailure(account), true);
});

test("executionKey and declaredExecutionKey: the provided count is part of the key and is data only, never checked here", () => {
  const instance = instanceOf(instantiated({ classBindings: [boundAt(0, 1)] }));
  const key = provided => executionKey({ instance, provided });
  assert.equal(key(0), executionKey({ instance: structuredClone(instance), provided: 0 }), "zero is a provided count like any other");
  assert.notEqual(key(0), key(1));
  assert.notEqual(key(2), executionKey({ instance: instanceOf({ kind: "parametric" }), provided: 2 }), "the instance is part of the key");
  for (const provided of [7, -1, 1.5]) assert.equal(typeof key(provided), "string", `${provided}: no validation here`);
  assert.notEqual(key(1), instanceKey(instance), "an execution key is not its instance key");
  const request = { definition: owner, endpoint: "api-signature", ordinal: 0, bindings: { kind: "parametric" } };
  const declared = (change, provided = 1) => declaredExecutionKey({ request: { ...request, ...change }, provided });
  assert.equal(declared({}), declaredExecutionKey({ request: structuredClone(request), provided: 1 }));
  for (const change of [{ definition: definition("Other") }, { endpoint: "advertised" }, { ordinal: 1 }, { bindings: instantiated({}) }]) {
    assert.notEqual(declared(change), declared({}), JSON.stringify(change));
  }
  assert.notEqual(declared({}, 2), declared({}, 1));
});

test("signature request projection and key retain the complete endpoint and each binding position", () => {
  const bindings = instantiated({ classBindings: [boundAt(0, 1)], methodBindings: [rigidAt(1)],
    capturedBindings: [boundAt(2, 3)], selfBindings: [{ kind: "bound", owner, type: 4 }] });
  const request = { definition: owner, endpoint: "api-body", ordinal: 2, bindings };
  const expected = [owner, "api-body", 2, ["instantiated", [
    [["bound", parameterDeclaration(owner, 0), 1]], [["rigid", parameterDeclaration(owner, 1)]], [["bound", parameterDeclaration(owner, 2), 3]], [["bound", owner, 4]],
  ]]];
  assert.deepEqual(signatureRequestData(request), expected);
  assert.equal(signatureRequestKey(request), encodeKey(expected));
  assert.equal(signatureRequestKey(structuredClone(request)), signatureRequestKey(request));
  assert.deepEqual(signatureRequestData({ ...request, bindings: { kind: "parametric" } }),
    [owner, "api-body", 2, ["parametric"]]);
  for (const change of [{ definition: other }, { endpoint: "advertised" }, { endpoint: "api-signature" },
    { ordinal: 0 }, { bindings: { kind: "parametric" } }]) {
    assert.notEqual(signatureRequestKey({ ...request, ...change }), signatureRequestKey(request));
  }
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const entry = family === "selfBindings" ? { kind: "rigid", owner } : rigidAt(0);
    const holed = [];
    holed[1] = entry;
    const sparse = { ...request, bindings: instantiated({ [family]: holed }) };
    assert.notEqual(signatureRequestKey(sparse), signatureRequestKey({ ...request,
      bindings: instantiated({ [family]: [entry, entry] }) }), family);
    assert.notEqual(signatureRequestKey(sparse), signatureRequestKey({ ...request,
      bindings: instantiated({ [family]: [entry] }) }), family);
  }
  assert.equal(declaredExecutionKey({ request, provided: 1 }), encodeKey(["declared-execution", ...expected, 1]));
});

test("a produced type key preserves the qualified operator, canonical selector path and complete bindings", () => {
  const owner = definition("typeOperator");
  const parameter = parameterDeclaration(owner, 0);
  const request = {
    component: { root: { kind: "item", value: { owner, node: 7 } }, path: [{ kind: "tuple-element", index: 1 }] },
    bindings: { classBindings: [{ kind: "bound", parameter, type: 4 }], methodBindings: [], capturedBindings: [], selfBindings: [] },
  };
  const expected = [["item", owner, 7], [["tuple-element", 1]], [[["bound", parameter, 4]], [], [], []]];
  assert.deepEqual(typeProductionRequestData(request), expected);
  assert.deepEqual(typeProductionRequestData(structuredClone(request)), expected);
  const other = definition("foreignTypeOperator");
  const variants = [
    { ...request, component: { ...request.component, root: { kind: "item", value: { owner: other, node: 7 } } } },
    { ...request, component: { ...request.component, root: { kind: "body", value: { body, node: 7 } } } },
    { ...request, component: { ...request.component, path: [] } },
    { ...request, bindings: { ...request.bindings, classBindings: [{ kind: "rigid", parameter }] } },
    { ...request, bindings: { ...request.bindings, classBindings: [{ kind: "bound", parameter, type: 5 }] } },
  ];
  assert.equal(new Set([request, ...variants].map(value => encodeKey(typeProductionRequestData(value)))).size, 6);
});

test("the complete real ir-types owner compiles against freshly emitted actual allowed dependency declarations", async () => {
  const areas = JSON.parse(readFileSync(process.env.TSONIC_HOST_QUARANTINE_AREAS
    ?? resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const module = hostCatalogue.find(module => module.name === "ir-types");
  const own = ["contract", "data", "native-facts-data", ...productNames]
    .map(name => `packages/host/src/ir-types/${name}.ts`);
  const ids = readdirSync(resolve(repository, "packages/host/src/ids")).filter(path => path.endsWith(".ts"))
    .map(path => `packages/host/src/ids/${path}`);
  const diag = readdirSync(resolve(repository, "packages/host/src/diag")).filter(path => path.endsWith(".ts"))
    .map(path => `packages/host/src/diag/${path}`);
  let retainedStage = null;
  const deps = { ...isolationDeps(tooling, areas.areas.map(area => area.directory)),
    discard: stage => { retainedStage = stage; } };
  const report = await compileIsolated(deps, module,
    { root: repository, sourceFiles: own,
      interfaceSources: ["packages/host/src/ids/contract.ts", "packages/host/src/ids/index.ts", "packages/host/src/diag/contract.ts", "packages/host/src/diag/index.ts"],
      declarationSources: [...ids, ...diag], outputDirectory: ".temp/ir-types-isolation" });
  writeFileSync(resolve(retainedStage, "compiler-output.log"), report.diagnostics.join("\n"));
  writeFileSync(resolve(retainedStage, "isolation-receipt.json"), `${JSON.stringify({ retainedStage, ...report }, null, 2)}\n`);
  assert.equal(report.status, "passed", report.diagnostics.join("\n").slice(-8000));
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.loadedInventory.filter(path => !report.expectedInventory.includes(path)), []);
  assert.equal(report.loadedInventory.some(path => path.includes("/isolated/") && path.endsWith("/ids/index.d.ts")), true);
  assert.equal(report.loadedInventory.some(path => path.includes("/isolated/") && path.endsWith("/ids/index.ts")), false);
  assert.deepEqual(report.sourceInventory.map(entry => relative(repository, entry.path)).sort(), [...own, ...ids, ...diag].sort());
});

test("fresh public declarations admit real strict readers and reject the entire readonly mutation vector", () => {
  const parent = resolve(repository, ".temp/ir-types-declaration-consumer");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  let invocation = 0;
  const run = project => {
    const result = spawnSync(process.execPath, [compiler, "--project", project, "--pretty", "false"],
      { cwd: repository, encoding: "utf8", maxBuffer: 4194304, timeout: 90000 });
    writeFileSync(resolve(stage, `compiler-${++invocation}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}${result.error === undefined ? "" : `\n${result.error.message}\n`}`);
    if (result.error !== undefined) throw result.error;
    assert.equal(result.signal, null, "the admitted compiler exits normally");
    return { status: result.status, diagnostics: result.stdout + result.stderr };
  };
  const write = (path, value) => writeFileSync(resolve(stage, path), typeof value === "string" ? value : JSON.stringify(value));
  write("package.json", { type: "module", private: true });
  write("producer.json", { extends: resolve(repository, "packages/host/tsconfig.json"), compilerOptions: {
    noEmit: false, declaration: true, declarationMap: false, sourceMap: false, emitDeclarationOnly: true, noEmitOnError: true,
    types: [], rootDir: resolve(repository, "packages/host/src"), outDir: resolve(stage, "declarations") },
    files: [resolve(repository, "packages/host/src/ir-types/index.ts"), resolve(repository, "packages/host/src/dataflow/account.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "producer.json")), { status: 0, diagnostics: "" });
  write("graph-reader.ts", 'import { admitTypePublicationStep, createTypePublicationWork, internTypeGraph } from "./declarations/ir-types/index.js";\nimport type { AdmitTypePublicationStep, TypeInterner, TypeGraphInput, TypeGraphResult, TypePublicationLimits, TypePublicationWork } from "./declarations/ir-types/contract.js";\nexport const admit: AdmitTypePublicationStep = admitTypePublicationStep;\nexport function insert(types: TypeInterner, input: TypeGraphInput, limits: TypePublicationLimits): TypeGraphResult { const work: TypePublicationWork = createTypePublicationWork(limits); return admit(work) ?? internTypeGraph({ types, work }, input); }\n');
  write("graph-consumer.json", { extends: resolve(repository, "tsconfig.base.json"), compilerOptions: {
    noEmit: true, types: [], skipLibCheck: false, strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true },
    files: [resolve(stage, "graph-reader.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "graph-consumer.json")), { status: 0, diagnostics: "" });
  write("graph-reader.ts", 'import { internTypeGraph } from "./declarations/ir-types/index.js";\nimport type { TypeInterner, TypeGraphInput, TypePublicationWork } from "./declarations/ir-types/contract.js";\nexport function forbidden(types: TypeInterner, input: TypeGraphInput, work: TypePublicationWork): void { const old: TypePublicationWork = { maximumWork: 1, maximumCreatedRecords: 1, work: 0, createdRecords: 0 }; internTypeGraph({ types }, input); work.work = 0; work.createdRecords = 0; work.maximumWork = 2; work.usedWork; void old; }\n');
  const invalidGraph = run(resolve(stage, "graph-consumer.json"));
  assert.equal(invalidGraph.status, 1, invalidGraph.diagnostics.slice(-8000));
  assert.equal([...invalidGraph.diagnostics.matchAll(/error TS(\d+):/gu)].length, 6, invalidGraph.diagnostics.slice(-8000));
  write("index-reader.ts", 'import { compareIndexSignatures, compareMemberKeys, encodeSelectorPath } from "./declarations/ir-types/index.js";\nimport type { CompareIndexSignatures, CompareMemberKeys, ComponentSelector, EncodeSelectorPath, IndexSignature, MemberTypeRequest, MemberTypes } from "./declarations/ir-types/contract.js";\nexport const compare: CompareIndexSignatures = compareIndexSignatures;\nexport const compareMembers: CompareMemberKeys = compareMemberKeys;\nexport const encode: EncodeSelectorPath = encodeSelectorPath;\nexport function selector(index: IndexSignature): ComponentSelector { return { kind: "index-value", origin: index.origin, key: index.key }; }\nexport function memberResult(request: MemberTypeRequest, value: MemberTypes): number | null { return request.member === 0 ? value.read : value.write; }\n');
  write("index-consumer.json", { extends: resolve(repository, "tsconfig.base.json"), compilerOptions: {
    noEmit: true, types: [], skipLibCheck: false, strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true },
    files: [resolve(stage, "index-reader.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "index-consumer.json")), { status: 0, diagnostics: "" });
  write("index-reader.ts", 'import { compareMemberKeys } from "./declarations/ir-types/index.js";\nimport type { ComponentSelector, IndexSignature, MemberTypeRequest, MemberTypes } from "./declarations/ir-types/contract.js";\nexport function removed(index: IndexSignature): void { index.declaration; index.origin = index.origin; }\nexport const removedSelector: ComponentSelector = { kind: "index-key", declaration: "retired" };\nexport function wrongMember(request: MemberTypeRequest, value: MemberTypes): void { request.member = 1; value.read = null; compareMemberKeys("spelling", "spelling"); }\n');
  const invalidIndex = run(resolve(stage, "index-consumer.json"));
  assert.equal(invalidIndex.status, 1, invalidIndex.diagnostics.slice(-8000));
  assert.deepEqual([...invalidIndex.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2339, 2540, 2353, 2540, 2540, 2345], invalidIndex.diagnostics.slice(-8000));
  write("index-reader.ts", 'import type { TypeParameter, TypeParameterIdentity } from "./declarations/ir-types/contract.js";\nexport type Removed = TypeParameterIdentity;\nexport function retired(parameter: TypeParameter): void { parameter.identity; parameter.declaration = parameter.declaration; }\n');
  const invalidParameter = run(resolve(stage, "index-consumer.json"));
  assert.equal(invalidParameter.status, 1, invalidParameter.diagnostics.slice(-8000));
  assert.deepEqual([...invalidParameter.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2305, 2339, 2540], invalidParameter.diagnostics.slice(-8000));
  write("index-reader.ts", "export {};\n");
  const imports = 'import type { TypeTable, TypePublication, TypePublicationLimits, TypePublicationResult, TypeInterner, ExportTypes, TypeExpansionLimits, BindingScope, BindingVector, Signature, TypeEvidence, TypeVerificationInput, NominalDefinition } from "./declarations/ir-types/contract.js";\nimport type { DefId, TyId } from "./declarations/ids/contract.js";\n';
  write("reader.ts", imports + 'export function read(table: TypeTable, publication: TypePublication, limits: TypeExpansionLimits, scope: BindingScope, bindings: BindingVector, signature: Signature, evidence: TypeEvidence, parameter: DefId, definition: DefId, type: TyId, input: TypeVerificationInput, nominal: NominalDefinition): number { return table.terms.length + publication.table.terms.length + publication.types.length + publication.signatures.length + limits.maximumDepth + scope.selfOwners.length + bindings.classBindings.length + signature.parameters.length + evidence.type + parameter.length + definition.length + type + (nominal.kind === "merged-interface" ? nominal.definitions.length + nominal.slots.length : nominal.kind === "alias" ? nominal.parameterCount : nominal.facets.length) + (input.nominalOf(definition) === null ? 0 : 1); }\nexport function publish(operation: ExportTypes, interner: TypeInterner, limits: TypePublicationLimits): TypePublicationResult { return operation(interner, limits); }');
  write("inline-reader.ts", "import type { CategoryEvidence, TypeComponent, ComponentSelector, TypeInterner, TypeTerm, Signature, TypeTable, ReadType, ReadSignature } from \"./declarations/ir-types/contract.js\";\nimport type { SourceNodeRef, TyId, SigId } from \"./declarations/ids/contract.js\";\nexport function checkedBoundary(readType: ReadType, readSignature: ReadSignature, interner: TypeInterner, type: TyId, signature: SigId): void { readType(interner, type); readSignature(interner, signature); }\nexport function sparseTable(): TypeTable {\n  return { terms: new Array<TypeTerm>(1), signatures: new Array<Signature>(1) };\n}\nexport function sparseComponent(root: SourceNodeRef): TypeComponent {\n  return { root, path: new Array<ComponentSelector>(1) };\n}\nexport function categoryCycle(): CategoryEvidence { const alternatives: CategoryEvidence[] = []; const value: CategoryEvidence = { kind: \"choice\", alternatives }; alternatives.push(value); return value; }\nexport function componentCycle(root: SourceNodeRef): TypeComponent { const path: ComponentSelector[] = []; const component: TypeComponent = { root, path }; path.push({ kind: \"sum-arm\", family: { origin: \"authored\", component, parameters: [], roles: [] }, index: 0 }); return component; }\n");
  write("seed-reader.ts", 'import { admitTypeTable, readType, readSignature, projectBindingValues, substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { AdmitTypeTable, TypeTableAdmissionWork, TypePublicationWork, TypePublicationStop, BindingValues, ProjectedBindingValues, TypeInterner, TypeTable, TypeTerm, Signature, Substitute, SubstituteSignature, TypeTransform, BindingVector, TypeExpansionLimits, TypePublicationResult } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nimport type { DataflowStop } from "./declarations/dataflow/account.js";\nexport const seed: AdmitTypeTable = admitTypeTable;\nexport const signatureRoot: SubstituteSignature = substituteSignature;\nexport const typeRoots: Substitute = substitute;\nexport function seeded(table: TypeTable, type: TyId, signature: SigId, work: TypeTableAdmissionWork<TypePublicationStop>): readonly [TypeInterner, TypeTerm, Signature] | null { const admitted = seed(table, work); if (admitted.kind !== "complete") return null; const interner = admitted.types; return [interner, readType(interner, type), readSignature(interner, signature)]; }\nexport function transform(interner: TypeInterner, signatures: readonly SigId[], bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork): TypeTransform<readonly SigId[]> | TypePublicationStop { return signatureRoot(interner, signatures, bindings, limits, "lexical", work); }\nexport function transformTypes(interner: TypeInterner, types: readonly TyId[], bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork): TypeTransform<readonly TyId[]> | TypePublicationStop { return typeRoots(interner, types, bindings, limits, work); }\nexport function borrow(interner: TypeInterner, types: readonly TyId[], bindings: BindingVector, limits: TypeExpansionLimits, work: TypeTableAdmissionWork<DataflowStop | TypePublicationStop>): TypeTransform<readonly TyId[]> | DataflowStop | TypePublicationStop { return substitute(interner, types, bindings, limits, work); }\nexport function project(interner: TypeInterner, values: BindingValues, bindings: BindingVector, limits: TypeExpansionLimits, work: TypeTableAdmissionWork<DataflowStop>): TypeTransform<ProjectedBindingValues> | DataflowStop { return projectBindingValues(interner, values, bindings, limits, work); }\nexport function usage(result: TypePublicationResult): readonly [number, number] | null { return result.kind === "complete" ? [result.work, result.createdRecords] : null; }\n');
  write("binding-reader.ts", 'import { verifyBindings } from "./declarations/ir-types/index.js";\nimport type { BindingVerificationInput } from "./declarations/ir-types/contract.js";\nexport function check(inputs: readonly BindingVerificationInput[], stop: { readonly kind: "original"; readonly cause: string }): string { const result = verifyBindings(inputs, 1, () => stop); return result.kind === "resource-stop" ? result.stop.cause : String(result.violations.length); }\n');
  write("consumer.json", { extends: resolve(repository, "tsconfig.base.json"), compilerOptions: {
    noEmit: true, types: [], skipLibCheck: false, exactOptionalPropertyTypes: true },
    files: [resolve(stage, "reader.ts"), resolve(stage, "inline-reader.ts"), resolve(stage, "seed-reader.ts"), resolve(stage, "binding-reader.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "consumer.json")), { status: 0, diagnostics: "" });
  write("reader.ts", imports + 'export function mutate(table: TypeTable, publication: TypePublication, limits: TypeExpansionLimits, scope: BindingScope, bindings: BindingVector, signature: Signature, evidence: TypeEvidence, parameter: DefId, definition: DefId, type: TyId, input: TypeVerificationInput, nominal: NominalDefinition): void {\ntable.terms.push({ kind: "error" });\ntable.terms[0] = { kind: "error" };\ntable.signatures[0] = signature;\nlimits.maximumDepth = 1;\nscope.selfOwners.push(definition);\nbindings.classBindings[0] = { kind: "rigid", parameter };\nsignature.parameters.push({ declaration: definition, kind: "required", type, passing: "by-value", initializer: null, acceptsOmission: false });\nevidence.type = type;\nif (nominal.kind === "declared" || nominal.kind === "enum") nominal.facets.push("instance");\ninput.nominalOf = () => null;\npublication.table = { terms: [], signatures: [] };\npublication.types.push(type);\npublication.signatures[0] = signature.id;\npublication.terms.push({ kind: "error" });\n}\nexport function removed(operation: ExportTypes, interner: TypeInterner, limits: TypePublicationLimits, result: TypePublicationResult, publication: TypePublication): void {\noperation(interner);\nresult.table;\nlimits.maximumWork = 1;\nlimits.maximumCreatedRecords = 1;\nif (result.kind === "complete") result.value = publication;\nelse { result.dimension = "work"; result.maximum = 1; }\nresult.kind = "complete";\n}');
  write("binding-reader.ts", 'import { verifyBindings } from "./declarations/ir-types/index.js";\nimport type { BindingVerificationInput } from "./declarations/ir-types/contract.js";\nexport function removed(inputs: readonly BindingVerificationInput[]): void { verifyBindings(inputs, 1, () => true); verifyBindings(inputs, 1, () => false); verifyBindings(inputs, 1); }\n');
  const negative = run(resolve(stage, "consumer.json"));
  assert.equal(negative.status, 1, negative.diagnostics.slice(-8000));
  assert.deepEqual([...negative.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2322, 2322, 2554, 2339, 2542, 2542, 2540, 2339, 2542, 2339, 2540, 2339, 2540, 2540, 2339, 2542, 2339,
      2554, 2339, 2540, 2540, 2540, 2540, 2540, 2540], negative.diagnostics.slice(-8000));
  write("reader.ts", "export {};\n");
  write("binding-reader.ts", "export {};\n");
  write("seed-reader.ts", 'import { admitTypeTable, seedTypeInterner, internSignature, substituteBindingValues, substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { TypeTable, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationResult, TypePublication } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nexport function forbidden(table: TypeTable, interner: TypeInterner, type: TyId, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits): void { admitTypeTable(table); admitTypeTable(table, { maximumWork: 1 }); void seedTypeInterner; void internSignature; void substituteBindingValues; substituteSignature(interner, [signature], bindings, limits, "lexical"); substitute(interner, [type], bindings, limits); }\nexport function missingBoth(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication }; }\nexport function missingCreated(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication, work: 0 }; }\nexport function missingWork(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication, createdRecords: 0 }; }\nexport function frozen(result: TypePublicationResult): void { if (result.kind === "complete") { result.work = 1; result.createdRecords = 1; } }\n');
  const invalidSeed = run(resolve(stage, "consumer.json"));
  assert.equal(invalidSeed.status, 1, invalidSeed.diagnostics.slice(-8000));
  assert.deepEqual([...invalidSeed.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2724, 2305, 2305, 2554, 2353, 2554, 2554, 2322, 2322, 2322, 2540, 2540], invalidSeed.diagnostics.slice(-8000));
  assert.equal(invalidSeed.diagnostics.includes("TS2724:") && invalidSeed.diagnostics.includes("no exported member named 'seedTypeInterner'"), true);
  for (const name of ["internSignature", "substituteBindingValues"])
    assert.equal(invalidSeed.diagnostics.includes("no exported member '" + name + "'"), true, name);
  write("seed-reader.ts", 'import { substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationWork } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nexport function forbidden(interner: TypeInterner, type: TyId, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits, work: TypePublicationWork): void {\nsubstitute(interner, type, bindings, limits, work);\nsubstituteSignature(interner, signature, bindings, limits, "lexical", work);\nsubstitute(interner, [signature], bindings, limits, work);\nsubstituteSignature(interner, [type], bindings, limits, "lexical", work);\nconst result = substitute(interner, [type], bindings, limits, work);\nif (result.kind === "complete") { result.value[0] = type; result.value.push(type); }\n}\n');
  const invalidBatch = run(resolve(stage, "consumer.json"));
  assert.equal(invalidBatch.status, 1, invalidBatch.diagnostics.slice(-8000));
  assert.deepEqual([...invalidBatch.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2345, 2345, 2322, 2322, 2542, 2339], invalidBatch.diagnostics.slice(-8000));
  write("seed-reader.ts", 'import { internType } from "./declarations/ir-types/index.js";\nimport type { TypeInterner } from "./declarations/ir-types/contract.js";\nconst fabricated = { identityKind: "type-interner", terms: [], signatures: [], typeKeys: new Map(), signatureKeys: new Map(), substitutions: new Map() };\nexport const forbidden: TypeInterner = fabricated;\nexport function inaccessible(interner: TypeInterner): void {\n  internType(fabricated, { kind: "string" });\n  interner.table;\n  interner.terms;\n}\n');
  const invalidOwner = run(resolve(stage, "consumer.json"));
  assert.equal(invalidOwner.status, 1, invalidOwner.diagnostics.slice(-8000));
  assert.deepEqual([...invalidOwner.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2739, 2739, 2341, 2576], invalidOwner.diagnostics.slice(-8000));
  write("view-reader.ts", 'import { viewTypes } from "./declarations/ir-types/index.js";\nimport type { TypeInterner, TypeTable, ViewTypes } from "./declarations/ir-types/contract.js";\nexport const operation: ViewTypes = viewTypes;\nexport function current(interner: TypeInterner): TypeTable { return operation(interner); }\n');
  write("view-consumer.json", { extends: resolve(repository, "tsconfig.base.json"), compilerOptions: {
    noEmit: true, types: [], skipLibCheck: false, strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true },
    files: [resolve(stage, "view-reader.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "view-consumer.json")), { status: 0, diagnostics: "" });
  write("view-reader.ts", 'import { viewTypes } from "./declarations/ir-types/index.js";\nimport type { TypeInterner } from "./declarations/ir-types/contract.js";\nexport function forbidden(interner: TypeInterner): void {\nconst table = viewTypes(interner);\ntable.terms = [];\ntable.terms.push({ kind: "error" });\ntable.terms[0] = { kind: "error" };\ntable.signatures = [];\ntable.signatures.push(table.signatures[0]!);\n}\n');
  const invalidView = run(resolve(stage, "view-consumer.json"));
  assert.equal(invalidView.status, 1, invalidView.diagnostics.slice(-8000));
  assert.deepEqual([...invalidView.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2540, 2339, 2542, 2540, 2339], invalidView.diagnostics.slice(-8000));
  write("view-reader.ts", 'import { constantReferenceKey } from "./declarations/ir-types/index.js";\nimport type { DefId } from "./declarations/ids/contract.js";\nimport type { ArtifactBindings, BodyInstance, ConstantReference, ConstantReferenceKey, SignatureEndpoint, SignatureRequest } from "./declarations/ir-types/contract.js";\nexport const key: ConstantReferenceKey = constantReferenceKey;\nexport function initializerReference(initializer: BodyInstance, context: "compile-time" | "fixed-array-extent"): ConstantReference { return { initializer, context }; }\nexport function enumReference(member: DefId, bindings: ArtifactBindings): ConstantReference { return { context: "enum-member", member, bindings }; }\nexport function endpoint(request: SignatureRequest): SignatureEndpoint { return request.endpoint; }\n');
  assert.deepEqual(run(resolve(stage, "view-consumer.json")), { status: 0, diagnostics: "" });
  write("view-reader.ts", 'import type { BodyInstance, ConstantReference, SignatureEndpoint } from "./declarations/ir-types/contract.js";\nexport function forbidden(initializer: BodyInstance, reference: ConstantReference): void {\nconst old: ConstantReference = { initializer };\nconst wrong: ConstantReference = { initializer, context: "requester" };\nconst unqualified: ConstantReference = { initializer, context: "enum-member" };\nconst endpoint: SignatureEndpoint = "initializer";\nreference.context = "compile-time";\nvoid old; void wrong; void unqualified; void endpoint;\n}\n');
  const invalidReference = run(resolve(stage, "view-consumer.json"));
  assert.equal(invalidReference.status, 1, invalidReference.diagnostics.slice(-8000));
  assert.deepEqual([...invalidReference.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2322, 2322, 2353, 2322, 2540], invalidReference.diagnostics.slice(-8000));
  write("view-reader.ts", 'import type { SignatureParameter } from "./declarations/ir-types/contract.js";\nexport function selected(parameter: SignatureParameter, acceptsOmission: boolean): SignatureParameter { return { ...parameter, kind: "required", initializer: null, acceptsOmission }; }\n');
  assert.deepEqual(run(resolve(stage, "view-consumer.json")), { status: 0, diagnostics: "" });
  write("view-reader.ts", 'import type { SignatureParameter } from "./declarations/ir-types/contract.js";\nexport function forbidden(parameter: SignatureParameter): void {\nconst { acceptsOmission, ...incomplete } = parameter;\nconst old: SignatureParameter = incomplete;\nparameter.acceptsOmission = false;\nconst wrong: SignatureParameter = { ...parameter, acceptsOmission: "true" };\nvoid old; void wrong; void acceptsOmission;\n}\n');
  const invalidOmission = run(resolve(stage, "view-consumer.json"));
  assert.equal(invalidOmission.status, 1, invalidOmission.diagnostics.slice(-8000));
  assert.deepEqual([...invalidOmission.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2741, 2540, 2322], invalidOmission.diagnostics.slice(-8000));
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/ir-types/contract.ts")], raw);
    const directory = resolve(repository, ".temp/ir-types-coverage-c2956");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(path)).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, productNames.length, "every emitted runtime owner has actual nonempty V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, productNames.length);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "the actual type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});
