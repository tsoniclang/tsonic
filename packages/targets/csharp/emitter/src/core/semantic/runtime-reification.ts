import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import {
  booleanLiteral,
  identifierType,
  identifierExpression,
  nullLiteral,
  nullableType,
} from "../format/backend-ast/builders.js";
import {
  sameTypeAstSurface,
  stableConcreteTypeKeyFromAst,
  stripNullableTypeAst,
} from "../format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpPatternAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  emitRuntimeCarrierTypeAst,
  findRuntimeUnionMemberIndex,
  findRuntimeUnionMemberIndices,
  getCanonicalRuntimeUnionMembers,
} from "./runtime-unions.js";
import type { RuntimeUnionLayout } from "./runtime-unions.js";
import {
  buildRuntimeUnionFactoryCallAst,
  buildInvalidRuntimeUnionMaterializationExpression,
  buildRuntimeUnionMatchAst,
  isRuntimeUnionMemberProjectionAst,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./runtime-union-projection.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "./direct-value-surfaces.js";
import { resolveRuntimeStorageType } from "./storage-types.js";
import {
  getArrayLikeElementType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import { semanticType } from "./type-domains.js";
import { isBroadObjectSlotType } from "./broad-object-types.js";
import {
  boxValueAst,
  buildArrayShapeCondition,
  buildInvalidReificationExpression,
  getRuntimeUnionCastMemberTypeAsts,
  maybeCastMaterializedValueAst,
  tryResolveRuntimeUnionCastSourceIndices,
} from "./runtime-reification-helpers.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "./runtime-union-alias-identity.js";
import { resolveRuntimeMaterializationTargetType } from "./runtime-materialization-targets.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "./expected-type-matching.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";
import {
  getDirectIterableElementType,
  getIterableSourceShape,
} from "../../expressions/structural-type-shapes.js";
import { emitCSharpName } from "../../naming-policy.js";

export type EmitTypeAstFn = (
  type: IrType,
  context: EmitterContext
) => [CSharpTypeAst, EmitterContext];

export type RuntimeReificationPlan = {
  readonly condition: CSharpExpressionAst;
  readonly value: CSharpExpressionAst;
  readonly context: EmitterContext;
};

type RecursiveRuntimeReificationHelper = {
  readonly expectedType: IrType;
  readonly name: string;
  readonly typeAst: CSharpTypeAst;
};

type RuntimeReificationOptions = {
  readonly typeAst?: CSharpTypeAst;
  readonly layout?: RuntimeUnionLayout;
  readonly layoutType?: IrType;
  readonly context?: EmitterContext;
  readonly recursiveHelper?: RecursiveRuntimeReificationHelper;
  readonly activeTypes?: ReadonlySet<IrType>;
};

export type RuntimeMaterializationSourceFrame = {
  readonly members: readonly IrType[];
  readonly candidateMemberNs?: readonly number[];
  readonly runtimeUnionArity?: number;
};

const stripRuntimeCarrierFamilyForSubset = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const stripped = {
    kind: "unionType",
    types: type.types.map(stripRuntimeCarrierFamilyForSubset),
  } as const satisfies Extract<IrType, { kind: "unionType" }>;

  return type.runtimeUnionLayout === "carrierSlotOrder"
    ? { ...stripped, runtimeUnionLayout: "carrierSlotOrder" }
    : stripped;
};

export const buildExpectedRuntimeCarrierTarget = (
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst?: EmitTypeAstFn
): IrType => {
  const resolvedExpectedType =
    expectedType.kind === "referenceType"
      ? resolveTypeAlias(expectedType, context, {
          preserveObjectTypeAliases: true,
        })
      : expectedType;
  if (
    expectedType.kind === "referenceType" &&
    resolvedExpectedType.kind === "unionType" &&
    resolvedExpectedType.runtimeCarrierFamilyKey
  ) {
    return expectedType;
  }
  if (resolvedExpectedType.kind !== "unionType") {
    return expectedType;
  }

  if (emitTypeAst) {
    const [layout] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (layout) {
      return {
        ...resolvedExpectedType,
        types: layout.members,
        runtimeUnionLayout: "carrierSlotOrder",
      };
    }
  }

  if (
    resolvedExpectedType.runtimeCarrierTypeArguments &&
    resolvedExpectedType.runtimeCarrierTypeArguments.length ===
      resolvedExpectedType.types.length
  ) {
    return {
      ...resolvedExpectedType,
      types: resolvedExpectedType.runtimeCarrierTypeArguments,
      runtimeUnionLayout: "carrierSlotOrder",
    };
  }

  const storageType = resolveRuntimeStorageType(resolvedExpectedType, context);
  if (storageType && storageType.kind !== "unionType") {
    return storageType;
  }

  return {
    ...resolvedExpectedType,
    types: resolvedExpectedType.types.map(
      (member) => resolveRuntimeStorageType(member, context) ?? member
    ),
    runtimeUnionLayout: "carrierSlotOrder",
  };
};

const isBroadObjectRuntimeMemberType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context, {
    preserveObjectTypeAliases: true,
  });
  return (
    (resolved.kind === "referenceType" && resolved.name === "object") ||
    isBroadObjectSlotType(resolved, context)
  );
};

const tryBuildBroadObjectCatchAllReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): RuntimeReificationPlan | undefined => {
  if (!isBroadObjectSlotType(expectedType, context)) {
    return undefined;
  }

  const [expectedTypeAst, nextContext] = emitTypeAst(expectedType, context);
  return {
    condition: booleanLiteral(true),
    value: {
      kind: "castExpression",
      type: stripNullableTypeAst(expectedTypeAst),
      expression: valueAst,
    },
    context: nextContext,
  };
};

const objectNullableTypeAst = (): CSharpTypeAst =>
  nullableType(identifierType("object"));

const dictionaryTypeAst = (valueTypeAst: CSharpTypeAst): CSharpTypeAst =>
  identifierType("global::System.Collections.Generic.Dictionary", [
    identifierType("string"),
    valueTypeAst,
  ]);

const runtimeReificationHelperName = (unionTypeAst: CSharpTypeAst): string => {
  const suffix = stableConcreteTypeKeyFromAst(unionTypeAst)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-64);
  return `__tsonic_reify_${suffix || "runtime_union"}`;
};

const materializedExpressionMatchesTargetType = (
  valueAst: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): boolean => {
  const directType =
    resolveDirectRuntimeCarrierType(valueAst, context) ??
    resolveDirectValueSurfaceType(valueAst, context);
  if (!directType) {
    return false;
  }
  const [directRuntimeLayout] = buildRuntimeUnionLayout(
    directType,
    context,
    emitTypeAst
  );
  const [targetRuntimeLayout] = buildRuntimeUnionLayout(
    targetType,
    context,
    emitTypeAst
  );

  if (
    runtimeUnionAliasReferencesMatch(directType, targetType, context) ||
    (matchesExpectedEmissionType(directType, targetType, context) &&
      (!directRuntimeLayout || targetRuntimeLayout !== undefined)) ||
    areIrTypesEquivalent(directType, targetType, context)
  ) {
    return true;
  }

  const [directTypeAst, directTypeContext] = emitTypeAst(directType, context);
  const [targetTypeAst, targetTypeContext] = emitTypeAst(
    targetType,
    directTypeContext
  );
  return (
    sameTypeAstSurface(
      stripNullableTypeAst(directTypeAst),
      stripNullableTypeAst(targetTypeAst)
    ) &&
    !requiresValueTypeMaterialization(directType, targetType, targetTypeContext)
  );
};

const buildRuntimeReificationHelperCallAst = (
  helperName: string,
  valueAst: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: identifierExpression(helperName),
  arguments: [boxValueAst(valueAst)],
});

const typeMatchesRecursiveReificationTarget = (
  type: IrType,
  helper: RecursiveRuntimeReificationHelper | undefined,
  context: EmitterContext
): boolean => {
  if (!helper) {
    return false;
  }
  const stripped = stripNullish(type);
  const target = stripNullish(helper.expectedType);
  if (stripped === target) {
    return true;
  }
  const resolvedTarget = resolveTypeAlias(target, context, {
    preserveObjectTypeAliases: true,
  });
  const resolvedStripped = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    stripped === resolvedTarget ||
    resolvedStripped === target ||
    resolvedStripped === resolvedTarget
  ) {
    return true;
  }
  const strippedAliasKey = getRuntimeUnionAliasReferenceKey(stripped, context);
  const targetAliasKey = getRuntimeUnionAliasReferenceKey(target, context);
  return (
    strippedAliasKey !== undefined &&
    targetAliasKey !== undefined &&
    strippedAliasKey === targetAliasKey
  );
};

const hasTopLevelRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "unionType" &&
  type.types.some(
    (member) =>
      member.kind === "voidType" ||
      (member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined"))
  );

const runtimeMemberCanRepresentSemanticArrayMember = (
  runtimeMember: IrType,
  semanticMember: IrType,
  context: EmitterContext
): boolean => {
  const runtimeElementType = getArrayLikeElementType(runtimeMember, context);
  const semanticElementType = getArrayLikeElementType(semanticMember, context);
  return (
    !!runtimeElementType &&
    !!semanticElementType &&
    ((runtimeElementType.kind === "referenceType" &&
      runtimeElementType.name === "object") ||
      isBroadObjectSlotType(runtimeElementType, context))
  );
};

const alignSemanticRuntimeUnionMembers = (
  runtimeMembers: readonly IrType[],
  semanticMembers: readonly IrType[],
  context: EmitterContext
): readonly IrType[] => {
  if (semanticMembers.length === 0) {
    return runtimeMembers;
  }

  const claimedSemanticIndices = new Set<number>();
  return runtimeMembers.map((runtimeMember) => {
    const candidates = semanticMembers.flatMap((semanticMember, index) => {
      if (claimedSemanticIndices.has(index)) {
        return [];
      }
      const matches =
        findRuntimeUnionMemberIndices([runtimeMember], semanticMember, context)
          .length === 1 ||
        runtimeMemberCanRepresentSemanticArrayMember(
          runtimeMember,
          semanticMember,
          context
        );
      return matches ? [{ index, semanticMember }] : [];
    });

    if (candidates.length !== 1) {
      return runtimeMember;
    }

    const candidate = candidates[0];
    if (!candidate) {
      return runtimeMember;
    }
    claimedSemanticIndices.add(candidate.index);
    return candidate.semanticMember;
  });
};

const typeContainsRecursiveReificationTarget = (
  type: IrType,
  targetType: IrType,
  context: EmitterContext,
  seenKeys: ReadonlySet<string> = new Set(),
  seenTypes: ReadonlySet<IrType> = new Set()
): boolean => {
  const stripped = stripNullish(type);
  const strippedTarget = stripNullish(targetType);
  if (stripped === strippedTarget) {
    return true;
  }
  const resolvedTarget = resolveTypeAlias(strippedTarget, context, {
    preserveObjectTypeAliases: true,
  });
  const resolvedStripped = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    stripped === resolvedTarget ||
    resolvedStripped === strippedTarget ||
    resolvedStripped === resolvedTarget
  ) {
    return true;
  }
  if (seenTypes.has(stripped)) {
    return false;
  }
  const nextSeenTypes = new Set([...seenTypes, stripped]);

  const strippedAliasKey = getRuntimeUnionAliasReferenceKey(stripped, context);
  const targetAliasKey = getRuntimeUnionAliasReferenceKey(
    strippedTarget,
    context
  );
  if (
    strippedAliasKey !== undefined &&
    targetAliasKey !== undefined &&
    strippedAliasKey === targetAliasKey
  ) {
    return true;
  }

  if (strippedAliasKey && seenKeys.has(strippedAliasKey)) {
    return false;
  }
  const nextSeenKeys = strippedAliasKey
    ? new Set([...seenKeys, strippedAliasKey])
    : seenKeys;

  const resolved = resolveTypeAlias(stripped, context, {
    preserveObjectTypeAliases: true,
  });
  switch (resolved.kind) {
    case "arrayType":
      return typeContainsRecursiveReificationTarget(
        resolved.elementType,
        targetType,
        context,
        nextSeenKeys,
        nextSeenTypes
      );
    case "dictionaryType":
      return typeContainsRecursiveReificationTarget(
        resolved.valueType,
        targetType,
        context,
        nextSeenKeys,
        nextSeenTypes
      );
    case "tupleType":
      return resolved.elementTypes.some((elementType) =>
        typeContainsRecursiveReificationTarget(
          elementType,
          targetType,
          context,
          nextSeenKeys,
          nextSeenTypes
        )
      );
    case "unionType":
      return resolved.types.some((member) =>
        typeContainsRecursiveReificationTarget(
          member,
          targetType,
          context,
          nextSeenKeys,
          nextSeenTypes
        )
      );
    default:
      return false;
  }
};

const precomputedRuntimeLayoutAppliesTo = (
  expectedType: IrType,
  options: RuntimeReificationOptions,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): boolean => {
  if (!options.layout || !options.typeAst || !options.layoutType) {
    return false;
  }

  const expected = stripNullish(expectedType);
  const layoutType = stripNullish(options.layoutType);
  return (
    expected === layoutType ||
    (runtimeUnionAliasReferencesMatch(expected, layoutType, context) &&
      runtimeUnionCarrierSurfacesMatch(
        expected,
        layoutType,
        context,
        emitTypeAst
      ))
  );
};

const runtimeUnionCarrierSurfacesMatch = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): boolean => {
  const [sourceTypeAst, sourceContext] = emitTypeAst(sourceType, context);
  const [targetTypeAst] = emitTypeAst(targetType, sourceContext);

  return sameTypeAstSurface(
    stripNullableTypeAst(sourceTypeAst),
    stripNullableTypeAst(targetTypeAst)
  );
};

