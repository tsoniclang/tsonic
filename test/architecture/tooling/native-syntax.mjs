import { readArchitectureTypeScript } from "./typescript-source.mjs";

export function nativeSyntaxFindings(sourceFiles) {
  const source = readArchitectureTypeScript(sourceFiles);
  const ast = source.ast;
  const findings = [];
  for (const file of source.sourceFiles) {
    const path = ast.getFileName(file).slice("/architecture/".length);
    if (!sourceFiles.has(path)) continue;
    const names = new Set();
    if ([file.ReferencedFiles, file.TypeReferenceDirectives, file.LibReferenceDirectives]
      .some(references => references !== undefined && references.length !== 0)) names.add("triple-slash reference");
    visit(file);
    for (const name of names) findings.push(`${path}: ${name}`);

    function visit(node) {
      if (ast.is.IsExternalModuleReference(node)) names.add("CommonJS require call");
      if (ast.is.IsExportAssignment(node) && ast.as.AsExportAssignment(node)?.IsExportEquals === true) {
        names.add("TypeScript export assignment");
      }
      if (ast.is.IsModuleDeclaration(node)) {
        const name = ast.name(node);
        names.add(ast.is.IsStringLiteral(name) || ast.hasModifierKind(node, "ambient")
          ? "ambient module shim" : "namespace declaration shim");
      }
      if (ast.is.IsPropertyAccessExpression(node)) {
        const member = ast.as.AsPropertyAccessExpression(node);
        if (identifier(member?.Expression, "exports")) names.add("CommonJS exports mutation");
      }
      if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken") {
        const left = ast.as.AsBinaryExpression(node)?.Left;
        if (ast.is.IsPropertyAccessExpression(left)) {
          const member = ast.as.AsPropertyAccessExpression(left);
          if (identifier(member?.Expression, "module") && ast.text(ast.name(left)) === "exports") {
            names.add("CommonJS module.exports assignment");
          }
        }
      }
      if (ast.is.IsCallExpression(node)) {
        let expression = ast.as.AsCallExpression(node)?.Expression;
        while (ast.is.IsParenthesizedExpression(expression)) {
          expression = ast.as.AsParenthesizedExpression(expression)?.Expression;
        }
        if (identifier(expression, "require")) names.add("CommonJS require call");
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    }
  }
  return findings.sort();

  function identifier(node, text) {
    if (!ast.is.IsIdentifier(node) || ast.text(node) !== text) return false;
    const checker = source.getSourceFileQueries(ast.getSourceFile(node)).checker;
    const symbol = checker.getLexicallyResolvedSymbol(node);
    const declaration = symbol === undefined ? undefined
      : checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
    if (declaration === undefined) return true;
    if (ast.isDeclarationFile(ast.getSourceFile(declaration))) return true;
    for (let current = declaration; current !== undefined; current = ast.parent(current)) {
      if (ast.hasModifierKind(current, "ambient")) return true;
    }
    return false;
  }
}
