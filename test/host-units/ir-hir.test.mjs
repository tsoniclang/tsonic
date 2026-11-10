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
const runtimeNames = ["index", "children", "walk", "print", "parse", "verify", "verify-syntax", "verify-bindings", "verify-captures"];
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
    add(kind, { awaitModifier: optional(() => child("AwaitKeyword")), initializer: expression(), expression: expression(), statement: statement() }, ["awaitModifier", "initializer", "expression", "statement"]);
  for (const kind of ["BreakStatement", "ContinueStatement"]) add(kind, { label: optional(expression) }, ["label"]);
  add("ReturnStatement", { expression: initializer() }, ["expression"]);
  add("WithStatement", { expression: expression(), statement: statement() }, ["expression", "statement"]);
  add("SwitchStatement", { expression: expression(), caseBlock: child("CaseBlock") }, ["expression", "caseBlock"]);
  add("CaseBlock", { clauses: list(() => child("CaseClause")) }, ["clauses"]);
  for (const kind of ["CaseClause", "DefaultClause"]) add(kind, { expression: initializer(), statements: list(statement) }, ["expression", "statements"]);
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

function moduleWith(statements = []) {
  const end = syntax("EndOfFile", 1, {}, 0);
  const tree = syntax("SourceFile", 0, { statements: nodeList(statements), endOfFileToken: end,
    languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
    tsonic: { core: absentCore(), parent: null, attributes: [], memory: available(null), definition: definitionIdentity, body: bodyIdentity } });
  const pending = [{ node: tree, parent: null }];
  let ordinal = 0;
  while (pending.length > 0) {
    const frame = pending.pop();
    frame.node.id = ordinal;
    frame.node.parent = frame.parent;
    ordinal += 1;
    const children = fixtureChildren(frame.node);
    for (let index = children.length - 1; index >= 0; index -= 1)
      pending.push({ node: children[index], parent: frame.node.id });
  }
  return { module: moduleIdentity, tree, items: [], bodies: [{ body: bodyIdentity, owner: definitionIdentity,
    params: [], locals: [], root: tree, captures: [], scopes: [], asynchronous: false, generator: false,
    candidateLists: [], nestedBodies: [] }], checkerDiagnostics: [], obligations: [] };
}

function fixtureChildren(node) {
  switch (node.kind) {
    case "SourceFile": return [...node.statements.nodes, node.endOfFileToken];
    case "Block": return node.statements.nodes;
    case "ExpressionStatement": case "AwaitExpression": case "SpreadElement": case "ParenthesizedExpression": return [node.expression];
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": return [node.operand];
    case "BinaryExpression": return [node.left, node.operatorToken, node.right];
    case "CallExpression": return [node.expression, ...(node.questionDotToken === null ? [] : [node.questionDotToken]),
      ...(node.typeArguments?.nodes ?? []), ...node.arguments.nodes];
    case "LiteralType": return [node.literal];
    case "TypeAssertionExpression": return [node.type, node.expression];
    case "ElementAccessExpression": return [node.expression, ...(node.questionDotToken === null ? [] : [node.questionDotToken]), node.argumentExpression];
    case "Identifier": case "EndOfFile": case "EmptyStatement": case "NumericLiteral": case "BigIntLiteral":
    case "StringLiteral": case "NoSubstitutionTemplateLiteral": case "PlusToken": case "AnyKeyword": return [];
    default: assert.fail(`fixture requires its independently authored child order: ${node.kind}`);
  }
}

