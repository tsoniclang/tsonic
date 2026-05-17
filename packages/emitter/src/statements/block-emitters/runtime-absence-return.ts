import type { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import type {
  CSharpBlockStatementAst,
  CSharpStatementAst,
} from "../../core/format/backend-ast/types.js";
import {
  isRuntimeNullishType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "../../core/semantic/type-resolution.js";

const runtimeAbsenceExpression: IrExpression = {
  kind: "literal",
  value: undefined,
  inferredType: { kind: "primitiveType", name: "undefined" },
};

export const isDefinitelyTerminatingStatement = (
  stmt: IrStatement
): boolean => {
  switch (stmt.kind) {
    case "returnStatement":
    case "throwStatement":
    case "generatorReturnStatement":
      return true;
    case "blockStatement": {
      const last = stmt.statements.at(-1);
      return last ? isDefinitelyTerminatingStatement(last) : false;
    }
    case "ifStatement":
      return (
        stmt.elseStatement !== undefined &&
        isDefinitelyTerminatingStatement(stmt.thenStatement) &&
        isDefinitelyTerminatingStatement(stmt.elseStatement)
      );
    case "tryStatement":
      if (
        stmt.finallyBlock &&
        isDefinitelyTerminatingStatement(stmt.finallyBlock)
      ) {
        return true;
      }
      return (
        stmt.catchClause !== undefined &&
        isDefinitelyTerminatingStatement(stmt.tryBlock) &&
        isDefinitelyTerminatingStatement(stmt.catchClause.body)
      );
    case "switchStatement": {
      const hasDefault = stmt.cases.some((caseClause) => !caseClause.test);
      return (
        hasDefault &&
        stmt.cases.every((caseClause) => {
          const last = caseClause.statements.at(-1);
          return last ? isDefinitelyTerminatingStatement(last) : false;
        })
      );
    }
    default:
      return false;
  }
};

const returnTypeAcceptsRuntimeAbsence = (
  returnType: IrType | undefined,
  context: EmitterContext
): returnType is IrType => {
  if (!returnType || returnType.kind === "voidType") {
    return false;
  }

  const resolved = resolveTypeAlias(returnType, context);
  if (resolved.kind === "voidType") {
    return false;
  }
  if (isRuntimeNullishType(resolved)) {
    return true;
  }

  return splitRuntimeNullishUnionMembers(resolved)?.hasRuntimeNullish ?? false;
};

export const tryEmitRuntimeAbsenceReturnStatementAst = (
  context: EmitterContext
): [CSharpStatementAst, EmitterContext] | undefined => {
  if (!returnTypeAcceptsRuntimeAbsence(context.returnType, context)) {
    return undefined;
  }

  const [exprAst, newContext] = emitExpressionAst(
    runtimeAbsenceExpression,
    context,
    context.returnType
  );

  return [{ kind: "returnStatement", expression: exprAst }, newContext];
};

export const appendImplicitRuntimeAbsenceReturnAst = (
  blockAst: CSharpBlockStatementAst,
  sourceBody: Extract<IrStatement, { kind: "blockStatement" }>,
  context: EmitterContext
): [CSharpBlockStatementAst, EmitterContext] => {
  if (isDefinitelyTerminatingStatement(sourceBody)) {
    return [blockAst, context];
  }

  const implicitReturn = tryEmitRuntimeAbsenceReturnStatementAst(context);
  if (!implicitReturn) {
    return [blockAst, context];
  }

  const [returnStatement, returnContext] = implicitReturn;
  return [
    {
      kind: "blockStatement",
      statements: [...blockAst.statements, returnStatement],
    },
    returnContext,
  ];
};
