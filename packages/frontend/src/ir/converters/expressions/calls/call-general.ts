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
  unifyTypeTemplate,
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
  extractArgumentPassingFromBinding,
} from "./call-site-analysis.js";
import { narrowTypeByArrayShape } from "../../array-type-guards.js";
import {
  collectResolutionArguments,
  isArrayIsArrayCall,
  resolveCallableCandidate,
} from "./call-resolution.js";
import { tryConvertIntrinsicCall } from "./call-intrinsics.js";
import { resolveHeritageReferenceType } from "../../heritage-reference-type.js";
import { getBoundGlobalCallParameterTypes } from "./bound-global-call-parameters.js";
import { resolveImport } from "../../../../resolver.js";

const stripParentheses = (expr: ts.Expression): ts.Expression => {
  let current = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
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
    binding.type !== callee.resolvedClrType ||
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

    const resolvedSignatureDeclaration = ctx.checker
      .getResolvedSignature(node)
      ?.getDeclaration();
    const declaration =
      candidates.find((candidate) => candidate === resolvedSignatureDeclaration) ??
      candidates[candidates.length - 1] ??
      candidates[0];
    if (!declaration) {
      return undefined;
    }

    return {
      declaration,
      ownerTypeParameterNames: [],
      overloadCandidates: candidates,
    };
  }

  if (exportedSymbol.kind !== "variable") {
    return undefined;
  }

  const initializer = (exportedSymbol.node as ts.VariableDeclaration).initializer;
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

const resolveInstantiatedExportClassDeclaration = (
  exportedSymbol: SourceExportedTopLevelSymbol,
  topLevelClasses: ReadonlyMap<string, ts.ClassDeclaration>
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

  const classIdentifier = initializer.expression;
  if (!ts.isIdentifier(classIdentifier)) {
    return undefined;
  }

  return topLevelClasses.get(classIdentifier.text);
};

