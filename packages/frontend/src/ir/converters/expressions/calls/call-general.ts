/**
 * General call expression converter
 *
 * Two-pass argument resolution with generic type inference.
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 */

import * as fs from "node:fs";
import * as ts from "typescript";
import type { MemberBinding } from "../../../../program/binding-types.js";
import {
  IrCallExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "../../../types.js";
import {
  getSourceSpan,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "../helpers.js";
import { convertExpression } from "../../../expression-converter.js";
import { IrParameter, IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import {
  buildResolvedRestParameter,
  expandParameterTypesForArguments,
} from "../../../type-system/type-system-call-resolution.js";
import {
  type CallSiteArgModifier,
  deriveSubstitutionsFromExpectedReturn,
  substituteTypeParameters,
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
  extractArgumentPassingFromBinding,
} from "./call-site-analysis.js";
import { narrowTypeByArrayShape } from "../../array-type-guards.js";
import {
  chooseCallableCandidate,
  collectResolutionArguments,
  isArrayIsArrayCall,
} from "./call-resolution.js";
import { tryConvertIntrinsicCall } from "./call-intrinsics.js";

const stripParentheses = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const getEnclosingClassSuperType = (
  node: ts.CallExpression,
  ctx: ProgramContext
): IrType | undefined => {
  if (node.expression.kind !== ts.SyntaxKind.SuperKeyword) {
    return undefined;
  }

  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const superClass = current.heritageClauses?.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      )?.types[0];
      if (!superClass) {
        return undefined;
      }

      return ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(superClass as unknown as ts.TypeNode)
      );
    }

    current = current.parent;
  }

  return undefined;
};

type SourceTopLevelSymbolKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "variable";

type SourceTopLevelSymbol = {
  readonly name: string;
  readonly kind: SourceTopLevelSymbolKind;
  readonly node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
    | ts.VariableDeclaration;
};

type SourceExportedTopLevelSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: SourceTopLevelSymbolKind;
  readonly node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
    | ts.VariableDeclaration;
};

const isExportedTopLevelStatement = (statement: ts.Statement): boolean =>
  !!(ts.canHaveModifiers(statement)
    ? ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    : false);

const collectTopLevelSymbols = (
  sourceFile: ts.SourceFile
): ReadonlyMap<string, SourceTopLevelSymbol> => {
  const symbols = new Map<string, SourceTopLevelSymbol>();

  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "class",
        node: statement,
      });
      continue;
    }

    if (ts.isEnumDeclaration(statement) && statement.name.text) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "enum",
        node: statement,
      });
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name?.text) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "function",
        node: statement,
      });
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) && statement.name.text) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "interface",
        node: statement,
      });
      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      symbols.set(declaration.name.text, {
        name: declaration.name.text,
        kind: "variable",
        node: declaration,
      });
    }
  }

  return symbols;
};

