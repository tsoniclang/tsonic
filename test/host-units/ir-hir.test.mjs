import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Session } from "node:inspector";
import { spawnSync } from "node:child_process";
import test, { after, before } from "node:test";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { runCase } from "../host-cases/case.mjs";
import { syntaxConstructorInputs } from "./fixtures/hir-syntax.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const moduleIdentity = "M[P[%002Fproject];main.ts]";
const definitionIdentity = `D[${moduleIdentity}]`;
const bodyIdentity = `B[${definitionIdentity};module;0]`;
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const runtimeNames = ["index","pragmas","children","walk","print","parse","verify","verify-syntax","verify-bindings","verify-captures","text-syntax","text-data","text-construction","text-read-0","text-read-1","text-read-2","text-read-3","text-read-4","text-read-5","text-read-6","text-read-7","text-read-8","text-read-9","text-read-syntax-0","text-read-syntax-1","text-read-syntax-2","text-read-syntax-3","text-read-syntax-4","text-read-syntax-5","text-read-syntax-6","text-read-syntax-7","text-read-syntax-8","text-read-syntax-9","text-read-syntax-10","text-read-syntax-11","text-read-syntax-12","text-read-syntax-13","text-readers","text-read-scalars"];
const runtimeFiles = runtimeNames.map(name => resolve(repository, `packages/host/dist/ir-hir/${name}.js`));
const ownedSources = ["contract", "text-read-model", ...runtimeNames].map(name => `packages/host/src/ir-hir/${name}.ts`);
const inspector = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  inspector.post(method, parameters, (error, value) => error === null ? done(value) : reject(error));
});
let product;
let ids;
let childrenOfSyntax;
let indexSyntaxTree;
let walkSyntaxTree;
let evidenceDirectory;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    true, "the real whole unit, pure cases and compiler children use one admitted aggregate process-group guard");
  mkdirSync(resolve(repository, ".temp/host-f-ir-hir"), { recursive: true });
  evidenceDirectory = mkdtempSync(resolve(repository, ".temp/host-f-ir-hir/proof-"));
  inspector.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import(pathToFileURL(resolve(repository, "packages/host/dist/ir-hir/index.js")).href);
  ids = await import(pathToFileURL(resolve(repository, "packages/host/dist/ids/index.js")).href);
  ({ childrenOfSyntax, indexSyntaxTree, walkSyntaxTree } = product);
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const response = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: response.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"),
      parse: parseSources, project: (url, text) => url.startsWith("file:") ? { path: fileURLToPath(url), text } : null,
    }, runtimeFiles, [{ result, sources }]);
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify([...ownedSources.map(path => resolve(repository, path)), ...runtimeFiles]
      .map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, runtimeNames.length, "each actual emitted product file has nonempty source-identified raw coverage");
    assert.deepStrictEqual(report.findings, []);
    assert.equal(report.status, "passed");
    for (const file of report.files) assert.deepStrictEqual([file.status, file.lines, file.branches, file.functions],
      ["covered", 100, 100, 100], file.path);
  } finally {
    inspector.disconnect();
  }
});

function header(id, parent = null, start = 0, length = 100) {
  return { id, parent, origin: { module: moduleIdentity, start, length, derived: [] },
    flags: [], loc: { pos: start, end: start + length }, tsonic: null };
}

function syntax(kind, id, properties = {}, parent = null) {
  return { ...header(id, parent), kind, ...properties };
}

function nodeList(nodes) {
  return { loc: { pos: 0, end: 100 }, nodes };
}





