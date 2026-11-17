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
  if (path.startsWith("packages/host/src/ingress/") && !path.endsWith("/contract.ts") && !path.endsWith("/contract.d.ts")) return [];
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

export function moduleLifetimeFindings(source, file, { immutableData = false } = {}) {
  const ast = source.ast;
  if (ast.isDeclarationFile(file)) return [];
  const findings = [];
  const checker = source.getSourceFileQueries(file).checker;
  const active = new Set();
  const classifications = new Map();
  const transparent = node => {
    if (ast.is.IsParenthesizedExpression(node)) return ast.as.AsParenthesizedExpression(node).Expression;
    if (ast.is.IsAsExpression(node)) return ast.as.AsAsExpression(node).Expression;
    if (ast.is.IsSatisfiesExpression(node)) return ast.as.AsSatisfiesExpression(node).Expression;
    if (ast.is.IsTypeAssertion(node)) return ast.as.AsTypeAssertion(node).Expression;
    if (ast.is.IsNonNullExpression(node)) return ast.as.AsNonNullExpression(node).Expression;
    return undefined;
  };
  const unwrap = original => {
    let node = original;
    for (let child = node === undefined ? undefined : transparent(node); child !== undefined; child = transparent(node)) node = child;
    return node;
  };
  const invoked = node => {
    let current = node;
    while (ast.parent(current) !== undefined && transparent(ast.parent(current)) === current) current = ast.parent(current);
    const parent = ast.parent(current);
    return parent !== undefined && ast.is.IsCallExpression(parent) && ast.as.AsCallExpression(parent).Expression === current;
  };
  const moduleOwned = node => {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (scopedOwners.has(ast.kindName(parent)) && !invoked(parent)) return false;
      if (ast.is.IsPropertyDeclaration(parent) && !ast.hasModifierKind(parent, "static")) return false;
    }
    return true;
  };
  const classify = original => {
    const node = unwrap(original);
    if (node === undefined) return undefined;
    if (classifications.has(node)) return classifications.get(node);
    const result = classifyNode(node);
    classifications.set(node, result);
    return result;
  };
  const classifyNode = node => {
    const kind = ast.kindName(node);
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kind)) return { kind: "string" };
    if (["KindNumericLiteral", "KindBigIntLiteral", "KindTrueKeyword", "KindFalseKeyword", "KindNullKeyword",
      "KindArrowFunction", "KindFunctionExpression"].includes(kind)) return { kind: "value" };
    if (ast.is.IsIdentifier(node)) {
      const parent = ast.parent(node);
      let symbol = ast.is.IsShorthandPropertyAssignment(parent)
        ? checker.getLexicallyResolvedSymbol(node) : checker.getSymbolAtLocation(node);
      if (symbol !== undefined && checker.getSymbolDeclarations(symbol).some(declaration =>
        ["KindImportSpecifier", "KindImportClause", "KindExportSpecifier", "KindNamespaceImport", "KindNamespaceExport"]
          .includes(ast.kindName(declaration)))) symbol = checker.getAliasedSymbol(symbol);
      if (symbol === undefined || active.has(symbol)) return immutableData ? undefined : { kind: "value" };
      const declaration = checker.getSymbolValueDeclaration(symbol);
      if (declaration !== undefined && ast.is.IsFunctionDeclaration(declaration)) return { kind: "value" };
      if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration) ||
        ast.variableDeclarationKind(declaration) !== "const") return immutableData ? undefined : { kind: "value" };
      active.add(symbol);
      const result = classify(ast.as.AsVariableDeclaration(declaration).Initializer);
      active.delete(symbol);
      return result ?? (immutableData ? undefined : { kind: "value" });
    }
    if (!immutableData && ast.is.IsArrayLiteralExpression(node))
      return ast.elements(node).every(element => classify(element) !== undefined) ? { kind: "value" } : undefined;
    if (!immutableData && ast.is.IsObjectLiteralExpression(node)) return ast.properties(node).every(property =>
      ast.is.IsPropertyAssignment(property) && classify(ast.as.AsPropertyAssignment(property).Initializer) !== undefined)
      ? { kind: "value" } : undefined;
    if (ast.is.IsPrefixUnaryExpression(node)) return classify(ast.as.AsPrefixUnaryExpression(node).Operand) === undefined
      ? undefined : { kind: "value" };
    if (ast.is.IsElementAccessExpression(node)) {
      const selection = ast.as.AsElementAccessExpression(node);
      if (!ast.is.IsNumericLiteral(selection.ArgumentExpression)) return undefined;
      const index = Number(ast.text(selection.ArgumentExpression));
      if (!Number.isInteger(index) || index < 0) return undefined;
      let vector = classify(selection.Expression);
      let remaining = BigInt(index);
      if (vector?.kind !== "vector" || remaining >= vector.length) return undefined;
      while (vector.kind === "vector") {
        let selected;
        for (const segment of vector.segments) {
          const length = segment.spread ? segment.value.length : 1n;
          if (remaining < length) {
            selected = segment;
            break;
          }
          remaining -= length;
        }
        if (selected === undefined) return undefined;
        if (!selected.spread) return selected.value;
        vector = selected.value;
      }
      return undefined;
    }
    if (ast.is.IsTemplateExpression(node)) {
      const spans = ast.as.AsTemplateExpression(node).TemplateSpans?.Nodes;
      return spans !== undefined && spans.every(span => span !== undefined && ast.is.IsTemplateSpan(span) &&
        classify(ast.as.AsTemplateSpan(span).Expression)?.kind === "string") ? { kind: "string" } : undefined;
    }
    if (ast.is.IsBinaryExpression(node)) {
      const operation = ast.as.AsBinaryExpression(node);
      return ast.operatorKindName(node) === "KindPlusToken" && classify(operation.Left)?.kind === "string" &&
        classify(operation.Right)?.kind === "string" ? { kind: "string" } : undefined;
    }
    if (!ast.is.IsCallExpression(node)) return undefined;
    const selected = ast.as.AsCallExpression(node);
    if (!ast.is.IsPropertyAccessExpression(selected.Expression)) return undefined;
    const callee = ast.as.AsPropertyAccessExpression(selected.Expression);
    if (ast.text(callee.Expression) !== "Object" || ast.text(ast.name(selected.Expression)) !== "freeze") return undefined;
    const arguments_ = ast.arguments(node);
    if (arguments_.length !== 1) return undefined;
    const value = unwrap(arguments_[0]);
    if (ast.is.IsArrayLiteralExpression(value)) {
      const segments = [];
      let length = 0n;
      for (const element of ast.elements(value)) {
        if (ast.is.IsSpreadElement(element)) {
          const vector = classify(ast.as.AsSpreadElement(element).Expression);
          if (vector?.kind !== "vector") return undefined;
          segments.push({ spread: true, value: vector });
          length += vector.length;
        } else {
          const item = classify(element);
          if (item === undefined) return undefined;
          segments.push({ spread: false, value: item });
          length += 1n;
        }
      }
      return { kind: "vector", length, segments };
    }
    if (!ast.is.IsObjectLiteralExpression(value)) return classify(value);
    return ast.properties(value).every(property => ast.is.IsPropertyAssignment(property)
      ? classify(ast.as.AsPropertyAssignment(property).Initializer) !== undefined
      : ast.is.IsShorthandPropertyAssignment(property) && classify(ast.name(property)) !== undefined)
      ? { kind: "value" } : undefined;
  };
  const visit = node => {
    const declaration = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)
      : ast.is.IsPropertyDeclaration(node) && ast.hasModifierKind(node, "static") ? ast.as.AsPropertyDeclaration(node) : undefined;
    if (declaration !== undefined && moduleOwned(node)) {
      for (let parent = node; parent !== undefined; parent = ast.parent(parent)) {
        if (ast.hasModifierKind(parent, "ambient")) return;
      }
      const initializer = declaration.Initializer;
      const name = ast.name(node);
      const mutableBinding = immutableData && (ast.is.IsVariableDeclaration(node)
        ? ast.variableDeclarationKind(node) !== "const" : !ast.hasModifierKind(node, "readonly"));
      if (mutableBinding || initializer === undefined || classify(initializer) === undefined) {
        findings.push(finding(ast, file, name ?? node, "module-owned-mutable-cache"));
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
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
  return Object.freeze({ file: inputPath(ast, file), start: range.start,
    line: ast.getSourceText(file).slice(0, range.start).split("\n").length, rule });
}
