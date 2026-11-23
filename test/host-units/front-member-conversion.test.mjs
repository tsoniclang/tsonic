import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { insertFixtureType, insertFixtureSignature } from "./fixtures/types-construction.mjs";

const runtime = fileURLToPath(new URL("../../packages/host/dist/front/lower-members.js", import.meta.url));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let lowerMembers, lowerObjectProperties;
let ids;
let types;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ lowerMembers, lowerObjectProperties } = await import("../../packages/host/dist/front/lower-members.js"));
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
  const signature = insertFixtureSignature(types, interner, { declaration, owner: { kind: "item", value: { owner: declaration, node: 1 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: boolean });
  const callable = insertFixtureType(types, interner, { kind: "callable", calls: [signature], constructs: [] });
  const converted = new Map([boolean, callable].map(type => [type, { type, evidence: { type,
    component: { kind: "item", value: { owner: declaration, node: 1 } }, category: { kind: "dynamic" },
    numeric: null, sum: null, nominal: null, pointer: null } }]));
  const deps = { definitionOf: selected => {
    assert.equal(selected.module, module);
    assert.equal(selected.node, reference.node);
    return declaration;
  }, exportsOf: () => null,
    sourceOccurrenceOf: () => assert.fail("declared member conversion does not select a binding occurrence"),
    sourceTextOf: () => assert.fail("declared member conversion does not reparse authored source"),
    types: interner,
    typeExpansion: { maximumDepth: 64, maximumVisits: 4096, maximumUnionMembers: 64, maximumIntersectionMembers: 64 },
    typeWork: types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 100000 }),
    literalCapture: { maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 100000 } };
  const member = { key: { kind: "text", value: "member" }, name: "member", origins: [origin("read"), origin("write")],
    declarations: [reference], getters: [], setters: [], optional: false, readonly: false,
    read: { kind: "available", value: boolean }, write: { kind: "available", value: boolean }, readKind: "property" };
  return { deps, context: { deps, raw: { module }, checkerNumberBits: null, query: "lowerModule" },
    converted, member, reference, declaration, boolean, callable, interner, origin };
}

test("constructed declared member conversion retains type absence and unique origin access subsets without changing identities", () => {
  const actual = fixture();
  const { typeWork: work } = actual.deps;
  assert.deepEqual(lowerMembers(actual.context, [], type => actual.converted.get(type)?.type, 0, work), []);
  const members = lowerMembers(actual.context, [actual.member,
    { ...actual.member, key: { kind: "text", value: "readonly" }, readKind: "accessor", readonly: true,
      origins: [actual.origin("read")], write: { kind: "available", value: null } },
    { ...actual.member, key: { kind: "text", value: "writeonly" }, readKind: "accessor",
      origins: [actual.origin("write")], read: { kind: "available", value: null } },
    { ...actual.member, key: { kind: "symbol", declaration: actual.reference, wellKnown: null }, readKind: "method", optional: true,
      read: { kind: "available", value: actual.callable }, write: { kind: "available", value: actual.callable } }], type => actual.converted.get(type)?.type, 0, work);
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
  insertFixtureType(types, actual.interner, { kind: "shape", members, indexes: [], calls: [], constructs: [] });
  const findings = types.verifyTypes({ table: types.viewTypes(actual.interner), bindings: [], evidence: [],
    nominalOf: () => null, nodeExists: node => node.kind === "item"
      && node.value.owner === actual.declaration && node.value.node === actual.reference.node, localExists: () => false });
  assert.equal(findings.length, 0);
});

test("constructed member conversion refuses missing type, kind and origin evidence rather than filling absent answers", () => {
  const actual = fixture();
  const { typeWork: work } = actual.deps;
  const lower = changed => lowerMembers(actual.context, [{ ...actual.member, ...changed }], type => actual.converted.get(type)?.type, 0, work);
  for (const access of ["read", "write"]) assert.throws(() => lower({ [access]:
    { kind: "unavailable", reason: "incomplete-association", causes: [] } }), /actual captured read\/write type association/u);
  assert.throws(() => lowerMembers(actual.context, [actual.member], () => undefined, 0, work), /must complete/u);
  assert.throws(() => lower({ origins: [] }), /actual captured origins/u);
  for (const readKind of ["class-prototype", "mapped", "unavailable"])
    assert.throws(() => lower({ readKind }), /actual selected member kind/u);
  assert.throws(() => lower({ origins: [{ kind: "class-prototype", declaration: actual.reference, facet: "value" }] }),
    /actual read\/write origin association/u);
  assert.throws(() => lower({ key: { kind: "numeric", value: 1 } }), /actual authored source name/u);
});

