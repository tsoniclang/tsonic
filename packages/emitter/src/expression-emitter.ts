/**
 * Expression Emitter - IR expressions to C# code
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing, indent } from "./types.js";
import { emitType } from "./type-emitter.js";
import { emitStatement } from "./statement-emitter.js";

/**
 * Emit a C# expression from an IR expression
 * @param expr The IR expression to emit
 * @param context The emitter context
 * @param expectedType Optional expected type for contextual typing (e.g., array element type inference)
 */
export const emitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  switch (expr.kind) {
    case "literal":
      return emitLiteral(expr, context);

    case "identifier":
      return emitIdentifier(expr, context);

    case "array":
      return emitArray(expr, context, expectedType);

    case "object":
      return emitObject(expr, context);

    case "memberAccess":
      return emitMemberAccess(expr, context);

    case "call":
      return emitCall(expr, context);

    case "new":
      return emitNew(expr, context);

    case "binary":
      return emitBinary(expr, context);

    case "logical":
      return emitLogical(expr, context);

    case "unary":
      return emitUnary(expr, context);

    case "update":
      return emitUpdate(expr, context);

    case "assignment":
      return emitAssignment(expr, context);

    case "conditional":
      return emitConditional(expr, context);

    case "functionExpression":
      return emitFunctionExpression(expr, context);

    case "arrowFunction":
      return emitArrowFunction(expr, context);

    case "templateLiteral":
      return emitTemplateLiteral(expr, context);

    case "spread":
      return emitSpread(expr, context);

    case "await":
      return emitAwait(expr, context);

    case "this":
      return [{ text: "this" }, context];

    default:
      // Fallback for unhandled expressions
      return [{ text: "/* TODO: unhandled expression */" }, context];
  }
};

/**
 * Emit type arguments as C# generic type parameters
 * Example: [string, number] → <string, double>
 */
const emitTypeArguments = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return ["", context];
  }

  let currentContext = context;
  const typeStrings: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeStr, newContext] = emitType(typeArg, currentContext);
    currentContext = newContext;
    typeStrings.push(typeStr);
  }

  return [`<${typeStrings.join(", ")}>`, currentContext];
};

/**
 * Generate specialized method/class name from type arguments
 * Example: process with [string, number] → process__string__double
 */
const generateSpecializedName = (
  baseName: string,
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const typeNames: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeName, newContext] = emitType(typeArg, currentContext);
    currentContext = newContext;
    // Sanitize type name for use in identifier (remove <>, ?, etc.)
    const sanitized = typeName.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
    typeNames.push(sanitized);
  }

  const specializedName = `${baseName}__${typeNames.join("__")}`;
  return [specializedName, currentContext];
};

const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const { value } = expr;

  if (value === null) {
    return [{ text: "null" }, context];
  }

  if (value === undefined) {
    return [{ text: "default" }, context];
  }

  if (typeof value === "string") {
    // Escape the string for C#
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return [{ text: `"${escaped}"` }, context];
  }

  if (typeof value === "number") {
    // All numbers are doubles in JavaScript, but array indices should be integers
    const isInteger = Number.isInteger(value);
    const text =
      isInteger && !context.isArrayIndex ? `${value}.0` : String(value);
    return [{ text }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};

const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Map JavaScript global identifiers to Tsonic.Runtime equivalents
  const identifierMap: Record<string, string> = {
    console: "Tsonic.Runtime.console",
    Math: "Tsonic.Runtime.Math",
    JSON: "Tsonic.Runtime.JSON",
    parseInt: "Tsonic.Runtime.parseInt",
    parseFloat: "Tsonic.Runtime.parseFloat",
    isNaN: "Tsonic.Runtime.isNaN",
    isFinite: "Tsonic.Runtime.isFinite",
    undefined: "default",
  };

  const mapped = identifierMap[expr.name];
  if (mapped) {
    const updatedContext = addUsing(context, "Tsonic.Runtime");
    return [{ text: mapped }, updatedContext];
  }

  return [{ text: expr.name }, context];
};