function assertNodes(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: complete child count`);
  assert.equal(actual.every((node, ordinal) => node === expected[ordinal]), true, `${label}: exact existing node identities/order`);
}

const functionAdapter = input => {
  const value = JSON.parse(input.text);
  const root = (value.root);
  return { kind: "accepted", value: {
    walk: walkSyntaxTree(root, []).map(node => node.id),
    stop: walkSyntaxTree(root, value.stopBefore).map(node => node.id),
  }, diagnostics: [] };
};

test("HIR authored function case executes the real generic walk and complete ordered outcome", async () => {
  const deps = { modules: ["ir-hir"], adapters: { function: functionAdapter }, evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
    readText: path => readFileSync(resolve(repository, path), "utf8"),
    canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
    list: path => readdirSync(resolve(repository, path)),
    decode: text => JSON.parse(text),
  };
  const path = "test/host-cases/ir-hir/function/preorder-and-boundary.case.json";
  const result = await runCase(deps, path);
  assert.deepStrictEqual(result, { status: "passed", path, outcome: {
    kind: "accepted", value: { walk: [0, 1, 2, 3], stop: [0, 3] }, diagnostics: [],
  } });
});

test("HIR index retains the one complete module tree and walks stop before exact nested roots", () => {
  const child = syntax("EmptyStatement", 2, {}, 1);
  const nested = syntax("Block", 1, { statements: nodeList([child]), multiLine: false }, 0);
  const sibling = syntax("EmptyStatement", 3, {}, 0);
  const end = syntax("EndOfFile", 4, {}, 0);
  const root = (syntax("SourceFile", 0, {
    statements: nodeList([nested, sibling]), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
  }));
  assertNodes(indexSyntaxTree(root), [root, nested, child, sibling, end], "dense module preorder");
  assertNodes(walkSyntaxTree(root, [nested.id]), [root, sibling, end], "nested body root is not visited");
  assertNodes(walkSyntaxTree(root, [root.id]), [], "stopping at the supplied root is empty");
  assertNodes(walkSyntaxTree(root, [nested.id, nested.id]), [root, sibling, end], "duplicate stop identity does not widen the walk");
  assert.equal(root.origin.module, moduleIdentity);
  assert.equal(child.parent, nested.id);
  assert.equal(root.statements.nodes[0] === nested, true);
});

test("HIR iterative traversal visits each supplied object once without copying shared child objects", () => {
  const child = syntax("EmptyStatement", 1, {}, 0);
  const root = (syntax("SyntaxList", 0, { children: [child, child] }));
  assertNodes(walkSyntaxTree(root, []), [root, child], "shared child is not cloned or revisited");
  const cyclic = syntax("SyntaxList", 0, { children: [] });
  cyclic.children.push(cyclic);

  assert.throws(() => walkSyntaxTree(cyclic, []), { name: "TypeError", message: "Syntax child cycle at $.root.children[0]" });
});

test("HIR index rejects a genuine SourceFile child cycle at its exact Block backedge", () => {
  const block = syntax("Block", 1, { statements: nodeList([]), multiLine: false }, 0);
  block.statements.nodes.push(block);
  const root = (syntax("SourceFile", 0, {
    statements: nodeList([block]), endOfFileToken: syntax("EndOfFile", 2, {}, 0),
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
  }));
  assert.throws(() => indexSyntaxTree(root), { name: "TypeError",
    message: "Syntax child cycle at $.root.statements.nodes[0].statements.nodes[0]" });
});

test("HIR pure walkers handle a genuine 100000-level declared syntax chain iteratively", () => {
  const depth = 100_000;
  let expression = syntax("Identifier", depth, { text: "value" }, depth - 1);
  const leaf = expression;
  for (let ordinal = depth - 1; ordinal >= 0; ordinal -= 1) {
    expression = syntax("ParenthesizedExpression", ordinal, { expression }, ordinal === 0 ? null : ordinal - 1);
  }

  const actual = walkSyntaxTree(expression, []);
  assert.equal(actual.length, depth + 1);
  assert.equal(actual.every((node, ordinal) => node.id === ordinal), true, "complete dense deep preorder");
  assert.equal(actual[0] === expression && actual[depth] === leaf, true, "original root and deepest leaf survive");
});

const constructorInputs = (count, nullOptionals, reversed) => syntaxConstructorInputs(syntax, nodeList, count, nullOptionals, reversed);

test("HIR closed syntax constructors preserve authored direct children across null, empty, one and ordered several", () => {
  for (const [count, nullOptionals, reversed] of [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]]) {
    for (const row of constructorInputs(count, nullOptionals, reversed)) {
      (row.node);
      assertNodes(childrenOfSyntax(row.node), row.expected, `${row.node.kind}/${count}/${nullOptionals}/${reversed}`);
    }
  }
});

const available = value => ({ kind: "available", value });
const unavailable = (reason = "not-provided") => ({ kind: "unavailable", reason });
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const absentCore = () => ({ provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false }),
  pointerType: available(null), pointerOperation: available(null), fieldBinding: available(null), recordBinding: available(null),
  attribute: available(null), safety: available(null), argumentPassing: available(null), flowState: available(null) });
const emptyViews = () => ({ read: unavailable(), declared: available(null), contextual: available(null) });
const emptyValue = () => ({ views: emptyViews(), place: available(null), memory: available(null), observation: available(null) });
const expressionMetadata = () => ({ ...emptyValue(), core: absentCore() });
const nameMetadata = () => ({ core: absentCore(), role: "value", value: emptyValue(), resolution: { kind: "unresolved", checkerDiagnostic: null } });
const typeMetadata = () => ({ core: absentCore(), type: unavailable(), referencedDefinitions: [] });
const bodySource = (node, body = bodyIdentity) => ({ kind: "body", value: { body, node } });
const nodeSite = (node, body = bodyIdentity) => ({ kind: "node", node: bodySource(node, body) });
const violation = (rule, site, value) => ({ rule, site, detail: [{ kind: "text", value }] });

function constructorMetadata(node) {
  const declaration = () => ({ ...declarationFacts(), definition: definitionIdentity });
  const variable = () => ({ ...declarationFacts(), declaration: { kind: "definition", definition: definitionIdentity }, declaredType: available(null), initializer: null });
  const checkedClass = () => ({ ...declaration(), parameters: [], heritage: [], members: [] });
  switch (node.kind) {
    case "Identifier": case "PrivateIdentifier": case "QualifiedName": return nameMetadata();
    case "ComputedPropertyName": case "ImportAttribute": case "PropertyAssignment": case "ShorthandPropertyAssignment":
      return { core: absentCore(), key: unavailable(), origins: unavailable() };
    case "VariableDeclaration": case "Parameter": case "PropertySignature": case "PropertyDeclaration": case "EnumMember": return variable();
    case "VariableDeclarationList": return { core: absentCore(), disposal: [] };
    case "ObjectBindingPattern": case "ArrayBindingPattern": case "BindingElement":
      return { core: absentCore(), declaration: null, declaredType: available(null) };
    case "FunctionDeclaration": case "CallSignature": case "ConstructSignature": case "Constructor": case "GetAccessor":
    case "SetAccessor": case "IndexSignature": case "MethodSignature": case "MethodDeclaration":
      return { ...declaration(), parameters: [], signatures: [], body: null };
    case "ClassDeclaration": case "InterfaceDeclaration": return checkedClass();
    case "ClassExpression": return { ...expressionMetadata(), ...checkedClass() };
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return { ...declaration(), parameters: [], type: unavailable() };
    case "EnumDeclaration": case "ModuleDeclaration": return { ...declaration(), members: [] };
    case "ImportDeclaration": case "JSImportDeclaration": case "NamespaceImport": case "ImportEqualsDeclaration": case "ImportClause": case "ImportSpecifier":
      return { ...declaration(), target: unavailable(), bindings: [] };
    case "ExportAssignment": case "NamespaceExportDeclaration": case "NamespaceExport": case "ExportSpecifier": case "ExportDeclaration":
      return { ...declaration(), exports: [], target: unavailable() };
    case "ClassStaticBlockDeclaration": return { ...declaration(), body: bodyIdentity };
    case "StringLiteral": case "NoSubstitutionTemplateLiteral":
      return { core: absentCore(), role: "attribute-value", literal: { kind: "string", value: node.text } };
    case "NumericLiteral": return { core: absentCore(), role: "attribute-value",
      literal: { kind: "number", token: node.text, value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
    case "BigIntLiteral": return { core: absentCore(), role: "attribute-value", literal: { kind: "bigint", token: node.text, value: 1n } };
    case "BinaryExpression": return { core: absentCore(), role: "arithmetic", value: emptyValue() };
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": return { core: absentCore(), role: "value", value: emptyValue() };
    case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword":
      return { core: absentCore(), role: "value", value: emptyValue() };
    case "ExpressionWithTypeArguments": return { core: absentCore(), role: "heritage", type: unavailable(), definition: unavailable() };
    case "ArrayLiteralExpression": case "ObjectLiteralExpression": return { core: absentCore(), role: "assignment-pattern", views: emptyViews() };
    case "CallExpression": case "NewExpression": case "TaggedTemplateExpression": return { ...expressionMetadata(), application: unavailable() };
    case "PropertyAccessExpression": case "ElementAccessExpression":
      return { core: absentCore(), role: "value", value: emptyValue(), origins: unavailable(), accessor: unavailable() };
    case "AwaitExpression": case "SpreadElement": case "YieldExpression": return { ...expressionMetadata(), protocol: unavailable() };
    case "ArrowFunction": case "FunctionExpression": return { ...expressionMetadata(), body: bodyIdentity, captures: [] };
    case "ForInStatement": case "ForOfStatement": return { core: absentCore(), protocol: unavailable() };
    case "SourceFile": return { ...declaration(), body: bodyIdentity };
    case "TypeParameter": return { ...declaration(), parameter: {
      identity: { owner: definitionIdentity, index: 0 }, declaration: definitionIdentity, constraint: null, default: null,
    } };
    case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword": case "IntrinsicKeyword": case "NeverKeyword":
    case "NumberKeyword": case "ObjectKeyword": case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword":
    case "UnknownKeyword": case "VoidKeyword": case "UnionType": case "IntersectionType": case "ConditionalType":
    case "TypeOperator": case "InferType": case "ArrayType": case "IndexedAccessType": case "TypeReference":
    case "LiteralType": case "ThisType": case "TypePredicate": case "TypeQuery": case "MappedType": case "TypeLiteral":
    case "TupleType": case "NamedTupleMember": case "OptionalType": case "RestType": case "ParenthesizedType":
    case "FunctionType": case "ConstructorType": case "TemplateLiteralType": case "TemplateLiteralTypeSpan":
    case "JSDocTypeExpression": case "JSDocNonNullableType": case "JSDocNullableType": case "JSDocAllType":
    case "JSDocVariadicType": case "JSDocOptionalType": case "JSDocSignature": case "JSDocNameReference": case "ImportType": case "JSDocTypeLiteral":
      return typeMetadata();
    case "OmittedExpression": case "RegularExpressionLiteral": case "AsExpression": case "SatisfiesExpression":
    case "ConditionalExpression": case "MetaProperty": case "NonNullExpression": case "TemplateExpression":
    case "ParenthesizedExpression": case "DeleteExpression": case "TypeOfExpression": case "VoidExpression":
    case "TypeAssertionExpression": case "PartiallyEmittedExpression": case "JsxElement": case "JsxAttributes":
    case "JsxNamespacedName": case "JsxOpeningElement": case "JsxSelfClosingElement": case "JsxFragment":
    case "JsxOpeningFragment": case "JsxClosingFragment": case "JsxExpression": case "JsxText": case "SyntheticReferenceExpression":
      return expressionMetadata();
    default: return null;
  }
}

function checkedConstructorInputs(count, nullOptionals, reversed) {
  return constructorInputs(count, nullOptionals, reversed).map(row => {
    const node = structuredClone(row.node);
    const nodes = [];
    const pending = [node];
    const seen = new Set();
    for (const value of pending) {
      if (value === null || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      if (Object.hasOwn(value, "tsonic") && Object.hasOwn(value, "origin")) nodes.push(value);
      for (const [name, child] of Object.entries(value)) if (name !== "tsonic" && child !== null && typeof child === "object") pending.push(child);
    }
    for (const value of nodes) value.tsonic = constructorMetadata(value);
    return node;
  });
}

function constructorModule(node) {
  const value = moduleWith();
  const tagName = syntax("Identifier", 0, { text: "type", tsonic: nameMetadata() });
  const tag = syntax("JSDocTypeTag", 0, { tagName, comment: null, typeExpression: node });
  const type = syntax("JSDocTypeLiteral", 0, { jsDocPropertyTags: [tag], isArrayType: false, tsonic: typeMetadata() });
  const name = syntax("Identifier", 0, { text: "Carrier", tsonic: nameMetadata() });
  const declaration = syntax("TypeAliasDeclaration", 0, { modifiers: null, name, typeParameters: null, type,
    tsonic: { ...declarationFacts(), definition: definitionIdentity, parameters: [], type: unavailable() } });
  value.tree.statements.nodes.push(declaration);
  return value;
}

test("HIR every genuinely checked syntax arm has a complete text roundtrip in its declared containing slot", () => {
  for (const [count, nullOptionals, reversed] of [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]])
    for (const node of checkedConstructorInputs(count, nullOptionals, reversed))
      roundtrip((constructorModule(node)), `checked text/${node.kind}/${count}/${nullOptionals}/${reversed}`);
});

for (const kind of ["WithStatement", "EnumMember", "FunctionDeclaration"])
  test(`HIR ${kind} retains its actual declared field order and named modifier-list shape`, () => {
    for (const [count, nullOptionals, reversed] of [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]]) {
      const node = checkedConstructorInputs(count, nullOptionals, reversed).find(value => value.kind === kind);
      assert.equal(node !== undefined, true, "the existing complete constructor bank contains the real input arm");
      const decoded = roundtrip((constructorModule(node)), `declared projection/${kind}/${count}/${nullOptionals}/${reversed}`);
      if (kind !== "WithStatement" && !nullOptionals)
        assert.equal(decoded.text.includes("modifiers=ModifierList("), true, "the named list is not projected as a plain NodeList");
    }
  });

function typedFixtureText(value) {
  return JSON.stringify(value, (name, field) => typeof field === "bigint" ? { __positiveBigInt: String(field) } : field)
    .replace(/\{"__positiveBigInt":"(-?\d+)"\}/gu, "$1n");
}

function numberSyntaxFixture(root) {
  const pending = [{ node: root, parent: null }];
  const seen = new Set();
  let ordinal = 0;
  while (pending.length > 0) {
    const frame = pending.pop();
    if (seen.has(frame.node)) continue;
    seen.add(frame.node);
    frame.node.id = ordinal;
    frame.node.parent = frame.parent;
    ordinal += 1;
    const children = fixtureChildren(frame.node);
    for (let index = children.length - 1; index >= 0; index -= 1)
      pending.push({ node: children[index], parent: frame.node.id });
  }
}

function moduleWith(statements = []) {
  const end = syntax("EndOfFile", 1, {}, 0);
  const tree = syntax("SourceFile", 0, { statements: nodeList(statements), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: absentCore(), parent: null, attributes: [], memory: available(null), definition: definitionIdentity, body: bodyIdentity } });
  numberSyntaxFixture(tree);
  return { module: moduleIdentity, tree, items: [], bodies: [{ body: bodyIdentity, owner: definitionIdentity,
    params: [], locals: [], root: tree, captures: [], scopes: [], asynchronous: false, generator: false,
    candidateLists: [], nestedBodies: [] }], checkerDiagnostics: [], obligations: [] };
}

function fixtureChildren(node) {
  switch (node.kind) {
    case "SourceFile": return [...node.statements.nodes, node.endOfFileToken];
    case "Block": case "ModuleBlock": return node.statements.nodes;
    case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration":
      return [...(node.modifiers?.nodes ?? []), ...(node.name === null ? [] : [node.name]), ...(node.typeParameters?.nodes ?? []),
        ...(node.heritageClauses?.nodes ?? []), ...node.members.nodes];
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return [...(node.modifiers?.nodes ?? []), node.name, ...(node.typeParameters?.nodes ?? []), node.type];
    case "EnumDeclaration": return [...(node.modifiers?.nodes ?? []), node.name, ...node.members.nodes];
    case "EnumMember": return [...(node.modifiers?.nodes ?? []), node.name,
      ...(node.postfixToken === null ? [] : [node.postfixToken]), ...(node.initializer === null ? [] : [node.initializer])];
    case "ModuleDeclaration": return [...(node.modifiers?.nodes ?? []), ...(node.asteriskToken === null ? [] : [node.asteriskToken]),
      node.name, ...(node.body === null ? [] : [node.body])];
    case "ImportDeclaration": case "JSImportDeclaration": return [...(node.modifiers?.nodes ?? []), ...(node.importClause === null ? [] : [node.importClause]),
      node.moduleSpecifier, ...(node.attributes === null ? [] : [node.attributes])];
    case "ExportDeclaration": return [...(node.modifiers?.nodes ?? []), ...(node.exportClause === null ? [] : [node.exportClause]),
      ...(node.moduleSpecifier === null ? [] : [node.moduleSpecifier]), ...(node.attributes === null ? [] : [node.attributes])];
    case "ExportAssignment": return [...(node.modifiers?.nodes ?? []), ...(node.type === null ? [] : [node.type]), node.expression];
    case "NamedExports": return node.elements.nodes;
    case "NamedImports": return node.elements.nodes;
    case "ImportClause": return [...(node.name === null ? [] : [node.name]), ...(node.namedBindings === null ? [] : [node.namedBindings])];
    case "ImportSpecifier": case "ExportSpecifier": return [...(node.propertyName === null ? [] : [node.propertyName]), node.name];
    case "NamespaceImport": case "NamespaceExport": return [node.name];
    case "TypeParameter": return [...(node.modifiers?.nodes ?? []), node.name, ...(node.constraint === null ? [] : [node.constraint]),
      ...(node.expression === null ? [] : [node.expression]), ...(node.defaultType === null ? [] : [node.defaultType])];
    case "HeritageClause": return node.types.nodes;
    case "PropertySignature": case "PropertyDeclaration": return [...(node.modifiers?.nodes ?? []), node.name,
      ...(node.postfixToken === null ? [] : [node.postfixToken]), ...(node.type === null ? [] : [node.type]),
      ...(node.initializer === null ? [] : [node.initializer])];
    case "ClassStaticBlockDeclaration": return [...(node.modifiers?.nodes ?? []), node.body];
    case "TryStatement": return [node.tryBlock, ...(node.catchClause === null ? [] : [node.catchClause]), ...(node.finallyBlock === null ? [] : [node.finallyBlock])];
    case "CatchClause": return [...(node.variableDeclaration === null ? [] : [node.variableDeclaration]), node.block];
    case "ArrayBindingPattern": case "ObjectBindingPattern": return node.elements.nodes;
    case "BindingElement": return [...(node.dotDotDotToken === null ? [] : [node.dotDotDotToken]),
      ...(node.propertyName === null ? [] : [node.propertyName]), ...(node.name === null ? [] : [node.name]),
      ...(node.initializer === null ? [] : [node.initializer])];
    case "ExpressionStatement": case "AwaitExpression": case "SpreadElement": case "ParenthesizedExpression":
    case "DeleteExpression": case "TypeOfExpression": case "VoidExpression": return [node.expression];
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": return [node.operand];
    case "YieldExpression": return [...(node.asteriskToken === null ? [] : [node.asteriskToken]), ...(node.expression === null ? [] : [node.expression])];
    case "ForInStatement": case "ForOfStatement": return [...(node.awaitModifier === null ? [] : [node.awaitModifier]), node.initializer, node.expression, node.statement];
    case "SwitchStatement": return [node.expression, node.caseBlock];
    case "CaseBlock": return node.clauses.nodes;
    case "CaseClause": case "DefaultClause": return [...(node.expression === null ? [] : [node.expression]), ...node.statements.nodes];
    case "VariableStatement": return [...(node.modifiers?.nodes ?? []), node.declarationList];
    case "VariableDeclarationList": return node.declarations.nodes;
    case "VariableDeclaration": return [node.name, ...(node.exclamationToken === null ? [] : [node.exclamationToken]),
      ...(node.type === null ? [] : [node.type]), ...(node.initializer === null ? [] : [node.initializer])];
    case "Parameter": return [...(node.modifiers?.nodes ?? []), ...(node.dotDotDotToken === null ? [] : [node.dotDotDotToken]), node.name,
      ...(node.questionToken === null ? [] : [node.questionToken]), ...(node.type === null ? [] : [node.type]), ...(node.initializer === null ? [] : [node.initializer])];
    case "FunctionDeclaration": case "FunctionExpression": return [...(node.modifiers?.nodes ?? []), ...(node.asteriskToken === null ? [] : [node.asteriskToken]),
      ...(node.name === null ? [] : [node.name]), ...(node.typeParameters?.nodes ?? []), ...node.parameters.nodes,
      ...(node.type === null ? [] : [node.type]), ...(node.fullSignature === null ? [] : [node.fullSignature]), ...(node.body === null ? [] : [node.body])];
    case "CallSignature": return [...(node.typeParameters?.nodes ?? []), ...node.parameters.nodes,
      ...(node.type === null ? [] : [node.type]), ...(node.fullSignature === null ? [] : [node.fullSignature])];
    case "ArrowFunction": return [...(node.modifiers?.nodes ?? []), ...(node.typeParameters?.nodes ?? []), ...node.parameters.nodes,
      ...(node.type === null ? [] : [node.type]), ...(node.fullSignature === null ? [] : [node.fullSignature]),
      ...(node.asteriskToken === null ? [] : [node.asteriskToken]), node.equalsGreaterThanToken, ...(node.body === null ? [] : [node.body])];
    case "ArrayLiteralExpression": return node.elements.nodes;
    case "ObjectLiteralExpression": return node.properties.nodes;
    case "ExpressionWithTypeArguments": return [node.expression, ...(node.typeArguments?.nodes ?? [])];
    case "PropertyAccessExpression": return [node.expression, ...(node.questionDotToken === null ? [] : [node.questionDotToken]), node.name];
    case "BinaryExpression": return [node.left, node.operatorToken, node.right];
    case "CallExpression": return [node.expression, ...(node.questionDotToken === null ? [] : [node.questionDotToken]),
      ...(node.typeArguments?.nodes ?? []), ...node.arguments.nodes];
    case "NewExpression": return [node.expression, ...(node.typeArguments?.nodes ?? []), ...(node.arguments?.nodes ?? [])];
    case "LiteralType": return [node.literal];
    case "TypeAssertionExpression": return [node.type, node.expression];
    case "ElementAccessExpression": return [node.expression, ...(node.questionDotToken === null ? [] : [node.questionDotToken]), node.argumentExpression];
    case "Identifier": case "EndOfFile": case "EmptyStatement": case "NumericLiteral": case "BigIntLiteral":
    case "StringLiteral": case "NoSubstitutionTemplateLiteral": case "PlusToken": case "AnyKeyword": return [];
    default:
      if (/(?:Keyword|Token)$/u.test(node.kind)) return [];
      assert.fail(`fixture requires its independently authored child order: ${node.kind}`);
  }
}

function contextFor(value, additions = {}, additionalModules = []) {
  const declarations = new Set();
  const lexicalScopes = new Map();
  const checkedNodes = new Map();
  const declaredLocals = new Set();
  const bodyPaths = new Map();
  const definitionPaths = new Map();
  const readPaths = root => {
    const pending = [root];
    const seen = new Set();
    for (const input of pending) {
      if (typeof input === "string") {
        const body = ids.decodeBodyId(input);
        if (body.kind === "decoded") {
          bodyPaths.set(ids.encodeBodyId(body.value), (body.value));
          const owner = ids.decodeDefId(body.value.owner);
          assert.equal(owner.kind === "decoded", true, "real body decoder supplies an owner-issued definition");
          definitionPaths.set(ids.encodeDefId(owner.value), (owner.value));
        } else {
          const definition = ids.decodeDefId(input);
          if (definition.kind === "decoded") definitionPaths.set(ids.encodeDefId(definition.value), (definition.value));
        }
      } else if (input !== null && typeof input === "object" && !seen.has(input)) {
        seen.add(input);
        for (const child of Object.values(input)) pending.push(child);
      }
    }
  };
  for (const module of [value, ...additionalModules]) {
    readPaths(module);
    declarations.add(module.tree.tsonic.definition);
    for (const item of module.items) declarations.add(item.definition);
    for (const body of module.bodies) for (const local of body.locals)
      declaredLocals.add(JSON.stringify({ body: body.body, local: local.id }));
    const bodyRoots = new Map(module.bodies.map(body => [body.root, body.body]));
    const itemRoots = new Map(module.items.map(item => [item.node, item.definition]));
    const pending = [{ node: module.tree, body: null, definition: module.tree.tsonic.definition }];
    const visited = new Set();
    while (pending.length > 0) {
      const frame = pending.pop();
      if (visited.has(frame.node)) continue;
      visited.add(frame.node);
      const body = bodyRoots.get(frame.node) ?? frame.body;
      const definition = itemRoots.get(frame.node.id) ?? frame.definition;
      const item = { kind: "item", value: { owner: definition, node: frame.node.id } };
      const reference = body === null ? item : bodySource(frame.node.id, body);
      lexicalScopes.set(JSON.stringify(reference), emptyScope());
      lexicalScopes.set(JSON.stringify(item), emptyScope());
      checkedNodes.set(JSON.stringify(reference), frame.node);
      checkedNodes.set(JSON.stringify(item), frame.node);
      const children = fixtureChildren(frame.node);
      for (let ordinal = children.length - 1; ordinal >= 0; ordinal -= 1) pending.push({ node: children[ordinal], body, definition });
    }
  }
  return { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [] },
    bodyPathOf: identity => bodyPaths.get(identity) ?? null,
    definitionPathOf: identity => definitionPaths.get(identity) ?? null,
    bindingScopeOf: definition => declarations.has(definition) ? emptyScope() : null,
    bindingScopeAt: reference => lexicalScopes.get(JSON.stringify(reference)) ?? null,
    nominalOf: definition => { assert.fail(`unexpected nominal lookup: ${definition}`); },
    nodeOf: reference => checkedNodes.get(JSON.stringify(reference)) ?? null,
    localExists: reference => declaredLocals.has(JSON.stringify(reference)), ...additions };
}

for (const mode of ["known", "unknown", "mismatch"])
  test(`HIR authenticates supplied canonical definition paths with complete ${mode} outcome`, () => {
    const path = { module: ids.encodeModuleId({ package: ids.encodePackageId("/external"), path: "value.ts" }),
      segments: [{ name: "Value", ordinal: 0 }] };
    const definition = ids.encodeDefId(path);
    const expression = nameExpression("external");
    expression.tsonic.resolution = { kind: "definition", definition, aliases: [] };
    const value = (expressionModule(expression));
    const base = contextFor(value);
    const context = { ...base,
      definitionPathOf: identity => identity !== definition ? base.definitionPathOf(identity) :
        mode === "unknown" ? null : mode === "mismatch" ? { ...path, segments: [{ name: "Other", ordinal: 0 }] } : path,
      bindingScopeOf: identity => identity === definition ? emptyScope() : base.bindingScopeOf(identity),
    };
    assert.deepStrictEqual(product.verifyHir(value, context), mode === "known" ? [] : [
      violation(mode === "mismatch" ? "identity-path-exact" : "definition-reference", nodeSite(2),
        mode === "mismatch" ? "definition path must encode its exact supplied identity" : "definition must exist in the canonical declaration inventory"),
    ]);
  });

for (const mode of ["known", "unknown", "mismatch"])
  test(`HIR authenticates actual module body paths and retains the complete ${mode} holder result`, () => {
    const value = (moduleWith());
    const base = contextFor(value);
    const path = { owner: definitionIdentity, role: "module", ordinal: 0 };
    const context = { ...base, bodyPathOf: identity => identity !== bodyIdentity ? base.bodyPathOf(identity) :
      mode === "unknown" ? null : mode === "mismatch" ? { ...path, ordinal: 1 } : path };
    assert.deepStrictEqual(product.verifyHir(value, context), mode === "known" ? [] : [
      violation(mode === "mismatch" ? "identity-path-exact" : "body-owner", nodeSite(0),
        mode === "mismatch" ? "body path must encode its exact supplied identity" : "body must exist in the canonical identity inventory"),
      ...(mode === "mismatch" ? [violation("identity-path-exact", { kind: "body", body: bodyIdentity },
        "body path must encode its exact supplied identity")] : []),
    ]);
  });

for (const mismatch of [false, true]) test(`HIR the body owner uses the same authenticated definition path with ${mismatch ? "mismatch" : "unknown"} declaration`, () => {
  const value = (moduleWith());
  const base = contextFor(value);
  const context = { ...base, definitionPathOf: () => mismatch ?
    { module: value.module, segments: [{ name: "other", ordinal: 0 }] } : null };
  const rule = mismatch ? "identity-path-exact" : "definition-reference";
  const definitionDetail = mismatch ? "definition path must encode its exact supplied identity" : "definition must exist in the canonical declaration inventory";
  assert.deepStrictEqual(product.verifyHir(value, context), [
    violation(rule, nodeSite(0), definitionDetail),
    violation(mismatch ? "identity-path-exact" : "body-owner", nodeSite(0),
      mismatch ? definitionDetail : "body must exist in the canonical identity inventory"),
    ...(mismatch ? [violation("identity-path-exact", { kind: "body", body: bodyIdentity }, definitionDetail)] : []),
    violation(rule, { kind: "body", body: bodyIdentity }, definitionDetail),
  ]);
});

function freshContextFor(value, additionalModules) {
  const context = contextFor(value, {}, additionalModules);
  return { ...context, nodeOf: reference => {
    const node = context.nodeOf(reference);
    return node === null ? null : (structuredClone(node));
  } };
}

function assertComplete(actual, expected, label) {
  const pending = [[actual, expected, label]];
  const paired = new Map();
  const syntaxPairs = new Map();
  const actualSyntax = new Map();
  while (pending.length > 0) {
    const [left, right, path] = pending.pop();
    if (right === null || typeof right !== "object") {
      assert.equal(Object.is(left, right), true, `${path}: exact scalar`);
      continue;
    }
    assert.equal(left !== null && typeof left === "object", true, `${path}: record or array`);
    assert.equal(Array.isArray(left), Array.isArray(right), `${path}: container kind`);
    if (Object.hasOwn(right, "id") && Object.hasOwn(right, "tsonic")) {
      if (syntaxPairs.has(right)) {
        assert.equal(left === syntaxPairs.get(right), true, `${path}: actual syntax sharing`);
        continue;
      }
      assert.equal(actualSyntax.has(left), false, `${path}: distinct declared syntax objects must not collapse`);
      syntaxPairs.set(right, left);
      actualSyntax.set(left, right);
    }
    let previous = paired.get(right);
    if (previous?.has(left)) continue;
    if (previous === undefined) { previous = new Set(); paired.set(right, previous); }
    previous.add(left);
    const names = Object.keys(right);
    assert.deepStrictEqual(Object.keys(left).sort(), [...names].sort(), `${path}: all declared keys`);
    for (const name of names) pending.push([left[name], right[name], `${path.length > 160 ? path.slice(-100) : path}.${name}`]);
  }
}

function roundtrip(value, label) {
  const text = product.printHir(value);
  const decoded = product.parseHir(text);
  assert.equal(decoded.kind, "parsed", `${label}: declared parse arm`);
  if (decoded.kind !== "parsed") assert.fail(`${label}: invalid text ${JSON.stringify(decoded)}`);
  assertComplete(decoded, { kind: "parsed", value }, label);
  assert.equal(decoded.value.bodies.every((body, ordinal) => (body.root === decoded.value.tree) ===
    (value.bodies[ordinal].root === value.tree)), true, `${label}: SAME actual module body roots, not copied trees`);
  return { text, value: decoded.value };
}

test("HIR public index has exactly the seven current complete data operations", () => {
  assert.deepStrictEqual(Object.keys(product).sort(), ["childrenOfSyntax", "indexSyntaxTree", "orderPragmaArguments", "parseHir", "printHir", "verifyHir", "walkSyntaxTree"]);
  assert.deepStrictEqual(readdirSync(resolve(repository, "packages/host/src/ir-hir")).filter(name => name.endsWith(".ts")).sort(),
    ownedSources.map(path => basename(path)).sort());
});

test("HIR minimal module roundtrips full data and verifies without querying absent providers", () => {
  const value = (moduleWith());
  const decoded = roundtrip(value, "minimal module");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

test("HIR wire bindings preserve distinct objects with repeated semantic ids, signed zero and shared syntax", () => {
  for (const [rootId, endId, expected] of [
    [0, 0, [violation("node-dense-preorder", nodeSite(0), "id must equal module preorder position")]],
    [-0, 0, [violation("node-dense-preorder", nodeSite(-0), "id must equal module preorder position"),
      violation("node-dense-preorder", nodeSite(0), "id must equal module preorder position"),
      violation("lexical-parent", nodeSite(0), "parent must be the actual syntactic parent")]],
    [0, -0, [violation("node-dense-preorder", nodeSite(-0), "id must equal module preorder position")]],
    [NaN, Infinity, [violation("node-dense-preorder", nodeSite(NaN), "id must equal module preorder position"),
      violation("node-dense-preorder", nodeSite(Infinity), "id must equal module preorder position"),
      violation("lexical-parent", nodeSite(Infinity), "parent must be the actual syntactic parent"),
      violation("node-reference", nodeSite(Infinity), "node must exist in the module arena")]],
    [-Infinity, 0.5, [violation("node-dense-preorder", nodeSite(-Infinity), "id must equal module preorder position"),
      violation("node-dense-preorder", nodeSite(0.5), "id must equal module preorder position"),
      violation("lexical-parent", nodeSite(0.5), "parent must be the actual syntactic parent"),
      violation("node-reference", nodeSite(0.5), "node must exist in the module arena")]],
  ]) {
    const value = moduleWith();
    value.tree.id = rootId;
    value.tree.endOfFileToken.id = endId;
    const decoded = roundtrip((value), `semantic ids ${String(rootId)}/${String(endId)}`);
    assert.equal(decoded.value.tree !== decoded.value.tree.endOfFileToken, true, "wire objects remain distinct despite payload collision");
    assert.equal(Object.is(decoded.value.tree.id, rootId), true);
    assert.equal(Object.is(decoded.value.tree.endOfFileToken.id, endId), true);
    assertComplete(product.verifyHir(value, contextFor(value)), expected, "complete semantic-id violation vector");
    assertComplete(product.verifyHir(decoded.value, contextFor(decoded.value)), expected, "wire-preserved semantic-id violation vector");
  }
  const block = syntax("Block", 1, { statements: nodeList([]), multiLine: false }, 0);
  const value = moduleWith([block]);
  value.tree.statements.nodes.push(block);
  const decoded = roundtrip((value), "shared syntax object");
  assert.equal(decoded.value.tree.statements.nodes[0] === decoded.value.tree.statements.nodes[1], true);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
    violation("node-dense-preorder", nodeSite(1), "syntax node occurs more than once"),
  ]);
});

test("HIR deep checked block syntax prints, parses and verifies 100000 levels without recursive input processing", () => {
  let block = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  for (let ordinal = 1; ordinal < 100_000; ordinal += 1)
    block = syntax("Block", 0, { statements: nodeList([block]), multiLine: ordinal % 2 === 0 });
  const value = (moduleWith([block]));
  const decoded = roundtrip(value, "100000 checked blocks");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  const nodes = indexSyntaxTree(decoded.value.tree);
  const expected = [decoded.value.tree];
  let expectedBlock = decoded.value.tree.statements.nodes[0];
  while (true) {
    expected.push(expectedBlock);
    if (expectedBlock.statements.nodes.length === 0) break;
    expectedBlock = expectedBlock.statements.nodes[0];
  }
  expected.push(decoded.value.tree.endOfFileToken);
  assertNodes(nodes, expected, "every deep preorder entry is the actual declared object in order");
});

test("HIR authored whole-module text and verifier case has an independent complete expected value", async () => {
  const path = "test/host-cases/ir-hir/verifier/minimal-module.case.json";
  const text = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const expected = (moduleWith());
  assert.equal(product.printHir(expected), text);
  const parsed = product.parseHir(text);
  assertComplete(parsed, { kind: "parsed", value: expected }, "independently authored full HIR text");
  const result = await runCase({ modules: ["ir-hir"], evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
    readText: path => readFileSync(resolve(repository, path), "utf8"),
    canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
    list: path => readdirSync(resolve(repository, path)), decode: text => JSON.parse(text),
    adapters: { verifier: input => {
      const decoded = product.parseHir(input.text);
      if (decoded.kind !== "parsed") assert.fail("authored typed HIR must parse");
      return { kind: "accepted", value: product.verifyHir(decoded.value, contextFor(decoded.value)), diagnostics: [] };
    } },
  }, path);
  assert.deepStrictEqual(result, { status: "passed", path, outcome: { kind: "accepted", value: [], diagnostics: [] } });
});

for (const [text, expected] of [
  ["", { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"], found: null }],
  ["HirModule()", { kind: "invalid-text", offset: 10, line: 1, column: 11, expected: ["module"], found: ")" }],
  ["Other()", { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["HirModule"], found: "O" }],
  ["[]", { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"], found: "[" }],
  ["HirModule(", { kind: "invalid-text", offset: 10, line: 1, column: 11, expected: ["identifier"], found: null }],
]) test(`HIR malformed text returns its complete independent UTF16 error: ${JSON.stringify(text)}`, () => {
  assert.deepStrictEqual(product.parseHir(text), expected);
});

test("HIR graph judgments wait for clean EOF and never mask actual stream faults", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  for (const later of ['scriptKind="Wrong"', 'scriptKind="TS\\q"']) {
    const text = original.replace("tree=n:0", "tree=n:999").replace('scriptKind="TS"', later);
    const escape = later.includes("\\q");
    assertInvalidText(text, escape ? text.indexOf("\\q") + 1 : text.indexOf(later) + "scriptKind=".length,
      escape ? ["JSON escape"] : ["declared field value"]);
  }
  const short = 'HirModule(module=mod:"M[P[%002Fproject];main.ts]", tree=n:99, bogus=@)';
  assertInvalidText(short, short.indexOf("bogus"), ["items"]);
  const wrong = original.replace("tree=n:0", "tree=n:1").replace('scriptKind="TS"', 'scriptKind="Wrong"');
  assertInvalidText(wrong, wrong.indexOf('"Wrong"'), ["declared field value"]);
  const causal = original.replace('scriptKind="TS"', 'scriptKind="Wrong"');
  assertInvalidText(causal, causal.indexOf('"Wrong"'), ["declared field value"]);
  const dangling = original.replace("tree=n:0", "tree=n:999");
  assertInvalidText(dangling, dangling.indexOf("tree=n:999") + 5, ["declared syntax node"]);
});

function authoredWireBlock(id, targets) {
  return `n:${id}=Block(id=n:${id}, origin=Origin(module=mod:"${moduleIdentity}", start=0, length=100, derived=[]), parent=n:0, flags=[], loc=TextRange(pos=0, end=100), statements=NodeList(loc=TextRange(pos=0, end=100), nodes=[${targets.map(target => `n:${target}`).join(", ")}]), multiLine=false, tsonic=null)`;
}

for (const pair of [false, true]) test(`HIR ${pair ? "two-binding" : "self-binding"} child cycle text reports its closing reference, not an arena-id refusal`, () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const text = original.replace("nodes=[]", "nodes=[n:2]") + "\n" + authoredWireBlock(2, [pair ? 3 : 2]) + (pair ? "\n" + authoredWireBlock(3, [2]) : "");
  const closing = text.lastIndexOf("nodes=[n:2]") + 7;
  assertInvalidText(text, closing, ["acyclic syntax reference"]);
  const mixed = text.replace(/multiLine=false, tsonic=null\)$/u, "multiLine=@, tsonic=null)");
  assertInvalidText(mixed, mixed.indexOf("multiLine=@") + "multiLine=".length, ["identifier"]);
});

test("HIR prefix-cycle choice is text-order first even when DFS meets the later-closing component first", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const first = authoredWireBlock(2, [4]);
  const earliest = authoredWireBlock(3, [3]);
  const last = authoredWireBlock(4, [2]);
  const text = original.replace("nodes=[]", "nodes=[n:2, n:3]") + `\n${first}\n${earliest}\n${last}`;
  assertInvalidText(text, text.indexOf(earliest) + earliest.indexOf("nodes=[n:3]") + 7, ["acyclic syntax reference"]);
});

for (const danglingFirst of [false, true]) test(`HIR graph priority preserves ${danglingFirst ? "dangling" : "cycle-closing"} first reference`, () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const block = authoredWireBlock(2, danglingFirst ? [99, 2] : [2, 99]);
  const text = original.replace("nodes=[]", "nodes=[n:2]") + `\n${block}`;
  assertInvalidText(text, text.indexOf(block) + block.indexOf("nodes=[") + 7,
    [danglingFirst ? "declared syntax node" : "acyclic syntax reference"]);
});

for (const backward of [false, true]) test(`HIR ${backward ? "backward" : "forward"} wrong-family reference waits for clean EOF and loses to a later lexical fault`, () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const text = backward ? original.replace("endOfFileToken=n:1", "endOfFileToken=n:0") : original.replace("tree=n:0", "tree=n:1");
  const marker = backward ? "endOfFileToken=n:0" : "tree=n:1";
  assertInvalidText(text, text.indexOf(marker) + (backward ? "endOfFileToken=".length : 5), [backward ? "EndOfFile" : "SourceFile"]);
  const finalLine = text.lastIndexOf("\nn:1=");
  const later = text.slice(0, finalLine) + text.slice(finalLine).replace(`mod:"${moduleIdentity}"`, 'mod:"\\q"');
  assertInvalidText(later, later.lastIndexOf("\\q") + 1, ["JSON escape"]);
});

for (const danglingFirst of [false, true]) test(`HIR wrong-family versus dangling graph errors select their genuine ${danglingFirst ? "dangling" : "wrong-family"} first token`, () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const text = original.replace("tree=n:0", `tree=n:${danglingFirst ? 99 : 1}`)
    .replace("endOfFileToken=n:1", `endOfFileToken=n:${danglingFirst ? 0 : 99}`);
  assertInvalidText(text, text.indexOf("tree=n:") + 5, [danglingFirst ? "declared syntax node" : "SourceFile"]);
});

test("HIR a wrong-family cycle-closing reference has the same-token family priority", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const block = authoredWireBlock(2, [0]);
  const text = original.replace("nodes=[]", "nodes=[n:2]") + `\n${block}`;
  assertInvalidText(text, text.indexOf(block) + block.indexOf("nodes=[n:0]") + 7, ["Statement"]);
});

test("one native pragma boundary orders complete UTF16 entries and rejects duplicate names before printing", () => {
  const argument = { pos: 0, end: 1, name: "field", value: "value" };
  const names = ["\uE000", "z", "__proto__", "\uD800", "", "a", "a\u0000", "A"];
  const entries = names.map(name => ({ name, value: argument }));
  const expected = ["", "A", "__proto__", "a", "a\u0000", "z", "\uD800", "\uE000"]
    .map(name => ({ name, value: argument }));
  assert.deepStrictEqual(product.orderPragmaArguments(entries), expected);
  assert.deepStrictEqual(entries, names.map(name => ({ name, value: argument })));
  assert.deepStrictEqual(product.orderPragmaArguments([]), []);
  const failure = { name: "TypeError", message: "HIR pragma argument names must be unique." };
  for (const name of ["", "a", "\uD800"]) {
    const duplicate = [{ name, value: argument }, { name, value: { ...argument, value: "second" } }];
    assert.throws(() => product.orderPragmaArguments(duplicate), failure);
    const text = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
    const decoded = product.parseHir(text);
    assert.equal(decoded.kind, "parsed");
    if (decoded.kind !== "parsed") return;
    decoded.value.tree.pragmas = [{ kind: "SingleLineCommentTrivia", pos: 0, end: 1,
      hasTrailingNewLine: false, name: "duplicates", args: duplicate }];
    assert.throws(() => product.printHir(decoded.value), failure);
  }
});

test("HIR dictionary duplicate priority and an earlier descending decoded character survive later lexical failure", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const entry = key => `${key}=PragmaArgument(pos=0, end=1, name="key", value="value")`;
  const wrap = entries => original.replace("pragmas=[]", `pragmas=[SingleLineCommentTrivia(pos=0, end=100, hasTrailingNewLine=false, name="keys", args=PragmaArguments(${entries}))]`);
  const wrongRecord = wrap("").replace("args=PragmaArguments(", "args=Other(");
  assertInvalidText(wrongRecord, wrongRecord.indexOf("args=Other(") + "args=".length, ["PragmaArguments"]);
  const duplicate = wrap([entry("z"), entry("zz"), entry('"z"')].join(", "));
  assertInvalidText(duplicate, duplicate.indexOf('"z"=PragmaArgument') + 1, ["unique record field"]);
  const malformed = wrap([entry("z"), entry('"a\\q"')].join(", "));
  assertInvalidText(malformed, malformed.indexOf('"a\\q"') + 1, ["increasing dictionary key"]);
  const before = wrap([entry("z"), entry('"\\qa"')].join(", "));
  assertInvalidText(before, before.indexOf("\\qa") + 1, ["JSON escape"]);
  const unicode = wrap([entry("z"), entry('"\\uZZZZa"')].join(", "));
  assertInvalidText(unicode, unicode.indexOf("\\uZZZZ") + 2, ["four hexadecimal digits"]);
});

for (const pair of [["z", "a"], ["2", "10"], ["z", "\\u0061"], ["z", "__proto__"], ["\\uE000", "\\uD800"]])
  test(`HIR dictionary rejects first descending decoded UTF16 key ${pair.join("/")}`, () => {
    const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
    const field = name => `"${name}"=PragmaArgument(pos=0, end=1, name="key", value="value")`;
    const dictionary = `PragmaArguments(${field(pair[0])}, ${field(pair[1])})`;
    const text = original.replace("pragmas=[]", `pragmas=[SingleLineCommentTrivia(pos=0, end=100, hasTrailingNewLine=false, name="order", args=${dictionary})]`);
    const start = text.indexOf(dictionary) + dictionary.indexOf(field(pair[1])) + 1;
    assertInvalidText(text, start, ["increasing dictionary key"]);
    const mixed = text.replace('checkJsDirective=null', 'checkJsDirective=@');
    assertInvalidText(mixed, start, ["increasing dictionary key"]);
  });

for (const role of ["attribute-value", "type-literal"]) for (const kind of ["NumericLiteral", "BigIntLiteral"])
  for (const agrees of [false, true]) test(`HIR ${kind}/${role} compares exact represented syntax ${agrees ? "equal spelling-independent" : "different"} value`, () => {
    const numeric = kind === "NumericLiteral";
    const literal = numeric ? { kind: "number", value: { numerator: 2n, denominator: 1n, negativeZero: false } } :
      { kind: "bigint", value: 2n };
    if (role === "attribute-value") literal.token = numeric ? "2e0" : "0b10n";
    const node = syntax(kind, 0, { text: numeric ? agrees ? "0x2" : "1" : agrees ? "0x2n" : "1n", tokenFlags: [],
      tsonic: { core: absentCore(), role, ...(role === "type-literal" ? { type: unavailable() } : {}), literal } });
    const value = (expressionModule(node));
    assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), agrees ? [] : [
      violation("literal-exact", nodeSite(2), "literal category and value must match its syntax"),
    ]);
  });

for (const [text, token, numerator, denominator, negativeZero, agrees] of [
  ["-0", "-0.0", 0n, 1n, true, true], ["0", "-0", 0n, 1n, true, false],
  ["-0", "0", 0n, 1n, false, false], [".5", "5e-1", 1n, 2n, false, true],
  ["1_0", "1e1", 10n, 1n, false, true], ["255", "0xF_F", 255n, 1n, false, true],
  ["not-number", "1", 1n, 1n, false, false],
]) test(`HIR numeric syntax correlation retains complete ${text}/${token} exact rational and signed-zero outcome`, () => {
  const node = syntax("NumericLiteral", 0, { text, tokenFlags: [], tsonic: { core: absentCore(), role: "attribute-value",
    literal: { kind: "number", token, value: { numerator, denominator, negativeZero } } } });
  const value = (expressionModule(node));
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), agrees ? [] : [
    violation("literal-exact", nodeSite(2), "literal category and value must match its syntax"),
  ]);
});

test("HIR invalid bigint syntax is not admitted by internally valid authored bigint metadata", () => {
  const node = syntax("BigIntLiteral", 0, { text: "1.0n", tokenFlags: [], tsonic: { core: absentCore(), role: "attribute-value",
    literal: { kind: "bigint", token: "1n", value: 1n } } });
  const value = (expressionModule(node));
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [
    violation("literal-exact", nodeSite(2), "literal category and value must match its syntax"),
  ]);
});

const minimalOpposites = [
  ["node-dense-preorder", value => { value.tree.endOfFileToken.id = 3; },
    [violation("node-dense-preorder", nodeSite(3), "id must equal module preorder position")]],
  ["lexical-parent", value => { value.tree.endOfFileToken.parent = 1; },
    [violation("lexical-parent", nodeSite(1), "parent must be the actual syntactic parent")]],
  ["origin-range", value => { value.tree.endOfFileToken.loc.end = -1; },
    [violation("origin-range", nodeSite(1), "invalid syntax range")]],
  ["origin-span", value => { value.tree.endOfFileToken.origin.length = -1; },
    [violation("origin-range", nodeSite(1), "invalid origin range")]],
  ["node-in-body-range", value => { value.tree.endOfFileToken.loc.end = 101; },
    [violation("node-in-body-range", nodeSite(1), "syntax must remain inside its body root range")]],
  ["module-owner", value => { value.tree.endOfFileToken.origin.module = "M[P[other];other.ts]"; },
    [violation("module-owner", nodeSite(1), "origin must name this module")]],
  ["body-unique", value => { value.bodies.push(value.bodies[0]); }, [
    violation("body-unique", { kind: "body", body: bodyIdentity }, "body occurs more than once"),
    violation("stable-order", { kind: "body", body: bodyIdentity }, "bodies must be in identity order"),
  ]],
  ["definition-unique", value => { value.items = [{ definition: definitionIdentity, node: 0 }, { definition: definitionIdentity, node: 0 }]; }, [
    violation("definition-unique", { kind: "definition", definition: definitionIdentity }, "definition occurs more than once"),
    violation("stable-order", { kind: "definition", definition: definitionIdentity }, "definitions must be in identity order"),
  ]],
  ["definition-parent", value => { value.items = [{ definition: definitionIdentity, node: 0 }]; value.tree.tsonic.parent = definitionIdentity; },
    [violation("definition-parent", { kind: "definition", definition: definitionIdentity }, "declaration parent must be a proper definition path prefix")]],
  ["definition-reference", value => { value.items = [{ definition: definitionIdentity, node: 1 }]; },
    [violation("definition-reference", { kind: "definition", definition: definitionIdentity }, "declaration entry must match its actual node definition")]],
  ["node-reference", value => { value.tree.parent = 99; }, [
    violation("lexical-parent", nodeSite(0), "parent must be the actual syntactic parent"),
    violation("node-reference", nodeSite(0), "node must exist in the module arena"),
  ]],
  ["parameter-order", value => { value.bodies[0].locals = [{ id: 0, declaration: bodySource(0), name: "p", role: "parameter",
    checkerSlot: unavailable(), capturedFrom: null, mutable: false }]; },
    [violation("parameter-order", { kind: "body", body: bodyIdentity }, "parameters must name every parameter local in declaration order")]],
  ["local-dense", value => { value.bodies[0].locals = [{ id: 2, declaration: bodySource(0), name: "v", role: "binding",
    checkerSlot: unavailable(), capturedFrom: null, mutable: true }]; },
    [violation("local-dense", { kind: "body", body: bodyIdentity }, "local id must equal its declaration position")]],
  ["capture-owner", value => { value.bodies[0].locals = [{ id: 0, declaration: bodySource(0), name: "v", role: "binding",
    checkerSlot: unavailable(), capturedFrom: { body: bodyIdentity, local: 0 }, mutable: true }]; },
    [violation("capture-owner", { kind: "body", body: bodyIdentity }, "noncapture local cannot have capturedFrom")]],
  ["scope-parent", value => { value.bodies[0].scopes = [{ node: 0, parent: 1, attributes: [] }]; },
    [violation("scope-parent", { kind: "body", body: bodyIdentity }, "scope parent must be an earlier enclosing scope")]],
  ["core-capture-kind", value => { value.tree.tsonic.core.argumentPassing = available({ role: "declaration", mode: "by-value" }); },
    [violation("core-capture-kind", nodeSite(0), "declaration passing mode belongs to a parameter declaration")]],
  ["core-capture-reference", value => { value.tree.tsonic.core.pointerOperation = available({ family: "keep-alive", operation: "keep-alive", value: bodySource(99) }); }, [
    violation("cross-owner-qualified", nodeSite(0), "qualified body node must exist in its named owner"),
    violation("core-capture-reference", nodeSite(0), "Core capture reference must retain an existing qualified source node"),
  ]],
];

for (const [name, mutate, expected] of minimalOpposites) test(`HIR minimal constructible opposite has the complete vector: ${name}`, () => {
  const valid = moduleWith();
  assert.deepStrictEqual(product.verifyHir((valid), contextFor(valid)), []);
  const invalid = moduleWith();
  mutate(invalid);
  assert.deepStrictEqual(product.verifyHir((invalid), contextFor(invalid)), expected);
});

test("HIR stable-order has a complete independent two-order scope witness without duplicate arena ids", () => {
  for (const [order, expected] of [
    [[0, 1], []],
    [[1, 0], [violation("stable-order", { kind: "body", body: bodyIdentity }, "scopes must be distinct and in preorder")]],
  ]) {
    const value = moduleWith();
    value.bodies[0].scopes = order.map(node => ({ node, parent: null, attributes: [] }));
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), expected);
  }
});

function replaceModuleOwner(value, definition, body) {
  value.tree.tsonic.definition = definition;
  value.tree.tsonic.body = body;
  value.bodies[0].owner = definition;
  value.bodies[0].body = body;
}

function foreignModuleWith(statements, path = "foreign.ts") {
  const value = moduleWith(statements);
  value.module = `M[P[%002Fproject];${path}]`;
  const definition = `D[${value.module}]`;
  replaceModuleOwner(value, definition, `B[${definition};module;0]`);
  const pending = [value.tree];
  const seen = new Set();
  for (const node of pending) {
    if (seen.has(node)) continue;
    seen.add(node);
    node.origin.module = value.module;
    pending.push(...fixtureChildren(node));
  }
  return value;
}

function referenceIn(value, node, kind = "body") {
  return kind === "body" ? bodySource(node.id, value.bodies[0].body) :
    { kind: "item", value: { owner: value.tree.tsonic.definition, node: node.id } };
}

for (const family of ["definition", "body"]) {
  for (const ordinal of [0, 1, Number.MAX_SAFE_INTEGER, -1, -0, 0.5, NaN, Infinity, -Infinity]) {
    test(`HIR ordinal-domain ${family} preserves and checks exact ${Object.is(ordinal, -0) ? "-0" : String(ordinal)}`, () => {
      const value = moduleWith();
      const definition = family === "definition" ? ids.encodeDefId({ module: moduleIdentity, segments: [{ name: "owner", ordinal }] }) : definitionIdentity;
      const body = ids.encodeBodyId({ owner: definition, role: "module", ordinal: family === "body" ? ordinal : 0 });
      replaceModuleOwner(value, definition, body);
      const accepted = Number.isSafeInteger(ordinal) && ordinal >= 0 && !Object.is(ordinal, -0);
      const expected = accepted ? [] : [violation("ordinal-domain", nodeSite(0, body), family === "definition"
        ? "definition segment ordinal must be a nonnegative safe integer other than negative zero"
        : "body ordinal must be a nonnegative safe integer other than negative zero")];
      const decoded = roundtrip((value), `${family}/${String(ordinal)}`);
      assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), expected);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), expected);
    });
  }
}

function candidate(ordinal = 0, properties = {}) {
  return { ordinal, declaration: definitionIdentity, appliedSignature: unavailable(), bindings: unavailable(),
    conditionalFailure: available(null), contributions: [], ...properties };
}

test("HIR original candidate ordinals are retained rather than renumbered to a manufactured dense vector", () => {
  const valid = moduleWith();
  valid.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(2), candidate(8), candidate(11)] }];
  const decoded = roundtrip((valid), "gapped original candidate order");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  const invalid = moduleWith();
  invalid.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(8), candidate(2)] }];
  assert.deepStrictEqual(product.verifyHir((invalid), contextFor(invalid)), [
    violation("candidate-original-order", { kind: "body", body: bodyIdentity }, "candidate ordinals must retain distinct original order"),
  ]);
});

test("HIR candidate arena ids, applied signatures and independent scope contributions have exact opposites", () => {
  const dense = moduleWith();
  dense.bodies[0].candidateLists = [{ id: 1, candidates: [] }];
  assert.deepStrictEqual(product.verifyHir((dense), contextFor(dense)), [
    violation("candidate-list-dense", { kind: "body", body: bodyIdentity }, "candidate list id must equal its arena position"),
  ]);
  const signature = moduleWith();
  signature.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { appliedSignature: available(4) })] }];
  assert.deepStrictEqual(product.verifyHir((signature), contextFor(signature)), [
    violation("signature-reference", { kind: "body", body: bodyIdentity }, "signature must exist in the supplied table"),
  ]);
  const contribution = moduleWith();
  contribution.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { contributions: [
    { parameter: { owner: definitionIdentity, index: 1 }, role: "result", source: bodySource(0),
      component: { root: bodySource(0), path: [] }, type: available(0) },
  ] })] }];
  assert.deepStrictEqual(product.verifyHir((contribution), contextFor(contribution)), [
    violation("contribution-parameter", { kind: "body", body: bodyIdentity }, "contribution must name an actual candidate type parameter"),
  ]);
});

function genericCandidateFixture(parameterCount, declarationCount = 1) {
  const foreign = foreignModuleWith([]);
  const scopes = new Map([[foreign.tree.tsonic.definition, emptyScope()]]);
  const definitions = [];
  const declared = [];
  for (let ordinal = 0; ordinal < declarationCount; ordinal += 1) {
    const segments = [{ name: `Generic${ordinal}`, ordinal: 0 }];
    const definition = ids.encodeDefId({ module: foreign.module, segments });
    definitions.push(definition);
    const parameters = Array.from({ length: parameterCount }, (_, index) => {
      const text = `T${String(index).padStart(4, "0")}`;
      const declaration = ids.encodeDefId({ module: foreign.module, segments: [...segments, { name: text, ordinal: 0 }] });
      const name = syntax("Identifier", 0, { text, tsonic: { core: absentCore(), role: "declaration-name",
        declaration: { kind: "definition", definition: declaration } } });
      return syntax("TypeParameter", 0, { modifiers: null, name, constraint: null, expression: null, defaultType: null,
        tsonic: { ...declarationFacts(definition), definition: declaration,
          parameter: { identity: { owner: definition, index }, declaration, constraint: null, default: null } } });
    });
    const name = syntax("Identifier", 0, { text: `Generic${ordinal}`, tsonic: { core: absentCore(), role: "declaration-name",
      declaration: { kind: "definition", definition } } });
    const node = syntax("ClassDeclaration", 0, { modifiers: null, name, typeParameters: nodeList(parameters), heritageClauses: null,
      members: nodeList([]), tsonic: { ...declarationFacts(foreign.tree.tsonic.definition), definition,
        parameters: parameters.map(parameter => parameter.tsonic.parameter), heritage: [], members: [] } });
    for (const source of [node, name, ...parameters.flatMap(parameter => [parameter, parameter.name])]) source.origin.module = foreign.module;
    foreign.tree.statements.nodes.push(node);
    declared.push({ definition, node }, ...parameters.map(parameter => ({ definition: parameter.tsonic.definition, node: parameter })));
    scopes.set(definition, { classParameters: parameters.map(parameter => parameter.tsonic.parameter.identity),
      methodParameters: [], capturedParameters: [], selfOwners: [definition] });
    for (const parameter of parameters) scopes.set(parameter.tsonic.definition, emptyScope());
  }
  numberSyntaxFixture(foreign.tree);
  foreign.items = declared.map(({ definition, node }) => ({ definition, node: node.id }))
    .sort((left, right) => Number(left.definition > right.definition) - Number(left.definition < right.definition));


  return { foreign, definitions, scopes };
}

for (const count of [0, 1, 128]) for (const contributions of [false, true])
  test(`HIR repeated genuine foreign generic candidates do ${contributions ? "one" : "no"} membership inventory for ${count} ordered candidates`, () => {
    const { foreign, definitions, scopes } = genericCandidateFixture(128);
    const definition = definitions[0];
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: 0, candidates: Array.from({ length: count }, (_, ordinal) => candidate(ordinal * 2 + 2, {
      declaration: definition, contributions: contributions ? [{ parameter: { owner: definition, index: ordinal % 128 }, role: "argument",
        source: bodySource(0), component: { root: bodySource(0), path: [] }, type: available(0) }] : [],
    })) }];

    const reads = [];
    const context = contextFor(value, { bindingScopeOf: owner => { reads.push(owner); return scopes.get(owner) ?? null; } }, [foreign]);
    assert.deepStrictEqual(product.verifyHir(foreign, contextFor(foreign, { bindingScopeOf: owner => scopes.get(owner) ?? null })), [],
      "the declaration and all 128 real type parameters themselves have a complete valid HIR model");
    const expectedReads = count === 0 ? [] : contributions ? [definition, definition] : [definition];
    assert.deepStrictEqual(product.verifyHir(value, context), []);
    assert.deepStrictEqual(reads, expectedReads, "one foreign existence read, then membership only once when contributions exist");
    reads.length = 0;
    assert.deepStrictEqual(product.verifyHir(value, context), []);
    assert.deepStrictEqual(reads, expectedReads, "a second public invocation does not share a hidden membership cache");
  });

for (const invalid of [false, true])
  test(`HIR membership is kept per distinct genuine declaration with ${invalid ? "one complete foreign-owner opposite" : "complete interleaved candidates"}`, () => {
    const { foreign, definitions, scopes } = genericCandidateFixture(4, 2);
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: 0, candidates: Array.from({ length: 4 }, (_, ordinal) => {
      const declaration = definitions[ordinal % 2];
      const owner = invalid && ordinal === 3 ? definitions[0] : declaration;
      return candidate(ordinal * 3, { declaration, contributions: [{ parameter: { owner, index: ordinal }, role: "result",
        source: bodySource(0), component: { root: bodySource(0), path: [] }, type: unavailable() }] });
    }) }];
    const reads = [];
    const context = contextFor(value, { bindingScopeOf: owner => { reads.push(owner); return scopes.get(owner) ?? null; } }, [foreign]);
    assert.deepStrictEqual(product.verifyHir((value), context), invalid ? [
      violation("contribution-parameter", { kind: "body", body: bodyIdentity }, "contribution must name an actual candidate type parameter"),
    ] : []);
    assert.deepStrictEqual(reads, [definitions[0], definitions[1], definitions[0], definitions[1]],
      "canonical existence and the two independent declaration memberships retain first-use order");
  });

test("HIR a repeated null declaration scope is not manufactured empty or silently admitted for contributions", () => {
  const { definitions } = genericCandidateFixture(4);
  const definition = definitions[0];
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [2, 8, 11].map(ordinal => candidate(ordinal, { declaration: definition,
    contributions: [{ parameter: { owner: definition, index: 0 }, role: "receiver", source: bodySource(0),
      component: { root: bodySource(0), path: [] }, type: available(0) }] })) }];
  const reads = [];
  const context = contextFor(value, { bindingScopeOf: owner => { reads.push(owner); return null; } });
  assert.deepStrictEqual(product.verifyHir((value), context), [
    ...Array.from({ length: 6 }, () => violation("definition-reference", { kind: "body", body: bodyIdentity },
      "definition must exist in the canonical declaration inventory")),
    ...Array.from({ length: 3 }, () => violation("contribution-parameter", { kind: "body", body: bodyIdentity },
      "contribution must name an actual candidate type parameter")),
  ]);
  assert.deepStrictEqual(reads, [definition, definition], "the null result is retained once in each distinct owning relation, not re-invented per candidate");
});

for (const arena of ["locals", "candidateLists"]) for (const later of ["absent", "valid", "wrong-index", "invalid-row"])
  test(`HIR own ${arena} sparse slots retain the original numeric index and later present ${later} row`, () => {
    const value = moduleWith();
    const context = contextFor(value);
    const site = { kind: "body", body: bodyIdentity };
    const rule = arena === "locals" ? "local-dense" : "candidate-list-dense";
    const detail = arena === "locals" ? "local id must equal its declaration position" : "candidate list id must equal its arena position";
    const expected = [violation(rule, site, detail)];
    const rows = new Array(later === "absent" ? 1 : 2);
    if (later !== "absent") {
      const id = later === "wrong-index" ? 0 : 1;
      rows[1] = arena === "locals" ? { id, declaration: bodySource(0), name: "later", role: later === "invalid-row" ? "capture" : "binding",
        checkerSlot: available(0), capturedFrom: null, mutable: false } :
        { id, candidates: later === "invalid-row" ? [candidate(8), candidate(2)] : [] };
      if (later === "wrong-index") expected.push(violation(rule, site, detail));
      if (later === "invalid-row") expected.push(violation(arena === "locals" ? "capture-owner" : "candidate-original-order", site,
        arena === "locals" ? "capture local must name a declared outer capture" : "candidate ordinals must retain distinct original order"));
    }
    value.bodies[0][arena] = rows;
    assert.deepStrictEqual(product.verifyHir((value), context), expected);
  });

function expressionModule(expression) {
  return moduleWith([syntax("ExpressionStatement", 0, { expression })]);
}

function nameExpression(text = "value") {
  return syntax("Identifier", 0, { text, tsonic: nameMetadata() });
}

function callExpression(application = unavailable()) {
  return syntax("CallExpression", 0, { expression: nameExpression("callee"), questionDotToken: null, typeArguments: null,
    arguments: nodeList([]), tsonic: { ...expressionMetadata(), application } });
}

for (const kind of ["call", "construct", "accessor-get", "accessor-set"])
  test(`HIR complete ${kind} application retains authored value/spread arguments and availability rather than expanding formals`, () => {
    const tupleInputs = [available(null), available([]), available([0]), available([0, 0, 0]),
      unavailable(), unavailable("checker-error"), unavailable("parameter-dependent")];
    for (const tuple of tupleInputs) for (const resolved of [available(null), available(0), unavailable()]) {
      let holder;
      let expression;
      if (kind === "call" || kind === "construct") {
        const plain = nameExpression("plain");
        const spread = syntax("SpreadElement", 0, { expression: nameExpression("spread"), tsonic: { ...expressionMetadata(), protocol: unavailable() } });
        holder = kind === "call" ? callExpression() : syntax("NewExpression", 0, { expression: nameExpression("Factory"), typeArguments: null,
          arguments: nodeList([]), tsonic: { ...expressionMetadata(), application: unavailable() } });
        holder.arguments = nodeList([plain, spread]);
        expression = holder;
      } else {
        holder = syntax("PropertyAccessExpression", 0, { expression: nameExpression("receiver"), questionDotToken: null,
          name: syntax("Identifier", 0, { text: "property", tsonic: { core: absentCore(), role: "property-name",
            key: available({ kind: "text", value: "property" }), origins: available([]) } }),
          tsonic: kind === "accessor-get" ? { core: absentCore(), role: "value", value: emptyValue(), origins: available([]), accessor: available(null) } :
            { core: absentCore(), role: "assignment-target", views: emptyViews(), place: unavailable(), access: "write", origins: available([]), accessor: available(null) } });
        expression = kind === "accessor-get" ? holder : syntax("BinaryExpression", 0, { modifiers: null, left: holder, type: null, operatorToken: syntax("EqualsToken", 0),
          right: nameExpression("assigned"), tsonic: { core: absentCore(), role: "assignment", value: emptyValue(), target: unavailable() } });
      }
      const value = expressionModule(expression);
      const args = kind === "call" || kind === "construct" ? [
        { kind: "value", expression: holder.arguments.nodes[0].id },
        { kind: "spread", expression: holder.arguments.nodes[1].expression.id, tuple },
      ] : kind === "accessor-get" ? [] : [{ kind: "value", expression: expression.right.id }];
      const application = { kind, receiver: kind === "call" || kind === "construct" ? null : holder.expression.id,
        arguments: args, typeArguments: [], candidates: available(0), resolvedSignature: resolved };
      if (kind === "call" || kind === "construct") holder.tsonic.application = available(application);
      else holder.tsonic.accessor = available(application);
      value.bodies[0].candidateLists = [{ id: 0, candidates: [] }];
      const decoded = roundtrip((value), `application/${kind}/${tuple.kind}/${resolved.kind}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { types: {
        terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null, kind: kind === "construct" ? "construct" : "call" })],
      } })), []);
      if (kind === "accessor-get") {
        application.arguments = [{ kind: "value", expression: holder.expression.id }];
        roundtrip(value, "getter format retains supplied argument data without validating application semantics");
      }
    }
  });

