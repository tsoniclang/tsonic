import {
  identifierType,
  stringLiteral,
} from "../format/backend-ast/builders.js";
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

export const tryResolveRuntimeUnionCastSourceIndices = (
  valueAst: CSharpExpressionAst,
  sourceMemberTypeAsts: readonly CSharpTypeAst[]
): readonly number[] | undefined => {
  const castMemberTypeAsts = getRuntimeUnionCastMemberTypeAsts(valueAst);
  if (
    !castMemberTypeAsts ||
    castMemberTypeAsts.length < 2 ||
    castMemberTypeAsts.length >= sourceMemberTypeAsts.length
  ) {
    return undefined;
  }

  const restrictedIndices: number[] = [];
  const usedIndices = new Set<number>();
  for (const castMemberTypeAst of castMemberTypeAsts) {
    const matchingIndices = sourceMemberTypeAsts.flatMap(
      (sourceMemberTypeAst, index) =>
        !usedIndices.has(index) &&
        sourceMemberTypeAst &&
        sameTypeAstSurface(sourceMemberTypeAst, castMemberTypeAst)
          ? [index]
          : []
    );
    if (matchingIndices.length !== 1) {
      return undefined;
    }

    const matchedIndex = matchingIndices[0];
    if (matchedIndex === undefined) {
      return undefined;
    }
    restrictedIndices.push(matchedIndex);
    usedIndices.add(matchedIndex);
  }

  return restrictedIndices;
};

export const isRuntimeUnionTypeAst = (type: CSharpTypeAst): boolean => {
  const name = getIdentifierTypeName(type) ?? "";
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "global::Tsonic.Internal.Union" ||
    name === "Tsonic.Internal.Union" ||
    name === "Union" ||
    /^global::Tsonic\.Internal\.Union\d+$/.test(name) ||
    /^Tsonic\.Internal\.Union\d+$/.test(name) ||
    /^Union\d+$/.test(name) ||
    /^global::Tsonic\.Internal\.Union\d+_[A-F0-9]{8}$/.test(name) ||
    /^Tsonic\.Internal\.Union\d+_[A-F0-9]{8}$/.test(name) ||
    /^Union\d+_[A-F0-9]{8}$/.test(name)
  );
};

export const buildArrayShapeCondition = (
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "isExpression",
  expression: boxValueAst(valueAst),
  pattern: {
    kind: "typePattern",
    type: identifierType("global::System.Array"),
  },
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
