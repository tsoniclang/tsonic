/**
 * Expression Emitter - IR expressions to C# code
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "./types.js";

/**
 * Emit a C# expression from an IR expression
 */
export const emitExpression = (
  expr: IrExpression,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  switch (expr.kind) {
    case "literal":
      return emitLiteral(expr, context);

    case "identifier":
      return emitIdentifier(expr, context);

    case "array":
      return emitArray(expr, context);

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
    // All numbers are doubles in JavaScript
    const text = Number.isInteger(value) ? `${value}.0` : String(value);
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
  // Map JavaScript global identifiers to C# equivalents
  const identifierMap: Record<string, string> = {
    console: "console",
    Math: "Math",
    JSON: "JSON",
    undefined: "default",
  };

  const mapped = identifierMap[expr.name] ?? expr.name;
  return [{ text: mapped }, context];
};

const emitArray = (
  expr: Extract<IrExpression, { kind: "array" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = addUsing(context, "Tsonic.Runtime");
  const elements: string[] = [];

  for (const element of expr.elements) {
    if (element === undefined) {
      // Sparse array hole
      elements.push("default");
    } else if (element.kind === "spread") {
      // Spread in array literal - needs special handling
      // For MVP, we'll add a comment
      elements.push("/* ...spread */");
    } else {
      const [elemFrag, newContext] = emitExpression(element, currentContext);
      elements.push(elemFrag.text);
      currentContext = newContext;
    }
  }

  // Infer element type from first non-null element or default to object
  const elementType = expr.elements.length > 0 ? "object" : "object";
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
    const [propFrag, finalContext] = emitExpression(
      expr.property as IrExpression,
      newContext
    );
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
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

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
  const text = `${calleeFrag.text}${callOp}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

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

  const text = `new ${calleeFrag.text}(${args.join(", ")})`;
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
    // typeof needs special handling in C#
    const text = `${operandFrag.text}.GetType().Name`;
    return [{ text }, newContext];
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

  // Handle body - for MVP, simplified handling
  let bodyText: string;
  if (typeof expr.body === "object" && "kind" in expr.body) {
    if (expr.body.kind === "blockStatement") {
      // For block statements in lambdas, we need full syntax
      bodyText = "{ /* TODO: block statement */ }";
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
