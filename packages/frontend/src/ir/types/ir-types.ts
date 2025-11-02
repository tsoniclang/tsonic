/**
 * Type system types for IR (IrType and its variants)
 */

import { IrParameter, IrInterfaceMember } from "./helpers.js";

export type IrType =
  | IrPrimitiveType
  | IrReferenceType
  | IrArrayType
  | IrFunctionType
  | IrObjectType
  | IrUnionType
  | IrIntersectionType
  | IrLiteralType
  | IrAnyType
  | IrUnknownType
  | IrVoidType
  | IrNeverType;

export type IrPrimitiveType = {
  readonly kind: "primitiveType";
  readonly name: "string" | "number" | "boolean" | "null" | "undefined";
};

export type IrReferenceType = {
  readonly kind: "referenceType";
  readonly name: string;
  readonly typeArguments?: readonly IrType[];
};

export type IrArrayType = {
  readonly kind: "arrayType";
  readonly elementType: IrType;
};

export type IrFunctionType = {
  readonly kind: "functionType";
  readonly parameters: readonly IrParameter[];
  readonly returnType: IrType;
};

export type IrObjectType = {
  readonly kind: "objectType";
  readonly members: readonly IrInterfaceMember[];
};

export type IrUnionType = {
  readonly kind: "unionType";
  readonly types: readonly IrType[];
};

export type IrIntersectionType = {
  readonly kind: "intersectionType";
  readonly types: readonly IrType[];
};

export type IrLiteralType = {
  readonly kind: "literalType";
  readonly value: string | number | boolean;
};

export type IrAnyType = {
  readonly kind: "anyType";
};

export type IrUnknownType = {
  readonly kind: "unknownType";
};

export type IrVoidType = {
  readonly kind: "voidType";
};

export type IrNeverType = {
  readonly kind: "neverType";
};
