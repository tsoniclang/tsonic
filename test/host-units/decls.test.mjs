// Unit cases of Decls (COMPONENTS section 2): `describeDefinitions` and `declaredSignatureOf` with its resume.
//
// The checked modules here are written by hand: each holds exactly the records Decls reads (the syntax tree with the
// checked payloads of its declarations, the declaration entries, the bodies) for the program it names, and nothing
// else. They are unit inputs, not Front's output; the product case on Front's real output for the same program is
// checkpoint 2's composition case and replaces none of these (K-3270, K-3284 item 5). Every expected value below is
// written from the signed text and the rulings it cites, not read off a run.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index.js", "definitions.js", "signatures.js", "placement.js"].map(name => resolve(repository, "packages/host/dist/decls", name));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let decls;
let hir;
let ids;
let types;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "decls tests run under the aggregate resource guard");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  decls = await import("../../packages/host/dist/decls/index.js");
  hir = await import("../../packages/host/dist/ir-hir/index.js");
  ids = await import("../../packages/host/dist/ids/index.js");
  types = await import("../../packages/host/dist/ir-types/index.js");
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
      project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, runtimeFiles, raw);
    const directory = resolve(repository, ".temp/decls-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, runtimeFiles.length, "each decls runtime file has real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally { session.disconnect(); }
});

/** A checked module as Decls receives it: with its node table, built once with ir-hir's indexSyntaxTree. */
const checked = module => ({ module, nodes: hir.indexSyntaxTree(module.tree) });
/**
 * The modules of a program as Decls receives them, assembled here as Pipeline assembles them at the barrier: each with
 * its node table, and the list checked once to be in strictly ascending order of module identity (the contract's rule).
 */
const assembled = modules => {
  const list = modules.map(checked);
  for (let index = 1; index < list.length; index += 1)
    assert.ok(list[index - 1].module.module < list[index].module.module, `the modules are in strictly ascending order of identity at position ${index}`);
  return list;
};

// ---- hand-written checked modules -----------------------------------------------------------------------------------
const MODULE = "M[P[p];m]";
const segment = (name, ordinal = 0) => ({ name, ordinal });
const definitionOf = (...segments) => ids.encodeDefId({ module: MODULE, segments });
const bodyOf = (owner, role, ordinal = 0) => ids.encodeBodyId({ owner, role, ordinal });
const LOC = { pos: 0, end: 64 };
const facts = parent => ({ core: null, parent, attributes: [], memory: { kind: "available", value: null } });

/** Nodes in the order given, which must be preorder: each gets its position as its identity and its parent's identity. */
function numbered(entries, module = MODULE) {
  return entries.map(([node, parent], id) => Object.assign(node, { id, parent, origin: { module, start: id, length: 1, derived: [] }, flags: [], loc: LOC }));
}
const list = nodes => ({ loc: LOC, nodes });
const token = kind => ({ kind, tsonic: null });
const name = (text, definition) => ({ kind: "Identifier", text, tsonic: { core: null, role: "declaration-name", declaration: { kind: "definition", definition } } });

/**
 * `function add(a: number, b: number): number { return a + b; }`, written as the checked module of the one source
 * file, with `exported` deciding whether the export entries give `add` the export name `add`. The module's own
 * definition has the empty local path (K-3291); `add`, `a`, `b` are its declaration entries in identity order.
 * `form` writes the result without its annotation (`inferredResult`) and `b` as `b = 1` (`defaultedB`).
 */
const DECLARED = { inferredResult: false, defaultedB: false };
function addModule(signature, module = MODULE, form = DECLARED) {
  const definitionOf = (...segments) => ids.encodeDefId({ module, segments });
  const moduleDefinition = definitionOf();
  const add = definitionOf(segment("add"));
  const a = definitionOf(segment("add"), segment("a"));
  const b = definitionOf(segment("add"), segment("b"));
  const moduleBody = bodyOf(moduleDefinition, "module");
  const addBody = bodyOf(add, "function");
  const parameter = (text, definition, defaulted = false) => ({ kind: "Parameter", modifiers: null, dotDotDotToken: null, name: name(text, definition), questionToken: null,
    type: defaulted ? null : token("NumberKeyword"), initializer: defaulted ? { kind: "NumericLiteral", text: "1", tokenFlags: [], tsonic: null } : null, tsonic: { ...facts(add), declaration: { kind: "definition", definition }, declaredType: { kind: "available", value: 0 }, initializer: null } });
  const pa = parameter("a", a);
  const pb = parameter("b", b, form.defaultedB);
  const fn = { kind: "FunctionDeclaration", modifiers: null, asteriskToken: null, name: name("add", add), typeParameters: null, parameters: list([pa, pb]),
    type: form.inferredResult ? null : token("NumberKeyword"), fullSignature: null, body: { kind: "Block", statements: list([]), multiLine: false, tsonic: null },
    tsonic: { ...facts(moduleDefinition), definition: add, parameters: [], signatures: [{ declaration: add, role: "api-body", signature, body: addBody }], body: addBody } };
  const root = { kind: "SourceFile", statements: list([fn]), endOfFileToken: token("EndOfFile"), languageVariant: "Standard", scriptKind: "TS",
    commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { ...facts(null), definition: moduleDefinition, body: moduleBody } };
  // Preorder, with each parent named by node: an absent annotation is no node, a default is one more.
  const order = [[root, null], [fn, root], [fn.name, fn], [pa, fn], [pa.name, pa], [pa.type, pa], [pb, fn], [pb.name, pb], [pb.type ?? pb.initializer, pb],
    [fn.type, fn], [fn.body, fn], [root.endOfFileToken, root]].filter(([node]) => node !== null);
  numbered(order.map(([node, parent]) => [node, parent === null ? null : order.findIndex(([candidate]) => candidate === parent)]), module);
  const entries = [{ definition: add, node: fn.id }, { definition: a, node: pa.id }, { definition: b, node: pb.id }]
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  const body = (identity, owner) => ({ body: identity, owner, params: [], locals: [], root: fn.body, captures: [], scopes: [], asynchronous: false,
    generator: false, candidateLists: [], nestedBodies: [] });
  return { module: { module, tree: root, items: entries, bodies: [body(moduleBody, moduleDefinition), body(addBody, add)], checkerDiagnostics: [], obligations: [] },
    moduleDefinition, add, a, b, moduleBody, addBody, nodes: { fn, pa, pb } };
}

/** The program's types for `add`: term 0 is TypeScript `number`, the native float64 primitive (K-3291), and signature 0 is `add`'s. */
function addTypes(program, signatureFor) {
  const table = { terms: [{ kind: "primitive", primitive: "float64" }], signatures: [] };
  const interner = types.seedTypeInterner(table);
  const id = types.internSignature(interner, signatureFor(program));
  return { interner, id };
}
const declaredAdd = ({ add, a, b }) => ({ declaration: add, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
  parameters: [a, b].map(declaration => ({ declaration, kind: "required", type: 0, passing: "by-value", initializer: null })), result: 0 });
const NO_EXPANSION_LIMIT = { maximumDepth: 1000, maximumVisits: 100000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 };

/** `add`'s checked module with its signature interned at the identity it receives. */
function addProgram(signatureFor = declaredAdd) {
  const shell = addModule(0);
  const { interner, id } = addTypes(shell, signatureFor);
  const program = addModule(id);
  return { ...program, inputs: { modules: [checked(program.module)], types: interner, typeExpansion: NO_EXPANSION_LIMIT } };
}
const request = (program, extra = {}) => ({ definition: program.add, endpoint: "api-body", ordinal: 0, bindings: { kind: "parametric" }, ...extra });
const partOrigin = (body, variable) => {
  const group = ids.encodeGroupId([body]);
  return { request: { query: "solutionOf", key: group }, position: { kind: "inference-variable", group, variable } };
};
const EMPTY_VECTOR = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };

