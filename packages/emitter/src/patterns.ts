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
import { emitTypeAst } from "./types/emitter.js";
import { printType } from "./core/format/backend-ast/printer.js";
import { escapeCSharpIdentifier } from "./emitter-types/identifiers.js";
import {
  allocateLocalName,
  emitRemappedLocalName,
  registerLocalName,
} from "./core/format/local-names.js";
import { emitExpressionAst } from "./expression-emitter.js";
import type {
  CSharpStatementAst,
  CSharpExpressionAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

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
  // In static context, we can't use 'var' - need explicit type with modifiers
  if (ctx.isStatic) {
    const escapedName = escapeCSharpIdentifier(name);
    const typeStr = type ? printType(emitTypeAst(type, ctx)[0]) : "object";
    const stmt = `${indent}private static readonly ${typeStr} ${escapedName} = ${inputExpr};`;
    return { statements: [stmt], context: ctx };
  }

  const alloc = allocateLocalName(name, ctx);
  const localName = alloc.emittedName;
  let currentCtx = alloc.context;

  // Local context: use var when type not available
  let typeStr = "var";
  if (type) {
    const [emittedTypeAst, next] = emitTypeAst(type, currentCtx);
    typeStr = printType(emittedTypeAst);
    currentCtx = next;
  }

  const stmt = `${indent}${typeStr} ${localName} = ${inputExpr};`;
  currentCtx = registerLocalName(name, localName, currentCtx);
  return { statements: [stmt], context: currentCtx };
};

/**
 * Lower an array pattern to a sequence of indexed accesses
 */
const lowerArrayPattern = (
  pattern: IrArrayPattern,
  inputExpr: string,
  elementType: IrType | undefined,
  indent: string,
  ctx: EmitterContext,
  arrayType?: IrType
): LoweringResult => {
  const statements: string[] = [];
  let currentCtx = ctx;

  // Create temporary for the input to avoid re-evaluation
  let [tempName, ctx1] = generateTemp("arr", currentCtx);
  currentCtx = ctx1;
  if (!ctx.isStatic) {
    const alloc = allocateLocalName(tempName, currentCtx);
    tempName = alloc.emittedName;
    currentCtx = alloc.context;
  }

  // In static context, we can't use 'var' - need explicit type
  if (ctx.isStatic && arrayType) {
    const [typeAst, ctx2] = emitTypeAst(arrayType, currentCtx);
    currentCtx = ctx2;
    statements.push(
      `${indent}private static readonly ${printType(typeAst)} ${tempName} = ${inputExpr};`
    );
  } else if (ctx.isStatic) {
    // Static without type - use object as fallback
    statements.push(
      `${indent}private static readonly object ${tempName} = ${inputExpr};`
    );
  } else {
    statements.push(`${indent}var ${tempName} = ${inputExpr};`);
  }

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
  let [tempName, ctx1] = generateTemp("obj", currentCtx);
  currentCtx = ctx1;
  if (!ctx.isStatic) {
    const alloc = allocateLocalName(tempName, currentCtx);
    tempName = alloc.emittedName;
    currentCtx = alloc.context;
  }

  // In static context, we can't use 'var' - need explicit type with modifiers
  if (ctx.isStatic && inputType) {
    const [typeAst, ctx2] = emitTypeAst(inputType, currentCtx);
    currentCtx = ctx2;
    statements.push(
      `${indent}private static readonly ${printType(typeAst)} ${tempName} = ${inputExpr};`
    );
  } else if (ctx.isStatic) {
    // Static without type - use object as fallback
    statements.push(
      `${indent}private static readonly object ${tempName} = ${inputExpr};`
    );
  } else {
    statements.push(`${indent}var ${tempName} = ${inputExpr};`);
  }

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
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
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
    const propType = getPropertyType(inputType, prop.key, currentCtx);

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
  key: string,
  ctx: EmitterContext
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

  if (type.kind === "referenceType") {
    const localType = ctx.localTypes?.get(type.name);
    if (!localType) return undefined;

    if (localType.kind === "interface") {
      const prop = localType.members.find(
        (m) => m.kind === "propertySignature" && m.name === key
      );
      if (prop && prop.kind === "propertySignature") {
        return prop.type;
      }
      return undefined;
    }

    if (localType.kind === "class") {
      const prop = localType.members.find(
        (m) => m.kind === "propertyDeclaration" && m.name === key
      );
      if (prop && prop.kind === "propertyDeclaration") {
        return prop.type;
      }
      return undefined;
    }

    if (localType.kind === "typeAlias") {
      return getPropertyType(localType.type, key, ctx);
    }
  }

  return undefined;
};

