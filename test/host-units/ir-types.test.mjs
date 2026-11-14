import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { encodePackageId, encodeModuleId, encodeDefId, encodeBodyId, encodeGroupId, encodeKey } from "../../packages/host/dist/ids/index.js";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const productNames = ["index", "work", "value", "selector-path", "arena", "interner", "canonical", "copy", "normalize", "publication-fields", "publication-read", "substitute", "print", "parse", "text-readers", "text-values", "text-components", "text-records", "verify"];
const runtimeFiles = productNames.map(name => resolve(repository, `packages/host/dist/ir-types/${name}.js`));
const sourceFiles = [...productNames, "contract", "data"].map(name => resolve(repository, `packages/host/src/ir-types/${name}.ts`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let createTypeInterner, seedTypeInterner, internType, internSignature, readType, readSignature, exportTypes,
  substitute, substituteSignature, printTypes, parseTypes, runTypeVerifier, encodeSelectorPath;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the whole suite requires aggregate admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ createTypeInterner, seedTypeInterner, internType, internSignature, readType, readSignature, exportTypes,
    substitute, substituteSignature, printTypes, parseTypes, verifyTypes: runTypeVerifier, encodeSelectorPath } = await import("../../packages/host/dist/ir-types/index.js"));
});
const moduleId = encodeModuleId({ package: encodePackageId("ir-types-tests"), path: "main.ts" });
const definition = name => encodeDefId({ module: moduleId, segments: [{ name, ordinal: 0 }] });
const owner = definition("Owner");
const other = definition("Other");
const method = definition("method");
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
const itemFacts = new Map([[owner, { nodes: 2 }], [other, { nodes: 1 }], [caseDefinition, { nodes: 2 }]]);
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
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const limits = (changes = {}) => ({ maximumDepth: 128, maximumVisits: 131072,
  maximumUnionMembers: 131072, maximumIntersectionMembers: 131072, ...changes });
const publicationLimits = { maximumWork: 100000000, maximumCreatedRecords: 1000000 };
function completePublication(result) {
  assert.equal(result.kind, "complete", "the complete publication outcome is required");
  return result.value;
}
const primitive = { kind: "primitive", primitive: "int32" };
const rational = (numerator, denominator = 1n, negativeZero = false) => ({ numerator, denominator, negativeZero });
const signature = (changes = {}) => ({ declaration: null, owner: null, composition: null, kind: "call",
  typeParameters: [], receiver: null, parameters: [], result: 0, ...changes });
const violation = (rule, site, field, value) => ({ rule, site,
  detail: [{ kind: "text", value: field }, ...(value === undefined ? [] : [{ kind: "number", value }])] });
const typeSite = type => ({ kind: "type", type });
const signatureSite = signature => ({ kind: "signature", signature });

test("batched substitution preserves empty results and validates the one supplied environment", () => {
  const interner = seedTypeInterner({ terms: [primitive], signatures: [{ id: 0, ...signature() }] });
  const capacity = limits({ maximumDepth: 0, maximumVisits: 0 });
  assert.deepEqual(substitute(interner, [], emptyBindings(), capacity), { kind: "complete", value: [] });
  assert.deepEqual(substituteSignature(interner, [], emptyBindings(), capacity), { kind: "complete", value: [] });
  for (const apply of [roots => substitute(interner, roots, emptyBindings(), limits({ maximumVisits: -1 })),
    roots => substituteSignature(interner, roots, emptyBindings(), limits({ maximumVisits: -1 }))])
    assert.throws(() => apply([]), { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
  const binding = { kind: "rigid", parameter: { owner, index: 0 } };
  assert.throws(() => substitute(interner, [], { ...emptyBindings(), classBindings: [binding, binding] }, limits()),
    /contains each owner-qualified parameter once/u);
  const self = { kind: "rigid", owner };
  assert.throws(() => substituteSignature(interner, [], { ...emptyBindings(), selfBindings: [self, self] }, limits()),
    /contains each lexical self owner once/u);
});

test("one signature batch preserves root order, duplicate roots, exact rows and independent visit maxima", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [primitive, { kind: "param", parameter }, { kind: "string" }], signatures: [0, 1, 2].map(id => ({
    id, ...signature({ declaration: definition(`batch-${id}`), result: 1 }),
  })) };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 2 }] };
  const roots = [2, 0, 2, 1];
  assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 3 })), { kind: "resource-limit", dimension: "visits", maximum: 3 });
  assert.throws(() => readSignature(interner, 3), /outside this arena/u);
  assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 4 })), { kind: "complete", value: [3, 4, 3, 5] });
  assert.deepEqual(roots, [2, 0, 2, 1]);
  assert.deepEqual([3, 4, 5].map(id => readSignature(interner, id)), [2, 0, 1].map((original, index) => ({
    ...table.signatures[original], id: index + 3, result: 2,
  })));
  assert.deepEqual(table.signatures.map((_value, id) => readSignature(interner, id)), table.signatures);
  assert.deepEqual(substitute(interner, [1, 0, 1, 2], bindings, limits({ maximumVisits: 2 })), { kind: "complete", value: [2, 0, 2, 2] });
});

test("a later refused batch root returns no partial vector and never publishes that root's incomplete graph", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, { kind: "string" },
    { kind: "optional", value: 0 }, { kind: "array", element: 2, readonly: false }], signatures: [] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  const capacity = limits({ maximumVisits: 4 });
  assert.deepEqual(substitute(interner, [2, 3], bindings, capacity), { kind: "resource-limit", dimension: "visits", maximum: 4 });
  assert.deepEqual(readType(interner, 4), { kind: "optional", value: 1 });
  assert.throws(() => readType(interner, 5), /outside this arena/u);
  assert.deepEqual(substitute(interner, [2, 2], bindings, capacity), { kind: "complete", value: [4, 4] });
  assert.deepEqual(table.terms.map((_value, id) => readType(interner, id)), table.terms);
});

for (const [count, ownerBytes] of [[1, 0], [64, 4096], [4096, 4096]])
  test(`one batch prepares the same ${ownerBytes}-byte unused environment for all ${count} genuine short signatures`, () => {
    const longOwner = definition("unused-" + "p".repeat(ownerBytes));
    const table = { terms: [primitive], signatures: Array.from({ length: count }, (_value, id) => ({
      id, ...signature({ declaration: definition(`short-${id}`) }),
    })) };
    const interner = seedTypeInterner(table);
    const bindings = { ...emptyBindings(), capturedBindings: [{ kind: "rigid", parameter: { owner: longOwner, index: 0 } }] };
    const roots = table.signatures.map(row => row.id).reverse();
    assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 2 })), { kind: "complete", value: roots });
    assert.deepEqual(substituteSignature(interner, roots, bindings, limits({ maximumVisits: 2 })), { kind: "complete", value: roots });
    assert.deepEqual(table.signatures.map((_value, id) => readSignature(interner, id)), table.signatures);
    assert.deepEqual(readType(interner, 0), primitive);
    assert.throws(() => readSignature(interner, count), /outside this arena/u);
  });
const evidence = (changes = {}) => ({ type: 0, component: source, category: { kind: "known", category: "number" },
  numeric: null, sum: null, nominal: null, pointer: null, ...changes });
const verification = (terms = [primitive], changes = {}) => ({ table: { terms, signatures: [] }, bindings: [], evidence: [], ...changes });

test("seed retains empty independent arenas and admits normal subsequent insertion", () => {
  const table = { terms: [], signatures: [] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  const separate = seedTypeInterner(table);
  assert.notEqual(interner, separate);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)),
    { table: { terms: [], signatures: [] }, types: [], signatures: [] });
  assert.equal(internType(interner, primitive), 0);
  assert.equal(internType(separate, { kind: "string" }), 0);
  assert.deepEqual(readType(interner, 0), primitive);
  assert.deepEqual(readType(separate, 0), { kind: "string" });
  assert.equal(internSignature(interner, signature()), 0);
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
  const interner = seedTypeInterner(table);
  assert.deepEqual(terms.map((_, position) => readType(interner, position)), terms);
  assert.deepEqual(signatures.map((_, position) => readSignature(interner, position)), signatures);
  assert.equal(internType(interner, { kind: "array", element: 1, readonly: false }), 0);
  assert.equal(internSignature(interner, signature({ result: 2, composition: { kind: "union", signatures: [0, 1] } })), 0);
  assert.equal(internSignature(interner, signature({ result: 0, composition: { kind: "intersection", signatures: [0, 1] } })), 1);
  assert.equal(internType(interner, primitive), 3);
  assert.equal(internSignature(interner, signature({ result: 3 })), 2);
  assert.deepEqual(readType(interner, 3), primitive);
  assert.deepEqual(readSignature(interner, 2), { id: 2, ...signature({ result: 3 }) });
  assert.deepEqual(terms.map((_, position) => readType(interner, position)), terms);
  assert.deepEqual(signatures.map((_, position) => readSignature(interner, position)), signatures);
});

test("seed preserves valid duplicate and non-normalized rows while memoizing the lowest complete key", () => {
  const table = { terms: [{ kind: "array", element: 1, readonly: false },
    { kind: "array", element: 0, readonly: false }, primitive, { ...primitive },
    { kind: "optional", value: 2 }, { kind: "optional", value: 4 }],
  signatures: [{ id: 0, ...signature({ result: 2 }) }, { id: 1, ...signature({ result: 2 }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  assert.equal(internType(interner, primitive), 2);
  assert.equal(internType(interner, { kind: "optional", value: 4 }), 4);
  assert.equal(internSignature(interner, signature({ result: 2 })), 0);
  assert.equal(internType(interner, { kind: "string" }), 6);
  assert.equal(internSignature(interner, signature({ result: 6 })), 2);
  assert.deepEqual(readType(interner, 6), { kind: "string" });
  assert.deepEqual(readSignature(interner, 2), { id: 2, ...signature({ result: 6 }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
});

test("seed copies shared inline values by value without freezing or retaining mutable caller rows", () => {
  const parameter = { declaration: method, kind: "required", type: 0, passing: "by-value", initializer: null };
  const row = signature({ parameters: [parameter] });
  const table = { terms: [{ ...primitive }], signatures: [{ id: 0, ...row }, { id: 1, ...row }] };
  const expected = [{ id: 0, ...signature({ parameters: [{ ...parameter }] }) },
    { id: 1, ...signature({ parameters: [{ ...parameter }] }) }];
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  table.terms[0].primitive = "uint64";
  parameter.passing = "move";
  row.parameters.push({ ...parameter, declaration: captured });
  table.signatures.reverse();
  assert.deepEqual(readType(interner, 0), primitive);
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1)], expected);
  assert.equal(internSignature(interner, signature({ parameters: expected[0].parameters })), 0);
});

test("seed continues substitution in the same arena and retains every original issued row", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "array", element: 0, readonly: false }],
    signatures: [{ id: 0, ...signature({ result: 2 }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  assert.deepEqual(readType(interner, 3), { kind: "array", element: 1, readonly: false });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  assert.equal(internType(interner, { kind: "array", element: 1, readonly: false }), 3);
  assert.equal(internType(interner, { kind: "string" }), 4);
});

test("signature-root identity and own-binder shadowing share no memo namespace with numeric type roots", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive], signatures: [
    { id: 0, ...signature({ result: 1 }) },
    { id: 1, ...signature({ typeParameters: [{ identity: parameter, declaration: method, constraint: null, default: null }] }) },
  ] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  for (const signatureFirst of [false, true]) {
    const interner = seedTypeInterner(table);
    const operations = signatureFirst ? ["signature", "type"] : ["type", "signature"];
    for (const operation of operations) assert.deepEqual(operation === "type"
      ? substitute(interner, [0], bindings, limits()) : substituteSignature(interner, [0], bindings, limits()),
    { kind: "complete", value: [operation === "type" ? 1 : 0] });
    assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [0] });
    assert.deepEqual(substitute(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
    assert.deepEqual(substituteSignature(interner, [1], bindings, limits()), { kind: "complete", value: [1] });
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
    const interner = seedTypeInterner(table);
    for (const parameterOwner of [longOwner, other]) {
      const bindings = { ...emptyBindings(), capturedBindings: [
        { kind: "bound", parameter: { owner: parameterOwner, index: 0 }, type: 0 },
      ] };
      for (const capacity of [limits(), limits({ maximumVisits: 0 })]) {
        assert.deepEqual(substitute(interner, [1], bindings, capacity), capacity.maximumVisits === 0
          ? { kind: "resource-limit", dimension: "visits", maximum: 0 }
          : { kind: "complete", value: [1] });
      }
      for (const row of signatures)
        assert.deepEqual(substituteSignature(interner, [row.id], bindings, limits()), { kind: "complete", value: [row.id] });
    }
    assert.deepEqual(table.terms.map((_, index) => readType(interner, index)), table.terms);
    assert.deepEqual(signatures.map(row => readSignature(interner, row.id)), signatures);
    assert.throws(() => readType(interner, 2), /outside this arena/u);
    assert.throws(() => readSignature(interner, count), /outside this arena/u);
  }
});

test("deep signature-root substitution emits its complete iterative staged chain without a callable wrapper", () => {
  const count = 10000;
  const parameter = { owner, index: 0 };
  const terms = [{ kind: "param", parameter }];
  for (let position = 1; position <= count; position += 1)
    terms.push({ kind: "array", element: position - 1, readonly: false });
  terms.push(primitive);
  const table = { terms, signatures: [{ id: 0, ...signature({ result: count }) }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: count + 1 }] };
  const capacity = limits({ maximumDepth: count + 2, maximumVisits: 4 * count + 20 });
  assert.deepEqual(substituteSignature(interner, [0], bindings, capacity), { kind: "complete", value: [1] });
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
  assert.deepEqual(substituteSignature(interner, [0], bindings, capacity), { kind: "complete", value: [1] });
  assert.equal(internSignature(interner, signature({ result: count + 2 })), 1);
});

test("signature-root substitution retains a genuine self-recursive signature and complete old rows", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, composition: { kind: "union", signatures: [1] } }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
});

