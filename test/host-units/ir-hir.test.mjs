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

const repository = fileURLToPath(new URL("../../", import.meta.url));
const moduleIdentity = "M[P[%002Fproject];main.ts]";
const definitionIdentity = `D[${moduleIdentity}]`;
const bodyIdentity = `B[${definitionIdentity};module;0]`;
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const runtimeNames = ["index", "children", "walk", "print", "parse", "verify", "verify-syntax", "verify-bindings", "verify-captures", "text-syntax", "text-data"];
const runtimeFiles = runtimeNames.map(name => resolve(repository, `packages/host/dist/ir-hir/${name}.js`));
const ownedSources = ["contract", ...runtimeNames].map(name => `packages/host/src/ir-hir/${name}.ts`);
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

function immutableTree(root) {
  const pending = [root];
  for (const value of pending) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) if (child !== null && typeof child === "object") pending.push(child);
      Object.freeze(value);
    }
  }
  return root;
}

function assertNodes(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: complete child count`);
  assert.equal(actual.every((node, ordinal) => node === expected[ordinal]), true, `${label}: exact existing node identities/order`);
  assert.equal(Object.isFrozen(actual), true, `${label}: immutable published vector`);
}

const functionAdapter = input => {
  const value = JSON.parse(input.text);
  const root = immutableTree(value.root);
  return { kind: "accepted", value: {
    walk: walkSyntaxTree(root, []).map(node => node.id),
    stop: walkSyntaxTree(root, value.stopBefore).map(node => node.id),
  }, diagnostics: [] };
};

test("HIR authored function case executes the real generic walk and complete ordered outcome", async () => {
  const deps = { modules: ["ir-hir"], adapters: { function: functionAdapter },
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
  const root = immutableTree(syntax("SourceFile", 0, {
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
  const root = immutableTree(syntax("SyntaxList", 0, { children: [child, child] }));
  assertNodes(walkSyntaxTree(root, []), [root, child], "shared child is not cloned or revisited");
  const cyclic = syntax("SyntaxList", 0, { children: [] });
  cyclic.children.push(cyclic);
  immutableTree(cyclic);
  assertNodes(walkSyntaxTree(cyclic, []), [cyclic], "invalid cyclic input cannot overflow the host stack");
});

test("HIR pure walkers handle a genuine 100000-level declared syntax chain iteratively", () => {
  const depth = 100_000;
  let expression = syntax("Identifier", depth, { text: "value" }, depth - 1);
  const leaf = expression;
  for (let ordinal = depth - 1; ordinal >= 0; ordinal -= 1) {
    expression = syntax("ParenthesizedExpression", ordinal, { expression }, ordinal === 0 ? null : ordinal - 1);
  }
  immutableTree(expression);
  const actual = walkSyntaxTree(expression, []);
  assert.equal(actual.length, depth + 1);
  assert.equal(actual.every((node, ordinal) => node.id === ordinal), true, "complete dense deep preorder");
  assert.equal(actual[0] === expression && actual[depth] === leaf, true, "original root and deepest leaf survive");
  assert.equal(Object.isFrozen(actual), true);
});

function constructorInputs(count, nullOptionals, reversed) {
  let nextId = 1;
  const rows = [];
  const list = factory => {
    const values = Array.from({ length: count }, () => factory());
    return nodeList(reversed ? values.reverse() : values);
  };
  const optional = factory => nullOptionals ? null : factory();
  const child = (kind = "Identifier") => {
    const id = nextId;
    nextId += 1;
    let properties;
    switch (kind) {
      case "Identifier": case "PrivateIdentifier": properties = { text: `name${id}` }; break;
      case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral":
        properties = { text: kind === "StringLiteral" ? "value" : kind === "RegularExpressionLiteral" ? "/x/" : "1", tokenFlags: [] }; break;
      case "NoSubstitutionTemplateLiteral": case "TemplateHead": case "TemplateMiddle": case "TemplateTail":
        properties = { text: "piece", tokenFlags: [], rawText: "piece", templateFlags: [] }; break;
      case "Block": properties = { statements: nodeList([]), multiLine: false }; break;
      case "BindingElement": properties = { dotDotDotToken: null, propertyName: null, name: child(), initializer: null }; break;
      case "Parameter": properties = { modifiers: null, dotDotDotToken: null, name: child(), questionToken: null, type: null, initializer: null }; break;
      case "TypeParameter": properties = { modifiers: null, name: child(), constraint: null, expression: null, defaultType: null }; break;
      case "HeritageClause": properties = { token: "ExtendsKeyword", types: nodeList([]) }; break;
      case "VariableDeclaration": properties = { name: child(), exclamationToken: null, type: null, initializer: null }; break;
      case "VariableDeclarationList": properties = { declarations: nodeList([]) }; break;
      case "CaseClause": properties = { expression: child(), statements: nodeList([]) }; break;
      case "CaseBlock": properties = { clauses: nodeList([]) }; break;
      case "CatchClause": properties = { variableDeclaration: null, block: child("Block") }; break;
      case "ImportClause": properties = { phaseModifier: null, name: child(), namedBindings: null }; break;
      case "ImportAttributes": properties = { token: "WithKeyword", attributes: nodeList([]), multiLine: false }; break;
      case "ImportSpecifier": case "ExportSpecifier": properties = { isTypeOnly: false, propertyName: null, name: child() }; break;
      case "NamespaceImport": case "NamespaceExport": properties = { name: child() }; break;
      case "NamedImports": case "NamedExports": properties = { elements: nodeList([]) }; break;
      case "ExternalModuleReference": properties = { expression: child("StringLiteral") }; break;
      case "SpreadAssignment": properties = { expression: child() }; break;
      case "TemplateSpan": properties = { expression: child(), literal: child("TemplateTail") }; break;
      case "TemplateLiteralTypeSpan": properties = { type: child("AnyKeyword"), literal: child("TemplateTail") }; break;
      case "JsxAttributes": properties = { properties: nodeList([]) }; break;
      case "JsxOpeningElement": case "JsxSelfClosingElement":
        properties = { tagName: child(), typeArguments: null, attributes: child("JsxAttributes") }; break;
      case "JsxClosingElement": properties = { tagName: child() }; break;
      case "JsxAttribute": properties = { name: child(), initializer: null }; break;
      case "JsxText": properties = { text: "text", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false }; break;
      case "JSDocText": properties = { text: ["documentation"] }; break;
      case "JSDocUnknownTag": properties = { tagName: child(), comment: null }; break;
      case "ModuleDeclaration": properties = { modifiers: null, asteriskToken: null, body: null, keyword: "NamespaceKeyword", name: child() }; break;
      default:
        assert.equal(/(?:Keyword|Token)$|^(?:EmptyStatement|EndOfFile|SemicolonClassElement|NotEmittedTypeElement|JsxOpeningFragment|JsxClosingFragment)$/u.test(kind), true,
          `the independent child factory requires a complete constructor for ${kind}`);
        properties = {};
    }
    return syntax(kind, id, properties);
  };
  const add = (kind, properties = {}, order = []) => {
    const expected = order.flatMap(field => {
      const value = properties[field];
      return value === null ? [] : Array.isArray(value) ? value : "nodes" in value ? value.nodes : [value];
    });
    rows.push({ node: syntax(kind, 0, properties), expected });
  };
  const expression = () => child();
  const type = () => child("AnyKeyword");
  const statement = () => child("EmptyStatement");
  const modifiers = () => optional(() => list(() => child("ExportKeyword")));
  const annotation = () => optional(type);
  const initializer = () => optional(expression);
  const parameters = () => list(() => child("Parameter"));
  const typeParameters = () => optional(() => list(() => child("TypeParameter")));
  const callable = () => ({ typeParameters: typeParameters(), parameters: parameters(), type: annotation(), fullSignature: annotation() });
  const property = () => ({ modifiers: modifiers(), name: child(), postfixToken: optional(() => child("QuestionToken")), type: annotation() });
  add("Identifier", { text: "name" });
  add("PrivateIdentifier", { text: "#private" });
  add("QualifiedName", { left: child(), right: child() }, ["left", "right"]);
  add("ComputedPropertyName", { expression: expression() }, ["expression"]);
  add("Decorator", { expression: expression() }, ["expression"]);
  add("EmptyStatement");
  add("IfStatement", { expression: expression(), thenStatement: statement(), elseStatement: optional(statement) }, ["expression", "thenStatement", "elseStatement"]);
  add("DoStatement", { statement: statement(), expression: expression() }, ["statement", "expression"]);
  add("WhileStatement", { statement: statement(), expression: expression() }, ["expression", "statement"]);
  add("ForStatement", { statement: statement(), initializer: initializer(), condition: initializer(), incrementor: initializer() }, ["initializer", "condition", "incrementor", "statement"]);
  for (const kind of ["ForInStatement", "ForOfStatement"])
    add(kind, { awaitModifier: kind === "ForInStatement" ? null : optional(() => child("AwaitKeyword")), initializer: expression(), expression: expression(), statement: statement() }, ["awaitModifier", "initializer", "expression", "statement"]);
  for (const kind of ["BreakStatement", "ContinueStatement"]) add(kind, { label: optional(expression) }, ["label"]);
  add("ReturnStatement", { expression: initializer() }, ["expression"]);
  add("WithStatement", { expression: expression(), statement: statement() }, ["expression", "statement"]);
  add("SwitchStatement", { expression: expression(), caseBlock: child("CaseBlock") }, ["expression", "caseBlock"]);
  add("CaseBlock", { clauses: list(() => child("CaseClause")) }, ["clauses"]);
  for (const kind of ["CaseClause", "DefaultClause"]) add(kind, { expression: kind === "CaseClause" ? expression() : null, statements: list(statement) }, ["expression", "statements"]);
  add("ThrowStatement", { expression: expression() }, ["expression"]);
  add("TryStatement", { tryBlock: child("Block"), catchClause: optional(() => child("CatchClause")), finallyBlock: optional(() => child("Block")) }, ["tryBlock", "catchClause", "finallyBlock"]);
  add("CatchClause", { variableDeclaration: optional(() => child("VariableDeclaration")), block: child("Block") }, ["variableDeclaration", "block"]);
  add("DebuggerStatement");
  add("LabeledStatement", { label: child(), statement: statement() }, ["label", "statement"]);
  add("ExpressionStatement", { expression: expression() }, ["expression"]);
  add("Block", { statements: list(statement), multiLine: false }, ["statements"]);
  add("VariableStatement", { modifiers: modifiers(), declarationList: child("VariableDeclarationList") }, ["modifiers", "declarationList"]);
  add("VariableDeclaration", { name: child(), exclamationToken: optional(() => child("ExclamationToken")), type: annotation(), initializer: initializer() }, ["name", "exclamationToken", "type", "initializer"]);
  add("VariableDeclarationList", { declarations: list(() => child("VariableDeclaration")) }, ["declarations"]);
  for (const kind of ["ObjectBindingPattern", "ArrayBindingPattern"]) add(kind, { elements: list(() => child("BindingElement")) }, ["elements"]);
  add("Parameter", { modifiers: modifiers(), dotDotDotToken: optional(() => child("DotDotDotToken")), name: child(), questionToken: optional(() => child("QuestionToken")), type: annotation(), initializer: initializer() },
    ["modifiers", "dotDotDotToken", "name", "questionToken", "type", "initializer"]);
  add("BindingElement", { dotDotDotToken: optional(() => child("DotDotDotToken")), propertyName: optional(expression), name: optional(expression), initializer: initializer() }, ["dotDotDotToken", "propertyName", "name", "initializer"]);
  add("MissingDeclaration", { modifiers: modifiers() }, ["modifiers"]);
  for (const kind of ["FunctionDeclaration", "FunctionExpression"])
    add(kind, { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), name: optional(expression) },
      ["modifiers", "asteriskToken", "name", "typeParameters", "parameters", "type", "fullSignature", "body"]);
  for (const kind of ["ClassDeclaration", "ClassExpression", "InterfaceDeclaration"])
    add(kind, { modifiers: modifiers(), name: kind === "InterfaceDeclaration" ? child() : optional(expression), typeParameters: typeParameters(),
      heritageClauses: optional(() => list(() => child("HeritageClause"))), members: list(() => child(kind === "InterfaceDeclaration" ? "NotEmittedTypeElement" : "SemicolonClassElement")) },
      ["modifiers", "name", "typeParameters", "heritageClauses", "members"]);
  add("HeritageClause", { token: "ExtendsKeyword", types: list(() => syntax("ExpressionWithTypeArguments", nextId++, { expression: expression(), typeArguments: null })) }, ["types"]);
  for (const kind of ["TypeAliasDeclaration", "JSTypeAliasDeclaration"]) add(kind, { modifiers: modifiers(), name: child(), typeParameters: typeParameters(), type: type() }, ["modifiers", "name", "typeParameters", "type"]);
  add("EnumMember", { modifiers: modifiers(), name: child(), postfixToken: optional(() => child("QuestionToken")), initializer: initializer() }, ["modifiers", "name", "postfixToken", "initializer"]);
  add("EnumDeclaration", { modifiers: modifiers(), name: child(), members: list(() => syntax("EnumMember", nextId++, { modifiers: null, name: child(), postfixToken: null, initializer: null })) }, ["modifiers", "name", "members"]);
  add("ModuleBlock", { statements: list(statement) }, ["statements"]);
  add("NotEmittedStatement");
  add("NotEmittedTypeElement");
  for (const kind of ["ImportDeclaration", "JSImportDeclaration"]) add(kind, { modifiers: modifiers(), importClause: optional(() => child("ImportClause")), moduleSpecifier: child("StringLiteral"), attributes: optional(() => child("ImportAttributes")) }, ["modifiers", "importClause", "moduleSpecifier", "attributes"]);
  add("ExternalModuleReference", { expression: child("StringLiteral") }, ["expression"]);
  for (const kind of ["NamespaceImport", "NamespaceExport"]) add(kind, { name: child() }, ["name"]);
  add("NamedImports", { elements: list(() => child("ImportSpecifier")) }, ["elements"]);
  add("ExportAssignment", { modifiers: modifiers(), isExportEquals: false, type: annotation(), expression: expression() }, ["modifiers", "type", "expression"]);
  add("NamespaceExportDeclaration", { modifiers: modifiers(), name: child() }, ["modifiers", "name"]);
  add("NamedExports", { elements: list(() => child("ExportSpecifier")) }, ["elements"]);
  for (const kind of ["ExportSpecifier", "ImportSpecifier"]) add(kind, { isTypeOnly: false, propertyName: optional(expression), name: child() }, ["propertyName", "name"]);
  for (const kind of ["CallSignature", "ConstructSignature", "JSDocSignature"]) add(kind, callable(), ["typeParameters", "parameters", "type", "fullSignature"]);
  add("Constructor", { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")) }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature", "asteriskToken", "body"]);
  for (const kind of ["GetAccessor", "SetAccessor", "MethodDeclaration"]) add(kind, { ...property(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")) }, ["modifiers", "asteriskToken", "name", "postfixToken", "typeParameters", "parameters", "type", "fullSignature", "body"]);
  add("IndexSignature", { modifiers: modifiers(), ...callable() }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature"]);
  add("MethodSignature", { ...property(), ...callable() }, ["modifiers", "name", "postfixToken", "typeParameters", "parameters", "type", "fullSignature"]);
  for (const kind of ["PropertySignature", "PropertyDeclaration", "PropertyAssignment"]) add(kind, { ...property(), initializer: kind === "PropertyAssignment" ? expression() : initializer() }, ["modifiers", "name", "postfixToken", "type", "initializer"]);
  add("SemicolonClassElement");
  add("ClassStaticBlockDeclaration", { modifiers: modifiers(), body: child("Block") }, ["modifiers", "body"]);
  add("OmittedExpression");
  for (const kind of ["StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral"])
    add(kind, { text: kind === "StringLiteral" ? "text" : kind === "BigIntLiteral" ? "1n" : kind === "RegularExpressionLiteral" ? "/x/" : "1", tokenFlags: [] });
  for (const kind of ["NoSubstitutionTemplateLiteral", "TemplateHead", "TemplateMiddle", "TemplateTail"])
    add(kind, { text: "text", tokenFlags: [], rawText: "text", templateFlags: [] });
  add("BinaryExpression", { modifiers: modifiers(), left: expression(), type: annotation(), operatorToken: child("PlusToken"), right: expression() }, ["modifiers", "left", "type", "operatorToken", "right"]);
  add("PrefixUnaryExpression", { operator: "MinusToken", operand: expression() }, ["operand"]);
  add("PostfixUnaryExpression", { operand: expression(), operator: "PlusPlusToken" }, ["operand"]);
  add("YieldExpression", { asteriskToken: optional(() => child("AsteriskToken")), expression: initializer() }, ["asteriskToken", "expression"]);
  add("ArrowFunction", { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), equalsGreaterThanToken: child("EqualsGreaterThanToken") },
    ["modifiers", "typeParameters", "parameters", "type", "fullSignature", "asteriskToken", "equalsGreaterThanToken", "body"]);
  for (const kind of ["AsExpression", "SatisfiesExpression"]) add(kind, { expression: expression(), type: type() }, ["expression", "type"]);
  add("ConditionalExpression", { condition: expression(), questionToken: child("QuestionToken"), whenTrue: expression(), colonToken: child("ColonToken"), whenFalse: expression() }, ["condition", "questionToken", "whenTrue", "colonToken", "whenFalse"]);
  add("PropertyAccessExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), name: child() }, ["expression", "questionDotToken", "name"]);
  add("ElementAccessExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), argumentExpression: expression() }, ["expression", "questionDotToken", "argumentExpression"]);
  add("CallExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), typeArguments: optional(() => list(type)), arguments: list(expression) }, ["expression", "questionDotToken", "typeArguments", "arguments"]);
  add("NewExpression", { expression: expression(), typeArguments: optional(() => list(type)), arguments: optional(() => list(expression)) }, ["expression", "typeArguments", "arguments"]);
  add("MetaProperty", { keywordToken: "NewKeyword", name: child() }, ["name"]);
  for (const kind of ["NonNullExpression", "SpreadElement", "ParenthesizedExpression", "SpreadAssignment", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", "PartiallyEmittedExpression", "JsxSpreadAttribute"])
    add(kind, { expression: expression() }, ["expression"]);
  add("TemplateExpression", { head: child("TemplateHead"), templateSpans: list(() => child("TemplateSpan")) }, ["head", "templateSpans"]);
  add("TemplateSpan", { expression: expression(), literal: child("TemplateTail") }, ["expression", "literal"]);
  add("TaggedTemplateExpression", { tag: expression(), questionDotToken: optional(() => child("QuestionDotToken")), typeArguments: optional(() => list(type)), template: child("NoSubstitutionTemplateLiteral") }, ["tag", "questionDotToken", "typeArguments", "template"]);
  add("ArrayLiteralExpression", { elements: list(expression), multiLine: true }, ["elements"]);
  add("ObjectLiteralExpression", { properties: list(() => child("SpreadAssignment")), multiLine: true }, ["properties"]);
  add("ShorthandPropertyAssignment", { ...property(), equalsToken: optional(() => child("EqualsToken")), objectAssignmentInitializer: initializer() }, ["modifiers", "name", "postfixToken", "type", "equalsToken", "objectAssignmentInitializer"]);
  add("TypeAssertionExpression", { type: type(), expression: expression() }, ["type", "expression"]);
  for (const kind of ["UnionType", "IntersectionType"]) add(kind, { types: list(type) }, ["types"]);
  add("ConditionalType", { checkType: type(), extendsType: type(), trueType: type(), falseType: type() }, ["checkType", "extendsType", "trueType", "falseType"]);
  add("TypeOperator", { operator: "ReadonlyKeyword", type: type() }, ["type"]);
  add("InferType", { typeParameter: child("TypeParameter") }, ["typeParameter"]);
  add("ArrayType", { elementType: type() }, ["elementType"]);
  add("IndexedAccessType", { objectType: type(), indexType: type() }, ["objectType", "indexType"]);
  add("TypeReference", { typeArguments: optional(() => list(type)), typeName: child() }, ["typeName", "typeArguments"]);
  add("ExpressionWithTypeArguments", { expression: expression(), typeArguments: optional(() => list(type)) }, ["expression", "typeArguments"]);
  add("LiteralType", { literal: child("NumericLiteral") }, ["literal"]);
  add("ThisType");
  add("TypePredicate", { assertsModifier: optional(() => child("AssertsKeyword")), parameterName: child(), type: annotation() }, ["assertsModifier", "parameterName", "type"]);
  add("ImportAttribute", { name: child(), value: expression() }, ["name", "value"]);
  add("ImportAttributes", { token: "WithKeyword", attributes: list(() => syntax("ImportAttribute", nextId++, { name: child(), value: expression() })), multiLine: false }, ["attributes"]);
  add("TypeQuery", { typeArguments: optional(() => list(type)), exprName: child() }, ["exprName", "typeArguments"]);
  add("MappedType", { readonlyToken: optional(() => child("ReadonlyKeyword")), typeParameter: child("TypeParameter"), nameType: annotation(), questionToken: optional(() => child("QuestionToken")), type: annotation(), members: optional(() => list(() => child("NotEmittedTypeElement"))) }, ["readonlyToken", "typeParameter", "nameType", "questionToken", "type", "members"]);
  add("TypeLiteral", { members: list(() => child("NotEmittedTypeElement")) }, ["members"]);
  add("TupleType", { elements: list(type) }, ["elements"]);
  add("NamedTupleMember", { dotDotDotToken: optional(() => child("DotDotDotToken")), name: child(), questionToken: optional(() => child("QuestionToken")), type: type() }, ["dotDotDotToken", "name", "questionToken", "type"]);
  for (const kind of ["OptionalType", "RestType", "ParenthesizedType", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocVariadicType", "JSDocOptionalType"])
    add(kind, { type: type() }, ["type"]);
  for (const kind of ["FunctionType", "ConstructorType"]) add(kind, { modifiers: modifiers(), ...callable() }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature"]);
  add("TemplateLiteralType", { head: child("TemplateHead"), templateSpans: list(() => child("TemplateLiteralTypeSpan")) }, ["head", "templateSpans"]);
  add("TemplateLiteralTypeSpan", { type: type(), literal: child("TemplateTail") }, ["type", "literal"]);
  add("JsxElement", { openingElement: child("JsxOpeningElement"), children: list(() => child("JsxText")), closingElement: child("JsxClosingElement") }, ["openingElement", "children", "closingElement"]);
  add("JsxAttributes", { properties: list(() => child("JsxAttribute")) }, ["properties"]);
  add("JsxNamespacedName", { namespace: child(), name: child() }, ["namespace", "name"]);
  for (const kind of ["JsxOpeningElement", "JsxSelfClosingElement"]) add(kind, { tagName: child(), typeArguments: optional(() => list(type)), attributes: child("JsxAttributes") }, ["tagName", "typeArguments", "attributes"]);
  add("JsxFragment", { openingFragment: child("JsxOpeningFragment"), children: list(() => child("JsxText")), closingFragment: child("JsxClosingFragment") }, ["openingFragment", "children", "closingFragment"]);
  add("JsxOpeningFragment"); add("JsxClosingFragment");
  add("JsxAttribute", { name: child(), initializer: optional(() => child("StringLiteral")) }, ["name", "initializer"]);
  add("JsxClosingElement", { tagName: child() }, ["tagName"]);
  add("JsxExpression", { dotDotDotToken: optional(() => child("DotDotDotToken")), expression: initializer() }, ["dotDotDotToken", "expression"]);
  add("JsxText", { text: "jsx", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false });
  add("SyntaxList", { children: list(expression).nodes }, ["children"]);
  add("JSDoc", { comment: list(() => child("JSDocText")), tags: optional(() => list(() => child("JSDocUnknownTag"))) }, ["comment", "tags"]);
  add("JSDocAllType");
  const tag = () => ({ tagName: child(), comment: optional(() => list(() => child("JSDocText"))) });
  add("JSDocTypeTag", { ...tag(), typeExpression: type() }, ["tagName", "typeExpression", "comment"]);
  for (const kind of ["JSDocUnknownTag", "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag"])
    add(kind, tag(), ["tagName", "comment"]);
  add("JSDocTemplateTag", { ...tag(), constraint: type(), typeParameters: list(() => child("TypeParameter")) }, ["tagName", "constraint", "typeParameters", "comment"]);
  for (const kind of ["JSDocReturnTag", "JSDocThrowsTag"]) add(kind, { ...tag(), typeExpression: annotation() }, ["tagName", "typeExpression", "comment"]);
  add("JSDocSeeTag", { ...tag(), nameExpression: type() }, ["tagName", "nameExpression", "comment"]);
  for (const kind of ["JSDocImplementsTag", "JSDocAugmentsTag"])
    add(kind, { ...tag(), className: syntax("ExpressionWithTypeArguments", nextId++, { expression: expression(), typeArguments: null }) }, ["tagName", "className", "comment"]);
  for (const kind of ["JSDocSatisfiesTag", "JSDocThisTag", "JSDocOverloadTag"]) add(kind, { ...tag(), typeExpression: type() }, ["tagName", "typeExpression", "comment"]);
  add("JSDocImportTag", { ...tag(), importClause: optional(() => child("ImportClause")), moduleSpecifier: child("StringLiteral"), attributes: optional(() => child("ImportAttributes")) }, ["tagName", "importClause", "moduleSpecifier", "attributes", "comment"]);
  add("JSDocCallbackTag", { ...tag(), typeExpression: type(), name: optional(expression) }, ["tagName", "typeExpression", "name", "comment"]);
  add("JSDocTypedefTag", { ...tag(), typeExpression: annotation(), name: optional(expression) }, ["tagName", "typeExpression", "name", "comment"]);
  add("JSDocNameReference", { name: child() }, ["name"]);
  add("SourceFile", { statements: list(statement), endOfFileToken: child("EndOfFile"), languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null }, ["statements", "endOfFileToken"]);
  add("ModuleDeclaration", { modifiers: modifiers(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), keyword: "NamespaceKeyword", name: child() }, ["modifiers", "asteriskToken", "name", "body"]);
  add("ImportEqualsDeclaration", { modifiers: modifiers(), isTypeOnly: false, name: child(), moduleReference: child("ExternalModuleReference") }, ["modifiers", "name", "moduleReference"]);
  add("ExportDeclaration", { modifiers: modifiers(), isTypeOnly: false, exportClause: optional(() => child("NamedExports")), moduleSpecifier: initializer(), attributes: optional(() => child("ImportAttributes")) }, ["modifiers", "exportClause", "moduleSpecifier", "attributes"]);
  add("ImportType", { typeArguments: optional(() => list(type)), isTypeOf: false, argument: type(), attributes: optional(() => child("ImportAttributes")), qualifier: optional(expression) }, ["argument", "attributes", "qualifier", "typeArguments"]);
  add("ImportClause", { phaseModifier: null, name: optional(expression), namedBindings: optional(() => child("NamedImports")) }, ["name", "namedBindings"]);
  add("JSDocText", { text: ["one", "two"] });
  for (const kind of ["JSDocLink", "JSDocLinkPlain", "JSDocLinkCode"]) add(kind, { text: ["link"], name: optional(expression) }, ["name"]);
  add("TypeParameter", { modifiers: modifiers(), name: child(), constraint: annotation(), expression: initializer(), defaultType: annotation() }, ["modifiers", "name", "constraint", "expression", "defaultType"]);
  add("SyntheticReferenceExpression", { expression: expression(), thisArg: expression() }, ["expression", "thisArg"]);
  add("JSDocTypeLiteral", { jsDocPropertyTags: optional(() => list(() => child("JSDocUnknownTag")).nodes), isArrayType: false }, ["jsDocPropertyTags"]);
  for (const kind of ["JSDocParameterTag", "JSDocPropertyTag"]) add(kind, { ...tag(), name: child(), isBracketed: true, typeExpression: annotation(), isNameFirst: false }, ["tagName", "name", "typeExpression", "comment"]);
  for (const kind of [
    "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia", "ConflictMarkerTrivia", "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "JSDocCommentTextToken",
    "OpenBraceToken", "CloseBraceToken", "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken", "DotToken", "DotDotDotToken", "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken", "GreaterThanToken", "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken", "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken", "ExclamationToken", "TildeToken", "AmpersandAmpersandToken", "BarBarToken", "QuestionToken", "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken", "HashToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken", "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken",
    "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword", "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword", "FalseKeyword", "FinallyKeyword", "ForKeyword", "FunctionKeyword", "IfKeyword", "ImportKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword", "NullKeyword", "ReturnKeyword", "SuperKeyword", "SwitchKeyword", "ThisKeyword", "ThrowKeyword", "TrueKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "VoidKeyword", "WhileKeyword", "WithKeyword", "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword", "AssertsKeyword", "AssertKeyword", "AnyKeyword", "AsyncKeyword", "AwaitKeyword", "BooleanKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword", "InferKeyword", "IntrinsicKeyword", "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "NeverKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword", "NumberKeyword", "ObjectKeyword", "SatisfiesKeyword", "SetKeyword", "StringKeyword", "SymbolKeyword", "TypeKeyword", "UndefinedKeyword", "UniqueKeyword", "UnknownKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword", "BigIntKeyword", "OverrideKeyword", "OfKeyword", "DeferKeyword",
  ]) add(kind);
  return rows;
}

test("HIR closed syntax constructors preserve authored direct children across null, empty, one and ordered several", () => {
  for (const [count, nullOptionals, reversed] of [[0, true, false], [0, false, false], [1, false, false], [3, false, false], [3, false, true]]) {
    for (const row of constructorInputs(count, nullOptionals, reversed)) {
      immutableTree(row.node);
      assertNodes(childrenOfSyntax(row.node), row.expected, `${row.node.kind}/${count}/${nullOptionals}/${reversed}`);
    }
  }
});

const available = value => ({ kind: "available", value });
const unavailable = (reason = "not-provided") => ({ kind: "unavailable", reason });
const emptyBindings = () => ({ classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] });
const emptyScope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
const absentCore = () => ({ provider: available(null), markers: available({ struct: null, field: null, defaultValue: null, jsString: false }),
  pointerType: available(null), pointerOperation: available(null), attribute: available(null), safety: available(null),
  argumentPassing: available(null), flowState: available(null) });
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
      roundtrip(immutableTree(constructorModule(node)), `checked text/${node.kind}/${count}/${nullOptionals}/${reversed}`);
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
  for (const module of [value, ...additionalModules]) {
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
    bindingScopeOf: definition => declarations.has(definition) ? emptyScope() : null,
    bindingScopeAt: reference => lexicalScopes.get(JSON.stringify(reference)) ?? null,
    nominalOf: definition => { assert.fail(`unexpected nominal lookup: ${definition}`); },
    nodeOf: reference => checkedNodes.get(JSON.stringify(reference)) ?? null,
    localExists: reference => declaredLocals.has(JSON.stringify(reference)), ...additions };
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
  assert.equal(Object.isFrozen(decoded.value), true, `${label}: immutable module`);
  return { text, value: decoded.value };
}

test("HIR public index has exactly the six approved complete data operations", () => {
  assert.deepStrictEqual(Object.keys(product).sort(), ["childrenOfSyntax", "indexSyntaxTree", "parseHir", "printHir", "verifyHir", "walkSyntaxTree"]);
  assert.deepStrictEqual(readdirSync(resolve(repository, "packages/host/src/ir-hir")).filter(name => name.endsWith(".ts")).sort(),
    ["contract", ...runtimeNames].map(name => `${name}.ts`).sort());
});

test("HIR minimal module roundtrips full data and verifies without querying absent providers", () => {
  const value = immutableTree(moduleWith());
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
    const decoded = roundtrip(immutableTree(value), `semantic ids ${String(rootId)}/${String(endId)}`);
    assert.equal(decoded.value.tree !== decoded.value.tree.endOfFileToken, true, "wire objects remain distinct despite payload collision");
    assert.equal(Object.is(decoded.value.tree.id, rootId), true);
    assert.equal(Object.is(decoded.value.tree.endOfFileToken.id, endId), true);
    assertComplete(product.verifyHir(value, contextFor(value)), expected, "complete semantic-id violation vector");
    assertComplete(product.verifyHir(decoded.value, contextFor(decoded.value)), expected, "wire-preserved semantic-id violation vector");
  }
  const block = syntax("Block", 1, { statements: nodeList([]), multiLine: false }, 0);
  const value = moduleWith([block]);
  value.tree.statements.nodes.push(block);
  const decoded = roundtrip(immutableTree(value), "shared syntax object");
  assert.equal(decoded.value.tree.statements.nodes[0] === decoded.value.tree.statements.nodes[1], true);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
    violation("node-dense-preorder", nodeSite(1), "syntax node occurs more than once"),
  ]);
});

test("HIR deep checked block syntax prints, parses and verifies 100000 levels without recursive input processing", () => {
  let block = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  for (let ordinal = 1; ordinal < 100_000; ordinal += 1)
    block = syntax("Block", 0, { statements: nodeList([block]), multiLine: ordinal % 2 === 0 });
  const value = immutableTree(moduleWith([block]));
  const decoded = roundtrip(value, "100000 checked blocks");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  const nodes = indexSyntaxTree(decoded.value.tree);
  assert.equal(nodes.length, 100_002);
  assert.equal(nodes.every((node, ordinal) => node.id === ordinal), true, "every declared node retains the complete deep preorder");
});

test("HIR authored whole-module text and verifier case has an independent complete expected value", async () => {
  const path = "test/host-cases/ir-hir/verifier/minimal-module.case.json";
  const text = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const expected = immutableTree(moduleWith());
  assert.equal(product.printHir(expected), text);
  const parsed = product.parseHir(text);
  assertComplete(parsed, { kind: "parsed", value: expected }, "independently authored full HIR text");
  const result = await runCase({ modules: ["ir-hir"],
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(valid), contextFor(valid)), []);
  const invalid = moduleWith();
  mutate(invalid);
  assert.deepStrictEqual(product.verifyHir(immutableTree(invalid), contextFor(invalid)), expected);
});

test("HIR stable-order has a complete independent two-order scope witness without duplicate arena ids", () => {
  for (const [order, expected] of [
    [[0, 1], []],
    [[1, 0], [violation("stable-order", { kind: "body", body: bodyIdentity }, "scopes must be distinct and in preorder")]],
  ]) {
    const value = moduleWith();
    value.bodies[0].scopes = order.map(node => ({ node, parent: null, attributes: [] }));
    assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), expected);
  }
});

function replaceModuleOwner(value, definition, body) {
  value.tree.tsonic.definition = definition;
  value.tree.tsonic.body = body;
  value.bodies[0].owner = definition;
  value.bodies[0].body = body;
}

function foreignModuleWith(statements) {
  const value = moduleWith(statements);
  value.module = "M[P[%002Fproject];foreign.ts]";
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
      const decoded = roundtrip(immutableTree(value), `${family}/${String(ordinal)}`);
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
  const decoded = roundtrip(immutableTree(valid), "gapped original candidate order");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  const invalid = moduleWith();
  invalid.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(8), candidate(2)] }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(invalid), contextFor(invalid)), [
    violation("candidate-original-order", { kind: "body", body: bodyIdentity }, "candidate ordinals must retain distinct original order"),
  ]);
});

test("HIR candidate arena ids, applied signatures and independent scope contributions have exact opposites", () => {
  const dense = moduleWith();
  dense.bodies[0].candidateLists = [{ id: 1, candidates: [] }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(dense), contextFor(dense)), [
    violation("candidate-list-dense", { kind: "body", body: bodyIdentity }, "candidate list id must equal its arena position"),
  ]);
  const signature = moduleWith();
  signature.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { appliedSignature: available(4) })] }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(signature), contextFor(signature)), [
    violation("signature-reference", { kind: "body", body: bodyIdentity }, "signature must exist in the supplied table"),
  ]);
  const contribution = moduleWith();
  contribution.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { contributions: [
    { parameter: { owner: definitionIdentity, index: 1 }, role: "result", source: bodySource(0),
      component: { root: bodySource(0), path: [] }, type: available(0) },
  ] })] }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(contribution), contextFor(contribution)), [
    violation("contribution-parameter", { kind: "body", body: bodyIdentity }, "contribution must name an actual candidate type parameter"),
  ]);
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
      const decoded = roundtrip(immutableTree(value), `application/${kind}/${tuple.kind}/${resolved.kind}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, { types: {
        terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null, kind: kind === "construct" ? "construct" : "call" })],
      } })), []);
    }
  });