const buildZeroArgLambdaInvocationAst = (
  returnType: CSharpTypeAst,
  statements: readonly CSharpStatementAst[]
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "parenthesizedExpression",
    expression: {
      kind: "castExpression",
      type: identifierType("global::System.Func", [returnType]),
      expression: {
        kind: "parenthesizedExpression",
        expression: {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [],
          body: {
            kind: "blockStatement",
            statements,
          },
        },
      },
    },
  },
  arguments: [],
});

const buildInvalidCastThrowStatement = (
  message: string
): CSharpStatementAst => ({
  kind: "throwStatement",
  expression: {
    kind: "objectCreationExpression",
    type: identifierType("global::System.InvalidCastException"),
    arguments: [
      {
        kind: "stringLiteralExpression",
        value: message,
      },
    ],
  },
});

const allocateRuntimeReificationLocalName = (
  baseName: string,
  context: EmitterContext
): { readonly name: string; readonly context: EmitterContext } => {
  const used = context.usedLocalNames ?? new Set<string>();
  if (!used.has(baseName)) {
    return {
      name: baseName,
      context: {
        ...context,
        usedLocalNames: new Set([...used, baseName]),
      },
    };
  }

  let suffix = 1;
  while (true) {
    const candidate = `${baseName}__${suffix}`;
    if (!used.has(candidate)) {
      return {
        name: candidate,
        context: {
          ...context,
          usedLocalNames: new Set([...used, candidate]),
        },
      };
    }
    suffix += 1;
  }
};

const isStableRuntimeReificationInputAst = (
  ast: CSharpExpressionAst
): boolean => {
  switch (ast.kind) {
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
      return true;
    case "parenthesizedExpression":
    case "suppressNullableWarningExpression":
      return isStableRuntimeReificationInputAst(ast.expression);
    case "castExpression":
    case "asExpression":
      return isStableRuntimeReificationInputAst(ast.expression);
    default:
      return false;
  }
};

const countExpressionReferenceAst = (
  ast: CSharpExpressionAst,
  sourceAst: CSharpExpressionAst
): number => {
  if (ast === sourceAst) {
    return 1;
  }

  switch (ast.kind) {
    case "parenthesizedExpression":
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
    case "castExpression":
    case "asExpression":
    case "awaitExpression":
    case "throwExpression":
    case "suppressNullableWarningExpression":
    case "argumentModifierExpression":
      return countExpressionReferenceAst(ast.expression, sourceAst);
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
      return (
        countExpressionReferenceAst(ast.expression, sourceAst) +
        ast.arguments.reduce(
          (count, argument) =>
            count + countExpressionReferenceAst(argument, sourceAst),
          0
        )
      );
    case "implicitElementAccessExpression":
      return ast.arguments.reduce(
        (count, argument) =>
          count + countExpressionReferenceAst(argument, sourceAst),
        0
      );
    case "invocationExpression":
      return (
        countExpressionReferenceAst(ast.expression, sourceAst) +
        ast.arguments.reduce(
          (count, argument) =>
            count + countExpressionReferenceAst(argument, sourceAst),
          0
        )
      );
    case "objectCreationExpression":
      return (
        ast.arguments.reduce(
          (count, argument) =>
            count + countExpressionReferenceAst(argument, sourceAst),
          0
        ) +
        (ast.initializer ?? []).reduce(
          (count, entry) => count + countExpressionReferenceAst(entry, sourceAst),
          0
        )
      );
    case "anonymousObjectCreationExpression":
      return ast.initializer.reduce(
        (count, entry) => count + countExpressionReferenceAst(entry, sourceAst),
        0
      );
    case "arrayCreationExpression":
      return (
        (ast.sizeExpression
          ? countExpressionReferenceAst(ast.sizeExpression, sourceAst)
          : 0) +
        (ast.initializer ?? []).reduce(
          (count, entry) => count + countExpressionReferenceAst(entry, sourceAst),
          0
        )
      );
    case "stackAllocArrayCreationExpression":
      return countExpressionReferenceAst(ast.sizeExpression, sourceAst);
    case "assignmentExpression":
    case "binaryExpression":
      return (
        countExpressionReferenceAst(ast.left, sourceAst) +
        countExpressionReferenceAst(ast.right, sourceAst)
      );
    case "prefixUnaryExpression":
    case "postfixUnaryExpression":
      return countExpressionReferenceAst(ast.operand, sourceAst);
    case "conditionalExpression":
      return (
        countExpressionReferenceAst(ast.condition, sourceAst) +
        countExpressionReferenceAst(ast.whenTrue, sourceAst) +
        countExpressionReferenceAst(ast.whenFalse, sourceAst)
      );
    case "isExpression":
      return countExpressionReferenceAst(ast.expression, sourceAst);
    case "lambdaExpression":
      return ast.body.kind === "blockStatement"
        ? countStatementReferenceAst(ast.body, sourceAst)
        : countExpressionReferenceAst(ast.body, sourceAst);
    case "interpolatedStringExpression":
      return ast.parts.reduce(
        (count, part) =>
          part.kind === "interpolation"
            ? count + countExpressionReferenceAst(part.expression, sourceAst)
            : count,
        0
      );
    case "switchExpression":
      return (
        countExpressionReferenceAst(ast.governingExpression, sourceAst) +
        ast.arms.reduce(
          (count, arm) =>
            count +
            (arm.whenClause
              ? countExpressionReferenceAst(arm.whenClause, sourceAst)
              : 0) +
            countExpressionReferenceAst(arm.expression, sourceAst),
          0
        )
      );
    case "tupleExpression":
      return ast.elements.reduce(
        (count, element) => count + countExpressionReferenceAst(element, sourceAst),
        0
      );
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
    case "typeReferenceExpression":
    case "defaultExpression":
    case "sizeOfExpression":
    case "typeofExpression":
    case "declarationExpression":
      return 0;
  }
};

const countPatternReferenceAst = (
  pattern: CSharpPatternAst,
  sourceAst: CSharpExpressionAst
): number => {
  switch (pattern.kind) {
    case "constantPattern":
      return countExpressionReferenceAst(pattern.expression, sourceAst);
    case "negatedPattern":
      return countPatternReferenceAst(pattern.pattern, sourceAst);
    default:
      return 0;
  }
};

const countStatementReferenceAst = (
  statement: CSharpStatementAst,
  sourceAst: CSharpExpressionAst
): number => {
  switch (statement.kind) {
    case "blockStatement":
      return statement.statements.reduce(
        (count, nested) => count + countStatementReferenceAst(nested, sourceAst),
        0
      );
    case "localDeclarationStatement":
      return statement.declarators.reduce(
        (count, declarator) =>
          count +
          (declarator.initializer
            ? countExpressionReferenceAst(declarator.initializer, sourceAst)
            : 0),
        0
      );
    case "localFunctionStatement":
      return countStatementReferenceAst(statement.body, sourceAst);
    case "expressionStatement":
    case "throwStatement":
    case "returnStatement":
    case "yieldStatement":
      return statement.expression
        ? countExpressionReferenceAst(statement.expression, sourceAst)
        : 0;
    case "ifStatement":
      return (
        countExpressionReferenceAst(statement.condition, sourceAst) +
        countStatementReferenceAst(statement.thenStatement, sourceAst) +
        (statement.elseStatement
          ? countStatementReferenceAst(statement.elseStatement, sourceAst)
          : 0)
      );
    case "whileStatement":
      return (
        countExpressionReferenceAst(statement.condition, sourceAst) +
        countStatementReferenceAst(statement.body, sourceAst)
      );
    case "forStatement":
      return (
        (statement.declaration
          ? countStatementReferenceAst(statement.declaration, sourceAst)
          : 0) +
        (statement.initializers ?? []).reduce(
          (count, initializer) =>
            count + countExpressionReferenceAst(initializer, sourceAst),
          0
        ) +
        (statement.condition
          ? countExpressionReferenceAst(statement.condition, sourceAst)
          : 0) +
        statement.incrementors.reduce(
          (count, incrementor) =>
            count + countExpressionReferenceAst(incrementor, sourceAst),
          0
        ) +
        countStatementReferenceAst(statement.body, sourceAst)
      );
    case "foreachStatement":
      return (
        countExpressionReferenceAst(statement.expression, sourceAst) +
        countStatementReferenceAst(statement.body, sourceAst)
      );
    case "switchStatement":
      return (
        countExpressionReferenceAst(statement.expression, sourceAst) +
        statement.sections.reduce(
          (count, section) =>
            count +
            section.labels.reduce(
              (labelCount, label) =>
                label.kind === "caseSwitchLabel"
                  ? labelCount + countExpressionReferenceAst(label.value, sourceAst)
                  : label.kind === "casePatternSwitchLabel"
                    ? labelCount +
                      countPatternReferenceAst(label.pattern, sourceAst) +
                      (label.whenClause
                        ? countExpressionReferenceAst(label.whenClause, sourceAst)
                        : 0)
                    : labelCount,
              0
            ) +
            section.statements.reduce(
              (statementCount, nested) =>
                statementCount + countStatementReferenceAst(nested, sourceAst),
              0
            ),
          0
        )
      );
    case "tryStatement":
      return (
        countStatementReferenceAst(statement.body, sourceAst) +
        statement.catches.reduce(
          (count, clause) => count + countStatementReferenceAst(clause.body, sourceAst),
          0
        ) +
        (statement.finallyBody
          ? countStatementReferenceAst(statement.finallyBody, sourceAst)
          : 0)
      );
    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return 0;
  }
};

