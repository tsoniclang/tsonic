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
import { emitTypeAst, emitTypeParameters } from "../../type-emitter.js";
import {
  printType,
  printAttributes,
  printParameter,
} from "../../core/format/backend-ast/printer.js";
import { emitBlockStatement, emitBlockStatementAst } from "../blocks.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuring,
} from "../classes.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { lowerPatternAst } from "../../patterns.js";
import {
  needsBidirectionalSupport,
  hasGeneratorReturnType,
  extractGeneratorTypeArgs,
} from "../../generator-wrapper.js";
import { emitAttributes } from "../../core/format/attributes.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import { allocateLocalName } from "../../core/format/local-names.js";
import type {
  CSharpStatementAst,
  CSharpParameterAst,
  CSharpTypeAst,
  CSharpExpressionAst,
} from "../../core/format/backend-ast/types.js";

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
    const [returnTypeAst, newContext] = emitTypeAst(
      stmt.returnType,
      currentContext
    );
    const returnType = printType(returnTypeAst);
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
        const [typeAst] = emitTypeAst(param.type, currentContext);
        typeName = printType(typeAst);
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
  const [attrs, attrContext] = emitAttributes(stmt.attributes, currentContext);
  currentContext = attrContext;

  const signature = parts.join(" ");
  const whereClause =
    whereClauses.length > 0
      ? `\n${ind}    ${whereClauses.join(`\n${ind}    `)}`
      : "";

  // Build final code with attributes (if any)
  const attrPrefix = attrs.length > 0 ? printAttributes(attrs, ind) : "";
  const code = `${attrPrefix}${ind}${signature}${typeParamsStr}(${paramsResult.parameters.map(printParameter).join(", ")})${whereClause}\n${finalBodyCode}`;

  // Return context - no usings tracking needed with global:: FQN approach
  return [code, { ...currentContext, ...savedScoped }];
};

/**
 * Build CSharpParameterAst[] from IR parameters.
 * For complex patterns (array/object), generates synthetic parameter names
 * and returns destructuring info.
 */
type DestructuringParamInfo = {
  readonly syntheticName: string;
  readonly pattern: IrParameter["pattern"];
  readonly type: IrType | undefined;
};

const buildParameterAsts = (
  parameters: readonly IrParameter[],
  context: EmitterContext
): {
  readonly paramAsts: readonly CSharpParameterAst[];
  readonly destructuringParams: readonly DestructuringParamInfo[];
  readonly context: EmitterContext;
} => {
  let currentCtx = context;
  const paramAsts: CSharpParameterAst[] = [];
  const destructuringParams: DestructuringParamInfo[] = [];
  let syntheticIndex = 0;

  for (const param of parameters) {
    // Type
    let typeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };
    if (param.type) {
      const [t, c] = emitTypeAst(param.type, currentCtx);
      typeAst = t;
      currentCtx = c;
    }

    // Optional: make nullable
    if (param.isOptional) {
      typeAst = { kind: "nullableType", underlyingType: typeAst };
    }

    // Name
    let name: string;
    const isComplexPattern =
      param.pattern.kind === "arrayPattern" ||
      param.pattern.kind === "objectPattern";

    if (isComplexPattern) {
      name = `__param${syntheticIndex}`;
      syntheticIndex++;
      destructuringParams.push({
        syntheticName: name,
        pattern: param.pattern,
        type: param.type,
      });
    } else if (param.pattern.kind === "identifierPattern") {
      name = escapeCSharpIdentifier(param.pattern.name);
    } else {
      name = "param";
    }

    // Modifiers
    const modifiers: string[] = [];
    if (param.isExtensionReceiver) modifiers.push("this");
    if (param.passing !== "value") modifiers.push(param.passing);

    // Default value
    let defaultValue: CSharpExpressionAst | undefined;
    if (param.initializer) {
      const [ast, c] = emitExpressionAst(param.initializer, currentCtx);
      defaultValue = ast;
      currentCtx = c;
    } else if (param.isOptional && !param.isRest) {
      defaultValue = { kind: "defaultExpression" };
    }

    paramAsts.push({
      name,
      type: typeAst,
      defaultValue,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
    });
  }

  return { paramAsts, destructuringParams, context: currentCtx };
};

/**
 * Generate parameter destructuring as AST statements.
 */
const generateParameterDestructuringAst = (
  destructuringParams: readonly DestructuringParamInfo[],
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const info of destructuringParams) {
    const inputExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: info.syntheticName,
    };
    const result = lowerPatternAst(
      info.pattern,
      inputExpr,
      info.type,
      currentContext
    );
    statements.push(...result.statements);
    currentContext = result.context;
  }

  return [statements, currentContext];
};

