import { readArchitectureTypeScript } from "./typescript-source.mjs";

const unionKinds = new Map([
  ["BindingPattern", ["ArrayBindingPattern", "ObjectBindingPattern"]],
  ["ForInOrOfStatement", ["ForInStatement", "ForOfStatement"]],
  ["CaseOrDefaultClause", ["CaseClause", "DefaultClause"]],
]);
const functions = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
  "KindGetAccessor", "KindSetAccessor", "KindConstructor",
]);
const assignments = new Set([
  "KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken", "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken", "KindAmpersandAmpersandEqualsToken",
  "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken",
]);

export function schemaCastFindings(sourceFiles) {
  const source = readArchitectureTypeScript(sourceFiles);
  const ast = source.ast;
  const findings = [];
  for (const file of source.sourceFiles) {
    const path = ast.getFileName(file).slice("/architecture/".length);
    if (!sourceFiles.has(path)) continue;
    const checker = source.getSourceFileQueries(file).checker;
    const symbols = new Map();
    const identity = original => {
      const node = unwrap(original);
      if (node === undefined) return undefined;
      if (ast.is.IsIdentifier(node)) {
        const symbol = checker.getSymbolAtLocation(node);
        if (symbol === undefined) return undefined;
        if (!symbols.has(symbol)) symbols.set(symbol, symbols.size);
        return `symbol:${symbols.get(symbol)}`;
      }
      if (ast.is.IsPropertyAccessExpression(node)) {
        const property = ast.as.AsPropertyAccessExpression(node);
        const owner = identity(property.Expression);
        return owner === undefined ? undefined : `${owner}.${ast.text(ast.name(node))}`;
      }
      return undefined;
    };
    const member = (node, name) => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === name;
    const qualifiedCall = (node, container, prefix) => {
      if (!ast.is.IsCallExpression(node)) return undefined;
      const callee = unwrap(ast.as.AsCallExpression(node).Expression);
      if (!ast.is.IsPropertyAccessExpression(callee)) return undefined;
      const name = ast.text(ast.name(callee));
      if (!name.startsWith(prefix)) return undefined;
      const owner = ast.as.AsPropertyAccessExpression(callee).Expression;
      if (!member(owner, container)) return undefined;
      return { name: name.slice(prefix.length), reader: identity(ast.as.AsPropertyAccessExpression(owner).Expression),
        subject: identity(ast.arguments(node)[0]) };
    };
    const proves = (original, cast, truth) => {
      const node = unwrap(original);
      if (node === undefined) return false;
      if (ast.is.IsPrefixUnaryExpression(node) && ast.operatorKindName(node) === "KindExclamationToken") {
        return proves(ast.as.AsPrefixUnaryExpression(node).Operand, cast, !truth);
      }
      if (ast.is.IsBinaryExpression(node)) {
        const binary = ast.as.AsBinaryExpression(node);
        const operator = ast.operatorKindName(node);
        if (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken") {
          const left = proves(binary.Left, cast, truth);
          const right = proves(binary.Right, cast, truth);
          return (operator === "KindAmpersandAmpersandToken") === truth
            ? left && !invalidates(binary.Right, cast) || right : left && right;
        }
      }
      const predicate = qualifiedCall(node, "is", "Is");
      return truth && predicate !== undefined && cast.subject !== undefined && cast.reader !== undefined &&
        predicate.subject === cast.subject && predicate.reader === cast.reader &&
        (predicate.name === cast.name || unionKinds.get(cast.name)?.includes(predicate.name) === true);
    };
    const writes = (node, subject) => {
      if (node === undefined) return false;
      if (ast.is.IsBinaryExpression(node)) {
        const operator = ast.operatorKindName(node);
        const selected = identity(ast.as.AsBinaryExpression(node).Left);
        if (assignments.has(operator) && selected !== undefined &&
            (subject === selected || subject.startsWith(`${selected}.`))) return true;
      }
      if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
        const operand = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node).Operand : ast.as.AsPostfixUnaryExpression(node).Operand;
        const selected = identity(operand);
        if (["KindPlusPlusToken", "KindMinusMinusToken"].includes(ast.operatorKindName(node)) && selected === subject) return true;
      }
      return ast.children(node).some(child => child !== undefined && writes(child, subject));
    };
    const invalidates = (node, cast) => [cast.subject, cast.reader].some(reference => reference !== undefined && writes(node, reference));
    const protectedCast = (node, cast) => {
      for (let current = node; current !== undefined;) {
        const parent = ast.parent(current);
        if (parent === undefined || functions.has(ast.kindName(parent))) return false;
        if (ast.is.IsConditionalExpression(parent)) {
          const branch = ast.as.AsConditionalExpression(parent);
          if (current === branch.WhenTrue && proves(branch.Condition, cast, true) ||
              current === branch.WhenFalse && proves(branch.Condition, cast, false)) return true;
        }
        if (ast.is.IsIfStatement(parent)) {
          const branch = ast.as.AsIfStatement(parent);
          if (current === branch.ThenStatement && proves(branch.Expression, cast, true) ||
              current === branch.ElseStatement && proves(branch.Expression, cast, false)) return true;
        }
        if (ast.is.IsBinaryExpression(parent)) {
          const binary = ast.as.AsBinaryExpression(parent);
          if (current === binary.Right && invalidates(binary.Left, cast)) return false;
          if (current === binary.Right && ast.operatorKindName(parent) === "KindAmpersandAmpersandToken" && proves(binary.Left, cast, true) ||
              current === binary.Right && ast.operatorKindName(parent) === "KindBarBarToken" && proves(binary.Left, cast, false)) return true;
        }
        if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent) || ast.is.IsArrayLiteralExpression(parent)) {
          const operands = ast.is.IsArrayLiteralExpression(parent) ? ast.elements(parent) : ast.arguments(parent);
          const index = operands.indexOf(current);
          if (index > 0 && operands.slice(0, index).some(operand => invalidates(operand, cast))) return false;
        }
        if (ast.kindName(parent) === "KindBlock" || ast.kindName(parent) === "KindSourceFile") {
          const statements = ast.statements(parent);
          const index = statements.indexOf(current);
          for (let previous = index - 1; previous >= 0; previous -= 1) {
            const statement = statements[previous];
            if (invalidates(statement, cast)) return false;
            if (!ast.is.IsIfStatement(statement)) continue;
            const branch = ast.as.AsIfStatement(statement);
            if (exits(branch.ThenStatement) && proves(branch.Expression, cast, false) ||
                exits(branch.ElseStatement) && proves(branch.Expression, cast, true)) return true;
          }
        }
        current = parent;
      }
      return false;
    };
    const visit = node => {
      const cast = qualifiedCall(node, "as", "As");
      if (cast !== undefined && !protectedCast(node, cast)) {
        const range = ast.authoredRange(node);
        findings.push(Object.freeze({ file: path, line: ast.getSourceText(file).slice(0, range.start).split("\n").length,
          cast: `As${cast.name}`, rule: "unguarded-schema-cast" }));
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  return Object.freeze(findings);

  function unwrap(original) {
    let node = original;
    while (node !== undefined && ast.kindName(node) === "KindParenthesizedExpression") node = ast.as.AsParenthesizedExpression(node).Expression;
    return node;
  }

  function exits(node) {
    if (node === undefined) return false;
    if (["KindReturnStatement", "KindThrowStatement", "KindContinueStatement", "KindBreakStatement"].includes(ast.kindName(node))) return true;
    if (ast.kindName(node) === "KindBlock") return exits(ast.statements(node).at(-1));
    if (ast.is.IsIfStatement(node)) {
      const branch = ast.as.AsIfStatement(node);
      return exits(branch.ThenStatement) && exits(branch.ElseStatement);
    }
    return false;
  }
}