const replaceExpressionReferenceAst = (
  ast: CSharpExpressionAst,
  sourceAst: CSharpExpressionAst,
  replacementAst: CSharpExpressionAst
): CSharpExpressionAst => {
  if (ast === sourceAst) {
    return replacementAst;
  }

  switch (ast.kind) {
    case "parenthesizedExpression":
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
    case "castExpression":
    case "asExpression":
    case "awaitExpression":
    case "throwExpression":
    case "suppressNullableWarningExpression":
    case "argumentModifierExpression":
      return {
        ...ast,
        expression: replaceExpressionReferenceAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
      return {
        ...ast,
        expression: replaceExpressionReferenceAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
        arguments: ast.arguments.map((argument) =>
          replaceExpressionReferenceAst(argument, sourceAst, replacementAst)
        ),
      };
    case "implicitElementAccessExpression":
      return {
        ...ast,
        arguments: ast.arguments.map((argument) =>
          replaceExpressionReferenceAst(argument, sourceAst, replacementAst)
        ),
      };
    case "invocationExpression":
      return {
        ...ast,
        expression: replaceExpressionReferenceAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
        arguments: ast.arguments.map((argument) =>
          replaceExpressionReferenceAst(argument, sourceAst, replacementAst)
        ),
      };
    case "objectCreationExpression":
      return {
        ...ast,
        arguments: ast.arguments.map((argument) =>
          replaceExpressionReferenceAst(argument, sourceAst, replacementAst)
        ),
        initializer: ast.initializer?.map((entry) =>
          replaceExpressionReferenceAst(entry, sourceAst, replacementAst)
        ),
      };
    case "anonymousObjectCreationExpression":
      return {
        ...ast,
        initializer: ast.initializer.map((entry) =>
          replaceExpressionReferenceAst(entry, sourceAst, replacementAst)
        ),
      };
    case "arrayCreationExpression":
      return {
        ...ast,
        sizeExpression: ast.sizeExpression
          ? replaceExpressionReferenceAst(
              ast.sizeExpression,
              sourceAst,
              replacementAst
            )
          : undefined,
        initializer: ast.initializer?.map((entry) =>
          replaceExpressionReferenceAst(entry, sourceAst, replacementAst)
        ),
      };
    case "stackAllocArrayCreationExpression":
      return {
        ...ast,
        sizeExpression: replaceExpressionReferenceAst(
          ast.sizeExpression,
          sourceAst,
          replacementAst
        ),
      };
    case "assignmentExpression":
    case "binaryExpression":
      return {
        ...ast,
        left: replaceExpressionReferenceAst(ast.left, sourceAst, replacementAst),
        right: replaceExpressionReferenceAst(ast.right, sourceAst, replacementAst),
      };
    case "prefixUnaryExpression":
    case "postfixUnaryExpression":
      return {
        ...ast,
        operand: replaceExpressionReferenceAst(
          ast.operand,
          sourceAst,
          replacementAst
        ),
      };
    case "conditionalExpression":
      return {
        ...ast,
        condition: replaceExpressionReferenceAst(
          ast.condition,
          sourceAst,
          replacementAst
        ),
        whenTrue: replaceExpressionReferenceAst(
          ast.whenTrue,
          sourceAst,
          replacementAst
        ),
        whenFalse: replaceExpressionReferenceAst(
          ast.whenFalse,
          sourceAst,
          replacementAst
        ),
      };
    case "isExpression":
      return {
        ...ast,
        expression: replaceExpressionReferenceAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "lambdaExpression":
      return {
        ...ast,
        body:
          ast.body.kind === "blockStatement"
            ? (replaceStatementReferenceAst(
                ast.body,
                sourceAst,
                replacementAst
              ) as Extract<CSharpStatementAst, { kind: "blockStatement" }>)
            : replaceExpressionReferenceAst(
                ast.body,
                sourceAst,
                replacementAst
              ),
      };
    case "interpolatedStringExpression":
      return {
        ...ast,
        parts: ast.parts.map((part) =>
          part.kind === "interpolation"
            ? {
                ...part,
                expression: replaceExpressionReferenceAst(
                  part.expression,
                  sourceAst,
                  replacementAst
                ),
              }
            : part
        ),
      };
    case "switchExpression":
      return {
        ...ast,
        governingExpression: replaceExpressionReferenceAst(
          ast.governingExpression,
          sourceAst,
          replacementAst
        ),
        arms: ast.arms.map((arm) => ({
          ...arm,
          whenClause: arm.whenClause
            ? replaceExpressionReferenceAst(
                arm.whenClause,
                sourceAst,
                replacementAst
              )
            : undefined,
          expression: replaceExpressionReferenceAst(
            arm.expression,
            sourceAst,
            replacementAst
          ),
        })),
      };
    case "tupleExpression":
      return {
        ...ast,
        elements: ast.elements.map((element) =>
          replaceExpressionReferenceAst(element, sourceAst, replacementAst)
        ),
      };
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
    case "typeReferenceExpression":
    case "defaultExpression":
    case "sizeOfExpression":
    case "typeofExpression":
    case "declarationExpression":
      return ast;
  }
};

const replacePatternReferenceAst = (
  pattern: CSharpPatternAst,
  sourceAst: CSharpExpressionAst,
  replacementAst: CSharpExpressionAst
): CSharpPatternAst => {
  switch (pattern.kind) {
    case "constantPattern":
      return {
        ...pattern,
        expression: replaceExpressionReferenceAst(
          pattern.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "negatedPattern":
      return {
        ...pattern,
        pattern: replacePatternReferenceAst(
          pattern.pattern,
          sourceAst,
          replacementAst
        ),
      };
    default:
      return pattern;
  }
};

const replaceStatementReferenceAst = (
  statement: CSharpStatementAst,
  sourceAst: CSharpExpressionAst,
  replacementAst: CSharpExpressionAst
): CSharpStatementAst => {
  switch (statement.kind) {
    case "blockStatement":
      return {
        ...statement,
        statements: statement.statements.map((nested) =>
          replaceStatementReferenceAst(nested, sourceAst, replacementAst)
        ),
      };
    case "localDeclarationStatement":
      return {
        ...statement,
        declarators: statement.declarators.map((declarator) => ({
          ...declarator,
          initializer: declarator.initializer
            ? replaceExpressionReferenceAst(
                declarator.initializer,
                sourceAst,
                replacementAst
              )
            : undefined,
        })),
      };
    case "localFunctionStatement":
      return {
        ...statement,
        body: replaceStatementReferenceAst(
          statement.body,
          sourceAst,
          replacementAst
        ) as Extract<CSharpStatementAst, { kind: "blockStatement" }>,
      };
    case "expressionStatement":
    case "throwStatement":
    case "returnStatement":
    case "yieldStatement":
      return statement.expression
        ? {
            ...statement,
            expression: replaceExpressionReferenceAst(
              statement.expression,
              sourceAst,
              replacementAst
            ),
          }
        : statement;
    case "ifStatement":
      return {
        ...statement,
        condition: replaceExpressionReferenceAst(
          statement.condition,
          sourceAst,
          replacementAst
        ),
        thenStatement: replaceStatementReferenceAst(
          statement.thenStatement,
          sourceAst,
          replacementAst
        ),
        elseStatement: statement.elseStatement
          ? replaceStatementReferenceAst(
              statement.elseStatement,
              sourceAst,
              replacementAst
            )
          : undefined,
      };
    case "whileStatement":
      return {
        ...statement,
        condition: replaceExpressionReferenceAst(
          statement.condition,
          sourceAst,
          replacementAst
        ),
        body: replaceStatementReferenceAst(
          statement.body,
          sourceAst,
          replacementAst
        ),
      };
    case "forStatement":
      return {
        ...statement,
        declaration: statement.declaration
          ? (replaceStatementReferenceAst(
              statement.declaration,
              sourceAst,
              replacementAst
            ) as Extract<CSharpStatementAst, { kind: "localDeclarationStatement" }>)
          : undefined,
        initializers: statement.initializers?.map((initializer) =>
          replaceExpressionReferenceAst(initializer, sourceAst, replacementAst)
        ),
        condition: statement.condition
          ? replaceExpressionReferenceAst(
              statement.condition,
              sourceAst,
              replacementAst
            )
          : undefined,
        incrementors: statement.incrementors.map((incrementor) =>
          replaceExpressionReferenceAst(incrementor, sourceAst, replacementAst)
        ),
        body: replaceStatementReferenceAst(
          statement.body,
          sourceAst,
          replacementAst
        ),
      };
    case "foreachStatement":
      return {
        ...statement,
        expression: replaceExpressionReferenceAst(
          statement.expression,
          sourceAst,
          replacementAst
        ),
        body: replaceStatementReferenceAst(
          statement.body,
          sourceAst,
          replacementAst
        ),
      };
    case "switchStatement":
      return {
        ...statement,
        expression: replaceExpressionReferenceAst(
          statement.expression,
          sourceAst,
          replacementAst
        ),
        sections: statement.sections.map((section) => ({
          ...section,
          labels: section.labels.map((label) =>
            label.kind === "caseSwitchLabel"
              ? {
                  ...label,
                  value: replaceExpressionReferenceAst(
                    label.value,
                    sourceAst,
                    replacementAst
                  ),
                }
              : label.kind === "casePatternSwitchLabel"
                ? {
                    ...label,
                    pattern: replacePatternReferenceAst(
                      label.pattern,
                      sourceAst,
                      replacementAst
                    ),
                    whenClause: label.whenClause
                      ? replaceExpressionReferenceAst(
                          label.whenClause,
                          sourceAst,
                          replacementAst
                        )
                      : undefined,
                  }
                : label
          ),
          statements: section.statements.map((nested) =>
            replaceStatementReferenceAst(nested, sourceAst, replacementAst)
          ),
        })),
      };
    case "tryStatement":
      return {
        ...statement,
        body: replaceStatementReferenceAst(
          statement.body,
          sourceAst,
          replacementAst
        ) as Extract<CSharpStatementAst, { kind: "blockStatement" }>,
        catches: statement.catches.map((clause) => ({
          ...clause,
          filter: clause.filter
            ? replaceExpressionReferenceAst(
                clause.filter,
                sourceAst,
                replacementAst
              )
            : undefined,
          body: replaceStatementReferenceAst(
            clause.body,
            sourceAst,
            replacementAst
          ) as Extract<CSharpStatementAst, { kind: "blockStatement" }>,
        })),
        finallyBody: statement.finallyBody
          ? (replaceStatementReferenceAst(
              statement.finallyBody,
              sourceAst,
              replacementAst
            ) as Extract<CSharpStatementAst, { kind: "blockStatement" }>)
          : undefined,
      };
    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return statement;
  }
};

const singleEvaluateMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  returnType: IrType,
  materialized: [CSharpExpressionAst, EmitterContext],
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] => {
  const [materializedAst, materializedContext] = materialized;
  if (
    isStableRuntimeReificationInputAst(valueAst) ||
    countExpressionReferenceAst(materializedAst, valueAst) < 2
  ) {
    return materialized;
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(
    sourceType,
    materializedContext
  );
  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    returnType,
    sourceTypeContext
  );
  const local = allocateRuntimeReificationLocalName(
    "__tsonic_reify_source",
    returnTypeContext
  );
  const localAst = identifierExpression(local.name);
  const replacedAst = replaceExpressionReferenceAst(
    materializedAst,
    valueAst,
    localAst
  );

  return [
    buildZeroArgLambdaInvocationAst(returnTypeAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: sourceTypeAst,
        declarators: [{ name: local.name, initializer: valueAst }],
      },
      {
        kind: "returnStatement",
        expression: replacedAst,
      },
    ]),
    local.context,
  ];
};

const singleEvaluateRuntimeReificationValueAst = (
  valueAst: CSharpExpressionAst,
  returnTypeAst: CSharpTypeAst,
  valueExpression: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (
    isStableRuntimeReificationInputAst(valueAst) ||
    countExpressionReferenceAst(valueExpression, valueAst) < 2
  ) {
    return [valueExpression, context];
  }

  const local = allocateRuntimeReificationLocalName(
    "__tsonic_reify_source",
    context
  );
  const localAst = identifierExpression(local.name);
  const replacedAst = replaceExpressionReferenceAst(
    valueExpression,
    valueAst,
    localAst
  );

  return [
    buildZeroArgLambdaInvocationAst(returnTypeAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: objectNullableTypeAst(),
        declarators: [{ name: local.name, initializer: boxValueAst(valueAst) }],
      },
      {
        kind: "returnStatement",
        expression: replacedAst,
      },
    ]),
    local.context,
  ];
};

const getStringKeyDictionaryValueType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context, {
    preserveObjectTypeAliases: true,
  });
  if (resolved.kind !== "dictionaryType") {
    return undefined;
  }

  const keyType = resolveTypeAlias(stripNullish(resolved.keyType), context);
  return keyType.kind === "primitiveType" && keyType.name === "string"
    ? resolved.valueType
    : undefined;
};

const canMaterializeStringKeyDictionary = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean =>
  getStringKeyDictionaryValueType(sourceType, context) !== undefined &&
  getStringKeyDictionaryValueType(targetType, context) !== undefined;

const withScopedSemanticType = (
  context: EmitterContext,
  name: string,
  type: IrType
): EmitterContext => ({
  ...context,
  localSemanticTypes: new Map([
    ...(context.localSemanticTypes ?? []),
    [name, semanticType(type)],
  ]),
});

const tryBuildDictionaryMemberMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  valueName?: string
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!canMaterializeStringKeyDictionary(sourceType, targetType, context)) {
    return undefined;
  }

  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context, {
    preserveObjectTypeAliases: true,
  });
  if (resolvedTarget.kind !== "dictionaryType") {
    return undefined;
  }

  const materializationContext = valueName
    ? withScopedSemanticType(context, valueName, sourceType)
    : context;
  const plan = buildRuntimeDictionaryReificationPlan(
    valueAst,
    targetType,
    resolvedTarget,
    materializationContext,
    emitTypeAst
  );
  return plan ? [plan.value, plan.context] : undefined;
};

const buildRuntimeDictionaryReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  resolvedExpected: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  if (resolvedExpected.kind !== "dictionaryType") {
    return undefined;
  }

  const resolvedKey = resolveTypeAlias(
    stripNullish(resolvedExpected.keyType),
    context
  );
  if (resolvedKey.kind !== "primitiveType" || resolvedKey.name !== "string") {
    return undefined;
  }

  const directSourceRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    context
  );
  if (directSourceRuntimeCarrierType) {
    const materializedSource = tryBuildRuntimeMaterializationAst(
      valueAst,
      directSourceRuntimeCarrierType,
      expectedType,
      context,
      emitTypeAst
    );
    if (materializedSource) {
      return {
        condition: booleanLiteral(true),
        value: materializedSource[0],
        context: materializedSource[1],
      };
    }
  }

  const recursiveHelper = options.recursiveHelper;
  const valueMatchesRecursiveHelperByAlias =
    !!recursiveHelper &&
    typeMatchesRecursiveReificationTarget(
      resolvedExpected.valueType,
      recursiveHelper,
      context
    );
  const [targetDictionaryAst, targetDictionaryContext] =
    recursiveHelper && valueMatchesRecursiveHelperByAlias
      ? [dictionaryTypeAst(recursiveHelper.typeAst), context]
      : emitTypeAst(expectedType, context);
  const [targetValueAst, targetValueContext] =
    recursiveHelper && valueMatchesRecursiveHelperByAlias
      ? [recursiveHelper.typeAst, targetDictionaryContext]
      : emitTypeAst(resolvedExpected.valueType, targetDictionaryContext);
  const concreteTargetDictionaryAst = stripNullableTypeAst(targetDictionaryAst);
  const sourceDictionaryAst = dictionaryTypeAst(objectNullableTypeAst());
  const directSourceDictionaryType =
    resolveDirectValueSurfaceType(valueAst, context) ??
    resolveDirectRuntimeCarrierType(valueAst, context);
  const directSourceDictionaryValueType = directSourceDictionaryType
    ? getStringKeyDictionaryValueType(directSourceDictionaryType, context)
    : undefined;
  const [directSourceDictionaryAst, directSourceDictionaryContext] =
    directSourceDictionaryValueType
      ? emitTypeAst(directSourceDictionaryType!, targetValueContext)
      : [undefined, targetValueContext];
  const concreteDirectSourceDictionaryAst =
    directSourceDictionaryAst &&
    !sameTypeAstSurface(
      stripNullableTypeAst(directSourceDictionaryAst),
      concreteTargetDictionaryAst
    ) &&
    !sameTypeAstSurface(
      stripNullableTypeAst(directSourceDictionaryAst),
      sourceDictionaryAst
    )
      ? stripNullableTypeAst(directSourceDictionaryAst)
      : undefined;
  const boxedValue = boxValueAst(valueAst);
  const valueLocal = "__tsonic_reify_value";
  const typedLocal = "__tsonic_reify_typed_dict";
  const rawLocal = "__tsonic_reify_raw_dict";
  const sourceTypedLocal = "__tsonic_reify_source_dict";
  const entryLocal = "__tsonic_reify_entry";
  const entryValueAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression(entryLocal),
    memberName: "Value",
  };
  const entryValueMatchesRecursiveHelper =
    valueMatchesRecursiveHelperByAlias ||
    (!!recursiveHelper &&
      sameTypeAstSurface(
        stripNullableTypeAst(targetValueAst),
        stripNullableTypeAst(recursiveHelper.typeAst)
      ));
  const materializedEntryValue =
    recursiveHelper && entryValueMatchesRecursiveHelper
      ? buildRuntimeReificationHelperCallAst(
          recursiveHelper.name,
          entryValueAst
        )
      : (tryBuildRuntimeReificationPlan(
          entryValueAst,
          resolvedExpected.valueType,
          targetValueContext,
          emitTypeAst,
          options
        )?.value ?? {
          kind: "castExpression",
          type: targetValueAst,
          expression: entryValueAst,
        });

  const buildToDictionaryAst = (
    sourceAst: CSharpExpressionAst,
    keyBody: CSharpExpressionAst
  ): CSharpExpressionAst => ({
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: identifierExpression("global::System.Linq.Enumerable"),
      memberName: "ToDictionary",
    },
    arguments: [
      sourceAst,
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: entryLocal }],
        body: keyBody,
      },
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: entryLocal }],
        body: materializedEntryValue,
      },
    ],
  });
  const entryKeyAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression(entryLocal),
    memberName: "Key",
  };
  const toDictionaryAst = buildToDictionaryAst(
    identifierExpression(rawLocal),
    entryKeyAst
  );
  const toDictionaryFromSourceAst = buildToDictionaryAst(
    identifierExpression(sourceTypedLocal),
    entryKeyAst
  );

  const typedDictionaryCondition: CSharpExpressionAst = {
    kind: "isExpression",
    expression: boxedValue,
    pattern: {
      kind: "typePattern",
      type: concreteTargetDictionaryAst,
    },
  };
  const rawDictionaryCondition: CSharpExpressionAst = {
    kind: "isExpression",
    expression: boxedValue,
    pattern: {
      kind: "typePattern",
      type: sourceDictionaryAst,
    },
  };
  const condition: CSharpExpressionAst = concreteDirectSourceDictionaryAst
    ? {
        kind: "binaryExpression",
        operatorToken: "||",
        left: {
          kind: "binaryExpression",
          operatorToken: "||",
          left: typedDictionaryCondition,
          right: rawDictionaryCondition,
        },
        right: {
          kind: "isExpression",
          expression: boxedValue,
          pattern: {
            kind: "typePattern",
            type: concreteDirectSourceDictionaryAst,
          },
        },
      }
    : {
        kind: "binaryExpression",
        operatorToken: "||",
        left: typedDictionaryCondition,
        right: rawDictionaryCondition,
      };

  return {
    condition,
    value: buildZeroArgLambdaInvocationAst(concreteTargetDictionaryAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: objectNullableTypeAst(),
        declarators: [{ name: valueLocal, initializer: boxedValue }],
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: concreteTargetDictionaryAst,
            designation: typedLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: identifierExpression(typedLocal),
            },
          ],
        },
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: sourceDictionaryAst,
            designation: rawLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: toDictionaryAst,
            },
          ],
        },
      },
      ...(concreteDirectSourceDictionaryAst
        ? [
            {
              kind: "ifStatement" as const,
              condition: {
                kind: "isExpression" as const,
                expression: identifierExpression(valueLocal),
                pattern: {
                  kind: "declarationPattern" as const,
                  type: concreteDirectSourceDictionaryAst,
                  designation: sourceTypedLocal,
                },
              },
              thenStatement: {
                kind: "blockStatement" as const,
                statements: [
                  {
                    kind: "returnStatement" as const,
                    expression: toDictionaryFromSourceAst,
                  },
                ],
              },
            },
          ]
        : []),
      buildInvalidCastThrowStatement("Unreachable dictionary reification path"),
    ]),
    context: directSourceDictionaryContext,
  };
};

const buildRuntimeArrayReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  resolvedExpected: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  const elementType = getArrayLikeElementType(resolvedExpected, context);
  if (!elementType) {
    return undefined;
  }
  const materializedElementType =
    resolvedExpected.kind === "arrayType" &&
    resolvedExpected.storageErasedElementType
      ? resolvedExpected.storageErasedElementType
      : elementType;

  const recursiveHelper = options.recursiveHelper;
  const resolvedMaterializedElementType = resolveTypeAlias(
    stripNullish(materializedElementType),
    context,
    { preserveObjectTypeAliases: true }
  );
  const resolvedRecursiveHelperExpectedType = recursiveHelper
    ? resolveTypeAlias(stripNullish(recursiveHelper.expectedType), context, {
        preserveObjectTypeAliases: true,
      })
    : undefined;
  const elementRuntimeCarrierMatchesRecursiveHelper =
    recursiveHelper !== undefined
      ? (() => {
          const [elementRuntimeTypeAst, elementRuntimeLayout] =
            emitRuntimeCarrierTypeAst(
              materializedElementType,
              context,
              emitTypeAst
            );
          return (
            !!elementRuntimeLayout &&
            sameTypeAstSurface(
              stripNullableTypeAst(elementRuntimeTypeAst),
              stripNullableTypeAst(recursiveHelper.typeAst)
            )
          );
        })()
      : false;
  const elementMatchesRecursiveHelperByAlias =
    !!recursiveHelper &&
    (typeMatchesRecursiveReificationTarget(
      materializedElementType,
      recursiveHelper,
      context
    ) ||
      resolvedMaterializedElementType === resolvedRecursiveHelperExpectedType ||
      elementRuntimeCarrierMatchesRecursiveHelper ||
      typeContainsRecursiveReificationTarget(
        materializedElementType,
        recursiveHelper.expectedType,
        context
      ));
  const [targetArrayAst, targetArrayContext] =
    recursiveHelper && elementMatchesRecursiveHelperByAlias
      ? [
          {
            kind: "arrayType" as const,
            elementType: recursiveHelper.typeAst,
            rank: 1,
          },
          context,
        ]
      : emitTypeAst(expectedType, context);
  const [targetElementAst, targetElementContext] =
    recursiveHelper && elementMatchesRecursiveHelperByAlias
      ? [recursiveHelper.typeAst, targetArrayContext]
      : emitTypeAst(materializedElementType, targetArrayContext);
  const concreteTargetArrayAst = stripNullableTypeAst(targetArrayAst);
  const sourceArrayAst: CSharpTypeAst = {
    kind: "arrayType",
    elementType: objectNullableTypeAst(),
    rank: 1,
  };
  const boxedValue = boxValueAst(valueAst);
  const valueLocal = "__tsonic_reify_value";
  const typedLocal = "__tsonic_reify_typed_array";
  const rawLocal = "__tsonic_reify_raw_array";
  const itemLocal = "__item";
  const itemAst = identifierExpression(itemLocal);
  const itemMatchesRecursiveHelper =
    elementMatchesRecursiveHelperByAlias ||
    (!!recursiveHelper &&
      sameTypeAstSurface(
        stripNullableTypeAst(targetElementAst),
        stripNullableTypeAst(recursiveHelper.typeAst)
      ));
  const fallbackMaterializedItem: CSharpExpressionAst = {
    kind: "castExpression",
    type: targetElementAst,
    expression: itemAst,
  };
  const materializedItem =
    recursiveHelper && itemMatchesRecursiveHelper
      ? buildRuntimeReificationHelperCallAst(recursiveHelper.name, itemAst)
      : materializedElementType.kind === "typeParameterType"
        ? fallbackMaterializedItem
        : (tryBuildRuntimeReificationPlan(
            itemAst,
            materializedElementType,
            targetElementContext,
            emitTypeAst,
            options
          )?.value ?? fallbackMaterializedItem);
  const selectAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.Select"),
    typeArguments: [objectNullableTypeAst(), targetElementAst],
    arguments: [
      identifierExpression(rawLocal),
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: itemLocal }],
        body: materializedItem,
      },
    ],
  };
  const toArrayAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.ToArray"),
    typeArguments: [targetElementAst],
    arguments: [selectAst],
  };

  return {
    condition: buildArrayShapeCondition(valueAst),
    value: buildZeroArgLambdaInvocationAst(concreteTargetArrayAst, [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: objectNullableTypeAst(),
        declarators: [{ name: valueLocal, initializer: boxedValue }],
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: concreteTargetArrayAst,
            designation: typedLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: identifierExpression(typedLocal),
            },
          ],
        },
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "isExpression",
          expression: identifierExpression(valueLocal),
          pattern: {
            kind: "declarationPattern",
            type: sourceArrayAst,
            designation: rawLocal,
          },
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: toArrayAst,
            },
          ],
        },
      },
      buildInvalidCastThrowStatement("Unreachable array reification path"),
    ]),
    context: targetElementContext,
  };
};

const tryBuildArrayElementMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  const targetElementType = getArrayLikeElementType(expectedType, context);
  if (!sourceElementType || !targetElementType) {
    return undefined;
  }
  const materializationSourceElementType =
    resolveRuntimeStorageType(sourceElementType, context) ?? sourceElementType;

  const [sourceElementTypeAst, sourceTypeContext] = emitTypeAst(
    sourceElementType,
    context
  );
  const [targetElementTypeAst, targetTypeContext] = emitTypeAst(
    targetElementType,
    sourceTypeContext
  );
  if (sameTypeAstSurface(sourceElementTypeAst, targetElementTypeAst)) {
    return undefined;
  }

  const [sourceElementLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    materializationSourceElementType,
    targetTypeContext,
    emitTypeAst
  );
  const [targetElementLayout, targetLayoutContext] = buildRuntimeUnionLayout(
    targetElementType,
    sourceLayoutContext,
    emitTypeAst
  );

  if (
    isBroadObjectSlotType(targetElementType, targetTypeContext) ||
    isObjectTypeAst(targetElementTypeAst)
  ) {
    const itemName = "__tsonic_array_item";
    const itemExpr = identifierExpression(itemName);
    const materializedElement =
      sourceElementLayout &&
      !isBroadObjectRuntimeMemberType(sourceElementType, targetTypeContext)
        ? ([
            buildRuntimeUnionMatchAst(
              itemExpr,
              sourceElementLayout.memberTypeAsts.map(
                (memberTypeAst, index) => ({
                  kind: "lambdaExpression" as const,
                  isAsync: false,
                  parameters: [{ name: `__tsonic_union_member_${index + 1}` }],
                  body: maybeCastMaterializedValueAst(
                    identifierExpression(`__tsonic_union_member_${index + 1}`),
                    memberTypeAst,
                    targetElementTypeAst
                  ),
                })
              ),
              [targetElementTypeAst]
            ),
            sourceLayoutContext,
          ] as [CSharpExpressionAst, EmitterContext])
        : tryBuildRuntimeMaterializationAst(
            itemExpr,
            materializationSourceElementType,
            targetElementType,
            targetTypeContext,
            emitTypeAst
          );
    const materializedElementContext =
      materializedElement?.[1] ?? targetTypeContext;
    const selectAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression("global::System.Linq.Enumerable.Select"),
      typeArguments: [sourceElementTypeAst, targetElementTypeAst],
      arguments: [
        valueAst,
        {
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: itemName }],
          body:
            materializedElement?.[0] ??
            maybeCastMaterializedValueAst(
              itemExpr,
              sourceElementTypeAst,
              targetElementTypeAst
            ),
        },
      ],
    };
    const toArrayAst: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: identifierExpression(
        "global::System.Linq.Enumerable.ToArray"
      ),
      typeArguments: [targetElementTypeAst],
      arguments: [selectAst],
    };
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      materializedElementContext
    );

    return [
      {
        kind: "castExpression",
        type: expectedTypeAst,
        expression: toArrayAst,
      },
      expectedTypeContext,
    ];
  }

  if (
    !sourceElementLayout &&
    targetElementLayout &&
    !isBroadObjectSlotType(
      materializationSourceElementType,
      targetLayoutContext
    ) &&
    !isObjectTypeAst(sourceElementTypeAst)
  ) {
    const targetMemberIndex = findRuntimeUnionMemberIndex(
      targetElementLayout.members,
      materializationSourceElementType,
      targetLayoutContext
    );
    if (targetMemberIndex !== undefined) {
      const targetMember = targetElementLayout.members[targetMemberIndex];
      const targetMemberTypeAst =
        targetElementLayout.memberTypeAsts[targetMemberIndex];
      if (!targetMember || !targetMemberTypeAst) {
        return undefined;
      }

      const itemName = "__tsonic_array_item";
      const itemExpr = identifierExpression(itemName);
      const materializedMember = tryBuildRuntimeMaterializationAst(
        itemExpr,
        materializationSourceElementType,
        targetMember,
        targetLayoutContext,
        emitTypeAst
      );
      const memberValueAst =
        materializedMember?.[0] ??
        maybeCastMaterializedValueAst(
          itemExpr,
          sourceElementTypeAst,
          targetMemberTypeAst
        );
      const memberValueContext = materializedMember?.[1] ?? targetLayoutContext;
      const selectAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.Select"
        ),
        typeArguments: [sourceElementTypeAst, targetElementTypeAst],
        arguments: [
          valueAst,
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [{ name: itemName }],
            body: buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(targetElementLayout),
              targetMemberIndex + 1,
              memberValueAst
            ),
          },
        ],
      };
      const toArrayAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.ToArray"
        ),
        typeArguments: [targetElementTypeAst],
        arguments: [selectAst],
      };
      const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
        expectedType,
        memberValueContext
      );

      return [
        {
          kind: "castExpression",
          type: expectedTypeAst,
          expression: toArrayAst,
        },
        expectedTypeContext,
      ];
    }
  }

  if (!sourceElementLayout) {
    return undefined;
  }

  const itemName = "__tsonic_array_item";
  const itemExpr = identifierExpression(itemName);
  const materializedElement = tryBuildRuntimeMaterializationAst(
    itemExpr,
    materializationSourceElementType,
    targetElementType,
    targetTypeContext,
    emitTypeAst
  );
  if (!materializedElement) {
    return undefined;
  }

  const selectAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.Select"),
    typeArguments: [sourceElementTypeAst, targetElementTypeAst],
    arguments: [
      valueAst,
      {
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: itemName }],
        body: materializedElement[0],
      },
    ],
  };
  const toArrayAst: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression("global::System.Linq.Enumerable.ToArray"),
    typeArguments: [targetElementTypeAst],
    arguments: [selectAst],
  };
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    materializedElement[1]
  );

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: toArrayAst,
    },
    expectedTypeContext,
  ];
};

const canMaterializeArrayToBroadObjectArray = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  const targetElementType = getArrayLikeElementType(targetType, context);
  return (
    !!sourceElementType &&
    !!targetElementType &&
    isBroadObjectSlotType(targetElementType, context)
  );
};

