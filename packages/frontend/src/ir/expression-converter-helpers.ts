/**
 * Expression converter helpers — numeric kind extraction, this-type inference,
 * parenthesis unwrapping, unknown-type checking, identifier storage type resolution,
 * and nullish stripping.
 */

import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsNodeLocation,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsTypeParameterNodes,
  getTstsTypeReferenceName,
  forEachTstsChild,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
  type TstsNode,
  type TstsType,
} from "@tsonic/tsts";
import type { SourceLocation } from "../types/diagnostic.js";
import type {
  IrFunctionType,
  IrInterfaceMember,
  IrParameter,
  IrType,
  NumericKind,
} from "./types.js";
import { TSONIC_TO_NUMERIC_KIND } from "./types.js";
import type { ProgramContext } from "./program-context.js";

export const getSourceSpan = (node: TstsNode): SourceLocation | undefined => {
  const sourceFile = getTstsContainingSourceFile(node);
  return getTstsNodeLocation(sourceFile, node);
};

/**
 * Extract the NumericKind from a type node if it references a known numeric alias.
 *
 * Examples:
 * - `int` → int32
 * - `byte` → uint8
 * - `long` → int64
 * - `string` → undefined (not numeric)
 */
export const getNumericKindFromTypeNode = (
  typeNode: TstsNode
): NumericKind | undefined => {
  // Handle type reference nodes (e.g., `int`, `byte`)
  if (typeNode.Kind === TstsSyntax.KindTypeReference) {
    const name = getTstsTypeReferenceName(typeNode);
    if (name) {
      return TSONIC_TO_NUMERIC_KIND.get(name);
    }
  }

  return undefined;
};

export const inferThisType = (node: TstsNode): IrType | undefined => {
  let current: TstsNode | undefined = node;

  while (current) {
    if (
      current.Kind === TstsSyntax.KindClassDeclaration ||
      current.Kind === TstsSyntax.KindClassExpression
    ) {
      const className = getTstsNodeNameText(current);
      if (!className) return undefined;

      const typeArguments =
        getTstsTypeParameterNodes(current)
          .map((typeParameter): IrType | undefined => {
            const name = getTstsNodeNameText(typeParameter);
            return name ? { kind: "typeParameterType", name } : undefined;
          })
          .filter((type): type is IrType => type !== undefined) ?? [];

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.Parent;
  }

  return undefined;
};

const entityNameToText = (entityName: TstsNode): string | undefined => {
  if (entityName.Kind === TstsSyntax.KindIdentifier) {
    return getTstsIdentifierText(entityName);
  }
  if (entityName.Kind === TstsSyntax.KindQualifiedName) {
    const qualifiedName = TstsSyntax.AsQualifiedName(entityName);
    const left = qualifiedName?.Left
      ? entityNameToText(qualifiedName.Left)
      : undefined;
    const right = getTstsIdentifierText(qualifiedName?.Right);
    return left && right ? `${left}.${right}` : undefined;
  }
  return getTstsNodeText(entityName);
};

const hasAsteriskToken = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindFunctionDeclaration:
      return TstsSyntax.AsFunctionDeclaration(node)?.AsteriskToken !== undefined;
    case TstsSyntax.KindFunctionExpression:
      return TstsSyntax.AsFunctionExpression(node)?.AsteriskToken !== undefined;
    case TstsSyntax.KindMethodDeclaration:
      return TstsSyntax.AsMethodDeclaration(node)?.AsteriskToken !== undefined;
    default:
      return false;
  }
};

const getEnclosingGeneratorNextTypeNode = (
  node: TstsNode
): TstsNode | undefined => {
  let current: TstsNode | undefined = node.Parent;

  while (current) {
    if (
      current.Kind === TstsSyntax.KindFunctionDeclaration ||
      current.Kind === TstsSyntax.KindFunctionExpression ||
      current.Kind === TstsSyntax.KindMethodDeclaration
    ) {
      if (!hasAsteriskToken(current)) {
        current = current.Parent;
        continue;
      }

      const returnType = TstsSyntax.Node_Type(current);
      if (!returnType || returnType.Kind !== TstsSyntax.KindTypeReference) {
        return undefined;
      }

      const typeReference = TstsSyntax.AsTypeReferenceNode(returnType);
      const generatorName = typeReference?.TypeName
        ? entityNameToText(typeReference.TypeName)
        : undefined;
      if (!generatorName) {
        return undefined;
      }
      const lastSegment = generatorName.split(".").pop() ?? generatorName;
      if (lastSegment !== "Generator" && lastSegment !== "AsyncGenerator") {
        return undefined;
      }

      return TstsSyntax.Node_TypeArguments(returnType)?.[2];
    }

    current = current.Parent;
  }

  return undefined;
};

