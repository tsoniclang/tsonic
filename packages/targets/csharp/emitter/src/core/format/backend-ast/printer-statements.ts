/**
 * Backend AST Printer – Statements
 *
 * Statement printing (printStatement), block helpers, switch labels,
 * try/catch, and the flat-block printer (printStatementFlatBlock).
 */

import type {
  CSharpStatementAst,
  CSharpBlockStatementAst,
  CSharpSwitchSectionAst,
  CSharpSwitchLabelAst,
  CSharpCatchClauseAst,
} from "./types.js";

import { escapeIdentifier, printType } from "./printer-shared.js";

// NOTE: circular import with printer-expressions.ts is intentional and safe.
// Both modules only reference each other's exports inside function bodies
// (not at module-load time), so ESM initialization completes before any
// cross-module call occurs.
import {
  printExpression,
  printPattern,
  printParameter,
} from "./printer-expressions.js";

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
            ? `${escapeIdentifier(d.name)} = ${printExpression(d.initializer, indent)}`
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
      return `${indent}${printExpression(stmt.expression, indent)};`;

    case "ifStatement":
      return printIfStatement(stmt, indent);

    case "whileStatement": {
      const cond = printExpression(stmt.condition, indent);
      const body = printStatement(stmt.body, indent);
      return `${indent}while (${cond})\n${body}`;
    }

    case "forStatement":
      return printForStatement(stmt, indent);

    case "foreachStatement": {
      const awaitStr = stmt.isAwait ? "await " : "";
      const typeStr = printType(stmt.type);
      const ident = escapeIdentifier(stmt.identifier);
      const collection = printExpression(stmt.expression, indent);
      const body = printStatement(stmt.body, indent);
      return `${indent}${awaitStr}foreach (${typeStr} ${ident} in ${collection})\n${body}`;
    }

    case "switchStatement":
      return printSwitchStatement(stmt, indent);

    case "tryStatement":
      return printTryStatement(stmt, indent);

    case "throwStatement":
      return stmt.expression
        ? `${indent}throw ${printExpression(stmt.expression, indent)};`
        : `${indent}throw;`;

    case "returnStatement":
      return stmt.expression
        ? `${indent}return ${printExpression(stmt.expression, indent)};`
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
        ? `${indent}yield return ${printExpression(stmt.expression, indent)};`
        : `${indent}yield return;`;

    default: {
      const exhaustiveCheck: never = stmt;
      throw new Error(
        `ICE: Unhandled statement AST kind: ${(exhaustiveCheck as CSharpStatementAst).kind}`
      );
    }
  }
};

export const printBlockStatement = (
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
  const cond = printExpression(stmt.condition, indent);
  const printIfBranch = (branch: CSharpStatementAst): string =>
    branch.kind === "blockStatement"
      ? printBlockStatement(branch, indent)
      : printBlockStatement(
          {
            kind: "blockStatement",
            statements: [branch],
          },
          indent
        );
  const thenBody = printIfBranch(stmt.thenStatement);

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

  const elseBody = printIfBranch(stmt.elseStatement);
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
          ? `${escapeIdentifier(d.name)} = ${printExpression(d.initializer, indent)}`
          : escapeIdentifier(d.name)
      )
      .join(", ");
    parts.push(`${typeStr} ${decls}`);
  } else if (stmt.initializers && stmt.initializers.length > 0) {
    parts.push(
      stmt.initializers.map((expr) => printExpression(expr, indent)).join(", ")
    );
  } else {
    parts.push("");
  }

  // Condition
  parts.push(stmt.condition ? printExpression(stmt.condition, indent) : "");

  // Incrementors
  parts.push(
    stmt.incrementors.map((expr) => printExpression(expr, indent)).join(", ")
  );

  const header = parts.join("; ");
  const body = printStatement(stmt.body, indent);
  return `${indent}for (${header})\n${body}`;
};

