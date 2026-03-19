import { IrStatement } from "@tsonic/frontend";
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
  isAsyncWrapperType,
} from "./async-wrappers.js";

export const emitBlockStatementAst = (
  stmt: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  const outerNameMap = context.localNameMap;
  const outerSemanticTypes = context.localSemanticTypes;
  const outerValueTypes = context.localValueTypes;
  return withScoped(
    context,
    {
      localNameMap: new Map(outerNameMap ?? []),
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

    const [exprAst, newContext] = emitExpressionAst(
      stmt.expression,
      context,
      context.returnType
    );

    const shouldAutoAwait =
      context.isAsync &&
      context.returnType !== undefined &&
      !isAsyncWrapperType(context.returnType) &&
      expressionProducesAsyncWrapper(stmt.expression) &&
      stmt.expression.kind !== "await";

    return [
      [
        {
          kind: "returnStatement",
          expression: shouldAutoAwait
            ? { kind: "awaitExpression", expression: exprAst }
            : exprAst,
        },
      ],
      newContext,
    ];
  }

  return [[{ kind: "returnStatement" }], context];
};
