/**
 * Static container class emission
 */

import { IrModule, IrStatement, isExecutableStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  type ValueSymbolInfo,
  indent,
  getIndent,
  withStatic,
} from "../../types.js";
import { emitStatement } from "../../statement-emitter.js";
import { emitExport } from "../exports.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { statementUsesPointer } from "../unsafe.js";
import { getCSharpName } from "../../naming-policy.js";

export type StaticContainerResult = {
  readonly code: string;
  readonly context: EmitterContext;
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
        decl.kind === "interfaceDeclaration") &&
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
  const valueSymbols = new Map<string, ValueSymbolInfo>();
  for (const member of members) {
    if (member.kind === "functionDeclaration") {
      valueSymbols.set(member.name, {
        kind: "function",
        csharpName: getCSharpName(member.name, "methods", baseContext),
      });
      continue;
    }
    if (member.kind === "variableDeclaration") {
      for (const decl of member.declarations) {
        if (decl.name.kind !== "identifierPattern") continue;
        valueSymbols.set(decl.name.name, {
          kind: "variable",
          csharpName: getCSharpName(decl.name.name, "fields", baseContext),
        });
      }
    }
  }

  const classContext = {
    ...withStatic(indent(baseContext), true),
    valueSymbols,
  };
  const bodyContext = indent(classContext);
  const ind = getIndent(classContext);
  const bodyInd = getIndent(bodyContext);
  const needsUnsafe = members.some((m) => statementUsesPointer(m));

  const containerParts: string[] = [];
  const escapedClassName = escapeCSharpIdentifier(module.className);
  // Use __Module suffix when there's a collision with namespace-level type declarations
  const containerName = useModuleSuffix
    ? `${escapedClassName}__Module`
    : escapedClassName;
  containerParts.push(
    `${ind}public static${needsUnsafe ? " unsafe" : ""} class ${containerName}`
  );
  containerParts.push(`${ind}{`);

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

  const bodyParts: string[] = [];
  let bodyCurrentContext = bodyContext;

  // Emit declarations as static members
  for (const stmt of declarations) {
    const [code, newContext] = emitStatement(stmt, bodyCurrentContext);
    bodyParts.push(code);
    bodyCurrentContext = newContext;
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, bodyCurrentContext);
    if (exportCode[0]) {
      bodyParts.push(exportCode[0]);
      bodyCurrentContext = exportCode[1];
    }
  }

  // Wrap statements in Main method if this is an entry point with top-level code
  if (mainBodyStmts.length > 0 && baseContext.options.isEntryPoint) {
    const mainParts: string[] = [];
    mainParts.push(`${bodyInd}public static void __TopLevel()`);
    mainParts.push(`${bodyInd}{`);

    const mainBodyContext = indent(bodyCurrentContext);
    let mainCurrentContext = mainBodyContext;

    for (const stmt of mainBodyStmts) {
      const [code, newContext] = emitStatement(stmt, mainCurrentContext);
      mainParts.push(code);
      mainCurrentContext = newContext;
    }

    mainParts.push(`${bodyInd}}`);
    bodyParts.push(mainParts.join("\n"));
    bodyCurrentContext = mainCurrentContext;
  } else if (mainBodyStmts.length > 0) {
    // Not an entry point - emit statements directly (for compatibility)
    for (const stmt of mainBodyStmts) {
      const [code, newContext] = emitStatement(stmt, bodyCurrentContext);
      bodyParts.push(code);
      bodyCurrentContext = newContext;
    }
  }

  if (bodyParts.length > 0) {
    containerParts.push(bodyParts.join("\n\n"));
  }

  containerParts.push(`${ind}}`);

  return {
    code: containerParts.join("\n"),
    context: { ...bodyCurrentContext, hasInheritance },
  };
};
