import {
  identifierExpression,
  identifierType,
} from "../core/format/backend-ast/builders.js";
import { normalizeClrQualifiedName } from "../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";

export const resolveExactGlobalBindingFqn = (
  name: string,
  context: EmitterContext
): string => {
  const descriptor = context.bindingRegistry?.getExactBindingByKind(
    name,
    "global"
  );
  if (!descriptor) {
    throw new Error(
      `Missing exact global binding '${name}' required for surface '${context.options.surface ?? "<unspecified>"}'.`
    );
  }

  if (descriptor.csharpName) {
    return `global::${descriptor.assembly}.${descriptor.csharpName}`;
  }

  return normalizeClrQualifiedName(
    descriptor.staticType ?? descriptor.type,
    true
  );
};

export const buildExactGlobalBindingReference = (
  name: string,
  context: EmitterContext
): CSharpExpressionAst =>
  identifierExpression(resolveExactGlobalBindingFqn(name, context));

export const buildExactGlobalBindingType = (
  name: string,
  typeArguments: readonly CSharpTypeAst[] | undefined,
  context: EmitterContext
): CSharpTypeAst =>
  identifierType(resolveExactGlobalBindingFqn(name, context), typeArguments);