test("HIR candidate-list reference uses the containing body arena, not another scope or a bare global index", () => {
  const expression = callExpression(available({ kind: "call", receiver: null, arguments: [], typeArguments: [],
    candidates: available(7), resolvedSignature: available(null) }));
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("candidate-list-reference", nodeSite(2), "candidate list must exist in the containing body"),
  ]);
});

test("HIR type references preserve all captured availability arms and refuse only actual missing table ids", () => {
  for (const captured of [unavailable("checker-error"), unavailable("parameter-dependent"), unavailable(), available(0)]) {
    const value = expressionModule(nameExpression());
    value.tree.statements.nodes[0].expression.tsonic.value.views.read = captured;
    const decoded = roundtrip((value), `captured read ${captured.kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
  const value = expressionModule(nameExpression());
  value.tree.statements.nodes[0].expression.tsonic.value.views.read = available(-1);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("type-reference", nodeSite(2), "type must exist in the supplied table"),
  ]);
});

test("HIR actual local resolution keeps its body qualifier and rejects a missing local with the complete vector", () => {
  const expression = nameExpression();
  const value = expressionModule(expression);
  expression.tsonic.resolution = { kind: "local", local: { body: bodyIdentity, local: 0 } };
  value.bodies[0].locals = [{ id: 0, declaration: bodySource(2), name: "value", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: true }];
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), []);
  const wrong = expressionModule(nameExpression());
  wrong.tree.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local: { body: bodyIdentity, local: 3 } };
  assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
    violation("local-reference", nodeSite(2), "qualified local must exist in its named body"),
  ]);
});

test("HIR unknown canonical definition and body identities never invent a fallback reader", () => {
  const unknown = ids.encodeDefId({ module: ids.encodeModuleId({ package: ids.encodePackageId("/missing"), path: "unknown.ts" }),
    segments: [{ name: "unknown", ordinal: 0 }] });
  const unknownBody = ids.encodeBodyId({ owner: unknown, role: "function", ordinal: 0 });
  const cases = [
    [{ core: absentCore(), role: "value", value: emptyValue(), resolution: { kind: "definition", definition: unknown, aliases: [] } }, [
      violation("definition-reference", nodeSite(2), "definition must exist in the canonical declaration inventory"),
    ]],
    [{ core: absentCore(), role: "value", value: emptyValue(), resolution: { kind: "local", local: { body: unknownBody, local: 0 } } }, [
      violation("local-reference", nodeSite(2), "qualified local must exist in its named body"),
      violation("body-owner", nodeSite(2), "body must exist in the canonical identity inventory"),
    ]],
    [{ core: absentCore(), role: "label", target: { body: unknownBody, node: 0 } }, [
      violation("cross-owner-qualified", nodeSite(2), "qualified body node must exist in its named owner"),
      violation("body-owner", nodeSite(2), "body must exist in the canonical identity inventory"),
    ]],
  ];
  for (const [metadata, expected] of cases) {
    const node = nameExpression("qualified");
    node.tsonic = metadata;
    const value = expressionModule(node);
    const decoded = roundtrip((value), `unknown identity/${metadata.role}/${metadata.resolution?.kind ?? "label"}`);
    const base = contextFor(decoded.value);
    assert.deepStrictEqual(product.verifyHir(decoded.value, { ...base,
      definitionPathOf: identity => identity === unknown ? null : base.definitionPathOf(identity),
      bodyPathOf: identity => identity === unknownBody ? null : base.bodyPathOf(identity),
      nodeOf: () => assert.fail("unknown canonical paths never enter the foreign-node reader"),
      localExists: () => assert.fail("unknown canonical paths never enter the foreign-local reader"),
    }), expected);
  }
  const { module: value, call } = coreCarrier();
  call.tsonic.core.markers = available({ struct: null, field: { name: "field",
    typeNode: { kind: "item", value: { owner: unknown, node: 0 } }, type: unavailable(), readonly: true },
  defaultValue: null, jsString: false });
  const decoded = roundtrip((value), "unknown qualified item owner");
  const base = contextFor(decoded.value);
  assert.deepStrictEqual(product.verifyHir(decoded.value, { ...base,
    definitionPathOf: identity => identity === unknown ? null : base.definitionPathOf(identity),
    nodeOf: () => assert.fail("invalid item ownership has no foreign-node fallback"),
  }), [
    violation("cross-owner-qualified", nodeSite(2), "qualified item node must exist in its named owner"),
    violation("definition-reference", nodeSite(2), "definition must exist in the canonical declaration inventory"),
    violation("core-capture-reference", nodeSite(2), "Core capture reference must retain an existing qualified source node"),
  ]);
});

test("HIR text decoding rejects malformed durable IDs at the actual owning boundary, not in a typed verifier", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  for (const [prefix, value, malformed, expected] of [
    ["mod", moduleIdentity, "not-a-module", "ModuleId"],
    ["def", definitionIdentity, "not-a-definition", "DefId"],
    ["body", bodyIdentity, "not-a-body", "BodyId"],
  ]) {
    const marker = `${prefix}:"${malformed}"`;
    const text = original.replace(`${prefix}:"${value}"`, marker);
    assertInvalidText(text, text.indexOf(marker), [expected]);
  }
});

test("HIR place-base-acyclic rejects an actual place-reference cycle without using numeric node order", () => {
  const expression = nameExpression();
  expression.tsonic.value.place = available({ base: { kind: "place", node: 2 }, step: null, read: available(0), write: available(null) });
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("place-base-acyclic", nodeSite(2), "place base chain must not revisit a place"),
  ]);
});

function indexPlaceModule(base = "receiver", capturedReceiver = true) {
  const receiver = nameExpression("receiver");
  const key = nameExpression("key");
  if (capturedReceiver) receiver.tsonic.value.place = available(rootPlace());
  key.tsonic.value.place = available(rootPlace());
  const expression = syntax("ElementAccessExpression", 0, { expression: receiver, questionDotToken: null, argumentExpression: key,
    tsonic: { core: absentCore(), role: "value", value: emptyValue(), origins: available([]), accessor: available(null) } });
  const value = expressionModule(expression);
  expression.tsonic.value.place = available({ base: { kind: "place", node: base === "receiver" ? receiver.id : key.id },
    step: { kind: "index", expression: key.id }, read: available(0), write: available(0) });
  return value;
}

test("HIR element base place is its later-preorder receiver, not an invented earlier node", () => {
  const value = (indexPlaceModule());
  const decoded = roundtrip(value, "genuine indexed place");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const outside = (indexPlaceModule("key"));
  assert.deepStrictEqual(product.verifyHir(outside, contextFor(outside)), [
    violation("place-access-base-in-receiver", nodeSite(2), "access base place must lie inside its actual receiver subtree"),
  ]);
  const missing = (indexPlaceModule("receiver", false));
  assert.deepStrictEqual(product.verifyHir(missing, contextFor(missing)), [
    violation("place-base-acyclic", nodeSite(2), "place base must name an actual place in the same body and end at a root"),
  ]);
  const rooted = indexPlaceModule();
  rooted.tree.statements.nodes[0].expression.tsonic.value.place = available(rootPlace());
  assert.deepStrictEqual(product.verifyHir((rooted), contextFor(rooted)), [
    violation("place-access-base-in-receiver", nodeSite(2), "access base place must lie inside its actual receiver subtree"),
  ]);
});

test("HIR member-place receiver ancestry includes transparent syntax and preserves the real base reference", () => {
  const receiver = nameExpression("receiver");
  receiver.tsonic.value.place = available(rootPlace());
  const parenthesized = syntax("ParenthesizedExpression", 0, { expression: receiver, tsonic: expressionMetadata() });
  const name = syntax("Identifier", 0, { text: "field", tsonic: { core: absentCore(), role: "property-name", key: available({ kind: "text", value: "field" }), origins: available([]) } });
  const expression = syntax("PropertyAccessExpression", 0, { expression: parenthesized, questionDotToken: null, name,
    tsonic: { core: absentCore(), role: "value", value: emptyValue(), origins: available([]), accessor: available(null) } });
  const value = expressionModule(expression);
  expression.tsonic.value.place = available({ base: { kind: "place", node: receiver.id },
    step: { kind: "member", key: { kind: "text", value: "field" }, origins: memberOrigins() }, read: available(0), write: available(0) });
  const decoded = roundtrip((value), "parenthesized member receiver");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
});

test("HIR place reference refuses missing nodes and retains the whole coupled reference vector", () => {
  const expression = nameExpression();
  expression.tsonic.value.place = available({ base: { kind: "place", node: 99 }, step: { kind: "deref" }, read: available(0), write: unavailable() });
  const value = (expressionModule(expression));
  roundtrip(value, "deref format retains the complete missing-reference data");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [
    violation("node-reference", nodeSite(2), "node must exist in the module arena"),
    violation("place-base-acyclic", nodeSite(2), "place base must name an actual place in the same body and end at a root"),
  ]);
});

test("HIR exact literal metadata keeps authored radix, separators, exponents, signs and arbitrary integer precision", () => {
  const numeric = [
    ["1", 1n, 1n, false], ["1.", 1n, 1n, false], ["1.0", 1n, 1n, false], ["1.e0", 1n, 1n, false],
    [".5", 1n, 2n, false], ["+.5", 1n, 2n, false], ["-1.25e-1", -1n, 8n, false],
    ["1_2.3_4E+0_2", 1234n, 1n, false], ["0xF_F", 255n, 1n, false], ["-0xF", -15n, 1n, false],
    ["0b10_01", 9n, 1n, false], ["0o7_1", 57n, 1n, false], ["9007199254740993", 9007199254740993n, 1n, false],
    ["1.0000000000000000000000000000000000000001", 10000000000000000000000000000000000000001n, 10000000000000000000000000000000000000000n, false],
    ["0e9999999999999999999999999", 0n, 1n, false], ["-0.0e-999999999999999999999999", 0n, 1n, true],
  ];
  for (const [token, numerator, denominator, negativeZero] of numeric) {
    const expression = syntax("NumericLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "value",
      value: emptyValue(), literal: { kind: "number", token, value: { numerator, denominator, negativeZero } } } });
    const value = (expressionModule(expression));
    const decoded = roundtrip(value, `exact number ${token}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
  for (const [token, integer] of [["9007199254740993n", 9007199254740993n], ["0x1_0000_0000_0000_0001n", 18446744073709551617n],
    ["-0b1_01n", -5n], ["0o7_1n", 57n], ["+0n", 0n]]) {
    const expression = syntax("BigIntLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "attribute-value",
      literal: { kind: "bigint", token, value: integer } } });
    const value = (expressionModule(expression));
    assert.deepStrictEqual(product.verifyHir(roundtrip(value, token).value, contextFor(value)), []);
  }
});

for (const [token, rational] of [
  ["0.1", { numerator: 1n, denominator: 2n, negativeZero: false }],
  ["1e99999999999999999999999999", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1e-99999999999999999999999999", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1__0", { numerator: 10n, denominator: 1n, negativeZero: false }],
  ["0x_1", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1e_1", { numerator: 10n, denominator: 1n, negativeZero: false }],
  [".", { numerator: 0n, denominator: 1n, negativeZero: false }],
  ["1e", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1", { numerator: 2n, denominator: 2n, negativeZero: false }],
  ["1", { numerator: 1n, denominator: -1n, negativeZero: false }],
  ["1", { numerator: 1n, denominator: 1n, negativeZero: true }],
  ["-0", { numerator: 0n, denominator: 1n, negativeZero: false }],
]) test(`HIR literal-exact minimal complete opposite: ${token}/${rational.denominator}/${rational.negativeZero}`, () => {
  const expression = syntax("NumericLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "value", value: emptyValue(),
    literal: { kind: "number", token, value: rational } } });
  const value = (expressionModule(expression));
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [
    violation("literal-exact", nodeSite(2), "literal must preserve its normalized exact authored value"),
  ]);
});

test("HIR typed phase syntax and factual literal-type prefix children retain their correlation rule", () => {
  const literal = syntax("NumericLiteral", 0, { text: "1", tokenFlags: [], tsonic: { core: absentCore(), role: "type-literal", type: unavailable(),
    literal: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } });
  const unary = syntax("PrefixUnaryExpression", 0, { operator: "MinusToken", operand: literal,
    tsonic: { core: absentCore(), role: "type-literal", type: unavailable(), literal: { kind: "number", value: { numerator: -1n, denominator: 1n, negativeZero: false } } } });
  const type = syntax("LiteralType", 0, { literal: unary, tsonic: typeMetadata() });
  const identifier = nameExpression();
  const assertion = syntax("TypeAssertionExpression", 0, { type, expression: identifier, tsonic: expressionMetadata() });
  const value = expressionModule(assertion);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), []);
  const invalidLiteral = syntax("StringLiteral", 0, { text: "x", tokenFlags: [], tsonic: { core: absentCore(), role: "type-literal", type: unavailable(),
    literal: { kind: "string", value: "x" } } });
  const invalidUnary = syntax("PrefixUnaryExpression", 0, { operator: "MinusToken", operand: invalidLiteral,
    tsonic: { core: absentCore(), role: "value", value: emptyValue() } });
  const invalidType = syntax("LiteralType", 0, { literal: invalidUnary, tsonic: typeMetadata() });
  const invalid = expressionModule(syntax("TypeAssertionExpression", 0, { type: invalidType, expression: nameExpression(), tsonic: expressionMetadata() }));
  assert.deepStrictEqual(product.verifyHir((invalid), contextFor(invalid)), [
    violation("literal-type-child", nodeSite(3), "literal unary child requires a numeric literal and unary plus or minus"),
  ]);
});

test("HIR complete source ownership compiles in fresh strict whole-module isolation against real dependency values", async () => {
  const roots = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8")).areas.map(area => area.directory);
  const deps = isolationDeps(tooling, roots);
  const interfaceSources = ["packages/host/src/ids/contract.ts", "packages/host/src/ids/index.ts", "packages/host/src/diag/contract.ts",
    "packages/host/src/diag/index.ts", "packages/host/src/ir-types/contract.ts", "packages/host/src/ir-types/index.ts"];
  const candidates = ["ids", "diag", "ir-types"].flatMap(owner => readdirSync(resolve(repository, `packages/host/src/${owner}`))
    .filter(name => name.endsWith(".ts")).map(name => `packages/host/src/${owner}/${name}`));
  const graph = deps.graph(new Map(candidates.map(path => [path, readFileSync(resolve(repository, path), "utf8")])));
  const closure = new Set(interfaceSources);
  for (const path of closure) for (const edge of graph) if (edge.source === path && edge.target !== null) {
    assert.equal(candidates.includes(edge.target), true, "declaration production cannot discover an unadmitted owner");
    closure.add(edge.target);
  }
  const report = await compileIsolated(deps, hostCatalogue.find(module => module.name === "ir-hir"), {
    root: repository, sourceFiles: ownedSources, interfaceSources, declarationSources: [...closure], outputDirectory: ".temp/host-f-ir-hir/isolation",
  });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", `${JSON.stringify(report.findings)}\n${report.diagnostics.join("\n")}`);
  assert.deepStrictEqual(report.findings, []);
  assert.equal(report.sourceInventory.length, ownedSources.length + closure.size);
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ir-types/index.d.ts")), true);
  assert.equal(report.loadedInventory.some(path => path.endsWith("/isolated/packages/host/src/ir-types/index.ts")), false);
});

test("HIR fresh actual declarations retain generic phases, all seven ports and exact readonly/shape refusals", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  for (const owner of ["ids", "diag", "ir-types", "ir-hir"]) {
    const source = resolve(repository, `packages/host/dist/${owner}`);
    mkdirSync(resolve(stage, owner));
    for (const name of readdirSync(source).filter(name => name.endsWith(".d.ts")))
      writeFileSync(resolve(stage, owner, name), readFileSync(resolve(source, name)));
  }
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const positive = `import { childrenOfSyntax, indexSyntaxTree, orderPragmaArguments, parseHir, printHir, verifyHir, walkSyntaxTree } from "./ir-hir/index.js";
import type { HirModule, HirLocal, HirCandidateList, HirVerificationContext, Phase, SyntaxPhase, CheckedPhase, Block, Statement, SourceFile, SyntaxNode, ChildrenOfSyntax, IndexSyntaxTree, OrderPragmaArguments, ParseHir, PrintHir, VerifyHir, WalkSyntaxTree } from "./ir-hir/contract.js";
import type { BodyId, DefId, ModuleId, NodeId } from "./ids/contract.js";
import type { SourceNodeRef } from "./ids/contract.js";
import { nodeId as issueNode, localId as issueLocal, tyId as issueType, sigId as issueSignature, candidateListId as issueCandidates, expansionId as issueExpansion } from "./ids/index.js";
import { hostDiagnosticCode } from "./diag/index.js";
import type { HostDiagnosticCode } from "./diag/contract.js";
import type { ComponentSelector, TypeComponent } from "./ir-types/contract.js";
export function generic<P extends Phase>(root: SourceFile<P>, node: SyntaxNode<P>, stop: readonly NodeId[]) {
const children: ChildrenOfSyntax = childrenOfSyntax; const index: IndexSyntaxTree = indexSyntaxTree; const walk: WalkSyntaxTree = walkSyntaxTree;
const childResult: readonly SyntaxNode<P>[] = children(node); const indexResult: readonly SyntaxNode<P>[] = index(root); const walkResult: readonly SyntaxNode<P>[] = walk(node, stop);
return { childResult, indexResult, walkResult }; }
export function checked(module: HirModule, context: HirVerificationContext) {
const parse: ParseHir = parseHir; const print: PrintHir = printHir; const verify: VerifyHir = verifyHir;
const order: OrderPragmaArguments = orderPragmaArguments;
return { text: print(module), decoded: parse(print(module)), violations: verify(module, context), pragmas: order([]) }; }
export function ownedOutput(text:string) {
const decoded=parseHir(text);
if(decoded.kind==="invalid-text")return decoded;
const module:HirModule=decoded.value; const identity:NodeId=module.tree.id;
const diagnostic:HostDiagnosticCode=hostDiagnosticCode("HIR_CONSUMER");
return {module,identity,diagnostic,node:issueNode(NaN),local:issueLocal(-0),type:issueType(Infinity),
signature:issueSignature(-1),candidates:issueCandidates(0.5),expansion:issueExpansion("authored")}; }
export function sparseArenas(module:HirModule,context:HirVerificationContext) {
return verifyHir({...module,bodies:module.bodies.map(body=>({...body,
locals:new Array<HirLocal>(1),candidateLists:new Array<HirCandidateList>(1)}))},context); }
export function cyclicComponent(root:SourceNodeRef):TypeComponent {
const path:ComponentSelector[]=[]; const component:TypeComponent={root,path};
path.push({kind:"sum-arm",index:0,family:{origin:"authored",component,parameters:[],roles:[]}});
return component; }
export function finiteComponent(root:SourceNodeRef,depth:number):TypeComponent {
let component:TypeComponent={root,path:[]};
for(let ordinal=0;ordinal<depth;ordinal+=1)component={root,path:[{kind:"sum-arm",index:0,family:{origin:"authored",component,parameters:[],roles:[]}}]};
return component; }
export function cyclicSyntax(module:ModuleId,node:NodeId):Block<CheckedPhase> {
const nodes:Statement<CheckedPhase>[]=[]; const block:Block<CheckedPhase>={kind:"Block",id:node,parent:null,
origin:{module,start:0,length:0,derived:[]},flags:[],loc:{pos:0,end:0},statements:{loc:{pos:0,end:0},nodes},multiLine:false,tsonic:null};
nodes.push(block); return block; }
`;
  const constructors = constructorInputs(1, false, false).map(row => JSON.stringify(row.node)
    .replace(/"id":\d+/gu, '"id":nodeId').replaceAll(JSON.stringify(moduleIdentity), "moduleId")).join(",\n");
  const checkedConstructors = checkedConstructorInputs(1, false, false).map(node => typedFixtureText(node)
    .replace(/"id":\d+/gu, '"id":nodeId').replaceAll(JSON.stringify(bodyIdentity), "bodyId")
    .replaceAll(JSON.stringify(definitionIdentity), "definitionId").replaceAll(JSON.stringify(moduleIdentity), "moduleId")).join(",\n");
  writeFileSync(resolve(stage, "positive.ts"), `${positive}\nexport function allConstructors(moduleId:ModuleId,nodeId:NodeId):readonly SyntaxNode<SyntaxPhase>[]{return [${constructors}];}\nexport function allCheckedConstructors(moduleId:ModuleId,nodeId:NodeId,definitionId:DefId,bodyId:BodyId):readonly SyntaxNode<CheckedPhase>[]{return [${checkedConstructors}];}\n`);
  const compiler = resolve(tooling, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const run = (name, files) => {
    writeFileSync(resolve(stage, name), JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true,
      noImplicitReturns: true, noFallthroughCasesInSwitch: true, forceConsistentCasingInFileNames: true, skipLibCheck: false,
      noEmit: true, target: "ES2022", lib: ["ES2022"], types: [], module: "NodeNext", moduleResolution: "NodeNext", verbatimModuleSyntax: true,
    }, files }));
    const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false", "--listFiles"],
      { cwd: stage, encoding: "utf8", maxBuffer: 2_097_152, timeout: 90_000 });
    assert.equal(result.error === undefined, true, "the actual consumer compiler completes under the aggregate guard");
    assert.equal(result.signal, null);
    const text = `${result.stdout}${result.stderr}`;
    writeFileSync(resolve(stage, `${name}.log`), text);
    return { status: result.status, text };
  };
  const accepted = run("positive.json", ["positive.ts"]);
  assert.equal(accepted.status, 0, accepted.text);
  const loaded = accepted.text.split(/\r?\n/u).filter(path => path.startsWith(stage));
  assert.equal(loaded.every(path => path.endsWith(".d.ts") || path === resolve(stage, "positive.ts")), true, "no dependency implementation source reaches the consumer");
  const negatives = [
    ["mutable-children.ts", 'import { childrenOfSyntax } from "./ir-hir/index.js"; import type { HirNode } from "./ir-hir/contract.js"; export function bad(node:HirNode){ childrenOfSyntax(node).push(node); }', 2339],
    ["mutable-walk.ts", 'import { walkSyntaxTree } from "./ir-hir/index.js"; import type { HirNode } from "./ir-hir/contract.js"; export function bad(node:HirNode){ walkSyntaxTree(node,[]).push(node); }', 2339],
    ["mutable-module.ts", 'import type { HirModule } from "./ir-hir/contract.js"; export function bad(value:HirModule){ value.bodies.push(); }', 2339],
    ["mutable-id.ts", 'import type { HirNode } from "./ir-hir/contract.js"; export function bad(value:HirNode){ value.parent=null; }', 2540],
    ["mutable-body.ts", 'import type { HirBody } from "./ir-hir/contract.js"; export function bad(value:HirBody){ value.generator=true; }', 2540],
    ["mutable-capture.ts", 'import type { HirCoreCapture } from "./ir-hir/contract.js"; export function bad(value:HirCoreCapture){ value.flowState={kind:"available",value:null}; }', 2540],
    ["mutable-range.ts", 'import type { TextRange } from "./ir-hir/contract.js"; export function bad(value:TextRange){ value.pos=0; }', 2540],
    ["missing-context.ts", 'import { verifyHir } from "./ir-hir/index.js"; import type { HirModule } from "./ir-hir/contract.js"; export function bad(value:HirModule){ return verifyHir(value); }', 2554],
    ["missing-occurrence-scope.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bodyPathOf:()=>null,definitionPathOf:()=>null,bindingScopeOf:()=>null,nominalOf:()=>null,nodeOf:()=>null,localExists:()=>false};', 2741],
    ["missing-node-data.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bodyPathOf:()=>null,definitionPathOf:()=>null,bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,localExists:()=>false};', 2741],
    ["retired-node-exists.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bodyPathOf:()=>null,definitionPathOf:()=>null,bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,nodeExists:()=>false,localExists:()=>false};', 2353],
    ["missing-body-path.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},definitionPathOf:()=>null,bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,nodeOf:()=>null,localExists:()=>false};', 2741],
    ["missing-definition-path.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bodyPathOf:()=>null,bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,nodeOf:()=>null,localExists:()=>false};', 2741],
    ["foreign-node-brand.ts", 'import type { NodeId } from "./ids/contract.js"; export const forged:NodeId=0;', 2322],
    ["foreign-host-code-brand.ts", 'import type { HostDiagnosticCode } from "./diag/contract.js"; export const forged:HostDiagnosticCode="HOST_CODE";', 2322],
    ["retired-for-kind-parameter.ts", 'import type { ForInOrOfStatement, SyntaxPhase } from "./ir-hir/contract.js"; export type Bad=ForInOrOfStatement<SyntaxPhase,"ForInStatement">;', 2314],
    ["retired-clause-kind-parameter.ts", 'import type { CaseOrDefaultClause, SyntaxPhase } from "./ir-hir/contract.js"; export type Bad=CaseOrDefaultClause<SyntaxPhase,"CaseClause">;', 2314],
    ["missing-child.ts", 'import type { SyntaxList, SyntaxPhase } from "./ir-hir/contract.js"; export const incomplete:SyntaxList<SyntaxPhase>={kind:"SyntaxList"};', 2740],
    ["unknown-kind.ts", 'import type { HirNode } from "./ir-hir/contract.js"; export function bad(value:HirNode){ value.kind="InventedNode"; }', 2540],
    ["private-helper.ts", 'import { createHirSchema } from "./ir-hir/index.js"; export const helper=createHirSchema;', 2305],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.equal(refused.status, 1, "the pinned compiler documents diagnostics with no output as exit status 1");
  const actual = [...refused.text.matchAll(/^(.+)\(\d+,\d+\): error TS(\d+):/gmu)]
    .map(match => [basename(match[1]), Number(match[2])]).sort(([left], [right]) => left.localeCompare(right));
  assert.deepStrictEqual(actual, negatives.map(([name, , code]) => [name, code]).sort(([left], [right]) => left.localeCompare(right)), refused.text);
});

function geometry() {
  return { source: available(0), dataLayoutExpression: null, dataLayout: available(definitionIdentity),
    byteSizeExpression: null, byteSize: available(4n), byteAlignmentExpression: null, byteAlignment: available(4n),
    strideExpression: null, stride: available(4n) };
}

function layoutCapture(kind, occurrence = bodySource(2)) {
  const common = { occurrence, bindings: unavailable() };
  switch (kind) {
    case "data-layout": return { ...common, kind, declaration: available(definitionIdentity), fingerprint: available("abi1"), byteOrder: available("little"), addressWidth: available(64) };
    case "value": return { ...common, kind, geometry: geometry(), fieldsExpression: null, fields: available([]) };
    case "array": return { ...common, kind, geometry: geometry(), extentExpression: null, length: available(3n), runtimeBase: available("bigint"), elementExpression: null, element: unavailable() };
    case "field": return { ...common, kind, source: available(0), selector: bodySource(3), selection: unavailable(), key: available({ kind: "text", value: "field" }),
      origins: available([{ kind: "declared", declaration: definitionIdentity }]), selectedDeclarations: available([definitionIdentity]), primary: available(definitionIdentity),
      value: available(0), fieldLayoutExpression: null, fieldLayout: unavailable(), byteOffsetExpression: null, byteOffset: available(0n),
      byteAlignmentExpression: null, byteAlignment: available(4n) };
    default: assert.fail(`unknown authored capture ${kind}`);
  }
}

function observationCapture(operation = "size") {
  return { occurrence: { body: bodyIdentity, node: 2 }, operation, bindings: unavailable(), operand: { body: bodyIdentity, node: 3 },
    layout: unavailable(), selector: operation === "field-offset" ? bodySource(3) : null,
    field: operation === "field-offset" ? unavailable() : available(null), result: available(0), value: available(4n) };
}

for (const kind of ["data-layout", "value", "array", "field"]) test(`HIR complete ${kind} capture record roundtrips factual data without native geometry inference`, () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  expression.tsonic.memory = available(layoutCapture(kind));
  const decoded = roundtrip((value), kind);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

for (const operation of ["size", "alignment", "stride", "field-offset"]) test(`HIR complete ${operation} observation retains its own occurrence and exact value`, () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  expression.tsonic.observation = available(observationCapture(operation));
  const decoded = roundtrip((value), operation);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

test("HIR empty and exact large memory geometry remain factual data, not a duplicated native layout decision", () => {
  for (const size of [0n, 9007199254740993n, 340282366920938463463374607431768211455n]) {
    const expression = callExpression();
    const value = expressionModule(expression);
    const capture = layoutCapture("value");
    capture.geometry.byteSize = available(size);
    capture.geometry.stride = available(size);
    capture.geometry.byteAlignment = available(1n);
    expression.tsonic.memory = available(capture);
    const decoded = roundtrip((value), `exact memory geometry/${size}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  }
});

test("HIR observation references must name actual local captured descriptors, not merely existing bare syntax", () => {
  for (const operation of ["size", "field-offset"]) {
    const expression = callExpression();
    const observation = observationCapture(operation);
    if (operation === "size") observation.layout = available(bodySource(3));
    else observation.field = available(bodySource(3));
    expression.tsonic.observation = available(observation);
    const value = (expressionModule(expression));
    const expected = operation === "size" ? "observation layout must name a value or array descriptor" : "observation field must name a field descriptor";
    assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [violation("memory-capture-reference", nodeSite(2), expected)]);
  }
});

test("HIR memory-capture-owner rejects one nonexistent original occurrence without manufacturing a replacement", () => {
  const expression = callExpression();
  expression.tsonic.memory = available(layoutCapture("value", bodySource(99)));
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("cross-owner-qualified", nodeSite(2), "qualified body node must exist in its named owner"),
    violation("memory-capture-owner", nodeSite(2), "capture occurrence must exist in the canonical checked-node inventory"),
  ]);
});

test("HIR memory-capture-reference checks actual descriptor endpoints rather than accepting a same-body bare node", () => {
  const expression = callExpression();
  const capture = layoutCapture("value");
  capture.fields = available([bodySource(3)]);
  expression.tsonic.memory = available(capture);
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("memory-capture-reference", nodeSite(2), "layout edge must name the required captured descriptor kind"),
  ]);
});

test("HIR memory-layout-acyclic detects a type-correct value-to-field-to-value reference cycle iteratively", () => {
  const first = callExpression();
  const second = callExpression();
  const value = moduleWith([syntax("ExpressionStatement", 0, { expression: first }), syntax("ExpressionStatement", 0, { expression: second })]);
  const layout = layoutCapture("value", bodySource(2));
  layout.fields = available([bodySource(5)]);
  const field = layoutCapture("field", bodySource(5));
  field.selector = bodySource(6);
  field.fieldLayout = available(bodySource(2));
  first.tsonic.memory = available(layout);
  second.tsonic.memory = available(field);
  const decoded = roundtrip((value), "metadata reference cycle");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
    violation("memory-layout-acyclic", nodeSite(2), "captured layout graph must be acyclic"),
  ]);
});

function foreignMemoryFixture(kind = "body") {
  const expressions = [callExpression(), callExpression(), callExpression()];
  const foreign = foreignModuleWith(expressions.map(expression => syntax("ExpressionStatement", 0, { expression })));
  const references = expressions.map(expression => referenceIn(foreign, expression, kind));
  const layout = layoutCapture("value", references[0]);
  layout.fields = available([references[1]]);
  const field = layoutCapture("field", references[1]);
  field.selector = referenceIn(foreign, expressions[1].expression, kind);
  field.fieldLayout = available(references[2]);
  const leaf = layoutCapture("value", references[2]);
  expressions[0].tsonic.memory = available(layout);
  expressions[1].tsonic.memory = available(field);
  expressions[2].tsonic.memory = available(leaf);
  const expression = callExpression();
  const value = expressionModule(expression);
  const array = layoutCapture("array");
  array.element = available(references[0]);
  expression.tsonic.memory = available(array);
  return { value, foreign, expressions, references, expression, array, layout, field, leaf };
}

for (const kind of ["body", "item"]) test(`HIR ${kind}-qualified foreign descriptor graph uses the actual checked snapshots`, () => {
  const { value, foreign, expressions, references } = foreignMemoryFixture(kind);

  const decoded = roundtrip((value), `foreign memory/${kind}`);
  const context = contextFor(decoded.value, {}, [foreign]);
  assert.equal(context.nodeOf(references[0]) === expressions[0], true, "the reader returns the genuine checked node, not an existence placeholder");
  assert.equal(context.nodeOf(references[1]) === expressions[1], true);
  assert.equal(context.nodeOf(references[2]) === expressions[2], true);
  assert.deepStrictEqual(product.verifyHir(foreign, contextFor(foreign, {}, [decoded.value])), []);
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value, {}, [foreign])), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, context), []);
});

test("HIR a real foreign descriptor edge may close a cycle through the local descriptor", () => {
  const { value, foreign, field } = foreignMemoryFixture();
  field.fieldLayout = available(bodySource(2));
  const decoded = roundtrip((value), "foreign to local layout cycle");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), [
    violation("memory-layout-acyclic", nodeSite(2), "captured layout graph must be acyclic"),
  ]);
});

for (const kind of ["body", "item"]) for (const cycle of [false, true])
  test(`HIR fresh-equal foreign ${kind} snapshots retain ${cycle ? "cyclic" : "acyclic"} declared arena identity`, () => {
    const { value, foreign, expressions, references, field } = foreignMemoryFixture(kind);
    if (cycle) field.fieldLayout = available(referenceIn(foreign, expressions[0], kind === "body" ? "item" : "body"));

    const decoded = roundtrip((value), `fresh foreign graph/${kind}/${cycle}`);
    const context = freshContextFor(decoded.value, [foreign]);
    const first = context.nodeOf(references[0]);
    const second = context.nodeOf(references[0]);
    assert.equal(first !== null && second !== null && first !== second, true, "this pure reader deliberately supplies distinct equal immutable snapshots");
    assertComplete(first, second, "the two allocations preserve the entire actual foreign node value");
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), cycle ? [
      violation("memory-layout-acyclic", { kind: "node", node: references[0] }, "captured layout graph must be acyclic"),
    ] : []);
  });

for (const kind of ["body", "item"])
  test(`HIR fresh foreign ${kind} graph keys keep different declared modules separate even at equal node ordinals`, () => {
    const { value, foreign, layout, expressions } = foreignMemoryFixture(kind);
    const leaf = callExpression();
    const field = callExpression();
    const other = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: leaf }),
      syntax("ExpressionStatement", 0, { expression: field })], "other.ts");
    const leafReference = referenceIn(other, leaf, kind);
    const fieldReference = referenceIn(other, field, kind === "body" ? "item" : "body");
    leaf.tsonic.memory = available(layoutCapture("value", leafReference));
    const capture = layoutCapture("field", fieldReference);
    capture.selector = referenceIn(other, field.expression, kind);
    capture.fieldLayout = available(leafReference);
    field.tsonic.memory = available(capture);
    layout.fields = available([fieldReference]);
    assert.equal(expressions[0].id === leaf.id, true, "a bare numeric-node key would invent a cycle between these two different arenas");
    const decoded = roundtrip((value), `distinct foreign arenas/${kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, freshContextFor(decoded.value, [(foreign), (other)])), []);
  });

test("HIR shared inline descriptor records retain value semantics and complete lexical binding reads after parsing", () => {
  const first = callExpression();
  const second = callExpression();
  const value = moduleWith([syntax("ExpressionStatement", 0, { expression: first }), syntax("ExpressionStatement", 0, { expression: second })]);
  const shared = layoutCapture("value", bodySource(first.id));
  shared.bindings = available(emptyBindings());
  first.tsonic.memory = available(shared);
  second.tsonic.memory = available(shared);
  const decoded = roundtrip((value), "shared inline memory record");
  const decodedFirst = decoded.value.tree.statements.nodes[0].expression;
  const decodedSecond = decoded.value.tree.statements.nodes[1].expression;
  assert.equal(decodedFirst.tsonic.memory.value === decodedSecond.tsonic.memory.value, false,
    "inline descriptor identity is not an arena identity");
  for (const input of [value, decoded.value]) {
    const reads = [];
    const context = contextFor(input, { bindingScopeAt: reference => {
      reads.push(reference);
      return emptyScope();
    } });
    assert.deepStrictEqual(product.verifyHir(input, context), []);
    assert.deepStrictEqual(reads, [bodySource(first.id), bodySource(first.id)], "every complete published value retains its lexical scope pair");
  }
});

test("HIR incompatible descriptor views of one actual occurrence retain the complete owner violation", () => {
  for (const reversed of [false, true]) {
    const first = callExpression();
    const second = callExpression();
    const value = moduleWith([syntax("ExpressionStatement", 0, { expression: first }), syntax("ExpressionStatement", 0, { expression: second })]);
    first.tsonic.memory = available(layoutCapture(reversed ? "array" : "value", bodySource(first.id)));
    second.tsonic.memory = available(layoutCapture(reversed ? "value" : "array", bodySource(first.id)));
    const decoded = roundtrip((value), `incompatible descriptor views/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
      violation("memory-capture-owner", nodeSite(second.id), "one occurrence cannot own incompatible descriptor kinds"),
    ]);
  }
});

for (const missing of [true, false]) test(`HIR foreign descriptor endpoint checks ${missing ? "absent" : "wrong-kind"} actual metadata`, () => {
  const { value, foreign, expressions, layout } = foreignMemoryFixture();
  if (missing) expressions[1].tsonic.memory = available(null);
  else layout.fields = available([referenceIn(foreign, expressions[2])]);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {}, [(foreign)])), [
    violation("memory-capture-reference", { kind: "node", node: referenceIn(foreign, expressions[0]) },
      "layout edge must name the required captured descriptor kind"),
  ]);
});

for (const operation of ["size", "alignment", "stride", "field-offset"])
  test(`HIR ${operation} observation resolves genuine foreign layout and field facts`, () => {
    const { value, foreign, expression, references } = foreignMemoryFixture();
    const observation = observationCapture(operation);
    observation.layout = available(references[0]);
    if (operation === "field-offset") observation.field = available(references[1]);
    expression.tsonic.observation = available(observation);
    const decoded = roundtrip((value), `foreign observation/${operation}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), []);
  });

for (const operation of ["size", "field-offset"]) test(`HIR ${operation} refuses an existing foreign node with the wrong descriptor kind`, () => {
  const { value, foreign, expression, references } = foreignMemoryFixture();
  const observation = observationCapture(operation);
  if (operation === "size") observation.layout = available(references[1]);
  else observation.field = available(references[0]);
  expression.tsonic.observation = available(observation);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {}, [(foreign)])), [
    violation("memory-capture-reference", nodeSite(2), operation === "size" ?
      "observation layout must name a value or array descriptor" : "observation field must name a field descriptor"),
  ]);
});

// Binding captures (SCHEMA-MIGRATION.md 5.1 and 5.6). The local module has two call expressions: the first carries a
// field binding of the foreign field descriptor, the second a record binding of the foreign value layout whose one
// field entry names the first.
function bindingFixture() {
  const { foreign, references } = foreignMemoryFixture();
  const first = callExpression();
  const second = callExpression();
  const value = moduleWith([syntax("ExpressionStatement", 0, { expression: first }), syntax("ExpressionStatement", 0, { expression: second })]);
  first.tsonic.core.fieldBinding = available(fieldBindingCapture(first.id, first.expression.id, available(references[1])));
  second.tsonic.core.recordBinding = available(recordBindingCapture(second.id, second.expression.id, available(references[0]),
    [{ expression: bodyNode(second.expression.id), binding: bodyNode(first.id) }]));
  return { value, foreign, references, first, second, statements: value.tree.statements.nodes };
}
const bindingOwnerMessage = "binding capture must retain its exact owning occurrence";
const bindingBodyMessage = "binding capture expressions must belong to the body of their occurrence";
const existingNodeMessage = "qualified body node must exist in its named owner";
const coreReferenceMessage = "Core capture reference must retain an existing qualified source node";

test("HIR field and record binding captures round-trip and verify against genuine foreign descriptors", () => {
  const { value, foreign } = bindingFixture();
  const decoded = roundtrip((value), "field and record binding captures");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), []);
});

test("HIR record binding accepts an array layout descriptor and a local descriptor node", () => {
  const { value, foreign, first, second } = bindingFixture();
  const array = layoutCapture("array", bodySource(first.id));
  array.element = available(referenceIn(foreign, foreign.tree.statements.nodes[0].expression));
  first.tsonic.memory = available(array);
  second.tsonic.core.recordBinding.value.layout = available(bodySource(first.id));
  const decoded = roundtrip((value), "record binding over an array layout");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), []);
});