test("a captured numeric member retains its original site at every exact decoder cut", async () => {
  const fixture = await loadFrontFixture();
  const source = "export type Shape = { 0x20: boolean };\n";
  const duplicate = "export type Duplicated = { 9007199254740992: boolean; 9007199254740993: boolean };";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source, "duplicate.ts": duplicate },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps } = fixture.captureModulesOf(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { raw } = captured.find(entry => entry.module === module);
  const otherModule = fixture.moduleOf(fixture.packageOf("/project"), "src/duplicate.ts");
  const { raw: other } = captured.find(entry => entry.module === otherModule);
  assert.deepEqual(other.checkerDiagnostics.map(diagnostic => [diagnostic.code.number,
    duplicate.slice(diagnostic.site.origin.start, diagnostic.site.origin.start + diagnostic.site.origin.length)]),
  [[2300, "9007199254740992"], [2300, "9007199254740993"]]);
  const member = raw.types.members.flatMap(inventory => inventory.members).find(row => row.name === "32");
  const origin = { module, start: source.indexOf("0x20"), length: 4, derived: [] };
  assert.deepEqual(member.key, { kind: "numeric", value: 32, origin });
  const limit = (dimension, maximum) => {
    const context = { deps: { ...deps, literalCapture: { ...deps.literalCapture, [dimension]: maximum } },
      raw, checkerNumberBits: null, query: "lowerModule" };
    return lowerMembers(context, [member], () => assert.fail("a stopped key must not read the member type"),
      0, deps.typeWork);
  };
  for (const [dimension, minimum] of [
    ["maximumArithmeticWork", 72], ["maximumIntermediateBits", 6], ["maximumResultBits", 7],
  ]) {
    for (let maximum = 0; maximum < minimum; maximum += 1) {
      const stopped = limit(dimension, maximum);
      assert.equal(stopped.kind, "literal-limit");
      assert.equal(stopped.diagnostic.code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
      assert.deepEqual(stopped.diagnostic.site, { kind: "source", origin });
    }
  }
  const exact = { maximumArithmeticWork: 72, maximumIntermediateBits: 6, maximumResultBits: 7 };
  const context = { deps: { ...deps, literalCapture: exact }, raw, checkerNumberBits: null, query: "lowerModule" };
  const [converted] = lowerMembers(context, [member], () => fixture.ids.tyId(0), 0, deps.typeWork);
  assert.deepEqual(converted.key, { kind: "number", value: { numerator: 32n, denominator: 1n, negativeZero: false } });
});

