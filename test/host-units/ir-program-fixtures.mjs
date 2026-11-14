import assert from "node:assert/strict";
import { encodeBodyId, encodeDefId, encodeKey, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import { artifactBindingsKey, bindingTargetKey, bodyInstanceKey, declarationInstanceKey, libraryExportKey,
  relationalOwnerKey, sourceReferenceKey } from "./fixtures/verification-keys.mjs";

export function encodeContextKey([name, key]) {
  let data;
  switch (name) {
    case "bodyOf": case "tirBody": data = bodyInstanceKey(key); break;
    case "bindingScopesOf": data = bindingTargetKey(key); break;
    case "tirBindingScopesOf": data = key.kind === "module" ? [key.kind, key.module]
      : [key.kind, bodyInstanceKey(key.instance)]; break;
    case "arenaOf": data = relationalOwnerKey(key); break;
    case "captureCount": case "metadataOf": data = declarationInstanceKey(key); break;
    case "callbackSignaturesOf": data = [declarationInstanceKey(key[0]), key[1]]; break;
    case "signatureIdOf": data = [key[0], key[1], key[2], artifactBindingsKey(key[3])]; break;
    case "nodeExists": case "nodeOf": data = sourceReferenceKey(key); break;
    case "localExists": data = [key.body, key.local]; break;
    case "libraryExportExists": case "declaredSiteCount": data = libraryExportKey(key); break;
    case "modulePathOf": case "definitionPathOf": case "tirOf": case "bodyOwner":
    case "bindingScopeOf": case "nominalOf": case "bindingDependentOf": case "definitionExists":
    case "declarationOf": data = key; break;
    default: throw new Error(`Unlisted native context fixture reader: ${name}`);
  }
  return encodeKey([name, data]);
}

function exactLookup(supplied) {
  return (name, key) => {
    const encoded = encodeContextKey([name, key]);
    assert.equal(supplied.has(encoded), true, `unlisted actual context lookup: ${name}`);
    return supplied.get(encoded);
  };
}

function contextFor(input, lookup) {
  return {
    limits: input.context.limits,
    mirVerification: input.context.mirVerification,
    modulePathOf: module => lookup("modulePathOf", module),
    definitionPathOf: definition => lookup("definitionPathOf", definition),
    tirOf: module => lookup("tirOf", module),
    signatureIdOf: (definition, kind, ordinal, bindings) => lookup("signatureIdOf", [definition, kind, ordinal, bindings]),
    facts: {
      limits: input.context.analysisLimits, types: input.index.types, diagnostics: input.index.diagnostics,
      tirBody: instance => lookup("tirBody", instance),
      bodyOwner: body => lookup("bodyOwner", body),
      bindingScopeOf: definition => lookup("bindingScopeOf", definition),
      bindingScopesOf: target => lookup("bindingScopesOf", target),
      nominalOf: definition => lookup("nominalOf", definition),
      bindingDependentOf: definition => lookup("bindingDependentOf", definition),
      captureCount: key => lookup("captureCount", key),
      callbackSignaturesOf: (key, parameter) => lookup("callbackSignaturesOf", [key, parameter]),
      arenaOf: owner => lookup("arenaOf", owner),
      definitionExists: definition => lookup("definitionExists", definition),
      libraryExportExists: identity => lookup("libraryExportExists", identity),
      declaredSiteCount: identity => lookup("declaredSiteCount", identity),
      nodeExists: node => lookup("nodeExists", node),
      localExists: local => lookup("localExists", local),
      metadataOf: key => lookup("metadataOf", key),
    },
  };
}

export function verificationContext(input) {
  const supplied = new Map(input.context.lookups.map(row => [encodeContextKey([row.reader, row.key]), row.value]));
  return contextFor(input, exactLookup(supplied));
}

export function moduleFixture(path = "src/main.ts", root = "/program") {
  const packageId = encodePackageId(root);
  const modulePath = { package: packageId, path };
  const moduleId = encodeModuleId(modulePath);
  const definitionPath = { module: moduleId, segments: [] };
  const definition = encodeDefId(definitionPath);
  const bodyId = encodeBodyId({ owner: definition, role: "module", ordinal: 0 });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const instance = { body: bodyId, bindings: { kind: "parametric" } };
  const origin = { module: moduleId, start: 0, length: 0, derived: [] };
  const loc = { pos: 0, end: 0 };
  const header = { id: 0, origin, parent: null, flags: [], loc };
  const endOfFileToken = { id: 1, origin, parent: 0, flags: [], loc, kind: "EndOfFile", tsonic: null };
  const syntax = {
    ...header, kind: "SourceFile", statements: { loc, nodes: [] }, endOfFileToken,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
  };
  const tree = { ...syntax, tsonic: { module: moduleId, template: { body: bodyId, lexicalBindings: bindings, dependence: "parametric" } } };
  const types = {
    terms: [{ kind: "intrinsic", intrinsic: "void" }],
    signatures: [{ id: 0, declaration: definition, owner: null, composition: null, kind: "call",
      typeParameters: [], receiver: null, parameters: [], result: 0 }],
  };
  const scopes = [{ node: 0, parent: null, attributes: [] }];
  const tir = {
    body: bodyId, owner: definition, bindings: instance.bindings, lexicalBindings: bindings,
    dependence: "parametric", signature: 0, completion: 0, yielded: null, sent: null,
    params: [], locals: [], root: tree, nestedBodies: [], captures: [], scopes, evidence: [],
    asynchronous: false, generator: false,
  };
  const site = { origin, tir: { body: bodyId, node: 0 } };
  const mir = {
    body: bodyId, bindings: instance.bindings, entries: [{ provided: 0, block: 0 }], locals: [], constants: [], places: [],
    blocks: [{ ...site, id: 0, statements: [], terminator: { ...site, kind: "return", value: null } }], result: 0,
  };
  const arena = { projections: [], producers: [], contexts: [], boundProducers: [], origins: [], boundaries: [] };
  const facts = {
    instance, arena, liveness: { stores: [], locals: [], bindings: [], captures: [] }, initialization: { reads: [] },
    refinements: { refinements: [], integers: [], countedLoops: [] },
    origins: { points: [], reads: [], subjects: [], writes: [], escapes: [], invocations: [], callbacks: [],
      activations: [], frontiers: [], constructions: [], instanceRegions: [] },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] },
    observations: [], rawLocations: [], fieldBindings: [], recordBindings: [], memoryBindings: [],
    selectedMemoryDeclarations: [], closedArrays: [],
  };
  const published = { instance, tir, mir, facts };
  const module = { module: moduleId, tree, bodies: [published] };
  const index = {
    schema: 1, rootPackage: packageId,
    packages: [{ id: packageId, name: null, packageRoot: root, sourceRoot: root + "/src", dependencies: [], exports: [] }],
    modules: [{ module: moduleId, package: packageId, items: [{ definition, node: 0 }], exports: [] }],
    types, signatures: [], bodies: [{ instance, module: moduleId, owner: definition, root: 0,
      mirLocalCount: 0, mirConstantCount: 0, mirPlaceCount: 0, mirBlockCount: 1 }],
    metadata: [], summaries: [], constants: [], diagnostics: [],
  };
  const available = value => ({ kind: "available", value });
  const checked = { ...syntax, tsonic: {
    core: { provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false }),
      pointerType: available(null), pointerOperation: available(null), fieldBinding: available(null), recordBinding: available(null),
      attribute: available(null), safety: available(null), argumentPassing: available(null), flowState: available(null) },
    parent: null, attributes: [], memory: available(null), definition, body: bodyId,
  } };
  const source = {
    module: moduleId, tree: checked, items: [{ definition, node: 0 }],
    bodies: [{ body: bodyId, owner: definition, params: [], locals: [], root: checked, captures: [], scopes,
      asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] }], checkerDiagnostics: [], obligations: [],
  };
  const rows = [
    ["modulePathOf", moduleId, modulePath], ["definitionPathOf", definition, definitionPath],
    ["bodyOwner", bodyId, definition], ["bindingScopeOf", definition, scope],
    ["bindingScopesOf", { kind: "body", instance }, []], ["tirBody", instance, tir],
    ["tirBindingScopesOf", { kind: "body", instance }, [scope, scope]],
    ["tirBindingScopesOf", { kind: "module", module: moduleId }, []],
    ["definitionExists", definition, true], ["nominalOf", definition, null], ["bindingDependentOf", definition, false],
    ["arenaOf", { kind: "body", instance }, arena], ["bodyOf", instance, tir],
    ["declarationOf", definition, { scope, parameterCount: 0, endpoints: [] }],
  ];
  for (const node of [checked, endOfFileToken]) {
    const bodyReference = { kind: "body", value: { body: bodyId, node: node.id } };
    const itemReference = { kind: "item", value: { owner: definition, node: node.id } };
    rows.push(["nodeExists", bodyReference, true], ["nodeExists", itemReference, true],
      ["nodeOf", bodyReference, node], ["nodeOf", itemReference, node]);
  }
  const supplied = new Map(rows.map(([reader, key, value]) => [encodeContextKey([reader, key]), value]));
  const lookup = exactLookup(supplied);
  const tirInput = {
    source, module: { module: moduleId, tree, bodies: [tir] }, types,
    bindingScopesOf: target => lookup("tirBindingScopesOf", target),
    declarationOf: definition => lookup("declarationOf", definition),
    memberTableOf: (instance, occurrence) => lookup("memberTableOf", [instance, occurrence]),
    bodyOf: instance => lookup("bodyOf", instance), nominalOf: definition => lookup("nominalOf", definition),
    nodeOf: node => lookup("nodeOf", node), localExists: local => lookup("localExists", local), diagnostics: [],
  };
  supplied.set(encodeContextKey(["tirOf", moduleId]), tirInput);
  const limits = { maximumWork: 10000, maximumCreatedRecords: 10000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 128, maximumVisits: 10000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 } };
  const analysisLimits = { maximumProjectionDepth: 128,
    maximumOriginAlternatives: 128, maximumRelationalRecordsPerBody: 10000, maximumRelationalReferencesPerBody: 10000 };
  return { index, module, context: contextFor({ index, context: { limits, analysisLimits, mirVerification: { maximumWork: 100000 } } }, lookup), tirInput, instance, definition, bodyId, answers: supplied, scope };
}