const classContainsMethodInHierarchy = (
  ownerClass: ts.ClassDeclaration,
  candidateClass: ts.ClassDeclaration,
  topLevelClasses: ReadonlyMap<string, ts.ClassDeclaration>,
  visited: ReadonlySet<string> = new Set<string>()
): boolean => {
  const ownerName = ownerClass.name?.text;
  const candidateName = candidateClass.name?.text;
  if (!ownerName || !candidateName) {
    return false;
  }

  if (ownerName === candidateName) {
    return true;
  }

  if (visited.has(ownerName)) {
    return false;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(ownerName);

  const heritageClauses = ownerClass.heritageClauses ?? [];
  for (const heritageClause of heritageClauses) {
    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }

    for (const heritageType of heritageClause.types) {
      const baseExpression = heritageType.expression;
      if (!ts.isIdentifier(baseExpression)) {
        continue;
      }

      const baseClass = topLevelClasses.get(baseExpression.text);
      if (
        baseClass &&
        classContainsMethodInHierarchy(
          baseClass,
          candidateClass,
          topLevelClasses,
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
  name:
    | ts.PropertyName
    | ts.BindingName
    | ts.DeclarationName
    | undefined
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
  const typeParameterNames = new Set<string>([
    ...ownerTypeParameterNames,
    ...(declaration.typeParameters?.map((parameter) => parameter.name.text) ??
      []),
  ]);
  const declaredReturnType = declaration.type
    ? convertDetachedSourceTypeNode(declaration.type, typeParameterNames)
    : ({ kind: "unknownType" } as const);
  const substitutedSurface = applySourceReceiverTypeSubstitution(
    declaration.parameters.map((parameter) =>
      buildFunctionParameterFromDeclaration(parameter, typeParameterNames)
    ),
    declaredReturnType,
    receiverType,
    ownerTypeParameterNames,
    ctx
  );
  const parameterTypes = expandParameterTypesForArguments(
    substitutedSurface.parameters,
    substitutedSurface.parameters.map((parameter) => parameter.type),
    argumentCount
  );

  return {
    parameterTypes,
    returnType: substitutedSurface.returnType ?? { kind: "unknownType" },
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

const scoreSourceBackedSurfaceCandidate = (
  candidateParameterTypes: readonly (IrType | undefined)[],
  selectedParameterTypes: readonly (IrType | undefined)[],
  ctx: ProgramContext
): readonly [number, number, number] => {
  let compatibleCount = 0;
  let exactCount = 0;
  let complexity = 0;

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

  return [compatibleCount, exactCount, -complexity];
};

const compareSourceSurfaceScores = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!;
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const containsUnknownishContextualType = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  switch (type.kind) {
    case "unknownType":
    case "anyType":
    case "typeParameterType":
      return true;
    case "arrayType":
      return containsUnknownishContextualType(type.elementType);
    case "tupleType":
      return type.elementTypes.some((member) =>
        containsUnknownishContextualType(member)
      );
    case "dictionaryType":
      return (
        containsUnknownishContextualType(type.keyType) ||
        containsUnknownishContextualType(type.valueType)
      );
    case "referenceType":
      return (
        (type.typeArguments?.some((member) =>
          containsUnknownishContextualType(member)
        ) ?? false) ||
        (type.structuralMembers?.some((member) => {
          if (member.kind === "propertySignature") {
            return containsUnknownishContextualType(member.type);
          }

          return (
            member.parameters.some((parameter) =>
              containsUnknownishContextualType(parameter.type)
            ) || containsUnknownishContextualType(member.returnType)
          );
        }) ?? false)
      );
    case "unionType":
    case "intersectionType":
      return type.types.some((member) => containsUnknownishContextualType(member));
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          containsUnknownishContextualType(parameter.type)
        ) || containsUnknownishContextualType(type.returnType)
      );
    case "objectType":
      return type.members.some((member) => {
        if (member.kind === "propertySignature") {
          return containsUnknownishContextualType(member.type);
        }

        return (
          member.parameters.some((parameter) =>
            containsUnknownishContextualType(parameter.type)
          ) || containsUnknownishContextualType(member.returnType)
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
      elementTypes: primary.elementTypes.map((member, index) =>
        mergeContextualTypes(member, fallback.elementTypes[index]) ?? member
      ),
    };
  }

  if (
    primary.kind === "referenceType" &&
    fallback.kind === "referenceType" &&
    primary.name === fallback.name &&
    (primary.typeArguments?.length ?? 0) === (fallback.typeArguments?.length ?? 0)
  ) {
    return {
      ...primary,
      ...(primary.typeArguments
        ? {
            typeArguments: primary.typeArguments.map((member, index) =>
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

const mergeTypeSubstitutions = (
  target: Map<string, IrType>,
  next: ReadonlyMap<string, IrType> | undefined,
  ctx: ProgramContext
): void => {
  if (!next) {
    return;
  }

  for (const [name, type] of next) {
    const existing = target.get(name);
    if (!existing) {
      target.set(name, type);
      continue;
    }
    if (ctx.typeSystem.typesEqual(existing, type)) {
      continue;
    }
    return;
  }
};

const deriveSourceBackedTypeSubstitutions = (
  parameterTypes: readonly (IrType | undefined)[],
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  returnType: IrType,
  expectedType: IrType | undefined,
  ctx: ProgramContext
): ReadonlyMap<string, IrType> | undefined => {
  const substitutions = new Map<string, IrType>();

  if (actualArgTypes) {
    const pairCount = Math.min(parameterTypes.length, actualArgTypes.length);
    for (let index = 0; index < pairCount; index += 1) {
      const parameterType = parameterTypes[index];
      const actualArgType = actualArgTypes[index];
      if (!parameterType || !actualArgType) {
        continue;
      }
      const attempt = new Map(substitutions);
      if (!unifyTypeTemplate(parameterType, actualArgType, attempt)) {
        continue;
      }
      substitutions.clear();
      for (const [name, type] of attempt) {
        substitutions.set(name, type);
      }
    }
  }

  const expectedReturnCandidates = expectedType
    ? ctx.typeSystem.collectExpectedReturnCandidates(expectedType)
    : undefined;
  mergeTypeSubstitutions(
    substitutions,
    deriveSubstitutionsFromExpectedReturn(returnType, expectedReturnCandidates),
    ctx
  );

  return substitutions.size > 0 ? substitutions : undefined;
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

const buildSourceReceiverTypeSubstitution = (
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  receiverType: IrType | undefined,
  ownerTypeParameterNames: readonly string[]
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
  ctx: ProgramContext
): {
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType | undefined;
} => {
  const substitution = buildSourceReceiverTypeSubstitution(
    parameters,
    returnType,
    receiverType,
    ownerTypeParameterNames
  );
  if (!substitution) {
    return { parameters, returnType };
  }

  return {
    parameters: parameters.map((parameter) => ({
      ...parameter,
      type: parameter.type
        ? ctx.typeSystem.substitute(parameter.type, substitution)
        : parameter.type,
    })),
    returnType: returnType
      ? (ctx.typeSystem.substitute(returnType, substitution) ?? returnType)
      : returnType,
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
  if (
    (callee.kind !== "memberAccess" || !callee.memberBinding) &&
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

      let bestSurface = runtimeSurface;
      let bestScore = scoreSourceBackedSurfaceCandidate(
        runtimeSurface.parameterTypes,
        selectedParameterTypes,
        ctx
      );

      for (const candidate of identifierSourceTarget.overloadCandidates) {
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
          ctx
        );
        if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
          bestSurface = candidateSurface;
          bestScore = candidateScore;
        }
      }

      return bestSurface;
    })();

    const substitutions = deriveSourceBackedTypeSubstitutions(
      surfaceParameterSurface.parameterTypes,
      actualArgTypes,
      surfaceParameterSurface.returnType,
      expectedType,
      ctx
    );
    const specializeType = (type: IrType | undefined): IrType | undefined =>
      substitutions ? substituteTypeParameters(type, substitutions) : type;

    return {
      parameterTypes: runtimeSurface.parameterTypes.map((type) =>
        specializeType(type)
      ),
      surfaceParameterTypes: surfaceParameterSurface.parameterTypes.map((type) =>
        specializeType(type)
      ),
      returnType:
        specializeType(surfaceParameterSurface.returnType) ??
        surfaceParameterSurface.returnType,
      restParameter: surfaceParameterSurface.restParameter,
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
  const topLevelClasses = collectTopLevelClassDeclarations(sourceFile);

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

    if (!resolvedSignatureDeclaration || !ts.isMethodDeclaration(resolvedSignatureDeclaration)) {
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

    const ownerClass = resolveInstantiatedExportClassDeclaration(
      exportedSymbol,
      topLevelClasses
    );
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
        topLevelClasses
      )
    ) {
      return undefined;
    }

    return {
      declaration: resolvedSignatureDeclaration,
      ownerTypeParameterNames:
        resolvedOwner.typeParameters?.map(
          (parameter) => parameter.name.text
        ) ?? [],
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

    if (!sourceOrigin.memberName) {
      if (exportedSymbol.kind !== "function") {
        return runtimeSurface;
      }

      const candidates = sourceFile.statements.flatMap((statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === sourceOrigin.exportName
          ? [statement]
          : []
      );
      if (candidates.length === 0) {
        return runtimeSurface;
      }

      let bestSurface = runtimeSurface;
      let bestScore = scoreSourceBackedSurfaceCandidate(
        runtimeSurface.parameterTypes,
        selectedParameterTypes,
        ctx
      );
      for (const candidate of candidates) {
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

    let bestSurface = runtimeSurface;
    let bestScore = scoreSourceBackedSurfaceCandidate(
      runtimeSurface.parameterTypes,
      selectedParameterTypes,
      ctx
    );
    for (const candidate of methodCandidates) {
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
        ctx
      );
      if (compareSourceSurfaceScores(candidateScore, bestScore) > 0) {
        bestSurface = candidateSurface;
        bestScore = candidateScore;
      }
    }

    return bestSurface;
  })();

  const substitutions = deriveSourceBackedTypeSubstitutions(
    surfaceParameterSurface.parameterTypes,
    actualArgTypes,
    surfaceParameterSurface.returnType,
    expectedType,
    ctx
  );
  const specializeType = (type: IrType | undefined): IrType | undefined =>
    substitutions ? substituteTypeParameters(type, substitutions) : type;

  return {
    parameterTypes: runtimeSurface.parameterTypes.map((type) =>
      specializeType(type)
    ),
    surfaceParameterTypes: surfaceParameterSurface.parameterTypes.map((type) =>
      specializeType(type)
    ),
    returnType:
      specializeType(surfaceParameterSurface.returnType) ??
      surfaceParameterSurface.returnType,
    restParameter: surfaceParameterSurface.restParameter,
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
  const candidateSigIds = ctx.binding.resolveCallSignatureCandidates(node);
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
  const boundGlobalCallParameterTypes = getBoundGlobalCallParameterTypes(
    callee,
    argumentCount,
    ctx
  );
  const sourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    argumentCount,
    undefined,
    undefined,
    expectedType,
    ctx
  );

  const specializedMemberCallableType = (() => {
    if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
    if (!receiverIrType) return undefined;

    const memberId = ctx.binding.resolvePropertyAccess(node.expression);
    if (!memberId) return undefined;

    return typeSystem.typeOfMemberId(memberId, receiverIrType);
  })();
  const callableCandidateSourceType =
    specializedMemberCallableType ?? callee.inferredType;

  // If we can't resolve a signature handle (common for calls through function-typed
  // variables), fall back to the callee's inferred function type.
  const initialCallableResolution =
    useDirectCallableCandidateResolution
      ? resolveCallableCandidate(
          callableCandidateSourceType,
          argumentCount,
          ctx,
          undefined,
          explicitTypeArgs,
          expectedType
        )
      : undefined;
  const calleeFunctionType = initialCallableResolution?.callableType;

  const initialResolved = sigId
    && !useDirectCallableCandidateResolution
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

    const sourceBackedReturnSubstitutions = deriveSubstitutionsFromExpectedReturn(
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
      initialResolved?.parameterTypes ??
      sourceBackedCallParameterTypes?.parameterTypes
    );
  })();
  const initialSurfaceParameterTypes = (() => {
    if (boundGlobalCallParameterTypes?.parameterTypes) {
      return boundGlobalCallParameterTypes.parameterTypes;
    }

    return (
      sourceBackedCallParameterTypes?.surfaceParameterTypes ??
      initialResolved?.surfaceParameterTypes ??
      initialCallableResolution?.resolved?.surfaceParameterTypes
    );
  })();
  const initialFunctionParameterTypes =
    useDirectCallableCandidateResolution
      ? initialCallableResolution?.resolved?.parameterTypes
      : undefined;
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

  const lambdaContextSelection = sigId
    && !useDirectCallableCandidateResolution
    ? typeSystem.selectBestCallCandidate(sigId, candidateSigIds, {
        argumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes: argTypesForInference,
        expectedReturnType: expectedType,
      })
    : undefined;
  const lambdaContextResolved =
    lambdaContextSelection?.resolved ?? initialResolved;
  const lambdaContextCallableResolution =
    useDirectCallableCandidateResolution
      ? resolveCallableCandidate(
          callableCandidateSourceType,
          argumentCount,
          ctx,
          argTypesForInference,
          explicitTypeArgs,
          expectedType
        )
      : undefined;
  const lambdaContextFunctionType =
    lambdaContextCallableResolution?.callableType ?? calleeFunctionType;
  const lambdaContextFunctionParameterTypes =
    !sigId
      ? lambdaContextCallableResolution?.resolved?.parameterTypes
      : undefined;
  const lambdaContextSurfaceParameterTypes =
    boundGlobalCallParameterTypes?.parameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes ??
    lambdaContextResolved?.surfaceParameterTypes ??
    lambdaContextCallableResolution?.resolved?.surfaceParameterTypes;

  const parameterTypesForDeferredContext =
    mergeContextualParameterTypes(
      lambdaContextSurfaceParameterTypes ??
        lambdaContextResolved?.parameterTypes ??
        lambdaContextFunctionParameterTypes,
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

  const finalResolutionArgumentCount =
    resolutionArgs.argumentCount > 0
      ? resolutionArgs.argumentCount
      : argumentCount;
  const finalResolutionArgTypes =
    resolutionArgs.argumentCount > 0 ? resolutionArgs.argTypes : argTypes;
  const finalSelection = sigId
    && !useDirectCallableCandidateResolution
    ? typeSystem.selectBestCallCandidate(sigId, candidateSigIds, {
        argumentCount: finalResolutionArgumentCount,
        receiverType: receiverIrType,
        explicitTypeArgs,
        argTypes: finalResolutionArgTypes,
        expectedReturnType: expectedType,
      })
    : undefined;
  const finalResolved = finalSelection?.resolved ?? lambdaContextResolved;
  const finalCallableResolution =
    useDirectCallableCandidateResolution
      ? resolveCallableCandidate(
          callableCandidateSourceType,
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
    calleeFunctionType;
  const finalFunctionParameterTypes =
    useDirectCallableCandidateResolution
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

  const parameterTypes =
    boundGlobalCallParameterTypes?.parameterTypes ??
    finalSourceBackedCallParameterTypes?.parameterTypes ??
    finalResolved?.parameterTypes ??
    finalFunctionParameterTypes ??
    initialParameterTypesForContext ??
    sourceBackedCallParameterTypes?.parameterTypes ??
    (calleeFunctionType
      ? expandParameterTypesForArguments(
          calleeFunctionType.parameters,
          calleeFunctionType.parameters.map((parameter) => parameter.type),
          node.arguments.length
        )
      : undefined);
  const surfaceParameterTypes =
    boundGlobalCallParameterTypes?.parameterTypes ??
    finalSourceBackedCallParameterTypes?.surfaceParameterTypes ??
    finalResolved?.surfaceParameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes ??
    finalCallableResolution?.resolved?.surfaceParameterTypes ??
    finalFunctionParameterTypes ??
    parameterTypes;
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
  const inferredType = (() => {
    const resolvedReturnType =
      finalSourceBackedCallParameterTypes?.returnType ?? finalResolved?.returnType;
    if (!resolvedReturnType) {
      if (finalFunctionType) {
        return (
          finalCallableResolution?.resolved?.returnType ??
          finalFunctionType.returnType
        );
      }
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
    signatureId: sigId,
    candidateSignatureIds: candidateSigIds,
    typeArguments,
    requiresSpecialization,
    resolutionExpectedReturnType: expectedType,
    argumentPassing: argumentPassingWithOverrides,
    parameterTypes,
    surfaceParameterTypes,
    restParameter:
      boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : finalResolved?.restParameter ??
          explicitSemanticRestParameter ??
          fallbackRestParameter,
    surfaceRestParameter:
      boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : finalSourceBackedCallParameterTypes
          ? finalSourceBackedCallParameterTypes.restParameter
          : finalResolved?.surfaceRestParameter ??
            explicitSemanticRestParameter ??
            fallbackRestParameter,
    sourceBackedParameterTypes:
      finalSourceBackedCallParameterTypes?.parameterTypes ??
      sourceBackedCallParameterTypes?.parameterTypes,
    sourceBackedSurfaceParameterTypes:
      finalSourceBackedCallParameterTypes?.surfaceParameterTypes ??
      sourceBackedCallParameterTypes?.surfaceParameterTypes,
    sourceBackedRestParameter:
      finalSourceBackedCallParameterTypes?.restParameter ??
      sourceBackedCallParameterTypes?.restParameter,
    sourceBackedReturnType:
      finalSourceBackedCallParameterTypes?.returnType ??
      sourceBackedCallParameterTypes?.returnType,
    narrowing,
  };
};
