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
  while (pending.length > 0) {
    const [left, right, path] = pending.pop();
    if (right === null || typeof right !== "object") {
      assert.equal(Object.is(left, right), true, `${path}: exact scalar`);
      continue;
    }
    assert.equal(left !== null && typeof left === "object", true, `${path}: record or array`);
    assert.equal(Array.isArray(left), Array.isArray(right), `${path}: container kind`);
    let previous = paired.get(right);
    if (previous?.has(left)) continue;
    if (previous === undefined) { previous = new Set(); paired.set(right, previous); }
    previous.add(left);
    const names = Object.keys(right);
    assert.deepStrictEqual(Object.keys(left).sort(), [...names].sort(), `${path}: all declared keys`);
    for (const name of names) pending.push([left[name], right[name], `${path}.${name}`]);
  }
}

function roundtrip(value, label) {
  const text = product.printHir(value);
  const decoded = product.parseHir(text);
  assert.equal(decoded.kind, "parsed", `${label}: declared parse arm`);
  if (decoded.kind !== "parsed") assert.fail(`${label}: invalid text ${JSON.stringify(decoded)}`);
  assertComplete(decoded, { kind: "parsed", value }, label);
  assert.equal(decoded.value.bodies[0].root === decoded.value.tree, true, `${label}: SAME body root, not a copied tree`);
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
