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
  IrExpression,
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
  substitutePolymorphicThis,
} from "../../../type-system/type-system-call-resolution.js";
import { addUndefinedToType } from "../../../type-system/type-system-state-helpers.js";
import {
  type CallSiteArgModifier,
  deriveSubstitutionsFromExpectedReturn,
  substituteTypeParameters,
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
  extractArgumentPassingFromBinding,
} from "./call-site-analysis.js";
import {
  collectResolutionArguments,
  resolveCallableCandidate,
} from "./call-resolution.js";
import { tryConvertIntrinsicCall } from "./call-intrinsics.js";
import { resolveHeritageReferenceType } from "../../heritage-reference-type.js";
import { getBoundGlobalCallParameterTypes } from "./bound-global-call-parameters.js";
import { resolveImport } from "../../../../resolver.js";
import { readSourcePackageMetadata } from "../../../../program/source-package-metadata.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import {
  containsTypeParameter,
  deriveInvocationTypeSubstitutions,
  expandAuthoritativeSourceBackedSurfaceType,
  finalizeInvocationMetadata,
  getAuthoritativeDirectCalleeParameterTypes,
  getDirectStructuralMemberType,
  invocationTypesEquivalent,
  normalizeFinalizedInvocationArguments,
  selectDeterministicSourceBackedParameterType,
} from "./invocation-finalization.js";
import {
  getClrIdentityKey,
  referenceTypeHasClrIdentity,
  referenceTypeIdentity,
} from "../../../types/type-ops.js";

const stripParentheses = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

const clrBindingTypesMatch = (left: string, right: string): boolean =>
  getClrIdentityKey(left) === getClrIdentityKey(right);

const isStableNamedAggregateContextType = (
  type: IrType | undefined
): type is Extract<IrType, { kind: "referenceType" }> =>
  type?.kind === "referenceType" &&
  !type.name.startsWith("__Anon_") &&
  !type.name.startsWith("__Rest_") &&
  type.name !== "object";

const isExpressionTreeContextType = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "referenceType") return false;
  if (type.typeArguments?.length !== 1) return false;
  return (
    type.typeId?.tsName === "Expression_1" ||
    type.name === "Expression_1" ||
    referenceTypeHasClrIdentity(type, [
      "System.Linq.Expressions.Expression`1",
      "System.Linq.Expressions.Expression_1",
    ])
  );
};

const getLambdaContextualExpectedType = (
  expectedType: IrType | undefined,
  typeSystem: ProgramContext["typeSystem"]
): IrType | undefined => {
  if (!expectedType) return undefined;
  if (isExpressionTreeContextType(expectedType)) return expectedType;
  return expectedType.kind === "functionType"
    ? expectedType
    : (typeSystem.delegateToFunctionType(expectedType) ?? expectedType);
};

const preserveStableNamedAggregateArgumentIdentity = (
  argument: IrExpression,
  contextualExpectedType: IrType | undefined,
  ctx: ProgramContext
): IrExpression => {
  if (
    !isStableNamedAggregateContextType(contextualExpectedType) ||
    !argument.inferredType ||
    !invocationTypesEquivalent(
      argument.inferredType,
      contextualExpectedType,
      ctx
    )
  ) {
    return argument;
  }

  switch (argument.kind) {
    case "object":
      return {
        ...argument,
        inferredType: contextualExpectedType,
        contextualType: contextualExpectedType,
      };
    case "array":
      return {
        ...argument,
        inferredType: contextualExpectedType,
      };
    default:
      return {
        ...argument,
        inferredType: contextualExpectedType,
      };
  }
};

const buildDeferredLambdaInferenceType = (
  expr: ts.Expression
): Extract<IrType, { kind: "functionType" }> | undefined => {
  const current = stripParentheses(expr);
  if (!ts.isArrowFunction(current) && !ts.isFunctionExpression(current)) {
    return undefined;
  }

  return {
    kind: "functionType",
    parameters: current.parameters.map(
      (parameter, index): IrParameter => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name: ts.isIdentifier(parameter.name)
            ? parameter.name.text
            : `arg${index}`,
        },
        type: { kind: "unknownType" },
        initializer: undefined,
        isOptional: !!parameter.questionToken,
        isRest: !!parameter.dotDotDotToken,
        passing: "value",
      })
    ),
    returnType: { kind: "unknownType" },
  };
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

      return resolveHeritageReferenceType(superClass, ctx);
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

type SourceBackedIdentifierGlobalTarget = {
  readonly declaration:
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction;
  readonly ownerTypeParameterNames: readonly string[];
  readonly overloadCandidates: readonly (
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
  )[];
};

type SourceBackedMemberAccessTarget = {
  readonly declaration: ts.MethodDeclaration;
  readonly overloadCandidates: readonly ts.MethodDeclaration[];
  readonly receiverType: IrType;
};

type SourceBackedSourceOrigin = NonNullable<MemberBinding["sourceOrigin"]>;
type SourceBackedExportSourceTarget = {
  readonly sourceFile: ts.SourceFile;
  readonly exportName: string;
};

const collectSourceBackedReceiverTypeCandidates = (
  expression: IrExpression,
  receiverType: IrType | undefined
): readonly Extract<IrType, { kind: "referenceType" }>[] => {
  const candidates: Extract<IrType, { kind: "referenceType" }>[] = [];
  const seen = new Set<string>();
  const opaqueKeys = new WeakMap<object, number>();
  let nextOpaqueKey = 0;

  const opaqueKey = (type: object): string => {
    const existing = opaqueKeys.get(type);
    if (existing !== undefined) return `opaque:${existing}`;
    const next = nextOpaqueKey;
    nextOpaqueKey += 1;
    opaqueKeys.set(type, next);
    return `opaque:${next}`;
  };

  const shallowTypeKey = (type: IrType): string => {
    switch (type.kind) {
      case "primitiveType":
        return `prim:${type.name}`;
      case "literalType":
        return `lit:${JSON.stringify(type.value)}`;
      case "typeParameterType":
        return `tp:${type.name}`;
      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        return type.kind;
      case "arrayType":
        return `arr:${shallowTypeKey(type.elementType)}`;
      case "tupleType":
        return `tuple:${type.elementTypes.map(shallowTypeKey).join(",")}`;
      case "dictionaryType":
        return `dict:${shallowTypeKey(type.keyType)}=>${shallowTypeKey(type.valueType)}`;
      case "referenceType": {
        const identity = referenceTypeIdentity(type);
        const args = (type.typeArguments ?? []).map(shallowTypeKey).join(",");
        return `ref:${identity ?? opaqueKey(type)}<${args}>`;
      }
      case "functionType":
      case "objectType":
      case "unionType":
      case "intersectionType":
        return opaqueKey(type);
    }
  };

  const pushCandidate = (candidate: IrType | undefined): void => {
    if (!candidate || candidate.kind !== "referenceType") {
      return;
    }

    const key = shallowTypeKey(candidate);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(candidate);
  };

  pushCandidate(receiverType);

  let current: IrExpression | undefined = expression;
  while (
    current &&
    (current.kind === "asinterface" ||
      current.kind === "typeAssertion" ||
      current.kind === "numericNarrowing" ||
      current.kind === "trycast")
  ) {
    current = current.expression;
    pushCandidate(current.inferredType);
  }

  return candidates;
};

const collectSourceBackedReceiverOwnerAliases = (
  receiverType: Extract<IrType, { kind: "referenceType" }>
): readonly string[] => {
  const aliases: string[] = [];
  const seen = new Set<string>();

  const pushAlias = (alias: string | undefined): void => {
    if (!alias || alias.length === 0 || seen.has(alias)) {
      return;
    }

    seen.add(alias);
    aliases.push(alias);
  };

  pushAlias(receiverType.name);
  pushAlias(receiverType.name.split(".").pop() ?? receiverType.name);

  if (receiverType.resolvedClrType) {
    pushAlias(tsbindgenClrTypeNameToTsTypeName(receiverType.resolvedClrType));
    pushAlias(receiverType.resolvedClrType);
  }

  pushAlias(receiverType.typeId?.tsName);
  pushAlias(receiverType.typeId?.clrName);

  return aliases;
};

const resolveSourceBackedMemberSourceOrigin = (
  receiverType: Extract<IrType, { kind: "referenceType" }>,
  memberName: string,
  ctx: ProgramContext
): SourceBackedSourceOrigin | undefined => {
  const preferredClrOwner =
    typeof receiverType.resolvedClrType === "string"
      ? receiverType.resolvedClrType
      : undefined;

  for (const ownerAlias of collectSourceBackedReceiverOwnerAliases(
    receiverType
  )) {
    const overloads = ctx.bindings.getMemberOverloads(
      ownerAlias,
      memberName,
      preferredClrOwner
    );
    const sourceOrigin = overloads
      ?.map((candidate) => candidate.sourceOrigin)
      .find(
        (candidate): candidate is SourceBackedSourceOrigin =>
          candidate !== undefined
      );
    if (sourceOrigin) {
      return sourceOrigin;
    }
  }

  return undefined;
};

const resolveSourceBackedExportedFunctionTarget = (
  sourceFile: ts.SourceFile,
  exportedSymbol: SourceExportedTopLevelSymbol,
  resolvedSignatureDeclaration: ts.SignatureDeclaration | undefined
): SourceBackedIdentifierGlobalTarget | undefined => {
  if (exportedSymbol.kind === "function") {
    const candidates = sourceFile.statements.flatMap((statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === exportedSymbol.localName
        ? [statement]
        : []
    );
    if (candidates.length === 0) {
      return undefined;
    }

    const publicCandidates =
      getPublicSourceBackedOverloadCandidates(candidates);
    const declaration =
      publicCandidates.find(
        (candidate) => candidate === resolvedSignatureDeclaration
      ) ??
      publicCandidates[publicCandidates.length - 1] ??
      publicCandidates[0];
    if (!declaration) {
      return undefined;
    }

    return {
      declaration,
      ownerTypeParameterNames: [],
      overloadCandidates: publicCandidates,
    };
  }

  if (exportedSymbol.kind !== "variable") {
    return undefined;
  }

  const initializer = (exportedSymbol.node as ts.VariableDeclaration)
    .initializer;
  if (
    !initializer ||
    (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer))
  ) {
    return undefined;
  }

  return {
    declaration: initializer,
    ownerTypeParameterNames: [],
    overloadCandidates: [initializer],
  };
};

