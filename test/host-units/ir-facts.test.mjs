import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const sourceNames = ["index", "print", "parse", "verify-facts", "verify-relations", "verify-summary", "verify-metadata", "verify-call-graph"];
const sourceFiles = ["contract", ...sourceNames].map(name => `packages/host/src/ir-facts/${name}.ts`);
const hash = text => createHash("sha256").update(text).digest("hex");
const sourceHashes = sourceFiles.map(path => [path, hash(readFileSync(resolve(repository, path)))]);
const equal = (actual, expected, label) => assert.equal(compareCaseValues(actual, expected), true, label);
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
  const setup = (canonical = bodyFacts()) => {
    const original = clone(canonical);
    const originalSummary = summary();
    const originalMetadata = metadata();
    const originalTir = tir();
    const originalMir = mir();
    const tables = { terms: [{ kind: "primitive", primitive: "int64" }, { kind: "intrinsic", intrinsic: "void" },
      { kind: "fixed-array", element: 0, extent: { length: 9007199254740993n, runtimeBase: "bigint" } }], signatures: [signature()] };
    const metadataRows = new Map([[definitions.layout, originalMetadata], [definitions.abi32, abi(32)], [definitions.abi64, abi(64)], [definitions.missing, null]]);
    const canonicalArenas = new Map([[`body:${body}`, original.arena], [`summary:${definitions.f}`, originalSummary.arena]]);
    const context = {
      limits: finiteLimits(), types: tables, diagnostics: [],
      tirBody: selected => { assert.equal(selected.body, body, "named actual TIR lookup"); return originalTir; },
      definitionExists: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named definition inventory"); return selected !== definitions.missing; },
      libraryExportExists: selected => { equal(selected, libraryIdentity, "named actual library export"); return true; },
      declaredSiteCount: selected => { equal(selected, libraryIdentity, "named declared-site inventory"); return 1; },
      nodeExists: selected => selected.kind === "body" ? (assert.equal([body, otherBody].includes(selected.value.body), true, "qualified node owner"),
        Number.isSafeInteger(selected.value.node) && selected.value.node >= 0 && selected.value.node <= 31)
        : (assert.equal(Object.values(definitions).includes(selected.value.owner), true, "qualified item owner"), selected.value.node === 0),
      localExists: selected => [body, otherBody].includes(selected.body) && selected.local === 0,
      bindingScopeOf: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named binding inventory"); return selected === definitions.missing ? null : emptyScope(); },
      nominalOf: selected => { assert.equal(Object.values(definitions).includes(selected), true, "named nominal declaration inventory");
        return [definitions.layout, definitions.field].includes(selected) ? { kind: "declared", facets: ["instance", "value"] } : null; },
      bindingDependentOf: selected => { assert.equal(selected, definitions.f, "actual dependence inventory"); return false; },
      captureCount: selected => { assert.equal(selected.definition, definitions.f, "actual independent capture inventory"); return 0; },
      arenaOf: selected => { const key = selected.kind === "body" ? `body:${selected.instance.body}` : `summary:${selected.definition}`;
        assert.equal(canonicalArenas.has(key) || key === `body:${otherBody}` || key === `summary:${definitions.missing}`, true, "named qualified arena inventory");
        return canonicalArenas.get(key) ?? null; },
      metadataOf: selected => { assert.equal(metadataRows.has(selected.definition), true, "named actual metadata inventory"); return metadataRows.get(selected.definition); },
    };
    return { canonical: original, summary: originalSummary, metadata: originalMetadata, mir: originalMir, tir: originalTir,
      types: tables, context, metadataRows, canonicalArenas };
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
    assert.equal(print(value), expected, `${name}: complete independently authored text`);
    equal(parse(expected), { kind: "parsed", value }, `${name}: complete decoded record`);
    equal(parse(print(value)), { kind: "parsed", value }, `${name}: lossless whole-value composition`);
  });
  await textCase("body facts required empty records and qualified identity", emptyFacts(), emptyFactsText, product.printFacts, product.parseFacts);
  await textCase("summary known empty effects", emptySummary(), emptySummaryText, product.printSummary, product.parseSummary);
  for (const width of [32, 64]) await textCase(`authored ${width}-bit ABI`, abi(width), abiText(width), product.printMetadata, product.parseMetadata);
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
  for (const [name, value, spelling] of [["negative zero", -0, "-0"], ["not a number", NaN, "NaN"], ["positive infinity", Infinity, "+Infinity"], ["negative infinity", -Infinity, "-Infinity"], ["fractional", 0.5, "0.5"], ["exponent", 1e30, "1e+30"]]) {
    const input = emptyFacts(); input.liveness.stores = [{ node: 1, point: { block: 0, statement: value }, observed: false }];
    const expected = emptyFactsText.replace("stores=[]", `stores=${arrayText([`StoreLiveness(node=n:1, point=MirPoint(block=b:0, statement=${spelling}), observed=false)`])}`);
    await textCase(`total plain number ${name}`, input, expected, product.printFacts, product.parseFacts);
  }

  const factOpposite = async (name, prepare, amend, expected) => suite.test(name, () => {
    const input = bodyFacts();
    const supplied = setup(input);
    prepare(input, supplied);
    supplied.canonicalArenas.set(`body:${body}`, clone(input.arena));
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
  await factOpposite("declared-site-ordinal", value => { value.arena.producers[0].at = { kind: "declared", identity: clone(libraryIdentity), site: 0 }; },
    value => { value.arena.producers[0].at.site = 1; }, [violation("declared-site-ordinal", { kind: "declared-site", owner: owner(), identity: libraryIdentity, site: 1 },
      "A logical site ordinal must name an actual declared allocation site of that export.")]);
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
    ["callbacks-order", ["origins", "callbacks"], node => ({ node, argument: { authoredIndex: 0, parameter: definitions.parameter, parameterIndex: 0, effectiveIndex: 0,
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
    if (rule === "callbacks-order") supplied.canonicalArenas.set(`summary:${definitions.callee}`, { ...arena(), producers: [{ id: 0, path: null, kind: "parameter", index: 0 }] });
    if (rule === "memory-bindings-order") input.recordBindings = [{ node: 3, result: 0, layoutExpression: nodeRef(3),
      layout: { metadata: { definition: definitions.layout, bindings: parametric() }, layout: 0 }, context: 0, bindings: emptyBindings(), fields: [] }];
  }, input => { put(input, path, [row(2), row(1)]); }, [violation(rule, nodeSite(1), orderMessage)]);

  const completePaths = () => ({ kind: "complete", paths: [] });
  const parameter = (declaration = definitions.parameter, type = 0) => ({ declaration, kind: "required", type, passing: "by-value", initializer: null });
  const summarySite = () => ({ kind: "summary", summary: { definition: definitions.f, bindings: parametric() } });
  const summaryOpposite = async (name, prepare, amend, expected) => suite.test(`summary ${name}`, () => {
    const supplied = setup(); const input = summary();
    prepare(input, supplied); supplied.canonicalArenas.set(`summary:${definitions.f}`, clone(input.arena));
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
    input.callbacks = [{ parameterIndex: 0, timing: "synchronous", rejection: null, inputs: [] }];
  };
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
  await summaryOpposite("bindings-complete", (input, supplied) => {
    Object.assign(input, emptySummary());
    supplied.context.bindingScopeOf = () => ({ ...emptyScope(), classParameters: [{ owner: definitions.f, index: 0 }] });
  }, input => { input.key.bindings = { kind: "instantiated", bindings: emptyBindings() }; }, [violation("bindings-complete",
    { kind: "summary", summary: { definition: definitions.f, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
    "A binding vector retains every expected class, method, captured and self binding in canonical owner order.")]);

  const member = (primary = definitions.field) => ({ decision: { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: primary }],
    selectedDeclarations: [primary], primary, read: 0, write: 0, getter: null, setter: null, bindings: emptyBindings() }, getter: null, setter: null });
  const memoryField = (id = 0, primary = definitions.field) => ({ id, occurrence: itemRef(primary), owner: 3,
    selector: itemRef(primary), selection: itemRef(primary), member: member(primary), primary, selectedDeclarations: [primary],
    value: 0, layout: 0, byteOffset: 0n, byteAlignment: 8n });
  const withField = (input, supplied) => {
    supplied.types.terms.push({ kind: "declared", definition: definitions.layout, arguments: [], facet: "instance", extent: null });
    input.layouts.push({ ...clone(input.layouts[0]), id: 1, source: 3, byteSize: 16n, stride: 16n, fields: [0] });
    input.fields = [memoryField()]; input.root = 1;
  };
  const withArray = (input, supplied) => {
    supplied.types.terms[2].extent.length = 0n;
    input.layouts.push({ ...clone(input.layouts[0]), id: 1, source: 2, byteSize: 0n, stride: 0n, kind: "array", length: 0n, runtimeBase: "bigint", element: 0 });
    delete input.layouts[1].fields; input.root = 1;
  };
  const metadataSite = () => ({ kind: "metadata", metadata: { definition: definitions.layout, bindings: parametric() } });
  const metadataOpposite = async (name, prepare, amend, expected) => suite.test(`metadata ${name}`, () => {
    const input = metadata(); const supplied = setup();
    prepare(input, supplied); supplied.metadataRows.set(definitions.layout, clone(input));
    equal(product.verifyMetadata(input, supplied.context), [], `metadata ${name}: complete valid value`);
    const invalid = clone(input); amend(invalid, supplied);
    equal(product.verifyMetadata(invalid, supplied.context), expected, `metadata ${name}: complete opposite vector`);
  });
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
    ["layout-geometry-consistent", (input, supplied) => { withField(input, supplied); input.fields.push(memoryField(1, definitions.other)); },
      input => { input.layouts[1].fields.push(1); }, "Distinct nonempty physical fields must not overlap."],
  ];
  for (const [rule, prepare, amend, message] of metadataCases) await metadataOpposite(rule, prepare, amend, [violation(rule, metadataSite(), message)]);
  await metadataOpposite("bindings-complete", (input, supplied) => {
    supplied.context.bindingScopeOf = () => ({ ...emptyScope(), classParameters: [{ owner: definitions.layout, index: 0 }] });
  }, input => { input.key.bindings = { kind: "instantiated", bindings: emptyBindings() }; }, [
    violation("bindings-complete", { kind: "metadata", metadata: { definition: definitions.layout, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "A binding vector retains every expected class, method, captured and self binding in canonical owner order."),
    violation("cross-owner-qualified", { kind: "metadata", metadata: { definition: definitions.layout, bindings: { kind: "instantiated", bindings: emptyBindings() } } },
      "The metadata kind must belong to the same declaration and complete binding environment."),
  ]);

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
    const supplied = setup(); const input = make();
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
      { rule: "component-identity", site: componentSite(ids.encodeComponentId([definitions.f, definitions.other])), message: "The component identity must encode exactly its canonical member vector." },
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
  await suite.test("legal recursion remains wholly inside one real component", () => equal(product.verifyCallGraph(recursiveGraph(), setup().context), [], "mutual recursion is not a condensation cycle"));

  await post("Profiler.stopPreciseCoverage");
  inspector.disconnect();
});
