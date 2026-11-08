const checkerNames = new Set([
  "Type", "Signature", "Symbol", "CheckedSourceProgram", "TypeCheckerQueries", "TypeShapeQueries",
  "SourceFileQueries", "SourceProgramQueries", "CompilerSession", "Program", "CompilerHost",
  "createCompilerSession", "createCompilerSessionFromFiles", "createCompilerSessionFromProgram",
]);
const scopedOwners = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindConstructor",
  "KindClassDeclaration", "KindClassExpression", "KindGetAccessor", "KindSetAccessor", "KindClassStaticBlockDeclaration",
]);

export function checkerImportFindings(source, file) {
  const ast = source.ast;
  const path = inputPath(ast, file);
  if (path.startsWith("packages/host/src/host-input/") || path.startsWith("packages/source-core/src/host-input/")) return [];
  const findings = [];
  const forbidden = name => checkerNames.has(name) || /^ResolvedSource.*Info$/u.test(name ?? "");
  const visit = node => {
    if (ast.is.IsImportDeclaration(node) || ast.is.IsExportDeclaration(node)) {
      const declaration = ast.is.IsImportDeclaration(node) ? ast.as.AsImportDeclaration(node) : ast.as.AsExportDeclaration(node);
      const specifier = declaration?.ModuleSpecifier;
      const name = specifier === undefined ? undefined : ast.text(specifier);
      if (name?.startsWith("@tsonic/tsts/") && name !== "@tsonic/tsts/target-ast") findings.push(finding(ast, file, node, "private-checker-entry"));
      if (name === "@tsonic/tsts") {
        const imported = child => {
          const kind = ast.kindName(child);
          if (kind === "KindNamespaceImport" || kind === "KindNamespaceExport") findings.push(finding(ast, file, child, "checker-namespace-import"));
          if (kind === "KindImportSpecifier" || kind === "KindExportSpecifier") {
            const selected = kind === "KindImportSpecifier" ? ast.as.AsImportSpecifier(child) : ast.as.AsExportSpecifier(child);
            const original = selected?.PropertyName ?? ast.name(child);
            if (original !== undefined && forbidden(ast.text(original))) findings.push(finding(ast, file, child, "checker-type-or-query-import"));
          }
          ast.forEachChild(child, nested => { if (nested !== undefined) imported(nested); });
        };
        imported(node);
        if (ast.is.IsExportDeclaration(node) && declaration?.ExportClause === undefined) findings.push(finding(ast, file, node, "checker-namespace-import"));
      }
    }
    if (ast.kindName(node) === "KindImportType") {
      const selected = ast.as.AsImportTypeNode(node);
      const argument = selected?.Argument;
      const literal = argument !== undefined && ast.kindName(argument) === "KindLiteralType" ? ast.as.AsLiteralTypeNode(argument)?.Literal : undefined;
      const qualifier = selected?.Qualifier;
      const name = qualifier === undefined ? undefined : ast.is.IsIdentifier(qualifier) ? ast.text(qualifier)
        : ast.kindName(qualifier) === "KindQualifiedName" ? ast.text(ast.as.AsQualifiedName(qualifier).Right) : undefined;
      if (literal !== undefined && ast.text(literal) === "@tsonic/tsts" && (qualifier === undefined || forbidden(name))) {
        findings.push(finding(ast, file, node, "checker-type-or-query-import"));
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return findings;
}

export function moduleLifetimeFindings(source, file) {
  const ast = source.ast;
  const checker = source.getSourceFileQueries(file).checker;
  const caches = new Map();
  const findings = [];
  const moduleOwned = node => {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (scopedOwners.has(ast.kindName(parent))) return false;
    }
    return true;
  };
  const visit = node => {
    if (ast.is.IsVariableDeclaration(node) && moduleOwned(node)) {
      const declaration = ast.as.AsVariableDeclaration(node);
      const initializer = declaration.Initializer;
      const name = ast.name(node);
      if (initializer !== undefined && ast.is.IsNewExpression(initializer) && name !== undefined) {
        const constructor = ast.as.AsNewExpression(initializer).Expression;
        if (ast.is.IsIdentifier(constructor)) {
          const kind = ast.text(constructor);
          const symbol = checker.getSymbolAtLocation(name);
          if (symbol !== undefined && ["WeakMap", "WeakSet", "Map", "Set"].includes(kind)) {
            caches.set(symbol, { node, kind });
            if (kind.startsWith("Weak")) findings.push(finding(ast, file, node, "module-owned-mutable-cache"));
          }
        }
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const mutations = node => {
    if (ast.is.IsCallExpression(node)) {
      const callee = ast.as.AsCallExpression(node).Expression;
      if (ast.is.IsPropertyAccessExpression(callee)) {
        const access = ast.as.AsPropertyAccessExpression(callee);
        if (ast.is.IsIdentifier(access.Expression) && ["set", "add", "delete", "clear"].includes(ast.text(ast.name(callee)))) {
          const owner = caches.get(checker.getSymbolAtLocation(access.Expression));
          if (owner !== undefined && !owner.kind.startsWith("Weak")) findings.push(finding(ast, file, node, "module-owned-mutable-cache"));
        }
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) mutations(child); });
  };
  mutations(file);
  return findings;
}

export function sourceForwardingFindings(source, file) {
  const ast = source.ast;
  const findings = [];
  const expressionText = node => {
    const range = ast.authoredRange(node);
    return range.kind === "authored" ? ast.getSourceText(file).slice(range.start, range.end).replace(/\s+/gu, "") : undefined;
  };
  const field = (node, name) => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === name
    ? expressionText(ast.as.AsPropertyAccessExpression(node).Expression) : undefined;
  const visit = node => {
    if (ast.kindName(node) === "KindStringLiteral") {
      const text = ast.text(node);
      if (/^(?:TSONIC|TSTS)_/u.test(text) && text !== "TSONIC_COMPILER_RESOURCE_LIMIT") findings.push(finding(ast, file, node, "native-source-code-literal"));
    }
    if (ast.is.IsObjectLiteralExpression(node)) {
      const fields = new Map(ast.properties(node).filter(property => ast.is.IsPropertyAssignment(property)).flatMap(property => {
        const name = ast.name(property);
        return name !== undefined && (ast.is.IsIdentifier(name) || ast.kindName(name) === "KindStringLiteral")
          ? [[ast.text(name), ast.as.AsPropertyAssignment(property).Initializer]] : [];
      }));
      const origin = fields.get("source");
      if (fields.has("code") && origin !== undefined && ast.kindName(origin) === "KindStringLiteral" && ast.text(origin) === "tsonic") {
        const code = field(fields.get("code"), "code");
        const message = field(fields.get("message"), "message");
        const site = field(fields.get("sourceNode"), "site");
        if (code === undefined || code !== message || code !== site) findings.push(finding(ast, file, node, "source-refusal-not-forwarded-unchanged"));
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return findings;
}

function inputPath(ast, file) {
  return ast.getFileName(file).slice("/architecture/".length);
}

function finding(ast, file, node, rule) {
  const range = ast.authoredRange(node);
  return Object.freeze({ file: inputPath(ast, file), line: ast.getSourceText(file).slice(0, range.start).split("\n").length, rule });
}
