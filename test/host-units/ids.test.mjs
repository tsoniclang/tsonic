import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const sourceFiles = ["contract.ts", "identity.ts", "index.ts", "key.ts"].map(name => `packages/host/src/ids/${name}`);
const runtimeFiles = ["identity.js", "index.js", "key.js"].map(name => resolve(repository, "packages/host/dist/ids", name));
const caseDirectory = "test/host-cases/ids/function";
const casePaths = readdirSync(resolve(repository, caseDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${caseDirectory}/${name}`);
const areaData = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const quarantineRoots = areaData.areas.map(area => area.directory);
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product;
let construction;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the complete suite requires aggregate admission");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/ids/index.js");
  construction = await import("../../packages/host/dist/ids/identity.js");
});

function definition(input) {
  const packageId = product.encodePackageId(input.root);
  const module = product.encodeModuleId({ package: packageId, path: input.module });
  return product.encodeDefId({ module, segments: input.segments });
}

function body(input) {
  return product.encodeBodyId({ owner: definition(input.definition), role: input.role, ordinal: input.ordinal });
}

function keyValue(input) {
  if (input.kind === "literal") return input.value;
  if (input.kind === "number") return Number(input.text);
  if (input.kind === "bigint") return BigInt(input.text);
  if (input.kind === "array") return input.items.map(keyValue);
  assert.equal(input.kind, "record", "closed authored key transport");
  return { kind: "record", fields: input.fields.map(([name, value]) => [name, keyValue(value)]) };
}

function evaluate(input) {
  if (input.operation === "keys") return input.values.map(value => product.encodeKey(keyValue(value)));
  if (input.operation === "decode") {
    const decoders = { package: product.decodePackageId, module: product.decodeModuleId, definition: product.decodeDefId,
      body: product.decodeBodyId, group: product.decodeGroupId, component: product.decodeComponentId };
    return input.values.map(value => decoders[value.type](value.text));
  }
  if (input.operation === "deep-key") {
    let inputKey = null;
    for (let depth = 0; depth < input.depth; depth += 1) inputKey = [inputKey];
    const actual = product.encodeKey(inputKey);
    assert.equal(actual === `${"A1:".repeat(input.depth)}N`, true, "complete independently framed deep key");
    return { depth: input.depth, length: actual.length };
  }
  if (input.operation === "deep-identity") {
    const segments = Array.from({ length: input.depth }, () => ({ name: "a", ordinal: 0 }));
    const module = product.encodeModuleId({ package: product.encodePackageId("p"), path: "m" });
    const encoded = product.encodeDefId({ module, segments });
    assert.equal(encoded === `D[M[P[p];m];${"a/".repeat(input.depth - 1)}a]`, true, "complete independent definition-chain spelling");
    const decoded = product.decodeDefId(encoded);
    assert.equal(decoded.kind === "decoded", true, "deep definition is parsed without recursion on segment depth");
    assert.equal(JSON.stringify(decoded.value) === JSON.stringify({ module, segments }), true, "the complete deep path is retained");
    return { depth: input.depth, length: encoded.length };
  }
  assert.equal(input.operation, "encode", "closed authored identity operation");
  return input.values.map(entry => {
    let encoded;
    let decoded;
    if (entry.type === "package") {
      encoded = product.encodePackageId(entry.input);
      decoded = product.decodePackageId(encoded);
    } else if (entry.type === "module") {
      encoded = product.encodeModuleId({ package: product.encodePackageId(entry.input.root), path: entry.input.path });
      decoded = product.decodeModuleId(encoded);
    } else if (entry.type === "definition") {
      encoded = definition(entry.input);
      decoded = product.decodeDefId(encoded);
    } else if (entry.type === "body") {
      encoded = body(entry.input);
      decoded = product.decodeBodyId(encoded);
    } else if (entry.type === "group") {
      encoded = product.encodeGroupId(entry.input.map(body));
      decoded = product.decodeGroupId(encoded);
    } else {
      assert.equal(entry.type, "component", "closed authored identity kind");
      encoded = product.encodeComponentId(entry.input.map(definition));
      decoded = product.decodeComponentId(encoded);
    }
    return { encoded, decoded };
  });
}

for (const path of casePaths) {
  test(`ids authored function case ${basename(path, ".case.json")}`, async () => {
    const deps = {
      modules: ["ids"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => ({ kind: "accepted", value: evaluate(JSON.parse(input.text)), diagnostics: [] }) },
    };
    const result = await runCase(deps, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }));
  });
}

test("ids exact public value inventory contains the thirty-one agreed ports", () => {
  assert.deepEqual(Object.keys(product).sort(), ["decodeBodyId", "decodeComponentId", "decodeDefId", "decodeGroupId",
    "decodeModuleId", "decodePackageId", "encodeBodyId", "encodeComponentId", "encodeDefId", "encodeGroupId",
    "encodeKey", "encodeModuleId", "encodePackageId", "nodeId", "localId", "blockId", "placeId", "tyId", "sigId", "constId", "candidateListId", "producerId", "boundProducerId", "valueContextId", "originsId", "projectionPathId", "openBoundaryId", "layoutId", "memoryFieldId", "libraryTypeId", "expansionId"].sort());
  assert.deepEqual(casePaths.map(path => basename(path, ".case.json")), ["body-identities", "complete-binding-keys",
    "component-identities", "deep-identity", "deep-key", "definition-identities", "group-identities", "malformed-bodies",
    "malformed-components", "malformed-definitions", "malformed-groups", "malformed-modules", "malformed-packages",
    "module-identities", "ordinal-precision", "package-identities", "scalar-keys", "structural-keys"].sort());
});

test("every numeric identity constructor is total and preserves the exact supplied number", () => {
  for (const name of ["nodeId", "localId", "blockId", "placeId", "tyId", "sigId", "constId", "candidateListId", "producerId", "boundProducerId", "valueContextId", "originsId", "projectionPathId", "openBoundaryId", "layoutId", "memoryFieldId", "libraryTypeId"]) {
    for (const value of [0, -0, -1, 1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE, NaN, Infinity, -Infinity]) {
      assert.equal(Object.is(product[name](value), value), true, name + ": exact numerical carrier");
    }
  }
});

test("expansion identity construction is total over the exact supplied string domain", () => {
  for (const value of ["", "expansion-1", "not a wire identity", "\uD800\n\0\uDFFF"]) {
    assert.equal(product.expansionId(value), value);
  }
});

test("zero definition segments and one empty-name segment are distinct complete round trips", () => {
  const module = product.encodeModuleId({ package: product.encodePackageId("p"), path: "m" });
  for (const [segments, expected] of [[[], "D[M[P[p];m]]"], [[{ name: "", ordinal: 0 }], "D[M[P[p];m];]"]]) {
    const encoded = product.encodeDefId({ module, segments });
    assert.equal(encoded, expected);
    const decoded = product.decodeDefId(expected);
    assert.deepEqual(decoded, { kind: "decoded", value: { module: "M[P[p];m]", segments } });
    assert.equal(product.encodeDefId(decoded.value), expected);
  }
});

test("kind-specific private construction validates actual text before acquiring each brand", () => {
  for (const [name, text, message] of [
    ["moduleIdentity", "M[P[x];a/b]", "ids: invalid module identity"],
    ["definitionIdentity", "D[M[P[x];m];a#0]", "ids: invalid definition identity"],
    ["bodyIdentity", "B[D[M[P[x];m];a];unknown;0]", "ids: invalid body identity"],
    ["groupIdentity", "G[P[x]]", "ids: invalid group identity"],
    ["componentIdentity", "C[]", "ids: invalid component identity"],
  ]) assert.throws(() => construction[name](text), { name: "TypeError", message });
  const overflowing = `D[M[P[p];m];a#${"9".repeat(400)}]`;
  assert.deepEqual(product.decodeDefId(overflowing), { kind: "invalid", text: overflowing, offset: 14, reason: "noncanonical" });
});

test("all host number ordinals have distinct complete canonical round trips without domain refusals", () => {
  const module = product.encodeModuleId({ package: product.encodePackageId("p"), path: "m" });
  const owner = product.encodeDefId({ module, segments: [{ name: "a", ordinal: 0 }] });
  for (const [ordinal, definitionSuffix, bodyOrdinal] of [
    [0, "", "0"], [1, "#1", "1"], [9007199254740991, "#9007199254740991", "9007199254740991"],
    [-1, "#F-1:", "F-1:"], [-0, "#F-0:", "F-0:"], [0.5, "#F0.5:", "F0.5:"],
    [NaN, "#FNaN:", "FNaN:"], [Infinity, "#F+Infinity:", "F+Infinity:"], [-Infinity, "#F-Infinity:", "F-Infinity:"],
    [9007199254740992, "#F9007199254740992:", "F9007199254740992:"], [1e21, "#F1e+21:", "F1e+21:"],
    [5e-324, "#F5e-324:", "F5e-324:"], [1.7976931348623157e308, "#F1.7976931348623157e+308:", "F1.7976931348623157e+308:"],
  ]) {
    const expectedDefinition = `D[M[P[p];m];a${definitionSuffix}]`;
    const path = { module, segments: [{ name: "a", ordinal }] };
    assert.equal(product.encodeDefId(path), expectedDefinition);
    const decodedDefinition = product.decodeDefId(expectedDefinition);
    assert.deepEqual(decodedDefinition, { kind: "decoded", value: { module: "M[P[p];m]", segments: [{ name: "a", ordinal }] } });
    assert.equal(product.encodeDefId(decodedDefinition.value), expectedDefinition);
    const expectedBody = `B[D[M[P[p];m];a];function;${bodyOrdinal}]`;
    assert.equal(product.encodeBodyId({ owner, role: "function", ordinal }), expectedBody);
    const decodedBody = product.decodeBodyId(expectedBody);
    assert.deepEqual(decodedBody, { kind: "decoded", value: { owner: "D[M[P[p];m];a]", role: "function", ordinal } });
    assert.equal(product.encodeBodyId(decodedBody.value), expectedBody);
  }
  const segments = [{ name: "a", ordinal: NaN }, { name: "b", ordinal: -0 }, { name: "c", ordinal: -0.5 }];
  const expected = "D[M[P[p];m];a#FNaN:/b#F-0:/c#F-0.5:]";
  assert.equal(product.encodeDefId({ module, segments }), expected);
  assert.deepEqual(product.decodeDefId(expected), { kind: "decoded", value: { module: "M[P[p];m]", segments } });
});

test("ordinal framing rejects every noncanonical number spelling with complete original-text errors", () => {
  for (const [spelling, reason, relativeOffset] of [
    ["F:", "syntax", 1], ["FNaN", "syntax", 4], ["Fwat:", "syntax", 1],
    ["F1:", "noncanonical", 0], ["F0:", "noncanonical", 0], ["F+0:", "noncanonical", 0],
    ["F01:", "noncanonical", 0], ["F0.50:", "noncanonical", 0], ["F.5:", "noncanonical", 0],
    ["FInfinity:", "noncanonical", 0], ["F1e+999:", "noncanonical", 0],
    ["F9007199254740993:", "noncanonical", 0], ["F1e21:", "noncanonical", 0], ["FNaN:x", "syntax", 5],
    ["9007199254740992", "noncanonical", 0], ["1000000000000000000000", "noncanonical", 0],
  ]) {
    const definition = `D[M[P[x];m];a#${spelling}]`;
    assert.deepEqual(product.decodeDefId(definition), { kind: "invalid", text: definition, offset: 14 + relativeOffset, reason });
    const body = `B[D[M[P[x];m];a];function;${spelling}]`;
    assert.deepEqual(product.decodeBodyId(body), { kind: "invalid", text: body, offset: 26 + relativeOffset, reason });
  }
  for (const [text, offset] of [["D[M[P[x];m];a#FNaN:", 19], ["B[D[M[P[x];m];a];function;FNaN:", 31],
    ["D[M[P[x];m];a#FNaN", 18], ["B[D[M[P[x];m];a];function;FNaN", 30]]) {
    const decoded = text.startsWith("D") ? product.decodeDefId(text) : product.decodeBodyId(text);
    assert.deepEqual(decoded, { kind: "invalid", text, offset, reason: "syntax" });
  }
});

test("closed key boundaries reject incomplete data with its complete actual path", () => {
  const arrayCycle = []; arrayCycle.push(arrayCycle);
  const recordCycle = { kind: "record", fields: [] }; recordCycle.fields.push(["self", recordCycle]);
  for (const [input, reason, path] of [
    [arrayCycle, "cyclic key data", "[0]"], [recordCycle, "cyclic key data", '["self"]'],
    [Array(1), "unsupported key data", "[0]"],
    [{}, "unsupported key data", ""],
    [{ kind: "record" }, "unsupported key data", ""],
    [{ kind: "record", fields: [["a"]] }, "a key record requires complete named fields", ""],
    [{ kind: "record", fields: [[0, 1]] }, "a key record requires complete named fields", ""],
    [{ kind: "record", fields: Array(1) }, "a key record requires complete named fields", ""],
    [{ kind: "record", fields: [["a", 1], ["a", 2]] }, "a key record requires unique field names", ""],
    [undefined, "unsupported key data", ""], [Symbol("value"), "unsupported key data", ""],
    [() => 0, "unsupported key data", ""],
    [{ kind: "record", fields: [["field", undefined]] }, "unsupported key data", '["field"]'],
  ]) {
    assert.throws(() => product.encodeKey(input), { name: "TypeError", message: `ids: ${reason} at $root${path}` });
    assert.throws(() => product.encodeKey({ kind: "record", fields: [["payload", [input]]] }), {
      name: "TypeError", message: `ids: ${reason} at $root["payload"][0]${path}`,
    });
  }
  for (const name of ['a"b', "a\\b", "a\nb", "\ud800", ""]) {
    const input = { kind: "record", fields: [[name, [undefined]]] };
    const message = `ids: unsupported key data at $root[${JSON.stringify(name)}][0]`;
    assert.throws(() => product.encodeKey(input), { name: "TypeError", message });
  }
  assert.equal(product.encodeKey({ kind: "record", fields: [["a", 1]] }), "O1:S1:aF1:");
  const shared = { kind: "record", fields: [["value", [1, 2]]] };
  const actual = product.encodeKey([shared, shared]);
  assert.equal(actual, "A2:O1:S5:valueA2:F1:F2:O1:S5:valueA2:F1:F2:");
  assert.equal(product.encodeKey([{ kind: "record", fields: [["value", [1, 2]]] },
    { kind: "record", fields: [["value", [1, 2]]] }]), actual);
  let deepInvalid;
  for (let depth = 0; depth < 100000; depth += 1) deepInvalid = [deepInvalid];
  const expectedError = `ids: unsupported key data at $root${"[0]".repeat(100000)}`;
  assert.throws(() => product.encodeKey(deepInvalid), error => {
    assert.equal(error instanceof TypeError, true, "deep outside-domain value has the exact invariant type");
    assert.equal(error.message === expectedError, true, "the complete deep error path is built iteratively");
    return true;
  });
});

test("canonical keys and durable grouping are independent of record allocation and member permutation", () => {
  const record = { alpha: [1, false], beta: "é", gamma: null };
  const expected = "O3:S5:alphaA2:F1:B0S4:betaS1:éS5:gammaN";
  for (const names of [["alpha", "beta", "gamma"], ["gamma", "alpha", "beta"], ["beta", "gamma", "alpha"]]) {
    assert.equal(product.encodeKey({ kind: "record", fields: names.map(name => [name, record[name]]) }), expected);
  }
  const definitions = ["z", "a", "😀"].map(name => definition({ root: "p", module: "m", segments: [{ name, ordinal: 0 }] }));
  const bodies = definitions.map(owner => product.encodeBodyId({ owner, role: "function", ordinal: 0 }));
  for (const members of [bodies, [...bodies].reverse(), [bodies[1], bodies[2], bodies[0], bodies[1]]]) {
    assert.equal(product.encodeGroupId(members), "G[B[D[M[P[p];m];a];function;0]]");
  }
  for (const members of [definitions, [...definitions].reverse(), [definitions[1], definitions[2], definitions[0], definitions[1]]]) {
    assert.equal(product.encodeComponentId(members), "C[D[M[P[p];m];a];D[M[P[p];m];z];D[M[P[p];m];😀]]");
  }
});

test("the actual four-file ids owner compiles in fresh strict whole-module isolation", async () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const module = hostCatalogue.find(module => module.name === "ids");
  const report = await compileIsolated(deps, module, { root: repository, sourceFiles,
    interfaceSources: [], declarationSources: [], outputDirectory: ".temp/ids-isolation" });
  const evidence = resolve(repository, ".temp/ids-isolation-report.json");
  writeFileSync(evidence, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 4000));
  assert.equal(report.sourceInventory.length, 4);
  assert.equal(report.loadedInventory.length > 4, true, "the actual compiler language closure is nonempty");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
});

