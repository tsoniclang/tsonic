import {
  stableIrTypeKeyIfDeterministic,
  type IrBlockStatement,
  type IrStatement,
  type IrType,
} from "../../../types.js";

const VOID_RETURN_TYPE: IrType = { kind: "voidType" };

const collectReturnTypesFromStatement = (
  statement: IrStatement,
  returnTypes: IrType[]
): void => {
  switch (statement.kind) {
    case "returnStatement":
      if (statement.expression && !statement.expression.inferredType) {
        returnTypes.push({ kind: "unknownType" });
        return;
      }
      returnTypes.push(statement.expression?.inferredType ?? VOID_RETURN_TYPE);
      return;
    case "blockStatement":
      collectReturnTypesFromBlock(statement, returnTypes);
      return;
    case "ifStatement":
      collectReturnTypesFromStatement(statement.thenStatement, returnTypes);
      if (statement.elseStatement) {
        collectReturnTypesFromStatement(statement.elseStatement, returnTypes);
      }
      return;
    case "switchStatement":
      for (const switchCase of statement.cases) {
        for (const nestedStatement of switchCase.statements) {
          collectReturnTypesFromStatement(nestedStatement, returnTypes);
        }
      }
      return;
    case "tryStatement":
      collectReturnTypesFromBlock(statement.tryBlock, returnTypes);
      if (statement.catchClause) {
        collectReturnTypesFromBlock(statement.catchClause.body, returnTypes);
      }
      if (statement.finallyBlock) {
        collectReturnTypesFromBlock(statement.finallyBlock, returnTypes);
      }
      return;
    case "forStatement":
    case "forOfStatement":
    case "forInStatement":
    case "whileStatement":
      collectReturnTypesFromStatement(statement.body, returnTypes);
      return;
    default:
      return;
  }
};

const collectReturnTypesFromBlock = (
  block: IrBlockStatement,
  returnTypes: IrType[]
): void => {
  for (const statement of block.statements) {
    collectReturnTypesFromStatement(statement, returnTypes);
  }
};

export const inferDeterministicBlockReturnType = (
  block: IrBlockStatement
): IrType | undefined => {
  const returnTypes: IrType[] = [];
  collectReturnTypesFromBlock(block, returnTypes);
  if (returnTypes.length === 0) {
    return undefined;
  }

  const byKey = new Map<string, IrType>();
  for (const returnType of returnTypes) {
    if (returnType.kind === "unknownType" || returnType.kind === "anyType") {
      return undefined;
    }
    const key = stableIrTypeKeyIfDeterministic(returnType);
    if (!key) {
      return undefined;
    }
    byKey.set(key, returnType);
  }

  return byKey.size === 1 ? Array.from(byKey.values())[0] : undefined;
};
