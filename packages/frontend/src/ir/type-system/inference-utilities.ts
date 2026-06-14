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
import type { TstsNode } from "@tsonic/tsts";
import { hasTstsStaticModifier, TstsSyntax } from "@tsonic/tsts";
import {
  numericTypeFactFromName,
  TSONIC_TO_NUMERIC_KIND,
} from "../types/numeric-kind.js";
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

export const getExplicitTypeArgumentNodes = (
  node: TstsNode
): readonly TstsNode[] =>
  (TstsSyntax.Node_TypeArguments(node) ?? []).filter(
    (typeArgument): typeArgument is TstsNode => typeArgument !== undefined
  );

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

export const unwrapParens = (expr: TstsNode): TstsNode => {
  let current: TstsNode = expr;
  while (TstsSyntax.IsParenthesizedExpression(current)) {
    const inner = TstsSyntax.Node_Expression(current);
    if (!inner) break;
    current = inner;
  }
  return current;
};

export const hasStaticModifier = (node: TstsNode): boolean =>
  hasTstsStaticModifier(node);

export const isLambdaExpression = (expr: TstsNode): boolean => {
  const unwrapped = unwrapParens(expr);
  return (
    TstsSyntax.IsArrowFunction(unwrapped) ||
    TstsSyntax.IsFunctionExpression(unwrapped)
  );
};

export const getNumericKindFromIrType = (
  type: IrType
): NumericKind | undefined => {
  if (type.kind === "primitiveType" && type.name === "number") return "float64";
  if (type.kind === "primitiveType") {
    return getNumericKindFromTypeName(type.name);
  }
  if (type.kind === "referenceType") {
    return (
      getNumericKindFromTypeName(type.name) ??
      (type.providerQualifiedName
        ? getNumericKindFromTypeName(type.providerQualifiedName)
        : undefined) ??
      (type.typeId?.sourceName
        ? getNumericKindFromTypeName(type.typeId.sourceName)
        : undefined) ??
      (type.typeId?.providerName
        ? getNumericKindFromTypeName(type.typeId.providerName)
        : undefined)
    );
  }
  return undefined;
};

const getNumericKindFromTypeName = (name: string): NumericKind | undefined => {
  const direct = TSONIC_TO_NUMERIC_KIND.get(name);
  if (direct) {
    return direct;
  }

  const fact = numericTypeFactFromName(name);
  switch (fact?.numericKind) {
    case "int8":
    case "uint8":
    case "int16":
    case "uint16":
    case "int32":
    case "uint32":
    case "int64":
    case "uint64":
    case "float32":
    case "float64":
      return fact.numericKind;
    default:
      return undefined;
  }
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
