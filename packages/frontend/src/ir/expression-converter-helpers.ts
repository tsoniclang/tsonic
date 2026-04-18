/**
 * Expression converter helpers — numeric kind extraction, this-type inference,
 * parenthesis unwrapping, unknown-type checking, identifier storage type resolution,
 * and nullish stripping.
 */

import * as ts from "typescript";
import type { BindingInternal } from "./binding/binding-types.js";
import type { IrType, NumericKind } from "./types.js";
import { TSONIC_TO_NUMERIC_KIND } from "./types.js";
import type { ProgramContext } from "./program-context.js";

/**
 * Extract the NumericKind from a type node if it references a known numeric alias.
 *
 * Examples:
 * - `int` → "Int32"
 * - `byte` → "Byte"
 * - `long` → "Int64"
 * - `string` → undefined (not numeric)
 */
export const getNumericKindFromTypeNode = (
  typeNode: ts.TypeNode
): NumericKind | undefined => {
  // Handle type reference nodes (e.g., `int`, `byte`, `Int32`)
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      const name = typeName.text;
      // Look up the type alias name in our mapping
      const kind = TSONIC_TO_NUMERIC_KIND.get(name);
      if (kind !== undefined) {
        return kind;
      }
    }
  }

  return undefined;
};

export const inferThisType = (node: ts.Node): IrType | undefined => {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const className = current.name?.text;
      if (!className) return undefined;

      const typeArguments =
        current.typeParameters?.map(
          (tp): IrType => ({ kind: "typeParameterType", name: tp.name.text })
        ) ?? [];

      return {
        kind: "referenceType",
        name: className,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    current = current.parent;
  }

  return undefined;
};

const entityNameToText = (entityName: ts.EntityName): string =>
  ts.isIdentifier(entityName)
    ? entityName.text
    : `${entityNameToText(entityName.left)}.${entityName.right.text}`;

const getEnclosingGeneratorNextTypeNode = (
  node: ts.Node
): ts.TypeNode | undefined => {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isMethodDeclaration(current)
    ) {
      if (!current.asteriskToken) {
        current = current.parent;
        continue;
      }

      const returnType = current.type;
      if (!returnType || !ts.isTypeReferenceNode(returnType)) {
        return undefined;
      }

      const generatorName = entityNameToText(returnType.typeName);
      const lastSegment = generatorName.split(".").pop() ?? generatorName;
      if (lastSegment !== "Generator" && lastSegment !== "AsyncGenerator") {
        return undefined;
      }

      return returnType.typeArguments?.[2];
    }

    current = current.parent;
  }

  return undefined;
};

export const inferYieldReceivedType = (
  node: ts.YieldExpression,
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

export const unwrapParens = (node: ts.Expression): ts.Expression => {
  let current = node;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

export const isExplicitUnknownTypeNode = (
  node: ts.TypeNode | undefined
): boolean => !!node && node.kind === ts.SyntaxKind.UnknownKeyword;

export const hasExplicitUnknownStorageInitializer = (
  node: ts.Expression | undefined
): boolean => {
  if (!node) return false;

  const current = unwrapParens(node);
  if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
    return isExplicitUnknownTypeNode(current.type);
  }

  if (ts.isSatisfiesExpression(current)) {
    return isExplicitUnknownTypeNode(current.type);
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

  const declInfo = (ctx.binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  if (!declInfo?.typeNode) {
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

  const declInfo = (ctx.binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  if (!declInfo) return fromEnv ?? fromDecl;
  if (declInfo.typeNode) return fromDecl;

  const declNode = declInfo.declNode as ts.Node | undefined;
  if (declNode) {
    if (
      ts.isVariableDeclaration(declNode) ||
      ts.isParameter(declNode) ||
      ts.isBindingElement(declNode)
    ) {
      if (hasExplicitUnknownStorageInitializer(declNode.initializer)) {
        return fromDecl;
      }
    }
  }

  return fromEnv ?? fromDecl;
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