test("SP1 placement is one Decls constructor for actual endpoints and execution bodies, with no forged module endpoint", () => {
  const program = addProgram();
  program.module.bodies.sort((left, right) => left.body < right.body ? -1 : 1);
  const unit = { query: "solutionOf", key: ids.encodeGroupId([program.addBody]) };
  const instance = { body: program.addBody, bindings: { kind: "parametric" } };
  const endpoint = { kind: "endpoint", request: request(program), parts: [] };
  const callable = { kind: "callable-body", instance, parts: [] };
  const place = placement => decls.placeSignature(program.inputs, placement, unit);
  const declared = decls.declaredSignatureOf(program.inputs, request(program)).value.value;
  assert.equal(place(endpoint).value.value.id, declared.id);
  assert.equal(place(callable).value.value.id, declared.id);
  program.nodes.fn.type = null;
  const part = { definition: program.add, part: { kind: "return" } };
  const ready = { origin: partOrigin(program.addBody, 0), part, type: 0, error: null };
  for (const origin of [undefined, { ...ready.origin, position: { kind: "result" } },
    { ...ready.origin, request: { query: "solutionOf", key: "different-group" } },
    ...[-1, -0, 0.5, Infinity, NaN].map(variable => ({ ...ready.origin, position: { ...ready.origin.position, variable } }))])
    assert.throws(() => place({ ...callable, parts: [{ ...ready, origin }] }), /actual finalized variable origin/u);
  const pending = decls.declaredSignatureOf(program.inputs, request(program));
  const resumed = decls.resumeDeclaredSignatureOf(program.inputs, pending.paused, [{ origin: partOrigin(program.addBody, 0), part: pending.requests[0].part, type: 0, error: null }]);
  assert.equal(place({ ...endpoint, parts: [ready] }).value.value.id, resumed.value.value.id);
  assert.equal(place({ ...callable, parts: [ready] }).value.value.id, resumed.value.value.id);
  const error = types.internType(program.inputs.types, { kind: "error" });
  const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: MODULE, index: 0 } } };
  const failed = place({ ...callable, parts: [{ origin: partOrigin(program.addBody, 0), part, type: error, error: { kind: "error", causes: [cause] } }] });
  assert.equal(failed.value.value.parameters.every(parameter => parameter.type === 0), true);
  assert.equal(failed.value.value.result, error);
  assert.equal(failed.value.positions.at(-1).error.causes[0].unit.request === unit, true);
  for (const parts of [[], [ready, ready], [{ ...ready, part: { definition: program.a, part: { kind: "return" } } }],
    [{ ...ready, part: { definition: program.add, part: { kind: "yield" } } }]])
    assert.throws(() => place({ ...endpoint, parts }), /actual inferred parts/u);
  program.nodes.fn.type = token("NumberKeyword");
  const voidType = types.internType(program.inputs.types, { kind: "intrinsic", intrinsic: "void" });
  const execution = { kind: "execution-body", instance: { body: program.moduleBody, bindings: { kind: "parametric" } }, completion: voidType, error: null };
  const placedModule = place(execution).value.value;
  assert.equal(placedModule.declaration, null);
  assert.equal(placedModule.result, voidType);
  const sourceBody = program.module.bodies.find(body => body.body === program.moduleBody);
  assert.deepEqual(placedModule.owner, { kind: "body", value: { body: program.moduleBody, node: sourceBody.root.id } });
  assert.deepEqual(placedModule.parameters, []);
  assert.equal(placedModule.receiver, null);
  const failedExecution = place({ ...execution, completion: error, error: { kind: "error", causes: [cause] } });
  assert.equal(failedExecution.value.value.result, error);
  assert.equal(failedExecution.value.positions[0].error.causes[0] === cause, true);
  for (const placement of [
    { ...execution, kind: "unknown" }, { ...execution, completion: 0 }, { ...execution, instance },
    { ...callable, instance: execution.instance }, { ...execution, instance: { ...execution.instance, body: "bad" } },
    { ...execution, instance: { ...execution.instance, body: bodyOf(program.moduleDefinition, "module", 1) } },
    { ...execution, instance: { ...execution.instance, body: bodyOf(definitionOf(segment("missing")), "initializer") } },
  ]) assert.throws(() => place(placement), error => error.name === "Error");
  const endpoints = program.nodes.fn.tsonic.signatures;
  program.nodes.fn.tsonic.signatures = [];
  assert.throws(() => place(callable), /any actual endpoint/u);
  program.nodes.fn.tsonic.signatures = [endpoints[0], endpoints[0]];
  assert.throws(() => place(callable), /more than one endpoint/u);
  program.nodes.fn.tsonic.signatures = endpoints;
  const bound = { kind: "instantiated", bindings: EMPTY_VECTOR };
  assert.equal(place({ ...callable, instance: { ...instance, bindings: bound } }).value.value.id, declared.id);
  const limited = { ...program.inputs, typeExpansion: { ...NO_EXPANSION_LIMIT, maximumVisits: 0 } };
  assert.equal(decls.placeSignature(limited, { ...endpoint, request: request(program, { bindings: bound }) }, unit).value.kind, "refused");
  assert.equal(decls.placeSignature(limited, { ...execution, instance: { ...execution.instance, bindings: bound } }, unit).value.kind, "refused");
});

// ---- describeDefinitions ---------------------------------------------------------------------------------------------
test("SP1 placement retains exact default-part ordering, not a different parameter's ready answer", () => {
  const shell = addModule(0, MODULE, { inferredResult: true, defaultedB: true });
  const { interner, id } = addTypes(shell, declaredAdd);
  const program = addModule(id, MODULE, { inferredResult: true, defaultedB: true });
  const inputs = { modules: [checked(program.module)], types: interner, typeExpansion: NO_EXPANSION_LIMIT };
  const placement = { kind: "endpoint", request: request(program), parts: [
    { origin: partOrigin(program.addBody, 0), part: { definition: program.add, part: { kind: "return" } }, type: 0, error: null },
    { origin: partOrigin(program.addBody, 0), part: { definition: program.add, part: { kind: "parameter-initializer", index: 1 } }, type: 0, error: null },
  ] };
  const unit = { query: "solutionOf", key: program.addBody };
  assert.equal(decls.placeSignature(inputs, placement, unit).value.kind, "ok");
  placement.parts[1].part.part.index = 0;
  assert.throws(() => decls.placeSignature(inputs, placement, unit), /actual inferred parts/u);
});

test("SP1 constructor validates ready execution parameter evidence and actual callable inventories", () => {
  const program = addProgram();
  program.module.bodies.sort((left, right) => left.body < right.body ? -1 : 1);
  const body = program.module.bodies.find(body => body.body === program.addBody);
  const unit = { query: "solutionOf", key: program.addBody };
  const place = placement => decls.placeSignature(program.inputs, placement, unit);
  const callable = { kind: "callable-body", instance: { body: program.addBody, bindings: { kind: "parametric" } }, parts: [] };
  const signatures = program.nodes.fn.tsonic.signatures;
  program.nodes.fn.tsonic.signatures = [{ ...signatures[0], body: null }, signatures[0]];
  assert.equal(place(callable).value.value.id, signatures[0].signature);
  delete program.nodes.fn.tsonic.signatures;
  assert.throws(() => place(callable), /endpoint inventory/u);
  program.nodes.fn.tsonic.signatures = signatures;
  const modules = program.inputs.modules;
  program.inputs.modules = [];
  assert.throws(() => place(callable), /checked module/u);
  program.inputs.modules = [{ ...modules[0], nodes: [] }];
  assert.throws(() => place(callable), /node table/u);
  program.inputs.modules = modules;
  const owner = body.owner;
  body.owner = "invalid";
  assert.throws(() => place(callable), /actual body of its owner/u);
  body.owner = definitionOf(segment("absent"));
  body.body = bodyOf(body.owner, "function");
  program.module.bodies.sort((left, right) => left.body < right.body ? -1 : 1);
  assert.throws(() => place({ ...callable, instance: { ...callable.instance, body: body.body } }), /not a declaration/u);
  body.owner = owner;
  const definition = program.module.tree.tsonic.definition;
  body.owner = definition;
  body.body = bodyOf(body.owner, "function");
  program.module.bodies.sort((left, right) => left.body < right.body ? -1 : 1);
  assert.throws(() => place({ ...callable, instance: { ...callable.instance, body: body.body } }), /endpoint inventory/u);
  body.owner = owner;
  const locals = [program.nodes.pa, program.nodes.pb].map((node, id) => ({ id, declaration: {
    kind: "body", value: { body: program.addBody, node: node.id } } }));
  body.body = bodyOf(owner, "field-initializer");
  body.locals = locals;
  body.params = [program.nodes.pa, program.nodes.pb].map((node, index) => ({ local: index,
    declaration: index === 0 ? program.a : program.b, role: index === 0 ? "this" : "required",
    passing: "by-value", initializer: null }));
  program.module.bodies.sort((left, right) => left.body < right.body ? -1 : 1);
  const execution = { kind: "execution-body", instance: { body: body.body, bindings: { kind: "parametric" } }, completion: 0, error: null };
  const signature = place(execution).value.value;
  assert.equal(signature.receiver, 0);
  assert.deepEqual(signature.parameters, [{ declaration: program.b, kind: "required", type: 0, passing: "by-value", initializer: null }]);
  body.params[1] = { ...body.params[1], role: "this" };
  assert.throws(() => place(execution), /leading actual parameter/u);
  body.params = [body.params[0]];
  const saved = body.locals[0];
  for (const replacement of [undefined, { ...saved, declaration: { kind: "body", value: { body: body.body, node: 999 } } },
    { ...saved, declaration: { kind: "body", value: { body: body.body, node: program.nodes.fn.id } } }]) {
    body.locals[0] = replacement;
    assert.throws(() => place(execution), /actual checked declared type/u);
  }
  body.locals[0] = saved;
  const declaredType = program.nodes.pa.tsonic.declaredType;
  for (const value of [{ kind: "unavailable", reason: "checker-error" }, { kind: "available", value: null }]) {
    program.nodes.pa.tsonic.declaredType = value;
    assert.throws(() => place(execution), /actual checked declared type/u);
  }
  program.nodes.pa.tsonic.declaredType = declaredType;
  body.body = bodyOf(owner, "class-static-initializer");
  body.params = [];
  const staticPlacement = { ...execution, instance: { ...execution.instance, body: body.body },
    completion: types.internType(program.inputs.types, { kind: "intrinsic", intrinsic: "void" }) };
  assert.equal(place(staticPlacement).value.value.result, staticPlacement.completion);
});

