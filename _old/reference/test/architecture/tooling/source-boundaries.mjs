import { publicModuleDependency } from "./public-declarations.mjs";

const checkerNames = new Set([
  "Type", "Signature", "Symbol", "CheckedSourceProgram", "TypeCheckerQueries", "TypeShapeQueries",
  "SourceFileQueries", "SourceProgramQueries", "CompilerSession", "Program", "CompilerHost",
  "createCompilerSession", "createCompilerSessionFromFiles", "createCompilerSessionFromProgram",
]);
const scopedOwners = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindConstructor",
  "KindGetAccessor", "KindSetAccessor",
]);

export function checkerImportFindings(source, file) {
  const ast = source.ast;
  const path = inputPath(ast, file);
  if (path.startsWith("packages/host/src/host-input/") || path.startsWith("packages/source-core/src/host-input/")) return [];
  const findings = [];
  const forbidden = name => checkerNames.has(name) || /^ResolvedSource.*Info$/u.test(name ?? "");
  const visit = node => {
    const dependency = publicModuleDependency(ast, node);
    if (dependency !== undefined) {
      const name = ast.text(dependency.specifier);
      if (name.startsWith("@tsonic/tsts/") && name !== "@tsonic/tsts/target-ast") findings.push(finding(ast, file, node, "private-checker-entry"));
      if (name === "@tsonic/tsts") {
        if (dependency.names === "all") {
          if (!ast.is.IsImportDeclaration(node) || ast.as.AsImportDeclaration(node).ImportClause !== undefined) {
            findings.push(finding(ast, file, node, "checker-namespace-import"));
          }
        } else if (dependency.names.some(forbidden)) findings.push(finding(ast, file, node, "checker-type-or-query-import"));
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
      if (ast.is.IsPropertyDeclaration(parent) && !ast.hasModifierKind(parent, "static")) return false;
    }
    return true;
  };
  const visit = node => {
    const declaration = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)
      : ast.is.IsPropertyDeclaration(node) && ast.hasModifierKind(node, "static") ? ast.as.AsPropertyDeclaration(node) : undefined;
    if (declaration !== undefined && moduleOwned(node)) {
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
        const subject = ast.is.IsIdentifier(access.Expression) ? access.Expression
          : ast.is.IsPropertyAccessExpression(access.Expression) ? ast.name(access.Expression) : undefined;
        if (subject !== undefined && ["set", "add", "delete", "clear"].includes(ast.text(ast.name(callee)))) {
          const owner = caches.get(checker.getSymbolAtLocation(subject));
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
  const checker = source.getSourceFileQueries(file).checker;
  const sourceCodes = new Set();
  const declarations = [];
  const collect = node => {
    if (ast.is.IsVariableDeclaration(node)) declarations.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) collect(child); });
  };
  collect(file);
  const sourceCode = original => {
    let node = original;
    while (node !== undefined) {
      if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node).Expression;
      else if (ast.is.IsAsExpression(node)) node = ast.as.AsAsExpression(node).Expression;
      else if (ast.is.IsTypeAssertion(node)) node = ast.as.AsTypeAssertion(node).Expression;
      else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node).Expression;
      else if (ast.is.IsNonNullExpression(node)) node = ast.as.AsNonNullExpression(node).Expression;
      else break;
    }
    if (node === undefined) return false;
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(node))) return /^TSONIC_/u.test(ast.text(node));
    return ast.is.IsIdentifier(node) && sourceCodes.has(checker.getSymbolAtLocation(node));
  };
  for (let previous = -1; previous !== sourceCodes.size;) {
    previous = sourceCodes.size;
    for (const declaration of declarations) {
      const name = ast.name(declaration);
      if (name === undefined || !ast.is.IsIdentifier(name) ||
        !sourceCode(ast.as.AsVariableDeclaration(declaration).Initializer)) continue;
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol !== undefined) sourceCodes.add(symbol);
    }
  }
  const expressionText = node => {
    const range = ast.authoredRange(node);
    return range.kind === "authored" ? ast.getSourceText(file).slice(range.start, range.end).replace(/\s+/gu, "") : undefined;
  };
  const field = (node, name) => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === name
    ? expressionText(ast.as.AsPropertyAccessExpression(node).Expression) : undefined;
  const visit = node => {
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(node))) {
      const text = ast.text(node);
      if (/^(?:TSONIC|TSTS)_/u.test(text) && text !== "TSONIC_COMPILER_RESOURCE_LIMIT") findings.push(finding(ast, file, node, "native-source-code-literal"));
    }
    if (ast.is.IsBinaryExpression(node) &&
      ["KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken", "KindExclamationEqualsEqualsToken"].includes(ast.operatorKindName(node))) {
      const comparison = ast.as.AsBinaryExpression(node);
      if (sourceCode(comparison.Left) || sourceCode(comparison.Right)) findings.push(finding(ast, file, node, "native-source-code-comparison"));
    }
    if (ast.is.IsCaseClause(node) && sourceCode(ast.as.AsCaseOrDefaultClause(node).Expression)) {
      findings.push(finding(ast, file, node, "native-source-code-comparison"));
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