test("actual intrinsic environment members keep their native origins and the library keeps its own definitions", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Environment = typeof globalThis;\n" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, interner } = fixture.captureModulesOf(snapshot);
  const source = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const library = fixture.moduleOf(fixture.packageOf("/checker"), "lib.es5.d.ts");
  const { raw, definitions } = captured.find(entry => entry.module === source);
  const libraryDefinitions = captured.find(entry => entry.module === library).definitions;
  const row = raw.types.types.find(type => type.form.kind === "available" && type.form.value.kind === "source-environment");
  assert.ok(row);
  const environment = row.form.value;
  const expected = new Map([["globalThis", "global-this"], ["undefined", "undefined"]]);
  for (const [name, symbol] of expected) {
    const member = environment.members.find(row => row.name === name);
    assert.deepEqual(member.declarations, []);
    assert.equal("read" in member || "write" in member, false);
    assert.deepEqual(member.origins, member.readonly ? [{ kind: "intrinsic", symbol, access: "read" }]
      : [{ kind: "intrinsic", symbol, access: "read" }, { kind: "intrinsic", symbol, access: "write" }]);
    assert.equal([definitions, libraryDefinitions].some(rows => rows.rows.some(row =>
      fixture.ids.decodeDefId(row.definition).value.segments.at(-1)?.name === name)), false);
  }
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const converted = convertRawType(createTypeConversion(deps, raw), row.id);
  assert.equal(converted.kind, "complete");
  const table = fixture.types.viewTypes(interner);
  const occurrences = captured.flatMap(entry => entry.definitions.sourceOccurrences.map(row => row.occurrence));
  const declared = new Set(captured.flatMap(entry => entry.definitions.rows
    .filter(row => row.kind === "InterfaceDeclaration").map(row => row.definition)));
  assert.deepEqual(fixture.types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: definition =>
    declared.has(definition) ? { kind: "declared", facets: ["instance"] } : null,
    nodeExists: occurrence => occurrences.some(row => isDeepStrictEqual(row, occurrence)), localExists: () => false }), []);
  const shape = table.terms[converted.value.type];
  assert.equal(shape.kind, "source-environment");
  for (const [name, symbol] of expected) {
    const member = shape.members.find(row => row.key.kind === "text" && row.key.value === name);
    assert.deepEqual(member.origins, [{ kind: "intrinsic", symbol }]);
    assert.deepEqual(member.readOrigins, member.origins);
    assert.deepEqual(member.writeOrigins, member.readonly ? [] : member.origins);
    assert.equal("write" in member, false);
  }
  const foreign = environment.members.find(member => member.name === "Symbol").declarations;
  assert.equal(foreign.length, 1);
  assert.equal(foreign[0].module, library);
  assert.deepEqual(shape.members.find(row => row.key.kind === "text" && row.key.value === "Symbol").origins,
    [{ kind: "declared", declaration: libraryDefinitions.rows.find(row => row.node === foreign[0].node).definition }]);
  const { memberTypeOf, membersOf } = await import("../../packages/host/dist/decls/index.js");
  const receiver = converted.value.type;
  const inventory = membersOf({ types: interner }, receiver);
  assert.equal(inventory.value.value.completeness.kind, "complete");
  assert.deepEqual(inventory.value.value.members, shape.members);
  const member = inventory.value.value.members.findIndex(item => item.key.kind === "text" && item.key.value === "globalThis");
  const read = memberTypeOf({ types: interner }, { receiver, member }).value.value.read;
  assert.equal(read, receiver, "the actual intrinsic global member refers back to the identical environment");
  const absent = inventory.value.value.members.findIndex(item => item.key.kind === "text" && item.key.value === "undefined");
  const absence = memberTypeOf({ types: interner }, { receiver, member: absent }).value.value.read;
  assert.deepEqual(fixture.types.readType(interner, absence), { kind: "intrinsic", intrinsic: "absence" });
  assert.equal(isDeepStrictEqual(fixture.types.parseTypes(fixture.types.printTypes(table)), { kind: "parsed", value: table }), true);
});