test("describeDefinitions on add: the module's own definition, then add, a, b; kinds, parents, owned bodies, no visibility, export names as given", () => {
  const program = addProgram();
  const path = (...segments) => ({ module: MODULE, segments });
  const none = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const row = (definition, kind, parent, bodies, exports, segments) => ({ definition, path: path(...segments), kind, visibility: null, parent, bodies, generics: none, exports });
  const expected = exports => ({ module: MODULE, definitions: [
    row(program.moduleDefinition, "SourceFile", null, [program.moduleBody], [], []),
    ...program.module.items.map(entry => entry.definition === program.add
      ? row(program.add, "FunctionDeclaration", program.moduleDefinition, [program.addBody], exports, [segment("add")])
      : row(entry.definition, "Parameter", program.add, [], [], [segment("add"), segment(entry.definition === program.a ? "a" : "b")])),
  ] });
  assert.deepEqual(decls.describeDefinitions(checked(program.module), []), expected([]), "not exported");
  const exported = [{ module: MODULE, name: "add" }];
  assert.deepEqual(decls.describeDefinitions(checked(program.module), [{ definition: program.add, exports: exported }]), expected(exported), "exported as add");
  assert.deepEqual(program.module.items.map(entry => entry.definition), [program.add, program.a, program.b].sort(), "entries in identity order");
});

test("describeDefinitions: visibility is the authored accessibility of an actual class member and null for every other definition", () => {
  // class C { private x = 0; m() {} constructor(protected p, q, public r, readonly s, override o, declare d) {} }, with two static initializer bodies, and an interface I below.
  const moduleDefinition = definitionOf();
  const C = definitionOf(segment("C"));
  const member = (...rest) => definitionOf(segment("C"), ...rest);
  const modifiers = (...kinds) => list(kinds.map(token));
  const declaration = parent => ({ ...facts(parent), definition: null });
  const x = { kind: "PropertyDeclaration", modifiers: modifiers("PrivateKeyword"), name: name("x", member(segment("x"))), postfixToken: null, type: null, initializer: null,
    tsonic: { ...facts(C), declaration: { kind: "definition", definition: member(segment("x")) }, declaredType: { kind: "available", value: null }, initializer: null } };
  const m = { kind: "MethodDeclaration", modifiers: null, asteriskToken: null, name: name("m", member(segment("m"))), postfixToken: null, typeParameters: null,
    parameters: list([]), type: null, fullSignature: null, body: null, tsonic: { ...declaration(C), definition: member(segment("m")), parameters: [], signatures: [], body: null } };
  const parameterOf = (text, mods) => ({ kind: "Parameter", modifiers: mods, dotDotDotToken: null, name: name(text, member(segment("", 0), segment(text))),
    questionToken: null, type: null, initializer: null,
    tsonic: { ...facts(member(segment("", 0))), declaration: { kind: "definition", definition: member(segment("", 0), segment(text)) }, declaredType: { kind: "available", value: null }, initializer: null } });
  const p = parameterOf("p", modifiers("ProtectedKeyword"));
  const q = parameterOf("q", null);
  const r = parameterOf("r", modifiers("PublicKeyword"));
  const s = parameterOf("s", modifiers("ReadonlyKeyword"));
  const o = parameterOf("o", modifiers("OverrideKeyword"));
  const d = parameterOf("d", modifiers("DeclareKeyword"));
  const ctor = { kind: "Constructor", modifiers: null, typeParameters: null, parameters: list([p, q, r, s, o, d]), type: null, fullSignature: null, asteriskToken: null, body: null,
    tsonic: { ...declaration(C), definition: member(segment("", 0)), parameters: [], signatures: [], body: null } };
  const cls = { kind: "ClassDeclaration", modifiers: null, name: name("C", C), typeParameters: null, heritageClauses: null, members: list([x, m, ctor]),
    tsonic: { ...declaration(moduleDefinition), definition: C, parameters: [], heritage: [] } };
  // interface I { [k: string]: number }: an index signature that is no class member.
  const I = definitionOf(segment("I"));
  const index = { kind: "IndexSignature", modifiers: modifiers("PrivateKeyword"), typeParameters: null, parameters: list([]), type: null, fullSignature: null,
    tsonic: { ...declaration(I), definition: definitionOf(segment("I"), segment("", 0)), parameters: [], signatures: [], body: null } };
  const iface = { kind: "InterfaceDeclaration", modifiers: null, name: name("I", I), typeParameters: null, heritageClauses: null, members: list([index]),
    tsonic: { ...declaration(moduleDefinition), definition: I, parameters: [], heritage: [] } };
  const root = { kind: "SourceFile", statements: list([cls, iface]), endOfFileToken: token("EndOfFile"), languageVariant: "Standard", scriptKind: "TS",
    commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { ...facts(null), definition: moduleDefinition, body: bodyOf(moduleDefinition, "module") } };
  const order = [[root, null], [cls, root], [cls.name, cls], [x, cls], [x.modifiers.nodes[0], x], [x.name, x], [m, cls], [m.name, m], [ctor, cls]];
  for (const parameter of [p, q, r, s, o, d]) {
    order.push([parameter, ctor]);
    for (const modifier of parameter.modifiers === null ? [] : parameter.modifiers.nodes) order.push([modifier, parameter]);
    order.push([parameter.name, parameter]);
  }
  order.push([iface, root], [iface.name, iface], [index, iface], [index.modifiers.nodes[0], index], [root.endOfFileToken, root]);
  numbered(order.map(([node, parent]) => [node, parent === null ? null : order.findIndex(([candidate]) => candidate === parent)]));
  const items = [[C, cls], [member(segment("x")), x], [member(segment("m")), m], [member(segment("", 0)), ctor],
    ...[p, q, r, s, o, d].map(parameter => [member(segment("", 0), segment(parameter.name.text)), parameter]), [I, iface],
    [definitionOf(segment("I"), segment("", 0)), index]].map(([definition, node]) => ({ definition, node: node.id }));
  // Two static initializer bodies of C: a definition owns its bodies in the module's body order.
  const statics = [bodyOf(C, "class-static-initializer", 0), bodyOf(C, "class-static-initializer", 1)];
  const bodies = statics.map(body => ({ body, owner: C, params: [], locals: [], root: cls, captures: [], scopes: [], asynchronous: false, generator: false,
    candidateLists: [], nestedBodies: [] }));
  const table = decls.describeDefinitions(checked({ module: MODULE, tree: root, items, bodies, checkerDiagnostics: [], obligations: [] }), []);
  assert.deepEqual(table.definitions.map(row => [row.kind, row.visibility]), [["SourceFile", null], ["ClassDeclaration", null], ["PropertyDeclaration", "private"],
    ["MethodDeclaration", "public"], ["Constructor", "public"], ["Parameter", "protected"], ["Parameter", null], ["Parameter", "public"], ["Parameter", "public"],
    ["Parameter", "public"], ["Parameter", null], ["InterfaceDeclaration", null], ["IndexSignature", null]]);
  assert.deepEqual(table.definitions[1].bodies, statics);
});

