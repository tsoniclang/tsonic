import * as ts from "typescript";

const isNamedFunctionDeclaration = (
  statement: ts.Statement | undefined
): statement is ts.FunctionDeclaration & { name: ts.Identifier } =>
  !!statement && ts.isFunctionDeclaration(statement) && !!statement.name;

export const collectTopLevelFunctionOverloadGroup = (
  statements: readonly ts.Statement[],
  startIndex: number
): readonly ts.FunctionDeclaration[] | undefined => {
  const first = statements[startIndex];
  if (!isNamedFunctionDeclaration(first)) {
    return undefined;
  }

  const firstName = first.name.text;
  const group: ts.FunctionDeclaration[] = [first];
  for (let index = startIndex + 1; index < statements.length; index++) {
    const candidate = statements[index];
    if (
      !isNamedFunctionDeclaration(candidate) ||
      candidate.name.text !== firstName
    ) {
      break;
    }
    group.push(candidate);
  }

  return group.length > 1 ? group : undefined;
};
