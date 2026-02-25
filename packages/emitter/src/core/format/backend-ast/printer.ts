/**
 * Deterministic printer for C# backend AST.
 */

import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassDeclarationAst,
  CSharpClassMemberAst,
  CSharpCompilationUnitAst,
  CSharpEnumDeclarationAst,
  CSharpExpressionAst,
  CSharpInterfaceDeclarationAst,
  CSharpInterfaceMemberAst,
  CSharpNamespaceMemberAst,
  CSharpStatementAst,
  CSharpStructDeclarationAst,
  CSharpSwitchLabelAst,
  CSharpTypeAst,
  CSharpTypeDeclarationAst,
} from "./types.js";

const indentPrefix = (level: number): string => "    ".repeat(level);

const CSHARP_PREDEFINED_TYPE_KEYWORDS: ReadonlySet<string> = new Set([
  "bool",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "char",
  "float",
  "double",
  "decimal",
  "string",
  "object",
  "void",
]);

const escapeIdentifierToken = (
  token: string,
  options?: { readonly preservePredefinedTypeKeywords?: boolean }
): string => {
  if (token.length === 0 || token.startsWith("@")) {
    return token;
  }
  if (
    options?.preservePredefinedTypeKeywords === true &&
    CSHARP_PREDEFINED_TYPE_KEYWORDS.has(token)
  ) {
    return token;
  }
  return escapeCSharpIdentifier(token);
};

const escapeQualifiedIdentifier = (
  qualifiedName: string,
  options?: { readonly preservePredefinedTypeKeywords?: boolean }
): string =>
  (() => {
    let token = "";
    const parts: string[] = [];
    let index = 0;
    while (index < qualifiedName.length) {
      const ch = qualifiedName[index];
      const next = qualifiedName[index + 1];
      if (ch === ".") {
        parts.push(escapeIdentifierToken(token, options), ".");
        token = "";
        index++;
        continue;
      }
      if (ch === ":" && next === ":") {
        parts.push(escapeIdentifierToken(token, options), "::");
        token = "";
        index += 2;
        continue;
      }
      token += ch;
      index++;
    }
    parts.push(escapeIdentifierToken(token, options));
    return parts.join("");
  })();

const isStatementNode = (
  node: CSharpExpressionAst | CSharpStatementAst
): node is CSharpStatementAst => {
  switch (node.kind) {
    case "blockStatement":
    case "localDeclarationStatement":
    case "localFunctionStatement":
    case "expressionStatement":
    case "ifStatement":
    case "whileStatement":
    case "forStatement":
    case "foreachStatement":
    case "switchStatement":
    case "tryStatement":
    case "throwStatement":
    case "returnStatement":
    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
    case "yieldReturnStatement":
    case "yieldBreakStatement":
      return true;
    default:
      return false;
  }
};