function contextFor(value, additions = {}) {
  const declarations = new Set([value.tree.tsonic.definition, ...value.items.map(item => item.definition)]);
  return { types: { terms: [{ kind: "primitive", primitive: "int32" }], signatures: [] },
    bindingScopeOf: definition => declarations.has(definition) ? emptyScope() : null,
    nominalOf: definition => { assert.fail(`unexpected nominal lookup: ${definition}`); },
    nodeExists: reference => { assert.fail(`unexpected external node lookup: ${JSON.stringify(reference)}`); },
    localExists: reference => { assert.fail(`unexpected external local lookup: ${JSON.stringify(reference)}`); }, ...additions };
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
  for (const [rootId, endId] of [[0, 0], [-0, 0], [0, -0], [NaN, Infinity], [-Infinity, 0.5]]) {
    const value = moduleWith();
    value.tree.id = rootId;
    value.tree.endOfFileToken.id = endId;
    const decoded = roundtrip(immutableTree(value), `semantic ids ${String(rootId)}/${String(endId)}`);
    assert.equal(decoded.value.tree !== decoded.value.tree.endOfFileToken, true, "wire objects remain distinct despite payload collision");
    assert.equal(Object.is(decoded.value.tree.id, rootId), true);
    assert.equal(Object.is(decoded.value.tree.endOfFileToken.id, endId), true);
  }
  const block = syntax("Block", 1, { statements: nodeList([]), multiLine: false }, 0);
  const value = moduleWith([block]);
  value.tree.statements.nodes.push(block);
  const decoded = roundtrip(immutableTree(value), "shared syntax object");
  assert.equal(decoded.value.tree.statements.nodes[0] === decoded.value.tree.statements.nodes[1], true);
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
    violation("node-reference", nodeSite(0), "node must exist in the module arena"),
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

test("HIR projected storage places require their real parent to precede the projection", () => {
  const expression = nameExpression();
  expression.tsonic.value.place = available({ base: { kind: "place", node: 2 }, step: null, read: available(0), write: available(null) });
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
    violation("place-parent-precedes", nodeSite(2), "parent storage place must precede its projection"),
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
import type { HirModule, HirVerificationContext, Phase, SyntaxPhase, SourceFile, SyntaxNode, ChildrenOfSyntax, IndexSyntaxTree, ParseHir, PrintHir, VerifyHir, WalkSyntaxTree } from "./ir-hir/contract.js";
import type { ModuleId, NodeId } from "./ids/contract.js";
export function generic<P extends Phase>(root: SourceFile<P>, node: SyntaxNode<P>, stop: readonly NodeId[]) {
const children: ChildrenOfSyntax = childrenOfSyntax; const index: IndexSyntaxTree = indexSyntaxTree; const walk: WalkSyntaxTree = walkSyntaxTree;
const childResult: readonly SyntaxNode<P>[] = children(node); const indexResult: readonly SyntaxNode<P>[] = index(root); const walkResult: readonly SyntaxNode<P>[] = walk(node, stop);
return { childResult, indexResult, walkResult }; }
export function checked(module: HirModule, context: HirVerificationContext) {
const parse: ParseHir = parseHir; const print: PrintHir = printHir; const verify: VerifyHir = verifyHir;
return { text: print(module), decoded: parse(print(module)), violations: verify(module, context) }; }
`;
  const constructors = constructorInputs(1, false, false).map(row => JSON.stringify(row.node)
    .replace(/"id":\d+/gu, '"id":nodeId').replaceAll(JSON.stringify(moduleIdentity), "moduleId")).join(",\n");
  writeFileSync(resolve(stage, "positive.ts"), `${positive}\nexport function allConstructors(moduleId:ModuleId,nodeId:NodeId):readonly SyntaxNode<SyntaxPhase>[]{return [${constructors}];}\n`);
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
    ["missing-child.ts", 'import type { SyntaxList, SyntaxPhase } from "./ir-hir/contract.js"; export const incomplete:SyntaxList<SyntaxPhase>={kind:"SyntaxList"};', 2740],
    ["unknown-kind.ts", 'import type { HirNode } from "./ir-hir/contract.js"; export function bad(value:HirNode){ value.kind="InventedNode"; }', 2540],
    ["private-helper.ts", 'import { createHirSchema } from "./ir-hir/index.js"; export const helper=createHirSchema;', 2305],
  ];
  for (const [name, text] of negatives) writeFileSync(resolve(stage, name), text);
  const refused = run("negative.json", negatives.map(([name]) => name));
  assert.notEqual(refused.status, 0);
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

test("HIR memory-capture-owner rejects one nonexistent original occurrence without manufacturing a replacement", () => {
  const expression = callExpression();
  expression.tsonic.memory = available(layoutCapture("value", bodySource(99)));
  const value = expressionModule(expression);
  assert.deepStrictEqual(product.verifyHir(immutableTree(value), contextFor(value)), [
    violation("cross-owner-qualified", nodeSite(2), "qualified body node must exist in its named owner"),
    violation("node-reference", nodeSite(2), "node must exist in the module arena"),
    violation("memory-capture-owner", nodeSite(2), "capture occurrence must exist in this module"),
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
});

function assertInvalidText(text, offset, expected) {
  const prefix = text.slice(0, offset).split("\n");
  assert.deepStrictEqual(product.parseHir(text), { kind: "invalid-text", offset,
    line: prefix.length, column: prefix[prefix.length - 1].length + 1, expected,
    found: offset === text.length ? null : text.slice(offset, offset + 1) });
}

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
    [original.replace("n:0=SourceFile", "n:0=InventedNode"), "InventedNode", ["syntax node declaration"]],
    [original.replace("n:0=SourceFile", "SourceFile"), "SourceFile(", ["node wire binding"]],
    [original.replace("provider=available(value=null)", 'provider=unavailable(reason="future")'), '"future"', ["declared field value"]],
  ];
  for (const [text, marker, expected, adjustment = 0] of cases) {
    assert.equal(text.indexOf(marker) >= 0, true, "independently authored error marker exists in its owning frame");
    assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
  }
  const extra = `${original.slice(0, -1)}, bogus=0)`;
  assertInvalidText(extra, extra.lastIndexOf("bogus="), [")"]);
  const surplus = `${original}\n${original.split("\n")[2].replace("n:1=EndOfFile(id=n:1", "n:2=EmptyStatement(id=n:7")}`;
  assertInvalidText(surplus, original.length + 1, ["referenced syntax declaration"]);
});

test("HIR lexical failures retain UTF16 offsets for strings, escapes, delimiters and wire positions", () => {
  for (const [text, marker, adjustment, expected] of [
    ['HirModule(module=mod:"\\q")', "\\q", 1, ["JSON escape"]],
    ['HirModule(module=mod:"\\uZZZZ")', "ZZZZ", 0, ["four hexadecimal digits"]],
    ['HirModule(module=mod:"a\nb")', "\n", 0, ["JSON string character"]],
    ['HirModule(module=mod:"unfinished', "unfinished", "unfinished".length, ["closing quote"]],
    ["n:-0=SourceFile()", "-0", 0, ["nonnegative wire position"]],
    ["n:0.5=SourceFile()", "0.5", 0, ["nonnegative wire position"]],
    ["n:NaN=SourceFile()", "NaN", 0, ["nonnegative wire position"]],
    ["n:0 SourceFile()", " SourceFile", 1, ["="]],
    ["HirModule(module 0)", "0", 0, ["="]],
  ]) assertInvalidText(text, text.indexOf(marker) + adjustment, expected);
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
  assert.equal(Object.hasOwn(decoded.value.tree.pragmas[0].args, "__proto__"), true, "dictionary field is data, not prototype mutation");
  assert.equal(Object.getPrototypeOf(decoded.value.tree.pragmas[0].args), Object.prototype);
  for (const number of [-0, NaN, Infinity, -Infinity, 0.5, -1, 0, 1, Number.MAX_SAFE_INTEGER]) {
    const numeric = moduleWith();
    numeric.tree.pragmas = [{ pos: number, end: number, kind: "MultiLineCommentTrivia", hasTrailingNewLine: false, name: "scalar", args: {} }];
    roundtrip(immutableTree(numeric), `all host numbers/${String(number)}`);
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

test("HIR checker diagnostic root keeps its full original code, evidence, related records and complete index obligation", () => {
  const value = moduleWithObligation();
  value.checkerDiagnostics[0].arguments = [{ kind: "text", value: "native" }, { kind: "integer", value: 9007199254740993n }, { kind: "number", value: -0 },
    { kind: "origin", value: { module: moduleIdentity, start: 0, length: 1, derived: [{ kind: "lowering", pass: "front" }] } }];
  value.checkerDiagnostics[0].related = [{ site: { kind: "file", path: "other.ts" }, code: { kind: "host", name: "H_RELATED", rendered: "H_RELATED" }, message: "related" }];
  value.checkerDiagnostics[0].fix = { description: "original fix", edits: [{ origin: { module: moduleIdentity, start: 2, length: 1, derived: [] }, replacement: "fixed" }] };
  const decoded = roundtrip(immutableTree(value), "complete checker record");
  assert.deepStrictEqual(product.verifyHir(decoded.value, contextFor(decoded.value)), []);
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
