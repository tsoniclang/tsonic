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
const typeArgumentKinds = new Set([
  "KindCallExpression", "KindNewExpression", "KindTaggedTemplateExpression",
  "KindTypeReference", "KindExpressionWithTypeArguments", "KindImportType",
  "KindTypeQuery", "KindJsxOpeningElement", "KindJsxSelfClosingElement",
]);
const providerMetadataRoots = new Set([
  "ExtensionEvidence", "ProviderIdentity", "ProviderDeclarationKind", "ProviderExportKind",
  "ProviderTypeFamilyDeclaration", "ProviderPropertyName", "ProviderTypeParameterDeclaration",
  "ProviderTypeExpression", "ProviderParameterDeclaration", "ProviderSignatureDeclaration",
  "ProviderMemberDeclaration", "ProviderExportDeclaration", "ProviderImportDeclaration",
  "ProviderHeritageDeclaration", "ProviderDeclarationModel", "ProviderRequestedExport",
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
    "declarations", "functions", "calls", "accesses", "valueReads", "loops", "comparisons",
    "assertions", "throws", "edges", "suppressions", "stringLiterals", "mutations", "objectFields", "typedDeclarations", "moduleFiles", "selectionExports",
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
  const valueReads = [];
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
  const selectionExports = [];
  const typeOrigins = new WeakMap();
  const boundaryTypeOrigins = new WeakMap();
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
    const moduleSymbol = checker?.getSymbolAtLocation(sourceFile);
    if (moduleSymbol !== undefined) {
      for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
        const name = checker.getSymbolName(exportedSymbol);
        if (!name.startsWith("select") && !name.startsWith("choose")) continue;
        const aliases = checker.getSymbolDeclarations(exportedSymbol).some(declaration =>
          ["KindImportSpecifier", "KindImportClause", "KindExportSpecifier", "KindNamespaceImport", "KindNamespaceExport"]
            .includes(ast.kindName(declaration)));
        const symbol = aliases ? checker.getAliasedSymbol(exportedSymbol) : exportedSymbol;
        if (symbol === undefined) {
          selectionExports.push(Object.freeze({ file, symbol: name, target: undefined }));
          continue;
        }
        const type = checker.getTypeOfSymbol(symbol);
        const shapes = source.getSourceFileQueries(sourceFile).typeShape;
        if (type === undefined || shapes.isAny(type) || shapes.isUnknown(type)) {
          selectionExports.push(Object.freeze({ file, symbol: name, target: undefined }));
          continue;
        }
        const declaration = checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
        const references = [declarationFor(declaration), ...(declaration === undefined ? [] : origins(checker, ast.name(declaration)))];
        const implementation = references.find(reference => reference !== undefined && functions.some(entry =>
          keelSymbolIdentity(entry) === keelSymbolIdentity(reference)));
        if (implementation !== undefined) {
          selectionExports.push(Object.freeze({ file, symbol: name, target: implementation }));
          continue;
        }
        for (const signature of checker.getCallSignaturesOfType(type)) {
          selectionExports.push(Object.freeze({
            file, symbol: name, target: declarationFor(checker.getSignatureDeclaration(signature)),
          }));
        }
      }
    }
    walk(sourceFile, node => {
      const kind = ast.kindName(node);
      const owner = owningFunction(node);
      const base = location(file, node, owner);
      if (namedKinds.has(kind)) {
        const types = [ast.typeNode(node), ...(["KindInterfaceDeclaration", "KindClassDeclaration"].includes(kind)
          ? [...ast.extendsHeritageElements(node), ...ast.implementsHeritageElements(node)] : [])]
          .filter(type => type !== undefined);
        if (types.length > 0) {
          const references = [];
          for (const type of types) {
            walk(type, child => {
              if (ast.kindName(child) === "KindIdentifier") references.push(...origins(checker, child));
            });
            const checkedType = checker?.getTypeAtLocation(type);
            if (checkedType !== undefined) references.push(...checkedTypeOrigins(checker,
              source.getSourceFileQueries(sourceFile).typeShape, checkedType, true));
          }
          const declaration = declarationFor(node);
          if (declaration !== undefined) typedDeclarations.push(Object.freeze({
            ...declaration, kind, through: Object.freeze(references),
            receiverThrough: Object.freeze(origins(checker, ast.name(node), new Set(), true)),
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
          receiverThrough: Object.freeze(origins(checker, expression, new Set(), true)),
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
          receiverThrough: Object.freeze(origins(checker, node, new Set(), true)),
        }));
      }
      if (["KindIdentifier", "KindThisKeyword", "KindSuperKeyword"].includes(kind) && isValueRead(node)) {
        const checkedType = checker?.getTypeAtLocation(node);
        valueReads.push(Object.freeze({
          ...base, target: symbolFor(checker, node),
          through: Object.freeze([...origins(checker, node, new Set(), true),
            ...(checkedType === undefined ? [] : checkedTypeOrigins(checker,
              source.getSourceFileQueries(sourceFile).typeShape, checkedType, true))]),
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

  const metadataDeclarations = providerMetadataDeclarations();
  return Object.freeze({
    declarations: Object.freeze(declarations.map(declaration => metadataDeclarations.has(keelSymbolIdentity(declaration))
      ? Object.freeze({ ...declaration, providerMetadata: true }) : declaration)),
    functions: Object.freeze(functions),
    calls: Object.freeze(calls), accesses: Object.freeze(accesses),
    valueReads: Object.freeze(valueReads), loops: Object.freeze(loops),
    comparisons: Object.freeze(comparisons), assertions: Object.freeze(assertions),
    throws: Object.freeze(throws), edges: Object.freeze(edges),
    suppressions: Object.freeze(suppressions),
    stringLiterals: Object.freeze(stringLiterals),
    mutations: Object.freeze(mutations),
    objectFields: Object.freeze(objectFields),
    typedDeclarations: Object.freeze(typedDeclarations),
    moduleFiles: Object.freeze(moduleAnalysis.modules.map(entry => entry.file)),
    selectionExports: Object.freeze(selectionExports),
  });

  function providerMetadataDeclarations() {
    const eligible = new Set();
    if (!resolveReferences) return eligible;
    const publicRoot = "external/tsonic/packages/tsts/dist/";
    const providerFile = `${publicRoot}src/extensions/host.d.ts`;
    const nodes = new Map([...byNode].map(([node, row]) => [keelSymbolIdentity(row), { node, row }]));
    const pending = [];
    for (const [node, row] of byNode) {
      if (row.file.startsWith("src/target-model/syntax/") && row.kind === "KindTypeAliasDeclaration") {
        const { checker, typeShape } = source.getSourceFileQueries(ast.getSourceFile(node));
        if (finite(typeShape, checker.getTypeAtLocation(node))) eligible.add(keelSymbolIdentity(row));
      }
      if (row.file !== providerFile || !declarationFiles.has(row.file) ||
        !providerMetadataRoots.has(row.symbol.split(".")[0])) continue;
      eligible.add(keelSymbolIdentity(row));
      const { checker, typeShape } = source.getSourceFileQueries(ast.getSourceFile(node));
      pending.push(...annotationOrigins(checker, node, new Set(), false));
      if (!providerMetadataRoots.has(row.symbol) ||
        !["KindInterfaceDeclaration", "KindTypeAliasDeclaration"].includes(row.kind)) continue;
      const symbol = checker.getSymbolAtLocation(ast.name(node));
      const type = symbol === undefined ? undefined : checker.getDeclaredTypeOfSymbol(symbol);
      if (type !== undefined) pending.push(...checkedTypeOrigins(checker, typeShape, type, true));
    }
    const visited = new Set();
    while (pending.length > 0) {
      const identity = keelSymbolIdentity(pending.pop());
      if (visited.has(identity)) continue;
      visited.add(identity);
      const candidate = nodes.get(identity);
      if (candidate === undefined || !candidate.row.file.startsWith(publicRoot) ||
        !declarationFiles.has(candidate.row.file)) continue;
      const { node, row } = candidate;
      const { checker, typeShape } = source.getSourceFileQueries(ast.getSourceFile(node));
      const type = checker.getTypeAtLocation(node);
      const elements = typeShape.isTuple(type) ? typeShape.getTupleElementInfos(type) : [];
      const properties = elements.length === 0 && row.kind !== "KindInterfaceDeclaration"
        ? [] : typeShape.getPropertyInfos(type);
      const fields = properties.map(property => checker.getSymbolValueDeclaration(property.symbol) ??
        checker.getPrimarySymbolDeclaration(property.symbol));
      const finiteAlias = row.kind === "KindTypeAliasDeclaration" && finite(typeShape, type);
      const literalTable = row.kind === "KindVariableDeclaration" && ast.variableDeclarationKind(node) === "const" &&
        elements.length > 0 && elements.every((element, index) => element.elementKind === "required" &&
          finite(typeShape, element.type) && properties.some(property => property.name === String(index) && property.readonly));
      const scalarRecord = row.kind === "KindInterfaceDeclaration" && properties.length > 0 &&
        typeShape.getSignatureInfos(type, "call").length === 0 && typeShape.getSignatureInfos(type, "construct").length === 0 &&
        typeShape.getIndexInfos(type).length === 0 && properties.every((property, index) =>
          property.readonly && finite(typeShape, property.type, true) &&
          ast.kindName(fields[index]) === "KindPropertySignature" && ast.parent(fields[index]) === node);
      if (!finiteAlias && !literalTable && !scalarRecord) continue;
      eligible.add(identity);
      if (scalarRecord) for (const field of fields) eligible.add(keelSymbolIdentity(declarationFor(field)));
      pending.push(...annotationOrigins(checker, node, new Set(), false));
    }
    return eligible;

    function finite(shapes, type, allowPrimitive = false) {
      const members = shapes.isUnion(type) ? shapes.getUnionOrIntersectionTypes(type) : [type];
      return members.length > 0 && members.every(member => shapes.getStringLiteralTypeValue(member) !== undefined ||
        shapes.getNumericLiteralTypeValue(member) !== undefined || shapes.getBooleanLiteralTypeValue(member) !== undefined ||
        (allowPrimitive && (shapes.isStringLike(member) || shapes.isNumberLike(member) || shapes.isBooleanLike(member) ||
          shapes.isBigIntLike(member) || shapes.isNullish(member))));
    }
  }

  function walk(node, visit) {
    if (visit(node) === false) return;
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
      const kind = ast.kindName(current);
      if (!namedKinds.has(kind)) continue;
      const name = ast.name(current);
      if (name !== undefined) {
        const accessor = kind === "KindGetAccessor" ? ".<get>" : kind === "KindSetAccessor" ? ".<set>" : "";
        names.unshift(`${nameText(name)}${accessor}`);
      } else if (["KindArrowFunction", "KindFunctionExpression", "KindFunctionDeclaration"].includes(kind) && !callableHasDirectBinding(current)) {
        const range = ast.authoredRange(current);
        if (range.kind === "authored") names.unshift(`<${kind.slice(4)}@${range.start}>`);
      }
    }
    return names.length === 0 ? undefined : names.join(".");
  }

  function callableHasDirectBinding(node) {
    let value = node;
    let parent = ast.parent(value);
    while (["KindParenthesizedExpression", "KindAsExpression", "KindNonNullExpression", "KindSatisfiesExpression",
      "KindTypeAssertionExpression"].includes(ast.kindName(parent)) && parent.Expression === value) {
      value = parent;
      parent = ast.parent(value);
    }
    return ["KindVariableDeclaration", "KindPropertyAssignment", "KindParameter", "KindParameterDeclaration"]
      .includes(ast.kindName(parent)) && parent.Initializer === value && ast.name(parent) !== undefined;
  }

  function exported(node) {
    for (let current = node; current !== undefined; current = ast.parent(current)) {
      if (current !== node && functionKinds.has(ast.kindName(current))) return false;
      if (ast.hasModifierKind(current, "export")) return true;
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

  function isValueRead(node) {
    const parent = ast.parent(node);
    if (parent === undefined || (ast.name(parent) === node &&
      ast.kindName(parent) !== "KindShorthandPropertyAssignment")) return false;
    const parentKind = ast.kindName(parent);
    if ((parentKind === "KindLabeledStatement" && ast.as.AsLabeledStatement(parent)?.Label === node) ||
      (parentKind === "KindBreakStatement" && ast.as.AsBreakStatement(parent)?.Label === node) ||
      (parentKind === "KindContinueStatement" && ast.as.AsContinueStatement(parent)?.Label === node)) return false;
    if (ast.kindName(parent) === "KindBindingElement" &&
      ast.as.AsBindingElement(parent)?.PropertyName === node) return false;
    for (let child = node, ancestor = parent; ancestor !== undefined;
      child = ancestor, ancestor = ast.parent(ancestor)) {
      const kind = ast.kindName(ancestor);
      if (ast.typeNode(ancestor) === child ||
        (typeArgumentKinds.has(kind) && ast.typeArguments(ancestor).includes(child))) return false;
      if (["KindImportDeclaration", "KindImportEqualsDeclaration", "KindExportDeclaration", "KindTypeParameter"].includes(kind)) return false;
      if (kind === "KindExpressionWithTypeArguments") {
        const declaration = ast.parent(ast.parent(ancestor));
        const declarationKind = ast.kindName(declaration);
        if (declarationKind === "KindInterfaceDeclaration" ||
          (["KindClassDeclaration", "KindClassExpression"].includes(declarationKind) &&
            ast.implementsHeritageElements(declaration).includes(ancestor))) return false;
      }
    }
    return true;
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

  function origins(checker, node, seen = new Set(), receiverOnly = false) {
    if (checker === undefined || node === undefined || seen.has(node)) return [];
    seen.add(node);
    const result = [];
    const selected = symbolFor(checker, node);
    if (selected !== undefined) result.push(selected);
    const kind = ast.kindName(node);
    let type;
    let shapes;
    if (["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression", "KindThisKeyword", "KindSuperKeyword"].includes(kind)) {
      type = checker.getTypeAtLocation(node);
      shapes = source.getSourceFileQueries(ast.getSourceFile(node)).typeShape;
      if (type !== undefined) result.push(...checkedTypeOrigins(checker, shapes, type));
    }
    if (["KindPropertyAccessExpression", "KindElementAccessExpression"].includes(kind)) {
      const receiver = kind === "KindPropertyAccessExpression"
        ? ast.as.AsPropertyAccessExpression(node)?.Expression : ast.as.AsElementAccessExpression(node)?.Expression;
      if (!receiverOnly || selected === undefined || type === undefined || shapes.isAny(type) || shapes.isUnknown(type) ||
        checker.getCallSignaturesOfType(type).length !== 0) {
        result.push(...origins(checker, receiver, seen, receiverOnly));
      }
      if (receiverOnly) {
        const symbol = checker.getResolvedSymbolOrNil(node);
        result.push(...annotationOrigins(checker, symbol === undefined ? undefined
          : checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol), seen, receiverOnly));
      }
    }
    if (receiverOnly && ["KindParenthesizedExpression", "KindAsExpression", "KindTypeAssertionExpression", "KindNonNullExpression", "KindSatisfiesExpression"].includes(kind)) {
      result.push(...annotationOrigins(checker, node, seen, receiverOnly));
      result.push(...origins(checker, node.Expression, seen, receiverOnly));
    }
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
        result.push(...annotationOrigins(checker, declaration, seen, receiverOnly));
        if (ast.kindName(declaration) === "KindVariableDeclaration" &&
          (receiverOnly || ast.variableDeclarationKind(declaration) === "const")) {
          result.push(...origins(checker, ast.as.AsVariableDeclaration(declaration)?.Initializer, seen, receiverOnly));
        }
        if (receiverOnly && ast.kindName(declaration) === "KindBindingElement") {
          const binding = ast.as.AsBindingElement(declaration);
          const property = binding?.PropertyName ?? ast.name(declaration);
          const pattern = ast.parent(declaration);
          const receiverType = checker.getTypeAtLocation(pattern);
          const symbol = receiverType === undefined || property === undefined ||
            !["KindIdentifier", "KindStringLiteral"].includes(ast.kindName(property)) ? undefined
            : checker.getPropertyOfType(receiverType, ast.text(property));
          const selectedDeclaration = symbol === undefined ? undefined
            : checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
          const reference = declarationFor(selectedDeclaration);
          if (reference !== undefined) result.push(reference);
          result.push(...annotationOrigins(checker, selectedDeclaration, seen, receiverOnly));
        }
      }
    }
    return [...new Map(result.map(reference => [keelSymbolIdentity(reference), reference])).values()];
  }

  function annotationOrigins(checker, declaration, seen, receiverOnly) {
    const result = [];
    const type = declaration === undefined ? undefined : ast.typeNode(declaration);
    if (type !== undefined) walk(type, child => {
      if (receiverOnly && ["KindTypeLiteral", "KindFunctionType", "KindConstructorType", "KindMappedType"].includes(ast.kindName(child))) return false;
      if (ast.kindName(child) === "KindIdentifier") result.push(...origins(checker, child, seen, receiverOnly));
    });
    return result;
  }

  function checkedTypeOrigins(checker, shapes, type, includeMembers = false) {
    const cache = includeMembers ? boundaryTypeOrigins : typeOrigins;
    const cached = cache.get(type);
    if (cached !== undefined) return cached;
    const references = [];
    const visited = new Set();
    visit(type);
    const result = Object.freeze([...new Map(references.map(reference => [keelSymbolIdentity(reference), reference])).values()]);
    cache.set(type, result);
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
      for (const base of shapes.getInstantiatedBaseTypes(current) ?? []) visit(base);
      if (!includeMembers) return;
      visit(shapes.getApparentType(current));
      for (const property of shapes.getPropertyInfos(current)) {
        const declarations = [property.symbol, ...property.rootSymbols].map(symbol => declarationFor(
          checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol)))
          .filter(reference => reference !== undefined);
        if (declarations.length > 0 && declarations.every(reference => reference.file.startsWith("libraries/"))) continue;
        references.push(...declarations);
        visit(property.type);
      }
      for (const kind of ["call", "construct"]) for (const signature of shapes.getSignatureInfos(current, kind)) {
        const declaration = declarationFor(checker.getSignatureDeclaration(signature.signature));
        if (declaration?.file.startsWith("libraries/")) continue;
        if (declaration !== undefined) references.push(declaration);
        visit(signature.returnType);
        visit(signature.thisParameter?.type);
        for (const parameter of signature.parameters) visit(parameter.type);
      }
      for (const index of shapes.getIndexInfos(current)) {
        visit(index.keyType);
        visit(index.valueType);
      }
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
