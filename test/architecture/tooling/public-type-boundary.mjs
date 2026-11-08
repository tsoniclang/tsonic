import { createCompilerSessionFromFiles } from "../../../packages/tsts/dist/src/index.js";

const aliases = new Set([
  "KindImportSpecifier", "KindImportClause", "KindExportSpecifier", "KindNamespaceImport", "KindNamespaceExport",
]);
const typeDeclarations = new Set(["KindInterfaceDeclaration", "KindTypeAliasDeclaration", "KindClassDeclaration"]);
const typeSyntax = new Set(["KindTypeReference", "KindImportType", "KindTypeQuery"]);
const genericDeclarations = new Set([
  ...typeDeclarations, "KindClassExpression", "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindMethodSignature", "KindConstructor", "KindGetAccessor", "KindSetAccessor",
  "KindFunctionType", "KindConstructorType", "KindCallSignature", "KindConstructSignature",
]);

export function auditPublicTypeBoundary({
  files, entries, modulePaths = {}, checkerEntry, targets,
  maximumTypes = 10000, maximumDepth = 96,
}) {
  if (entries.length === 0 || targets.length === 0) throw new Error("Public type audit requires actual entry declarations.");
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/public-boundary",
    files,
    rootFiles: entries.map(entry => entry.file),
    compilerOptions: {
      strict: true, skipLibCheck: true, lib: ["es2022"], target: "esnext",
      module: "esnext", moduleResolution: "bundler", baseUrl: "/", paths: modulePaths,
    },
  });
  const checked = session.checkSource();
  const ast = checked.ast;
  const syntaxDiagnostics = session.getDiagnostics("syntactic");
  if (syntaxDiagnostics.length !== 0) throw new Error(`Public declarations contain ${syntaxDiagnostics.length} syntax diagnostics.`);
  const sourceFiles = new Map(checked.sourceFiles.map(file => [ast.getFileName(file), file]));
  const declarationEntries = new Map(entries.map(entry => [entry.name, entry]));
  validateExports();
  const checkerRoot = moduleExports(checkerEntry);
  const forbidden = new Map(["Type", "Signature", "Symbol", "CheckedSourceProgram"].map(name => {
    const symbol = checkerRoot.exports.find(candidate => checkerRoot.checker.getSymbolName(candidate) === name);
    if (symbol === undefined) throw new Error(`Missing canonical checker declaration ${name}.`);
    return [resolveSymbol(checkerRoot.checker, symbol), name];
  }));
  const siteTypes = ["Node", "SourceFile"].map(name => {
    const symbol = checkerRoot.exports.find(candidate => checkerRoot.checker.getSymbolName(candidate) === name);
    if (symbol === undefined) throw new Error(`Missing canonical site declaration ${name}.`);
    const type = checkerRoot.checker.getDeclaredTypeOfSymbol(resolveSymbol(checkerRoot.checker, symbol));
    if (type === undefined) throw new Error(`Unresolved canonical site declaration ${name}.`);
    return type;
  });
  const siteProperties = siteTypes.flatMap(type => checkerRoot.typeShape.getPropertyInfos(type));
  const rows = [];
  const exported = new Set();
  for (const { entry, exports } of targets) {
    const module = moduleExports(entry);
    const selected = exports === "all" ? module.exports : exports.map(name => {
      const symbol = module.exports.find(candidate => module.checker.getSymbolName(candidate) === name);
      if (symbol === undefined) throw new Error(`Missing consumed public export ${entry}.${name}.`);
      return symbol;
    });
    for (const symbol of selected) inspectExport(module, symbol, entry);
  }
  return Object.freeze(rows);

  function validateExports() {
    const pending = [...new Set([checkerEntry, ...targets.map(target => target.entry)])].map(name => {
      const entry = declarationEntries.get(name);
      const file = entry === undefined ? undefined : sourceFiles.get(entry.file);
      if (file === undefined) throw new Error(`Missing checked declaration entry ${name}.`);
      return file;
    });
    const seen = new Set();
    while (pending.length > 0) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      const checker = checked.getSourceFileQueries(file).checker;
      const visit = node => {
        if (ast.is.IsExportDeclaration(node)) {
          const declaration = ast.as.AsExportDeclaration(node);
          const specifier = declaration?.ModuleSpecifier;
          if (specifier !== undefined) {
            const symbol = checker.getModuleSymbolFromSpecifier(specifier);
            const declarations = symbol === undefined ? [] : checker.getSymbolDeclarations(symbol);
            if (declarations.length === 0) throw new Error(`Unresolved public declaration module ${ast.text(specifier)} in ${ast.getFileName(file)}.`);
            for (const original of declarations) pending.push(ast.getSourceFile(original));
          }
        }
        ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
      };
      visit(file);
    }
  }

  function moduleExports(name) {
    const entry = declarationEntries.get(name);
    const file = entry === undefined ? undefined : sourceFiles.get(entry.file);
    if (file === undefined) throw new Error(`Missing checked declaration entry ${name}.`);
    const queries = checked.getSourceFileQueries(file);
    const symbol = queries.checker.getSymbolAtLocation(file);
    if (symbol === undefined) throw new Error(`Unresolved public module ${name}.`);
    return { ...queries, exports: queries.checker.getExportsOfModule(symbol) };
  }

  function resolveSymbol(checker, original) {
    let symbol = original;
    const seen = new Set();
    while (checker.getSymbolDeclarations(symbol).some(node => aliases.has(ast.kindName(node)))) {
      if (seen.has(symbol)) throw new Error("Cyclic public declaration alias.");
      seen.add(symbol);
      symbol = checker.getAliasedSymbol(symbol);
      if (symbol === undefined) throw new Error("Unresolved public declaration alias.");
    }
    return symbol;
  }

  function inspectExport(queries, original, path) {
    const { checker } = queries;
    const label = `${path}.${checker.getSymbolName(original)}`;
    const symbol = resolveSymbol(checker, original);
    if (exported.has(symbol)) return;
    exported.add(symbol);
    const declarations = checker.getSymbolDeclarations(symbol);
    if (declarations.length === 0) {
      rows.push(Object.freeze({ subject: label, verdict: "unresolved", detail: "Missing original declaration." }));
      return;
    }
    if (declarations.some(node => ast.kindName(node) === "KindModuleDeclaration")) {
      for (const member of checker.getExportsOfModule(symbol)) inspectExport(queries, member, label);
    }
    const kinds = declarations.map(node => ast.kindName(node));
    if (kinds.some(kind => typeDeclarations.has(kind))) inspectType(queries, checker.getDeclaredTypeOfSymbol(symbol), `${label}:instance`);
    if (kinds.some(kind => !["KindInterfaceDeclaration", "KindTypeAliasDeclaration"].includes(kind))) {
      inspectType(queries, checker.getTypeOfSymbol(symbol), `${label}:value`);
    }
  }

  function inspectType({ checker, typeShape }, root, subject) {
    const pending = [{ type: root, path: subject, depth: 0 }];
    const seen = new Set();
    const declarations = new Set();
    let failure;
    while (pending.length > 0 && failure === undefined) {
      const { type, path, depth } = pending.pop();
      if (type === undefined) {
        failure = { verdict: "unresolved", detail: `${path}: missing checked type.` };
        break;
      }
      if (seen.has(type)) continue;
      seen.add(type);
      if (seen.size > maximumTypes || depth > maximumDepth) {
        failure = { verdict: "unresolved", detail: `${path}: type traversal budget exhausted.` };
        break;
      }
      const symbols = [checker.getTypeSymbol(type), checker.getTypeAliasSymbol(type)].filter(symbol => symbol !== undefined);
      const forbiddenName = symbols.map(symbol => forbidden.get(resolveSymbol(checker, symbol))).find(name => name !== undefined);
      if (forbiddenName !== undefined) {
        failure = { verdict: "checker", detail: `${path}: ${forbiddenName}.` };
        break;
      }
      const privateDeclaration = symbols.flatMap(symbol => checker.getSymbolDeclarations(resolveSymbol(checker, symbol)))
        .find(declaration => {
          const file = ast.getFileName(ast.getSourceFile(declaration)).replaceAll("\\", "/");
          return file.includes("/packages/host/dist/host-input/") || file.includes("/packages/source-core/dist/host-input/") ||
            file.includes("/packages/target-api/dist/source-semantics/descriptor-");
        });
      if (privateDeclaration !== undefined) {
        failure = { verdict: "private-host", detail: `${path}: private Source implementation ${ast.getFileName(ast.getSourceFile(privateDeclaration))}.` };
        break;
      }
      if (typeShape.isAny(type)) {
        failure = { verdict: "unresolved", detail: `${path}: any cannot prove a closed public boundary.` };
        break;
      }
      if (typeShape.isUnknown(type) || typeShape.isNever(type) || typeShape.isNonPrimitive(type) ||
          typeShape.isVoidLike(type) || typeShape.isNullish(type) || typeShape.isStringLike(type) ||
          typeShape.isNumberLike(type) || typeShape.isBooleanLike(type) || typeShape.isBigIntLike(type) ||
          typeShape.isSymbolLike(type) || siteTypes.some(site => typeShape.isTypeIdenticalTo(site, type))) continue;
      const add = (child, part) => pending.push({ type: child, path: `${path}.${part}`, depth: depth + 1 });
      const addSyntax = node => {
        if (node === undefined) return;
        if (typeSyntax.has(ast.kindName(node))) add(checker.getTypeFromTypeNode(node), "declared-type");
        ast.forEachChild(node, child => { if (child !== undefined) addSyntax(child); });
      };
      const addConstraints = declaration => {
        if (declaration === undefined || declarations.has(declaration) || !genericDeclarations.has(ast.kindName(declaration))) return;
        declarations.add(declaration);
        for (const parameter of ast.typeParameters(declaration)) {
          if (!ast.is.IsTypeParameterDeclaration(parameter)) throw new Error("Invalid checked type parameter declaration.");
          const selected = ast.as.AsTypeParameterDeclaration(parameter);
          addSyntax(selected?.Constraint);
          addSyntax(selected?.DefaultType);
        }
        if (ast.kindName(declaration) === "KindTypeAliasDeclaration") addSyntax(ast.typeNode(declaration));
      };
      for (const symbol of symbols) for (const declaration of checker.getSymbolDeclarations(symbol)) addConstraints(declaration);
      for (const arm of typeShape.getUnionOrIntersectionTypes(type)) add(arm, "arm");
      for (const argument of typeShape.getTypeArguments(type)) add(argument, "argument");
      if (symbols.length > 0 && symbols.every(symbol => {
        const original = checker.getSymbolDeclarations(symbol);
        return original.length > 0 && original.every(declaration => checker.isDefaultLibraryDeclaration(declaration));
      })) continue;
      for (const base of typeShape.getInstantiatedBaseTypes(type) ?? []) add(base, "base");
      const substitution = typeShape.getSubstitutionBaseType(type);
      if (substitution !== undefined && substitution !== type) add(substitution, "substitution");
      const indexed = typeShape.getIndexedAccessComponents(type);
      if (indexed !== undefined) {
        add(indexed.objectType, "indexed-object");
        add(indexed.indexType, "indexed-key");
      }
      for (const property of typeShape.getPropertyInfos(type)) {
        const inheritedSite = siteProperties.some(original =>
          original.name === property.name && typeShape.isTypeIdenticalTo(original.type, property.type));
        if (!inheritedSite) add(property.type, property.name);
      }
      for (const index of typeShape.getIndexInfos(type)) {
        add(index.keyType, "index-key");
        add(index.valueType, "index-value");
      }
      for (const kind of ["call", "construct"]) {
        for (const [index, signature] of typeShape.getSignatureInfos(type, kind).entries()) {
          addConstraints(checker.getSignatureDeclaration(signature.signature));
          for (const [parameter, input] of signature.parameters.entries()) add(input.type, `${kind}${index}.parameter${parameter}`);
          if (signature.thisParameter !== undefined) add(signature.thisParameter.type, `${kind}${index}.this`);
          add(signature.returnType, `${kind}${index}.return`);
        }
      }
    }
    rows.push(Object.freeze({ subject, ...(failure ?? { verdict: "clean", detail: "Complete reachable type graph." }) }));
  }
}
