import { readArchitectureTypeScript } from "./typescript-source.mjs";

export function sourceArgumentSyntaxFindings(sources) {
  const source = readArchitectureTypeScript(sources);
  const ast = source.ast;
  const findings = [];
  for (const file of source.sourceFiles) {
    const path = ast.getFileName(file).slice("/architecture/".length);
    if (!sources.has(path)) continue;
    const checker = source.getSourceFileQueries(file).checker;
    const readerTypes = new Set();
    const readers = new Set();
    const argumentReaders = new Set();
    const declarations = [];
    const nodes = [];
    const visit = node => {
      nodes.push(node);
      if (ast.is.IsImportDeclaration(node)) {
        const declaration = ast.as.AsImportDeclaration(node);
        if (declaration.ModuleSpecifier !== undefined && ast.text(declaration.ModuleSpecifier) === "@tsonic/tsts") {
          const inspect = child => {
            if (ast.is.IsImportSpecifier(child)) {
              const selected = ast.as.AsImportSpecifier(child);
              const original = selected.PropertyName ?? ast.name(child);
              if (original !== undefined && ast.text(original) === "AstReader") {
                const symbol = checker.getSymbolAtLocation(ast.name(child));
                if (symbol === undefined) throw new Error("A Source argument gate requires the original AstReader import binding.");
                readerTypes.add(symbol);
              }
            }
            ast.forEachChild(child, nested => { if (nested !== undefined) inspect(nested); });
          };
          inspect(node);
        }
      }
      if (ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsBindingElement(node)) declarations.push(node);
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    const unwrap = original => {
      let node = original;
      while (node !== undefined) {
        if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node).Expression;
        else if (ast.is.IsAsExpression(node)) node = ast.as.AsAsExpression(node).Expression;
        else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node).Expression;
        else if (ast.is.IsNonNullExpression(node)) node = ast.as.AsNonNullExpression(node).Expression;
        else break;
      }
      return node;
    };
    const isReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && readers.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "ast");
    };
    const isArgumentReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && argumentReaders.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "arguments" && isReader(ast.as.AsPropertyAccessExpression(node).Expression));
    };
    for (let previous = -1; previous !== readers.size + argumentReaders.size;) {
      previous = readers.size + argumentReaders.size;
      for (const node of declarations) {
        const name = ast.name(node);
        if (name === undefined || !ast.is.IsIdentifier(name)) continue;
        const symbol = checker.getSymbolAtLocation(name);
        if (symbol === undefined) continue;
        const type = ast.is.IsBindingElement(node) ? undefined : ast.typeNode(node);
        if (type !== undefined && ast.is.IsTypeReferenceNode(type) &&
          readerTypes.has(checker.getSymbolAtLocation(ast.as.AsTypeReferenceNode(type).TypeName))) readers.add(symbol);
        const initializer = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node).Initializer
          : ast.is.IsParameterDeclaration(node) ? ast.as.AsParameterDeclaration(node).Initializer : undefined;
        if (isReader(initializer)) readers.add(symbol);
        if (isArgumentReader(initializer)) argumentReaders.add(symbol);
        if (ast.is.IsBindingElement(node)) {
          const selected = ast.as.AsBindingElement(node);
          const property = ast.text(selected.PropertyName ?? name);
          if (property === "ast") readers.add(symbol);
          const owner = ast.parent(ast.parent(node));
          if (property === "arguments" && owner !== undefined && ast.is.IsVariableDeclaration(owner) &&
            isReader(ast.as.AsVariableDeclaration(owner).Initializer)) argumentReaders.add(symbol);
        }
      }
    }
    for (const node of nodes) {
      let rule;
      if (ast.is.IsCallExpression(node) && isArgumentReader(ast.as.AsCallExpression(node).Expression)) rule = "native-reconstructs-application-arguments";
      if (ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "Arguments") rule = "native-reads-raw-call-arguments";
      if (ast.is.IsElementAccessExpression(node)) {
        const access = ast.as.AsElementAccessExpression(node);
        const key = access.ArgumentExpression;
        if (key !== undefined && ast.kindName(key) === "KindStringLiteral" &&
          (ast.text(key) === "Arguments" || ast.text(key) === "arguments" && isReader(access.Expression))) rule = "native-reads-raw-call-arguments";
      }
      if (rule !== undefined) {
        const range = ast.authoredRange(node);
        findings.push(Object.freeze({ file: path, line: ast.getSourceText(file).slice(0, range.start).split("\n").length, rule }));
      }
    }
  }
  return Object.freeze(findings);
}