test("signature-root substitution emits both complete mutually recursive signatures in staged order", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive], signatures: [
    { id: 0, ...signature({ composition: { kind: "union", signatures: [1] } }) },
    { id: 1, ...signature({ composition: { kind: "intersection", signatures: [0] } }) },
  ] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [2] });
  assert.deepEqual([readSignature(interner, 2), readSignature(interner, 3)], [
    { id: 2, ...signature({ result: 1, composition: { kind: "union", signatures: [3] } }) },
    { id: 3, ...signature({ result: 1, composition: { kind: "intersection", signatures: [2] } }) },
  ]);
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  assert.throws(() => readSignature(interner, 4), /outside this arena/u);
});

test("signature-root substitution preserves a mixed callable and signature recursion without fabricating a root type", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "callable", calls: [0], constructs: [] }],
    signatures: [{ id: 0, ...signature({ parameters: [
      { declaration: method, kind: "required", type: 2, passing: "by-value", initializer: null }] }) }] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
  assert.deepEqual(readType(interner, 3), { kind: "callable", calls: [1], constructs: [] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, parameters: [
    { declaration: method, kind: "required", type: 3, passing: "by-value", initializer: null }] }) });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
  assert.throws(() => readType(interner, 4), /outside this arena/u);
  assert.throws(() => readSignature(interner, 2), /outside this arena/u);
});

test("two genuine type roots and a direct signature root share one substituted cyclic signature in both request orders", () => {
  const parameter = { owner, index: 0 };
  const shape = signature => ({ kind: "shape", members: [], indexes: [], calls: [signature], constructs: [] });
  const table = { terms: [{ kind: "param", parameter }, primitive,
    { kind: "callable", calls: [0], constructs: [] }, shape(0)],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  for (const signatureFirst of [false, true]) {
    const interner = seedTypeInterner(table);
    assert.deepEqual(substituteSignature(interner, [0], emptyBindings(), limits()), { kind: "complete", value: [0] });
    assert.deepEqual(substitute(interner, [2], emptyBindings(), limits()), { kind: "complete", value: [2] });
    assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
    assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
    if (signatureFirst) assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
    assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [4] });
    assert.deepEqual(substitute(interner, [3], bindings, limits()), { kind: "complete", value: [5] });
    assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [1] });
    assert.deepEqual([readType(interner, 4), readType(interner, 5)], [{ kind: "callable", calls: [1], constructs: [] }, shape(1)]);
    assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1, composition: { kind: "union", signatures: [1] } }) });
    assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
    assert.deepEqual(readSignature(interner, 0), table.signatures[0]);
    assert.throws(() => readSignature(interner, 2), /outside this arena/u);
    assert.throws(() => readType(interner, 6), /outside this arena/u);
  }
});

test("a completed signature-root memo is not reused under an additional outer binder scope", () => {
  const parameter = { owner, index: 0 };
  const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "callable", calls: [1], constructs: [] }],
    signatures: [{ id: 0, ...signature({ result: 2, typeParameters: [
      { identity: parameter, declaration: method, constraint: null, default: null }] }) }, { id: 1, ...signature() }] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substituteSignature(interner, [1], bindings, limits()), { kind: "complete", value: [2] });
  assert.deepEqual(readSignature(interner, 2), { id: 2, ...signature({ result: 1 }) });
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits()), { kind: "complete", value: [0] });
  assert.deepEqual(substituteSignature(interner, [1], bindings, limits()), { kind: "complete", value: [2] });
  assert.deepEqual(table.terms.map((_, position) => readType(interner, position)), table.terms);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  assert.throws(() => readType(interner, 3), /outside this arena/u);
  assert.throws(() => readSignature(interner, 3), /outside this arena/u);
});

test("two child type roots in one transformation retain one shared self-recursive signature result", () => {
  const parameter = { owner, index: 0 };
  const shape = selected => ({ kind: "shape", members: [], indexes: [], calls: [selected], constructs: [] });
  const tuple = (left, right) => ({ kind: "tuple", elements: [
    { kind: "required", type: left, declaration: null }, { kind: "required", type: right, declaration: null }], readonly: false });
  const table = { terms: [{ kind: "param", parameter }, primitive,
    { kind: "callable", calls: [0], constructs: [] }, shape(0), tuple(2, 3)],
    signatures: [{ id: 0, ...signature({ composition: { kind: "union", signatures: [0] } }) }] };
  const interner = seedTypeInterner(table);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  assert.deepEqual(substitute(interner, [4], bindings, limits()), { kind: "complete", value: [5] });
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
  const boundaries = [[0, "maximumDepth", "depth", 2, 1], [0, "maximumVisits", "visits", 3, 2],
    [1, "maximumUnionMembers", "union-members", 2, 1], [2, "maximumIntersectionMembers", "intersection-members", 2, 1]];
  assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
  const interner = seedTypeInterner(table);
  for (const [root, field, dimension, at, below] of boundaries) {
    assert.deepEqual(substituteSignature(interner, [root], emptyBindings(), limits({ [field]: below })),
      { kind: "resource-limit", dimension, maximum: below });
    assert.deepEqual(substituteSignature(interner, [root], emptyBindings(), limits({ [field]: at })), { kind: "complete", value: [root] });
  }
  assert.deepEqual(substituteSignature(interner, [3], emptyBindings(), limits({ maximumUnionMembers: 0, maximumIntersectionMembers: 0 })),
    { kind: "complete", value: [3] });
  for (const [field, dimension] of [["maximumDepth", "depth"], ["maximumVisits", "visits"]])
    assert.deepEqual(substituteSignature(interner, [3], emptyBindings(), limits({ [field]: 0 })),
      { kind: "resource-limit", dimension, maximum: 0 });
  assert.deepEqual(rows.map((_, position) => readType(interner, position)), rows);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(interner, position)), table.signatures);
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"])
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
      assert.throws(() => substituteSignature(interner, [0], emptyBindings(), limits({ [field]: value })),
        { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
});

test("signature-root three-plan plus one-stage visits and newly flattened members stop before publishing rows", () => {
  const parameter = { owner, index: 0 };
  const simple = { terms: [{ kind: "param", parameter }, primitive], signatures: [{ id: 0, ...signature() }] };
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  const interner = seedTypeInterner(simple);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits({ maximumVisits: 3 })),
    { kind: "resource-limit", dimension: "visits", maximum: 3 });
  assert.throws(() => readSignature(interner, 1), /outside this arena/u);
  assert.deepEqual(substituteSignature(interner, [0], bindings, limits({ maximumVisits: 4 })), { kind: "complete", value: [1] });
  assert.deepEqual(readSignature(interner, 1), { id: 1, ...signature({ result: 1 }) });
  assert.deepEqual(simple.terms.map((_, position) => readType(interner, position)), simple.terms);
  assert.deepEqual(readSignature(interner, 0), simple.signatures[0]);
  for (const kind of ["union", "intersection"]) {
    const table = { terms: [{ kind: "param", parameter }, primitive, { kind: "string" }, { kind: "primitive", primitive: "bool" },
      { kind, members: [1, 3] }, { kind, members: [0, 2] }], signatures: [{ id: 0, ...signature({ result: 5 }) }] };
    const bound = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 4 }] };
    const selected = seedTypeInterner(table);
    const field = kind === "union" ? "maximumUnionMembers" : "maximumIntersectionMembers";
    const dimension = kind === "union" ? "union-members" : "intersection-members";
    assert.deepEqual(verifyTypes({ table, bindings: [], evidence: [] }), []);
    assert.deepEqual(substituteSignature(selected, [0], bound, limits({ [field]: 2 })),
      { kind: "resource-limit", dimension, maximum: 2 });
    assert.throws(() => readType(selected, 6), /outside this arena/u);
    assert.throws(() => readSignature(selected, 1), /outside this arena/u);
    assert.deepEqual(substituteSignature(selected, [0], bound, limits({ [field]: 3 })), { kind: "complete", value: [1] });
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
  const id = internType(interner, row);
  assert.equal(id, 0);
  assert.equal(internType(interner, { ...row }), id);
  assert.equal(internType(separate, { kind: "string" }), 0);
  assert.deepEqual(readType(interner, id), primitive);
  row.primitive = "uint64";
  assert.deepEqual(readType(interner, id), primitive);
  assert.deepEqual(readType(separate, 0), { kind: "string" });
  const input = signature();
  const selected = internSignature(interner, input);
  assert.equal(selected, 0);
  assert.equal(internSignature(interner, signature()), selected);
  assert.deepEqual(readSignature(interner, selected), { id: 0, ...input });
  assert.equal(internSignature(interner, readSignature(interner, selected)), selected);
  input.parameters.push({ declaration: method, kind: "rest", type: id, passing: "move", initializer: null });
  assert.deepEqual(readSignature(interner, selected), { id: 0, ...signature() });
  assert.throws(() => readType(interner, 100), /outside this arena/u);
  assert.throws(() => readSignature(interner, 100), /outside this arena/u);
});

test("nominal definitions, facets, signed zero and exact native extents remain different whole terms", () => {
  const interner = createTypeInterner();
  const base = internType(interner, primitive);
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
  const ids = rows.map(row => internType(interner, row));
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(ids.map(id => readType(interner, id)), rows);
  assert.deepEqual(rows.map(row => internType(interner, row)), ids);
});

test("union, intersection, optional and member normalization is complete and does not mutate issued rows", () => {
  const interner = createTypeInterner();
  const integer = internType(interner, primitive);
  const string = internType(interner, { kind: "string" });
  const never = internType(interner, { kind: "intrinsic", intrinsic: "never" });
  const absence = internType(interner, { kind: "intrinsic", intrinsic: "absence" });
  const voidType = internType(interner, { kind: "intrinsic", intrinsic: "void" });
  assert.equal(internType(interner, { kind: "union", members: [] }), never);
  assert.equal(internType(interner, { kind: "union", members: [integer, never, integer] }), integer);
  assert.equal(internType(interner, { kind: "union", members: [voidType, absence] }), absence);
  const union = internType(interner, { kind: "union", members: [string, integer] });
  assert.deepEqual(readType(interner, union), { kind: "union", members: [integer, string] });
  assert.equal(internType(interner, { kind: "union", members: [integer, union, string] }), union);
  const optional = internType(interner, { kind: "optional", value: union });
  assert.equal(internType(interner, { kind: "union", members: [union, absence, optional] }), optional);
  assert.equal(internType(interner, { kind: "optional", value: optional }), optional);
  for (const value of [absence, never, voidType]) assert.equal(internType(interner, { kind: "optional", value }), absence);
  const intersection = internType(interner, { kind: "intersection", members: [integer, string, integer] });
  assert.deepEqual(readType(interner, intersection), { kind: "intersection", members: [integer, string] });
  assert.equal(internType(interner, { kind: "intersection", members: [intersection, string] }), intersection);
  assert.equal(internType(interner, { kind: "intersection", members: [integer] }), integer);
  assert.throws(() => internType(interner, { kind: "intersection", members: [] }), /at least one constituent/u);
  const origin = { kind: "declared", declaration: owner };
  const member = value => ({ key: { kind: "text", value }, origins: [origin], readOrigins: [origin], writeOrigins: [],
    kind: "property", read: integer, write: null, optional: false, readonly: true });
  const call = internSignature(interner, signature({ result: integer }));
  const construct = internSignature(interner, signature({ kind: "construct", result: integer }));
  const shape = { kind: "shape", members: [member("z"), member("a")], indexes: [
    { declaration: owner, key: string, read: integer, write: null, readonly: true },
    { declaration: other, key: string, read: integer, write: integer, readonly: false },
  ], calls: [call, call], constructs: [construct, construct] };
  const expected = { ...shape, members: [member("a"), member("z")], indexes: [...shape.indexes].reverse(), calls: [call], constructs: [construct] };
  assert.deepEqual(readType(interner, internType(interner, shape)), expected);
  assert.deepEqual(readType(interner, internType(interner, { kind: "callable", calls: [call, call], constructs: [construct, construct] })),
    { kind: "callable", calls: [call], constructs: [construct] });
  assert.deepEqual(readType(interner, union), { kind: "union", members: [integer, string] });
});

test("member keys, optional presence, independent setter type and nominal argument order are exact payloads", () => {
  const interner = createTypeInterner();
  const integer = internType(interner, primitive);
  const string = internType(interner, { kind: "string" });
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
  const issued = expected.map(value => internType(interner, value));
  assert.deepEqual(issued, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(issued.map(type => readType(interner, type)), expected);
  assert.deepEqual(expected.map(value => internType(interner, value)), issued);
});

test("canonical publication has independent complete expected order and is invariant under two insertion orders", () => {
  const build = order => {
    const interner = createTypeInterner();
    const ids = new Map(order.map(row => [row.kind, internType(interner, row)]));
    internType(interner, { kind: "array", element: ids.get("primitive"), readonly: false });
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
  const type = internType(interner, primitive);
  const issued = readType(interner, type);
  assert.deepEqual(exportTypes(interner, { maximumWork: 0, maximumCreatedRecords: 1 }),
    { kind: "resource-limit", dimension: "work", maximum: 0 });
  assert.deepEqual(exportTypes(interner, { maximumWork: publicationLimits.maximumWork, maximumCreatedRecords: 0 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  assert.deepEqual(exportTypes(interner, { maximumWork: publicationLimits.maximumWork, maximumCreatedRecords: 1 }),
    { kind: "complete", value: { table: { terms: [primitive], signatures: [] }, types: [0], signatures: [] }, work: 20, createdRecords: 1 });
  for (const field of ["maximumWork", "maximumCreatedRecords"]) for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
    assert.throws(() => exportTypes(interner, { ...publicationLimits, [field]: value }),
      { name: "TypeError", message: "ir-types: publication maxima must be nonnegative safe integers." });
  assert.equal(readType(interner, type) === issued, true, "refusal leaves the issued row identical");
  assert.deepEqual(readType(interner, type), primitive);
});

test("primitive publication has a hand-derived twenty-event boundary and never mutates its issued row", () => {
  const interner = createTypeInterner();
  assert.equal(internType(interner, primitive), 0);
  const issued = readType(interner, 0);
  const expected = { table: { terms: [primitive], signatures: [] }, types: [0], signatures: [] };
  // Read 3 + partition (3 + 1) + normalization (3 + 3 + 1) + final ordering (3 + 1 + 1 + 1) = 20.
  for (let maximumWork = 0; maximumWork < 20; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 1 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [20, 21])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 1 }), { kind: "complete", value: expected, work: 20, createdRecords: 1 });
  assert.equal(readType(interner, 0), issued);
  assert.deepEqual(readType(interner, 0), primitive);
});

test("a self-array publication has an independently counted thirty-eight-event boundary", () => {
  const interner = createTypeInterner();
  const row = { kind: "array", element: 0, readonly: false };
  assert.equal(internType(interner, row), 0);
  const expected = { table: { terms: [row], signatures: [] }, types: [0], signatures: [] };
  // Read 4 + partition (5 + 4) + normalization (5 + 1 + 5 + 1) + final ordering (5 + 4 + 2 + 1 + 1) = 38.
  for (let maximumWork = 0; maximumWork < 38; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 2 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [38, 39])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 2 }), { kind: "complete", value: expected, work: 38, createdRecords: 2 });
  assert.deepEqual(readType(interner, 0), row);
});

