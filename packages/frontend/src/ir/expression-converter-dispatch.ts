/**
 * Expression converter — Main dispatcher
 *
 * Converts TypeScript expression nodes to IR expressions by delegating
 * to specialized converter modules.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  getTstsContainingSourceFileName,
  getTstsDeclarationKind,
  getTstsIdentifierText,
  getTstsNodeText,
  hasTstsAmbientModifier,
  TstsSyntax,
  type TstsNode,
  type TstsSymbol,
} from "@tsonic/tsts";
import type {
  IrExpression,
  IrInterfaceMember,
  IrNumericNarrowingExpression,
  IrType,
} from "./types.js";
import type { ProgramContext } from "./program-context.js";
import type { TypeBinding } from "../program/binding-types.js";

// Import expression converters from specialized modules
import {
  convertLiteral,
  convertRegularExpressionLiteral,
} from "./converters/expressions/literals.js";
import {
  convertArrayLiteral,
  convertObjectLiteral,
} from "./converters/expressions/collections.js";
import { convertMemberExpression } from "./converters/expressions/access.js";
import {
  convertCallExpression,
  convertNewExpression,
} from "./converters/expressions/calls.js";
import {
  convertBinaryExpression,
  convertUnaryExpression,
  convertUpdateExpression,
} from "./converters/expressions/operators.js";
import {
  convertFunctionExpression,
  convertArrowFunction,
} from "./converters/expressions/functions.js";
import {
  convertConditionalExpression,
  convertTemplateLiteral,
} from "./converters/expressions/other.js";
import { shouldWrapExpressionWithAssertion } from "./converters/assertion-wrapping.js";
import {
  getSourceSpan,
  getNumericKindFromTypeNode,
  inferThisType,
  inferYieldReceivedType,
  getIdentifierStorageType,
  shouldPreserveExplicitStorageType,
  stripNullish,
  chooseUseSiteType,
  getSourceUseSiteType,
} from "./expression-converter-helpers.js";
import { resolveAmbientGlobalSourceOwner } from "./converters/expressions/ambient-global-source-owner.js";
import type { DeclId } from "./type-system/types.js";
import { readSourcePackageMetadata } from "../program/source-package-metadata.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import { getClassNameFromPath } from "../resolver/naming.js";
import {
  memberSymbolIdFromStableId,
  typeSymbolIdFromStableId,
} from "../symbols/index.js";
import type { TypeSymbolId } from "../symbols/index.js";
import { typesEqual } from "./types/ir-substitution.js";
import { extractRawExternalBindingsPayload } from "../program/external-binding-payload.js";
import {
  markerApiKindFromFact,
  markerApiSemanticsFactKey,
} from "../source-frontend/index.js";

type LiteralObjectProperty = Extract<
  Extract<IrExpression, { kind: "object" }>["properties"][number],
  { kind: "property" }
> & { readonly key: string };

const isLiteralObjectProperty = (
  property: Extract<IrExpression, { kind: "object" }>["properties"][number]
): property is LiteralObjectProperty =>
  property.kind === "property" && typeof property.key === "string";

type SatisfiesExpressionResultTypeInference = {
  readonly type: IrType;
  readonly recoveredContextualShape: boolean;
};

const mergeSatisfiesArrayElementTypes = (types: readonly IrType[]): IrType => {
  const [first, ...rest] = types;
  if (first && rest.every((type) => typesEqual(type, first))) {
    return first;
  }

  return {
    kind: "unionType",
    types,
  };
};

const inferSatisfiesExpressionResultType = (
  expr: IrExpression
): SatisfiesExpressionResultTypeInference | undefined => {
  if (expr.kind === "array") {
    const elementTypes: IrType[] = [];
    const recoveredElementTypes: (IrType | undefined)[] = [];
    let recoveredContextualShape = false;

    for (const element of expr.elements) {
      if (!element || element.kind === "spread") {
        return undefined;
      }

      const recovered = inferSatisfiesExpressionResultType(element);
      const elementType = recovered?.type ?? element.inferredType;
      if (!elementType) {
        return undefined;
      }

      elementTypes.push(elementType);
      recoveredElementTypes.push(recovered?.type);
      recoveredContextualShape =
        recoveredContextualShape || !!recovered?.recoveredContextualShape;
    }

    if (!recoveredContextualShape || elementTypes.length === 0) {
      return undefined;
    }

    if (
      expr.inferredType?.kind === "tupleType" &&
      expr.inferredType.elementTypes.length === elementTypes.length
    ) {
      return {
        type: {
          ...expr.inferredType,
          elementTypes: expr.inferredType.elementTypes.map(
            (elementType, index) => recoveredElementTypes[index] ?? elementType
          ),
        },
        recoveredContextualShape: true,
      };
    }

    if (expr.inferredType?.kind === "arrayType") {
      const recoveredTypes = recoveredElementTypes.filter(
        (type): type is IrType => type !== undefined
      );
      return {
        type: {
          kind: "arrayType",
          elementType:
            recoveredTypes.length === elementTypes.length
              ? mergeSatisfiesArrayElementTypes(recoveredTypes)
              : mergeSatisfiesArrayElementTypes([
                  expr.inferredType.elementType,
                  ...recoveredTypes,
                ]),
        },
        recoveredContextualShape: true,
      };
    }

    return {
      type: {
        kind: "arrayType",
        elementType: mergeSatisfiesArrayElementTypes(elementTypes),
      },
      recoveredContextualShape: true,
    };
  }

  if (expr.kind !== "object") {
    return undefined;
  }

  const members: IrInterfaceMember[] = [];
  for (const property of expr.properties) {
    if (!isLiteralObjectProperty(property)) {
      return undefined;
    }

    const recovered = inferSatisfiesExpressionResultType(property.value);
    const propertyType = recovered?.type ?? property.value.inferredType;
    if (!propertyType) {
      return undefined;
    }

    members.push({
      kind: "propertySignature" as const,
      name: property.key,
      type: propertyType,
      isOptional: false,
      isReadonly: false,
    });
  }

  return {
    type: {
      kind: "objectType",
      members,
    },
    recoveredContextualShape: true,
  };
};

const preserveSatisfiesExpressionResultType = (
  expr: IrExpression
): IrExpression => {
  const naturalResultType = inferSatisfiesExpressionResultType(expr);
  if (!naturalResultType) {
    return expr;
  }

  return {
    ...expr,
    inferredType: naturalResultType.type,
    ...(expr.kind === "object"
      ? { contextualType: naturalResultType.type }
      : {}),
  };
};

const isConstAssertionType = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindTypeReference &&
  getTstsIdentifierText(TstsSyntax.AsTypeReferenceNode(node)?.TypeName) ===
    "const" &&
  (TstsSyntax.Node_TypeArguments(node) ?? []).length === 0;

const isImportLikeDeclaration = (decl: TstsNode): boolean =>
  decl.Kind === TstsSyntax.KindImportClause ||
  decl.Kind === TstsSyntax.KindImportSpecifier ||
  decl.Kind === TstsSyntax.KindNamespaceImport ||
  decl.Kind === TstsSyntax.KindImportEqualsDeclaration;

const isDeclarationModuleGlobal = (decl: TstsNode): boolean => {
  for (let current: TstsNode | undefined = decl.Parent; current; current = current.Parent) {
    if (
      current.Kind === TstsSyntax.KindModuleDeclaration &&
      getTstsIdentifierText(TstsSyntax.Node_Name(current)) === "global"
    ) {
      return true;
    }
  }

  return false;
};

const isAmbientGlobalDeclaration = (decl: TstsNode): boolean => {
  if (isDeclarationModuleGlobal(decl)) {
    return true;
  }
  return (
    getTstsContainingSourceFileName(decl)?.endsWith(".d.ts") === true ||
    hasTstsAmbientModifier(decl)
  );
};

const isMemberAccessReceiverExpression = (node: TstsNode): boolean => {
  let current: TstsNode = node;

  while (current.Parent?.Kind === TstsSyntax.KindParenthesizedExpression) {
    current = current.Parent;
  }

  const parent = current.Parent;
  return (
    (parent?.Kind === TstsSyntax.KindPropertyAccessExpression ||
      parent?.Kind === TstsSyntax.KindElementAccessExpression) &&
    TstsSyntax.Node_Expression(parent) === current
  );
};

const resolveReferencedIdentifierSymbol = (
  ctx: ProgramContext,
  node: TstsNode
): TstsSymbol | undefined => {
  const symbol = ctx.sourceSemantics.getSymbol(node);
  if (!symbol) {
    return undefined;
  }

  return ctx.sourceSemantics.resolveAlias(symbol);
};

const findNearestBindingsJson = (filePath: string): string | undefined => {
  let dir = dirname(filePath);
  for (let i = 0; i < 12; i += 1) {
    const candidate = join(dir, "bindings.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
  return undefined;
};

const findOwningBindingsJson = (filePath: string): string | undefined => {
  const nearest = findNearestBindingsJson(filePath);
  if (nearest) {
    return nearest;
  }

  const namespaceKey = (() => {
    if (filePath.endsWith(".d.ts")) {
      return basename(filePath).slice(0, -".d.ts".length);
    }
    if (filePath.endsWith(".ts")) {
      return basename(filePath).slice(0, -".ts".length);
    }
    if (filePath.endsWith(".js")) {
      return basename(filePath).slice(0, -".js".length);
    }
    return undefined;
  })();
  if (!namespaceKey) {
    return undefined;
  }

  const sibling = join(dirname(filePath), namespaceKey, "bindings.json");
  return existsSync(sibling) ? sibling : undefined;
};

const readNamespaceFromBindingsJson = (
  bindingsPath: string
): string | undefined => {
  try {
    const raw = readFileSync(bindingsPath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return extractRawExternalBindingsPayload(parsed)?.namespace;
  } catch {
    return undefined;
  }
};

type ImportedIdentifierExternalBinding = {
  readonly providerQualifiedName: string;
  readonly providerOwnerIdentity?: string;
  readonly typeSymbolId?: TypeSymbolId;
};

const typeSymbolIdForExternalType = (
  ownerIdentity: string,
  providerQualifiedName: string,
  stableId?: string
): TypeSymbolId =>
  typeSymbolIdFromStableId(
    stableId ?? `${ownerIdentity}:${providerQualifiedName}`
  );

const findContainingSourcePackageRoot = (
  filePath: string
): string | undefined => {
  let currentDir = dirname(resolve(filePath));
  for (;;) {
    if (readSourcePackageMetadata(currentDir)) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
};

const sourceFileForPath = (
  filePath: string,
  ctx: ProgramContext
): TstsNode | undefined => ctx.sourceFilesByPath.get(filePath.replace(/\\/g, "/"));

const providerOwnerForExportedDeclaration = (
  declaration: TstsNode,
  declPath: string,
  namespace: string
): string | undefined => {
  const localName = getTstsIdentifierText(TstsSyntax.Node_Name(declaration));
  if (!localName) return undefined;

  const declarationKind = getTstsDeclarationKind(declaration);
  return declarationKind === "class" ||
    declarationKind === "enum" ||
    declarationKind === "interface"
    ? `${namespace}.${localName}`
    : `${namespace}.${getClassNameFromPath(declPath)}.${localName}`;
};

const resolveSourcePackageImportedIdentifierExternalBinding = (
  declPath: string,
  exportName: string,
  ctx: ProgramContext
): ImportedIdentifierExternalBinding | undefined => {
  const packageRoot = findContainingSourcePackageRoot(declPath);
  if (!packageRoot) {
    return undefined;
  }

  const metadata = readSourcePackageMetadata(packageRoot);
  if (!metadata) {
    return undefined;
  }

  const sourceFile = sourceFileForPath(declPath, ctx);
  if (!sourceFile) {
    return undefined;
  }
  const exportedDeclaration = ctx.sourceSemantics.getExportedDeclaration(
    sourceFile,
    exportName
  );
  if (!exportedDeclaration) {
    return undefined;
  }

  const namespace = getNamespaceFromPath(
    declPath,
    metadata.sourceRoot,
    metadata.namespace
  );
  const owner = providerOwnerForExportedDeclaration(
    exportedDeclaration,
    declPath,
    namespace
  );
  if (!owner) {
    return undefined;
  }

  return {
    providerQualifiedName: owner,
    providerOwnerIdentity: metadata.namespace,
    typeSymbolId: typeSymbolIdFromStableId(`${metadata.namespace}:${owner}`),
  };
};

const resolveImportedIdentifierExternalBinding = (
  declId: DeclId,
  declarations: readonly TstsNode[],
  ctx: ProgramContext
): ImportedIdentifierExternalBinding | undefined => {
  const importSpecifier = declarations.find(
    (declaration) => declaration.Kind === TstsSyntax.KindImportSpecifier
  );
  if (!importSpecifier) {
    return undefined;
  }

  const importSpecifierData = TstsSyntax.AsImportSpecifier(importSpecifier);
  const exportName =
    getTstsIdentifierText(importSpecifierData?.PropertyName) ??
    getTstsIdentifierText(TstsSyntax.Node_Name(importSpecifier));
  if (!exportName) {
    return undefined;
  }
  const declPath = ctx.binding.getSourceFilePathOfDecl(declId);
  if (!declPath) {
    return undefined;
  }

  const sourcePackageBinding =
    resolveSourcePackageImportedIdentifierExternalBinding(
      declPath,
      exportName,
      ctx
    );
  if (sourcePackageBinding) {
    return sourcePackageBinding;
  }

  const bindingsPath = findOwningBindingsJson(declPath);
  if (!bindingsPath) {
    return undefined;
  }

  const namespace = readNamespaceFromBindingsJson(bindingsPath);
  if (!namespace) {
    return undefined;
  }

  const namespaceBinding = ctx.bindings.getNamespace(namespace);
  if (!namespaceBinding) {
    return undefined;
  }

  const matchesExportName = (type: TypeBinding): boolean => {
    if (type.alias === exportName) {
      return true;
    }

    const arityAlias = type.alias.match(/^(.+)_(\d+)$/);
    if (arityAlias?.[1] === exportName) {
      return true;
    }

    const simpleTargetName = type.name.split(".").pop() ?? type.name;
    return simpleTargetName.replace(/`\d+$/, "") === exportName;
  };

  const resolvedTypeBinding = namespaceBinding.types.find(matchesExportName);
  const providerQualifiedName = resolvedTypeBinding?.name;
  if (!providerQualifiedName) {
    return undefined;
  }
  const ownerIdentity =
    resolvedTypeBinding.members[0]?.binding.ownerIdentity ?? "external-surface";
  return {
    providerQualifiedName,
    providerOwnerIdentity: ownerIdentity,
    typeSymbolId: typeSymbolIdForExternalType(
      ownerIdentity,
      providerQualifiedName,
      resolvedTypeBinding.stableId
    ),
  };
};

/**
 * Main expression conversion dispatcher
 * Converts TypeScript expression nodes to IR expressions
 *
 * @param node - The TypeScript expression node to convert
 * @param ctx - The ProgramContext for symbol resolution and type system access
 * @param expectedType - Expected type from context (e.g., LHS annotation, parameter type).
 *                       Pass `undefined` explicitly when no contextual type exists.
 *                       Used for deterministic typing of literals and arrays.
 */
