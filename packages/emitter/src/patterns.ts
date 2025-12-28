/**
 * Pattern Lowering Module
 *
 * Transforms destructuring patterns into sequences of C# variable declarations.
 * This module is used by variable declarations, for-of loops, and function parameters.
 *
 * Example transformations:
 *
 * Array pattern:
 *   const [a, b, c] = arr;
 *   =>
 *   var __t0 = arr;
 *   var a = __t0[0];
 *   var b = __t0[1];
 *   var c = __t0[2];
 *
 * Array pattern with rest:
 *   const [first, ...rest] = arr;
 *   =>
 *   var __t0 = arr;
 *   var first = __t0[0];
 *   var rest = Tsonic.Runtime.ArrayHelpers.Slice(__t0, 1);
 *
 * Object pattern:
 *   const { name, age } = person;
 *   =>
 *   var __t0 = person;
 *   var name = __t0.name;
 *   var age = __t0.age;
 *
 * Object pattern with rest:
 *   const { name, ...rest } = person;
 *   =>
 *   var __t0 = person;
 *   var name = __t0.name;
 *   var rest = new __Rest_xxxx { age = __t0.age, email = __t0.email };
 */

import {
  IrPattern,
  IrArrayPattern,
  IrObjectPattern,
  IrType,
  IrExpression,
} from "@tsonic/frontend";
import { EmitterContext } from "./emitter-types/index.js";
import { emitType } from "./types/emitter.js";
import { escapeCSharpIdentifier } from "./emitter-types/identifiers.js";

/**
 * Result of pattern lowering - a list of C# statements
 */
export type LoweringResult = {
  /** Variable declarations generated from the pattern */
  readonly statements: readonly string[];
  /** The context after lowering (with any new locals registered) */
  readonly context: EmitterContext;
};

/**
 * Generate a unique temporary variable name
 */
const generateTemp = (
  prefix: string,
  ctx: EmitterContext
): [string, EmitterContext] => {
  const tempId = ctx.tempVarId ?? 0;
  const name = `__${prefix}${tempId}`;
  const newCtx = { ...ctx, tempVarId: tempId + 1 };
  return [name, newCtx];
};

/**
 * Lower an identifier pattern to a simple variable declaration
 */
const lowerIdentifier = (
  name: string,
  inputExpr: string,
  type: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  const escapedName = escapeCSharpIdentifier(name);
  // emitType returns [typeString, newContext]
  const typeStr = type ? emitType(type, ctx)[0] : "var";
  const stmt = `${indent}${typeStr} ${escapedName} = ${inputExpr};`;
  return { statements: [stmt], context: ctx };
};

/**
 * Lower an array pattern to a sequence of indexed accesses
 */
const lowerArrayPattern = (
  pattern: IrArrayPattern,
  inputExpr: string,
  elementType: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  const statements: string[] = [];
  let currentCtx = ctx;

  // Create temporary for the input to avoid re-evaluation
  const [tempName, ctx1] = generateTemp("arr", currentCtx);
  currentCtx = ctx1;
  statements.push(`${indent}var ${tempName} = ${inputExpr};`);

  // Process each element
  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      // Hole in pattern - skip this index
      index++;
      continue;
    }

    if (elem.isRest) {
      // Rest element: use ArrayHelpers.Slice
      const result = lowerPattern(
        elem.pattern,
        `Tsonic.Runtime.ArrayHelpers.Slice(${tempName}, ${index})`,
        elementType ? { kind: "arrayType", elementType } : undefined,
        indent,
        currentCtx
      );
      statements.push(...result.statements);
      currentCtx = result.context;
      // Rest must be last, so break
      break;
    }

    // Regular element: index access
    const accessExpr = `${tempName}[${index}]`;

    // Handle default value
    let valueExpr = accessExpr;
    if (elem.defaultExpr) {
      // For nullable types: value ?? default
      // For now, use simple null-coalescing (assumes nullable element type)
      const defaultValue = emitDefaultExpr(elem.defaultExpr, currentCtx);
      valueExpr = `${accessExpr} ?? ${defaultValue}`;
    }

    const result = lowerPattern(
      elem.pattern,
      valueExpr,
      elementType,
      indent,
      currentCtx
    );
    statements.push(...result.statements);
    currentCtx = result.context;
    index++;
  }

  return { statements, context: currentCtx };
};

/**
 * Lower an object pattern to a sequence of property accesses
 */
