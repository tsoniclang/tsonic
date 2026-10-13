import { createHash } from "node:crypto";
import { createCompilerSessionFromFiles, getBundledLibraryClosure } from "../../../packages/tsts/dist/src/index.js";
import { analyzeCheckedTypeScriptModules } from "./module-graph.mjs";

const namedKinds = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindVariableDeclaration", "KindParameter", "KindParameterDeclaration",
  "KindInterfaceDeclaration", "KindTypeAliasDeclaration", "KindClassDeclaration",
  "KindMethodDeclaration", "KindMethodSignature", "KindPropertySignature",
  "KindPropertyDeclaration", "KindPropertyAssignment", "KindGetAccessor",
  "KindSetAccessor", "KindEnumDeclaration", "KindEnumMember",
  "KindImportSpecifier", "KindImportClause",
]);
const functionKinds = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindGetAccessor", "KindSetAccessor",
]);
const loopKinds = new Set([
  "KindWhileStatement", "KindDoStatement", "KindForStatement",
  "KindForInStatement", "KindForOfStatement",
]);

export function keelDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function keelSymbolIdentity(reference) {
  return `${reference.file}#${reference.symbol}`;
}

export function analyzeKeelTypeScript(sourceFiles, {
  resolveReferences = true, declarationFiles = new Map(), modulePaths = {},
} = {}) {
  if (sourceFiles.size === 0) return Object.freeze(Object.fromEntries([
    "declarations", "functions", "calls", "accesses", "loops", "comparisons",
    "assertions", "throws", "edges", "suppressions", "stringLiterals", "mutations", "objectFields", "typedDeclarations", "moduleFiles",
  ].map(name => [name, Object.freeze([])])));
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/keel",
    files: new Map([...declarationFiles, ...sourceFiles].map(([file, text]) => [`/keel/${file}`, text])),
    rootFiles: [...sourceFiles.keys()],
    compilerOptions: {
      module: "esnext", moduleResolution: "bundler", target: "esnext",
      noLib: !resolveReferences, ...(resolveReferences ? { lib: ["es2022"] } : {}),
      skipLibCheck: true, strict: true, allowJs: true,
      baseUrl: "/keel", paths: modulePaths,
    },
  });
  const source = session.checkSource();
  const ast = source.ast;
  const declarations = [];
  const byNode = new Map();
  const files = new Map();
  const functions = [];
  const calls = [];
  const accesses = [];
  const loops = [];
  const comparisons = [];
  const assertions = [];
  const suppressions = [];
  const stringLiterals = [];
  const throws = [];
  const moduleAnalysis = analyzeCheckedTypeScriptModules(source, sourceFiles, "/keel/");
  const edges = moduleAnalysis.edges;
  const mutations = [];
  const objectFields = [];
  const typedDeclarations = [];
  const typeOrigins = new WeakMap();
  const libraryFiles = new Map(resolveReferences ? getBundledLibraryClosure(["lib.es2022.d.ts"])
    .map(library => [library.path, `libraries/${library.name}`]) : []);
  const syntaxErrors = session.getDiagnostics("syntactic");
  if (syntaxErrors.length !== 0) {
    throw new Error(`Keel source inventory contains ${syntaxErrors.length} syntactic diagnostics.`);
  }

  for (const sourceFile of source.sourceFiles) {
    const absolute = ast.getFileName(sourceFile);
    const file = absolute.startsWith("/keel/") ? absolute.slice("/keel/".length) : libraryFiles.get(absolute);
    if (file === undefined) continue;
    if (sourceFiles.has(file)) files.set(file, sourceFile);
    const bytes = Buffer.from(ast.getSourceText(sourceFile));
    for (const directive of sourceFile.CommentDirectives ?? []) {
      const comment = bytes.subarray(directive.Loc.pos, directive.Loc.end).toString("utf8");
      if (!/@ts-ignore\b/u.test(comment)) continue;
      suppressions.push(Object.freeze({
        file, owner: "type-check suppression", offset: directive.Loc.pos,
        bodySha256: keelDigest(comment),
      }));
    }
    walk(sourceFile, node => {
      if (!namedKinds.has(ast.kindName(node))) return;
      const symbol = declarationName(node);
      if (symbol === undefined) return;
      const range = ast.authoredRange(node);
      if (range.kind !== "authored") return;
      const row = Object.freeze({
        file, symbol, kind: ast.kindName(node), offset: range.start,
        functionProperty: ["KindPropertySignature", "KindPropertyDeclaration"].includes(ast.kindName(node)) &&
          ast.kindName(ast.typeNode(node)) === "KindFunctionType",
        bodySha256: keelDigest(authoredText(node)),
        exported: exported(node),
        parameters: Object.freeze((functionKinds.has(ast.kindName(node)) || ast.kindName(node) === "KindMethodSignature"
          ? ast.parameters(node) : []).map(parameter => nameText(ast.name(parameter)))),
        literal: ast.kindName(node) === "KindVariableDeclaration"
          ? literalText(ast.as.AsVariableDeclaration(node)?.Initializer) : undefined,
      });
      declarations.push(row);
      byNode.set(node, row);
      if (sourceFiles.has(file) && functionKinds.has(row.kind) && ast.body(node) !== undefined) functions.push(row);
    });
  }

  for (const [file, sourceFile] of files) {
    const checker = resolveReferences ? source.getSourceFileQueries(sourceFile).checker : undefined;
    walk(sourceFile, node => {
      const kind = ast.kindName(node);
      const owner = owningFunction(node);
      const base = location(file, node, owner);
      if (namedKinds.has(kind)) {
        const type = ast.typeNode(node);
        if (type !== undefined) {
          const references = [];
          walk(type, child => {
            if (ast.kindName(child) === "KindIdentifier") references.push(...origins(checker, child));
          });
          const declaration = declarationFor(node);
          if (declaration !== undefined) typedDeclarations.push(Object.freeze({
            ...declaration, kind, through: Object.freeze(references),
          }));
        }
      }
      if (kind === "KindStringLiteral" || kind === "KindNoSubstitutionTemplateLiteral") {
        stringLiterals.push(Object.freeze({ file, text: ast.text(node), offset: base.offset }));
      }
      if (kind === "KindObjectLiteralExpression" && checker !== undefined) {
        const contextual = checker.getContextualType(node);
        if (contextual !== undefined) for (const property of ast.properties(node)) {
          const name = ast.name(property);
          if (name === undefined || !["KindIdentifier", "KindStringLiteral"].includes(ast.kindName(name))) continue;
          const symbol = checker.getPropertyOfType(contextual, ast.text(name));
          const declaration = symbol === undefined ? undefined
            : checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
          objectFields.push(Object.freeze({
            ...location(file, property, owner), target: declarationFor(declaration),
            literal: literalText(ast.kindName(property) === "KindPropertyAssignment"
              ? ast.as.AsPropertyAssignment(property)?.Initializer : undefined),
          }));
        }
      }
      if (kind === "KindCallExpression" || kind === "KindNewExpression") {
        const expression = kind === "KindCallExpression"
          ? ast.as.AsCallExpression(node)?.Expression : ast.as.AsNewExpression(node)?.Expression;
        const signature = checker?.getResolvedSignature(node);
        const target = signature === undefined ? undefined
          : declarationFor(checker.getSignatureDeclaration(signature));
        calls.push(Object.freeze({
          ...base, kind: kind === "KindNewExpression" ? "construct" : "call",
          target, access: Object.freeze(accessPath(expression)),
          through: Object.freeze(origins(checker, expression)),
          expressionTarget: symbolFor(checker, expression),
          arguments: Object.freeze(ast.arguments(node).map(argument => Object.freeze({
            kind: ast.kindName(argument), text: literalText(argument),
            access: Object.freeze(accessPath(argument)), target: symbolFor(checker, argument),
          }))),
        }));
      }
      if (kind === "KindPropertyAccessExpression" || kind === "KindElementAccessExpression") {
        accesses.push(Object.freeze({
          ...base, target: symbolFor(checker, node), access: Object.freeze(accessPath(node)),
          through: Object.freeze(origins(checker, node)),
        }));
      }
      if (loopKinds.has(kind)) loops.push(Object.freeze({ ...base, kind }));
      if (kind === "KindBinaryExpression") {
        const binary = ast.as.AsBinaryExpression(node);
        comparisons.push(Object.freeze({
          ...base, operator: ast.operatorKindName(node),
          left: operand(checker, binary?.Left), right: operand(checker, binary?.Right),
        }));
        if (/Assignment|EqualsToken$/u.test(ast.operatorKindName(node) ?? "") &&
          !/EqualsEquals/u.test(ast.operatorKindName(node) ?? "")) mutations.push(Object.freeze(base));
      }
      if (kind === "KindCaseClause") {
        const statement = ast.parent(ast.parent(node));
        if (ast.kindName(statement) === "KindSwitchStatement") comparisons.push(Object.freeze({
          ...base, operator: "case", left: operand(checker, ast.as.AsSwitchStatement(statement)?.Expression),
          right: operand(checker, ast.as.AsCaseOrDefaultClause(node)?.Expression),
        }));
      }
      if ((kind === "KindPrefixUnaryExpression" || kind === "KindPostfixUnaryExpression") &&
        /PlusPlus|MinusMinus/u.test(ast.operatorKindName(node) ?? "")) mutations.push(Object.freeze(base));
      if (kind === "KindAsExpression" || kind === "KindTypeAssertion") {
        const typeNode = ast.typeNode(node);
        if (typeNode !== undefined && ast.kindName(typeNode) === "KindAnyKeyword") {
          assertions.push(Object.freeze({ ...base, kind: "any-assertion" }));
        }
      }
      if (kind === "KindThrowStatement") throws.push(Object.freeze(base));
    });
  }

  return Object.freeze({
    declarations: Object.freeze(declarations), functions: Object.freeze(functions),
    calls: Object.freeze(calls), accesses: Object.freeze(accesses), loops: Object.freeze(loops),
    comparisons: Object.freeze(comparisons), assertions: Object.freeze(assertions),
    throws: Object.freeze(throws), edges: Object.freeze(edges),
    suppressions: Object.freeze(suppressions),
    stringLiterals: Object.freeze(stringLiterals),
    mutations: Object.freeze(mutations),
    objectFields: Object.freeze(objectFields),
    typedDeclarations: Object.freeze(typedDeclarations),
    moduleFiles: Object.freeze(moduleAnalysis.modules.map(entry => entry.file)),
  });

  function walk(node, visit) {
    visit(node);
    ast.forEachChild(node, child => walk(child, visit));
  }

  function authoredText(node) {
    const range = ast.authoredRange(node);
    if (range.kind !== "authored") return "";
    return ast.getSourceText(ast.getSourceFile(node)).slice(range.start, range.end);
  }

  function declarationName(node) {
    const names = [];
    for (let current = node; current !== undefined; current = ast.parent(current)) {
      if (!namedKinds.has(ast.kindName(current))) continue;
      const name = ast.name(current);
      if (name !== undefined) names.unshift(nameText(name));
    }
    return names.length === 0 ? undefined : names.join(".");
  }

  function exported(node) {
    for (let current = node; current !== undefined; current = ast.parent(current)) {
      if (ast.hasModifierKind(current, "export")) return true;
      if (current !== node && functionKinds.has(ast.kindName(current))) return false;
    }
    return false;
  }

  function nameText(node) {
    if (node === undefined) return "";
    return ["KindIdentifier", "KindPrivateIdentifier", "KindStringLiteral", "KindNumericLiteral"].includes(ast.kindName(node))
      ? ast.text(node) : authoredText(node);
  }

  function owningFunction(node) {
    for (let current = ast.parent(node); current !== undefined; current = ast.parent(current)) {
      const row = byNode.get(current);
      if (row !== undefined && functionKinds.has(row.kind)) return row.symbol;
    }
    return "<module>";
  }

  function declarationFor(node) {
    if (node === undefined) return undefined;
    const known = byNode.get(node);
    if (known !== undefined) return Object.freeze({ file: known.file, symbol: known.symbol });
    const absolute = ast.getFileName(ast.getSourceFile(node));
    const symbol = declarationName(node);
    const file = absolute.startsWith("/keel/") ? absolute.slice("/keel/".length) : libraryFiles.get(absolute);
    return file !== undefined && symbol !== undefined ? Object.freeze({ file, symbol }) : undefined;
  }

  function symbolFor(checker, node) {
    if (checker === undefined || node === undefined || !["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression"].includes(ast.kindName(node))) {
      return undefined;
    }
    const symbol = ast.kindName(node) === "KindIdentifier" ? checker.getLexicallyResolvedSymbol(node) : checker.getResolvedSymbolOrNil(node);
    if (symbol === undefined) return undefined;
    return declarationFor(checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol));
  }

  function origins(checker, node, seen = new Set()) {
    if (checker === undefined || node === undefined || seen.has(node)) return [];
    seen.add(node);
    const result = [];
    const selected = symbolFor(checker, node);
    if (selected !== undefined) result.push(selected);
    const kind = ast.kindName(node);
    if (["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression"].includes(kind)) {
      const type = checker.getTypeAtLocation(node);
      if (type !== undefined) result.push(...checkedTypeOrigins(checker, source.getSourceFileQueries(ast.getSourceFile(node)).typeShape, type));
    }
    if (kind === "KindPropertyAccessExpression") result.push(...origins(checker, ast.as.AsPropertyAccessExpression(node)?.Expression, seen));
    if (kind === "KindElementAccessExpression") result.push(...origins(checker, ast.as.AsElementAccessExpression(node)?.Expression, seen));
    if (kind === "KindIdentifier") {
      const symbol = checker.getLexicallyResolvedSymbol(node);
      const declaration = symbol === undefined ? undefined
        : checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
      if (declaration !== undefined) {
        if (["KindImportSpecifier", "KindImportClause"].includes(ast.kindName(declaration))) {
          const alias = checker.getAliasedSymbol(symbol);
          const resolved = alias === undefined ? undefined : declarationFor(
            checker.getSymbolValueDeclaration(alias) ?? checker.getPrimarySymbolDeclaration(alias));
          if (resolved !== undefined) result.push(resolved);
        }
        const type = ast.typeNode(declaration);
        if (type !== undefined) walk(type, child => {
          if (ast.kindName(child) === "KindIdentifier") result.push(...origins(checker, child, seen));
        });
        if (ast.kindName(declaration) === "KindVariableDeclaration" && ast.variableDeclarationKind(declaration) === "const") {
          result.push(...origins(checker, ast.as.AsVariableDeclaration(declaration)?.Initializer, seen));
        }
      }
    }
    return [...new Map(result.map(reference => [keelSymbolIdentity(reference), reference])).values()];
  }

  function checkedTypeOrigins(checker, shapes, type) {
    const cached = typeOrigins.get(type);
    if (cached !== undefined) return cached;
    const references = [];
    const visited = new Set();
    visit(type);
    const result = Object.freeze([...new Map(references.map(reference => [keelSymbolIdentity(reference), reference])).values()]);
    typeOrigins.set(type, result);
    return result;

    function visit(current) {
      if (current === undefined || visited.has(current)) return;
      visited.add(current);
      for (const symbol of [checker.getTypeSymbol(current), checker.getTypeAliasSymbol(current)]) {
        if (symbol === undefined) continue;
        const reference = declarationFor(checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol));
        if (reference !== undefined) references.push(reference);
      }
      if (shapes.isTypeReference(current)) for (const argument of shapes.getTypeArguments(current)) visit(argument);
      if (shapes.isUnion(current) || shapes.isIntersection(current)) for (const member of shapes.getUnionOrIntersectionTypes(current)) visit(member);
    }
  }

  function accessPath(node) {
    if (node === undefined) return [];
    const kind = ast.kindName(node);
    if (kind === "KindIdentifier") return [ast.text(node)];
    if (kind === "KindPropertyAccessExpression") {
      const property = ast.as.AsPropertyAccessExpression(node);
      return [...accessPath(property?.Expression), ast.text(ast.name(node))];
    }
    if (kind === "KindElementAccessExpression") {
      const element = ast.as.AsElementAccessExpression(node);
      const index = element?.ArgumentExpression;
      return index !== undefined && ast.kindName(index) === "KindStringLiteral"
        ? [...accessPath(element?.Expression), ast.text(index)] : [];
    }
    return [];
  }

  function literalText(node) {
    if (node === undefined) return undefined;
    return ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindNumericLiteral"].includes(ast.kindName(node))
      ? ast.text(node) : undefined;
  }

  function operand(checker, node) {
    return Object.freeze({
      literal: node === undefined ? undefined : literalText(node),
      target: symbolFor(checker, node), access: Object.freeze(accessPath(node)),
      through: Object.freeze(origins(checker, node)),
    });
  }

  function location(file, node, owner) {
    const range = ast.authoredRange(node);
    return Object.freeze({
      file, owner, offset: range.kind === "authored" ? range.start : -1,
      bodySha256: keelDigest(authoredText(node)),
    });
  }
}
