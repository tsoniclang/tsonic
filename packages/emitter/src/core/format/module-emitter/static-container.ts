/**
 * Static container class emission
 */

import { IrModule, IrStatement, isExecutableStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  withClassName,
  withStatic,
  indent,
  type ValueSymbolInfo,
} from "../../../types.js";
import { emitStatement } from "../../../statement-emitter.js";
import { emitExport } from "../exports.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { getCSharpName } from "../../../naming-policy.js";
import { emitEnumDeclarationAst } from "./enum-ast.js";
import { emitTypeAliasDeclarationAst } from "./type-alias-ast.js";
import {
  classBlankLine,
  classPreludeMember,
  classDeclaration,
  emitStatementAst,
  methodDeclaration,
  printStatement,
  type CSharpClassDeclarationAst,
  type CSharpClassMemberAst,
  type CSharpStatementAst,
} from "../backend-ast/index.js";

export type StaticContainerResult = {
  readonly member?: CSharpClassDeclarationAst;
  readonly context: EmitterContext;
};

export const collectStaticContainerValueSymbols = (
  members: readonly IrStatement[],
  context: EmitterContext
): ReadonlyMap<string, ValueSymbolInfo> => {
  const valueSymbols = new Map<string, ValueSymbolInfo>();

  for (const member of members) {
    if (member.kind === "functionDeclaration") {
      valueSymbols.set(member.name, {
        kind: "function",
        csharpName: getCSharpName(member.name, "methods", context),
      });
      continue;
    }
    if (member.kind === "variableDeclaration") {
      for (const decl of member.declarations) {
        if (decl.name.kind !== "identifierPattern") continue;
        valueSymbols.set(decl.name.name, {
          kind: "variable",
          csharpName: getCSharpName(decl.name.name, "fields", context),
        });
      }
    }
  }

  return valueSymbols;
};

/**
 * Check if there's a namespace-level class with the same name as the module
 */
export const hasMatchingClassName = (
  declarations: readonly IrStatement[],
  className: string
): boolean => {
  return declarations.some(
    (decl) =>
      (decl.kind === "classDeclaration" ||
        decl.kind === "interfaceDeclaration" ||
        decl.kind === "enumDeclaration") &&
      decl.name === className
  );
};

/**
 * Emit static container class for module-level members
 * @param useModuleSuffix - If true, adds __Module suffix to avoid collision with namespace-level types
 */
export const emitStaticContainer = (
  module: IrModule,
  members: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean,
  useModuleSuffix: boolean = false
): StaticContainerResult => {
  const escapedClassName = escapeCSharpIdentifier(module.className);
  // Use __Module suffix when there's a collision with namespace-level type declarations
  const containerName = useModuleSuffix
    ? `${escapedClassName}__Module`
    : escapedClassName;

  const valueSymbols = collectStaticContainerValueSymbols(members, baseContext);
  const classContext = withClassName(
    {
      ...withStatic(indent(baseContext), true),
      valueSymbols,
    },
    containerName
  );
  const bodyContext = indent(classContext);
  const needsUnsafe = members.some((m) => statementUsesPointer(m));

  // Separate declarations from executable statements
  // For entry points with top-level code, only expression statements go into Main
  // Variable declarations stay as static fields (they may be referenced by exported functions)
  const isEntryPointWithTopLevelCode =
    baseContext.options.isEntryPoint && members.some(isExecutableStatement);

  // Static member declarations: functions, classes, interfaces, type aliases, enums, variables
  // These stay outside Main even in entry points
  // Variable declarations must stay as static fields because they may be referenced
  // by exported functions (which are also static members)
  const staticMemberKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration", // Must stay outside Main - may be referenced by static functions
  ];

  const declarations = isEntryPointWithTopLevelCode
    ? members.filter((m) => staticMemberKinds.includes(m.kind))
    : members.filter((m) => !isExecutableStatement(m));

  const mainBodyStmts = isEntryPointWithTopLevelCode
    ? members.filter((m) => !staticMemberKinds.includes(m.kind))
    : members.filter(isExecutableStatement);

  const bodyParts: CSharpClassMemberAst[] = [];
  let bodyCurrentContext = bodyContext;

  // Emit declarations as static members
  for (const stmt of declarations) {
    if (stmt.kind === "enumDeclaration") {
      const [enumMember, newContext] = emitEnumDeclarationAst(
        stmt,
        bodyCurrentContext,
        bodyCurrentContext.indentLevel
      );
      bodyParts.push(enumMember);
      bodyCurrentContext = newContext;
      continue;
    }
    if (stmt.kind === "typeAliasDeclaration") {
      const [typeAliasMember, newContext] = emitTypeAliasDeclarationAst(
        stmt,
        bodyCurrentContext,
        bodyCurrentContext.indentLevel
      );
      if (typeAliasMember) {
        bodyParts.push(typeAliasMember);
        bodyCurrentContext = newContext;
        continue;
      }
    }

    const [code, newContext] = emitStatement(stmt, bodyCurrentContext);
    bodyParts.push(classPreludeMember(code, 0));
    bodyCurrentContext = newContext;
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, bodyCurrentContext);
    if (exportCode[0]) {
      bodyParts.push(classPreludeMember(exportCode[0], 0));
      bodyCurrentContext = exportCode[1];
    }
  }

  // Wrap statements in Main method if this is an entry point with top-level code
  if (mainBodyStmts.length > 0 && baseContext.options.isEntryPoint) {
    // Even though __TopLevel is a static method, its body should be treated as
    // a "local variable" context (not a static field context).
    const mainBodyContext = withStatic(indent(bodyCurrentContext), false);
    let mainCurrentContext = mainBodyContext;
    const mainStatements: CSharpStatementAst[] = [];

    for (const stmt of mainBodyStmts) {
      const [ast, newContext] = emitStatementAst(stmt, mainCurrentContext);
      mainStatements.push(ast);
      mainCurrentContext = newContext;
    }
    bodyParts.push(
      methodDeclaration("public static void __TopLevel()", mainStatements)
    );
    bodyCurrentContext = mainCurrentContext;
  } else if (mainBodyStmts.length > 0) {
    // Not an entry point - emit statements directly (for compatibility)
    for (const stmt of mainBodyStmts) {
      const [ast, newContext] = emitStatementAst(stmt, bodyCurrentContext);
      bodyParts.push(
        classPreludeMember(
          printStatement(ast, bodyCurrentContext.indentLevel),
          0
        )
      );
      bodyCurrentContext = newContext;
    }
  }

  const classMembers = bodyParts.flatMap((bodyPart, index) =>
    index < bodyParts.length - 1 ? [bodyPart, classBlankLine()] : [bodyPart]
  );

  const member = classDeclaration(containerName, {
    indentLevel: classContext.indentLevel,
    attributes: ["[global::Tsonic.Internal.ModuleContainerAttribute]"],
    modifiers: ["public", "static", ...(needsUnsafe ? ["unsafe"] : [])],
    members: classMembers,
  });

  return {
    member,
    context: { ...bodyCurrentContext, hasInheritance },
  };
};
