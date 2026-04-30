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
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { withScoped } from "../../emitter-types/context.js";
import type {
  CSharpStatementAst,
  CSharpBlockStatementAst,
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
import { stripNullish } from "../../core/semantic/type-resolution.js";

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

export const emitBlockStatementAst = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const outerNameMap = context.localNameMap;
  const outerConditionAliases = context.conditionAliases;
  const outerSemanticTypes = context.localSemanticTypes;
  const outerValueTypes = context.localValueTypes;
  return withScoped(
    context,
    {
      localNameMap: new Map(outerNameMap ?? []),
      conditionAliases: new Map(outerConditionAliases ?? []),
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
    const effectiveReturnExpectedType = asyncReturnResultType ?? context.returnType;
    const returnExpectedType =
      effectiveReturnExpectedType &&
      returnExpression.kind !== "conditional" &&
      isExpectedJsNumberIrType(effectiveReturnExpectedType, context) &&
      isNumericSourceIrType(returnExpressionType, context) &&
      !isNumericTypeParameterSource(returnExpressionType, context)
        ? undefined
        : effectiveReturnExpectedType;

    const [exprAst, newContext] = emitExpressionAst(
      returnExpression,
      context,
      returnExpectedType
    );

    return [
      [
        {
          kind: "returnStatement",
          expression: exprAst,
        },
      ],
      newContext,
    ];
  }

  return [[{ kind: "returnStatement" }], context];
};