export const convertExpression = (
  node: TstsNode,
  ctx: ProgramContext,
  expectedType: IrType | undefined
): IrExpression => {
  // DETERMINISTIC TYPING: No top-level getInferredType() call.
  // Each expression type derives its inferredType from the appropriate source.

  if (
    node.Kind === TstsSyntax.KindStringLiteral ||
    node.Kind === TstsSyntax.KindNumericLiteral ||
    node.Kind === TstsSyntax.KindBigIntLiteral
  ) {
    return convertLiteral(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindRegularExpressionLiteral) {
    return convertRegularExpressionLiteral(node, ctx);
  }
  if (
    node.Kind === TstsSyntax.KindTrueKeyword ||
    node.Kind === TstsSyntax.KindFalseKeyword
  ) {
    // Boolean literals have deterministic type
    return {
      kind: "literal",
      value: node.Kind === TstsSyntax.KindTrueKeyword,
      raw:
        getTstsNodeText(node) ??
        (node.Kind === TstsSyntax.KindTrueKeyword ? "true" : "false"),
      inferredType: { kind: "primitiveType", name: "boolean" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindNullKeyword) {
    // Null literal is deterministically null. Context may later adapt it, but
    // the literal itself must not erase nullish information here.
    return {
      kind: "literal",
      value: null,
      raw: "null",
      inferredType: { kind: "primitiveType", name: "null" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindUndefinedKeyword) {
    // Undefined literal - type is void
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindVoidExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: void expression without operand reached IR conversion");
    }
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(expression, ctx, undefined),
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindIdentifier) {
    const identifierText = getTstsIdentifierText(node) ?? "";
    if (identifierText === "undefined") {
      return {
        kind: "identifier",
        name: identifierText,
        inferredType: { kind: "primitiveType", name: "undefined" },
        sourceSpan: getSourceSpan(node),
      };
    }

    const declId = ctx.binding.resolveIdentifier(node);
    const sourceMarkerApi = markerApiKindFromFact(
      ctx.sourceSemantics.getFact(node, markerApiSemanticsFactKey)
    );
    const referencedSymbol = resolveReferencedIdentifierSymbol(ctx, node);
    const contextualGenericFunctionType = (() => {
      if (
        !expectedType ||
        !referencedSymbol ||
        !ctx.genericFunctionValueSymbols.has(referencedSymbol)
      ) {
        return undefined;
      }

      const expectedCallableType =
        expectedType.kind === "functionType"
          ? expectedType
          : ctx.typeSystem.delegateToFunctionType(expectedType);

      if (
        !expectedCallableType ||
        ctx.typeSystem.containsTypeParameter(expectedCallableType)
      ) {
        return undefined;
      }

      return expectedCallableType;
    })();

    // DETERMINISTIC: Prefer assignment/lambda context, then declaration type.
    const fromEnv = declId ? ctx.typeEnv?.get(declId.id) : undefined;
    const fromDecl = declId
      ? ctx.typeSystem.typeOfValueRead(declId)
      : undefined;
    const fromSourceUseSite = getSourceUseSiteType(node, ctx);

    const identifierStorageType = getIdentifierStorageType(
      ctx,
      declId,
      fromDecl,
      fromEnv
    );
    const identifierUseSiteType = chooseUseSiteType(
      identifierStorageType,
      fromSourceUseSite,
      ctx
    );
    const effectiveIdentifierType =
      contextualGenericFunctionType ??
      identifierUseSiteType ??
      identifierStorageType ??
      fromSourceUseSite;

    // Check if this identifier is an aliased import (e.g., import { String as RuntimeString })
    // Use TypeSystem.getFQNameOfDecl() to get the original name.
    let originalName: string | undefined;
    if (declId) {
      const fqName = ctx.typeSystem.getFQNameOfDecl(declId);
      // If the fqName differs from the identifier text, it's an aliased import
      if (fqName && fqName !== identifierText) {
        originalName = fqName;
      }
    }

    const symbol = ctx.sourceSemantics.getSymbol(node);
    const symbolDeclarations = symbol
      ? ctx.sourceSemantics.getSymbolDeclarations(symbol)
      : [];
    const hasImportLikeDeclaration = symbolDeclarations.some(
      isImportLikeDeclaration
    );
    const isAmbientGlobal =
      symbolDeclarations.length > 0 &&
      !hasImportLikeDeclaration &&
      symbolDeclarations.every(isAmbientGlobalDeclaration);
    const importedSourceValue = ctx.binding.resolveImportedSourceValue(node);
    const importedSourceValueBinding = importedSourceValue
      ? resolveSourcePackageImportedIdentifierExternalBinding(
          importedSourceValue.sourceFilePath,
          importedSourceValue.exportName,
          ctx
        )
      : undefined;
    const importResolvedExternalBinding =
      importedSourceValueBinding ??
      (declId && hasImportLikeDeclaration
        ? resolveImportedIdentifierExternalBinding(
            declId,
            symbolDeclarations,
            ctx
          )
        : undefined);
    const suppressSyntheticFlowAssertion =
      isMemberAccessReceiverExpression(node);
    const preserveExplicitStorageType = shouldPreserveExplicitStorageType(
      ctx,
      declId,
      fromDecl,
      fromEnv
    );

    // Check if this identifier is bound to an external target type (e.g., console, Math, etc.)
    const externalBinding = ctx.bindings.getExactBindingByKind(
      identifierText,
      "global"
    );
    const ambientIntrinsicType =
      isAmbientGlobal &&
      (identifierText === "NaN" || identifierText === "Infinity")
        ? ({ kind: "primitiveType", name: "number" } as const)
        : undefined;
    const effectiveExpressionType =
      ambientIntrinsicType ?? effectiveIdentifierType;
    if (
      externalBinding &&
      externalBinding.kind === "global" &&
      (!declId || isAmbientGlobal)
    ) {
      const baseIdentifier: IrExpression = {
        kind: "identifier",
        name: identifierText,
        inferredType: effectiveExpressionType,
        sourceSpan: getSourceSpan(node),
        providerQualifiedName: externalBinding.type,
        providerOwnerIdentity: externalBinding.ownerIdentity,
        providerMemberName: externalBinding.providerMemberName,
        typeSymbolId: typeSymbolIdFromStableId(
          `${externalBinding.ownerIdentity}:${externalBinding.staticType ?? externalBinding.type}`
        ),
        memberSymbolId: externalBinding.providerMemberName
          ? memberSymbolIdFromStableId(
              `${externalBinding.ownerIdentity}:${externalBinding.staticType ?? externalBinding.type}.${externalBinding.providerMemberName}`
            )
          : undefined,
        originalName,
        sourceMarkerApi,
        declId,
      };
      if (
        !suppressSyntheticFlowAssertion &&
        !preserveExplicitStorageType &&
        shouldWrapExpressionWithAssertion(ctx, fromDecl, fromEnv) &&
        fromEnv
      ) {
        return {
          kind: "typeAssertion",
          expression: baseIdentifier,
          targetType: fromEnv,
          inferredType: fromEnv,
          sourceSpan: getSourceSpan(node),
        };
      }
      return baseIdentifier;
    }
    const ambientSourceOwner =
      !externalBinding && isAmbientGlobal
        ? resolveAmbientGlobalSourceOwner(symbolDeclarations, ctx)
        : undefined;
    const baseIdentifier: IrExpression = {
      kind: "identifier",
      name: identifierText,
      inferredType: effectiveExpressionType,
      sourceSpan: getSourceSpan(node),
      providerQualifiedName:
        importResolvedExternalBinding?.providerQualifiedName ??
        ambientSourceOwner,
      providerOwnerIdentity:
        importResolvedExternalBinding?.providerOwnerIdentity,
      typeSymbolId:
        importResolvedExternalBinding?.typeSymbolId ??
        (ambientSourceOwner
          ? typeSymbolIdFromStableId(
              `${importResolvedExternalBinding?.providerOwnerIdentity ?? "source"}:${ambientSourceOwner}`
            )
          : undefined),
      originalName,
      sourceMarkerApi,
      declId,
    };
    if (
      !suppressSyntheticFlowAssertion &&
      !preserveExplicitStorageType &&
      shouldWrapExpressionWithAssertion(ctx, fromDecl, fromEnv) &&
      fromEnv
    ) {
      return {
        kind: "typeAssertion",
        expression: baseIdentifier,
        targetType: fromEnv,
        inferredType: fromEnv,
        sourceSpan: getSourceSpan(node),
      };
    }
    return baseIdentifier;
  }
  if (node.Kind === TstsSyntax.KindSuperKeyword) {
    return {
      kind: "identifier",
      name: "super",
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindArrayLiteralExpression) {
    return convertArrayLiteral(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindObjectLiteralExpression) {
    return convertObjectLiteral(node, ctx, expectedType);
  }
  if (
    node.Kind === TstsSyntax.KindPropertyAccessExpression ||
    node.Kind === TstsSyntax.KindElementAccessExpression
  ) {
    return convertMemberExpression(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindCallExpression) {
    return convertCallExpression(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindNewExpression) {
    return convertNewExpression(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindBinaryExpression) {
    return convertBinaryExpression(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindPrefixUnaryExpression) {
    return convertUnaryExpression(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindPostfixUnaryExpression) {
    return convertUpdateExpression(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindTypeOfExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: typeof expression without operand reached IR conversion");
    }
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(expression, ctx, undefined),
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindVoidExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: void expression without operand reached IR conversion");
    }
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(expression, ctx, undefined),
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindDeleteExpression) {
    throw new Error(
      "ICE: delete expression reached IR conversion - validation missed TSN2001"
    );
  }
  if (node.Kind === TstsSyntax.KindConditionalExpression) {
    return convertConditionalExpression(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindFunctionExpression) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertFunctionExpression(node, ctx, expectedType);
  }
  if (node.Kind === TstsSyntax.KindArrowFunction) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertArrowFunction(node, ctx, expectedType);
  }
  if (
    node.Kind === TstsSyntax.KindTemplateExpression ||
    node.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral
  ) {
    return convertTemplateLiteral(node, ctx);
  }
  if (node.Kind === TstsSyntax.KindSpreadElement) {
    // Spread inherits type from expression (the array being spread)
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: spread element without expression reached IR conversion");
    }
    const spreadExpr = convertExpression(expression, ctx, undefined);
    return {
      kind: "spread",
      expression: spreadExpr,
      inferredType: spreadExpr.inferredType,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindThisKeyword) {
    // Deterministic `this` typing:
    // 1. object-literal synthetic receiver (when converting method/accessor bodies)
    // 2. enclosing class declaration
    return {
      kind: "this",
      inferredType: ctx.objectLiteralThisType ?? inferThisType(node),
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindAwaitExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: await expression without operand reached IR conversion");
    }
    const awaitedExpr = convertExpression(expression, ctx, undefined);
    const awaitedType = awaitedExpr.inferredType
      ? ctx.typeSystem.expandUtility("Awaited", [awaitedExpr.inferredType])
      : undefined;
    return {
      kind: "await",
      expression: awaitedExpr,
      inferredType: awaitedType,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindYieldExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    return {
      kind: "yield",
      expression: expression
        ? convertExpression(expression, ctx, undefined)
        : undefined,
      delegate: TstsSyntax.AsYieldExpression(node)?.AsteriskToken !== undefined,
      inferredType: inferYieldReceivedType(node, ctx),
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.Kind === TstsSyntax.KindParenthesizedExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    return expression
      ? convertExpression(expression, ctx, expectedType)
      : {
          kind: "identifier",
          name: "",
          inferredType: undefined,
          sourceSpan: getSourceSpan(node),
        };
  }
  if (node.Kind === TstsSyntax.KindNonNullExpression) {
    // `expr!` has no runtime semantics but DOES narrow the type (T | null → T).
    // Preserve the inner expression, but strip null/undefined from its inferredType.
    const expression = TstsSyntax.Node_Expression(node);
    if (!expression) {
      throw new Error("ICE: non-null expression without operand reached IR conversion");
    }
    const inner = convertExpression(expression, ctx, expectedType);
    const narrowed = stripNullish(inner.inferredType);
    return narrowed ? { ...inner, inferredType: narrowed } : inner;
  }
  if (node.Kind === TstsSyntax.KindSatisfiesExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    const typeNode = TstsSyntax.Node_Type(node);
    if (!expression || !typeNode) {
      throw new Error("ICE: satisfies expression without expression/type reached IR conversion");
    }
    const satisfiedType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(typeNode)
    );
    return preserveSatisfiesExpressionResultType(
      convertExpression(expression, ctx, satisfiedType)
    );
  }
  if (
    node.Kind === TstsSyntax.KindAsExpression ||
    node.Kind === TstsSyntax.KindTypeAssertionExpression
  ) {
    const expression = TstsSyntax.Node_Expression(node);
    const assertedTypeNode = TstsSyntax.Node_Type(node);
    if (!expression || !assertedTypeNode) {
      throw new Error("ICE: assertion expression without expression/type reached IR conversion");
    }
    if (isConstAssertionType(assertedTypeNode)) {
      return convertExpression(expression, ctx, expectedType);
    }

    // Convert the asserted type through the TypeSystem.
    const assertedType = ctx.typeSystem.typeFromSyntax(
      ctx.binding.captureTypeSyntax(assertedTypeNode)
    );

    // Check if this is a numeric narrowing (e.g., `as int`, `as byte`)
    const numericKind = getNumericKindFromTypeNode(assertedTypeNode);
    if (numericKind !== undefined) {
      // Convert the inner expression with no expected type so we preserve its natural classification.
      const innerExpr = convertExpression(expression, ctx, undefined);

      const sourceNeedsRuntimeCast =
        innerExpr.inferredType === undefined ||
        innerExpr.inferredType.kind === "unknownType" ||
        innerExpr.inferredType.kind === "anyType";

      // If the source type is unknown/any (or unresolved), we cannot prove a
      // compile-time numeric narrowing. Preserve explicit user intent as a
      // runtime cast (`(int)x`) via a regular typeAssertion.
      if (sourceNeedsRuntimeCast) {
        return {
          kind: "typeAssertion",
          expression: innerExpr,
          targetType: assertedType,
          inferredType: assertedType,
          sourceSpan: getSourceSpan(node),
        };
      }

      // Determine the inferredType based on the targetKind.
      // INVARIANT: int32 → primitiveType(name="int")
      // Other numeric kinds remain as referenceType (handled by assertedType)
      const inferredType =
        numericKind === "int32"
          ? { kind: "primitiveType" as const, name: "int" as const }
          : assertedType;

      // Create a numeric narrowing expression that preserves the inner expression
      const narrowingExpr: IrNumericNarrowingExpression = {
        kind: "numericNarrowing",
        expression: innerExpr,
        targetKind: numericKind,
        inferredType,
        sourceSpan: getSourceSpan(node),
      };
      return narrowingExpr;
    }

    // Check if this is `as number` or `as double` - explicit widening intent
    // This creates a numericNarrowing with targetKind: float64 to distinguish
    // from a plain literal (which also has inferredType: number but no assertion)
    if (
      assertedType.kind === "primitiveType" &&
      assertedType.name === "number"
    ) {
      // Convert the inner expression with no expected type so we preserve its natural classification.
      const innerExpr = convertExpression(expression, ctx, undefined);

      // Check if the inner expression is numeric (literal or already classified)
      const isNumericInner =
        (innerExpr.kind === "literal" && typeof innerExpr.value === "number") ||
        innerExpr.kind === "numericNarrowing";

      if (isNumericInner) {
        const narrowingExpr: IrNumericNarrowingExpression = {
          kind: "numericNarrowing",
          expression: innerExpr,
          targetKind: "float64",
          inferredType: assertedType,
          sourceSpan: getSourceSpan(node),
        };
        return narrowingExpr;
      }
    }

    // Check if this is a type erasure (unknown/any) - NOT a runtime cast
    // `x as unknown` or `x as any` just tells TS to forget the type
    if (
      assertedType.kind === "unknownType" ||
      assertedType.kind === "anyType"
    ) {
      // Preserve contextual typing from the outer position.
      return convertExpression(expression, ctx, expectedType);
    }

    // Check if this is a parameter modifier type (out<T>, ref<T>, in<T>)
    // These are not real type casts - they're parameter passing annotations
    const isParameterModifierType =
      assertedType.kind === "referenceType" &&
      (assertedType.name === "out" ||
        assertedType.name === "ref" ||
        assertedType.name === "in" ||
        assertedType.name === "inref");

    if (isParameterModifierType) {
      // Preserve contextual typing from the outer position.
      // The parameter modifier itself is handled in call lowering / argument emission.
      return convertExpression(expression, ctx, expectedType);
    }

    // Convert the inner expression contextually, using the asserted type as the target.
    // This prevents `({ ... } as T)` from becoming an anonymous object cast to T.
    const innerExpr = convertExpression(expression, ctx, assertedType);

    // Non-numeric assertion - create type assertion node for target cast.
    return {
      kind: "typeAssertion",
      expression: innerExpr,
      targetType: assertedType,
      inferredType: assertedType,
      sourceSpan: getSourceSpan(node),
    };
  }

  throw new Error(`Unsupported expression kind reached IR conversion: ${node.Kind}`);
};
