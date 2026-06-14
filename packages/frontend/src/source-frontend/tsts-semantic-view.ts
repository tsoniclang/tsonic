import type {
  ExtensionModuleGraph,
  ExtensionTypeChecker,
  GoPtr,
  TstsNode,
  TstsSourceFile,
  TstsSignature,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsNodeNameText,
  TstsSyntax,
} from "@tsonic/tsts";
import * as path from "node:path";
import type {
  SourceSemanticFactKey,
  SourceSemanticFactStore,
  SourceSemanticView,
} from "./semantic-view.js";
import { createSourceSemanticFactStore } from "./semantic-view.js";
import { selectedSignatureFactKey } from "./source-facts.js";

type TstsSemanticType = GoPtr<TstsType>;
type TstsSemanticSymbol = GoPtr<TstsSymbol>;
type TstsSemanticSignature = GoPtr<TstsSignature>;

export type TstsSourceCallLikeExpression = TstsNode;

type TstsSemanticModuleResolution = {
  readonly moduleGraph: ExtensionModuleGraph;
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly dependencyEdges: readonly {
    readonly from: string;
    readonly to: string;
    readonly specifier: string;
  }[];
};

type SourceExpressionTarget =
  | {
      readonly kind: "module";
      readonly sourceFile: TstsSourceFile;
    }
  | {
      readonly kind: "value";
      readonly node: TstsNode;
      readonly type?: TstsSemanticType;
    };

export type TstsSourceSemanticView = SourceSemanticView<
  TstsNode,
  TstsNode,
  TstsNode,
  TstsSemanticType,
  TstsSemanticSymbol,
  TstsSemanticSignature,
  TstsNode,
  TstsNode
>;

const getSymbolDeclarations = (
  checker: ExtensionTypeChecker,
  symbol: TstsSemanticSymbol
): readonly TstsNode[] => {
  return checker.getSymbolDeclarations(symbol).filter(
    (node): node is TstsNode => node !== undefined
  );
};

const canonicalPath = (fileName: string): string =>
  path.resolve(fileName).replace(/\\/g, "/");

const sourceFileByName = (
  resolution: TstsSemanticModuleResolution | undefined,
  fileName: string
): TstsSourceFile | undefined => {
  const canonicalFileName = canonicalPath(fileName);
  return resolution?.sourceFiles.find(
    (sourceFile) => canonicalPath(sourceFile.FileName()) === canonicalFileName
  );
};

const targetSourceFileForSpecifier = (
  resolution: TstsSemanticModuleResolution | undefined,
  sourceFile: TstsSourceFile,
  specifier: string
): TstsSourceFile | undefined => {
  const dependencyEdge = resolution?.dependencyEdges.find(
    (edge) =>
      canonicalPath(edge.from) === canonicalPath(sourceFile.FileName()) &&
      edge.specifier === specifier
  );
  return dependencyEdge
    ? sourceFileByName(resolution, dependencyEdge.to)
    : undefined;
};

const targetSourceFileForImportBinding = (
  resolution: TstsSemanticModuleResolution | undefined,
  sourceFile: TstsSourceFile,
  importBinding: NonNullable<
    ReturnType<TstsSemanticModuleResolution["moduleGraph"]["getImportBinding"]>
  >
): TstsSourceFile | undefined => {
  const importModule = resolution?.moduleGraph
    .getImports(sourceFile)
    .find((moduleImport) =>
      moduleImport.bindings.some(
        (binding) => binding.bindingNode === importBinding.bindingNode
      )
    );
  return importModule
    ? targetSourceFileForSpecifier(resolution, sourceFile, importModule.specifier)
    : undefined;
};

function resolveSourceImportBindingTarget(
  checker: ExtensionTypeChecker,
  resolution: TstsSemanticModuleResolution | undefined,
  sourceFile: TstsSourceFile,
  importBinding: NonNullable<
    ReturnType<TstsSemanticModuleResolution["moduleGraph"]["getImportBinding"]>
  >,
  seen: ReadonlySet<string> = new Set()
): SourceExpressionTarget | undefined {
  const targetSourceFile = targetSourceFileForImportBinding(
    resolution,
    sourceFile,
    importBinding
  );
  if (!targetSourceFile) {
    return undefined;
  }
  return importBinding.kind === "namespace"
    ? {
        kind: "module",
        sourceFile: targetSourceFile,
      }
    : resolveSourceExportTarget(
        checker,
        resolution,
        targetSourceFile,
        importBinding.importedName,
        seen
      );
}