const getPublicSourceBackedOverloadCandidates = <
  T extends {
    readonly body?: ts.Block | ts.ConciseBody;
  },
>(
  candidates: readonly T[]
): readonly T[] => {
  const declarationOnly = candidates.filter(
    (candidate) => candidate.body === undefined
  );
  return declarationOnly.length > 0 ? declarationOnly : candidates;
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
      pushSymbol(
        statement.name.text,
        statement.name.text,
        topLevel.get(statement.name.text)
      );
      continue;
    }

    if (
      ts.isEnumDeclaration(statement) &&
      statement.name.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(
        statement.name.text,
        statement.name.text,
        topLevel.get(statement.name.text)
      );
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(
        statement.name.text,
        statement.name.text,
        topLevel.get(statement.name.text)
      );
      continue;
    }

    if (
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(
        statement.name.text,
        statement.name.text,
        topLevel.get(statement.name.text)
      );
      continue;
    }

    if (
      ts.isVariableStatement(statement) &&
      isExportedTopLevelStatement(statement)
    ) {
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

const resolveSourceBackedExportSourceTarget = (
  sourceFile: ts.SourceFile,
  exportName: string,
  ctx: ProgramContext,
  visited: ReadonlySet<string> = new Set<string>()
): SourceBackedExportSourceTarget | undefined => {
  const visitKey = `${sourceFile.fileName.replace(/\\/g, "/")}::${exportName}`;
  if (visited.has(visitKey)) {
    return undefined;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);

  const exportedSymbols = collectExportedTopLevelSymbols(sourceFile);
  const directMatch = exportedSymbols.find(
    (symbol) => symbol.exportName === exportName
  );
  if (directMatch && directMatch.localName === exportName) {
    return {
      sourceFile,
      exportName,
    };
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) {
        continue;
      }

      const localName = element.propertyName?.text ?? element.name.text;
      if (
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        return {
          sourceFile,
          exportName: localName,
        };
      }

      const resolved = resolveImport(
        statement.moduleSpecifier.text,
        sourceFile.fileName,
        ctx.sourceRoot,
        {
          clrResolver: ctx.clrResolver,
          bindings: ctx.bindings,
          projectRoot: ctx.projectRoot,
          surface: ctx.surface,
          authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
          declarationModuleAliases: ctx.declarationModuleAliases,
        }
      );
      if (!resolved.ok || !resolved.value.resolvedPath) {
        return undefined;
      }

      const redirectedSourceFile = getSourceFileForPath(
        resolved.value.resolvedPath,
        ctx
      );
      if (!redirectedSourceFile || redirectedSourceFile.isDeclarationFile) {
        return undefined;
      }

      return resolveSourceBackedExportSourceTarget(
        redirectedSourceFile,
        localName,
        ctx,
        nextVisited
      );
    }
  }

  return directMatch
    ? {
        sourceFile,
        exportName: directMatch.localName,
      }
    : undefined;
};

const resolveSourceBackedPackageExportSourceTarget = (
  receiverType: Extract<IrType, { kind: "referenceType" }>,
  ctx: ProgramContext
): SourceBackedExportSourceTarget | undefined => {
  const packageName = receiverType.typeId?.assemblyName;
  if (!packageName || !packageName.startsWith("@tsonic/")) {
    return undefined;
  }

  const exportName =
    receiverType.typeId?.tsName ??
    receiverType.name.split(".").pop() ??
    receiverType.name;
  if (!exportName) {
    return undefined;
  }

  const packageRoot = ctx.authoritativeTsonicPackageRoots.get(packageName);
  if (!packageRoot) {
    return undefined;
  }

  const metadata = readSourcePackageMetadata(packageRoot);
  if (!metadata) {
    return undefined;
  }

  const matches = new Map<string, SourceBackedExportSourceTarget>();
  for (const exportPath of metadata.exportPaths) {
    const sourceFile = getSourceFileForPath(exportPath, ctx);
    if (!sourceFile || sourceFile.isDeclarationFile) {
      continue;
    }

    const match = resolveSourceBackedExportSourceTarget(
      sourceFile,
      exportName,
      ctx
    );
    if (!match) {
      continue;
    }

    matches.set(match.sourceFile.fileName.replace(/\\/g, "/"), match);
  }

  if (matches.size !== 1) {
    return undefined;
  }

  return [...matches.values()][0];
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

const resolveSourceBackedIdentifierGlobalTarget = (
  node: ts.CallExpression,
  callee: Extract<IrCallExpression["callee"], { kind: "identifier" }>,
  ctx: ProgramContext
): SourceBackedIdentifierGlobalTarget | undefined => {
  if (!callee.resolvedAssembly || !callee.resolvedClrType) {
    return undefined;
  }

  const binding = ctx.bindings.getExactBindingByKind(callee.name, "global");
  if (
    !binding ||
    binding.assembly !== callee.resolvedAssembly ||
    !clrBindingTypesMatch(binding.type, callee.resolvedClrType) ||
    !binding.sourceImport
  ) {
    return undefined;
  }

  const resolved = resolveImport(
    binding.sourceImport,
    node.getSourceFile().fileName,
    ctx.sourceRoot,
    {
      clrResolver: ctx.clrResolver,
      bindings: ctx.bindings,
      projectRoot: ctx.projectRoot,
      surface: ctx.surface,
      authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
      declarationModuleAliases: ctx.declarationModuleAliases,
    }
  );
  if (!resolved.ok || !resolved.value.resolvedPath) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
  if (!sourceFile || sourceFile.isDeclarationFile) {
    return undefined;
  }

  const exportedSymbol = collectExportedTopLevelSymbols(sourceFile).find(
    (symbol) => symbol.exportName === callee.name
  );
  if (!exportedSymbol) {
    return undefined;
  }

  return resolveSourceBackedExportedFunctionTarget(
    sourceFile,
    exportedSymbol,
    ctx.checker.getResolvedSignature(node)?.getDeclaration()
  );
};

const collectTopLevelClassDeclarations = (
  sourceFile: ts.SourceFile
): ReadonlyMap<string, ts.ClassDeclaration> => {
  const classes = new Map<string, ts.ClassDeclaration>();
  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text) {
      classes.set(statement.name.text, statement);
    }
  }
  return classes;
};

const resolveSourceBackedClassDeclarationByName = (
  typeName: string,
  ctx: ProgramContext
): ts.ClassDeclaration | undefined => {
  const simpleName = getLocalClassLookupName(typeName);
  const binding = ctx.bindings.getExactBindingByKind(simpleName, "global");
  if (!binding?.sourceImport) {
    return undefined;
  }

  const resolved = resolveImport(
    binding.sourceImport,
    ctx.sourceRoot,
    ctx.sourceRoot,
    {
      clrResolver: ctx.clrResolver,
      bindings: ctx.bindings,
      projectRoot: ctx.projectRoot,
      surface: ctx.surface,
      authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
      declarationModuleAliases: ctx.declarationModuleAliases,
    }
  );
  if (!resolved.ok || !resolved.value.resolvedPath) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
  if (!sourceFile) {
    return undefined;
  }

  return collectTopLevelClassDeclarations(sourceFile).get(simpleName);
};

const getClassDeclarationIdentity = (
  classDeclaration: ts.ClassDeclaration
): string | undefined => {
  const className = classDeclaration.name?.text;
  if (!className) {
    return undefined;
  }

  return `${classDeclaration.getSourceFile().fileName.replace(/\\/g, "/")}::${className}`;
};

const resolveClassDeclarationFromExpression = (
  expression: ts.Expression,
  ctx: ProgramContext
): ts.ClassDeclaration | undefined => {
  const symbol = resolveReferencedIdentifierSymbol(ctx.checker, expression);
  if (!symbol) {
    return undefined;
  }

  const declaration = symbol.declarations?.find((candidate) =>
    ts.isClassDeclaration(candidate)
  );
  return declaration && ts.isClassDeclaration(declaration)
    ? declaration
    : undefined;
};

const collectClassMethodDeclarationsInHierarchy = (
  ownerClass: ts.ClassDeclaration,
  memberName: string,
  ctx: ProgramContext,
  visited: ReadonlySet<string> = new Set<string>()
): readonly ts.MethodDeclaration[] => {
  const ownerIdentity = getClassDeclarationIdentity(ownerClass);
  if (!ownerIdentity || visited.has(ownerIdentity)) {
    return [];
  }

  const nextVisited = new Set(visited);
  nextVisited.add(ownerIdentity);

  const directMembers = ownerClass.members.flatMap((member) =>
    ts.isMethodDeclaration(member) &&
    getDeclarationTextName(member.name) === memberName
      ? [member]
      : []
  );

  const inheritedMembers: ts.MethodDeclaration[] = [];
  const heritageClauses = ownerClass.heritageClauses ?? [];
  for (const heritageClause of heritageClauses) {
    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }

    for (const heritageType of heritageClause.types) {
      const baseClass = resolveClassDeclarationFromExpression(
        heritageType.expression,
        ctx
      );
      if (!baseClass) {
        continue;
      }

      inheritedMembers.push(
        ...collectClassMethodDeclarationsInHierarchy(
          baseClass,
          memberName,
          ctx,
          nextVisited
        )
      );
    }
  }

  return [...directMembers, ...inheritedMembers];
};

const getLocalClassLookupName = (typeName: string): string =>
  typeName
    .replace(/\$instance$/, "")
    .split(".")
    .pop() ?? typeName;

