import { identifierExpression, identifierType, stringLiteral } from "../format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";

export const boxValueAst = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => {
  if (
    valueAst.kind === "castExpression" &&
    valueAst.type.kind === "predefinedType" &&
    valueAst.type.keyword === "object"
  ) {
    return valueAst;
  }

  return {
    kind: "castExpression",
    type: { kind: "predefinedType", keyword: "object" },
    expression: valueAst,
  };
};

export const getRuntimeUnionCastMemberTypeAsts = (
  valueAst: CSharpExpressionAst
): readonly CSharpTypeAst[] | undefined => {
  const unwrappedValueAst =
    valueAst.kind === "parenthesizedExpression"
      ? valueAst.expression
      : valueAst;
  if (unwrappedValueAst.kind !== "castExpression") {
    return undefined;
  }

  const castTypeAst = stripNullableTypeAst(unwrappedValueAst.type);
  if (!isRuntimeUnionTypeAst(castTypeAst)) {
    return undefined;
  }

  if (
    castTypeAst.kind !== "identifierType" &&
    castTypeAst.kind !== "qualifiedIdentifierType"
  ) {
    return undefined;
  }

  return castTypeAst.typeArguments?.map(stripNullableTypeAst);
};

export const isRuntimeUnionTypeAst = (type: CSharpTypeAst): boolean => {
  const name = getIdentifierTypeName(type);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

export const buildArrayShapeCondition = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: identifierExpression(
    "global::Tsonic.JSRuntime.JSArrayStatics.isArray"
  ),
  arguments: [boxValueAst(valueAst)],
});

export const buildInvalidReificationExpression = (
  description: string
): CSharpExpressionAst => ({
  kind: "throwExpression",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [stringLiteral(description)],
  },
});

export const maybeCastMaterializedValueAst = (
  valueAst: CSharpExpressionAst,
  actualTypeAst: CSharpTypeAst | undefined,
  targetTypeAst: CSharpTypeAst
): CSharpExpressionAst => {
  if (actualTypeAst && sameTypeAstSurface(actualTypeAst, targetTypeAst)) {
    return valueAst;
  }

  return {
    kind: "castExpression",
    type: targetTypeAst,
    expression: valueAst,
  };
};
