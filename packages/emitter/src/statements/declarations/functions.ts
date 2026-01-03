/**
 * Function declaration emission
 */

import { IrStatement, type IrParameter } from "@tsonic/frontend";
import {
  EmitterContext,
  getIndent,
  indent,
  withAsync,
  withStatic,
  withScoped,
} from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { emitBlockStatement } from "../blocks.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuring,
} from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
} from "../../generator-wrapper.js";
import { emitAttributes } from "../../core/attributes.js";

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      map.set(p.pattern.name, escapeCSharpIdentifier(p.pattern.name));
    }
  }
  return { ...context, localNameMap: map };
};

/**
 * Emit a function declaration
 */
export const emitFunctionDeclaration = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const parts: string[] = [];

  // Build type parameter names set FIRST - needed when emitting return type and parameters
  // Type parameters must be in scope before we emit types that reference them
  const funcTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope for signature emission
  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: funcTypeParams,
  };

  // Emit the <T, U> syntax and where clauses EARLY so nullable union emission
  // can see type parameter constraint kinds when emitting return/parameter types.
  const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    signatureContext
  );
  let currentContext = typeParamContext;

  // Access modifiers
  const accessibility = stmt.isExported ? "public" : "private";
  parts.push(accessibility);

  if (context.isStatic) {
    parts.push("static");
  }

  if (stmt.isAsync && !stmt.isGenerator) {
    parts.push("async");
  }

  // Check if this is a bidirectional generator (has TNext type)
  const isBidirectional = needsBidirectionalSupport(stmt);

  // Return type
  if (stmt.isGenerator) {
    if (isBidirectional) {
      // Bidirectional generators return the wrapper class
      const wrapperName = `${stmt.name}_Generator`;
      parts.push(wrapperName);
    } else {
      // Unidirectional generators return IEnumerable<exchange> or IAsyncEnumerable<exchange>
      const exchangeName = `${stmt.name}_exchange`;
      if (stmt.isAsync) {
        parts.push(
          `async global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
        );
      } else {
        parts.push(
          `global::System.Collections.Generic.IEnumerable<${exchangeName}>`
        );
      }
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
      parts.push(
        stmt.isAsync
          ? `global::System.Threading.Tasks.Task<${returnType}>`
          : returnType
      );
    }
  } else {
    parts.push(stmt.isAsync ? "global::System.Threading.Tasks.Task" : "void");
  }

  // Function name
  parts.push(escapeCSharpIdentifier(stmt.name));

  // Parameters (with destructuring support)
  const paramsResult = emitParametersWithDestructuring(
    stmt.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  // Function body (not a static context - local variables)
  // Use withScoped to set typeParameters and returnType for nested expressions
  const baseBodyContext = seedLocalNameMapFromParameters(
    stmt.parameters,
    withAsync(withStatic(indent(currentContext), false), stmt.isAsync)
  );

  // Emit body with scoped typeParameters and returnType
  // funcTypeParams was already built at the start of this function
  const [bodyCode] = withScoped(
    baseBodyContext,
    {
      typeParameters: funcTypeParams,
      returnType: stmt.returnType,
    },
    (scopedCtx) => emitBlockStatement(stmt.body, scopedCtx)
  );

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
      outParams.push({
        name: escapeCSharpIdentifier(param.pattern.name),
        type: typeName,
      });
    }
  }

  // Inject initialization code for generators, out parameters, and destructuring
  let finalBodyCode = bodyCode;
  const bodyInd = getIndent(baseBodyContext);
  const injectLines: string[] = [];

  // Generate parameter destructuring statements
  if (paramsResult.destructuringParams.length > 0) {
    const [destructuringStmts, newCtx] = generateParameterDestructuring(
      paramsResult.destructuringParams,
      bodyInd,
      currentContext
    );
    currentContext = newCtx;
    injectLines.push(...destructuringStmts);
  }

  // Handle bidirectional generators specially
  if (stmt.isGenerator && isBidirectional) {
    const exchangeName = `${stmt.name}_exchange`;
    const wrapperName = `${stmt.name}_Generator`;
    const enumerableType = stmt.isAsync
      ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
      : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;
    const asyncModifier = stmt.isAsync ? "async " : "";

    // Check if generator has a return type (TReturn is not void/undefined)
    const hasReturnType = hasGeneratorReturnType(stmt);

    // Extract return type for __returnValue variable
    let returnTypeStr = "object";
    if (hasReturnType) {
      const {
        returnType: extractedReturnType,
        newContext: typeExtractContext,
      } = extractGeneratorTypeArgs(stmt.returnType, currentContext);
      currentContext = typeExtractContext;
      returnTypeStr = extractedReturnType;
    }

    // Build the body with local iterator function
    const iteratorBody = bodyCode
      .split("\n")
      .slice(1, -1) // Remove opening and closing braces
      .map((line) => `    ${line}`) // Add extra indent
      .join("\n");

    // Construct the bidirectional generator body
    const bodyLines = [
      `${ind}{`,
      `${bodyInd}var exchange = new ${exchangeName}();`,
    ];

    // Add __returnValue capture if TReturn is not void
    if (hasReturnType) {
      bodyLines.push(`${bodyInd}${returnTypeStr} __returnValue = default!;`);
    }

    bodyLines.push(``);
    bodyLines.push(`${bodyInd}${asyncModifier}${enumerableType} __iterator()`);
    bodyLines.push(`${bodyInd}{`);
    bodyLines.push(iteratorBody);
    bodyLines.push(`${bodyInd}}`);
    bodyLines.push(``);

    // Wrapper constructor call - pass return value getter if needed
    if (hasReturnType) {
      bodyLines.push(
        `${bodyInd}return new ${wrapperName}(__iterator(), exchange, () => __returnValue);`
      );
    } else {
      bodyLines.push(
        `${bodyInd}return new ${wrapperName}(__iterator(), exchange);`
      );
    }

    bodyLines.push(`${ind}}`);

    finalBodyCode = bodyLines.join("\n");
  } else {
    // Add generator exchange initialization for unidirectional generators
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
  }

  // Emit attributes before the function declaration
  const [attributesCode, attrContext] = emitAttributes(
    stmt.attributes,
    currentContext
  );
  currentContext = attrContext;

  const signature = parts.join(" ");
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Build final code with attributes (if any)
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";
  const code = `${attrPrefix}${ind}${signature}${typeParamsStr}(${paramsResult.parameterList})${whereClause}\n${finalBodyCode}`;

  // Return context - no usings tracking needed with global:: FQN approach
  return [code, currentContext];
};
