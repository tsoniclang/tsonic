/**
 * Backend AST Printer – Declarations
 *
 * Type declarations (class, struct, interface, enum), members
 * (fields, properties, methods, constructors, delegates),
 * and compilation-unit / namespace printing.
 */

import type {
  CSharpMemberAst,
  CSharpTypeDeclarationAst,
  CSharpTypeParameterAst,
  CSharpTypeParameterConstraintNodeAst,
  CSharpTypeParameterConstraintAst,
  CSharpEnumMemberAst,
  CSharpCompilationUnitAst,
  CSharpNamespaceDeclarationAst,
} from "./types.js";

import {
  escapeIdentifier,
  escapeQualifiedName,
  printTrivia,
  printType,
} from "./printer-shared.js";

import {
  printExpression,
  printAttributes,
  printParameter,
} from "./printer-expressions.js";

import { printBlockStatement } from "./printer-statements.js";

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
        ? ` = ${printExpression(member.initializer, indent)}`
        : "";
      return `${attrs}${indent}${mods}${typeName} ${name}${init};`;
    }

    case "propertyDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const typeName = printType(member.type);
      const name = member.explicitInterface
        ? `${printType(member.explicitInterface)}.${escapeIdentifier(member.name)}`
        : escapeIdentifier(member.name);

      if (member.isAutoProperty) {
        const getStr = member.hasGetter ? "get; " : "";
        const setStr = member.hasInit
          ? "init; "
          : member.hasSetter
            ? `${member.setterAccessibility ? `${member.setterAccessibility} ` : ""}set; `
            : "";
        const accessors = ` { ${getStr}${setStr}}`;
        const init = member.initializer
          ? ` = ${printExpression(member.initializer, indent)};`
          : "";
        return `${attrs}${indent}${mods}${typeName} ${name}${accessors}${init}`;
      }

      // Explicit property accessors
      const bodyIndent = indent + "    ";
      const accessorIndent = bodyIndent + "    ";
      const lines: string[] = [];
      lines.push(`${attrs}${indent}${mods}${typeName} ${name}`);
      lines.push(`${bodyIndent}{`);
      if (member.getterBody) {
        lines.push(`${bodyIndent}get`);
        lines.push(printBlockStatement(member.getterBody, accessorIndent));
      }
      if (member.setterBody) {
        lines.push(`${bodyIndent}set`);
        lines.push(printBlockStatement(member.setterBody, accessorIndent));
      }
      lines.push(`${bodyIndent}}`);
      return lines.join("\n");
    }

    case "methodDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const ret = printType(member.returnType);
      const name = member.explicitInterface
        ? `${printType(member.explicitInterface)}.${escapeIdentifier(member.name)}`
        : escapeIdentifier(member.name);
      const typeParams = printTypeParameters(member.typeParameters);
      const params = member.parameters.map(printParameter).join(", ");
      const constraints = printConstraints(member.constraints, indent);

      if (member.expressionBody) {
        return `${attrs}${indent}${mods}${ret} ${name}${typeParams}(${params})${constraints} => ${printExpression(member.expressionBody, indent)};`;
      }
      if (member.body) {
        return `${attrs}${indent}${mods}${ret} ${name}${typeParams}(${params})${constraints}\n${printBlockStatement(member.body, indent)}`;
      }
      // Abstract/interface method (no body)
      return `${attrs}${indent}${mods}${ret} ${name}${typeParams}(${params})${constraints};`;
    }

    case "constructorDeclaration": {
      const attrs = printAttributes(member.attributes, indent);
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const params = member.parameters.map(printParameter).join(", ");
      const baseCall =
        member.baseArguments !== undefined
          ? ` : base(${member.baseArguments.map((arg) => printExpression(arg, indent)).join(", ")})`
          : "";
      return `${attrs}${indent}${mods}${escapeIdentifier(member.name)}(${params})${baseCall}\n${printBlockStatement(member.body, indent)}`;
    }

    case "delegateDeclaration": {
      const mods =
        member.modifiers.length > 0 ? `${member.modifiers.join(" ")} ` : "";
      const ret = printType(member.returnType);
      const params = member.parameters.map(printParameter).join(", ");
      return `${indent}${mods}delegate ${ret} ${escapeIdentifier(member.name)}(${params});`;
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
    ? `${indent}${escapeIdentifier(member.name)} = ${printExpression(member.value, indent)}`
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

  const printConstraint = (
    constraint: CSharpTypeParameterConstraintNodeAst
  ): string => {
    switch (constraint.kind) {
      case "typeConstraint":
        return printType(constraint.type);
      case "classConstraint":
        return "class";
      case "structConstraint":
        return "struct";
      case "constructorConstraint":
        return "new()";
      default: {
        const exhaustiveCheck: never = constraint;
        throw new Error(
          `ICE: Unhandled type parameter constraint kind: ${(exhaustiveCheck as CSharpTypeParameterConstraintNodeAst).kind}`
        );
      }
    }
  };

  return constraints
    .map(
      (c) =>
        `\n${indent}    where ${escapeIdentifier(c.typeParameter)} : ${c.constraints
          .map(printConstraint)
          .join(", ")}`
    )
    .join("");
};

// ============================================================
// Compilation Unit Printer
// ============================================================

export const printCompilationUnit = (
  unit: CSharpCompilationUnitAst
): string => {
  const parts: string[] = [];

  if (unit.leadingTrivia && unit.leadingTrivia.length > 0) {
    parts.push(unit.leadingTrivia.map(printTrivia).join("\n"));
  }

  const usings = unit.usings
    .map((u) => `using ${escapeQualifiedName(u.namespace, false)};`)
    .join("\n");
  if (usings) {
    parts.push(usings);
    parts.push("");
  }

  const members = unit.members
    .map((m) => {
      if (m.kind === "namespaceDeclaration") {
        return printNamespaceDeclaration(m);
      }
      return printTypeDeclaration(m, "");
    })
    .join("\n\n");
  if (members) {
    parts.push(members);
  }

  return parts.join("\n");
};

const printNamespaceDeclaration = (
  ns: CSharpNamespaceDeclarationAst
): string => {
  const name = escapeQualifiedName(ns.name, false);
  const members = ns.members
    .map((m) => printTypeDeclaration(m, "    "))
    .join("\n\n");
  return `namespace ${name}\n{\n${members}\n}`;
};
