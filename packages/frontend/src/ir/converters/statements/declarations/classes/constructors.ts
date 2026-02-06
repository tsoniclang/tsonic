/**
 * Constructor conversion with parameter properties
 */

import * as ts from "typescript";
import { IrClassMember, IrStatement } from "../../../../types.js";
import { convertBlockStatement } from "../../control.js";
import {
  hasReadonlyModifier,
  getAccessibility,
  convertParameters,
  makeOptionalType,
} from "../../helpers.js";
import type { ProgramContext } from "../../../../program-context.js";

/**
 * Convert constructor declaration to IR
 */
export const convertConstructor = (
  node: ts.ConstructorDeclaration,
  ctx: ProgramContext,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember => {
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
              object: {
                kind: "this",
              },
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
    const existingBody = convertBlockStatement(node.body, ctx, undefined);
    statements.push(...existingBody.statements);
  }

  return {
    kind: "constructorDeclaration",
    parameters: convertParameters(node.parameters, ctx),
    body: { kind: "blockStatement", statements },
    accessibility: getAccessibility(node),
  };
};

/**
 * Extract parameter properties from constructor
 */
export const extractParameterProperties = (
  constructor: ts.ConstructorDeclaration | undefined,
  ctx: ProgramContext
): IrClassMember[] => {
  if (!constructor) {
    return [];
  }

  const parameterProperties: IrClassMember[] = [];

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
      // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
      const accessibility = getAccessibility(param);
      const rawType = param.type
        ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(param.type))
        : undefined;

      const type =
        rawType && param.questionToken ? makeOptionalType(rawType) : rawType;

      parameterProperties.push({
        kind: "propertyDeclaration",
        name: param.name.text,
        type,
        initializer: undefined, // Will be assigned in constructor
        isStatic: false,
        isReadonly: hasReadonlyModifier(param),
        accessibility,
      });
    }
  }

  return parameterProperties;
};
