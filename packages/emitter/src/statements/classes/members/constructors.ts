/**
 * Constructor member emission
 */

import { IrClassMember, IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitBlockStatement } from "../../blocks.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuring,
} from "../parameters.js";

/**
 * Emit a constructor declaration
 */
export const emitConstructorMember = (
  member: IrClassMember & { kind: "constructorDeclaration" },
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  // Constructor name (same as class name)
  const constructorName = context.className ?? "UnknownClass";
  parts.push(constructorName);

  // Parameters (with destructuring support)
  const paramsResult = emitParametersWithDestructuring(
    member.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  // Constructor body
  if (!member.body) {
    // Abstract or interface constructor without body
    const signature = parts.join(" ");
    const code = `${ind}${signature}(${paramsResult.parameterList});`;
    return [code, currentContext];
  }

  // Check for super() call - MUST be the first statement if present
  // C# base() calls execute before the constructor body, so we can't preserve
  // TypeScript semantics if there are statements before super()
  const [baseCall, bodyStatements, baseCallContext] = extractSuperCall(
    member.body.statements,
    currentContext
  );
  currentContext = baseCallContext;

  // Check if super() appears later in the body (not supported)
  const hasLaterSuperCall = bodyStatements.some(
    (stmt) =>
      stmt.kind === "expressionStatement" &&
      stmt.expression.kind === "call" &&
      stmt.expression.callee.kind === "identifier" &&
      stmt.expression.callee.name === "super"
  );

  if (hasLaterSuperCall) {
    // TODO: This should be a compile error in the IR builder
    // For now, emit a comment noting the issue
    const signature = parts.join(" ");
    const errorComment = `${ind}// ERROR: super() must be the first statement in constructor`;
    const code = `${errorComment}\n${ind}${signature}(${paramsResult.parameterList})\n${ind}{\n${ind}    // Constructor body omitted due to error\n${ind}}`;
    return [code, currentContext];
  }

  // Emit body without the super() call
  const bodyContext = indent(currentContext);
  const modifiedBody: typeof member.body = {
    ...member.body,
    statements: bodyStatements,
  };
  const [bodyCode, finalContext] = emitBlockStatement(
    modifiedBody,
    bodyContext
  );

  // Inject parameter destructuring statements at the start of the body
  let finalBodyCode = bodyCode;
  if (paramsResult.destructuringParams.length > 0) {
    const bodyInd = getIndent(bodyContext);
    const [destructuringStmts] = generateParameterDestructuring(
      paramsResult.destructuringParams,
      bodyInd,
      finalContext
    );

    // Inject lines after opening brace
    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, ...destructuringStmts, "");
      finalBodyCode = lines.join("\n");
    }
  }

  const signature = parts.join(" ");
  const code = `${ind}${signature}(${paramsResult.parameterList})${baseCall}\n${finalBodyCode}`;

  return [code, dedent(finalContext)];
};

/**
 * Extract super() call from first statement if present
 * Returns [baseCall, remainingStatements, context]
 */
const extractSuperCall = (
  statements: readonly IrStatement[],
  context: EmitterContext
): [string, readonly IrStatement[], EmitterContext] => {
  let currentContext = context;

  if (statements.length === 0) {
    return ["", statements, currentContext];
  }

  const firstStmt = statements[0];
  if (
    firstStmt &&
    firstStmt.kind === "expressionStatement" &&
    firstStmt.expression.kind === "call" &&
    firstStmt.expression.callee.kind === "identifier" &&
    firstStmt.expression.callee.name === "super"
  ) {
    // Found super() call as first statement - convert to : base(...)
    const superCall = firstStmt.expression;
    const argFrags: string[] = [];
    for (const arg of superCall.arguments) {
      const [argFrag, newContext] = emitExpression(arg, currentContext);
      argFrags.push(argFrag.text);
      currentContext = newContext;
    }
    const baseCall = ` : base(${argFrags.join(", ")})`;
    // Remove super() call from body statements
    const remainingStatements = statements.slice(1);
    return [baseCall, remainingStatements, currentContext];
  }

  return ["", statements, currentContext];
};
