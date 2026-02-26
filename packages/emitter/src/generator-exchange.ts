/**
 * Generator Exchange Object Generator
 * Per spec/13-generators.md - Generate exchange objects for bidirectional communication
 */

import { IrModule, IrFunctionDeclaration } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { printType } from "./core/format/backend-ast/printer.js";
import {
  needsBidirectionalSupport,
  generateWrapperClass,
} from "./generator-wrapper.js";
import { getCSharpName } from "./naming-policy.js";

/**
 * Collect all generator functions from a module
 */
const collectGenerators = (module: IrModule): IrFunctionDeclaration[] => {
  const generators: IrFunctionDeclaration[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.isGenerator) {
      generators.push(stmt);
    }
    // Note: Generator methods in classes are not handled here; generator support is currently
    // implemented for module-level generator functions.
  }

  return generators;
};

/**
 * Generate exchange object class for a generator function
 *
 * Example:
 * function* accumulator(start = 0): Generator<number, void, number> { }
 *
 * Generates:
 * public sealed class accumulator_exchange
 * {
 *     public double? Input { get; set; }
 *     public double Output { get; set; }
 * }
 */
const generateExchangeClass = (
  func: IrFunctionDeclaration,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const bodyInd = getIndent(indent(context));
  const parts: string[] = [];
  let currentContext = context;

  const csharpBaseName = getCSharpName(func.name, "methods", context);
  const exchangeName = `${csharpBaseName}_exchange`;

  parts.push(`${ind}public sealed class ${exchangeName}`);
  parts.push(`${ind}{`);

  // Determine output type from return type or yield expressions
  // For now, use 'object' as default, will refine based on type inference
  let outputType = "object";
  let inputType = "object";

  if (func.returnType && func.returnType.kind === "referenceType") {
    // Generator<Yield, Return, Next>
    // typeArguments[0] is the Yield type (Output)
    // typeArguments[2] is the Next type (Input)
    const typeRef = func.returnType;
    if (typeRef.typeArguments && typeRef.typeArguments.length > 0) {
      const yieldTypeArg = typeRef.typeArguments[0];
      if (yieldTypeArg) {
        const [yieldTypeAst, newContext1] = emitTypeAst(
          yieldTypeArg,
          currentContext
        );
        currentContext = newContext1;
        outputType = printType(yieldTypeAst);
      }

      if (typeRef.typeArguments.length > 2) {
        const nextTypeArg = typeRef.typeArguments[2];
        if (nextTypeArg) {
          const [nextTypeAst, newContext2] = emitTypeAst(
            nextTypeArg,
            currentContext
          );
          currentContext = newContext2;
          inputType = printType(nextTypeAst);
        }
      }
    }
  }

  // Input property (always nullable since generator might not receive value)
  parts.push(`${bodyInd}public ${inputType}? Input { get; set; }`);

  // Output property
  parts.push(`${bodyInd}public ${outputType} Output { get; set; }`);

  parts.push(`${ind}}`);

  return [parts.join("\n"), currentContext];
};

/**
 * Generate all exchange objects, wrapper classes, and IteratorResult struct for generators in a module
 */
export const generateGeneratorExchanges = (
  module: IrModule,
  context: EmitterContext
): [string, EmitterContext] => {
  const generators = collectGenerators(module);

  if (generators.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  // Generate exchange classes and wrapper classes for each generator
  // Note: IteratorResult<T> is now in Tsonic.Runtime, not emitted per-module
  for (const generator of generators) {
    // Exchange class (for all generators)
    const [exchangeCode, exchangeContext] = generateExchangeClass(
      generator,
      currentContext
    );
    currentContext = exchangeContext;
    parts.push(exchangeCode);
    parts.push("");

    // Wrapper class (only for bidirectional generators)
    if (needsBidirectionalSupport(generator)) {
      const [wrapperCode, wrapperContext] = generateWrapperClass(
        generator,
        currentContext
      );
      currentContext = wrapperContext;
      parts.push(wrapperCode);
      parts.push("");
    }
  }

  return [parts.join("\n"), currentContext];
};
