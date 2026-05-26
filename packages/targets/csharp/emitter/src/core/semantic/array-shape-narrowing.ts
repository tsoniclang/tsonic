import { type IrType, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  booleanLiteral,
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../format/backend-ast/builders.js";
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "./runtime-union-alias-identity.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export type EmitTypeAstFn = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeArrayShapeCondition = {
  readonly condition: CSharpExpressionAst;
  readonly context: EmitterContext;
  readonly pathCount: number;
  readonly hasNestedPath: boolean;
};

const typeVisitKey = (type: IrType, context: EmitterContext): string => {
  const aliasKey = getRuntimeUnionAliasReferenceKey(type, context);
  if (aliasKey) {
    return aliasKey;
  }
  if (type.kind === "referenceType") {
    return `ref:${type.providerQualifiedName ?? type.name}`;
  }
  return `kind:${type.kind}`;
};

export const isArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }
  return (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" || resolved.name === "ReadonlyArray")
  );
};

export const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext,
  seenKeys: ReadonlySet<string> = new Set()
): IrType | undefined => {
  if (!currentType) return undefined;

  if (isArrayLikeNarrowingCandidate(currentType, context)) {
    return wantArray ? stripNullish(currentType) : undefined;
  }

  const stripped = stripNullish(currentType);
  const key = typeVisitKey(stripped, context);
  if (seenKeys.has(key)) {
    return undefined;
  }
  const nextSeenKeys = new Set([...seenKeys, key]);

  const resolved = resolveTypeAlias(stripped, context);
  if (resolved.kind === "unionType") {
    const kept = resolved.types.flatMap((member) => {
      const narrowed = narrowTypeByArrayShape(
        member,
        wantArray,
        context,
        nextSeenKeys
      );
      return narrowed ? [narrowed] : [];
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return wantArray ? undefined : stripped;
};

const buildIsMemberCondition = (
  receiver: CSharpExpressionAst,
  memberN: number
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: receiver,
    memberName: `Is${memberN}`,
  },
  arguments: [],
});

const buildAsMemberExpression = (
  receiver: CSharpExpressionAst,
  memberN: number
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: receiver,
    memberName: `As${memberN}`,
  },
  arguments: [],
});

const andCondition = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression: {
    kind: "binaryExpression",
    operatorToken: "&&",
    left,
    right,
  },
});

const orConditions = (
  conditions: readonly CSharpExpressionAst[]
): CSharpExpressionAst =>
  conditions.reduce<CSharpExpressionAst | undefined>(
    (current, condition) =>
      current
        ? {
            kind: "parenthesizedExpression",
            expression: {
              kind: "binaryExpression",
              operatorToken: "||",
              left: current,
              right: condition,
            },
          }
        : condition,
    undefined
  ) ?? booleanLiteral(false);

const buildNonNullRuntimeCarrierCondition = (
  receiver: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "!=",
  left: {
    kind: "parenthesizedExpression",
    expression: {
      kind: "castExpression",
      type: identifierType("global::System.Object"),
      expression: {
        kind: "parenthesizedExpression",
        expression: receiver,
      },
    },
  },
  right: nullLiteral(),
});

const buildRuntimeArrayShapeInnerCondition = (
  receiver: CSharpExpressionAst,
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  seenKeys: ReadonlySet<string>,
  depth: number
): RuntimeArrayShapeCondition | undefined => {
  if (isArrayLikeNarrowingCandidate(type, context)) {
    return {
      condition: booleanLiteral(true),
      context,
      pathCount: 1,
      hasNestedPath: depth > 0,
    };
  }

  const key = typeVisitKey(stripNullish(type), context);
  if (seenKeys.has(key)) {
    return undefined;
  }
  const nextSeenKeys = new Set([...seenKeys, key]);

  const [layout, layoutContext] = buildRuntimeUnionLayout(
    type,
    context,
    emitTypeAst
  );
  if (!layout) {
    return undefined;
  }

  const memberConditions: CSharpExpressionAst[] = [];
  let currentContext = layoutContext;
  let pathCount = 0;
  let hasNestedPath = false;

  for (let index = 0; index < layout.members.length; index += 1) {
    const member = layout.members[index];
    if (!member) continue;

    const memberN = index + 1;
    const memberCheck = buildIsMemberCondition(receiver, memberN);
    if (isArrayLikeNarrowingCandidate(member, currentContext)) {
      memberConditions.push(memberCheck);
      pathCount += 1;
      hasNestedPath ||= depth > 0;
      continue;
    }

    const nested = buildRuntimeArrayShapeInnerCondition(
      buildAsMemberExpression(receiver, memberN),
      member,
      currentContext,
      emitTypeAst,
      nextSeenKeys,
      depth + 1
    );
    if (!nested) continue;

    currentContext = nested.context;
    memberConditions.push(andCondition(memberCheck, nested.condition));
    pathCount += nested.pathCount;
    hasNestedPath ||= true;
  }

  if (memberConditions.length === 0) {
    return undefined;
  }

  return {
    condition: orConditions(memberConditions),
    context: currentContext,
    pathCount,
    hasNestedPath,
  };
};

export const buildRuntimeArrayShapeCondition = (
  receiver: CSharpExpressionAst,
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): RuntimeArrayShapeCondition | undefined => {
  const inner = buildRuntimeArrayShapeInnerCondition(
    receiver,
    type,
    context,
    emitTypeAst,
    new Set(),
    0
  );
  if (!inner) {
    return undefined;
  }

  return {
    ...inner,
    condition: andCondition(
      buildNonNullRuntimeCarrierCondition(receiver),
      inner.condition
    ),
  };
};

export const runtimeTypeHasNestedArrayShape = (
  type: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): boolean =>
  buildRuntimeArrayShapeCondition(
    identifierExpression("__tsonic_shape_probe"),
    type,
    context,
    emitTypeAst
  )?.hasNestedPath === true;

export const shouldReuseDirectRuntimeMemberArrayGuard = (
  type: IrType,
  directArrayMemberCount: number,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): boolean => {
  const condition = buildRuntimeArrayShapeCondition(
    identifierExpression("__tsonic_shape_probe"),
    type,
    context,
    emitTypeAst
  );
  return (
    !!condition &&
    !condition.hasNestedPath &&
    condition.pathCount === directArrayMemberCount
  );
};

export const arrayShapeNarrowingIsIdentity = (
  type: IrType | undefined,
  narrowedType: IrType | undefined,
  context: EmitterContext
): boolean =>
  !!type &&
  !!narrowedType &&
  runtimeUnionAliasReferencesMatch(type, narrowedType, context);
