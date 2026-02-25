/**
 * Backend AST Printer
 *
 * Converts typed C# AST nodes into deterministic C# source text.
 * Pure and stateless - no parsing, no string heuristics.
 *
 * Parenthesization is derived from operator precedence tables,
 * not from advisory metadata on fragments.
 */

import type {
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpPatternAst,
  CSharpParameterAst,
  CSharpSwitchExpressionArmAst,
  CSharpSwitchSectionAst,
  CSharpSwitchLabelAst,
  CSharpCatchClauseAst,
  CSharpInterpolatedStringPart,
  CSharpMemberAst,
  CSharpTypeDeclarationAst,
  CSharpTypeParameterAst,
  CSharpTypeParameterConstraintAst,
  CSharpAttributeAst,
  CSharpEnumMemberAst,
  CSharpCompilationUnitAst,
  CSharpNamespaceDeclarationAst,
  CSharpLambdaParameterAst,
} from "./types.js";

// ============================================================
// C# reserved keywords for identifier escaping
// ============================================================

const CSHARP_KEYWORDS = new Set([
  "abstract",
  "as",
  "bool",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "checked",
  "class",
  "const",
  "continue",
  "decimal",
  "default",
  "delegate",
  "do",
  "double",
  "else",
  "enum",
  "event",
  "explicit",
  "extern",
  "finally",
  "fixed",
  "float",
  "for",
  "foreach",
  "goto",
  "if",
  "implicit",
  "in",
  "int",
  "interface",
  "internal",
  "is",
  "lock",
  "long",
  "namespace",
  "new",
  "null",
  "object",
  "operator",
  "out",
  "override",
  "params",
  "private",
  "protected",
  "public",
  "readonly",
  "ref",
  "return",
  "sbyte",
  "sealed",
  "short",
  "sizeof",
  "stackalloc",
  "static",
  "string",
  "struct",
  "switch",
  "throw",
  "try",
  "typeof",
  "uint",
  "ulong",
  "unchecked",
  "unsafe",
  "ushort",
  "using",
  "virtual",
  "void",
  "volatile",
  "while",
]);

/**
 * C# predefined type keywords that should NOT be escaped with @
 * when used in type position (they are the type name itself).
 */
const PREDEFINED_TYPE_KEYWORDS = new Set([
  "bool",
  "byte",
  "char",
  "decimal",
  "double",
  "float",
  "int",
  "long",
  "object",
  "sbyte",
  "short",
  "string",
  "uint",
  "ulong",
  "ushort",
  "void",
  "nint",
  "nuint",
]);

/**
 * Escape a C# identifier if it's a keyword.
 * Preserves predefined type keywords when used as types.
 */
const escapeIdentifier = (name: string): string =>
  CSHARP_KEYWORDS.has(name) ? `@${name}` : name;

/**
 * Escape segments in a qualified name (e.g. "global::Foo.stackalloc.Bar").
 * The "global::" prefix and predefined type keywords are preserved.
 */
const escapeQualifiedName = (name: string): string => {
  const globalPrefix = "global::";
  const hasGlobal = name.startsWith(globalPrefix);
  const body = hasGlobal ? name.slice(globalPrefix.length) : name;

  const escaped = body
    .split(".")
    .map((segment) =>
      CSHARP_KEYWORDS.has(segment) && !PREDEFINED_TYPE_KEYWORDS.has(segment)
        ? `@${segment}`
        : segment
    )
    .join(".");

  return hasGlobal ? `${globalPrefix}${escaped}` : escaped;
};

// ============================================================
// Operator precedence for parenthesization
// ============================================================

/**
 * C# operator precedence levels (higher = binds tighter).
 * Used by the printer to insert parentheses only when necessary.
 */
const getOperatorPrecedence = (op: string): number => {
  switch (op) {
    // Assignment operators (lowest)
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "&=":
    case "|=":
    case "^=":
    case "<<=":
    case ">>=":
    case "??=":
      return 1;
    // Conditional ternary
    // (handled separately, not via this function)
    // Null-coalescing
    case "??":
      return 3;
    // Logical OR
    case "||":
      return 4;
    // Logical AND
    case "&&":
      return 5;
    // Bitwise OR
    case "|":
      return 6;
    // Bitwise XOR
    case "^":
      return 7;
    // Bitwise AND
    case "&":
      return 8;
    // Equality
    case "==":
    case "!=":
      return 9;
    // Relational (includes is, as - handled separately)
    case "<":
    case ">":
    case "<=":
    case ">=":
      return 10;
    // Shift
    case "<<":
    case ">>":
      return 11;
    // Additive
    case "+":
    case "-":
      return 12;
    // Multiplicative
    case "*":
    case "/":
    case "%":
      return 13;
    default:
      return 0;
  }
};

