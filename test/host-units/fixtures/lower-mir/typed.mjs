// Builders for complete typed bodies (TirBody) used as inputs of the lower-mir cases.
// A program file writes its typed tree as nested node descriptions; `seal` assigns node identities
// in pre-order and resolves labels. Nothing here computes a lowering result.
import { N } from "./names.mjs";

export const MODULE = "M[P[p];m]";
export const def = name => `D[${MODULE};${name}]`;
export const bodyId = (name, role = "function", ordinal = 0) => `B[${def(name)};${role};${ordinal}]`;
export const PARAMETRIC = Object.freeze({ kind: "parametric" });
export const EMPTY_BINDINGS = Object.freeze({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
export const instanceOf = name => ({ body: bodyId(name), bindings: PARAMETRIC });
const LOC = Object.freeze({ pos: 0, end: 512 });

// ---- type table -------------------------------------------------------------------------
// One table for all programs. `T.<name>` is the TyId; `SIG.<name>` the SigId.
const terms = [];
const signatures = [];
export const T = {};
export const SIG = {};
const term = (name, value) => { T[name] = terms.length; terms.push(value); return T[name]; };
const member = (key, type, optional = false) => ({ key: { kind: "text", value: key }, origins: [], readOrigins: [], writeOrigins: [],
  kind: "property", read: type, write: type, optional, readonly: false });
term("void", { kind: "intrinsic", intrinsic: "void" });
term("bool", { kind: "primitive", primitive: "bool" });
term("string", { kind: "string" });
term("int32", { kind: "primitive", primitive: "int32" });
term("unknown", { kind: "intrinsic", intrinsic: "unknown" });
term("absence", { kind: "intrinsic", intrinsic: "absence" });
term("uint32", { kind: "primitive", primitive: "uint32" });
term("int32Array", { kind: "array", element: T.int32, readonly: false });
term("int32Fixed4", { kind: "fixed-array", element: T.int32, extent: { length: 4n, runtimeBase: "number" } });
term("int32Rows", { kind: "array", element: T.int32Array, readonly: false });
term("int32Pair", { kind: "tuple", elements: [{ kind: "required", type: T.int32, declaration: null }, { kind: "required", type: T.int32, declaration: null }], readonly: false });
term("optInt32", { kind: "optional", value: T.int32 });
term("inner", { kind: "shape", members: [member("x", T.int32)], indexes: [], calls: [], constructs: [] });
term("outer", { kind: "shape", members: [member("inner", T.inner)], indexes: [], calls: [], constructs: [] });
term("counter", { kind: "shape", members: [member("count", T.int32)], indexes: [], calls: [], constructs: [] });
term("optCounter", { kind: "optional", value: T.counter });
term("boxV", { kind: "shape", members: [member("v", T.int32)], indexes: [], calls: [], constructs: [] });
term("optBoxV", { kind: "optional", value: T.boxV });
term("holder", { kind: "shape", members: [member("x", T.optBoxV)], indexes: [], calls: [], constructs: [] });
term("abRecord", { kind: "shape", members: [member("a", T.int32), member("b", T.int32, true)], indexes: [], calls: [], constructs: [] });
export const signature = (name, parameters, result, receiver = null) => {
  SIG[name] = signatures.length;
  signatures.push({ id: SIG[name], declaration: def(name), owner: null, composition: null, kind: "call", typeParameters: [],
    receiver, parameters: parameters.map(([parameter, type, kind = "required", initializer = null, passing = "by-value"]) =>
      ({ declaration: def(`${name}.${parameter}`), kind, type, passing, initializer })), result });
  return SIG[name];
};
term("fnVoidToInt32", { kind: "callable", calls: [signature("()=>int32", [], T.int32)], constructs: [] });
term("fnVoidToVoid", { kind: "callable", calls: [signature("()=>void", [], T.void)], constructs: [] });
export const declareType = term;
export const TABLE = { terms, signatures };

// ---- decisions (COMMON-DATA §3) -----------------------------------------------------------
export const PURE = Object.freeze({ kind: N.rvalue });
export const invoking = (failure, effect) => ({ kind: N.invoke, [N.failure]: failure, [N.effect]: effect });
export const selected = (operation, operands, result, execution = PURE) =>
  ({ kind: "selected", operation, operands, result, [N.execution]: execution });
export const native = (operator, carrier, operands, result, execution = PURE) =>
  selected({ kind: "native-operator", operator, carrier }, operands, result, execution);
export const typedOperation = decision => ({ decision, permissionScope: null });
export const decided = decision => ({ kind: "decided", decision });
export const operation = decision => decided(typedOperation(decision));
export const direct = receiver => ({ kind: N.direct, [N.receiver]: receiver });
export const checked = (failure, receiver) => ({ kind: N.checked, [N.failure]: failure, [N.receiver]: receiver });
// The key of an index decision whose key is not a compile-time value is undecided (NEEDS-W4 A8 note).
export const DYNAMIC_KEY = null;
export const memberDecision = (key, read, write, location) => ({
  key: key === DYNAMIC_KEY ? DYNAMIC_KEY : { kind: "text", value: key }, origins: [], selectedDeclarations: [], primary: null,
  read, write, getter: null, setter: null, bindings: EMPTY_BINDINGS, [N.location]: location });
export const selection = (key, read, write, location) =>
  decided({ decision: memberDecision(key, read, write, location), getter: null, setter: null });
export const narrowed = (source, result, failure) =>
  ({ kind: "narrowed", source, result, proof: { kind: "identity" }, [N.failure]: failure });

export const endpoint = (name, role, signatureId, withBody = true) =>
  ({ declaration: def(name), role, signature: signatureId, body: withBody ? bodyId(name) : null });
export const mapped = (parameter, argument, passing = "by-value") =>
  ({ kind: "argument", parameter, argument, component: null, passing });
export const omittedMapping = (parameter, type) => ({ kind: "omitted", parameter, type });
export const defaultMapping = (parameter, name) => ({ kind: "default", parameter, initializer: bodyId(name, "default") });
export const application = (name, signatureId, parameters, result, extra = {}) => ({
  candidate: 0, advertised: endpoint(name, "advertised", signatureId), api: endpoint(name, "api-body", signatureId),
  bindings: EMPTY_BINDINGS, implementationBindings: EMPTY_BINDINGS, parameters,
  completion: { signature: signatureId, completion: result, yielded: null, sent: null }, result, ...extra });
export const callee = (name, signatureId, parameters, result, captures = [], extra = {}) =>
  ({ decision: application(name, signatureId, parameters, result, extra), activation: instanceOf(name), captures });

// ---- typed payloads -----------------------------------------------------------------------
export const value = (type, extra = {}) => ({ type, convertedType: type, conversion: { kind: "identity" }, narrowing: null,
  evidenceIndex: null, demand: { kind: "always" }, ...extra });
export const list = (...nodes) => ({ $list: true, nodes });
const token = kind => ({ kind, tsonic: null });

// A program gets its builders bound to its body identity.
export function builders(name) {
  const body = bodyId(name);
  const localRef = local => ({ body, local });
  const nodeRef = node => ({ body, node });
  const b = {
    body, localRef, nodeRef,
    id: (text, local, type, extra = {}) => ({ kind: "Identifier", text,
      tsonic: { ...value(type, extra.value), role: extra.role ?? "value", resolution: { kind: "local", local: localRef(local) }, ...extra.payload } }),
    target: (text, local, storage, access = { kind: "write", storage }) => ({ kind: "Identifier", text,
      tsonic: { role: "assignment-target", resolution: { kind: "local", local: localRef(local) }, access } }),
    global: (text, definition, type) => ({ kind: "Identifier", text,
      tsonic: { ...value(type), role: "value", resolution: { kind: "definition", definition: def(definition), aliases: [] } } }),
    declName: (text, local) => ({ kind: "Identifier", text,
      tsonic: { role: "declaration-name", declaration: { kind: "local", local: localRef(local) }, storage: null } }),
    propertyName: text => ({ kind: "Identifier", text, tsonic: { role: "property-name", key: { kind: "text", value: text } } }),
    label: (text, target) => ({ kind: "Identifier", text, tsonic: at => ({ role: "label", target: nodeRef(at(target)) }) }),
    num: (text, type) => ({ kind: "NumericLiteral", text, tokenFlags: [],
      tsonic: { ...value(type), role: "value", value: { numerator: BigInt(text), denominator: 1n, negativeZero: false } } }),
    keyword: (kind, type, role = "value") => ({ kind, tsonic: { ...value(type), role } }),
    paren: (expression, type) => ({ kind: "ParenthesizedExpression", expression, tsonic: value(type) }),
    binary: (left, operator, right, payload) => ({ kind: "BinaryExpression", modifiers: null, left, type: null,
      operatorToken: token(operator), right, tsonic: payload }),
    arithmetic: (left, operator, right, type, decision) =>
      b.binary(left, operator, right, { ...value(type), role: "arithmetic", operation: operation(decision) }),
    comparison: (left, operator, right, decision) =>
      b.binary(left, operator, right, { ...value(T.bool), role: "comparison", operation: operation(decision) }),
    sequence: (left, right, type) => b.binary(left, "CommaToken", right, { ...value(type), role: "sequence" }),
    assign: (left, operator, right, type, storage, calculation = null, select = null) =>
      b.binary(left, operator, right, { ...value(type), role: "assignment", storage,
        calculation: calculation === null ? null : operation(calculation), selection: select }),
    property: (expression, text, payload) => ({ kind: "PropertyAccessExpression", expression, questionDotToken: null,
      name: b.propertyName(text), tsonic: payload }),
    element: (expression, argumentExpression, payload) => ({ kind: "ElementAccessExpression", expression, questionDotToken: null,
      argumentExpression, tsonic: payload }),
    read: (type, select, extra = {}) => ({ ...value(type, extra), role: "value", selection: select }),
    write: (select, storage) => ({ role: "assignment-target", selection: select, access: { kind: "write", storage } }),
    readWrite: (select, storage, read = storage) => ({ role: "assignment-target", selection: select,
      access: { kind: "read-write", storage, read, narrowing: null, evidenceIndex: null } }),
    nonNull: (expression, type, narrowing) => ({ kind: "NonNullExpression", expression, tsonic: value(type, { narrowing }) }),
    call: (expression, args, type, makeApplication, extra = {}) => ({ kind: "CallExpression", expression, questionDotToken: null,
      typeArguments: null, arguments: list(...args),
      tsonic: at => ({ ...value(type), application: decided(makeApplication(at)), operation: null, ...extra }) }),
    construct: (expression, args, type, makeApplication) => ({ kind: "NewExpression", expression, typeArguments: null,
      arguments: list(...args), tsonic: at => ({ ...value(type), application: decided(makeApplication(at)), operation: null }) }),
    postfix: (operand, operator, type, storage, decision) => ({ kind: "PostfixUnaryExpression", operand, operator,
      tsonic: { ...value(type), storage, operation: operation(decision) } }),
    block: (...statements) => ({ kind: "Block", statements: list(...statements), multiLine: true, tsonic: null }),
    expressionStatement: expression => ({ kind: "ExpressionStatement", expression, tsonic: null }),
    returns: expression => ({ kind: "ReturnStatement", expression, tsonic: null }),
    throws: expression => ({ kind: "ThrowStatement", expression, tsonic: null }),
    ifElse: (expression, thenStatement, elseStatement = null) => ({ kind: "IfStatement", expression, thenStatement, elseStatement, tsonic: null }),
    whileLoop: (expression, statement) => ({ kind: "WhileStatement", statement, expression, tsonic: null }),
    forLoop: (initializer, condition, incrementor, statement) => ({ kind: "ForStatement", statement, initializer, condition, incrementor, tsonic: null }),
    forOf: (initializer, expression, statement, protocol, awaited = false) => ({ kind: "ForOfStatement",
      awaitModifier: awaited ? token("AwaitKeyword") : null, initializer, expression, statement, tsonic: { protocol: decided(protocol) } }),
    declare: (declarations, role = { role: "ordinary" }) => ({ kind: "VariableStatement", modifiers: null,
      declarationList: { kind: "VariableDeclarationList", declarations: list(...declarations), tsonic: role }, tsonic: null }),
    declarationList: (declarations, role = { role: "ordinary" }) =>
      ({ kind: "VariableDeclarationList", declarations: list(...declarations), tsonic: role }),
    variable: (nameNode, local, storage, initializer = null, initializerBody = null) => ({ kind: "VariableDeclaration", name: nameNode,
      exclamationToken: null, type: null, initializer,
      tsonic: { declaration: { kind: "local", local: localRef(local) }, storage, initializer: initializerBody } }),
    tryStatement: (tryBlock, catchClause, finallyBlock) => ({ kind: "TryStatement", tryBlock, catchClause, finallyBlock, tsonic: null }),
    catchClause: (variableDeclaration, block) => ({ kind: "CatchClause", variableDeclaration, block, tsonic: null }),
    switchStatement: (expression, clauses) => ({ kind: "SwitchStatement", expression,
      caseBlock: { kind: "CaseBlock", clauses: list(...clauses), tsonic: null }, tsonic: null }),
    caseClause: (expression, ...statements) => ({ kind: "CaseClause", expression, statements: list(...statements), tsonic: null }),
    defaultClause: (...statements) => ({ kind: "DefaultClause", expression: null, statements: list(...statements), tsonic: null }),
    breaks: (target, labelNode = null) => ({ kind: "BreakStatement", label: labelNode,
      tsonic: at => ({ target: nodeRef(at(target)), initializer: null }) }),
    continues: (target, labelNode = null) => ({ kind: "ContinueStatement", label: labelNode,
      tsonic: at => ({ target: nodeRef(at(target)), initializer: null }) }),
    labeled: (labelNode, statement, self) => ({ kind: "LabeledStatement", label: labelNode, statement,
      tsonic: at => ({ target: nodeRef(at(self)), initializer: null }) }),
    awaits: (expression, type, protocol) => ({ kind: "AwaitExpression", expression, tsonic: { ...value(type), protocol: decided(protocol) } }),
    yields: (expression, type, protocol, delegate = false) => ({ kind: "YieldExpression",
      asteriskToken: delegate ? token("AsteriskToken") : null, expression, tsonic: { ...value(type), protocol: decided(protocol) } }),
  };
  return b;
}

// ---- protocols ----------------------------------------------------------------------------
export const step = (role, decision, stepCallee = null) => ({ role, operation: typedOperation(decision), callee: stepCallee });
export const protocol = (kind, steps, valueType, completion = T.void, extra = {}) =>
  ({ kind, asynchronous: false, steps, value: valueType, completion, sent: null, thrown: T.unknown, ...extra });

// ---- sealing ------------------------------------------------------------------------------
const isNode = value => value !== null && typeof value === "object" && typeof value.kind === "string" && "tsonic" in value;
const isList = value => value !== null && typeof value === "object" && value.$list === true;

/** Assigns node identities in pre-order. Returns the sealed root and the label table. */
export function seal(name, root) {
  const body = bodyId(name);
  const labels = new Map();
  const pending = [];
  let next = 0;
  const visit = (node, parent) => {
    const id = next;
    next += 1;
    const { $: label, tsonic, ...rest } = node;
    if (label !== undefined) {
      if (labels.has(label)) throw new Error(`Label ${label} is used twice in ${name}.`);
      labels.set(label, id);
    }
    const sealed = { id, origin: { module: MODULE, start: id, length: 1, derived: [] }, parent, flags: [], loc: LOC };
    for (const [key, child] of Object.entries(rest)) {
      sealed[key] = isNode(child) ? visit(child, id) : isList(child) ? { loc: LOC, nodes: child.nodes.map(item => visit(item, id)) } : child;
    }
    sealed.tsonic = tsonic;
    if (typeof tsonic === "function") pending.push(sealed);
    return sealed;
  };
  const sealedRoot = visit(root, null);
  const at = label => {
    if (!labels.has(label)) throw new Error(`Label ${label} is not defined in ${name}.`);
    return labels.get(label);
  };
  for (const node of pending) node.tsonic = node.tsonic(at);
  return { root: sealedRoot, labels, at, nodeRef: label => ({ body, node: at(label) }), count: next };
}

/** A complete TirBody. `locals` rows: [name, role, storage, mutable]; `params` rows: [localIndex, role, storage, initializerBody]. */
export function typedBody(name, { signature: signatureId, completion, params = [], locals = [], root, captures = [],
  nestedBodies = [], asynchronous = false, generator = false, yielded = null, sent = null, extra = {} }) {
  const body = bodyId(name);
  const sealed = seal(name, root);
  return {
    labels: sealed.labels, at: sealed.at, nodeRef: sealed.nodeRef, nodeCount: sealed.count,
    tir: {
      body, owner: def(name), bindings: PARAMETRIC, lexicalBindings: EMPTY_BINDINGS, dependence: "parametric",
      signature: signatureId, completion, yielded, sent,
      params: params.map(([local, role, storage, initializer = null, passing = "by-value"]) =>
        ({ local, declaration: def(`${name}.${locals[local][0]}`), role, passing, initializer, storage })),
      locals: locals.map(([localName, role, storage, mutable = false, capturedFrom = null], id) =>
        ({ id, declaration: { kind: "body", value: { body, node: 0 } }, name: localName, role, capturedFrom, mutable, storage })),
      root: sealed.root, nestedBodies, captures, scopes: [], evidence: [], asynchronous, generator, ...extra,
    },
  };
}