export const inferYieldReceivedType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  const nextTypeNode = getEnclosingGeneratorNextTypeNode(node);
  if (!nextTypeNode) {
    return undefined;
  }

  return ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(nextTypeNode)
  );
};

export const unwrapParens = (node: TstsNode): TstsNode => {
  let current = node;
  while (current.Kind === TstsSyntax.KindParenthesizedExpression) {
    const inner = TstsSyntax.Node_Expression(current);
    if (!inner) {
      return current;
    }
    current = inner;
  }
  return current;
};

export const isExplicitUnknownTypeNode = (
  node: TstsNode | undefined
): boolean => !!node && node.Kind === TstsSyntax.KindUnknownKeyword;

export const hasExplicitUnknownStorageInitializer = (
  node: TstsNode | undefined
): boolean => {
  if (!node) return false;

  const current = unwrapParens(node);
  if (
    current.Kind === TstsSyntax.KindAsExpression ||
    current.Kind === TstsSyntax.KindTypeAssertionExpression
  ) {
    return isExplicitUnknownTypeNode(TstsSyntax.Node_Type(current));
  }

  if (current.Kind === TstsSyntax.KindSatisfiesExpression) {
    return isExplicitUnknownTypeNode(TstsSyntax.Node_Type(current));
  }

  return false;
};

const isPureNullishType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "primitiveType") {
    return type.name === "null" || type.name === "undefined";
  }
  if (type.kind !== "unionType") {
    return false;
  }
  return (
    type.types.length > 0 &&
    type.types.every((member) => isPureNullishType(member))
  );
};

export const shouldPreserveExplicitStorageType = (
  ctx: ProgramContext,
  declId: ReturnType<ProgramContext["binding"]["resolveIdentifier"]>,
  fromDecl: IrType | undefined,
  fromEnv: IrType | undefined
): boolean => {
  if (!fromDecl || !fromEnv || !declId) {
    return false;
  }

  if (!ctx.binding.getTypeNodeOfDecl(declId)) {
    return false;
  }

  return isPureNullishType(fromEnv) && !isPureNullishType(fromDecl);
};

export const getIdentifierStorageType = (
  ctx: ProgramContext,
  declId: ReturnType<ProgramContext["binding"]["resolveIdentifier"]>,
  fromDecl: IrType | undefined,
  fromEnv: IrType | undefined
): IrType | undefined => {
  if (shouldPreserveExplicitStorageType(ctx, declId, fromDecl, fromEnv)) {
    return fromDecl;
  }
  if (fromEnv) {
    return fromEnv;
  }
  if (!fromDecl) return fromEnv;
  if (!declId) return fromEnv ?? fromDecl;

  if (ctx.binding.getTypeNodeOfDecl(declId)) return fromDecl;

  const declNode = ctx.binding.getValueDeclarationNode(declId);
  if (declNode) {
    if (
      declNode.Kind === TstsSyntax.KindVariableDeclaration ||
      declNode.Kind === TstsSyntax.KindParameter ||
      declNode.Kind === TstsSyntax.KindBindingElement
    ) {
      if (hasExplicitUnknownStorageInitializer(getTstsInitializerNode(declNode))) {
        return fromDecl;
      }
    }
  }

  return fromEnv ?? fromDecl;
};