export function authoredMethodGraph(module) {
  const method = module.tree.statements.nodes[0].members.nodes[0];
  const nested = method.body.statements.nodes[0];
  for (const published of module.bodies) {
    if (published.instance.body === method.tsonic.template.body) published.tir.root = method.body;
    else if (published.instance.body === nested.tsonic.template.body) published.tir.root = nested.body;
    else throw new Error("Unlisted authored method fixture body");
  }
}

export function pairedModuleFixture(root = "/program") {
  const first = moduleFixture("src/main.ts", root);
  const second = moduleFixture("src/other.ts", "/z-dependency");
  first.index.types.signatures.push({ ...second.index.types.signatures[0], id: 1 });
  second.module.bodies[0].tir.signature = 1;
  second.tirInput.types = first.index.types;
  for (const [key, value] of second.answers) first.answers.set(key, value);
  first.index.packages[0].dependencies = [second.index.rootPackage];
  first.index.packages.push(second.index.packages[0]);
  first.index.modules.push(second.index.modules[0]);
  first.index.bodies.push(second.index.bodies[0]);
  return { first, second };
}

export function dualInstanceFixture() {
  const fixture = moduleFixture();
  const bindings = { kind: "instantiated", bindings: {
    classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
  } };
  const instance = { body: fixture.bodyId, bindings };
  const published = structuredClone(fixture.module.bodies[0]);
  published.instance = instance;
  published.tir.bindings = bindings;
  published.mir.bindings = bindings;
  published.facts.instance = instance;
  fixture.module.bodies.push(published);
  fixture.index.bodies.push({ ...fixture.index.bodies[0], instance });
  fixture.tirInput.module.bodies.push(published.tir);
  const rows = [
    ["bodyOf", instance, published.tir], ["tirBody", instance, published.tir],
    ["arenaOf", { kind: "body", instance }, published.facts.arena],
    ["tirBindingScopesOf", { kind: "body", instance }, [fixture.scope, fixture.scope, fixture.scope]],
    ["bindingScopesOf", { kind: "body", instance }, [fixture.scope]],
  ];
  for (const [reader, key, value] of rows) fixture.answers.set(encodeContextKey([reader, key]), value);
  return fixture;
}

