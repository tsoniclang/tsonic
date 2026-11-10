import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const sourceNames = ["index", "print", "parse", "verify-facts", "verify-relations", "verify-summary", "verify-metadata", "verify-call-graph"];
const sourceFiles = ["contract", ...sourceNames].map(name => `packages/host/src/ir-facts/${name}.ts`);
const hash = text => createHash("sha256").update(text).digest("hex");
const sourceHashes = sourceFiles.map(path => [path, hash(readFileSync(resolve(repository, path)))]);
const equal = (actual, expected, label) => assert.equal(isDeepStrictEqual(actual, expected), true, label);
const clone = value => structuredClone(value);
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const parametric = () => ({ kind: "parametric" });
const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const detail = value => [{ kind: "text", value }];
const violation = (rule, site, value) => ({ rule, site, detail: detail(value) });
const finiteLimits = () => ({ maximumBlocksPerBody: 1000000, maximumPlacesPerBody: 1000000, maximumProjectionDepth: 1000000,
  maximumOriginAlternatives: 1000000, maximumRelationalRecordsPerBody: 1000000, maximumRelationalReferencesPerBody: 1000000 });

test("ir-facts: all twelve actual emitted ports, full closed logic and fresh declarations", async suite => {
  assert.equal(typeof process.env.TSONIC_TEST_ADMISSION, "string", "the complete unit is admitted in its bounded aggregate group");
  const inspector = new Session();
  inspector.connect();
  const post = (method, parameters = {}) => new Promise((done, reject) => inspector.post(method, parameters,
    (error, result) => error === null ? done(result) : reject(error)));
  await post("Debugger.enable"); await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  suite.after(async () => { await post("Profiler.stopPreciseCoverage"); inspector.disconnect(); });
  const product = await import("../../packages/host/dist/ir-facts/index.js");
  const ids = await import("../../packages/host/dist/ids/index.js");
  const packageId = ids.encodePackageId("facts");
  const moduleId = ids.encodeModuleId({ package: packageId, path: "main.ts" });
  const definition = name => ids.encodeDefId({ module: moduleId, segments: [{ name, ordinal: 0 }] });
  const definitions = Object.fromEntries(["f", "callee", "parameter", "capture", "abi32", "abi64", "layout", "field", "other", "missing"].map(name => [name, definition(name)]));
  const body = ids.encodeBodyId({ owner: definitions.f, role: "function", ordinal: 0 });
  const otherBody = ids.encodeBodyId({ owner: definitions.other, role: "function", ordinal: 0 });
  const instance = () => ({ body, bindings: parametric() });
  const owner = () => ({ kind: "body", instance: instance() });
  const arenaKey = value => ids.encodeKey(value);
  const summaryOwner = selected => ({ kind: "summary", definition: selected.definition, bindings: selected.bindings });
  const nodeSite = node => ({ kind: "node", at: { body, node } });
  const bodySite = () => ({ kind: "body", instance: instance() });
  const sourceOrigin = (start = 0) => ({ module: moduleId, start, length: 1, derived: [] });
  const header = (id, parent = 0) => ({ id, origin: sourceOrigin(id), parent: id === 0 ? null : parent,
    flags: [], loc: { pos: id, end: id + 1 } });
  const nodeRef = node => ({ body, node });
  const itemRef = owner => ({ kind: "item", value: { owner, node: 0 } });
  const signature = (id = 0, parameters = [], receiver = null, declaration = definitions.f) => ({ id, declaration, owner: null,
    composition: null, kind: "call", typeParameters: [], receiver, parameters, result: 1 });
  const arena = () => ({ projections: [{ id: 0, parent: null, projection: { kind: "deref" } },
    { id: 1, parent: 0, projection: { kind: "element" } }],
    producers: [{ id: 0, path: null, kind: "allocation", at: { kind: "node", node: nodeRef(1) } }],
    contexts: [{ id: 0, receiver: null, arguments: [], captures: [] }],
    boundProducers: [{ id: 0, producer: 0, bindings: emptyBindings(), context: 0 }],
    origins: [{ id: 0, producers: [], includesAbsence: false, kind: "complete" },
      { id: 1, producers: [0], includesAbsence: false, kind: "complete" }],
    boundaries: [{ id: 0, kind: "external-input", at: { kind: "node", node: nodeRef(1) }, subject: 0, owner: null,
      bindings: emptyBindings(), context: 0, detail: "unknown" }] });
  const bodyFacts = () => ({ instance: instance(), arena: arena(),
    liveness: { stores: [], locals: [], bindings: [], captures: [] }, initialization: { reads: [] },
    refinements: { refinements: [], integers: [], countedLoops: [] },
    origins: { points: [], reads: [], subjects: [], writes: [], escapes: [], invocations: [], callbacks: [], activations: [], frontiers: [], constructions: [], instanceRegions: [] },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] },
    observations: [], rawLocations: [], fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] });
  const emptyFacts = () => ({ ...bodyFacts(), arena: { projections: [], producers: [], contexts: [], boundProducers: [], origins: [], boundaries: [] } });
  const tir = () => ({ body, owner: definitions.f, bindings: parametric(), lexicalBindings: emptyBindings(), dependence: "parametric", signature: 0,
    completion: 1, yielded: null, sent: null, params: [], locals: [],
    root: { ...header(0), kind: "Block", statements: { loc: { pos: 0, end: 32 }, nodes: Array.from({ length: 31 }, (_, index) =>
      ({ ...header(index + 1), kind: "EmptyStatement", tsonic: null })) }, tsonic: null },
    nestedBodies: [], captures: [], scopes: [], evidence: [], asynchronous: false, generator: false });
  const mir = () => ({ body, bindings: parametric(),
    locals: [{ id: 0, storage: 0, role: { kind: "user" }, source: { body, local: 0 }, origin: sourceOrigin() }], constants: [],
    places: [{ id: 0, base: { kind: "local", local: 0 }, storage: 0, origin: sourceOrigin() }],
    blocks: [{ id: 0, origin: sourceOrigin(), tir: nodeRef(0), statements: [],
      terminator: { kind: "return", value: null, origin: sourceOrigin(), tir: nodeRef(0) } }], result: 1 });
  const summary = () => ({ key: { definition: definitions.f, bindings: parametric() }, signature: 0, arena: arena(),
    parameters: [], captures: [], result: 1, thrown: 0, writes: [], retention: [], callbacks: [], invocationOnlyParameters: [], suspends: false, bindingDependent: false });
  const abi = (width = 64) => ({ key: { definition: definitions[`abi${width}`], bindings: parametric() }, kind: "data-layout",
    occurrence: itemRef(definitions[`abi${width}`]), fingerprint: `abi-${width}`, byteOrder: "little", addressWidth: width });
  const metadata = () => ({ key: { definition: definitions.layout, bindings: parametric() }, kind: "memory-layout", root: 0,
    layouts: [{ id: 0, occurrence: itemRef(definitions.layout), source: 0, dataLayout: definitions.abi64,
      byteSize: 8n, byteAlignment: 8n, stride: 8n, kind: "value", fields: [] }], fields: [] });
  const graph = () => ({ definitions: [definitions.f], edges: [], components: [{ id: ids.encodeComponentId([definitions.f]), definitions: [definitions.f], dependencies: [] }] });
  const libraryIdentity = { module: { providerId: "fixture", providerVersion: "1", packageName: null, moduleSpecifier: "facts", providerModuleId: "main" },
    exportId: "allocation", memberId: null, signatureId: null };
  const supplyScopes = (supplied, target, scopes) => supplied.scopeInventories.set(arenaKey(target), clone(scopes));
  const setup = (canonical = bodyFacts(), factScopes = [emptyScope(), emptyScope()]) => {
    const original = clone(canonical);
    const originalSummary = summary();
    const originalMetadata = metadata();
    const originalTir = tir();
    const bodyRows = new Map([[body, originalTir]]);
    const bodyOwners = new Map([[body, definitions.f], [otherBody, definitions.other]]);
    const callbackSignatures = new Map();
    const scopeRows = { body: factScopes, summary: [emptyScope(), emptyScope()], metadata: [] };
    const scopeInventories = new Map([
      [arenaKey({ kind: "body", instance: canonical.instance }), clone(scopeRows.body)],
      [arenaKey({ kind: "summary", summary: originalSummary.key }), clone(scopeRows.summary)],
      ...["layout", "abi32", "abi64"].map(name => [arenaKey({ kind: "metadata", metadata: { definition: definitions[name], bindings: parametric() } }), []]),
    ]);
    const originalMir = mir();
    const tables = { terms: [{ kind: "primitive", primitive: "int64" }, { kind: "intrinsic", intrinsic: "void" },
      { kind: "fixed-array", element: 0, extent: { length: 9007199254740993n, runtimeBase: "bigint" } }], signatures: [signature()] };
    const metadataRows = new Map([[definitions.layout, originalMetadata], [definitions.abi32, abi(32)], [definitions.abi64, abi(64)], [definitions.missing, null]]);
    const canonicalArenas = new Map([[arenaKey(owner()), original.arena], [arenaKey(summaryOwner(originalSummary.key)), originalSummary.arena]]);
    const context = {
      limits: finiteLimits(), types: tables, diagnostics: [],
      tirBody: selected => { const record = bodyRows.get(selected.body); assert.equal(record !== undefined, true, "named actual TIR lookup"); return record; },
      bodyOwner: selected => { assert.equal(bodyOwners.has(selected), true, "named actual body owner inventory"); return bodyOwners.get(selected); },
      definitionExists: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named definition inventory"); return selected !== definitions.missing; },
      libraryExportExists: selected => { equal(selected, libraryIdentity, "named actual library export"); return true; },
      declaredSiteCount: selected => { equal(selected, libraryIdentity, "named declared-site inventory"); return 1; },
      nodeExists: selected => selected.kind === "body" ? (assert.equal([body, otherBody].includes(selected.value.body), true, "qualified node owner"),
        Number.isSafeInteger(selected.value.node) && selected.value.node >= 0 && selected.value.node <= 31)
        : (assert.equal(Object.values(definitions).includes(selected.value.owner), true, "qualified item owner"), selected.value.node === 0),
      localExists: selected => [body, otherBody].includes(selected.body) && selected.local === 0,
      bindingScopeOf: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named binding inventory"); return selected === definitions.missing ? null : emptyScope(); },
      bindingScopesOf: selected => scopeInventories.get(arenaKey(selected)) ?? null,
      nominalOf: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named nominal declaration inventory");
        return [definitions.layout, definitions.field].includes(selected) ? { kind: "declared", facets: ["instance", "value"] } : null; },
      bindingDependentOf: selected => { assert.equal(Object.values(definitions).includes(selected), true, "actual named dependence inventory"); return selected === definitions.missing ? null : false; },
      captureCount: selected => { assert.equal(selected.definition, definitions.f, "actual independent capture inventory"); return 0; },
      callbackSignaturesOf: (selected, index) => { const key = arenaKey([selected, index]);
        assert.equal(callbackSignatures.has(key), true, "named actual callback signature inventory"); return callbackSignatures.get(key); },
      arenaOf: selected => {
        assert.equal(selected.kind === "body" ? [body, otherBody].includes(selected.instance.body)
          : Object.values(definitions).includes(selected.definition), true, "named qualified arena inventory");
        return canonicalArenas.get(arenaKey(selected)) ?? null; },
      metadataOf: selected => { assert.equal(metadataRows.has(selected.definition), true, "named actual metadata inventory");
        const record = metadataRows.get(selected.definition);
        return record !== null && isDeepStrictEqual(record.key.bindings, selected.bindings) ? record : null; },
    };
    return { canonical: original, summary: originalSummary, metadata: originalMetadata, mir: originalMir, tir: originalTir,
      types: tables, context, metadataRows, canonicalArenas, bodyRows, bodyOwners, callbackSignatures, scopeRows, scopeInventories };
  };

  const arrayText = records => records.length === 0 ? "[]" : `[\n  ${records.join(",\n  ")}\n]`;
  const instanceText = `BodyInstance(body=body:"${body}", bindings=parametric())`;
  const bindingsText = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
  const nodeText = id => `NodeRef(body=body:"${body}", node=n:${id})`;
  const keyText = name => `MetadataKey(definition=def:"${definitions[name]}", bindings=parametric())`;
  const emptyFactsText = `BodyFacts(instance=${instanceText}, arena=RelationalArena(projections=[], producers=[], contexts=[], boundProducers=[], origins=[], boundaries=[]), liveness=LivenessFacts(stores=[], locals=[], bindings=[], captures=[]), initialization=InitializationFacts(reads=[]), refinements=RefinementFacts(refinements=[], integers=[], countedLoops=[]), origins=OriginFacts(points=[], reads=[], subjects=[], writes=[], escapes=[], invocations=[], callbacks=[], activations=[], frontiers=[], constructions=[], instanceRegions=[]), suspension=SuspensionFacts(suspensions=[]), errorStorage=ErrorStorageFacts(errors=[]), pointerBacking=PointerBackingFacts(pointers=[]), observations=[], rawLocations=[], fieldBindings=[], recordBindings=[], memoryBindings=[], selectedMemoryDeclarations=[], closedArrays=[])\n`;
  const emptySummary = () => ({ ...summary(), arena: { projections: [], producers: [], contexts: [], boundProducers: [],
    origins: [{ id: 0, producers: [], includesAbsence: false, kind: "complete" }], boundaries: [] }, result: 0 });
  const emptySummaryText = `Summary(key=SummaryKey(definition=def:"${definitions.f}", bindings=parametric()), signature=sig:0, arena=RelationalArena(projections=[], producers=[], contexts=[], boundProducers=[], origins=${arrayText(["complete(id=origins:0, producers=[], includesAbsence=false)"])}, boundaries=[]), parameters=[], captures=[], result=origins:0, thrown=origins:0, writes=[], retention=[], callbacks=[], invocationOnlyParameters=[], suspends=false, bindingDependent=false)\n`;
  const abiText = width => `data-layout(key=${keyText(`abi${width}`)}, occurrence=item(value=ItemNodeRef(owner=def:"${definitions[`abi${width}`]}", node=n:0)), fingerprint="abi-${width}", byteOrder="little", addressWidth=${width})\n`;
  const graphText = `CallGraph(definitions=${arrayText([`def:"${definitions.f}"`])}, edges=[], components=${arrayText([
    `CallComponent(id=component:"${ids.encodeComponentId([definitions.f])}", definitions=${arrayText([`def:"${definitions.f}"`])}, dependencies=[])`])})\n`;
  const textCase = (name, value, expected, print, parse) => suite.test(name, () => {
    equal(print(value), expected, `${name}: complete independently authored text`);
    equal(parse(expected), { kind: "parsed", value }, `${name}: complete decoded record`);
    equal(parse(print(value)), { kind: "parsed", value }, `${name}: lossless whole-value composition`);
  });
  await textCase("body facts required empty records and qualified identity", emptyFacts(), emptyFactsText, product.printFacts, product.parseFacts);
  await textCase("summary known empty effects", emptySummary(), emptySummaryText, product.printSummary, product.parseSummary);
  for (const width of [32, 64]) await textCase(`authored ${width}-bit ABI`, abi(width), abiText(width), product.printMetadata, product.parseMetadata);
  {
    const input = abi(); input.byteOrder = "big";
    await textCase("authored big-endian ABI", input, abiText(64).replace('byteOrder="little"', 'byteOrder="big"'), product.printMetadata, product.parseMetadata);
    await suite.test("big-endian ABI verifies against its actual selected descriptor", () => {
      const supplied = setup(); supplied.metadataRows.set(definitions.abi64, clone(input));
      equal(product.verifyMetadata(input, supplied.context), [], "complete selected big-endian descriptor vector");
    });
    const bodyOccurrence = abi(); bodyOccurrence.occurrence = { kind: "body", value: nodeRef(1) };
    await textCase("ABI retains a typed body-owned occurrence", bodyOccurrence,
      abiText(64).replace(`item(value=ItemNodeRef(owner=def:"${definitions.abi64}", node=n:0))`, `body(value=${nodeText(1)})`), product.printMetadata, product.parseMetadata);
  }
  await textCase("one real call component", graph(), graphText, product.printCallGraph, product.parseCallGraph);
  await suite.test("every exported value is exactly the twelve approved own-contract ports", () => {
    assert.deepEqual(Object.keys(product).sort(), ["parseCallGraph", "parseFacts", "parseMetadata", "parseSummary", "printCallGraph", "printFacts", "printMetadata", "printSummary", "verifyCallGraph", "verifyFacts", "verifyMetadata", "verifySummary"]);
  });
  await suite.test("all four genuinely supplied valid domains return the complete empty violation vector", () => {
    const inputs = setup();
    equal(product.verifyFacts(inputs.canonical, inputs.mir, inputs.context), [], "complete valid facts");
    equal(product.verifySummary(inputs.summary, inputs.context), [], "complete valid summary");
    equal(product.verifyMetadata(inputs.metadata, inputs.context), [], "complete valid authored metadata");
    equal(product.verifyMetadata(abi(32), inputs.context), [], "complete second ABI");
    equal(product.verifyCallGraph(graph(), inputs.context), [], "complete valid graph");
  });
  await suite.test("known empty binding inventories remain distinct for every applicable root", () => {
    const facts = emptyFacts(); const supplied = setup(facts, []); const retained = emptySummary();
    supplied.canonicalArenas.set(arenaKey(summaryOwner(retained.key)), clone(retained.arena));
    supplyScopes(supplied, { kind: "summary", summary: retained.key }, []);
    equal(product.verifyFacts(facts, supplied.mir, supplied.context), [], "complete no-vector body");
    equal(product.verifySummary(retained, supplied.context), [], "complete no-vector summary");
    equal(product.verifyMetadata(abi(64), supplied.context), [], "complete no-vector metadata");
    for (const target of [{ kind: "body", instance: facts.instance }, { kind: "summary", summary: retained.key }, { kind: "metadata", metadata: abi(64).key }]) {
      supplyScopes(supplied, target, null);
    }
    const message = "The complete binding-scope occurrence inventory must resolve for this exact verification root.";
    equal(product.verifyFacts(facts, supplied.mir, supplied.context), [violation("bindings-complete", bodySite(), message)], "unresolved body inventory is not known empty");
    equal(product.verifySummary(retained, supplied.context), [violation("bindings-complete", { kind: "summary", summary: retained.key }, message)], "unresolved summary inventory is not known empty");
    equal(product.verifyMetadata(abi(64), supplied.context), [violation("bindings-complete", { kind: "metadata", metadata: abi(64).key }, message)], "unresolved metadata inventory is not known empty");
  });
  const malformed = (parse, text, offset, expected, found, label, line = 1, column = offset + 1) => {
    equal(parse(text), { kind: "invalid-text", offset, line, column, expected, found }, label);
  };
  await suite.test("lexical failures preserve full exact UTF-16 error records", () => {
    const parse = product.parseCallGraph;
    malformed(parse, "", 0, ["record"], null, "empty document");
    malformed(parse, "@", 0, ["IR value"], "@", "unknown punctuation");
    malformed(parse, "CallGraph(", 10, [")", "]"], null, "unfinished record");
    malformed(parse, "CallGraph(definitions=[]", 24, [")", "]"], null, "unfinished fields");
    malformed(parse, '"\n"', 1, ["escaped string character"], "\n", "unescaped newline");
    malformed(parse, '"\\q"', 2, ["JSON string escape"], "q", "unknown escape");
    malformed(parse, '"\\u12x4"', 3, ["four hexadecimal digits"], "1", "malformed code unit");
    malformed(parse, '"unterminated', 13, ['"'], null, "unterminated string");
    for (const text of ["-", "01", "1.", "1e", "1e999"]) malformed(parse, text, 0, ["finite decimal number"], text.charAt(0), `bad decimal ${text}`);
    malformed(parse, "01n", 0, ["decimal bigint"], "0", "noncanonical bigint");
    malformed(parse, "CallGraph(definitions=[];)", 24, ["IR value"], ";", "lexical rather than fabricated semantic failure");
    malformed(parse, "CallGraph(definitions=[],)", 25, ["field name"], ")", "trailing field separator");
  });
  await suite.test("unknown records, exact field inventories and order are typed parser failures", () => {
    malformed(product.parseCallGraph, "Unknown()", 0, ["CallGraph"], "Unknown", "unknown root");
    malformed(product.parseCallGraph, "CallGraph()", 10, ["definitions"], ")", "missing first field");
    malformed(product.parseCallGraph, "CallGraph(edges=[])", 10, ["definitions"], "edges", "wrong field order");
    const text = "CallGraph(definitions=[], edges=[], components=[], extra=0)";
    malformed(product.parseCallGraph, text, text.indexOf("extra"), [")"], "extra", "extra field");
    const value = "CallGraph(definitions=0, edges=[], components=[])";
    malformed(product.parseCallGraph, value, value.indexOf("0"), ["array"], "0", "wrong array kind");
    const wrongIdentity = "CallGraph(definitions=[n:0], edges=[], components=[])";
    malformed(product.parseCallGraph, wrongIdentity, wrongIdentity.indexOf("n:0"), ["def:string"], "n", "wrong identity kind");
    const wrongDurable = 'CallGraph(definitions=[def:"not-a-definition"], edges=[], components=[])';
    malformed(product.parseCallGraph, wrongDurable, wrongDurable.indexOf("def:"), ["canonical DefId"], "def", "malformed durable identity");
  });
  await suite.test("non-kind discriminants cannot hide the first misordered field", () => {
    const invalidation = `invalidated(cause="suspension", at=${nodeText(2)}, owner=origins:0)`;
    const row = `ErrorStorageFact(node=n:1, origins=origins:0, writes=[], retention=[], invalidations=${arrayText([invalidation])})`;
    const text = emptyFactsText.replace("ErrorStorageFacts(errors=[])", `ErrorStorageFacts(errors=${arrayText([row])})`);
    const offset = text.indexOf('cause="suspension"'); const before = text.slice(0, offset).split("\n");
    malformed(product.parseFacts, text, offset, ["at"], "cause", "first invalidation field", before.length, before.at(-1).length + 1);
  });
  await suite.test("quoted fields and every admitted JSON escape retain complete values", () => {
    equal(product.parseCallGraph('CallGraph("definitions"=[], "edges"=[], "components"=[])'), { kind: "parsed", value: { definitions: [], edges: [], components: [] } }, "complete quoted field names");
    const input = abi(); input.fingerprint = "/";
    equal(product.parseMetadata(abiText(64).replace('"abi-64"', '"\\/"')), { kind: "parsed", value: input }, "complete JSON escaped slash");
  });
  await suite.test("scalar domains and grammar delimiters retain the complete independent rejection", () => {
    const statement = "StoreLiveness(node=n:1, point=MirPoint(block=b:0, statement=\"zero\"), observed=false)";
    const integer = "IntegerFact(node=n:1, range=IntegerRange(minimum=0, maximum=1n), nonnegative=false)";
    const badObserved = "StoreLiveness(node=n:1, point=MirPoint(block=b:0, statement=null), observed=0)";
    const vectors = [
      [product.parseMetadata, abiText(64).replace('fingerprint="abi-64"', "fingerprint=0"), "fingerprint=0", "fingerprint=", ["string"], "0"],
      [product.parseFacts, emptyFactsText.replace("stores=[]", `stores=${arrayText([statement])}`), 'statement="zero"', "statement=", ["number"], '"zero"'],
      [product.parseFacts, emptyFactsText.replace("integers=[]", `integers=${arrayText([integer])}`), "minimum=0", "minimum=", ["bigint"], "0"],
      [product.parseFacts, emptyFactsText.replace("stores=[]", `stores=${arrayText([badObserved])}`), "observed=0", "observed=", ["boolean"], "0"],
      [product.parseMetadata, abiText(64).replace("addressWidth=64", "addressWidth=0"), "addressWidth=0", "addressWidth=", ["32", "64"], "0"],
      [product.parseFacts, emptyFactsText.replace(`body:"${body}"`, 'body:"not-a-body"'), 'body:"not-a-body"', "", ["canonical BodyId"], "body"],
      [product.parseCallGraph, 'CallGraph(definitions=[], edges=[], components=[CallComponent(id=component:"bad", definitions=[], dependencies=[])])',
        'component:"bad"', "", ["canonical ComponentId"], "component"],
      [product.parseCallGraph, "CallGraph(definitions[])", "[]", "", ["="], "["],
      [product.parseCallGraph, "CallGraph(definitions=[] edges=[], components=[])", "edges", "", [",", ")"], "edges"],
      [product.parseCallGraph, "CallGraph(definitions=[], edges=[], components=[]) 0", ") 0", ") ", ["end of document"], "0"],
      [product.parseCallGraph, "CallGraph(definitions=[0,], edges=[], components=[])", ",]", ",", ["IR value"], "]"],
    ];
    for (const [parse, text, marker, prefix, expected, found] of vectors) {
      const offset = text.indexOf(marker) + prefix.length;
      const before = text.slice(0, offset).split("\n");
      malformed(parse, text, offset, expected, found, `complete scalar or grammar failure ${marker}`, before.length, before.at(-1).length + 1);
    }
  });
  await suite.test("shared inline records are values, not an additional reference arena", () => {
    const point = { block: 0, statement: null };
    const input = emptyFacts(); input.liveness.stores = [{ node: 1, point, observed: false }, { node: 2, point, observed: true }];
    const expected = emptyFactsText.replace("stores=[]", `stores=${arrayText([
      "StoreLiveness(node=n:1, point=MirPoint(block=b:0, statement=null), observed=false)",
      "StoreLiveness(node=n:2, point=MirPoint(block=b:0, statement=null), observed=true)",
    ])}`);
    equal(product.printFacts(input), expected, "complete shared-inline by-value spelling");
    equal(product.parseFacts(expected), { kind: "parsed", value: input }, "complete equal inline values after parsing");
    const supplied = setup(input, []);
    equal(product.verifyFacts(input, supplied.mir, supplied.context), [], "shared inline point is not an inline cycle");
  });
  for (const [name, value, spelling] of [["negative zero", -0, "-0"], ["not a number", NaN, "NaN"], ["positive infinity", Infinity, "+Infinity"], ["negative infinity", -Infinity, "-Infinity"], ["fractional", 0.5, "0.5"], ["exponent", 1e30, "1e+30"]]) {
    const input = emptyFacts(); input.liveness.stores = [{ node: 1, point: { block: 0, statement: value }, observed: false }];
    const expected = emptyFactsText.replace("stores=[]", `stores=${arrayText([`StoreLiveness(node=n:1, point=MirPoint(block=b:0, statement=${spelling}), observed=false)`])}`);
    await textCase(`total plain number ${name}`, input, expected, product.printFacts, product.parseFacts);
  }

  for (const [name, value, spelling] of [["negative zero", -0, "-0"], ["NaN", NaN, "NaN"], ["positive infinity", Infinity, "+Infinity"],
    ["negative infinity", -Infinity, "-Infinity"], ["negative", -1, "-1"], ["fractional", 0.5, "0.5"]]) {
    const input = emptyFacts(); input.initialization.reads = [{ node: value, place: 0, assigned: false }];
    const expected = emptyFactsText.replace("reads=[]", `reads=${arrayText([`InitializationFact(node=n:${spelling}, place=p:0, assigned=false)`])}`);
    await textCase(`total numeric identity ${name}`, input, expected, product.printFacts, product.parseFacts);
  }
  for (const [value, escaped] of [["", '""'], ['"\\/\b\f\n\r\t\u0000\u001f', '"\\\"\\\\/\\b\\f\\n\\r\\t\\u0000\\u001f"'],
    ["\ud800", '"\\ud800"'], ["\udfff", '"\\udfff"'], ["\ud83d\ude80", '"🚀"']]) {
    const input = abi(); input.fingerprint = value;
    await textCase(`UTF-16 fingerprint ${escaped}`, input, abiText(64).replace('"abi-64"', escaped), product.printMetadata, product.parseMetadata);
  }
  await suite.test("every nonempty tuple position rejects its own empty array before verification", () => {
    const origins = "open(id=origins:0, producers=[], includesAbsence=false, boundaries=[])";
    const factsText = emptyFactsText.replace("origins=[], boundaries=[]", `origins=${arrayText([origins])}, boundaries=[]`);
    const originsOffset = factsText.indexOf("boundaries=[]") + "boundaries=".length;
    malformed(product.parseFacts, factsText, originsOffset, ["nonempty array"], "[", "facts origins boundary tuple", 2, origins.length);
    const summaryText = emptySummaryText.replace("complete(id=origins:0, producers=[], includesAbsence=false)", origins);
    const summaryOffset = summaryText.indexOf("boundaries=[]") + "boundaries=".length;
    malformed(product.parseSummary, summaryText, summaryOffset, ["nonempty array"], "[", "summary origins boundary tuple", 2, origins.length);
    const reason = "unproven(node=n:1, guards=[], reason=invalidated(sites=[]))";
    const refinementText = emptyFactsText.replace("refinements=[]", `refinements=${arrayText([reason])}`);
    const reasonOffset = refinementText.indexOf("sites=[]") + "sites=".length;
    malformed(product.parseFacts, refinementText, reasonOffset, ["nonempty array"], "[", "refinement invalidation tuple", 2, reason.indexOf("[]", reason.indexOf("sites=")) + 3);
    for (const field of ["parameters", "captures"]) for (const role of ["reads", "writes"]) {
      const paths = "open(paths=[], boundaries=[])";
      const row = field === "parameters"
        ? `ParameterEffect(slot=parameter(index=0), reads=${role === "reads" ? paths : "complete(paths=[])"}, writes=${role === "writes" ? paths : "complete(paths=[])"})`
        : `CaptureEffect(index=0, reads=${role === "reads" ? paths : "complete(paths=[])"}, writes=${role === "writes" ? paths : "complete(paths=[])"})`;
      const text = emptySummaryText.replace(`${field}=[]`, `${field}=${arrayText([row])}`);
      const offset = text.indexOf("boundaries=[]", text.indexOf(`${field}=[`)) + "boundaries=".length;
      const before = text.slice(0, offset).split("\n");
      malformed(product.parseSummary, text, offset, ["nonempty array"], "[", `${field}.${role} tuple`, before.length, before.at(-1).length + 1);
    }
  });

  const arenaTextCase = async (name, field, rows, authored) => {
    const input = emptyFacts(); input.arena[field] = rows;
    await textCase(name, input, emptyFactsText.replace(`${field}=[]`, `${field}=${arrayText(authored)}`), product.printFacts, product.parseFacts);
    const retained = emptySummary(); retained.arena[field] = rows;
    const needle = field === "origins" ? `origins=${arrayText(["complete(id=origins:0, producers=[], includesAbsence=false)"])}` : `${field}=[]`;
    await textCase(`${name}: summary`, retained, emptySummaryText.replace(needle, `${field}=${arrayText(authored)}`), product.printSummary, product.parseSummary);
  };
  const libraryText = 'LibraryExportIdentity(module=LibraryModuleIdentity(providerId="fixture", providerVersion="1", packageName=null, moduleSpecifier="facts", providerModuleId="main"), exportId="allocation", memberId=null, signatureId=null)';
  const producerTexts = [
    [{ kind: "allocation", at: { kind: "node", node: nodeRef(1) } }, `allocation(id=producer:0, path=null, at=node(node=${nodeText(1)}))`],
    [{ kind: "allocation", at: { kind: "declared", identity: libraryIdentity, site: 0 } }, `allocation(id=producer:0, path=null, at=declared(identity=${libraryText}, site=0))`],
    [{ kind: "parameter", index: 0 }, "parameter(id=producer:0, path=null, index=0)"],
    [{ kind: "capture", index: 0 }, "capture(id=producer:0, path=null, index=0)"],
    [{ kind: "receiver" }, "receiver(id=producer:0, path=null)"],
    [{ kind: "shared", definition: definitions.f, path: 0 }, `shared(id=producer:0, path=path:0, definition=def:"${definitions.f}")`],
    ...["sent", "return", "thrown"].map(channel => [{ kind: "suspension-input", at: nodeRef(1), channel }, `suspension-input(id=producer:0, path=null, at=${nodeText(1)}, channel="${channel}")`]),
    [{ kind: "call-result", at: nodeRef(1), callee: { kind: "direct", definition: definitions.callee } }, `call-result(id=producer:0, path=null, at=${nodeText(1)}, callee=direct(definition=def:"${definitions.callee}"))`],
    [{ kind: "call-result", at: nodeRef(1), callee: { kind: "indirect" } }, `call-result(id=producer:0, path=null, at=${nodeText(1)}, callee=indirect())`],
  ];
  for (const [row, expected] of producerTexts) await arenaTextCase(`producer transport ${expected}`, "producers", [{ id: 0, path: null, ...row }], [expected]);
  const fullIdentity = { ...libraryIdentity, module: { ...libraryIdentity.module, packageName: "@fixture/facts" }, memberId: "field", signatureId: "call" };
  await arenaTextCase("declared site retains every provider package member and signature identity", "producers", [{ id: 0, path: null, kind: "allocation", at: { kind: "declared", identity: fullIdentity, site: 1 } }],
    [`allocation(id=producer:0, path=null, at=declared(identity=${libraryText.replace("packageName=null", 'packageName="@fixture/facts"').replace("memberId=null", 'memberId="field"').replace("signatureId=null", 'signatureId="call"')}, site=1))`]);
  for (const [projection, expected] of [[{ kind: "element" }, "element()"], [{ kind: "deref" }, "deref()"], [{ kind: "index", constant: 9007199254740993n }, "index(constant=9007199254740993n)"]]) {
    await arenaTextCase(`projection transport ${projection.kind}`, "projections", [{ id: 0, parent: null, projection }], [`ProjectionPath(id=path:0, parent=null, projection=${expected})`]);
  }
  await arenaTextCase("full correlated value-context transport", "contexts", [{ id: 0, receiver: 1, arguments: [1, 0], captures: [{ index: 0, location: 1 }] }],
    [`ValueContext(id=context:0, receiver=origins:1, arguments=${arrayText(["origins:1", "origins:0"])}, captures=${arrayText(["CaptureLocation(index=0, location=bound:1)"])})`]);
  for (const kind of ["complete", "open"]) {
    const row = { kind, id: 0, producers: [0, 1], includesAbsence: true };
    if (kind === "open") row.boundaries = [1, 0];
    await arenaTextCase(`origin transport ${kind}`, "origins", [row], [`${kind}(id=origins:0, producers=${arrayText(["bound:0", "bound:1"])}, includesAbsence=true${kind === "open" ? `, boundaries=${arrayText(["boundary:1", "boundary:0"])}` : ""})`]);
  }
  for (const kind of ["external-input", "external-write", "opaque-write", "opaque-result", "unclassified-exposure", "opaque-invocation", "unresolved-transport"]) {
    const row = { id: 0, kind, at: { kind: "node", node: nodeRef(1) }, subject: 0, owner: 1, bindings: emptyBindings(), context: 0, detail: "unknown" };
    await arenaTextCase(`open boundary transport ${kind}`, "boundaries", [row], [`${kind}(id=boundary:0, at=node(node=${nodeText(1)}), subject=producer:0, owner=producer:1, bindings=${bindingsText}, context=context:0, detail="unknown")`]);
    row.owner = null;
    await arenaTextCase(`open boundary without invented owner ${kind}`, "boundaries", [row], [`${kind}(id=boundary:0, at=node(node=${nodeText(1)}), subject=producer:0, owner=null, bindings=${bindingsText}, context=context:0, detail="unknown")`]);
  }
  const fullBindings = {
    classBindings: [{ kind: "bound", parameter: { owner: definitions.f, index: 0 }, type: 0 }, { kind: "rigid", parameter: { owner: definitions.f, index: 1 } }],
    methodBindings: [{ kind: "bound", parameter: { owner: definitions.callee, index: 0 }, type: 1 }],
    capturedBindings: [{ kind: "rigid", parameter: { owner: definitions.other, index: 0 } }],
    selfBindings: [{ kind: "bound", owner: definitions.f, type: 0 }, { kind: "rigid", owner: definitions.other }],
  };
  const fullBindingsText = `BindingVector(classBindings=${arrayText([
    `bound(parameter=TypeParameterIdentity(owner=def:"${definitions.f}", index=0), type=t:0)`, `rigid(parameter=TypeParameterIdentity(owner=def:"${definitions.f}", index=1))`,
  ])}, methodBindings=${arrayText([`bound(parameter=TypeParameterIdentity(owner=def:"${definitions.callee}", index=0), type=t:1)`])}, capturedBindings=${arrayText([
    `rigid(parameter=TypeParameterIdentity(owner=def:"${definitions.other}", index=0))`,
  ])}, selfBindings=${arrayText([`bound(owner=def:"${definitions.f}", type=t:0)`, `rigid(owner=def:"${definitions.other}")`])})`;
  await arenaTextCase("all four complete binding-vector families retain correlation", "boundProducers", [{ id: 0, producer: 1, bindings: fullBindings, context: 0 }],
    [`BoundProducer(id=bound:0, producer=producer:1, bindings=${fullBindingsText}, context=context:0)`]);
  {
    const input = emptyFacts(); input.instance.bindings = { kind: "instantiated", bindings: fullBindings };
    await textCase("complete instantiated body identity transport", input,
      emptyFactsText.replace("bindings=parametric()", `bindings=instantiated(bindings=${fullBindingsText})`), product.printFacts, product.parseFacts);
  }
  {
    const input = emptySummary(); input.key.bindings = { kind: "instantiated", bindings: fullBindings };
    await textCase("complete instantiated summary identity transport", input,
      emptySummaryText.replace("bindings=parametric()", `bindings=instantiated(bindings=${fullBindingsText})`), product.printSummary, product.parseSummary);
  }
  {
    const input = abi(); input.key.bindings = { kind: "instantiated", bindings: fullBindings };
    await textCase("complete instantiated metadata identity transport", input,
      abiText(64).replace("bindings=parametric()", `bindings=instantiated(bindings=${fullBindingsText})`), product.printMetadata, product.parseMetadata);
  }
  {
    const input = graph(); input.edges = [{ caller: definitions.f, at: nodeRef(1), kind: "direct", callee: { kind: "definition", definition: definitions.f },
      bindings: { kind: "instantiated", bindings: fullBindings } }];
    await textCase("complete instantiated call edge identity transport", input, graphText.replace("edges=[]", `edges=${arrayText([
      `direct(caller=def:"${definitions.f}", at=${nodeText(1)}, callee=definition(definition=def:"${definitions.f}"), bindings=instantiated(bindings=${fullBindingsText}))`,
    ])}`), product.printCallGraph, product.parseCallGraph);
  }

  const factOpposite = async (name, prepare, amend, expected) => suite.test(name, () => {
    const input = bodyFacts();
    const supplied = setup(input);
    prepare(input, supplied);
    supplied.canonicalArenas.set(arenaKey({ kind: "body", instance: input.instance }), clone(input.arena));
    supplyScopes(supplied, { kind: "body", instance: input.instance }, supplied.scopeRows.body);
    equal(product.verifyFacts(input, supplied.mir, supplied.context), [], `${name}: independently valid complete fixture`);
    const invalid = clone(input);
    amend(invalid, supplied);
    equal(product.verifyFacts(invalid, supplied.mir, supplied.context), expected, `${name}: complete minimal violation vector`);
  });
  const unchanged = () => {};
  const orderMessage = "Fact rows retain distinct canonical endpoint order.";
  const arenaSite = (kind, key, id) => ({ kind, owner: owner(), [key]: id });
  const basicCases = [
    ["body-instance-exact", (value, supplied) => { supplied.mir.bindings = { kind: "instantiated", bindings: emptyBindings() }; }, bodySite(),
      "Facts, TIR and MIR retain one exact body and complete binding environment."],
    ["cross-owner-qualified", value => { value.arena.producers[0].at.node.body = otherBody; }, { kind: "node", at: { body: otherBody, node: 1 } },
      "A relational occurrence must belong to the same actual body or summary owner."],
    ["relational-site-resolves", value => { value.arena.producers[0].at.node.node = 99; }, nodeSite(99),
      "A relational site must retain an existing qualified source occurrence."],
    ["producer-id-dense", value => { value.arena.producers[0].id = 9; }, arenaSite("producer", "producer", 9), "Producer IDs must equal their dense arena positions."],
    ["context-id-dense", value => { value.arena.contexts[0].id = 9; }, arenaSite("context", "context", 9), "Value-context IDs must equal their dense arena positions."],
    ["bound-producer-id-dense", value => { value.arena.boundProducers[0].id = 9; }, arenaSite("bound-producer", "producer", 9), "Bound-producer IDs must equal their dense arena positions."],
    ["origins-id-dense", value => { value.arena.origins[1].id = 9; }, arenaSite("origins", "origins", 9), "Origins IDs must equal their dense arena positions."],
    ["boundary-id-dense", value => { value.arena.boundaries[0].id = 9; }, arenaSite("boundary", "boundary", 9), "Boundary IDs must equal their dense arena positions."],
    ["projection-id-dense", value => { value.arena.projections[0].id = 9; }, arenaSite("projection", "projection", 9), "Projection IDs must equal their dense arena positions."],
    ["projection-parent-precedes", value => { value.arena.projections[1].parent = 1; }, arenaSite("projection", "projection", 1), "A projection parent must reference an earlier row of the same arena."],
    ["projection-unique", value => { value.arena.projections[1] = { id: 1, parent: null, projection: { kind: "deref" } }; }, arenaSite("projection", "projection", 1), "A parent and selected projection must identify exactly one arena row."],
    ["producer-unique", value => { value.arena.producers.push({ ...clone(value.arena.producers[0]), id: 1 }); }, arenaSite("producer", "producer", 1), "A producer identity and projection must identify exactly one arena row."],
    ["producer-resolves", value => { value.arena.producers[0].path = 99; }, arenaSite("producer", "producer", 0), "A producer projection must resolve in its own relational arena."],
    ["context-resolves", value => { value.arena.boundaries[0].context = 99; }, arenaSite("boundary", "boundary", 0), "A boundary retains its actual value context in the same arena."],
    ["bound-producer-resolves", value => { value.arena.origins[1].producers = [99]; }, arenaSite("origins", "origins", 1), "An origin alternative must reference an actual bound producer in its own arena."],
    ["origin-alternatives-order", value => { value.arena.origins[1].producers = [0, 0]; }, arenaSite("origins", "origins", 1), "Origin alternatives must be distinct and ordered by canonical bound-producer identity."],
    ["origin-alternatives-correlated", value => { value.arena.contexts.push({ id: 1, receiver: null, arguments: [], captures: [] }); value.arena.boundProducers[0].context = 1; }, arenaSite("bound-producer", "producer", 0),
      "Producer, complete type bindings and value context remain one canonical correlated alternative."],
    ["capture-locations-exact", value => { value.arena.contexts[0].captures = [{ index: 0, location: 0 }]; }, arenaSite("context", "context", 0),
      "A capture vector retains actual storage locations rather than creation-time values."],
    ["context-arguments-total", value => { value.arena.contexts[0].arguments = [0]; }, arenaSite("context", "context", 0),
      "A value context retains every actual parameter and the actual receiver slot."],
    ["node-resolves", value => { value.initialization.reads = [{ node: 99, place: 0, assigned: true }]; }, nodeSite(99), "Every fact retains an actual source occurrence in its declared body domain."],
    ["place-resolves", value => { value.initialization.reads = [{ node: 1, place: 99, assigned: true }]; }, nodeSite(1), "A place reference resolves in this exact MIR body."],
    ["mir-point-resolves", value => { value.liveness.stores = [{ node: 1, point: { block: 99, statement: null }, observed: false }]; }, nodeSite(1), "A MIR point names an actual block and statement, or that block's terminator."],
    ["point-refs-resolve", value => { value.origins.points = [{ point: { block: 99, statement: null }, place: 0, origins: 0 }]; }, bodySite(), "A MIR point names an actual block and statement, or that block's terminator."],
    ["origins-resolves", value => { value.origins.reads = [{ node: 1, place: 0, origins: 99 }]; }, nodeSite(1), "Origins resolve in this exact relational arena."],
    ["boundary-resolves", value => { value.origins.writes = [{ node: 1, operation: "mutation", destination: "binding", targets: [], owner: null, values: [], boundaries: [99] }]; }, nodeSite(1), "A boundary resolves in this exact arena."],
    ["live-segments-bounds", value => { value.liveness.locals = [{ local: 0, segments: [{ block: 0, first: 1, last: 0 }] }]; }, { kind: "local", local: { body, local: 0 } },
      "A live interval contains ordered actual statement or terminator positions in its own block."],
  ];
  for (const [rule, amend, site, message] of basicCases) await factOpposite(rule, unchanged, amend, [violation(rule, site, message)]);
  for (const [field, rule, message] of [["producer", "producer-resolves", "A bound alternative must reference an actual producer in its own relational arena."],
    ["context", "context-resolves", "A bound alternative must retain its actual value context in the same arena."]]) {
    await factOpposite(`a bound alternative retains its actual ${field} reference`, unchanged,
      input => { input.arena.boundProducers[0][field] = 99; }, [
        violation(rule, arenaSite("bound-producer", "producer", 0), message),
        violation("origin-alternatives-correlated", arenaSite("bound-producer", "producer", 0), "Producer, complete type bindings and value context remain one canonical correlated alternative."),
      ]);
  }
  await factOpposite("a value context retains its actual receiver origin", unchanged,
    input => { input.arena.contexts[0].receiver = 99; }, [
      violation("origins-resolves", arenaSite("context", "context", 0), "A receiver origin must resolve in its own relational arena."),
      violation("context-arguments-total", arenaSite("context", "context", 0), "A value context retains every actual parameter and the actual receiver slot."),
    ]);
  await factOpposite("a value context retains its actual parameter origins", unchanged,
    input => { input.arena.contexts[0].arguments = [99]; }, [
      violation("origins-resolves", arenaSite("context", "context", 0), "Every parameter-ordered argument must reference origins in its own arena."),
      violation("context-arguments-total", arenaSite("context", "context", 0), "A value context retains every actual parameter and the actual receiver slot."),
    ]);
  for (const field of ["subject", "owner"]) await factOpposite(`a boundary retains its actual ${field} producer`, unchanged,
    input => { input.arena.boundaries[0][field] = 99; },
    [violation("producer-resolves", arenaSite("boundary", "boundary", 0), "A boundary retains its actual subject and optional mutation-owner producer.")]);
  await factOpposite("an open origin retains its actual nonempty boundary reference", input => {
    input.arena.origins[1] = { ...input.arena.origins[1], kind: "open", boundaries: [0] };
  }, input => { input.arena.origins[1].boundaries = [99]; },
  [violation("boundary-resolves", arenaSite("origins", "origins", 1), "Every open-origin boundary must resolve in its own arena.")]);
  for (const field of ["mir", "tir"]) await factOpposite(`body-instance-exact ${field} identity`, unchanged,
    (input, supplied) => { supplied[field].body = otherBody; }, [violation("body-instance-exact", bodySite(), "Facts, TIR and MIR retain one exact body and complete binding environment.")]);
  await factOpposite("actual checked body declaration must exist", unchanged, (input, supplied) => { supplied.context.definitionExists = selected => selected !== definitions.f; },
    [violation("cross-owner-qualified", bodySite(), "The actual checked body retains an existing declaration owner.")]);
  await factOpposite("unknown actual relational owner is not an empty arena", unchanged, (input, supplied) => { supplied.context.arenaOf = () => null; },
    [violation("cross-owner-qualified", bodySite(), "The actual relational owner must resolve to its canonical arena.")]);
  for (const [field, rule, kind, key] of [["projections", "projection-id-dense", "projection", "projection"], ["producers", "producer-id-dense", "producer", "producer"],
    ["contexts", "context-id-dense", "context", "context"], ["boundProducers", "bound-producer-id-dense", "bound-producer", "producer"],
    ["origins", "origins-id-dense", "origins", "origins"], ["boundaries", "boundary-id-dense", "boundary", "boundary"]]) {
    const message = basicCases.find(entry => entry[0] === rule)[3];
    await factOpposite(`${rule} negative zero is not dense positive zero`, unchanged, input => { input.arena[field][0].id = -0; },
      [violation(rule, arenaSite(kind, key, -0), message)]);
  }
  await factOpposite("declared-site-ordinal", value => { value.arena.producers[0].at = { kind: "declared", identity: clone(libraryIdentity), site: 0 }; },
    value => { value.arena.producers[0].at.site = 1; }, [violation("declared-site-ordinal", { kind: "declared-site", owner: owner(), identity: libraryIdentity, site: 1 },
      "A logical site ordinal must name an actual declared allocation site of that export.")]);
  await factOpposite("declared count absent is not known zero", value => { value.arena.producers[0].at = { kind: "declared", identity: clone(libraryIdentity), site: 0 }; },
    (value, supplied) => { supplied.context.declaredSiteCount = () => null; }, [violation("declared-site-ordinal", { kind: "declared-site", owner: owner(), identity: libraryIdentity, site: 0 },
      "A logical site ordinal must name an actual declared allocation site of that export.")]);
  await factOpposite("declared existence remains distinct from ordinal range", value => { value.arena.producers[0].at = { kind: "declared", identity: clone(libraryIdentity), site: 0 }; },
    (value, supplied) => { supplied.context.libraryExportExists = () => false; }, [violation("relational-site-resolves", { kind: "declared-site", owner: owner(), identity: libraryIdentity, site: 0 },
      "A declared relational site must name an existing library export.")]);
  const put = (input, path, value) => { let parent = input; for (const part of path.slice(0, -1)) parent = parent[part]; parent[path.at(-1)] = value; };
  const simpleOrders = [
    ["stores-order", ["liveness", "stores"], node => ({ node, point: { block: 0, statement: null }, observed: true })],
    ["initialization-order", ["initialization", "reads"], node => ({ node, place: 0, assigned: true })],
    ["refinements-order", ["refinements", "refinements"], node => ({ node, guards: [], kind: "proven" })],
    ["reads-order", ["origins", "reads"], node => ({ node, place: 0, origins: 0 })],
    ["subjects-order", ["origins", "subjects"], node => ({ node, role: "value", path: null, origins: 0 })],
    ["writes-order", ["origins", "writes"], node => ({ node, operation: "initialization", destination: "binding", targets: [], owner: null, values: [], boundaries: [] })],
    ["escapes-order", ["origins", "escapes"], node => ({ node, producer: 0, target: { kind: "return" } })],
    ["invocations-order", ["origins", "invocations"], node => ({ node, kind: "call", alternatives: [], boundaries: [] })],
    ["callbacks-order", ["origins", "callbacks"], node => ({ node, argument: { authoredIndex: 0, parameter: definitions.parameter, parameterIndex: 0,
      repeated: false, passing: "by-value", actual: 0, formal: { owner: { kind: "summary", definition: definitions.callee, bindings: parametric() }, producer: 0 }, projection: null }, timing: "synchronous", rejection: null, inputs: [] })],
    ["activations-order", ["origins", "activations"], node => ({ node, definition: definitions.f, context: 0, caller: null, entry: null })],
    ["frontiers-order", ["origins", "frontiers"], node => ({ node, kind: "origin", subject: 0, context: 0 })],
    ["constructions-order", ["origins", "constructions"], node => ({ node, root: nodeRef(node), allocation: nodeRef(node), implementation: null, body: null, regions: [] })],
    ["errors-order", ["errorStorage", "errors"], node => ({ node, origins: 1, writes: [], retention: [], invalidations: [] })],
    ["pointers-order", ["pointerBacking", "pointers"], node => ({ node, returned: false, origins: 1, producers: [] })],
    ["observations-order", ["observations"], node => ({ node, operation: "size", operand: nodeRef(node), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 },
      field: null, result: 0, value: 8n, context: 0, bindings: emptyBindings() })],
    ["raw-locations-order", ["rawLocations"], node => ({ node, operation: "to-raw", pointee: 0, layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, context: 0, bindings: emptyBindings() })],
    ["record-bindings-order", ["recordBindings"], node => ({ node, result: 0, layoutExpression: nodeRef(node), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, context: 0, bindings: emptyBindings(), fields: [] })],
    ["memory-bindings-order", ["memoryBindings"], node => ({ node, kind: "bound", record: 3 })],
    ["closed-arrays-order", ["closedArrays"], node => ({ node, kind: "unproven", reason: { kind: "not-local-element-access", at: nodeRef(node) } })],
  ];
  for (const [rule, path, row] of simpleOrders) await factOpposite(rule, (input, supplied) => {
    put(input, path, [row(1), row(2)]);
    if (["observations-order", "raw-locations-order", "record-bindings-order"].includes(rule)) supplied.scopeRows.body.push(emptyScope(), emptyScope());
    if (rule === "callbacks-order") supplied.canonicalArenas.set(arenaKey({ kind: "summary", definition: definitions.callee, bindings: parametric() }), { ...arena(), producers: [{ id: 0, path: null, kind: "parameter", index: 0 }] });
    if (rule === "memory-bindings-order") input.recordBindings = [{ node: 3, result: 0, layoutExpression: nodeRef(3),
      layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, context: 0, bindings: emptyBindings(), fields: [] }];
    if (rule === "memory-bindings-order") supplied.scopeRows.body.push(emptyScope());
  }, input => { put(input, path, [row(2), row(1)]); }, [violation(rule, nodeSite(1), orderMessage)]);

  const localSite = local => ({ kind: "local", local: { body, local } });
  const withMirEndpoints = supplied => {
    supplied.mir.locals.push({ id: 1, storage: 0, role: { kind: "temporary" }, source: null, origin: sourceOrigin(2) });
    supplied.mir.places.push({ id: 1, base: { kind: "local", local: 1 }, storage: 0, origin: sourceOrigin(2) });
    supplied.mir.blocks[0].statements = [{ kind: "storage-live", local: 0, origin: sourceOrigin(1), tir: nodeRef(1) },
      { kind: "storage-dead", local: 0, origin: sourceOrigin(2), tir: nodeRef(2) }];
    supplied.mir.blocks.push({ id: 1, origin: sourceOrigin(3), tir: nodeRef(3), statements: [],
      terminator: { kind: "return", value: null, origin: sourceOrigin(3), tir: nodeRef(3) } });
  };
  const endpointOrders = [
    ["same store node statement ordinal", "stores-order", ["liveness", "stores"],
      [{ node: 1, point: { block: 0, statement: 0 }, observed: false }, { node: 1, point: { block: 0, statement: 1 }, observed: true }], nodeSite(1)],
    ["same store node terminator last", "stores-order", ["liveness", "stores"],
      [{ node: 1, point: { block: 0, statement: 1 }, observed: false }, { node: 1, point: { block: 0, statement: null }, observed: true }], nodeSite(1)],
    ["same store node block ordinal", "stores-order", ["liveness", "stores"],
      [{ node: 1, point: { block: 0, statement: null }, observed: false }, { node: 1, point: { block: 1, statement: null }, observed: true }], nodeSite(1)],
    ["same read node place ordinal", "reads-order", ["origins", "reads"], [{ node: 1, place: 0, origins: 0 }, { node: 1, place: 1, origins: 1 }], nodeSite(1)],
    ["same point statement ordinal", "points-order", ["origins", "points"],
      [{ point: { block: 0, statement: 0 }, place: 0, origins: 0 }, { point: { block: 0, statement: 1 }, place: 0, origins: 1 }], bodySite()],
    ["same point place ordinal", "points-order", ["origins", "points"],
      [{ point: { block: 0, statement: null }, place: 0, origins: 0 }, { point: { block: 0, statement: null }, place: 1, origins: 1 }], bodySite()],
    ["same point block ordinal", "points-order", ["origins", "points"],
      [{ point: { block: 0, statement: null }, place: 0, origins: 0 }, { point: { block: 1, statement: null }, place: 0, origins: 1 }], bodySite()],
    ["same subject node role", "subjects-order", ["origins", "subjects"],
      [{ node: 1, role: "input", path: null, origins: 0 }, { node: 1, role: "value", path: null, origins: 1 }], nodeSite(1)],
    ["same subject role nullable path", "subjects-order", ["origins", "subjects"],
      [{ node: 1, role: "value", path: null, origins: 0 }, { node: 1, role: "value", path: 0, origins: 1 }], nodeSite(1)],
    ["same frontier node kind", "frontiers-order", ["origins", "frontiers"],
      [{ node: 1, kind: "boundary", subject: 0, context: 0 }, { node: 1, kind: "origin", subject: 0, context: 0 }], nodeSite(1)],
    ["same construction node root", "constructions-order", ["origins", "constructions"],
      [{ node: 1, root: nodeRef(1), allocation: nodeRef(3), implementation: null, body: null, regions: [] },
        { node: 1, root: nodeRef(2), allocation: nodeRef(3), implementation: null, body: null, regions: [] }], nodeSite(1)],
    ["same construction root allocation", "constructions-order", ["origins", "constructions"],
      [{ node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: null, body: null, regions: [] },
        { node: 1, root: nodeRef(1), allocation: nodeRef(3), implementation: null, body: null, regions: [] }], nodeSite(1)],
    ["same construction allocation implementation", "constructions-order", ["origins", "constructions"],
      [{ node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: null, body: null, regions: [] },
        { node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: definitions.f, body: null, regions: [] }], nodeSite(1)],
    ["same construction implementation artifact", "constructions-order", ["origins", "constructions"],
      [{ node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: definitions.f, body: null, regions: [] },
        { node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: definitions.f, body: instance(), regions: [] }], nodeSite(1)],
    ["qualified captured body", "captures-order", ["liveness", "captures"],
      [{ local: { body, local: 0 }, reads: false, writes: true }, { local: { body: otherBody, local: 0 }, reads: true, writes: false }],
      { kind: "local", local: { body, local: 0 } }],
  ];
  for (const [name, rule, path, rows, site] of endpointOrders) await factOpposite(`canonical ${name}`, (input, supplied) => {
    withMirEndpoints(supplied); put(input, path, clone(rows));
  }, input => { put(input, path, clone(rows).reverse()); }, [violation(rule, site, orderMessage)]);
  for (const segments of [[{ block: 0, first: 0, last: 0 }, { block: 0, first: 0, last: 1 }],
    [{ block: 0, first: 0, last: 1 }, { block: 0, first: 1, last: 1 }],
    [{ block: 0, first: 0, last: 1 }, { block: 1, first: 0, last: 0 }]]) {
    await factOpposite(`canonical live segment complete endpoints ${JSON.stringify(segments)}`, (input, supplied) => {
      withMirEndpoints(supplied); input.liveness.locals = [{ local: 0, segments: clone(segments) }];
    }, input => { input.liveness.locals[0].segments.reverse(); }, [violation("live-segments-order", localSite(0), orderMessage)]);
  }
  const additionalFacts = [
    ["locals-order", input => { input.liveness.bindings = [{ local: 0, scope: "body", captured: false }]; },
      input => { input.liveness.bindings.push(clone(input.liveness.bindings[0])); }, localSite(0), orderMessage],
    ["captures-order", input => { input.liveness.captures = [{ local: { body: otherBody, local: 0 }, reads: true, writes: false }]; },
      input => { input.liveness.captures.push(clone(input.liveness.captures[0])); }, { kind: "local", local: { body: otherBody, local: 0 } }, orderMessage],
    ["live-segments-order", input => { input.liveness.locals = [{ local: 0, segments: [{ block: 0, first: 0, last: 0 }] }]; },
      input => { input.liveness.locals[0].segments.push(clone(input.liveness.locals[0].segments[0])); }, localSite(0), orderMessage],
    ["points-order", input => { input.origins.points = [{ point: { block: 0, statement: null }, place: 0, origins: 0 }]; },
      input => { input.origins.points.push(clone(input.origins.points[0])); }, bodySite(), orderMessage],
    ["regions-order", input => { input.origins.instanceRegions = [{ owner: definitions.f, node: nodeRef(1), context: 0 }]; },
      input => { input.origins.instanceRegions.push(clone(input.origins.instanceRegions[0])); }, nodeSite(1), orderMessage],
    ["selected-declarations-order", input => { input.selectedMemoryDeclarations = [definitions.f, definitions.other]; },
      input => { input.selectedMemoryDeclarations.reverse(); }, bodySite(), orderMessage],
    ["type-resolves", input => { input.observations = [{ node: 1, operation: "size", operand: nodeRef(1), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, field: null, result: 0, value: 8n, context: 0, bindings: emptyBindings() }]; },
      input => { input.observations[0].result = 99; }, nodeSite(1), "A fact type resolves in the actual supplied type table."],
    ["metadata-reference-resolves", input => { input.observations = [{ node: 1, operation: "size", operand: nodeRef(1), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, field: null, result: 0, value: 8n, context: 0, bindings: emptyBindings() }]; },
      input => { input.observations[0].layout.layout = 99; }, nodeSite(1), "A layout reference retains its actual metadata declaration, complete binding environment and local layout ID."],
    ["observation-exact-value", input => { input.observations = [{ node: 1, operation: "stride", operand: nodeRef(1), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, field: null, result: 0, value: 8n, context: 0, bindings: emptyBindings() }]; },
      input => { input.observations[0].value = 9n; }, nodeSite(1), "The observation retains the exact authored bigint size, alignment, stride or field offset."],
    ["observation-field-exact", input => { input.observations = [{ node: 1, operation: "alignment", operand: nodeRef(1), layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, field: null, result: 0, value: 8n, context: 0, bindings: emptyBindings() }]; },
      input => { input.observations[0].operation = "field-offset"; }, nodeSite(1), "Only a field-offset observation names the actual selected field metadata."],
    ["pointer-backing-family-exact", input => { input.pointerBacking.pointers = [{ node: 1, returned: false, origins: 1, producers: [{ producer: 0, operation: { family: "typed-location", operation: "allocate", at: nodeRef(1) } }] }]; },
      input => { input.pointerBacking.pointers[0].origins = 0; }, nodeSite(1), "Each pointer backing retains its own correlated producer and exact typed-location or raw-memory operation."],
    ["error-invalidations-order", input => { input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "preserved" }] }]; },
      input => { input.errorStorage.errors[0].invalidations.push(clone(input.errorStorage.errors[0].invalidations[0])); }, nodeSite(1), orderMessage],
    ["error-invalidation-origins-resolve", input => { input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "preserved" }] }]; },
      input => { input.errorStorage.errors[0].invalidations[0].owner = 99; }, nodeSite(1), "An error invalidation retains its actual owner origins in this arena."],
    ["error-invalidation-outcome-exact", input => { input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "invalidated", cause: "overlapping-write", affected: 1 }] }]; },
      input => { input.errorStorage.errors[0].invalidations[0].affected = 0; }, nodeSite(1), "A known empty affected origin cannot be claimed as an overlapping write."],
  ];
  for (const [rule, prepare, amend, site, message] of additionalFacts) await factOpposite(rule, (input, supplied) => {
    prepare(input, supplied);
    if (["type-resolves", "metadata-reference-resolves", "observation-exact-value", "observation-field-exact"].includes(rule)) supplied.scopeRows.body.push(emptyScope());
  }, amend, [violation(rule, site, message)]);
  await factOpposite("instance regions retain their actual lexical declaration inventory", input => {
    input.origins.instanceRegions = [{ owner: definitions.f, node: nodeRef(1), context: 0 }];
  }, input => { input.origins.instanceRegions[0].owner = definitions.missing; },
    [violation("cross-owner-qualified", nodeSite(1), "An instance region retains its actual lexical declaration owner.")]);
  const actualConstruction = input => { input.origins.constructions = [{ node: 1, root: nodeRef(1), allocation: nodeRef(2),
    implementation: definitions.f, body: instance(), regions: [] }]; };
  await factOpposite("constructor body cannot borrow another complete artifact environment", actualConstruction,
    input => { input.origins.constructions[0].body.bindings = { kind: "instantiated", bindings: emptyBindings() }; },
    [violation("cross-owner-qualified", nodeSite(1), "A construction retains its actual selected body, implementation owner and complete artifact environment."),
      violation("bindings-complete", nodeSite(1), "Every inline binding-vector occurrence retains its actual canonical scope in declared field order.")]);
  await factOpposite("constructor implementation retains the actual selected body owner", actualConstruction,
    input => { input.origins.constructions[0].implementation = definitions.other; },
    [violation("cross-owner-qualified", nodeSite(1), "A construction retains its actual selected body, implementation owner and complete artifact environment.")]);
  await factOpposite("memory-binding-error-diagnostic", (input, supplied) => {
    input.memoryBindings = [{ kind: "error", node: 1 }];
    supplied.context.diagnostics = [{ code: { kind: "checker", number: 123, rendered: "TS123" }, severity: "error", site: { kind: "source", origin: sourceOrigin(1) },
      source: "checked", evidence: [], message: "actual checked error", arguments: [], related: [], fix: null }];
  }, (input, supplied) => { supplied.context.diagnostics = []; }, [violation("memory-binding-error-diagnostic", nodeSite(1),
    "An error binding retains an actual error diagnostic from the same complete checked diagnostic vector.")]);
  for (const [field, limit] of [["maximumBlocksPerBody", 1], ["maximumPlacesPerBody", 1], ["maximumProjectionDepth", 2],
    ["maximumOriginAlternatives", 1], ["maximumRelationalRecordsPerBody", 8], ["maximumRelationalReferencesPerBody", 6]]) {
    await factOpposite(`analysis-limits-respected ${field}`, (input, supplied) => { supplied.context.limits[field] = limit; },
      (input, supplied) => { supplied.context.limits[field] = limit - 1; }, [violation("analysis-limits-respected", bodySite(),
        "Published blocks, places, projection depth, alternatives, relational rows and references respect the actual six producer limits.")]);
  }

  const typedValue = (type = 0) => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } });
  const checkedValues = (input, supplied, count = 1) => {
    supplied.tir.root.statements.nodes = Array.from({ length: count }, (_, index) => {
      const statement = index * 2 + 1; const value = statement + 1;
      return { ...header(statement), kind: "ExpressionStatement", expression: { ...header(value, statement), kind: "Identifier", text: "value",
        tsonic: { ...typedValue(), role: "value", resolution: { kind: "local", local: { body, local: 0 } } } }, tsonic: null };
    });
    input.refinements.integers = Array.from({ length: count }, (_, index) => ({ node: index * 2 + 2, range: null, nonnegative: false }));
  };
  await factOpposite("integer-facts-domain-exact", checkedValues, input => { input.refinements.integers = []; }, [violation("integer-facts-domain-exact", bodySite(),
    "Integer proofs retain every actual checked value occurrence, including explicit absent proofs.")]);
  await factOpposite("integer-facts-order", (input, supplied) => checkedValues(input, supplied, 2), input => { input.refinements.integers.reverse(); },
    [violation("integer-facts-order", nodeSite(2), orderMessage)]);
  await factOpposite("integer-range-valid", (input, supplied) => {
    checkedValues(input, supplied); input.refinements.integers[0].range = { minimum: -9007199254740993n, maximum: 9007199254740993n };
  }, input => { input.refinements.integers[0].range = { minimum: -1n, maximum: -2n }; },
    [violation("integer-range-valid", nodeSite(2), "An exact integer interval has ordered bigint endpoints.")]);
  await factOpposite("integer-proofs-consistent", (input, supplied) => {
    checkedValues(input, supplied); input.refinements.integers[0].range = { minimum: -1n, maximum: 9007199254740993n };
  }, input => { input.refinements.integers[0].nonnegative = true; }, [violation("integer-proofs-consistent", nodeSite(2),
    "A published interval and nonnegative proof cannot contradict one another.")]);
  await factOpposite("nested callable and default initializer values belong only to their actual bodies", (input, supplied) => {
    const callableBody = ids.encodeBodyId({ owner: definitions.callee, role: "function", ordinal: 0 });
    const defaultBody = ids.encodeBodyId({ owner: definitions.parameter, role: "default-argument", ordinal: 0 });
    supplied.types.signatures.push(signature(1, [{ declaration: definitions.parameter, kind: "default", type: 0, passing: "by-value", initializer: defaultBody }], null, definitions.callee));
    supplied.types.terms.push({ kind: "callable", calls: [1], constructs: [] });
    const value = (id, parent) => ({ ...header(id, parent), kind: "Identifier", text: "outer", tsonic: {
      ...typedValue(), role: "value", resolution: { kind: "local", local: { body, local: 0 } },
    } });
    supplied.tir.root.statements.nodes = [{ ...header(1), kind: "ExpressionStatement", tsonic: null, expression: {
      ...header(2, 1), kind: "ArrowFunction", modifiers: null, typeParameters: null, type: null, fullSignature: null, asteriskToken: null,
      parameters: { loc: { pos: 3, end: 6 }, nodes: [{ ...header(3, 2), kind: "Parameter", modifiers: null, dotDotDotToken: null, questionToken: null, type: null,
        name: { ...header(4, 3), kind: "Identifier", text: "argument", tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: definitions.parameter }, storage: 0 } },
        initializer: value(5, 3), tsonic: { declaration: definitions.parameter, local: { body: callableBody, local: 0 }, storage: 0, passing: "by-value", initializer: defaultBody } }] },
      equalsGreaterThanToken: { ...header(6, 2), kind: "EqualsGreaterThanToken", tsonic: null }, body: value(7, 2),
      tsonic: { ...typedValue(3), callable: { definition: definitions.callee, parameters: [], signatures: [
        { declaration: definitions.callee, role: "api-signature", signature: 1, body: callableBody },
      ], template: { body: callableBody, lexicalBindings: emptyBindings(), dependence: "parametric" }, attributes: [] }, captures: [{ body, local: 0 }] },
    } }];
    supplied.tir.nestedBodies = [callableBody, defaultBody];
    input.refinements.integers = [{ node: 2, range: null, nonnegative: false }];
  }, input => { input.refinements.integers.push({ node: 5, range: null, nonnegative: false }, { node: 7, range: null, nonnegative: false }); },
    [violation("integer-facts-domain-exact", bodySite(), "Integer proofs retain every actual checked value occurrence, including explicit absent proofs.")]);
  const countedLoop = (input, supplied) => {
    supplied.types.terms.push({ kind: "primitive", primitive: "bool" });
    const name = (id, parent) => ({ ...header(id, parent), kind: "Identifier", text: "counter", tsonic: { ...typedValue(), role: "value", resolution: { kind: "local", local: { body, local: 0 } } } });
    const literal = (id, parent, value) => ({ ...header(id, parent), kind: "NumericLiteral", text: String(value), tokenFlags: [],
      tsonic: { ...typedValue(), role: "value", value: { numerator: BigInt(value), denominator: 1n, negativeZero: false } } });
    const operation = (operator, result) => ({ kind: "decided", decision: { operation: { kind: "selected", operation: { kind: "native-operator", operator, carrier: "int64" }, operands: operator === "++" ? [0] : [0, 0], result }, permissionScope: null } });
    supplied.tir.root.statements.nodes = [{ ...header(1), kind: "ForStatement", tsonic: null,
      initializer: { ...header(2, 1), kind: "VariableDeclarationList", tsonic: { role: "ordinary" }, declarations: { loc: { pos: 3, end: 6 }, nodes: [
        { ...header(3, 2), kind: "VariableDeclaration", exclamationToken: null, type: null,
          name: { ...header(4, 3), kind: "Identifier", text: "counter", tsonic: { role: "declaration-name", declaration: { kind: "local", local: { body, local: 0 } }, storage: 0 } },
          initializer: literal(5, 3, 0), tsonic: { declaration: { kind: "local", local: { body, local: 0 } }, storage: 0, initializer: null } },
      ] } }, condition: { ...header(6, 1), kind: "BinaryExpression", modifiers: null, type: null, left: name(7, 6),
        operatorToken: { ...header(8, 6), kind: "LessThanToken", tsonic: null }, right: literal(9, 6, 10),
        tsonic: { ...typedValue(3), role: "comparison", operation: operation("<", 3) } },
      incrementor: { ...header(10, 1), kind: "PostfixUnaryExpression", operator: "PlusPlusToken", operand: name(11, 10), tsonic: { ...typedValue(), storage: 0, operation: operation("++", 0) } },
      statement: { ...header(12, 1), kind: "Block", statements: { loc: { pos: 13, end: 14 }, nodes: [{ ...header(13, 12), kind: "EmptyStatement", tsonic: null }] }, tsonic: null },
    }];
    supplied.tir.locals = [{ id: 0, declaration: { kind: "body", value: nodeRef(3) }, name: "counter", role: "binding", capturedFrom: null, mutable: true, storage: 0 }];
    input.refinements.integers = [5, 6, 7, 9, 10, 11].map(node => ({ node, range: null, nonnegative: false }));
    input.refinements.countedLoops = [{ statement: 1, counterDeclaration: 3, start: 5, bound: 9, body: 12, direction: "ascending", comparison: "exclusive-upper-bound", step: 1 }];
  };
  const loopMessage = "A counted loop retains its actual initialized counter, exclusive upper comparison and unit increment.";
  await factOpposite("counted-loops-order", countedLoop, input => { input.refinements.countedLoops.push(clone(input.refinements.countedLoops[0])); },
    [violation("counted-loops-order", nodeSite(1), orderMessage)]);
  for (const endpoint of ["statement", "counterDeclaration", "start", "bound", "body"]) await factOpposite(`counted-loop-endpoints-resolve ${endpoint}`, countedLoop,
    input => { input.refinements.countedLoops[0][endpoint] = 99; }, [
      violation("counted-loop-endpoints-resolve", nodeSite(endpoint === "statement" ? 99 : 1), "All five counted-loop endpoints retain actual occurrences in this body."),
      violation("counted-loop-conditions-exact", nodeSite(endpoint === "statement" ? 99 : 1), loopMessage),
    ]);
  await factOpposite("counted-loop-conditions-exact actual comparison counter", countedLoop, (input, supplied) => {
    supplied.tir.root.statements.nodes[0].condition.left.tsonic.resolution.local = { body: otherBody, local: 0 };
  }, [violation("counted-loop-conditions-exact", nodeSite(1), loopMessage)]);
  await factOpposite("counted-loop-conditions-exact actual increment counter", countedLoop, (input, supplied) => {
    supplied.tir.root.statements.nodes[0].incrementor.operand.tsonic.resolution.local = { body: otherBody, local: 0 };
  }, [violation("counted-loop-conditions-exact", nodeSite(1), loopMessage)]);

  const completePaths = () => ({ kind: "complete", paths: [] });
  const parameter = (declaration = definitions.parameter, type = 0) => ({ declaration, kind: "required", type, passing: "by-value", initializer: null });
  const summarySite = () => ({ kind: "summary", summary: { definition: definitions.f, bindings: parametric() } });
  const summaryOpposite = async (name, prepare, amend, expected) => suite.test(`summary ${name}`, () => {
    const supplied = setup(); const input = summary();
    prepare(input, supplied); supplied.canonicalArenas.set(arenaKey(summaryOwner(input.key)), clone(input.arena));
    supplyScopes(supplied, { kind: "summary", summary: input.key }, supplied.scopeRows.summary);
    equal(product.verifySummary(input, supplied.context), [], `summary ${name}: complete valid value`);
    const invalid = clone(input); amend(invalid, supplied);
    equal(product.verifySummary(invalid, supplied.context), expected, `summary ${name}: complete opposite vector`);
  });
  const oneParameter = (input, supplied) => {
    supplied.types.signatures[0] = signature(0, [parameter()]);
    input.parameters = [{ slot: { kind: "parameter", index: 0 }, reads: completePaths(), writes: completePaths() }];
  };
  const oneCallback = (input, supplied) => {
    oneParameter(input, supplied);
    supplied.types.terms.push({ kind: "callable", calls: [1], constructs: [] });
    supplied.types.signatures.push(signature(1, [parameter(definitions.capture)], null, definitions.callee));
    supplied.types.signatures[0].parameters[0].type = 3;
    supplied.callbackSignatures.set(arenaKey([input.key, 0]), [1]);
    input.callbacks = [{ parameterIndex: 0, timing: "synchronous", rejection: null, inputs: [] }];
  };
  const invocationFixture = (input, supplied) => {
    supplied.scopeRows.body = [emptyScope(), emptyScope(), emptyScope(), emptyScope()];
    supplied.types.signatures.push(signature(1, [parameter(definitions.parameter), parameter(definitions.capture)], null, definitions.callee));
    supplied.types.terms.push({ kind: "callable", calls: [1], constructs: [] });
    const endpoint = role => ({ declaration: definitions.callee, role, signature: 1, body: null });
    const resolution = { decision: { candidate: 0, advertised: endpoint("advertised"), api: endpoint("api-signature"), bindings: emptyBindings(), implementationBindings: emptyBindings(),
      parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }, { kind: "argument", parameter: 1, argument: 1, component: null, passing: "by-value" }],
      completion: { signature: 1, completion: 1, yielded: null, sent: null }, result: 1 }, activation: null, captures: [] };
    supplied.tir.root = { ...header(1), kind: "CallExpression", questionDotToken: null, typeArguments: null,
      expression: { ...header(2, 1), kind: "Identifier", text: "callee", tsonic: { ...typedValue(3), role: "value",
        resolution: { kind: "definition", definition: definitions.callee, aliases: [] } } },
      arguments: { loc: { pos: 3, end: 5 }, nodes: [3, 4].map((id, index) => ({ ...header(id, 1), kind: "NumericLiteral",
        text: String(index + 1), tokenFlags: [], tsonic: { ...typedValue(), role: "value",
          value: { numerator: BigInt(index + 1), denominator: 1n, negativeZero: false } } })) },
      tsonic: { ...typedValue(1), application: { kind: "decided", decision: { callee: resolution, receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: 3 }, { kind: "provided", parameter: 1, expression: 4 }] } }, operation: null } };
    input.refinements.integers = [1, 2, 3, 4].map(node => ({ node, range: null, nonnegative: false }));
    supplied.mir.blocks[0].tir = nodeRef(1); supplied.mir.blocks[0].terminator.tir = nodeRef(1);
    const selectedOwner = { kind: "summary", definition: definitions.callee, bindings: parametric() };
    const transports = [definitions.parameter, definitions.capture].map((parameter, index) => ({ authoredIndex: index, parameter, parameterIndex: index,
      repeated: false, passing: "by-value", actual: 0, formal: { owner: clone(selectedOwner), producer: index }, projection: null }));
    supplied.canonicalArenas.set(arenaKey(selectedOwner), { projections: [], producers: transports.map((value, index) => ({ id: index, path: null, kind: "parameter", index })), contexts: [], boundProducers: [], origins: [], boundaries: [] });
    input.arena.contexts[0].arguments = [0, 0];
    input.origins.invocations = [{ node: 1, kind: "call", alternatives: [{ resolution, context: 0, arguments: transports, result: 0, thrown: 0,
      summary: { definition: definitions.callee, bindings: parametric() } }], boundaries: [] }];
  };
  const restFixture = (mode, input, supplied) => {
    invocationFixture(input, supplied);
    supplied.types.terms.push({ kind: "array", element: 0, readonly: false });
    const tuple = mode === "dynamic" ? null : mode === "empty" ? [] : [0, 0];
    supplied.types.terms.push(tuple === null ? { kind: "array", element: 0, readonly: false }
      : { kind: "tuple", elements: tuple.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
    const alternative = input.origins.invocations[0].alternatives[0];
    const restIndex = mode === "head" ? 1 : 0;
    const restParameter = parameter(restIndex === 0 ? definitions.parameter : definitions.capture, 4); restParameter.kind = "rest";
    supplied.types.signatures[1].parameters = mode === "head" ? [parameter(), restParameter] : [restParameter];
    alternative.resolution.decision.parameters = mode === "head"
      ? [{ kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" }, { kind: "rest", parameter: 1, arguments: [0], passing: "by-value" }]
      : [{ kind: "rest", parameter: 0, arguments: [0], passing: "by-value" }];
    const call = supplied.tir.root;
    const spread = { ...header(3, 1), kind: "SpreadElement", expression: { ...header(4, 3), kind: "Identifier", text: "tuple",
      tsonic: { ...typedValue(5), role: "value", resolution: { kind: "definition", definition: definitions.other, aliases: [] } } },
      tsonic: { ...typedValue(5), protocol: { kind: "decided", decision: { kind: "spread", asynchronous: false, steps: [], value: 0, completion: 1, sent: null, thrown: 1 } } } };
    call.arguments.nodes = mode === "value" ? [call.arguments.nodes[0]] : [spread];
    call.tsonic.application.decision.arguments = [{ kind: "rest", parameter: restIndex,
      parts: [mode === "value" ? { kind: "value", expression: 3 } : { kind: "spread", expression: 4, tuple }] }];
    if (mode === "head") call.tsonic.application.decision.arguments.unshift({ kind: "provided", parameter: 0, expression: 4 });
    input.refinements.integers = (mode === "value" ? [1, 2, 3] : [1, 2, 3, 4]).map(node => ({ node, range: null, nonnegative: false }));
    const selectedOwner = summaryOwner(alternative.summary);
    supplied.canonicalArenas.set(arenaKey(selectedOwner), { projections: [], producers: supplied.types.signatures[1].parameters.map((formal, index) =>
      ({ id: index, path: null, kind: "parameter", index })), contexts: [], boundProducers: [], origins: [], boundaries: [] });
    input.arena.contexts[0].arguments = mode === "head" ? [0, 0] : [0];
    const transport = (parameterIndex, projection, repeated = false) => ({ authoredIndex: 0,
      parameter: supplied.types.signatures[1].parameters[parameterIndex].declaration, parameterIndex, repeated, passing: "by-value", actual: 0,
      formal: { owner: clone(selectedOwner), producer: parameterIndex }, projection });
    if (mode === "empty") alternative.arguments = [];
    else if (mode === "dynamic") {
      input.arena.projections.push({ id: 2, parent: null, projection: { kind: "element" } });
      alternative.arguments = [transport(0, 2, true)];
    } else if (mode === "value") alternative.arguments = [transport(0, null)];
    else {
      input.arena.projections.push({ id: 2, parent: null, projection: { kind: "index", constant: 0n } },
        { id: 3, parent: null, projection: { kind: "index", constant: 1n } });
      alternative.arguments = mode === "head" ? [transport(0, 2), transport(1, 3)] : [transport(0, 2), transport(0, 3)];
    }
  };
  const restMessage = "Rest transports retain every actual unconsumed tuple component or one symbolic repeated sequence, including known empty spreads.";
  for (const mode of ["empty", "finite", "dynamic", "value", "head"]) await factOpposite(`actual selected rest ${mode}`, (input, supplied) => restFixture(mode, input, supplied),
    input => {
      const alternative = input.origins.invocations[0].alternatives[0];
      if (mode === "empty") alternative.arguments = [{ authoredIndex: 0, parameter: definitions.parameter, parameterIndex: 0, repeated: false,
        passing: "by-value", actual: 0, formal: { owner: summaryOwner(alternative.summary), producer: 0 }, projection: null }];
      else if (mode === "value") alternative.arguments[0].repeated = true;
      else if (mode === "head") alternative.arguments[1].projection = 2;
      else alternative.arguments.pop();
    }, [violation("argument-transports-total", nodeSite(1), restMessage)]);
  await factOpposite("absent rest is not an invented empty-rest transport", (input, supplied) => {
    restFixture("empty", input, supplied);
    input.origins.invocations[0].alternatives[0].resolution.decision.parameters[0].arguments = [];
    supplied.tir.root.arguments.nodes = [];
    supplied.tir.root.tsonic.application.decision.arguments = [{ kind: "omitted", parameter: 0, value: { kind: "empty-rest" } }];
    input.refinements.integers = [1, 2].map(node => ({ node, range: null, nonnegative: false }));
  }, input => {
    const alternative = input.origins.invocations[0].alternatives[0];
    alternative.arguments = [{ authoredIndex: null, parameter: definitions.parameter, parameterIndex: 0, repeated: false,
      passing: "by-value", actual: 0, formal: { owner: summaryOwner(alternative.summary), producer: 0 }, projection: null }];
  }, [violation("argument-transports-total", nodeSite(1), "A transport retains its actual selected argument, default, omission or rest mapping and correlated origins."),
    violation("argument-transports-total", nodeSite(1), restMessage)]);
  for (const kind of ["default", "omitted"]) await factOpposite(`actual selected ${kind} has no invented authored occurrence`, (input, supplied) => {
    invocationFixture(input, supplied);
    const alternative = input.origins.invocations[0].alternatives[0];
    const initializer = ids.encodeBodyId({ owner: definitions.capture, role: "default-argument", ordinal: 0 });
    const formal = supplied.types.signatures[1].parameters[1]; formal.kind = kind === "default" ? "default" : "optional";
    formal.initializer = kind === "default" ? initializer : null;
    alternative.resolution.decision.parameters[1] = kind === "default" ? { kind, parameter: 1, initializer } : { kind, parameter: 1, type: 1 };
    alternative.arguments[1].authoredIndex = null;
    supplied.tir.root.arguments.nodes.pop();
    supplied.tir.root.tsonic.application.decision.arguments[1] = { kind: "omitted", parameter: 1,
      value: kind === "default" ? { kind: "initializer", instance: { body: initializer, bindings: parametric() } } : { kind: "absence" } };
    input.refinements.integers.pop();
    if (kind === "omitted") {
      input.arena.origins.push({ id: 2, kind: "complete", producers: [], includesAbsence: true });
      input.arena.contexts[0].arguments[1] = 2; alternative.arguments[1].actual = 2;
    }
  }, input => { input.origins.invocations[0].alternatives[0].arguments[1].authoredIndex = 1; },
    [violation("argument-transports-total", nodeSite(1), "A transport retains its actual selected argument, default, omission or rest mapping and correlated origins.")]);
  const invocationCases = [
    ["signature-resolves", (input, supplied) => { input.origins.invocations[0].alternatives[0].resolution.decision.completion.signature = 99; },
      "A fact signature resolves in the actual supplied signature table."],
    ["argument-transports-total", input => { input.origins.invocations[0].alternatives[0].arguments.pop(); },
      "Every non-rest selected formal has its complete actual or explicit omitted transport."],
    ["argument-transports-authored-order", input => { input.origins.invocations[0].alternatives[0].arguments.reverse(); },
      "Transports retain authored actual evaluation order without inventing a flattened runtime slot."],
    ["invocation-contexts-correlated", input => { input.origins.invocations[0].alternatives[0].resolution.captures = [{ body: otherBody, local: 0 }]; },
      "Each invocation alternative retains its own complete actual captured-location vector."],
    ["summary-reference-exact", input => { input.origins.invocations[0].alternatives[0].summary.bindings = { kind: "instantiated", bindings: emptyBindings() }; },
      "An invocation names the actual selected declaration and exact instantiated summary environment."],
  ];
  for (const [rule, amend, message] of invocationCases) {
    const expected = [violation(rule, nodeSite(1), message)];
    if (rule === "summary-reference-exact") expected.unshift(...[0, 1].map(() => violation("cross-owner-qualified", nodeSite(1),
      "An argument's formal producer belongs to this exact callee summary and complete binding environment.")));
    if (rule === "summary-reference-exact") expected.push(violation("bindings-complete", nodeSite(1),
      "Every inline binding-vector occurrence retains its actual canonical scope in declared field order."));
    await factOpposite(rule, invocationFixture, amend, expected);
  }
  await factOpposite("bindings-complete complete lexical class family", (input, supplied) => {
    invocationFixture(input, supplied);
    const scope = { ...emptyScope(), classParameters: [{ owner: definitions.callee, index: 0 }] };
    supplied.context.bindingScopeOf = selected => selected === definitions.callee ? scope : emptyScope();
    supplied.scopeRows.body = [emptyScope(), emptyScope(), scope, scope];
    input.origins.invocations[0].alternatives[0].resolution.decision.bindings.classBindings = [{ kind: "rigid", parameter: { owner: definitions.callee, index: 0 } }];
    input.origins.invocations[0].alternatives[0].resolution.decision.implementationBindings.classBindings = [{ kind: "rigid", parameter: { owner: definitions.callee, index: 0 } }];
  }, input => { input.origins.invocations[0].alternatives[0].resolution.decision.bindings.classBindings = []; },
    [violation("bindings-complete", nodeSite(1), "A binding vector retains every expected class, method, captured and self binding in canonical owner order.")]);
  await factOpposite("missing lexical scope is not an empty environment", (input, supplied) => {
    invocationFixture(input, supplied);
  }, (input, supplied) => { supplied.context.bindingScopeOf = selected => selected === definitions.callee ? null : emptyScope(); },
    [violation("bindings-complete", nodeSite(1), "The complete lexical binding scope must resolve in the supplied declaration inventory."),
      violation("bindings-complete", nodeSite(1), "The complete lexical binding scope must resolve in the supplied declaration inventory.")]);
  for (const field of ["authoredIndex", "parameterIndex"]) {
    for (const invalid of [-1, -0, 0.5, NaN, Infinity, -Infinity]) await factOpposite(`transport ${field} retains its actual index domain ${String(invalid)}/${Object.is(invalid, -0)}`,
      invocationFixture, input => { input.origins.invocations[0].alternatives[0].arguments[0][field] = invalid; },
      [violation("argument-transports-total", nodeSite(1), "A transport retains actual nonnegative authored and formal indices."),
        ...(field === "parameterIndex" && !Object.is(invalid, -0) ? [violation("argument-transports-total", nodeSite(1), "A transport's formal producer retains its actual declaration parameter position."),
          violation("argument-transports-total", nodeSite(1), "Transports retain complete selected formals, passing modes and effective actual components exactly once."),
          violation("argument-transports-total", nodeSite(1), "Every non-rest selected formal has its complete actual or explicit omitted transport.")] : []),
        ...(field === "authoredIndex" && (Number.isNaN(invalid) || invalid === Infinity) ? [violation("argument-transports-authored-order", nodeSite(1),
          "Transports retain authored actual evaluation order without inventing a flattened runtime slot.")] : [])]);
  }
  await factOpposite("actual context origins cannot be independently permuted", (input, supplied) => { invocationFixture(input, supplied);
    input.arena.contexts[0].arguments = [0, 1]; input.origins.invocations[0].alternatives[0].arguments[1].actual = 1; },
    input => { input.arena.contexts[0].arguments.reverse(); }, [violation("origin-alternatives-correlated", arenaSite("context", "context", 0),
      "A value context retains its actual receiver and parameter origins without mixing alternatives."),
      ...[0, 1].map(() => violation("argument-transports-total", nodeSite(1), "A transport retains its actual selected argument, default, omission or rest mapping and correlated origins."))]);
  const bodylessDependentInvocation = (input, supplied) => {
    invocationFixture(input, supplied);
    const alternative = input.origins.invocations[0].alternatives[0];
    const identity = { owner: definitions.callee, index: 0 };
    const environment = { ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: identity, type: 0 }] };
    supplied.types.signatures[1].typeParameters = [{ identity, declaration: definitions.parameter, constraint: null, default: null }];
    supplied.types.signatures.push(signature(2, [parameter(definitions.parameter), parameter(definitions.capture)], null, definitions.other));
    alternative.resolution.decision.advertised = { declaration: definitions.other, role: "advertised", signature: 2, body: null };
    alternative.resolution.decision.implementationBindings = environment;
    alternative.summary.bindings = { kind: "instantiated", bindings: clone(environment) };
    const selectedOwner = summaryOwner(alternative.summary);
    for (const transport of alternative.arguments) transport.formal.owner = clone(selectedOwner);
    supplied.canonicalArenas.set(arenaKey(selectedOwner), { projections: [], producers: [
      { id: 0, path: null, kind: "parameter", index: 0 }, { id: 1, path: null, kind: "parameter", index: 1 },
    ], contexts: [], boundProducers: [], origins: [], boundaries: [] });
    supplied.context.bindingScopeOf = definition => definition === definitions.callee ? { ...emptyScope(), methodParameters: [identity] } : emptyScope();
    supplied.context.bindingDependentOf = definition => definition === definitions.callee;
    const expectedScope = { ...emptyScope(), methodParameters: [identity] };
    supplied.scopeRows.body = [emptyScope(), emptyScope(), emptyScope(), expectedScope, expectedScope, expectedScope, expectedScope];
  };
  await factOpposite("bodyless API environment never borrows the advertised namespace", bodylessDependentInvocation,
    input => { input.origins.invocations[0].alternatives[0].resolution.decision.implementationBindings.methodBindings[0].type = 1; },
    [violation("summary-reference-exact", nodeSite(1), "An invocation names the actual selected declaration and exact instantiated summary environment.")]);
  await factOpposite("unknown actual API dependence is not parametric", invocationFixture,
    (input, supplied) => { supplied.context.bindingDependentOf = definition => definition === definitions.callee ? null : false; },
    [violation("summary-reference-exact", nodeSite(1), "An invocation names the actual selected declaration and exact instantiated summary environment.")]);
  const actualDependentActivation = (input, supplied) => {
    bodylessDependentInvocation(input, supplied);
    const alternative = input.origins.invocations[0].alternatives[0];
    const calleeBody = ids.encodeBodyId({ owner: definitions.callee, role: "function", ordinal: 0 });
    const actual = tir(); actual.body = calleeBody; actual.owner = definitions.callee; actual.signature = 1;
    actual.bindings = clone(alternative.summary.bindings); actual.lexicalBindings = clone(alternative.resolution.decision.implementationBindings);
    actual.dependence = "binding-dependent";
    actual.params = supplied.types.signatures[1].parameters.map((formal, local) => ({ local, declaration: formal.declaration,
      role: formal.kind, passing: formal.passing, initializer: formal.initializer, storage: formal.type }));
    actual.locals = actual.params.map(parameter => ({ id: parameter.local, declaration: itemRef(parameter.declaration), name: `parameter${parameter.local}`,
      role: "parameter", capturedFrom: null, mutable: true, storage: parameter.storage }));
    supplied.bodyRows.set(calleeBody, actual);
    supplied.bodyOwners.set(calleeBody, definitions.callee);
    supplied.scopeRows.body.splice(4, 0, supplied.scopeRows.body[3]);
    alternative.resolution.decision.api.body = calleeBody;
    alternative.resolution.activation = { body: calleeBody, bindings: clone(alternative.summary.bindings) };
  };
  await factOpposite("activation validates but never replaces the canonical API environment", actualDependentActivation,
    input => { input.origins.invocations[0].alternatives[0].resolution.activation = { body: ids.encodeBodyId({ owner: definitions.callee, role: "function", ordinal: 0 }), bindings: parametric() }; },
    [violation("summary-reference-exact", nodeSite(1), "An invocation names the actual selected declaration and exact instantiated summary environment."),
      violation("bindings-complete", bodySite(), "The canonical binding-scope inventory has no extra inline vector occurrence.")]);
  await factOpposite("activation retains the actual selected body identity", actualDependentActivation,
    (input, supplied) => { supplied.bodyRows.get(input.origins.invocations[0].alternatives[0].resolution.activation.body).body = otherBody; },
    [violation("summary-reference-exact", nodeSite(1), "An invocation names the actual selected declaration and exact instantiated summary environment.")]);
  await factOpposite("activation retains the actual selected declaration owner", actualDependentActivation,
    (input, supplied) => { supplied.bodyRows.get(input.origins.invocations[0].alternatives[0].resolution.activation.body).owner = definitions.other; },
    [violation("summary-reference-exact", nodeSite(1), "An invocation names the actual selected declaration and exact instantiated summary environment."),
      violation("bindings-complete", nodeSite(1), "A binding vector retains every expected class, method, captured and self binding in canonical owner order.")]);

  const formalInventory = (kind, input, supplied) => {
    input.arena.producers[0] = kind === "receiver" ? { id: 0, path: null, kind }
      : { id: 0, path: null, kind, index: 0 };
    if (kind === "parameter") {
      supplied.types.signatures[0].parameters = [parameter()];
      supplied.tir.params = [{ local: 0, declaration: definitions.parameter, role: "required", passing: "by-value", initializer: null, storage: 0 }];
      supplied.tir.locals = [{ id: 0, declaration: itemRef(definitions.parameter), name: "argument", role: "parameter", capturedFrom: null, mutable: true, storage: 0 }];
      input.arena.contexts[0].arguments = [1];
    } else if (kind === "capture") {
      supplied.tir.captures = [{ body: otherBody, local: 0 }];
      supplied.tir.locals = [{ id: 0, declaration: { kind: "body", value: { body: otherBody, node: 1 } }, name: "captured", role: "capture",
        capturedFrom: { body: otherBody, local: 0 }, mutable: true, storage: 0 }];
      input.arena.contexts[0].captures = [{ index: 0, location: 0 }];
    } else {
      supplied.types.signatures[0].receiver = 0;
      input.arena.contexts[0].receiver = 1;
    }
  };
  for (const kind of ["parameter", "capture", "receiver"]) {
    await factOpposite(`actual ${kind} producer slot is not an unqualified index`, (input, supplied) => formalInventory(kind, input, supplied),
      (input, supplied) => { if (kind === "receiver") supplied.types.signatures[0].receiver = null; else input.arena.producers[0].index = 1; },
      [violation("producer-resolves", arenaSite("producer", "producer", 0), "A producer retains its actual body parameter, receiver or captured-location slot.")]);
    await summaryOpposite(`actual ${kind} producer slot`, (input, supplied) => {
      formalInventory(kind, input, supplied);
      if (kind === "parameter") input.parameters = [{ slot: { kind: "parameter", index: 0 }, reads: completePaths(), writes: completePaths() }];
      if (kind === "receiver") input.parameters = [{ slot: { kind: "receiver" }, reads: completePaths(), writes: completePaths() }];
      if (kind === "capture") {
        input.captures = [{ index: 0, reads: completePaths(), writes: completePaths() }];
        supplied.context.captureCount = selected => (assert.equal(selected.definition, definitions.f, "actual checked captured-location inventory"), supplied.tir.captures.length);
      }
    }, input => { if (kind === "receiver") input.arena.producers[0] = { id: 0, path: null, kind: "parameter", index: 0 }; else input.arena.producers[0].index = 1; },
    [violation("summary-finite", summarySite(), "A summary producer retains its actual formal, receiver or captured-location slot.")]);
  }

  const targetInventory = (kind, input, supplied, isSummary) => {
    if (kind === "parameter") {
      supplied.types.signatures[0].parameters = [parameter()];
      supplied.tir.params = [{ local: 0, declaration: definitions.parameter, role: "required", passing: "by-value", initializer: null, storage: 0 }];
      if (isSummary) input.parameters = [{ slot: { kind: "parameter", index: 0 }, reads: completePaths(), writes: completePaths() }];
    }
    if (kind === "capture") {
      supplied.tir.captures = [{ body: otherBody, local: 0 }];
      if (isSummary) {
        input.captures = [{ index: 0, reads: completePaths(), writes: completePaths() }];
        supplied.context.captureCount = selected => (assert.equal(selected.definition, definitions.f, "actual retention captured-location inventory"), supplied.tir.captures.length);
      }
    }
    if (kind === "receiver") {
      supplied.types.signatures[0].receiver = 0;
      if (isSummary) input.parameters = [{ slot: { kind: "receiver" }, reads: completePaths(), writes: completePaths() }];
    }
  };
  const retentionTargets = [
    ["shared", { kind: "shared", definition: definitions.f, path: 0 }, target => { target.definition = definitions.missing; },
      "producer-resolves", "A shared target retains its actual declaration.", "cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."],
    ["parameter", { kind: "parameter", index: 0, path: 1 }, target => { target.index = 1; },
      "producer-resolves", "An escape retains its actual declaration parameter index.", "cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."],
    ["receiver", { kind: "receiver", path: 0 }, target => { target.path = 99; },
      "producer-resolves", "A projected fact retains its actual projection-path identity.", "cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."],
    ["capture", { kind: "capture", index: 0, path: 1 }, target => { target.index = 1; },
      "capture-locations-exact", "An escape retains its actual captured-location index.", "cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."],
    ["callback", { kind: "callback", at: { kind: "node", node: nodeRef(2) } }, target => { target.at.node.node = 99; },
      "node-resolves", "Every fact retains an actual source occurrence in its declared body domain.", "relational-site-resolves", "A retention target retains its actual source occurrence."],
    ["suspension", { kind: "suspension", at: { kind: "declared", identity: libraryIdentity, site: 0 } }, target => { target.at.site = 1; },
      "declared-site-ordinal", "An escape's declared site retains its actual library export and logical allocation ordinal.", "declared-site-ordinal", "A retention target retains its actual declared allocation ordinal."],
    ["external", { kind: "external", boundary: 0 }, target => { target.boundary = 99; },
      "boundary-resolves", "A boundary resolves in this exact arena.", "cross-owner-qualified", "A retention target retains its actual declaration, formal, capture, path or boundary owner."],
  ];
  for (const [kind, target, amend, factsRule, factsMessage, summaryRule, summaryMessage] of retentionTargets) {
    await factOpposite(`actual complete escape target ${kind}`, (input, supplied) => {
      targetInventory(kind, input, supplied, false);
      input.origins.escapes = [{ node: 1, producer: 0, target: clone(target) }];
    }, input => amend(input.origins.escapes[0].target), [violation(factsRule, nodeSite(1), factsMessage)]);
    await summaryOpposite(`actual complete retention target ${kind}`, (input, supplied) => {
      targetInventory(kind, input, supplied, true);
      input.retention = [{ source: 0, into: clone(target) }];
    }, input => amend(input.retention[0].into), [violation(summaryRule, summarySite(), summaryMessage)]);
  }
  for (const kind of ["return", "throw"]) {
    await factOpposite(`actual complete escape ${kind}`, input => { input.origins.escapes = [{ node: 1, producer: 0, target: { kind } }]; },
      input => { input.origins.escapes[0].producer = 99; }, [violation("producer-resolves", nodeSite(1), "A producer reference resolves in its exact declared arena.")]);
    await summaryOpposite(`actual complete retention ${kind}`, input => { input.retention = [{ source: 0, into: { kind } }]; },
      input => { input.retention[0].source = 99; }, [violation("retention-source-resolves", summarySite(), "Every retained source is a producer in this exact summary arena.")]);
  }

  const suspend = (kind, input, supplied) => {
    const terminator = { kind, destination: 0, resume: 0, unwind: { kind: "escape" }, origin: sourceOrigin(1), tir: nodeRef(1) };
    if (kind === "delegate") terminator.iterator = { kind: "place", place: 0 }; else terminator.operand = { kind: "place", place: 0 };
    if (kind !== "await") terminator.return = { destination: 0, target: 0 };
    supplied.mir.blocks[0].terminator = terminator;
    supplied.tir.asynchronous = kind === "await"; supplied.tir.generator = kind !== "await";
    input.suspension.suspensions = [{ node: 1, kind, values: [{ place: 0, origins: 1, retention: [{ source: 0, into: { kind: "return" } }],
      continuations: kind === "await" ? ["resume", "unwind"] : ["resume", "return", "unwind"] }] }];
  };
  for (const kind of ["await", "yield", "delegate"]) await factOpposite(`suspension-continuations-exact ${kind}`, (input, supplied) => suspend(kind, input, supplied),
    input => { input.suspension.suspensions[0].values[0].continuations = ["resume"]; }, [violation("suspension-continuations-exact", nodeSite(1),
      "Suspension continuations retain exact resume, generator-return and unwind obligations.")]);
  await factOpposite("suspensions-order", (input, supplied) => suspend("yield", input, supplied),
    input => { input.suspension.suspensions.push(clone(input.suspension.suspensions[0])); }, [violation("suspensions-order", nodeSite(1), orderMessage)]);
  await factOpposite("suspension-input-site actual terminator kind", (input, supplied) => suspend("yield", input, supplied),
    (input, supplied) => { supplied.mir.blocks[0].terminator = { kind: "return", value: null, origin: sourceOrigin(1), tir: nodeRef(1) }; },
    [violation("suspension-input-site", nodeSite(1), "A suspension retains its actual MIR await, yield or delegated-yield occurrence.")]);
  for (const kind of ["await", "yield", "delegate"]) for (const channel of ["sent", "return", "thrown"]) {
    if (kind === "await" && channel === "sent") continue;
    await suite.test(`actual ${kind} suspension input ${channel}`, () => {
      const input = bodyFacts(); const supplied = setup(); suspend(kind, input, supplied);
      input.arena.producers[0] = { id: 0, path: null, kind: "suspension-input", at: nodeRef(1), channel };
      supplied.canonicalArenas.set(arenaKey(owner()), clone(input.arena));
      equal(product.verifyFacts(input, supplied.mir, supplied.context), [], "complete actual supported suspension channel vector");
    });
  }
  await factOpposite("await has no generator sent input", (input, supplied) => {
    suspend("await", input, supplied); input.arena.producers[0] = { id: 0, path: null, kind: "suspension-input", at: nodeRef(1), channel: "return" };
  }, input => { input.arena.producers[0].channel = "sent"; }, [violation("suspension-input-site", arenaSite("producer", "producer", 0),
    "A suspension input retains the actual supported suspension channel and occurrence.")]);
  await factOpposite("suspension error invalidation retains its actual MIR suspension occurrence", (input, supplied) => {
    suspend("await", input, supplied);
    input.errorStorage.errors = [{ node: 2, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(1), owner: 1, kind: "invalidated", cause: "suspension" }] }];
  }, input => { input.errorStorage.errors[0].invalidations[0].at = nodeRef(2); },
    [violation("error-invalidation-outcome-exact", nodeSite(2), "A suspension invalidation retains an actual suspension occurrence.")]);
  await factOpposite("unknown error ownership cannot be claimed as preserved", input => {
    input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "preserved" }] }];
  }, input => { input.arena.origins[1] = { ...input.arena.origins[1], kind: "open", boundaries: [0] }; },
    [violation("error-invalidation-outcome-exact", nodeSite(1), "Unknown error-owner origins cannot be relabelled as a proven preserved owner.")]);
  for (const kind of ["incomplete-origins", "inexact-accessor-footprint", "open-constructor-domain", "opaque-invocation-footprint"]) {
    await factOpposite(`unproven error reason retains its complete ${kind} domain`, input => {
      input.arena.origins[1] = { ...input.arena.origins[1], kind: "open", boundaries: [0] };
      const reason = kind === "inexact-accessor-footprint" ? { kind } : kind === "open-constructor-domain" ? { kind, constructor: 1 } : { kind, affected: 1 };
      input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "unproven", reason, detail: "actual unresolved footprint" }] }];
    }, input => {
      const invalidation = input.errorStorage.errors[0].invalidations[0];
      if (kind === "inexact-accessor-footprint") invalidation.owner = 99;
      else if (kind === "open-constructor-domain") invalidation.reason.constructor = 99;
      else invalidation.reason.affected = 99;
    }, [violation("error-invalidation-origins-resolve", nodeSite(1), kind === "inexact-accessor-footprint"
      ? "An error invalidation retains its actual owner origins in this arena." : "An unproven error reason retains its actual affected or constructor origins.")]);
  }
  for (const kind of ["incomplete-origins", "open-constructor-domain"]) await factOpposite(`unproven ${kind} is not a complete domain`, input => {
    input.arena.origins[1] = { ...input.arena.origins[1], kind: "open", boundaries: [0] };
    input.errorStorage.errors = [{ node: 1, origins: 1, writes: [], retention: [], invalidations: [{ at: nodeRef(2), owner: 1, kind: "unproven",
      reason: kind === "incomplete-origins" ? { kind, affected: 1 } : { kind, constructor: 1 }, detail: "actual open domain" }] }];
  }, input => { const reason = input.errorStorage.errors[0].invalidations[0].reason;
    if (kind === "incomplete-origins") reason.affected = 0; else reason.constructor = 0; },
  [violation("error-invalidation-outcome-exact", nodeSite(1), "An incomplete-domain reason must retain an actually open origin domain.")]);
  await suite.test("actual callback activation retains its qualified formal entry and caller context", () => {
    const input = bodyFacts(); const supplied = setup(); invocationFixture(input, supplied);
    input.origins.activations = [{ node: 2, definition: definitions.callee, context: 0, caller: 0, entry: clone(input.origins.invocations[0].alternatives[0].arguments[0]) }];
    supplied.canonicalArenas.set(arenaKey(owner()), clone(input.arena));
    supplyScopes(supplied, { kind: "body", instance: input.instance }, supplied.scopeRows.body);
    equal(product.verifyFacts(input, supplied.mir, supplied.context), [], "complete actual callback activation vector");
  });

  const summaryCases = [
    ["definition-resolves", unchanged, (input, supplied) => { supplied.context.definitionExists = () => false; }, summarySite(), "A summary must name an existing declaration in the supplied inventory."],
    ["signature-resolves", unchanged, input => { input.signature = 99; }, summarySite(), "A summary must name an existing declaration-instantiated signature."],
    ["cross-owner-qualified", unchanged, (input, supplied) => { supplied.types.signatures[0].declaration = definitions.other; }, summarySite(), "The summary signature must retain its actual declaration owner."],
    ["captures-total", unchanged, input => { input.captures = [{ index: 0, reads: completePaths(), writes: completePaths() }]; }, summarySite(), "A summary retains every location in the actual declaration capture inventory."],
    ["captures-order", (input, supplied) => { input.captures = [{ index: 0, reads: completePaths(), writes: completePaths() }]; supplied.context.captureCount = () => 1; },
      input => { input.captures[0].index = 1; }, summarySite(), "Capture effects retain the actual dense captured-location order."],
    ["parameters-total", oneParameter, input => { input.parameters = []; }, summarySite(), "Summary effects contain the actual receiver and every declared parameter exactly once."],
    ["parameters-order", oneParameter, input => { input.parameters[0].slot.index = 1; }, summarySite(), "Parameter effects retain receiver-first and declaration parameter order."],
    ["result-origins-resolves", unchanged, input => { input.result = 99; }, summarySite(), "Result origins resolve in this exact summary arena."],
    ["thrown-origins-resolves", unchanged, input => { input.thrown = 99; }, summarySite(), "Thrown origins resolve in this exact summary arena."],
    ["write-origins-resolves", unchanged, input => { input.writes = [{ target: 0, value: 99 }]; }, summarySite(), "A summary write retains its actual producer and value origins in this arena."],
    ["retention-source-resolves", unchanged, input => { input.retention = [{ source: 99, into: { kind: "return" } }]; }, summarySite(), "Every retained source is a producer in this exact summary arena."],
    ["known-negative-distinct", oneParameter, input => { input.parameters[0].reads = { kind: "open", paths: [], boundaries: [99] }; }, summarySite(), "An unknown effect retains its real boundary rather than pretending to be no effect."],
    ["summary-binding-dependence", unchanged, input => { input.bindingDependent = true; }, summarySite(), "Summary dependence equals the supplied declaration's actual binding dependence."],
    ["writes-order", input => { input.writes = [{ target: 0, value: 0 }, { target: 0, value: 1 }]; }, input => { input.writes.reverse(); }, summarySite(), "Summary writes are distinct and ordered by target producer and value origins."],
    ["retention-order", input => { input.retention = [{ source: 0, into: { kind: "return" } }]; }, input => { input.retention.push(clone(input.retention[0])); }, summarySite(), "Retention entries are distinct and ordered by source and complete target identity."],
    ["callbacks-order", oneCallback, input => { input.callbacks.push(clone(input.callbacks[0])); }, summarySite(), "Callback entries retain distinct declaration parameter order."],
    ["callback-parameter-resolves", oneCallback, input => { input.callbacks[0].parameterIndex = 99; }, summarySite(), "A callback names an actual parameter of the summary signature."],
    ["callback-input-resolves", oneCallback, input => { input.callbacks[0].inputs = [{ kind: "argument-element", parameterIndex: 99, sourceParameterIndex: 0 }]; }, summarySite(), "Callback input channels retain their actual callback formal and receiver or source parameter."],
    ["invocation-only-parameters-order", oneParameter, input => { input.invocationOnlyParameters = [0, 0]; }, summarySite(), "Invocation-only parameters are distinct and ordered by declaration index."],
    ["invocation-only-parameter-resolves", oneParameter, input => { input.invocationOnlyParameters = [99]; }, summarySite(), "An invocation-only index names an actual declaration parameter."],
    ["relational-site-resolves", unchanged, input => { input.arena.producers[0].at.node.node = 99; }, nodeSite(99), "A relational site must retain an existing qualified source occurrence."],
    ["declared-site-ordinal", input => { input.arena.producers[0].at = { kind: "declared", identity: clone(libraryIdentity), site: 0 }; },
      input => { input.arena.producers[0].at.site = 1; }, { kind: "declared-site", owner: { kind: "summary", definition: definitions.f, bindings: parametric() }, identity: libraryIdentity, site: 1 },
      "A logical site ordinal must name an actual declared allocation site of that export."],
    ["summary-finite", unchanged, input => { input.arena.projections[1].parent = 1; }, { kind: "projection", owner: { kind: "summary", definition: definitions.f, bindings: parametric() }, projection: 1 },
      "A projection parent must reference an earlier row of the same arena."],
  ];
  for (const [rule, prepare, amend, site, message] of summaryCases) await summaryOpposite(rule, prepare, amend, [violation(rule, site, message)]);
  await summaryOpposite("missing capture inventory is not zero captures", unchanged, (input, supplied) => { supplied.context.captureCount = () => null; },
    [violation("captures-total", summarySite(), "A summary retains every location in the actual declaration capture inventory.")]);
  await summaryOpposite("missing dependence inventory is not parametric", unchanged, (input, supplied) => { supplied.context.bindingDependentOf = () => null; },
    [violation("summary-binding-dependence", summarySite(), "Summary dependence equals the supplied declaration's actual binding dependence.")]);
  for (const signatures of [null, [], [99], [-0]]) {
    await summaryOpposite(`actual callback signatures ${String(signatures)} are not invented from the parameter type`, oneCallback,
      (input, supplied) => { supplied.callbackSignatures.set(arenaKey([input.key, 0]), signatures); },
      [violation("callback-parameter-resolves", summarySite(), "A callback resolves the actual checked declaration-instantiated callable signatures of its parameter.")]);
  }
  await summaryOpposite("actual callback signature ID must equal its table position", oneCallback,
    (input, supplied) => { supplied.types.signatures[1].id = 2; },
    [violation("callback-parameter-resolves", summarySite(), "A callback resolves the actual checked declaration-instantiated callable signatures of its parameter.")]);
  for (const kind of ["optional", "union", "param"]) {
    await summaryOpposite(`actual ${kind} callback signature inventory supplies channel shape`, (input, supplied) => {
      oneCallback(input, supplied);
      if (kind === "optional") supplied.types.terms.push({ kind, value: 3 });
      if (kind === "union") supplied.types.terms.push({ kind, members: [1, 3] });
      if (kind === "param") {
        const identity = { owner: definitions.f, index: 0 };
        supplied.types.terms.push({ kind, parameter: identity });
        supplied.types.signatures[0].typeParameters = [{ identity, declaration: definitions.parameter, constraint: 3, default: null }];
      }
      supplied.types.signatures[0].parameters[0].type = 4;
      input.callbacks[0].inputs = [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 0 }];
    }, input => { input.callbacks[0].inputs[0].parameterIndex = 1; },
    [violation("callback-input-resolves", summarySite(), "Callback input channels retain their actual callback formal and receiver or source parameter.")]);
  }
  await summaryOpposite("every actual callback signature owns the channel", (input, supplied) => {
    oneCallback(input, supplied);
    supplied.types.signatures.push(signature(2, [parameter(definitions.parameter), parameter(definitions.capture)], null, definitions.other));
    supplied.callbackSignatures.set(arenaKey([input.key, 0]), [2, 1]);
    input.callbacks[0].inputs = [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 0 }];
  }, input => { input.callbacks[0].inputs[0].parameterIndex = 1; },
  [violation("callback-input-resolves", summarySite(), "Callback input channels retain their actual callback formal and receiver or source parameter.")]);
  await summaryOpposite("a genuine zero-formal callable is not a missing signature", (input, supplied) => {
    oneCallback(input, supplied); supplied.types.signatures[1].parameters = [];
  }, input => { input.callbacks[0].rejection = 0; },
  [violation("callback-input-resolves", summarySite(), "A callback rejection channel names an actual callback formal.")]);
  for (const kind of ["receiver-element", "receiver-rejection"]) {
    await summaryOpposite(`actual ${kind} channel requires its receiver slot`, (input, supplied) => {
      oneCallback(input, supplied); supplied.types.signatures[0].receiver = 0;
      input.parameters.unshift({ slot: { kind: "receiver" }, reads: completePaths(), writes: completePaths() });
      input.callbacks[0].inputs = [{ kind, parameterIndex: 0 }];
    }, (input, supplied) => { supplied.types.signatures[0].receiver = null; input.parameters.shift(); },
    [violation("callback-input-resolves", summarySite(), "Callback input channels retain their actual callback formal and receiver or source parameter.")]);
  }
  await summaryOpposite("callback argument source retains the actual summary formal", (input, supplied) => {
    oneCallback(input, supplied); input.callbacks[0].inputs = [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 0 }];
  }, input => { input.callbacks[0].inputs[0].sourceParameterIndex = 1; },
  [violation("callback-input-resolves", summarySite(), "Callback input channels retain their actual callback formal and receiver or source parameter.")]);
  for (const [field, limit] of [["maximumProjectionDepth", 2], ["maximumOriginAlternatives", 1],
    ["maximumRelationalRecordsPerBody", 8], ["maximumRelationalReferencesPerBody", 6]]) {
    await summaryOpposite(`published limit ${field}`, (input, supplied) => { supplied.context.limits[field] = limit; },
      (input, supplied) => { supplied.context.limits[field] = limit - 1; },
      [violation("summary-finite", summarySite(), "The published summary arena respects the actual producer's finite record, reference, path and alternative limits.")]);
  }
  for (const actualOwner of [null, definitions.other]) {
    await summaryOpposite(`actual summary body ownership ${actualOwner} is not reconstructed from the opaque ID`, unchanged,
      (input, supplied) => { supplied.bodyOwners.set(body, actualOwner); },
      [violation("cross-owner-qualified", nodeSite(1), "A relational occurrence must belong to the same actual body or summary owner."),
        violation("cross-owner-qualified", nodeSite(1), "A relational occurrence must belong to the same actual body or summary owner.")]);
  }
  for (const kind of ["callback", "suspension"]) {
    await summaryOpposite(`actual ${kind} retention owner is unresolved`, input => {
      input.retention = [{ source: 0, into: { kind, at: { kind: "node", node: nodeRef(1) } } }];
    }, input => { input.retention[0].into.at.node.body = otherBody; },
    [violation("cross-owner-qualified", summarySite(), "A retention target retains its actual summary declaration owner.")]);
  }
  for (const [field, prepare, amend] of [
    ["maximumProjectionDepth", input => { input.arena.projections = []; },
      input => { input.arena.projections = [{ id: 0, parent: null, projection: { kind: "deref" } }]; }],
    ["maximumOriginAlternatives", input => { input.arena.origins[1].producers = []; },
      input => { input.arena.origins[1].producers = [0]; }],
    ["maximumRelationalReferencesPerBody", input => { input.arena.projections = []; input.arena.boundProducers = []; input.arena.boundaries = [];
      for (const origins of input.arena.origins) origins.producers = []; },
    input => { input.arena.projections = [{ id: 0, parent: null, projection: { kind: "deref" } }, { id: 1, parent: 0, projection: { kind: "element" } }]; }],
  ]) {
    await summaryOpposite(`known zero published ${field} is not unknown`, (input, supplied) => { prepare(input); supplied.context.limits[field] = 0;
      if (field === "maximumRelationalReferencesPerBody") supplied.scopeRows.summary = []; },
      amend, [violation("summary-finite", summarySite(), "The published summary arena respects the actual producer's finite record, reference, path and alternative limits.")]);
  }
  await summaryOpposite("bindings-complete", (input, supplied) => {
    Object.assign(input, emptySummary()); supplied.scopeRows.summary = [];
    supplied.context.bindingScopeOf = () => ({ ...emptyScope(), classParameters: [{ owner: definitions.f, index: 0 }] });
  }, input => { input.key.bindings = { kind: "instantiated", bindings: emptyBindings() }; }, [
    violation("cross-owner-qualified", { kind: "summary", summary: { definition: definitions.f, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "The actual relational owner must resolve to its canonical arena."), violation("bindings-complete",
    { kind: "summary", summary: { definition: definitions.f, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
    "The complete binding-scope occurrence inventory must resolve for this exact verification root."), violation("bindings-complete",
    { kind: "summary", summary: { definition: definitions.f, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
    "A binding vector retains every expected class, method, captured and self binding in canonical owner order.")]);

  const member = (primary = definitions.field) => ({ decision: { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: primary }],
    selectedDeclarations: [primary], primary, read: 0, write: 0, getter: null, setter: null, bindings: emptyBindings() }, getter: null, setter: null });
  const memoryField = (id = 0, primary = definitions.field) => ({ id, occurrence: itemRef(primary), owner: 3,
    selector: itemRef(primary), selection: itemRef(primary), member: member(primary), primary, selectedDeclarations: [primary],
    value: 0, layout: 0, byteOffset: 0n, byteAlignment: 8n });
  const withField = (input, supplied) => {
    supplied.scopeRows.metadata = [emptyScope()];
    supplied.types.terms.push({ kind: "declared", definition: definitions.layout, arguments: [], facet: "instance", extent: null });
    input.layouts.push({ ...clone(input.layouts[0]), id: 1, source: 3, byteSize: 16n, stride: 16n, fields: [0] });
    input.fields = [memoryField()]; input.root = 1;
  };
  const withArray = (input, supplied) => {
    supplied.types.terms[2].extent.length = 0n;
    input.layouts.push({ ...clone(input.layouts[0]), id: 1, source: 2, byteSize: 0n, stride: 0n, kind: "array", length: 0n, runtimeBase: "bigint", element: 0 });
    delete input.layouts[1].fields; input.root = 1;
  };
  for (const kind of ["not-local-element-access", "open-origin-domain", "nonlocal-or-projected-origin", "sparse-or-spread-literal", "callable-boundary",
    "alias-declaration-missing", "different-origin-domain", "binding-not-plain", "initialization-not-block-local", "unproven-capture",
    "assignment-result-exposed", "unproven-use", "no-local-allocation"]) await factOpposite(`saved closed-array reason ${kind} keeps its own endpoint`, input => {
    if (kind === "open-origin-domain") input.arena.origins[1] = { ...input.arena.origins[1], kind: "open", boundaries: [0] };
    input.closedArrays = [{ node: 1, kind: "unproven", reason: kind === "open-origin-domain" ? { kind, origins: 1 } : { kind, at: nodeRef(2) } }];
  }, input => { const reason = input.closedArrays[0].reason;
    if (kind === "open-origin-domain") reason.origins = 99; else reason.at.node = 99; },
  [violation(kind === "open-origin-domain" ? "origins-resolves" : "node-resolves", nodeSite(1), kind === "open-origin-domain"
    ? "Origins resolve in this exact relational arena." : "Every fact retains an actual source occurrence in its declared body domain.")]);
  for (const field of ["references", "literals"]) await factOpposite(`closed-array ${field} retain qualified actual occurrences`, (input, supplied) => {
    input.closedArrays = [{ node: 1, kind: "closed", declarations: [definitions.field], references: [nodeRef(2)], literals: [nodeRef(3)], elements: [member()] }];
    supplied.scopeRows.body.push(emptyScope());
  }, input => { input.closedArrays[0][field][0].body = otherBody; },
    [violation("cross-owner-qualified", nodeSite(1), "A local fact cannot borrow the same numeric node index from another body.")]);
  const metadataSite = () => ({ kind: "metadata", metadata: { definition: definitions.layout, bindings: parametric() } });
  const metadataOpposite = async (name, prepare, amend, expected) => suite.test(`metadata ${name}`, () => {
    const input = metadata(); const supplied = setup();
    prepare(input, supplied); supplied.metadataRows.set(definitions.layout, clone(input));
    supplyScopes(supplied, { kind: "metadata", metadata: input.key }, supplied.scopeRows.metadata);
    equal(product.verifyMetadata(input, supplied.context), [], `metadata ${name}: complete valid value`);
    const invalid = clone(input); amend(invalid, supplied);
    equal(product.verifyMetadata(invalid, supplied.context), expected, `metadata ${name}: complete opposite vector`);
  });
  const bindingMessage = "A binding vector retains every expected class, method, captured and self binding in canonical owner order.";
  const inventoryMessage = "The complete binding-scope occurrence inventory must resolve for this exact verification root.";
  const missingScopeMessage = "Every inline binding-vector occurrence retains its actual canonical scope in declared field order.";
  const extraScopeMessage = "The canonical binding-scope inventory has no extra inline vector occurrence.";
  const scopedMember = (definition = definitions.other) => {
    const identity = { owner: definition, index: 0 };
    const scope = { ...emptyScope(), classParameters: [identity] };
    const selected = member(); selected.decision.primary = null; selected.decision.selectedDeclarations = [];
    selected.decision.origins = [{ kind: "mapped", owner: itemRef(definition), key: { kind: "text", value: "value" } }];
    selected.decision.bindings.classBindings = [{ kind: "rigid", parameter: identity }];
    return { scope, selected };
  };
  for (const kind of ["field", "method-value"]) {
    await factOpposite(`canonical ${kind} member scope is not its enclosing body`, (input, supplied) => {
      const { scope, selected } = scopedMember();
      input.arena.projections.push({ id: 2, parent: null, projection: { kind, member: selected } });
      supplied.scopeRows.body = [scope, emptyScope(), emptyScope()];
    }, input => { input.arena.projections[2].projection.member.decision.bindings.classBindings = []; },
    [violation("bindings-complete", arenaSite("projection", "projection", 2), bindingMessage)]);
    await summaryOpposite(`canonical ${kind} member scope is not its enclosing summary`, (input, supplied) => {
      const { scope, selected } = scopedMember();
      input.arena.projections.push({ id: 2, parent: null, projection: { kind, member: selected } });
      supplied.scopeRows.summary = [scope, emptyScope(), emptyScope()];
    }, input => { input.arena.projections[2].projection.member.decision.bindings.classBindings = []; },
    [violation("bindings-complete", { kind: "projection", owner: summaryOwner(summary().key), projection: 2 }, bindingMessage)]);
  }
  await factOpposite("canonical closed-array member scope is not its enclosing body", (input, supplied) => {
    const { scope, selected } = scopedMember();
    input.closedArrays = [{ node: 1, kind: "closed", declarations: [], references: [], literals: [], elements: [selected] }];
    supplied.scopeRows.body.push(scope);
  }, input => { input.closedArrays[0].elements[0].decision.bindings.classBindings = []; },
  [violation("bindings-complete", nodeSite(1), bindingMessage)]);
  await metadataOpposite("canonical physical member scope is not its enclosing layout", (input, supplied) => {
    withField(input, supplied); const { scope, selected } = scopedMember();
    input.fields[0].primary = null; input.fields[0].selectedDeclarations = []; input.fields[0].member = selected;
    supplied.scopeRows.metadata = [scope];
  }, input => { input.fields[0].member.decision.bindings.classBindings = []; }, [
    violation("member-correspondence-exact", metadataSite(), "A field retains its complete selected member group, primary and value correspondence."),
    violation("bindings-complete", metadataSite(), bindingMessage),
  ]);
  await factOpposite("a genuine member declaration remains an additional scope authority", (input, supplied) => {
    const { scope, selected } = scopedMember(); selected.decision.primary = definitions.field; selected.decision.selectedDeclarations = [definitions.field];
    input.arena.projections.push({ id: 2, parent: null, projection: { kind: "field", member: selected } });
    supplied.scopeRows.body = [scope, emptyScope(), emptyScope()];
    supplied.context.bindingScopeOf = selected => selected === definitions.field ? scope : emptyScope();
  }, (input, supplied) => { supplied.context.bindingScopeOf = () => emptyScope(); },
  [violation("bindings-complete", arenaSite("projection", "projection", 2), bindingMessage)]);
  await factOpposite("shared member vectors count once per occurrence, not once per object", (input, supplied) => {
    const { scope, selected } = scopedMember();
    input.closedArrays = [{ node: 1, kind: "closed", declarations: [], references: [], literals: [], elements: [selected, selected] }];
    supplied.scopeRows.body.push(scope, scope);
  }, (input, supplied) => { supplyScopes(supplied, { kind: "body", instance: input.instance }, supplied.scopeRows.body.slice(0, -1)); },
  [violation("bindings-complete", nodeSite(1), missingScopeMessage)]);
  await factOpposite("distinct member scope occurrences retain their declared order", (input, supplied) => {
    const first = scopedMember(); const second = scopedMember(definitions.callee);
    input.closedArrays = [{ node: 1, kind: "closed", declarations: [], references: [], literals: [], elements: [first.selected, second.selected] }];
    supplied.scopeRows.body.push(first.scope, second.scope);
  }, (input, supplied) => { supplyScopes(supplied, { kind: "body", instance: input.instance },
    [emptyScope(), emptyScope(), supplied.scopeRows.body[3], supplied.scopeRows.body[2]]); },
  [violation("bindings-complete", nodeSite(1), bindingMessage), violation("bindings-complete", nodeSite(1), bindingMessage)]);
  for (const kind of ["null", "empty", "missing", "extra", "wrong-root"]) {
    const change = (supplied, target, scopes) => {
      if (kind === "wrong-root") supplied.scopeInventories.delete(arenaKey(target));
      else supplyScopes(supplied, target, kind === "null" ? null : kind === "empty" ? []
        : kind === "missing" ? scopes.slice(0, -1) : [...scopes, emptyScope()]);
    };
    await factOpposite(`body ${kind} scope inventory is not a guessed empty environment`, unchanged,
      (input, supplied) => change(supplied, { kind: "body", instance: input.instance }, supplied.scopeRows.body),
      kind === "empty" ? [violation("bindings-complete", arenaSite("bound-producer", "producer", 0), missingScopeMessage),
        violation("bindings-complete", arenaSite("boundary", "boundary", 0), missingScopeMessage)]
        : [violation("bindings-complete", kind === "missing" ? arenaSite("boundary", "boundary", 0) : bodySite(),
          kind === "extra" ? extraScopeMessage : kind === "missing" ? missingScopeMessage : inventoryMessage)]);
    await summaryOpposite(`summary ${kind} scope inventory is target-qualified`, unchanged,
      (input, supplied) => change(supplied, { kind: "summary", summary: input.key }, supplied.scopeRows.summary),
      kind === "empty" ? [violation("bindings-complete", { kind: "bound-producer", owner: summaryOwner(summary().key), producer: 0 }, missingScopeMessage),
        violation("bindings-complete", { kind: "boundary", owner: summaryOwner(summary().key), boundary: 0 }, missingScopeMessage)]
        : [violation("bindings-complete", kind === "missing" ? { kind: "boundary", owner: summaryOwner(summary().key), boundary: 0 } : summarySite(),
          kind === "extra" ? extraScopeMessage : kind === "missing" ? missingScopeMessage : inventoryMessage)]);
    await metadataOpposite(`metadata ${kind} scope inventory is target-qualified`, withField,
      (input, supplied) => change(supplied, { kind: "metadata", metadata: input.key }, supplied.scopeRows.metadata),
      [violation("bindings-complete", metadataSite(), kind === "extra" ? extraScopeMessage
        : kind === "empty" || kind === "missing" ? missingScopeMessage : inventoryMessage)]);
  }
  await factOpposite("a genuinely instantiated root retains its own first scope occurrence", (input, supplied) => {
    const identity = { owner: definitions.f, index: 0 };
    const scope = { ...emptyScope(), methodParameters: [identity] };
    const vector = { ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: identity, type: 0 }] };
    input.instance.bindings = { kind: "instantiated", bindings: clone(vector) };
    input.arena.boundProducers[0].bindings = clone(vector); input.arena.boundaries[0].bindings = clone(vector);
    supplied.tir.bindings = clone(input.instance.bindings); supplied.mir.bindings = clone(input.instance.bindings);
    supplied.tir.lexicalBindings = clone(vector); supplied.tir.dependence = "binding-dependent";
    supplied.types.signatures[0].typeParameters = [{ identity, declaration: definitions.parameter, constraint: null, default: null }];
    supplied.context.bindingScopeOf = selected => selected === definitions.f ? scope : emptyScope();
    supplied.scopeRows.body = [scope, scope, scope];
  }, (input, supplied) => { supplyScopes(supplied, { kind: "body", instance: input.instance },
    [emptyScope(), supplied.scopeRows.body[1], supplied.scopeRows.body[2]]); },
  [violation("bindings-complete", { kind: "body", instance: { body, bindings: { kind: "instantiated", bindings: {
    ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: { owner: definitions.f, index: 0 }, type: 0 }],
  } } } }, bindingMessage)]);
  const nestedMetadataReferences = (input, supplied) => {
    const record = metadata(); withField(record, supplied); record.key.bindings = { kind: "instantiated", bindings: emptyBindings() };
    supplied.metadataRows.set(definitions.layout, record);
    const layout = { metadata: record.key, layout: 1 }; const field = { metadata: record.key, field: 0 };
    input.observations = [{ node: 1, operation: "size", operand: nodeRef(1), layout, field: null, result: 0, value: 16n, context: 0, bindings: emptyBindings() }];
    input.rawLocations = [{ node: 2, operation: "to-raw", pointee: 0, layout: { metadata: record.key, layout: 0 }, context: 0, bindings: emptyBindings() }];
    input.fieldBindings = [{ node: 3, result: 0, owner: 3, fieldExpression: nodeRef(1), field, pointer: nodeRef(2), pointee: 0, context: 0, bindings: emptyBindings() }];
    input.recordBindings = [{ node: 4, result: 0, layoutExpression: nodeRef(1), layout, context: 0, bindings: emptyBindings(), fields: [{ expression: nodeRef(2), binding: 3 }] }];
    supplied.scopeRows.body = Array.from({ length: 10 }, () => emptyScope());
  };
  await factOpposite("every inline reference artifact counts without traversing its foreign metadata record", nestedMetadataReferences,
    (input, supplied) => { supplyScopes(supplied, { kind: "body", instance: input.instance }, [...supplied.scopeRows.body, emptyScope()]); },
    [violation("bindings-complete", bodySite(), extraScopeMessage)]);
  await factOpposite("a nested reference artifact keeps its own declared position", nestedMetadataReferences,
    (input, supplied) => { const scopes = clone(supplied.scopeRows.body); scopes[2] = scopedMember().scope;
      supplyScopes(supplied, { kind: "body", instance: input.instance }, scopes); },
    [violation("bindings-complete", nodeSite(1), bindingMessage)]);
  await factOpposite("callback activation and construction artifacts retain every nested occurrence", (input, supplied) => {
    actualDependentActivation(input, supplied);
    const alternative = input.origins.invocations[0].alternatives[0]; const argument = alternative.arguments[0];
    input.origins.callbacks = [{ node: 2, argument: clone(argument), timing: "synchronous", rejection: null, inputs: [] }];
    input.origins.activations = [{ node: 3, definition: definitions.callee, context: 0, caller: 0, entry: clone(argument) }];
    input.origins.constructions = [{ node: 4, root: nodeRef(4), allocation: nodeRef(3), implementation: definitions.callee,
      body: clone(alternative.resolution.activation), regions: [] }];
    const scope = supplied.scopeRows.body[3]; supplied.scopeRows.body.push(scope, scope, scope);
  }, (input, supplied) => { supplyScopes(supplied, { kind: "body", instance: input.instance }, supplied.scopeRows.body.slice(0, -1)); },
  [violation("bindings-complete", nodeSite(4), missingScopeMessage)]);
  await metadataOpposite("the selected field root has its own complete scope inventory", (input, supplied) => {
    withField(input, supplied); input.kind = "memory-field"; input.root = 0;
  }, input => { input.root = 99; },
  [violation("root-resolves", metadataSite(), "The metadata root must resolve in its own selected layout or field arena.")]);
  const metadataCases = [
    ["definition-resolves", unchanged, (input, supplied) => { supplied.context.definitionExists = selected => selected !== definitions.layout; }, "The metadata declaration must exist in the supplied definition inventory."],
    ["cross-owner-qualified", unchanged, (input, supplied) => { supplied.metadataRows.get(definitions.layout).kind = "memory-field"; }, "The metadata kind must belong to the same declaration and complete binding environment."],
    ["type-resolves", unchanged, (input, supplied) => { supplied.types.terms = []; }, "A layout source type must exist in the supplied canonical type table."],
    ["occurrence-resolves", unchanged, (input, supplied) => { supplied.context.nodeExists = () => false; }, "Every layout occurrence must retain its original qualified source identity."],
    ["layout-id-dense", input => { input.layouts.push({ ...clone(input.layouts[0]), id: 1 }); }, input => { input.layouts[1].id = 9; }, "Layout IDs must equal their dense arena positions."],
    ["field-id-dense", (input, supplied) => { withField(input, supplied); input.layouts[1].fields = []; }, input => { input.fields[0].id = 9; }, "Memory-field IDs must equal their dense arena positions."],
    ["root-resolves", unchanged, input => { input.root = 99; }, "The metadata root must resolve in its own selected layout or field arena."],
    ["layout-element-precedes", withArray, input => { input.layouts[1].element = 99; }, "An array element must reference an existing earlier layout."],
    ["layout-fields-resolve", withField, input => { input.layouts[1].fields = [99]; }, "A value layout must retain each selected physical field exactly once."],
    ["layout-size-exact", unchanged, input => { input.layouts[0].byteSize = 7n; }, "Layout size must equal its finalized authored value."],
    ["layout-alignment-valid", unchanged, input => { input.layouts[0].byteAlignment = 4n; }, "Layout alignment must equal its finalized authored value."],
    ["layout-stride-exact", unchanged, input => { input.layouts[0].stride = 16n; }, "Layout stride must equal its finalized authored value."],
    ["field-offset-exact", withField, input => { input.fields[0].byteOffset = 8n; }, "A field offset must equal its finalized authored value."],
    ["field-alignment-valid", withField, input => { input.fields[0].byteAlignment = 4n; }, "A field alignment must equal its finalized authored value."],
    ["selected-declarations-order", (input, supplied) => { withField(input, supplied); input.fields[0].selectedDeclarations.push(definitions.other);
      input.fields[0].member.decision.selectedDeclarations.push(definitions.other); }, input => { input.fields[0].selectedDeclarations.reverse(); input.fields[0].member.decision.selectedDeclarations.reverse(); },
      "Selected field declarations must be distinct and ordered by identity."],
    ["member-correspondence-exact", withField, input => { input.fields[0].primary = definitions.other; }, "A field retains its complete selected member group, primary and value correspondence."],
    ["data-layout-reference-resolves", unchanged, (input, supplied) => { supplied.metadataRows.set(definitions.abi64, null); }, "Every layout must name an actual finalized data-layout declaration."],
    ["array-extent-exact", withArray, input => { input.layouts[1].runtimeBase = "number"; }, "An array retains its exact fixed extent, runtime base and selected element type."],
    ["layout-geometry-consistent", (input, supplied) => { withField(input, supplied); input.fields.push(memoryField(1, definitions.other)); supplied.scopeRows.metadata.push(emptyScope()); },
      input => { input.layouts[1].fields.push(1); }, "Distinct nonempty physical fields must not overlap."],
  ];
  for (const [rule, prepare, amend, message] of metadataCases) await metadataOpposite(rule, prepare, amend,
    [...(rule === "layout-fields-resolve" || rule === "layout-geometry-consistent" ? [violation("layout-fields-resolve", metadataSite(), "A value layout retains its complete finalized physical field vector in authored order.")] : []),
      violation(rule, metadataSite(), message), ...(rule === "selected-declarations-order"
        ? [violation("member-correspondence-exact", metadataSite(), "A field retains its complete selected member group, primary and value correspondence.")] : [])]);
  const mappedField = (input, supplied) => {
    withField(input, supplied);
    const field = input.fields[0]; field.primary = null; field.selectedDeclarations = [];
    field.member.decision.primary = null; field.member.decision.selectedDeclarations = [];
    field.member.decision.origins = [{ kind: "mapped", owner: itemRef(definitions.layout), key: { kind: "text", value: "value" } }];
  };
  await metadataOpposite("a genuine mapped field retains its known empty declaration group", mappedField,
    input => { input.fields[0].member.decision.read = 1; },
    [violation("member-correspondence-exact", metadataSite(), "A field retains its complete selected member group, primary and value correspondence.")]);
  await metadataOpposite("self-consistent field data cannot replace the finalized captured selection", withField,
    input => { input.fields[0].member.decision.origins = [{ kind: "class-prototype", owner: definitions.other }]; },
    [violation("member-correspondence-exact", metadataSite(), "A field retains its complete selected member group, primary and value correspondence.")]);
  await metadataOpposite("finalized physical fields cannot disappear", withField, input => { input.layouts[1].fields = []; },
    [violation("layout-fields-resolve", metadataSite(), "A value layout retains its complete finalized physical field vector in authored order.")]);
  await metadataOpposite("finalized array cannot be relabelled as an opaque value", withArray, input => {
    const current = input.layouts[1];
    input.layouts[1] = { id: current.id, occurrence: current.occurrence, source: current.source, dataLayout: current.dataLayout,
      byteSize: current.byteSize, byteAlignment: current.byteAlignment, stride: current.stride, kind: "value", fields: [] };
  }, [violation("layout-geometry-consistent", metadataSite(), "A layout retains its actual finalized value or array shape.")]);
  for (const width of [32, 64]) await metadataOpposite(`selected ${width}-bit address domain exactly at and one beyond`, input => {
    input.layouts[0].dataLayout = definitions[`abi${width}`];
    input.layouts[0].byteSize = (1n << BigInt(width)) - 1n;
    input.layouts[0].byteAlignment = 1n; input.layouts[0].stride = input.layouts[0].byteSize;
  }, input => { input.layouts[0].byteSize += 1n; input.layouts[0].stride += 1n; }, [
    violation("layout-size-exact", metadataSite(), "The exact layout size must fit the selected ABI address domain."),
    violation("layout-stride-exact", metadataSite(), "The exact stride must contain the value, preserve alignment and fit the selected ABI."),
    violation("layout-size-exact", metadataSite(), "Layout size must equal its finalized authored value."),
    violation("layout-stride-exact", metadataSite(), "Layout stride must equal its finalized authored value."),
  ]);
  await metadataOpposite("alignment cannot be zero", unchanged, input => { input.layouts[0].byteAlignment = 0n; }, [
    violation("layout-alignment-valid", metadataSite(), "Layout alignment must be an exact positive power of two in the selected ABI."),
    violation("layout-alignment-valid", metadataSite(), "Layout alignment must equal its finalized authored value."),
  ]);
  await metadataOpposite("stride must contain the value", unchanged, input => { input.layouts[0].stride = 0n; }, [
    violation("layout-stride-exact", metadataSite(), "The exact stride must contain the value, preserve alignment and fit the selected ABI."),
    violation("layout-stride-exact", metadataSite(), "Layout stride must equal its finalized authored value."),
  ]);
  await metadataOpposite("negative array length is not an empty exact extent", withArray,
    input => { input.layouts[1].length = -1n; },
    [violation("array-extent-exact", metadataSite(), "An array retains its exact fixed extent, runtime base and selected element type.")]);
  await metadataOpposite("nonempty array geometry cannot borrow a zero-length layout", withArray,
    input => { input.layouts[1].length = 1n; }, [
      violation("array-extent-exact", metadataSite(), "An array retains its exact fixed extent, runtime base and selected element type."),
      violation("layout-geometry-consistent", metadataSite(), "Array size and alignment must contain every selected element at its exact stride."),
    ]);
  await metadataOpposite("an array retains its element ABI identity", withArray,
    input => { input.layouts[1].dataLayout = definitions.abi32; }, [
      violation("cross-owner-qualified", metadataSite(), "A layout cannot borrow another source type or ABI identity."),
      violation("data-layout-reference-resolves", metadataSite(), "An array and its selected element must retain the same ABI declaration."),
    ]);
  await metadataOpposite("a field retains its child ABI identity", withField,
    input => { input.layouts[0].dataLayout = definitions.abi32; }, [
      violation("cross-owner-qualified", metadataSite(), "A layout cannot borrow another source type or ABI identity."),
      violation("data-layout-reference-resolves", metadataSite(), "A physical field cannot select a child from a different ABI declaration."),
    ]);
  await metadataOpposite("negative field offset remains an exact signed bigint defect", withField, input => { input.fields[0].byteOffset = -8n; }, [
    violation("layout-geometry-consistent", metadataSite(), "A field extent and selected alignment must fit the containing layout."),
    violation("field-offset-exact", metadataSite(), "A field offset must be an exact nonnegative integer."),
    violation("field-offset-exact", metadataSite(), "A field offset must equal its finalized authored value."),
  ]);
  await metadataOpposite("bindings-complete", (input, supplied) => {
    supplied.context.bindingScopeOf = () => ({ ...emptyScope(), classParameters: [{ owner: definitions.layout, index: 0 }] });
  }, input => { input.key.bindings = { kind: "instantiated", bindings: emptyBindings() }; }, [
    violation("cross-owner-qualified", { kind: "metadata", metadata: { definition: definitions.layout, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "The metadata kind must belong to the same declaration and complete binding environment."),
    violation("bindings-complete", { kind: "metadata", metadata: { definition: definitions.layout, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "The complete binding-scope occurrence inventory must resolve for this exact verification root."),
    violation("bindings-complete", { kind: "metadata", metadata: { definition: definitions.layout, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "A binding vector retains every expected class, method, captured and self binding in canonical owner order."),
  ]);

  const factTransport = async (name, path, needle, row, authored) => {
    const input = emptyFacts(); put(input, path, [row]);
    await textCase(name, input, emptyFactsText.replace(needle, `${needle.slice(0, -2)}${arrayText([authored])}`), product.printFacts, product.parseFacts);
  };
  await factTransport("live segment transport", ["liveness", "locals"], "locals=[]", { local: 0, segments: [{ block: 0, first: 0, last: 1 }] },
    `LocalLiveRange(local=l:0, segments=${arrayText(["LiveSegment(block=b:0, first=0, last=1)"])})`);
  for (const scope of ["body", "shared"]) await factTransport(`binding storage ${scope}`, ["liveness", "bindings"], "bindings=[]", { local: 0, scope, captured: true },
    `BindingStorageFact(local=l:0, scope="${scope}", captured=true)`);
  await factTransport("qualified live capture transport", ["liveness", "captures"], "captures=[]", { local: { body: otherBody, local: 0 }, reads: true, writes: true },
    `CaptureFact(local=LocalRef(body=body:"${otherBody}", local=l:0), reads=true, writes=true)`);
  const refinementRows = [
    [{ node: 1, guards: [2], kind: "proven" }, `proven(node=n:1, guards=${arrayText(["n:2"])})`],
    [{ node: 1, guards: [], kind: "unproven", reason: { kind: "guard-not-proven", detail: "unknown" } }, 'unproven(node=n:1, guards=[], reason=guard-not-proven(detail="unknown"))'],
    [{ node: 1, guards: [2], kind: "unproven", reason: { kind: "invalidated", sites: [{ kind: "write", at: nodeRef(3) }, { kind: "call", at: nodeRef(4) }] } },
      `unproven(node=n:1, guards=${arrayText(["n:2"])}, reason=invalidated(sites=${arrayText([`write(at=${nodeText(3)})`, `call(at=${nodeText(4)})`])}))`],
  ];
  for (const [row, authored] of refinementRows) await factTransport(`refinement transport ${row.kind} ${row.reason?.kind ?? "complete"}`, ["refinements", "refinements"], "refinements=[]", row, authored);
  await factTransport("exact interval transport beyond the JS integer cap", ["refinements", "integers"], "integers=[]", { node: 1, range: { minimum: -9007199254740993n, maximum: 9007199254740993n }, nonnegative: false },
    "IntegerFact(node=n:1, range=IntegerRange(minimum=-9007199254740993n, maximum=9007199254740993n), nonnegative=false)");
  const loopRecord = { statement: 1, counterDeclaration: 3, start: 5, bound: 9, body: 12, direction: "ascending", comparison: "exclusive-upper-bound", step: 1 };
  const loopText = 'CountedLoopFact(statement=n:1, counterDeclaration=n:3, start=n:5, bound=n:9, body=n:12, direction="ascending", comparison="exclusive-upper-bound", step=1)';
  await factTransport("all five counted-loop endpoints transport", ["refinements", "countedLoops"], "countedLoops=[]", loopRecord, loopText);
  await suite.test("literal numeric unions reject other well-formed numbers at their own field", () => {
    const text = emptyFactsText.replace("countedLoops=[]", `countedLoops=${arrayText([loopText.replace("step=1", "step=0")])}`);
    const offset = text.indexOf("step=0") + 5; const before = text.slice(0, offset).split("\n");
    malformed(product.parseFacts, text, offset, ["1"], "0", "counted-loop step is literal one", before.length, before.at(-1).length + 1);
    const wrongWidth = abiText(64).replace("addressWidth=64", "addressWidth=NaN");
    malformed(product.parseMetadata, wrongWidth, wrongWidth.indexOf("NaN"), ["32", "64"], "NaN", "ABI width literal union");
  });
  await factTransport("point-place origins transport", ["origins", "points"], "points=[]", { point: { block: 0, statement: null }, place: 0, origins: 1 },
    "PointPlaceOrigins(point=MirPoint(block=b:0, statement=null), place=p:0, origins=origins:1)");
  await factTransport("read origins transport", ["origins", "reads"], "OriginFacts(points=[], reads=[]", { node: 1, place: 0, origins: 1 },
    "ReadOriginsFact(node=n:1, place=p:0, origins=origins:1)");
  for (const role of ["input", "value", "member", "return", "receiver"]) await factTransport(`subject origins ${role}`, ["origins", "subjects"], "subjects=[]", { node: 1, role, path: 0, origins: 1 },
    `SubjectOriginsFact(node=n:1, role="${role}", path=path:0, origins=origins:1)`);
  for (const operation of ["initialization", "mutation"]) for (const destination of ["binding", "member", "element", "pointer"]) {
    const row = { node: 1, operation, destination, targets: [0], owner: 0, values: [{ source: nodeRef(2), origins: 1, reason: { kind: "value-source-unproven", detail: "unknown" } },
      { source: null, origins: 0, reason: null }], boundaries: [0] };
    const authored = `WriteFact(node=n:1, operation="${operation}", destination="${destination}", targets=${arrayText(["bound:0"])}, owner=bound:0, values=${arrayText([
      `WrittenOrigins(source=${nodeText(2)}, origins=origins:1, reason=value-source-unproven(detail="unknown"))`, "WrittenOrigins(source=null, origins=origins:0, reason=null)",
    ])}, boundaries=${arrayText(["boundary:0"])})`;
    await factTransport(`complete write transport ${operation}/${destination}`, ["origins", "writes"], "writes=[]", row, authored);
  }
  const escapeRows = [
    [{ kind: "return" }, "return()"], [{ kind: "throw" }, "throw()"],
    [{ kind: "shared", definition: definitions.f, path: 0 }, `shared(definition=def:"${definitions.f}", path=path:0)`],
    [{ kind: "parameter", index: 0, path: 0 }, "parameter(index=0, path=path:0)"], [{ kind: "receiver", path: 0 }, "receiver(path=path:0)"],
    [{ kind: "capture", index: 0, path: null }, "capture(index=0, path=null)"],
    [{ kind: "callback", at: { kind: "node", node: nodeRef(2) } }, `callback(at=node(node=${nodeText(2)}))`],
    [{ kind: "suspension", at: { kind: "declared", identity: libraryIdentity, site: 0 } }, `suspension(at=declared(identity=${libraryText}, site=0))`],
    [{ kind: "external", boundary: 0 }, "external(boundary=boundary:0)"],
  ];
  for (const [target, authored] of escapeRows) await factTransport(`escape transport ${target.kind}`, ["origins", "escapes"], "escapes=[]", { node: 1, producer: 0, target },
    `EscapeFact(node=n:1, producer=producer:0, target=${authored})`);

  const endpointText = role => `HirCallableEndpoint(declaration=def:"${definitions.callee}", role="${role}", signature=sig:1, body=null)`;
  const argumentText = (index, parameter) => `ArgumentTransport(authoredIndex=${index}, parameter=def:"${parameter}", parameterIndex=${index}, repeated=false, passing="by-value", actual=origins:0, formal=ProducerRef(owner=summary(definition=def:"${definitions.callee}", bindings=parametric()), producer=producer:${index}), projection=null)`;
  const applicationText = `ApplicationDecision(candidate=0, advertised=${endpointText("advertised")}, api=${endpointText("api-signature")}, bindings=${bindingsText}, implementationBindings=${bindingsText}, parameters=${arrayText([
    'argument(parameter=0, argument=0, component=null, passing="by-value")', 'argument(parameter=1, argument=1, component=null, passing="by-value")',
  ])}, completion=CompletionEndpoint(signature=sig:1, completion=t:1, yielded=null, sent=null), result=t:1)`;
  const resolvedText = `ResolvedCallee(decision=${applicationText}, activation=null, captures=[])`;
  for (const passing of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
    const input = bodyFacts(); invocationFixture(input, setup());
    const row = input.origins.invocations[0];
    for (const argument of row.alternatives[0].arguments) argument.passing = passing;
    for (const mapping of row.alternatives[0].resolution.decision.parameters) mapping.passing = passing;
    const callee = resolvedText.replaceAll('passing="by-value"', `passing="${passing}"`);
    const argumentsText = [argumentText(0, definitions.parameter), argumentText(1, definitions.capture)].map(text => text.replace('passing="by-value"', `passing="${passing}"`));
    await factTransport(`all declared passing-mode wire values ${passing}`, ["origins", "invocations"], "invocations=[]", row,
      `call(node=n:1, alternatives=${arrayText([`InvocationAlternative(resolution=${callee}, context=context:0, arguments=${arrayText(argumentsText)}, result=origins:0, thrown=origins:0, summary=SummaryKey(definition=def:"${definitions.callee}", bindings=parametric()))`])}, boundaries=[])`);
  }
  for (const kind of ["default", "omitted"]) {
    const input = bodyFacts(); invocationFixture(input, setup());
    const row = input.origins.invocations[0]; const alternative = row.alternatives[0];
    alternative.arguments[1].authoredIndex = null;
    alternative.resolution.decision.parameters[1] = kind === "default" ? { kind, parameter: 1, initializer: body } : { kind, parameter: 1, type: 1 };
    const authoredMapping = kind === "default" ? `default(parameter=1, initializer=body:"${body}")` : "omitted(parameter=1, type=t:1)";
    const callee = resolvedText.replace('argument(parameter=1, argument=1, component=null, passing="by-value")', authoredMapping);
    await factTransport(`nullable authored index retains ${kind} disposition in the actual mapping only`, ["origins", "invocations"], "invocations=[]", row,
      `call(node=n:1, alternatives=${arrayText([`InvocationAlternative(resolution=${callee}, context=context:0, arguments=${arrayText([
        argumentText(0, definitions.parameter), argumentText(1, definitions.capture).replace("authoredIndex=1", "authoredIndex=null"),
      ])}, result=origins:0, thrown=origins:0, summary=SummaryKey(definition=def:"${definitions.callee}", bindings=parametric()))`])}, boundaries=[])`);
  }
  {
    const input = bodyFacts(); const supplied = setup(); restFixture("dynamic", input, supplied);
    const row = input.origins.invocations[0];
    const callee = resolvedText.replace(`parameters=${arrayText([
      'argument(parameter=0, argument=0, component=null, passing="by-value")', 'argument(parameter=1, argument=1, component=null, passing="by-value")',
    ])}`, `parameters=${arrayText([`rest(parameter=0, arguments=${arrayText(["0"])}, passing="by-value")`])}`);
    const authored = argumentText(0, definitions.parameter).replace("repeated=false", "repeated=true").replace("projection=null", "projection=path:2");
    await factTransport("symbolic repeated sequence remains one explicit transport", ["origins", "invocations"], "invocations=[]", row,
      `call(node=n:1, alternatives=${arrayText([`InvocationAlternative(resolution=${callee}, context=context:0, arguments=${arrayText([authored])}, result=origins:0, thrown=origins:0, summary=SummaryKey(definition=def:"${definitions.callee}", bindings=parametric()))`])}, boundaries=[])`);
  }
  await suite.test("superseded null API environment is rejected at its exact typed field", () => {
    const decision = `MemberSelection(decision=MemberDecision(key=text(value="value"), origins=${arrayText([`declared(declaration=def:"${definitions.field}")`])}, selectedDeclarations=${arrayText([`def:"${definitions.field}"`])}, primary=def:"${definitions.field}", read=t:0, write=t:0, getter=null, setter=null, bindings=${bindingsText}), getter=${resolvedText}, setter=null)`;
    const expected = emptyFactsText.replace("projections=[]", `projections=${arrayText([
      `ProjectionPath(id=path:0, parent=null, projection=field(member=${decision}))`,
    ])}`);
    const invalid = expected.replace(`implementationBindings=${bindingsText}`, "implementationBindings=null");
    const offset = invalid.indexOf("implementationBindings=null") + "implementationBindings=".length;
    const before = invalid.slice(0, offset).split("\n");
    malformed(product.parseFacts, invalid, offset, ["BindingVector"], "null", "null API environment", before.length, before.at(-1).length + 1);
  });
  for (const kind of ["call", "construct", "getter", "setter", "native-callback"]) {
    const input = bodyFacts(); const supplied = setup(); invocationFixture(input, supplied);
    const row = input.origins.invocations[0]; row.kind = kind;
    await factTransport(`invocation transport ${kind}`, ["origins", "invocations"], "invocations=[]", row,
      `${kind}(node=n:1, alternatives=${arrayText([`InvocationAlternative(resolution=${resolvedText}, context=context:0, arguments=${arrayText([
        argumentText(0, definitions.parameter), argumentText(1, definitions.capture),
      ])}, result=origins:0, thrown=origins:0, summary=SummaryKey(definition=def:"${definitions.callee}", bindings=parametric()))`])}, boundaries=[])`);
  }
  for (const [mapping, authored] of [[{ kind: "default", parameter: 0, initializer: body }, `default(parameter=0, initializer=body:"${body}")`],
    [{ kind: "omitted", parameter: 0, type: 1 }, "omitted(parameter=0, type=t:1)"],
    [{ kind: "rest", parameter: 0, arguments: [0, 1], passing: "move" }, `rest(parameter=0, arguments=${arrayText(["0", "1"])}, passing="move")`],
    [{ kind: "argument", parameter: 0, argument: 0, component: 1, passing: "borrow-shared" }, 'argument(parameter=0, argument=0, component=1, passing="borrow-shared")']]) {
    const input = bodyFacts(); invocationFixture(input, setup());
    const row = input.origins.invocations[0].alternatives[0].resolution;
    row.decision.parameters = [mapping]; row.decision.implementationBindings = fullBindings;
    row.decision.completion.yielded = 0; row.decision.completion.sent = 1;
    row.activation = { body, bindings: { kind: "instantiated", bindings: fullBindings } }; row.captures = [{ body: otherBody, local: 0 }];
    const selected = member(); selected.getter = row; selected.setter = clone(row);
    const decision = `MemberDecision(key=text(value="value"), origins=${arrayText([`declared(declaration=def:"${definitions.field}")`])}, selectedDeclarations=${arrayText([`def:"${definitions.field}"`])}, primary=def:"${definitions.field}", read=t:0, write=t:0, getter=null, setter=null, bindings=${bindingsText})`;
    const application = applicationText.replace(`implementationBindings=${bindingsText}`, `implementationBindings=${fullBindingsText}`)
      .replace(`parameters=${arrayText(['argument(parameter=0, argument=0, component=null, passing="by-value")', 'argument(parameter=1, argument=1, component=null, passing="by-value")'])}`, `parameters=${arrayText([authored])}`)
      .replace("yielded=null, sent=null", "yielded=t:0, sent=t:1");
    const resolved = `ResolvedCallee(decision=${application}, activation=BodyInstance(body=body:"${body}", bindings=instantiated(bindings=${fullBindingsText})), captures=${arrayText([`LocalRef(body=body:"${otherBody}", local=l:0)`])})`;
    await arenaTextCase(`selected accessor full transport mapping ${mapping.kind}`, "projections", [{ id: 0, parent: null, projection: { kind: "method-value", member: selected } }],
      [`ProjectionPath(id=path:0, parent=null, projection=method-value(member=MemberSelection(decision=${decision}, getter=${resolved}, setter=${resolved})))`]);
  }
  for (const timing of ["synchronous", "deferred", "unknown"]) {
    const input = bodyFacts(); invocationFixture(input, setup()); const argument = input.origins.invocations[0].alternatives[0].arguments[0];
    const inputs = [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 1 }, { kind: "receiver-element", parameterIndex: 1 }, { kind: "receiver-rejection", parameterIndex: 2 }];
    await factTransport(`callback channels transport ${timing}`, ["origins", "callbacks"], "callbacks=[]", { node: 1, argument, timing, rejection: 2, inputs },
      `CallbackEntry(node=n:1, argument=${argumentText(0, definitions.parameter)}, timing="${timing}", rejection=2, inputs=${arrayText([
        "argument-element(parameterIndex=0, sourceParameterIndex=1)", "receiver-element(parameterIndex=1)", "receiver-rejection(parameterIndex=2)",
      ])})`);
  }
  await factTransport("complete bound activation transport", ["origins", "activations"], "activations=[]", { node: 1, definition: definitions.f, context: 0, caller: 1, entry: null },
    `BoundActivation(node=n:1, definition=def:"${definitions.f}", context=context:0, caller=context:1, entry=null)`);
  {
    const input = bodyFacts(); invocationFixture(input, setup()); const entry = input.origins.invocations[0].alternatives[0].arguments[0];
    await factTransport("complete bound activation formal entry transport", ["origins", "activations"], "activations=[]", { node: 1, definition: definitions.f, context: 0, caller: null, entry },
      `BoundActivation(node=n:1, definition=def:"${definitions.f}", context=context:0, caller=null, entry=${argumentText(0, definitions.parameter)})`);
    for (const passing of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
      const argument = { ...entry, passing };
      await factTransport(`actual transport passing mode ${passing}`, ["origins", "callbacks"], "callbacks=[]", { node: 1, argument, timing: "unknown", rejection: null, inputs: [] },
        `CallbackEntry(node=n:1, argument=${argumentText(0, definitions.parameter).replace('passing="by-value"', `passing="${passing}"`)}, timing="unknown", rejection=null, inputs=[])`);
    }
  }
  for (const kind of ["origin", "boundary"]) await factTransport(`value frontier transport ${kind}`, ["origins", "frontiers"], "frontiers=[]", { node: 1, kind, subject: 0, context: 0 },
    `${kind}(node=n:1, subject=producer:0, context=context:0)`);
  const region = { owner: definitions.f, node: nodeRef(2), context: 0 };
  const regionText = `InstanceRegion(owner=def:"${definitions.f}", node=${nodeText(2)}, context=context:0)`;
  await factTransport("qualified instance region transport", ["origins", "instanceRegions"], "instanceRegions=[]", region, regionText);
  await factTransport("complete inherited constructor region transport", ["origins", "constructions"], "constructions=[]", { node: 1, root: nodeRef(1), allocation: nodeRef(2), implementation: definitions.f, body: instance(), regions: [region] },
    `ConstructionAlternative(node=n:1, root=${nodeText(1)}, allocation=${nodeText(2)}, implementation=def:"${definitions.f}", body=${instanceText}, regions=${arrayText([regionText])})`);
  for (const kind of ["await", "yield", "delegate"]) await factTransport(`suspension transport ${kind}`, ["suspension", "suspensions"], "suspensions=[]", { node: 1, kind, values: [{ place: 0, origins: 1, retention: [{ source: 0, into: { kind: "return" } }], continuations: ["resume", "return", "unwind"] }] },
    `${kind}(node=n:1, values=${arrayText([`SuspensionValue(place=p:0, origins=origins:1, retention=${arrayText(["RetentionFact(source=producer:0, into=return())"])}, continuations=${arrayText(['"resume"', '"return"', '"unwind"'])})`])})`);

  const errorRows = [
    [{ kind: "preserved", at: nodeRef(2), owner: 1 }, `preserved(at=${nodeText(2)}, owner=origins:1)`],
    [{ kind: "invalidated", at: nodeRef(2), owner: 1, cause: "suspension" }, `invalidated(at=${nodeText(2)}, owner=origins:1, cause="suspension")`],
    [{ kind: "invalidated", at: nodeRef(2), owner: 1, cause: "overlapping-write", affected: 0 }, `invalidated(at=${nodeText(2)}, owner=origins:1, cause="overlapping-write", affected=origins:0)`],
    ...[[{ kind: "incomplete-origins", affected: 0 }, "incomplete-origins(affected=origins:0)"],
      [{ kind: "inexact-accessor-footprint" }, "inexact-accessor-footprint()"], [{ kind: "open-constructor-domain", constructor: 0 }, "open-constructor-domain(constructor=origins:0)"],
      [{ kind: "opaque-invocation-footprint", affected: 0 }, "opaque-invocation-footprint(affected=origins:0)"]].map(([reason, text]) => [
      { kind: "unproven", at: nodeRef(2), owner: 1, reason, detail: "unknown" }, `unproven(at=${nodeText(2)}, owner=origins:1, reason=${text}, detail="unknown")`,
    ]),
  ];
  for (const [row, authored] of errorRows) await factTransport(`error invalidation transport ${row.kind}/${row.reason?.kind ?? row.cause ?? "preserved"}`,
    ["errorStorage", "errors"], "errors=[]", { node: 1, origins: 1, writes: [2], retention: [], invalidations: [row] },
    `ErrorStorageFact(node=n:1, origins=origins:1, writes=${arrayText(["n:2"])}, retention=[], invalidations=${arrayText([authored])})`);
  for (const [family, operation] of [["typed-location", "allocate"], ["typed-location", "address-of"], ["typed-location", "bind-pointer"], ["typed-location", "project-pointer"], ["raw-memory", "reinterpret"]]) {
    await factOpposite(`actual pointer backing ${family}/${operation} keeps its own qualified source`, input => {
      input.pointerBacking.pointers = [{ node: 1, returned: true, origins: 1,
        producers: [{ producer: 0, operation: { family, operation, at: nodeRef(2) } }] }];
    }, input => { input.pointerBacking.pointers[0].producers[0].operation.at.body = otherBody; },
    [violation("cross-owner-qualified", nodeSite(1), "A local fact cannot borrow the same numeric node index from another body.")]);
    await factTransport(`pointer backing transport ${family}/${operation}`, ["pointerBacking", "pointers"], "pointers=[]", { node: 1, returned: true, origins: 1, producers: [{ producer: 0, operation: { family, operation, at: nodeRef(2) } }] },
      `PointerBackingFact(node=n:1, returned=true, origins=origins:1, producers=${arrayText([`PointerBackingProducer(producer=bound:0, operation=PointerBackingOperation(family="${family}", operation="${operation}", at=${nodeText(2)}))`])})`);
  }
  const layoutReference = { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 };
  const fieldReference = { metadata: { definition: definitions.layout, bindings: parametric() }, field: 0 };
  const layoutReferenceText = `MetadataLayoutRef(metadata=${keyText("layout")}, layout=layout:0)`;
  const fieldReferenceText = `MetadataFieldRef(metadata=${keyText("layout")}, field=field:0)`;
  for (const operation of ["size", "alignment", "stride", "field-offset"]) await factTransport(`observation transport ${operation}`, ["observations"], "observations=[]",
    { node: 1, operation, operand: nodeRef(2), layout: layoutReference, field: operation === "field-offset" ? fieldReference : null, result: 0, value: 9007199254740993n, context: 0, bindings: emptyBindings() },
    `ObservationFact(node=n:1, operation="${operation}", operand=${nodeText(2)}, layout=${layoutReferenceText}, field=${operation === "field-offset" ? fieldReferenceText : "null"}, result=t:0, value=9007199254740993n, context=context:0, bindings=${bindingsText})`);
  for (const operation of ["to-raw", "reinterpret"]) await factTransport(`raw location transport ${operation}`, ["rawLocations"], "rawLocations=[]",
    { node: 1, operation, pointee: 0, layout: layoutReference, context: 0, bindings: emptyBindings() },
    `RawLocationFact(node=n:1, operation="${operation}", pointee=t:0, layout=${layoutReferenceText}, context=context:0, bindings=${bindingsText})`);
  const boundField = node => ({ node, result: 0, owner: 3, fieldExpression: nodeRef(2), field: fieldReference, pointer: nodeRef(3), pointee: 0, context: 0, bindings: emptyBindings() });
  await factTransport("field binding retains selector pointer and full metadata identity", ["fieldBindings"], "fieldBindings=[]", boundField(1),
    `MemoryFieldBindingFact(node=n:1, result=t:0, owner=t:3, fieldExpression=${nodeText(2)}, field=${fieldReferenceText}, pointer=${nodeText(3)}, pointee=t:0, context=context:0, bindings=${bindingsText})`);
  await factTransport("record binding retains each authored field expression", ["recordBindings"], "recordBindings=[]",
    { node: 1, result: 3, layoutExpression: nodeRef(2), layout: layoutReference, context: 0, bindings: emptyBindings(), fields: [{ expression: nodeRef(3), binding: 4 }] },
    `MemoryRecordBindingFact(node=n:1, result=t:3, layoutExpression=${nodeText(2)}, layout=${layoutReferenceText}, context=context:0, bindings=${bindingsText}, fields=${arrayText([`BoundRecordField(expression=${nodeText(3)}, binding=n:4)`])})`);
  for (const [row, text] of [[{ kind: "bound", node: 1, record: 2 }, "bound(node=n:1, record=n:2)"], [{ kind: "error", node: 1 }, "error(node=n:1)"]]) {
    await factTransport(`memory inventory transport ${row.kind}`, ["memoryBindings"], "memoryBindings=[]", row, text);
  }
  for (const kind of ["not-local-element-access", "open-origin-domain", "nonlocal-or-projected-origin", "sparse-or-spread-literal", "callable-boundary", "alias-declaration-missing", "different-origin-domain", "binding-not-plain", "initialization-not-block-local", "unproven-capture", "assignment-result-exposed", "unproven-use", "no-local-allocation"]) {
    const reason = kind === "open-origin-domain" ? { kind, origins: 1 } : { kind, at: nodeRef(2) };
    await factTransport(`closed-array refusal transport ${kind}`, ["closedArrays"], "closedArrays=[]", { node: 1, kind: "unproven", reason },
      `unproven(node=n:1, reason=${kind}(${kind === "open-origin-domain" ? "origins=origins:1" : `at=${nodeText(2)}`}))`);
  }
  await factOpposite("field-bindings-order", (input, supplied) => {
    const record = metadata(); withField(record, supplied); supplied.metadataRows.set(definitions.layout, record);
    input.fieldBindings = [boundField(1), boundField(2)];
    supplied.scopeRows.body.push(emptyScope(), emptyScope());
  }, input => { input.fieldBindings.reverse(); }, [violation("field-bindings-order", nodeSite(1), orderMessage)]);

  const selectionText = (key, origins, primary = `def:"${definitions.field}"`, getter = "null", setter = "null") =>
    `MemberSelection(decision=MemberDecision(key=${key}, origins=${arrayText(origins)}, selectedDeclarations=${arrayText([`def:"${definitions.field}"`])}, primary=${primary}, read=t:0, write=t:0, getter=${getter}, setter=${setter}, bindings=${bindingsText}), getter=null, setter=null)`;
  for (const [key, authored] of [[{ kind: "text", value: "value" }, 'text(value="value")'], [{ kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } }, "number(value=ExactRational(numerator=0n, denominator=1n, negativeZero=true))"],
    [{ kind: "symbol", declaration: definitions.field }, `symbol(declaration=def:"${definitions.field}")`]]) {
    const selected = member(); selected.decision.key = key;
    selected.decision.origins = [{ kind: "declared", declaration: definitions.field }, { kind: "class-prototype", owner: definitions.layout },
      { kind: "mapped", owner: { kind: "body", value: nodeRef(1) }, key: { kind: "text", value: "value" } }];
    const expected = selectionText(authored, [`declared(declaration=def:"${definitions.field}")`, `class-prototype(owner=def:"${definitions.layout}")`,
      `mapped(owner=body(value=${nodeText(1)}), key=text(value="value"))`]);
    await arenaTextCase(`full field member key transport ${key.kind}`, "projections", [{ id: 0, parent: null, projection: { kind: "field", member: selected } }],
      [`ProjectionPath(id=path:0, parent=null, projection=field(member=${expected}))`]);
    await factTransport(`closed array complete selected member ${key.kind}`, ["closedArrays"], "closedArrays=[]", { node: 1, kind: "closed", declarations: [definitions.field], references: [nodeRef(2)], literals: [nodeRef(3)], elements: [selected] },
      `closed(node=n:1, declarations=${arrayText([`def:"${definitions.field}"`])}, references=${arrayText([nodeText(2)])}, literals=${arrayText([nodeText(3)])}, elements=${arrayText([expected])})`);
  }
  {
    const selected = member();
    selected.decision.origins = [{ kind: "mapped", owner: itemRef(definitions.layout), key: { kind: "symbol", declaration: definitions.field } }];
    selected.decision.primary = null; selected.decision.read = null; selected.decision.write = null;
    const expected = selectionText('text(value="value")', [`mapped(owner=item(value=ItemNodeRef(owner=def:"${definitions.layout}", node=n:0)), key=symbol(declaration=def:"${definitions.field}"))`], "null")
      .replace("read=t:0, write=t:0", "read=null, write=null");
    await arenaTextCase("item-owned mapped member with genuine absent primary and read/write slots", "projections", [{ id: 0, parent: null, projection: { kind: "field", member: selected } }],
      [`ProjectionPath(id=path:0, parent=null, projection=field(member=${expected}))`]);
  }
  for (const accessor of ["getter", "setter"]) for (const role of ["advertised", "api-signature", "api-body"]) {
    const selected = member(); selected.decision[accessor] = { declaration: definitions.callee, role, signature: 1, body };
    const expected = selectionText('text(value="value")', [`declared(declaration=def:"${definitions.field}")`])
      .replace(`${accessor}=null`, `${accessor}=HirCallableEndpoint(declaration=def:"${definitions.callee}", role="${role}", signature=sig:1, body=body:"${body}")`);
    await arenaTextCase(`member ${accessor}/${role} endpoint retains its actual body identity`, "projections", [{ id: 0, parent: null, projection: { kind: "method-value", member: selected } }],
      [`ProjectionPath(id=path:0, parent=null, projection=method-value(member=${expected}))`]);
  }
  for (const timing of ["synchronous", "deferred"]) {
    const input = emptySummary(); input.parameters = [{ slot: { kind: "receiver" }, reads: { kind: "open", paths: [0], boundaries: [0] }, writes: completePaths() },
      { slot: { kind: "parameter", index: 0 }, reads: completePaths(), writes: { kind: "complete", paths: [1] } }];
    input.captures = [{ index: 0, reads: completePaths(), writes: { kind: "open", paths: [], boundaries: [0] } }];
    input.writes = [{ target: 0, value: 0 }]; input.retention = [{ source: 0, into: { kind: "return" } }];
    input.callbacks = [{ parameterIndex: 0, timing, rejection: 1, inputs: [{ kind: "argument-element", parameterIndex: 0, sourceParameterIndex: 1 }, { kind: "receiver-element", parameterIndex: 1 }, { kind: "receiver-rejection", parameterIndex: 2 }] }];
    input.invocationOnlyParameters = [0]; input.suspends = true; input.bindingDependent = true;
    const expected = emptySummaryText.replace("parameters=[]", `parameters=${arrayText([
      `ParameterEffect(slot=receiver(), reads=open(paths=${arrayText(["path:0"])}, boundaries=${arrayText(["boundary:0"])}), writes=complete(paths=[]))`,
      `ParameterEffect(slot=parameter(index=0), reads=complete(paths=[]), writes=complete(paths=${arrayText(["path:1"])}))`,
    ])}`).replace("captures=[]", `captures=${arrayText([`CaptureEffect(index=0, reads=complete(paths=[]), writes=open(paths=[], boundaries=${arrayText(["boundary:0"])}))`])}`)
      .replace("writes=[]", `writes=${arrayText(["SummaryWrite(target=producer:0, value=origins:0)"])}`)
      .replace("retention=[]", `retention=${arrayText(["RetentionFact(source=producer:0, into=return())"])}`)
      .replace("callbacks=[]", `callbacks=${arrayText([`SummaryCallback(parameterIndex=0, timing="${timing}", rejection=1, inputs=${arrayText([
        "argument-element(parameterIndex=0, sourceParameterIndex=1)", "receiver-element(parameterIndex=1)", "receiver-rejection(parameterIndex=2)",
      ])})`])}`).replace("invocationOnlyParameters=[]", `invocationOnlyParameters=${arrayText(["0"])}`).replace("suspends=false, bindingDependent=false", "suspends=true, bindingDependent=true");
    await textCase(`full summary effect and callback transport ${timing}`, input, expected, product.printSummary, product.parseSummary);
  }

  const metadataOccurrence = `item(value=ItemNodeRef(owner=def:"${definitions.layout}", node=n:0))`;
  const baseLayoutText = `value(id=layout:0, occurrence=${metadataOccurrence}, source=t:0, dataLayout=def:"${definitions.abi64}", byteSize=8n, byteAlignment=8n, stride=8n, fields=[])`;
  const physicalOccurrence = `item(value=ItemNodeRef(owner=def:"${definitions.field}", node=n:0))`;
  const physicalMemberText = selectionText('text(value="value")', [`declared(declaration=def:"${definitions.field}")`]);
  const physicalFieldText = `MemoryField(id=field:0, occurrence=${physicalOccurrence}, owner=t:3, selector=${physicalOccurrence}, selection=${physicalOccurrence}, member=${physicalMemberText}, primary=def:"${definitions.field}", selectedDeclarations=${arrayText([`def:"${definitions.field}"`])}, value=t:0, layout=layout:0, byteOffset=0n, byteAlignment=8n)`;
  for (const kind of ["memory-layout", "memory-field"]) {
    const input = metadata(); withField(input, setup()); input.kind = kind; if (kind === "memory-field") input.root = 0;
    const expected = `${kind}(key=${keyText("layout")}, root=${kind === "memory-layout" ? "layout:1" : "field:0"}, layouts=${arrayText([baseLayoutText,
      `value(id=layout:1, occurrence=${metadataOccurrence}, source=t:3, dataLayout=def:"${definitions.abi64}", byteSize=16n, byteAlignment=8n, stride=16n, fields=${arrayText(["field:0"])})`,
    ])}, fields=${arrayText([physicalFieldText])})\n`;
    await textCase(`complete physical metadata transport ${kind}`, input, expected, product.printMetadata, product.parseMetadata);
  }
  for (const width of [32, 64]) await suite.test(`actual selected ${width}-bit metadata and exact array extents`, () => {
    const input = metadata(); const supplied = setup();
    input.layouts[0].dataLayout = definitions[`abi${width}`];
    const length = width === 64 ? 9007199254740993n : 17n;
    const runtimeBase = width === 64 ? "bigint" : "number";
    supplied.types.terms[2].extent = { length, runtimeBase };
    input.layouts.push({ id: 1, occurrence: itemRef(definitions.layout), source: 2, dataLayout: definitions[`abi${width}`],
      byteSize: length * 8n, byteAlignment: 8n, stride: length * 8n, kind: "array", length, runtimeBase, element: 0 });
    input.root = 1; supplied.metadataRows.set(definitions.layout, clone(input));
    equal(product.verifyMetadata(input, supplied.context), [], "full exact authored extent and selected ABI vector");
    const expected = `memory-layout(key=${keyText("layout")}, root=layout:1, layouts=${arrayText([
      baseLayoutText.replace(`def:"${definitions.abi64}"`, `def:"${definitions[`abi${width}`]}"`),
      `array(id=layout:1, occurrence=${metadataOccurrence}, source=t:2, dataLayout=def:"${definitions[`abi${width}`]}", byteSize=${length * 8n}n, byteAlignment=8n, stride=${length * 8n}n, length=${length}n, runtimeBase="${runtimeBase}", element=layout:0)`,
    ])}, fields=[])\n`;
    equal(product.printMetadata(input), expected, "complete independently authored exact bigint array text");
    equal(product.parseMetadata(expected), { kind: "parsed", value: input }, "complete exact bigint array value");
  });
  await suite.test("packed physical alignment is distinct from the child type alignment", () => {
    const input = metadata(); const supplied = setup(); withField(input, supplied);
    input.layouts[1].byteSize = 24n; input.layouts[1].stride = 24n; input.layouts[1].byteAlignment = 1n;
    input.fields[0].byteOffset = 1n; input.fields[0].byteAlignment = 1n;
    const second = memoryField(1, definitions.capture); second.byteOffset = 9n; second.byteAlignment = 1n;
    input.fields.push(second); input.layouts[1].fields.push(1);
    supplied.metadataRows.set(definitions.layout, clone(input));
    supplyScopes(supplied, { kind: "metadata", metadata: input.key }, [emptyScope(), emptyScope()]);
    equal(product.verifyMetadata(input, supplied.context), [], "full packed layout retains 8-byte child alignment and independently authored 1-byte placement");
  });
  await suite.test("several zero-sized physical fields occupy no bytes and do not overlap", () => {
    const input = metadata(); const supplied = setup(); withField(input, supplied);
    supplied.types.terms.push({ kind: "declared", definition: definitions.other, arguments: [], facet: "instance", extent: null });
    supplied.context.nominalOf = definition => ({ kind: "declared", facets: definition === definitions.other ? ["instance"] : ["instance", "value"] });
    input.layouts[0].source = 4; input.layouts[0].byteSize = 0n; input.layouts[0].stride = 0n;
    input.layouts[1].byteSize = 0n; input.layouts[1].stride = 0n;
    input.fields[0].value = 4; input.fields[0].member.decision.read = 4; input.fields[0].member.decision.write = 4;
    const second = memoryField(1, definitions.capture); second.value = 4; second.member.decision.read = 4; second.member.decision.write = 4;
    input.fields.push(second); input.layouts[1].fields.push(1); supplied.metadataRows.set(definitions.layout, clone(input));
    supplyScopes(supplied, { kind: "metadata", metadata: input.key }, [emptyScope(), emptyScope()]);
    equal(product.verifyMetadata(input, supplied.context), [], "full zero-sized geometry vector");
  });
  for (const timing of ["synchronous", "deferred"]) await suite.test(`complete callback effects ${timing} use independent actual signature and capture inventories`, () => {
    const input = summary(); const supplied = setup(); oneCallback(input, supplied);
    supplied.types.signatures[0].receiver = 0;
    supplied.types.signatures[1].parameters = [parameter(definitions.parameter), parameter(definitions.capture), parameter(definitions.other)];
    input.parameters.unshift({ slot: { kind: "receiver" }, reads: { kind: "open", paths: [0], boundaries: [0] }, writes: completePaths() });
    input.captures = [{ index: 0, reads: completePaths(), writes: { kind: "complete", paths: [1] } }];
    supplied.tir.captures = [{ body: otherBody, local: 0 }]; supplied.context.captureCount = () => supplied.tir.captures.length;
    input.callbacks[0] = { parameterIndex: 0, timing, rejection: 2, inputs: [{ kind: "receiver-element", parameterIndex: 0 }, { kind: "receiver-rejection", parameterIndex: 1 },
      { kind: "argument-element", parameterIndex: 2, sourceParameterIndex: 0 }] };
    input.retention = [{ source: 0, into: { kind: "callback", at: { kind: "node", node: nodeRef(1) } } }];
    supplied.canonicalArenas.set(arenaKey(summaryOwner(input.key)), clone(input.arena));
    equal(product.verifySummary(input, supplied.context), [], "full known/open effects and actual callback channel vector");
  });

  const componentId = name => ids.encodeComponentId([definitions[name]]);
  const componentSite = id => ({ kind: "component", component: id });
  const edge = (caller, callee, node = 1) => ({ caller: definitions[caller], at: { body: caller === "f" ? body : otherBody, node },
    kind: "direct", callee: { kind: "definition", definition: definitions[callee] }, bindings: parametric() });
  const directedGraph = () => ({ definitions: [definitions.f, definitions.other], edges: [edge("f", "other")],
    components: [{ id: componentId("f"), definitions: [definitions.f], dependencies: [componentId("other")] },
      { id: componentId("other"), definitions: [definitions.other], dependencies: [] }] });
  const recursiveGraph = () => ({ definitions: [definitions.f, definitions.other], edges: [edge("f", "other"), edge("other", "f")],
    components: [{ id: ids.encodeComponentId([definitions.f, definitions.other]), definitions: [definitions.f, definitions.other], dependencies: [] }] });
  const graphOpposite = async (name, make, amend, expected) => suite.test(`call graph ${name}`, () => {
    const supplied = setup(); const input = make(supplied);
    equal(product.verifyCallGraph(input, supplied.context), [], `call graph ${name}: complete valid graph`);
    const invalid = clone(input); amend(invalid, supplied);
    equal(product.verifyCallGraph(invalid, supplied.context), expected, `call graph ${name}: complete opposite vector`);
  });
  const graphCases = [
    ["definitions-order", directedGraph, input => { input.definitions.reverse(); }, [{ rule: "definitions-order", site: summarySite(), message: "Definitions must be distinct and ordered by identity." }]],
    ["edges-order", directedGraph, input => { input.edges.push(clone(input.edges[0])); }, [{ rule: "edges-order", site: nodeSite(1), message: "Call edges must be distinct and ordered by caller, occurrence and callee." }]],
    ["components-order", directedGraph, input => { input.components.reverse(); }, [{ rule: "components-order", site: componentSite(componentId("f")), message: "Components must be distinct and ordered by identity." }]],
    ["definition-resolves", graph, (input, supplied) => { supplied.context.definitionExists = () => false; }, [{ rule: "definition-resolves", site: summarySite(), message: "The graph definition must exist in the supplied definition inventory." }]],
    ["call-site-resolves", directedGraph, input => { input.edges[0].at.node = 99; }, [{ rule: "call-site-resolves", site: nodeSite(99), message: "A call edge must retain an existing source occurrence." }]],
    ["cross-owner-qualified", directedGraph, input => { input.edges[0].at.body = otherBody; }, [{ rule: "cross-owner-qualified", site: { kind: "node", at: { body: otherBody, node: 1 } }, message: "The call occurrence must belong to its actual caller definition." }]],
    ["component-identity", directedGraph, input => { input.components[0].id = componentId("parameter"); }, [{ rule: "component-identity", site: componentSite(componentId("parameter")), message: "The component identity must encode exactly its canonical member vector." }]],
    ["component-membership-exact", directedGraph, input => { input.components.shift(); }, [{ rule: "component-membership-exact", site: summarySite(), message: "Each graph definition must belong to exactly one component." }]],
    ["component-dependencies-exact", directedGraph, input => { input.components[0].dependencies = []; }, [{ rule: "component-dependencies-exact", site: componentSite(componentId("f")), message: "Dependencies must be exactly the other components named by closed call edges." }]],
    ["component-members-order", recursiveGraph, input => { input.components[0].definitions.reverse(); }, [
      { rule: "component-members-order", site: componentSite(ids.encodeComponentId([definitions.f, definitions.other])), message: "Component members must be distinct and ordered by definition identity." },
    ]],
    ["component-dependencies-order", () => ({ definitions: [definitions.f, definitions.other, definitions.parameter], edges: [edge("f", "other", 1), edge("f", "parameter", 2)],
      components: [{ id: componentId("f"), definitions: [definitions.f], dependencies: [componentId("other"), componentId("parameter")] },
        { id: componentId("other"), definitions: [definitions.other], dependencies: [] }, { id: componentId("parameter"), definitions: [definitions.parameter], dependencies: [] }] }),
      input => { input.components[0].dependencies.reverse(); }, [{ rule: "component-dependencies-order", site: componentSite(componentId("f")), message: "Component dependencies must be distinct and ordered by identity." }]],
    ["component-acyclic", directedGraph, input => { input.edges.push(edge("other", "f")); input.components[1].dependencies = [componentId("f")]; }, [
      { rule: "component-acyclic", site: componentSite(componentId("f")), message: "The condensation graph must be acyclic; recursion belongs inside one component." },
      { rule: "component-acyclic", site: componentSite(componentId("other")), message: "The condensation graph must be acyclic; recursion belongs inside one component." },
    ]],
  ];
  for (const [rule, make, amend, expected] of graphCases) await graphOpposite(rule, make, amend,
    expected.map(entry => violation(entry.rule, entry.site, entry.message)));
  await graphOpposite("duplicate component identifiers do not merge distinct member worklists", directedGraph,
    input => { input.components[1].id = componentId("f"); }, [
      violation("components-order", componentSite(componentId("f")), "Components must be distinct and ordered by identity."),
      violation("component-identity", componentSite(componentId("f")), "The component identity must encode exactly its canonical member vector."),
      violation("component-dependencies-exact", componentSite(componentId("f")), "Dependencies must be exactly the other components named by closed call edges."),
    ]);
  await graphOpposite("actual missing caller body ownership is not reconstructed from an ID", directedGraph,
    (input, supplied) => { supplied.bodyOwners.set(body, null); },
    [violation("cross-owner-qualified", nodeSite(1), "The call occurrence must belong to its actual caller definition.")]);
  const edgeOrder = [violation("edges-order", nodeSite(1), "Call edges must be distinct and ordered by caller, occurrence and callee.")];
  await graphOpposite("same-occurrence kind order", () => {
    const input = graph(); input.edges = [{ ...edge("f", "f"), kind: "callback" }, edge("f", "f")]; return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await graphOpposite("same-occurrence closed callee order", () => {
    const input = directedGraph(); input.edges.unshift(edge("f", "f")); return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await graphOpposite("same-occurrence closed versus open callee order", () => {
    const input = graph(); input.edges = [edge("f", "f"), { ...edge("f", "f"),
      callee: { kind: "open", boundary: { owner: owner(), boundary: 0 } } }]; return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await graphOpposite("same-occurrence open owner order", () => {
    const input = graph(); input.edges = [owner(), summaryOwner(summary().key)].map(selectedOwner => ({ ...edge("f", "f"),
      callee: { kind: "open", boundary: { owner: selectedOwner, boundary: 0 } } })); return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await graphOpposite("same-occurrence open boundary order", supplied => {
    const actual = clone(supplied.canonicalArenas.get(arenaKey(owner())));
    actual.boundaries.push({ ...clone(actual.boundaries[0]), id: 1, kind: "opaque-write", detail: "second actual boundary" });
    supplied.canonicalArenas.set(arenaKey(owner()), actual);
    const input = graph(); input.edges = [0, 1].map(boundary => ({ ...edge("f", "f"),
      callee: { kind: "open", boundary: { owner: owner(), boundary } } })); return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await graphOpposite("same-occurrence complete artifact environment order", () => {
    const input = graph(); input.edges = [edge("f", "f"), { ...edge("f", "f"), bindings: { kind: "instantiated", bindings: emptyBindings() } }]; return input;
  }, input => { input.edges.reverse(); }, edgeOrder);
  await suite.test("legal recursion remains wholly inside one real component", () => equal(product.verifyCallGraph(recursiveGraph(), setup().context), [], "mutual recursion is not a condensation cycle"));
  await suite.test("parser line and column locations use UTF-16 code units and CRLF counts once", () => {
    malformed(product.parseCallGraph, " \r\n  Unknown()", 5, ["CallGraph"], "Unknown", "CRLF record location", 2, 3);
    malformed(product.parseCallGraph, "\n\tUnknown()", 2, ["CallGraph"], "Unknown", "tab is one code unit", 2, 2);
    malformed(product.parseCallGraph, "\rUnknown()", 1, ["CallGraph"], "Unknown", "CR record location", 2, 1);
  });
  for (const kind of ["direct", "indirect", "getter", "setter", "constructor", "initializer", "callback"]) {
    const input = graph(); input.edges = [{ ...edge("f", "f"), kind }];
    const expected = graphText.replace("edges=[]", `edges=${arrayText([`${kind}(caller=def:"${definitions.f}", at=${nodeText(1)}, callee=definition(definition=def:"${definitions.f}"), bindings=parametric())`])}`);
    await textCase(`call edge transport ${kind}`, input, expected, product.printCallGraph, product.parseCallGraph);
    await suite.test(`call edge ${kind} actual same-component recursion`, () => equal(product.verifyCallGraph(input, setup().context), [], "complete same-component graph"));
  }
  for (const selectedOwner of [owner(), { kind: "summary", definition: definitions.f, bindings: parametric() }]) {
    const input = graph(); input.edges = [{ caller: definitions.f, at: nodeRef(1), kind: "callback", callee: { kind: "open", boundary: { owner: selectedOwner, boundary: 0 } }, bindings: parametric() }];
    const expectedOwner = selectedOwner.kind === "body" ? `body(instance=${instanceText})` : `summary(definition=def:"${definitions.f}", bindings=parametric())`;
    await textCase(`open call edge qualified ${selectedOwner.kind}`, input, graphText.replace("edges=[]",
      `edges=${arrayText([`callback(caller=def:"${definitions.f}", at=${nodeText(1)}, callee=open(boundary=OpenBoundaryRef(owner=${expectedOwner}, boundary=boundary:0)), bindings=parametric())`])}`),
    product.printCallGraph, product.parseCallGraph);
    await suite.test(`open call edge ${selectedOwner.kind} resolves actual canonical arena`, () => equal(product.verifyCallGraph(input, setup().context), [], "complete resolving open graph"));
  }

  await suite.test("every numeric identity decoder rejects a different prefix, string payload and bare scalar at its actual field", () => {
    const read = emptyFactsText.replace("reads=[]", `reads=${arrayText(["InitializationFact(node=n:0, place=p:0, assigned=false)"])}`);
    const bound = emptyFactsText.replace("boundProducers=[]", `boundProducers=${arrayText([
      `BoundProducer(id=bound:0, producer=producer:0, bindings=${bindingsText}, context=context:0)`,
    ])}`);
    const paths = emptyFactsText.replace("projections=[]", `projections=${arrayText(["ProjectionPath(id=path:0, parent=null, projection=deref())"])}`);
    const boundary = emptyFactsText.replace("boundaries=[]", `boundaries=${arrayText([
      `external-input(id=boundary:0, at=node(node=${nodeText(0)}), subject=producer:0, owner=null, bindings=${bindingsText}, context=context:0, detail="unknown")`,
    ])}`);
    const locals = emptyFactsText.replace("locals=[]", `locals=${arrayText(["LocalLiveRange(local=l:0, segments=[])"])}`);
    const stores = emptyFactsText.replace("stores=[]", `stores=${arrayText(["StoreLiveness(node=n:0, point=MirPoint(block=b:0, statement=null), observed=false)"])}`);
    const field = `memory-field(key=${keyText("layout")}, root=field:0, layouts=[], fields=[])`;
    const layout = `memory-layout(key=${keyText("layout")}, root=layout:0, layouts=[], fields=[])`;
    const raw = emptyFactsText.replace("rawLocations=[]", `rawLocations=${arrayText([
      `RawLocationFact(node=n:0, operation="to-raw", pointee=t:0, layout=${layoutReferenceText}, context=context:0, bindings=${bindingsText})`,
    ])}`);
    const vectors = [[product.parseFacts, read, "n"], [product.parseFacts, read, "p"], [product.parseFacts, stores, "b"],
      [product.parseFacts, bound, "bound"], [product.parseFacts, bound, "producer"], [product.parseFacts, bound, "context"],
      [product.parseFacts, paths, "path"], [product.parseFacts, boundary, "boundary"], [product.parseFacts, locals, "l"],
      [product.parseSummary, emptySummaryText, "origins"], [product.parseSummary, emptySummaryText, "sig"],
      [product.parseMetadata, field, "field"], [product.parseMetadata, layout, "layout"], [product.parseFacts, raw, "t"]];
    for (const [parse, text, prefix] of vectors) for (const replacement of ["q:0", `${prefix}:\"zero\"`, "0"]) {
      const marker = `${prefix}:0`; const offset = text.indexOf(marker); const invalid = text.replace(marker, replacement);
      const before = invalid.slice(0, offset).split("\n");
      malformed(parse, invalid, offset, [prefix + ":number"], replacement === "q:0" ? "q" : replacement === "0" ? "0" : prefix,
        `complete numeric identity ${prefix}/${replacement}`, before.length, before.at(-1).length + 1);
    }
  });

  await suite.test("authored adjacent descriptors execute the real owning ports with complete outcomes", async () => {
    const invalid = result => ({ kind: "refused", diagnostics: [{ code: "invalid-text", message: `Expected ${result.expected.join(" or ")}`,
      site: { offset: result.offset, line: result.line, column: result.column, expected: result.expected, found: result.found } }] });
    const deps = {
      modules: ["ir-facts"], canonical: path => realpathSync(resolve(repository, path)) === resolve(repository, path) ? path : null,
      readText: path => readFileSync(resolve(repository, path), "utf8"), list: path => readdirSync(resolve(repository, path)), decode: text => JSON.parse(text),
      adapters: {
        function: async input => { const parsed = product.parseCallGraph(input.text); return parsed.kind === "parsed" ? { kind: "accepted", value: parsed.value, diagnostics: [] } : invalid(parsed); },
        verifier: async input => { const parsed = product.parseCallGraph(input.text); if (parsed.kind === "invalid-text") return invalid(parsed);
          const diagnostics = product.verifyCallGraph(parsed.value, setup().context);
          return diagnostics.length === 0 ? { kind: "accepted", value: [], diagnostics: [] } : { kind: "refused", diagnostics: diagnostics.map(value => ({ code: value.rule,
            message: value.detail.map(part => part.value).join(""), site: value.site })) }; },
      },
    };
    for (const [level, name] of [["function", "callgraph-empty"], ["function", "callgraph-invalid"], ["verifier", "callgraph-empty"], ["verifier", "callgraph-missing-component"]]) {
      const path = `test/host-cases/ir-facts/${level}/${name}.case.json`;
      const expected = JSON.parse(readFileSync(resolve(repository, `test/host-cases/ir-facts/${level}/${name}.expected.json`), "utf8"));
      equal(await runCase(deps, path), { status: "passed", path, outcome: expected }, `${level}/${name}: full real owning result`);
    }
  });

  await suite.test("100000-level body and summary projection chains print parse and verify linearly", () => {
    const rows = Array.from({ length: 100000 }, (_, id) => ({ id, parent: id === 0 ? null : id - 1, projection: { kind: "index", constant: 0n } }));
    const authored = arrayText(rows.map(row => `ProjectionPath(id=path:${row.id}, parent=${row.parent === null ? "null" : `path:${row.parent}`}, projection=index(constant=0n))`));
    const input = emptyFacts(); input.arena.projections = rows;
    const expected = emptyFactsText.replace("projections=[]", `projections=${authored}`);
    equal(product.printFacts(input), expected, "complete independently authored 100000-link body text");
    equal(product.parseFacts(expected), { kind: "parsed", value: input }, "complete 100000-link body decode");
    const supplied = setup(input, []);
    equal(product.verifyFacts(input, supplied.mir, supplied.context), [], "complete 100000-link body verifier");
    const retained = emptySummary(); retained.arena.projections = rows;
    const summaryExpected = emptySummaryText.replace("projections=[]", `projections=${authored}`);
    equal(product.printSummary(retained), summaryExpected, "complete independently authored 100000-link summary text");
    equal(product.parseSummary(summaryExpected), { kind: "parsed", value: retained }, "complete 100000-link summary decode");
    supplied.canonicalArenas.set(arenaKey(summaryOwner(retained.key)), clone(retained.arena));
    supplyScopes(supplied, { kind: "summary", summary: retained.key }, []);
    equal(product.verifySummary(retained, supplied.context), [], "complete 100000-link summary verifier");
  });
  await suite.test("100000-level exact metadata element chain uses actual type and ABI data", () => {
    const input = metadata(); const supplied = setup();
    supplied.types.terms = [{ kind: "primitive", primitive: "int64" }];
    for (let id = 1; id < 100000; id += 1) {
      supplied.types.terms.push({ kind: "fixed-array", element: id - 1, extent: { length: 1n, runtimeBase: "bigint" } });
      input.layouts.push({ id, occurrence: itemRef(definitions.layout), source: id, dataLayout: definitions.abi64,
        byteSize: 8n, byteAlignment: 8n, stride: 8n, kind: "array", length: 1n, runtimeBase: "bigint", element: id - 1 });
    }
    input.root = 99999; supplied.metadataRows.set(definitions.layout, clone(input));
    const occurrence = `item(value=ItemNodeRef(owner=def:"${definitions.layout}", node=n:0))`;
    const layouts = [`value(id=layout:0, occurrence=${occurrence}, source=t:0, dataLayout=def:"${definitions.abi64}", byteSize=8n, byteAlignment=8n, stride=8n, fields=[])`];
    for (let id = 1; id < 100000; id += 1) layouts.push(`array(id=layout:${id}, occurrence=${occurrence}, source=t:${id}, dataLayout=def:"${definitions.abi64}", byteSize=8n, byteAlignment=8n, stride=8n, length=1n, runtimeBase="bigint", element=layout:${id - 1})`);
    const expected = `memory-layout(key=${keyText("layout")}, root=layout:99999, layouts=${arrayText(layouts)}, fields=[])\n`;
    equal(product.printMetadata(input), expected, "complete independently authored 100000-link metadata text");
    equal(product.parseMetadata(expected), { kind: "parsed", value: input }, "complete 100000-link metadata decode");
    equal(product.verifyMetadata(input, supplied.context), [], "complete 100000-link metadata verifier");
  });
  await suite.test("100000-level call-component dependency chain retains real identities and edges", () => {
    const definitions = Array.from({ length: 100000 }, (_, index) => definition(`g${String(index).padStart(6, "0")}`));
    const bodies = definitions.map(owner => ids.encodeBodyId({ owner, role: "function", ordinal: 0 }));
    const components = definitions.map(value => ids.encodeComponentId([value]));
    const input = { definitions, edges: definitions.slice(0, -1).map((caller, index) => ({ caller, at: { body: bodies[index], node: 1 }, kind: "direct",
      callee: { kind: "definition", definition: definitions[index + 1] }, bindings: parametric() })),
    components: definitions.map((value, index) => ({ id: components[index], definitions: [value], dependencies: index === 99999 ? [] : [components[index + 1]] })) };
    const expected = `CallGraph(definitions=${arrayText(definitions.map(value => `def:"${value}"`))}, edges=${arrayText(input.edges.map((edge, index) =>
      `direct(caller=def:"${definitions[index]}", at=NodeRef(body=body:"${bodies[index]}", node=n:1), callee=definition(definition=def:"${definitions[index + 1]}"), bindings=parametric())`))}, components=${arrayText(input.components.map((component, index) =>
      `CallComponent(id=component:"${components[index]}", definitions=${arrayText([`def:"${definitions[index]}"`])}, dependencies=${arrayText(index === 99999 ? [] : [`component:"${components[index + 1]}"`])})`))})\n`;
    equal(product.printCallGraph(input), expected, "complete independently authored 100000-link graph text");
    equal(product.parseCallGraph(expected), { kind: "parsed", value: input }, "complete 100000-link graph decode");
    const supplied = setup(); const declarationInventory = new Set(definitions); const nodeInventory = new Set(bodies);
    supplied.context.definitionExists = value => declarationInventory.has(value);
    supplied.context.nodeExists = value => value.kind === "body" && nodeInventory.has(value.value.body) && value.value.node === 1;
    const actualOwners = new Map(bodies.map((body, index) => [body, definitions[index]]));
    supplied.context.bodyOwner = value => actualOwners.get(value) ?? null;
    equal(product.verifyCallGraph(input, supplied.context), [], "complete 100000-link condensation verifier");
  });

  await suite.test("whole fresh strict declaration isolation and genuine readonly consumers", async () => {
    const module = hostCatalogue.find(row => row.name === "ir-facts");
    const tooling = process.env.TSONIC_TOOLING_ROOT === undefined ? repository : realpathSync(process.env.TSONIC_TOOLING_ROOT);
    const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
    const deps = isolationDeps(tooling, areas.areas.map(area => area.directory));
    const interfaces = ["ids/contract", "ids/index", "diag/contract", "ir-types/contract", "ir-types/index", "ir-hir/contract", "ir-hir/index",
      "ir-infer/contract", "ir-tir/contract", "ir-mir/contract", "snapshot/contract"].map(name => `packages/host/src/${name}.ts`);
    const files = new Map();
    const visit = directory => {
      for (const entry of readdirSync(resolve(repository, directory), { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        assert.equal(entry.isSymbolicLink(), false, "strict declaration sources are actual originals");
        if (entry.isDirectory()) visit(path);
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) files.set(path, readFileSync(resolve(repository, path), "utf8"));
      }
    };
    for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir", "ir-mir", "snapshot"]) visit(`packages/host/src/${name}`);
    const graph = readImportGraph(parseSources(files), files);
    const production = new Set(interfaces);
    for (const path of production) for (const edge of graph) if (edge.source === path && edge.target !== null) {
      assert.equal(files.has(edge.target), true, "the actual public dependency closure stays in the admitted original owners");
      production.add(edge.target);
    }
    let stage;
    try {
      const report = await compileIsolated({ ...deps, discard: directory => { stage = directory; } }, module, {
        root: repository, sourceFiles, interfaceSources: interfaces, declarationSources: [...production], outputDirectory: ".temp/ir-facts-isolation",
      });
      const evidence = resolve(repository, ".analysis/20261110-host-f-ir-facts"); mkdirSync(evidence, { recursive: true });
      writeFileSync(resolve(evidence, "strict-isolation.json"), JSON.stringify(report, null, 2));
      equal(report.findings, [], "whole strict isolation has no source, private, SDK or inventory escape");
      assert.equal(report.status, "passed", "whole strict isolation compiles actual implementations against fresh actual dependency declarations");
      const consumer = resolve(stage, "consumer"); cpSync(resolve(stage, "owner-declarations"), consumer, { recursive: true });
      for (const entry of report.provenance) {
        const path = resolve(consumer, relative(repository, entry.source).replace(/\.ts$/u, ".d.ts"));
        mkdirSync(dirname(path), { recursive: true }); copyFileSync(entry.declaration, path);
      }
      const prefix = [
        'import { printFacts, parseFacts, verifyFacts, printSummary, parseSummary, verifySummary, printMetadata, parseMetadata, verifyMetadata, printCallGraph, parseCallGraph, verifyCallGraph } from "./packages/host/src/ir-facts/index.js";',
        'import type { BodyFacts, Summary, MetadataRecord, CallGraph, FactsVerificationContext } from "./packages/host/src/ir-facts/contract.js";',
        'import type { MirBody } from "./packages/host/src/ir-mir/contract.js";',
        "declare const facts: BodyFacts; declare const summary: Summary; declare const metadata: MetadataRecord; declare const graph: CallGraph; declare const context: FactsVerificationContext; declare const mir: MirBody;",
        'const values = [printFacts(facts), parseFacts(""), verifyFacts(facts, mir, context), printSummary(summary), parseSummary(""), verifySummary(summary, context), printMetadata(metadata), parseMetadata(""), verifyMetadata(metadata, context), printCallGraph(graph), parseCallGraph(""), verifyCallGraph(graph, context)]; void values;',
      ].join("\n");
      const cases = [["all-ports", "", []], ["facts-readonly", "facts.instance.body = facts.instance.body;", [2540]],
        ["summary-readonly", "summary.result = summary.result;", [2540]], ["metadata-readonly", "metadata.key.definition = metadata.key.definition;", [2540]],
        ["graph-readonly", "graph.edges = [];", [2540]], ["producer-vector-readonly", "facts.arena.producers.push(facts.arena.producers[0]);", [2339]],
        ...["parseFacts", "parseSummary", "parseMetadata", "parseCallGraph"].map(name => [name, `${name}(0);`, [2345]]),
        ["printFacts", "printFacts(summary);", [2345]], ["printSummary", "printSummary(facts);", [2345]],
        ["printMetadata", "printMetadata(graph);", [2345]], ["printCallGraph", "printCallGraph(metadata);", [2345]],
        ["verifyFacts", "verifyFacts(summary, mir, context);", [2345]], ["verifySummary", "verifySummary(facts, context);", [2345]],
        ["verifyMetadata", "verifyMetadata(graph, context);", [2345]], ["verifyCallGraph", "verifyCallGraph(metadata, context);", [2345]],
      ];
      const results = [];
      for (const [name, statement, expected] of cases) {
        const path = `${name}.ts`; writeFileSync(resolve(consumer, path), `${prefix}\n${statement}\n`);
        const config = `${name}.json`; writeFileSync(resolve(consumer, config), JSON.stringify({ compilerOptions: {
          strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true,
          noImplicitReturns: true, noFallthroughCasesInSwitch: true, skipLibCheck: false, noEmit: true, target: "es2022", lib: ["es2022"],
          module: "nodenext", moduleResolution: "nodenext", types: [],
        }, files: [path] }));
        const result = deps.run(consumer, resolve(consumer, config)); results.push({ name, ...result });
        const actual = [...result.diagnostics.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1]));
        equal(actual, expected, `${name}: exact independently expected strict consumer diagnostics`);
        assert.equal(result.status, expected.length === 0 ? 0 : 1, `${name}: actual compiler terminal status`);
        assert.equal(result.loadedFiles.includes(resolve(consumer, "packages/host/src/ir-facts/index.d.ts")), true, `${name}: actual fresh declaration consumer`);
        assert.equal(result.loadedFiles.every(path => path.startsWith(`${consumer}/`) || deps.platform.language.includes(path)), true, `${name}: no source or platform escape`);
      }
      writeFileSync(resolve(evidence, "strict-consumers.json"), JSON.stringify(results, null, 2));
    } finally { if (stage !== undefined) deps.discard(stage); }
  });

  await suite.test("all eight actual emitted product files have nonempty source-identified 100 percent coverage", async () => {
    const productPaths = sourceNames.map(name => resolve(repository, `packages/host/dist/ir-facts/${name}.js`));
    const coverage = await post("Profiler.takePreciseCoverage");
    const result = coverage.result.filter(script => productPaths.some(path => pathToFileURL(path).href === script.url));
    const sources = [];
    for (const script of result) {
      const source = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: source.scriptSource });
    }
    const raw = [{ result, sources }];
    const report = checkCoverage({ canonical: path => realpathSync(path), readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => url.startsWith("file:") && productPaths.includes(fileURLToPath(url)) ? { path: fileURLToPath(url), text } : null,
    }, [...productPaths, resolve(repository, "packages/host/src/ir-facts/contract.ts")], raw);
    const evidence = resolve(repository, ".analysis/20261110-host-f-ir-facts"); mkdirSync(evidence, { recursive: true });
    writeFileSync(resolve(evidence, "product-coverage.json"), JSON.stringify(report, null, 2));
    writeFileSync(resolve(evidence, "product-source-identity.json"), JSON.stringify({ sources: sourceHashes,
      emitted: productPaths.map(path => [path, hash(readFileSync(path))]) }, null, 2));
    equal(sourceFiles.map(path => [path, hash(readFileSync(resolve(repository, path)))]), sourceHashes, "all actual original source inputs remain unchanged throughout the whole proof");
    equal(report.findings, [], "actual product coverage has no exclusions, empty reports, source-identity mismatches or uncovered logic");
    equal(report.files, [...productPaths.map(path => ({ path: realpathSync(path), sourceHash: hash(readFileSync(path)), status: "covered", lines: 100, branches: 100, functions: 100 })),
      { path: realpathSync(resolve(repository, "packages/host/src/ir-facts/contract.ts")), sourceHash: sourceHashes[0][1], status: "not-applicable", lines: null, branches: null, functions: null }],
    "every actual runtime product owner is nonempty 100/100/100; only the type-only contract is N/A");
  });
});
