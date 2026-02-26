/**
 * Static container class emission
 *
 * Builds a CSharpClassDeclarationAst for the module's static container class.
 * The container holds static fields, methods, and a __TopLevel() entry point.
 */

import { IrModule, IrStatement, isExecutableStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  type ValueSymbolInfo,
  indent,
  getIndent,
  withStatic,
  withClassName,
} from "../../../types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import {
  emitFunctionDeclaration,
  emitVariableDeclaration,
  emitTypeAliasDeclaration,
} from "../../../statements/declarations.js";
import { emitExport } from "../exports.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { getCSharpName } from "../../../naming-policy.js";
import type {
  CSharpClassDeclarationAst,
  CSharpMemberAst,
  CSharpStatementAst,
} from "../backend-ast/types.js";

export type StaticContainerResult = {
  readonly declaration: CSharpClassDeclarationAst;
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
 * Emit static container class as CSharpClassDeclarationAst.
 *
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
  const isEntryPointWithTopLevelCode =
    baseContext.options.isEntryPoint && members.some(isExecutableStatement);

  const staticMemberKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration",
  ];

  const declarations = isEntryPointWithTopLevelCode
    ? members.filter((m) => staticMemberKinds.includes(m.kind))
    : members.filter((m) => !isExecutableStatement(m));

  const mainBodyStmts = isEntryPointWithTopLevelCode
    ? members.filter((m) => !staticMemberKinds.includes(m.kind))
    : members.filter(isExecutableStatement);

  const astMembers: CSharpMemberAst[] = [];
  let bodyCurrentContext = bodyContext;
  const bodyInd = getIndent(bodyContext);

  // Emit declarations as static members
  for (const stmt of declarations) {
    switch (stmt.kind) {
      case "functionDeclaration": {
        const [funcMembers, funcCtx] = emitFunctionDeclaration(
          stmt,
          bodyCurrentContext
        );
        astMembers.push(...funcMembers);
        bodyCurrentContext = funcCtx;
        break;
      }

      case "variableDeclaration": {
        const [varMembers, varCtx] = emitVariableDeclaration(
          stmt,
          bodyCurrentContext
        );
        astMembers.push(...varMembers);
        bodyCurrentContext = varCtx;
        break;
      }

      case "typeAliasDeclaration": {
        const [, aliasCtx, commentText] = emitTypeAliasDeclaration(
          stmt,
          bodyCurrentContext
        );
        if (commentText) {
          astMembers.push({
            kind: "literalMember",
            text: `${bodyInd}${commentText}`,
          });
        }
        bodyCurrentContext = aliasCtx;
        break;
      }

      default:
        // Other declaration types in static container are rare but possible
        break;
    }
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const [exportText, exportCtx] = emitExport(exp, bodyCurrentContext);
    if (exportText) {
      astMembers.push({ kind: "literalMember", text: exportText });
    }
    bodyCurrentContext = exportCtx;
  }

  // Wrap executable statements in __TopLevel method
  if (mainBodyStmts.length > 0 && baseContext.options.isEntryPoint) {
    const mainBodyContext = withStatic(indent(bodyCurrentContext), false);
    let mainCurrentContext = mainBodyContext;
    const topLevelStatements: CSharpStatementAst[] = [];

    for (const stmt of mainBodyStmts) {
      const [stmts, newContext] = emitStatementAst(stmt, mainCurrentContext);
      topLevelStatements.push(...stmts);
      mainCurrentContext = newContext;
    }

    astMembers.push({
      kind: "methodDeclaration",
      attributes: [],
      modifiers: ["public", "static"],
      returnType: { kind: "identifierType", name: "void" },
      name: "__TopLevel",
      parameters: [],
      body: { kind: "blockStatement", statements: topLevelStatements },
    });
    bodyCurrentContext = mainCurrentContext;
  } else if (mainBodyStmts.length > 0) {
    // Not an entry point - emit statements as literal members
    const mainBodyContext = withStatic(indent(bodyCurrentContext), false);
    let mainCurrentContext = mainBodyContext;

    for (const stmt of mainBodyStmts) {
      const [stmts, newContext] = emitStatementAst(stmt, mainCurrentContext);
      // Wrap each statement AST in a literal member (non-entry-point executable statements)
      for (const _ of stmts) {
        astMembers.push({
          kind: "literalMember",
          text: `// executable statement in non-entry static container`,
        });
      }
      mainCurrentContext = newContext;
    }
    bodyCurrentContext = mainCurrentContext;
  }

  const modifiers = ["public", "static", ...(needsUnsafe ? ["unsafe"] : [])];

  const declaration: CSharpClassDeclarationAst = {
    kind: "classDeclaration",
    attributes: [{ name: "global::Tsonic.Internal.ModuleContainerAttribute" }],
    modifiers,
    name: containerName,
    interfaces: [],
    members: astMembers,
  };

  return {
    declaration,
    context: { ...bodyCurrentContext, hasInheritance },
  };
};
