/**
 * General call expression converter
 *
 * TSTS-selected call lowering.
 * Tsonic may re-read the selected signature through TypeSystem.resolveCall(),
 * but it must not score overload candidates or infer TypeScript generics locally.
 */

import * as fs from "node:fs";
import {
  getTstsContainingSourceFile,
  getTstsContainingSourceFileName,
  getTstsIdentifierText,
  getTstsStatementNodes,
  hasTstsStaticModifier,
  parseTstsSourceFile,
  TstsSyntax,
  type TstsNode,
  type TstsSourceFile,
  type TstsSymbol,
} from "@tsonic/tsts";
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
import {
  getSourceSemanticIrType,
} from "../../../expression-converter-helpers.js";
import { IrFunctionType, IrParameter, IrType } from "../../../types.js";
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
  extractArgumentPassingFromTargetMemberOverloads,
} from "./call-site-analysis.js";
import { collectResolutionArguments } from "./call-resolution.js";
import { tryConvertIntrinsicCall } from "./call-intrinsics.js";
import { resolveHeritageReferenceType } from "../../heritage-reference-type.js";
import { getBoundGlobalCallParameterTypes } from "./bound-global-call-parameters.js";
import { resolveImport } from "../../../../resolver.js";
import { readSourcePackageMetadata } from "../../../../program/source-package-metadata.js";
import { tsbindgenTargetTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import {
  collectTypeParameterNames,
  containsTypeParameter,
  deriveInvocationTypeSubstitutions,
  expandAuthoritativeSourceBackedSurfaceType,
  finalizeInvocationMetadata,
  getAuthoritativeDirectCalleeParameterTypes,
  invocationTypesEquivalent,
  normalizeFinalizedInvocationArguments,
  selectDeterministicSourceBackedParameterType,
  shouldPreferExactMemberType,
  sourceBackedParameterAcceptsActualArgument,
} from "./invocation-finalization.js";
import { referenceTypeIdentity } from "../../../types/type-ops.js";
import { selectUnionArm } from "../../union-arm-selection.js";
import { externalSurfaceTypesMatch } from "../../../../program/external-surface-type-identity.js";
import { narrowTypeByAssignableTarget } from "../../reference-type-guards.js";
import { isAttributeMetadataNamedArgumentPosition } from "../attribute-metadata-context.js";

const stripParentheses = (expr: TstsNode): TstsNode => {
  let current = expr;
  while (current.Kind === TstsSyntax.KindParenthesizedExpression) {
    const inner = TstsSyntax.AsParenthesizedExpression(current)?.Expression;
    if (!inner) return current;
    current = inner;
  }
  return current;
};

const withSuppressedObjectLiteralContextualType = (
  ctx: ProgramContext,
  expression: TstsNode
): ProgramContext => {
  const unwrapped = stripParentheses(expression);
  if (unwrapped.Kind !== TstsSyntax.KindObjectLiteralExpression) {
    return ctx;
  }

  return {
    ...ctx,
    suppressObjectLiteralContextualTypeNodes: new Set([
      ...(ctx.suppressObjectLiteralContextualTypeNodes ?? []),
      unwrapped,
    ]),
  };
};

const targetBindingTypesMatch = (left: string, right: string): boolean =>
  externalSurfaceTypesMatch(left, right);

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
    type.typeId?.sourceName === "Expression_1" || type.name === "Expression_1"
  );
};

const createDynamicJsonValueType = (): IrType => ({
  kind: "referenceType",
  name: "JsValue",
  providerQualifiedName: "core:Object",
  structuralOrigin: "namedReference",
});

const isGlobalJsonParseCall = (
  callee: IrCallExpression["callee"],
  ctx: ProgramContext
): boolean => {
  if (callee.kind !== "memberAccess" || callee.isComputed) {
    return false;
  }
  if (callee.property !== "parse" || !callee.memberBinding) {
    return false;
  }

  const descriptor = ctx.bindings.getExactBindingByKind("JSON", "global");
  if (!descriptor) {
    return false;
  }

  const expectedOwnerType = descriptor.staticType ?? descriptor.type;
  return (
    callee.memberBinding.type === expectedOwnerType &&
    callee.memberBinding.member === "parse"
  );
};

const isSourceMarkerApiChainExpression = (
  expression: IrExpression | undefined
): boolean => {
  if (!expression) {
    return false;
  }

  switch (expression.kind) {
    case "identifier":
      return expression.sourceMarkerApi !== undefined;
    case "call":
    case "new":
      return isSourceMarkerApiChainExpression(expression.callee);
    case "memberAccess":
      return isSourceMarkerApiChainExpression(expression.object);
    default:
      return false;
  }
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

const getMemberCallReceiverType = (
  object: IrExpression
): IrType | undefined => {
  switch (object.kind) {
    case "call":
    case "new":
      return object.sourceBackedReturnType ?? object.inferredType;
    default:
      return object.inferredType;
  }
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

  if (
    argument.inferredType.kind === "referenceType" &&
    isStableNamedAggregateContextType(argument.inferredType)
  ) {
    const argumentIdentity = referenceTypeIdentity(argument.inferredType);
    const contextualIdentity = referenceTypeIdentity(contextualExpectedType);
    if (
      argumentIdentity &&
      contextualIdentity &&
      argumentIdentity !== contextualIdentity
    ) {
      return argument;
    }
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
  expr: TstsNode
): Extract<IrType, { kind: "functionType" }> | undefined => {
  const current = stripParentheses(expr);
  if (
    current.Kind !== TstsSyntax.KindArrowFunction &&
    current.Kind !== TstsSyntax.KindFunctionExpression
  ) {
    return undefined;
  }

  const parameters = TstsSyntax.Node_Parameters(current) ?? [];
  return {
    kind: "functionType",
    parameters: parameters.map(
      (parameter, index): IrParameter => ({
        kind: "parameter",
        pattern: {
          kind: "identifierPattern",
          name:
            getTstsIdentifierText(TstsSyntax.Node_Name(parameter)) ??
            `arg${index}`,
        },
        type: { kind: "unknownType" },
        initializer: undefined,
        isOptional: TstsSyntax.Node_QuestionToken(parameter) !== undefined,
        isRest:
          TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !==
          undefined,
        passing: "value",
      })
    ),
    returnType: { kind: "unknownType" },
  };
};

const getEnclosingClassSuperType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  if (
    TstsSyntax.Node_Expression(node)?.Kind !== TstsSyntax.KindSuperKeyword
  ) {
    return undefined;
  }

  let current: TstsNode | undefined = node.Parent;
  while (current) {
    if (
      current.Kind === TstsSyntax.KindClassDeclaration ||
      current.Kind === TstsSyntax.KindClassExpression
    ) {
      const superClass = extendsHeritageTypesOf(current)[0];
      if (!superClass) {
        return undefined;
      }

      return resolveHeritageReferenceType(superClass, ctx);
    }

    current = current.Parent;
  }

  return undefined;
};

type SourceTopLevelSymbolKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "variable";

type SourceExportedTopLevelSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: SourceTopLevelSymbolKind;
  readonly node: TstsNode;
};

type SourceBackedIdentifierGlobalTarget = {
  readonly ownerTypeParameterNames: readonly string[];
  readonly overloadCandidates: readonly TstsNode[];
};

type SourceBackedMemberAccessTarget = {
  readonly overloadCandidates: readonly TstsNode[];
  readonly receiverType: IrType;
};

type SourceBackedSourceOrigin = NonNullable<MemberBinding["sourceOrigin"]>;
type SourceBackedExportSourceTarget = {
  readonly sourceFile: TstsSourceFile;
  readonly exportName: string;
};

const definedNodes = (
  nodes: readonly (TstsNode | undefined)[] | undefined
): readonly TstsNode[] =>
  nodes?.filter((node): node is TstsNode => node !== undefined) ?? [];

const statementNodesOf = (sourceFile: TstsSourceFile): readonly TstsNode[] =>
  definedNodes(getTstsStatementNodes(sourceFile));

const nodeNameText = (node: TstsNode | undefined): string | undefined =>
  node ? getTstsIdentifierText(TstsSyntax.Node_Name(node)) : undefined;

const sourceTopLevelSymbolKindOf = (
  declaration: TstsNode
): SourceTopLevelSymbolKind | undefined => {
  if (declaration.Kind === TstsSyntax.KindClassDeclaration) return "class";
  if (declaration.Kind === TstsSyntax.KindEnumDeclaration) return "enum";
  if (declaration.Kind === TstsSyntax.KindFunctionDeclaration) return "function";
  if (declaration.Kind === TstsSyntax.KindInterfaceDeclaration) return "interface";
  if (declaration.Kind === TstsSyntax.KindVariableDeclaration) return "variable";
  return undefined;
};

const classMembersOf = (classNode: TstsNode): readonly TstsNode[] =>
  definedNodes(TstsSyntax.Node_Members(classNode));

const functionParametersOf = (node: TstsNode): readonly TstsNode[] =>
  definedNodes(TstsSyntax.Node_Parameters(node));

const typeParametersOf = (node: TstsNode): readonly TstsNode[] =>
  definedNodes(TstsSyntax.Node_TypeParameters(node));

const extendsHeritageTypesOf = (node: TstsNode): readonly TstsNode[] => {
  const heritageClauses =
    node.Kind === TstsSyntax.KindClassDeclaration
      ? definedNodes(TstsSyntax.AsClassDeclaration(node)?.HeritageClauses?.Nodes)
      : node.Kind === TstsSyntax.KindClassExpression
        ? definedNodes(
            TstsSyntax.AsClassExpression(node)?.HeritageClauses?.Nodes
          )
        : [];
  return heritageClauses.flatMap((clause) =>
    TstsSyntax.AsHeritageClause(clause)?.Token ===
    TstsSyntax.KindExtendsKeyword
      ? definedNodes(TstsSyntax.AsHeritageClause(clause)?.Types?.Nodes)
      : []
  );
};

const expressionOf = (node: TstsNode): TstsNode | undefined =>
  TstsSyntax.Node_Expression(node);

const isFunctionValueNode = (node: TstsNode | undefined): node is TstsNode =>
  node?.Kind === TstsSyntax.KindArrowFunction ||
  node?.Kind === TstsSyntax.KindFunctionExpression;

const hasBody = (node: TstsNode): boolean =>
  TstsSyntax.Node_Body(node) !== undefined;

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

  if (receiverType.providerQualifiedName) {
    pushAlias(
      tsbindgenTargetTypeNameToTsTypeName(receiverType.providerQualifiedName)
    );
    pushAlias(receiverType.providerQualifiedName);
  }

  pushAlias(receiverType.typeId?.sourceName);

  return aliases;
};