export function moduleBoundaryFixture(change) {
  switch (change) {
    case "control": return moduleFixture();
    case "dual-control": return dualInstanceFixture();
    case "chunk-order": {
      const fixture = dualInstanceFixture();
      fixture.module.bodies.reverse();
      return fixture;
    }
    case "template-sharing": {
      const fixture = moduleFixture();
      const tir = fixture.module.bodies[0].tir;
      tir.root = structuredClone(tir.root);
      return fixture;
    }
    case "nested-inventory": {
      const fixture = moduleFixture();
      fixture.module.bodies[0].tir.nestedBodies = [fixture.bodyId];
      return fixture;
    }
    case "instance-node-id": {
      const fixture = dualInstanceFixture();
      fixture.module.bodies[1].tir.root.endOfFileToken.id = 2;
      return fixture;
    }
    case "node-owned-module": {
      const fixture = moduleFixture();
      const module = encodeModuleId({ package: fixture.index.rootPackage, path: "src/other.ts" });
      fixture.index.modules = [{ module, package: fixture.index.rootPackage, items: [], exports: [] }];
      fixture.index.bodies = [];
      fixture.module = { module, bodies: [], tree: { ...fixture.module.tree, id: 1,
        tsonic: { ...fixture.module.tree.tsonic, module },
        endOfFileToken: { ...fixture.module.tree.endOfFileToken, parent: 1 } } };
      fixture.answers.set(encodeContextKey(["tirOf", module]), null);
      return fixture;
    }
    default: throw new Error("Unlisted authored module boundary change");
  }
}