/**
 * Get the effective precedence of an expression for parenthesization decisions.
 */
const getExpressionPrecedence = (expr: CSharpExpressionAst): number => {
  switch (expr.kind) {
    case "assignmentExpression":
      return 1;
    case "conditionalExpression":
      return 2;
    case "binaryExpression":
      return getOperatorPrecedence(expr.operatorToken);
    case "isExpression":
    case "asExpression":
      return 10; // Relational level
    case "prefixUnaryExpression":
      return 14; // Unary prefix
    case "postfixUnaryExpression":
      return 15; // Unary postfix
    case "castExpression":
      return 14; // Cast is at unary level
    case "awaitExpression":
      return 14; // Await is at unary level
    // Primary expressions (highest precedence)
    case "literalExpression":
    case "identifierExpression":
    case "parenthesizedExpression":
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
    case "invocationExpression":
    case "objectCreationExpression":
    case "arrayCreationExpression":
    case "stackAllocArrayCreationExpression":
    case "defaultExpression":
    case "typeofExpression":
    case "interpolatedStringExpression":
    case "suppressNullableWarningExpression":
    case "switchExpression":
      return 16;
    case "lambdaExpression":
      return 0; // Lambda needs parens almost everywhere
    case "throwExpression":
      return 0; // Throw expression is very low precedence
    default:
      return 0;
  }
};

/**
 * Whether an expression needs parenthesization when used as an operand
 * of a binary expression with the given parent precedence.
 */
const needsParensInBinary = (
  child: CSharpExpressionAst,
  parentPrecedence: number,
  isRightOperand: boolean
): boolean => {
  const childPrec = getExpressionPrecedence(child);

  if (childPrec < parentPrecedence) return true;

  // For same-precedence, right-associative operators (assignment)
  // don't need parens on the right side
  if (childPrec === parentPrecedence && isRightOperand) {
    // Assignment is right-associative
    if (child.kind === "assignmentExpression") {
      return false;
    }
    // Left-associative (and ?? for readability): right operand at same precedence needs parens
    return true;
  }

  return false;
};

/**
 * Wrap expression text in parens if needed for the given context.
 */
const parenthesizeIfNeeded = (
  expr: CSharpExpressionAst,
  parentPrecedence: number,
  isRightOperand: boolean
): string => {
  const text = printExpression(expr);
  return needsParensInBinary(expr, parentPrecedence, isRightOperand)
    ? `(${text})`
    : text;
};

// ============================================================
// Type Printer
// ============================================================

export const printType = (type: CSharpTypeAst): string => {
  switch (type.kind) {
    case "predefinedType":
      return type.keyword;

    case "identifierType": {
      const name = escapeQualifiedName(type.name);
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return name;
      }
      const args = type.typeArguments.map(printType).join(", ");
      return `${name}<${args}>`;
    }

    case "nullableType":
      return `${printType(type.underlyingType)}?`;

    case "arrayType": {
      const elem = printType(type.elementType);
      if (type.rank === 1) {
        return `${elem}[]`;
      }
      const commas = ",".repeat(type.rank - 1);
      return `${elem}[${commas}]`;
    }

    case "pointerType":
      return `${printType(type.elementType)}*`;

    case "tupleType": {
      const elems = type.elements
        .map((e) =>
          e.name ? `${printType(e.type)} ${e.name}` : printType(e.type)
        )
        .join(", ");
      return `(${elems})`;
    }

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(
        `ICE: Unhandled type AST kind: ${(exhaustiveCheck as CSharpTypeAst).kind}`
      );
    }
  }
};

// ============================================================
// Expression Printer
// ============================================================

