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
  withScoped,
} from "../../../types.js";
import { emitType, emitTypeParameters } from "../../../type-emitter.js";
import { emitBlockStatement } from "../../blocks.js";
import { emitParameters } from "../parameters.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";

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
      parts.push(
        member.isAsync
          ? `global::System.Threading.Tasks.Task<${returnType}>`
          : returnType
      );
    }
  } else {
    parts.push(member.isAsync ? "global::System.Threading.Tasks.Task" : "void");
  }

  // Method name (escape C# keywords)
  parts.push(escapeCSharpIdentifier(member.name));

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
  // Use withScoped to set typeParameters and returnType for nested expressions
  const baseBodyContext = withAsync(indent(currentContext), member.isAsync);

  if (!member.body) {
    // Abstract method without body
    const signature = parts.join(" ");
    const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause};`;
    return [code, currentContext];
  }

  // Build type parameter names set for this method (includes class type params from context)
  const methodTypeParams = new Set<string>([
    ...(currentContext.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Emit body with scoped typeParameters and returnType
  const [bodyCode, finalContext] = withScoped(
    baseBodyContext,
    {
      typeParameters: methodTypeParams,
      returnType: member.returnType,
    },
    (scopedCtx) => emitBlockStatement(member.body!, scopedCtx)
  );

  // Collect out parameters that need initialization (escape C# keywords)
  const outParams: Array<{ name: string; type: string }> = [];
  for (const param of member.parameters) {
    // Use param.passing to detect out parameters (type is already unwrapped by frontend)
    if (param.passing === "out" && param.pattern.kind === "identifierPattern") {
      // Get the type for default value
      let typeName = "object";
      if (param.type) {
        const [typeStr] = emitType(param.type, currentContext);
        typeName = typeStr;
      }
      outParams.push({
        name: escapeCSharpIdentifier(param.pattern.name),
        type: typeName,
      });
    }
  }

  // Inject out parameter initializations
  let finalBodyCode = bodyCode;
  if (outParams.length > 0) {
    const bodyInd = getIndent(baseBodyContext);
    const injectLines: string[] = [];
    for (const outParam of outParams) {
      injectLines.push(`${bodyInd}${outParam.name} = default;`);
    }

    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, ...injectLines, "");
      finalBodyCode = lines.join("\n");
    }
  }

  const signature = parts.join(" ");
  const code = `${ind}${signature}${typeParamsStr}(${params[0]})${whereClause}\n${finalBodyCode}`;

  return [code, dedent(finalContext)];
};