test("describeDefinitions: a member with a private name is private; keywords decide otherwise; one private name in two classes is two members (K-3312)", () => {
  // class A { #f = 0; #m() {} get #g() {} set #g(v) {} public p = 0; q = 0; private r = 0; }  class B { #f = 0; }
  const moduleDefinition = definitionOf();
  const owner = name => definitionOf(segment(name));
  const memberOf = (cls, name, ordinal = 0) => definitionOf(segment(cls), segment(name, ordinal));
  const privateName = (text, definition) => ({ kind: "PrivateIdentifier", text, tsonic: { core: null, role: "declaration-name", declaration: { kind: "definition", definition } } });
  const variable = (parent, definition) => ({ ...facts(parent), declaration: { kind: "definition", definition }, declaredType: { kind: "available", value: null }, initializer: null });
  const callable = (parent, definition) => ({ ...facts(parent), definition, parameters: [], signatures: [], body: null });
  const property = (cls, nameNode, definition, mods = null) => ({ kind: "PropertyDeclaration", modifiers: mods, name: nameNode, postfixToken: null, type: null, initializer: null,
    tsonic: variable(owner(cls), definition) });
  const accessor = (kind, cls, nameNode, definition) => ({ kind, modifiers: null, name: nameNode, postfixToken: null, typeParameters: null, parameters: list([]), type: null,
    fullSignature: null, asteriskToken: null, body: null, tsonic: callable(owner(cls), definition) });
  const declared = (cls, members) => ({ kind: "ClassDeclaration", modifiers: null, name: name(cls, owner(cls)), typeParameters: null, heritageClauses: null, members: list(members),
    tsonic: { ...facts(moduleDefinition), definition: owner(cls), parameters: [], heritage: [] } });
  const aMembers = [
    property("A", privateName("#f", memberOf("A", "#f")), memberOf("A", "#f")),
    accessor("MethodDeclaration", "A", privateName("#m", memberOf("A", "#m")), memberOf("A", "#m")),
    accessor("GetAccessor", "A", privateName("#g", memberOf("A", "#g")), memberOf("A", "#g")),
    accessor("SetAccessor", "A", privateName("#g", memberOf("A", "#g", 1)), memberOf("A", "#g", 1)),
    property("A", name("p", memberOf("A", "p")), memberOf("A", "p"), list([token("PublicKeyword")])),
    property("A", name("q", memberOf("A", "q")), memberOf("A", "q")),
    property("A", name("r", memberOf("A", "r")), memberOf("A", "r"), list([token("PrivateKeyword")])),
  ];
  const bMembers = [property("B", privateName("#f", memberOf("B", "#f")), memberOf("B", "#f"))];
  const A = declared("A", aMembers), B = declared("B", bMembers);
  // ({ m() {} }): an object literal's method is no class member, so it has no visibility.
  const objectMethod = accessor("MethodDeclaration", "A", name("m", definitionOf(segment("", 0), segment("m"))), definitionOf(segment("", 0), segment("m")));
  objectMethod.tsonic = callable(moduleDefinition, definitionOf(segment("", 0), segment("m")));
  const literal = { kind: "ObjectLiteralExpression", properties: list([objectMethod]), multiLine: false, tsonic: null };
  const statement = { kind: "ExpressionStatement", expression: literal, tsonic: null };
  const root = { kind: "SourceFile", statements: list([A, B, statement]), endOfFileToken: token("EndOfFile"), languageVariant: "Standard", scriptKind: "TS",
    commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { ...facts(null), definition: moduleDefinition, body: bodyOf(moduleDefinition, "module") } };
  const order = [[root, null], [A, root], [A.name, A]];
  for (const entry of aMembers) { order.push([entry, A]); if (entry.modifiers !== null) for (const modifier of entry.modifiers.nodes) order.push([modifier, entry]); order.push([entry.name, entry]); }
  order.push([B, root], [B.name, B]);
  for (const entry of bMembers) order.push([entry, B], [entry.name, entry]);
  order.push([statement, root], [literal, statement], [objectMethod, literal], [objectMethod.name, objectMethod], [root.endOfFileToken, root]);
  numbered(order.map(([node, parent]) => [node, parent === null ? null : order.findIndex(([candidate]) => candidate === parent)]));
  const items = [A, ...aMembers, B, ...bMembers, objectMethod].map(node => ({ definition: node.kind === "ClassDeclaration" ? node.tsonic.definition : node.tsonic.declaration?.definition ?? node.tsonic.definition, node: node.id }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  const table = decls.describeDefinitions(checked({ module: MODULE, tree: root, items, bodies: [], checkerDiagnostics: [], obligations: [] }), []);
  const visibility = new Map(table.definitions.map(row => [row.definition, row.visibility]));
  assert.deepEqual(["#f", "#m", "#g"].map(text => visibility.get(memberOf("A", text))), ["private", "private", "private"], "private field, method, getter");
  assert.equal(visibility.get(memberOf("A", "#g", 1)), "private", "private setter");
  assert.deepEqual(["p", "q", "r"].map(text => visibility.get(memberOf("A", text))), ["public", "public", "private"], "public keyword, none, private keyword");
  assert.notEqual(memberOf("A", "#f"), memberOf("B", "#f"), "one private name in two classes: two qualified identities");
  assert.deepEqual([visibility.get(memberOf("A", "#f")), visibility.get(memberOf("B", "#f"))], ["private", "private"]);
  assert.deepEqual([visibility.get(owner("A")), visibility.get(owner("B")), visibility.get(moduleDefinition)], [null, null, null]);
  assert.equal(visibility.get(definitionOf(segment("", 0), segment("m"))), null, "an object literal's method");
});

test("describeDefinitions: a declaration entry whose node is missing or carries no checked declaration is an invariant failure", () => {
  const program = addProgram();
  const failsWith = (module, text) => assert.throws(() => decls.describeDefinitions(checked(module), []), error => String(error.message).includes(text));
  failsWith({ ...program.module, items: [...program.module.items, { definition: program.add, node: 99 }] }, "which the module does not have");
  failsWith({ ...program.module, items: [{ definition: program.add, node: program.nodes.fn.name.id }] }, "carries no checked declaration");
  failsWith({ ...program.module, items: [{ definition: program.add, node: program.nodes.fn.type.id }] }, "carries no checked declaration");
  failsWith({ ...program.module, items: [{ definition: "not an identity", node: program.nodes.fn.id }] }, "does not decode");
  // The inverse export names: one entry per definition, each for a definition of this module (R4's F-2).
  const exported = [{ module: MODULE, name: "add" }];
  assert.throws(() => decls.describeDefinitions(checked(program.module), [{ definition: program.add, exports: exported }, { definition: program.add, exports: exported }]),
    error => String(error.message).includes("two export-name entries"));
  assert.throws(() => decls.describeDefinitions(checked(program.module), [{ definition: definitionOf(segment("elsewhere")), exports: exported }]),
    error => String(error.message).includes("not a definition of this module"));
  assert.equal(decls.describeDefinitions(checked(program.module), [{ definition: program.moduleDefinition, exports: [] }]).definitions[0].exports.length, 0,
    "the module's own definition may have an entry");
});

// ---- declaredSignatureOf ------------------------------------------------------------------------------------------
test("declaredSignatureOf on add: done at once with Front's own signature row, no request (WT-1)", () => {
  const program = addProgram();
  const signature = types.readSignature(program.inputs.types, program.module.tree.statements.nodes[0].tsonic.signatures[0].signature);
  const step = decls.declaredSignatureOf(program.inputs, request(program));
  assert.deepEqual(step, { kind: "done", value: { kind: "ok", emissions: [], value: signature, diagnostics: [], positions: [...signature.parameters.map((_, index) => ({ position: { kind: "component", path: types.encodeSelectorPath([{ kind: "parameter", signature: signature.id, index }]) }, error: null })), { position: { kind: "component", path: types.encodeSelectorPath([{ kind: "result", signature: signature.id }]) }, error: null }, { position: { kind: "result" }, error: null }] } });
  assert.deepEqual(signature, { id: signature.id, declaration: program.add, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: [program.a, program.b].map(declaration => ({ declaration, kind: "required", type: 0, passing: "by-value", initializer: null })), result: 0 });
  assert.deepEqual(types.readType(program.inputs.types, signature.result), { kind: "primitive", primitive: "float64" }, "the interned type is returned unchanged: number as the float64 primitive (K-3291)");
  // An instantiated empty vector substitutes nothing: the same row.
  assert.deepEqual(decls.declaredSignatureOf(program.inputs, request(program, { bindings: { kind: "instantiated", bindings: EMPTY_VECTOR } })), step);
  // Asked twice, the same answer.
  assert.deepEqual(decls.declaredSignatureOf(program.inputs, request(program)), step);
});

test("declaredSignatureOf over several modules: each module found among the program's modules, in ascending order of identity", () => {
  // Three modules m0, m2, m4 each with its add; the type interner is shared. A request for each is answered with its
  // own module's row; a module between them (m1, m3) or past them (m9) is not a checked module of the program.
  const interner = types.seedTypeInterner({ terms: [{ kind: "primitive", primitive: "float64" }], signatures: [] });
  const moduleIdentity = path => ids.encodeModuleId({ package: "P[p]", path });
  const modules = ["m0", "m2", "m4"].map(path => {
    const shell = addModule(0, moduleIdentity(path));
    return addModule(types.internSignature(interner, declaredAdd(shell)), moduleIdentity(path));
  });
  const inputs = { modules: assembled(modules.map(program => program.module)), types: interner, typeExpansion: NO_EXPANSION_LIMIT };
  for (const program of modules) {
    const step = decls.declaredSignatureOf(inputs, request(program));
    assert.equal(step.kind, "done");
    assert.equal(step.value.kind, "ok");
    assert.equal(step.value.value.declaration, program.add);
  }
  for (const path of ["m1", "m3", "m9"]) {
    const absent = addModule(0, moduleIdentity(path));
    assert.throws(() => decls.declaredSignatureOf(inputs, request(absent)), error => String(error.message).includes("not a checked module of the program"));
  }
  // The order is the caller's rule: a list out of order is refused where it is assembled. Given to Decls unchecked, it
  // makes the binary search miss a present module (here m0 behind m4), which is why the assembling caller checks it.
  assert.throws(() => assembled([modules[2].module, modules[0].module]), error => String(error.message).includes("strictly ascending order of identity at position 1"));
  const unordered = { ...inputs, modules: [checked(modules[2].module), checked(modules[1].module), checked(modules[0].module)] };
  assert.throws(() => decls.declaredSignatureOf(unordered, request(modules[0])), error => String(error.message).includes("not a checked module of the program"));
  // A node table that is another module's (same shape: each module holds one add) is refused, not answered from (R4's F-4).
  const swapped = { ...inputs, modules: [{ module: modules[0].module, nodes: checked(modules[1].module).nodes }, checked(modules[1].module), checked(modules[2].module)] };
  assert.throws(() => decls.declaredSignatureOf(swapped, request(modules[0])), error => String(error.message).includes("not the module's own"));
  assert.throws(() => decls.describeDefinitions(swapped.modules[0], []), error => String(error.message).includes("not the module's own"));
  // An entry between two of a module's entries, and past them, is not a declaration entry.
  for (const name of ["ab", "zz"]) assert.throws(() => decls.declaredSignatureOf(inputs, request(modules[1], { definition: ids.encodeDefId({ module: moduleIdentity("m2"), segments: [segment(name)] }) })),
    error => String(error.message).includes("not a declaration entry of its module"));
});

test("declaredSignatureOf: a request for an endpoint that does not exist is a caller defect (part 7)", () => {
  const program = addProgram();
  const failsWith = (asked, text, inputs = program.inputs) => assert.throws(() => decls.declaredSignatureOf(inputs, asked),
    error => String(error.message).includes(text));
  failsWith(request(program, { ordinal: 1 }), "no api-body endpoint at ordinal 1");
  failsWith(request(program, { endpoint: "advertised" }), "no advertised endpoint at ordinal 0");
  failsWith(request(program, { definition: program.a }), "a Parameter has no endpoints");
  failsWith(request(program, { definition: definitionOf(segment("absent")) }), "not a declaration entry of its module");
  failsWith(request(program, { definition: ids.encodeDefId({ module: "M[P[p];other]", segments: [segment("add")] }) }), "not a checked module of the program");
  failsWith(request(program, { definition: "not an identity" }), "does not decode");
  const broken = { ...program.module, items: program.module.items.map(entry => entry.definition === program.add ? { ...entry, node: 99 } : entry) };
  failsWith(request(program), "names a node the module does not have", { ...program.inputs, modules: [checked(broken)] });
});

test("declaredSignatureOf: an unannotated result and a defaulted parameter pause with their requests whatever their slots hold; resume places the answers (K-3328)", () => {
  // function add(a: number, b = 1) { return a + b; }. Front writes the checker's type in every slot, annotated or not
  // (term 0, float64, here), so only the syntax says which parts are inferred: the result has no annotation and `b`
  // has none and an initializer. The requests come in ir-infer's order (infer.md G6): the result, then parameter 1.
  const form = { inferredResult: true, defaultedB: true };
  const signatureFor = ({ add, a, b }) => ({ declaration: add, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: [{ declaration: a, kind: "required", type: 0, passing: "by-value", initializer: null },
      { declaration: b, kind: "default", type: 0, passing: "by-value", initializer: null }], result: 0 });
  const terms = [{ kind: "primitive", primitive: "float64" }, { kind: "primitive", primitive: "bool" }, { kind: "error" }];
  const interner = types.seedTypeInterner({ terms, signatures: [] });
  const program = addModule(types.internSignature(interner, signatureFor(addModule(0, MODULE, form))), MODULE, form);
  const inputs = { modules: [checked(program.module)], types: interner, typeExpansion: NO_EXPANSION_LIMIT };
  const step = decls.declaredSignatureOf(inputs, request(program));
  assert.equal(step.kind, "paused");
  assert.deepEqual(step.requests, [{ kind: "inferred-part", part: { definition: program.add, part: { kind: "return" } } },
    { kind: "inferred-part", part: { definition: program.add, part: { kind: "parameter-initializer", index: 1 } } }], "the result, then parameter 1");
  assert.deepEqual(step.earned, []);
  // Distinct answers show each goes to its own slot: bool to the result, the error type to b, with no diagnostic of Decls.
  const incomingError = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: MODULE, index: 0 } } }] };
  const resumed = decls.resumeDeclaredSignatureOf(inputs, step.paused, [{ origin: partOrigin(program.addBody, 0), part: step.requests[0].part, error: null, type: 1 },
    { origin: partOrigin(program.addBody, 1), part: step.requests[1].part, error: incomingError, type: 2 }]);
  assert.equal(resumed.kind, "done");
  assert.equal(resumed.value.kind, "ok");
  assert.deepEqual(resumed.value.diagnostics, []);
  assert.deepEqual(resumed.value.value.parameters.map(parameter => [parameter.kind, parameter.type]), [["required", 0], ["default", 2]]);
  assert.equal(resumed.value.value.result, 1);
  assert.equal(resumed.value.positions.some(position => position.error?.causes.some(cause => cause.kind === "unit"
    && cause.unit.position.kind === "inference-variable" && cause.unit.position.variable === 1)), true);
  assert.throws(() => decls.resumeDeclaredSignatureOf(inputs, step.paused,
    [{ origin: partOrigin(program.addBody, 0), part: step.requests[1].part, type: 1, error: null }, { origin: partOrigin(program.addBody, 0), part: step.requests[0].part, type: 1, error: null }]),
    /actual complete requested part identity/u);
  assert.throws(() => decls.resumeDeclaredSignatureOf(inputs, step.paused, [{ origin: partOrigin(program.addBody, 0), part: step.requests[0].part, error: null, type: 1 }]), error => String(error.message).includes("1 answers for 2 requests"));
  // Annotated, the same slots are declared: answered at once. Only the result unannotated: one request.
  const declared = addModule(types.internSignature(interner, signatureFor(addModule(0))));
  assert.equal(decls.declaredSignatureOf({ ...inputs, modules: [checked(declared.module)] }, request(declared)).kind, "done");
  const resultOnly = { inferredResult: true, defaultedB: false };
  const onlyResult = addModule(types.internSignature(interner, signatureFor(addModule(0, MODULE, resultOnly))), MODULE, resultOnly);
  const once = decls.declaredSignatureOf({ ...inputs, modules: [checked(onlyResult.module)] }, request(onlyResult));
  assert.deepEqual(once.kind === "paused" ? once.requests.map(asked => asked.part.part.kind) : once.kind, ["return"]);
  // A defaulted parameter the signature has no row for is a defect of the checked module.
  const short = sig => ({ ...sig, parameters: sig.parameters.slice(0, 1) });
  const rowless = addModule(types.internSignature(interner, short(signatureFor(addModule(0, MODULE, form)))), MODULE, form);
  assert.throws(() => decls.declaredSignatureOf({ ...inputs, modules: [checked(rowless.module)] }, request(rowless)),
    error => String(error.message).includes("the declaration's parameter 1 has no row in its signature"));
  // Only the endpoint with the body has inferred parts: the same declaration's advertised row (no body) is answered at once.
  const advertised = addModule(types.internSignature(interner, signatureFor(addModule(0, MODULE, form))), MODULE, form);
  const fn = advertised.nodes.fn;
  fn.tsonic = { ...fn.tsonic, signatures: [...fn.tsonic.signatures, { ...fn.tsonic.signatures[0], role: "advertised", body: null }] };
  const row = decls.declaredSignatureOf({ ...inputs, modules: [checked(advertised.module)] }, request(advertised, { endpoint: "advertised" }));
  assert.equal(row.kind, "done");
});