const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  let currentContext = addUsing(context, "Tsonic.Runtime");
  const elements: string[] = [];

  // Determine element type from expected type if available
  let elementType = "object";
  if (expectedType) {
    if (expectedType.kind === "arrayType") {
      const [elemTypeStr, newContext] = emitType(
        expectedType.elementType,
        currentContext
      );
      elementType = elemTypeStr;
      currentContext = newContext;
    } else if (
      expectedType.kind === "referenceType" &&
      expectedType.name === "Array" &&
      expectedType.typeArguments &&
      expectedType.typeArguments.length > 0
    ) {
      const firstArg = expectedType.typeArguments[0];
      if (firstArg) {
        const [elemTypeStr, newContext] = emitType(firstArg, currentContext);
        elementType = elemTypeStr;
        currentContext = newContext;
      }
    }
  }

  // Check if array contains only spread elements (e.g., [...arr1, ...arr2])
  const allSpreads = expr.elements.every(
    (el) => el !== undefined && el.kind === "spread"
  );

  if (allSpreads && expr.elements.length > 0) {
    // Emit as chained Concat calls: arr1.Concat(arr2).Concat(arr3)
    const spreadElements = expr.elements.filter(
      (el): el is Extract<IrExpression, { kind: "spread" }> =>
        el !== undefined && el.kind === "spread"
    );

    const firstSpread = spreadElements[0];
    if (!firstSpread) {
      // Should never happen due to allSpreads check, but satisfy TypeScript
      return [{ text: "new Tsonic.Runtime.Array<object>()" }, currentContext];
    }

    const [firstFrag, firstContext] = emitExpression(
      firstSpread.expression,
      currentContext
    );
    currentContext = firstContext;

    let result = firstFrag.text;
    for (let i = 1; i < spreadElements.length; i++) {
      const spread = spreadElements[i];
      if (spread) {
        const [spreadFrag, newContext] = emitExpression(
          spread.expression,
          currentContext
        );
        result = `${result}.Concat(${spreadFrag.text})`;
        currentContext = newContext;
      }
    }

    return [{ text: result }, currentContext];
  }

  // Regular array or mixed spreads/elements
  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole - Tsonic.Runtime.Array supports sparse arrays
      elements.push("default");
    } else if (element.kind === "spread") {
      // Spread mixed with other elements - not yet supported
      elements.push("/* ...spread */");
    } else {
      const [elemFrag, newContext] = emitExpression(element, currentContext);
      elements.push(elemFrag.text);
      currentContext = newContext;
    }
  }

  const text = `new Tsonic.Runtime.Array<${elementType}>(${elements.join(", ")})`;

  return [{ text }, currentContext];
};

const emitObject = (
  expr: Extract<IrExpression, { kind: "object" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const properties: string[] = [];

  for (const prop of expr.properties) {
    if (prop.kind === "spread") {
      // Spread in object literal - needs special handling
      properties.push("/* ...spread */");
    } else {
      const key = typeof prop.key === "string" ? prop.key : "/* computed */";
      const [valueFrag, newContext] = emitExpression(
        prop.value,
        currentContext
      );
      properties.push(`${key} = ${valueFrag.text}`);
      currentContext = newContext;
    }
  }

  const text = `new { ${properties.join(", ")} }`;
  return [{ text }, currentContext];
};

const emitMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [objectFrag, newContext] = emitExpression(expr.object, context);

  if (expr.isComputed) {
    // Emit index expression with array index context
    const indexContext = { ...newContext, isArrayIndex: true };
    const [propFrag, contextWithIndex] = emitExpression(
      expr.property as IrExpression,
      indexContext
    );
    // Clear the array index flag before returning context
    const finalContext = { ...contextWithIndex, isArrayIndex: false };
    const accessor = expr.isOptional ? "?[" : "[";
    const text = `${objectFrag.text}${accessor}${propFrag.text}]`;
    return [{ text }, finalContext];
  }

  const prop = expr.property as string;
  const accessor = expr.isOptional ? "?." : ".";
  const text = `${objectFrag.text}${accessor}${prop}`;
  return [{ text }, newContext];
};

