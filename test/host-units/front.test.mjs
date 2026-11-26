import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { capturedCauses } from "./fixtures/captured-causes.mjs";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture, navigationCapture, rawComponentPath } from "./fixtures/front/checked-module.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index.js", "options.js", "checker.js", "handles.js", "lower-imports.js", "diagnostics.js"].map(name => resolve(repository, "packages/host/dist/front", name));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let front;
let optionModule;
let checkerModule;
let sdk;
let ids;
let snapshots;
let packageOf;
let moduleOf;
let bundled;
let projectSnapshot;
let preparedSource;
let openAndCapture;
let openedModule;
let lowerDepsFor;
let checkedModuleOf;
let checkedModulesOf;
let verifyChecked;
let captureSyntaxOf;

function lowerWithReadyExports(deps, raw) {
  const exported = front.lowerModuleExports(deps, raw);
  assert.equal(exported.kind, "ok");
  return lowerSingleCheckedModule(front, { ...deps, exportsOf: module => module === raw.module ? exported.value : null }, raw);
}

test("native inferred storage keeps the exact alias of its binding, not its structural shape", () => {
  const { raw } = checkedModuleOf(`
    export type Box = { flag: boolean };
    export type Other = { flag: boolean };
    export function read(before: Box, after: Other): boolean {
      let original = before;
      let distinct = after;
      let plain = true;
      let annotated: Box = before;
      return plain;
    }
  `);
  const [box, other, reader] = raw.tree.statements.nodes;
  const declarations = reader.body.statements.nodes.slice(0, 4).map(statement => statement.declarationList.declarations.nodes[0]);
  const alias = declaration => raw.checkerViews.find(row => row.node.module === raw.module && row.node.node === declaration.id).inferredStorageAlias;
  assert.deepEqual(declarations.map(alias), [{ module: raw.module, node: box.id }, { module: raw.module, node: other.id }, null, null]);
});

test("checked inferred storage retains all cell inputs across an ordinary by-value call and an actual replacement", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const { checked, interner } = checkedModuleOf(`
    export type Box = { flag: boolean };
    export function accept(box: Box): boolean { return box.flag; }
    export function read(before: Box, after: Box): boolean {
      let alias = before;
      accept(alias);
      alias = after;
      return alias.flag;
    }
  `);
  const declarationOf = value => value.tree.statements.nodes[2].body.statements.nodes[0].declarationList.declarations.nodes[0];
  const bound = declarationOf(checked).tsonic.inferredTypeBound.value;
  assert.equal(bound.alias, checked.tree.statements.nodes[0].tsonic.definition);
  assert.deepEqual(bound.sources, [0, 1]);
  assert.deepEqual(verifyChecked(checked, interner), []);
  const decoded = hir.parseHir(hir.printHir(checked));
  assert.equal(decoded.kind, "parsed");
  assert.deepEqual(declarationOf(decoded.value).tsonic.inferredTypeBound.value, bound);
  assert.deepEqual(verifyChecked(decoded.value, interner), []);
  declarationOf(decoded.value).tsonic.inferredTypeBound.value.sources.pop();
  assert.deepEqual(verifyChecked(decoded.value, interner).map(row => row.rule), ["inferred-type-bound"]);
});

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "front tests run under the aggregate resource guard");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  front = await import("../../packages/host/dist/front/index.js");
  optionModule = await import("../../packages/host/dist/front/options.js");
  checkerModule = await import("../../packages/host/dist/front/checker.js");
  sdk = await import("@tsonic/tsts");
  ids = await import("../../packages/host/dist/ids/index.js");
  snapshots = await import("../../packages/host/dist/snapshot/index.js");
  ({ packageOf, moduleOf, bundled, projectSnapshot, preparedSource, openAndCapture, openedModule, lowerDepsFor,
    checkedModuleOf, checkedModulesOf, verifyChecked, captureSyntaxOf } = await loadFrontFixture());
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
    const directory = resolve(repository, ".temp/front-coverage");
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(result.length, runtimeFiles.length, "each front runtime file has real V8 evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    for (const file of report.files) {
      assert.equal(file.status, "covered", file.path);
      assert.equal(file.lines, 100, file.path);
      assert.equal(file.branches, 100, file.path);
      assert.equal(file.functions, 100, file.path);
    }
  } finally { session.disconnect(); }
});

test("checked scalar branches retain actual expression and arm identities, including a missing else", () => {
  for (const statements of ["if (flag) return a; else return b;", "if (flag) return a; return b;",
    "if (flag) { return a; } else { return b; }"]) {
    const { checked, interner } = checkedModuleOf(`export function choose(flag: boolean, a: number, b: number): number { ${statements} }`);
    assert.deepEqual(verifyChecked(checked, interner), []);
    const callable = checked.tree.statements.nodes[0];
    const branch = callable.body.statements.nodes[0];
    assert.equal(branch.kind, "IfStatement");
    assert.equal(branch.tsonic, null);
    assert.equal(branch.expression.parent, branch.id);
    assert.equal(branch.thenStatement.parent, branch.id);
    assert.equal(branch.elseStatement === null, statements === "if (flag) return a; return b;");
    if (branch.elseStatement !== null) assert.equal(branch.elseStatement.parent, branch.id);
  }
});

const identityKinds = new Set(["SourceFile", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "EnumDeclaration",
  "EnumMember", "ModuleDeclaration", "VariableDeclaration", "BindingElement", "Parameter", "TypeParameter", "PropertyDeclaration", "MethodDeclaration",
  "GetAccessor", "SetAccessor", "Constructor", "ClassStaticBlockDeclaration", "PropertySignature", "MethodSignature", "CallSignature",
  "ConstructSignature", "IndexSignature", "FunctionExpression", "ArrowFunction", "ClassExpression", "ExportAssignment", "NamespaceExport"]);

test("actual missing alias targets retain original published causes and an exported-value member keeps its assignment boundary", async () => {
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const sourceFiles = {
    "library.mts": "export function known(): boolean { return true; }\n",
    "first.mts": 'import { missing } from "./library.mjs"; export { missing };\n',
    "second.mts": 'import { missing } from "./library.mjs"; export { missing };\n',
    "value.cts": "function selected(): boolean { return true; } export = selected;\n",
    "member.mts": 'import { missing } from "./value.cjs"; export { missing };\n',
  };
  const opened = openAndCapture(projectSnapshot({ sourceFiles, libraries: bundled() }));
  const checked = OpenedProgram.checked(opened.program);
  const roots = checked.diagnostics;
  const originalMembers = roots.map(root => sdk.getDiagnosticRunMembers(root));
  const failures = [];
  for (const name of ["first.mts", "second.mts", "member.mts"]) {
    const module = moduleOf(packageOf("/project"), "src/" + name);
    const captured = captureSingleModule(front, opened.deps, opened.program, module);
    assert.equal(captured.kind, "ok");
    const file = checked.getSourceFile("/project/src/" + name);
    const numbering = OpenedProgram.syntax(opened.program).get("/project/src/" + name).outcome.numbering;
    const binding = captured.value.bindings.find(row => checked.ast.kindName(numbering.nodes[row.binding.node]) === "KindImportSpecifier");
    assert.equal(binding !== undefined, true);
    const queries = checked.getSourceFileQueries(file);
    const symbol = queries.checker.getSymbolAtLocation(checked.ast.name(numbering.nodes[binding.binding.node]));
    const step = queries.checker.getAliasStep(symbol);
    const target = step.kind === "exported-value-member" ? step.member : step;
    assert.equal(target.kind, "unresolved");
    const unavailable = binding.target.kind === "available" ? binding.target.value.member : binding.target;
    assert.equal(unavailable.kind, "unavailable");
    assert.equal(unavailable.reason, "checker-error");
    assert.equal(unavailable.causes.length, 1);
    const identity = unavailable.causes[0].diagnostic;
    assert.equal(identity.kind, "checker");
    assert.equal(identity.diagnostic.module, module);
    const published = roots.filter(root => root.file === file)[identity.diagnostic.index];
    assert.equal(sdk.getDiagnosticRunMembers(published).includes(target.cause), true, "actual original object membership, not code/span matching");
    assert.equal(captured.value.checkerDiagnostics[identity.diagnostic.index].message, sdk.flattenDiagnosticMessageText(published));
    if (step.kind === "exported-value-member") {
      assert.equal(binding.target.kind, "available");
      assert.equal(binding.target.value.kind, "member");
      const declarations = queries.checker.getSymbolDeclarations(step.exportAssignment);
      const reference = binding.target.value.through[0];
      const source = OpenedProgram.file(opened.program, reference.module);
      const actual = OpenedProgram.syntax(opened.program).get(checked.ast.getFileName(source.file)).outcome.numbering.nodes[reference.node];
      assert.equal(declarations.includes(actual), true, "the member failure cannot erase its actual export assignment");
      assert.equal(binding.target.value.key, unavailable);
      assert.equal(binding.target.value.origins, unavailable);
    } else assert.equal(binding.target.kind, "unavailable");
    const repeated = captureSingleModule(front, opened.deps, opened.program, module);
    assert.equal(repeated.kind, "ok");
    assert.deepEqual(repeated.value.bindings, captured.value.bindings);
    failures.push({ cause: target.cause, identity });
  }
  assert.equal(failures[0].cause !== failures[1].cause, true, "same-name failures retain distinct actual producers");
  assert.equal(failures[0].identity.diagnostic.module !== failures[1].identity.diagnostic.module, true);
  assert.equal(checked.diagnostics === roots && roots.every((root, index) => {
    const members = sdk.getDiagnosticRunMembers(root);
    return members.length === originalMembers[index].length && members.every((member, position) => member === originalMembers[index][position]);
  }), true, "Source consumes without emitting or replacing a checker root");
});

test("actual imports retain their qualified B1 bindings without inventing declaration identities", async () => {
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const declarations = 'function original(x:number):number {return x;} export {original,original as default};\n';
  for (const imported of [
    'import {original} from "./a.js";',
    'import {original as renamed} from "./a.js";',
    'import {"original" as renamed} from "./a.js";',
    'import selected from "./a.js";',
    'import selected, {original as renamed} from "./a.js";',
    'import * as names from "./a.js";',
    'import selected, * as names from "./a.js";',
    'import type {original} from "./a.js";',
    'import {type original} from "./a.js";',
    'import {} from "./a.js";',
    'import "./a.js";',
  ]) {
    const actual = checkedModulesOf({ "a.ts": declarations, "b.ts": imported + "\n" });
    const module = actual.modules[1];
    for (const checked of actual.modules) assert.deepEqual(verifyChecked(checked, actual.interner, actual.modules), [], imported);
    const statement = module.tree.statements.nodes[0];
    assert.equal(statement.kind, "ImportDeclaration");
    assert.deepEqual(statement.tsonic.target, { kind: "available", value: { target: "project", module: actual.modules[0].module } });
    assert.equal(statement.tsonic.bindings.length, module.bindings.length);
    assert.equal(statement.moduleSpecifier.tsonic.role, "module-specifier");
    const bindingSyntax = new Set(["ImportClause", "ImportSpecifier", "NamespaceImport"]);
    const occurrences = indexSyntaxTree(module.tree).filter(node => bindingSyntax.has(node.kind));
    for (const occurrence of occurrences) {
      assert.equal(module.items.some(item => item.node === occurrence.id), false, "ordinary import syntax is not a fabricated F1 declaration");
      assert.equal(occurrence.tsonic.bindings.length, occurrence.kind === "ImportClause" && occurrence.name === null ? 0 : 1);
      for (const binding of occurrence.tsonic.bindings)
        assert.equal(binding.value.node, occurrence.id, "metadata retains this syntax's actual nearest occurrence");
    }
    const again = lowerSingleCheckedModule(front, actual.deps, actual.captured[1].raw);
    assert.equal(again.kind, "ok");
    assert.deepEqual(again.value, module);
  }
});

test("import lowering preserves an unavailable captured link and rejects unwritten or inconsistent forms", async () => {
  const { lowerImportDeclaration } = await import("../../packages/host/dist/front/lower-imports.js");
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const actual = checkedModulesOf({
    "a.ts": 'function original(x:number):number {return x;} export {original as default};\n',
    "b.ts": 'import selected from "./a.js";\n',
  });
  const raw = actual.captured[1].raw;
  const source = raw.tree.statements.nodes[0];
  const checked = actual.modules[1].tree.statements.nodes[0];
  const nodes = indexSyntaxTree(actual.modules[1].tree);
  const inputs = {
    core: node => nodes[node].tsonic.core,
    binding: node => actual.deps.sourceOccurrenceOf({ module: raw.module, node })?.occurrence ?? assert.fail("the actual binding is required"),
    target: () => checked.tsonic.target,
  };
  for (const changed of [{ ...source, attributes: {} }, { ...source, modifiers: {} },
    { ...source, moduleSpecifier: source.importClause.name }]) {
    assert.throws(() => lowerImportDeclaration(inputs, changed), /unwritten form passed the frontier/);
    const replacement = { ...raw, tree: { ...raw.tree,
      statements: { ...raw.tree.statements, nodes: [changed] } } };
    assert.throws(() => lowerSingleCheckedModule(front, actual.deps, replacement), /checked annotation not implemented: ImportDeclaration with/);
  }
  assert.throws(() => lowerImportDeclaration({ ...inputs, binding: () => null }, source), /default import lost its actual binding/);
  const unavailable = { ...raw, links: raw.links.map(link => ({ ...link,
    resolution: { kind: "unavailable", reason: "incomplete-association", causes: [] } })) };
  const result = lowerSingleCheckedModule(front, actual.deps, unavailable);
  assert.equal(result.kind, "ok");
  const imported = result.value.tree.statements.nodes[0];
  assert.deepEqual(imported.tsonic.target, { kind: "unavailable", reason: "incomplete-association", causes: [] });
  assert.equal(imported.tsonic.target === imported.moduleSpecifier.tsonic.target, true, "one captured link projection, no guessed module");
});

test("K-3236: the authored identity inputs obey the law they state: kinds of F-1, owners before members, ordinals counted across kinds per owner and name", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  assert.deepEqual(cases.map(entry => entry.name), ["type-then-value", "value-then-type", "type-and-value-uses", "overloads", "function-with-namespace",
    "class-with-interface", "unnamed-class-members", "unnamed-signatures", "augmentation-and-reexport", "default-expression", "default-declarations",
    "external-export-equals", "authored-export-equals", "locals-in-blocks", "augmentation-before-original", "merged-class-interface-uses",
    "default-expression-order", "expression-owners", "accessors-and-static", "same-kind-merges", "enum-and-type-parameters", "binding-elements",
    "member-name-sources", "module-declaration-forms", "renamed-reexports", "object-literal-members"]);
  const key = path => JSON.stringify(path);
  for (const entry of cases) {
    assert.equal(entry.rule.length > 20, true, entry.name);
    const declared = new Map();
    for (const [file, rows] of Object.entries(entry.definitions ?? {})) {
      assert.equal(Object.hasOwn(entry.files, file), true, `${entry.name}: ${file} is a file of the case`);
      assert.deepEqual(rows[0], { kind: "SourceFile", path: [] }, `${entry.name}: the module's own definition comes first`);
      const seen = new Set();
      const counts = new Map();
      for (const row of rows) {
        assert.equal(identityKinds.has(row.kind), true, `${entry.name}: ${row.kind}`);
        assert.equal(seen.has(key(row.path)), false, `${entry.name}: one identity per declaration in ${file}`);
        seen.add(key(row.path));
        if (row.path.length === 0) continue;
        const owner = row.path.slice(0, -1);
        const [name, ordinal] = row.path.at(-1);
        assert.equal(seen.has(key(owner)), true, `${entry.name}: the owner of ${key(row.path)} is declared before it`);
        const counter = `${key(owner)} ${JSON.stringify(name)}`;
        assert.equal(ordinal, counts.get(counter) ?? 0, `${entry.name}: ${key(row.path)} is the next declaration of that name in its owner, whatever its kind`);
        counts.set(counter, ordinal + 1);
      }
      declared.set(file, seen);
    }
    const resolves = (file, member) => typeof member[0] === "string" && Array.isArray(member[1]) && typeof member[1][0] !== "string" && typeof member[1][0] !== "number"
      ? declared.get(member[0]).has(key(member[1])) : declared.get(file).has(key(member));
    for (const [file, names] of Object.entries(entry.exports ?? {})) for (const [name, group] of Object.entries(names)) {
      assert.equal(group.length > 0, true, `${entry.name}: the group of ${name} is not empty`);
      for (const member of group) assert.equal(resolves(file, member), true, `${entry.name}: ${name} names a declaration of the case`);
    }
    for (const use of entry.uses ?? []) for (const member of use.group) assert.equal(resolves(use.file, member), true, `${entry.name}: ${use.occurrence}`);
  }
});

test("the identity inputs agree with the parser: the declaration nodes the checker's parser finds in each source are the rows, kind by kind in preorder; each row's owner is the nearest enclosing node that has a row; each row's name is the name its node gives it", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  const expressions = new Set(["FunctionExpression", "ArrowFunction", "ClassExpression"]);
  const holdsNoIdentity = new Set(["VariableDeclaration", "BindingElement"]);
  const unnamed = new Set(["Constructor", "ClassStaticBlockDeclaration", "CallSignature", "ConstructSignature", "IndexSignature"]);
  let compared = 0;
  let otherwiseNamed = 0;
  for (const entry of cases) {
    const parsed = parseSources(new Map(Object.entries(entry.files).map(([path, text]) => [path.slice(1), text])));
    const { ast } = parsed;
    for (const [path, rows] of Object.entries(entry.definitions ?? {})) {
      const file = parsed.getSourceFiles().find(candidate => ast.getFileName(candidate) === `/host-gate${path}`);
      assert.notEqual(file, undefined, `${entry.name}: ${path} is parsed`);
      const queries = parsed.getSourceFileQueries(file);
      // The name a node gives its row, by F-1's name sources: an identifier or private name as written; a string or numeric name by its
      // text; a computed name by the constant key the checker resolved; no name for a constructor, static block, signature, expression
      // or pattern holder; the export name for an anonymous default declaration and for an export assignment.
      const nameOf = (node, kind) => {
        if (expressions.has(kind) || unnamed.has(kind)) return "";
        if (kind === "ExportAssignment") return /^export\s*=/u.test(ast.getSourceText(file).slice(ast.pos(node), ast.end(node)).trim()) ? "export=" : "default";
        const name = ast.name(node);
        if (name === undefined) return "default";
        if (ast.is.IsIdentifier(name)) return ast.text(name);
        if (ast.is.IsPrivateIdentifier(name) || ast.is.IsStringLiteral(name) || ast.is.IsNumericLiteral(name)) {
          otherwiseNamed += 1;
          return ast.text(name);
        }
        if (ast.is.IsComputedPropertyName(name)) {
          otherwiseNamed += 1;
          const expression = ast.as.AsComputedPropertyName(name).Expression;
          return ast.is.IsStringLiteral(expression) || ast.is.IsNumericLiteral(expression) ? ast.text(expression)
            : queries.typeShape.getStringLiteralTypeValue(queries.checker.getTypeAtLocation(expression)?.type);
        }
        return "";
      };
      const found = [];
      const visit = (node, owner) => {
        const kind = ast.kindName(node).replace(/^Kind/u, "");
        const name = identityKinds.has(kind) && kind !== "SourceFile" ? ast.name(node) : undefined;
        const holdsPattern = name !== undefined && !ast.is.IsIdentifier(name) && holdsNoIdentity.has(kind);
        let inner = owner;
        // K-3268 items 1 and 2: a variable declaration or binding element that holds a pattern has no identity; a parameter that holds one
        // has. K-3273: the owner of a row is the nearest enclosing node that has a row, with no exception.
        if (identityKinds.has(kind) && !holdsPattern) {
          found.push({ kind, name: kind === "SourceFile" ? null : nameOf(node, kind), owner });
          inner = found.length - 1;
        }
        ast.forEachChild(node, child => { if (child !== undefined) visit(child, inner); });
      };
      visit(file, null);
      assert.deepEqual(rows.map(row => row.kind), found.map(node => node.kind), `${entry.name}: ${path}: one row per declaration node, in preorder`);
      rows.forEach((row, index) => {
        const node = found[index];
        if (node.owner === null) return assert.deepEqual(row.path, [], `${entry.name}: ${path}: the module's own row`);
        assert.equal(row.path.at(-1)[0], node.name, `${entry.name}: ${path}: the name of row ${index} (${row.kind})`);
        assert.deepEqual(row.path.slice(0, -1), rows[node.owner].path, `${entry.name}: ${path}: the owner of row ${index} (${row.kind} ${JSON.stringify(row.path)})`);
      });
      compared += rows.length;
    }
  }
  assert.equal(compared > 200, true, "the comparison ran over the rows of every case");
  assert.equal(otherwiseNamed, 8, "the rows named by something other than an identifier are compared too: three string-named modules, a private name, two computed names, a numeric and a quoted member name");
});

test("the checker package that Host's built output loads is this worktree's own, and it is the one instance these cases use", () => {
  const fromHost = import.meta.resolve("@tsonic/tsts", pathToFileURL(resolve(repository, "packages/host/dist/front/checker.js")).href);
  const own = pathToFileURL(realpathSync(resolve(repository, "packages/tsts/dist/src/index.js"))).href;
  assert.equal(fromHost, own, "resolved inside the worktree");
  assert.equal(import.meta.resolve("@tsonic/tsts"), own, "the cases build their inputs with the same module instance");
  assert.equal([...process.execArgv, ...(process.env.NODE_OPTIONS ?? "").split(" ")].some(option => option.startsWith("--preserve-symlinks")), false,
    "symbolic-link preservation is off, so a linked and a direct path load one instance");
});

function declarationProvider(id, specifier, providerModuleId, rangeStart = 9_900_000) {
  return { identity: { id, version: "1.0.0", extensionContractVersion: sdk.TstsSourceProviderContractVersion, diagnosticRange: { start: rangeStart, end: rangeStart + 99 } },
    declarationMaterialization: "complete",
    ownsModule: requested => requested === specifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: requested => ({ kind: "virtual", moduleSpecifier: requested, virtualFileName: `/provider/${providerModuleId.replaceAll(".", "/")}.d.ts`, providerModuleId }),
    getDeclarationModel: () => ({ moduleSpecifier: specifier, providerModuleId, exports: [{ id: "Value", name: "Value", kind: "value", type: { kind: "number" } }] }) };
}
const reference = (root, exportId = "provider") => ({ package: packageOf(root), moduleSpecifier: "./plugin.js", exportId, version: "1" });
const providerRegistration = (root, provider) => ({ reference: reference(root), value: { kind: "declaration-provider", value: provider } });

