import {
  getAwaitedIrType,
  type IrExpression,
  type IrStatement,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitStatementAst } from "../../statement-emitter.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";
import { withScoped } from "../../emitter-types/context.js";
import type {
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../../core/format/backend-ast/types.js";
import {
  expressionProducesAsyncWrapper,
  getAsyncWrapperResultType,
  isAsyncWrapperType,
} from "../../core/semantic/async-wrapper-types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  isExpectedJsNumberIrType,
  isNumericSourceIrType,
} from "../../expressions/post-emission-adaptation.js";
import {
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { tryEmitRuntimeAbsenceReturnStatementAst } from "./runtime-absence-return.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "../../core/semantic/expected-type-matching.js";
import { tryBuildRuntimeMaterializationAst } from "../../core/semantic/runtime-reification.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "../../core/semantic/direct-value-surfaces.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../../core/semantic/runtime-unions.js";
import { sameTypeAstSurface } from "../../core/format/backend-ast/utils.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { buildInvokedLambdaExpressionAst } from "../../expressions/invoked-lambda.js";

const getBareTypeParameterName = (
  type: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  if (!type) {
    return undefined;
  }

  const stripped = stripNullish(type);
  if (stripped.kind === "typeParameterType") {
    return stripped.name;
  }

  if (
    stripped.kind === "referenceType" &&
    (context.typeParameters?.has(stripped.name) ?? false) &&
    (!stripped.typeArguments || stripped.typeArguments.length === 0)
  ) {
    return stripped.name;
  }

  return undefined;
};

const isNumericTypeParameterSource = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  const typeParameterName = getBareTypeParameterName(type, context);
  return typeParameterName
    ? (context.typeParamConstraints?.get(typeParameterName) ??
        "unconstrained") === "numeric"
    : false;
};

const selectNonNullishReturnExpectedType = (
  returnExpression: IrExpression,
  returnExpressionType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  const expectedSplit = expectedType
    ? splitRuntimeNullishUnionMembers(expectedType)
    : undefined;
  if (
    expectedSplit?.hasRuntimeNullish &&
    (expressionCanProduceRuntimeAbsence(returnExpression) ||
      returnExpression.kind === "call")
  ) {
    return expectedType;
  }

  if (
    !returnExpressionType ||
    !expectedSplit?.hasRuntimeNullish ||
    expectedSplit.nonNullishMembers.length !== 1 ||
    splitRuntimeNullishUnionMembers(returnExpressionType)?.hasRuntimeNullish
  ) {
    return expectedType;
  }

  const [nonNullishExpected] = expectedSplit.nonNullishMembers;
  if (!nonNullishExpected) {
    return expectedType;
  }

  return areIrTypesEquivalent(
    stripNullish(returnExpressionType),
    stripNullish(nonNullishExpected),
    context
  ) ||
    matchesExpectedEmissionType(
      returnExpressionType,
      nonNullishExpected,
      context
    )
    ? nonNullishExpected
    : expectedType;
};

const expressionCanProduceRuntimeAbsence = (expr: IrExpression): boolean => {
  if (
    expr.kind === "memberAccess" &&
    expr.isComputed &&
    (expr.accessKind === "numericIndexer" ||
      expr.accessKind === "dictionary" ||
      expr.accessKind === "stringChar")
  ) {
    return true;
  }

  if (
    expr.kind === "typeAssertion" ||
    expr.kind === "asinterface" ||
    expr.kind === "trycast"
  ) {
    return expressionCanProduceRuntimeAbsence(expr.expression);
  }

  return false;
};

const runtimeCarrierSurfaceDiffers = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  const [expectedLayout] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!actualLayout || !expectedLayout) {
    return false;
  }

  return !sameTypeAstSurface(
    buildRuntimeUnionTypeAst(actualLayout),
    buildRuntimeUnionTypeAst(expectedLayout)
  );
};

const typeAlreadyMatchesReturnExpected = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean =>
  (runtimeUnionAliasReferencesMatch(actualType, expectedType, context) ||
    areIrTypesEquivalent(actualType, expectedType, context) ||
    matchesExpectedEmissionType(actualType, expectedType, context)) &&
  !runtimeCarrierSurfaceDiffers(actualType, expectedType, context) &&
  !requiresValueTypeMaterialization(actualType, expectedType, context);

const isStableNullishProbeAst = (ast: CSharpExpressionAst): boolean => {
  switch (ast.kind) {
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
      return true;
    case "parenthesizedExpression":
      return isStableNullishProbeAst(ast.expression);
    default:
      return false;
  }
};

const unwrapTransparentReturnAst = (
  ast: CSharpExpressionAst
): CSharpExpressionAst =>
  ast.kind === "parenthesizedExpression"
    ? unwrapTransparentReturnAst(ast.expression)
    : ast;