test("HIR candidate-list reference uses the containing body arena, not another scope or a bare global index", () => {
  const expression = callExpression(available({ kind: "call", receiver: null, arguments: [], typeArguments: [],
    candidates: available(7), resolvedSignature: available(null) }));
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
    violation("candidate-list-reference", nodeSite(2), "candidate list must exist in the containing body"),
  ]);
});

test("HIR type references preserve all captured availability arms and refuse only actual missing table ids", () => {
  for (const captured of [unavailable("checker-error"), unavailable("parameter-dependent"), unavailable(), available(0)]) {
    const value = expressionModule(nameExpression());
    value.tree.statements.nodes[0].expression.tsonic.value.views.read = captured;
    const decoded = roundtrip(immutableTree(value), `captured read ${captured.kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
  const value = expressionModule(nameExpression());
  value.tree.statements.nodes[0].expression.tsonic.value.views.read = available(-1);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
    violation("type-reference", nodeSite(2), "type must exist in the supplied table"),
  ]);
});

test("HIR actual local resolution keeps its body qualifier and rejects a missing local with the complete vector", () => {
  const expression = nameExpression();
  const value = expressionModule(expression);
  expression.tsonic.resolution = { kind: "local", local: { body: bodyIdentity, local: 0 } };
  value.bodies[0].locals = [{ id: 0, declaration: bodySource(2), name: "value", role: "binding", checkerSlot: available(0), capturedFrom: null, mutable: true }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), []);
  const wrong = expressionModule(nameExpression());
  wrong.tree.statements.nodes[0].expression.tsonic.resolution = { kind: "local", local: { body: bodyIdentity, local: 3 } };
  assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
    violation("local-reference", nodeSite(2), "qualified local must exist in its named body"),
  ]);
});

test("HIR place-base-acyclic rejects an actual place-reference cycle without using numeric node order", () => {
  const expression = nameExpression();
  expression.tsonic.value.place = available({ base: { kind: "place", node: 2 }, step: null, read: available(0), write: available(null) });
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
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
  const value = immutableTree(indexPlaceModule());
  const decoded = roundtrip(value, "genuine indexed place");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const outside = immutableTree(indexPlaceModule("key"));
  assert.deepStrictEqual(product.verifyHir(outside, contextFor(outside)), [
    violation("place-access-base-in-receiver", nodeSite(2), "access base place must lie inside its actual receiver subtree"),
  ]);
  const missing = immutableTree(indexPlaceModule("receiver", false));
  assert.deepStrictEqual(product.verifyHir(missing, contextFor(missing)), [
    violation("place-base-acyclic", nodeSite(2), "place base must name an actual place in the same body and end at a root"),
  ]);
  const rooted = indexPlaceModule();
  rooted.tree.statements.nodes[0].expression.tsonic.value.place = available(rootPlace());
  assert.deepStrictEqual(product.verifyHir(immutableTree(rooted), contextFor(rooted)), [
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
  const decoded = roundtrip(immutableTree(value), "parenthesized member receiver");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
});

test("HIR place reference refuses missing nodes and retains the whole coupled reference vector", () => {
  const expression = nameExpression();
  expression.tsonic.value.place = available({ base: { kind: "place", node: 99 }, step: { kind: "deref" }, read: available(0), write: unavailable() });
  const value = immutableTree(expressionModule(expression));
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [
    violation("node-reference", nodeSite(2), "node must exist in the module arena"),
    violation("place-base-acyclic", nodeSite(2), "place base must name an actual place in the same body and end at a root"),
  ]);
});

test("HIR exact literal metadata keeps authored radix, separators, exponents, signs and arbitrary integer precision", () => {
  const numeric = [
    ["1", 1n, 1n, false], ["1.", 1n, 1n, false], ["1.0", 1n, 1n, false], ["1.e0", 1n, 1n, false],
    [".5", 1n, 2n, false], ["1_2.3_4E+0_2", 1234n, 1n, false], ["0xF_F", 255n, 1n, false],
    ["0b10_01", 9n, 1n, false], ["0o7_1", 57n, 1n, false], ["9007199254740993", 9007199254740993n, 1n, false],
    ["1.0000000000000000000000000000000000000001", 10000000000000000000000000000000000000001n, 10000000000000000000000000000000000000000n, false],
    ["0e9999999999999999999999999", 0n, 1n, false], ["-0.0e-999999999999999999999999", 0n, 1n, true],
  ];
  for (const [token, numerator, denominator, negativeZero] of numeric) {
    const expression = syntax("NumericLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "value",
      value: emptyValue(), literal: { kind: "number", token, value: { numerator, denominator, negativeZero } } } });
    const value = immutableTree(expressionModule(expression));
    const decoded = roundtrip(value, `exact number ${token}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
  for (const [token, integer] of [["9007199254740993n", 9007199254740993n], ["0x1_0000_0000_0000_0001n", 18446744073709551617n],
    ["-0b1_01n", -5n], ["0o7_1n", 57n], ["+0n", 0n]]) {
    const expression = syntax("BigIntLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "attribute-value",
      literal: { kind: "bigint", token, value: integer } } });
    const value = immutableTree(expressionModule(expression));
    assert.deepStrictEqual(product.verifyHir(roundtrip(value, token).value, contextFor(value)), []);
  }
});