test("a two-member union counts member and propagation attempts, not queue or sort operations", () => {
  const interner = createTypeInterner();
  const rows = [primitive, { kind: "string" }, { kind: "union", members: [0, 1] }];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2]);
  const expected = { table: { terms: rows, signatures: [] }, types: [0, 1, 2], signatures: [] };
  // Read 8 + partition (10 + 9) + normalization (10 + 10 + 3 + 2 + 7 + 3) + final ordering (10 + 9 + 5 + 2 + 3) = 91.
  // The ten normalization attempts/reads are propagation 1, insertions 2, emit 1, staged read/follows 5, merge 1.
  for (let maximumWork = 0; maximumWork < 91; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 5 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [91, 92])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 5 }), { kind: "complete", value: expected, work: 91, createdRecords: 5 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});

test("signature publication counts its own emitted ID field but not that ID as a reference edge", () => {
  const interner = createTypeInterner();
  assert.deepEqual([internType(interner, primitive), internType(interner, { kind: "string" })], [0, 1]);
  assert.equal(internSignature(interner, signature()), 0);
  const expected = { table: { terms: [primitive, { kind: "string" }], signatures: [{ id: 0, ...signature() }] },
    types: [0, 1], signatures: [0] };
  // Read 15 + partition (15 + 6) + normalization (15 + 3 + 2 + 12 + 3) + final ordering (15 + 6 + 4 + 1 + 3) = 100.
  // Three surviving rows plus the signature result slot create four records; its own ID is a field, not an edge.
  for (let maximumWork = 0; maximumWork < 100; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 4 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [100, 101])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 4 }), { kind: "complete", value: expected, work: 100, createdRecords: 4 });
  assert.deepEqual([readType(interner, 0), readType(interner, 1)], [primitive, { kind: "string" }]);
  assert.deepEqual(readSignature(interner, 0), { id: 0, ...signature() });
});


test("least-closure publication has hand-counted repeated normalization and repair attempts", () => {
  const interner = createTypeInterner();
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "intersection", members: [2, 3] },
    { kind: "string" }, { kind: "union", members: [4, 5] }];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6]);
  const expected = { table: { terms: [{ kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 4 }, { kind: "string" },
    { kind: "union", members: [0, 3] }], signatures: [] },
    types: [0, 0, 1, 1, 1, 3, 2], signatures: [] };
  // Read 22 + partition (30 graph + 30 refinement) + normalization 142 + final ordering 62 = 286.
  // Normalization: initial views 21; optional/intersection/union jobs 7+7+33; repeated jobs 16+12; repair attempts 12; emit/maps 34.
  // Final ordering: graph 20 + refinement 20 + signatures 10 + remap slots 5 + issued-map slots 7 = 62.
  for (let maximumWork = 0; maximumWork < 286; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 10 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [286, 287])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 10 }), { kind: "complete", value: expected, work: 286, createdRecords: 10 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});

test("partition moves and predecessor refinement have a hand-derived three-array-chain work boundary", () => {
  const interner = createTypeInterner();
  const rows = [primitive, { kind: "array", element: 0, readonly: false },
    { kind: "array", element: 1, readonly: false }, { kind: "array", element: 2, readonly: false }];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3]);
  const expected = { table: { terms: [{ kind: "array", element: 3, readonly: false },
    { kind: "array", element: 0, readonly: false }, { kind: "array", element: 1, readonly: false }, primitive], signatures: [] },
    types: [3, 0, 1, 2], signatures: [] };
  // Read 15 + partition (18 + 21) + normalization (18 + 3 + 18 + 4) + final ordering (18 + 21 + 7 + 3 + 4) = 150.
  // Each refinement costs grouping 4 + edge counts 3 + splitter edges 5 + predicate signatures 7 + moved predecessor edges 2 = 21.
  for (let maximumWork = 0; maximumWork < 150; maximumWork += 1)
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 7 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  for (const maximumWork of [150, 151])
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 7 }), { kind: "complete", value: expected, work: 150, createdRecords: 7 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});
test("repair meters either stale child-view direction without charging map or queue operations", () => {
  for (const earlyOptional of [true, false]) {
    const interner = createTypeInterner();
    const arrays = [{ kind: "string" }, { kind: "array", element: 2, readonly: false },
      { kind: "array", element: 1, readonly: false }];
    const rows = earlyOptional
      ? [...arrays, { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "optional", value: 2 },
          { kind: "intersection", members: [4, 5] }, { kind: "union", members: [0, 6] }]
      : [...arrays, { kind: "optional", value: 1 }, { kind: "optional", value: 2 },
          { kind: "intersection", members: [3, 4] }, { kind: "optional", value: 0 }, { kind: "union", members: [0, 5] }];
    assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7]);
    const expected = { table: { terms: [{ kind: "array", element: 0, readonly: false },
      { kind: "optional", value: 0 }, { kind: "optional", value: 4 }, { kind: "optional", value: 5 },
      { kind: "string" }, { kind: "union", members: [0, 4] }], signatures: [] },
      types: earlyOptional ? [4, 0, 0, 2, 1, 1, 1, 3] : [4, 0, 0, 1, 1, 1, 2, 3], signatures: [] };
    // Read 25 + partition (34 + 34) + normalization 176 + final ordering (24 + 24 + 12 + 6 + 8) = 343.
    // Early optional: views 25, jobs 7+7+7+38+16+12, repair 26, emit/maps 38. Later optional: jobs 7+7+13+32+16+12; total unchanged.
    for (let maximumWork = 0; maximumWork < 343; maximumWork += 1)
      assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 12 }),
        { kind: "resource-limit", dimension: "work", maximum: maximumWork });
    for (const maximumWork of [343, 344])
      assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 12 }), { kind: "complete", value: expected, work: 343, createdRecords: 12 });
    assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
  }
});

test("a successful recursive pair merge stops explicitly at its hand-derived admission boundary", () => {
  const interner = createTypeInterner();
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, tuple(0), tuple(2)];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4]);
  // Before the first successful pair merge: read 25 + raw partition 53 + initial views 26 + propagation jobs 55 + self repair 2 + pair setup/matches 5 = 166.
  // The next pair-merge attempt is the refused event; no created row has been emitted.
  assert.deepEqual(exportTypes(interner, { maximumWork: 166, maximumCreatedRecords: 4 }),
    { kind: "resource-limit", dimension: "work", maximum: 166 });
  assert.deepEqual(completePublication(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 4 })),
    { table: { terms: [{ kind: "array", element: 0, readonly: false }, tuple(0)], signatures: [] },
      types: [0, 0, 0, 1, 1], signatures: [] });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
});

test("nested bisimulation witness evaluation propagates a closed work stop before touching issued rows", () => {
  const interner = createTypeInterner();
  const tuple = types => ({ kind: "tuple", elements: types.map((type, index) => ({
    kind: index === 0 ? "required" : "optional", type, declaration: null })), readonly: false });
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, primitive, tuple([0]), tuple([3]), tuple([4, 2]), tuple([5, 0])];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7]);
  const issued = rows.map((_, identity) => readType(interner, identity));
  // This earlier nested-witness stop retains its complete refusal and immutable issued rows.
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumWork: 313 }),
    { kind: "resource-limit", dimension: "work", maximum: 313 });
  assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
  assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
});

test("dead nested witnesses preserve either serial direction and propagate their exact work refusal", () => {
  const array = element => ({ kind: "array", element, readonly: false });
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const table = { terms: [array(2), array(1), primitive, tuple(0), tuple(1)], signatures: [] };
  for (const changedFirst of [true, false]) {
    const interner = createTypeInterner();
    const parents = changedFirst ? [tuple(4), tuple(5)] : [tuple(5), tuple(4)];
    const rows = [array(1), array(0), { kind: "union", members: [0, 1] }, primitive, array(2), array(3), ...parents];
    assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7]);
    const issued = rows.map((_, identity) => readType(interner, identity));
    // Before dead propagation: read 36 + partition (44 + 49) + views 39 + jobs 49 + first repair 11 + jobs 28 + repair 14 + outer/nested pairs 16 or 15.
    // Reversing the parent issue order removes the first self-candidate attempt: 286 or 285 admitted events precede the next propagation attempt.
    const maximumWork = changedFirst ? 286 : 285;
    assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 9 }),
      { kind: "resource-limit", dimension: "work", maximum: maximumWork });
    assert.deepEqual(completePublication(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 9 })),
      { table, types: changedFirst ? [1, 1, 1, 2, 1, 0, 4, 3] : [1, 1, 1, 2, 1, 0, 3, 4], signatures: [] });
    assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
  }
});

test("repair rebuilds an independently stale view with an explicit same-meter stop in either order", () => {
  const array = (element, readonly) => ({ kind: "array", element, readonly });
  const tuple = (type, readonly) => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly });
  const table = { terms: [array(0, false), array(1, true), tuple(0, false), tuple(1, true)], signatures: [] };
  for (const earlyReadonly of [false, true]) {
    const interner = createTypeInterner();
    const rows = [array(1, earlyReadonly), array(0, earlyReadonly), { kind: "union", members: [0, 1] },
      tuple(0, earlyReadonly), tuple(2, earlyReadonly), array(6, !earlyReadonly), array(5, !earlyReadonly),
      { kind: "union", members: [5, 6] }, tuple(5, !earlyReadonly), tuple(7, !earlyReadonly)];
    assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const issued = rows.map((_, identity) => readType(interner, identity));
    // At359 the earlier emit.describe admits row358/kind359, then refuses elements360; this is not the repair-view stop.
    assert.deepEqual(exportTypes(interner, { maximumWork: 359, maximumCreatedRecords: 8 }),
      { kind: "resource-limit", dimension: "work", maximum: 359 });
    assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
    // Read50 + partition(62+48) + views52 + jobs125 + repairs4+14 + merged job11 + alias repair2 + repair1 =369.
    // The second union contributes stale own5+child5; the target tuple view charges row/fields/reference370..377.
    for (const [maximumWork, expected, event] of [
      [369, { kind: "resource-limit", dimension: "work", maximum: 369 }, "target view row370 refuses"],
      [370, { kind: "resource-limit", dimension: "work", maximum: 370 }, "target row370 admitted; kind371 refuses"],
      [376, { kind: "resource-limit", dimension: "work", maximum: 376 }, "target retained-reference377 refuses inside view"],
      [377, { kind: "resource-limit", dimension: "work", maximum: 377 }, "whole view admitted; repair candidate378 refuses"],
      [532, { kind: "resource-limit", dimension: "work", maximum: 532 }, "final ten-slot map charge523-to533 refuses"],
    ]) {
      assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 8 }), expected, event);
      assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows, event);
      assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true, event);
    }
    assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 7 }),
      { kind: "resource-limit", dimension: "created-records", maximum: 7 });
    assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
    // From369: stale view8 + repair21 + job11 + alias repair2 + final normalized output58 + canonical64 =533.
    // Low-serial winners2/6 are already repairQueued: no extra tail jobs; final first-tuple stale view adds8. Created=4rows+4refs.
    for (const maximumWork of [533, 534]) {
      assert.deepEqual(exportTypes(interner, { maximumWork, maximumCreatedRecords: 8 }), {
        kind: "complete", value: { table,
          types: earlyReadonly ? [1, 1, 1, 3, 3, 0, 0, 0, 2, 2] : [0, 0, 0, 2, 2, 1, 1, 1, 3, 3], signatures: [] },
        work: 533, createdRecords: 8,
      });
      assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
      assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
    }
    assert.deepEqual(completePublication(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 8 })),
      { table, types: earlyReadonly ? [1, 1, 1, 3, 3, 0, 0, 0, 2, 2] : [0, 0, 0, 2, 2, 1, 1, 1, 3, 3], signatures: [] });
    assert.deepEqual(rows.map((_, identity) => readType(interner, identity)), rows);
    assert.equal(issued.every((row, identity) => readType(interner, identity) === row), true);
  }
});

test("canonical bisimulation quotients both three-array cycle orders without changing any issued row", () => {
  for (const edges of [[1, 2, 0], [2, 0, 1]]) {
    const interner = createTypeInterner();
    const issued = edges.map(element => internType(interner, { kind: "array", element, readonly: false }));
    const expected = edges.map(element => ({ kind: "array", element, readonly: false }));
    assert.deepEqual(issued, [0, 1, 2]);
    assert.deepEqual(issued.map(type => readType(interner, type)), expected);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [] },
      types: [0, 0, 0], signatures: [] });
    assert.deepEqual(issued.map(type => readType(interner, type)), expected);
  }
});

test("newly equal union and intersection children normalize to their representative without mutating issued aliases", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    assert.equal(internType(interner, { kind: "array", element: 1, readonly: false }), 0);
    assert.equal(internType(interner, { kind: "array", element: 0, readonly: false }), 1);
    const alias = internType(interner, { kind, members: [0, 1] });
    assert.equal(alias, 2);
    const issued = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
      { kind, members: [0, 1] }];
    assert.deepEqual([0, 1, 2].map(type => readType(interner, type)), issued);
    assert.equal(internType(interner, readType(interner, alias)), alias);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [{ kind: "array", element: 0, readonly: false }], signatures: [] },
      types: [0, 0, 0], signatures: [] });
    assert.deepEqual([0, 1, 2].map(type => readType(interner, type)), issued);
  }
});