const tryGetRuntimeMatchReceiverAst = (
  ast: CSharpExpressionAst
): CSharpExpressionAst | undefined => {
  const unwrapped = unwrapTransparentReturnAst(ast);
  return unwrapped.kind === "invocationExpression" &&
    unwrapped.expression.kind === "memberAccessExpression" &&
    unwrapped.expression.memberName === "Match"
    ? unwrapped.expression.expression
    : undefined;
};

const replaceReturnExpressionAst = (
  ast: CSharpExpressionAst,
  sourceAst: CSharpExpressionAst,
  replacementAst: CSharpExpressionAst
): CSharpExpressionAst => {
  if (ast === sourceAst) {
    return replacementAst;
  }

  switch (ast.kind) {
    case "parenthesizedExpression":
      return {
        ...ast,
        expression: replaceReturnExpressionAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "castExpression":
      return {
        ...ast,
        expression: replaceReturnExpressionAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
      return {
        ...ast,
        expression: replaceReturnExpressionAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
      };
    case "invocationExpression":
      return {
        ...ast,
        expression: replaceReturnExpressionAst(
          ast.expression,
          sourceAst,
          replacementAst
        ),
        arguments: ast.arguments.map((argument) =>
          replaceReturnExpressionAst(argument, sourceAst, replacementAst)
        ),
      };
    case "binaryExpression":
      return {
        ...ast,
        left: replaceReturnExpressionAst(ast.left, sourceAst, replacementAst),
        right: replaceReturnExpressionAst(ast.right, sourceAst, replacementAst),
      };
    case "conditionalExpression":
      return {
        ...ast,
        condition: replaceReturnExpressionAst(
          ast.condition,
          sourceAst,
          replacementAst
        ),
        whenTrue: replaceReturnExpressionAst(
          ast.whenTrue,
          sourceAst,
          replacementAst
        ),
        whenFalse: replaceReturnExpressionAst(
          ast.whenFalse,
          sourceAst,
          replacementAst
        ),
      };
    default:
      return ast;
  }
};

const tryPreserveNullishReturnAdaptationAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !splitRuntimeNullishUnionMembers(actualType)?.hasRuntimeNullish ||
    !splitRuntimeNullishUnionMembers(expectedType)?.hasRuntimeNullish
  ) {
    return undefined;
  }

  const receiverAst = tryGetRuntimeMatchReceiverAst(ast);
  if (!receiverAst || isStableNullishProbeAst(receiverAst)) {
    return undefined;
  }

  const sourceValue = allocateLocalName("__tsonic_return_value", context);
  const sourceValueAst = identifierExpression(sourceValue.emittedName);
  const replacedAst = replaceReturnExpressionAst(ast, receiverAst, sourceValueAst);
  if (replacedAst === ast) {
    return undefined;
  }

  const [sourceTypeAst, sourceTypeContext] = emitTypeAst(
    actualType,
    sourceValue.context
  );
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    sourceTypeContext
  );

  return [
    buildInvokedLambdaExpressionAst({
      parameters: [{ name: sourceValue.emittedName }],
      parameterTypes: [sourceTypeAst],
      body: {
        kind: "conditionalExpression",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: sourceValueAst,
          right: nullLiteral(),
        },
        whenTrue: { kind: "defaultExpression", type: expectedTypeAst },
        whenFalse: replacedAst,
      },
      arguments: [receiverAst],
      returnType: expectedTypeAst,
      context: expectedTypeContext,
    }),
    expectedTypeContext,
  ];
};

export const emitBlockStatementAst = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const outerNameMap = context.localNameMap;
  const outerConditionAliases = context.conditionAliases;
  const outerDictionaryReadPresenceLocals =
    context.dictionaryReadPresenceLocals;
  const outerSemanticTypes = context.localSemanticTypes;
  const outerValueTypes = context.localValueTypes;
  return withScoped(
    context,
    {
      localNameMap: new Map(outerNameMap ?? []),
      conditionAliases: new Map(outerConditionAliases ?? []),
      dictionaryReadPresenceLocals: new Map(
        outerDictionaryReadPresenceLocals ?? []
      ),
      localSemanticTypes: new Map(outerSemanticTypes ?? []),
      localValueTypes: new Map(outerValueTypes ?? []),
    },
    (scopedContext) => {
      let currentContext: EmitterContext = scopedContext;
      const statements: CSharpStatementAst[] = [];

      for (const s of stmt.statements) {
        const [stmts, newContext] = emitStatementAst(s, currentContext);
        statements.push(...stmts);
        currentContext = newContext;
      }

      return [{ kind: "blockStatement", statements }, currentContext];
    }
  );
};

