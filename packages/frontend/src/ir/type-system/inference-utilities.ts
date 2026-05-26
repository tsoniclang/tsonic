/**
 * Inference Utilities — Pure helper functions for type inference
 *
 * Contains shared utility functions used across inference sub-modules:
 * - collectResolutionArgTypes: spread-aware argument type collection
 * - deriveTypeFromNumericKind: NumericKind → IrType conversion
 * - makeOptionalReadType: add undefined to type for optional reads
 * - unwrapParens: strip parenthesized expression wrappers
 * - hasStaticModifier: check for static keyword on node
 * - isLambdaExpression: detect arrow/function expressions
 * - getNumericKindFromIrType: IrType → NumericKind lookup
 * - unwrapAwaitedForInference: unwrap async wrappers
 * - buildFunctionTypeFromSignatureShape: create IrFunctionType from shape
 * - buildCallableOverloadFamilyType: merge overloads into intersection
 * - buildStructuralMethodFamilyType: structural method → callable type
 *
 * DAG position: leaf module — no circular deps
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrInterfaceMember,
  IrTypeParameter,
  IrSpreadTupleShape,
} from "../types/index.js";
import * as ts from "typescript";
import { TSONIC_TO_NUMERIC_KIND } from "../types/numeric-kind.js";
import { getAwaitedIrType, getSpreadTupleShape } from "../types/index.js";
import type { NumericKind } from "../types/numeric-kind.js";
import { unknownType, voidType } from "./types.js";

export const collectResolutionArgTypes = (
  types: readonly (IrType | undefined)[]
): {
  readonly argumentCount: number;
  readonly argTypes: readonly (IrType | undefined)[];
} => {
  const argTypes: IrType[] = [];
  for (const type of types) {
    if (!type) continue;
    const spreadShape: IrSpreadTupleShape | undefined =
      getSpreadTupleShape(type);
    if (!spreadShape) {
      argTypes.push(type);
      continue;
    }
    for (const elementType of spreadShape.prefixElementTypes) {
      argTypes.push(elementType);
    }
  }
  return { argumentCount: argTypes.length, argTypes };
};

/**
 * Derive IrType from NumericKind (deterministic, no TypeScript).
 * Mirrors the logic in literals.ts deriveTypeFromNumericIntent.
 */
export const deriveTypeFromNumericKind = (kind: NumericKind): IrType => {
  if (kind === "int32") return { kind: "primitiveType", name: "int" };
  if (kind === "int64") return { kind: "referenceType", name: "long" };
  if (kind === "float64") return { kind: "primitiveType", name: "number" };
  if (kind === "float32") return { kind: "referenceType", name: "float" };
  if (kind === "uint8") return { kind: "referenceType", name: "byte" };
  if (kind === "int16") return { kind: "referenceType", name: "short" };
  if (kind === "uint32") return { kind: "referenceType", name: "uint" };
  if (kind === "uint64") return { kind: "referenceType", name: "ulong" };
  if (kind === "uint16") return { kind: "referenceType", name: "ushort" };
  if (kind === "int8") return { kind: "referenceType", name: "sbyte" };
  // Default to double for unknown
  return { kind: "primitiveType", name: "number" };
};

export const makeOptionalReadType = (type: IrType): IrType => {
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

export const unwrapParens = (expr: ts.Expression): ts.Expression => {
  let current: ts.Expression = expr;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

export const hasStaticModifier = (node: ts.Node): boolean => {
  const modifiers = (
    node as ts.Node & {
      readonly modifiers?: readonly ts.ModifierLike[];
    }
  ).modifiers;
  return !!modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword
  );
};

export const isLambdaExpression = (expr: ts.Expression): boolean => {
  const unwrapped = unwrapParens(expr);
  return ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped);
};

export const getNumericKindFromIrType = (
  type: IrType
): NumericKind | undefined => {
  if (type.kind === "primitiveType" && type.name === "number") return "float64";
  if (type.kind === "primitiveType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }
  if (type.kind === "referenceType") {
    return TSONIC_TO_NUMERIC_KIND.get(type.name);
  }
  return undefined;
};

export const unwrapAwaitedForInference = (type: IrType): IrType => {
  if (type.kind === "unionType") {
    return {
      kind: "unionType",
      types: type.types.map((t) => (t ? unwrapAwaitedForInference(t) : t)),
    };
  }

  if (
    type.kind === "referenceType" &&
    (type.name === "Promise" || type.name === "PromiseLike")
  ) {
    const inner = type.typeArguments?.[0];
    if (inner) return unwrapAwaitedForInference(inner);
  }

  const awaited = getAwaitedIrType(type);
  if (awaited) {
    return awaited.kind === "voidType"
      ? voidType
      : unwrapAwaitedForInference(awaited);
  }

  return type;
};

export const buildFunctionTypeFromSignatureShape = (
  parameters: readonly {
    readonly name: string;
    readonly type: IrType;
    readonly isOptional: boolean;
    readonly isRest: boolean;
    readonly mode?: IrParameter["passing"];
  }[],
  returnType: IrType,
  typeParameters?: readonly IrTypeParameter[]
): IrFunctionType => ({
  kind: "functionType",
  ...(typeParameters && typeParameters.length > 0 ? { typeParameters } : {}),
  parameters: parameters.map(
    (parameter): IrParameter => ({
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name: parameter.name,
      },
      type: parameter.type,
      initializer: undefined,
      isOptional: parameter.isOptional,
      isRest: parameter.isRest,
      passing: parameter.mode ?? "value",
    })
  ),
  returnType,
});

export const buildCallableOverloadFamilyType = (
  overloads: readonly IrFunctionType[]
): IrType => {
  if (overloads.length === 0) {
    return unknownType;
  }

  const [only] = overloads;
  if (overloads.length === 1 && only) {
    return only;
  }

  return {
    kind: "intersectionType",
    types: overloads,
  };
};

export const buildStructuralMethodFamilyType = (
  members: readonly Extract<IrInterfaceMember, { kind: "methodSignature" }>[]
): IrType | undefined => {
  if (members.length === 0) return undefined;

  return buildCallableOverloadFamilyType(
    members.map((member) =>
      buildFunctionTypeFromSignatureShape(
        member.parameters.map((parameter) => ({
          name:
            parameter.pattern.kind === "identifierPattern"
              ? parameter.pattern.name
              : "param",
          type: parameter.type ?? unknownType,
          isOptional: parameter.isOptional,
          isRest: parameter.isRest,
          mode: parameter.passing,
        })),
        member.returnType ?? voidType,
        member.typeParameters
      )
    )
  );
};
