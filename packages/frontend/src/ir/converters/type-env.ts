/**
 * Type environment helpers
 *
 * Extends ProgramContext.typeEnv with deterministic types discovered during conversion.
 *
 * IMPORTANT:
 * - This is NOT TypeScript type-checking.
 * - This is deterministic, IR-derived typing used to avoid avoidable unknowns
 *   for common local variables (e.g., `const ok = x !== undefined` → boolean).
 */

import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { getTstsIdentifierText } from "@tsonic/tsts";
import type { ProgramContext } from "../program-context.js";
import type {
  IrExpression,
  IrParameter,
  IrType,
  IrVariableDeclaration,
  IrVariableDeclarator,
} from "../types.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";

/**
 * Derive the type from a converted IR expression using deterministic rules.
 * NO TYPESCRIPT FALLBACK - types must be derivable from IR or undefined.
 *
 * DETERMINISTIC TYPING RULES:
 * - Literals → use inferredType (already set deterministically in literals.ts)
 * - Arrays → use inferredType, or derive from first element
 * - All other expressions → use inferredType if present
 */
export const deriveTypeFromExpression = (
  expr: IrExpression
): IrType | undefined => {
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

const isNumericLiteralInitializer = (initializer: IrExpression): boolean => {
  if (initializer.kind === "literal") {
    return typeof initializer.value === "number";
  }

  if (
    initializer.kind === "unary" &&
    (initializer.operator === "-" || initializer.operator === "+") &&
    initializer.expression.kind === "literal"
  ) {
    return typeof initializer.expression.value === "number";
  }

  return false;
};

export const resolveMutableNumericLiteralDeclarationType = (
  declarationKind: "const" | "let" | "var",
  explicitType: IrType | undefined,
  initializer: IrExpression | undefined,
  shouldWiden: boolean
): IrType | undefined => {
  if (
    declarationKind === "const" ||
    explicitType ||
    !initializer ||
    !shouldWiden
  ) {
    return undefined;
  }

  if (!isNumericLiteralInitializer(initializer)) {
    return undefined;
  }

  return { kind: "primitiveType", name: "number" };
};

const normalizeEnvType = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "unknownType" && type.explicit !== true) return undefined;
  if (type.kind === "anyType") return undefined;
  return type;
};

const makeOptionalReadType = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    const hasUndefined = type.types.some(
      (member) => member.kind === "primitiveType" && member.name === "undefined"
    );
    if (hasUndefined) return type;
    return {
      kind: "unionType",
      types: [...type.types, { kind: "primitiveType", name: "undefined" }],
    };
  }

  if (type.kind === "primitiveType" && type.name === "undefined") {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const getParameterReadType = (parameter: IrParameter): IrType | undefined => {
  if (!parameter.type) return undefined;
  return parameter.isOptional
    ? makeOptionalReadType(parameter.type)
    : parameter.type;
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

const getPropertyNameText = (name: TstsNode): string | undefined =>
  tryResolveDeterministicPropertyName(name);

const extendEnvForBindingName = (
  ctx: ProgramContext,
  name: TstsNode,
  sourceType: IrType | undefined,
  ensureEnv: () => Map<number, IrType>
): void => {
  const normalizedSource = normalizeEnvType(sourceType);
  if (!normalizedSource) return;

  if (TstsSyntax.IsIdentifier(name)) {
    const declId = ctx.binding.resolveIdentifier(name);
    if (declId) {
      ensureEnv().set(declId.id, normalizedSource);
    }
    return;
  }

  if (TstsSyntax.IsArrayBindingPattern(name)) {
    // Each element gets the array element type (or tuple element type if known).
    const elements = TstsSyntax.Node_Elements(name) ?? [];
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (!element) continue;
      if (TstsSyntax.IsOmittedExpression(element)) continue;

      const bindingElement = TstsSyntax.AsBindingElement(element);
      const elementName = bindingElement?.name ?? element;
      const isRest = bindingElement?.DotDotDotToken !== undefined;
      const elementType = getArrayElementType(normalizedSource, i);
      const boundType =
        isRest && elementType
          ? ({ kind: "arrayType", elementType } as const)
          : elementType;

      extendEnvForBindingName(ctx, elementName, boundType, ensureEnv);
    }
    return;
  }

  if (TstsSyntax.IsObjectBindingPattern(name)) {
    for (const element of TstsSyntax.Node_Elements(name) ?? []) {
      if (!element) continue;
      const bindingElement = TstsSyntax.AsBindingElement(element);
      if (!bindingElement) continue;
      if (bindingElement.DotDotDotToken) {
        // Rest object: its truthiness is object-like (always truthy if non-null),
        // so the exact structural type is not required for boolean-context correctness.
        continue;
      }

      const key =
        bindingElement.PropertyName !== undefined
          ? getPropertyNameText(bindingElement.PropertyName)
          : TstsSyntax.IsIdentifier(bindingElement.name)
            ? getTstsIdentifierText(bindingElement.name)
            : undefined;

      if (!key) continue;

      const propType = getObjectPropertyType(ctx, normalizedSource, key);
      if (bindingElement.name) {
        extendEnvForBindingName(ctx, bindingElement.name, propType, ensureEnv);
      }
    }
  }
};

export const withBindingNameTypeEnv = (
  ctx: ProgramContext,
  name: TstsNode,
  type: IrType | undefined
): ProgramContext => {
  const normalizedType = normalizeEnvType(type);
  if (!normalizedType) return ctx;

  let nextEnv: Map<number, IrType> | undefined;
  const ensureEnv = (): Map<number, IrType> => {
    if (!nextEnv) nextEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
    return nextEnv;
  };

  extendEnvForBindingName(ctx, name, normalizedType, ensureEnv);
  return nextEnv ? { ...ctx, typeEnv: nextEnv } : ctx;
};

export const withParameterTypeEnv = (
  ctx: ProgramContext,
  tsParameters: readonly TstsNode[],
  parameters: readonly IrParameter[]
): ProgramContext => {
  let nextCtx = ctx;
  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    const tsParameter = tsParameters[i];
    if (!parameter || !tsParameter) continue;
    const name = TstsSyntax.Node_Name(tsParameter);
    if (!name) continue;
    nextCtx = withBindingNameTypeEnv(
      nextCtx,
      name,
      getParameterReadType(parameter)
    );
  }
  return nextCtx;
};

const deriveDeclaratorType = (
  decl: IrVariableDeclarator
): IrType | undefined => {
  const explicitType = normalizeEnvType(decl.type);
  if (explicitType) return explicitType;
  const initType = decl.initializer
    ? normalizeEnvType(deriveTypeFromExpression(decl.initializer))
    : undefined;
  return initType;
};

export const withVariableDeclaratorTypeEnv = (
  ctx: ProgramContext,
  name: TstsNode,
  decl: IrVariableDeclarator
): ProgramContext => {
  const type = deriveDeclaratorType(decl);
  return withBindingNameTypeEnv(ctx, name, type);
};

/**
 * Extend ctx.typeEnv with deterministic types for declared variables.
 *
 * Used to type later references to locals without degrading them to unknown.
 * This is required for correct emission of operators like `!x` (boolean vs truthiness).
 */
export const withVariableTypeEnv = (
  ctx: ProgramContext,
  tsDecls: readonly TstsNode[],
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

    const name = TstsSyntax.Node_Name(tsDecl);
    if (name) {
      extendEnvForBindingName(ctx, name, inferredType, ensureEnv);
    }
  }

  return nextEnv ? { ...ctx, typeEnv: nextEnv } : ctx;
};
