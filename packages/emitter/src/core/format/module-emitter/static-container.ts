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
import { emitExport } from "../exports.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { getCSharpName } from "../../../naming-policy.js";
import { emitClassDeclarationAst } from "./class-ast.js";
import { emitEnumDeclarationAst } from "./enum-ast.js";
import { emitInterfaceDeclarationAst } from "./interface-ast.js";
import {
  emitTypeAliasDeclarationAst,
  emitNonStructuralTypeAliasCommentAst,
} from "./type-alias-ast.js";
import { emitFunctionDeclarationAst } from "./function-ast.js";
import { emitStaticVariableDeclarationAst } from "./variable-ast.js";
import {
  classBlankLine,
  classDeclaration,
  emitStatementAst,
  methodDeclaration,
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
      ...withStatic(baseContext, true),
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
  const staticFieldInitializerStatements: CSharpStatementAst[] = [];
  let bodyCurrentContext = bodyContext;

  // Emit declarations as static members
  for (const stmt of declarations) {
    if (stmt.kind === "functionDeclaration") {
      const [methodMember, newContext] = emitFunctionDeclarationAst(
        stmt,
        bodyCurrentContext
      );
      if (!methodMember) {
        throw new Error(
          `ICE: AST function lowering is incomplete for '${stmt.name}'`
        );
      }
      bodyParts.push(methodMember);
      bodyCurrentContext = newContext;
      continue;
    }
    if (stmt.kind === "classDeclaration") {
      const [classMembers, newContext] = emitClassDeclarationAst(
        stmt,
        bodyCurrentContext,
        bodyCurrentContext.indentLevel
      );
      bodyParts.push(...classMembers);
      bodyCurrentContext = newContext;
      continue;
    }
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
      const [aliasComment, commentContext] =
        emitNonStructuralTypeAliasCommentAst(stmt, bodyCurrentContext);
      bodyParts.push(aliasComment);
      bodyCurrentContext = commentContext;
      continue;
    }
    if (stmt.kind === "interfaceDeclaration") {
      const [interfaceMember, newContext] = emitInterfaceDeclarationAst(
        stmt,
        bodyCurrentContext,
        bodyCurrentContext.indentLevel
      );
      if (interfaceMember) {
        bodyParts.push(interfaceMember);
        bodyCurrentContext = newContext;
        continue;
      }
    }
    if (stmt.kind === "variableDeclaration") {
      const [variableResult, newContext] = emitStaticVariableDeclarationAst(
        stmt,
        bodyCurrentContext
      );
      bodyParts.push(...variableResult.members);
      staticFieldInitializerStatements.push(
        ...variableResult.initializerStatements
      );
      bodyCurrentContext = newContext;
      continue;
    }
    throw new Error(
      `ICE: Unhandled static-container declaration kind in AST emitter: ${stmt.kind}`
    );
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, bodyCurrentContext);
    if (exportCode[0]) {
      throw new Error(
        "ICE: Default export comments are not lowered into backend AST members."
      );
    }
    bodyCurrentContext = exportCode[1];
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
      methodDeclaration(
        "__TopLevel",
        {
          modifiers: ["public", "static"],
          returnType: { kind: "identifierType", name: "void" },
        },
        mainStatements
      )
    );
    bodyCurrentContext = mainCurrentContext;
  }

  const shouldEmitStaticCtor =
    staticFieldInitializerStatements.length > 0 ||
    (!baseContext.options.isEntryPoint && mainBodyStmts.length > 0);

  if (shouldEmitStaticCtor) {
    // Static constructor handles:
    // - top-level static-field initializers that require execution (destructuring), and
    // - non-entrypoint top-level executable statements.
    const staticCtorContext = withStatic(indent(bodyCurrentContext), false);
    let ctorCurrentContext = staticCtorContext;
    const ctorStatements: CSharpStatementAst[] = [
      ...staticFieldInitializerStatements,
    ];
    if (!baseContext.options.isEntryPoint) {
      for (const stmt of mainBodyStmts) {
        const [ast, newContext] = emitStatementAst(stmt, ctorCurrentContext);
        ctorStatements.push(ast);
        ctorCurrentContext = newContext;
      }
    }
    bodyParts.push({
      kind: "constructorDeclaration",
      attributes: [],
      modifiers: ["static"],
      name: containerName,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements: ctorStatements,
      },
    });
    bodyCurrentContext = ctorCurrentContext;
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