test("layout capture retains the same selected application and authored operands without computing geometry", async () => {
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { create } = layoutInput(await loadFrontFixture());
  const input = create("export const descriptor = make<boolean>({ stride: 8, fields: [], bytesize: 8, bytealignment: 8, datalayout: Abi }); export const width = measure(descriptor);");
  const { snapshot, extensions, limits } = input;
  const deps = { extensions, navigationCapture: limits.navigationCapture, literalCapture: limits.evaluation };
  const opened = front.openCheckedProgram(deps, snapshot);
  assert.equal(opened.kind, "ok", JSON.stringify(opened.diagnostics));
  const result = captureSingleModule(front, deps, opened.value, snapshot.entryPoint);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const raw = result.value;
  const [construct, observe] = raw.calls;
  const [make, measure] = [construct, observe].map(call => raw.types.candidates[call.candidates].candidates[0]);
  const construction = raw.core[construct.invocation.node].metadata.value;
  const query = raw.core[observe.invocation.node].layoutQuery.value;
  assert.deepEqual([construction.kind, construction.construction, query.operation], ["layout-construction", "value", "size"]);
  assert.equal(raw.types.memoryDescriptors[0] === construction, true);
  assert.deepEqual(raw.core[construct.invocation.node].provider.value.node, construction.declaration);
  assert.deepEqual(raw.core[observe.invocation.node].provider.value.node, query.declaration);
  assert.equal(construction.application === make.application && query.application === measure.application, true);
  assert.equal(query.operands === measure.sourceArguments, true);
  const rawDescriptor = raw.tree.statements.nodes[1].declarationList.declarations.nodes[0].initializer.arguments.nodes[0];
  assert.equal(construction.descriptor.node, rawDescriptor.id);
  assert.equal(make.sourceArguments[0].expression.node, rawDescriptor.id);
  assert.deepEqual(Object.values(construction.geometry).map(row => row.expression.node),
    [4, 2, 3, 0].map(index => rawDescriptor.properties.nodes[index].initializer.id));
  assert.equal(Object.hasOwn(construction, "byteSize"), false);
  assert.equal(Object.hasOwn(query, "value"), false);
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const tree = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module.tree;
  const layout = tree.statements.nodes[1].declarationList.declarations.nodes[0].initializer;
  const observation = tree.statements.nodes[2].declarationList.declarations.nodes[0].initializer;
  const capture = layout.tsonic.memory.value;
  assert.equal(capture.kind, "value");
  const body = checked.value.checked;
  const descriptor = layout.arguments.nodes[0];
  const namedOperands = new Map(descriptor.properties.nodes.map(property => [property.name.text, property.initializer]));
  for (const [position, reference] of [capture.geometry.dataLayoutExpression, capture.geometry.byteSizeExpression,
    capture.geometry.byteAlignmentExpression, capture.geometry.strideExpression].entries())
    assert.equal(body.nodeOf(reference) === namedOperands.get(["datalayout", "bytesize", "bytealignment", "stride"][position]), true);
  const checkedModule = checked.value.modules.find(row => row.module.module === snapshot.entryPoint).module;
  const descriptorItem = checkedModule.items.find(row => row.node === layout.id);
  assert.equal(body.nodeOf({ kind: "item", value: { owner: descriptorItem.definition, node: descriptorItem.node } }) === layout, true);
  assert.deepEqual(ids.decodeDefId(descriptorItem.definition).value.segments.at(-1), { name: "", ordinal: 0 });
  assert.equal(checked.value.descriptions.get(descriptorItem.definition).parent,
    tree.statements.nodes[1].declarationList.declarations.nodes[0].tsonic.declaration.definition);
  assert.equal(checkedModule.items.some(row => row.node === observation.id), false);
  const actualBodies = checkedModule.bodies.filter(candidate => ids.decodeBodyId(candidate.body).value.role === "layout-operand");
  assert.equal(actualBodies.length, 3);
  for (const candidate of actualBodies) {
    const identity = ids.decodeBodyId(candidate.body).value;
    assert.equal(candidate.root === [...namedOperands.values()].find(operand => operand.id === identity.ordinal), true);
    assert.equal(candidate.owner, tree.statements.nodes[1].declarationList.declarations.nodes[0].tsonic.declaration.definition);
  }
  const selectedObservation = observation.tsonic.observation.value;
  assert.equal(selectedObservation.operation, "size");
  assert.equal(body.nodeOf({ kind: "body", value: selectedObservation.operand }) === observation.arguments.nodes[0], true);
  const { resolveCheckedLayout } = await import("../../packages/host/dist/ir-hir/index.js");
  const { chargeWork, chargeResultEntries, accountFailure, remainingWork } = await import("../../packages/host/dist/dataflow/index.js");
  function resolveAt(limit, operand, readers = body, bindings = checked.value.bindingOf) {
    const meter = createAccount({ maximumWork: limit, maximumResultEntries: 100 });
    const resolution = resolveCheckedLayout({ ...readers, bindingOf: bindings,
      admit: (work, records) => chargeWork(meter, work) ?? (records === 0 ? null : chargeResultEntries(meter, records)) }, operand);
    if (resolution.kind !== "complete") assert.equal(resolution.stop === accountFailure(meter), true);
    return { resolution, work: limit - remainingWork(meter) };
  }
  const operand = { kind: "body", value: selectedObservation.operand };
  const resolved = resolveAt(100, operand);
  assert.equal(resolved.resolution.kind, "complete");
  assert.equal(resolved.resolution.value.capture === capture, true);
  assert.equal(resolved.resolution.value.node === layout, true);
  assert.equal(resolved.resolution.value.definition, descriptorItem.definition);
  assert.equal(resolved.work > 0, true);
  for (let maximum = 0; maximum < resolved.work; maximum += 1) {
    assert.equal(resolveAt(maximum, operand).resolution.kind, "resource-stop", String(maximum));
  }
  assert.equal(resolveAt(0, operand, { ...body, nodeOf: () => assert.fail("an unadmitted operand is unread") }).resolution.kind, "resource-stop");
  assert.deepEqual(resolveAt(100, { kind: "body", value: { ...selectedObservation.operand, body: actualBodies[0].body } }).resolution,
    { kind: "complete", value: null });
  assert.deepEqual([capture.geometry.byteSize.kind, selectedObservation.value.kind], ["unavailable", "unavailable"]);
  const typed = typeSourceBarrier(input, checked.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const chapter = typed.value.modules.get(snapshot.entryPoint);
  const parametric = chapter.bodies.filter(candidate => candidate.bindings.kind === "parametric");
  const actualCall = parametric.find(candidate => candidate.root.id === layout.id).root;
  assert.equal(actualCall.tsonic.layout, "value-layout");
  assert.equal(actualCall.arguments.kind, "layout-quote");
  assert.equal(actualCall.arguments.descriptor === descriptor, true);
  for (const operand of actualBodies) {
    const placed = parametric.find(candidate => candidate.body === operand.body);
    assert.equal(actualCall.arguments.operands.find(argument => argument.source.body === placed.body)?.root === placed.root, true);
  }
  const { printTir, parseTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const selected = chapter.bodies.find(candidate => candidate.bindings.kind === "instantiated" && candidate.root.id === observation.id);
  assert.equal(selected.root.tsonic.layout, "size");
  const typedText = printTir(selected);
  const parsed = parseTir(typedText);
  assert.equal(parsed.kind, "parsed");
  assert.equal(printTir(parsed.value), typedText);
  const proof = typed.value.verifierOf(chapter.module);
  const bound = verifyTir(proof, tirReadyReadAdmission(createAccount(input.limits.dataflow)));
  const template = parametric.find(candidate => candidate.root === actualCall);
  assert.deepEqual(bound(template), { kind: "complete", violations: [] });
  const originalOperands = actualCall.arguments.operands;
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const values = originalOperands.slice();
  const value = values[0];
  let operandMeter;
  const reached = [];
  Object.defineProperty(values, 0, { get() {
    reached.push(InvocationAccount.stateOf(operandMeter).work);
    return value;
  } });
  const traced = { ...template, root: { ...actualCall, arguments: { ...actualCall.arguments, operands: values } } };
  function verifyTraced(maximumWork) {
    operandMeter = createAccount({ ...input.limits.dataflow, maximumWork });
    return verifyTir(proof, tirReadyReadAdmission(operandMeter))(traced);
  }
  assert.equal(verifyTraced(input.limits.dataflow.maximumWork).kind, "complete");
  assert.equal(reached.length, 1, "authored and semantic scans must not pull a geometry overlay");
  const firstRead = reached.pop();
  const cut = verifyTraced(firstRead - 1);
  assert.equal(cut.kind, "resource-stop");
  assert.equal(cut.stop === accountFailure(operandMeter), true);
  assert.deepEqual(reached, []);
  const direct = bound({ ...template, root: { ...actualCall,
    arguments: { ...actualCall.arguments, descriptor: { ...descriptor } } } });
  assert.equal(direct.kind, "complete");
  assert.equal(direct.violations.some(row => row.rule === "module-node-identity" && row.site.node === descriptor.id), true);
  const extra = bound({ ...template, root: { ...actualCall,
    arguments: { ...actualCall.arguments, operands: [{ ...originalOperands[0], root: originalOperands[1].root }, ...originalOperands.slice(1)] } } });
  assert.equal(extra.kind, "complete");
  assert.equal(extra.violations.some(row => row.rule === "module-node-identity" && row.site.node === actualCall.id), true);
  const quoteWire = printTir(template);
  const restored = parseTir(quoteWire);
  assert.equal(restored.kind, "parsed");
  assert.equal(printTir(restored.value), quoteWire);
  const crossedWire = quoteWire.replace(/descriptor=(c:\d+)/u, (_, wire) => "descriptor=n:" + wire.slice(2));
  assert.notEqual(crossedWire, quoteWire);
  assert.equal(parseTir(crossedWire).kind, "invalid-text");
  const changed = { ...selected, root: { ...selected.root, tsonic: { ...selected.root.tsonic, layout: "alignment" } } };
  const refused = bound(changed);
  assert.equal(refused.kind, "complete");
  assert.equal(refused.violations.some(row => row.rule === "layout-call-exact" && row.site.node === observation.id), true);
  assert.equal(typed.value.required.operations.every(operation => operation.kind === "body"), true);
  assert.equal(typed.value.required.operations.some(operation => operation.execution.instance.body === selected.body), true);
  for (const candidate of chapter.bodies.filter(candidate => typed.value.layoutOnly(candidate)))
    assert.equal(typed.value.required.operations.some(operation => operation.execution.instance.body === candidate.body), false);
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { lowerToMir } = await import("../../packages/host/dist/lower-mir/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const interner = checked.value.types;
  const defs = { completionSelector: types.internType(interner, { kind: "primitive", primitive: "int32" }),
    exceptionStorage: types.internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) };
  const unit = { request: { query: "layout-observation", key: [] }, position: { kind: "result" } };
  const lowered = lowerToMir({ defs, typeOf: type => types.readType(interner, type),
    signatureOf: signature => types.readSignature(interner, signature), limits: input.limits.lowering, unit }, selected, [], [0]);
  assert.equal(lowered.kind, "ok", JSON.stringify(lowered.diagnostics));
  assert.deepEqual(lowered.value.constants.map(row => row.value), [{ kind: "observation", at: { body: selected.body, node: observation.id } }]);
  assert.equal(lowered.value.blocks.some(row => row.terminator.kind === "call"), false);
  const verified = verifyMir(lowered.value, { selectedNativeFacts: input.snapshot.nativeFacts, limits: input.limits.mirVerification,
    source: selected, bodyOf: proof.bodyOf, types: types.viewTypes(interner), declarationOf: proof.declarationOf,
    bodyOwner: body => checked.value.checked.bodies.get(body)?.owner ?? null, requiredEntries: [0] });
  assert.deepEqual(verified.violations, []);

  const pairedInput = create("export const width = measure(make<boolean>({ datalayout: Abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] }))"
    + " + measure(make<boolean>({ datalayout: Abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [] }));");
  const paired = pairedInput.snapshot;
  const pair = captureSourceBarrier(pairedInput);
  assert.equal(pair.kind, "ok", JSON.stringify(pair.diagnostics));
  const pairedModule = pair.value.modules.find(row => row.module.module === paired.entryPoint);
  const constructors = pairedModule.module.items.filter(item => pairedModule.nodes[item.node].kind === "CallExpression")
    .sort((left, right) => left.node - right.node);
  assert.equal(constructors.length, 2);
  assert.deepEqual(constructors.map(item => ids.decodeDefId(item.definition).value.segments.at(-1)),
    [{ name: "", ordinal: 0 }, { name: "", ordinal: 1 }]);
  assert.equal(new Set(constructors.map(item => pair.value.descriptions.get(item.definition).parent)).size, 1);
  const { verifyHir } = await import("../../packages/host/dist/ir-hir/index.js");
  const itemNodes = new Map(constructors.map((item, ordinal) => [item.definition, constructors[1 - ordinal].node]));
  const crossed = { ...pairedModule.module, items: pairedModule.module.items.map(item => ({ ...item, node: itemNodes.get(item.definition) ?? item.node })) };
  const findings = verifyHir(crossed, {
    types: types.viewTypes(pair.value.types), moduleOf: module => pair.value.modules.find(row => row.module.module === module)?.module ?? null,
    bodyPathOf: id => ids.decodeBodyId(id).value, definitionPathOf: id => pair.value.definitionPaths.get(id) ?? null,
    bindingScopeOf: id => pair.value.descriptions.get(id)?.generics ?? null,
    bindingScopeAt: ref => pair.value.descriptions.get(ref.kind === "item" ? ref.value.owner : pair.value.checked.bodies.get(ref.value.body)?.owner)?.generics ?? null,
    nominalOf: pair.value.nominalOf, nodeOf: pair.value.checked.nodeOf, localExists: pair.value.checked.localExists,
  });
  assert.equal(findings.filter(row => row.rule === "definition-reference"
    && row.detail.some(detail => detail.value === "a layout definition retains its exact authored unnamed sibling ordinal")).length, 2);
});

test("field constructor and offset preserve their independent actual selector slots and checked member identities", async () => {
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const fixture = await loadFrontFixture();
  const { create } = layoutInput(fixture);
  const prefix = `interface Header { tag: boolean; payload: boolean }
    const word = make<boolean>({ datalayout: Abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });`;
  const input = create(`${prefix}
    const selected = field<Header, boolean>({ select: (value: Header) => value.payload, fieldlayout: word, byteoffset: 8, bytealignment: 8 });
    const header = make<Header>({ datalayout: Abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [selected] });
    export const result = offset<Header, boolean>(header, (record: Header) => record.payload);`);
  const capture = ({ snapshot, extensions, limits }) => {
    const deps = { extensions, navigationCapture: limits.navigationCapture, literalCapture: limits.evaluation };
    const opened = front.openCheckedProgram(deps, snapshot);
    assert.equal(opened.kind, "ok", JSON.stringify(opened.diagnostics));
    return captureSingleModule(front, deps, opened.value, snapshot.entryPoint);
  };
  const captured = capture(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const { value } = captured;
  const constructor = value.types.memoryDescriptors.find(row => row.construction === "field");
  const query = value.core.find(row => row.layoutQuery.kind === "available" && row.layoutQuery.value?.operation === "field-offset").layoutQuery.value;
  const [physical, requested] = [constructor.selector, query.selector].map(selector => {
    const use = value.memberUses.find(row => row.occurrence.node === selector.access.node);
    assert.deepEqual(use.receiver, selector.receiver);
    assert.equal(value.types.types[use.receiverType].form.value.kind, "declared");
    return use;
  });
  assert.notDeepEqual(constructor.selector.formal, query.selector.formal);
  assert.deepEqual(physical.selectedDeclaration, requested.selectedDeclaration);
  const accessRoots = [constructor.selector.access, query.selector.access];
  const definitions = identifySingleModule(front, { module: value, componentRoots: accessRoots });
  assert.equal(definitions.kind, "ok");
  for (const root of accessRoots) {
    const position = definitions.value.sourceOccurrences.find(row => row.node === root.node).occurrence;
    assert.equal(position.kind, "body");
    assert.equal(ids.decodeBodyId(position.value.body).value.role, "initializer");
  }
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const chapter = checked.value.modules.find(row => row.module.module === input.snapshot.entryPoint);
  const selectors = chapter.nodes.filter(node => node.kind === "ArrowFunction" && node.tsonic.role === "layout-selector");
  assert.equal(selectors.length, 2);
  assert.equal(selectors[0].tsonic.member.primary, selectors[1].tsonic.member.primary);
  assert.notDeepEqual(selectors[0].tsonic.formal, selectors[1].tsonic.formal);
  assert.deepEqual(selectors[0].tsonic.member.bindings, selectors[1].tsonic.member.bindings);
  for (const arrow of selectors) {
    assert.equal(chapter.module.bodies.some(body => body.owner === arrow.tsonic.definition || body.root === arrow.body), false);
    assert.equal(arrow.parameters.nodes[0].tsonic.declaration.kind, "definition");
  }
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { printTir, parseTir, verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const typed = typeSourceBarrier(input, checked.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const typedChapter = typed.value.modules.get(input.snapshot.entryPoint);
  const body = typedChapter.bodies.find(candidate => candidate.bindings.kind === "parametric" &&
    candidate.root.kind === "CallExpression" && candidate.root.tsonic.layout === "field-offset");
  const original = chapter.nodes[body.root.id];
  const args = body.root.arguments;
  assert.equal(args.kind, "field-offset-quote");
  assert.equal(args.layout.id, original.arguments.nodes[0].id);
  assert.equal(args.selector === original.arguments.nodes[1], true);
  const wire = printTir(body);
  const roundtrip = parseTir(wire);
  assert.equal(roundtrip.kind, "parsed", JSON.stringify(roundtrip.diagnostics));
  assert.equal(printTir(roundtrip.value), wire);
  const crossedPhase = wire.replace(/selector=c:(\d+)/u, "selector=n:$1");
  assert.notEqual(crossedPhase, wire);
  assert.equal(parseTir(crossedPhase).kind, "invalid-text");
  const expected = typed.value.verifierOf(typedChapter.module);
  const other = selectors.find(selector => selector !== args.selector);
  const crossedBody = { ...body, root: { ...body.root, arguments: { ...args, selector: other } } };
  const tested = verifyTir(expected, tirReadyReadAdmission(createAccount(input.limits.dataflow)))(crossedBody);
  assert.equal(tested.kind, "complete");
  assert.equal(tested.violations.some(row => row.rule === "node-reference" &&
    row.detail.some(detail => detail.value === "a field-offset selector must retain its exact nonexecuting checked occurrence")), true);
  const text = fixture.hir.printHir(chapter.module);
  const parsed = fixture.hir.parseHir(text);
  assert.equal(parsed.kind, "parsed", JSON.stringify(parsed.diagnostics));
  assert.equal(fixture.hir.printHir(parsed.value), text);
  const decoded = fixture.hir.indexSyntaxTree(parsed.value.tree);
  const [decodedField, decodedOffset] = decoded.filter(node => node.kind === "ArrowFunction" && node.tsonic.role === "layout-selector");
  const source = checked.value;
  const context = {
    moduleOf: module => module === parsed.value.module ? parsed.value : source.modules.find(row => row.module.module === module)?.module ?? null,
    types: fixture.types.viewTypes(source.types), bodyPathOf: body => ids.decodeBodyId(body).value,
    definitionPathOf: definition => source.definitionPaths.get(definition) ?? null,
    bindingScopeOf: definition => source.descriptions.get(definition)?.generics ?? null,
    bindingScopeAt: position => source.descriptions.get(position.kind === "item" ? position.value.owner
      : source.checked.bodies.get(position.value.body)?.owner)?.generics ?? null,
    nominalOf: source.nominalOf, nodeOf: source.checked.nodeOf, localExists: source.checked.localExists,
  };
  const selectorFinding = finding => finding.rule === "node-reference"
    && finding.detail.some(detail => detail.value === "a layout selector retains its actual call, formal and checked storage selection");
  assert.equal(fixture.hir.verifyHir(parsed.value, context).some(selectorFinding), false);
  const member = decodedField.tsonic.member;
  decodedField.tsonic.member = { ...member, selectedDeclarations: [] };
  assert.equal(fixture.hir.verifyHir(parsed.value, context).filter(selectorFinding).length, 1);
  decodedField.tsonic.member = member;
  decodedField.tsonic.formal = decodedOffset.tsonic.formal;
  assert.equal(fixture.hir.verifyHir(parsed.value, context).filter(selectorFinding).length, 1);
  const invalid = capture(create(`${prefix}
    export const result = field<Header, boolean>({ select: (value: Header) => { return value.payload; },
      fieldlayout: word, byteoffset: 8, bytealignment: 8 });`));
  assert.equal(invalid.kind, "refused");
  assert.equal(invalid.diagnostics.some(row => row.code.rendered === "TSONIC_LAYOUT_DESCRIPTOR_SYNTAX"
    && row.message.includes("direct non-optional property access")), true);
  const foreign = capture(create(`${prefix}
    const outside: Header = { tag: false, payload: true };
    export const result = field<Header, boolean>({ select: (value: Header) => outside.payload,
      fieldlayout: word, byteoffset: 8, bytealignment: 8 });`));
  assert.equal(foreign.kind, "refused");
  assert.equal(foreign.diagnostics.some(row => row.code.rendered === "TSONIC_LAYOUT_DESCRIPTOR_SYNTAX"
    && row.message.includes("own authored formal")), true);
  const missing = capture(create(`${prefix}
    export const result = field<Header, boolean>({ select: (value: Header) => value.missing,
      fieldlayout: word, byteoffset: 8, bytealignment: 8 });`));
  assert.equal(missing.kind, "refused");
  assert.equal(missing.diagnostics.some(row => row.code.rendered === "TS2339"), true);
  assert.equal(missing.diagnostics.some(row => row.code.rendered === "TSONIC_LAYOUT_DESCRIPTOR_SYNTAX"
    && row.message.includes("actual checked stored member")), true);
});

test("field offsets follow the actual containing layout and publish the selected qualified field", async () => {
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printModuleBodies, parseModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { create } = layoutInput(await loadFrontFixture());
  const source = (fields, selected, aliased = false) => `interface Header { tag: boolean; payload: boolean }
    const word = make<boolean>({ datalayout: Abi, bytesize: 8, bytealignment: 8, stride: 8, fields: [] });
    const tag = field<Header, boolean>({ select: (value: Header) => value.tag, fieldlayout: word, byteoffset: 0, bytealignment: 8 });
    const payload = field<Header, boolean>({ select: (value: Header) => value.payload, fieldlayout: word, byteoffset: 8, bytealignment: 8 });
    const header = make<Header>({ datalayout: Abi, bytesize: 16, bytealignment: 8, stride: 16, fields: [${fields}] });
    ${aliased ? "const alias = (header); const second = alias;" : ""}
    const first = true;
    export const ordinary = first;
    export const result = offset<Header, boolean>(${aliased ? "second" : "header"}, (record: Header) => record.${selected});`;
  const input = create(source("tag, payload", "payload"));
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const module = modules.find(row => row.module === input.snapshot.entryPoint);
  const [row] = module.bodies.flatMap(body => body.observations?.rows ?? []);
  assert.equal(row.operation, "field-offset");
  assert.equal(row.value, 8n);
  assert.notEqual(row.field.metadata.definition, row.layout.metadata.definition);
  const wire = printModuleBodies(index, module);
  const decoded = parseModuleBodies(index, wire);
  assert.equal(decoded.kind, "parsed", JSON.stringify(decoded.diagnostics));
  assert.equal(printModuleBodies(index, decoded.value), wire);
  const missing = analyzeHostProgram(create(source("tag", "payload")));
  assert.equal(missing.kind, "refused");
  assert.equal(missing.diagnostics.some(row => row.source === "metadata"
    && row.message === "The checked field selection does not belong to its actual containing value layout."), true);
  const opposite = analyzeHostProgram(create(source("tag, payload", "tag")));
  assert.equal(opposite.kind, "ok", JSON.stringify(opposite.diagnostics));
  const [other] = opposite.value.modules.flatMap(chapter => chapter.bodies.flatMap(body => body.observations?.rows ?? []));
  assert.equal(other.value, 0n);
  assert.notEqual(other.field.metadata.definition, row.field.metadata.definition);
  const ambiguous = analyzeHostProgram(create(source("payload, payload", "payload")));
  assert.equal(ambiguous.kind, "refused");
  assert.equal(ambiguous.diagnostics.some(row => row.source === "metadata"
    && row.message === "A field offset cannot select more than one authored field descriptor."), true);

  const aliased = create(source("tag, payload", "payload", true));
  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const { tirReadyReadAdmission } = await import("../../packages/host/dist/ir-program/index.js");
  const { unparenthesizedExpression, resolveCheckedLayoutAlias } = await import("../../packages/host/dist/ir-hir/index.js");
  const checked = captureSourceBarrier(aliased);
  assert.equal(checked.kind, "ok", JSON.stringify(checked.diagnostics));
  const typed = typeSourceBarrier(aliased, checked.value, createAccount(aliased.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const proof = typed.value.verifierOf(aliased.snapshot.entryPoint);
  const aliases = proof.module.bodies.filter(body => body.bindings.kind === "parametric" && body.root.kind !== "SourceFile" && body.root.kind !== "Block" &&
    unparenthesizedExpression(body.root).tsonic.resolution?.kind === "layout-descriptor");
  assert.equal(aliases.length, 2);
  const qualify = body => unparenthesizedExpression(body.root).tsonic.resolution.descriptor;
  assert.deepEqual(qualify(aliases[0]), qualify(aliases[1]));
  for (const body of aliases) {
    assert.equal(typed.value.required.operations.some(operation => operation.kind === "body" &&
      operation.execution.instance.body === body.body), false);
    assert.deepEqual(proof.layoutAliasOf(body.body).descriptor, qualify(body));
  }
  const leaf = aliases.find(body => body.root.kind === "Identifier");
  const crossed = { ...leaf, root: { ...leaf.root, tsonic: { ...leaf.root.tsonic, resolution: { kind: "layout-descriptor",
    descriptor: { kind: "body", value: { body: leaf.body, node: leaf.root.id } } } } } };
  const finding = verifyTir(proof, tirReadyReadAdmission(createAccount(aliased.limits.dataflow)))(crossed);
  assert.equal(finding.kind, "complete");
  assert.equal(finding.violations.some(row => row.rule === "layout-call-exact" && row.site.node === leaf.root.id), true);
  const cut = { stage: "before checked alias root" };
  assert.equal(resolveCheckedLayoutAlias({ ...checked.value.checked, bindingOf: checked.value.bindingOf, admit: () => cut },
    { ...checked.value.checked.bodies.get(leaf.body), get root() { assert.fail("unadmitted alias root"); } }).stop === cut, true);
  const published = analyzeHostProgram(aliased);
  assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
  const aliasModule = published.value.modules.find(row => row.module === aliased.snapshot.entryPoint);
  const [observed] = aliasModule.bodies.flatMap(body => body.observations?.rows ?? []);
  assert.equal(observed.value, 8n);
  assert.deepEqual(observed.field, row.field);
  assert.deepEqual(observed.layout, row.layout);
  assert.equal(aliasModule.bodies.some(entry => entry.kind === "selected" && entry.tir.root.kind === "Identifier" &&
    entry.tir.root.text === "first" && entry.tir.root.tsonic.resolution.kind === "static"), true);
  const aliasWire = printModuleBodies(published.value.index, aliasModule);
  const aliasDecode = parseModuleBodies(published.value.index, aliasWire);
  assert.equal(aliasDecode.kind, "parsed");
  assert.equal(printModuleBodies(published.value.index, aliasDecode.value), aliasWire);
});

test("selected native layout geometry reaches verified Program through the real constant and observation demands", async () => {
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printProgramIndex, parseProgramIndex, printModuleBodies, parseModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const { create: makeInput, native, baseline } = layoutInput(await loadFrontFixture());
  const descriptor = (byteSize, dataLayout = "Abi") =>
    `make<boolean>({ stride: 8, fields: [], bytesize: ${byteSize}, bytealignment: 8, datalayout: ${dataLayout} })`;
  const named = `const descriptor = ${descriptor("8")}; export const width = measure(descriptor);`;
  const inline = `export const width = measure(${descriptor("8")});`;
  const dependent = `const inner = ${descriptor("8")}; export const width = measure(${descriptor("measure(inner)")});`;
  for (const [text, expectedLayouts, expectedConstants] of [[named, 1, 3], [inline, 1, 3], [dependent, 2, 6]]) {
    const input = makeInput(text, baseline);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const data = index.metadata.find(record => record.kind === "data-layout");
    const layouts = index.metadata.filter(record => record.kind === "memory-layout");
    assert.equal(layouts.length, expectedLayouts);
    assert.equal(index.metadata.length, expectedLayouts + 1);
    assert.deepEqual([data.fingerprint, data.byteOrder, data.addressWidth], [native.fingerprint, native.byteOrder, native.addressWidth]);
    for (const layout of layouts) {
      const geometry = layout.layouts[layout.root];
      assert.equal(geometry.dataLayout, data.key.definition);
      assert.deepEqual([geometry.byteSize, geometry.byteAlignment, geometry.stride], [8n, 8n, 8n]);
    }
    assert.equal(index.constants.length, expectedConstants);
    for (const record of index.constants) {
      assert.equal(record.reference.context, "compile-time");
      assert.equal(ids.decodeBodyId(record.reference.initializer.body).value.role, "layout-operand");
      assert.deepEqual(record.value, { type: record.value.type, kind: "floating", bits: 0x4020000000000000n });
    }
    const selected = modules.find(chapter => chapter.module === input.snapshot.entryPoint);
    const observations = selected.bodies.flatMap(body => body.kind === "selected" ? body.observations.rows : []);
    assert.equal(observations.length, 1);
    assert.deepEqual([observations[0].operation, observations[0].value], ["size", 8n]);
    assert.equal(layouts.some(layout => isDeepStrictEqual(layout.key, observations[0].layout.metadata)
      && layout.root === observations[0].layout.layout), true);
    assert.equal(index.dependencyInventory.operations.every(operation => operation.kind === "body"), true);
    for (const [program, print, parse] of [[index, printProgramIndex, parseProgramIndex],
      [selected, module => printModuleBodies(index, module), wire => parseModuleBodies(index, wire)]]) {
      const wire = print(program);
      const decoded = parse(wire);
      assert.equal(decoded.kind, "parsed", JSON.stringify(decoded.diagnostics));
      assert.equal(print(decoded.value), wire);
    }
  }
  const opaque = analyzeHostProgram(makeInput(`export const width = measure(${descriptor("8", "false")});`, baseline));
  assert.equal(opaque.kind, "refused");
  assert.match(opaque.diagnostics[0].message, /immutable checked descriptor/u);
  const fractional = analyzeHostProgram(makeInput(`export const width = measure(${descriptor("7.5")});`, baseline));
  assert.equal(fractional.kind, "refused");
  assert.match(fractional.diagnostics[0].message, /exact nonnegative integer/u);
  const cycle = analyzeHostProgram(makeInput(
    `const descriptor: boolean = ${descriptor("measure(descriptor)")}; export const width = measure(descriptor);`, baseline));
  assert.equal(cycle.kind, "refused");
  assert.deepEqual(cycle.diagnostics.map(row => row.message), ["The constant value depends on its own completion."]);
  const undemanded = analyzeHostProgram(makeInput(`const descriptor = ${descriptor("7.5")}; export const width = 42;`, baseline));
  assert.equal(undemanded.kind, "ok");
  assert.deepEqual(undemanded.value.index.metadata, []);
  assert.deepEqual(undemanded.value.index.constants, []);
  assert.equal(undemanded.value.modules.every(chapter => chapter.bodies.every(row => row.kind !== "selected" || row.observations.rows.length === 0)), true);
  const limited = analyzeHostProgram(makeInput(inline, { ...baseline, limits: { ...baseline.limits, evaluation: {
    ...baseline.limits.evaluation, maximumSteps: 0 } } }));
  assert.equal(limited.kind, "refused");
  assert.equal(limited.diagnostics[0].source, "evaluate");
  assert.deepEqual(limited.diagnostics[0].arguments, [{ kind: "text", value: "evaluation.maximumSteps" }, { kind: "number", value: 0 }]);
  const malformed = analyzeHostProgram(makeInput(inline.replace("datalayout:", "unknown:"), baseline));
  assert.equal(malformed.kind, "refused");
  assert.equal(malformed.diagnostics.some(row => row.code.rendered === "TS2353" && row.site.kind === "source"), true);
  assert.equal(malformed.diagnostics.some(row => row.code.rendered === "TSONIC_LAYOUT_DESCRIPTOR_SYNTAX" &&
    row.site.kind === "source" && row.message.includes("unknown")), true);
});

test("layout geometry keeps the selected native carrier of an enum operand and its computed result", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { create } = layoutInput(await loadFrontFixture());
  const result = analyzeHostProgram(create(`export enum Width { Word = 8, Padded = 16 }
    const first = make<boolean>({ datalayout: Abi, bytealignment: 8, fields: [], bytesize: (Width.Word), stride: 8 });
    const second = make<boolean>({ datalayout: Abi, bytealignment: 8, fields: [], bytesize: Width.Word + Width.Word, stride: 16 });
    export const small = measure(first);
    export const large = measure(second);`));
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules } = result.value;
  const order = (left, right) => left === right ? 0 : left < right ? -1 : 1;
  const geometry = index.metadata.filter(row => row.kind === "memory-layout").map(row => row.layouts[row.root]);
  assert.equal(geometry.length, 2);
  assert.equal(geometry[0].source, geometry[1].source);
  assert.deepEqual(geometry.map(row => [row.byteSize, row.stride]).sort((left, right) => order(left[0], right[0])), [[8n, 8n], [16n, 16n]]);
  const constants = index.constants.filter(row => row.reference.context === "compile-time");
  assert.equal(constants.length, 6);
  const native = constants.filter(row => row.value.kind === "number");
  assert.deepEqual(native.map(row => row.value.value.numerator).sort(order), [8n, 16n]);
  assert.ok(native.every(row => row.value.value.denominator === 1n && index.types.terms[row.value.type].primitive === "int64"));
  assert.equal(constants.filter(row => row.value.kind === "floating").length, 4);
  const observed = modules.flatMap(chapter => chapter.bodies.flatMap(row => row.observations?.rows ?? []));
  assert.deepEqual(observed.map(row => row.value).sort(order), [8n, 16n]);
});

test("selected array layouts publish the actual number and wider-than-number bigint extent", async () => {
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { printProgramIndex, parseProgramIndex } = await import("../../packages/host/dist/ir-program/index.js");
  const { create } = layoutInput(await loadFrontFixture());
  for (const [token, length, runtimeBase, elementSize, size, expectedValue] of [
    ["2", 2n, "number", 8, 16, { kind: "floating", bits: 0x4000000000000000n }],
    ["0x20_0000_0000_0001n", 9_007_199_254_740_993n, "bigint", 0, 0, { kind: "bigint", value: 9_007_199_254_740_993n }],
  ]) {
    const input = create(`const element = make<boolean>({ datalayout: Abi, fields: [], bytesize: ${elementSize}, bytealignment: 8, stride: ${elementSize} });
      export const width = measure(makeArray<boolean, ${token}>({
        datalayout: Abi, elementlayout: element, length: ${token}, bytesize: ${size}, bytealignment: 8, stride: ${size} }));`);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index } = result.value;
    const layout = index.metadata.find(record => record.kind === "memory-layout" && record.layouts[record.root].kind === "array");
    const root = layout.layouts[layout.root];
    assert.equal(root.byteSize, BigInt(size));
    const element = layout.layouts[root.element];
    assert.deepEqual(index.types.terms[root.source], { kind: "fixed-array", element: element.source, extent: { length, runtimeBase } });
    const constant = index.constants.find(row => row.reference.context === "fixed-array-extent");
    assert.equal(ids.decodeBodyId(constant.reference.initializer.body).value.role, "layout-operand");
    assert.deepEqual(constant.value, { ...expectedValue, type: constant.value.type });
    const wire = printProgramIndex(index);
    const decoded = parseProgramIndex(wire);
    assert.equal(decoded.kind, "parsed", JSON.stringify(decoded.diagnostics));
    assert.equal(printProgramIndex(decoded.value), wire);
  }
});

const plainSources = { "main.mts": "import { twice } from \"./util.mjs\";\nexport const xs: number[] = [twice(1)];\n",
  "util.mts": "export function twice(value: number): number { return value * 2; }\n" };
const failure = message => ({ owner: "front", query: null, origin: null, message });

test("the module set is the modules of the opened program: the snapshot's source modules and its bundled libraries as declaration modules of their package; no checker object leaves Front", () => {
  const libraries = bundled();
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries });
  const { deps, program, set } = openAndCapture(snapshot);
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(set))), ["modules"]);
  assert.deepEqual(set.modules, snapshot.source.input.packages.modules.map(module => ({ kind: "snapshot", module: module.id })),
    "every module of the snapshot is a program module here, once, in ascending order of identity");
  const checker = packageOf("/checker");
  const libraryModules = set.modules.filter(entry => ids.decodeModuleId(entry.module).value.package === checker);
  assert.equal(libraryModules.length, libraries.length, "each bundled library is a module of the package the snapshot gives it");
  assert.deepEqual(JSON.parse(JSON.stringify(set)), set, "the module set is plain data");
  assert.deepEqual(front.captureProgramModules(deps, program), set, "a repeated capture of one program gives the same set");
  assert.throws(() => front.captureProgramModules({ extensions: front.createCheckerExtensions([]), navigationCapture }, program),
    { name: "TypeError", message: "front: the extension table is not the one the program was opened with" });
  assert.deepEqual(openAndCapture(projectSnapshot({ sourceFiles: plainSources, libraries })).set, set, "and so does a second program opened on equal inputs");
});

test("a session document is captured once, with the package of the one loaded registration that supplied its provider, that package's name from the snapshot, and the provider module as supplied", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nimport { Value as Other } from \"native:other\";\nexport const v: number = Value + Other;\n" };
  const providerPackages = [{ root: "/provider-one", name: "provider-one-pkg" }, { root: "/provider-two", name: null }];
  const registrations = [providerRegistration("/provider-one", declarationProvider("test.provider.one", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider.two", "native:other", "native.other", 9_900_100))];
  const snapshot = projectSnapshot({ sourceFiles, libraries, providerPackages, declarationProviders: registrations.map(entry => entry.reference),
    requiredProviderModules: [{ specifierPrefix: "native:thing", providerId: "test.provider.one", message: "native:thing needs its provider" },
      { specifierPrefix: "other-required:", providerId: null, message: "any provider" }] });
  const { set } = openAndCapture(snapshot, registrations);
  const documents = set.modules.filter(entry => entry.kind === "session-document").map(entry => entry.document);
  assert.equal(set.modules.length, 1 + libraries.length + documents.length);
  const of = providerModuleId => documents.filter(document => document.provider.providerModuleId === providerModuleId);
  for (const [providerModuleId, root, packageName, providerId, specifier] of [
    ["native.thing", "/provider-one", "provider-one-pkg", "test.provider.one", "native:thing"],
    ["native.other", "/provider-two", null, "test.provider.two", "native:other"]]) {
    const own = of(providerModuleId);
    assert.equal(own.length > 0, true, providerModuleId);
    for (const document of own) {
      assert.equal(document.package, packageOf(root), "the registering package");
      assert.deepEqual(document.provider, { providerId, providerVersion: "1.0.0", packageName, moduleSpecifier: specifier, providerModuleId });
      assert.deepEqual(ids.decodeModuleId(document.module).value.package, packageOf(root), "its module identity is in the registering package");
      assert.equal(["public", "canonical-export-owner"].includes(document.artifact), true);
      assert.equal(document.text.includes(`"${providerModuleId}"`), true, "the exact text of the checked file, which names its provider module");
    }
  }
  assert.equal(new Set(documents.map(document => document.module)).size, documents.length, "each document once");
});

test("provenance that is not a loaded declaration-provider registration is an invariant failure, never a guess: a provider that only a compiler extension registered, and a registering package the snapshot does not hold", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nexport const v: number = Value;\n" };
  const provider = declarationProvider("test.provider", "native:thing", "native.thing");
  const capture = (snapshot, registrations) => {
    const deps = { extensions: front.createCheckerExtensions(registrations), navigationCapture };
    return () => {
      const opened = front.openCheckedProgram(deps, snapshot);
      return front.captureProgramModules(deps, opened.value);
    };
  };
  const viaExtension = { reference: reference("/provider-one", "extension"), value: { kind: "compiler-extension",
    value: { identity: { id: "test.registers.a.provider", version: "1.0.0" }, initialize: context => { context.registerSourceDeclarationProvider(provider); } } } };
  const packagesOne = [{ root: "/provider-one", name: "one" }];
  assert.throws(capture(projectSnapshot({ sourceFiles, libraries, providerPackages: packagesOne, compilerExtensions: [viaExtension.reference] }), [viaExtension]),
    error => { assert.deepEqual(error.cause, failure("A session document names a provider that no loaded registration supplied.")); return true; });
  const foreign = [providerRegistration("/not-in-the-snapshot", provider)];
  assert.throws(capture(projectSnapshot({ sourceFiles, libraries }), foreign),
    error => { assert.deepEqual(error.cause, failure("The registering package of a session document is not a package of the snapshot.")); return true; });
});

