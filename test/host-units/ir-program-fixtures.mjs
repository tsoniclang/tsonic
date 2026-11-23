import { createAccount } from "../../packages/host/dist/dataflow/index.js";
import { conditionRefusal } from "./fixtures/facts-verification.mjs";
import { createProgramVerificationWork } from "../../packages/host/dist/ir-program/index.js";
import assert from "node:assert/strict";
import { encodeBodyId, encodeDefId, encodeKey, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import { bindingTargetKey, declarationInstanceKey, libraryExportKey,
  relationalOwnerKey, sourceReferenceKey } from "./fixtures/verification-keys.mjs";

import { artifactBindingsData, instanceKey, nativeFactsKey } from "../../packages/host/dist/ir-types/index.js";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";
const selectedNativeFacts = nativeFactsFixture();
const selectedNativeFactsKey = nativeFactsKey(selectedNativeFacts);
import { summaryKey } from "../../packages/host/dist/ir-facts/index.js";

export function encodeContextKey([name, key]) {
  let data;
  switch (name) {
    case "bodyOf": case "tirBody": case "mirBody": case "requiredEntriesOf": data = instanceKey(key); break;
    case "sourceBindingScopesOf": data = bindingTargetKey(key); break;
    case "tirBindingScopesOf": data = key.kind === "module" ? [key.kind, key.module]
      : [key.kind, instanceKey(key.instance)]; break;
    case "arenaOf": data = relationalOwnerKey(key); break;
    case "captureCount": data = summaryKey(key); break;
    case "metadataOf": data = declarationInstanceKey(key); break;
    case "callbackSignaturesOf": data = [summaryKey(key[0]), key[1]]; break;
    case "signatureIdOf": data = [key[0], key[1], key[2], artifactBindingsData(key[3])]; break;
    case "nodeExists": case "nodeOf": data = sourceReferenceKey(key); break;
    case "localExists": data = [key.body, key.local]; break;
    case "libraryExportExists": case "declaredSiteCount": data = libraryExportKey(key); break;
    case "modulePathOf": case "definitionPathOf": case "tirOf": case "bodyOwner":
    case "bindingScopeOf": case "nominalOf": case "bindingDependentOf": case "definitionExists":
    case "declarationOf": case "declarationSourceOf": data = key; break;
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
    initialization: input.context.initialization,
    nativeFactsKey: input.context.nativeFactsKey,
    selectedNativeFacts: input.context.selectedNativeFacts,
    resources: createProgramVerificationWork({ maximumCreatedRecords: input.context.limits.maximumCreatedRecords, maximumBindingVectorsPerArtifact: input.context.limits.maximumBindingVectorsPerArtifact, typeExpansion: input.context.limits.typeExpansion }, createAccount({ maximumWork: input.context.limits.maximumWork, maximumResultEntries: 1000000000 })),
    conditionRefusal,
    mirVerification: input.context.mirVerification,
    modulePathOf: module => lookup("modulePathOf", module),
    definitionPathOf: definition => lookup("definitionPathOf", definition),
    tirOf: module => lookup("tirOf", module),
    signatureIdOf: (definition, kind, ordinal, bindings) => lookup("signatureIdOf", [definition, kind, ordinal, bindings]),
    facts: {
      limits: input.context.analysisLimits, types: input.index.types, diagnostics: input.index.diagnostics,
      tirBody: instance => lookup("tirBody", instance),
      mirBody: instance => lookup("mirBody", instance),
      bodyOwner: body => lookup("bodyOwner", body),
      signatureIdOf: request => lookup("signatureIdOf", [request.definition, request.endpoint, request.ordinal, request.bindings]),
      declarationSourceOf: definition => lookup("declarationSourceOf", definition),
      bindingScopeOf: definition => lookup("bindingScopeOf", definition),
      sourceBindingScopesOf: target => lookup("sourceBindingScopesOf", target),
      nominalOf: definition => lookup("nominalOf", definition),
      bindingDependentOf: definition => lookup("bindingDependentOf", definition),
      captureCount: key => lookup("captureCount", key),
      callbackSignaturesOf: (key, parameter) => lookup("callbackSignaturesOf", [key, parameter]),
      summaryOf: key => input.index.summaries.find(row => summaryKey(row.key) === summaryKey(key)) ?? null,
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

export function moduleFixture(path = "src/main.ts", root = "/program", instanceBindings = { kind: "parametric" }, maximumWork = 10000) {
  const packageId = encodePackageId(root);
  const modulePath = { package: packageId, path };
  const moduleId = encodeModuleId(modulePath);
  const definitionPath = { module: moduleId, segments: [] };
  const definition = encodeDefId(definitionPath);
  const bodyId = encodeBodyId({ owner: definition, role: "module", ordinal: 0 });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const instance = { body: bodyId, bindings: instanceBindings };
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
  const arena = { cells: [], projections: [], producers: [], contexts: [], boundProducers: [], origins: [], boundaries: [] };
  const facts = {
    execution: { instance, provided: 0 }, arena, liveness: { stores: [], locals: [], bindings: [], captures: [] }, initialization: { reads: [] },
    refinements: { refinements: [], integers: [], countedLoops: [] },
    origins: { points: [], reads: [], subjects: [], writes: [], escapes: [], invocations: [], callbacks: [],
      activations: [], frontiers: [], constructions: [], instanceRegions: [], exitContents: { onReturn: [], onUnwind: [] } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] },
    rawLocations: [], fieldBindings: [], recordBindings: [], memoryBindings: [],
    selectedMemoryDeclarations: [], closedArrays: [],
  };
  const published = { kind: "selected", instance, tir, mir, observations: { instance, rows: [] }, facts: [facts] };
  const chapter = { kind: "ready-root", root: tree };
  const module = { module: moduleId, tree: chapter, bodies: [published] };
  const index = {
    schema: 1, nativeFactsKey: selectedNativeFactsKey, rootPackage: packageId,
    packages: [{ id: packageId, name: null, packageRoot: root, sourceRoot: root + "/src", dependencies: [], exports: [] }],
    modules: [{ module: moduleId, package: packageId, items: [{ definition, node: 0 }], exports: [], bindings: [], checkerDiagnostics: [] }],
    types, signatures: [], bodies: [{ kind: "selected", instance, module: moduleId, owner: definition, root: 0,
      mirLocalCount: 0, mirConstantCount: 0, mirPlaceCount: 0, mirBlockCount: 1 }],
    dependencyInventory: { operations: [{ kind: "body", execution: { instance, provided: 0 } }], dependencies: [],
      components: [{ kind: "body", members: [0], rows: [], dependencies: [] }] },
    metadata: [], summaries: [], constants: [], diagnostics: [],
    initialization: { entry: moduleId, external: [], modules: [{ instance, provided: 0 }], entries: [] },
  };
  const available = value => ({ kind: "available", value });
  const checked = { ...syntax, statements: { loc, nodes: [] }, tsonic: {
    core: { provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false, application: available(null) }),
      pointerType: available(null), pointerOperation: available(null), fieldBinding: available(null), recordBinding: available(null),
      attribute: available(null), safety: available(null), argumentPassing: available(null), flowState: available(null) },
    parent: null, attributes: [], memory: available(null), definition, body: bodyId,
  } };
  const source = {
    module: moduleId, tree: checked, items: [{ definition, node: 0 }],
    bodies: [{ body: bodyId, owner: definition, params: [], locals: [], root: checked, captures: [], scopes,
      asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] }], exports: [], bindings: [], moduleLinks: [], checkerDiagnostics: [], obligations: [],
  };
  const rows = [
    ["requiredEntriesOf", instance, [0]],
    ["modulePathOf", moduleId, modulePath], ["definitionPathOf", definition, definitionPath],
    ["bodyOwner", bodyId, definition], ["bindingScopeOf", definition, scope],
    ["sourceBindingScopesOf", { kind: "body", execution: { instance, provided: 0 } }, []], ["tirBody", instance, tir], ["mirBody", instance, mir],
    ["tirBindingScopesOf", { kind: "body", instance }, [scope, scope]],
    ["tirBindingScopesOf", { kind: "module", module: moduleId }, []],
    ["declarationSourceOf", definition, { kind: "item", value: { owner: definition, node: 0 } }],
    ["sourceBindingScopesOf", { kind: "observations", instance }, []],
    ["definitionExists", definition, true], ["nominalOf", definition, null], ["bindingDependentOf", definition, false],
    ["arenaOf", { kind: "body", execution: { instance, provided: 0 } }, arena], ["bodyOf", instance, tir],
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
    source, module: { module: moduleId, tree: chapter, bodies: [tir] }, types,
    requiredEntriesOf: instance => lookup("requiredEntriesOf", instance),
    bindingScopesOf: target => ({ kind: "complete", scopes: lookup("tirBindingScopesOf", target) }),
    declarationOf: definition => lookup("declarationOf", definition),
    declarationSourceOf: definition => {
      const entry = source.items.find(item => item.definition === definition);
      return entry === undefined ? null : { kind: "item", value: { owner: entry.definition, node: entry.node } };
    },
    staticStorageOf: declaration => lookup("staticStorageOf", declaration),
    memberTableOf: (instance, occurrence) => lookup("memberTableOf", [instance, occurrence]),
    bodyOf: instance => lookup("bodyOf", instance), nominalOf: definition => lookup("nominalOf", definition),
    nodeOf: node => lookup("nodeOf", node), localExists: local => lookup("localExists", local), diagnostics: [],
  };
  supplied.set(encodeContextKey(["tirOf", moduleId]), tirInput);
  const limits = { maximumWork, maximumCreatedRecords: 10000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 128, maximumVisits: 10000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 } };
  const analysisLimits = { maximumProjectionDepth: 128,
    maximumOriginAlternatives: 128, maximumConditionAlternatives: 128, maximumRelationalRecordsPerBody: 10000, maximumRelationalReferencesPerBody: 10000 };
  return { index, module, context: contextFor({ index, context: { limits, analysisLimits, nativeFactsKey: index.nativeFactsKey, selectedNativeFacts, mirVerification: { maximumWork: 100000 },
    initialization: structuredClone(index.initialization) } }, lookup), tirInput, instance, definition, bodyId, answers: supplied, scope };
}