test("mapped properties retain the native key and the actual foreign mapping owner", async () => {
  const fixture = await loadFrontFixture();
  const source = `
    export declare const token: unique symbol;
    export interface Input { readonly length: number; [token](): boolean; 1: boolean; 0x20: boolean; }
    export type Flags = { [K in keyof Input]?: boolean };
  `;
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": 'import type { Flags } from "./origin.js"; export type Used = Flags; export type Other = Flags;',
    "origin.ts": source, "twin.ts": source,
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { captured, deps, interner, opened } = fixture.captureModulesOf(snapshot);
  const module = path => fixture.moduleOf(fixture.packageOf("/project"), "src/" + path);
  const sourceModule = module("origin.ts");
  const { raw } = captured.find(entry => entry.module === module("main.ts"));
  const actual = captured.find(entry => entry.module === sourceModule);
  const twin = captured.find(entry => entry.module === module("twin.ts"));
  const mapped = actual.definitions.sourceOccurrences.find(row => row.kind === "MappedType");
  const opposite = twin.definitions.sourceOccurrences.find(row => row.kind === "MappedType");
  assert.equal(mapped.node, opposite.node);
  const [token, input, flags] = actual.raw.tree.statements.nodes;
  assert.equal(flags.type.kind, "MappedType");
  assert.equal(mapped.node, flags.type.id);
  assert.equal(mapped.occurrence.value.owner, actual.definitions.rows.find(row => row.node === flags.id).definition);
  assert.equal(actual.definitions.rows.some(row => row.node === flags.type.id), false);
  assert.equal(actual.definitions.rows.some(row => row.node === flags.type.typeParameter.id && row.kind === "TypeParameter"), true);

  const use = raw.tree.statements.nodes[1].type;
  const row = raw.types.types.find(type => type.authoredTypeNode?.node === use.id);
  const inventory = raw.types.members[row.form.value.inventory];
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  const entry = OpenedProgram.file(opened.program, raw.module);
  const { checker, typeShape } = checked.getSourceFileQueries(entry.file);
  const own = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering;
  const sourceNodes = OpenedProgram.syntax(opened.program).get("/project/src/origin.ts").outcome.numbering.nodes;
  const native = checker.getTypeFromTypeNode(own.nodes[use.id]).type;
  const selected = typeShape.getPropertyInfos(native);
  const nativeOrigin = sourceNodes[flags.type.id];
  const original = checker.getTypeFromTypeNode(nativeOrigin).type;
  assert.equal(native === original || typeShape.getTypeReferenceTarget(native) === original, true);
  const tokenNode = token.declarationList.declarations.nodes[0];
  const keyDef = actual.definitions.rows.find(row => row.node === tokenNode.id).definition;
  for (const [index, member] of input.members.nodes.entries()) {
    const rawMember = inventory.members.find(property => property.declarations.some(declaration => declaration.node === member.id));
    const property = selected.find(value => value.name === rawMember.name);
    assert.equal(property.mapped.declaration === nativeOrigin, true);
    assert.equal(checker.getSymbolValueDeclaration(property.mapped.syntheticOrigin) === sourceNodes[member.id], true);
    if (index === 0) assert.equal(typeShape.getStringLiteralTypeValue(property.mapped.keyType), "length");
    else if (index === 1) assert.equal(checker.getSymbolValueDeclaration(checker.getTypeSymbol(property.mapped.keyType)) === sourceNodes[tokenNode.id], true);
    else assert.equal(typeShape.getNumericLiteralTypeValue(property.mapped.keyType), index === 2 ? 1 : 32);
    assert.equal(rawMember.readKind, "mapped");
    assert.equal(rawMember.optional, true);
    assert.equal(rawMember.readonly, index === 0);
    assert.deepEqual(rawMember.declarations, [{ module: sourceModule, node: member.id }]);
    for (const origin of rawMember.origins) {
      assert.deepEqual(origin, { kind: "mapped", declaration: { module: sourceModule, node: mapped.node },
        key: rawMember.key, source: inventory.component, access: origin.access });
      const position = raw.types.types[rawMember[origin.access].value].component;
      assert.deepEqual(raw.types.components[position].path?.step, { ...origin, kind: "mapped-member" });
    }
  }
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const crossed = { ...deps, sourceOccurrenceOf: reference => reference.module === sourceModule && reference.node === mapped.node
    ? opposite : deps.sourceOccurrenceOf(reference) };
  assert.throws(() => convertRawType(createTypeConversion(crossed, raw), row.id), /actual captured module/u);
  const rawMember = inventory.members[0];
  const { typeWork: work } = deps;
  const context = { deps, raw, checkerNumberBits: null, query: "lowerModule" };
  assert.throws(() => lowerMembers(context, [{ ...rawMember, readKind: "property" }], () => undefined, inventory.component, work),
    error => error.message.includes("actual read/write origin association"));
  assert.throws(() => lowerMembers(context, [rawMember], () => undefined, inventory.component + 1, work),
    /actual captured containing component/u);
  const sibling = inventory.members[1];
  const wrongKey = { ...rawMember, origins: rawMember.origins.map(origin => ({ ...origin, key: sibling.key })) };
  const small = inventory.members.find(member => member.key.kind === "numeric" && member.key.value === 1);
  const large = inventory.members.find(member => member.key.kind === "numeric" && member.key.value === 32);
  const crossedKey = { ...small, origins: [{ ...small.origins[0], key: large.key }] };
  const limited = { ...context, deps: { ...deps, literalCapture: { ...deps.literalCapture, maximumArithmeticWork: 66 } } };
  const stopped = lowerMembers(limited, [crossedKey], () => assert.fail("a stopped origin must not read the member type"),
    inventory.component, deps.typeWork);
  assert.equal(stopped.kind, "literal-limit");
  assert.deepEqual(stopped.diagnostic.site, { kind: "source", origin: large.key.origin });
  assert.equal(large.key.origin.module, sourceModule);
  const other = raw.types.types.find(type => type.authoredTypeNode?.node === raw.tree.statements.nodes[2].type.id);
  const foreign = raw.types.members[other.form.value.inventory];
  assert.notEqual(foreign.component, row.component);
  assert.equal(foreign.members.every(member => member.origins.every(origin => origin.source === foreign.component)), true);
  const arenaSizes = () => {
    const { terms, signatures } = fixture.types.viewTypes(interner);
    return [terms.length, signatures.length];
  };
  const untouched = arenaSizes();
  for (const [value, message] of [
    [{ ...inventory, members: [wrongKey, ...inventory.members.slice(1)] }, /actual selected member key/u],
    [foreign, /actual structure component/u],
  ]) {
    const members = [...raw.types.members];
    members[inventory.id] = value;
    const conversion = createTypeConversion(deps, { ...raw, types: { ...raw.types, members } });
    assert.throws(() => convertRawType(conversion, row.id), message);
    assert.deepEqual(arenaSizes(), untouched);
    assert.equal(conversion.convertedTypes.size, 0);
    assert.equal(conversion.convertedSignatures.size, 0);
  }

  let reads = 0;
  const observed = inventory.members.map(member => ({ ...member, origins: member.origins.map(origin => ({
    ...origin, get key() { reads += 1; return origin.key; },
  })) }));
  const originCount = observed.reduce((count, member) => count + member.origins.length, 0);
  const inventories = [...raw.types.members];
  inventories[inventory.id] = { ...inventory, members: observed };
  const watched = { ...raw, types: { ...raw.types, members: inventories } };
  for (let maximumWork = 0; maximumWork < originCount; maximumWork += 1) {
    reads = 0;
    const limited = { ...deps, typeWork: types.createTypePublicationWork({ maximumWork, maximumCreatedRecords: 100000 }) };
    const conversion = createTypeConversion(limited, watched);
    const stop = convertRawType(conversion, row.id);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
    assert.equal(reads, maximumWork, "each comparison pays before reading its mapped origin key");
    assert.equal(convertRawType(conversion, row.id), stop, "the original refusal is sticky");
    assert.equal(convertRawType(createTypeConversion(limited, watched), row.id), stop, "another converter must borrow the same run's stop");
    assert.equal(reads, maximumWork);
    assert.deepEqual(arenaSizes(), untouched);
    assert.equal(conversion.convertedTypes.size + conversion.convertedSignatures.size, 0);
  }
  reads = 0;
  const exact = types.createTypePublicationWork({ maximumWork: originCount, maximumCreatedRecords: 100000 });
  assert.equal(lowerMembers({ deps, raw, checkerNumberBits: null, query: "lowerModule" }, observed, () => fixture.ids.tyId(0), inventory.component, exact).length, observed.length);
  assert.equal(reads, originCount);
  assert.deepEqual(types.admitTypePublicationStep(exact), { kind: "resource-limit", dimension: "work", maximum: originCount });

  reads = 0;
  const created = createTypeConversion({ ...deps, typeWork: types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 0 }) }, watched);
  const [typeBase, signatureBase] = untouched;
  const createdStop = types.internTypeGraph({ types: interner, work: created.typeWork }, { typeBase, signatureBase, terms: [], signatures: [] });
  assert.deepEqual(createdStop, { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  assert.equal(convertRawType(created, row.id), createdStop);
  assert.equal(reads, 0);
  assert.deepEqual(arenaSizes(), untouched);

  const converted = convertRawType(createTypeConversion(deps, raw), row.id);
  assert.equal(converted.kind, "complete");
  const table = fixture.types.viewTypes(interner);
  const shape = table.terms[converted.value.type];
  assert.equal(shape.kind, "shape");
  for (const [index, property] of shape.members.entries()) {
    const key = property.key.kind === "text" ? { kind: "text", value: "length" }
      : property.key.kind === "symbol" ? { kind: "symbol", declaration: keyDef }
        : { kind: "number", value: { numerator: index === 0 ? 1n : 32n, denominator: 1n, negativeZero: false } };
    assert.deepEqual(property.key, key);
    assert.equal(property.kind, "property");
    assert.deepEqual(property.origins, [{ kind: "mapped", owner: mapped.occurrence, key }]);
    assert.deepEqual(property.readOrigins, property.origins);
    assert.deepEqual(property.writeOrigins, property.readonly ? [] : property.origins, index);
  }
  const occurrences = captured.flatMap(entry => entry.definitions.sourceOccurrences.map(value => value.occurrence));
  assert.deepEqual(fixture.types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: () => null,
    nodeExists: value => occurrences.some(occurrence => isDeepStrictEqual(value, occurrence)), localExists: () => false }), []);
});