test("preparation refuses unowned files before opening; duplicate owned identities cannot enter a checked program", () => {
  const libraries = bundled();
  const stray = projectSnapshot({ sourceFiles: { "main.mts": "import { helper } from \"./helper.mjs\";\nexport const h: number = helper;\n" }, libraries });
  stray.source.input.packages.files.push({ kind: "physical", path: "/project/src/helper.mts", realPath: "/project/src/helper.mts", text: "export const helper: number = 1;\n" });
  stray.source.input.packages.files.sort((left, right) => left.path < right.path ? -1 : 1);
  const unowned = front.prepareSourceImports({ navigationCapture }, stray.source.input);
  assert.equal(unowned.kind, "refused");
  assert.deepEqual(unowned.diagnostics.map(row => [row.code.name, row.site]),
    [["TSONIC_SOURCE_PREPARATION_INVALID", { kind: "file", path: "/project/src/helper.mts" }]]);
  const deps = { extensions: front.createCheckerExtensions([]), navigationCapture };
  const repeated = projectSnapshot({ sourceFiles: plainSources, libraries });
  const sources = ["/project/src/util.mts", "/project/src/main.mts"].map(path => repeated.source.input.packages.modules.find(module => module.path === path));
  sources[0].id = repeated.entryPoint;
  repeated.source.input.packages.modules = [...sources, ...repeated.source.input.packages.modules.filter(module => !sources.includes(module))];
  repeated.source.input.roots = [repeated.entryPoint];
  repeated.source = preparedSource(repeated.source.input);
  assert.throws(() => front.openCheckedProgram(deps, repeated),
    error => { assert.deepEqual(error.cause, failure("Two files of the opened program have one module identity.")); return true; });
});

test("provider session files share the actual opened source domain and retain real declaration-passing receipts", async () => {
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const provider = { ...declarationProvider("test.provider", "native:thing", "native.thing"),
    getDeclarationModel: () => ({ moduleSpecifier: "native:thing", providerModuleId: "native.thing", exports: [
      { id: "Take", name: "take", kind: "function", signatures: [{ id: "Take.call", parameters: [
        { name: "value", type: { kind: "number" }, passingMode: "byref-readwrite" }], returnType: { kind: "number" } }] }] }) };
  const registration = providerRegistration("/provider-one", provider);
  const source = 'import { take } from "native:thing";\nexport function invoke(value: number): number { return take(value); }\n'
    + 'export const ready: boolean = true;\n';
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": source }, libraries: bundled(),
    providerPackages: [{ root: "/provider-one", name: "provider-one-pkg" }], declarationProviders: [registration.reference] });
  const opened = openAndCapture(snapshot, [registration]);
  assert.equal(front.captureProgramModules(opened.deps, opened.program) === opened.set, true, "one actual ready module inventory");
  assert.equal(OpenedProgram.moduleAt(opened.program, "/not-captured.ts") === undefined, true);
  assert.throws(() => captureSingleModule(front, opened.deps, opened.program, moduleOf(packageOf("/project"), "absent.ts")),
    { name: "TypeError", message: "front: the module is not a module of the opened program" });
  const caller = captureSingleModule(front, opened.deps, opened.program, moduleOf(packageOf("/project"), "src/main.ts"));
  assert.equal(caller.kind, "ok");
  const call = caller.value.calls[0];
  assert.equal(call.kind, "applicable");
  const literal = caller.value.tree.statements.nodes[2].declarationList.declarations.nodes[0].initializer;
  assert.deepEqual(caller.value.core[literal.id].layoutQuery, { kind: "available", value: null });
  assert.deepEqual(caller.value.core[call.invocation.node].layoutQuery, { kind: "available", value: null });
  assert.deepEqual(caller.value.core[call.invocation.node].metadata, { kind: "unavailable", reason: "not-provided", causes: [] });
  const arbitraryReference = reference("/provider-one", "extension");
  const arbitrary = { reference: arbitraryReference, value: { kind: "compiler-extension",
    value: { identity: { id: "test.unclassified-observer", version: "1.0.0" }, initialize() {} } } };
  const openInventory = openAndCapture({ ...snapshot, contributions: { ...snapshot.contributions, compilerExtensions: [arbitraryReference] } },
    [registration, arbitrary]);
  const openCaller = captureSingleModule(front, openInventory.deps, openInventory.program, snapshot.entryPoint);
  assert.equal(openCaller.kind, "ok");
  assert.deepEqual(openCaller.value.core[openCaller.value.calls[0].invocation.node].layoutQuery,
    { kind: "unavailable", reason: "not-provided", causes: [] });
  const selected = caller.value.types.candidates[call.candidates].candidates[0];
  const signature = caller.value.types.signatures[selected.application.signature];
  assert.deepEqual(signature.parameters[0].passing, { kind: "available", value: "byref-readwrite" });
  const declaration = signature.parameters[0].declaration;
  assert.equal(declaration !== null, true);
  const owner = opened.set.modules.find(entry => entry.kind === "session-document" && entry.document.module === declaration.module);
  assert.equal(owner !== undefined, true, "the parameter's real provider document, not the caller's colliding node");
  assert.equal(owner.document.artifact, "canonical-export-owner");
  const checked = OpenedProgram.checked(opened.program);
  const ownerFile = OpenedProgram.file(opened.program, owner.document.module).file;
  assert.equal(checked.programSourceFiles.includes(ownerFile), true, "the canonical owner is an actual checked program file");
  assert.equal(checked.getSourceFiles().includes(ownerFile), false, "ordinary SDK enumeration is not the full canonical declaration domain");
  const rawOwner = captureSingleModule(front, opened.deps, opened.program, owner.document.module);
  assert.equal(rawOwner.kind, "ok");
  const row = rawOwner.value.core[declaration.node];
  assert.deepEqual(row.node, declaration);
  assert.deepEqual(row.argumentPassing, { kind: "available", value: { role: "declaration", mode: "byref-readwrite" } });
  const nativeSignatures = rawOwner.value.providerDeclarations.filter(entry => entry.identity.signatureId === "Take.call");
  assert.equal(nativeSignatures.length > 0, true, "actual selected SDK signature receipts are captured without semantic SigId guessing");
  for (const entry of rawOwner.value.providerDeclarations) {
    assert.equal(entry.node.module, owner.document.module);
    assert.equal(entry.identity.module === owner.document.provider, true, "the admitted session/provider/package relation is retained unchanged");
    assert.equal(entry.identity.exportId, "Take", "the original provider declaration id is not its source spelling take");
    assert.equal(entry.identity.memberId, null);
    assert.deepEqual(entry.wellKnownDeclaration, { kind: "unavailable", reason: "not-provided", causes: [] });
    const core = rawOwner.value.core.find(candidate => candidate.node.node === entry.node.node);
    assert.equal(core.provider.kind, "available");
    assert.equal(core.provider.value === entry, true, "core transport projects the same actual captured association");
  }
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const { createTypeInterner } = await import("../../packages/host/dist/ir-types/index.js");
  const ownerDefinitions = identifySingleModule(front, { module: rawOwner.value,
    componentRoots: rawOwner.value.types.components.map(component => component.root).filter(root => root.module === owner.document.module) });
  assert.equal(ownerDefinitions.kind, "ok");
  const loweredOwner = lowerWithReadyExports(lowerDepsFor(ownerDefinitions.value, createTypeInterner(), owner.document.text), rawOwner.value);
  assert.equal(loweredOwner.kind, "ok");
  const checkedNodes = indexSyntaxTree(loweredOwner.value.tree);
  for (const captured of rawOwner.value.providerDeclarations) {
    const definition = ownerDefinitions.value.rows.find(row => row.node === captured.node.node);
    assert.ok(definition);
    assert.deepEqual(checkedNodes[captured.node.node].tsonic.core.provider, { kind: "available", value: definition.definition });
  }
  const publicDocument = opened.set.modules.find(entry => entry.kind === "session-document" && entry.document.artifact === "public");
  const rawPublic = captureSingleModule(front, opened.deps, opened.program, publicDocument.document.module);
  assert.equal(rawPublic.kind, "ok");
  assert.deepEqual(rawPublic.value.providerDeclarations, [], "the public export alias is not the canonical declaration");
  assert.equal(rawPublic.value.exports.length, 1);
  assert.equal(rawOwner.value.tree.origin.module, owner.document.module);
  assert.equal(OpenedProgram.file(opened.program, owner.document.module).text, owner.document.text);
  assert.deepEqual(captureSingleModule(front, opened.deps, opened.program, owner.document.module), rawOwner);
  assert.equal(caller.value.bindings[0].target.kind, "available");
  const facts = checked.sourceFacts;
  const originalFact = facts.getFact.bind(facts);
  const files = opened.set.modules.map(entry => OpenedProgram.file(opened.program,
    entry.kind === "snapshot" ? entry.module : entry.document.module));
  const withFacts = getFact => OpenedProgram.create({ ...checked, sourceFacts: { getFact,
    getFacts: subject => facts.getFacts(subject),
    getVirtualDeclarationDocument: path => facts.getVirtualDeclarationDocument(path) } }, opened.deps.extensions,
  files, OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
  for (const [change, message] of [
    [fact => ({ ...fact, artifactFileName: "/not-admitted.ts" }), "A provider declaration must retain its actual admitted session document."],
    [fact => ({ ...fact, providerVersion: "foreign" }), "A provider declaration fact must agree with its actual admitted provider identity."],
  ]) {
    const altered = withFacts((subject, key) => {
      const actual = originalFact(subject, key);
      if (key !== sdk.providerVirtualDeclarationFactKey) return actual;
      return actual === undefined || actual.exportId === undefined ? actual : change(actual);
    });
    assert.throws(() => captureSingleModule(front, opened.deps, altered, owner.document.module),
      error => { assert.deepEqual(error.cause, failure(message)); return true; });
  }
  let providerReads = 0;
  const counted = withFacts((subject, key) => {
    if (key === sdk.providerVirtualDeclarationFactKey) providerReads += 1;
    return originalFact(subject, key);
  });
  const refused = captureSingleModule(front, { ...opened.deps,
    navigationCapture: { ...navigationCapture, maximumCapturedFactsPerModule: 0 } }, counted, owner.document.module);
  assert.equal(refused.kind, "refused");
  assert.equal(providerReads, 0, "no provider fact is read after the original capture refusal");
});

test("provider catalogue capture retains exact literals without re-entering the provider", async () => {
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  let materializations = 0;
  const shared = { kind: "boolean" };
  const provider = { ...declarationProvider("test.provider.literals", "native:exact", "native.exact"),
    getDeclarationModel: () => {
      materializations += 1;
      return { moduleSpecifier: "native:exact", providerModuleId: "native.exact", exports: [
        { id: "Exact", name: "Exact", kind: "type", type: { kind: "tuple", elementTypes: [shared,
          { kind: "literal", value: 0.125 }, shared, { kind: "bigint-literal", value: "-9007199254740993" }, { kind: "undefined" }] } },
      ] };
    } };
  const registration = providerRegistration("/provider-one", provider);
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": 'import type { Exact } from "native:exact"; export type Used = Exact;' },
    libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }],
    providerPackages: [{ root: "/provider-one", name: "provider-one-pkg" }], declarationProviders: [registration.reference] });
  const opened = openAndCapture(snapshot, [registration]);
  const before = materializations;
  const document = opened.set.modules.find(entry => entry.kind === "session-document" && entry.document.artifact === "public").document;
  const actualModel = OpenedProgram.file(opened.program, document.module).providerModel;
  const captured = captureSingleModule(front, opened.deps, opened.program, document.module);
  assert.equal(captured.kind, "ok");
  const catalogue = captured.value.publicLibraryModule;
  const [definition] = catalogue.exports;
  const tuple = catalogue.types[definition.type];
  assert.equal(tuple.kind, "tuple");
  assert.deepEqual(catalogue.types.map(row => row.id), catalogue.types.map((unused, index) => index));
  const [earlier, rational, later, bigint, absence] = tuple.elementTypes;
  const original = actualModel.exports[0].type.elementTypes;
  assert.equal(earlier === later, original[0] === original[2]);
  assert.deepEqual(catalogue.types[rational].value, { kind: "number", value: { numerator: 1n, denominator: 8n, negativeZero: false } });
  assert.deepEqual(catalogue.types[bigint].value, { kind: "bigint", value: -9007199254740993n });
  assert.equal(catalogue.types[absence].kind, "absence");
  const refused = captureSingleModule(front, { ...opened.deps, literalCapture: { ...opened.deps.literalCapture, maximumArithmeticWork: 0 } },
    opened.program, document.module);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics.at(-1).site.origin.module, document.module);
  assert.deepEqual(refused.diagnostics.at(-1).evidence.slice(0, 2), ["front.literalCapture.maximumArithmeticWork", "captureModule"]);
  assert.equal(materializations, before);
});

test("provider overloads supply their own ABI while ordinary captured declarations keep their closed defaults", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { readSignature, readType } = await import("../../packages/host/dist/ir-types/index.js");
  const provider = { ...declarationProvider("test.provider.abi", "native:thing", "native.thing"),
    getDeclarationModel: () => ({ moduleSpecifier: "native:thing", providerModuleId: "native.thing", exports: [
      { id: "ReadNative", name: "reader", exportName: "read", kind: "function", signatures: [
        { id: "ReadNative.number", parameters: [{ name: "input", type: { kind: "number" } }], returnType: { kind: "number" } },
        { id: "ReadNative.bool", parameters: [{ name: "input", type: { kind: "boolean" }, passingMode: "by-value" }], returnType: { kind: "boolean" } },
      ] },
    ] }) };
  const registration = providerRegistration("/provider-one", provider);
  const fixture = await loadFrontFixture();
  const libraries = [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }];
  const source = 'import { read } from "native:thing"; export const saved = read;'
    + "export function ordinary(input:boolean):boolean{return input;}";
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": source }, libraries,
    providerPackages: [{ root: "/provider-one", name: "provider-one-pkg" }], declarationProviders: [registration.reference] });
  const opened = openAndCapture(snapshot, [registration]);
  const owner = opened.set.modules.find(entry => entry.kind === "session-document" && entry.document.artifact === "canonical-export-owner");
  assert.equal(owner !== undefined, true);
  const raw = captureSingleModule(front, opened.deps, opened.program, owner.document.module);
  assert.equal(raw.kind, "ok");
  const signatures = raw.value.providerDeclarations.filter(entry => entry.identity.signatureId !== null);
  assert.deepEqual(signatures.map(row => row.identity.signatureId), ["ReadNative.number", "ReadNative.bool"]);
  for (const { node } of signatures) {
    const signature = raw.value.types.signatures.find(row => row.declaration?.module === node.module && row.declaration.node === node.node);
    assert.deepEqual(signature.parameters.map(parameter => parameter.passing), [{ kind: "available", value: "by-value" }]);
  }
  const result = captureSourceBarrier({ ...analysisInput(fixture, "sdk-minimal"), snapshot, extensions: opened.deps.extensions });
  assert.equal(result.kind, "ok");
  const [library] = result.value.libraries.sources;
  assert.equal(library.id, registration.reference.package);
  assert.equal(library.declarations.length, 2);
  const [model] = library.modules;
  assert.deepEqual(model.identity, owner.document.provider);
  const [libraryRead] = model.exports;
  assert.deepEqual([libraryRead.id, libraryRead.exportName], ["ReadNative", "read"]);
  assert.deepEqual(libraryRead.signatures.map(signature => [signature.id, signature.parameters[0].passingMode,
    model.types[signature.parameters[0].type].kind, model.types[signature.returnType].kind]), [
    ["ReadNative.number", "by-value", "number", "number"], ["ReadNative.bool", "by-value", "boolean", "boolean"],
  ]);
  const actual = result.value.modules.find(row => row.module.module === owner.document.module);
  assert.equal(actual !== undefined, true);
  const types = signatures.flatMap(({ node }) => {
    const actualNode = actual.nodes[node.node];
    assert.equal(actualNode.kind, "CallSignature");
    assert.equal(actualNode.tsonic.signatures.length, 1);
    const [endpoint] = actualNode.tsonic.signatures;
    assert.equal(endpoint.body, null);
    assert.deepEqual(actualNode.tsonic.core.provider, { kind: "available", value: endpoint.declaration });
    return readSignature(result.value.types, endpoint.signature);
  });
  assert.equal(types.length, 2);
  assert.equal(types.every(signature => signature.parameters[0].passing === "by-value"), true);
  assert.notEqual(types[0].parameters[0].type, types[1].parameters[0].type);
  assert.equal(types.some(signature => readType(result.value.types, signature.parameters[0].type).primitive === "bool"), true);
  const ordinary = result.value.modules.find(row => row.module.module === snapshot.entryPoint).module.tree.statements.nodes
    .find(node => node.kind === "FunctionDeclaration");
  assert.equal(readSignature(result.value.types, ordinary.tsonic.signatures[0].signature).parameters[0].passing, "by-value");

  const erased = projectSnapshot({ sourceFiles: { "main.ts": 'import type { read } from "native:thing";'
    + "export function ordinary(input:boolean):boolean{return input;}" }, libraries,
    providerPackages: [{ root: "/provider-one", name: "provider-one-pkg" }], declarationProviders: [registration.reference] });
  const program = analyzeHostProgram({ ...analysisInput(fixture, "sdk-minimal"), snapshot: erased, extensions: opened.deps.extensions });
  assert.equal(program.kind, "ok");
  assert.deepEqual(program.value.index.metadata, []);
  const checkedProvider = program.value.modules.find(row => row.module === owner.document.module);
  assert.equal(checkedProvider?.tree.kind, "checked-root");
  assert.equal(checkedProvider.bodies.length, 0);

  const declarationRow = raw.value.providerDeclarations.find(row => row.identity.signatureId === null && row.identity.memberId === null);
  assert.ok(declarationRow);
  const declaration = actual.module.items.find(row => row.node === declarationRow.node.node);
  assert.ok(declaration);
  function claimedInput(base, extensions, packageId, roles, declaredSummaries) {
    const path = packageId === registration.reference.package ? "/provider-one/library.json" : "/project/library.json";
    const packages = { ...base.source.input.packages,
      packages: base.source.input.packages.packages.map(entry => entry.id === packageId ? { ...entry, libraryEntry: path } : entry),
      files: [...base.source.input.packages.files, { kind: "physical", path, realPath: path, text: "{}" }]
        .sort((left, right) => left.path < right.path ? -1 : 1),
      libraryData: [{ package: packageId, path, roles, declaredSummaries }],
    };
    const prepared = front.prepareSourceImports({ navigationCapture }, { ...base.source.input, packages });
    assert.equal(prepared.kind, "ok");
    const input = { ...base, source: prepared.value };
    assert.deepEqual(fixture.snapshots.verifySnapshot(input, front.extensionReferencesOf(extensions)), []);
    return { ...analysisInput(fixture, "sdk-minimal"), snapshot: input, extensions };
  }
  const withClaims = (packageId, roles, declaredSummaries) =>
    captureSourceBarrier(claimedInput(snapshot, opened.deps.extensions, packageId, roles, declaredSummaries));
  const role = identity => ({ identity, role: "default-value" });
  const claimed = withClaims(registration.reference.package, [role(declarationRow.identity)], []);
  assert.equal(claimed.kind, "ok", JSON.stringify(claimed.diagnostics));
  assert.deepEqual(claimed.value.libraries.sourceRoles, [
    { identity: declarationRow.identity, role: "default-value", definition: declaration.definition },
  ]);
  const crossed = withClaims(snapshot.source.input.packages.rootPackage, [role(declarationRow.identity)], []);
  assert.equal(crossed.kind, "refused");
  assert.equal(crossed.diagnostics[0].code.rendered, "TSONIC_PROVIDER_LIBRARY_INVALID");
  assert.equal(crossed.diagnostics[0].site.path, "/project/library.json");
  const alias = withClaims(registration.reference.package, [role({ ...declarationRow.identity, exportId: libraryRead.exportName })], []);
  assert.equal(alias.kind, "refused");
  assert.equal(alias.diagnostics[0].code.rendered, "TSONIC_PROVIDER_LIBRARY_INVALID");
  const guarantee = { identity: signatures[1].identity, projections: [], producers: [],
    origins: [{ id: 0, kind: "complete", producers: [], includesAbsence: false }], boundaries: [],
    parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [], invocationOnlyParameters: [],
    suspends: false, bindingDependent: false };
  const withoutCall = withClaims(registration.reference.package, [], [guarantee]);
  assert.equal(withoutCall.kind, "ok");
  assert.equal(withoutCall.value.libraries.guarantees[0].statement, guarantee);
  assert.equal(withoutCall.value.libraries.guarantees[0].declaration, types[1].declaration);
  const wrongPackage = withClaims(snapshot.source.input.packages.rootPackage, [], [guarantee]);
  assert.equal(wrongPackage.kind, "refused");
  assert.equal(wrongPackage.diagnostics[0].site.path, "/project/library.json");

  const callSnapshot = projectSnapshot({ sourceFiles: { "main.ts":
    'import { read } from "native:thing"; export function use(input:boolean):boolean { return read(input); }' }, libraries,
    providerPackages: [{ root: "/provider-one", name: "provider-one-pkg" }], declarationProviders: [registration.reference] });
  const callSession = openAndCapture(callSnapshot, [registration]);
  const caller = captureSingleModule(front, callSession.deps, callSession.program, callSnapshot.entryPoint);
  assert.equal(caller.kind, "ok");
  const [selected] = caller.value.calls;
  assert.equal(selected.kind, "applicable");
  assert.equal(selected.declarationOrdinal, 1);
  assert.deepEqual(selected.declarationOrder.value.map(id => caller.value.types.signatures[id].declaration),
    signatures.map(row => row.node));
  const receipt = caller.value.core.find(row => row.node.node === selected.invocation.node).provider;
  assert.equal(receipt.kind, "available");
  assert.deepEqual(receipt.value.node, signatures[1].node);
  assert.deepEqual(receipt.value.identity, signatures[1].identity);
  const callInput = { ...analysisInput(fixture, "sdk-minimal"), snapshot: callSnapshot, extensions: callSession.deps.extensions };
  const captured = captureSourceBarrier(callInput);
  assert.equal(captured.kind, "ok");
  const callerModule = captured.value.modules.find(row => row.module.module === callSnapshot.entryPoint);
  const callerBody = callerModule.module.bodies
    .find(body => body.candidateLists.length === 1);
  const [candidate] = callerBody.candidateLists[0].candidates;
  const chosen = captured.value.modules.find(row => row.module.module === owner.document.module).nodes[signatures[1].node.node];
  assert.equal(callerBody.candidateLists[0].candidates.length, 1);
  assert.equal(candidate.declaration, chosen.tsonic.definition);
  assert.equal(candidate.appliedSignature.value, chosen.tsonic.signatures[0].signature);
  assert.deepEqual(callerModule.nodes[selected.invocation.node].tsonic.core.provider,
    { kind: "available", value: chosen.tsonic.definition });

  const { createAccount } = await import("../../packages/host/dist/dataflow/index.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const account = createAccount(callInput.limits.dataflow);
  const typed = typeSourceBarrier(callInput, captured.value, account);
  assert.equal(typed.kind, "ok");
  const [operation] = typed.value.required.operations.filter(row => row.kind === "declared");
  assert.equal(operation.execution.provided, 1);
  assert.equal(operation.execution.request.definition, chosen.tsonic.definition);
  assert.equal(operation.execution.request.endpoint, "api-signature");
  assert.equal(operation.execution.request.ordinal, 0);
  const ready = typed.value.required.declared.get(summaryKey(operation));
  assert.equal(ready.execution, operation.execution);
  assert.equal(ready.placement.signature, readSignature(captured.value.types, candidate.appliedSignature.value));
  assert.equal(ready.placement.request, operation.execution.request);
  assert.equal(ready.guarantee, null);
  assert.deepEqual(ready.source, { kind: "item", value: { owner: chosen.tsonic.definition, node: chosen.id } });
  assert.deepEqual(typed.value.required.dependencies.filter(row => row.at.node === selected.invocation.node).map(row => row.reason), ["call"]);
  const stats = typed.value.database.stats();
  assert.equal(typed.value.signatureIdOf(operation.execution.request), ready.placement.signature.id);
  assert.equal(typed.value.signatureIdOf({ ...operation.execution.request, ordinal: 1 }), null);
  const evidence = typed.value.programEvidence(account);
  assert.equal(evidence.kind, "complete");
  assert.equal(evidence.value.signatures.filter(row => row === ready.placement).length, 1);
  assert.deepEqual(typed.value.database.stats(), stats);

  const { instanceKey, internType, viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { lowerMirDeps, mirVerificationContext } = await import("../../packages/host/dist/pipeline/lower-mir-step.js");
  const { lowerToMir } = await import("../../packages/host/dist/lower-mir/index.js");
  const { verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { bindDeclaredSummary } = await import("../../packages/host/dist/summaries/index.js");
  const { callSummary } = await import("../../packages/host/dist/analyses/body/calls.js");
  const { accountFailure } = await import("../../packages/host/dist/dataflow/index.js");
  const edge = typed.value.required.dependencies.find(edge => edge.target.execution === ready.execution);
  assert.equal(edge.reason, "call");
  const callerInstance = edge.dependent.instance;
  const bodyOf = instance => typed.value.bodies.get(instanceKey(instance)) ?? null;
  const body = bodyOf(callerInstance);
  const entries = typed.value.required.provided.get(instanceKey(callerInstance));
  const interner = captured.value.types;
  const run = { selectedNativeFacts: callInput.snapshot.nativeFacts, interner, table: viewTypes(interner),
    defs: { completionSelector: internType(interner, { kind: "primitive", primitive: "int32" }),
      exceptionStorage: internType(interner, { kind: "intrinsic", intrinsic: "unknown" }) },
    lowering: callInput.limits.lowering, verification: callInput.limits.mirVerification,
    declarationOf: typed.value.declarationOf, bodyOwner: id => captured.value.checked.bodies.get(id)?.owner ?? null, bodyOf };
  const unit = { request: { query: "frontNativeCall", key: instanceKey(callerInstance) }, position: { kind: "result" } };
  const mir = lowerToMir(lowerMirDeps(run, unit), body, [], entries);
  assert.equal(mir.kind, "ok");
  assert.deepEqual(verifyMir(mir.value, mirVerificationContext(run, body, entries)), { kind: "complete", violations: [] });
  const call = mir.value.blocks.map(row => row.terminator).find(row => row.kind === "call" && row.tir.node === edge.at.node);
  assert.ok(call);
  const opaque = bindDeclaredSummary({ account, signature: ready.placement.signature, parameters: ready.parameters,
    source: ready.source, callables: [] }, { kind: "unknown", execution: ready.execution, scope: ready.scope,
    suspends: false, bindingDependent: false });
  assert.equal(opaque.kind, "complete");
  assert.equal(opaque.value.kind, "ok");
  const reads = [];
  const deps = { account, signatureOf: id => readSignature(interner, id), declaredAt: at => {
    reads.push(at.node);
    assert.deepEqual(at, edge.at);
    return edge.target;
  }, summaryOf: (key, admittedKey) => {
    reads.push("summary");
    assert.equal(key, edge.target);
    assert.equal(admittedKey, summaryKey(key));
    return { value: opaque.value.value, unit };
  } };
  const cut = createAccount({ ...callInput.limits.dataflow, maximumWork: 1 });
  assert.equal(callSummary({ ...deps, account: cut }, mir.value, call), accountFailure(cut));
  assert.deepEqual(reads, []);
  const accepted = callSummary(deps, mir.value, call);
  assert.equal(accepted.kind, "complete");
  assert.equal(accepted.value, opaque.value.value);
  assert.deepEqual(reads, [edge.at.node, "summary"]);
  assert.throws(() => callSummary({ ...deps, declaredAt: () => ({ ...edge.target, execution: { ...ready.execution, provided: 0 } }),
    summaryOf: () => assert.fail("A crossed provided entry must not read a Summary.") }, mir.value, call), /actual selected binding environment and provided entry/u);

  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { chargeWork } = await import("../../packages/host/dist/dataflow/index.js");
  const converge = pipelineWiring.summaries.convergeComponent;
  let offered = null;
  pipelineWiring.summaries.convergeComponent = (deps, input) => {
    const declared = input.outside.find(row => row.key === edge.target);
    if (declared === undefined) return converge(deps, input);
    assert.equal(deps.resources.account, account);
    offered = declared.answer;
    assert.equal(offered.value.key.execution, ready.execution);
    assert.equal(offered.value.signature, ready.placement.signature.id);
    assert.equal(offered.value.arena.origins[offered.value.result].kind, "open");
    return chargeWork(account, callInput.limits.dataflow.maximumWork);
  };
  try {
    const refused = analyzeTypedSource(callInput, typed.value, account);
    assert.equal(refused.kind, "refused");
    assert.equal(accountFailure(account).dimension, "work");
    assert.ok(offered);
    assert.deepEqual(typed.value.database.errorOf(offered.unit), { kind: "completed", error: null });
  } finally {
    pipelineWiring.summaries.convergeComponent = converge;
  }

  const published = analyzeHostProgram(callInput);
  assert.equal(published.kind, "ok");
  const declaredSummary = published.value.index.summaries.find(row => row.key.kind === "declared");
  assert.equal(declaredSummary.key.execution.request.definition, chosen.tsonic.definition);
  assert.equal(declaredSummary.key.execution.request.bindings.kind, "instantiated");
  assert.equal(declaredSummary.key.execution.provided, 1);
  assert.equal(declaredSummary.arena.origins[declaredSummary.result].kind, "open");
  assert.equal(declaredSummary.returns && declaredSummary.unwinds, true);
  const callers = published.value.modules.flatMap(module => module.bodies).filter(body => body.kind === "selected")
    .flatMap(body => body.facts).filter(facts => facts.origins.invocations.length !== 0);
  assert.equal(callers.length, 1);
  const [invocation] = callers[0].origins.invocations;
  assert.deepEqual(invocation.alternatives[0].summary, declaredSummary.key);
  assert.equal(invocation.boundaries.length, 1);
  assert.equal(callers[0].arena.boundaries[invocation.boundaries[0]].kind, "opaque-invocation");
  assert.deepEqual(callers[0].origins.activations, []);

  const siblingGuarantee = { ...guarantee, identity: signatures[0].identity };
  for (const [declarations, chosenStatement] of [[[siblingGuarantee], null], [[siblingGuarantee, guarantee], guarantee]]) {
    const input = claimedInput(callSnapshot, callSession.deps.extensions, registration.reference.package, [], declarations);
    const claimed = captureSourceBarrier(input);
    assert.equal(claimed.kind, "ok");
    const typed = typeSourceBarrier(input, claimed.value, createAccount(input.limits.dataflow));
    assert.equal(typed.kind, "ok");
    const [selection] = typed.value.required.declared.values();
    assert.equal(selection.guarantee, claimed.value.libraries.guarantees.find(row => row.statement === chosenStatement) ?? null);
    assert.equal(selection.guarantee?.statement ?? null, chosenStatement);
    assert.equal(selection.execution.request.definition, chosen.tsonic.definition);
    const completed = analyzeHostProgram(input);
    assert.equal(completed.kind, "ok");
    const declared = completed.value.index.summaries.find(row => row.key.kind === "declared");
    assert.equal(declared.arena.origins[declared.result].kind, chosenStatement === null ? "open" : "complete");
    assert.equal(declared.returns && declared.unwinds, true);
  }
});

/**
 * The diagnostics of a session created from the inputs that Front computes for a snapshot (`sessionInputs`, the function
 * `openCheckedProgram` itself uses). Front has no operation yet that returns a file's diagnostics (`captureModule`), so these
 * cases read them from such a session; the module set is always read through Front.
 */
function sessionDiagnostics(snapshot) {
  const inputs = checkerModule.sessionInputs(snapshot.source.input);
  const session = sdk.createCompilerSessionFromFiles({ currentDirectory: inputs.currentDirectory, files: inputs.files,
    rootFiles: inputs.rootFiles, compilerOptions: inputs.options, selectedLibraries: inputs.selectedLibraries,
    includeBundledLibraries: false, useCaseSensitiveFileNames: true });
  const checked = session.checkSource();
  return session.getDiagnostics("all").map(diagnostic => `TS${diagnostic.code} ${diagnostic.file === undefined ? "(no file)" : checked.ast.getFileName(diagnostic.file)}`);
}
const usesMap = { "main.mts": "export const m = new Map<string, number>();\n" };
const collection = "lib.es2015.collection.d.ts";
const snapshotModules = snapshot => snapshot.source.input.packages.modules.map(module => ({ kind: "snapshot", module: module.id }));

test("logical library names bind arbitrary captured basenames through the one explicit selected map", () => {
  const snapshot = projectSnapshot({ sourceFiles: usesMap, libraries: bundled() });
  let index = 0;
  for (const module of snapshot.source.input.packages.modules.filter(module => module.package === packageOf("/checker"))) {
    const file = snapshot.source.input.packages.files.find(file => file.path === module.path);
    const path = `/checker/captured-${index++}.d.ts`;
    file.path = path;
    module.path = path;
  }
  snapshot.source.input.packages.files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  snapshot.source = preparedSource(snapshot.source.input);
  const inputs = checkerModule.sessionInputs(snapshot.source.input);
  assert.deepEqual([...inputs.selectedLibraries], snapshot.source.input.declarationPolicy.bundledLibraries.map(binding =>
    [binding.name, snapshot.source.input.packages.modules.find(module => module.id === binding.module).path]));
  assert.equal([...inputs.selectedLibraries.values()].every(path => path.startsWith("/checker/captured-")), true);
  assert.deepEqual(sessionDiagnostics(snapshot), []);
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
});

test("an explicit empty library map stays empty while contributed captured declarations remain roots", () => {
  const snapshot = projectSnapshot({ sourceFiles: usesMap, libraries: bundled() });
  snapshot.source.input.declarationModules = snapshot.source.input.declarationPolicy.bundledLibraries.map(binding => binding.module).sort();
  snapshot.source.input.declarationPolicy.bundledLibraries = [];
  snapshot.source = preparedSource(snapshot.source.input);
  assert.equal(checkerModule.sessionInputs(snapshot.source.input).selectedLibraries.size, 0);
  assert.deepEqual(sessionDiagnostics(snapshot), []);
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
});

test("a direct SDK-library import reads no uncaptured text and captured-only sessions have no bundled filesystem fallback", () => {
  const installed = sdk.getBundledLibraryClosure(["lib.dom.d.ts"]).find(library => library.name === "lib.dom.d.ts");
  assert.equal(installed !== undefined, true);
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": `import { Document } from ${JSON.stringify(installed.path)};\nexport const d: Document | null = null;\n` }, libraries: bundled() });
  assert.equal(snapshot.source.input.packages.files.some(file => file.path === installed.path), false);
  assert.deepEqual(sessionDiagnostics(snapshot), ["TS2307 /project/src/main.mts"]);
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
  const inputs = checkerModule.sessionInputs(snapshot.source.input);
  const ordinary = sdk.createCompilerSessionFromFiles({ currentDirectory: inputs.currentDirectory, files: inputs.files,
    rootFiles: inputs.rootFiles, compilerOptions: inputs.options, selectedLibraries: inputs.selectedLibraries });
  assert.equal(ordinary.host.FS().ReadFile(installed.path)[1], true);
  const capturedOnly = sdk.createCompilerSessionFromFiles({ currentDirectory: inputs.currentDirectory, files: inputs.files,
    rootFiles: inputs.rootFiles, compilerOptions: inputs.options, selectedLibraries: inputs.selectedLibraries,
    includeBundledLibraries: false });
  assert.equal(capturedOnly.host.FS().ReadFile(installed.path)[1], false);
});

test("libraries, present: a declaration of a library that is reached only through other libraries' references is visible, and every program file is a captured module", () => {
  const libraries = bundled();
  assert.deepEqual(libraries.filter(library => library.text.includes('reference lib="es2015.collection"')).map(library => library.name), ["lib.es2015.d.ts"],
    "the collection library is referred to by one other library and by no root");
  const snapshot = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
  assert.deepEqual(sessionDiagnostics(snapshot), []);
});

test("libraries, missing: a referenced library that the snapshot does not hold is read from nowhere; a use of its declarations is an ordinary diagnostic of the using file", () => {
  const libraries = bundled().filter(library => library.name !== collection);
  const used = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(openAndCapture(used).set.modules, snapshotModules(used),
    "the program has exactly the snapshot's modules: a file of the installed checker would be neither a module nor a session document and would stop the capture");
  assert.deepEqual(sessionDiagnostics(used), ["TS2585 /project/src/main.mts"], "the absent declarations are absent; no installed text stands in for them");
});

test("import preparation retains a real unresolved library reference without adding a library to the selected checker session", () => {
  const libraries = bundled().filter(library => library.name !== collection);
  const unused = projectSnapshot({ sourceFiles: { "main.mts": "export const n: number = 1;\n" }, libraries });
  assert.equal(front.importPreparationOf(unused.source.receipt).files.some(file => file.references.some(reference => reference.kind === "reference-lib"
    && reference.specifier === "es2015.collection" && reference.resolution.kind === "unresolved")), true);
  assert.deepEqual(openAndCapture(unused).set.modules, snapshotModules(unused));
  assert.deepEqual(sessionDiagnostics(unused), [],
    "what the checker does today, under these options and equally under its own library root: the open reference is stated only by the import preparation's reference rows, where its report belongs");
});

test("libraries, transitive: the checker follows no library reference; the modules that the declaration policy lists are the whole library set", () => {
  const withoutAggregate = bundled().filter(library => library.name !== "lib.es2015.d.ts");
  const stillListed = projectSnapshot({ sourceFiles: usesMap, libraries: withoutAggregate });
  assert.deepEqual(sessionDiagnostics(stillListed), [], "the collection library is listed, so its declarations are present without the library whose reference led to it");
  assert.deepEqual(openAndCapture(stillListed).set.modules, snapshotModules(stillListed));
  const onlyTop = projectSnapshot({ sourceFiles: usesMap, libraries: bundled() });
  onlyTop.source.input.declarationPolicy.bundledLibraries = [{ name: "lib.es2024.d.ts", module: moduleOf(packageOf("/checker"), "lib.es2024.d.ts") }];
  onlyTop.source = preparedSource(onlyTop.source.input);
  assert.deepEqual(snapshots.verifySnapshot(onlyTop, []), []);
  assert.deepEqual([...new Set(sessionDiagnostics(onlyTop))], ["TS2318 (no file)", "TS2583 /project/src/main.mts"],
    "captured but unlisted libraries are not reached through the listed one's references: its chain of references is not followed");
  const rejected = front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, onlyTop);
  assert.equal(rejected.kind, "refused");
  assert.equal(rejected.diagnostics.every(diagnostic => diagnostic.code.kind === "checker" && diagnostic.code.number === 2318), true);
});