const lowerObjectPattern = (
  pattern: IrObjectPattern,
  inputExpr: string,
  inputType: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  const statements: string[] = [];
  let currentCtx = ctx;

  // Create temporary for the input to avoid re-evaluation
  const [tempName, ctx1] = generateTemp("obj", currentCtx);
  currentCtx = ctx1;
  statements.push(`${indent}var ${tempName} = ${inputExpr};`);

  // Process each property
  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      // Rest property: create new synthetic object with remaining props
      if (prop.restShapeMembers && prop.restSynthTypeName) {
        // Generate object initializer for rest
        const initProps = prop.restShapeMembers
          .filter((m) => m.kind === "propertySignature")
          .map((m) => `${m.name} = ${tempName}.${m.name}`)
          .join(", ");
        const restExpr = `new ${prop.restSynthTypeName} { ${initProps} }`;

        const result = lowerPattern(
          prop.pattern,
          restExpr,
          undefined, // Type is the synthetic type
          indent,
          currentCtx
        );
        statements.push(...result.statements);
        currentCtx = result.context;
      } else {
        // No shape info - emit a comment placeholder
        if (prop.pattern.kind === "identifierPattern") {
          const name = escapeCSharpIdentifier(prop.pattern.name);
          statements.push(
            `${indent}// TODO: rest property ${name} needs shape info`
          );
        }
      }
      continue;
    }

    // Regular property
    const propAccessExpr = `${tempName}.${prop.key}`;

    // Handle default value
    let valueExpr = propAccessExpr;
    if (prop.defaultExpr) {
      const defaultValue = emitDefaultExpr(prop.defaultExpr, currentCtx);
      valueExpr = `${propAccessExpr} ?? ${defaultValue}`;
    }

    // Get property type if available
    const propType = getPropertyType(inputType, prop.key);

    const result = lowerPattern(
      prop.value,
      valueExpr,
      propType,
      indent,
      currentCtx
    );
    statements.push(...result.statements);
    currentCtx = result.context;
  }

  return { statements, context: currentCtx };
};

/**
 * Get property type from an object/interface type
 */
const getPropertyType = (
  type: IrType | undefined,
  key: string
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "objectType") {
    const prop = type.members.find(
      (m) => m.kind === "propertySignature" && m.name === key
    );
    if (prop && prop.kind === "propertySignature") {
      return prop.type;
    }
  }

  if (type.kind === "referenceType" && type.structuralMembers) {
    const prop = type.structuralMembers.find(
      (m) => m.kind === "propertySignature" && m.name === key
    );
    if (prop && prop.kind === "propertySignature") {
      return prop.type;
    }
  }

  return undefined;
};

/**
 * Emit a default expression (simplified - just literals for now)
 */
const emitDefaultExpr = (expr: IrExpression, _ctx: EmitterContext): string => {
  // Simplified default expression emission
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return `"${expr.value}"`;
    }
    if (typeof expr.value === "number") {
      return String(expr.value);
    }
    if (typeof expr.value === "boolean") {
      return expr.value ? "true" : "false";
    }
    if (expr.value === null) {
      return "null";
    }
  }
  if (expr.kind === "identifier") {
    return escapeCSharpIdentifier(expr.name);
  }
  // For complex expressions, emit a placeholder
  return "default!";
};

/**
 * Lower a pattern to a sequence of C# statements
 *
 * @param pattern - The pattern to lower (identifier, array, or object)
 * @param inputExpr - The C# expression being destructured
 * @param type - The type of the input expression (for type annotations)
 * @param indent - Indentation prefix for generated code
 * @param ctx - The current emitter context
 * @returns The generated statements and updated context
 */
export const lowerPattern = (
  pattern: IrPattern,
  inputExpr: string,
  type: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifier(pattern.name, inputExpr, type, indent, ctx);

    case "arrayPattern": {
      // Get element type from array type
      const elementType =
        type?.kind === "arrayType" ? type.elementType : undefined;
      return lowerArrayPattern(pattern, inputExpr, elementType, indent, ctx);
    }

    case "objectPattern":
      return lowerObjectPattern(pattern, inputExpr, type, indent, ctx);

    default:
      // Unknown pattern kind
      return {
        statements: [`${indent}// Unsupported pattern kind`],
        context: ctx,
      };
  }
};

/**
 * Lower a pattern for a for-of loop variable
 * Similar to lowerPattern but handles the iteration context
 */
export const lowerForOfPattern = (
  pattern: IrPattern,
  iteratorVar: string,
  elementType: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  // For simple identifier patterns, no lowering needed
  if (pattern.kind === "identifierPattern") {
    // The for-of loop itself declares the variable
    return { statements: [], context: ctx };
  }

  // For complex patterns, lower to statements inside the loop body
  return lowerPattern(pattern, iteratorVar, elementType, indent, ctx);
};

/**
 * Lower a parameter pattern for function definitions
 * Generates statements to go at the beginning of the function body
 */
