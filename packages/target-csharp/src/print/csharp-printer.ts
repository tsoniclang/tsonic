import type {
  CsharpArgument,
  CsharpCompilationUnit,
  CsharpExpression,
  CsharpForInitializer,
  CsharpLocalDeclaration,
  CsharpMethodDeclaration,
  CsharpStatement,
  CsharpConstructorDeclaration,
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
      const initializer = member.initializer === undefined ? "" : ` = ${printCsharpExpression(member.initializer)}`;
      return [`${modifiers}${printCsharpType(member.type)} ${member.name}${initializer};`];
    }
    case "constructor":
      return printConstructorLines(member);
    case "method":
      return printMethodLines(member);
  }
}

function printConstructorLines(constructor: CsharpConstructorDeclaration): string[] {
  const modifiers = constructor.modifiers.length === 0 ? "" : `${constructor.modifiers.join(" ")} `;
  const parameters = constructor.parameters.map((parameter) => {
    const passing = parameter.passing === undefined ? "" : `${parameter.passing} `;
    return `${passing}${printCsharpType(parameter.type)} ${parameter.name}`;
  }).join(", ");
  return [
    `${modifiers}${constructor.name}(${parameters})`,
    "{",
    ...indentLines(printCsharpStatements(constructor.body.statements)),
    "}",
  ];
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
    ...indentLines(printCsharpStatements(method.body.statements)),
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
    case "qualified": {
      const suffix = type.typeArguments === undefined || type.typeArguments.length === 0
        ? type.name
        : `${type.name}<${type.typeArguments.map(printCsharpType).join(", ")}>`;
      return `${printCsharpType(type.left)}.${suffix}`;
    }
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
      return `${printCsharpLocalDeclaration(statement)};`;
    case "block":
      return [
        "{",
        ...indentLines(printCsharpStatements(statement.body.statements)),
        "}",
      ].join("\n");
    case "if":
      return [
        `if (${printCsharpExpression(statement.condition)})`,
        "{",
        ...indentLines(printCsharpStatements(statement.thenBody.statements)),
        "}",
        ...(statement.elseBody === undefined
          ? []
          : [
              "else",
              "{",
              ...indentLines(printCsharpStatements(statement.elseBody.statements)),
              "}",
            ]),
      ].join("\n");
    case "while":
      return [
        `while (${printCsharpExpression(statement.condition)})`,
        "{",
        ...indentLines(printCsharpStatements(statement.body.statements)),
        "}",
      ].join("\n");
    case "do":
      return [
        "do",
        "{",
        ...indentLines(printCsharpStatements(statement.body.statements)),
        "}",
        `while (${printCsharpExpression(statement.condition)});`,
      ].join("\n");
    case "for":
      return [
        `for (${printCsharpForInitializer(statement.initializer)}; ${statement.condition === undefined ? "" : printCsharpExpression(statement.condition)}; ${statement.incrementor === undefined ? "" : printCsharpExpression(statement.incrementor)})`,
        "{",
        ...indentLines(printCsharpStatements(statement.body.statements)),
        "}",
      ].join("\n");
  }
}

function printCsharpStatements(statements: readonly CsharpStatement[]): string[] {
  return statements.flatMap((statement) => printCsharpStatement(statement).split("\n"));
}

export function printCsharpExpression(expression: CsharpExpression): string {
  switch (expression.kind) {
    case "identifier":
      return expression.name;
    case "literal":
      return printLiteral(expression.value);
    case "parenthesized":
      return `(${printCsharpExpression(expression.expression)})`;
    case "member":
      return `${printCsharpExpression(expression.receiver)}.${expression.name}`;
    case "element":
      return `${printCsharpExpression(expression.receiver)}[${printCsharpExpression(expression.argument)}]`;
    case "call":
      return `${printCsharpExpression(expression.callee)}(${expression.arguments.map(printCsharpArgument).join(", ")})`;
    case "new":
      return `new ${printCsharpType(expression.type)}(${expression.arguments.map(printCsharpArgument).join(", ")})`;
    case "binary":
      return `${printCsharpExpression(expression.left)} ${expression.operator} ${printCsharpExpression(expression.right)}`;
    case "prefixUnary":
      return `${expression.operator}${printCsharpExpression(expression.operand)}`;
    case "postfixUnary":
      return `${printCsharpExpression(expression.operand)}${expression.operator}`;
    case "conditional":
      return `${printCsharpExpression(expression.condition)} ? ${printCsharpExpression(expression.whenTrue)} : ${printCsharpExpression(expression.whenFalse)}`;
    case "array":
      return `new[] { ${expression.elements.map(printCsharpExpression).join(", ")} }`;
  }
}

function printCsharpLocalDeclaration(local: CsharpLocalDeclaration): string {
  return local.initializer === undefined
    ? `${printCsharpType(local.type)} ${local.name}`
    : `${printCsharpType(local.type)} ${local.name} = ${printCsharpExpression(local.initializer)}`;
}

function printCsharpForInitializer(initializer: CsharpForInitializer | undefined): string {
  if (initializer === undefined) {
    return "";
  }
  switch (initializer.kind) {
    case "expression":
      return printCsharpExpression(initializer.expression);
    case "locals": {
      const first = initializer.locals[0];
      if (first === undefined) {
        return "";
      }
      return `${printCsharpType(first.type)} ${initializer.locals.map(printCsharpLocalDeclarator).join(", ")}`;
    }
  }
}

function printCsharpLocalDeclarator(local: CsharpLocalDeclaration): string {
  return local.initializer === undefined
    ? local.name
    : `${local.name} = ${printCsharpExpression(local.initializer)}`;
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