test("fresh actual declarations accept all ports and reject every ordered pair of the 24 ID brands", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const parent = resolve(repository, ".temp/ids-consumers");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  mkdirSync(resolve(stage, "ids"));
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  for (const name of ["contract", "index", "identity", "key"]) {
    copyFileSync(resolve(repository, `packages/host/dist/ids/${name}.d.ts`), resolve(stage, `ids/${name}.d.ts`));
  }
  const positive = resolve(stage, "positive.mts");
  writeFileSync(positive, `import * as Ids from "./ids/index.js";
import type * as Port from "./ids/contract.js";
const node: Port.NodeIdConstructor = Ids.nodeId; void node;
const local: Port.LocalIdConstructor = Ids.localId; void local;
const block: Port.BlockIdConstructor = Ids.blockId; void block;
const place: Port.PlaceIdConstructor = Ids.placeId; void place;
const ty: Port.TyIdConstructor = Ids.tyId; void ty;
const sig: Port.SigIdConstructor = Ids.sigId; void sig;
const constant: Port.ConstIdConstructor = Ids.constId; void constant;
const candidateList: Port.CandidateListIdConstructor = Ids.candidateListId; void candidateList;
const producer: Port.ProducerIdConstructor = Ids.producerId; void producer;
const boundProducer: Port.BoundProducerIdConstructor = Ids.boundProducerId; void boundProducer;
const valueContext: Port.ValueContextIdConstructor = Ids.valueContextId; void valueContext;
const origins: Port.OriginsIdConstructor = Ids.originsId; void origins;
const projectionPath: Port.ProjectionPathIdConstructor = Ids.projectionPathId; void projectionPath;
const openBoundary: Port.OpenBoundaryIdConstructor = Ids.openBoundaryId; void openBoundary;
const layout: Port.LayoutIdConstructor = Ids.layoutId; void layout;
const memoryField: Port.MemoryFieldIdConstructor = Ids.memoryFieldId; void memoryField;
const libraryType: Port.LibraryTypeIdConstructor = Ids.libraryTypeId; void libraryType;
const expansion: Port.ExpansionIdConstructor = Ids.expansionId; void expansion;
const ports: readonly [Port.EncodeKey, Port.EncodePackageId, Port.DecodePackageId, Port.EncodeModuleId, Port.DecodeModuleId,
  Port.EncodeDefId, Port.DecodeDefId, Port.EncodeBodyId, Port.DecodeBodyId, Port.EncodeGroupId, Port.DecodeGroupId,
  Port.EncodeComponentId, Port.DecodeComponentId] = [Ids.encodeKey, Ids.encodePackageId, Ids.decodePackageId,
  Ids.encodeModuleId, Ids.decodeModuleId, Ids.encodeDefId, Ids.decodeDefId, Ids.encodeBodyId, Ids.decodeBodyId,
  Ids.encodeGroupId, Ids.decodeGroupId, Ids.encodeComponentId, Ids.decodeComponentId];
const packageId: Port.PackageId = Ids.encodePackageId("/p");
const module: Port.ModuleId = Ids.encodeModuleId({ package: packageId, path: "m.ts" });
const definition: Port.DefId = Ids.encodeDefId({ module, segments: [{ name: "f", ordinal: 0 }] });
const body: Port.BodyId = Ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
const group: Port.GroupId = Ids.encodeGroupId([body]);
const component: Port.ComponentId = Ids.encodeComponentId([definition]);
const decoded: Port.DecodedIdentity<Port.DefinitionPath> = Ids.decodeDefId(definition);
const key: Port.KeyData = { kind: "record", fields: [["receiver", null], ["bindings", [0, 1n, -0, false, "x"]],
  ["actual", { kind: "record", fields: [["body", body], ["group", group], ["component", component]] }]] };
void ports; void decoded; void Ids.encodeKey(key);
`);
  const brands = ["PackageId", "ModuleId", "DefId", "BodyId", "GroupId", "ComponentId", "ExpansionId", "NodeId",
    "LocalId", "BlockId", "PlaceId", "TyId", "SigId", "ConstId", "CandidateListId", "ProducerId", "BoundProducerId",
    "ValueContextId", "OriginsId", "ProjectionPathId", "OpenBoundaryId", "LayoutId", "MemoryFieldId", "LibraryTypeId"];
  const files = [positive];
  const expected = [];
  for (const from of brands) for (const to of brands) {
    if (from === to) continue;
    const name = `mix-${from}-${to}.mts`;
    const file = resolve(stage, name);
    writeFileSync(file, `import type { ${from}, ${to} } from "./ids/contract.js";\ndeclare const input: ${from};\nconst wrong: ${to} = input;\nvoid wrong;\n`);
    files.push(file); expected.push({ file: name, line: 3, column: 7, code: 2322 });
  }
  for (const [index, name] of brands.entries()) {
    const file = `raw-${name}.mts`;
    writeFileSync(resolve(stage, file), `import type { ${name} } from "./ids/contract.js";\nconst wrong: ${name} = ${index < 7 ? '"id"' : "0"};\nvoid wrong;\n`);
    files.push(resolve(stage, file)); expected.push({ file, line: 2, column: 7, code: 2322 });
  }
  for (const [file, text, line, column, code] of [
    ["removed-object-key.mts", 'const wrong: KeyData = { x: 1 };\nvoid wrong;', 2, 26, 2353],
    ["readonly-key-fields.mts", 'declare const value: KeyRecord;\nvalue.fields.push(["x", 1]);', 3, 14, 2339],
  ]) {
    writeFileSync(resolve(stage, file), `import type { ${file === "removed-object-key.mts" ? "KeyData" : "KeyRecord"} } from "./ids/contract.js";\n${text}\n`);
    files.push(resolve(stage, file)); expected.push({ file, line, column, code });
  }
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
    noFallthroughCasesInSwitch: true, noEmit: true, skipLibCheck: false, target: "es2022", lib: ["es2022"],
    module: "nodenext", moduleResolution: "nodenext", types: [] }, files }));
  const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
    cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
  });
  assert.equal(result.error === undefined && result.signal === null, true, "the real strict declaration consumer terminated");
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(stage, "diagnostics.log"), output);
  const actual = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({
    file: basename(match[1]), line: Number(match[2]), column: Number(match[3]), code: Number(match[4]),
  }));
  assert.equal([...output.matchAll(/\berror TS\d+:/gu)].length, actual.length,
    "every compiler error belongs to the complete located diagnostic vector");
  const order = rows => rows.sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
  assert.equal(actual.length, 578, "552 cross-brand, 24 raw-primitive and 2 canonical-key opposites, no positive-consumer diagnostic");
  assert.equal(JSON.stringify(order(actual)) === JSON.stringify(order(expected)), true, output.slice(0, 4000));
  assert.equal(result.status, 1, "the pinned compiler rejects the exact negative programs with no emit");
  const loaded = result.stdout.split(/\r?\n/u).filter(path => path.startsWith("/"));
  const allowed = new Set([...files, resolve(stage, "ids/contract.d.ts"), resolve(stage, "ids/index.d.ts"), ...deps.platform.language]);
  assert.equal(loaded.length > files.length, true);
  assert.equal(loaded.every(path => allowed.has(realpathSync(path))), true, "no stale, private or foreign declarations were loaded");
  assert.deepEqual(loaded.filter(path => path.startsWith(resolve(stage, "ids"))).sort(),
    [resolve(stage, "ids/contract.d.ts"), resolve(stage, "ids/index.d.ts")].sort());
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
    [...runtimeFiles, resolve(repository, "packages/host/src/ids/contract.ts")], raw);
    const directory = resolve(repository, ".temp/ids-coverage"); mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 3, "all three actual runtime owners have nonempty real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, 3);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "the actual type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path)); assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});
