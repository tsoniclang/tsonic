import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspect, isDeepStrictEqual } from "node:util";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { compareCaseValues } from "../host-cases/compare.mjs";
import { syntaxConstructorInputs } from "./fixtures/hir-syntax.mjs";
import { syntaxFieldMutations } from "./fixtures/syntax-field-mutations.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources, readImportGraph } from "../architecture/host/import-graph.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const productNames = ["index", "print", "parse", "text-layouts", "text-construction", "text-syntax-construction", "text-model", "text-body", "text-phase-values",
  "text-phase-declarations", "text-type-values", "text-rule-decisions", "text-rule-inputs", "text-captures", "text-memory",
  "text-syntax-values", "text-syntax-statements", "text-syntax-types", "text-syntax-jsx", "text-syntax-docs",
  "verify", "verify-occurrences", "verify-applications", "verify-instances", "selection-key", "syntax-compare", "syntax-compare-common",
  "syntax-compare-values", "syntax-compare-statements", "syntax-compare-types", "syntax-compare-jsx", "syntax-compare-docs"];
const sourceFiles = ["contract", ...productNames].map(name => `packages/host/src/ir-tir/${name}.ts`);
const runtimeFiles = productNames.map(name => resolve(repository, `packages/host/dist/ir-tir/${name}.js`));
const areas = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8"));
const roots = areas.areas.map(area => area.directory);
const functionDirectory = "test/host-cases/ir-tir/function";
const functionCases = readdirSync(resolve(repository, functionDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${functionDirectory}/${name}`);
const verifierDirectory = "test/host-cases/ir-tir/verifier";
const verifierCases = readdirSync(resolve(repository, verifierDirectory)).filter(name => name.endsWith(".case.json")).sort()
  .map(name => `${verifierDirectory}/${name}`);
const profiler = new Session();
const post = (method, parameters = {}) => new Promise((accept, reject) => {
  profiler.post(method, parameters, (error, result) => error === null ? accept(result) : reject(error));
});
let product;
let sameSyntaxFields;

function writeValueEvidence(path, root) {
  const output = openSync(path, "wx");
  const options = { depth: 0, maxArrayLength: null, maxStringLength: null, breakLength: Infinity,
    compact: true, colors: false, showHidden: true, customInspect: false, getters: false };
  let buffer = "";
  const append = text => {
    buffer += text;
    if (buffer.length >= 65536) { writeFileSync(output, buffer); buffer = ""; }
  };
  try {
    if (root === null || typeof root !== "object") append(`${inspect(root, options)}\n`);
    else {
      const values = [root];
      const identities = new Map([[root, 0]]);
      for (let position = 0; position < values.length; position++) {
        const value = values[position];
        append(`Object #${position} = ${inspect(value, options)}\n`);
        const properties = Object.getOwnPropertyDescriptors(value);
        for (const key of Reflect.ownKeys(properties)) {
          const property = properties[key];
          if (!Object.hasOwn(property, "value")) continue;
          const child = property.value;
          if (child === null || typeof child !== "object") continue;
          let target = identities.get(child);
          if (target === undefined) {
            target = values.length;
            identities.set(child, target);
            values.push(child);
          }
          append(`  #${position}[${inspect(key, options)}] -> Object #${target}\n`);
        }
      }
    }
    if (buffer.length !== 0) writeFileSync(output, buffer);
  } finally { closeSync(output); }
}

function assertCompleteValue(actual, expected, message = "complete value comparison", compare = isDeepStrictEqual) {
  if (compare(actual, expected) === true) return;
  const admission = JSON.parse(process.env.TSONIC_TEST_ADMISSION);
  const evidence = resolve(repository, ".temp/test-runs", admission.unit);
  mkdirSync(evidence, { recursive: true });
  const directory = mkdtempSync(resolve(evidence, "ir-tir-comparison-"));
  const actualPath = resolve(directory, "actual.txt");
  const expectedPath = resolve(directory, "expected.txt");
  writeValueEvidence(actualPath, actual);
  writeValueEvidence(expectedPath, expected);
  assert.fail(`${String(message).slice(0, 180)}; complete actual: ${actualPath}; complete expected: ${expectedPath}`);
}

const sameWire = (actual, expected) => actual === expected;

function assertInvalidText(text, offset, expected, found) {
  const lines = text.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected, found });
}

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the entire bank requires bounded aggregate admission");
  profiler.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/ir-tir/index.js");
  ({ sameSyntaxFields } = await import("../../packages/host/dist/ir-tir/syntax-compare.js"));
});

const moduleId = "M[P[p];m]";
const ownerId = "D[M[P[p];m]]";
const bodyId = "B[D[M[P[p];m]];module;0]";
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const origin = (start = 0, length = 0) => ({ module: moduleId, start, length, derived: [] });
const header = (id, parent = null) => ({ id, origin: origin(), parent, flags: [], loc: { pos: 0, end: 0 } });
const nodeList = (nodes = []) => ({ loc: { pos: 0, end: 0 }, nodes });

function emptyModuleBody() {
  const end = { ...header(1, 0), kind: "EndOfFile", tsonic: null };
  const root = { ...header(0), kind: "SourceFile", statements: nodeList(), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { module: moduleId, template: { body: bodyId, lexicalBindings: emptyBindings(), dependence: "parametric" } } };
  return { body: bodyId, owner: ownerId, bindings: { kind: "parametric" }, lexicalBindings: emptyBindings(),
    dependence: "parametric", signature: 0, completion: 0, yielded: null, sent: null, params: [], locals: [], root,
    nestedBodies: [], captures: [], scopes: [], evidence: [], asynchronous: false, generator: false };
}

function typeEvidence(category) {
  return { type: 0, component: { kind: "body", value: { body: bodyId, node: 0 } }, category,
    numeric: null, sum: null, nominal: null, pointer: null };
}

const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const available = value => ({ kind: "available", value });
const emptyCore = () => ({ provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false }),
  pointerType: available(null), pointerOperation: available(null), fieldBinding: available(null), recordBinding: available(null),
  attribute: available(null), safety: available(null), argumentPassing: available(null), flowState: available(null) });

const bodyScopeReader = (body, scopes) => {
  const instance = structuredClone({ body: body.body, bindings: body.bindings });
  return target => target.kind === "body" && isDeepStrictEqual(target.instance, instance) ? scopes : null;
};
const replaceScopeInventory = (input, scopes) => {
  const knownTarget = input.bindingScopesOf;
  input.bindingScopesOf = target => knownTarget(target) === null ? null : scopes;
};
const bodyScopes = (input, body) => {
  const scopes = input.bindingScopesOf({ kind: "body", instance: { body: body.body, bindings: body.bindings } });
  assert.equal(Array.isArray(scopes), true, "the authored fixture has an actual scope inventory for this complete instance");
  return scopes;
};

function emptyVerificationInput(body, authoredNodes = [], scopeCount = 2) {
  const end = { ...header(1, 0), kind: "EndOfFile", tsonic: null };
  const root = { ...header(0), kind: "SourceFile", statements: nodeList(), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null), definition: ownerId, body: bodyId } };
  const original = { body: bodyId, owner: ownerId, params: [], locals: [], root, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  const source = { module: moduleId, tree: root, items: [{ definition: ownerId, node: 0 }], bodies: [original],
    checkerDiagnostics: [], obligations: [] };
  const module = { module: moduleId, tree: body.root, bodies: [body] };
  const types = { terms: [{ kind: "intrinsic", intrinsic: "unknown" }], signatures: [{ id: 0, declaration: ownerId,
    owner: { kind: "body", value: { body: bodyId, node: 0 } }, composition: null, kind: "call", typeParameters: [],
    receiver: null, parameters: [], result: 0 }] };
  const declarations = new Map([[ownerId, { scope: emptyScope(), parameterCount: 0, endpoints: [] }]]);
  const originalNodes = new Map([[0, root], [1, end], ...authoredNodes.map(node => [node.id, node])]);
  return { source, module, types, bindingScopesOf: bodyScopeReader(body, Array.from({ length: scopeCount }, emptyScope)),
    declarationOf: definition => declarations.get(definition) ?? null,
    memberTableOf: () => { throw new Error("unexpected member-table lookup"); },
    bodyOf: instance => {
      for (const actual of module.bodies) if (actual.body === instance.body && compareCaseValues(actual.bindings, instance.bindings)) return actual;
      return null;
    },
    nominalOf: () => null,
    nodeOf: reference => reference.kind === "body" ? reference.value.body === bodyId ? originalNodes.get(reference.value.node) ?? null : null
      : reference.value.owner === ownerId ? originalNodes.get(reference.value.node) ?? null : null,
    localExists: reference => reference.body === bodyId && original.locals[reference.local] !== undefined, diagnostics: [] };
}

function bodylessModuleScenario() {
  const definition = "D[M[P[p];m];Alias]";
  const declaration = { kind: "definition", definition };
  const name = { ...header(2, 1), kind: "Identifier", text: "Alias",
    tsonic: { role: "declaration-name", declaration, storage: null } };
  const keyword = { ...header(3, 1), kind: "StringKeyword", tsonic: { type: 0, declarations: [] } };
  const alias = { ...header(1, 0), kind: "TypeAliasDeclaration", modifiers: null, name, typeParameters: null, type: keyword,
    tsonic: { definition, parameters: [], type: 0 } };
  const end = { ...header(4, 0), kind: "EndOfFile", tsonic: null };
  const tree = { ...header(0), kind: "SourceFile", statements: nodeList([alias]), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { module: moduleId, template: null } };
  const sourceName = { ...header(2, 1), kind: "Identifier", text: "Alias",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const sourceKeyword = { ...header(3, 1), kind: "StringKeyword",
    tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const sourceAlias = { ...header(1, 0), kind: "TypeAliasDeclaration", modifiers: null, name: sourceName,
    typeParameters: null, type: sourceKeyword, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, parameters: [], type: available(0) } };
  const sourceEnd = { ...header(4, 0), kind: "EndOfFile", tsonic: null };
  const sourceTree = { ...header(0), kind: "SourceFile", statements: nodeList([sourceAlias]), endOfFileToken: sourceEnd,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null), definition: ownerId, body: bodyId } };
  const source = { module: moduleId, tree: sourceTree,
    bodies: [{ body: bodyId, owner: ownerId, params: [], locals: [], root: sourceTree, captures: [], scopes: [],
      asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] }], checkerDiagnostics: [], obligations: [],
    items: [{ definition: ownerId, node: 0 }, { definition, node: 1 }] };
  const module = { module: moduleId, tree, bodies: [] };
  const nodes = new Map([sourceTree, sourceAlias, sourceName, sourceKeyword, sourceEnd].map(node => [node.id, node]));
  const queries = [];
  const scopes = [];
  const input = { source, module, types: { terms: [{ kind: "intrinsic", intrinsic: "unknown" }], signatures: [] },
    bindingScopesOf: target => {
      queries.push(structuredClone(target));
      return target.kind === "module" && target.module === moduleId ? scopes : null;
    },
    declarationOf: selected => selected === definition || selected === ownerId
      ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null,
    memberTableOf: () => { throw new Error("a type-only module has no selected member occurrence"); },
    bodyOf: () => null, nominalOf: () => null,
    nodeOf: reference => reference.kind === "item" && reference.value.owner === definition
      ? nodes.get(reference.value.node) ?? null : null,
    localExists: () => false, diagnostics: [] };
  return { input, module, alias, keyword, definition, queries, scopes };
}

const bodyViolation = (rule, detail, body = bodyId) => ({ rule, site: { kind: "body", body }, detail: [{ kind: "text", value: detail }] });
const nodeViolation = (rule, node, detail) => ({ rule, site: { kind: "node", module: moduleId, node },
  detail: [{ kind: "text", value: detail }] });
const checkerViews = type => ({ read: available(type), declared: available(null), contextual: available(null) });
const checkedValue = (type = 0) => ({ views: checkerViews(type), place: available(null), memory: available(null), observation: available(null) });
const typedValue = (type = 0) => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null,
  evidenceIndex: null, demand: { kind: "always" } });
const selectedOperation = (operation, result = 0) => ({ kind: "decided", decision: { permissionScope: null,
  decision: { kind: "selected", operation, operands: [], result, execution: { kind: "pure" } } } });

function memberScenario(holder, duplicatedPart = false) {
  const body = emptyModuleBody();
  const authored = [];
  const pair = (kind, id, parent, checkedFields, typedFields, checkedPhase, typedPhase) => {
    const original = { ...header(id, parent), kind, ...checkedFields, tsonic: checkedPhase };
    const typed = { ...header(id, parent), kind, ...typedFields, tsonic: typedPhase };
    authored.push(original);
    return { original, typed };
  };
  const key = { kind: "text", value: "x" };
  const provenance = { kind: "mapped", owner: { kind: "body", value: { body: bodyId, node: 2 } }, key: { kind: "text", value: "x" } };
  const decision = { key, origins: [provenance], selectedDeclarations: [], primary: null, read: 0, write: 0,
    getter: null, setter: null, bindings: emptyBindings(), location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
  const selection = { decision, getter: null, setter: null };
  const name = (id, parent, role) => pair("Identifier", id, parent, { text: "x" }, { text: "x" },
    role === "property-name"
      ? { core: emptyCore(), role, key: available({ kind: "text", value: "x" }), origins: available([provenance]) }
      : { core: emptyCore(), role, value: checkedValue(), resolution: { kind: "definition", definition: ownerId, aliases: [] },
        ...(role === "shorthand-value" ? { key: available({ kind: "text", value: "x" }) } : {}) },
    role === "property-name" ? { role, key: { kind: "text", value: "x" } }
      : { ...typedValue(), role, resolution: { kind: "definition", definition: ownerId, aliases: [] },
        ...(role === "shorthand-value" ? { key: { kind: "text", value: "x" } } : {}) });
  let expression;
  let memberNode = 2;
  let selectedCount = 1;
  let expectedOccurrence;
  if (holder === "property-access" || holder === "element-access") {
    const receiver = pair("Identifier", 3, 2, { text: "object" }, { text: "object" },
      { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "definition", definition: ownerId, aliases: [] } },
      { ...typedValue(1), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } });
    const target = holder === "property-access" ? name(4, 2, "property-name")
      : pair("StringLiteral", 4, 2, { text: "x", tokenFlags: [] }, { text: "x", tokenFlags: [] },
        { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "x" } },
        { ...typedValue(), role: "value", value: "x" });
    const checkedFields = { expression: receiver.original, questionDotToken: null,
      ...(holder === "property-access" ? { name: target.original } : { argumentExpression: target.original }) };
    const typedFields = { expression: receiver.typed, questionDotToken: null,
      ...(holder === "property-access" ? { name: target.typed } : { argumentExpression: target.typed }) };
    expression = pair(holder === "property-access" ? "PropertyAccessExpression" : "ElementAccessExpression", 2, 1,
      checkedFields, typedFields,
      { core: emptyCore(), role: "value", value: checkedValue(), origins: available([provenance]), accessor: available(null) },
      { ...typedValue(), role: "value", selection: { kind: "decided", decision: selection } });
    expectedOccurrence = { kind: "selection", node: 2, ordinal: 0 };
  } else if (holder === "property" || holder === "shorthand") {
    memberNode = 3;
    const identifier = name(4, 3, holder === "property" ? "property-name" : "shorthand-value");
    const common = { modifiers: null, postfixToken: null, type: null };
    let property;
    if (holder === "property") {
      const initializer = pair("StringLiteral", 5, 3, { text: "value", tokenFlags: [] }, { text: "value", tokenFlags: [] },
        { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "value" } },
        { ...typedValue(), role: "value", value: "value" });
      property = pair("PropertyAssignment", 3, 2, { ...common, name: identifier.original, initializer: initializer.original },
        { ...common, name: identifier.typed, initializer: initializer.typed },
        { core: emptyCore(), key: available({ kind: "text", value: "x" }), origins: available([provenance]) },
        { key: { kind: "text", value: "x" }, member: { kind: "decided", decision: selection } });
    } else property = pair("ShorthandPropertyAssignment", 3, 2,
      { ...common, name: identifier.original, equalsToken: null, objectAssignmentInitializer: null },
      { ...common, name: identifier.typed, equalsToken: null, objectAssignmentInitializer: null },
      { core: emptyCore(), key: available({ kind: "text", value: "x" }), origins: available([provenance]) },
      { key: { kind: "text", value: "x" }, member: { kind: "decided", decision: selection } });
    expression = pair("ObjectLiteralExpression", 2, 1, { properties: nodeList([property.original]), multiLine: false },
      { properties: nodeList([property.typed]), multiLine: false },
      { core: emptyCore(), role: "value", value: checkedValue() },
      { ...typedValue(), role: "value", construction: selectedOperation({ kind: "object-construction", parts: [] }) });
    expectedOccurrence = { kind: "selection", node: 3, ordinal: 0 };
  } else {
    const part = { part: 0, source: { body: bodyId, node: 2 },
      destination: { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] }, member: decision,
      embedding: { kind: "identity" } };
    const typedPhase = holder === "pattern" ? { role: "assignment-pattern", storage: 0, parts: [part] }
      : { ...typedValue(), role: "value", construction: selectedOperation({ kind: "object-construction", parts: [part] }) };
    if (duplicatedPart) {
      typedPhase.conversion = { kind: "convert", role: "initialization",
        operation: { permissionScope: null, decision: { kind: "selected",
          operation: { kind: "object-construction", parts: [part] }, operands: [0], result: 0, execution: { kind: "pure" } } } };
      selectedCount = 2;
    }
    expression = pair("ObjectLiteralExpression", 2, 1, { properties: nodeList(), multiLine: false },
      { properties: nodeList(), multiLine: false },
      holder === "pattern" ? { core: emptyCore(), role: "assignment-pattern", views: checkerViews(0) }
        : { core: emptyCore(), role: "value", value: checkedValue() }, typedPhase);
    expectedOccurrence = { kind: "construction-part", node: 2, ordinal: 0, source: { body: bodyId, node: 2 },
      destination: { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] }, part: 0 };
  }
  const statement = pair("ExpressionStatement", 1, 0, { expression: expression.original }, { expression: expression.typed }, null, null);
  const end = pair("EndOfFile", holder === "property" ? 6 : holder === "shorthand" || holder === "property-access" ||
    holder === "element-access" ? 5 : 3, 0, {}, {}, null, null);
  body.root.statements = nodeList([statement.typed]);
  body.root.endOfFileToken = end.typed;
  const input = emptyVerificationInput(body, authored, 2 + selectedCount);
  input.source.tree.statements = nodeList([statement.original]);
  input.source.tree.endOfFileToken = end.original;
  const actualMember = { key: { kind: "text", value: "x" }, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance],
    kind: "property", read: 0, write: 0, optional: false, readonly: false };
  input.types.terms.push({ kind: "shape", members: [actualMember], indexes: [], calls: [], constructs: [] });
  const table = { receiver: 1, members: [actualMember], indexes: [], calls: [], constructs: [], accessors: [], constructors: [],
    completeness: { kind: "complete" } };
  const facts = Array.from({ length: selectedCount }, (_, ordinal) => ({
    instance: { body: bodyId, bindings: { kind: "parametric" } }, occurrence: { ...expectedOccurrence, ordinal }, table,
  }));
  const queries = [];
  input.memberTableOf = (instance, occurrence) => {
    queries.push({ instance, occurrence });
    return facts.find(fact => isDeepStrictEqual(fact.instance, instance) && isDeepStrictEqual(fact.occurrence, occurrence))?.table ?? null;
  };
  return { body, input, facts, queries, decision, selection, memberNode, table };
}

function evidenceText(category) {
  return `TypeEvidence(type=t:0, component=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), category=${category}, numeric=null, sum=null, nominal=null, pointer=null)`;
}

function closureDecisionOf(carrier, count, mode = "captured-location") {
  return { kind: "decided", decision: { carrier, captures: Array.from({ length: count }, () => mode), execution: { kind: "pure" } } };
}

function closureDecisionWire(count, mode = "captured-location") {
  return `decided(decision=ClosureDecision(carrier=t:0, captures=[${Array.from({ length: count }, () => JSON.stringify(mode)).join(", ")}], execution=pure()))`;
}

function genericFunctionScenario(nodes = { callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
  parameterName: 6, block: 7, return: 8, value: 9, end: 10 }) {
  const definition = "D[M[P[p];m];f]";
  const functionBody = `B[${definition};function;0]`;
  const typeDefinition = "D[M[P[p];m];f/T]";
  const valueDefinition = "D[M[P[p];m];f/v]";
  const identity = { owner: definition, index: 0 };
  const parameter = { identity, declaration: typeDefinition, constraint: null, default: null };
  const scope = { ...emptyScope(), methodParameters: [identity] };
  const rigid = () => ({ ...emptyBindings(), methodBindings: [{ kind: "rigid", parameter: identity }] });
  const bound = type => ({ ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: identity, type }] });
  const local = { body: functionBody, local: 0 };
  const declaration = { kind: "local", local };
  const localSource = { kind: "body", value: { body: functionBody, node: nodes.parameter } };
  const endpoint = { declaration: definition, role: "api-body", signature: 1, body: functionBody };
  const template = () => ({ body: functionBody, lexicalBindings: rigid(), dependence: "binding-dependent" });
  const typedFunction = storage => {
    const typeName = { ...header(nodes.typeName, nodes.typeParameter), kind: "Identifier", text: "T",
      tsonic: { role: "type-name", type: 1, declarations: [typeDefinition] } };
    const typeNode = { ...header(nodes.typeParameter, nodes.callable), kind: "TypeParameter", modifiers: null, name: typeName,
      constraint: null, expression: null, defaultType: null, tsonic: { parameter } };
    const valueName = { ...header(nodes.parameterName, nodes.parameter), kind: "Identifier", text: "v",
      tsonic: { role: "declaration-name", declaration, storage } };
    const valueParameter = { ...header(nodes.parameter, nodes.callable), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      name: valueName, questionToken: null, type: null, initializer: null,
      tsonic: { declaration: valueDefinition, local, storage, passing: "by-value", initializer: null } };
    const value = { ...header(nodes.value, nodes.return), kind: "Identifier", text: "v",
      tsonic: { ...typedValue(storage), role: "value", resolution: { kind: "local", local } } };
    const statement = { ...header(nodes.return, nodes.block), kind: "ReturnStatement", expression: value, tsonic: null };
    const block = { ...header(nodes.block, nodes.callable), kind: "Block", statements: nodeList([statement]), multiLine: false, tsonic: null };
    return { ...header(nodes.callable, 1), kind: "FunctionExpression", modifiers: null, typeParameters: nodeList([typeNode]),
      parameters: nodeList([valueParameter]), type: null, fullSignature: null, asteriskToken: null, body: block,
      name: null, tsonic: { ...typedValue(4), callable: { definition, parameters: [parameter], signatures: [endpoint],
        template: template(), attributes: [] }, captures: [], closure: closureDecisionOf(4, 0) } };
  };
  const checkedTypeName = { ...header(nodes.typeName, nodes.typeParameter), kind: "Identifier", text: "T",
    tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "definition", definition: typeDefinition, aliases: [] } } };
  const checkedType = { ...header(nodes.typeParameter, nodes.callable), kind: "TypeParameter", modifiers: null, name: checkedTypeName,
    constraint: null, expression: null, defaultType: null, tsonic: { core: emptyCore(), parent: definition,
      attributes: [], memory: available(null), definition: typeDefinition, parameter } };
  const checkedValueName = { ...header(nodes.parameterName, nodes.parameter), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const checkedParameter = { ...header(nodes.parameter, nodes.callable), kind: "Parameter", modifiers: null, dotDotDotToken: null,
    name: checkedValueName, questionToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: definition, attributes: [], memory: available(null), declaration,
      declaredType: available(1), initializer: null } };
  const checkedValueNode = { ...header(nodes.value, nodes.return), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "local", local } } };
  const checkedReturn = { ...header(nodes.return, nodes.block), kind: "ReturnStatement", expression: checkedValueNode, tsonic: null };
  const checkedBlock = { ...header(nodes.block, nodes.callable), kind: "Block", statements: nodeList([checkedReturn]), multiLine: false, tsonic: null };
  const checkedFunction = { ...header(nodes.callable, 1), kind: "FunctionExpression", modifiers: null,
    typeParameters: nodeList([checkedType]), parameters: nodeList([checkedParameter]), type: null, fullSignature: null,
    asteriskToken: null, body: checkedBlock, name: null,
    tsonic: { core: emptyCore(), ...checkedValue(4), body: functionBody, captures: [] } };
  const outer = emptyModuleBody();
  const functionTemplate = { ...emptyModuleBody(), body: functionBody, owner: definition, lexicalBindings: rigid(),
    dependence: "binding-dependent", signature: 1, completion: 1, root: typedFunction(1),
    params: [{ local: 0, declaration: valueDefinition, role: "required", passing: "by-value", initializer: null, storage: 1 }],
    locals: [{ id: 0, declaration: localSource, name: "v", role: "parameter", storage: 1, capturedFrom: null, mutable: true }] };
  const instances = [2, 3].map(storage => ({ ...functionTemplate, bindings: { kind: "instantiated", bindings: bound(storage) },
    lexicalBindings: bound(storage), signature: storage, completion: storage, root: typedFunction(storage),
    params: [{ ...functionTemplate.params[0], storage }], locals: [{ ...functionTemplate.locals[0], storage }] }));
  outer.root.statements = nodeList([{ ...header(1, 0), kind: "ExpressionStatement", expression: functionTemplate.root, tsonic: null }]);
  outer.root.endOfFileToken = { ...header(nodes.end, 0), kind: "EndOfFile", tsonic: null };
  outer.nestedBodies = [functionBody];
  const initial = emptyVerificationInput(outer);
  const checkedRoot = initial.source.tree;
  checkedRoot.statements = nodeList([{ ...header(1, 0), kind: "ExpressionStatement", expression: checkedFunction, tsonic: null }]);
  checkedRoot.endOfFileToken = { ...header(nodes.end, 0), kind: "EndOfFile", tsonic: null };
  const originalFunction = { body: functionBody, owner: definition,
    params: [{ local: 0, declaration: valueDefinition, role: "required", passing: "by-value", initializer: null }],
    locals: [{ id: 0, declaration: localSource, name: "v", role: "parameter", checkerSlot: available(1),
      capturedFrom: null, mutable: true }], root: checkedFunction, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  initial.source.bodies[0].nestedBodies = [functionBody];
  initial.source.bodies.push(originalFunction);
  initial.source.items.push({ definition, node: nodes.callable }, { definition: typeDefinition, node: nodes.typeParameter },
    { definition: valueDefinition, node: nodes.parameter });
  const module = { module: moduleId, tree: outer.root, bodies: [outer, functionTemplate, ...instances] };
  const signature = (id, type, typeParameters) => ({ id, declaration: definition,
    owner: { kind: "body", value: { body: functionBody, node: nodes.callable } }, composition: null, kind: "call", typeParameters,
    receiver: null, parameters: [{ declaration: valueDefinition, kind: "required", type, passing: "by-value", initializer: null }], result: type });
  const types = { terms: [{ kind: "intrinsic", intrinsic: "unknown" }, { kind: "param", parameter: identity },
    { kind: "string" }, { kind: "primitive", primitive: "int32" }, { kind: "callable", calls: [1], constructs: [] }],
  signatures: [initial.types.signatures[0], signature(1, 1, [parameter]), signature(2, 2, []), signature(3, 3, [])] };
  const declarations = new Map([[ownerId, { scope: emptyScope(), parameterCount: 0, endpoints: [] }],
    [definition, { scope, parameterCount: 1, endpoints: [endpoint] }],
    [typeDefinition, { scope, parameterCount: 0, endpoints: [] }], [valueDefinition, { scope, parameterCount: 0, endpoints: [] }]]);
  const functionNodes = new Map([checkedFunction, checkedType, checkedTypeName, checkedParameter,
    checkedValueName, checkedBlock, checkedReturn, checkedValueNode].map(node => [node.id, node]));
  const outerBodyNodes = new Map([[0, checkedRoot], [1, checkedRoot.statements.nodes[0]], [nodes.end, checkedRoot.endOfFileToken]]);
  const outerNodes = new Map([...outerBodyNodes, ...functionNodes]);
  const bodyNodes = new Map([[bodyId, outerBodyNodes], [functionBody, functionNodes]]);
  const itemNodes = new Map([[ownerId, outerBodyNodes],
    [definition, new Map([checkedFunction, checkedBlock, checkedReturn, checkedValueNode].map(node => [node.id, node]))],
    [typeDefinition, new Map([checkedType, checkedTypeName].map(node => [node.id, node]))],
    [valueDefinition, new Map([checkedParameter, checkedValueName].map(node => [node.id, node]))]]);
  const scopes = new Map([[outer, [emptyScope(), emptyScope()]], [functionTemplate, [scope, scope]],
    ...instances.map(body => [body, [scope, scope, scope]])]);
  const scopeReaders = new Map([...scopes].map(([body, inventory]) => [body, bodyScopeReader(body, inventory)]));
  const inputFor = selected => ({ source: initial.source, module, types, bindingScopesOf: scopeReaders.get(selected), diagnostics: [],
    declarationOf: selectedDefinition => declarations.get(selectedDefinition) ?? null,
    memberTableOf: () => { throw new Error("unexpected generic-function member lookup"); },
    bodyOf: instance => module.bodies.find(body => body.body === instance.body && compareCaseValues(body.bindings, instance.bindings)) ?? null,
    nominalOf: () => null,
    nodeOf: reference => reference.kind === "body" ? bodyNodes.get(reference.value.body)?.get(reference.value.node) ?? null
      : itemNodes.get(reference.value.owner)?.get(reference.value.node) ?? null,
    localExists: reference => reference.body === functionBody && reference.local === 0 });
  return { outer, functionTemplate, instances, inputFor, originalFunction, definition, functionBody, typeDefinition,
    valueDefinition, identity, scope, types, declarations, checkedFunction, functionNodes, outerNodes, outerBodyNodes,
    itemNodes, module, nodes };
}

function bindingPatternScenario(includeHole) {
  const block = includeHole ? 10 : 9;
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block, return: block + 1, value: block + 2, end: block + 3 });
  const body = fixture.functionTemplate;
  fixture.module.bodies = [fixture.outer, body];
  const bindingId = includeHole ? 8 : 7;
  const nameId = bindingId + 1;
  const local = { body: fixture.functionBody, local: 1 };
  const declaration = { kind: "local", local };
  const name = { ...header(nameId, bindingId), kind: "Identifier", text: "v",
    tsonic: { role: "declaration-name", declaration, storage: 1 } };
  const sourceName = { ...header(nameId, bindingId), kind: "Identifier", text: "v",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const binding = { ...header(bindingId, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name, initializer: null, tsonic: { declaration, storage: 1, initializer: null, role: "binding" } };
  const sourceBinding = { ...header(bindingId, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: sourceName, initializer: null, tsonic: { core: emptyCore(), declaration, declaredType: available(1) } };
  const hole = { ...header(7, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { role: "hole" } };
  const sourceHole = { ...header(7, 6), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { core: emptyCore(), declaration: null, declaredType: available(null) } };
  const pattern = { ...header(6, 5), kind: "ArrayBindingPattern", elements: nodeList(includeHole ? [hole, binding] : [binding]),
    tsonic: { storage: 5 } };
  const sourcePattern = { ...header(6, 5), kind: "ArrayBindingPattern",
    elements: nodeList(includeHole ? [sourceHole, sourceBinding] : [sourceBinding]),
    tsonic: { core: emptyCore(), declaration: null, declaredType: available(5) } };
  const parameter = body.root.parameters.nodes[0];
  const sourceParameter = fixture.checkedFunction.parameters.nodes[0];
  parameter.name = pattern;
  parameter.tsonic.storage = 5;
  sourceParameter.name = sourcePattern;
  sourceParameter.tsonic.declaredType = available(5);
  body.params[0].storage = 5;
  body.locals[0].storage = 5;
  fixture.originalFunction.locals[0].checkerSlot = available(5);
  const occurrence = { kind: "body", value: { body: fixture.functionBody, node: nameId } };
  body.locals.push({ id: 1, declaration: occurrence, name: "v", role: "binding", storage: 1,
    capturedFrom: null, mutable: true });
  fixture.originalFunction.locals.push({ id: 1, declaration: occurrence, name: "v", role: "binding", checkerSlot: available(1),
    capturedFrom: null, mutable: true });
  body.root.body.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local };
  fixture.checkedFunction.body.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local };
  fixture.types.terms.push({ kind: "tuple", elements: Array.from({ length: includeHole ? 2 : 1 }, () =>
    ({ kind: "required", type: 1, declaration: null })), readonly: false });
  fixture.types.signatures[1].parameters[0].type = 5;
  const sourceNodes = includeHole ? [sourcePattern, sourceHole, sourceBinding, sourceName]
    : [sourcePattern, sourceBinding, sourceName];
  for (const node of sourceNodes) {
    fixture.functionNodes.set(node.id, node);
    fixture.itemNodes.get(fixture.valueDefinition).set(node.id, node);
  }
  const input = fixture.inputFor(body);
  input.localExists = reference => reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
  return { ...fixture, body, input, binding, hole: includeHole ? hole : null };
}

function siblingIdentityScenario(sourceShared, typedShared) {
  const body = emptyModuleBody();
  const first = { ...header(1, 0), kind: "EmptyStatement", tsonic: null };
  const second = sourceShared ? first : { ...header(2, 0), kind: "EmptyStatement", tsonic: null };
  const firstTyped = { ...first };
  const secondTyped = typedShared ? firstTyped : { ...second };
  const end = { ...header(sourceShared ? 2 : 3, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([firstTyped, secondTyped]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [first, second, end]);
  input.source.tree.statements = nodeList([first, second]);
  input.source.tree.endOfFileToken = end;
  return { body, input, firstTyped, second };
}

function layeredSyntaxScenario(depth) {
  const body = emptyModuleBody();
  const source = [];
  const typed = [];
  for (let level = depth; level >= 1; level--) {
    const child = source[0];
    const typedChild = typed[0];
    source.unshift({ ...header(level, level - 1), kind: "Block", statements: nodeList(child === undefined ? [] : [child, child]),
      multiLine: false, tsonic: null });
    typed.unshift({ ...header(level, level - 1), kind: "Block", statements: nodeList(typedChild === undefined ? [] : [typedChild, typedChild]),
      multiLine: false, tsonic: null });
  }
  const end = { ...header(depth + 1, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([typed[0]]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [...source, end]);
  input.source.tree.statements = nodeList([source[0]]);
  input.source.tree.endOfFileToken = end;
  return { body, input, source, typed };
}

function twoParameterScenario() {
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block: 9, return: 10, value: 11, end: 12 });
  const definition = "D[M[P[p];m];f/w]";
  const local = { body: fixture.functionBody, local: 1 };
  const declaration = { kind: "local", local };
  const source = { kind: "body", value: { body: fixture.functionBody, node: 7 } };
  const first = fixture.checkedFunction.parameters.nodes[0];
  const name = { ...first.name, id: 8, parent: 7, text: "w", tsonic: { ...first.name.tsonic, declaration } };
  const parameter = { ...first, id: 7, name, tsonic: { ...first.tsonic, declaration } };
  fixture.checkedFunction.parameters.nodes.push(parameter);
  fixture.originalFunction.params.push({ local: 1, declaration: definition, role: "required", passing: "by-value", initializer: null });
  fixture.originalFunction.locals.push({ id: 1, declaration: source, name: "w", role: "parameter", checkerSlot: available(1),
    capturedFrom: null, mutable: true });
  for (const body of [fixture.functionTemplate, ...fixture.instances]) {
    const first = body.root.parameters.nodes[0];
    const storage = first.tsonic.storage;
    const name = { ...first.name, id: 8, parent: 7, text: "w", tsonic: { ...first.name.tsonic, declaration } };
    body.root.parameters.nodes.push({ ...first, id: 7, name, tsonic: { ...first.tsonic, declaration: definition, local } });
    body.params.push({ local: 1, declaration: definition, role: "required", passing: "by-value", initializer: null, storage });
    body.locals.push({ id: 1, declaration: source, name: "w", role: "parameter", storage, capturedFrom: null, mutable: true });
  }
  for (const signature of fixture.types.signatures.slice(1)) signature.parameters.push({ declaration: definition,
    kind: "required", type: signature.result, passing: "by-value", initializer: null });
  fixture.declarations.get(fixture.definition).parameterCount = 2;
  fixture.declarations.set(definition, { scope: fixture.scope, parameterCount: 0, endpoints: [] });
  for (const node of [parameter, name]) { fixture.functionNodes.set(node.id, node); fixture.outerNodes.set(node.id, node); }
  fixture.itemNodes.set(definition, new Map([[7, parameter], [8, name]]));
  fixture.inputFor(fixture.outer).source.items.push({ definition, node: 7 });
  const inputFor = body => {
    const input = fixture.inputFor(body);
    input.localExists = reference => reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
    return input;
  };
  return { ...fixture, inputFor };
}

function callScenario(mode = "sync") {
  const asynchronous = mode === "async" || mode === "async-generator";
  const generator = mode === "generator" || mode === "async-generator";
  const typeParameter = 4 + (asynchronous ? 1 : 0);
  const parameter = typeParameter + 2;
  const block = parameter + 2 + (generator ? 1 : 0);
  const returning = block + 1 + (generator ? 3 : 0);
  const argument = returning + 2;
  const fixture = genericFunctionScenario({ callable: 3, typeParameter, typeName: typeParameter + 1, parameter,
    parameterName: parameter + 1, block, return: returning, value: returning + 1, end: argument + 1 });
  const hasWrapper = asynchronous || generator;
  const target = fixture.instances[0];
  const input = fixture.inputFor(fixture.outer);
  const published = [fixture.functionTemplate, ...fixture.instances];
  const wrapperDefinition = generator ? "D[M[P[core];iteration];Generator]" : "D[M[P[core];async];Promise]";
  if (hasWrapper) {
    const wrapper = type => ({ kind: "declared", definition: wrapperDefinition,
      arguments: generator ? [3, type, 0] : [type], facet: "instance", extent: null });
    fixture.types.terms.push(wrapper(2), wrapper(1), wrapper(3));
    fixture.types.signatures[1].result = 6;
    fixture.types.signatures[2].result = 5;
    fixture.types.signatures[3].result = 7;
    input.nominalOf = definition => definition === wrapperDefinition ? { kind: "declared", facets: ["instance"] } : null;
  }
  fixture.originalFunction.asynchronous = asynchronous;
  fixture.originalFunction.generator = generator;
  for (const body of published) {
    body.asynchronous = asynchronous;
    body.generator = generator;
    body.yielded = generator ? 3 : null;
    body.sent = generator ? 0 : null;
    body.root.parent = 2;
    body.root.modifiers = asynchronous ? nodeList([{ ...header(4, 3), kind: "AsyncKeyword", tsonic: null }]) : null;
    body.root.asteriskToken = generator ? { ...header(block - 1, 3), kind: "AsteriskToken", tsonic: null } : null;
    if (generator) {
      const value = { ...header(block + 3, block + 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
        tsonic: { ...typedValue(3), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
      const yielded = { ...header(block + 2, block + 1), kind: "YieldExpression", asteriskToken: null, expression: value,
        tsonic: { ...typedValue(0), protocol: { kind: "decided", decision: { kind: "yield", asynchronous, steps: [],
          value: 3, completion: body.completion, sent: 0, thrown: 0 } } } };
      body.root.body.statements.nodes.unshift({ ...header(block + 1, block), kind: "ExpressionStatement", expression: yielded, tsonic: null });
    }
  }
  fixture.checkedFunction.parent = 2;
  fixture.checkedFunction.modifiers = asynchronous ? nodeList([{ ...header(4, 3), kind: "AsyncKeyword", tsonic: null }]) : null;
  fixture.checkedFunction.asteriskToken = generator ? { ...header(block - 1, 3), kind: "AsteriskToken", tsonic: null } : null;
  if (asynchronous) fixture.functionNodes.set(4, fixture.checkedFunction.modifiers.nodes[0]);
  if (generator) {
    fixture.functionNodes.set(block - 1, fixture.checkedFunction.asteriskToken);
    const value = { ...header(block + 3, block + 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
      tsonic: { core: emptyCore(), role: "value", value: checkedValue(3),
        literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const yielded = { ...header(block + 2, block + 1), kind: "YieldExpression", asteriskToken: null, expression: value,
      tsonic: { core: emptyCore(), ...checkedValue(0), protocol: available({ kind: "yield", subject: block + 3,
        yielded: 3, sent: 0, completion: 1 }) } };
    const statement = { ...header(block + 1, block), kind: "ExpressionStatement", expression: yielded, tsonic: null };
    fixture.checkedFunction.body.statements.nodes.unshift(statement);
    for (const node of [statement, yielded, value]) fixture.functionNodes.set(node.id, node);
  }
  for (const [identity, node] of fixture.functionNodes) {
    fixture.outerNodes.set(identity, node);
    if (identity === 4 && asynchronous || generator && identity >= block + 1 && identity <= block + 3 || identity === block - 1 && generator) {
      fixture.itemNodes.get(fixture.definition).set(identity, node);
    }
  }
  const result = hasWrapper ? 5 : 2;
  const advertised = { declaration: fixture.definition, role: "advertised", signature: 1, body: fixture.functionBody };
  const api = { declaration: fixture.definition, role: "api-body", signature: 2, body: fixture.functionBody };
  fixture.declarations.get(fixture.definition).endpoints.push(advertised, api);
  const bindings = { ...emptyBindings(), methodBindings: [{ kind: "bound", parameter: fixture.identity, type: 2 }] };
  const decision = { candidate: 0, advertised, api, bindings, implementationBindings: bindings,
    parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature: 2, completion: 2, yielded: generator ? 3 : null, sent: generator ? 0 : null }, result };
  const callee = { decision, activation: { body: fixture.functionBody, bindings: target.bindings }, captures: [] };
  const value = { ...header(argument, 2), kind: "StringLiteral", text: "s", tokenFlags: [],
    tsonic: { ...typedValue(2), role: "value", value: "s" } };
  const call = { ...header(2, 1), kind: "CallExpression", expression: fixture.functionTemplate.root,
    questionDotToken: null, typeArguments: null, arguments: nodeList([value]),
    tsonic: { ...typedValue(result), application: { kind: "decided", decision: { callee, receiver: null,
      arguments: [{ kind: "provided", parameter: 0, expression: argument }] } }, operation: null } };
  fixture.outer.root.statements.nodes[0].expression = call;
  const captured = { kind: "call", receiver: null, arguments: [{ kind: "value", expression: argument }], typeArguments: [],
    candidates: available(0), resolvedSignature: available(2) };
  const checkedArgument = { ...header(argument, 2), kind: "StringLiteral", text: "s", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(2), literal: { kind: "string", value: "s" } } };
  const checkedCall = { ...header(2, 1), kind: "CallExpression", expression: fixture.checkedFunction,
    questionDotToken: null, typeArguments: null, arguments: nodeList([checkedArgument]),
    tsonic: { core: emptyCore(), ...checkedValue(result), application: available(captured) } };
  input.source.tree.statements.nodes[0].expression = checkedCall;
  input.source.bodies[0].candidateLists = [{ id: 0, candidates: [{ ordinal: 0, declaration: fixture.definition,
    appliedSignature: available(2), bindings: available(bindings), conditionalFailure: available(null), contributions: [] }] }];
  for (const node of [checkedCall, checkedArgument]) {
    fixture.outerNodes.set(node.id, node);
    fixture.outerBodyNodes.set(node.id, node);
  }
  replaceScopeInventory(input, [emptyScope(), fixture.scope, fixture.scope, fixture.scope, emptyScope()]);
  return { ...fixture, input, body: fixture.outer, call, callee, target, decision, captured, checkedCall, checkedArgument };
}

function deferredConversionScenario() {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const value = body.root.body.statements.nodes[0].expression;
  const component = { kind: "body", value: { body: body.body, node: value.id } };
  const evidence = { type: 1, component, category: { kind: "parameter", declaration: fixture.typeDefinition },
    numeric: null, sum: null, nominal: null, pointer: null };
  const context = { occurrence: { body: body.body, node: value.id }, origin: origin(), bindings: body.lexicalBindings };
  const deferred = { invocation: { rule: "embed", input: { context, from: evidence, to: evidence, role: "return" } }, result: 1 };
  value.tsonic.conversion = { kind: "deferred", deferred };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  return { ...fixture, body, input, value, deferred, context };
}

function genericObjectScenario() {
  const fixture = genericFunctionScenario({ callable: 2, typeParameter: 3, typeName: 4, parameter: 5,
    parameterName: 6, block: 7, return: 8, value: 12, end: 13 });
  const key = { kind: "text", value: "x" };
  const provenance = { kind: "mapped", owner: { kind: "body", value: { body: fixture.functionBody, node: 10 } }, key };
  const member = type => ({ key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance],
    kind: "property", read: type, write: type, optional: false, readonly: false });
  const members = [member(1), member(2), member(3)];
  fixture.types.terms.push(...members.map(actual => ({ kind: "shape", members: [actual], indexes: [], calls: [], constructs: [] })));
  const facts = [];
  const queries = [];
  const bodies = [fixture.functionTemplate, ...fixture.instances];
  for (const [position, body] of bodies.entries()) {
    const type = position + 1;
    const storage = position + 5;
    const value = body.root.body.statements.nodes[0].expression;
    value.parent = 10;
    const name = { ...header(11, 10), kind: "Identifier", text: "x", tsonic: { role: "property-name", key } };
    const decision = { key, origins: [provenance], selectedDeclarations: [], primary: null, read: type, write: type,
      getter: null, setter: null, bindings: body.lexicalBindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
    const property = { ...header(10, 9), kind: "PropertyAssignment", modifiers: null, name, postfixToken: null,
      type: null, initializer: value, tsonic: { key, member: { kind: "decided", decision: { decision, getter: null, setter: null } } } };
    const expression = { ...header(9, 8), kind: "ObjectLiteralExpression", properties: nodeList([property]), multiLine: false,
      tsonic: { ...typedValue(storage), role: "value", construction: selectedOperation({ kind: "object-construction", parts: [] }, storage) } };
    body.root.body.statements.nodes[0].expression = expression;
    body.completion = storage;
    fixture.types.signatures[position + 1].result = storage;
    facts.push({ instance: { body: fixture.functionBody, bindings: body.bindings },
      occurrence: { kind: "selection", node: 10, ordinal: 0 }, table: { receiver: storage, members: [members[position]],
        indexes: [], calls: [], constructs: [], accessors: [], constructors: [], completeness: { kind: "complete" } } });
  }
  const checkedValueNode = fixture.checkedFunction.body.statements.nodes[0].expression;
  checkedValueNode.parent = 10;
  const checkedName = { ...header(11, 10), kind: "Identifier", text: "x",
    tsonic: { core: emptyCore(), role: "property-name", key: available(key), origins: available([provenance]) } };
  const checkedProperty = { ...header(10, 9), kind: "PropertyAssignment", modifiers: null, name: checkedName,
    postfixToken: null, type: null, initializer: checkedValueNode,
    tsonic: { core: emptyCore(), key: available(key), origins: available([provenance]) } };
  const checkedExpression = { ...header(9, 8), kind: "ObjectLiteralExpression", properties: nodeList([checkedProperty]), multiLine: false,
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(5) } };
  fixture.checkedFunction.body.statements.nodes[0].expression = checkedExpression;
  for (const node of [checkedExpression, checkedProperty, checkedName]) {
    fixture.functionNodes.set(node.id, node);
    fixture.outerNodes.set(node.id, node);
    fixture.itemNodes.get(fixture.definition).set(node.id, node);
  }
  const scopes = new Map([[fixture.outer, [emptyScope(), emptyScope()]],
    [fixture.functionTemplate, [fixture.scope, fixture.scope, fixture.scope]],
    ...fixture.instances.map(body => [body, [fixture.scope, fixture.scope, fixture.scope, fixture.scope]])]);
  const inputFor = body => {
    const input = fixture.inputFor(body);
    replaceScopeInventory(input, scopes.get(body));
    input.memberTableOf = (instance, occurrence) => {
      queries.push({ instance, occurrence });
      return facts.find(fact => isDeepStrictEqual(fact.instance, instance) && isDeepStrictEqual(fact.occurrence, occurrence))?.table ?? null;
    };
    return input;
  };
  return { ...fixture, inputFor, facts, queries };
}

function contextualLiteralScenario() {
  const fixture = memberScenario("property");
  const original = fixture.input.source.tree.statements.nodes[0].expression;
  const typed = fixture.body.root.statements.nodes[0].expression;
  const key = { kind: "text", value: "y" };
  const provenance = { kind: "mapped", owner: { kind: "body", value: { body: bodyId, node: 2 } }, key };
  const decision = { ...fixture.decision, key, origins: [provenance], bindings: emptyBindings() };
  const name = { ...header(7, 6), kind: "Identifier", text: "y", tsonic: { role: "property-name", key } };
  const value = { ...header(8, 6), kind: "StringLiteral", text: "second", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "second" } };
  const property = { ...header(6, 2), kind: "PropertyAssignment", modifiers: null, name, postfixToken: null, type: null,
    initializer: value, tsonic: { key, member: { kind: "decided", decision: { decision, getter: null, setter: null } } } };
  const checkedName = { ...header(7, 6), kind: "Identifier", text: "y",
    tsonic: { core: emptyCore(), role: "property-name", key: available(key), origins: available([provenance]) } };
  const checkedValueNode = { ...header(8, 6), kind: "StringLiteral", text: "second", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "second" } } };
  const checkedProperty = { ...header(6, 2), kind: "PropertyAssignment", modifiers: null, name: checkedName,
    postfixToken: null, type: null, initializer: checkedValueNode,
    tsonic: { core: emptyCore(), key: available(key), origins: available([provenance]) } };
  typed.properties.nodes.push(property);
  original.properties.nodes.push(checkedProperty);
  const actualMember = { ...fixture.table.members[0], key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance] };
  const table = { ...fixture.table, receiver: 2, members: [actualMember] };
  fixture.input.types.terms.push({ kind: "shape", members: [actualMember], indexes: [], calls: [], constructs: [] });
  fixture.facts.push({ instance: { body: bodyId, bindings: { kind: "parametric" } },
    occurrence: { kind: "selection", node: 6, ordinal: 0 }, table });
  bodyScopes(fixture.input, fixture.body).push(emptyScope());
  const source = fixture.input.source.tree;
  source.endOfFileToken = { ...header(9, 0), kind: "EndOfFile", tsonic: null };
  fixture.body.root.endOfFileToken = { ...header(9, 0), kind: "EndOfFile", tsonic: null };
  const first = original.properties.nodes[0];
  const nodes = new Map([source, source.endOfFileToken, source.statements.nodes[0], original, first, first.name, first.initializer,
    checkedProperty, checkedName, checkedValueNode].map(node => [node.id, node]));
  fixture.input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null : null
    : reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? null : null;
  return fixture;
}

function argumentScenario(form = "whole", passing = "by-value") {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const definition = "D[M[P[api];collections];f]";
  const items = "D[M[P[api];collections];items]";
  const nextDefinition = "D[M[P[api];collections];Iterator/next]";
  const initializerOwner = "D[M[P[api];collections];f/default]";
  const initializerBody = `B[${initializerOwner};default-argument;0]`;
  const advertised = { declaration: definition, role: "advertised", signature: 1, body: null };
  const api = { declaration: definition, role: "api-signature", signature: 1, body: null };
  const omitted = form === "empty-rest" || form === "optional" || form === "default";
  const values = form === "values";
  const tuple = form === "unknown" ? null : form === "empty" || omitted ? [] : [2, 2];
  const formal = (name, kind, type, initializer = null) => ({ declaration: `D[M[P[api];collections];f/${name}]`,
    kind, type, passing, initializer });
  const parameters = form === "whole" ? [formal("head", "required", 2), formal("tail", "rest", 4)]
    : [formal("tail", form === "optional" ? "optional" : form === "default" ? "default" : "rest",
      omitted && form !== "empty-rest" ? 2 : 4, form === "default" ? initializerBody : null)];
  const mappings = form === "whole" ? [
    { kind: "argument", parameter: 0, argument: 0, component: 0, passing },
    { kind: "rest", parameter: 1, arguments: [0], passing },
  ] : form === "optional" ? [{ kind: "omitted", parameter: 0, type: 2 }]
    : form === "default" ? [{ kind: "default", parameter: 0, initializer: initializerBody }]
      : [{ kind: "rest", parameter: 0, arguments: omitted ? [] : values ? [0, 1, 2] : [0], passing }];
  const decision = { candidate: 0, advertised, api, bindings: emptyBindings(), implementationBindings: emptyBindings(),
    parameters: mappings, completion: { signature: 1, completion: 0, yielded: null, sent: null }, result: 0, activation: null };
  const callee = { decision, activation: null, captures: [] };
  const originals = [];
  const pair = (kind, identity, parent, fields, checkedPhase, typedPhase) => {
    const original = { ...header(identity, parent), kind, ...fields, tsonic: checkedPhase };
    const typed = { ...header(identity, parent), kind, ...fields, tsonic: typedPhase };
    originals.push(original);
    return { original, typed };
  };
  const target = pair("Identifier", 3, 2, { text: "f" },
    { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "definition", definition, aliases: [] } },
    { ...typedValue(1), role: "value", resolution: { kind: "definition", definition, aliases: [] } });
  const expression = values ? 6 : 5;
  const sourceArguments = [];
  const typedArguments = [];
  const capturedArguments = [];
  const parts = [];
  const numeric = identity => pair("NumericLiteral", identity, 2, { text: "1", tokenFlags: [] },
    { core: emptyCore(), role: "value", value: checkedValue(2),
      literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } },
    { ...typedValue(2), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } });
  if (values) {
    const value = numeric(4);
    sourceArguments.push(value.original);
    typedArguments.push(value.typed);
    capturedArguments.push({ kind: "value", expression: 4 });
    parts.push({ kind: "value", expression: 4 });
  }
  if (!omitted) {
    const core = emptyCore();
    core.argumentPassing = available({ role: "argument", mode: passing,
      storageExpression: { kind: "body", value: { body: bodyId, node: expression } } });
    const operand = pair("Identifier", expression, expression - 1, { text: "items" },
      { core, role: "value", value: checkedValue(5), resolution: { kind: "definition", definition: items, aliases: [] } },
      { ...typedValue(5), role: "value", resolution: { kind: "definition", definition: items, aliases: [] } });
    const protocol = { kind: "decided", decision: { kind: "spread", asynchronous: false, steps: [],
      value: 2, completion: 0, sent: 0, thrown: 0 } };
    const spread = { ...header(expression - 1, 2), kind: "SpreadElement", expression: operand.typed,
      tsonic: { ...typedValue(5), protocol } };
    const checkedSpread = { ...header(expression - 1, 2), kind: "SpreadElement", expression: operand.original,
      tsonic: { core: emptyCore(), ...checkedValue(5), protocol: available({ kind: "spread", asynchronous: false,
        subject: expression, iterator: 5, element: 2, completion: 0, sent: 0, next: 2, finish: null, fail: null }) } };
    originals.push(checkedSpread);
    sourceArguments.push(checkedSpread);
    typedArguments.push(spread);
    capturedArguments.push({ kind: "spread", expression, tuple: available(tuple) });
    parts.push({ kind: "spread", expression, tuple });
  }
  if (values) {
    const value = numeric(7);
    sourceArguments.push(value.original);
    typedArguments.push(value.typed);
    capturedArguments.push({ kind: "value", expression: 7 });
    parts.push({ kind: "value", expression: 7 });
  }
  const instance = { body: initializerBody, bindings: { kind: "parametric" } };
  const argumentsByParameter = form === "whole" ? [{ kind: "provided", parameter: 0, expression }, { kind: "rest", parameter: 1, parts }]
    : omitted ? [{ kind: "omitted", parameter: 0, value: form === "optional" ? { kind: "absence" }
      : form === "default" ? { kind: "initializer", instance } : { kind: "empty-rest" } }]
      : [{ kind: "rest", parameter: 0, parts }];
  const application = { callee, receiver: null, arguments: argumentsByParameter };
  const captured = { kind: "call", receiver: null, arguments: capturedArguments, typeArguments: [],
    candidates: available(0), resolvedSignature: available(1) };
  const call = { ...header(2, 1), kind: "CallExpression", expression: target.typed, questionDotToken: null,
    typeArguments: null, arguments: nodeList(typedArguments),
    tsonic: { ...typedValue(), application: { kind: "decided", decision: application }, operation: null } };
  const checkedCall = { ...header(2, 1), kind: "CallExpression", expression: target.original, questionDotToken: null,
    typeArguments: null, arguments: nodeList(sourceArguments),
    tsonic: { core: emptyCore(), ...checkedValue(), application: available(captured) } };
  const statement = { ...header(1, 0), kind: "ExpressionStatement", expression: call, tsonic: null };
  const checkedStatement = { ...header(1, 0), kind: "ExpressionStatement", expression: checkedCall, tsonic: null };
  const end = omitted ? 4 : values ? 8 : 6;
  body.root.statements = nodeList([statement]);
  body.root.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  input.source.tree.statements = nodeList([checkedStatement]);
  input.source.tree.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  input.source.bodies[0].candidateLists = [{ id: 0, candidates: [{ ordinal: 0, declaration: definition,
    appliedSignature: available(1), bindings: available(emptyBindings()), conditionalFailure: available(null), contributions: [] }] }];
  input.types.terms.push({ kind: "callable", calls: [1], constructs: [] }, { kind: "primitive", primitive: "int32" },
    { kind: "string" }, { kind: "array", element: 2, readonly: false }, tuple === null
      ? { kind: "array", element: 2, readonly: false }
      : { kind: "tuple", elements: tuple.map(type => ({ kind: "required", type, declaration: null })), readonly: false });
  input.types.signatures.push({ id: 1, declaration: definition, owner: { kind: "item", value: { owner: definition, node: 0 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters, result: 0 });
  const foreignName = { ...header(0), origin: { module: "M[P[api];collections]", start: 0, length: 0, derived: [] },
    kind: "Identifier", text: "f",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  const nextName = { ...header(0), origin: foreignName.origin, kind: "Identifier", text: "next",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition: nextDefinition } } };
  const foreignNodes = new Map([[definition, foreignName], [nextDefinition, nextName]]);
  if (!omitted) input.types.signatures.push({ id: 2, declaration: nextDefinition,
    owner: { kind: "item", value: { owner: nextDefinition, node: 0 } }, composition: null, kind: "call",
    typeParameters: [], receiver: 5, parameters: [], result: 0 });
  const nodes = new Map([input.source.tree, checkedStatement, checkedCall, ...originals, input.source.tree.endOfFileToken].map(node => [node.id, node]));
  input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null : null
    : reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? null
      : reference.value.node === 0 ? foreignNodes.get(reference.value.owner) ?? null : null;
  input.declarationOf = selected => selected === ownerId ? { scope: emptyScope(), parameterCount: 0, endpoints: [] }
    : selected === definition ? { scope: emptyScope(), parameterCount: parameters.length, endpoints: [advertised, api] }
      : selected === items ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null;
  replaceScopeInventory(input, [emptyScope(), emptyScope(), emptyScope(), emptyScope()]);
  if (form === "default") {
    const initializer = { ...emptyModuleBody(), body: initializerBody, owner: initializerOwner, signature: 2, completion: 2,
      root: { ...header(0), origin: foreignName.origin, kind: "NumericLiteral", text: "1", tokenFlags: [],
        tsonic: { ...typedValue(2), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const original = { ...header(0), origin: foreignName.origin, kind: "NumericLiteral", text: "1", tokenFlags: [],
      tsonic: { core: emptyCore(), role: "value", value: checkedValue(2),
        literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
    const nodeOf = input.nodeOf;
    input.nodeOf = reference => reference.kind === "body" && reference.value.body === initializerBody && reference.value.node === 0
      ? original : nodeOf(reference);
    input.types.signatures.push({ id: 2, declaration: initializerOwner,
      owner: { kind: "body", value: { body: initializerBody, node: 0 } }, composition: null, kind: "call",
      typeParameters: [], receiver: null, parameters: [], result: 2 });
    const publication = [body, initializer];
    input.bodyOf = selected => publication.find(actual => actual.body === selected.body &&
      compareCaseValues(actual.bindings, selected.bindings)) ?? null;
  }
  return { body, input, call, decision, application, captured, parts, parameters, definition };
}

function expressionScenario(checked, typed, children, end, terms) {
  const body = emptyModuleBody();
  const statement = { ...header(1, 0), kind: "ExpressionStatement", expression: typed, tsonic: null };
  const originalStatement = { ...header(1, 0), kind: "ExpressionStatement", expression: checked, tsonic: null };
  const originalEnd = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([statement]);
  body.root.endOfFileToken = { ...header(end, 0), kind: "EndOfFile", tsonic: null };
  const input = emptyVerificationInput(body, [originalStatement, checked, ...children, originalEnd]);
  input.source.tree.statements = nodeList([originalStatement]);
  input.source.tree.endOfFileToken = originalEnd;
  input.types.terms.push(...terms);
  return { body, input, checked, typed };
}

function conditionalScenario(disposition = "dynamic") {
  const selected = (identity, value, when) => ({ ...header(identity, 2), kind: "StringLiteral", text: value, tokenFlags: [],
    tsonic: { ...typedValue(2), role: "value", value, demand: disposition === "dynamic" || disposition === when
      ? { kind: "selected", control: 3, when } : { kind: "never", control: 3 } } });
  const whenTrue = selected(5, "yes", "true");
  const whenFalse = selected(7, "no", "false");
  const condition = { ...header(3, 2), kind: "TrueKeyword", tsonic: { ...typedValue(1), role: "value" } };
  const typed = { ...header(2, 1), kind: "ConditionalExpression", condition,
    questionToken: { ...header(4, 2), kind: "QuestionToken", tsonic: null }, whenTrue,
    colonToken: { ...header(6, 2), kind: "ColonToken", tsonic: null }, whenFalse,
    tsonic: { ...typedValue(2), selection: { kind: "conditional", control: 3, whenTrue: 5, whenFalse: 7, disposition } } };
  const checkedCondition = { ...header(3, 2), kind: "TrueKeyword",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1) } };
  const originalValue = (identity, value) => ({ ...header(identity, 2), kind: "StringLiteral", text: value, tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(2), literal: { kind: "string", value } } });
  const checkedTrue = originalValue(5, "yes");
  const checkedFalse = originalValue(7, "no");
  const question = { ...header(4, 2), kind: "QuestionToken", tsonic: null };
  const colon = { ...header(6, 2), kind: "ColonToken", tsonic: null };
  const checked = { ...header(2, 1), kind: "ConditionalExpression", condition: checkedCondition, questionToken: question,
    whenTrue: checkedTrue, colonToken: colon, whenFalse: checkedFalse, tsonic: { core: emptyCore(), ...checkedValue(2) } };
  return expressionScenario(checked, typed, [checkedCondition, question, checkedTrue, colon, checkedFalse], 8,
    [{ kind: "primitive", primitive: "bool" }, { kind: "string" }]);
}

function operationScenario() {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const operand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } };
  const operation = { permissionScope: 0, decision: { kind: "selected",
    operation: { kind: "native-operator", operator: "+", carrier: "int32" }, operands: [1], result: 1, execution: { kind: "pure" } } };
  const typed = { ...header(2, 1), kind: "PrefixUnaryExpression", operator: "PlusToken", operand,
    tsonic: { ...typedValue(1), role: "value", operation: { kind: "decided", decision: operation } } };
  const checkedOperand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), literal: { kind: "number", token: "1", value: exact } } };
  const checked = { ...header(2, 1), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: checkedOperand,
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1) } };
  const fixture = expressionScenario(checked, typed, [checkedOperand], 4, [{ kind: "primitive", primitive: "int32" }]);
  fixture.body.scopes = [{ node: 0, parent: null, attributes: [] }];
  fixture.input.source.bodies[0].scopes = [{ node: 0, parent: null, attributes: [] }];
  return { ...fixture, operation, operand };
}

function binaryScenario(role = "arithmetic", token = "PlusToken") {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const original = identity => ({ ...header(identity, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), literal: { kind: "number", token: "1", value: exact } } });
  const value = identity => ({ ...header(identity, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } });
  const checkedLeft = original(3);
  const checkedRight = original(5);
  const operator = { ...header(4, 2), kind: token, tsonic: null };
  const phase = { ...typedValue(1), role };
  if (role === "arithmetic" || role === "comparison") phase.operation = { kind: "decided", decision: {
    permissionScope: null, decision: { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "int32" },
      operands: [1, 1], result: 1, execution: { kind: "pure" } } } };
  if (role === "assignment") { phase.storage = 1; phase.calculation = null; phase.selection = null; }
  if (role === "short-circuit") phase.selection = { kind: "and", control: 3, right: 5, disposition: "right" };
  const typed = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, left: value(3), type: null,
    operatorToken: operator, right: value(5), tsonic: phase };
  const checked = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, left: checkedLeft, type: null,
    operatorToken: operator, right: checkedRight,
    tsonic: { core: emptyCore(), value: checkedValue(1), role,
      ...(role === "assignment" ? { target: { kind: "unavailable", reason: "not-provided" } } : {}) } };
  return expressionScenario(checked, typed, [checkedLeft, operator, checkedRight], 6, [{ kind: "primitive", primitive: "int32" }]);
}

function nestedPartScenario(holder) {
  let fixture;
  let node;
  let install;
  if (holder === "calculation") {
    fixture = binaryScenario("assignment", "PlusEqualsToken");
    node = fixture.typed;
    install = operation => { node.tsonic.calculation = { kind: "decided", decision: operation }; };
  } else if (holder === "protocol") {
    fixture = argumentScenario("empty");
    node = fixture.body.root.statements.nodes[0].expression.arguments.nodes[0];
    install = operation => { node.tsonic.protocol.decision.steps = [{ role: "value", operation, callee: null }]; };
  } else {
    const body = emptyModuleBody();
    node = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList(),
      tsonic: { role: "using", asynchronous: false, protocols: [] } };
    const checked = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList(),
      tsonic: { core: emptyCore(), disposal: [available({ kind: "dispose", asynchronous: false, subject: 2, signature: 0 })] } };
    const typedStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: node, tsonic: null };
    const checkedStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: checked, tsonic: null };
    const end = { ...header(3, 0), kind: "EndOfFile", tsonic: null };
    body.root.statements = nodeList([typedStatement]);
    body.root.endOfFileToken = end;
    const input = emptyVerificationInput(body, [checkedStatement, checked, end]);
    input.source.tree.statements = nodeList([checkedStatement]);
    input.source.tree.endOfFileToken = end;
    fixture = { body, input };
    install = operation => { node.tsonic.protocols = [{ kind: "decided", decision: { kind: "dispose", asynchronous: false,
      steps: [{ role: "dispose", operation, callee: null }], value: 0, completion: 0, sent: null, thrown: 0 } }]; };
  }
  const key = { kind: "text", value: "x" };
  const reference = { body: bodyId, node: node.id };
  const root = { kind: "body", value: reference };
  const provenance = { kind: "mapped", owner: root, key };
  const member = { key, origins: [provenance], readOrigins: [provenance], writeOrigins: [provenance], kind: "property",
    read: 0, write: 0, optional: false, readonly: false };
  const receiver = fixture.input.types.terms.length;
  fixture.input.types.terms.push({ kind: "shape", members: [member], indexes: [], calls: [], constructs: [] });
  const decision = { key, origins: [provenance], selectedDeclarations: [], primary: null, read: 0, write: 0,
    getter: null, setter: null, bindings: emptyBindings(), location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
  const part = { part: 0, source: reference, destination: { root, path: [] }, member: decision, embedding: { kind: "identity" } };
  const operation = { permissionScope: null, decision: { kind: "selected",
    operation: { kind: "object-construction", parts: [part] }, operands: [], result: holder === "calculation" ? 1 : receiver, execution: { kind: "pure" } } };
  install(operation);
  const table = { receiver, members: [member], indexes: [], calls: [], constructs: [], accessors: [], constructors: [],
    completeness: { kind: "complete" } };
  const fact = { instance: { body: bodyId, bindings: { kind: "parametric" } }, occurrence: { kind: "construction-part",
    node: node.id, ordinal: 0, source: reference, destination: { root, path: [] }, part: 0 }, table };
  const queries = [];
  fixture.input.memberTableOf = (instance, occurrence) => {
    queries.push({ instance, occurrence });
    return isDeepStrictEqual(instance, fact.instance) && isDeepStrictEqual(occurrence, fact.occurrence) ? fact.table : null;
  };
  bodyScopes(fixture.input, fixture.body).push(emptyScope());
  return { ...fixture, node, fact, queries };
}

const valueFact = typedValue;
const valueWire = "type=t:0, convertedType=t:0, conversion=identity(), narrowing=null, evidenceIndex=null, demand=always()";
const headerWire = 'id=n:0, origin=Origin(module=mod:"M[P[p];m]", start=0, length=0, derived=[]), parent=null, flags=[], loc=TextRange(pos=0, end=0)';
const localWire = `LocalRef(body=body:"${bodyId}", local=l:0)`;
const syntaxHeaderWire = (identity, parent, flags = []) => `id=n:${identity}, origin=Origin(module=mod:"${moduleId}", start=0, length=0, derived=[]), ` +
  `parent=${parent === null ? "null" : `n:${parent}`}, flags=${JSON.stringify(flags)}, loc=TextRange(pos=0, end=0)`;
const fullCodecHeader = (identity, parent = null) => ({ ...header(identity, parent), flags: ["Ambient"] });
const fullCodecHeaderWire = (identity, parent) => syntaxHeaderWire(identity, parent, ["Ambient"]);
const fullCodecValue = (type = 0) => ({ ...typedValue(type), narrowing: { kind: "identity", type }, evidenceIndex: 0 });

function assertBodyRoundTrip(body, expected, name) {
  assertCompleteValue(product.printTir(body), expected, `${name} complete independently authored wire`, sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, `${name} complete independently authored value`, compareCaseValues);
}

function syntaxPayloadCase(payload, definitions) {
  const body = emptyModuleBody();
  const last = definitions.length + 4;
  const tagName = { ...header(3, 2), kind: "Identifier", text: "type",
    tsonic: { role: "property-name", key: { kind: "text", value: "type" } } };
  const tag = { ...header(2, 1), kind: "JSDocTypeTag", tagName, comment: null, typeExpression: payload, tsonic: null };
  const type = { ...header(1, 0), kind: "JSDocTypeLiteral", jsDocPropertyTags: [tag], isArrayType: false, tsonic: null };
  const expression = { ...header(last, 0), kind: "Identifier", text: "value",
    tsonic: { ...typedValue(), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } } };
  body.root = { ...header(0), kind: "TypeAssertionExpression", type, expression, tsonic: typedValue() };
  const expected = [readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0],
    `n:0=TypeAssertionExpression(${syntaxHeaderWire(0, null)}, type=n:1, expression=n:${last}, tsonic=TypedValue(${valueWire}))`,
    `n:1=JSDocTypeLiteral(${syntaxHeaderWire(1, 0)}, jsDocPropertyTags=[n:2], isArrayType=false, tsonic=null)`,
    `n:2=JSDocTypeTag(${syntaxHeaderWire(2, 1)}, tagName=n:3, comment=null, typeExpression=n:4, tsonic=null)`,
    `n:3=Identifier(${syntaxHeaderWire(3, 2)}, text="type", tsonic=TypedName(role="property-name", key=text(value="type")))`,
    ...definitions.map((definition, position) => `n:${position + 4}=${definition}`),
    `n:${last}=Identifier(${syntaxHeaderWire(last, 0)}, text="value", tsonic=TypedName(${valueWire}, role="value", ` +
      `resolution=definition(definition=def:"${ownerId}", aliases=[])))`,
  ].join("\n") + "\n";
  return { body, expected };
}

function assertSyntaxPayload(payload, definitions, name) {
  const { body, expected } = syntaxPayloadCase(payload, definitions);
  assertBodyRoundTrip(body, expected, name);
}

function assertExpressionRoundTrip(kind, fields, fieldsWire, phase, phaseWire) {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind, ...fields, tsonic: phase };
  const bodyHeader = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0];
  const expected = `${bodyHeader}\nn:0=${kind}(${headerWire}${fieldsWire.length === 0 ? "" : `, ${fieldsWire}`}, tsonic=${phaseWire})\n`;
  assertCompleteValue(product.printTir(body), expected, `${kind} complete independently authored spelling`, sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, `${kind} complete declared value, not only selected fields`, compareCaseValues);
}

for (const path of [...functionCases, ...verifierCases]) {
  test(`ir-tir authored case ${basename(path, ".case.json")}`, async () => {
    const result = await runCase({ modules: ["ir-tir"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"), list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => {
        assert.equal(input.format, "tir");
        return { kind: "accepted", value: product.parseTir(input.text), diagnostics: [] };
      }, verifier: input => {
        assert.equal(input.format, "tir");
        const parsed = product.parseTir(input.text);
        assert.equal(parsed.kind, "parsed", "verifier input is independently authored and schema-valid");
        return { kind: "accepted", value: product.verifyTir(emptyVerificationInput(parsed.value), parsed.value), diagnostics: [] };
      } },
    }, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }));
  });
}

test("exact five annotated runtime ports, no parallel printer or private metadata API", () => {
  assertCompleteValue(Object.keys(product).sort(), ["memberSelectionKey", "parseTir", "printTir", "verifyTir", "verifyTirModule"]);
});

test("the member selection key separates two selections that differ in any one field, and is total over lists with holes", () => {
  const owner = "D[M[P[p];m];owner]";
  const other = "D[M[P[p];m];other]";
  const body = "B[D[M[P[p];m];owner];function;0]";
  const endpoint = { declaration: owner, role: "advertised", signature: 0, body };
  const rigid = { kind: "rigid", parameter: { owner, index: 0 } };
  const vector = changes => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [], ...changes });
  const callee = { decision: { candidate: 0, advertised: endpoint, api: { ...endpoint, role: "api-body" }, bindings: vector({}),
    implementationBindings: vector({}), parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
  activation: null, captures: [{ body, local: 0 }] };
  const base = { decision: { key: { kind: "text", value: "x" }, origins: [{ kind: "declared", declaration: owner }],
    selectedDeclarations: [owner], primary: owner, read: 0, write: 0, getter: null, setter: null, bindings: vector({}),
    location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: callee, setter: null };
  const decisionChanges = [
    { key: { kind: "text", value: "y" } }, { key: { kind: "symbol", declaration: owner } },
    { key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: false } } },
    { key: { kind: "number", value: { numerator: 0n, denominator: 1n, negativeZero: true } } },
    { origins: [] }, { origins: [{ kind: "declared", declaration: other }] }, { origins: [{ kind: "class-prototype", owner }] },
    { origins: [{ kind: "mapped", owner: { kind: "body", value: { body, node: 0 } }, key: { kind: "text", value: "x" } }] },
    { origins: [{ kind: "mapped", owner: { kind: "item", value: { owner, node: 0 } }, key: { kind: "text", value: "x" } }] },
    { selectedDeclarations: [] }, { selectedDeclarations: [other] }, { primary: null }, { read: null }, { read: 1 }, { write: null }, { write: 1 },
    { getter: endpoint }, { setter: endpoint }, { bindings: vector({ classBindings: [rigid] }) }, { bindings: vector({ methodBindings: [rigid] }) },
    { bindings: vector({ capturedBindings: [rigid] }) }, { bindings: vector({ selfBindings: [{ kind: "rigid", owner }] }) },
    { location: { kind: "accessor" } }, { location: { kind: "data", check: { kind: "none" }, receiver: "by-reference" } },
    { location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "in-place" } },
    { location: { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "in-place" } },
  ];
  const calleeDecisionChanges = [
    { candidate: 1 }, { advertised: { ...endpoint, signature: 1 } }, { advertised: { ...endpoint, declaration: other } },
    { api: { ...endpoint, role: "api-signature" } }, { api: { ...endpoint, role: "api-body", body: null } },
    { bindings: vector({ classBindings: [rigid] }) }, { implementationBindings: vector({ classBindings: [rigid] }) }, { parameters: [] },
    { parameters: [{ kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" }] },
    { parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "move" }] },
    { parameters: [{ kind: "default", parameter: 0, initializer: body }] }, { parameters: [{ kind: "omitted", parameter: 0, type: 0 }] },
    { parameters: [{ kind: "rest", parameter: 0, arguments: [0], passing: "by-value" }] },
    { parameters: [{ kind: "rest", parameter: 0, arguments: [0, 1], passing: "by-value" }] },
    { completion: { signature: 1, completion: 0, yielded: null, sent: null } }, { completion: { signature: 0, completion: 1, yielded: null, sent: null } },
    { completion: { signature: 0, completion: 0, yielded: 0, sent: null } }, { completion: { signature: 0, completion: 0, yielded: null, sent: 0 } },
    { result: 1 }, { activation: "at-creation" }, { activation: "when-first-driven" },
  ];
  const calleeChanges = [
    { activation: { body, bindings: { kind: "parametric" } } }, { activation: { body, bindings: { kind: "instantiated", bindings: vector({}) } } },
    { activation: { body, bindings: { kind: "instantiated", bindings: vector({ classBindings: [rigid] }) } } },
    { captures: [] }, { captures: [{ body, local: 1 }] }, { captures: [{ body, local: 0 }, { body, local: 0 }] },
  ];
  const variants = [
    ...decisionChanges.map(change => ({ ...base, decision: { ...base.decision, ...change } })),
    ...calleeDecisionChanges.map(change => ({ ...base, getter: { ...callee, decision: { ...callee.decision, ...change } } })),
    ...calleeChanges.map(change => ({ ...base, getter: { ...callee, ...change } })),
    { ...base, getter: null }, { ...base, setter: callee }, { ...base, getter: null, setter: callee },
  ];
  const keys = [base, ...variants].map(member => JSON.stringify(product.memberSelectionKey(member),
    (_name, value) => typeof value === "bigint" ? `${value}n` : value));
  assert.equal(new Set(keys).size, keys.length, "every one-field change gives a different key");
  assert.equal(keys.length, 1 + decisionChanges.length + calleeDecisionChanges.length + calleeChanges.length + 3);
  assertCompleteValue(product.memberSelectionKey(structuredClone(base)), product.memberSelectionKey(base));
  const holes = structuredClone(base);
  holes.decision.origins = new Array(2);
  holes.decision.selectedDeclarations = new Array(1);
  holes.getter.captures = new Array(1);
  holes.getter.decision.parameters = [undefined, { kind: "rest", parameter: 0, arguments: new Array(1), passing: "by-value" }];
  holes.getter.decision.bindings = vector({ classBindings: new Array(1) });
  const holed = product.memberSelectionKey(holes);
  assertCompleteValue(holed[1], [null, null]);
  assertCompleteValue(holed[2], [null]);
  assertCompleteValue(holed[10][3], null);
  assertCompleteValue(holed[10][5], [null, ["rest", 0, [null], "by-value"]]);
  assertCompleteValue(holed[10][10], [null]);
});

test("native syntax comparison checks every declared ordinary field without discovering object properties", () => {
  const makeSyntax = (kind, id, properties) => ({ ...header(id), kind, ...properties, tsonic: null });
  const makeRows = (count, absent, reverse) => syntaxConstructorInputs(makeSyntax, nodeList, count, absent, reverse);
  const canonical = new Map(makeRows(1, false, false).map(row => [row.node.kind, row.node]));
  const alternateNode = (node, kinds) => {
    const kind = kinds.find(candidate => candidate !== node.kind);
    const selected = canonical.get(kind);
    assert.equal(selected !== undefined, true, `complete independent constructor for ${kind}`);
    return selected;
  };
  const rows = [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]]
    .flatMap(([count, absent, reverse]) => makeRows(count, absent, reverse));
  for (const node of canonical.values()) {
    const fields = syntaxFieldMutations.get(node.kind);
    if (fields.some(field => field.name.startsWith("tokenFlags."))) rows.push({ node: { ...node, tokenFlags: ["Scientific", "Unterminated"] } });
    if (fields.some(field => field.name.startsWith("templateFlags."))) rows.push({ node: { ...node, templateFlags: ["Scientific", "Unterminated"] } });
  }
  const source = canonical.get("SourceFile");
  rows.push({ node: { ...canonical.get("ImportClause"), phaseModifier: "TypeKeyword" } });
  rows.push({ node: { ...source, commentDirectives: [{ kind: "ExpectError", loc: { pos: 1, end: 2 } }],
    pragmas: [{ kind: "SingleLineCommentTrivia", pos: 3, end: 4, hasTrailingNewLine: false, name: "reference",
      args: [{ name: "first", value: { pos: 5, end: 6, name: "path", value: "one" } },
        { name: "second", value: { pos: 7, end: 8, name: "types", value: "two" } }] }],
    checkJsDirective: { enabled: true, range: { kind: "SingleLineCommentTrivia", pos: 9, end: 10, hasTrailingNewLine: true } } } });
  const kinds = [...canonical.keys()];
  assert.equal(kinds.length, syntaxFieldMutations.size, "the actual independent constructor and declared-field families agree completely");
  const exercised = new Set();
  for (const { node } of rows) {
    const fields = syntaxFieldMutations.get(node.kind);
    assert.equal(fields !== undefined, true, `${node.kind}: complete field relation`);
    assert.equal(sameSyntaxFields(node, { ...node }), true, `${node.kind}: complete equal ordinary payload`);
    assert.equal(sameSyntaxFields(node, { ...node, id: 900, parent: 800, loc: { pos: 1, end: 2 },
      origin: { module: "M[P[other];other]", start: 3, length: 4, derived: [] }, tsonic: null }), true,
    `${node.kind}: independently verified headers are not ordinary syntax fields`);
    assert.equal(sameSyntaxFields(node, canonical.get(kinds[(kinds.indexOf(node.kind) + 1) % kinds.length])), false,
      `${node.kind}: different actual syntax constructor`);
    for (const field of fields) {
      if (!field.when(node)) continue;
      const changed = field.change(node, alternateNode);
      assert.equal(sameSyntaxFields(node, changed), false, `${node.kind}/${field.name}: genuine declared-field mismatch`);
      assert.equal(sameSyntaxFields(changed, node), false, `${node.kind}/${field.name}: complete opposite orientation`);
      exercised.add(`${node.kind}/${field.name}`);
    }
  }
  const required = [...syntaxFieldMutations].flatMap(([kind, fields]) => fields.map(field => `${kind}/${field.name}`)).sort();
  assertCompleteValue([...exercised].sort(), required, "every contract-derived field mutation has an actual complete fixture");
  const flagged = { ...source, flags: ["Let", "Const"] };
  assert.equal(sameSyntaxFields(source, flagged), false);
  assert.equal(sameSyntaxFields(flagged, { ...flagged, flags: ["Let", "Const"] }), true);
  assert.equal(sameSyntaxFields(flagged, { ...flagged, flags: ["Const", "Let"] }), false);
  const sparse = { ...flagged, flags: new Array(2) };
  assert.equal(sameSyntaxFields(sparse, flagged), false);
  assert.equal(sameSyntaxFields(flagged, sparse), false);
});

test("native named-entry comparison rejects missing or duplicate keys on either supplied side", () => {
  const body = emptyModuleBody();
  const entries = [
    { name: "first", value: { pos: 0, end: 1, name: "path", value: "one" } },
    { name: "second", value: { pos: 2, end: 3, name: "types", value: "two" } },
  ];
  const root = args => ({ ...body.root, pragmas: [{ kind: "SingleLineCommentTrivia", pos: 0, end: 4,
    hasTrailingNewLine: false, name: "reference", args }] });
  const valid = root(entries);
  assert.equal(sameSyntaxFields(valid, root([...entries].reverse())), true, "named entries have canonical key identity, not input insertion order");
  for (const invalid of [[entries[0], entries[0]], new Array(2)]) {
    assert.equal(sameSyntaxFields(valid, root(invalid)), false);
    assert.equal(sameSyntaxFields(root(invalid), valid), false);
  }
});

test("native number text preserves complete fractional mantissas and both explicit exponent signs", () => {
  const body = emptyModuleBody();
  body.root.loc = { pos: 1.125e+21, end: 1.25e-7 };
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const expected = original.replace("loc=TextRange(pos=0, end=0), statements=", "loc=TextRange(pos=1.125e+21, end=1.25e-7), statements=");
  assertBodyRoundTrip(body, expected, "complete declared numeric fields, not a semantic valid-range certificate");
});

test("actual source metadata preserves directives, dynamic pragma names, comment geometry and derivations", () => {
  const body = emptyModuleBody();
  body.root.origin.derived = [{ kind: "lowering", pass: "elaborate" }, { kind: "expansion", expansion: "expansion" }];
  body.root.commentDirectives = [{ loc: { pos: 1, end: 2 }, kind: "ExpectError" }, { loc: { pos: 3, end: 4 }, kind: "Ignore" }];
  body.root.pragmas = [{ pos: 5, end: 10, kind: "SingleLineCommentTrivia", hasTrailingNewLine: true, name: "reference",
    args: [{ name: "escaped-name", value: { pos: 8, end: 10, name: "escaped-name", value: "value" } },
      { name: "types", value: { pos: 6, end: 8, name: "types", value: "ambient" } }] }];
  body.root.checkJsDirective = { enabled: false, range: { pos: 11, end: 15, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false } };
  const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const expected = baseline.replace(`n:0=SourceFile(id=n:0, origin=Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`,
    `n:0=SourceFile(id=n:0, origin=Origin(module=mod:"${moduleId}", start=0, length=0, ` +
      'derived=[lowering(pass="elaborate"), expansion(expansion=exp:"expansion")])')
    .replace("commentDirectives=[], pragmas=[], checkJsDirective=null", 'commentDirectives=[' +
      'CommentDirective(loc=TextRange(pos=1, end=2), kind="ExpectError"), CommentDirective(loc=TextRange(pos=3, end=4), kind="Ignore")], ' +
      'pragmas=[Pragma(pos=5, end=10, kind="SingleLineCommentTrivia", hasTrailingNewLine=true, name="reference", ' +
      'args=PragmaArguments("escaped-name"=PragmaArgument(pos=8, end=10, name="escaped-name", value="value"), ' +
      'types=PragmaArgument(pos=6, end=8, name="types", value="ambient")))], ' +
      'checkJsDirective=CheckJsDirective(enabled=false, range=CommentRange(pos=11, end=15, kind="MultiLineCommentTrivia", hasTrailingNewLine=false))');
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "entire independently authored source metadata", compareCaseValues);
  assertCompleteValue(product.printTir(parsed.value), expected, "entire source metadata wire without dynamic-name normalization", sameWire);
  const unquoted = product.parseTir(expected.replace('"escaped-name"=', "escaped-name="));
  assert.equal(unquoted.kind, "parsed");
  assertCompleteValue(unquoted.value, body, "grammar-admitted unquoted dynamic name retains the same entire value", compareCaseValues);
  assertCompleteValue(product.printTir(unquoted.value), expected, "canonical field quoting is independent of the admitted input spelling", sameWire);
});

for (const scriptKind of ["Unknown", "JS", "JSX", "TS", "TSX", "External", "JSON", "Deferred"]) {
  test(`the complete source-file ${scriptKind} kind retains its authored language variant`, () => {
    const body = emptyModuleBody();
    const languageVariant = scriptKind === "JSX" || scriptKind === "TSX" ? "JSX" : "Standard";
    body.root.scriptKind = scriptKind;
    body.root.languageVariant = languageVariant;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace('scriptKind="TS"', `scriptKind="${scriptKind}"`)
      .replace('languageVariant="Standard"', `languageVariant="${languageVariant}"`);
    assertBodyRoundTrip(body, expected, scriptKind);
  });
}

test("every saved syntax flag is retained in its supplied vector order, not reinterpreted as a scalar mask", () => {
  const flags = ["Let", "Const", "Using", "OptionalChain", "DisallowInContext", "YieldContext", "DecoratorContext", "AwaitContext",
    "DisallowConditionalTypesContext", "ThisNodeHasError", "JavaScriptFile", "ThisNodeOrAnySubNodesHasError", "HasJSDoc", "JSDoc", "Ambient",
    "InWithStatement", "JsonFile", "IdentifierHasExtendedUnicodeEscape", "IdentifierIsInJSDocNamespace", "NestedNamespace", "AwaitUsing"];
  for (const supplied of [flags, [...flags].reverse()]) {
    const body = emptyModuleBody();
    body.root.flags = supplied;
    const flagsWire = `[${supplied.map(flag => JSON.stringify(flag)).join(", ")}]`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("flags=[]", `flags=${flagsWire}`);
    assertBodyRoundTrip(body, expected, "all saved syntax flags");
  }
});

test("F4 every lexical string escape has a complete public document and exact failure position", () => {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind: "StringLiteral", text: "/", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "/" } };
  const prefix = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0] +
    `\nn:0=StringLiteral(${syntaxHeaderWire(0, null)}, text=`;
  const suffix = `, tokenFlags=[], tsonic=TypedString(${valueWire}, role="value", value="/"))\n`;
  const canonical = prefix + '"/"' + suffix;
  const escaped = prefix + '"\\/"' + suffix;
  assertCompleteValue(product.parseTir(escaped), { kind: "parsed", value: body }, "complete escaped solidus", compareCaseValues);
  assertBodyRoundTrip(body, canonical, "canonical solidus");
  const character = "\u0001";
  const control = prefix + '"' + character + '"' + suffix;
  assertInvalidText(control, prefix.length + 1, ["JSON string character"], character);
  const escape = prefix + '"\\u';
  assertInvalidText(escape, escape.length, ["four hexadecimal digits"], null);
  const backslash = prefix + '"\\';
  assertInvalidText(backslash, backslash.length, ["JSON escape"], null);
  const validControl = prefix + '"\\u0001"' + suffix.replace('value="/"', 'value="\\u0001"');
  body.root.text = character;
  body.root.tsonic.value = character;
  assertCompleteValue(product.parseTir(validControl), { kind: "parsed", value: body }, "complete escaped control", compareCaseValues);
  assertCompleteValue(product.printTir(body), validControl, "entire canonical escaped control", sameWire);
});


test("every token flag retains its exact closed spelling and vector order", () => {
  const flags = ["PrecedingLineBreak", "PrecedingJSDocComment", "Unterminated", "ExtendedUnicodeEscape", "Scientific", "Octal", "HexSpecifier",
    "BinarySpecifier", "OctalSpecifier", "ContainsSeparator", "UnicodeEscape", "ContainsInvalidEscape", "HexEscape", "ContainsLeadingZero",
    "ContainsInvalidSeparator", "PrecedingJSDocLeadingAsterisks", "SingleQuote", "PrecedingJSDocWithDeprecated", "PrecedingJSDocWithSeeOrLink"];
  for (const supplied of [flags, [...flags].reverse()]) {
    const flagsWire = `[${supplied.map(flag => JSON.stringify(flag)).join(", ")}]`;
    assertExpressionRoundTrip("StringLiteral", { text: "literal", tokenFlags: supplied }, `text="literal", tokenFlags=${flagsWire}`,
      { ...typedValue(), role: "value", value: "literal" }, `TypedString(${valueWire}, role="value", value="literal")`);
  }
});

{
const header = fullCodecHeader;
const syntaxHeaderWire = fullCodecHeaderWire;
const typedValue = fullCodecValue;
const valueWire = "type=t:0, convertedType=t:0, conversion=identity(), narrowing=identity(type=t:0), evidenceIndex=0, demand=always()";
const plainTokenCases = [
  "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia",
  "ConflictMarkerTrivia", "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "OpenBraceToken", "CloseBraceToken",
  "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken", "DotToken", "DotDotDotToken",
  "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken", "GreaterThanToken",
  "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken", "EqualsEqualsEqualsToken",
  "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken", "AsteriskToken", "AsteriskAsteriskToken",
  "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken",
  "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken", "ExclamationToken", "TildeToken",
  "AmpersandAmpersandToken", "BarBarToken", "QuestionToken", "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken",
  "HashToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken",
  "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken",
  "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken",
  "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken", "JSDocCommentTextToken",
  "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword",
  "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword",
  "FinallyKeyword", "ForKeyword", "FunctionKeyword", "IfKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword",
  "ReturnKeyword", "SwitchKeyword", "ThrowKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "WhileKeyword", "WithKeyword",
  "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword",
  "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword", "AssertsKeyword", "AssertKeyword",
  "AsyncKeyword", "AwaitKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword", "InferKeyword",
  "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword",
  "SatisfiesKeyword", "SetKeyword", "TypeKeyword", "UniqueKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword",
  "OverrideKeyword", "OfKeyword", "DeferKeyword",
];
for (const kind of plainTokenCases) {
  test(`actual public SyntaxNode token family ${kind} retains its complete record`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}

const codecName = (identity, parent) => ({ ...header(identity, parent), kind: "Identifier", text: "name",
  tsonic: { ...typedValue(), role: "value", resolution: { kind: "definition", definition: ownerId, aliases: [] } } });
const codecNameWire = (identity, parent) => `Identifier(${syntaxHeaderWire(identity, parent)}, text="name", ` +
  `tsonic=TypedName(${valueWire}, role="value", resolution=definition(definition=def:"${ownerId}", aliases=[])))`;
const codecText = (identity, parent) => ({ ...header(identity, parent), kind: "JsxText", text: "text", tokenFlags: [],
  containsOnlyTriviaWhiteSpaces: false, tsonic: null });
const codecTextWire = (identity, parent) => `JsxText(${syntaxHeaderWire(identity, parent)}, text="text", ` +
  'tokenFlags=[], containsOnlyTriviaWhiteSpaces=false, tsonic=null)';
const codecType = (identity, parent) => ({ ...header(identity, parent), kind: "AnyKeyword", tsonic: { type: 0, declarations: [] } });
const codecTypeWire = (identity, parent) => `AnyKeyword(${syntaxHeaderWire(identity, parent)}, tsonic=TypedType(type=t:0, declarations=[]))`;
const codecDocText = (identity, parent) => ({ ...header(identity, parent), kind: "JSDocText", text: ["comment", ""], tsonic: null });
const codecDocTextWire = (identity, parent) => `JSDocText(${syntaxHeaderWire(identity, parent)}, text=["comment", ""], tsonic=null)`;

for (const kind of ["AnyKeyword", "UnknownKeyword", "NumberKeyword", "BigIntKeyword", "ObjectKeyword", "BooleanKeyword",
  "StringKeyword", "SymbolKeyword", "VoidKeyword", "UndefinedKeyword", "NeverKeyword", "IntrinsicKeyword"]) {
  test(`the ${kind} type syntax retains its nonempty declaration vector`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: { type: 0, declarations: [ownerId] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tsonic=TypedType(type=t:0, declarations=[def:"${ownerId}"]))`,
    ], kind);
  });
}

for (const [kind, field] of [["ArrayType", "elementType"], ["OptionalType", "type"], ["RestType", "type"],
  ["ParenthesizedType", "type"]]) {
  test(`the complete ${kind} type keeps its actual authored child`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: codecType(5, 4), tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=n:5, tsonic=TypedType(type=t:0, declarations=[]))`, codecTypeWire(5, 4),
    ], kind);
  });
}

for (const [kind, field] of [["UnionType", "types"], ["IntersectionType", "types"], ["TupleType", "elements"]]) {
  test(`the complete nonempty ${kind} vector has independent type syntax and framing`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: nodeList([codecType(5, 4)]), tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        'tsonic=TypedType(type=t:0, declarations=[]))', codecTypeWire(5, 4),
    ], kind);
  });
}

test("all four conditional-type syntax children remain distinct and declared-order complete", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ConditionalType", checkType: codecType(5, 4), extendsType: codecType(6, 4),
    trueType: codecType(7, 4), falseType: codecType(8, 4), tsonic: { type: 0, declarations: [] } }, [
    `ConditionalType(${syntaxHeaderWire(4, 2)}, checkType=n:5, extendsType=n:6, trueType=n:7, falseType=n:8, ` +
      'tsonic=TypedType(type=t:0, declarations=[]))',
    codecTypeWire(5, 4), codecTypeWire(6, 4), codecTypeWire(7, 4), codecTypeWire(8, 4),
  ], "conditional type");
});

for (const operator of ["KeyOfKeyword", "UniqueKeyword", "ReadonlyKeyword"]) {
  test(`a ${operator} type operation preserves its exact closed token`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "TypeOperator", operator, type: codecType(5, 4),
      tsonic: { type: 0, declarations: [] } }, [
      `TypeOperator(${syntaxHeaderWire(4, 2)}, operator="${operator}", type=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
      codecTypeWire(5, 4),
    ], `type ${operator}`);
  });
}

test("indexed-access type syntax retains separate object and index type references", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "IndexedAccessType", objectType: codecType(5, 4), indexType: codecType(6, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `IndexedAccessType(${syntaxHeaderWire(4, 2)}, objectType=n:5, indexType=n:6, tsonic=TypedType(type=t:0, declarations=[]))`,
    codecTypeWire(5, 4), codecTypeWire(6, 4),
  ], "indexed-access type");
});

for (const [kind, name] of [["TypeReference", "typeName"], ["TypeQuery", "exprName"]]) {
  test(`the complete ${kind} includes actual type arguments and a qualified-name slot`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, typeArguments: nodeList([codecType(5, 4)]), [name]: codecName(6, 4),
      tsonic: { type: 0, declarations: [] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        `${name}=n:6, tsonic=TypedType(type=t:0, declarations=[]))`, codecTypeWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}

test("the literal and this-type syntax owners retain their exact phase family", () => {
  const literal = { ...header(5, 4), kind: "StringLiteral", text: "literal", tokenFlags: [],
    tsonic: { role: "type-literal", type: 0 } };
  assertSyntaxPayload({ ...header(4, 2), kind: "LiteralType", literal, tsonic: { type: 0, declarations: [] } }, [
    `LiteralType(${syntaxHeaderWire(4, 2)}, literal=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
    `StringLiteral(${syntaxHeaderWire(5, 4)}, text="literal", tokenFlags=[], tsonic=TypedString(role="type-literal", type=t:0))`,
  ], "literal type");
  assertSyntaxPayload({ ...header(4, 2), kind: "ThisType", tsonic: { type: 0, declarations: [] } }, [
    `ThisType(${syntaxHeaderWire(4, 2)}, tsonic=TypedType(type=t:0, declarations=[]))`,
  ], "this type");
});

test("named tuple members retain authored rest/name/optional/type children in declaration order", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "NamedTupleMember",
    dotDotDotToken: { ...header(5, 4), kind: "DotDotDotToken", tsonic: null }, name: codecName(6, 4),
    questionToken: { ...header(7, 4), kind: "QuestionToken", tsonic: null }, type: codecType(8, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `NamedTupleMember(${syntaxHeaderWire(4, 2)}, dotDotDotToken=n:5, name=n:6, questionToken=n:7, type=n:8, ` +
      'tsonic=TypedType(type=t:0, declarations=[]))',
    `DotDotDotToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4),
    `QuestionToken(${syntaxHeaderWire(7, 4)}, tsonic=null)`, codecTypeWire(8, 4),
  ], "named tuple member");
});

test("import-type syntax retains nullable attributes and nonempty actual type arguments", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportType", typeArguments: nodeList([codecType(5, 4)]), isTypeOf: true,
    argument: codecType(6, 4), attributes: null, qualifier: codecName(7, 4), tsonic: { type: 0, declarations: [] } }, [
    `ImportType(${syntaxHeaderWire(4, 2)}, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'isTypeOf=true, argument=n:6, attributes=null, qualifier=n:7, tsonic=TypedType(type=t:0, declarations=[]))',
    codecTypeWire(5, 4), codecTypeWire(6, 4), codecNameWire(7, 4),
  ], "import type");
});

for (const kind of ["JsxOpeningFragment", "JsxClosingFragment"]) {
  test(`complete ${kind} is admitted through the actual public syntax family`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}

test("JSX text and empty attributes retain every declared field", () => {
  assertSyntaxPayload(codecText(4, 2), [codecTextWire(4, 2)], "JSX text");
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttributes", properties: nodeList(), tsonic: null },
    [`JsxAttributes(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`], "JSX attributes");
});

test("JSX namespace names preserve both actual child objects", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxNamespacedName", namespace: codecName(5, 4), name: codecName(6, 4), tsonic: null },
    [`JsxNamespacedName(${syntaxHeaderWire(4, 2)}, namespace=n:5, name=n:6, tsonic=null)`,
      codecNameWire(5, 4), codecNameWire(6, 4)], "JSX namespace");
});

for (const present of [false, true]) {
  test(`JSX expression retains its ${present ? "present spread/value" : "null spread/value"} children`, () => {
    const token = { ...header(5, 4), kind: "DotDotDotToken", tsonic: null };
    const expression = codecName(6, 4);
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxExpression", dotDotDotToken: present ? token : null,
      expression: present ? expression : null, tsonic: null },
    [`JsxExpression(${syntaxHeaderWire(4, 2)}, dotDotDotToken=${present ? "n:5" : "null"}, ` +
      `expression=${present ? "n:6" : "null"}, tsonic=null)`,
    ...(present ? [`DotDotDotToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4)] : [])], "JSX expression");
  });
  test(`JSX attributes retain ${present ? "present" : "absent"} attribute values`, () => {
    const initializer = { ...header(6, 4), kind: "StringLiteral", text: "value", tokenFlags: [],
      tsonic: { role: "attribute-value", value: "value" } };
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttribute", name: codecName(5, 4), initializer: present ? initializer : null, tsonic: null },
      [`JsxAttribute(${syntaxHeaderWire(4, 2)}, name=n:5, initializer=${present ? "n:6" : "null"}, tsonic=null)`, codecNameWire(5, 4),
        ...(present ? [`StringLiteral(${syntaxHeaderWire(6, 4)}, text="value", tokenFlags=[], ` +
          'tsonic=TypedString(role="attribute-value", value="value"))'] : [])], "JSX attribute");
  });
}

for (const kind of ["JsxSpreadAttribute", "JsxClosingElement"]) {
  test(`the complete ${kind} child is not replaced with a copied or inferred expression`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, ...(kind === "JsxSpreadAttribute" ? { expression: codecName(5, 4) }
      : { tagName: codecName(5, 4) }), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, ${kind === "JsxSpreadAttribute" ? "expression" : "tagName"}=n:5, tsonic=null)`,
      codecNameWire(5, 4)], kind);
  });
}

for (const kind of ["JsxOpeningElement", "JsxSelfClosingElement"]) {
  test(`${kind} retains actual type arguments and attributes in declaration order`, () => {
    const type = { ...header(6, 4), kind: "AnyKeyword", tsonic: { type: 0, declarations: [] } };
    const attributes = { ...header(7, 4), kind: "JsxAttributes", properties: nodeList(), tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), typeArguments: nodeList([type]), attributes, tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'attributes=n:7, tsonic=null)', codecNameWire(5, 4),
      `AnyKeyword(${syntaxHeaderWire(6, 4)}, tsonic=TypedType(type=t:0, declarations=[]))`,
      `JsxAttributes(${syntaxHeaderWire(7, 4)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`], kind);
  });
}

test("a complete JSX element retains opening/children/closing arenas and exact syntax identities", () => {
  const attributes = { ...header(7, 5), kind: "JsxAttributes", properties: nodeList(), tsonic: null };
  const opening = { ...header(5, 4), kind: "JsxOpeningElement", tagName: codecName(6, 5), typeArguments: null, attributes, tsonic: null };
  const closing = { ...header(9, 4), kind: "JsxClosingElement", tagName: codecName(10, 9), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxElement", openingElement: opening, children: nodeList([codecText(8, 4)]),
    closingElement: closing, tsonic: null }, [
    `JsxElement(${syntaxHeaderWire(4, 2)}, openingElement=n:5, children=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), closingElement=n:9, tsonic=null)`,
    `JsxOpeningElement(${syntaxHeaderWire(5, 4)}, tagName=n:6, typeArguments=null, attributes=n:7, tsonic=null)`, codecNameWire(6, 5),
    `JsxAttributes(${syntaxHeaderWire(7, 5)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`, codecTextWire(8, 4),
    `JsxClosingElement(${syntaxHeaderWire(9, 4)}, tagName=n:10, tsonic=null)`, codecNameWire(10, 9),
  ], "complete JSX element");
});

test("a complete JSX fragment retains both fragment markers and its child record", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxFragment",
    openingFragment: { ...header(5, 4), kind: "JsxOpeningFragment", tsonic: null }, children: nodeList([codecText(6, 4)]),
    closingFragment: { ...header(7, 4), kind: "JsxClosingFragment", tsonic: null }, tsonic: null }, [
    `JsxFragment(${syntaxHeaderWire(4, 2)}, openingFragment=n:5, children=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), closingFragment=n:7, tsonic=null)`,
    `JsxOpeningFragment(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecTextWire(6, 4), `JsxClosingFragment(${syntaxHeaderWire(7, 4)}, tsonic=null)`,
  ], "complete JSX fragment");
});

for (const kind of ["JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocVariadicType", "JSDocOptionalType"]) {
  test(`the complete ${kind} retains its actual type child and null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, type: codecType(5, 4), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, type=n:5, tsonic=null)`, codecTypeWire(5, 4)], kind);
  });
}

test("JSDoc all-type and plain text retain their complete closed records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocAllType", tsonic: null },
    [`JSDocAllType(${syntaxHeaderWire(4, 2)}, tsonic=null)`], "JSDoc all-type");
  assertSyntaxPayload(codecDocText(4, 2), [codecDocTextWire(4, 2)], "JSDoc text");
});

for (const kind of ["JSDocLink", "JSDocLinkPlain", "JSDocLinkCode"]) {
  test(`${kind} retains the full text vector and actual referenced name`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, text: ["first", "second"], name: codecName(5, 4), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, text=["first", "second"], name=n:5, tsonic=null)`, codecNameWire(5, 4)], kind);
  });
}

for (const kind of ["JSDocUnknownTag", "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag"]) {
  test(`${kind} retains its actual name, complete comment list and exact null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]), tsonic: null },
      [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), tsonic=null)`,
        codecNameWire(5, 4), codecDocTextWire(6, 4)], kind);
  });
}

for (const [kind, field] of [["JSDocReturnTag", "typeExpression"], ["JSDocSeeTag", "nameExpression"],
  ["JSDocSatisfiesTag", "typeExpression"], ["JSDocThrowsTag", "typeExpression"], ["JSDocThisTag", "typeExpression"],
  ["JSDocOverloadTag", "typeExpression"]]) {
  test(`${kind} retains its real ${field} child rather than a guessed anonymous payload`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      [field]: codecType(7, 4), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ${field}=n:7, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4)], kind);
  });
}

for (const kind of ["JSDocCallbackTag", "JSDocTypedefTag"]) {
  test(`${kind} retains both independently authored type and full-name children`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      typeExpression: codecType(7, 4), name: codecName(8, 4), tsonic: null },
    [`${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), typeExpression=n:7, name=n:8, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4), codecNameWire(8, 4)], kind);
  });
}

test("JSDoc names and signature fields keep their exact declaration order", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocNameReference", name: codecName(5, 4), tsonic: null },
    [`JSDocNameReference(${syntaxHeaderWire(4, 2)}, name=n:5, tsonic=null)`, codecNameWire(5, 4)], "JSDoc name reference");
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocSignature", typeParameters: nodeList(), parameters: nodeList(),
    type: codecType(5, 4), fullSignature: codecType(6, 4), tsonic: null }, [
    `JSDocSignature(${syntaxHeaderWire(4, 2)}, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
      'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), type=n:5, fullSignature=n:6, tsonic=null)',
    codecTypeWire(5, 4), codecTypeWire(6, 4),
  ], "JSDoc signature");
});

for (const kind of ["JSDocParameterTag", "JSDocPropertyTag"]) {
  test(`${kind} retains its full name/position/type flags without a shared-kind guess`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
      name: codecName(7, 4), isBracketed: true, typeExpression: codecType(8, 4), isNameFirst: false, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'name=n:7, isBracketed=true, typeExpression=n:8, isNameFirst=false, tsonic=null)',
      codecNameWire(5, 4), codecDocTextWire(6, 4), codecNameWire(7, 4), codecTypeWire(8, 4),
    ], kind);
  });
}

test("the full JSDoc owner retains actual comments, tags and their shared closed families", () => {
  const tag = { ...header(6, 4), kind: "JSDocUnknownTag", tagName: codecName(7, 6), comment: nodeList([codecDocText(8, 6)]), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDoc", comment: nodeList([codecDocText(5, 4)]), tags: nodeList([tag]), tsonic: null }, [
    `JSDoc(${syntaxHeaderWire(4, 2)}, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'tags=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), tsonic=null)',
    codecDocTextWire(5, 4), `JSDocUnknownTag(${syntaxHeaderWire(6, 4)}, tagName=n:7, ` +
      'comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), tsonic=null)', codecNameWire(7, 6), codecDocTextWire(8, 6),
  ], "complete JSDoc");
});

test("JSDoc type/template tags use the actual broad syntax slot, not an invented private input", () => {
  const child = { ...header(7, 4), kind: "SyntaxList", children: [codecType(8, 7)], tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTypeTag", tagName: codecName(5, 4),
    comment: nodeList([codecDocText(6, 4)]), typeExpression: child, tsonic: null }, [
    `JSDocTypeTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), typeExpression=n:7, tsonic=null)`,
    codecNameWire(5, 4), codecDocTextWire(6, 4), `SyntaxList(${syntaxHeaderWire(7, 4)}, children=[n:8], tsonic=null)`, codecTypeWire(8, 7),
  ], "JSDoc type tag");
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTemplateTag", tagName: codecName(5, 4),
    comment: nodeList([codecDocText(6, 4)]), constraint: codecType(7, 4), typeParameters: nodeList(), tsonic: null }, [
    `JSDocTemplateTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'constraint=n:7, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)',
    codecNameWire(5, 4), codecDocTextWire(6, 4), codecTypeWire(7, 4),
  ], "JSDoc template tag");
});

test("a JSDoc type literal retains its explicit absent tag vector and array flag", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocTypeLiteral", jsDocPropertyTags: null, isArrayType: true, tsonic: null },
    [`JSDocTypeLiteral(${syntaxHeaderWire(4, 2)}, jsDocPropertyTags=null, isArrayType=true, tsonic=null)`], "JSDoc type literal");
});

test("nonempty JSX attribute lists retain every actual name and initializer record", () => {
  const attribute = { ...header(5, 4), kind: "JsxAttribute", name: codecName(6, 5),
    initializer: { ...header(7, 5), kind: "StringLiteral", text: "value", tokenFlags: ["SingleQuote"],
      tsonic: { role: "attribute-value", value: "value" } }, tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JsxAttributes", properties: nodeList([attribute]), tsonic: null }, [
    `JsxAttributes(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=null)`,
    `JsxAttribute(${syntaxHeaderWire(5, 4)}, name=n:6, initializer=n:7, tsonic=null)`, codecNameWire(6, 5),
    `StringLiteral(${syntaxHeaderWire(7, 5)}, text="value", tokenFlags=["SingleQuote"], tsonic=TypedString(role="attribute-value", value="value"))`,
  ], "nonempty JSX attributes");
});

const codecReference = { body: bodyId, node: 4 };
const codecReferenceWire = `NodeRef(body=body:"${bodyId}", node=n:4)`;
const codecSource = { kind: "body", value: codecReference };
const codecSourceWire = `body(value=${codecReferenceWire})`;
const codecBindingsWire = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
const codecContext = { occurrence: codecReference, origin: origin(), bindings: emptyBindings() };
const codecContextWire = `RuleContext(occurrence=${codecReferenceWire}, origin=Origin(module=mod:"${moduleId}", ` +
  `start=0, length=0, derived=[]), bindings=${codecBindingsWire})`;
const codecEvidence = { ...typeEvidence({ kind: "dynamic" }), component: codecSource };
const codecEvidenceWire = `TypeEvidence(type=t:0, component=${codecSourceWire}, category=dynamic(), ` +
  "numeric=null, sum=null, nominal=null, pointer=null)";
const codecKey = { kind: "text", value: "field" };
const codecKeyWire = 'text(value="field")';
const codecMemberOrigin = { kind: "mapped", owner: codecSource, key: codecKey };
const codecMemberOriginWire = `mapped(owner=${codecSourceWire}, key=${codecKeyWire})`;
const codecEndpoint = { declaration: ownerId, role: "advertised", signature: 0, body: bodyId };
const codecEndpointWire = `HirCallableEndpoint(declaration=def:"${ownerId}", role="advertised", signature=sig:0, body=body:"${bodyId}")`;
const savedInvocationCases = [
  ["embed", { context: codecContext, from: codecEvidence, to: codecEvidence, role: "return" },
    `EmbedInput(context=${codecContextWire}, from=${codecEvidenceWire}, to=${codecEvidenceWire}, role="return")`],
  ["domain-fit", { context: codecContext, value: codecEvidence, domain: codecEvidence },
    `DomainFitInput(context=${codecContextWire}, value=${codecEvidenceWire}, domain=${codecEvidenceWire})`],
  ["memory-equivalent", { context: codecContext, left: codecEvidence, right: codecEvidence },
    `MemoryEquivalentInput(context=${codecContextWire}, left=${codecEvidenceWire}, right=${codecEvidenceWire})`],
  ["member", { context: codecContext, receiver: codecEvidence, key: codecKey, access: "read", origins: [codecMemberOrigin] },
    `MemberInput(context=${codecContextWire}, receiver=${codecEvidenceWire}, key=${codecKeyWire}, access="read", origins=[${codecMemberOriginWire}])`],
  ["index", { context: codecContext, receiver: codecEvidence, key: codecEvidence, access: "write" },
    `IndexInput(context=${codecContextWire}, receiver=${codecEvidenceWire}, key=${codecEvidenceWire}, access="write")`],
  ["construct-literal", { context: codecContext, construction: "object", parts: [
    { kind: "element", occurrence: codecReference, value: codecEvidence },
    { kind: "property", occurrence: codecReference, key: codecKey, value: codecEvidence },
    { kind: "spread", occurrence: codecReference, value: codecEvidence },
  ], destination: codecEvidence }, `LiteralConstructionInput(context=${codecContextWire}, construction="object", parts=[` +
    `element(occurrence=${codecReferenceWire}, value=${codecEvidenceWire}), ` +
    `property(occurrence=${codecReferenceWire}, key=${codecKeyWire}, value=${codecEvidenceWire}), ` +
    `spread(occurrence=${codecReferenceWire}, value=${codecEvidenceWire})], destination=${codecEvidenceWire})`],
  ["candidate", { context: codecContext, kind: "call", callee: codecEvidence, receiver: codecEvidence,
    typeArguments: [codecEvidence], arguments: [{ occurrence: codecReference, kind: "spread", value: codecEvidence,
      tuple: [codecEvidence] }], candidates: [{ ordinal: 0, declaration: ownerId, advertised: codecEndpoint,
      api: { ...codecEndpoint, role: "api-body" }, bindings: emptyBindings(), conditionalFailure: null }] },
    `CandidateInput(context=${codecContextWire}, kind="call", callee=${codecEvidenceWire}, receiver=${codecEvidenceWire}, ` +
    `typeArguments=[${codecEvidenceWire}], arguments=[CandidateArgument(occurrence=${codecReferenceWire}, kind="spread", ` +
    `value=${codecEvidenceWire}, tuple=[${codecEvidenceWire}])], candidates=[CandidateEndpoint(ordinal=0, declaration=def:"${ownerId}", ` +
    `advertised=${codecEndpointWire}, api=HirCallableEndpoint(declaration=def:"${ownerId}", role="api-body", signature=sig:0, ` +
    `body=body:"${bodyId}"), bindings=${codecBindingsWire}, conditionalFailure=null)])`],
  ["operator", { context: codecContext, operator: "+", operands: [codecEvidence], permissionScope: codecReference },
    `OperatorInput(context=${codecContextWire}, operator="+", operands=[${codecEvidenceWire}], permissionScope=${codecReferenceWire})`],
  ["literal-fit", { context: codecContext, literal: { kind: "bigint", token: "1208925819614629174706176n", value: 1208925819614629174706176n }, destination: codecEvidence },
    `LiteralFitInput(context=${codecContextWire}, literal=bigint(token="1208925819614629174706176n", value=1208925819614629174706176n), destination=${codecEvidenceWire})`],
  ["protocol", { context: codecContext, kind: "delegate", asynchronous: true, subject: codecEvidence,
    operands: [codecEvidence], completion: codecEvidence, yielded: codecEvidence, sent: codecEvidence, thrown: codecEvidence },
    `ProtocolInput(context=${codecContextWire}, kind="delegate", asynchronous=true, subject=${codecEvidenceWire}, ` +
    `operands=[${codecEvidenceWire}], completion=${codecEvidenceWire}, yielded=${codecEvidenceWire}, sent=${codecEvidenceWire}, thrown=${codecEvidenceWire})`],
  ["refinement", { context: codecContext, source: codecEvidence, checked: codecEvidence },
    `RefinementInput(context=${codecContextWire}, source=${codecEvidenceWire}, checked=${codecEvidenceWire})`],
  ["library", { context: codecContext, declaration: ownerId, receiver: codecEvidence, arguments: [codecEvidence], result: codecEvidence },
    `LibraryInput(context=${codecContextWire}, declaration=def:"${ownerId}", receiver=${codecEvidenceWire}, ` +
    `arguments=[${codecEvidenceWire}], result=${codecEvidenceWire})`],
  ["core", { context: codecContext, captured: emptyCore(), declaration: ownerId, operands: [codecEvidence],
    result: codecEvidence, permissionScope: codecReference },
    `CoreInput(context=${codecContextWire}, captured=HirCoreCapture(provider=available(value=null), ` +
    "markers=available(value=HirMarkersCapture(struct=null, field=null, defaultValue=null, jsString=false)), " +
    "pointerType=available(value=null), pointerOperation=available(value=null), fieldBinding=available(value=null), " +
    "recordBinding=available(value=null), attribute=available(value=null), " +
    "safety=available(value=null), argumentPassing=available(value=null), flowState=available(value=null)), " +
    `declaration=def:"${ownerId}", operands=[${codecEvidenceWire}], result=${codecEvidenceWire}, permissionScope=${codecReferenceWire})`],
];

for (const [rule, input, inputWire] of savedInvocationCases) {
  test(`the genuine saved ${rule} invocation retains its complete independent public text vector`, () => {
    const phase = { ...typedValue(), role: "value", operation: { kind: "deferred",
      deferred: { invocation: { rule, input }, result: 0 } } };
    const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
      `invocation=DeferredInvocation(rule="${rule}", input=${inputWire}), result=t:0)))`;
    assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken",
      operand: codecName(5, 4), tsonic: phase }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`,
      codecNameWire(5, 4),
    ], `saved ${rule}`);
  });
  test(`the structural verifier retains supplied ${rule} data without executing or replaying its semantic rule`, () => {
    const fixture = operationScenario();
    const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
    fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule, input: { ...input, context } }, result: 1 } };
    replaceScopeInventory(fixture.input, Array.from({ length: rule === "candidate" ? 4 : 3 }, emptyScope));
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

const codecParameterIdentity = { owner: ownerId, index: 0 };
const codecParameterType = { identity: codecParameterIdentity, declaration: ownerId, constraint: 0, default: 0 };
const codecParameterTypeWire = `TypeParameter(identity=TypeParameterIdentity(owner=def:"${ownerId}", index=0), ` +
  `declaration=def:"${ownerId}", constraint=t:0, default=t:0)`;
const codecAttribute = { declaration: ownerId, occurrence: codecSource, arguments: [codecSource] };
const codecAttributeWire = `HirAttribute(declaration=def:"${ownerId}", occurrence=${codecSourceWire}, arguments=[${codecSourceWire}])`;
const codecCallable = { definition: ownerId, parameters: [codecParameterType], signatures: [codecEndpoint],
  template: { body: bodyId, lexicalBindings: emptyBindings(), dependence: "parametric" }, attributes: [codecAttribute] };
const codecCallableWire = `TypedCallable(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], ` +
  `signatures=[${codecEndpointWire}], template=TypedBodyTemplate(body=body:"${bodyId}", ` +
  `lexicalBindings=${codecBindingsWire}, dependence="parametric"), attributes=[${codecAttributeWire}])`;

function codecTypeParameter(identity, parent) {
  return { ...header(identity, parent), kind: "TypeParameter", modifiers: nodeList(), name: codecName(identity + 1, identity),
    constraint: codecType(identity + 2, identity), expression: codecName(identity + 3, identity),
    defaultType: codecType(identity + 4, identity), tsonic: { parameter: codecParameterType } };
}

function codecTypeParameterDefinitions(identity, parent) {
  return [
    `TypeParameter(${syntaxHeaderWire(identity, parent)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:${identity + 1}, constraint=n:${identity + 2}, ` +
      `expression=n:${identity + 3}, defaultType=n:${identity + 4}, tsonic=TypedTypeParameter(parameter=${codecParameterTypeWire}))`,
    codecNameWire(identity + 1, identity), codecTypeWire(identity + 2, identity), codecNameWire(identity + 3, identity),
    codecTypeWire(identity + 4, identity),
  ];
}

function codecParameter(identity, parent) {
  return { ...header(identity, parent), kind: "Parameter", modifiers: nodeList(),
    dotDotDotToken: { ...header(identity + 1, identity), kind: "DotDotDotToken", tsonic: null },
    name: codecName(identity + 2, identity), questionToken: { ...header(identity + 3, identity), kind: "QuestionToken", tsonic: null },
    type: codecType(identity + 4, identity), initializer: codecName(identity + 5, identity),
    tsonic: { declaration: ownerId, local: { body: bodyId, local: 0 }, storage: 0, passing: "by-value", initializer: bodyId } };
}

function codecParameterDefinitions(identity, parent) {
  return [
    `Parameter(${syntaxHeaderWire(identity, parent)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), dotDotDotToken=n:${identity + 1}, name=n:${identity + 2}, ` +
      `questionToken=n:${identity + 3}, type=n:${identity + 4}, initializer=n:${identity + 5}, ` +
      `tsonic=TypedParameter(declaration=def:"${ownerId}", local=${localWire}, storage=t:0, passing="by-value", initializer=body:"${bodyId}"))`,
    `DotDotDotToken(${syntaxHeaderWire(identity + 1, identity)}, tsonic=null)`, codecNameWire(identity + 2, identity),
    `QuestionToken(${syntaxHeaderWire(identity + 3, identity)}, tsonic=null)`, codecTypeWire(identity + 4, identity),
    codecNameWire(identity + 5, identity),
  ];
}

test("infer types retain the complete real type-parameter declaration", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "InferType", typeParameter: codecTypeParameter(5, 4),
    tsonic: { type: 0, declarations: [] } }, [
    `InferType(${syntaxHeaderWire(4, 2)}, typeParameter=n:5, tsonic=TypedType(type=t:0, declarations=[]))`,
    ...codecTypeParameterDefinitions(5, 4),
  ], "infer type");
});

test("mapped types retain both modifier tokens, declaration, remapping and member vector", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "MappedType",
    readonlyToken: { ...header(5, 4), kind: "PlusToken", tsonic: null }, typeParameter: codecTypeParameter(6, 4),
    nameType: codecType(11, 4), questionToken: { ...header(12, 4), kind: "MinusToken", tsonic: null },
    type: codecType(13, 4), members: nodeList(), tsonic: { type: 0, declarations: [] } }, [
    `MappedType(${syntaxHeaderWire(4, 2)}, readonlyToken=n:5, typeParameter=n:6, nameType=n:11, questionToken=n:12, ` +
      'type=n:13, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedType(type=t:0, declarations=[]))',
    `PlusToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`, ...codecTypeParameterDefinitions(6, 4), codecTypeWire(11, 4),
    `MinusToken(${syntaxHeaderWire(12, 4)}, tsonic=null)`, codecTypeWire(13, 4),
  ], "mapped type");
});

for (const kind of ["FunctionType", "ConstructorType", "CallSignature", "ConstructSignature"]) {
  test(`the complete ${kind} retains every callable syntax and phase field`, () => {
    const typeKind = kind === "FunctionType" || kind === "ConstructorType";
    const fields = { typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList([codecParameter(10, 4)]),
      type: codecType(16, 4), fullSignature: codecType(17, 4) };
    if (typeKind) fields.modifiers = nodeList();
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: typeKind ? { type: 0, declarations: [] } : codecCallable }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${typeKind ? "modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), " : ""}` +
        'typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ' +
        'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:10]), type=n:16, fullSignature=n:17, ' +
        `tsonic=${typeKind ? "TypedType(type=t:0, declarations=[])" : codecCallableWire})`,
      ...codecTypeParameterDefinitions(5, 4), ...codecParameterDefinitions(10, 4), codecTypeWire(16, 4), codecTypeWire(17, 4),
    ], kind);
  });
}

test("type predicates retain both asserts syntax and actual nullable narrowing fact", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "TypePredicate",
    assertsModifier: { ...header(5, 4), kind: "AssertsKeyword", tsonic: null }, parameterName: codecName(6, 4),
    type: codecType(7, 4), tsonic: { parameter: ownerId, narrowed: 0, asserts: true } }, [
    `TypePredicate(${syntaxHeaderWire(4, 2)}, assertsModifier=n:5, parameterName=n:6, type=n:7, ` +
      `tsonic=TypedPredicate(parameter=def:"${ownerId}", narrowed=t:0, asserts=true))`,
    `AssertsKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`, codecNameWire(6, 4), codecTypeWire(7, 4),
  ], "type predicate");
});

function assertEvidenceRecord(value, wire, name) {
  const body = emptyModuleBody();
  body.evidence = [value];
  const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  assertBodyRoundTrip(body, baseline.replace("evidence=[]", `evidence=[${wire}]`), name);
}

const evidenceSource = { kind: "body", value: { body: bodyId, node: 0 } };
const evidenceSourceWire = `body(value=NodeRef(body=body:"${bodyId}", node=n:0))`;
const evidenceFieldsWire = `type=t:0, component=${evidenceSourceWire}`;
for (const category of ["number", "bigint", "boolean", "string", "symbol", "absence", "object", "callable"]) {
  test(`a complete ${category} category evidence record retains the exact closed tag`, () => {
    assertEvidenceRecord({ ...typeEvidence({ kind: "known", category }) },
      `TypeEvidence(${evidenceFieldsWire}, category=known(category="${category}"), numeric=null, sum=null, nominal=null, pointer=null)`, category);
  });
}

test("parameter category evidence retains its real declaration ID", () => {
  assertEvidenceRecord(typeEvidence({ kind: "parameter", declaration: ownerId }),
    `TypeEvidence(${evidenceFieldsWire}, category=parameter(declaration=def:"${ownerId}"), numeric=null, sum=null, nominal=null, pointer=null)`,
    "parameter category");
});

for (const kind of ["literal", "declared", "operation", "application"]) {
  test(`complete ${kind} numeric evidence retains its producer/category and authored exact literal`, () => {
    const literal = { kind: "number", token: "1.25", value: { numerator: 5n, denominator: 4n, negativeZero: false } };
    const numeric = { producer: { body: bodyId, node: 0 }, kind, category: { kind: "known", category: "number" }, authored: literal };
    assertEvidenceRecord({ ...typeEvidence({ kind: "known", category: "number" }), numeric },
      `TypeEvidence(${evidenceFieldsWire}, category=known(category="number"), numeric=NumericEvidence(` +
      `producer=NodeRef(body=body:"${bodyId}", node=n:0), kind="${kind}", category=known(category="number"), ` +
      'authored=number(token="1.25", value=ExactRational(numerator=5n, denominator=4n, negativeZero=false))), ' +
      'sum=null, nominal=null, pointer=null)', `numeric ${kind}`);
  });
}

for (const kind of ["authored", "inferred"]) {
  test(`complete ${kind} sum evidence retains all actual arm and binding fields`, () => {
    const bindings = { classBindings: [{ kind: "bound", parameter: codecParameterIdentity, type: 0 }],
      methodBindings: [{ kind: "rigid", parameter: codecParameterIdentity }],
      capturedBindings: [{ kind: "bound", parameter: codecParameterIdentity, type: 0 }],
      selfBindings: [{ kind: "bound", owner: ownerId, type: 0 }, { kind: "rigid", owner: ownerId }] };
    const identity = `TypeParameterIdentity(owner=def:"${ownerId}", index=0)`;
    const bindingsWire = `BindingVector(classBindings=[bound(parameter=${identity}, type=t:0)], ` +
      `methodBindings=[rigid(parameter=${identity})], capturedBindings=[bound(parameter=${identity}, type=t:0)], ` +
      `selfBindings=[bound(owner=def:"${ownerId}", type=t:0), rigid(owner=def:"${ownerId}")])`;
    const sum = { kind, component: evidenceSource, bindings, arms: [{ authoredIndex: 0, component: evidenceSource, member: 0 }] };
    assertEvidenceRecord({ ...typeEvidence({ kind: "dynamic" }), sum },
      `TypeEvidence(${evidenceFieldsWire}, category=dynamic(), numeric=null, sum=SumEvidence(kind="${kind}", ` +
      `component=${evidenceSourceWire}, bindings=${bindingsWire}, arms=[SumArmRole(authoredIndex=0, ` +
      `component=${evidenceSourceWire}, member=t:0)]), nominal=null, pointer=null)`, `sum ${kind}`);
  });
}

const pointerEvidenceCases = [
  [{ kind: "raw-address" }, "raw-address()"],
  ...["readonly", "readwrite", "unspecified"].map(mutability => [{ kind: "typed-location", pointee: 0, mutability },
    `typed-location(pointee=t:0, mutability="${mutability}")`]),
  [{ kind: "native-pointer", declaration: ownerId }, `native-pointer(declaration=def:"${ownerId}")`],
  [{ kind: "function-pointer", declaration: ownerId, parameters: [0], result: 0, abi: ["C", "cdecl"] },
    `function-pointer(declaration=def:"${ownerId}", parameters=[t:0], result=t:0, abi=["C", "cdecl"])`],
];
for (const [pointer, wire] of pointerEvidenceCases) {
  test(`complete ${wire} pointer evidence retains actual carrier metadata`, () => {
    assertEvidenceRecord({ ...typeEvidence({ kind: "dynamic" }), nominal: ownerId, pointer },
      `TypeEvidence(${evidenceFieldsWire}, category=dynamic(), numeric=null, sum=null, nominal=def:"${ownerId}", pointer=${wire})`, wire);
  });
}

function assertCoreField(field, value, expectedField, name) {
  const fields = { provider: "available(value=null)",
    markers: "available(value=HirMarkersCapture(struct=null, field=null, defaultValue=null, jsString=false))",
    pointerType: "available(value=null)", pointerOperation: "available(value=null)", fieldBinding: "available(value=null)",
    recordBinding: "available(value=null)", attribute: "available(value=null)",
    safety: "available(value=null)", argumentPassing: "available(value=null)", flowState: "available(value=null)", [field]: expectedField };
  const coreWire = `HirCoreCapture(provider=${fields.provider}, markers=${fields.markers}, pointerType=${fields.pointerType}, ` +
    `pointerOperation=${fields.pointerOperation}, fieldBinding=${fields.fieldBinding}, recordBinding=${fields.recordBinding}, ` +
    `attribute=${fields.attribute}, safety=${fields.safety}, ` +
    `argumentPassing=${fields.argumentPassing}, flowState=${fields.flowState})`;
  const input = { context: codecContext, captured: { ...emptyCore(), [field]: value }, declaration: ownerId,
    operands: [codecEvidence], result: codecEvidence, permissionScope: codecReference };
  const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: { invocation: { rule: "core", input }, result: 0 } } };
  const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="core", ` +
    `input=CoreInput(context=${codecContextWire}, captured=${coreWire}, declaration=def:"${ownerId}", ` +
    `operands=[${codecEvidenceWire}], result=${codecEvidenceWire}, permissionScope=${codecReferenceWire})), result=t:0)))`;
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
  ], name);
}

for (const field of ["provider", "markers", "pointerType", "pointerOperation", "fieldBinding", "recordBinding", "attribute", "safety", "argumentPassing", "flowState"]) {
  test(`a real unavailable ${field} capture retains its reason instead of inventing data`, () => {
    assertCoreField(field, { kind: "unavailable", reason: "parameter-dependent" }, 'unavailable(reason="parameter-dependent")', field);
  });
}

// Binding captures (SCHEMA-MIGRATION.md 5.2, TB1): the saved text of each record, with every inner fact available and unavailable.
const emptyBindingsWire = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
const unavailableWire = reason => `unavailable(reason="${reason}")`;
for (const [name, changes, wires] of [
  ["complete", {}, {}],
  ["bindings unavailable", { bindings: { kind: "unavailable", reason: "parameter-dependent" } }, { bindings: unavailableWire("parameter-dependent") }],
  ["owner unavailable", { owner: { kind: "unavailable", reason: "checker-error" } }, { owner: unavailableWire("checker-error") }],
  ["pointee unavailable", { pointee: { kind: "unavailable", reason: "not-provided" } }, { pointee: unavailableWire("not-provided") }],
  ["field unavailable", { field: { kind: "unavailable", reason: "not-provided" } }, { field: unavailableWire("not-provided") }],
]) test(`a saved field binding capture retains its occurrence, types, binding vector and field descriptor: ${name}`, () => {
  const value = { occurrence: codecReference, bindings: available(emptyBindings()), owner: available(0), pointee: available(0),
    fieldExpression: codecReference, field: available(codecSource), pointerExpression: codecReference, ...changes };
  const wire = { bindings: `available(value=${emptyBindingsWire})`, owner: "available(value=t:0)", pointee: "available(value=t:0)",
    field: `available(value=${codecSourceWire})`, ...wires };
  assertCoreField("fieldBinding", available(value), `available(value=HirFieldBindingCapture(occurrence=${codecReferenceWire}, ` +
    `bindings=${wire.bindings}, owner=${wire.owner}, pointee=${wire.pointee}, fieldExpression=${codecReferenceWire}, ` +
    `field=${wire.field}, pointerExpression=${codecReferenceWire}))`, `field binding ${name}`);
});
for (const [name, changes, wires] of [
  ["complete", {}, {}],
  ["no field entries", { fields: [] }, { fields: "[]" }],
  ["bindings unavailable", { bindings: { kind: "unavailable", reason: "parameter-dependent" } }, { bindings: unavailableWire("parameter-dependent") }],
  ["source unavailable", { source: { kind: "unavailable", reason: "checker-error" } }, { source: unavailableWire("checker-error") }],
  ["layout unavailable", { layout: { kind: "unavailable", reason: "not-provided" } }, { layout: unavailableWire("not-provided") }],
]) test(`a saved record binding capture retains its source, layout descriptor and field entries: ${name}`, () => {
  const value = { occurrence: codecReference, bindings: available(emptyBindings()), source: available(0), layoutExpression: codecReference,
    layout: available(codecSource), fields: [{ expression: codecReference, binding: codecReference }], ...changes };
  const wire = { bindings: `available(value=${emptyBindingsWire})`, source: "available(value=t:0)", layout: `available(value=${codecSourceWire})`,
    fields: `[HirRecordFieldBindingCapture(expression=${codecReferenceWire}, binding=${codecReferenceWire})]`, ...wires };
  assertCoreField("recordBinding", available(value), `available(value=HirRecordBindingCapture(occurrence=${codecReferenceWire}, ` +
    `bindings=${wire.bindings}, source=${wire.source}, layoutExpression=${codecReferenceWire}, layout=${wire.layout}, fields=${wire.fields}))`,
    `record binding ${name}`);
});

test("nonempty struct/field/default markers retain actual saved type and source records", () => {
  const field = { name: "field", typeNode: codecSource, type: available(0), readonly: true };
  const fieldWire = `HirFieldMarkerCapture(name="field", typeNode=${codecSourceWire}, type=available(value=t:0), readonly=true)`;
  const markers = { struct: { valueType: true, fields: available([field]) }, field,
    defaultValue: { typeNode: codecSource, type: available(0) }, jsString: true };
  assertCoreField("markers", available(markers), `available(value=HirMarkersCapture(struct=Record(valueType=true, ` +
    `fields=available(value=[${fieldWire}])), field=${fieldWire}, defaultValue=Record(typeNode=${codecSourceWire}, ` +
    'type=available(value=t:0)), jsString=true))', "complete markers");
});

test("unavailable marker fields and captured types remain distinct genuine capture arms", () => {
  const markers = { struct: { valueType: false, fields: { kind: "unavailable", reason: "checker-error" } },
    field: { name: "field", typeNode: codecSource, type: { kind: "unavailable", reason: "not-provided" }, readonly: false },
    defaultValue: null, jsString: false };
  assertCoreField("markers", available(markers), 'available(value=HirMarkersCapture(struct=Record(valueType=false, ' +
    'fields=unavailable(reason="checker-error")), field=HirFieldMarkerCapture(name="field", ' +
    `typeNode=${codecSourceWire}, type=unavailable(reason="not-provided"), readonly=false), defaultValue=null, jsString=false))`,
    "unavailable marker data");
});

const capturedType = { type: available(0), component: { root: codecSource, path: [] } };
const capturedTypeWire = `HirCapturedType(type=available(value=t:0), component=TypeComponent(root=${codecSourceWire}, path=[]))`;
for (const [value, wire] of [
  [{ kind: "raw-address" }, "raw-address()"],
  [{ kind: "typed-location", pointee: capturedType, mutability: "readwrite" }, `typed-location(pointee=${capturedTypeWire}, mutability="readwrite")`],
  [{ kind: "native-pointer", declaration: ownerId }, `native-pointer(declaration=def:"${ownerId}")`],
  [{ kind: "function-pointer", declaration: ownerId, parameters: [capturedType], result: capturedType, abi: ["C"] },
    `function-pointer(declaration=def:"${ownerId}", parameters=[${capturedTypeWire}], result=${capturedTypeWire}, abi=["C"])`],
]) {
  test(`saved pointer-type capture ${value.kind} has a full independent codec vector`, () => {
    assertCoreField("pointerType", available(value), `available(value=${wire})`, value.kind);
  });
}

for (const operation of ["address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer"]) {
  test(`saved typed-location ${operation} retains its authored arguments and actual selection state`, () => {
    const value = { family: "typed-location", operation, exportName: operation, arguments: [codecSource],
      typeArguments: [codecSource], selection: "conditional-candidates", pointee: "available" };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="typed-location", ' +
      `operation="${operation}", exportName="${operation}", arguments=[${codecSourceWire}], typeArguments=[${codecSourceWire}], ` +
      'selection="conditional-candidates", pointee="available"))', operation);
  });
}

const pointerOperationCases = [
  [{ family: "typed-location", operation: "view", pointer: codecSource, read: codecSource, write: codecSource, optional: true },
    `family="typed-location", operation="view", pointer=${codecSourceWire}, read=${codecSourceWire}, write=${codecSourceWire}, optional=true`],
  [{ family: "native-pointer", operation: "load", pointer: codecSource }, `family="native-pointer", operation="load", pointer=${codecSourceWire}`],
  [{ family: "native-pointer", operation: "store", pointer: codecSource, value: codecSource },
    `family="native-pointer", operation="store", pointer=${codecSourceWire}, value=${codecSourceWire}`],
  [{ family: "native-pointer", operation: "offset", pointer: codecSource, offset: codecSource },
    `family="native-pointer", operation="offset", pointer=${codecSourceWire}, offset=${codecSourceWire}`],
  [{ family: "raw-address", operation: "bind-raw-pointer", identity: codecSource }, `family="raw-address", operation="bind-raw-pointer", identity=${codecSourceWire}`],
  [{ family: "raw-address", operation: "equal-raw-pointer", left: codecSource, right: codecSource },
    `family="raw-address", operation="equal-raw-pointer", left=${codecSourceWire}, right=${codecSourceWire}`],
  [{ family: "raw-address", operation: "hash-raw-pointer", pointer: codecSource }, `family="raw-address", operation="hash-raw-pointer", pointer=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "to-raw", pointer: codecSource, layout: codecSource },
    `family="raw-memory", operation="to-raw", pointer=${codecSourceWire}, layout=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "reinterpret", raw: codecSource, layout: codecSource },
    `family="raw-memory", operation="reinterpret", raw=${codecSourceWire}, layout=${codecSourceWire}`],
  [{ family: "raw-memory", operation: "byte-offset", raw: codecSource, offset: codecSource,
    integer: { runtimeBase: "bigint", signedness: "signed", width: 128 }, dataLayout: codecSource },
    `family="raw-memory", operation="byte-offset", raw=${codecSourceWire}, offset=${codecSourceWire}, ` +
    `integer=HirIntegerOperandCapture(runtimeBase="bigint", signedness="signed", width=128), dataLayout=${codecSourceWire}`],
  [{ family: "keep-alive", operation: "keep-alive", value: codecSource }, `family="keep-alive", operation="keep-alive", value=${codecSourceWire}`],
];
for (const [selection, pointee] of [
  ["applicable", "available"], ["conditional-candidates", "unvisited"], ["untyped", "not-applicable"], ["unvisited", "missing"],
]) {
  test(`pointer capture selection ${selection} and pointee ${pointee} retain their actual saved states`, () => {
    const value = { family: "typed-location", operation: "load", exportName: "load", arguments: [], typeArguments: [], selection, pointee };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="typed-location", ' +
      `operation="load", exportName="load", arguments=[], typeArguments=[], selection="${selection}", pointee="${pointee}"))`,
    `${selection}/${pointee}`);
  });
}
for (const width of [8, 16, 32, 64, 128]) {
  test(`a saved raw-memory operand retains the exact admitted ${width}-bit literal width`, () => {
    const runtimeBase = width < 64 ? "number" : "bigint";
    const value = { family: "raw-memory", operation: "byte-offset", raw: codecSource, offset: codecSource,
      integer: { runtimeBase, signedness: "signed", width }, dataLayout: codecSource };
    assertCoreField("pointerOperation", available(value), 'available(value=HirPointerOperationCapture(family="raw-memory", ' +
      `operation="byte-offset", raw=${codecSourceWire}, offset=${codecSourceWire}, integer=HirIntegerOperandCapture(` +
      `runtimeBase="${runtimeBase}", signedness="signed", width=${width}), dataLayout=${codecSourceWire}))`, `${width}`);
  });
}
for (const width of [32, 64]) {
  const integer = { width, runtimeBase: width === 32 ? "number" : "bigint", signedness: "unsigned" };
  const integerWire = `HirAddressIntegerCapture(width=${width}, runtimeBase="${integer.runtimeBase}", signedness="unsigned")`;
  pointerOperationCases.push(
    [{ family: "raw-memory", operation: "raw-to-address-integer", raw: codecSource, integer, dataLayout: codecSource },
      `family="raw-memory", operation="raw-to-address-integer", raw=${codecSourceWire}, integer=${integerWire}, dataLayout=${codecSourceWire}`],
    [{ family: "raw-memory", operation: "address-integer-to-raw", address: codecSource, integer, dataLayout: codecSource },
      `family="raw-memory", operation="address-integer-to-raw", address=${codecSourceWire}, integer=${integerWire}, dataLayout=${codecSourceWire}`],
  );
}
for (const [value, fields] of pointerOperationCases) {
  test(`saved ${value.family}/${value.operation} retains every closed raw capture field`, () => {
    assertCoreField("pointerOperation", available(value), `available(value=HirPointerOperationCapture(${fields}))`, `${value.family}/${value.operation}`);
  });
}

for (const role of ["declaration", "argument"]) {
  test(`the ${role} argument-passing capture retains its true closed carrier`, () => {
    assertCoreField("argumentPassing", available({ role, mode: "borrow-mut", ...(role === "argument" ? { storageExpression: codecSource } : {}) }),
      `available(value=HirArgumentPassingCapture(role="${role}", mode="borrow-mut"` +
      `${role === "argument" ? `, storageExpression=${codecSourceWire}` : ""}))`, `passing ${role}`);
  });
}
for (const state of ["moved", "borrowed-shared", "borrowed-mut"]) {
  test(`a real ${state} flow capture preserves its exact state`, () => {
    assertCoreField("flowState", available(state), `available(value="${state}")`, state);
  });
}
test("an available provider capture retains its authentic declared identity", () => {
  assertCoreField("provider", available(ownerId), `available(value=def:"${ownerId}")`, "provider");
});

for (const kind of ["builder-state", "application"]) {
  test(`the saved ${kind} attribute capture retains every actual member/placement/target field`, () => {
    const value = { kind, occurrence: codecSource, applicationTarget: codecSource,
      selectedMember: { selectedDeclaration: codecSource, declarations: [codecSource] }, applicationMemberKind: "method",
      applicationPlacement: "constructor", applicationParameterName: "parameter", applicationTargetSpecifier: "specifier",
      ...(kind === "application" ? { invocation: codecSource } : {}) };
    const wire = `${kind}(occurrence=${codecSourceWire}, applicationTarget=${codecSourceWire}, ` +
      `selectedMember=Record(selectedDeclaration=${codecSourceWire}, declarations=[${codecSourceWire}]), ` +
      'applicationMemberKind="method", applicationPlacement="constructor", applicationParameterName="parameter", ' +
      `applicationTargetSpecifier="specifier"${kind === "application" ? `, invocation=${codecSourceWire}` : ""})`;
    assertCoreField("attribute", available(value), `available(value=${wire})`, kind);
  });
}

const safetyCases = [
  [{ family: "unsafe-context", operation: "expression", expression: codecSource },
    `family="unsafe-context", operation="expression", expression=${codecSourceWire}`],
  [{ family: "unsafe-context", operation: "remaining-block", firstDirectStatement: true },
    'family="unsafe-context", operation="remaining-block", firstDirectStatement=true'],
  [{ family: "safety", operation: "root", form: "type", target: codecSource },
    `family="safety", operation="root", form="type", target=${codecSourceWire}`],
  [{ family: "safety", operation: "root", form: "value", target: null },
    'family="safety", operation="root", form="value", target=null'],
  [{ family: "safety", operation: "select-member", predecessor: codecSource, memberKind: "indexer",
    selection: { kind: "selected", expression: codecSource, declaration: codecSource, declarations: [codecSource] } },
    `family="safety", operation="select-member", predecessor=${codecSourceWire}, memberKind="indexer", ` +
    `selection=selected(expression=${codecSourceWire}, declaration=${codecSourceWire}, declarations=[${codecSourceWire}])`],
  [{ family: "safety", operation: "select-member", predecessor: null, memberKind: "property",
    selection: { kind: "unavailable", reason: "member-evidence" } },
    'family="safety", operation="select-member", predecessor=null, memberKind="property", selection=unavailable(reason="member-evidence")'],
  [{ family: "safety", operation: "placement", predecessor: codecSource, placement: "getter" },
    `family="safety", operation="placement", predecessor=${codecSourceWire}, placement="getter"`],
  [{ family: "safety", operation: "apply", predecessor: codecSource, contract: "requires-unsafe" },
    `family="safety", operation="apply", predecessor=${codecSourceWire}, contract="requires-unsafe"`],
];
for (const [fields, wire] of safetyCases) {
  test(`actual saved safety ${wire} retains every closed capture field`, () => {
    assertCoreField("safety", available({ occurrence: codecSource, provider: ownerId, ...fields }),
      `available(value=HirSafetyCapture(occurrence=${codecSourceWire}, provider=def:"${ownerId}", ${wire}))`, fields.operation);
  });
}

const codecApplicationDecision = { candidate: 0, advertised: codecEndpoint, api: { ...codecEndpoint, role: "api-body" },
  bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [
    { kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
    { kind: "default", parameter: 1, initializer: bodyId }, { kind: "omitted", parameter: 2, type: 0 },
    { kind: "rest", parameter: 3, arguments: [0, 1], passing: "move" },
  ], completion: { signature: 0, completion: 0, yielded: 0, sent: 0 }, result: 0, activation: null };
const codecApplicationDecisionWire = `ApplicationDecision(candidate=0, advertised=${codecEndpointWire}, ` +
  `api=HirCallableEndpoint(declaration=def:"${ownerId}", role="api-body", signature=sig:0, body=body:"${bodyId}"), ` +
  `bindings=${codecBindingsWire}, implementationBindings=${codecBindingsWire}, parameters=[` +
  'argument(parameter=0, argument=0, component=0, passing="by-value"), ' +
  `default(parameter=1, initializer=body:"${bodyId}"), omitted(parameter=2, type=t:0), ` +
  'rest(parameter=3, arguments=[0, 1], passing="move")], ' +
  'completion=CompletionEndpoint(signature=sig:0, completion=t:0, yielded=t:0, sent=t:0), result=t:0, activation=null)';
const codecMemberDecision = { key: codecKey, origins: [codecMemberOrigin, { kind: "declared", declaration: ownerId },
  { kind: "class-prototype", owner: ownerId }], selectedDeclarations: [ownerId], primary: ownerId, read: 0, write: 0,
  getter: codecEndpoint, setter: codecEndpoint, bindings: emptyBindings(), location: { kind: "accessor" } };
const codecMemberDecisionWire = `MemberDecision(key=${codecKeyWire}, origins=[${codecMemberOriginWire}, ` +
  `declared(declaration=def:"${ownerId}"), class-prototype(owner=def:"${ownerId}")], selectedDeclarations=[def:"${ownerId}"], ` +
  `primary=def:"${ownerId}", read=t:0, write=t:0, getter=${codecEndpointWire}, setter=${codecEndpointWire}, bindings=${codecBindingsWire}, location=accessor())`;
const codecPart = { part: 0, source: codecReference, destination: { root: codecSource, path: [] }, member: codecMemberDecision,
  embedding: { kind: "identity" } };
const codecPartWire = `ConstructionPartDecision(part=0, source=${codecReferenceWire}, destination=TypeComponent(root=${codecSourceWire}, path=[]), ` +
  `member=${codecMemberDecisionWire}, embedding=identity())`;
const selectorCases = [
  ...["class-value", "optional-value", "array-element", "intersection-result", "projection-source", "awaited"]
    .map(kind => [{ kind }, `${kind}()`]),
  [{ kind: "construction-argument", definition: { occurrence: codecReference, captures: [{ body: bodyId, local: 0 }] }, index: 0 },
    `construction-argument(definition=ConstructionDefinition(occurrence=${codecReferenceWire}, captures=[${localWire}]), index=0)`],
  ...["tuple-element", "union-member", "argument-place", "parameter-place", "intersection-member"]
    .map(kind => [{ kind, index: 0 }, `${kind}(index=0)`]),
  ...["argument-tail", "parameter-tail"].map(kind => [{ kind, start: 1 }, `${kind}(start=1)`]),
  [{ kind: "member", origin: codecMemberOrigin }, `member(origin=${codecMemberOriginWire})`],
  ...["index-key", "index-value"].map(kind => [{ kind, declaration: ownerId }, `${kind}(declaration=def:"${ownerId}")`]),
  [{ kind: "parameter", signature: 0, index: 0 }, "parameter(signature=sig:0, index=0)"],
  [{ kind: "receiver", signature: 0 }, "receiver(signature=sig:0)"],
  [{ kind: "signature-tail", signature: 0, start: 1, readonly: true }, "signature-tail(signature=sig:0, start=1, readonly=true)"],
  [{ kind: "tuple-slice", start: 1, endCount: 2, readonly: false }, "tuple-slice(start=1, endCount=2, readonly=false)"],
  [{ kind: "result", signature: 0 }, "result(signature=sig:0)"],
  [{ kind: "type-argument", declaration: ownerId, index: 0 }, `type-argument(declaration=def:"${ownerId}", index=0)`],
  ...["authored", "inferred"].map(sumOrigin => [{ kind: "sum-arm", family: { origin: sumOrigin,
    component: { root: codecSource, path: [] }, parameters: [codecParameterIdentity],
    roles: [{ authoredIndex: 0, component: codecSource, member: 0 }] }, index: 0 },
  `sum-arm(family=SumFamily(origin="${sumOrigin}", component=TypeComponent(root=${codecSourceWire}, path=[]), ` +
    `parameters=[TypeParameterIdentity(owner=def:"${ownerId}", index=0)], roles=[SumArmRole(authoredIndex=0, ` +
    `component=${codecSourceWire}, member=t:0)]), index=0)`]),
];
for (const [selector, selectorWire] of selectorCases) {
  test(`actual ${selectorWire} correspondence preserves the complete component and proof graph`, () => {
    const from = { root: codecSource, path: [selector] };
    const to = { root: codecSource, path: [] };
    const proof = { steps: [{ from, to, rule: "identity", premises: [] }, { from: to, to, rule: "readonly", premises: [0] }], conclusion: 1 };
    const fromWire = `TypeComponent(root=${codecSourceWire}, path=[${selectorWire}])`;
    const toWire = `TypeComponent(root=${codecSourceWire}, path=[])`;
    const proofWire = `EmbeddingProof(steps=[CorrespondenceStep(from=${fromWire}, to=${toWire}, rule="identity", premises=[]), ` +
      `CorrespondenceStep(from=${toWire}, to=${toWire}, rule="readonly", premises=[0])], conclusion=1)`;
    for (const failure of ["unwind", "abort"]) {
      const narrowing = { kind: "narrowed", source: 0, result: 0, proof, failure };
      const narrowedWire = `type=t:0, convertedType=t:0, conversion=identity(), narrowing=narrowed(source=t:0, result=t:0, ` +
        `proof=${proofWire}, failure="${failure}"), evidenceIndex=0, demand=always()`;
      assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
        tsonic: { ...typedValue(), narrowing } }, [
        `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(${narrowedWire}))`, codecNameWire(5, 4),
      ], `${selectorWire} ${failure}`);
    }
  });
}
const codecOriginWire = `Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`;
const diagnosticCases = [
  [{ kind: "host", name: "H_TEST", rendered: "TSONIC_H_TEST" }, 'host(name="H_TEST", rendered="TSONIC_H_TEST")',
    "error", { kind: "source", origin: origin() }, `source(origin=${codecOriginWire})`, true],
  [{ kind: "host", name: "", rendered: "" }, 'host(name="", rendered="")',
    "warning", { kind: "none" }, "none()", false],
  [{ kind: "checker", number: 2322, rendered: "TS2322" }, 'checker(number=2322, rendered="TS2322")',
    "warning", { kind: "file", path: "/project/module.ts" }, 'file(path="/project/module.ts")', false],
  [{ kind: "extension", number: 9910000, extensionCode: "E_TEST", rendered: "TSEXT9910000" },
    'extension(number=9910000, extensionCode="E_TEST", rendered="TSEXT9910000")', "suggestion", { kind: "none" }, "none()", true],
];
for (const [code, codeWire, severity, site, siteWire, detailed] of diagnosticCases) {
  test(`complete ${code.kind} diagnostic is published through the real text boundary without a branded-code cast`, () => {
    const related = detailed ? [
      { site: { kind: "file", path: "/project/other.ts" }, code: { kind: "checker", number: 1, rendered: "TS1" }, message: "related" },
      { site: { kind: "none" }, code: { kind: "extension", number: 2, extensionCode: "E_RELATED", rendered: "TSEXT2" }, message: "detail" },
    ] : [];
    const argumentsValue = detailed ? [{ kind: "text", value: "text" }, { kind: "integer", value: 1208925819614629174706176n },
      { kind: "number", value: -0 }, { kind: "origin", value: origin() }] : [];
    const diagnostic = { code, severity, site, source: detailed ? "source" : null, evidence: detailed ? ["evidence"] : [],
      message: "message", arguments: argumentsValue, related,
      fix: detailed ? { description: "replace", edits: [{ origin: origin(), replacement: "replacement" }] } : null };
    const diagnosticWire = `Diagnostic(code=${codeWire}, severity="${severity}", site=${siteWire}, ` +
      `source=${detailed ? '"source"' : "null"}, evidence=${detailed ? '["evidence"]' : "[]"}, message="message", ` +
      (detailed ? 'arguments=[text(value="text"), integer(value=1208925819614629174706176n), number(value=-0), ' +
        `origin(value=${codecOriginWire})], related=[RelatedDiagnostic(site=file(path="/project/other.ts"), ` +
        'code=checker(number=1, rendered="TS1"), message="related"), RelatedDiagnostic(site=none(), ' +
        'code=extension(number=2, extensionCode="E_RELATED", rendered="TSEXT2"), message="detail")], ' +
        `fix=DiagnosticFix(description="replace", edits=[TextEdit(origin=${codecOriginWire}, replacement="replacement")]))` :
        'arguments=[], related=[], fix=null)');
    const endpoint = { ordinal: 0, declaration: ownerId, advertised: codecEndpoint, api: codecEndpoint,
      bindings: emptyBindings(), conditionalFailure: diagnostic };
    const input = { context: codecContext, kind: "call", callee: codecEvidence, receiver: null, typeArguments: [], arguments: [], candidates: [endpoint] };
    const inputWire = `CandidateInput(context=${codecContextWire}, kind="call", callee=${codecEvidenceWire}, receiver=null, ` +
      `typeArguments=[], arguments=[], candidates=[CandidateEndpoint(ordinal=0, declaration=def:"${ownerId}", ` +
      `advertised=${codecEndpointWire}, api=${codecEndpointWire}, bindings=${codecBindingsWire}, conditionalFailure=${diagnosticWire})])`;
    const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: { invocation: { rule: "candidate", input }, result: 0 } } };
    const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(invocation=` +
      `DeferredInvocation(rule="candidate", input=${inputWire}), result=t:0)))`;
    const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken",
      operand: codecName(5, 4), tsonic: phase }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ]);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire independently authored diagnostic value", compareCaseValues);
    assertCompleteValue(product.printTir(parsed.value), expected, "entire independently authored diagnostic wire", sameWire);
    if (code.kind === "host") {
      const invalidCode = expected.replace(`host(name=${JSON.stringify(code.name)}`, "host(name=null");
      const offset = invalidCode.indexOf("null", invalidCode.indexOf("host(name="));
      assertInvalidText(invalidCode, offset, ["string"], "null");
    }
  });
}
const selectedOperatorLiterals = ["+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^",
  "<<", ">>", ">>>", "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"];
const selectedProtocolSteps = [
  { role: "acquire", operation: { kind: "call", application: codecApplicationDecision }, operands: [0], result: 0 },
  ...["next", "done", "value", "finish", "fail", "await", "dispose"].map(role => ({ role,
    operation: { kind: "core", declaration: ownerId, bindings: emptyBindings() }, operands: [0], result: 0 })),
  { role: "completion", operation: { kind: "completion" }, operands: [0], result: 0 },
];
const selectedProtocolStepsWire = `ProtocolStepDecision(role="acquire", operation=call(application=${codecApplicationDecisionWire}), ` +
  'operands=[t:0], result=t:0), ' + ["next", "done", "value", "finish", "fail", "await", "dispose"].map(role =>
  `ProtocolStepDecision(role="${role}", operation=core(declaration=def:"${ownerId}", bindings=${codecBindingsWire}), ` +
  'operands=[t:0], result=t:0)').join(", ") + ', ProtocolStepDecision(role="completion", operation=completion(), operands=[t:0], result=t:0)';
const selectedIdentityCases = [
  ...["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128",
    "native-int", "native-uint", "float16", "float32", "float64", "decimal"].map(carrier => [
    { kind: "native-operator", operator: "+", carrier }, `native-operator(operator="+", carrier="${carrier}")`,
  ]),
  ...selectedOperatorLiterals.filter(operator => operator !== "+").map(operator => [
    { kind: "native-operator", operator, carrier: "int32" }, `native-operator(operator="${operator}", carrier="int32")`,
  ]),
  ...selectedOperatorLiterals.map(operator => [
    { kind: "bigint-operator", operator }, `bigint-operator(operator="${operator}")`,
  ]),
  ...["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="].map(operator => [
    { kind: "string-operator", operator }, `string-operator(operator="${operator}")`,
  ]),
  ...["!", "&&", "||", "==", "!=", "===", "!=="].map(operator => [
    { kind: "boolean-operator", operator }, `boolean-operator(operator="${operator}")`,
  ]),
  ...[false, true].map(negated => [{ kind: "absence-test", negated }, `absence-test(negated=${negated})`]),
  [{ kind: "object-construction", parts: [codecPart] }, `object-construction(parts=[${codecPartWire}])`],
  [{ kind: "array-construction", parts: [codecPart] }, `array-construction(parts=[${codecPartWire}])`],
  [{ kind: "conversion", from: 0, to: 0, embedding: { kind: "identity" } }, "conversion(from=t:0, to=t:0, embedding=identity())"],
  [{ kind: "library", declaration: ownerId, bindings: emptyBindings() }, `library(declaration=def:"${ownerId}", bindings=${codecBindingsWire})`],
  [{ kind: "core", declaration: ownerId, bindings: emptyBindings() }, `core(declaration=def:"${ownerId}", bindings=${codecBindingsWire})`],
  ...["pointer-address", "pointer-read", "pointer-write", "pointer-offset", "type-query", "discard"].map(kind => [{ kind }, `${kind}()`]),
  ...["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"].flatMap(protocol =>
    [false, true].map(asynchronous => [{ kind: "protocol", protocol, asynchronous, steps: selectedProtocolSteps,
      value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
    `protocol(protocol="${protocol}", asynchronous=${asynchronous}, steps=[${selectedProtocolStepsWire}], ` +
      'value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)'])),
];

// One selected operation on a prefix unary expression: the carrier of the decision-field vectors and of their refusals.
const decisionFieldCase = (identity, identityWire, execution, executionWire) => {
  const operation = { permissionScope: 4, decision: { kind: "selected", operation: identity, operands: [0], result: 0, execution } };
  const operationWire = `TypedOperation(decision=selected(operation=${identityWire}, operands=[t:0], result=t:0, execution=${executionWire}), permissionScope=n:4)`;
  return syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
    tsonic: { ...typedValue(), role: "value", operation: { kind: "decided", decision: operation } } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
      `tsonic=TypedPrefix(${valueWire}, role="value", operation=decided(decision=${operationWire})))`, codecNameWire(5, 4),
  ]);
};

test("the text reader refuses an unknown value and a missing last field of the location, activation and execution fields at the field's own position", () => {
  // This codec names the schema of a value it cannot read and the field it misses; the position is the value's first character
  // and the place where the missing field's separator would stand.
  const refuse = (text, slot, unknown, schema, found) => {
    const start = text.indexOf(slot);
    assert.equal(start >= 0 && text.indexOf(slot, start + 1) === -1, true, `${slot} is stated once`);
    assert.equal(text.slice(start - 2, start) === ", " && text[start + slot.length] === ")", true, `${slot} is the last field of its record`);
    const value = start + slot.indexOf("=") + 1;
    assertInvalidText(text.slice(0, value) + unknown + text.slice(start + slot.length), value, [schema], found);
    assertInvalidText(text.slice(0, start - 2) + text.slice(start + slot.length), start - 2, [slot.slice(0, slot.indexOf("="))], ")");
  };
  refuse(decisionFieldCase({ kind: "discard" }, "discard()", { kind: "invocation", writesStorage: true, failure: "abort" },
    'invocation(writesStorage=true, failure="abort")').expected, 'execution=invocation(writesStorage=true, failure="abort")', "proved()", "OperationExecution", "proved");
  const location = 'location=data(check=required(failure="unwind"), receiver="by-reference")';
  const memberWire = codecMemberDecisionWire.replace(`getter=${codecEndpointWire}, setter=${codecEndpointWire}`, "getter=null, setter=null").replace("location=accessor()", location);
  refuse(decisionFieldCase({ kind: "array-construction", parts: [{ ...codecPart, member: { ...codecMemberDecision, getter: null, setter: null,
    location: { kind: "data", check: { kind: "required", failure: "unwind" }, receiver: "by-reference" } } }] },
  `array-construction(parts=[${codecPartWire.replace(codecMemberDecisionWire, memberWire)}])`, { kind: "pure" }, "pure()").expected, location, "proved()", "AccessLocation", "proved");
  const applicationWire = codecApplicationDecisionWire.replace("result=t:0, activation=null", 'result=t:0, activation="when-first-driven"');
  refuse(decisionFieldCase({ kind: "protocol", protocol: "iterate", asynchronous: false,
    steps: [{ role: "acquire", operation: { kind: "call", application: { ...codecApplicationDecision, activation: "when-first-driven" } }, operands: [0], result: 0 }],
    value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
  `protocol(protocol="iterate", asynchronous=false, steps=[ProtocolStepDecision(role="acquire", operation=call(application=${applicationWire}), ` +
    'operands=[t:0], result=t:0)], value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)', { kind: "pure" }, "pure()").expected,
  'activation="when-first-driven"', '"proved"', "?HandleActivation", '"proved"');
});

test("check, location, execution and activation fields of the decisions have a complete public codec vector for every value", () => {
  const roundTrip = (identity, identityWire, execution, executionWire, label) => {
    const fixture = decisionFieldCase(identity, identityWire, execution, executionWire);
    assertBodyRoundTrip(fixture.body, fixture.expected, label);
  };
  for (const writesStorage of [false, true]) for (const failure of ["none", "unwind", "abort"])
    roundTrip({ kind: "discard" }, "discard()", { kind: "invocation", writesStorage, failure },
      `invocation(writesStorage=${writesStorage}, failure="${failure}")`, `invocation ${writesStorage} ${failure}`);
  for (const [check, checkWire] of [[{ kind: "none" }, "none()"], [{ kind: "required", failure: "unwind" }, 'required(failure="unwind")'],
    [{ kind: "required", failure: "abort" }, 'required(failure="abort")']]) for (const receiver of ["in-place", "by-reference"]) {
    const member = { ...codecMemberDecision, getter: null, setter: null, location: { kind: "data", check, receiver } };
    const memberWire = codecMemberDecisionWire.replace(`getter=${codecEndpointWire}, setter=${codecEndpointWire}`, "getter=null, setter=null")
      .replace("location=accessor()", `location=data(check=${checkWire}, receiver="${receiver}")`);
    assert.equal(memberWire.includes("getter=null, setter=null") && memberWire.includes("location=data("), true);
    roundTrip({ kind: "array-construction", parts: [{ ...codecPart, member }] },
      `array-construction(parts=[${codecPartWire.replace(codecMemberDecisionWire, memberWire)}])`, { kind: "pure" }, "pure()", `data location ${checkWire} ${receiver}`);
  }
  for (const activation of ["at-creation", "when-first-driven"]) {
    const application = { ...codecApplicationDecision, activation };
    const applicationWire = codecApplicationDecisionWire.replace("result=t:0, activation=null", `result=t:0, activation="${activation}"`);
    assert.equal(applicationWire.includes(`activation="${activation}"`), true);
    roundTrip({ kind: "protocol", protocol: "iterate", asynchronous: false,
      steps: [{ role: "acquire", operation: { kind: "call", application }, operands: [0], result: 0 }], value: 0, completion: 0, yielded: 0, sent: 0, thrown: 0 },
    `protocol(protocol="iterate", asynchronous=false, steps=[ProtocolStepDecision(role="acquire", operation=call(application=${applicationWire}), ` +
      'operands=[t:0], result=t:0)], value=t:0, completion=t:0, yielded=t:0, sent=t:0, thrown=t:0)', { kind: "pure" }, "pure()", `activation ${activation}`);
  }
});

for (const [identity, identityWire] of selectedIdentityCases) {
  const suffix = [identity.carrier, identity.operator, identity.protocol, identity.asynchronous, identity.negated]
    .filter(value => value !== undefined).join("/");
  test(`the complete selected ${identity.kind}/${suffix} operation has an independently authored public codec vector`, () => {
    // A pointer write is an invocation that writes storage; a library operation is an ordinary invocation. The other
    // executions in this vector are fixture values that no rule has decided.
    const [execution, executionWire] = identity.kind === "pointer-write"
      ? [{ kind: "invocation", writesStorage: true, failure: "none" }, 'invocation(writesStorage=true, failure="none")']
      : identity.kind === "library" ? [{ kind: "invocation", writesStorage: true, failure: "unwind" }, 'invocation(writesStorage=true, failure="unwind")']
        : [{ kind: "pure" }, "pure()"];
    const operation = { permissionScope: 4, decision: { kind: "selected", operation: identity, operands: [0], result: 0, execution } };
    const operationWire = `TypedOperation(decision=selected(operation=${identityWire}, operands=[t:0], result=t:0, execution=${executionWire}), permissionScope=n:4)`;
    const fixture = syntaxPayloadCase({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
      tsonic: { ...typedValue(), role: "value", operation: { kind: "decided", decision: operation } } }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
        `tsonic=TypedPrefix(${valueWire}, role="value", operation=decided(decision=${operationWire})))`, codecNameWire(5, 4),
    ]);
    assertBodyRoundTrip(fixture.body, fixture.expected, identity.kind);
    if (identity.kind === "discard") {
      const removed = fixture.expected.replace("selected(operation=", 'OperationDecision(kind="selected", operation=');
      const offset = removed.indexOf('OperationDecision(kind="selected"');
      assertCompleteValue(product.parseTir(removed), invalidTextAt(removed, offset, ["OperationDecision"], "OperationDecision"),
        "the removed record spelling is rejected rather than accepted as a compatibility alias");
    }
  });
}

for (const [kind, phase, wire] of [
  ["TrueKeyword", { ...typedValue(), role: "value" }, `TypedKeyword(${valueWire}, role="value")`],
  ["FalseKeyword", { ...typedValue(), role: "value" }, `TypedKeyword(${valueWire}, role="value")`],
  ["NullKeyword", { role: "type-literal", type: 0 }, 'TypedKeyword(role="type-literal", type=t:0)'],
  ["ThisKeyword", { ...typedValue(), role: "receiver", owner: ownerId }, `TypedKeyword(${valueWire}, role="receiver", owner=def:"${ownerId}")`],
  ["SuperKeyword", { ...typedValue(), role: "super", owner: ownerId, base: 0 }, `TypedKeyword(${valueWire}, role="super", owner=def:"${ownerId}", base=t:0)`],
]) {
  test(`actual ${kind} syntax retains the complete ${phase.role} keyword arm`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: phase }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=${wire})`], kind);
  });
}

test("actual prefix type-literal/update and postfix update roles use their own mapped phase families", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "MinusToken", operand: codecName(5, 4),
    tsonic: { role: "type-literal", type: 0 } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="MinusToken", operand=n:5, tsonic=TypedPrefix(role="type-literal", type=t:0))`,
    codecNameWire(5, 4),
  ], "prefix type literal");
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "type-query" }, operands: [0], result: 0, execution: { kind: "pure" } } };
  const operationWire = 'decided(decision=TypedOperation(decision=selected(operation=type-query(), ' +
    'operands=[t:0], result=t:0, execution=pure()), permissionScope=null))';
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusPlusToken", operand: codecName(5, 4),
    tsonic: { ...typedValue(), role: "update", storage: 0, operation: { kind: "decided", decision: operation } } }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusPlusToken", operand=n:5, ` +
      `tsonic=TypedPrefix(${valueWire}, role="update", storage=t:0, operation=${operationWire}))`, codecNameWire(5, 4),
  ], "prefix update");
  assertSyntaxPayload({ ...header(4, 2), kind: "PostfixUnaryExpression", operand: codecName(5, 4), operator: "MinusMinusToken",
    tsonic: { ...typedValue(), storage: 0, operation: { kind: "decided", decision: operation } } }, [
    `PostfixUnaryExpression(${syntaxHeaderWire(4, 2)}, operand=n:5, operator="MinusMinusToken", ` +
      `tsonic=TypedUpdate(${valueWire}, storage=t:0, operation=${operationWire}))`, codecNameWire(5, 4),
  ], "postfix update");
});

const codecCallee = { decision: codecApplicationDecision, activation: { body: bodyId, bindings: { kind: "instantiated", bindings: emptyBindings() } },
  captures: [{ body: bodyId, local: 0 }] };
const codecCalleeWire = `ResolvedCallee(decision=${codecApplicationDecisionWire}, activation=BodyInstance(body=body:"${bodyId}", ` +
  `bindings=instantiated(bindings=${codecBindingsWire})), captures=[${localWire}])`;
const codecTypedOperation = { decision: { kind: "selected", operation: { kind: "discard" }, operands: [0], result: 0, execution: { kind: "pure" } }, permissionScope: 4 };
const codecTypedOperationWire = 'TypedOperation(decision=selected(operation=discard(), operands=[t:0], result=t:0, execution=pure()), permissionScope=n:4)';
const codecProtocol = { kind: "delegate", asynchronous: true, steps: [
  { role: "acquire", operation: codecTypedOperation, callee: codecCallee },
  ...["next", "done", "value", "finish", "fail", "await", "dispose", "completion"]
    .map(role => ({ role, operation: codecTypedOperation, callee: null })),
], value: 0, completion: 0, sent: 0, thrown: 0 };
const codecProtocolWire = 'TirProtocol(kind="delegate", asynchronous=true, steps=[' +
  `TirProtocolStep(role="acquire", operation=${codecTypedOperationWire}, callee=${codecCalleeWire}), ` +
  ["next", "done", "value", "finish", "fail", "await", "dispose", "completion"]
    .map(role => `TirProtocolStep(role="${role}", operation=${codecTypedOperationWire}, callee=null)`).join(", ") +
  '], value=t:0, completion=t:0, sent=t:0, thrown=t:0)';
const codecTirApplication = { callee: codecCallee, receiver: 5, arguments: [
  { kind: "provided", parameter: 0, expression: 6 },
  { kind: "omitted", parameter: 1, value: { kind: "initializer", instance: { body: bodyId, bindings: { kind: "parametric" } } } },
  { kind: "omitted", parameter: 2, value: { kind: "absence" } },
  { kind: "omitted", parameter: 3, value: { kind: "empty-rest" } },
  { kind: "rest", parameter: 4, parts: [{ kind: "value", expression: 6 }, { kind: "spread", expression: 6, tuple: [0, 0] },
    { kind: "spread", expression: 6, tuple: null }] },
] };
const codecTirApplicationWire = `TirApplication(callee=${codecCalleeWire}, receiver=n:5, arguments=[provided(parameter=0, expression=n:6), ` +
  `omitted(parameter=1, value=initializer(instance=BodyInstance(body=body:"${bodyId}", bindings=parametric()))), ` +
  'omitted(parameter=2, value=absence()), omitted(parameter=3, value=empty-rest()), ' +
  'rest(parameter=4, parts=[value(expression=n:6), spread(expression=n:6, tuple=[t:0, t:0]), spread(expression=n:6, tuple=null)])])';
for (const kind of ["CallExpression", "NewExpression"]) {
  test(`actual ${kind} codec preserves every typed argument disposition and complete callee activation`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), ...(kind === "CallExpression" ? { questionDotToken: null } : {}),
      typeArguments: null, arguments: nodeList([codecName(6, 4)]),
      tsonic: { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: { kind: "decided", decision: codecTypedOperation } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "CallExpression" ? "questionDotToken=null, " : ""}` +
        'typeArguments=null, arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ' +
        `tsonic=TypedApplication(${valueWire}, application=decided(decision=${codecTirApplicationWire}), operation=decided(decision=${codecTypedOperationWire})))`,
      codecNameWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}
for (const [kind, phaseType, field] of [["AwaitExpression", "TypedProtocolValue", "expression"], ["SpreadElement", "TypedSpread", "expression"]]) {
  test(`actual ${kind} retains all supplied structural protocol channels and steps without a guessed role law`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, [field]: codecName(5, 4), tsonic: { ...typedValue(), protocol: { kind: "decided", decision: codecProtocol } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${field}=n:5, tsonic=${phaseType}(${valueWire}, protocol=decided(decision=${codecProtocolWire})))`,
      codecNameWire(5, 4),
    ], kind);
  });
}
for (const kind of ["ForInStatement", "ForOfStatement"]) {
  test(`actual ${kind} retains its authored iteration fields and supplied protocol data`, () => {
    const asynchronous = kind === "ForOfStatement";
    assertSyntaxPayload({ ...header(4, 2), kind, awaitModifier: asynchronous ? { ...header(5, 4), kind: "AwaitKeyword", tsonic: null } : null,
      initializer: codecName(asynchronous ? 6 : 5, 4), expression: codecName(asynchronous ? 7 : 6, 4),
      statement: codecEmptyStatement(asynchronous ? 8 : 7, 4), tsonic: { protocol: { kind: "decided", decision: codecProtocol } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, awaitModifier=${asynchronous ? "n:5" : "null"}, initializer=n:${asynchronous ? 6 : 5}, ` +
        `expression=n:${asynchronous ? 7 : 6}, statement=n:${asynchronous ? 8 : 7}, tsonic=TypedIteration(protocol=decided(decision=${codecProtocolWire})))`,
      ...(asynchronous ? [`AwaitKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`] : []), codecNameWire(asynchronous ? 6 : 5, 4),
      codecNameWire(asynchronous ? 7 : 6, 4), codecEmptyStatementWire(asynchronous ? 8 : 7, 4),
    ], kind);
  });
}
for (const kind of ["PropertyAccessExpression", "ElementAccessExpression"]) {
  test(`actual ${kind} retains non-null getter/setter activations and the complete assignment access record`, () => {
    const selection = { decision: codecMemberDecision, getter: codecCallee, setter: codecCallee };
    const selectionWire = `MemberSelection(decision=${codecMemberDecisionWire}, getter=${codecCalleeWire}, setter=${codecCalleeWire})`;
    const memberField = kind === "PropertyAccessExpression" ? "name" : "argumentExpression";
    const access = { kind: "read-write", storage: 0, read: 0, narrowing: { kind: "identity", type: 0 }, evidenceIndex: 0 };
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null },
      [memberField]: codecName(7, 4), tsonic: { role: "assignment-target", selection: { kind: "decided", decision: selection }, access } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=n:6, ${memberField}=n:7, ` +
        `tsonic=TypedMember(role="assignment-target", selection=decided(decision=${selectionWire}), ` +
        'access=read-write(storage=t:0, read=t:0, narrowing=identity(type=t:0), evidenceIndex=0)))',
      codecNameWire(5, 4), `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecNameWire(7, 4),
    ], kind);
  });
}
const codecTemplateToken = (kind, identity, parent) => ({ ...header(identity, parent), kind, text: "a", tokenFlags: ["UnicodeEscape"],
  rawText: "\\u0061", templateFlags: ["ContainsInvalidEscape"], tsonic: null });
const codecTemplateTokenWire = (kind, identity, parent) => `${kind}(${syntaxHeaderWire(identity, parent)}, text="a", ` +
  'tokenFlags=["UnicodeEscape"], rawText="\\\\u0061", templateFlags=["ContainsInvalidEscape"], tsonic=null)';
for (const typed of [false, true]) {
  test(`actual ${typed ? "type" : "value"} template retains head/middle/tail spelling and complete span records`, () => {
    const span = (identity, literalKind) => ({ ...header(identity, 4), kind: typed ? "TemplateLiteralTypeSpan" : "TemplateSpan",
      [typed ? "type" : "expression"]: typed ? codecType(identity + 1, identity) : codecName(identity + 1, identity),
      literal: codecTemplateToken(literalKind, identity + 2, identity), tsonic: typed ? { type: 0, declarations: [ownerId] } : null });
    const kind = typed ? "TemplateLiteralType" : "TemplateExpression";
    const phase = typed ? { type: 0, declarations: [ownerId] } : { ...typedValue(), operation: { kind: "decided", decision: codecTypedOperation } };
    const phaseWire = typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` :
      `TypedTemplate(${valueWire}, operation=decided(decision=${codecTypedOperationWire}))`;
    const spanKind = typed ? "TemplateLiteralTypeSpan" : "TemplateSpan";
    assertSyntaxPayload({ ...header(4, 2), kind, head: codecTemplateToken("TemplateHead", 5, 4),
      templateSpans: nodeList([span(6, "TemplateMiddle"), span(9, "TemplateTail")]), tsonic: phase }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, head=n:5, templateSpans=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6, n:9]), tsonic=${phaseWire})`,
      codecTemplateTokenWire("TemplateHead", 5, 4),
      `${spanKind}(${syntaxHeaderWire(6, 4)}, ${typed ? "type" : "expression"}=n:7, literal=n:8, ` +
        `tsonic=${typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` : "null"})`,
      typed ? codecTypeWire(7, 6) : codecNameWire(7, 6), codecTemplateTokenWire("TemplateMiddle", 8, 6),
      `${spanKind}(${syntaxHeaderWire(9, 4)}, ${typed ? "type" : "expression"}=n:10, literal=n:11, ` +
        `tsonic=${typed ? `TypedType(type=t:0, declarations=[def:"${ownerId}"])` : "null"})`,
      typed ? codecTypeWire(10, 9) : codecNameWire(10, 9), codecTemplateTokenWire("TemplateTail", 11, 9),
    ], kind);
  });
}
test("a tagged template and a no-substitution literal retain raw and decoded strings separately", () => {
  const literal = { ...codecTemplateToken("NoSubstitutionTemplateLiteral", 8, 4), tsonic: { ...typedValue(), role: "value", value: "a" } };
  assertSyntaxPayload({ ...header(4, 2), kind: "TaggedTemplateExpression", tag: codecName(5, 4),
    questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null }, typeArguments: nodeList([codecType(7, 4)]), template: literal,
    tsonic: { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: null } }, [
    `TaggedTemplateExpression(${syntaxHeaderWire(4, 2)}, tag=n:5, questionDotToken=n:6, ` +
      'typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), template=n:8, ' +
      `tsonic=TypedApplication(${valueWire}, application=decided(decision=${codecTirApplicationWire}), operation=null))`,
    codecNameWire(5, 4), `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4),
    `NoSubstitutionTemplateLiteral(${syntaxHeaderWire(8, 4)}, text="a", tokenFlags=["UnicodeEscape"], rawText="\\\\u0061", ` +
      `templateFlags=["ContainsInvalidEscape"], tsonic=TypedString(${valueWire}, role="value", value="a"))`,
  ], "tagged template");
});
test("regular-expression literal text is preserved without host evaluation or pattern reinterpretation", () => {
  assertExpressionRoundTrip("RegularExpressionLiteral", { text: "/[a-z]+/giu", tokenFlags: ["Unterminated"] },
    'text="/[a-z]+/giu", tokenFlags=["Unterminated"]', typedValue(), `TypedValue(${valueWire})`);
});
for (const kind of ["AsExpression", "SatisfiesExpression"]) {
  test(`actual ${kind} retains its expression and type without semantic replay`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), type: codecType(6, 4), tsonic: typedValue() }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, type=n:6, tsonic=TypedValue(${valueWire}))`, codecNameWire(5, 4), codecTypeWire(6, 4),
    ], kind);
  });
}
for (const kind of ["NonNullExpression", "PartiallyEmittedExpression"]) {
  test(`actual ${kind} retains its own mapped value/null phase`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), tsonic: kind === "NonNullExpression" ? typedValue() : null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${kind === "NonNullExpression" ? `TypedValue(${valueWire})` : "null"})`,
      codecNameWire(5, 4),
    ], kind);
  });
}
test("synthetic references retain both actual expression and thisArg children", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "SyntheticReferenceExpression", expression: codecName(5, 4), thisArg: codecName(6, 4), tsonic: null }, [
    `SyntheticReferenceExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, thisArg=n:6, tsonic=null)`, codecNameWire(5, 4), codecNameWire(6, 4),
  ], "synthetic reference");
});
for (const keywordToken of ["ImportKeyword", "NewKeyword"]) {
  test(`actual ${keywordToken} meta-property retains the selected keyword and name`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "MetaProperty", keywordToken, name: codecName(5, 4), tsonic: typedValue() }, [
      `MetaProperty(${syntaxHeaderWire(4, 2)}, keywordToken="${keywordToken}", name=n:5, tsonic=TypedValue(${valueWire}))`, codecNameWire(5, 4),
    ], keywordToken);
  });
}
for (const [key, keyWire] of [[{ kind: "constant", key: codecKey }, `constant(key=${codecKeyWire})`],
  [{ kind: "computed", type: 0 }, "computed(type=t:0)"]]) {
  test(`actual computed-name phase retains its ${key.kind} property-key arm`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ComputedPropertyName", expression: codecName(5, 4), tsonic: key }, [
      `ComputedPropertyName(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${keyWire})`, codecNameWire(5, 4),
    ], key.kind);
  });
}
test("qualified/private names and an omitted expression retain their distinct real phase records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "QualifiedName", left: codecName(5, 4), right: codecName(6, 4),
    tsonic: { role: "type-name", type: 0, declarations: [ownerId] } }, [
    `QualifiedName(${syntaxHeaderWire(4, 2)}, left=n:5, right=n:6, tsonic=TypedName(role="type-name", type=t:0, declarations=[def:"${ownerId}"]))`,
    codecNameWire(5, 4), codecNameWire(6, 4),
  ], "qualified name");
  assertSyntaxPayload({ ...header(4, 2), kind: "PrivateIdentifier", text: "#field", tsonic: { role: "private-name", declaration: ownerId } }, [
    `PrivateIdentifier(${syntaxHeaderWire(4, 2)}, text="#field", tsonic=TypedName(role="private-name", declaration=def:"${ownerId}"))`,
  ], "private identifier");
  assertSyntaxPayload({ ...header(4, 2), kind: "OmittedExpression", tsonic: { storage: 0 } }, [
    `OmittedExpression(${syntaxHeaderWire(4, 2)}, tsonic=TypedOmission(storage=t:0))`,
  ], "omitted expression");
});
for (const kind of ["PropertyAssignment", "ShorthandPropertyAssignment"]) {
  test(`actual ${kind} retains nullable syntax fields and its independently supplied member association`, () => {
    const selection = { decision: codecMemberDecision, getter: codecCallee, setter: codecCallee };
    const phaseType = kind === "PropertyAssignment" ? "TypedProperty" : "TypedShorthand";
    const fields = kind === "PropertyAssignment" ? { initializer: codecName(8, 4) }
      : { equalsToken: { ...header(8, 4), kind: "EqualsToken", tsonic: null }, objectAssignmentInitializer: codecName(9, 4) };
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4),
      postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, type: codecType(7, 4), ...fields,
      tsonic: { key: codecKey, member: { kind: "decided", decision: selection } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, type=n:7, ` +
        `${kind === "PropertyAssignment" ? "initializer=n:8" : "equalsToken=n:8, objectAssignmentInitializer=n:9"}, ` +
        `tsonic=${phaseType}(key=${codecKeyWire}, member=decided(decision=MemberSelection(decision=${codecMemberDecisionWire}, ` +
        `getter=${codecCalleeWire}, setter=${codecCalleeWire}))))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4),
      ...(kind === "PropertyAssignment" ? [codecNameWire(8, 4)] : [`EqualsToken(${syntaxHeaderWire(8, 4)}, tsonic=null)`, codecNameWire(9, 4)]),
    ], kind);
  });
}
test("a complete type literal retains its nonempty actual member syntax rather than a placeholder type", () => {
  const member = { ...header(5, 4), kind: "PropertySignature", modifiers: nodeList(), name: codecName(6, 5),
    postfixToken: { ...header(7, 5), kind: "QuestionToken", tsonic: null }, type: codecType(8, 5), initializer: codecName(9, 5),
    tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } };
  assertSyntaxPayload({ ...header(4, 2), kind: "TypeLiteral", members: nodeList([member]), tsonic: { type: 0, declarations: [ownerId] } }, [
    `TypeLiteral(${syntaxHeaderWire(4, 2)}, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      `tsonic=TypedType(type=t:0, declarations=[def:"${ownerId}"]))`,
    `PropertySignature(${syntaxHeaderWire(5, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:6, postfixToken=n:7, type=n:8, initializer=n:9, ` +
      `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
    codecNameWire(6, 5), `QuestionToken(${syntaxHeaderWire(7, 5)}, tsonic=null)`, codecTypeWire(8, 5), codecNameWire(9, 5),
  ], "type literal");
});
for (const kind of ["and", "or", "coalesce"]) {
  const token = kind === "and" ? "AmpersandAmpersandToken" : kind === "or" ? "BarBarToken" : "QuestionQuestionToken";
  test(`the entire ${kind} short-circuit selection retains its authored endpoints and disposition`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "BinaryExpression", modifiers: nodeList(), left: codecName(5, 4), type: codecType(6, 4),
      operatorToken: { ...header(7, 4), kind: token, tsonic: null }, right: codecName(8, 4),
      tsonic: { ...typedValue(), role: "short-circuit", selection: { kind, control: 5, right: 8, disposition: "dynamic" } } }, [
      `BinaryExpression(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), left=n:5, type=n:6, operatorToken=n:7, right=n:8, ` +
        `tsonic=TypedBinary(${valueWire}, role="short-circuit", selection=${kind}(control=n:5, right=n:8, disposition="dynamic")))`,
      codecNameWire(5, 4), codecTypeWire(6, 4), `${token}(${syntaxHeaderWire(7, 4)}, tsonic=null)`, codecNameWire(8, 4),
    ], kind);
  });
}
test("ordinary numeric and bigint values retain non-null narrowing and evidence fields in their own phase family", () => {
  assertExpressionRoundTrip("NumericLiteral", { text: "0", tokenFlags: ["ContainsSeparator"] }, 'text="0", tokenFlags=["ContainsSeparator"]',
    { ...typedValue(), role: "value", value: { numerator: 0n, denominator: 1n, negativeZero: false } },
    `TypedNumber(${valueWire}, role="value", value=ExactRational(numerator=0n, denominator=1n, negativeZero=false))`);
  assertExpressionRoundTrip("BigIntLiteral", { text: "0n", tokenFlags: ["ContainsSeparator"] }, 'text="0n", tokenFlags=["ContainsSeparator"]',
    { ...typedValue(), role: "value", value: 0n }, `TypedBigInt(${valueWire}, role="value", value=0n)`);
});
const codecClass = { definition: ownerId, parameters: [codecParameterType], type: 0, heritage: [0], members: [ownerId], attributes: [codecAttribute] };
const codecClassWire = `TypedClass(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0, ` +
  `heritage=[t:0], members=[def:"${ownerId}"], attributes=[${codecAttributeWire}])`;
const codecHeritageExpression = (identity, parent) => ({ ...header(identity, parent), kind: "ExpressionWithTypeArguments",
  expression: codecName(identity + 1, identity), typeArguments: nodeList([codecType(identity + 2, identity)]),
  tsonic: { role: "heritage", type: 0, bindings: emptyBindings(), declarations: [ownerId] } });
const codecHeritageDefinitions = (identity, parent) => [
  `ExpressionWithTypeArguments(${syntaxHeaderWire(identity, parent)}, expression=n:${identity + 1}, ` +
    `typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:${identity + 2}]), ` +
    `tsonic=TypedInstantiation(role="heritage", type=t:0, bindings=${codecBindingsWire}, declarations=[def:"${ownerId}"]))`,
  codecNameWire(identity + 1, identity), codecTypeWire(identity + 2, identity),
];
for (const kind of ["ClassDeclaration", "ClassExpression"]) {
  test(`actual ${kind} has nonempty parameter/heritage/member/attribute vectors and its specific phase`, () => {
    const heritage = { ...header(11, 4), kind: "HeritageClause", token: "ExtendsKeyword",
      types: nodeList([codecHeritageExpression(12, 11)]), tsonic: { types: [0] } };
    const member = { ...header(15, 4), kind: "SemicolonClassElement", tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4), typeParameters: nodeList([codecTypeParameter(6, 4)]),
      heritageClauses: nodeList([heritage]), members: nodeList([member]),
      tsonic: kind === "ClassDeclaration" ? codecClass : { ...typedValue(), declaration: codecClass } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        'heritageClauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:15]), ' +
        `tsonic=${kind === "ClassDeclaration" ? codecClassWire : `TypedClassValue(${valueWire}, declaration=${codecClassWire})`})`,
      codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4),
      `HeritageClause(${syntaxHeaderWire(11, 4)}, token="ExtendsKeyword", types=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ` +
        'tsonic=TypedHeritage(types=[t:0]))', ...codecHeritageDefinitions(12, 11),
      `SemicolonClassElement(${syntaxHeaderWire(15, 4)}, tsonic=null)`,
    ], kind);
  });
}
for (const kind of ["TypeAliasDeclaration", "JSTypeAliasDeclaration"]) {
  test(`actual ${kind} retains its declared type, syntax parameters and parameter identities`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4), typeParameters: nodeList([codecTypeParameter(6, 4)]),
      type: codecType(11, 4), tsonic: { definition: ownerId, parameters: [codecParameterType], type: 0 } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
        `type=n:11, tsonic=TypedAlias(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0))`,
      codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4), codecTypeWire(11, 4),
    ], kind);
  });
}
test("actual interface type elements retain declared read/write capabilities", () => {
  const member = { ...header(11, 4), kind: "IndexSignature", modifiers: nodeList(), typeParameters: null,
    parameters: nodeList([codecParameter(12, 11)]), type: codecType(18, 11), fullSignature: codecType(19, 11),
    tsonic: { definition: ownerId, key: 0, read: 0, write: 0 } };
  assertSyntaxPayload({ ...header(4, 2), kind: "InterfaceDeclaration", modifiers: nodeList(), name: codecName(5, 4),
    typeParameters: nodeList([codecTypeParameter(6, 4)]), heritageClauses: nodeList(), members: nodeList([member]),
    tsonic: { definition: ownerId, parameters: [codecParameterType], type: 0, members: [ownerId] } }, [
    `InterfaceDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'heritageClauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), ' +
      `tsonic=TypedInterface(definition=def:"${ownerId}", parameters=[${codecParameterTypeWire}], type=t:0, members=[def:"${ownerId}"]))`,
    codecNameWire(5, 4), ...codecTypeParameterDefinitions(6, 4),
    `IndexSignature(${syntaxHeaderWire(11, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ` +
      `type=n:18, fullSignature=n:19, tsonic=TypedIndexDeclaration(definition=def:"${ownerId}", key=t:0, read=t:0, write=t:0))`,
    ...codecParameterDefinitions(12, 11), codecTypeWire(18, 11), codecTypeWire(19, 11),
  ], "interface");
});
test("actual enum members preserve initializer publication, attributes and syntax postfix tokens", () => {
  const member = { ...header(6, 4), kind: "EnumMember", modifiers: nodeList(), name: codecName(7, 6),
    postfixToken: { ...header(8, 6), kind: "ExclamationToken", tsonic: null }, initializer: codecName(9, 6),
    tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } };
  assertSyntaxPayload({ ...header(4, 2), kind: "EnumDeclaration", modifiers: nodeList(), name: codecName(5, 4), members: nodeList([member]),
    tsonic: { definition: ownerId, type: 0, members: [ownerId] } }, [
    `EnumDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, members=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      `tsonic=TypedEnum(definition=def:"${ownerId}", type=t:0, members=[def:"${ownerId}"]))`, codecNameWire(5, 4),
    `EnumMember(${syntaxHeaderWire(6, 4)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:7, postfixToken=n:8, initializer=n:9, ` +
      `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
    codecNameWire(7, 6), `ExclamationToken(${syntaxHeaderWire(8, 6)}, tsonic=null)`, codecNameWire(9, 6),
  ], "enum");
});
for (const kind of ["PropertySignature", "PropertyDeclaration"]) {
  test(`actual ${kind} retains its complete storage declaration and nullable fields`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), name: codecName(5, 4),
      postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, type: codecType(7, 4),
      initializer: codecName(8, 4), tsonic: { definition: ownerId, storage: 0, initializer: bodyId, attributes: [codecAttribute] } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, type=n:7, initializer=n:8, ` +
        `tsonic=TypedStorageDeclaration(definition=def:"${ownerId}", storage=t:0, initializer=body:"${bodyId}", attributes=[${codecAttributeWire}]))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecTypeWire(7, 4), codecNameWire(8, 4),
    ], kind);
  });
}
const codecProjectTarget = { target: "project", module: moduleId };
const codecProjectTargetWire = `ImportTarget(target="project", module=mod:"${moduleId}")`;
const codecImported = { definition: ownerId, imported: { kind: "definition", definition: ownerId } };
const codecImportedWire = `TypedImportBinding(definition=def:"${ownerId}", imported=definition(definition=def:"${ownerId}"))`;
const codecExported = { definition: ownerId, exported: { kind: "module", target: codecProjectTarget } };
const codecExportedWire = `TypedExportBinding(definition=def:"${ownerId}", exported=module(target=${codecProjectTargetWire}))`;
for (const packageName of [null, "library-package"]) {
  test(`actual external library module identity retains ${packageName === null ? "no" : "its"} package name`, () => {
    const target = { target: "library", module: { providerId: "provider", providerVersion: "1.0.0", packageName,
      moduleSpecifier: "library/module", providerModuleId: "module" } };
    const targetWire = 'ImportTarget(target="library", module=LibraryModuleIdentity(providerId="provider", providerVersion="1.0.0", ' +
      `packageName=${packageName === null ? "null" : '"library-package"'}, moduleSpecifier="library/module", providerModuleId="module"))`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ExternalModuleReference", expression: codecName(5, 4), tsonic: { target } }, [
      `ExternalModuleReference(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedModuleReference(target=${targetWire}))`, codecNameWire(5, 4),
    ], "library identity");
  });
}
for (const kind of ["NamespaceImport", "NamespaceExport", "NamespaceExportDeclaration"]) {
  test(`actual ${kind} retains its specific module-binding port`, () => {
    const exported = kind !== "NamespaceImport";
    const extra = kind === "NamespaceExportDeclaration" ? { modifiers: nodeList() } : {};
    assertSyntaxPayload({ ...header(4, 2), kind, ...extra, name: codecName(5, 4), tsonic: exported ? codecExported : codecImported }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${kind === "NamespaceExportDeclaration" ? "modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), " : ""}` +
        `name=n:5, tsonic=${exported ? codecExportedWire : codecImportedWire})`, codecNameWire(5, 4),
    ], kind);
  });
}
for (const [kind, childKind, phase, phaseWire] of [
  ["NamedImports", "ImportSpecifier", codecImported, codecImportedWire], ["NamedExports", "ExportSpecifier", codecExported, codecExportedWire],
]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains a nonempty specifier list with ${present ? "an aliased" : "a direct"} name`, () => {
      const child = { ...header(5, 4), kind: childKind, isTypeOnly: true, propertyName: present ? codecName(6, 5) : null,
        name: codecName(present ? 7 : 6, 5), tsonic: phase };
      assertSyntaxPayload({ ...header(4, 2), kind, elements: nodeList([child]), tsonic: null }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=null)`,
        `${childKind}(${syntaxHeaderWire(5, 4)}, isTypeOnly=true, propertyName=${present ? "n:6" : "null"}, ` +
          `name=n:${present ? 7 : 6}, tsonic=${phaseWire})`, codecNameWire(6, 5), ...(present ? [codecNameWire(7, 5)] : []),
      ], kind);
    });
  }
}
for (const phaseModifier of [null, "TypeKeyword", "DeferKeyword"]) {
  test(`actual import clause retains its ${phaseModifier ?? "ordinary"} modifier and both binding children`, () => {
    const binding = { ...header(6, 4), kind: "NamespaceImport", name: codecName(7, 6), tsonic: codecImported };
    assertSyntaxPayload({ ...header(4, 2), kind: "ImportClause", phaseModifier, name: codecName(5, 4), namedBindings: binding,
      tsonic: codecImported }, [
      `ImportClause(${syntaxHeaderWire(4, 2)}, phaseModifier=${phaseModifier === null ? "null" : `"${phaseModifier}"`}, ` +
        `name=n:5, namedBindings=n:6, tsonic=${codecImportedWire})`, codecNameWire(5, 4),
      `NamespaceImport(${syntaxHeaderWire(6, 4)}, name=n:7, tsonic=${codecImportedWire})`, codecNameWire(7, 6),
    ], "import clause");
  });
}
for (const kind of ["ImportDeclaration", "JSImportDeclaration"]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains ${present ? "complete" : "absent"} clause/attribute metadata`, () => {
      const clause = present ? { ...header(5, 4), kind: "ImportClause", phaseModifier: null, name: null, namedBindings: null, tsonic: codecImported } : null;
      const specifier = present ? 6 : 5;
      const attribute = { ...header(8, 7), kind: "ImportAttribute", name: codecName(9, 8), value: codecName(10, 8), tsonic: null };
      const attributes = present ? { ...header(7, 4), kind: "ImportAttributes", token: "WithKeyword", attributes: nodeList([attribute]), multiLine: true, tsonic: null } : null;
      assertSyntaxPayload({ ...header(4, 2), kind, modifiers: nodeList(), importClause: clause, moduleSpecifier: codecName(specifier, 4), attributes,
        tsonic: { definition: ownerId, target: codecProjectTarget } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), importClause=${present ? "n:5" : "null"}, moduleSpecifier=n:${specifier}, ` +
          `attributes=${present ? "n:7" : "null"}, tsonic=TypedImport(definition=def:"${ownerId}", target=${codecProjectTargetWire}))`,
        ...(present ? [`ImportClause(${syntaxHeaderWire(5, 4)}, phaseModifier=null, name=null, namedBindings=null, tsonic=${codecImportedWire})`] : []),
        codecNameWire(specifier, 4), ...(present ? [
          `ImportAttributes(${syntaxHeaderWire(7, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:8]), multiLine=true, tsonic=null)`,
          `ImportAttribute(${syntaxHeaderWire(8, 7)}, name=n:9, value=n:10, tsonic=null)`, codecNameWire(9, 8), codecNameWire(10, 8),
        ] : []),
      ], kind);
    });
  }
}
test("actual import-equals retains its qualified module reference and binding declaration", () => {
  const reference = { ...header(6, 4), kind: "ExternalModuleReference", expression: codecName(7, 6), tsonic: { target: codecProjectTarget } };
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportEqualsDeclaration", modifiers: nodeList(), isTypeOnly: true,
    name: codecName(5, 4), moduleReference: reference, tsonic: codecImported }, [
    `ImportEqualsDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isTypeOnly=true, name=n:5, moduleReference=n:6, tsonic=${codecImportedWire})`,
    codecNameWire(5, 4), `ExternalModuleReference(${syntaxHeaderWire(6, 4)}, expression=n:7, tsonic=TypedModuleReference(target=${codecProjectTargetWire}))`,
    codecNameWire(7, 6),
  ], "import equals");
});
for (const present of [false, true]) {
  test(`actual export declaration keeps ${present ? "its target and export clause" : "the absent target and clause"}`, () => {
    const exportClause = present ? { ...header(5, 4), kind: "NamespaceExport", name: codecName(6, 5), tsonic: codecExported } : null;
    assertSyntaxPayload({ ...header(4, 2), kind: "ExportDeclaration", modifiers: nodeList(), isTypeOnly: true, exportClause,
      moduleSpecifier: present ? codecName(7, 4) : null, attributes: null,
      tsonic: { definition: ownerId, target: present ? codecProjectTarget : null } }, [
      `ExportDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isTypeOnly=true, exportClause=${present ? "n:5" : "null"}, ` +
        `moduleSpecifier=${present ? "n:7" : "null"}, attributes=null, tsonic=TypedExport(definition=def:"${ownerId}", ` +
        `target=${present ? codecProjectTargetWire : "null"}))`,
      ...(present ? [`NamespaceExport(${syntaxHeaderWire(5, 4)}, name=n:6, tsonic=${codecExportedWire})`, codecNameWire(6, 5), codecNameWire(7, 4)] : []),
    ], "export declaration");
    assertSyntaxPayload({ ...header(4, 2), kind: "ExportAssignment", modifiers: nodeList(), isExportEquals: true,
      type: present ? codecType(5, 4) : null, expression: codecName(present ? 6 : 5, 4), tsonic: { definition: ownerId, type: 0 } }, [
      `ExportAssignment(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), isExportEquals=true, type=${present ? "n:5" : "null"}, ` +
        `expression=n:${present ? 6 : 5}, tsonic=TypedExportAssignment(definition=def:"${ownerId}", type=t:0))`,
      ...(present ? [codecTypeWire(5, 4)] : []), codecNameWire(present ? 6 : 5, 4),
    ], "export assignment");
  });
}
for (const kind of ["JSDocImplementsTag", "JSDocAugmentsTag"]) {
  test(`actual ${kind} retains its expression-with-type-arguments child and heritage phase`, () => {
    const className = { ...header(7, 4), kind: "ExpressionWithTypeArguments", expression: codecName(8, 7), typeArguments: nodeList([codecType(9, 7)]),
      tsonic: { role: "heritage", type: 0, bindings: emptyBindings(), declarations: [ownerId] } };
    assertSyntaxPayload({ ...header(4, 2), kind, tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]), className, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), className=n:7, tsonic=null)`,
      codecNameWire(5, 4), codecDocTextWire(6, 4),
      `ExpressionWithTypeArguments(${syntaxHeaderWire(7, 4)}, expression=n:8, typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:9]), ` +
        `tsonic=TypedInstantiation(role="heritage", type=t:0, bindings=${codecBindingsWire}, declarations=[def:"${ownerId}"]))`,
      codecNameWire(8, 7), codecTypeWire(9, 7),
    ], kind);
  });
}
test("actual JSDoc import retains its independent clause/module/attributes fields", () => {
  const clause = { ...header(7, 4), kind: "ImportClause", phaseModifier: "TypeKeyword", name: null, namedBindings: null, tsonic: codecImported };
  const attributes = { ...header(9, 4), kind: "ImportAttributes", token: "AssertKeyword", attributes: nodeList(), multiLine: false, tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "JSDocImportTag", tagName: codecName(5, 4), comment: nodeList([codecDocText(6, 4)]),
    importClause: clause, moduleSpecifier: codecName(8, 4), attributes, tsonic: null }, [
    `JSDocImportTag(${syntaxHeaderWire(4, 2)}, tagName=n:5, comment=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:6]), ` +
      'importClause=n:7, moduleSpecifier=n:8, attributes=n:9, tsonic=null)', codecNameWire(5, 4), codecDocTextWire(6, 4),
    `ImportClause(${syntaxHeaderWire(7, 4)}, phaseModifier="TypeKeyword", name=null, namedBindings=null, tsonic=${codecImportedWire})`, codecNameWire(8, 4),
    `ImportAttributes(${syntaxHeaderWire(9, 4)}, token="AssertKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)`,
  ], "JSDoc import");
});
const codecEmptyStatement = (identity, parent) => ({ ...header(identity, parent), kind: "EmptyStatement", tsonic: null });
const codecEmptyStatementWire = (identity, parent) => `EmptyStatement(${syntaxHeaderWire(identity, parent)}, tsonic=null)`;
const codecBlock = (identity, parent) => ({ ...header(identity, parent), kind: "Block", statements: nodeList([]), multiLine: true, tsonic: null });
const codecBlockWire = (identity, parent) => `Block(${syntaxHeaderWire(identity, parent)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)`;
const codecVariable = (identity, parent) => ({ ...header(identity, parent), kind: "VariableDeclaration", name: codecName(identity + 1, identity),
  exclamationToken: { ...header(identity + 2, identity), kind: "ExclamationToken", tsonic: null },
  type: codecType(identity + 3, identity), initializer: codecName(identity + 4, identity),
  tsonic: { declaration: { kind: "local", local: { body: bodyId, local: 0 } }, storage: 0, initializer: bodyId } });
const codecVariableDefinitions = (identity, parent) => [
  `VariableDeclaration(${syntaxHeaderWire(identity, parent)}, name=n:${identity + 1}, exclamationToken=n:${identity + 2}, ` +
    `type=n:${identity + 3}, initializer=n:${identity + 4}, tsonic=TypedBinding(declaration=local(local=${localWire}), storage=t:0, initializer=body:"${bodyId}"))`,
  codecNameWire(identity + 1, identity), `ExclamationToken(${syntaxHeaderWire(identity + 2, identity)}, tsonic=null)`,
  codecTypeWire(identity + 3, identity), codecNameWire(identity + 4, identity),
];
for (const using of [false, true]) {
  test(`actual ${using ? "using" : "ordinary"} variables retain declaration/storage/initializer and protocol data`, () => {
    const phase = using ? { role: "using", asynchronous: true, protocols: [{ kind: "decided", decision: { ...codecProtocol, kind: "dispose" } }] }
      : { role: "ordinary" };
    const phaseWire = using ? `TypedVariableList(role="using", asynchronous=true, protocols=[decided(decision=${
      codecProtocolWire.replace('kind="delegate"', 'kind="dispose"')})])` : 'TypedVariableList(role="ordinary")';
    const declarations = { ...header(6, 4), kind: "VariableDeclarationList", declarations: nodeList([codecVariable(7, 6)]), tsonic: phase };
    assertSyntaxPayload({ ...header(4, 2), kind: "VariableStatement", modifiers: nodeList([{ ...header(5, 4), kind: "ExportKeyword", tsonic: null }]),
      declarationList: declarations, tsonic: null }, [
      `VariableStatement(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[n:5]), declarationList=n:6, tsonic=null)`,
      `ExportKeyword(${syntaxHeaderWire(5, 4)}, tsonic=null)`,
      `VariableDeclarationList(${syntaxHeaderWire(6, 4)}, declarations=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), tsonic=${phaseWire})`,
      ...codecVariableDefinitions(7, 6),
    ], "variables");
  });
}
for (const kind of ["ObjectBindingPattern", "ArrayBindingPattern"]) {
  test(`actual ${kind} retains every real binding-element child and its storage declaration`, () => {
    const element = { ...header(5, 4), kind: "BindingElement", dotDotDotToken: { ...header(6, 5), kind: "DotDotDotToken", tsonic: null },
      propertyName: codecName(7, 5), name: codecName(8, 5), initializer: codecName(9, 5),
      tsonic: { declaration: { kind: "definition", definition: ownerId }, storage: 0, initializer: bodyId, role: "binding" } };
    assertSyntaxPayload({ ...header(4, 2), kind, elements: nodeList([element]), tsonic: { storage: 0 } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), tsonic=TypedBindingPattern(storage=t:0))`,
      `BindingElement(${syntaxHeaderWire(5, 4)}, dotDotDotToken=n:6, propertyName=n:7, name=n:8, initializer=n:9, ` +
        `tsonic=TypedBindingElement(declaration=definition(definition=def:"${ownerId}"), storage=t:0, initializer=body:"${bodyId}", role="binding"))`,
      `DotDotDotToken(${syntaxHeaderWire(6, 5)}, tsonic=null)`, codecNameWire(7, 5), codecNameWire(8, 5), codecNameWire(9, 5),
    ], kind);
  });
}
test("an actual binding-element hole has no invented declaration or storage in the complete text/value vector", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
    name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ], "binding hole");
});

test("the removed untagged binding-element phase is invalid text, not a compatibility arm", () => {
  const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null,
    propertyName: null, name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ]);
  const old = `TypedBinding(declaration=definition(definition=def:"${ownerId}"), storage=t:0, initializer=null)`;
  const input = expected.replace('TypedBindingElement(role="hole")', old);
  const offset = input.indexOf(old);
  const lines = input.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected: ["TypedBindingElement"], found: "TypedBinding" });
  assertBodyRoundTrip(body, expected, "the complete current hole arm");
});

test("an empty binding-element phase cannot publish either required role arm", () => {
  const { expected } = syntaxPayloadCase({ ...header(4, 2), kind: "BindingElement", dotDotDotToken: null,
    propertyName: null, name: null, initializer: null, tsonic: { role: "hole" } }, [
    `BindingElement(${syntaxHeaderWire(4, 2)}, dotDotDotToken=null, propertyName=null, name=null, initializer=null, ` +
      'tsonic=TypedBindingElement(role="hole"))',
  ]);
  const input = expected.replace('TypedBindingElement(role="hole")', 'TypedBindingElement()');
  const offset = input.indexOf('TypedBindingElement()') + 'TypedBindingElement('.length;
  const lines = input.slice(0, offset).split("\n");
  assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
    column: lines[lines.length - 1].length + 1, expected: ["declaration", "role"], found: ")" });
});
test("actual catch declarations retain their genuine body-local storage and all initializer syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CatchClause", variableDeclaration: codecVariable(5, 4), block: codecBlock(10, 4), tsonic: null }, [
    `CatchClause(${syntaxHeaderWire(4, 2)}, variableDeclaration=n:5, block=n:10, tsonic=null)`,
    ...codecVariableDefinitions(5, 4), codecBlockWire(10, 4),
  ], "catch binding");
});
for (const keyword of ["ModuleKeyword", "NamespaceKeyword"]) {
  test(`actual ${keyword} declaration retains body-before-name traversal and canonical template facts`, () => {
    const block = { ...header(6, 4), kind: "ModuleBlock", statements: nodeList([codecEmptyStatement(7, 6)]), tsonic: null };
    assertSyntaxPayload({ ...header(4, 2), kind: "ModuleDeclaration", modifiers: nodeList(),
      asteriskToken: { ...header(5, 4), kind: "AsteriskToken", tsonic: null }, body: block, keyword, name: codecName(8, 4),
      tsonic: { definition: ownerId, type: 0, template: codecCallable.template } }, [
      `ModuleDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `asteriskToken=n:5, body=n:6, keyword="${keyword}", name=n:8, tsonic=TypedNamespace(definition=def:"${ownerId}", type=t:0, ` +
        `template=TypedBodyTemplate(body=body:"${bodyId}", lexicalBindings=${codecBindingsWire}, dependence="parametric")))`,
      `AsteriskToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`,
      `ModuleBlock(${syntaxHeaderWire(6, 4)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), tsonic=null)`,
      codecEmptyStatementWire(7, 6), codecNameWire(8, 4),
    ], keyword);
  });
}
test("a real missing declaration retains its explicit empty modifier record", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "MissingDeclaration", modifiers: nodeList(), tsonic: null }, [
    `MissingDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=null)`,
  ], "missing declaration");
});
test("the actual Block multiLine field is required before its phase and never silently discarded", () => {
  const body = emptyModuleBody();
  body.root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: true, tsonic: null };
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0] +
    `\nn:0=Block(${syntaxHeaderWire(0, null)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)\n`;
  assertBodyRoundTrip(body, expected, "Block complete multiLine field");
  const text = expected.replace(", multiLine=true", "");
  const offset = text.indexOf("tsonic=null", text.indexOf("n:0=Block("));
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 2,
    column: offset - text.lastIndexOf("\n", offset), expected: ["multiLine"], found: "tsonic" });
});
for (const kind of ["FunctionDeclaration", "FunctionExpression", "Constructor"]) {
  test(`actual ${kind} retains its complete callable or closure record and all declaration children`, () => {
    const closure = kind === "FunctionExpression";
    const fields = { modifiers: nodeList(), typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList([codecParameter(10, 4)]),
      type: codecType(16, 4), fullSignature: codecType(17, 4), asteriskToken: { ...header(18, 4), kind: "AsteriskToken", tsonic: null },
      body: codecBlock(19, 4), ...(kind === "Constructor" ? {} : { name: codecName(20, 4) }) };
    const phase = closure ? { ...typedValue(), callable: codecCallable, captures: [{ body: bodyId, local: 0 }], closure: closureDecisionOf(0, 1) } : codecCallable;
    const phaseWire = closure ? `TypedClosure(${valueWire}, callable=${codecCallableWire}, captures=[${localWire}], closure=${closureDecisionWire(1)})` : codecCallableWire;
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: phase }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        'parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:10]), type=n:16, fullSignature=n:17, asteriskToken=n:18, body=n:19, ' +
        `${kind === "Constructor" ? "" : "name=n:20, "}tsonic=${phaseWire})`,
      ...codecTypeParameterDefinitions(5, 4), ...codecParameterDefinitions(10, 4), codecTypeWire(16, 4), codecTypeWire(17, 4),
      `AsteriskToken(${syntaxHeaderWire(18, 4)}, tsonic=null)`, codecBlockWire(19, 4),
      ...(kind === "Constructor" ? [] : [codecNameWire(20, 4)]),
    ], kind);
  });
}
for (const kind of ["GetAccessor", "SetAccessor", "MethodSignature", "MethodDeclaration"]) {
  test(`actual ${kind} retains its named callable fields, not an implementation-name oracle`, () => {
    const implemented = kind !== "MethodSignature";
    const fields = { modifiers: nodeList(), name: codecName(5, 4), postfixToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null },
      typeParameters: nodeList([codecTypeParameter(7, 4)]), parameters: nodeList([codecParameter(12, 4)]),
      type: codecType(18, 4), fullSignature: codecType(19, 4), ...(implemented ? {
        asteriskToken: { ...header(20, 4), kind: "AsteriskToken", tsonic: null }, body: codecBlock(21, 4),
      } : {}) };
    assertSyntaxPayload({ ...header(4, 2), kind, ...fields, tsonic: codecCallable }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), name=n:5, postfixToken=n:6, ` +
        'typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7]), parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:12]), ' +
        `type=n:18, fullSignature=n:19, ${implemented ? "asteriskToken=n:20, body=n:21, " : ""}tsonic=${codecCallableWire})`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, ...codecTypeParameterDefinitions(7, 4),
      ...codecParameterDefinitions(12, 4), codecTypeWire(18, 4), codecTypeWire(19, 4),
      ...(implemented ? [`AsteriskToken(${syntaxHeaderWire(20, 4)}, tsonic=null)`, codecBlockWire(21, 4)] : []),
    ], kind);
  });
}
test("actual arrow and static initializer syntax retain their body/token/template records", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ArrowFunction", modifiers: nodeList(), typeParameters: null, parameters: nodeList([codecParameter(5, 4)]),
    type: codecType(11, 4), fullSignature: codecType(12, 4), asteriskToken: null, body: codecBlock(13, 4),
    equalsGreaterThanToken: { ...header(14, 4), kind: "EqualsGreaterThanToken", tsonic: null },
    tsonic: { ...typedValue(), callable: codecCallable, captures: [{ body: bodyId, local: 0 }], closure: closureDecisionOf(0, 1, "captured-value") } }, [
    `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
      'type=n:11, fullSignature=n:12, asteriskToken=null, body=n:13, equalsGreaterThanToken=n:14, ' +
      `tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, captures=[${localWire}], closure=${closureDecisionWire(1, "captured-value")}))`,
    ...codecParameterDefinitions(5, 4), codecTypeWire(11, 4), codecTypeWire(12, 4), codecBlockWire(13, 4),
    `EqualsGreaterThanToken(${syntaxHeaderWire(14, 4)}, tsonic=null)`,
  ], "arrow");
  assertSyntaxPayload({ ...header(4, 2), kind: "ClassStaticBlockDeclaration", modifiers: nodeList(), body: codecBlock(5, 4),
    tsonic: { template: codecCallable.template } }, [
    `ClassStaticBlockDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=ModifierList(loc=TextRange(pos=0, end=0), nodes=[]), body=n:5, tsonic=TypedStaticBlock(template=` +
      `TypedBodyTemplate(body=body:"${bodyId}", lexicalBindings=${codecBindingsWire}, dependence="parametric")))`, codecBlockWire(5, 4),
  ], "static block");
});
for (const kind of ["EmptyStatement", "DebuggerStatement", "NotEmittedStatement", "NotEmittedTypeElement", "SemicolonClassElement"]) {
  test(`actual ${kind} has its entire header and null phase, not an invented empty schema`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, tsonic: null }, [`${kind}(${syntaxHeaderWire(4, 2)}, tsonic=null)`], kind);
  });
}
for (const present of [false, true]) {
  test(`actual if/for/return optional children are ${present ? "present" : "absent"} in declared traversal order`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "IfStatement", expression: codecName(5, 4), thenStatement: codecEmptyStatement(6, 4),
      elseStatement: present ? codecEmptyStatement(7, 4) : null, tsonic: null }, [
      `IfStatement(${syntaxHeaderWire(4, 2)}, expression=n:5, thenStatement=n:6, elseStatement=${present ? "n:7" : "null"}, tsonic=null)`,
      codecNameWire(5, 4), codecEmptyStatementWire(6, 4), ...(present ? [codecEmptyStatementWire(7, 4)] : []),
    ], "if");
    assertSyntaxPayload({ ...header(4, 2), kind: "ForStatement", statement: codecEmptyStatement(5, 4),
      initializer: present ? codecName(6, 4) : null, condition: present ? codecName(7, 4) : null,
      incrementor: present ? codecName(8, 4) : null, tsonic: null }, [
      `ForStatement(${syntaxHeaderWire(4, 2)}, statement=n:5, initializer=${present ? "n:6" : "null"}, ` +
        `condition=${present ? "n:7" : "null"}, incrementor=${present ? "n:8" : "null"}, tsonic=null)`, codecEmptyStatementWire(5, 4),
      ...(present ? [codecNameWire(6, 4), codecNameWire(7, 4), codecNameWire(8, 4)] : []),
    ], "for");
    assertSyntaxPayload({ ...header(4, 2), kind: "ReturnStatement", expression: present ? codecName(5, 4) : null, tsonic: null }, [
      `ReturnStatement(${syntaxHeaderWire(4, 2)}, expression=${present ? "n:5" : "null"}, tsonic=null)`,
      ...(present ? [codecNameWire(5, 4)] : []),
    ], "return");
  });
}
for (const kind of ["DoStatement", "WhileStatement"]) {
  test(`actual ${kind} uses statement-before-expression traversal`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind, statement: codecEmptyStatement(5, 4), expression: codecName(6, 4), tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, statement=n:5, expression=n:6, tsonic=null)`, codecEmptyStatementWire(5, 4), codecNameWire(6, 4),
    ], kind);
  });
}
for (const kind of ["WithStatement", "ExpressionStatement", "ThrowStatement"]) {
  test(`actual ${kind} retains its expression and complete structural statement shape`, () => {
    const additional = kind === "WithStatement" ? { statement: codecEmptyStatement(6, 4) } : {};
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), ...additional, tsonic: null }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "WithStatement" ? "statement=n:6, " : ""}tsonic=null)`,
      codecNameWire(5, 4), ...(kind === "WithStatement" ? [codecEmptyStatementWire(6, 4)] : []),
    ], kind);
  });
}
for (const kind of ["BreakStatement", "ContinueStatement"]) {
  for (const present of [false, true]) {
    test(`actual ${kind} retains its qualified target with ${present ? "named" : "unnamed"} transfer`, () => {
      const label = present ? { ...header(5, 4), kind: "Identifier", text: "target", tsonic: { role: "label", target: codecReference } } : null;
      assertSyntaxPayload({ ...header(4, 2), kind, label, tsonic: { target: codecReference } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, label=${present ? "n:5" : "null"}, tsonic=TypedControlTransfer(target=${codecReferenceWire}))`,
        ...(present ? [`Identifier(${syntaxHeaderWire(5, 4)}, text="target", tsonic=TypedName(role="label", target=${codecReferenceWire}))`] : []),
      ], kind);
    });
  }
}
test("a labelled statement preserves both the label's reference and the owner's target", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "LabeledStatement", label: { ...header(5, 4), kind: "Identifier", text: "target",
    tsonic: { role: "label", target: codecReference } }, statement: codecEmptyStatement(6, 4), tsonic: { target: codecReference } }, [
    `LabeledStatement(${syntaxHeaderWire(4, 2)}, label=n:5, statement=n:6, tsonic=TypedControlTransfer(target=${codecReferenceWire}))`,
    `Identifier(${syntaxHeaderWire(5, 4)}, text="target", tsonic=TypedName(role="label", target=${codecReferenceWire}))`, codecEmptyStatementWire(6, 4),
  ], "label");
});
test("actual case/default clauses keep their correlated expression domains and nonempty statement lists", () => {
  const caseClause = { ...header(7, 6), kind: "CaseClause", expression: codecName(8, 7), statements: nodeList([codecEmptyStatement(9, 7)]), tsonic: null };
  const defaultClause = { ...header(10, 6), kind: "DefaultClause", expression: null, statements: nodeList([codecEmptyStatement(11, 10)]), tsonic: null };
  assertSyntaxPayload({ ...header(4, 2), kind: "SwitchStatement", expression: codecName(5, 4), caseBlock: { ...header(6, 4),
    kind: "CaseBlock", clauses: nodeList([caseClause, defaultClause]), tsonic: null }, tsonic: null }, [
    `SwitchStatement(${syntaxHeaderWire(4, 2)}, expression=n:5, caseBlock=n:6, tsonic=null)`, codecNameWire(5, 4),
    `CaseBlock(${syntaxHeaderWire(6, 4)}, clauses=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:7, n:10]), tsonic=null)`,
    `CaseClause(${syntaxHeaderWire(7, 6)}, expression=n:8, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:9]), tsonic=null)`,
    codecNameWire(8, 7), codecEmptyStatementWire(9, 7),
    `DefaultClause(${syntaxHeaderWire(10, 6)}, expression=null, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:11]), tsonic=null)`,
    codecEmptyStatementWire(11, 10),
  ], "switch");
});
for (const present of [false, true]) {
  test(`actual try/catch/finally nullable branches are ${present ? "present" : "absent"}`, () => {
    const catchClause = present ? { ...header(6, 4), kind: "CatchClause", variableDeclaration: null, block: codecBlock(7, 6), tsonic: null } : null;
    assertSyntaxPayload({ ...header(4, 2), kind: "TryStatement", tryBlock: codecBlock(5, 4), catchClause,
      finallyBlock: present ? codecBlock(8, 4) : null, tsonic: null }, [
      `TryStatement(${syntaxHeaderWire(4, 2)}, tryBlock=n:5, catchClause=${present ? "n:6" : "null"}, ` +
        `finallyBlock=${present ? "n:8" : "null"}, tsonic=null)`, codecBlockWire(5, 4),
      ...(present ? [`CatchClause(${syntaxHeaderWire(6, 4)}, variableDeclaration=null, block=n:7, tsonic=null)`,
        codecBlockWire(7, 6), codecBlockWire(8, 4)] : []),
    ], "try");
  });
}
const codecDeferred = { invocation: { rule: "embed", input: {
  context: codecContext, from: codecEvidence, to: codecEvidence, role: "return",
} }, result: 0 };
const codecDeferredWire = `DeferredDecision(invocation=DeferredInvocation(rule="embed", input=EmbedInput(context=${codecContextWire}, ` +
  `from=${codecEvidenceWire}, to=${codecEvidenceWire}, role="return")), result=t:0)`;
const codecDeferredOutcome = { kind: "deferred", deferred: codecDeferred };
const codecDeferredOutcomeWire = `deferred(deferred=${codecDeferredWire})`;

test("a constructor with absent argument syntax is not normalized to an empty argument list", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "NewExpression", expression: codecName(5, 4), typeArguments: null, arguments: null,
    tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `NewExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, typeArguments=null, arguments=null, ` +
      `tsonic=TypedApplication(${valueWire}, application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
  ], "constructor arguments absent");
});

test("an authored optional-call token remains distinct from absent optional-call syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CallExpression", expression: codecName(5, 4),
    questionDotToken: { ...header(6, 4), kind: "QuestionDotToken", tsonic: null }, typeArguments: null, arguments: nodeList(),
    tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `CallExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=n:6, typeArguments=null, ` +
      `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
      `application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
    `QuestionDotToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`,
  ], "optional call");
});

test("deferred typed application and protocol outcomes retain their own generic publication arms", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "CallExpression", expression: codecName(5, 4), questionDotToken: null,
    typeArguments: null, arguments: nodeList(), tsonic: { ...typedValue(), application: codecDeferredOutcome, operation: null } }, [
    `CallExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=null, typeArguments=null, ` +
      `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
      `application=${codecDeferredOutcomeWire}, operation=null))`, codecNameWire(5, 4),
  ], "deferred application");
  assertSyntaxPayload({ ...header(4, 2), kind: "AwaitExpression", expression: codecName(5, 4),
    tsonic: { ...typedValue(), protocol: codecDeferredOutcome } }, [
    `AwaitExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedProtocolValue(${valueWire}, ` +
      `protocol=${codecDeferredOutcomeWire}))`, codecNameWire(5, 4),
  ], "deferred protocol");
});

for (const [application, applicationWire] of [
  [null, "null"],
  [{ kind: "decided", decision: codecApplicationDecision }, `decided(decision=${codecApplicationDecisionWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`value instantiation retains its complete ${application?.kind ?? "absent"} application`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ExpressionWithTypeArguments", expression: codecName(5, 4), typeArguments: null,
      tsonic: { ...typedValue(), role: "value", bindings: emptyBindings(), application } }, [
      `ExpressionWithTypeArguments(${syntaxHeaderWire(4, 2)}, expression=n:5, typeArguments=null, ` +
        `tsonic=TypedInstantiation(${valueWire}, role="value", bindings=${codecBindingsWire}, application=${applicationWire}))`,
      codecNameWire(5, 4),
    ], "value instantiation");
  });
}

for (const [outcome, outcomeWire] of [
  [{ kind: "decided", decision: codecTypedOperation }, `decided(decision=${codecTypedOperationWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`actual object construction and object-spread retain their ${outcome.kind} phase families`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "ObjectLiteralExpression", properties: nodeList(), multiLine: false,
      tsonic: { ...typedValue(), role: "value", construction: outcome } }, [
      `ObjectLiteralExpression(${syntaxHeaderWire(4, 2)}, properties=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `multiLine=false, tsonic=TypedConstruction(${valueWire}, role="value", construction=${outcomeWire}))`,
    ], "object construction");
    assertSyntaxPayload({ ...header(4, 2), kind: "SpreadAssignment", expression: codecName(5, 4), tsonic: { construction: outcome } }, [
      `SpreadAssignment(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedObjectSpread(construction=${outcomeWire}))`,
      codecNameWire(5, 4),
    ], "object spread");
  });
}

for (const [application, applicationWire] of [
  [{ kind: "decided", decision: codecTirApplication }, `decided(decision=${codecTirApplicationWire})`],
  [codecDeferredOutcome, codecDeferredOutcomeWire],
]) {
  test(`actual decorator retains the complete ${application.kind} invocation rather than an inferred expression role`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "Decorator", expression: codecName(5, 4), tsonic: { application } }, [
      `Decorator(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedDecorator(application=${applicationWire}))`, codecNameWire(5, 4),
    ], "decorator");
  });
}

for (const [literal, literalWire] of [
  [{ kind: "number", token: "-0", value: { numerator: 0n, denominator: 1n, negativeZero: true } },
    'number(token="-0", value=ExactRational(numerator=0n, denominator=1n, negativeZero=true))'],
  [{ kind: "bigint", token: "9007199254740993n", value: 9007199254740993n }, 'bigint(token="9007199254740993n", value=9007199254740993n)'],
  [{ kind: "string", value: "literal" }, 'string(value="literal")'],
  [{ kind: "boolean", value: true }, "boolean(value=true)"],
  [{ kind: "absence" }, "absence()"],
  [{ kind: "unique-symbol", declaration: ownerId }, `unique-symbol(declaration=def:"${ownerId}")`],
]) {
  test(`the saved ${literal.kind} literal value preserves its complete original value and token domain`, () => {
    const deferred = { invocation: { rule: "literal-fit", input: { context: codecContext, literal, destination: codecEvidence } }, result: 0 };
    const deferredWire = `DeferredDecision(invocation=DeferredInvocation(rule="literal-fit", input=LiteralFitInput(` +
      `context=${codecContextWire}, literal=${literalWire}, destination=${codecEvidenceWire})), result=t:0)`;
    assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4),
      tsonic: { ...typedValue(), role: "value", operation: { kind: "deferred", deferred } } }, [
      `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, ` +
        `tsonic=TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=${deferredWire})))`, codecNameWire(5, 4),
    ], literal.kind);
  });
}

const codecProofComponent = { root: codecSource, path: [] };
const codecProof = { steps: [{ from: codecProofComponent, to: codecProofComponent, rule: "identity", premises: [] }], conclusion: 0 };
const codecProofWire = `EmbeddingProof(steps=[CorrespondenceStep(from=TypeComponent(root=${codecSourceWire}, path=[]), ` +
  `to=TypeComponent(root=${codecSourceWire}, path=[]), rule="identity", premises=[])], conclusion=0)`;
// A conversion's embedding is stated once: by the conversion identity of its operation, or beside a core or library operation.
const codecConversionOperation = (embedding, embeddingWire, execution = { kind: "pure" }, executionWire = "pure()") => [
  { decision: { kind: "selected", operation: { kind: "conversion", from: 0, to: 0, embedding }, operands: [0], result: 0, execution }, permissionScope: 4 },
  `TypedOperation(decision=selected(operation=conversion(from=t:0, to=t:0, embedding=${embeddingWire}), operands=[t:0], result=t:0, ` +
    `execution=${executionWire}), permissionScope=n:4)`];
const codecBackedOperation = (kind, execution = { kind: "invocation", writesStorage: false, failure: "unwind" },
  executionWire = 'invocation(writesStorage=false, failure="unwind")') => [
  { decision: { kind: "selected", operation: { kind, declaration: ownerId, bindings: emptyBindings() }, operands: [0], result: 0, execution }, permissionScope: 4 },
  `TypedOperation(decision=selected(operation=${kind}(declaration=def:"${ownerId}", bindings=${codecBindingsWire}), operands=[t:0], result=t:0, ` +
    `execution=${executionWire}), permissionScope=n:4)`];
for (const role of ["initialization", "assignment", "argument", "return", "receiver", "yield", "member-write"]) {
  test(`the actual ${role} conversion retains the complete flow-role record rather than a syntax-token proxy`, () => {
    const [operation, operationWire] = codecConversionOperation({ kind: "identity" }, "identity()");
    const conversion = { kind: "convert", role, operation };
    const phaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=convert(role="${role}", ` +
      `operation=${operationWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ], role);
    for (const backing of ["core", "library"]) {
      const [backed, backedWire] = codecBackedOperation(backing);
      const backedConversion = { kind: "backed-convert", role, embedding: { kind: "identity" }, operation: backed };
      const backedPhaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=backed-convert(role="${role}", embedding=identity(), ` +
        `operation=${backedWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
      assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
        tsonic: { ...typedValue(), conversion: backedConversion } }, [
        `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${backedPhaseWire})`, codecNameWire(5, 4),
      ], `${role} backed by ${backing}`);
    }
  });
}
for (const [embedding, embeddingWire] of [
  ...["numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"].map(conversion => [
    { kind: "conversion", conversion, proof: codecProof, check: { kind: "none" } },
    `conversion(conversion="${conversion}", proof=${codecProofWire}, check=none())`,
  ]),
  ...["unwind", "abort"].map(failure => [
    { kind: "conversion", conversion: "numeric", proof: codecProof, check: { kind: "required", failure } },
    `conversion(conversion="numeric", proof=${codecProofWire}, check=required(failure="${failure}"))`,
  ]),
  ...["incompatible-domain", "lossy-numeric", "missing-correspondence", "passing-mode", "rigid-parameter"].map(reason => [
    { kind: "refused", reason }, `refused(reason="${reason}")`,
  ]),
]) {
  test(`a saved conversion preserves its exact ${embedding.conversion ?? embedding.reason} embedding decision`, () => {
    const [operation, operationWire] = codecConversionOperation(embedding, embeddingWire);
    const conversion = { kind: "convert", role: "return", operation };
    const phaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=convert(role="return", ` +
      `operation=${operationWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
    ], embeddingWire);
    const [backed, backedWire] = codecBackedOperation("core");
    const backedPhaseWire = `TypedValue(type=t:0, convertedType=t:0, conversion=backed-convert(role="return", embedding=${embeddingWire}, ` +
      `operation=${backedWire}), narrowing=identity(type=t:0), evidenceIndex=0, demand=always())`;
    assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
      tsonic: { ...typedValue(), conversion: { kind: "backed-convert", role: "return", embedding, operation: backed } } }, [
      `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=${backedPhaseWire})`, codecNameWire(5, 4),
    ], `${embeddingWire} beside a core operation`);
  });
}

test("the text of a conversion admits one statement of its embedding and only the operation of its arm", () => {
  const [operation, operationWire] = codecConversionOperation({ kind: "identity" }, "identity()");
  const [backed, backedWire] = codecBackedOperation("library");
  const text = conversionWire => syntaxPayloadCase({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4),
    tsonic: { ...typedValue(), conversion: { kind: "convert", role: "return", operation } } }, [
    `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(type=t:0, convertedType=t:0, conversion=${conversionWire}, ` +
      "narrowing=identity(type=t:0), evidenceIndex=0, demand=always()))", codecNameWire(5, 4),
  ]).expected;
  const valid = text(`convert(role="return", operation=${operationWire})`);
  assert.equal(product.parseTir(valid).kind, "parsed");
  // The earlier form: an embedding beside the identity conversion.
  const earlier = text(`convert(role="return", embedding=identity(), operation=${operationWire})`);
  assertInvalidText(earlier, earlier.indexOf("embedding=identity(), operation="), ["operation"], "embedding");
  // A conversion carried out by an operation that is not the conversion identity.
  for (const other of [codecTypedOperationWire, backedWire]) {
    const wrong = text(`convert(role="return", operation=${other})`);
    assertInvalidText(wrong, wrong.indexOf("selected(operation=") + "selected(operation=".length, ["OperationIdentity"], other === backedWire ? "library" : "discard");
  }
  // A backed conversion whose operation is not a core or library operation, and one without its embedding.
  for (const [other, found] of [[operationWire, "conversion"], [codecTypedOperationWire, "discard"]]) {
    const wrong = text(`backed-convert(role="return", embedding=identity(), operation=${other})`);
    assertInvalidText(wrong, wrong.indexOf("selected(operation=") + "selected(operation=".length, ["OperationIdentity"], found);
  }
  const bare = text(`backed-convert(role="return", operation=${backedWire})`);
  assertInvalidText(bare, bare.indexOf("operation=TypedOperation"), ["embedding"], "operation");
  assert.equal(product.parseTir(text(`backed-convert(role="return", embedding=identity(), operation=${backedWire})`)).kind, "parsed");
  assert.equal(backed.decision.operation.kind, "library");
});

test("an actual import-type retains the present attributes arm without guessing its qualifier", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportType", typeArguments: null, isTypeOf: false, argument: codecType(5, 4),
    attributes: { ...header(6, 4), kind: "ImportAttributes", token: "WithKeyword", attributes: nodeList(), multiLine: true, tsonic: null },
    qualifier: null, tsonic: { type: 0, declarations: [] } }, [
    `ImportType(${syntaxHeaderWire(4, 2)}, typeArguments=null, isTypeOf=false, argument=n:5, attributes=n:6, ` +
      'qualifier=null, tsonic=TypedType(type=t:0, declarations=[]))', codecTypeWire(5, 4),
    `ImportAttributes(${syntaxHeaderWire(6, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=true, tsonic=null)`,
  ], "import-type attributes");
});

for (const [rule, input, inputWire] of savedInvocationCases.filter(([rule]) =>
  ["construct-literal", "candidate", "protocol", "library"].includes(rule))) {
  const fields = rule === "construct-literal" ? ["destination"] : rule === "protocol"
    ? ["subject", "completion", "yielded", "sent"] : ["receiver"];
  for (const field of fields) {
    test(`F4 complete saved ${rule} nullable ${field} public codec and actual input`, () => {
      const supplied = { ...input, [field]: null };
      const wire = inputWire.replace(`${field}=${codecEvidenceWire}`, `${field}=null`);
      const phase = { ...typedValue(), role: "value", operation: { kind: "deferred",
        deferred: { invocation: { rule, input: supplied }, result: 0 } } };
      const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
        `invocation=DeferredInvocation(rule="${rule}", input=${wire}), result=t:0)))`;
      assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
        `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
      ], `${rule}/${field}/null`);
      const fixture = operationScenario();
      const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
      fixture.typed.tsonic.operation = { kind: "deferred", deferred: {
        invocation: { rule, input: { ...supplied, context } }, result: 1 } };
      replaceScopeInventory(fixture.input, Array.from({ length: rule === "candidate" ? 4 : 3 }, emptyScope));
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a saved candidate's ordinary argument has a genuine null tuple, not a guessed spread", () => {
  const [, input, inputWire] = savedInvocationCases.find(([rule]) => rule === "candidate");
  const supplied = { ...input, arguments: [{ ...input.arguments[0], kind: "value", tuple: null }] };
  const wire = inputWire.replace(`kind="spread", value=${codecEvidenceWire}, tuple=[${codecEvidenceWire}]`,
    `kind="value", value=${codecEvidenceWire}, tuple=null`);
  const phase = { ...typedValue(), role: "value", operation: { kind: "deferred", deferred: {
    invocation: { rule: "candidate", input: supplied }, result: 0 } } };
  const phaseWire = `TypedPrefix(${valueWire}, role="value", operation=deferred(deferred=DeferredDecision(` +
    `invocation=DeferredInvocation(rule="candidate", input=${wire}), result=t:0)))`;
  assertSyntaxPayload({ ...header(4, 2), kind: "PrefixUnaryExpression", operator: "PlusToken", operand: codecName(5, 4), tsonic: phase }, [
    `PrefixUnaryExpression(${syntaxHeaderWire(4, 2)}, operator="PlusToken", operand=n:5, tsonic=${phaseWire})`, codecNameWire(5, 4),
  ], "candidate ordinary null tuple");
  const fixture = operationScenario();
  fixture.typed.tsonic.operation = { kind: "deferred", deferred: { invocation: { rule: "candidate", input: { ...supplied,
    context: { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() } } }, result: 1 } };
  replaceScopeInventory(fixture.input, Array.from({ length: 4 }, emptyScope));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 ImportKeyword is an actual complete keyword expression, not a meta-property scalar", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ImportKeyword", tsonic: { ...typedValue(), role: "value" } }, [
    `ImportKeyword(${syntaxHeaderWire(4, 2)}, tsonic=TypedKeyword(${valueWire}, role="value"))`,
  ], "ImportKeyword value");
});

test("F4 a project import's literal discriminator preserves every actual admissible opposite", () => {
  const { body, expected } = syntaxPayloadCase({ ...header(4, 2), kind: "StringLiteral", text: "module", tokenFlags: [],
    tsonic: { role: "module-specifier", target: { target: "project", module: moduleId } } }, [
    `StringLiteral(${syntaxHeaderWire(4, 2)}, text="module", tokenFlags=[], tsonic=TypedString(role="module-specifier", ` +
      `target=ImportTarget(target="project", module=mod:"${moduleId}")))`,
  ]);
  assertBodyRoundTrip(body, expected, "actual project discriminator");
  const text = expected.replace('target="project"', "target=null");
  assertInvalidText(text, text.indexOf("target=null") + "target=".length, ['"project"', '"library"'], "null");
});

test("F4 deferred conversion retains its own invocation and result codec fields", () => {
  const phase = { ...typedValue(), conversion: { kind: "deferred", deferred: codecDeferred } };
  const phaseWire = valueWire.replace("conversion=identity()", `conversion=deferred(deferred=${codecDeferredWire})`);
  assertSyntaxPayload({ ...header(4, 2), kind: "ParenthesizedExpression", expression: codecName(5, 4), tsonic: phase }, [
    `ParenthesizedExpression(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedValue(${phaseWire}))`, codecNameWire(5, 4),
  ], "actual deferred conversion");
});

for (const [kind, fields, fieldsWire, phase, phaseWire, marker, expectedType] of [
  ["BigIntLiteral", { text: "1n", tokenFlags: [] }, 'text="1n", tokenFlags=[]',
    { ...typedValue(), role: "value", value: 1n }, `TypedBigInt(${valueWire}, role="value", value=1n)`, "value=1n", "bigint"],
  ["JsxText", { text: "text", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false },
    'text="text", tokenFlags=[], containsOnlyTriviaWhiteSpaces=false', null, "null", "containsOnlyTriviaWhiteSpaces=false", "boolean"],
]) {
  test(`F4 actual ${expectedType} selector rejects null inside its complete public family`, () => {
    const payload = { ...header(4, 2), kind, ...fields, tsonic: phase };
    const { body, expected } = syntaxPayloadCase(payload, [
      `${kind}(${syntaxHeaderWire(4, 2)}, ${fieldsWire}, tsonic=${phaseWire})`,
    ]);
    assertBodyRoundTrip(body, expected, `actual ${expectedType} positive`);
    const field = marker.slice(0, marker.indexOf("=") + 1);
    const text = expected.replace(marker, field + "null");
    const offset = text.indexOf(field + "null") + field.length;
    assertInvalidText(text, offset, [expectedType], "null");
  });
}

test("F4 actual dynamic PragmaArguments has its own wrong-label result", () => {
  const body = emptyModuleBody();
  body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false,
    name: "reference", args: [] }];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("pragmas=[]", 'pragmas=[Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="reference", args=PragmaArguments())]');
  assertBodyRoundTrip(body, expected, "actual empty pragma dictionary");
  const text = expected.replace("PragmaArguments()", "OtherArguments()");
  assertInvalidText(text, text.indexOf("OtherArguments"), ["PragmaArguments"], "OtherArguments");
});

for (const count of [0, 1, 2]) {
  for (const multiLine of [false, true]) {
    for (const role of ["value", "assignment-pattern"]) {
      test(`F4 complete ArrayLiteral ${role}/${count}/multiLine=${multiLine}`, () => {
        const elements = Array.from({ length: count }, (_, position) => codecName(position + 5, 4));
        const phase = role === "value" ? { ...typedValue(), role, construction: { kind: "decided", decision: codecTypedOperation } }
          : { role, storage: 0, parts: [codecPart] };
        const phaseWire = role === "value" ? `TypedConstruction(${valueWire}, role="value", construction=decided(decision=${codecTypedOperationWire}))`
          : `TypedConstruction(role="assignment-pattern", storage=t:0, parts=[${codecPartWire}])`;
        assertSyntaxPayload({ ...header(4, 2), kind: "ArrayLiteralExpression", elements: nodeList(elements), multiLine, tsonic: phase }, [
          `ArrayLiteralExpression(${syntaxHeaderWire(4, 2)}, elements=NodeList(loc=TextRange(pos=0, end=0), ` +
            `nodes=[${elements.map(node => `n:${node.id}`).join(", ")}]), multiLine=${multiLine}, tsonic=${phaseWire})`,
          ...elements.map(node => codecNameWire(node.id, 4)),
        ], `array/${role}/${count}/${multiLine}`);
      });
    }
  }
}

test("a typed closure carries its decision: every capture mode, a creation that can fail, and the deferred closure rule with its input", () => {
  const arrow = closure => ({ ...header(4, 2), kind: "ArrowFunction", modifiers: null, typeParameters: null, parameters: nodeList(), type: null,
    fullSignature: null, asteriskToken: null, body: codecBlock(5, 4),
    equalsGreaterThanToken: { ...header(6, 4), kind: "EqualsGreaterThanToken", tsonic: null },
    tsonic: { ...typedValue(), callable: codecCallable, captures: [{ body: bodyId, local: 0 }, { body: bodyId, local: 0 }], closure } });
  const arrowWire = closureWire => [
    `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=null, parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
      'type=null, fullSignature=null, asteriskToken=null, body=n:5, equalsGreaterThanToken=n:6, ' +
      `tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, captures=[${localWire}, ${localWire}], closure=${closureWire}))`,
    codecBlockWire(5, 4), `EqualsGreaterThanToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`];
  assertSyntaxPayload(arrow({ kind: "decided", decision: { carrier: 0, captures: ["captured-value", "captured-location"],
    execution: { kind: "invocation", writesStorage: false, failure: "unwind" } } }),
  arrowWire('decided(decision=ClosureDecision(carrier=t:0, captures=["captured-value", "captured-location"], execution=invocation(writesStorage=false, failure="unwind")))'),
  "decided closure");
  const savedCapture = reassignable => ({ local: { body: bodyId, local: 0 }, value: codecEvidence, reassignable });
  const savedCaptureWire = reassignable => `ClosureCaptureEvidence(local=${localWire}, value=${codecEvidenceWire}, reassignable=${reassignable})`;
  assertSyntaxPayload(arrow({ kind: "deferred", deferred: { invocation: { rule: "closure", input: { context: codecContext,
    callable: codecEvidence, captures: [savedCapture(true), savedCapture(false)] } }, result: 0 } }),
  arrowWire(`deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="closure", input=ClosureInput(context=${codecContextWire}, ` +
    `callable=${codecEvidenceWire}, captures=[${savedCaptureWire(true)}, ${savedCaptureWire(false)}])), result=t:0))`), "deferred closure");
});

for (const asterisk of [false, true]) {
  test(`F4 complete ArrowFunction type parameters and asterisk=${asterisk}`, () => {
    const bodyId = asterisk ? 11 : 10;
    const arrowId = bodyId + 1;
    assertSyntaxPayload({ ...header(4, 2), kind: "ArrowFunction", modifiers: null,
      typeParameters: nodeList([codecTypeParameter(5, 4)]), parameters: nodeList(), type: null, fullSignature: null,
      asteriskToken: asterisk ? { ...header(10, 4), kind: "AsteriskToken", tsonic: null } : null,
      body: codecBlock(bodyId, 4), equalsGreaterThanToken: { ...header(arrowId, 4), kind: "EqualsGreaterThanToken", tsonic: null },
      tsonic: { ...typedValue(), callable: codecCallable, captures: [], closure: closureDecisionOf(0, 0) } }, [
      `ArrowFunction(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:5]), ` +
        `parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), type=null, fullSignature=null, asteriskToken=${asterisk ? "n:10" : "null"}, ` +
        `body=n:${bodyId}, equalsGreaterThanToken=n:${arrowId}, tsonic=TypedClosure(${valueWire}, callable=${codecCallableWire}, captures=[], closure=${closureDecisionWire(0)}))`,
      ...codecTypeParameterDefinitions(5, 4), ...(asterisk ? [`AsteriskToken(${syntaxHeaderWire(10, 4)}, tsonic=null)`] : []),
      codecBlockWire(bodyId, 4), `EqualsGreaterThanToken(${syntaxHeaderWire(arrowId, 4)}, tsonic=null)`,
    ], `arrow/${asterisk}`);
  });
}

for (const present of [false, true]) {
  for (const asterisk of [false, true]) {
    test(`F4 complete Yield expression=${present}/asterisk=${asterisk}`, () => {
      const expressionId = asterisk ? 6 : 5;
      const phase = { ...typedValue(), protocol: { kind: "decided", decision: codecProtocol } };
      assertSyntaxPayload({ ...header(4, 2), kind: "YieldExpression",
        asteriskToken: asterisk ? { ...header(5, 4), kind: "AsteriskToken", tsonic: null } : null,
        expression: present ? codecName(expressionId, 4) : null, tsonic: phase }, [
        `YieldExpression(${syntaxHeaderWire(4, 2)}, asteriskToken=${asterisk ? "n:5" : "null"}, ` +
          `expression=${present ? `n:${expressionId}` : "null"}, tsonic=TypedProtocolValue(${valueWire}, protocol=decided(decision=${codecProtocolWire})))`,
        ...(asterisk ? [`AsteriskToken(${syntaxHeaderWire(5, 4)}, tsonic=null)`] : []),
        ...(present ? [codecNameWire(expressionId, 4)] : []),
      ], `yield/${present}/${asterisk}`);
    });
  }
}

for (const kind of ["CallExpression", "NewExpression"]) {
  for (const count of [0, 1, 2]) {
    test(`F4 complete ${kind} with actual typeArguments count=${count}`, () => {
      const arguments_ = Array.from({ length: count }, (_, position) => codecType(position + 6, 4));
      const phase = { ...typedValue(), application: { kind: "decided", decision: codecTirApplication }, operation: null };
      assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4),
        ...(kind === "CallExpression" ? { questionDotToken: null } : {}), typeArguments: nodeList(arguments_),
        arguments: nodeList(), tsonic: phase }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, ${kind === "CallExpression" ? "questionDotToken=null, " : ""}` +
          `typeArguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[${arguments_.map(node => `n:${node.id}`).join(", ")}]), ` +
          `arguments=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), tsonic=TypedApplication(${valueWire}, ` +
          `application=decided(decision=${codecTirApplicationWire}), operation=null))`,
        codecNameWire(5, 4), ...arguments_.map(node => codecTypeWire(node.id, 4)),
      ], `${kind}/typeArguments/${count}`);
    });
  }
}

for (const tokenFlags of [["SingleQuote"], ["UnicodeEscape", "SingleQuote"], ["SingleQuote", "UnicodeEscape"]]) {
  test(`F4 genuine JSX text complete token flags ${tokenFlags.join("/")}`, () => {
    assertSyntaxPayload({ ...header(4, 2), kind: "JsxText", text: "text", tokenFlags,
      containsOnlyTriviaWhiteSpaces: false, tsonic: null }, [
      `JsxText(${syntaxHeaderWire(4, 2)}, text="text", tokenFlags=[${tokenFlags.map(flag => JSON.stringify(flag)).join(", ")}], ` +
        "containsOnlyTriviaWhiteSpaces=false, tsonic=null)",
    ], "JSX text flags");
  });
}

test("F4 complete shorthand-name narrowing and evidence have their own codec callbacks", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "Identifier", text: "field",
    tsonic: { ...typedValue(), role: "shorthand-value", key: codecKey,
      resolution: { kind: "definition", definition: ownerId, aliases: [] } } }, [
    `Identifier(${syntaxHeaderWire(4, 2)}, text="field", tsonic=TypedName(${valueWire}, role="shorthand-value", key=${codecKeyWire}, ` +
      `resolution=definition(definition=def:"${ownerId}", aliases=[])))`,
  ], "full shorthand name");
});

for (const [role, token] of [["arithmetic", "PlusToken"], ["comparison", "EqualsEqualsEqualsToken"],
  ["assignment", "PlusEqualsToken"], ["sequence", "CommaToken"]]) {
  for (const mode of ["decided", "deferred", "absent"]) {
    if (role === "sequence" && mode !== "decided" || (role === "arithmetic" || role === "comparison") && mode === "absent") continue;
    test(`F4 complete Binary ${role} calculation ${mode}`, () => {
      const deferred = mode === "deferred";
      const outcome = deferred ? codecDeferredOutcome : { kind: "decided", decision: codecTypedOperation };
      const outcomeWire = deferred ? codecDeferredOutcomeWire : `decided(decision=${codecTypedOperationWire})`;
      const selection = { kind: "or", control: 5, right: 7, disposition: "dynamic" };
      const phase = { ...typedValue(), role,
        ...(role === "arithmetic" || role === "comparison" ? { operation: outcome } :
          role === "assignment" ? { storage: 0, calculation: mode === "absent" ? null : outcome,
            selection: mode === "absent" ? null : selection } : {}) };
      const phaseWire = `TypedBinary(${valueWire}, role="${role}"` +
        (role === "arithmetic" || role === "comparison" ? `, operation=${outcomeWire}` : role === "assignment"
          ? `, storage=t:0, calculation=${mode === "absent" ? "null" : outcomeWire}, selection=${mode === "absent" ? "null" : 'or(control=n:5, right=n:7, disposition="dynamic")'}` : "") + ")";
      assertSyntaxPayload({ ...header(4, 2), kind: "BinaryExpression", modifiers: null, left: codecName(5, 4), type: null,
        operatorToken: { ...header(6, 4), kind: token, tsonic: null }, right: codecName(7, 4), tsonic: phase }, [
        `BinaryExpression(${syntaxHeaderWire(4, 2)}, modifiers=null, left=n:5, type=null, operatorToken=n:6, right=n:7, tsonic=${phaseWire})`,
        codecNameWire(5, 4), `${token}(${syntaxHeaderWire(6, 4)}, tsonic=null)`, codecNameWire(7, 4),
      ], `${role}/${deferred}`);
    });
  }
}

for (const disposition of ["true", "false", "dynamic"]) {
  test(`F4 complete Conditional ${disposition} carries each selected or never demand`, () => {
    const selected = when => disposition === "dynamic" || disposition === when ? { kind: "selected", control: 5, when }
      : { kind: "never", control: 5 };
    const demandWire = when => disposition === "dynamic" || disposition === when ? `selected(control=n:5, when="${when}")` : "never(control=n:5)";
    const branch = (identity, when) => ({ ...codecName(identity, 4), tsonic: { ...codecName(identity, 4).tsonic, demand: selected(when) } });
    const branchWire = (identity, when) => codecNameWire(identity, 4).replace("demand=always()", `demand=${demandWire(when)}`);
    const phase = { ...typedValue(), selection: { kind: "conditional", control: 5, whenTrue: 7, whenFalse: 9, disposition } };
    assertSyntaxPayload({ ...header(4, 2), kind: "ConditionalExpression", condition: codecName(5, 4),
      questionToken: { ...header(6, 4), kind: "QuestionToken", tsonic: null }, whenTrue: branch(7, "true"),
      colonToken: { ...header(8, 4), kind: "ColonToken", tsonic: null }, whenFalse: branch(9, "false"), tsonic: phase }, [
      `ConditionalExpression(${syntaxHeaderWire(4, 2)}, condition=n:5, questionToken=n:6, whenTrue=n:7, colonToken=n:8, ` +
        `whenFalse=n:9, tsonic=TypedConditional(${valueWire}, selection=conditional(control=n:5, whenTrue=n:7, whenFalse=n:9, disposition="${disposition}")))`,
      codecNameWire(5, 4), `QuestionToken(${syntaxHeaderWire(6, 4)}, tsonic=null)`, branchWire(7, "true"),
      `ColonToken(${syntaxHeaderWire(8, 4)}, tsonic=null)`, branchWire(9, "false"),
    ], `conditional/${disposition}`);
  });
}

for (const kind of ["PropertyAccessExpression", "ElementAccessExpression"]) {
  for (const mode of ["plain", "accessors", "deferred"]) {
    test(`F4 complete ${kind} value selection ${mode}`, () => {
      const selection = { decision: codecMemberDecision, getter: mode === "accessors" ? codecCallee : null,
        setter: mode === "accessors" ? codecCallee : null };
      const [, memberInput, memberInputWire] = savedInvocationCases.find(([rule]) => rule === "member");
      const outcome = mode === "deferred" ? { kind: "deferred", deferred: { invocation: { rule: "member", input: memberInput }, result: 0 } }
        : { kind: "decided", decision: selection };
      const selectionWire = mode === "deferred" ? `deferred(deferred=DeferredDecision(invocation=DeferredInvocation(rule="member", input=${memberInputWire}), result=t:0))`
        : `decided(decision=MemberSelection(decision=${codecMemberDecisionWire}, getter=${mode === "accessors" ? codecCalleeWire : "null"}, ` +
          `setter=${mode === "accessors" ? codecCalleeWire : "null"}))`;
      const field = kind === "PropertyAccessExpression" ? "name" : "argumentExpression";
      assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4), questionDotToken: null,
        [field]: codecName(6, 4), tsonic: { ...typedValue(), role: "value", selection: outcome } }, [
        `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, questionDotToken=null, ${field}=n:6, ` +
          `tsonic=TypedMember(${valueWire}, role="value", selection=${selectionWire}))`, codecNameWire(5, 4), codecNameWire(6, 4),
      ], `${kind}/${mode}`);
    });
  }
}

test("F4 body capture and lexical scope records retain complete foreign identities and declaration order", () => {
  const body = emptyModuleBody();
  const foreignBody = "B[D[M[P[p];m];outer];function;0]";
  body.captures = [{ body: foreignBody, local: 0 }, { body: foreignBody, local: 1 }];
  body.scopes = [{ node: 0, parent: null, attributes: [codecAttribute] }, { node: 1, parent: 0, attributes: [codecAttribute, codecAttribute] }];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("captures=[], scopes=[]", `captures=[LocalRef(body=body:"${foreignBody}", local=l:0), ` +
      `LocalRef(body=body:"${foreignBody}", local=l:1)], scopes=[HirLexicalScope(node=n:0, parent=null, attributes=[${codecAttributeWire}]), ` +
      `HirLexicalScope(node=n:1, parent=n:0, attributes=[${codecAttributeWire}, ${codecAttributeWire}])]`);
  assertBodyRoundTrip(body, expected, "complete captures and scopes");
});

test("F4 a complete export retains its present ImportAttributes syntax", () => {
  assertSyntaxPayload({ ...header(4, 2), kind: "ExportDeclaration", modifiers: null, isTypeOnly: false,
    exportClause: null, moduleSpecifier: null, attributes: { ...header(5, 4), kind: "ImportAttributes", token: "WithKeyword",
      attributes: nodeList(), multiLine: false, tsonic: null }, tsonic: { definition: ownerId, target: null } }, [
    `ExportDeclaration(${syntaxHeaderWire(4, 2)}, modifiers=null, isTypeOnly=false, exportClause=null, moduleSpecifier=null, ` +
      `attributes=n:5, tsonic=TypedExport(definition=def:"${ownerId}", target=null))`,
    `ImportAttributes(${syntaxHeaderWire(5, 4)}, token="WithKeyword", attributes=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)`,
  ], "export attributes");
});

for (const count of [0, 1]) {
  test(`F4 complete IndexSignature actual type parameter count=${count}`, () => {
    const type = count === 0 ? 5 : 10;
    assertSyntaxPayload({ ...header(4, 2), kind: "IndexSignature", modifiers: null,
      typeParameters: nodeList(count === 0 ? [] : [codecTypeParameter(5, 4)]), parameters: nodeList(),
      type: codecType(type, 4), fullSignature: null, tsonic: { definition: ownerId, key: 0, read: 0, write: null } }, [
      `IndexSignature(${syntaxHeaderWire(4, 2)}, modifiers=null, typeParameters=NodeList(loc=TextRange(pos=0, end=0), ` +
        `nodes=[${count === 0 ? "" : "n:5"}]), parameters=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `type=n:${type}, fullSignature=null, tsonic=TypedIndexDeclaration(definition=def:"${ownerId}", key=t:0, read=t:0, write=null))`,
      ...(count === 0 ? [] : codecTypeParameterDefinitions(5, 4)), codecTypeWire(type, 4),
    ], `IndexSignature/${count}`);
  });
}

for (const kind of ["DeleteExpression", "TypeOfExpression", "VoidExpression"]) {
  test(`actual ${kind} maps to the complete TypedUnary record, not a prefix role`, () => {
    const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "discard" }, operands: [0], result: 0, execution: { kind: "pure" } } };
    assertSyntaxPayload({ ...header(4, 2), kind, expression: codecName(5, 4),
      tsonic: { ...typedValue(), operation: { kind: "decided", decision: operation } } }, [
      `${kind}(${syntaxHeaderWire(4, 2)}, expression=n:5, tsonic=TypedUnary(${valueWire}, operation=decided(decision=TypedOperation(` +
        'decision=selected(operation=discard(), operands=[t:0], result=t:0, execution=pure()), permissionScope=null))))',
      codecNameWire(5, 4),
    ], kind);
  });
}
}

test("the complete independently authored empty module prints exactly once in declaration order", () => {
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const body = emptyModuleBody();
  assertCompleteValue(product.printTir(body), expected, "complete independently authored module wire", Object.is);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, JSON.parse(readFileSync(
    resolve(repository, functionDirectory, "empty-module.expected.json"), "utf8")).value.value,
  "complete expected fields are compared independently, not derived from actual print output", isDeepStrictEqual);
  assert.equal(parsed.value.root.endOfFileToken.parent, 0);
});

test("actual source/publication/table/scopes yield the complete valid verifier vector", () => {
  const body = emptyModuleBody();
  assertCompleteValue(product.verifyTir(emptyVerificationInput(body), body), []);
});

for (const includeHole of [false, true]) {
  test(`the actual generic tuple-pattern parameter preserves its real whole-argument and named local slots: hole=${includeHole}`, () => {
    const fixture = bindingPatternScenario(includeHole);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

test("a named element cannot discard its real binding phase in favour of the hole arm", () => {
  const fixture = bindingPatternScenario(false);
  const actual = fixture.binding.tsonic;
  fixture.binding.tsonic = { role: "hole" };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("binding-element-role-exact", 7,
    "binding element role is hole exactly when its authored name is absent")]);
  fixture.binding.tsonic = actual;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a hole cannot claim the adjacent genuine named element's binding record", () => {
  const fixture = bindingPatternScenario(true);
  fixture.hole.tsonic = fixture.binding.tsonic;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("binding-element-role-exact", 7,
    "binding element role is hole exactly when its authored name is absent")]);
  fixture.hole.tsonic = { role: "hole" };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a bodyless type-only module verifies its real tree without constructing a body", () => {
  const fixture = bodylessModuleScenario();
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
  assertCompleteValue(fixture.queries, [{ kind: "module", module: moduleId }]);
});

for (const changed of ["publication-module", "source-module", "publication-tree"]) {
  test(`module identity independently rejects a different actual ${changed}`, async () => {
    const { encodeModuleId, encodePackageId } = await import("../../packages/host/dist/ids/index.js");
    const fixture = bodylessModuleScenario();
    const otherModule = encodeModuleId({ package: encodePackageId("other"), path: "other" });
    const input = { ...fixture.input,
      module: changed === "publication-module" ? { ...fixture.module, module: otherModule }
        : changed === "publication-tree" ? { ...fixture.module, tree: structuredClone(fixture.module.tree) } : fixture.module,
      source: changed === "source-module" ? { ...fixture.input.source, module: otherModule } : fixture.input.source };
    assertCompleteValue(product.verifyTirModule(input, fixture.module), [nodeViolation("module-node-identity", 0,
      "module tree does not retain its actual source and publication identity")]);
    assert.equal(fixture.module.module, moduleId);
    assert.equal(fixture.input.module === fixture.module, true);
    assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
  });
}

test("module scalar parent references resolve in the actual source arena without body collateral", () => {
  const fixture = bodylessModuleScenario();
  fixture.module.tree.parent = 99;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("node-reference", 0,
    "node identity does not name an actual node in its module arena")]);
  fixture.module.tree.parent = null;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("the closed typed source-file parser rejects an undeclared checker field", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const marker = 'dependence="parametric")))';
  const position = original.indexOf(marker) + 'dependence="parametric")'.length;
  assert.equal(position >= marker.length, true);
  const text = original.slice(0, position) + ", checker=null" + original.slice(position);
  assertInvalidText(text, position + 2, ["end of record"], "checker");
  assertBodyRoundTrip(emptyModuleBody(), original, "closed source-file phase keeps every declared field");
});

test("closed typed source-file fields reject arbitrary UTF16 names in either text order", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const marker = 'dependence="parametric")))';
  const position = original.indexOf(marker) + 'dependence="parametric")'.length;
  for (const names of [["\ue000", "\u{10000}", "aaa"], ["aaa", "\u{10000}", "\ue000"]]) {
    const text = original.slice(0, position) + names.map(name => `, ${JSON.stringify(name)}=null`).join("") + original.slice(position);
    assertInvalidText(text, position + 3, ["end of record"], names[0]);
  }
});

test("module repeated missing declarations share the actual nullable cache and singleton diagnostic", async () => {
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const fixture = bodylessModuleScenario();
  const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
  const actual = fixture.input.declarationOf;
  const queries = [];
  fixture.input.declarationOf = definition => { queries.push(definition); return actual(definition); };
  fixture.keyword.tsonic.declarations = [missing, missing];
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("cross-owner-qualified", 3,
    "definition reference does not name an actual declaration")]);
  assertCompleteValue(queries, [fixture.definition, missing]);
  queries.length = 0;
  fixture.keyword.tsonic.declarations = [fixture.definition, fixture.definition];
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
  assertCompleteValue(queries, [fixture.definition]);
  queries.length = 0;
  fixture.keyword.tsonic.declarations = [];
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
  assertCompleteValue(queries, [fixture.definition]);
});

test("the module verifier owns an invalid type payload outside every published body", () => {
  const fixture = bodylessModuleScenario();
  fixture.alias.tsonic.type = 9;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("type-closed", 1,
    "typed reference does not reach a present closed type/signature graph")]);
  fixture.alias.tsonic.type = 0;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("module definition payloads resolve through the actual declaration reader", () => {
  const fixture = bodylessModuleScenario();
  fixture.keyword.tsonic.declarations = ["D[M[P[foreign];types];missing]"];
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("cross-owner-qualified", 3,
    "definition reference does not name an actual declaration")]);
  fixture.keyword.tsonic.declarations = [fixture.definition];
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("a module retains the actual qualified signature-owner finding and its complete corrected opposite", () => {
  const fixture = bodylessModuleScenario();
  const signature = { id: 0, declaration: fixture.definition, owner: { kind: "item", value: { owner: fixture.definition, node: 99 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 0 };
  fixture.input.types.signatures.push(signature);
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("cross-owner-qualified", 0,
    "type verifier: cross-owner-qualified")]);
  signature.owner.value.node = 1;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("module verification stops before a genuine published body and leaves its reference failure to that body exactly once", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.completion = 9;
  const actualBodyScopes = input.bindingScopesOf;
  const queries = [];
  input.bindingScopesOf = target => {
    queries.push(structuredClone(target));
    return target.kind === "module" ? target.module === moduleId ? [] : null : actualBodyScopes(target);
  };
  assertCompleteValue(product.verifyTirModule(input, input.module), []);
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
  assertCompleteValue(queries, [{ kind: "module", module: moduleId },
    { kind: "body", instance: { body: bodyId, bindings: { kind: "parametric" } } }]);
});

test("unknown module binding context is not treated as the known empty occurrence vector", () => {
  const fixture = bodylessModuleScenario();
  fixture.input.bindingScopesOf = () => null;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("binding-vector-complete", 0,
    "binding target has no actual supplied scope inventory")]);
  fixture.input.bindingScopesOf = target => target.kind === "module" && target.module === moduleId ? [] : null;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("an extra module scope remains a complete node-site finding, not a guessed body scope", () => {
  const fixture = bodylessModuleScenario();
  fixture.scopes.push(emptyScope());
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("binding-vector-complete", 0,
    "supplied binding scope has no corresponding actual vector")]);
  fixture.scopes.pop();
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("a genuine sparse published-body vector is an exact module-path caller defect", () => {
  const fixture = bodylessModuleScenario();
  fixture.module.bodies = Array(1);
  assert.throws(() => product.verifyTirModule(fixture.input, fixture.module), { name: "TypeError",
    message: 'ir-tir: sparse vector at $module["bodies"][0]' });
});

test("a null body-scope answer preserves the complete real instance and reports unresolved context once", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const queries = [];
  input.bindingScopesOf = target => { queries.push(structuredClone(target)); return null; };
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("binding-vector-complete",
    "binding target has no actual supplied scope inventory")]);
  assertCompleteValue(queries, [{ kind: "body", instance: { body: bodyId, bindings: { kind: "parametric" } } }]);
});

for (const selected of [0, 1]) {
  test(`scope lookup distinguishes the complete bound environment for instance ${selected}`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.instances[selected];
    const input = fixture.inputFor(body);
    const reader = input.bindingScopesOf;
    const queries = [];
    input.bindingScopesOf = target => { queries.push(structuredClone(target)); return reader(target); };
    assertCompleteValue(product.verifyTir(input, body), []);
    const expectedBindings = { kind: "instantiated", bindings: { classBindings: [],
      methodBindings: [{ kind: "bound", parameter: { owner: fixture.definition, index: 0 }, type: selected + 2 }],
      capturedBindings: [], selfBindings: [] } };
    assertCompleteValue(queries, [{ kind: "body", instance: { body: fixture.functionBody, bindings: expectedBindings } }]);
    assert.equal(reader({ kind: "body", instance: { body: fixture.functionBody,
      bindings: fixture.instances[1 - selected].bindings } }), null);
  });
}

test("missing and extra actual vector scopes are not guessed from empty data or object sharing", () => {
  const body = emptyModuleBody();
  const missing = emptyVerificationInput(body);
  replaceScopeInventory(missing, [emptyScope()]);
  assertCompleteValue(product.verifyTir(missing, body), [
    { rule: "binding-vector-complete", site: { kind: "node", module: moduleId, node: 0 },
      detail: [{ kind: "text", value: "actual binding vector has no corresponding supplied scope" }] },
  ]);
  const extra = emptyVerificationInput(body);
  bodyScopes(extra, body).push(emptyScope());
  assertCompleteValue(product.verifyTir(extra, body), [bodyViolation("binding-vector-complete", "supplied binding scope has no corresponding actual vector")]);
  body.root.tsonic.template.lexicalBindings = body.lexicalBindings;
  assertCompleteValue(product.verifyTir(emptyVerificationInput(body), body), [], "two declared visits remain two actual scope positions");
});

test("actual table-only lower findings retain their complete type/signature order without occurrence fallbacks", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "array", element: 99, readonly: false });
  input.types.signatures.push({ id: 8, declaration: null,
    owner: { kind: "item", value: { owner: "D[M[P[p];m];foreign]", node: 0 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 99 });
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("type-closed", "type verifier: type-reference"),
    bodyViolation("type-closed", "type verifier: signature-order"),
    bodyViolation("cross-owner-qualified", "type verifier: cross-owner-qualified"),
    bodyViolation("type-closed", "type verifier: type-reference"),
  ]);
});

test("the indexed lower join preserves every original finding across repeated binding and evidence occurrences", () => {
  const body = emptyModuleBody();
  const repeated = { ...emptyBindings(), selfBindings: [
    { kind: "rigid", owner: ownerId }, { kind: "rigid", owner: ownerId },
  ] };
  body.lexicalBindings = repeated;
  body.root.tsonic.template.lexicalBindings = repeated;
  const component = { kind: "body", value: { body: bodyId, node: 0 } };
  const evidence = { ...typeEvidence({ kind: "dynamic" }), nominal: ownerId,
    sum: { kind: "authored", component, bindings: emptyBindings(), arms: [
      { authoredIndex: 1, component, member: 0 }, { authoredIndex: 0, component, member: 0 },
    ] } };
  body.evidence = [evidence, evidence];
  const input = emptyVerificationInput(body, [], 4);
  input.types.terms.push({ kind: "array", element: 99, readonly: false });
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("type-closed", "type verifier: type-reference"),
    bodyViolation("binding-vector-complete", "type verifier: binding-vector-complete"),
    bodyViolation("binding-vector-complete", "type verifier: self-owner"),
    bodyViolation("binding-vector-complete", "type verifier: self-owner"),
    nodeViolation("binding-vector-complete", 0, "type verifier: binding-vector-complete"),
    nodeViolation("binding-vector-complete", 0, "type verifier: self-owner"),
    nodeViolation("binding-vector-complete", 0, "type verifier: self-owner"),
    bodyViolation("evidence-reference", "type verifier: evidence-type"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: evidence-type"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
    bodyViolation("evidence-reference", "type verifier: sum-arm-order"),
  ]);
});

test("a deferred closure decision is a saved invocation of its own occurrence, verified with its context and evidence", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = { type: 4, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category: "callable" }, numeric: null, sum: null, nominal: null, pointer: null };
  const decided = body.root.tsonic.closure;
  body.root.tsonic.closure = { kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: { context, callable: evidence, captures: [] } } } };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  assertCompleteValue(product.verifyTir(input, body), []);
  context.occurrence = { body: body.body, node: 3 };
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("deferred-parameters", 2,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  context.occurrence = { body: body.body, node: 2 };
  body.root.tsonic.closure = decided;
  replaceScopeInventory(input, [fixture.scope, fixture.scope]);
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("a closure's logical captures follow the declaration of each captured binding, in the order of its captured locals", () => {
  // function make(p: int32) { let x = 0; let n = 0; const c = 5; const o = { count: 0 };
  //   return () => { x += 1; o.count += 1; return x + n + c + p; }; }
  const rows = [["x, a let the closure reassigns", "binding", true], ["n, a let never reassigned", "binding", true],
    ["c, a const holding a primitive", "binding", false], ["o, a const holding an object reference whose referent is written", "binding", false],
    ["p, a parameter", "parameter", true]];
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const outerLocals = rows.map(([name, role, mutable], id) => ({ id, declaration: { kind: "body", value: { body: bodyId, node: 0 } },
    name: name.slice(0, 1), role, checkerSlot: available(0), capturedFrom: null, mutable }));
  const captures = rows.map((_row, local) => ({ body: bodyId, local }));
  const logical = rows.map(([, , mutable]) => mutable ? "captured-location" : "captured-value");
  const decided = modes => ({ kind: "decided", decision: { carrier: 4, captures: modes, execution: { kind: "pure" } } });
  fixture.originalFunction.captures = captures;
  fixture.checkedFunction.tsonic.captures = captures;
  for (const published of [fixture.functionTemplate, ...fixture.instances]) {
    published.captures = [...captures];
    published.root.tsonic.captures = [...captures];
    published.root.tsonic.closure = decided([...logical]);
  }
  const input = fixture.inputFor(body);
  input.source.bodies.find(candidate => candidate.body === bodyId).locals = outerLocals;
  const localExists = input.localExists;
  input.localExists = reference => reference.body === bodyId ? outerLocals[reference.local] !== undefined : localExists(reference);
  assertCompleteValue(product.verifyTir(input, body), []);
  // A binding that can be reassigned is a captured location. For one that cannot, the local row alone forces neither value:
  // such a binding may still alias by-reference storage (K-3271); the incoming passing mode and the enclosing capture row
  // decide it.
  const binding = nodeViolation("closure-capture-binding", 2, "a binding that can be reassigned is a captured location");
  for (const [position, [name, , mutable]] of rows.entries()) {
    body.root.tsonic.closure = decided(logical.map((capture, index) => index !== position ? capture
      : capture === "captured-location" ? "captured-value" : "captured-location"));
    assertCompleteValue(product.verifyTir(input, body), mutable ? [binding] : [], name);
  }
  body.root.tsonic.closure = decided(logical.map(() => "captured-value"));
  assertCompleteValue(product.verifyTir(input, body), [binding]);
  body.root.tsonic.closure = decided(logical.map(() => "captured-location"));
  assertCompleteValue(product.verifyTir(input, body), []);
  // A captured local with no row in its body, and a source body list with a hole: no evidence, so no finding from this rule.
  const rowless = { body: bodyId, local: rows.length };
  const withRowless = [...captures, rowless];
  fixture.originalFunction.captures = withRowless;
  fixture.checkedFunction.tsonic.captures = withRowless;
  for (const published of [fixture.functionTemplate, ...fixture.instances]) {
    published.captures = [...withRowless];
    published.root.tsonic.captures = [...withRowless];
  }
  input.localExists = reference => reference.body === bodyId ? reference.local <= rows.length : localExists(reference);
  body.root.tsonic.closure = decided([...logical, "captured-value"]);
  assertCompleteValue(product.verifyTir(input, body), []);
  input.source.bodies.length += 1;
  assertCompleteValue(product.verifyTir(input, body), []);
  input.source.bodies.length -= 1;
  fixture.originalFunction.captures = captures;
  fixture.checkedFunction.tsonic.captures = captures;
  for (const published of [fixture.functionTemplate, ...fixture.instances]) {
    published.captures = [...captures];
    published.root.tsonic.captures = [...captures];
  }
  input.localExists = reference => reference.body === bodyId ? outerLocals[reference.local] !== undefined : localExists(reference);
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = (type, category) => ({ type, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category }, numeric: null, sum: null, nominal: null, pointer: null });
  const saved = captures.map((local, position) => ({ local, value: evidence(3, "number"), reassignable: rows[position][2] }));
  const deferred = captured => ({ kind: "deferred", deferred: { result: 4, invocation: { rule: "closure", input: {
    context, callable: evidence(4, "callable"), captures: captured } } } });
  body.root.tsonic.closure = deferred(saved);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, fixture.scope]);
  assertCompleteValue(product.verifyTir(input, body), []);
  const savedBinding = nodeViolation("closure-capture-binding", 2,
    "saved capture evidence does not name the captured locals in order with their binding evidence");
  for (const changed of [
    [saved[1], saved[0], ...saved.slice(2)],
    saved.map((capture, index) => index === 2 ? { ...capture, local: { body: bodyId, local: 0 } } : capture),
    saved.map((capture, index) => index === 3 ? { ...capture, reassignable: true } : capture),
    saved.map((capture, index) => index === 0 ? { ...capture, reassignable: false } : capture),
  ]) {
    body.root.tsonic.closure = deferred(changed);
    assertCompleteValue(product.verifyTir(input, body), [savedBinding]);
  }
  body.root.tsonic.closure = deferred(saved.slice(1));
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("closure-capture-total", 2,
    "closure decision does not state one logical capture per captured local, in order")]);
});

test("a shared vector is authenticated against each occurrence's actual declaration, never an object-wide owner union", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const context = { occurrence: { body: body.body, node: 2 }, origin: origin(), bindings: body.root.tsonic.callable.template.lexicalBindings };
  const evidence = { type: 4, component: { kind: "body", value: context.occurrence },
    category: { kind: "known", category: "callable" }, numeric: null, sum: null, nominal: null, pointer: null };
  const endpoint = { declaration: ownerId, role: "advertised", signature: 0, body: bodyId };
  const candidate = { ordinal: 0, declaration: ownerId, advertised: endpoint, api: { ...endpoint, role: "api-body" },
    bindings: body.lexicalBindings, conditionalFailure: null };
  body.root.tsonic.conversion = { kind: "deferred", deferred: { result: 4, invocation: { rule: "candidate", input: {
    context, kind: "call", callee: evidence, receiver: null, typeArguments: [], arguments: [], candidates: [candidate] } } } };
  const input = fixture.inputFor(body);
  replaceScopeInventory(input, [fixture.scope, fixture.scope, emptyScope(), fixture.scope]);
  assert.equal(candidate.bindings === body.lexicalBindings, true);
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("binding-vector-complete", 2,
    "type verifier: binding-vector-complete")]);
  candidate.bindings = emptyBindings();
  assertCompleteValue(product.verifyTir(input, body), []);
  candidate.bindings = body.lexicalBindings;
  candidate.declaration = fixture.definition;
  candidate.advertised = { declaration: fixture.definition, role: "advertised", signature: 1, body: body.body };
  candidate.api = { ...candidate.advertised, role: "api-body" };
  bodyScopes(input, body)[2] = fixture.scope;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const resolution of ["local", "definition", "known-aliases", "missing-definition", "missing-alias", "repeated-missing-aliases"]) {
  test(`body definition closure preserves the complete ${resolution} vector at Identifier9`, async () => {
    const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const value = body.root.body.statements.nodes[0].expression;
    const original = value.tsonic.resolution;
    const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
    if (resolution !== "local") value.tsonic.resolution = { kind: "definition",
      definition: resolution === "missing-definition" ? missing : fixture.valueDefinition,
      aliases: resolution === "known-aliases" ? [fixture.definition, fixture.typeDefinition]
        : resolution === "missing-alias" ? [missing] : resolution === "repeated-missing-aliases" ? [missing, missing] : [] };
    const expected = resolution === "missing-definition" || resolution === "missing-alias" || resolution === "repeated-missing-aliases"
      ? [nodeViolation("cross-owner-qualified", 9, "definition reference does not name an actual declaration")] : [];
    assertCompleteValue(product.verifyTir(input, body), expected);
    value.tsonic.resolution = original;
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("body scalar definitions and aliases share the real nullable declaration cache only within one invocation", async () => {
  const { encodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const value = body.root.body.statements.nodes[0].expression;
  const missing = encodeDefId({ module: moduleId, segments: [{ name: "missing", ordinal: 0 }] });
  value.tsonic.resolution = { kind: "definition", definition: missing, aliases: [missing, missing] };
  const actual = input.declarationOf;
  const queries = [];
  input.declarationOf = definition => { queries.push(definition); return actual(definition); };
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("cross-owner-qualified", 9,
    "definition reference does not name an actual declaration")]);
  assertCompleteValue(queries, [fixture.definition, fixture.valueDefinition, fixture.typeDefinition, missing]);
  queries.length = 0;
  fixture.declarations.set(missing, { scope: emptyScope(), parameterCount: 0, endpoints: [] });
  assertCompleteValue(product.verifyTir(input, body), []);
  assertCompleteValue(queries, [fixture.definition, fixture.valueDefinition, fixture.typeDefinition, missing]);
});

for (const variant of ["outer", "template", "string", "int32"]) {
  test(`authentic generic function ${variant} preserves its own template, formal storage and complete publication`, () => {
    const fixture = genericFunctionScenario();
    const selected = variant === "outer" ? fixture.outer : variant === "template" ? fixture.functionTemplate
      : fixture.instances[variant === "string" ? 0 : 1];
    assertCompleteValue(product.verifyTir(fixture.inputFor(selected), selected), []);
    assert.equal(fixture.outer.dependence, "parametric");
    assert.equal(fixture.functionTemplate.dependence, "binding-dependent");
    assert.equal(fixture.functionTemplate.root === fixture.module.tree.statements.nodes[0].expression, true);
    assert.equal(fixture.instances[0].root === fixture.instances[1].root, false);
    assert.equal(fixture.instances[0].root.id, fixture.instances[1].root.id);
    assert.equal(fixture.instances[0].root.body.statements.nodes[0].expression.tsonic.type, 2);
    assert.equal(fixture.instances[1].root.body.statements.nodes[0].expression.tsonic.type, 3);
  });
}

for (const selected of ["outer", "template", "string", "int32"]) {
  test(`several genuine ${selected} formals retain complete source, local and instance associations`, () => {
    const fixture = twoParameterScenario();
    const body = selected === "outer" ? fixture.outer : selected === "template" ? fixture.functionTemplate
      : fixture.instances[selected === "string" ? 0 : 1];
    assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), []);
  });
}
test("several finalized formals cannot be reordered while their actual parameter nodes retain declared order", () => {
  const fixture = twoParameterScenario();
  const body = fixture.functionTemplate;
  body.params.reverse();
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [bodyViolation("parameter-order",
    "parameter records do not retain the actual declared formal order", fixture.functionBody)]);
});
test("omitting a second real formal preserves both inventory and actual occurrence findings", () => {
  const fixture = twoParameterScenario();
  const body = fixture.functionTemplate;
  body.params.pop();
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [
    bodyViolation("parameter-order", "parameter records do not retain the actual declared formal order", fixture.functionBody),
    nodeViolation("parameter-order", 7, "parameter occurrence does not retain its actual declared formal and local association"),
  ]);
});

for (const mode of ["sync", "async", "generator", "async-generator"]) {
  test(`completion-endpoint uses the actual ${mode} body channels, not the API wrapper result`, () => {
    const fixture = callScenario(mode);
    const publication = fixture.input.bodyOf;
    const queries = [];
    fixture.input.bodyOf = instance => { queries.push(instance); return publication(instance); };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    assertCompleteValue(queries, [{ body: fixture.functionBody, bindings: { kind: "instantiated", bindings: {
      classBindings: [], methodBindings: [{ kind: "bound", parameter: fixture.identity, type: 2 }], capturedBindings: [], selfBindings: [],
    } } }]);
    assert.equal(fixture.decision.completion.completion, 2);
    assert.equal(fixture.types.signatures[2].result, mode === "sync" ? 2 : 5);
    assert.equal(publication(fixture.callee.activation) === fixture.target, true);
  });
  test(`the actual ${mode} canonical body independently retains complete typed syntax and channels`, () => {
    const fixture = callScenario(mode);
    const input = fixture.inputFor(fixture.target);
    input.nominalOf = fixture.input.nominalOf;
    assertCompleteValue(product.verifyTir(input, fixture.target), []);
  });
  for (const channel of ["signature", "completion", "yielded", "sent"]) {
    test(`completion-endpoint detects the genuine ${mode}/${channel} canonical-body mismatch`, () => {
      const fixture = callScenario(mode);
      fixture.decision.completion[channel] = channel === "signature" || channel === "completion" ? 3
        : channel === "yielded" ? 2 : 3;
      const expected = [nodeViolation("completion-endpoint", 2,
        "selected completion does not retain the actual activated body's signature and channels")];
      if (channel === "signature") expected.unshift(nodeViolation("completion-endpoint", 2,
        "selected completion does not retain its actual API signature"));
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), expected);
    });
  }
  test(`missing ${mode} actual publication remains only instance resolution, not invented completion channels`, () => {
    const fixture = callScenario(mode);
    fixture.module.bodies.splice(fixture.module.bodies.indexOf(fixture.target), 1);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("nested-instance-key", 2,
      "instance does not select a real canonical body with the complete artifact environment")]);
  });
}

for (const field of ["candidate", "advertised"]) {
  test(`actual callable ${field} association is authenticated against independent canonical records`, () => {
    const fixture = callScenario();
    if (field === "candidate") fixture.decision.candidate = 99;
    else fixture.decision.advertised = { ...fixture.decision.advertised, body: bodyId };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
      "selected callable endpoints do not belong to their actual declarations and candidate")]);
  });
}
const callEndpoints = () => [nodeViolation("call-endpoints", 2,
  "selected callable endpoints do not belong to their actual declarations and candidate")];
test("an overloaded family's implementation endpoint cannot stand in for its advertised endpoint", () => {
  const fixture = callScenario();
  fixture.decision.advertised = fixture.decision.api;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), callEndpoints());
});
test("a family without an advertised row selects one endpoint as both the advertised and the API endpoint", () => {
  const fixture = callScenario();
  const family = fixture.declarations.get(fixture.definition).endpoints;
  const advertised = fixture.decision.advertised;
  family.splice(family.indexOf(advertised), 1);
  fixture.decision.advertised = fixture.decision.api;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.decision.advertised = advertised;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), callEndpoints());
  fixture.decision.advertised = { ...fixture.decision.api, signature: 1 };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), callEndpoints());
});
// A bodiless API signature declared by another definition, as in the inference case of a native binding: the callee is
// not activated, so no body's completion is involved and only endpoint membership is under test.
const foreignApi = fixture => {
  const other = "D[M[P[p];m];native]";
  const foreign = { declaration: other, role: "api-signature", signature: 4, body: null };
  fixture.types.signatures.push({ ...fixture.types.signatures[2], id: 4, declaration: other });
  fixture.declarations.set(other, { scope: fixture.scope, parameterCount: 1, endpoints: [foreign] });
  fixture.decision.api = foreign;
  fixture.decision.completion = { ...fixture.decision.completion, signature: 4 };
  fixture.callee.activation = null;
  bodyScopes(fixture.input, fixture.body).splice(3, 1);
  return foreign;
};
test("an advertised row is a family member by its signature as well as its owner, role and body", () => {
  const fixture = callScenario();
  const family = fixture.declarations.get(fixture.definition).endpoints;
  family.push({ ...fixture.decision.advertised, signature: 3 });
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  family.pop();
  fixture.decision.advertised = { ...fixture.decision.advertised, signature: 3 };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), callEndpoints());
});
test("an API endpoint declared by another definition is selected only through the selected declaration's family", () => {
  const unrelated = callScenario();
  foreignApi(unrelated);
  assertCompleteValue(product.verifyTir(unrelated.input, unrelated.body), callEndpoints());
  const associated = callScenario();
  associated.declarations.get(associated.definition).endpoints.push(foreignApi(associated));
  assertCompleteValue(product.verifyTir(associated.input, associated.body), []);
});
test("a nonactivated callee retains actual endpoints but cannot claim captured values without an activation", () => {
  const fixture = callScenario();
  fixture.callee.activation = null;
  bodyScopes(fixture.input, fixture.body).splice(3, 1);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.callee.captures = [{ body: fixture.functionBody, local: 0 }];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
    "callee activation and captures do not retain their actual API body")]);
});
test("a genuine selected activation cannot invent an existing local as its canonical capture", () => {
  const fixture = callScenario();
  fixture.callee.captures = [{ body: fixture.functionBody, local: 0 }];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("capture-qualified", 2,
    "activated callee does not retain the actual canonical body's capture vector")]);
});
test("two contextual property components in one literal retain distinct authentic tables", () => {
  const fixture = contextualLiteralScenario();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  assertCompleteValue(fixture.queries, fixture.facts.map(fact => ({ instance: fact.instance, occurrence: fact.occurrence })));
  assert.equal(fixture.facts[0].table.receiver, 1);
  assert.equal(fixture.facts[1].table.receiver, 2);
  assert.equal(fixture.body.root.statements.nodes[0].expression.tsonic.type, 0);
  assert.equal(fixture.body.root.statements.nodes[0].expression.tsonic.convertedType, 0);
});

test("swapping contextual property associations is not repaired from the enclosing literal type", () => {
  const fixture = contextualLiteralScenario();
  const first = fixture.facts[0].table;
  fixture.facts[0].table = fixture.facts[1].table;
  fixture.facts[1].table = first;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("member-origin", 3, "member selection does not retain a real member key and its actual declared origins"),
    nodeViolation("member-origin", 6, "member selection does not retain a real member key and its actual declared origins"),
  ]);
});

for (const [name, position] of [["parametric", 0], ["bound-string", 1], ["bound-int32", 2]]) {
  test(`actual ${name} instance selects its own same-node property association and receiver context`, () => {
    const fixture = genericObjectScenario();
    const body = [fixture.functionTemplate, ...fixture.instances][position];
    assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), []);
    assertCompleteValue(fixture.queries, [{ instance: fixture.facts[position].instance, occurrence: { kind: "selection", node: 10, ordinal: 0 } }]);
    assert.equal(fixture.facts[position].table.receiver, position + 5);
    assert.equal(fixture.facts[position].table.members[0].read, position + 1);
  });
}

test("same authored node and body under another bound environment do not satisfy memberTableOf", () => {
  const fixture = genericObjectScenario();
  const body = fixture.instances[0];
  fixture.facts[1].instance = { body: fixture.functionBody, bindings: fixture.instances[1].bindings };
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [nodeViolation("member-origin", 10,
    "member selection does not retain a real member key and its actual declared origins")]);
});

test("an owner change cannot authenticate itself through unchanged body and template keys", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.owner = "D[M[P[p];m];foreign]";
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("body-owner", "body identity and owner do not retain the actual original body"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    bodyViolation("cross-owner-qualified", "definition reference does not name an actual declaration"),
    bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope"),
  ]);
});

test("the actual source module remains authoritative for typed publication identity", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.module = "M[P[p];other]";
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("module-node-identity", 0,
    "body does not retain its module identity and canonical parametric subtree")]);
});

test("an equal-looking copy is not the shared canonical parametric module subtree", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root = structuredClone(body.root);
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("module-node-identity", 0, "body does not retain its module identity and canonical parametric subtree"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
  ]);
});

test("a duplicate canonical publication is rejected even when both entries are the exact same object", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.bodies.push(body);
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("template-shared-once",
    "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
});

test("an instantiated publication cannot replace its required authentic parametric template", () => {
  const body = emptyModuleBody();
  body.bindings = { kind: "instantiated", bindings: emptyBindings() };
  const input = emptyVerificationInput(body, [], 3);
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("template-shared-once", "actual source body has no canonical parametric template in the publication"),
    nodeViolation("nested-template-identity", 0, "typed template does not retain its real authored body and shared syntax identity"),
  ]);
});

test("canonical template order retains the actual source body's publication order", () => {
  const fixture = genericFunctionScenario();
  fixture.module.bodies = [fixture.functionTemplate, fixture.outer, ...fixture.instances];
  assertCompleteValue(product.verifyTir(fixture.inputFor(fixture.outer), fixture.outer), [bodyViolation("stable-order",
    "canonical template publication does not retain actual source body order")]);
});

test("the closed typed body graph cannot invent a missing completion type reference", () => {
  const body = emptyModuleBody();
  body.completion = 99;
  assertCompleteValue(product.verifyTir(emptyVerificationInput(body), body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
});

test("a genuine recursive type reference graph is closed without an invented verifier depth budget", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "array", element: 1, readonly: false });
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const term of [
  { kind: "literal", value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base: 1 },
  { kind: "union", members: [0, 1] },
  { kind: "intersection", members: [0, 1] },
  { kind: "optional", value: 0 },
  { kind: "fixed-array", element: 1, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
  { kind: "tuple", elements: [
    { kind: "required", type: 1, declaration: null }, { kind: "optional", type: 1, declaration: null },
    { kind: "rest", type: 1, declaration: null },
  ], readonly: false },
  { kind: "shape", members: [{ key: { kind: "text", value: "value" },
    origins: [{ kind: "declared", declaration: ownerId }], readOrigins: [{ kind: "declared", declaration: ownerId }],
    writeOrigins: [{ kind: "declared", declaration: ownerId }], kind: "property", read: 1, write: 1, optional: false, readonly: false }],
  indexes: [{ declaration: ownerId, key: 0, read: 1, write: 1, readonly: false }], calls: [0], constructs: [1] },
  { kind: "callable", calls: [0], constructs: [1] },
  { kind: "declared", definition: "D[M[P[core];types];Container]", arguments: [1], facet: "instance", extent: null },
  { kind: "enum", definition: "D[M[P[core];types];Choice]" },
  { kind: "param", parameter: { owner: ownerId, index: 0 } },
  { kind: "self", owner: ownerId },
  { kind: "projection", source: 0, projection: { kind: "awaited" } },
]) {
  test(`the real closed table ${term.kind} arm retains every referenced type/signature edge`, () => {
    const body = emptyModuleBody();
    body.completion = 2;
    const input = emptyVerificationInput(body);
    input.types.terms.push({ kind: "primitive", primitive: "int32" }, term);
    input.types.signatures.push({ ...input.types.signatures[0], id: 1, kind: "construct" });
    const nominals = new Map([
      ["D[M[P[core];types];Container]", { kind: "declared", facets: ["instance", "value"] }],
      ["D[M[P[core];types];Choice]", { kind: "enum", facets: ["instance", "value"] }],
    ]);
    input.nominalOf = definition => nominals.get(definition) ?? null;
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("an actual construction-reference reaches its real array-pattern source without inventing an element node", () => {
  const fixture = memberScenario("construction");
  fixture.input.types.terms.push({ kind: "construction-reference", definition: { occurrence: { body: bodyId, node: 2 }, captures: [] }, arguments: [0] });
  fixture.body.completion = fixture.input.types.terms.length - 1;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("the closed signature graph includes its real receiver, parameter, constraint, default and composition edges", () => {
  const body = emptyModuleBody();
  body.signature = 1;
  const input = emptyVerificationInput(body);
  input.types.signatures.push({ id: 1, declaration: ownerId,
    owner: { kind: "body", value: { body: bodyId, node: 0 } }, composition: { kind: "intersection", signatures: [0] },
    kind: "call", typeParameters: [{ identity: { owner: ownerId, index: 0 }, declaration: ownerId, constraint: 0, default: 0 }],
    receiver: 0, parameters: [{ declaration: ownerId, kind: "required", type: 0, passing: "by-value", initializer: null }], result: 0 });
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("an actual open producer variable cannot become a closed TIR completion endpoint", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "open", group: `G[${bodyId}]`, variable: 0 });
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("type-closed",
    "typed reference does not reach a present closed type/signature graph")]);
});

test("a reachable actual error type requires the current matching source error diagnostic", () => {
  const body = emptyModuleBody();
  body.completion = 1;
  const input = emptyVerificationInput(body);
  input.types.terms.push({ kind: "error" });
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("error-diagnostic",
    "error type is not accompanied by an actual error diagnostic at its source origin")]);
  input.diagnostics.push({ code: { kind: "checker", number: 999, rendered: "TS999" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "actual source error",
    arguments: [], related: [], fix: null });
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("a real outer capture retains its actual foreign-local existence boundary", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const capture = { body: "B[D[M[P[foreign];source];f];function;0]", local: 0 };
  body.captures = [capture];
  input.source.bodies[0].captures = [capture];
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("cross-owner-qualified",
    "local reference does not name an actual local in its declared body")]);
  input.localExists = reference => reference.body === capture.body && reference.local === 0;
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("an enclosing body cannot claim the evidence occurrence of its genuine nested body", () => {
  const fixture = genericFunctionScenario();
  fixture.outer.evidence = [{ ...typeEvidence({ kind: "dynamic" }),
    component: { kind: "body", value: { body: bodyId, node: 9 } } }];
  assertCompleteValue(product.verifyTir(fixture.inputFor(fixture.outer), fixture.outer), [
    bodyViolation("cross-owner-qualified", "source reference does not name an actual node in its declared owner"),
    bodyViolation("node-reference", "qualified node does not name an actual node in its declared body"),
    bodyViolation("nested-boundary", "body evidence crosses an authentic nested-body root or leaves its own body subtree"),
    bodyViolation("evidence-reference", "type verifier: cross-owner-qualified"),
    bodyViolation("evidence-reference", "body evidence does not select an occurrence in its actual own-body boundary"),
  ]);
});

test("nullable authored callable-body presence is structural, not a missing-required-field fabrication", () => {
  const fixture = genericFunctionScenario();
  fixture.functionTemplate.root.body = null;
  assertCompleteValue(product.verifyTir(fixture.inputFor(fixture.functionTemplate), fixture.functionTemplate), [
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
});

test("nonfinite or reversed actual source intervals are not retained as valid geometry", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.loc.end = -1;
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("origin-range", 1,
    "typed origin or lexical range does not retain the actual source interval")]);
});

test("a present but wrong parent is distinct from an absent node reference", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.parent = 1;
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("parent-reference", 1,
    "typed node parent differs from the real authored parent")]);
});

test("a missing parent retains both genuine parent-preservation and node-reference findings", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.parent = 99;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("parent-reference", 1, "typed node parent differs from the real authored parent"),
    nodeViolation("node-reference", 1, "node identity does not name an actual node in its module arena"),
  ]);
});

test("internally consistent renumbering still retains every authored-identity and inserted-node finding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.endOfFileToken.id = 2;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("authored-node-ids-preserved", 2, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 2, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 2, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 2, "node identity does not name an actual node in its module arena"),
  ]);
});

for (const shared of [false, true]) {
  test(`the genuine ${shared ? "shared" : "distinct"} authored sibling identities preserve their exact arena association`, () => {
    const fixture = siblingIdentityScenario(shared, shared);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}
test("one typed arena node cannot collapse two different authentic authored sibling identities", () => {
  const fixture = siblingIdentityScenario(false, true);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("authored-node-ids-preserved", 1,
    "typed node identity differs from the actual authored node at this position")]);
  fixture.body.root.statements.nodes[1] = { ...fixture.second };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});
test("two typed arena objects cannot replace one actually shared authored sibling", () => {
  const fixture = siblingIdentityScenario(true, false);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("no-inserted-nodes", 1,
    "typed syntax duplicates an actual authored arena node")]);
  fixture.body.root.statements.nodes[1] = fixture.firstTyped;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("closed nested phase records reject checker views at their text boundary", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = original.lastIndexOf("selfBindings=[]") + "selfBindings=[]".length;
  const text = original.slice(0, position) + ", views=null" + original.slice(position);
  assertInvalidText(text, position + 2, ["end of record"], "views");
  assertBodyRoundTrip(emptyModuleBody(), original, "closed nested binding record keeps every declared field");
});

test("closed nested phase records reject the first undeclared field without accepting later extras", () => {
  const original = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = original.lastIndexOf("selfBindings=[]") + "selfBindings=[]".length;
  for (const names of [["aaa", "zzz"], ["zzz", "aaa"]]) {
    const text = original.slice(0, position) + names.map(name => `, ${name}="extra"`).join("") + original.slice(position);
    assertInvalidText(text, position + 2, ["end of record"], names[0]);
  }
});

test("local dense identity and actual local-slot existence remain distinct full-vector checks", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.locals[0].id = 1;
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [
    bodyViolation("local-dense", "local records are not dense in their actual body order", fixture.functionBody),
    bodyViolation("local-storage", "local identity does not select a real local storage slot", fixture.functionBody),
  ]);
});

test("a formal's actual finalized storage cannot disagree with its genuine local slot", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.params[0].storage = 2;
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [bodyViolation("local-storage",
    "parameter storage does not retain its real local slot", fixture.functionBody)]);
});

test("the authored Parameter occurrence must retain the actual body-local storage association", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.root.parameters.nodes[0].tsonic.storage = 2;
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [nodeViolation("binding-storage", 5,
    "binding occurrence does not retain its actual qualified local storage slot")]);
});

test("a type-correct formal role change does not retain the original parameter inventory", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.params[0].role = "optional";
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [bodyViolation("parameter-order",
    "parameter records do not retain the actual declared formal order", fixture.functionBody)]);
});

test("same-body capture invention retains both qualification and original-order failures", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  body.captures.push({ body: fixture.functionBody, local: 0 });
  assertCompleteValue(product.verifyTir(fixture.inputFor(body), body), [
    bodyViolation("capture-qualified", "capture inventory does not name a real qualified outer local", fixture.functionBody),
    bodyViolation("stable-order", "capture and nested-body inventories do not retain actual source order", fixture.functionBody),
  ]);
});

for (const form of ["whole", "empty", "unknown", "values", "empty-rest", "optional", "default"]) {
  test(`actual argument/formal transport retains the complete ${form} disposition`, () => {
    const fixture = argumentScenario(form);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    if (form === "whole") {
      assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: [2, 2] }]);
      assertCompleteValue(fixture.decision.parameters, [
        { kind: "argument", parameter: 0, argument: 0, component: 0, passing: "by-value" },
        { kind: "rest", parameter: 1, arguments: [0], passing: "by-value" },
      ]);
      assert.equal(fixture.call.arguments.nodes[0].expression.kind, "Identifier");
    }
    if (form === "empty") assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: [] }]);
    if (form === "unknown") assertCompleteValue(fixture.parts, [{ kind: "spread", expression: 5, tuple: null }]);
  });
}

test("the actual omitted default initializer has one separate canonical publication query", () => {
  const fixture = argumentScenario("default");
  const publication = fixture.input.bodyOf;
  const queries = [];
  fixture.input.bodyOf = instance => { queries.push(instance); return publication(instance); };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  assertCompleteValue(queries, [{ body: "B[D[M[P[api];collections];f/default];default-argument;0]", bindings: { kind: "parametric" } }]);
});
test("a real missing omitted-initializer publication is not replaced by the calling body's own record", () => {
  const fixture = argumentScenario("default");
  fixture.input.bodyOf = () => null;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("nested-instance-key", 2,
    "instance does not select a real canonical body with the complete artifact environment")]);
});

test("overloaded zero-argument calls retain the actual optional, default and empty-rest API slot", () => {
  for (const form of ["optional", "default", "empty-rest"]) {
    const fixture = argumentScenario(form);
    const advertisedId = fixture.input.types.signatures.length;
    fixture.input.types.signatures.push({ ...fixture.input.types.signatures[1], id: advertisedId, parameters: [] });
    fixture.decision.advertised.signature = advertisedId;
    fixture.captured.resolvedSignature.value = advertisedId;
    fixture.input.source.bodies[0].candidateLists[0].candidates[0].appliedSignature.value = advertisedId;
    fixture.input.types.terms[1].calls = [advertisedId];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [], `${form}: implementation formals, not overload arity, own transport`);
    fixture.decision.parameters = [];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
      nodeViolation("argument-total", 2, "application dispositions are not total over the real API formals and receiver"),
    ], `${form}: decision and transport report the same complete public finding once through the existing exact-key emitter`);
  }
});

for (const passing of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
  test(`closed API/formal/actual argument transport retains ${passing} without a passing-mode guess`, () => {
    const fixture = argumentScenario("unknown", passing);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    assert.equal(fixture.decision.parameters[0].passing, passing);
    assert.equal(fixture.parameters[0].passing, passing);
  });
  test(`the complete formal/storage codec retains passing mode ${passing}`, () => {
    const body = emptyModuleBody();
    body.params = [{ local: 0, declaration: ownerId, role: "required", passing, initializer: null, storage: 0 }];
    body.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } },
      name: "formal", role: "parameter", capturedFrom: null, mutable: true, storage: 0 }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("params=[], locals=[]", `params=[TirParam(local=l:0, declaration=def:"${ownerId}", role="required", ` +
        `passing="${passing}", initializer=null, storage=t:0)], locals=[TirLocal(id=l:0, ` +
        `declaration=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), name="formal", role="parameter", ` +
        'capturedFrom=null, mutable=true, storage=t:0)]');
    assertBodyRoundTrip(body, expected, passing);
  });
}

for (const role of ["required", "optional", "default", "rest", "this"]) {
  test(`every formal record role ${role} has an independently framed complete codec value`, () => {
    const body = emptyModuleBody();
    const initializer = role === "default" ? "B[D[M[P[p];m];formal];default-argument;0]" : null;
    body.params = [{ local: 0, declaration: ownerId, role, passing: "by-value", initializer, storage: 0 }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("params=[]", `params=[TirParam(local=l:0, declaration=def:"${ownerId}", role="${role}", ` +
        `passing="by-value", initializer=${initializer === null ? "null" : `body:"${initializer}"`}, storage=t:0)]`);
    assertBodyRoundTrip(body, expected, role);
  });
}

for (const role of ["parameter", "binding", "capture", "catch"]) {
  test(`every local ${role} record preserves capture ownership, mutability and finalized storage`, () => {
    const body = emptyModuleBody();
    const capturedFrom = role === "capture" ? { body: "B[D[M[P[p];m];outer];function;0]", local: 7 } : null;
    body.locals = [{ id: 0, declaration: { kind: "item", value: { owner: ownerId, node: 0 } },
      name: "local", role, capturedFrom, mutable: role !== "catch", storage: 0 }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("locals=[]", `locals=[TirLocal(id=l:0, declaration=item(value=ItemNodeRef(owner=def:"${ownerId}", node=n:0)), ` +
        `name="local", role="${role}", capturedFrom=${capturedFrom === null ? "null" :
          'LocalRef(body=body:"B[D[M[P[p];m];outer];function;0]", local=l:7)'}, mutable=${role !== "catch"}, storage=t:0)]`);
    assertBodyRoundTrip(body, expected, role);
  });
}

test("missing real parameter dispositions retain the full argument-total finding", () => {
  const fixture = argumentScenario();
  fixture.application.arguments = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("argument-total", 2,
    "application dispositions are not total over the real API formals and receiver")]);
});

test("a provided disposition cannot silently select another actual formal ordinal", () => {
  const fixture = argumentScenario();
  fixture.application.arguments[0].parameter = 1;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("argument-parameter-order", 2,
    "argument and mapping parameters do not retain formal order")]);
});

test("a mapping passing mismatch is not repaired from the actual captured argument mode", () => {
  const fixture = argumentScenario();
  fixture.decision.parameters[0].passing = "move";
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("argument-passing", 2,
    "argument mapping does not retain the formal passing mode")]);
});

test("optional absence is not an empty-rest disposition", () => {
  const fixture = argumentScenario("optional");
  fixture.application.arguments[0].value = { kind: "empty-rest" };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("omission-valid", 2,
    "omission does not match the actual optional, default or rest formal")]);
});

test("ordinary/rest/spread parts retain their actual authored evaluation order", () => {
  const fixture = argumentScenario("values");
  fixture.application.arguments[0].parts = [fixture.parts[2], fixture.parts[1], fixture.parts[0]];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
});

test("a known empty authored spread cannot become an unknown tuple", () => {
  const fixture = argumentScenario("empty");
  fixture.parts[0].tuple = null;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("empty-spread-preserved", 2,
    "authored empty spread is not retained in the whole spread tuple and rest source indices")]);
});

test("dropping an empty spread retains both actual transport and empty-source findings", () => {
  const fixture = argumentScenario("empty");
  fixture.application.arguments[0].parts = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("authored-order-preserved", 2, "argument transport does not retain the original authored argument sequence"),
    nodeViolation("empty-spread-preserved", 2, "authored empty spread is not retained in the whole spread tuple and rest source indices"),
  ]);
});

test("several real tuple components join once to their retained whole rest spread", () => {
  const fixture = argumentScenario("whole");
  const call = fixture.body.root.statements.nodes[0].expression;
  const application = call.tsonic.application.decision;
  const decision = application.callee.decision;
  const signature = fixture.input.types.signatures[1];
  const rest = signature.parameters[1];
  signature.parameters = [signature.parameters[0], { ...signature.parameters[0], declaration: "D[M[P[api];collections];f/head2]" }, rest];
  decision.parameters = [decision.parameters[0], { kind: "argument", parameter: 1, argument: 0, component: 1, passing: "by-value" },
    { kind: "rest", parameter: 2, arguments: [0], passing: "by-value" }];
  application.arguments = [application.arguments[0], { kind: "provided", parameter: 1, expression: 5 },
    { ...application.arguments[1], parameter: 2 }];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  decision.parameters[0].component = 1;
  decision.parameters[1].component = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
});

for (const disposition of ["true", "false", "dynamic"]) {
  test(`actual ${disposition} conditional branches retain their own selected/never demand contexts`, () => {
    const fixture = conditionalScenario(disposition);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

test("a claimed control cannot replace the actual authored condition and silently repair its children", () => {
  const fixture = conditionalScenario("true");
  fixture.typed.tsonic.selection.control = 5;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("controlled-demand", 2, "selection does not retain its authored control and branch endpoints"),
    nodeViolation("controlled-demand", 5, "demand does not retain its actual enclosing control, branch and condition"),
    nodeViolation("controlled-demand", 7, "demand does not retain its actual enclosing control, branch and condition"),
  ]);
});

test("a never-evaluated conditional branch is not an unconditional demand", () => {
  const fixture = conditionalScenario("true");
  fixture.typed.whenFalse.tsonic.demand = { kind: "always" };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("controlled-demand", 7,
    "controlled branch does not retain its selected or never-evaluated demand")]);
});

test("a selected branch cannot substitute an unrelated actual control node", () => {
  const fixture = conditionalScenario();
  fixture.typed.whenTrue.tsonic.demand.control = 7;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("controlled-demand", 5,
    "demand does not retain its actual enclosing control, branch and condition")]);
});

test("actual native operator endpoints retain their real lexical permission scope", () => {
  const fixture = operationScenario();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("missing lexical scopes retain the complete source-inventory and operation cofindings", () => {
  const fixture = operationScenario();
  const scopes = fixture.body.scopes;
  fixture.body.scopes = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    bodyViolation("permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
    nodeViolation("permission-scope", 2, "operation permission scope is not an actual enclosing lexical scope"),
  ]);
  fixture.body.scopes = scopes;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a selected operation cannot invent a different actual occurrence result", () => {
  const fixture = operationScenario();
  fixture.operation.decision.result = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
    "selected occurrence operation does not retain its value result endpoint")]);
});

test("a selected native operator retains its authored operand count and value endpoints", () => {
  const fixture = operationScenario();
  fixture.operation.decision.operands = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
    "selected operation does not retain the authored operand count and value endpoints")]);
});

test("an operation permission cannot select a present nonscope expression as its lexical owner", () => {
  const fixture = operationScenario();
  fixture.operation.permissionScope = 3;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("permission-scope", 2,
    "operation permission scope is not an actual enclosing lexical scope")]);
});

test("a mismatched lexical permission inventory preserves both actual data and enclosing-scope failures", () => {
  const fixture = operationScenario();
  fixture.body.scopes[0].attributes.push({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } }, arguments: [] });
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    bodyViolation("permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
    nodeViolation("permission-scope", 2, "operation permission scope is not an actual enclosing lexical scope"),
  ]);
});

for (const nodes of [[], [2], [2, 3], [3, 2]]) {
  test(`actual lexical attribute argument order [${nodes.join(",")}] retains the complete permission fact`, () => {
    const fixture = operationScenario();
    const attribute = () => ({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } },
      arguments: nodes.map(node => ({ kind: "body", value: { body: bodyId, node } })) });
    fixture.body.scopes[0].attributes = [attribute()];
    fixture.input.source.bodies[0].scopes[0].attributes = [attribute()];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}
for (const field of ["occurrence", "argument"]) {
  test(`a lexical attribute cannot substitute a different genuine ${field} from the same body`, () => {
    const fixture = operationScenario();
    const attribute = () => ({ declaration: ownerId, occurrence: { kind: "body", value: { body: bodyId, node: 0 } },
      arguments: [{ kind: "body", value: { body: bodyId, node: 2 } }] });
    fixture.body.scopes[0].attributes = [attribute()];
    fixture.input.source.bodies[0].scopes[0].attributes = [attribute()];
    if (field === "occurrence") fixture.body.scopes[0].attributes[0].occurrence.value.node = 2;
    else fixture.body.scopes[0].attributes[0].arguments[0].value.node = 3;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [bodyViolation("permission-scope",
      "lexical scope attributes do not retain actual authored permission data")]);
  });
}

test("a conversion's structural source is checked without replaying the embedding rule", () => {
  const fixture = operationScenario();
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "conversion", embedding: { kind: "identity" }, from: 1, to: 1 },
    operands: [1], result: 1, execution: { kind: "pure" } } };
  fixture.typed.tsonic.conversion = { kind: "convert", role: "initialization", operation };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  operation.decision.operands = [0];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("conversion-source", 2, "conversion does not retain its value source endpoint"),
    nodeViolation("operation-type", 2, "conversion operation does not retain its explicit operand and result endpoints")]);
});

test("identity conversion preserves its actual source and destination without a relation solver", () => {
  const fixture = operationScenario();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.typed.tsonic.convertedType = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("conversion-destination", 2,
    "conversion does not retain its destination endpoint")]);
  fixture.typed.tsonic.convertedType = 1;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a conversion's structural destination is checked without guessing a receiver or relation", () => {
  const fixture = operationScenario();
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "conversion", embedding: { kind: "identity" }, from: 1, to: 1 },
    operands: [1], result: 1, execution: { kind: "pure" } } };
  fixture.typed.tsonic.conversion = { kind: "convert", role: "initialization", operation };
  fixture.typed.tsonic.convertedType = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("conversion-destination", 2,
    "conversion does not retain its destination endpoint")]);
});

test("a saved generic conversion retains its genuine rigid-parameter declaration and full captured environment", () => {
  const fixture = deferredConversionScenario();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  assert.equal(fixture.context.bindings.methodBindings[0].kind, "rigid");
  assertCompleteValue(fixture.context.bindings.methodBindings[0].parameter, fixture.identity);
});

test("a saved conversion cannot substitute a different genuine occurrence as its own", () => {
  const fixture = deferredConversionScenario();
  fixture.context.occurrence.node = fixture.nodes.return;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("conversion-deferred", 9, "deferred conversion does not retain its occurrence and result"),
    nodeViolation("deferred-parameters", 9,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support"),
  ]);
});

test("a saved conversion result is not silently repaired from its current value endpoint", () => {
  const fixture = deferredConversionScenario();
  fixture.deferred.result = 2;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("conversion-deferred", 9,
    "deferred conversion does not retain its occurrence and result")]);
});

test("a saved invocation cannot omit the genuine rigid parameter required by its reachable input type", () => {
  const fixture = deferredConversionScenario();
  fixture.context.bindings = emptyBindings();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("binding-vector-complete", 9, "type verifier: binding-vector-complete"),
    nodeViolation("deferred-parameters", 9,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support"),
  ]);
});

test("an actual refinement result retains the finalized value endpoint", () => {
  const fixture = operationScenario();
  fixture.typed.tsonic.narrowing = { kind: "identity", type: 1 };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.typed.tsonic.narrowing.type = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("refinement-destination", 2,
    "refinement does not retain its value endpoint")]);
});

test("an error resolution needs the actual current source error diagnostic, not merely an integer", () => {
  const fixture = memberScenario("property-access");
  const receiver = fixture.body.root.statements.nodes[0].expression.expression;
  receiver.tsonic.resolution = { kind: "error", diagnostic: 0 };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("error-diagnostic", 3,
    "error resolution does not select an actual error diagnostic at its source origin")]);
  fixture.input.diagnostics = [{ code: { kind: "checker", number: 1234, rendered: "TS1234" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: "checker", evidence: [], message: "authored source error",
    arguments: [], related: [], fix: null }];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

for (const [role, token] of [["arithmetic", "PlusToken"], ["comparison", "EqualsEqualsEqualsToken"],
  ["short-circuit", "AmpersandAmpersandToken"], ["assignment", "EqualsToken"], ["sequence", "CommaToken"]]) {
  test(`the closed ${role} binary role retains its actual authored operator`, () => {
    const fixture = binaryScenario(role, token);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

test("a genuine wrong binary role is rejected independently of phase-record constructibility", () => {
  const fixture = binaryScenario("sequence", "PlusToken");
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("binary-role-operator", 2,
    "binary role does not match its authored operator token")]);
});

test("a property-name cannot replace an actual authored value occurrence", () => {
  const fixture = memberScenario("property-access");
  fixture.body.root.statements.nodes[0].expression.expression.tsonic = { role: "property-name", key: { kind: "text", value: "x" } };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("occurrence-role", 3, "typed occurrence does not retain its authored occurrence role"),
    nodeViolation("name-role-position", 3, "name role does not match its original syntactic position"),
    nodeViolation("typed-value-occurrence", 3, "authored value occurrence has no typed value endpoints"),
  ]);
});

test("a real value evidence index retains its exact qualified occurrence component", () => {
  const fixture = operationScenario();
  const component = { kind: "body", value: { body: bodyId, node: 3 } };
  const evidence = { ...typeEvidence({ kind: "known", category: "number" }), type: 1, component };
  fixture.body.evidence = [evidence];
  fixture.operand.tsonic.evidenceIndex = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  evidence.component = { kind: "body", value: { body: bodyId, node: 2 } };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("evidence-reference", 3,
    "value evidence does not retain its actual occurrence component")]);
});

for (const index of [-1, -0, 0.5, 1, Infinity]) {
  test(`a genuine invalid value evidence coordinate is not repaired: ${Object.is(index, -0) ? "-0" : index}`, () => {
    const fixture = operationScenario();
    fixture.operand.tsonic.evidenceIndex = index;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("evidence-reference", 3,
      "value evidence index and type do not select a present evidence record")]);
  });
}

test("body evidence ordering follows actual own-body occurrence order, not arbitrary type IDs", () => {
  const fixture = operationScenario();
  const at = node => ({ ...typeEvidence({ kind: "known", category: "number" }), type: 1,
    component: { kind: "body", value: { body: bodyId, node } } });
  fixture.body.evidence = [at(2), at(3)];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.body.evidence.reverse();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [bodyViolation("evidence-order",
    "evidence vector does not retain actual own-body occurrence order")]);
});

for (const mismatch of ["kind", "asynchronous", "thrown"]) {
  test(`a real spread protocol retains its supplied structural ${mismatch} fact`, () => {
    const fixture = argumentScenario("empty");
    const spread = fixture.body.root.statements.nodes[0].expression.arguments.nodes[0];
    const protocol = spread.tsonic.protocol.decision;
    if (mismatch === "kind") protocol.kind = "iterate";
    if (mismatch === "asynchronous") protocol.asynchronous = true;
    if (mismatch === "thrown") protocol.thrown = 2;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation(
      mismatch === "thrown" ? "protocol-thrown-unknown" : "protocol-total", 4,
      mismatch === "thrown" ? "protocol thrown channel is not the canonical intrinsic unknown type"
        : "selected protocol does not retain its actual authored kind and asynchrony")]);
  });
}

test("a protocol step retains its genuine bodyless API result without inventing required roles", () => {
  const fixture = argumentScenario("empty");
  const spread = fixture.body.root.statements.nodes[0].expression.arguments.nodes[0];
  const callee = fixture.body.root.statements.nodes[0].expression.tsonic.application.decision.callee;
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "library",
    declaration: callee.decision.api.declaration, bindings: emptyBindings() }, operands: [], result: 0,
    execution: { kind: "invocation", writesStorage: true, failure: "unwind" } } };
  spread.tsonic.protocol.decision.steps = [{ role: "next", operation, callee }];
  replaceScopeInventory(fixture.input, Array.from({ length: 7 }, emptyScope));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  operation.decision.result = 2;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("protocol-total", 4,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
});

test("the saved protocol operation checks its own closed step results and canonical unknown", () => {
  const fixture = argumentScenario("empty");
  const call = fixture.body.root.statements.nodes[0].expression;
  const application = call.tsonic.application.decision.callee.decision;
  const identity = { kind: "protocol", protocol: "spread", asynchronous: false,
    steps: [{ role: "next", operation: { kind: "call", application }, operands: [5], result: 0 }],
    value: 2, completion: 0, yielded: null, sent: null, thrown: 0 };
  call.tsonic.operation = { kind: "decided", decision: { permissionScope: null,
    decision: { kind: "selected", operation: identity, operands: [], result: 0, execution: { kind: "pure" } } } };
  replaceScopeInventory(fixture.input, Array.from({ length: 6 }, emptyScope));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  identity.steps[0].result = 2;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("protocol-total", 2,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
  identity.steps[0].result = 0;
  identity.thrown = 2;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("protocol-thrown-unknown", 2,
    "protocol thrown channel is not the canonical intrinsic unknown type")]);
});

test("syntax wire bindings do not alias duplicate, negative-zero or nonfinite semantic NodeId payloads", () => {
  for (const identity of [0, -0, NaN, Infinity, -Infinity, 1.5, -3]) {
    const body = emptyModuleBody();
    body.root.id = identity;
    body.root.endOfFileToken.id = identity;
    body.root.endOfFileToken.parent = identity;
    const text = product.printTir(body);
    const spelling = Object.is(identity, -0) ? "-0" : Number.isNaN(identity) ? "NaN" :
      identity === Infinity ? "+Infinity" : identity === -Infinity ? "-Infinity" : String(identity);
    const authored = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("SourceFile(id=n:0", `SourceFile(id=n:${spelling}`)
      .replace("EndOfFile(id=n:1", `EndOfFile(id=n:${spelling}`)
      .replace("parent=n:0", `parent=n:${spelling}`);
    assertCompleteValue(text, authored, `complete wire vector for semantic ID ${spelling}`, sameWire);
    const parsed = product.parseTir(authored);
    assert.equal(parsed.kind, "parsed");
    assert.equal(Object.is(parsed.value.root.id, identity), true);
    assert.equal(Object.is(parsed.value.root.endOfFileToken.id, identity), true);
    assert.equal(Object.is(parsed.value.root.endOfFileToken.parent, identity), true);
    assertCompleteValue(parsed.value, body, "the complete malformed-semantic-ID value is preserved", compareCaseValues);
    assert.equal(parsed.value.root === parsed.value.root.endOfFileToken, false, "two actual objects stay distinct");
  }
});

for (const [identity, spelling] of [[0, "0"], [-0, "-0"], [NaN, "NaN"], [Infinity, "+Infinity"],
  [-Infinity, "-Infinity"], [1.5, "1.5"], [-3, "-3"]]) {
  test(`owner-published local/type/signature identities retain the complete number domain: ${spelling}`, () => {
    const body = emptyModuleBody();
    body.signature = identity;
    body.completion = identity;
    body.yielded = identity;
    body.sent = identity;
    body.locals = [{ id: identity, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "value",
      role: "binding", capturedFrom: null, mutable: false, storage: identity }];
    const local = `TirLocal(id=l:${spelling}, declaration=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), ` +
      `name="value", role="binding", capturedFrom=null, mutable=false, storage=t:${spelling})`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("signature=sig:0, completion=t:0, yielded=null, sent=null",
        `signature=sig:${spelling}, completion=t:${spelling}, yielded=t:${spelling}, sent=t:${spelling}`)
      .replace("locals=[]", `locals=[${local}]`);
    assertCompleteValue(product.printTir(body), expected, "complete wire, without identity-domain repair", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire owner-published local/type/signature payload", compareCaseValues);
  });
}

for (const expansion of ["", "plain", "\u0000\uD800"]) {
  test(`owner-published expansion identity retains its complete string domain: ${JSON.stringify(expansion)}`, () => {
    const body = emptyModuleBody();
    body.root.origin.derived = [{ kind: "expansion", expansion }];
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace(`Origin(module=mod:"${moduleId}", start=0, length=0, derived=[])`,
        `Origin(module=mod:"${moduleId}", start=0, length=0, derived=[expansion(expansion=exp:${JSON.stringify(expansion)})])`);
    assertCompleteValue(product.printTir(body), expected, "complete independently authored expansion wire", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire expansion payload, no invented identity grammar", compareCaseValues);
  });
}

const completeEmptyWire = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
const invalidTextAt = (text, offset, expected, found) => {
  const prefix = text.slice(0, offset).split("\n");
  return { kind: "invalid-text", offset, line: prefix.length, column: prefix[prefix.length - 1].length + 1, expected, found };
};
const blockDeclarationWire = (id, children) => `n:${id}=Block(${syntaxHeaderWire(id, id === 0 ? null : id - 1)}, ` +
  `statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[${children.map(child => `n:${child}`).join(", ")}]), ` +
  "multiLine=false, tsonic=null)\n";
for (const root of [0, 9]) {
  test(`header stream error ends parsing without judging the pending root n:${root}`, () => {
    const text = completeEmptyWire.split("\n")[0].replace("root=n:0", `root=n:${root}`).replace("evidence=[]", "evidence=@");
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, text.indexOf("@"), ["record", "string", "number", "["], "@"));
  });
}
for (const target of [0, 9]) {
  for (const fault of ["lexical", "shape"]) {
    test(`a declaration ${fault} error outranks pending ${target === 0 ? "backward wrong-family" : "forward dangling"} target`, () => {
      const selected = fault === "lexical" ? "@" : '"Wrong"';
      const text = completeEmptyWire.replace("endOfFileToken=n:1", `endOfFileToken=n:${target}`)
        .replace('scriptKind="TS"', `scriptKind=${selected}`);
      const offset = text.indexOf("scriptKind=") + "scriptKind=".length;
      assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
        fault === "lexical" ? ["record", "string", "number", "["] : ["ScriptKind"], selected));
    });
  }
}
for (const target of [0, 9]) {
  test(`a late declaration stream fault outranks a pending ${target === 0 ? "backward cycle" : "forward dangling"} target`, () => {
    const text = completeEmptyWire.split("\n")[0] + "\n" + blockDeclarationWire(0, [target]) + "n:1=@";
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, text.indexOf("@"), ["record", "string", "number", "["], "@"));
  });
}
for (const children of [[0, 9], [9, 0]]) {
  test(`clean EOF chooses the first token among actual cycle/dangling references ${children.join("/")}`, () => {
    const text = completeEmptyWire.split("\n")[0] + "\n" + blockDeclarationWire(0, children);
    const offset = text.indexOf("nodes=[") + "nodes=[".length;
    const first = children[0];
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
      first === 0 ? ["acyclic syntax reference"] : ["declared syntax node"], `n:${first}`));
  });
}
for (const danglingFirst of [false, true]) {
  test(`clean EOF chooses the first token among wrong-family and dangling references, dangling first=${danglingFirst}`, () => {
    const child = danglingFirst ? 9 : 1;
    const end = danglingFirst ? 0 : 9;
    const text = completeEmptyWire.replace("nodes=[]", `nodes=[n:${child}]`).replace("endOfFileToken=n:1", `endOfFileToken=n:${end}`);
    const offset = text.indexOf("nodes=[") + "nodes=[".length;
    assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset,
      danglingFirst ? ["declared syntax node"] : ["Statement"], `n:${child}`));
  });
}
test("wrong-family wins an actual same-token child-cycle tie", () => {
  const text = completeEmptyWire.replace("endOfFileToken=n:1", "endOfFileToken=n:0");
  const offset = text.indexOf("endOfFileToken=") + "endOfFileToken=".length;
  assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset, ["EndOfFile"], "n:0"));
});
test("clean EOF reports the first text-prefix cycle closure, not the first DFS backedge", () => {
  const text = completeEmptyWire.split("\n")[0] + "\n" + blockDeclarationWire(0, [1]) +
    blockDeclarationWire(1, [2, 0]) + blockDeclarationWire(2, [0]);
  const offset = text.indexOf("nodes=[n:2, n:0]") + "nodes=[n:2, ".length;
  assertCompleteValue(product.parseTir(text), invalidTextAt(text, offset, ["acyclic syntax reference"], "n:0"));
});
for (const [prefix, identity] of [["mod", moduleId], ["def", ownerId], ["body", bodyId]]) {
  test(`declaring-owner decoding rejects a malformed ${prefix} identity before typed publication`, () => {
    const original = `${prefix}:${JSON.stringify(identity)}`;
    const malformed = `${prefix}:"invalid"`;
    const input = completeEmptyWire.replace(original, malformed);
    const offset = completeEmptyWire.indexOf(original);
    const lines = input.slice(0, offset).split("\n");
    assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
      column: lines[lines.length - 1].length + 1, expected: [prefix], found: malformed });
    const parsed = product.parseTir(completeEmptyWire);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, emptyModuleBody(), "entire corrected owner-published body", compareCaseValues);
  });
}

for (const [name, suffix, relativeOffset, expected, found] of [
  ["wrong declaration prefix", "other", 0, ["n"], "other"],
  ["missing declaration colon", "n=", 1, [":"], "="],
  ["missing declaration equals", "n:2", 3, ["="], null],
  ["duplicate declaration", "n:0=", 2, ["unique wire binding"], "0"],
  ["non-dense declaration", "n:3=", 2, ["wire traversal position"], "3"],
  ["negative-zero declaration", "n:-0=", 2, ["wire traversal position"], "-0"],
  ["nonfinite declaration", "n:NaN=", 2, ["wire traversal position"], "NaN"],
  ["wrong declaration value kind", "n:null=", 2, ["wire traversal position"], "null"],
  ["missing declaration ordinal", "n:", 2, ["wire traversal position"], null],
  ["unreachable declared node", `n:2=EndOfFile(${syntaxHeaderWire(2, null)}, tsonic=null)`, 2, ["wire traversal position"], "2"],
]) {
  test(`complete wire-binding failure: ${name}`, () => {
    assertCompleteValue(product.parseTir(completeEmptyWire + suffix), { kind: "invalid-text",
      offset: completeEmptyWire.length + relativeOffset, line: 4, column: relativeOffset + 1, expected, found });
  });
}
test("record separators require the actual newline even when every earlier wire reference is defined", () => {
  const prefix = completeEmptyWire.slice(0, -1);
  assertCompleteValue(product.parseTir(prefix + "n:2="), { kind: "invalid-text", offset: prefix.length,
    line: 3, column: prefix.length - prefix.lastIndexOf("\n"), expected: ["newline"], found: "n" });
});
for (const [name, selected, expected] of [
  ["unresolved root", "n:2", ["declared syntax node"]],
  ["wrong root family", "n:1", ["BodyRoot"]],
]) {
  test(`the actual earlier ${name} reference wins over later declaration positions`, () => {
    const frame = completeEmptyWire.slice(0, completeEmptyWire.indexOf("root=")) + "root=";
    const text = frame + selected + completeEmptyWire.slice(frame.length + 3);
    assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset: frame.length, line: 1,
      column: frame.length + 1, expected, found: selected });
  });
}
for (const [name, selected, expected] of [
  ["unresolved child", "n:9", ["declared syntax node"]],
  ["wrong child family", "n:0", ["EndOfFile"]],
]) {
  test(`the actual earlier ${name} retains its exact owning field coordinate`, () => {
    const position = completeEmptyWire.indexOf("endOfFileToken=") + "endOfFileToken=".length;
    const text = completeEmptyWire.slice(0, position) + selected + completeEmptyWire.slice(position + 3);
    assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset: position, line: 2,
      column: position - completeEmptyWire.lastIndexOf("\n", position), expected, found: selected });
  });
}
test("declared syntax identity preserves legal shared children without inline-value expansion", () => {
    const body = emptyModuleBody();
    const root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
    const child = { ...header(1, 0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
    root.statements.nodes.push(child, child);
    body.root = root;
    const expected = completeEmptyWire.split("\n")[0] + "\n" +
      `n:0=Block(${headerWire}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:1, n:1]), multiLine=false, tsonic=null)\n` +
      `n:1=Block(${syntaxHeaderWire(1, 0)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), multiLine=false, tsonic=null)\n`;
    assertCompleteValue(product.printTir(body), expected, "entire independently authored identity graph wire", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire declared graph, including every body/header field", isDeepStrictEqual);
    assert.equal(parsed.value.root.statements.nodes[0] === parsed.value.root.statements.nodes[1], true);
});

test("actual child cycles fail both typed ports at the child path and text at its prefix-closing reference", () => {
  const body = emptyModuleBody();
  const root = { ...header(0), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  root.statements.nodes.push(root);
  body.root = root;
  assert.throws(() => product.printTir(body), { name: "TypeError",
    message: 'ir-tir: syntax cycle at $syntax["statements"]["nodes"][0]' });
  assert.throws(() => product.verifyTir(emptyVerificationInput(body), body), { name: "TypeError",
    message: 'ir-tir: syntax cycle at $body["root"]["statements"]["nodes"][0]' });
  const text = completeEmptyWire.split("\n")[0] + "\n" +
    `n:0=Block(${headerWire}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[n:0]), multiLine=false, tsonic=null)\n`;
  const offset = text.indexOf("nodes=[n:0]") + "nodes=[".length;
  assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 2,
    column: offset - text.lastIndexOf("\n", offset), expected: ["acyclic syntax reference"], found: "n:0" });
});

test("layered legal sharing has one complete arena declaration and verification visit per actual node", () => {
  const depth = 128;
  const fixture = layeredSyntaxScenario(depth);
  const lines = completeEmptyWire.trimEnd().split("\n");
  const expected = lines[0] + "\n" + lines[1].replace("nodes=[]", "nodes=[n:1]")
    .replace("endOfFileToken=n:1", `endOfFileToken=n:${depth + 1}`) + "\n" +
    Array.from({ length: depth }, (_, position) => {
      const id = position + 1;
      const children = id === depth ? "[]" : `[n:${id + 1}, n:${id + 1}]`;
      return `n:${id}=Block(${syntaxHeaderWire(id, id - 1)}, statements=NodeList(loc=TextRange(pos=0, end=0), ` +
        `nodes=${children}), multiLine=false, tsonic=null)\n`;
    }).join("") + `n:${depth + 1}=EndOfFile(${syntaxHeaderWire(depth + 1, 0)}, tsonic=null)\n`;
  assertCompleteValue(product.printTir(fixture.body), expected, "complete source-sized128-node shared arena wire", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  for (let level = 0, node = parsed.value.root.statements.nodes[0]; level < depth - 1; level++) {
    assert.equal(node.statements.nodes[0] === node.statements.nodes[1], true, `shared arena identity at${level}`);
    node = node.statements.nodes[0];
  }
  const normalizeRoot = root => ({ ...root, statements: { ...root.statements, nodes: root.statements.nodes.map(node => node.id) } });
  assertCompleteValue({ ...parsed.value, root: normalizeRoot(parsed.value.root) },
    { ...fixture.body, root: normalizeRoot(fixture.body.root) }, "complete body/root fields and root child identities", compareCaseValues);
  for (let level = 0, node = parsed.value.root.statements.nodes[0]; level < depth; level++) {
    assertCompleteValue(normalizeRoot(node), normalizeRoot(fixture.typed[level]), `entire arena node${level}`, compareCaseValues);
    node = node.statements.nodes[0];
  }
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("shared syntax uses first arena order for complete evidence vectors, never last incoming edge order", () => {
  const fixture = siblingIdentityScenario(false, false);
  fixture.body.root.statements.nodes.push(fixture.firstTyped);
  fixture.input.source.tree.statements.nodes.push(fixture.input.source.tree.statements.nodes[0]);
  const at = node => ({ ...typeEvidence({ kind: "dynamic" }), component: { kind: "body", value: { body: bodyId, node } } });
  fixture.body.evidence = [at(1), at(2)];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.body.evidence.reverse();
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [bodyViolation("evidence-order",
    "evidence vector does not retain actual own-body occurrence order")]);
});

const beforeSignature = `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(), ` +
  'lexicalBindings=BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[]), ' +
  'dependence="parametric", signature=sig:';
for (const [name, text, offset, expected, found] of [
  ["bare-minus", 'TirBody(body=body:"' + bodyId + '", owner=def:"' + ownerId + '", bindings=parametric(), ' +
    'lexicalBindings=BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[]), ' +
    'dependence="parametric", signature=sig:-)', beforeSignature.length, ["number"], "-"],
  ["numeric-identity-array", beforeSignature + "[]", beforeSignature.length, ["number"], "["],
  ["numeric-identity-eof", beforeSignature, beforeSignature.length, ["identity number"], null],
  ["string-identity-number", "TirBody(body=body:1)", 18, ["string"], "1"],
  ["string-identity-eof", "TirBody(body=body:", 18, ["identity string"], null],
  ["identity-colon", "TirBody(body=body=0)", 17, [":"], "="],
  ["opening-record", "TirBody[", 7, ["("], "["],
  ["first-token-fault", "?", 0, ["record", "string", "number", "["], "?"],
  ["field-name-eof", `TirBody(body=body:"${bodyId}",`, `TirBody(body=body:"${bodyId}",`.length, ["field name"], null],
  ["separator-eof", `TirBody(body=body:"${bodyId}"`, `TirBody(body=body:"${bodyId}"`.length, [",", ")"], null],
  ["zero-field-close-eof", `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(`,
    `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", bindings=parametric(`.length, [")"], null],
]) {
  test(`F4 exact complete lexical/framing result ${name}`, () => assertInvalidText(text, offset, expected, found));
}
const beforeParams = beforeSignature + '0, completion=t:0, yielded=null, sent=null, params=';
const completeParameter = `TirParam(local=l:0, declaration=def:"${ownerId}", role="required", passing="by-value", initializer=null, storage=t:0)`;
const firstPositionCases = [
  ["empty", "", 0, ["value"], null],
  ["missing-first-field", "TirBody(", 8, ["body"], null],
  ["missing-value", "TirBody(body=", 13, ["value"], null],
  ["earlier-type-later-eof", "TirBody(body=null", 13, ["body"], "null"],
  ["earlier-type-later-comma", "TirBody(body=null,", 13, ["body"], "null"],
  ["earlier-type-later-bracket", "TirBody(body=[", 13, ["body"], "["],
  ["earlier-type-later-element", "TirBody(body=[null", 13, ["body"], "["],
  ["earlier-type-later-trailing-comma", "TirBody(body=[null,])", 13, ["body"], "["],
  ["missing-identity-string", "TirBody(body=body:)", 18, ["identity string"], ")"],
  ["wrong-root", "Other()", 0, ["TirBody"], "Other"],
  ["scalar-root", "null", 0, ["TirBody"], "null"],
  ["array-root", "[]", 0, ["TirBody"], "["],
  ["missing-body", "TirBody()", 8, ["body"], ")"],
  ["wrong-first-field", "TirBody(owner=null)", 8, ["body"], "owner"],
  ["wrong-field-before-escape", 'TirBody(owner="\\q")', 8, ["body"], "owner"],
  ["wrong-root-before-escape", 'Other(owner="\\q")', 0, ["TirBody"], "Other"],
  ["wrong-type-before-escape", 'TirBody(body="\\q")', 13, ["body"], '"'],
  ["escape-before-later-field", 'TirBody(body=body:"\\q", owner=null)', 20, ["JSON escape"], "q"],
  ["unicode-before-later-field", 'TirBody(body=body:"\\u0q00", owner=null)', 21, ["four hexadecimal digits"], "0q00"],
  ["string-eof", 'TirBody(body=body:"unterminated)', 32, ['"'], null],
  ["number-before-later-field", beforeSignature + '1.0, owner=null)', beforeSignature.length, ["canonical number"], "1.0"],
  ["number-overflow-before-eof", beforeSignature + '1e999', beforeSignature.length, ["canonical number"], "1e999"],
  ["bigint-negative-zero", beforeSignature + '-0n)', beforeSignature.length, ["canonical bigint"], "-0n"],
  ["invalid-character", "TirBody(body=@)", 13, ["record", "string", "number", "["], "@"],
  ["missing-equals", "TirBody(body)", 12, ["="], ")"],
  ["missing-field-name", "TirBody(=null)", 8, ["field name"], "="],
  ["earlier-type-later-missing-comma", "TirBody(body=null owner=null)", 13, ["body"], "null"],
  ["earlier-type-later-empty-field", "TirBody(body=null,)", 13, ["body"], "null"],
  ["array-eof", beforeParams + '[', beforeParams.length + 1, ["value", "]"], null],
  ["array-element-before-eof", beforeParams + '[null', beforeParams.length + 1, ["TirParam"], "null"],
  ["array-closed-record-before-eof", beforeParams + '[' + completeParameter, beforeParams.length + completeParameter.length + 1, [",", "]"], null],
  ["array-trailing-comma", beforeParams + '[' + completeParameter + ',])', beforeParams.length + completeParameter.length + 2, ["TirParam"], "]"],
];
for (const [name, text, offset, expected, found] of firstPositionCases) {
  test(`first actual lexical/frame/typed error: ${name}`, () => {
    assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 1, column: offset + 1, expected, found });
  });
}

const beforeArtifact = `TirBody(body=body:"${bodyId}", owner=def:"${ownerId}", `;
const beforeVector = beforeArtifact + 'bindings=instantiated(bindings=BindingVector(classBindings=[], ';
const afterVectorFields = beforeVector + 'methodBindings=[], capturedBindings=[], selfBindings=[], ';
const beforeZeroFields = beforeArtifact + 'bindings=parametric(';
const fieldNameCases = [
  ["complete unquoted duplicate", beforeVector, "classBindings=[]", 0, ["unique record field"], "classBindings"],
  ["complete quoted duplicate", beforeVector, '"classBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["unterminated duplicate prefix", beforeVector, '"cl', 1, ["methodBindings"], "c"],
  ["later duplicate-prefix lexical failure", beforeVector, '"cl\\q', 1, ["methodBindings"], "c"],
  ["escaped complete duplicate", beforeVector, '"\\u0063lassBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["escaped unterminated duplicate prefix", beforeVector, '"\\u0063l', 1, ["methodBindings"], "c"],
  ["escaped duplicate prefix before later escape", beforeVector, '"\\u0063l\\q', 1, ["methodBindings"], "c"],
  ["unquoted nonduplicate prefix", beforeVector, "cl", 0, ["methodBindings"], "cl"],
  ["unquoted proper prefix", beforeVector, "meth", 4, ["methodBindings"], "meth"],
  ["quoted proper prefix", beforeVector, '"meth"', 5, ["methodBindings"], "meth"],
  ["empty next name", beforeVector, '""', 1, ["methodBindings"], ""],
  ["lexical failure before any deviation", beforeVector, '"\\q', 2, ["JSON escape"], "q"],
  ["matching prefix before lexical failure", beforeVector, '"me\\q', 4, ["JSON escape"], "q"],
  ["matching prefix before bad hexadecimal", beforeVector, '"me\\u0q00', 5, ["four hexadecimal digits"], "0q00"],
  ["matching prefix before missing quote", beforeVector, '"meth', 5, ['"'], null],
  ["common-prefix complete duplicate", beforeArtifact, "body=", 1, ["unique record field"], "body"],
  ["common-prefix quoted duplicate", beforeArtifact, '"body"=', 2, ["unique record field"], "body"],
  ["common-prefix escaped deviation", beforeArtifact, '"b\\u006fdy"=', 2, ["unique record field"], "body"],
  ["common-prefix incomplete deviation", beforeArtifact, '"bo', 2, ["bindings"], "o"],
  ["common-prefix deviation beats later escape", beforeArtifact, '"bo\\q', 2, ["bindings"], "o"],
  ["unquoted extra after all fields", afterVectorFields, "extra=0", 0, ["end of record"], "extra"],
  ["complete quoted extra after all fields", afterVectorFields, '"extra"=0', 1, ["end of record"], "extra"],
  ["unterminated quoted extra after all fields", afterVectorFields, '"extra', 1, ["end of record"], "e"],
  ["malformed quoted extra after all fields", afterVectorFields, '"extra\\q', 1, ["end of record"], "e"],
  ["escaped complete extra after all fields", afterVectorFields, '"\\u0065xtra"=0', 1, ["end of record"], "extra"],
  ["escaped unfinished extra after all fields", afterVectorFields, '"\\u0065xtra', 1, ["end of record"], "e"],
  ["complete duplicate after all fields", afterVectorFields, '"classBindings"=[]', 1, ["unique record field"], "classBindings"],
  ["unquoted duplicate after all fields", afterVectorFields, "classBindings=[]", 0, ["unique record field"], "classBindings"],
  ["empty quoted extra after all fields", afterVectorFields, '""=0', 1, ["end of record"], ""],
  ["zero-field record complete extra", beforeZeroFields, '"extra"=0', 1, ["end of record"], "extra"],
  ["zero-field record unfinished extra", beforeZeroFields, '"extra', 1, ["end of record"], "e"],
  ["zero-field record escaped extra", beforeZeroFields, '"\\u0065xtra', 1, ["end of record"], "e"],
  ["zero-field record empty extra", beforeZeroFields, '""', 1, ["end of record"], ""],
  ["implicit label is not an already given field", beforeZeroFields, "kind=", 0, ["end of record"], "kind"],
  ["unquoted exceptional number is still a name token", beforeVector, "NaN=", 0, ["methodBindings"], "NaN"],
];
for (const [name, prefix, suffix, relativeOffset, expected, found] of fieldNameCases) {
  test(`C2939/C2940 full field-position result: ${name}`, () => {
    const offset = prefix.length + relativeOffset;
    assertCompleteValue(product.parseTir(prefix + suffix), { kind: "invalid-text", offset, line: 1, column: offset + 1, expected, found });
  });
}

for (const name of ['"classBindings"', '"\\u0063lassBindings"']) {
  test(`well-formed decoded required name ${name} retains the complete declared body`, () => {
    const baseline = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
    const text = baseline.replace("classBindings=[]", `${name}=[]`);
    const parsed = product.parseTir(text);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, emptyModuleBody(), undefined, compareCaseValues);
    assertCompleteValue(product.printTir(parsed.value), baseline, undefined, sameWire);
  });
}

test("first-position offsets use actual UTF16 line and column", () => {
  assertCompleteValue(product.parseTir("\n\tTirBody()"), { kind: "invalid-text", offset: 10, line: 2, column: 10,
    expected: ["body"], found: ")" });
});

for (const [name, value, quoted] of [
  ["escapes", '"\\/\b\f\n\r\t', '"\\\"\\\\/\\b\\f\\n\\r\\t"'],
  ["lone-surrogates", '\ud800x\udc00', '"\\ud800x\\udc00"'],
  ["surrogate-pair", '😀', '"😀"'],
]) {
  test(`the complete UTF16 ${name} value has its independently authored wire spelling`, () => {
    const body = emptyModuleBody();
    body.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: value,
      role: "binding", capturedFrom: null, mutable: false, storage: 0 }];
    const local = `TirLocal(id=l:0, declaration=body(value=NodeRef(body=body:"${bodyId}", node=n:0)), ` +
      `name=${quoted}, role="binding", capturedFrom=null, mutable=false, storage=t:0)`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("locals=[]", `locals=[${local}]`);
    assertCompleteValue(product.printTir(body), expected, name, sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire decoded value, not one escaped character", compareCaseValues);
  });
}

for (const kind of ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]) {
  test(`ordinary named Pragma keeps its declared kind field and all dynamic keys: ${kind}`, () => {
    const body = emptyModuleBody();
    const keys = ["plain", "with-hyphen", "true", "false", "null", "NaN", "contains space", "__proto__"];
    const argument = { pos: 0, end: 0, name: "input", value: "v" };
    body.root.pragmas = [{ pos: 0, end: 0, kind, hasTrailingNewLine: false, name: "sample",
      args: keys.toSorted().map(name => ({ name, value: argument })) }];
    const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const names = ['NaN', '__proto__', '"contains space"', 'false', 'null', 'plain', 'true', '"with-hyphen"'];
    const pragmaWire = `Pragma(pos=0, end=0, kind="${kind}", hasTrailingNewLine=false, name="sample", ` +
      `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${pragmaWire}]`);
    assertCompleteValue(product.printTir(body), expected, "the full named-record kind and dictionary vector are authored before execution", sameWire);
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, undefined, compareCaseValues);
  });
}

for (const reversed of [false, true]) {
  test(`pragma dictionary canonical UTF-16 order ignores insertion order: reversed=${reversed}`, () => {
    const body = emptyModuleBody();
    const keys = ["\uE000", "\u{10000}", "b", "aa", "a", ""];
    const argument = { pos: 0, end: 0, name: "input", value: "v" };
    body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sample",
      args: (reversed ? keys.slice().reverse() : keys).map(name => ({ name, value: argument })) }];
    const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const names = ['""', 'a', 'aa', 'b', '"\u{10000}"', '"\uE000"'];
    const pragma = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
      `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))`;
    const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${pragma}]`);
    assertCompleteValue(product.printTir(body), expected, "entire independently authored UTF-16 dictionary order", sameWire);
    body.root.pragmas[0].args = keys.toSorted().map(name => ({ name, value: argument }));
    const parsed = product.parseTir(expected);
    assert.equal(parsed.kind, "parsed");
    assertCompleteValue(parsed.value, body, "entire dictionary including the empty key and surrogate pair", compareCaseValues);
  });
}

for (const [key, decoded, first, previous = "b"] of [['a', 'a', 0], ['"a"', 'a', 1],
  ['"\\u0061"', 'a', 1], ['""', '', 1], ['"a"', 'a', 1, 'aa']]) {
  for (const laterLexicalError of [false, true]) {
    test(`pragma dictionary rejects key ${key} after ${previous}, later lexical error=${laterLexicalError}`, () => {
      const argument = { pos: 0, end: 0, name: "input", value: "v" };
      const argumentWire = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
      const before = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
        `args=PragmaArguments(${previous}=${argumentWire}, `;
      const pragma = before + key + '=' + (laterLexicalError ? '@' : argumentWire) + '))';
      const input = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
        .replace("pragmas=[]", `pragmas=[${pragma}]`);
      const offset = input.indexOf(before) + before.length + first;
      const lines = input.slice(0, offset).split("\n");
      assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
        column: lines[lines.length - 1].length + 1, expected: ["UTF-16 ordered dictionary key"], found: decoded });
      const body = emptyModuleBody();
      body.root.pragmas = [{ pos: 0, end: 0, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sample",
        args: [decoded, previous].toSorted().map(name => ({ name, value: argument })) }];
      const names = decoded === "" ? ['""', previous] : ['a', previous];
      const corrected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
        .replace("pragmas=[]", 'pragmas=[Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
          `args=PragmaArguments(${names.map(name => `${name}=${argumentWire}`).join(", ")}))]`);
      const parsed = product.parseTir(corrected);
      assert.equal(parsed.kind, "parsed");
      assertCompleteValue(parsed.value, body, "complete corrected dictionary, not one key", compareCaseValues);
      assertCompleteValue(product.printTir(parsed.value), corrected, "complete corrected canonical text", sameWire);
    });
  }
}

for (const key of ['"a\\q"', '"\\u0061\\q"']) {
  test(`an already out-of-order pragma key precedes its own later lexical failure: ${key}`, () => {
    const argument = 'PragmaArgument(pos=0, end=0, name="input", value="v")';
    const before = 'Pragma(pos=0, end=0, kind="SingleLineCommentTrivia", hasTrailingNewLine=false, name="sample", ' +
      `args=PragmaArguments(b=${argument}, `;
    const input = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
      .replace("pragmas=[]", `pragmas=[${before}${key}=${argument}))]`);
    const offset = input.indexOf(before) + before.length + 1;
    const lines = input.slice(0, offset).split("\n");
    assertCompleteValue(product.parseTir(input), { kind: "invalid-text", offset, line: lines.length,
      column: lines[lines.length - 1].length + 1, expected: ["UTF-16 ordered dictionary key"], found: "a" });
  });
}

for (const name of ["params", "evidence", "syntax"]) {
  test(`a genuine sparse ${name} vector is an exact-path caller defect in both public ports`, () => {
    const body = emptyModuleBody();
    if (name === "syntax") body.root.statements.nodes = Array(1);
    else body[name] = Array(1);
    const printPath = name === "syntax" ? '$syntax["statements"]["nodes"][0]' : `$body["${name}"][0]`;
    const verifyPath = name === "syntax" ? '$body["root"]["statements"]["nodes"][0]' : `$body["${name}"][0]`;
    assert.throws(() => product.printTir(body), { name: "TypeError", message: `ir-tir: sparse vector at ${printPath}` });
    assert.throws(() => product.verifyTir(emptyVerificationInput(body), body),
      { name: "TypeError", message: `ir-tir: sparse vector at ${verifyPath}` });
  });
}

test("100000 actual inline CategoryEvidence layers print and parse without host-stack recursion or textual refusal", () => {
  const body = emptyModuleBody();
  let category = { kind: "dynamic" };
  for (let depth = 0; depth < 100000; depth++) category = { kind: "choice", alternatives: [category] };
  body.evidence = [typeEvidence(category)];
  const categoryWire = `${"choice(alternatives=[".repeat(100000)}dynamic()${"])".repeat(100000)}`;
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("evidence=[]", `evidence=[${evidenceText(categoryWire)}]`);
  assertCompleteValue(product.printTir(body), expected, "the entire deep wire has an independently authored frame at every level", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "the entire 100000-layer typed value is retained", compareCaseValues);
  assertCompleteValue(product.verifyTir(emptyVerificationInput(body), body), [], "the same complete 100000-layer value is verified without recursion or refusal");
});

test("C2931 actual inline cycles throw with their exact path while inline aliases are encoded by value", () => {
  const alternatives = [];
  const cycle = { kind: "choice", alternatives };
  alternatives.push(cycle);
  const cyclicBody = emptyModuleBody();
  cyclicBody.evidence = [typeEvidence(cycle)];
  assert.throws(() => product.printTir(cyclicBody), { name: "TypeError",
    message: 'ir-tir: inline cycle at $body["evidence"][0]["category"]["alternatives"][0]' });
  assert.throws(() => product.verifyTir(emptyVerificationInput(cyclicBody), cyclicBody), { name: "TypeError",
    message: 'ir-tir: inline cycle at $body["evidence"][0]["category"]["alternatives"][0]' });
  const shared = { kind: "choice", alternatives: [{ kind: "dynamic" }] };
  const body = emptyModuleBody();
  body.evidence = [typeEvidence(shared), typeEvidence(shared)];
  const inline = evidenceText("choice(alternatives=[dynamic()])");
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("evidence=[]", `evidence=[${inline}, ${inline}]`);
  assertCompleteValue(product.printTir(body), expected, "shared inline records are each encoded by value", sameWire);
  const parsed = product.parseTir(expected);
  assert.equal(parsed.kind, "parsed");
  assertCompleteValue(parsed.value, body, "complete inline values agree independently of allocation", compareCaseValues);
  assert.equal(parsed.value.evidence[0].category === parsed.value.evidence[1].category, false,
    "inline identity is not an arena identity or hidden second wire reference");
  assertCompleteValue(product.verifyTir(emptyVerificationInput(body), body), [], "shared inline values are each visited without being mistaken for a cycle");
});

test("every TypedString role retains the full closed record and exact UTF16/lone-surrogate payload", () => {
  const text = 'x\ud800\udfff😀\u0000\n"\\';
  const fields = { text, tokenFlags: ["SingleQuote", "UnicodeEscape"] };
  const fieldsWire = `text=${JSON.stringify(text)}, tokenFlags=["SingleQuote", "UnicodeEscape"]`;
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: text }, `TypedString(${valueWire}, role="value", value=${JSON.stringify(text)})`],
    [{ role: "property-name", key: { kind: "text", value: text } }, `TypedString(role="property-name", key=text(value=${JSON.stringify(text)}))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId } },
      `TypedString(role="declaration-name", declaration=definition(definition=def:"${ownerId}"))`],
    [{ role: "type-literal", type: 0 }, 'TypedString(role="type-literal", type=t:0)'],
    [{ role: "module-specifier", target: { target: "project", module: moduleId } },
      `TypedString(role="module-specifier", target=ImportTarget(target="project", module=mod:"${moduleId}"))`],
    [{ role: "export-name", definition: ownerId }, `TypedString(role="export-name", definition=def:"${ownerId}")`],
    [{ role: "attribute-value", value: text }, `TypedString(role="attribute-value", value=${JSON.stringify(text)})`],
  ]) assertExpressionRoundTrip("StringLiteral", fields, fieldsWire, phase, wire);
});

test("every TypedName arm and every resolution discriminant is distinct and fully framed", () => {
  const fields = { text: "name" };
  for (const [resolution, wire] of [
    [{ kind: "local", local: { body: bodyId, local: 0 } }, `local(local=${localWire})`],
    [{ kind: "definition", definition: ownerId, aliases: [ownerId] }, `definition(definition=def:"${ownerId}", aliases=[def:"${ownerId}"])`],
    [{ kind: "module", target: { target: "project", module: moduleId } }, `module(target=ImportTarget(target="project", module=mod:"${moduleId}"))`],
    [{ kind: "error", diagnostic: 0 }, "error(diagnostic=0)"],
  ]) assertExpressionRoundTrip("Identifier", fields, 'text="name"', { ...valueFact(), role: "value", resolution },
    `TypedName(${valueWire}, role="value", resolution=${wire})`);
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "shorthand-value", key: { kind: "text", value: "name" }, resolution: { kind: "local", local: { body: bodyId, local: 0 } } },
      `TypedName(${valueWire}, role="shorthand-value", key=text(value="name"), resolution=local(local=${localWire}))`],
    [{ role: "assignment-target", resolution: { kind: "local", local: { body: bodyId, local: 0 } }, access: { kind: "write", storage: 0 } },
      `TypedName(role="assignment-target", resolution=local(local=${localWire}), access=write(storage=t:0))`],
    [{ role: "assignment-target", resolution: { kind: "local", local: { body: bodyId, local: 0 } },
      access: { kind: "read-write", storage: 0, read: 0, narrowing: null, evidenceIndex: null } },
      `TypedName(role="assignment-target", resolution=local(local=${localWire}), access=read-write(storage=t:0, read=t:0, narrowing=null, evidenceIndex=null))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId }, storage: null },
      `TypedName(role="declaration-name", declaration=definition(definition=def:"${ownerId}"), storage=null)`],
    [{ role: "property-name", key: { kind: "symbol", declaration: ownerId } },
      `TypedName(role="property-name", key=symbol(declaration=def:"${ownerId}"))`],
    [{ role: "type-name", type: 0, declarations: [ownerId] }, `TypedName(role="type-name", type=t:0, declarations=[def:"${ownerId}"])`],
    [{ role: "label", target: { body: bodyId, node: 0 } }, `TypedName(role="label", target=NodeRef(body=body:"${bodyId}", node=n:0))`],
    [{ role: "private-name", declaration: ownerId }, `TypedName(role="private-name", declaration=def:"${ownerId}")`],
  ]) assertExpressionRoundTrip("Identifier", fields, 'text="name"', phase, wire);
});

test("all numeric and bigint roles preserve exact rationals and integers beyond host floating precision", () => {
  const rational = { numerator: 9007199254740993n, denominator: 11n, negativeZero: false };
  const exact = "ExactRational(numerator=9007199254740993n, denominator=11n, negativeZero=false)";
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: rational }, `TypedNumber(${valueWire}, role="value", value=${exact})`],
    [{ role: "property-name", key: { kind: "number", value: rational } }, `TypedNumber(role="property-name", key=number(value=${exact}))`],
    [{ role: "declaration-name", declaration: { kind: "local", local: { body: bodyId, local: 0 } } },
      `TypedNumber(role="declaration-name", declaration=local(local=${localWire}))`],
    [{ role: "type-literal", type: 0 }, 'TypedNumber(role="type-literal", type=t:0)'],
  ]) assertExpressionRoundTrip("NumericLiteral", { text: "9007199254740993", tokenFlags: ["ContainsSeparator"] },
    'text="9007199254740993", tokenFlags=["ContainsSeparator"]', phase, wire);
  for (const [phase, wire] of [
    [{ ...valueFact(), role: "value", value: -9007199254740993n }, `TypedBigInt(${valueWire}, role="value", value=-9007199254740993n)`],
    [{ role: "property-name", key: { kind: "number", value: rational } }, `TypedBigInt(role="property-name", key=number(value=${exact}))`],
    [{ role: "declaration-name", declaration: { kind: "definition", definition: ownerId } },
      `TypedBigInt(role="declaration-name", declaration=definition(definition=def:"${ownerId}"))`],
    [{ role: "type-literal", type: 0 }, 'TypedBigInt(role="type-literal", type=t:0)'],
  ]) assertExpressionRoundTrip("BigIntLiteral", { text: "-9007199254740993n", tokenFlags: [] },
    'text="-9007199254740993n", tokenFlags=[]', phase, wire);
});

for (const holder of ["property-access", "element-access", "property", "shorthand"]) {
  test(`deferred ${holder} makes no selected-member query`, () => {
    const fixture = memberScenario(holder);
    const root = fixture.body.root.statements.nodes[0].expression;
    const actual = holder === "property" || holder === "shorthand" ? root.properties.nodes[0].tsonic : root.tsonic;
    const deferred = { kind: "deferred", deferred: { result: 0, invocation: { rule: "member", input: {
      context: { occurrence: { body: bodyId, node: fixture.memberNode }, origin: origin(), bindings: emptyBindings() },
      receiver: { ...typeEvidence({ kind: "dynamic" }), type: 1,
        component: { kind: "body", value: { body: bodyId, node: 3 } } },
      key: { kind: "text", value: "x" }, access: "read", origins: [],
    } } } };
    if (holder === "property" || holder === "shorthand") actual.member = deferred;
    else actual.selection = deferred;
    fixture.input.memberTableOf = () => { throw new Error("a deferred request has no selected member occurrence"); };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, []);
    deferred.deferred.invocation.input.context.occurrence.node = 0;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("deferred-parameters", fixture.memberNode,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  });
}

function attachActualGetter(fixture) {
  const definition = "D[M[P[api];surface];x-get]";
  const advertised = { declaration: definition, role: "advertised", signature: 1, body: null };
  const api = { declaration: definition, role: "api-signature", signature: 1, body: null };
  const foreignName = { ...header(0), origin: { module: "M[P[api];surface]", start: 0, length: 0, derived: [] },
    kind: "Identifier", text: "x-get",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  fixture.input.types.signatures.push({ id: 1, declaration: definition,
    owner: { kind: "item", value: { owner: definition, node: 0 } }, composition: null, kind: "call",
    typeParameters: [], receiver: 1, parameters: [], result: 0 });
  const originalNodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.owner === definition && reference.value.node === 0
    ? foreignName : originalNodeOf(reference);
  const originalDeclarationOf = fixture.input.declarationOf;
  fixture.input.declarationOf = actual => actual === definition ? { scope: emptyScope(), parameterCount: 0,
    endpoints: [advertised, api] } : originalDeclarationOf(actual);
  fixture.decision.getter = api;
  fixture.decision.location = { kind: "accessor" };
  fixture.selection.getter = { activation: null, captures: [], decision: { candidate: 0, advertised, api,
    bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [],
    completion: { signature: 1, completion: 0, yielded: null, sent: null }, result: 0, activation: null } };
  fixture.table.accessors = [{ origin: fixture.decision.origins[0], getter: definition, setter: null }];
  bodyScopes(fixture.input, fixture.body).push(emptyScope(), emptyScope());
  const source = fixture.input.source.tree.statements.nodes[0].expression.tsonic;
  if ("accessor" in source) source.accessor = available({ kind: "accessor-get", receiver: 3, arguments: [], typeArguments: [],
    candidates: { kind: "unavailable", reason: "not-provided" }, resolvedSignature: available(1) });
}

function assignmentMemberScenario(access) {
  const fixture = memberScenario("property-access");
  const member = fixture.body.root.statements.nodes[0].expression;
  const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
  member.parent = 10;
  sourceMember.parent = 10;
  member.tsonic = { role: "assignment-target", selection: { kind: "decided", decision: fixture.selection },
    access: access === "write" ? { kind: "write", storage: 0 } : { kind: "read-write", storage: 0,
      read: 0, narrowing: null, evidenceIndex: null } };
  sourceMember.tsonic = { core: emptyCore(), role: "assignment-target", views: checkerViews(0),
    place: { kind: "unavailable", reason: "not-provided" }, access, origins: sourceMember.tsonic.origins, accessor: available(null) };
  const value = { ...header(12, 10), kind: "StringLiteral", text: "assigned", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "assigned" } };
  const sourceValue = { ...header(12, 10), kind: "StringLiteral", text: "assigned", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(), literal: { kind: "string", value: "assigned" } } };
  const operator = { ...header(11, 10), kind: "EqualsToken", tsonic: null };
  const sourceOperator = { ...header(11, 10), kind: "EqualsToken", tsonic: null };
  const typed = { ...header(10, 1), kind: "BinaryExpression", modifiers: null, left: member, type: null,
    operatorToken: operator, right: value, tsonic: { ...typedValue(), role: "assignment", storage: 0, calculation: null, selection: null } };
  const original = { ...header(10, 1), kind: "BinaryExpression", modifiers: null, left: sourceMember, type: null,
    operatorToken: sourceOperator, right: sourceValue, tsonic: { core: emptyCore(), role: "assignment", value: checkedValue(),
      target: { kind: "unavailable", reason: "not-provided" } } };
  fixture.body.root.statements.nodes[0].expression = typed;
  fixture.input.source.tree.statements.nodes[0].expression = original;
  const nodeOf = fixture.input.nodeOf;
  const nodes = new Map([[10, original], [11, sourceOperator], [12, sourceValue]]);
  fixture.input.nodeOf = reference => reference.kind === "body" && reference.value.body === bodyId ||
    reference.kind === "item" && reference.value.owner === ownerId ? nodes.get(reference.value.node) ?? nodeOf(reference) : nodeOf(reference);
  return { ...fixture, member, sourceMember };
}

function attachActualSetter(fixture) {
  const definition = "D[M[P[api];surface];x-set]";
  const parameter = "D[M[P[api];surface];x-set/value]";
  const signature = fixture.input.types.signatures.length;
  const advertised = { declaration: definition, role: "advertised", signature, body: null };
  const api = { declaration: definition, role: "api-signature", signature, body: null };
  const name = { ...header(1), origin: { module: "M[P[api];surface]", start: 0, length: 0, derived: [] }, kind: "Identifier",
    text: "x-set", tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition } } };
  const parameterName = { ...header(2), origin: name.origin, kind: "Identifier", text: "value",
    tsonic: { core: emptyCore(), role: "declaration-name", declaration: { kind: "definition", definition: parameter } } };
  fixture.input.types.signatures.push({ id: signature, declaration: definition,
    owner: { kind: "item", value: { owner: definition, node: 1 } }, composition: null, kind: "call", typeParameters: [],
    receiver: 1, parameters: [{ declaration: parameter, kind: "required", type: 0, passing: "by-value", initializer: null }], result: 0 });
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.node === 1 && reference.value.owner === definition
    ? name : reference.kind === "item" && reference.value.node === 2 && reference.value.owner === parameter ? parameterName : nodeOf(reference);
  const declarationOf = fixture.input.declarationOf;
  fixture.input.declarationOf = selected => selected === definition ? { scope: emptyScope(), parameterCount: 1, endpoints: [advertised, api] }
    : selected === parameter ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : declarationOf(selected);
  fixture.decision.setter = api;
  fixture.decision.location = { kind: "accessor" };
  fixture.selection.setter = { activation: null, captures: [], decision: { candidate: 0, advertised, api,
    bindings: emptyBindings(), implementationBindings: emptyBindings(), parameters: [
      { kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }],
    completion: { signature, completion: 0, yielded: null, sent: null }, result: 0, activation: null } };
  fixture.table.accessors = [{ origin: fixture.decision.origins[0], getter: fixture.decision.getter?.declaration ?? null, setter: definition }];
  fixture.sourceMember.tsonic.accessor = available({ kind: "accessor-set", receiver: 3,
    arguments: [{ kind: "value", expression: 12 }], typeArguments: [],
    candidates: { kind: "unavailable", reason: "not-provided" }, resolvedSignature: available(signature) });
  bodyScopes(fixture.input, fixture.body).push(emptyScope(), emptyScope());
}

for (const holder of ["property-access", "element-access", "property", "shorthand"]) {
  test(`actual bodyless accessor endpoints are retained for ${holder}`, () => {
    const fixture = memberScenario(holder);
    attachActualGetter(fixture);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    fixture.selection.getter = null;
    bodyScopes(fixture.input, fixture.body).splice(-2);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("accessor-activation", fixture.memberNode,
      "selected accessor activation does not retain the actual member endpoint and access role")]);
  });
}

for (const holder of ["property-access", "element-access", "property", "shorthand", "pattern", "construction"]) {
  test(`authentic per-instance member occurrence: ${holder}`, () => {
    const fixture = memberScenario(holder);
    const expectedQueries = fixture.facts.map(fact => ({ instance: fact.instance, occurrence: fact.occurrence }));
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, expectedQueries);
  });
  for (const mismatch of ["instance", "ordinal", "absent", "empty-table"]) {
    test(`missing authentic member association: ${holder}/${mismatch}`, () => {
      const fixture = memberScenario(holder);
      if (mismatch === "instance") fixture.facts[0].instance.bindings = { kind: "instantiated", bindings: emptyBindings() };
      if (mismatch === "ordinal") fixture.facts[0].occurrence.ordinal = 1;
      if (mismatch === "absent") fixture.facts.length = 0;
      if (mismatch === "empty-table") {
        fixture.input.types.terms.push({ kind: "intrinsic", intrinsic: "object" });
        fixture.table.receiver = 2;
        fixture.table.members = [];
        if (holder === "property-access" || holder === "element-access") {
          const actualReceiver = fixture.body.root.statements.nodes[0].expression.expression;
          actualReceiver.tsonic.type = 2;
          actualReceiver.tsonic.convertedType = 2;
          fixture.input.source.tree.statements.nodes[0].expression.expression.tsonic.value.views.read = available(2);
        }
      }
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", fixture.memberNode,
        "member selection does not retain a real member key and its actual declared origins")]);
      assert.equal(fixture.queries.length, 1);
    });
  }
}

test("a conversion that carries a construction is refused, and its part and the node's own remain two distinct occurrences", () => {
  const fixture = memberScenario("construction", true);
  const expected = [0, 1].map(ordinal => ({ instance: { body: bodyId, bindings: { kind: "parametric" } },
    occurrence: { kind: "construction-part", node: 2, ordinal, source: { body: bodyId, node: 2 },
      destination: { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] }, part: 0 } }));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("conversion-operation", 2,
    "a conversion is carried out by the conversion identity, and a backed conversion by a core or library operation")]);
  assertCompleteValue(fixture.queries, expected);
});

for (const holder of ["calculation", "protocol", "disposal"]) {
  test(`actual ${holder} construction-part holders use the same canonical per-instance occurrence reader`, () => {
    const fixture = nestedPartScenario(holder);
    const expected = [{ instance: fixture.fact.instance, occurrence: fixture.fact.occurrence }];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    assertCompleteValue(fixture.queries, expected);
  });
  test(`actual ${holder} construction-part holders cannot reuse another operation's ordinal`, () => {
    const fixture = nestedPartScenario(holder);
    fixture.fact.occurrence.ordinal = 1;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", fixture.node.id,
      "member selection does not retain a real member key and its actual declared origins")]);
    assert.equal(fixture.queries.length, 1);
  });
}

for (const coordinate of ["source", "destination", "part"]) {
  test(`a construction member needs its complete authentic part association: ${coordinate}`, () => {
    const fixture = memberScenario("construction");
    if (coordinate === "source") fixture.facts[0].occurrence.source = { body: bodyId, node: 1 };
    if (coordinate === "destination") fixture.facts[0].occurrence.destination = {
      root: { kind: "body", value: { body: bodyId, node: 1 } }, path: [] };
    if (coordinate === "part") fixture.facts[0].occurrence.part = 1;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
  });
}

for (const flags of [[], ["Ambient"]]) {
  for (const multiLine of [false, true]) {
    test(`F1 complete Block flags=${flags.join("/")} multiLine=${multiLine}`, () => {
      const body = emptyModuleBody();
      body.root = { ...header(0), flags, kind: "Block", statements: nodeList(), multiLine, tsonic: null };
      const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8").split("\n")[0] +
        `\nn:0=Block(${syntaxHeaderWire(0, null, flags)}, statements=NodeList(loc=TextRange(pos=0, end=0), nodes=[]), ` +
        `multiLine=${multiLine}, tsonic=null)\n`;
      assertBodyRoundTrip(body, expected, "F1 entire declared Block");
      const text = expected.replace(`, multiLine=${multiLine}`, "");
      const offset = text.indexOf("tsonic=null", text.indexOf("n:0=Block("));
      assertCompleteValue(product.parseTir(text), { kind: "invalid-text", offset, line: 2,
        column: offset - text.lastIndexOf("\n", offset), expected: ["multiLine"], found: "tsonic" });
    });
  }
}

test("C2996 module node sites belong to the subject tree, not its conflicting publication label", () => {
  const fixture = bodylessModuleScenario();
  fixture.module.module = "M[P[p];other]";
  fixture.input.bindingScopesOf = target => target.kind === "module" && target.module === "M[P[p];other]" ? [] : null;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [nodeViolation("module-node-identity", 0,
    "module tree does not retain its actual source and publication identity")]);
  fixture.module.module = moduleId;
  fixture.input.bindingScopesOf = target => target.kind === "module" && target.module === moduleId ? [] : null;
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

test("C2996 another genuine module qualifies its own body subject and restored identity", () => {
  const module = "M[P[p];second]";
  const owner = "D[M[P[p];second]]";
  const identity = "B[D[M[P[p];second]];module;0]";
  const body = emptyModuleBody();
  body.body = identity;
  body.owner = owner;
  body.root.origin = { module, start: 0, length: 0, derived: [] };
  body.root.endOfFileToken.origin = { module, start: 0, length: 0, derived: [] };
  body.root.tsonic.module = module;
  body.root.tsonic.template.body = identity;
  const input = emptyVerificationInput(body);
  input.module.module = module;
  input.source.module = module;
  input.source.tree.origin = { module, start: 0, length: 0, derived: [] };
  input.source.tree.endOfFileToken.origin = { module, start: 0, length: 0, derived: [] };
  input.source.tree.tsonic.definition = owner;
  input.source.tree.tsonic.body = identity;
  input.source.items = [{ definition: owner, node: 0 }];
  input.source.bodies[0].body = identity;
  input.source.bodies[0].owner = owner;
  input.types.signatures[0].declaration = owner;
  input.types.signatures[0].owner = { kind: "body", value: { body: identity, node: 0 } };
  input.declarationOf = selected => selected === owner ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : null;
  input.nodeOf = reference => reference.kind === "body" && reference.value.body === identity ||
    reference.kind === "item" && reference.value.owner === owner ? reference.value.node === 0 ? input.source.tree :
      reference.value.node === 1 ? input.source.tree.endOfFileToken : null : null;
  assertCompleteValue(product.verifyTir(input, body), []);
  input.module.module = moduleId;
  assertCompleteValue(product.verifyTir(input, body), [{ rule: "module-node-identity",
    site: { kind: "node", module, node: 0 }, detail: [{ kind: "text",
      value: "body does not retain its module identity and canonical parametric subtree" }] }]);
  input.module.module = module;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const shape of ["ordinary-field", "flags", "sparse-flags", "directive", "inline-field"]) {
  test(`F4 complete supplied syntax shape ${shape}`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    if (shape === "ordinary-field") body.root.languageVariant = "JSX";
    if (shape === "flags" || shape === "sparse-flags") body.root.flags = ["Ambient"];
    if (shape === "sparse-flags") input.source.tree.flags = Array(1);
    if (shape === "directive") body.root.checkJsDirective = { enabled: true, range: { pos: 0, end: 0,
      kind: "SingleLineCommentTrivia", hasTrailingNewLine: false } };
    if (shape === "inline-field") body.root.statements = { ...body.root.statements, loc: { pos: 1, end: 0 } };
    assertCompleteValue(product.verifyTir(input, body), [nodeViolation("kind-children-shape", 0,
      "typed syntax does not retain the authored kind, fields and child presence")]);
    if (shape === "ordinary-field") body.root.languageVariant = "Standard";
    if (shape === "flags" || shape === "sparse-flags") body.root.flags = [];
    if (shape === "sparse-flags") input.source.tree.flags = [];
    if (shape === "directive") body.root.checkJsDirective = null;
    if (shape === "inline-field") body.root.statements = { ...body.root.statements, loc: { pos: 0, end: 0 } };
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

for (const record of ["SourceFile", "NodeList"]) test(`closed ${record} text rejects unknown fields at its actual declared boundary`, () => {
  const text = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const position = record === "SourceFile" ? text.indexOf("\nn:1=") - 1 : text.indexOf("nodes=[]") + "nodes=[]".length;
  const invalid = text.slice(0, position) + ", extra=1" + text.slice(position);
  assertInvalidText(invalid, position + 2, ["end of record"], "extra");
  assertBodyRoundTrip(emptyModuleBody(), text, `${record}: complete closed record positive`);
});

test("F4 absent authentic source body retains every complete publication cofinding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const original = input.source.bodies[0];
  input.source.bodies = [];
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("body-owner", "body identity and owner do not retain the actual original body"),
    bodyViolation("stable-order", "canonical template publication does not retain actual source body order"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    nodeViolation("nested-template-identity", 0, "typed template does not retain its real authored body and shared syntax identity"),
  ]);
  input.source.bodies = [original];
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const derived of [[{ kind: "expansion", expansion: "one" }], [{ kind: "lowering", pass: "elaborate" }]]) {
  test(`F4 equal-length ${derived[0].kind} identity retains the whole origin finding`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    input.source.tree.origin.derived = derived;
    body.root.origin.derived = derived[0].kind === "expansion" ? [{ kind: "expansion", expansion: "two" }]
      : [{ kind: "lowering", pass: "front" }];
    assertCompleteValue(product.verifyTir(input, body), [nodeViolation("origin-range", 0,
      "typed origin or lexical range does not retain the actual source interval")]);
    body.root.origin.derived = structuredClone(derived);
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

for (const family of ["terms", "signatures"]) {
  test(`F4 borrowed unused ${family} hole remains a genuine complete lower-table finding`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    input.types[family].length = 2;
    assertCompleteValue(product.verifyTir(input, body), [bodyViolation("type-closed",
      `type verifier: ${family === "terms" ? "type-reference" : "signature-reference"}`)]);
    input.types[family].length = 1;
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("F4 ITEM-qualified evidence keeps its actual source and complete BODY opposite", () => {
  const body = emptyModuleBody();
  body.evidence = [{ ...typeEvidence({ kind: "dynamic" }), component: { kind: "item", value: { owner: ownerId, node: 0 } } }];
  const input = emptyVerificationInput(body);
  assertCompleteValue(product.verifyTir(input, body), []);
  body.evidence[0].component = { kind: "body", value: { body: bodyId, node: 0 } };
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const shared of [false, true]) {
  test(`F4 shared evidence invalid occurrences retain ${shared ? "three" : "two"} complete findings`, () => {
    const fixture = deferredConversionScenario();
    const old = fixture.deferred.invocation.input.from;
    if (shared) old.type = 99;
    else fixture.deferred.invocation.input.from = { ...old, type: 99 };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
      nodeViolation("type-closed", 9, "typed reference does not reach a present closed type/signature graph"),
      nodeViolation("evidence-reference", 9, "type verifier: type-reference"),
      ...(shared ? [nodeViolation("evidence-reference", 9, "type verifier: type-reference")] : []),
    ]);
    old.type = 1;
    fixture.deferred.invocation.input.from = old;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const endpoint of ["advertised", "api"]) {
  test(`F4 actual ${endpoint} signature declaration is independently qualified`, () => {
    const fixture = callScenario();
    const signature = fixture.types.signatures[fixture.decision[endpoint].signature];
    signature.declaration = ownerId;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
      "selected callable endpoints do not belong to their actual declarations and candidate")]);
    signature.declaration = fixture.definition;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    signature.declaration = null;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const malformed of ["member-hole", "member-repeat", "accessor-hole", "accessor-repeat"]) {
  for (const receiverMismatch of [false, true]) {
    test(`F4 genuine borrowed ${malformed}, receiverMismatch=${receiverMismatch}`, () => {
      const fixture = memberScenario("property-access");
      const members = fixture.table.members;
      if (malformed === "member-hole") fixture.table.members = [, members[0]];
      if (malformed === "member-repeat") fixture.table.members = [members[0], members[0]];
      if (malformed === "accessor-hole") fixture.table.accessors = Array(1);
      if (malformed === "accessor-repeat") {
        const accessor = { origin: fixture.decision.origins[0], getter: null, setter: null };
        fixture.table.accessors = [accessor, accessor];
      }
      if (receiverMismatch) fixture.table.receiver = 0;
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
        ...(receiverMismatch ? [nodeViolation("member-origin", 2, "member inventory does not retain the actual receiver type")] : []),
        nodeViolation("member-origin", 2, "member selection does not retain a real member key and its actual declared origins"),
      ]);
      fixture.table.members = members;
      fixture.table.accessors = [];
      fixture.table.receiver = 1;
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a selected getter's genuine endpoint cannot become a null decision endpoint", () => {
  const fixture = memberScenario("property-access");
  attachActualGetter(fixture);
  const actual = fixture.decision.getter;
  fixture.decision.getter = null;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("access-location", 2, "member location is an accessor exactly when a getter or setter is selected"),
    nodeViolation("accessor-activation", 2, "selected accessor activation does not retain the actual member endpoint and access role")]);
  fixture.decision.getter = actual;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a member location is an accessor exactly when the decision selects a getter or a setter", () => {
  const data = { kind: "data", check: { kind: "required", failure: "abort" }, receiver: "by-reference" };
  const finding = nodeViolation("access-location", 2, "member location is an accessor exactly when a getter or setter is selected");
  const field = memberScenario("property-access");
  field.decision.location = data;
  assertCompleteValue(product.verifyTir(field.input, field.body), []);
  field.decision.location = { kind: "accessor" };
  assertCompleteValue(product.verifyTir(field.input, field.body), [finding]);
  const accessor = memberScenario("property-access");
  attachActualGetter(accessor);
  assertCompleteValue(product.verifyTir(accessor.input, accessor.body), []);
  accessor.decision.location = data;
  assertCompleteValue(product.verifyTir(accessor.input, accessor.body), [finding]);
});

for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
  test(`F4 selected and unselected sparse ${family} have different complete public outcomes`, () => {
    const body = emptyModuleBody();
    const input = emptyVerificationInput(body);
    const bindings = emptyBindings();
    bindings[family] = Array(1);
    const other = { ...body, bindings: { kind: "instantiated", bindings } };
    input.module.bodies.push(other);
    assertCompleteValue(product.verifyTir(input, body), []);
    assert.throws(() => product.verifyTir(input, other), { name: "TypeError",
      message: `ir-tir: sparse vector at $body["bindings"]["bindings"]["${family}"][0]` });
    input.module.bodies = [body, body];
    assertCompleteValue(product.verifyTir(input, body), [bodyViolation("template-shared-once",
      "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
    input.module.bodies = [body];
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("F4 a publication vector hole is DATA at the body port and a caller defect at the module port", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  input.module.bodies.length = 2;
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("template-shared-once",
    "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
  assert.throws(() => product.verifyTirModule(input, input.module), { name: "TypeError",
    message: 'ir-tir: sparse vector at $module["bodies"][1]' });
  input.module.bodies.length = 1;
  const actual = input.bindingScopesOf;
  input.bindingScopesOf = target => target.kind === "module" && target.module === moduleId ? [] : actual(target);
  assertCompleteValue(product.verifyTir(input, body), []);
  assertCompleteValue(product.verifyTirModule(input, input.module), []);
});

const argumentFindings = {
  total: ["argument-total", "application dispositions are not total over the real API formals and receiver"],
  order: ["argument-parameter-order", "argument and mapping parameters do not retain formal order"],
  authored: ["authored-order-preserved", "argument transport does not retain the original authored argument sequence"],
  omission: ["omission-valid", "omission does not match the actual optional, default or rest formal"],
};
for (const [name, form, mutate, expected] of [
  ["missing-final-mapping", "whole", fixture => fixture.decision.parameters.pop(), ["total"]],
  ["duplicate-formal", "whole", fixture => { fixture.decision.parameters[0].parameter = 1; }, ["total", "order"]],
  ["negative-argument", "whole", fixture => { fixture.decision.parameters[0].argument = -1; }, ["authored", "order"]],
  ["negative-zero-argument", "whole", fixture => { fixture.decision.parameters[0].argument = -0; }, ["authored", "order"]],
  ["negative-component", "whole", fixture => { fixture.decision.parameters[0].component = -1; }, ["authored", "order"]],
  ["repeated-rest-index", "values", fixture => { fixture.decision.parameters[0].arguments = [0, 0, 2]; }, ["authored", "order"]],
  ["component-past-tuple", "whole", fixture => { fixture.decision.parameters[0].component = 2; }, ["authored"]],
  ["provided-other-real-expression", "whole", fixture => { fixture.application.arguments[0].expression = 3; }, ["authored"]],
  ["rest-other-real-expression", "whole", fixture => { fixture.parts[0].expression = 3; }, ["authored"]],
  ["rest-captured-kind", "whole", fixture => { fixture.parts[0] = { kind: "value", expression: 5 }; }, ["authored"]],
  ["rest-mapping-other-source", "whole", fixture => { fixture.decision.parameters[1].arguments = [1]; }, ["authored"]],
  ["rest-repeated-whole-part", "whole", fixture => { fixture.parts.push(fixture.parts[0]); }, ["authored"]],
  ["required-mapped-omitted", "whole", fixture => {
    fixture.decision.parameters[0] = { kind: "omitted", parameter: 0, type: 2 };
  }, ["total", "omission"]],
  ["rest-mapped-omitted", "whole", fixture => {
    fixture.decision.parameters[1] = { kind: "omitted", parameter: 1, type: 4 };
  }, ["total", "omission"]],
  ["optional-mapped-rest", "optional", fixture => {
    fixture.decision.parameters[0] = { kind: "rest", parameter: 0, arguments: [], passing: "by-value" };
  }, ["omission"]],
  ["actual-receiver-unretained", "whole", fixture => { fixture.input.types.signatures[1].receiver = 0; }, ["total"]],
  ["default-formal-now-required", "default", fixture => {
    fixture.parameters[0].kind = "required";
    fixture.parameters[0].initializer = null;
  }, ["omission"]],
  ["default-other-real-body", "default", fixture => { fixture.decision.parameters[0].initializer = bodyId; }, ["omission"]],
]) {
  test(`F4 entire transport/formal vector ${name}`, () => {
    const fixture = argumentScenario(form);
    mutate(fixture);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), expected.map(key =>
      nodeViolation(argumentFindings[key][0], 2, argumentFindings[key][1])));
    const valid = argumentScenario(form);
    assertCompleteValue(product.verifyTir(valid.input, valid.body), []);
  });
}

for (const [position, role] of [[1, "this"], [0, "rest"]]) {
  test(`F4 actual two-formal ${role} cannot occupy position ${position}`, () => {
    const fixture = twoParameterScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    body.params[position].role = role;
    assertCompleteValue(product.verifyTir(input, body), [bodyViolation("parameter-order",
      "parameter records do not retain the actual declared formal order", fixture.functionBody)]);
    body.params[position].role = "required";
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

for (const field of ["name", "capturedFrom", "capture-role"]) {
  test(`F4 actual local metadata ${field} keeps its entire independent vector`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    if (field === "name") body.locals[0].name = "other";
    if (field === "capturedFrom") body.locals[0].capturedFrom = { body: fixture.functionBody, local: 0 };
    if (field === "capture-role") body.locals[0].role = "capture";
    const binding = bodyViolation("binding-storage", "local storage is not associated with its real original binding", fixture.functionBody);
    const capture = bodyViolation("capture-qualified", "captured local does not retain its actual qualified outer binding", fixture.functionBody);
    assertCompleteValue(product.verifyTir(input, body), field === "name" ? [binding] : field === "capturedFrom" ? [capture] :
      [binding, capture, bodyViolation("local-storage", "parameter storage does not retain its real local slot", fixture.functionBody)]);
    body.locals[0].name = "v";
    body.locals[0].capturedFrom = null;
    body.locals[0].role = "parameter";
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("F4 a genuine additional local is not an authored binding inventory", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.locals = [{ id: 0, declaration: { kind: "body", value: { body: bodyId, node: 0 } }, name: "v", role: "binding",
    storage: 0, capturedFrom: null, mutable: true }];
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("binding-storage",
    "local inventory does not retain the actual source binding inventory")]);
  body.locals = [];
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("F4 nested inventory multiplicity retains genuine source order", () => {
  const fixture = genericFunctionScenario();
  fixture.outer.nestedBodies.push(fixture.functionBody);
  assertCompleteValue(product.verifyTir(fixture.inputFor(fixture.outer), fixture.outer), [bodyViolation("stable-order",
    "capture and nested-body inventories do not retain actual source order")]);
  fixture.outer.nestedBodies.pop();
  assertCompleteValue(product.verifyTir(fixture.inputFor(fixture.outer), fixture.outer), []);
});

test("a conversion states its embedding once; whether it requires a check and how its operation executes are separate events", () => {
  const component = { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] };
  const proof = { steps: [{ from: component, to: component, rule: "numeric", premises: [] }], conclusion: 0 };
  const embedding = check => ({ kind: "conversion", conversion: "numeric", proof, check });
  const none = { kind: "none" };
  const unwinding = { kind: "required", failure: "unwind" };
  const pure = { kind: "pure" };
  const failing = failure => ({ kind: "invocation", writesStorage: false, failure });
  const identityConversion = (stated, execution) => ({ permissionScope: null, decision: { kind: "selected",
    operation: { kind: "conversion", embedding: stated, from: 1, to: 1 }, operands: [1], result: 1, execution } });
  const backing = (kind, execution) => ({ permissionScope: null, decision: { kind: "selected",
    operation: { kind, declaration: ownerId, bindings: emptyBindings() }, operands: [1], result: 1, execution } });
  const verified = (conversion, expected, label, scopes = 0) => {
    const fixture = operationScenario();
    fixture.typed.tsonic.conversion = conversion;
    for (let added = 0; added < scopes; added += 1) bodyScopes(fixture.input, fixture.body).push(emptyScope());
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), expected, label);
  };
  const convert = (check, execution) => ({ kind: "convert", role: "return", operation: identityConversion(embedding(check), execution) });
  // const narrow: int8 = wide          under a recoverable overflow fact: the range test, then a pure truncation
  verified(convert(unwinding, pure), [], "an explicit precheck followed by a pure continuation");
  // const boxed: int32 | string = n    with an allocating carrier: no test; the injection is one invocation that can end the process
  verified(convert(none, failing("abort")), [], "one failing invocation with no check");
  // const boxed: int8 | string = wide  both: the range test unwinds, then the allocating injection can end the process
  verified(convert(unwinding, failing("abort")), [], "a precheck followed by a failing invocation");
  verified(convert(unwinding, failing("unwind")), [], "a precheck and an invocation that fail the same way are still two events");
  verified(convert({ kind: "required", failure: "abort" }, failing("none")), [], "a precheck followed by an invocation that cannot fail");
  verified(convert(none, pure), [], "an unchecked pure conversion");
  // A conversion carried out by a core or library operation: the embedding stands beside the operation, once.
  for (const kind of ["core", "library"]) for (const check of [none, unwinding]) for (const execution of [pure, failing("unwind"), failing("abort")])
    verified({ kind: "backed-convert", role: "return", embedding: embedding(check), operation: backing(kind, execution) }, [],
      `a ${kind}-backed conversion, check ${check.kind}, execution ${execution.kind}`, 1);
  // The arm decides which operation may carry the conversion out.
  const refused = nodeViolation("conversion-operation", 2,
    "a conversion is carried out by the conversion identity, and a backed conversion by a core or library operation");
  verified({ kind: "convert", role: "return", operation: backing("core", pure) }, [refused], "a convert arm with a core operation", 1);
  verified({ kind: "convert", role: "return", operation: backing("library", pure) }, [refused], "a convert arm with a library operation", 1);
  verified({ kind: "backed-convert", role: "return", embedding: embedding(none), operation: identityConversion(embedding(none), pure) }, [refused],
    "a backed arm whose operation is the conversion identity states the embedding twice");
  const discarding = { permissionScope: null, decision: { kind: "selected", operation: { kind: "discard" }, operands: [1], result: 1, execution: pure } };
  verified({ kind: "convert", role: "return", operation: discarding }, [refused], "a convert arm with an operation that converts nothing");
  verified({ kind: "backed-convert", role: "return", embedding: embedding(none), operation: discarding }, [refused],
    "a backed arm with an operation that is neither core nor library");
});

for (const endpoint of ["from", "to"]) {
  test(`F4 explicit conversion ${endpoint} retains both endpoint and operation cofindings`, () => {
    const fixture = operationScenario();
    const operation = { permissionScope: null, decision: { kind: "selected", operation: {
      kind: "conversion", embedding: { kind: "identity" }, from: 1, to: 1 }, operands: [1], result: 1, execution: { kind: "pure" } } };
    fixture.typed.tsonic.conversion = { kind: "convert", role: "return", operation };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    operation.decision.operation[endpoint] = 0;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
      nodeViolation(endpoint === "from" ? "conversion-source" : "conversion-destination", 2,
        endpoint === "from" ? "conversion does not retain its value source endpoint" : "conversion does not retain its destination endpoint"),
      nodeViolation("operation-type", 2, "conversion operation does not retain its explicit operand and result endpoints"),
    ]);
    operation.decision.operation[endpoint] = 1;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const kind of ["DeleteExpression", "TypeOfExpression", "VoidExpression"]) {
  test(`F4 actual ${kind} operand transport has its complete null/opposite vector`, () => {
    const fixture = operationScenario();
    fixture.typed.kind = kind;
    fixture.typed.expression = fixture.operand;
    delete fixture.typed.operator;
    delete fixture.typed.operand;
    delete fixture.typed.tsonic.role;
    fixture.checked.kind = kind;
    fixture.checked.expression = fixture.checked.operand;
    delete fixture.checked.operator;
    delete fixture.checked.operand;
    delete fixture.checked.tsonic.role;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    fixture.operation.decision.operands = [];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("operation-type", 2,
      "selected operation does not retain the authored operand count and value endpoints")]);
    fixture.operation.decision.operands = [1];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const [token, kind] of [["BarBarToken", "or"], ["QuestionQuestionToken", "coalesce"],
  ["BarBarEqualsToken", "or"], ["QuestionQuestionEqualsToken", "coalesce"]]) {
  for (const disposition of ["left", "right", "dynamic"]) {
    test(`F4 actual ${token}/${disposition} demand endpoints retain complete outcomes`, () => {
      const fixture = binaryScenario(token.endsWith("EqualsToken") ? "assignment" : "short-circuit", token);
      const selection = { kind, control: 3, right: 5, disposition };
      fixture.typed.tsonic.selection = selection;
      const when = kind === "or" ? "false" : "absent";
      fixture.typed.right.tsonic.demand = disposition === "right" ? { kind: "always" } : disposition === "left"
        ? { kind: "never", control: 3 } : { kind: "selected", control: 3, when };
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
      fixture.typed.right.tsonic.demand = { kind: "always" };
      if (disposition !== "right") assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("controlled-demand", 5,
        "controlled branch does not retain its selected or never-evaluated demand")]);
      selection.control = 5;
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("controlled-demand", 2,
        "selection does not retain its authored control and branch endpoints")]);
    });
  }
}

for (const family of ["classBindings", "methodBindings", "capturedBindings"]) {
  for (const mode of ["rigid", "bound"]) {
    test(`F4 unselected canonical publication key includes ${family}/${mode}`, () => {
      const body = emptyModuleBody();
      const input = emptyVerificationInput(body);
      const bindings = emptyBindings();
      bindings[family] = [{ kind: mode, parameter: { owner: ownerId, index: 0 }, ...(mode === "bound" ? { type: 0 } : {}) }];
      const other = { ...body, bindings: { kind: "instantiated", bindings } };
      input.module.bodies.push(other);
      assertCompleteValue(product.verifyTir(input, body), []);
      input.module.bodies.push(other);
      assertCompleteValue(product.verifyTir(input, body), [bodyViolation("template-shared-once",
        "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
      input.module.bodies.pop();
      const different = emptyBindings();
      different[family] = [{ kind: mode === "rigid" ? "bound" : "rigid", parameter: { owner: ownerId, index: 0 },
        ...(mode === "rigid" ? { type: 0 } : {}) }];
      input.module.bodies.push({ ...body, bindings: { kind: "instantiated", bindings: different } });
      assertCompleteValue(product.verifyTir(input, body), []);
    });
  }
}

test("F4 self rigid and bound publication keys stay distinct and duplicates remain complete", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  const rigid = { ...body, bindings: { kind: "instantiated", bindings: { ...emptyBindings(),
    selfBindings: [{ kind: "rigid", owner: ownerId }] } } };
  const bound = { ...body, bindings: { kind: "instantiated", bindings: { ...emptyBindings(),
    selfBindings: [{ kind: "bound", owner: ownerId, type: 0 }] } } };
  input.module.bodies.push(rigid, bound);
  assertCompleteValue(product.verifyTir(input, body), []);
  for (const duplicate of [rigid, bound]) {
    input.module.bodies.push(duplicate);
    assertCompleteValue(product.verifyTir(input, body), [bodyViolation("template-shared-once",
      "canonical publication contains a duplicate artifact key or does not contain the selected body exactly once")]);
    input.module.bodies.pop();
  }
});

test("F4 protocol core and genuine callee retain the same real declaration endpoint", () => {
  const fixture = argumentScenario("empty");
  const spread = fixture.call.arguments.nodes[0];
  const callee = fixture.application.callee;
  const operation = { permissionScope: null, decision: { kind: "selected", operation: {
    kind: "core", declaration: fixture.definition, bindings: emptyBindings() }, operands: [], result: 0, execution: { kind: "pure" } } };
  spread.tsonic.protocol.decision.steps = [{ role: "next", operation, callee }];
  replaceScopeInventory(fixture.input, Array.from({ length: 7 }, emptyScope));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  operation.decision.operation.declaration = ownerId;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("protocol-total", 4,
    "protocol step operation and callee do not retain the same selected endpoint and result")]);
  operation.decision.operation.declaration = fixture.definition;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 different actual child kinds retain both parent and child shape findings", () => {
  const checked = { ...header(2, 1), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(),
      literal: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } };
  const typed = { ...header(2, 1), kind: "StringLiteral", text: "one", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: "one" } };
  const fixture = expressionScenario(checked, typed, [], 3, []);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("kind-children-shape", 1, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
  const matching = { ...header(2, 1), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(), role: "value", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
  const opposite = expressionScenario(checked, matching, [], 3, []);
  assertCompleteValue(product.verifyTir(opposite.input, opposite.body), []);
});

test("F4 a genuinely inserted authored child retains the displaced EOF and all source cofindings", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.statements.nodes.push({ ...header(2, 0), kind: "EmptyStatement", tsonic: null });
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("kind-children-shape", 0, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("no-inserted-nodes", 1, "typed syntax adds an authored child position"),
    nodeViolation("authored-node-ids-preserved", 2, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 2, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("node-in-body-range", 2, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 2, "node identity does not name an actual node in its module arena"),
  ]);
  body.root.statements.nodes = [];
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("F4 changing only the supplied root identity retains every root and subtree cofinding", () => {
  const body = emptyModuleBody();
  const input = emptyVerificationInput(body);
  body.root.id = 5;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("authored-node-ids-preserved", 5, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 5, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 5, "typed body root does not retain the actual original body subtree"),
    nodeViolation("node-in-body-range", 5, "typed syntax contains a real or invented node outside its actual original body subtree"),
    bodyViolation("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    nodeViolation("nested-template-identity", 5, "typed template does not retain its real authored body and shared syntax identity"),
    nodeViolation("node-reference", 5, "node identity does not name an actual node in its module arena"),
  ]);
  body.root.id = 0;
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("F4 ITEM-qualified binding declarations compare actual owner and node coordinates", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const input = fixture.inputFor(body);
  const actual = { kind: "item", value: { owner: fixture.valueDefinition, node: fixture.nodes.parameter } };
  body.locals[0].declaration = actual;
  fixture.originalFunction.locals[0].declaration = actual;
  assertCompleteValue(product.verifyTir(input, body), []);
  body.locals[0].declaration = { kind: "item", value: { owner: fixture.valueDefinition, node: fixture.nodes.parameterName } };
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("binding-storage",
    "local storage is not associated with its real original binding", fixture.functionBody)]);
  body.locals[0].declaration = actual;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const family of ["classParameters", "methodParameters", "capturedParameters", "selfOwners"]) {
  test(`F4 complete genuine declaration scope mismatch in ${family}`, () => {
    const fixture = genericFunctionScenario();
    const body = fixture.functionTemplate;
    const input = fixture.inputFor(body);
    const scopes = [...bodyScopes(input, body)];
    const actual = { ...fixture.scope, [family]: family === "selfOwners" ? [ownerId]
      : [{ owner: fixture.definition, index: family === "methodParameters" ? 1 : 0 }] };
    replaceScopeInventory(input, [actual, ...scopes.slice(1)]);
    assertCompleteValue(product.verifyTir(input, body), [
      bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope", fixture.functionBody),
      bodyViolation("binding-vector-complete", "type verifier: binding-vector-complete", fixture.functionBody),
    ]);
    replaceScopeInventory(input, scopes);
    assertCompleteValue(product.verifyTir(input, body), []);
  });
}

test("F4 distinct real self owners retain all metadata and lower-order cofindings", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  fixture.scope.selfOwners.push(ownerId);
  body.lexicalBindings.selfBindings.push({ kind: "rigid", owner: ownerId });
  body.root.tsonic.callable.template.lexicalBindings.selfBindings.push({ kind: "rigid", owner: ownerId });
  const input = fixture.inputFor(body);
  const scopes = [...bodyScopes(input, body)];
  assertCompleteValue(product.verifyTir(input, body), []);
  replaceScopeInventory(input, [{ ...fixture.scope, selfOwners: [fixture.definition] }, ...scopes.slice(1)]);
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("binding-vector-complete", "binding environment does not retain its genuine declaration scope", fixture.functionBody),
    bodyViolation("binding-vector-complete", "type verifier: self-owner", fixture.functionBody),
    bodyViolation("binding-vector-complete", "type verifier: self-binding-order", fixture.functionBody),
  ]);
  replaceScopeInventory(input, scopes);
  assertCompleteValue(product.verifyTir(input, body), []);
});

test("F4 a present actual candidate list cannot disappear from its source inventory", () => {
  const fixture = callScenario();
  const candidates = fixture.input.source.bodies[0].candidateLists;
  fixture.input.source.bodies[0].candidateLists = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
    "selected application names a missing actual candidate inventory")]);
  fixture.input.source.bodies[0].candidateLists = candidates;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 a real outside-body source node provides no disposal capture for this using occurrence", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const definition = "D[M[P[p];m];Outside]";
  const sourceType = { ...header(202, 200), kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(2), referencedDefinitions: [] } };
  const sourceName = { ...header(201, 200), kind: "Identifier", text: "Outside", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition } } };
  const sourceAlias = { ...header(200, 0), kind: "TypeAliasDeclaration", modifiers: null, name: sourceName,
    typeParameters: null, type: sourceType, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, parameters: [], type: available(2) } };
  const sourceList = { ...header(101, 100), kind: "VariableDeclarationList", declarations: nodeList(),
    tsonic: { core: emptyCore(), disposal: [] } };
  const list = { ...header(101, 100), kind: "VariableDeclarationList", declarations: nodeList(),
    tsonic: { role: "using", asynchronous: false, protocols: [{ kind: "decided", decision: { kind: "dispose",
      asynchronous: false, steps: [], value: 0, completion: 0, sent: 0, thrown: 0 } }] } };
  const sourceStatement = { ...header(100, fixture.nodes.block), kind: "VariableStatement", modifiers: null,
    declarationList: sourceList, tsonic: null };
  const statement = { ...header(100, fixture.nodes.block), kind: "VariableStatement", modifiers: null,
    declarationList: list, tsonic: null };
  body.root.body.statements.nodes.unshift(statement);
  fixture.checkedFunction.body.statements.nodes.unshift(sourceStatement);
  const input = fixture.inputFor(body);
  input.source.tree.statements.nodes.push(sourceAlias);
  input.source.items.push({ definition, node: 200 });
  fixture.declarations.set(definition, { scope: emptyScope(), parameterCount: 0, endpoints: [] });
  for (const node of [sourceStatement, sourceList]) fixture.functionNodes.set(node.id, node);
  for (const node of [sourceAlias, sourceName, sourceType]) fixture.outerNodes.set(node.id, node);
  list.id = 200;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("authored-node-ids-preserved", 200, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("node-in-body-range", 200, "typed syntax contains a real or invented node outside its actual original body subtree"),
  ]);
  list.id = 101;
  assertCompleteValue(product.verifyTir(input, body), []);
  list.id = 999;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("authored-node-ids-preserved", 999, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("no-inserted-nodes", 999, "typed syntax includes a node not present in the actual source arena"),
    nodeViolation("node-in-body-range", 999, "typed syntax contains a real or invented node outside its actual original body subtree"),
    nodeViolation("node-reference", 999, "node identity does not name an actual node in its module arena"),
  ]);
  list.id = fixture.nodes.end;
  assertCompleteValue(product.verifyTir(input, body), [
    nodeViolation("authored-node-ids-preserved", fixture.nodes.end, "typed node identity differs from the actual authored node at this position"),
    nodeViolation("node-in-body-range", fixture.nodes.end, "typed syntax contains a real or invented node outside its actual original body subtree"),
  ]);
  list.id = 101;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const access of ["write", "read-write"]) {
  for (const mismatch of ["decision-endpoint", "missing-setter", "table-endpoint", "getter-role"]) {
    test(`F4 authentic ${access} accessor ${mismatch} retains its complete activation vector`, () => {
      const fixture = assignmentMemberScenario(access);
      const sourceStatement = fixture.input.source.tree.statements.nodes[0];
      const assignment = sourceStatement.expression;
      sourceStatement.expression = fixture.sourceMember;
      attachActualGetter(fixture);
      sourceStatement.expression = assignment;
      const actualGetter = fixture.selection.getter;
      if (access === "write") {
        fixture.selection.getter = null;
        fixture.decision.getter = null;
        replaceScopeInventory(fixture.input, Array.from({ length: 3 }, emptyScope));
      }
      attachActualSetter(fixture);
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
      const setter = fixture.selection.setter;
      const getter = fixture.selection.getter;
      const endpoint = fixture.decision.setter;
      const tableSetter = fixture.table.accessors[0].setter;
      if (mismatch === "decision-endpoint") fixture.decision.setter = { ...endpoint, signature: 0 };
      if (mismatch === "missing-setter") fixture.selection.setter = null;
      if (mismatch === "table-endpoint") fixture.table.accessors[0].setter = ownerId;
      if (mismatch === "getter-role") {
        if (access === "read-write") fixture.selection.getter = null;
        else {
          fixture.selection.getter = actualGetter;
          fixture.decision.getter = actualGetter.decision.api;
          fixture.table.accessors[0].getter = actualGetter.decision.api.declaration;
        }
      }
      replaceScopeInventory(fixture.input, Array.from({ length: 3 + (fixture.selection.getter === null ? 0 : 2) +
        (fixture.selection.setter === null ? 0 : 2) }, emptyScope));
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("accessor-activation", 2,
        "selected accessor activation does not retain the actual member endpoint and access role")]);
      fixture.selection.setter = setter;
      fixture.selection.getter = getter;
      fixture.decision.setter = endpoint;
      if (access === "write") fixture.decision.getter = null;
      fixture.table.accessors[0].setter = tableSetter;
      replaceScopeInventory(fixture.input, Array.from({ length: access === "write" ? 5 : 7 }, emptyScope));
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    });
  }
}

test("F4 a genuine namespace definition owns its authentic nested Block template", () => {
  const body = emptyModuleBody();
  const definition = "D[M[P[p];m];space]";
  const nestedId = "B[D[M[P[p];m];space];module;0]";
  const block = { ...header(3, 2), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  const sourceBlock = { ...header(3, 2), kind: "Block", statements: nodeList(), multiLine: false, tsonic: null };
  const moduleBlock = { ...header(2, 1), kind: "ModuleBlock", statements: nodeList([block]), tsonic: null };
  const sourceModuleBlock = { ...header(2, 1), kind: "ModuleBlock", statements: nodeList([sourceBlock]), tsonic: null };
  const name = { ...header(4, 1), kind: "Identifier", text: "space", tsonic: { role: "declaration-name",
    declaration: { kind: "definition", definition }, storage: null } };
  const sourceName = { ...header(4, 1), kind: "Identifier", text: "space", tsonic: { core: emptyCore(), role: "declaration-name",
    declaration: { kind: "definition", definition } } };
  const template = { body: nestedId, lexicalBindings: emptyBindings(), dependence: "parametric" };
  const namespace = { ...header(1, 0), kind: "ModuleDeclaration", modifiers: null, asteriskToken: null, body: moduleBlock,
    keyword: "NamespaceKeyword", name, tsonic: { definition, type: 0, template } };
  const sourceNamespace = { ...header(1, 0), kind: "ModuleDeclaration", modifiers: null, asteriskToken: null, body: sourceModuleBlock,
    keyword: "NamespaceKeyword", name: sourceName, tsonic: { core: emptyCore(), parent: ownerId, attributes: [],
      memory: available(null), definition, members: [] } };
  const end = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  const sourceEnd = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([namespace]);
  body.root.endOfFileToken = end;
  body.nestedBodies = [nestedId];
  const nested = { ...emptyModuleBody(), body: nestedId, owner: definition, root: block, signature: 1 };
  const input = emptyVerificationInput(body, [], 3);
  input.source.tree.statements = nodeList([sourceNamespace]);
  input.source.tree.endOfFileToken = sourceEnd;
  input.source.items.push({ definition, node: 1 });
  input.source.bodies[0].nestedBodies = [nestedId];
  input.source.bodies.push({ body: nestedId, owner: definition, root: sourceBlock, params: [], locals: [], captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] });
  input.module.bodies.push(nested);
  input.types.signatures.push({ id: 1, declaration: definition, owner: { kind: "body", value: { body: nestedId, node: 3 } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: 0 });
  const declarationOf = input.declarationOf;
  input.declarationOf = selected => selected === definition ? { scope: emptyScope(), parameterCount: 0, endpoints: [] } : declarationOf(selected);
  const nodes = new Map([input.source.tree, sourceNamespace, sourceModuleBlock, sourceBlock, sourceName, sourceEnd].map(node => [node.id, node]));
  input.nodeOf = reference => reference.kind === "body" ? reference.value.body === bodyId ? nodes.get(reference.value.node) ?? null
    : reference.value.body === nestedId && reference.value.node === 3 ? sourceBlock : null
    : reference.value.owner === ownerId || reference.value.owner === definition ? nodes.get(reference.value.node) ?? null : null;
  assertCompleteValue(product.verifyTir(input, body), []);
  template.body = bodyId;
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("nested-template-identity", 1,
    "typed template does not retain its real authored body and shared syntax identity")]);
  template.body = nestedId;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const kind of ["FunctionExpression", "ArrowFunction"]) {
  for (const count of [0, 1, 2]) {
    test(`F4 genuine ${kind} own-template captures count=${count} retain the full ordered opposite`, () => {
      const fixture = genericFunctionScenario();
      const body = fixture.functionTemplate;
      const foreignBody = "B[D[M[P[foreign];source];outer];function;0]";
      const foreignLocals = Array.from({ length: 2 }, (_, id) => ({ id, declaration: { kind: "body", value: { body: foreignBody, node: id } },
        name: `outer${id}`, role: "binding", storage: 0, capturedFrom: null, mutable: true }));
      const captures = foreignLocals.slice(0, count).map(local => ({ body: foreignBody, local: local.id }));
      fixture.originalFunction.captures = captures;
      fixture.checkedFunction.tsonic.captures = captures;
      for (const published of [fixture.functionTemplate, ...fixture.instances]) {
        published.captures = [...captures];
        published.root.tsonic.captures = [...captures];
        published.root.tsonic.closure = closureDecisionOf(4, count);
        if (kind === "ArrowFunction") {
          published.root.kind = kind;
          delete published.root.name;
          published.root.equalsGreaterThanToken = { ...header(11, 2), kind: "EqualsGreaterThanToken", tsonic: null };
        }
      }
      if (kind === "ArrowFunction") {
        fixture.checkedFunction.kind = kind;
        delete fixture.checkedFunction.name;
        fixture.checkedFunction.equalsGreaterThanToken = { ...header(11, 2), kind: "EqualsGreaterThanToken", tsonic: null };
        fixture.functionNodes.set(11, fixture.checkedFunction.equalsGreaterThanToken);
      }
      const input = fixture.inputFor(body);
      const localExists = input.localExists;
      input.localExists = reference => reference.body === foreignBody ? foreignLocals[reference.local] !== undefined : localExists(reference);
      assertCompleteValue(product.verifyTir(input, body), []);
      body.root.tsonic.captures = [{ body: fixture.functionBody, local: 0 }];
      assertCompleteValue(product.verifyTir(input, body), [
        nodeViolation("capture-qualified", 2, "closure captures contain a local from the closure's own body"),
        nodeViolation("capture-qualified", 2, "closure captures do not retain the real authored outer-local sequence"),
        ...(count === 1 ? [] : [nodeViolation("closure-capture-total", 2, "closure decision does not state one logical capture per captured local, in order")]),
      ]);
      body.root.tsonic.captures = [...captures];
      if (count === 2) {
        body.root.tsonic.captures.reverse();
        assertCompleteValue(product.verifyTir(input, body), [nodeViolation("capture-qualified", 2,
          "closure captures do not retain the real authored outer-local sequence")]);
        body.root.tsonic.captures.reverse();
      }
      assertCompleteValue(product.verifyTir(input, body), []);
      const decided = body.root.tsonic.closure;
      for (const wrong of [count + 1, ...(count === 0 ? [] : [count - 1])]) {
        body.root.tsonic.closure = closureDecisionOf(4, wrong);
        assertCompleteValue(product.verifyTir(input, body), [nodeViolation("closure-capture-total", 2,
          "closure decision does not state one logical capture per captured local, in order")]);
      }
      body.root.tsonic.closure = closureDecisionOf(4, count, "captured-value");
      assertCompleteValue(product.verifyTir(input, body), []);
      body.root.tsonic.closure = decided;
      assertCompleteValue(product.verifyTir(input, body), []);
    });
  }
}

test("F4 actual activated-body capture correspondence never queries a false canonical key", () => {
  const fixture = callScenario();
  const foreignBody = "B[D[M[P[foreign];source];outer];function;0]";
  const locals = [{ id: 0, name: "first" }, { id: 1, name: "second" }];
  const first = { body: foreignBody, local: 0 };
  const second = { body: foreignBody, local: 1 };
  fixture.originalFunction.captures = [first];
  fixture.checkedFunction.tsonic.captures = [first];
  for (const published of [fixture.functionTemplate, ...fixture.instances]) {
    published.captures = [first];
    published.root.tsonic.captures = [first];
  }
  const localExists = fixture.input.localExists;
  fixture.input.localExists = reference => reference.body === foreignBody ? locals[reference.local] !== undefined : localExists(reference);
  fixture.callee.captures = [second];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("capture-qualified", 2,
    "activated callee does not retain the actual canonical body's capture vector")]);
  fixture.callee.captures = [first];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 an ordinary actual argument cannot claim a tuple component", () => {
  const fixture = callScenario();
  fixture.decision.parameters[0].component = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("authored-order-preserved", 2,
    "argument transport does not retain the original authored argument sequence")]);
  fixture.decision.parameters[0].component = null;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 complete array separator failure retains the second quoted token's own coordinate", () => {
  const body = emptyModuleBody();
  body.root.flags = ["Ambient", "Const"];
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8")
    .replace("flags=[]", 'flags=["Ambient", "Const"]');
  assertBodyRoundTrip(body, expected, "actual two flags");
  const text = expected.replace('["Ambient", "Const"]', '["Ambient" "Const"]');
  assertInvalidText(text, text.indexOf('"Const"'), [",", "]"], '"Const"');
  const malformed = expected.replace('["Ambient", "Const"]', '["Ambient" "Const\\q"]');
  assertInvalidText(malformed, malformed.indexOf('"Const'), [",", "]"], '"');
});

for (const [field, prefix] of [["root", "n"], ["signature", "sig"], ["completion", "t"]]) {
  test(`a numeric ${field} identity retains a complete nonnumeric-token failure`, () => {
    const text = completeEmptyWire.replace(`${field}=${prefix}:0`, `${field}=${prefix}:true`);
    assertInvalidText(text, text.indexOf(`${field}=${prefix}:true`) + field.length + prefix.length + 2,
      ["identity number"], "true");
  });
}

test("F4 complete header precedes the actual declaration lexical and scalar failures", () => {
  const expected = readFileSync(resolve(repository, functionDirectory, "empty-module.input.tir"), "utf8");
  const header = expected.split("\n")[0];
  const negative = expected.replace("root=n:0", "root=n:-1");
  assertInvalidText(negative, negative.indexOf("root=n:") + 5, ["$BodyRoot"], "n:-1");
  const number = header + "\nn:-";
  assertInvalidText(number, number.length - 1, ["number"], "-");
  const scalar = header + "\nn:0=0";
  assertInvalidText(scalar, scalar.length - 1, ["$SyntaxNode"], "0");
  assertBodyRoundTrip(emptyModuleBody(), expected, "complete declaration positive");
});

test("F4 a genuine zero-argument bodyless call has no invented optional or rest formal", () => {
  const fixture = argumentScenario("optional");
  fixture.parameters.length = 0;
  fixture.decision.parameters = [];
  fixture.application.arguments = [];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

for (const kind of ["ThisKeyword", "SuperKeyword"]) {
  test(`F4 actual ${kind} retains its explicit receiver role and value endpoints`, () => {
    const checked = { ...header(2, 1), kind, tsonic: { core: emptyCore(), role: "value", value: checkedValue() } };
    const typed = { ...header(2, 1), kind, tsonic: { ...typedValue(), role: kind === "ThisKeyword" ? "receiver" : "super",
      owner: ownerId, ...(kind === "SuperKeyword" ? { base: 0 } : {}) } };
    const fixture = expressionScenario(checked, typed, [], 3, []);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    typed.tsonic = { role: "type-literal", type: 0 };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
      nodeViolation("occurrence-role", 2, "typed occurrence does not retain its authored occurrence role"),
      nodeViolation("typed-value-occurrence", 2, "authored value occurrence has no typed value endpoints"),
    ]);
  });
}

for (const kind of ["PrivateIdentifier"]) {
  test(`F4 actual ${kind} loses neither name-position nor value cofindings`, () => {
    const sourceName = (identity, text, parent) => ({ ...header(identity, parent), kind: "Identifier", text,
      tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "definition", definition: ownerId, aliases: [] } } });
    const typedName = (identity, text, parent) => ({ ...header(identity, parent), kind: "Identifier", text,
      tsonic: { role: "type-name", type: 0, declarations: [ownerId] } });
    const checked = { ...header(2, 1), kind, ...(kind === "PrivateIdentifier" ? { text: "name" } :
      { left: sourceName(3, "Left", 2), right: sourceName(4, "Right", 2) }),
      tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "definition", definition: ownerId, aliases: [] } } };
    const typed = { ...header(2, 1), kind, ...(kind === "PrivateIdentifier" ? { text: "name" } :
      { left: typedName(3, "Left", 2), right: typedName(4, "Right", 2) }),
      tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: ownerId }, storage: null } };
    const fixture = expressionScenario(checked, typed, kind === "PrivateIdentifier" ? [] : [checked.left, checked.right], kind === "PrivateIdentifier" ? 3 : 5, []);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
      nodeViolation("occurrence-role", 2, "typed occurrence does not retain its authored occurrence role"),
      nodeViolation("name-role-position", 2, "name role does not match its original syntactic position"),
    ]);
    typed.tsonic = { role: "type-name", type: 0, declarations: [ownerId] };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

test("F4 QualifiedName uses its genuine EntityName slot and complete module-site role vector", () => {
  const fixture = bodylessModuleScenario();
  const sourceAlias = fixture.input.source.tree.statements.nodes[0];
  const sourceName = (id, text) => ({ ...header(id, 4), kind: "Identifier", text, tsonic: { core: emptyCore(), role: "type-name",
    resolution: { kind: "definition", definition: fixture.definition, aliases: [] } } });
  const name = (id, text) => ({ ...header(id, 4), kind: "Identifier", text,
    tsonic: { role: "type-name", type: 0, declarations: [fixture.definition] } });
  const source = { ...header(4, 3), kind: "QualifiedName", left: sourceName(5, "Left"), right: sourceName(6, "Right"),
    tsonic: { core: emptyCore(), role: "type-name", resolution: { kind: "definition", definition: fixture.definition, aliases: [] } } };
  const typed = { ...header(4, 3), kind: "QualifiedName", left: name(5, "Left"), right: name(6, "Right"),
    tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: fixture.definition }, storage: null } };
  sourceAlias.type = { ...header(3, 1), kind: "TypeReference", typeArguments: null, typeName: source,
    tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [fixture.definition] } };
  fixture.alias.type = { ...header(3, 1), kind: "TypeReference", typeArguments: null, typeName: typed,
    tsonic: { type: 0, declarations: [fixture.definition] } };
  fixture.input.source.tree.endOfFileToken = { ...header(7, 0), kind: "EndOfFile", tsonic: null };
  fixture.module.tree.endOfFileToken = { ...header(7, 0), kind: "EndOfFile", tsonic: null };
  const nodes = new Map([sourceAlias.type, source, source.left, source.right, fixture.input.source.tree.endOfFileToken].map(node => [node.id, node]));
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" && reference.value.owner === fixture.definition
    ? nodes.get(reference.value.node) ?? nodeOf(reference) : nodeOf(reference);
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), [
    nodeViolation("occurrence-role", 4, "typed occurrence does not retain its authored occurrence role"),
    nodeViolation("name-role-position", 4, "name role does not match its original syntactic position"),
  ]);
  typed.tsonic = { role: "type-name", type: 0, declarations: [fixture.definition] };
  assertCompleteValue(product.verifyTirModule(fixture.input, fixture.module), []);
});

function foreignMemberScenario(kind) {
  const fixture = memberScenario("element-access");
  const classDefinition = "D[M[P[api];surface];Container]";
  const fieldDefinition = "D[M[P[api];surface];Container/x]";
  const mappedDefinition = "D[M[P[api];mapped];Alias]";
  const parameterDefinition = "D[M[P[api];mapped];Alias/K]";
  const classOrigin = { module: "M[P[api];surface]", start: 0, length: 0, derived: [] };
  const mappedOrigin = { module: "M[P[api];mapped]", start: 0, length: 0, derived: [] };
  const fieldName = { ...header(2, 1), origin: classOrigin, kind: "Identifier", text: "x", tsonic: { core: emptyCore(),
    role: "property-name", key: available({ kind: "text", value: "x" }), origins: available([{ kind: "declared", declaration: fieldDefinition }]) } };
  const field = { ...header(1, 0), origin: classOrigin, kind: "PropertyDeclaration", modifiers: null, name: fieldName,
    postfixToken: null, type: null, initializer: null, tsonic: { core: emptyCore(), parent: classDefinition, attributes: [],
      memory: available(null), declaration: { kind: "definition", definition: fieldDefinition }, declaredType: available(0), initializer: null } };
  const className = { ...header(3, 0), origin: classOrigin, kind: "Identifier", text: "Container", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition: classDefinition } } };
  const declaration = { ...header(0), origin: classOrigin, kind: "ClassDeclaration", modifiers: null, name: className,
    typeParameters: null, heritageClauses: null, members: nodeList([field]), tsonic: { core: emptyCore(), parent: null,
      attributes: [], memory: available(null), definition: classDefinition, parameters: [], heritage: [], members: [fieldDefinition] } };
  const identity = { owner: mappedDefinition, index: 0 };
  const parameterName = { ...header(3, 2), origin: mappedOrigin, kind: "Identifier", text: "K", tsonic: { core: emptyCore(),
    role: "type-name", resolution: { kind: "definition", definition: parameterDefinition, aliases: [] } } };
  const constraint = { ...header(4, 2), origin: mappedOrigin, kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const parameter = { ...header(2, 1), origin: mappedOrigin, kind: "TypeParameter", modifiers: null, name: parameterName,
    constraint, expression: null, defaultType: null, tsonic: { core: emptyCore(), parent: mappedDefinition, attributes: [],
      memory: available(null), definition: parameterDefinition, parameter: { identity, declaration: parameterDefinition, constraint: 0, default: null } } };
  const type = { ...header(5, 1), origin: mappedOrigin, kind: "StringKeyword", tsonic: { core: emptyCore(), type: available(0), referencedDefinitions: [] } };
  const mapped = { ...header(1, 0), origin: mappedOrigin, kind: "MappedType", readonlyToken: null, typeParameter: parameter,
    nameType: null, questionToken: null, type, members: null,
    tsonic: { core: emptyCore(), type: available(1), referencedDefinitions: [] } };
  const aliasName = { ...header(6, 0), origin: mappedOrigin, kind: "Identifier", text: "Alias", tsonic: { core: emptyCore(),
    role: "declaration-name", declaration: { kind: "definition", definition: mappedDefinition } } };
  const alias = { ...header(0), origin: mappedOrigin, kind: "TypeAliasDeclaration", modifiers: null, name: aliasName,
    typeParameters: null, type: mapped, tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null),
      definition: mappedDefinition, parameters: [], type: available(1) } };
  const classNodes = new Map([declaration, field, fieldName, className].map(node => [node.id, node]));
  const fieldNodes = new Map([field, fieldName].map(node => [node.id, node]));
  const mappedNodes = new Map([alias, mapped, parameter, parameterName, constraint, type, aliasName].map(node => [node.id, node]));
  const parameterNodes = new Map([parameter, parameterName, constraint].map(node => [node.id, node]));
  const nodeOf = fixture.input.nodeOf;
  fixture.input.nodeOf = reference => reference.kind === "item" ? reference.value.owner === classDefinition
    ? classNodes.get(reference.value.node) ?? null : reference.value.owner === fieldDefinition ? fieldNodes.get(reference.value.node) ?? null
      : reference.value.owner === mappedDefinition ? mappedNodes.get(reference.value.node) ?? null : reference.value.owner === parameterDefinition
        ? parameterNodes.get(reference.value.node) ?? null : nodeOf(reference) : nodeOf(reference);
  const declarationOf = fixture.input.declarationOf;
  const declarations = new Map([classDefinition, fieldDefinition, mappedDefinition, parameterDefinition].map(definition =>
    [definition, { scope: emptyScope(), parameterCount: 0, endpoints: [] }]));
  fixture.input.declarationOf = selected => declarations.get(selected) ?? declarationOf(selected);
  const provenance = kind === "declared" ? { kind, declaration: fieldDefinition } : kind === "class-prototype"
    ? { kind, owner: classDefinition } : { kind: "mapped", owner: { kind: "item", value: { owner: mappedDefinition, node: 1 } }, key: fixture.decision.key };
  const member = fixture.table.members[0];
  member.origins = [provenance];
  member.readOrigins = [provenance];
  member.writeOrigins = [provenance];
  fixture.decision.origins = [provenance];
  if (kind === "declared") { fixture.decision.selectedDeclarations = [fieldDefinition]; fixture.decision.primary = fieldDefinition; }
  fixture.input.source.tree.statements.nodes[0].expression.tsonic.origins = available([provenance]);
  return { ...fixture, classDefinition, fieldDefinition, mappedDefinition, provenance };
}

for (const kind of ["declared", "class-prototype", "mapped"]) {
  test(`F4 real ${kind} member provenance retains its complete declared association`, () => {
    const fixture = foreignMemberScenario(kind);
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    fixture.decision.origins = [{ kind: "declared", declaration: ownerId }];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.origins = [fixture.provenance];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const negative of ["primary-not-selected", "empty-selected", "other-selected"]) {
  test(`F4 primary/selected declaration association ${negative} uses real endpoints`, () => {
    const fixture = foreignMemberScenario("declared");
    if (negative === "primary-not-selected") fixture.decision.primary = fixture.classDefinition;
    if (negative === "empty-selected") fixture.decision.selectedDeclarations = [];
    if (negative === "other-selected") { fixture.decision.selectedDeclarations = [fixture.classDefinition]; fixture.decision.primary = null; }
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.primary = fixture.fieldDefinition;
    fixture.decision.selectedDeclarations = [fixture.fieldDefinition];
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const [numerator, negativeZero] of [[1n, false], [0n, false], [0n, true]]) {
  test(`F4 actual numeric member key ${numerator}/${negativeZero} keeps the real literal`, () => {
    const fixture = memberScenario("element-access");
    const exact = { numerator, denominator: 1n, negativeZero };
    const text = negativeZero ? "-0" : String(numerator);
    const member = fixture.body.root.statements.nodes[0].expression;
    const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
    Object.assign(member.argumentExpression, { kind: "NumericLiteral", text,
      tsonic: { ...typedValue(), role: "value", value: exact } });
    Object.assign(sourceMember.argumentExpression, { kind: "NumericLiteral", text, tsonic: { core: emptyCore(), role: "value", value: checkedValue(),
      literal: { kind: "number", token: text, value: exact } } });
    const key = { kind: "number", value: exact };
    fixture.decision.key = key;
    fixture.table.members[0].key = key;
    fixture.decision.origins[0].key = key;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    fixture.decision.key = { kind: "number", value: { numerator: 2n, denominator: 1n, negativeZero: false } };
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
      "member selection does not retain a real member key and its actual declared origins")]);
    fixture.decision.key = key;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

test("F4 an actual named value without its real local slot keeps every storage cofinding", () => {
  const body = emptyModuleBody();
  const local = { body: bodyId, local: 0 };
  const declaration = { kind: "local", local };
  const name = { ...header(4, 3), kind: "Identifier", text: "v", tsonic: { role: "declaration-name", declaration, storage: 0 } };
  const sourceName = { ...header(4, 3), kind: "Identifier", text: "v", tsonic: { core: emptyCore(), role: "declaration-name", declaration } };
  const variable = { ...header(3, 2), kind: "VariableDeclaration", name, exclamationToken: null, type: null, initializer: null,
    tsonic: { declaration, storage: 0, initializer: null } };
  const sourceVariable = { ...header(3, 2), kind: "VariableDeclaration", name: sourceName, exclamationToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: ownerId, attributes: [], memory: available(null), declaration, declaredType: available(0), initializer: null } };
  const list = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList([variable]), tsonic: { role: "ordinary" } };
  const sourceList = { ...header(2, 1), kind: "VariableDeclarationList", declarations: nodeList([sourceVariable]), tsonic: { core: emptyCore(), disposal: [] } };
  const statement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: list, tsonic: null };
  const sourceStatement = { ...header(1, 0), kind: "VariableStatement", modifiers: null, declarationList: sourceList, tsonic: null };
  const end = { ...header(5, 0), kind: "EndOfFile", tsonic: null };
  body.root.statements = nodeList([statement]);
  body.root.endOfFileToken = { ...end };
  const input = emptyVerificationInput(body, [sourceStatement, sourceList, sourceVariable, sourceName, end]);
  input.source.tree.statements = nodeList([sourceStatement]);
  input.source.tree.endOfFileToken = end;
  const declarationRef = { kind: "body", value: { body: bodyId, node: 3 } };
  input.source.bodies[0].locals = [{ id: 0, declaration: declarationRef, name: "v", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: true }];
  assertCompleteValue(product.verifyTir(input, body), [
    bodyViolation("binding-storage", "local inventory does not retain the actual source binding inventory"),
    nodeViolation("local-storage", 4, "same-body local reference does not select a real local storage slot"),
    nodeViolation("local-storage", 3, "same-body local reference does not select a real local storage slot"),
    nodeViolation("binding-storage", 3, "binding occurrence does not retain its actual qualified local storage slot"),
    nodeViolation("binding-storage", 4, "binding occurrence does not retain its actual qualified local storage slot"),
  ]);
  body.locals = [{ id: 0, declaration: declarationRef, name: "v", role: "binding", storage: 0, capturedFrom: null, mutable: true }];
  assertCompleteValue(product.verifyTir(input, body), []);
  variable.tsonic.storage = 1;
  input.types.terms.push({ kind: "string" });
  assertCompleteValue(product.verifyTir(input, body), [nodeViolation("binding-storage", 3,
    "binding occurrence does not retain its actual qualified local storage slot")]);
});

test("F4 an actual symbol member key uses its real declaration and authored identifier", () => {
  const fixture = foreignMemberScenario("declared");
  const member = fixture.body.root.statements.nodes[0].expression;
  const sourceMember = fixture.input.source.tree.statements.nodes[0].expression;
  const key = { kind: "symbol", declaration: fixture.fieldDefinition };
  const symbolType = fixture.input.types.terms.length;
  fixture.input.types.terms.push({ kind: "literal", value: { kind: "unique-symbol", declaration: fixture.fieldDefinition }, base: 0 });
  fixture.input.nodeOf({ kind: "item", value: { owner: fixture.fieldDefinition, node: 1 } }).tsonic.declaredType = available(symbolType);
  Object.assign(member.argumentExpression, { kind: "Identifier", text: "key", tsonic: {
    ...typedValue(symbolType), role: "value", resolution: { kind: "definition", definition: fixture.fieldDefinition, aliases: [] } } });
  delete member.argumentExpression.tokenFlags;
  Object.assign(sourceMember.argumentExpression, { kind: "Identifier", text: "key", tsonic: { core: emptyCore(),
    role: "value", value: checkedValue(symbolType), resolution: { kind: "definition", definition: fixture.fieldDefinition, aliases: [] } } });
  delete sourceMember.argumentExpression.tokenFlags;
  fixture.decision.key = key;
  fixture.table.members[0].key = key;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  fixture.decision.key = { kind: "symbol", declaration: fixture.classDefinition };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
    "member selection does not retain a real member key and its actual declared origins")]);
  fixture.decision.key = key;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

for (const childFirst of [false, true]) {
  for (const kind of ["open", "error"]) {
    test(`F4 actual ${kind} propagation childFirst=${childFirst} keeps the entire body finding`, () => {
      const body = emptyModuleBody();
      body.completion = childFirst ? 2 : 1;
      const input = emptyVerificationInput(body);
      const leaf = kind === "error" ? { kind } : { kind, group: `G[${bodyId}]`, variable: 0 };
      input.types.terms.push(...(childFirst ? [leaf, { kind: "optional", value: 1 }] : [{ kind: "optional", value: 2 }, leaf]));
      assertCompleteValue(product.verifyTir(input, body), [bodyViolation(kind === "error" ? "error-diagnostic" : "type-closed",
        kind === "error" ? "error type is not accompanied by an actual error diagnostic at its source origin"
          : "typed reference does not reach a present closed type/signature graph")]);
      if (kind === "error") {
        input.diagnostics = [{ code: { kind: "checker", number: 999, rendered: "TS999" }, severity: "error",
          site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "actual source error",
          arguments: [], related: [], fix: null }];
        assertCompleteValue(product.verifyTir(input, body), []);
      }
      input.types.terms[1] = { kind: "optional", value: 2 };
      input.types.terms[2] = { kind: "array", element: 1, readonly: false };
      input.diagnostics = [];
      assertCompleteValue(product.verifyTir(input, body), []);
    });
  }
}

test("F4 genuine error recovery retains both complete node findings until its exact diagnostic arrives", () => {
  const source = { ...header(2, 1), origin: origin(10, 1), kind: "Identifier", text: "missing",
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "unresolved", checkerDiagnostic: null } } };
  const typed = { ...header(2, 1), origin: origin(10, 1), kind: "Identifier", text: "missing",
    tsonic: { ...typedValue(1), role: "value", resolution: { kind: "error", diagnostic: 0 } } };
  const fixture = expressionScenario(source, typed, [], 3, [{ kind: "error" }]);
  const expected = [nodeViolation("error-diagnostic", 2, "error type is not accompanied by an actual error diagnostic at its source origin"),
    nodeViolation("error-diagnostic", 2, "error resolution does not select an actual error diagnostic at its source origin")];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), expected);
  fixture.input.diagnostics = [{ code: { kind: "checker", number: 2304, rendered: "TS2304" }, severity: "error",
    site: { kind: "source", origin: origin() }, source: null, evidence: [], message: "missing name", arguments: [], related: [], fix: null }];
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), expected);
  fixture.input.diagnostics[0].site.origin = origin(10, 1);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 a genuine captured local cannot substitute another existing foreign local", () => {
  const fixture = genericFunctionScenario();
  const body = fixture.functionTemplate;
  const outerDefinition = "D[M[P[foreign];source];outer]";
  const outerBody = "B[D[M[P[foreign];source];outer];function;0]";
  const definitions = ["D[M[P[foreign];source];outer/first]", "D[M[P[foreign];source];outer/second]"];
  const outerOrigin = { module: "M[P[foreign];source]", start: 0, length: 0, derived: [] };
  const parameters = definitions.map((definition, position) => ({ ...header(position, 10), origin: outerOrigin, kind: "Parameter",
    modifiers: null, dotDotDotToken: null, name: { ...header(position + 2, position), origin: outerOrigin, kind: "Identifier",
      text: position === 0 ? "first" : "second", tsonic: { core: emptyCore(), role: "declaration-name",
        declaration: { kind: "local", local: { body: outerBody, local: position } } } }, questionToken: null, type: null, initializer: null,
    tsonic: { core: emptyCore(), parent: outerDefinition, attributes: [], memory: available(null),
      declaration: { kind: "local", local: { body: outerBody, local: position } }, declaredType: available(0), initializer: null } }));
  const locals = parameters.map((parameter, position) => ({ id: position, declaration: { kind: "item",
    value: { owner: definitions[position], node: parameter.id } }, name: parameter.name.text, role: "parameter",
    checkerSlot: available(0), capturedFrom: null, mutable: true }));
  const foreign = { body: outerBody, owner: outerDefinition, root: { ...header(10), origin: outerOrigin, kind: "FunctionExpression",
    modifiers: null, typeParameters: null, parameters: nodeList(parameters), type: null, fullSignature: null, asteriskToken: null,
    body: { ...header(11, 10), origin: outerOrigin, kind: "Block", statements: nodeList(), multiLine: false, tsonic: null }, name: null,
    tsonic: { core: emptyCore(), ...checkedValue(), body: outerBody, captures: [] } },
    params: definitions.map((declaration, local) => ({ local, declaration, role: "required", passing: "by-value", initializer: null })),
    locals, captures: [], scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  const first = { body: outerBody, local: 0 };
  const declaration = { kind: "item", value: { owner: definitions[0], node: 0 } };
  body.params = [];
  body.root.parameters = nodeList();
  body.completion = 0;
  body.locals = [{ id: 0, declaration, name: "first", role: "capture", storage: 0, capturedFrom: first, mutable: true }];
  body.captures = [first];
  body.root.tsonic.captures = [first];
  body.root.tsonic.closure = closureDecisionOf(4, 1);
  fixture.checkedFunction.parameters = nodeList();
  fixture.checkedFunction.tsonic.captures = [first];
  fixture.originalFunction.params = [];
  fixture.originalFunction.locals = [{ id: 0, declaration, name: "first", role: "capture", checkerSlot: available(0), capturedFrom: first, mutable: true }];
  fixture.originalFunction.captures = [first];
  const value = body.root.body.statements.nodes[0].expression;
  const sourceValue = fixture.checkedFunction.body.statements.nodes[0].expression;
  value.text = "first";
  value.tsonic = { ...typedValue(), role: "value", resolution: { kind: "local", local: { body: fixture.functionBody, local: 0 } } };
  sourceValue.text = "first";
  sourceValue.tsonic = { core: emptyCore(), role: "value", value: checkedValue(), resolution: value.tsonic.resolution };
  for (const signature of fixture.types.signatures.slice(1)) { signature.parameters = []; signature.result = 0; }
  fixture.declarations.get(fixture.definition).parameterCount = 0;
  fixture.declarations.delete(fixture.valueDefinition);
  fixture.itemNodes.delete(fixture.valueDefinition);
  fixture.functionNodes.delete(5);
  fixture.functionNodes.delete(6);
  fixture.outerNodes.delete(5);
  fixture.outerNodes.delete(6);
  fixture.module.bodies = [fixture.outer, body];
  const input = fixture.inputFor(body);
  input.source.items = input.source.items.filter(item => item.definition !== fixture.valueDefinition);
  input.localExists = reference => reference.body === outerBody ? foreign.locals[reference.local] !== undefined
    : reference.body === fixture.functionBody && fixture.originalFunction.locals[reference.local] !== undefined;
  const nodeOf = input.nodeOf;
  const foreignNodes = new Map([foreign.root, foreign.root.body, ...parameters, ...parameters.map(parameter => parameter.name)].map(node => [node.id, node]));
  const parameterNodes = parameters.map(parameter => new Map([[parameter.id, parameter], [parameter.name.id, parameter.name]]));
  input.nodeOf = reference => reference.kind === "body" && reference.value.body === outerBody
    ? foreignNodes.get(reference.value.node) ?? null : reference.kind === "item" && reference.value.owner === definitions[0]
      ? parameterNodes[0].get(reference.value.node) ?? null : reference.kind === "item" && reference.value.owner === definitions[1]
        ? parameterNodes[1].get(reference.value.node) ?? null : nodeOf(reference);
  const declarationOf = input.declarationOf;
  input.declarationOf = selected => definitions.includes(selected) || selected === outerDefinition
    ? { scope: emptyScope(), parameterCount: selected === outerDefinition ? 2 : 0, endpoints: [] } : declarationOf(selected);
  assertCompleteValue(product.verifyTir(input, body), []);
  body.locals[0].declaration = { kind: "item", value: { owner: definitions[1], node: 1 } };
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("binding-storage",
    "local storage is not associated with its real original binding", fixture.functionBody)]);
  body.locals[0].declaration = declaration;
  body.locals[0].capturedFrom = { body: outerBody, local: 1 };
  assertCompleteValue(product.verifyTir(input, body), [bodyViolation("capture-qualified",
    "captured local does not retain its actual qualified outer binding", fixture.functionBody)]);
  body.locals[0].capturedFrom = first;
  assertCompleteValue(product.verifyTir(input, body), []);
});

for (const kind of ["CallExpression", "NewExpression"]) {
  test(`F4 actual ${kind} deferred application retains its whole captured candidate input`, () => {
    const fixture = argumentScenario("whole");
    if (kind === "NewExpression") {
      fixture.call.kind = kind;
      delete fixture.call.questionDotToken;
      const source = fixture.input.source.tree.statements.nodes[0].expression;
      source.kind = kind;
      delete source.questionDotToken;
      fixture.captured.kind = "construct";
      fixture.input.types.signatures[1].kind = "construct";
      fixture.input.types.terms[1] = { kind: "callable", calls: [], constructs: [1] };
    }
    const evidence = (node, type) => ({ type, component: { kind: "body", value: { body: bodyId, node } },
      category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null });
    const context = { occurrence: { body: bodyId, node: 2 }, origin: origin(), bindings: emptyBindings() };
    const input = { context, kind: kind === "CallExpression" ? "call" : "construct", callee: evidence(3, 1), receiver: null,
      typeArguments: [], arguments: [{ occurrence: { body: bodyId, node: 5 }, kind: "spread", value: evidence(5, 5), tuple: [evidence(5, 2), evidence(5, 2)] }],
      candidates: [{ ordinal: 0, declaration: fixture.definition, advertised: fixture.decision.advertised, api: fixture.decision.api,
        bindings: emptyBindings(), conditionalFailure: null }] };
    fixture.call.tsonic.application = { kind: "deferred", deferred: { invocation: { rule: "candidate", input }, result: 0 } };
    replaceScopeInventory(fixture.input, Array.from({ length: 4 }, emptyScope));
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    context.occurrence.node = 3;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 2,
      "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
    context.occurrence.node = 2;
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  });
}

for (const mode of ["absent", "decided", "deferred"]) {
  test(`F4 actual value instantiation application ${mode} retains its full public outcome`, () => {
    const fixture = argumentScenario("optional");
    fixture.parameters.length = 0;
    fixture.decision.parameters = [];
    const source = fixture.input.source.tree.statements.nodes[0].expression;
    source.kind = "ExpressionWithTypeArguments";
    delete source.questionDotToken;
    delete source.arguments;
    source.tsonic = { core: emptyCore(), role: "value", value: checkedValue() };
    fixture.call.kind = "ExpressionWithTypeArguments";
    delete fixture.call.questionDotToken;
    delete fixture.call.arguments;
    const evidence = { type: 1, component: { kind: "body", value: { body: bodyId, node: 3 } }, category: { kind: "dynamic" },
      numeric: null, sum: null, nominal: null, pointer: null };
    const application = mode === "absent" ? null : mode === "decided" ? { kind: "decided", decision: fixture.decision } :
      { kind: "deferred", deferred: { invocation: { rule: "candidate", input: { context: { occurrence: { body: bodyId, node: 2 },
        origin: origin(), bindings: emptyBindings() }, kind: "call", callee: evidence, receiver: null, typeArguments: [], arguments: [],
        candidates: [{ ordinal: 0, declaration: fixture.definition, advertised: fixture.decision.advertised,
          api: fixture.decision.api, bindings: emptyBindings(), conditionalFailure: null }] } }, result: 0 } };
    fixture.call.tsonic = { ...typedValue(), role: "value", bindings: emptyBindings(), application };
    replaceScopeInventory(fixture.input, Array.from({ length: mode === "absent" ? 3 : 5 }, emptyScope));
    assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    if (mode === "decided") {
      fixture.input.types.signatures[1].declaration = ownerId;
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("call-endpoints", 2,
        "selected callable endpoints do not belong to their actual declarations and candidate")]);
      fixture.input.types.signatures[1].declaration = fixture.definition;
      assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
    }
  });
}

test("F4 a saved self-type conversion requires the genuine captured self owner", () => {
  const fixture = deferredConversionScenario();
  const selfType = fixture.types.terms.length;
  fixture.types.terms.push({ kind: "self", owner: fixture.definition });
  fixture.scope.selfOwners.push(fixture.definition);
  fixture.body.lexicalBindings.selfBindings.push({ kind: "rigid", owner: fixture.definition });
  fixture.body.root.tsonic.callable.template.lexicalBindings.selfBindings.push({ kind: "rigid", owner: fixture.definition });
  fixture.body.completion = selfType;
  fixture.types.signatures[1].result = selfType;
  const source = fixture.checkedFunction.body.statements.nodes[0].expression;
  source.kind = "ThisKeyword";
  delete source.text;
  source.tsonic = { core: emptyCore(), role: "value", value: checkedValue(selfType) };
  fixture.value.kind = "ThisKeyword";
  delete fixture.value.text;
  fixture.deferred.result = selfType;
  const evidence = { ...fixture.deferred.invocation.input.from, type: selfType, category: { kind: "dynamic" } };
  fixture.deferred.invocation.input.from = evidence;
  fixture.deferred.invocation.input.to = evidence;
  fixture.value.tsonic = { ...typedValue(selfType), role: "receiver", owner: fixture.definition,
    conversion: { kind: "deferred", deferred: fixture.deferred } };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  const scopes = [...bodyScopes(fixture.input, fixture.body)];
  fixture.context.bindings = { ...fixture.body.lexicalBindings, selfBindings: [] };
  replaceScopeInventory(fixture.input, [scopes[0], { ...fixture.scope, selfOwners: [] }, scopes[2]]);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 9,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  fixture.context.bindings = fixture.body.lexicalBindings;
  replaceScopeInventory(fixture.input, scopes);
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("a typed protocol cannot replace a genuine authored nonprotocol expression", () => {
  const exact = { numerator: 1n, denominator: 1n, negativeZero: false };
  const operand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typedValue(1), role: "value", value: exact } };
  const checkedOperand = { ...header(3, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { core: emptyCore(), role: "value", value: checkedValue(1),
      literal: { kind: "number", token: "1", value: exact } } };
  const typed = { ...header(2, 1), kind: "AwaitExpression", expression: operand,
    tsonic: { ...typedValue(), protocol: { kind: "decided", decision: { kind: "await",
      asynchronous: true, steps: [], value: 0, completion: 0, sent: null, thrown: 2 } } } };
  const checked = { ...header(2, 1), kind: "VoidExpression", expression: checkedOperand,
    tsonic: { core: emptyCore(), ...checkedValue() } };
  const fixture = expressionScenario(checked, typed, [checkedOperand], 4,
    [{ kind: "primitive", primitive: "int32" }, { kind: "intrinsic", intrinsic: "unknown" }]);
  fixture.body.asynchronous = true;
  fixture.input.source.bodies[0].asynchronous = true;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [
    nodeViolation("kind-children-shape", 1, "typed syntax does not retain the authored kind, fields and child presence"),
    nodeViolation("kind-children-shape", 2, "typed syntax does not retain the authored kind, fields and child presence"),
  ]);
  checked.kind = "AwaitExpression";
  checked.tsonic = { core: emptyCore(), ...checkedValue(),
    protocol: available({ kind: "await", subject: 3, completion: 0 }) };
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 a real spread protocol's saved input retains the actual nullable channels", () => {
  const fixture = argumentScenario("whole");
  const spread = fixture.call.arguments.nodes[0];
  const evidence = type => ({ type, component: { kind: "body", value: { body: bodyId, node: 5 } },
    category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null });
  const context = { occurrence: { body: bodyId, node: 4 }, origin: origin(), bindings: emptyBindings() };
  const input = { context, kind: "spread", asynchronous: false, subject: evidence(5), operands: [],
    completion: evidence(0), yielded: null, sent: evidence(0), thrown: evidence(0) };
  spread.tsonic.protocol = { kind: "deferred", deferred: { invocation: { rule: "protocol", input }, result: 5 } };
  replaceScopeInventory(fixture.input, Array.from({ length: 5 }, emptyScope));
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  context.occurrence.node = 2;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("deferred-parameters", 4,
    "saved invocation does not retain its occurrence and complete captured rigid-parameter support")]);
  context.occurrence.node = 4;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 a genuine nonidentity refinement arm retains its explicit result endpoint", () => {
  const fixture = operationScenario();
  const component = { root: { kind: "body", value: { body: bodyId, node: 2 } }, path: [] };
  const narrowing = { kind: "narrowed", source: 1, result: 1,
    proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 }, failure: "unwind" };
  fixture.typed.tsonic.narrowing = narrowing;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
  narrowing.result = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("refinement-destination", 2,
    "refinement does not retain its value endpoint")]);
  narrowing.result = 1;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("F4 an otherwise correct actual member table cannot replace its real receiver", () => {
  const fixture = memberScenario("property-access");
  fixture.table.receiver = 0;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), [nodeViolation("member-origin", 2,
    "member inventory does not retain the actual receiver type")]);
  fixture.table.receiver = 1;
  assertCompleteValue(product.verifyTir(fixture.input, fixture.body), []);
});

test("fresh strict whole-owner isolation includes every current executable TIR module", async () => {
  const module = hostCatalogue.find(item => item.name === "ir-tir");
  const candidates = [...sourceFiles];
  for (const name of ["ids", "diag", "ir-types", "ir-hir", "ir-infer"]) {
    for (const file of readdirSync(resolve(repository, `packages/host/src/${name}`)).filter(path => path.endsWith(".ts"))) {
      candidates.push(`packages/host/src/${name}/${file}`);
    }
  }
  const files = new Map(candidates.map(path => [path, readFileSync(resolve(repository, path), "utf8")]));
  const graph = readImportGraph(parseSources(files), files);
  const interfaceSources = [...new Set(graph.filter(edge => sourceFiles.includes(edge.source) && edge.target !== null &&
    !sourceFiles.includes(edge.target)).map(edge => edge.target))];
  const closure = new Set(interfaceSources);
  for (const path of closure) for (const edge of graph) {
    if (edge.source === path && edge.target !== null) closure.add(edge.target);
  }
  const report = await compileIsolated(isolationDeps(tooling, roots), module, { root: repository, sourceFiles,
    interfaceSources, declarationSources: [...closure].sort(), outputDirectory: ".temp/ir-tir-isolation" });
  writeFileSync(resolve(repository, ".temp/ir-tir-isolation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 5000));
  assert.equal(report.sourceInventory.filter(item => item.path.includes("/src/ir-tir/")).length, 33);
  assert.equal(report.provenance.length > 0, true, "real dependency declarations were freshly produced from their actual source closure");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
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
    [...runtimeFiles, resolve(repository, "packages/host/src/ir-tir/contract.ts")], raw);
    const directory = resolve(repository, ".temp/ir-tir-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 32, "all current actual runtime owners have nonempty source-identified raw V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, 32);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1);
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { profiler.disconnect(); }
});
