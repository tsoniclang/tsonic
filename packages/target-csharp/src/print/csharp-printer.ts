import type {
  CsharpArgument,
  CsharpCompilationUnit,
  CsharpExpression,
  CsharpMethodDeclaration,
  CsharpStatement,
  CsharpTypeDeclaration,
  CsharpTypeMember,
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
        lines.push(`namespace ${member.name}`);
        lines.push("{");
        lines.push(...indentLines(member.members.flatMap((declaration) => printTypeDeclarationLines(declaration))));
        lines.push("}");
        break;
      case "class":
      case "struct":
        lines.push(...printTypeDeclarationLines(member));
        break;
    }
  }
  return `${lines.join("\n")}\n`;
}

function printTypeDeclarationLines(declaration: CsharpTypeDeclaration): string[] {
  const modifiers = declaration.modifiers.length === 0 ? "" : `${declaration.modifiers.join(" ")} `;
  return [
    `${modifiers}${declaration.kind} ${declaration.name}`,
    "{",
    ...indentLines(declaration.members.flatMap(printTypeMemberLines)),
    "}",
  ];
}

function printTypeMemberLines(member: CsharpTypeMember): string[] {
  switch (member.kind) {
    case "field": {
      const modifiers = member.modifiers.length === 0 ? "" : `${member.modifiers.join(" ")} `;
      return [`${modifiers}${printCsharpType(member.type)} ${member.name};`];
    }
    case "method":
      return printMethodLines(member);
  }
}

function printMethodLines(method: CsharpMethodDeclaration): string[] {
  const modifiers = method.modifiers.length === 0 ? "" : `${method.modifiers.join(" ")} `;
  const parameters = method.parameters.map((parameter) => {
    const passing = parameter.passing === undefined ? "" : `${parameter.passing} `;
    return `${passing}${printCsharpType(parameter.type)} ${parameter.name}`;
  }).join(", ");
  return [
    `${modifiers}${printCsharpType(method.returnType)} ${method.name}(${parameters})`,
    "{",
    ...indentLines(method.body.statements.map(printCsharpStatement)),
    "}",
  ];
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
    case "binary":
      return `${printCsharpExpression(expression.left)} ${expression.operator} ${printCsharpExpression(expression.right)}`;
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

function indentLines(lines: readonly string[]): string[] {
  return lines.map((line) => line.length === 0 ? line : `    ${line}`);
}