test("declaredSignatureOf: past the type-expansion limit the answer is refused with the resource-limit diagnostic at the requested declaration", () => {
  // The bindings are put on the signature by substitution even when nothing in it is bound; here the visit limit is
  // zero, so the first visit stops it. The vector carries bound and rigid bindings of each family and self bindings,
  // which enter the request's key (the diagnostic's unit).
  const program = addProgram();
  const limited = { ...program.inputs, typeExpansion: { ...NO_EXPANSION_LIMIT, maximumVisits: 0 } };
  const parameter = index => ({ owner: program.add, index });
  const vector = { classBindings: [{ kind: "rigid", parameter: parameter(0) }], methodBindings: [{ kind: "bound", parameter: parameter(1), type: 0 }],
    capturedBindings: [], selfBindings: [{ kind: "rigid", owner: program.moduleDefinition }, { kind: "bound", owner: program.add, type: 0 }] };
  const step = decls.declaredSignatureOf(limited, request(program, { bindings: { kind: "instantiated", bindings: vector } }));
  assert.equal(step.kind, "done");
  assert.equal(step.value.kind, "refused");
  assert.equal(step.value.diagnostics.length, 1);
  const [diagnostic] = step.value.diagnostics;
  assert.deepEqual(diagnostic.code.kind === "host" ? diagnostic.code.name : null, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: program.nodes.fn.origin });
});

// ---- generic environment (K-3292) ------------------------------------------------------------------------------------
/** Gives every node of a hand-written tree its preorder position as identity and its parent's identity, through ir-hir's own walk. */
function preorder(root) {
  const nodes = hir.indexSyntaxTree(root);
  nodes.forEach((node, id) => Object.assign(node, { id, parent: null, origin: { module: MODULE, start: id, length: 1, derived: [] }, flags: [], loc: LOC }));
  for (const node of nodes) for (const child of hir.childrenOfSyntax(node)) child.parent = node.id;
  return nodes;
}
const identity = (owner, index) => ({ owner, index });
const typeParameter = (text, owner, index) => {
  const definition = ids.encodeDefId({ ...ids.decodeDefId(owner).value, segments: [...ids.decodeDefId(owner).value.segments, segment(text)] });
  return { kind: "TypeParameter", modifiers: null, name: name(text, definition), constraint: null, expression: null, defaultType: null,
    tsonic: { ...facts(owner), definition, parameter: { identity: identity(owner, index), declaration: definition, constraint: null, default: null } } };
};
const typeParameters = (owner, ...texts) => texts.length === 0 ? null : list(texts.map((text, index) => typeParameter(text, owner, index)));
const parameterNamed = (text, owner) => ({ kind: "Parameter", modifiers: null, dotDotDotToken: null, name: name(text, null), questionToken: null, type: null, initializer: null,
  tsonic: { ...facts(owner), declaration: { kind: "local", local: { body: "b", local: 0 } }, declaredType: { kind: "available", value: null }, initializer: null } });