export const printExpression = (expr: CSharpExpressionAst): string => {
  switch (expr.kind) {
    case "literalExpression":
      return expr.text;

    case "identifierExpression":
      return escapeIdentifier(expr.identifier);

    case "parenthesizedExpression":
      return `(${printExpression(expr.expression)})`;

    case "memberAccessExpression":
      return `${printPrimaryExpression(expr.expression)}.${escapeIdentifier(expr.memberName)}`;

    case "conditionalMemberAccessExpression":
      return `${printPrimaryExpression(expr.expression)}?.${escapeIdentifier(expr.memberName)}`;

    case "elementAccessExpression": {
      const args = expr.arguments.map(printExpression).join(", ");
      return `${printPrimaryExpression(expr.expression)}[${args}]`;
    }

    case "conditionalElementAccessExpression": {
      const args = expr.arguments.map(printExpression).join(", ");
      return `${printPrimaryExpression(expr.expression)}?[${args}]`;
    }

    case "invocationExpression": {
      const callee = printPrimaryExpression(expr.expression);
      const typeArgs =
        expr.typeArguments && expr.typeArguments.length > 0
          ? `<${expr.typeArguments.map(printType).join(", ")}>`
          : "";
      const args = expr.arguments.map(printExpression).join(", ");
      return `${callee}${typeArgs}(${args})`;
    }

    case "objectCreationExpression": {
      const typeName = printType(expr.type);
      const args = expr.arguments.map(printExpression).join(", ");
      const init =
        expr.initializer && expr.initializer.length > 0
          ? ` { ${expr.initializer.map(printExpression).join(", ")} }`
          : "";
      return `new ${typeName}(${args})${init}`;
    }

    case "arrayCreationExpression": {
      const elemType = printType(expr.elementType);
      if (expr.initializer && expr.initializer.length > 0) {
        const elems = expr.initializer.map(printExpression).join(", ");
        if (expr.sizeExpression) {
          return `new ${elemType}[${printExpression(expr.sizeExpression)}] { ${elems} }`;
        }
        return `new ${elemType}[] { ${elems} }`;
      }
      if (expr.sizeExpression) {
        return `new ${elemType}[${printExpression(expr.sizeExpression)}]`;
      }
      return `new ${elemType}[0]`;
    }

    case "stackAllocArrayCreationExpression":
      return `stackalloc ${printType(expr.elementType)}[${printExpression(expr.sizeExpression)}]`;

    case "assignmentExpression": {
      const left = printExpression(expr.left);
      const right = printExpression(expr.right);
      return `${left} ${expr.operatorToken} ${right}`;
    }

    case "binaryExpression": {
      const prec = getOperatorPrecedence(expr.operatorToken);
      const left = parenthesizeIfNeeded(expr.left, prec, false);
      const right = parenthesizeIfNeeded(expr.right, prec, true);
      return `${left} ${expr.operatorToken} ${right}`;
    }

    case "prefixUnaryExpression": {
      const operand = printUnaryOperand(expr.operand, true);
      // Operators like ++ and -- need no space, but ! and - do if operand starts with same char
      if (
        (expr.operatorToken === "-" && operand.startsWith("-")) ||
        (expr.operatorToken === "+" && operand.startsWith("+"))
      ) {
        return `${expr.operatorToken} ${operand}`;
      }
      return `${expr.operatorToken}${operand}`;
    }

    case "postfixUnaryExpression":
      return `${printUnaryOperand(expr.operand, false)}${expr.operatorToken}`;

    case "conditionalExpression": {
      const cond = printExpression(expr.condition);
      const whenTrue = printExpression(expr.whenTrue);
      const whenFalse = printExpression(expr.whenFalse);
      return `${cond} ? ${whenTrue} : ${whenFalse}`;
    }

    case "castExpression": {
      const typeName = printType(expr.type);
      const operand = printCastOperand(expr.expression);
      return `(${typeName})${operand}`;
    }

    case "asExpression": {
      const inner = printExpression(expr.expression);
      return `${inner} as ${printType(expr.type)}`;
    }

    case "isExpression": {
      const inner = printExpression(expr.expression);
      const pattern = printPattern(expr.pattern);
      return `${inner} is ${pattern}`;
    }

    case "defaultExpression":
      return expr.type ? `default(${printType(expr.type)})` : "default";

    case "awaitExpression":
      return `await ${printUnaryOperand(expr.expression, true)}`;

    case "lambdaExpression":
      return printLambdaExpression(expr);

    case "interpolatedStringExpression":
      return printInterpolatedString(expr.parts);

    case "throwExpression":
      return `throw ${printExpression(expr.expression)}`;

    case "suppressNullableWarningExpression":
      return `${printPrimaryExpression(expr.expression)}!`;

    case "typeofExpression":
      return `typeof(${printType(expr.type)})`;

    case "switchExpression":
      return printSwitchExpression(expr);

    default: {
      const exhaustiveCheck: never = expr;
      throw new Error(
        `ICE: Unhandled expression AST kind: ${(exhaustiveCheck as CSharpExpressionAst).kind}`
      );
    }
  }
};