export const printType = (type: CSharpTypeAst): string => {
  switch (type.kind) {
    case "rawType":
      return type.text;
    case "predefinedType":
      return type.keyword;
    case "identifierType":
      return type.typeArguments && type.typeArguments.length > 0
        ? `${escapeQualifiedIdentifier(type.name, {
            preservePredefinedTypeKeywords: true,
          })}<${type.typeArguments.map(printType).join(", ")}>`
        : escapeQualifiedIdentifier(type.name, {
            preservePredefinedTypeKeywords: true,
          });
    case "arrayType":
      return `${printType(type.elementType)}[${",".repeat(
        Math.max(0, type.rank - 1)
      )}]`;
    case "nullableType":
      return `${printType(type.underlyingType)}?`;
  }

  const _exhaustive: never = type;
  throw new Error(
    `ICE: Unhandled type AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

export const printExpression = (expression: CSharpExpressionAst): string => {
  switch (expression.kind) {
    case "rawExpression":
      return expression.text;
    case "literalExpression":
      return expression.text;
    case "identifierExpression":
      return expression.identifier;
    case "parenthesizedExpression":
      return `(${printExpression(expression.expression)})`;
    case "memberAccessExpression":
      return `${printExpression(expression.expression)}.${expression.memberName}`;
    case "invocationExpression":
      return `${printExpression(expression.expression)}(${expression.arguments
        .map(printExpression)
        .join(", ")})`;
    case "objectCreationExpression":
      return `new ${printType(expression.type)}(${expression.arguments
        .map(printExpression)
        .join(", ")})${
        expression.initializer && expression.initializer.length > 0
          ? ` { ${expression.initializer.map(printExpression).join(", ")} }`
          : ""
      }`;
    case "arrayCreationExpression":
      return `new ${printType(expression.elementType)}[${expression.rankSpecifiers
        .map(printExpression)
        .join(", ")}]${
        expression.initializer && expression.initializer.length > 0
          ? ` { ${expression.initializer.map(printExpression).join(", ")} }`
          : ""
      }`;
    case "assignmentExpression":
      return `${printExpression(expression.left)} ${expression.operatorToken} ${printExpression(expression.right)}`;
    case "binaryExpression":
      return `${printExpression(expression.left)} ${expression.operatorToken} ${printExpression(expression.right)}`;
    case "unaryExpression":
      return expression.prefix
        ? `${expression.operatorToken}${printExpression(expression.operand)}`
        : `${printExpression(expression.operand)}${expression.operatorToken}`;
    case "conditionalExpression":
      return `${printExpression(expression.condition)} ? ${printExpression(
        expression.whenTrue
      )} : ${printExpression(expression.whenFalse)}`;
    case "castExpression":
      return `(${printType(expression.type)})${printExpression(expression.expression)}`;
    case "awaitExpression":
      return `await ${printExpression(expression.expression)}`;
    case "lambdaExpression": {
      const parameters = expression.parameters.join(", ");
      const prefix = expression.asyncModifier ? "async " : "";
      const body = isStatementNode(expression.body)
        ? `\n${printStatement(expression.body, 0)}`
        : printExpression(expression.body);
      return `${prefix}(${parameters}) => ${body}`;
    }
  }

  const _exhaustive: never = expression;
  throw new Error(
    `ICE: Unhandled expression AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const printAccessor = (
  accessor: CSharpAccessorDeclarationAst,
  level: number
): string => {
  if (!accessor.body) {
    return `${indentPrefix(level)}${accessor.accessorKind};`;
  }
  return [
    `${indentPrefix(level)}${accessor.accessorKind}`,
    printStatement(accessor.body, level),
  ].join("\n");
};

const printTypeHeader = (
  name: string,
  options: {
    readonly modifiers: readonly string[];
    readonly typeKeyword: string;
    readonly typeParameters?: readonly string[];
    readonly baseTypes?: readonly string[];
  }
): string => {
  const typeName =
    options.typeParameters && options.typeParameters.length > 0
      ? `${name}<${options.typeParameters.join(", ")}>`
      : name;
  const baseList =
    options.baseTypes && options.baseTypes.length > 0
      ? ` : ${options.baseTypes.join(", ")}`
      : "";
  return [...options.modifiers, options.typeKeyword, `${typeName}${baseList}`]
    .filter((part) => part.length > 0)
    .join(" ");
};

const printFieldMember = (
  member: Extract<CSharpClassMemberAst, { kind: "fieldDeclaration" }>,
  level: number
): string => {
  const lines = [
    ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
    `${indentPrefix(level)}${[
      ...member.modifiers,
      printType(member.type),
      member.name,
    ].join(" ")}${
      member.initializer ? ` = ${printExpression(member.initializer)}` : ""
    };`,
  ];
  return lines.join("\n");
};

const printDelegateMember = (
  member: Extract<CSharpClassMemberAst, { kind: "delegateDeclaration" }>,
  level: number
): string => {
  const typeParameters =
    member.typeParameters && member.typeParameters.length > 0
      ? `<${member.typeParameters.join(", ")}>`
      : "";
  const parameters = member.parameters
    .map((p) =>
      [
        ...p.attributes,
        ...p.modifiers,
        printType(p.type),
        p.name,
        p.defaultValue ? `= ${printExpression(p.defaultValue)}` : "",
      ]
        .filter((part) => part.length > 0)
        .join(" ")
    )
    .join(", ");
  const signature = `${indentPrefix(level)}${[
    ...member.modifiers,
    "delegate",
    printType(member.returnType),
    `${member.name}${typeParameters}(${parameters})`,
  ].join(" ")}`;
  const lines = [
    ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
    signature,
    ...(member.whereClauses ?? []).map(
      (clause) => `${indentPrefix(level + 1)}${clause}`
    ),
  ];
  const printed = lines.join("\n");
  return `${printed};`;
};

const printPropertyMember = (
  member: Extract<CSharpClassMemberAst, { kind: "propertyDeclaration" }>,
  level: number
): string => {
  const canPrintInlineAutoProperty =
    !member.initializer &&
    member.accessorList.every((accessor) => !accessor.body);

  if (canPrintInlineAutoProperty) {
    const accessorText = member.accessorList
      .map((accessor) => `${accessor.accessorKind};`)
      .join(" ");
    const lines = [
      ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
      `${indentPrefix(level)}${[
        ...member.modifiers,
        printType(member.type),
        member.name,
      ].join(" ")} { ${accessorText} }`,
    ];
    return lines.join("\n");
  }

  const lines = [
    ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
    `${indentPrefix(level)}${[
      ...member.modifiers,
      printType(member.type),
      member.name,
    ].join(" ")}`,
    `${indentPrefix(level)}{`,
    ...member.accessorList.map((a) => printAccessor(a, level + 1)),
    `${indentPrefix(level)}}${
      member.initializer ? ` = ${printExpression(member.initializer)};` : ""
    }`,
  ];
  return lines.join("\n");
};

const printMethodMember = (
  member: Extract<CSharpClassMemberAst, { kind: "methodDeclaration" }>,
  level: number
): string => {
  const typeParameters =
    member.typeParameters && member.typeParameters.length > 0
      ? `<${member.typeParameters.join(", ")}>`
      : "";
  const parameters = member.parameters
    .map((p) =>
      [
        ...p.attributes,
        ...p.modifiers,
        printType(p.type),
        p.name,
        p.defaultValue ? `= ${printExpression(p.defaultValue)}` : "",
      ]
        .filter((part) => part.length > 0)
        .join(" ")
    )
    .join(", ");
  const signatureLines = [
    ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
    `${indentPrefix(level)}${[
      ...member.modifiers,
      printType(member.returnType),
      `${member.name}${typeParameters}(${parameters})`,
    ].join(" ")}`,
    ...(member.whereClauses ?? []).map(
      (clause) => `${indentPrefix(level + 1)}${clause}`
    ),
  ];
  if (!member.body) {
    const signature = signatureLines.join("\n");
    return `${signature};`;
  }
  return [...signatureLines, printStatement(member.body, level)].join("\n");
};

const printConstructorMember = (
  member: Extract<CSharpClassMemberAst, { kind: "constructorDeclaration" }>,
  level: number
): string => {
  const signature = `${indentPrefix(level)}${[
    ...member.modifiers,
    member.name,
  ].join(" ")}(${member.parameters
    .map((p) =>
      [
        ...p.attributes,
        ...p.modifiers,
        printType(p.type),
        p.name,
        p.defaultValue ? `= ${printExpression(p.defaultValue)}` : "",
      ]
        .filter((part) => part.length > 0)
        .join(" ")
    )
    .join(", ")})${
    member.initializer
      ? ` : ${member.initializer.initializerKind}(${member.initializer.arguments
          .map(printExpression)
          .join(", ")})`
      : ""
  }`;

  const lines = [
    ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
    signature,
    printStatement(member.body, level),
  ];
  return lines.join("\n");
};

const printClassMember = (
  member: CSharpClassMemberAst,
  level: number
): string => {
  switch (member.kind) {
    case "blankLine":
      return "";
    case "commentMember":
      return `${indentPrefix(level)}${member.text}`;
    case "delegateDeclaration":
      return printDelegateMember(member, level);
    case "fieldDeclaration":
      return printFieldMember(member, level);
    case "propertyDeclaration":
      return printPropertyMember(member, level);
    case "methodDeclaration":
      return printMethodMember(member, level);
    case "constructorDeclaration":
      return printConstructorMember(member, level);
    case "classDeclaration":
    case "interfaceDeclaration":
    case "structDeclaration":
    case "enumDeclaration":
      return printTypeDeclaration(member, level);
  }

  const _exhaustive: never = member;
  throw new Error(
    `ICE: Unhandled class member AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const printInterfaceMember = (
  member: CSharpInterfaceMemberAst,
  level: number
): string => {
  switch (member.kind) {
    case "blankLine":
      return "";
    case "commentMember":
      return `${indentPrefix(level)}${member.text}`;
    case "propertyDeclaration":
      return printPropertyMember(member, level);
    case "methodSignature": {
      const typeParameters =
        member.typeParameters && member.typeParameters.length > 0
          ? `<${member.typeParameters.join(", ")}>`
          : "";
      const parameters = member.parameters
        .map((p) =>
          [
            ...p.attributes,
            ...p.modifiers,
            printType(p.type),
            p.name,
            p.defaultValue ? `= ${printExpression(p.defaultValue)}` : "",
          ]
            .filter((part) => part.length > 0)
            .join(" ")
        )
        .join(", ");
      const lines = [
        ...member.attributes.map((a) => `${indentPrefix(level)}${a}`),
        `${indentPrefix(level)}${printType(member.returnType)} ${member.name}${typeParameters}(${parameters})`,
        ...(member.whereClauses ?? []).map(
          (clause) => `${indentPrefix(level + 1)}${clause}`
        ),
      ];
      const signature = lines.join("\n");
      return `${signature};`;
    }
  }

  const _exhaustive: never = member;
  throw new Error(
    `ICE: Unhandled interface member AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const printClassDeclaration = (
  declaration: CSharpClassDeclarationAst,
  level: number
): string => {
  const indentLevel = declaration.indentLevel ?? level;
  const lines = [
    ...declaration.attributes.map((a) => `${indentPrefix(indentLevel)}${a}`),
    `${indentPrefix(indentLevel)}${printTypeHeader(declaration.name, {
      modifiers: declaration.modifiers,
      typeKeyword: "class",
      typeParameters: declaration.typeParameters,
      baseTypes: declaration.baseTypes,
    })}`,
    ...(declaration.whereClauses ?? []).map(
      (c) => `${indentPrefix(indentLevel + 1)}${c}`
    ),
    `${indentPrefix(indentLevel)}{`,
    ...declaration.members.map((m) => printClassMember(m, indentLevel + 1)),
    `${indentPrefix(indentLevel)}}`,
  ];
  return lines.join("\n");
};

const printStructDeclaration = (
  declaration: CSharpStructDeclarationAst,
  level: number
): string => {
  const indentLevel = declaration.indentLevel ?? level;
  const lines = [
    ...declaration.attributes.map((a) => `${indentPrefix(indentLevel)}${a}`),
    `${indentPrefix(indentLevel)}${printTypeHeader(declaration.name, {
      modifiers: declaration.modifiers,
      typeKeyword: "struct",
      typeParameters: declaration.typeParameters,
      baseTypes: declaration.baseTypes,
    })}`,
    ...(declaration.whereClauses ?? []).map(
      (c) => `${indentPrefix(indentLevel + 1)}${c}`
    ),
    `${indentPrefix(indentLevel)}{`,
    ...declaration.members.map((m) => printClassMember(m, indentLevel + 1)),
    `${indentPrefix(indentLevel)}}`,
  ];
  return lines.join("\n");
};

const printInterfaceDeclaration = (
  declaration: CSharpInterfaceDeclarationAst,
  level: number
): string => {
  const indentLevel = declaration.indentLevel ?? level;
  const lines = [
    ...declaration.attributes.map((a) => `${indentPrefix(indentLevel)}${a}`),
    `${indentPrefix(indentLevel)}${printTypeHeader(declaration.name, {
      modifiers: declaration.modifiers,
      typeKeyword: "interface",
      typeParameters: declaration.typeParameters,
      baseTypes: declaration.baseTypes,
    })}`,
    ...(declaration.whereClauses ?? []).map(
      (c) => `${indentPrefix(indentLevel + 1)}${c}`
    ),
    `${indentPrefix(indentLevel)}{`,
    ...declaration.members.map((m) => printInterfaceMember(m, indentLevel + 1)),
    `${indentPrefix(indentLevel)}}`,
  ];
  return lines.join("\n");
};

const printEnumDeclaration = (
  declaration: CSharpEnumDeclarationAst,
  level: number
): string => {
  const indentLevel = declaration.indentLevel ?? level;
  const lines = [
    ...declaration.attributes.map((a) => `${indentPrefix(indentLevel)}${a}`),
    `${indentPrefix(indentLevel)}${[
      ...declaration.modifiers,
      "enum",
      declaration.name,
    ].join(" ")}`,
    `${indentPrefix(indentLevel)}{`,
    ...declaration.members.map((m, index) => {
      const suffix = index < declaration.members.length - 1 ? "," : "";
      return `${indentPrefix(indentLevel + 1)}${m.name}${
        m.initializer ? ` = ${printExpression(m.initializer)}` : ""
      }${suffix}`;
    }),
    `${indentPrefix(indentLevel)}}`,
  ];
  return lines.join("\n");
};

const printTypeDeclaration = (
  declaration: CSharpTypeDeclarationAst,
  level: number
): string => {
  switch (declaration.kind) {
    case "classDeclaration":
      return printClassDeclaration(declaration, level);
    case "structDeclaration":
      return printStructDeclaration(declaration, level);
    case "interfaceDeclaration":
      return printInterfaceDeclaration(declaration, level);
    case "enumDeclaration":
      return printEnumDeclaration(declaration, level);
  }

  const _exhaustive: never = declaration;
  throw new Error(
    `ICE: Unhandled type declaration AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const printSwitchLabel = (label: CSharpSwitchLabelAst): string => {
  switch (label.kind) {
    case "caseSwitchLabel":
      return `case ${printExpression(label.value)}:`;
    case "defaultSwitchLabel":
      return "default:";
  }
};

export const printStatement = (
  statement: CSharpStatementAst,
  level: number
): string => {
  const ind = indentPrefix(level);

  const printEmbeddedStatement = (
    embedded: CSharpStatementAst,
    parentLevel: number
  ): string =>
    printStatement(
      embedded,
      embedded.kind === "blockStatement" ? parentLevel : parentLevel + 1
    );

  switch (statement.kind) {
    case "blockStatement":
      return [
        `${ind}{`,
        ...statement.statements.map((s) => printStatement(s, level + 1)),
        `${ind}}`,
      ].join("\n");
    case "localDeclarationStatement":
      return `${ind}${[
        ...statement.modifiers,
        printType(statement.type),
        statement.declarators
          .map((d) =>
            d.initializer
              ? `${d.name} = ${printExpression(d.initializer)}`
              : d.name
          )
          .join(", "),
      ].join(" ")};`;
    case "localFunctionStatement": {
      const typeParameters =
        statement.typeParameters && statement.typeParameters.length > 0
          ? `<${statement.typeParameters.join(", ")}>`
          : "";
      const parameters = statement.parameters
        .map((parameter) =>
          [
            ...parameter.attributes,
            ...parameter.modifiers,
            printType(parameter.type),
            parameter.name,
            parameter.defaultValue
              ? `= ${printExpression(parameter.defaultValue)}`
              : "",
          ]
            .filter((part) => part.length > 0)
            .join(" ")
        )
        .join(", ");
      return [
        `${ind}${[
          ...statement.modifiers,
          printType(statement.returnType),
          `${statement.name}${typeParameters}(${parameters})`,
        ].join(" ")}`,
        ...(statement.whereClauses ?? []).map(
          (clause) => `${indentPrefix(level + 1)}${clause}`
        ),
        printStatement(statement.body, level),
      ].join("\n");
    }
    case "expressionStatement":
      return `${ind}${printExpression(statement.expression)};`;
    case "ifStatement":
      return [
        `${ind}if (${printExpression(statement.condition)})`,
        printEmbeddedStatement(statement.thenStatement, level),
        ...(statement.elseStatement
          ? [
              `${ind}else`,
              printStatement(
                statement.elseStatement,
                statement.elseStatement.kind === "ifStatement" ||
                  statement.elseStatement.kind === "blockStatement"
                  ? level
                  : level + 1
              ),
            ]
          : []),
      ].join("\n");
    case "whileStatement":
      return [
        `${ind}while (${printExpression(statement.condition)})`,
        printEmbeddedStatement(statement.statement, level),
      ].join("\n");
    case "forStatement":
      return [
        `${ind}for (${
          statement.initializer
            ? printStatement(statement.initializer, 0).replace(/;$/, "")
            : ""
        }; ${statement.condition ? printExpression(statement.condition) : ""}; ${
          statement.iterator
            ? statement.iterator.map(printExpression).join(", ")
            : ""
        })`,
        printEmbeddedStatement(statement.statement, level),
      ].join("\n");
    case "foreachStatement":
      return [
        `${ind}${statement.awaitModifier ? "await " : ""}foreach (${printType(
          statement.type
        )} ${statement.identifier} in ${printExpression(statement.expression)})`,
        printEmbeddedStatement(statement.statement, level),
      ].join("\n");
    case "switchStatement":
      return [
        `${ind}switch (${printExpression(statement.expression)})`,
        `${ind}{`,
        ...statement.sections.flatMap((section) => [
          ...section.labels.map(
            (l) => `${indentPrefix(level + 1)}${printSwitchLabel(l)}`
          ),
          ...section.statements.map((s) => printStatement(s, level + 2)),
        ]),
        `${ind}}`,
      ].join("\n");
    case "tryStatement":
      return [
        `${ind}try`,
        printStatement(statement.block, level),
        ...statement.catches.map((c) =>
          [
            `${ind}catch${
              c.declarationType
                ? ` (${printType(c.declarationType)}${
                    c.declarationIdentifier ? ` ${c.declarationIdentifier}` : ""
                  })`
                : ""
            }`,
            printStatement(c.block, level),
          ].join("\n")
        ),
        ...(statement.finallyBlock
          ? [`${ind}finally`, printStatement(statement.finallyBlock, level)]
          : []),
      ].join("\n");
    case "throwStatement":
      return `${ind}throw${
        statement.expression ? ` ${printExpression(statement.expression)}` : ""
      };`;
    case "returnStatement":
      return `${ind}return${
        statement.expression ? ` ${printExpression(statement.expression)}` : ""
      };`;
    case "breakStatement":
      return `${ind}break;`;
    case "continueStatement":
      return `${ind}continue;`;
    case "emptyStatement":
      return `${ind};`;
    case "yieldReturnStatement":
      return `${ind}yield return ${printExpression(statement.expression)};`;
    case "yieldBreakStatement":
      return `${ind}yield break;`;
  }

  const _exhaustive: never = statement;
  throw new Error(
    `ICE: Unhandled statement AST kind in printer: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const printNamespaceMember = (
  member: CSharpNamespaceMemberAst,
  level: number
): string => {
  switch (member.kind) {
    case "blankLine":
      return "";
    case "commentMember":
      return `${indentPrefix(level)}${member.text}`;
    case "classDeclaration":
    case "interfaceDeclaration":
    case "structDeclaration":
    case "enumDeclaration":
      return printTypeDeclaration(member, level);
    case "globalMethodDeclaration":
      return [
        ...member.attributes.map(
          (a) => `${indentPrefix(member.indentLevel)}${a}`
        ),
        `${indentPrefix(member.indentLevel)}${[
          ...member.modifiers,
          printType(member.returnType),
          member.name,
        ].join(" ")}(${member.parameters
          .map((p) =>
            [
              ...p.attributes,
              ...p.modifiers,
              printType(p.type),
              p.name,
              p.defaultValue ? `= ${printExpression(p.defaultValue)}` : "",
            ]
              .filter((part) => part.length > 0)
              .join(" ")
          )
          .join(", ")})`,
        printStatement(member.body, member.indentLevel),
      ].join("\n");
  }
};

export const printCompilationUnitAst = (
  unit: CSharpCompilationUnitAst
): string => {
  const headerLines = unit.headerText ? [unit.headerText] : [];
  const usingLines =
    unit.usingDirectives.length > 0
      ? [
          ...unit.usingDirectives
            .map((d) => d.namespace)
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map(
              (namespace) => `using ${escapeQualifiedIdentifier(namespace)};`
            ),
          "",
        ]
      : [];
  const namespaceLines = [
    `namespace ${escapeQualifiedIdentifier(unit.namespace.name)}`,
    "{",
    ...unit.namespace.members.map((member) => printNamespaceMember(member, 1)),
    "}",
  ];

  return [...headerLines, ...usingLines, ...namespaceLines].join("\n");
};
