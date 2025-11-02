/**
 * Statement converter - TypeScript AST to IR statements
 */

import * as ts from "typescript";
import {
  IrStatement,
  IrVariableDeclaration,
  IrFunctionDeclaration,
  IrClassDeclaration,
  IrClassMember,
  IrBlockStatement,
  IrIfStatement,
  IrWhileStatement,
  IrForStatement,
  IrForOfStatement,
  IrSwitchStatement,
  IrSwitchCase,
  IrTryStatement,
  IrCatchClause,
  IrInterfaceDeclaration,
  IrEnumDeclaration,
  IrTypeAliasDeclaration,
  IrInterfaceMember,
  IrParameter,
  IrAccessibility,
  IrTypeParameter,
} from "./types.js";
import { convertExpression } from "./expression-converter.js";
import { convertType, convertBindingName } from "./type-converter.js";

/**
 * Convert TypeScript type parameters to IR, detecting structural constraints
 */
const convertTypeParameters = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  checker: ts.TypeChecker
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((tp) => {
    const name = tp.name.text;
    const constraint = tp.constraint
      ? convertType(tp.constraint, checker)
      : undefined;
    const defaultType = tp.default
      ? convertType(tp.default, checker)
      : undefined;

    // Check if constraint is structural (object literal type)
    const isStructural = tp.constraint && ts.isTypeLiteralNode(tp.constraint);

    // Extract structural members if it's a structural constraint
    const structuralMembers =
      isStructural && tp.constraint && ts.isTypeLiteralNode(tp.constraint)
        ? tp.constraint.members
            .map((member) => convertInterfaceMember(member, checker))
            .filter((m): m is IrInterfaceMember => m !== null)
        : undefined;

    return {
      kind: "typeParameter" as const,
      name,
      constraint,
      default: defaultType,
      variance: undefined, // TypeScript doesn't expose variance directly
      isStructuralConstraint: isStructural,
      structuralMembers,
    };
  });
};

export const convertStatement = (
  node: ts.Node,
  checker: ts.TypeChecker
): IrStatement | null => {
  if (ts.isVariableStatement(node)) {
    return convertVariableStatement(node, checker);
  }
  if (ts.isFunctionDeclaration(node)) {
    return convertFunctionDeclaration(node, checker);
  }
  if (ts.isClassDeclaration(node)) {
    return convertClassDeclaration(node, checker);
  }
  if (ts.isInterfaceDeclaration(node)) {
    return convertInterfaceDeclaration(node, checker);
  }
  if (ts.isEnumDeclaration(node)) {
    return convertEnumDeclaration(node, checker);
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return convertTypeAliasDeclaration(node, checker);
  }
  if (ts.isExpressionStatement(node)) {
    return {
      kind: "expressionStatement",
      expression: convertExpression(node.expression, checker),
    };
  }
  if (ts.isReturnStatement(node)) {
    return {
      kind: "returnStatement",
      expression: node.expression
        ? convertExpression(node.expression, checker)
        : undefined,
    };
  }
  if (ts.isIfStatement(node)) {
    return convertIfStatement(node, checker);
  }
  if (ts.isWhileStatement(node)) {
    return convertWhileStatement(node, checker);
  }
  if (ts.isForStatement(node)) {
    return convertForStatement(node, checker);
  }
  if (ts.isForOfStatement(node)) {
    return convertForOfStatement(node, checker);
  }
  if (ts.isForInStatement(node)) {
    return convertForInStatement(node, checker);
  }
  if (ts.isSwitchStatement(node)) {
    return convertSwitchStatement(node, checker);
  }
  if (ts.isThrowStatement(node)) {
    if (!node.expression) {
      return null;
    }
    return {
      kind: "throwStatement",
      expression: convertExpression(node.expression, checker),
    };
  }
  if (ts.isTryStatement(node)) {
    return convertTryStatement(node, checker);
  }
  if (ts.isBlock(node)) {
    return convertBlockStatement(node, checker);
  }
  if (ts.isBreakStatement(node)) {
    return {
      kind: "breakStatement",
      label: node.label?.text,
    };
  }
  if (ts.isContinueStatement(node)) {
    return {
      kind: "continueStatement",
      label: node.label?.text,
    };
  }
  if (ts.isEmptyStatement(node)) {
    return { kind: "emptyStatement" };
  }

  return null;
};

