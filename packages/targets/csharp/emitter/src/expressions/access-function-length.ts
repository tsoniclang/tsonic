/**
 * Statically proven JavaScript function.length access.
 *
 * NativeAOT cannot inspect delegate metadata at runtime. This emitter lowers
 * supported `.length` reads from the function type carried in IR instead.
 */

import {
  type IrExpression,
  type IrParameter,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitExpressionAst } from "../expression-emitter.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  isRuntimeNullishType,
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  getRuntimeUnionReferenceMembers,
  isRuntimeUnionTypeName,
} from "../core/semantic/runtime-unions.js";
import {
  isSemanticUnion,
  willCarryAsRuntimeUnion,
} from "../core/semantic/union-semantics.js";
import { decimalIntegerLiteral } from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";

const INT_TYPE_AST = {
  kind: "predefinedType" as const,
  keyword: "int" as const,
};

const functionLengthFromParameters = (
  parameters: readonly IrParameter[]
): number => {
  let count = 0;
  for (const parameter of parameters) {
    if (parameter.isRest || parameter.initializer !== undefined) {
      break;
    }
    count += 1;
  }
  return count;
};

const functionLengthFromType = (
  type: IrType,
  context: EmitterContext
): number | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "functionType") {
    return functionLengthFromParameters(resolved.parameters);
  }

  if (
    resolved.kind === "intersectionType" &&
    resolved.types.length > 0
  ) {
    const functionTypes = resolved.types.filter(
      (member): member is Extract<IrType, { kind: "functionType" }> =>
        member.kind === "functionType"
    );
    if (functionTypes.length !== resolved.types.length) {
      return undefined;
    }

    const lengths = functionTypes.map((member) =>
      functionLengthFromParameters(member.parameters)
    );
    const [first] = lengths;
    return first !== undefined && lengths.every((length) => length === first)
      ? first
      : undefined;
  }

  return undefined;
};

const unionFunctionLengthMembers = (
  type: IrType,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const resolvedBase = resolveTypeAlias(stripNullish(type), context);
  const resolved =
    resolvedBase.kind === "intersectionType"
      ? (resolvedBase.types.find(
          (member): member is Extract<IrType, { kind: "referenceType" }> =>
            member.kind === "referenceType" &&
            isRuntimeUnionTypeName(member.name)
        ) ?? resolvedBase)
      : resolvedBase;
  const runtimeReferenceMembers =
    resolved.kind === "referenceType"
      ? getRuntimeUnionReferenceMembers(resolved)
      : undefined;
  const members =
    resolved.kind === "unionType"
      ? resolved.types
      : runtimeReferenceMembers
        ? runtimeReferenceMembers
        : undefined;
  const nonNullishMembers = members?.filter(
    (member) => !isRuntimeNullishType(member)
  );

  return nonNullishMembers && nonNullishMembers.length > 1
    ? nonNullishMembers
    : undefined;
};

const numericLengthLiteral = (length: number): CSharpExpressionAst =>
  decimalIntegerLiteral(length);

export const tryEmitFunctionLengthAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  objectType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.isComputed ||
    typeof expr.property !== "string" ||
    expr.property !== "length" ||
    expr.isOptional ||
    (expr.object.kind !== "identifier" && expr.object.kind !== "this") ||
    !objectType
  ) {
    return undefined;
  }

  const directLength = functionLengthFromType(objectType, context);
  if (directLength !== undefined) {
    return [numericLengthLiteral(directLength), context];
  }

  if (
    !isSemanticUnion(objectType, context) &&
    !willCarryAsRuntimeUnion(objectType, context)
  ) {
    return undefined;
  }

  const members = unionFunctionLengthMembers(objectType, context);
  if (!members) {
    return undefined;
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    objectType,
    context,
    emitTypeAst
  );
  const runtimeMembers = runtimeLayout?.members ?? members;
  const lengths = runtimeMembers.map((member) =>
    functionLengthFromType(member, layoutContext)
  );
  if (lengths.some((length) => length === undefined)) {
    return undefined;
  }

  const [objectAst, objectContext] = emitExpressionAst(expr.object, context);
  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: expr.isOptional
          ? "conditionalMemberAccessExpression"
          : "memberAccessExpression",
        expression: objectAst,
        memberName: "Match",
      },
      typeArguments: [INT_TYPE_AST],
      arguments: lengths.map((length, index): CSharpExpressionAst => ({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: `__m${index + 1}` }],
        body: numericLengthLiteral(length!),
      })),
    },
    objectContext,
  ];
};
