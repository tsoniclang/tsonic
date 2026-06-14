import {
  getTstsIdentifierText,
  getTstsNodeText,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";

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

const unwrapPropertyNameExpression = (expr: TstsNode): TstsNode => {
  let current = expr;
  for (;;) {
    if (current.Kind === TstsSyntax.KindParenthesizedExpression) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (
      current.Kind === TstsSyntax.KindAsExpression ||
      current.Kind === TstsSyntax.KindTypeAssertionExpression
    ) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (current.Kind === TstsSyntax.KindSatisfiesExpression) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (current.Kind === TstsSyntax.KindNonNullExpression) {
      const inner = TstsSyntax.Node_Expression(current);
      if (!inner) return current;
      current = inner;
      continue;
    }
    return current;
  }
};

const isSymbolNamespaceExpression = (expr: TstsNode): boolean => {
  const current = unwrapPropertyNameExpression(expr);
  if (current.Kind === TstsSyntax.KindIdentifier) {
    return getTstsIdentifierText(current) === "Symbol";
  }
  if (current.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const receiver = TstsSyntax.Node_Expression(current);
    return (
      receiver?.Kind === TstsSyntax.KindIdentifier &&
      getTstsIdentifierText(receiver) === "globalThis" &&
      getTstsIdentifierText(TstsSyntax.Node_Name(current)) === "Symbol"
    );
  }
  if (current.Kind === TstsSyntax.KindElementAccessExpression) {
    const elementAccess = TstsSyntax.AsElementAccessExpression(current);
    const expression = TstsSyntax.Node_Expression(current);
    if (!elementAccess || !expression) {
      return false;
    }
    const target = unwrapPropertyNameExpression(expression);
    const arg = elementAccess.ArgumentExpression
      ? unwrapPropertyNameExpression(elementAccess.ArgumentExpression)
      : undefined;
    return (
      target.Kind === TstsSyntax.KindIdentifier &&
      getTstsIdentifierText(target) === "globalThis" &&
      !!arg &&
      (arg.Kind === TstsSyntax.KindStringLiteral ||
        arg.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral) &&
      getTstsNodeText(arg) === "Symbol"
    );
  }
  return false;
};

export const makeWellKnownSymbolPropertyName = (name: string): string =>
  `${WELL_KNOWN_SYMBOL_PREFIX}${name}]`;

const tryResolveWellKnownSymbolPropertyName = (
  expr: TstsNode
): string | undefined => {
  const current = unwrapPropertyNameExpression(expr);

  if (current.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const receiver = TstsSyntax.Node_Expression(current);
    const name = getTstsIdentifierText(TstsSyntax.Node_Name(current));
    if (!receiver || !name || !isSymbolNamespaceExpression(receiver)) {
      return undefined;
    }
    return WELL_KNOWN_SYMBOL_PROPERTY_NAMES.has(name)
      ? makeWellKnownSymbolPropertyName(name)
      : undefined;
  }

  if (current.Kind === TstsSyntax.KindElementAccessExpression) {
    const elementAccess = TstsSyntax.AsElementAccessExpression(current);
    const receiver = TstsSyntax.Node_Expression(current);
    if (!elementAccess || !receiver || !isSymbolNamespaceExpression(receiver)) {
      return undefined;
    }
    const arg = elementAccess.ArgumentExpression
      ? unwrapPropertyNameExpression(elementAccess.ArgumentExpression)
      : undefined;
    if (
      !arg ||
      (arg.Kind !== TstsSyntax.KindStringLiteral &&
        arg.Kind !== TstsSyntax.KindNoSubstitutionTemplateLiteral)
    ) {
      return undefined;
    }
    const name = getTstsNodeText(arg);
    return name && WELL_KNOWN_SYMBOL_PROPERTY_NAMES.has(name)
      ? makeWellKnownSymbolPropertyName(name)
      : undefined;
  }

  return undefined;
};

export const tryResolveDeterministicPropertyNameFromExpression = (
  expr: TstsNode
): string | undefined => {
  const current = unwrapPropertyNameExpression(expr);

  if (
    current.Kind === TstsSyntax.KindStringLiteral ||
    current.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral ||
    current.Kind === TstsSyntax.KindNumericLiteral
  ) {
    return getTstsNodeText(current);
  }

  return tryResolveWellKnownSymbolPropertyName(current);
};

export const tryResolveDeterministicPropertyName = (
  name: TstsNode | undefined
): string | undefined => {
  if (!name) return undefined;

  if (
    name.Kind === TstsSyntax.KindIdentifier ||
    name.Kind === TstsSyntax.KindStringLiteral ||
    name.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral ||
    name.Kind === TstsSyntax.KindNumericLiteral ||
    name.Kind === TstsSyntax.KindPrivateIdentifier
  ) {
    return getTstsNodeText(name);
  }

  if (name.Kind === TstsSyntax.KindComputedPropertyName) {
    const computed = TstsSyntax.AsComputedPropertyName(name);
    return computed?.Expression
      ? tryResolveDeterministicPropertyNameFromExpression(computed.Expression)
      : undefined;
  }

  return undefined;
};

export const isWellKnownSymbolPropertyName = (name: string): boolean =>
  name.startsWith(WELL_KNOWN_SYMBOL_PREFIX) && name.endsWith("]");
