import * as ts from "typescript";

const WELL_KNOWN_SYMBOL_PROPERTY_NAMES = new Set([
  "asyncDispose",
  "asyncIterator",
  "dispose",
  "hasInstance",
  "isConcatSpreadable",
  "iterator",
  "match",
  "matchAll",
  "replace",
  "search",
  "species",
  "split",
  "toPrimitive",
  "toStringTag",
  "unscopables",
]);

const WELL_KNOWN_SYMBOL_PREFIX = "[symbol:";

const unwrapPropertyNameExpression = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  for (;;) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }
    return current;
  }
};

const isSymbolNamespaceExpression = (expr: ts.Expression): boolean => {
  const current = unwrapPropertyNameExpression(expr);
  if (ts.isIdentifier(current)) {
    return current.text === "Symbol";
  }
  if (ts.isPropertyAccessExpression(current)) {
    return (
      ts.isIdentifier(current.expression) &&
      current.expression.text === "globalThis" &&
      current.name.text === "Symbol"
    );
  }
  if (ts.isElementAccessExpression(current)) {
    const target = unwrapPropertyNameExpression(current.expression);
    const arg = current.argumentExpression
      ? unwrapPropertyNameExpression(current.argumentExpression)
      : undefined;
    return (
      ts.isIdentifier(target) &&
      target.text === "globalThis" &&
      !!arg &&
      (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
      arg.text === "Symbol"
    );
  }
  return false;
};

export const makeWellKnownSymbolPropertyName = (name: string): string =>
  `${WELL_KNOWN_SYMBOL_PREFIX}${name}]`;

const tryResolveWellKnownSymbolPropertyName = (
  expr: ts.Expression
): string | undefined => {
  const current = unwrapPropertyNameExpression(expr);

  if (ts.isPropertyAccessExpression(current)) {
    if (!isSymbolNamespaceExpression(current.expression)) return undefined;
    return WELL_KNOWN_SYMBOL_PROPERTY_NAMES.has(current.name.text)
      ? makeWellKnownSymbolPropertyName(current.name.text)
      : undefined;
  }

  if (ts.isElementAccessExpression(current)) {
    if (!isSymbolNamespaceExpression(current.expression)) return undefined;
    const arg = current.argumentExpression
      ? unwrapPropertyNameExpression(current.argumentExpression)
      : undefined;
    if (
      !arg ||
      (!ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg))
    ) {
      return undefined;
    }
    return WELL_KNOWN_SYMBOL_PROPERTY_NAMES.has(arg.text)
      ? makeWellKnownSymbolPropertyName(arg.text)
      : undefined;
  }

  return undefined;
};

export const tryResolveDeterministicPropertyNameFromExpression = (
  expr: ts.Expression
): string | undefined => {
  const current = unwrapPropertyNameExpression(expr);

  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current)
  ) {
    return current.text;
  }

  return tryResolveWellKnownSymbolPropertyName(current);
};

export const tryResolveDeterministicPropertyName = (
  name: ts.PropertyName | ts.PrivateIdentifier | ts.BindingName | undefined
): string | undefined => {
  if (!name) return undefined;

  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isPrivateIdentifier(name)
  ) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    return tryResolveDeterministicPropertyNameFromExpression(name.expression);
  }

  return undefined;
};

export const isWellKnownSymbolPropertyName = (name: string): boolean =>
  name.startsWith(WELL_KNOWN_SYMBOL_PREFIX) && name.endsWith("]");