export const lowerParameterPattern = (
  pattern: IrPattern,
  paramName: string,
  paramType: IrType | undefined,
  indent: string,
  ctx: EmitterContext
): LoweringResult => {
  // For simple identifier patterns, no lowering needed
  if (pattern.kind === "identifierPattern") {
    return { statements: [], context: ctx };
  }

  // For complex patterns, generate statements to destructure the synthetic param
  return lowerPattern(pattern, paramName, paramType, indent, ctx);
};

/**
 * Result of assignment pattern lowering - an expression and context
 *
 * Assignment destructuring is an expression (returns the RHS value),
 * so we return an expression string instead of statements.
 */
export type AssignmentLoweringResult = {
  /** The C# expression that performs the assignment and returns the value */
  readonly expression: string;
  /** The context after lowering */
  readonly context: EmitterContext;
};

/**
 * Lower an assignment pattern to a C# expression
 *
 * In JavaScript, destructuring assignment is an expression that returns the RHS:
 *   const result = ([a, b] = arr);  // result === arr
 *
 * We emit this as a parenthesized sequence expression:
 *   ((__t = rhs), (a = __t[0]), (b = __t[1]), __t)
 *
 * @param pattern - The pattern being assigned to
 * @param rhsExpr - The C# expression for the right-hand side
 * @param type - The type of the RHS expression
 * @param ctx - The current emitter context
 * @returns The expression and updated context
 */
export const lowerAssignmentPattern = (
  pattern: IrPattern,
  rhsExpr: string,
  type: IrType | undefined,
  ctx: EmitterContext
): AssignmentLoweringResult => {
  // For identifier pattern, just emit simple assignment
  if (pattern.kind === "identifierPattern") {
    const escapedName = escapeCSharpIdentifier(pattern.name);
    return {
      expression: `${escapedName} = ${rhsExpr}`,
      context: ctx,
    };
  }

  // For complex patterns, generate sequence expression
  const [tempName, ctx1] = generateTemp("t", ctx);
  let currentCtx = ctx1;

  // Collect assignment expressions
  const assignments: string[] = [];

  if (pattern.kind === "arrayPattern") {
    const elementType =
      type?.kind === "arrayType" ? type.elementType : undefined;

    let index = 0;
    for (const elem of pattern.elements) {
      if (!elem) {
        // Hole in pattern - skip
        index++;
        continue;
      }

      if (elem.isRest) {
        // Rest element
        const result = lowerAssignmentPatternElement(
          elem.pattern,
          `Tsonic.Runtime.ArrayHelpers.Slice(${tempName}, ${index})`,
          elementType ? { kind: "arrayType", elementType } : undefined,
          currentCtx
        );
        assignments.push(result.expression);
        currentCtx = result.context;
        break;
      }

      // Regular element
      const result = lowerAssignmentPatternElement(
        elem.pattern,
        `${tempName}[${index}]`,
        elementType,
        currentCtx
      );
      assignments.push(result.expression);
      currentCtx = result.context;
      index++;
    }
  } else if (pattern.kind === "objectPattern") {
    for (const prop of pattern.properties) {
      if (prop.kind === "rest") {
        // Rest property - would need synthetic type
        if (prop.pattern.kind === "identifierPattern") {
          const escapedName = escapeCSharpIdentifier(prop.pattern.name);
          assignments.push(
            `/* ${escapedName} = rest of ${tempName} - needs synthetic type */`
          );
        }
        continue;
      }

      // Regular property
      const propType = getPropertyType(type, prop.key);
      const result = lowerAssignmentPatternElement(
        prop.value,
        `${tempName}.${prop.key}`,
        propType,
        currentCtx
      );
      assignments.push(result.expression);
      currentCtx = result.context;
    }
  }

  // Build sequence expression: (__t = rhs, a = __t[0], ..., __t)
  const allParts = [`${tempName} = ${rhsExpr}`, ...assignments, tempName];
  const expression = `(${allParts.join(", ")})`;

  return { expression, context: currentCtx };
};

/**
 * Helper to lower a single element/property in an assignment pattern
 */
const lowerAssignmentPatternElement = (
  pattern: IrPattern,
  inputExpr: string,
  type: IrType | undefined,
  ctx: EmitterContext
): AssignmentLoweringResult => {
  if (pattern.kind === "identifierPattern") {
    const escapedName = escapeCSharpIdentifier(pattern.name);
    return {
      expression: `${escapedName} = ${inputExpr}`,
      context: ctx,
    };
  }

  // Nested pattern - recurse
  return lowerAssignmentPattern(pattern, inputExpr, type, ctx);
};