export function metadataOperationFixture(operation, fact, selectedKey, root = "/program") {
  assert.equal(["size", "alignment", "stride"].includes(operation), true, "authored observation operation");
  assert.equal(["present", "absent", "other-node"].includes(fact), true, "authored fact inventory");
  assert.equal(["layout", "data-layout"].includes(selectedKey), true, "authored metadata operand");
  const { first, second } = pairedModuleFixture(root);
  first.index.types.terms.push({ kind: "primitive", primitive: "bool" }, { kind: "primitive", primitive: "uint64" });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const key = { definition: first.definition, bindings: { kind: "instantiated", bindings } };
  const dataKey = { definition: second.definition, bindings: { kind: "parametric" } };
  const metadata = { key, kind: "memory-layout", root: 0, layouts: [{ id: 0,
    occurrence: { kind: "item", value: { owner: first.definition, node: 0 } }, source: 1,
    dataLayout: second.definition, byteSize: 1n, byteAlignment: 1n, stride: 1n, kind: "value", fields: [] }], fields: [] };
  const data = { key: dataKey, kind: "data-layout", occurrence: { kind: "item", value: { owner: second.definition, node: 0 } },
    fingerprint: "native64-le", byteOrder: "little", addressWidth: 64 };
  first.index.metadata = [metadata, data];
  const published = first.module.bodies[0];
  const site = { origin: first.module.tree.origin, tir: { body: first.bodyId, node: 0 } };
  published.mir.locals = [{ id: 0, storage: 2, role: { kind: "temporary" }, mode: "local", source: null, origin: site.origin }];
  published.mir.places = [{ id: 0, base: { kind: "local", local: 0 }, storage: 2, origin: site.origin }];
  const operandKey = selectedKey === "layout" ? key : dataKey;
  published.mir.constants = [{ id: 0, type: 2, value: { kind: "metadata", ...operandKey } }];
  published.mir.blocks[0].statements = [
    { ...site, kind: "storage-live", local: 0 },
    { ...site, kind: "assign", place: 0, value: { kind: "use", operand: { kind: "constant", constant: 0 } }, step: null },
    { ...site, kind: "storage-dead", local: 0 },
  ];
  first.index.bodies[0].mirLocalCount = 1;
  first.index.bodies[0].mirConstantCount = 1;
  first.index.bodies[0].mirPlaceCount = 1;
  published.facts.arena.contexts.push({ id: 0, receiver: null, arguments: [], captures: [] });
  published.facts.liveness.locals.push({ local: 0, segments: [{ block: 0, first: 0, last: 2 }] });
  published.facts.liveness.stores.push({ node: 0, point: { block: 0, statement: 1 }, observed: false });
  if (fact !== "absent") published.facts.observations.push({ node: fact === "other-node" ? 1 : 0,
    operation, operand: { body: first.bodyId, node: 0 }, layout: { metadata: key, layout: 0 }, field: null,
    result: 2, value: 1n, context: 0, bindings });
  first.answers.set(encodeContextKey(["metadataOf", key]), metadata);
  first.answers.set(encodeContextKey(["metadataOf", dataKey]), data);
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "metadata", metadata: key }]), [first.scope]);
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "metadata", metadata: dataKey }]), []);
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: first.instance }]),
    fact === "absent" ? [] : [first.scope, first.scope]);
  return { first, second, metadata, data };
}

