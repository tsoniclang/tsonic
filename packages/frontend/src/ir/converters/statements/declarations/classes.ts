/**
 * Class declaration converter
 */

import * as ts from "typescript";
import {
  IrClassDeclaration,
  IrClassMember,
  IrStatement,
} from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertType } from "../../../type-converter.js";
import { convertBlockStatement } from "../control.js";
import {
  hasExportModifier,
  hasStaticModifier,
  hasReadonlyModifier,
  getAccessibility,
  convertTypeParameters,
  convertParameters,
} from "../helpers.js";
import { getMetadataRegistry } from "./registry.js";

/**
 * Check if a method/property should be marked as override based on base class metadata
 */
const detectOverride = (
  memberName: string,
  memberKind: "method" | "property",
  superClass: ts.ExpressionWithTypeArguments | undefined,
  checker: ts.TypeChecker,
  parameterTypes?: readonly string[]
): { isOverride: boolean; isShadow: boolean } => {
  if (!superClass) {
    return { isOverride: false, isShadow: false };
  }

  // Resolve the base class type
  const baseType = checker.getTypeAtLocation(superClass.expression);
  const baseSymbol = baseType.getSymbol();

  if (!baseSymbol) {
    return { isOverride: false, isShadow: false };
  }

  // Get fully-qualified name for .NET types
  const qualifiedName = checker.getFullyQualifiedName(baseSymbol);

  // Check if this is a .NET type (starts with "System." or other .NET namespaces)
  const isDotNetType =
    qualifiedName.startsWith("System.") ||
    qualifiedName.startsWith("Microsoft.") ||
    qualifiedName.startsWith("Tsonic.Runtime.");

  if (isDotNetType) {
    // Use metadata to determine if virtual
    const metadata = getMetadataRegistry();

    if (memberKind === "method" && parameterTypes) {
      const signature = `${memberName}(${parameterTypes.join(",")})`;
      const isVirtual = metadata.isVirtualMember(qualifiedName, signature);
      const isSealed = metadata.isSealedMember(qualifiedName, signature);
      return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
    } else if (memberKind === "property") {
      // For properties, check without parameters
      const isVirtual = metadata.isVirtualMember(qualifiedName, memberName);
      const isSealed = metadata.isSealedMember(qualifiedName, memberName);
      return { isOverride: isVirtual && !isSealed, isShadow: !isVirtual };
    }
  } else {
    // TypeScript base class - check declarations
    const baseDeclarations = baseSymbol.getDeclarations();

    if (!baseDeclarations || baseDeclarations.length === 0) {
      return { isOverride: false, isShadow: false };
    }

    for (const baseDecl of baseDeclarations) {
      if (ts.isClassDeclaration(baseDecl)) {
        // Check if base class has this member
        const baseMember = baseDecl.members.find((m) => {
          if (memberKind === "method" && ts.isMethodDeclaration(m)) {
            return ts.isIdentifier(m.name) && m.name.text === memberName;
          } else if (memberKind === "property" && ts.isPropertyDeclaration(m)) {
            return ts.isIdentifier(m.name) && m.name.text === memberName;
          }
          return false;
        });

        if (baseMember) {
          // In TypeScript, all methods can be overridden unless final (not supported in TS)
          return { isOverride: true, isShadow: false };
        }
      }
    }
  }

  return { isOverride: false, isShadow: false };
};

/**
 * Convert class member (property, method, or constructor)
 */
