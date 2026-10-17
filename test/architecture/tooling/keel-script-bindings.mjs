import { Node_QuestionDotToken } from "../../../packages/tsts/dist/src/internal/ast/ast.js";
import { AsBindingElement } from "../../../packages/tsts/dist/src/internal/ast/generated/casts.js";

export const guardedBuiltins = new Set(["node:fs", "node:fs/promises", "node:module", "node:process", "node:worker_threads", "node:child_process", "node:vm"]);
const byteEntryMembers = new Set(["readFile", "copyFile", "cp", "createReadStream", "open", "openAsBlob", "link", "symlink", "rename"]
  .flatMap(name => [name, `${name}Sync`]));
export const nodeProcessMembers = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync"]);

export function createKeelScriptBindings({ ast, imports, valueDeclarations, moduleBindings, patternIdentities, patternNames, initializer }) {
  const declarationScopes = new Map();
  return { literal, transparent, byteReader, typeOnlyModuleDeclaration, nonValueName, builtinSpecifier, typeOnlyUse, memberAccess, globalObject, namespaceUse, literalPattern, importedApi, api, resolutionOnlyUse, mutated };

  function literal(node) {
    return ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(node));
  }

  function transparent(node) {
    while (["KindAwaitExpression", "KindParenthesizedExpression", "KindNonNullExpression"].includes(ast.kindName(node))) node = ast.children(node)[0];
    return node;
  }

  function byteReader(identity) {
    if (!identity.startsWith("node:fs#") && !identity.startsWith("node:fs/promises#")) return false;
    return byteEntryMembers.has(identity.slice(identity.indexOf("#") + 1));
  }

  function typeOnlyModuleDeclaration(node) {
    if (ast.isTypeOnlyImportOrExportDeclaration(node)) return true;
    const clause = ast.children(node).find(child => ast.kindName(child) === "KindImportClause");
    if (ast.name(clause) !== undefined) return false;
    const bindings = [];
    const collect = child => {
      if (["KindImportSpecifier", "KindExportSpecifier"].includes(ast.kindName(child))) bindings.push(child);
      else ast.forEachChild(child, collect);
    };
    ast.forEachChild(node, collect);
    return bindings.length > 0 && bindings.every(binding => ast.isTypeOnlyImportOrExportDeclaration(binding));
  }

  function nonValueName(node) {
    const parent = ast.parent(node);
    return ["KindPropertyAccessExpression", "KindPropertyAssignment", "KindPropertyDeclaration", "KindPropertySignature", "KindMethodDeclaration", "KindMethodSignature", "KindGetAccessor", "KindSetAccessor", "KindEnumMember", "KindNamedTupleMember"].includes(ast.kindName(parent)) && ast.name(parent) === node ||
      ast.kindName(parent) === "KindImportSpecifier" && ast.name(parent) !== node ||
      ast.kindName(parent) === "KindBindingElement" && AsBindingElement(parent).PropertyName === node || typeOnlyUse(node);
  }

  function builtinSpecifier(specifier) {
    return ["module", "process", "fs", "fs/promises", "path", "url", "worker_threads", "child_process", "vm"].includes(specifier) ? `node:${specifier}` : specifier;
  }

  function typeOnlyUse(node) {
    for (let current = node; current !== undefined; current = ast.parent(current)) {
      if (ast.isTypeOnlyImportOrExportDeclaration(current)) return true;
      const parent = ast.parent(current);
      if (ast.typeNode(parent) === current || ast.typeArguments(parent).includes(current) || ast.typeParameters(parent).includes(current) ||
        ast.hasModifierKind(parent, "ambient") || ast.isTypeOnlyImportOrExportDeclaration(parent) ||
        ["KindTypeQuery", "KindTypeAliasDeclaration", "KindInterfaceDeclaration", "KindImportType"].includes(ast.kindName(parent))) return true;
      if (["KindStatement", "KindBlock", "KindSourceFile", "KindCallExpression", "KindNewExpression"].includes(ast.kindName(parent))) break;
    }
    return false;
  }

  function bindingScope(declaration) {
    if (declarationScopes.has(declaration)) return declarationScopes.get(declaration);
    let owner = declaration;
    while (["KindBindingElement", "KindObjectBindingPattern", "KindArrayBindingPattern"].includes(ast.kindName(owner))) owner = ast.parent(owner);
    const parameter = ast.kindName(owner) === "KindParameter";
    const functionScoped = parameter || ast.variableDeclarationKind(owner) === "var";
    if (["KindFunctionExpression", "KindClassExpression"].includes(ast.kindName(owner))) {
      declarationScopes.set(declaration, owner); return owner;
    }
    for (let current = ast.parent(owner); current !== undefined; current = ast.parent(current)) {
      const kindName = ast.kindName(current);
      if (["KindSourceFile", "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindConstructor", "KindGetAccessor", "KindSetAccessor"].includes(kindName) ||
        !functionScoped && ["KindBlock", "KindModuleBlock", "KindForStatement", "KindForInStatement", "KindForOfStatement", "KindCatchClause"].includes(kindName)) {
        declarationScopes.set(declaration, current); return current;
      }
    }
    return undefined;
  }

  function shadowed(node) {
    const declarations = valueDeclarations.get(ast.text(node));
    if (declarations === undefined) return false;
    const ancestors = new Set();
    for (let current = node; current !== undefined; current = ast.parent(current)) ancestors.add(current);
    return declarations.some(declaration => ancestors.has(bindingScope(declaration)));
  }

  function memberAccess(node) {
    if (!["KindPropertyAccessExpression", "KindElementAccessExpression"].includes(ast.kindName(node))) return undefined;
    return { receiver: ast.children(node)[0], name: ast.kindName(node) === "KindPropertyAccessExpression" ? ast.text(ast.name(node))
      : literal(ast.children(node)[1]) ? ast.text(ast.children(node)[1]) : undefined };
  }

  function globalObject(node) {
    if (ast.kindName(node) === "KindIdentifier") return ["globalThis", "global", "self", "window"].includes(ast.text(node)) && !imports.has(ast.text(node)) && !shadowed(node);
    const member = memberAccess(node);
    return member !== undefined && ["globalThis", "global", "self", "window"].includes(member.name) && globalObject(member.receiver);
  }

  function namespaceUse(node, namespace, trackedMember = true) {
    let expression = node;
    while (["KindAwaitExpression", "KindParenthesizedExpression", "KindNonNullExpression"].includes(ast.kindName(ast.parent(expression)))) expression = ast.parent(expression);
    const parent = ast.parent(expression);
    if (["KindTypeOfExpression", "KindVoidExpression"].includes(ast.kindName(parent))) return true;
    const member = memberAccess(parent);
    if (member?.receiver === expression) return member.name !== undefined &&
      !["valueOf", "constructor", "__proto__", "prototype"].includes(member.name) &&
      (nonReaderMember(namespace, member.name) || trackedMember && Node_QuestionDotToken(parent) === undefined && !mutated(parent));
    return ast.kindName(parent) === "KindVariableDeclaration" && initializer(parent) === expression && literalPattern(parent);
  }

  function literalPattern(declaration) {
    if (ast.variableDeclarationKind(declaration) !== "const" || ast.kindName(ast.name(declaration)) !== "KindObjectBindingPattern") return false;
    const elements = ast.elements(ast.name(declaration));
    return elements.length > 0 && elements.every(element => {
      const binding = AsBindingElement(element);
      const key = binding?.PropertyName ?? ast.name(element);
      const name = ast.kindName(key) === "KindIdentifier" || literal(key) ? ast.text(key) : undefined;
      if (binding === undefined || binding.DotDotDotToken !== undefined || binding.Initializer !== undefined ||
        ast.kindName(ast.name(element)) !== "KindIdentifier" || name === undefined) return false;
      return !["default", "valueOf", "constructor", "__proto__", "prototype"].includes(name);
    });
  }

  function nonReaderMember(namespace, name) {
    if (["*", "default", "valueOf", "constructor", "__proto__", "prototype"].includes(name)) return false;
    const acquiring = {
      "node:fs#*": ["promises", ...byteEntryMembers],
      "node:fs/promises#*": [...byteEntryMembers],
      "node:module#*": ["createRequire", "register", "registerHooks", "require", "_load", "_preloadModules", "runMain", "Module"],
      "node:process#*": ["getBuiltinModule", "mainModule", "binding", "dlopen"],
      "node:worker_threads#*": ["Worker"],
      "node:child_process#*": ["fork", ...nodeProcessMembers],
    }[namespace] ?? [];
    return namespace !== "node:vm#*" && !acquiring.includes(name);
  }

  function importedApi(node) {
    if (ast.kindName(node) === "KindIdentifier") {
      const name = ast.text(node);
      let imported = imports.get(name);
      if (imported === undefined && !patternNames.has(name) && !["process", "module"].includes(name)) return "";
      const namedDeclarations = valueDeclarations.get(name);
      if (namedDeclarations !== undefined) {
        for (let scope = node; scope !== undefined; scope = ast.parent(scope)) {
          const declarations = namedDeclarations.filter(declaration => bindingScope(declaration) === scope);
          if (declarations.length === 0) continue;
          imported = declarations.length === 1 ? patternIdentities.get(declarations[0]) : undefined;
          return normalizedIdentity(imported ?? "");
        }
      }
      return normalizedIdentity(imported ?? (name === "process" ? "node:process#*" : name === "module" ? "node:module#*" : ""));
    }
    const member = memberAccess(node);
    if (member?.name !== undefined) {
      if (["process", "module"].includes(member.name) && globalObject(member.receiver)) return `node:${member.name}#*`;
      const imported = importedApi(member.receiver);
      if (imported === "node:fs#*" && member.name === "promises") return "node:fs/promises#*";
      if (imported.endsWith("#*") && member.name === "default") return imported;
      if (imported.endsWith("#*")) return `${imported.slice(0, -1)}${member.name}`;
    }
    return "";
  }

  function api(node) {
    const imported = importedApi(node);
    if (imported !== "") return imported;
    const member = memberAccess(node);
    if (["require", "eval", "Function"].includes(member?.name) && globalObject(member.receiver)) return member.name;
    if (ast.kindName(node) !== "KindIdentifier") return "";
    const name = ast.text(node);
    return moduleBindings.has(name) ? "require" : ["URL", "require", "eval", "Function"].includes(name) && !imports.has(name) && !shadowed(node) ? name : "";
  }

  function normalizedIdentity(identity) {
    return identity === "node:fs#promises" ? "node:fs/promises#*" : identity.endsWith("#default") ? `${identity.slice(0, -7)}*` : identity;
  }

  function resolutionOnlyUse(node) {
    const parent = ast.parent(node);
    const call = ast.parent(parent);
    if (ast.kindName(parent) === "KindPropertyAccessExpression" && ast.children(parent)[0] === node &&
      ast.text(ast.name(parent)) === "resolve" && ast.kindName(call) === "KindCallExpression" && ast.children(call)[0] === parent &&
      Node_QuestionDotToken(parent) === undefined && Node_QuestionDotToken(call) === undefined) return true;
    return false;
  }

  function mutated(node) {
    let current = node;
    for (;;) {
      const parent = ast.parent(current);
      const kind = ast.kindName(parent);
      if (kind === "KindBinaryExpression") return ast.children(parent)[0] === current && [
        "KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken", "KindAsteriskAsteriskEqualsToken",
        "KindSlashEqualsToken", "KindPercentEqualsToken", "KindLessThanLessThanEqualsToken", "KindGreaterThanGreaterThanEqualsToken",
        "KindGreaterThanGreaterThanGreaterThanEqualsToken", "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken",
        "KindAmpersandAmpersandEqualsToken", "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken",
      ].includes(ast.operatorKindName(parent));
      if (["KindPrefixUnaryExpression", "KindPostfixUnaryExpression"].includes(kind)) return /PlusPlus|MinusMinus/u.test(ast.operatorKindName(parent) ?? "");
      if (kind === "KindDeleteExpression") return true;
      if (["KindForInStatement", "KindForOfStatement"].includes(kind)) return ast.children(parent)[0] === current;
      if (!["KindParenthesizedExpression", "KindAsExpression", "KindTypeAssertion", "KindTypeAssertionExpression", "KindNonNullExpression", "KindSatisfiesExpression", "KindArrayLiteralExpression", "KindObjectLiteralExpression", "KindPropertyAssignment", "KindShorthandPropertyAssignment", "KindSpreadElement", "KindSpreadAssignment"].includes(kind)) return false;
      current = parent;
    }
  }

}