export function repeatedMetadataFixture(uses, ownerSize, fact = "present") {
  assert.equal(Number.isSafeInteger(uses) && uses > 0, true, "authored positive metadata operand count");
  assert.equal(Number.isSafeInteger(ownerSize) && ownerSize >= 0, true, "authored canonical owner length");
  const root = ownerSize === 0 ? "/program" : "/program/" + "p".repeat(ownerSize);
  const fixture = metadataOperationFixture("size", fact, "layout", root);
  const type = fixture.first.index.types.terms.length;
  fixture.first.index.types.terms.push({ kind: "array", element: 2, readonly: false });
  const mir = fixture.first.module.bodies[0].mir;
  mir.locals[0].storage = type;
  mir.places[0].storage = type;
  mir.blocks[0].statements[1].value = { kind: "aggregate", type,
    aggregate: { kind: "array", elements: Array.from({ length: uses }, () => ({ kind: "constant", constant: 0 })) } };
  return fixture;
}

export function publishedArtifactFixture(change) {
  const fixture = metadataOperationFixture("size", "present", "layout");
  const { first, second } = fixture;
  const bindings = { kind: "instantiated", bindings: {
    classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
  } };
  for (const [signature, module] of [first, second].entries()) {
    const key = { definition: module.definition, bindings };
    const arena = { projections: [], producers: [], contexts: [], boundProducers: [],
      origins: [{ id: 0, producers: [], includesAbsence: false, kind: "complete" }], boundaries: [] };
    first.index.summaries.push({ key, signature, arena, parameters: [], captures: [], result: 0, thrown: 0,
      writes: [], retention: [], callbacks: [], invocationOnlyParameters: [], suspends: false, bindingDependent: false });
    first.answers.set(encodeContextKey(["arenaOf", { kind: "summary", ...key }]), arena);
    first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "summary", summary: key }]), [module.scope]);
    first.answers.set(encodeContextKey(["captureCount", key]), module.module.bodies[0].tir.captures.length);
    first.index.constants.push({ reference: { initializer: module.instance, context: "compile-time" }, value: { kind: "absence", type: 0 } });
  }
  switch (change) {
    case "none": break;
    case "metadata-duplicate": first.index.metadata.splice(1, 0, first.index.metadata[0]); break;
    case "metadata-order": first.index.metadata.reverse(); break;
    case "summary-duplicate": first.index.summaries.splice(1, 0, first.index.summaries[0]); break;
    case "summary-order": first.index.summaries.reverse(); break;
    case "constant-duplicate": first.index.constants.splice(1, 0, first.index.constants[0]); break;
    case "constant-order": first.index.constants.reverse(); break;
    case "constant-type": first.index.constants[0].value.type = 3; break;
    case "metadata-stride": fixture.metadata.layouts[0].stride = 0n; break;
    case "summary-result": first.index.summaries[0].result = 1; break;
    case "summary-owner": first.index.summaries[0].signature = 1; break;
    default: throw new Error("Unlisted authored artifact inventory change");
  }
  return fixture;
}

