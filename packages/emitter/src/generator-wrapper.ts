/**
 * Generator Wrapper Class Generator
 * Per spec/13-generators.md - Generate wrapper classes for bidirectional communication
 *
 * For TypeScript: function* accumulator(start = 0): Generator<number, void, number> { }
 *
 * Generates:
 * 1. Exchange class: accumulator_exchange { Input?, Output }
 * 2. Wrapper class: accumulator_Generator { next(), return(), throw() }
 * 3. Core method: accumulator_core(exchange) returning IEnumerable<exchange>
 * 4. Public method: accumulator(start = 0) returning accumulator_Generator
 */

import { IrFunctionDeclaration, IrType } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { printType } from "./core/format/backend-ast/printer.js";
import { emitCSharpName, getCSharpName } from "./naming-policy.js";

/**
 * Extract Generator type arguments from a return type
 * Generator<T, TReturn, TNext> -> { yieldType: T, returnType: TReturn, nextType: TNext }
 */
export const extractGeneratorTypeArgs = (
  returnType: IrType | undefined,
  context: EmitterContext
): {
  yieldType: string;
  returnType: string;
  nextType: string;
  hasNextType: boolean;
  newContext: EmitterContext;
} => {
  let yieldType = "object";
  let retType = "void";
  let nextType = "object";
  let hasNextType = false;
  let currentContext = context;

  if (returnType?.kind === "referenceType") {
    const typeRef = returnType;
    // Generator<Yield, Return, Next> or AsyncGenerator<Yield, Return, Next>
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [ytAst, ctx1] = emitTypeAst(yieldTypeArg, currentContext);
        currentContext = ctx1;
        yieldType = printType(ytAst);
      }

      if (typeRef.typeArguments.length > 1) {
        const returnTypeArg = typeRef.typeArguments[1];
        if (
          returnTypeArg &&
          returnTypeArg.kind !== "voidType" &&
          !(
            returnTypeArg.kind === "primitiveType" &&
            returnTypeArg.name === "undefined"
          )
        ) {
          const [rtAst, ctx2] = emitTypeAst(returnTypeArg, currentContext);
          currentContext = ctx2;
          retType = printType(rtAst);
        }
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (
          nextTypeArg &&
          !(
            nextTypeArg.kind === "primitiveType" &&
            nextTypeArg.name === "undefined"
          )
        ) {
          const [ntAst, ctx3] = emitTypeAst(nextTypeArg, currentContext);
          currentContext = ctx3;
          nextType = printType(ntAst);
          hasNextType = true;
        }
      }
    }
  }

  return {
    yieldType,
    returnType: retType,
    nextType,
    hasNextType,
    newContext: currentContext,
  };
};

// Note: IteratorResult<T> is now defined in Tsonic.Runtime.Generators
// Use global::Tsonic.Runtime.IteratorResult<T> in generated code

/**
 * Generate wrapper class for a generator function
 *
 * Example for: function* accumulator(start = 0): Generator<number, void, number>
 *
 * public sealed class accumulator_Generator
 * {
 *     private readonly global::System.Collections.Generic.IEnumerator<accumulator_exchange> _enumerator;
 *     private readonly accumulator_exchange _exchange;
 *     private bool _done = false;
 *
 *     public accumulator_Generator(global::System.Collections.Generic.IEnumerable<accumulator_exchange> enumerable, accumulator_exchange exchange)
 *     {
 *         _enumerator = enumerable.GetEnumerator();
 *         _exchange = exchange;
 *     }
 *
 *     public global::Tsonic.Runtime.IteratorResult<double> next(double? value = default)
 *     {
 *         if (_done) return new global::Tsonic.Runtime.IteratorResult<double>(default!, true);
 *         _exchange.Input = value;
 *         if (_enumerator.MoveNext())
 *         {
 *             return new global::Tsonic.Runtime.IteratorResult<double>(_exchange.Output, false);
 *         }
 *         _done = true;
 *         return new global::Tsonic.Runtime.IteratorResult<double>(default!, true);
 *     }
 *
 *     public global::Tsonic.Runtime.IteratorResult<double> @return(TReturn value = default!)
 *     {
 *         _done = true;
 *         _returnValue = value;
 *         _wasExternallyTerminated = true;
 *         _enumerator.Dispose();
 *         return new global::Tsonic.Runtime.IteratorResult<double>(default!, true);
 *     }
 *
 *     public global::Tsonic.Runtime.IteratorResult<double> @throw(object e)
 *     {
 *         _done = true;
 *         _enumerator.Dispose();
 *         if (e is global::System.Exception ex) throw ex;
 *         throw new global::System.Exception(e?.ToString() ?? "Unknown error");
 *     }
 * }
 */