const resolveSourceExportTarget = (
  checker: ExtensionTypeChecker,
  resolution: TstsSemanticModuleResolution | undefined,
  sourceFile: TstsSourceFile,
  exportedName: string,
  seen: ReadonlySet<string> = new Set()
): SourceExpressionTarget | undefined => {
  const visitId = `${canonicalPath(sourceFile.FileName())}\0${exportedName}`;
  if (seen.has(visitId)) {
    return undefined;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(visitId);

  const binding = resolution?.moduleGraph.getExportBinding(
    sourceFile,
    exportedName
  );
  if (binding) {
    if (binding.sourceSpecifier) {
      const targetSourceFile = targetSourceFileForSpecifier(
        resolution,
        sourceFile,
        binding.sourceSpecifier
      );
      if (!targetSourceFile) {
        return undefined;
      }
      if (binding.kind === "namespace") {
        return {
          kind: "module",
          sourceFile: targetSourceFile,
        };
      }
      return resolveSourceExportTarget(
        checker,
        resolution,
        targetSourceFile,
        binding.localName ?? exportedName,
        nextSeen
      );
    }

    const localName = binding.localName ?? binding.exportedName;
    if (localName) {
      const imported = resolution?.moduleGraph.getImportBinding(
        sourceFile,
        localName
      );
      if (imported) {
        const importedTarget = resolveSourceImportBindingTarget(
          checker,
          resolution,
          sourceFile,
          imported,
          nextSeen
        );
        if (importedTarget) {
          return importedTarget;
        }
      }
    }

    if (binding.bindingNode) {
      return {
        kind: "value",
        node: binding.bindingNode,
      };
    }
  }

  for (const starExport of resolution?.moduleGraph.getExports(sourceFile) ?? []) {
    if (starExport.kind !== "star" || !starExport.sourceSpecifier) {
      continue;
    }
    const targetSourceFile = targetSourceFileForSpecifier(
      resolution,
      sourceFile,
      starExport.sourceSpecifier
    );
    if (!targetSourceFile) {
      continue;
    }
    const target = resolveSourceExportTarget(
      checker,
      resolution,
      targetSourceFile,
      exportedName,
      nextSeen
    );
    if (target) {
      return target;
    }
  }

  return undefined;
};

const resolveSourceImportDeclarations = (
  checker: ExtensionTypeChecker,
  symbol: TstsSemanticSymbol,
  resolution: TstsSemanticModuleResolution | undefined
): readonly TstsNode[] => {
  if (!symbol || !resolution) {
    return [];
  }

  for (const declaration of getSymbolDeclarations(checker, symbol)) {
    const localName =
      getTstsIdentifierText(declaration) ?? getTstsNodeNameText(declaration);
    const sourceFile = getTstsContainingSourceFile(
      declaration
    ) as TstsSourceFile | undefined;
    if (!localName || !sourceFile) {
      continue;
    }

    const importBinding = resolution.moduleGraph.getImportBinding(
      sourceFile,
      localName
    );
    if (!importBinding) {
      continue;
    }

    const target = resolveSourceImportBindingTarget(
      checker,
      resolution,
      sourceFile,
      importBinding
    );
    if (target?.kind === "value") {
      return [target.node];
    }
  }

  return [];
};

const getExportedDeclarationFromResolution = (
  checker: ExtensionTypeChecker,
  sourceFile: TstsNode,
  exportedName: string
): TstsNode | undefined => {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) {
    return undefined;
  }
  const exported = checker
    .getExportsOfModule(symbol)
    .find((candidate) => checker.getSymbolName(candidate) === exportedName);
  const declarations =
    exported === undefined ? [] : checker.getSymbolDeclarations(exported);
  return declarations.find((node): node is TstsNode => node !== undefined);
};

const getExpressionType = (
  checker: ExtensionTypeChecker,
  expression: TstsNode
): TstsSemanticType => {
  return (
    checker.getNarrowedTypeAtLocation(expression) ??
    checker.getTypeAtLocation(expression)
  );
};

const sourceTargetType = (
  checker: ExtensionTypeChecker,
  target: SourceExpressionTarget | undefined
): TstsSemanticType => {
  if (!target || target.kind !== "value") {
    return undefined;
  }
  if (target.type) {
    return target.type;
  }
  const initializer = getTstsInitializerNode(target.node);
  return initializer
    ? getExpressionType(checker, initializer)
    : getExpressionType(checker, target.node);
};

