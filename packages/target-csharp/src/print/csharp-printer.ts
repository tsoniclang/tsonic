import type {
  CsharpArgument,
  CsharpCompilationUnit,
  CsharpExpression,
  CsharpStatement,
  CsharpTypeNode,
} from "../backend/ast/csharp-ast.js";

export function printCsharpCompilationUnit(unit: CsharpCompilationUnit): string {
  const lines: string[] = [];
  for (const using of unit.usings) {
    lines.push(`using ${using.namespace};`);
  }
  if (unit.usings.length > 0 && unit.members.length > 0) {
    lines.push("");
  }
  for (const member of unit.members) {
    switch (member.kind) {
      case "namespace":
        lines.push(`namespace ${member.name};`);
        break;
      case "class":
      case "struct":
        lines.push(`${member.modifiers.join(" ")} ${member.kind} ${member.name}`);
        lines.push("{");
        lines.push("}");
        break;
    }
  }
  return `${lines.join("\n")}\n`;
}

export function printCsharpType(type: CsharpTypeNode): string {
  switch (type.kind) {
    case "predefined":
      return type.name;
    case "named":
      return type.typeArguments === undefined || type.typeArguments.length === 0
        ? type.name
        : `${type.name}<${type.typeArguments.map(printCsharpType).join(", ")}>`;
    case "array":
      return `${printCsharpType(type.elementType)}[]`;
  }
}

export function printCsharpStatement(statement: CsharpStatement): string {
  switch (statement.kind) {
    case "return":
      return statement.expression === undefined ? "return;" : `return ${printCsharpExpression(statement.expression)};`;
    case "expression":
      return `${printCsharpExpression(statement.expression)};`;
    case "local":
      return statement.initializer === undefined
        ? `${printCsharpType(statement.type)} ${statement.name};`
        : `${printCsharpType(statement.type)} ${statement.name} = ${printCsharpExpression(statement.initializer)};`;
  }
}

export function printCsharpExpression(expression: CsharpExpression): string {
  switch (expression.kind) {
    case "identifier":
      return expression.name;
    case "literal":
      return printLiteral(expression.value);
    case "member":
      return `${printCsharpExpression(expression.receiver)}.${expression.name}`;
    case "call":
      return `${printCsharpExpression(expression.callee)}(${expression.arguments.map(printCsharpArgument).join(", ")})`;
  }
}

function printCsharpArgument(argument: CsharpArgument): string {
  const expression = printCsharpExpression(argument.expression);
  return argument.passing === undefined ? expression : `${argument.passing} ${expression}`;
}

function printLiteral(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}