const block = (...statements) => ({ kind: "Block", statements: list(statements), multiLine: true, tsonic: null });
const method = (kind, definition, parent, texts, { modifiers = null, parameters = [], statements = [] } = {}) => ({ kind, modifiers, asteriskToken: null,
  name: name(ids.decodeDefId(definition).value.segments.at(-1).name, definition), postfixToken: null, typeParameters: typeParameters(definition, ...texts),
  parameters: list(parameters), type: null, fullSignature: null, body: block(...statements), tsonic: { ...facts(parent), definition, parameters: [], signatures: [], body: null } });
const classOf = (definition, parent, texts, members) => ({ kind: "ClassDeclaration", modifiers: null, name: name(ids.decodeDefId(definition).value.segments.at(-1).name, definition),
  typeParameters: typeParameters(definition, ...texts), heritageClauses: null, members: list(members), tsonic: { ...facts(parent), definition, parameters: [], heritage: [] } });

/**
 * class C<T> {
 *   m<U>() { const f = <V>() => 0; class D<W> { n<X>() {} } function h<H>() {} }
 *   static s<Y>() {}
 *   t(this: unknown) {}
 *   k<T>() {}             // a second T, of k: shadowing keeps both identities
 * }
 * function g<Z>() {}
 * type Alias<A> = A;
 */
function genericModule(classTexts = ["T"]) {
  const root = definitionOf();
  const C = definitionOf(segment("C")), m = definitionOf(segment("C"), segment("m")), arrow = definitionOf(segment("C"), segment("m"), segment("", 0));
  const D = definitionOf(segment("C"), segment("m"), segment("D")), n = definitionOf(segment("C"), segment("m"), segment("D"), segment("n"));
  const h = definitionOf(segment("C"), segment("m"), segment("h"));
  const s = definitionOf(segment("C"), segment("s")), t = definitionOf(segment("C"), segment("t")), k = definitionOf(segment("C"), segment("k"));
  const g = definitionOf(segment("g")), Alias = definitionOf(segment("Alias"));
  const arrowNode = { kind: "ArrowFunction", modifiers: null, typeParameters: typeParameters(arrow, "V"), parameters: list([]), type: null, fullSignature: null, asteriskToken: null,
    equalsGreaterThanToken: token("EqualsGreaterThanToken"), body: block(), tsonic: { core: null, body: "b", captures: [] } };
  const dNode = classOf(D, m, ["W"], [method("MethodDeclaration", n, D, ["X"])]);
  const hNode = { kind: "FunctionDeclaration", modifiers: null, asteriskToken: null, name: name("h", h), typeParameters: typeParameters(h, "H"), parameters: list([]),
    type: null, fullSignature: null, body: block(), tsonic: { ...facts(m), definition: h, parameters: [], signatures: [], body: null } };
  const cNode = classOf(C, root, classTexts, [
    method("MethodDeclaration", m, C, ["U"], { statements: [{ kind: "ExpressionStatement", expression: arrowNode, tsonic: null }, dNode, hNode] }),
    method("MethodDeclaration", s, C, ["Y"], { modifiers: list([token("StaticKeyword")]) }),
    method("MethodDeclaration", t, C, [], { parameters: [parameterNamed("this", t)] }),
    method("MethodDeclaration", k, C, ["T"]),
  ]);
  const gNode = { kind: "FunctionDeclaration", modifiers: null, asteriskToken: null, name: name("g", g), typeParameters: typeParameters(g, "Z"), parameters: list([]),
    type: null, fullSignature: null, body: block(), tsonic: { ...facts(root), definition: g, parameters: [], signatures: [], body: null } };
  // type Alias<A> = { p: A }: a property signature of a type literal is no class member; it has its alias's environment.
  const p = definitionOf(segment("Alias"), segment("p"));
  const signature = { kind: "PropertySignature", modifiers: null, name: name("p", p), postfixToken: null, type: null, initializer: null,
    tsonic: { ...facts(Alias), declaration: { kind: "definition", definition: p }, declaredType: { kind: "available", value: null }, initializer: null } };
  const aliasNode = { kind: "TypeAliasDeclaration", modifiers: null, name: name("Alias", Alias), typeParameters: typeParameters(Alias, "A"),
    type: { kind: "TypeLiteral", members: list([signature]), tsonic: { core: null, type: { kind: "available", value: 0 }, referencedDefinitions: [] } },
    tsonic: { ...facts(root), definition: Alias, parameters: [], type: { kind: "available", value: 0 } } };
  const tree = { kind: "SourceFile", statements: list([cNode, gNode, aliasNode]), endOfFileToken: token("EndOfFile"), languageVariant: "Standard", scriptKind: "TS",
    commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { ...facts(null), definition: root, body: bodyOf(root, "module") } };
  const nodes = preorder(tree);
  // Every node whose checked payload names a definition (directly, or as a declaration target) is a declaration entry;
  // the arrow's closure payload names none.
  const definitionNamed = payload => payload === null ? undefined : typeof payload.definition === "string" ? payload.definition
    : payload.declaration?.kind === "definition" && payload.role === undefined ? payload.declaration.definition : undefined;
  const items = nodes.filter(node => node.id !== 0 && definitionNamed(node.tsonic) !== undefined)
    .map(node => ({ definition: definitionNamed(node.tsonic), node: node.id }))
    .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  const module = { module: MODULE, tree, items, bodies: [], checkerDiagnostics: [], obligations: [] };
  return { module, root, C, m, arrow, D, n, h, s, t, k, g, Alias, p };
}

test("generic environment: the partition of K-3292's table, static against instance, explicit receiver, ordinary function, alias, shadowing", () => {
  const program = genericModule();
  const table = decls.describeDefinitions(checked(program.module), []);
  const at = definition => table.definitions.find(row => row.definition === definition).generics;
  const param = (owner, index) => identity(owner, index);
  const scope = (classParameters, methodParameters, capturedParameters, selfOwners) => ({ classParameters, methodParameters, capturedParameters, selfOwners });
  const { C, m, arrow, D, n, h, s, t, k, g, Alias, root } = program;
  const T = param(C, 0), U = param(m, 0), V = param(arrow, 0), W = param(D, 0), X = param(n, 0), H = param(h, 0), Y = param(s, 0), Tk = param(k, 0), Z = param(g, 0), A = param(Alias, 0);
  assert.deepEqual(at(root), scope([], [], [], []), "the module");
  assert.deepEqual(at(C), scope([T], [], [], [C]), "C<T>");
  assert.deepEqual(at(definitionOf(segment("C"), segment("T"))), scope([T], [], [], [C]), "C's type parameter has C's environment");
  assert.deepEqual(at(m), scope([T], [U], [], [C]), "C<T>.m<U>");
  assert.deepEqual(at(definitionOf(segment("C"), segment("m"), segment("", 0), segment("V"))), scope([], [V], [T, U], [C]), "the arrow <V> in m: lexical self kept");
  assert.deepEqual(at(D), scope([W], [], [T, U], [C, D]), "local D<W> in m");
  assert.deepEqual(at(n), scope([W], [X], [T, U], [C, D]), "D.n<X>");
  assert.deepEqual(at(h), scope([], [H], [T, U], []), "an ordinary function in m: its own this, no lexical self");
  assert.deepEqual(at(s), scope([], [Y], [], []), "static s<Y>: no class parameter, no self");
  assert.deepEqual(at(t), scope([T], [], [], []), "t(this: …): an explicit receiver, no polymorphic self");
  assert.deepEqual(at(k), scope([T], [Tk], [], [C]), "k<T> shadows C's T: both identities, in their families");
  assert.deepEqual(at(g), scope([], [Z], [], []), "function g<Z>");
  assert.deepEqual(at(Alias), scope([A], [], [], []), "type Alias<A>: the type declaration's family");
  assert.deepEqual(at(program.p), scope([A], [], [], []), "a property signature in the alias's type literal: the alias's environment");
});

test("generic environment: a vector over the derived scope is accepted all-rigid and all-bound, and refused when missing, duplicated, misfamilied or reordered", () => {
  const program = genericModule();
  const table = decls.describeDefinitions(checked(program.module), []);
  const scopeOfN = table.definitions.find(row => row.definition === program.n).generics;
  const typeTable = { terms: [{ kind: "primitive", primitive: "float64" }], signatures: [] };
  const verify = vector => types.verifyTypes({ table: typeTable, bindings: [{ vector, scope: scopeOfN }], evidence: [], nominalOf: () => null, nodeExists: () => true, localExists: () => true })
    .map(violation => violation.rule);
  const rigid = list => list.map(parameter => ({ kind: "rigid", parameter }));
  const bound = list => list.map(parameter => ({ kind: "bound", parameter, type: 0 }));
  const vectorOf = (make, selfKind = "rigid") => ({ classBindings: make(scopeOfN.classParameters), methodBindings: make(scopeOfN.methodParameters),
    capturedBindings: make(scopeOfN.capturedParameters), selfBindings: scopeOfN.selfOwners.map(owner => selfKind === "rigid" ? { kind: "rigid", owner } : { kind: "bound", owner, type: 0 }) });
  assert.deepEqual(verify(vectorOf(rigid)), [], "all rigid");
  assert.deepEqual(verify(vectorOf(bound, "bound")), [], "all bound");
  const base = vectorOf(rigid);
  const [T, U] = scopeOfN.capturedParameters;
  assert.ok(verify({ ...base, capturedBindings: rigid([T]) }).includes("binding-vector-complete"), "missing");
  assert.ok(verify({ ...base, capturedBindings: rigid([T, T]) }).includes("binding-vector-complete"), "duplicated");
  assert.ok(verify({ ...base, methodBindings: rigid([T]), capturedBindings: rigid([U]) }).length > 0, "misfamilied");
  assert.ok(verify({ ...base, capturedBindings: rigid([U, T]) }).includes("binding-vector-complete"), "reordered");
  assert.ok(verify({ ...base, selfBindings: [...base.selfBindings].reverse() }).length > 0, "self owners reordered");
});

