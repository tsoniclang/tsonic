/**
 * Type environment helpers
 *
 * Extends ProgramContext.typeEnv with deterministic types discovered during conversion.
 *
 * IMPORTANT:
 * - This is NOT TypeScript type-checking.
 * - This is deterministic, IR-derived typing used to avoid "unknown" fallbacks
 *   for common local variables (e.g., `const ok = x !== undefined` → boolean).
 */

import * as ts from "typescript";
import type { ProgramContext } from "../program-context.js";
import type {
  IrExpression,
  IrType,
  IrVariableDeclaration,
  IrVariableDeclarator,
} from "../types.js";

/**
 * Derive the type from a converted IR expression using deterministic rules.
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 *
 * DETERMINISTIC TYPING RULES:
 * - Literals → use inferredType (already set deterministically in literals.ts)
 * - Arrays → use inferredType, or derive from first element
 * - All other expressions → use inferredType if present
 */
export const deriveTypeFromExpression = (expr: IrExpression): IrType | undefined => {
  if (expr.kind === "literal") {
    return expr.inferredType;
  }

  if (expr.kind === "array") {
    if (expr.inferredType) return expr.inferredType;
    const first = expr.elements[0];
    if (!first) return undefined;
    const elementType = deriveTypeFromExpression(first);
    return elementType ? { kind: "arrayType", elementType } : undefined;
  }

  if ("inferredType" in expr && expr.inferredType) {
    return expr.inferredType;
  }

  return undefined;
};

const normalizeEnvType = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "unknownType" || type.kind === "anyType") return undefined;
  return type;
};

const getTupleElementType = (
  type: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "tupleType") {
    return type.elementTypes[index];
  }
  return undefined;
};

const getArrayElementType = (
  type: IrType | undefined,
  index: number
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "arrayType") return type.elementType;
  const tuple = getTupleElementType(type, index);
  if (tuple) return tuple;
  return undefined;
};

const getObjectPropertyType = (
  ctx: ProgramContext,
  type: IrType | undefined,
  propName: string
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "objectType") {
    const member = type.members.find(
      (m) => m.kind === "propertySignature" && m.name === propName
    );
    if (member && member.kind === "propertySignature") {
      return member.type;
    }
    return undefined;
  }

  if (type.kind === "referenceType") {
    const memberType = ctx.typeSystem.typeOfMember(type, {
      kind: "byName",
      name: propName,
    });
    return memberType.kind === "unknownType" ? undefined : memberType;
  }

  return undefined;
};

const getPropertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return undefined;
};

const extendEnvForBindingName = (
  ctx: ProgramContext,
  name: ts.BindingName,
  sourceType: IrType | undefined,
  ensureEnv: () => Map<number, IrType>
): void => {
  const normalizedSource = normalizeEnvType(sourceType);
  if (!normalizedSource) return;

  if (ts.isIdentifier(name)) {
    const declId = ctx.binding.resolveIdentifier(name);
    if (declId) {
      ensureEnv().set(declId.id, normalizedSource);
    }
    return;
  }

  if (ts.isArrayBindingPattern(name)) {
    // Each element gets the array element type (or tuple element type if known).
    for (let i = 0; i < name.elements.length; i++) {
      const element = name.elements[i];
      if (!element) continue;
      if (ts.isOmittedExpression(element)) continue;

      const isRest = !!element.dotDotDotToken;
      const elementType = getArrayElementType(normalizedSource, i);
      const boundType =
        isRest && elementType
          ? ({ kind: "arrayType", elementType } as const)
          : elementType;

      extendEnvForBindingName(ctx, element.name, boundType, ensureEnv);
    }
    return;
  }

  if (ts.isObjectBindingPattern(name)) {
    for (const element of name.elements) {
      if (element.dotDotDotToken) {
        // Rest object: its truthiness is object-like (always truthy if non-null),
        // so the exact structural type is not required for boolean-context correctness.
        continue;
      }

      const key =
        element.propertyName !== undefined
          ? getPropertyNameText(element.propertyName)
          : ts.isIdentifier(element.name)
            ? element.name.text
            : undefined;

      if (!key) continue;

      const propType = getObjectPropertyType(ctx, normalizedSource, key);
      extendEnvForBindingName(ctx, element.name, propType, ensureEnv);
    }
  }
};

const deriveDeclaratorType = (decl: IrVariableDeclarator): IrType | undefined => {
  const explicitType = normalizeEnvType(decl.type);
  if (explicitType) return explicitType;
  const initType = decl.initializer
    ? normalizeEnvType(deriveTypeFromExpression(decl.initializer))
    : undefined;
  return initType;
};

export const withVariableDeclaratorTypeEnv = (
  ctx: ProgramContext,
  name: ts.BindingName,
  decl: IrVariableDeclarator
): ProgramContext => {
  const type = deriveDeclaratorType(decl);
  if (!type) return ctx;

  let nextEnv: Map<number, IrType> | undefined;
  const ensureEnv = (): Map<number, IrType> => {
    if (!nextEnv) nextEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
    return nextEnv;
  };

  extendEnvForBindingName(ctx, name, type, ensureEnv);
  return nextEnv ? { ...ctx, typeEnv: nextEnv } : ctx;
};

/**
 * Extend ctx.typeEnv with deterministic types for declared variables.
 *
 * Used to type later references to locals without resorting to "unknown" fallbacks.
 * This is required for correct emission of operators like `!x` (boolean vs truthiness).
 */
export const withVariableTypeEnv = (
  ctx: ProgramContext,
  tsDecls: readonly ts.VariableDeclaration[],
  ir: IrVariableDeclaration
): ProgramContext => {
  let nextEnv: Map<number, IrType> | undefined;

  const ensureEnv = (): Map<number, IrType> => {
    if (!nextEnv) nextEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
    return nextEnv;
  };

  for (let i = 0; i < tsDecls.length; i++) {
    const tsDecl = tsDecls[i];
    const irDecl = ir.declarations[i];
    if (!tsDecl || !irDecl) continue;

    const inferredType = deriveDeclaratorType(irDecl);
    if (!inferredType) continue;

    extendEnvForBindingName(ctx, tsDecl.name, inferredType, ensureEnv);
  }

  return nextEnv ? { ...ctx, typeEnv: nextEnv } : ctx;
};