/**
 * Print an expression that appears in a "primary" position
 * (before `.member`, `[index]`, `(args)`, etc.).
 * Wraps in parens if needed.
 */
const printPrimaryExpression = (expr: CSharpExpressionAst): string => {
  const text = printExpression(expr);
  const prec = getExpressionPrecedence(expr);
  // Primary position requires precedence >= 15 (postfix and primary)
  // or the expression is already a parenthesized/literal/identifier
  if (prec >= 15) return text;
  if (
    expr.kind === "parenthesizedExpression" ||
    expr.kind === "literalExpression" ||
    expr.kind === "identifierExpression" ||
    expr.kind === "defaultExpression" ||
    expr.kind === "typeofExpression" ||
    expr.kind === "interpolatedStringExpression" ||
    expr.kind === "objectCreationExpression" ||
    expr.kind === "arrayCreationExpression"
  ) {
    return text;
  }
  return `(${text})`;
};

/**
 * Print an expression that appears as a unary operand.
 */
const printUnaryOperand = (
  expr: CSharpExpressionAst,
  isPrefix: boolean
): string => {
  const text = printExpression(expr);
  const prec = getExpressionPrecedence(expr);
  if (isPrefix) {
    // Prefix unary needs operand to be at least unary precedence
    return prec >= 14 ? text : `(${text})`;
  }
  // Postfix unary needs primary expression
  return prec >= 15 ? text : `(${text})`;
};

/**
 * Print an expression that appears as a cast operand.
 * Special rules: unary minus after cast needs parens to avoid ambiguity.
 */
const printCastOperand = (expr: CSharpExpressionAst): string => {
  const text = printExpression(expr);

  // Cast operand needs at least unary precedence
  if (getExpressionPrecedence(expr) < 14) {
    return `(${text})`;
  }

  // Special case: negative literals after cast need parens
  // (int)-1 is ambiguous: could be cast or subtraction
  if (expr.kind === "prefixUnaryExpression" && expr.operatorToken === "-") {
    return `(${text})`;
  }

  if (expr.kind === "literalExpression" && text.startsWith("-")) {
    return `(${text})`;
  }

  return text;
};

const printLambdaExpression = (
  expr: Extract<CSharpExpressionAst, { kind: "lambdaExpression" }>
): string => {
  const asyncPrefix = expr.isAsync ? "async " : "";
  const params = printLambdaParameters(expr.parameters);

  if (expr.body.kind === "blockStatement") {
    // Block body lambda - will be printed inline
    // The caller (statement printer) handles indentation
    return `${asyncPrefix}${params} =>\n${printStatement(expr.body, "")}`;
  }

  return `${asyncPrefix}${params} => ${printExpression(expr.body)}`;
};

const printLambdaParameters = (
  params: readonly CSharpLambdaParameterAst[]
): string => {
  if (params.length === 1 && !params[0]!.type) {
    return escapeIdentifier(params[0]!.name);
  }
  const parts = params.map((p) =>
    p.type
      ? `${printType(p.type)} ${escapeIdentifier(p.name)}`
      : escapeIdentifier(p.name)
  );
  return `(${parts.join(", ")})`;
};

const printInterpolatedString = (
  parts: readonly CSharpInterpolatedStringPart[]
): string => {
  const inner = parts
    .map((part) => {
      if (part.kind === "text") return part.text;
      const exprText = printExpression(part.expression);
      // Wrap in parens if the expression text contains ':' to prevent
      // C# from interpreting it as a format specifier delimiter.
      // Common case: global::Namespace.Type, ternary a ? b : c
      const safeText = exprText.includes(":") ? `(${exprText})` : exprText;
      return part.formatClause
        ? `{${safeText}:${part.formatClause}}`
        : `{${safeText}}`;
    })
    .join("");
  return `$"${inner}"`;
};