const convertClassMember = (
  node: ts.ClassElement,
  checker: ts.TypeChecker,
  superClass: ts.ExpressionWithTypeArguments | undefined,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember | null => {
  if (ts.isPropertyDeclaration(node)) {
    const memberName = ts.isIdentifier(node.name)
      ? node.name.text
      : "[computed]";
    const overrideInfo = detectOverride(
      memberName,
      "property",
      superClass,
      checker
    );

    return {
      kind: "propertyDeclaration",
      name: memberName,
      type: node.type ? convertType(node.type, checker) : undefined,
      initializer: node.initializer
        ? convertExpression(node.initializer, checker)
        : undefined,
      isStatic: hasStaticModifier(node),
      isReadonly: hasReadonlyModifier(node),
      accessibility: getAccessibility(node),
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    };
  }

  if (ts.isMethodDeclaration(node)) {
    const memberName = ts.isIdentifier(node.name)
      ? node.name.text
      : "[computed]";

    // Extract parameter types for method signature
    const parameterTypes = node.parameters.map((param) => {
      if (param.type) {
        // Get type string representation
        const type = checker.getTypeAtLocation(param.type);
        return checker.typeToString(type);
      }
      return "any";
    });

    const overrideInfo = detectOverride(
      memberName,
      "method",
      superClass,
      checker,
      parameterTypes
    );

    return {
      kind: "methodDeclaration",
      name: memberName,
      typeParameters: convertTypeParameters(node.typeParameters, checker),
      parameters: convertParameters(node.parameters, checker),
      returnType: node.type ? convertType(node.type, checker) : undefined,
      body: node.body ? convertBlockStatement(node.body, checker) : undefined,
      isStatic: hasStaticModifier(node),
      isAsync: !!node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword
      ),
      isGenerator: !!node.asteriskToken,
      accessibility: getAccessibility(node),
      isOverride: overrideInfo.isOverride ? true : undefined,
      isShadow: overrideInfo.isShadow ? true : undefined,
    };
  }

  if (ts.isConstructorDeclaration(node)) {
    // Build constructor body with parameter property assignments
    const statements: IrStatement[] = [];

    // Add assignments for parameter properties (parameters with explicit modifiers)
    if (constructorParams) {
      for (const param of constructorParams) {
        // Check if parameter has an EXPLICIT accessibility modifier
        const modifiers = ts.getModifiers(param);
        const hasAccessibilityModifier = modifiers?.some(
          (m) =>
            m.kind === ts.SyntaxKind.PublicKeyword ||
            m.kind === ts.SyntaxKind.PrivateKeyword ||
            m.kind === ts.SyntaxKind.ProtectedKeyword
        );

        if (hasAccessibilityModifier && ts.isIdentifier(param.name)) {
          // Create: this.name = name;
          statements.push({
            kind: "expressionStatement",
            expression: {
              kind: "assignment",
              operator: "=",
              left: {
                kind: "memberAccess",
                object: { kind: "this" },
                property: param.name.text,
                isComputed: false,
                isOptional: false,
              },
              right: {
                kind: "identifier",
                name: param.name.text,
              },
            },
          });
        }
      }
    }

    // Add existing constructor body statements
    if (node.body) {
      const existingBody = convertBlockStatement(node.body, checker);
      statements.push(...existingBody.statements);
    }

    return {
      kind: "constructorDeclaration",
      parameters: convertParameters(node.parameters, checker),
      body: { kind: "blockStatement", statements },
      accessibility: getAccessibility(node),
    };
  }

  return null;
};

/**
 * Convert class declaration
 */
export const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  checker: ts.TypeChecker
): IrClassDeclaration | null => {
  if (!node.name) return null;

  const superClass = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  )?.types[0];

  const implementsTypes =
    node.heritageClauses
      ?.find((h) => h.token === ts.SyntaxKind.ImplementsKeyword)
      ?.types.map((t) => convertType(t, checker)) ?? [];

  // Extract parameter properties from constructor
  const constructor = node.members.find(ts.isConstructorDeclaration);
  const parameterProperties: IrClassMember[] = [];

  if (constructor) {
    for (const param of constructor.parameters) {
      // Check if parameter has an EXPLICIT accessibility modifier
      // (public/private/protected makes it a parameter property)
      const modifiers = ts.getModifiers(param);
      const hasAccessibilityModifier = modifiers?.some(
        (m) =>
          m.kind === ts.SyntaxKind.PublicKeyword ||
          m.kind === ts.SyntaxKind.PrivateKeyword ||
          m.kind === ts.SyntaxKind.ProtectedKeyword
      );

      if (!hasAccessibilityModifier) {
        continue; // Not a parameter property
      }

      // Create a field declaration for this parameter property
      if (ts.isIdentifier(param.name)) {
        const accessibility = getAccessibility(param);
        parameterProperties.push({
          kind: "propertyDeclaration",
          name: param.name.text,
          type: param.type ? convertType(param.type, checker) : undefined,
          initializer: undefined, // Will be assigned in constructor
          isStatic: false,
          isReadonly: hasReadonlyModifier(param),
          accessibility,
        });
      }
    }
  }

  // Filter to only include members declared directly on this class (not inherited)
  const ownMembers = node.members.filter((m) => {
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

  const convertedMembers = ownMembers
    .map((m) =>
      convertClassMember(m, checker, superClass, constructor?.parameters)
    )
    .filter((m): m is IrClassMember => m !== null);

  // Deduplicate members by name (keep first occurrence)
  // Parameter properties should take precedence over regular properties with same name
  const allMembers = [...parameterProperties, ...convertedMembers];
  const seenNames = new Set<string>();
  const deduplicatedMembers = allMembers.filter((member) => {
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

  return {
    kind: "classDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    superClass: superClass ? convertExpression(superClass, checker) : undefined,
    implements: implementsTypes,
    members: deduplicatedMembers,
    isExported: hasExportModifier(node),
  };
};
