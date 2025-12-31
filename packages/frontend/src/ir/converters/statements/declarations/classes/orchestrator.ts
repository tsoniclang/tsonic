/**
 * Class declaration conversion orchestrator
 */

import * as ts from "typescript";
import { IrClassDeclaration, IrClassMember } from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { convertType } from "../../../../type-converter.js";
import { hasExportModifier, convertTypeParameters } from "../../helpers.js";
import { convertProperty } from "./properties.js";
import { convertMethod } from "./methods.js";
import {
  convertConstructor,
  extractParameterProperties,
} from "./constructors.js";

/**
 * Convert a single class member
 */
const convertClassMember = (
  node: ts.ClassElement,
  checker: ts.TypeChecker,
  superClass: ts.ExpressionWithTypeArguments | undefined,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember | null => {
  if (ts.isPropertyDeclaration(node)) {
    return convertProperty(node, checker, superClass);
  }

  if (ts.isMethodDeclaration(node)) {
    return convertMethod(node, checker, superClass);
  }

  if (ts.isConstructorDeclaration(node)) {
    return convertConstructor(node, checker, constructorParams);
  }

  return null;
};

/**
 * Filter members to only include those declared directly on this class
 */
const filterOwnMembers = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): readonly ts.ClassElement[] => {
  return node.members.filter((m) => {
    // Always include constructors and methods declared on this class
    if (ts.isConstructorDeclaration(m) || ts.isMethodDeclaration(m)) {
      return true;
    }
    // For properties, only include if they're declared directly on this class
    if (ts.isPropertyDeclaration(m)) {
      // Check if this property has a declaration on this specific class node
      const symbol = checker.getSymbolAtLocation(m.name);
      if (!symbol) return true; // Include if we can't determine
      const declarations = symbol.getDeclarations() || [];
      // Only include if this exact node is in the declarations
      return declarations.some((d) => d === m);
    }
    return true;
  });
};

/**
 * Deduplicate members by name, keeping first occurrence
 */
const deduplicateMembers = (
  members: readonly IrClassMember[]
): readonly IrClassMember[] => {
  const seenNames = new Set<string>();
  return members.filter((member) => {
    if (member.kind === "constructorDeclaration") {
      return true; // Always include constructor
    }
    const name =
      member.kind === "propertyDeclaration" ||
      member.kind === "methodDeclaration"
        ? member.name
        : null;
    if (!name) return true;
    if (seenNames.has(name)) {
      return false; // Skip duplicate
    }
    seenNames.add(name);
    return true;
  });
};

/**
 * Check if a type reference is the struct marker
 */
const isStructMarker = (
  typeRef: ts.ExpressionWithTypeArguments,
  checker: ts.TypeChecker
): boolean => {
  const symbol = checker.getSymbolAtLocation(typeRef.expression);
  return symbol?.escapedName === "struct" || symbol?.escapedName === "Struct";
};

/**
 * Convert class declaration to IR
 */
export const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): IrClassDeclaration | null => {
  if (!node.name) return null;

  const superClass = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  )?.types[0];

  // Detect struct marker in implements clause
  let isStruct = false;
  const implementsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ImplementsKeyword
  );
  const implementsTypes =
    implementsClause?.types
      .filter((t) => {
        if (isStructMarker(t, checker)) {
          isStruct = true;
          return false; // Remove marker from implements
        }
        return true;
      })
      .map((t) => convertType(t, checker)) ?? [];

  // Extract parameter properties from constructor
  const constructor = node.members.find(ts.isConstructorDeclaration);
  const parameterProperties = extractParameterProperties(constructor, checker);

  // Filter to only include members declared directly on this class (not inherited)
  const ownMembers = filterOwnMembers(node, checker);

  const convertedMembers = ownMembers
    .map((m) =>
      convertClassMember(m, checker, superClass, constructor?.parameters)
    )
    .filter((m): m is IrClassMember => m !== null);

  // Deduplicate members by name (keep first occurrence)
  // Parameter properties should take precedence over regular properties with same name
  const allMembers = [...parameterProperties, ...convertedMembers];
  const deduplicatedMembers = deduplicateMembers(allMembers);

  // Filter out __brand property if this is a struct
  const finalMembers = isStruct
    ? deduplicatedMembers.filter(
        (m) => m.kind !== "propertyDeclaration" || m.name !== "__brand"
      )
    : deduplicatedMembers;

  return {
    kind: "classDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    superClass: superClass ? convertExpression(superClass, checker, undefined) : undefined,
    implements: implementsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