const isObjectTypeAst = (type: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  if (concrete.kind === "identifierType") {
    return concrete.name === "object" || concrete.name === "Object";
  }
  if (concrete.kind === "qualifiedIdentifierType") {
    return concrete.name.segments.join(".") === "System.Object";
  }
  return false;
};

const isNamedReferenceTypeAst = (type: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(type);
  return (
    concrete.kind === "identifierType" ||
    concrete.kind === "qualifiedIdentifierType"
  );
};

const canUseScalarRuntimeUnionFallbackCast = (
  sourceType: IrType,
  targetType: IrType,
  sourceTypeAst: CSharpTypeAst,
  targetTypeAst: CSharpTypeAst,
  context: EmitterContext
): boolean => {
  if (sameTypeAstSurface(sourceTypeAst, targetTypeAst)) {
    return true;
  }

  if (
    isBroadObjectSlotType(sourceType, context) ||
    isBroadObjectSlotType(targetType, context) ||
    isObjectTypeAst(sourceTypeAst) ||
    isObjectTypeAst(targetTypeAst)
  ) {
    return true;
  }

  return !(
    isNamedReferenceTypeAst(sourceTypeAst) &&
    isNamedReferenceTypeAst(targetTypeAst)
  );
};

const keepMaterializationIfValidForSourceCarrier = (
  materialization: [CSharpExpressionAst, EmitterContext] | undefined,
  sourceType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined =>
  materialization &&
  !(
    !willCarryAsRuntimeUnion(sourceType, context) &&
    isRuntimeUnionMemberProjectionAst(materialization[0])
  )
    ? materialization
    : undefined;

const tryGetRuntimeUnionMemberProjectionN = (
  valueAst: CSharpExpressionAst
): number | undefined => {
  let target = valueAst;
  while (target.kind === "parenthesizedExpression") {
    target = target.expression;
  }
  if (
    target.kind !== "invocationExpression" ||
    target.arguments.length !== 0 ||
    target.expression.kind !== "memberAccessExpression"
  ) {
    return undefined;
  }

  const match = /^As([1-9][0-9]*)$/.exec(target.expression.memberName);
  return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
};

const canMaterializeArrayToObjectArrayAst = (
  sourceType: IrType,
  targetTypeAst: CSharpTypeAst,
  context: EmitterContext
): boolean => {
  const sourceElementType = getArrayLikeElementType(sourceType, context);
  return (
    !!sourceElementType &&
    targetTypeAst.kind === "arrayType" &&
    isObjectTypeAst(targetTypeAst.elementType)
  );
};

const getReferenceIterableElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return resolved.kind === "referenceType"
    ? getDirectIterableElementType(type, context)
    : undefined;
};

const buildIterableSourceAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  context: EmitterContext
):
  | {
      readonly ast: CSharpExpressionAst;
      readonly elementType: IrType;
      readonly context: EmitterContext;
    }
  | undefined => {
  const shape = getIterableSourceShape(sourceType, context);
  if (!shape) {
    return undefined;
  }

  if (shape.accessKind === "direct") {
    return {
      ast: valueAst,
      elementType: shape.elementType,
      context,
    };
  }

  const memberName = emitCSharpName(
    "[symbol:iterator]",
    shape.accessKind === "iteratorMethod" ? "methods" : "properties",
    context
  );
  const memberAccessAst: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: valueAst,
    memberName,
  };

  return {
    ast:
      shape.accessKind === "iteratorMethod"
        ? {
            kind: "invocationExpression",
            expression: memberAccessAst,
            arguments: [],
          }
        : memberAccessAst,
    elementType: shape.elementType,
    context,
  };
};

const tryBuildScalarIterableToRuntimeUnionMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetLayout: NonNullable<ReturnType<typeof buildRuntimeUnionLayout>[0]>,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    willCarryAsRuntimeUnion(sourceType, context) ||
    isRuntimeUnionMemberProjectionAst(valueAst)
  ) {
    return undefined;
  }

  const sourceIterable = buildIterableSourceAst(valueAst, sourceType, context);
  if (!sourceIterable) {
    return undefined;
  }

  const iterableMemberCandidates = targetLayout.members.flatMap(
    (member, index) => {
      const targetElementType = getReferenceIterableElementType(
        member,
        sourceIterable.context
      );
      return member && targetElementType
        ? [{ index, member, targetElementType }]
        : [];
    }
  );
  if (iterableMemberCandidates.length !== 1) {
    return undefined;
  }

  const [candidate] = iterableMemberCandidates;
  if (!candidate) {
    return undefined;
  }

  let currentContext = sourceIterable.context;
  const [sourceElementTypeAst, sourceElementContext] = emitTypeAst(
    sourceIterable.elementType,
    currentContext
  );
  currentContext = sourceElementContext;
  const [targetElementTypeAst, targetElementContext] = emitTypeAst(
    candidate.targetElementType,
    currentContext
  );
  currentContext = targetElementContext;
  const [targetMemberTypeAst, targetMemberContext] = emitTypeAst(
    candidate.member,
    currentContext
  );
  currentContext = targetMemberContext;

  const itemIdentifier = identifierExpression("__item");
  const elementBody =
    sameTypeAstSurface(sourceElementTypeAst, targetElementTypeAst) ||
    matchesExpectedEmissionType(
      sourceIterable.elementType,
      candidate.targetElementType,
      currentContext
    )
      ? itemIdentifier
      : maybeCastMaterializedValueAst(
          itemIdentifier,
          sourceElementTypeAst,
          targetElementTypeAst
        );
  const iterableValueAst = sameTypeAstSurface(
    sourceElementTypeAst,
    targetElementTypeAst
  )
    ? sourceIterable.ast
    : {
        kind: "invocationExpression" as const,
        expression: identifierExpression(
          "global::System.Linq.Enumerable.Select"
        ),
        typeArguments: [sourceElementTypeAst, targetElementTypeAst],
        arguments: [
          sourceIterable.ast,
          {
            kind: "lambdaExpression" as const,
            isAsync: false,
            parameters: [{ name: "__item" }],
            body: elementBody,
          },
        ],
      };

  return [
    buildRuntimeUnionFactoryCallAst(
      buildRuntimeUnionTypeAst(targetLayout),
      candidate.index + 1,
      maybeCastMaterializedValueAst(
        iterableValueAst,
        targetMemberTypeAst,
        targetMemberTypeAst
      )
    ),
    currentContext,
  ];
};

const tryBuildScalarToRuntimeUnionMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetLayout: NonNullable<ReturnType<typeof buildRuntimeUnionLayout>[0]>,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const matchingMemberIndices = findRuntimeUnionMemberIndices(
    targetLayout.members,
    sourceType,
    context
  );
  if (matchingMemberIndices.length !== 1) {
    const recursivelyMaterializedMembers = targetLayout.members.flatMap(
      (targetMember, index) => {
        if (!targetMember) {
          return [];
        }

        const nestedMaterialization =
          keepMaterializationIfValidForSourceCarrier(
            tryBuildRuntimeMaterializationAst(
              valueAst,
              sourceType,
              targetMember,
              context,
              emitTypeAst
            ),
            sourceType,
            context
          );
        return nestedMaterialization
          ? [{ index, materialized: nestedMaterialization }]
          : [];
      }
    );
    if (recursivelyMaterializedMembers.length !== 1) {
      return recursivelyMaterializedMembers.length === 0
        ? tryBuildScalarIterableToRuntimeUnionMaterializationAst(
            valueAst,
            sourceType,
            targetLayout,
            context,
            emitTypeAst
          )
        : undefined;
    }

    const [materializedMember] = recursivelyMaterializedMembers;
    if (!materializedMember) {
      return undefined;
    }

    return [
      buildRuntimeUnionFactoryCallAst(
        buildRuntimeUnionTypeAst(targetLayout),
        materializedMember.index + 1,
        materializedMember.materialized[0]
      ),
      materializedMember.materialized[1],
    ];
  }

  const memberIndex = matchingMemberIndices[0];
  if (memberIndex === undefined) {
    return undefined;
  }

  const targetMember = targetLayout.members[memberIndex];
  const targetMemberTypeAst = targetLayout.memberTypeAsts[memberIndex];
  if (!targetMember || !targetMemberTypeAst) {
    return undefined;
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(sourceType, context);
  const sourceAndTargetSurfacesAlreadyMatch = sameTypeAstSurface(
    stripNullableTypeAst(sourceTypeAst),
    stripNullableTypeAst(targetMemberTypeAst)
  );
  const nestedMaterialization = sourceAndTargetSurfacesAlreadyMatch
    ? undefined
    : keepMaterializationIfValidForSourceCarrier(
        tryBuildRuntimeMaterializationAst(
          valueAst,
          sourceType,
          targetMember,
          sourceTypeContext,
          emitTypeAst
        ),
        sourceType,
        sourceTypeContext
      );
  const fallbackCast = canUseScalarRuntimeUnionFallbackCast(
    sourceType,
    targetMember,
    sourceTypeAst,
    targetMemberTypeAst,
    sourceTypeContext
  )
    ? maybeCastMaterializedValueAst(
        valueAst,
        sourceTypeAst,
        targetMemberTypeAst
      )
    : undefined;
  if (!nestedMaterialization && !fallbackCast) {
    return tryBuildScalarIterableToRuntimeUnionMaterializationAst(
      valueAst,
      sourceType,
      targetLayout,
      sourceTypeContext,
      emitTypeAst
    );
  }

  const materializedValueAst = nestedMaterialization?.[0] ?? fallbackCast;
  if (!materializedValueAst) {
    return undefined;
  }

  return [
    buildRuntimeUnionFactoryCallAst(
      buildRuntimeUnionTypeAst(targetLayout),
      memberIndex + 1,
      materializedValueAst
    ),
    nestedMaterialization?.[1] ?? sourceTypeContext,
  ];
};

const tryBuildNestedRuntimeUnionToTargetLayoutAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  targetLayout: RuntimeUnionLayout,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  if (!sourceLayout) {
    return undefined;
  }

  return tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst,
    sourceLayout,
    targetLayout,
    context: sourceLayoutContext,
    buildMappedMemberValue: ({
      actualMember,
      actualMemberTypeAst,
      parameterExpr,
      targetMember,
      targetMemberTypeAst,
      context: nextContext,
    }) => {
      const memberSurfacesAlreadyMatch = sameTypeAstSurface(
        stripNullableTypeAst(actualMemberTypeAst),
        stripNullableTypeAst(targetMemberTypeAst)
      );
      const nestedMaterialization = memberSurfacesAlreadyMatch
        ? undefined
        : tryBuildRuntimeMaterializationAst(
            parameterExpr,
            actualMember,
            targetMember,
            nextContext,
            emitTypeAst
          );
      return [
        nestedMaterialization?.[0] ??
          maybeCastMaterializedValueAst(
            parameterExpr,
            actualMemberTypeAst,
            targetMemberTypeAst
          ),
        nestedMaterialization?.[1] ?? nextContext,
      ];
    },
    buildExcludedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionMaterializationExpression(
        actualMember,
        targetType
      ),
    buildUnmappedMemberBody: ({
      actualMember,
      parameterExpr,
      context: nextContext,
    }) =>
      tryBuildRuntimeMaterializationAst(
        parameterExpr,
        actualMember,
        targetType,
        nextContext,
        emitTypeAst
      ) ??
      buildInvalidRuntimeUnionMaterializationExpression(
        actualMember,
        targetType
      ),
  });
};

export const tryBuildRuntimeMaterializationAst = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  selectedSourceMemberNs?: ReadonlySet<number>,
  sourceFrame?: RuntimeMaterializationSourceFrame
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const materialized = tryBuildRuntimeMaterializationAstCore(
    valueAst,
    sourceType,
    targetType,
    context,
    emitTypeAst,
    selectedSourceMemberNs,
    sourceFrame
  );

  return materialized
    ? singleEvaluateMaterializationAst(
        valueAst,
        sourceType,
        targetType,
        materialized,
        emitTypeAst
      )
    : undefined;
};