test("a remapped property cannot use its input key as the selected output key", async () => {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": 'interface Input { length: number; } export type Flags = { [K in keyof Input as "renamed"]?: boolean };',
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const { deps, program } = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const file = OpenedProgram.file(program, module).file;
  const { ast, getSourceFileQueries } = OpenedProgram.checked(program);
  const { checker, typeShape } = getSourceFileQueries(file);
  const alias = ast.children(file).find(node => ast.kindName(node) === "KindTypeAliasDeclaration");
  const syntax = ast.typeNode(alias);
  const [selected] = typeShape.getPropertyInfos(checker.getTypeFromTypeNode(syntax).type);
  assert.equal(selected.name, "renamed");
  assert.equal(selected.mapped.declaration === syntax, true);
  assert.equal(typeShape.getStringLiteralTypeValue(selected.mapped.keyType), "length");
  assert.throws(() => fixture.front.captureModule(deps, program, module), /mapped property origin transport requires its actual selected mapped component/u);
});

test("captured data-property origins demand their genuine body occurrence without assigning a definition", async () => {
  assert.ok(process.env.TSONIC_TEST_ADMISSION);
  const fixture = await loadFrontFixture();
  const source = "export const Plain: { enabled: boolean } = { enabled: true };"
    + "export function check(plain: typeof Plain): boolean { return plain.enabled; }";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const capture = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(capture.kind, "ok");
  const raw = capture.value;
  assert.deepEqual(raw.checkerDiagnostics, []);
  const [statement, callable] = raw.tree.statements.nodes;
  const plain = statement.declarationList.declarations.nodes[0];
  const node = plain.initializer.properties.nodes[0];
  const reference = { module, node: node.id };
  assert.equal(node.kind, "PropertyAssignment");
  const members = raw.types.members.flatMap(table => table.members);
  const property = members.find(member => member.declarations.some(declaration => declaration.module === module && declaration.node === node.id));
  assert.ok(property);
  assert.deepEqual(property.origins, ["read", "write"].map(access =>
    ({ kind: "source-member", occurrence: reference, access })));
  const use = raw.memberUses.find(row => row.occurrence.node === callable.body.statements.nodes[0].expression.id);
  assert.deepEqual(use.selectedDeclaration, { module, node: plain.type.members.nodes[0].id });
  assert.notEqual(use.selectedDeclaration.node, node.id);
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: [
    ...raw.types.components.map(component => component.root).filter(root => root.module === module), ...property.origins.map(origin => origin.occurrence),
  ] });
  assert.equal(definitions.kind, "ok");
  assert.equal(definitions.value.rows.some(row => row.node === node.id), false);
  const ready = definitions.value.sourceOccurrences.find(row => row.node === node.id);
  const owner = definitions.value.rows.find(row => row.node === plain.id).definition;
  assert.deepEqual(ready.occurrence, { kind: "body", value: {
    body: fixture.ids.encodeBodyId({ owner, role: "initializer", ordinal: 0 }), node: node.id,
  } });
  assert.equal(ready.kind, "PropertyAssignment");
});