export const getSourceSemanticIrType = (
  semanticType: TstsType | undefined,
  enclosingNode: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  if (!semanticType) {
    return undefined;
  }

  const directType = convertSourceSemanticTypeDirect(
    semanticType,
    ctx,
    enclosingNode,
    new Set()
  );
  if (directType) {
    return directType;
  }

  const typeNode = ctx.sourceSemantics.typeToTypeNode(
    semanticType,
    enclosingNode,
    0
  );
  if (typeNode) {
    attachSyntheticTypeNodeParents(typeNode, enclosingNode);
  }
  return typeNode
    ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeNode))
    : undefined;
};

export const getSourceUseSiteType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined =>
  getSourceSemanticIrType(
    ctx.sourceSemantics.getExpressionType(node),
    node,
    ctx
  );

export const isWeakSourceUseSiteType = (type: IrType | undefined): boolean => {
  if (!type) {
    return true;
  }

  switch (type.kind) {
    case "anyType":
    case "unknownType":
      return true;
    case "unionType":
    case "intersectionType":
      return type.types.length === 0 || type.types.some(isWeakSourceUseSiteType);
    case "arrayType":
      return isWeakSourceUseSiteType(type.elementType);
    case "tupleType":
      return type.elementTypes.some(isWeakSourceUseSiteType);
    case "dictionaryType":
      return (
        isWeakSourceUseSiteType(type.keyType) ||
        isWeakSourceUseSiteType(type.valueType)
      );
    case "functionType":
      return (
        type.parameters.some((parameter) =>
          isWeakSourceUseSiteType(parameter.type)
        ) || isWeakSourceUseSiteType(type.returnType)
      );
    case "objectType":
      return type.members.some(isWeakSourceInterfaceMember);
    case "referenceType":
      return (
        type.typeArguments?.some(isWeakSourceUseSiteType) === true ||
        type.structuralMembers?.some(isWeakSourceInterfaceMember) === true
      );
    default:
      return false;
  }
};

const isWeakSourceInterfaceMember = (member: IrInterfaceMember): boolean => {
  if (member.kind === "propertySignature") {
    return isWeakSourceUseSiteType(member.type);
  }

  return (
    member.parameters.some(
      (parameter) =>
        parameter.type !== undefined &&
        isWeakSourceUseSiteType(parameter.type)
    ) ||
    (member.returnType !== undefined &&
      isWeakSourceUseSiteType(member.returnType))
  );
};

const attachSyntheticTypeNodeParents = (
  node: TstsNode,
  parent: TstsNode
): void => {
  (node as { Parent?: TstsNode }).Parent = parent;
  forEachTstsChild(node, (child) => {
    if (child) {
      attachSyntheticTypeNodeParents(child, node);
    }
  });
};

