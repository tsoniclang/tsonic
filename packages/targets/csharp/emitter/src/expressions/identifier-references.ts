import type { EmitterContext } from "../types.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

export const resolveModuleValueSymbolReferenceAst = (
  sourceName: string,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  const hasLocalShadow =
    context.localNameMap?.has(sourceName) === true &&
    ((context.localSemanticTypes?.has(sourceName) ?? false) ||
      (context.localValueTypes?.has(sourceName) ?? false));
  if (hasLocalShadow) {
    return undefined;
  }

  const valueSymbol = context.valueSymbols?.get(sourceName);
  if (!valueSymbol) {
    return undefined;
  }

  const memberName = escapeCSharpIdentifier(valueSymbol.csharpName);
  if (
    context.moduleStaticClassName &&
    context.className !== context.moduleStaticClassName
  ) {
    const moduleNamespace =
      context.moduleNamespace ?? context.options.rootNamespace;
    const containerPrefix = moduleNamespace.startsWith("global::")
      ? moduleNamespace
      : `global::${moduleNamespace}`;
    return identifierExpression(
      `${containerPrefix}.${context.moduleStaticClassName}.${memberName}`
    );
  }

  return identifierExpression(memberName);
};