test("libraries, captured text differing from the installed text: a declaration appended to a captured library is visible, and a captured library that lacks a declaration is not completed from the installed one", () => {
  const libraries = bundled().map(library => library.name === "lib.es5.d.ts" ? { name: library.name, text: `${library.text}\ndeclare const capturedOnlyMarker: number;\n` }
    : library.name === collection ? { name: library.name, text: "declare const collectionReplaced: 1;\n" } : library);
  const visible = projectSnapshot({ sourceFiles: { "main.mts": "export const a: number = capturedOnlyMarker;\nexport const b: 1 = collectionReplaced;\n" }, libraries });
  assert.deepEqual(sessionDiagnostics(visible), [], "both declarations exist only in the captured texts");
  assert.deepEqual(openAndCapture(visible).set.modules, snapshotModules(visible));
  const replaced = projectSnapshot({ sourceFiles: usesMap, libraries });
  assert.deepEqual(sessionDiagnostics(replaced), ["TS2585 /project/src/main.mts"], "the installed library of the same name declares Map; the captured one does not, and the captured one is what is checked");
});

test("caller defects of the extension table and of opening are refused as defects: a registration given twice, a root that names no module, a root package that is absent", () => {
  const libraries = bundled();
  const provider = declarationProvider("test.provider", "native:thing", "native.thing");
  assert.throws(() => front.createCheckerExtensions([providerRegistration("/provider-one", provider), providerRegistration("/provider-one", provider)]),
    { name: "TypeError", message: "front: a registration was given twice" });
  const semantics = moduleSpecifier => ({ reference: { package: packageOf("/semantics"), moduleSpecifier, exportId: "semantics", version: "1" },
    value: { kind: "semantics-module", value: { moduleSpecifier, exports: [] } } });
  const mixed = front.createCheckerExtensions([semantics("@test/one"), providerRegistration("/provider-one", provider), semantics("@test/two")]);
  assert.deepEqual(front.extensionReferencesOf(mixed).map(entry => entry.kind), ["semantics-module", "declaration-provider", "semantics-module"],
    "the reference view is the registrations in their order");
  const table = front.createCheckerExtensions([]);
  const noModule = projectSnapshot({ sourceFiles: plainSources, libraries });
  noModule.source.input.roots = [moduleOf(packageOf("/project"), "src/absent.mts")];
  assert.equal(front.openCheckedProgram({ extensions: table, navigationCapture }, noModule).diagnostics[0].code.name,
    "TSONIC_SOURCE_PREPARATION_INVALID");
  const noRoot = projectSnapshot({ sourceFiles: plainSources, libraries });
  noRoot.source.input.packages.rootPackage = packageOf("/absent");
  assert.equal(snapshots.verifySnapshot(noRoot, []).some(finding => finding.rule === "root-package-resolves"), true);
  const twiceRooted = projectSnapshot({ sourceFiles: plainSources, libraries });
  twiceRooted.source.input.declarationModules = [twiceRooted.source.input.declarationPolicy.bundledLibraries[0].module];
  assert.equal(openAndCapture(twiceRooted).set.modules.length, 2 + libraries.length, "a module that is a root twice over (a bundled library that is also contributed) is one root");
});

test("session-level checker and extension roots refuse opening with their actual original messages and codes", () => {
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries: [] });
  const missing = front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, snapshot);
  assert.equal(missing.kind, "refused");
  assert.equal(missing.diagnostics.length > 1, true, "same-code independent global roots are not collapsed");
  assert.equal(new Set(missing.diagnostics.map(diagnostic => diagnostic.message)).size, missing.diagnostics.length);
  for (const diagnostic of missing.diagnostics) {
    assert.deepEqual(diagnostic.code, { kind: "checker", number: 2318, rendered: "TS2318" });
    assert.deepEqual(diagnostic.site, { kind: "none" });
    assert.equal(diagnostic.message.startsWith("Cannot find global type '"), true);
    assert.equal(diagnostic.severity, "error");
  }
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nexport const v: number = Value;\n" };
  const overlapping = [providerRegistration("/provider-one", declarationProvider("test.provider.one", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider.two", "native:other", "native.other"))];
  const withProviders = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: overlapping.map(entry => entry.reference) });
  const overlap = front.openCheckedProgram({ extensions: front.createCheckerExtensions(overlapping), navigationCapture }, withProviders);
  assert.equal(overlap.kind, "refused");
  assert.deepEqual(overlap.diagnostics.map(diagnostic => [diagnostic.code.kind, diagnostic.code.extensionCode, diagnostic.site.kind]),
    [["extension", "DIAGNOSTIC_RANGE_INVALID", "none"]]);
  assert.equal(overlap.diagnostics[0].source, "tsts.extension-host");
  assert.equal(overlap.diagnostics[0].message.length > 0, true);
  const twice = [providerRegistration("/provider-one", declarationProvider("test.provider", "native:thing", "native.thing")),
    providerRegistration("/provider-two", declarationProvider("test.provider", "native:elsewhere", "native.elsewhere", 9_900_100))];
  const sameProvider = projectSnapshot({ sourceFiles, libraries: bundled(), providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: twice.map(entry => entry.reference) });
  const duplicate = front.openCheckedProgram({ extensions: front.createCheckerExtensions(twice), navigationCapture }, sameProvider);
  assert.equal(duplicate.kind, "refused");
  assert.deepEqual(duplicate.diagnostics.map(diagnostic => [diagnostic.code.kind, diagnostic.code.extensionCode]),
    [["extension", "DUPLICATE_EXTENSION_ID"]]);
});

test("a real extension's session receipt preserves its public code, category, owner and evidence without a fabricated file", () => {
  const extensionId = "test.session.diagnostics";
  const registration = { reference: reference("/project", "diagnostics"), value: { kind: "compiler-extension", value: {
    identity: { id: extensionId, version: "1", diagnosticRange: { start: 9910000, end: 9910009 } },
    initialize: context => {
      assert.equal(context.diagnostics.append({ extensionId, extensionCode: "FIRST", numericCode: 9910000,
        publicCode: "PUBLIC_ONE", category: "warning", message: "session 😀 α", evidence: [{ message: "actual evidence" }] }), true);
      assert.equal(context.diagnostics.append({ extensionId, extensionCode: "SECOND", numericCode: 9910001,
        category: "suggestion", message: "second session root" }), true);
    },
  } } };
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries: bundled(), compilerExtensions: [registration.reference] });
  const result = front.openCheckedProgram({ extensions: front.createCheckerExtensions([registration]), navigationCapture }, snapshot);
  assert.equal(result.kind, "refused");
  assert.deepEqual(result.diagnostics.map(diagnostic => ({ code: diagnostic.code, severity: diagnostic.severity,
    site: diagnostic.site, source: diagnostic.source, evidence: diagnostic.evidence, message: diagnostic.message })), [
    { code: { kind: "extension", number: 9910000, extensionCode: "FIRST", rendered: "PUBLIC_ONE" }, severity: "warning",
      site: { kind: "none" }, source: extensionId, evidence: ["actual evidence"], message: "session 😀 α" },
    { code: { kind: "extension", number: 9910001, extensionCode: "SECOND", rendered: "TSEXT9910001" }, severity: "suggestion",
      site: { kind: "none" }, source: extensionId, evidence: [], message: "second session root" },
  ]);
  const fileExtension = { reference: reference("/project", "file-diagnostics"), value: { kind: "compiler-extension", value: {
    identity: { id: extensionId, version: "1", diagnosticRange: { start: 9910000, end: 9910009 } },
    analyzeSource: context => {
      const file = context.source.getSourceFiles().find(candidate => context.source.ast.getFileName(candidate) === "/project/src/main.mts");
      assert.equal(file !== undefined, true);
      assert.equal(context.diagnostics.append({ extensionId, extensionCode: "AT_FILE", numericCode: 9910000,
        category: "error", message: "a file diagnostic is not a session diagnostic", nodeOrSpan: file }), true);
    },
  } } };
  const atFile = projectSnapshot({ sourceFiles: plainSources, libraries: bundled(), compilerExtensions: [fileExtension.reference] });
  assert.equal(front.openCheckedProgram({ extensions: front.createCheckerExtensions([fileExtension]), navigationCapture }, atFile).kind, "ok");
});

test("file-scoped extension diagnostics retain actual sites and reindex the exact foreign checker cause", async () => {
  const fixture = await loadFrontFixture();
  const { captureFileDiagnostics } = await import("../../packages/host/dist/front/diagnostics.js");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const extensionId = "test.module.diagnostics";
  const project = fixture.packageOf("/project");
  const reference = { package: project, moduleSpecifier: "./diagnostics.js", exportId: "extension", version: "1" };
  const leafText = "\uFEFF// λ🌱\nexport declare function make<T extends Missing=Missing>(value:T):T;";
  const other = "export function other(): boolean { return true; }";
  const registry = [{ reference, value: { kind: "compiler-extension", value: {
    identity: { id: extensionId, version: "1", diagnosticRange: { start: 9_910_100, end: 9_910_109 } },
    analyzeSource: ({ source, diagnostics }) => {
      const file = source.getSourceFiles().find(candidate => source.ast.getFileName(candidate) === "/project/src/leaf.ts");
      assert.equal(file !== undefined, true);
      const name = source.ast.name(source.ast.statements(file)[0]);
      const checkedText = source.ast.getSourceText(file);
      const start = checkedText.indexOf("λ");
      const nodeOrSpan = { sourceFile: file, pos: Buffer.byteLength(checkedText.slice(0, start)),
        end: Buffer.byteLength(checkedText.slice(0, start + "λ🌱".length)) };
      const cases = [
        { extensionCode: "NODE", numericCode: 9_910_100, publicCode: "EXT_NODE", category: "warning",
          message: "actual node", nodeOrSpan: name, evidence: [{ message: "original evidence" }] },
        { extensionCode: "SPAN", numericCode: 9_910_101, category: "suggestion", message: "actual byte range", nodeOrSpan },
      ];
      for (const diagnostic of cases) assert.equal(diagnostics.append({ extensionId, ...diagnostic }), true);
    },
  } } }];
  const mainText = "import {make} from './leaf.js'; export type Value=typeof make;";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": mainText, "leaf.ts": leafText, "other.ts": other },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }], compilerExtensions: [reference] });
  const { program, deps } = fixture.openAndCapture(snapshot, registry);
  const leaf = fixture.moduleOf(project, "src/leaf.ts");
  const main = captureSingleModule(fixture.front, deps, program, snapshot.entryPoint);
  assert.equal(main.kind, "ok");
  const foreignCauses = main.value.types.types.filter(row => row.authoredTypeNode?.module === leaf && row.form.reason === "checker-error")
    .map(row => row.form.causes[0].diagnostic.diagnostic);
  assert.deepEqual([...new Set(foreignCauses.map(cause => cause.index))].sort(), [2, 3]);
  assert.equal(foreignCauses.every(cause => cause.module === leaf), true);
  assert.deepEqual(main.value.checkerDiagnostics, []);
  const raw = captureSingleModule(fixture.front, deps, program, leaf);
  assert.equal(raw.kind, "ok");
  const { checkerDiagnostics, diagnosticCoverage } = raw.value;
  assert.deepEqual(checkerDiagnostics.map(row => [row.code.kind, row.code.rendered]),
    [["extension", "TSEXT9910101"], ["extension", "EXT_NODE"], ["checker", "TS2304"], ["checker", "TS2304"]]);
  const site = (token, start = leafText.indexOf(token)) => ({ kind: "source",
    origin: { module: leaf, start, length: token.length, derived: [] } });
  for (const [ordinal, code, severity, token, message, evidence] of [
    [0, "SPAN", "suggestion", "λ🌱", "actual byte range", []], [1, "NODE", "warning", "make", "actual node", ["original evidence"]],
  ]) {
    const diagnostic = checkerDiagnostics[ordinal];
    assert.deepEqual(diagnostic.site, site(token));
    assert.deepEqual([diagnostic.code.extensionCode, diagnostic.severity, diagnostic.source, diagnostic.message, diagnostic.evidence],
      [code, severity, extensionId, message, evidence]);
  }
  assert.deepEqual(diagnosticCoverage, checkerDiagnostics.map((_, index) => ({ kind: "unavailable", root: { module: leaf, index } })));
  const unrelated = captureSingleModule(fixture.front, deps, program, fixture.moduleOf(project, "src/other.ts"));
  assert.equal(unrelated.kind, "ok");
  assert.deepEqual(unrelated.value.checkerDiagnostics, []);
  const actualFile = OpenedProgram.file(program, leaf);
  const { ids } = OpenedProgram.syntax(program).get("/project/src/leaf.ts").outcome.numbering;
  for (let maximum = 0; maximum <= 11; maximum += 1) {
    const originals = new Map();
    let attempts = 0;
    const earned = captureFileDiagnostics(program, leaf, actualFile, ids, originals, () => ++attempts <= maximum);
    assert.equal(attempts, Math.min(maximum + 1, 11), `facts ${maximum}`);
    assert.equal(originals.size, maximum === 11 ? 2 : 0, `complete original index ${maximum}`);
    assert.equal(earned.length, maximum >= 10 ? 4 : maximum >= 8 ? 3 : maximum >= 4 ? 2 : maximum >= 1 ? 1 : 0);
    if (maximum === 11) assert.deepEqual(earned, checkerDiagnostics);
  }
  const originals = new Map();
  captureFileDiagnostics(program, leaf, actualFile, ids, originals, () => true);
  assert.throws(() => captureFileDiagnostics(program, leaf, actualFile, ids, originals, () => true),
    error => error.cause?.message === "An original checker diagnostic cannot belong to two published roots.");
  const native = OpenedProgram.checked(program);
  const altered = (ast, extensionDiagnostics) => OpenedProgram.create({ ...native, ast, extensionDiagnostics },
    deps.extensions, [actualFile], [], OpenedProgram.contributions(program));
  const [nodeDiagnostic, spanDiagnostic] = native.extensionDiagnostics;
  const collect = changed => captureFileDiagnostics(changed, leaf, actualFile, ids, new Map(), () => true);
  assert.deepEqual(collect(altered(native.ast, [{ ...nodeDiagnostic, nodeOrSpan: undefined }])), checkerDiagnostics.slice(2));
  for (const [ast, entries, message] of [
    [{ ...native.ast, authoredRange: () => native.ast.authoredRange(undefined) }, [nodeDiagnostic],
      "An extension diagnostic needs its actual authored node range."],
    [{ ...native.ast, sourceRange: (file, start, end) => start === spanDiagnostic.nodeOrSpan.pos && end === spanDiagnostic.nodeOrSpan.end
      ? native.ast.sourceRange(undefined, 0, 0) : native.ast.sourceRange(file, start, end) }, [spanDiagnostic],
      "An extension diagnostic span needs its actual checked file."],
    [native.ast, [{ ...spanDiagnostic, nodeOrSpan: { ...spanDiagnostic.nodeOrSpan, pos: "0" } }],
      "An extension diagnostic span must retain its actual checked byte range."],
  ]) assert.throws(() => collect(altered(ast, entries)), error => error.cause?.message === message);
  const readyText = "\uFEFF// λ🌱\nexport type make = boolean;";
  const readySnapshot = fixture.projectSnapshot({ sourceFiles: { "leaf.ts": readyText },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }], compilerExtensions: [reference] });
  const ready = fixture.openAndCapture(readySnapshot, registry);
  const readyRaw = captureSingleModule(fixture.front, ready.deps, ready.program, leaf);
  assert.equal(readyRaw.kind, "ok");
  const definitions = identifySingleModule(fixture.front, { module: readyRaw.value,
    componentRoots: readyRaw.value.types.components.map(component => component.root) });
  assert.equal(definitions.kind, "ok");
  const types = fixture.types.createTypeInterner();
  const lowering = fixture.lowerDepsFor(definitions.value, types, readyText);
  const exports = fixture.front.lowerModuleExports(lowering, readyRaw.value);
  assert.equal(exports.kind, "ok");
  const checked = lowerSingleCheckedModule(fixture.front, { ...lowering, exportsOf: actual => actual === leaf ? exports.value : null }, readyRaw.value);
  assert.equal(checked.kind, "ok");
  assert.equal(checked.value.checkerDiagnostics === readyRaw.value.checkerDiagnostics, true);
  assert.deepEqual(checked.value.checkerDiagnostics, [checkerDiagnostics[0],
    { ...checkerDiagnostics[1], site: site("make", readyText.indexOf("make")) }]);
  assert.deepEqual(checked.value.obligations, []);
  assert.deepEqual(fixture.verifyChecked(checked.value, types), []);
});

const optionRecord = (policy, changes = {}) => ({ ...Object.fromEntries(optionModule.optionSet(policy).map(option => [option.name, option.value])), ...changes });
const tableNames = ["module", "moduleResolution", "target", "strict", "noEmit", "noLib", "allowImportingTsExtensions", "allowArbitraryExtensions",
  "types", "skipLibCheck", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes", "useDefineForClassFields", "esModuleInterop",
  "resolveJsonModule", "allowJs"];

/** A real session on the given files with the captured libraries as roots, under the whole option set with the given changes. */
function checkedUnder(files, { policy = "none", changes = {}, libraries = bundled(), roots = [Object.keys(files)[0]] } = {}) {
  const supplied = new Map([...Object.entries(files), ...libraries.map(library => [`/checker/${library.name}`, library.text])]);
  const compilerSession = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", files: supplied,
    rootFiles: [...roots, ...libraries.map(library => `/checker/${library.name}`)], compilerOptions: optionRecord(policy, changes), useCaseSensitiveFileNames: true });
  const checked = compilerSession.checkSource();
  const names = checked.getSourceFiles().map(file => checked.ast.getFileName(file));
  return { diagnostics: [...new Set(compilerSession.getDiagnostics("all").map(diagnostic =>
      `TS${diagnostic.code} ${diagnostic.file === undefined ? "(no file)" : checked.ast.getFileName(diagnostic.file)}`))].sort(),
    notSupplied: names.filter(name => !supplied.has(name)).length,
    files: names.filter(name => !name.startsWith("/checker/")).sort() };
}
const main = "/project/src/main.mts";
const utility = { "/project/src/util.mts": "export function twice(value: number): number { return value * 2; }\n" };

test("the option table is written once: sixteen rows, each named once with its reason; the set has one entry per row in the table's order, and the declaration policy changes one entry", () => {
  assert.deepEqual(optionModule.optionTable.map(row => row.name), tableNames);
  assert.equal(new Set(tableNames).size, tableNames.length);
  for (const row of optionModule.optionTable) assert.equal(row.reason.length > 20, true, row.name);
  const constant = { module: "nodenext", moduleResolution: "nodenext", target: "es2024", strict: true, noEmit: true, noLib: true, allowImportingTsExtensions: true,
    allowArbitraryExtensions: true, skipLibCheck: false, noUncheckedIndexedAccess: false, exactOptionalPropertyTypes: false,
    useDefineForClassFields: true, esModuleInterop: true, resolveJsonModule: false, allowJs: false };
  for (const [policy, types] of [["package-contract", ["*"]], ["none", []]]) {
    assert.deepEqual(optionModule.optionSet(policy).map(option => option.name), tableNames, policy);
    assert.deepEqual(optionRecord(policy), { ...constant, types }, policy);
  }
});

test("F-7: the real checker accepts the whole option set, and a name it does not know is a diagnostic of the session's configuration, which Front treats as session-level", () => {
  const files = { [main]: "import { twice } from \"./util.mjs\";\nexport const xs: number[] = [twice(1)];\nexport const m = new Map<string, number>();\n", ...utility };
  for (const policy of ["none", "package-contract"]) {
    assert.deepEqual(checkedUnder(files, { policy }), { diagnostics: [], notSupplied: 0, files: [main, "/project/src/util.mts"] }, policy);
  }
  assert.deepEqual(checkedUnder(files, { changes: { noUncheckedIndexAccess: true } }).diagnostics, ["TS5023 (no file)"],
    "so the empty list above states that every name of the table is an option of this checker");
});

// For each row: one program, its checked result under the table, and under the opposite value of that row alone.
const rowCases = [
  { row: "module", opposite: "esnext", files: { [main]: "import { twice } from \"./util\";\nexport const t = twice(1);\n", ...utility },
    table: ["TS2835 /project/src/main.mts"], other: ["TS2835 /project/src/main.mts", "TS5110 (no file)"] },
  { row: "moduleResolution", opposite: "bundler", files: { [main]: "import { twice } from \"./util\";\nexport const t = twice(1);\n", ...utility },
    table: ["TS2835 /project/src/main.mts"], other: ["TS2307 /project/src/main.mts", "TS5095 (no file)", "TS5109 (no file)"] },
  { row: "target", opposite: "es2019", files: { [main]: "export const big = 1n;\n" }, table: [], other: ["TS2737 /project/src/main.mts"] },
  { row: "strict", opposite: false, files: { [main]: "export const n: number = null;\n" }, table: ["TS2322 /project/src/main.mts"], other: [] },
  { row: "noEmit", opposite: false, files: { [main]: "export const n: number = 1;\n" }, table: [], other: ["TS5096 (no file)"] },
  { row: "noLib", opposite: false, files: { [main]: "export const m = new Map<string, number>();\n" }, libraries: [],
    table: ["TS2318 (no file)", "TS2583 /project/src/main.mts"], other: [], otherReadsInstalledLibraries: true },
  { row: "allowImportingTsExtensions", opposite: false, files: { [main]: "import { twice } from \"./util.mts\";\nexport const t = twice(1);\n", ...utility },
    table: [], other: ["TS5097 /project/src/main.mts"] },
  { row: "allowArbitraryExtensions", opposite: false,
    files: { [main]: "import { sheet } from \"./a.css\";\nexport const d: string = sheet;\n", "/project/src/a.d.css.ts": "export declare const sheet: string;\n" },
    table: [], other: ["TS6263 /project/src/main.mts"] },
  { row: "skipLibCheck", opposite: true,
    files: { [main]: "import { x } from \"./bad.mjs\";\nexport const y = x;\n", "/project/src/bad.d.mts": "export declare const x: Missing;\n" },
    table: ["TS2304 /project/src/bad.d.mts"], other: [] },
  { row: "noUncheckedIndexedAccess", opposite: true, files: { [main]: "const xs: number[] = [1];\nexport const n: number = xs[0];\n" },
    table: [], other: ["TS2322 /project/src/main.mts"] },
  { row: "exactOptionalPropertyTypes", opposite: true, files: { [main]: "interface P { x?: number }\nexport const p: P = { x: undefined };\n" },
    table: [], other: ["TS2375 /project/src/main.mts"] },
  { row: "useDefineForClassFields", opposite: false, files: { [main]: "class A { x: number = 1; }\nexport class B extends A { x!: number; }\n" },
    table: ["TS2612 /project/src/main.mts"], other: [] },
  { row: "esModuleInterop", opposite: false,
    files: { [main]: "import { n } from \"./a.cjs\";\nexport const m = n;\n", "/project/src/a.d.cts": "import v from \"./lib.cjs\";\nexport declare const n: typeof v;\n",
      "/project/src/lib.d.cts": "declare const v: { n: number };\nexport = v;\n" },
    table: [], other: ["TS5108 (no file)"] },
  { row: "resolveJsonModule", opposite: true,
    files: { [main]: "import data from \"./data.json\" with { type: \"json\" };\nexport const d = data;\n", "/project/src/data.json": "{ \"a\": 1 }\n" },
    table: ["TS2732 /project/src/main.mts"], other: [], otherFiles: ["/project/src/data.json", main] },
  { row: "allowJs", opposite: true, files: { [main]: "import { j } from \"./j.mjs\";\nexport const k = j;\n", "/project/src/j.mjs": "export const j = 1;\n" },
    table: ["TS7016 /project/src/main.mts"], other: [], otherFiles: ["/project/src/j.mjs", main] },
];