test("publication propagates exposed aliases through recursive constructors before reducing an outer union", () => {
  const interner = createTypeInterner();
  const array = element => ({ kind: "array", element, readonly: false });
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const issued = [array(1), tuple(0), array(8), array(9), array(10), tuple(2), tuple(3), tuple(4),
    { kind: "union", members: [5, 6] }, { kind: "union", members: [6, 7] }, { kind: "union", members: [5, 7] },
    { kind: "union", members: [0, 2] }];
  assert.deepEqual(issued.map(term => internType(interner, term)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const expected = { terms: [array(1), tuple(0)], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0], signatures: [] });
  assert.deepEqual(issued.map((_, type) => readType(interner, type)), issued);
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
    assert.deepEqual(order.rows.map(row => internType(interner, row)), [0, 1, 2]);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: order.maps, signatures: [] });
    assert.equal(printTypes(completePublication(exportTypes(interner, publicationLimits)).table), text);
  }
});

test("signature cycle quotienting and callable set reduction retain complete issued signature maps", () => {
  for (const edges of [[1, 2, 0], [2, 0, 1]]) {
    const interner = createTypeInterner();
    assert.equal(internType(interner, primitive), 0);
    const rows = edges.map(child => signature({ composition: { kind: "union", signatures: [child] } }));
    assert.deepEqual(rows.map(row => internSignature(interner, row)), [0, 1, 2]);
    assert.equal(internType(interner, { kind: "callable", calls: [0, 1, 2], constructs: [] }), 1);
    const expected = { terms: [{ kind: "callable", calls: [0], constructs: [] }, primitive], signatures: [
      { id: 0, ...signature({ composition: { kind: "union", signatures: [0] }, result: 1 }) },
    ] };
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [1, 0], signatures: [0, 0, 0] });
    assert.deepEqual([0, 1, 2].map(id => readSignature(interner, id)), rows.map((row, id) => ({ id, ...row })));
  }
});

test("alias repair compares full signature results and preserves both directions of callable edge absence", () => {
  for (const order of [["full", "empty"], ["empty", "full"]]) {
    const interner = createTypeInterner();
    const terms = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
      { kind: "union", members: [0, 1] }, primitive,
      ...order.map(kind => ({ kind: "callable", calls: kind === "full" ? [0, 1, 2] : [], constructs: [] }))];
    assert.deepEqual(terms.map(term => internType(interner, term)), [0, 1, 2, 3, 4, 5]);
    const rows = [signature({ result: 0 }), signature({ result: 2 }), signature({ result: 3 })];
    assert.deepEqual(rows.map(row => internSignature(interner, row)), [0, 1, 2]);
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [
      { kind: "array", element: 0, readonly: false }, { kind: "callable", calls: [0, 1], constructs: [] },
      { kind: "callable", calls: [], constructs: [] }, primitive,
    ], signatures: [{ id: 0, ...signature({ result: 0 }) }, { id: 1, ...signature({ result: 3 }) }] },
      types: [0, 0, 0, 3, ...order.map(kind => kind === "full" ? 1 : 2)], signatures: [0, 0, 1] });
    assert.deepEqual([0, 1, 2].map(id => readSignature(interner, id)), rows.map((row, id) => ({ id, ...row })));
    assert.deepEqual(readType(interner, 2), { kind: "union", members: [0, 1] });
  }
});

test("a failed nested bisimulation witness propagates without merging distinct signature result subtrees", () => {
  const interner = createTypeInterner();
  const tuple = type => ({ kind: "tuple", elements: [{ kind: "required", type, declaration: null }], readonly: false });
  const terms = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "union", members: [0, 1] }, primitive, tuple(0), tuple(2), tuple(3),
    { kind: "callable", calls: [0, 1, 2], constructs: [] }];
  assert.deepEqual(terms.map(term => internType(interner, term)), [0, 1, 2, 3, 4, 5, 6, 7]);
  const rows = [signature({ result: 4 }), signature({ result: 5 }), signature({ result: 6 })];
  assert.deepEqual(rows.map(row => internSignature(interner, row)), [0, 1, 2]);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [
    { kind: "array", element: 0, readonly: false }, { kind: "callable", calls: [0, 1], constructs: [] }, primitive, tuple(0), tuple(2),
  ], signatures: [{ id: 0, ...signature({ result: 4 }) }, { id: 1, ...signature({ result: 3 }) }] },
    types: [0, 0, 0, 2, 3, 3, 4, 1], signatures: [1, 1, 0] });
  assert.deepEqual([0, 1, 2].map(id => readSignature(interner, id)), rows.map((row, id) => ({ id, ...row })));
});