const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Type-aware method call rewriting
  // Use inferredType to determine if we need to rewrite as static helper
  if (
    expr.callee.kind === "memberAccess" &&
    typeof expr.callee.property === "string"
  ) {
    const methodName = expr.callee.property;
    const objectType = expr.callee.object.inferredType;

    // Rewrite based on type:
    // - string → Tsonic.Runtime.String.method()
    // - number → Tsonic.Runtime.Number.method()
    // - Array<T> → Keep as instance method (our custom class)
    // - Other custom types → Keep as instance method

    const shouldRewriteAsStatic =
      (objectType?.kind === "primitiveType" && objectType.name === "string") ||
      (objectType?.kind === "primitiveType" && objectType.name === "number");

    if (shouldRewriteAsStatic) {
      // Determine which runtime class based on type
      const runtimeClass =
        objectType?.kind === "primitiveType" && objectType.name === "string"
          ? "String"
          : "Number";

      // Rewrite: obj.method(args) → Tsonic.Runtime.{Class}.method(obj, args)
      const [objectFrag, objContext] = emitExpression(
        expr.callee.object,
        context
      );
      let currentContext = addUsing(objContext, "Tsonic.Runtime");

      const args: string[] = [objectFrag.text]; // Object becomes first argument
      for (const arg of expr.arguments) {
        if (arg.kind === "spread") {
          const [spreadFrag, ctx] = emitExpression(
            arg.expression,
            currentContext
          );
          args.push(`params ${spreadFrag.text}`);
          currentContext = ctx;
        } else {
          const [argFrag, ctx] = emitExpression(arg, currentContext);
          args.push(argFrag.text);
          currentContext = ctx;
        }
      }

      const text = `Tsonic.Runtime.${runtimeClass}.${methodName}(${args.join(", ")})`;
      return [{ text }, currentContext];
    }
  }

  // Regular function call (includes array methods - they're instance methods)
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalCalleeName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized method name
      // e.g., process<string> → process__string
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalCalleeName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic call
      // e.g., identity<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  const callOp = expr.isOptional ? "?." : "";
  const text = `${finalCalleeName}${typeArgsStr}${callOp}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalClassName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized class name
      // e.g., new Box<string>() → new Box__string()
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalClassName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic constructor
      // e.g., new Box<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  const text = `new ${finalClassName}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

const emitBinary = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [leftFrag, leftContext] = emitExpression(expr.left, context);
  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  // Map JavaScript operators to C# operators
  const operatorMap: Record<string, string> = {
    "===": "==",
    "!==": "!=",
    "==": "==", // Loose equality - needs special handling
    "!=": "!=", // Loose inequality - needs special handling
    instanceof: "is",
    in: "/* in */", // Needs special handling
  };

  const op = operatorMap[expr.operator] ?? expr.operator;

  // Handle typeof operator specially
  if (expr.operator === "instanceof") {
    const text = `${leftFrag.text} is ${rightFrag.text}`;
    return [{ text, precedence: 7 }, rightContext];
  }

  const text = `${leftFrag.text} ${op} ${rightFrag.text}`;
  return [{ text, precedence: getPrecedence(expr.operator) }, rightContext];
};