const tryBuildRuntimeMaterializationAstCore = (
  valueAst: CSharpExpressionAst,
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  selectedSourceMemberNs?: ReadonlySet<number>,
  sourceFrame?: RuntimeMaterializationSourceFrame
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const targetHasNamedRuntimeCarrier =
    targetType.kind === "unionType" &&
    (targetType.runtimeCarrierFamilyKey !== undefined ||
      targetType.runtimeCarrierName !== undefined ||
      targetType.runtimeCarrierNamespace !== undefined);
  const semanticMaterializationTargetType =
    selectedSourceMemberNs &&
    selectedSourceMemberNs.size > 0 &&
    !targetHasNamedRuntimeCarrier
      ? stripRuntimeCarrierFamilyForSubset(targetType)
      : targetType;
  const materializationTargetType =
    semanticMaterializationTargetType.kind === "unionType"
      ? buildExpectedRuntimeCarrierTarget(
          semanticMaterializationTargetType,
          context,
          emitTypeAst
        )
      : semanticMaterializationTargetType;

  if (!sourceFrame && valueAst.kind === "identifierExpression") {
    const narrowed = context.narrowedBindings?.get(valueAst.identifier);
    const contextualSourceType =
      narrowed?.kind === "runtimeSubset"
        ? (narrowed.sourceType ??
          context.localValueTypes?.get(valueAst.identifier))
        : undefined;
    const contextualSourceMembers = contextualSourceType
      ? getCanonicalRuntimeUnionMembers(contextualSourceType, context)
      : undefined;
    if (
      narrowed?.kind === "runtimeSubset" &&
      narrowed.runtimeMemberNs.length > 0 &&
      contextualSourceType &&
      contextualSourceMembers &&
      contextualSourceMembers.length >= Math.max(...narrowed.runtimeMemberNs)
    ) {
      return tryBuildRuntimeMaterializationAst(
        valueAst,
        contextualSourceType,
        targetType,
        context,
        emitTypeAst,
        selectedSourceMemberNs ?? new Set(narrowed.runtimeMemberNs),
        {
          members: contextualSourceMembers,
          candidateMemberNs: contextualSourceMembers.map(
            (_member, index) => index + 1
          ),
          runtimeUnionArity: contextualSourceMembers.length,
        }
      );
    }
  }

  const directSourceCarrierType = sourceFrame
    ? undefined
    : resolveDirectRuntimeCarrierType(valueAst, context);
  if (
    directSourceCarrierType &&
    runtimeUnionCarrierSurfacesMatch(
      directSourceCarrierType,
      materializationTargetType,
      context,
      emitTypeAst
    )
  ) {
    return [valueAst, context];
  }
  if (
    directSourceCarrierType &&
    directSourceCarrierType !== sourceType &&
    !areIrTypesEquivalent(directSourceCarrierType, sourceType, context)
  ) {
    const directSourceFrame: RuntimeMaterializationSourceFrame | undefined =
      directSourceCarrierType.kind === "unionType" &&
      !isRuntimeUnionMemberProjectionAst(valueAst)
        ? {
            members: directSourceCarrierType.types,
            candidateMemberNs: directSourceCarrierType.types.map(
              (_member, index) => index + 1
            ),
            runtimeUnionArity: directSourceCarrierType.types.length,
          }
        : undefined;
    return tryBuildRuntimeMaterializationAst(
      valueAst,
      directSourceCarrierType,
      targetType,
      context,
      emitTypeAst,
      selectedSourceMemberNs,
      directSourceFrame ?? sourceFrame
    );
  }

  if (
    !selectedSourceMemberNs &&
    runtimeUnionAliasReferencesMatch(
      sourceType,
      materializationTargetType,
      context
    ) &&
    runtimeUnionCarrierSurfacesMatch(
      sourceType,
      materializationTargetType,
      context,
      emitTypeAst
    )
  ) {
    return [valueAst, context];
  }

  const effectiveSourceFrame =
    sourceFrame ??
    (() => {
      const [sourceLayout] = buildRuntimeUnionLayout(
        sourceType,
        context,
        emitTypeAst
      );
      if (!sourceLayout) {
        return undefined;
      }
      const projectedMemberN = tryGetRuntimeUnionMemberProjectionN(valueAst);
      if (projectedMemberN !== undefined) {
        const projectedMember = sourceLayout.members[projectedMemberN - 1];
        return projectedMember
          ? {
              members: [projectedMember],
              candidateMemberNs: [projectedMemberN],
              runtimeUnionArity: sourceLayout.runtimeUnionArity,
            }
          : undefined;
      }
      const restrictedIndices = tryResolveRuntimeUnionCastSourceIndices(
        valueAst,
        sourceLayout.memberTypeAsts
      );
      if (!restrictedIndices) {
        return undefined;
      }
      return {
        members: restrictedIndices.flatMap((index) => {
          const member = sourceLayout.members[index];
          return member ? [member] : [];
        }),
        candidateMemberNs: restrictedIndices.map((index) => index + 1),
        runtimeUnionArity: sourceLayout.runtimeUnionArity,
      };
    })();
  const [sourceLayout, sourceLayoutContext] = (() => {
    if (!effectiveSourceFrame) {
      return buildRuntimeUnionLayout(sourceType, context, emitTypeAst);
    }

    const members = effectiveSourceFrame.members;
    if (members.length < 2) {
      return [undefined, context] as const;
    }

    let currentContext = context;
    const memberTypeAsts: CSharpTypeAst[] = [];
    for (const member of members) {
      const [typeAst, nextContext] = emitTypeAst(member, currentContext);
      memberTypeAsts.push(typeAst);
      currentContext = nextContext;
    }

    const [fullSourceLayout] = buildRuntimeUnionLayout(
      resolveDirectRuntimeCarrierType(valueAst, currentContext) ?? sourceType,
      currentContext,
      emitTypeAst
    );
    const candidateArity =
      effectiveSourceFrame.candidateMemberNs &&
      effectiveSourceFrame.candidateMemberNs.length > 0
        ? Math.max(...effectiveSourceFrame.candidateMemberNs)
        : members.length;
    const runtimeUnionArity = Math.max(
      effectiveSourceFrame.runtimeUnionArity ?? 0,
      fullSourceLayout?.runtimeUnionArity ?? 0,
      candidateArity,
      members.length
    );

    return [
      {
        members,
        memberTypeAsts,
        carrierTypeArgumentAsts: memberTypeAsts,
        runtimeUnionArity,
      },
      currentContext,
    ] as const;
  })();

  const [targetLayout, targetLayoutContext] = buildRuntimeUnionLayout(
    materializationTargetType,
    sourceLayoutContext,
    emitTypeAst
  );
  const scalarSourceFrameType =
    effectiveSourceFrame?.members.length === 1
      ? effectiveSourceFrame.members[0]
      : undefined;
  const scalarSourceType = scalarSourceFrameType ?? sourceType;
  const selectedScalarSourceMemberNs =
    selectedSourceMemberNs && selectedSourceMemberNs.size > 0
      ? selectedSourceMemberNs
      : !targetLayout &&
          sourceLayout &&
          materializationTargetType.kind !== "unionType"
        ? new Set(
            findRuntimeUnionMemberIndices(
              sourceLayout.members,
              materializationTargetType,
              targetLayoutContext
            ).map((index) => index + 1)
          )
        : undefined;

  if (
    !targetLayout &&
    sourceLayout &&
    materializationTargetType.kind !== "unionType"
  ) {
    const [targetTypeAst, targetTypeContext] = emitTypeAst(
      materializationTargetType,
      targetLayoutContext
    );
    const sourceMemberIndexBySlot = new Map<number, number>();
    for (let index = 0; index < sourceLayout.members.length; index += 1) {
      sourceMemberIndexBySlot.set(
        effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1,
        index
      );
    }

    const lambdaArgs: CSharpExpressionAst[] = [];
    let matchContext = targetTypeContext;
    let materializableCount = 0;
    for (
      let slotIndex = 0;
      slotIndex < sourceLayout.runtimeUnionArity;
      slotIndex += 1
    ) {
      const sourceMemberN = slotIndex + 1;
      const index = sourceMemberIndexBySlot.get(sourceMemberN);
      const actualMember =
        index !== undefined ? sourceLayout.members[index] : undefined;
      const parameterName = `__tsonic_union_member_${sourceMemberN}`;
      const parameterExpr = identifierExpression(parameterName);
      const materializedCandidate =
        actualMember &&
        (!selectedSourceMemberNs || selectedSourceMemberNs.has(sourceMemberN))
          ? tryBuildRuntimeMaterializationAst(
              parameterExpr,
              actualMember,
              materializationTargetType,
              matchContext,
              emitTypeAst
            )
          : undefined;
      const materialized =
        materializedCandidate &&
        materializedExpressionMatchesTargetType(
          materializedCandidate[0],
          materializationTargetType,
          materializedCandidate[1],
          emitTypeAst
        )
          ? materializedCandidate
          : undefined;
      if (materialized) {
        materializableCount += 1;
        matchContext = materialized[1];
      }
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body:
          materialized?.[0] ??
          buildInvalidRuntimeUnionMaterializationExpression(
            actualMember ?? { kind: "unknownType" },
            materializationTargetType
          ),
      });
    }

    if (materializableCount > 1) {
      return [
        buildRuntimeUnionMatchAst(valueAst, lambdaArgs, [
          stripNullableTypeAst(targetTypeAst),
        ]),
        matchContext,
      ];
    }
  }

  const hasAdditionalMaterializableScalarSourceMembers =
    !targetLayout &&
    sourceLayout &&
    selectedScalarSourceMemberNs?.size === 1 &&
    materializationTargetType.kind !== "unionType"
      ? sourceLayout.members.some((member, index) => {
          if (!member) {
            return false;
          }
          const memberN =
            effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1;
          if (selectedScalarSourceMemberNs.has(memberN)) {
            return false;
          }
          const materialized = tryBuildRuntimeMaterializationAst(
            identifierExpression(`__tsonic_member_probe_${memberN}`),
            member,
            materializationTargetType,
            targetLayoutContext,
            emitTypeAst
          );
          return (
            materialized !== undefined &&
            materializedExpressionMatchesTargetType(
              materialized[0],
              materializationTargetType,
              materialized[1],
              emitTypeAst
            )
          );
        })
      : false;

  if (
    !targetLayout &&
    sourceLayout &&
    selectedScalarSourceMemberNs?.size === 1 &&
    materializationTargetType.kind !== "unionType" &&
    !hasAdditionalMaterializableScalarSourceMembers
  ) {
    const [selectedMemberN] = selectedScalarSourceMemberNs;
    const selectedIndex = selectedMemberN ? selectedMemberN - 1 : undefined;
    const selectedMember =
      selectedIndex !== undefined
        ? sourceLayout.members[selectedIndex]
        : undefined;
    if (selectedMemberN !== undefined && selectedMember) {
      const [selectedMemberTypeAst, selectedMemberTypeContext] = emitTypeAst(
        selectedMember,
        targetLayoutContext
      );
      const [materializationTargetTypeAst, materializationTargetTypeContext] =
        emitTypeAst(materializationTargetType, selectedMemberTypeContext);
      const canProjectSelectedMemberDirectly =
        runtimeUnionAliasReferencesMatch(
          selectedMember,
          materializationTargetType,
          materializationTargetTypeContext
        ) ||
        (sameTypeAstSurface(
          stripNullableTypeAst(selectedMemberTypeAst),
          stripNullableTypeAst(materializationTargetTypeAst)
        ) &&
          !requiresValueTypeMaterialization(
            selectedMember,
            materializationTargetType,
            materializationTargetTypeContext
          ));
      if (canProjectSelectedMemberDirectly) {
        return [
          {
            kind: "parenthesizedExpression",
            expression: {
              kind: "invocationExpression",
              expression: {
                kind: "memberAccessExpression",
                expression: valueAst,
                memberName: `As${selectedMemberN}`,
              },
              arguments: [],
            },
          },
          materializationTargetTypeContext,
        ];
      }
    }
  }

  if (targetLayout) {
    const directRuntimeCarrierType =
      resolveDirectRuntimeCarrierType(valueAst, targetLayoutContext) ??
      resolveDirectValueSurfaceType(valueAst, targetLayoutContext);
    if (
      directRuntimeCarrierType &&
      runtimeUnionAliasReferencesMatch(
        directRuntimeCarrierType,
        materializationTargetType,
        targetLayoutContext
      ) &&
      runtimeUnionCarrierSurfacesMatch(
        directRuntimeCarrierType,
        materializationTargetType,
        targetLayoutContext,
        emitTypeAst
      )
    ) {
      return [valueAst, targetLayoutContext];
    }

    const sourceAliasMemberIndices = targetLayout.members.flatMap(
      (member, index) =>
        member &&
        runtimeUnionAliasReferencesMatch(
          member,
          scalarSourceType,
          targetLayoutContext
        )
          ? [index]
          : []
    );
    if (sourceAliasMemberIndices.length === 1) {
      const [sourceAliasMemberIndex] = sourceAliasMemberIndices;
      if (sourceAliasMemberIndex !== undefined) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(targetLayout),
            sourceAliasMemberIndex + 1,
            valueAst
          ),
          targetLayoutContext,
        ];
      }
    }
  }

  if (!sourceLayout && !targetLayout) {
    const [sourceTypeAst, sourceTypeContext] = emitTypeAst(
      sourceType,
      targetLayoutContext
    );
    const [targetTypeAst, targetTypeContext] = emitTypeAst(
      materializationTargetType,
      sourceTypeContext
    );
    return sameTypeAstSurface(
      stripNullableTypeAst(sourceTypeAst),
      stripNullableTypeAst(targetTypeAst)
    ) &&
      !requiresValueTypeMaterialization(
        sourceType,
        materializationTargetType,
        targetTypeContext
      )
      ? [valueAst, targetTypeContext]
      : undefined;
  }

  if (!sourceLayout) {
    return targetLayout
      ? tryBuildScalarToRuntimeUnionMaterializationAst(
          valueAst,
          scalarSourceType,
          targetLayout,
          targetLayoutContext,
          emitTypeAst
        )
      : undefined;
  }

  if (targetLayout) {
    const namedReferenceTarget =
      materializationTargetType.kind === "referenceType"
        ? emitTypeAst(materializationTargetType, targetLayoutContext)
        : undefined;
    if (
      getRuntimeUnionAliasReferenceKey(
        materializationTargetType,
        targetLayoutContext
      ) ||
      namedReferenceTarget !== undefined
    ) {
      const targetUnionTypeAst =
        namedReferenceTarget?.[0] ?? buildRuntimeUnionTypeAst(targetLayout);
      const lambdaArgs: CSharpExpressionAst[] = [];
      let sawReachableMatch = false;
      let currentContext = namedReferenceTarget?.[1] ?? targetLayoutContext;
      const sourceMemberIndexBySlot = new Map<number, number>();
      for (let index = 0; index < sourceLayout.members.length; index += 1) {
        sourceMemberIndexBySlot.set(
          effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1,
          index
        );
      }

      for (
        let slotIndex = 0;
        slotIndex < sourceLayout.runtimeUnionArity;
        slotIndex += 1
      ) {
        const sourceMemberN = slotIndex + 1;
        const index = sourceMemberIndexBySlot.get(sourceMemberN);
        const actualMember =
          index !== undefined ? sourceLayout.members[index] : undefined;
        const actualMemberTypeAst =
          index !== undefined ? sourceLayout.memberTypeAsts[index] : undefined;

        const parameterName = `__tsonic_union_member_${sourceMemberN}`;
        const parameterExpr: CSharpExpressionAst = {
          kind: "identifierExpression",
          identifier: parameterName,
        };

        let body: CSharpExpressionAst;
        if (!actualMember || !actualMemberTypeAst) {
          body = buildInvalidRuntimeUnionMaterializationExpression(
            { kind: "unknownType" },
            materializationTargetType
          );
        } else if (
          selectedSourceMemberNs &&
          !selectedSourceMemberNs.has(sourceMemberN)
        ) {
          body = buildInvalidRuntimeUnionMaterializationExpression(
            actualMember,
            materializationTargetType
          );
        } else if (
          (runtimeUnionAliasReferencesMatch(
            actualMember,
            materializationTargetType,
            currentContext
          ) ||
            matchesExpectedEmissionType(
              actualMember,
              materializationTargetType,
              currentContext
            )) &&
          sameTypeAstSurface(
            stripNullableTypeAst(actualMemberTypeAst),
            stripNullableTypeAst(targetUnionTypeAst)
          )
        ) {
          body = parameterExpr;
          sawReachableMatch = true;
        } else {
          const targetMemberIndex = findRuntimeUnionMemberIndex(
            targetLayout.members,
            actualMember,
            currentContext
          );
          const targetMember =
            targetMemberIndex !== undefined
              ? targetLayout.members[targetMemberIndex]
              : undefined;
          const targetMemberTypeAst =
            targetMemberIndex !== undefined
              ? targetLayout.memberTypeAsts[targetMemberIndex]
              : undefined;
          if (
            targetMemberIndex === undefined ||
            !targetMember ||
            !targetMemberTypeAst
          ) {
            if (
              sameTypeAstSurface(
                stripNullableTypeAst(actualMemberTypeAst),
                stripNullableTypeAst(targetUnionTypeAst)
              )
            ) {
              body = parameterExpr;
              sawReachableMatch = true;
            } else {
              const nestedMaterialization =
                tryBuildNestedRuntimeUnionToTargetLayoutAst(
                  parameterExpr,
                  actualMember,
                  materializationTargetType,
                  targetLayout,
                  currentContext,
                  emitTypeAst
                ) ??
                tryBuildRuntimeMaterializationAst(
                  parameterExpr,
                  actualMember,
                  materializationTargetType,
                  currentContext,
                  emitTypeAst
                );
              if (nestedMaterialization) {
                body = nestedMaterialization[0];
                currentContext = nestedMaterialization[1];
                sawReachableMatch = true;
              } else {
                body = buildInvalidRuntimeUnionMaterializationExpression(
                  actualMember,
                  materializationTargetType
                );
              }
            }
          } else {
            const memberSurfacesAlreadyMatch = sameTypeAstSurface(
              stripNullableTypeAst(actualMemberTypeAst),
              stripNullableTypeAst(targetMemberTypeAst)
            );
            const nestedMaterialization = memberSurfacesAlreadyMatch
              ? undefined
              : tryBuildRuntimeMaterializationAst(
                  parameterExpr,
                  actualMember,
                  targetMember,
                  currentContext,
                  emitTypeAst
                );
            const nestedMaterializedValueAst =
              nestedMaterialization &&
              !(
                !willCarryAsRuntimeUnion(actualMember, currentContext) &&
                isRuntimeUnionMemberProjectionAst(nestedMaterialization[0])
              )
                ? nestedMaterialization[0]
                : undefined;
            const fallbackValueAst = maybeCastMaterializedValueAst(
              parameterExpr,
              actualMemberTypeAst,
              targetMemberTypeAst
            );
            const wrappedValueAst =
              nestedMaterializedValueAst ?? fallbackValueAst;
            body = buildRuntimeUnionFactoryCallAst(
              targetUnionTypeAst,
              targetMemberIndex + 1,
              wrappedValueAst
            );
            currentContext = nestedMaterialization?.[1] ?? currentContext;
            sawReachableMatch = true;
          }
        }

        lambdaArgs.push({
          kind: "lambdaExpression",
          isAsync: false,
          parameters: [{ name: parameterName }],
          body,
        });
      }

      return sawReachableMatch
        ? [
            buildRuntimeUnionMatchAst(valueAst, lambdaArgs, [
              targetUnionTypeAst,
            ]),
            currentContext,
          ]
        : undefined;
    }

    return tryBuildRuntimeUnionProjectionToLayoutAst({
      valueAst,
      sourceLayout,
      targetLayout,
      context: targetLayoutContext,
      candidateMemberNs: effectiveSourceFrame?.candidateMemberNs,
      selectedSourceMemberNs,
      buildMappedMemberValue: ({
        actualMember,
        actualMemberTypeAst,
        parameterExpr,
        targetMember,
        targetMemberTypeAst,
        context: nextContext,
      }) => {
        const memberSurfacesAlreadyMatch = sameTypeAstSurface(
          stripNullableTypeAst(actualMemberTypeAst),
          stripNullableTypeAst(targetMemberTypeAst)
        );
        const nestedMaterialization = memberSurfacesAlreadyMatch
          ? undefined
          : tryBuildRuntimeMaterializationAst(
              parameterExpr,
              actualMember,
              targetMember,
              nextContext,
              emitTypeAst
            );
        return [
          nestedMaterialization?.[0] ??
            maybeCastMaterializedValueAst(
              parameterExpr,
              actualMemberTypeAst,
              targetMemberTypeAst
            ),
          nestedMaterialization?.[1] ?? nextContext,
        ];
      },
      buildExcludedMemberBody: ({ actualMember }) =>
        buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      buildUnmappedMemberBody: ({
        actualMember,
        parameterExpr,
        context: nextContext,
      }) =>
        tryBuildNestedRuntimeUnionToTargetLayoutAst(
          parameterExpr,
          actualMember,
          materializationTargetType,
          targetLayout,
          nextContext,
          emitTypeAst
        ) ??
        tryBuildRuntimeMaterializationAst(
          parameterExpr,
          actualMember,
          materializationTargetType,
          nextContext,
          emitTypeAst
        ) ??
        buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
    });
  }

  const [targetTypeAst, nextContext] = emitTypeAst(
    materializationTargetType,
    targetLayoutContext
  );
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    targetLayoutContext
  );
  if (directRuntimeCarrierType) {
    const [directCarrierTypeAst, directCarrierContext] = emitTypeAst(
      directRuntimeCarrierType,
      nextContext
    );
    if (sameTypeAstSurface(directCarrierTypeAst, targetTypeAst)) {
      return [valueAst, directCarrierContext];
    }
  }
  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    targetLayoutContext
  );
  if (directValueSurfaceType) {
    const [directTypeAst, directTypeContext] = emitTypeAst(
      directValueSurfaceType,
      nextContext
    );
    if (sameTypeAstSurface(directTypeAst, targetTypeAst)) {
      return [valueAst, directTypeContext];
    }
  }
  const concreteTargetTypeAst = stripNullableTypeAst(targetTypeAst);
  const concreteTargetTypeKey = stableConcreteTypeKeyFromAst(
    concreteTargetTypeAst
  );
  const isBroadObjectTarget = isBroadObjectSlotType(
    materializationTargetType,
    nextContext
  );
  const sourceSurfaceMemberTypeAsts =
    getRuntimeUnionCastMemberTypeAsts(valueAst);
  const matchingSourceIndices = sourceLayout.members.flatMap((member, index) =>
    member &&
    (!selectedSourceMemberNs ||
      selectedSourceMemberNs.has(
        effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1
      )) &&
    (isBroadObjectTarget ||
      canMaterializeArrayToObjectArrayAst(
        member,
        concreteTargetTypeAst,
        nextContext
      ) ||
      canMaterializeArrayToBroadObjectArray(
        member,
        materializationTargetType,
        nextContext
      ) ||
      tryBuildArrayElementMaterializationAst(
        identifierExpression("__tsonic_array_probe"),
        member,
        materializationTargetType,
        nextContext,
        emitTypeAst
      ) !== undefined ||
      (() => {
        const materialized = tryBuildRuntimeMaterializationAst(
          identifierExpression("__tsonic_member_probe"),
          member,
          materializationTargetType,
          nextContext,
          emitTypeAst
        );
        return (
          materialized !== undefined &&
          materializedExpressionMatchesTargetType(
            materialized[0],
            materializationTargetType,
            materialized[1],
            emitTypeAst
          )
        );
      })() ||
      canMaterializeStringKeyDictionary(
        member,
        materializationTargetType,
        nextContext
      ) ||
      (() => {
        const sourceMemberTypeAst =
          sourceSurfaceMemberTypeAsts?.[index] ??
          sourceLayout.memberTypeAsts[index];
        if (!sourceMemberTypeAst) {
          return false;
        }
        return (
          stableConcreteTypeKeyFromAst(sourceMemberTypeAst) ===
          concreteTargetTypeKey
        );
      })() ||
      findRuntimeUnionMemberIndex(
        [member],
        materializationTargetType,
        nextContext
      ) === 0)
      ? [index]
      : []
  );

  if (matchingSourceIndices.length === 0) {
    return undefined;
  }

  if (matchingSourceIndices.length === 1) {
    const [matchingSourceIndex] = matchingSourceIndices;
    if (matchingSourceIndex !== undefined) {
      const matchingSourceMemberN =
        effectiveSourceFrame?.candidateMemberNs?.[matchingSourceIndex] ??
        matchingSourceIndex + 1;
      const matchingSourceMember = sourceLayout.members[matchingSourceIndex];
      const projectedMemberAst: CSharpExpressionAst = {
        kind: "parenthesizedExpression",
        expression: {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: valueAst,
            memberName: `As${matchingSourceMemberN}`,
          },
          arguments: [],
        },
      };
      const arrayElementMaterialization = matchingSourceMember
        ? tryBuildArrayElementMaterializationAst(
            projectedMemberAst,
            matchingSourceMember,
            materializationTargetType,
            nextContext,
            emitTypeAst
          )
        : undefined;
      if (arrayElementMaterialization) {
        return arrayElementMaterialization;
      }
      const dictionaryMemberMaterialization = matchingSourceMember
        ? tryBuildDictionaryMemberMaterializationAst(
            projectedMemberAst,
            matchingSourceMember,
            materializationTargetType,
            nextContext,
            emitTypeAst
          )
        : undefined;
      if (dictionaryMemberMaterialization) {
        return dictionaryMemberMaterialization;
      }
      const nestedMemberMaterialization = matchingSourceMember
        ? tryBuildRuntimeMaterializationAst(
            projectedMemberAst,
            matchingSourceMember,
            materializationTargetType,
            nextContext,
            emitTypeAst
          )
        : undefined;
      if (
        nestedMemberMaterialization &&
        materializedExpressionMatchesTargetType(
          nestedMemberMaterialization[0],
          materializationTargetType,
          nestedMemberMaterialization[1],
          emitTypeAst
        )
      ) {
        return nestedMemberMaterialization;
      }
      return [projectedMemberAst, nextContext];
    }
  }

  const lambdaArgs: CSharpExpressionAst[] = [];
  let matchContext = nextContext;
  const sourceMemberIndexBySlot = new Map<number, number>();
  for (let index = 0; index < sourceLayout.members.length; index += 1) {
    sourceMemberIndexBySlot.set(
      effectiveSourceFrame?.candidateMemberNs?.[index] ?? index + 1,
      index
    );
  }

  for (
    let slotIndex = 0;
    slotIndex < sourceLayout.runtimeUnionArity;
    slotIndex += 1
  ) {
    const sourceMemberN = slotIndex + 1;
    const index = sourceMemberIndexBySlot.get(sourceMemberN);
    const actualMember =
      index !== undefined ? sourceLayout.members[index] : undefined;

    const parameterName = `__tsonic_union_member_${sourceMemberN}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    if (!actualMember || index === undefined) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          { kind: "unknownType" },
          materializationTargetType
        ),
      });
      continue;
    }

    if (selectedSourceMemberNs && !selectedSourceMemberNs.has(sourceMemberN)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      });
      continue;
    }

    if (!matchingSourceIndices.includes(index)) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body: buildInvalidRuntimeUnionMaterializationExpression(
          actualMember,
          materializationTargetType
        ),
      });
      continue;
    }

    const arrayElementMaterialization = tryBuildArrayElementMaterializationAst(
      parameterExpr,
      actualMember,
      materializationTargetType,
      matchContext,
      emitTypeAst
    );
    if (arrayElementMaterialization) {
      matchContext = arrayElementMaterialization[1];
    }
    const dictionaryMemberMaterialization =
      arrayElementMaterialization === undefined
        ? tryBuildDictionaryMemberMaterializationAst(
            parameterExpr,
            actualMember,
            materializationTargetType,
            matchContext,
            emitTypeAst,
            parameterName
          )
        : undefined;
    if (dictionaryMemberMaterialization) {
      matchContext = dictionaryMemberMaterialization[1];
    }
    const sourceMemberTypeAst =
      sourceSurfaceMemberTypeAsts?.[index] ??
      sourceLayout.memberTypeAsts[index];
    const castMaterializedValue = sourceMemberTypeAst
      ? maybeCastMaterializedValueAst(
          parameterExpr,
          sourceMemberTypeAst,
          concreteTargetTypeAst
        )
      : undefined;
    const nestedMemberMaterializationCandidate =
      !arrayElementMaterialization && !dictionaryMemberMaterialization
        ? tryBuildRuntimeMaterializationAst(
            parameterExpr,
            actualMember,
            materializationTargetType,
            matchContext,
            emitTypeAst
          )
        : undefined;
    const nestedMemberMaterialization =
      nestedMemberMaterializationCandidate &&
      materializedExpressionMatchesTargetType(
        nestedMemberMaterializationCandidate[0],
        materializationTargetType,
        nestedMemberMaterializationCandidate[1],
        emitTypeAst
      )
        ? nestedMemberMaterializationCandidate
        : undefined;
    if (nestedMemberMaterialization) {
      matchContext = nestedMemberMaterialization[1];
    }
    const memberBody =
      arrayElementMaterialization?.[0] ??
      dictionaryMemberMaterialization?.[0] ??
      nestedMemberMaterialization?.[0] ??
      castMaterializedValue ??
      buildInvalidRuntimeUnionMaterializationExpression(
        actualMember,
        materializationTargetType
      );
    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body: memberBody,
    });
  }

  return [
    buildRuntimeUnionMatchAst(valueAst, lambdaArgs, [concreteTargetTypeAst]),
    matchContext,
  ];
};

export const tryBuildRuntimeReificationPlan = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn,
  options: RuntimeReificationOptions = {}
): RuntimeReificationPlan | undefined => {
  const directExpectedType = stripNullish(expectedType);
  if (options.activeTypes?.has(directExpectedType)) {
    return undefined;
  }
  options = {
    ...options,
    activeTypes: new Set([...(options.activeTypes ?? []), directExpectedType]),
  };
  if (options.recursiveHelper) {
    if (directExpectedType.kind === "arrayType") {
      const directArrayReification = buildRuntimeArrayReificationPlan(
        valueAst,
        expectedType,
        directExpectedType,
        context,
        emitTypeAst,
        options
      );
      if (directArrayReification) {
        return directArrayReification;
      }
    }

    if (directExpectedType.kind === "dictionaryType") {
      const directDictionaryReification = buildRuntimeDictionaryReificationPlan(
        valueAst,
        expectedType,
        directExpectedType,
        context,
        emitTypeAst,
        options
      );
      if (directDictionaryReification) {
        return directDictionaryReification;
      }
    }
  }

  const materializationExpectedType = resolveRuntimeMaterializationTargetType(
    expectedType,
    context
  );
  const resolvedMaterializationExpected = resolveTypeAlias(
    materializationExpectedType,
    context,
    { preserveObjectTypeAliases: true }
  );
  const expectedAllowsRuntimeNullish = hasTopLevelRuntimeNullishMember(
    resolvedMaterializationExpected
  );
  const resolvedExpected = resolveTypeAlias(
    stripNullish(materializationExpectedType),
    context,
    { preserveObjectTypeAliases: true }
  );
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    context
  );
  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    context
  );

  if (
    resolvedExpected.kind === "unknownType" ||
    resolvedExpected.kind === "anyType" ||
    resolvedExpected.kind === "neverType" ||
    resolvedExpected.kind === "voidType" ||
    resolvedExpected.kind === "objectType" ||
    (resolvedExpected.kind === "referenceType" &&
      resolvedExpected.name === "object")
  ) {
    return undefined;
  }

  if (
    resolvedExpected.kind === "primitiveType" &&
    (resolvedExpected.name === "null" || resolvedExpected.name === "undefined")
  ) {
    const boxedValue = boxValueAst(valueAst);
    return {
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: boxedValue,
        right: nullLiteral(),
      },
      value: { kind: "defaultExpression" },
      context,
    };
  }

  let [unionTypeAst, runtimeLayout, unionTypeContext] =
    precomputedRuntimeLayoutAppliesTo(
      expectedType,
      options,
      context,
      emitTypeAst
    )
      ? [options.typeAst!, options.layout!, options.context ?? context]
      : emitRuntimeCarrierTypeAst(expectedType, context, emitTypeAst);
  let concreteUnionTypeAst = stripNullableTypeAst(unionTypeAst);
  if (!runtimeLayout && resolvedExpected.kind === "unionType") {
    const [resolvedLayout, resolvedLayoutContext] = buildRuntimeUnionLayout(
      resolvedExpected,
      context,
      emitTypeAst
    );
    if (resolvedLayout) {
      runtimeLayout = resolvedLayout;
      unionTypeContext = resolvedLayoutContext;
      unionTypeAst = buildRuntimeUnionTypeAst(resolvedLayout);
      concreteUnionTypeAst = stripNullableTypeAst(unionTypeAst);
    }
  }

  if (resolvedExpected.kind === "unionType" || !!runtimeLayout) {
    if (
      directRuntimeCarrierType &&
      !isRuntimeUnionMemberProjectionAst(valueAst) &&
      !isBroadObjectRuntimeMemberType(directRuntimeCarrierType, context)
    ) {
      const materialized = tryBuildRuntimeMaterializationAst(
        valueAst,
        directRuntimeCarrierType,
        materializationExpectedType,
        context,
        emitTypeAst
      );
      if (materialized) {
        const [unionTypeAst, materializedContext] = emitTypeAst(
          materializationExpectedType,
          materialized[1]
        );
        return {
          condition: {
            kind: "isExpression",
            expression: boxValueAst(valueAst),
            pattern: {
              kind: "typePattern",
              type: stripNullableTypeAst(unionTypeAst),
            },
          },
          value: materialized[0],
          context: materializedContext,
        };
      }
    }
    if (
      directValueSurfaceType &&
      !isRuntimeUnionMemberProjectionAst(valueAst) &&
      !isBroadObjectRuntimeMemberType(directValueSurfaceType, context)
    ) {
      const materialized = tryBuildRuntimeMaterializationAst(
        valueAst,
        directValueSurfaceType,
        materializationExpectedType,
        context,
        emitTypeAst
      );
      if (materialized) {
        const [unionTypeAst, materializedContext] = emitTypeAst(
          materializationExpectedType,
          materialized[1]
        );
        return {
          condition: {
            kind: "isExpression",
            expression: boxValueAst(valueAst),
            pattern: {
              kind: "typePattern",
              type: stripNullableTypeAst(unionTypeAst),
            },
          },
          value: materialized[0],
          context: materializedContext,
        };
      }
    }

    if (!runtimeLayout) {
      return undefined;
    }

    const members = runtimeLayout.members;
    const semanticMembers =
      resolvedExpected.kind === "unionType" ? resolvedExpected.types : members;
    const memberPlanTypes = alignSemanticRuntimeUnionMembers(
      members,
      semanticMembers,
      unionTypeContext
    );

    if (
      !options.recursiveHelper &&
      semanticMembers.some((member) =>
        typeContainsRecursiveReificationTarget(
          member,
          expectedType,
          unionTypeContext
        )
      )
    ) {
      const helperName = runtimeReificationHelperName(concreteUnionTypeAst);
      const helperParameterName = "__tsonic_reify_input";
      const recursiveHelper: RecursiveRuntimeReificationHelper = {
        expectedType,
        name: helperName,
        typeAst: concreteUnionTypeAst,
      };
      const helperOptions: RuntimeReificationOptions = {
        typeAst: unionTypeAst,
        layout: runtimeLayout,
        layoutType: expectedType,
        context: unionTypeContext,
        recursiveHelper,
      };
      const helperInputAst = identifierExpression(helperParameterName);
      const helperPlan = tryBuildRuntimeReificationPlan(
        helperInputAst,
        expectedType,
        unionTypeContext,
        emitTypeAst,
        helperOptions
      );
      const conditionPlan = tryBuildRuntimeReificationPlan(
        valueAst,
        expectedType,
        unionTypeContext,
        emitTypeAst,
        helperOptions
      );
      if (helperPlan && conditionPlan) {
        return {
          condition: conditionPlan.condition,
          value: buildZeroArgLambdaInvocationAst(concreteUnionTypeAst, [
            {
              kind: "localFunctionStatement",
              modifiers: [],
              returnType: concreteUnionTypeAst,
              name: helperName,
              parameters: [
                {
                  name: helperParameterName,
                  type: objectNullableTypeAst(),
                },
              ],
              body: {
                kind: "blockStatement",
                statements: [
                  {
                    kind: "returnStatement",
                    expression: helperPlan.value,
                  },
                ],
              },
            },
            {
              kind: "returnStatement",
              expression: buildRuntimeReificationHelperCallAst(
                helperName,
                valueAst
              ),
            },
          ]),
          context: helperPlan.context,
        };
      }
    }

    const cases: RuntimeReificationPlan[] = [];
    if (expectedAllowsRuntimeNullish) {
      cases.push({
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: boxValueAst(valueAst),
          right: nullLiteral(),
        },
        value: { kind: "defaultExpression" },
        context: unionTypeContext,
      });
    }
    cases.push({
      condition: {
        kind: "isExpression",
        expression: boxValueAst(valueAst),
        pattern: {
          kind: "typePattern",
          type: concreteUnionTypeAst,
        },
      },
      value: {
        kind: "castExpression",
        type: concreteUnionTypeAst,
        expression: boxValueAst(valueAst),
      },
      context: unionTypeContext,
    });

    let currentContext = unionTypeContext;
    let catchAllCase: RuntimeReificationPlan | undefined;
    for (let index = 0; index < members.length; index += 1) {
      const runtimeMember = members[index];
      const member = memberPlanTypes[index] ?? runtimeMember;
      if (!runtimeMember || !member) continue;
      if (
        typeMatchesRecursiveReificationTarget(
          member,
          options.recursiveHelper,
          currentContext
        )
      ) {
        continue;
      }
      const objectCatchAllPlan = tryBuildBroadObjectCatchAllReificationPlan(
        valueAst,
        member,
        currentContext,
        emitTypeAst
      );
      const memberPlan =
        objectCatchAllPlan ??
        tryBuildRuntimeReificationPlan(
          valueAst,
          member,
          currentContext,
          emitTypeAst,
          options
        );
      if (!memberPlan) continue;
      currentContext = memberPlan.context;
      const casePlan = {
        condition: memberPlan.condition,
        value: buildRuntimeUnionFactoryCallAst(
          concreteUnionTypeAst,
          index + 1,
          memberPlan.value
        ),
        context: currentContext,
      };
      if (objectCatchAllPlan) {
        catchAllCase = casePlan;
      } else {
        cases.push(casePlan);
      }
    }

    if (cases.length === 0 && !catchAllCase) {
      return undefined;
    }

    const firstCase = cases[0] ?? catchAllCase;
    const lastCase = catchAllCase ?? cases[cases.length - 1];
    if (!firstCase || !lastCase) {
      return undefined;
    }

    let conditionAst = catchAllCase
      ? booleanLiteral(true)
      : firstCase.condition;
    let valueExpression =
      catchAllCase?.value ??
      buildInvalidReificationExpression(
        "Unreachable runtime union reification path"
      );
    let finalContext = lastCase.context;

    if (!catchAllCase) {
      for (let index = 1; index < cases.length; index += 1) {
        const currentCase = cases[index];
        if (!currentCase) {
          continue;
        }
        conditionAst = {
          kind: "binaryExpression",
          operatorToken: "||",
          left: conditionAst,
          right: currentCase.condition,
        };
      }
    }

    for (let index = cases.length - 1; index >= 0; index -= 1) {
      const currentCase = cases[index];
      if (!currentCase) {
        continue;
      }
      valueExpression = {
        kind: "conditionalExpression",
        condition: currentCase.condition,
        whenTrue: currentCase.value,
        whenFalse: valueExpression,
      };
      finalContext = currentCase.context;
    }
    const [singleEvaluatedValueExpression, singleEvaluatedContext] =
      singleEvaluateRuntimeReificationValueAst(
        valueAst,
        concreteUnionTypeAst,
        valueExpression,
        finalContext
      );

    return {
      condition: conditionAst,
      value: singleEvaluatedValueExpression,
      context: singleEvaluatedContext,
    };
  }

  if (
    resolvedExpected.kind === "arrayType" ||
    resolvedExpected.kind === "tupleType" ||
    (resolvedExpected.kind === "referenceType" &&
      (resolvedExpected.name === "Array" ||
        resolvedExpected.name === "ReadonlyArray"))
  ) {
    const directArrayElementMaterialization =
      directValueSurfaceType &&
      tryBuildArrayElementMaterializationAst(
        valueAst,
        directValueSurfaceType,
        expectedType,
        context,
        emitTypeAst
      );
    if (directArrayElementMaterialization) {
      return {
        condition: buildArrayShapeCondition(valueAst),
        value: directArrayElementMaterialization[0],
        context: directArrayElementMaterialization[1],
      };
    }
  }

  const dictionaryReification = buildRuntimeDictionaryReificationPlan(
    valueAst,
    expectedType,
    resolvedExpected,
    context,
    emitTypeAst,
    options
  );
  if (dictionaryReification) {
    return dictionaryReification;
  }

  const arrayReification = buildRuntimeArrayReificationPlan(
    valueAst,
    expectedType,
    resolvedExpected,
    context,
    emitTypeAst,
    options
  );
  if (arrayReification) {
    return arrayReification;
  }

  const [typeAst, typeContext] = emitTypeAst(expectedType, context);
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  const boxedValue = boxValueAst(valueAst);

  if (
    resolvedExpected.kind === "arrayType" ||
    resolvedExpected.kind === "tupleType" ||
    (resolvedExpected.kind === "referenceType" &&
      (resolvedExpected.name === "Array" ||
        resolvedExpected.name === "ReadonlyArray"))
  ) {
    if (directValueSurfaceType) {
      const elementMaterialization = tryBuildArrayElementMaterializationAst(
        valueAst,
        directValueSurfaceType,
        expectedType,
        typeContext,
        emitTypeAst
      );
      if (elementMaterialization) {
        return {
          condition: buildArrayShapeCondition(valueAst),
          value: elementMaterialization[0],
          context: elementMaterialization[1],
        };
      }
    }

    return {
      condition: buildArrayShapeCondition(valueAst),
      value: {
        kind: "castExpression",
        type: concreteTypeAst,
        expression: boxedValue,
      },
      context: typeContext,
    };
  }

  return {
    condition: {
      kind: "isExpression",
      expression: boxedValue,
      pattern: {
        kind: "typePattern",
        type: concreteTypeAst,
      },
    },
    value: {
      kind: "castExpression",
      type: concreteTypeAst,
      expression: boxedValue,
    },
    context: typeContext,
  };
};