test("each constant row decides a checked result: one program per row, checked under the whole table and under the opposite value of that row alone", () => {
  assert.deepEqual(rowCases.map(entry => entry.row), tableNames.filter(name => name !== "types"), "every constant row has its program; the types row has its own case");
  for (const entry of rowCases) {
    const libraries = entry.libraries ?? bundled();
    const underTable = checkedUnder(entry.files, { libraries });
    const underOpposite = checkedUnder(entry.files, { libraries, changes: { [entry.row]: entry.opposite } });
    assert.deepEqual(underTable.diagnostics, entry.table, `${entry.row}: under the table`);
    assert.equal(underTable.notSupplied, 0, `${entry.row}: under the table every program file is a supplied file`);
    assert.deepEqual(underOpposite.diagnostics, entry.other, `${entry.row}: under ${JSON.stringify(entry.opposite)}`);
    assert.equal(underOpposite.notSupplied > 0, entry.otherReadsInstalledLibraries === true, `${entry.row}: whether the opposite reads the installed checker's libraries`);
    if (entry.otherFiles !== undefined) assert.deepEqual(underOpposite.files, entry.otherFiles, `${entry.row}: the opposite admits a further program file`);
    assert.notEqual(JSON.stringify(underTable), JSON.stringify(underOpposite), `${entry.row}: the two values give different checked results`);
  }
});

const ambientPackage = { root: "/project/node_modules/@types/thing", name: "@types/thing", modules: { "index.d.ts": ["declaration", "declare const thingGlobal: number;\n"] } };

test("the types row: under package-contract an installed declaration package that the snapshot captured is ambient without an import; under none it is not; either way only captured files are program files", () => {
  const sourceFiles = { "main.mts": "export const g: number = thingGlobal;\n" };
  const ambient = moduleOf(packageOf(ambientPackage.root), "index.d.ts");
  const admitted = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [ambientPackage], installedDeclarations: "package-contract" });
  assert.deepEqual(sessionDiagnostics(admitted), []);
  const admittedSet = openAndCapture(admitted).set.modules;
  assert.deepEqual(admittedSet, snapshotModules(admitted), "the captured package's declaration file is a program module");
  assert.equal(admittedSet.some(entry => entry.module === ambient), true);
  const suppressed = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [ambientPackage], installedDeclarations: "none" });
  assert.deepEqual(sessionDiagnostics(suppressed), ["TS2304 /project/src/main.mts"]);
  assert.equal(openAndCapture(suppressed).set.modules.some(entry => entry.module === ambient), false, "captured, but not a file of the program");
  const absent = projectSnapshot({ sourceFiles, libraries: bundled(), installedDeclarations: "package-contract" });
  assert.deepEqual(sessionDiagnostics(absent), ["TS2304 /project/src/main.mts"], "the wildcard reaches what the snapshot captured and nothing else");
  assert.deepEqual(openAndCapture(absent).set.modules, snapshotModules(absent));
});

test("a source module of a second captured package is checked like any other: no option of the table restricts where sources stand", () => {
  const second = { root: "/dep", name: "dep", modules: { "src/x.mts": ["source", "export const dep: number = 1;\n", true] } };
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": "import { dep } from \"../../dep/src/x.mjs\";\nexport const d: number = dep;\n" }, libraries: bundled(), otherPackages: [second] });
  assert.deepEqual(sessionDiagnostics(snapshot), []);
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
  const files = { [main]: "import { dep } from \"../../dep/src/x.mjs\";\nexport const d: number = dep;\n", "/dep/src/x.mts": "export const dep: number = 1;\n" };
  assert.deepEqual(checkedUnder(files, { roots: [main, "/dep/src/x.mts"], changes: { rootDir: "/project" } }).diagnostics, ["TS6059 /project/src/main.mts"],
    "the opposite: with an emission root the checker refuses the second package's source, which is why the table has no such row");
});

test("the session's configuration is Front's: a configuration file captured at the project root is an ordinary file of the session and changes nothing, because the session is in the checker's options mode", () => {
  const sourceFiles = { "main.mts": "export const n: number = null;\n" };
  const projectConfiguration = "{ \"compilerOptions\": { \"strict\": false, \"noLib\": false }, \"files\": [\"src/main.mts\"] }\n";
  const snapshot = projectSnapshot({ sourceFiles, libraries: bundled(),
    extraFiles: { "/project/tsconfig.json": projectConfiguration, "/project/src/tsconfig.json": "{ \"compilerOptions\": { \"strict\": false } }\n" } });
  const inputs = checkerModule.sessionInputs(snapshot.source.input);
  assert.equal(inputs.files.get("/project/tsconfig.json"), projectConfiguration, "the captured bytes are in the session");
  assert.equal(inputs.files.has("/project/src/tsconfig.json"), true, "as is every other captured file");
  assert.deepEqual(sessionDiagnostics(snapshot), ["TS2322 /project/src/main.mts"], "strict, from the table");
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot), "and no library of the installed checker is a program file");
  const configured = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", configFileName: "/project/tsconfig.json",
    files: new Map([[main, sourceFiles["main.mts"]], ["/project/tsconfig.json", projectConfiguration]]), useCaseSensitiveFileNames: true });
  const configuredChecked = configured.checkSource();
  assert.deepEqual({ diagnostics: configured.getDiagnostics("all").length, readsInstalledLibraries: configuredChecked.getSourceFiles().some(file => !configuredChecked.ast.getFileName(file).startsWith("/project/")) },
    { diagnostics: 0, readsInstalledLibraries: true }, "the opposite: the checker's configuration mode, given the file by name, takes its options from it");
});

test("a module is its captured path: one text captured under two paths is two modules with distinct identities, and link preservation is no option of the table", () => {
  assert.equal(tableNames.includes("preserveSymlinks"), false);
  const text = "export const copy: number = 1;\n";
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": "import { copy as a } from \"../../copy-a/x.mjs\";\nimport { copy as b } from \"../../copy-b/x.mjs\";\nexport const sum: number = a + b;\n" },
    libraries: bundled(), otherPackages: [{ root: "/copy-a", name: "copy-a", modules: { "x.mts": ["source", text, true] } }, { root: "/copy-b", name: "copy-b", modules: { "x.mts": ["source", text, true] } }] });
  snapshot.source.input.packages.files.find(file => file.path === "/copy-b/x.mts").realPath = "/copy-a/x.mts";
  const { set } = openAndCapture(snapshot);
  assert.deepEqual(set.modules, snapshotModules(snapshot));
  const copies = [moduleOf(packageOf("/copy-a"), "x.mts"), moduleOf(packageOf("/copy-b"), "x.mts")];
  assert.notEqual(copies[0], copies[1]);
  for (const copy of copies) assert.equal(set.modules.filter(entry => entry.module === copy).length, 1);
  assert.deepEqual(sessionDiagnostics(snapshot), []);
});

test("a contributed declaration module is a root of the program: its declarations are visible without an import, and it is a program module", () => {
  const contributed = { root: "/contributed", name: "contributed", modules: { "globals.d.ts": ["declaration", "declare const contributedGlobal: number;\n"] } };
  const identity = moduleOf(packageOf("/contributed"), "globals.d.ts");
  const sourceFiles = { "main.mts": "export const g: number = contributedGlobal;\n" };
  const captured = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [contributed] });
  assert.deepEqual(sessionDiagnostics(captured), ["TS2304 /project/src/main.mts"], "captured and not contributed: not a file of the program");
  assert.equal(openAndCapture(captured).set.modules.some(entry => entry.module === identity), false);
  const rooted = projectSnapshot({ sourceFiles, libraries: bundled(), otherPackages: [contributed] });
  rooted.source.input.declarationModules = [identity];
  rooted.source = preparedSource(rooted.source.input);
  assert.deepEqual(sessionDiagnostics(rooted), []);
  assert.deepEqual(openAndCapture(rooted).set.modules, snapshotModules(rooted));
  const unknown = projectSnapshot({ sourceFiles, libraries: bundled() });
  unknown.source.input.declarationModules = [identity];
  assert.deepEqual(snapshots.verifySnapshot(unknown, []).map(violation => violation.rule), ["contributed-declaration-module"], "the Snapshot verifier refuses it");
  assert.equal(front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, unknown).diagnostics[0].code.name,
    "TSONIC_SOURCE_PREPARATION_INVALID");
});

test("the public import boundary prepares distinct configured roots from the same bytes and rejects a crossed receipt before checking", async () => {
  const { importPreparationOf, prepareImports } = await import("../../packages/host/dist/pipeline/index.js");
  const snapshot = projectSnapshot({ sourceFiles: {
    "first.mts": '\uFEFF/* 🚀 */ import { alpha } from "./alpha.mjs"; export { alpha };',
    "second.mts": 'import { beta } from "./beta.mjs"; export { beta };',
    "alpha.mts": "export const alpha: boolean = true;",
    "beta.mts": "export const beta: boolean = false;",
  }, libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }] });
  const input = snapshot.source.input;
  const run = name => {
    const entryPoint = moduleOf(packageOf("/project"), `src/${name}.mts`);
    const result = prepareImports({ navigationCapture }, { ...input, roots: [entryPoint] });
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    return { ...snapshot, entryPoint, source: result.value };
  };
  const first = run("first");
  const second = run("second");
  const tiny = prepareImports({ navigationCapture: { ...navigationCapture, maximumCapturedEdgesPerModule: 0 } }, first.source.input);
  assert.equal(tiny.kind, "refused");
  assert.equal(tiny.diagnostics[0].code.name, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.deepEqual(tiny.diagnostics[0].site, { kind: "file", path: "/project/src/first.mts" });
  assert.equal(first.source.input.packages, second.source.input.packages);
  const importsOf = current => importPreparationOf(current.source.receipt).files.flatMap(file => file.references)
    .filter(reference => reference.kind === "import");
  assert.deepEqual(importsOf(first).map(reference => reference.resolution), [{ kind: "resolved", fileName: "/project/src/alpha.mts" }]);
  assert.deepEqual(importsOf(second).map(reference => reference.resolution), [{ kind: "resolved", fileName: "/project/src/beta.mts" }]);
  const opened = openAndCapture(first);
  assert.ok(opened.set.modules.some(entry => entry.kind === "snapshot" && entry.module === moduleOf(packageOf("/project"), "src/alpha.mts")));
  assert.equal(opened.set.modules.some(entry => entry.kind === "snapshot" && entry.module === second.entryPoint), false);
  const crossed = { ...first, source: { input: first.source.input, receipt: second.source.receipt } };
  assert.equal(snapshots.verifyPreparedSource({ input: crossed.source.input, preparation: importPreparationOf(crossed.source.receipt) })[0].rule,
    "prepared-roots-exact");
  const refused = front.openCheckedProgram({ extensions: front.createCheckerExtensions([]), navigationCapture }, crossed);
  assert.equal(refused.kind, "refused");
  assert.equal(refused.diagnostics[0].code.name, "TSONIC_SOURCE_PREPARATION_INVALID");
});

test("the same roots and source spans cannot reuse a different completed import graph", () => {
  const libraries = [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }];
  const source = entry => `import { choice } from "./${entry}.mjs"; export const selected: boolean = choice;`;
  const graph = entry => {
    const snapshot = projectSnapshot({ sourceFiles: { "main.mts": source(entry),
      "alpha.mts": "export const choice: boolean = true;", "bravo.mts": "export const choice: boolean = false;" }, libraries });
    return { ...snapshot, source: preparedSource({ ...snapshot.source.input, roots: [snapshot.entryPoint] }) };
  };
  const alpha = graph("alpha");
  const bravo = graph("bravo");
  const read = snapshot => front.importPreparationOf(snapshot.source.receipt);
  assert.deepEqual(read(alpha).roots, read(bravo).roots);
  const actual = snapshot => read(snapshot).files.find(file => file.fileName === "/project/src/main.mts").references[0];
  assert.deepEqual([actual(alpha).start, actual(alpha).length], [actual(bravo).start, actual(bravo).length]);
  const { deps } = openAndCapture(alpha);
  for (const [snapshot, expected, other] of [[alpha, "alpha", "bravo"], [bravo, "bravo", "alpha"]]) {
    const mod = entry => moduleOf(packageOf("/project"), `src/${entry}.mts`);
    const opened = front.openCheckedProgram(deps, snapshot);
    assert.equal(opened.kind, "ok");
    const loaded = front.captureProgramModules(deps, opened.value).modules;
    assert.equal(loaded.some(row => row.kind === "snapshot" && row.module === mod(expected)), true);
    assert.equal(loaded.some(row => row.kind === "snapshot" && row.module === mod(other)), false);
  }
  const withoutOpening = snapshot => ({ ...snapshot, contributions: { ...snapshot.contributions,
    get requiredProviderModules() { assert.fail("rejected source preparation must not open the checker"); } } });
  const crossed = { ...bravo, source: { input: bravo.source.input, receipt: alpha.source.receipt } };
  assert.deepEqual(snapshots.verifyPreparedSource({ input: crossed.source.input, preparation: read(alpha) }), [],
    "both captured paths and all source spans are structurally valid");
  const receipt = alpha.source.receipt;
  const copied = Object.create(Object.getPrototypeOf(receipt), Object.getOwnPropertyDescriptors(receipt));
  assert.throws(() => front.importPreparationOf(copied),
    error => error.cause?.message === "An import report requires its actual completed preparation.");
  for (const candidate of [crossed, { ...alpha, source: { ...alpha.source, receipt: copied } },
    { ...alpha, source: { input: alpha.source.input, preparation: read(alpha) } }]) {
    const refused = front.openCheckedProgram(deps, withoutOpening(candidate));
    assert.equal(refused.kind, "refused");
    assert.equal(refused.diagnostics[0].code.name, "TSONIC_SOURCE_PREPARATION_INVALID");
    assert.match(refused.diagnostics[0].message, /actual completed compiler input/u);
  }
  const view = actual(alpha);
  view.resolution.fileName = actual(bravo).resolution.fileName;
  assert.equal(actual(alpha).resolution.fileName, "/project/src/alpha.mts");
  assert.equal(front.openCheckedProgram(deps, alpha).kind, "ok");
  const extra = projectSnapshot({ sourceFiles: { "extra.mts": "export const extra = true;" }, libraries });
  const packages = alpha.source.input.packages;
  const additional = {
    ...packages, files: [...packages.files, extra.source.input.packages.files.find(row => row.path === "/project/src/extra.mts")],
    modules: [...packages.modules, extra.source.input.packages.modules.find(row => row.path === "/project/src/extra.mts")],
  };
  const expanded = front.openCheckedProgram(deps, withoutOpening({ ...alpha, source: { receipt,
    input: { ...alpha.source.input, packages: additional } } }));
  assert.equal(expanded.kind, "refused");
  assert.match(expanded.diagnostics[0].message, /actual completed compiler input/u);
  const file = alpha.source.input.packages.files.find(row => row.path === "/project/src/main.mts");
  file.text = source("bravo");
  const reused = front.openCheckedProgram(deps, withoutOpening(alpha));
  assert.equal(reused.kind, "refused");
  assert.equal(reused.diagnostics[0].message, "The prepared source does not retain its actual completed compiler input.");
});

test("the compiler input cannot borrow a root from another captured module catalogue", () => {
  const libraries = [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }];
  const first = projectSnapshot({ sourceFiles: { "first.mts": "export const first = true;" }, libraries });
  const second = projectSnapshot({ sourceFiles: { "second.mts": "export const second = true;" }, libraries });
  assert.notEqual(first.entryPoint, second.entryPoint);
  assert.throws(() => checkerModule.sessionInputs({ ...first.source.input, roots: [second.entryPoint] }), {
    name: "TypeError", message: "front: a root, contributed declaration or bundled library of the snapshot names no module of the snapshot",
  });
});

test("an actual import report retains a file-only site or no site independently of source ownership", async () => {
  const { importDiagnostic } = await import("../../packages/host/dist/front/diagnostics.js");
  const path = "/project/main.mts";
  const rootFiles = [path];
  const currentDirectory = "/project";
  const files = new Map([[path, "export function broken() {"]]);
  const [syntax] = sdk.prepareSourceImports({ currentDirectory, rootFiles, files, compilerOptions: { noLib: true } }).diagnostics;
  assert.equal(syntax.code, 1005);
  const withoutOwner = importDiagnostic(syntax, () => undefined);
  assert.deepEqual(withoutOwner.site, { kind: "file", path });
  assert.deepEqual(withoutOwner.related.map(row => [row.code.number, row.site]), [[1007, { kind: "file", path }]]);
  const [option] = sdk.prepareSourceImports({ currentDirectory, rootFiles, files,
    compilerOptions: { noLib: true, unknownInheritedOption: true } }).diagnostics;
  assert.equal(option.code, 5023);
  const withoutSite = importDiagnostic(option, () => assert.fail("a site-less report does not read the source resolver"));
  assert.deepEqual(withoutSite.site, { kind: "none" });
  assert.equal(withoutSite.code.rendered, "TS5023");
});

test("prepared file identity comes from the actual captured file, not the spelling of its import", () => {
  const text = "\uFEFF/* 🚀 */ export function broken() { return true;";
  const snapshot = projectSnapshot({ sourceFiles: {
    "main.mts": 'import "./TyPeD.mjs";',
    "typed.mts": text,
  }, libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }] });
  const { input } = snapshot.source;
  const selected = front.prepareSourceImports({ navigationCapture }, { ...input, caseSensitive: false, roots: [snapshot.entryPoint] });
  assert.equal(selected.kind, "ok");
  const name = "/project/src/typed.mts";
  const typed = moduleOf(packageOf("/project"), "src/typed.mts");
  const report = front.importPreparationOf(selected.value.receipt);
  const reference = report.files.find(file => file.fileName === "/project/src/main.mts").references[0];
  assert.deepEqual(reference.resolution, { kind: "resolved", fileName: name });
  const [diagnostic] = report.diagnostics;
  assert.equal(diagnostic.code.number, 1005);
  const site = (start, length) => ({ kind: "source", origin: { module: typed, start, length, derived: [] } });
  assert.deepEqual(diagnostic.site, site(text.length, 0));
  assert.deepEqual(diagnostic.arguments, [{ kind: "text", value: "}" }]);
  assert.deepEqual(diagnostic.related.map(row => [row.code.number, row.site]), [[1007, site(text.indexOf("{"), 0)]]);
  const deps = { extensions: front.createCheckerExtensions([]), navigationCapture };
  const opened = front.openCheckedProgram(deps, { ...snapshot, source: selected.value });
  assert.equal(opened.kind, "ok");
  assert.ok(front.captureProgramModules(deps, opened.value).modules.some(row => row.kind === "snapshot" && row.module === typed));
  const unowned = { ...selected.value.input, packages: {
    ...selected.value.input.packages, modules: input.packages.modules.filter(row => row.id !== typed),
  } };
  const refusal = front.prepareSourceImports({ navigationCapture }, unowned);
  const crossed = front.openCheckedProgram(deps, { ...snapshot, source: { input: unowned, receipt: selected.value.receipt } });
  assert.deepEqual(refusal, crossed, "the same SDK file with no captured module is refused before checked opening");
  assert.equal(refusal.kind, "refused");
  assert.deepEqual(refusal.diagnostics.map(row => [row.code.name, row.site]),
    [["TSONIC_SOURCE_PREPARATION_INVALID", { kind: "file", path: name }]]);
});

// The program R2 named for the provider join. Its outcome was derived before it was run (package W5-7 part A): one identity names one
// provider in a session, so the open cannot succeed. Which registration the session meets first is the session's own order and decides
// nothing here. The join of a session document therefore never has two candidates of one identity; what stays pending on the registrar
// (W7's, in the checker SDK) is the provider that an initializer registers under its own identity.
test("two providers of one identity never open a program: a provider registered by an extension initializer under the identity of a directly loaded registration is refused by the session", () => {
  const libraries = bundled();
  const sourceFiles = { "main.mts": "import { Value } from \"native:thing\";\nimport { Value as Other } from \"native:elsewhere\";\nexport const v: number = Value + Other;\n" };
  const direct = providerRegistration("/provider-one", declarationProvider("test.provider", "native:thing", "native.thing"));
  const inner = declarationProvider("test.provider", "native:elsewhere", "native.elsewhere", 9_900_200);
  const viaInitializer = { reference: reference("/provider-two", "extension"), value: { kind: "compiler-extension",
    value: { identity: { id: "test.registers.under.a.loaded.identity", version: "1.0.0" }, initialize: context => { context.registerSourceDeclarationProvider(inner); } } } };
  const snapshot = projectSnapshot({ sourceFiles, libraries, providerPackages: [{ root: "/provider-one", name: "one" }, { root: "/provider-two", name: "two" }],
    declarationProviders: [direct.reference], compilerExtensions: [viaInitializer.reference] });
  const deps = { extensions: front.createCheckerExtensions([direct, viaInitializer]), navigationCapture };
  assert.deepEqual(snapshots.verifySnapshot(snapshot, front.extensionReferencesOf(deps.extensions)), []);
  const open = () => front.openCheckedProgram(deps, snapshot);
  const rejected = open();
  assert.equal(rejected.kind, "refused");
  assert.deepEqual(rejected.diagnostics.map(diagnostic => [diagnostic.code.kind, diagnostic.code.extensionCode, diagnostic.source]),
    [["extension", "DUPLICATE_SOURCE_DECLARATION_PROVIDER", "tsts.extension-host"]]);
});

test("the module set is the opened program's, not the snapshot's: declaration modules of a package that nothing reaches are modules of the snapshot and not of the set", () => {
  const unreached = { root: "/unreached", name: "unreached", modules: { "one.d.ts": ["declaration", "export declare const one: number;\n"], "two.d.ts": ["declaration", "export declare const two: number;\n"] } };
  const snapshot = projectSnapshot({ sourceFiles: plainSources, libraries: bundled(), otherPackages: [unreached] });
  const { set } = openAndCapture(snapshot);
  const absent = ["one.d.ts", "two.d.ts"].map(name => moduleOf(packageOf("/unreached"), name));
  assert.equal(snapshot.source.input.packages.modules.length, set.modules.length + 2);
  assert.deepEqual(set.modules, snapshotModules(snapshot).filter(entry => !absent.includes(entry.module)));
});

test("a module with a syntax error and a type error opens and is captured: file diagnostics do not stop the open", () => {
  const snapshot = projectSnapshot({ sourceFiles: { "main.mts": "export const n: number = \"text\";\nexport const broken = ;\n" }, libraries: bundled() });
  assert.deepEqual([...new Set(sessionDiagnostics(snapshot))].sort(), ["TS1109 /project/src/main.mts", "TS2322 /project/src/main.mts"],
    "derived before the run: an expression is expected after the equals sign (TS1109), and a string is not assignable to number (TS2322)");
  assert.deepEqual(openAndCapture(snapshot).set.modules, snapshotModules(snapshot));
});

// Checkpoint 1 (K-3286): one real program through the SDK, the snapshot and Front's production operations to verified HIR.
// Every expected value below was derived by hand from the source text and the identity law, before the lowering existed.
const addSource = "export function add(a: number, b: number): number { return a + b; }\n";

test("checkpoint 1: add is opened through the checker and the snapshot, captured, lowered by Front's production operations to HIR the HIR verifier accepts, and equals the independently written expectation", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { deps, program, module } = openedModule(addSource);
  const raw = captureSingleModule(front, deps, program, module);
  assert.equal(raw.kind, "ok");
  // The syntax tree in HIR's preorder: kind, parent and authored origin (UTF-16 offset and length) of every node, by hand.
  const expectedNodes = [
    ["SourceFile", null, 0, 68], ["FunctionDeclaration", 0, 0, 67], ["ExportKeyword", 1, 0, 6], ["Identifier", 1, 16, 3],
    ["Parameter", 1, 20, 9], ["Identifier", 4, 20, 1], ["NumberKeyword", 4, 23, 6],
    ["Parameter", 1, 31, 9], ["Identifier", 7, 31, 1], ["NumberKeyword", 7, 34, 6],
    ["NumberKeyword", 1, 43, 6], ["Block", 1, 50, 17], ["ReturnStatement", 11, 52, 13], ["BinaryExpression", 12, 59, 5],
    ["Identifier", 13, 59, 1], ["PlusToken", 13, 61, 1], ["Identifier", 13, 63, 1], ["EndOfFile", 0, 68, 0]];
  const rawNodes = hir.indexSyntaxTree(raw.value.tree);
  assert.deepEqual(rawNodes.map(node => [node.kind, node.parent, node.origin.start, node.origin.length]), expectedNodes);
  assert.deepEqual(rawNodes.map(node => node.id), expectedNodes.map((unusedValue, position) => position), "identities are preorder positions");
  // Identities (K-3236): the module, add, and its two parameters.
  const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
  assert.equal(definitions.kind, "ok");
  const definition = segments => ids.encodeDefId({ module, segments: segments.map(([name, ordinal]) => ({ name, ordinal })) });
  const moduleDefinition = definition([]);
  const addDefinition = definition([["add", 0]]);
  const aDefinition = definition([["add", 0], ["a", 0]]);
  const bDefinition = definition([["add", 0], ["b", 0]]);
  assert.deepEqual(definitions.value.rows.map(row => [row.node, row.kind, row.definition]),
    [[0, "SourceFile", moduleDefinition], [1, "FunctionDeclaration", addDefinition], [4, "Parameter", aDefinition], [7, "Parameter", bDefinition]]);
  const interner = types.createTypeInterner();
  const lowerDeps = lowerDepsFor(definitions.value, interner, addSource);
  // The export entry.
  const exported = front.lowerModuleExports(lowerDeps, raw.value);
  assert.deepEqual(exported, { kind: "ok", diagnostics: [], value: { module,
    entries: [{ name: "add", typeOnlyStar: null, target: { kind: "declarations", definitions: [addDefinition] } }], bindings: [] } });
  // The checked module.
  const lowered = lowerWithReadyExports(lowerDeps, raw.value);
  assert.equal(lowered.kind, "ok");
  const value = lowered.value;
  const float64 = types.internType(interner, { kind: "primitive", primitive: "float64" });
  const addBody = ids.encodeBodyId({ owner: addDefinition, role: "function", ordinal: 0 });
  const moduleBody = ids.encodeBodyId({ owner: moduleDefinition, role: "module", ordinal: 0 });
  const local = index => ({ body: addBody, local: index });
  const nodes = hir.indexSyntaxTree(value.tree);
  const at = id => nodes.find(node => node.id === id);
  assert.deepEqual(nodes.map(node => [node.kind, node.parent, node.origin.start, node.origin.length]), expectedNodes, "lowering keeps the tree");
  assert.equal(at(0).tsonic.definition, moduleDefinition);
  assert.equal(at(0).tsonic.body, moduleBody);
  const callable = at(1).tsonic;
  assert.deepEqual([callable.definition, callable.parent, callable.body, callable.parameters], [addDefinition, moduleDefinition, addBody, []]);
  assert.equal(callable.signatures.length, 1);
  assert.deepEqual({ ...callable.signatures[0], signature: null }, { declaration: addDefinition, role: "api-body", signature: null, body: addBody });
  // K-3312.1: add is not overloaded; a call of it selects its one endpoint as both the advertised and the API endpoint.
  assert.equal(hir.hasOverloadEndpoints(callable.signatures), false);
  assert.equal(hir.selectedEndpointRoleFaults(false, callable.signatures[0], callable.signatures[0]), 0);
  const signature = types.readSignature(interner, callable.signatures[0].signature);
  assert.deepEqual([signature.declaration, signature.kind, signature.receiver, signature.result], [addDefinition, "call", null, float64]);
  assert.deepEqual(signature.parameters, [
    { declaration: aDefinition, kind: "required", type: float64, passing: "by-value", initializer: null , acceptsOmission: false },
    { declaration: bDefinition, kind: "required", type: float64, passing: "by-value", initializer: null , acceptsOmission: false }]);
  assert.deepEqual(at(3).tsonic, { ...at(3).tsonic, role: "declaration-name", declaration: { kind: "definition", definition: addDefinition } });
  for (const [parameter, name, index, definitionOfParameter] of [[4, 5, 0, aDefinition], [7, 8, 1, bDefinition]]) {
    const checked = at(parameter).tsonic;
    assert.deepEqual([checked.parent, checked.declaration, checked.declaredType, checked.initializer], [addDefinition, { kind: "local", local: local(index) }, { kind: "available", value: float64 }, null]);
    assert.deepEqual([at(name).tsonic.role, at(name).tsonic.declaration], ["declaration-name", { kind: "local", local: local(index) }]);
    assert.equal(definitionOfParameter, definitions.value.rows.find(row => row.node === parameter).definition);
  }
  for (const typeNode of [6, 9, 10]) assert.deepEqual(at(typeNode).tsonic.type, { kind: "available", value: float64 });
  assert.deepEqual([at(13).tsonic.role, at(13).tsonic.value.views], ["arithmetic",
    { read: { kind: "available", value: float64 }, declared: { kind: "available", value: null }, contextual: { kind: "available", value: float64 } }]);
  for (const [use, index] of [[14, 0], [16, 1]]) assert.deepEqual([at(use).tsonic.role, at(use).tsonic.resolution, at(use).tsonic.value.views], ["value",
    { kind: "local", local: local(index) },
    { read: { kind: "available", value: float64 }, declared: { kind: "available", value: null }, contextual: { kind: "available", value: null } }]);
  for (const plain of [2, 11, 12, 15, 17]) assert.equal(at(plain).tsonic, null);
  // Bodies and items.
  assert.deepEqual(value.bodies.map(body => [body.body, body.owner, body.root.id, body.nestedBodies]),
    [[addBody, addDefinition, 11, []], [moduleBody, moduleDefinition, 0, [addBody]]].sort((left, right) => left[0] < right[0] ? -1 : 1));
  const addBodyRecord = value.bodies.find(body => body.body === addBody);
  assert.deepEqual(addBodyRecord.params, [
    { local: 0, declaration: aDefinition, role: "required", passing: "by-value", initializer: null },
    { local: 1, declaration: bDefinition, role: "required", passing: "by-value", initializer: null }]);
  assert.deepEqual(addBodyRecord.locals.map(entry => [entry.id, entry.name, entry.role, entry.declaration, entry.checkerSlot, entry.mutable]), [
    [0, "a", "parameter", { kind: "item", value: { owner: aDefinition, node: 4 } }, { kind: "available", value: float64 }, true],
    [1, "b", "parameter", { kind: "item", value: { owner: bDefinition, node: 7 } }, { kind: "available", value: float64 }, true]]);
  assert.deepEqual(value.items.map(item => [item.definition, item.node]).sort(), [[aDefinition, 4], [bDefinition, 7], [addDefinition, 1]].sort());
  assert.deepEqual([value.checkerDiagnostics, value.obligations], [[], []]);
  // The HIR verifier accepts it, and its text form reads back to the same module.
  assert.deepEqual(verifyChecked(value, interner), []);
  const reread = hir.parseHir(hir.printHir(value));
  assert.equal(reread.kind, "parsed");
  assert.deepEqual(reread.value, value);
  // A repeated open, capture and lowering of the same program, through the shared fixture's whole path, gives the same results.
  const again = checkedModuleOf(addSource);
  assert.deepEqual([again.module, again.raw, again.definitions, again.exports, again.checked], [module, raw.value, definitions.value, exported.value, value]);
});

test("checkpoint 1, the development frontier: a module holding a kind whose checked annotation is not written is refused at once by the one check, never lowered in part", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const sourceText = "export function update(a: { x: number }): number { return ++a.x; }\n";
  const { deps, program, module } = openedModule(sourceText);
  const raw = captureSingleModule(front, deps, program, module);
  assert.equal(raw.kind, "ok", "capture covers every syntax kind");
  const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
  assert.throws(() => lowerWithReadyExports(lowerDepsFor(definitions.value, types.createTypeInterner(), sourceText), raw.value),
    { name: "TypeError", message: "front: checked annotation not implemented: PrefixUnaryExpression with a non-identifier update target" });
});