for (const [token, rational] of [
  ["0.1", { numerator: 1n, denominator: 2n, negativeZero: false }],
  ["1e99999999999999999999999999", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1e-99999999999999999999999999", { numerator: 1n, denominator: 1n, negativeZero: false }],
  ["1__0", { numerator: 10n, denominator: 1n, negativeZero: false }],
  ["1", { numerator: 2n, denominator: 2n, negativeZero: false }],
  ["1", { numerator: 1n, denominator: -1n, negativeZero: false }],
  ["1", { numerator: 1n, denominator: 1n, negativeZero: true }],
  ["-0", { numerator: 0n, denominator: 1n, negativeZero: false }],
]) test(`HIR literal-exact minimal complete opposite: ${token}/${rational.denominator}/${rational.negativeZero}`, () => {
  const expression = syntax("NumericLiteral", 0, { text: token, tokenFlags: [], tsonic: { core: absentCore(), role: "value", value: emptyValue(),
    literal: { kind: "number", token, value: rational } } });
  const value = immutableTree(expressionModule(expression));
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), []);
  const invalidLiteral = syntax("StringLiteral", 0, { text: "x", tokenFlags: [], tsonic: { core: absentCore(), role: "type-literal", type: unavailable(),
    literal: { kind: "string", value: "x" } } });
  const invalidUnary = syntax("PrefixUnaryExpression", 0, { operator: "MinusToken", operand: invalidLiteral,
    tsonic: { core: absentCore(), role: "value", value: emptyValue() } });
  const invalidType = syntax("LiteralType", 0, { literal: invalidUnary, tsonic: typeMetadata() });
  const invalid = expressionModule(syntax("TypeAssertionExpression", 0, { type: invalidType, expression: nameExpression(), tsonic: expressionMetadata() }));
  assert.deepStrictEqual(product.verifyHir(immutableTree(invalid), contextFor(invalid)), [
    violation("literal-type-child", nodeSite(3), "literal unary child requires a numeric literal and unary plus or minus"),
  ]);
});