const printSwitchExpression = (
  expr: Extract<CSharpExpressionAst, { kind: "switchExpression" }>
): string => {
  const gov = printExpression(expr.governingExpression);
  const arms = expr.arms.map(printSwitchExpressionArm).join(", ");
  return `${gov} switch { ${arms} }`;
};

const printSwitchExpressionArm = (
  arm: CSharpSwitchExpressionArmAst
): string => {
  const pattern = printPattern(arm.pattern);
  const whenClause = arm.whenClause
    ? ` when ${printExpression(arm.whenClause)}`
    : "";
  const result = printExpression(arm.expression);
  return `${pattern}${whenClause} => ${result}`;
};

// ============================================================
// Pattern Printer
// ============================================================

export const printPattern = (pattern: CSharpPatternAst): string => {
  switch (pattern.kind) {
    case "typePattern":
      return printType(pattern.type);

    case "declarationPattern":
      return `${printType(pattern.type)} ${escapeIdentifier(pattern.designation)}`;

    case "varPattern":
      return `var ${escapeIdentifier(pattern.designation)}`;

    case "constantPattern":
      return printExpression(pattern.expression);

    case "discardPattern":
      return "_";

    case "negatedPattern":
      return `not ${printPattern(pattern.pattern)}`;

    default: {
      const exhaustiveCheck: never = pattern;
      throw new Error(
        `ICE: Unhandled pattern AST kind: ${(exhaustiveCheck as CSharpPatternAst).kind}`
      );
    }
  }
};

// ============================================================
// Statement Printer
// ============================================================

export const printStatement = (
  stmt: CSharpStatementAst,
  indent: string
): string => {
  switch (stmt.kind) {
    case "blockStatement":
      return printBlockStatement(stmt, indent);

    case "localDeclarationStatement": {
      const mods =
        stmt.modifiers.length > 0 ? `${stmt.modifiers.join(" ")} ` : "";
      const typeStr = printType(stmt.type);
      const decls = stmt.declarators
        .map((d) =>
          d.initializer
            ? `${escapeIdentifier(d.name)} = ${printExpression(d.initializer)}`
            : escapeIdentifier(d.name)
        )
        .join(", ");
      return `${indent}${mods}${typeStr} ${decls};`;
    }

    case "localFunctionStatement": {
      const mods =
        stmt.modifiers.length > 0 ? `${stmt.modifiers.join(" ")} ` : "";
      const ret = printType(stmt.returnType);
      const typeParams =
        stmt.typeParameters && stmt.typeParameters.length > 0
          ? `<${stmt.typeParameters.join(", ")}>`
          : "";
      const params = stmt.parameters.map(printParameter).join(", ");
      const body = printBlockStatement(stmt.body, indent);
      return `${indent}${mods}${ret} ${escapeIdentifier(stmt.name)}${typeParams}(${params})\n${body}`;
    }

    case "expressionStatement":
      return `${indent}${printExpression(stmt.expression)};`;

    case "ifStatement":
      return printIfStatement(stmt, indent);

    case "whileStatement": {
      const cond = printExpression(stmt.condition);
      const body = printStatement(stmt.body, indent);
      return `${indent}while (${cond})\n${body}`;
    }

    case "forStatement":
      return printForStatement(stmt, indent);

    case "foreachStatement": {
      const awaitStr = stmt.isAwait ? "await " : "";
      const typeStr = printType(stmt.type);
      const ident = escapeIdentifier(stmt.identifier);
      const collection = printExpression(stmt.expression);
      const body = printStatement(stmt.body, indent);
      return `${indent}${awaitStr}foreach (${typeStr} ${ident} in ${collection})\n${body}`;
    }

    case "switchStatement":
      return printSwitchStatement(stmt, indent);

    case "tryStatement":
      return printTryStatement(stmt, indent);

    case "throwStatement":
      return stmt.expression
        ? `${indent}throw ${printExpression(stmt.expression)};`
        : `${indent}throw;`;

    case "returnStatement":
      return stmt.expression
        ? `${indent}return ${printExpression(stmt.expression)};`
        : `${indent}return;`;

    case "breakStatement":
      return `${indent}break;`;

    case "continueStatement":
      return `${indent}continue;`;

    case "emptyStatement":
      return `${indent};`;

    case "yieldStatement":
      if (stmt.isBreak) {
        return `${indent}yield break;`;
      }
      return stmt.expression
        ? `${indent}yield return ${printExpression(stmt.expression)};`
        : `${indent}yield return;`;

    default: {
      const exhaustiveCheck: never = stmt;
      throw new Error(
        `ICE: Unhandled statement AST kind: ${(exhaustiveCheck as CSharpStatementAst).kind}`
      );
    }
  }
};

