import { TstsSyntax, type TstsNode } from "@tsonic/tsts";
import { tryResolveDeterministicPropertyName } from "../../../../syntax/property-names.js";

export const getClassMemberName = (
  name: TstsNode | undefined
): string => tryResolveDeterministicPropertyName(name) ?? "[computed]";

export const isPrivateClassMemberName = (
  name: TstsNode | undefined
): boolean => name?.Kind === TstsSyntax.KindPrivateIdentifier;

export const hasNonComputedClassMemberName = (
  name: TstsNode | undefined
): boolean => tryResolveDeterministicPropertyName(name) !== undefined;