test("checked prefix and postfix updates retain the same qualified slot for their read and write", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const { checked, interner, raw } = checkedModuleOf("export function update(value: number): number { ++value; return value--; }\n");
  const callable = checked.tree.statements.nodes[0];
  const [prefix, postfix] = callable.body.statements.nodes.map(node => node.expression);
  for (const update of [prefix, postfix]) {
    const target = update.operand.tsonic;
    assert.equal(update.tsonic.role, "update");
    assert.equal(target.access, "read-write");
    assert.equal(target.resolution.kind, "local");
    assert.deepEqual(update.tsonic.target, target.place);
    assert.equal(target.place.value.read.value, target.place.value.write.value);
    const selected = raw.storage.find(row => row.node.node === update.operand.id);
    assert.equal(selected.fact.value.writable, true);
    assert.equal(selected.fact.value.declaration.node, callable.parameters.nodes[0].id);
  }
  assert.deepEqual(verifyChecked(checked, interner), []);
  const parsed = hir.parseHir(hir.printHir(checked));
  assert.equal(parsed.kind, "parsed");
  assert.deepEqual(parsed.value, checked);
});


// K-3313.3: a parameter's type is the checker's type of that parameter, read from capture's signature row; the result type
// is the checker's result type; an annotation's type is the type the checker gives that type node. Expectations written
// before the run.
test("K-3313.3: parameter, local and result types are the checker's own, slot by slot; differing explicit types stay apart and no parameter borrows the result type", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { checked, interner } = checkedModuleOf("export function pick(flag: boolean, text: string, n: number): number { return n; }\n");
  const term = value => types.internType(interner, value);
  const available = value => ({ kind: "available", value });
  const [bool, string, float64] = [term({ kind: "primitive", primitive: "bool" }), term({ kind: "string" }), term({ kind: "primitive", primitive: "float64" })];
  const nodes = hir.indexSyntaxTree(checked.tree);
  const callable = nodes.find(node => node.kind === "FunctionDeclaration").tsonic;
  const signature = types.readSignature(interner, callable.signatures[0].signature);
  assert.deepEqual(signature.parameters.map(parameter => parameter.type), [bool, string, float64]);
  assert.equal(signature.result, float64);
  const body = checked.bodies.find(entry => entry.body === callable.body);
  assert.deepEqual(body.locals.map(local => [local.name, local.checkerSlot]), [["flag", available(bool)], ["text", available(string)], ["n", available(float64)]]);
  assert.deepEqual(nodes.filter(node => node.kind === "Parameter").map(node => node.tsonic.declaredType), [available(bool), available(string), available(float64)]);
  assert.deepEqual(nodes.filter(node => ["BooleanKeyword", "StringKeyword", "NumberKeyword"].includes(node.kind)).map(node => [node.kind, node.tsonic.type]),
    [["BooleanKeyword", available(bool)], ["StringKeyword", available(string)], ["NumberKeyword", available(float64)], ["NumberKeyword", available(float64)]]);
});

test("K-3313.3: an unannotated parameter retains its actual any type instead of borrowing its boolean result type", () => {
  const { deps, program, module } = openedModule("export function f(x) { return true; }\n");
  const captured = captureSingleModule(front, deps, program, module);
  assert.equal(captured.kind, "ok");
  const signature = captured.value.types.signatures[0];
  assert.deepEqual(captured.value.types.types[signature.parameters[0].type].form,
    { kind: "available", value: { kind: "scalar", scalar: "any" } });
  assert.equal(signature.result.kind, "available");
  assert.deepEqual(captured.value.types.types[signature.result.value].form,
    { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
  assert.equal(captured.value.checkerDiagnostics.some(diagnostic => diagnostic.code.kind === "checker" && diagnostic.code.number === 7006), true);
});

test("wrong-arity overload capture retains all actual declarations and the original diagnostic with no selected candidate", async () => {
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const text = "declare function pick(value: boolean): boolean; declare function pick(value: number): boolean; "
    + "export function run(): boolean { return pick(); }";
  const source = checkedModuleOf(text);
  const call = source.raw.calls[0];
  const declarations = source.raw.tree.statements.nodes.slice(0, 2);
  assert.equal(call.kind, "conditional-candidates");
  assert.equal(call.declarationOrder.kind, "available");
  assert.deepEqual(call.declarationOrder.value.map(id => source.raw.types.signatures[id].declaration),
    declarations.map(node => ({ module: source.module, node: node.id })));
  assert.deepEqual(source.raw.types.candidates[call.candidates].candidates, []);
  assert.equal(call.diagnostics.length, 1);
  const [original] = call.diagnostics;
  assert.equal(source.raw.checkerDiagnostics[original.index].code.number, 2554);
  const checked = source.checked.tree.statements.nodes[2].body.statements.nodes[0].expression;
  assert.deepEqual(checked.tsonic.application.value.resolvedSignature, { kind: "unavailable", reason: "checker-error",
    causes: [{ kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: original } }] });
  const captureAt = maximum => {
    const { deps, program, module } = openedModule(text);
    return captureSingleModule(front, { ...deps, navigationCapture: { ...deps.navigationCapture,
      maximumCapturedEdgesPerModule: maximum } }, program, module);
  };
  const authoredEdges = 16;
  const signatureResults = 3 * 3;
  const annotations = 17 + 5;
  const expressionAndContext = 6 + 3 + 4 + 1;
  const signatureParameters = 3 * 2 + 2 * 2;
  const completedCallRead = 2;
  const annotationLookups = 5;
  const exact = authoredEdges + signatureResults + annotations + expressionAndContext + signatureParameters + completedCallRead + annotationLookups;
  const diagnostic = source.raw.checkerDiagnostics[original.index];
  for (let maximum = 0; maximum < exact; maximum += 1) {
    const stop = resourceLimitDiagnostic({ owner: "front", limit: "front.maximumCapturedEdgesPerModule", maximum,
      site: { kind: "file", path: "/project/src/main.ts" },
      unit: { request: { query: "captureModule", key: source.module }, position: { kind: "result" } } });
    assert.deepEqual(captureAt(maximum), { kind: "refused", diagnostics: [diagnostic, stop] }, `edge allowance ${maximum}`);
  }
  const atExact = captureAt(exact);
  assert.equal(atExact.kind, "ok");
  assert.deepEqual(atExact.diagnostics, [diagnostic]);
  assert.deepEqual(atExact.value.calls, source.raw.calls);
});

test("a selected signature return names its actual merged parameter cohort, not its original annotation", () => {
  const text = `interface Template<Value> { at(): Value; }
    interface Holder<Left, Right> { left: Template<Left>["at"]; right: Template<Right>["at"]; }
    interface Holder<Left, Right> { }`;
  const { deps, program, module } = openedModule(text);
  const captured = captureSingleModule(front, deps, program, module);
  assert.equal(captured.kind, "ok");
  assert.deepEqual(captured.diagnostics, []);
  const raw = captured.value;
  const [template, first, second] = raw.tree.statements.nodes;
  const source = template.members.nodes[0];
  const binder = template.typeParameters.nodes[0];
  const ref = node => ({ module, node: node.id });
  const signatures = raw.types.signatures.filter(row => row.declaration?.node === source.id);
  const [original] = signatures.filter(row => row.target === null);
  const earlier = raw.types.types[original.result.value];
  assert.equal(earlier.form.value.kind, "parameter");
  assert.deepEqual(earlier.form.value.parameter, ref(binder));
  const selected = signatures.filter(row => row.target === original.id);
  assert.equal(selected.length, 2);
  const cohorts = selected.map(row => {
    const result = raw.types.types[row.result.value];
    assert.equal(result.authoredTypeNode, null);
    assert.deepEqual(raw.types.components[result.component].path.step, { kind: "result", signature: row.id });
    assert.equal(result.form.value.kind, "merged-slot-parameter");
    return result.form.value.declarations;
  }).sort((left, right) => left[0].node - right[0].node);
  assert.deepEqual(cohorts, first.typeParameters.nodes.map((parameter, index) => [ref(parameter), ref(second.typeParameters.nodes[index])]));
});

test("enum definitions retain their nominal owner and only the authored initializer bodies", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = checkedModuleOf('export enum Code { Start = 2, End = 5, Next } export enum Word { Yes = "yes" }');
  const table = types.viewTypes(source.interner);
  assert.equal(source.raw.enums.length, 2);
  const [numeric, text] = source.raw.enums;
  assert.deepEqual(numeric.members.map(member => member.constant.kind === "available" ? member.constant.value.checkerValue : null), [2, 5, 6]);
  assert.deepEqual(text.members.map(member => member.constant), [{ kind: "available", value: { kind: "string", value: "yes" } }]);
  for (const [index, declaration] of source.checked.tree.statements.nodes.entries()) {
    assert.equal(declaration.kind, "EnumDeclaration");
    assert.equal(declaration.id, source.raw.enums[index].declaration.node);
    assert.deepEqual(declaration.tsonic.members, declaration.members.nodes.map(member => member.tsonic.declaration.definition));
    for (const member of declaration.members.nodes) {
      const nominal = member.tsonic.declaredType;
      assert.equal(nominal.kind, "available");
      assert.deepEqual(table.terms[nominal.value], { kind: "enum", definition: declaration.tsonic.definition });
      const body = member.tsonic.initializer;
      if (member.initializer === null) assert.equal(body, null, "an implicit initializer does not have an execution body");
      else {
        const execution = source.checked.bodies.find(row => row.body === body);
        assert.ok(execution?.root === member.initializer && execution.owner === member.tsonic.declaration.definition);
        const path = ids.decodeBodyId(execution.body);
        assert.equal(path.kind, "decoded");
        assert.equal(path.value.role, "enum-member-initializer");
      }
    }
  }
  assert.deepEqual(verifyChecked(source.checked, source.interner), []);
});

test("original checker roots render through the public SDK and survive raw and checked capture with original UTF-16 ranges", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = '\uFEFF// 😀\r\nexport function wrong(value: string): number { return value; }\r\nexport function other(value: string): number { return value; }\r\n';
  const opened = openedModule(source);
  const result = captureSingleModule(front, opened.deps, opened.program, opened.module);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.checkerDiagnostics.length, 2);
  const first = result.value.checkerDiagnostics[0];
  assert.equal(result.diagnostics === result.value.checkerDiagnostics, true);
  assert.deepEqual(result.value.checkerDiagnostics.map(diagnostic => diagnostic.code), [
    { kind: "checker", number: 2322, rendered: "TS2322" }, { kind: "checker", number: 2322, rendered: "TS2322" }]);
  assert.equal(first.message, "Type 'string' is not assignable to type 'number'.");
  assert.equal(first.severity, "error");
  assert.equal(first.site.kind, "source");
  assert.equal(first.site.origin.module, opened.module);
  assert.equal(first.site.origin.start, source.indexOf("return"));
  assert.equal(first.site.origin.length > 0, true);
  for (const [index, coverage] of result.value.diagnosticCoverage.entries()) {
    assert.equal(coverage.kind, "complete");
    assert.deepEqual(coverage.root, { module: opened.module, index });
    assert.deepEqual(coverage.obligations.map(obligation => [obligation.kind, obligation.diagnostic]), [["write-fit", coverage.root]]);
  }
  const definitions = identifySingleModule(front, { module: result.value, componentRoots: result.value.types.components.map(component => component.root).filter(root => root.module === result.value.module) });
  const interner = types.createTypeInterner();
  const lowered = lowerWithReadyExports(lowerDepsFor(definitions.value, interner, source), result.value);
  assert.equal(lowered.kind, "ok");
  assert.equal(lowered.value.checkerDiagnostics === result.value.checkerDiagnostics, true);
  assert.deepEqual(verifyChecked(lowered.value, interner), []);
  for (const maximum of [0, 1, 2, 3, 4]) {
    const limited = captureSingleModule(front, { ...opened.deps, navigationCapture: { ...navigationCapture, maximumCapturedFactsPerModule: maximum } }, opened.program, opened.module);
    assert.equal(limited.kind, "refused");
    assert.equal(limited.diagnostics.at(-1).code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
    assert.deepEqual(limited.diagnostics.slice(0, -1).map(diagnostic => diagnostic.message),
      Array(Math.min(2, Math.ceil(maximum / 3))).fill(first.message));
  }
});

test("a raw capture batch borrows the sole diagnostic vector and preserves original reports in module order", () => {
  const snapshot = projectSnapshot({ sourceFiles: {
    "main.ts": "export const healthy: boolean = true;",
    "first.ts": "export type First = MissingFirst;",
    "second.ts": "export type Second = MissingSecond;",
  }, libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }] });
  const { deps, program } = openAndCapture(snapshot);
  const first = moduleOf(packageOf("/project"), "src/first.ts");
  const second = moduleOf(packageOf("/project"), "src/second.ts");
  const single = front.captureModules(deps, program, [snapshot.entryPoint, first]);
  assert.equal(single.kind, "ok");
  assert.equal(single.diagnostics === single.value[1].checkerDiagnostics, true);
  assert.equal(single.diagnostics.length, 1);
  const multiple = front.captureModules(deps, program, [second, snapshot.entryPoint, first]);
  assert.equal(multiple.kind, "ok");
  assert.deepEqual(multiple.diagnostics.map(report => report.site.origin.module), [second, first]);
  assert.equal(multiple.diagnostics[0] === multiple.value[0].checkerDiagnostics[0], true);
  assert.equal(multiple.diagnostics[1] === multiple.value[2].checkerDiagnostics[0], true);
});

test("the public isError receipt precedes any classification, with missing actual component causes never replaced by ordinary any", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const source = "export function wrong(value: Missing): number { return value; }\n";
  const opened = openedModule(source);
  const result = captureSingleModule(front, opened.deps, opened.program, opened.module);
  assert.equal(result.kind, "ok");
  assert.equal(result.value.checkerDiagnostics.some(diagnostic => diagnostic.code.number === 2304), true);
  const missing = result.value.types.types.filter(row => row.form.kind === "unavailable");
  assert.equal(missing.length > 0, true);
  for (const row of missing) assert.deepEqual(row.form, row.authoredTypeNode === null
    ? { kind: "unavailable", reason: "missing-original-component", causes: [] }
    : { kind: "unavailable", reason: "checker-error", causes: [{ kind: "diagnostic", diagnostic: {
      kind: "checker", diagnostic: { module: result.value.module, index: 0 } } }] });
  const reference = hir.indexSyntaxTree(result.value.tree).find(node => node.kind === "TypeReference");
  const rows = result.value.types.types.filter(row => {
    const component = result.value.types.components[row.component];
    return component.root.node === reference.typeName.id && component.path === null;
  });
  assert.deepEqual(rows.map(row => row.id), []);
  assert.equal(result.value.checkerViews.some(view => view.node.node === reference.typeName.id), false);
  const checked = OpenedProgram.checked(opened.program);
  const file = checked.getSourceFile("/project/src/main.ts");
  const nativeReference = OpenedProgram.syntax(opened.program).get("/project/src/main.ts").outcome.numbering.nodes[reference.typeName.id];
  const queries = checked.getSourceFileQueries(file);
  assert.equal(queries.typeShape.isError(queries.checker.getTypeAtLocation(nativeReference)?.type), true);
  const actualAny = openedModule("export function identity(value: any): any { return value; }\n");
  const capturedAny = captureSingleModule(front, actualAny.deps, actualAny.program, actualAny.module);
  assert.equal(capturedAny.kind, "ok");
  assert.equal(capturedAny.value.types.types.some(row => row.form.kind === "available" && row.form.value.kind === "scalar" && row.form.value.scalar === "any"), true);
});

test("the checker diagnostic adapter preserves actual related records, source ownership and precharged refusal boundaries", async () => {
  const { captureCheckerDiagnostic, captureSessionDiagnostics } = await import("../../packages/host/dist/front/diagnostics.js");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const opened = openedModule("export function wrong(value: string): number { return value; }\n");
  const checked = OpenedProgram.checked(opened.program);
  const original = checked.diagnostics.find(diagnostic => diagnostic?.code === 2322);
  assert.equal(original !== undefined, true);
  const related = { ...original, file: undefined };
  const supplied = { ...original, relatedInformation: [original, related] };
  let reads = 0;
  const rendered = captureCheckerDiagnostic(opened.program, supplied, () => { reads += 1; return true; });
  assert.equal(reads, 3);
  assert.equal(rendered.related.length, 2);
  assert.equal(rendered.related[0].site.kind, "source");
  assert.deepEqual(rendered.related[1].site, { kind: "none" });
  assert.equal(rendered.related[0].message, rendered.message);
  assert.equal(captureCheckerDiagnostic(opened.program, supplied, () => false) === null, true);
  reads = 0;
  assert.equal(captureCheckerDiagnostic(opened.program, supplied, () => { reads += 1; return reads < 3; }) === null, true);
  assert.equal(reads, 3);
  assert.equal(captureCheckerDiagnostic(opened.program, { ...original, category: 0 }, () => true).severity, "warning");
  assert.equal(captureCheckerDiagnostic(opened.program, { ...original, category: 2 }, () => true).severity, "suggestion");
  const noArguments = openedModule("export const value = ;\n");
  const syntaxDiagnostic = OpenedProgram.checked(noArguments.program).diagnostics.find(diagnostic => diagnostic?.code === 1109);
  assert.equal(syntaxDiagnostic !== undefined, true);
  const noArgumentMessage = captureCheckerDiagnostic(noArguments.program, syntaxDiagnostic, () => true);
  assert.equal(noArgumentMessage.message, "Expression expected.");
  assert.deepEqual(noArgumentMessage.arguments, []);
  assert.deepEqual(noArgumentMessage.related, []);
  assert.deepEqual(captureCheckerDiagnostic(opened.program, related, () => true).site, { kind: "none" });
  assert.throws(() => captureCheckerDiagnostic(opened.program, { ...original, category: 3 }, () => true),
    error => error.cause?.message === "A published checker root has no severity in the diagnostic contract.");
  assert.throws(() => captureCheckerDiagnostic(opened.program, { ...original, relatedInformation: [undefined] }, () => true),
    error => error.cause?.message === "A checker diagnostic contains an absent related diagnostic.");
  const another = openedModule("export function valid(value: string): string { return value; }\n");
  const foreign = OpenedProgram.checked(another.program).getSourceFile("/project/src/main.ts");
  assert.throws(() => captureCheckerDiagnostic(opened.program, { ...original, file: foreign }, () => true),
    error => error.cause?.message === "A checker diagnostic must belong to the actual opened source file, not a same-path file from another program.");
  const input = OpenedProgram.file(opened.program, opened.module);
  const sessionRoot = { ...related, relatedInformation: [original, related] };
  const sessionProgram = OpenedProgram.create({ ...checked, diagnostics: [sessionRoot], extensionDiagnostics: [] },
    opened.deps.extensions, [input], [], OpenedProgram.contributions(opened.program));
  const capturedSession = captureSessionDiagnostics(sessionProgram);
  assert.equal(capturedSession.length, 1, "constructed session adapter input retains one root and its actual supplied notes");
  assert.deepEqual(capturedSession[0].site, { kind: "none" });
  assert.equal(capturedSession[0].message, rendered.message);
  assert.deepEqual(capturedSession[0].related, rendered.related);
  const altered = text => OpenedProgram.create(checked, opened.deps.extensions, [{ ...input, text }], [], OpenedProgram.contributions(opened.program));
  for (const text of ["", "x".repeat(input.text.length)])
    assert.throws(() => altered(text),
      error => error.cause?.message === "The checker's text of a module does not join its captured text.");
  const missingRange = OpenedProgram.create({ ...checked, ast: { ...checked.ast, sourceRange: () => ({ kind: "unavailable" }) } },
    opened.deps.extensions, [input], [], OpenedProgram.contributions(opened.program));
  assert.throws(() => captureCheckerDiagnostic(missingRange, original, () => true),
    error => error.cause?.message === "A checker diagnostic has no authored source range.");
  assert.throws(() => captureCheckerDiagnostic(altered(input.text), { ...original, file: OpenedProgram.checked(another.program).getSourceFiles().find(file => file !== undefined && checked.ast.getFileName(file) !== "/project/src/main.ts") }, () => true),
    error => error.cause?.message === "A checker diagnostic names a file outside the actual opened source domain.");
  let textReads = 0;
  const counted = OpenedProgram.create({ ...checked, ast: { ...checked.ast, getSourceText: file => {
    textReads += 1;
    return checked.ast.getSourceText(file);
  } } }, opened.deps.extensions, [input], [], OpenedProgram.contributions(opened.program));
  assert.equal(textReads, 1, "the owning file admission validates the whole captured-text join once");
  const manyRelated = { ...original, relatedInformation: Array(32).fill(original) };
  for (let count = 0; count < 64; count += 1) {
    const captured = captureCheckerDiagnostic(counted, manyRelated, () => true);
    assert.equal(captured.related.length, 32);
    assert.deepEqual(captured.site, rendered.site);
  }
  assert.equal(textReads, 1, "primary and related locations reuse the same admitted displacement");
});

test("a genuine authored null and checked undefined parameter retain one native absence type without a fabricated literal tag", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const actual = checkedModuleOf("export function absent() { return null; }\nexport function identity(value: undefined): undefined { return value; }\n");
  assert.deepEqual(verifyChecked(actual.checked, actual.interner), []);
  const [absent, identity] = actual.checked.tree.statements.nodes;
  const returned = absent.body.statements.nodes[0].expression;
  assert.equal(returned.kind, "NullKeyword");
  assert.equal(returned.tsonic.role, "value");
  assert.equal(returned.tsonic.value.views.read.kind, "available");
  const absence = returned.tsonic.value.views.read.value;
  assert.deepEqual(types.readType(actual.interner, absence), { kind: "intrinsic", intrinsic: "absence" });
  const selected = types.readSignature(actual.interner, identity.tsonic.signatures[0].signature);
  assert.equal(selected.parameters[0].type, absence);
  assert.equal(selected.result, absence);
  assert.equal(types.readSignature(actual.interner, absent.tsonic.signatures[0].signature).result, absence);
  assert.equal("literal" in returned.tsonic, false);
  for (const spelling of ["null", "undefined"]) assert.equal(actual.raw.types.types.some(row =>
    row.form.kind === "available" && row.form.value.kind === "scalar" && row.form.value.scalar === spelling), true);
});

for (const [authored, type, expected] of [
  ["true", "boolean", { kind: "boolean", value: true }],
  ["false", "boolean", { kind: "boolean", value: false }],
  ['""', "string", { kind: "string", value: "" }],
  ['"\\u{1F600}\\n"', "string", { kind: "string", value: "😀\n" }],
]) {
  test(`real checked ${authored} retains its literal value separately from the SDK-selected base type`, async () => {
    const types = await import("../../packages/host/dist/ir-types/index.js");
    const actual = checkedModuleOf(`export function value(input: ${type} = ${authored}): ${type} { return ${authored}; }\n`);
    assert.deepEqual(verifyChecked(actual.checked, actual.interner), []);
    const callable = actual.checked.tree.statements.nodes[0];
    const body = actual.checked.bodies.find(candidate => candidate.body === callable.tsonic.body);
    const returned = body.root.statements.nodes[0].expression;
    const read = returned.tsonic.value.views.read;
    assert.equal(read.kind, "available");
    const selected = types.readType(actual.interner, read.value);
    assert.equal(selected.kind, "literal");
    assert.deepEqual(selected.value, expected);
    assert.deepEqual(types.readType(actual.interner, selected.base), type === "boolean"
      ? { kind: "primitive", primitive: "bool" } : { kind: "string" });
    const initializer = callable.parameters.nodes[0].initializer;
    const defaultBody = actual.checked.bodies.find(candidate => candidate.body === callable.parameters.nodes[0].tsonic.initializer);
    assert.equal(defaultBody.root === initializer, true, "the default expression retains its actual separate execution root");
    assert.deepEqual(types.readType(actual.interner, initializer.tsonic.value.views.read.value).value, expected);
    if (expected.kind === "string") assert.deepEqual(returned.tsonic.literal, expected);
    assert.equal(actual.raw.types.types.some(row => row.literal.kind === "available"
      && row.literal.value?.kind === expected.kind && row.literal.value.value === expected.value), true);
  });
}

test("real intrinsic annotations preserve checked types and distinguish void from the single absence type", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const decls = await import("../../packages/host/dist/decls/index.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const entries = [["bigint", "bigint", false], ["any", "any", false], ["unknown", "unknown", false], ["never", "never", false],
    ["object", "object", false], ["undefined", "absence", false], ["void", "void", true]];
  const source = entries.map(([keyword], index) => `export function identity${index}(value: ${keyword}): ${keyword} { return value; }`).join("\n") +
    "\nexport function nothing(): void {}\nexport function stop(): void { return; }\n";
  const captured = checkedModuleOf(source);
  assert.deepEqual(verifyChecked(captured.checked, captured.interner), []);
  assert.deepEqual(captured.checked.checkerDiagnostics, []);
  const nodes = hir.indexSyntaxTree(captured.checked.tree);
  const functions = nodes.filter(node => node.kind === "FunctionDeclaration");
  const inputs = { modules: [{ module: captured.checked, nodes }], types: captured.interner,
    typeExpansion: lowerDepsFor(captured.definitions, captured.interner, source).typeExpansion };
  const { cuts } = checkedSourceViews(inputs.modules);
  for (const [index, node] of functions.entries()) {
    const intrinsic = entries[index]?.[1] ?? "void";
    assert.deepEqual(types.readType(captured.interner, node.type.tsonic.type.value), { kind: "intrinsic", intrinsic });
    assert.equal(node.tsonic.signatures.length, 1, "this authored function has one actual checked endpoint");
    const signature = decls.declaredSignatureOf(inputs, { definition: node.tsonic.definition, endpoint: node.tsonic.signatures[0].role, ordinal: 0,
      bindings: { kind: "parametric" } }, cuts);
    assert.equal(signature.kind, "done", node.name.text);
    assert.equal(signature.value.kind, "ok", node.name.text);
    assert.deepEqual(signature.value.diagnostics, []);
    assert.deepEqual(types.readType(captured.interner, signature.value.value.result), { kind: "intrinsic", intrinsic });
    if (index < entries.length) {
      assert.equal(signature.value.value.parameters.length, 1);
      assert.equal(signature.value.value.parameters[0].type, signature.value.value.result);
      assert.equal(signature.value.value.parameters[0].kind, "required", "omission capability does not relabel authored required syntax");
      const capturedSignatures = captured.raw.types.signatures.filter(row => row.declaration?.node === node.id && row.kind === "call");
      assert.equal(capturedSignatures.length, 1, "this checked function has one genuine captured signature");
      assert.equal(signature.value.value.parameters[0].acceptsOmission, capturedSignatures[0].parameters[0].acceptsOmission,
        "lowering preserves the actual checked parameter receipt, independently of native absence holding");
      assert.equal(signature.value.value.parameters[0].acceptsOmission, entries[index][2], node.name.text);
      assert.equal(node.parameters.nodes[0].type.tsonic.type.value, signature.value.value.result);
    } else assert.equal(signature.value.value.parameters.length, 0);
  }
  const absent = openedModule("export function absent(value: null): null { return value; }\n");
  const raw = captureSingleModule(front, absent.deps, absent.program, absent.module);
  assert.equal(raw.kind, "ok");
  assert.equal(raw.value.types.types.some(row => row.form.kind === "available" && row.form.value.kind === "scalar" && row.form.value.scalar === "null"), true,
    "actual null evidence remains captured; LiteralType syntax lowering is a separate existing frontier");
});

test("callable values retain real signatures and direct recursive calls retain the SDK's selected declarations", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = "export function left(n: number): number { return right(n); }\nexport function right(n: number): number { return left(n); }\n";
  const captured = checkedModuleOf(source);
  assert.deepEqual(verifyChecked(captured.checked, captured.interner), []);
  const nodes = hir.indexSyntaxTree(captured.checked.tree);
  const functions = nodes.filter(node => node.kind === "FunctionDeclaration");
  assert.deepEqual(functions.map(node => node.name.text), ["left", "right"]);
  const calls = nodes.filter(node => node.kind === "CallExpression");
  assert.equal(calls.length, 2);
  for (const [index, call] of calls.entries()) {
    const target = functions[1 - index];
    const application = call.tsonic.application;
    assert.equal(application.kind, "available");
    const selected = types.readSignature(captured.interner, application.value.resolvedSignature.value);
    assert.equal(selected.declaration, target.tsonic.definition);
    assert.deepEqual(types.readType(captured.interner, selected.result), { kind: "primitive", primitive: "float64" });
    assert.equal(selected.parameters[0].declaration, ids.encodeDefId({ module: captured.module,
      segments: [{ name: target.name.text, ordinal: 0 }, { name: "n", ordinal: 0 }] }));
    const callee = types.readType(captured.interner, call.expression.tsonic.value.views.read.value);
    assert.equal(callee.kind, "callable");
    assert.equal(callee.calls.length, 1);
    assert.equal(types.readSignature(captured.interner, callee.calls[0]).declaration, target.tsonic.definition);
    const body = captured.checked.bodies.find(body => body.owner === functions[index].tsonic.definition);
    assert.equal(body.candidateLists.length, 1);
    assert.equal(body.candidateLists[0].candidates[0].declaration, target.tsonic.definition);
  }
  for (const table of [captured.raw.types.types, captured.raw.types.signatures, captured.raw.types.members])
    for (let index = 0; index < table.length; index += 1) assert.equal(table[index]?.id, index, "a captured table is dense after forward signature dependencies");
});

test("an applicable SDK receipt retains its actual overload position without fabricating other applicable candidates", async () => {
  for (const type of ["number", "boolean"]) {
    const overloads = openedModule("declare function choose(value: number): number;\ndeclare function choose(value: boolean): boolean;\n"
      + `export function invoke(value: ${type}): ${type} { return choose(value); }\n`);
    const result = captureSingleModule(front, overloads.deps, overloads.program, overloads.module);
    assert.equal(result.kind, "ok");
    const raw = result.value;
    const [call] = raw.calls;
    assert.equal(call.kind, "applicable");
    assert.equal(call.declarationOrdinal, type === "number" ? 0 : 1);
    assert.deepEqual(call.declarationOrder.value.map(id => raw.types.signatures[id].declaration),
      raw.tree.statements.nodes.slice(0, 2).map(node => ({ module: raw.module, node: node.id })));
    const candidates = raw.types.candidates[call.candidates].candidates;
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].application.signature, call.declarationOrder.value[call.declarationOrdinal]);
  }
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = "export function left(n: number): number { return right(n); }\nexport function right(n: number): number { return left(n); }\n";
  const { raw, definitions } = checkedModuleOf(source);
  const convert = changed => lowerWithReadyExports(lowerDepsFor(definitions, types.createTypeInterner(), source), changed);
  for (const reason of ["checker-error", "parameter-dependent", "not-provided", "missing-original-component", "incomplete-association", "unsupported-checked-structure"]) {
    const changed = { ...raw, calls: raw.calls.map(call => ({ ...call, declarationOrder: { kind: "unavailable", reason, causes: [] } })) };
    assert.throws(() => convert(changed), { name: "TypeError",
      message: "front: an applicable call requires its declaration order and one actual selected candidate" });
  }
  for (const declarationOrdinal of [-0, -1, 0.5, 1]) {
    const changed = { ...raw, calls: raw.calls.map(call => ({ ...call, declarationOrdinal })) };
    assert.throws(() => convert(changed), /its actual selected invocation and callee/);
  }
  const selected = raw.types.candidates[0].candidates[0];
  for (const [patch, message] of [[{ classArguments: [{}] }, "front: nonempty call candidate binding conversion is not implemented"],
    [{ signatureArguments: [{}] }, "front: selected bindings must cover the actual original signature binder inventory"],
    [{ receiver: selected.application.callee }, "front: nonempty call candidate binding conversion is not implemented"]]) {
    const changed = { ...raw, types: { ...raw.types, candidates: raw.types.candidates.map(list => ({ ...list,
      candidates: list.candidates.map(candidate => ({ ...candidate, application: { ...candidate.application, ...patch } })) })) } };
    assert.throws(() => convert(changed), { name: "TypeError", message });
  }
  const obligations = { ...raw, types: { ...raw.types, candidates: raw.types.candidates.map(list => ({ ...list,
    candidates: list.candidates.map(candidate => ({ ...candidate, constraints: [{}] })) })) } };
  assert.throws(() => convert(obligations), { name: "TypeError", message: "front: call candidate conditional failure conversion is not implemented" });
});