const convertVariableStatement = (
  node: ts.VariableStatement,
  checker: ts.TypeChecker
): IrVariableDeclaration => {
  const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
  const isLet = !!(node.declarationList.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarationList.declarations.map((decl) => ({
      kind: "variableDeclarator",
      name: convertBindingName(decl.name),
      type: decl.type ? convertType(decl.type, checker) : undefined,
      initializer: decl.initializer
        ? convertExpression(decl.initializer, checker)
        : undefined,
    })),
    isExported: hasExportModifier(node),
  };
};

const convertFunctionDeclaration = (
  node: ts.FunctionDeclaration,
  checker: ts.TypeChecker
): IrFunctionDeclaration | null => {
  if (!node.name) return null;

  return {
    kind: "functionDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    parameters: convertParameters(node.parameters, checker),
    returnType: node.type ? convertType(node.type, checker) : undefined,
    body: node.body
      ? convertBlockStatement(node.body, checker)
      : { kind: "blockStatement", statements: [] },
    isAsync: !!node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ),
    isGenerator: !!node.asteriskToken,
    isExported: hasExportModifier(node),
  };
};

const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): IrClassDeclaration | null => {
  if (!node.name) return null;

  const superClass = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  )?.types[0]?.expression;

  const implementsTypes =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ImplementsKeyword)
      ?.types.map((t) => convertType(t, checker)) ?? [];

  // Extract parameter properties from constructor
  const constructor = node.members.find(ts.isConstructorDeclaration);
  const parameterProperties: IrClassMember[] = [];

  if (constructor) {
    for (const param of constructor.parameters) {
      const accessibility = getAccessibility(param);
      if (accessibility !== "public" && accessibility !== "private" && accessibility !== "protected") {
        continue; // Not a parameter property
      }

      // Create a field declaration for this parameter property
      if (ts.isIdentifier(param.name)) {
        parameterProperties.push({
          kind: "propertyDeclaration",
          name: param.name.text,
          type: param.type ? convertType(param.type, checker) : undefined,
          initializer: undefined, // Will be assigned in constructor
          isStatic: false,
          isReadonly: hasReadonlyModifier(param),
          accessibility,
        });
      }
    }
  }

  const convertedMembers = node.members
    .map((m) => convertClassMember(m, checker, constructor?.parameters))
    .filter((m): m is IrClassMember => m !== null);

  return {
    kind: "classDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    superClass: superClass ? convertExpression(superClass, checker) : undefined,
    implements: implementsTypes,
    members: [...parameterProperties, ...convertedMembers],
    isExported: hasExportModifier(node),
  };
};

const convertClassMember = (
  node: ts.ClassElement,
  checker: ts.TypeChecker,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember | null => {
  if (ts.isPropertyDeclaration(node)) {
    return {
      kind: "propertyDeclaration",
      name: ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      type: node.type ? convertType(node.type, checker) : undefined,
      initializer: node.initializer
        ? convertExpression(node.initializer, checker)
        : undefined,
      isStatic: hasStaticModifier(node),
      isReadonly: hasReadonlyModifier(node),
      accessibility: getAccessibility(node),
    };
  }

  if (ts.isMethodDeclaration(node)) {
    return {
      kind: "methodDeclaration",
      name: ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      typeParameters: convertTypeParameters(node.typeParameters, checker),
      parameters: convertParameters(node.parameters, checker),
      returnType: node.type ? convertType(node.type, checker) : undefined,
      body: node.body ? convertBlockStatement(node.body, checker) : undefined,
      isStatic: hasStaticModifier(node),
      isAsync: !!node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword
      ),
      isGenerator: !!node.asteriskToken,
      accessibility: getAccessibility(node),
    };
  }

  if (ts.isConstructorDeclaration(node)) {
    // Build constructor body with parameter property assignments
    const statements: any[] = [];

    // Add assignments for parameter properties
    if (constructorParams) {
      for (const param of constructorParams) {
        const accessibility = getAccessibility(param);
        if (accessibility === "public" || accessibility === "private" || accessibility === "protected") {
          if (ts.isIdentifier(param.name)) {
            // Create: this.name = name;
            statements.push({
              kind: "expressionStatement",
              expression: {
                kind: "assignment",
                operator: "=",
                left: {
                  kind: "memberAccess",
                  object: { kind: "this" },
                  property: param.name.text,
                  isComputed: false,
                  isOptional: false,
                },
                right: {
                  kind: "identifier",
                  name: param.name.text,
                },
              },
            });
          }
        }
      }
    }

    // Add existing constructor body statements
    if (node.body) {
      const existingBody = convertBlockStatement(node.body, checker);
      statements.push(...existingBody.statements);
    }

    return {
      kind: "constructorDeclaration",
      parameters: convertParameters(node.parameters, checker),
      body: { kind: "blockStatement", statements },
      accessibility: getAccessibility(node),
    };
  }

  return null;
};