const resolveSourceExpressionTarget = (
  checker: ExtensionTypeChecker,
  expression: TstsNode,
  resolution: TstsSemanticModuleResolution | undefined
): SourceExpressionTarget | undefined => {
  const sourceFile = getTstsContainingSourceFile(expression) as
    | TstsSourceFile
    | undefined;
  if (!sourceFile || !resolution) {
    return undefined;
  }

  if (TstsSyntax.IsIdentifier(expression)) {
    const localName = getTstsIdentifierText(expression);
    const importBinding = localName
      ? resolution.moduleGraph.getImportBinding(sourceFile, localName)
      : undefined;
    return importBinding
      ? resolveSourceImportBindingTarget(
          checker,
          resolution,
          sourceFile,
          importBinding
        )
      : undefined;
  }

  if (!TstsSyntax.IsPropertyAccessExpression(expression)) {
    return undefined;
  }

  const receiver = TstsSyntax.Node_Expression(expression);
  const propertyName = getTstsIdentifierText(TstsSyntax.Node_Name(expression));
  if (!receiver || !propertyName) {
    return undefined;
  }

  const receiverTarget = resolveSourceExpressionTarget(
    checker,
    receiver,
    resolution
  );
  if (receiverTarget?.kind === "module") {
    return resolveSourceExportTarget(
      checker,
      resolution,
      receiverTarget.sourceFile,
      propertyName
    );
  }

  const receiverType =
    sourceTargetType(checker, receiverTarget) ?? getExpressionType(checker, receiver);
  const propertySymbol = checker.getPropertyOfType(receiverType, propertyName);
  if (!propertySymbol) {
    return undefined;
  }

  const propertyType = checker.getTypeOfSymbolAtLocation(
    propertySymbol,
    expression
  );
  const propertyNode =
    checker.getSymbolValueDeclaration(propertySymbol) ??
    checker
      .getSymbolDeclarations(propertySymbol)
      .find((node): node is TstsNode => node !== undefined);
  return propertyNode
    ? {
        kind: "value",
        node: propertyNode,
        type: propertyType,
      }
    : undefined;
};

const getSourceBackedCallType = (
  checker: ExtensionTypeChecker,
  expression: TstsNode,
  resolution: TstsSemanticModuleResolution | undefined
): TstsSemanticType => {
  if (!TstsSyntax.IsCallExpression(expression)) {
    return undefined;
  }
  const callee = TstsSyntax.Node_Expression(expression);
  if (!callee) {
    return undefined;
  }
  const calleeTarget = resolveSourceExpressionTarget(
    checker,
    callee,
    resolution
  );
  const calleeType =
    sourceTargetType(checker, calleeTarget) ?? getExpressionType(checker, callee);
  const [signature] = checker.getCallSignatures(calleeType);
  return signature ? checker.getReturnTypeOfSignature(signature) : undefined;
};

const getSourceImportExpressionType = (
  checker: ExtensionTypeChecker,
  expression: TstsNode,
  resolution: TstsSemanticModuleResolution | undefined
): TstsSemanticType => {
  const sourceBackedCallType = getSourceBackedCallType(
    checker,
    expression,
    resolution
  );
  if (sourceBackedCallType) {
    return sourceBackedCallType;
  }

  const expressionTarget = resolveSourceExpressionTarget(
    checker,
    expression,
    resolution
  );
  const expressionTargetType = sourceTargetType(checker, expressionTarget);
  if (expressionTargetType) {
    return expressionTargetType;
  }

  const symbol = checker.getSymbolAtLocation(expression);
  const [sourceDeclaration] = resolveSourceImportDeclarations(
    checker,
    symbol,
    resolution
  );
  if (!sourceDeclaration) {
    return undefined;
  }

  const initializer = getTstsInitializerNode(sourceDeclaration);
  return initializer
    ? getExpressionType(checker, initializer)
    : getExpressionType(checker, sourceDeclaration);
};