const buildLocalReceiverOwnerTypeSubstitution = (
  receiverType: IrType | undefined,
  ownerClassDeclaration: ts.ClassLikeDeclaration | undefined,
  ownerTypeParameterNames: readonly string[],
  ctx: ProgramContext
): ReadonlyMap<string, IrType> | undefined => {
  if (
    receiverType?.kind !== "referenceType" ||
    !ownerClassDeclaration ||
    !ownerClassDeclaration.name ||
    ownerTypeParameterNames.length === 0
  ) {
    return undefined;
  }

  const ownerSourceClasses = collectTopLevelClassDeclarations(
    ownerClassDeclaration.getSourceFile()
  );
  let currentClass =
    ownerSourceClasses.get(getLocalClassLookupName(receiverType.name)) ??
    resolveSourceBackedClassDeclarationByName(receiverType.name, ctx);
  let currentInstantiatedType: IrType = receiverType;
  const visited = new Set<string>();

  while (currentClass?.name?.text) {
    const currentName = currentClass.name.text;
    if (visited.has(currentName)) {
      return undefined;
    }
    visited.add(currentName);

    if (currentName === ownerClassDeclaration.name.text) {
      if (
        currentInstantiatedType.kind !== "referenceType" ||
        !currentInstantiatedType.typeArguments ||
        currentInstantiatedType.typeArguments.length !==
          ownerTypeParameterNames.length
      ) {
        return undefined;
      }

      const substitution = new Map<string, IrType>();
      for (let index = 0; index < ownerTypeParameterNames.length; index += 1) {
        const typeParameterName = ownerTypeParameterNames[index];
        const typeArgument = currentInstantiatedType.typeArguments[index];
        if (typeParameterName && typeArgument) {
          substitution.set(typeParameterName, typeArgument);
        }
      }
      return substitution.size > 0 ? substitution : undefined;
    }

    const extendsClause = currentClass.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    );
    const heritageType = extendsClause?.types[0];
    if (!heritageType) {
      return undefined;
    }

    let nextType = resolveHeritageReferenceType(heritageType, ctx);
    if (
      currentInstantiatedType.kind === "referenceType" &&
      currentClass.typeParameters?.length &&
      currentInstantiatedType.typeArguments &&
      currentInstantiatedType.typeArguments.length ===
        currentClass.typeParameters.length
    ) {
      const currentSubstitution = new Map<string, IrType>();
      for (
        let index = 0;
        index < currentClass.typeParameters.length;
        index += 1
      ) {
        const typeParameterName = currentClass.typeParameters[index]?.name.text;
        const typeArgument = currentInstantiatedType.typeArguments[index];
        if (typeParameterName && typeArgument) {
          currentSubstitution.set(typeParameterName, typeArgument);
        }
      }
      if (currentSubstitution.size > 0) {
        nextType =
          ctx.typeSystem.substitute(nextType, currentSubstitution) ?? nextType;
      }
    }

    if (nextType.kind !== "referenceType") {
      return undefined;
    }

    currentInstantiatedType = nextType;
    currentClass =
      resolveClassDeclarationFromExpression(heritageType.expression, ctx) ??
      resolveSourceBackedClassDeclarationByName(nextType.name, ctx);
  }

  return undefined;
};

const resolveInstantiatedExportClassDeclaration = (
  exportedSymbol: SourceExportedTopLevelSymbol,
  topLevelClasses: ReadonlyMap<string, ts.ClassDeclaration>,
  ctx: ProgramContext
): ts.ClassDeclaration | undefined => {
  if (exportedSymbol.kind === "class") {
    return exportedSymbol.node as ts.ClassDeclaration;
  }

  if (exportedSymbol.kind !== "variable") {
    return undefined;
  }

  const declaration = exportedSymbol.node as ts.VariableDeclaration;
  const initializer = declaration.initializer;
  if (!initializer || !ts.isNewExpression(initializer)) {
    return undefined;
  }

  const localClass = ts.isIdentifier(initializer.expression)
    ? topLevelClasses.get(initializer.expression.text)
    : undefined;
  if (localClass) {
    return localClass;
  }

  return resolveClassDeclarationFromExpression(initializer.expression, ctx);
};

const resolveSourceBackedMemberAccessTarget = (
  node: ts.CallExpression,
  callee: Extract<IrCallExpression["callee"], { kind: "memberAccess" }>,
  receiverType: IrType | undefined,
  ctx: ProgramContext
): SourceBackedMemberAccessTarget | undefined => {
  if (callee.isComputed || typeof callee.property !== "string") {
    return undefined;
  }

  const receiverCandidates = collectSourceBackedReceiverTypeCandidates(
    callee.object,
    receiverType
  );

  for (const candidateReceiverType of receiverCandidates) {
    const packageExportTarget = resolveSourceBackedPackageExportSourceTarget(
      candidateReceiverType,
      ctx
    );
    if (packageExportTarget) {
      const exportedSymbol = collectExportedTopLevelSymbols(
        packageExportTarget.sourceFile
      ).find(
        (symbol) =>
          symbol.localName === packageExportTarget.exportName ||
          symbol.exportName === packageExportTarget.exportName
      );
      if (!exportedSymbol) {
        continue;
      }

      const topLevelClasses = collectTopLevelClassDeclarations(
        packageExportTarget.sourceFile
      );
      const ownerClass = resolveInstantiatedExportClassDeclaration(
        exportedSymbol,
        topLevelClasses,
        ctx
      );
      if (!ownerClass) {
        continue;
      }

      const overloadCandidates = collectClassMethodDeclarationsInHierarchy(
        ownerClass,
        callee.property,
        ctx
      );
      const declaration =
        overloadCandidates.find((candidate) => candidate.body === undefined) ??
        overloadCandidates[0];
      if (!declaration) {
        continue;
      }

      return {
        declaration,
        overloadCandidates,
        receiverType: candidateReceiverType,
      };
    }

    const sourceOrigin = resolveSourceBackedMemberSourceOrigin(
      candidateReceiverType,
      callee.property,
      ctx
    );
    if (sourceOrigin) {
      const sourceFile = getSourceFileForPath(sourceOrigin.filePath, ctx);
      if (!sourceFile || sourceFile.isDeclarationFile) {
        continue;
      }

      const exportedSymbol = collectExportedTopLevelSymbols(sourceFile).find(
        (symbol) => symbol.exportName === sourceOrigin.exportName
      );
      if (!exportedSymbol) {
        continue;
      }

      const topLevelClasses = collectTopLevelClassDeclarations(sourceFile);
      const ownerClass = resolveInstantiatedExportClassDeclaration(
        exportedSymbol,
        topLevelClasses,
        ctx
      );
      if (!ownerClass) {
        continue;
      }

      const overloadCandidates = collectClassMethodDeclarationsInHierarchy(
        ownerClass,
        callee.property,
        ctx
      );
      const declaration =
        overloadCandidates.find((candidate) => candidate.body === undefined) ??
        overloadCandidates[0];
      if (!declaration) {
        continue;
      }

      return {
        declaration,
        overloadCandidates,
        receiverType: candidateReceiverType,
      };
    }

    const receiverSimpleName =
      candidateReceiverType.name.split(".").pop() ?? candidateReceiverType.name;
    const binding = ctx.bindings.getExactBindingByKind(
      receiverSimpleName,
      "global"
    );
    if (!binding?.sourceImport) {
      continue;
    }

    const resolved = resolveImport(
      binding.sourceImport,
      node.getSourceFile().fileName,
      ctx.sourceRoot,
      {
        clrResolver: ctx.clrResolver,
        bindings: ctx.bindings,
        projectRoot: ctx.projectRoot,
        surface: ctx.surface,
        authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
        declarationModuleAliases: ctx.declarationModuleAliases,
      }
    );
    if (!resolved.ok || !resolved.value.resolvedPath) {
      continue;
    }

    const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
    if (!sourceFile || sourceFile.isDeclarationFile) {
      continue;
    }

    const exportedSymbol = collectExportedTopLevelSymbols(sourceFile).find(
      (symbol) => symbol.exportName === receiverSimpleName
    );
    if (!exportedSymbol) {
      continue;
    }

    const topLevelClasses = collectTopLevelClassDeclarations(sourceFile);
    const ownerClass = resolveInstantiatedExportClassDeclaration(
      exportedSymbol,
      topLevelClasses,
      ctx
    );
    if (!ownerClass) {
      continue;
    }

    const overloadCandidates = collectClassMethodDeclarationsInHierarchy(
      ownerClass,
      callee.property,
      ctx
    );
    const declaration =
      overloadCandidates.find((candidate) => candidate.body === undefined) ??
      overloadCandidates[0];
    if (!declaration) {
      continue;
    }

    return {
      declaration,
      overloadCandidates,
      receiverType: candidateReceiverType,
    };
  }

  return undefined;
};