test("HIR binding capture opposites have their complete violation vectors", () => {
  const cases = [
    ["HB6 a field binding names another occurrence", ({ first, second }) => { first.tsonic.core.fieldBinding.value.occurrence = bodyNode(second.id); },
      ({ first }) => [violation("binding-capture-owner", nodeSite(first.id), bindingOwnerMessage)]],
    ["HB13 a record binding names another occurrence", ({ first, second }) => { second.tsonic.core.recordBinding.value.occurrence = bodyNode(first.id); },
      ({ second }) => [violation("binding-capture-owner", nodeSite(second.id), bindingOwnerMessage)]],
    ["HB7 a field expression that is not a node of the body", ({ first }) => { first.tsonic.core.fieldBinding.value.fieldExpression = bodyNode(99); },
      ({ first }) => [violation("cross-owner-qualified", nodeSite(first.id), existingNodeMessage)]],
    ["HB8 a pointer expression of another body", ({ first, references }) => { first.tsonic.core.fieldBinding.value.pointerExpression = references[2].value; },
      ({ first }) => [violation("cross-owner-qualified", nodeSite(first.id), bindingBodyMessage)]],
    ["HB8 a record layout expression of another body", ({ second, references }) => { second.tsonic.core.recordBinding.value.layoutExpression = references[2].value; },
      ({ second }) => [violation("cross-owner-qualified", nodeSite(second.id), bindingBodyMessage)]],
    ["HB9 a field descriptor reference that does not exist", ({ first }) => { first.tsonic.core.fieldBinding.value.field = available(bodySource(99)); },
      ({ first }) => [violation("cross-owner-qualified", nodeSite(first.id), existingNodeMessage),
        violation("core-capture-reference", nodeSite(first.id), coreReferenceMessage),
        violation("memory-capture-reference", nodeSite(first.id), "field binding must name a field descriptor")]],
    ["HB10 a field reference to a layout descriptor", ({ first, references }) => { first.tsonic.core.fieldBinding.value.field = available(references[0]); },
      ({ first }) => [violation("memory-capture-reference", nodeSite(first.id), "field binding must name a field descriptor")]],
    ["HB11 a layout reference to a field descriptor", ({ second, references }) => { second.tsonic.core.recordBinding.value.layout = available(references[1]); },
      ({ second }) => [violation("memory-capture-reference", nodeSite(second.id), "record binding layout must name a value or array descriptor")]],
    ["HB11 a layout descriptor reference that does not exist", ({ second }) => { second.tsonic.core.recordBinding.value.layout = available(bodySource(99)); },
      ({ second }) => [violation("cross-owner-qualified", nodeSite(second.id), existingNodeMessage),
        violation("core-capture-reference", nodeSite(second.id), coreReferenceMessage),
        violation("memory-capture-reference", nodeSite(second.id), "record binding layout must name a value or array descriptor")]],
    ["HB12 a record field naming a node without metadata", ({ second, statements }) => { second.tsonic.core.recordBinding.value.fields[0].binding = bodyNode(statements[0].id); },
      ({ second }) => [violation("core-capture-reference", nodeSite(second.id), "record binding field must name a field-binding occurrence")]],
    ["HB12 a record field naming a node that is no field binding", ({ second }) => { second.tsonic.core.recordBinding.value.fields[0].binding = bodyNode(second.expression.id); },
      ({ second }) => [violation("core-capture-reference", nodeSite(second.id), "record binding field must name a field-binding occurrence")]],
    ["HB12 a record field naming an occurrence whose field binding is unavailable", ({ first }) => { first.tsonic.core.fieldBinding = unavailable(); },
      ({ second }) => [violation("core-capture-reference", nodeSite(second.id), "record binding field must name a field-binding occurrence")]],
    ["HB12 a record field naming a node that does not exist", ({ second }) => { second.tsonic.core.recordBinding.value.fields[0].binding = bodyNode(99); },
      ({ second }) => [violation("cross-owner-qualified", nodeSite(second.id), existingNodeMessage),
        violation("core-capture-reference", nodeSite(second.id), "record binding field must name a field-binding occurrence")]],
    ["HB14 an owner type outside the table", ({ first }) => { first.tsonic.core.fieldBinding.value.owner = available(99); },
      ({ first }) => [violation("type-reference", nodeSite(first.id), "type must exist in the supplied table")]],
    ["HB14 a source type outside the table", ({ second }) => { second.tsonic.core.recordBinding.value.source = available(99); },
      ({ second }) => [violation("type-reference", nodeSite(second.id), "type must exist in the supplied table")]],
  ];
  for (const [name, mutate, expected] of cases) {
    const fixture = bindingFixture();
    assert.deepStrictEqual(product.verifyHir(fixture.value, contextFor(fixture.value, {}, [(fixture.foreign)])), [], `${name}: valid fixture`);
    mutate(fixture);
    assert.deepStrictEqual(product.verifyHir(fixture.value, contextFor(fixture.value, {}, [(fixture.foreign)])), expected(fixture), name);
  }
});

for (const field of ["fieldBinding", "recordBinding"]) test(`HIR ${field} binding scope is requested at its own occurrence`, () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  expression.tsonic.core[field] = available(field === "fieldBinding" ? fieldBindingCapture(2, 3, unavailable())
    : recordBindingCapture(2, 3, unavailable(), []));
  const decoded = roundtrip((value), `${field}/lexical bindings`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { bindingScopeAt: reference => {
    assert.deepStrictEqual(reference, bodySource(2), "scope is requested at the binding occurrence");
    return emptyScope();
  } })), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { bindingScopeAt: () => null })), [
    { rule: "binding-vector-complete", site: nodeSite(2), detail: [{ kind: "text", value: "bindingScopeAt" },
      { kind: "text", value: "body" }, { kind: "text", value: bodyIdentity }, { kind: "number", value: 2 }] },
  ]);
});

// HB15b (SCHEMA-MIGRATION.md 5.7): the vector of a binding capture is verified against the generic scope of its occurrence.
for (const field of ["fieldBinding", "recordBinding"]) test(`HIR ${field} bindings vector must fit the generic scope of its occurrence`, () => {
  const owners = ["Class", "method", "captured"].map(name => `D[${moduleIdentity};${name}]`);
  const identities = owners.map(owner => ({ owner, index: 0 }));
  const scope = { classParameters: [identities[0]], methodParameters: [identities[1]], capturedParameters: [identities[2]], selfOwners: [owners[0]] };
  const fitting = () => ({ classBindings: [{ kind: "bound", parameter: identities[0], type: 0 }],
    methodBindings: [{ kind: "rigid", parameter: identities[1] }], capturedBindings: [{ kind: "bound", parameter: identities[2], type: 0 }],
    selfBindings: [{ kind: "rigid", owner: owners[0] }] });
  const forwarded = detail => [{ rule: "binding-vector-complete", site: nodeSite(2), detail }];
  const missing = fitting();
  missing.methodBindings = [];
  const renumbered = fitting();
  renumbered.methodBindings[0].parameter = { owner: owners[1], index: 1 };
  for (const [name, vector, expected] of [
    ["fitting", fitting(), []],
    ["method family missing", missing, forwarded([{ kind: "text", value: "methodBindings" }, { kind: "text", value: "complete" },
      { kind: "text", value: "length" }, { kind: "number", value: 0 }])],
    ["method parameter of another index", renumbered, forwarded([{ kind: "text", value: "methodBindings" }, { kind: "text", value: "0" },
      { kind: "text", value: "parameter" }])],
  ]) {
    const expression = callExpression();
    const value = expressionModule(expression);
    const capture = field === "fieldBinding" ? fieldBindingCapture(2, 3, unavailable()) : recordBindingCapture(2, 3, unavailable(), []);
    capture.bindings = available(vector);
    expression.tsonic.core[field] = available(capture);
    const declarations = new Map([[definitionIdentity, emptyScope()], ...owners.map(owner => [owner, emptyScope()])]);
    const context = contextFor(value, {
      bindingScopeOf: definition => declarations.get(definition) ?? null,
      bindingScopeAt: reference => {
        assert.deepStrictEqual(reference, bodySource(2), "scope is requested at the binding occurrence");
        return scope;
      },
    });
    const decoded = roundtrip((value), `${field}/generic scope/${name}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), expected, name);
  }
});

test("HIR binding capture text refuses a missing, repeated or unknown field and the former eight-field core capture", () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  expression.tsonic.core.fieldBinding = available(fieldBindingCapture(2, 3, unavailable()));
  const text = product.printHir(value);
  const record = text.slice(text.indexOf("HirFieldBindingCapture("));
  assert.equal(record.startsWith("HirFieldBindingCapture(occurrence=NodeRef("), true, "the record is written under its own name with occurrence first");
  const renamedField = text.replace("HirFieldBindingCapture(occurrence=", "HirFieldBindingCapture(occurence=");
  // The reader reports the first code unit at which the field name leaves the expected name: "occur" is common.
  assertInvalidText(renamedField, renamedField.indexOf("occurence=") + "occur".length, ["occurrence"]);
  const renamedRecord = text.replace("HirFieldBindingCapture(", "HirFieldBinding(");
  assertInvalidText(renamedRecord, renamedRecord.indexOf("HirFieldBinding("), ["declared record"]);
  const former = text.replace(/, fieldBinding=available\(value=HirFieldBindingCapture\(.*?pointerExpression=NodeRef\([^)]*\)\)\), recordBinding=available\(value=null\)/su, "");
  assert.notEqual(former, text, "the two binding facts were removed from one core capture");
  const prefix = text.slice(0, text.indexOf(", fieldBinding=available(value=HirFieldBindingCapture("));
  assertInvalidText(former, prefix.length + 2, ["fieldBinding"]);
});

test("HIR observation-capture-owner rejects a mismatched occurrence and illegal non-field selector as full vectors", () => {
  for (const [mutate, expected] of [
    [capture => { capture.occurrence.node = 3; }, "observation must retain its exact owning occurrence"],
    [capture => { capture.selector = bodySource(3); }, "non-field observation cannot carry a field selection"],
    [capture => { capture.operation = "field-offset"; }, "field-offset observation requires its selector and selected field"],
  ]) {
    const expression = callExpression();
    const capture = observationCapture();
    mutate(capture);
    expression.tsonic.observation = available(capture);
    const value = expressionModule(expression);
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [violation("observation-capture-owner", nodeSite(2), expected)]);
  }
});

test("HIR actual await protocol and minimally wrong closed arm have independent complete values", () => {
  const expression = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(), protocol: available({ kind: "await", subject: 3, completion: 0 }) } });
  const value = (expressionModule(expression));
  assert.deepStrictEqual(product.verifyHir(roundtrip(value, "await protocol").value, contextFor(value)), []);
  const wrong = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(),
    protocol: available({ kind: "yield", subject: 3, yielded: 0, sent: 0, completion: 0 }) } });
  const invalid = (expressionModule(wrong));
  assert.deepStrictEqual(product.verifyHir(invalid, contextFor(invalid)), [
    violation("protocol-kind", nodeSite(2), "protocol must match its syntactic operation"),
  ]);
  const wrongSubject = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(),
    protocol: available({ kind: "await", subject: 2, completion: 0 }) } });
  const wrongSubjectModule = (expressionModule(wrongSubject));
  assert.deepStrictEqual(product.verifyHir(wrongSubjectModule, contextFor(wrongSubjectModule)), [
    violation("protocol-kind", nodeSite(2), "protocol subject must be the actual syntactic operand"),
  ]);
});

function iterationProtocol(kind, subject, asynchronous = false, nullableEndpoints = false) {
  return { kind, asynchronous, subject, iterator: 0, element: 0, completion: 0, sent: 0,
    next: 0, finish: nullableEndpoints ? null : 0, fail: nullableEndpoints ? null : 0 };
}

test("HIR iteration, spread, yield and delegation retain their exact syntax, async mode and complete endpoints", () => {
  const rows = [];
  for (const asynchronous of [false, true]) for (const nullableEndpoints of [false, true]) {
    const spread = syntax("SpreadElement", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(), protocol: unavailable() } });
    const spreadModule = expressionModule(spread);
    spread.tsonic.protocol = available(iterationProtocol("spread", spread.expression.id, asynchronous, nullableEndpoints));
    rows.push([spreadModule, `spread/${asynchronous}/${nullableEndpoints}`]);
    const loop = syntax("ForOfStatement", 0, { awaitModifier: asynchronous ? syntax("AwaitKeyword", 0) : null,
      initializer: nameExpression("target"), expression: nameExpression("iterable"), statement: syntax("EmptyStatement", 0),
      tsonic: { core: absentCore(), protocol: unavailable() } });
    const loopModule = moduleWith([loop]);
    loop.tsonic.protocol = available(iterationProtocol("iterate", loop.expression.id, asynchronous, nullableEndpoints));
    rows.push([loopModule, `for-of/${asynchronous}/${nullableEndpoints}`]);
  }
  const enumeration = syntax("ForInStatement", 0, { awaitModifier: null, initializer: nameExpression("key"), expression: nameExpression("object"),
    statement: syntax("EmptyStatement", 0), tsonic: { core: absentCore(), protocol: unavailable() } });
  const enumerationModule = moduleWith([enumeration]);
  enumeration.tsonic.protocol = available(iterationProtocol("iterate", enumeration.expression.id));
  rows.push([enumerationModule, "for-in"]);
  for (const kind of ["yield", "delegate"]) for (const present of [false, true]) {
    const expression = syntax("YieldExpression", 0, { asteriskToken: kind === "delegate" ? syntax("AsteriskToken", 0) : null,
      expression: present ? nameExpression() : null, tsonic: { ...expressionMetadata(), protocol: unavailable() } });
    const value = expressionModule(expression);
    expression.tsonic.protocol = available({ kind, subject: expression.expression?.id ?? null, yielded: 0, sent: 0, completion: 0 });
    rows.push([value, `${kind}/${present}`]);
  }
  for (const [value, name] of rows) {
    const decoded = roundtrip((value), name);
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] } });
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), [], name);
  }
  const wrong = syntax("ForOfStatement", 0, { awaitModifier: syntax("AwaitKeyword", 0), initializer: nameExpression("target"), expression: nameExpression("iterable"),
    statement: syntax("EmptyStatement", 0), tsonic: { core: absentCore(), protocol: available(iterationProtocol("iterate", 4, false, true)) } });
  const wrongModule = (moduleWith([wrong]));
  assert.deepStrictEqual(product.verifyHir(wrongModule, contextFor(wrongModule, {
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] },
  })), [violation("protocol-kind", nodeSite(1), "iteration protocol must retain authored asynchronous mode")]);
  const wrongEnumeration = syntax("ForInStatement", 0, { awaitModifier: null, initializer: nameExpression("key"),
    expression: nameExpression("object"), statement: syntax("EmptyStatement", 0),
    tsonic: { core: absentCore(), protocol: unavailable() } });
  const wrongEnumerationModule = moduleWith([wrongEnumeration]);
  wrongEnumeration.tsonic.protocol = available(iterationProtocol("iterate", wrongEnumeration.expression.id, true));
  assert.deepStrictEqual(product.verifyHir((wrongEnumerationModule), contextFor(wrongEnumerationModule, {
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] },
  })), [violation("protocol-kind", nodeSite(1), "iteration protocol must retain authored asynchronous mode")]);
  for (const kind of ["ForInStatement", "ForOfStatement"]) {
    const empty = syntax(kind, 0, { awaitModifier: null, initializer: nameExpression("target"), expression: nameExpression("iterable"),
      statement: syntax("EmptyStatement", 0), tsonic: { core: absentCore(), protocol: available(null) } });
    const emptyModule = moduleWith([empty]);
    const decoded = roundtrip((emptyModule), `${kind}/absent-protocol`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

function variableModule() {
  const definition = `D[${moduleIdentity};value]`;
  const declaration = syntax("VariableDeclaration", 0, { name: syntax("Identifier", 0, { text: "value",
    tsonic: { core: absentCore(), role: "declaration-name", declaration: { kind: "definition", definition } } }),
  exclamationToken: null, type: null, initializer: null, tsonic: { core: absentCore(), parent: definitionIdentity, attributes: [],
    memory: available(null), declaration: { kind: "definition", definition }, declaredType: available(0), initializer: null } });
  const list = syntax("VariableDeclarationList", 0, { declarations: nodeList([declaration]), tsonic: { core: absentCore(), disposal: [] } });
  const value = moduleWith([syntax("VariableStatement", 0, { modifiers: null, declarationList: list })]);
  value.items = [{ definition, node: declaration.id }];
  return { value, list, declaration };
}

test("HIR resource disposal facts retain empty, one and several ordered sync/async protocols without inventing a producer", () => {
  for (const [count, reverse] of [[0, false], [1, false], [3, false], [3, true]]) {
    const { value, list, declaration } = variableModule();
    const facts = Array.from({ length: count }, (_, ordinal) => available({ kind: "dispose", subject: declaration.id, asynchronous: ordinal % 2 === 1, signature: 0 }));
    list.tsonic.disposal = reverse ? facts.reverse() : facts;
    const decoded = roundtrip((value), `disposal/${count}/${reverse}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, {
      types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] },
    })), []);
  }
  const { value, list, declaration } = variableModule();
  list.tsonic.disposal = [available({ kind: "await", subject: declaration.id, completion: 0 })];
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
    violation("protocol-kind", nodeSite(list.id), "disposal list must contain disposal protocols"),
  ]);
});

function assertInvalidText(text, offset, expected) {
  const prefix = text.slice(0, offset).split("\n");
  assert.deepStrictEqual(product.parseHir(text), { kind: "invalid-text", offset,
    line: prefix.length, column: prefix[prefix.length - 1].length + 1, expected,
    found: offset === text.length ? null : text.slice(offset, offset + 1) });
}

function switchModule() {
  const clause = syntax("CaseClause", 0, { expression: nameExpression("match"), statements: nodeList([syntax("EmptyStatement", 0)]) });
  const fallback = syntax("DefaultClause", 0, { expression: null, statements: nodeList([]) });
  const block = syntax("CaseBlock", 0, { clauses: nodeList([clause, fallback]) });
  const statement = syntax("SwitchStatement", 0, { expression: nameExpression("subject"), caseBlock: block });
  return { value: moduleWith([statement]), clause, fallback };
}

test("HIR kind-fixed case and default fields roundtrip as their declared arms and refuse the opposite field shape", () => {
  const { value, clause, fallback } = switchModule();
  const decoded = roundtrip((value), "CaseClause expression/DefaultClause null");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  const caseDeclaration = decoded.text.indexOf(`n:${clause.id}=CaseClause(`);
  const caseField = decoded.text.indexOf(`expression=n:${clause.expression.id}`, caseDeclaration);
  assert.equal(caseDeclaration >= 0 && caseField > caseDeclaration, true, "the error belongs to the real CaseClause expression field");
  const missing = decoded.text.slice(0, caseField) + decoded.text.slice(caseField).replace(`expression=n:${clause.expression.id}`, "expression=null");
  assertInvalidText(missing, caseField + "expression=".length, ["Expression"]);
  const defaultDeclaration = decoded.text.indexOf(`n:${fallback.id}=DefaultClause(`);
  const defaultField = decoded.text.indexOf("expression=null", defaultDeclaration);
  assert.equal(defaultDeclaration >= 0 && defaultField > defaultDeclaration, true, "the opposite belongs to DefaultClause, not a different null field");
  const extra = decoded.text.slice(0, defaultField) + decoded.text.slice(defaultField).replace("expression=null", `expression=n:${clause.expression.id}`);
  assertInvalidText(extra, defaultField + "expression=".length, ["null"]);
});

function iterationModule(kind, awaited) {
  const statement = syntax(kind, 0, { awaitModifier: awaited ? syntax("AwaitKeyword", 0) : null,
    initializer: nameExpression("binding"), expression: nameExpression("source"), statement: syntax("EmptyStatement", 0),
    tsonic: { core: absentCore(), protocol: unavailable() } });
  return { value: moduleWith([statement]), statement };
}