export const emitReturnStatementAst = (
  stmt: Extract<IrStatement, { kind: "returnStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  if (stmt.expression) {
    if (
      context.returnType?.kind === "voidType" ||
      context.returnType?.kind === "neverType"
    ) {
      const expr =
        stmt.expression.kind === "unary" && stmt.expression.operator === "void"
          ? stmt.expression.expression
          : stmt.expression;

      const isNoopExpr =
        (expr.kind === "literal" &&
          (expr.value === undefined || expr.value === null)) ||
        (expr.kind === "identifier" &&
          (expr.name === "undefined" || expr.name === "null"));

      const [exprAst, newContext] = emitExpressionAst(expr, context);

      if (isNoopExpr) {
        return [[{ kind: "returnStatement" }], newContext];
      }

      const returnStmt: CSharpStatementAst = { kind: "returnStatement" };

      if (
        expr.kind === "call" ||
        expr.kind === "new" ||
        expr.kind === "assignment" ||
        expr.kind === "update" ||
        expr.kind === "await"
      ) {
        return [
          [{ kind: "expressionStatement", expression: exprAst }, returnStmt],
          newContext,
        ];
      }

      const discardLocal = allocateLocalName("__tsonic_discard", newContext);
      return [
        [
          {
            kind: "localDeclarationStatement",
            modifiers: [],
            type: identifierType("var"),
            declarators: [
              {
                name: discardLocal.emittedName,
                initializer: exprAst,
              },
            ],
          },
          returnStmt,
        ],
        discardLocal.context,
      ];
    }

    const shouldAutoAwait =
      context.isAsync &&
      context.returnType !== undefined &&
      !isAsyncWrapperType(context.returnType) &&
      expressionProducesAsyncWrapper(stmt.expression) &&
      stmt.expression.kind !== "await";

    const returnExpression: IrExpression = shouldAutoAwait
      ? {
          kind: "await",
          expression: stmt.expression,
          inferredType:
            getAsyncWrapperResultType(stmt.expression) ?? context.returnType,
          sourceSpan: stmt.expression.sourceSpan,
        }
      : stmt.expression;
    const returnExpressionType =
      resolveEffectiveExpressionType(returnExpression, context) ??
      returnExpression.inferredType;
    const asyncReturnResultType =
      returnExpression.kind === "await" && context.returnType !== undefined
        ? getAwaitedIrType(context.returnType)
        : undefined;
    const effectiveReturnExpectedType =
      asyncReturnResultType ?? context.returnType;
    const nonNullishReturnExpectedType = selectNonNullishReturnExpectedType(
      returnExpression,
      returnExpressionType,
      effectiveReturnExpectedType,
      context
    );
    const returnExpectedType =
      nonNullishReturnExpectedType &&
      returnExpression.kind !== "conditional" &&
      isExpectedJsNumberIrType(nonNullishReturnExpectedType, context) &&
      isNumericSourceIrType(returnExpressionType, context) &&
      !isNumericTypeParameterSource(returnExpressionType, context)
        ? undefined
        : nonNullishReturnExpectedType;

    const [exprAst, newContext] = emitExpressionAst(
      returnExpression,
      context,
      returnExpectedType
    );
    const emittedReturnType =
      resolveDirectRuntimeCarrierType(exprAst, newContext) ??
      resolveDirectValueSurfaceType(exprAst, newContext);
    const returnTypeAlreadyMatches =
      returnExpectedType &&
      returnExpressionType &&
      typeAlreadyMatchesReturnExpected(
        returnExpressionType,
        returnExpectedType,
        newContext
      );
    const emittedReturnAlreadyMatches =
      returnExpectedType &&
      emittedReturnType &&
      typeAlreadyMatchesReturnExpected(
        emittedReturnType,
        returnExpectedType,
        newContext
      );
    const materializedReturn =
      returnExpectedType &&
      returnExpressionType &&
      !returnTypeAlreadyMatches &&
      !emittedReturnAlreadyMatches
        ? tryBuildRuntimeMaterializationAst(
            exprAst,
            returnExpressionType,
            returnExpectedType,
            newContext,
            emitTypeAst
          )
        : undefined;
    const rawReturnAst = materializedReturn?.[0] ?? exprAst;
    const rawReturnContext = materializedReturn?.[1] ?? newContext;
    const nullishPreservedReturn =
      returnExpressionType && effectiveReturnExpectedType
        ? tryPreserveNullishReturnAdaptationAst(
            rawReturnAst,
            returnExpressionType,
            effectiveReturnExpectedType,
            rawReturnContext
          )
        : undefined;

    return [
      [
        {
          kind: "returnStatement",
          expression: nullishPreservedReturn?.[0] ?? rawReturnAst,
        },
      ],
      nullishPreservedReturn?.[1] ?? rawReturnContext,
    ];
  }

  const runtimeAbsenceReturn = tryEmitRuntimeAbsenceReturnStatementAst(context);
  if (runtimeAbsenceReturn) {
    return [[runtimeAbsenceReturn[0]], runtimeAbsenceReturn[1]];
  }

  return [[{ kind: "returnStatement" }], context];
};
