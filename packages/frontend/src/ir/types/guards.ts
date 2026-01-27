/**
 * Type guard helper functions
 */

import { IrStatement } from "./statements.js";
import { IrExpression } from "./expressions.js";

export const isStatement = (
  node: IrStatement | IrExpression
): node is IrStatement => {
  const statementKinds: string[] = [
    "variableDeclaration",
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "enumDeclaration",
    "typeAliasDeclaration",
    "expressionStatement",
    "returnStatement",
    "ifStatement",
    "whileStatement",
    "forStatement",
    "forOfStatement",
    "forInStatement",
    "switchStatement",
    "throwStatement",
    "tryStatement",
    "blockStatement",
    "breakStatement",
    "continueStatement",
    "emptyStatement",
    "yieldStatement",
    "generatorReturnStatement",
  ];
  return statementKinds.includes(node.kind);
};

export const isExpression = (
  node: IrStatement | IrExpression
): node is IrExpression => {
  return !isStatement(node);
};
