import { isAbsolute, posix } from "node:path";
import { keelWorkspaceRepositories, validLiteralFilePath } from "./keel-contract.mjs";
import { guardedBuiltins, nativeBuiltinSpecifiers, nodeProcessMembers, createKeelScriptBindings } from "./keel-script-bindings.mjs";
import { createKeelNodeExecutions } from "./keel-node-executions.mjs";
import { ParseSourceFile } from "../../../packages/tsts/dist/src/internal/parser/parser/statements-declarations.js";
import { createAstReader } from "../../../packages/tsts/dist/src/services/ast-reader.js";
import { ScriptKindJS, ScriptKindJSX, ScriptKindTS, ScriptKindTSX } from "../../../packages/tsts/dist/src/internal/core/scriptkind.js";
import { Node_QuestionDotToken, SourceFile_Diagnostics, SourceFile_JSDiagnostics } from "../../../packages/tsts/dist/src/internal/ast/ast.js";
import { NodeDefault_AsNode } from "../../../packages/tsts/dist/src/internal/ast/spine.js";
import { AsBindingElement, AsMetaProperty } from "../../../packages/tsts/dist/src/internal/ast/generated/casts.js";
import { KindImportKeyword } from "../../../packages/tsts/dist/src/internal/ast/generated/kinds.js";

export function staticFileAddress(sourcePath, specifier) {
  try {
    const base = new URL(sourcePath.split("/").map(encodeURIComponent).join("/"), "file:///keel/");
    const value = new URL(specifier, base);
    if (value.protocol !== "file:") return {};
    if (value.hostname !== "" || /%2f|%5c/iu.test(value.pathname)) return { unresolved: true, firstParty: true };
    const path = decodeURIComponent(value.pathname);
    if (!path.startsWith("/keel/")) return { specifier: path, firstParty: true, urlAddress: true };
    const relative = path.slice(6);
    if (!validLiteralFilePath(relative.replace(/\/$/u, "")) || !keelWorkspaceRepositories.includes(relative.split("/")[0])) return { unresolved: true, firstParty: true };
    return { path: relative, firstParty: true, urlAddress: true, directory: relative.endsWith("/") };
  } catch { return { unresolved: true, firstParty: true }; }
}