test("object property lowering selects by the full checked occurrence, not shape order or spelling", async () => {
  const fixture = await loadFrontFixture();
  const source = "export const shape: { z: boolean; a: boolean } = { z: true, a: false };";
  const opened = fixture.openedModule(source);
  const { module, program } = opened;
  const captured = fixture.front.captureModule(opened.deps, program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const enclosing = raw.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  const literal = enclosing.initializer;
  const declarations = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: [
    ...raw.types.components.map(component => component.root).filter(reference => reference.module === module),
    ...literal.properties.nodes.map(property => ({ module, node: property.id })),
  ] });
  assert.equal(declarations.kind, "ok");
  const interner = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(declarations.value, interner, source);
  const exported = fixture.front.lowerModuleExports(deps, raw);
  assert.equal(exported.kind, "ok");
  const checked = fixture.front.lowerModule({ ...deps, exportsOf: () => exported.value }, raw);
  assert.equal(checked.kind, "ok");
  const body = checked.value.bodies.find(entry => entry.root.id === literal.id);
  const sourceShape = fixture.types.readType(interner, body.root.tsonic.value.views.read.value);
  assert.equal(sourceShape.kind, "shape");
  assert.deepEqual(sourceShape.members.map(member => member.key.value), ["a", "z"]);
  const bodies = new Map(body.root.properties.nodes.map(property => [property.id, property]));
  const checkedCore = new Map([...bodies.values()].flatMap(property => [
    [property.id, property.tsonic.core], [property.name.id, property.name.tsonic.core],
  ]));
  const read = node => [...bodies.values()].find(property => property.initializer.id === node.id).initializer;
  const lower = (members, node = literal) => lowerObjectProperties(node, body.body, members, id => checkedCore.get(id), read);
  assert.deepEqual(lower(sourceShape.members), body.root.properties);
  assert.throws(() => lower([...sourceShape.members, sourceShape.members[0]]), /cannot select two checked members/u);
  const expected = sourceShape.members[0];
  const otherBody = fixture.ids.encodeBodyId({ owner: body.owner, role: "initializer", ordinal: 1 });
  const differentOwner = { ...expected, origins: [{ ...expected.origins[0], occurrence: { body: otherBody, node: expected.origins[0].occurrence.node } }] };
  const differentOrigin = { ...expected, origins: [{ kind: "declared", declaration: body.owner }] };
  for (const crossed of [differentOwner, differentOrigin, { ...expected, kind: "method" }])
    assert.throws(() => lower([crossed, sourceShape.members[1]]), /actual checked member occurrence/u);
  const property = literal.properties.nodes[0];
  const malformed = [
    { ...property, kind: "ShorthandPropertyAssignment" },
    { ...property, name: property.initializer },
    { ...property, modifiers: { loc: property.loc, nodes: [] } },
    { ...property, postfixToken: { kind: "QuestionToken" } },
    { ...property, type: enclosing.type },
  ];
  for (const first of malformed) assert.throws(() => lower(sourceShape.members, { ...literal,
    properties: { loc: literal.properties.loc, nodes: [first, literal.properties.nodes[1]] } }), /plain data-property assignment/u);
});

