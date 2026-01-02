/**
 * Helper utilities for statement conversion
 */

import * as ts from "typescript";
import {
  IrParameter,
  IrAccessibility,
  IrTypeParameter,
  IrInterfaceMember,
  IrVariableDeclaration,
} from "../../types.js";
import { convertBindingName } from "../../type-system/internal/type-converter.js";
import { getTypeSystem } from "./declarations/registry.js";
import { convertExpression } from "../../expression-converter.js";
import { convertInterfaceMember } from "./declarations.js";
import type { Binding } from "../../binding/index.js";

/**
 * Convert TypeScript type parameters to IR, detecting structural constraints
 */
export const convertTypeParameters = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined,
  binding: Binding
): readonly IrTypeParameter[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  // ALICE'S SPEC: Use TypeSystem.convertTypeNode() for all type conversion
  const typeSystem = getTypeSystem();

  return typeParameters.map((tp) => {
    const name = tp.name.text;
    const constraint =
      tp.constraint && typeSystem
        ? typeSystem.convertTypeNode(tp.constraint)
        : undefined;
    const defaultType =
      tp.default && typeSystem
        ? typeSystem.convertTypeNode(tp.default)
        : undefined;

    // Check if constraint is structural (object literal type)
    const isStructural = tp.constraint && ts.isTypeLiteralNode(tp.constraint);

    // Extract structural members if it's a structural constraint
    const structuralMembers =
      isStructural && tp.constraint && ts.isTypeLiteralNode(tp.constraint)
        ? tp.constraint.members
            .map((member) => convertInterfaceMember(member, binding))
            .filter((m): m is IrInterfaceMember => m !== null)
        : undefined;

    return {
      kind: "typeParameter" as const,
      name,
      constraint,
      default: defaultType,
      variance: undefined, // TypeScript doesn't expose variance directly
      isStructuralConstraint: isStructural,
      structuralMembers,
    };
  });
};

/**
 * Convert parameters for functions and methods
 */
export const convertParameters = (
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
  binding: Binding
): readonly IrParameter[] => {
  return parameters.map((param) => {
    let passing: "value" | "ref" | "out" | "in" = "value";
    let actualType: ts.TypeNode | undefined = param.type;

    // Detect ref<T>, out<T>, in<T>, inref<T> wrapper types
    if (
      param.type &&
      ts.isTypeReferenceNode(param.type) &&
      ts.isIdentifier(param.type.typeName)
    ) {
      const typeName = param.type.typeName.text;
      if (
        (typeName === "ref" ||
          typeName === "out" ||
          typeName === "in" ||
          typeName === "inref") &&
        param.type.typeArguments &&
        param.type.typeArguments.length > 0
      ) {
        // Set passing mode (both "in" and "inref" map to C# "in")
        passing =
          typeName === "in" || typeName === "inref"
            ? "in"
            : (typeName as "ref" | "out");
        // Extract wrapped type
        actualType = param.type.typeArguments[0];
      }
    }

    // Get parameter type for contextual typing of default value
    // ALICE'S SPEC: Use TypeSystem.convertTypeNode() for all type conversion
    const typeSystem = getTypeSystem();
    const paramType =
      actualType && typeSystem
        ? typeSystem.convertTypeNode(actualType)
        : undefined;

    return {
      kind: "parameter",
      pattern: convertBindingName(param.name),
      type: paramType,
      // Pass parameter type for contextual typing of default value
      initializer: param.initializer
        ? convertExpression(param.initializer, binding, paramType)
        : undefined,
      isOptional: !!param.questionToken,
      isRest: !!param.dotDotDotToken,
      passing,
    };
  });
};

/**
 * Convert variable declaration list (used in for loops)
 */
export const convertVariableDeclarationList = (
  node: ts.VariableDeclarationList,
  binding: Binding
): IrVariableDeclaration => {
  const isConst = !!(node.flags & ts.NodeFlags.Const);
  const isLet = !!(node.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  // ALICE'S SPEC: Use TypeSystem.convertTypeNode() for all type conversion
  const typeSystem = getTypeSystem();

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarations.map((decl) => {
      const declType =
        decl.type && typeSystem
          ? typeSystem.convertTypeNode(decl.type)
          : undefined;
      return {
        kind: "variableDeclarator" as const,
        name: convertBindingName(decl.name),
        type: declType,
        initializer: decl.initializer
          ? convertExpression(decl.initializer, binding, declType)
          : undefined,
      };
    }),
    isExported: false,
  };
};

/**
 * Check if node has export modifier
 */
export const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

/**
 * Check if node has static modifier
 */
export const hasStaticModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false
  );
};

/**
 * Check if node has readonly modifier
 */
export const hasReadonlyModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ?? false
  );
};

/**
 * Get accessibility modifier
 */
export const getAccessibility = (node: ts.Node): IrAccessibility => {
  if (!ts.canHaveModifiers(node)) return "public";
  const modifiers = ts.getModifiers(node);
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
    return "private";
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword))
    return "protected";
  return "public";
};