test("flattened members reuse an existing complete row after an intersection alias is exposed", () => {
  const interner = createTypeInterner();
  const fixed = (element, length) => ({ kind: "fixed-array", element, extent: { length, runtimeBase: "number" } });
  const terms = [fixed(1, 1n), fixed(0, 1n), fixed(3, 2n), fixed(2, 2n),
    { kind: "union", members: [0, 2] }, { kind: "union", members: [1, 3] }, { kind: "intersection", members: [4, 5] },
    { kind: "param", parameter: { owner, index: 0 } }, { kind: "union", members: [6, 7] }, { kind: "union", members: [0, 2, 7] }];
  assert.deepEqual(terms.map(term => internType(interner, term)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const issued = Array.from({ length: 10 }, (_, type) => readType(interner, type));
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: { terms: [fixed(0, 1n), fixed(1, 2n), terms[7],
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
    param(parameter=TypeParameterIdentity(owner=def:${JSON.stringify(owner)}, index=0)),
    param(parameter=TypeParameterIdentity(owner=def:${JSON.stringify(owner)}, index=1)),
    param(parameter=TypeParameterIdentity(owner=def:${JSON.stringify(owner)}, index=2)),
    param(parameter=TypeParameterIdentity(owner=def:${JSON.stringify(owner)}, index=3)),
    union(members=[t:10, t:11]), union(members=[t:10, t:12]),
    union(members=[t:10, t:13]), union(members=[t:10, t:14])
  ], signatures=[])`;
  const parsed = parseTypes(document);
  assert.equal(parsed.kind, "parsed");
  if (parsed.kind !== "parsed") return;
  const interner = createTypeInterner();
  assert.deepEqual(parsed.value.terms.map(row => internType(interner, row)),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  const before = Array.from({ length: 19 }, (_, type) => readType(interner, type));
  const expected = { terms: [
    ...[0, 1, 2, 3].map(index => ({ kind: "fixed-array", element: index, extent: { length: BigInt(index + 1), runtimeBase: "number" } })),
    ...[0, 1, 2, 3].map(index => ({ kind: "param", parameter: { owner, index } })),
    ...[4, 5, 6, 7].map(type => ({ kind: "union", members: [0, 1, 2, 3, type] })),
    { kind: "union", members: [0, 1, 2, 3] },
  ], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected,
    types: [0, 0, 1, 1, 2, 2, 3, 3, 12, 12, 12, 4, 5, 6, 7, 8, 9, 10, 11], signatures: [] });
  assert.deepEqual(completePublication(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 41 })), {
    table: expected, types: [0, 0, 1, 1, 2, 2, 3, 3, 12, 12, 12, 4, 5, 6, 7, 8, 9, 10, 11], signatures: [] });
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 40 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 40 });
  for (const maximumWork of [0, 1, 100]) assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumWork }),
    { kind: "resource-limit", dimension: "work", maximum: maximumWork });
  assert.equal(before.every((row, type) => readType(interner, type) === row), true, "every original issued row retains identity");
});

test("canonical partition refinement handles a 100000-link nonrecursive reference chain", () => {
  const interner = createTypeInterner();
  let child = internType(interner, primitive);
  for (let position = 0; position < 100000; position += 1)
    child = internType(interner, { kind: "array", element: child, readonly: false });
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
  const base = internType(interner, primitive);
  const elements = Array.from({ length: 300 }, (_, position) => ({ kind: "required", type: base,
    declaration: position % 2 === 0 ? owner : null }));
  const tuple = { kind: "tuple", elements, readonly: false };
  assert.equal(internType(interner, tuple), 1);
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
    internType(interner, primitive);
    internSignature(interner, signature());
    const component = nested();
    internType(interner, projection([arm(component), arm(shared ? component : nested())]));
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
    assert.equal(internType(interner, primitive), 0);
    assert.equal(internType(interner, shape), 1);
    const saved = readType(interner, 1);
    assert.deepEqual(saved, expected);
    origin.declaration = other;
    origins.push({ kind: "declared", declaration: method });
    assert.deepEqual(readType(interner, 1), expected);
    assert.equal(internType(interner, expected), 1);
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
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4]);
  const expected = { terms: [rows[0], rows[1], rows[4], rows[2], rows[3]], signatures: [] };
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), { table: expected, types: [0, 1, 3, 4, 2], signatures: [] });
  assert.deepEqual(rows.map((_, position) => readType(interner, position)), rows);
});

test("every native primitive and intrinsic arm is interned, read, printed and parsed through the public index", () => {
  const natives = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal"];
  const intrinsics = ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"];
  const rows = [...natives.map(primitive => ({ kind: "primitive", primitive })), ...intrinsics.map(intrinsic => ({ kind: "intrinsic", intrinsic }))];
  const interner = createTypeInterner();
  assert.deepEqual(rows.map(row => readType(interner, internType(interner, row))), rows);
  const table = { terms: rows, signatures: [] };
  assert.deepEqual(parseTypes(printTypes(table)), { kind: "parsed", value: table });
});

test("all TypeTerm, literal, selector, origin, signature and passing arms round-trip complete declared records", () => {
  const origins = [{ kind: "declared", declaration: owner }, { kind: "class-prototype", owner: other },
    { kind: "mapped", owner: itemSource, key: { kind: "symbol", declaration: other } }];
  const construction = { occurrence: source.value, captures: [{ body, local: 0 }, { body, local: 1 }] };
  const family = { origin: "authored", component: { root: source, path: [] }, parameters: [{ owner, index: 0 }],
    roles: [{ authoredIndex: 0, component: source, member: 0 }, { authoredIndex: 1, component: itemSource, member: 1 }] };
  const selectors = [
    { kind: "class-value" }, { kind: "construction-argument", definition: construction, index: 0 }, { kind: "optional-value" },
    { kind: "array-element" }, { kind: "tuple-element", index: 0 }, { kind: "union-member", index: 1 },
    { kind: "argument-place", index: 0 }, { kind: "parameter-place", index: 1 }, { kind: "intersection-member", index: 0 },
    { kind: "intersection-result" }, { kind: "argument-tail", start: 1 }, { kind: "parameter-tail", start: 0 },
    { kind: "member", origin: origins[2] }, { kind: "index-key", declaration: owner }, { kind: "index-value", declaration: other },
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
    ], indexes: [{ declaration: owner, key: 1, read: 0, write: 0, readonly: false },
      { declaration: other, key: 0, read: 1, write: null, readonly: true }], calls: [0], constructs: [1] },
    { kind: "callable", calls: [0], constructs: [1] },
    { kind: "declared", definition: owner, arguments: [0, 1], facet: "instance", extent: null },
    { kind: "declared", definition: owner, arguments: [], facet: "value", extent: { length: 0n, runtimeBase: "number" } },
    { kind: "construction-reference", definition: construction, arguments: [0, 1] },
    { kind: "enum", definition: definition("Enum") }, { kind: "param", parameter: { owner, index: -0 } },
    { kind: "self", owner }, { kind: "projection", source: 0, projection: { kind: "awaited" } },
    { kind: "projection", source: 1, projection: { kind: "component", component: { root: itemSource, path: selectors } } },
    { kind: "open", group: encodeGroupId([body, otherBody]), variable: -0 }, { kind: "error" },
  ];
  const table = { terms: records, signatures: [
    { id: 0, ...signature({ declaration: owner, owner: source, composition: { kind: "union", signatures: [0, 1] },
      typeParameters: [{ identity: { owner, index: 0 }, declaration: method, constraint: 0, default: 1 }], receiver: 1,
      parameters: passing.map((mode, index) => ({ declaration: definition(`p${index}`), kind: index === 6 ? "rest" : "required",
        type: 0, passing: mode, initializer: null })) }) },
    { id: 1, ...signature({ kind: "construct", owner: itemSource, composition: { kind: "intersection", signatures: [0, 1] },
      typeParameters: [{ identity: { owner: other, index: 0 }, declaration: other, constraint: null, default: null }],
      parameters: [{ declaration: method, kind: "optional", type: 1, passing: "by-value", initializer: null },
        { declaration: captured, kind: "default", type: 0, passing: "move", initializer: body }] }) },
  ] };
  assert.equal(compareCaseValues(parseTypes(printTypes(table)), { kind: "parsed", value: table }), true, "complete all-arm text value");
  const interner = createTypeInterner();
  const ids = records.map(term => internType(interner, term));
  const normalized = records.map(term => term.kind === "shape" ? { ...term,
    members: [term.members[1], term.members[2], term.members[0]], indexes: [term.indexes[1], term.indexes[0]] } : term);
  assert.deepEqual(ids.map(type => readType(interner, type)), normalized);
  const verified = normalized.map(term => term.kind === "param" ? { ...term, parameter: { ...term.parameter, index: 0 } } : term);
  assert.deepEqual(verifyTypes({ table: { terms: verified, signatures: table.signatures }, bindings: [], evidence: [] }), []);
  const seeded = seedTypeInterner({ terms: verified, signatures: table.signatures });
  assert.deepEqual(verified.map((_, position) => readType(seeded, position)), verified);
  assert.deepEqual(table.signatures.map((_, position) => readSignature(seeded, position)), table.signatures);
  const signatureIds = table.signatures.map(({ id, ...input }) => internSignature(interner, input));
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
    const nested = { terms: [primitive, { kind: "param", parameter: { owner, index: value } },
      { kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path: [
        { kind: "tuple-element", index: value }, { kind: "argument-tail", start: value },
        { kind: "tuple-slice", start: value, endCount: value, readonly: false },
        { kind: "sum-arm", index: value, family: { origin: "authored", component: { root: itemSource, path: [] },
          parameters: [{ owner, index: value }], roles: [{ authoredIndex: value, component: source, member: 0 }] } },
      ] } } }], signatures: [{ id: 0, ...signature({ typeParameters: [
        { identity: { owner, index: value }, declaration: method, constraint: null, default: null }] }) }] };
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
    { name: "number", prefix: `TypeTable(terms=[param(parameter=TypeParameterIdentity(owner=def:${JSON.stringify(owner)}, index=`,
      suffix: "))], signatures=[])", expected: ["number"] },
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
      ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"]],
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
  const intrinsic = ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"];
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
  const seeded = seedTypeInterner(table);
  assert.equal(compareCaseValues(table.terms.map((_, position) => readType(seeded, position)), table.terms), true,
    "all seeded 100000-edge rows retain their exact issued references");
  assert.equal(internType(seeded, { kind: "array", element: 99999, readonly: false }), 100000);
  assert.equal(internType(seeded, { kind: "string" }), 100001);
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
  assert.throws(() => seedTypeInterner(cyclic), { name: "TypeError",
    message: "Inline cycle at $.projection.component.path[0].family.component" });
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
  const seeded = seedTypeInterner(table);
  assert.equal(compareCaseValues(readType(seeded, 0), table.terms[0]), true, "the complete seeded finite inline chain");
  assert.equal(internType(seeded, table.terms[0]), 0);
});

test("substitution uses the complete four-family environment and reuses independently interned complete results", () => {
  const interner = createTypeInterner();
  const classParameter = { owner, index: 0 };
  const methodParameter = { owner: method, index: 0 };
  const capturedParameter = { owner: captured, index: 0 };
  const parameters = [classParameter, methodParameter, capturedParameter].map(parameter => internType(interner, { kind: "param", parameter }));
  const self = internType(interner, { kind: "self", owner });
  const integer = internType(interner, primitive);
  const string = internType(interner, { kind: "string" });
  const extent = { length: 9007199254740993n, runtimeBase: "bigint" };
  const fixed = internType(interner, { kind: "fixed-array", element: parameters[0], extent });
  const tuple = types => ({ kind: "tuple", elements: types.map(type => ({ kind: "required", type, declaration: null })), readonly: true });
  const input = internType(interner, tuple([fixed, parameters[1], parameters[2], self, fixed]));
  const outputFixed = internType(interner, { kind: "fixed-array", element: integer, extent });
  const expectedTerm = tuple([outputFixed, string, integer, string, outputFixed]);
  const expected = internType(interner, expectedTerm);
  const bindings = { classBindings: [{ kind: "bound", parameter: classParameter, type: integer }],
    methodBindings: [{ kind: "bound", parameter: methodParameter, type: string }],
    capturedBindings: [{ kind: "bound", parameter: capturedParameter, type: integer }],
    selfBindings: [{ kind: "bound", owner, type: string }] };
  assert.deepEqual(substitute(interner, [input], bindings, limits()), { kind: "complete", value: [expected] });
  assert.deepEqual(substitute(interner, [input], bindings, limits()), { kind: "complete", value: [expected] });
  assert.deepEqual(readType(interner, expected), expectedTerm);
  assert.deepEqual(readType(interner, input), tuple([fixed, parameters[1], parameters[2], self, fixed]));
  const rigid = { classBindings: [{ kind: "rigid", parameter: classParameter }],
    methodBindings: [{ kind: "rigid", parameter: methodParameter }], capturedBindings: [{ kind: "rigid", parameter: capturedParameter }],
    selfBindings: [{ kind: "rigid", owner }] };
  assert.deepEqual(substitute(interner, [input], rigid, limits()), { kind: "complete", value: [input] });
  assert.deepEqual(substitute(interner, [input], emptyBindings(), limits()), { kind: "complete", value: [input] });
  const unrelated = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: { owner: other, index: 0 }, type: string }],
    selfBindings: [{ kind: "bound", owner: other, type: integer }] };
  assert.deepEqual(substitute(interner, [input], unrelated, limits()), { kind: "complete", value: [input] });
});

test("signature binders shadow the exact method identity while outer binders and all signature fields substitute", () => {
  const interner = createTypeInterner();
  const outer = { owner, index: 0 };
  const inner = { owner: method, index: 0 };
  const outerType = internType(interner, { kind: "param", parameter: outer });
  const innerType = internType(interner, { kind: "param", parameter: inner });
  const string = internType(interner, { kind: "string" });
  const input = signature({ declaration: method, owner: source, typeParameters: [
    { identity: inner, declaration: captured, constraint: outerType, default: outerType }], receiver: outerType,
    parameters: [{ declaration: owner, kind: "default", type: outerType, passing: "borrow-mut", initializer: body }], result: innerType });
  const selected = internSignature(interner, input);
  const callable = internType(interner, { kind: "callable", calls: [selected], constructs: [] });
  const expectedInput = { ...input, typeParameters: [{ ...input.typeParameters[0], constraint: string, default: string }], receiver: string,
    parameters: [{ ...input.parameters[0], type: string }] };
  const expectedSignature = internSignature(interner, expectedInput);
  const expected = internType(interner, { kind: "callable", calls: [expectedSignature], constructs: [] });
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: outer, type: string }],
    methodBindings: [{ kind: "bound", parameter: inner, type: string }] };
  assert.deepEqual(substitute(interner, [callable], bindings, limits()), { kind: "complete", value: [expected] });
  assert.deepEqual(readSignature(interner, expectedSignature), { id: expectedSignature, ...expectedInput });
  assert.deepEqual(readType(interner, innerType), { kind: "param", parameter: inner });
});

test("substitution composes exact class, captured and lexical self environments without changing issued inputs", () => {
  const interner = createTypeInterner();
  const first = { owner, index: 0 };
  const second = { owner, index: 1 };
  const closure = { owner: captured, index: 0 };
  const tuple = types => ({ kind: "tuple", elements: types.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  const rows = [{ kind: "param", parameter: first }, { kind: "param", parameter: second },
    { kind: "param", parameter: closure }, { kind: "self", owner }, primitive, { kind: "string" },
    { kind: "optional", value: 2 }, { kind: "optional", value: 4 }, tuple([0, 1, 3]), tuple([2, 1, 6]), tuple([4, 5, 7])];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const outer = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: first, type: 2 },
    { kind: "rigid", parameter: second }], selfBindings: [{ kind: "bound", owner, type: 6 }] };
  const inner = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: second, type: 5 }],
    capturedBindings: [{ kind: "bound", parameter: closure, type: 4 }] };
  const composed = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: first, type: 4 },
    { kind: "bound", parameter: second, type: 5 }], capturedBindings: [{ kind: "bound", parameter: closure, type: 4 }],
    selfBindings: [{ kind: "bound", owner, type: 7 }] };
  assert.deepEqual(substitute(interner, [8], outer, limits()), { kind: "complete", value: [9] });
  assert.deepEqual(substitute(interner, [9], inner, limits()), { kind: "complete", value: [10] });
  assert.deepEqual(substitute(interner, [8], composed, limits()), { kind: "complete", value: [10] });
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
});

test("substitution distinguishes every complete term constructor and nested typed reference role", () => {
  const interner = createTypeInterner();
  const parameter = { owner, index: 0 };
  assert.equal(internType(interner, { kind: "param", parameter }), 0);
  assert.equal(internType(interner, { kind: "string" }), 1);
  assert.equal(internType(interner, primitive), 2);
  const originalSignature = internSignature(interner, signature({ result: 0 }));
  const expectedSignature = internSignature(interner, signature({ result: 1 }));
  const origin = { kind: "declared", declaration: owner };
  const construction = { occurrence: source.value, captures: [{ body, local: 0 }] };
  const shape = type => ({ kind: "shape", members: [{ key: { kind: "text", value: "value" }, origins: [origin],
    readOrigins: [origin], writeOrigins: [origin], kind: "property", read: type, write: type, optional: true, readonly: false }],
    indexes: [{ declaration: owner, key: type, read: type, write: type, readonly: false }],
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
    const original = internType(interner, input);
    const result = internType(interner, expected);
    assert.deepEqual(substitute(interner, [original], bindings, limits()), { kind: "complete", value: [result] });
    assert.deepEqual(readType(interner, result), expected);
  }
  const projection = (type, signature) => ({ kind: "projection", source: type, projection: { kind: "component", component: {
    root: source, path: [{ kind: "sum-arm", index: 0, family: { origin: "authored", component: { root: itemSource,
      path: [{ kind: "result", signature }] }, parameters: [parameter], roles: [{ authoredIndex: 0, component: source, member: type }] } }],
  } } });
  const inputProjection = internType(interner, projection(0, originalSignature));
  const expectedProjection = internType(interner, projection(1, expectedSignature));
  assert.deepEqual(substitute(interner, [inputProjection], bindings, limits()), { kind: "complete", value: [expectedProjection] });
  assert.deepEqual(readType(interner, expectedProjection), projection(1, expectedSignature));
});

test("signature composition has one canonical set while preserving the complete owner and binder records", () => {
  const interner = createTypeInterner();
  internType(interner, primitive);
  const first = internSignature(interner, signature({ declaration: owner }));
  const second = internSignature(interner, signature({ declaration: method }));
  const input = signature({ composition: { kind: "union", signatures: [second, first, second] } });
  const selected = internSignature(interner, input);
  assert.deepEqual(readSignature(interner, selected), { id: selected, ...signature({ composition: { kind: "union", signatures: [first, second] } }) });
  assert.equal(internSignature(interner, signature({ composition: { kind: "union", signatures: [first, second] } })), selected);
  assert.deepEqual(input.composition.signatures, [second, first, second]);
});

test("substitution publishes new recursive rows once and leaves unchanged cycles and issued records intact", () => {
  const interner = createTypeInterner();
  const origin = { kind: "declared", declaration: owner };
  const member = (value, type) => ({ key: { kind: "text", value }, origins: [origin], readOrigins: [origin], writeOrigins: [],
    kind: "property", read: type, write: null, optional: false, readonly: true });
  const shape = (next, value) => ({ kind: "shape", members: [member("next", next), member("value", value)], indexes: [], calls: [], constructs: [] });
  const input = internType(interner, shape(0, 1));
  const parameter = { owner, index: 0 };
  internType(interner, { kind: "param", parameter });
  const integer = internType(interner, primitive);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: integer }] };
  assert.deepEqual(substitute(interner, [input], bindings, limits()), { kind: "complete", value: [3] });
  assert.deepEqual(readType(interner, 3), shape(3, integer));
  assert.deepEqual(readType(interner, input), shape(0, 1));
  assert.deepEqual(substitute(interner, [input], bindings, limits()), { kind: "complete", value: [3] });
  const cycle = createTypeInterner();
  const root = internType(cycle, { kind: "array", element: 0, readonly: false });
  assert.deepEqual(substitute(cycle, [root], emptyBindings(), limits({ maximumDepth: 0, maximumVisits: 1 })),
    { kind: "complete", value: [root] });
});

test("each substitution limit accepts its boundary and refuses one-past with the full outcome before publication", () => {
  const interner = createTypeInterner();
  const integer = internType(interner, primitive);
  const string = internType(interner, { kind: "string" });
  const array = internType(interner, { kind: "array", element: integer, readonly: true });
  const union = internType(interner, { kind: "union", members: [integer, string] });
  const intersection = internType(interner, { kind: "intersection", members: [integer, string] });
  const boundaries = [
    [integer, { maximumDepth: 0 }, { kind: "complete", value: integer }],
    [integer, { maximumDepth: -0 }, { kind: "complete", value: integer }],
    [integer, { maximumVisits: 1 }, { kind: "complete", value: integer }],
    [integer, { maximumVisits: 0 }, { kind: "resource-limit", dimension: "visits", maximum: 0 }],
    [integer, { maximumVisits: -0 }, { kind: "resource-limit", dimension: "visits", maximum: -0 }],
    [array, { maximumDepth: 1 }, { kind: "complete", value: array }],
    [array, { maximumDepth: 0 }, { kind: "resource-limit", dimension: "depth", maximum: 0 }],
    [array, { maximumVisits: 2 }, { kind: "complete", value: array }],
    [array, { maximumVisits: 1 }, { kind: "resource-limit", dimension: "visits", maximum: 1 }],
    [union, { maximumUnionMembers: 2 }, { kind: "complete", value: union }],
    [union, { maximumUnionMembers: 1 }, { kind: "resource-limit", dimension: "union-members", maximum: 1 }],
    [intersection, { maximumIntersectionMembers: 2 }, { kind: "complete", value: intersection }],
    [intersection, { maximumIntersectionMembers: 1 }, { kind: "resource-limit", dimension: "intersection-members", maximum: 1 }],
  ];
  for (const [input, maximum, expected] of boundaries) {
    const before = completePublication(exportTypes(interner, publicationLimits));
    assert.deepEqual(substitute(interner, [input], emptyBindings(), limits(maximum)), (expected.kind === "complete" ? { kind: "complete", value: [expected.value] } : expected));
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), before);
  }
  for (const field of ["maximumDepth", "maximumVisits", "maximumUnionMembers", "maximumIntersectionMembers"])
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity, 9007199254740992])
      assert.throws(() => substitute(interner, [array], emptyBindings(), limits({ [field]: value })),
        { name: "TypeError", message: "ir-types: expansion maxima must be nonnegative safe integers." });
  const parameter = { owner, index: 0 };
  assert.throws(() => substitute(interner, [array], { ...emptyBindings(), classBindings: [
    { kind: "rigid", parameter }, { kind: "bound", parameter, type: integer }], }, limits()), /each owner-qualified parameter once/u);
  assert.throws(() => substitute(interner, [array], { ...emptyBindings(), selfBindings: [
    { kind: "rigid", owner }, { kind: "bound", owner, type: integer }], }, limits()), /each lexical self owner once/u);
});

test("union and intersection expansion limits are checked on new flattened members before any row publishes", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    const parameter = { owner, index: 0 };
    const free = internType(interner, { kind: "param", parameter });
    const string = internType(interner, { kind: "string" });
    const integer = internType(interner, primitive);
    const boolean = internType(interner, { kind: "primitive", primitive: "bool" });
    const replacement = internType(interner, { kind, members: [integer, boolean] });
    const input = internType(interner, { kind, members: [free, string] });
    const expected = internType(interner, { kind, members: [boolean, integer, string] });
    const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: replacement }] };
    const dimension = kind === "union" ? "union-members" : "intersection-members";
    const maximum = kind === "union" ? "maximumUnionMembers" : "maximumIntersectionMembers";
    const before = completePublication(exportTypes(interner, publicationLimits));
    assert.deepEqual(substitute(interner, [input], bindings, limits({ [maximum]: 2 })),
      { kind: "resource-limit", dimension, maximum: 2 });
    assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), before);
    assert.deepEqual(substitute(interner, [input], bindings, limits({ [maximum]: 3 })), { kind: "complete", value: [expected] });
    assert.deepEqual(readType(interner, expected), { kind, members: [string, integer, boolean] });
    assert.deepEqual(readType(interner, input), { kind, members: [free, string] });
  }
});

test("changed staged chains repair parents by events with exact total-visit boundaries and no intermediate publication", () => {
  const count = 10000;
  const interner = createTypeInterner();
  const parameter = { owner, index: 0 };
  let original = internType(interner, { kind: "param", parameter });
  for (let index = 1; index <= count; index += 1) {
    original = internType(interner, { kind: "array", element: original, readonly: false });
    assert.equal(original, index);
  }
  const integer = internType(interner, primitive);
  assert.equal(integer, count + 1);
  let expected = integer;
  for (let index = 1; index <= count; index += 1) {
    expected = internType(interner, { kind: "array", element: expected, readonly: false });
    assert.equal(expected, count + 1 + index);
  }
  const issued = Array.from({ length: 2 * count + 2 }, (_, type) => readType(interner, type));
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: integer }] };
  assert.deepEqual(substitute(interner, [original], bindings, limits({ maximumDepth: count + 1, maximumVisits: 3 * count })),
    { kind: "resource-limit", dimension: "visits", maximum: 3 * count });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "refusal preserves every original complete row");
  assert.deepEqual(substitute(interner, [original], bindings, limits({ maximumDepth: count + 1, maximumVisits: 3 * count + 1 })),
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
      const parameter = { kind: "param", parameter: { owner, index: 0 } };
      const free = internType(interner, parameter);
      const integer = internType(interner, primitive);
      const fixed = element => ({ kind: "fixed-array", element, extent: { length: 3n, runtimeBase: "number" } });
      const array = element => ({ kind: "array", element, readonly: false });
      const arrayFirst = order[0] === "array";
      const initial = [parameter, primitive, ...order.map(name => name === "array" ? array(free) : fixed(free)),
        { kind, members: [2, 3] }, array(integer)];
      assert.deepEqual(order.map(name => internType(interner, name === "array" ? array(free) : fixed(free))), [2, 3]);
      const original = internType(interner, { kind, members: [3, 2] });
      assert.equal(original, 4);
      assert.equal(internType(interner, array(integer)), 5);
      const issued = Array.from({ length: 6 }, (_, type) => readType(interner, type));
      assert.deepEqual(issued, initial);
      const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter: parameter.parameter, type: integer }] };
      const resultId = arrayFirst ? 6 : 7;
      const fixedId = arrayFirst ? 7 : 6;
      const final = [...initial, ...(arrayFirst ? [{ kind, members: [5, 7] }, fixed(integer)]
        : [fixed(integer), { kind, members: [5, 6] }])];
      assert.deepEqual(substitute(interner, [original], bindings, limits()), { kind: "complete", value: [resultId] });
      assert.deepEqual(Array.from({ length: 8 }, (_, type) => readType(interner, type)), final);
      assert.deepEqual(final.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7]);
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
  const parameters = Array.from({ length: count }, (_, index) => ({ owner, index }));
  assert.deepEqual(parameters.map(parameter => internType(interner, { kind: "param", parameter })),
    Array.from({ length: count }, (_, index) => index));
  const expected = internType(interner, primitive);
  assert.equal(expected, count);
  const bindings = { ...emptyBindings(), classBindings: parameters.map((parameter, index) => ({
    kind: "bound", parameter, type: index + 1 })) };
  const issued = Array.from({ length: count + 1 }, (_, type) => readType(interner, type));
  assert.deepEqual(substitute(interner, [0], bindings, limits({ maximumDepth: count, maximumVisits: count })),
    { kind: "resource-limit", dimension: "visits", maximum: count });
  assert.deepEqual(substitute(interner, [0], bindings, limits({ maximumDepth: count, maximumVisits: count + 1 })),
    { kind: "complete", value: [expected] });
  assert.equal(issued.every((row, type) => readType(interner, type) === row), true, "all qualified input identities and rows remain unchanged");
  assert.throws(() => readType(interner, count + 1), /outside this arena/u);
});

test("a recursive bound replacement becomes rigid at its own exact owner without an invented parameter", () => {
  const interner = createTypeInterner();
  const parameter = { owner, index: 0 };
  const free = internType(interner, { kind: "param", parameter });
  const replacement = internType(interner, { kind: "array", element: free, readonly: false });
  assert.deepEqual(substitute(interner, [free], { ...emptyBindings(), classBindings: [
    { kind: "bound", parameter, type: replacement }], }, limits()), { kind: "complete", value: [replacement] });
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
  const family = { origin: "authored", component: { root: source, path: [] }, parameters: [{ owner, index: 0 }],
    roles: [{ authoredIndex: 1, component: source, member: 0 }] };
  const projection = { kind: "projection", source: 0, projection: { kind: "component", component: { root: source,
    path: [{ kind: "sum-arm", family, index: 0 }] } } };
  assert.deepEqual(verifyTypes(verification([projection])),
    [violation("sum-arm-order", typeSite(0), "family.roles.authoredIndex", 1)]);
});

test("typed sparse nested vectors report their genuine enclosing owner and actual missing position", () => {
  const hole = () => new Array(1);
  assert.deepEqual(verifyTypes(verification([primitive], { bindings: hole() })),
    [violation("binding-vector-complete", { kind: "binding", vector: 0, family: null, position: null }, "bindings", 0)]);
  assert.deepEqual(verifyTypes(verification([primitive], { evidence: hole() })),
    [violation("evidence-type", { kind: "evidence", position: 0, source: null }, "evidence", 0)]);
  for (const [family, scopeField] of [["classBindings", "classParameters"], ["methodBindings", "methodParameters"],
    ["capturedBindings", "capturedParameters"]]) {
    const scope = { ...emptyScope(), [scopeField]: [{ owner, index: 0 }] };
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
  const scope = { classParameters: [{ owner, index: 0 }, { owner, index: 1 }],
    methodParameters: [{ owner: method, index: 0 }, { owner: method, index: 1 }],
    capturedParameters: [{ owner: captured, index: 0 }, { owner: captured, index: 1 }], selfOwners: [owner, other] };
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
  assert.deepEqual([internType(interner, primitive), internType(interner, { kind: "string" }),
    internType(interner, { kind: "union", members: [0, 1] })], [0, 1, 2]);
  const expected = { table: { terms: [primitive, { kind: "string" }, { kind: "union", members: [0, 1] }],
    signatures: [] }, types: [0, 1, 2], signatures: [] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 4 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 4 });
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 5 }),
    { kind: "complete", value: expected, work: 91, createdRecords: 5 });
  const selected = createTypeInterner();
  assert.equal(internType(selected, primitive), 0);
  assert.equal(internSignature(selected, signature({ receiver: 0, result: 0,
    typeParameters: [{ identity: { owner, index: 0 }, declaration: method, constraint: 0, default: 0 }],
    parameters: [{ declaration: method, kind: "required", type: 0, passing: "by-value", initializer: null }] })), 0);
  assert.equal(internType(selected, { kind: "callable", calls: [0], constructs: [] }), 1);
  const table = { terms: [{ kind: "callable", calls: [0], constructs: [] }, primitive], signatures: [{ id: 0,
    ...signature({ receiver: 1, result: 1, typeParameters: [{ identity: { owner, index: 0 }, declaration: method,
      constraint: 1, default: 1 }], parameters: [{ declaration: method, kind: "required", type: 1, passing: "by-value", initializer: null }] }) }] };
  assert.deepEqual(exportTypes(selected, { ...publicationLimits, maximumCreatedRecords: 8 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 8 });
  assert.deepEqual(completePublication(exportTypes(selected, { ...publicationLimits, maximumCreatedRecords: 9 })),
    { table, types: [1, 0], signatures: [0] });
});

test("the publication event meter bounds inline selectors and does not charge label encoding or copies", () => {
  const selectorArena = createTypeInterner();
  const selectorRow = { kind: "projection", source: 0,
    projection: { kind: "component", component: { root: source, path: [{ kind: "array-element" }] } } };
  assert.deepEqual([internType(selectorArena, primitive), internType(selectorArena, selectorRow)], [0, 1]);
  // Before the first selector: primitive row/fields 3 + projection row 1 + its eleven inline fields = 15.
  assert.deepEqual(exportTypes(selectorArena, { maximumCreatedRecords: 3, maximumWork: 15 }),
    { kind: "resource-limit", dimension: "work", maximum: 15 });
  assert.deepEqual([readType(selectorArena, 0), readType(selectorArena, 1)], [primitive, selectorRow]);
  for (const count of [0, 8, 100001]) {
    const interner = createTypeInterner();
    const path = Array.from({ length: count }, () => ({ kind: "array-element" }));
    const projection = { kind: "projection", source: 0, projection: { kind: "component", component: { root: source, path } } };
    assert.equal(internType(interner, primitive), 0);
    assert.equal(internType(interner, projection), 1);
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
    assert.equal(internType(interner, row), 0);
    // Read 6 + partition (6 + 1) + normalization (6 + 6 + 1) + final ordering (6 + 1 + 1 + 1) = 35, independent of label length.
    assert.deepEqual(exportTypes(interner, { maximumCreatedRecords: 1, maximumWork: 34 }),
      { kind: "resource-limit", dimension: "work", maximum: 34 });
    assert.equal(compareCaseValues(exportTypes(interner, { maximumCreatedRecords: 1, maximumWork: 35 }),
      { kind: "complete", value: { table: { terms: [row], signatures: [] }, types: [0], signatures: [] }, work: 35, createdRecords: 1 }),
      true, "entire long-label publication outcome");
    assert.equal(compareCaseValues(parseTypes(printTypes({ terms: [row], signatures: [] })),
      { kind: "parsed", value: { terms: [row], signatures: [] } }), true, "entire unmetered public nominal text roundtrip");
  }
});

test("native owned arena reads reject invalid public references without accepting forged storage", () => {
  const interner = createTypeInterner();
  assert.equal(internType(interner, primitive), 0);
  assert.equal(internSignature(interner, signature()), 0);
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
    assert.deepEqual(parsed.value.terms.map(row => internType(interner, row)), [0]);
    assert.throws(() => exportTypes(interner, publicationLimits), reference === 100
      ? /complete arena reference/u : /issued nonnegative arena reference/u);
  }
  assert.throws(() => printTypes({ terms: new Array(1), signatures: [] }), /arrays must be dense/u);
});

test("new substituted signature rows retain every nested role before any expected row is interned", () => {
  const interner = createTypeInterner();
  const parameter = { owner, index: 0 };
  assert.deepEqual([internType(interner, { kind: "param", parameter }), internType(interner, primitive)], [0, 1]);
  const child = signature({ result: 0 });
  const parent = signature({ declaration: method, owner: source, composition: { kind: "union", signatures: [0] },
    typeParameters: [{ identity: { owner: method, index: 0 }, declaration: method, constraint: 0, default: 0 }],
    receiver: 0, parameters: [{ declaration: method, kind: "required", type: 0, passing: "borrow-shared", initializer: null }], result: 0 });
  assert.deepEqual([internSignature(interner, child), internSignature(interner, parent)], [0, 1]);
  assert.equal(internType(interner, { kind: "callable", calls: [1], constructs: [] }), 2);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  const expectedChild = { id: 3, ...signature({ result: 1 }) };
  const expectedParent = { id: 2, ...signature({ ...parent, composition: { kind: "union", signatures: [3] },
    typeParameters: [{ identity: { owner: method, index: 0 }, declaration: method, constraint: 1, default: 1 }],
    receiver: 1, parameters: [{ declaration: method, kind: "required", type: 1, passing: "borrow-shared", initializer: null }], result: 1 }) };
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1), readSignature(interner, 2), readSignature(interner, 3)],
    [{ id: 0, ...child }, { id: 1, ...parent }, expectedParent, expectedChild]);
  assert.deepEqual(readType(interner, 3), { kind: "callable", calls: [2], constructs: [] });
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  assert.equal(internSignature(interner, expectedParent), 2);
  assert.equal(internSignature(interner, expectedChild), 3);
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
      typeParameters: [{ identity: { owner: method, index: 0 }, declaration: method, constraint: type, default: type }],
      receiver: type, parameters: [{ declaration: method, kind: "required", type, passing: "borrow-shared", initializer: null }], result: type }) };
  assert.deepEqual(published.table, { terms, signatures });
});

test("shared substitution paths enforce depth at both memoized and first depth-first visits", () => {
  for (const members of [[1, 2], [2, 1]]) {
    const interner = createTypeInterner();
    const rows = [primitive, { kind: "array", element: 0, readonly: false }, { kind: "array", element: 1, readonly: false },
      { kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false }];
    assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3]);
    assert.deepEqual(substitute(interner, [3], emptyBindings(), limits({ maximumDepth: 2 })),
      { kind: "resource-limit", dimension: "depth", maximum: 2 });
    assert.deepEqual(substitute(interner, [3], emptyBindings(), limits({ maximumDepth: 3 })), { kind: "complete", value: [3] });
    assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
  }
});

test("nested signature binders share both trie branches and block a repeated qualified binder", () => {
  const interner = createTypeInterner();
  const parameters = [{ owner, index: 0 }, { owner, index: 1 }];
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2]);
  const typeParameters = parameters.map((identity, index) => ({ identity, declaration: index === 0 ? method : captured,
    constraint: null, default: null }));
  const child = signature({ typeParameters: [typeParameters[0]], result: 0 });
  const parent = signature({ typeParameters, composition: { kind: "intersection", signatures: [0] }, receiver: 1, result: 1 });
  assert.deepEqual([internSignature(interner, child), internSignature(interner, parent)], [0, 1]);
  const callable = { kind: "callable", calls: [1], constructs: [] };
  assert.equal(internType(interner, callable), 3);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
  assert.deepEqual(substitute(interner, [3], bindings, limits()), { kind: "complete", value: [3] });
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
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), {
    table: { terms: [declared(0), tuple([1, 1, 0])], signatures: [] },
    types: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0], signatures: [] });
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
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
    ['TypeTable(terms=[param(parameter=TypeParameterIdentity(owner=def:' + JSON.stringify(owner) + ', index=', 'false', '))], signatures=[])', ["number"]],
    [componentPrefix, 'foreign()', componentSuffix, ["body", "item"]],
    [componentPrefix + 'body(value=', `ItemNodeRef(body=body:${JSON.stringify(body)}, node=n:0)`, ')' + componentSuffix, ["NodeRef"]],
    ['TypeTable(terms=[], signatures=[', 'SignatureInput', '(id=sig:0, declaration=null, owner=null, composition=null, kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])', ["Signature"]],
    ['TypeTable(terms=[param(parameter=TypeParameterIdentity(owner=def:' + JSON.stringify(owner) + ', index=', '@', '))], signatures=[])', ["number"]],
    ['TypeTable(terms=[param(parameter=TypeParameterIdentity(owner=def:' + JSON.stringify(owner) + ', index=', '1e999', '))], signatures=[])', ["finite number", "bigint"]],
    [componentPrefix + 'body(value=NodeRef(body=', 'body:"invalid"', ', node=n:0))' + componentSuffix, ["canonical body identity"]],
    [componentPrefix + 'body(value=NodeRef(body=', 'body:0', ', node=n:0))' + componentSuffix, ["canonical body identity"]],
    [memberPrefix, 'foreign()', memberSuffix, ["text", "number", "symbol"]],
    [memberPrefix + 'text(value="x"), origins=[', 'foreign()', '], readOrigins=[], writeOrigins=[], kind="property", read=t:0, write=null, optional=false, readonly=true)], indexes=[], calls=[], constructs=[])], signatures=[])', ["declared", "class-prototype", "mapped"]],
    [signaturePrefix + 'null, composition=', 'foreign()', ', kind="call", typeParameters=[], receiver=null, parameters=[], result=t:0)])', ["union", "intersection"]],
    ['TypeTable(terms=[projection(source=t:0, projection=', 'foreign()', ')], signatures=[])', ["awaited", "component"]],
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
  const family = { origin: "authored", component: { root: itemSource, path: [] }, parameters: [{ owner, index: 0 }],
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
    [{ owner, index: 0 }, { owner, index: 0 }]])
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

test("publication repairs a shape's complete ordered payload after a compound child aliases", () => {
  const interner = createTypeInterner();
  const nominal = argument => ({ kind: "declared", definition: owner, arguments: [argument], facet: "instance", extent: null });
  assert.deepEqual([internType(interner, nominal(0)), internType(interner, nominal(1)),
    internType(interner, { kind: "union", members: [0, 1] })], [0, 1, 2]);
  assert.deepEqual([internSignature(interner, signature({ result: 2 })),
    internSignature(interner, signature({ kind: "construct", result: 2 }))], [0, 1]);
  const origin = { kind: "declared", declaration: owner };
  const member = (name, type) => ({ key: { kind: "text", value: name }, origins: [origin], readOrigins: [origin], writeOrigins: [origin],
    kind: "property", read: type, write: type, optional: false, readonly: false });
  const index = (declaration, type) => ({ declaration, key: type, read: type, write: type, readonly: false });
  const shape = type => ({ kind: "shape", members: [member("a", type), member("b", type)],
    indexes: [index(owner, type), index(method, type)], calls: [0], constructs: [1] });
  assert.equal(internType(interner, shape(2)), 3);
  const table = { terms: [nominal(0), shape(0)], signatures: [{ id: 0, ...signature({ result: 0 }) },
    { id: 1, ...signature({ kind: "construct", result: 0 }) }] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 18 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 18 });
  assert.deepEqual(completePublication(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 19 })),
    { table, types: [0, 0, 0, 1], signatures: [0, 1] });
  assert.deepEqual(readType(interner, 3), shape(2));
});

test("verifier reads complete signatures, writable indexes and optional/rest ordering without inferred fields", () => {
  const typeParameters = [{ identity: { owner, index: 0 }, declaration: owner, constraint: 0, default: 0 }];
  const full = { id: 0, ...signature({ typeParameters, receiver: 0, composition: { kind: "intersection", signatures: [0] },
    parameters: [{ declaration: method, kind: "optional", type: 0, passing: "by-value", initializer: null },
      { declaration: captured, kind: "rest", type: 0, passing: "move", initializer: null }] }) };
  const table = signatures => ({ terms: [primitive], signatures });
  assert.deepEqual(verifyTypes({ table: table([full]), bindings: [], evidence: [] }), []);
  for (const selected of [{ ...full, receiver: 2 }, { ...full, result: 2 },
    { ...full, typeParameters: [{ ...typeParameters[0], constraint: 2 }] },
    { ...full, typeParameters: [{ ...typeParameters[0], default: 2 }] },
    { ...full, parameters: [{ declaration: method, kind: "required", type: 2, passing: "by-value", initializer: null }] }])
    assert.deepEqual(verifyTypes({ table: table([selected]), bindings: [], evidence: [] }),
      [violation("type-reference", signatureSite(0), "reference", 2)]);
  assert.deepEqual(verifyTypes({ table: table([{ ...full, composition: { kind: "union", signatures: [1, 0] } }]), bindings: [], evidence: [] }),
    [violation("signature-order", signatureSite(0), "composition.signatures"), violation("signature-reference", signatureSite(0), "reference", 1)]);
  for (const kind of ["call", "construct"]) {
    const callable = { kind: "callable", calls: kind === "construct" ? [0] : [], constructs: kind === "call" ? [0] : [] };
    assert.deepEqual(verifyTypes({ table: { terms: [primitive, callable], signatures: [{ id: 0, ...signature({ kind }) }] }, bindings: [], evidence: [] }),
      [violation("signature-order", typeSite(1), kind === "call" ? "constructs" : "calls")]);
  }
  const writable = { kind: "shape", members: [], indexes: [{ declaration: owner, key: 0, read: 0, write: 0, readonly: false }], calls: [], constructs: [] };
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
    [violation("parameter-identity", typeSite(0), "parameter.index", index)]);
  const parameter = { owner, index: 0 };
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
    assert.equal(internType(interner, primitive), 0);
    assert.equal(internType(interner, row), 1);
    // Read 9 + partition (10 + 5) + normalization (10 + 3 + 8 + 2) + final ordering (10 + 5 + 3 + 1 + 2) = 68, independent of bigint width.
    assert.deepEqual(exportTypes(interner, { maximumCreatedRecords: 3, maximumWork: 67 }),
      { kind: "resource-limit", dimension: "work", maximum: 67 });
    const result = exportTypes(interner, { maximumCreatedRecords: 3, maximumWork: 68 });
    const expected = { kind: "complete", value: { table: { terms: [{ ...row, base: 1 }, primitive], signatures: [] },
      types: [1, 0], signatures: [] }, work: 68, createdRecords: 3 };
    assert.equal(compareCaseValues(result, expected), true, "entire signed bigint publication outcome");
    assert.equal(compareCaseValues(readType(interner, 1), row), true, "complete issued bigint row remains unchanged");
  }
});

test("signature parent notifications follow a newly normalized compound rather than a prebuilt result", () => {
  const interner = createTypeInterner();
  const parameters = [{ owner, index: 0 }, { owner, index: 1 }];
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive, { kind: "union", members: [0, 1] }];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3]);
  assert.equal(internSignature(interner, signature({ result: 3 })), 0);
  const original = { kind: "callable", calls: [0], constructs: [] };
  assert.equal(internType(interner, original), 4);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
  assert.deepEqual(substitute(interner, [4], bindings, limits()), { kind: "complete", value: [5] });
  assert.deepEqual(Array.from({ length: 6 }, (_, type) => readType(interner, type)), [...rows, original,
    { kind: "callable", calls: [1], constructs: [] }]);
  assert.deepEqual([readSignature(interner, 0), readSignature(interner, 1)],
    [{ id: 0, ...signature({ result: 3 }) }, { id: 1, ...signature({ result: 2 }) }]);
});

test("alternating compound parents collapse complete staged aliases without publishing intermediates", () => {
  const interner = createTypeInterner();
  const parameters = Array.from({ length: 4 }, (_, index) => ({ owner, index }));
  const tuple = members => ({ kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  const rows = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive,
    { kind: "intersection", members: [0, 1] }, { kind: "union", members: [2, 3] },
    { kind: "union", members: [2, 5] }, { kind: "intersection", members: [0, 6] }, tuple([7, 8, 5, 6])];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 4 })) };
  assert.deepEqual(substitute(interner, [9], bindings, limits()), { kind: "complete", value: [10] });
  assert.deepEqual(readType(interner, 10), tuple([4, 4, 4, 4]));
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
  assert.throws(() => readType(interner, 11), /outside this arena/u);
});

test("least publication closure absorbs optional children exposed by a bisimilar intersection", () => {
  const interner = createTypeInterner();
  const rows = [{ kind: "array", element: 1, readonly: false }, { kind: "array", element: 0, readonly: false },
    { kind: "optional", value: 0 }, { kind: "optional", value: 1 }, { kind: "intersection", members: [2, 3] },
    { kind: "string" }, { kind: "union", members: [4, 5] }];
  assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6]);
  const table = { terms: [{ kind: "array", element: 0, readonly: false }, { kind: "optional", value: 0 },
    { kind: "optional", value: 4 }, { kind: "string" }, { kind: "union", members: [0, 3] }], signatures: [] };
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 9 }),
    { kind: "resource-limit", dimension: "created-records", maximum: 9 });
  assert.deepEqual(exportTypes(interner, { ...publicationLimits, maximumCreatedRecords: 10 }),
    { kind: "complete", value: { table, types: [0, 0, 1, 1, 1, 3, 2], signatures: [] }, work: 286, createdRecords: 10 });
  assert.deepEqual(rows.map((_, type) => readType(interner, type)), rows);
});

test("independent native arenas own their typed indexes and substitution caches", () => {
  const first = createTypeInterner();
  const second = createTypeInterner();
  assert.equal(internType(first, primitive), 0);
  assert.equal(internType(second, { kind: "string" }), 0);
  assert.deepEqual(readType(first, 0), primitive);
  assert.deepEqual(readType(second, 0), { kind: "string" });
  assert.equal(internType(first, { kind: "string" }), 1);
  assert.equal(internType(second, primitive), 1);
  assert.deepEqual([readType(first, 1), readType(second, 1)], [{ kind: "string" }, primitive]);
});

test("a seeded signature must retain its own arena position", () => {
  const interner = seedTypeInterner({ terms: [primitive], signatures: [{ id: 1, ...signature() }] });
  const failure = { name: "Error", message: "ir-types: signature row 0 is not a complete Signature with its own ID." };
  assert.throws(() => readSignature(interner, 0), failure);
  assert.throws(() => exportTypes(interner, publicationLimits), failure);
});

test("mixed staged compounds redirect through a live target and compress the resulting two-hop alias", () => {
  for (const kind of ["union", "intersection"]) {
    const interner = createTypeInterner();
    const parameter = { owner, index: 0 };
    const fixed = element => ({ kind: "fixed-array", element, extent: { length: 3n, runtimeBase: "number" } });
    const array = element => ({ kind: "array", element, readonly: false });
    const tuple = members => ({ kind: "tuple", elements: members.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
    const rows = [{ kind: "param", parameter }, primitive, fixed(0), array(0), { kind, members: [2, 3] }, array(1), fixed(1),
      { kind, members: [5, 6] }, { kind, members: [2, 5] }, tuple([4, 8])];
    assert.deepEqual(rows.map(row => internType(interner, row)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
    assert.deepEqual(substitute(interner, [9], bindings, limits()), { kind: "complete", value: [10] });
    assert.deepEqual(Array.from({ length: 11 }, (_, type) => readType(interner, type)), [...rows, tuple([7, 7])]);
    assert.equal(internType(interner, tuple([7, 7])), 10);
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
        const types = input.terms.map(term => internType(interner, term));
        const signatures = input.signatures.map(signature => internSignature(interner, signature));
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
  const parameters = [{ owner, index: 0 }, { owner, index: 1 }];
  for (const order of [[0, 1], [1, 0]]) {
    const interner = createTypeInterner();
    const originals = [...parameters.map(parameter => ({ kind: "param", parameter })), primitive,
      { kind: "callable", calls: [0, 1], constructs: [] }];
    assert.deepEqual(originals.slice(0, 3).map(row => internType(interner, row)), [0, 1, 2]);
    assert.deepEqual(order.map(result => internSignature(interner, signature({ result }))), [0, 1]);
    assert.equal(internType(interner, originals[3]), 3);
    const bindings = { ...emptyBindings(), classBindings: parameters.map(parameter => ({ kind: "bound", parameter, type: 2 })) };
    assert.deepEqual(substitute(interner, [3], bindings, limits()), { kind: "complete", value: [4] });
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
    assert.deepEqual(substitute(interner, [3], bindings, limits()), { kind: "complete", value: [4] });
    assert.equal(internSignature(interner, signature({ result: 2 })), 2);
    assert.equal(internType(interner, final), 4);
  }
});

test("a changed callable compacts an unchanged existing signature alongside a genuinely new one", () => {
  const interner = createTypeInterner();
  const parameter = { owner, index: 0 };
  const parameterTerm = { kind: "param", parameter };
  const original = { kind: "callable", calls: [0, 1], constructs: [] };
  const retained = signature({ declaration: method, result: 1 });
  const changed = signature({ result: 0 });
  assert.deepEqual([internType(interner, parameterTerm), internType(interner, primitive)], [0, 1]);
  assert.deepEqual([internSignature(interner, retained), internSignature(interner, changed)], [0, 1]);
  assert.equal(internType(interner, original), 2);
  const bindings = { ...emptyBindings(), classBindings: [{ kind: "bound", parameter, type: 1 }] };
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  const final = { kind: "callable", calls: [0, 2], constructs: [] };
  assert.deepEqual(Array.from({ length: 4 }, (_, identity) => readType(interner, identity)), [parameterTerm, primitive, original, final]);
  assert.deepEqual(Array.from({ length: 3 }, (_, identity) => readSignature(interner, identity)),
    [{ id: 0, ...retained }, { id: 1, ...changed }, { id: 2, ...signature({ result: 1 }) }]);
  assert.deepEqual(completePublication(exportTypes(interner, publicationLimits)), {
    table: { terms: [final, original, parameterTerm, primitive],
      signatures: [{ id: 0, ...signature({ declaration: method, result: 3 }) },
        { id: 1, ...signature({ result: 2 }) }, { id: 2, ...signature({ result: 3 }) }] },
    types: [2, 3, 1, 0], signatures: [0, 1, 2] });
  assert.deepEqual(substitute(interner, [2], bindings, limits()), { kind: "complete", value: [3] });
  assert.equal(internSignature(interner, signature({ result: 1 })), 2);
  assert.equal(internType(interner, final), 3);
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
      "), array(element=t:0, readonly=0)], signatures=[])", ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"]],
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
  const index = "TypeTable(terms=[shape(members=[], indexes=[IndexSignature(declaration=def:" + JSON.stringify(owner)
    + ", key=t:0, read=t:0, write=null, ";
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
  const parameter = { declaration: owner, kind: "required", type: 0, passing: "by-value", initializer: null };
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
      ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"],
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
      ', type=t:0, passing="by-value", initializer=null' + afterParameter,
      ["required", "optional", "default", "rest"], row("call", [parameter])],
    ["tuple kind", "TypeTable(terms=[tuple(elements=[TupleElement(kind=",
      ", type=t:0, declaration=null)], readonly=false)], signatures=[])",
      ["required", "optional", "rest"], { terms: [{ kind: "tuple", elements: [
        { kind: "required", type: 0, declaration: null }], readonly: false }], signatures: [] }],
    ["passing", beforeParameter + 'kind="required", type=t:0, passing=', ", initializer=null" + afterParameter,
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
    ["number", "TypeTable(terms=[param(parameter=TypeParameterIdentity(owner=def:" + JSON.stringify(owner) + ", index=",
      "))], signatures=[])", ["number"]],
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
  assert.equal(internType(interner, primitive), 0);
  const component = { root: source, path: [] };
  component.path.push({ kind: "sum-arm", family: { origin: "authored", component, parameters: [], roles: [] }, index: 0 });
  const row = { kind: "projection", source: 0, projection: { kind: "component", component } };
  assert.throws(() => internType(interner, row), { name: "TypeError", message: "Inline cycle at $.projection.component.path[0].family.component" });
  assert.deepEqual(readType(interner, 0), primitive);
});

test("the one selector-path encoding: each selector is one array beginning with its kind; equal paths are equal and every differing field differs", () => {
  const body = encodeBodyId({ owner: definition("Selected"), role: "function", ordinal: 0 });
  const otherBody = encodeBodyId({ owner: definition("Selected"), role: "function", ordinal: 1 });
  const node = (in_, number) => ({ kind: "body", value: { body: in_, node: number } });
  const item = (name, number) => ({ kind: "item", value: { owner: definition(name), node: number } });
  const construction = (number, captures) => ({ occurrence: { body, node: number }, captures });
  const family = (origin, path, extra = {}) => ({ origin, component: { root: node(body, 1), path },
    parameters: [{ owner: definition("Sum"), index: 0 }], roles: [{ authoredIndex: 0, component: item("Sum", 2), member: 5 }], ...extra });
  assert.deepEqual(encodeSelectorPath([]), []);
  assert.deepEqual(encodeSelectorPath([{ kind: "tuple-element", index: 2 }, { kind: "awaited" }]), [["tuple-element", 2], ["awaited"]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "k" } } }]),
    [["member", ["mapped", ["body", body, 7], ["text", "k"]]]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "construction-argument", definition: construction(3, [{ body, local: 4 }]), index: 1 }]),
    [["construction-argument", [body, 3], [[body, 4]], 1]]);
  assert.deepEqual(encodeSelectorPath([{ kind: "sum-arm", family: family("authored", [{ kind: "optional-value" }]), index: 1 }]),
    [["sum-arm", "authored", ["body", body, 1], [["optional-value"]], [[definition("Sum"), 0]], [[0, ["item", definition("Sum"), 2], 5]], 1]]);
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
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 8), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: item("A", 7), key: { kind: "text", value: "k" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "text", value: "1" } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "number", value: { numerator: 1n, denominator: 2n, negativeZero: false } } } },
    { kind: "member", origin: { kind: "mapped", owner: node(body, 7), key: { kind: "symbol", declaration: definition("A") } } },
    ...["index-key", "index-value"].flatMap(kind => [{ kind, declaration: definition("A") }, { kind, declaration: definition("B") }]),
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
    { kind: "sum-arm", family: family("authored", [], { parameters: [{ owner: definition("Sum"), index: 1 }] }), index: 0 },
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
  let deep = [];
  for (let level = 0; level < 20000; level += 1) deep = [{ kind: "sum-arm", family: family("authored", deep), index: 0 }];
  let depth = 0;
  for (let current = encodeSelectorPath(deep); current.length === 1; current = current[0][3]) depth += 1;
  assert.equal(depth, 20000, "a deeply nested family path is encoded without native recursion");
});

test("the complete real ir-types owner compiles against freshly emitted actual allowed dependency declarations", async () => {
  const areas = JSON.parse(readFileSync(process.env.TSONIC_HOST_QUARANTINE_AREAS
    ?? resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
  const module = hostCatalogue.find(module => module.name === "ir-types");
  const own = ["contract", "data", ...productNames]
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
    files: [resolve(repository, "packages/host/src/ir-types/index.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "producer.json")), { status: 0, diagnostics: "" });
  const imports = 'import type { TypeTable, TypePublication, TypePublicationLimits, TypePublicationResult, TypeInterner, ExportTypes, TypeExpansionLimits, BindingScope, BindingVector, Signature, TypeEvidence, TypeParameterIdentity, TypeVerificationInput, NominalDefinition } from "./declarations/ir-types/contract.js";\nimport type { DefId, TyId } from "./declarations/ids/contract.js";\n';
  write("reader.ts", imports + 'export function read(table: TypeTable, publication: TypePublication, limits: TypeExpansionLimits, scope: BindingScope, bindings: BindingVector, signature: Signature, evidence: TypeEvidence, parameter: TypeParameterIdentity, definition: DefId, type: TyId, input: TypeVerificationInput, nominal: NominalDefinition): number { return table.terms.length + publication.table.terms.length + publication.types.length + publication.signatures.length + limits.maximumDepth + scope.selfOwners.length + bindings.classBindings.length + signature.parameters.length + evidence.type + parameter.index + definition.length + type + nominal.facets.length + (input.nominalOf(definition) === null ? 0 : 1); }\nexport function publish(operation: ExportTypes, interner: TypeInterner, limits: TypePublicationLimits): TypePublicationResult { return operation(interner, limits); }');
  write("inline-reader.ts", "import type { CategoryEvidence, TypeComponent, ComponentSelector, TypeInterner, TypeTerm, Signature, TypeTable, ReadType, ReadSignature } from \"./declarations/ir-types/contract.js\";\nimport type { SourceNodeRef, TyId, SigId } from \"./declarations/ids/contract.js\";\nexport function checkedBoundary(readType: ReadType, readSignature: ReadSignature, interner: TypeInterner, type: TyId, signature: SigId): void { readType(interner, type); readSignature(interner, signature); }\nexport function sparseTable(): TypeTable {\n  return { terms: new Array<TypeTerm>(1), signatures: new Array<Signature>(1) };\n}\nexport function sparseComponent(root: SourceNodeRef): TypeComponent {\n  return { root, path: new Array<ComponentSelector>(1) };\n}\nexport function categoryCycle(): CategoryEvidence { const alternatives: CategoryEvidence[] = []; const value: CategoryEvidence = { kind: \"choice\", alternatives }; alternatives.push(value); return value; }\nexport function componentCycle(root: SourceNodeRef): TypeComponent { const path: ComponentSelector[] = []; const component: TypeComponent = { root, path }; path.push({ kind: \"sum-arm\", family: { origin: \"authored\", component, parameters: [], roles: [] }, index: 0 }); return component; }\n");
  write("seed-reader.ts", 'import { seedTypeInterner, readType, readSignature, substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { SeedTypeInterner, TypeInterner, TypeTable, TypeTerm, Signature, Substitute, SubstituteSignature, TypeTransform, BindingVector, TypeExpansionLimits, TypePublicationResult } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nexport const seed: SeedTypeInterner = seedTypeInterner;\nexport const signatureRoot: SubstituteSignature = substituteSignature;\nexport const typeRoots: Substitute = substitute;\nexport function seeded(table: TypeTable, type: TyId, signature: SigId): readonly [TypeInterner, TypeTerm, Signature] { const interner = seed(table); return [interner, readType(interner, type), readSignature(interner, signature)]; }\nexport function transform(interner: TypeInterner, signatures: readonly SigId[], bindings: BindingVector, limits: TypeExpansionLimits): TypeTransform<readonly SigId[]> { return signatureRoot(interner, signatures, bindings, limits); }\nexport function transformTypes(interner: TypeInterner, types: readonly TyId[], bindings: BindingVector, limits: TypeExpansionLimits): TypeTransform<readonly TyId[]> { return typeRoots(interner, types, bindings, limits); }\nexport function usage(result: TypePublicationResult): readonly [number, number] | null { return result.kind === "complete" ? [result.work, result.createdRecords] : null; }\n');
  write("consumer.json", { extends: resolve(repository, "tsconfig.base.json"), compilerOptions: {
    noEmit: true, types: [], skipLibCheck: false, exactOptionalPropertyTypes: true },
    files: [resolve(stage, "reader.ts"), resolve(stage, "inline-reader.ts"), resolve(stage, "seed-reader.ts")], include: [] });
  assert.deepEqual(run(resolve(stage, "consumer.json")), { status: 0, diagnostics: "" });
  write("reader.ts", imports + 'export function mutate(table: TypeTable, publication: TypePublication, limits: TypeExpansionLimits, scope: BindingScope, bindings: BindingVector, signature: Signature, evidence: TypeEvidence, parameter: TypeParameterIdentity, definition: DefId, type: TyId, input: TypeVerificationInput, nominal: NominalDefinition): void {\ntable.terms.push({ kind: "error" });\ntable.terms[0] = { kind: "error" };\ntable.signatures[0] = signature;\nlimits.maximumDepth = 1;\nscope.selfOwners.push(definition);\nbindings.classBindings[0] = { kind: "rigid", parameter };\nsignature.parameters.push({ declaration: definition, kind: "required", type, passing: "by-value", initializer: null });\nevidence.type = type;\nnominal.facets.push("instance");\ninput.nominalOf = () => null;\npublication.table = { terms: [], signatures: [] };\npublication.types.push(type);\npublication.signatures[0] = signature.id;\npublication.terms.push({ kind: "error" });\n}\nexport function removed(operation: ExportTypes, interner: TypeInterner, limits: TypePublicationLimits, result: TypePublicationResult, publication: TypePublication): void {\noperation(interner);\nresult.table;\nlimits.maximumWork = 1;\nlimits.maximumCreatedRecords = 1;\nif (result.kind === "complete") result.value = publication;\nelse { result.dimension = "work"; result.maximum = 1; }\nresult.kind = "complete";\n}');
  const negative = run(resolve(stage, "consumer.json"));
  assert.equal(negative.status, 1, negative.diagnostics.slice(-8000));
  assert.deepEqual([...negative.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2339, 2542, 2542, 2540, 2339, 2542, 2339, 2540, 2339, 2540, 2540, 2339, 2542, 2339,
      2554, 2339, 2540, 2540, 2540, 2540, 2540, 2540], negative.diagnostics.slice(-8000));
  write("reader.ts", "export {};\n");
  write("seed-reader.ts", 'import { seedTypeInterner, substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { TypeTable, TypeInterner, BindingVector, TypeExpansionLimits, TypePublicationResult, TypePublication } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nexport function forbidden(table: TypeTable, interner: TypeInterner, type: TyId, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits): void { seedTypeInterner(); seedTypeInterner(table, { maximumWork: 1 }); substituteSignature(interner, type, bindings, limits); substitute(interner, signature, bindings, limits); }\nexport function missingBoth(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication }; }\nexport function missingCreated(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication, work: 0 }; }\nexport function missingWork(publication: TypePublication): TypePublicationResult { return { kind: "complete", value: publication, createdRecords: 0 }; }\nexport function frozen(result: TypePublicationResult): void { if (result.kind === "complete") { result.work = 1; result.createdRecords = 1; } }\n');
  const invalidSeed = run(resolve(stage, "consumer.json"));
  assert.equal(invalidSeed.status, 1, invalidSeed.diagnostics.slice(-8000));
  assert.deepEqual([...invalidSeed.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2554, 2554, 2345, 2345, 2322, 2322, 2322, 2540, 2540], invalidSeed.diagnostics.slice(-8000));
  write("seed-reader.ts", 'import { substitute, substituteSignature } from "./declarations/ir-types/index.js";\nimport type { TypeInterner, BindingVector, TypeExpansionLimits } from "./declarations/ir-types/contract.js";\nimport type { TyId, SigId } from "./declarations/ids/contract.js";\nexport function forbidden(interner: TypeInterner, type: TyId, signature: SigId, bindings: BindingVector, limits: TypeExpansionLimits): void {\nsubstitute(interner, type, bindings, limits);\nsubstituteSignature(interner, signature, bindings, limits);\nsubstitute(interner, [signature], bindings, limits);\nsubstituteSignature(interner, [type], bindings, limits);\nconst result = substitute(interner, [type], bindings, limits);\nif (result.kind === "complete") { result.value[0] = type; result.value.push(type); }\n}\n');
  const invalidBatch = run(resolve(stage, "consumer.json"));
  assert.equal(invalidBatch.status, 1, invalidBatch.diagnostics.slice(-8000));
  assert.deepEqual([...invalidBatch.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2345, 2345, 2322, 2322, 2542, 2339], invalidBatch.diagnostics.slice(-8000));
  write("seed-reader.ts", 'import { internType } from "./declarations/ir-types/index.js";\nimport type { TypeInterner } from "./declarations/ir-types/contract.js";\nconst fabricated = { identityKind: "type-interner", terms: [], signatures: [], typeKeys: new Map(), signatureKeys: new Map(), substitutions: new Map() };\nexport const forbidden: TypeInterner = fabricated;\nexport function inaccessible(interner: TypeInterner): void {\n  internType(fabricated, { kind: "string" });\n  interner.typeRows;\n  interner.terms;\n}\n');
  const invalidOwner = run(resolve(stage, "consumer.json"));
  assert.equal(invalidOwner.status, 1, invalidOwner.diagnostics.slice(-8000));
  assert.deepEqual([...invalidOwner.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2739, 2739, 2341, 2576], invalidOwner.diagnostics.slice(-8000));
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
