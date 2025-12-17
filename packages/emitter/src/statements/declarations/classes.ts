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
import { emitAttributes } from "../../core/attributes.js";

/**
 * Emit a class declaration
 */
export const emitClassDeclaration = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const parts: string[] = [];

  // Build type parameter names set FIRST - needed when emitting superclass, implements, and members
  // Type parameters must be in scope before we emit types that reference them
  const classTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: classTypeParams,
  };

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
  // classTypeParams was already built at the start of this function and is already in currentContext
  const bodyContext: EmitterContext = {
    ...baseContext,
    hasSuperClass: stmt.superClass ? true : undefined,
    // typeParameters is inherited from currentContext via baseContext
  };
  const members: string[] = [];

  for (const member of stmt.members) {
    const [memberCode, newContext] = emitClassMember(member, bodyContext);
    members.push(memberCode);
    currentContext = newContext;
  }

  // Emit attributes before the class declaration
  // Use original context (not the one after processing members) for correct indentation
  const [attributesCode] = emitAttributes(stmt.attributes, context);

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");

  // Build final code with attributes (if any)
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";
  const code = `${attrPrefix}${ind}${signature}${typeParamsStr}${heritageStr}${whereClause}\n${ind}{\n${memberCode}\n${ind}}`;

  return [code, currentContext];
};