for (const [kind, awaited] of [["ForInStatement", false], ["ForOfStatement", false], ["ForOfStatement", true]])
  test(`HIR kind-fixed ${kind} retains ${awaited ? "await" : "null"} without manufacturing an illegal ForIn arm`, () => {
    const { value } = iterationModule(kind, awaited);
    const decoded = roundtrip((value), `${kind}/${awaited}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  });

test("HIR ForIn rejects the real nonnull await field with an exact invalid-text offset", () => {
  const { value, statement } = iterationModule("ForOfStatement", true);
  const text = product.printHir((value)).replace("=ForOfStatement(", "=ForInStatement(");
  const declaration = text.indexOf(`n:${statement.id}=ForInStatement(`);
  const field = text.indexOf(`awaitModifier=n:${statement.awaitModifier.id}`, declaration);
  assert.equal(declaration >= 0 && field > declaration, true);
  assertInvalidText(text, field + "awaitModifier=".length, ["null"]);
});

test("HIR malformed typed fields retain exact independently selected record and element offsets", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const cases = [
    [original.replace('languageVariant="Standard", scriptKind="TS"', 'scriptKind="TS", languageVariant="Standard"'),
      'scriptKind="TS"', ["languageVariant"]],
    [original.replace('scriptKind="TS", ', ""), "commentDirectives=", ["scriptKind"]],
    [original.replace('scriptKind="TS"', 'scriptKind="Invented"'), '"Invented"', ["declared field value"]],
    [original.replace('scriptKind="TS"', 'scriptKind=0'), 'scriptKind=0', ["declared field value"], "scriptKind=".length],
    [original.replace("tree=n:0", "tree=n:999"), "tree=n:999", ["declared syntax node"], "tree=".length],
    [original.replace("nodes=[]", "nodes=[false]"), "nodes=[false]", ["Statement"], "nodes=[".length],
    [original.replace("n:1=EndOfFile", "n:0=EndOfFile"), "n:0=EndOfFile", ["distinct wire binding"]],
    [original.replace("n:1=EndOfFile", "n:3=EndOfFile"), "n:3=EndOfFile", ["n:1"]],
    [original.replace("n:0=SourceFile", "n:0=InventedNode"), "n:0=InventedNode", ["syntax node declaration"], "n:0=".length],
    [original.replace("n:0=SourceFile", "n:0=HirBody"), "n:0=HirBody", ["syntax node declaration"], "n:0=".length],
    [original.replace("n:0=SourceFile", "n:0=Token"), "n:0=Token", ["syntax node declaration"], "n:0=".length],
    [original.replace("n:0=SourceFile", "SourceFile"), "SourceFile(", ["node wire binding"]],
    [original.replace("provider=available(value=null)", 'provider=unavailable(reason="future")'), '"future"', ["declared field value"]],
  ];
  for (const [text, marker, expected, adjustment = 0] of cases) {
    assert.equal(text.indexOf(marker) >= 0, true, "independently authored error marker exists in its owning frame");
    assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
  }
  const extra = `${original.slice(0, -1)}, bogus=0)`;
  assertInvalidText(extra, extra.lastIndexOf("bogus="), ["end of record"]);
  for (const label of ["InventedNode", "HirBody", "Token"]) {
    const text = `${original}\nn:2=${label}(@)`;
    assertInvalidText(text, original.length + 1 + "n:2=".length, ["syntax node declaration"]);
  }
  const surplus = `${original}\n${original.split("\n")[2].replace("n:1=EndOfFile(id=n:1", "n:2=EmptyStatement(id=n:7")}`;
  assertInvalidText(surplus, original.length + 1, ["referenced syntax declaration"]);
});

test("HIR lexical failures retain UTF16 offsets for strings, escapes, delimiters and wire positions", () => {
  const header = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").split("\n")[0];
  for (const [text, marker, adjustment, expected] of [
    ['HirModule(module=mod:"\\q")', "\\q", 1, ["JSON escape"]],
    ['HirModule(module=mod:"\\uZZZZ")', "ZZZZ", 0, ["four hexadecimal digits"]],
    ['HirModule(module=mod:"a\nb")', "\n", 0, ["JSON string character"]],
    ['HirModule(module=mod:"unfinished', "unfinished", "unfinished".length, ["closing quote"]],
    ["n:-0=SourceFile()", "-0", 0, ["nonnegative wire position"]],
    ["n:0.5=SourceFile()", "0.5", 0, ["nonnegative wire position"]],
    ["n:0.0=SourceFile()", "0.0", 0, ["canonical finite number"]],
    ["n:NaN=SourceFile()", "NaN", 0, ["nonnegative wire position"]],
    ["n:-1=SourceFile()", "-1", 0, ["nonnegative wire position"]],
    ["n:+Infinity=SourceFile()", "+Infinity", 0, ["nonnegative wire position"]],
    ["n:-Infinity=SourceFile()", "-Infinity", 0, ["nonnegative wire position"]],
    ["n:9007199254740992=SourceFile()", "9007199254740992", 0, ["nonnegative wire position"]],
    ["n:0n=SourceFile()", "0n", 0, ["nonnegative wire position"]],
    ["n:0 SourceFile()", " SourceFile", 1, ["="]],
    ["HirModule(module 0)", "0", 0, ["="]],
  ]) {
    const input = text.startsWith("n:") ? `${header}\n${text}` : text;
    const start = text.startsWith("n:") ? header.length + 1 : 0;
    assertInvalidText(input, start + text.indexOf(marker) + adjustment, expected);
  }
});

test("HIR text grammar rejects complete independently authored field, value and separator failures", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const header = original.split("\n")[0];
  const cases = [
    [`HirModule(module=mod:"${moduleIdentity}", module=mod:"${moduleIdentity}")`, `module=mod:"${moduleIdentity}")`, ["unique record field"]],
    [`${header} ${header}`, " HirModule(", ["newline"], 1],
    [`HirModule(module=mod:"${moduleIdentity}"tree=n:0)`, "tree=n:0", [",", ")"]],
    ["HirModule(module=mod:1n)", "1n", ["string identity"]],
    [original.replace("id=n:0", "id=n:0n"), "id=n:0n", ["number identity"], "id=n:".length],
    [original.replace("flags=[]", "flags=[,]"), "flags=[,]", ["identifier"], "flags=[".length],
    [original.replace("flags=[]", 'flags=["Let",]'), 'flags=["Let",]', ["identifier"], 'flags=["Let",'.length],
    [original.replace("pos=0", "pos=0x10"), "pos=0x10", [",", ")"], "pos=0".length],
  ];
  for (const [text, marker, expected, adjustment = 0] of cases)
    assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
  for (const number of ["01", "1.0", "1e999", "+1", "1e+1"]) {
    const marker = `pos=${number}`;
    const text = original.replace("pos=0", marker);
    assertInvalidText(text, text.indexOf(marker) + "pos=".length, ["canonical finite number"]);
  }
  for (const text of ["true", "false", "null", "0", '"text"']) assertInvalidText(text, 0, ["record"]);
  for (const replacement of ['flags=[null]', 'flags=["Invented"]']) {
    const text = original.replace("flags=[]", replacement);
    assertInvalidText(text, text.indexOf(replacement) + "flags=[".length, ["SyntaxFlag"]);
  }
  const wrongPrefix = original.replace("module=mod:", "module=body:");
  assertInvalidText(wrongPrefix, wrongPrefix.indexOf("body:"), ["ModuleId"]);
});

test("HIR one typed parser reports the first actual shape or frame fault before later lexical and child faults", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const cases = [
    ["Wrong(@)", "Wrong", ["HirModule"]],
    ["HirModule(module=Wrong(@))", "Wrong", ["ModuleId"]],
    ["HirModule(bogus=@)", "bogus", ["module"]],
    ["HirModule(module=mod:0, bogus=@)", "0,", ["string identity"]],
    ["HirModule() HirModule(@)", ")", ["module"]],
    [original.replace("pos=0", "pos=false").replace('languageVariant="Standard"', "bogus=@"),
      "pos=false", ["number"], "pos=".length],
    [original.replace('scriptKind="TS"', 'scriptKind="Wrong\\q"'), '"Wrong', ["declared field value"]],
    [original.replace('scriptKind="TS"', 'scriptKind=Wrong(@)'), "Wrong", ["declared record"]],
    [original.replace("flags=[]", 'flags=Wrong(@)'), "Wrong", ["declared record"]],
  ];
  for (const [text, marker, expected, adjustment = 0] of cases)
    assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
  const [header, source, end] = original.split("\n");
  const inline = `${header.replace("tree=n:0", `tree=${source.slice("n:0=".length)}`)}\n${end}`;
  assertInvalidText(inline, inline.indexOf("tree=SourceFile") + "tree=".length, ["node wire reference"]);
  for (const [text, marker, expected, adjustment = 0] of [
    [original.replace('languageVariant="Standard"', 'languageVariant="Wrong"').replace('scriptKind="TS"', 'scriptKind="T\\q"'),
      '"Wrong"', ["declared field value"]],
    [original.replace('languageVariant="Standard"', 'languageVariant="Sta\\q"').replace('scriptKind="TS"', 'scriptKind="Wrong"'),
      "\\q", ["JSON escape"], 1],
    [original.replace("pos=0", "pos=1.0").replace('scriptKind="TS"', "bogus=@"), "pos=1.0", ["canonical finite number"], "pos=".length],
    ['HirModule(module=mod:"\\q", bogus=@)', "\\q", ["JSON escape"], 1],
    ['HirModule(bogus=mod:"\\q")', "bogus", ["module"]],
  ]) assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
});

test("HIR canonical parser owns complete empty, whitespace, delimiter, identity and wire-kind cases", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  for (const text of ["", " \t\r\n "]) assertInvalidText(text, text.length, ["record"]);
  assertComplete(product.parseHir(`\r\n\t ${original}\r\n`), { kind: "parsed", value: moduleWith() }, "all complete whitespace-delimited data");
  const encoded = original.replace('scriptKind="TS"', 'scriptKind="\\u0054S"');
  assertComplete(product.parseHir(encoded), { kind: "parsed", value: moduleWith() }, "literal domain accepts its genuine decoded Unicode spelling");
  for (const [text, marker, expected, adjustment = 0] of [
    ["n:0=SourceFile(@)", "n:0", ["HirModule"]],
    ['HirModule("wrong\\q"=@)', '"wrong', ["module"], 1],
    ['HirModule("mod\\q"=@)', "\\q", ["JSON escape"], 1],
    ['HirModule("module":mod:"x")', ":mod", ["="]],
    [original.replace("endOfFileToken=n:1", "endOfFileToken=n:0"), "endOfFileToken=n:0", ["EndOfFile"], "endOfFileToken=".length],
    [original.replace("tree=n:0", "tree=n:1"), "tree=n:1", ["SourceFile"], "tree=".length],
    [original.replace("id=n:0", 'id=n:"\\q"'), 'id=n:"', ["number identity"], "id=n:".length],
    [original.replace("id=n:0", "id=n:true"), "id=n:true", ["number identity"], "id=n:".length],
    [original.replace("flags=[]", 'flags=["Let" @]'), "@]", [",", "]"]],
    [original.replace("flags=[]", 'flags=["Let" "Const"]'), '"Const"', [",", "]"]],
  ]) assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
});

test("HIR field names retain their first decoded deviation while the same decoder distinguishes complete duplicates", () => {
  const prefix = `HirModule(module=mod:"${moduleIdentity}", `;
  for (const [name, offset, expected] of [
    [`module=mod:"${moduleIdentity}")`, 0, ["unique record field"]],
    ['"module"=@)', 1, ["unique record field"]],
    ['"\\u006dodule"=@)', 1, ["unique record field"]],
    ['"m\\u006fdule"=@)', 1, ["unique record field"]],
    ["mo", 0, ["tree"]],
    ["mo\\q", 0, ["tree"]],
    ['"mo', 1, ["tree"]],
    ['"mo\\q', 1, ["tree"]],
    ['"\\u006do', 1, ["tree"]],
    ['"\\u006do\\q', 1, ["tree"]],
    ["trae=@)", 2, ["tree"]],
    ['"trae"=@)', 3, ["tree"]],
    ['"tr\\u0061e"=@)', 3, ["tree"]],
    ['"tr\\ne"=@)', 3, ["tree"]],
    ["treeExtra=@)", 4, ["tree"]],
    ['"treeExtra"=@)', 5, ["tree"]],
    ['"tree\\u0045xtra"=@)', 5, ["tree"]],
    ['"trX\\q', 3, ["tree"]],
    ['"trX\\uZZZZ', 3, ["tree"]],
    ['"trX\n', 3, ["tree"]],
    ['"trX', 3, ["tree"]],
    ["tr=@)", 2, ["tree"]],
    ['"tr"=@)', 3, ["tree"]],
    ['"t\\u0072"=@)', 8, ["tree"]],
    ['""=@)', 1, ["tree"]],
    ['"tr\\q', 4, ["JSON escape"]],
    ['"tr\\uZZZZ', 5, ["four hexadecimal digits"]],
    ['"tr\n', 3, ["JSON string character"]],
    ['"tr', 3, ["closing quote"]],
    ['"\\q', 2, ["JSON escape"]],
    ['"\\uZZZZ', 3, ["four hexadecimal digits"]],
    ['"', 1, ["closing quote"]],
  ]) assertInvalidText(prefix + name, prefix.length + offset, expected);
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  for (const name of ['"module"', '"\\u006dodule"', '"m\\u006fdule"'])
    assertComplete(product.parseHir(original.replace("module=", `${name}=`)), { kind: "parsed", value: moduleWith() },
      `the entire HIR value retains its genuine ${name} required field`);
  for (const name of ['"tree"', '"\\u0074ree"', '"tr\\u0065e"'])
    assertComplete(product.parseHir(original.replace("tree=", `${name}=`)), { kind: "parsed", value: moduleWith() },
      `the next complete required field ${name} remains accepted`);
});

test("HIR a completed record uses the empty required name with the same decoded and lexical priority", () => {
  const prefix = `HirModule(module=mod:"${moduleIdentity}", tree=n:0, items=[], bodies=[], checkerDiagnostics=[], obligations=[], `;
  for (const [name, offset, expected] of [
    ["extra=0)", 0, ["end of record"]],
    ["extra", 0, ["end of record"]],
    ["extra\\q", 0, ["end of record"]],
    ['"extra"=0)', 1, ["end of record"]],
    ['"extra', 1, ["end of record"]],
    ['"extra\\q', 1, ["end of record"]],
    ['"\\u0065xtra"=0)', 1, ["end of record"]],
    ['"\\u0065xtra', 1, ["end of record"]],
    ['"\\u0065xtra\\q', 1, ["end of record"]],
    [`module=mod:"${moduleIdentity}")`, 0, ["unique record field"]],
    ['"module"=@)', 1, ["unique record field"]],
    ['"\\u006dodule"=@)', 1, ["unique record field"]],
    ['"m\\u006fdule"=@)', 1, ["unique record field"]],
    ['"mod', 1, ["end of record"]],
    ['"mod\\q', 1, ["end of record"]],
    ['""=@)', 1, ["end of record"]],
    ['"\\q', 2, ["JSON escape"]],
    ['"\\uZZZZ', 3, ["four hexadecimal digits"]],
    ['"\n', 1, ["JSON string character"]],
    ['"', 1, ["closing quote"]],
  ]) assertInvalidText(prefix + name, prefix.length + offset, expected);
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const frame = "loc=TextRange(pos=0, end=100";
  assert.equal(original.includes(`${frame})`), true, "the nested finite record is an actual declared HIR location");
  for (const [name, offset, expected] of [
    ["pos=0)", 0, ["unique record field"]],
    ['"\\u0070os"=0)', 1, ["unique record field"]],
    ['"extra\\q', 1, ["end of record"]],
    ['""=0)', 1, ["end of record"]],
  ]) {
    const text = original.replace(`${frame})`, `${frame}, ${name}`);
    assertInvalidText(text, original.indexOf(frame) + frame.length + 2 + offset, expected);
  }
});

test("HIR arbitrary dictionary fields retain their real domain and only complete decoded duplicates are refused", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const frame = 'pragmas=[SingleLineCommentTrivia(pos=0, end=100, hasTrailingNewLine=false, name="fields", args=PragmaArguments(';
  const value = 'PragmaArgument(pos=0, end=1, name="field", value="value")';
  for (const [given, name, offset, expected] of [
    ["field", "field=@", 0, ["unique record field"]],
    ["field", '"field"=@', 1, ["unique record field"]],
    ["field", '"\\u0066ield"=@', 1, ["unique record field"]],
    ['""', '""=@', 1, ["unique record field"]],
    ["field", '"field\\q', 7, ["JSON escape"]],
  ]) {
    const prefix = `${frame}${given}=${value}, `;
    const text = original.replace("pragmas=[]", `${prefix}${name}`);
    assertInvalidText(text, original.indexOf("pragmas=[]") + prefix.length + offset, expected);
  }
});

test("HIR malformed bigint tokens are tested in their genuine exact-rational field before later syntax faults", () => {
  const expression = syntax("NumericLiteral", 0, { text: "1", tokenFlags: [], tsonic: { core: absentCore(),
    role: "value", value: emptyValue(), literal: { kind: "number", token: "1",
      value: { numerator: 1n, denominator: 1n, negativeZero: false } } } });
  const value = (expressionModule(expression));
  const original = product.printHir(value);
  for (const token of ["01n", "-0n", "+1n", "1.0n", "1e1n"]) {
    const marker = `numerator=${token}`;
    const text = original.replace("numerator=1n", marker);
    assert.equal(text.includes(marker), true, "the independent token is in the real exact-rational field");
    assertInvalidText(text, text.indexOf(marker) + "numerator=".length, ["canonical bigint"]);
  }
  for (const [token, expected] of [['"wrong\\q"', ["bigint"]], ["+Infinity", ["bigint"]]]) {
    const marker = `numerator=${token}`;
    const text = original.replace("numerator=1n", marker);
    assertInvalidText(text, text.indexOf(marker) + "numerator=".length, expected);
  }
});

test("HIR parser validates ordinary literal fields at the field and selects only declared union discriminants", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  for (const [before, after, marker, expected, adjustment] of [
    ["flags=[]", "flags=false", "flags=false", ["declared field value"], "flags=".length],
    ["flags=[]", "flags=Record()", "flags=Record()", ["declared record"], "flags=".length],
    ["pos=0", "pos=[]", "pos=[]", ["declared array"], "pos=".length],
    ["id=n:0", "id=0", "id=0", ["n:identity"], "id=".length],
  ]) {
    const text = original.replace(before, after);
    const offset = text.indexOf(marker) + adjustment;
    assertInvalidText(text, offset, expected);
  }
  const value = expressionModule(nameExpression("role-owner"));
  const text = product.printHir((value));
  const frame = text.indexOf("CheckedName(");
  const role = text.indexOf('role="value"', frame);
  assert.equal(frame >= 0 && role > frame, true, "the discriminator belongs to the independently authored checked name");
  const unknown = text.slice(0, role) + text.slice(role).replace('role="value"', 'role="Invented"');
  assertInvalidText(unknown, role + "role=".length, ["declared field value"]);
  const missing = text.slice(0, role) + text.slice(role).replace('role="value", ', "");
  assertInvalidText(missing, missing.indexOf("value=CheckedValue(", frame), ["role"]);
});

test("HIR multi-field union refusal reports the actual family or operation rather than the enclosing Core record", () => {
  const value = moduleWith();
  value.tree.tsonic.core.pointerOperation = available({ family: "native-pointer", operation: "store", pointer: bodySource(0), value: bodySource(0) });
  const text = product.printHir((value));
  const frame = text.indexOf("HirPointerOperationCapture(");
  assert.equal(frame >= 0, true);
  for (const [before, after, field] of [
    ['family="native-pointer"', 'family="Invented"', "family"],
    ['operation="store"', 'operation="view"', "operation"],
    ['operation="store"', 'operation="Invented"', "operation"],
  ]) {
    const start = text.indexOf(before, frame);
    assert.equal(start > frame, true, "the selected field belongs to this exact operation record");
    const invalid = text.slice(0, start) + text.slice(start).replace(before, after);
    assertInvalidText(invalid, start + field.length + 1, ["declared field value"]);
  }
});

test("HIR strings, quoted dictionary keys and host numbers roundtrip every declared scalar without normalization", () => {
  const special = 'quotes" slash\\ /\b\f\n\r\t\u0000\u0001\ud800X\udc00\ud83d\ude80';
  const expression = syntax("StringLiteral", 0, { text: special, tokenFlags: ["SingleQuote", "ContainsInvalidEscape"],
    tsonic: { core: absentCore(), role: "attribute-value", literal: { kind: "string", value: special } } });
  const value = expressionModule(expression);
  const args = ["__proto__", "plain", "a b", special].toSorted()
    .map(name => ({ name, value: { pos: 0, end: 1, name, value: special } }));
  value.tree.pragmas = [{ pos: 0, end: 100, kind: "SingleLineCommentTrivia", hasTrailingNewLine: true, name: special, args }];
  value.tree.commentDirectives = [{ loc: { pos: 0, end: 1 }, kind: "Unknown" }, { loc: { pos: 1, end: 2 }, kind: "ExpectError" }, { loc: { pos: 2, end: 3 }, kind: "Ignore" }];
  value.tree.checkJsDirective = { enabled: true, range: { pos: 0, end: 2, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false } };
  const decoded = roundtrip((value), "UTF16 and dictionaries");
  assertComplete(product.parseHir(decoded.text.replaceAll("/", "\\/")), { kind: "parsed", value },
    "JSON solidus escapes retain the entire independently authored HIR value");
  assert.deepStrictEqual(decoded.value.tree.pragmas[0].args.find(entry => entry.name === "__proto__"),
    { name: "__proto__", value: { pos: 0, end: 1, name: "__proto__", value: special } });
  value.tree.checkJsDirective = { enabled: true, range: { pos: 0, end: 2, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false } };
  roundtrip(value, "the complete single-line directive range");
  for (const number of [-0, NaN, Infinity, -Infinity, 0.5, -1, 0, 1, Number.MAX_SAFE_INTEGER]) {
    const numeric = moduleWith();
    numeric.tree.pragmas = [{ pos: number, end: number, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false, name: "scalar", args: [] }];
    roundtrip((numeric), `all host numbers/${String(number)}`);
  }
});

test("HIR dictionary text has one exact UTF16 key order independent of property insertion", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const entries = [["2", "two"], ["10", "ten"], ["z", "last"], ["a", "first"]];
  const expected = original.replace("pragmas=[]", 'pragmas=[SingleLineCommentTrivia(pos=0, end=100, hasTrailingNewLine=false, name="sorted", args=PragmaArguments("10"=PragmaArgument(pos=0, end=1, name="10", value="ten"), "2"=PragmaArgument(pos=0, end=1, name="2", value="two"), a=PragmaArgument(pos=0, end=1, name="a", value="first"), z=PragmaArgument(pos=0, end=1, name="z", value="last")))]');
  for (const order of [entries, [...entries].reverse()]) {
    const args = order.map(([name, value]) => ({ name, value: { pos: 0, end: 1, name, value } }));
    const value = moduleWith();
    value.tree.pragmas = [{ pos: 0, end: 100, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sorted", args }];
    const text = product.printHir(value);
    assert.equal(text, expected, "the entire module text equals the independent declaration-order fixture with sorted dictionary keys");
    value.tree.pragmas[0].args = args.toSorted((left, right) => Number(left.name > right.name) - Number(left.name < right.name));
    const result = product.parseHir(text);
    assertComplete(result, { kind: "parsed", value }, "the complete entry vector has canonical name order");
    const decoded = { value: result.value };
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

function signature(properties = {}) {
  return { id: 0, declaration: definitionIdentity, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: [], result: 0, ...properties };
}

test("HIR origin and syntax ranges validate actual integer counts before rounded endpoint arithmetic", () => {
  for (const [position, outside] of [[-1, true], [-0, false], [0.5, false], [NaN, false],
    [Infinity, false], [-Infinity, true], [Number.MAX_SAFE_INTEGER + 1, false]]) {
    const value = moduleWith();
    value.tree.endOfFileToken.loc = { pos: position, end: 100 };
    const expected = [violation("origin-range", nodeSite(1), "invalid syntax range")];
    if (outside) expected.push(violation("node-in-body-range", nodeSite(1), "syntax must remain inside its body root range"));
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), expected);
  }
  for (const length of [-1, -0, 0.5, -Number.MIN_VALUE, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const value = moduleWith();
    value.tree.endOfFileToken.origin = { ...value.tree.endOfFileToken.origin, start: 1, length };
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
      violation("origin-range", nodeSite(1), "invalid origin range"),
    ]);
  }
  for (const [start, length] of [[Number.MAX_SAFE_INTEGER, 0.25], [Number.MAX_SAFE_INTEGER, 1]]) {
    const value = moduleWith();
    value.tree.endOfFileToken.origin = { ...value.tree.endOfFileToken.origin, start, length };
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [
      violation("origin-range", nodeSite(1), "invalid origin range"),
    ]);
  }
  for (const length of [0, 1, Number.MAX_SAFE_INTEGER]) {
    const value = moduleWith();
    value.tree.endOfFileToken.origin = { ...value.tree.endOfFileToken.origin, start: 0, length };
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), []);
  }
  const upper = moduleWith();
  upper.tree.loc = { pos: 0, end: Number.MAX_SAFE_INTEGER };
  upper.tree.endOfFileToken.loc = { pos: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
  assert.deepStrictEqual(product.verifyHir((upper), contextFor(upper)), []);
  const outside = moduleWith();
  outside.tree.endOfFileToken.loc = { pos: 0, end: 101 };
  assert.deepStrictEqual(product.verifyHir((outside), contextFor(outside)), [
    violation("node-in-body-range", nodeSite(1), "syntax must remain inside its body root range"),
  ]);
});

test("HIR candidate endpoints retain declaration identity independently of the signature table index", () => {
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { appliedSignature: available(0) })] }];
  const valid = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature()] } });
  assert.deepStrictEqual(product.verifyHir((value), valid), []);
  const wrong = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: `D[${moduleIdentity};other]` })] } });
  assert.deepStrictEqual(product.verifyHir(value, wrong), [
    violation("candidate-endpoints", { kind: "body", body: bodyIdentity }, "applied signature must retain the candidate declaration"),
  ]);
});

test("HIR complete candidate binding scope uses the real type verifier and unknown scope is not fabricated empty", () => {
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { bindings: available(emptyBindings()) })] }];
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value, { bindingScopeOf: definition => {
    assert.equal(definition, definitionIdentity, "only the actual candidate declaration is requested");
    return null;
  } })), [{ rule: "binding-vector-complete", site: { kind: "body", body: bodyIdentity },
    detail: [{ kind: "text", value: "bindingScopeOf" }, { kind: "text", value: definitionIdentity }] }]);
});

test("HIR delegates actual binding vectors without relabelling an unrelated shared type-table violation as a HIR binding", () => {
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { bindings: available(emptyBindings()) })] }];
  const decoded = roundtrip((value), "complete empty binding with unrelated type-table order error");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {
    types: { terms: [{ kind: "primitive", primitive: "int32" }, { kind: "union", members: [0, 0] }], signatures: [] },
  })), []);
});

test("HIR genuine binding producer outcomes preserve every family, position, detail and original occurrence order", () => {
  const foreign = "M[P[%002Fproject];bindings.ts]";
  const outer = `D[${foreign};Outer]`;
  const inner = `D[${foreign};Outer/Inner]`;
  const method = `D[${foreign};Outer/Inner/method]`;
  const outerParameter = { owner: outer, index: 0 };
  const innerParameter = { owner: inner, index: 0 };
  const methodParameter = { owner: method, index: 0 };
  const scopes = new Map([
    [outer, { classParameters: [outerParameter], methodParameters: [], capturedParameters: [], selfOwners: [outer] }],
    [inner, { classParameters: [innerParameter], methodParameters: [], capturedParameters: [outerParameter], selfOwners: [outer, inner] }],
    [method, { classParameters: [innerParameter], methodParameters: [methodParameter], capturedParameters: [outerParameter], selfOwners: [outer, inner] }],
  ]);
  const original = { classBindings: [{ kind: "rigid", parameter: innerParameter }],
    methodBindings: [{ kind: "rigid", parameter: methodParameter }], capturedBindings: [{ kind: "rigid", parameter: outerParameter }],
    selfBindings: [{ kind: "rigid", owner: outer }, { kind: "rigid", owner: inner }] };
  const site = { kind: "body", body: bodyIdentity };
  const forwarded = (rule, family, position, detail) => ({ rule, site, detail: [{ kind: "text", value: family },
    { kind: "text", value: position === null ? "complete" : String(position) }, ...detail] });
  const cases = [[original, [], "complete rigid bindings"]];
  const bound = structuredClone(original);
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"])
    bound[family] = bound[family].map(binding => ({ ...binding, kind: "bound", type: 0 }));
  cases.push([bound, [], "complete bound bindings"]);
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const vector = structuredClone(original);
    vector[family] = [];
    cases.push([vector, [forwarded("binding-vector-complete", family, null,
      [{ kind: "text", value: "length" }, { kind: "number", value: 0 }])], `${family}/missing`]);
  }
  for (const family of ["classBindings", "methodBindings", "capturedBindings"]) {
    const vector = structuredClone(original);
    vector[family][0].parameter.index = 1;
    cases.push([vector, [forwarded("binding-vector-complete", family, 0, [{ kind: "text", value: "parameter" }])], `${family}/parameter`]);
  }
  for (const type of [-1, -0, 0.5, NaN, Infinity, -Infinity, 999]) {
    const vector = structuredClone(original);
    vector.classBindings[0] = { kind: "bound", parameter: innerParameter, type };
    cases.push([vector, [violation("type-reference", site, "type must exist in the supplied table"),
      forwarded("type-reference", "classBindings", 0, [{ kind: "text", value: "type" }, { kind: "number", value: type }])], `type/${type}`]);
  }
  const wrongOwner = structuredClone(original);
  wrongOwner.selfBindings[1].owner = method;
  cases.push([wrongOwner, [forwarded("binding-vector-complete", "selfBindings", 1, [{ kind: "text", value: "owner" }]),
    forwarded("binding-vector-complete", "selfBindings", 1, [{ kind: "text", value: "owner" }])], "self owner and order"]);
  const wrongOrder = structuredClone(original);
  wrongOrder.selfBindings.reverse();
  cases.push([wrongOrder, [forwarded("binding-vector-complete", "selfBindings", 0, [{ kind: "text", value: "owner" }]),
    forwarded("binding-vector-complete", "selfBindings", 1, [{ kind: "text", value: "owner" }])], "self order"]);
  for (const [vector, expected, name] of cases) {
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { declaration: method, bindings: available(vector) })] }];
    const decoded = roundtrip((value), `actual binding producer/${name}`);
    const base = contextFor(decoded.value);
    assert.deepStrictEqual(product.verifyHir(decoded.value, { ...base,
      bindingScopeOf: definition => scopes.get(definition) ?? base.bindingScopeOf(definition) }), expected, name);
  }
  const first = structuredClone(original);
  first.classBindings = [];
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { declaration: method, bindings: available(first) }),
    candidate(1, { declaration: method, bindings: available(wrongOrder) })] }];
  const decoded = roundtrip((value), "ordered actual binding occurrences");
  const base = contextFor(decoded.value);
  assert.deepStrictEqual(product.verifyHir(decoded.value, { ...base,
    bindingScopeOf: definition => scopes.get(definition) ?? base.bindingScopeOf(definition) }), [
    forwarded("binding-vector-complete", "classBindings", null, [{ kind: "text", value: "length" }, { kind: "number", value: 0 }]),
    forwarded("binding-vector-complete", "selfBindings", 0, [{ kind: "text", value: "owner" }]),
    forwarded("binding-vector-complete", "selfBindings", 1, [{ kind: "text", value: "owner" }]),
  ]);
});

for (const kind of ["data-layout", "value", "array", "field", "observation"]) test(`HIR ${kind} binding scope is the actual lexical occurrence scope including every environment family`, () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  const capture = kind === "observation" ? observationCapture() : layoutCapture(kind);
  const owners = ["Class", "method", "captured"].map(name => `D[${moduleIdentity};${name}]`);
  const identities = owners.map(owner => ({ owner, index: 0 }));
  const scope = { classParameters: [identities[0]], methodParameters: [identities[1]], capturedParameters: [identities[2]], selfOwners: [owners[0]] };
  const vector = { classBindings: [{ kind: "bound", parameter: identities[0], type: 0 }],
    methodBindings: [{ kind: "rigid", parameter: identities[1] }], capturedBindings: [{ kind: "bound", parameter: identities[2], type: 0 }],
    selfBindings: [{ kind: "rigid", owner: owners[0] }] };
  capture.bindings = available(vector);
  expression.tsonic[kind === "observation" ? "observation" : "memory"] = available(capture);
  const declarations = new Map([[definitionIdentity, emptyScope()], ...owners.map(owner => [owner, emptyScope()])]);
  const context = contextFor(value, {
    bindingScopeOf: definition => declarations.get(definition) ?? null,
    bindingScopeAt: reference => {
      assert.deepStrictEqual(reference, bodySource(2), "scope is requested at the actual occurrence, not a capture target or vector parameter");
      return scope;
    },
  });
  const decoded = roundtrip((value), `${kind}/lexical bindings`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, context), []);
  const unknown = { ...context, bindingScopeAt: reference => {
    assert.deepStrictEqual(reference, bodySource(2));
    return null;
  } };
  assert.deepStrictEqual(product.verifyHir(decoded.value, unknown), [{ rule: "binding-vector-complete", site: nodeSite(2),
    detail: [{ kind: "text", value: "bindingScopeAt" }, { kind: "text", value: "body" },
      { kind: "text", value: bodyIdentity }, { kind: "number", value: 2 }] }]);
});

test("HIR item-qualified capture scope keeps its actual owner and unknown occurrence rather than a guessed body", () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  const occurrence = { kind: "item", value: { owner: definitionIdentity, node: 2 } };
  const capture = layoutCapture("value", occurrence);
  capture.bindings = available(emptyBindings());
  expression.tsonic.memory = available(capture);
  const decoded = roundtrip((value), "item-qualified bindings");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { bindingScopeAt: reference => {
    assert.deepStrictEqual(reference, occurrence);
    return emptyScope();
  } })), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { bindingScopeAt: () => null })), [
    { rule: "binding-vector-complete", site: nodeSite(2), detail: [{ kind: "text", value: "bindingScopeAt" },
      { kind: "text", value: "item" }, { kind: "text", value: definitionIdentity }, { kind: "number", value: 2 }] },
  ]);
});

test("HIR body-owner reports a malformed owner correlation without silently replacing the retained root", () => {
  const value = moduleWith();
  value.bodies[0].owner = `D[${moduleIdentity};other]`;
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {
    bindingScopeOf: definition => definition === `D[${moduleIdentity};other]` ? emptyScope() : null,
  })), [
    violation("body-owner", { kind: "body", body: bodyIdentity }, "body identity, owner and actual module subtree must agree"),
    violation("body-owner", nodeSite(0), "body metadata must retain its exact owner and syntax root"),
  ]);
});

function sourceDiagnostic(start = 0, length = 100) {
  return { code: { kind: "checker", number: 999, rendered: "TS999" }, severity: "error", site: { kind: "source", origin: {
    module: moduleIdentity, start, length, derived: [],
  } }, source: null, evidence: [], message: "original checker diagnostic", arguments: [], related: [], fix: null };
}

test("HIR checker diagnostic ranges retain valid integer lengths before rounded endpoint arithmetic", () => {
  for (const [start, length] of [[0, -1], [0, -0], [0, 0.5], [0, -Number.MIN_VALUE], [0, NaN],
    [0, Infinity], [0, -Infinity], [0, Number.MAX_SAFE_INTEGER + 1], [Number.MAX_SAFE_INTEGER, 0.25],
    [Number.MAX_SAFE_INTEGER, 1], [-1, 0], [-0, 0], [0.5, 0], [NaN, 0], [Infinity, 0], [-Infinity, 0]]) {
    const value = moduleWith();
    value.checkerDiagnostics = [sourceDiagnostic(start, length)];
    const decoded = roundtrip((value), `diagnostic-range/${start}/${length}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
      violation("origin-range", { kind: "module", module: moduleIdentity }, "diagnostic source range must be valid"),
    ]);
  }
  for (const [start, length] of [[0, 0], [0, 1], [0, Number.MAX_SAFE_INTEGER], [Number.MAX_SAFE_INTEGER, 0]]) {
    const value = moduleWith();
    value.checkerDiagnostics = [sourceDiagnostic(start, length)];
    const decoded = roundtrip((value), `diagnostic-range-valid/${start}/${length}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

function indexObligation(ordinal = 0) {
  return { kind: "index", ordinal, occurrence: { body: bodyIdentity, node: 2 }, receiver: { body: bodyIdentity, node: 3 }, key: { body: bodyIdentity, node: 4 } };
}

function moduleWithObligation() {
  const expression = syntax("ElementAccessExpression", 0, { expression: nameExpression("receiver"), questionDotToken: null,
    argumentExpression: nameExpression("key"), tsonic: { core: absentCore(), role: "value", value: emptyValue(), origins: available([]), accessor: available(null) } });
  const value = expressionModule(expression);
  value.checkerDiagnostics = [sourceDiagnostic()];
  value.obligations = [{ diagnostic: 0, owner: bodySource(2), obligations: [indexObligation()] }];
  return value;
}

function expressionWithObligations(expression, obligations) {
  const value = expressionModule(expression);
  value.checkerDiagnostics = [sourceDiagnostic()];
  value.obligations = [{ diagnostic: 0, owner: bodySource(expression.id), obligations: obligations(expression) }];
  return value;
}

const binaryObligationInputs = [
  ["PlusToken", "+", "arithmetic"], ["MinusToken", "-", "arithmetic"], ["AsteriskToken", "*", "arithmetic"],
  ["SlashToken", "/", "arithmetic"], ["PercentToken", "%", "arithmetic"], ["AsteriskAsteriskToken", "**", "arithmetic"],
  ["AmpersandToken", "&", "arithmetic"], ["BarToken", "|", "arithmetic"], ["CaretToken", "^", "arithmetic"],
  ["LessThanLessThanToken", "<<", "arithmetic"], ["GreaterThanGreaterThanToken", ">>", "arithmetic"],
  ["GreaterThanGreaterThanGreaterThanToken", ">>>", "arithmetic"], ["LessThanToken", "<", "comparison"],
  ["LessThanEqualsToken", "<=", "comparison"], ["GreaterThanToken", ">", "comparison"], ["GreaterThanEqualsToken", ">=", "comparison"],
  ["EqualsEqualsToken", "==", "comparison"], ["ExclamationEqualsToken", "!=", "comparison"],
  ["EqualsEqualsEqualsToken", "===", "comparison"], ["ExclamationEqualsEqualsToken", "!==", "comparison"],
  ["InKeyword", "in", "comparison"], ["InstanceOfKeyword", "instanceof", "comparison"],
];

for (const [token, operator, role] of binaryObligationInputs) test(`HIR obligation-complete retains the entire actual binary ${operator} relationship`, () => {
  const expression = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("left"), type: null, operatorToken: syntax(token, 0), right: nameExpression("right"),
    tsonic: { core: absentCore(), role, value: emptyValue() } });
  const value = expressionWithObligations(expression, () => [{ kind: "operator", ordinal: 0, occurrence: { body: bodyIdentity, node: 2 }, operator,
    operands: [{ body: bodyIdentity, node: 3 }, { body: bodyIdentity, node: 5 }] }]);
  const decoded = roundtrip((value), `operator/${operator}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations[0].operands.reverse();
  assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
    violation("obligation-complete", nodeSite(2), "operator obligation must retain all actual operands in order"),
    violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
  ]);
});

for (const [kind, token, operator] of [
  ["PrefixUnaryExpression", "PlusToken", "+"], ["PrefixUnaryExpression", "MinusToken", "-"],
  ["PrefixUnaryExpression", "ExclamationToken", "!"], ["PrefixUnaryExpression", "TildeToken", "~"],
  ["TypeOfExpression", null, "typeof"], ["VoidExpression", null, "void"], ["DeleteExpression", null, "delete"],
]) test(`HIR obligation-complete retains the full actual unary ${operator} relationship`, () => {
  const expression = syntax(kind, 0, { ...(token === null ? { expression: nameExpression("operand") } : { operator: token, operand: nameExpression("operand") }),
    tsonic: token === null ? expressionMetadata() : { core: absentCore(), role: "value", value: emptyValue() } });
  const value = expressionWithObligations(expression, () => [{ kind: "operator", ordinal: 0, occurrence: { body: bodyIdentity, node: 2 }, operator,
    operands: [{ body: bodyIdentity, node: 3 }] }]);
  const decoded = roundtrip((value), `unary/${operator}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const missing = structuredClone(value);
  missing.obligations[0].obligations[0].operands = [];
  assert.deepStrictEqual(product.verifyHir((missing), contextFor(missing)), [
    violation("obligation-complete", nodeSite(2), "operator obligation must retain all actual operands in order"),
    violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
  ]);
});

const assignmentObligationInputs = [
  ["EqualsToken", null], ["PlusEqualsToken", "+"], ["MinusEqualsToken", "-"], ["AsteriskEqualsToken", "*"],
  ["SlashEqualsToken", "/"], ["PercentEqualsToken", "%"], ["AsteriskAsteriskEqualsToken", "**"],
  ["AmpersandEqualsToken", "&"], ["BarEqualsToken", "|"], ["CaretEqualsToken", "^"],
  ["LessThanLessThanEqualsToken", "<<"], ["GreaterThanGreaterThanEqualsToken", ">>"],
  ["GreaterThanGreaterThanGreaterThanEqualsToken", ">>>"], ["AmpersandAmpersandEqualsToken", null],
  ["BarBarEqualsToken", null], ["QuestionQuestionEqualsToken", null],
];

test("HIR short-circuit and sequence tokens do not invent arithmetic or assignment obligations", () => {
  for (const [token, role] of [["QuestionQuestionToken", "short-circuit"], ["AmpersandAmpersandToken", "short-circuit"],
    ["BarBarToken", "short-circuit"], ["CommaToken", "sequence"]]) {
    const expression = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("left"), type: null,
      operatorToken: syntax(token, 0), right: nameExpression("right"), tsonic: { core: absentCore(), role, value: emptyValue() } });
    const value = expressionModule(expression);
    const decoded = roundtrip((value), `non-operator-obligation/${token}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

for (const [token, operator] of assignmentObligationInputs) test(`HIR obligation-complete checks actual ${token} value/destination and never trusts a partial set`, () => {
  for (const reversed of [false, true]) {
    const expression = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("destination"), type: null, operatorToken: syntax(token, 0), right: nameExpression("source"),
      tsonic: { core: absentCore(), role: "assignment", value: emptyValue(), target: unavailable() } });
    const value = expressionWithObligations(expression, () => {
      const obligations = [{ kind: "write-fit", ordinal: 0, occurrence: { body: bodyIdentity, node: 2 }, value: { body: bodyIdentity, node: token === "EqualsToken" ? 5 : 2 },
        destination: bodySource(3), destinationType: 0 }];
      if (operator !== null) obligations.push({ kind: "operator", ordinal: 1, occurrence: { body: bodyIdentity, node: 2 }, operator,
        operands: [{ body: bodyIdentity, node: 3 }, { body: bodyIdentity, node: 5 }] });
      if (reversed) obligations.reverse();
      return obligations.map((obligation, ordinal) => ({ ...obligation, ordinal }));
    });
    const decoded = roundtrip((value), `assignment/${token}/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    for (const field of ["value", "destination"]) {
      const wrong = structuredClone(value);
      const fit = wrong.obligations[0].obligations.find(obligation => obligation.kind === "write-fit");
      if (field === "value") fit.value = { body: bodyIdentity, node: 3 };
      else fit.destination = bodySource(5);
      assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
        violation("obligation-complete", nodeSite(2), "write-fit obligation must retain its actual value and destination"),
        violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
      ]);
    }
    if (operator !== null) {
      const missing = structuredClone(value);
      missing.obligations[0].obligations = missing.obligations[0].obligations.filter(obligation => obligation.kind === "operator")
        .map((obligation, ordinal) => ({ ...obligation, ordinal }));
      assert.deepStrictEqual(product.verifyHir((missing), contextFor(missing)), [
        violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
      ]);
    }
  }
});

for (const kind of ["PrefixUnaryExpression", "PostfixUnaryExpression"]) for (const token of ["PlusPlusToken", "MinusMinusToken"])
  test(`HIR obligation-complete retains actual ${kind}/${token} result and operand storage`, () => {
    const expression = syntax(kind, 0, { operator: token, operand: nameExpression("target"),
      tsonic: { core: absentCore(), role: "update", value: emptyValue(), target: unavailable() } });
    const value = expressionWithObligations(expression, () => [{ kind: "write-fit", ordinal: 0, occurrence: { body: bodyIdentity, node: 2 },
      value: { body: bodyIdentity, node: 2 }, destination: bodySource(3), destinationType: 0 }]);
    const decoded = roundtrip((value), `${kind}/${token}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    const wrong = structuredClone(value);
    wrong.obligations[0].obligations[0].value.node = 3;
    assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
      violation("obligation-complete", nodeSite(2), "write-fit obligation must retain its actual value and destination"),
      violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
    ]);
  });

test("HIR checker diagnostic root keeps its full original code, evidence, related records and complete index obligation", () => {
  const value = moduleWithObligation();
  value.checkerDiagnostics[0].arguments = [{ kind: "text", value: "native" }, { kind: "integer", value: 9007199254740993n }, { kind: "number", value: -0 },
    { kind: "origin", value: { module: moduleIdentity, start: 0, length: 1, derived: [{ kind: "lowering", pass: "front" }] } }];
  value.checkerDiagnostics[0].related = [{ site: { kind: "file", path: "other.ts" }, code: { kind: "host", name: "H_RELATED", rendered: "H_RELATED" }, message: "related" }];
  value.checkerDiagnostics[0].fix = { description: "original fix", edits: [{ origin: { module: moduleIdentity, start: 2, length: 1, derived: [] }, replacement: "fixed" }] };
  const decoded = roundtrip((value), "complete checker record");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

for (const [name, change, expected] of [
  ["diagnostic-reference", value => { value.obligations[0].diagnostic = 1; }, [
    violation("diagnostic-reference", nodeSite(2), "diagnostic root must name one existing diagnostic"),
  ]],
  ["diagnostic-root-owner", value => { value.checkerDiagnostics[0].site.origin.length = 101; }, [
    violation("diagnostic-root-owner", nodeSite(2), "diagnostic source range must be inside its exact root"),
  ]],
  ["obligation-order", value => { value.obligations[0].obligations[0].ordinal = 1; }, [
    violation("obligation-order", nodeSite(2), "obligations must retain dense declared order"),
  ]],
  ["empty-obligations", value => { value.obligations[0].obligations = []; }, [
    violation("obligation-complete", nodeSite(2), "a discharge root requires its complete nonempty obligations"),
  ]],
  ["index-key-correlation", value => { value.obligations[0].obligations[0].key.node = 3; }, [
    violation("obligation-complete", nodeSite(2), "index obligation must retain the actual receiver and key"),
    violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
  ]],
]) test(`HIR exact diagnostic-root opposite retains the complete ${name} vector`, () => {
  const value = moduleWithObligation();
  change(value);
  const decoded = roundtrip((value), `diagnostic-root/${name}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), expected);
});

test("HIR diagnostic data preserves every closed code, severity, site and complete ordered payload rather than rendering or selecting messages", () => {
  const codes = [{ kind: "host", name: "HOST_TEST_RECORD", rendered: "HOST_TEST_RECORD" },
    { kind: "checker", number: 2345, rendered: "TS2345" },
    { kind: "extension", number: 9901180, extensionCode: "SOURCE_CORE_MEMORY_TEST_RECORD", rendered: "TSEXT9901180" }];
  const origin = { module: moduleIdentity, start: 0, length: 1, derived: [{ kind: "lowering", pass: "front" }] };
  const sites = [{ kind: "source", origin }, { kind: "file", path: "/project/main.ts" }, { kind: "none" }];
  const argumentsAll = [{ kind: "text", value: "original\ud800text" }, { kind: "integer", value: 18446744073709551617n },
    { kind: "number", value: -0 }, { kind: "origin", value: origin }];
  for (const code of codes) for (const severity of ["error", "warning", "suggestion"]) for (const site of sites)
    for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]]) {
      const related = Array.from({ length: count }, (_, ordinal) => ({ site: sites[ordinal], code: codes[ordinal], message: `original related ${ordinal}` }));
      const edits = Array.from({ length: count }, (_, ordinal) => ({ origin: { ...origin, start: ordinal }, replacement: `replacement${ordinal}` }));
      const evidence = Array.from({ length: count }, (_, ordinal) => `evidence${ordinal}`);
      if (reversed) { related.reverse(); edits.reverse(); evidence.reverse(); }
      const value = moduleWith();
      value.checkerDiagnostics = [{ code, severity, site, source: count === 0 ? null : "original source", evidence,
        message: "exact original message", arguments: count === 0 ? [] : count === 1 ? [argumentsAll[0]] : argumentsAll,
        related, fix: count === 0 ? null : { description: "original fix", edits } }];
      const decoded = roundtrip((value), `diagnostic/${code.kind}/${severity}/${site.kind}/${count}/${reversed}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    }
});

test("HIR candidate conditional failures retain absent, unavailable and complete original diagnostic outcomes separately", () => {
  const diagnostic = sourceDiagnostic(2, 1);
  diagnostic.arguments = [{ kind: "text", value: "original conditional failure" }];
  for (const conditionalFailure of [available(null), available(diagnostic), unavailable(), unavailable("checker-error"), unavailable("parameter-dependent")]) {
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(7, { conditionalFailure })] }];
    const decoded = roundtrip((value), `conditional/${conditionalFailure.kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  }
});

for (const [name, mutate, expected] of [
  ["diagnostic-reference", value => { value.obligations[0].diagnostic = 1; }, "diagnostic root must name one existing diagnostic"],
  ["diagnostic-root-owner", value => { value.checkerDiagnostics[0].site.origin.length = 101; }, "diagnostic source range must be inside its exact root"],
  ["obligation-complete", value => { value.obligations[0].obligations = []; }, "a discharge root requires its complete nonempty obligations"],
  ["obligation-order", value => { value.obligations[0].obligations[0].ordinal = 2; }, "obligations must retain dense declared order"],
]) test(`HIR diagnostic and obligation minimal opposite has complete vector: ${name}`, () => {
  const value = moduleWithObligation();
  mutate(value);
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), [violation(name, nodeSite(2), expected)]);
});

function coreCarrier() {
  const type = syntax("AnyKeyword", 0, { tsonic: { ...typeMetadata(), type: available(0) } });
  const assertion = syntax("TypeAssertionExpression", 0, { type, expression: nameExpression("argument"), tsonic: expressionMetadata() });
  const call = callExpression();
  call.arguments = nodeList([assertion]);
  return { module: expressionModule(call), call };
}

for (const kind of ["body", "item"]) test(`HIR Core markers inspect the ${kind}-qualified foreign type kind rather than a Boolean`, () => {
  const type = syntax("AnyKeyword", 0, { tsonic: typeMetadata() });
  const assertion = syntax("TypeAssertionExpression", 0, { type, expression: nameExpression("argument"), tsonic: expressionMetadata() });
  const invocation = callExpression();
  invocation.arguments = nodeList([assertion]);
  const foreign = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: invocation })]);
  for (const target of [type, assertion.expression, foreign.tree.endOfFileToken]) {
    const { module: value, call } = coreCarrier();
    call.tsonic.core.markers = available({ struct: null,
      field: { name: "field", typeNode: referenceIn(foreign, target, kind), type: available(0), readonly: true },
      defaultValue: null, jsString: false });
    const decoded = roundtrip((value), `foreign marker/${kind}/${target.kind}`);
    const expected = target === type ? [] : [violation("core-capture-kind", nodeSite(2), "marker type reference must point to a type syntax node")];
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), expected);
  }
});

for (const kind of ["body", "item"]) test(`HIR attribute occurrence checks the genuine foreign ${kind} invocation and declaration group`, () => {
  const invocation = callExpression();
  const foreign = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: invocation })]);
  for (const target of [invocation, invocation.expression]) {
    const { module: value, call } = coreCarrier();
    call.tsonic.core.attribute = available({ occurrence: referenceIn(foreign, target, kind), applicationTarget: bodySource(6),
      selectedMember: null, applicationMemberKind: null, applicationPlacement: null,
      applicationParameterName: null, applicationTargetSpecifier: null, kind: "builder-state" });
    const decoded = roundtrip((value), `foreign attribute/${kind}/${target.kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), target === invocation ? [] : [
      violation("core-capture-kind", nodeSite(2), "attribute capture occurrence must name its invocation"),
    ]);
  }
});

