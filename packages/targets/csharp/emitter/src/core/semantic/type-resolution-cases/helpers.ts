import { describe, it } from "mocha";
import { expect } from "chai";
import {
  containsTypeParameter,
  substituteTypeArgs,
  getPropertyType,
  getArrayLikeElementType,
  selectObjectLiteralUnionMember,
  selectUnionMemberForObjectLiteral,
  normalizeStructuralEmissionType,
  resolveStructuralReferenceType,
  resolveTypeAlias,
  stripNullish,
  isDefinitelyValueType,
  isTypeOnlyStructuralTarget,
  findUnionMemberIndex,
  narrowTypeByTypeofTag,
} from "../type-resolution.js";
import {
  type IrInterfaceMember,
  type IrType,
  type TypeBinding as FrontendTypeBinding,
} from "@tsonic/frontend";
import type {
  EmitterContext,
  LocalTypeInfo,
  EmitterOptions,
} from "../../../types.js";

export {
  describe,
  it,
  expect,
  containsTypeParameter,
  substituteTypeArgs,
  getPropertyType,
  getArrayLikeElementType,
  selectObjectLiteralUnionMember,
  selectUnionMemberForObjectLiteral,
  normalizeStructuralEmissionType,
  resolveStructuralReferenceType,
  resolveTypeAlias,
  stripNullish,
  isDefinitelyValueType,
  isTypeOnlyStructuralTarget,
  findUnionMemberIndex,
  narrowTypeByTypeofTag,
};
export type {
  EmitterContext,
  EmitterOptions,
  FrontendTypeBinding,
  IrInterfaceMember,
  IrType,
  LocalTypeInfo,
};