export const generateWrapperClass = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const bodyInd = getIndent(indent(context));
  const innerInd = getIndent(indent(indent(context)));
  const parts: string[] = [];
  let currentContext = context;

  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const wrapperName = `${csharpBaseName}_Generator`;
  const exchangeName = `${csharpBaseName}_exchange`;
  const nextMethodName = emitCSharpName("next", "methods", context);
  const returnMethodName = emitCSharpName("return", "methods", context);
  const throwMethodName = emitCSharpName("throw", "methods", context);
  const returnValuePropertyName = emitCSharpName(
    "returnValue",
    "properties",
    context
  );

  // Extract type arguments
  const { yieldType, returnType, nextType, hasNextType, newContext } =
    extractGeneratorTypeArgs(func.returnType, currentContext);
  currentContext = newContext;

  // Use yieldType for IteratorResult
  const resultType = yieldType;

  parts.push(`${ind}public sealed class ${wrapperName}`);
  parts.push(`${ind}{`);

  // Private fields
  const enumeratorType = func.isAsync
    ? `global::System.Collections.Generic.IAsyncEnumerator<${exchangeName}>`
    : `global::System.Collections.Generic.IEnumerator<${exchangeName}>`;
  parts.push(`${bodyInd}private readonly ${enumeratorType} _enumerator;`);
  parts.push(`${bodyInd}private readonly ${exchangeName} _exchange;`);
  // Return value getter - captures TReturn from generator return statements (natural completion)
  const hasReturnType = returnType !== "void";
  if (hasReturnType) {
    parts.push(
      `${bodyInd}private readonly global::System.Func<${returnType}> _getReturnValue;`
    );
    // Field for external termination via @return(value)
    parts.push(`${bodyInd}private ${returnType} _returnValue = default!;`);
    parts.push(`${bodyInd}private bool _wasExternallyTerminated = false;`);
  }
  parts.push(`${bodyInd}private bool _done = false;`);
  parts.push("");

  // Constructor
  const enumerableType = func.isAsync
    ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
    : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;

  // Constructor signature includes return value getter if TReturn is not void
  const constructorParams = hasReturnType
    ? `${enumerableType} enumerable, ${exchangeName} exchange, global::System.Func<${returnType}> getReturnValue`
    : `${enumerableType} enumerable, ${exchangeName} exchange`;

  parts.push(`${bodyInd}public ${wrapperName}(${constructorParams})`);
  parts.push(`${bodyInd}{`);
  parts.push(
    `${innerInd}_enumerator = enumerable.${func.isAsync ? "GetAsyncEnumerator()" : "GetEnumerator()"};`
  );
  parts.push(`${innerInd}_exchange = exchange;`);
  if (hasReturnType) {
    parts.push(`${innerInd}_getReturnValue = getReturnValue;`);
  }
  parts.push(`${bodyInd}}`);
  parts.push("");

  // next() method
  const nextReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<${resultType}>>`
    : `global::Tsonic.Runtime.IteratorResult<${resultType}>`;
  const nextParamType = hasNextType ? `${nextType}?` : "object?";
  const asyncKeyword = func.isAsync ? "async " : "";
  const awaitKeyword = func.isAsync ? "await " : "";
  const moveNextMethod = func.isAsync ? "MoveNextAsync()" : "MoveNext()";

  parts.push(
    `${bodyInd}public ${asyncKeyword}${nextReturnType} ${nextMethodName}(${nextParamType} value = default)`
  );
  parts.push(`${bodyInd}{`);
  // When already done, return cached result (with TReturn value if available)
  // Note: JS IteratorResult has value: TYield | TReturn on completion
  // We use default! for the value since the consumer should check done first
  parts.push(
    `${innerInd}if (_done) return new global::Tsonic.Runtime.IteratorResult<${resultType}>(default!, true);`
  );
  parts.push(`${innerInd}_exchange.Input = value;`);
  parts.push(`${innerInd}if (${awaitKeyword}_enumerator.${moveNextMethod})`);
  parts.push(`${innerInd}{`);
  parts.push(
    `${innerInd}    return new global::Tsonic.Runtime.IteratorResult<${resultType}>(_exchange.Output, false);`
  );
  parts.push(`${innerInd}}`);
  parts.push(`${innerInd}_done = true;`);
  // When iterator completes, return default! for the value
  // The return value can be accessed via the returnValue property if TReturn is not void
  // Note: JavaScript IteratorResult has value: TYield | TReturn, but C# can't represent this union
  parts.push(
    `${innerInd}return new global::Tsonic.Runtime.IteratorResult<${resultType}>(default!, true);`
  );
  parts.push(`${bodyInd}}`);
  parts.push("");

  // returnValue property - provides access to TReturn when generator completes
  if (hasReturnType) {
    parts.push(`${bodyInd}/// <summary>`);
    parts.push(
      `${bodyInd}/// Gets the return value of the generator after it completes.`
    );
    parts.push(
      `${bodyInd}/// Only valid after the generator is done (next() returned done=true).`
    );
    parts.push(
      `${bodyInd}/// If terminated via return(value), returns that value.`
    );
    parts.push(
      `${bodyInd}/// Otherwise, returns the value from the generator's return statement.`
    );
    parts.push(`${bodyInd}/// </summary>`);
    parts.push(
      `${bodyInd}public ${returnType} ${returnValuePropertyName} => _wasExternallyTerminated ? _returnValue : _getReturnValue();`
    );
    parts.push("");
  }

  // return() method - use @ prefix since 'return' is a C# keyword
  // Per JS spec: return(value) takes TReturn, not TYield
  // The returned IteratorResult still uses TYield for type consistency with next()
  const returnReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<${resultType}>>`
    : `global::Tsonic.Runtime.IteratorResult<${resultType}>`;

  // Parameter type is TReturn (returnType), not TYield (resultType)
  // For void-return generators, use object? since return() can be called with no argument
  const returnParamType = returnType !== "void" ? returnType : "object?";

  parts.push(`${bodyInd}/// <summary>`);
  parts.push(
    `${bodyInd}/// Terminates the generator and sets the return value.`
  );
  parts.push(`${bodyInd}/// </summary>`);
  parts.push(
    `${bodyInd}/// <param name="value">The return value (TReturn type)</param>`
  );
  parts.push(
    `${bodyInd}/// <returns>IteratorResult with done=true and default TYield value</returns>`
  );
  parts.push(`${bodyInd}/// <remarks>`);
  parts.push(
    `${bodyInd}/// NOTE: The passed value does NOT appear in the returned IteratorResult.value.`
  );
  parts.push(
    `${bodyInd}/// C# cannot represent JavaScript's TYield | TReturn union type.`
  );
  parts.push(
    `${bodyInd}/// Access the return value via the 'returnValue' property after calling this method.`
  );
  parts.push(`${bodyInd}/// </remarks>`);
  parts.push(
    `${bodyInd}public ${asyncKeyword}${returnReturnType} ${returnMethodName}(${returnParamType} value = default!)`
  );
  parts.push(`${bodyInd}{`);
  parts.push(`${innerInd}_done = true;`);
  // If TReturn is not void, capture the return value for the returnValue property
  if (hasReturnType) {
    parts.push(`${innerInd}_returnValue = value;`);
    parts.push(`${innerInd}_wasExternallyTerminated = true;`);
  }
  if (func.isAsync) {
    parts.push(`${innerInd}await _enumerator.DisposeAsync();`);
  } else {
    parts.push(`${innerInd}_enumerator.Dispose();`);
  }
  // Return IteratorResult with default TYield (since we're returning TReturn via returnValue property)
  parts.push(
    `${innerInd}return new global::Tsonic.Runtime.IteratorResult<${resultType}>(default!, true);`
  );
  parts.push(`${bodyInd}}`);
  parts.push("");

  // throw() method - use @ prefix since 'throw' is a C# keyword
  // NOTE: Unlike JavaScript, this does NOT inject the exception at the suspended
  // yield point. C# iterators don't support resumption with exceptions.
  // This method terminates the generator and throws the exception externally.
  // This is a semantic limitation - JS generators can catch thrown exceptions
  // inside try/catch around yield, but our C# implementation cannot.
  const throwReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<global::Tsonic.Runtime.IteratorResult<${resultType}>>`
    : `global::Tsonic.Runtime.IteratorResult<${resultType}>`;

  parts.push(`${bodyInd}/// <summary>`);
  parts.push(
    `${bodyInd}/// Terminates the generator and throws the provided exception.`
  );
  parts.push(
    `${bodyInd}/// NOTE: Unlike JavaScript, this does NOT inject the exception at the`
  );
  parts.push(
    `${bodyInd}/// suspended yield point. The exception is thrown externally after`
  );
  parts.push(
    `${bodyInd}/// disposing the enumerator. This is a limitation of C# iterators.`
  );
  parts.push(`${bodyInd}/// </summary>`);
  parts.push(
    `${bodyInd}public ${throwReturnType} ${throwMethodName}(object e)`
  );
  parts.push(`${bodyInd}{`);
  parts.push(`${innerInd}_done = true;`);
  if (func.isAsync) {
    parts.push(`${innerInd}_enumerator.DisposeAsync().AsTask().Wait();`);
  } else {
    parts.push(`${innerInd}_enumerator.Dispose();`);
  }
  parts.push(`${innerInd}if (e is global::System.Exception ex) throw ex;`);
  parts.push(
    `${innerInd}throw new global::System.Exception(e?.ToString() ?? "Unknown error");`
  );
  parts.push(`${bodyInd}}`);

  parts.push(`${ind}}`);

  return [parts.join("\n"), currentContext];
};

/**
 * Check if a generator function needs bidirectional support
 * (i.e., has TNext type parameter that isn't undefined)
 */
export const needsBidirectionalSupport = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 2) {
      const nextTypeArg = typeRef.typeArguments[2];
      // Check if TNext is not undefined
      if (
        nextTypeArg &&
        !(
          nextTypeArg.kind === "primitiveType" &&
          nextTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if a generator function has a return type (TReturn is not void/undefined)
 * This determines whether we need to capture the return value via closure
 */
export const hasGeneratorReturnType = (
  func: IrFunctionDeclaration
): boolean => {
  if (!func.isGenerator) return false;

  if (func.returnType?.kind === "referenceType") {
    const typeRef = func.returnType;
    // TReturn is the second type argument: Generator<Yield, Return, Next>
    if (typeRef.typeArguments && typeRef.typeArguments.length > 1) {
      const returnTypeArg = typeRef.typeArguments[1];
      // Check if TReturn is not void/undefined
      if (
        returnTypeArg &&
        returnTypeArg.kind !== "voidType" &&
        !(
          returnTypeArg.kind === "primitiveType" &&
          returnTypeArg.name === "undefined"
        )
      ) {
        return true;
      }
    }
  }

  return false;
};