export function authoredMethodGraph(module) {
  const method = module.tree.root.statements.nodes[0].node.members.nodes[0];
  const nested = method.body.statements.nodes[0];
  for (const published of module.bodies) {
    if (published.instance.body === method.tsonic.template.body) published.tir.root = method.body;
    else if (published.instance.body === nested.tsonic.template.body) published.tir.root = nested.body;
    else throw new Error("Unlisted authored method fixture body");
  }
}

export function pairedModuleFixture(root = "/program", instanceBindings) {
  const first = moduleFixture("src/main.ts", root, instanceBindings);
  const second = moduleFixture("src/other.ts", "/z-dependency", instanceBindings);
  return joinModuleFixtures(first, second);
}

export function joinModuleFixtures(first, second) {
  first.index.packages[0].dependencies = [second.index.rootPackage];
  appendModuleFixture(first, second);
  return { first, second };
}

export function appendModuleFixture(owner, added) {
  const signature = owner.index.types.signatures.length;
  owner.index.types.signatures.push({ ...added.index.types.signatures[0], id: signature });
  for (const body of added.module.bodies) body.tir.signature = signature;
  for (const summary of added.index.summaries) summary.signature = signature;
  added.tirInput.types = owner.index.types;
  for (const [key, value] of added.answers) owner.answers.set(key, value);
  owner.index.packages.push(added.index.packages[0]);
  owner.index.modules.push(added.index.modules[0]);
  owner.index.bodies.push(...added.index.bodies);
  owner.index.summaries.push(...added.index.summaries);
  owner.index.summaries.sort((left, right) => summaryKey(left.key) < summaryKey(right.key) ? -1 : 1);
  const inventory = owner.index.dependencyInventory;
  const position = inventory.operations.length;
  inventory.operations.push(added.index.dependencyInventory.operations[0]);
  inventory.components.push({ kind: "body", members: [position], rows: [], dependencies: [] });
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
  published.facts[0].execution.instance = instance;
  published.observations.instance = instance;
  fixture.index.dependencyInventory.operations.push({ kind: "body", execution: { instance, provided: 0 } });
  fixture.index.dependencyInventory.components.push({ kind: "body", members: [1], rows: [], dependencies: [] });
  fixture.module.bodies.push(published);
  fixture.index.bodies.push({ ...fixture.index.bodies[0], instance });
  fixture.tirInput.module.bodies.push(published.tir);
  const rows = [
    ["bodyOf", instance, published.tir], ["tirBody", instance, published.tir],
    ["requiredEntriesOf", instance, [0]],
    ["arenaOf", { kind: "body", execution: { instance, provided: 0 } }, published.facts[0].arena],
    ["tirBindingScopesOf", { kind: "body", instance }, [fixture.scope, fixture.scope, fixture.scope]],
    ["sourceBindingScopesOf", { kind: "body", execution: { instance, provided: 0 } }, [fixture.scope]],
    ["sourceBindingScopesOf", { kind: "observations", instance }, [fixture.scope]],
  ];
  for (const [reader, key, value] of rows) fixture.answers.set(encodeContextKey([reader, key]), value);
  return fixture;
}

