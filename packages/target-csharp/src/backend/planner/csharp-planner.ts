import { relative, basename, extname } from "node:path";
import {
  AsBinaryExpression,
  AsBlock,
  AsCallExpression,
  AsClassDeclaration,
  AsExpressionStatement,
  AsFunctionDeclaration,
  AsIdentifier,
  AsIfStatement,
  AsMethodDeclaration,
  AsNumericLiteral,
  AsParameterDeclaration,
  AsPropertyAccessExpression,
  AsPropertyDeclaration,
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
  KindClassDeclaration,
  KindEqualsEqualsEqualsToken,
  KindEqualsEqualsToken,
  KindEqualsToken,
  KindExclamationEqualsEqualsToken,
  KindExclamationEqualsToken,
  KindExportAssignment,
  KindExportDeclaration,
  KindExpressionStatement,
  KindFalseKeyword,
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
  KindNullKeyword,
  KindNumericLiteral,
  KindPlusToken,
  KindPropertyAccessExpression,
  KindPropertyDeclaration,
  KindReturnStatement,
  KindSlashToken,
  KindString,
  KindStringLiteral,
  KindThisKeyword,
  KindTrueKeyword,
  KindTypeAliasDeclaration,
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
  CsharpExpression,
  CsharpFieldDeclaration,
  CsharpClassDeclaration,
  CsharpMethodDeclaration,
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
        topLevelStatements.push(planStatement(statement, sourceFile, input, diagnostics));
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
      name: sourceFileClassName(fileName),
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
    path: `src/${sourceFileClassName(fileName)}.cs`,
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

function planMethodDeclaration(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpMethodDeclaration {
  const declaration = AsMethodDeclaration(node)!;
  const parameters = (declaration.Parameters?.Nodes ?? []).map((parameterNode) => {
    const parameter = AsParameterDeclaration(parameterNode)!;
    return {
      name: sanitizeIdentifier(parameter.name === undefined ? "arg" : Node_Text(parameter.name)),
      type: getCsharpTypeForNode(parameter.Type ?? parameter.name, sourceFile, input),
    };
  });
  return {
    kind: "method",
    name: sanitizeIdentifier(declaration.name === undefined ? "method" : Node_Text(declaration.name)),
    modifiers: ["public"],
    returnType: getCsharpTypeForNode(declaration.Type, sourceFile, input, predefined("void")),
    parameters,
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
  const parameters = (declaration.Parameters?.Nodes ?? []).map((parameterNode) => {
    const parameter = AsParameterDeclaration(parameterNode)!;
    return {
      name: sanitizeIdentifier(parameter.name === undefined ? "arg" : Node_Text(parameter.name)),
      type: getCsharpTypeForNode(parameter.Type ?? parameter.name, sourceFile, input),
    };
  });
  return {
    kind: "method",
    name,
    modifiers: ["public", "static"],
    returnType: getCsharpTypeForNode(declaration.Type, sourceFile, input, predefined("void")),
    parameters,
    body: {
      statements: planBlockStatements(declaration.Body, sourceFile, input, diagnostics),
    },
  };
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
    statement === undefined ? [] : [planStatement(statement, sourceFile, input, diagnostics)]);
}

function planStatement(
  node: Node,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  diagnostics: TargetDiagnostic[],
): CsharpStatement {
  switch (node.Kind) {
    case KindReturnStatement: {
      const statement = AsReturnStatement(node)!;
      return {
        kind: "return",
        ...(statement.Expression !== undefined
          ? { expression: planExpression(statement.Expression, sourceFile, input, diagnostics) }
          : {}),
      };
    }
    case KindExpressionStatement:
      return expressionStatement(planExpression(AsExpressionStatement(node)!.Expression!, sourceFile, input, diagnostics));
    case KindIfStatement: {
      const statement = AsIfStatement(node)!;
      return {
        kind: "if",
        condition: planExpression(statement.Expression!, sourceFile, input, diagnostics),
        thenBody: {
          statements: planNestedStatementBody(statement.ThenStatement, sourceFile, input, diagnostics),
        },
        ...(statement.ElseStatement !== undefined
          ? { elseBody: { statements: planNestedStatementBody(statement.ElseStatement, sourceFile, input, diagnostics) } }
          : {}),
      };
    }
    case KindWhileStatement: {
      const statement = AsWhileStatement(node)!;
      return {
        kind: "while",
        condition: planExpression(statement.Expression!, sourceFile, input, diagnostics),
        body: {
          statements: planNestedStatementBody(statement.Statement, sourceFile, input, diagnostics),
        },
      };
    }
    case KindVariableStatement: {
      const declarationList = AsVariableStatement(node)!.DeclarationList;
      const declaration = AsVariableDeclarationList(declarationList)!.Declarations?.Nodes?.[0];
      if (declaration === undefined) {
        diagnostics.push(unsupportedNodeDiagnostic(node, "Variable statement has no declaration."));
        return expressionStatement({ kind: "identifier", name: "__unsupported" });
      }
      const variable = AsVariableDeclaration(declaration)!;
      return {
        kind: "local",
        name: sanitizeIdentifier(variable.name === undefined ? "local" : Node_Text(variable.name)),
        type: getCsharpTypeForNode(variable.Type ?? variable.name, sourceFile, input),
        ...(variable.Initializer !== undefined
          ? { initializer: planExpression(variable.Initializer, sourceFile, input, diagnostics) }
          : {}),
      };
    }
    default:
      diagnostics.push(unsupportedNodeDiagnostic(node, "Statement is outside the current C# planning surface."));
      return expressionStatement({ kind: "identifier", name: "__unsupported" });
  }
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
  return [planStatement(node, sourceFile, input, diagnostics)];
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
    case KindPropertyAccessExpression: {
      const expression = AsPropertyAccessExpression(node)!;
      return {
        kind: "member",
        receiver: planExpression(expression.Expression!, sourceFile, input, diagnostics),
        name: sanitizeIdentifier(Node_Text(expression.name!)),
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

function getCsharpTypeForNode(
  node: Node | undefined,
  sourceFile: SourceFile,
  input: TargetCompileInput,
  fallback: CsharpTypeNode = predefined("object"),
): CsharpTypeNode {
  if (node === undefined) {
    return fallback;
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

function projectArtifact(input: TargetCompileInput, sourceArtifacts: readonly TargetSourceFile[]): TargetArtifact {
  void sourceArtifacts;
  return {
    kind: "project",
    path: `${readAssemblyName(input)}.csproj`,
    text: [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <Nullable>enable</Nullable>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
  };
}

function readNamespace(input: TargetCompileInput): string {
  const value = input.target.options?.namespace;
  return typeof value === "string" && value.length > 0 ? value : "Tsonic.Generated";
}

function readAssemblyName(input: TargetCompileInput): string {
  const value = input.target.options?.assemblyName;
  return sanitizeIdentifier(typeof value === "string" && value.length > 0 ? value : "TsonicGenerated");
}

function sourceFileClassName(fileName: string): string {
  const relativeName = relative(".", fileName);
  const base = basename(relativeName, extname(relativeName));
  const text = base.length === 0 ? "Module" : base;
  return toPascalCase(text);
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