/**
 * Emit a local (non-static) function declaration as AST.
 *
 * Returns CSharpLocalFunctionStatementAst for regular functions.
 * For generators, builds exchange initialization and wrapper structures.
 *
 * Static function declarations (module-level methods) are handled by
 * the text-based emitFunctionDeclaration above.
 */
export const emitFunctionDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "functionDeclaration" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
    usedLocalNames: context.usedLocalNames,
  };

  const csharpBaseName = getCSharpName(stmt.name, "methods", context);
  const emittedName = emitCSharpName(stmt.name, "methods", context);

  // Build type parameter names set
  const funcTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: funcTypeParams,
  };

  // Emit type parameters (still text-based for where clauses)
  const [_typeParamsStr, _whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    signatureContext
  );
  let currentContext = typeParamContext;

  // Type parameter names for AST
  const typeParamNames: string[] | undefined =
    stmt.typeParameters && stmt.typeParameters.length > 0
      ? stmt.typeParameters.map(
          (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
        )
      : undefined;

  // Check generator features
  const isBidirectional = needsBidirectionalSupport(stmt);
  const generatorHasReturnType =
    stmt.isGenerator && isBidirectional ? hasGeneratorReturnType(stmt) : false;

  // Modifiers
  const modifiers: string[] = [];
  if (stmt.isAsync && !stmt.isGenerator) {
    modifiers.push("async");
  }

  // Return type AST
  let returnTypeAst: CSharpTypeAst;
  if (stmt.isGenerator) {
    if (isBidirectional) {
      const wrapperName = `${csharpBaseName}_Generator`;
      returnTypeAst = { kind: "identifierType", name: wrapperName };
    } else {
      const exchangeName = `${csharpBaseName}_exchange`;
      if (stmt.isAsync) {
        modifiers.push("async");
        returnTypeAst = {
          kind: "identifierType",
          name: "global::System.Collections.Generic.IAsyncEnumerable",
          typeArguments: [{ kind: "identifierType", name: exchangeName }],
        };
      } else {
        returnTypeAst = {
          kind: "identifierType",
          name: "global::System.Collections.Generic.IEnumerable",
          typeArguments: [{ kind: "identifierType", name: exchangeName }],
        };
      }
    }
  } else if (stmt.returnType) {
    const [retAst, retCtx] = emitTypeAst(stmt.returnType, currentContext);
    currentContext = retCtx;
    if (
      stmt.isAsync &&
      stmt.returnType.kind === "referenceType" &&
      stmt.returnType.name === "Promise"
    ) {
      returnTypeAst = retAst; // Already Task<T> from emitTypeAst
    } else if (stmt.isAsync) {
      returnTypeAst = {
        kind: "identifierType",
        name: "global::System.Threading.Tasks.Task",
        typeArguments: [retAst],
      };
    } else {
      returnTypeAst = retAst;
    }
  } else {
    returnTypeAst = stmt.isAsync
      ? { kind: "identifierType", name: "global::System.Threading.Tasks.Task" }
      : { kind: "identifierType", name: "void" };
  }

  // Parameters as AST
  const paramsResult = buildParameterAsts(stmt.parameters, currentContext);
  currentContext = paramsResult.context;

  // Body context setup
  let baseBodyContext = seedLocalNameMapFromParameters(
    stmt.parameters,
    withAsync(withStatic(currentContext, false), stmt.isAsync)
  );

  // Reserve generator-internal locals
  let generatorExchangeVar = "exchange";
  let generatorIteratorFn = "__iterator";
  let generatorReturnValueVar = "__returnValue";
  if (stmt.isGenerator) {
    const exchangeAlloc = allocateLocalName(
      generatorExchangeVar,
      baseBodyContext
    );
    generatorExchangeVar = exchangeAlloc.emittedName;
    baseBodyContext = { ...exchangeAlloc.context, generatorExchangeVar };

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
        baseBodyContext = { ...retAlloc.context, generatorReturnValueVar };
      }
    }
  }

  // Generate parameter destructuring as AST
  const [paramDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuringAst(
          paramsResult.destructuringParams,
          baseBodyContext
        )
      : [[] as readonly CSharpStatementAst[], baseBodyContext];

  // Emit body as AST with scoped typeParameters and returnType
  const bodyReturnType =
    stmt.isAsync && !stmt.isGenerator
      ? getAsyncBodyReturnType(stmt.isAsync, stmt.returnType)
      : stmt.returnType;

  const bodyContext: EmitterContext = {
    ...destructuringContext,
    typeParameters: funcTypeParams,
    returnType: bodyReturnType,
  };

  const [bodyBlock, bodyCtxAfter] = emitBlockStatementAst(
    stmt.body,
    bodyContext
  );

  // Build final body with injected statements
  if (stmt.isGenerator && isBidirectional) {
    // Bidirectional generator: build wrapper body structure
    const exchangeName = `${csharpBaseName}_exchange`;
    const wrapperName = `${csharpBaseName}_Generator`;
    const enumerableType: CSharpTypeAst = stmt.isAsync
      ? {
          kind: "identifierType",
          name: "global::System.Collections.Generic.IAsyncEnumerable",
          typeArguments: [{ kind: "identifierType", name: exchangeName }],
        }
      : {
          kind: "identifierType",
          name: "global::System.Collections.Generic.IEnumerable",
          typeArguments: [{ kind: "identifierType", name: exchangeName }],
        };

    const wrapperBodyStatements: CSharpStatementAst[] = [];

    // var exchange = new ExchangeName();
    wrapperBodyStatements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: { kind: "identifierType", name: exchangeName },
            arguments: [],
          },
        },
      ],
    });

    // TReturn __returnValue = default!; (if has return type)
    if (generatorHasReturnType) {
      const {
        returnType: extractedReturnType,
        newContext: typeExtractContext,
      } = extractGeneratorTypeArgs(stmt.returnType, currentContext);
      currentContext = typeExtractContext;

      wrapperBodyStatements.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "identifierType", name: extractedReturnType },
        declarators: [
          {
            name: generatorReturnValueVar,
            initializer: {
              kind: "suppressNullableWarningExpression",
              expression: { kind: "defaultExpression" },
            },
          },
        ],
      });
    }

    // Inner local function __iterator() with original body + exchange init
    const innerBodyStatements: CSharpStatementAst[] = [
      ...paramDestructuringStmts,
      ...bodyBlock.statements,
    ];

    const iteratorModifiers: string[] = stmt.isAsync ? ["async"] : [];

    wrapperBodyStatements.push({
      kind: "localFunctionStatement",
      modifiers: iteratorModifiers,
      returnType: enumerableType,
      name: generatorIteratorFn,
      parameters: [],
      body: { kind: "blockStatement", statements: innerBodyStatements },
    });

    // return new WrapperName(__iterator(), exchange, () => __returnValue);
    const constructorArgs: CSharpExpressionAst[] = [
      {
        kind: "invocationExpression",
        expression: {
          kind: "identifierExpression",
          identifier: generatorIteratorFn,
        },
        arguments: [],
      },
      { kind: "identifierExpression", identifier: generatorExchangeVar },
    ];

    if (generatorHasReturnType) {
      constructorArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [],
        body: {
          kind: "identifierExpression",
          identifier: generatorReturnValueVar,
        },
      });
    }

    wrapperBodyStatements.push({
      kind: "returnStatement",
      expression: {
        kind: "objectCreationExpression",
        type: { kind: "identifierType", name: wrapperName },
        arguments: constructorArgs,
      },
    });

    const localFn: CSharpStatementAst = {
      kind: "localFunctionStatement",
      modifiers,
      returnType: returnTypeAst,
      name: emittedName,
      typeParameters: typeParamNames,
      parameters: [...paramsResult.paramAsts],
      body: { kind: "blockStatement", statements: wrapperBodyStatements },
    };

    return [[localFn], { ...bodyCtxAfter, ...savedScoped }];
  }

  // Non-bidirectional: build body with injected init lines
  const finalBodyStatements: CSharpStatementAst[] = [];

  // Parameter destructuring
  finalBodyStatements.push(...paramDestructuringStmts);

  // Generator exchange initialization
  if (stmt.isGenerator) {
    const exchangeName = `${csharpBaseName}_exchange`;
    finalBodyStatements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: generatorExchangeVar,
          initializer: {
            kind: "objectCreationExpression",
            type: { kind: "identifierType", name: exchangeName },
            arguments: [],
          },
        },
      ],
    });
  }

  // Out parameter initializations
  for (const param of stmt.parameters) {
    if (param.passing === "out" && param.pattern.kind === "identifierPattern") {
      finalBodyStatements.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "identifierExpression",
            identifier: escapeCSharpIdentifier(param.pattern.name),
          },
          right: { kind: "defaultExpression" },
        },
      });
    }
  }

  // Original body statements
  finalBodyStatements.push(...bodyBlock.statements);

  const localFn: CSharpStatementAst = {
    kind: "localFunctionStatement",
    modifiers,
    returnType: returnTypeAst,
    name: emittedName,
    typeParameters: typeParamNames,
    parameters: [...paramsResult.paramAsts],
    body: { kind: "blockStatement", statements: finalBodyStatements },
  };

  return [[localFn], { ...bodyCtxAfter, ...savedScoped }];
};