test("an imported data property's source occurrence stays in its own module even when another node has the same ID", async () => {
  assert.ok(process.env.TSONIC_TEST_ADMISSION);
  const fixture = await loadFrontFixture();
  const originText = "export const Plain = { enabled: true };";
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import { Plain } from './origin.js'; export const read = Plain.enabled;",
    "origin.ts": originText,
    "other.ts": originText,
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const owner = fixture.packageOf("/project");
  const modules = ["main", "origin", "other"].map(name => fixture.moduleOf(owner, `src/${name}.ts`));
  const [main, origin, other] = modules.map(module => {
    const capture = fixture.front.captureModule(opened.deps, opened.program, module);
    assert.equal(capture.kind, "ok");
    assert.deepEqual(capture.value.checkerDiagnostics, []);
    return capture.value;
  });
  const variable = raw => raw.tree.statements.nodes[0].declarationList.declarations.nodes[0];
  const originVariable = variable(origin);
  const originNode = originVariable.initializer.properties.nodes[0];
  assert.equal(originNode.id, variable(other).initializer.properties.nodes[0].id);
  const origins = main.types.members.flatMap(table => table.members).flatMap(member => member.origins)
    .filter(candidate => candidate.kind === "source-member");
  const occurrence = { module: origin.module, node: originNode.id };
  assert.ok(origins.length > 0);
  assert.deepEqual(origins.map(candidate => candidate.occurrence), origins.map(() => occurrence));
  assert.equal(main.memberUses.length, 1);
  assert.deepEqual(main.memberUses[0].selectedDeclaration, occurrence);
  assert.deepEqual(main.memberUses[0].readDeclarations, [occurrence]);
  const definition = fixture.front.lowerModuleDefinitions({ module: origin, componentRoots: [occurrence] });
  assert.equal(definition.kind, "ok");
  const ready = definition.value.sourceOccurrences.find(row => row.node === occurrence.node);
  const otherDefinitions = fixture.front.lowerModuleDefinitions({ module: other, componentRoots: [{ module: other.module, node: occurrence.node }] });
  assert.equal(otherDefinitions.kind, "ok");
  const crossed = otherDefinitions.value.sourceOccurrences.find(row => row.node === occurrence.node);
  assert.equal(ready.kind, "PropertyAssignment");
  const path = fixture.ids.decodeBodyId(ready.occurrence.value.body);
  assert.equal(path.kind, "decoded");
  assert.equal(path.value.owner, definition.value.rows.find(row => row.node === originVariable.id).definition);
  assert.equal(path.value.role, "initializer");
  assert.throws(() => fixture.front.lowerModuleDefinitions({ module: other, componentRoots: [occurrence] }),
    /component root request must retain its actual captured module/);

  const mainDefinitions = fixture.front.lowerModuleDefinitions({ module: main, componentRoots: main.types.components
    .map(component => component.root).filter(root => root.module === main.module) });
  assert.equal(mainDefinitions.kind, "ok");
  const local = fixture.lowerDepsFor(mainDefinitions.value, fixture.types.createTypeInterner(), snapshot.source.input.packages.files
    .find(file => file.path.endsWith("/main.ts")).text);
  const deps = { ...local, sourceOccurrenceOf: reference => reference.module === origin.module && reference.node === originNode.id
    ? ready : local.sourceOccurrenceOf(reference) };
  const row = main.types.types.find(candidate => candidate.form.kind === "available" && candidate.form.value.kind === "structure"
    && main.types.members[candidate.form.value.inventory].members.some(member => member.origins.some(value =>
      value.kind === "source-member" && value.occurrence.module === origin.module && value.occurrence.node === originNode.id)));
  assert.ok(row);
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const crossedDeps = { ...deps, sourceOccurrenceOf: reference => reference.module === origin.module ? crossed : deps.sourceOccurrenceOf(reference) };
  assert.throws(() => convertRawType(createTypeConversion(crossedDeps, main), row.id), /actual captured module/u);
  assert.equal(fixture.types.viewTypes(deps.types).terms.length, 0);
  for (const invalid of [null, { ...ready, kind: "PropertyDeclaration" }]) {
    const wrong = { ...deps, sourceOccurrenceOf: reference => reference.module === origin.module ? invalid : deps.sourceOccurrenceOf(reference) };
    assert.throws(() => convertRawType(createTypeConversion(wrong, main), row.id),
      /requires its actual body-qualified property assignment or binding element/u);
    assert.equal(fixture.types.viewTypes(deps.types).terms.length, 0);
  }
  const converted = convertRawType(createTypeConversion(deps, main), row.id);
  assert.equal(converted.kind, "complete");
  const table = fixture.types.viewTypes(deps.types);
  const shape = table.terms[converted.value.type];
  assert.equal(shape.kind, "shape");
  const enabled = shape.members.find(member => member.key.kind === "text" && member.key.value === "enabled");
  assert.deepEqual(enabled.origins, [{ kind: "source-member", occurrence: ready.occurrence.value }]);
  assert.deepEqual(enabled.readOrigins, enabled.origins);
  assert.deepEqual(enabled.writeOrigins, enabled.origins);
  assert.equal(isDeepStrictEqual(fixture.types.parseTypes(fixture.types.printTypes(table)), { kind: "parsed", value: table }), true);
  const verification = { table, bindings: [], evidence: [], nominalOf: () => null, localExists: () => false };
  assert.deepEqual(fixture.types.verifyTypes({ ...verification, nodeExists: reference => isDeepStrictEqual(reference, ready.occurrence) }), []);
  const findings = fixture.types.verifyTypes({ ...verification, nodeExists: reference => isDeepStrictEqual(reference, crossed.occurrence) });
  assert.equal(findings.some(finding => finding.rule === "cross-owner-qualified"), true);
});
