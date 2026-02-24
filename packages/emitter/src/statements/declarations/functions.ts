/**
 * Function declaration emission
 */

import { IrStatement, IrType, type IrParameter } from "@tsonic/frontend";
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
import { emitAttributes } from "../../core/format/attributes.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import { allocateLocalName } from "../../core/format/local-names.js";

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
 * Emit a function declaration
 */
export const emitFunctionDeclaration = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
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
  const parts: string[] = [];
  const csharpBaseName = getCSharpName(stmt.name, "methods", context);

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
  //
  // Top-level (module) functions are emitted as static methods on the module's
  // container class. When a module also has namespace-level declarations
  // (classes/interfaces/enums), those types must still be able to call module-local
  // helpers. `private` would make them inaccessible, so use `internal` for
  // non-exported module functions.
  const accessibility = stmt.isExported
    ? "public"
    : context.isStatic
      ? "internal"
      : "private";
  parts.push(accessibility);

  if (context.isStatic) {
    parts.push("static");
  }

  if (stmt.isAsync && !stmt.isGenerator) {
    parts.push("async");
  }

  // Check if this is a bidirectional generator (has TNext type)
  const isBidirectional = needsBidirectionalSupport(stmt);
  const generatorHasReturnType =
    stmt.isGenerator && isBidirectional ? hasGeneratorReturnType(stmt) : false;

  // Return type
  if (stmt.isGenerator) {
    if (isBidirectional) {
      // Bidirectional generators return the wrapper class
      const wrapperName = `${csharpBaseName}_Generator`;
      parts.push(wrapperName);
    } else {
      // Unidirectional generators return IEnumerable<exchange> or IAsyncEnumerable<exchange>
      const exchangeName = `${csharpBaseName}_exchange`;
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
  parts.push(emitCSharpName(stmt.name, "methods", context));

  // Parameters (with destructuring support)
  const paramsResult = emitParametersWithDestructuring(
    stmt.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  // Function body (not a static context - local variables)
  // Use withScoped to set typeParameters and returnType for nested expressions
  let baseBodyContext = seedLocalNameMapFromParameters(
    stmt.parameters,
    withAsync(withStatic(indent(currentContext), false), stmt.isAsync)
  );

  // Reserve generator-internal locals BEFORE emitting the body so user locals can safely
  // use these names (and get deterministically renamed) without colliding in C#.
  let generatorExchangeVar = "exchange";
  let generatorIteratorFn = "__iterator";
  let generatorReturnValueVar = "__returnValue";
  if (stmt.isGenerator) {
    const exchangeAlloc = allocateLocalName(
      generatorExchangeVar,
      baseBodyContext
    );
    generatorExchangeVar = exchangeAlloc.emittedName;
    baseBodyContext = {
      ...exchangeAlloc.context,
      generatorExchangeVar,
    };

    if (isBidirectional) {
      const iterAlloc = allocateLocalName(generatorIteratorFn, baseBodyContext);
      generatorIteratorFn = iterAlloc.emittedName;
      baseBodyContext = iterAlloc.context;

      if (generatorHasReturnType) {
        const retAlloc = allocateLocalName(
          generatorReturnValueVar,
          baseBodyContext
        );
        generatorReturnValueVar = retAlloc.emittedName;
        baseBodyContext = {
          ...retAlloc.context,
          generatorReturnValueVar,
        };
      }
    }
  }

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

  // Emit body with scoped typeParameters and returnType
  // funcTypeParams was already built at the start of this function
  const [bodyCode] = withScoped(
    destructuringContext,
    {
      typeParameters: funcTypeParams,
      returnType:
        stmt.isAsync && !stmt.isGenerator
          ? getAsyncBodyReturnType(stmt.isAsync, stmt.returnType)
          : stmt.returnType,
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
  const injectLines: string[] = [];

  // Generate parameter destructuring statements
  if (parameterDestructuringStmts.length > 0) {
    injectLines.push(...parameterDestructuringStmts);
  }

  // Handle bidirectional generators specially
  if (stmt.isGenerator && isBidirectional) {
    const exchangeName = `${csharpBaseName}_exchange`;
    const wrapperName = `${csharpBaseName}_Generator`;
    const enumerableType = stmt.isAsync
      ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
      : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;
    const asyncModifier = stmt.isAsync ? "async " : "";

    // generatorHasReturnType was computed earlier so we can reserve locals before body emission.
    const hasReturnType = generatorHasReturnType;

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
      `${bodyInd}var ${generatorExchangeVar} = new ${exchangeName}();`,
    ];

    // Add __returnValue capture if TReturn is not void
    if (hasReturnType) {
      bodyLines.push(
        `${bodyInd}${returnTypeStr} ${generatorReturnValueVar} = default!;`
      );
    }

    bodyLines.push(``);
    bodyLines.push(
      `${bodyInd}${asyncModifier}${enumerableType} ${generatorIteratorFn}()`
    );
    bodyLines.push(`${bodyInd}{`);
    bodyLines.push(iteratorBody);
    bodyLines.push(`${bodyInd}}`);
    bodyLines.push(``);

    // Wrapper constructor call - pass return value getter if needed
    if (hasReturnType) {
      bodyLines.push(
        `${bodyInd}return new ${wrapperName}(${generatorIteratorFn}(), ${generatorExchangeVar}, () => ${generatorReturnValueVar});`
      );
    } else {
      bodyLines.push(
        `${bodyInd}return new ${wrapperName}(${generatorIteratorFn}(), ${generatorExchangeVar});`
      );
    }

    bodyLines.push(`${ind}}`);

    finalBodyCode = bodyLines.join("\n");
  } else {
    // Add generator exchange initialization for unidirectional generators
    if (stmt.isGenerator) {
      const exchangeName = `${csharpBaseName}_exchange`;
      injectLines.push(
        `${bodyInd}var ${generatorExchangeVar} = new ${exchangeName}();`
      );
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
  return [code, { ...currentContext, ...savedScoped }];
};
