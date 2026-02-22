/**
 * Constructor member emission
 */

import { IrClassMember, IrStatement, type IrParameter } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent, dedent } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitBlockStatement } from "../../blocks.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/attributes.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuring,
} from "../parameters.js";

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set<string>();
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      const emitted = escapeCSharpIdentifier(p.pattern.name);
      map.set(p.pattern.name, emitted);
      used.add(emitted);
    }
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

/**
 * Emit a constructor declaration
 */
export const emitConstructorMember = (
  member: IrClassMember & { kind: "constructorDeclaration" },
  context: EmitterContext
): [string, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
    usedLocalNames: context.usedLocalNames,
  };

  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Emit attributes before the constructor declaration
  const [attributesCode, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";

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
  currentContext = seedLocalNameMapFromParameters(
    member.parameters,
    currentContext
  );

  // Constructor body
  if (!member.body) {
    // Abstract or interface constructor without body
    const signature = parts.join(" ");
    const code = `${attrPrefix}${ind}${signature}(${paramsResult.parameterList});`;
    return [code, { ...currentContext, ...savedScoped }];
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
    throw new Error(
      "Unsupported constructor semantics: super() must be the first statement to preserve JavaScript initialization order."
    );
  }

  // Emit body without the super() call
  let bodyContext = indent(currentContext);
  const modifiedBody: typeof member.body = {
    ...member.body,
    statements: bodyStatements,
  };

  // Generate parameter destructuring statements BEFORE emitting the body so
  // any renamed locals are visible to the body emitter via localNameMap.
  const bodyInd = getIndent(bodyContext);
  const [parameterDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuring(
          paramsResult.destructuringParams,
          bodyInd,
          bodyContext
        )
      : [[], bodyContext];
  bodyContext = destructuringContext;

  const [bodyCode, finalContext] = emitBlockStatement(
    modifiedBody,
    bodyContext
  );

  // Inject parameter destructuring statements at the start of the body
  let finalBodyCode = bodyCode;
  if (parameterDestructuringStmts.length > 0) {
    const destructuringStmts = parameterDestructuringStmts;

    // Inject lines after opening brace
    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, ...destructuringStmts, "");
      finalBodyCode = lines.join("\n");
    }
  }

  const signature = parts.join(" ");
  const code = `${attrPrefix}${ind}${signature}(${paramsResult.parameterList})${baseCall}\n${finalBodyCode}`;

  const returnedContext = dedent(finalContext);
  return [code, { ...returnedContext, ...savedScoped }];
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