for (const kind of ["body", "item"]) test(`HIR missing foreign ${kind} data has the complete qualified-reference and Core-reference result`, () => {
  const foreign = foreignModuleWith([]);
  const { module: value, call } = coreCarrier();
  const reference = referenceIn(foreign, { id: 99 }, kind);
  call.tsonic.core.markers = available({ struct: null, field: null,
    defaultValue: { typeNode: reference, type: available(0) }, jsString: false });
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {}, [(foreign)])), [
    violation("cross-owner-qualified", nodeSite(2), `qualified ${kind} node must exist in its named owner`),
    violation("core-capture-reference", nodeSite(2), "Core capture reference must retain an existing qualified source node"),
  ]);
});

const bodyNode = node => ({ body: bodyIdentity, node });
const fieldBindingCapture = (occurrence, expression, field) => ({ occurrence: bodyNode(occurrence), bindings: available(emptyBindings()),
  owner: available(0), pointee: available(0), fieldExpression: bodyNode(expression), field, pointerExpression: bodyNode(expression) });
const recordBindingCapture = (occurrence, expression, layout, fields) => ({ occurrence: bodyNode(occurrence), bindings: available(emptyBindings()),
  source: available(0), layoutExpression: bodyNode(expression), layout, fields });
const capturedType = () => ({ type: available(0), component: { root: bodySource(6), path: [] } });
const markerField = (name = "field", readonly = true) => ({ name, typeNode: bodySource(5), type: available(0), readonly });

function coreArmInputs() {
  const rows = [];
  const add = (field, name, value) => { rows.push({ field, name, value }); };
  for (const kind of ["raw-address", "typed-location", "native-pointer", "function-pointer"]) add("pointerType", kind, kind === "raw-address" ? { kind } :
    kind === "typed-location" ? { kind, pointee: capturedType(), mutability: "readwrite" } :
      kind === "native-pointer" ? { kind, declaration: definitionIdentity } :
        { kind, declaration: definitionIdentity, parameters: [capturedType(), capturedType()], result: capturedType(), abi: ["C", "Native"] });
  for (const mutability of ["readonly", "unspecified"]) add("pointerType", mutability, { kind: "typed-location", pointee: capturedType(), mutability });
  for (const operation of ["address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer"])
    for (const [selection, pointee] of [["applicable", "available"], ["conditional-candidates", "unvisited"], ["untyped", "not-applicable"], ["unvisited", "missing"]])
      add("pointerOperation", `typed-location/${operation}/${selection}`, { family: "typed-location", operation, exportName: operation,
        arguments: [bodySource(6)], typeArguments: [bodySource(5)], selection, pointee });
  add("pointerOperation", "typed-location/view", { family: "typed-location", operation: "view", pointer: bodySource(6), read: bodySource(6), write: bodySource(6), optional: true });
  for (const operation of ["load", "store", "offset"]) add("pointerOperation", `native-pointer/${operation}`, { family: "native-pointer", operation,
    pointer: bodySource(6), ...(operation === "store" ? { value: bodySource(6) } : operation === "offset" ? { offset: bodySource(6) } : {}) });
  add("pointerOperation", "raw-address/bind", { family: "raw-address", operation: "bind-raw-pointer", identity: bodySource(6) });
  add("pointerOperation", "raw-address/equal", { family: "raw-address", operation: "equal-raw-pointer", left: bodySource(6), right: bodySource(6) });
  add("pointerOperation", "raw-address/hash", { family: "raw-address", operation: "hash-raw-pointer", pointer: bodySource(6) });
  add("pointerOperation", "raw-memory/to-raw", { family: "raw-memory", operation: "to-raw", pointer: bodySource(6), layout: bodySource(6) });
  add("pointerOperation", "raw-memory/reinterpret", { family: "raw-memory", operation: "reinterpret", raw: bodySource(6), layout: bodySource(6) });
  for (const width of [8, 16, 32, 64, 128]) for (const signedness of ["signed", "unsigned"])
    add("pointerOperation", `raw-memory/offset/${width}/${signedness}`, { family: "raw-memory", operation: "byte-offset", raw: bodySource(6), offset: bodySource(6),
      integer: { runtimeBase: width < 64 ? "number" : "bigint", signedness, width }, dataLayout: bodySource(6) });
  for (const width of [32, 64]) for (const operation of ["raw-to-address-integer", "address-integer-to-raw"])
    add("pointerOperation", `${operation}/${width}`, { family: "raw-memory", operation,
      ...(operation === "raw-to-address-integer" ? { raw: bodySource(6) } : { address: bodySource(6) }),
      integer: { width, runtimeBase: width === 32 ? "number" : "bigint", signedness: "unsigned" }, dataLayout: bodySource(6) });
  add("pointerOperation", "keep-alive", { family: "keep-alive", operation: "keep-alive", value: bodySource(6) });
  for (const [count, reverse] of [[0, false], [1, false], [3, false], [3, true]]) {
    const fields = Array.from({ length: count }, (_, ordinal) => markerField(`field${ordinal}`, ordinal % 2 === 0));
    add("markers", `struct/${count}/${reverse}`, { struct: { valueType: true, fields: available(reverse ? fields.reverse() : fields) },
      field: markerField(), defaultValue: { typeNode: bodySource(5), type: available(0) }, jsString: true });
  }
  for (const reason of ["checker-error", "parameter-dependent", "not-provided"])
    add("markers", `unavailable-fields/${reason}`, { struct: { valueType: false, fields: unavailable(reason) }, field: null, defaultValue: null, jsString: false });
  for (const kind of ["builder-state", "application"]) add("attribute", kind, { occurrence: bodySource(2), applicationTarget: bodySource(6),
    selectedMember: { selectedDeclaration: bodySource(3), declarations: [bodySource(3)] }, applicationMemberKind: "method", applicationPlacement: "constructor",
    applicationParameterName: "x", applicationTargetSpecifier: "target", kind, ...(kind === "application" ? { invocation: bodySource(2) } : {}) });
  for (const operation of ["expression", "remaining-block"]) add("safety", `unsafe/${operation}`, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "unsafe-context", operation, ...(operation === "expression" ? { expression: bodySource(6) } : { firstDirectStatement: true }) });
  for (const form of ["type", "value"]) add("safety", `root/${form}`, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "safety", operation: "root", form, target: form === "type" ? bodySource(5) : null });
  for (const memberKind of ["indexer", "method", "property"]) add("safety", `select/${memberKind}`, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "safety", operation: "select-member", predecessor: bodySource(6), memberKind,
    selection: { kind: "selected", expression: bodySource(6), declaration: bodySource(3), declarations: [bodySource(3)] } });
  for (const reason of ["function-shape", "receiver", "member-evidence"]) add("safety", `unavailable/${reason}`, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "safety", operation: "select-member", predecessor: null, memberKind: "method", selection: { kind: "unavailable", reason } });
  for (const placement of ["declaration", "constructor", "getter", "setter"]) add("safety", placement, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "safety", operation: "placement", predecessor: null, placement });
  for (const contract of ["requires-unsafe", "safe"]) add("safety", contract, { occurrence: bodySource(2), provider: definitionIdentity,
    family: "safety", operation: "apply", predecessor: bodySource(6), contract });
  for (const value of [null, "moved", "borrowed-shared", "borrowed-mut"]) add("flowState", String(value), value);
  add("provider", "actual provider definition", definitionIdentity);
  for (const field of ["provider", "markers", "pointerType", "pointerOperation", "fieldBinding", "recordBinding", "attribute", "safety", "argumentPassing", "flowState"])
    for (const reason of ["checker-error", "parameter-dependent", "not-provided"])
      rows.push({ field, name: `${field}/${reason}`, captured: unavailable(reason) });
  // Binding captures whose descriptor references are unavailable: the record is complete and needs no descriptor node.
  for (const [name, change] of [["complete", {}], ["bindings unavailable", { bindings: unavailable("parameter-dependent") }],
    ["owner unavailable", { owner: unavailable("checker-error") }], ["pointee unavailable", { pointee: unavailable() }]])
    add("fieldBinding", name, { ...fieldBindingCapture(2, 6, unavailable()), ...change });
  for (const [name, change] of [["complete", {}], ["bindings unavailable", { bindings: unavailable("parameter-dependent") }],
    ["source unavailable", { source: unavailable("checker-error") }]])
    add("recordBinding", name, { ...recordBindingCapture(2, 6, unavailable(), []), ...change });
  for (const kind of ["builder-state", "application"]) add("attribute", `${kind}/no selection`, { occurrence: bodySource(2), applicationTarget: bodySource(6),
    selectedMember: null, applicationMemberKind: null, applicationPlacement: null, applicationParameterName: null, applicationTargetSpecifier: null,
    kind, ...(kind === "application" ? { invocation: bodySource(2) } : {}) });
  for (const mode of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"])
    add("argumentPassing", mode, { role: "argument", mode, storageExpression: bodySource(6) });
  return rows;
}

test("HIR complete Core capture arm bank preserves every closed factual family and its own fields", () => {
  for (const row of coreArmInputs()) {
    const { module, call } = coreCarrier();
    call.tsonic.core[row.field] = row.captured ?? available(row.value);
    const decoded = roundtrip((module), `${row.field}/${row.name}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [], `${row.field}/${row.name}`);
  }
});

const rootPlace = () => ({ base: { kind: "root", resolution: { kind: "definition", definition: definitionIdentity, aliases: [] } },
  step: null, read: available(0), write: available(0) });
const projectTarget = () => ({ target: "project", module: moduleIdentity });
const libraryTarget = () => ({ target: "library", module: { providerId: "authored-provider", providerVersion: "1", packageName: null,
  moduleSpecifier: "authored:module", providerModuleId: "module" } });
const memberOrigins = () => [{ kind: "declared", declaration: definitionIdentity }, { kind: "class-prototype", owner: definitionIdentity },
  { kind: "mapped", owner: bodySource(0), key: { kind: "text", value: "field" } }];

function checkedRoleInputs() {
  const rows = [];
  const add = (name, node, expected = []) => rows.push({ name, node, expected });
  for (const [role, fields] of [
    ["value", { value: emptyValue(), resolution: { kind: "definition", definition: definitionIdentity, aliases: [definitionIdentity] } }],
    ["assignment-target", { resolution: { kind: "definition", definition: definitionIdentity, aliases: [] }, views: emptyViews(), place: available(rootPlace()), access: "write" }],
    ["declaration-name", { declaration: { kind: "definition", definition: definitionIdentity } }],
    ["property-name", { key: available({ kind: "text", value: "field" }), origins: available(memberOrigins()) }],
    ["type-name", { resolution: { kind: "module", target: projectTarget() } }],
    ["label", { target: null }],
    ["private-name", { declaration: definitionIdentity }],
    ["shorthand-value", { value: emptyValue(), resolution: { kind: "unresolved", checkerDiagnostic: null }, key: available({ kind: "symbol", declaration: definitionIdentity }) }],
  ]) add(`name/${role}`, syntax("Identifier", 0, { text: "name", tsonic: { core: absentCore(), role, ...fields } }));
  add("name/read-write", syntax("Identifier", 0, { text: "target", tsonic: { core: absentCore(), role: "assignment-target",
    resolution: { kind: "module", target: libraryTarget() }, views: emptyViews(), place: available(rootPlace()), access: "read-write" } }));
  for (const [role, fields] of [
    ["value", { value: emptyValue(), literal: { kind: "string", value: "text" } }],
    ["property-name", { key: available({ kind: "text", value: "text" }), origins: available(memberOrigins()) }],
    ["declaration-name", { declaration: { kind: "definition", definition: definitionIdentity } }],
    ["type-literal", { type: available(0), literal: { kind: "string", value: "text" } }],
    ["module-specifier", { target: available(libraryTarget()) }],
    ["export-name", { definition: available(definitionIdentity) }],
    ["attribute-value", { literal: { kind: "string", value: "text" } }],
  ]) add(`literal/${role}`, syntax("StringLiteral", 0, { text: "text", tokenFlags: [], tsonic: { core: absentCore(), role, ...fields } }));
  add("literal/unique-symbol category opposite", syntax("StringLiteral", 0, { text: "text", tokenFlags: [], tsonic: { core: absentCore(),
    role: "type-literal", type: available(0), literal: { kind: "unique-symbol", declaration: definitionIdentity } } }), [
    violation("literal-exact", nodeSite(2), "literal category and value must match its syntax"),
  ]);
  for (const [kind, literal] of [["TrueKeyword", { kind: "boolean", value: true }], ["FalseKeyword", { kind: "boolean", value: false }], ["NullKeyword", { kind: "absence" }]]) {
    add(`keyword/value/${kind}`, syntax(kind, 0, { tsonic: { core: absentCore(), role: "value", value: emptyValue() } }));
    add(`keyword/type-literal/${kind}`, syntax(kind, 0, { tsonic: { core: absentCore(), role: "type-literal", type: available(0), literal } }));
  }
  for (const [role, token] of [["arithmetic", "PlusToken"], ["comparison", "EqualsEqualsToken"], ["short-circuit", "AmpersandAmpersandToken"],
    ["sequence", "CommaToken"], ["assignment", "EqualsToken"]]) add(`binary/${role}`, syntax("BinaryExpression", 0, { modifiers: null,
    left: nameExpression("left"), type: null, operatorToken: syntax(token, 0), right: nameExpression("right"),
    tsonic: { core: absentCore(), role, value: emptyValue(), ...(role === "assignment" ? { target: available(rootPlace()) } : {}) } }));
  add("unary/value", syntax("PrefixUnaryExpression", 0, { operator: "ExclamationToken", operand: nameExpression(), tsonic: { core: absentCore(), role: "value", value: emptyValue() } }));
  for (const kind of ["PrefixUnaryExpression", "PostfixUnaryExpression"]) add(`${kind}/update`, syntax(kind, 0, { operator: "PlusPlusToken", operand: nameExpression(),
    tsonic: { core: absentCore(), role: "update", value: emptyValue(), target: available(rootPlace()) } }));
  for (const role of ["value", "heritage"]) add(`instantiation/${role}`, syntax("ExpressionWithTypeArguments", 0, { expression: nameExpression(), typeArguments: null,
    tsonic: { core: absentCore(), role, ...(role === "value" ? { value: emptyValue() } : { type: available(0), definition: available(definitionIdentity) }) } }));
  for (const kind of ["ArrayLiteralExpression", "ObjectLiteralExpression"]) for (const role of ["value", "assignment-pattern"])
    add(`${kind}/${role}`, syntax(kind, 0, { ...(kind === "ArrayLiteralExpression" ? { elements: nodeList([]) } : { properties: nodeList([]) }), multiLine: false,
      tsonic: { core: absentCore(), role, ...(role === "value" ? { value: emptyValue() } : { views: emptyViews() }) } }));
  for (const role of ["value", "assignment-target"]) {
    const receiver = nameExpression("receiver");
    receiver.tsonic.value.place = available(rootPlace());
    add(`member/${role}`, syntax("ElementAccessExpression", 0, {
      expression: receiver, questionDotToken: null, argumentExpression: nameExpression("key"),
      tsonic: { core: absentCore(), role, ...(role === "value" ? { value: emptyValue() } : { views: emptyViews(),
        place: available({ base: { kind: "place", node: 3 }, step: { kind: "index", expression: 4 }, read: available(0), write: available(0) }), access: "read-write" }),
        origins: available(memberOrigins()), accessor: available(null) } }));
  }
  return rows;
}

test("HIR closed checked-name, literal, binary, unary, keyword, instantiation, aggregate and member roles retain complete values", () => {
  for (const row of checkedRoleInputs()) {
    const value = (expressionModule(row.node));
    const decoded = roundtrip(value, row.name);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), row.expected, row.name);
  }
});

function selectorInputs() {
  const selectors = [
    { kind: "class-value" }, { kind: "construction-argument", definition: { occurrence: { body: bodyIdentity, node: 6 }, captures: [{ body: bodyIdentity, local: 0 }] }, index: 0 },
    { kind: "optional-value" }, { kind: "array-element" }, { kind: "tuple-element", index: 0 },
    ...["union-member", "argument-place", "parameter-place", "intersection-member"].map(kind => ({ kind, index: 0 })),
    { kind: "intersection-result" }, ...["argument-tail", "parameter-tail"].map(kind => ({ kind, start: 0 })),
    ...memberOrigins().map(origin => ({ kind: "member", origin })),
    ...["index-key", "index-value"].map(kind => ({ kind, declaration: definitionIdentity })), { kind: "projection-source" },
    { kind: "parameter", signature: 0, index: 0 }, { kind: "receiver", signature: 0 },
    { kind: "signature-tail", signature: 0, start: 0, readonly: true }, { kind: "tuple-slice", start: 0, endCount: 1, readonly: false },
    { kind: "result", signature: 0 }, { kind: "type-argument", declaration: definitionIdentity, index: 0 }, { kind: "awaited" },
  ];
  for (const origin of ["authored", "inferred"]) selectors.push({ kind: "sum-arm", family: { origin,
    component: { root: bodySource(6), path: [] }, parameters: [{ owner: definitionIdentity, index: 0 }],
    roles: [{ authoredIndex: 0, component: bodySource(6), member: 0 }] }, index: 0 });
  return selectors;
}

test("HIR Core type components retain every closed selector arm, qualified construction capture and ordered path", () => {
  const selectors = selectorInputs();
  const paths = [[], ...selectors.map(selector => [selector]), selectors, [...selectors].reverse()];
  for (const path of paths) {
    const { module, call } = coreCarrier();
    module.bodies[0].locals = [{ id: 0, declaration: bodySource(6), name: "captured", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: false }];
    call.tsonic.core.pointerType = available({ kind: "typed-location", pointee: { type: available(0), component: { root: bodySource(6), path } }, mutability: "readonly" });
    const decoded = roundtrip((module), `component path/${path.map(selector => selector.kind).join("/")}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(module, {
      types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature()] },
    })), []);
  }
});

test("HIR inline component cycles are exact caller defects while genuine shared inline subtrees encode by value", () => {
  const cyclic = coreCarrier();
  const path = [];
  const component = { root: bodySource(6), path };
  path.push({ kind: "sum-arm", index: 0, family: { origin: "authored", component, parameters: [], roles: [] } });
  cyclic.call.tsonic.core.pointerType = available({ kind: "typed-location", pointee: { type: available(0), component }, mutability: "readonly" });
  (cyclic.module);
  const expected = { name: "TypeError", message: "Inline value cycle at $.tsonic.core.pointerType.value.pointee.component.path[0].family.component" };
  assert.throws(() => product.printHir(cyclic.module), expected);
  assert.throws(() => product.verifyHir(cyclic.module, contextFor(cyclic.module)), expected);

  const shared = coreCarrier();
  const leaf = { root: bodySource(6), path: [] };
  const family = { origin: "authored", component: leaf, parameters: [], roles: [] };
  shared.call.tsonic.core.pointerType = available({ kind: "typed-location", pointee: { type: available(0), component: {
    root: bodySource(6), path: [{ kind: "sum-arm", family, index: 0 }, { kind: "sum-arm", family, index: 1 }],
  } }, mutability: "readonly" });
  const decoded = roundtrip((shared.module), "shared inline component tree");
  const decodedCall = decoded.value.tree.statements.nodes[0].expression;
  const decodedPath = decodedCall.tsonic.core.pointerType.value.pointee.component.path;
  assert.equal(decodedPath[0].family === decodedPath[1].family, false, "inline family identity is not a declared arena identity");
  assert.equal(decodedPath[0].family.component === decodedPath[1].family.component, false, "the shared inline leaf prints twice by value");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(shared.module)), []);
});

test("HIR a genuine finite 100000-level inline component chain prints, parses and verifies iteratively", () => {
  const { module: value, call } = coreCarrier();
  let component = { root: bodySource(6), path: [] };
  for (let ordinal = 0; ordinal < 100_000; ordinal += 1)
    component = { root: bodySource(6), path: [{ kind: "sum-arm", index: 0,
      family: { origin: "authored", component, parameters: [], roles: [] } }] };
  call.tsonic.core.pointerType = available({ kind: "typed-location", pointee: { type: available(0), component }, mutability: "readonly" });
  const decoded = roundtrip((value), "100000 inline TypeComponent levels");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

test("HIR declared child-object cycles are exact-path caller defects while scalar references remain data", () => {
  const block = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  const value = moduleWith([block]);
  const context = contextFor(value);
  block.statements.nodes.push(block);

  const expected = { name: "TypeError", message: "Syntax child cycle at $.tree.statements.nodes[0].statements.nodes[0]" };
  assert.throws(() => product.printHir(value), expected);
  assert.throws(() => product.verifyHir(value, context), expected);
  const first = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  const second = syntax("Block", 0, { statements: nodeList([first]), multiLine: false });
  const pair = moduleWith([first]);
  const pairContext = contextFor(pair);
  first.statements.nodes.push(second);

  const paired = { name: "TypeError", message: "Syntax child cycle at $.tree.statements.nodes[0].statements.nodes[0].statements.nodes[0]" };
  assert.throws(() => product.printHir(pair), paired);
  assert.throws(() => product.verifyHir(pair, pairContext), paired);
  assert.throws(() => walkSyntaxTree(first, []), { name: "TypeError", message: "Syntax child cycle at $.root.statements.nodes[0].statements.nodes[0]" });
});

test("HIR detached body roots retain their original structural refusal and still obey the actual child-cycle caller law", () => {
  const value = moduleWith();
  const detached = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  value.bodies[0].root = detached;
  const context = contextFor(value);
  assert.deepStrictEqual(product.verifyHir(value, context), [
    violation("body-owner", { kind: "body", body: bodyIdentity }, "body identity, owner and actual module subtree must agree"),
    violation("body-owner", { kind: "node", node: { kind: "item", value: { owner: definitionIdentity, node: 0 } } },
      "body metadata must retain its exact owner and syntax root"),
  ]);
  const shared = syntax("EmptyStatement", 0);
  detached.statements.nodes.push(shared, shared);
  assert.deepStrictEqual(product.verifyHir(value, context), [
    violation("body-owner", { kind: "body", body: bodyIdentity }, "body identity, owner and actual module subtree must agree"),
    violation("body-owner", { kind: "node", node: { kind: "item", value: { owner: definitionIdentity, node: 0 } } },
      "body metadata must retain its exact owner and syntax root"),
  ]);
  detached.statements.nodes.length = 0;
  detached.statements.nodes.push(detached);

  const expected = { name: "TypeError", message: "Syntax child cycle at $.bodies[0].root.statements.nodes[0]" };
  assert.throws(() => product.printHir(value), expected);
  assert.throws(() => product.verifyHir(value, context), expected);
});

test("HIR numeric member keys preserve exact normalized rationals and their complete normalization opposite", () => {
  for (const [rational, expected] of [
    [{ numerator: 9007199254740993n, denominator: 2n, negativeZero: false }, []],
    [{ numerator: 0n, denominator: 1n, negativeZero: true }, []],
    [{ numerator: 2n, denominator: 4n, negativeZero: false }, [violation("literal-exact", nodeSite(2), "numeric member key must retain a normalized exact rational")]],
  ]) {
    const node = nameExpression("key");
    node.tsonic = { core: absentCore(), role: "property-name", key: available({ kind: "number", value: rational }), origins: available([]) };
    const value = (expressionModule(node));
    const decoded = roundtrip(value, "exact member key");
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), expected);
  }
});

test("HIR signed zero parent and implicit definition ordinals inside foreign body identities retain their own exact rules", () => {
  const signed = moduleWith();
  signed.tree.endOfFileToken.parent = -0;
  assert.deepStrictEqual(product.verifyHir((signed), contextFor(signed)), [
    violation("lexical-parent", nodeSite(1), "parent must be the actual syntactic parent"),
    violation("node-reference", nodeSite(1), "node must exist in the module arena"),
  ]);
  for (const ordinal of [-1, -0, 0.5, NaN, Infinity, -Infinity]) {
    const module = "M[P[%002Fproject];foreign.ts]";
    const definition = ids.encodeDefId({ module, segments: [{ name: "owner", ordinal }] });
    const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
    const declaration = syntax("VariableDeclaration", 0, { name: nameExpression("foreignLocal"), exclamationToken: null, type: null, initializer: null,
      tsonic: { ...declarationFacts(definition), declaration: { kind: "local", local: { body, local: 0 } }, declaredType: available(0), initializer: null } });
    declaration.name.tsonic = { core: absentCore(), role: "declaration-name", declaration: { kind: "local", local: { body, local: 0 } } };
    const list = syntax("VariableDeclarationList", 0, { declarations: nodeList([declaration]), tsonic: { core: absentCore(), disposal: [] } });
    const foreign = foreignModuleWith([syntax("VariableStatement", 0, { modifiers: null, declarationList: list })]);
    replaceModuleOwner(foreign, definition, body);
    foreign.bodies[0].locals = [{ id: 0, declaration: bodySource(declaration.id, body), name: "foreignLocal", role: "binding",
      checkerSlot: available(0), capturedFrom: null, mutable: true }];
    const local = { body, local: 0 };
    const node = nameExpression("foreignLocal");
    node.tsonic.resolution = { kind: "local", local };
    const value = (expressionModule(node));
    assert.deepStrictEqual(product.verifyHir(value, contextFor(value, {}, [(foreign)])), [
      violation("ordinal-domain", nodeSite(2), "definition segment ordinal must be a nonnegative safe integer other than negative zero"),
    ]);
  }
});

function declarationFacts(parent = definitionIdentity) {
  return { core: absentCore(), parent, attributes: [], memory: available(null) };
}

function declarationModule(kind) {
  const definition = `D[${moduleIdentity};item]`;
  const name = syntax("Identifier", 0, { text: "item", tsonic: { core: absentCore(), role: "declaration-name",
    declaration: { kind: "definition", definition } } });
  const metadata = { ...declarationFacts(), definition };
  let node;
  switch (kind) {
    case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration":
      node = syntax(kind, 0, { modifiers: null, name, typeParameters: null, heritageClauses: null, members: nodeList([]),
        tsonic: { ...(kind === "ClassExpression" ? expressionMetadata() : {}), ...metadata, parameters: [], heritage: [], members: [] } });
      break;
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration":
      node = syntax(kind, 0, { modifiers: null, name, typeParameters: null, type: syntax("AnyKeyword", 0, { tsonic: typeMetadata() }),
        tsonic: { ...metadata, parameters: [], type: available(0) } });
      break;
    case "EnumDeclaration":
      node = syntax(kind, 0, { modifiers: null, name, members: nodeList([]), tsonic: { ...metadata, members: [] } });
      break;
    case "ModuleDeclaration":
      node = syntax(kind, 0, { modifiers: null, asteriskToken: null, body: syntax("ModuleBlock", 0, { statements: nodeList([]) }),
        keyword: "NamespaceKeyword", name, tsonic: { ...metadata, members: [] } });
      break;
    case "ImportDeclaration": case "JSImportDeclaration": {
      const target = { target: "project", module: moduleIdentity };
      node = syntax(kind, 0, { modifiers: null, importClause: null, attributes: null, moduleSpecifier: syntax("StringLiteral", 0,
        { text: "./main.js", tokenFlags: [], tsonic: { core: absentCore(), role: "module-specifier", target: available(target) } }),
      tsonic: { ...metadata, target: available(target), bindings: [] } });
      break;
    }
    case "ExportDeclaration":
      node = syntax(kind, 0, { modifiers: null, isTypeOnly: false, exportClause: syntax("NamedExports", 0, { elements: nodeList([]) }),
        moduleSpecifier: null, attributes: null, tsonic: { ...metadata, exports: [], target: available(null) } });
      break;
    case "ExportAssignment":
      node = syntax(kind, 0, { modifiers: null, isExportEquals: false, type: null, expression: nameExpression("value"),
        tsonic: { ...metadata, exports: [], target: available(null) } });
      break;
    default: assert.fail(`not an authored declaration fixture: ${kind}`);
  }
  const value = kind === "ClassExpression" ? expressionModule(node) : moduleWith([node]);
  value.items = [{ definition, node: node.id }];
  return { value, node, definition };
}

for (const kind of ["ClassDeclaration", "ClassExpression", "InterfaceDeclaration", "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumDeclaration", "ModuleDeclaration",
  "ImportDeclaration", "JSImportDeclaration", "ExportDeclaration", "ExportAssignment"]) test(`HIR factual ${kind} data retains its owning definition and all declared fields`, () => {
  const { value } = declarationModule(kind);
  const decoded = roundtrip((value), `declaration/${kind}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
});

test("HIR declared type parameters and class heritage retain complete ordered records without substitution", () => {
  for (const kind of ["TypeAliasDeclaration", "ClassDeclaration", "ClassExpression", "InterfaceDeclaration"])
    for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]]) {
      const { value, node, definition } = declarationModule(kind);
      const parameters = Array.from({ length: count }, (_, ordinal) => {
        const declaration = `D[${moduleIdentity};item/T${ordinal}]`;
        const identity = { owner: definition, index: ordinal };
        const parameter = { identity, declaration, constraint: ordinal % 2 === 0 ? null : 0, default: ordinal % 2 === 0 ? 0 : null };
        return syntax("TypeParameter", 0, { modifiers: null, name: syntax("Identifier", 0, { text: `T${ordinal}`,
          tsonic: { core: absentCore(), role: "declaration-name", declaration: { kind: "definition", definition: declaration } } }),
        constraint: parameter.constraint === null ? null : syntax("AnyKeyword", 0, { tsonic: typeMetadata() }), expression: null,
        defaultType: parameter.default === null ? null : syntax("AnyKeyword", 0, { tsonic: typeMetadata() }),
        tsonic: { ...declarationFacts(definition), definition: declaration, parameter } });
      });
      if (reversed) parameters.reverse();
      node.typeParameters = nodeList(parameters);
      node.tsonic.parameters = parameters.map(parameter => parameter.tsonic.parameter);
      if (kind !== "TypeAliasDeclaration") {
        const clauses = Array.from({ length: count }, (_, ordinal) => {
          const expression = nameExpression(`Base${ordinal}`);
          expression.tsonic.resolution = { kind: "definition", definition: definitionIdentity, aliases: [] };
          return syntax("HeritageClause", 0, { token: ordinal % 2 === 0 ? "ExtendsKeyword" : "ImplementsKeyword", types: nodeList([
            syntax("ExpressionWithTypeArguments", 0, { expression, typeArguments: null, tsonic: { core: absentCore(), role: "heritage",
              type: available(0), definition: available(definitionIdentity) } }),
          ]) });
        });
        if (reversed) clauses.reverse();
        node.heritageClauses = nodeList(clauses);
        node.tsonic.heritage = clauses.map(clause => ({ role: clause.token === "ExtendsKeyword" ? "extends" : "implements", type: 0 }));
      }
      numberSyntaxFixture(value.tree);
      value.items = [{ definition, node: node.id }, ...parameters.map(parameter => ({ definition: parameter.tsonic.definition, node: parameter.id }))]
        .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
      const decoded = roundtrip((value), `declared parameters/${kind}/${count}/${reversed}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    }
});

