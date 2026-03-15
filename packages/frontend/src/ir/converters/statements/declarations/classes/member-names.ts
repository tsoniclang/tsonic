import * as ts from "typescript";
import { tryResolveDeterministicPropertyName } from "../../../../syntax/property-names.js";

export const getClassMemberName = (
  name: ts.PropertyName | ts.PrivateIdentifier | undefined
): string => tryResolveDeterministicPropertyName(name) ?? "[computed]";

export const isPrivateClassMemberName = (
  name: ts.PropertyName | ts.PrivateIdentifier | undefined
): boolean => !!name && ts.isPrivateIdentifier(name);

export const hasNonComputedClassMemberName = (
  name: ts.PropertyName | ts.PrivateIdentifier | undefined
): boolean =>
  tryResolveDeterministicPropertyName(name) !== undefined;
