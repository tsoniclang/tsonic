import {
  getTstsBodyNode,
  getTstsParameters,
  type TstsNode,
} from "@tsonic/tsts";
import { IrClassMember, IrStatement } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  definedTstsNodes,
  getAccessibility,
  convertParameters,
} from "../../helpers.js";
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
  node: TstsNode,
  ctx: ProgramContext
): IrClassMember => {
  const parameterNodes = definedTstsNodes(getTstsParameters(node));
  const parameters = convertParameters(parameterNodes, ctx);
  const bodyCtx = withParameterTypeEnv(ctx, parameterNodes, parameters);

  const statements: IrStatement[] = [];
  const bodyNode = getTstsBodyNode(node);
  if (bodyNode) {
    const existingBody = convertBlockStatement(bodyNode, bodyCtx, undefined);
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