const literalValueFromTypeString = (
  value: string,
  kind: "string" | "number" | "boolean"
): string | number | boolean | undefined => {
  if (kind === "boolean") {
    return value === "true" ? true : value === "false" ? false : undefined;
  }
  if (kind === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return undefined;
};

const primitiveTypeFromSourceTypeName = (
  name: string | undefined
): IrType | undefined => {
  if (!name) return undefined;
  if (name === "int" || name === "char") {
    return { kind: "primitiveType", name };
  }
  if (name === "bool" || name === "boolean") {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (
    name === "string" ||
    name === "number" ||
    name === "bigint" ||
    name === "char" ||
    name === "null" ||
    name === "undefined"
  ) {
    return { kind: "primitiveType", name };
  }
  return undefined;
};

const unknownIrType = (): IrType => ({ kind: "unknownType" });

const convertSourceSemanticTypeDirect = (
  semanticType: TstsType,
  ctx: ProgramContext,
  enclosingNode: TstsNode,
  seen: Set<TstsType>
): IrType | undefined => {
  if (seen.has(semanticType)) {
    return { kind: "unknownType" };
  }
  seen.add(semanticType);
  const convertNested = (type: TstsType): IrType | undefined =>
    convertSourceSemanticTypeDirect(type, ctx, enclosingNode, new Set(seen));

  const typeText = ctx.sourceSemantics.typeToString(semanticType);
  const aliasName = ctx.sourceSemantics.getTypeAliasSymbolName(semanticType);
  const symbolName = ctx.sourceSemantics.getTypeSymbolName(semanticType);
  const primitiveAlias = primitiveTypeFromSourceTypeName(aliasName);
  if (primitiveAlias) {
    return primitiveAlias;
  }

  if (ctx.sourceSemantics.isAnyType(semanticType)) {
    return { kind: "anyType" };
  }
  if (ctx.sourceSemantics.isUnknownType(semanticType)) {
    return { kind: "unknownType" };
  }
  if (ctx.sourceSemantics.isNeverType(semanticType)) {
    return { kind: "neverType" };
  }
  if (ctx.sourceSemantics.isVoidType(semanticType)) {
    return { kind: "voidType" };
  }
  if (ctx.sourceSemantics.isUndefinedType(semanticType)) {
    return { kind: "primitiveType", name: "undefined" };
  }
  if (ctx.sourceSemantics.isNullType(semanticType)) {
    return { kind: "primitiveType", name: "null" };
  }

  const unionMembers = ctx.sourceSemantics.getUnionMembers(semanticType);
  if (unionMembers && unionMembers.length > 0) {
    return {
      kind: "unionType",
      types: unionMembers
        .filter((member): member is TstsType => member !== undefined)
        .map((member) => convertNested(member) ?? unknownIrType()),
    };
  }

  const intersectionMembers =
    ctx.sourceSemantics.getIntersectionMembers(semanticType);
  if (intersectionMembers && intersectionMembers.length > 0) {
    return {
      kind: "intersectionType",
      types: intersectionMembers
        .filter((member): member is TstsType => member !== undefined)
        .map((member) => convertNested(member) ?? unknownIrType()),
    };
  }

  if (ctx.sourceSemantics.isStringLiteralType(semanticType)) {
    const value = literalValueFromTypeString(typeText, "string");
    return value === undefined
      ? { kind: "primitiveType", name: "string" }
      : { kind: "literalType", value };
  }
  if (ctx.sourceSemantics.isNumberLiteralType(semanticType)) {
    const value = literalValueFromTypeString(typeText, "number");
    return value === undefined
      ? { kind: "primitiveType", name: "number" }
      : { kind: "literalType", value };
  }
  if (ctx.sourceSemantics.isBooleanLiteralType(semanticType)) {
    const value = literalValueFromTypeString(typeText, "boolean");
    return value === undefined
      ? { kind: "primitiveType", name: "boolean" }
      : { kind: "literalType", value };
  }
  if (ctx.sourceSemantics.isBigIntLiteralType(semanticType)) {
    return { kind: "primitiveType", name: "bigint" };
  }

  if (ctx.sourceSemantics.isStringLikeType(semanticType)) {
    return { kind: "primitiveType", name: "string" };
  }
  if (ctx.sourceSemantics.isNumberLikeType(semanticType)) {
    return { kind: "primitiveType", name: "number" };
  }
  if (ctx.sourceSemantics.isBooleanLikeType(semanticType)) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (ctx.sourceSemantics.isBigIntLikeType(semanticType)) {
    return { kind: "primitiveType", name: "bigint" };
  }
  if (ctx.sourceSemantics.isTypeParameter(semanticType)) {
    return { kind: "typeParameterType", name: aliasName ?? symbolName ?? typeText };
  }

  if (ctx.sourceSemantics.isTupleType(semanticType)) {
    return {
      kind: "tupleType",
      elementTypes: ctx.sourceSemantics
        .getTypeArguments(semanticType)
        .filter((argument): argument is TstsType => argument !== undefined)
        .map((argument) => convertNested(argument) ?? unknownIrType()),
    };
  }
  if (ctx.sourceSemantics.isArrayType(semanticType)) {
    const elementSemanticType =
      ctx.sourceSemantics.getTypeArguments(semanticType)[0] ??
      ctx.sourceSemantics.getNumberIndexType(semanticType);
    return {
      kind: "arrayType",
      elementType: elementSemanticType
        ? (convertNested(elementSemanticType) ?? unknownIrType())
        : unknownIrType(),
      origin: "explicit",
    };
  }

  const referenceName = aliasName ?? symbolName;
  const isAnonymousSourceObjectType = symbolName === "�object";
  if (!referenceName || isAnonymousSourceObjectType) {
    const properties = ctx.sourceSemantics.getProperties(semanticType).filter(
      (propertySymbol) => propertySymbol !== undefined
    );
    if (properties.length > 0) {
      return {
        kind: "objectType",
        members: properties.map((propertySymbol) => {
          const propertyType = ctx.sourceSemantics.getTypeOfSymbolAtLocation(
            propertySymbol,
            enclosingNode
          );
          return {
            kind: "propertySignature" as const,
            name: propertySymbol.Name,
            type: propertyType
              ? (convertNested(propertyType) ?? unknownIrType())
              : unknownIrType(),
            isOptional: false,
            isReadonly: false,
          };
        }),
      };
    }
  }

  const callSignatures = ctx.sourceSemantics.getCallSignatures(semanticType);
  if (callSignatures.length > 0) {
    const callableTypes = callSignatures.map((signature): IrFunctionType => {
      const declaration = ctx.sourceSemantics.getSignatureDeclaration(signature);
      const parameterNodes = getTstsParameters(declaration);
      const parameterSymbols =
        ctx.sourceSemantics.getSignatureParameters(signature);
      const parameters: IrParameter[] = parameterSymbols.map(
        (parameterSymbol, index): IrParameter => {
          const parameterNode = parameterNodes[index];
          const parameterType = parameterNode
            ? ctx.sourceSemantics.getTypeOfSymbolAtLocation(
                parameterSymbol,
                parameterNode
              )
            : undefined;

          return {
            kind: "parameter",
            pattern: {
              kind: "identifierPattern",
              name:
                parameterNode !== undefined
                  ? (getTstsNodeNameText(parameterNode) ?? `arg${index}`)
                  : `arg${index}`,
            },
            type: parameterType
              ? (convertNested(parameterType) ?? unknownIrType())
              : unknownIrType(),
            initializer: undefined,
            isOptional:
              parameterNode !== undefined &&
              isTstsOptionalParameter(parameterNode),
            isRest:
              parameterNode !== undefined && isTstsRestParameter(parameterNode),
            passing: "value",
          };
        }
      );
      const returnType = ctx.sourceSemantics.getReturnTypeOfSignature(signature);

      return {
        kind: "functionType",
        parameters,
        returnType: returnType
          ? (convertNested(returnType) ?? unknownIrType())
          : unknownIrType(),
      };
    });

    const [onlyCallableType] = callableTypes;
    return callableTypes.length === 1 && onlyCallableType
      ? onlyCallableType
      : {
          kind: "intersectionType",
          types: callableTypes,
        };
  }

  if (referenceName) {
    const aliasArguments = ctx.sourceSemantics.getAliasTypeArguments(semanticType);
    const semanticArguments =
      aliasName && aliasArguments.length > 0
        ? aliasArguments
        : ctx.sourceSemantics.getReferenceTypeArguments(semanticType);
    const typeArguments = semanticArguments
      .filter((argument): argument is TstsType => argument !== undefined)
      .map((argument) => convertNested(argument) ?? unknownIrType());
    return {
      kind: "referenceType",
      name: referenceName,
      typeArguments: typeArguments.length > 0 ? typeArguments : undefined,
      structuralOrigin: "namedReference",
    };
  }

  return undefined;
};

export const chooseUseSiteType = (
  declaredType: IrType | undefined,
  useSiteType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  if (!useSiteType || isWeakSourceUseSiteType(useSiteType)) {
    return undefined;
  }

  if (!declaredType) {
    return useSiteType;
  }

  if (
    declaredType.kind === "unknownType" ||
    declaredType.kind === "anyType" ||
    declaredType.kind === "typeParameterType"
  ) {
    return useSiteType;
  }

  if (ctx.typeSystem.typesEqual(declaredType, useSiteType)) {
    return declaredType;
  }

  if (
    ctx.typeSystem.isAssignableTo(useSiteType, declaredType) &&
    !ctx.typeSystem.isAssignableTo(declaredType, useSiteType)
  ) {
    return useSiteType;
  }

  return undefined;
};

export const stripNullish = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind !== "unionType") return type;
  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullish.length === 0) return undefined;
  if (nonNullish.length === 1) return nonNullish[0];
  return { kind: "unionType", types: nonNullish };
};
