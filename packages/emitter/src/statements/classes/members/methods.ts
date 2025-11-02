/**
 * Method member emission
 */

import { IrClassMember } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  dedent,
  withAsync,
  addUsing,
} from "../../../types.js";
import { emitType, emitTypeParameters } from "../../../type-emitter.js";
import { emitBlockStatement } from "../../blocks.js";
import { emitParameters } from "../parameters.js";

/**
 * Emit a method declaration
 */
export const emitMethodMember = (
  member: IrClassMember & { kind: "methodDeclaration" },
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  if (member.isStatic) {
    parts.push("static");
  }

  // Override modifier (from metadata or TS base class detection)
  if (member.isOverride) {
    parts.push("override");
  }

  if (member.isAsync) {
    parts.push("async");
    currentContext = addUsing(currentContext, "System.Threading.Tasks");
  }

  // Return type
  if (member.returnType) {
    const [returnType, newContext] = emitType(
      member.returnType,
      currentContext
    );
    currentContext = newContext;
    // If async and return type is Promise, it's already converted to Task
    // Don't wrap it again
    if (
      member.isAsync &&
      member.returnType.kind === "referenceType" &&
      member.returnType.name === "Promise"
    ) {
      parts.push(returnType); // Already Task<T> from emitType
    } else {
      parts.push(member.isAsync ? `Task<${returnType}>` : returnType);
    }
  } else {
    parts.push(member.isAsync ? "Task" : "void");
  }

  // Method name
  parts.push(member.name);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    member.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Parameters
  const params = emitParameters(member.parameters, currentContext);
  currentContext = params[1];

  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Method body
  const bodyContext = withAsync(indent(currentContext), member.isAsync);

  if (!member.body) {
    // Abstract method without body
    const signature = parts.join(" ");
    const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause};`;
    return [code, currentContext];
  }

  const [bodyCode, finalContext] = emitBlockStatement(member.body, bodyContext);

  const signature = parts.join(" ");
  const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause}\n${bodyCode}`;

  return [code, dedent(finalContext)];
};