test("HIR class/interface member declarations retain every supplied ordering independently of identity-sorted item entries", () => {
  for (const kind of ["ClassDeclaration", "ClassExpression", "InterfaceDeclaration"])
    for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]]) {
      const { value, node, definition } = declarationModule(kind);
      const members = Array.from({ length: count }, (_, ordinal) => {
        const member = `D[${moduleIdentity};item/field${ordinal}]`;
        return syntax(kind === "InterfaceDeclaration" ? "PropertySignature" : "PropertyDeclaration", 0, {
          modifiers: null, name: syntax("Identifier", 0, { text: `field${ordinal}`, tsonic: { core: absentCore(), role: "property-name",
            key: available({ kind: "text", value: `field${ordinal}` }), origins: available([{ kind: "declared", declaration: member }]) } }),
          postfixToken: ordinal % 2 === 0 ? null : syntax("QuestionToken", 0), type: syntax("AnyKeyword", 0, { tsonic: typeMetadata() }),
          initializer: null, tsonic: { ...declarationFacts(definition), declaration: { kind: "definition", definition: member },
            declaredType: available(0), initializer: null },
        });
      });
      if (reversed) members.reverse();
      node.members = nodeList(members);
      node.tsonic.members = members.map(member => member.tsonic.declaration.definition);
      numberSyntaxFixture(value.tree);
      value.items = [{ definition, node: node.id }, ...members.map(member => ({ definition: member.tsonic.declaration.definition, node: member.id }))]
        .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
      const decoded = roundtrip((value), `members/${kind}/${count}/${reversed}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    }
});

test("HIR candidate inference contributions preserve all five complete roles and actual declared parameter scope", () => {
  for (const type of [available(0), unavailable(), unavailable("checker-error"), unavailable("parameter-dependent")])
    for (const roles of [[], ["argument"], ["argument", "receiver", "context", "result", "type-argument"],
      ["type-argument", "result", "context", "receiver", "argument"]]) {
      const { value, node, definition } = declarationModule("ClassDeclaration");
      const declaration = `D[${moduleIdentity};item/T]`;
      const identity = { owner: definition, index: 0 };
      const parameter = syntax("TypeParameter", 0, { modifiers: null, name: syntax("Identifier", 0, { text: "T", tsonic: { core: absentCore(),
        role: "declaration-name", declaration: { kind: "definition", definition: declaration } } }), constraint: null, expression: null, defaultType: null,
      tsonic: { ...declarationFacts(definition), definition: declaration, parameter: { identity, declaration, constraint: null, default: null } } });
      node.typeParameters = nodeList([parameter]);
      node.tsonic.parameters = [parameter.tsonic.parameter];
      numberSyntaxFixture(value.tree);
      value.items = [{ definition, node: node.id }, { definition: declaration, node: parameter.id }]
        .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
      const vector = { classBindings: [{ kind: "bound", parameter: identity, type: 0 }], methodBindings: [], capturedBindings: [], selfBindings: [] };
      value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(2, { declaration: definition, appliedSignature: available(0), bindings: available(vector),
        contributions: roles.map(role => ({ parameter: identity, role, source: bodySource(node.id), component: { root: bodySource(node.id), path: [] }, type })) })] }];
      const scope = { classParameters: [identity], methodParameters: [], capturedParameters: [], selfOwners: [] };
      const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: definition, kind: "construct" })] },
        bindingScopeOf: owner => owner === definition ? scope : owner === declaration || owner === definitionIdentity ? emptyScope() : null });
      const decoded = roundtrip((value), `contributions/${roles.join("/")}/${type.kind}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, context), []);
    }
});

function functionModule(roles = ["required"], nested = false) {
  const definition = `D[${moduleIdentity};fn]`;
  const bodyId = `B[${definition};function;0]`;
  const parameters = roles.map((role, ordinal) => {
    const parameterDefinition = `D[${moduleIdentity};fn/p${ordinal}]`;
    const initializerId = role === "default" ? `B[${parameterDefinition};default-argument;0]` : null;
    const initializer = role === "default" ? nameExpression("first") : null;
    if (initializer !== null) initializer.tsonic.resolution = { kind: "local", local: { body: bodyId, local: 0 } };
    return syntax("Parameter", 0, { modifiers: null, dotDotDotToken: role === "rest" ? syntax("DotDotDotToken", 0) : null,
      name: syntax("Identifier", 0, { text: role === "this" ? "this" : `p${ordinal}`, tsonic: { core: absentCore(), role: "declaration-name",
        declaration: { kind: "definition", definition: parameterDefinition } } }), questionToken: role === "optional" ? syntax("QuestionToken", 0) : null,
      type: null, initializer, tsonic: { ...declarationFacts(definition), declaration: { kind: "definition", definition: parameterDefinition },
        declaredType: available(0), initializer: initializerId } });
  });
  const block = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  const declaration = syntax("FunctionDeclaration", 0, { modifiers: null, typeParameters: null, parameters: nodeList(parameters), type: null,
    fullSignature: null, asteriskToken: null, body: block, name: syntax("Identifier", 0, { text: "fn", tsonic: { core: absentCore(),
      role: "declaration-name", declaration: { kind: "definition", definition } } }),
    tsonic: { ...declarationFacts(), definition, parameters: [], signatures: [], body: bodyId } });
  let inner = null;
  const innerDefinition = `D[${moduleIdentity};fn/inner]`;
  const innerBodyId = `B[${innerDefinition};function;0]`;
  if (nested) {
    inner = syntax("FunctionDeclaration", 0, { modifiers: null, typeParameters: null, parameters: nodeList([]), type: null, fullSignature: null,
      asteriskToken: null, body: syntax("Block", 0, { statements: nodeList([]), multiLine: false }), name: syntax("Identifier", 0, { text: "inner",
        tsonic: { core: absentCore(), role: "declaration-name", declaration: { kind: "definition", definition: innerDefinition } } }),
      tsonic: { ...declarationFacts(definition), definition: innerDefinition, parameters: [], signatures: [], body: innerBodyId } });
    block.statements.nodes.push(inner);
  }
  const value = moduleWith([declaration]);
  const body = { body: bodyId, owner: definition, params: parameters.map((parameter, ordinal) => ({ local: ordinal,
    declaration: parameter.tsonic.declaration.definition, role: roles[ordinal], passing: "by-value", initializer: parameter.tsonic.initializer })),
  locals: parameters.map((parameter, ordinal) => ({ id: ordinal, declaration: bodySource(parameter.id), name: parameter.name.text,
    role: "parameter", checkerSlot: available(0), capturedFrom: null, mutable: false })), root: block, captures: [], scopes: [], asynchronous: false,
  generator: false, candidateLists: [], nestedBodies: inner === null ? [] : [innerBodyId] };
  value.bodies.push(body);
  value.items.push({ definition, node: declaration.id }, ...parameters.map(parameter => ({ definition: parameter.tsonic.declaration.definition, node: parameter.id })));
  const initializers = [];
  for (const parameter of parameters) if (parameter.initializer !== null) {
    const captured = { body: bodyId, local: 0 };
    const initializer = { body: parameter.tsonic.initializer, owner: parameter.tsonic.declaration.definition, params: [],
      locals: [{ id: 0, declaration: bodySource(parameters[0].id), name: parameters[0].name.text, role: "capture", checkerSlot: available(0),
        capturedFrom: captured, mutable: false }], root: parameter.initializer, captures: [captured], scopes: [], asynchronous: false,
      generator: false, candidateLists: [], nestedBodies: [] };
    initializers.push(initializer);
    value.bodies.push(initializer);
  }
  value.bodies[0].nestedBodies = [...initializers.map(initializer => initializer.body), bodyId];
  if (inner !== null) {
    const captures = parameters.map((_, local) => ({ body: bodyId, local }));
    value.bodies.push({ body: innerBodyId, owner: innerDefinition, params: [], locals: captures.map((reference, ordinal) => ({ id: ordinal,
      declaration: bodySource(parameters[ordinal].id), name: parameters[ordinal].name.text, role: "capture", checkerSlot: available(0), capturedFrom: reference,
      mutable: false })), root: inner.body, captures, scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] });
    value.items.push({ definition: innerDefinition, node: inner.id });
  }
  value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  value.bodies.sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  return { value, declaration, body, parameters, initializers, inner };
}

test("HIR parameter, default initializer and nested capture bodies retain real declaration identities and distinct roots", () => {
  for (const roles of [[], ["required"], ["required", "optional", "default", "rest"], ["this", "required", "optional", "rest"]])
    for (const nested of [false, true]) {
      const { value, body, initializers } = functionModule(roles, nested);
      const decoded = roundtrip((value), `params/${roles.join("/")}/${nested}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
      assertNodes(walkSyntaxTree(body.root, []), [body.root, ...(nested ? [body.root.statements.nodes[0], body.root.statements.nodes[0].name,
        body.root.statements.nodes[0].body] : [])], "complete original function subtree");
      for (const initializer of initializers) assert.equal(body.root === initializer.root, false, "a default initializer remains outside the body block");
    }
});

test("HIR captures name each actual enclosing local once and never fabricate an unknown owner range", () => {
  const { value, inner } = functionModule(["required", "optional"], true);
  const innerBody = value.bodies.find(body => body.body === inner.tsonic.body);
  innerBody.captures.push({ ...innerBody.captures[0] });
  const decoded = roundtrip((value), "duplicate actual enclosing capture");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
    violation("capture-owner", { kind: "body", body: innerBody.body }, "capture must name one distinct enclosing body's local"),
  ]);
  const missing = moduleWith();
  missing.bodies[0].captures = [{ body: "B[D[M[P[%002Fproject];foreign.ts];missing];function;0]", local: 0 }];
  const absent = roundtrip((missing), "unknown capture owner");
  assert.deepStrictEqual(product.verifyHir(absent.value, contextFor(absent.value)), [
    violation("capture-owner", { kind: "body", body: bodyIdentity }, "capture must name one distinct enclosing body's local"),
    violation("local-reference", { kind: "body", body: bodyIdentity }, "qualified local must exist in its named body"),
  ]);
});

test("HIR initializer write-fit keeps the actual separate default-argument value body and declaration occurrence", () => {
  const { value, parameters, initializers } = functionModule(["required", "default"]);
  const parameter = parameters[1];
  const initializer = initializers[0];
  value.checkerDiagnostics = [sourceDiagnostic()];
  value.obligations = [{ diagnostic: 0, owner: bodySource(parameter.id), obligations: [{ kind: "write-fit", ordinal: 0,
    occurrence: { body: bodyIdentity, node: parameter.id }, value: { body: initializer.body, node: initializer.root.id },
    destination: bodySource(parameter.id), destinationType: 0 }] }];
  const decoded = roundtrip((value), "actual default argument write-fit");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations[0].destination = bodySource(parameter.name.id);
  assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
    violation("obligation-complete", nodeSite(parameter.id), "write-fit obligation must retain its actual value and destination"),
    violation("obligation-complete", nodeSite(parameter.id), "root must retain each syntactically required obligation"),
  ]);
});

test("HIR a genuine nested binding default captures earlier parameters in the callable lexical environment", () => {
  const { value, body, parameters } = functionModule(["required", "required"]);
  const declaration = `D[${moduleIdentity};fn/p1/second]`;
  const initializerBody = `B[${declaration};default-argument;0]`;
  const initializer = nameExpression("first");
  initializer.tsonic.resolution = { kind: "local", local: { body: body.body, local: 0 } };
  const element = syntax("BindingElement", 0, { dotDotDotToken: null, propertyName: null,
    name: syntax("Identifier", 0, { text: "second", tsonic: { core: absentCore(), role: "declaration-name",
      declaration: { kind: "definition", definition: declaration } } }), initializer,
    tsonic: { core: absentCore(), declaration: { kind: "definition", definition: declaration }, declaredType: available(0) } });
  const omission = syntax("BindingElement", 0, { dotDotDotToken: null, propertyName: null, name: null, initializer: null,
    tsonic: { core: absentCore(), declaration: null, declaredType: available(null) } });
  parameters[1].name = syntax("ArrayBindingPattern", 0, { elements: nodeList([omission, element]),
    tsonic: { core: absentCore(), declaration: null, declaredType: available(null) } });
  numberSyntaxFixture(value.tree);
  value.items.push({ definition: declaration, node: element.id });
  value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  body.locals[0].declaration = bodySource(parameters[0].id);
  body.locals[1].declaration = bodySource(parameters[1].id);
  body.locals.push({ id: 2, declaration: bodySource(element.id), name: "second", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: false });
  value.bodies.push({ body: initializerBody, owner: declaration, params: [], locals: [{ id: 0, declaration: bodySource(parameters[0].id), name: "p0",
    role: "capture", checkerSlot: available(0), capturedFrom: { body: body.body, local: 0 }, mutable: false }], root: initializer,
  captures: [{ body: body.body, local: 0 }], scopes: [], asynchronous: false, generator: false, candidateLists: [], nestedBodies: [] });
  value.bodies.find(candidate => candidate.body === bodyIdentity).nestedBodies = [initializerBody, body.body];
  value.bodies.sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const decoded = roundtrip((value), "nested binding default lexical capture and SDK-style omission");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
});

test("HIR complete diagnostic-root syntax coverage stops at genuine nested bodies and refuses substituted sibling obligations", () => {
  const { value, body } = functionModule([]);
  const inner = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("insideLeft"), type: null, operatorToken: syntax("MinusToken", 0), right: nameExpression("insideRight"),
    tsonic: { core: absentCore(), role: "arithmetic", value: emptyValue() } });
  body.root.statements.nodes.push(syntax("ExpressionStatement", 0, { expression: inner }));
  const outer = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("outsideLeft"), type: null, operatorToken: syntax("PlusToken", 0), right: nameExpression("outsideRight"),
    tsonic: { core: absentCore(), role: "arithmetic", value: emptyValue() } });
  value.tree.statements.nodes.push(syntax("ExpressionStatement", 0, { expression: outer }));
  numberSyntaxFixture(value.tree);
  value.checkerDiagnostics = [sourceDiagnostic()];
  value.obligations = [{ diagnostic: 0, owner: bodySource(0), obligations: [{ kind: "operator", ordinal: 0,
    occurrence: { body: bodyIdentity, node: outer.id }, operator: "+", operands: [outer.left, outer.right].map(node => ({ body: bodyIdentity, node: node.id })) }] }];
  const decoded = roundtrip((value), "genuine module/body diagnostic boundary");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations = [{ kind: "operator", ordinal: 0, occurrence: { body: body.body, node: inner.id }, operator: "-",
    operands: [inner.left, inner.right].map(node => ({ body: body.body, node: node.id })) }];
  assert.deepStrictEqual(product.verifyHir((wrong), contextFor(wrong)), [
    violation("obligation-complete", nodeSite(0), "every obligation must belong to its diagnostic root"),
    violation("obligation-complete", nodeSite(0), "root must retain each syntactically required obligation"),
  ]);
});

test("HIR actual declaration passing captures preserve every closed mode on the original Parameter", () => {
  for (const mode of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
    const { value, parameters, body } = functionModule();
    parameters[0].tsonic.core.argumentPassing = available({ role: "declaration", mode });
    body.params[0].passing = mode;
    const decoded = roundtrip((value), `declaration passing/${mode}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  }
});

test("HIR callable endpoints retain advertised, API-signature and real API-body owners in both supplied orders", () => {
  for (const reversed of [false, true]) for (const count of [0, 1, 3]) {
    const { value, declaration, body } = functionModule([]);
    const roles = ["advertised", "api-signature", "api-body"].slice(0, count);
    if (reversed) roles.reverse();
    declaration.tsonic.signatures = roles.map(role => ({ declaration: body.owner, role, signature: 0, body: role === "api-body" ? body.body : null }));
    const decoded = roundtrip((value), `callable endpoints/${count}/${reversed}`);
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: body.owner })] } });
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), []);
  }
  const { value, declaration, body } = functionModule([]);
  declaration.tsonic.signatures = [{ declaration: body.owner, role: "api-body", signature: 0, body: null }];
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: body.owner })] },
  })), [violation("candidate-endpoints", nodeSite(declaration.id), "callable endpoint declaration, signature and body must agree")]);
});

test("HIR source-file scalar arms and ordered syntax/token flags roundtrip as exact captured data", () => {
  const flags = ["Let", "Const", "Using", "OptionalChain", "DisallowInContext", "YieldContext", "DecoratorContext", "AwaitContext",
    "DisallowConditionalTypesContext", "ThisNodeHasError", "JavaScriptFile", "ThisNodeOrAnySubNodesHasError", "HasJSDoc", "JSDoc", "Ambient",
    "InWithStatement", "JsonFile", "IdentifierHasExtendedUnicodeEscape", "IdentifierIsInJSDocNamespace", "NestedNamespace", "AwaitUsing"];
  const tokenFlags = ["PrecedingLineBreak", "PrecedingJSDocComment", "Unterminated", "ExtendedUnicodeEscape", "Scientific", "Octal",
    "HexSpecifier", "BinarySpecifier", "OctalSpecifier", "ContainsSeparator", "UnicodeEscape", "ContainsInvalidEscape", "HexEscape",
    "ContainsLeadingZero", "ContainsInvalidSeparator", "PrecedingJSDocLeadingAsterisks", "SingleQuote", "PrecedingJSDocWithDeprecated", "PrecedingJSDocWithSeeOrLink"];
  for (const languageVariant of ["Standard", "JSX"]) for (const scriptKind of ["Unknown", "JS", "JSX", "TS", "TSX", "External", "JSON", "Deferred"])
    for (const reversed of [false, true]) {
      const literal = syntax("StringLiteral", 0, { text: "flags", tokenFlags: reversed ? [...tokenFlags].reverse() : [...tokenFlags],
        tsonic: { core: absentCore(), role: "attribute-value", literal: { kind: "string", value: "flags" } } });
      const value = expressionModule(literal);
      value.tree.languageVariant = languageVariant;
      value.tree.scriptKind = scriptKind;
      value.tree.flags = reversed ? [...flags].reverse() : [...flags];
      const decoded = roundtrip((value), `${languageVariant}/${scriptKind}/flags/${reversed}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
    }
});

test("HIR nested closure metadata preserves actual body and captured locals for function and arrow syntax", () => {
  for (const kind of ["FunctionExpression", "ArrowFunction"]) for (const asynchronous of [false, true]) for (const generator of [false, true]) {
    const { value, body, inner, parameters } = functionModule(["required"], true);
    const innerBody = value.bodies.find(candidate => candidate.root === inner.body);
    const captures = [{ body: body.body, local: 0 }];
    const properties = { modifiers: asynchronous ? nodeList([syntax("AsyncKeyword", 0)]) : null, typeParameters: null, parameters: nodeList([]),
      type: null, fullSignature: null, asteriskToken: generator ? syntax("AsteriskToken", 0) : null, body: inner.body,
      ...(kind === "FunctionExpression" ? { name: null } : { equalsGreaterThanToken: syntax("EqualsGreaterThanToken", 0) }),
      tsonic: { ...expressionMetadata(), body: innerBody.body, captures } };
    const closure = syntax(kind, 0, properties);
    body.root.statements.nodes = [syntax("ExpressionStatement", 0, { expression: closure })];
    numberSyntaxFixture(value.tree);
    value.items = value.items.filter(item => item.definition !== innerBody.owner);
    value.items.push({ definition: innerBody.owner, node: closure.id });
    value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
    body.locals[0].declaration = bodySource(parameters[0].id);
    innerBody.locals[0].declaration = bodySource(parameters[0].id);
    innerBody.asynchronous = asynchronous;
    innerBody.generator = generator;
    const decoded = roundtrip((value), `closure/${kind}/${asynchronous}/${generator}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

test("HIR class static initializer is one real nested body owned by its own declaration", () => {
  const { value, node, definition } = declarationModule("ClassDeclaration");
  const owner = `D[${moduleIdentity};item/static]`;
  const body = `B[${owner};class-static-initializer;0]`;
  const block = syntax("Block", 0, { statements: nodeList([syntax("EmptyStatement", 0)]), multiLine: true });
  const member = syntax("ClassStaticBlockDeclaration", 0, { modifiers: nodeList([syntax("StaticKeyword", 0)]), body: block,
    tsonic: { ...declarationFacts(definition), definition: owner, body } });
  node.members = nodeList([member]);
  node.tsonic.members = [owner];
  numberSyntaxFixture(value.tree);
  value.items.push({ definition: owner, node: member.id });
  value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  value.bodies[0].nestedBodies = [body];
  value.bodies.push({ body, owner, params: [], locals: [], root: block, captures: [], scopes: [], asynchronous: false,
    generator: false, candidateLists: [], nestedBodies: [] });
  value.bodies.sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  const decoded = roundtrip((value), "class static initializer");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

test("HIR catch locals and lexical scopes retain actual declarations, outer owners and authored attribute order", () => {
  for (const present of [false, true]) for (const reversed of [false, true]) for (const count of [0, 1, 3]) {
    const local = { body: bodyIdentity, local: 0 };
    const declaration = present ? syntax("VariableDeclaration", 0, { name: syntax("Identifier", 0, { text: "error",
      tsonic: { core: absentCore(), role: "declaration-name", declaration: { kind: "local", local } } }),
      exclamationToken: null, type: null, initializer: null,
      tsonic: { ...declarationFacts(), declaration: { kind: "local", local }, declaredType: available(0), initializer: null } }) : null;
    const reference = nameExpression("error");
    if (present) reference.tsonic.resolution = { kind: "local", local };
    const block = syntax("Block", 0, { statements: nodeList([syntax("ExpressionStatement", 0, { expression: reference })]), multiLine: true });
    const clause = syntax("CatchClause", 0, { variableDeclaration: declaration, block });
    const statement = syntax("TryStatement", 0, { tryBlock: syntax("Block", 0, { statements: nodeList([]), multiLine: false }),
      catchClause: clause, finallyBlock: syntax("Block", 0, { statements: nodeList([]), multiLine: false }) });
    const value = moduleWith([statement]);
    if (present) value.bodies[0].locals = [{ id: 0, declaration: bodySource(declaration.id), name: "error", role: "catch",
      checkerSlot: available(0), capturedFrom: null, mutable: true }];
    const nodes = [reference, block, clause].slice(0, count);
    if (reversed) nodes.reverse();
    const attributes = nodes.map(node => ({ declaration: definitionIdentity, occurrence: bodySource(node.id),
      arguments: nodes.map(argument => bodySource(argument.id)) }));
    value.bodies[0].scopes = [{ node: 0, parent: null, attributes: [] }, { node: clause.id, parent: 0, attributes },
      { node: block.id, parent: clause.id, attributes: [] }];
    const decoded = roundtrip((value), `catch/${present}/${reversed}/${count}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

function foreignTypeDeclarations(count) {
  const nodes = Array.from({ length: count }, (_, ordinal) => syntax("TypeAliasDeclaration", 0, { modifiers: null,
    name: syntax("Identifier", 0, { text: `Export${ordinal}` }), typeParameters: null,
    type: syntax("AnyKeyword", 0, { tsonic: typeMetadata() }) }));
  const value = foreignModuleWith(nodes);
  for (const [ordinal, node] of nodes.entries()) {
    const definition = `D[${value.module};Export${ordinal}]`;
    node.name.tsonic = { core: absentCore(), role: "declaration-name", declaration: { kind: "definition", definition } };
    node.tsonic = { ...declarationFacts(value.tree.tsonic.definition), definition, parameters: [], type: available(0) };
    value.items.push({ definition, node: node.id });
  }
  value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  return { value, nodes };
}

test("HIR imports preserve full local/imported binding records and genuine external declarations in both orders", () => {
  for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]])
    for (const reason of [null, "checker-error", "parameter-dependent", "not-provided"]) {
      const { value, node, definition } = declarationModule("ImportDeclaration");
      const foreign = foreignTypeDeclarations(count);
      const target = { target: "project", module: foreign.value.module };
      const clauseDefinition = `D[${moduleIdentity};item/clause]`;
      const bindings = [];
      const specifiers = foreign.nodes.map((exported, ordinal) => {
        const local = `D[${moduleIdentity};item/local${ordinal}]`;
        const imported = reason === null ? available(exported.tsonic.definition) : unavailable(reason);
        const binding = { local, imported };
        bindings.push(binding);
        return syntax("ImportSpecifier", 0, { isTypeOnly: ordinal % 2 === 0,
          propertyName: syntax("StringLiteral", 0, { text: exported.name.text, tokenFlags: [],
            tsonic: { core: absentCore(), role: "export-name", definition: imported } }),
          name: syntax("Identifier", 0, { text: `Local${ordinal}`, tsonic: { core: absentCore(), role: "declaration-name",
            declaration: { kind: "definition", definition: local } } }),
          tsonic: { ...declarationFacts(definition), definition: local, target: available(target), bindings: [binding] } });
      });
      if (reversed) { specifiers.reverse(); bindings.reverse(); }
      const clause = syntax("ImportClause", 0, { phaseModifier: reason === "checker-error" ? "TypeKeyword" : reason === "parameter-dependent" ? "DeferKeyword" : null,
        name: null, namedBindings: syntax("NamedImports", 0, { elements: nodeList(specifiers) }),
        tsonic: { ...declarationFacts(definition), definition: clauseDefinition, target: available(target), bindings } });
      node.importClause = clause;
      node.moduleSpecifier.text = "./foreign.js";
      node.moduleSpecifier.tsonic.target = available(target);
      node.tsonic.target = available(target);
      node.tsonic.bindings = bindings;
      numberSyntaxFixture(value.tree);
      value.items = [{ definition, node: node.id }, { definition: clauseDefinition, node: clause.id },
        ...specifiers.map(specifier => ({ definition: specifier.tsonic.definition, node: specifier.id }))]
        .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
      const decoded = roundtrip((value), `import bindings/${count}/${reversed}/${reason}`);
      assert.deepStrictEqual(product.verifyHir(foreign.value, contextFor(foreign.value)), []);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign.value)])), []);
    }
});

test("HIR exports retain complete selected and unavailable bindings, targets and declared order", () => {
  for (const kind of ["ExportDeclaration", "ExportAssignment"]) for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]]) {
    const { value, node, definition } = declarationModule(kind);
    const foreign = foreignTypeDeclarations(count);
    const exports = foreign.nodes.map((exported, ordinal) => ({ name: `name${ordinal}`,
      definition: ordinal % 2 === 0 ? available(exported.tsonic.definition) : unavailable("parameter-dependent") }));
    if (reversed) exports.reverse();
    node.tsonic.exports = exports;
    node.tsonic.target = available({ target: "project", module: foreign.value.module });
    if (kind === "ExportDeclaration") {
      const specifiers = exports.map((exported, ordinal) => {
        const owner = `D[${moduleIdentity};item/export${ordinal}]`;
        const name = syntax("Identifier", 0, { text: exported.name, tsonic: { core: absentCore(), role: "property-name",
          key: available({ kind: "text", value: exported.name }), origins: available([]) } });
        return syntax("ExportSpecifier", 0, { isTypeOnly: ordinal % 2 === 0, propertyName: null, name,
          tsonic: { ...declarationFacts(definition), definition: owner, exports: [exported], target: node.tsonic.target } });
      });
      node.exportClause = syntax("NamedExports", 0, { elements: nodeList(specifiers) });
      numberSyntaxFixture(value.tree);
      value.items = [{ definition, node: node.id }, ...specifiers.map(specifier => ({ definition: specifier.tsonic.definition, node: specifier.id }))]
        .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
    }
    const decoded = roundtrip((value), `${kind}/exports/${count}/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign.value)])), []);
  }
});

function initializerModule(kind) {
  const initializer = nameExpression("initialValue");
  let value;
  let declaration;
  let definition;
  let role;
  if (kind === "VariableDeclaration") {
    const fixture = variableModule();
    value = fixture.value;
    declaration = fixture.declaration;
    definition = declaration.tsonic.declaration.definition;
    role = "initializer";
    declaration.initializer = initializer;
  } else {
    const container = declarationModule(kind === "PropertyDeclaration" ? "ClassDeclaration" : "EnumDeclaration");
    value = container.value;
    definition = `D[${moduleIdentity};item/member]`;
    role = kind === "PropertyDeclaration" ? "field-initializer" : "enum-member-initializer";
    const name = syntax("Identifier", 0, { text: "member", tsonic: { core: absentCore(), role: "property-name",
      key: available({ kind: "text", value: "member" }), origins: available([{ kind: "declared", declaration: definition }]) } });
    declaration = syntax(kind, 0, { modifiers: null, name, postfixToken: null, ...(kind === "PropertyDeclaration" ? { type: null } : {}), initializer,
      tsonic: { ...declarationFacts(container.definition), declaration: { kind: "definition", definition }, declaredType: available(0), initializer: null } });
    container.node.members = nodeList([declaration]);
    container.node.tsonic.members = [definition];
  }
  const body = `B[${definition};${role};0]`;
  declaration.tsonic.initializer = body;
  numberSyntaxFixture(value.tree);
  value.items = value.items.filter(item => item.definition !== definition);
  value.items.push({ definition, node: declaration.id });
  value.items.sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
  value.bodies.find(candidate => candidate.body === bodyIdentity).nestedBodies = [body];
  value.bodies.push({ body, owner: definition, params: [], locals: [], root: initializer, captures: [], scopes: [], asynchronous: false,
    generator: false, candidateLists: [], nestedBodies: [] });
  value.bodies.sort((left, right) => left.body < right.body ? -1 : left.body > right.body ? 1 : 0);
  return { value, declaration, initializer, body, definition };
}

for (const kind of ["VariableDeclaration", "PropertyDeclaration", "EnumMember"])
  test(`HIR ${kind} initializer retains its genuine separate body and complete write-fit relationship`, () => {
    const { value, declaration, initializer, body, definition } = initializerModule(kind);
    value.checkerDiagnostics = [sourceDiagnostic()];
    value.obligations = [{ diagnostic: 0, owner: bodySource(declaration.id), obligations: [{ kind: "write-fit", ordinal: 0,
      occurrence: { body: bodyIdentity, node: declaration.id }, value: { body, node: initializer.id },
      destination: { kind: "item", value: { owner: definition, node: declaration.id } }, destinationType: 0 }] }];
    const decoded = roundtrip((value), `initializer/${kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  });

test("HIR namespace members preserve genuine nested declarations and ordered identities", () => {
  for (const [count, reversed] of [[0, false], [1, false], [3, false], [3, true]]) {
    const { value, node, definition } = declarationModule("ModuleDeclaration");
    const declarations = Array.from({ length: count }, (_, ordinal) => {
      const owner = `D[${moduleIdentity};item/Type${ordinal}]`;
      return syntax("TypeAliasDeclaration", 0, { modifiers: null, name: syntax("Identifier", 0, { text: `Type${ordinal}`,
        tsonic: { core: absentCore(), role: "declaration-name", declaration: { kind: "definition", definition: owner } } }),
        typeParameters: null, type: syntax("AnyKeyword", 0, { tsonic: typeMetadata() }),
        tsonic: { ...declarationFacts(definition), definition: owner, parameters: [], type: available(0) } });
    });
    if (reversed) declarations.reverse();
    node.body.statements = nodeList(declarations);
    node.tsonic.members = declarations.map(declaration => declaration.tsonic.definition);
    numberSyntaxFixture(value.tree);
    value.items = [{ definition, node: node.id }, ...declarations.map(declaration => ({ definition: declaration.tsonic.definition, node: declaration.id }))]
      .sort((left, right) => left.definition < right.definition ? -1 : left.definition > right.definition ? 1 : 0);
    const decoded = roundtrip((value), `namespace/${count}/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

test("HIR data-layout facts retain both byte orders, address widths and unavailable captured inputs", () => {
  for (const byteOrder of ["little", "big"]) for (const addressWidth of [32, 64])
    for (const reason of [null, "checker-error", "parameter-dependent", "not-provided"]) {
      const expression = callExpression();
      const value = expressionModule(expression);
      const capture = layoutCapture("data-layout");
      capture.byteOrder = reason === null ? available(byteOrder) : unavailable(reason);
      capture.addressWidth = reason === null ? available(addressWidth) : unavailable(reason);
      capture.fingerprint = reason === null ? available("supplied layout fingerprint") : unavailable(reason);
      capture.declaration = reason === null ? available(definitionIdentity) : unavailable(reason);
      expression.tsonic.memory = available(capture);
      const decoded = roundtrip((value), `data-layout/${byteOrder}/${addressWidth}/${reason}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
    }
});

test("HIR raw geometry and array extents preserve each captured availability without inventing native validation", () => {
  for (const runtimeBase of ["number", "bigint"]) for (const length of [0n, 1n, 3n])
    for (const reason of [null, "checker-error", "parameter-dependent", "not-provided"]) {
      const expression = callExpression();
      const value = expressionModule(expression);
      const capture = layoutCapture("array");
      capture.runtimeBase = reason === null ? available(runtimeBase) : unavailable(reason);
      capture.length = reason === null ? available(length) : unavailable(reason);
      for (const field of ["source", "dataLayout", "byteSize", "byteAlignment", "stride"])
        if (reason !== null) capture.geometry[field] = unavailable(reason);
      for (const field of ["dataLayoutExpression", "byteSizeExpression", "byteAlignmentExpression", "strideExpression"])
        capture.geometry[field] = bodySource(expression.expression.id);
      capture.extentExpression = bodySource(expression.expression.id);
      capture.elementExpression = bodySource(expression.expression.id);
      expression.tsonic.memory = available(capture);
      const decoded = roundtrip((value), `array facts/${runtimeBase}/${length}/${reason}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
    }
});

test("HIR field primary selection belongs to its genuine supplied declaration group", () => {
  for (const missing of [false, true]) {
    const expression = callExpression();
    const value = expressionModule(expression);
    const capture = layoutCapture("field");
    capture.selectedDeclarations = available(missing ? [] : [definitionIdentity]);
    expression.tsonic.memory = available(capture);
    const decoded = roundtrip((value), `field primary/${missing}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), missing ? [
      violation("memory-capture-reference", nodeSite(2), "primary field declaration must belong to its selected declaration group"),
    ] : []);
  }
});

test("HIR attribute selection compares actual qualified node identity across body and item reference arms", () => {
  for (const missing of [false, true]) {
    const { module: value, call } = coreCarrier();
    call.tsonic.core.attribute = available({ occurrence: bodySource(2), applicationTarget: bodySource(6), selectedMember: {
      selectedDeclaration: { kind: "item", value: { owner: definitionIdentity, node: 3 } }, declarations: [bodySource(missing ? 6 : 3)],
    }, applicationMemberKind: "method", applicationPlacement: "declaration", applicationParameterName: null,
    applicationTargetSpecifier: null, kind: "builder-state" });
    const decoded = roundtrip((value), `selected group/${missing}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), missing ? [
      violation("core-capture-reference", nodeSite(2), "attribute selected declaration must belong to its declaration group"),
    ] : []);
  }
});

for (const givenKind of ["body", "item"]) for (const selectedKind of ["body", "item"])
  for (const selection of ["same", "different-node", "different-arena", "missing-given", "missing-selected"])
    test(`HIR fresh foreign selected members preserve ${givenKind}/${selectedKind} identity for ${selection}`, () => {
      const invocation = callExpression();
      const sibling = callExpression();
      const foreign = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: invocation }),
        syntax("ExpressionStatement", 0, { expression: sibling })]);
      const otherInvocation = callExpression();
      const other = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: otherInvocation })], "other.ts");
      let given = referenceIn(foreign, invocation.expression, givenKind);
      let selected = selection === "different-node" ? referenceIn(foreign, sibling.expression, selectedKind) :
        selection === "different-arena" ? referenceIn(other, otherInvocation.expression, selectedKind) :
          referenceIn(foreign, invocation.expression, selectedKind);
      if (selection === "missing-given") given = { kind: given.kind, value: { ...given.value, node: 99 } };
      if (selection === "missing-selected") selected = { kind: selected.kind, value: { ...selected.value, node: 99 } };
      assert.equal(invocation.expression.id === otherInvocation.expression.id, true, "the different-arena opposite deliberately retains the same numeric ordinal");
      const { module: value, call } = coreCarrier();
      call.tsonic.core.attribute = available({ occurrence: referenceIn(foreign, invocation, givenKind), applicationTarget: bodySource(6),
        selectedMember: { declarations: [given], selectedDeclaration: selected }, applicationMemberKind: "method",
        applicationPlacement: "declaration", applicationParameterName: null, applicationTargetSpecifier: null, kind: "builder-state" });
      const decoded = roundtrip((value), `fresh selected member/${givenKind}/${selectedKind}/${selection}`);
      const expected = [];
      if (selection === "missing-given" || selection === "missing-selected") {
        const missingKind = selection === "missing-given" ? givenKind : selectedKind;
        expected.push(violation("cross-owner-qualified", nodeSite(2), `qualified ${missingKind} node must exist in its named owner`),
          violation("core-capture-reference", nodeSite(2), "Core capture reference must retain an existing qualified source node"));
      }
      if (selection !== "same") expected.push(violation("core-capture-reference", nodeSite(2),
        "attribute selected declaration must belong to its declaration group"));
      assert.deepStrictEqual(product.verifyHir(decoded.value, freshContextFor(decoded.value, [(foreign), (other)])), expected);
    });