const collectExportedTopLevelSymbols = (
  sourceFile: ts.SourceFile
): readonly SourceExportedTopLevelSymbol[] => {
  const topLevel = collectTopLevelSymbols(sourceFile);
  const exported: SourceExportedTopLevelSymbol[] = [];
  const seen = new Set<string>();

  const pushSymbol = (
    exportName: string,
    localName: string,
    symbol: SourceTopLevelSymbol | undefined
  ): void => {
    if (!symbol) {
      return;
    }
    const key = `${exportName}::${localName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    exported.push({
      exportName,
      localName,
      kind: symbol.kind,
      node: symbol.node,
    });
  };

  for (const statement of sourceFile.statements) {
    if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (
      ts.isEnumDeclaration(statement) &&
      statement.name.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (ts.isVariableStatement(statement) && isExportedTopLevelStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        pushSymbol(
          declaration.name.text,
          declaration.name.text,
          topLevel.get(declaration.name.text)
        );
      }
      continue;
    }

    if (
      !ts.isExportDeclaration(statement) ||
      !!statement.moduleSpecifier ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      const localName = element.propertyName?.text ?? element.name.text;
      pushSymbol(element.name.text, localName, topLevel.get(localName));
    }
  }

  return exported;
};

const resolveReferencedIdentifierSymbol = (
  checker: ts.TypeChecker,
  expr: ts.Expression
): ts.Symbol | undefined => {
  const current = stripParentheses(expr);
  if (!ts.isIdentifier(current)) {
    return undefined;
  }

  const symbol = checker.getSymbolAtLocation(current);
  if (!symbol) {
    return undefined;
  }

  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }

  return symbol;
};

const getSourceFileForPath = (
  sourceFilePath: string,
  ctx: ProgramContext
): ts.SourceFile | undefined => {
  const normalizedSourceFilePath = sourceFilePath.replace(/\\/g, "/");
  const realSourceFilePath = (() => {
    try {
      return fs.realpathSync(sourceFilePath).replace(/\\/g, "/");
    } catch {
      return undefined;
    }
  })();

  const fromProgram =
    ctx.sourceFilesByPath.get(normalizedSourceFilePath) ??
    (realSourceFilePath
      ? ctx.sourceFilesByPath.get(realSourceFilePath)
      : undefined);
  if (fromProgram) {
    return fromProgram;
  }

  if (!fs.existsSync(sourceFilePath)) {
    return undefined;
  }

  return ts.createSourceFile(
    sourceFilePath,
    fs.readFileSync(sourceFilePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
};

const getSourceFileExtensionReceiverType = (
  sourceFilePath: string,
  exportName: string,
  memberName: string | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const sourceFile = getSourceFileForPath(sourceFilePath, ctx);
  if (!sourceFile) {
    return undefined;
  }

  const localBindings = new Map<
    string,
    ts.ClassDeclaration | ts.FunctionDeclaration | ts.VariableDeclaration
  >();
  const exportedToLocal = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    const isExported =
      ts.canHaveModifiers(statement) &&
      (ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false);

    if (ts.isClassDeclaration(statement) && statement.name?.text) {
      localBindings.set(statement.name.text, statement);
      if (isExported) {
        exportedToLocal.set(statement.name.text, statement.name.text);
      }
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name?.text) {
      localBindings.set(statement.name.text, statement);
      if (isExported) {
        exportedToLocal.set(statement.name.text, statement.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        localBindings.set(declaration.name.text, declaration);
        if (isExported) {
          exportedToLocal.set(declaration.name.text, declaration.name.text);
        }
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exportedToLocal.set(
          element.name.text,
          element.propertyName?.text ?? element.name.text
        );
      }
    }
  }

  const localName = exportedToLocal.get(exportName);
  if (!localName) {
    return undefined;
  }

  const declaration = localBindings.get(localName);
  if (!declaration) {
    return undefined;
  }

  if (memberName && ts.isClassDeclaration(declaration)) {
    const classMember = declaration.members.find(
      (member): member is ts.MethodDeclaration => {
        if (!ts.isMethodDeclaration(member) || !member.name) {
          return false;
        }

        const memberText =
          ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
            ? member.name.text
            : undefined;
        return memberText === memberName;
      }
    );
    const receiverTypeNode = classMember?.parameters[0]?.type;
    if (!receiverTypeNode) {
      return undefined;
    }
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(receiverTypeNode)
    );
  }

  const receiverTypeNode = (() => {
    if (ts.isFunctionDeclaration(declaration)) {
      return declaration.parameters[0]?.type;
    }

    if (!ts.isVariableDeclaration(declaration)) {
      return undefined;
    }

    const initializer = declaration.initializer;
    if (
      initializer &&
      (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
    ) {
      return initializer.parameters[0]?.type;
    }

    return undefined;
  })();

  if (!receiverTypeNode) {
    return undefined;
  }

  return ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(receiverTypeNode)
  );
};

const buildFunctionParameterFromDeclaration = (
  parameter: ts.ParameterDeclaration,
  typeParameterNames: ReadonlySet<string>
): IrParameter => ({
  kind: "parameter",
  pattern: ts.isIdentifier(parameter.name)
    ? { kind: "identifierPattern", name: parameter.name.text }
    : { kind: "identifierPattern", name: `p${parameter.pos}` },
  type: parameter.type
    ? convertDetachedSourceTypeNode(parameter.type, typeParameterNames)
    : { kind: "unknownType" },
  initializer: undefined,
  isOptional: !!parameter.questionToken || !!parameter.initializer,
  isRest: !!parameter.dotDotDotToken,
  passing: "value",
});

const convertDetachedSourceTypeNode = (
  node: ts.TypeNode,
  typeParameterNames: ReadonlySet<string>
): IrType => {
  switch (node.kind) {
    case ts.SyntaxKind.ParenthesizedType:
      return convertDetachedSourceTypeNode(
        (node as ts.ParenthesizedTypeNode).type,
        typeParameterNames
      );
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType", explicit: true };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.ArrayType:
      return {
        kind: "arrayType",
        elementType: convertDetachedSourceTypeNode(
          (node as ts.ArrayTypeNode).elementType,
          typeParameterNames
        ),
        origin: "explicit",
      };
    case ts.SyntaxKind.TupleType:
      return {
        kind: "tupleType",
        elementTypes: (node as ts.TupleTypeNode).elements.map((element) =>
          convertDetachedSourceTypeNode(element, typeParameterNames)
        ),
      };
    case ts.SyntaxKind.UnionType:
      return {
        kind: "unionType",
        types: (node as ts.UnionTypeNode).types.map((member) =>
          convertDetachedSourceTypeNode(member, typeParameterNames)
        ),
      };
    case ts.SyntaxKind.IntersectionType:
      return {
        kind: "intersectionType",
        types: (node as ts.IntersectionTypeNode).types.map((member) =>
          convertDetachedSourceTypeNode(member, typeParameterNames)
        ),
      };
    case ts.SyntaxKind.TypeOperator:
      return convertDetachedSourceTypeNode(
        (node as ts.TypeOperatorNode).type,
        typeParameterNames
      );
    case ts.SyntaxKind.FunctionType: {
      const functionNode = node as ts.FunctionTypeNode;
      return {
        kind: "functionType",
        parameters: functionNode.parameters.map((parameter) =>
          buildFunctionParameterFromDeclaration(parameter, typeParameterNames)
        ),
        returnType: convertDetachedSourceTypeNode(
          functionNode.type,
          typeParameterNames
        ),
      };
    }
    case ts.SyntaxKind.LiteralType: {
      const literalNode = node as ts.LiteralTypeNode;
      if (ts.isStringLiteral(literalNode.literal)) {
        return {
          kind: "literalType",
          value: literalNode.literal.text,
        };
      }
      if (ts.isNumericLiteral(literalNode.literal)) {
        return {
          kind: "literalType",
          value: Number(literalNode.literal.text),
        };
      }
      if (literalNode.literal.kind === ts.SyntaxKind.TrueKeyword) {
        return { kind: "literalType", value: true };
      }
      if (literalNode.literal.kind === ts.SyntaxKind.FalseKeyword) {
        return { kind: "literalType", value: false };
      }
      return { kind: "unknownType" };
    }
    case ts.SyntaxKind.TypeReference: {
      const typeReference = node as ts.TypeReferenceNode;
      const name = typeReference.typeName.getText();
      if (!typeReference.typeArguments?.length && typeParameterNames.has(name)) {
        return { kind: "typeParameterType", name };
      }

      if (!typeReference.typeArguments?.length) {
        if (name === "string") return { kind: "primitiveType", name: "string" };
        if (name === "number" || name === "double") {
          return { kind: "primitiveType", name: "number" };
        }
        if (name === "int") return { kind: "primitiveType", name: "int" };
        if (name === "boolean") {
          return { kind: "primitiveType", name: "boolean" };
        }
      }

      return {
        kind: "referenceType",
        name,
        typeArguments: typeReference.typeArguments?.map((argument) =>
          convertDetachedSourceTypeNode(argument, typeParameterNames)
        ),
      };
    }
    default:
      return { kind: "unknownType" };
  }
};

const substituteSourceReceiverTypeParameters = (
  parameters: readonly IrParameter[],
  receiverType: IrType | undefined,
  ownerTypeParameterNames: readonly string[],
  ctx: ProgramContext
): readonly IrParameter[] => {
  if (!receiverType || ownerTypeParameterNames.length === 0) {
    return parameters;
  }

  const substitution = new Map<string, IrType>();

  if (
    receiverType.kind === "referenceType" &&
    receiverType.typeArguments &&
    receiverType.typeArguments.length === ownerTypeParameterNames.length
  ) {
    for (let index = 0; index < ownerTypeParameterNames.length; index += 1) {
      const name = ownerTypeParameterNames[index];
      const argument = receiverType.typeArguments[index];
      if (name && argument) {
        substitution.set(name, argument);
      }
    }
  }

  if (receiverType.kind === "arrayType" && substitution.size === 0) {
    const referencedNames = new Set<string>();
    const collect = (type: IrType | undefined): void => {
      if (!type) return;
      switch (type.kind) {
        case "typeParameterType":
          referencedNames.add(type.name);
          return;
        case "arrayType":
          collect(type.elementType);
          return;
        case "tupleType":
          type.elementTypes.forEach(collect);
          return;
        case "dictionaryType":
          collect(type.keyType);
          collect(type.valueType);
          return;
        case "referenceType":
          type.typeArguments?.forEach(collect);
          type.structuralMembers?.forEach((member) => {
            if (member.kind === "propertySignature") {
              collect(member.type);
              return;
            }
            member.parameters.forEach((parameter) => collect(parameter.type));
            collect(member.returnType);
          });
          return;
        case "unionType":
        case "intersectionType":
          type.types.forEach(collect);
          return;
        case "functionType":
          type.parameters.forEach((parameter) => collect(parameter.type));
          collect(type.returnType);
          return;
        default:
          return;
      }
    };

    parameters.forEach((parameter) => collect(parameter.type));

    const receiverNames = ownerTypeParameterNames.filter((name) =>
      referencedNames.has(name)
    );
    if (receiverNames.length === 1) {
      const onlyName = receiverNames[0];
      if (onlyName) {
        substitution.set(onlyName, receiverType.elementType);
      }
    }
  }

  if (substitution.size === 0) {
    return parameters;
  }

  return parameters.map((parameter) => ({
    ...parameter,
    type: parameter.type
      ? ctx.typeSystem.substitute(parameter.type, substitution)
      : parameter.type,
  }));
};

const getSourceBackedCallParameterTypes = (
  node: ts.CallExpression,
  callee: IrCallExpression["callee"],
  receiverType: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext
):
  | {
      readonly parameterTypes: readonly (IrType | undefined)[];
      readonly surfaceParameterTypes: readonly (IrType | undefined)[];
      readonly restParameter:
        | {
            readonly index: number;
            readonly arrayType: IrType | undefined;
            readonly elementType: IrType | undefined;
          }
        | undefined;
    }
  | undefined => {
  if (callee.kind !== "memberAccess" || !callee.memberBinding) {
    return undefined;
  }

  const overloads = ctx.bindings.getClrMemberOverloads(
    callee.memberBinding.assembly,
    callee.memberBinding.type,
    callee.memberBinding.member
  );
  const sourceOrigin = overloads
    ?.map((candidate) => candidate.sourceOrigin)
    .find(
      (
        candidate
      ): candidate is NonNullable<MemberBinding["sourceOrigin"]> =>
        candidate !== undefined
    );
  if (!sourceOrigin) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(sourceOrigin.filePath, ctx);
  if (!sourceFile) {
    return undefined;
  }

  const exportedSymbol = (() => {
    for (const symbol of collectExportedTopLevelSymbols(sourceFile)) {
      if (symbol.exportName === sourceOrigin.exportName) {
        return symbol;
      }
    }
    return undefined;
  })();
  if (!exportedSymbol) {
    return undefined;
  }

  const resolvedSignatureDeclaration = ctx.checker
    .getResolvedSignature(node)
    ?.getDeclaration();

  const resolveSignatureDeclaration = ():
    | {
        readonly declaration:
          | ts.FunctionDeclaration
          | ts.MethodDeclaration
          | ts.FunctionExpression
          | ts.ArrowFunction;
        readonly ownerTypeParameterNames: readonly string[];
      }
    | undefined => {
    if (!sourceOrigin.memberName) {
      if (
        exportedSymbol.kind === "function" &&
        resolvedSignatureDeclaration &&
        ts.isFunctionDeclaration(resolvedSignatureDeclaration) &&
        resolvedSignatureDeclaration.name?.text === sourceOrigin.exportName
      ) {
        return {
          declaration: resolvedSignatureDeclaration,
          ownerTypeParameterNames: [],
        };
      }

      if (exportedSymbol.kind === "variable") {
        const initializer = (exportedSymbol.node as ts.VariableDeclaration)
          .initializer;
        if (
          initializer &&
          resolvedSignatureDeclaration &&
          resolvedSignatureDeclaration === initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ) {
          return {
            declaration: initializer,
            ownerTypeParameterNames: [],
          };
        }
      }

      return undefined;
    }

    if (
      !resolvedSignatureDeclaration ||
      !ts.isMethodDeclaration(resolvedSignatureDeclaration) ||
      resolvedSignatureDeclaration.name === undefined ||
      !(
        ts.isIdentifier(resolvedSignatureDeclaration.name) ||
        ts.isStringLiteral(resolvedSignatureDeclaration.name)
      ) ||
      resolvedSignatureDeclaration.name.text !== sourceOrigin.memberName
    ) {
      return undefined;
    }

    if (exportedSymbol.kind !== "class") {
      return undefined;
    }

    const declaration = exportedSymbol.node as ts.ClassDeclaration;
    if (resolvedSignatureDeclaration.parent !== declaration) {
      return undefined;
    }

    return {
      declaration: resolvedSignatureDeclaration,
      ownerTypeParameterNames:
        declaration.typeParameters?.map((parameter) => parameter.name.text) ?? [],
    };
  };

  const signature = resolveSignatureDeclaration();
  if (!signature) {
    return undefined;
  }

  const typeParameterNames = new Set<string>([
    ...signature.ownerTypeParameterNames,
    ...(signature.declaration.typeParameters?.map((parameter) => parameter.name.text) ??
      []),
  ]);
  const substitutedParameters = substituteSourceReceiverTypeParameters(
    signature.declaration.parameters.map((parameter) =>
      buildFunctionParameterFromDeclaration(parameter, typeParameterNames)
    ),
    receiverType,
    signature.ownerTypeParameterNames,
    ctx
  );
  const parameterTypes = expandParameterTypesForArguments(
    substitutedParameters,
    substitutedParameters.map((parameter) => parameter.type),
    argumentCount
  );

  return {
    parameterTypes,
    surfaceParameterTypes: parameterTypes,
    restParameter: buildResolvedRestParameter(
      substitutedParameters.map((parameter) => ({
        isRest: parameter.isRest,
      })),
      parameterTypes
    ),
  };
};

const getExplicitExtensionReceiverExpectedType = (
  callee: IrCallExpression["callee"],
  finalResolved: ReturnType<ProgramContext["typeSystem"]["resolveCall"]> | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (callee.kind !== "memberAccess") {
    return undefined;
  }

  const binding = callee.memberBinding;
  if (!binding?.isExtensionMethod) {
    return undefined;
  }

  if (binding.receiverExpectedType) {
    return binding.receiverExpectedType;
  }

  if (finalResolved?.thisParameterType) {
    return finalResolved.thisParameterType;
  }

  const overloads = ctx.bindings.getClrMemberOverloads(
    binding.assembly,
    binding.type,
    binding.member
  );
  if (!overloads || overloads.length === 0) {
    return undefined;
  }

  const explicitReceiverType = overloads
    .map((candidate) => candidate.receiverExpectedType)
    .find((candidate): candidate is IrType => candidate !== undefined);
  if (explicitReceiverType) {
    return explicitReceiverType;
  }

  const sourceOrigin = overloads
    .map((candidate) => candidate.sourceOrigin)
    .find(
      (
        candidate
      ): candidate is NonNullable<MemberBinding["sourceOrigin"]> =>
        candidate !== undefined
    );
  if (!sourceOrigin) {
    return undefined;
  }

  return getSourceFileExtensionReceiverType(
    sourceOrigin.filePath,
    sourceOrigin.exportName,
    sourceOrigin.memberName,
    ctx
  );
};

/**
 * Convert call expression
 */
export const convertCallExpression = (
  node: ts.CallExpression,
  ctx: ProgramContext,
  expectedType?: IrType
):
  | IrCallExpression
  | IrAsInterfaceExpression
  | IrTryCastExpression
  | IrStackAllocExpression
  | IrDefaultOfExpression
  | IrNameOfExpression
  | IrSizeOfExpression => {
  // Try intrinsic calls first
  const intrinsicResult = tryConvertIntrinsicCall(node, ctx, expectedType);
  if (intrinsicResult) {
    return intrinsicResult;
  }

  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, ctx);
  const requiresSpecialization = checkIfRequiresSpecialization(node, ctx);

  // Convert callee first so we can access memberBinding and receiver type
  const callee = convertExpression(node.expression, ctx, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() -> dict's type)
  const receiverIrType =
    callee.kind === "memberAccess"
      ? callee.object.inferredType
      : getEnclosingClassSuperType(node, ctx);

  // Resolve call (two-pass):
  // 1) Resolve parameter types (for expectedType threading)
  // 2) Convert arguments, then re-resolve with argTypes to infer generics deterministically
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveCallSignature(node);
  const argumentCount = node.arguments.length;
  const callSiteArgModifiers: (CallSiteArgModifier | undefined)[] = new Array(
    argumentCount
  ).fill(undefined);

  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;
  const sourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    argumentCount,
    ctx
  );

  const specializedMemberFunctionType = (() => {
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
    if (!receiverIrType) return undefined;

    const memberId = ctx.binding.resolvePropertyAccess(node.expression);
    if (!memberId) return undefined;

    const memberType = typeSystem.typeOfMemberId(memberId, receiverIrType);
    return chooseCallableCandidate(memberType, argumentCount, ctx);
  })();

  // If we can't resolve a signature handle (common for calls through function-typed
  // variables), fall back to the callee's inferred function type.
  const calleeFunctionType = (() => {
    if (specializedMemberFunctionType) {
      return specializedMemberFunctionType;
    }

    const t = callee.inferredType;
    return chooseCallableCandidate(t, argumentCount, ctx);
  })();

  if (!sigId && calleeFunctionType) {
    const params = calleeFunctionType.parameters;
    const paramTypesForArgs = expandParameterTypesForArguments(
      params,
      params.map((parameter) => parameter.type),
      node.arguments.length
    );

    const args: IrCallExpression["arguments"][number][] = [];
    for (let i = 0; i < node.arguments.length; i++) {
      const arg = node.arguments[i];
      if (!arg) continue;

      const expectedType = paramTypesForArgs[i];
      if (ts.isSpreadElement(arg)) {
        const spreadExpr = convertExpression(arg.expression, ctx, undefined);
        args.push({
          kind: "spread",
          expression: spreadExpr,
          inferredType: spreadExpr.inferredType,
          sourceSpan: getSourceSpan(arg),
        });
        continue;
      }

      const unwrapped = unwrapCallSiteArgumentModifier(arg);
      if (unwrapped.modifier) {
        callSiteArgModifiers[i] = unwrapped.modifier;
      }
      args.push(convertExpression(unwrapped.expression, ctx, expectedType));
    }

    const argumentPassing = applyCallSiteArgumentModifiers(
      extractArgumentPassing(node, ctx),
      callSiteArgModifiers,
      argumentCount,
      ctx,
      node
    );

    const extensionReceiverExpectedType =
      getExplicitExtensionReceiverExpectedType(callee, undefined, ctx);
    const finalCallee =
      callee.kind === "memberAccess" &&
      callee.memberBinding &&
      extensionReceiverExpectedType
        ? {
            ...callee,
            memberBinding: {
              ...callee.memberBinding,
              receiverExpectedType: extensionReceiverExpectedType,
            },
          }
        : callee;

    return {
      kind: "call",
      callee: finalCallee,
      arguments: args,
      isOptional: node.questionDotToken !== undefined,
      inferredType: calleeFunctionType.returnType,
      sourceSpan: getSourceSpan(node),
      typeArguments,
      requiresSpecialization,
      argumentPassing,
      parameterTypes: paramTypesForArgs,
      restParameter: (() => {
        const restIndex = params.findIndex((parameter) => parameter.isRest);
        if (restIndex < 0) return undefined;
        return {
          index: restIndex,
          arrayType: params[restIndex]?.type,
          elementType: paramTypesForArgs[restIndex],
        };
      })(),
    };
  }

  const initialResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        expectedReturnType: expectedType,
      })
    : undefined;
  const expectedReturnCandidates = expectedType
    ? typeSystem.collectExpectedReturnCandidates(expectedType)
    : undefined;
  const initialParameterTypes = (() => {
    const substitutions = deriveSubstitutionsFromExpectedReturn(
      initialResolved?.returnType,
      expectedReturnCandidates
    );
    if (!substitutions || !initialResolved?.parameterTypes) {
      return (
        initialResolved?.parameterTypes ??
        sourceBackedCallParameterTypes?.parameterTypes
      );
    }
    return initialResolved.parameterTypes.map((t) =>
      substituteTypeParameters(t, substitutions)
    );
  })();

  const isLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
    if (ts.isParenthesizedExpression(expr)) return isLambdaArg(expr.expression);
    return false;
  };

  const isExplicitlyTypedLambdaArg = (expr: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(expr)) {
      return isExplicitlyTypedLambdaArg(expr.expression);
    }

    if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr)) {
      return false;
    }

    if (expr.type) return true;
    if (expr.typeParameters && expr.typeParameters.length > 0) return true;
    return expr.parameters.some((p) => p.type !== undefined);
  };

  const shouldDeferLambdaForInference = (expr: ts.Expression): boolean =>
    isLambdaArg(expr) && !isExplicitlyTypedLambdaArg(expr);

  const isGenericFunctionValueArg = (expr: ts.Expression): boolean => {
    const symbol = resolveReferencedIdentifierSymbol(ctx.checker, expr);
    return !!symbol && ctx.genericFunctionValueSymbols.has(symbol);
  };

  const shouldDeferGenericFunctionValueForInference = (
    expr: ts.Expression,
    parameterType: IrType | undefined
  ): boolean => {
    if (!parameterType || !isGenericFunctionValueArg(expr)) {
      return false;
    }

    const expectedCallableType =
      parameterType.kind === "functionType"
        ? parameterType
        : ctx.typeSystem.delegateToFunctionType(parameterType);

    if (!expectedCallableType) {
      return false;
    }

    return ctx.typeSystem.containsTypeParameter(expectedCallableType);
  };

  const shouldDelayContextualAggregateInference = (
    expr: ts.Expression,
    parameterType: IrType | undefined
  ): boolean => {
    if (!parameterType || !ctx.typeSystem.containsTypeParameter(parameterType)) {
      return false;
    }

    const current = stripParentheses(expr);
    if (ts.isArrayLiteralExpression(current)) {
      return current.elements.length > 0;
    }

    return ts.isObjectLiteralExpression(current);
  };

  // Pass 1: convert non-lambda arguments and infer type args from them.
  const argsWorking: (IrCallExpression["arguments"][number] | undefined)[] =
    new Array(node.arguments.length);
  const argTypesForInference: (IrType | undefined)[] = Array(
    node.arguments.length
  ).fill(undefined);

  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
    if (!arg) continue;

    const expectedType = initialParameterTypes?.[index];

    if (ts.isSpreadElement(arg)) {
      const spreadExpr = convertExpression(arg.expression, ctx, undefined);
      argsWorking[index] = {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
      continue;
    }

    const unwrapped = unwrapCallSiteArgumentModifier(arg);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }

    if (
      shouldDeferLambdaForInference(unwrapped.expression) ||
      shouldDeferGenericFunctionValueForInference(
        unwrapped.expression,
        expectedType
      )
    ) {
      // Defer *untyped* lambda conversion until after we infer generic type args
      // from other arguments. Do the same for generic function values when the
      // contextual callable type still contains unresolved type parameters.
      // Explicitly typed lambdas are safe to convert early and often provide the
      // only deterministic inference signal.
      continue;
    }

    const deferAggregateContext = shouldDelayContextualAggregateInference(
      unwrapped.expression,
      expectedType
    );

    const converted = convertExpression(
      unwrapped.expression,
      ctx,
      deferAggregateContext ? undefined : expectedType
    );
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
  }

  const lambdaContextResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes: argTypesForInference,
        expectedReturnType: expectedType,
      })
    : initialResolved;

  const parameterTypesForDeferredContext =
    lambdaContextResolved?.parameterTypes ?? initialParameterTypes;

  // Pass 2: convert deferred arguments with inferred parameter types in scope.
  //
  // IMPORTANT (airplane-grade):
  // Lambdas may have been converted in Pass 1 (e.g., because they have explicit
  // parameter annotations) before we had a fully resolved call signature.
  //
  // In those cases, block-bodied arrows can lose contextual return types and be
  // treated as `void`, which then mis-emits `return expr;` as:
  //   expr;
  //   return;
  //
  // Re-convert *all* deferred arguments here using the resolved parameter type so
  // contextual parameter + return typing is applied deterministically.
  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
    if (!arg) continue;
    if (ts.isSpreadElement(arg)) continue;
    const unwrapped = unwrapCallSiteArgumentModifier(arg);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }
    const isDeferredLambda = isLambdaArg(unwrapped.expression);
    const isDeferredGenericFunctionValue = isGenericFunctionValueArg(
      unwrapped.expression
    );
    if (!isDeferredLambda && !isDeferredGenericFunctionValue) {
      continue;
    }

    const expectedType = parameterTypesForDeferredContext?.[index];
    const contextualExpectedType =
      expectedType?.kind === "functionType"
        ? expectedType
        : expectedType
          ? (typeSystem.delegateToFunctionType(expectedType) ?? expectedType)
          : undefined;

    argsWorking[index] = convertExpression(
      unwrapped.expression,
      ctx,
      contextualExpectedType
    );
  }

  const convertedArgs = argsWorking.map((a) => {
    if (!a) {
      throw new Error("ICE: call argument conversion produced a hole");
    }
    return a;
  });

  const argTypes = convertedArgs.map((a) =>
    a.kind === "spread" ? undefined : a.inferredType
  );

  const resolutionArgs = collectResolutionArguments(convertedArgs);

  const finalResolved = sigId
    ? typeSystem.resolveCall({
        sigId,
        argumentCount:
          resolutionArgs.argumentCount > 0
            ? resolutionArgs.argumentCount
            : argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes:
          resolutionArgs.argumentCount > 0 ? resolutionArgs.argTypes : argTypes,
        expectedReturnType: expectedType,
      })
    : lambdaContextResolved;

  const parameterTypes =
    finalResolved?.parameterTypes ??
    initialParameterTypes ??
    sourceBackedCallParameterTypes?.parameterTypes ??
    (calleeFunctionType
      ? expandParameterTypesForArguments(
          calleeFunctionType.parameters,
          calleeFunctionType.parameters.map((parameter) => parameter.type),
          node.arguments.length
        )
      : undefined);
  const surfaceParameterTypes =
    finalResolved?.surfaceParameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes ??
    parameterTypes;
  const fallbackRestParameter = (() => {
    if (finalResolved?.surfaceRestParameter) {
      return finalResolved.surfaceRestParameter;
    }

    if (sourceBackedCallParameterTypes?.restParameter) {
      return sourceBackedCallParameterTypes.restParameter;
    }

    if (!calleeFunctionType) {
      return undefined;
    }

    const restIndex = calleeFunctionType.parameters.findIndex(
      (parameter) => parameter.isRest
    );
    if (restIndex < 0) {
      return undefined;
    }

    return {
      index: restIndex,
      arrayType: calleeFunctionType.parameters[restIndex]?.type,
      elementType: parameterTypes?.[restIndex],
    };
  })();
  const inferredType = (() => {
    const resolvedReturnType = finalResolved?.returnType;
    if (!resolvedReturnType) {
      return { kind: "unknownType" } as const;
    }

    // Airplane-grade rule:
    // When a call target is already typed as a function value and the resolved
    // signature has no declared return annotation, the IR must preserve the
    // callee's deterministically inferred function return type instead of
    // collapsing the call to `void`.
    //
    // This matters for synthesized object-literal methods and other
    // function-valued members where the TS signature handle may originate from
    // syntax without an explicit return type while the frontend has already
    // recovered a precise function type from the body.
    if (
      finalResolved?.hasDeclaredReturnType === false &&
      calleeFunctionType?.returnType &&
      (resolvedReturnType.kind === "voidType" ||
        resolvedReturnType.kind === "unknownType" ||
        resolvedReturnType.kind === "anyType")
    ) {
      return calleeFunctionType.returnType;
    }

    return resolvedReturnType;
  })();
  const argumentPassingFromBinding = extractArgumentPassingFromBinding(
    callee,
    node.arguments.length,
    ctx,
    parameterTypes,
    argTypes
  );
  const argumentPassing =
    argumentPassingFromBinding ??
    (finalResolved
      ? finalResolved.parameterModes.slice(0, node.arguments.length)
      : extractArgumentPassing(node, ctx));
  const argumentPassingWithOverrides = applyCallSiteArgumentModifiers(
    argumentPassing,
    callSiteArgModifiers,
    argumentCount,
    ctx,
    node
  );

  const narrowing: IrCallExpression["narrowing"] = (() => {
    if (ts.isCallExpression(node) && isArrayIsArrayCall(node.expression)) {
      const currentType = argTypes[0];
      const targetType = narrowTypeByArrayShape(
        ctx.typeSystem,
        currentType,
        true
      );
      if (targetType) {
        return {
          kind: "typePredicate",
          argIndex: 0,
          targetType,
        };
      }
    }

    const pred = finalResolved?.typePredicate;
    if (pred?.kind === "param") {
      const currentArgumentType = argTypes[pred.parameterIndex];
      if (
        currentArgumentType &&
        ctx.typeSystem.isAssignableTo(currentArgumentType, pred.targetType)
      ) {
        return undefined;
      }

      return {
        kind: "typePredicate",
        argIndex: pred.parameterIndex,
        targetType: pred.targetType,
      };
    }

    return undefined;
  })();

  const extensionReceiverExpectedType = getExplicitExtensionReceiverExpectedType(
    callee,
    finalResolved,
    ctx
  );
  const finalCallee =
    callee.kind === "memberAccess" &&
    callee.memberBinding &&
    extensionReceiverExpectedType
      ? {
          ...callee,
          memberBinding: {
            ...callee.memberBinding,
            receiverExpectedType: extensionReceiverExpectedType,
          },
        }
      : callee;

  return {
    kind: "call",
    callee: finalCallee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: convertedArgs,
    isOptional: node.questionDotToken !== undefined,
    inferredType,
    allowUnknownInferredType: finalResolved?.hasDeclaredReturnType ?? false,
    sourceSpan: getSourceSpan(node),
    typeArguments,
    requiresSpecialization,
    argumentPassing: argumentPassingWithOverrides,
    parameterTypes,
    surfaceParameterTypes,
    restParameter: finalResolved?.restParameter ?? fallbackRestParameter,
    surfaceRestParameter:
      sourceBackedCallParameterTypes?.restParameter ??
      finalResolved?.surfaceRestParameter ??
      fallbackRestParameter,
    narrowing,
  };
};
