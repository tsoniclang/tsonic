import { relative, basename, dirname, extname } from "node:path";
import {
  AsArrayLiteralExpression,
  AsArrayTypeNode,
  AsBinaryExpression,
  AsBlock,
  AsCallExpression,
  AsClassDeclaration,
  AsConditionalExpression,
  AsConstructorDeclaration,
  AsDoStatement,
  AsElementAccessExpression,
  AsExpressionStatement,
  AsForInOrOfStatement,
  AsForStatement,
  AsFunctionDeclaration,
  AsIdentifier,
  AsIfStatement,
  AsMethodDeclaration,
  AsNewExpression,
  AsNumericLiteral,
  AsParameterDeclaration,
  AsParenthesizedExpression,
  AsPropertyAccessExpression,
  AsPropertyDeclaration,
  AsPostfixUnaryExpression,
  AsPrefixUnaryExpression,
  AsReturnStatement,
  AsStringLiteral,
  AsVariableDeclaration,
  AsVariableDeclarationList,
  AsVariableStatement,
  AsWhileStatement,
  KindAmpersandAmpersandToken,
  KindAsteriskToken,
  KindBarBarToken,
  KindBinaryExpression,
  KindBlock,
  KindCallExpression,
  KindArrayLiteralExpression,
  KindArrayType,
  KindClassDeclaration,
  KindConditionalExpression,
  KindConstructor,
  KindDoStatement,
  KindElementAccessExpression,
  KindEqualsEqualsEqualsToken,
  KindEqualsEqualsToken,
  KindEqualsToken,
  KindExclamationEqualsEqualsToken,
  KindExclamationEqualsToken,
  KindExclamationToken,
  KindExportAssignment,
  KindExportDeclaration,
  KindExpressionStatement,
  KindFalseKeyword,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindGreaterThanEqualsToken,
  KindGreaterThanToken,
  KindIdentifier,
  KindIfStatement,
  KindImportDeclaration,
  KindInterfaceDeclaration,
  KindLessThanEqualsToken,
  KindLessThanToken,
  KindMethodDeclaration,
  KindMinusToken,
  KindMinusMinusToken,
  KindNewExpression,
  KindNullKeyword,
  KindNumericLiteral,
  KindParenthesizedExpression,
  KindPercentToken,
  KindPlusToken,
  KindPlusPlusToken,
  KindPropertyAccessExpression,
  KindPropertyDeclaration,
  KindPostfixUnaryExpression,
  KindPrefixUnaryExpression,
  KindQuestionQuestionToken,
  KindReturnStatement,
  KindSlashToken,
  KindString,
  KindStringLiteral,
  KindThisKeyword,
  KindTrueKeyword,
  KindTypeAliasDeclaration,
  KindVariableDeclarationList,
  KindVariableStatement,
  KindWhileStatement,
  Node_Text,
  SourceFile_FileName,
  TypeFlagsAny,
  TypeFlagsBigIntLike,
  TypeFlagsBooleanLike,
  TypeFlagsNever,
  TypeFlagsNumberLike,
  TypeFlagsStringLike,
  TypeFlagsUnknown,
  TypeFlagsVoidLike,
} from "@tsonic/tsts";
import type { Node, SourceFile, SourcePrimitiveFact } from "@tsonic/tsts";
import type { TargetArtifact, TargetCompileInput, TargetDiagnostic, TargetSourceFile } from "@tsonic/target-api";
import type {
  CsharpArgument,
  CsharpCompilationUnit,
  CsharpConstructorDeclaration,
  CsharpExpression,
  CsharpFieldDeclaration,
  CsharpForInitializer,
  CsharpClassDeclaration,
  CsharpLocalDeclaration,
  CsharpMethodDeclaration,
  CsharpParameter,
  CsharpStatement,
  CsharpTypeDeclaration,
  CsharpTypeMember,
  CsharpTypeNode,
} from "../ast/csharp-ast.js";
import { printCsharpCompilationUnit } from "../../print/csharp-printer.js";

