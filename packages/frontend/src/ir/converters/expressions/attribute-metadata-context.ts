import * as ts from "typescript";

const ATTRIBUTES_IMPORT_SPECIFIER = "@tsonic/core/lang.js";

const stripParentheses = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const getAttributesApiLocalNames = (
  sourceFile: ts.SourceFile
): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== ATTRIBUTES_IMPORT_SPECIFIER) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === "attributes") {
        names.add(element.name.text);
      }
    }
  }
  return names;
};

const isAttributesApiRootExpression = (
  expression: ts.Expression,
  localNames: ReadonlySet<string>
): boolean => {
  const current = stripParentheses(expression);

  if (ts.isIdentifier(current)) {
    return localNames.has(current.text);
  }

  if (ts.isCallExpression(current)) {
    return isAttributesApiRootExpression(current.expression, localNames);
  }

  if (ts.isPropertyAccessExpression(current)) {
    return isAttributesApiRootExpression(current.expression, localNames);
  }

  return false;
};

export const isAttributeMetadataNamedArgumentPosition = (
  call: ts.CallExpression,
  argumentIndex: number,
  expression: ts.Expression
): boolean => {
  const unwrapped = stripParentheses(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) {
    return false;
  }

  if (argumentIndex === 0) {
    return false;
  }

  const callee = stripParentheses(call.expression);
  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }

  if (callee.name.text !== "add" && callee.name.text !== "attr") {
    return false;
  }

  const attributesApiLocalNames = getAttributesApiLocalNames(
    call.getSourceFile()
  );
  if (attributesApiLocalNames.size === 0) {
    return false;
  }

  return isAttributesApiRootExpression(
    callee.expression,
    attributesApiLocalNames
  );
};

export const isAttributeMetadataNamedArgumentObjectLiteral = (
  node: ts.ObjectLiteralExpression
): boolean => {
  let expression: ts.Expression = node;
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) {
    expression = parent;
    parent = parent.parent;
  }

  if (!parent || !ts.isCallExpression(parent)) {
    return false;
  }

  const argumentIndex = parent.arguments.findIndex(
    (argument) => stripParentheses(argument) === node
  );
  if (argumentIndex < 0) {
    return false;
  }

  return isAttributeMetadataNamedArgumentPosition(
    parent,
    argumentIndex,
    expression
  );
};
