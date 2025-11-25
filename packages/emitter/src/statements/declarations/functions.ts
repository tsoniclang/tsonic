/**
 * Function declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withAsync,
  withStatic,
  addUsing,
} from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { emitBlockStatement } from "../blocks.js";
import { emitParameters } from "../classes.js";

/**
 * Emit a function declaration
 */
export const emitFunctionDeclaration = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "private";
  parts.push(accessibility);

  if (context.isStatic) {
    parts.push("static");
  }

  if (stmt.isAsync && !stmt.isGenerator) {
    parts.push("async");
    currentContext = addUsing(currentContext, "System.Threading.Tasks");
  }

  // Return type
  if (stmt.isGenerator) {
    // Generator functions return IEnumerable<exchange> or IAsyncEnumerable<exchange>
    const exchangeName = `${stmt.name}_exchange`;
    if (stmt.isAsync) {
      parts.push(`async IAsyncEnumerable<${exchangeName}>`);
      currentContext = addUsing(currentContext, "System.Collections.Generic");
    } else {
      parts.push(`IEnumerable<${exchangeName}>`);
      currentContext = addUsing(currentContext, "System.Collections.Generic");
    }
  } else if (stmt.returnType) {
    const [returnType, newContext] = emitType(stmt.returnType, currentContext);
    currentContext = newContext;
    // If async and return type is Promise, it's already converted to Task
    // Don't wrap it again
    if (
      stmt.isAsync &&
      stmt.returnType.kind === "referenceType" &&
      stmt.returnType.name === "Promise"
    ) {
      parts.push(returnType); // Already Task<T> from emitType
    } else {
      parts.push(stmt.isAsync ? `Task<${returnType}>` : returnType);
    }
  } else {
    parts.push(stmt.isAsync ? "Task" : "void");
  }

  // Function name
  parts.push(stmt.name);

  // Type parameters
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  // Parameters
  const params = emitParameters(stmt.parameters, currentContext);
  currentContext = params[1];

  // Function body (not a static context - local variables)
  const bodyContext = withAsync(
    withStatic(indent(currentContext), false),
    stmt.isAsync
  );
  const [bodyCode, finalContext] = emitBlockStatement(stmt.body, bodyContext);

  // Collect out parameters that need initialization
  const outParams: Array<{ name: string; type: string }> = [];
  for (const param of stmt.parameters) {
    // Use param.passing to detect out parameters (type is already unwrapped by frontend)
    if (param.passing === "out" && param.pattern.kind === "identifierPattern") {
      // Get the type for default value
      let typeName = "object";
      if (param.type) {
        const [typeStr] = emitType(param.type, currentContext);
        typeName = typeStr;
      }
      outParams.push({ name: param.pattern.name, type: typeName });
    }
  }

  // Inject initialization code for generators and out parameters
  let finalBodyCode = bodyCode;
  const bodyInd = getIndent(bodyContext);
  const injectLines: string[] = [];

  // Add generator exchange initialization
  if (stmt.isGenerator) {
    const exchangeName = `${stmt.name}_exchange`;
    injectLines.push(`${bodyInd}var exchange = new ${exchangeName}();`);
  }

  // Add out parameter initializations
  if (outParams.length > 0) {
    for (const outParam of outParams) {
      injectLines.push(`${bodyInd}${outParam.name} = default;`);
    }
  }

  // Inject lines after opening brace
  if (injectLines.length > 0) {
    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, ...injectLines, "");
      finalBodyCode = lines.join("\n");
    }
  }

  const signature = parts.join(" ");
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";
  const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause}\n${finalBodyCode}`;

  // Return context preserving usings from body but keeping original context flags
  return [code, { ...currentContext, usings: finalContext.usings }];
};