test("HIR complete source ownership compiles in fresh strict whole-module isolation against real dependency values", async () => {
  const roots = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8")).areas.map(area => area.directory);
  const deps = isolationDeps(tooling, roots);
  const interfaceSources = ["packages/host/src/ids/contract.ts", "packages/host/src/ids/index.ts", "packages/host/src/diag/contract.ts",
    "packages/host/src/ir-types/contract.ts", "packages/host/src/ir-types/index.ts"];
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

test("HIR fresh actual declarations retain generic phases, all six ports and exact readonly/shape refusals", () => {
  const stage = mkdtempSync(resolve(evidenceDirectory, "consumer-"));
  for (const owner of ["ids", "diag", "ir-types", "ir-hir"]) {
    const source = resolve(repository, `packages/host/dist/${owner}`);
    mkdirSync(resolve(stage, owner));
    for (const name of readdirSync(source).filter(name => name.endsWith(".d.ts")))
      writeFileSync(resolve(stage, owner, name), readFileSync(resolve(source, name)));
  }
  writeFileSync(resolve(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  const positive = `import { childrenOfSyntax, indexSyntaxTree, parseHir, printHir, verifyHir, walkSyntaxTree } from "./ir-hir/index.js";
import type { HirModule, HirVerificationContext, Phase, SyntaxPhase, CheckedPhase, Block, Statement, SourceFile, SyntaxNode, ChildrenOfSyntax, IndexSyntaxTree, ParseHir, PrintHir, VerifyHir, WalkSyntaxTree } from "./ir-hir/contract.js";
import type { BodyId, DefId, ModuleId, NodeId } from "./ids/contract.js";
import type { SourceNodeRef } from "./ids/contract.js";
import type { ComponentSelector, TypeComponent } from "./ir-types/contract.js";
export function generic<P extends Phase>(root: SourceFile<P>, node: SyntaxNode<P>, stop: readonly NodeId[]) {
const children: ChildrenOfSyntax = childrenOfSyntax; const index: IndexSyntaxTree = indexSyntaxTree; const walk: WalkSyntaxTree = walkSyntaxTree;
const childResult: readonly SyntaxNode<P>[] = children(node); const indexResult: readonly SyntaxNode<P>[] = index(root); const walkResult: readonly SyntaxNode<P>[] = walk(node, stop);
return { childResult, indexResult, walkResult }; }
export function checked(module: HirModule, context: HirVerificationContext) {
const parse: ParseHir = parseHir; const print: PrintHir = printHir; const verify: VerifyHir = verifyHir;
return { text: print(module), decoded: parse(print(module)), violations: verify(module, context) }; }
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
    ["missing-occurrence-scope.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bindingScopeOf:()=>null,nominalOf:()=>null,nodeOf:()=>null,localExists:()=>false};', 2741],
    ["missing-node-data.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,localExists:()=>false};', 2741],
    ["retired-node-exists.ts", 'import type { HirVerificationContext } from "./ir-hir/contract.js"; export const context:HirVerificationContext={types:{terms:[],signatures:[]},bindingScopeOf:()=>null,bindingScopeAt:()=>null,nominalOf:()=>null,nodeExists:()=>false,localExists:()=>false};', 2353],
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
  const decoded = roundtrip(immutableTree(value), kind);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

for (const operation of ["size", "alignment", "stride", "field-offset"]) test(`HIR complete ${operation} observation retains its own occurrence and exact value`, () => {
  const expression = callExpression();
  const value = expressionModule(expression);
  expression.tsonic.observation = available(observationCapture(operation));
  const decoded = roundtrip(immutableTree(value), operation);
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
    const decoded = roundtrip(immutableTree(value), `exact memory geometry/${size}`);
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
    const value = immutableTree(expressionModule(expression));
    const expected = operation === "size" ? "observation layout must name a value or array descriptor" : "observation field must name a field descriptor";
    assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), [violation("memory-capture-reference", nodeSite(2), expected)]);
  }
});

test("HIR memory-capture-owner rejects one nonexistent original occurrence without manufacturing a replacement", () => {
  const expression = callExpression();
  expression.tsonic.memory = available(layoutCapture("value", bodySource(99)));
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
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
  const decoded = roundtrip(immutableTree(value), "metadata reference cycle");
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
  immutableTree(foreign);
  const decoded = roundtrip(immutableTree(value), `foreign memory/${kind}`);
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
  const decoded = roundtrip(immutableTree(value), "foreign to local layout cycle");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign)])), [
    violation("memory-layout-acyclic", nodeSite(2), "captured layout graph must be acyclic"),
  ]);
});

test("HIR shared inline descriptor records retain value semantics and complete lexical binding reads after parsing", () => {
  const first = callExpression();
  const second = callExpression();
  const value = moduleWith([syntax("ExpressionStatement", 0, { expression: first }), syntax("ExpressionStatement", 0, { expression: second })]);
  const shared = layoutCapture("value", bodySource(first.id));
  shared.bindings = available(emptyBindings());
  first.tsonic.memory = available(shared);
  second.tsonic.memory = available(shared);
  const decoded = roundtrip(immutableTree(value), "shared inline memory record");
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
    const decoded = roundtrip(immutableTree(value), `incompatible descriptor views/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), [
      violation("memory-capture-owner", nodeSite(second.id), "one occurrence cannot own incompatible descriptor kinds"),
    ]);
  }
});

for (const missing of [true, false]) test(`HIR foreign descriptor endpoint checks ${missing ? "absent" : "wrong-kind"} actual metadata`, () => {
  const { value, foreign, expressions, layout } = foreignMemoryFixture();
  if (missing) expressions[1].tsonic.memory = available(null);
  else layout.fields = available([referenceIn(foreign, expressions[2])]);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value, {}, [immutableTree(foreign)])), [
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
    const decoded = roundtrip(immutableTree(value), `foreign observation/${operation}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign)])), []);
  });

for (const operation of ["size", "field-offset"]) test(`HIR ${operation} refuses an existing foreign node with the wrong descriptor kind`, () => {
  const { value, foreign, expression, references } = foreignMemoryFixture();
  const observation = observationCapture(operation);
  if (operation === "size") observation.layout = available(references[1]);
  else observation.field = available(references[0]);
  expression.tsonic.observation = available(observation);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value, {}, [immutableTree(foreign)])), [
    violation("memory-capture-reference", nodeSite(2), operation === "size" ?
      "observation layout must name a value or array descriptor" : "observation field must name a field descriptor"),
  ]);
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
    assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [violation("observation-capture-owner", nodeSite(2), expected)]);
  }
});

test("HIR actual await protocol and minimally wrong closed arm have independent complete values", () => {
  const expression = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(), protocol: available({ kind: "await", subject: 3, completion: 0 }) } });
  const value = immutableTree(expressionModule(expression));
  assert.deepStrictEqual(product.verifyHir(roundtrip(value, "await protocol").value, contextFor(value)), []);
  const wrong = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(),
    protocol: available({ kind: "yield", subject: 3, yielded: 0, sent: 0, completion: 0 }) } });
  const invalid = immutableTree(expressionModule(wrong));
  assert.deepStrictEqual(product.verifyHir(invalid, contextFor(invalid)), [
    violation("protocol-kind", nodeSite(2), "protocol must match its syntactic operation"),
  ]);
  const wrongSubject = syntax("AwaitExpression", 0, { expression: nameExpression(), tsonic: { ...expressionMetadata(),
    protocol: available({ kind: "await", subject: 2, completion: 0 }) } });
  const wrongSubjectModule = immutableTree(expressionModule(wrongSubject));
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
    const decoded = roundtrip(immutableTree(value), name);
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] } });
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), [], name);
  }
  const wrong = syntax("ForOfStatement", 0, { awaitModifier: syntax("AwaitKeyword", 0), initializer: nameExpression("target"), expression: nameExpression("iterable"),
    statement: syntax("EmptyStatement", 0), tsonic: { core: absentCore(), protocol: available(iterationProtocol("iterate", 4, false, true)) } });
  const wrongModule = immutableTree(moduleWith([wrong]));
  assert.deepStrictEqual(product.verifyHir(wrongModule, contextFor(wrongModule, {
    types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] },
  })), [violation("protocol-kind", nodeSite(1), "iteration protocol must retain authored asynchronous mode")]);
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
    const decoded = roundtrip(immutableTree(value), `disposal/${count}/${reverse}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value, {
      types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: null })] },
    })), []);
  }
  const { value, list, declaration } = variableModule();
  list.tsonic.disposal = [available({ kind: "await", subject: declaration.id, completion: 0 })];
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
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
  const decoded = roundtrip(immutableTree(value), "CaseClause expression/DefaultClause null");
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
    const decoded = roundtrip(immutableTree(value), `${kind}/${awaited}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  });

test("HIR ForIn rejects the real nonnull await field with an exact invalid-text offset", () => {
  const { value, statement } = iterationModule("ForOfStatement", true);
  const text = product.printHir(immutableTree(value)).replace("=ForOfStatement(", "=ForInStatement(");
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
    [original.replace("tree=n:0", "tree=n:999"), "tree=n:999", ["SourceFile"], "tree=".length],
    [original.replace("nodes=[]", "nodes=[false]"), "nodes=[false]", ["Statement"], "nodes=[".length],
    [original.replace("n:1=EndOfFile", "n:0=EndOfFile"), "n:0=EndOfFile", ["distinct wire binding"]],
    [original.replace("n:1=EndOfFile", "n:3=EndOfFile"), "n:3=EndOfFile", ["n:1"]],
    [original.replace("n:0=SourceFile", "n:0=InventedNode"), "tree=n:0", ["SourceFile"], "tree=".length],
    [original.replace("n:0=SourceFile", "n:0=HirBody"), "tree=n:0", ["SourceFile"], "tree=".length],
    [original.replace("n:0=SourceFile", "n:0=Token"), "tree=n:0", ["SourceFile"], "tree=".length],
    [original.replace("n:0=SourceFile", "SourceFile"), "SourceFile(", ["node wire binding"]],
    [original.replace("provider=available(value=null)", 'provider=unavailable(reason="future")'), '"future"', ["declared field value"]],
  ];
  for (const [text, marker, expected, adjustment = 0] of cases) {
    assert.equal(text.indexOf(marker) >= 0, true, "independently authored error marker exists in its owning frame");
    assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
  }
  const extra = `${original.slice(0, -1)}, bogus=0)`;
  assertInvalidText(extra, extra.lastIndexOf("bogus="), [")"]);
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
    ['HirModule(module=mod:"x", module=mod:"x")', 'module=mod:"x")', ["distinct field"]],
    [`${header} ${header}`, " HirModule(", ["newline"], 1],
    ['HirModule(module=mod:"x"tree=n:0)', "tree=n:0", [",", ")"]],
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
  const text = product.printHir(immutableTree(value));
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
  const text = product.printHir(immutableTree(value));
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
  const args = Object.create(null);
  for (const name of ["__proto__", "plain", "a b", special])
    Object.defineProperty(args, name, { value: { pos: 0, end: 1, name, value: special }, enumerable: true });
  value.tree.pragmas = [{ pos: 0, end: 100, kind: "SingleLineCommentTrivia", hasTrailingNewLine: true, name: special, args }];
  value.tree.commentDirectives = [{ loc: { pos: 0, end: 1 }, kind: "Unknown" }, { loc: { pos: 1, end: 2 }, kind: "ExpectError" }, { loc: { pos: 2, end: 3 }, kind: "Ignore" }];
  value.tree.checkJsDirective = { enabled: true, range: { pos: 0, end: 2, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false } };
  const decoded = roundtrip(immutableTree(value), "UTF16 and dictionaries");
  assertComplete(product.parseHir(decoded.text.replaceAll("/", "\\/")), { kind: "parsed", value },
    "JSON solidus escapes retain the entire independently authored HIR value");
  assert.equal(Object.hasOwn(decoded.value.tree.pragmas[0].args, "__proto__"), true, "dictionary field is data, not prototype mutation");
  assert.equal(Object.getPrototypeOf(decoded.value.tree.pragmas[0].args), Object.prototype);
  for (const number of [-0, NaN, Infinity, -Infinity, 0.5, -1, 0, 1, Number.MAX_SAFE_INTEGER]) {
    const numeric = moduleWith();
    numeric.tree.pragmas = [{ pos: number, end: number, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false, name: "scalar", args: {} }];
    roundtrip(immutableTree(numeric), `all host numbers/${String(number)}`);
  }
});

test("HIR dictionary text has one exact UTF16 key order independent of property insertion", () => {
  const original = readFileSync(resolve(repository, "test/host-cases/ir-hir/verifier/minimal-module.input.hir"), "utf8").trimEnd();
  const entries = [["2", "two"], ["10", "ten"], ["z", "last"], ["a", "first"]];
  const expected = original.replace("pragmas=[]", 'pragmas=[SingleLineCommentTrivia(pos=0, end=100, hasTrailingNewLine=false, name="sorted", args=PragmaArguments("10"=PragmaArgument(pos=0, end=1, name="10", value="ten"), "2"=PragmaArgument(pos=0, end=1, name="2", value="two"), a=PragmaArgument(pos=0, end=1, name="a", value="first"), z=PragmaArgument(pos=0, end=1, name="z", value="last")))]');
  for (const order of [entries, [...entries].reverse()]) {
    const args = {};
    for (const [name, text] of order) args[name] = { pos: 0, end: 1, name, value: text };
    const value = moduleWith();
    value.tree.pragmas = [{ pos: 0, end: 100, kind: "SingleLineCommentTrivia", hasTrailingNewLine: false, name: "sorted", args }];
    const decoded = roundtrip(immutableTree(value), "canonical pragma dictionary");
    assert.equal(decoded.text, expected, "the entire module text equals the independent declaration-order fixture with sorted dictionary keys");
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});

function signature(properties = {}) {
  return { id: 0, declaration: definitionIdentity, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: [], result: 0, ...properties };
}

test("HIR candidate endpoints retain declaration identity independently of the signature table index", () => {
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { appliedSignature: available(0) })] }];
  const valid = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature()] } });
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), valid), []);
  const wrong = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: `D[${moduleIdentity};other]` })] } });
  assert.deepStrictEqual(product.verifyHir(value, wrong), [
    violation("candidate-endpoints", { kind: "body", body: bodyIdentity }, "applied signature must retain the candidate declaration"),
  ]);
});

test("HIR complete candidate binding scope uses the real type verifier and unknown scope is not fabricated empty", () => {
  const value = moduleWith();
  value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(0, { bindings: available(emptyBindings()) })] }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value, { bindingScopeOf: definition => {
    assert.equal(definition, definitionIdentity, "only the actual candidate declaration is requested");
    return null;
  } })), [{ rule: "binding-vector-complete", site: { kind: "body", body: bodyIdentity },
    detail: [{ kind: "text", value: "bindingScopeOf" }, { kind: "text", value: definitionIdentity }] }]);
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
  const decoded = roundtrip(immutableTree(value), `${kind}/lexical bindings`);
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
  const decoded = roundtrip(immutableTree(value), "item-qualified bindings");
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value, {
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
  const decoded = roundtrip(immutableTree(value), `operator/${operator}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations[0].operands.reverse();
  assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
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
  const decoded = roundtrip(immutableTree(value), `unary/${operator}`);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const missing = structuredClone(value);
  missing.obligations[0].obligations[0].operands = [];
  assert.deepStrictEqual(product.verifyHir(immutableTree(missing), contextFor(missing)), [
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
    const decoded = roundtrip(immutableTree(value), `assignment/${token}/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    for (const field of ["value", "destination"]) {
      const wrong = structuredClone(value);
      const fit = wrong.obligations[0].obligations.find(obligation => obligation.kind === "write-fit");
      if (field === "value") fit.value = { body: bodyIdentity, node: 3 };
      else fit.destination = bodySource(5);
      assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
        violation("obligation-complete", nodeSite(2), "write-fit obligation must retain its actual value and destination"),
        violation("obligation-complete", nodeSite(2), "root must retain each syntactically required obligation"),
      ]);
    }
    if (operator !== null) {
      const missing = structuredClone(value);
      missing.obligations[0].obligations = missing.obligations[0].obligations.filter(obligation => obligation.kind === "operator")
        .map((obligation, ordinal) => ({ ...obligation, ordinal }));
      assert.deepStrictEqual(product.verifyHir(immutableTree(missing), contextFor(missing)), [
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
    const decoded = roundtrip(immutableTree(value), `${kind}/${token}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    const wrong = structuredClone(value);
    wrong.obligations[0].obligations[0].value.node = 3;
    assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
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
  const decoded = roundtrip(immutableTree(value), "complete checker record");
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
  const decoded = roundtrip(immutableTree(value), `diagnostic-root/${name}`);
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
      const decoded = roundtrip(immutableTree(value), `diagnostic/${code.kind}/${severity}/${site.kind}/${count}/${reversed}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
    }
});

test("HIR candidate conditional failures retain absent, unavailable and complete original diagnostic outcomes separately", () => {
  const diagnostic = sourceDiagnostic(2, 1);
  diagnostic.arguments = [{ kind: "text", value: "original conditional failure" }];
  for (const conditionalFailure of [available(null), available(diagnostic), unavailable(), unavailable("checker-error"), unavailable("parameter-dependent")]) {
    const value = moduleWith();
    value.bodies[0].candidateLists = [{ id: 0, candidates: [candidate(7, { conditionalFailure })] }];
    const decoded = roundtrip(immutableTree(value), `conditional/${conditionalFailure.kind}`);
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [violation(name, nodeSite(2), expected)]);
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
    const decoded = roundtrip(immutableTree(value), `foreign marker/${kind}/${target.kind}`);
    const expected = target === type ? [] : [violation("core-capture-kind", nodeSite(2), "marker type reference must point to a type syntax node")];
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign)])), expected);
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
    const decoded = roundtrip(immutableTree(value), `foreign attribute/${kind}/${target.kind}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign)])), target === invocation ? [] : [
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
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value, {}, [immutableTree(foreign)])), [
    violation("cross-owner-qualified", nodeSite(2), `qualified ${kind} node must exist in its named owner`),
    violation("core-capture-reference", nodeSite(2), "Core capture reference must retain an existing qualified source node"),
  ]);
});

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
  for (const field of ["provider", "markers", "pointerType", "pointerOperation", "attribute", "safety", "argumentPassing", "flowState"])
    for (const reason of ["checker-error", "parameter-dependent", "not-provided"])
      rows.push({ field, name: `${field}/${reason}`, captured: unavailable(reason) });
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
    const decoded = roundtrip(immutableTree(module), `${row.field}/${row.name}`);
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
    const value = immutableTree(expressionModule(row.node));
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
    const decoded = roundtrip(immutableTree(module), `component path/${path.map(selector => selector.kind).join("/")}`);
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
  immutableTree(cyclic.module);
  const expected = { name: "TypeError", message: "Inline value cycle at $.tsonic.core.pointerType.value.pointee.component.path[0].family.component" };
  assert.throws(() => product.printHir(cyclic.module), expected);
  assert.throws(() => product.verifyHir(cyclic.module, contextFor(cyclic.module)), expected);

  const shared = coreCarrier();
  const leaf = { root: bodySource(6), path: [] };
  const family = { origin: "authored", component: leaf, parameters: [], roles: [] };
  shared.call.tsonic.core.pointerType = available({ kind: "typed-location", pointee: { type: available(0), component: {
    root: bodySource(6), path: [{ kind: "sum-arm", family, index: 0 }, { kind: "sum-arm", family, index: 1 }],
  } }, mutability: "readonly" });
  const decoded = roundtrip(immutableTree(shared.module), "shared inline component tree");
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
  const decoded = roundtrip(immutableTree(value), "100000 inline TypeComponent levels");
  assert.deepStrictEqual(product.verifyHir(value, contextFor(value)), []);
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
});

