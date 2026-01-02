/**
 * Class declaration conversion orchestrator
 */

import * as ts from "typescript";
import { IrClassDeclaration, IrClassMember } from "../../../../types.js";
import { convertExpression } from "../../../../expression-converter.js";
import { hasExportModifier, convertTypeParameters } from "../../helpers.js";
import { convertProperty } from "./properties.js";
import { convertMethod } from "./methods.js";
import {
  convertConstructor,
  extractParameterProperties,
} from "./constructors.js";
import { getTypeSystem } from "../registry.js";
import type { Binding } from "../../../../binding/index.js";

/**
 * Convert a single class member
 */
const convertClassMember = (
  node: ts.ClassElement,
  binding: Binding,
  superClass: ts.ExpressionWithTypeArguments | undefined,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember | null => {
  if (ts.isPropertyDeclaration(node)) {
    return convertProperty(node, binding, superClass);
  }

  if (ts.isMethodDeclaration(node)) {
    return convertMethod(node, binding, superClass);
  }

  if (ts.isConstructorDeclaration(node)) {
    return convertConstructor(node, binding, constructorParams);
  }

  return null;
};

/**
 * Filter members to only include those declared directly on this class.
 * DETERMINISTIC: Uses AST structure only, all members in node.members are own members.
 */
const filterOwnMembers = (
  node: ts.ClassDeclaration
): readonly ts.ClassElement[] => {
  // All members directly on node.members ARE own members by definition
  // The AST doesn't include inherited members in the class's members array
  return node.members;
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
 * Check if a type reference is the struct marker.
 * DETERMINISTIC: Uses only the AST expression text, not TypeScript type resolution.
 */
const isStructMarker = (typeRef: ts.ExpressionWithTypeArguments): boolean => {
  // Check the expression directly - it should be an identifier named "struct" or "Struct"
  if (ts.isIdentifier(typeRef.expression)) {
    const name = typeRef.expression.text;
    return name === "struct" || name === "Struct";
  }
  return false;
};

/**
 * Convert class declaration to IR
 */
export const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  binding: Binding
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
  // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
  const typeSystem = getTypeSystem();
  const implementsTypes =
    implementsClause?.types
      .filter((t) => {
        if (isStructMarker(t)) {
          isStruct = true;
          return false; // Remove marker from implements
        }
        return true;
      })
      .map((t) =>
        typeSystem
          ? typeSystem.typeFromSyntax(binding.captureTypeSyntax(t))
          : undefined
      )
      .filter((t): t is NonNullable<typeof t> => t !== undefined) ?? [];

  // Extract parameter properties from constructor
  const constructor = node.members.find(ts.isConstructorDeclaration);
  const parameterProperties = extractParameterProperties(constructor, binding);

  // Filter to only include members declared directly on this class (not inherited)
  const ownMembers = filterOwnMembers(node);

  const convertedMembers = ownMembers
    .map((m) =>
      convertClassMember(m, binding, superClass, constructor?.parameters)
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
    typeParameters: convertTypeParameters(node.typeParameters, binding),
    superClass: superClass
      ? convertExpression(superClass, binding, undefined)
      : undefined,
    implements: implementsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