export function scriptSourceReferences(path, text, boundary, entryRole, moduleSpecifierTargets) {
  if (!["authored", "native-entry", "native-test-entry"].includes(entryRole)) throw new Error("Invalid AC12 executable source role.");
  if (typeof moduleSpecifierTargets !== "function") throw new Error("Missing AC12 canonical package-import resolution.");
  const ast = createAstReader();
  const kind = path.endsWith(".tsx") ? ScriptKindTSX : path.endsWith(".jsx") ? ScriptKindJSX
    : /\.[cm]?ts$/u.test(path) ? ScriptKindTS : ScriptKindJS;
  const sourcePath = `/keel/${path}`;
  const source = ParseSourceFile({ FileName: sourcePath, Path: sourcePath }, text, kind);
  if (source === undefined) throw new Error(`Unresolved AC12 source syntax: ${path}.`);
  const declarationFile = source.IsDeclarationFile === true;
  const nativeEntry = entryRole !== "authored";
  if (declarationFile && !nativeEntry) return { references: [], testEntry: false, nativeJavaScript: false, declarationFile, nativeEntry, entryRole,
    literalUrlLoaders: Object.freeze([]), finiteModuleTargets: Object.freeze([]) };
  if ((SourceFile_Diagnostics(source)?.length ?? 0) > 0 || (SourceFile_JSDiagnostics(source)?.length ?? 0) > 0) {
    return { references: [{ unresolved: true }], testEntry: false, nativeJavaScript: kind === ScriptKindJS, declarationFile, nativeEntry, entryRole,
      literalUrlLoaders: Object.freeze([]), finiteModuleTargets: Object.freeze([]) };
  }
  const references = [];
  const nodes = [];
  const imports = new Map();
  const variables = new Map();
  const identifiers = new Map();
  const valueDeclarations = new Map();
  const patternIdentities = new Map();
  const patternNames = new Set();
  const moduleBindings = new Map();
  const { literal, transparent, byteReader, typeOnlyModuleDeclaration, nonValueName, builtinSpecifier, typeOnlyUse, memberAccess, globalObject,
    nonLoadingUse, namespaceUse, literalPattern, importedApi, api, resolutionOnlyUse, moduleMemberUse, mutated } =
    createKeelScriptBindings({ ast, imports, valueDeclarations, moduleBindings, patternIdentities, patternNames, initializer,
      sourcePath: path, moduleSpecifierTargets,
      rejectModuleIdentity: specifier => references.push({ unresolved: true, unresolvedReason: `unproved native builtin identity for package import '${specifier}'` }) });
  const { codeEntry, nodeExecution, nodeModuleExecution, executionEnvironment } = createKeelNodeExecutions({ ast, importedApi, memberAccess,
    literal, transparent, sourceAddress, fragmentAddress, literalAddress, firstPartyFragment, referencesCanonicalSource, computedModuleEntry, references });
  const visit = node => {
    nodes.push(node);
    if (ast.kindName(node) === "KindIdentifier") {
      const name = ast.text(node);
      identifiers.set(name, [...identifiers.get(name) ?? [], node]);
    }
    ast.forEachChild(node, visit);
  };
  visit(NodeDefault_AsNode(source));
  for (const node of nodes) {
    const kindName = ast.kindName(node);
    if (["KindImportDeclaration", "KindExportDeclaration"].includes(kindName)) {
      if (typeOnlyModuleDeclaration(node)) continue;
      const literal = ast.children(node).find(child => ast.kindName(child) === "KindStringLiteral");
      if (literal === undefined) continue;
      const specifier = ast.text(literal);
      const nativeSpecifier = builtinSpecifier(specifier);
      references.push({ specifier, module: true });
      if (kindName !== "KindImportDeclaration") {
        if (guardedBuiltins.has(nativeSpecifier) && !typeOnlyUse(node)) computedModuleEntry(node);
        continue;
      }
      const collect = child => {
        if (ast.kindName(child) === "KindImportSpecifier") {
          const names = ast.children(child);
          if (!typeOnlyUse(child)) imports.set(ast.text(names.at(-1)), `${nativeSpecifier}#${ast.text(names[0])}`);
        } else if (["KindImportClause", "KindNamespaceImport"].includes(ast.kindName(child)) && ast.name(child) !== undefined) {
          if (!ast.isTypeOnlyImportOrExportDeclaration(child)) imports.set(ast.text(ast.name(child)), `${nativeSpecifier}#*`);
        }
        ast.forEachChild(child, collect);
      };
      collect(node);
    } else if (kindName === "KindImportEqualsDeclaration") {
      if (ast.isTypeOnlyImportOrExportDeclaration(node)) continue;
      const reference = ast.children(node).find(child => ast.kindName(child) === "KindExternalModuleReference");
      const literal = ast.children(reference).find(child => ast.kindName(child) === "KindStringLiteral");
      if (literal !== undefined) {
        const specifier = ast.text(literal);
        references.push({ specifier, module: true, nativeRequire: true });
        imports.set(ast.text(ast.name(node)), `${builtinSpecifier(specifier)}#*`);
      }
    } else if (kindName === "KindVariableDeclaration" && ast.kindName(ast.name(node)) === "KindIdentifier") {
      const name = ast.text(ast.name(node));
      variables.set(name, [...variables.get(name) ?? [], node]);
    }
    if (["KindVariableDeclaration", "KindBindingElement", "KindParameter", "KindFunctionDeclaration", "KindFunctionExpression", "KindClassDeclaration", "KindClassExpression", "KindEnumDeclaration", "KindModuleDeclaration", "KindImportEqualsDeclaration"].includes(kindName) &&
      !(kindName === "KindImportEqualsDeclaration" && imports.has(ast.text(ast.name(node)))) &&
      ast.kindName(ast.name(node)) === "KindIdentifier" && !typeOnlyUse(ast.name(node))) {
      const name = ast.text(ast.name(node));
      valueDeclarations.set(name, [...valueDeclarations.get(name) ?? [], node]);
    }
  }
  for (;;) {
    const previous = moduleBindings.size + patternIdentities.size;
    collectFactoryBindings(false);
    collectPatternBindings();
    if (moduleBindings.size + patternIdentities.size === previous) break;
  }
  collectFactoryBindings(true);

  function collectFactoryBindings(final) {
    for (const [name, declarations] of variables) {
      if (moduleBindings.has(name)) continue;
      const declaration = declarations.find(candidate => {
        const value = initializer(candidate);
        return ast.kindName(value) === "KindCallExpression" && importedApi(ast.children(value)[0]) === "node:module#createRequire";
      });
      if (declaration === undefined) continue;
      const construction = initializer(declaration);
      const uses = identifiers.get(name) ?? [];
      const valid = declarations.length === 1 && ast.variableDeclarationKind(declaration) === "const" &&
        ast.arguments(construction).length === 1 && Node_QuestionDotToken(construction) === undefined &&
        uses.some(use => use !== ast.name(declaration) && !nonValueName(use)) && uses.every(use => {
          if (use === ast.name(declaration) || nonValueName(use) || nonLoadingUse(use)) return true;
          const parent = ast.parent(use);
          return ast.kindName(parent) === "KindCallExpression" && ast.children(parent)[0] === use && Node_QuestionDotToken(parent) === undefined || resolutionOnlyUse(use);
        });
      const root = ast.arguments(construction)[0];
      const address = importMetaUrl(root) ? { path } : sourceAddress(root);
      const finiteTargets = valid ? finiteRequireTargets(declaration) : undefined;
      if (!final && valid && address.path === undefined && finiteTargets === undefined) continue;
      const origin = address.path === undefined ? undefined : address.directory || address.path.endsWith("/")
        ? posix.join(address.path, "package.json") : address.path;
      moduleBindings.set(name, { valid, origin, finiteTargets });
      if (!valid) references.push({ unresolved: true, unresolvedReason: "unresolved first-party createRequire binding, write or escape" });
    }
  }

  function collectPatternBindings() {
    for (const declaration of nodes.filter(node => ast.kindName(node) === "KindVariableDeclaration" && ast.kindName(ast.name(node)) === "KindObjectBindingPattern")) {
      if (ast.elements(ast.name(declaration)).every(element => patternIdentities.has(element))) continue;
      const root = transparent(initializer(declaration));
      let selected = importedApi(root);
      if (ast.kindName(root) === "KindCallExpression") {
        const callee = ast.children(root)[0];
        const argument = ast.arguments(root)[0];
        if ((ast.kindName(callee) === "KindImportKeyword" || api(callee) === "require") && ast.arguments(root).length === 1 && literal(argument)) {
          const binding = ast.kindName(callee) === "KindIdentifier" ? moduleBindings.get(ast.text(callee)) : undefined;
          const origin = binding === undefined ? path : binding.valid ? binding.origin : undefined;
          const specifier = origin === undefined ? "" : builtinSpecifier(ast.text(argument), origin);
          if (nativeBuiltinSpecifiers.has(specifier)) selected = `${specifier}#*`;
        }
      }
      if (!nativeBuiltinSpecifiers.has(selected.slice(0, -2)) || !literalPattern(declaration)) continue;
      for (const element of ast.elements(ast.name(declaration))) {
        const key = AsBindingElement(element).PropertyName ?? ast.name(element);
        patternIdentities.set(element, `${selected.slice(0, -1)}${ast.text(key)}`);
        patternNames.add(ast.text(ast.name(element)));
      }
    }
  }
  for (const node of nodes) {
    const selected = api(node);
    const parent = ast.parent(node);
    const parentKind = ast.kindName(parent);
    const directCall = parentKind === "KindCallExpression" && ast.children(parent)[0] === node && Node_QuestionDotToken(parent) === undefined;
    const importedName = ["KindImportSpecifier", "KindImportClause", "KindNamespaceImport"].includes(parentKind) ||
      ["KindImportEqualsDeclaration", "KindBindingElement"].includes(parentKind) && ast.name(parent) === node &&
      (parentKind === "KindImportEqualsDeclaration" || patternIdentities.has(parent));
    const namespace = selected.endsWith("#*") && guardedBuiltins.has(selected.slice(0, -2));
    const reader = byteReader(selected);
    const globalRoot = globalObject(node);
    const globalRequire = selected === "require" && !(ast.kindName(node) === "KindIdentifier" && moduleBindings.has(ast.text(node)));
    const nonLoading = nonLoadingUse(node);
    if ((namespace || reader || globalRoot || globalRequire) && !nonValueName(node) && !importedName) {
      if (namespace && !namespaceUse(node, selected) || reader && !nonLoading && (!directCall || mutated(node))) computedModuleEntry(node);
      if (globalRoot) {
        const member = memberAccess(parent);
        if (!nonLoading && (member?.receiver !== node || member.name === undefined ||
          ["valueOf", "constructor", "__proto__", "prototype"].includes(member.name) ||
          ["globalThis", "global", "self", "window", "process", "module", "require", "eval", "Function", "URL", "Object"].includes(member.name) && mutated(parent))) computedModuleEntry(node);
      }
      if (globalRequire && !nonLoading && !directCall && !resolutionOnlyUse(node)) computedModuleEntry(node);
    }
    if (selected.startsWith("node:module#") && !nonValueName(node) && !importedName) {
      const use = moduleMemberUse(node, directCall);
      if (use === "namespace") continue;
      if (use === "hook") {
        references.push({ external: true, environment: "loader-hook", offset: ast.pos(parent) });
      } else if (use === "unproved") computedModuleEntry(node);
    }
    if (["node:process#getBuiltinModule", "node:process#mainModule", "node:process#binding", "node:process#dlopen"].includes(selected) && !nonLoading && !nonValueName(node) && !importedName) computedModuleEntry(node);
    if (selected === "node:process#env" && !nonValueName(node)) {
      const member = memberAccess(parent);
      if (member?.receiver === node && member.name === "NODE_OPTIONS" && mutated(parent)) codeEntry(ast.parent(parent), parent);
      if (mutated(node) && parentKind === "KindBinaryExpression" && ast.kindName(transparent(ast.children(parent).at(-1))) === "KindObjectLiteralExpression") {
        executionEnvironment(ast.children(parent).at(-1), parent);
      }
    }
    if (ast.kindName(node) === "KindCallExpression" && importedApi(ast.children(node)[0]) === "node:module#createRequire") {
      const property = parent;
      const resolver = ast.arguments(node).length === 1 && Node_QuestionDotToken(node) === undefined &&
        parentKind === "KindPropertyAccessExpression" && ast.children(property)[0] === node &&
        ast.text(ast.name(property)) === "resolve" && Node_QuestionDotToken(property) === undefined && !mutated(property);
      const bound = parentKind === "KindVariableDeclaration" && initializer(parent) === node &&
        ast.kindName(ast.name(parent)) === "KindIdentifier" && moduleBindings.has(ast.text(ast.name(parent)));
      if (!resolver && !bound) references.push({ unresolved: true, unresolvedReason: "unresolved first-party createRequire result use" });
    }
    const entryFunction = ["eval", "Function", "node:worker_threads#Worker", "node:child_process#fork"].includes(selected) ||
      selected.startsWith("node:vm#") && selected !== "node:vm#*" ||
      selected.startsWith("node:child_process#") && nodeProcessMembers.has(selected.split("#")[1]);
    if (entryFunction && !nonValueName(node) && !importedName && !nonLoading &&
      !((directCall || parentKind === "KindNewExpression" && ast.children(parent)[0] === node) &&
        !mutated(node))) computedModuleEntry(node);
  }
  const literalUrlLoaders = [];
  const loaderImports = new Map();
  for (const declarations of variables.values()) {
    for (const declaration of declarations) {
      const arrow = initializer(declaration);
      if (ast.kindName(arrow) !== "KindArrowFunction") continue;
      const body = ast.body(arrow);
      if (ast.kindName(body) !== "KindCallExpression" || ast.kindName(ast.children(body)[0]) !== "KindImportKeyword") continue;
      const address = ast.arguments(body)[0];
      if (ast.kindName(address) !== "KindPropertyAccessExpression" || ast.text(ast.name(address)) !== "href") continue;
      const construction = ast.children(address)[0];
      if (ast.kindName(construction) !== "KindNewExpression") continue;
      const base = ast.arguments(construction)[1];
      if (ast.kindName(base) !== "KindIdentifier" || !urlBaseDeclaration(base)) continue;
      const rejectLoader = reason => loaderImports.set(body, [{ unresolved: true,
        unresolvedReason: `unresolved first-party literal URL loader: ${reason}` }]);
      const baseDeclaration = urlBaseDeclaration(base);
      const baseConstruction = initializer(baseDeclaration);
      const baseArguments = ast.arguments(baseConstruction);
      const parameters = ast.parameters(arrow);
      const loaderName = ast.text(ast.name(declaration));
      const uses = identifiers.get(loaderName);
      const baseUses = identifiers.get(ast.text(base));
      const referencesToLoader = uses.filter(use => use !== ast.name(declaration));
      const calls = referencesToLoader.map(use => ast.parent(use));
      if (!privateConstant(declaration) || declarations.length !== 1 || ast.hasModifierKind(arrow, "async") ||
        parameters.length !== 1 || ast.kindName(ast.name(parameters[0])) !== "KindIdentifier" ||
        ast.children(parameters[0]).length !== 1 || ast.typeParameters(arrow).length !== 0 ||
        ast.arguments(body).length !== 1 || ast.arguments(construction).length !== 2 ||
        ast.kindName(ast.arguments(construction)[0]) !== "KindIdentifier" ||
        ast.text(ast.arguments(construction)[0]) !== ast.text(ast.name(parameters[0])) ||
        !nativeUrlConstructor(ast.children(construction)[0])) {
        rejectLoader("the private immutable binding and exact whole loader body are not proven"); continue;
      }
      if (!privateConstant(baseDeclaration) || variables.get(ast.text(base)).length !== 1 ||
        baseUses.length !== 2 || !baseUses.includes(ast.name(baseDeclaration)) || !baseUses.includes(base) ||
        baseArguments.length !== 2 || !literal(baseArguments[0]) || !importMetaUrl(baseArguments[1]) ||
        !nativeUrlConstructor(ast.children(baseConstruction)[0])) {
        rejectLoader("the literal URL base is ambiguous, escaping, mutable, shadowed or unrooted"); continue;
      }
      if (calls.length === 0 || calls.some((call, index) => ast.kindName(call) !== "KindCallExpression" ||
        ast.children(call)[0] !== referencesToLoader[index] || Node_QuestionDotToken(call) !== undefined ||
        ast.arguments(call).length !== 1 || !literal(ast.arguments(call)[0]) || ast.typeArguments(call).length !== 0)) {
        rejectLoader("every reference must be its declaration or a direct one-literal-argument call"); continue;
      }
      let baseUrl;
      let targets;
      try {
        baseUrl = new URL(ast.text(baseArguments[0]), new URL(path.split("/").map(encodeURIComponent).join("/"), "file:///keel/"));
        targets = calls.map(call => new URL(ast.text(ast.arguments(call)[0]), baseUrl));
        if ([baseUrl, ...targets].some((url, index) => {
          const relative = decodeURIComponent(url.pathname.slice(6));
          return url.protocol !== "file:" || url.hostname !== "" || !url.pathname.startsWith("/keel/") || /%2f|%5c/iu.test(url.pathname) ||
            !keelWorkspaceRepositories.includes(relative.split("/")[0]) || !validLiteralFilePath(index === 0 ? relative.replace(/\/$/u, "") : relative);
        })) throw new Error("Unrooted URL");
      } catch {
        rejectLoader("the actual URL base or a literal target leaves the tracked first-party root"); continue;
      }
      const resolved = targets.map(url => decodeURIComponent(url.pathname.slice(6)));
      loaderImports.set(body, resolved.map(target => ({ module: true, path: target, firstParty: true, urlAddress: true })));
      literalUrlLoaders.push(Object.freeze({ name: loaderName, base: baseUrl.href, targets: Object.freeze(resolved) }));
    }
  }
  for (const node of nodes) {
    if (["KindCallExpression", "KindNewExpression"].includes(ast.kindName(node))) {
      const callee = ast.children(node)[0];
      const selectedApi = api(callee);
      const require = selectedApi === "require" || selectedApi === "node:module#require";
      const registration = selectedApi === "node:module#register" && ast.kindName(node) === "KindCallExpression";
      const executionEntry = selectedApi === "node:worker_threads#Worker" && ast.kindName(node) === "KindNewExpression" ||
        selectedApi === "node:child_process#fork" && ast.kindName(node) === "KindCallExpression" || registration;
      const module = require || executionEntry || ast.kindName(callee) === "KindImportKeyword";
      const fileRead = byteReader(selectedApi);
      if (["eval", "Function"].includes(selectedApi) || selectedApi.startsWith("node:vm#")) {
        const arguments_ = ast.arguments(node);
        for (const argument of selectedApi === "Function" ? arguments_ : arguments_.slice(0, 1)) codeEntry(argument, node);
        continue;
      }
      if (selectedApi.startsWith("node:child_process#") && nodeProcessMembers.has(selectedApi.split("#")[1])) {
        nodeExecution(node, selectedApi.split("#")[1]); continue;
      }
      if (executionEntry && !registration) {
        nodeModuleExecution(node, selectedApi === "node:worker_threads#Worker"); continue;
      }
      if (!module && !fileRead) continue;
      if (loaderImports.has(node)) { references.push(...loaderImports.get(node)); continue; }
      const address = sourceAddress(ast.arguments(node)[0]);
      const binding = require && ast.kindName(callee) === "KindIdentifier" ? moduleBindings.get(ast.text(callee)) : undefined;
      if (binding !== undefined) {
        if (binding.finiteTargets !== undefined) {
          references.push(...binding.finiteTargets.map(target => ({ module: true, path: target, firstParty: true, nativeRequire: true }))); continue;
        }
        if (!binding.valid || binding.origin === undefined) {
          references.push({ unresolved: true, unresolvedReason: "unresolved first-party createRequire origin" }); continue;
        }
        address.moduleOrigin = binding.origin;
        if (address.specifier?.startsWith(".")) {
          address.path = posix.normalize(posix.join(posix.dirname(binding.origin), address.specifier));
        }
      }
      const nativeModule = builtinSpecifier(address.specifier, address.moduleOrigin ?? path);
      if ((require || ast.kindName(callee) === "KindImportKeyword") && nativeModule === "node:module") {
        computedModuleEntry(node); continue;
      }
      if ((require || ast.kindName(callee) === "KindImportKeyword") && guardedBuiltins.has(nativeModule) &&
        !namespaceUse(node, `${nativeModule}#*`, false)) computedModuleEntry(node);
      if (executionEntry) {
        if (registration && address.specifier?.startsWith(".")) {
          const parentAddress = sourceAddress(ast.arguments(node)[1]);
          if (parentAddress.path !== undefined && parentAddress.urlAddress) Object.assign(address, staticFileAddress(parentAddress.path, address.specifier));
        }
        address.executionEntry = true;
        if (address.specifier !== undefined && !/^[a-z][a-z0-9+.-]*:/iu.test(address.specifier)) address.firstParty = true;
      }
      if (address.unresolved) { references.push(address); continue; }
      if (module && address.literalBaseLoader) {
        references.push({ unresolved: true, unresolvedReason: "unresolved first-party literal URL loader: unsupported whole body or binding" });
      } else if (address.path !== undefined || address.specifier !== undefined || address.firstParty || module && address.suffix !== undefined) {
        if (executionEntry && address.path === undefined && !address.firstParty && address.suffix === undefined) {
          references.push({ external: true, offset: ast.pos(node) }); continue;
        }
        references.push({ ...address, module, fileRead, treeRead: /#cp(?:Sync)?$/u.test(selectedApi), nativeRequire: require, offset: ast.pos(node) });
      } else if (module) references.push({ external: true, offset: ast.pos(node) });
    }
  }
  const ownedTest = ["tsonic/test/", "tsonic-csharp/test/", "tsonic-rust/test/", "csharp-nodejs/nodejs/test/", "rust-nodejs/nodejs/test/"].some(root => path.startsWith(root)) &&
    references.some(reference => reference.module && reference.specifier === "node:test");
  const testEntry = ownedTest && (path.endsWith(".test.mjs") ? "discovery" : entryRole === "native-test-entry" ? "native-launch" : false);
  return { references, testEntry, nativeJavaScript: kind === ScriptKindJS, declarationFile, nativeEntry, entryRole, literalUrlLoaders: Object.freeze(literalUrlLoaders),
    finiteModuleTargets: Object.freeze([...new Set([...moduleBindings.values()].flatMap(binding => binding.finiteTargets ?? []))]) };

  function initializer(declaration) {
    const children = ast.children(declaration);
    return children.at(-1) === ast.name(declaration) ? undefined : children.at(-1);
  }

  function privateConstant(declaration) {
    const statement = ast.parent(ast.parent(declaration));
    return ast.variableDeclarationKind(declaration) === "const" && ast.kindName(statement) === "KindVariableStatement" &&
      ast.kindName(ast.parent(statement)) === "KindSourceFile" && !ast.hasModifierKind(statement, "export");
  }

  function importMetaUrl(node) {
    if (ast.kindName(node) !== "KindPropertyAccessExpression" || ast.text(ast.name(node)) !== "url") return false;
    const meta = ast.children(node)[0];
    return ast.kindName(meta) === "KindMetaProperty" && AsMetaProperty(meta).KeywordToken === KindImportKeyword && ast.text(ast.name(meta)) === "meta";
  }

  function urlBaseDeclaration(node) {
    return variables.get(ast.text(node))?.find(declaration => {
      const construction = initializer(declaration);
      const constructor = ast.children(construction)[0];
      return ast.kindName(construction) === "KindNewExpression" &&
        (ast.kindName(constructor) === "KindIdentifier" && ast.text(constructor) === "URL" || api(constructor) === "node:url#URL");
    });
  }

  function nativeUrlConstructor(node) {
    if (ast.kindName(node) !== "KindIdentifier") return false;
    if (!["URL", "node:url#URL"].includes(api(node))) return false;
    const names = new Set([ast.text(node), ...[...imports].filter(([_name, identity]) => identity === "node:url#URL").map(([name]) => name),
      ...[...patternIdentities].filter(([_element, identity]) => identity === "node:url#URL").map(([element]) => ast.text(ast.name(element)))]);
    if (!variables.has("URL") && !imports.has("URL")) names.add("URL");
    for (const name of names) {
      if (!(identifiers.get(name) ?? []).every(use => {
        if (nonValueName(use)) return true;
        if (!["URL", "node:url#URL"].includes(api(use))) return true;
        const parent = ast.parent(use);
        return ast.kindName(parent) === "KindNewExpression" && ast.children(parent)[0] === use ||
          ast.kindName(parent) === "KindImportSpecifier" && ast.name(parent) === use && imports.get(name) === "node:url#URL" ||
          ast.kindName(parent) === "KindBindingElement" && ast.name(parent) === use && patternIdentities.get(parent) === "node:url#URL";
      })) return false;
    }
    return stableNativeRoot("URL", [...imports].filter(([_name, identity]) => identity === "node:url#*").map(([name]) => name));
  }

  function stableNativeRoot(intrinsic, namespaces = []) {
    const roots = new Set(["globalThis", "global", "self", "window", ...namespaces]);
    return [...roots].every(name => (identifiers.get(name) ?? []).every(use => {
      if (nonValueName(use)) return true;
      if (namespaces.includes(name) && importedApi(use) !== "node:url#*") return true;
      if (!namespaces.includes(name) && !globalObject(use)) return true;
      const parent = ast.parent(use);
      if (["KindImportClause", "KindNamespaceImport"].includes(ast.kindName(parent)) && imports.get(name) === "node:url#*") return true;
      if (!["KindPropertyAccessExpression", "KindElementAccessExpression"].includes(ast.kindName(parent)) || ast.children(parent)[0] !== use) return false;
      const member = ast.kindName(parent) === "KindPropertyAccessExpression" ? ast.text(ast.name(parent))
        : literal(ast.children(parent)[1]) ? ast.text(ast.children(parent)[1]) : undefined;
      return member !== undefined && !roots.has(member) && member !== intrinsic;
    }));
  }

  function computedModuleEntry(node) {
    references.push({ module: true, firstParty: true, computedEntry: true, offset: ast.pos(node) });
  }

  function finiteRequireTargets(declaration) {
    const binding = ast.name(declaration);
    const uses = (identifiers.get(ast.text(binding)) ?? []).filter(use => use !== binding && !nonValueName(use));
    if (uses.length !== 1) return undefined;
    const call = ast.parent(uses[0]);
    const selection = ast.parent(call);
    if (ast.kindName(call) !== "KindCallExpression" || ast.children(call)[0] !== uses[0] || ast.arguments(call).length !== 1 ||
      ast.kindName(selection) !== "KindElementAccessExpression" || ast.children(selection)[0] !== call) return undefined;
    const exportRead = ast.children(selection)[1];
    if (ast.kindName(exportRead) !== "KindPropertyAccessExpression" || ast.text(ast.name(exportRead)) !== "export") return undefined;
    const ownerUse = ast.children(exportRead)[0];
    const owner = constant(ownerUse);
    const ownerValue = initializer(owner);
    if (owner === undefined || ast.kindName(ownerValue) !== "KindElementAccessExpression") return undefined;
    const [tableUse, keyUse] = ast.children(ownerValue);
    const table = constant(tableUse);
    const frozen = initializer(table);
    const freeze = ast.children(frozen)[0];
    if (table === undefined || !privateConstant(table) || ast.kindName(frozen) !== "KindCallExpression" || ast.arguments(frozen).length !== 1 ||
      ast.kindName(freeze) !== "KindPropertyAccessExpression" || ast.text(ast.name(freeze)) !== "freeze" ||
      ast.kindName(ast.children(freeze)[0]) !== "KindIdentifier" || ast.text(ast.children(freeze)[0]) !== "Object" ||
      variables.has("Object") || imports.has("Object") || !stableNativeRoot("Object")) return undefined;
    if (!(identifiers.get("Object") ?? []).every(use => {
      if (nonValueName(use)) return true;
      const member = ast.parent(use);
      const invocation = ast.parent(member);
      return ast.kindName(member) === "KindPropertyAccessExpression" && ast.children(member)[0] === use &&
        ["freeze", "hasOwn"].includes(ast.text(ast.name(member))) && Node_QuestionDotToken(member) === undefined &&
        ast.kindName(invocation) === "KindCallExpression" && ast.children(invocation)[0] === member && Node_QuestionDotToken(invocation) === undefined;
    })) return undefined;
    const rows = ast.arguments(frozen)[0];
    if (ast.kindName(rows) !== "KindObjectLiteralExpression") return undefined;
    const targets = [];
    const keys = new Set();
    for (const row of ast.properties(rows)) {
      const name = ast.name(row);
      const key = ast.kindName(name) === "KindIdentifier" || literal(name) ? ast.text(name) : undefined;
      const value = ast.children(row).at(-1);
      if (ast.kindName(row) !== "KindPropertyAssignment" || !keelWorkspaceRepositories.includes(key) || keys.has(key) ||
        ast.kindName(value) !== "KindObjectLiteralExpression") return undefined;
      keys.add(key);
      const fields = new Map();
      for (const property of ast.properties(value)) {
        const field = ast.name(property);
        const fieldName = ast.kindName(field) === "KindIdentifier" || literal(field) ? ast.text(field) : undefined;
        const fieldValue = ast.children(property).at(-1);
        if (ast.kindName(property) !== "KindPropertyAssignment" || fieldName === undefined || !literal(fieldValue) || fields.has(fieldName)) return undefined;
        fields.set(fieldName, ast.text(fieldValue));
      }
      if (!validLiteralFilePath(fields.get("file")) || typeof fields.get("export") !== "string") return undefined;
      targets.push(`${key}/${fields.get("file")}`);
    }
    if (targets.length === 0) return undefined;
    const target = constant(ast.arguments(call)[0]);
    const address = initializer(target);
    if (target === undefined || !nativeImportedCall(address, "node:path#resolve") ||
      ast.arguments(address).length !== 2) return undefined;
    const [rootUse, fieldUse] = ast.arguments(address);
    if (ast.kindName(fieldUse) !== "KindPropertyAccessExpression" || ast.text(ast.name(fieldUse)) !== "file" ||
      ast.kindName(ast.children(fieldUse)[0]) !== "KindIdentifier" || ast.text(ast.children(fieldUse)[0]) !== ast.text(ast.name(owner))) return undefined;
    const root = constant(rootUse);
    const rooted = initializer(root);
    if (root === undefined || !nativeImportedCall(rooted, "node:path#resolve") ||
      ast.arguments(rooted).length !== 2 || ast.kindName(keyUse) !== "KindIdentifier" || ast.kindName(ast.arguments(rooted)[1]) !== "KindIdentifier" ||
      ast.text(ast.arguments(rooted)[1]) !== ast.text(keyUse)) return undefined;
    const requireRoot = ast.arguments(initializer(declaration))[0];
    if (!nativeImportedCall(requireRoot, "node:path#resolve") ||
      ast.arguments(requireRoot).length !== 2 || ast.kindName(ast.arguments(requireRoot)[0]) !== "KindIdentifier" ||
      ast.text(ast.arguments(requireRoot)[0]) !== ast.text(ast.name(root)) || !literal(ast.arguments(requireRoot)[1]) ||
      ast.text(ast.arguments(requireRoot)[1]) !== "package.json") return undefined;
    const block = ast.parent(ast.parent(ast.parent(owner)));
    const functionNode = ast.parent(block);
    if (ast.kindName(block) !== "KindBlock" || !["KindFunctionDeclaration", "KindFunctionExpression"].includes(ast.kindName(functionNode)) ||
      [root, target, declaration].some(value => ast.parent(ast.parent(ast.parent(value))) !== block)) return undefined;
    const workspaceUse = ast.arguments(rooted)[0];
    const parameters = ast.parameters(functionNode);
    const keyParameter = parameters.find(parameter => ast.kindName(ast.name(parameter)) === "KindIdentifier" && ast.text(ast.name(parameter)) === ast.text(keyUse));
    const workspaceParameter = parameters.find(parameter => ast.kindName(workspaceUse) === "KindIdentifier" &&
      ast.kindName(ast.name(parameter)) === "KindIdentifier" && ast.text(ast.name(parameter)) === ast.text(workspaceUse));
    if (keyParameter === undefined || workspaceParameter === undefined || keyParameter === workspaceParameter || parameters.length !== 2) return undefined;
    const statements = ast.statements(block);
    const guard = statements[statements.indexOf(ast.parent(ast.parent(owner))) - 1];
    const condition = ast.children(guard)[0];
    const branch = ast.children(guard)[1];
    const ownCall = ast.children(condition)[0];
    const ownCallee = ast.children(ownCall)[0];
    const ownArguments = ast.kindName(ownCall) === "KindCallExpression" ? ast.arguments(ownCall) : [];
    if (ast.kindName(guard) !== "KindIfStatement" || ast.children(guard).length !== 2 ||
      ast.kindName(condition) !== "KindPrefixUnaryExpression" || ast.operatorKindName(condition) !== "KindExclamationToken" ||
      ast.kindName(ownCall) !== "KindCallExpression" || Node_QuestionDotToken(ownCall) !== undefined ||
      ast.kindName(ownCallee) !== "KindPropertyAccessExpression" || Node_QuestionDotToken(ownCallee) !== undefined ||
      ast.kindName(ast.children(ownCallee)[0]) !== "KindIdentifier" || ast.text(ast.children(ownCallee)[0]) !== "Object" ||
      ast.text(ast.name(ownCallee)) !== "hasOwn" || ownArguments.length !== 2 ||
      ast.kindName(ownArguments[0]) !== "KindIdentifier" || ast.text(ownArguments[0]) !== ast.text(ast.name(table)) ||
      ast.kindName(ownArguments[1]) !== "KindIdentifier" || ast.text(ownArguments[1]) !== ast.text(keyUse) ||
      !(ast.kindName(branch) === "KindThrowStatement" || ast.kindName(branch) === "KindBlock" && ast.statements(branch).length === 1 && ast.kindName(ast.statements(branch)[0]) === "KindThrowStatement")) return undefined;
    if (!onlyUses(table, use => use === tableUse || use === ownArguments[0]) ||
      !onlyUses(owner, use => ast.kindName(ast.parent(use)) === "KindPropertyAccessExpression" &&
      ast.children(ast.parent(use))[0] === use && ["file", "export", "form"].includes(ast.text(ast.name(ast.parent(use)))) && !mutated(ast.parent(use))) ||
      !onlyUses(root, use => use === rootUse || use === ast.arguments(requireRoot)[0]) ||
      !onlyUses(target, use => !mutated(use))) return undefined;
    if (!(identifiers.get(ast.text(keyUse)) ?? []).every(use => use === ast.name(keyParameter) || use === keyUse || use === ownArguments[1] || use === ast.arguments(rooted)[1] ||
      ast.kindName(ast.parent(use)) === "KindTemplateSpan") ||
      !(identifiers.get(ast.text(workspaceUse)) ?? []).every(use => use === ast.name(workspaceParameter) || use === workspaceUse)) return undefined;
    return Object.freeze(targets);
  }

  function constant(node) {
    if (ast.kindName(node) !== "KindIdentifier") return undefined;
    const declarations = variables.get(ast.text(node));
    return declarations?.length === 1 && ast.variableDeclarationKind(declarations[0]) === "const" ? declarations[0] : undefined;
  }

  function nativeImportedCall(node, expected) {
    const callee = ast.children(node)[0];
    if (ast.kindName(node) !== "KindCallExpression" || importedApi(callee) !== expected) return false;
    const binding = ast.kindName(callee) === "KindIdentifier" ? callee : ast.children(callee)[0];
    if (ast.kindName(binding) !== "KindIdentifier") return false;
    return (identifiers.get(ast.text(binding)) ?? []).every(use => {
      if (nonValueName(use)) return true;
      const parent = ast.parent(use);
      if (["KindImportSpecifier", "KindImportClause", "KindNamespaceImport"].includes(ast.kindName(parent))) return true;
      if (ast.kindName(callee) === "KindIdentifier") return ast.kindName(parent) === "KindCallExpression" && ast.children(parent)[0] === use;
      if (ast.kindName(parent) !== "KindPropertyAccessExpression" || ast.children(parent)[0] !== use || mutated(parent)) return false;
      const invocation = ast.parent(parent);
      return ast.kindName(invocation) === "KindCallExpression" && ast.children(invocation)[0] === parent;
    });
  }

  function onlyUses(declaration, accepted) {
    const name = ast.name(declaration);
    return (identifiers.get(ast.text(name)) ?? []).every(use => use === name || nonValueName(use) || accepted(use));
  }

  function closedUrlValue(declaration) {
    return (identifiers.get(ast.text(ast.name(declaration))) ?? []).every(use => {
      if (use === ast.name(declaration) || nonValueName(use)) return true;
      const parent = ast.parent(use);
      if (ast.kindName(parent) === "KindPropertyAccessExpression" && ast.children(parent)[0] === use && ast.text(ast.name(parent)) === "href") return !mutated(parent);
      if (!["KindCallExpression", "KindNewExpression"].includes(ast.kindName(parent)) || ast.arguments(parent)[0] !== use) return false;
      const callee = ast.children(parent)[0];
      return ast.kindName(callee) === "KindImportKeyword" || ["require", "node:url#fileURLToPath", "node:module#createRequire", "node:worker_threads#Worker", "node:child_process#fork"].includes(api(callee)) ||
        byteReader(api(callee));
    });
  }

  function sourceAddress(node, seen = new Set()) {
    const kindName = ast.kindName(node);
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kindName)) {
      return literalAddress(ast.text(node));
    }
    if (kindName === "KindIdentifier") {
      const name = ast.text(node);
      if (seen.has(name)) return { firstParty: true };
      const declarations = variables.get(name);
      if (declarations?.length === 1) {
        const value = initializer(declarations[0]);
        if (ast.kindName(value) === "KindNewExpression" && ["URL", "node:url#URL"].includes(api(ast.children(value)[0])) &&
          (ast.variableDeclarationKind(declarations[0]) !== "const" || !closedUrlValue(declarations[0]))) {
          return { unresolved: true, firstParty: true, unresolvedReason: "unresolved first-party mutable or escaping URL address" };
        }
      }
      return declarations?.length === 1 && ast.variableDeclarationKind(declarations[0]) === "const"
        ? sourceAddress(initializer(declarations[0]), new Set([...seen, name])) : {};
    }
    if (kindName === "KindParenthesizedExpression" || kindName === "KindPropertyAccessExpression" && ast.text(ast.name(node)) === "href") {
      return sourceAddress(ast.children(node)[0], seen);
    }
    if (importMetaUrl(node)) return { path, firstParty: true, urlAddress: true };
    if (["KindCallExpression", "KindNewExpression"].includes(kindName)) {
      const name = api(ast.children(node)[0]);
      const arguments_ = ast.arguments(node);
      if (["node:url#pathToFileURL", "node:url#fileURLToPath"].includes(name)) {
        const value = sourceAddress(arguments_[0], seen);
        return { ...value, urlAddress: name === "node:url#pathToFileURL" };
      }
      if (["URL", "node:url#URL"].includes(name)) {
        if (!nativeUrlConstructor(ast.children(node)[0]) || ast.kindName(node) !== "KindNewExpression") {
          return { unresolved: true, firstParty: true, unresolvedReason: "unresolved first-party URL constructor write, shadow or escape" };
        }
        const base = arguments_[1];
        const value = sourceAddress(arguments_[0], seen);
        if (ast.kindName(base) === "KindIdentifier" && urlBaseDeclaration(base)) {
          const root = sourceAddress(ast.arguments(initializer(urlBaseDeclaration(base)))[0], seen);
          return { firstParty: true, literalBaseLoader: true, suffix: value.suffix,
            observerEvidence: value.observerEvidence || root.observerEvidence };
        }
        if (!importMetaUrl(base)) return value.firstParty ? { unresolved: true, firstParty: true, unresolvedReason: "unresolved first-party native URL base" } : {};
        if (value.unresolved) return value;
        if (value.specifier !== undefined) return { ...value, ...staticFileAddress(path, value.specifier) };
        return { firstParty: true, suffix: value.suffix, observerEvidence: value.observerEvidence };
      }
      if (["node:path#join", "node:path#resolve"].includes(name)) {
        const values = arguments_.map(argument => sourceAddress(argument, seen));
        if (values[0]?.path !== undefined && values.slice(1).every(value => value.specifier !== undefined && !isAbsolute(value.specifier))) {
          return { path: posix.normalize(posix.join(values[0].path, ...values.slice(1).map(value => value.specifier))), firstParty: true };
        }
        const suffix = [];
        for (const value of [...values].reverse()) {
          if (value.specifier === undefined) break;
          suffix.unshift(value.specifier);
        }
        return { firstParty: Boolean(values[0]?.firstParty || values.some(value => value.observerEvidence)), suffix: suffix.length > 0 ? posix.join(...suffix) : undefined,
          observerEvidence: values.some(value => value.observerEvidence) };
      }
      if (name === "node:path#dirname") {
        const value = sourceAddress(arguments_[0], seen);
        return value.path === undefined ? {} : { path: posix.dirname(value.path), firstParty: true };
      }
    }
    return fragmentAddress(node);
  }

  function literalAddress(specifier) {
    return { specifier, suffix: specifier.replace(/^(?:\.\.?\/)+/u, ""),
      firstParty: specifier.startsWith(".") || specifier.startsWith("#") || referencesCanonicalSource(specifier), observerEvidence: referencesCanonicalSource(specifier) };
  }

  function firstPartyFragment(fragment) {
    return fragment.startsWith(".") || fragment.startsWith("#") || /(?:test|allocation_counts|native-ownership-cost)/u.test(fragment);
  }

  function fragmentAddress(node) {
    const fragments = [];
    const collect = child => {
      if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateHead", "KindTemplateMiddle", "KindTemplateTail"].includes(ast.kindName(child))) fragments.push(ast.text(child));
      ast.forEachChild(child, collect);
    };
    collect(node);
    const kindName = ast.kindName(node);
    const tail = kindName === "KindTemplateExpression" ? ast.children(ast.children(node).at(-1)).at(-1)
      : kindName === "KindBinaryExpression" && ast.operatorKindName(node) === "KindPlusToken" ? ast.children(node).at(-1) : undefined;
    const suffix = ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateTail"].includes(ast.kindName(tail)) ? ast.text(tail) : undefined;
    return { firstParty: fragments.some(firstPartyFragment),
      suffix, observerEvidence: fragments.some(referencesCanonicalSource) };
  }

  function referencesCanonicalSource(text) {
    return [posix.basename(boundary.path), posix.basename(boundary.writerPath),
      `${boundary.repo}/${posix.dirname(boundary.path)}`, `${boundary.writerRepo}/${posix.dirname(boundary.writerPath)}`]
      .some(fragment => text.includes(fragment));
  }
}

