import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const runtime = fileURLToPath(new URL("../../packages/host/dist/front/lower-members.js", import.meta.url));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let lowerMembers;
let ids;
let types;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ lowerMembers } = await import("../../packages/host/dist/front/lower-members.js"));
  ids = await import("../../packages/host/dist/ids/index.js");
  types = await import("../../packages/host/dist/ir-types/index.js");
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const result = capture.result.filter(script => script.url === pathToFileURL(runtime).href);
    const sources = [];
    for (const script of result) {
      const source = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: source.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) }, [resolve(runtime)], [{ ...capture, result, sources }]);
    assert.equal(result.length, 1);
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 3000));
    assert.equal(report.files[0].lines, 100);
    assert.equal(report.files[0].branches, 100);
    assert.equal(report.files[0].functions, 100);
  } finally { session.disconnect(); }
});

function fixture() {
  const module = ids.encodeModuleId({ package: ids.encodePackageId("/member-conversion"), path: "source.ts" });
  const declaration = ids.encodeDefId({ module, segments: [{ name: "member", ordinal: 0 }] });
  const reference = { module, node: 1 };
  const origin = access => ({ kind: "declaration", declaration: reference, access });
  const interner = types.createTypeInterner();
  const boolean = types.internType(interner, { kind: "primitive", primitive: "bool" });
  const signature = types.internSignature(interner, { declaration, owner: { kind: "item", value: { owner: declaration, node: 1 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: boolean });
  const callable = types.internType(interner, { kind: "callable", calls: [signature], constructs: [] });
  const converted = new Map([boolean, callable].map(type => [type, { type, evidence: { type,
    component: { kind: "item", value: { owner: declaration, node: 1 } }, category: { kind: "dynamic" },
    numeric: null, sum: null, nominal: null, pointer: null } }]));
  const deps = { definitionOf: selected => {
    assert.equal(selected.module, module);
    assert.equal(selected.node, reference.node);
    return declaration;
  }, exportsOf: () => null,
    sourceOccurrenceOf: () => assert.fail("declared member conversion does not select a binding occurrence"),
    definitionOfExport: () => assert.fail("declared member conversion does not select a library export"),
    sourceTextOf: () => assert.fail("declared member conversion does not reparse authored source"),
    libraries: { sources: [] }, types: interner,
    typeExpansion: { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 },
    typePublication: { maximumWork: 100000, maximumCreatedRecords: 100000 },
    literalCapture: { maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 100000 } };
  const member = { key: { kind: "text", value: "member" }, name: "member", origins: [origin("read"), origin("write")],
    declarations: [reference], getters: [], setters: [], optional: false, readonly: false,
    read: { kind: "available", value: boolean }, write: { kind: "available", value: boolean }, readKind: "property" };
  return { deps, converted, member, reference, declaration, boolean, callable, interner, origin };
}

test("constructed declared member conversion retains type absence and unique origin access subsets without changing identities", () => {
  const actual = fixture();
  assert.deepEqual(lowerMembers(actual.deps, [], type => actual.converted.get(type)?.type), []);
  const members = lowerMembers(actual.deps, [actual.member,
    { ...actual.member, key: { kind: "text", value: "readonly" }, readKind: "accessor", readonly: true,
      origins: [actual.origin("read")], write: { kind: "available", value: null } },
    { ...actual.member, key: { kind: "text", value: "writeonly" }, readKind: "accessor",
      origins: [actual.origin("write")], read: { kind: "available", value: null } },
    { ...actual.member, key: { kind: "symbol", declaration: actual.reference, wellKnown: null }, readKind: "method", optional: true,
      read: { kind: "available", value: actual.callable }, write: { kind: "available", value: actual.callable } }], type => actual.converted.get(type)?.type);
  assert.deepEqual(members[0].origins, [{ kind: "declared", declaration: actual.declaration }]);
  assert.deepEqual(members[0].readOrigins, members[0].origins);
  assert.deepEqual(members[0].writeOrigins, members[0].origins);
  assert.equal(members[1].write, null);
  assert.deepEqual(members[1].writeOrigins, []);
  assert.equal(members[2].read, null);
  assert.deepEqual(members[2].readOrigins, []);
  assert.deepEqual(members[3].key, { kind: "symbol", declaration: actual.declaration });
  assert.equal(members[3].optional, true);
  assert.equal(members[3].read, actual.callable);
  types.internType(actual.interner, { kind: "shape", members, indexes: [], calls: [], constructs: [] });
  const findings = types.verifyTypes({ table: types.viewTypes(actual.interner), bindings: [], evidence: [],
    nominalOf: () => null, nodeExists: node => node.kind === "item"
      && node.value.owner === actual.declaration && node.value.node === actual.reference.node, localExists: () => false });
  assert.equal(findings.length, 0);
});

test("constructed member conversion refuses missing type, kind and origin evidence rather than filling absent answers", () => {
  const actual = fixture();
  const lower = changed => lowerMembers(actual.deps, [{ ...actual.member, ...changed }], type => actual.converted.get(type)?.type);
  for (const access of ["read", "write"]) assert.throws(() => lower({ [access]:
    { kind: "unavailable", reason: "incomplete-association", causes: [] } }), /actual captured read\/write type association/u);
  assert.throws(() => lowerMembers(actual.deps, [actual.member], () => undefined), /must complete/u);
  assert.throws(() => lower({ origins: [] }), /actual captured origins/u);
  for (const readKind of ["class-prototype", "mapped", "unavailable"])
    assert.throws(() => lower({ readKind }), /actual selected member kind/u);
  assert.throws(() => lower({ origins: [{ kind: "class-prototype", declaration: actual.reference, facet: "value" }] }),
    /actual declared read\/write origin association/u);
  assert.throws(() => lower({ key: { kind: "numeric", value: { kind: "checker-value", value: 1 } } }),
    /exact numeric binding-member key conversion/u);
});
