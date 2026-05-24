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
  context: EmitterContext,
  mode: "value" | "static" = "value"
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

  if (descriptor.providerMemberName) {
    return `global::${descriptor.assembly}.${descriptor.providerMemberName}`;
  }

  const targetType =
    mode === "static" ? (descriptor.staticType ?? descriptor.type) : descriptor.type;
  return normalizeClrQualifiedName(targetType, true);
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
  identifierType(
    resolveExactGlobalBindingFqn(name, context, "static"),
    typeArguments
  );
