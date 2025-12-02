/**
 * Class declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withClassName,
} from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { emitClassMember } from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

/**
 * Emit a class declaration
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "internal";
  parts.push(accessibility);

  // Emit struct or class based on isStruct flag (escape C# keywords)
  parts.push(stmt.isStruct ? "struct" : "class");
  const escapedClassName = escapeCSharpIdentifier(stmt.name);
  parts.push(escapedClassName);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Base class and interfaces
  const heritage: string[] = [];

  // Handle superclass (extends clause)
  if (stmt.superClass) {
    const [superClassFrag, newContext] = emitExpression(
      stmt.superClass,
      currentContext
    );
    currentContext = newContext;
    heritage.push(superClassFrag.text);
  }

  // Handle interfaces (implements clause)
  if (stmt.implements && stmt.implements.length > 0) {
    for (const iface of stmt.implements) {
      const [ifaceType, newContext] = emitType(iface, currentContext);
      currentContext = newContext;
      heritage.push(ifaceType);
    }
  }

  const heritageStr = heritage.length > 0 ? ` : ${heritage.join(", ")}` : "";
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Class body (use escaped class name)
  const baseContext = withClassName(indent(currentContext), escapedClassName);
  // Only set hasSuperClass flag if there's actually a superclass (for inheritance)
  const bodyContext = stmt.superClass
    ? { ...baseContext, hasSuperClass: true }
    : baseContext;
  const members: string[] = [];

  for (const member of stmt.members) {
    const [memberCode, newContext] = emitClassMember(member, bodyContext);
    members.push(memberCode);
    currentContext = newContext;
  }

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");
  const code = `${ind}${signature}${typeParamsStr}${heritageStr}${whereClause}\n${ind}{\n${memberCode}\n${ind}}`;

  return [code, currentContext];
};