test("wide native binder subtraction retains qualified identity and order without repeating a membership scan", () => {
  for (const count of [2, 64, 128]) {
    const program = genericModule(Array.from({ length: count }, (_, index) => `T${index}`));
    const table = decls.describeDefinitions(checked(program.module), []);
    const member = table.definitions.find(row => row.definition === program.m).generics;
    assert.deepEqual(member.classParameters, Array.from({ length: count }, (_, index) => identity(program.C, index)));
    assert.deepEqual(member.methodParameters, [identity(program.m, 0)]);
    assert.deepEqual(member.capturedParameters, []);
  }
});

// ---- checkpoint 2: Decls on Front's real checked module (K-3286 item 2) -------------------------------------------
/**
 * The inverse export names of a module (part 3, B1): Front's export entries, grouped by exported name, regrouped by
 * definition into one row per definition, each with its names in the entries' order (K-3357). Pipeline makes the same
 * projection at its handoff when it is wired.
 */
function inverseExports(module, exports, checked) {
  const rows = new Map();
  const sources = new Map([[checked.tree.tsonic.definition, checked.tree.id], ...checked.items.map(item => [item.definition, item.node])]);
  const views = { ...hir.createModuleBindingViews([exports.bindings]), declarationSourceOf: definition => {
    const node = sources.get(definition);
    return node === undefined ? null : { kind: "item", value: { owner: definition, node } };
  } };
  for (const entry of exports.entries) {
    const target = hir.projectExportDeclarations(views, entry).target;
    assert.equal(target.kind, "available", "this callable fixture has a complete exported target");
    assert.equal(target.value.kind, "declarations", "this fixture projects actual exported callable declaration groups");
    for (const definition of target.value.definitions) {
      const row = rows.get(definition) ?? { definition, exports: [] };
      rows.set(definition, row);
      row.exports.push({ module, name: entry.name });
    }
  }
  return [...rows.values()];
}
// The program goes through the SDK, the snapshot and Front's production operations by W5's one fixture path
// (fixtures/front/checked-module.mjs); Decls then answers for Front's checked module. Every expected value is written
// from the signed text, K-3291 and K-3312, not read off Front's output.
test("checkpoint 2: describeDefinitions and declaredSignatureOf on Front's checked module of export function add", async () => {
  const fixture = await loadFrontFixture();
  const source = "export function add(a: number, b: number): number { return a + b; }\n";
  const program = fixture.checkedModuleOf(source);
  // The checked-source barrier: the HIR verifier accepts the module, against the interner's own rows, before Decls is asked anything (K-3325).
  assert.deepEqual(fixture.verifyChecked(program.checked, program.interner), []);
  const module = program.module;
  const at = (...names) => ids.encodeDefId({ module, segments: names.map(name => segment(name)) });
  const moduleDefinition = at(), add = at("add"), a = at("add", "a"), b = at("add", "b");
  const moduleBody = ids.encodeBodyId({ owner: moduleDefinition, role: "module", ordinal: 0 });
  const addBody = ids.encodeBodyId({ owner: add, role: "function", ordinal: 0 });
  const exportNames = inverseExports(module, program.exports, program.checked);
  const inputs = { modules: assembled([program.checked]), types: program.interner,
    typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 } };
  const none = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const row = (definition, kind, parent, bodies, exports) => ({ definition, path: ids.decodeDefId(definition).value, kind, visibility: null, parent, bodies, generics: none, exports });
  assert.deepEqual(decls.describeDefinitions(inputs.modules[0], exportNames), { module, definitions: [
    row(moduleDefinition, "SourceFile", null, [moduleBody], []),
    ...[add, a, b].sort().map(definition => definition === add ? row(add, "FunctionDeclaration", moduleDefinition, [addBody], [{ module, name: "add" }])
      : row(definition, "Parameter", add, [], [])),
  ] }, "the module, add exported as add, its two parameters; no visibility and no generic environment anywhere");
  const step = decls.declaredSignatureOf(inputs, { definition: add, endpoint: "api-body", ordinal: 0, bindings: { kind: "parametric" } });
  assert.equal(step.kind, "done", "a fully declared signature: no request (WT-1)");
  assert.equal(step.value.kind, "ok");
  const signature = step.value.value;
  // Each slot's type is read from Front's own table, not interned here (R4's P-2): TypeScript `number` is the float64 primitive (K-3291).
  for (const type of [signature.result, ...signature.parameters.map(parameter => parameter.type)])
    assert.deepEqual(types.readType(program.interner, type), { kind: "primitive", primitive: "float64" });
  // The signature's owner is add's declaration node: in the source's preorder the source file is node 0 and the function
  // declaration, its first statement, node 1.
  assert.deepEqual({ ...signature, id: null, result: null }, { id: null, declaration: add, owner: { kind: "item", value: { owner: add, node: 1 } }, composition: null, kind: "call",
    typeParameters: [], receiver: null, result: null,
    parameters: [a, b].map(declaration => ({ declaration, kind: "required", type: signature.result, passing: "by-value", initializer: null })) });
});

/** Front's checked module of one exported function, verified first; the step of `declaredSignatureOf` for its body endpoint. */
async function bodySignatureStep(source, name) {
  const fixture = await loadFrontFixture();
  const program = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(program.checked, program.interner), [], "the HIR verifier accepts the module first");
  const definition = ids.encodeDefId({ module: program.module, segments: [segment(name)] });
  const inputs = { modules: assembled([program.checked]), types: program.interner,
    typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 } };
  return { definition, step: decls.declaredSignatureOf(inputs, { definition, endpoint: "api-body", ordinal: 0, bindings: { kind: "parametric" } }) };
}

// The answer to an inferred part comes from Infer's solution through Pipeline (W9); without it the request stays
// unanswered, which is the frontier these cases stop at. Front records the checker's type in the result slot, so the
// pause shows the part is read from the syntax.
test("checkpoint 2, inferred parts on Front's module: an unannotated result pauses with its one request (K-3328)", async () => {
  const { definition, step } = await bodySignatureStep("export function f(a: number) { return a; }\n", "f");
  assert.equal(step.kind, "paused");
  assert.deepEqual(step.requests, [{ kind: "inferred-part", part: { definition, part: { kind: "return" } } }]);
});

test("checkpoint 2, inferred parts on Front's module: a defaulted parameter and the result pause with two requests (K-3328)", {
  todo: "Front frontier, owner W5: checkedModuleOf refuses `export function g(a = 1) { return a; }` with 'front: the captured form of the checker type 1 is not implemented'",
}, async () => {
  const { definition, step } = await bodySignatureStep("export function g(a = 1) { return a; }\n", "g");
  assert.equal(step.kind, "paused");
  assert.deepEqual(step.requests, [{ kind: "inferred-part", part: { definition, part: { kind: "return" } } },
    { kind: "inferred-part", part: { definition, part: { kind: "parameter-initializer", index: 0 } } }]);
});

/** Front's checked module of the source, verified by the HIR verifier first, described by Decls with the grouped inverse export names. */
async function describedExports(source) {
  const fixture = await loadFrontFixture();
  const program = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(program.checked, program.interner), [], "the HIR verifier accepts the module first");
  const module = program.module;
  const at = name => ids.encodeDefId({ module, segments: [segment(name)] });
  const table = decls.describeDefinitions(assembled([program.checked])[0], inverseExports(module, program.exports, program.checked));
  return { module, rowOf: name => table.definitions.find(row => row.definition === at(name)) };
}
const addBody = "(a: number, b: number): number { return a + b; }\n";

test("checkpoint 2, export names: one name; none; two definitions, one name each (K-3357)", async () => {
  const once = await describedExports(`export function add${addBody}`);
  assert.deepEqual(once.rowOf("add").exports, [{ module: once.module, name: "add" }]);
  const none = await describedExports(`function add${addBody}`);
  assert.deepEqual(none.rowOf("add").exports, []);
  const two = await describedExports(`export function add${addBody}export function sub(a: number, b: number): number { return b + a; }\n`);
  assert.deepEqual([two.rowOf("add").exports, two.rowOf("sub").exports], [[{ module: two.module, name: "add" }], [{ module: two.module, name: "sub" }]]);
});