export interface CsharpPlanningResult {
  readonly artifacts: readonly TargetArtifact[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export function planCsharpArtifacts(input: TargetCompileInput): CsharpPlanningResult {
  const diagnostics: TargetDiagnostic[] = [];
  const artifacts: TargetArtifact[] = [];
  const sourceArtifacts: TargetSourceFile[] = [];
  for (const sourceFile of input.sourceFiles) {
    const sourceArtifact = planSourceFile(sourceFile, input, diagnostics);
    if (sourceArtifact !== undefined) {
      sourceArtifacts.push(sourceArtifact);
    }
  }
  artifacts.push(projectArtifact(input, sourceArtifacts));
  artifacts.push(...sourceArtifacts);
  return {
    artifacts,
    diagnostics,
  };
}

function planSourceFile(
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): TargetSourceFile | undefined {
  const fileName = SourceFile_FileName(sourceFile);
  if (sourceFile.IsDeclarationFile || fileName.startsWith("tsts-provider://")) {
    return undefined;
  }
  const moduleClassName = sourceFileClassName(input, fileName);
  const members: CsharpTypeMember[] = [];
  const namespaceMembers: CsharpTypeDeclaration[] = [];
  const topLevelStatements: CsharpStatement[] = [];
  for (const statement of sourceFile.Statements?.Nodes ?? []) {
    if (statement === undefined) {
      continue;
    }
    switch (statement.Kind) {
      case KindImportDeclaration:
      case KindExportDeclaration:
      case KindExportAssignment:
      case KindInterfaceDeclaration:
      case KindTypeAliasDeclaration:
        continue;
      case KindFunctionDeclaration:
        members.push(planFunctionDeclaration(statement, sourceFile, input, diagnostics));
        break;
      case KindClassDeclaration:
        namespaceMembers.push(planClassDeclaration(statement, sourceFile, input, diagnostics));
        break;
      case KindExpressionStatement:
      case KindVariableStatement:
      case KindIfStatement:
      case KindWhileStatement:
      case KindReturnStatement:
        topLevelStatements.push(...planStatements(statement, sourceFile, input, diagnostics));
        break;
      default:
        diagnostics.push(unsupportedNodeDiagnostic(statement, "Top-level statement is outside the current C# planning surface."));
        break;
    }
  }
  if (topLevelStatements.length > 0) {
    members.unshift({
      kind: "method",
      name: "Main",
      modifiers: ["public", "static"],
      returnType: predefined("void"),
      parameters: [],
      body: { statements: topLevelStatements },
    });
  }
  if (members.length > 0) {
    namespaceMembers.unshift({
      kind: "class",
      name: moduleClassName,
      modifiers: ["public", "static"],
      members,
    });
  }
  if (namespaceMembers.length === 0) {
    return undefined;
  }
  const unit: CsharpCompilationUnit = {
    usings: [{ namespace: "System" }],
    members: [{
      kind: "namespace",
      name: readNamespace(input),
      members: namespaceMembers,
    }],
  };
  return {
    kind: "source",
    language: "csharp",
    path: sourceFileArtifactPath(input, fileName, moduleClassName),
    text: printCsharpCompilationUnit(unit),
  };
}

function planClassDeclaration(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpClassDeclaration {
  const declaration = AsClassDeclaration(node)!;
  return {
    kind: "class",
    name: sanitizeIdentifier(declaration.name === undefined ? "AnonymousClass" : Node_Text(declaration.name)),
    modifiers: ["public"],
    members: (declaration.Members?.Nodes ?? []).flatMap((member): CsharpTypeMember[] => {
      if (member === undefined) {
        return [];
      }
      switch (member.Kind) {
        case KindConstructor:
          return [planConstructorDeclaration(member, declaration.name === undefined ? "AnonymousClass" : Node_Text(declaration.name), sourceFile, input, diagnostics)];
        case KindMethodDeclaration:
          return [planMethodDeclaration(member, sourceFile, input, diagnostics)];
        case KindPropertyDeclaration:
          return [planPropertyDeclaration(member, sourceFile, input, diagnostics)];
        default:
          diagnostics.push(unsupportedNodeDiagnostic(member, "Class member is outside the current C# planning surface."));
          return [];
      }
    }),
  };
}

function planConstructorDeclaration(
  node: Node,
  className: string,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpConstructorDeclaration {
  const declaration = AsConstructorDeclaration(node)!;
  return {
    kind: "constructor",
    name: sanitizeIdentifier(className),
    modifiers: ["public"],
    parameters: planParameters(declaration.Parameters?.Nodes ?? [], sourceFile, input),
    body: {
      statements: planBlockStatements(declaration.Body, sourceFile, input, diagnostics),
    },
  };
}

function planMethodDeclaration(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpMethodDeclaration {
  const declaration = AsMethodDeclaration(node)!;
  return {
    kind: "method",
    name: sanitizeIdentifier(declaration.name === undefined ? "method" : Node_Text(declaration.name)),
    modifiers: ["public"],
    returnType: getCsharpTypeForNode(declaration.Type, sourceFile, input, predefined("void")),
    parameters: planParameters(declaration.Parameters?.Nodes ?? [], sourceFile, input),
    body: {
      statements: planBlockStatements(declaration.Body, sourceFile, input, diagnostics),
    },
  };
}

function planPropertyDeclaration(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpFieldDeclaration {
  const declaration = AsPropertyDeclaration(node)!;
  return {
    kind: "field",
    name: sanitizeIdentifier(declaration.name === undefined ? "field" : Node_Text(declaration.name)),
    modifiers: ["public"],
    type: getCsharpTypeForNode(declaration.Type ?? declaration.name, sourceFile, input),
    ...(declaration.Initializer !== undefined
      ? { initializer: planExpression(declaration.Initializer, sourceFile, input, diagnostics) }
      : {}),
  };
}

function planFunctionDeclaration(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpMethodDeclaration {
  const declaration = AsFunctionDeclaration(node)!;
  const name = declaration.name === undefined ? "__anonymous" : sanitizeIdentifier(Node_Text(declaration.name));
  return {
    kind: "method",
    name,
    modifiers: ["public", "static"],
    returnType: getCsharpTypeForNode(declaration.Type, sourceFile, input, predefined("void")),
    parameters: planParameters(declaration.Parameters?.Nodes ?? [], sourceFile, input),
    body: {
      statements: planBlockStatements(declaration.Body, sourceFile, input, diagnostics),
    },
  };
}

function planParameters(
  parameterNodes: readonly (Node | undefined)[],
  sourceFile: SourceFile,
  input: TargetCompileInput,
): readonly CsharpParameter[] {
  return parameterNodes.map((parameterNode) => {
    const parameter = AsParameterDeclaration(parameterNode)!;
    return {
      name: sanitizeIdentifier(parameter.name === undefined ? "arg" : Node_Text(parameter.name)),
      type: getCsharpTypeForNode(parameter.Type ?? parameter.name, sourceFile, input),
    };
  });
}

function planBlockStatements(
  blockNode: Node | undefined,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): readonly CsharpStatement[] {
  if (blockNode === undefined) {
    return [];
  }
  const block = AsBlock(blockNode)!;
  return (block.Statements?.Nodes ?? []).flatMap((statement) =>
    statement === undefined ? [] : planStatements(statement, sourceFile, input, diagnostics));
}

function planStatements(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): readonly CsharpStatement[] {
  switch (node.Kind) {
    case KindBlock:
      return [{
        kind: "block",
        body: {
          statements: planBlockStatements(node, sourceFile, input, diagnostics),
        },
      }];
    case KindReturnStatement: {
      const statement = AsReturnStatement(node)!;
      return [{
        kind: "return",
        ...(statement.Expression !== undefined
          ? { expression: planExpression(statement.Expression, sourceFile, input, diagnostics) }
          : {}),
      }];
    }
    case KindExpressionStatement:
      return [expressionStatement(planExpression(AsExpressionStatement(node)!.Expression!, sourceFile, input, diagnostics))];
    case KindIfStatement: {
      const statement = AsIfStatement(node)!;
      return [{
        kind: "if",
        condition: planExpression(statement.Expression!, sourceFile, input, diagnostics),
        thenBody: {
          statements: planNestedStatementBody(statement.ThenStatement, sourceFile, input, diagnostics),
        },
        ...(statement.ElseStatement !== undefined
          ? { elseBody: { statements: planNestedStatementBody(statement.ElseStatement, sourceFile, input, diagnostics) } }
          : {}),
      }];
    }
    case KindWhileStatement: {
      const statement = AsWhileStatement(node)!;
      return [{
        kind: "while",
        condition: planExpression(statement.Expression!, sourceFile, input, diagnostics),
        body: {
          statements: planNestedStatementBody(statement.Statement, sourceFile, input, diagnostics),
        },
      }];
    }
    case KindDoStatement: {
      const statement = AsDoStatement(node)!;
      return [{
        kind: "do",
        body: {
          statements: planNestedStatementBody(statement.Statement, sourceFile, input, diagnostics),
        },
        condition: planExpression(statement.Expression!, sourceFile, input, diagnostics),
      }];
    }
    case KindForStatement: {
      const statement = AsForStatement(node)!;
      return [{
        kind: "for",
        ...(statement.Initializer !== undefined
          ? { initializer: planForInitializer(statement.Initializer, sourceFile, input, diagnostics) }
          : {}),
        ...(statement.Condition !== undefined
          ? { condition: planExpression(statement.Condition, sourceFile, input, diagnostics) }
          : {}),
        ...(statement.Incrementor !== undefined
          ? { incrementor: planExpression(statement.Incrementor, sourceFile, input, diagnostics) }
          : {}),
        body: {
          statements: planNestedStatementBody(statement.Statement, sourceFile, input, diagnostics),
        },
      }];
    }
    case KindForInStatement:
    case KindForOfStatement: {
      AsForInOrOfStatement(node);
      diagnostics.push(unsupportedNodeDiagnostic(node, "For-in/for-of requires target collection iteration semantics and is not implemented yet."));
      return [expressionStatement({ kind: "identifier", name: "__unsupported" })];
    }
    case KindVariableStatement: {
      const declarationList = AsVariableStatement(node)!.DeclarationList;
      const declarations = AsVariableDeclarationList(declarationList)!.Declarations?.Nodes ?? [];
      if (declarations.length === 0) {
        diagnostics.push(unsupportedNodeDiagnostic(node, "Variable statement has no declaration."));
        return [expressionStatement({ kind: "identifier", name: "__unsupported" })];
      }
      return declarations
        .filter((declaration): declaration is Node => declaration !== undefined)
        .map((declaration) => ({
            kind: "local",
            ...planLocalDeclaration(declaration, sourceFile, input, diagnostics),
        }));
    }
    default:
      diagnostics.push(unsupportedNodeDiagnostic(node, "Statement is outside the current C# planning surface."));
      return [expressionStatement({ kind: "identifier", name: "__unsupported" })];
  }
}

function planForInitializer(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpForInitializer {
  if (node.Kind === KindVariableDeclarationList) {
    const declarations = AsVariableDeclarationList(node)!.Declarations?.Nodes ?? [];
    const locals = declarations
      .filter((declaration): declaration is Node => declaration !== undefined)
      .map((declaration) => planLocalDeclaration(declaration, sourceFile, input, diagnostics));
    const first = locals[0];
    if (first !== undefined && locals.some((local) => !sameCsharpType(local.type, first.type))) {
      diagnostics.push(unsupportedNodeDiagnostic(node, "C# for-initializer cannot represent mixed local declaration types without statement rewriting."));
    }
    return {
      kind: "locals",
      locals,
    };
  }
  return {
    kind: "expression",
    expression: planExpression(node, sourceFile, input, diagnostics),
  };
}

function planLocalDeclaration(
  declarationNode: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpLocalDeclaration {
  const variable = AsVariableDeclaration(declarationNode)!;
  return {
    name: sanitizeIdentifier(variable.name === undefined ? "local" : Node_Text(variable.name)),
    type: getCsharpTypeForNode(variable.Type ?? variable.name, sourceFile, input),
    ...(variable.Initializer !== undefined
      ? { initializer: planExpression(variable.Initializer, sourceFile, input, diagnostics) }
      : {}),
  };
}

function planNestedStatementBody(
  node: Node | undefined,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): readonly CsharpStatement[] {
  if (node === undefined) {
    return [];
  }
  if (node.Kind === KindBlock) {
    return planBlockStatements(node, sourceFile, input, diagnostics);
  }
  return planStatements(node, sourceFile, input, diagnostics);
}

function planExpression(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpExpression {
  switch (node.Kind) {
    case KindIdentifier:
      return { kind: "identifier", name: sanitizeIdentifier(AsIdentifier(node)!.Text) };
    case KindStringLiteral:
      return { kind: "literal", value: AsStringLiteral(node)!.Text };
    case KindNumericLiteral:
      return { kind: "literal", value: Number(AsNumericLiteral(node)!.Text) };
    case KindTrueKeyword:
      return { kind: "literal", value: true };
    case KindFalseKeyword:
      return { kind: "literal", value: false };
    case KindNullKeyword:
      return { kind: "literal", value: null };
    case KindThisKeyword:
      return { kind: "identifier", name: "this" };
    case KindParenthesizedExpression: {
      const expression = AsParenthesizedExpression(node)!;
      return {
        kind: "parenthesized",
        expression: planExpression(expression.Expression!, sourceFile, input, diagnostics),
      };
    }
    case KindArrayLiteralExpression: {
      const expression = AsArrayLiteralExpression(node)!;
      return {
        kind: "array",
        elements: (expression.Elements?.Nodes ?? [])
          .filter((element): element is Node => element !== undefined)
          .map((element) => planExpression(element, sourceFile, input, diagnostics)),
      };
    }
    case KindPropertyAccessExpression: {
      const expression = AsPropertyAccessExpression(node)!;
      return {
        kind: "member",
        receiver: planExpression(expression.Expression!, sourceFile, input, diagnostics),
        name: sanitizeIdentifier(Node_Text(expression.name!)),
      };
    }
    case KindElementAccessExpression: {
      const expression = AsElementAccessExpression(node)!;
      return {
        kind: "element",
        receiver: planExpression(expression.Expression!, sourceFile, input, diagnostics),
        argument: planExpression(expression.ArgumentExpression!, sourceFile, input, diagnostics),
      };
    }
    case KindCallExpression: {
      const expression = AsCallExpression(node)!;
      return {
        kind: "call",
        callee: planExpression(expression.Expression!, sourceFile, input, diagnostics),
        arguments: (expression.Arguments?.Nodes ?? []).map((argument): CsharpArgument => ({
          expression: planExpression(argument!, sourceFile, input, diagnostics),
        })),
      };
    }
    case KindNewExpression: {
      const expression = AsNewExpression(node)!;
      return {
        kind: "new",
        type: expressionToCsharpType(expression.Expression, sourceFile, input),
        arguments: (expression.Arguments?.Nodes ?? []).map((argument): CsharpArgument => ({
          expression: planExpression(argument!, sourceFile, input, diagnostics),
        })),
      };
    }
    case KindConditionalExpression: {
      const expression = AsConditionalExpression(node)!;
      return {
        kind: "conditional",
        condition: planExpression(expression.Condition!, sourceFile, input, diagnostics),
        whenTrue: planExpression(expression.WhenTrue!, sourceFile, input, diagnostics),
        whenFalse: planExpression(expression.WhenFalse!, sourceFile, input, diagnostics),
      };
    }
    case KindPrefixUnaryExpression: {
      const expression = AsPrefixUnaryExpression(node)!;
      const operator = getCsharpPrefixUnaryOperator(expression.Operator);
      if (operator === undefined) {
        diagnostics.push(unsupportedNodeDiagnostic(node, "Prefix unary operator is outside the current C# planning surface."));
        return { kind: "identifier", name: "__unsupported" };
      }
      return {
        kind: "prefixUnary",
        operator,
        operand: planExpression(expression.Operand!, sourceFile, input, diagnostics),
      };
    }
    case KindPostfixUnaryExpression: {
      const expression = AsPostfixUnaryExpression(node)!;
      const operator = getCsharpPostfixUnaryOperator(expression.Operator);
      if (operator === undefined) {
        diagnostics.push(unsupportedNodeDiagnostic(node, "Postfix unary operator is outside the current C# planning surface."));
        return { kind: "identifier", name: "__unsupported" };
      }
      return {
        kind: "postfixUnary",
        operand: planExpression(expression.Operand!, sourceFile, input, diagnostics),
        operator,
      };
    }
    default: {
      const binary = tryPlanBinaryExpression(node, sourceFile, input, diagnostics);
      if (binary !== undefined) {
        return binary;
      }
      diagnostics.push(unsupportedNodeDiagnostic(node, "Expression is outside the current C# planning surface."));
      return { kind: "identifier", name: "__unsupported" };
    }
  }
}

function tryPlanBinaryExpression(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpExpression | undefined {
  const operator = getCsharpBinaryOperator(node);
  if (operator === undefined) {
    return undefined;
  }
  const expression = AsBinaryExpression(node)!;
  return {
    kind: "binary",
    left: planExpression(expression.Left!, sourceFile, input, diagnostics),
    operator,
    right: planExpression(expression.Right!, sourceFile, input, diagnostics),
  };
}

function getCsharpBinaryOperator(node: Node): string | undefined {
  if (node.Kind === KindBinaryExpression) {
    const operatorKind = AsBinaryExpression(node)!.OperatorToken?.Kind;
    switch (operatorKind) {
      case KindPlusToken:
        return "+";
      case KindMinusToken:
        return "-";
      case KindAsteriskToken:
        return "*";
      case KindSlashToken:
        return "/";
      case KindPercentToken:
        return "%";
      case KindQuestionQuestionToken:
        return "??";
      case KindEqualsToken:
        return "=";
      case KindEqualsEqualsToken:
      case KindEqualsEqualsEqualsToken:
        return "==";
      case KindExclamationEqualsToken:
      case KindExclamationEqualsEqualsToken:
        return "!=";
      case KindLessThanToken:
        return "<";
      case KindLessThanEqualsToken:
        return "<=";
      case KindGreaterThanToken:
        return ">";
      case KindGreaterThanEqualsToken:
        return ">=";
      case KindAmpersandAmpersandToken:
        return "&&";
      case KindBarBarToken:
        return "||";
      default:
        return undefined;
    }
  }
  return undefined;
}

function getCsharpPrefixUnaryOperator(kind: number): string | undefined {
  switch (kind) {
    case KindPlusToken:
      return "+";
    case KindMinusToken:
      return "-";
    case KindExclamationToken:
      return "!";
    case KindPlusPlusToken:
      return "++";
    case KindMinusMinusToken:
      return "--";
    default:
      return undefined;
  }
}

function getCsharpPostfixUnaryOperator(kind: number): string | undefined {
  switch (kind) {
    case KindPlusPlusToken:
      return "++";
    case KindMinusMinusToken:
      return "--";
    default:
      return undefined;
  }
}

function expressionToCsharpType(
  node: Node | undefined,
  sourceFile: SourceFile,
  input: TargetCompileInput,
): CsharpTypeNode {
  if (node === undefined) {
    return predefined("object");
  }
  switch (node.Kind) {
    case KindIdentifier:
      return { kind: "named", name: sanitizeIdentifier(AsIdentifier(node)!.Text) };
    case KindPropertyAccessExpression: {
      const expression = AsPropertyAccessExpression(node)!;
      const receiver = expressionToCsharpType(expression.Expression, sourceFile, input);
      const name = sanitizeIdentifier(Node_Text(expression.name!));
      return { kind: "qualified", left: receiver, name };
    }
    default:
      return getCsharpTypeForNode(node, sourceFile, input);
  }
}

function getCsharpTypeForNode(
  node: Node | undefined,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  fallback: CsharpTypeNode = predefined("object"),
): CsharpTypeNode {
  if (node === undefined) {
    return fallback;
  }
  if (node.Kind === KindArrayType) {
    const arrayType = AsArrayTypeNode(node)!;
    return {
      kind: "array",
      elementType: getCsharpTypeForNode(arrayType.ElementType, sourceFile, input),
    };
  }
  const sourcePrimitive = input.facts.getSourcePrimitiveFact(node);
  if (sourcePrimitive !== undefined) {
    return getCsharpTypeForSourcePrimitive(sourcePrimitive);
  }
  const type = input.checker.getTypeAtLocation(node, { sourceFile });
  if (type === undefined) {
    return fallback;
  }
  const typeText = input.checker.typeToString(type, { sourceFile });
  if (typeText === "void") {
    return predefined("void");
  }
  if ((type.flags & TypeFlagsStringLike) !== 0) {
    return predefined("string");
  }
  if ((type.flags & TypeFlagsBooleanLike) !== 0) {
    return predefined("bool");
  }
  if ((type.flags & TypeFlagsBigIntLike) !== 0) {
    return predefined("long");
  }
  if ((type.flags & TypeFlagsNumberLike) !== 0) {
    return predefined("double");
  }
  if ((type.flags & TypeFlagsVoidLike) !== 0) {
    return predefined("void");
  }
  if ((type.flags & (TypeFlagsAny | TypeFlagsUnknown | TypeFlagsNever)) !== 0) {
    return predefined("object");
  }
  return fallback;
}

function getCsharpTypeForSourcePrimitive(fact: SourcePrimitiveFact): CsharpTypeNode {
  switch (fact.kind) {
    case "bool":
      return predefined("bool");
    case "char":
      return predefined("char");
    case "int8":
      return predefined("sbyte");
    case "uint8":
      return predefined("byte");
    case "int16":
      return predefined("short");
    case "uint16":
      return predefined("ushort");
    case "int32":
      return predefined("int");
    case "uint32":
      return predefined("uint");
    case "int64":
      return predefined("long");
    case "uint64":
      return predefined("ulong");
    case "native-int":
      return predefined("nint");
    case "native-uint":
      return predefined("nuint");
    case "float16":
      return { kind: "named", name: "Half" };
    case "float32":
      return predefined("float");
    case "float64":
      return predefined("double");
    case "decimal":
      return predefined("decimal");
    case "int128":
      return { kind: "named", name: "Int128" };
    case "uint128":
      return { kind: "named", name: "UInt128" };
  }
}

function sameCsharpType(left: CsharpTypeNode, right: CsharpTypeNode): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case "predefined":
      return right.kind === "predefined" && left.name === right.name;
    case "named": {
      if (right.kind !== "named" || left.name !== right.name) {
        return false;
      }
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = right.typeArguments ?? [];
      return leftArgs.length === rightArgs.length && leftArgs.every((arg, index) => sameCsharpType(arg, rightArgs[index]!));
    }
    case "qualified": {
      if (right.kind !== "qualified" || left.name !== right.name || !sameCsharpType(left.left, right.left)) {
        return false;
      }
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = right.typeArguments ?? [];
      return leftArgs.length === rightArgs.length && leftArgs.every((arg, index) => sameCsharpType(arg, rightArgs[index]!));
    }
    case "array":
      return right.kind === "array" && (left.rank ?? 1) === (right.rank ?? 1) && sameCsharpType(left.elementType, right.elementType);
  }
}

function projectArtifact(input: TargetCompileInput, sourceArtifacts: readonly TargetSourceFile[]): TargetArtifact {
  void sourceArtifacts;
  const properties = csharpProjectProperties(input);
  return {
    kind: "project",
    path: `${readAssemblyName(input)}.csproj`,
    text: [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      ...properties.map(([name, value]) => `    <${name}>${escapeXml(value)}</${name}>`),
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
  };
}

function csharpProjectProperties(input: TargetCompileInput): readonly (readonly [string, string])[] {
  const properties = new Map<string, string>();
  properties.set("TargetFramework", readStringOption(input, "targetFramework", "net10.0"));
  properties.set("Nullable", readStringOption(input, "nullable", "enable"));
  properties.set("ImplicitUsings", readStringOption(input, "implicitUsings", "disable"));
  const outputType = readOptionalStringOption(input, "outputType");
  if (outputType !== undefined) {
    properties.set("OutputType", outputType);
  }
  const publishAot = readOptionalBooleanOption(input, "publishAot");
  if (publishAot !== undefined) {
    properties.set("PublishAot", publishAot ? "true" : "false");
  }
  const customProperties = input.target.options?.properties;
  if (customProperties !== undefined) {
    if (!isRecord(customProperties)) {
      throw new Error("C# target option 'properties' must be an object.");
    }
    for (const [name, value] of Object.entries(customProperties)) {
      if (!isXmlElementName(name)) {
        throw new Error(`C# target property '${name}' is not a valid XML element name.`);
      }
      if (!isScalarPropertyValue(value)) {
        throw new Error(`C# target property '${name}' must be a string, number, or boolean.`);
      }
      properties.set(name, String(value));
    }
  }
  return [...properties.entries()];
}

function readNamespace(input: TargetCompileInput): string {
  const value = input.target.options?.namespace;
  return typeof value === "string" && value.length > 0 ? value : "Tsonic.Generated";
}

function readAssemblyName(input: TargetCompileInput): string {
  const value = input.target.options?.assemblyName;
  return sanitizeIdentifier(typeof value === "string" && value.length > 0 ? value : "TsonicGenerated");
}

function readStringOption(input: TargetCompileInput, key: string, fallback: string): string {
  return readOptionalStringOption(input, key) ?? fallback;
}

function readOptionalStringOption(input: TargetCompileInput, key: string): string | undefined {
  const value = input.target.options?.[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`C# target option '${key}' must be a non-empty string.`);
  }
  return value;
}

function readOptionalBooleanOption(input: TargetCompileInput, key: string): boolean | undefined {
  const value = input.target.options?.[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`C# target option '${key}' must be a boolean.`);
  }
  return value;
}

function sourceFileClassName(input: TargetCompileInput, fileName: string): string {
  const relativeName = projectRelativeSourcePath(input, fileName);
  const withoutExtension = relativeName.slice(0, relativeName.length - extname(relativeName).length);
  const text = withoutExtension.length === 0 ? "Module" : withoutExtension;
  return toPascalCase(text);
}

function sourceFileArtifactPath(input: TargetCompileInput, fileName: string, className: string): string {
  const relativeName = projectRelativeSourcePath(input, fileName);
  const directory = dirname(relativeName).split(/[\\/]+/).filter((part) => part.length > 0 && part !== ".");
  return ["src", ...directory.map(sanitizePathSegment), `${className}.cs`].join("/");
}

function projectRelativeSourcePath(input: TargetCompileInput, fileName: string): string {
  const relativeName = relative(input.paths.projectRoot, fileName);
  if (relativeName.length === 0 || relativeName.startsWith("..")) {
    return basename(fileName);
  }
  return relativeName;
}

function sanitizePathSegment(value: string): string {
  return sanitizeIdentifier(value).replace(/^_+$/, "_");
}

function toPascalCase(value: string): string {
  const words = value.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0);
  const name = words.map((word) => `${word[0]!.toUpperCase()}${word.slice(1)}`).join("");
  return sanitizeIdentifier(name.length === 0 ? "Module" : name);
}

function sanitizeIdentifier(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_");
  if (sanitized.length === 0) {
    return "_";
  }
  return /^[A-Za-z_]/.test(sanitized) ? sanitized : `_${sanitized}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isXmlElementName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalarPropertyValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function predefined(name: string): CsharpTypeNode {
  return { kind: "predefined", name };
}

function expressionStatement(expression: CsharpExpression): CsharpStatement {
  return {
    kind: "expression",
    expression,
  };
}

function unsupportedNodeDiagnostic(node: Node, message: string): TargetDiagnostic {
  return {
    code: "CSHARP_UNSUPPORTED_AST",
    category: "error",
    source: "tsonic-csharp",
    message: `${message} Node kind: ${KindString(node.Kind)}.`,
  };
}
