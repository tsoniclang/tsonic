import { isDeepStrictEqual } from "node:util";
import { compareCaseValues } from "../../host-cases/compare.mjs";

export const moduleId = "M[P[p];m]";

export const ownerId = "D[M[P[p];m]]";
export const bodyId = "B[D[M[P[p];m]];module;0]";

export const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
export const origin = (start = 0, length = 0) => ({ module: moduleId, start, length, derived: [] });
export const header = (id, parent = null) => ({ id, origin: origin(), parent, flags: [], loc: { pos: 0, end: 0 } });
export const nodeList = (nodes = []) => ({ loc: { pos: 0, end: 0 }, nodes });

export function emptyModuleBody() {
  const end = { ...header(1, 0), kind: "EndOfFile", tsonic: null };
  const root = { ...header(0), kind: "SourceFile", statements: nodeList(), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { module: moduleId, template: { body: bodyId, lexicalBindings: emptyBindings(), dependence: "parametric" } } };
  return { body: bodyId, owner: ownerId, bindings: { kind: "parametric" }, lexicalBindings: emptyBindings(),
    dependence: "parametric", signature: 0, completion: 0, yielded: null, sent: null, params: [], locals: [], root,
    nestedBodies: [], captures: [], scopes: [], evidence: [], asynchronous: false, generator: false };
}

export const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
export const completeScopes = scopes => ({ kind: "complete", scopes });
export const available = value => ({ kind: "available", value });
export const emptyCore = () => ({ provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false, application: available(null) }),
  pointerType: available(null), pointerOperation: available(null), fieldBinding: available(null), recordBinding: available(null),
  attribute: available(null), safety: available(null), argumentPassing: available(null), flowState: available(null) });

export const bodyScopeReader = (body, scopes) => {
  const instance = structuredClone({ body: body.body, bindings: body.bindings });
  return target => completeScopes(target.kind === "body" && isDeepStrictEqual(target.instance, instance) ? scopes : null);
};

export function emptyVerificationInput(body, authoredNodes = [], scopeCount = 2) {
  const end = { ...header(1, 0), kind: "EndOfFile", tsonic: null };
  const root = { ...header(0), kind: "SourceFile", statements: nodeList(), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: emptyCore(), parent: null, attributes: [], memory: available(null), definition: ownerId, body: bodyId } };
  const original = { body: bodyId, owner: ownerId, params: [], locals: [], root, captures: [], scopes: [],
    asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] };
  const source = { module: moduleId, tree: root, items: [{ definition: ownerId, node: 0 }], bodies: [original],
    exports: [], bindings: [], moduleLinks: [], checkerDiagnostics: [], obligations: [] };
  const module = { module: moduleId, tree: { kind: "ready-root", root: body.root }, bodies: [body] };
  const types = { terms: [{ kind: "intrinsic", intrinsic: "unknown" }], signatures: [{ id: 0, declaration: ownerId,
    owner: { kind: "body", value: { body: bodyId, node: 0 } }, composition: null, kind: "call", typeParameters: [],
    receiver: null, parameters: [], result: 0 }] };
  const declarations = new Map([[ownerId, { scope: emptyScope(), parameterCount: 0, endpoints: [] }]]);
  const originalNodes = new Map([[0, root], [1, end], ...authoredNodes.map(node => [node.id, node])]);
  return { source, module, types, bindingScopesOf: bodyScopeReader(body, Array.from({ length: scopeCount }, emptyScope)),
    declarationOf: definition => declarations.get(definition) ?? null,
    declarationSourceOf: definition => {
      const entry = source.items.find(item => item.definition === definition);
      return entry === undefined ? null : { kind: "item", value: { owner: entry.definition, node: entry.node } };
    },
    staticStorageOf: () => null,
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

export const checkerViews = type => ({ read: available(type), declared: available(null), contextual: available(null) });
export const checkedValue = (type = 0) => ({ views: checkerViews(type), place: available(null), memory: available(null), observation: available(null) });
export const typedValue = (type = 0) => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null,
  evidenceIndex: null, demand: { kind: "always" } });
export const selectedOperation = (operation, result = 0) => ({ kind: "decided", decision: { permissionScope: null,
  decision: { kind: "selected", operation, operands: [], result, execution: { kind: "pure" } } } });

export function memberScenario(holder, duplicatedPart = false) {
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
      : { core: emptyCore(), role, value: checkedValue(), resolution: { kind: "declarations", definitions: [ownerId] },
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
      { core: emptyCore(), role: "value", value: checkedValue(1), resolution: { kind: "declarations", definitions: [ownerId] } },
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
  body.root.statements = nodeList([{ kind: "ready-statement", node: statement.typed }]);
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