const resolveSourceBackedMemberSourceOrigin = (
  receiverType: Extract<IrType, { kind: "referenceType" }>,
  memberName: string,
  ctx: ProgramContext
): SourceBackedSourceOrigin | undefined => {
  const preferredTargetOwner =
    typeof receiverType.providerQualifiedName === "string"
      ? receiverType.providerQualifiedName
      : undefined;

  for (const ownerAlias of collectSourceBackedReceiverOwnerAliases(
    receiverType
  )) {
    const overloads = ctx.bindings.getMemberOverloads(
      ownerAlias,
      memberName,
      preferredTargetOwner
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
  sourceFile: TstsSourceFile,
  exportedSymbol: SourceExportedTopLevelSymbol,
  resolvedSignatureDeclaration: TstsNode | undefined
): SourceBackedIdentifierGlobalTarget | undefined => {
  if (exportedSymbol.kind === "function") {
    const candidates = statementNodesOf(sourceFile).flatMap((statement) =>
      statement.Kind === TstsSyntax.KindFunctionDeclaration &&
      nodeNameText(statement) === exportedSymbol.localName
        ? [statement]
        : []
    );
    if (candidates.length === 0) {
      return undefined;
    }

    const publicCandidates =
      getPublicSourceBackedOverloadCandidates(candidates);
    const selectedDeclaration =
      resolvedSignatureDeclaration &&
      publicCandidates.includes(resolvedSignatureDeclaration)
        ? resolvedSignatureDeclaration
        : undefined;
    const overloadCandidates = selectedDeclaration
      ? [selectedDeclaration]
      : publicCandidates;
    if (overloadCandidates.length === 0) {
      return undefined;
    }

    return {
      ownerTypeParameterNames: [],
      overloadCandidates,
    };
  }

  if (exportedSymbol.kind !== "variable") {
    return undefined;
  }

  const initializer = TstsSyntax.Node_Initializer(exportedSymbol.node);
  if (!isFunctionValueNode(initializer)) {
    return undefined;
  }

  return {
    ownerTypeParameterNames: [],
    overloadCandidates: [initializer],
  };
};

const getPublicSourceBackedOverloadCandidates = <
  T extends TstsNode,
>(
  candidates: readonly T[]
): readonly T[] => {
  const declarationOnly = candidates.filter(
    (candidate) => !hasBody(candidate)
  );
  return declarationOnly.length > 0 ? declarationOnly : candidates;
};

const collectExportedTopLevelSymbols = (
  sourceFile: TstsSourceFile,
  ctx: ProgramContext
): readonly SourceExportedTopLevelSymbol[] => {
  const exported: SourceExportedTopLevelSymbol[] = [];
  const seen = new Set<string>();

  const pushSymbol = (
    exportName: string,
    localName: string,
    declaration: TstsNode | undefined
  ): void => {
    if (!declaration) {
      return;
    }
    const kind = sourceTopLevelSymbolKindOf(declaration);
    if (!kind) {
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
      kind,
      node: declaration,
    });
  };

  for (const exportBinding of ctx.moduleGraph.getExports(sourceFile)) {
    if (exportBinding.kind !== "named" && exportBinding.kind !== "default") {
      continue;
    }
    const exportName = exportBinding.exportedName ?? exportBinding.localName;
    if (!exportName) {
      continue;
    }
    const declaration = ctx.sourceSemantics.getExportedDeclaration(
      sourceFile,
      exportName
    );
    const localName =
      exportBinding.localName ?? nodeNameText(declaration) ?? exportName;
    pushSymbol(exportName, localName, declaration);
  }

  return exported;
};

const resolveSourceBackedExportSourceTarget = (
  sourceFile: TstsSourceFile,
  exportName: string,
  ctx: ProgramContext,
  visited: ReadonlySet<string> = new Set<string>()
): SourceBackedExportSourceTarget | undefined => {
  const visitKey = `${sourceFile.FileName().replace(/\\/g, "/")}::${exportName}`;
  if (visited.has(visitKey)) {
    return undefined;
  }

  const declaration = ctx.sourceSemantics.getExportedDeclaration(
    sourceFile,
    exportName
  );
  if (!declaration) {
    return undefined;
  }

  return {
    sourceFile: getTstsContainingSourceFile(declaration) ?? sourceFile,
    exportName: nodeNameText(declaration) ?? exportName,
  };
};

const resolveSourceBackedPackageExportSourceTarget = (
  receiverType: Extract<IrType, { kind: "referenceType" }>,
  ctx: ProgramContext
): SourceBackedExportSourceTarget | undefined => {
  const packageName = receiverType.typeId?.ownerIdentity;
  if (!packageName || !packageName.startsWith("@tsonic/")) {
    return undefined;
  }

  const exportName =
    receiverType.typeId?.sourceName ??
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
    if (!sourceFile || sourceFile.IsDeclarationFile) {
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

    matches.set(match.sourceFile.FileName().replace(/\\/g, "/"), match);
  }

  if (matches.size !== 1) {
    return undefined;
  }

  return [...matches.values()][0];
};

const resolveReferencedIdentifierSymbol = (
  ctx: ProgramContext,
  expr: TstsNode
): TstsSymbol | undefined => {
  const current = stripParentheses(expr);
  if (current.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }

  const symbol = ctx.sourceSemantics.getSymbol(current);
  if (!symbol) {
    return undefined;
  }

  return ctx.sourceSemantics.resolveAlias(symbol);
};

const getSourceFileForPath = (
  sourceFilePath: string,
  ctx: ProgramContext
): TstsSourceFile | undefined => {
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

  return parseTstsSourceFile(fs.readFileSync(sourceFilePath, "utf-8"), {
    fileName: sourceFilePath,
  });
};

const resolveImportForContext = (
  importSpecifier: string,
  containingFile: string,
  ctx: ProgramContext
) =>
  resolveImport(importSpecifier, containingFile, ctx.sourceRoot, {
    externalResolver: ctx.externalResolver,
    bindings: ctx.bindings,
    projectRoot: ctx.projectRoot,
    surface: ctx.surface,
    authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
    declarationModuleAliases: ctx.declarationModuleAliases,
  });

const resolveSourceBackedIdentifierGlobalTarget = (
  node: TstsNode,
  callee: Extract<IrCallExpression["callee"], { kind: "identifier" }>,
  ctx: ProgramContext
): SourceBackedIdentifierGlobalTarget | undefined => {
  if (!callee.providerOwnerIdentity || !callee.providerQualifiedName) {
    return undefined;
  }

  const binding = ctx.bindings.getExactBindingByKind(callee.name, "global");
  if (
    !binding ||
    binding.ownerIdentity !== callee.providerOwnerIdentity ||
    !targetBindingTypesMatch(binding.type, callee.providerQualifiedName) ||
    !binding.sourceImport
  ) {
    return undefined;
  }

  const resolved = resolveImportForContext(
    binding.sourceImport,
    getTstsContainingSourceFileName(node) ?? ctx.sourceRoot,
    ctx
  );
  if (!resolved.ok || !resolved.value.resolvedPath) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
  if (!sourceFile || sourceFile.IsDeclarationFile) {
    return undefined;
  }

  const exportedSymbol = collectExportedTopLevelSymbols(sourceFile, ctx).find(
    (symbol) => symbol.exportName === callee.name
  );
  if (!exportedSymbol) {
    return undefined;
  }

  return resolveSourceBackedExportedFunctionTarget(
    sourceFile,
    exportedSymbol,
    (() => {
      const signature = ctx.sourceSemantics.getResolvedSignature(node);
      return signature
        ? ctx.sourceSemantics.getSignatureDeclaration(signature)
        : undefined;
    })()
  );
};

const resolveSourceBackedImportedIdentifierTarget = (
  node: TstsNode,
  callee: Extract<IrCallExpression["callee"], { kind: "identifier" }>,
  ctx: ProgramContext
): SourceBackedIdentifierGlobalTarget | undefined => {
  const callExpression = TstsSyntax.AsCallExpression(node);
  const calleeNode = callExpression?.Expression;
  if (calleeNode?.Kind !== TstsSyntax.KindIdentifier) {
    return undefined;
  }

  const importedSourceValue = ctx.binding.resolveImportedSourceValue(calleeNode);
  if (
    !importedSourceValue ||
    importedSourceValue.exportName !== callee.name
  ) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(
    importedSourceValue.sourceFilePath,
    ctx
  );
  if (!sourceFile || sourceFile.IsDeclarationFile) {
    return undefined;
  }

  const exportedSymbol = collectExportedTopLevelSymbols(sourceFile, ctx).find(
    (symbol) => symbol.exportName === importedSourceValue.exportName
  );
  if (!exportedSymbol) {
    return undefined;
  }

  return resolveSourceBackedExportedFunctionTarget(
    sourceFile,
    exportedSymbol,
    (() => {
      const signature = ctx.sourceSemantics.getResolvedSignature(node);
      return signature
        ? ctx.sourceSemantics.getSignatureDeclaration(signature)
        : undefined;
    })()
  );
};

const collectTopLevelClassDeclarations = (
  sourceFile: TstsSourceFile
): ReadonlyMap<string, TstsNode> => {
  const classes = new Map<string, TstsNode>();
  for (const statement of statementNodesOf(sourceFile)) {
    if (statement.Kind === TstsSyntax.KindClassDeclaration) {
      const name = nodeNameText(statement);
      if (name) classes.set(name, statement);
    }
  }
  return classes;
};

const resolveSourceBackedClassDeclarationByName = (
  typeName: string,
  ctx: ProgramContext
): TstsNode | undefined => {
  const simpleName = getLocalClassLookupName(typeName);
  const binding = ctx.bindings.getExactBindingByKind(simpleName, "global");
  if (!binding?.sourceImport) {
    return undefined;
  }

  const resolved = resolveImportForContext(
    binding.sourceImport,
    ctx.sourceRoot,
    ctx
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
  classDeclaration: TstsNode
): string | undefined => {
  const className = nodeNameText(classDeclaration);
  if (!className) {
    return undefined;
  }

  const fileName = getTstsContainingSourceFileName(classDeclaration);
  if (!fileName) return undefined;
  return `${fileName.replace(/\\/g, "/")}::${className}`;
};

const resolveClassDeclarationFromExpression = (
  expression: TstsNode,
  ctx: ProgramContext
): TstsNode | undefined => {
  const symbol = resolveReferencedIdentifierSymbol(ctx, expression);
  if (!symbol) {
    return undefined;
  }

  const declaration = ctx.sourceSemantics
    .getSymbolDeclarations(symbol)
    .find((candidate) =>
      candidate.Kind === TstsSyntax.KindClassDeclaration
    );
  return declaration && declaration.Kind === TstsSyntax.KindClassDeclaration
    ? declaration
    : undefined;
};

const getPropertyAccessReceiverStaticIntent = (
  node: TstsNode,
  ctx: ProgramContext
): boolean | undefined => {
  const callTarget = TstsSyntax.Node_Expression(node);
  if (callTarget?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }
  const propertyAccess = TstsSyntax.AsPropertyAccessExpression(callTarget);
  if (!propertyAccess?.Expression) return undefined;

  return (
    ctx.sourceSemantics.getConstructSignatures(
      ctx.sourceSemantics.getExpressionType(propertyAccess.Expression)
    ).length > 0
  );
};

const collectClassMethodDeclarationsInHierarchy = (
  ownerClass: TstsNode,
  memberName: string,
  ctx: ProgramContext,
  visited: ReadonlySet<string> = new Set<string>(),
  staticIntent?: boolean
): readonly TstsNode[] => {
  const ownerIdentity = getClassDeclarationIdentity(ownerClass);
  if (!ownerIdentity || visited.has(ownerIdentity)) {
    return [];
  }

  const nextVisited = new Set(visited);
  nextVisited.add(ownerIdentity);

  const directMembers = classMembersOf(ownerClass).flatMap((member) =>
    member.Kind === TstsSyntax.KindMethodDeclaration &&
    getDeclarationTextName(TstsSyntax.Node_Name(member)) === memberName &&
    (staticIntent === undefined || hasTstsStaticModifier(member) === staticIntent)
      ? [member]
      : []
  );

  const inheritedMembers: TstsNode[] = [];
  for (const heritageType of extendsHeritageTypesOf(ownerClass)) {
      const heritageExpression = expressionOf(heritageType);
      if (!heritageExpression) continue;
      const baseClass = resolveClassDeclarationFromExpression(
        heritageExpression,
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
          nextVisited,
          staticIntent
        )
      );
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
  ownerClassDeclaration: TstsNode | undefined,
  ownerTypeParameterNames: readonly string[],
  ctx: ProgramContext
): ReadonlyMap<string, IrType> | undefined => {
  if (
    receiverType?.kind !== "referenceType" ||
    !ownerClassDeclaration ||
    !nodeNameText(ownerClassDeclaration) ||
    ownerTypeParameterNames.length === 0
  ) {
    return undefined;
  }

  const ownerSourceFile = getTstsContainingSourceFile(ownerClassDeclaration);
  if (!ownerSourceFile) return undefined;
  const ownerSourceClasses = collectTopLevelClassDeclarations(ownerSourceFile);
  let currentClass =
    ownerSourceClasses.get(getLocalClassLookupName(receiverType.name)) ??
    resolveSourceBackedClassDeclarationByName(receiverType.name, ctx);
  let currentInstantiatedType: IrType = receiverType;
  const visited = new Set<string>();

  while (currentClass && nodeNameText(currentClass)) {
    const currentName = nodeNameText(currentClass);
    if (!currentName) break;
    if (visited.has(currentName)) {
      return undefined;
    }
    visited.add(currentName);

    if (currentName === nodeNameText(ownerClassDeclaration)) {
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

    const heritageType = extendsHeritageTypesOf(currentClass)[0];
    if (!heritageType) {
      return undefined;
    }

    let nextType = resolveHeritageReferenceType(heritageType, ctx);
    if (
      currentInstantiatedType.kind === "referenceType" &&
      typeParametersOf(currentClass).length &&
      currentInstantiatedType.typeArguments &&
      currentInstantiatedType.typeArguments.length ===
        typeParametersOf(currentClass).length
    ) {
      const currentSubstitution = new Map<string, IrType>();
      for (
        let index = 0;
        index < typeParametersOf(currentClass).length;
        index += 1
      ) {
        const typeParameterName = nodeNameText(typeParametersOf(currentClass)[index]);
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
    const heritageExpression = expressionOf(heritageType);
    currentClass =
      (heritageExpression
        ? resolveClassDeclarationFromExpression(heritageExpression, ctx)
        : undefined) ??
      resolveSourceBackedClassDeclarationByName(nextType.name, ctx);
  }

  return undefined;
};

const resolveInstantiatedExportClassDeclaration = (
  exportedSymbol: SourceExportedTopLevelSymbol,
  topLevelClasses: ReadonlyMap<string, TstsNode>,
  ctx: ProgramContext
): TstsNode | undefined => {
  if (exportedSymbol.kind === "class") {
    return exportedSymbol.node;
  }

  if (exportedSymbol.kind !== "variable") {
    return undefined;
  }

  const initializer = TstsSyntax.Node_Initializer(exportedSymbol.node);
  if (!initializer || initializer.Kind !== TstsSyntax.KindNewExpression) {
    return undefined;
  }
  const newExpression = TstsSyntax.AsNewExpression(initializer);
  if (!newExpression?.Expression) return undefined;

  const localClass = newExpression.Expression.Kind === TstsSyntax.KindIdentifier
    ? topLevelClasses.get(getTstsIdentifierText(newExpression.Expression) ?? "")
    : undefined;
  if (localClass) {
    return localClass;
  }

  return resolveClassDeclarationFromExpression(newExpression.Expression, ctx);
};

const resolveSourceBackedMemberAccessTarget = (
  node: TstsNode,
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
  const staticIntent = getPropertyAccessReceiverStaticIntent(node, ctx);

  for (const candidateReceiverType of receiverCandidates) {
    const packageExportTarget = resolveSourceBackedPackageExportSourceTarget(
      candidateReceiverType,
      ctx
    );
    if (packageExportTarget) {
      const exportedSymbol = collectExportedTopLevelSymbols(
        packageExportTarget.sourceFile,
        ctx
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
        ctx,
        new Set<string>(),
        staticIntent
      );
      const declaration =
        overloadCandidates.find((candidate) => !hasBody(candidate)) ??
        overloadCandidates[0];
      if (!declaration) {
        continue;
      }

      return {
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
      if (!sourceFile || sourceFile.IsDeclarationFile) {
        continue;
      }

      const exportedSymbol = collectExportedTopLevelSymbols(sourceFile, ctx).find(
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
        ctx,
        new Set<string>(),
        staticIntent
      );
      const declaration =
        overloadCandidates.find((candidate) => !hasBody(candidate)) ??
        overloadCandidates[0];
      if (!declaration) {
        continue;
      }

      return {
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

    const resolved = resolveImportForContext(
      binding.sourceImport,
      getTstsContainingSourceFileName(node) ?? ctx.sourceRoot,
      ctx
    );
    if (!resolved.ok || !resolved.value.resolvedPath) {
      continue;
    }

    const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
    if (!sourceFile || sourceFile.IsDeclarationFile) {
      continue;
    }

    const exportedSymbol = collectExportedTopLevelSymbols(sourceFile, ctx).find(
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
      ctx,
      new Set<string>(),
      staticIntent
    );
    const declaration =
      overloadCandidates.find((candidate) => !hasBody(candidate)) ??
      overloadCandidates[0];
    if (!declaration) {
      continue;
    }

    return {
      overloadCandidates,
      receiverType: candidateReceiverType,
    };
  }

  return undefined;
};

const classContainsMethodInHierarchy = (
  ownerClass: TstsNode,
  candidateClass: TstsNode,
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

  for (const heritageType of extendsHeritageTypesOf(ownerClass)) {
    const heritageExpression = expressionOf(heritageType);
    const baseClass = heritageExpression
      ? resolveClassDeclarationFromExpression(heritageExpression, ctx)
      : undefined;
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

  return false;
};

const getDeclarationTextName = (name: TstsNode | undefined): string | undefined => {
  if (!name) {
    return undefined;
  }

  if (
    name.Kind === TstsSyntax.KindIdentifier ||
    name.Kind === TstsSyntax.KindStringLiteral ||
    name.Kind === TstsSyntax.KindNumericLiteral
  ) {
    return TstsSyntax.Node_Text(name);
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

type ResolvedSourceBackedSurface = SourceBackedParameterSurface & {
  readonly surfaceParameterTypes: readonly (IrType | undefined)[];
  readonly selectionParameterTypes: readonly (IrType | undefined)[];
};

const buildSourceBackedParameterSurface = (
  declaration: TstsNode,
  ownerTypeParameterNames: readonly string[],
  receiverType: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext
): SourceBackedParameterSurface => {
  const declaredReturnTypeNode = TstsSyntax.Node_Type(declaration);
  const declaredReturnType = declaredReturnTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(declaredReturnTypeNode)
      )
    : ({ kind: "unknownType" } as const);
  const parameters = functionParametersOf(declaration);
  const substitutedSurface = applySourceReceiverTypeSubstitution(
    parameters.map((parameter) =>
      buildFunctionParameterFromDeclaration(parameter, ctx)
    ),
    declaredReturnType,
    receiverType,
    ownerTypeParameterNames,
    declaration.Parent?.Kind === TstsSyntax.KindClassDeclaration ||
      declaration.Parent?.Kind === TstsSyntax.KindClassExpression
      ? declaration.Parent
      : undefined,
    ctx
  );
  const optionalAwareParameterTypes = substitutedSurface.parameters.map(
    (parameter, index) =>
      parameter.type
        ? TstsSyntax.Node_QuestionToken(parameters[index]) !== undefined
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
      typeParametersOf(declaration).flatMap((parameter) => {
        const name = nodeNameText(parameter);
        return name ? [name] : [];
      }),
    restParameter: buildResolvedRestParameter(
      substitutedSurface.parameters.map((parameter) => ({
        isRest: parameter.isRest,
      })),
      parameterTypes
    ),
  };
};

const removeSourceBackedExtensionReceiverParameter = (
  surface: SourceBackedParameterSurface
): SourceBackedParameterSurface => {
  if (surface.parameterTypes.length === 0) {
    throw new Error(
      "Internal Compiler Error: source-backed extension method surface has no receiver parameter."
    );
  }
  if (surface.restParameter?.index === 0) {
    throw new Error(
      "Internal Compiler Error: source-backed extension method receiver cannot be a rest parameter."
    );
  }

  return {
    ...surface,
    parameterTypes: surface.parameterTypes.slice(1),
    restParameter: surface.restParameter
      ? {
          ...surface.restParameter,
          index: surface.restParameter.index - 1,
        }
      : undefined,
  };
};

const buildSourceBackedCallParameterSurface = (
  declaration: TstsNode,
  ownerTypeParameterNames: readonly string[],
  receiverType: IrType | undefined,
  argumentCount: number,
  ctx: ProgramContext,
  removeExtensionReceiverParameter: boolean
): SourceBackedParameterSurface => {
  const runtimeArgumentCount = removeExtensionReceiverParameter
    ? argumentCount + 1
    : argumentCount;
  const surface = buildSourceBackedParameterSurface(
    declaration,
    ownerTypeParameterNames,
    receiverType,
    runtimeArgumentCount,
    ctx
  );

  return removeExtensionReceiverParameter
    ? removeSourceBackedExtensionReceiverParameter(surface)
    : surface;
};

const ownerTypeParameterNamesOfDeclaration = (
  declaration: TstsNode
): readonly string[] =>
  declaration.Parent?.Kind === TstsSyntax.KindClassDeclaration ||
  declaration.Parent?.Kind === TstsSyntax.KindClassExpression
    ? typeParametersOf(declaration.Parent).flatMap((parameter) => {
        const name = nodeNameText(parameter);
        return name ? [name] : [];
      })
    : [];

const buildSelectedSignatureFunctionType = (
  node: TstsNode,
  ctx: ProgramContext,
  explicitTypeArgs: readonly IrType[] | undefined
): IrFunctionType | undefined => {
  const signature = ctx.sourceSemantics.getResolvedSignature(node);
  if (!signature) {
    return undefined;
  }

  const declaration = ctx.sourceSemantics.getSignatureDeclaration(signature);
  const parameterDeclarations = declaration
    ? functionParametersOf(declaration)
    : [];
  const signatureParameters = ctx.sourceSemantics
    .getSignatureParameters(signature)
    .filter((symbol): symbol is TstsSymbol => symbol !== undefined);
  if (signatureParameters.length === 0 && parameterDeclarations.length === 0) {
    return undefined;
  }

  const typeParameters = declaration
    ? typeParametersOf(declaration).flatMap((parameter) => {
        const name = nodeNameText(parameter);
        return name ? [{ kind: "typeParameter" as const, name }] : [];
      })
    : undefined;
  const parameters = signatureParameters.map((symbol, index): IrParameter => {
    const declarationParameter = parameterDeclarations[index];
    const semanticType = ctx.sourceSemantics.getTypeOfSymbolAtLocation(
      symbol,
      node
    );
    const declaredParameter = declarationParameter
      ? buildFunctionParameterFromDeclaration(declarationParameter, ctx)
      : undefined;
    const semanticIrType = getSourceSemanticIrType(semanticType, node, ctx);
    const rawParameterType =
      chooseInstantiatedSignatureType(
        declaredParameter?.type,
        semanticIrType,
        { preserveDeclaredTypeParameters: (explicitTypeArgs?.length ?? 0) > 0 }
      ) ??
      ({ kind: "unknownType" } as const);
    const convertedType =
      declaredParameter?.isOptional && rawParameterType
        ? addUndefinedToType(rawParameterType)
        : rawParameterType;
    const declaredName =
      declarationParameter && nodeNameText(declarationParameter);

    return {
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name: declaredName ?? symbol.Name ?? `arg${index}`,
      },
      type: convertedType,
      initializer: undefined,
      isOptional: declaredParameter?.isOptional ?? false,
      isRest: declaredParameter?.isRest ?? false,
      passing: "value",
    };
  });
  const declaredReturnTypeNode = declaration
    ? TstsSyntax.Node_Type(declaration)
    : undefined;
  const declaredReturnType = declaredReturnTypeNode
    ? ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(declaredReturnTypeNode)
      )
    : undefined;
  const semanticReturnType = getSourceSemanticIrType(
    ctx.sourceSemantics.getReturnTypeOfSignature(signature),
    node,
    ctx
  );
  const returnType =
    chooseInstantiatedSignatureType(declaredReturnType, semanticReturnType, {
      preserveDeclaredTypeParameters: (explicitTypeArgs?.length ?? 0) > 0,
    }) ??
    ({ kind: "unknownType" } as const);

  return {
    kind: "functionType",
    typeParameters:
      typeParameters && typeParameters.length > 0 ? typeParameters : undefined,
    parameters,
    returnType,
  };
};

const buildResolvedSourceBackedSurface = (
  surface: SourceBackedParameterSurface,
  selectedParameterTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): ResolvedSourceBackedSurface => {
  const substitutions = deriveInvocationTypeSubstitutions(
    surface.parameterTypes,
    selectedParameterTypes,
    surface.returnType,
    expectedType,
    surface.methodTypeParameterNames,
    explicitTypeArgs,
    ctx
  );
  const specializeType = (type: IrType | undefined): IrType | undefined =>
    substitutions ? substituteTypeParameters(type, substitutions) : type;
  const surfaceParameterTypes = surface.parameterTypes.map((type) =>
    specializeType(type)
  );
  const selectionParameterTypes = surfaceParameterTypes.map(
    (type) =>
      expandAuthoritativeSourceBackedSurfaceType(type, ctx, new Set(), {
        preserveCarrierIdentity: false,
      }) ?? type
  );

  return {
    ...surface,
    parameterTypes: surface.parameterTypes,
    surfaceParameterTypes,
    selectionParameterTypes,
    returnType: specializeType(surface.returnType) ?? surface.returnType,
  };
};

const sourceBackedSurfaceMatchesSelectedSignature = (
  surface: ResolvedSourceBackedSurface,
  selectedParameterTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): boolean => {
  if (!selectedParameterTypes) {
    return false;
  }
  if (surface.parameterTypes.length !== selectedParameterTypes.length) {
    return false;
  }

  return selectedParameterTypes.every((selectedType, index) => {
    const surfaceType = surface.surfaceParameterTypes[index];
    const selectionType = surface.selectionParameterTypes[index];
    return (
      invocationTypesEquivalent(surfaceType, selectedType, ctx) ||
      invocationTypesEquivalent(selectionType, selectedType, ctx)
    );
  });
};

const sourceBackedSurfaceAcceptsActualArguments = (
  surface: ResolvedSourceBackedSurface,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): boolean => {
  if (!actualArgTypes) {
    return false;
  }
  if (surface.selectionParameterTypes.length !== actualArgTypes.length) {
    return false;
  }

  return actualArgTypes.every((actualType, index) => {
    const parameterType = surface.selectionParameterTypes[index];
    return sourceBackedParameterAcceptsActualArgument(
      parameterType,
      actualType,
      ctx
    );
  });
};

const sourceSurfaceSpecificityRank = (
  type: IrType | undefined,
  seen: WeakSet<object> = new WeakSet<object>()
): number => {
  if (!type) {
    return 0;
  }
  if (seen.has(type)) {
    return 0;
  }
  seen.add(type);

  switch (type.kind) {
    case "typeParameterType":
    case "unknownType":
    case "anyType":
      return 0;
    case "primitiveType":
    case "literalType":
    case "voidType":
    case "neverType":
      return 2;
    case "arrayType":
      return 3 + sourceSurfaceSpecificityRank(type.elementType, seen);
    case "tupleType":
      return (
        3 +
        type.elementTypes.reduce(
          (total, member) => total + sourceSurfaceSpecificityRank(member, seen),
          0
        )
      );
    case "dictionaryType":
      return (
        3 +
        sourceSurfaceSpecificityRank(type.keyType, seen) +
        sourceSurfaceSpecificityRank(type.valueType, seen)
      );
    case "referenceType":
      return (
        3 +
        (type.typeArguments?.reduce(
          (total, member) => total + sourceSurfaceSpecificityRank(member, seen),
          0
        ) ?? 0)
      );
    case "functionType":
      return (
        3 +
        type.parameters.reduce(
          (total, parameter) =>
            total + sourceSurfaceSpecificityRank(parameter.type, seen),
          0
        ) +
        sourceSurfaceSpecificityRank(type.returnType, seen)
      );
    case "objectType":
      return (
        3 +
        type.members.reduce((total, member) => {
          if (member.kind === "propertySignature") {
            return total + sourceSurfaceSpecificityRank(member.type, seen);
          }
          return (
            total +
            member.parameters.reduce(
              (innerTotal, parameter) =>
                innerTotal + sourceSurfaceSpecificityRank(parameter.type, seen),
              0
            ) +
            sourceSurfaceSpecificityRank(member.returnType, seen)
          );
        }, 0)
      );
    case "unionType":
    case "intersectionType":
      return type.types.reduce(
        (total, member) => total + sourceSurfaceSpecificityRank(member, seen),
        0
      );
  }
};

const sourceBackedSurfaceSpecificityRank = (
  surface: ResolvedSourceBackedSurface
): number =>
  surface.surfaceParameterTypes.reduce(
    (total, parameterType) => total + sourceSurfaceSpecificityRank(parameterType),
    0
  );

const selectUniqueSourceSurfaceBySpecificity = (
  surfaces: readonly ResolvedSourceBackedSurface[]
): ResolvedSourceBackedSurface | undefined => {
  let selected: ResolvedSourceBackedSurface | undefined;
  let selectedRank = -1;
  let tied = false;

  for (const surface of surfaces) {
    const rank = sourceBackedSurfaceSpecificityRank(surface);
    if (rank > selectedRank) {
      selected = surface;
      selectedRank = rank;
      tied = false;
      continue;
    }
    if (rank === selectedRank) {
      tied = true;
    }
  }

  return tied ? undefined : selected;
};

const selectSourceBackedSurfaceFromSelectedSignature = (
  candidates: readonly TstsNode[],
  buildSurface: (candidate: TstsNode) => SourceBackedParameterSurface,
  selectedParameterTypes: readonly (IrType | undefined)[] | undefined,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): ResolvedSourceBackedSurface | undefined => {
  if (candidates.length === 0) {
    return undefined;
  }

  const resolved = candidates.map((candidate) =>
    buildResolvedSourceBackedSurface(
      buildSurface(candidate),
      actualArgTypes ?? selectedParameterTypes,
      expectedType,
      explicitTypeArgs,
      ctx
    )
  );

  if (resolved.length === 1) {
    return resolved[0];
  }

  const actualMatches = resolved.filter((surface) =>
    sourceBackedSurfaceAcceptsActualArguments(surface, actualArgTypes, ctx)
  );
  if (actualMatches.length === 1) {
    return actualMatches[0];
  }
  const selectedActualMatch =
    actualMatches.length > 1
      ? selectUniqueSourceSurfaceBySpecificity(actualMatches)
      : undefined;
  if (selectedActualMatch) {
    return selectedActualMatch;
  }

  const matches = resolved.filter((surface) =>
    sourceBackedSurfaceMatchesSelectedSignature(
      surface,
      selectedParameterTypes,
      ctx
    )
  );

  return matches.length === 1 ? matches[0] : undefined;
};

const materializeSourceBackedCallParameterTypes = (
  surface: ResolvedSourceBackedSurface,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): {
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
} => ({
  parameterTypes: surface.selectionParameterTypes.map((type, index) =>
    selectDeterministicSourceBackedParameterType(
      type,
      actualArgTypes?.[index],
      ctx
    )
  ),
  surfaceParameterTypes: surface.surfaceParameterTypes,
  returnType: surface.returnType,
  restParameter: surface.restParameter,
});

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
    const nonNullishMembers = type.types.filter(
      (member) =>
        !(
          member.kind === "primitiveType" &&
          (member.name === "undefined" || member.name === "null")
        )
    );
    return (
      nonNullishMembers.length > 0 &&
      nonNullishMembers.every((member) => isNumericSourceSurfaceType(member))
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

const isInvocationArityCompatible = (
  parameters: readonly IrParameter[],
  argumentCount: number
): boolean => {
  let requiredCount = 0;
  let hasRest = false;
  for (const parameter of parameters) {
    if (parameter.isRest) {
      hasRest = true;
      continue;
    }
    if (!parameter.isOptional && parameter.initializer === undefined) {
      requiredCount += 1;
    }
  }

  return argumentCount >= requiredCount && (hasRest || argumentCount <= parameters.length);
};

const collectCallableFunctionTypes = (
  type: IrType | undefined
): readonly IrFunctionType[] => {
  if (!type) {
    return [];
  }
  if (type.kind === "functionType") {
    return [type];
  }
  if (type.kind === "intersectionType") {
    return type.types.flatMap(collectCallableFunctionTypes);
  }
  return [];
};

const sourceNumericInvocationPrimitiveNames = new Set([
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

const selectCommonSourceNumericActual = (
  parameterTypes: readonly (IrType | undefined)[],
  actualArgTypes: readonly (IrType | undefined)[]
): IrType | undefined => {
  const candidates = new Set<string>();
  const count = Math.min(parameterTypes.length, actualArgTypes.length);
  for (let index = 0; index < count; index += 1) {
    const parameterType = parameterTypes[index];
    const actualArgType = actualArgTypes[index];
    if (!parameterType || !actualArgType || !containsTypeParameter(parameterType)) {
      continue;
    }
    if (
      actualArgType.kind === "primitiveType" &&
      sourceNumericInvocationPrimitiveNames.has(actualArgType.name)
    ) {
      candidates.add(actualArgType.name);
    }
  }

  if (candidates.size !== 1) {
    return undefined;
  }

  return {
    kind: "primitiveType",
    name: [...candidates][0] ?? "number",
  } as IrType;
};

const specializeCallableParameterTypes = (
  functionType: IrFunctionType,
  argumentCount: number,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): readonly (IrType | undefined)[] => {
  const parameterTypes = expandParameterTypesForArguments(
    functionType.parameters,
    functionType.parameters.map((parameter) =>
      parameter.isOptional && parameter.type
        ? addUndefinedToType(parameter.type)
        : parameter.type
    ),
    argumentCount
  );
  const methodTypeParameterNames =
    functionType.typeParameters?.map((parameter) => parameter.name) ?? [];
  const substitutions =
    methodTypeParameterNames.length > 0
      ? deriveInvocationTypeSubstitutions(
          parameterTypes,
          actualArgTypes,
          functionType.returnType,
          expectedType,
          methodTypeParameterNames,
          explicitTypeArgs,
          ctx
        )
      : undefined;
  const specializedParameterTypes = parameterTypes.map((parameterType) =>
    substitutions ? substituteTypeParameters(parameterType, substitutions) : parameterType
  );
  const preferredSourceNumeric =
    actualArgTypes && substitutions
      ? selectCommonSourceNumericActual(parameterTypes, actualArgTypes)
      : undefined;

  if (!preferredSourceNumeric) {
    return specializedParameterTypes;
  }

  return specializedParameterTypes.map((parameterType, index) =>
    parameterType?.kind === "primitiveType" &&
    parameterType.name === "number" &&
    containsTypeParameter(parameterTypes[index])
      ? preferredSourceNumeric
      : parameterType
  );
};

const callableIterableParameterAcceptsActual = (
  parameterType: IrType | undefined,
  actualArgType: IrType | undefined,
  ctx: ProgramContext
): boolean => {
  if (!parameterType || !actualArgType) {
    return false;
  }

  if (parameterType.kind === "unionType") {
    return parameterType.types.some((member) =>
      callableIterableParameterAcceptsActual(member, actualArgType, ctx)
    );
  }

  const parameterIterable = ctx.typeSystem.getIterableShape(parameterType);
  const actualIterable = ctx.typeSystem.getIterableShape(actualArgType);
  if (
    !parameterIterable ||
    !actualIterable ||
    parameterIterable.mode !== actualIterable.mode
  ) {
    return false;
  }

  return (
    invocationTypesEquivalent(
      parameterIterable.elementType,
      actualIterable.elementType,
      ctx
    ) ||
    ctx.typeSystem.isAssignableTo(
      actualIterable.elementType,
      parameterIterable.elementType
    ) ||
    (isNumericSourceSurfaceType(parameterIterable.elementType) &&
      isNumericSourceSurfaceType(actualIterable.elementType))
  );
};

const scoreCallableFunctionType = (
  functionType: IrFunctionType,
  argumentCount: number,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): number | undefined => {
  if (!isInvocationArityCompatible(functionType.parameters, argumentCount)) {
    return undefined;
  }
  const parameterTypes = specializeCallableParameterTypes(
    functionType,
    argumentCount,
    actualArgTypes,
    expectedType,
    explicitTypeArgs,
    ctx
  );
  if (!actualArgTypes) {
    return parameterTypes.reduce(
      (score, parameterType) => score + scoreSourceSurfaceComplexity(parameterType),
      0
    );
  }

  let score = 0;
  for (let index = 0; index < argumentCount; index += 1) {
    const surfaceParameterType = parameterTypes[index];
    const parameterType =
      expandAuthoritativeSourceBackedSurfaceType(
        surfaceParameterType,
        ctx,
        new Set(),
        { preserveCarrierIdentity: false }
      ) ?? surfaceParameterType;
    const actualArgType = actualArgTypes[index];
    if (!parameterType || !actualArgType) {
      continue;
    }
    if (invocationTypesEquivalent(parameterType, actualArgType, ctx)) {
      score += 200;
      continue;
    }
    if (sourceBackedParameterAcceptsActualArgument(parameterType, actualArgType, ctx)) {
      score += 120;
      continue;
    }
    if (callableIterableParameterAcceptsActual(parameterType, actualArgType, ctx)) {
      score += 110;
      continue;
    }
    if (
      isNumericSourceSurfaceType(parameterType) &&
      isNumericSourceSurfaceType(actualArgType)
    ) {
      score += 80;
      continue;
    }
    if (containsTypeParameter(parameterType)) {
      score += 20;
      continue;
    }
    return undefined;
  }

  return (
    score +
    parameterTypes.reduce(
      (total, parameterType) => total + scoreSourceSurfaceComplexity(parameterType),
      0
    )
  );
};

const selectCallableFunctionType = (
  callableType: IrType | undefined,
  argumentCount: number,
  actualArgTypes: readonly (IrType | undefined)[] | undefined,
  expectedType: IrType | undefined,
  explicitTypeArgs: readonly IrType[] | undefined,
  ctx: ProgramContext
): IrFunctionType | undefined => {
  const candidates = collectCallableFunctionTypes(callableType);
  if (candidates.length === 0) {
    return undefined;
  }

  let selected: IrFunctionType | undefined;
  let selectedScore = Number.NEGATIVE_INFINITY;
  let tied = false;
  for (const candidate of candidates) {
    const score = scoreCallableFunctionType(
      candidate,
      argumentCount,
      actualArgTypes,
      expectedType,
      explicitTypeArgs,
      ctx
    );
    if (score === undefined) {
      continue;
    }
    if (score > selectedScore) {
      selected = candidate;
      selectedScore = score;
      tied = false;
      continue;
    }
    if (score === selectedScore) {
      if (
        selected &&
        invocationTypesEquivalent(candidate, selected, ctx)
      ) {
        continue;
      }
      tied = true;
    }
  }

  return tied ? undefined : selected;
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
  secondary: IrType | undefined
): IrType | undefined => {
  if (!primary) {
    return secondary;
  }

  if (!secondary || !containsUnknownishContextualType(primary)) {
    return primary;
  }

  if (primary.kind === "functionType" && secondary.kind === "functionType") {
    return {
      ...primary,
      parameters: primary.parameters.map((parameter, index) => ({
        ...parameter,
        type: mergeContextualTypes(
          parameter.type,
          secondary.parameters[index]?.type
        ),
      })),
      returnType:
        mergeContextualTypes(primary.returnType, secondary.returnType) ??
        primary.returnType,
    };
  }

  if (primary.kind === "arrayType" && secondary.kind === "arrayType") {
    return {
      ...primary,
      elementType:
        mergeContextualTypes(primary.elementType, secondary.elementType) ??
        primary.elementType,
    };
  }

  if (
    primary.kind === "tupleType" &&
    secondary.kind === "tupleType" &&
    primary.elementTypes.length === secondary.elementTypes.length
  ) {
    return {
      ...primary,
      elementTypes: primary.elementTypes.map(
        (member, index) =>
          mergeContextualTypes(member, secondary.elementTypes[index]) ?? member
      ),
    };
  }

  if (
    primary.kind === "referenceType" &&
    secondary.kind === "referenceType" &&
    (primary.typeArguments?.length ?? 0) ===
      (secondary.typeArguments?.length ?? 0)
  ) {
    const primaryIdentity = referenceTypeIdentity(primary);
    const secondaryIdentity = referenceTypeIdentity(secondary);
    if (
      primaryIdentity === undefined ||
      secondaryIdentity === undefined ||
      primaryIdentity !== secondaryIdentity
    ) {
      return primary;
    }

    return {
      ...primary,
      ...(primary.typeArguments
        ? {
            typeArguments: primary.typeArguments.map(
              (member, index) =>
                mergeContextualTypes(member, secondary.typeArguments?.[index]) ??
                member
            ),
          }
        : {}),
    };
  }

  return secondary;
};

const mergeContextualParameterTypes = (
  primary: readonly (IrType | undefined)[] | undefined,
  secondary: readonly (IrType | undefined)[] | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!primary) {
    return secondary;
  }

  if (!secondary) {
    return primary;
  }

  const count = Math.max(primary.length, secondary.length);
  return Array.from({ length: count }, (_, index) =>
    mergeContextualTypes(primary[index], secondary[index])
  );
};

const hasUnresolvedInvocationParameterType = (
  types: readonly (IrType | undefined)[] | undefined
): boolean =>
  !types ||
  types.some(
    (type) =>
      !type ||
      type.kind === "unknownType" ||
      type.kind === "anyType" ||
      type.kind === "typeParameterType"
  );

const selectResolvedCallableParameterTypes = (
  current: readonly (IrType | undefined)[] | undefined,
  callableResolved: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext,
  options: {
    readonly preserveVisibleSurfaceIdentity?: boolean;
  } = {}
): readonly (IrType | undefined)[] | undefined => {
  const selected =
    callableResolved && hasUnresolvedInvocationParameterType(current)
      ? callableResolved
      : current;
  if (options.preserveVisibleSurfaceIdentity) {
    return selected;
  }
  return selected?.map(
    (type) =>
      expandAuthoritativeSourceBackedSurfaceType(type, ctx, new Set(), {
        preserveCarrierIdentity: false,
      }) ?? type
  );
};

const isWeakCallReturnType = (type: IrType | undefined): boolean =>
  !type ||
  type.kind === "anyType" ||
  (type.kind === "unknownType" && type.explicit !== true);

const hasExternalReferenceIdentity = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "referenceType") {
    return !!type.typeId || !!type.providerQualifiedName;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some(hasExternalReferenceIdentity);
  }

  return false;
};

const shouldPreferSelectedSignatureReturnType = (
  resolved: IrType | undefined,
  selected: IrType | undefined
): selected is IrType => {
  if (!selected || isWeakCallReturnType(selected)) {
    return false;
  }

  if (!resolved || isWeakCallReturnType(resolved)) {
    return true;
  }

  const resolvedTypeParameters = collectTypeParameterNames(resolved);
  if (resolvedTypeParameters.size === 0) {
    return false;
  }

  const selectedTypeParameters = collectTypeParameterNames(selected);
  return [...resolvedTypeParameters].some(
    (name) => !selectedTypeParameters.has(name)
  );
};

const shouldPreferDeclaredCallableReturnType = (
  selected: IrType | undefined,
  declaredCallable: IrType | undefined
): declaredCallable is IrType => {
  if (!declaredCallable) {
    return false;
  }

  if (!selected || isWeakCallReturnType(selected)) {
    return true;
  }

  if (
    selected.kind === "typeParameterType" &&
    declaredCallable.kind !== "typeParameterType"
  ) {
    return true;
  }

  if (!hasExternalReferenceIdentity(declaredCallable)) {
    return false;
  }

  return (
    selected.kind === "referenceType" &&
    declaredCallable.kind === "referenceType" &&
    !!declaredCallable.typeId &&
    !selected.typeId
  );
};

const isWeakSelectedSignatureParameterType = (
  type: IrType | undefined
): boolean => {
  if (!type) {
    return true;
  }

  switch (type.kind) {
    case "unknownType":
    case "anyType":
      return true;
    case "objectType":
      return type.members.length === 0;
    case "arrayType":
      return isWeakSelectedSignatureParameterType(type.elementType);
    case "tupleType":
      return type.elementTypes.some(isWeakSelectedSignatureParameterType);
    case "unionType":
    case "intersectionType":
      return type.types.some(isWeakSelectedSignatureParameterType);
    default:
      return false;
  }
};

const shouldPreferDirectCalleeFunctionType = (
  selected: IrFunctionType,
  direct: IrFunctionType
): boolean => {
  if (
    shouldPreferSelectedSignatureReturnType(
      selected.returnType,
      direct.returnType
    )
  ) {
    return true;
  }

  const count = Math.min(selected.parameters.length, direct.parameters.length);
  for (let index = 0; index < count; index += 1) {
    if (
      isWeakSelectedSignatureParameterType(selected.parameters[index]?.type) &&
      !isWeakSelectedSignatureParameterType(direct.parameters[index]?.type)
    ) {
      return true;
    }
  }

  return false;
};

const selectDeterministicCallReturnType = (sources: {
  readonly sourceBacked: IrType | undefined;
  readonly resolved: IrType | undefined;
  readonly selectedSignature: IrType | undefined;
  readonly declaredCallable: IrType | undefined;
}): IrType | undefined => {
  if (sources.sourceBacked) {
    if (
      shouldPreferSelectedSignatureReturnType(
        sources.sourceBacked,
        sources.selectedSignature
      )
    ) {
      if (
        shouldPreferDeclaredCallableReturnType(
          sources.selectedSignature,
          sources.declaredCallable
        )
      ) {
        return sources.declaredCallable;
      }
      return sources.selectedSignature;
    }

    if (
      shouldPreferDeclaredCallableReturnType(
        sources.sourceBacked,
        sources.declaredCallable
      )
    ) {
      return sources.declaredCallable;
    }
    return sources.sourceBacked;
  }

  if (
    shouldPreferSelectedSignatureReturnType(
      sources.resolved,
      sources.selectedSignature
    )
  ) {
    if (
      shouldPreferDeclaredCallableReturnType(
        sources.selectedSignature,
        sources.declaredCallable
      )
    ) {
      return sources.declaredCallable;
    }
    return sources.selectedSignature;
  }

  if (!isWeakCallReturnType(sources.resolved)) {
    if (
      shouldPreferDeclaredCallableReturnType(
        sources.resolved,
        sources.declaredCallable
      )
    ) {
      return sources.declaredCallable;
    }
    return sources.resolved;
  }

  if (!isWeakCallReturnType(sources.selectedSignature)) {
    if (
      shouldPreferDeclaredCallableReturnType(
        sources.selectedSignature,
        sources.declaredCallable
      )
    ) {
      return sources.declaredCallable;
    }
    return sources.selectedSignature;
  }

  if (sources.declaredCallable) {
    return sources.declaredCallable;
  }

  return sources.resolved ?? sources.selectedSignature;
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

  const declaration = ctx.sourceSemantics.getExportedDeclaration(
    sourceFile,
    exportName
  );
  if (!declaration) {
    return undefined;
  }

  if (memberName && declaration.Kind === TstsSyntax.KindClassDeclaration) {
    const classMember = classMembersOf(declaration).find(
      (member) =>
        member.Kind === TstsSyntax.KindMethodDeclaration &&
        getDeclarationTextName(TstsSyntax.Node_Name(member)) === memberName
    );
    const receiverTypeNode = classMember
      ? TstsSyntax.Node_Type(functionParametersOf(classMember)[0])
      : undefined;
    if (!receiverTypeNode) {
      return undefined;
    }
    return ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(receiverTypeNode)
    );
  }

  const receiverTypeNode = (() => {
    if (declaration.Kind === TstsSyntax.KindFunctionDeclaration) {
      return TstsSyntax.Node_Type(functionParametersOf(declaration)[0]);
    }

    if (declaration.Kind !== TstsSyntax.KindVariableDeclaration) {
      return undefined;
    }

    const initializer = TstsSyntax.Node_Initializer(declaration);
    if (isFunctionValueNode(initializer)) {
      return TstsSyntax.Node_Type(functionParametersOf(initializer)[0]);
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
  parameter: TstsNode,
  ctx: ProgramContext
): IrParameter => ({
  kind: "parameter",
  pattern: getTstsIdentifierText(TstsSyntax.Node_Name(parameter))
    ? {
        kind: "identifierPattern",
        name: getTstsIdentifierText(TstsSyntax.Node_Name(parameter)) ?? "",
      }
    : { kind: "identifierPattern", name: `p${parameter.Loc.pos}` },
  type: (() => {
    const typeNode = TstsSyntax.Node_Type(parameter);
    return typeNode
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeNode))
      : { kind: "unknownType" as const };
  })(),
  initializer: undefined,
  isOptional:
    TstsSyntax.Node_QuestionToken(parameter) !== undefined ||
    TstsSyntax.Node_Initializer(parameter) !== undefined,
  isRest:
    TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined,
  passing: "value",
});

const chooseInstantiatedSignatureType = (
  declaredType: IrType | undefined,
  semanticType: IrType | undefined,
  options: {
    readonly preserveDeclaredTypeParameters?: boolean;
  } = {}
): IrType | undefined => {
  if (
    options.preserveDeclaredTypeParameters === true &&
    declaredType?.kind === "typeParameterType"
  ) {
    return declaredType;
  }

  if (!semanticType || isWeakCallReturnType(semanticType)) {
    return declaredType ?? semanticType;
  }

  if (!declaredType || isWeakCallReturnType(declaredType)) {
    return semanticType;
  }

  const declaredTypeParameters = collectTypeParameterNames(declaredType);
  if (declaredTypeParameters.size === 0) {
    return declaredType;
  }

  const semanticTypeParameters = collectTypeParameterNames(semanticType);
  return [...declaredTypeParameters].some(
    (name) => !semanticTypeParameters.has(name)
  )
    ? semanticType
    : declaredType;
};

const isSameReferenceIdentity = (
  left: Extract<IrType, { kind: "referenceType" }>,
  right: Extract<IrType, { kind: "referenceType" }>
): boolean =>
  referenceTypeIdentity(left) !== undefined &&
  referenceTypeIdentity(left) === referenceTypeIdentity(right);

const isReferenceCarrierRetarget = (
  selectedType: IrType | undefined,
  resolvedType: IrType | undefined,
  actualType: IrType | undefined
): boolean => {
  if (
    selectedType?.kind !== "referenceType" ||
    resolvedType?.kind !== "referenceType" ||
    actualType?.kind !== "referenceType"
  ) {
    return false;
  }

  return (
    isSameReferenceIdentity(selectedType, actualType) &&
    !isSameReferenceIdentity(selectedType, resolvedType)
  );
};

const shouldPreferResolvedSourceNumericParameter = (
  selectedType: IrType | undefined,
  resolvedType: IrType | undefined,
  actualType: IrType | undefined
): boolean =>
  selectedType?.kind === "primitiveType" &&
  selectedType.name === "number" &&
  resolvedType?.kind === "primitiveType" &&
  resolvedType.name !== "number" &&
  sourceNumericInvocationPrimitiveNames.has(resolvedType.name) &&
  actualType?.kind === "primitiveType" &&
  actualType.name === resolvedType.name;

const chooseSelectedOrResolvedParameterType = (
  selectedType: IrType | undefined,
  resolvedType: IrType | undefined,
  actualType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!resolvedType || isWeakSelectedSignatureParameterType(resolvedType)) {
    return selectedType ?? resolvedType;
  }

  if (!selectedType || isWeakSelectedSignatureParameterType(selectedType)) {
    return resolvedType;
  }

  if (shouldPreferExactMemberType(selectedType, resolvedType, ctx)) {
    return resolvedType;
  }

  if (
    shouldPreferResolvedSourceNumericParameter(
      selectedType,
      resolvedType,
      actualType
    )
  ) {
    return resolvedType;
  }

  if (isReferenceCarrierRetarget(selectedType, resolvedType, actualType)) {
    return resolvedType;
  }

  return selectedType;
};

const chooseSelectedOrResolvedParameterTypes = (
  selectedTypes: readonly (IrType | undefined)[] | undefined,
  resolvedTypes: readonly (IrType | undefined)[] | undefined,
  actualTypes: readonly (IrType | undefined)[] | undefined,
  ctx: ProgramContext
): readonly (IrType | undefined)[] | undefined => {
  if (!selectedTypes) {
    return resolvedTypes;
  }
  if (!resolvedTypes) {
    return selectedTypes;
  }

  const count = Math.max(selectedTypes.length, resolvedTypes.length);
  return Array.from({ length: count }, (_, index) =>
    chooseSelectedOrResolvedParameterType(
      selectedTypes[index],
      resolvedTypes[index],
      actualTypes?.[index],
      ctx
    )
  );
};

const buildSourceReceiverTypeSubstitution = (
  parameters: readonly IrParameter[],
  returnType: IrType | undefined,
  receiverType: IrType | undefined,
  ownerTypeParameterNames: readonly string[],
  ownerClassDeclaration: TstsNode | undefined,
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
  ownerClassDeclaration: TstsNode | undefined,
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
  node: TstsNode,
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
      ? (resolveSourceBackedImportedIdentifierTarget(node, callee, ctx) ??
        resolveSourceBackedIdentifierGlobalTarget(node, callee, ctx))
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
    const selectedSurface = selectSourceBackedSurfaceFromSelectedSignature(
      identifierSourceTarget.overloadCandidates,
      (candidate) =>
        buildSourceBackedParameterSurface(
          candidate,
          identifierSourceTarget.ownerTypeParameterNames,
          receiverType,
          argumentCount,
          ctx
        ),
      selectedParameterTypes,
      actualArgTypes,
      expectedType,
      explicitTypeArgs,
      ctx
    );
    return selectedSurface
      ? materializeSourceBackedCallParameterTypes(
          selectedSurface,
          actualArgTypes,
          ctx
        )
      : undefined;
  }

  if (memberAccessSourceTarget) {
    const removeExtensionReceiverParameter =
      callee.kind === "memberAccess" &&
      callee.memberBinding?.isExtensionMethod === true;
    const selectedSurface = selectSourceBackedSurfaceFromSelectedSignature(
      getPublicSourceBackedOverloadCandidates(
        memberAccessSourceTarget.overloadCandidates
      ),
      (candidate) =>
        buildSourceBackedCallParameterSurface(
          candidate,
          ownerTypeParameterNamesOfDeclaration(candidate),
          memberAccessSourceTarget.receiverType,
          argumentCount,
          ctx,
          removeExtensionReceiverParameter
        ),
      selectedParameterTypes,
      actualArgTypes,
      expectedType,
      explicitTypeArgs,
      ctx
    );
    return selectedSurface
      ? materializeSourceBackedCallParameterTypes(
          selectedSurface,
          actualArgTypes,
          ctx
        )
      : undefined;
  }

  if (callee.kind !== "memberAccess" || !callee.memberBinding) {
    return undefined;
  }

  const overloads = ctx.bindings.getTargetMemberOverloads(
    callee.memberBinding.ownerIdentity,
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
    for (const symbol of collectExportedTopLevelSymbols(sourceFile, ctx)) {
      if (symbol.exportName === sourceOrigin.exportName) {
        return symbol;
      }
    }
    return undefined;
  })();
  if (!exportedSymbol) {
    return undefined;
  }

  const resolvedSignature = ctx.sourceSemantics.getResolvedSignature(node);
  const resolvedSignatureDeclaration = resolvedSignature
    ? ctx.sourceSemantics.getSignatureDeclaration(resolvedSignature)
    : undefined;
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

  const resolveSignatureDeclarations = (): readonly TstsNode[] | undefined => {
    if (!sourceOrigin.memberName) {
      return exportedCallableTarget?.overloadCandidates;
    }

    if (exportedCallableTarget && !ownerClass) {
      return exportedCallableTarget.overloadCandidates;
    }

    if (!ownerClass) {
      return undefined;
    }

    if (
      resolvedSignatureDeclaration?.Kind === TstsSyntax.KindMethodDeclaration &&
      getDeclarationTextName(TstsSyntax.Node_Name(resolvedSignatureDeclaration)) ===
        sourceOrigin.memberName
    ) {
      const resolvedOwner = resolvedSignatureDeclaration.Parent;
      if (
        (resolvedOwner?.Kind === TstsSyntax.KindClassDeclaration ||
          resolvedOwner?.Kind === TstsSyntax.KindClassExpression) &&
        classContainsMethodInHierarchy(ownerClass, resolvedOwner, ctx)
      ) {
        return [resolvedSignatureDeclaration];
      }
    }

    const staticIntent =
      callee.kind === "memberAccess"
        ? getPropertyAccessReceiverStaticIntent(node, ctx)
        : undefined;
    return getPublicSourceBackedOverloadCandidates(
      collectClassMethodDeclarationsInHierarchy(
        ownerClass,
        sourceOrigin.memberName,
        ctx,
        new Set<string>(),
        staticIntent
      )
    );
  };

  const declarations = resolveSignatureDeclarations();
  if (!declarations || declarations.length === 0) {
    return undefined;
  }

  const removeExtensionReceiverParameter =
    callee.memberBinding?.isExtensionMethod === true;
  const selectedSurface = selectSourceBackedSurfaceFromSelectedSignature(
    declarations,
    (declaration) =>
      buildSourceBackedCallParameterSurface(
        declaration,
        ownerTypeParameterNamesOfDeclaration(declaration),
        receiverType,
        argumentCount,
        ctx,
        removeExtensionReceiverParameter
      ),
    selectedParameterTypes,
    actualArgTypes,
    expectedType,
    explicitTypeArgs,
    ctx
  );
  return selectedSurface
    ? materializeSourceBackedCallParameterTypes(
        selectedSurface,
        actualArgTypes,
        ctx
      )
    : undefined;
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

  const overloads = ctx.bindings.getTargetMemberOverloads(
    binding.ownerIdentity,
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
  node: TstsNode,
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
  const callTarget = TstsSyntax.AsCallExpression(node)?.Expression;
  if (!callTarget) {
    throw new Error("ICE: call expression missing callee expression");
  }
  const args = TstsSyntax.Node_Arguments(node) ?? [];
  const explicitTypeArgNodes = TstsSyntax.Node_TypeArguments(node) ?? [];
  const callee = convertExpression(callTarget, ctx, undefined);

  // Extract receiver type for member method calls (e.g., dict.get() -> dict's type)
  const receiverIrType =
    callee.kind === "memberAccess"
      ? getMemberCallReceiverType(callee.object)
      : getEnclosingClassSuperType(node, ctx);
  const exactDeclaringTargetType =
    callee.kind === "memberAccess" ? callee.memberBinding?.type : undefined;

  // Resolve the call selected by TSTS. Parameter types are used only for
  // contextual lowering; overload/generic selection is not recomputed here.
  const typeSystem = ctx.typeSystem;
  const sigId = ctx.binding.resolveCallSignature(node);
  const isClassValueMemberCall =
    getPropertyAccessReceiverStaticIntent(node, ctx) === true;
  const exactMemberCallableType = (() => {
    if (callTarget.Kind !== TstsSyntax.KindPropertyAccessExpression) {
      return undefined;
    }
    if (!receiverIrType) return undefined;
    const propertyAccess = TstsSyntax.AsPropertyAccessExpression(callTarget);
    if (!propertyAccess?.name) return undefined;
    const propertyName = getTstsIdentifierText(propertyAccess.name);
    if (!propertyName) return undefined;

    const memberId = ctx.binding.resolvePropertyAccess(callTarget);
    if (memberId) {
      const exactMemberType = typeSystem.typeOfMemberId(memberId, receiverIrType);
      if (exactMemberType.kind !== "unknownType") {
        return exactMemberType;
      }
    }

    if (!isClassValueMemberCall) {
      const receiverMemberType = typeSystem.typeOfMember(receiverIrType, {
        kind: "byName",
        name: propertyName,
      });
      if (receiverMemberType.kind !== "unknownType") {
        return receiverMemberType;
      }
    }

    return undefined;
  })();
  const hasSelectedTstsSignature = sigId !== undefined;
  const argumentCount = args.length;
  const callSiteArgModifiers: (CallSiteArgModifier | undefined)[] = new Array(
    argumentCount
  ).fill(undefined);

  const explicitTypeArgs =
    explicitTypeArgNodes.length > 0
      ? explicitTypeArgNodes.flatMap((ta) =>
          ta
            ? [typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))]
            : []
        )
    : undefined;
  const callableCandidateSourceType =
    exactMemberCallableType?.kind === "intersectionType"
      ? exactMemberCallableType
      : callee.inferredType === undefined ||
          callee.inferredType.kind === "unknownType"
        ? exactMemberCallableType
        : callee.inferredType;
  let calleeFunctionType =
    callableCandidateSourceType?.kind === "functionType"
      ? callableCandidateSourceType
      : undefined;

  const initialResolved =
    sigId && hasSelectedTstsSignature
      ? typeSystem.resolveCall({
          sigId,
          argumentCount,
          receiverType: receiverIrType,
          declaringTargetType: exactDeclaringTargetType,
          explicitTypeArgs,
          expectedReturnType: expectedType,
        })
      : undefined;
  const selectedSignatureFunctionType =
    buildSelectedSignatureFunctionType(node, ctx, explicitTypeArgs);
  const selectedSignatureParameterTypes = selectedSignatureFunctionType
    ? expandParameterTypesForArguments(
        selectedSignatureFunctionType.parameters,
        selectedSignatureFunctionType.parameters.map((parameter) => parameter.type),
        argumentCount
      )
    : undefined;
  const selectedSignatureReturnType = selectedSignatureFunctionType?.returnType;
  const sourceSemanticArgumentTypes = args.map((argument) => {
    if (!argument || argument.Kind === TstsSyntax.KindSpreadElement) {
      return undefined;
    }
    const unwrapped = unwrapCallSiteArgumentModifier(argument, ctx);
    return getSourceSemanticIrType(
      ctx.sourceSemantics.getExpressionType(unwrapped.expression),
      unwrapped.expression,
      ctx
    );
  });
  const usesAuthoritativeSurfaceBindings = ctx.surface !== "core";
  const boundGlobalCallParameterTypes = getBoundGlobalCallParameterTypes(
    callee,
    argumentCount,
    sourceSemanticArgumentTypes,
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
  const sourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    argumentCount,
    selectedSignatureParameterTypes ?? initialResolved?.parameterTypes,
    sourceSemanticArgumentTypes,
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
      selectedSignatureReturnType ?? initialResolved?.returnType,
      expectedReturnCandidates
    );
    const resolvedParameterTypesForReturnSubstitution =
      selectedSignatureParameterTypes ?? initialResolved?.parameterTypes;
    if (
      resolvedReturnSubstitutions &&
      resolvedParameterTypesForReturnSubstitution
    ) {
      return resolvedParameterTypesForReturnSubstitution.map((t) =>
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
      selectedSignatureParameterTypes ??
      initialResolved?.parameterTypes ??
      sourceBackedCallParameterTypes?.parameterTypes
    );
  })();
  const initialSurfaceParameterTypes = (() => {
    return (
      authoritativeBoundGlobalSurfaceParameterTypes ??
      sourceBackedCallParameterTypes?.surfaceParameterTypes ??
      ambientBoundGlobalSurfaceParameterTypes ??
      authoritativeDirectCalleeParameterTypes ??
      selectedSignatureParameterTypes ??
      initialResolved?.surfaceParameterTypes ??
      initialResolved?.parameterTypes
    );
  })();
  const initialFunctionParameterTypes =
    calleeFunctionType?.parameters.map((parameter) => parameter.type);
  const initialParameterTypesForContext =
    initialSurfaceParameterTypes ??
    initialParameterTypes ??
    sourceBackedCallParameterTypes?.parameterTypes ??
    initialFunctionParameterTypes;

  const isLambdaArg = (expr: TstsNode): boolean => {
    if (
      expr.Kind === TstsSyntax.KindArrowFunction ||
      expr.Kind === TstsSyntax.KindFunctionExpression
    ) {
      return true;
    }
    if (expr.Kind === TstsSyntax.KindParenthesizedExpression) {
      const inner = TstsSyntax.AsParenthesizedExpression(expr)?.Expression;
      return inner ? isLambdaArg(inner) : false;
    }
    return false;
  };

  const isExplicitlyTypedLambdaArg = (expr: TstsNode): boolean => {
    if (expr.Kind === TstsSyntax.KindParenthesizedExpression) {
      const inner = TstsSyntax.AsParenthesizedExpression(expr)?.Expression;
      if (!inner) return false;
      return isExplicitlyTypedLambdaArg(
        inner
      );
    }

    if (
      expr.Kind !== TstsSyntax.KindArrowFunction &&
      expr.Kind !== TstsSyntax.KindFunctionExpression
    ) {
      return false;
    }

    if (TstsSyntax.Node_Type(expr)) return true;
    if (typeParametersOf(expr).length > 0) return true;
    return functionParametersOf(expr).some(
      (parameter) => TstsSyntax.Node_Type(parameter) !== undefined
    );
  };

  const shouldDeferLambdaForInference = (expr: TstsNode): boolean =>
    isLambdaArg(expr) && !isExplicitlyTypedLambdaArg(expr);

  const isGenericFunctionValueArg = (expr: TstsNode): boolean => {
    const symbol = resolveReferencedIdentifierSymbol(ctx, expr);
    return !!symbol && ctx.genericFunctionValueSymbols.has(symbol);
  };

  const shouldDeferGenericFunctionValueForInference = (
    expr: TstsNode,
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
    expr: TstsNode,
    parameterType: IrType | undefined
  ): boolean => {
    if (!parameterType) {
      return false;
    }

    const current = stripParentheses(expr);
    if (current.Kind === TstsSyntax.KindArrayLiteralExpression) {
      return (
        (TstsSyntax.Node_Elements(current) ?? []).length > 0 &&
        ((explicitTypeArgs?.length ?? 0) > 0 ||
          ctx.typeSystem.containsTypeParameter(parameterType))
      );
    }

    return (
      current.Kind === TstsSyntax.KindObjectLiteralExpression &&
      ((explicitTypeArgs?.length ?? 0) > 0 ||
        ctx.typeSystem.containsTypeParameter(parameterType))
    );
  };
  const hasSpeculativeOverloadContext = false;
  const shouldUseInitialArgumentContext = (expr: TstsNode): boolean => {
    void expr;
    return !hasSpeculativeOverloadContext;
  };

  // Pass 1: convert non-lambda arguments and infer type args from them.
  const argsWorking: (IrCallExpression["arguments"][number] | undefined)[] =
    new Array(args.length);
  const argTypesForInference: (IrType | undefined)[] =
    Array(args.length).fill(undefined);
  const deferredAggregateContextIndices = new Set<number>();

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    const unwrapped = unwrapCallSiteArgumentModifier(arg, ctx);
    const isAttributeNamedArgumentObject =
      arg.Kind !== TstsSyntax.KindSpreadElement &&
      isAttributeMetadataNamedArgumentPosition(
        node,
        index,
        unwrapped.expression,
        ctx.sourceSemantics
      );
    const initialExpectedType = isAttributeNamedArgumentObject
      ? undefined
      : initialParameterTypesForContext?.[index];
    const expectedType =
      arg.Kind === TstsSyntax.KindSpreadElement ||
      shouldUseInitialArgumentContext(arg)
        ? initialExpectedType
        : undefined;

    if (arg.Kind === TstsSyntax.KindSpreadElement) {
      const spreadNode = TstsSyntax.AsSpreadElement(arg)?.Expression;
      if (!spreadNode) {
        throw new Error("ICE: spread argument missing expression");
      }
      const spreadExpr = convertExpression(spreadNode, ctx, undefined);
      argsWorking[index] = {
        kind: "spread" as const,
        expression: spreadExpr,
        inferredType: spreadExpr.inferredType,
        sourceSpan: getSourceSpan(arg),
      };
      continue;
    }

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
      !isAttributeNamedArgumentObject &&
      (deferAggregateContext ||
        (expectedType === undefined &&
          (stripParentheses(unwrapped.expression).Kind ===
            TstsSyntax.KindObjectLiteralExpression ||
            stripParentheses(unwrapped.expression).Kind ===
              TstsSyntax.KindArrayLiteralExpression)));

    const argumentContext = isAttributeNamedArgumentObject
      ? withSuppressedObjectLiteralContextualType(ctx, unwrapped.expression)
      : ctx;
    const converted = convertExpression(
      unwrapped.expression,
      argumentContext,
      deferAggregateContext ? undefined : expectedType
    );
    argsWorking[index] = converted;
    argTypesForInference[index] = converted.inferredType;
    if (shouldRecontextualizeAggregateLater) {
      deferredAggregateContextIndices.add(index);
    }
  }

  const lambdaContextResolved = initialResolved;
  const lambdaContextFunctionType = calleeFunctionType;
  const lambdaContextFunctionParameterTypes =
    calleeFunctionType?.parameters.map((parameter) => parameter.type);
  const lambdaContextSurfaceParameterTypes =
    authoritativeBoundGlobalSurfaceParameterTypes ??
    sourceBackedCallParameterTypes?.surfaceParameterTypes ??
    lambdaContextResolved?.surfaceParameterTypes ??
    lambdaContextResolved?.parameterTypes;
  const lambdaContextResolvedParameterTypes =
    lambdaContextResolved?.parameterTypes ??
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
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg.Kind === TstsSyntax.KindSpreadElement) continue;
    const unwrapped = unwrapCallSiteArgumentModifier(arg, ctx);
    if (unwrapped.modifier) {
      callSiteArgModifiers[index] = unwrapped.modifier;
    }
    const isDeferredLambda = isLambdaArg(unwrapped.expression);
    const isDeferredGenericFunctionValue = isGenericFunctionValueArg(
      unwrapped.expression
    );
    const shouldRecontextualizeAggregateLater =
      deferredAggregateContextIndices.has(index);
    const shouldDeferExplicitAggregateUntilFinal =
      shouldRecontextualizeAggregateLater &&
      !isDeferredLambda &&
      !isDeferredGenericFunctionValue &&
      false;
    const shouldDeferSpeculativeAggregateUntilFinal =
      shouldRecontextualizeAggregateLater &&
      !isDeferredLambda &&
      !isDeferredGenericFunctionValue &&
      hasSpeculativeOverloadContext;
    if (
      !isDeferredLambda &&
      !isDeferredGenericFunctionValue &&
      !shouldRecontextualizeAggregateLater
    ) {
      continue;
    }
    if (shouldDeferExplicitAggregateUntilFinal) {
      continue;
    }
    if (shouldDeferSpeculativeAggregateUntilFinal) {
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

  const finalResolved = lambdaContextResolved ?? initialResolved;
  const directCalleeCallableType =
    callee.inferredType && callee.inferredType.kind !== "unknownType"
      ? callee.inferredType
      : undefined;
  const directCalleeFunctionType =
    directCalleeCallableType?.kind === "functionType"
      ? directCalleeCallableType
      : selectCallableFunctionType(
          directCalleeCallableType,
          finalResolutionArgumentCount,
          finalResolutionArgTypes,
          expectedType,
          explicitTypeArgs,
          ctx
        );
  const selectedOrDirectFunctionType =
    selectedSignatureFunctionType &&
    directCalleeFunctionType &&
    shouldPreferDirectCalleeFunctionType(
      selectedSignatureFunctionType,
      directCalleeFunctionType
    )
      ? directCalleeFunctionType
      : (selectedSignatureFunctionType ?? directCalleeFunctionType);
  const finalFunctionType =
    lambdaContextFunctionType ??
    selectedOrDirectFunctionType ??
    calleeFunctionType ??
    directCalleeFunctionType;
  const finalFunctionParameterTypes = finalFunctionType
    ? specializeCallableParameterTypes(
        finalFunctionType,
        finalResolutionArgumentCount,
        finalResolutionArgTypes,
        expectedType,
        explicitTypeArgs,
        ctx
      )
    : undefined;
  const finalSourceBackedCallParameterTypes = getSourceBackedCallParameterTypes(
    node,
    callee,
    receiverIrType,
    finalResolutionArgumentCount,
    selectedSignatureParameterTypes ??
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
  const memberOverloadResolutionOverridesBoundGlobal =
    finalCallee.kind === "memberAccess" &&
    false;
  const finalBoundGlobalParameterTypes =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : boundGlobalCallParameterTypes?.parameterTypes;
  const finalAuthoritativeBoundGlobalSurfaceParameterTypes =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : authoritativeBoundGlobalSurfaceParameterTypes;
  const finalAuthoritativeBoundGlobalReturnType =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : authoritativeBoundGlobalReturnType;
  const finalSourceBackedParameterTypesForMetadata =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : sourceBackedParameterTypes;
  const finalSourceBackedSurfaceParameterTypesForMetadata =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : sourceBackedSurfaceParameterTypes;
  const finalSourceBackedReturnTypeForMetadata =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : sourceBackedReturnType;
  const contextualParameterTypes =
    finalFunctionParameterTypes ??
    initialParameterTypesForContext ??
    (calleeFunctionType
      ? expandParameterTypesForArguments(
          calleeFunctionType.parameters,
          calleeFunctionType.parameters.map((parameter) => parameter.type),
          args.length
        )
      : undefined);
  const preserveAuthoritativeDirectCalleeSurfaceIdentity =
    !!authoritativeFinalDirectCalleeParameterTypes &&
    !finalAuthoritativeBoundGlobalSurfaceParameterTypes &&
    !sourceBackedSurfaceParameterTypes &&
    !finalAmbientBoundGlobalSurfaceParameterTypes;
  const finalResolvedParameterTypesForMetadata =
    chooseSelectedOrResolvedParameterTypes(
      chooseSelectedOrResolvedParameterTypes(
        selectedSignatureParameterTypes,
        finalResolved?.parameterTypes,
        finalResolutionArgTypes,
        ctx
      ),
      finalFunctionParameterTypes,
      finalResolutionArgTypes,
      ctx
    );
  const finalResolvedSurfaceParameterTypesForMetadata =
    chooseSelectedOrResolvedParameterTypes(
      chooseSelectedOrResolvedParameterTypes(
        selectedSignatureParameterTypes,
        finalResolved?.surfaceParameterTypes,
        finalResolutionArgTypes,
        ctx
      ),
      finalFunctionParameterTypes,
      finalResolutionArgTypes,
      ctx
    );
  const finalInvocationMetadata = finalizeInvocationMetadata({
    ctx,
    callee: finalCallee,
    receiverType: receiverIrType,
    callableType: finalFunctionType,
    argumentCount: finalResolutionArgumentCount,
    argTypes: finalResolutionArgTypes,
    explicitTypeArgs,
    expectedType,
    boundGlobalParameterTypes: finalBoundGlobalParameterTypes,
    authoritativeBoundGlobalSurfaceParameterTypes:
      finalAuthoritativeBoundGlobalSurfaceParameterTypes,
    authoritativeBoundGlobalReturnType: finalAuthoritativeBoundGlobalReturnType,
    sourceBackedParameterTypes: finalSourceBackedParameterTypesForMetadata,
    sourceBackedSurfaceParameterTypes:
      finalSourceBackedSurfaceParameterTypesForMetadata,
    sourceBackedReturnType: finalSourceBackedReturnTypeForMetadata,
    ambientBoundGlobalSurfaceParameterTypes:
      finalAmbientBoundGlobalSurfaceParameterTypes,
    authoritativeDirectParameterTypes:
      authoritativeFinalDirectCalleeParameterTypes,
    resolvedParameterTypes: finalResolvedParameterTypesForMetadata,
    resolvedSurfaceParameterTypes: finalResolvedSurfaceParameterTypesForMetadata,
    resolvedReturnType:
      selectedSignatureReturnType ?? finalResolved?.returnType,
    contextualParameterTypes,
    contextualSurfaceParameterTypes: contextualParameterTypes,
    exactParameterCandidates: [],
    exactSurfaceParameterCandidates: [],
    exactReturnCandidates: [],
    preserveDirectSurfaceIdentity:
      preserveAuthoritativeDirectCalleeSurfaceIdentity,
  });
  const parameterTypes = finalInvocationMetadata.parameterTypes;
  const surfaceParameterTypes = finalInvocationMetadata.surfaceParameterTypes;
  const canRecontextualizeGenericFunctionArgument = (
    aggregateExpression: TstsNode,
    contextualExpectedType: IrType
  ): boolean => {
    if (
      aggregateExpression.Kind !== TstsSyntax.KindArrowFunction &&
      aggregateExpression.Kind !== TstsSyntax.KindFunctionExpression
    ) {
      return false;
    }

    const expectedFunctionType =
      contextualExpectedType.kind === "functionType"
        ? contextualExpectedType
        : typeSystem.delegateToFunctionType(contextualExpectedType);
    if (!expectedFunctionType) {
      return false;
    }

    const sourceParameterCount = functionParametersOf(aggregateExpression).length;
    if (sourceParameterCount > expectedFunctionType.parameters.length) {
      return false;
    }

    for (
      let parameterIndex = 0;
      parameterIndex < sourceParameterCount;
      parameterIndex += 1
    ) {
      const expectedParameter = expectedFunctionType.parameters[parameterIndex];
      if (
        expectedParameter?.type &&
        containsTypeParameter(expectedParameter.type)
      ) {
        return false;
      }
    }

    return true;
  };
  const recontextualizeArguments = (
    argumentsToRecontextualize: readonly IrCallExpression["arguments"][number][],
    targetParameterTypes: readonly (IrType | undefined)[] | undefined,
    targetSurfaceParameterTypes: readonly (IrType | undefined)[] | undefined
  ): readonly IrCallExpression["arguments"][number][] =>
    argumentsToRecontextualize.map((argument, index) => {
      const sourceArgument = args[index];
      if (
        !sourceArgument ||
        sourceArgument.Kind === TstsSyntax.KindSpreadElement ||
        argument.kind === "spread"
      ) {
        return argument;
      }

      const unwrapped = unwrapCallSiteArgumentModifier(sourceArgument, ctx);
      if (
        isAttributeMetadataNamedArgumentPosition(
          node,
          index,
          unwrapped.expression,
          ctx.sourceSemantics
        )
      ) {
        return argument;
      }

      const aggregateExpression = stripParentheses(unwrapped.expression);
      const supportsFinalContextualConversion =
        aggregateExpression.Kind === TstsSyntax.KindObjectLiteralExpression ||
        aggregateExpression.Kind === TstsSyntax.KindArrayLiteralExpression ||
        aggregateExpression.Kind === TstsSyntax.KindCallExpression ||
        aggregateExpression.Kind === TstsSyntax.KindArrowFunction ||
        aggregateExpression.Kind === TstsSyntax.KindFunctionExpression;
      if (!supportsFinalContextualConversion) {
        return argument;
      }

      const expectedType =
        targetSurfaceParameterTypes?.[index] ?? targetParameterTypes?.[index];
      const contextualExpectedType =
        expectedType?.kind === "functionType"
          ? expectedType
          : expectedType
            ? (typeSystem.delegateToFunctionType(expectedType) ?? expectedType)
            : undefined;

      if (
        !contextualExpectedType ||
        (containsTypeParameter(contextualExpectedType) &&
          !canRecontextualizeGenericFunctionArgument(
            aggregateExpression,
            contextualExpectedType
          ))
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
        aggregateExpression.Kind !== TstsSyntax.KindCallExpression &&
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
    });
  const recontextualizedFinalArguments = recontextualizeArguments(
    convertedArgs,
    parameterTypes,
    surfaceParameterTypes
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
  const refinedResolvedParameterTypesForMetadata =
    chooseSelectedOrResolvedParameterTypes(
      chooseSelectedOrResolvedParameterTypes(
        selectedSignatureParameterTypes,
        finalResolved?.parameterTypes,
        finalizedArgTypes,
        ctx
      ),
      finalFunctionParameterTypes,
      finalizedArgTypes,
      ctx
    );
  const refinedResolvedSurfaceParameterTypesForMetadata =
    chooseSelectedOrResolvedParameterTypes(
      chooseSelectedOrResolvedParameterTypes(
        selectedSignatureParameterTypes,
        finalResolved?.surfaceParameterTypes,
        finalizedArgTypes,
        ctx
      ),
      finalFunctionParameterTypes,
      finalizedArgTypes,
      ctx
    );
  const refinedSourceBackedCallParameterTypes =
    getSourceBackedCallParameterTypes(
      node,
      finalCallee,
      receiverIrType,
      finalResolutionArgumentCount,
      parameterTypes,
      finalizedArgTypes,
      expectedType,
      explicitTypeArgs,
      ctx
    );
  const effectiveRefinedSourceBackedCallParameterTypes =
    memberOverloadResolutionOverridesBoundGlobal
      ? undefined
      : refinedSourceBackedCallParameterTypes;
  const effectiveSourceBackedCallParameterTypes =
    effectiveRefinedSourceBackedCallParameterTypes ??
    finalSourceBackedCallParameterTypes ??
    sourceBackedCallParameterTypes;
  const effectiveFinalInvocationMetadata = effectiveRefinedSourceBackedCallParameterTypes
    ? finalizeInvocationMetadata({
        ctx,
        callee: finalCallee,
        receiverType: receiverIrType,
        callableType: finalFunctionType,
        argumentCount: finalResolutionArgumentCount,
        argTypes: finalizedArgTypes,
        explicitTypeArgs,
        expectedType,
        boundGlobalParameterTypes: finalBoundGlobalParameterTypes,
        authoritativeBoundGlobalSurfaceParameterTypes:
          finalAuthoritativeBoundGlobalSurfaceParameterTypes,
        authoritativeBoundGlobalReturnType:
          finalAuthoritativeBoundGlobalReturnType,
        sourceBackedParameterTypes:
          effectiveRefinedSourceBackedCallParameterTypes.parameterTypes,
        sourceBackedSurfaceParameterTypes:
          effectiveRefinedSourceBackedCallParameterTypes.surfaceParameterTypes,
        sourceBackedReturnType:
          effectiveRefinedSourceBackedCallParameterTypes.returnType,
        ambientBoundGlobalSurfaceParameterTypes:
          finalAmbientBoundGlobalSurfaceParameterTypes,
        authoritativeDirectParameterTypes:
          authoritativeFinalDirectCalleeParameterTypes,
        resolvedParameterTypes: refinedResolvedParameterTypesForMetadata,
        resolvedSurfaceParameterTypes:
          refinedResolvedSurfaceParameterTypesForMetadata,
        resolvedReturnType:
          selectedSignatureReturnType ?? finalResolved?.returnType,
        contextualParameterTypes,
        contextualSurfaceParameterTypes: contextualParameterTypes,
        exactParameterCandidates: [],
        exactSurfaceParameterCandidates: [],
        exactReturnCandidates: [],
        preserveDirectSurfaceIdentity:
          preserveAuthoritativeDirectCalleeSurfaceIdentity,
      })
    : finalInvocationMetadata;
  const returnParameterTypes = selectResolvedCallableParameterTypes(
    effectiveFinalInvocationMetadata.parameterTypes ?? parameterTypes,
    undefined,
    ctx
  );
  const returnSurfaceParameterTypes = selectResolvedCallableParameterTypes(
    effectiveFinalInvocationMetadata.surfaceParameterTypes ?? surfaceParameterTypes,
    undefined,
    ctx,
    { preserveVisibleSurfaceIdentity: true }
  );
  const emittedRecontextualizedArguments =
    returnParameterTypes !== parameterTypes ||
    returnSurfaceParameterTypes !== surfaceParameterTypes
      ? recontextualizeArguments(
          finalizedArguments,
          returnParameterTypes,
          returnSurfaceParameterTypes
        )
      : finalizedArguments;
  const emittedFinalizedArguments =
    emittedRecontextualizedArguments === finalizedArguments
      ? finalizedArguments
      : normalizeFinalizedInvocationArguments(
          emittedRecontextualizedArguments,
          returnParameterTypes,
          returnSurfaceParameterTypes,
          ctx
        );
  const emittedFinalizedArgTypes = emittedFinalizedArguments.map((argument) =>
    argument.kind === "spread" ? undefined : argument.inferredType
  );
  const finalSourceBackedParameterTypes =
    effectiveFinalInvocationMetadata.sourceBackedParameterTypes;
  const finalSourceBackedSurfaceParameterTypes =
    effectiveFinalInvocationMetadata.sourceBackedSurfaceParameterTypes;
  const finalSourceBackedReturnType =
    effectiveFinalInvocationMetadata.sourceBackedReturnType;
  const resolvedSourceBackedReturnType =
    shouldPreferExactMemberType(
      finalSourceBackedReturnType,
      selectedSignatureReturnType ?? finalResolved?.returnType,
      ctx
    )
      ? (selectedSignatureReturnType ?? finalResolved?.returnType)
      : finalSourceBackedReturnType;
  const secondaryRestParameter = (() => {
    if (finalSourceBackedCallParameterTypes?.restParameter) {
      return finalSourceBackedCallParameterTypes.restParameter;
    }

    if (boundGlobalCallParameterTypes?.restParameter) {
      return boundGlobalCallParameterTypes.restParameter;
    }

    if (finalResolved?.surfaceRestParameter) {
      return finalResolved.surfaceRestParameter;
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
      elementType: returnParameterTypes?.[restIndex],
    };
  })();
  const specializeReturnTypeFromCallableTemplate = (
    returnType: IrType,
    callableType: IrFunctionType | undefined
  ): IrType | undefined => {
    const methodTypeParameterNames =
      callableType?.typeParameters?.map((parameter) => parameter.name) ?? [];
    if (!callableType || methodTypeParameterNames.length === 0) {
      return undefined;
    }

    const parameterTemplates = expandParameterTypesForArguments(
      callableType.parameters,
      callableType.parameters.map((parameter) => parameter.type),
      finalResolutionArgumentCount
    );
    const substitutions = deriveInvocationTypeSubstitutions(
      parameterTemplates,
      finalizedArgTypes,
      callableType.returnType,
      expectedType,
      methodTypeParameterNames,
      explicitTypeArgs,
      ctx
    );
    if (!substitutions || substitutions.size === 0) {
      return undefined;
    }

    const candidate = substituteTypeParameters(returnType, substitutions);
    if (!candidate) {
      return undefined;
    }

    return collectTypeParameterNames(candidate).size <
      collectTypeParameterNames(returnType).size
      ? candidate
      : undefined;
  };
  const finalInferredType = (() => {
    if (callTarget.Kind === TstsSyntax.KindSuperKeyword) {
      return { kind: "voidType" } as const;
    }

    const resolvedReturnType = selectDeterministicCallReturnType({
      sourceBacked: resolvedSourceBackedReturnType,
      resolved: finalResolved?.returnType,
      selectedSignature: selectedSignatureReturnType,
      declaredCallable: finalFunctionType?.returnType,
    });
    if (!resolvedReturnType) {
      return { kind: "unknownType" } as const;
    }

    if (
      isGlobalJsonParseCall(finalCallee, ctx) &&
      !explicitTypeArgs?.length &&
      !expectedType &&
      resolvedReturnType.kind === "typeParameterType"
    ) {
      return createDynamicJsonValueType();
    }

    if (
      finalResolved?.typePredicate &&
      (resolvedReturnType.kind === "unknownType" ||
        resolvedReturnType.kind === "anyType")
    ) {
      return { kind: "primitiveType", name: "boolean" } as const;
    }

    return (
      specializeReturnTypeFromCallableTemplate(
        resolvedReturnType,
        finalFunctionType
      ) ??
      specializeReturnTypeFromCallableTemplate(
        resolvedReturnType,
        directCalleeFunctionType
      ) ??
      resolvedReturnType
    );
  })();
  const inferredTypeArgumentsForIr = (() => {
    if (typeArguments && typeArguments.length > 0) {
      return undefined;
    }

    return finalResolved?.typeArguments;
  })();
  const argumentPassingFromBinding = extractArgumentPassingFromBinding(
    finalCallee,
    args.length
  );
  const argumentPassingFromTargetOverloads =
    extractArgumentPassingFromTargetMemberOverloads(
      finalCallee,
      args.length,
      ctx,
      emittedFinalizedArgTypes
    );
  const argumentPassing =
    argumentPassingFromBinding ??
    argumentPassingFromTargetOverloads ??
    (finalResolved
      ? finalResolved.parameterModes.slice(0, args.length)
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
      const currentArgType = argTypes[pred.parameterIndex];
      const narrowedTargetType = currentArgType
        ? (narrowTypeByAssignableTarget(
            ctx.typeSystem,
            currentArgType,
            pred.targetType,
            true
          ) ?? pred.targetType)
        : pred.targetType;
      return {
        kind: "typePredicate",
        argIndex: pred.parameterIndex,
        targetType: narrowedTargetType,
      };
    }

    return undefined;
  })();
  const argumentArmSelections = emittedFinalizedArguments.map((_, index) =>
    returnParameterTypes?.[index]?.kind === "unionType"
      ? selectUnionArm({
          kind: "semanticProjection",
          sourceType: emittedFinalizedArgTypes[index],
          targetUnion: returnParameterTypes[index],
        })
      : { kind: "unsupported" as const, reason: "Parameter is not a union." }
  );
  const hasArgumentArmSelection = argumentArmSelections.some(
    (selection) => selection.kind !== "unsupported"
  );
  const deterministicInferredType = isSourceMarkerApiChainExpression(finalCallee)
    ? ({ kind: "voidType" } as const)
    : finalInferredType;

  return {
    kind: "call",
    callee: finalCallee,
    // Pass parameter types as expectedType for deterministic contextual typing
    // This ensures `spreadArray([1,2,3], [4,5,6])` with `number[]` params produces `double[]`
    arguments: emittedFinalizedArguments,
    isOptional: TstsSyntax.Node_QuestionDotToken(node) !== undefined,
    inferredType: deterministicInferredType,
    sourceSpan: getSourceSpan(node),
    signatureId: sigId,
    typeArguments:
      typeArguments ??
      finalResolved?.typeArguments ??
      inferredTypeArgumentsForIr,
    explicitTypeArguments: typeArguments,
    requiresSpecialization,
    resolutionExpectedReturnType: expectedType,
    argumentPassing: argumentPassingWithOverrides,
    argumentArmSelections: hasArgumentArmSelection
      ? argumentArmSelections
      : undefined,
    parameterTypes: returnParameterTypes,
    surfaceParameterTypes: returnSurfaceParameterTypes,
    restParameter: boundGlobalCallParameterTypes
      ? boundGlobalCallParameterTypes.restParameter
      : (finalResolved?.restParameter ??
        explicitSemanticRestParameter ??
        secondaryRestParameter),
    surfaceRestParameter:
      finalAmbientBoundGlobalSurfaceRestParameter ??
      (boundGlobalCallParameterTypes
        ? boundGlobalCallParameterTypes.restParameter
        : effectiveSourceBackedCallParameterTypes
          ? effectiveSourceBackedCallParameterTypes.restParameter
          : (finalResolved?.surfaceRestParameter ??
            explicitSemanticRestParameter ??
            secondaryRestParameter)),
    sourceBackedParameterTypes: finalSourceBackedParameterTypes,
    sourceBackedSurfaceParameterTypes: finalSourceBackedSurfaceParameterTypes,
    sourceBackedRestParameter:
      effectiveSourceBackedCallParameterTypes?.restParameter,
    sourceBackedReturnType: resolvedSourceBackedReturnType,
    narrowing,
  };
};