export const createTstsSemanticView = (
  checker: ExtensionTypeChecker,
  facts: SourceSemanticFactStore<TstsNode> = createSourceSemanticFactStore(),
  resolution?: TstsSemanticModuleResolution
): TstsSourceSemanticView => ({
  engine: "tsts",
  getExpressionType: (expression: TstsNode): TstsSemanticType =>
    getSourceImportExpressionType(checker, expression, resolution) ??
    getExpressionType(checker, expression),
  getContextualType: (expression: TstsNode): TstsSemanticType =>
    checker.getContextualType(expression),
  getSymbol: (node: TstsNode): TstsSemanticSymbol =>
    checker.getSymbolAtLocation(node),
  resolveAlias: (symbol: TstsSemanticSymbol): TstsSemanticSymbol => {
    if (resolveSourceImportDeclarations(checker, symbol, resolution).length > 0) {
      return symbol;
    }
    const resolved = checker.resolveAlias(symbol);
    if (resolved === undefined) {
      return symbol;
    }
    if (
      checker.getSymbolDeclarations(resolved).length === 0 &&
      getSymbolDeclarations(checker, symbol).length > 0
    ) {
      return symbol;
    }
    return resolved;
  },
  getSymbolDeclarations: (symbol: TstsSemanticSymbol): readonly TstsNode[] => {
    const sourceDeclarations = resolveSourceImportDeclarations(
      checker,
      symbol,
      resolution
    );
    return sourceDeclarations.length > 0
      ? sourceDeclarations
      : getSymbolDeclarations(checker, symbol);
  },
  getSymbolValueDeclaration: (symbol: TstsSemanticSymbol): TstsNode | undefined =>
    checker.getSymbolValueDeclaration(symbol),
  getTypeAliasOrSymbol: (type: TstsSemanticType): TstsSemanticSymbol =>
    checker.getTypeAliasOrSymbol(type),
  getTypeSymbolName: (type: TstsSemanticType): string | undefined =>
    checker.getTypeSymbolName(type),
  getTypeAliasSymbolName: (type: TstsSemanticType): string | undefined =>
    checker.getTypeAliasSymbolName(type),
  getExportSpecifierLocalTargetSymbol: (
    node: TstsNode
  ): TstsSemanticSymbol =>
    checker.getExportSpecifierLocalTargetSymbol(node),
  getExportedDeclaration: (
    sourceFile: TstsNode,
    exportedName: string
  ): TstsNode | undefined =>
    getExportedDeclarationFromResolution(checker, sourceFile, exportedName),
  getExportsOfModule: (
    symbol: TstsSemanticSymbol
  ): readonly TstsSemanticSymbol[] =>
    checker.getExportsOfModule(symbol).filter(
      (exported): exported is TstsSymbol => exported !== undefined
    ),
  getShorthandAssignmentValueSymbol: (node: TstsNode): TstsSemanticSymbol =>
    checker.getShorthandAssignmentValueSymbol(node),
  getDeclaredType: (symbol: TstsSemanticSymbol): TstsSemanticType =>
    checker.getDeclaredTypeOfSymbol(symbol),
  getTypeFromTypeNode: (node: TstsNode): TstsSemanticType =>
    checker.getTypeFromTypeNode(node),
  getTypeOfSymbolAtLocation: (
    symbol: TstsSemanticSymbol,
    location: TstsNode
  ): TstsSemanticType =>
    checker.getTypeOfSymbolAtLocation(symbol, location),
  getTypeArguments: (type: TstsSemanticType): readonly TstsSemanticType[] =>
    checker.getTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getAliasTypeArguments: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] =>
    checker.getAliasTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getReferenceTypeArguments: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] =>
    checker.getReferenceTypeArguments(type).filter(
      (argument): argument is TstsType => argument !== undefined
    ),
  getApparentType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getApparentType(type),
  getUnionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getUnionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getIntersectionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getIntersectionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getUnionOrIntersectionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getUnionOrIntersectionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  getNonNullishUnionMembers: (
    type: TstsSemanticType
  ): readonly TstsSemanticType[] | undefined =>
    checker
      .getNonNullishUnionMembers(type)
      ?.filter((member): member is TstsType => member !== undefined),
  isNullishType: (type: TstsSemanticType): boolean => checker.isNullishType(type),
  isNullishVoidOrNeverType: (type: TstsSemanticType): boolean =>
    checker.isNullishVoidOrNeverType(type),
  isAnyUnknownVoidNeverOrTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isAnyUnknownVoidNeverOrTypeParameter(type),
  isAnyUnknownOrTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isAnyUnknownOrTypeParameter(type),
  isAnyOrUnknownType: (type: TstsSemanticType): boolean =>
    checker.isAnyOrUnknownType(type),
  isAnyType: (type: TstsSemanticType): boolean => checker.isAnyType(type),
  isUnknownType: (type: TstsSemanticType): boolean =>
    checker.isUnknownType(type),
  isNeverType: (type: TstsSemanticType): boolean => checker.isNeverType(type),
  isVoidType: (type: TstsSemanticType): boolean => checker.isVoidType(type),
  isUndefinedType: (type: TstsSemanticType): boolean =>
    checker.isUndefinedType(type),
  isNullType: (type: TstsSemanticType): boolean => checker.isNullType(type),
  isTypeParameter: (type: TstsSemanticType): boolean =>
    checker.isTypeParameter(type),
  isSourceScalarLikeType: (type: TstsSemanticType): boolean =>
    checker.isSourceScalarLikeType(type),
  isStringLikeType: (type: TstsSemanticType): boolean =>
    checker.isStringLikeType(type),
  isNumberLikeType: (type: TstsSemanticType): boolean =>
    checker.isNumberLikeType(type),
  isBooleanLikeType: (type: TstsSemanticType): boolean =>
    checker.isBooleanLikeType(type),
  isBigIntLikeType: (type: TstsSemanticType): boolean =>
    checker.isBigIntLikeType(type),
  isStringLiteralType: (type: TstsSemanticType): boolean =>
    checker.isStringLiteralType(type),
  isNumberLiteralType: (type: TstsSemanticType): boolean =>
    checker.isNumberLiteralType(type),
  isBooleanLiteralType: (type: TstsSemanticType): boolean =>
    checker.isBooleanLiteralType(type),
  isBigIntLiteralType: (type: TstsSemanticType): boolean =>
    checker.isBigIntLiteralType(type),
  getStringIndexType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getStringIndexType(type),
  getNumberIndexType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getNumberIndexType(type),
  getElementTypeOfArrayType: (type: TstsSemanticType): TstsSemanticType =>
    checker.getElementTypeOfArrayType(type),
  getPropertyOfType: (
    type: TstsSemanticType,
    key: string
  ): TstsSemanticSymbol =>
    checker.getPropertyOfType(type, key),
  getProperties: (type: TstsSemanticType): readonly TstsSemanticSymbol[] =>
    checker.getProperties(type).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  getCallSignatures: (
    type: TstsSemanticType
  ): readonly TstsSemanticSignature[] =>
    checker.getCallSignatures(type).filter(
      (signature): signature is TstsSignature => signature !== undefined
    ),
  getConstructSignatures: (
    type: TstsSemanticType
  ): readonly TstsSemanticSignature[] =>
    checker.getConstructSignatures(type).filter(
      (signature): signature is TstsSignature => signature !== undefined
    ),
  isArrayType: (type: TstsSemanticType): boolean => checker.isArrayType(type),
  isTupleType: (type: TstsSemanticType): boolean => checker.isTupleType(type),
  getResolvedSignature: (callExpression: TstsNode): TstsSemanticSignature =>
    facts.get(selectedSignatureFactKey, callExpression)?.signature ??
    checker.getResolvedSignature(callExpression),
  getSignatureDeclaration: (
    signature: TstsSemanticSignature
  ): TstsNode | undefined =>
    checker.getSignatureDeclaration(signature),
  getSignatureParameters: (
    signature: TstsSemanticSignature
  ): readonly TstsSemanticSymbol[] =>
    checker.getSignatureParameters(signature).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  signatureHasTypeParameters: (signature: TstsSemanticSignature): boolean =>
    checker.signatureHasTypeParameters(signature),
  getSignatureFromDeclaration: (node: TstsNode): TstsSemanticSignature =>
    checker.getSignatureFromDeclaration(node),
  getReturnTypeOfSignature: (signature: TstsSemanticSignature): TstsSemanticType =>
    checker.getReturnTypeOfSignature(signature),
  getTypePredicateOfSignature: (signature: TstsSemanticSignature): unknown =>
    checker.getTypePredicateOfSignature(signature),
  typeToTypeNode: (
    type: TstsSemanticType,
    enclosingNode: TstsNode,
    flags: number
  ): TstsNode | undefined =>
    checker.typeToTypeNode(type, enclosingNode, flags),
  getFullyQualifiedName: (symbol: TstsSemanticSymbol): string =>
    checker.getFullyQualifiedName(symbol),
  getSymbolsInScope: (
    location: TstsNode,
    meaning: number
  ): readonly TstsSemanticSymbol[] =>
    checker.getSymbolsInScope(location, meaning).filter(
      (symbol): symbol is TstsSymbol => symbol !== undefined
    ),
  typeToString: (type: TstsSemanticType): string => checker.typeToString(type),
  getFact: <T>(
    node: TstsNode,
    key: SourceSemanticFactKey<T>
  ): T | undefined => facts.get(key, node),
});