export function metadataFieldFixture(operandKey) {
  assert.equal(["layout", "field", "data-layout"].includes(operandKey), true, "authored field-offset operand key");
  const fixture = metadataOperationFixture("size", "absent", "layout");
  const { first, second, metadata, data } = fixture;
  const third = moduleFixture("src/field.ts", "/zz-field");
  first.index.types.signatures.push({ ...third.index.types.signatures[0], id: 2 });
  third.module.bodies[0].tir.signature = 2;
  third.tirInput.types = first.index.types;
  for (const [key, value] of third.answers) first.answers.set(key, value);
  first.index.packages.push(third.index.packages[0]);
  first.index.modules.push(third.index.modules[0]);
  first.index.bodies.push(third.index.bodies[0]);
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const fieldKey = { definition: third.definition, bindings: { kind: "instantiated", bindings } };
  const key = { kind: "text", value: "field" };
  const occurrence = { kind: "item", value: { owner: third.definition, node: 0 } };
  const origin = { kind: "mapped", owner: { kind: "item", value: { owner: first.definition, node: 0 } }, key };
  first.index.types.terms.push({ kind: "shape", members: [{ key, origins: [origin], readOrigins: [origin],
    writeOrigins: [origin], kind: "property", read: 1, write: 1, optional: false, readonly: false }],
  indexes: [], calls: [], constructs: [] });
  const member = { decision: { key, origins: [origin], selectedDeclarations: [], primary: null,
    read: 1, write: 1, getter: null, setter: null, bindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
  const field = { id: 0, occurrence, owner: 3, selector: occurrence, selection: occurrence, member,
    primary: null, selectedDeclarations: [], value: 1, layout: 0, byteOffset: 0n, byteAlignment: 1n };
  metadata.root = 1;
  metadata.layouts.push({ id: 1, occurrence: { kind: "item", value: { owner: first.definition, node: 0 } },
    source: 3, dataLayout: second.definition, byteSize: 1n, byteAlignment: 1n, stride: 1n,
    kind: "value", fields: [0] });
  metadata.fields.push(field);
  const selected = { key: fieldKey, kind: "memory-field", root: 0, layouts: metadata.layouts, fields: metadata.fields };
  first.index.metadata.push(selected);
  first.answers.set(encodeContextKey(["metadataOf", fieldKey]), selected);
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "metadata", metadata: metadata.key }]), [first.scope, third.scope]);
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "metadata", metadata: fieldKey }]), [third.scope, third.scope]);
  const published = first.module.bodies[0];
  published.facts.observations.push({ node: 0, operation: "field-offset", operand: { body: first.bodyId, node: 0 },
    layout: { metadata: metadata.key, layout: 1 }, field: { metadata: fieldKey, field: 0 },
    result: 2, value: 0n, context: 0, bindings });
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: first.instance }]), [first.scope, third.scope, first.scope]);
  const selectedKey = operandKey === "layout" ? metadata.key : operandKey === "field" ? fieldKey : data.key;
  published.mir.constants[0].value = { kind: "metadata", ...selectedKey };
  return { first, second, third, fieldKey };
}