const convertInterfaceDeclaration = (
  node: ts.InterfaceDeclaration,
  checker: ts.TypeChecker
): IrInterfaceDeclaration => {
  const extendsTypes =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types.map((t) => convertType(t, checker)) ?? [];

  return {
    kind: "interfaceDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    extends: extendsTypes,
    members: node.members
      .map((m) => convertInterfaceMember(m, checker))
      .filter((m): m is IrInterfaceMember => m !== null),
    isExported: hasExportModifier(node),
  };
};

const convertInterfaceMember = (
  node: ts.TypeElement,
  checker: ts.TypeChecker
): IrInterfaceMember | null => {
  if (ts.isPropertySignature(node) && node.type) {
    return {
      kind: "propertySignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      type: convertType(node.type, checker),
      isOptional: !!node.questionToken,
      isReadonly: hasReadonlyModifier(node),
    };
  }

  if (ts.isMethodSignature(node)) {
    return {
      kind: "methodSignature",
      name:
        node.name && ts.isIdentifier(node.name) ? node.name.text : "[computed]",
      typeParameters: convertTypeParameters(node.typeParameters, checker),
      parameters: convertParameters(node.parameters, checker),
      returnType: node.type ? convertType(node.type, checker) : undefined,
    };
  }

  return null;
};

const convertEnumDeclaration = (
  node: ts.EnumDeclaration,
  checker: ts.TypeChecker
): IrEnumDeclaration => {
  return {
    kind: "enumDeclaration",
    name: node.name.text,
    members: node.members.map((m) => ({
      kind: "enumMember" as const,
      name: ts.isIdentifier(m.name) ? m.name.text : "[computed]",
      initializer: m.initializer
        ? convertExpression(m.initializer, checker)
        : undefined,
    })),
    isExported: hasExportModifier(node),
  };
};

const convertTypeAliasDeclaration = (
  node: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker
): IrTypeAliasDeclaration => {
  return {
    kind: "typeAliasDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    type: convertType(node.type, checker),
    isExported: hasExportModifier(node),
  };
};

const convertIfStatement = (
  node: ts.IfStatement,
  checker: ts.TypeChecker
): IrIfStatement => {
  const thenStmt = convertStatement(node.thenStatement, checker);
  const elseStmt = node.elseStatement
    ? convertStatement(node.elseStatement, checker)
    : undefined;

  return {
    kind: "ifStatement",
    condition: convertExpression(node.expression, checker),
    thenStatement: thenStmt ?? { kind: "emptyStatement" },
    elseStatement: elseStmt ?? undefined,
  };
};

const convertWhileStatement = (
  node: ts.WhileStatement,
  checker: ts.TypeChecker
): IrWhileStatement => {
  const body = convertStatement(node.statement, checker);
  return {
    kind: "whileStatement",
    condition: convertExpression(node.expression, checker),
    body: body ?? { kind: "emptyStatement" },
  };
};