const emitLogical = (
  expr: Extract<IrExpression, { kind: "logical" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [leftFrag, leftContext] = emitExpression(expr.left, context);
  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  const text = `${leftFrag.text} ${expr.operator} ${rightFrag.text}`;
  return [{ text, precedence: getPrecedence(expr.operator) }, rightContext];
};

const emitUnary = (
  expr: Extract<IrExpression, { kind: "unary" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [operandFrag, newContext] = emitExpression(expr.expression, context);

  if (expr.operator === "typeof") {
    // typeof becomes Tsonic.Runtime.Operators.typeof()
    const updatedContext = addUsing(newContext, "Tsonic.Runtime");
    const text = `Tsonic.Runtime.Operators.@typeof(${operandFrag.text})`;
    return [{ text }, updatedContext];
  }

  if (expr.operator === "void") {
    // void expression - evaluate and discard
    const text = `(${operandFrag.text}, default)`;
    return [{ text }, newContext];
  }

  if (expr.operator === "delete") {
    // delete needs special handling
    const text = `/* delete ${operandFrag.text} */`;
    return [{ text }, newContext];
  }

  const text = `${expr.operator}${operandFrag.text}`;
  return [{ text, precedence: 15 }, newContext];
};

const emitUpdate = (
  expr: Extract<IrExpression, { kind: "update" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [operandFrag, newContext] = emitExpression(expr.expression, context);

  const text = expr.prefix
    ? `${expr.operator}${operandFrag.text}`
    : `${operandFrag.text}${expr.operator}`;

  return [{ text, precedence: 15 }, newContext];
};

const emitAssignment = (
  expr: Extract<IrExpression, { kind: "assignment" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Left side can be an expression or a pattern (for destructuring)
  let leftText: string;
  let leftContext: EmitterContext;

  if (
    "kind" in expr.left &&
    (expr.left.kind === "identifierPattern" ||
      expr.left.kind === "arrayPattern" ||
      expr.left.kind === "objectPattern")
  ) {
    // It's a pattern - for now emit a comment for destructuring
    if (expr.left.kind === "identifierPattern") {
      leftText = expr.left.name;
      leftContext = context;
    } else {
      leftText = "/* destructuring */";
      leftContext = context;
    }
  } else {
    const [leftFrag, ctx] = emitExpression(expr.left as IrExpression, context);
    leftText = leftFrag.text;
    leftContext = ctx;
  }

  const [rightFrag, rightContext] = emitExpression(expr.right, leftContext);

  const text = `${leftText} ${expr.operator} ${rightFrag.text}`;
  return [{ text, precedence: 3 }, rightContext];
};

const emitConditional = (
  expr: Extract<IrExpression, { kind: "conditional" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [condFrag, condContext] = emitExpression(expr.condition, context);
  const [trueFrag, trueContext] = emitExpression(expr.whenTrue, condContext);
  const [falseFrag, falseContext] = emitExpression(expr.whenFalse, trueContext);

  const text = `${condFrag.text} ? ${trueFrag.text} : ${falseFrag.text}`;
  return [{ text, precedence: 4 }, falseContext];
};

const emitFunctionExpression = (
  _expr: Extract<IrExpression, { kind: "functionExpression" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Function expressions need to be converted to lambdas or delegates
  // For MVP, we'll emit a placeholder
  const text = "/* function expression */";
  return [{ text }, context];
};

const emitArrowFunction = (
  expr: Extract<IrExpression, { kind: "arrowFunction" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Convert arrow function to C# lambda
  let currentContext = context;
  const paramNames: string[] = [];

  for (const param of expr.parameters) {
    if (param.pattern.kind === "identifierPattern") {
      paramNames.push(param.pattern.name);
    } else {
      paramNames.push("_");
    }
  }

  // Handle body
  let bodyText: string;
  if (typeof expr.body === "object" && "kind" in expr.body) {
    if (expr.body.kind === "blockStatement") {
      // For block statements in lambdas:
      // - In static contexts (field initializers), indent the block one level
      // - In non-static contexts (local variables), keep at same level
      const blockContext = currentContext.isStatic
        ? indent(currentContext)
        : currentContext;
      const [blockCode, newContext] = emitStatement(expr.body, blockContext);
      currentContext = { ...currentContext, usings: newContext.usings };

      const params = paramNames.join(", ");
      // The block code has proper indentation, just prepend the lambda signature
      const text = `(${params}) =>\n${blockCode}`;

      return [{ text }, currentContext];
    } else {
      const [bodyFrag, newContext] = emitExpression(expr.body, currentContext);
      currentContext = newContext;
      bodyText = bodyFrag.text;
    }
  } else {
    bodyText = "/* unknown body */";
  }

  const params = paramNames.join(", ");
  const text = `(${params}) => ${bodyText}`;
  return [{ text }, currentContext];
};

const emitTemplateLiteral = (
  expr: Extract<IrExpression, { kind: "templateLiteral" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;
  const parts: string[] = [];

  for (let i = 0; i < expr.quasis.length; i++) {
    const quasi = expr.quasis[i];
    if (quasi !== undefined && quasi !== null) {
      parts.push(quasi);
    }

    const exprAtIndex = expr.expressions[i];
    if (i < expr.expressions.length && exprAtIndex) {
      const [exprFrag, newContext] = emitExpression(
        exprAtIndex,
        currentContext
      );
      parts.push(`{${exprFrag.text}}`);
      currentContext = newContext;
    }
  }

  const text = `$"${parts.join("")}"`;
  return [{ text }, currentContext];
};

const emitSpread = (
  expr: Extract<IrExpression, { kind: "spread" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [exprFrag, newContext] = emitExpression(expr.expression, context);
  // Spread syntax needs context-specific handling
  const text = `...${exprFrag.text}`;
  return [{ text }, newContext];
};

const emitAwait = (
  expr: Extract<IrExpression, { kind: "await" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [exprFrag, newContext] = emitExpression(expr.expression, context);
  const text = `await ${exprFrag.text}`;
  return [{ text }, newContext];
};

/**
 * Get operator precedence for proper parenthesization
 */
const getPrecedence = (operator: string): number => {
  const precedences: Record<string, number> = {
    "||": 5,
    "??": 5,
    "&&": 6,
    "|": 7,
    "^": 8,
    "&": 9,
    "==": 10,
    "!=": 10,
    "===": 10,
    "!==": 10,
    "<": 11,
    ">": 11,
    "<=": 11,
    ">=": 11,
    instanceof: 11,
    in: 11,
    "<<": 12,
    ">>": 12,
    ">>>": 12,
    "+": 13,
    "-": 13,
    "*": 14,
    "/": 14,
    "%": 14,
    "**": 15,
  };

  return precedences[operator] ?? 16;
};