for (const foreignFirst of [false, true])
  test(`HIR mixed local and fresh foreign selected members keep actual distinct arenas in ${foreignFirst ? "foreign-first" : "local-first"} order`, () => {
    const invocation = callExpression();
    const foreign = foreignModuleWith([syntax("ExpressionStatement", 0, { expression: invocation })]);
    const remote = referenceIn(foreign, invocation.expression);
    const local = bodySource(3);
    const { module: value, call } = coreCarrier();
    call.tsonic.core.attribute = available({ occurrence: bodySource(2), applicationTarget: bodySource(6),
      selectedMember: { declarations: [foreignFirst ? remote : local], selectedDeclaration: foreignFirst ? local : remote },
      applicationMemberKind: "method", applicationPlacement: "declaration", applicationParameterName: null,
      applicationTargetSpecifier: null, kind: "builder-state" });
    const decoded = roundtrip((value), `local/foreign membership/${foreignFirst}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, freshContextFor(decoded.value, [(foreign)])), [
      violation("core-capture-reference", nodeSite(2), "attribute selected declaration must belong to its declaration group"),
    ]);
  });

test("HIR origins retain every supplied lowering pass and expansion derivation in authored order", () => {
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness", "initialization",
    "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"];
  const derivations = [...passes.map(pass => ({ kind: "lowering", pass })), { kind: "expansion", expansion: "supplied-expansion-0" }];
  for (const values of [[], [derivations[0]], derivations, [...derivations].reverse()]) {
    const value = moduleWith();
    value.tree.origin.derived = values;
    const decoded = roundtrip((value), `complete derivations/${values.length}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

for (const escaped of ["\\u0058", "\\t"])
  test(`HIR escaped script-kind domain refuses the complete decoded ${escaped} before any later field`, () => {
    const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
    const invalid = original.replace('scriptKind="TS"', `scriptKind="${escaped}"`);
    assertInvalidText(invalid, invalid.indexOf("scriptKind=") + "scriptKind=".length, ["declared field value"]);
    const valid = original.replace('scriptKind="TS"', 'scriptKind="\\u0054S"');
    assertComplete(product.parseHir(valid), { kind: "parsed", value: moduleWith() }, "complete escaped TS value");
  });

test("HIR generic SyntaxNode child accepts its complete declared object but not a scalar token", () => {
  const child = syntax("EmptyStatement", 0);
  const value = (constructorModule(syntax("SyntaxList", 0, { children: [child] })));
  const decoded = roundtrip(value, "generic SyntaxNode child");
  const declaration = decoded.text.indexOf("=SyntaxList(");
  const start = decoded.text.indexOf("children=[", declaration) + "children=[".length;
  const end = decoded.text.indexOf("]", start);
  assert.equal(declaration >= 0 && start > declaration && end > start, true, "the scalar opposite belongs to the real children field");
  const invalid = `${decoded.text.slice(0, start)}true${decoded.text.slice(end)}`;
  assertInvalidText(invalid, start, ["SyntaxNode"]);
});

test("HIR raw identity carriers and missing colon retain their distinct complete first-error domains", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const moduleToken = `mod:"${moduleIdentity}"`;
  for (const [before, after, marker, expected] of [
    [moduleToken, "true", "module=true", ["ModuleId"]],
    [moduleToken, `"${moduleIdentity}"`, `module="${moduleIdentity}"`, ["mod:identity"]],
    [moduleToken, `mod "${moduleIdentity}"`, `module=mod "${moduleIdentity}"`, [":"]],
    ["id=n:0", 'id="0"', 'id="0"', ["NodeId"]],
    ["id=n:0", "id=0", "id=0", ["n:identity"]],
    ["id=n:0", "id=n:01", "id=n:01", ["canonical finite number"]],
  ]) {
    const text = original.replace(before, after);
    const start = text.indexOf(marker) + (marker.startsWith("module=") ?
      after.startsWith("mod ") ? "module=mod ".length : "module=".length :
      after.startsWith("id=n:") ? "id=n:".length : "id=".length);
    assertInvalidText(text, start, expected);
  }
  assertComplete(product.parseHir(original), { kind: "parsed", value: moduleWith() }, "complete prefixed identities");
});

for (const number of ["-1", "-0", "NaN", "+Infinity", "0.5", "9007199254740992"])
  test(`HIR arbitrary wire root ${number} reports its actual reference position without semantic renumbering`, () => {
    const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
    const invalid = original.replace("tree=n:0", `tree=n:${number}`);
    assertInvalidText(invalid, invalid.indexOf("tree=") + "tree=".length, ["SourceFile"]);
    assertComplete(product.parseHir(original), { kind: "parsed", value: moduleWith() }, "complete canonical wire root");
  });

for (const quoted of [false, true])
  test(`HIR complete attribute prior-name prefix duplicate chooses its ${quoted ? "closing quote" : "equals"} position`, () => {
    const row = coreArmInputs().find(input => input.field === "attribute" && input.name === "builder-state");
    assert.equal(row !== undefined, true, "the actual closed attribute family supplies the complete public input");
    const { module: value, call } = coreCarrier();
    call.tsonic.core.attribute = available(row.value);
    const decoded = roundtrip((value), "complete attribute prefix-duplicate opposite");
    const start = decoded.text.indexOf("applicationTargetSpecifier=");
    assert.equal(start >= 0, true);
    const replacement = quoted ? '"applicationTarget"' : "applicationTarget";
    const invalid = `${decoded.text.slice(0, start)}${replacement}${decoded.text.slice(start + "applicationTargetSpecifier".length)}`;
    assertInvalidText(invalid, start + (quoted ? replacement.length - 1 : replacement.length), ["unique record field"]);
  });

for (const foreignDeclaration of [false, true])
  test(`HIR declaration module ownership retains the complete ${foreignDeclaration ? "foreign" : "local"} item vector`, () => {
    const value = moduleWith();
    const foreign = foreignModuleWith([]);
    const definition = foreignDeclaration ? foreign.tree.tsonic.definition : definitionIdentity;
    value.items = [{ definition, node: ids.nodeId(0) }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {}, [(foreign)])), foreignDeclaration ? [
      violation("module-owner", { kind: "definition", definition }, "definition must belong to this module"),
      violation("definition-reference", { kind: "definition", definition }, "declaration entry must match its actual node definition"),
    ] : []);
  });

for (const missing of [false, true])
  test(`HIR declaration node ${missing ? "absence" : "presence"} retains both complete owning reports`, () => {
    const value = moduleWith();
    value.items = [{ definition: definitionIdentity, node: ids.nodeId(missing ? 99 : 0) }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("node-reference", { kind: "definition", definition: definitionIdentity }, "definition node does not exist"),
      violation("node-reference", { kind: "module", module: moduleIdentity }, "node must exist in the module arena"),
    ] : []);
  });

for (const missing of [false, true])
  test(`HIR declaration parent ${missing ? "missing from inventory" : "present as module root"} keeps exact path and holder outcomes`, () => {
    const { value, node } = declarationModule("TypeAliasDeclaration");
    const parent = ids.encodeDefId({ module: value.module, segments: [{ name: "Outer", ordinal: 0 }] });
    const definition = ids.encodeDefId({ module: value.module, segments: [{ name: "Outer", ordinal: 0 }, { name: "Inner", ordinal: 0 }] });
    node.tsonic.definition = definition;
    node.tsonic.parent = missing ? parent : definitionIdentity;
    node.name.tsonic.declaration = { kind: "definition", definition };
    value.items = [{ definition, node: node.id }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("definition-parent", { kind: "definition", definition }, "declaration parent must exist in this module"),
      violation("definition-reference", nodeSite(node.id), "definition must exist in the canonical declaration inventory"),
    ] : []);
  });

for (const extra of [false, true])
  test(`HIR direct nested body vector ${extra ? "extra retained root" : "actual empty roots"} is independently complete`, () => {
    const value = moduleWith();
    value.bodies[0].nestedBodies = extra ? [bodyIdentity] : [];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), extra ? [
      violation("body-owner", { kind: "body", body: bodyIdentity }, "nested bodies must be the actual direct body roots in preorder"),
    ] : []);
  });

for (const missing of [false, true])
  test(`HIR enclosing capture ${missing ? "missing local" : "actual local"} reports every retained capturedFrom holder`, () => {
    const { value, inner } = functionModule(["required"], true);
    const body = value.bodies.find(candidate => candidate.body === inner.tsonic.body);
    assert.equal(body !== undefined, true);
    const local = ids.localId(missing ? 99 : 0);
    body.captures[0].local = local;
    body.locals[0].capturedFrom.local = local;
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("local-reference", { kind: "body", body: body.body }, "capture local does not exist in its named body"),
      violation("local-reference", { kind: "body", body: body.body }, "qualified local must exist in its named body"),
      violation("local-reference", { kind: "body", body: body.body }, "qualified local must exist in its named body"),
    ] : []);
  });

for (const missing of [false, true])
  test(`HIR actual scope ${missing ? "missing node" : "module node"} retains both body and reference domains`, () => {
    const value = moduleWith();
    value.bodies[0].scopes = [{ node: ids.nodeId(missing ? 99 : 0), parent: null, attributes: [] }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("node-reference", { kind: "body", body: bodyIdentity }, "scope must name a node of this body"),
      violation("node-reference", { kind: "body", body: bodyIdentity }, "node must exist in the module arena"),
    ] : []);
  });

for (const role of ["this", "rest"])
  test(`HIR complete parameter ${role} ordering checks its actual position without dropping parameter locals`, () => {
    for (const invalid of [false, true]) {
      const { value, body } = functionModule(["required", "required"]);
      body.params[role === "this" ? invalid ? 1 : 0 : invalid ? 0 : 1].role = role;
      assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
        violation("parameter-order", { kind: "body", body: body.body }, "this must be first and rest must be last"),
      ] : []);
    }
  });

for (const invalid of [false, true])
  test(`HIR parameter initializer ${invalid ? "existing wrong body" : "actual null"} is a complete retained owner comparison`, () => {
    const { value, body } = functionModule(["required"]);
    body.params[0].initializer = invalid ? bodyIdentity : null;
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
      violation("body-owner", { kind: "body", body: body.body }, "parameter initializer must be its own default-argument body"),
    ] : []);
  });

for (const invalid of [false, true])
  test(`HIR iteration protocol keeps its real ${invalid ? "spread and asynchronous mismatch" : "iterate and synchronous"} union data`, () => {
    const { value, statement } = iterationModule("ForInStatement", false);
    statement.tsonic.protocol = available({ kind: invalid ? "spread" : "iterate", asynchronous: invalid, subject: statement.expression.id,
      iterator: ids.tyId(0), element: ids.tyId(0), completion: ids.tyId(0), sent: ids.tyId(0), next: ids.sigId(0), finish: null, fail: null });
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature()] } });
    assert.deepStrictEqual(product.verifyHir((value), context), invalid ? [
      violation("protocol-kind", nodeSite(statement.id), "protocol must match its syntactic operation"),
      violation("protocol-kind", nodeSite(statement.id), "iteration protocol must retain authored asynchronous mode"),
    ] : []);
  });

for (const invalid of [false, true])
  test(`HIR actual candidate applied signature ${invalid ? "NaN scalar data" : "existing zero"} uses its own table domain`, () => {
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: ids.candidateListId(0), candidates: [candidate(0,
      { appliedSignature: available(ids.sigId(invalid ? NaN : 0)) })] }];
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature()] } });
    assert.deepStrictEqual(product.verifyHir((value), context), invalid ? [
      violation("signature-reference", { kind: "body", body: bodyIdentity }, "signature must exist in the supplied table"),
    ] : []);
  });

for (const invalid of [false, true])
  test(`HIR genuinely bodyless callable retains the complete ${invalid ? "inconsistent body" : "null body"} result`, () => {
    const { value, node, definition } = declarationModule("InterfaceDeclaration");
    const callable = ids.encodeDefId({ module: value.module, segments: [{ name: "item", ordinal: 0 }, { name: "call", ordinal: 0 }] });
    const member = syntax("CallSignature", 0, { typeParameters: null, parameters: nodeList([]), type: null, fullSignature: null,
      tsonic: { ...declarationFacts(definition), definition: callable, parameters: [], signatures: [], body: invalid ? bodyIdentity : null } });
    node.members.nodes.push(member);
    numberSyntaxFixture(value.tree);
    value.items = [{ definition, node: node.id }, { definition: callable, node: member.id }]
      .sort((left, right) => Number(left.definition > right.definition) - Number(left.definition < right.definition));
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
      violation("body-owner", nodeSite(member.id), "body metadata must retain its exact owner and syntax root"),
    ] : []);
  });

for (const invalid of [false, true])
  test(`HIR required nullable initializer property retains the complete ${invalid ? "wrong captured body" : "null fact"} comparison`, () => {
    const { value, parameters } = functionModule(["required"]);
    parameters[0].tsonic.initializer = invalid ? bodyIdentity : null;
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
      violation("body-owner", nodeSite(parameters[0].id), "initializer body must retain its actual syntax initializer"),
    ] : []);
  });

for (const invalid of [false, true])
  test(`HIR callable advertised signature ${invalid ? "invalid numeric data" : "actual row"} preserves all real endpoint fields`, () => {
    const { value, declaration } = functionModule([]);
    declaration.tsonic.signatures = [{ role: "advertised", declaration: declaration.tsonic.definition,
      body: null, signature: ids.sigId(invalid ? NaN : 0) }];
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }],
      signatures: [signature({ declaration: declaration.tsonic.definition })] } });
    assert.deepStrictEqual(product.verifyHir((value), context), invalid ? [
      violation("signature-reference", nodeSite(declaration.id), "signature must exist in the supplied table"),
    ] : []);
  });

for (const foreignOwner of [false, true])
  test(`HIR diagnostic root ${foreignOwner ? "foreign qualified owner" : "actual local owner"} preserves the complete association vector`, () => {
    const value = moduleWithObligation();
    const foreign = foreignModuleWith([]);
    const reference = bodySource(foreign.tree.id, foreign.bodies[0].body);
    if (foreignOwner) value.obligations[0].owner = reference;
    const site = { kind: "node", node: reference };
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value, {}, [(foreign)])), foreignOwner ? [
      violation("diagnostic-root-owner", site, "diagnostic root must be an existing node in this module"),
      violation("obligation-complete", site, "every obligation must belong to its diagnostic root"),
    ] : []);
  });

for (const missing of [false, true])
  test(`HIR obligation ${missing ? "missing occurrence" : "actual index occurrence"} retains final syntactic completeness`, () => {
    const value = moduleWithObligation();
    value.obligations[0].obligations[0].occurrence.node = ids.nodeId(missing ? 99 : 2);
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("cross-owner-qualified", { kind: "module", module: moduleIdentity }, "qualified body node must exist in its named owner"),
      violation("obligation-complete", nodeSite(2), "every obligation must belong to its diagnostic root"),
      violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
    ] : []);
  });

for (const outside of [false, true])
  test(`HIR contextual write-fit ${outside ? "outside value" : "actual occurrence value"} checks the retained subtree without semantic eligibility replay`, () => {
    const expression = nameExpression("contextual");
    const value = expressionModule(expression);
    value.checkerDiagnostics = [sourceDiagnostic()];
    value.obligations = [{ diagnostic: 0, owner: bodySource(expression.id), obligations: [{ kind: "write-fit", ordinal: 0,
      occurrence: { body: bodyIdentity, node: expression.id }, value: { body: bodyIdentity, node: ids.nodeId(outside ? 0 : expression.id) },
      destination: bodySource(expression.id), destinationType: ids.tyId(0) }] }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), outside ? [
      violation("obligation-complete", nodeSite(expression.id), "write-fit value must belong to its actual occurrence subtree"),
    ] : []);
  });

for (const numerator of [0n, -1n, 1n])
  test(`HIR internally normalized numeric fact ${numerator} still agrees with its nonzero authored token`, () => {
    const expression = syntax("NumericLiteral", 0, { text: "1", tokenFlags: [], tsonic: { core: absentCore(), role: "value",
      value: emptyValue(), literal: { kind: "number", token: "1", value: { numerator, denominator: 1n, negativeZero: false } } } });
    const value = expressionModule(expression);
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), numerator === 1n ? [] : [
      violation("literal-exact", nodeSite(expression.id), "literal must preserve its normalized exact authored value"),
    ]);
  });

for (const [operator, operandKind, token, integer, valid] of [
  ["PlusToken", "BigIntLiteral", "2n", 2n, true], ["MinusToken", "BigIntLiteral", "2n", -2n, true],
  ["PlusToken", "BigIntLiteral", "2n", 1n, false], ["MinusToken", "BigIntLiteral", "2n", -3n, false],
  ["PlusToken", "NumericLiteral", "1e1", 10n, false], ["MinusToken", "Identifier", "operand", -2n, false],
  ["TildeToken", "BigIntLiteral", "2n", -2n, false],
]) test(`HIR unary bigint correlation retains the full ${operator}/${operandKind}/${integer} outcome`, () => {
  const operand = operandKind === "Identifier" ? nameExpression(token) : syntax(operandKind, 0, { text: token, tokenFlags: [],
    tsonic: { core: absentCore(), role: "type-literal", type: unavailable(), literal: operandKind === "BigIntLiteral" ?
      { kind: "bigint", value: 2n } : { kind: "number", value: { numerator: 10n, denominator: 1n, negativeZero: false } } } });
  const unary = syntax("PrefixUnaryExpression", 0, { operator, operand,
    tsonic: { core: absentCore(), role: "type-literal", type: unavailable(), literal: { kind: "bigint", value: integer } } });
  const value = expressionModule(unary);
  roundtrip(value, "the complete unary bigint metadata before semantic verification");
  assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), valid ? [] : [
    violation("literal-exact", nodeSite(unary.id), "unary literal must preserve the actual operand and sign"),
  ]);
});

test("HIR a real lower signature owner invokes both canonical node readers while preserving the complete binding failure", () => {
  for (const ownerNode of [0, 99]) for (const missing of [false, true]) {
    const { foreign, definitions, scopes } = genericCandidateFixture(1);
    const definition = definitions[0];
    const value = moduleWith();
    const bindings = { classBindings: missing ? [] : [{ kind: "rigid", parameter: { owner: definition, index: 0 } }],
      methodBindings: [], capturedBindings: [], selfBindings: [{ kind: "rigid", owner: definition }] };
    value.bodies[0].candidateLists = [{ id: ids.candidateListId(0), candidates: [candidate(0,
      { declaration: definition, bindings: available(bindings) })] }];
    const actualScopes = new Map([...scopes, [definitionIdentity, emptyScope()]]);
    const context = contextFor(value, { bindingScopeOf: owner => actualScopes.get(owner) ?? null,
      types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ owner: bodySource(ids.nodeId(ownerNode)) })] } }, [foreign]);
    assert.deepStrictEqual(product.verifyHir((value), context), missing ? [{
      rule: "binding-vector-complete", site: { kind: "body", body: bodyIdentity },
      detail: [{ kind: "text", value: "classBindings" }, { kind: "text", value: "complete" }, { kind: "text", value: "length" }, { kind: "number", value: 0 }],
    }] : []);
  }
});

for (const invalid of [false, true])
  test(`HIR actual owner-issued argument source ${invalid ? "negative node data" : "existing argument"} retains both qualified and Core reports`, () => {
    const { module: value, call } = coreCarrier();
    call.tsonic.core.argumentPassing = available({ role: "argument", mode: "by-value",
      storageExpression: bodySource(ids.nodeId(invalid ? -1 : 6)) });
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
      violation("cross-owner-qualified", nodeSite(call.id), "qualified body node must exist in its named owner"),
      violation("core-capture-reference", nodeSite(call.id), "Core capture reference must retain an existing qualified source node"),
    ] : []);
  });

for (const local of [-1, -0, 0])
  test(`HIR actual LocalId ${Object.is(local, -0) ? "-0" : local} is data before local-reference validation`, () => {
    const expression = nameExpression();
    const value = expressionModule(expression);
    expression.tsonic.resolution = { kind: "local", local: { body: bodyIdentity, local: ids.localId(local) } };
    value.bodies[0].locals = [{ id: ids.localId(0), declaration: bodySource(expression.id), name: "value", role: "binding",
      checkerSlot: available(ids.tyId(0)), capturedFrom: null, mutable: true }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), local === 0 && !Object.is(local, -0) ? [] : [
      violation("local-reference", nodeSite(expression.id), "qualified local must exist in its named body"),
    ]);
  });

for (const missing of [false, true])
  test(`HIR write-fit destination ${missing ? "missing actual node" : "actual left operand"} reaches the nullable local-node wrapper`, () => {
    const expression = syntax("BinaryExpression", 0, { modifiers: null, left: nameExpression("destination"), type: null,
      operatorToken: syntax("EqualsToken", 0), right: nameExpression("source"),
      tsonic: { core: absentCore(), role: "assignment", value: emptyValue(), target: unavailable() } });
    const value = expressionModule(expression);
    value.checkerDiagnostics = [sourceDiagnostic()];
    value.obligations = [{ diagnostic: 0, owner: bodySource(expression.id), obligations: [{ kind: "write-fit", ordinal: 0,
      occurrence: { body: bodyIdentity, node: expression.id }, value: { body: bodyIdentity, node: expression.right.id },
      destination: bodySource(ids.nodeId(missing ? 999 : expression.left.id)), destinationType: ids.tyId(0) }] }];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), missing ? [
      violation("cross-owner-qualified", { kind: "module", module: moduleIdentity }, "qualified body node must exist in its named owner"),
      violation("obligation-complete", nodeSite(expression.id), "write-fit obligation must retain its actual value and destination"),
      violation("obligation-complete", nodeSite(expression.id), "root must retain each syntactically required obligation"),
    ] : []);
  });

for (const qualifier of ["body", "item"])
  test(`HIR existing local root with the wrong ${qualifier} qualifier cannot borrow that other owner's inventory`, () => {
    for (const invalid of [false, true]) {
      const { value, body } = functionModule(["required"]);
      const reference = qualifier === "body" ? bodySource(ids.nodeId(0), invalid ? body.body : bodyIdentity) :
        { kind: "item", value: { owner: invalid ? body.owner : definitionIdentity, node: ids.nodeId(0) } };
      value.tree.tsonic.core.argumentPassing = available({ role: "argument", mode: "by-value", storageExpression: reference });
      assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
        violation("cross-owner-qualified", nodeSite(0), qualifier === "body" ?
          "qualified body node must exist in its named owner" : "qualified item node must exist in its named owner"),
        violation("core-capture-reference", nodeSite(0), "Core capture reference must retain an existing qualified source node"),
      ] : []);
    }
  });

for (const invalid of [false, true])
  test(`HIR parameter collector ${invalid ? "other actual declaration" : "actual Parameter declaration"} keeps genuine public inputs`, () => {
    const { value, body } = functionModule(["required"]);
    if (invalid) body.params[0].declaration = definitionIdentity;
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), []);
  });

for (const altered of ["none", "root", "metadata"])
  test(`HIR default initializer ${altered} keeps exact source and lexical-environment ownership`, () => {
    const { value, parameters, initializers } = functionModule(["required", "default"]);
    const parameter = parameters[1];
    const initializer = initializers[0];
    initializer.locals = [];
    initializer.captures = [];
    if (altered === "root") initializer.root = parameter.name;
    if (altered === "metadata") parameter.tsonic.initializer = bodyIdentity;
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), altered === "none" ? [] : [
      violation("body-owner", nodeSite(parameter.id), "initializer body must retain its actual syntax initializer"),
    ]);
  });

for (const omitted of [false, true])
  test(`HIR ${omitted ? "omitted body vector" : "published actual module body"} retains both ITEM-qualified metadata holders`, () => {
    const value = moduleWith();
    if (omitted) value.bodies = [];
    const site = { kind: "node", node: { kind: "item", value: { owner: definitionIdentity, node: ids.nodeId(0) } } };
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), omitted ? [
      violation("body-owner", site, "body must exist in this module"),
      violation("body-owner", site, "body metadata must retain its exact owner and syntax root"),
    ] : []);
  });

for (const contradictory of [false, true])
  test(`HIR public lexical ${contradictory ? "self-parent" : "actual parent"} facts terminate without a syntax child cycle`, () => {
    const { value, declaration, body, parameters, initializers } = functionModule(["default"]);
    const parameter = parameters[0];
    const initializer = initializers[0];
    initializer.params = body.params.map(row => ({ ...row }));
    initializer.locals = body.locals.map(row => ({ ...row }));
    initializer.captures = [];
    if (contradictory) {
      parameter.tsonic.parent = parameter.tsonic.declaration.definition;
      declaration.tsonic.body = initializer.body;
    }
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), contradictory ? [
      violation("definition-parent", { kind: "definition", definition: parameter.tsonic.declaration.definition },
        "declaration parent must be a proper definition path prefix"),
      violation("body-owner", nodeSite(declaration.id), "body metadata must retain its exact owner and syntax root"),
    ] : []);
  });

for (const [index, present] of [[null, false], [0, true], [-1, false], [0.5, false], [NaN, false], [99, false], [0, false]])
  test(`HIR unresolved checker index ${index}/${present} keeps the exact complete diagnostic-reference outcome`, () => {
    const expression = nameExpression();
    expression.tsonic.resolution = { kind: "unresolved", checkerDiagnostic: index };
    const value = expressionModule(expression);
    value.checkerDiagnostics = present ? [sourceDiagnostic()] : [];
    assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), index === null || index === 0 && present ? [] : [
      violation("diagnostic-reference", nodeSite(expression.id), "unresolved resolution must name an existing checker diagnostic"),
    ]);
  });

for (const cyclic of [false, true])
  test(`HIR actual place ${cyclic ? "active cycle" : "completed shared target"} keeps one complete graph result`, () => {
    const expressions = [nameExpression("first"), nameExpression("second"), nameExpression("shared")];
    const value = moduleWith(expressions.map(expression => syntax("ExpressionStatement", 0, { expression })));
    for (const [index, expression] of expressions.entries()) {
      const place = rootPlace();
      if (index < 2) place.base = { kind: "place", node: expressions[cyclic && index === 0 ? 0 : 2].id };
      expression.tsonic.value.place = available(place);
    }
    const decoded = roundtrip((value), `place completion/${cyclic}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), cyclic ? [
      violation("place-base-acyclic", nodeSite(expressions[0].id), "place base chain must not revisit a place"),
    ] : []);
  });

for (const holder of ["none", "own", "target"])
  test(`HIR both actual assignment place holders retain the full ${holder} self-base outcome`, () => {
    const left = nameExpression("destination");
    const expression = syntax("BinaryExpression", 0, { modifiers: null, left, type: null, operatorToken: syntax("EqualsToken", 0),
      right: nameExpression("source"), tsonic: { core: absentCore(), role: "assignment", value: emptyValue(), target: unavailable() } });
    const value = expressionModule(expression);
    const own = rootPlace();
    const target = rootPlace();
    if (holder === "own") own.base = { kind: "place", node: left.id };
    if (holder === "target") target.base = { kind: "place", node: left.id };
    left.tsonic.value.place = available(own);
    expression.tsonic.target = available(target);
    const decoded = roundtrip((value), `two retained place holders/${holder}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), holder === "none" ? [] : [
      violation("place-base-acyclic", nodeSite(left.id), "place base chain must not revisit a place"),
    ]);
  });

for (const endpoint of ["actual-value", "null-metadata", "no-memory", "unavailable"])
  test(`HIR descriptor endpoint ${endpoint} uses genuine checked node metadata rather than an invented lookup result`, () => {
    const { value, foreign, expressions, references, expression, array } = foreignMemoryFixture();
    let targetModule = foreign;
    let reference = references[0];
    if (endpoint === "null-metadata") reference = referenceIn(foreign, foreign.tree.endOfFileToken);
    if (endpoint === "unavailable") expressions[0].tsonic.memory = unavailable("checker-error");
    if (endpoint === "no-memory") {
      const { statement } = iterationModule("ForInStatement", false);
      targetModule = foreignModuleWith([statement], "protocol.ts");
      reference = referenceIn(targetModule, statement);
    }
    array.element = available(reference);
    const decoded = roundtrip((value), `descriptor endpoint/${endpoint}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(targetModule)])), endpoint === "actual-value" ? [] : [
      violation("memory-capture-reference", nodeSite(expression.id), "layout edge must name the required captured descriptor kind"),
    ]);
  });

for (const reason of [null, "not-provided", "checker-error", "parameter-dependent"])
  test(`HIR value-layout field availability ${reason} remains complete captured data and is not fabricated empty`, () => {
    const expression = callExpression();
    const value = expressionModule(expression);
    const capture = layoutCapture("value");
    capture.fields = reason === null ? available([]) : unavailable(reason);
    expression.tsonic.memory = available(capture);
    const decoded = roundtrip((value), `value-layout fields/${reason}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  });

for (const missing of [false, true])
  test(`HIR array descriptor ${missing ? "missing endpoint" : "actual foreign value"} retains the whole qualified reference vector`, () => {
    const { value, foreign, expression, array } = foreignMemoryFixture();
    if (missing) array.element = available(bodySource(ids.nodeId(99)));
    const decoded = roundtrip((value), `array descriptor/${missing}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), missing ? [
      violation("cross-owner-qualified", nodeSite(expression.id), "qualified body node must exist in its named owner"),
      violation("memory-capture-reference", nodeSite(expression.id), "layout edge must name the required captured descriptor kind"),
    ] : []);
  });

for (const cyclic of [false, true])
  test(`HIR distinct field-descriptor ${cyclic ? "active backedge" : "diamond completion"} preserves exact occurrence identity`, () => {
    const expressions = [callExpression(), callExpression(), callExpression(), callExpression()];
    const value = moduleWith(expressions.map(expression => syntax("ExpressionStatement", 0, { expression })));
    const references = expressions.map(expression => bodySource(expression.id));
    const root = layoutCapture("value", references[0]);
    root.fields = available([references[1], references[2]]);
    const first = layoutCapture("field", references[1]);
    first.selector = bodySource(expressions[1].expression.id);
    first.fieldLayout = available(references[cyclic ? 0 : 3]);
    const second = layoutCapture("field", references[2]);
    second.selector = bodySource(expressions[2].expression.id);
    second.fieldLayout = available(references[3]);
    const leaf = layoutCapture("value", references[3]);
    for (const [index, capture] of [root, first, second, leaf].entries()) expressions[index].tsonic.memory = available(capture);
    const decoded = roundtrip((value), `descriptor diamond/${cyclic}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), cyclic ? [
      violation("memory-layout-acyclic", nodeSite(expressions[0].id), "captured layout graph must be acyclic"),
    ] : []);
  });

for (const operation of ["size", "field-offset"])
  test(`HIR ${operation} observation retains complete existing and missing endpoint outcomes without changing its occurrence`, () => {
    for (const missing of [false, true]) {
      const { value, foreign, expression, references } = foreignMemoryFixture();
      const observation = observationCapture(operation);
      if (operation === "size") observation.layout = available(missing ? bodySource(ids.nodeId(99)) : references[0]);
      else observation.field = available(missing ? bodySource(ids.nodeId(99)) : references[1]);
      expression.tsonic.observation = available(observation);
      const decoded = roundtrip((value), `observation endpoint/${operation}/${missing}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [(foreign)])), missing ? [
        violation("cross-owner-qualified", nodeSite(expression.id), "qualified body node must exist in its named owner"),
        violation("memory-capture-reference", nodeSite(expression.id), operation === "size" ?
          "observation layout must name a value or array descriptor" : "observation field must name a field descriptor"),
      ] : []);
    }
  });

for (const kind of ["VariableDeclaration", "Parameter", "EnumMember", "PropertySignature", "PropertyDeclaration"])
  test(`HIR actual ${kind} initializer carrier has its required nullable syntax field and full captured-body opposite`, () => {
    for (const invalid of [false, true]) {
      let value;
      let declaration;
      if (kind === "VariableDeclaration") {
        ({ value, declaration } = variableModule());
      } else if (kind === "Parameter") {
        const fixture = functionModule(["required"]);
        value = fixture.value;
        declaration = fixture.parameters[0];
      } else {
        const fixture = declarationModule(kind === "EnumMember" ? "EnumDeclaration" :
          kind === "PropertySignature" ? "InterfaceDeclaration" : "ClassDeclaration");
        value = fixture.value;
        const definition = ids.encodeDefId({ module: value.module,
          segments: [{ name: "item", ordinal: 0 }, { name: "field", ordinal: 0 }] });
        const name = syntax("Identifier", 0, { text: "field", tsonic: { core: absentCore(), role: "declaration-name",
          declaration: { kind: "definition", definition } } });
        declaration = syntax(kind, 0, { modifiers: null, name, postfixToken: null,
          ...(kind === "EnumMember" ? {} : { type: null }), initializer: null,
          tsonic: { ...declarationFacts(fixture.definition), declaration: { kind: "definition", definition },
            declaredType: available(ids.tyId(0)), initializer: null } });
        fixture.node.members.nodes.push(declaration);
        fixture.node.tsonic.members = [definition];
        numberSyntaxFixture(value.tree);
        value.items = [{ definition: fixture.definition, node: fixture.node.id }, { definition, node: declaration.id }]
          .sort((left, right) => Number(left.definition > right.definition) - Number(left.definition < right.definition));
      }
      declaration.tsonic.initializer = invalid ? bodyIdentity : null;
      assert.deepStrictEqual(product.verifyHir((value), contextFor(value)), invalid ? [
        violation("body-owner", nodeSite(declaration.id), "initializer body must retain its actual syntax initializer"),
      ] : []);
    }
  });