const printBlockStatement = (
  block: CSharpBlockStatementAst,
  indent: string
): string => {
  const innerIndent = indent + "    ";
  const stmts = block.statements
    .map((s) => printStatement(s, innerIndent))
    .join("\n");
  return `${indent}{\n${stmts}\n${indent}}`;
};

const printIfStatement = (
  stmt: Extract<CSharpStatementAst, { kind: "ifStatement" }>,
  indent: string
): string => {
  const cond = printExpression(stmt.condition);
  const thenBody = printStatement(stmt.thenStatement, indent);

  if (!stmt.elseStatement) {
    return `${indent}if (${cond})\n${thenBody}`;
  }

  // Else-if chain: don't add extra indentation
  if (stmt.elseStatement.kind === "ifStatement") {
    const elseIfText = printIfStatement(stmt.elseStatement, indent);
    // Strip the indent from the else-if since we're adding "else " prefix
    const elseIfBody = elseIfText.slice(indent.length);
    return `${indent}if (${cond})\n${thenBody}\n${indent}else ${elseIfBody}`;
  }

  const elseBody = printStatement(stmt.elseStatement, indent);
  return `${indent}if (${cond})\n${thenBody}\n${indent}else\n${elseBody}`;
};

const printForStatement = (
  stmt: Extract<CSharpStatementAst, { kind: "forStatement" }>,
  indent: string
): string => {
  const parts: string[] = [];

  // Initializer
  if (stmt.declaration) {
    const typeStr = printType(stmt.declaration.type);
    const decls = stmt.declaration.declarators
      .map((d) =>
        d.initializer
          ? `${escapeIdentifier(d.name)} = ${printExpression(d.initializer)}`
          : escapeIdentifier(d.name)
      )
      .join(", ");
    parts.push(`${typeStr} ${decls}`);
  } else if (stmt.initializers && stmt.initializers.length > 0) {
    parts.push(stmt.initializers.map(printExpression).join(", "));
  } else {
    parts.push("");
  }

  // Condition
  parts.push(stmt.condition ? printExpression(stmt.condition) : "");

  // Incrementors
  parts.push(stmt.incrementors.map(printExpression).join(", "));

  const header = parts.join("; ");
  const body = printStatement(stmt.body, indent);
  return `${indent}for (${header})\n${body}`;
};

const printSwitchStatement = (
  stmt: Extract<CSharpStatementAst, { kind: "switchStatement" }>,
  indent: string
): string => {
  const expr = printExpression(stmt.expression);
  const innerIndent = indent + "    ";
  const sections = stmt.sections
    .map((s) => printSwitchSection(s, innerIndent))
    .join("\n");
  return `${indent}switch (${expr})\n${indent}{\n${sections}\n${indent}}`;
};

const printSwitchSection = (
  section: CSharpSwitchSectionAst,
  indent: string
): string => {
  const labels = section.labels
    .map((l) => printSwitchLabel(l, indent))
    .join("\n");
  const stmtIndent = indent + "    ";
  const stmts = section.statements
    .map((s) => printStatement(s, stmtIndent))
    .join("\n");
  return `${labels}\n${stmts}`;
};

const printSwitchLabel = (
  label: CSharpSwitchLabelAst,
  indent: string
): string => {
  switch (label.kind) {
    case "caseSwitchLabel":
      return `${indent}case ${printExpression(label.value)}:`;
    case "casePatternSwitchLabel": {
      const pattern = printPattern(label.pattern);
      const when = label.whenClause
        ? ` when ${printExpression(label.whenClause)}`
        : "";
      return `${indent}case ${pattern}${when}:`;
    }
    case "defaultSwitchLabel":
      return `${indent}default:`;
  }
};

