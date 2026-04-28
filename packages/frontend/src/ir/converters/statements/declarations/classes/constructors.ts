import * as ts from "typescript";
import { IrClassMember, IrStatement } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import { getAccessibility, convertParameters } from "../../helpers.js";
import { withParameterTypeEnv } from "../../../type-env.js";
import type { ProgramContext } from "../../../../program-context.js";

const isLeadingSuperCallStatement = (statement: IrStatement): boolean => {
  if (statement.kind !== "expressionStatement") {
    return false;
  }

  const expression = statement.expression;
  return (
    expression.kind === "call" &&
    expression.callee.kind === "identifier" &&
    expression.callee.name === "super"
  );
};

/**
 * Convert constructor declaration to IR
 */
export const convertConstructor = (
  node: ts.ConstructorDeclaration,
  ctx: ProgramContext
): IrClassMember => {
  const parameters = convertParameters(node.parameters, ctx);
  const bodyCtx = withParameterTypeEnv(ctx, node.parameters, parameters);

  const statements: IrStatement[] = [];
  if (node.body) {
    const existingBody = convertBlockStatement(node.body, bodyCtx, undefined);
    const [first, ...rest] = existingBody.statements;
    if (first && isLeadingSuperCallStatement(first)) {
      statements.push(first, ...rest);
    } else {
      statements.push(...existingBody.statements);
    }
  }

  return {
    kind: "constructorDeclaration",
    parameters,
    body: { kind: "blockStatement", statements },
    accessibility: getAccessibility(node),
  };
};