test("the checker's boolean is scalar while a union retains its actual separate member forms", () => {
  const scalar = openedModule("export function same(flag: boolean): boolean { return flag; }\n");
  const raw = captureSingleModule(front, scalar.deps, scalar.program, scalar.module);
  assert.equal(raw.kind, "ok");
  assert.deepEqual([...new Set(raw.value.types.types.map(row => JSON.stringify(row.form)))], [JSON.stringify({ kind: "available", value: { kind: "scalar", scalar: "boolean" } })]);
  const union = openedModule("export function maybe(flag: boolean | undefined, n: number): number { return n; }\n");
  const captured = captureSingleModule(front, union.deps, union.program, union.module);
  assert.equal(captured.kind, "ok");
  const forms = captured.value.types.types.map(row => row.form).filter(form => form.kind === "available").map(form => form.value);
  assert.equal(forms.some(form => form.kind === "union"), true);
  assert.equal(forms.some(form => form.kind === "scalar" && form.scalar === "boolean"), true);
});

test("the frontier check names the first unwritten form in preorder (R3 L-2)", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const sourceText = "export function m(a: number, b: number): number { return (a) ** b; }\n";
  const { deps, program, module } = openedModule(sourceText);
  const raw = captureSingleModule(front, deps, program, module);
  assert.equal(raw.kind, "ok");
  const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
  assert.throws(() => lowerWithReadyExports(lowerDepsFor(definitions.value, types.createTypeInterner(), sourceText), raw.value),
    { name: "TypeError", message: "front: checked annotation not implemented: AsteriskAsteriskToken" });
});

// K-3313.1: one declaration-target law. Expectations written before the run.
test("real checked variables retain separate initializer executions, actual local slots and declaration placement", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const source = 'export const ready: boolean = true, text: string = "ok"; export function select(a: boolean): boolean { const b: boolean = a; let c: boolean; let d: boolean = b; function nested(): boolean { return d; } return b; }';
  const { checked, interner, definitions } = checkedModuleOf(source);
  const nodes = hir.indexSyntaxTree(checked.tree);
  const variables = nodes.filter(node => node.kind === "VariableDeclaration");
  assert.deepEqual(variables.map(node => node.name.text), ["ready", "text", "b", "c", "d"]);
  const functionBody = checked.bodies.find(body => body.root.kind === "Block" && body.params.length === 1);
  assert.deepEqual(functionBody.locals.map(local => [local.id, local.name, local.role, local.mutable]),
    [[0, "a", "parameter", true], [1, "b", "binding", false], [2, "c", "binding", true], [3, "d", "binding", true]]);
  const moduleBody = checked.bodies.find(body => body.root === checked.tree);
  assert.equal(moduleBody.locals.length, 0);
  for (const variable of variables) {
    assert.deepEqual(variable.name.tsonic.declaration, variable.tsonic.declaration);
    if (variable.initializer === null) { assert.equal(variable.tsonic.initializer, null); continue; }
    const body = checked.bodies.find(body => body.body === variable.tsonic.initializer);
    assert.equal(body.root === variable.initializer, true, `same initializer syntax for ${variable.name.text}`);
    assert.equal(body.owner, definitions.rows.find(row => row.node === variable.id).definition);
    assert.equal(ids.decodeBodyId(body.body).value.role, "initializer");
    const containing = variable.name.text === "ready" || variable.name.text === "text" ? moduleBody : functionBody;
    assert.equal(containing.nestedBodies.includes(body.body), true);
  }
  const b = variables.find(variable => variable.name.text === "b");
  const bBody = checked.bodies.find(body => body.body === b.tsonic.initializer);
  assert.deepEqual(bBody.captures, [{ body: functionBody.body, local: 0 }]);
  assert.deepEqual(b.initializer.tsonic.resolution, { kind: "local", local: { body: functionBody.body, local: 0 } });
  const nested = checked.bodies.find(body => body.root.kind === "Block" && body.params.length === 0);
  assert.deepEqual(nested.captures, [{ body: functionBody.body, local: 3 }]);
  assert.deepEqual(verifyChecked(checked, interner), []);
});

test("K-3313.1: parameters target their body-local slot and keep their qualified item identity; functions, nested ones too, target their definition; a captured outer parameter resolves to its owner's local and is recorded as a capture", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const sourceText = "export function outer(a: number): number { function inner(b: number): number { return a + b; } return a; }\n";
  const { module, definitions, checked, interner } = checkedModuleOf(sourceText);
  const definition = segments => ids.encodeDefId({ module, segments: segments.map(([name, ordinal]) => ({ name, ordinal })) });
  const [outerDefinition, aDefinition, innerDefinition, bDefinition] = [[["outer", 0]], [["outer", 0], ["a", 0]], [["outer", 0], ["inner", 0]], [["outer", 0], ["inner", 0], ["b", 0]]].map(definition);
  const body = owner => ids.encodeBodyId({ owner, role: "function", ordinal: 0 });
  const moduleBody = ids.encodeBodyId({ owner: definition([]), role: "module", ordinal: 0 });
  const [outerBody, innerBody] = [body(outerDefinition), body(innerDefinition)];
  assert.deepEqual(definitions.rows.map(row => [row.kind, row.definition]), [["SourceFile", definition([])], ["FunctionDeclaration", outerDefinition], ["Parameter", aDefinition],
    ["FunctionDeclaration", innerDefinition], ["Parameter", bDefinition]]);
  const nodes = hir.indexSyntaxTree(checked.tree);
  const functions = nodes.filter(node => node.kind === "FunctionDeclaration");
  assert.deepEqual(functions.map(node => [node.tsonic.definition, node.tsonic.parent, node.name.tsonic.declaration]), [
    [outerDefinition, definition([]), { kind: "definition", definition: outerDefinition }], [innerDefinition, outerDefinition, { kind: "definition", definition: innerDefinition }]]);
  assert.deepEqual(nodes.filter(node => node.kind === "Parameter").map(node => [node.tsonic.declaration, node.name.tsonic.declaration]), [
    [{ kind: "local", local: { body: outerBody, local: 0 } }, { kind: "local", local: { body: outerBody, local: 0 } }],
    [{ kind: "local", local: { body: innerBody, local: 0 } }, { kind: "local", local: { body: innerBody, local: 0 } }]]);
  assert.deepEqual(nodes.filter(node => node.kind === "Identifier" && node.tsonic.role === "value").map(node => [node.text, node.tsonic.resolution]), [
    ["a", { kind: "local", local: { body: outerBody, local: 0 } }], ["b", { kind: "local", local: { body: innerBody, local: 0 } }], ["a", { kind: "local", local: { body: outerBody, local: 0 } }]]);
  assert.deepEqual(checked.bodies.map(entry => [entry.body, entry.captures, entry.nestedBodies, entry.locals.map(local => [local.name, local.declaration])]).sort(), [
    [moduleBody, [], [outerBody], []],
    [outerBody, [], [innerBody], [["a", { kind: "item", value: { owner: aDefinition, node: definitions.rows[2].node } }]]],
    [innerBody, [{ body: outerBody, local: 0 }], [], [["b", { kind: "item", value: { owner: bDefinition, node: definitions.rows[4].node } }],
      ["a", { kind: "item", value: { owner: aDefinition, node: definitions.rows[2].node } }]]]].sort());
  assert.deepEqual(verifyChecked(checked, interner), []);
});

// K-3313.2: core facts and passing come from the explicitly closed inventory. Expectations written before the run.
const notProvided = { kind: "unavailable", reason: "not-provided", causes: [] };

test("generic lowering borrows a supplied original cause vector without dropping or re-emitting any association", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = checkedModuleOf(addSource);
  const body = source.checked.bodies[0].body;
  const causes = capturedCauses(source.module, source.definitions.rows[0].definition, body);
  const row = source.raw.core.find(entry => entry.node.node === 0);
  const raw = { ...source.raw, core: source.raw.core.map(entry => entry === row
    ? { ...entry, provider: { kind: "unavailable", reason: "checker-error", causes } } : entry) };
  const deps = lowerDepsFor(source.definitions, types.createTypeInterner(), addSource);
  const lowered = lowerWithReadyExports(deps, raw);
  assert.equal(lowered.kind, "ok");
  assert.equal(lowered.value.tree.tsonic.core.provider.causes === causes, true);
  assert.equal(lowered.value.checkerDiagnostics === raw.checkerDiagnostics, true);
  assert.deepEqual(lowered.diagnostics, []);
});

test("binding-specific checker roots remain original identities while mixed dependency evidence remains unavailable", async () => {
  const { lowerBindingFact } = await import("../../packages/host/dist/front/bindings.js");
  const source = checkedModuleOf(addSource);
  const causes = capturedCauses(source.module, source.definitions.rows[0].definition, source.checked.bodies[0].body);
  const roots = causes.slice(0, 2);
  const deps = lowerDepsFor(source.definitions, source.interner, addSource);
  const context = { deps, raw: source.raw, checkerNumberBits: null, query: "lowerModule" };
  const raw = { kind: "unavailable", reason: "checker-error", causes: roots };
  const actual = lowerBindingFact(context, raw);
  assert.deepEqual(actual, { kind: "complete",
    value: { kind: "available", value: { kind: "unresolved", diagnostics: roots.map(cause => cause.diagnostic.diagnostic) } } });
  assert.equal(actual.value.value.diagnostics[0] === roots[0].diagnostic.diagnostic, true);
  const mixed = { ...raw, causes };
  assert.equal(lowerBindingFact(context, mixed).value === mixed, true);
  const missing = { ...raw, causes: [] };
  assert.deepEqual(lowerBindingFact(context, missing), { kind: "complete", value: missing });
});

test("syntax admission stops actual SDK child enumeration on the first refused node rather than visiting the remaining width", async () => {
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  for (const maximum of [0, 1, 2, 8]) {
    const opened = openedModule("true;\n".repeat(256));
    const checked = OpenedProgram.checked(opened.program);
    let children = 0;
    const ast = { ...checked.ast, forEachChildUntil: (node, stop) => checked.ast.forEachChildUntil(node, child => {
      children += 1;
      return stop(child);
    }) };
    const program = OpenedProgram.create({ ...checked, ast }, opened.deps.extensions,
      [OpenedProgram.file(opened.program, opened.module)], [], OpenedProgram.contributions(opened.program));
    const result = captureSingleModule(front, { ...opened.deps, navigationCapture: {
      ...opened.deps.navigationCapture, maximumCapturedNodesPerModule: maximum,
    } }, program, opened.module);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics.length, 1);
    assert.equal(children, maximum, "one next child detects the exact refusal; no subsequent sibling is enumerated");
  }
});

test("checked lowering and body ownership handle a constructed 20000-block domain without native recursion", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const source = checkedModuleOf("");
  const depth = 20_000;
  const root = source.raw.tree;
  const core = source.raw.core.find(entry => entry.node.node === root.id);
  const rows = [];
  let block = null;
  for (let index = depth; index > 0; index -= 1) {
    const node = { kind: "Block", id: index, parent: index - 1, origin: root.origin, loc: root.loc, flags: [],
      statements: { loc: root.statements.loc, nodes: block === null ? [] : [block] }, multiLine: false, tsonic: null };
    rows.push({ ...core, node: { module: source.module, node: index } });
    block = node;
  }
  const tree = { ...root, statements: { ...root.statements, nodes: [block] },
    endOfFileToken: { ...root.endOfFileToken, id: depth + 1 } };
  const raw = { ...source.raw, tree, core: [core, ...rows] };
  const defs = identifySingleModule(front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(defs.kind, "ok");
  const lowered = lowerWithReadyExports(lowerDepsFor(defs.value, types.createTypeInterner(), ""), raw);
  assert.equal(lowered.kind, "ok");
  const nodes = hir.indexSyntaxTree(lowered.value.tree);
  assert.equal(nodes.length, depth + 2);
  assert.equal(nodes.every((node, index) => node.id === index), true);
  assert.equal(lowered.value.bodies[0].root === lowered.value.tree, true);
});

test("syntax assembly consumes an admitted 20000-expression numbering iteratively with unchanged identities and parents", async () => {
  const { captureNode } = await import("../../packages/host/dist/front/syntax-capture.js");
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const depth = 20_000;
  let root = { Flags: 0, kind: "KindTrueKeyword" };
  for (let index = depth; index > 0; index -= 1)
    root = { Flags: 0, kind: "KindParenthesizedExpression", Expression: root };
  const nodes = [];
  const numbers = new Map();
  const parents = new Map();
  for (let node = root; node !== undefined; node = node.Expression) {
    const id = ids.nodeId(nodes.length);
    nodes.push(node);
    numbers.set(node, id);
    parents.set(node, id === 0 ? null : ids.nodeId(id - 1));
  }
  const ast = { kindName: node => node.kind, as: { AsParenthesizedExpression: node => node },
    authoredRange: () => ({ kind: "authored", start: 0, end: 0 }), sourceRange: () => ({ kind: "source", start: 0, end: 0 }),
    pos: () => 0, end: () => 0 };
  const context = { ast, file: null, module, sourceText: "", numericLiterals: new Map(), displacement: 0, pragmas: [], checkJsDirective: null, numbering: { nodes, ids: numbers, parents } };
  const result = captureNode(context, root, null).tree;
  let count = 0;
  for (let node = result; node !== undefined; node = node.expression) {
    assert.equal(node.id, count);
    assert.equal(node.parent, count === 0 ? null : count - 1);
    count += 1;
  }
  assert.equal(count, depth + 1);
  assert.throws(() => captureNode(context, nodes[1], null), /actual numbered root/u);
  assert.throws(() => captureNode({ ...context, numbering: { ...context.numbering, ids: new Map() } }, root, null), /admitted identity/u);
  assert.throws(() => captureNode({ ...context, numbering: { ...context.numbering, parents: new Map() } }, root, null), /admitted parent/u);
});

test("checked expression assembly consumes a constructed 20000-parenthesis domain without source-depth recursion", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const source = checkedModuleOf("true;");
  const root = source.raw.tree;
  const statement = root.statements.nodes[0];
  const original = statement.expression;
  const originalView = source.raw.checkerViews.find(view => view.node.node === original.id);
  const originalCore = source.raw.core.find(row => row.node.node === original.id);
  const depth = 20_000;
  let expression = { ...original, id: depth + 2, parent: depth + 1 };
  const core = [source.raw.core[0], source.raw.core[1], { ...originalCore, node: { module: source.module, node: expression.id } }];
  const views = [{ ...originalView, node: { module: source.module, node: expression.id } }];
  for (let index = depth + 1; index >= 2; index -= 1) {
    expression = { ...original, id: index, parent: index - 1, kind: "ParenthesizedExpression", expression, tsonic: null };
    core.push({ ...originalCore, node: { module: source.module, node: index } });
    views.push({ ...originalView, node: { module: source.module, node: index } });
  }
  const tree = { ...root, statements: { ...root.statements, nodes: [{ ...statement, expression }] },
    endOfFileToken: { ...root.endOfFileToken, id: depth + 3 } };
  const raw = { ...source.raw, tree, core, checkerViews: views };
  const definitions = identifySingleModule(front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(definitions.kind, "ok");
  const lowered = lowerWithReadyExports(lowerDepsFor(definitions.value, types.createTypeInterner(), "true;"), raw);
  assert.equal(lowered.kind, "ok");
  const nodes = hir.indexSyntaxTree(lowered.value.tree);
  assert.equal(nodes.length, depth + 4);
  assert.equal(nodes.every((node, index) => node.id === index), true);
});

test("qualified capture membership keeps first-use order once across repeated real captured parameters", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  for (const count of [8, 64, 256]) {
    const names = Array.from({ length: count }, (_, index) => `p${index}`);
    const order = [...names].reverse();
    const source = `export function outer(${names.map(name => `${name}: number`).join(", ")}): number { function inner(): number { return ${[...order, ...order].join(" + ")}; } return p0; }`;
    const opened = openedModule(source);
    const captured = captureSingleModule(front, { ...opened.deps, navigationCapture: {
      ...opened.deps.navigationCapture, maximumSyntaxDepth: 2048,
    } }, opened.program, opened.module);
    assert.equal(captured.kind, "ok");
    const definitions = identifySingleModule(front, { module: captured.value, componentRoots: captured.value.types.components.map(component => component.root).filter(root => root.module === captured.value.module) });
    assert.equal(definitions.kind, "ok");
    const lowered = lowerWithReadyExports(lowerDepsFor(definitions.value, types.createTypeInterner(), source), captured.value);
    assert.equal(lowered.kind, "ok");
    const outer = lowered.value.bodies.find(body => body.params.length === count);
    const inner = lowered.value.bodies.find(body => body.captures.length === count);
    assert.notEqual(outer, undefined);
    assert.notEqual(inner, undefined);
    assert.deepEqual(inner.captures, order.map(name => ({ body: outer.body, local: Number(name.slice(1)) })));
  }
});
test("K-3313.2 proven absence: with an empty closed inventory each captured node's core facts are proven absent, and add's parameters pass by value through that proof", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const { raw, checked } = checkedModuleOf(addSource);
  const absent = { kind: "available", value: null };
  assert.equal(raw.core.length, 18, "one row per captured node");
  for (const row of raw.core) assert.deepEqual({ ...row, node: null }, { node: null, provider: absent,
    markers: { kind: "available", value: { struct: null, field: null, defaultValue: null, jsString: false, application: absent } }, pointerType: absent, pointerOperation: absent,
    metadata: absent, layout: absent, field: absent, fieldBinding: absent, recordBinding: absent, layoutQuery: absent, attribute: absent, safety: absent,
    argumentPassing: absent, flowState: absent });
  const parameters = hir.indexSyntaxTree(checked.tree).filter(node => node.kind === "Parameter");
  assert.deepEqual(parameters.map(node => node.tsonic.core.argumentPassing), [absent, absent]);
  assert.deepEqual(checked.bodies.flatMap(body => body.params.map(parameter => parameter.passing)), ["by-value", "by-value"]);
});

test("K-3313.2 an argument-only marker module does not remove the actual signature passing proof", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const semantics = { moduleSpecifier: "@tsonic/core/lang.js", capabilities: ["call-marker"], exports: [{ kind: "call-marker", exportName: "readwriteref", marker: "read-write-reference" }] };
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": addSource }, libraries: bundled(), providerPackages: [{ root: "/semantics", name: "semantics" }],
    semanticModules: [reference("/semantics")] });
  const { deps, program } = openAndCapture(snapshot, [{ reference: reference("/semantics"), value: { kind: "semantics-module", value: semantics } }]);
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const raw = captureSingleModule(front, deps, program, module);
  assert.equal(raw.kind, "ok");
  assert.equal(raw.value.core.length, 18);
  assert.equal(raw.value.calls.length, 0);
  for (const { node, layoutQuery, ...facts } of raw.value.core) {
    assert.equal(node.module, module);
    assert.deepEqual(layoutQuery, { kind: "available", value: null });
    assert.equal(Object.values(facts).every(fact => isDeepStrictEqual(fact, notProvided)), true);
  }
  const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
  const lower = value => lowerWithReadyExports(lowerDepsFor(definitions.value, types.createTypeInterner(), addSource), value);
  const checked = lower(raw.value);
  assert.equal(checked.kind, "ok");
  assert.deepEqual(checked.value.bodies.flatMap(body => body.params.map(parameter => parameter.passing)), ["by-value", "by-value"]);
  const missing = { ...raw.value, types: { ...raw.value.types,
    signatures: raw.value.types.signatures.map(signature => ({ ...signature,
      parameters: signature.parameters.map(parameter => ({ ...parameter, passing: notProvided })),
    })) } };
  assert.throws(() => lower(missing), /captured passing mode is unavailable/u);
});

test("K-3313.2 a positive declaration passing fact is consumed as captured: a by-reference parameter row gives that mode in the signature, the body's parameters and the node's core", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { deps, program, module } = openedModule(addSource);
  const raw = captureSingleModule(front, deps, program, module);
  const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
  const parameterNodes = definitions.value.rows.filter(row => row.kind === "Parameter").map(row => row.node);
  const declared = { role: "declaration", mode: "byref-readwrite" };
  const changed = { ...raw.value,
    types: { ...raw.value.types, signatures: raw.value.types.signatures.map(signature => ({ ...signature,
      parameters: signature.parameters.map(parameter => parameter.declaration?.node === parameterNodes[0] && parameter.declaration.module === module
        ? { ...parameter, passing: { kind: "available", value: declared.mode } } : parameter) })) },
    core: raw.value.core.map(row => row.node.node === parameterNodes[0] ? { ...row, argumentPassing: { kind: "available", value: declared } } : row) };
  const interner = types.createTypeInterner();
  const lowered = lowerWithReadyExports(lowerDepsFor(definitions.value, interner, addSource), changed);
  assert.equal(lowered.kind, "ok");
  const nodes = hir.indexSyntaxTree(lowered.value.tree);
  const callable = nodes.find(node => node.kind === "FunctionDeclaration").tsonic;
  assert.deepEqual(types.readSignature(interner, callable.signatures[0].signature).parameters.map(parameter => parameter.passing), ["byref-readwrite", "by-value"]);
  assert.deepEqual(lowered.value.bodies.find(body => body.body === callable.body).params.map(parameter => parameter.passing), ["byref-readwrite", "by-value"]);
  assert.deepEqual(nodes.filter(node => node.kind === "Parameter").map(node => node.tsonic.core.argumentPassing), [{ kind: "available", value: declared }, { kind: "available", value: null }]);
});

test("real source analysis cannot manufacture declaration-passing evidence by writing another owner's fact", () => {
  const registration = reference("/facts", "passing");
  let writes = 0;
  const extension = { identity: { id: "test.actual-passing", version: "1" }, analyzeSource: context => {
    for (const file of context.source.getSourceFiles()) {
      const ast = context.source.ast;
      if (ast.getFileName(file) !== "/project/src/main.ts") continue;
      for (const statement of ast.statements(file)) if (ast.kindName(statement) === "KindFunctionDeclaration") {
        for (const parameter of ast.parameters(statement)) {
          assert.equal(parameter !== undefined, true);
          assert.equal(context.facts.set(parameter, sdk.argumentPassingFactKey,
            { role: "declaration", mode: "byref-readwrite" }), "conflict");
          writes += 1;
        }
      }
    }
  } };
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": addSource }, libraries: bundled(),
    providerPackages: [{ root: "/facts", name: "facts" }], compilerExtensions: [registration] });
  assert.throws(() => openAndCapture(snapshot, [{ reference: registration, value: { kind: "compiler-extension", value: extension } }]),
    { name: "Error", message: "Cannot commit an extension fact transaction after a fact write failed." });
  assert.equal(writes, 2);
});

