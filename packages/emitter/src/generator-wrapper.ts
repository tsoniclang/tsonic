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
import { emitType } from "./type-emitter.js";

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
        const [yt, ctx1] = emitType(yieldTypeArg, currentContext);
        currentContext = ctx1;
        yieldType = yt;
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
          const [rt, ctx2] = emitType(returnTypeArg, currentContext);
          currentContext = ctx2;
          retType = rt;
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
          const [nt, ctx3] = emitType(nextTypeArg, currentContext);
          currentContext = ctx3;
          nextType = nt;
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

/**
 * Generate the IteratorResult struct for a generator
 *
 * Example:
 * public readonly record struct IteratorResult<T>(T value, bool done);
 *
 * Note: We emit this as a generic record struct that can be reused
 */
export const generateIteratorResultStruct = (
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const code = `${ind}public readonly record struct IteratorResult<T>(T value, bool done);`;
  return [code, context];
};

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
 *     public IteratorResult<double> next(double? value = default)
 *     {
 *         if (_done) return new IteratorResult<double>(default!, true);
 *         _exchange.Input = value;
 *         if (_enumerator.MoveNext())
 *         {
 *             return new IteratorResult<double>(_exchange.Output, false);
 *         }
 *         _done = true;
 *         return new IteratorResult<double>(default!, true);
 *     }
 *
 *     public IteratorResult<double> @return(double value = default)
 *     {
 *         _done = true;
 *         _enumerator.Dispose();
 *         return new IteratorResult<double>(value, true);
 *     }
 *
 *     public IteratorResult<double> @throw(object e)
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

  const wrapperName = `${func.name}_Generator`;
  const exchangeName = `${func.name}_exchange`;

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
  parts.push(`${bodyInd}private bool _done = false;`);
  parts.push("");

  // Constructor
  const enumerableType = func.isAsync
    ? `global::System.Collections.Generic.IAsyncEnumerable<${exchangeName}>`
    : `global::System.Collections.Generic.IEnumerable<${exchangeName}>`;

  parts.push(
    `${bodyInd}public ${wrapperName}(${enumerableType} enumerable, ${exchangeName} exchange)`
  );
  parts.push(`${bodyInd}{`);
  parts.push(
    `${innerInd}_enumerator = enumerable.${func.isAsync ? "GetAsyncEnumerator()" : "GetEnumerator()"};`
  );
  parts.push(`${innerInd}_exchange = exchange;`);
  parts.push(`${bodyInd}}`);
  parts.push("");

  // next() method
  const nextReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<IteratorResult<${resultType}>>`
    : `IteratorResult<${resultType}>`;
  const nextParamType = hasNextType ? `${nextType}?` : "object?";
  const asyncKeyword = func.isAsync ? "async " : "";
  const awaitKeyword = func.isAsync ? "await " : "";
  const moveNextMethod = func.isAsync ? "MoveNextAsync()" : "MoveNext()";

  parts.push(
    `${bodyInd}public ${asyncKeyword}${nextReturnType} next(${nextParamType} value = default)`
  );
  parts.push(`${bodyInd}{`);
  parts.push(
    `${innerInd}if (_done) return new IteratorResult<${resultType}>(default!, true);`
  );
  parts.push(`${innerInd}_exchange.Input = value;`);
  parts.push(`${innerInd}if (${awaitKeyword}_enumerator.${moveNextMethod})`);
  parts.push(`${innerInd}{`);
  parts.push(
    `${innerInd}    return new IteratorResult<${resultType}>(_exchange.Output, false);`
  );
  parts.push(`${innerInd}}`);
  parts.push(`${innerInd}_done = true;`);
  parts.push(
    `${innerInd}return new IteratorResult<${resultType}>(default!, true);`
  );
  parts.push(`${bodyInd}}`);
  parts.push("");

  // return() method - use @ prefix since 'return' is a C# keyword
  const returnReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<IteratorResult<${resultType}>>`
    : `IteratorResult<${resultType}>`;
  const returnParamType = returnType === "void" ? resultType : returnType;

  parts.push(
    `${bodyInd}public ${asyncKeyword}${returnReturnType} @return(${returnParamType} value = default!)`
  );
  parts.push(`${bodyInd}{`);
  parts.push(`${innerInd}_done = true;`);
  if (func.isAsync) {
    parts.push(`${innerInd}await _enumerator.DisposeAsync();`);
  } else {
    parts.push(`${innerInd}_enumerator.Dispose();`);
  }
  parts.push(
    `${innerInd}return new IteratorResult<${resultType}>(value!, true);`
  );
  parts.push(`${bodyInd}}`);
  parts.push("");

  // throw() method - use @ prefix since 'throw' is a C# keyword
  const throwReturnType = func.isAsync
    ? `global::System.Threading.Tasks.Task<IteratorResult<${resultType}>>`
    : `IteratorResult<${resultType}>`;

  parts.push(`${bodyInd}public ${throwReturnType} @throw(object e)`);
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