const convertForStatement = (
  node: ts.ForStatement,
  checker: ts.TypeChecker
): IrForStatement => {
  const body = convertStatement(node.statement, checker);
  return {
    kind: "forStatement",
    initializer: node.initializer
      ? ts.isVariableDeclarationList(node.initializer)
        ? convertVariableDeclarationList(node.initializer, checker)
        : convertExpression(node.initializer, checker)
      : undefined,
    condition: node.condition
      ? convertExpression(node.condition, checker)
      : undefined,
    update: node.incrementor
      ? convertExpression(node.incrementor, checker)
      : undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};

const convertForOfStatement = (
  node: ts.ForOfStatement,
  checker: ts.TypeChecker
): IrForOfStatement => {
  const firstDecl = ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations[0]
    : undefined;

  const variable = ts.isVariableDeclarationList(node.initializer)
    ? convertBindingName(firstDecl?.name ?? ts.factory.createIdentifier("_"))
    : convertBindingName(node.initializer as ts.BindingName);

  const body = convertStatement(node.statement, checker);
  return {
    kind: "forOfStatement",
    variable,
    expression: convertExpression(node.expression, checker),
    body: body ?? { kind: "emptyStatement" },
  };
};

const convertForInStatement = (
  node: ts.ForInStatement,
  checker: ts.TypeChecker
): IrForStatement => {
  // Note: for...in needs special handling in C# - variable extraction will be handled in emitter
  // We'll need to extract the variable info in the emitter phase

  const body = convertStatement(node.statement, checker);
  // Note: for...in needs special handling in C#
  return {
    kind: "forStatement",
    initializer: undefined,
    condition: undefined,
    update: undefined,
    body: body ?? { kind: "emptyStatement" },
  };
};

const convertSwitchStatement = (
  node: ts.SwitchStatement,
  checker: ts.TypeChecker
): IrSwitchStatement => {
  return {
    kind: "switchStatement",
    expression: convertExpression(node.expression, checker),
    cases: node.caseBlock.clauses.map((clause) =>
      convertSwitchCase(clause, checker)
    ),
  };
};

const convertSwitchCase = (
  node: ts.CaseOrDefaultClause,
  checker: ts.TypeChecker
): IrSwitchCase => {
  return {
    kind: "switchCase",
    test: ts.isCaseClause(node)
      ? convertExpression(node.expression, checker)
      : undefined,
    statements: node.statements
      .map((s) => convertStatement(s, checker))
      .filter((s): s is IrStatement => s !== null),
  };
};

const convertTryStatement = (
  node: ts.TryStatement,
  checker: ts.TypeChecker
): IrTryStatement => {
  return {
    kind: "tryStatement",
    tryBlock: convertBlockStatement(node.tryBlock, checker),
    catchClause: node.catchClause
      ? convertCatchClause(node.catchClause, checker)
      : undefined,
    finallyBlock: node.finallyBlock
      ? convertBlockStatement(node.finallyBlock, checker)
      : undefined,
  };
};

const convertCatchClause = (
  node: ts.CatchClause,
  checker: ts.TypeChecker
): IrCatchClause => {
  return {
    kind: "catchClause",
    parameter: node.variableDeclaration
      ? convertBindingName(node.variableDeclaration.name)
      : undefined,
    body: convertBlockStatement(node.block, checker),
  };
};

export const convertBlockStatement = (
  node: ts.Block,
  checker: ts.TypeChecker
): IrBlockStatement => {
  return {
    kind: "blockStatement",
    statements: node.statements
      .map((s) => convertStatement(s, checker))
      .filter((s): s is IrStatement => s !== null),
  };
};

const convertVariableDeclarationList = (
  node: ts.VariableDeclarationList,
  checker: ts.TypeChecker
): IrVariableDeclaration => {
  const isConst = !!(node.flags & ts.NodeFlags.Const);
  const isLet = !!(node.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarations.map((decl) => ({
      kind: "variableDeclarator",
      name: convertBindingName(decl.name),
      type: decl.type ? convertType(decl.type, checker) : undefined,
      initializer: decl.initializer
        ? convertExpression(decl.initializer, checker)
        : undefined,
    })),
    isExported: false,
  };
};

export const convertParameters = (
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  checker: ts.TypeChecker
): readonly IrParameter[] => {
  return parameters.map((param) => ({
    kind: "parameter",
    pattern: convertBindingName(param.name),
    type: param.type ? convertType(param.type, checker) : undefined,
    initializer: param.initializer
      ? convertExpression(param.initializer, checker)
      : undefined,
    isOptional: !!param.questionToken,
    isRest: !!param.dotDotDotToken,
  }));
};

// Helper functions
const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

const hasStaticModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false
  );
};

const hasReadonlyModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false
  );
};

const getAccessibility = (node: ts.Node): IrAccessibility => {
  if (!ts.canHaveModifiers(node)) return "public";
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
    return "private";
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword))
    return "protected";
  return "public";
};