test("a real source analyzer's own facts cannot turn unavailable declaration modes into proven empty-inventory defaults", async () => {
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const registration = reference("/facts", "passing");
  const key = sdk.defineExtensionFactKey({ extensionId: "test.actual-passing", name: "checked-parameter", snapshot: value => value });
  let writes = 0;
  const extension = { identity: { id: "test.actual-passing", version: "1" }, analyzeSource: context => {
    for (const file of context.source.getSourceFiles()) {
      const ast = context.source.ast;
      if (ast.getFileName(file) !== "/project/src/main.ts") continue;
      for (const statement of ast.statements(file)) if (ast.kindName(statement) === "KindFunctionDeclaration") {
        const parameters = ast.parameters(statement);
        for (const [index, parameter] of parameters.entries()) {
          assert.equal(parameter !== undefined, true);
          const written = context.facts.set(parameter, key, index === 0);
          assert.equal(written === "inserted" || written === "idempotent", true);
          writes += 1;
        }
      }
    }
  } };
  const snapshot = projectSnapshot({ sourceFiles: { "main.ts": addSource }, libraries: bundled(),
    providerPackages: [{ root: "/facts", name: "facts" }], compilerExtensions: [registration] });
  const opened = openAndCapture(snapshot, [{ reference: registration, value: { kind: "compiler-extension", value: extension } }]);
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const captured = captureSingleModule(front, opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  assert.equal(writes, 2);
  assert.deepEqual(captured.value.types.signatures[0].parameters.map(parameter => parameter.passing),
    [{ kind: "unavailable", reason: "not-provided", causes: [] }, { kind: "unavailable", reason: "not-provided", causes: [] }]);
  assert.equal(captured.value.core[0].provider.kind, "unavailable", "a selected compiler extension is not an empty fact inventory");
  const definitions = identifySingleModule(front, { module: captured.value, componentRoots: captured.value.types.components.map(component => component.root).filter(root => root.module === captured.value.module) });
  const parameters = definitions.value.rows.filter(row => row.kind === "Parameter");
  assert.equal(parameters.length, 2);
  for (const parameter of parameters)
    assert.deepEqual(captured.value.core[parameter.node].argumentPassing, { kind: "unavailable", reason: "not-provided", causes: [] });
  const interner = types.createTypeInterner();
  assert.throws(() => lowerWithReadyExports(lowerDepsFor(definitions.value, interner, addSource), captured.value),
    error => error instanceof TypeError && error.message.includes("passing mode"));
});

test("tuple declaration reads keep the actual authored type, independently of a same-name value", () => {
  const source = "type Pair = [number, string]; const Pair = 0; "
    + "export const selected: Pair = [1, 'text']; export declare const direct: readonly [string, boolean];";
  const { deps, program, module } = openedModule(source);
  const result = captureSingleModule(front, deps, program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  for (const [ordinal, readonly, slots] of [[2, false, ["number", "string"]], [3, true, ["string", "boolean"]]]) {
    const node = raw.tree.statements.nodes[ordinal].declarationList.declarations.nodes[0];
    const view = raw.checkerViews.find(row => row.node.node === node.id);
    assert.equal(view.read.kind, "available");
    const row = raw.types.types[view.read.value];
    assert.deepEqual(raw.types.components[row.component].root, { module, node: node.id });
    assert.equal(row.form.kind, "available");
    const tuple = row.form.value;
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, readonly);
    assert.deepEqual(tuple.elements.map(element => raw.types.types[element.type].form.value.scalar), slots);
    assert.deepEqual(tuple.elements.map(element => raw.types.components[element.component].path),
      [{ prefix: null, step: { kind: "tuple-element", index: 0 } }, { prefix: null, step: { kind: "tuple-element", index: 1 } }]);
  }
  const initializer = raw.tree.statements.nodes[2].declarationList.declarations.nodes[0].initializer;
  const initializerView = raw.checkerViews.find(row => row.node.node === initializer.id);
  for (const view of [initializerView.read, initializerView.contextual]) {
    assert.equal(view.kind, "available");
    const row = raw.types.types[view.value];
    assert.deepEqual(raw.types.components[row.component].root, { module, node: initializer.id });
    assert.equal(row.form.value.kind, "tuple");
    assert.deepEqual(row.form.value.elements.map(element => raw.types.types[element.type].form.value.scalar),
      ["number", "string"]);
  }
  const value = raw.tree.statements.nodes[1].declarationList.declarations.nodes[0];
  const valueType = raw.types.types[raw.checkerViews.find(row => row.node.node === value.id).read.value];
  assert.deepEqual(valueType.form, { kind: "available", value: { kind: "scalar", scalar: "number" } });
});

test("inferred array destructuring preserves independent native read and contextual tuple slots", () => {
  const { deps, program, module } = openedModule(
    "declare const a: number; declare const c: number; export const [e, f] = [a + 1, c];");
  const result = captureSingleModule(front, deps, program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const declaration = raw.tree.statements.nodes[2].declarationList.declarations.nodes[0];
  assert.equal(declaration.type, null);
  const initializer = declaration.initializer;
  assert.equal(initializer.kind, "ArrayLiteralExpression");
  const { read, contextual } = raw.checkerViews.find(row => row.node.node === initializer.id);
  assert.notEqual(read.value, contextual.value);
  for (const [view, scalar] of [[read, "number"], [contextual, "any"]]) {
    assert.equal(view.kind, "available");
    const row = raw.types.types[view.value];
    const root = { module, node: initializer.id };
    assert.deepEqual(raw.types.components[row.component].root, root);
    assert.equal(row.form.kind, "available");
    const tuple = row.form.value;
    assert.equal(tuple.kind, "tuple");
    assert.equal(tuple.readonly, false);
    assert.equal(tuple.elements.length, 2);
    for (const [index, element] of tuple.elements.entries()) {
      assert.equal(element.kind, "required");
      assert.equal(element.declaration, null);
      const component = raw.types.components[element.component];
      assert.deepEqual(component.root, root);
      assert.deepEqual(component.path, { prefix: null, step: { kind: "tuple-element", index } });
    }
    assert.deepEqual(raw.types.types[tuple.elements[0].type].form,
      { kind: "available", value: { kind: "scalar", scalar } });
  }
});

test("a contextual binding member and an initializer property retain their different source origins", async () => {
  const text = "declare const a: number; declare const c: number; export const [e, {f: selected}] = [a + 1, {f: c}];";
  const { deps, program, module } = openedModule(text);
  const captured = captureSingleModule(front, deps, program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const declaration = raw.tree.statements.nodes[2].declarationList.declarations.nodes[0];
  const bindingElement = declaration.name.elements.nodes[1].name.elements.nodes[0];
  const initializer = declaration.initializer;
  const property = initializer.elements.nodes[1].properties.nodes[0];
  const { read, contextual } = raw.checkerViews.find(row => row.node.node === initializer.id);
  const origins = [];
  for (const [view, node, scalar] of [[read, property, "number"], [contextual, bindingElement, "any"]]) {
    assert.equal(view.kind, "available");
    const tuple = raw.types.types[view.value].form.value;
    const memberType = raw.types.types[tuple.elements[1].type].form.value;
    assert.equal(memberType.kind, "structure");
    const [member] = raw.types.members[memberType.inventory].members;
    assert.deepEqual(member.key, { kind: "text", value: "f" });
    assert.deepEqual(member.declarations, node === property ? [{ module, node: property.id }] : []);
    const origin = { kind: "source-member", occurrence: { module, node: node.id }, access: "read" };
    assert.deepEqual(member.origins[0], origin);
    assert.deepEqual(raw.types.types[member.read.value].form, { kind: "available", value: { kind: "scalar", scalar } });
    assert.deepEqual(rawComponentPath(raw.types.components, raw.types.components[raw.types.types[member.read.value].component]),
      [{ kind: "tuple-element", index: 1 }, origin]);
    origins.push(origin);
  }
  const roots = raw.types.components.map(component => component.root).concat(origins.map(origin => origin.occurrence));
  const definitions = identifySingleModule(front, { module: raw, componentRoots: roots.filter(root => root.module === module) });
  assert.equal(definitions.kind, "ok");
  assert.equal(definitions.value.rows.some(row => row.node === declaration.id), false);
  const selected = definitions.value.rows.find(row => row.node === bindingElement.id);
  assert.equal(selected.segments.at(-1).name, "selected");
  const lower = lowerDepsFor(definitions.value, (await import("../../packages/host/dist/ir-types/index.js")).createTypeInterner(), text);
  const { lowerMemberOrigin } = await import("../../packages/host/dist/front/bindings.js");
  for (const origin of origins) {
    const actual = lower.sourceOccurrenceOf(origin.occurrence);
    assert.equal(actual.occurrence.kind, "body");
    assert.equal(ids.decodeBodyId(actual.occurrence.value.body).value.role, "module");
    assert.deepEqual(lowerMemberOrigin(lower, origin), { kind: "source-member", occurrence: actual.occurrence.value });
  }
  assert.throws(() => lowerMemberOrigin({ ...lower, sourceOccurrenceOf: () => null }, origins[1]), /requires its actual body-qualified/u);
});

test("the actual raw receiver distinguishes two private names and the equally spelled public string", () => {
  const { deps, program, module } = openedModule("class Base { #value: number = 1; } "
    + 'export class Derived extends Base { #value: string = "text"; "#value": boolean = true; } '
    + "export declare const derived: Derived;");
  const captured = captureSingleModule(front, deps, program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const [base, derived, variable] = raw.tree.statements.nodes;
  const declaration = variable.declarationList.declarations.nodes[0];
  const view = raw.checkerViews.find(row => row.node.node === declaration.id);
  assert.equal(view.read.kind, "available");
  let receiver = raw.types.types[view.read.value].form.value;
  if (receiver.kind === "declared") receiver = raw.types.types[receiver.definition].form.value;
  assert.equal(receiver.kind, "structure");
  const actual = raw.types.members[receiver.inventory].members.filter(member => member.name === "#value");
  assert.deepEqual(actual.map(member => member.key), [
    { kind: "private", owner: { module, node: derived.id }, name: "#value" },
    { kind: "text", value: "#value" },
    { kind: "private", owner: { module, node: base.id }, name: "#value" },
  ]);
  assert.deepEqual(actual.map(member => raw.types.types[member.read.value].form.value.scalar), ["string", "boolean", "number"]);
});

test("the identity inputs through the real producer: captureModule and lowerModuleDefinitions give exactly the authored rows, or a named frontier refusal, in a stated split", () => {
  const { cases } = JSON.parse(readFileSync(resolve(repository, "test/host-units/fixtures/front/identity-cases.json"), "utf8"));
  const libraries = bundled();
  const remainingFrontiers = new Map([
    ["unnamed-class-members /project/src/a.ts", "front: the captured form of the checker type K is not implemented"],
  ]);
  let agreed = 0;
  for (const entry of cases) {
    const sourceFiles = {};
    const library = { root: "/library", name: "library", modules: {} };
    for (const [path, text] of Object.entries(entry.files)) {
      if (path.startsWith("/project/src/")) sourceFiles[path.slice("/project/src/".length)] = text;
      else if (path.startsWith("/library/")) library.modules[path.slice("/library/".length)] = ["declaration", text, true];
      else assert.fail(`${entry.name}: ${path} is under neither root`);
    }
    const otherPackages = Object.keys(library.modules).length === 0 ? [] : [library];
    // A snapshot has a source entry point; an input made only of the external file gets an empty entry module, whose rows are not judged.
    if (Object.keys(sourceFiles).length === 0) sourceFiles["main.ts"] = "export {};\n";
    const { deps, program } = openAndCapture(projectSnapshot({ sourceFiles, libraries, otherPackages }));
    for (const [path, expected] of Object.entries(entry.definitions ?? {})) {
      const module = path.startsWith("/library/") ? moduleOf(packageOf("/library"), path.slice("/library/".length)) : moduleOf(packageOf("/project"), `src/${path.slice("/project/src/".length)}`);
      const label = `${entry.name} ${path}`;
      let raw;
      try { raw = captureSingleModule(front, deps, program, module); } catch (error) {
        assert.equal(error instanceof TypeError, true, label);
        assert.equal(error.message, remainingFrontiers.get(label), label);
        remainingFrontiers.delete(label);
        continue;
      }
      assert.equal(raw.kind, "ok", label);
      const definitions = identifySingleModule(front, { module: raw.value, componentRoots: raw.value.types.components.map(component => component.root).filter(root => root.module === raw.value.module) });
      assert.equal(definitions.kind, "ok", label);
      assert.deepEqual(definitions.value.rows.map(row => ({ kind: row.kind, path: row.segments.map(segment => [segment.name, segment.ordinal]) })), expected, label);
      agreed += 1;
    }
  }
  assert.deepEqual([...remainingFrontiers], []);
  assert.equal(agreed, 41);
});

test("interface fragments keep their authored identities without assigning an interface recipe to a class facet", () => {
  for (const [center, groupCount, form] of [
    ["export class Shape { own: number = 0; }", 0, "structure"],
    ["export declare const Shape: boolean;", 1, "merged-interface-dependency"],
  ]) {
    const snapshot = projectSnapshot({ sourceFiles: { "main.ts": `
      export interface Shape { left: number; }
      ${center}
      export interface Shape { right: boolean; }
      export type Chosen = Shape;
    ` }, libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }] });
    const { deps, program } = openAndCapture(snapshot);
    const captured = captureSingleModule(front, deps, program, snapshot.entryPoint);
    assert.equal(captured.kind, "ok");
    assert.deepEqual(captured.diagnostics, []);
    const raw = captured.value;
    const [left, , right, chosen] = raw.tree.statements.nodes;
    const definitions = identifySingleModule(front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
    assert.equal(definitions.kind, "ok");
    assert.deepEqual(definitions.value.rows.filter(row => row.kind === "InterfaceDeclaration").map(row => row.node), [left.id, right.id]);
    assert.equal(raw.types.interfaceGroups.length, groupCount);
    if (groupCount !== 0) assert.deepEqual(raw.types.interfaceGroups[0].evidence.declarations,
      [left, right].map(declaration => ({ module: raw.module, node: declaration.id })));
    const resolved = raw.types.types.find(row => row.authoredTypeNode?.node === chosen.type.id);
    assert.equal(resolved.form.value.kind, form);
  }
});

// K-3297 item 3 and R2's V-1/V-2: capture limits before growth, one numbering of every file, cached on the opened program.
// Expectations written before the run. add has 18 nodes and depth 6 (SourceFile, FunctionDeclaration, Block, ReturnStatement,
// BinaryExpression, Identifier). Its facts: the signature with its two parameters (4 each), its result (2) and its row (1), the
// association (1), three annotations (2 each), the views of a, b (3 each) and a + b (5), and 18 core rows: 47. Its edges: the
// references of a and b, their two actual symbol-declaration edges and the export of add: 5.
test("capture limits: nodes, syntax depth, facts and edges are each refused at zero and one under the count and accepted at the exact count, as one resource refusal and no partial result", async () => {
  const diag = await import("../../packages/host/dist/diag/index.js");
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const refusal = (limit, maximum) => ({ kind: "refused", diagnostics: [diag.resourceLimitDiagnostic({ owner: "front", limit, maximum,
    site: { kind: "file", path: "/project/src/main.ts" }, unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
  const under = (name, value) => {
    const { deps, program } = openedModule(addSource);
    return captureSingleModule(front, { ...deps, navigationCapture: { ...deps.navigationCapture, [name]: value } }, program, module);
  };
  const signatureFacts = 1 + 2 * 2;
  const signatureEdges = 2 + 2 + 2 * 2;
  const nativeFacts = 2 + 2 + 2 + signatureFacts;
  const nativeEdges = 3 + 14 + 8 + 3 + 2 * 5 + 2 + signatureEdges;
  const authoredAnnotations = 3;
  const annotationFacts = authoredAnnotations + (1 + authoredAnnotations);
  for (const [name, limit, exact] of [["maximumCapturedNodesPerModule", "front.maximumCapturedNodesPerModule", 18], ["maximumSyntaxDepth", "front.maximumSyntaxDepth", 6],
    ["maximumCapturedFactsPerModule", "front.maximumCapturedFactsPerModule", 47 + nativeFacts + annotationFacts],
    ["maximumCapturedEdgesPerModule", "front.maximumCapturedEdgesPerModule", 5 + nativeEdges + authoredAnnotations]]) {
    for (const value of [0, exact - 1]) assert.deepEqual(under(name, value), refusal(limit, value), `${name} = ${value}`);
    assert.equal(under(name, exact).kind, "ok", `${name} = ${exact}`);
  }
});

test("one numbering for every file (V-1, V-2): a reference into another module names the node that module's own capture names, two modules share one numbering of a file they both reach, a repeated capture is equal, and one program keeps one set of limits", () => {
  const globals = "declare var limit: number;\ndeclare var second: number;\ndeclare var third: number;\ndeclare var fourth: number;\n";
  const sourceFiles = { "a.ts": "export function f(x: number): number { return x + limit + Infinity; }\n",
    "b.ts": "export function g(y: number): number { return y + limit + Infinity; }\n", "globals.d.ts": globals };
  const { deps, program } = openAndCapture(projectSnapshot({ sourceFiles, libraries: bundled() }));
  const [a, b, c] = ["a.ts", "b.ts", "globals.d.ts"].map(name => moduleOf(packageOf("/project"), `src/${name}`));
  const library = moduleOf(packageOf("/checker"), "lib.es5.d.ts");
  const capturedA = captureSingleModule(front, deps, program, a);
  const capturedB = captureSingleModule(front, deps, program, b);
  const capturedC = captureSingleModule(front, deps, program, c);
  assert.deepEqual([capturedA.kind, capturedB.kind, capturedC.kind], ["ok", "ok", "ok"]);
  const declarationsOf = raw => raw.references.flatMap(reference => {
    assert.equal(reference.target.kind, "available");
    assert.equal(reference.target.value.kind, "declarations");
    return reference.target.value.declarations.filter(declaration => declaration.module !== raw.module);
  });
  const limitDeclaration = ids => ids.find(node => node.kind === "VariableDeclaration" && node.name.text === "limit").id;
  const hirModule = import("../../packages/host/dist/ir-hir/index.js");
  return hirModule.then(hir => {
    const ownLimit = limitDeclaration(hir.indexSyntaxTree(capturedC.value.tree));
    const intoA = declarationsOf(capturedA.value);
    assert.deepEqual(intoA.map(reference => reference.module), [c, library]);
    assert.deepEqual(intoA[0], { module: c, node: ownLimit }, "A's reference into the globals file is the node of that file's own capture");
    assert.deepEqual(declarationsOf(capturedB.value), intoA, "B reaches the same nodes through the same numbering");
    assert.deepEqual(captureSingleModule(front, deps, program, a), capturedA, "a repeated capture of one program is equal");
    assert.throws(() => captureSingleModule(front, { ...deps, navigationCapture: { ...deps.navigationCapture, maximumCapturedNodesPerModule: 99999 } }, program, a),
      { name: "TypeError", message: "front: one opened program is captured under one set of navigation capture limits" });
  });
});

test("a limit met in another file refuses the capture that needed it: the referenced file's node count over the limit, with that file's own refusal", async () => {
  const diag = await import("../../packages/host/dist/diag/index.js");
  const globals = "declare var limit: number;\ndeclare var second: number;\ndeclare var third: number;\ndeclare var fourth: number;\n";
  const sourceFiles = { "a.ts": "export function f(x: number): number { return x + limit; }\n", "globals.d.ts": globals };
  const { deps, program } = openAndCapture(projectSnapshot({ sourceFiles, libraries: bundled() }));
  const [a, c] = ["a.ts", "globals.d.ts"].map(name => moduleOf(packageOf("/project"), `src/${name}`));
  const tight = { ...deps, navigationCapture: { ...deps.navigationCapture, maximumCapturedNodesPerModule: 20 } };
  assert.deepEqual(captureSingleModule(front, tight, program, a), { kind: "refused", diagnostics: [diag.resourceLimitDiagnostic({ owner: "front", limit: "front.maximumCapturedNodesPerModule",
    maximum: 20, site: { kind: "file", path: "/project/src/globals.d.ts" }, unit: { request: { query: "captureModule", key: c }, position: { kind: "result" } } })] });
});

// R2 V-3: syntax-capture.ts is written by scripts/host/generate-front-syntax.mjs from the HIR contract, HIR's child order and the
// SDK's casts; the committed file must be what the generator writes from the committed inputs.
test("the syntax capture is current: regenerating syntax-capture.ts from the HIR contract, HIR's child order and the SDK's casts gives the committed file", async () => {
  const { frontSyntaxPath, generateFrontSyntax } = await import("../../scripts/host/generate-front-syntax.mjs");
  const generated = await generateFrontSyntax(repository);
  assert.deepEqual([generated.unordered, generated.missingCasts], [[], []]);
  assert.equal(generated.text === readFileSync(resolve(repository, frontSyntaxPath), "utf8"), true, "run node scripts/host/generate-front-syntax.mjs --write");
});

// K-3341: each body's direct children come from the one body walk. Expectations written before the run.
test("K-3341 nested bodies: zero, one and many direct children in preorder, as the body walk records them", async () => {
  const sourceText = "export function outer(a: number): number { function one(b: number): number { return b; } function two(c: number): number { function inner(d: number): number { return d; } return c; } return a; }\nexport function lone(x: number): number { return x; }\n";
  const { module, checked, interner } = checkedModuleOf(sourceText);
  const definition = segments => ids.encodeDefId({ module, segments: segments.map(name => ({ name, ordinal: 0 })) });
  const body = segments => ids.encodeBodyId({ owner: definition(segments), role: "function", ordinal: 0 });
  const moduleBody = ids.encodeBodyId({ owner: definition([]), role: "module", ordinal: 0 });
  const nested = new Map(checked.bodies.map(entry => [entry.body, entry.nestedBodies]));
  assert.deepEqual(nested.get(moduleBody), [body(["outer"]), body(["lone"])]);
  assert.deepEqual(nested.get(body(["outer"])), [body(["outer", "one"]), body(["outer", "two"])]);
  assert.deepEqual(nested.get(body(["outer", "two"])), [body(["outer", "two", "inner"])]);
  for (const leaf of [["lone"], ["outer", "one"], ["outer", "two", "inner"]]) assert.deepEqual(nested.get(body(leaf)), []);
  assert.equal(checked.bodies.length, 6);
  assert.deepEqual(verifyChecked(checked, interner), []);
});

// K-3341: the first refusal stops capture before any further read. In `pick`, the facts are admitted in this order: the signature
// row (1); a's component, symbol, type and passing (2 to 5); b's component, symbol, type and passing (6 to 9), before its
// checker-type frontier (`typeof globalThis`). Under every maximum below 9 the earned refusal is returned and b's type is never
// read; at 9 the read happens and the frontier is met.
function captureBeforeMemberRead(OpenedProgram, sourceText, maximum, read) {
  const opened = openedModule(sourceText);
  const checked = OpenedProgram.checked(opened.program);
  const borrowed = { ...checked, getSourceFileQueries: file => {
    const queries = checked.getSourceFileQueries(file);
    return { ...queries, typeShape: { ...queries.typeShape, getObjectPropertyHeaders: read } };
  } };
  const files = OpenedProgram.modules(opened.program).modules.map(entry => OpenedProgram.file(opened.program,
    entry.kind === "snapshot" ? entry.module : entry.document.module));
  const program = OpenedProgram.create(borrowed, OpenedProgram.table(opened.program), files,
    OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
  return captureSingleModule(front, { ...opened.deps, navigationCapture: { ...opened.deps.navigationCapture,
    maximumCapturedFactsPerModule: maximum } }, program, opened.module);
}

test("K-3341 first refusal precedes the actual structural member read and retains its original resource diagnostic", async () => {
  const diag = await import("../../packages/host/dist/diag/index.js");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const sourceText = "export function pick(a: number, b: typeof globalThis): number { return a; }\n";
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  let reads = 0;
  const boundary = new TypeError("the actual selected structural member reader was reached");
  const under = value => captureBeforeMemberRead(OpenedProgram, sourceText, value, () => { reads += 1; throw boundary; });
  const refusal = maximum => ({ kind: "refused", diagnostics: [diag.resourceLimitDiagnostic({ owner: "front", limit: "front.maximumCapturedFactsPerModule", maximum,
    site: { kind: "file", path: "/project/src/main.ts" }, unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
  const effectiveParameters = 1 + 2 * 2;
  const exact = 9 + effectiveParameters;
  for (const value of [0, 1, effectiveParameters, effectiveParameters + 1, effectiveParameters + 4, exact - 1]) {
    assert.deepEqual(under(value), refusal(value), `maximum ${value}`);
    assert.equal(reads, 0, "a refused capture never makes the later actual structural type lookup");
  }
  assert.throws(() => under(exact), error => error === boundary);
  assert.equal(reads, 1);
});

// K-3341: a five-parameter function. Facts: the signature row, five parameters (4 each), the result (2), the association, six
// annotations (2 each), the view of `return a` (read 2, contextual 2, row 1) and 24 core rows: 1 + 20 + 2 + 1 + 12 + 5 + 24 = 65.
test("K-3341 many parameters: refused at zero and one under the fact count, accepted at the exact count", async () => {
  const diag = await import("../../packages/host/dist/diag/index.js");
  const sourceText = "export function many(a: number, b: number, c: number, d: number, e: number): number { return a; }\n";
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const under = value => {
    const { deps, program } = openedModule(sourceText);
    return captureSingleModule(front, { ...deps, navigationCapture: { ...deps.navigationCapture, maximumCapturedFactsPerModule: value } }, program, module);
  };
  const effectiveParameters = 1 + 5 * 2;
  const authoredAnnotations = 6;
  const annotationFacts = authoredAnnotations + (1 + authoredAnnotations);
  const exact = 65 + 2 + effectiveParameters + annotationFacts;
  for (const value of [0, exact - 1]) assert.deepEqual(under(value), { kind: "refused", diagnostics: [diag.resourceLimitDiagnostic({ owner: "front",
    limit: "front.maximumCapturedFactsPerModule", maximum: value, site: { kind: "file", path: "/project/src/main.ts" },
    unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] }, `maximum ${value}`);
  assert.equal(under(exact).kind, "ok");
});

// K-3340: lowering keeps each fact's availability and reason as captured. Constructed raw modules from add's real capture (node 13
// is a + b, node 14 is the use of a, node 4 is parameter a). Expectations written before the run.
test("K-3340: views, storage places, memory and layout observations keep present, proven-null and unavailable states with each reason, the reasons of missing evidence included", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { deps, program, module } = openedModule(addSource);
  const raw = captureSingleModule(front, deps, program, module).value;
  const definitions = identifySingleModule(front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) }).value;
  const lower = changed => {
    const interner = types.createTypeInterner();
    const lowered = lowerWithReadyExports(lowerDepsFor(definitions, interner, addSource), changed);
    const nodes = new Map(hir.indexSyntaxTree(lowered.value.tree).map(node => [node.id, node]));
    return { at: id => nodes.get(id).tsonic, float64: types.internType(interner, { kind: "primitive", primitive: "float64" }) };
  };
  const unavailable = reason => ({ kind: "unavailable", reason, causes: [] });
  const withView = declared => ({ ...raw, checkerViews: raw.checkerViews.map(view => view.node.node === 13 ? { ...view, declared } : view) });
  const withCore = (node, field, fact) => ({ ...raw, core: raw.core.map(row => row.node.node === node ? { ...row, [field]: fact } : row) });
  const absent = { kind: "available", value: null };
  // The real capture: no storage row (not provided), memory and observation proven absent, declared view proven absent.
  const plain = lower(raw);
  assert.deepEqual([plain.at(14).value.place, plain.at(14).value.memory, plain.at(14).value.observation, plain.at(13).value.views.declared],
    [{ kind: "unavailable", reason: "not-provided", causes: [] }, absent, absent, absent]);
  assert.deepEqual(plain.at(4).memory, absent);
  // The declared view: present, and unavailable for each reason HIR has.
  const binary = raw.checkerViews.find(view => view.node.node === 13);
  const present = lower(withView({ kind: "available", value: binary.read.value }));
  assert.deepEqual(present.at(13).value.views.declared, { kind: "available", value: present.float64 });
  // A storage row keeps absence and unavailability; a present local place requires its genuine declaration association.
  const withStorage = fact => ({ ...raw, storage: [{ node: { module, node: 14 }, fact }] });
  for (const reason of ["checker-error", "parameter-dependent", "not-provided", "missing-original-component", "incomplete-association", "unsupported-checked-structure"]) {
    const fact = unavailable(reason);
    const captured = lower({ ...withStorage(fact),
      checkerViews: raw.checkerViews.map(view => view.node.node === 14 ? { ...view, read: fact, declared: fact, contextual: fact } : view),
      core: raw.core.map(row => row.node.node === 14 ? { ...row, markers: fact, metadata: fact, layoutQuery: fact } : row),
    }).at(14);
    for (const [field, value] of [["read", captured.value.views.read], ["declared", captured.value.views.declared],
      ["contextual", captured.value.views.contextual], ["place", captured.value.place], ["memory", captured.value.memory],
      ["observation", captured.value.observation], ["markers", captured.core.markers]])
      assert.deepEqual(value, { kind: "unavailable", reason, causes: [] }, `${field}/${reason}`);
  }
  assert.deepEqual(lower(withStorage(absent)).at(14).value.place, absent);
  assert.deepEqual(lower(withStorage(unavailable("checker-error"))).at(14).value.place, { kind: "unavailable", reason: "checker-error", causes: [] });
  assert.throws(() => lower(withStorage({ kind: "available", value: { expression: { module, node: 14 }, storageExpression: { module, node: 14 }, type: binary.read.value,
    symbol: null, declaration: null, writable: false } })), { name: "TypeError", message: "front: a storage capture must retain its actual expression and qualified local or static declaration" });
  // Core facts keep their reasons, markers included; memory comes from the node's metadata.
  assert.deepEqual(lower(withCore(4, "metadata", unavailable("parameter-dependent"))).at(4).memory, { kind: "unavailable", reason: "parameter-dependent", causes: [] });
  assert.deepEqual(lower(withCore(4, "markers", unavailable("checker-error"))).at(4).core.markers, { kind: "unavailable", reason: "checker-error", causes: [] });
  assert.deepEqual(lower(withCore(13, "layoutQuery", unavailable("incomplete-association"))).at(13).value.observation, { kind: "unavailable", reason: "incomplete-association", causes: [] });
});

// K-3361: the explicit this receiver and the declaration's type parameters are the checker's and the syntax's. Expectations
// written before the run.
test("K-3361: a receiver is captured apart from the ordinary parameters and lowering refuses it by name; add's receiver is the checker's known absence; an unused type parameter is kept", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const captured = sourceText => {
    const { deps, program, module } = openedModule(sourceText);
    const raw = captureSingleModule(front, deps, program, module).value;
    const association = raw.callableAssociations[0];
    return { raw, signature: raw.types.signatures[association.advertised[0]], nodes: hir.indexSyntaxTree(raw.tree), module, sourceText };
  };
  const lower = ({ raw, sourceText }) => lowerWithReadyExports(lowerDepsFor(identifySingleModule(front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) }).value, types.createTypeInterner(), sourceText), raw);
  const receiving = captured("export function f(this: number, x: number): number { return x; }\n");
  const parameterNodes = receiving.nodes.filter(node => node.kind === "Parameter").map(node => node.id);
  assert.equal(receiving.signature.receiver.kind, "available");
  assert.ok(receiving.signature.receiver.value !== null, "the receiver is present");
  assert.equal(receiving.signature.receiver.value.declaration.node, parameterNodes[0]);
  assert.deepEqual(receiving.raw.types.types[receiving.signature.receiver.value.type].form, { kind: "available", value: { kind: "scalar", scalar: "number" } });
  assert.deepEqual(receiving.signature.parameters.map(parameter => parameter.declaration.node), [parameterNodes[1]]);
  assert.throws(() => lower(receiving), { name: "TypeError", message: "front: a function with an explicit this receiver, or whose receiver is not captured, is not implemented" });
  const plain = captured(addSource);
  assert.deepEqual([plain.signature.receiver, plain.signature.typeParameters], [{ kind: "available", value: null }, { kind: "available", value: [] }]);
  const generic = captured("export function f<T>(x: number): number { return x; }\n");
  const typeParameter = generic.nodes.find(node => node.kind === "TypeParameter").id;
  assert.equal(generic.signature.typeParameters.kind, "available");
  assert.equal(generic.signature.typeParameters.value.length, 1);
  const binder = generic.raw.types.types[generic.signature.typeParameters.value[0]];
  assert.deepEqual(binder.form, { kind: "available", value: { kind: "parameter",
    parameter: { module: generic.module, node: typeParameter }, constraint: null, default: null } });
  const checked = lower(generic);
  assert.equal(checked.kind, "ok");
  const [callable] = checked.value.tree.statements.nodes;
  const [parameter] = callable.typeParameters.nodes;
  assert.equal(parameter.id, typeParameter);
  assert.equal(parameter.tsonic.parent, callable.tsonic.definition);
  assert.equal(checked.value.items.some(entry => entry.definition === parameter.tsonic.parameter.declaration && entry.node === typeParameter), true);
});

// R2 M-2: the same five parameters with the last typed `typeof globalThis`. Its facts: the signature row (1), four parameters
// (4 each, to 17), e's component and symbol (18, 19), passing (20) and type (21), whose read meets the checker-type frontier. Expectations
// written before the run.
test("K-3341 many parameters preserve the exact fact boundary before their last actual structural member read", async () => {
  const diag = await import("../../packages/host/dist/diag/index.js");
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const sourceText = "export function many(a: number, b: number, c: number, d: number, e: typeof globalThis): number { return a; }\n";
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  let reads = 0;
  const boundary = new TypeError("the actual last structural member reader was reached");
  const under = value => captureBeforeMemberRead(OpenedProgram, sourceText, value, () => { reads += 1; throw boundary; });
  const effectiveParameters = 1 + 5 * 2;
  const exact = 21 + effectiveParameters;
  for (const value of [0, exact - 1]) assert.deepEqual(under(value), { kind: "refused", diagnostics: [diag.resourceLimitDiagnostic({ owner: "front",
    limit: "front.maximumCapturedFactsPerModule", maximum: value, site: { kind: "file", path: "/project/src/main.ts" },
    unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] }, `maximum ${value}`);
  assert.equal(reads, 0, "both refused captures stop before their actual structural lookup");
  assert.throws(() => under(exact), error => error === boundary);
  assert.equal(reads, 1);
});

// K-3343: identity counters belong to the owner itself. The raw modules are constructed (K-3343 allows it): the syntax tree comes
// from the checker through Front's own syntax capture, the rest of the raw module from add's capture, because the full capture of
// these object and union types meets the checker-type frontier. Expectations written before the run.
test("the captured syntax retains the actual non-node heritage, import-attribute and meta keywords", async () => {
  const hir = await import("../../packages/host/dist/ir-hir/index.js");
  const module = moduleOf(packageOf("/project"), "src/main.ts");
  const tree = await captureSyntaxOf(`interface Parent {}
    class Child extends Base implements Parent { constructor() { super(); new.target; } }
    import output from "data" with { type: "json" };
    export const url = import.meta.url;`, module);
  const nodes = hir.indexSyntaxTree(tree);
  assert.deepEqual(nodes.filter(node => node.kind === "HeritageClause").map(node => node.token), ["ExtendsKeyword", "ImplementsKeyword"]);
  assert.deepEqual(nodes.filter(node => node.kind === "ImportAttributes").map(node => node.token), ["WithKeyword"]);
  assert.deepEqual(nodes.filter(node => node.kind === "MetaProperty").map(node => node.keywordToken), ["NewKeyword", "ImportKeyword"]);
});

test("actual file pragmas preserve argument ranges, selection and the owning capture limit", async () => {
  const text = '// é\n/// <reference no-default-lib="true" />\n/** @jsx factory */\n// @ts-check\n// @ts-nocheck\n';
  const current = openedModule(text);
  const captured = captureSingleModule(front, current.deps, current.program, current.module);
  assert.equal(captured.kind, "ok");
  const tree = captured.value.tree;
  assert.deepEqual(tree.pragmas.map(pragma => [pragma.name, pragma.kind]), [
    ["reference", "SingleLineCommentTrivia"], ["jsx", "MultiLineCommentTrivia"],
    ["ts-check", "SingleLineCommentTrivia"], ["ts-nocheck", "SingleLineCommentTrivia"],
  ]);
  for (const pragma of tree.pragmas) for (const { name, value } of pragma.args) {
    assert.equal(name, value.name);
    assert.equal(text.slice(value.pos, value.end), value.value);
  }
  assert.equal(tree.checkJsDirective.enabled, false);
  assert.equal(text.slice(tree.checkJsDirective.range.pos, tree.checkJsDirective.range.end), "// @ts-nocheck");
  for (const maximum of [0, 1, 2, 3, 4, 5, 6]) {
    const limits = { ...current.deps.navigationCapture, maximumCapturedFactsPerModule: maximum };
    const result = captureSingleModule(front, { ...current.deps, navigationCapture: limits }, current.program, current.module);
    assert.equal(result.kind, "refused", `actual fact cut ${maximum}`);
    assert.deepEqual(result.diagnostics[0].arguments, [{ kind: "text", value: "front.maximumCapturedFactsPerModule" },
      { kind: "number", value: maximum }]);
  }
});

test("K-3343: names holding #, / and : never make two owners share a counter; overloads in one owner still count up; rows are deterministic and identities distinct", async () => {
  const base = checkedModuleOf(addSource).raw;
  const rowsOf = async sourceText => {
    const tree = await captureSyntaxOf(sourceText, base.module);
    const definitions = identifySingleModule(front, { module: { ...base, tree }, componentRoots: [] });
    assert.equal(definitions.kind, "ok");
    return definitions.value.rows;
  };
  const paths = rows => rows.map(row => row.segments.map(segment => [segment.name, segment.ordinal]));
  const collision = "export interface I {\n  a: { \"b#0/c\": { z: number } };\n  \"a#0/b\": { c: { z: number } };\n}\n";
  const rows = await rowsOf(collision);
  assert.deepEqual(paths(rows), [[], [["I", 0]], [["I", 0], ["a", 0]], [["I", 0], ["a", 0], ["b#0/c", 0]], [["I", 0], ["a", 0], ["b#0/c", 0], ["z", 0]],
    [["I", 0], ["a#0/b", 0]], [["I", 0], ["a#0/b", 0], ["c", 0]], [["I", 0], ["a#0/b", 0], ["c", 0], ["z", 0]]]);
  assert.equal(new Set(rows.map(row => row.definition)).size, rows.length, "every identity is distinct");
  assert.deepEqual(await rowsOf(collision), rows, "the rows of one source are the same each time");
  const names = "export interface J {\n  \"\": number;\n  \"#\": number;\n  \":\": number;\n  \"/\": number;\n  \"a:b#0/c\": number;\n  \"é\": number;\n  \"名\": number;\n}\n";
  const nameRows = await rowsOf(names);
  assert.deepEqual(paths(nameRows).slice(2), ["", "#", ":", "/", "a:b#0/c", "é", "名"].map(name => [["J", 0], [name, 0]]));
  assert.equal(new Set(nameRows.map(row => row.definition)).size, nameRows.length);
  const overloads = "export function over(a: number): number;\nexport function over(a: string): string;\nexport function over(a: number | string): number | string { return a; }\n";
  assert.deepEqual(paths(await rowsOf(overloads)), [[], [["over", 0]], [["over", 0], ["a", 0]], [["over", 1]], [["over", 1], ["a", 0]], [["over", 2]], [["over", 2], ["a", 0]]]);
});