const printSwitchStatement = (
  stmt: Extract<CSharpStatementAst, { kind: "switchStatement" }>,
  indent: string
): string => {
  const expr = printExpression(stmt.expression, indent);
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

export const printSwitchLabel = (
  label: CSharpSwitchLabelAst,
  indent: string
): string => {
  switch (label.kind) {
    case "caseSwitchLabel":
      return `${indent}case ${printExpression(label.value, indent)}:`;
    case "casePatternSwitchLabel": {
      const pattern = printPattern(label.pattern);
      const when = label.whenClause
        ? ` when ${printExpression(label.whenClause, indent)}`
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
    ? ` when (${printExpression(clause.filter, indent)})`
    : "";
  return `${indent}catch (${typeName}${ident})${filter}\n${body}`;
};

// ============================================================
// Flat Block Printer
// ============================================================

/**
 * Print a statement with "flat block" convention:
 * block braces and inner statements share the same indent level.
 *
 * Used by the static container's __TopLevel method and other contexts
 * where block bodies need Tsonic's flat-block formatting (braces at same
 * indent as inner statements, not C#-standard nested convention).
 *
 * For compound statements (if/while/for/foreach/switch/try), body blocks
 * are printed at indent+4 with flat block convention (braces and inner
 * statements at the same level).
 */
export const printStatementFlatBlock = (
  stmt: CSharpStatementAst,
  indent: string
): string => {
  const bodyIndent = indent + "    ";
  switch (stmt.kind) {
    case "blockStatement": {
      const inner = stmt.statements
        .map((s) => printStatementFlatBlock(s, indent))
        .join("\n");
      return `${indent}{\n${inner}\n${indent}}`;
    }

    case "ifStatement": {
      const cond = printExpression(stmt.condition, indent);
      const thenBody = printStatementFlatBlock(stmt.thenStatement, bodyIndent);

      if (!stmt.elseStatement) {
        return `${indent}if (${cond})\n${thenBody}`;
      }

      // Else-if chain
      if (stmt.elseStatement.kind === "ifStatement") {
        const elseIfText = printStatementFlatBlock(stmt.elseStatement, indent);
        const elseIfBody = elseIfText.slice(indent.length);
        return `${indent}if (${cond})\n${thenBody}\n${indent}else ${elseIfBody}`;
      }

      const elseBody = printStatementFlatBlock(stmt.elseStatement, bodyIndent);
      return `${indent}if (${cond})\n${thenBody}\n${indent}else\n${elseBody}`;
    }

    case "whileStatement": {
      const cond = printExpression(stmt.condition, indent);
      const body = printStatementFlatBlock(stmt.body, bodyIndent);
      return `${indent}while (${cond})\n${body}`;
    }

    case "forStatement": {
      const parts: string[] = [];
      if (stmt.declaration) {
        const typeStr = printType(stmt.declaration.type);
        const decls = stmt.declaration.declarators
          .map((d) =>
            d.initializer
              ? `${escapeIdentifier(d.name)} = ${printExpression(d.initializer, indent)}`
              : escapeIdentifier(d.name)
          )
          .join(", ");
        parts.push(`${typeStr} ${decls}`);
      } else if (stmt.initializers && stmt.initializers.length > 0) {
        parts.push(
          stmt.initializers
            .map((expr) => printExpression(expr, indent))
            .join(", ")
        );
      } else {
        parts.push("");
      }
      parts.push(stmt.condition ? printExpression(stmt.condition, indent) : "");
      parts.push(
        stmt.incrementors
          .map((expr) => printExpression(expr, indent))
          .join(", ")
      );
      const header = parts.join("; ");
      const body = printStatementFlatBlock(stmt.body, bodyIndent);
      return `${indent}for (${header})\n${body}`;
    }

    case "foreachStatement": {
      const awaitStr = stmt.isAwait ? "await " : "";
      const typeStr = printType(stmt.type);
      const ident = escapeIdentifier(stmt.identifier);
      const collection = printExpression(stmt.expression, indent);
      const body = printStatementFlatBlock(stmt.body, bodyIndent);
      return `${indent}${awaitStr}foreach (${typeStr} ${ident} in ${collection})\n${body}`;
    }

    case "switchStatement": {
      const expr = printExpression(stmt.expression, indent);
      const sections = stmt.sections
        .map((s) => {
          const labels = s.labels
            .map((l) => printSwitchLabel(l, bodyIndent))
            .join("\n");
          const stmtInd = bodyIndent + "    ";
          const sectionStmts = s.statements
            .map((st) => printStatementFlatBlock(st, stmtInd))
            .join("\n");
          return `${labels}\n${sectionStmts}`;
        })
        .join("\n");
      return `${indent}switch (${expr})\n${indent}{\n${sections}\n${indent}}`;
    }

    case "tryStatement": {
      // Try/catch/finally bodies are at the SAME indent as the keyword
      // (the old text emitter did NOT call indent() for try/catch bodies)
      const tryBody = printStatementFlatBlock(stmt.body, indent);
      const catches = stmt.catches
        .map((c) => {
          const catchBody = printStatementFlatBlock(c.body, indent);
          if (!c.type) {
            return `${indent}catch\n${catchBody}`;
          }
          const typeName = printType(c.type);
          const ident = c.identifier
            ? ` ${escapeIdentifier(c.identifier)}`
            : "";
          const filter = c.filter
            ? ` when (${printExpression(c.filter, indent)})`
            : "";
          return `${indent}catch (${typeName}${ident})${filter}\n${catchBody}`;
        })
        .join("\n");
      const finallyStr = stmt.finallyBody
        ? `\n${indent}finally\n${printStatementFlatBlock(stmt.finallyBody, indent)}`
        : "";
      return `${indent}try\n${tryBody}\n${catches}${finallyStr}`;
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

    default:
      return printStatement(stmt, indent);
  }
};
