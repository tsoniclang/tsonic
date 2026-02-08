/**
 * Method member emission
 */

import { IrClassMember, IrType, type IrParameter } from "@tsonic/frontend";
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
import {
  emitParametersWithDestructuring,
  generateParameterDestructuring,
} from "../parameters.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/attributes.js";
import { emitCSharpName } from "../../../naming-policy.js";

const getAsyncBodyReturnType = (
  isAsync: boolean,
  returnType: IrType | undefined
): IrType | undefined => {
  if (!isAsync || !returnType) return returnType;
  if (
    returnType.kind === "referenceType" &&
    (returnType.name === "Promise" ||
      returnType.name === "Task" ||
      returnType.name === "ValueTask") &&
    returnType.typeArguments?.length === 1
  ) {
    return returnType.typeArguments[0];
  }
  return returnType;
};

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
 * Emit a method declaration
 */
export const emitMethodMember = (
  member: IrClassMember & { kind: "methodDeclaration" },
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

  // Build method type parameter names FIRST - needed before emitting return/parameter types
  // Type parameters must be in scope before we emit types that reference them
  const methodTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create signatureContext with method type parameters in scope
  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: methodTypeParams,
  };

  // Emit the <T, U> syntax and where clauses EARLY so nullable union emission
  // can see type parameter constraint kinds when emitting return/parameter types.
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    member.typeParameters,
    signatureContext
  );
  currentContext = typeParamContext;

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  if (member.isStatic) {
    parts.push("static");
  }

  // Shadowing/hiding modifier (from metadata).
  // C# warns when a member hides a base member; emit `new` for clarity.
  if (!member.isStatic && !member.isOverride && member.isShadow) {
    parts.push("new");
  }

  // Override modifier (from metadata or TS base class detection)
  if (member.isOverride) {
    parts.push("override");
  }

  // Base method virtual (required when overridden in derived types)
  if (!member.isStatic && !member.isOverride && member.isVirtual) {
    parts.push("virtual");
  }

  if (member.isAsync) {
    parts.push("async");
  }

  // Return type - use signatureContext which has method type parameters in scope
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
  parts.push(emitCSharpName(member.name, "methods", context));

  // Parameters (with destructuring support) - use signatureContext for type parameter scope
  const paramsResult = emitParametersWithDestructuring(
    member.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Method body
  // Use withScoped to set typeParameters and returnType for nested expressions
  const baseBodyContext = seedLocalNameMapFromParameters(
    member.parameters,
    withAsync(indent(currentContext), member.isAsync)
  );

  // Generate parameter destructuring statements BEFORE emitting the body so
  // any renamed locals are visible to the body emitter via localNameMap.
  const bodyInd = getIndent(baseBodyContext);
  const [parameterDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuring(
          paramsResult.destructuringParams,
          bodyInd,
          baseBodyContext
        )
      : [[], baseBodyContext];

  if (!member.body) {
    // Abstract method without body
    // Emit attributes before the method declaration
    const [attributesCode, attrContext] = emitAttributes(
      member.attributes,
      currentContext
    );

    const signature = parts.join(" ");

    // Build final code with attributes (if any)
    const attrPrefix = attributesCode ? attributesCode + "\n" : "";
    const code = `${attrPrefix}${ind}${signature}${typeParamsStr}(${paramsResult.parameterList})${whereClause};`;
    return [code, attrContext];
  }

  // Emit body with scoped typeParameters and returnType
  // Reuse methodTypeParams defined at the top of this function
  // Note: member.body is guaranteed to exist here (early return above handles undefined case)
  const body = member.body;
  const [bodyCode, finalContext] = withScoped(
    destructuringContext,
    {
      typeParameters: methodTypeParams,
      returnType: getAsyncBodyReturnType(member.isAsync, member.returnType),
    },
    (scopedCtx) => emitBlockStatement(body, scopedCtx)
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

  // Inject destructuring and out parameter initializations
  let finalBodyCode = bodyCode;
  const injectLines: string[] = [];

  // Generate parameter destructuring statements
  if (parameterDestructuringStmts.length > 0) {
    injectLines.push(...parameterDestructuringStmts);
  }

  // Add out parameter initializations
  for (const outParam of outParams) {
    injectLines.push(`${bodyInd}${outParam.name} = default;`);
  }

  // Inject lines after opening brace
  if (injectLines.length > 0) {
    const lines = bodyCode.split("\n");
    if (lines.length > 1) {
      lines.splice(1, 0, ...injectLines, "");
      finalBodyCode = lines.join("\n");
    }
  }

  // Emit attributes before the method declaration.
  // IMPORTANT: Use method-level indentation (not body indentation).
  const methodLevelContext = dedent(finalContext);
  const [attributesCode, attrContext] = emitAttributes(
    member.attributes,
    methodLevelContext
  );

  const signature = parts.join(" ");

  // Build final code with attributes (if any)
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";
  const code = `${attrPrefix}${ind}${signature}${typeParamsStr}(${paramsResult.parameterList})${whereClause}\n${finalBodyCode}`;

  return [code, { ...attrContext, ...savedScoped }];
};