export function metadataBindingFixture(proof, operandKey) {
  assert.equal(["field", "record", "unlinked"].includes(proof), true, "authored binding proof");
  const fixture = metadataFieldFixture(operandKey);
  const { first, third, fieldKey } = fixture;
  const published = first.module.bodies[0];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const reference = node => ({ body: first.bodyId, node });
  const fieldNode = proof === "field" ? 0 : 1;
  published.facts.observations = [];
  published.facts.fieldBindings = [{ node: fieldNode, result: 2, owner: 3,
    fieldExpression: reference(fieldNode), field: { metadata: fieldKey, field: 0 },
    pointer: reference(fieldNode), pointee: 1, context: 0, bindings }];
  const scopes = [third.scope, third.scope];
  if (proof === "record") {
    published.facts.recordBindings = [{ node: 0, result: 3, layoutExpression: reference(0),
      layout: { metadata: first.index.metadata[0].key, layout: 1 }, context: 0, bindings,
      fields: [{ expression: reference(1), binding: 1 }] }];
    scopes.push(first.scope, first.scope);
  }
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: first.instance }]), scopes);
  return fixture;
}

export function callerSyntaxCycle() {
  const fixture = moduleFixture();
  const original = fixture.module.tree;
  const common = { origin: original.origin, parent: 0, flags: [], loc: original.loc };
  const leaf = { ...common, id: 4, kind: "Identifier", text: "x", tsonic: { role: "type-name", type: 0, declarations: [] } };
  const operatorToken = { ...common, id: 5, kind: "PlusToken", tsonic: null };
  const expression = {
    ...common, id: 2, kind: "BinaryExpression", modifiers: null, left: leaf, type: null, operatorToken, right: leaf,
    tsonic: { type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null,
      demand: { kind: "always" }, role: "sequence" },
  };
  expression.left = expression;
  const statement = { ...common, id: 3, kind: "ExpressionStatement", expression, tsonic: null };
  const tree = { ...original, statements: { loc: original.loc, nodes: [statement] } };
  const module = { ...fixture.module, tree, bodies: fixture.module.bodies.map(body => ({ ...body, tir: { ...body.tir, root: tree } })) };
  return { index: fixture.index, module, context: fixture.context };
}

export function callerComponentCycle() {
  const fixture = moduleFixture();
  const tree = fixture.module.tree;
  const common = { origin: tree.origin, flags: [], loc: tree.loc };
  const root = { kind: "body", value: { body: fixture.bodyId, node: 2 } };
  const component = { root, path: [] };
  const family = { origin: "authored", component, parameters: [], roles: [{ authoredIndex: 0, component: root, member: 1 }] };
  component.path.push({ kind: "sum-arm", family, index: 0 });
  const proof = { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 };
  const expression = { ...common, id: 2, parent: 1, kind: "StringLiteral", text: "leaf", tokenFlags: [],
    tsonic: { type: 1, convertedType: 1, conversion: { kind: "identity" },
      narrowing: { kind: "narrowed", source: 1, result: 1, proof, failure: "unwind" }, evidenceIndex: null,
      demand: { kind: "always" }, role: "value", value: "leaf" } };
  tree.statements = { loc: tree.loc, nodes: [{ ...common, id: 1, parent: 0,
    kind: "ExpressionStatement", expression, tsonic: null }] };
  tree.endOfFileToken.id = 3;
  fixture.index.types.terms.push({ kind: "string" });
  return { ...fixture, component };
}