const printTryStatement = (
  stmt: Extract<CSharpStatementAst, { kind: "tryStatement" }>,
  indent: string
): string => {
  const tryBody = printBlockStatement(stmt.body, indent);
  const catches = stmt.catches
    .map((c) => printCatchClause(c, indent))
    .join("\n");
  const finallyStr = stmt.finallyBody
    ? `\n${indent}finally\n${printBlockStatement(stmt.finallyBody, indent)}`
    : "";
  return `${indent}try\n${tryBody}\n${catches}${finallyStr}`;
};

const printCatchClause = (
  clause: CSharpCatchClauseAst,
  indent: string
): string => {
  const body = printBlockStatement(clause.body, indent);
  if (!clause.type) {
    return `${indent}catch\n${body}`;
  }
  const typeName = printType(clause.type);
  const ident = clause.identifier
    ? ` ${escapeIdentifier(clause.identifier)}`
    : "";
  const filter = clause.filter
    ? ` when (${printExpression(clause.filter)})`
    : "";
  return `${indent}catch (${typeName}${ident})${filter}\n${body}`;
};

const printParameter = (param: CSharpParameterAst): string => {
  const mods =
    param.modifiers && param.modifiers.length > 0
      ? `${param.modifiers.join(" ")} `
      : "";
  const typeName = printType(param.type);
  const name = escapeIdentifier(param.name);
  const defaultVal = param.defaultValue
    ? ` = ${printExpression(param.defaultValue)}`
    : "";
  return `${mods}${typeName} ${name}${defaultVal}`;
};

// ============================================================
// Declaration Printer
// ============================================================

export const printMember = (
  member: CSharpMemberAst,
  indent: string
): string => {
  switch (member.kind) {
    case "fieldDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const typeName = printType(member.type);
      const name = escapeIdentifier(member.name);
      const init = member.initializer
        ? ` = ${printExpression(member.initializer)}`
        : "";
      return `${attrs}${indent}${mods}${typeName} ${name}${init};`;
    }

    case "propertyDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const typeName = printType(member.type);
      const name = escapeIdentifier(member.name);
      const accessors = member.isAutoProperty
        ? ` { ${member.hasGetter ? "get; " : ""}${member.hasSetter ? "set; " : ""}}`
        : "";
      const init =
        member.initializer && member.isAutoProperty
          ? ` = ${printExpression(member.initializer)};`
          : "";
      return `${attrs}${indent}${mods}${typeName} ${name}${accessors}${init}`;
    }

    case "methodDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const ret = printType(member.returnType);
      const typeParams = printTypeParameters(member.typeParameters);
      const params = member.parameters.map(printParameter).join(", ");
      const constraints = printConstraints(member.constraints, indent);

      if (member.expressionBody) {
        return `${attrs}${indent}${mods}${ret} ${escapeIdentifier(member.name)}${typeParams}(${params})${constraints} => ${printExpression(member.expressionBody)};`;
      }
      if (member.body) {
        return `${attrs}${indent}${mods}${ret} ${escapeIdentifier(member.name)}${typeParams}(${params})${constraints}\n${printBlockStatement(member.body, indent)}`;
      }
      // Abstract/interface method (no body)
      return `${attrs}${indent}${mods}${ret} ${escapeIdentifier(member.name)}${typeParams}(${params})${constraints};`;
    }

    case "constructorDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const params = member.parameters.map(printParameter).join(", ");
      const baseCall =
        member.baseArguments !== undefined
          ? ` : base(${member.baseArguments.map(printExpression).join(", ")})`
          : "";
      return `${attrs}${indent}${mods}${escapeIdentifier(member.name)}(${params})${baseCall}\n${printBlockStatement(member.body, indent)}`;
    }

    default: {
      const exhaustiveCheck: never = member;
      throw new Error(
        `ICE: Unhandled member AST kind: ${(exhaustiveCheck as CSharpMemberAst).kind}`
      );
    }
  }
};