export function moduleBoundaryFixture(change, fixture) {
  switch (change) {
    case "control":
      fixture.module.bodies = [fixture.template];
      fixture.tirInput.module.bodies = [fixture.template.tir];
      fixture.index.bodies = fixture.index.bodies.filter(body => body.kind === "template");
      fixture.index.dependencyInventory = { operations: [], dependencies: [], components: [] };
      fixture.index.summaries = [];
      fixture.index.initialization = { ...fixture.index.initialization, modules: [] };
      fixture.context.initialization = structuredClone(fixture.index.initialization);
      return fixture;
    case "dual-control": return fixture;
    case "chunk-order":
      fixture.module.bodies.reverse();
      return fixture;
    case "template-sharing": {
      const { tir } = fixture.template;
      tir.root = structuredClone(tir.root);
      return fixture;
    }
    case "nested-inventory":
      fixture.template.tir.nestedBodies = [fixture.bodyId];
      return fixture;
    case "instance-node-id": {
      const { tir } = fixture.selected;
      tir.root = { ...tir.root, endOfFileToken: { ...tir.root.endOfFileToken, id: 2 } };
      return fixture;
    }
    case "node-owned-module": {
      const module = encodeModuleId({ package: fixture.index.rootPackage, path: "src/other.ts" });
      fixture.index.modules = [{ module, package: fixture.index.rootPackage, items: [], exports: [], bindings: [], checkerDiagnostics: [] }];
      fixture.index.bodies = [];
      const original = fixture.module.tree.root;
      const root = { ...original, id: 1, tsonic: { ...original.tsonic, module },
        endOfFileToken: { ...original.endOfFileToken, parent: 1 } };
      fixture.module = { module, bodies: [], tree: { kind: "ready-root", root } };
      fixture.answers.set(encodeContextKey(["tirOf", module]), null);
      return fixture;
    }
    default: throw new Error("Unlisted authored module boundary change");
  }
}

export function callerSyntaxCycle() {
  const fixture = moduleFixture();
  const original = fixture.module.tree.root;
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
  const root = { ...original, statements: { loc: original.loc, nodes: [{ kind: "ready-statement", node: statement }] } };
  const module = { ...fixture.module, tree: { kind: "ready-root", root },
    bodies: fixture.module.bodies.map(body => ({ ...body, tir: { ...body.tir, root } })) };
  return { index: fixture.index, module, context: fixture.context };
}

export function callerComponentCycle() {
  const fixture = moduleFixture();
  const tree = fixture.module.tree.root;
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
  tree.statements = { loc: tree.loc, nodes: [{ kind: "ready-statement", node: { ...common, id: 1, parent: 0,
    kind: "ExpressionStatement", expression, tsonic: null } }] };
  tree.endOfFileToken.id = 3;
  fixture.index.types.terms.push({ kind: "string" });
  return { ...fixture, component };
}