const classContainsMethodInHierarchy = (
  ownerClass: ts.ClassDeclaration,
  candidateClass: ts.ClassDeclaration,
  ctx: ProgramContext,
  visited: ReadonlySet<string> = new Set<string>()
): boolean => {
  const ownerIdentity = getClassDeclarationIdentity(ownerClass);
  const candidateIdentity = getClassDeclarationIdentity(candidateClass);
  if (!ownerIdentity || !candidateIdentity) {
    return false;
  }

  if (ownerIdentity === candidateIdentity) {
    return true;
  }

  if (visited.has(ownerIdentity)) {
    return false;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(ownerIdentity);

  const heritageClauses = ownerClass.heritageClauses ?? [];
  for (const heritageClause of heritageClauses) {
    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }

    for (const heritageType of heritageClause.types) {
      const baseClass = resolveClassDeclarationFromExpression(
        heritageType.expression,
        ctx
      );
      if (
        baseClass &&
        classContainsMethodInHierarchy(
          baseClass,
          candidateClass,
          ctx,
          nextVisited
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

const getDeclarationTextName = (
  name: ts.PropertyName | ts.BindingName | ts.DeclarationName | undefined
): string | undefined => {
  if (!name) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  if (ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
};

type SourceBackedParameterSurface = {
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly returnType: IrType;
  readonly methodTypeParameterNames: readonly string[];
  readonly restParameter:
    | {
        readonly index: number;
        readonly arrayType: IrType | undefined;
        readonly elementType: IrType | undefined;
      }
    | undefined;
};

const buildSourceBackedParameterSurface = (
  declaration:
    | ts.FunctionDeclaration
    | ts.MethodDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction,
  ownerTypeParameterNames: readonly string[],
  receiverType: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext
): SourceBackedParameterSurface => {
  const declaredReturnType = declaration.type
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(declaration.type)
      )
    : ({ kind: "unknownType" } as const);
  const substitutedSurface = applySourceReceiverTypeSubstitution(
    declaration.parameters.map((parameter) =>
      buildFunctionParameterFromDeclaration(parameter, ctx)
    ),
    declaredReturnType,
    receiverType,
    ownerTypeParameterNames,
    ts.isClassLike(declaration.parent) ? declaration.parent : undefined,
    ctx
  );
  const optionalAwareParameterTypes = substitutedSurface.parameters.map(
    (parameter, index) =>
      parameter.type
        ? declaration.parameters[index]?.questionToken
          ? addUndefinedToType(parameter.type)
          : parameter.type
        : parameter.type
  );
  const parameterTypes = expandParameterTypesForArguments(
    substitutedSurface.parameters,
    optionalAwareParameterTypes,
    argumentCount
  );

  return {
    parameterTypes,
    returnType: substitutedSurface.returnType ?? { kind: "unknownType" },
    methodTypeParameterNames:
      declaration.typeParameters?.map((parameter) => parameter.name.text) ?? [],
    restParameter: buildResolvedRestParameter(
      substitutedSurface.parameters.map((parameter) => ({
        isRest: parameter.isRest,
      })),
      parameterTypes
    ),
  };
};

const NUMERIC_SOURCE_SURFACE_NAMES = new Set([
  "number",
  "int",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const isNumericSourceSurfaceType = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "primitiveType") {
    return NUMERIC_SOURCE_SURFACE_NAMES.has(type.name);
  }

  if (type.kind === "referenceType") {
    return NUMERIC_SOURCE_SURFACE_NAMES.has(type.name);
  }

  if (type.kind === "literalType") {
    return typeof type.value === "number";
  }

  if (type.kind === "unionType") {
    return (
      type.types.length > 0 &&
      type.types.every((member) => isNumericSourceSurfaceType(member))
    );
  }

  return false;
};

const scoreSourceSurfaceComplexity = (type: IrType | undefined): number => {
  if (!type) {
    return 0;
  }

  switch (type.kind) {
    case "unionType":
      return (
        type.types.length +
        type.types.reduce(
          (total, member) => total + scoreSourceSurfaceComplexity(member),
          0
        )
      );
    case "intersectionType":
      return (
        type.types.length +
        type.types.reduce(
          (total, member) => total + scoreSourceSurfaceComplexity(member),
          0
        )
      );
    case "arrayType":
      return 1 + scoreSourceSurfaceComplexity(type.elementType);
    case "tupleType":
      return (
        type.elementTypes.length +
        type.elementTypes.reduce(
          (total, member) => total + scoreSourceSurfaceComplexity(member),
          0
        )
      );
    case "referenceType":
      return (
        1 +
        (type.typeArguments?.reduce(
          (total, member) => total + scoreSourceSurfaceComplexity(member),
          0
        ) ?? 0)
      );
    case "functionType":
      return (
        1 +
        type.parameters.reduce(
          (total, parameter) =>
            total + scoreSourceSurfaceComplexity(parameter?.type),
          0
        ) +
        scoreSourceSurfaceComplexity(type.returnType)
      );
    default:
      return 1;
  }
};

type SourceBackedSurfaceScore = {
  readonly actualCoverageByIndex: readonly boolean[];
  readonly actualCoverageCount: number;
  readonly exactCount: number;
  readonly nonBroadCount: number;
  readonly compatibleCount: number;
  readonly complexity: number;
};

const scoreSourceBackedSurfaceCandidate = (
  candidateParameterTypes: readonly (IrType | undefined)[],
  selectedParameterTypes: readonly (IrType | undefined)[],
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): SourceBackedSurfaceScore => {
  const containsAmbiguousSourceSurfaceType = (
    type: IrType | undefined
  ): boolean => {
    if (!type) {
      return false;
    }

    switch (type.kind) {
      case "unknownType":
      case "anyType":
      case "typeParameterType":
        return true;
      case "arrayType":
        return containsAmbiguousSourceSurfaceType(type.elementType);
      case "tupleType":
        return type.elementTypes.some((member) =>
          containsAmbiguousSourceSurfaceType(member)
        );
      case "dictionaryType":
        return (
          containsAmbiguousSourceSurfaceType(type.keyType) ||
          containsAmbiguousSourceSurfaceType(type.valueType)
        );
      case "referenceType":
        return (
          (type.typeArguments?.some((member) =>
            containsAmbiguousSourceSurfaceType(member)
          ) ??
            false) ||
          (type.structuralMembers?.some((member) => {
            if (member.kind === "propertySignature") {
              return containsAmbiguousSourceSurfaceType(member.type);
            }

            return (
              member.parameters.some((parameter) =>
                containsAmbiguousSourceSurfaceType(parameter.type)
              ) || containsAmbiguousSourceSurfaceType(member.returnType)
            );
          }) ??
            false)
        );
      case "unionType":
      case "intersectionType":
        return type.types.some((member) =>
          containsAmbiguousSourceSurfaceType(member)
        );
      case "functionType":
        return (
          type.parameters.some((parameter) =>
            containsAmbiguousSourceSurfaceType(parameter.type)
          ) || containsAmbiguousSourceSurfaceType(type.returnType)
        );
      case "objectType":
        return type.members.some((member) => {
          if (member.kind === "propertySignature") {
            return containsAmbiguousSourceSurfaceType(member.type);
          }

          return (
            member.parameters.some((parameter) =>
              containsAmbiguousSourceSurfaceType(parameter.type)
            ) || containsAmbiguousSourceSurfaceType(member.returnType)
          );
        });
      default:
        return false;
    }
  };
  const candidateCoversActualArg = (
    candidateType: IrType | undefined,
    actualType: IrType | undefined
  ): boolean => {
    if (!candidateType || !actualType) {
      return false;
    }

    if (
      candidateType.kind === "unknownType" ||
      candidateType.kind === "anyType" ||
      (candidateType.kind === "unionType" &&
        candidateType.types.some(
          (member) => member.kind === "unknownType" || member.kind === "anyType"
        ))
    ) {
      return true;
    }

    if (ctx.typeSystem.typesEqual(candidateType, actualType)) {
      return true;
    }

    return ctx.typeSystem.isAssignableTo(actualType, candidateType);
  };
  const isBroadSourceSurfaceType = (type: IrType | undefined): boolean => {
    if (!type) {
      return false;
    }

    switch (type.kind) {
      case "anyType":
      case "unknownType":
      case "typeParameterType":
        return true;
      case "objectType":
        return true;
      case "referenceType":
        return (
          type.name === "object" ||
          containsAmbiguousSourceSurfaceType(type)
        );
      case "unionType":
        return type.types.every((member) => isBroadSourceSurfaceType(member));
      default:
        return false;
    }
  };
  let compatibleCount = 0;
  let actualCoverageCount = 0;
  let exactCount = 0;
  let nonBroadCount = 0;
  let complexity = 0;
  const actualCoverageByIndex: boolean[] = [];

  const pairCount = Math.min(
    candidateParameterTypes.length,
    selectedParameterTypes.length
  );
  for (let index = 0; index < pairCount; index += 1) {
    const candidate = candidateParameterTypes[index];
    const selected = selectedParameterTypes[index];
    complexity += scoreSourceSurfaceComplexity(candidate);

    if (!candidate || !selected) {
      continue;
    }

    const actualArgType = actualArgTypes?.[index];
    if (candidateCoversActualArg(candidate, actualArgType)) {
      actualCoverageCount += 1;
      actualCoverageByIndex[index] = true;
    } else {
      actualCoverageByIndex[index] = false;
    }
    if (!isBroadSourceSurfaceType(candidate)) {
      nonBroadCount += 1;
    }

    if (ctx.typeSystem.typesEqual(selected, candidate)) {
      compatibleCount += 1;
      exactCount += 1;
      continue;
    }

    if (
      ctx.typeSystem.isAssignableTo(selected, candidate) ||
      ctx.typeSystem.isAssignableTo(candidate, selected) ||
      (isNumericSourceSurfaceType(selected) &&
        isNumericSourceSurfaceType(candidate))
    ) {
      compatibleCount += 1;
    }
  }

  return {
    actualCoverageByIndex,
    actualCoverageCount,
    exactCount,
    nonBroadCount,
    compatibleCount,
    complexity: -complexity,
  };
};

const compareSourceSurfaceScores = (
  left: SourceBackedSurfaceScore,
  right: SourceBackedSurfaceScore
): number => {
  const coverageCount = Math.max(
    left.actualCoverageByIndex.length,
    right.actualCoverageByIndex.length
  );
  for (let index = 0; index < coverageCount; index += 1) {
    const delta =
      Number(left.actualCoverageByIndex[index] ?? false) -
      Number(right.actualCoverageByIndex[index] ?? false);
    if (delta !== 0) {
      return delta;
    }
  }

  const deltas = [
    left.actualCoverageCount - right.actualCoverageCount,
    left.exactCount - right.exactCount,
    left.nonBroadCount - right.nonBroadCount,
    left.compatibleCount - right.compatibleCount,
    left.complexity - right.complexity,
  ];
  for (const delta of deltas) {
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const containsUnknownishContextualType = (
  type: IrType | undefined,
  seen: WeakSet<object> = new WeakSet<object>()
): boolean => {
  if (!type) {
    return false;
  }

  if (seen.has(type)) {
    return false;
  }
  seen.add(type);

  switch (type.kind) {
    case "unknownType":
    case "anyType":
    case "typeParameterType":
      return true;
    case "arrayType":
      return containsUnknownishContextualType(type.elementType, seen);
    case "tupleType":
      return type.elementTypes.some((member) =>
        containsUnknownishContextualType(member, seen)
      );
    case "dictionaryType":
      return (
        containsUnknownishContextualType(type.keyType, seen) ||
        containsUnknownishContextualType(type.valueType, seen)
      );
    case "referenceType":
      return (
        (type.typeArguments?.some((member) =>
          containsUnknownishContextualType(member, seen)
        ) ??
          false) ||
        (type.structuralMembers?.some((member) => {
          if (member.kind === "propertySignature") {
            return containsUnknownishContextualType(member.type, seen);
          }

          return (
            member.parameters.some((parameter) =>
              containsUnknownishContextualType(parameter.type, seen)
            ) || containsUnknownishContextualType(member.returnType, seen)
          );
        }) ??
          false)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((member) =>
        containsUnknownishContextualType(member, seen)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsUnknownishContextualType(parameter.type, seen)
        ) || containsUnknownishContextualType(type.returnType, seen)
      );
    case "objectType":
      return type.members.some((member) => {
        if (member.kind === "propertySignature") {
          return containsUnknownishContextualType(member.type, seen);
        }

        return (
          member.parameters.some((parameter) =>
            containsUnknownishContextualType(parameter.type, seen)
          ) || containsUnknownishContextualType(member.returnType, seen)
        );
      });
    default:
      return false;
  }
};

const mergeContextualTypes = (
  primary: IrType | undefined,
  fallback: IrType | undefined
): IrType | undefined => {
  if (!primary) {
    return fallback;
  }

  if (!fallback || !containsUnknownishContextualType(primary)) {
    return primary;
  }

  if (primary.kind === "functionType" && fallback.kind === "functionType") {
    return {
      ...primary,
      parameters: primary.parameters.map((parameter, index) => ({
        ...parameter,
        type: mergeContextualTypes(
          parameter.type,
          fallback.parameters[index]?.type
        ),
      })),
      returnType:
        mergeContextualTypes(primary.returnType, fallback.returnType) ??
        primary.returnType,
    };
  }

  if (primary.kind === "arrayType" && fallback.kind === "arrayType") {
    return {
      ...primary,
      elementType:
        mergeContextualTypes(primary.elementType, fallback.elementType) ??
        primary.elementType,
    };
  }

  if (
    primary.kind === "tupleType" &&
    fallback.kind === "tupleType" &&
    primary.elementTypes.length === fallback.elementTypes.length
  ) {
    return {
      ...primary,
      elementTypes: primary.elementTypes.map(
        (member, index) =>
          mergeContextualTypes(member, fallback.elementTypes[index]) ?? member
      ),
    };
  }

  if (
    primary.kind === "referenceType" &&
    fallback.kind === "referenceType" &&
    (primary.typeArguments?.length ?? 0) ===
      (fallback.typeArguments?.length ?? 0)
  ) {
    const primaryIdentity = referenceTypeIdentity(primary);
    const fallbackIdentity = referenceTypeIdentity(fallback);
    if (
      primaryIdentity === undefined ||
      fallbackIdentity === undefined ||
      primaryIdentity !== fallbackIdentity
    ) {
      return primary;
    }

    return {
      ...primary,
      ...(primary.typeArguments
        ? {
            typeArguments: primary.typeArguments.map(
              (member, index) =>
                mergeContextualTypes(member, fallback.typeArguments?.[index]) ??
                member
            ),
          }
        : {}),
    };
  }

  return fallback;
};

const mergeContextualParameterTypes = (
  primary: readonly (IrType | undefined)[] | undefined,
  fallback: readonly (IrType | undefined)[] | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  const count = Math.max(primary.length, fallback.length);
  return Array.from({ length: count }, (_, index) =>
    mergeContextualTypes(primary[index], fallback[index])
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
  ctx: ProgramContext
): IrParameter => ({
  kind: "parameter",
  pattern: ts.isIdentifier(parameter.name)
    ? { kind: "identifierPattern", name: parameter.name.text }
    : { kind: "identifierPattern", name: `p${parameter.pos}` },
  type: parameter.type
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(parameter.type)
      )
    : { kind: "unknownType" },
  initializer: undefined,
  isOptional: !!parameter.questionToken || !!parameter.initializer,
  isRest: !!parameter.dotDotDotToken,
  passing: "value",
});

const buildSourceReceiverTypeSubstitution = (
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  receiverType: IrType | undefined,
  ownerTypeParameterNames: readonly string[],
  ownerClassDeclaration: ts.ClassLikeDeclaration | undefined,
  ctx: ProgramContext
): ReadonlyMap<string, IrType> | undefined => {
  if (!receiverType || ownerTypeParameterNames.length === 0) {
    return undefined;
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

  if (substitution.size === 0) {
    const localReceiverSubstitution = buildLocalReceiverOwnerTypeSubstitution(
      receiverType,
      ownerClassDeclaration,
      ownerTypeParameterNames,
      ctx
    );
    if (localReceiverSubstitution) {
      for (const [
        typeParameterName,
        typeArgument,
      ] of localReceiverSubstitution) {
        substitution.set(typeParameterName, typeArgument);
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
    collect(returnType);

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

  return substitution.size > 0 ? substitution : undefined;
};

const applySourceReceiverTypeSubstitution = (
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  receiverType: IrType | undefined,
  ownerTypeParameterNames: readonly string[],
  ownerClassDeclaration: ts.ClassLikeDeclaration | undefined,
  ctx: ProgramContext
): {
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
} => {
  const substitution = buildSourceReceiverTypeSubstitution(
    parameters,
    returnType,
    receiverType,
    ownerTypeParameterNames,
    ownerClassDeclaration,
    ctx
  );
  if (!substitution) {
    return {
      parameters: parameters.map((parameter) => ({
        ...parameter,
        type:
          receiverType && parameter.type
            ? (substitutePolymorphicThis(parameter.type, receiverType) ??
              parameter.type)
            : parameter.type,
      })),
      returnType:
        receiverType && returnType
          ? (substitutePolymorphicThis(returnType, receiverType) ?? returnType)
          : returnType,
    };
  }

  const substitutedParameters = parameters.map((parameter) => ({
    ...parameter,
    type: parameter.type
      ? ctx.typeSystem.substitute(parameter.type, substitution)
      : parameter.type,
  }));
  const substitutedReturnType = returnType
    ? (ctx.typeSystem.substitute(returnType, substitution) ?? returnType)
    : returnType;

  return {
    parameters: substitutedParameters.map((parameter) => ({
      ...parameter,
      type:
        receiverType && parameter.type
          ? (substitutePolymorphicThis(parameter.type, receiverType) ??
            parameter.type)
          : parameter.type,
    })),
    returnType:
      receiverType && substitutedReturnType
        ? (substitutePolymorphicThis(substitutedReturnType, receiverType) ??
          substitutedReturnType)
        : substitutedReturnType,
  };
};

export const getSourceBackedCallParameterTypes = (
  node: ts.CallExpression,
  callee: IrCallExpression["callee"],
  receiverType: IrType | undefined,
  argumentCount: number,
  selectedParameterTypes: readonly (IrType | undefined)[] | undefined,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
):
  | {
      readonly parameterTypes: readonly (IrType | undefined)[];
      readonly surfaceParameterTypes: readonly (IrType | undefined)[];
      readonly returnType: IrType;
      readonly restParameter:
        | {
            readonly index: number;
            readonly arrayType: IrType | undefined;
            readonly elementType: IrType | undefined;
          }
        | undefined;
    }
  | undefined => {
  const identifierSourceTarget =
    callee.kind === "identifier"
      ? resolveSourceBackedIdentifierGlobalTarget(node, callee, ctx)
      : undefined;
  const memberAccessSourceTarget =
    callee.kind === "memberAccess"
      ? resolveSourceBackedMemberAccessTarget(node, callee, receiverType, ctx)
      : undefined;
  if (
    (callee.kind !== "memberAccess" ||
      (!callee.memberBinding && !memberAccessSourceTarget)) &&
    !identifierSourceTarget
  ) {
    return undefined;
  }

  if (identifierSourceTarget) {
    const runtimeSurface = buildSourceBackedParameterSurface(
      identifierSourceTarget.declaration,
      identifierSourceTarget.ownerTypeParameterNames,
      receiverType,
      argumentCount,
      ctx
    );

    const surfaceParameterSurface = (() => {
      if (!selectedParameterTypes) {
        return runtimeSurface;
      }

      const overloadCandidates = getPublicSourceBackedOverloadCandidates(
        identifierSourceTarget.overloadCandidates
      );
      let bestSurface = runtimeSurface;
      let bestScore = scoreSourceBackedSurfaceCandidate(
        runtimeSurface.parameterTypes,
        selectedParameterTypes,
        actualArgTypes,
        ctx
      );

      for (const candidate of overloadCandidates) {
        const candidateSurface = buildSourceBackedParameterSurface(
          candidate,
          identifierSourceTarget.ownerTypeParameterNames,
          receiverType,
          argumentCount,
          ctx
        );
        const candidateScore = scoreSourceBackedSurfaceCandidate(
          candidateSurface.parameterTypes,
          selectedParameterTypes,
          actualArgTypes,
          ctx
        );
        if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
          bestSurface = candidateSurface;
          bestScore = candidateScore;
        }
      }

      return bestSurface;
    })();

    const substitutions = deriveInvocationTypeSubstitutions(
      surfaceParameterSurface.parameterTypes,
      actualArgTypes,
      surfaceParameterSurface.returnType,
      expectedType,
      surfaceParameterSurface.methodTypeParameterNames,
      explicitTypeArgs,
      ctx
    );
    const specializeType = (type: IrType | undefined): IrType | undefined =>
      substitutions ? substituteTypeParameters(type, substitutions) : type;
    const surfaceParameterTypes = surfaceParameterSurface.parameterTypes.map(
      (type) => specializeType(type)
    );
    const selectionParameterTypes = surfaceParameterTypes.map(
      (type) =>
        expandAuthoritativeSourceBackedSurfaceType(type, ctx, new Set(), {
          preserveCarrierIdentity: false,
        }) ?? type
    );

    return {
      parameterTypes: selectionParameterTypes.map((type, index) =>
        selectDeterministicSourceBackedParameterType(
          type,
          actualArgTypes?.[index],
          ctx
        )
      ),
      surfaceParameterTypes,
      returnType:
        specializeType(surfaceParameterSurface.returnType) ??
        surfaceParameterSurface.returnType,
      restParameter: surfaceParameterSurface.restParameter,
    };
  }

  if (memberAccessSourceTarget) {
    const buildCandidateSurface = (
      candidate: ts.MethodDeclaration
    ): SourceBackedParameterSurface =>
      buildSourceBackedParameterSurface(
        candidate,
        ts.isClassLike(candidate.parent)
          ? (candidate.parent.typeParameters?.map(
              (parameter) => parameter.name.text
            ) ?? [])
          : [],
        memberAccessSourceTarget.receiverType,
        argumentCount,
        ctx
      );

    let bestSurface = buildCandidateSurface(
      memberAccessSourceTarget.declaration
    );
    let bestScore = scoreSourceBackedSurfaceCandidate(
      bestSurface.parameterTypes,
      selectedParameterTypes ?? [],
      actualArgTypes,
      ctx
    );

    const overloadCandidates = getPublicSourceBackedOverloadCandidates(
      memberAccessSourceTarget.overloadCandidates
    );
    for (const candidate of overloadCandidates) {
      const candidateSurface = buildCandidateSurface(candidate);
      const candidateScore = scoreSourceBackedSurfaceCandidate(
        candidateSurface.parameterTypes,
        selectedParameterTypes ?? [],
        actualArgTypes,
        ctx
      );
      if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
        bestSurface = candidateSurface;
        bestScore = candidateScore;
      }
    }

    const substitutions = deriveInvocationTypeSubstitutions(
      bestSurface.parameterTypes,
      actualArgTypes,
      bestSurface.returnType,
      expectedType,
      bestSurface.methodTypeParameterNames,
      explicitTypeArgs,
      ctx
    );
    const specializeType = (type: IrType | undefined): IrType | undefined =>
      substitutions ? substituteTypeParameters(type, substitutions) : type;
    const surfaceParameterTypes = bestSurface.parameterTypes.map((type) =>
      specializeType(type)
    );
    const selectionParameterTypes = surfaceParameterTypes.map(
      (type) =>
        expandAuthoritativeSourceBackedSurfaceType(type, ctx, new Set(), {
          preserveCarrierIdentity: false,
        }) ?? type
    );

    return {
      parameterTypes: selectionParameterTypes.map((type, index) =>
        selectDeterministicSourceBackedParameterType(
          type,
          actualArgTypes?.[index],
          ctx
        )
      ),
      surfaceParameterTypes,
      returnType:
        specializeType(bestSurface.returnType) ?? bestSurface.returnType,
      restParameter: bestSurface.restParameter,
    };
  }

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
      (candidate): candidate is NonNullable<MemberBinding["sourceOrigin"]> =>
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
  const topLevelClasses = collectTopLevelClassDeclarations(sourceFile);
  const exportedCallableTarget = resolveSourceBackedExportedFunctionTarget(
    sourceFile,
    exportedSymbol,
    resolvedSignatureDeclaration
  );
  const ownerClass = resolveInstantiatedExportClassDeclaration(
    exportedSymbol,
    topLevelClasses,
    ctx
  );

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
      return exportedCallableTarget;
    }

    if (exportedCallableTarget && !ownerClass) {
      return exportedCallableTarget;
    }

    if (
      !resolvedSignatureDeclaration ||
      !ts.isMethodDeclaration(resolvedSignatureDeclaration)
    ) {
      return undefined;
    }

    if (
      resolvedSignatureDeclaration.name === undefined ||
      !(
        ts.isIdentifier(resolvedSignatureDeclaration.name) ||
        ts.isStringLiteral(resolvedSignatureDeclaration.name)
      ) ||
      resolvedSignatureDeclaration.name.text !== sourceOrigin.memberName
    ) {
      return undefined;
    }

    if (!ownerClass) {
      return undefined;
    }

    const resolvedOwner = resolvedSignatureDeclaration.parent;
    if (!ts.isClassLike(resolvedOwner)) {
      return undefined;
    }

    if (
      !classContainsMethodInHierarchy(
        ownerClass,
        resolvedOwner as ts.ClassDeclaration,
        ctx
      )
    ) {
      return undefined;
    }

    return {
      declaration: resolvedSignatureDeclaration,
      ownerTypeParameterNames:
        resolvedOwner.typeParameters?.map((parameter) => parameter.name.text) ??
        [],
    };
  };

  const signature = resolveSignatureDeclaration();
  if (!signature) {
    return undefined;
  }

  const runtimeSurface = buildSourceBackedParameterSurface(
    signature.declaration,
    signature.ownerTypeParameterNames,
    receiverType,
    argumentCount,
    ctx
  );

  const surfaceParameterSurface = (() => {
    if (!selectedParameterTypes) {
      return runtimeSurface;
    }

    if (!ts.isMethodDeclaration(signature.declaration)) {
      if (exportedSymbol.kind !== "function") {
        return runtimeSurface;
      }

      const candidates = sourceFile.statements.flatMap((statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === exportedSymbol.localName
          ? [statement]
          : []
      );
      if (candidates.length === 0) {
        return runtimeSurface;
      }

      const publicCandidates =
        getPublicSourceBackedOverloadCandidates(candidates);
      let bestSurface = runtimeSurface;
      let bestScore = scoreSourceBackedSurfaceCandidate(
        runtimeSurface.parameterTypes,
        selectedParameterTypes,
        actualArgTypes,
        ctx
      );
      for (const candidate of publicCandidates) {
        const candidateSurface = buildSourceBackedParameterSurface(
          candidate,
          [],
          receiverType,
          argumentCount,
          ctx
        );
        const candidateScore = scoreSourceBackedSurfaceCandidate(
          candidateSurface.parameterTypes,
          selectedParameterTypes,
          actualArgTypes,
          ctx
        );
        if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
          bestSurface = candidateSurface;
          bestScore = candidateScore;
        }
      }

      return bestSurface;
    }

    const resolvedOwner = signature.declaration.parent;
    if (!ts.isClassLike(resolvedOwner)) {
      return runtimeSurface;
    }

    const methodCandidates = resolvedOwner.members.flatMap((member) =>
      ts.isMethodDeclaration(member) &&
      getDeclarationTextName(member.name) === sourceOrigin.memberName
        ? [member]
        : []
    );
    if (methodCandidates.length === 0) {
      return runtimeSurface;
    }

    const publicMethodCandidates =
      getPublicSourceBackedOverloadCandidates(methodCandidates);
    let bestSurface = runtimeSurface;
    let bestScore = scoreSourceBackedSurfaceCandidate(
      runtimeSurface.parameterTypes,
      selectedParameterTypes,
      actualArgTypes,
      ctx
    );
    for (const candidate of publicMethodCandidates) {
      const candidateSurface = buildSourceBackedParameterSurface(
        candidate,
        signature.ownerTypeParameterNames,
        receiverType,
        argumentCount,
        ctx
      );
      const candidateScore = scoreSourceBackedSurfaceCandidate(
        candidateSurface.parameterTypes,
        selectedParameterTypes,
        actualArgTypes,
        ctx
      );
      if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
        bestSurface = candidateSurface;
        bestScore = candidateScore;
      }
    }

    return bestSurface;
  })();

  const substitutions = deriveInvocationTypeSubstitutions(
    surfaceParameterSurface.parameterTypes,
    actualArgTypes,
    surfaceParameterSurface.returnType,
    expectedType,
    surfaceParameterSurface.methodTypeParameterNames,
    explicitTypeArgs,
    ctx
  );
  const specializeType = (type: IrType | undefined): IrType | undefined =>
    substitutions ? substituteTypeParameters(type, substitutions) : type;
  const surfaceParameterTypes = surfaceParameterSurface.parameterTypes.map(
    (type) => specializeType(type)
  );
  const selectionParameterTypes = surfaceParameterTypes.map(
    (type) =>
      expandAuthoritativeSourceBackedSurfaceType(type, ctx, new Set(), {
        preserveCarrierIdentity: false,
      }) ?? type
  );

  return {
    parameterTypes: selectionParameterTypes.map((type, index) =>
      selectDeterministicSourceBackedParameterType(
        type,
        actualArgTypes?.[index],
        ctx
      )
    ),
    surfaceParameterTypes,
    returnType:
      specializeType(surfaceParameterSurface.returnType) ??
      surfaceParameterSurface.returnType,
    restParameter: surfaceParameterSurface.restParameter,
  };
};

const getExplicitExtensionReceiverExpectedType = (
  callee: IrCallExpression["callee"],
  finalResolved:
    | ReturnType<ProgramContext["typeSystem"]["resolveCall"]>
    | undefined,
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
      (candidate): candidate is NonNullable<MemberBinding["sourceOrigin"]> =>
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
  const exactDeclaringClrType =
    callee.kind === "memberAccess" ? callee.memberBinding?.type : undefined;

  // Resolve call (two-pass):
  // 1) Resolve parameter types (for expectedType threading)
  // 2) Convert arguments, then re-resolve with argTypes to infer generics deterministically
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveCallSignature(node);
  const candidateSigIds = ctx.binding.resolveCallSignatureCandidates(node);
  const exactMemberCallableType = (() => {
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
    if (!receiverIrType) return undefined;

    const directStructuralMemberType = getDirectStructuralMemberType(
      receiverIrType,
      node.expression.name.text
    );
    if (directStructuralMemberType) {
      return directStructuralMemberType;
    }

    const memberId = ctx.binding.resolvePropertyAccess(node.expression);
    if (!memberId) return undefined;

    return typeSystem.typeOfMemberId(memberId, receiverIrType);
  })();
  const useDirectCallableCandidateResolution = !sigId;
  const argumentCount = node.arguments.length;
  const callSiteArgModifiers: (CallSiteArgModifier | undefined)[] = new Array(
    argumentCount
  ).fill(undefined);

  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;
  const usesAuthoritativeSurfaceBindings = ctx.surface !== "clr";
  const boundGlobalCallParameterTypes = getBoundGlobalCallParameterTypes(
    callee,
    argumentCount,
    ctx
  );
  const authoritativeBoundGlobalSurfaceParameterTypes =
    usesAuthoritativeSurfaceBindings
      ? boundGlobalCallParameterTypes?.parameterTypes
      : undefined;
  const authoritativeBoundGlobalReturnType = usesAuthoritativeSurfaceBindings
    ? boundGlobalCallParameterTypes?.returnType
    : undefined;
  const ambientBoundGlobalSurfaceParameterTypes =
    !usesAuthoritativeSurfaceBindings &&
    boundGlobalCallParameterTypes &&
    callee.inferredType?.kind === "functionType"
      ? expandParameterTypesForArguments(
          callee.inferredType.parameters,
          callee.inferredType.parameters.map((parameter) => parameter.type),
          argumentCount
        )
      : undefined;

  const callableCandidateSourceType =
    callee.inferredType === undefined ||
    callee.inferredType.kind === "unknownType"
      ? exactMemberCallableType
      : callee.inferredType;

  // If we can't resolve a signature handle (common for calls through function-typed
  // variables), fall back to the callee's inferred function type.
  const initialCallableResolution = resolveCallableCandidate(
    callableCandidateSourceType,
    argumentCount,
    ctx,
    undefined,
    explicitTypeArgs,
    expectedType
  );
  const calleeFunctionType = initialCallableResolution?.callableType;

  const initialResolved =
    sigId && !useDirectCallableCandidateResolution
      ? typeSystem.resolveCall({
          sigId,
          argumentCount,
          receiverType: receiverIrType,
          declaringClrType: exactDeclaringClrType,
          explicitTypeArgs,
          expectedReturnType: expectedType,
        })
      : undefined;
  const sourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    argumentCount,
    initialResolved?.parameterTypes ??
      initialCallableResolution?.resolved?.parameterTypes,
    undefined,
    expectedType,
    explicitTypeArgs,
    ctx
  );
  const authoritativeDirectCalleeParameterTypes =
    getAuthoritativeDirectCalleeParameterTypes(callee, argumentCount, ctx);
  const expectedReturnCandidates = expectedType
    ? typeSystem.collectExpectedReturnCandidates(expectedType)
    : undefined;
  const initialParameterTypes = (() => {
    if (boundGlobalCallParameterTypes?.parameterTypes) {
      return boundGlobalCallParameterTypes.parameterTypes;
    }

    const resolvedReturnSubstitutions = deriveSubstitutionsFromExpectedReturn(
      initialResolved?.returnType,
      expectedReturnCandidates
    );
    if (resolvedReturnSubstitutions && initialResolved?.parameterTypes) {
      return initialResolved.parameterTypes.map((t) =>
        substituteTypeParameters(t, resolvedReturnSubstitutions)
      );
    }

    const sourceBackedReturnSubstitutions =
      deriveSubstitutionsFromExpectedReturn(
        sourceBackedCallParameterTypes?.returnType,
        expectedReturnCandidates
      );
    if (
      sourceBackedReturnSubstitutions &&
      sourceBackedCallParameterTypes?.parameterTypes
    ) {
      return sourceBackedCallParameterTypes.parameterTypes.map((t) =>
        substituteTypeParameters(t, sourceBackedReturnSubstitutions)
      );
    }

    return (
      authoritativeDirectCalleeParameterTypes ??
      mergeContextualParameterTypes(
        initialResolved?.parameterTypes,
        initialCallableResolution?.resolved?.parameterTypes
      ) ??
      initialResolved?.parameterTypes ??
      initialCallableResolution?.resolved?.parameterTypes ??
      sourceBackedCallParameterTypes?.parameterTypes
    );
  })();
  const initialSurfaceParameterTypes = (() => {
    return (
      authoritativeBoundGlobalSurfaceParameterTypes ??
      sourceBackedCallParameterTypes?.surfaceParameterTypes ??
      ambientBoundGlobalSurfaceParameterTypes ??
      authoritativeDirectCalleeParameterTypes ??
      mergeContextualParameterTypes(
        initialResolved?.surfaceParameterTypes,
        initialCallableResolution?.resolved?.surfaceParameterTypes ??
          initialCallableResolution?.resolved?.parameterTypes
      ) ??
      initialResolved?.surfaceParameterTypes ??
      initialCallableResolution?.resolved?.surfaceParameterTypes ??
      initialCallableResolution?.resolved?.parameterTypes
    );
  })();
  const initialFunctionParameterTypes =
    initialCallableResolution?.resolved?.parameterTypes;
  const initialParameterTypesForContext =
    initialSurfaceParameterTypes ??
    initialParameterTypes ??
    sourceBackedCallParameterTypes?.parameterTypes ??
    initialFunctionParameterTypes;

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
    if (
      !parameterType ||
      !ctx.typeSystem.containsTypeParameter(parameterType)
    ) {
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
  const deferredAggregateContextIndices = new Set<number>();

  for (let index = 0; index < node.arguments.length; index++) {
    const arg = node.arguments[index];
    if (!arg) continue;

    const expectedType = initialParameterTypesForContext?.[index];

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
      if (shouldDeferLambdaForInference(unwrapped.expression)) {
        argTypesForInference[index] = buildDeferredLambdaInferenceType(
          unwrapped.expression
        );
      }
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
    const shouldRecontextualizeAggregateLater =
      deferAggregateContext ||
      (expectedType === undefined &&
        (ts.isObjectLiteralExpression(stripParentheses(unwrapped.expression)) ||
          ts.isArrayLiteralExpression(stripParentheses(unwrapped.expression))));

    const converted = convertExpression(
      unwrapped.expression,
      ctx,
      deferAggregateContext ? undefined : expectedType
    );
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
    if (shouldRecontextualizeAggregateLater) {
      deferredAggregateContextIndices.add(index);
    }
  }

  const lambdaContextSelection =
    sigId && !useDirectCallableCandidateResolution
      ? typeSystem.selectBestCallCandidate(sigId, candidateSigIds, {
          argumentCount,
          receiverType: receiverIrType,
          declaringClrType: exactDeclaringClrType,
          explicitTypeArgs,
          argTypes: argTypesForInference,
          expectedReturnType: expectedType,
        })
      : undefined;
  const lambdaContextResolved =
    lambdaContextSelection?.resolved ?? initialResolved;
  const lambdaContextCallableResolution = resolveCallableCandidate(
    callableCandidateSourceType,
    argumentCount,
    ctx,
    argTypesForInference,
    explicitTypeArgs,
    expectedType
  );
  const lambdaContextFunctionType =
    lambdaContextCallableResolution?.callableType ?? calleeFunctionType;
  const lambdaContextFunctionParameterTypes =
    lambdaContextCallableResolution?.resolved?.parameterTypes;
  const lambdaContextSurfaceParameterTypes =
    authoritativeBoundGlobalSurfaceParameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes ??
    mergeContextualParameterTypes(
      lambdaContextResolved?.surfaceParameterTypes,
      lambdaContextCallableResolution?.resolved?.surfaceParameterTypes ??
        lambdaContextCallableResolution?.resolved?.parameterTypes
    ) ??
    lambdaContextResolved?.surfaceParameterTypes ??
    lambdaContextCallableResolution?.resolved?.surfaceParameterTypes ??
    lambdaContextCallableResolution?.resolved?.parameterTypes;
  const lambdaContextResolvedParameterTypes =
    mergeContextualParameterTypes(
      lambdaContextResolved?.parameterTypes,
      lambdaContextCallableResolution?.resolved?.parameterTypes
    ) ??
    lambdaContextResolved?.parameterTypes ??
    lambdaContextCallableResolution?.resolved?.parameterTypes ??
    lambdaContextFunctionParameterTypes;
  const deferredContextParameterTypes =
    mergeContextualParameterTypes(
      lambdaContextResolvedParameterTypes,
      lambdaContextSurfaceParameterTypes
    ) ?? lambdaContextSurfaceParameterTypes;

  const parameterTypesForDeferredContext =
    mergeContextualParameterTypes(
      deferredContextParameterTypes,
      initialParameterTypesForContext
    ) ?? initialParameterTypesForContext;

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
    const shouldRecontextualizeAggregateLater =
      deferredAggregateContextIndices.has(index);
    if (
      !isDeferredLambda &&
      !isDeferredGenericFunctionValue &&
      !shouldRecontextualizeAggregateLater
    ) {
      continue;
    }

    const expectedType = parameterTypesForDeferredContext?.[index];
    const contextualExpectedType = getLambdaContextualExpectedType(
      expectedType,
      typeSystem
    );

    if (
      shouldRecontextualizeAggregateLater &&
      expectedType &&
      ctx.typeSystem.containsTypeParameter(expectedType)
    ) {
      continue;
    }

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

  const finalResolutionArgumentCount =
    resolutionArgs.argumentCount > 0
      ? resolutionArgs.argumentCount
      : argumentCount;
  const finalResolutionArgTypes =
    resolutionArgs.argumentCount > 0 ? resolutionArgs.argTypes : argTypes;
  const finalSelection =
    sigId && !useDirectCallableCandidateResolution
      ? typeSystem.selectBestCallCandidate(sigId, candidateSigIds, {
          argumentCount: finalResolutionArgumentCount,
          receiverType: receiverIrType,
          declaringClrType: exactDeclaringClrType,
          explicitTypeArgs,
          argTypes: finalResolutionArgTypes,
          expectedReturnType: expectedType,
        })
      : undefined;
  const finalResolved = finalSelection?.resolved ?? lambdaContextResolved;
  const finalCallableResolution = useDirectCallableCandidateResolution
    ? resolveCallableCandidate(
        callableCandidateSourceType,
        finalResolutionArgumentCount,
        ctx,
        finalResolutionArgTypes,
        explicitTypeArgs,
        expectedType
      )
    : undefined;
  const directCalleeCallableType =
    callee.inferredType && callee.inferredType.kind !== "unknownType"
      ? callee.inferredType
      : undefined;
  const exactMemberCallableResolution =
    exactMemberCallableType && exactMemberCallableType.kind !== "unknownType"
      ? resolveCallableCandidate(
          exactMemberCallableType,
          finalResolutionArgumentCount,
          ctx,
          finalResolutionArgTypes,
          explicitTypeArgs,
          expectedType
        )
      : undefined;
  const directCalleeCallableResolution = directCalleeCallableType
    ? resolveCallableCandidate(
        directCalleeCallableType,
        finalResolutionArgumentCount,
        ctx,
        finalResolutionArgTypes,
        explicitTypeArgs,
        expectedType
      )
    : undefined;
  const finalFunctionType =
    finalCallableResolution?.callableType ??
    lambdaContextFunctionType ??
    calleeFunctionType ??
    (directCalleeCallableType?.kind === "functionType"
      ? directCalleeCallableType
      : undefined);
  const finalFunctionParameterTypes = useDirectCallableCandidateResolution
    ? finalCallableResolution?.resolved?.parameterTypes
    : undefined;
  const finalSourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    finalResolutionArgumentCount,
    finalResolved?.parameterTypes ??
      finalFunctionParameterTypes ??
      initialParameterTypesForContext,
    finalResolutionArgTypes,
    expectedType,
    explicitTypeArgs,
    ctx
  );
  const authoritativeFinalDirectCalleeParameterTypes =
    getAuthoritativeDirectCalleeParameterTypes(
      callee,
      finalResolutionArgumentCount,
      ctx
    );
  const explicitSemanticRestParameter = (() => {
    if (boundGlobalCallParameterTypes) {
      return boundGlobalCallParameterTypes.restParameter;
    }

    if (finalSourceBackedCallParameterTypes) {
      return finalSourceBackedCallParameterTypes.restParameter;
    }

    if (sourceBackedCallParameterTypes) {
      return sourceBackedCallParameterTypes.restParameter;
    }

    return undefined;
  })();
  const extensionReceiverExpectedType =
    getExplicitExtensionReceiverExpectedType(callee, finalResolved, ctx);
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
  const finalAmbientBoundGlobalSurfaceParameterTypes =
    !usesAuthoritativeSurfaceBindings &&
    boundGlobalCallParameterTypes &&
    finalCallee.inferredType?.kind === "functionType"
      ? expandParameterTypesForArguments(
          finalCallee.inferredType.parameters,
          finalCallee.inferredType.parameters.map(
            (parameter) => parameter.type
          ),
          finalResolutionArgumentCount
        )
      : ambientBoundGlobalSurfaceParameterTypes;
  const finalAmbientBoundGlobalSurfaceRestParameter =
    !usesAuthoritativeSurfaceBindings &&
    boundGlobalCallParameterTypes &&
    finalCallee.inferredType?.kind === "functionType"
      ? buildResolvedRestParameter(
          finalCallee.inferredType.parameters.map((parameter) => ({
            isRest: parameter.isRest,
          })),
          finalAmbientBoundGlobalSurfaceParameterTypes ?? []
        )
      : undefined;
  const sourceBackedParameterTypes =
    finalSourceBackedCallParameterTypes?.parameterTypes ??
    sourceBackedCallParameterTypes?.parameterTypes;
  const sourceBackedSurfaceParameterTypes =
    finalSourceBackedCallParameterTypes?.surfaceParameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes;
  const sourceBackedReturnType =
    finalSourceBackedCallParameterTypes?.returnType ??
    sourceBackedCallParameterTypes?.returnType;
  const fallbackParameterTypes =
    finalFunctionParameterTypes ??
    initialParameterTypesForContext ??
    (calleeFunctionType
      ? expandParameterTypesForArguments(
          calleeFunctionType.parameters,
          calleeFunctionType.parameters.map((parameter) => parameter.type),
          node.arguments.length
        )
      : undefined);
  const preserveAuthoritativeDirectCalleeSurfaceIdentity =
    !!authoritativeFinalDirectCalleeParameterTypes &&
    !authoritativeBoundGlobalSurfaceParameterTypes &&
    !sourceBackedSurfaceParameterTypes &&
    !finalAmbientBoundGlobalSurfaceParameterTypes;
  const finalInvocationMetadata = finalizeInvocationMetadata({
    ctx,
    callee: finalCallee,
    receiverType: receiverIrType,
    callableType: finalFunctionType,
    argumentCount: finalResolutionArgumentCount,
    argTypes: finalResolutionArgTypes,
    explicitTypeArgs,
    expectedType,
    boundGlobalParameterTypes: boundGlobalCallParameterTypes?.parameterTypes,
    authoritativeBoundGlobalSurfaceParameterTypes,
    authoritativeBoundGlobalReturnType,
    sourceBackedParameterTypes,
    sourceBackedSurfaceParameterTypes,
    sourceBackedReturnType,
    ambientBoundGlobalSurfaceParameterTypes:
      finalAmbientBoundGlobalSurfaceParameterTypes,
    authoritativeDirectParameterTypes:
      authoritativeFinalDirectCalleeParameterTypes,
    resolvedParameterTypes: finalResolved?.parameterTypes,
    resolvedSurfaceParameterTypes:
      finalResolved?.surfaceParameterTypes ??
      finalCallableResolution?.resolved?.surfaceParameterTypes,
    resolvedReturnType: finalResolved?.returnType,
    fallbackParameterTypes,
    fallbackSurfaceParameterTypes: fallbackParameterTypes,
    exactParameterCandidates: [
      exactMemberCallableResolution?.resolved?.parameterTypes,
      directCalleeCallableResolution?.resolved?.parameterTypes,
    ],
    exactSurfaceParameterCandidates: [
      exactMemberCallableResolution?.resolved?.surfaceParameterTypes ??
        exactMemberCallableResolution?.resolved?.parameterTypes,
      directCalleeCallableResolution?.resolved?.surfaceParameterTypes ??
        directCalleeCallableResolution?.resolved?.parameterTypes,
    ],
    exactReturnCandidates: [
      exactMemberCallableResolution?.resolved?.returnType,
      directCalleeCallableResolution?.resolved?.returnType,
    ],
    preserveDirectSurfaceIdentity:
      preserveAuthoritativeDirectCalleeSurfaceIdentity,
  });
  const parameterTypes = finalInvocationMetadata.parameterTypes;
  const surfaceParameterTypes = finalInvocationMetadata.surfaceParameterTypes;
  const recontextualizedFinalArguments = convertedArgs.map(
    (argument, index) => {
      const sourceArgument = node.arguments[index];
      if (
        !sourceArgument ||
        ts.isSpreadElement(sourceArgument) ||
        argument.kind === "spread"
      ) {
        return argument;
      }

      const unwrapped = unwrapCallSiteArgumentModifier(sourceArgument);
      const aggregateExpression = stripParentheses(unwrapped.expression);
      if (
        !ts.isObjectLiteralExpression(aggregateExpression) &&
        !ts.isArrayLiteralExpression(aggregateExpression)
      ) {
        return argument;
      }

      const expectedType =
        surfaceParameterTypes?.[index] ?? parameterTypes?.[index];
      const contextualExpectedType =
        expectedType?.kind === "functionType"
          ? expectedType
          : expectedType
            ? (typeSystem.delegateToFunctionType(expectedType) ?? expectedType)
            : undefined;

      if (
        !contextualExpectedType ||
        containsTypeParameter(contextualExpectedType)
      ) {
        return argument;
      }

      const preservedArgument = preserveStableNamedAggregateArgumentIdentity(
        argument,
        contextualExpectedType,
        ctx
      );
      if (preservedArgument !== argument) {
        return preservedArgument;
      }

      if (
        argument.inferredType &&
        invocationTypesEquivalent(
          argument.inferredType,
          contextualExpectedType,
          ctx
        )
      ) {
        return argument;
      }

      const convertedArgument = convertExpression(
        unwrapped.expression,
        ctx,
        contextualExpectedType
      );
      return preserveStableNamedAggregateArgumentIdentity(
        convertedArgument,
        contextualExpectedType,
        ctx
      );
    }
  );
  const finalizedArguments = normalizeFinalizedInvocationArguments(
    recontextualizedFinalArguments,
    parameterTypes,
    surfaceParameterTypes,
    ctx
  );
  const finalizedArgTypes = finalizedArguments.map((argument) =>
    argument.kind === "spread" ? undefined : argument.inferredType
  );
  const finalSourceBackedParameterTypes =
    finalInvocationMetadata.sourceBackedParameterTypes;
  const finalSourceBackedSurfaceParameterTypes =
    finalInvocationMetadata.sourceBackedSurfaceParameterTypes;
  const finalSourceBackedReturnType =
    finalInvocationMetadata.sourceBackedReturnType;
  const fallbackRestParameter = (() => {
    if (finalSourceBackedCallParameterTypes?.restParameter) {
      return finalSourceBackedCallParameterTypes.restParameter;
    }

    if (boundGlobalCallParameterTypes?.restParameter) {
      return boundGlobalCallParameterTypes.restParameter;
    }

    if (finalResolved?.surfaceRestParameter) {
      return finalResolved.surfaceRestParameter;
    }

    if (finalCallableResolution?.resolved?.surfaceRestParameter) {
      return finalCallableResolution.resolved.surfaceRestParameter;
    }

    if (sourceBackedCallParameterTypes?.restParameter) {
      return sourceBackedCallParameterTypes.restParameter;
    }

    const functionTypeForRest = finalFunctionType ?? calleeFunctionType;
    if (!functionTypeForRest) {
      return undefined;
    }

    const restIndex = functionTypeForRest.parameters.findIndex(
      (parameter) => parameter.isRest
    );
    if (restIndex < 0) {
      return undefined;
    }

    return {
      index: restIndex,
      arrayType: functionTypeForRest.parameters[restIndex]?.type,
      elementType: parameterTypes?.[restIndex],
    };
  })();
  const finalInferredType = (() => {
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      return { kind: "voidType" } as const;
    }

    const resolvedReturnType =
      finalSourceBackedReturnType ??
      finalCallableResolution?.resolved?.returnType ??
      finalFunctionType?.returnType;
    if (!resolvedReturnType) {
      return { kind: "unknownType" } as const;
    }

    const callableReturnType = finalFunctionType?.returnType;
    if (
      callableReturnType &&
      callableReturnType.kind !== "voidType" &&
      callableReturnType.kind !== "unknownType" &&
      callableReturnType.kind !== "anyType" &&
      (resolvedReturnType.kind === "voidType" ||
        resolvedReturnType.kind === "unknownType" ||
        resolvedReturnType.kind === "anyType")
    ) {
      return callableReturnType;
    }

    if (
      finalResolved?.typePredicate &&
      (resolvedReturnType.kind === "unknownType" ||
        resolvedReturnType.kind === "anyType")
    ) {
      return { kind: "primitiveType", name: "boolean" } as const;
    }

    return resolvedReturnType;
  })();
  const argumentPassingFromBinding = extractArgumentPassingFromBinding(
    callee,
    node.arguments.length,
    ctx,
    parameterTypes,
    finalizedArgTypes
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
    const pred = finalResolved?.typePredicate;
    if (pred?.kind === "param") {
      const currentArgumentType = finalizedArgTypes[pred.parameterIndex];
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

  return {
    kind: "call",
    callee: finalCallee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: finalizedArguments,
    isOptional: node.questionDotToken !== undefined,
    inferredType: finalInferredType,
    sourceSpan: getSourceSpan(node),
    signatureId: sigId,
    candidateSignatureIds: candidateSigIds,
    typeArguments,
    requiresSpecialization,
    resolutionExpectedReturnType: expectedType,
    argumentPassing: argumentPassingWithOverrides,
    parameterTypes,
    surfaceParameterTypes,
    restParameter: boundGlobalCallParameterTypes
      ? boundGlobalCallParameterTypes.restParameter
      : (finalResolved?.restParameter ??
        explicitSemanticRestParameter ??
        fallbackRestParameter),
    surfaceRestParameter:
      finalAmbientBoundGlobalSurfaceRestParameter ??
      (boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : finalSourceBackedCallParameterTypes
          ? finalSourceBackedCallParameterTypes.restParameter
          : (finalResolved?.surfaceRestParameter ??
            explicitSemanticRestParameter ??
            fallbackRestParameter)),
    sourceBackedParameterTypes: finalSourceBackedParameterTypes,
    sourceBackedSurfaceParameterTypes: finalSourceBackedSurfaceParameterTypes,
    sourceBackedRestParameter:
      finalSourceBackedCallParameterTypes?.restParameter ??
      sourceBackedCallParameterTypes?.restParameter,
    sourceBackedReturnType: finalSourceBackedReturnType,
    narrowing,
  };
};