export const printTypeDeclaration = (
  decl: CSharpTypeDeclarationAst,
  indent: string
): string => {
  switch (decl.kind) {
    case "classDeclaration":
    case "structDeclaration":
    case "interfaceDeclaration": {
      const keyword =
        decl.kind === "classDeclaration"
          ? "class"
          : decl.kind === "structDeclaration"
            ? "struct"
            : "interface";
      const attrs = printAttributes(decl.attributes, indent);
      const mods =
        decl.modifiers.length > 0 ? `${decl.modifiers.join(" ")} ` : "";
      const typeParams = printTypeParameters(decl.typeParameters);
      const baseTypes: string[] = [];
      if (decl.kind === "classDeclaration" && decl.baseType) {
        baseTypes.push(printType(decl.baseType));
      }
      baseTypes.push(...decl.interfaces.map(printType));
      const baseClause =
        baseTypes.length > 0 ? ` : ${baseTypes.join(", ")}` : "";
      const constraints = printConstraints(decl.constraints, indent);
      const innerIndent = indent + "    ";
      const members = decl.members
        .map((m) => printMember(m, innerIndent))
        .join("\n\n");

      return `${attrs}${indent}${mods}${keyword} ${escapeIdentifier(decl.name)}${typeParams}${baseClause}${constraints}\n${indent}{\n${members}\n${indent}}`;
    }

    case "enumDeclaration": {
      const attrs = printAttributes(decl.attributes, indent);
      const mods =
        decl.modifiers.length > 0 ? `${decl.modifiers.join(" ")} ` : "";
      const innerIndent = indent + "    ";
      const members = decl.members
        .map((m) => printEnumMember(m, innerIndent))
        .join(",\n");

      return `${attrs}${indent}${mods}enum ${escapeIdentifier(decl.name)}\n${indent}{\n${members}\n${indent}}`;
    }

    default: {
      const exhaustiveCheck: never = decl;
      throw new Error(
        `ICE: Unhandled type declaration AST kind: ${(exhaustiveCheck as CSharpTypeDeclarationAst).kind}`
      );
    }
  }
};

const printEnumMember = (
  member: CSharpEnumMemberAst,
  indent: string
): string =>
  member.value
    ? `${indent}${escapeIdentifier(member.name)} = ${printExpression(member.value)}`
    : `${indent}${escapeIdentifier(member.name)}`;

const printTypeParameters = (
  typeParams: readonly CSharpTypeParameterAst[] | undefined
): string => {
  if (!typeParams || typeParams.length === 0) return "";
  return `<${typeParams.map((tp) => tp.name).join(", ")}>`;
};

const printConstraints = (
  constraints: readonly CSharpTypeParameterConstraintAst[] | undefined,
  indent: string
): string => {
  if (!constraints || constraints.length === 0) return "";
  return constraints
    .map(
      (c) =>
        `\n${indent}    where ${c.typeParameter} : ${c.constraints.join(", ")}`
    )
    .join("");
};

const printAttributes = (
  attrs: readonly CSharpAttributeAst[],
  indent: string
): string => {
  if (attrs.length === 0) return "";
  return attrs
    .map((a) => {
      const args =
        a.arguments && a.arguments.length > 0
          ? `(${a.arguments.map(printExpression).join(", ")})`
          : "";
      return `${indent}[${a.name}${args}]\n`;
    })
    .join("");
};

// ============================================================
// Compilation Unit Printer
// ============================================================

export const printCompilationUnit = (
  unit: CSharpCompilationUnitAst
): string => {
  const usings = unit.usings
    .map((u) => `using ${escapeQualifiedName(u.namespace)};`)
    .join("\n");
  const members = unit.members
    .map((m) => {
      if (m.kind === "namespaceDeclaration") {
        return printNamespaceDeclaration(m);
      }
      return printTypeDeclaration(m, "");
    })
    .join("\n\n");

  const parts = [usings, members].filter((p) => p.length > 0);
  return parts.join("\n\n") + "\n";
};

const printNamespaceDeclaration = (
  ns: CSharpNamespaceDeclarationAst
): string => {
  const name = escapeQualifiedName(ns.name);
  const members = ns.members
    .map((m) => printTypeDeclaration(m, "    "))
    .join("\n\n");
  return `namespace ${name}\n{\n${members}\n}`;
};