test("signed recursion: real checked mutually recursive annotated declarations have ready signatures in either demand order", async () => {
  const fixture = await loadFrontFixture();
  const source = "export function left(n: number): number { return right(n); }\nexport function right(n: number): number { return left(n); }\n";
  const program = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(program.checked, program.interner), [], "the actual checked-source barrier");
  const inputs = { modules: assembled([program.checked]), types: program.interner,
    typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 } };
  const requests = ["left", "right"].map(name => ({ definition: ids.encodeDefId({ module: program.module, segments: [segment(name)] }),
    endpoint: "api-body", ordinal: 0, bindings: { kind: "parametric" } }));
  for (const order of [requests, [...requests].reverse()]) {
    for (const request of order) {
      const step = decls.declaredSignatureOf(inputs, request);
      assert.equal(step.kind, "done", "an annotated recursive declaration does not ask for its own completed inference");
      assert.equal(step.value.kind, "ok");
      assert.equal(step.value.value.declaration, request.definition);
      assert.deepEqual(types.readType(program.interner, step.value.value.result), { kind: "primitive", primitive: "float64" });
      assert.deepEqual(step.value.diagnostics, []);
    }
  }
});

test("public async and generator handles are not overwritten by completion or yield parts", () => {
  for (const mode of ["async", "generator"]) {
    const program = addProgram();
    const fn = program.nodes.fn;
    fn.type = null;
    if (mode === "async") fn.modifiers = list([token("AsyncKeyword")]);
    else fn.asteriskToken = token("AsteriskToken");
    const completion = types.internType(program.inputs.types, { kind: "primitive", primitive: "bool" });
    const yielded = types.internType(program.inputs.types, { kind: "string" });
    const first = decls.declaredSignatureOf(program.inputs, request(program));
    assert.equal(first.kind, "paused");
    assert.deepEqual(first.requests.map(entry => entry.part.part.kind), mode === "async" ? ["return"] : ["return", "yield"]);
    const answers = first.requests.map((entry, index) => ({ origin: partOrigin(program.addBody, index), part: entry.part, error: null, type: entry.part.part.kind === "yield" ? yielded : completion }));
    const resumed = decls.resumeDeclaredSignatureOf(program.inputs, first.paused, answers);
    assert.equal(resumed.kind, "done");
    assert.equal(resumed.value.kind, "ok");
    assert.equal(resumed.value.value.result, first.paused.signature.result, "the genuine captured public handle stays separate from BodyTyping's channels");
    assert.equal(resumed.value.value.parameters[0].type, first.paused.signature.parameters[0].type);
  }
  const program = addProgram();
  program.nodes.fn.type = null;
  const first = decls.declaredSignatureOf(program.inputs, request(program));
  for (const kind of ["FunctionExpression", "ArrowFunction", "MethodDeclaration", "GetAccessor"]) {
    program.nodes.fn.kind = kind;
    const next = decls.declaredSignatureOf(program.inputs, request(program));
    assert.equal(next.kind, "paused");
    const result = decls.resumeDeclaredSignatureOf(program.inputs, next.paused, [{ origin: partOrigin(program.addBody, 0), part: next.requests[0].part, error: null, type: 0 }]);
    assert.equal(result.value.kind, "ok");
  }
  program.nodes.fn.kind = "FunctionDeclaration";
  for (const kind of ["yield", "variable", "field"]) {
    const changed = { ...first.paused, parts: [{ kind: "inferred-part", part: { definition: program.add, part: { kind } } }] };
    assert.throws(() => decls.resumeDeclaredSignatureOf(program.inputs, changed, [{ origin: partOrigin(program.addBody, 0), part: changed.parts[0].part, error: null, type: 0 }]),
      error => error.name === "Error" && /a yielded part belongs to no callable body channel|a non-signature inferred part was requested for a signature/u.test(error.message));
  }
});

test("the error-only constructor preserves declared and solved default positions while erroring only the classified failed part", () => {
  const form = { inferredResult: true, defaultedB: true };
  const original = addModule(0, MODULE, form);
  const interner = types.createTypeInterner();
  const native = types.internType(interner, { kind: "primitive", primitive: "float64" });
  const solved = types.internType(interner, { kind: "primitive", primitive: "bool" });
  const signature = types.internSignature(interner, { declaration: original.add, owner: { kind: "item", value: { owner: original.add, node: 1 } }, composition: null,
    kind: "call", typeParameters: [], receiver: native,
    parameters: [{ declaration: original.a, kind: "required", type: native, passing: "borrow-shared", initializer: null },
      { declaration: original.b, kind: "default", type: native, passing: "by-value", initializer: null }], result: native });
  const program = addModule(signature, MODULE, form);
  const inputs = { modules: [checked(program.module)], types: interner, typeExpansion: NO_EXPANSION_LIMIT };
  const asked = request(program);
  const pending = decls.declaredSignatureOf(inputs, asked);
  assert.equal(pending.kind, "paused");
  const cause = { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module: MODULE, index: 0 } } };
  const data = { kind: "declared-signature", state: pending.paused, ready: [{ index: 1, answer: { origin: partOrigin(program.addBody, 1), part: pending.requests[1].part, type: solved, error: null } }], unavailable: [0] };
  const result = decls.errorSignature(inputs, asked, cause, data);
  assert.equal(types.readType(interner, result.value.result).kind, "error");
  assert.equal(result.value.receiver, native);
  assert.deepEqual(result.value.parameters.map(parameter => [parameter.declaration, parameter.kind, parameter.passing, parameter.type, parameter.initializer]),
    [[original.a, "required", "borrow-shared", native, null], [original.b, "default", "by-value", solved, null]]);
  assert.deepEqual(result.value.owner, pending.paused.signature.owner);
  assert.equal(result.positions.find(position => position.error?.causes.includes(cause)) !== undefined, true);
  for (const changed of [
    { ...data, kind: "layout" },
    { ...data, state: { ...data.state, request: { ...asked, ordinal: 1 } } },
    { ...data, state: { ...data.state, parts: [] } },
    { ...data, ready: [...data.ready, data.ready[0]] },
    { ...data, unavailable: [-1] },
    { ...data, unavailable: [1] },
    { ...data, unavailable: [] },
    { ...data, ready: [] },
  ]) assert.throws(() => decls.errorSignature(inputs, asked, cause, changed), error => error.name === "Error");
  const inverse = decls.errorSignature(inputs, asked, cause, { ...data, ready: [{ index: 0, answer: { origin: partOrigin(program.addBody, 0), part: pending.requests[0].part, type: solved, error: null } }], unavailable: [1] });
  assert.equal(inverse.value.result, solved);
  assert.equal(inverse.value.parameters[0].type, native);
  assert.equal(types.readType(interner, inverse.value.parameters[1].type).kind, "error");
  for (const answer of [{ origin: partOrigin(program.addBody, 0), part: pending.requests[0].part, type: solved, error: { kind: "error", causes: [cause] } },
    { origin: partOrigin(program.addBody, 0), part: pending.requests[0].part, type: result.value.result, error: null }]) {
    assert.throws(() => decls.resumeDeclaredSignatureOf(inputs, pending.paused, [answer, { origin: partOrigin(program.addBody, 0), part: pending.requests[1].part, type: solved, error: null }]),
      error => /actual error provenance/u.test(error.message));
  }
  const channel = addProgram();
  channel.nodes.fn.type = null;
  channel.nodes.fn.asteriskToken = token("AsteriskToken");
  const channels = decls.declaredSignatureOf(channel.inputs, request(channel));
  const channelData = { kind: "declared-signature", state: channels.paused,
    ready: [{ index: 1, answer: { origin: partOrigin(channel.addBody, 1), part: channels.requests[1].part, type: 0, error: null } }], unavailable: [0] };
  assert.throws(() => decls.errorSignature(channel.inputs, request(channel), cause, channelData), error => /body-channel failure/u.test(error.message));
  assert.throws(() => decls.errorSignature(channel.inputs, request(channel), cause, { ...channelData, ready: [], unavailable: [1] }), error => /body-channel failure/u.test(error.message));
  const constructorSignature = types.internSignature(interner, { ...types.readSignature(interner, signature), kind: "construct" });
  const setter = addModule(constructorSignature, MODULE, { inferredResult: false, defaultedB: true });
  setter.nodes.fn.kind = "Constructor";
  const setterInputs = { ...inputs, modules: [checked(setter.module)] };
  const setterPending = decls.declaredSignatureOf(setterInputs, request(setter));
  assert.equal(setterPending.kind, "paused");
  assert.equal(decls.resumeDeclaredSignatureOf(setterInputs, setterPending.paused, [{ origin: partOrigin(setter.addBody, 0), part: setterPending.requests[0].part, type: native, error: null }]).value.kind, "ok");
});

test("checkpoint 2, export names: one definition under two names is one row holding both (K-3357)", {
  todo: "Front frontier, owner W5: captureModule refuses `export { add, add as sum }` with 'the captured form of the checker type (a: number, b: number) => number is not implemented'",
}, async () => {
  const twice = await describedExports(`function add${addBody}export { add, add as sum };\n`);
  assert.deepEqual(twice.rowOf("add").exports, [{ module: twice.module, name: "add" }, { module: twice.module, name: "sum" }]);
});