/**
 * Emit a default expression (simplified - just literals for now)
 */
const emitDefaultExpr = (expr: IrExpression, ctx: EmitterContext): string => {
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
    return emitRemappedLocalName(expr.name, ctx);
  }
  throw new Error(
    `Unsupported destructuring default expression kind '${expr.kind}'. ` +
      "Only literals and identifiers are supported (airplane-grade: no silent placeholder emission)."
  );
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
      // Get element type from array type, and pass full array type for static context
      const elementType =
        type?.kind === "arrayType" ? type.elementType : undefined;
      return lowerArrayPattern(
        pattern,
        inputExpr,
        elementType,
        indent,
        ctx,
        type
      );
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
    const escapedName = emitRemappedLocalName(pattern.name, ctx);
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
          const escapedName = emitRemappedLocalName(
            prop.pattern.name,
            currentCtx
          );
          assignments.push(
            `/* ${escapedName} = rest of ${tempName} - needs synthetic type */`
          );
        }
        continue;
      }

      // Regular property
      const propType = getPropertyType(type, prop.key, currentCtx);
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
    const escapedName = emitRemappedLocalName(pattern.name, ctx);
    return {
      expression: `${escapedName} = ${inputExpr}`,
      context: ctx,
    };
  }

  // Nested pattern - recurse
  return lowerAssignmentPattern(pattern, inputExpr, type, ctx);
};

// ============================================================================
// AST-returning pattern lowering (used by AST pipeline)
// ============================================================================

/**
 * Result of AST-based pattern lowering
 */
export type LoweringResultAst = {
  /** Statement AST nodes generated from the pattern */
  readonly statements: readonly CSharpStatementAst[];
  /** The context after lowering (with any new locals registered) */
  readonly context: EmitterContext;
};

/**
 * Emit a default expression as AST
 */
const emitDefaultExprAst = (
  expr: IrExpression,
  ctx: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return [{ kind: "literalExpression", text: `"${expr.value}"` }, ctx];
    }
    if (typeof expr.value === "number") {
      return [{ kind: "literalExpression", text: String(expr.value) }, ctx];
    }
    if (typeof expr.value === "boolean") {
      return [
        { kind: "literalExpression", text: expr.value ? "true" : "false" },
        ctx,
      ];
    }
    if (expr.value === null) {
      return [{ kind: "literalExpression", text: "null" }, ctx];
    }
  }
  if (expr.kind === "identifier") {
    const name = emitRemappedLocalName(expr.name, ctx);
    return [{ kind: "identifierExpression", identifier: name }, ctx];
  }
  // Fall back to full expression emitter for complex default expressions
  return emitExpressionAst(expr, ctx);
};

/**
 * Lower an identifier pattern to a localDeclarationStatement AST node
 */
const lowerIdentifierAst = (
  name: string,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const alloc = allocateLocalName(name, ctx);
  const localName = alloc.emittedName;
  let currentCtx = alloc.context;

  // Determine type AST
  let typeAst: CSharpTypeAst = { kind: "varType" };
  if (type) {
    const [emittedType, next] = emitTypeAst(type, currentCtx);
    typeAst = emittedType;
    currentCtx = next;
  }

  const stmt: CSharpStatementAst = {
    kind: "localDeclarationStatement",
    modifiers: [],
    type: typeAst,
    declarators: [{ name: localName, initializer: inputExpr }],
  };

  currentCtx = registerLocalName(name, localName, currentCtx);
  return { statements: [stmt], context: currentCtx };
};

/**
 * Lower an array pattern to AST statements
 */
const lowerArrayPatternAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  elementType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  // Create temporary for the input to avoid re-evaluation
  const [rawTempName, ctx1] = generateTemp("arr", currentCtx);
  currentCtx = ctx1;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  // var __arrN = inputExpr;
  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  // Process each element
  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      // Hole in pattern - skip this index
      index++;
      continue;
    }

    if (elem.isRest) {
      // Rest element: ArrayHelpers.Slice(temp, index)
      const sliceExpr: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: "Tsonic.Runtime.ArrayHelpers",
          },
          memberName: "Slice",
        },
        arguments: [tempId, { kind: "literalExpression", text: String(index) }],
      };
      const result = lowerPatternAst(
        elem.pattern,
        sliceExpr,
        elementType ? { kind: "arrayType", elementType } : undefined,
        currentCtx
      );
      statements.push(...result.statements);
      currentCtx = result.context;
      break;
    }

    // Regular element: temp[index]
    const accessExpr: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: tempId,
      arguments: [{ kind: "literalExpression", text: String(index) }],
    };

    // Handle default value
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (elem.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        elem.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const result = lowerPatternAst(
      elem.pattern,
      valueExpr,
      elementType,
      currentCtx
    );
    statements.push(...result.statements);
    currentCtx = result.context;
    index++;
  }

  return { statements, context: currentCtx };
};

/**
 * Lower an object pattern to AST statements
 */
const lowerObjectPatternAst = (
  pattern: IrObjectPattern,
  inputExpr: CSharpExpressionAst,
  inputType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  // Create temporary for the input to avoid re-evaluation
  const [rawTempName, ctx1] = generateTemp("obj", currentCtx);
  currentCtx = ctx1;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  // var __objN = inputExpr;
  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  // Process each property
  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      // Rest property: create new synthetic object with remaining props
      if (prop.restShapeMembers && prop.restSynthTypeName) {
        const initMembers = prop.restShapeMembers
          .filter((m) => m.kind === "propertySignature")
          .map((m) => ({
            kind: "assignmentExpression" as const,
            operatorToken: "=" as const,
            left: {
              kind: "identifierExpression" as const,
              identifier: m.name,
            },
            right: {
              kind: "memberAccessExpression" as const,
              expression: tempId,
              memberName: m.name,
            },
          }));

        const restExpr: CSharpExpressionAst = {
          kind: "objectCreationExpression",
          type: { kind: "identifierType", name: prop.restSynthTypeName },
          arguments: [],
          initializer: initMembers,
        };

        const result = lowerPatternAst(
          prop.pattern,
          restExpr,
          undefined,
          currentCtx
        );
        statements.push(...result.statements);
        currentCtx = result.context;
      } else {
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
      }
      continue;
    }

    // Regular property: temp.key
    const propAccessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempId,
      memberName: prop.key,
    };

    // Handle default value
    let valueExpr: CSharpExpressionAst = propAccessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: propAccessExpr,
        right: defaultAst,
      };
    }

    // Get property type if available
    const propType = getPropertyType(inputType, prop.key, currentCtx);

    const result = lowerPatternAst(prop.value, valueExpr, propType, currentCtx);
    statements.push(...result.statements);
    currentCtx = result.context;
  }

  return { statements, context: currentCtx };
};

/**
 * Lower a pattern to AST statements (AST pipeline version).
 *
 * @param pattern - The pattern to lower (identifier, array, or object)
 * @param inputExpr - The C# AST expression being destructured
 * @param type - The type of the input expression (for type annotations)
 * @param ctx - The current emitter context
 * @returns The generated AST statements and updated context
 */
export const lowerPatternAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifierAst(pattern.name, inputExpr, type, ctx);

    case "arrayPattern": {
      const elementType =
        type?.kind === "arrayType" ? type.elementType : undefined;
      return lowerArrayPatternAst(pattern, inputExpr, elementType, ctx);
    }

    case "objectPattern":
      return lowerObjectPatternAst(pattern, inputExpr, type, ctx);

    default:
      // Unknown pattern kind - emit empty statement as placeholder
      return {
        statements: [{ kind: "emptyStatement" }],
        context: ctx,
      };
  }
};