test("HIR declared syntax wire cycles remain roundtrippable structural violations, never inline caller defects", () => {
  const block = syntax("Block", 0, { statements: nodeList([]), multiLine: false });
  block.statements.nodes.push(block);
  const value = immutableTree(moduleWith([block]));
  const decoded = roundtrip(value, "declared syntax arena back edge");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), [
    violation("node-dense-preorder", nodeSite(1), "syntax node occurs more than once"),
  ]);
});

test("HIR numeric member keys preserve exact normalized rationals and their complete normalization opposite", () => {
  for (const [rational, expected] of [
    [{ numerator: 9007199254740993n, denominator: 2n, negativeZero: false }, []],
    [{ numerator: 0n, denominator: 1n, negativeZero: true }, []],
    [{ numerator: 2n, denominator: 4n, negativeZero: false }, [violation("literal-exact", nodeSite(2), "numeric member key must retain a normalized exact rational")]],
  ]) {
    const node = nameExpression("key");
    node.tsonic = { core: absentCore(), role: "property-name", key: available({ kind: "number", value: rational }), origins: available([]) };
    const value = immutableTree(expressionModule(node));
    const decoded = roundtrip(value, "exact member key");
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), expected);
  }
});

test("HIR signed zero parent and implicit definition ordinals inside foreign body identities retain their own exact rules", () => {
  const signed = moduleWith();
  signed.tree.endOfFileToken.parent = -0;
  assert.deepStrictEqual(product.verifyHir(immutableTree(signed), contextFor(signed)), [
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
    const value = immutableTree(expressionModule(node));
    assert.deepStrictEqual(product.verifyHir(value, contextFor(value, {}, [immutableTree(foreign)])), [
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
  const decoded = roundtrip(immutableTree(value), `declaration/${kind}`);
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
      const decoded = roundtrip(immutableTree(value), `declared parameters/${kind}/${count}/${reversed}`);
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
      const decoded = roundtrip(immutableTree(value), `members/${kind}/${count}/${reversed}`);
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
      const decoded = roundtrip(immutableTree(value), `contributions/${roles.join("/")}/${type.kind}`);
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
      const decoded = roundtrip(immutableTree(value), `params/${roles.join("/")}/${nested}`);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
      assertNodes(walkSyntaxTree(body.root, []), [body.root, ...(nested ? [body.root.statements.nodes[0], body.root.statements.nodes[0].name,
        body.root.statements.nodes[0].body] : [])], "complete original function subtree");
      for (const initializer of initializers) assert.equal(body.root === initializer.root, false, "a default initializer remains outside the body block");
    }
});

test("HIR initializer write-fit keeps the actual separate default-argument value body and declaration occurrence", () => {
  const { value, parameters, initializers } = functionModule(["required", "default"]);
  const parameter = parameters[1];
  const initializer = initializers[0];
  value.checkerDiagnostics = [sourceDiagnostic()];
  value.obligations = [{ diagnostic: 0, owner: bodySource(parameter.id), obligations: [{ kind: "write-fit", ordinal: 0,
    occurrence: { body: bodyIdentity, node: parameter.id }, value: { body: initializer.body, node: initializer.root.id },
    destination: bodySource(parameter.id), destinationType: 0 }] }];
  const decoded = roundtrip(immutableTree(value), "actual default argument write-fit");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations[0].destination = bodySource(parameter.name.id);
  assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
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
  const decoded = roundtrip(immutableTree(value), "nested binding default lexical capture and SDK-style omission");
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
  const decoded = roundtrip(immutableTree(value), "genuine module/body diagnostic boundary");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  const wrong = structuredClone(value);
  wrong.obligations[0].obligations = [{ kind: "operator", ordinal: 0, occurrence: { body: body.body, node: inner.id }, operator: "-",
    operands: [inner.left, inner.right].map(node => ({ body: body.body, node: node.id })) }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(wrong), contextFor(wrong)), [
    violation("obligation-complete", nodeSite(0), "every obligation must belong to its diagnostic root"),
    violation("obligation-complete", nodeSite(0), "root must retain each syntactically required obligation"),
  ]);
});

test("HIR actual declaration passing captures preserve every closed mode on the original Parameter", () => {
  for (const mode of ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]) {
    const { value, parameters, body } = functionModule();
    parameters[0].tsonic.core.argumentPassing = available({ role: "declaration", mode });
    body.params[0].passing = mode;
    const decoded = roundtrip(immutableTree(value), `declaration passing/${mode}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(value)), []);
  }
});

test("HIR callable endpoints retain advertised, API-signature and real API-body owners in both supplied orders", () => {
  for (const reversed of [false, true]) for (const count of [0, 1, 3]) {
    const { value, declaration, body } = functionModule([]);
    const roles = ["advertised", "api-signature", "api-body"].slice(0, count);
    if (reversed) roles.reverse();
    declaration.tsonic.signatures = roles.map(role => ({ declaration: body.owner, role, signature: 0, body: role === "api-body" ? body.body : null }));
    const decoded = roundtrip(immutableTree(value), `callable endpoints/${count}/${reversed}`);
    const context = contextFor(value, { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [signature({ declaration: body.owner })] } });
    assert.deepStrictEqual(product.verifyHir(decoded.value, context), []);
  }
  const { value, declaration, body } = functionModule([]);
  declaration.tsonic.signatures = [{ declaration: body.owner, role: "api-body", signature: 0, body: null }];
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value, {
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
      const decoded = roundtrip(immutableTree(value), `${languageVariant}/${scriptKind}/flags/${reversed}`);
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
    const decoded = roundtrip(immutableTree(value), `closure/${kind}/${asynchronous}/${generator}`);
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
  const decoded = roundtrip(immutableTree(value), "class static initializer");
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
    const decoded = roundtrip(immutableTree(value), `catch/${present}/${reversed}/${count}`);
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
      const decoded = roundtrip(immutableTree(value), `import bindings/${count}/${reversed}/${reason}`);
      assert.deepStrictEqual(product.verifyHir(foreign.value, contextFor(foreign.value)), []);
      assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign.value)])), []);
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
    const decoded = roundtrip(immutableTree(value), `${kind}/exports/${count}/${reversed}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value, {}, [immutableTree(foreign.value)])), []);
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
    const decoded = roundtrip(immutableTree(value), `initializer/${kind}`);
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
    const decoded = roundtrip(immutableTree(value), `namespace/${count}/${reversed}`);
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
      const decoded = roundtrip(immutableTree(value), `data-layout/${byteOrder}/${addressWidth}/${reason}`);
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
      const decoded = roundtrip(immutableTree(value), `array facts/${runtimeBase}/${length}/${reason}`);
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
    const decoded = roundtrip(immutableTree(value), `field primary/${missing}`);
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
    const decoded = roundtrip(immutableTree(value), `selected group/${missing}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), missing ? [
      violation("core-capture-reference", nodeSite(2), "attribute selected declaration must belong to its declaration group"),
    ] : []);
  }
});

test("HIR origins retain every supplied lowering pass and expansion derivation in authored order", () => {
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness", "initialization",
    "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"];
  const derivations = [...passes.map(pass => ({ kind: "lowering", pass })), { kind: "expansion", expansion: "supplied-expansion-0" }];
  for (const values of [[], [derivations[0]], derivations, [...derivations].reverse()]) {
    const value = moduleWith();
    value.tree.origin.derived = values;
    const decoded = roundtrip(immutableTree(value), `complete derivations/${values.length}`);
    assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
  }
});
